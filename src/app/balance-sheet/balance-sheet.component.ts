import { Component, OnInit, OnDestroy ,ViewChild, ElementRef} from '@angular/core';
import { AccountService } from '../services/account.service';

import { ProfitLossService } from '../services/profit-loss.service';
import { ExpenseService } from '../services/expense.service';
import { SaleService } from '../services/sale.service';
import { PurchaseService } from '../services/purchase.service';
import { StockService } from '../services/stock.service';
import { AccountDataService } from '../services/account-data.service'; // <-- This can be removed if not used elsewhere

import { DailyStockService } from '../services/daily-stock.service';
import { JournalService } from '../services/journal.service';
import { Firestore, collection, getDocs, query, where, orderBy, limit, onSnapshot, Timestamp, doc, getDoc } from '@angular/fire/firestore';
import { Subscription, interval } from 'rxjs';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { PurchaseReturnService } from '../services/purchase-return.service';

interface BalanceSheetItem {
  name: string;
  accountNumber: string;
  value: number;
  accountHead: string;
  isRealtimeData?: boolean;
  isCategory?: boolean;
  accounts?: BalanceSheetAccount[];
}

interface BalanceSheetAccount {
  name: string;
  accountNumber: string;
  value: number;
  accountHead: string;
}

interface BalanceSheetData {
  equity: BalanceSheetItem[];
  liabilities: BalanceSheetItem[];
  assets: BalanceSheetItem[];
  stockData: {
    openingStock: number;
    closingStock: number;
  };
tradeData: {
  sundryCreditors: {
    total: number;
    details: { supplierName: string; dueAmount: number }[];
  };
  supplierAdvances: {
    total: number;
    details: { supplierName: string; advanceAmount: number }[];
  };
  sundryDebtors: number;
  expenseDues: number;
};

  taxData: {
    taxPayable: number;
    taxReceivable: number;
  };
  totals: {
    equity: number;
    liabilities: number;
    assets: number;
  };
  lastUpdated?: Date;
  profitLossLastUpdated?: Date;
}

@Component({
  selector: 'app-balance-sheet',
  templateUrl: './balance-sheet.component.html',
  styleUrls: ['./balance-sheet.component.scss']
})
export class BalanceSheetComponent implements OnInit, OnDestroy {
  fromDate: string = '';
    @ViewChild('fromDatePicker') fromDatePicker!: ElementRef;
  @ViewChild('toDatePicker') toDatePicker!: ElementRef;
  toDate: string = new Date().toISOString().split('T')[0];
  balanceSheetData: BalanceSheetData = {
    equity: [],
    liabilities: [],
    assets: [],
    totals: {
      equity: 0,
      
      liabilities: 0,
      assets: 0
    },
    stockData: {
      openingStock: 0,
      closingStock: 0
    },
tradeData: {
  sundryCreditors: { total: 0, details: [] },
  supplierAdvances: { total: 0, details: [] }, // ✅ ADD THIS
  sundryDebtors: 0,
  expenseDues: 0
},

    taxData: {
      taxPayable: 0,
      taxReceivable: 0,
    }
  };
  profitLossData: any = null;
// balanceSheetDate: string = this.formatDateToDDMMYYYY(new Date());

  isLoading = false;
  errorMessage = '';
  autoRefreshEnabled = true;
  refreshInterval = 5; // minutes

  private refreshSubscription?: Subscription;

  private readonly COMPANY_NAME = 'HERBALY TOUCH AYURVEDA HOSPITAL PRIVATE LIMITED';

