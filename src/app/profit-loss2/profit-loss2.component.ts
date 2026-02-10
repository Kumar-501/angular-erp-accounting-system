import { Component, OnInit, ViewChild, ElementRef } from '@angular/core'; // Added ViewChild, ElementRef
import { CurrencyPipe } from '@angular/common';
import { StockService } from '../services/stock.service';
import { SaleService } from '../services/sale.service';
import { PurchaseService } from '../services/purchase.service';
import { JournalService } from '../services/journal.service';
import { ExpenseService } from '../services/expense.service';
import { ProfitLossService } from '../services/profit-loss.service';
import { Firestore, collection, query, where, getDocs, Timestamp } from '@angular/fire/firestore';
import { PurchaseReturnService } from '../services/purchase-return.service';

// Define an interface for cleaner data management
interface ProfitLossData {
  openingStock: number;
  closingStock: number;
  purchases: number;
  directExpense: number;
  sales: number;
  directIncome: number;
  grossProfit: number; // Will be positive for profit, negative for loss
  tradingAccountTotal: number;
  indirectExpense: number;
  otherPurchases: number;
  operationalExpense: number;
  indirectIncome: number;
  netProfit: number; // Will be positive for profit, negative for loss
  plAccountTotal: number;
}

// Interface for breakdown items
interface BreakdownItem {
  name: string;
  amount: number;
}

@Component({
  selector: 'app-profit-loss2',
  templateUrl: './profit-loss2.component.html',
  styleUrls: ['./profit-loss2.component.scss'],
  providers: [CurrencyPipe]
})
export class ProfitLoss2Component implements OnInit {
  @ViewChild('startDatePicker') startDatePicker!: ElementRef;
  @ViewChild('endDatePicker') endDatePicker!: ElementRef;
  isLoading = true;

  // Date range for the report
  startDate!: Date;
  endDate!: Date;

  // Properties for custom date range
  customStartDate!: string;
  customEndDate!: string;

  // Object to hold all P&L figures
  plData: ProfitLossData = {
    openingStock: 0,
    closingStock: 0,
    purchases: 0,
    directExpense: 0,
    sales: 0,
    directIncome: 0,
    grossProfit: 0,
    tradingAccountTotal: 0,
    indirectExpense: 0,
    otherPurchases: 0,
    operationalExpense: 0,
    indirectIncome: 0,
    netProfit: 0,
    plAccountTotal: 0,
  };

  // Properties to hold the detailed breakdowns
  directExpenseBreakdown: BreakdownItem[] = [];
  indirectExpenseBreakdown: BreakdownItem[] = [];
  operationalExpenseBreakdown: BreakdownItem[] = [];
  directIncomeBreakdown: BreakdownItem[] = [];
  indirectIncomeBreakdown: BreakdownItem[] = [];

  constructor(
    private stockService: StockService,
    private purchaseService: PurchaseService,
    private journalService: JournalService,
    private expenseService: ExpenseService,
    private saleService: SaleService,
    private profitLossService: ProfitLossService,
    private purchaseReturnService: PurchaseReturnService,
    private firestore: Firestore
  ) {}

  ngOnInit(): void {
    const today = new Date();
    this.customStartDate = this.formatDateToYYYYMMDD(new Date(today.getFullYear(), today.getMonth(), 1));
    this.customEndDate = this.formatDateToYYYYMMDD(today);
    this.setDateFilter('today');
  }
  /**
   * Sets the date range based on a filter and re-loads the report data.
   */
  setDateFilter(filter: 'today' | 'yesterday' | 'week'): void {
    const now = new Date();

    switch (filter) {
      case 'today':
        this.startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        this.endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        break;
      case 'yesterday':
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        this.startDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0);
        this.endDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59);
        break;
      case 'week':
        const firstDayOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        this.startDate = new Date(firstDayOfWeek.getFullYear(), firstDayOfWeek.getMonth(), firstDayOfWeek.getDate(), 0, 0, 0);
        this.endDate = new Date(); // now
        break;
    }

    this.loadProfitLossData();
  }
// UPDATED loadProfitLossData() method in profit-loss2.component.ts
// Replace the existing method with this enhanced version


