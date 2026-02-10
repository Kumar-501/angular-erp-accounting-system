import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { SaleService } from '../services/sale.service';
import { ExpenseService } from '../services/expense.service';
import { PurchaseService } from '../services/purchase.service';
import { StockService } from '../services/stock.service';
import { DailyStockService } from '../services/daily-stock.service';
import { ProfitLossService } from '../services/profit-loss.service';
import { DatePipe } from '@angular/common';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { collection, query, where, orderBy, getDocs, onSnapshot, doc } from '@angular/fire/firestore';
import { Firestore } from '@angular/fire/firestore';
import * as XLSX from 'xlsx';
import { Chart, registerables } from 'chart.js';
import { Subscription } from 'rxjs';

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

@Component({
  selector: 'app-profit-loss',
  templateUrl: './profit-loss.component.html',
  styleUrls: ['./profit-loss.component.scss'],
  providers: [DatePipe]
})
export class ProfitLossComponent implements OnInit, OnDestroy {
  @ViewChild('expenseChart', { static: false }) expenseChart!: ElementRef<HTMLCanvasElement>;

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
  today = new Date();
  chartInstance: Chart<'pie'> | null = null;
  currentDateRange = '';
  errorMessage = '';
  
  // Real-time listeners
  private unsubscribeStockReport: (() => void) | null = null;
  private unsubscribeSales: (() => void) | null = null;
  private unsubscribePurchases: (() => void) | null = null;
  private subscriptions: Subscription[] = [];

  constructor(
    private expenseService: ExpenseService,
    private saleService: SaleService,
    private purchaseService: PurchaseService,
    private stockService: StockService,
    private dailyStockService: DailyStockService,
    private profitLossService: ProfitLossService, // Add ProfitLossService
    private datePipe: DatePipe,
    private firestore: Firestore,
    private fb: FormBuilder
  ) {
    Chart.register(...registerables);
    this.dateRangeForm = this.fb.group({
      startDate: [this.getDefaultStartDateString(), Validators.required],
      endDate: [this.getCurrentDateString(), Validators.required]
    });
  }

  ngOnInit(): void {
    this.setupRealtimeListeners();
    this.loadDataOptimized(); // Use optimized loading
  }

  ngOnDestroy(): void {
    this.cleanupSubscriptions();
    if (this.chartInstance) {
      this.chartInstance.destroy();
    }
    if (this.unsubscribeStockReport) {
      this.unsubscribeStockReport();
    }
    if (this.unsubscribeSales) {
      this.unsubscribeSales();
    }
    if (this.unsubscribePurchases) {
      this.unsubscribePurchases();
    }
  }

  private setupRealtimeListeners(): void {
    const stockUpdateSub = this.stockService.stockUpdated$.subscribe(() => {
      console.log('Stock update detected in P&L - refreshing data');
      this.refreshStockDataOptimized();
    });

    const salesUpdateSub = this.saleService.salesUpdated$.subscribe(() => {
      console.log('Sales update detected in P&L - refreshing data');
      this.refreshStockDataOptimized();
    });

    if (this.saleService.stockUpdated$) {
      const salesStockSub = this.saleService.stockUpdated$.subscribe(() => {
        console.log('Sales stock update detected in P&L - refreshing data');
        this.refreshStockDataOptimized();
      });
      this.subscriptions.push(salesStockSub);
    }

    this.subscriptions.push(stockUpdateSub, salesUpdateSub);
    this.setupFirestoreListeners();
  }

  private setupFirestoreListeners(): void {
    // Only setup listeners if form is valid
    if (!this.dateRangeForm.valid) return;

    const { startDate, endDate } = this.validateAndParseDates();

    // Simplified listeners to reduce overhead
    const salesCollection = collection(this.firestore, 'sales');
    const salesQuery = query(
      salesCollection,
      where('saleDate', '>=', startDate),
      where('saleDate', '<=', endDate)
    );

    this.unsubscribeSales = onSnapshot(salesQuery, (snapshot) => {
      console.log('Real-time sales update detected:', snapshot.size, 'sales');
      this.handleOptimizedSalesUpdate(snapshot);
    }, (error) => {
      console.error('Error in sales listener:', error);
    });

    const purchasesCollection = collection(this.firestore, 'purchases');
    const purchasesQuery = query(
      purchasesCollection,
      where('purchaseDate', '>=', startDate),
      where('purchaseDate', '<=', endDate)
    );

    this.unsubscribePurchases = onSnapshot(purchasesQuery, (snapshot) => {
      console.log('Real-time purchases update detected:', snapshot.size, 'purchases');
      this.handleOptimizedPurchasesUpdate(snapshot);
    }, (error) => {
      console.error('Error in purchases listener:', error);
    });
  }