  constructor(
    private accountService: AccountService,
    private profitLossService: ProfitLossService,
    private expenseService: ExpenseService,
    private saleService: SaleService,
    private purchaseService: PurchaseService,
    private stockService: StockService,
    private dailyStockService: DailyStockService,
    private firestore: Firestore,
    private journalService: JournalService,
    private purchaseReturnService: PurchaseReturnService
  ) {}

async ngOnInit(): Promise<void> {
  const today = new Date();
  const currentYear = today.getFullYear();
  
  // If current month is Jan-Mar (0, 1, 2), FY started April of the previous year
  const startYear = today.getMonth() < 3 ? currentYear - 1 : currentYear;
  
  // Create April 1st date string manually to avoid TimeZone shifting
  // Format: YYYY-MM-DD
  this.fromDate = `${startYear}-04-01`; 
  
  // For To Date, we can use the current local date
  const dd = String(today.getDate()).padStart(2, '0');
  const mm = String(today.getMonth() + 1).padStart(2, '0'); 
  const yyyy = today.getFullYear();
  this.toDate = `${yyyy}-${mm}-${dd}`;

  await this.generateBalanceSheet();
  this.startAutoRefresh();
}
 private getInitialBalanceSheetData(): BalanceSheetData {
    return {
      equity: [],
      liabilities: [],
      assets: [],
      stockData: { openingStock: 0, closingStock: 0 },
tradeData: {
  sundryCreditors: { total: 0, details: [] },
  supplierAdvances: { total: 0, details: [] }, // ✅ ADD THIS
  sundryDebtors: 0,
  expenseDues: 0
},
      taxData: { taxPayable: 0, taxReceivable: 0 },
      totals: { equity: 0, liabilities: 0, assets: 0 },
    };
  }
  // Inside BalanceSheetComponent class

async generateBalanceSheet(forceRefresh = false): Promise<void> {
  this.isLoading = true;
  this.errorMessage = '';
  this.balanceSheetData = { ...this.getInitialBalanceSheetData(), lastUpdated: new Date() };

  try {
    // ✅ FIX: Safe Date Parsing (Prevents the March 31st shift)
    const [fYear, fMonth, fDay] = this.fromDate.split('-').map(Number);
    const startDate = new Date(fYear, fMonth - 1, fDay, 0, 0, 0, 0);

    const [tYear, tMonth, tDay] = this.toDate.split('-').map(Number);
    const reportDate = new Date(tYear, tMonth - 1, tDay, 23, 59, 59, 999);

    if (startDate > reportDate) {
      throw new Error('From Date cannot be later than To Date.');
    }

    const accounts = await this.getAllAccounts();

    // 1. All existing functionality preserved in Promise.all
    const [taxCredits, stockData, tradeData, plReport, pendingSales, netShip, netServ, pendingRefunds] = await Promise.all([
      this.calculateTaxCredits(startDate, reportDate),
      this.loadStockData(reportDate),
      this.loadTradeData(reportDate),
      this.loadExactProfitLoss2Data(startDate, reportDate, forceRefresh),
      this.saleService.getTotalPendingSalesValueByDateRange(new Date(0), reportDate),
      this.saleService.getNetShippingIncomeForProfitLoss(startDate, reportDate),
      this.saleService.getTotalServiceChargesByDateRange(startDate, reportDate),
      this.saleService.getTotalPendingRefundsByDateRange(startDate, reportDate) 
    ]);

    // ✅ Use Stock Data from P&L if available (Existing Logic)
    if (plReport && plReport.closingStock !== undefined) {
      stockData.closingStock = plReport.closingStock;
      stockData.openingStock = plReport.openingStock;
    }

    this.balanceSheetData.stockData = stockData;
    this.balanceSheetData.tradeData = tradeData;

    this.balanceSheetData.taxData = {
      taxPayable: taxCredits.finalOutputTax,
      taxReceivable: taxCredits.finalInputTax
    };

    // Categorize and add data to sections (Existing Logic)
    this.categorizeAccounts(accounts);
    this.addTradeDataToSections(tradeData);
    this.addTaxDataToSections(taxCredits);
    this.addStockToAssets(stockData);
    this.addPendingSalesToLiabilities(pendingSales);

    // 2. Add Pending Refunds to Liabilities (Existing Logic)
    if (pendingRefunds > 0) {
      this.addAccountToSection('liabilities', {
        name: 'Refunds Due to Customers',
        accountNumber: '',
        value: pendingRefunds,
        accountHead: 'Current Liabilities',
        isRealtimeData: true
      });
    }

    // Profit & Loss Handling (Existing Logic)
    if (plReport) {
      const adjustedNetProfit = (plReport.netProfit || 0) + netShip + netServ;
      this.addExactProfitLossToEquity({ ...plReport, netProfit: adjustedNetProfit });
    }

    this.validateBalanceSheet();
  } catch (error: any) {
    console.error('Error generating balance sheet:', error);
    this.errorMessage = error.message || 'Failed to generate balance sheet.';
  } finally {
    this.isLoading = false;
  }
}
// FIXED: Accepts startDate and endDate arguments
  private async calculateTaxCredits(startDate: Date, endDate: Date): Promise<{ finalInputTax: number, finalOutputTax: number }> {
    try {
      const [
        grossOutputTax,
        totalSalesReturnTax,
        grossPurchaseTax,
        totalPurchaseReturnTax,
        journalTaxes
      ] = await Promise.all([
        this.saleService.getGrossOutputTaxByDateRange(startDate, endDate),
        this.saleService.getTotalSalesReturnTaxByDateRange(startDate, endDate),
        this.purchaseService.getGrossPurchaseTaxByDateRange(startDate, endDate),
        this.purchaseReturnService.getTotalPurchaseReturnTaxByDateRange(startDate, endDate),
        this.journalService.getJournalTaxAggregatesByDateRange(startDate, endDate)
      ]);

      // Debugging log to see the values
      console.log('Tax Credits Calculation:', {
        grossOutputTax,
        totalSalesReturnTax,
        netOutputTax: grossOutputTax - totalSalesReturnTax
      });

      return {
        // Input Tax = Purchase Tax - Purchase Return Tax + Journal Input Tax
        finalInputTax: this.roundCurrency(Math.max(0, grossPurchaseTax - totalPurchaseReturnTax + journalTaxes.journalInputTax)),

        // Output Tax = Sales Tax - Sales Return Tax + Journal Output Tax
        // FIX: We subtract 'totalSalesReturnTax' here so liability decreases when a return is created
        finalOutputTax: this.roundCurrency(Math.max(0, (grossOutputTax - totalSalesReturnTax) + journalTaxes.journalOutputTax))
      };
    } catch (error) {
      console.error('Error calculating tax credits:', error);
      return { finalInputTax: 0, finalOutputTax: 0 };
    }
  }

