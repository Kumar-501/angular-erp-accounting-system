import { Component, OnInit } from '@angular/core';
import { SaleService } from '../services/sale.service';
import { ExpenseService } from '../services/expense.service';
import { PurchaseService } from '../services/purchase.service';
import { StockService } from '../services/stock.service';
import { DatePipe } from '@angular/common';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { collection, query, where, orderBy, getDocs } from '@angular/fire/firestore';
import { Firestore } from '@angular/fire/firestore';
import * as XLSX from 'xlsx';
import { Chart, registerables } from 'chart.js';
interface IndirectExpense {
  name: string;
  amount: number;
}
interface IndirectExpense {
  name: string;
  amount: number;
}
interface ProfitLossData {
  openingStock: number;
  purchases: number;
  purchaseReturns: number;
  directExpenses: number;
  closingStock: number;
  sales: number;
  salesReturns: number;
  directIncome: number;
  indirectExpenses: IndirectExpense[];
  indirectIncome: number;
}

interface Sale {
  id?: string;
  paymentAmount?: number;
  products?: Array<{
    unitPrice: number;
    quantity: number;
  }>;
  [key: string]: any;
}

interface Return {
  id?: string;
  totalRefund?: number;
  refundAmount?: number;
  [key: string]: any;
}

interface Purchase {
  id?: string;
  grandTotal?: number;
  purchaseTotal?: number;
  total?: number;
  totalAmount?: number;
  [key: string]: any;
}

@Component({
  selector: 'app-profit-loss',
  templateUrl: './profit-loss.component.html',
  styleUrls: ['./profit-loss.component.scss'],
  providers: [DatePipe]
})
export class ProfitLossComponent implements OnInit {
  profitLossData: ProfitLossData = {
    openingStock: 0,
    purchases: 0,
    purchaseReturns: 0,
    directExpenses: 0,
    closingStock: 0,
    sales: 0,
    
    salesReturns: 0,
    directIncome: 0,
    indirectExpenses: [],
    indirectIncome: 0
  };
  
  loading = false;
  dateRangeForm: FormGroup;
  // Add these properties to your component class
today = new Date();
expenseChart: any;

  currentDateRange = '';
  errorMessage = '';
  productService: any;

  constructor(
    private expenseService: ExpenseService,
    private saleService: SaleService,
    private purchaseService: PurchaseService,
    private stockService: StockService,
    private datePipe: DatePipe,
      private firestore: Firestore ,// Add this line

    private fb: FormBuilder
  ) {
    this.dateRangeForm = this.fb.group({
      startDate: [this.getDefaultStartDateString(), Validators.required],
      endDate: [this.getCurrentDateString(), Validators.required]
    });
  }

  ngOnInit(): void {
    this.loadData();
  }

  private getDefaultStartDateString(): string {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return this.formatDateForInput(date);
  }

  private getCurrentDateString(): string {
    return this.formatDateForInput(new Date());
  }

