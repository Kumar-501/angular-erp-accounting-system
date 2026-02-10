import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';import { AccountService } from '../services/account.service';
import { SaleService } from '../services/sale.service';
import { PurchaseService } from '../services/purchase.service';
import { PurchaseReturnService } from '../services/purchase-return.service';
import { JournalService } from '../services/journal.service';
import { ReceiptService } from '../services/receipt.service';
import { PayService } from '../services/pay.service';
import { DailyStockService } from '../services/daily-stock.service';
import { ProfitLossService } from '../services/profit-loss.service';
import { Subscription } from 'rxjs';
import * as XLSX from 'xlsx';
import { Firestore, collection, getDocs, query, where } from '@angular/fire/firestore';
import { DocumentData } from '@angular/fire/firestore';

// Interfaces for structuring data
interface TrialBalanceItem {
  accountCode: string;
  accountName: string;
  accountType: string;
  debit: number;
  credit: number;
}

interface TrialBalanceData {
  items: TrialBalanceItem[];
  totals: {
    debit: number;
    credit: number;
  };
  difference: number;
}

// Interface for breakdown items from P&L
interface BreakdownItem {
  name: string;
  amount: number;
}

@Component({
  selector: 'app-trial-balance',
  templateUrl: './trial-balance.component.html',
  styleUrls: ['./trial-balance.component.scss']
})
export class TrialBalanceComponent implements OnInit, OnDestroy {
  startDate: string = new Date().toISOString().split('T')[0];
  @ViewChild('startDatePicker') startDatePicker!: ElementRef;
@ViewChild('endDatePicker') endDatePicker!: ElementRef;

  endDate: string = new Date().toISOString().split('T')[0];
  
  trialBalanceData: TrialBalanceData = this.getInitialData();
  
  isLoading = false;
  errorMessage = '';

  plBreakdownData: {
    directExpenseBreakdown: BreakdownItem[];
    indirectExpenseBreakdown: BreakdownItem[];
    operationalExpenseBreakdown: BreakdownItem[];
    directIncomeBreakdown: BreakdownItem[];
    indirectIncomeBreakdown: BreakdownItem[];
  } = {
    directExpenseBreakdown: [],
    indirectExpenseBreakdown: [],
    operationalExpenseBreakdown: [],
    directIncomeBreakdown: [],
    indirectIncomeBreakdown: []
  };

  private dataSubscriptions: Subscription[] = [];
  
  // This line is correct and necessary to fix the 'abs' error in the template.
  Math = Math;

  constructor(
    private accountService: AccountService,
    private saleService: SaleService,
    private purchaseService: PurchaseService,
    private purchaseReturnService: PurchaseReturnService,
    private journalService: JournalService,
    private receiptService: ReceiptService,
    private payService: PayService,
    private dailyStockService: DailyStockService,
    private profitLossService: ProfitLossService,
    private firestore: Firestore
  ) {}

  ngOnInit(): void {
    this.generateTrialBalance();
  }