  // FIXED: Accepts closingDate argument
  private async loadStockData(closingDate: Date): Promise<{ openingStock: number, closingStock: number }> {
    try {
      const openingDate = new Date(closingDate);
      openingDate.setDate(openingDate.getDate() - 1);
      openingDate.setHours(23, 59, 59, 999);

      const [openingStock, closingStock] = await Promise.all([
        this.stockService.getClosingStockValue(openingDate),
        this.stockService.getClosingStockValue(closingDate)
      ]);

      return { openingStock, closingStock };
    } catch (error) {
      console.error('Error loading stock data:', error);
      return { openingStock: 0, closingStock: 0 };
    }
  }

  // FIXED: Accepts explicit range arguments
  private async loadExactProfitLoss2Data(startDate: Date, endDate: Date, forceRefresh = false): Promise<any> {
    try {
      console.log(`BS: Requesting P/L from ${startDate.toDateString()} to ${endDate.toDateString()}`);

      const exactReport = await this.profitLossService.getProfitLoss2Report(startDate, endDate, forceRefresh);

      if (!exactReport) {
        console.warn('BS: ProfitLossService returned null/undefined report.');
        return null;
      }

      this.profitLossData = {
        ...exactReport,
        reportDate: { start: startDate, end: endDate },
        isRealtimeData: true,
        lastUpdated: new Date()
      };

      return this.profitLossData;
    } catch (error) {
      console.error('Error loading P&L for Balance Sheet:', error);
      return null;
    }
  }
  ngOnDestroy(): void {
    this.stopAutoRefresh();
  }
getTodayDDMMYYYY(): string {
    const date = new Date();
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
}


  private startAutoRefresh(): void {
    if (this.autoRefreshEnabled && this.refreshInterval > 0) {
      this.refreshSubscription = interval(this.refreshInterval * 60 * 1000)
        .subscribe(() => {
          if (!this.isLoading) {
            console.log('Auto-refreshing balance sheet...');
            this.generateBalanceSheet(true);
          }
        });
    }
  }
    getFormattedDate(dateString: string): string {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-');
    return `${day}-${month}-${year}`;
  }

  // Opens the hidden native date picker when clicking the calendar icon
  openDatePicker(type: 'from' | 'to'): void {
    if (type === 'from') {
      this.fromDatePicker.nativeElement.showPicker();
    } else {
      this.toDatePicker.nativeElement.showPicker();
    }
  }

