import { Injectable } from '@angular/core';
import { Firestore, collection, query, where, getDocs, orderBy, Timestamp } from '@angular/fire/firestore';
import { StockService } from './stock.service';
import { ProductsService } from './products.service';
import { ExpenseService } from './expense.service';
import { SaleService } from './sale.service';
import { PurchaseService } from './purchase.service';
import { JournalService } from './journal.service';
import { DailyStockService } from './daily-stock.service';
import { DatePipe } from '@angular/common';
import { PurchaseReturnService } from './purchase-return.service'; // <-- ADDED IMPORT

// Interface for breakdown items (same as profit-loss2)
interface BreakdownItem {
  name: string;
  amount: number;
}

interface ProfitLossReport {
  openingStock: number;
  closingStock: number;
  purchases: number;
  sales: number;
  directExpenses: number;
  directIncome: number;
  indirectExpenses: number;
  operationalExpenses: number;
    indirectIncome: number; // <-- ADD THIS LINE

  grossProfit: number;
  netProfit: number;
  reportDate: {
    start: Date;
    end: Date;
  };
  isRealtimeData?: boolean;
  lastUpdated?: Date;
  directExpenseBreakdown?: BreakdownItem[];
  indirectExpenseBreakdown?: BreakdownItem[];
  operationalExpenseBreakdown?: BreakdownItem[];
  directIncomeBreakdown?: BreakdownItem[];
  indirectIncomeBreakdown?: BreakdownItem[];
  
}

@Injectable({
  providedIn: 'root'
})
export class ProfitLossService {
  private profitLossCache: Map<string, ProfitLossReport> = new Map();
  private readonly CACHE_DURATION = 3 * 60 * 1000; // 3 minutes cache for faster loading
private readonly SYSTEM_MARGIN = 0.50; // 50% margin as per your Jan 06 data
  constructor(
    private firestore: Firestore,
    private stockService: StockService,
    private productsService: ProductsService,
    private expenseService: ExpenseService,
    private saleService: SaleService,
    private purchaseService: PurchaseService,
    private purchaseReturnService: PurchaseReturnService, // <-- INJECTED SERVICE
    private journalService: JournalService,
    private dailyStockService: DailyStockService,
    private datePipe?: DatePipe
  ) {}

async getProfitLoss2Report(startDate: Date, endDate: Date, forceRefresh = false): Promise<ProfitLossReport> {
  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    console.time('PL-Load-Speed');

    const [
      openingStock,
      closingStock,
      sales,
      purchases,
      grnTotal,
      expenses,
      incomes
    ] = await Promise.all([
      this.dailyStockService.getStockValueForDate(start, 'opening'),
      this.dailyStockService.getStockValueForDate(end, 'closing'),
      this.saleService.getTotalSalesWithoutTaxByDateRange(start, end),
      this.purchaseService.getTotalPurchasesWithoutTaxByDateRange(start, end),
      this.purchaseService.getGrnTotalWithoutTaxByDateRange(start, end),
      this.getExpenseBreakdown(start, end),
      this.getIncomeBreakdown(start, end)
    ]);

    const totalPurchases = purchases + grnTotal;
    const directExp = expenses.directExpenses.reduce((sum, i) => sum + i.amount, 0);
    const directInc = incomes.directIncome.reduce((sum, i) => sum + i.amount, 0);

    // ✅ FIXED: Removed the aggressive check that reset Closing Stock to Opening Stock.
    // If dailyStockService returns a closing stock, we trust it.
    let finalClosingStock = closingStock;
    
    // Only reset if absolutely NO activity happened AND closing stock somehow equals 0 (safety check)
    if (sales === 0 && totalPurchases === 0 && finalClosingStock === 0 && openingStock > 0) {
       // Logic: If nothing sold/bought, stock shouldn't disappear to 0 unless manually adjusted.
       // But if stock was reduced via sale (Sales > 0), this block won't run.
       finalClosingStock = openingStock;
    }
    
    // Standard P&L Formula: (Closing + Sales) - (Opening + Purchases + Expenses)
    const grossProfit = (finalClosingStock + sales + directInc) - (openingStock + totalPurchases + directExp);

    const indirectExp = expenses.indirectExpenses.reduce((sum, i) => sum + i.amount, 0);
    const operationalExp = expenses.operationalExpenses.reduce((sum, i) => sum + i.amount, 0);
    const indirectInc = incomes.indirectIncome.reduce((sum, i) => sum + i.amount, 0);
    
    const netProfit = (grossProfit + indirectInc) - (indirectExp + operationalExp);

    console.timeEnd('PL-Load-Speed');

    console.log(`📊 P&L Calculation Summary:`);
    console.log(`   Opening Stock: ₹${openingStock.toFixed(2)}`);
    console.log(`   Sales: ₹${sales.toFixed(2)}`);
    console.log(`   Purchases: ₹${totalPurchases.toFixed(2)}`);
    console.log(`   Closing Stock: ₹${finalClosingStock.toFixed(2)}`);
    console.log(`   Gross Profit: ₹${grossProfit.toFixed(2)}`);

    return {
      openingStock,
      closingStock: finalClosingStock,
      purchases: totalPurchases,
      sales,
      directExpenses: directExp,
      indirectExpenses: indirectExp,
      operationalExpenses: operationalExp,
      directIncome: directInc,
      indirectIncome: indirectInc,
      grossProfit,
      netProfit,
      reportDate: { start, end },
      lastUpdated: new Date(),
      directExpenseBreakdown: expenses.directExpenses,
      indirectExpenseBreakdown: expenses.indirectExpenses,
      operationalExpenseBreakdown: expenses.operationalExpenses,
      directIncomeBreakdown: incomes.directIncome,
      indirectIncomeBreakdown: incomes.indirectIncome
    };
  } catch (error) {
    console.error('Error generating report:', error);
    throw error;
  }
}
private async calculateStockValue(snapshot: any): Promise<number> {
  let totalValue = 0;
  try {
    const products = await this.productsService.fetchAllProducts();
    
    for (const [key, stockData] of Object.entries(snapshot)) {
      const data = stockData as any;
      const productId = data.productId || key.split('_')[0];
      const product = products.find(p => p.id === productId);

      // ✅ CORRECTED: Using fields defined in your product.model.ts
      const purchaseCost = product?.defaultPurchasePriceExcTax || 
                          product?.unitPurchasePrice || 
                          data.unitCost || 0;
      
      const quantity = Number(data.closing || data.closingStock || 0);
      
      if (quantity > 0 && purchaseCost > 0) {
        totalValue += (quantity * purchaseCost);
      }
    }
  } catch (error) {
    console.error('Error calculating stock value:', error);
  }
  return parseFloat(totalValue.toFixed(2));
}