  ngOnDestroy(): void {
    this.dataSubscriptions.forEach(sub => sub.unsubscribe());
  }
private async calculateTaxCreditsLikeBalanceSheet(): Promise<{ finalInputTax: number, finalOutputTax: number }> {
    try {
        const reportEndDate = new Date(this.endDate);
        reportEndDate.setHours(23, 59, 59, 999);
        const startDate = new Date(0);

        console.log('🧮 [TRIAL BALANCE] Starting Tax Calculation (using Balance Sheet logic)...');
        console.log('Date Range:', startDate, 'to', reportEndDate);

        const [
            grossOutputTax,
            totalSalesReturnTax,
            grossPurchaseTax,
            totalPurchaseReturnTax,
            journalTaxes,
            // ✅ CRITICAL: Include refunded shipping tax (same as Balance Sheet)
            refundedShippingTax
        ] = await Promise.all([
            this.saleService.getGrossOutputTaxByDateRange(startDate, reportEndDate),
            this.saleService.getTotalSalesReturnTaxByDateRange(startDate, reportEndDate),
            this.purchaseService.getGrossPurchaseTaxByDateRange(startDate, reportEndDate),
            this.purchaseReturnService.getTotalPurchaseReturnTaxByDateRange(startDate, reportEndDate),
            this.journalService.getJournalTaxAggregatesByDateRange(startDate, reportEndDate),
            // ✅ CRITICAL: Get refunded shipping tax to match Balance Sheet exactly
            this.purchaseReturnService.getTotalRefundedShippingTaxByDateRange(startDate, reportEndDate)
        ]);

        console.log('🧮 [TRIAL BALANCE] Tax Breakdown (matching Balance Sheet):', {
            grossOutputTax,
            totalSalesReturnTax,
            grossPurchaseTax,
            totalPurchaseReturnTax,
            refundedShippingTax, // ✅ NEW
            journalTaxes
        });

        const netOutputTaxFromSales = grossOutputTax - totalSalesReturnTax;
        
        // ✅ CRITICAL: Subtract refunded shipping tax from net input tax (same as Balance Sheet)
        const netInputTax = grossPurchaseTax - totalPurchaseReturnTax - refundedShippingTax;

        const finalInputTax = netInputTax + journalTaxes.journalInputTax;
        const finalOutputTax = netOutputTaxFromSales + journalTaxes.journalOutputTax;

        console.log('✅ [TRIAL BALANCE] Final Tax Results (matching Balance Sheet):', {
            netInputTaxBeforeJournal: netInputTax,
            finalInputTax: this.round(Math.max(0, finalInputTax)),
            finalOutputTax: this.round(Math.max(0, finalOutputTax))
        });

        return {
            finalInputTax: this.round(Math.max(0, finalInputTax)),
            finalOutputTax: this.round(Math.max(0, finalOutputTax))
        };

    } catch (error) {
        console.error('❌ [TRIAL BALANCE] Error calculating tax credits:', error);
        return { finalInputTax: 0, finalOutputTax: 0 };
    }
}
// src/app/trial-balance/trial-balance.component.ts
getFormattedDateForInput(dateString: any): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

// 2. Trigger the hidden native picker
openDatePicker(type: 'start' | 'end'): void {
  if (type === 'start') {
    this.startDatePicker.nativeElement.showPicker();
  } else {
    this.endDatePicker.nativeElement.showPicker();
  }
}

// 3. Handle manual entry with validation
onManualDateInput(event: any, type: 'start' | 'end'): void {
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
      
      const formattedDate = `${year}-${month}-${day}`;
      if (type === 'start') {
        this.startDate = formattedDate;
      } else {
        this.endDate = formattedDate;
      }
      this.generateTrialBalance(); // Re-run report
    } else {
      alert('Invalid date! Please enter a valid date in DD-MM-YYYY format.');
      this.resetVisibleInput(event, type);
    }
  } else if (input !== '') {
    alert('Format must be DD-MM-YYYY');
    this.resetVisibleInput(event, type);
  }
}