  /**
   * OPTIMIZED: Handle sales updates with better performance
   */
  private handleOptimizedSalesUpdate(snapshot: any): void {
    let totalSalesWithoutTax = 0;
    let validSalesCount = 0;
    
    snapshot.docs.forEach((doc: any) => {
      const saleData = doc.data();
      
      if (saleData['status'] !== 'Completed') {
        return;
      }
      
      validSalesCount++;
      const saleAmountWithoutTax = this.calculateSaleAmountWithoutTax(saleData, doc.id);
      totalSalesWithoutTax += Math.max(0, saleAmountWithoutTax || 0);
    });

    console.log(`Optimized sales update: ${validSalesCount} valid sales, Total (without tax) = ${totalSalesWithoutTax}`);
    this.profitLossData.sales = totalSalesWithoutTax;
    this.calculateTotals();
  }

  /**
   * OPTIMIZED: Handle purchases updates with better performance
   */
  private handleOptimizedPurchasesUpdate(snapshot: any): void {
    let totalPurchases = 0;
    
    snapshot.docs.forEach((doc: any) => {
      const purchaseData = doc.data();
      const purchaseAmount = this.calculatePurchaseAmountWithoutTax(purchaseData, doc.id);
      totalPurchases += Math.max(0, purchaseAmount || 0);
    });

    console.log(`Optimized purchases update: Total (excluding tax) = ${totalPurchases}`);
    this.profitLossData.purchases = totalPurchases;
    this.calculateTotals();
  }

  private calculateSaleAmountWithoutTax(saleData: any, docId: string): number {
    let saleAmountWithoutTax = 0;

    // Priority 1: Calculate from products WITHOUT tax
    if (saleData['products']?.length) {
      saleAmountWithoutTax = saleData['products'].reduce((sum: number, product: any) => {
        const quantity = product['quantity'] || 1;
        
        if (product['priceBeforeTax'] && product['priceBeforeTax'] > 0) {
          return sum + (product['priceBeforeTax'] * quantity);
        }
        
        if (product['subtotal'] && product['subtotal'] > 0) {
          const productSubtotal = product['subtotal'];
          const productTax = product['taxAmount'] || 0;
          return sum + Math.max(0, productSubtotal - productTax);
        }
        
        if (product['lineTotal'] && product['lineTotal'] > 0) {
          const lineTotal = product['lineTotal'];
          const productTax = product['taxAmount'] || 0;
          return sum + Math.max(0, lineTotal - productTax);
        }
        
        const unitPrice = product['unitPrice'] || product['sellingPrice'] || product['price'] || 0;
        return sum + (unitPrice * quantity);
      }, 0);
      
      return saleAmountWithoutTax;
    }
    
    // Priority 2: Use subtotal (usually before tax)
    if (saleData['subtotal'] && saleData['subtotal'] > 0) {
      return saleData['subtotal'];
    }
    
    // Priority 3: Use total and subtract tax
    if (saleData['total'] && saleData['total'] > 0) {
      saleAmountWithoutTax = saleData['total'];
      const totalTax = saleData['taxAmount'] || saleData['totalTax'] || 0;
      if (totalTax > 0) {
        saleAmountWithoutTax = Math.max(0, saleAmountWithoutTax - totalTax);
      }
      return saleAmountWithoutTax;
    }
    
    // Priority 4: Use totalPayable and subtract tax
    if (saleData['totalPayable'] && saleData['totalPayable'] > 0) {
      saleAmountWithoutTax = saleData['totalPayable'];
      const totalTax = saleData['taxAmount'] || saleData['totalTax'] || 0;
      if (totalTax > 0) {
        saleAmountWithoutTax = Math.max(0, saleAmountWithoutTax - totalTax);
      }
      return saleAmountWithoutTax;
    }
    
    // Priority 5: Use grandTotal and subtract tax
    if (saleData['grandTotal'] && saleData['grandTotal'] > 0) {
      saleAmountWithoutTax = saleData['grandTotal'];
      const totalTax = saleData['taxAmount'] || saleData['totalTax'] || 0;
      if (totalTax > 0) {
        saleAmountWithoutTax = Math.max(0, saleAmountWithoutTax - totalTax);
      }
      return saleAmountWithoutTax;
    }
    
    if (saleData['paymentAmount'] && saleData['paymentAmount'] > 0) {
      return saleData['paymentAmount'];
    }

    return 0;
  }