  // Handles manual typing in DD-MM-YYYY format
  onDateInput(event: any, type: 'from' | 'to'): void {
    const input = event.target.value.trim();
    const datePattern = /^(\d{2})-(\d{2})-(\d{4})$/;
    const match = input.match(datePattern);
    
    if (match) {
      const day = match[1];
      const month = match[2];
      const year = match[3];
      
      const dateObj = new Date(`${year}-${month}-${day}`);
      if (dateObj && dateObj.getDate() === parseInt(day) && 
          dateObj.getMonth() + 1 === parseInt(month)) {
        
        const formattedDate = `${year}-${month}-${day}`; // Internal format YYYY-MM-DD
        if (type === 'from') this.fromDate = formattedDate;
        else this.toDate = formattedDate;
      } else {
        alert('Invalid date! Please enter a valid date in DD-MM-YYYY format.');
        event.target.value = type === 'from' ? this.getFormattedDate(this.fromDate) : this.getFormattedDate(this.toDate);
      }
    }
  }
  private formatDateDDMMYYYY(dateInput: any): string {
  const date = new Date(dateInput);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

// src/app/balance-sheet/balance-sheet.component.ts

// ... existing code ...



private addExactProfitLossToEquity(profitLossReport: any): void {
    // FIX: More robust check. Even if netProfit is 0, we want to show it.
    if (!profitLossReport || typeof profitLossReport.netProfit !== 'number') {
        console.warn('BS: Cannot add P&L to Equity, netProfit is missing:', profitLossReport);
        return;
    }
    
    const netProfitValue = Number(profitLossReport.netProfit) || 0;
    
    console.log(`BS: Adding Net Profit to Equity: ${netProfitValue}`);

    const index = this.balanceSheetData.equity.findIndex(item => item.name.includes('Net Profit') || item.name.includes('Net Loss'));
    
    const itemName = netProfitValue >= 0 ? 'Net Profit (Year to Date)' : 'Net Loss (Year to Date)';
    
    const newItem = {
        name: itemName,
        accountNumber: '',
        value: netProfitValue,
        accountHead: 'Profit & Loss',
        isRealtimeData: true
    };

    if (index > -1) {
        this.balanceSheetData.equity[index] = newItem;
    } else {
        this.balanceSheetData.equity.push(newItem);
    }
}

// ... existing code ...
// When clicked, switch to 'date' type to show calendar


// When moving away, switch back to 'text' and format the display

// ✅ FIXED: getSundryCreditorsAndAdvances in balance-sheet.component.ts
// This method now correctly reads the supplier balance field which is updated by payments

private async getSundryCreditorsAndAdvances(): Promise<{
  sundryCreditors: { total: number; details: any[] };
  supplierAdvances: { total: number; details: any[] };
}> {
  try {
    const suppliersRef = collection(this.firestore, 'suppliers');
    const supplierSnapshot = await getDocs(suppliersRef);

    let creditorsTotal = 0;
    let advancesTotal = 0;
    
    const creditorsDetails: any[] = [];
    const advancesDetails: any[] = [];

    supplierSnapshot.docs.forEach(docSnap => {
      const data = docSnap.data();
      
      // ✅ Read the balance field (which is now properly updated by payments)
      // Positive = We owe them (Liability)
      // Negative = We paid in advance (Asset)
      const rawBalance = Number(data['balance']) || 0;
      
      // Get a display name
      const name = data['businessName'] || 
                   `${data['firstName'] || ''} ${data['lastName'] || ''}`.trim() || 
                   'Unknown Supplier';

      // Threshold to ignore tiny floating point differences
      if (rawBalance > 1) {
        // LIABILITY: Sundry Creditor (We owe money)
        creditorsTotal += rawBalance;
        creditorsDetails.push({
          supplierName: name,
          dueAmount: rawBalance
        });
      } else if (rawBalance < -1) {
        // ASSET: Advance to Supplier (We overpaid)
        const advanceAmt = Math.abs(rawBalance);
        advancesTotal += advanceAmt;
        advancesDetails.push({
          supplierName: name,
          advanceAmount: advanceAmt
        });
      }
    });

    console.log('✅ Balance Sheet Supplier Totals:', {
      creditorsTotal,
      advancesTotal,
      creditors: creditorsDetails.length,
      advances: advancesDetails.length
    });

    return {
      sundryCreditors: {
        total: this.roundCurrency(creditorsTotal),
        details: creditorsDetails
      },
      supplierAdvances: {
        total: this.roundCurrency(advancesTotal),
        details: advancesDetails
      }
    };

  } catch (error) {
    console.error('Error calculating Sundry Creditors/Advances:', error);
    return {
      sundryCreditors: { total: 0, details: [] },
      supplierAdvances: { total: 0, details: [] }
    };
  }
}

// ✅ This helper is already defined in the component, keeping for reference
private roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}
// Triggered when the date is picked
onDateStringChange() {
    this.generateBalanceSheet();
}

  private stopAutoRefresh(): void {
    if (this.refreshSubscription) {
      this.refreshSubscription.unsubscribe();
      this.refreshSubscription = undefined;
    }
  }

  toggleAutoRefresh(): void {
    this.autoRefreshEnabled = !this.autoRefreshEnabled;

    if (this.autoRefreshEnabled) {
      this.startAutoRefresh();
    } else {
      this.stopAutoRefresh();
    }
  }

  private async getIncomeDues(): Promise<number> {
    try {
      const incomesCollection = collection(this.firestore, 'incomes');
      const q = query(
        incomesCollection,
        where('paymentStatus', 'in', ['Partial', 'Due', 'Unpaid'])
      );

      const querySnapshot = await getDocs(q);

      let totalDues = 0;
      querySnapshot.docs.forEach(doc => {
        const incomeData = doc.data();
        const outstandingAmount = Number(incomeData['balanceAmount']) || 0;

        if (outstandingAmount > 0) {
          totalDues += outstandingAmount;
        }
      });
      return totalDues;
    } catch (error) {
      console.error('Error calculating income dues:', error);
      return 0;
    }
  }

  async manualRefresh(): Promise<void> {
    await this.generateBalanceSheet(true);
  }




  
  // [REMOVED] The getAllTransactions, synthesizeSaleTransactions, and calculateSalesPaymentAmount
  // methods are no longer needed in this component.

  private addPendingSalesToLiabilities(pendingSalesValue: number): void {
    if (pendingSalesValue > 0) {
      this.addAccountToSection('liabilities', {
        name: 'Advances from Customers (Pending Sales)',
        accountNumber: '',
        value: pendingSalesValue,
        accountHead: 'Current Liabilities',
        isRealtimeData: true
      });
    }
  }

// src/app/balance-sheet/balance-sheet.component.ts



