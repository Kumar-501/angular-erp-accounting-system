// profit-loss.service.ts
import { Injectable } from '@angular/core';
import { Firestore, collection, query, where, getDocs, orderBy } from '@angular/fire/firestore';
import { StockService } from './stock.service';
import { ProductsService } from './products.service';
import { ExpenseService } from './expense.service';
import { SaleService } from './sale.service';
import { DailyStockService } from './daily-stock.service';
import { DatePipe } from '@angular/common';

// Type definitions
interface Purchase {
  id: string;
  purchaseTotal?: number;
  purchaseDate?: Date;
  [key: string]: any;
}

interface Sale {
  id: string;
  paymentAmount?: number;
  saleDate?: Date;
  status?: string;
  [key: string]: any;
}

interface ProfitLossReport {
  openingStock: number;
  closingStock: number;
  purchases: number;
  sales: number;
  directExpenses: number;
  directIncome: number;
  indirectExpenses: number;
  grossProfit: number;
  netProfit: number;
  reportDate: {
    start: Date;
    end: Date;
  };
  isRealtimeData?: boolean;
  lastUpdated?: Date;
}

@Injectable({
  providedIn: 'root'
})
export class ProfitLossService {
  private profitLossCache: Map<string, ProfitLossReport> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

  constructor(
    private firestore: Firestore,
    private stockService: StockService,
    private productsService: ProductsService,
    private expenseService: ExpenseService,
    private saleService: SaleService,
    private dailyStockService: DailyStockService, // Add this injection
    private datePipe?: DatePipe
  ) {}