private resetVisibleInput(event: any, type: 'start' | 'end'): void {
  const value = type === 'start' ? this.startDate : this.endDate;
  event.target.value = this.getFormattedDateForInput(value);
}
async generateTrialBalance(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = '';
    this.trialBalanceData = this.getInitialData();
    this.resetPlBreakdownData();

    try {
        const reportStartDate = new Date(this.startDate);
        reportStartDate.setHours(0, 0, 0, 0);

        const reportEndDate = new Date(this.endDate);
        reportEndDate.setHours(23, 59, 59, 999);
        
        const cumulativeStartDate = new Date(0);

        // 1. Fetch all required data in parallel.
        const accountsPromise = new Promise<any[]>(resolve => {
            const unsub = this.accountService.getAccounts((data: any[]) => {
                unsub(); 
                resolve(data);
            });
        });
        
        const primaryTransactionsPromise = this.getAllTransactions(reportEndDate);
        const salesDataPromise = this.saleService.getSalesByDateRange(cumulativeStartDate, reportEndDate);
        
        const salesTotalPromise = this.saleService.getTotalSalesByDateRange(cumulativeStartDate, reportEndDate);
        const salesWithoutTaxPromise = this.saleService.getTotalSalesWithoutTaxByDateRange(cumulativeStartDate, reportEndDate);
        const purchasesTotalPromise = this.purchaseService.getTotalPurchasesByDateRange(cumulativeStartDate, reportEndDate);
        const purchasesWithoutTaxPromise = this.purchaseService.getTotalPurchasesWithoutTaxByDateRange(cumulativeStartDate, reportEndDate);
        
        const taxCreditsPromise = this.calculateTaxCreditsLikeBalanceSheet();
        
        const profitLossPromise = this.profitLossService.getProfitLoss2Report(reportStartDate, reportEndDate);
        const purchaseDuesPromise = this.getPurchaseDues(reportEndDate);
        const salesAndIncomeDuesPromise = this.getSalesAndIncomeDues(reportEndDate);

        // --- Fetching Packing and Net Shipping Charges ---
        const totalPackingChargesPromise = this.saleService.getTotalServiceChargesByDateRange(reportStartDate, reportEndDate);
        
        // ======================= THE FIX IS HERE =======================
        // This now correctly fetches the NET shipping income after returns are subtracted.
        const totalShippingChargesPromise = this.saleService.getNetShippingIncomeForProfitLoss(reportStartDate, reportEndDate);
        // ===================== END OF THE FIX ====================

        const [
            allAccounts,
            primaryTransactions,
            salesData,
            totalSalesWithTax,
            totalSalesWithoutTax,
            totalPurchasesWithTax,
            totalPurchasesWithoutTax,
            taxCredits,
            profitLossReport,
            totalPurchaseDues,
            totalSalesAndIncomeDues,
            totalPackingCharges,
            totalShippingCharges
        ] = await Promise.all([
            accountsPromise,
            primaryTransactionsPromise,
            salesDataPromise,
            salesTotalPromise,
            salesWithoutTaxPromise,
            purchasesTotalPromise,
            purchasesWithoutTaxPromise,
            taxCreditsPromise,
            profitLossPromise,
            purchaseDuesPromise,
            salesAndIncomeDuesPromise,
            totalPackingChargesPromise,
            totalShippingChargesPromise
        ]);

        console.log(`[TRIAL BALANCE DEBUG] Calculated Total Sales & Income Dues: ₹${totalSalesAndIncomeDues}`);
      
        const salesTransactions = this.processSalesIntoTransactions(salesData);
        const allAccountActivity = [...primaryTransactions, ...salesTransactions];

        // 2. Process Accounts: Calculate live closing balance for each account.
        allAccounts.forEach((account: any) => {
            const transactionsForAccount = allAccountActivity.filter(t => t.accountId === account.id);
            const openingBalance = Number(account.openingBalance || 0);

            const closingBalance = transactionsForAccount.reduce((balance, transaction) => {
              const credit = Number(transaction.credit) || 0;
              const debit = Number(transaction.debit) || 0;
              if (transaction.isCapitalTransaction === true) {
                return balance + credit + debit;
              } else {
                return balance + credit - debit;
              }
            }, openingBalance);

            this.classifyAndAddItem(
                account.accountNumber || 'N/A',
                account.name,
                account.accountHead?.group || 'Uncategorized',
                closingBalance
            );
        });
      
        // 3. Process Supplemental Data
        if (totalSalesWithoutTax > 0) this.addItem('SYS-SALES', 'Sales', 'Income', 0, totalSalesWithoutTax);
        if (totalPurchasesWithoutTax > 0) this.addItem('SYS-PURCHASE', 'Purchases', 'Expense', totalPurchasesWithoutTax, 0);
        
        if (taxCredits.finalOutputTax > 0) {
            console.log(`[TRIAL BALANCE] Adding Output Tax Payable: ₹${taxCredits.finalOutputTax.toFixed(2)}`);
            this.addItem('SYS-TAX-OUT', 'Output Tax Payable', 'Liability', 0, taxCredits.finalOutputTax);
        }
        if (taxCredits.finalInputTax > 0) {
            console.log(`[TRIAL BALANCE] Adding Input Tax Credit: ₹${taxCredits.finalInputTax.toFixed(2)}`);
            this.addItem('SYS-TAX-IN', 'Input Tax Credit', 'Asset', taxCredits.finalInputTax, 0);
        }

        if (totalPurchaseDues > 0) {
          this.addItem('SYS-PUR-DUE', 'Purchase Dues (Sundry Creditors)', 'Liability', 0, totalPurchaseDues);
        }

        if (totalSalesAndIncomeDues > 0) {
          console.log('[TRIAL BALANCE DEBUG] Adding Sales & Income Dues item to the report.');
          this.addItem('SYS-SALES-DUE', 'Sales & Income Dues (Sundry Debtors)', 'Asset', totalSalesAndIncomeDues, 0);
        }

        // --- Adding Packing and Shipping Charges to the report ---
        if (totalPackingCharges > 0) {
            this.addItem('SYS-PACK-CHG', 'Packing Charges (Income)', 'Income', 0, totalPackingCharges);
        }
        if (totalShippingCharges > 0) {
            this.addItem('SYS-SHIP-CHG', 'Shipping Charges (Income)', 'Income', 0, totalShippingCharges);
        }
        
        // 4. Add P&L breakdown data
        this.addProfitLossBreakdownData(profitLossReport);

        // 5. Calculate final totals
        this.calculateFinalTotals();

    } catch (error) {
        console.error('Error generating Trial Balance:', error);
        this.errorMessage = `Failed to generate Trial Balance. Please check console for details.`;
    } finally {
        this.isLoading = false;
    }
}