  private formatDateForInput(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private parseDate(dateString: string): Date {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid date: ${dateString}`);
    }
    return date;
  }


    getProfitLossData(): any {
    return {
      netProfit: this.netProfit,
      grossProfit: this.grossProfit,
      sales: this.netSales,
      directIncome: this.profitLossData.directIncome,
      indirectIncome: this.profitLossData.indirectIncome,
      directExpenses: this.profitLossData.directExpenses,
      indirectExpenses: this.totalIndirectExpenses,
      startDate: this.parseDate(this.dateRangeForm.value.startDate),
      endDate: this.parseDate(this.dateRangeForm.value.endDate)
    };
  }
exportToExcel(): void {
  const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet([
    { 'Category': 'Opening Stock', 'Amount': this.profitLossData.openingStock },
    { 'Category': 'Purchases', 'Amount': this.profitLossData.purchases },
    { 'Category': 'Direct Expenses', 'Amount': this.profitLossData.directExpenses },
    { 'Category': 'Closing Stock', 'Amount': this.profitLossData.closingStock },
    { 'Category': 'Sales', 'Amount': this.profitLossData.sales },
    { 'Category': 'Direct Income', 'Amount': this.profitLossData.directIncome },
    { 'Category': 'Gross Profit', 'Amount': this.grossProfit },
    { 'Category': 'Net Profit', 'Amount': this.netProfit }
  ]);
  
  const wb: XLSX.WorkBook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'ProfitLoss');
  XLSX.writeFile(wb, `ProfitLoss_${this.today.toISOString().slice(0,10)}.xlsx`);
}

printReport(): void {
  window.print();
}

private initExpenseChart(): void {
  if (this.expenseChart) {
    this.expenseChart.destroy();
  }

  const ctx = this.expenseChart?.nativeElement?.getContext('2d');
  if (!ctx) return;

  const labels = this.profitLossData.indirectExpenses.map(e => e.name);
  const data = this.profitLossData.indirectExpenses.map(e => e.amount);

  this.expenseChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: [
          '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', 
          '#9966FF', '#FF9F40', '#8AC24A', '#607D8B'
        ]
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'right'
        }
      }
    }
  });
}
  async loadData(): Promise<void> {
    if (!this.dateRangeForm.valid) {
      this.errorMessage = 'Please select valid start and end dates';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    try {
      const { startDate, endDate } = this.validateAndParseDates();
      this.currentDateRange = this.createDateRangeString(startDate, endDate);

      this.resetProfitLossData();

      await Promise.all([
        this.loadStockData(startDate, endDate),
        this.loadTransactionData(startDate, endDate),
        this.loadExpenseData(startDate, endDate)
      ]);

      console.log('Final Profit & Loss Data:', this.profitLossData);
    } catch (error) {
      console.error('Error loading profit & loss data:', error);
      this.errorMessage = this.getErrorMessage(error);
    } finally {
      this.loading = false;
    }
  }

  private validateAndParseDates(): { startDate: Date; endDate: Date } {
    const startDate = this.parseDate(this.dateRangeForm.value.startDate);
    const endDate = this.parseDate(this.dateRangeForm.value.endDate);

    if (startDate > endDate) {
      throw new Error('Start date cannot be after end date');
    }

    return { startDate, endDate };
  }

  private createDateRangeString(startDate: Date, endDate: Date): string {
    return `${this.datePipe.transform(startDate, 'mediumDate')} - ${this.datePipe.transform(endDate, 'mediumDate')}`;
  }

  private resetProfitLossData(): void {
    this.profitLossData = {
      openingStock: 0,
      purchases: 0,
      purchaseReturns: 0,
      directExpenses: 0,
      closingStock: 0,
      sales: 0,
      salesReturns: 0,
      directIncome: 0,
      indirectExpenses: [],
      indirectIncome: 0
    };
  }

// In your profit-loss.component.ts

private async loadStockData(startDate: Date, endDate: Date): Promise<void> {
  try {
    console.log('Loading stock data...');
    
    // Get opening stock (end of day before start date)
    const openingDate = new Date(startDate);
    openingDate.setDate(openingDate.getDate() - 1);
    
    // Get closing stock (end of end date)
    const closingDate = new Date(endDate);
    
    // Try multiple approaches if needed
    const [openingStock, closingStock] = await Promise.all([
      this.getStockWithFallback(openingDate, 'opening'),
      this.getStockWithFallback(closingDate, 'closing')
    ]);

    this.profitLossData.openingStock = openingStock;
    this.profitLossData.closingStock = closingStock;

    console.log('Stock values:', {
      opening: this.profitLossData.openingStock,
      closing: this.profitLossData.closingStock
    });
  } catch (error) {
    console.error('Error loading stock data:', error);
    // Set conservative defaults that won't distort P&L
    this.profitLossData.openingStock = 0;
    this.profitLossData.closingStock = 0;
  }
}

private async getStockWithFallback(date: Date, type: 'opening'|'closing'): Promise<number> {
  try {
    // First try - use dedicated stock service method
    if (type === 'opening') {
      return await this.stockService.getOpeningStockValue(date);
    } else {
      return await this.stockService.getClosingStockValue(date);
    }
  } catch (error) {
    console.warn(`Primary ${type} stock method failed, trying fallback`, error);
    
    try {
      // Fallback - calculate from current product stock
      const products = await this.productService.fetchAllProducts();
      return products.reduce((total: number, product: { defaultPurchasePriceExcTax: number; currentStock: any; }) => {
        const costPrice = product.defaultPurchasePriceExcTax || 0;
        return total + ((product.currentStock || 0) * costPrice);
      }, 0);
    } catch (fallbackError) {
      console.error(`All ${type} stock methods failed`, fallbackError);
      return 0; // Final fallback
    }
  }
}

  private async loadTransactionData(startDate: Date, endDate: Date): Promise<void> {
    try {
      console.log('Loading transaction data...');
      
      const adjustedStartDate = new Date(startDate);
      adjustedStartDate.setHours(0, 0, 0, 0);
      
      const adjustedEndDate = new Date(endDate);
      adjustedEndDate.setHours(23, 59, 59, 999);

      const [purchases, sales] = await Promise.all([
        this.getPurchases(adjustedStartDate, adjustedEndDate),
        this.getSales(adjustedStartDate, adjustedEndDate)
      ]);
      
      this.profitLossData.purchases = purchases;
      this.profitLossData.sales = sales;

      console.log('Transaction data loaded:', {
        purchases: this.profitLossData.purchases,
        sales: this.profitLossData.sales
      });

      const [purchaseReturns, salesReturns] = await Promise.all([
        this.getPurchaseReturns(adjustedStartDate, adjustedEndDate),
        this.getSalesReturns(adjustedStartDate, adjustedEndDate)
      ]);
      
      this.profitLossData.purchaseReturns = purchaseReturns;
      this.profitLossData.salesReturns = salesReturns;

      console.log('Returns data loaded:', {
        purchaseReturns: this.profitLossData.purchaseReturns,
        salesReturns: this.profitLossData.salesReturns
      });
    } catch (error) {
      console.error('Error loading transaction data:', error);
      throw error;
    }
  }

private async getSales(startDate: Date, endDate: Date): Promise<number> {
  try {
    console.log('Fetching sales data from:', startDate, 'to:', endDate);
    
    // First try with just date range
    let sales = await this.getSalesByDateOnly(startDate, endDate);
    
    // If no results, try alternative approach
    if (sales.length === 0) {
      sales = await this.getSalesAlternativeApproach(startDate, endDate);
    }

    console.log('Raw sales data received:', sales);
    
    if (!sales || sales.length === 0) {
      console.log('No sales found for the date range');
      return 0;
    }

    const totalSales = sales.reduce((total: number, sale: Sale) => {
      // Calculate from products if available (more accurate)
      if (sale['products'] && sale['products'].length > 0) {
        return total + sale['products'].reduce((sum: number, product: any) => {
          const quantity = product['quantity'] || 1;
          const unitPrice = product['unitPrice'] || product['price'] || 0;
          const discount = product['discount'] || 0;
          return sum + ((unitPrice * quantity) - discount);
        }, 0);
      }
      
      // Fallback to paymentAmount if products not available
      let saleAmount = sale['paymentAmount'] || sale['total'] || 0;
      
      // If saleAmount is 0 but we have products (edge case)
      if (saleAmount === 0 && sale['products']) {
        saleAmount = sale['products'].reduce((sum: number, product: any) => {
          return sum + ((product['unitPrice'] || 0) * (product['quantity'] || 0));
        }, 0);
      }
      
      return total + saleAmount;
    }, 0);

    console.log('Total sales calculated:', totalSales);
    return totalSales;
  } catch (error) {
    console.error('Error getting sales:', error);
    return 0;
  }
}

private async getSalesByDateOnly(startDate: Date, endDate: Date): Promise<Sale[]> {
  const salesCollection = collection(this.firestore, 'sales');
  const q = query(
    salesCollection,
    where('saleDate', '>=', startDate),
    where('saleDate', '<=', endDate),
    where('status', '==', 'Completed'), // Only include completed sales
    orderBy('saleDate', 'desc')
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => {
    const data = doc.data();
    const saleDate = data['saleDate']?.toDate?.() || new Date(data['saleDate']);
    return {
      id: doc.id,
      ...data,
      saleDate: saleDate,
      products: data['products'] || []
    } as Sale;
  });
}

private async getSalesAlternativeApproach(startDate: Date, endDate: Date): Promise<Sale[]> {
  const salesCollection = collection(this.firestore, 'sales');
  const q = query(
    salesCollection,
    where('status', '==', 'Completed')
  );
  
  const querySnapshot = await getDocs(q);
  const allSales = querySnapshot.docs.map(doc => {
    const data = doc.data();
    const saleDate = data['saleDate']?.toDate?.() || new Date(data['saleDate']);
    return {
      id: doc.id,
      ...data,
      saleDate: saleDate,
      products: data['products'] || []
    } as Sale;
  });

  return allSales.filter(sale => {
    const saleDateValue = sale['saleDate'] instanceof Date ? sale['saleDate'] : new Date(sale['saleDate']);
    return saleDateValue >= startDate && saleDateValue <= endDate;
  });
}







private async getSalesReturns(startDate: Date, endDate: Date): Promise<number> {
  try {
    console.log('Fetching sales returns...');
    
    const returns = await this.saleService.getReturnsByDateRange(startDate, endDate);
    
    if (!returns || returns.length === 0) {
      console.log('No sales returns found');
      return 0;
    }

    const totalReturns = returns.reduce((total: number, returnItem: Return) => {
      // Calculate from products if available
      if (returnItem['products'] && returnItem['products'].length > 0) {
        return total + returnItem['products'].reduce((sum: number, product: any) => {
          const quantity = product['quantity'] || 1;
          const unitPrice = product['unitPrice'] || product['price'] || 0;
          return sum + (unitPrice * quantity);
        }, 0);
      }
      
      // Fallback to refundAmount or totalRefund
      const refundAmount = returnItem['totalRefund'] || returnItem['refundAmount'] || 0;
      console.log('Return refund amount:', refundAmount);
      return total + refundAmount;
    }, 0);

    console.log('Total sales returns:', totalReturns);
    return totalReturns;
  } catch (error) {
    console.error('Error getting sales returns:', error);
    return 0;
  }
}

private async getPurchases(startDate: Date, endDate: Date): Promise<number> {
  try {
    console.log('Fetching purchases...');
    
    const purchases = await this.purchaseService.getPurchasesByDateRange(startDate, endDate);
    
    if (!purchases || purchases.length === 0) {
      console.log('No purchases found');
      return 0;
    }

    const totalPurchases = purchases.reduce((total: number, purchase: Purchase) => {
      // Use grandTotal if available, otherwise fall back to purchaseTotal
      const amount = purchase.grandTotal || purchase.purchaseTotal || 0;
      console.log('Purchase amount:', amount, 'Reference:', purchase['referenceNo']);
      return total + amount;
    }, 0);

    console.log('Total purchases:', totalPurchases);
    return totalPurchases;
  } catch (error) {
    console.error('Error getting purchases:', error);
    return 0;
  }
}

  private async getPurchaseReturns(startDate: Date, endDate: Date): Promise<number> {
    try {
      console.log('Fetching purchase returns...');
      
      if ((this.purchaseService as any).getPurchaseReturnsByDateRange) {
        const returns = await (this.purchaseService as any).getPurchaseReturnsByDateRange(startDate, endDate);
        const totalReturns = returns.reduce((total: number, returnItem: Purchase) => 
          total + (returnItem.grandTotal || returnItem['totalAmount'] || 0), 0);
        
        console.log('Total purchase returns:', totalReturns);
        return totalReturns;
      }
      
      console.log('No purchase returns method available');
      return 0;
    } catch (error) {
      console.error('Error getting purchase returns:', error);
      return 0;
    }
  }

private async loadExpenseData(startDate: Date, endDate: Date): Promise<void> {
  try {
    console.log('Loading expense data...');
    
    const adjustedStartDate = new Date(startDate);
    adjustedStartDate.setHours(0, 0, 0, 0);
    
    const adjustedEndDate = new Date(endDate);
    adjustedEndDate.setHours(23, 59, 59, 999);

    // Get all expenses and incomes first
    const [expenses, incomes] = await Promise.all([
      this.expenseService.getExpensesByDateRange(adjustedStartDate, adjustedEndDate),
      this.expenseService.getIncomesByDateRange(adjustedStartDate, adjustedEndDate)
    ]);

    // Categorize expenses
    const directExpenses = this.filterAndSumByType(expenses, 'expense', 'Direct');
    const indirectExpenses = this.categorizeIndirectExpenses(expenses);
    const directIncome = this.filterAndSumByType(incomes, 'income', 'Direct');
    const indirectIncome = this.filterAndSumByType(incomes, 'income', 'Indirect');

    this.profitLossData.directExpenses = directExpenses;
    this.profitLossData.indirectExpenses = indirectExpenses;
    this.profitLossData.directIncome = directIncome;
    this.profitLossData.indirectIncome = indirectIncome;

    console.log('Expense data loaded:', {
      directExpenses: this.profitLossData.directExpenses,
      indirectExpenses: this.profitLossData.indirectExpenses,
      directIncome: this.profitLossData.directIncome,
      indirectIncome: this.profitLossData.indirectIncome
    });

    // Initialize chart after data is loaded
    this.initExpenseChart();
  } catch (error) {
    console.error('Error loading expense data:', error);
    throw error;
  }
}
private filterAndSumByType(items: any[], entryType: 'expense' | 'income', expenseType: string): number {
  return items
    .filter(item => 
      item.entryType === entryType && 
      (item.expenseType === expenseType || item.incomeType === expenseType || item.type === expenseType)
    )
    .reduce((sum, item) => {
      const amount = item.totalAmount || item.amount || item.total || 0;
      return sum + (typeof amount === 'number' ? amount : 0);
    }, 0);
}

private categorizeIndirectExpenses(expenses: any[]): IndirectExpense[] {
  const expenseMap = expenses
    .filter(expense => 
      expense.entryType === 'expense' && 
      !(expense.expenseType === 'Direct' || expense.type === 'Direct')
    )
    .reduce((acc: Record<string, number>, expense) => {
      const category = expense.categoryName || expense.expenseCategory || expense.incomeCategory || 'Other';
      const amount = expense.totalAmount || expense.amount || expense.total || 0;
      
      acc[category] = (acc[category] || 0) + (typeof amount === 'number' ? amount : 0);
      return acc;
    }, {});

  return Object.entries(expenseMap)
    .map(([name, amount]) => ({ name, amount }))
    .filter(item => item.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}




  private async getDirectIncome(startDate: Date, endDate: Date): Promise<number> {
    try {
      if ((this.expenseService as any).getIncomesByDateRange) {
        const incomes = await (this.expenseService as any).getIncomesByDateRange(startDate, endDate);
        if (!Array.isArray(incomes)) return 0;
        
        return incomes
          .filter(income => income.incomeType === 'Direct' || income.type === 'Direct')
          .reduce((sum, income) => {
            const amount = income.totalAmount || income.amount || income.total || 0;
            return sum + (typeof amount === 'number' ? amount : 0);
          }, 0);
      }
      return 0;
    } catch (error) {
      console.error('Error getting direct income:', error);
      return 0;
    }
  }

  private async getIndirectIncome(startDate: Date, endDate: Date): Promise<number> {
    try {
      if ((this.expenseService as any).getIncomesByDateRange) {
        const incomes = await (this.expenseService as any).getIncomesByDateRange(startDate, endDate);
        if (!Array.isArray(incomes)) return 0;
        
        return incomes
          .filter(income => !(income.incomeType === 'Direct' || income.type === 'Direct'))
          .reduce((sum, income) => {
            const amount = income.totalAmount || income.amount || income.total || 0;
            return sum + (typeof amount === 'number' ? amount : 0);
          }, 0);
      }
      return 0;
    } catch (error) {
      console.error('Error getting indirect income:', error);
      return 0;
    }
  }
private async getDirectExpenses(startDate: Date, endDate: Date): Promise<number> {
  try {
    const expenses = await this.expenseService.getExpensesByDateRange(startDate, endDate);
    if (!Array.isArray(expenses)) return 0;
    
    return expenses
      .filter(expense => {
        // Check if it's an expense and has Direct type
        return expense.entryType === 'expense' && 
               (expense.expenseType === 'Direct' || 
                (expense as any).type === 'Direct'); // Temporary any until interface is fixed
      })
      .reduce((sum, expense) => {
        const amount = expense.totalAmount || 0;
        return sum + amount;
      }, 0);
  } catch (error) {
    console.error('Error getting direct expenses:', error);
    return 0;
  }
}

private async getIndirectExpenses(startDate: Date, endDate: Date): Promise<IndirectExpense[]> {
  try {
    const expenses = await this.expenseService.getExpensesByDateRange(startDate, endDate);
    if (!Array.isArray(expenses)) return [];

    const expenseMap = expenses
      .filter(expense => {
        // Check if it's an expense and not Direct type
        return expense.entryType === 'expense' && 
               !(expense.expenseType === 'Direct' || 
                (expense as any).type === 'Direct'); // Temporary any until interface is fixed
      })
      .reduce((acc: Record<string, number>, expense) => {
        // Safely get category from various possible properties
        const category = (expense as any).categoryName || 
                        expense.expenseCategoryName || 
                        expense.expenseCategory || 
                        'Other';
        
        const amount = expense.totalAmount || 0;
        
        acc[category] = (acc[category] || 0) + amount;
        return acc;
      }, {});

    return Object.entries(expenseMap)
      .map(([name, amount]) => ({ name, amount }))
      .filter(item => item.amount > 0);
  } catch (error) {
    console.error('Error getting indirect expenses:', error);
    return [];
  }
}


  get grossProfit(): number {
    const { 
      sales, 
      salesReturns,
      directIncome, 
      openingStock, 
      purchases,
      purchaseReturns,
      directExpenses, 
      closingStock 
    } = this.profitLossData;
    
    const netPurchases = purchases - purchaseReturns;
    const netSales = sales - salesReturns;
    const cogs = openingStock + netPurchases + directExpenses - closingStock;
    
    return (netSales + directIncome) - cogs;
  }

  get totalIndirectExpenses(): number {
    return this.profitLossData.indirectExpenses.reduce((sum, item) => sum + item.amount, 0);
  }

  get netProfit(): number {
    return this.grossProfit + this.profitLossData.indirectIncome - this.totalIndirectExpenses;
  }

  get netSales(): number {
    return this.profitLossData.sales - this.profitLossData.salesReturns;
  }

  get netPurchases(): number {
    return this.profitLossData.purchases - this.profitLossData.purchaseReturns;
  }

  get costOfGoodsSold(): number {
    return this.profitLossData.openingStock + this.netPurchases + this.profitLossData.directExpenses - this.profitLossData.closingStock;
  }

  get totalDirectIncome(): number {
    return this.netSales + this.profitLossData.directIncome;
  }

  onSubmit(): void {
    this.loadData();
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return 'An unknown error occurred while loading the report';
  }
}