  /**
   * Get real-time profit/loss report with caching and corrected stock calculations
   */
  async getProfitLossReport(startDate: Date, endDate: Date, forceRefresh = false): Promise<ProfitLossReport> {
    try {
      const cacheKey = `${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}`;
      
      // Check cache first unless force refresh is requested
      if (!forceRefresh && this.profitLossCache.has(cacheKey)) {
        const cached = this.profitLossCache.get(cacheKey)!;
        const cacheAge = Date.now() - (cached.lastUpdated?.getTime() || 0);
        
        if (cacheAge < this.CACHE_DURATION) {
          console.log('Returning cached profit/loss data');
          return cached;
        }
      }

      // Normalize dates to avoid timezone issues
      const normalizedStartDate = this.normalizeDate(startDate);
      const normalizedEndDate = this.normalizeDate(endDate);
      
      // Adjust end date to include the full day
      const adjustedEndDate = new Date(normalizedEndDate);
      adjustedEndDate.setHours(23, 59, 59, 999);

      console.log('Fetching real-time profit/loss data for:', {
        start: normalizedStartDate,
        end: adjustedEndDate
      });

      // Initialize daily snapshots if needed
      await this.dailyStockService.initializeDailySnapshotsIfNeeded(normalizedStartDate);
      await this.dailyStockService.initializeDailySnapshotsIfNeeded(adjustedEndDate);

      // Get all data in parallel for better performance
      const [stockData, purchases, sales, incomeExpenseData] = await Promise.all([
        this.getStockValues(normalizedStartDate, adjustedEndDate),
        this.getPurchases(normalizedStartDate, adjustedEndDate),
        this.getSales(normalizedStartDate, adjustedEndDate),
        this.getIncomeExpenseData(normalizedStartDate, adjustedEndDate)
      ]);

      // Calculate totals
      const totalPurchases = purchases.reduce((sum, p) => sum + (p.purchaseTotal || 0), 0);
      const totalSales = sales.reduce((sum, s) => sum + (s.paymentAmount || 0), 0);
      
      // Calculate gross profit: (Closing Stock + Sales) - (Opening Stock + Purchases)
      const grossProfit = (stockData.closingStock + totalSales) - (stockData.openingStock + totalPurchases);
      
      // Calculate net profit: Gross Profit - Indirect Expenses + Direct Income
      const netProfit = grossProfit - incomeExpenseData.totalIndirectExpenses + incomeExpenseData.totalDirectIncome;
      
      const report: ProfitLossReport = {
        openingStock: stockData.openingStock,
        closingStock: stockData.closingStock,
        purchases: totalPurchases,
        sales: totalSales,
        directExpenses: incomeExpenseData.totalDirectExpenses,
        directIncome: incomeExpenseData.totalDirectIncome,
        indirectExpenses: incomeExpenseData.totalIndirectExpenses,
        grossProfit: grossProfit,
        netProfit: netProfit,
        reportDate: {
          start: normalizedStartDate,
          end: adjustedEndDate
        },
        isRealtimeData: true,
        lastUpdated: new Date()
      };

      // Cache the result
      this.profitLossCache.set(cacheKey, report);
      
      console.log('Generated real-time profit/loss report:', report);
      return report;

    } catch (error) {
      console.error('Error generating profit/loss report:', error);
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
   * Get stock values using DailyStockService for accurate calculations
   */
  private async getStockValues(startDate: Date, endDate: Date): Promise<{ openingStock: number; closingStock: number }> {
    try {
      console.log('Getting stock values for P&L:', { startDate, endDate });
      
      // Use DailyStockService for accurate opening and closing stock values
      const [openingStockValue, closingStockValue] = await Promise.all([
        this.dailyStockService.getStockValueForDate(startDate, 'opening'),
        this.dailyStockService.getStockValueForDate(endDate, 'closing')
      ]);
      
      console.log('Stock values calculated:', {
        opening: openingStockValue,
        closing: closingStockValue
      });
      
      return {
        openingStock: openingStockValue,
        closingStock: closingStockValue
      };
    } catch (error) {
      console.error('Error getting stock values:', error);
      
      // Fallback to legacy method if DailyStockService fails
      try {
        const previousDay = new Date(startDate);
        previousDay.setDate(previousDay.getDate() - 1);
        
        const [openingSnapshot, closingSnapshot] = await Promise.all([
          this.stockService.getDailyStockSnapshot(previousDay).catch(err => {
            console.warn(`Opening stock snapshot not found for ${previousDay.toDateString()}:`, err);
            return {};
          }),
          this.stockService.getDailyStockSnapshot(endDate).catch(err => {
            console.warn(`Closing stock snapshot not found for ${endDate.toDateString()}:`, err);
            return {};
          })
        ]);
        
        return {
          openingStock: await this.calculateStockValue(openingSnapshot || {}),
          closingStock: await this.calculateStockValue(closingSnapshot || {})
        };
      } catch (fallbackError) {
        console.error('Fallback stock calculation also failed:', fallbackError);
        return { openingStock: 0, closingStock: 0 };
      }
    }
  }

  /**
   * Calculate stock value from snapshot (legacy method)
   */
  private async calculateStockValue(snapshot: any): Promise<number> {
    let totalValue = 0;
    
    try {
      if (!snapshot || Object.keys(snapshot).length === 0) {
        return 0;
      }

      // Get all products with their cost prices
      const products = await this.productsService.fetchAllProducts();
      
      for (const [productId, stockData] of Object.entries(snapshot)) {
        const product = products.find(p => p.id === productId);
        if (product) {
          const costPrice = product.defaultPurchasePriceExcTax || 0;
          const quantity = (stockData as any).closing || 0;
          totalValue += quantity * costPrice;
        } else {
          console.warn(`Product not found for ID: ${productId}`);
        }
      }
    } catch (error) {
      console.error('Error calculating stock value:', error);
      throw new Error(`Failed to calculate stock value: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    return totalValue;
  }

  /**
   * Get purchases data with enhanced filtering
   */
  private async getPurchases(startDate: Date, endDate: Date): Promise<Purchase[]> {
    try {
      const purchasesCollection = collection(this.firestore, 'purchases');
      const q = query(
        purchasesCollection,
        where('purchaseDate', '>=', startDate),
        where('purchaseDate', '<=', endDate),
        orderBy('purchaseDate', 'desc')
      );
      
      const snapshot = await getDocs(q);
      const purchases = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Purchase));

      console.log(`Fetched ${purchases.length} purchases for the period`);
      return purchases;
    } catch (error) {
      console.error('Error fetching purchases:', error);
      // If composite index is not available, try simpler query
      try {
        const purchasesCollection = collection(this.firestore, 'purchases');
        const q = query(
          purchasesCollection,
          where('purchaseDate', '>=', startDate),
          where('purchaseDate', '<=', endDate)
        );
        
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Purchase));
      } catch (fallbackError) {
        console.error('Fallback purchase query also failed:', fallbackError);
        throw new Error(`Failed to fetch purchases: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Get sales data with enhanced filtering
   */
  private async getSales(startDate: Date, endDate: Date): Promise<Sale[]> {
    try {
      const salesCollection = collection(this.firestore, 'sales');
      
      // Try with status filter first
      try {
        const q = query(
          salesCollection,
          where('saleDate', '>=', startDate),
          where('saleDate', '<=', endDate),
          where('status', '==', 'Completed'),
          orderBy('saleDate', 'desc')
        );
        
        const snapshot = await getDocs(q);
        const sales = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Sale));

        console.log(`Fetched ${sales.length} completed sales for the period`);
        return sales;
      } catch (indexError) {
        console.warn('Composite index not available, using simpler query');
        
        // Fallback to simpler query without status filter
        const q = query(
          salesCollection,
          where('saleDate', '>=', startDate),
          where('saleDate', '<=', endDate)
        );
        
        const snapshot = await getDocs(q);
        const allSales = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Sale));

        // Filter completed sales in memory
        const completedSales = allSales.filter(sale => sale.status === 'Completed');
        console.log(`Fetched ${completedSales.length} completed sales (filtered in memory)`);
        return completedSales;
      }
    } catch (error) {
      console.error('Error fetching sales:', error);
      throw new Error(`Failed to fetch sales: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get income and expense data with detailed categorization
   */
  private async getIncomeExpenseData(startDate: Date, endDate: Date): Promise<{ 
    totalDirectIncome: number; 
    totalIndirectExpenses: number;
    totalDirectExpenses: number;
  }> {
    let totalDirectIncome = 0;
    let totalIndirectExpenses = 0;
    let totalDirectExpenses = 0;
    
    try {
      // Get incomes and expenses in parallel
      const [incomes, expenses] = await Promise.all([
        this.expenseService.getIncomesByDateRange(startDate, endDate),
        this.expenseService.getExpensesByDateRange(startDate, endDate)
      ]);

      // Process incomes - use the imported type directly
      incomes.forEach((income) => {
        // Add null check for income object
        if (income && income.id) {
          const amount = income.totalAmount || 0;
          const type = income['incomeType'] || income.type || '';
          
          if (type.toLowerCase() === 'direct') {
            totalDirectIncome += amount;
          }
        }
      });

      // Process expenses - use the imported type directly
      expenses.forEach((expense) => {
        // Add null check for expense object
        if (expense && expense.id) {
          const amount = expense.totalAmount || 0;
          const type = expense.expenseType || expense.type || '';
          
          if (type.toLowerCase() === 'direct') {
            totalDirectExpenses += amount;
          } else {
            totalIndirectExpenses += amount;
          }
        }
      });

      console.log('Income/Expense summary:', {
        directIncome: totalDirectIncome,
        directExpenses: totalDirectExpenses,
        indirectExpenses: totalIndirectExpenses
      });

    } catch (error) {
      console.error('Error fetching income/expense data:', error);
      throw new Error(`Failed to fetch income/expense data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    return { 
      totalDirectIncome, 
      totalIndirectExpenses,
      totalDirectExpenses
    };
  }
}