private async getPurchaseDues(reportDate: Date): Promise<number> {
    try {
        const supplierBalances = new Map<string, number>();

        const purchasesQuery = query(collection(this.firestore, 'purchases'), where('purchaseDate', '<=', reportDate));
        const purchasesSnapshot = await getDocs(purchasesQuery);

        purchasesSnapshot.forEach(doc => {
            const purchase = doc.data();
            const grandTotal = Number(purchase['grandTotal'] || purchase['roundedTotal'] || purchase['purchaseTotal'] || 0);
            const paymentAmount = Number(purchase['paymentAmount'] || 0);
            const outstandingAmount = Math.max(0, grandTotal - paymentAmount);
            
            if (outstandingAmount > 0.01 && purchase['supplierId']) {
                const currentBalance = supplierBalances.get(purchase['supplierId']) || 0;
                supplierBalances.set(purchase['supplierId'], currentBalance + outstandingAmount);
            }
        });

        const returnsQuery = query(collection(this.firestore, 'purchase-returns'), where('returnDate', '<=', reportDate));
        const returnsSnapshot = await getDocs(returnsQuery);

        returnsSnapshot.forEach(doc => {
            const returnDoc = doc.data();
            const returnAmount = Number(returnDoc['grandTotal']) || 0;
            if (returnAmount > 0 && returnDoc['supplierId']) {
                const currentBalance = supplierBalances.get(returnDoc['supplierId']) || 0;
                supplierBalances.set(returnDoc['supplierId'], currentBalance - returnAmount);
            }
        });

        let totalDues = 0;
        supplierBalances.forEach(balance => {
            if (balance > 0) {
                totalDues += balance;
            }
        });

        return this.round(totalDues);
    } catch (error) {
        console.error('Error calculating purchase dues:', error);
        return 0;
    }
}