  private calculatePurchaseAmountWithoutTax(purchaseData: any, docId: string): number {
    let purchaseAmount = 0;

    if (purchaseData['products']?.length) {
      purchaseAmount = purchaseData['products'].reduce((sum: number, product: any) => {
        const quantity = product['quantity'] || 1;
        const unitCost = product['unitCost'] || product['price'] || product['costPrice'] || 0;
        return sum + (unitCost * quantity);
      }, 0);
      
      const shippingCharges = purchaseData['shippingCharges'] || 0;
      purchaseAmount += shippingCharges;
    } else if (purchaseData['purchaseTotal'] && purchaseData['purchaseTotal'] > 0) {
      purchaseAmount = purchaseData['purchaseTotal'];
    } else if (purchaseData['grandTotal'] && purchaseData['grandTotal'] > 0) {
      purchaseAmount = purchaseData['grandTotal'];
      const totalTax = purchaseData['totalTax'] || purchaseData['taxAmount'] || 0;
      purchaseAmount = Math.max(0, purchaseAmount - totalTax);
    }

    return purchaseAmount;
  }

  private async refreshStockDataOptimized(): Promise<void> {
    try {
      if (!this.dateRangeForm.valid) return;

      const { startDate, endDate } = this.validateAndParseDates();
      
      // Use ProfitLossService for optimized stock calculation
      const report = await this.profitLossService.getProfitLossReport(startDate, endDate, true);
      
      console.log('Optimized stock values updated:', {
        opening: report.openingStock,
        closing: report.closingStock
      });

      this.profitLossData.openingStock = report.openingStock;
      this.profitLossData.closingStock = report.closingStock;
      
      this.calculateTotals();
      this.initExpenseChart();
    } catch (error) {
      console.error('Error refreshing optimized stock data:', error);
    }
  }