  getPendingSalesTotal(): number {
    if (!this.balanceSheetData.liabilities) return 0;

    const pendingSalesItem = this.balanceSheetData.liabilities.find(item =>
      item.name === 'Advances from Customers (Pending Sales)'
    );

    return pendingSalesItem ? pendingSalesItem.value : 0;
  }

  private getAllAccountHeadTypes() {
    return {
      'Asset': [
        'Asset|fixed_assets', 'Asset|deposits_assets', 'Asset|investments', 'Asset|loans_advances',
        'Asset|sundry_debtors', 'Asset|suspense_account', 'Asset|income_receivables', 'Asset|input_tax_credits',
        'Asset|prepaid_advances', 'Asset|bank_accounts', 'Asset|current_assets'
      ],
      'Equity': [
        'Equity|capital_account'
      ],
      'Liabilities': [
        'Liabilities|current_liabilities', 'Liabilities|duties_taxes', 'Liabilities|loans_liabilities',
        'Liabilities|secured_loans', 'Liabilities|sundry_creditors', 'Liabilities|expenses_payable',
        'Liabilities|advance_earned', 'Liabilities|tax_payable', 'Liabilities|tds_payable'
      ]
    };
  }

  private getAccountHeadDisplayName(accountHeadValue: string): string {
    const accountHeadMap: { [key: string]: string } = {
      'Asset|fixed_assets': 'Fixed Assets', 'Asset|deposits_assets': 'Deposits (Assets)',
      'Asset|investments': 'Investments', 'Asset|loans_advances': 'Loans and Advances',
      'Asset|sundry_debtors': 'Sundry Debtors', 'Asset|suspense_account': 'Suspense A/C',
      'Asset|income_receivables': 'Income Receivables', 'Asset|input_tax_credits': 'Input Tax Credits',
      'Asset|prepaid_advances': 'Prepaid Advances', 'Asset|bank_accounts': 'Banks',
      'Asset|current_assets': 'Current Assets', 'Equity|capital_account': 'Capital Account',
      'Liabilities|current_liabilities': 'Current Liabilities', 'Liabilities|duties_taxes': 'Duties and Taxes',
      'Liabilities|loans_liabilities': 'Loans (Liabilities)', 'Liabilities|secured_loans': 'Secured Loans',
      'Liabilities|sundry_creditors': 'Sundry Creditors', 'Liabilities|expenses_payable': 'Expense Payable',
      'Liabilities|advance_earned': 'Advance Earned', 'Liabilities|tax_payable': 'Tax Payable',
      'Liabilities|tds_payable': 'TDS Payable'
    };
    return accountHeadMap[accountHeadValue] || accountHeadValue;
  }
  // [REVISED] This method now trusts the `currentBalance` field from the fetched account data.
  // MODIFIED: Uses Math.abs() for Liabilities to ensure they display as positive values.
  private categorizeAccounts(accounts: any[]): void {
    const allAccountHeadTypes = this.getAllAccountHeadTypes();
    const accountsByHead: { [key: string]: any[] } = {};

    accounts.forEach(account => {
        const headValue = account.accountHead?.value;
        if (headValue) {
            if (!accountsByHead[headValue]) accountsByHead[headValue] = [];
            accountsByHead[headValue].push(account);
        }
    });

    for (const [group, headTypes] of Object.entries(allAccountHeadTypes)) {
        for (const headValue of headTypes) {
            const accountsForThisHead = accountsByHead[headValue] || [];
            const displayName = this.getAccountHeadDisplayName(headValue);

            const isLiability = group.toLowerCase() === 'liabilities';

            // Use 'currentBalance' for the category total.
            const categoryTotal = accountsForThisHead.reduce((sum, account) =>
                sum + (account.currentBalance ?? account.openingBalance ?? 0), 0);

            const categoryHeaderItem: BalanceSheetItem = {
                name: displayName,
                accountNumber: '',
                // FIX: Use Math.abs for liabilities to treat debt as positive value
                value: isLiability ? Math.abs(categoryTotal) : categoryTotal,
                accountHead: displayName,
                isCategory: true,
            };

            // Use 'currentBalance' for each individual account item.
            const individualAccountItems: BalanceSheetItem[] = accountsForThisHead.map(account => ({
                name: `  ${account.name}`,
                accountNumber: account.accountNumber || '',
                // FIX: Use Math.abs for liabilities to treat debt as positive value
                value: isLiability ? Math.abs(account.currentBalance ?? 0) : (account.currentBalance ?? 0),
                accountHead: displayName,
                isCategory: false,
            }));

            let targetSection: keyof Pick<BalanceSheetData, 'equity' | 'liabilities' | 'assets'>;
            const groupLower = group.toLowerCase();

            if (groupLower === 'asset') {
                targetSection = 'assets';
            } else if (groupLower === 'equity') {
                targetSection = 'equity';
            } else {
                targetSection = 'liabilities';
            }

            if (this.balanceSheetData[targetSection]) {
                this.balanceSheetData[targetSection].push(categoryHeaderItem);
                individualAccountItems.forEach(item => {
                    this.balanceSheetData[targetSection].push(item);
                });
            }
        }
    }
  }

private async loadTradeData(
  reportDate: Date
): Promise<{
  sundryCreditors: { total: number; details: any[] };
  supplierAdvances: { total: number; details: any[] };
  sundryDebtors: number;
  expenseDues: number;
}> {
  try {
    const [
      supplierTrade,
      debtorsFromSales,
      debtorsFromIncome,
      expenseDues
    ] = await Promise.all([
      this.getSundryCreditorsAndAdvances(), // 👈 NEW unified logic
      this.getSundryDebtors(),
      this.getIncomeDues(),
      this.getExpenseDues()
    ]);

    const totalSundryDebtors = debtorsFromSales + debtorsFromIncome;

    return {
      sundryCreditors: supplierTrade.sundryCreditors,
      supplierAdvances: supplierTrade.supplierAdvances,
      sundryDebtors: totalSundryDebtors,
      expenseDues: expenseDues
    };
  } catch (error) {
    console.error('Error loading trade data:', error);
    return {
      sundryCreditors: { total: 0, details: [] },
      supplierAdvances: { total: 0, details: [] },
      sundryDebtors: 0,
      expenseDues: 0
    };
  }
}





// 3. Update the Tax Data visibility method
private addTaxDataToSections(taxCredits: { finalInputTax: number, finalOutputTax: number }): void {
    // Show Output Tax Payable if there is a liability
    if (taxCredits.finalOutputTax > 0) {
        this.addAccountToSection('liabilities', {
            name: 'Output Tax Payable',
            accountNumber: '',
            value: taxCredits.finalOutputTax,
            accountHead: 'Duties and Taxes',
            isRealtimeData: true
        });
    }

    // Show ITC if there is a credit
    if (taxCredits.finalInputTax > 0) {
        this.addAccountToSection('assets', {
            name: 'Input Tax Credit',
            accountNumber: '',
            value: taxCredits.finalInputTax,
            accountHead: 'Current Assets',
            isRealtimeData: true
        });
    }
}
  private addStockToAssets(stockData: {openingStock: number, closingStock: number}): void {
    this.addAccountToSection('assets', {
      name: 'Inventory (Closing Stock)',
      accountNumber: '',
      value: stockData.closingStock,
      accountHead: 'Current Assets',
      isRealtimeData: true
    });
  }