private async getSalesAndIncomeDues(reportDate: Date): Promise<number> {
    let totalDues = 0;
    try {
        console.log(`[TRIAL BALANCE] Fetching Sales & Income Dues up to: ${reportDate.toLocaleDateString()}`);
        
        // MATCH BALANCE SHEET LOGIC: Get sales dues (excluding Returned status)
        const salesCollection = collection(this.firestore, 'sales');
        const salesQuery = query(
            salesCollection,
            where('balanceAmount', '>', 0)
        );
        const salesSnapshot = await getDocs(salesQuery);
        
        let salesDues = 0;
        salesSnapshot.docs.forEach(doc => {
            const saleData = doc.data();
            // Match Balance Sheet: Exclude 'Returned' status sales
            if (saleData['status'] !== 'Returned') {
                const balanceAmount = Number(saleData['balanceAmount']) || 0;
                salesDues += balanceAmount;
                console.log(`  Sale ${saleData['invoiceNo'] || doc.id}: ₹${balanceAmount.toFixed(2)}`);
            }
        });
        console.log(`[TRIAL BALANCE] Total Sales Dues: ₹${salesDues.toFixed(2)}`);
        totalDues += salesDues;

        // MATCH BALANCE SHEET LOGIC: Get income dues
        const incomesCollection = collection(this.firestore, 'incomes');
        const incomesQuery = query(
            incomesCollection,
            where('paymentStatus', 'in', ['Partial', 'Due', 'Unpaid'])
        );
        const incomesSnapshot = await getDocs(incomesQuery);
        
        let incomeDues = 0;
        incomesSnapshot.forEach(doc => {
            const incomeData = doc.data();
            const outstandingAmount = Number(incomeData['balanceAmount']) || 0;
            
            if (outstandingAmount > 0) {
                incomeDues += outstandingAmount;
                console.log(`  Income ${incomeData['description'] || doc.id}: ₹${outstandingAmount.toFixed(2)}`);
            }
        });
        console.log(`[TRIAL BALANCE] Total Income Dues: ₹${incomeDues.toFixed(2)}`);
        totalDues += incomeDues;

        const finalTotal = this.round(totalDues);
        console.log(`[TRIAL BALANCE] Final Sales & Income Dues: ₹${finalTotal.toFixed(2)}`);
        
        return finalTotal;
    } catch (error) {
        console.error('Error calculating sales and income dues:', error);
        return 0;
    }
}

private async calculateTaxCredits(): Promise<{ finalInputTax: number, finalOutputTax: number }> {
    try {
        const reportEndDate = new Date(this.endDate);
        reportEndDate.setHours(23, 59, 59, 999);
        const startDate = new Date(0);

        console.log('[TRIAL BALANCE] Starting Tax Calculation...');

        const [
            grossOutputTax,
            totalSalesReturnTax,
            grossPurchaseTax,
            totalPurchaseReturnTax,
            journalTaxes,
            refundedShippingTax
        ] = await Promise.all([
            this.saleService.getGrossOutputTaxByDateRange(startDate, reportEndDate),
            this.saleService.getTotalSalesReturnTaxByDateRange(startDate, reportEndDate),
            this.purchaseService.getGrossPurchaseTaxByDateRange(startDate, reportEndDate),
            this.purchaseReturnService.getTotalPurchaseReturnTaxByDateRange(startDate, reportEndDate),
            this.journalService.getJournalTaxAggregatesByDateRange(startDate, reportEndDate),
            this.purchaseReturnService.getTotalRefundedShippingTaxByDateRange(startDate, reportEndDate)
        ]);

        console.log('[TRIAL BALANCE] Tax Breakdown:', {
            grossOutputTax,
            totalSalesReturnTax,
            grossPurchaseTax,
            totalPurchaseReturnTax,
            refundedShippingTax,
            journalTaxes
        });

        const netOutputTaxFromSales = grossOutputTax - totalSalesReturnTax;
        const netInputTax = grossPurchaseTax - totalPurchaseReturnTax - refundedShippingTax;

        const finalInputTax = netInputTax + journalTaxes.journalInputTax;
        const finalOutputTax = netOutputTaxFromSales + journalTaxes.journalOutputTax;

        console.log('[TRIAL BALANCE] Final Tax Results:', {
            finalInputTax: this.round(Math.max(0, finalInputTax)),
            finalOutputTax: this.round(Math.max(0, finalOutputTax))
        });

        return {
            finalInputTax: this.round(Math.max(0, finalInputTax)),
            finalOutputTax: this.round(Math.max(0, finalOutputTax))
        };

    } catch (error) {
        console.error('Error calculating tax credits for Trial Balance:', error);
        return { finalInputTax: 0, finalOutputTax: 0 };
    }
}