// FIXED profit-loss2.component.ts loadProfitLossData() method
  getFormattedDate(dateString: string): string {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-');
    return `${day}-${month}-${year}`;
  }

  // Helper to format Date object to YYYY-MM-DD for the model
  private formatDateToYYYYMMDD(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  // Opens the hidden native date picker
  openDatePicker(type: 'start' | 'end'): void {
    if (type === 'start') {
      this.startDatePicker.nativeElement.showPicker();
    } else {
      this.endDatePicker.nativeElement.showPicker();
    }
  }

  // Handles manual typing in DD-MM-YYYY format
  onDateInput(event: any, type: 'start' | 'end'): void {
    const input = event.target.value.trim();
    const datePattern = /^(\d{2})-(\d{2})-(\d{4})$/;
    const match = input.match(datePattern);
    
    if (match) {
      const day = match[1];
      const month = match[2];
      const year = match[3];
      const dateObj = new Date(`${year}-${month}-${day}`);
      
      if (dateObj && dateObj.getDate() === parseInt(day) && dateObj.getMonth() + 1 === parseInt(month)) {
        const formattedDate = `${year}-${month}-${day}`;
        if (type === 'start') this.customStartDate = formattedDate;
        else this.customEndDate = formattedDate;
      } else {
        alert('Invalid date! Please enter a valid date in DD-MM-YYYY format.');
        event.target.value = type === 'start' ? this.getFormattedDate(this.customStartDate) : this.getFormattedDate(this.customEndDate);
      }
    }
  }

  // Updated existing method to use normalized dates
  applyCustomDateFilter(): void {
    if (this.customStartDate && this.customEndDate) {
      // Set hours to ensure full day coverage
      const start = new Date(this.customStartDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(this.customEndDate);
      end.setHours(23, 59, 59, 999);
      
      this.startDate = start;
      this.endDate = end;
      this.loadProfitLossData();
    }
  }

async loadProfitLossData(): Promise<void> {
  this.isLoading = true;
  
  try {
    // ✅ FIX: Properly normalize dates to avoid timezone issues
    const start = new Date(this.startDate);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(this.endDate);
    end.setHours(23, 59, 59, 999);

    console.log(`📊 Loading P&L Report for: ${start.toDateString()} to ${end.toDateString()}`);

    // ✅ Call the service to get complete report
    const report = await this.profitLossService.getProfitLoss2Report(start, end, true);

    // ✅ Assign all values from the report
    this.plData.openingStock = report.openingStock;
    this.plData.closingStock = report.closingStock;
    this.plData.purchases = report.purchases;
    this.plData.sales = report.sales;
    this.plData.directExpense = report.directExpenses;
    this.plData.indirectExpense = report.indirectExpenses;
    this.plData.operationalExpense = report.operationalExpenses;
    this.plData.directIncome = report.directIncome;
    this.plData.indirectIncome = report.indirectIncome;
    this.plData.grossProfit = report.grossProfit;
    this.plData.netProfit = report.netProfit;

    // ✅ Assign breakdowns
    this.directExpenseBreakdown = report.directExpenseBreakdown || [];
    this.indirectExpenseBreakdown = report.indirectExpenseBreakdown || [];
    this.operationalExpenseBreakdown = report.operationalExpenseBreakdown || [];
    this.directIncomeBreakdown = report.directIncomeBreakdown || [];
    this.indirectIncomeBreakdown = report.indirectIncomeBreakdown || [];

    // ✅ Calculate totals for display
    this.calculateTotals();

    // ✅ VERIFICATION LOG
    console.log(`✅ P&L Report Loaded:`);
    console.log(`   Opening Stock: ₹${this.plData.openingStock.toFixed(2)}`);
    console.log(`   Closing Stock: ₹${this.plData.closingStock.toFixed(2)}`);
    console.log(`   Purchases: ₹${this.plData.purchases.toFixed(2)}`);
    console.log(`   Sales: ₹${this.plData.sales.toFixed(2)}`);
    console.log(`   Gross Profit: ₹${this.plData.grossProfit.toFixed(2)}`);
    console.log(`   Net Profit: ₹${this.plData.netProfit.toFixed(2)}`);

    // ✅ ALERT if critical values are zero
    if (this.plData.sales === 0 && this.plData.purchases === 0) {
      console.warn('⚠️ WARNING: Both Sales and Purchases are ZERO. Check date range and data.');
    }

  } catch (error) {
    console.error('❌ Error loading P&L data:', error);
    alert('Failed to load Profit & Loss report. Check console for details.');
  } finally {
    this.isLoading = false;
  }
}





  private calculateTotals(): void {
    const totalDebitSide = this.plData.openingStock + this.plData.purchases + this.plData.directExpense;
    const totalCreditSide = this.plData.closingStock + this.plData.sales + this.plData.directIncome;

    this.plData.grossProfit = totalCreditSide - totalDebitSide;
    this.plData.tradingAccountTotal = Math.max(totalDebitSide, totalCreditSide);

    const grossProfitBroughtDown = this.plData.grossProfit > 0 ? this.plData.grossProfit : 0;
    const grossLossBroughtDown = this.plData.grossProfit < 0 ? Math.abs(this.plData.grossProfit) : 0;
    
    const totalIndirectExpenseSide = this.plData.indirectExpense + this.plData.operationalExpense + grossLossBroughtDown;
    const totalIndirectIncomeSide = this.plData.indirectIncome + grossProfitBroughtDown;

    this.plData.netProfit = totalIndirectIncomeSide - totalIndirectExpenseSide;
    this.plData.plAccountTotal = Math.max(totalIndirectExpenseSide, totalIndirectIncomeSide);
  }

  async getExpenseBreakdown(): Promise<{
    directExpenses: BreakdownItem[],
    indirectExpenses: BreakdownItem[],
    operationalExpenses: BreakdownItem[]
  }> {
    try {
      const [journalEntries, regularExpenses] = await Promise.all([
        this.journalService.getTransactionsByDateRange(this.startDate, this.endDate),
        this.expenseService.getExpensesByDateRange(this.startDate, this.endDate)
      ]);

      const directMap = new Map<string, number>();
      const indirectMap = new Map<string, number>();
      const operationalMap = new Map<string, number>();

      const addToMap = (map: Map<string, number>, name: string, amount: number) => {
        map.set(name, (map.get(name) || 0) + amount);
      };

      journalEntries.forEach(entry => {
        if (entry['accountType'] === 'expense_category') {
          const name = entry['accountName'] || entry['description'] || 'Journal Expense';
          const amount = Math.abs((entry['debit'] || 0) - (entry['credit'] || 0));
          if (amount !== 0) {
            if (entry['accountHead'] === 'Expense|Direct Expense') addToMap(directMap, name, amount);
            else if (entry['accountHead'] === 'Expense|Indirect Expense') addToMap(indirectMap, name, amount);
            else if (entry['accountHead'] === 'Expense|Operational Expense') addToMap(operationalMap, name, amount);
          }
        }
      });

      regularExpenses.forEach(expense => {
        const amount = expense.totalAmount || expense.paymentAmount || 0;
        if (amount > 0) {
          const name = expense.expenseCategoryName || expense.expenseFor || 'Expense Entry';
          if (expense.accountHead === 'Expense|Direct Expense' || expense.expenseType?.toLowerCase() === 'direct') addToMap(directMap, name, amount);
          else if (expense.accountHead === 'Expense|Indirect Expense' || expense.expenseType?.toLowerCase() === 'indirect') addToMap(indirectMap, name, amount);
          else if (expense.accountHead === 'Expense|Operational Expense') addToMap(operationalMap, name, amount);
        }
      });

      return {
        directExpenses: Array.from(directMap, ([name, amount]) => ({ name, amount })),
        indirectExpenses: Array.from(indirectMap, ([name, amount]) => ({ name, amount })),
        operationalExpenses: Array.from(operationalMap, ([name, amount]) => ({ name, amount }))
      };
    } catch (error) {
      console.error('Error getting expense breakdown:', error);
      return { directExpenses: [], indirectExpenses: [], operationalExpenses: [] };
    }
  }

  async getIncomeBreakdown(): Promise<{
    directIncome: BreakdownItem[],
    indirectIncome: BreakdownItem[]
  }> {
    try {
      const [journalEntries, regularIncomes] = await Promise.all([
        this.journalService.getTransactionsByDateRange(this.startDate, this.endDate),
        (this.expenseService as any).getIncomesByDateRange ? (this.expenseService as any).getIncomesByDateRange(this.startDate, this.endDate) : Promise.resolve([])
      ]);

      const directMap = new Map<string, number>();
      const indirectMap = new Map<string, number>();

      const addToMap = (map: Map<string, number>, name: string, amount: number) => {
        map.set(name, (map.get(name) || 0) + amount);
      };

      journalEntries.forEach(entry => {
        if (entry['accountType'] === 'income_category') {
          const name = entry['accountName'] || entry['description'] || 'Journal Income';
          const amount = Math.abs((entry['credit'] || 0) - (entry['debit'] || 0));
          if (amount !== 0) {
            if (entry['accountHead'] === 'Income|Direct Income') addToMap(directMap, name, amount);
            else if (entry['accountHead'] === 'Income|Indirect Income') addToMap(indirectMap, name, amount);
          }
        }
      });

      if (Array.isArray(regularIncomes)) {
        regularIncomes.forEach(income => {
          const amount = income.totalAmount || income.paymentAmount || 0;
          if (amount > 0) {
            const name = income.incomeCategoryName || income.incomeFor || 'Income Entry';
            if (income.accountHead === 'Income|Direct Income' || income.incomeType?.toLowerCase() === 'direct') addToMap(directMap, name, amount);
            else if (income.accountHead === 'Income|Indirect Income' || income.incomeType?.toLowerCase() === 'indirect') addToMap(indirectMap, name, amount);
          }
        });
      }

      return {
        directIncome: Array.from(directMap, ([name, amount]) => ({ name, amount })),
        indirectIncome: Array.from(indirectMap, ([name, amount]) => ({ name, amount }))
      };
    } catch (error) {
      console.error('Error getting income breakdown:', error);
      return { directIncome: [], indirectIncome: [] };
    }
  }
}