  private cleanupSubscriptions(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];
  }

  private getDefaultStartDateString(): string {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return this.formatDateForInput(date);
  }

  private getCurrentDateString(): string {
    return this.formatDateForInput(new Date());
  }

  private formatDateForInput(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private parseDate(dateString: string): Date {
    const date = new Date(dateString + 'T00:00:00.000Z');
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid date: ${dateString}`);
    }
    return date;
  }

  get netProfit(): number {
    return this.grossProfit + this.profitLossData.indirectIncome - this.totalIndirectExpenses;
  }

  get grossProfit(): number {
    const netPurchases = this.profitLossData.purchases - this.profitLossData.purchaseReturns;
    const netSales = this.profitLossData.sales - this.profitLossData.salesReturns;
    const cogs = this.profitLossData.openingStock + netPurchases + 
                 this.profitLossData.directExpenses - this.profitLossData.closingStock;
    
    return (netSales + this.profitLossData.directIncome) - cogs;
  }

  get totalIndirectExpenses(): number {
    return this.profitLossData.indirectExpenses.reduce((sum, item) => sum + item.amount, 0);
  }

  get netSales(): number {
    return this.profitLossData.sales - this.profitLossData.salesReturns;
  }

  get netPurchases(): number {
    return this.profitLossData.purchases - this.profitLossData.purchaseReturns;
  }

  get costOfGoodsSold(): number {
    return this.profitLossData.openingStock + this.netPurchases + 
           this.profitLossData.directExpenses - this.profitLossData.closingStock;
  }

  get totalDirectIncome(): number {
    return this.netSales + this.profitLossData.directIncome;
  }

  /**
   * OPTIMIZED: Load data using ProfitLossService for better performance
   */
// In profit-loss.component.ts

async loadDataOptimized(): Promise<void> {
  if (!this.dateRangeForm.valid) {
    this.errorMessage = 'Please select valid start and end dates';
    return;
  }

  this.loading = true;
  this.errorMessage = '';

  try {
    const { startDate, endDate } = this.validateAndParseDates();
    this.currentDateRange = this.createDateRangeString(startDate, endDate);

    console.log('Loading optimized P&L data for date range:', { startDate, endDate });

    // Use ProfitLossService for optimized data loading
    const report = await this.profitLossService.getProfitLossReport(startDate, endDate, true);

    // Map report data to component format
    this.profitLossData = {
      openingStock: report.openingStock,
      purchases: report.purchases,
      purchaseReturns: 0, // Will be updated if available
      directExpenses: report.directExpenses || 0,
      closingStock: report.closingStock,
      sales: report.sales,
      salesReturns: 0, // Will be updated if available
      directIncome: report.directIncome || 0,
      indirectExpenses: this.formatIndirectExpenses(report.indirectExpenses || 0),
      indirectIncome: 0 // Will be updated if available
    };

    console.log('Optimized P&L data loaded:', {
      sales: this.profitLossData.sales,
      purchases: this.profitLossData.purchases,
      openingStock: this.profitLossData.openingStock,
      closingStock: this.profitLossData.closingStock
    });

    this.initExpenseChart();
  } catch (error) {
    console.error('Error loading optimized P&L data:', error);
    this.errorMessage = this.getErrorMessage(error);
    
    // Fallback to legacy loading method
    console.log('Falling back to legacy loading method...');
    await this.loadDataLegacy();
  } finally {
    this.loading = false;
  }
}
  /**
   * LEGACY: Fallback loading method (original implementation)
   */
  async loadDataLegacy(): Promise<void> {
    try {
      const { startDate, endDate } = this.validateAndParseDates();
      
      this.resetProfitLossData();

      await Promise.all([
        this.loadStockData(startDate, endDate),
        this.loadTransactionData(startDate, endDate),
        this.loadExpenseData(startDate, endDate)
      ]);

      console.log('Legacy P&L data loaded:', this.profitLossData);
      this.initExpenseChart();
    } catch (error) {
      console.error('Error in legacy loading method:', error);
      throw error;
    }
  }

  private formatIndirectExpenses(totalIndirectExpenses: number): IndirectExpense[] {
    if (totalIndirectExpenses > 0) {
      return [{ name: 'Other', amount: totalIndirectExpenses }];
    }
    return [];
  }

  private calculateTotals(): void {
    this.profitLossData = {...this.profitLossData};
  }

  private validateAndParseDates(): { startDate: Date; endDate: Date } {
    const startDate = this.parseDate(this.dateRangeForm.value.startDate);
    const endDate = this.parseDate(this.dateRangeForm.value.endDate);

    if (startDate > endDate) {
      throw new Error('Start date cannot be after end date');
    }

    const adjustedEndDate = new Date(endDate);
    adjustedEndDate.setHours(23, 59, 59, 999);

    return { startDate, endDate: adjustedEndDate };
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

  private async loadStockData(startDate: Date, endDate: Date): Promise<void> {
    try {
      console.log('Loading stock data with real-time updates...');
      
      await this.dailyStockService.initializeDailySnapshotsIfNeeded(startDate);
      await this.dailyStockService.initializeDailySnapshotsIfNeeded(endDate);

      const [openingStock, closingStock] = await Promise.all([
        this.dailyStockService.getStockValueForDate(startDate, 'opening'),
        this.dailyStockService.getStockValueForDate(endDate, 'closing')
      ]);

      this.profitLossData.openingStock = openingStock;
      this.profitLossData.closingStock = closingStock;
      
      console.log('Stock data loaded:', { openingStock, closingStock });
    } catch (error) {
      console.error('Error loading stock data:', error);
      this.profitLossData.openingStock = 0;
      this.profitLossData.closingStock = 0;
    }
  }

  private async loadTransactionData(startDate: Date, endDate: Date): Promise<void> {
    try {
      console.log('Loading transaction data for:', { startDate, endDate });

      const [purchases, sales] = await Promise.all([
        this.getPurchasesLegacy(startDate, endDate),
        this.getSalesWithoutTaxLegacy(startDate, endDate)
      ]);

      this.profitLossData.purchases = purchases;
      this.profitLossData.sales = sales;

      console.log('Transaction data loaded (sales without tax):', { purchases, sales });

      const [purchaseReturns, salesReturns] = await Promise.all([
        this.getPurchaseReturns(startDate, endDate),
        this.getSalesReturnsWithoutTax(startDate, endDate)
      ]);

      this.profitLossData.purchaseReturns = purchaseReturns;
      this.profitLossData.salesReturns = salesReturns;

      console.log('Returns data loaded (without tax):', { purchaseReturns, salesReturns });
    } catch (error) {
      console.error('Error loading transaction data:', error);
      throw error;
    }
  }

private async getSalesWithoutTaxLegacy(startDate: Date, endDate: Date): Promise<number> {
    try {
      // --- DEBUG ---
      console.log('Fetching legacy sales between:', startDate.toISOString(), 'and', endDate.toISOString());

      const salesCollection = collection(this.firestore, 'sales');
      
      const q = query(
        salesCollection,
        where('saleDate', '>=', startDate),
        where('saleDate', '<=', endDate)
      );
      
      const querySnapshot = await getDocs(q);
      
      // --- DEBUG ---
      console.log(`Firestore returned ${querySnapshot.size} documents for the selected date range.`);

      let totalSalesWithoutTax = 0;
      let validSales = 0;

      querySnapshot.docs.forEach(doc => {
        const saleData = doc.data();

        if (saleData['status'] !== 'Completed') {
          // --- DEBUG ---
          console.log(`Skipping sale ${doc.id} due to status: ${saleData['status']}`);
          return;
        }

        validSales++;
        // --- DEBUG ---
        console.log(`Processing completed sale ${doc.id}:`, saleData);
        
        if (saleData['products'] && saleData['products'].length > 0) {
          const saleSubtotal = saleData['products'].reduce((sum: number, product: any) => {
            const priceBeforeTax = product['priceBeforeTax'] || 0;
            const quantity = product['quantity'] || 1;
            
            // --- DEBUG ---
            console.log(`  - Product: ${product.name}, priceBeforeTax: ${priceBeforeTax}, quantity: ${quantity}`);

            return sum + (priceBeforeTax * quantity);
          }, 0);
          
          totalSalesWithoutTax += saleSubtotal;
        } else {
            // --- DEBUG ---
            console.log(`  - Sale ${doc.id} has no products array to calculate from.`);
        }
      });

      console.log(`Legacy sales processing complete: ${validSales} valid sales, Total (without tax) = ${totalSalesWithoutTax}`);
      return totalSalesWithoutTax;
    } catch (error) {
      console.error('Error getting legacy sales without tax:', error);
      return 0;
    }
  }

  private async getPurchasesLegacy(startDate: Date, endDate: Date): Promise<number> {
    try {
      const purchasesCollection = collection(this.firestore, 'purchases');
      
      const q = query(
        purchasesCollection,
        where('purchaseDate', '>=', startDate),
        where('purchaseDate', '<=', endDate)
      );
      
      const querySnapshot = await getDocs(q);
      
      let totalPurchases = 0;
      let validPurchases = 0;

      querySnapshot.docs.forEach(doc => {
        const purchaseData = doc.data();
        validPurchases++;

        const purchaseAmount = this.calculatePurchaseAmountWithoutTax(purchaseData, doc.id);
        totalPurchases += purchaseAmount;
      });

      console.log(`Legacy purchase processing complete: ${validPurchases} purchases, Total (excluding tax) = ${totalPurchases}`);
      return totalPurchases;
    } catch (error) {
      console.error('Error getting legacy purchases:', error);
      return 0;
    }
  }

  private async getSalesReturnsWithoutTax(startDate: Date, endDate: Date): Promise<number> {
    try {
      const returns = await this.saleService.getReturnsByDateRange(startDate, endDate);
      if (!returns?.length) return 0;

      return returns.reduce((total: number, returnItem: any) => {
        if (returnItem['products']?.length) {
          return total + returnItem['products'].reduce((sum: number, product: any) => {
            const quantity = product['quantity'] || 1;
            
            if (product['priceBeforeTax'] && product['priceBeforeTax'] > 0) {
              return sum + (product['priceBeforeTax'] * quantity);
            }
            
            const unitPrice = product['unitPrice'] || product['price'] || 0;
            const taxAmount = product['taxAmount'] || 0;
            const priceWithoutTax = Math.max(0, unitPrice - (taxAmount / quantity));
            
            return sum + (priceWithoutTax * quantity);
          }, 0);
        }
        
        let refundWithoutTax = returnItem['totalRefund'] || returnItem['refundAmount'] || 0;
        const totalTax = returnItem['taxAmount'] || returnItem['totalTax'] || 0;
        if (totalTax > 0) {
          refundWithoutTax = Math.max(0, refundWithoutTax - totalTax);
        }
        
        return total + refundWithoutTax;
      }, 0);
    } catch (error) {
      console.error('Error getting sales returns without tax:', error);
      return 0;
    }
  }

  private async getPurchaseReturns(startDate: Date, endDate: Date): Promise<number> {
    try {
      if ((this.purchaseService as any).getPurchaseReturnsByDateRange) {
        const returns = await (this.purchaseService as any).getPurchaseReturnsByDateRange(startDate, endDate);
        
        return returns.reduce((total: number, returnItem: any) => {
          let returnAmount = 0;
          
          if (returnItem.products?.length) {
            returnAmount = returnItem.products.reduce((sum: number, product: any) => {
              const quantity = product.quantity || 0;
              const unitCost = product.unitCost || product.costPrice || 0;
              return sum + (quantity * unitCost);
            }, 0);
          } else {
            returnAmount = returnItem.grandTotal || returnItem['totalAmount'] || 0;
            const totalTax = returnItem['totalTax'] || returnItem['taxAmount'] || 0;
            if (totalTax > 0) {
              returnAmount = Math.max(0, returnAmount - totalTax);
            }
          }
          
          return total + returnAmount;
        }, 0);
      }
      return 0;
    } catch (error) {
      console.error('Error getting purchase returns:', error);
      return 0;
    }
  }

  private async loadExpenseData(startDate: Date, endDate: Date): Promise<void> {
    try {
      const [expenses, incomes] = await Promise.all([
        this.getExpensesExcludingTax(startDate, endDate),
        this.getIncomesExcludingTax(startDate, endDate)
      ]);

      this.profitLossData.directExpenses = this.filterAndSumByType(expenses, 'expense', 'Direct');
      this.profitLossData.indirectExpenses = this.categorizeIndirectExpenses(expenses);
      this.profitLossData.directIncome = this.filterAndSumByType(incomes, 'income', 'Direct');
      this.profitLossData.indirectIncome = this.filterAndSumByType(incomes, 'income', 'Indirect');

      console.log('Expense data loaded:', {
        directExpenses: this.profitLossData.directExpenses,
        indirectExpenses: this.profitLossData.indirectExpenses.length,
        directIncome: this.profitLossData.directIncome,
        indirectIncome: this.profitLossData.indirectIncome
      });
    } catch (error) {
      console.error('Error loading expense data:', error);
      throw error;
    }
  }

  private async getExpensesExcludingTax(startDate: Date, endDate: Date): Promise<any[]> {
    try {
      const expenses = await this.expenseService.getExpensesByDateRange(startDate, endDate);
      if (!Array.isArray(expenses)) return [];

      return expenses.filter(expense => {
        const categoryName = (expense.categoryName || expense.expenseCategory || '').toLowerCase();
        const description = (expense.description || '').toLowerCase();

        return !(categoryName.includes('tax') ||
          categoryName.includes('gst') ||
          categoryName.includes('vat') ||
          description.includes('tax') ||
          description.includes('gst'));
      });
    } catch (error) {
      console.error('Error getting expenses:', error);
      return [];
    }
  }

  private async getIncomesExcludingTax(startDate: Date, endDate: Date): Promise<any[]> {
    try {
      if ((this.expenseService as any).getIncomesByDateRange) {
        const incomes = await (this.expenseService as any).getIncomesByDateRange(startDate, endDate);
        if (!Array.isArray(incomes)) return [];

        return incomes.filter(income => {
          const categoryName = (income.categoryName || income.incomeCategory || '').toLowerCase();
          const description = (income.description || '').toLowerCase();

          return !(categoryName.includes('tax') ||
            categoryName.includes('gst') ||
            categoryName.includes('vat') ||
            description.includes('tax') ||
            description.includes('gst'));
        });
      }
      return [];
    } catch (error) {
      console.error('Error getting incomes:', error);
      return [];
    }
  }

  private filterAndSumByType(items: any[], entryType: 'expense' | 'income', expenseType: string): number {
    return items
      .filter(item =>
        item.entryType === entryType &&
        (item.expenseType === expenseType || item.incomeType === expenseType || item.type === expenseType)
      )
      .reduce((sum, item) => sum + (item.totalAmount || item.amount || item.total || 0), 0);
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
        acc[category] = (acc[category] || 0) + amount;
        return acc;
      }, {});

    return Object.entries(expenseMap)
      .map(([name, amount]) => ({ name, amount }))
      .filter(item => item.amount > 0)
      .sort((a, b) => b.amount - a.amount);
  }

  private initExpenseChart(): void {
    setTimeout(() => {
      const chartElement = this.expenseChart?.nativeElement;
      if (!chartElement) {
        console.warn('Chart element not found');
        return;
      }

      if (this.chartInstance) {
        this.chartInstance.destroy();
      }

      const ctx = chartElement.getContext('2d');
      if (!ctx) return;

      const labels = this.profitLossData.indirectExpenses.map(e => e.name);
      const data = this.profitLossData.indirectExpenses.map(e => e.amount);

      if (labels.length === 0) {
        console.log('No indirect expenses to chart');
        return;
      }

      this.chartInstance = new Chart(ctx, {
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
    }, 100);
  }

  exportToExcel(): void {
    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet([
      { 'Category': 'Opening Stock', 'Amount': this.profitLossData.openingStock },
      { 'Category': 'Purchases (Excluding Tax)', 'Amount': this.profitLossData.purchases },
      { 'Category': 'Direct Expenses', 'Amount': this.profitLossData.directExpenses },
      { 'Category': 'Closing Stock', 'Amount': this.profitLossData.closingStock },
      { 'Category': 'Sales (Excluding Tax)', 'Amount': this.profitLossData.sales },
      { 'Category': 'Direct Income', 'Amount': this.profitLossData.directIncome },
      { 'Category': 'Gross Profit', 'Amount': this.grossProfit },
      { 'Category': 'Net Profit', 'Amount': this.netProfit }
    ]);

    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ProfitLoss');
    XLSX.writeFile(wb, `ProfitLoss_${this.today.toISOString().slice(0, 10)}.xlsx`);
  }

  printReport(): void {
    window.print();
  }

  onSubmit(): void {
    if (this.unsubscribeSales) {
      this.unsubscribeSales();
    }
    if (this.unsubscribePurchases) {
      this.unsubscribePurchases();
    }
    if (this.unsubscribeStockReport) {
      this.unsubscribeStockReport();
    }
    
    this.setupFirestoreListeners();
    this.loadDataOptimized(); // Use optimized loading
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'An unknown error occurred';
  }

  async refreshStockData(): Promise<void> {
    console.log('Manually refreshing stock data...');
    await this.refreshStockDataOptimized();
  }

  async forceRefresh(): Promise<void> {
    console.log('Force refreshing all profit & loss data...');
    await this.loadDataOptimized();
  }
  
}