private async getDerivedStockValue(targetDate: Date): Promise<number> {
    console.log(`📊 P&L Requesting Stock Value for: ${targetDate.toDateString()}`);
    
    // 1. Strictly call the Stock Service. 
    // We rely on its new "Lookback" and "Yesterday Fallback" capability to find the last valid number (150,000)
    // even if no transaction happened today.
    // This prevents the "Purchases - Sales" formula from running and ignoring Initial Stock.
    const stockValue = await this.stockService.getClosingStockValue(targetDate);
    
    return stockValue;
 }
// src/app/services/profit-loss.service.ts

// src/app/services/profit-loss.service.ts
// src/app/services/profit-loss.service.ts

// src/app/services/profit-loss.service.ts




  private checkIfPurchaseIsFullyReturned(purchase: any, allReturns: any[]): boolean {
    if (!purchase.products || purchase.products.length === 0) {
        // A purchase with no products is not relevant for this check.
        return false;
    }

    // Filter returns that belong to the specific purchase we are checking.
    const relevantReturns = allReturns.filter(r => r.parentPurchaseId === purchase.id);

    if (relevantReturns.length === 0) {
        return false; // No returns means it cannot be fully returned.
    }

    // Create a map to sum up the total returned quantity for each product.
    const returnedQuantities = new Map<string, number>();
    for (const ret of relevantReturns) {
        if (ret.products && Array.isArray(ret.products)) {
            for (const product of ret.products) {
                const productId = product.productId || product.id;
                if (productId) {
                    const currentReturnedQty = returnedQuantities.get(productId) || 0;
                    returnedQuantities.set(productId, currentReturnedQty + (product.returnQuantity || 0));
                }
            }
        }
    }

    // Check if every product in the original purchase has been returned.
    for (const originalProduct of purchase.products) {
        const productId = originalProduct.productId || originalProduct.id;
        const originalQty = originalProduct.quantity || 0;
        const totalReturnedQty = returnedQuantities.get(productId) || 0;

        if (totalReturnedQty < originalQty) {
            // If we find even one product that isn't fully returned, we can stop and report false.
            return false;
        }
    }

    // If the loop completes without returning false, it means every product was fully returned.
    console.log(`P&L Check: Purchase ${purchase.referenceNo} is confirmed as fully returned via cumulative returns.`);
    return true;
  }