private convertToDate(dateValue: any): Date {
    if (!dateValue) return new Date();
    if (dateValue instanceof Date) return dateValue;
    if (dateValue?.toDate && typeof dateValue.toDate === 'function') {
        return dateValue.toDate();
    }
    if (typeof dateValue === 'string') {
        const date = new Date(dateValue);
        if (!isNaN(date.getTime())) return date;
    }
    if (typeof dateValue === 'number') return new Date(dateValue);
    return new Date();
}

private calculateSalesPaymentAmount(sale: any): number {
    let paymentAmount = 0;
    if (sale.paymentAmount && Number(sale.paymentAmount) > 0) {
        paymentAmount = Number(sale.paymentAmount);
    }
    return paymentAmount;
}

private processSalesIntoTransactions(sales: any[]): any[] {
    const salesTransactions: any[] = [];
    if (!sales) {
        return salesTransactions;
    }

    sales.forEach(sale => {
        const accountId = sale.paymentAccountId || sale.paymentAccount;
        if (!accountId) {
            return;
        }

        const paymentAmount = this.calculateSalesPaymentAmount(sale);

        if (paymentAmount > 0) {
            salesTransactions.push({
                accountId: accountId,
                credit: paymentAmount,
                debit: 0,
                date: this.convertToDate(sale.paidOn || sale.saleDate || sale.createdAt),
                isCapitalTransaction: false
            });
        }
    });
    return salesTransactions;
}

  private getAllTransactions(asOfDate: Date): Promise<any[]> {
    return new Promise((resolve) => {
      this.accountService.getAllTransactionsUpToDate(asOfDate, (transactions) => {
        resolve(transactions);
      });
    });
  }

  private resetPlBreakdownData(): void {
    this.plBreakdownData = {
      directExpenseBreakdown: [],
      indirectExpenseBreakdown: [],
      operationalExpenseBreakdown: [],
      directIncomeBreakdown: [],
      indirectIncomeBreakdown: []
    };
  }
  
  private addProfitLossBreakdownData(profitLossReport: any): void {
    if (!profitLossReport) return;
    try {
      this.plBreakdownData = {
        directExpenseBreakdown: profitLossReport.directExpenseBreakdown || [],
        indirectExpenseBreakdown: profitLossReport.indirectExpenseBreakdown || [],
        operationalExpenseBreakdown: profitLossReport.operationalExpenseBreakdown || [],
        directIncomeBreakdown: profitLossReport.directIncomeBreakdown || [],
        indirectIncomeBreakdown: profitLossReport.indirectIncomeBreakdown || []
      };

      this.plBreakdownData.directExpenseBreakdown.forEach((item, i) => {
        if (item.amount > 0) this.addItem(`DE-${i + 1}`, `${item.name} (Direct)`, 'Expense', item.amount, 0);
      });
      this.plBreakdownData.indirectExpenseBreakdown.forEach((item, i) => {
        if (item.amount > 0) this.addItem(`IE-${i + 1}`, `${item.name} (Indirect)`, 'Expense', item.amount, 0);
      });
      this.plBreakdownData.operationalExpenseBreakdown.forEach((item, i) => {
        if (item.amount > 0) this.addItem(`OE-${i + 1}`, `${item.name} (Operational)`, 'Expense', item.amount, 0);
      });
      this.plBreakdownData.directIncomeBreakdown.forEach((item, i) => {
        if (item.amount > 0) this.addItem(`DI-${i + 1}`, `${item.name} (Direct)`, 'Income', 0, item.amount);
      });
      this.plBreakdownData.indirectIncomeBreakdown.forEach((item, i) => {
        if (item.amount > 0) this.addItem(`II-${i + 1}`, `${item.name} (Indirect)`, 'Income', 0, item.amount);
      });

    } catch (error) {
      console.error('Error adding P&L breakdown data:', error);
    }
  }
  