  private async getExpenseDues(): Promise<number> {
    try {
      const expensesCollection = collection(this.firestore, 'expenses');
      const q = query(expensesCollection, where('paymentStatus', 'in', ['Partial', 'Due', 'Unpaid']));
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.reduce((sum, doc) =>
        sum + (Number(doc.data()['balanceAmount']) || 0), 0);
    } catch (error) {
      console.error('Error calculating expense dues:', error);
      return 0;
    }
  }

  getBalanceSheetStatus(): string {
    if (this.isLoading) return 'Loading...';
    if (this.errorMessage) return 'Error';
    if (!this.balanceSheetData) return 'No Data';

    const totalEquityAndLiabilities = this.balanceSheetData.totals.equity + this.balanceSheetData.totals.liabilities;
    const totalAssets = this.balanceSheetData.totals.assets;
    const difference = Math.abs(totalAssets - totalEquityAndLiabilities);

    return difference < 1 ? 'Balanced' : 'Unbalanced';
  }

  private addAccountToSection(section: keyof Pick<BalanceSheetData, 'equity' | 'liabilities' | 'assets'>, item: BalanceSheetItem): void {
    this.balanceSheetData[section].push(item);
  }



  private convertToDate(dateValue: any): Date {
      if (!dateValue) return new Date();
      if (dateValue instanceof Date) return dateValue;
      if (dateValue?.toDate && typeof dateValue.toDate === 'function') return dateValue.toDate();
      if (typeof dateValue === 'string') {
        const date = new Date(dateValue);
        if (!isNaN(date.getTime())) return date;
        try {
          const cleanedDate = dateValue.replace(/\s+at\s+.*$/, '');
          return new Date(cleanedDate);
        } catch {
          return new Date();
        }
      }
      if (typeof dateValue === 'number') return new Date(dateValue);
      return new Date();
  }