// src/app/services/profit-loss.service.ts
// src/app/services/profit-loss.service.ts

  /**
   * Gets a grouped and summed breakdown of income by category.
   * ✅ FIXED: Robust String Matching for Account Heads
   */
  async getIncomeBreakdown(startDate: Date, endDate: Date): Promise<{
    directIncome: BreakdownItem[],
    indirectIncome: BreakdownItem[]
  }> {
    try {
      const [journalEntries, regularIncomes] = await Promise.all([
        this.journalService.getTransactionsByDateRange(startDate, endDate),
        (this.expenseService as any).getIncomesByDateRange ? (this.expenseService as any).getIncomesByDateRange(startDate, endDate) : Promise.resolve([])
      ]);

      const directMap = new Map<string, number>();
      const indirectMap = new Map<string, number>();

      const addToMap = (map: Map<string, number>, name: string, amount: number) => {
        map.set(name, (map.get(name) || 0) + amount);
      };

      // Process Journal Entries
      journalEntries.forEach(entry => {
        const head = (entry['accountHead'] || '').toLowerCase();
        const type = (entry['accountType'] || '').toLowerCase();

        if (type === 'income_category') {
          const name = entry['accountName'] || entry['description'] || 'Journal Income';
          const amount = Math.abs((entry['credit'] || 0) - (entry['debit'] || 0));
          
          if (amount !== 0) {
            if (head.includes('direct') && !head.includes('indirect')) {
                addToMap(directMap, name, amount);
            } else {
                addToMap(indirectMap, name, amount);
            }
          }
        }
      });

      // Process Regular Incomes
      if (Array.isArray(regularIncomes)) {
        regularIncomes.forEach(income => {
          const amount = income.totalAmount || income.paymentAmount || 0;
          if (amount > 0) {
            const name = income.incomeCategoryName || income.incomeFor || 'Income Entry';
            const head = (income.accountHead || '').toLowerCase();
            const type = (income.incomeType || '').toLowerCase();

            if (head.includes('direct') && !head.includes('indirect') || type === 'direct') {
                addToMap(directMap, name, amount);
            } else {
                addToMap(indirectMap, name, amount);
            }
          }
        });
      }

      return {
        directIncome: Array.from(directMap, ([name, amount]) => ({ name, amount })),
        indirectIncome: Array.from(indirectMap, ([name, amount]) => ({ name, amount }))
      };
    } catch (error) {
      console.error('Error getting income breakdown in service:', error);
      return { directIncome: [], indirectIncome: [] };
    }
  }

  /**
   * Get total sales value *before tax* (EXACT same method as profit-loss2)
   */
  private async getSalesWithoutTax(startDate: Date, endDate: Date): Promise<number> {
    try {
      const salesCollection = collection(this.firestore, 'sales');
      const startTimestamp = Timestamp.fromDate(startDate);
      const endTimestamp = Timestamp.fromDate(endDate);

      const q = query(
        salesCollection,
        where('status', '==', 'Completed'),
        where('saleDate', '>=', startTimestamp),
        where('saleDate', '<=', endTimestamp)
      );

      const querySnapshot = await getDocs(q);
      let totalSalesWithoutTax = 0;

      querySnapshot.forEach(doc => {
        const saleData = doc.data();

        if (saleData['totalBeforeTax'] !== undefined && saleData['totalBeforeTax'] !== null) {
          totalSalesWithoutTax += Number(saleData['totalBeforeTax']) || 0;
          return;
        }

        if (saleData['products']?.length) {
          const saleSubtotal = saleData['products'].reduce((sum: number, product: any) => {
            const quantity = product['quantity'] || 1;
            const unitPrice = product['unitPrice'] || 0;
            const taxRate = product['taxRate'] || 0;
            let priceBeforeTax = 0;

            if (product['priceBeforeTax'] !== undefined && product['priceBeforeTax'] !== null) {
                priceBeforeTax = product['priceBeforeTax'];
            }
            else if (unitPrice > 0 && taxRate > 0) {
                priceBeforeTax = unitPrice / (1 + (taxRate / 100));
            }
            else {
                priceBeforeTax = unitPrice;
            }

            return sum + (priceBeforeTax * quantity);
          }, 0);
          totalSalesWithoutTax += saleSubtotal;
        }
      });
      return totalSalesWithoutTax;
    } catch (error) {
      console.error('Error calculating sales without tax:', error);
      return 0;
    }
  }
  /**
   * Gets a grouped and summed breakdown of expenses by category.
   * THIS IS THE CORRECTED LOGIC.
   */