// trial-balance.component.ts

  private classifyAndAddItem(code: string, name: string, accountType: string, balance: number): void {
    const principalType = this.getPrincipalType(accountType);
    
    // Do not add rows for zero-balance accounts
    if (this.round(balance) === 0) {
        return;
    }

    switch (principalType) {
        case 'Asset':
        case 'Expense':
            // Standard accounting: Positive balance is a debit, negative balance becomes a credit.
            this.addItem(code, name, principalType, balance > 0 ? balance : 0, balance < 0 ? Math.abs(balance) : 0);
            break;

        case 'Liability':
            // USER REQUEST: Always show the balance as a positive number in the Credit column.
            // The Debit column for liabilities will always be 0.
            this.addItem(code, name, principalType, 0, Math.abs(balance));
            break;

        case 'Equity':
        case 'Income':
            // Standard accounting: Positive balance is a credit, negative balance becomes a debit.
            this.addItem(code, name, principalType, balance < 0 ? Math.abs(balance) : 0, balance > 0 ? balance : 0);
            break;

        default:
            // Fallback for any other account types.
            this.addItem(code, name, 'Unknown', balance >= 0 ? balance : 0, balance < 0 ? Math.abs(balance) : 0);
            break;
    }
  }
  
  private getPrincipalType(type: string): string {
    const lowerType = (type || '').toLowerCase();
    if (lowerType.includes('asset')) return 'Asset';
    if (lowerType.includes('liabilities')) return 'Liability';
    if (lowerType.includes('equity')) return 'Equity';
    if (lowerType.includes('income')) return 'Income';
    if (lowerType.includes('expense')) return 'Expense';
    return type;
  }
  
  private addItem(accountCode: string, accountName: string, accountType: string, debit: number, credit: number): void {
    this.trialBalanceData.items.push({ 
      accountCode, 
      accountName, 
      accountType, 
      debit: this.round(debit), 
      credit: this.round(credit) 
    });
  }
  
  private calculateFinalTotals(): void {
    const totalDebit = this.trialBalanceData.items.reduce((sum, item) => sum + item.debit, 0);
    const totalCredit = this.trialBalanceData.items.reduce((sum, item) => sum + item.credit, 0);
    this.trialBalanceData.totals.debit = this.round(totalDebit);
    this.trialBalanceData.totals.credit = this.round(totalCredit);
    this.trialBalanceData.difference = this.round(totalDebit - totalCredit);
  }

  private getInitialData(): TrialBalanceData {
    return { items: [], totals: { debit: 0, credit: 0 }, difference: 0 };
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }

  exportToExcel(): void {
    const dataForExcel = this.trialBalanceData.items.map(item => ({
      'Account Code': item.accountCode,
      'Particulars': item.accountName,
      'Account Type': item.accountType,
      'Debit (₹)': item.debit,
      'Credit (₹)': item.credit,
    }));
    
    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(dataForExcel);
    
    XLSX.utils.sheet_add_aoa(ws, [
      ['', '', 'TOTAL', this.trialBalanceData.totals.debit, this.trialBalanceData.totals.credit],
      ['', '', 'DIFFERENCE', this.trialBalanceData.difference > 0 ? this.trialBalanceData.difference : '', this.trialBalanceData.difference < 0 ? Math.abs(this.trialBalanceData.difference) : '']
    ], { origin: -1 });
    
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'TrialBalance');
    XLSX.writeFile(wb, `Trial_Balance_${this.startDate}_to_${this.endDate}.xlsx`);
  }

  formatAmount(value: number | null | undefined): string {
    if (value === null || value === undefined || isNaN(value)) {
      return '0.00';
    }
    return new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }
}