  private validateBalanceSheet(): void {
    if (!this.balanceSheetData) {
        this.errorMessage = 'Balance sheet data not available';
        return;
    }
    const sumSection = (section: BalanceSheetItem[]) =>
        section.filter(item => !item.isCategory).reduce((sum, item) => sum + item.value, 0);

    this.balanceSheetData.totals = {
        equity: this.roundCurrency(sumSection(this.balanceSheetData.equity)),
        liabilities: this.roundCurrency(sumSection(this.balanceSheetData.liabilities)),
        assets: this.roundCurrency(sumSection(this.balanceSheetData.assets))
    };
    const totalEquityAndLiabilities = this.balanceSheetData.totals.equity + this.balanceSheetData.totals.liabilities;
    const totalAssets = this.balanceSheetData.totals.assets;
    const difference = Math.abs(totalAssets - totalEquityAndLiabilities);
    
    this.errorMessage = '';
  }
private addTradeDataToSections(tradeData: {
  sundryCreditors: {
    total: number;
    details: { supplierName: string; dueAmount: number }[];
  };
  supplierAdvances: {
    total: number;
    details: { supplierName: string; advanceAmount: number }[];
  };
  sundryDebtors: number;
  expenseDues: number;
}): void {

  // ---------------------------
  // SUNDRY CREDITORS (PAYABLE)
  // ---------------------------
  if (tradeData.sundryCreditors.total > 0) {
    this.addAccountToSection('liabilities', {
      name: 'Sundry Creditors (Purchase Dues)',
      accountNumber: '',
      value: tradeData.sundryCreditors.total,
      accountHead: 'Sundry Creditors',
      isCategory: true,
      isRealtimeData: true
    });

    tradeData.sundryCreditors.details.forEach(supplierDue => {
      this.addAccountToSection('liabilities', {
        name: `  ${supplierDue.supplierName}`,
        accountNumber: '',
        value: supplierDue.dueAmount,
        accountHead: 'Sundry Creditors',
        isRealtimeData: true
      });
    });
  }

  // ---------------------------
  // SUPPLIER ADVANCES (ASSET)
  // ---------------------------
  if (tradeData.supplierAdvances?.total > 0) {
    this.addAccountToSection('assets', {
      name: 'Advance to Suppliers',
      accountNumber: '',
      value: tradeData.supplierAdvances.total,
      accountHead: 'Current Assets',
      isCategory: true,
      isRealtimeData: true
    });

    tradeData.supplierAdvances.details.forEach(adv => {
      this.addAccountToSection('assets', {
        name: `  ${adv.supplierName}`,
        accountNumber: '',
        value: adv.advanceAmount,
        accountHead: 'Current Assets',
        isRealtimeData: true
      });
    });
  }

  // ---------------------------
  // EXPENSE DUES
  // ---------------------------
  if (tradeData.expenseDues > 0) {
    this.addAccountToSection('liabilities', {
      name: 'Expense Dues',
      accountNumber: '',
      value: tradeData.expenseDues,
      accountHead: 'Expense Payable',
      isRealtimeData: true
    });
  }

  // ---------------------------
  // SUNDRY DEBTORS
  // ---------------------------
  if (tradeData.sundryDebtors > 0) {
    this.addAccountToSection('assets', {
      name: 'Sundry Debtors (Sales & Income Dues)',
      accountNumber: '',
      value: tradeData.sundryDebtors,
      accountHead: 'Sundry Debtors',
      isRealtimeData: true
    });
  }
}


// src/app/balance-sheet/balance-sheet.component.ts

private async getSundryDebtors(): Promise<number> {
  try {
    const salesCollection = collection(this.firestore, 'sales');
    
    // We fetch all active sales that aren't fully returned or cancelled
    const q = query(
      salesCollection,
      where('status', 'in', ['Completed', 'Partial Return'])
    );
    
    const querySnapshot = await getDocs(q);

    const totalDebtors = querySnapshot.docs.reduce((sum, doc) => {
      const data = doc.data();
      
      // Calculate real-time debt:
      // Total Payable (MRP + Tax + Shipping) 
      const totalPayable = Number(data['totalPayable'] || data['totalAmount'] || 0);
      
      // Amount already paid by customer
      const paidAmount = Number(data['paymentAmount'] || 0);
      
      // Value of items returned (Must be tracked on the sale doc or calculated)
      // If you don't have a 'totalReturned' field, we calculate it from products
      let totalReturned = Number(data['totalReturned']) || 0;
      
      if (!totalReturned && data['products']) {
        totalReturned = data['products'].reduce((pSum: number, p: any) => {
          const qtyRet = Number(p.quantityReturned) || 0;
          const price = Number(p.unitPrice) || Number(p.price) || 0;
          return pSum + (qtyRet * price);
        }, 0);
      }

      // Net Debt = Original Total - Amount Paid - Value of Returned Goods
      const currentDebt = totalPayable - paidAmount - totalReturned;
      
      return sum + Math.max(0, currentDebt);
    }, 0);

    return totalDebtors;
  } catch (error) {
    console.error('Error calculating sundry debtors:', error);
    return 0;
  }
}