// ... inside ProfitLossService class ...

  async getExpenseBreakdown(startDate: Date, endDate: Date): Promise<{
    directExpenses: BreakdownItem[],
    indirectExpenses: BreakdownItem[],
    operationalExpenses: BreakdownItem[]
  }> {
    try {
      const [journalEntries, regularExpenses] = await Promise.all([
        this.journalService.getTransactionsByDateRange(startDate, endDate),
        this.expenseService.getExpensesByDateRange(startDate, endDate)
      ]);

      const directMap = new Map<string, number>();
      const indirectMap = new Map<string, number>();
      const operationalMap = new Map<string, number>();

      const addToMap = (map: Map<string, number>, name: string, amount: number) => {
        map.set(name, (map.get(name) || 0) + amount);
      };

      // --- 1. Process Journal Entries ---
      journalEntries.forEach(entry => {
        const type = (entry['accountType'] || '').toLowerCase();
        
        // Only look at expense categories
        if (type === 'expense_category') {
          const name = entry['accountName'] || entry['description'] || 'Journal Expense';
          
          // Calculate amount regardless of whether user Debit or Credited it
          const amount = Math.abs((Number(entry['debit']) || 0) - (Number(entry['credit']) || 0));

          // Only process if there is a value
          if (amount > 0) {
            const head = (entry['accountHead'] || '').toLowerCase();

            // LOGIC: Check keywords. If no keywords match, DEFAULT to Indirect.
            if (head.includes('direct') && !head.includes('indirect')) {
               addToMap(directMap, name, amount);
            } 
            else if (head.includes('operational')) {
               addToMap(operationalMap, name, amount);
            } 
            else {
               // ✅ CRITICAL FIX: If it's an expense category but we aren't sure,
               // put it in Indirect. This ensures "Marketing expenses" shows up.
               addToMap(indirectMap, name, amount);
            }
          }
        }
      });

      // --- 2. Process Regular Expenses (Purchases/Expense Module) ---
      regularExpenses.forEach(expense => {
        const amount = Number(expense.totalAmount || expense.paymentAmount || 0);
        
        if (amount > 0) {
          const name = expense.expenseCategoryName || expense.expenseFor || 'Expense Entry';
          const head = (expense.accountHead || '').toLowerCase();
          const type = (expense.expenseType || '').toLowerCase();

          if ((head.includes('direct') && !head.includes('indirect')) || type === 'direct') {
             addToMap(directMap, name, amount);
          } else if (head.includes('operational') || type === 'operational') {
             addToMap(operationalMap, name, amount);
          } else {
             // Fallback to Indirect
             addToMap(indirectMap, name, amount);
          }
        }
      });

      return {
        directExpenses: Array.from(directMap, ([name, amount]) => ({ name, amount })),
        indirectExpenses: Array.from(indirectMap, ([name, amount]) => ({ name, amount })),
        operationalExpenses: Array.from(operationalMap, ([name, amount]) => ({ name, amount }))
      };
    } catch (error) {
      console.error('Error getting expense breakdown in service:', error);
      return { directExpenses: [], indirectExpenses: [], operationalExpenses: [] };
    }
  }

  async getProfitLossReport(startDate: Date, endDate: Date, forceRefresh = false): Promise<ProfitLossReport> {
    try {
      const cacheKey = `${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}`;
      
      if (!forceRefresh && this.profitLossCache.has(cacheKey)) {
        const cached = this.profitLossCache.get(cacheKey)!;
        const cacheAge = Date.now() - (cached.lastUpdated?.getTime() || 0);
        
        if (cacheAge < this.CACHE_DURATION) {
          console.log('Returning cached profit/loss data');
          return cached;
        }
      }

      console.log('Generating fresh profit/loss report...');
      const startTime = Date.now();

      const normalizedStartDate = this.normalizeDate(startDate);
      const normalizedEndDate = this.normalizeDate(endDate);
      
      const adjustedEndDate = new Date(normalizedEndDate.getTime());
      adjustedEndDate.setUTCHours(23, 59, 59, 999);

      console.log('Fetching optimized profit/loss data for:', {
        start: normalizedStartDate,
        end: adjustedEndDate
      });

      const [stockData, transactionData, expenseData] = await Promise.all([
        this.getOptimizedStockValues(normalizedStartDate, adjustedEndDate),
        this.getOptimizedTransactionData(normalizedStartDate, adjustedEndDate),
        this.getOptimizedExpenseData(normalizedStartDate, adjustedEndDate)
      ]);

      console.log(`Data loading completed in ${Date.now() - startTime}ms`);

      const grossProfit = (stockData.closingStock + transactionData.sales) - 
                         (stockData.openingStock + transactionData.purchases + expenseData.directExpenses);
      
      const netProfit = grossProfit - expenseData.indirectExpenses + expenseData.directIncome;
      
      const report: ProfitLossReport = {
        openingStock: stockData.openingStock,
        closingStock: stockData.closingStock,
        purchases: transactionData.purchases,
        sales: transactionData.sales,
        directExpenses: expenseData.directExpenses,
        directIncome: expenseData.directIncome,
        indirectExpenses: expenseData.indirectExpenses,
        operationalExpenses: 0, // Added for compatibility
        indirectIncome: 0, // Added to satisfy ProfitLossReport interface
        grossProfit: grossProfit,
        netProfit: netProfit,
        reportDate: {
          start: normalizedStartDate,
          end: adjustedEndDate
        },
        isRealtimeData: true,
        lastUpdated: new Date()
      };

      this.profitLossCache.set(cacheKey, report);
      
      console.log(`Optimized profit/loss report generated in ${Date.now() - startTime}ms:`, report);
      return report;

    } catch (error) {
      console.error('Error generating optimized profit/loss report:', error);
      throw new Error(`Failed to generate profit/loss report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clear profit/loss cache
   */
  clearCache(): void {
    this.profitLossCache.clear();
    console.log('Profit/loss cache cleared');
  }

  /**
   * Get current year-to-date profit/loss
   */
  async getYearToDateProfitLoss(asOfDate?: Date): Promise<ProfitLossReport> {
    const currentDate = asOfDate || new Date();
    const startOfYear = new Date(currentDate.getFullYear(), 0, 1);
    
    return this.getProfitLossReport(startOfYear, currentDate, true);
  }

  /**
   * Normalize date to avoid timezone issues
   */
  private normalizeDate(date: Date): Date {
    return new Date(Date.UTC(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      0, 0, 0, 0
    ));
  }

  /**
   * OPTIMIZED: Get stock values with better performance
   */
  private async getOptimizedStockValues(startDate: Date, endDate: Date): Promise<{ openingStock: number; closingStock: number }> {
    try {
      console.log('Getting optimized stock values for P&L:', { startDate, endDate });
      
      try {
        const [openingStockValue, closingStockValue] = await Promise.all([
          this.dailyStockService.getStockValueForDate(startDate, 'opening'),
          this.dailyStockService.getStockValueForDate(endDate, 'closing')
        ]);
        
        console.log('Optimized stock values calculated:', {
          opening: openingStockValue,
          closing: closingStockValue
        });
        
        return {
          openingStock: openingStockValue,
          closingStock: closingStockValue
        };
      } catch (dailyStockError) {
        console.warn('DailyStockService failed, using fallback method:', dailyStockError);
        
        const previousDay = new Date(startDate);
        previousDay.setDate(previousDay.getDate() - 1);
        
        const [openingSnapshot, closingSnapshot] = await Promise.all([
          this.stockService.getDailyStockSnapshot(previousDay).catch(() => ({})),
          this.stockService.getDailyStockSnapshot(endDate).catch(() => ({}))
        ]);
        
        const openingStock = await this.calculateStockValue(openingSnapshot || {});
        const closingStock = await this.calculateStockValue(closingSnapshot || {});
        
        console.log('Fallback stock values calculated:', { openingStock, closingStock });
        
        return { openingStock, closingStock };
      }
    } catch (error) {
      console.error('Error getting optimized stock values:', error);
      return { openingStock: 0, closingStock: 0 };
    }
  }

  /**
   * OPTIMIZED: Get transaction data with better performance
   */
  private async getOptimizedTransactionData(startDate: Date, endDate: Date): Promise<{ purchases: number; sales: number }> {
    try {
      console.log('Getting optimized transaction data...');
      
      const [purchases, sales] = await Promise.all([
        this.getOptimizedPurchases(startDate, endDate),
        this.getOptimizedSales(startDate, endDate)
      ]);
      
      console.log('Optimized transaction data loaded:', { purchases, sales });
      
      return { purchases, sales };
    } catch (error) {
      console.error('Error getting optimized transaction data:', error);
      return { purchases: 0, sales: 0 };
    }
  }

  /**
   * OPTIMIZED: Get purchases with better performance
   */
  private async getOptimizedPurchases(startDate: Date, endDate: Date): Promise<number> {
    try {
      const purchasesCollection = collection(this.firestore, 'purchases');
      
      let querySnapshot;
      try {
        const q = query(
          purchasesCollection,
          where('purchaseDate', '>=', startDate),
          where('purchaseDate', '<=', endDate)
        );
        querySnapshot = await getDocs(q);
      } catch (error) {
        console.warn('Purchase date query failed, trying createdAt:', error);
        
        const q = query(
          purchasesCollection,
          where('createdAt', '>=', startDate),
          where('createdAt', '<=', endDate)
        );
        querySnapshot = await getDocs(q);
      }

      let totalPurchases = 0;
      let processedCount = 0;

      querySnapshot.docs.forEach(doc => {
        const purchaseData = doc.data();
        processedCount++;

        let purchaseAmount = 0;

        if (purchaseData['products']?.length) {
          purchaseAmount = purchaseData['products'].reduce((sum: number, product: any) => {
            const quantity = product['quantity'] || 1;
            const unitCost = product['unitCost'] || product['price'] || product['costPrice'] || 0;
            return sum + (unitCost * quantity);
          }, 0);
        } else if (purchaseData['purchaseTotal']) {
          purchaseAmount = purchaseData['purchaseTotal'];
        } else if (purchaseData['grandTotal']) {
          purchaseAmount = purchaseData['grandTotal'];
          const totalTax = purchaseData['totalTax'] || purchaseData['taxAmount'] || 0;
          purchaseAmount = Math.max(0, purchaseAmount - totalTax);
        }

        totalPurchases += Math.max(0, purchaseAmount || 0);
      });

      console.log(`Optimized purchases: ${processedCount} processed, Total = ${totalPurchases}`);
      return totalPurchases;
    } catch (error) {
      console.error('Error getting optimized purchases:', error);
      return 0;
    }
  }

async getOptimizedSales(startDate: Date, endDate: Date): Promise<number> {
    try {
      console.log('[DEBUG] Querying for sales between:', 
        startDate.toISOString(), 'and', endDate.toISOString());

      const salesCollection = collection(this.firestore, 'sales');
      
      const startTimestamp = Timestamp.fromDate(startDate);
      const endTimestamp = Timestamp.fromDate(endDate);

      const q = query(
        salesCollection,
        where('status', '==', 'Completed'),
        where('saleDate', '>=', startTimestamp),
        where('saleDate', '<=', endTimestamp)
      );

      const querySnapshot = await getDocs(q);
      console.log(`[DEBUG] Query returned ${querySnapshot.size} documents`);

      let totalSalesWithoutTax = 0;
      
      querySnapshot.forEach(doc => {
        const saleData = doc.data();
        console.log(`[DEBUG] Processing sale ${doc.id} with date:`, 
          saleData['saleDate']?.toDate()?.toISOString());

        if (saleData['totalBeforeTax'] !== undefined) {
          totalSalesWithoutTax += Number(saleData['totalBeforeTax']) || 0;
          return;
        }

        if (saleData['products']?.length) {
          const saleSubtotal = saleData['products'].reduce((sum: number, product: any) => {
            const quantity = product['quantity'] || 1;
            const priceBeforeTax = product['priceBeforeTax'] || 
                                 (product['unitPrice'] / (1 + (product['taxRate'] || 0)/100));
            return sum + (priceBeforeTax * quantity);
          }, 0);
          totalSalesWithoutTax += saleSubtotal;
        }
      });

      console.log('[DEBUG] Total sales without tax:', totalSalesWithoutTax);
      return totalSalesWithoutTax;
    } catch (error) {
      console.error('Error in getOptimizedSales:', error);
      return 0;
    }
  }

  private async getOptimizedExpenseData(startDate: Date, endDate: Date): Promise<{ 
    directExpenses: number; 
    indirectExpenses: number;
    directIncome: number;
  }> {
    try {
      console.log('Getting optimized expense data...');
      
      const [expenses, incomes] = await Promise.all([
        this.expenseService.getExpensesByDateRange(startDate, endDate).catch(() => []),
        this.getOptimizedIncomes(startDate, endDate)
      ]);

      let directExpenses = 0;
      let indirectExpenses = 0;
      let directIncome = incomes;

      if (Array.isArray(expenses)) {
        expenses.forEach((expense) => {
          if (expense && expense.id) {
            const amount = expense.totalAmount || expense.amount || 0;
            const type = expense.expenseType || expense.type || '';
            
            const categoryName = (expense.categoryName || expense.expenseCategory || '').toLowerCase();
            const description = (expense.description || '').toLowerCase();
            
            if (categoryName.includes('tax') || categoryName.includes('gst') ||
                description.includes('tax') || description.includes('gst')) {
              return;
            }
            
            if (type.toLowerCase() === 'direct') {
              directExpenses += amount;
            } else {
              indirectExpenses += amount;
            }
          }
        });
      }

      console.log('Optimized expense data calculated:', {
        directExpenses,
        indirectExpenses,
        directIncome
      });

      return { 
        directExpenses, 
        indirectExpenses,
        directIncome
      };
    } catch (error) {
      console.error('Error getting optimized expense data:', error);
      return { directExpenses: 0, indirectExpenses: 0, directIncome: 0 };
    }
  }

  /**
   * OPTIMIZED: Get incomes with better performance
   */
  private async getOptimizedIncomes(startDate: Date, endDate: Date): Promise<number> {
    try {
      if ((this.expenseService as any).getIncomesByDateRange) {
        const incomes = await (this.expenseService as any).getIncomesByDateRange(startDate, endDate);
        if (!Array.isArray(incomes)) return 0;

        return incomes
          .filter(income => {
            const categoryName = (income.categoryName || income.incomeCategory || '').toLowerCase();
            const description = (income.description || '').toLowerCase();

            return !(categoryName.includes('tax') || categoryName.includes('gst') ||
              description.includes('tax') || description.includes('gst'));
          })
          .reduce((total, income) => {
            return total + (income.totalAmount || income.amount || 0);
          }, 0);
      }
      return 0;
    } catch (error) {
      console.error('Error getting optimized incomes:', error);
      return 0;
    }
  }
// src/app/services/profit-loss.service.ts



   private checkIfSaleIsFullyReturned(sale: any, allReturns: any[]): boolean {
        if (!sale.products || sale.products.length === 0) return false;
        const relevantReturns = allReturns.filter(r => r.originalSaleId === sale.id);
        if (relevantReturns.length === 0) return false;

        const returnedQuantities = new Map<string, number>();
        for (const ret of relevantReturns) {
            if (ret.returnedItems && Array.isArray(ret.returnedItems)) {
                for (const item of ret.returnedItems) {
                    const productId = item.productId || item.id;
                    if (productId) {
                        const currentQty = returnedQuantities.get(productId) || 0;
                        returnedQuantities.set(productId, currentQty + (item.quantity || 0));
                    }
                }
            }
        }

        for (const originalProduct of sale.products) {
            const productId = originalProduct.productId || originalProduct.id;
            const originalQty = originalProduct.quantity || 0;
            const totalReturnedQty = returnedQuantities.get(productId) || 0;
            if (totalReturnedQty < originalQty) {
                return false; // Found a product not fully returned
            }
        }
        
        console.log(`P&L Check: Sale ${sale.invoiceNo} is confirmed as fully returned via cumulative returns.`);
        return true;
    }

}