  // [NEW] A helper method to get a one-time snapshot of all accounts.
  private async getAllAccounts(): Promise<any[]> {
    try {
      const accountsRef = collection(this.firestore, 'accounts');
      const snapshot = await getDocs(accountsRef);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error fetching accounts:', error);
      throw new Error(`Failed to fetch accounts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(value);
  }

exportToExcel(): void {
  try {
    const excelData = [
      [this.COMPANY_NAME],
      ['Balance Sheet'],
      [`From: ${this.fromDate} To: ${this.toDate}`], // Updated Date Usage
      [],
      ['Liabilities & Equity', '', '', 'Amount (₹)'],
      ...this.balanceSheetData.equity.map(item => [item.name, item.accountNumber, item.accountHead, item.value]),
      ['Total Equity', '', '', this.balanceSheetData.totals.equity],
      [],
      ...this.balanceSheetData.liabilities.map(item => [item.name, item.accountNumber, item.accountHead, item.value]),
      ['Total Liabilities', '', '', this.balanceSheetData.totals.liabilities],
      [],
      ['TOTAL LIABILITIES & EQUITY', '', '', this.balanceSheetData.totals.liabilities + this.balanceSheetData.totals.equity],
      [],
      ['Assets', '', '', 'Amount (₹)'],
      ...this.balanceSheetData.assets.map(item => [item.name, item.accountNumber, item.accountHead, item.value]),
      ['Total Assets', '', '', this.balanceSheetData.totals.assets]
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Balance Sheet');
    XLSX.writeFile(workbook, `Balance_Sheet_${this.toDate}.xlsx`); // Updated Filename
  } catch (error) {
    console.error('Error exporting to Excel:', error);
  }
}

printBalanceSheet(): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  
  const tableRows = (items: BalanceSheetItem[]) => items.map(item => `
    <tr class="${item.isCategory ? 'category-row' : ''}">
      <td>${item.name}</td>
      <td class="text-right">${this.formatCurrency(item.value)}</td>
    </tr>`).join('');

  printWindow.document.write(`
    <html>
      <head>
        <title>Balance Sheet - ${this.COMPANY_NAME}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { text-align: center; margin-bottom: 20px; }
          .sheet-content { display: flex; justify-content: space-between; gap: 20px; }
          .financial-column { width: 48%; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10pt; }
          th, td { border: 1px solid #ccc; padding: 6px; text-align: left; }
          th { background-color: #f2f2f2; }
          .total-row td { font-weight: bold; background-color: #f2f2f2; }
          h3 { font-size: 14pt; margin-top: 20px; border-bottom: 2px solid #333; padding-bottom: 5px; }
          .text-right { text-align: right; }
          .category-row { font-weight: bold; }
          .summary { margin-top: 30px; border-top: 2px double #333; padding-top: 15px; }
          @media print { @page { size: portrait; margin: 10mm; } body { margin: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${this.COMPANY_NAME}</h1>
          <h2>Balance Sheet</h2>
          <p>As on ${new Date(this.toDate).toLocaleDateString('en-GB')}</p> <!-- Updated Date Usage -->
        </div>
        <div class="sheet-content">
          <div class="financial-column">
            <h3>Liabilities & Equity</h3>
            <table><thead><tr><th>Account</th><th class="text-right">Amount (₹)</th></tr></thead><tbody>
              ${tableRows(this.balanceSheetData.equity)}
              <tr class="total-row"><td>Total Equity</td><td class="text-right">${this.formatCurrency(this.balanceSheetData.totals.equity)}</td></tr>
              ${tableRows(this.balanceSheetData.liabilities)}
              <tr class="total-row"><td>Total Liabilities</td><td class="text-right">${this.formatCurrency(this.balanceSheetData.totals.liabilities)}</td></tr>
            </tbody></table>
          </div>
          <div class="financial-column">
            <h3>Assets</h3>
            <table><thead><tr><th>Account</th><th class="text-right">Amount (₹)</th></tr></thead><tbody>
              ${tableRows(this.balanceSheetData.assets)}
              <tr class="total-row"><td>Total Assets</td><td class="text-right">${this.formatCurrency(this.balanceSheetData.totals.assets)}</td></tr>
            </tbody></table>
          </div>
        </div>
        <div class="summary">
          <table>
            <tr class="total-row"><td>Total Liabilities & Equity</td><td class="text-right">${this.formatCurrency(this.balanceSheetData.totals.equity + this.balanceSheetData.totals.liabilities)}</td></tr>
            <tr class="total-row"><td>Total Assets</td><td class="text-right">${this.formatCurrency(this.balanceSheetData.totals.assets)}</td></tr>
          </table>
        </div>
        <script>setTimeout(() => { window.print(); window.close(); }, 250);</script>
      </body>
    </html>
  `);
  printWindow.document.close();
}



}