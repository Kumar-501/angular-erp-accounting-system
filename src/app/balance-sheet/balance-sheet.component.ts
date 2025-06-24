// balance-sheet.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { AccountService } from '../services/account.service';
import { ProfitLossService } from '../services/profit-loss.service';
import { ExpenseService } from '../services/expense.service';
import { SaleService } from '../services/sale.service';
import { PurchaseService } from '../services/purchase.service';
import { StockService } from '../services/stock.service';
import { Firestore, collection, getDocs, query, where, orderBy } from '@angular/fire/firestore';
import { Subscription, interval } from 'rxjs';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

interface BalanceSheetItem {
  name: string;
  accountNumber: string;
  value: number;
  accountHead: string;
  isRealtimeData?: boolean;
}

interface BalanceSheetData {
  equity: BalanceSheetItem[];
  liabilities: BalanceSheetItem[];
  assets: BalanceSheetItem[];
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
  balanceSheetDate: string = new Date().toISOString().split('T')[0];
  balanceSheetData: BalanceSheetData = {
    equity: [],
    liabilities: [],
    assets: [],
    totals: {
      equity: 0,
      liabilities: 0,
      assets: 0
    }
  };
  profitLossData: any = null;
  isLoading = false;
  errorMessage = '';
  autoRefreshEnabled = true;
  refreshInterval = 5; // minutes
  
  private refreshSubscription?: Subscription;
  private readonly COMPANY_NAME = 'HERBALY TOUCH AYURVEDA PRODUCTS PRIVATE LIMITED';
  constructor(
    private accountService: AccountService,
    private profitLossService: ProfitLossService,
    private expenseService: ExpenseService,
    private saleService: SaleService,
    private purchaseService: PurchaseService,
    private stockService: StockService,
    private firestore: Firestore
  ) {}

  async ngOnInit(): Promise<void> {
    await this.generateBalanceSheet();
    this.startAutoRefresh();
  }

  ngOnDestroy(): void {
    this.stopAutoRefresh();
  }

  /**
   * Start auto-refresh timer
   */
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

  /**
   * Stop auto-refresh timer
   */
  private stopAutoRefresh(): void {
    if (this.refreshSubscription) {
      this.refreshSubscription.unsubscribe();
      this.refreshSubscription = undefined;
    }
  }

  /**
   * Toggle auto-refresh
   */
  toggleAutoRefresh(): void {
    this.autoRefreshEnabled = !this.autoRefreshEnabled;
    
    if (this.autoRefreshEnabled) {
      this.startAutoRefresh();
    } else {
      this.stopAutoRefresh();
    }
  }

  /**
   * Manual refresh
   */
  async manualRefresh(): Promise<void> {
    await this.generateBalanceSheet(true);
  }

  /**
   * Generate balance sheet with real-time profit/loss data
   */
  async generateBalanceSheet(forceRefresh = false): Promise<void> {
    this.isLoading = true;
    this.errorMessage = '';
    
    // Reset balance sheet data
    this.balanceSheetData = {
      equity: [],
      liabilities: [],
      assets: [],
      totals: {
        equity: 0,
        liabilities: 0,
        assets: 0
      },
      lastUpdated: new Date()
    };

    try {
      console.log('Generating balance sheet with real-time data...');

      // Load accounts and profit/loss data in parallel
      const [accounts, profitLossData] = await Promise.all([
        this.getAllAccounts(),
        this.loadRealtimeProfitLossData(forceRefresh)
      ]);
      
      // Categorize accounts into balance sheet sections
      this.categorizeAccounts(accounts);      // Add real-time profit/loss to equity
      if (profitLossData && profitLossData.netProfit !== undefined) {
        this.addProfitLossToEquity(profitLossData);
        this.balanceSheetData.profitLossLastUpdated = profitLossData.lastUpdated;
      }
      
      // Always try to add calculated profit/loss to balance the sheet if needed
      // (the method now checks internally if real-time P&L was already added)
      this.addCalculatedProfitLoss();

      // Validate balance sheet
      this.validateBalanceSheet();

      console.log('Balance sheet generated successfully:', this.balanceSheetData);
    } catch (error) {
      console.error('Error generating balance sheet:', error);
      this.errorMessage = `Failed to generate balance sheet: ${error instanceof Error ? error.message : 'Unknown error'}`;
    } finally {
      this.isLoading = false;
    }
  }  /**
   * Load real-time profit/loss data using the same calculation as ProfitLossComponent
   */
  private async loadRealtimeProfitLossData(forceRefresh = false): Promise<any> {
    try {
      const endDate = new Date(this.balanceSheetDate);
      const startDate = new Date(endDate.getFullYear(), 0, 1); // Fiscal year start
      
      console.log('Loading real-time profit/loss data for period:', {
        start: startDate.toDateString(),
        end: endDate.toDateString(),
        forceRefresh
      });
      
      // Use the same calculation approach as ProfitLossComponent
      const profitLossData = await this.calculateProfitLossData(startDate, endDate);
      
      console.log('Real-time profit/loss data loaded using direct calculation:', {
        netProfit: profitLossData.netProfit,
        grossProfit: profitLossData.grossProfit,
        isRealtimeData: profitLossData.isRealtimeData,
        lastUpdated: profitLossData.lastUpdated
      });
      
      this.profitLossData = profitLossData;
      return profitLossData;
    } catch (error) {
      console.error('Error loading real-time profit/loss data:', error);
      this.profitLossData = null;
      return null;
    }
  }

  /**
   * Calculate profit/loss data using the same method as ProfitLossComponent
   */
  private async calculateProfitLossData(startDate: Date, endDate: Date): Promise<any> {
    try {
      // Initialize profit loss data structure
      const profitLossData = {
        openingStock: 0,
        purchases: 0,
        purchaseReturns: 0,
        directExpenses: 0,
        closingStock: 0,
        sales: 0,
        salesReturns: 0,
        directIncome: 0,
        indirectExpenses: 0,
        indirectIncome: 0
      };

      // Load data using the same methods as ProfitLossComponent
      await Promise.all([
        this.loadStockDataForPL(startDate, endDate, profitLossData),
        this.loadTransactionDataForPL(startDate, endDate, profitLossData),
        this.loadExpenseDataForPL(startDate, endDate, profitLossData)
      ]);      // Calculate gross and net profit using same formulas as ProfitLossComponent
      const netSales = profitLossData.sales - profitLossData.salesReturns;
      const netPurchases = profitLossData.purchases - profitLossData.purchaseReturns;
      const costOfGoodsSold = profitLossData.openingStock + netPurchases + profitLossData.directExpenses - profitLossData.closingStock;
      const totalDirectIncome = netSales + profitLossData.directIncome;
      
      const grossProfit = totalDirectIncome - costOfGoodsSold;
      const netProfit = grossProfit + profitLossData.indirectIncome - profitLossData.indirectExpenses;

      // Debug logging
      console.log('Balance Sheet P&L Calculation Debug:', {
        netSales,
        netPurchases,
        costOfGoodsSold,
        totalDirectIncome,
        grossProfit,
        indirectIncome: profitLossData.indirectIncome,
        indirectExpenses: profitLossData.indirectExpenses,
        netProfit
      });

      return {
        netProfit: netProfit,
        grossProfit: grossProfit,
        sales: netSales,
        purchases: netPurchases,
        directExpenses: profitLossData.directExpenses,
        indirectExpenses: profitLossData.indirectExpenses,
        directIncome: profitLossData.directIncome,
        indirectIncome: profitLossData.indirectIncome,
        openingStock: profitLossData.openingStock,
        closingStock: profitLossData.closingStock,
        reportDate: {
          start: startDate,
          end: endDate
        },
        isRealtimeData: true,
        lastUpdated: new Date()
      };
    } catch (error) {
      console.error('Error calculating profit/loss data:', error);
      throw error;
    }
  }

  private async loadStockDataForPL(startDate: Date, endDate: Date, profitLossData: any): Promise<void> {
    try {
      // Get opening stock (end of day before start date)
      const openingDate = new Date(startDate);
      openingDate.setDate(openingDate.getDate() - 1);
      openingDate.setHours(23, 59, 59, 999);
      
      // Get closing stock (end of end date)
      const closingDate = new Date(endDate);
      closingDate.setHours(23, 59, 59, 999);
      
      const [openingStock, closingStock] = await Promise.all([
        this.getStockValueForPL(openingDate, 'opening'),
        this.getStockValueForPL(closingDate, 'closing')
      ]);

      profitLossData.openingStock = openingStock;
      profitLossData.closingStock = closingStock;
    } catch (error) {
      console.error('Error loading stock data for P&L:', error);
      profitLossData.openingStock = 0;
      profitLossData.closingStock = 0;
    }
  }

  private async getStockValueForPL(date: Date, type: 'opening'|'closing'): Promise<number> {
    try {
      const productStockCollection = collection(this.firestore, 'product-stock');
      const querySnapshot = await getDocs(productStockCollection);
      
      let totalStockValue = 0;
      
      for (const doc of querySnapshot.docs) {
        const stockData = doc.data();
        const quantity = stockData['quantity'] || 0;
        let unitCost = stockData['unitCost'] || 0;
        
        // Apply realistic validation - if unit cost seems too high, cap it
        if (unitCost > 10000) {
          unitCost = Math.min(unitCost, 1000); // Cap at ₹1000 per unit for P&L accuracy
        }
        
        const stockValue = quantity * unitCost;
        totalStockValue += stockValue;
      }
      
      return totalStockValue;
    } catch (error) {
      console.error(`Error getting ${type} stock value:`, error);
      return 0;
    }
  }

  private async loadTransactionDataForPL(startDate: Date, endDate: Date, profitLossData: any): Promise<void> {
    try {
      const adjustedStartDate = new Date(startDate);
      adjustedStartDate.setHours(0, 0, 0, 0);
      
      const adjustedEndDate = new Date(endDate);
      adjustedEndDate.setHours(23, 59, 59, 999);

      const [purchases, sales] = await Promise.all([
        this.getPurchasesForPL(adjustedStartDate, adjustedEndDate),
        this.getSalesForPL(adjustedStartDate, adjustedEndDate)
      ]);
      
      profitLossData.purchases = purchases;
      profitLossData.sales = sales;

      const [purchaseReturns, salesReturns] = await Promise.all([
        this.getPurchaseReturnsForPL(adjustedStartDate, adjustedEndDate),
        this.getSalesReturnsForPL(adjustedStartDate, adjustedEndDate)
      ]);
      
      profitLossData.purchaseReturns = purchaseReturns;
      profitLossData.salesReturns = salesReturns;
    } catch (error) {
      console.error('Error loading transaction data for P&L:', error);
    }
  }

  private async getSalesForPL(startDate: Date, endDate: Date): Promise<number> {
    try {
      const salesCollection = collection(this.firestore, 'sales');
      const q = query(
        salesCollection,
        where('createdAt', '>=', startDate),
        where('createdAt', '<=', endDate),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      let totalSales = 0;
      
      querySnapshot.docs.forEach(doc => {
        const saleData = doc.data();
        const saleAmount = saleData['paymentAmount'] || saleData['itemsTotal'] || saleData['totalAmount'] || saleData['total'] || 0;
        totalSales += Number(saleAmount) || 0;
      });
      
      return totalSales;
    } catch (error) {
      console.error('Error getting sales for P&L:', error);
      return 0;
    }
  }
  private async getPurchasesForPL(startDate: Date, endDate: Date): Promise<number> {
    try {
      const purchasesCollection = collection(this.firestore, 'purchases');
      const q = query(
        purchasesCollection,
        where('createdAt', '>=', startDate),
        where('createdAt', '<=', endDate),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      let totalPurchases = 0;
      
      querySnapshot.docs.forEach(doc => {
        const purchaseData = doc.data();
        
        // Use productsSubtotal first (value without GST), then fall back to other amount fields
        let purchaseAmount = purchaseData['productsSubtotal'] || purchaseData['purchaseTotal'] || purchaseData['grandTotal'] || purchaseData['totalAmount'] || purchaseData['total'] || 0;
        
        // If using purchaseTotal or grandTotal, try to subtract tax to get the actual purchase value
        if (!purchaseData['productsSubtotal'] && (purchaseData['purchaseTotal'] || purchaseData['grandTotal'])) {
          const totalTax = purchaseData['totalTax'] || 
                          (purchaseData['cgst'] || 0) + (purchaseData['sgst'] || 0) + (purchaseData['igst'] || 0);
          if (totalTax > 0) {
            purchaseAmount = (purchaseData['purchaseTotal'] || purchaseData['grandTotal']) - totalTax;
            console.log(`Balance Sheet - Adjusted purchase amount by removing tax: Original: ${purchaseData['purchaseTotal'] || purchaseData['grandTotal']}, Tax: ${totalTax}, Net: ${purchaseAmount}`);
          }
        }
        
        totalPurchases += Number(purchaseAmount) || 0;
        console.log('Balance Sheet - Purchase amount (excluding GST):', purchaseAmount, 'Reference:', purchaseData['referenceNo'] || purchaseData['invoiceNo']);
      });
      
      console.log('Balance Sheet - Total purchases (excluding GST):', totalPurchases);
      return totalPurchases;
    } catch (error) {
      console.error('Error getting purchases for P&L:', error);
      return 0;
    }
  }

  private async getSalesReturnsForPL(startDate: Date, endDate: Date): Promise<number> {
    try {
      // Add sales returns logic here if needed
      return 0;
    } catch (error) {
      console.error('Error getting sales returns for P&L:', error);
      return 0;
    }
  }

  private async getPurchaseReturnsForPL(startDate: Date, endDate: Date): Promise<number> {
    try {
      // Add purchase returns logic here if needed
      return 0;
    } catch (error) {
      console.error('Error getting purchase returns for P&L:', error);
      return 0;
    }
  }
  private async loadExpenseDataForPL(startDate: Date, endDate: Date, profitLossData: any): Promise<void> {
    try {
      const adjustedStartDate = new Date(startDate);
      adjustedStartDate.setHours(0, 0, 0, 0);
      
      const adjustedEndDate = new Date(endDate);
      adjustedEndDate.setHours(23, 59, 59, 999);

      const [transactionIncome, expensesData] = await Promise.all([
        this.getIncomeFromTransactionsForPL(adjustedStartDate, adjustedEndDate),
        this.getExpensesDataForPL(adjustedStartDate, adjustedEndDate)
      ]);

      profitLossData.directIncome = transactionIncome;
      profitLossData.directExpenses = expensesData.directExpenses;
      profitLossData.indirectExpenses = expensesData.indirectExpenses;
      profitLossData.indirectIncome = 0; // For now, treat all income as direct

      console.log('Balance Sheet Expense/Income Data Loaded:', {
        directIncome: profitLossData.directIncome,
        directExpenses: profitLossData.directExpenses,
        indirectExpenses: profitLossData.indirectExpenses,
        indirectIncome: profitLossData.indirectIncome
      });
    } catch (error) {
      console.error('Error loading expense data for P&L:', error);
    }
  }

  private async getIncomeFromTransactionsForPL(startDate: Date, endDate: Date): Promise<number> {
    try {
      const transactionsCollection = collection(this.firestore, 'transactions');
      const q = query(
        transactionsCollection,
        where('date', '>=', startDate),
        where('date', '<=', endDate)
      );
      
      const querySnapshot = await getDocs(q);
      let totalIncome = 0;
      
      querySnapshot.docs.forEach(doc => {
        const data = doc.data();
        const type = data['type'] || '';
        const description = data['description'] || '';
        const credit = data['credit'] || 0;
        
        const isIncome = (type === 'income' || 
                         description.toLowerCase().includes('income:') ||
                         (credit > 0 && !description.toLowerCase().includes('expense'))) &&
                         !description.toLowerCase().includes('expense');
        
        if (isIncome) {
          totalIncome += Number(credit) || 0;
        }
      });
      
      return totalIncome;
    } catch (error) {
      console.error('Error getting income from transactions for P&L:', error);
      return 0;
    }
  }
  private async getExpensesDataForPL(startDate: Date, endDate: Date): Promise<{directExpenses: number, indirectExpenses: number}> {
    try {
      // Get expenses from both collections and transactions, similar to ProfitLossComponent
      const [transactionExpenses, expensesCollectionData] = await Promise.all([
        this.getExpensesFromTransactionsForPL(startDate, endDate),
        this.getExpensesFromCollectionForPL(startDate, endDate)
      ]);

      // Combine all expenses avoiding duplicates
      const allExpenses = [...transactionExpenses];
      
      // Add expenses from the expenses collection that don't appear to be duplicated in transactions
      for (const expense of expensesCollectionData) {
        const referenceNo = expense.referenceNo || '';
        const isDuplicate = transactionExpenses.some(txExpense => {
          const txReference = txExpense.reference || txExpense.referenceNo || '';
          return txReference && referenceNo && txReference === referenceNo;
        });
        
        if (!isDuplicate) {
          allExpenses.push(expense);
        }
      }

      let directExpenses = 0;
      let indirectExpenses = 0;
      
      allExpenses.forEach(expense => {
        const amount = expense.totalAmount || expense.amount || 0;
        const accountHead = expense.accountHead || '';
        const categoryName = expense.categoryName || expense.expenseFor || '';
        
        // Check if it's a direct expense
        if (accountHead.includes('Direct') || this.isDirectExpenseForPL(categoryName)) {
          directExpenses += Number(amount) || 0;
        } else {
          indirectExpenses += Number(amount) || 0;
        }
      });

      console.log('Balance Sheet Expense Data:', {
        transactionExpenses: transactionExpenses.length,
        expensesCollectionData: expensesCollectionData.length,
        totalCombined: allExpenses.length,
        directExpenses,
        indirectExpenses
      });
      
      return { directExpenses, indirectExpenses };
    } catch (error) {
      console.error('Error getting expenses data for P&L:', error);
      return { directExpenses: 0, indirectExpenses: 0 };
    }
  }

  private async getExpensesFromTransactionsForPL(startDate: Date, endDate: Date): Promise<any[]> {
    try {
      const transactionsCollection = collection(this.firestore, 'transactions');
      const q = query(
        transactionsCollection,
        where('date', '>=', startDate),
        where('date', '<=', endDate)
      );
      
      const querySnapshot = await getDocs(q);
      const expenses: any[] = [];
      
      querySnapshot.docs.forEach(doc => {
        const data = doc.data();
        const type = data['type'] || '';
        const description = data['description'] || '';
        const debit = data['debit'] || 0;
        const credit = data['credit'] || 0;
        
        // Check if this is an expense transaction (but NOT a purchase)
        const isExpense = type === 'expense' && 
                         !description.toLowerCase().includes('purchase') &&
                         !description.toLowerCase().includes('pur-') &&
                         !description.toLowerCase().includes('payment for purchase');
        
        if (isExpense) {
          const amount = debit > 0 ? debit : credit;
          expenses.push({
            id: doc.id,
            ...data,
            amount: Number(amount) || 0,
            totalAmount: Number(amount) || 0,
            entryType: 'expense',
            source: 'transactions'
          });
        }
      });
      
      return expenses;
    } catch (error) {
      console.error('Error getting expenses from transactions for P&L:', error);
      return [];
    }
  }

  private async getExpensesFromCollectionForPL(startDate: Date, endDate: Date): Promise<any[]> {
    try {
      const expensesCollection = collection(this.firestore, 'expenses');
      const q = query(
        expensesCollection,
        where('date', '>=', startDate),
        where('date', '<=', endDate),
        where('entryType', '==', 'expense')
      );
      
      const querySnapshot = await getDocs(q);
      const expenses: any[] = [];
      
      querySnapshot.docs.forEach(doc => {
        const data = doc.data();
        const amount = data['totalAmount'] || data['paymentAmount'] || 0;
        
        expenses.push({
          id: doc.id,
          ...data,
          amount: Number(amount) || 0,
          totalAmount: Number(amount) || 0,
          source: 'expenses-collection'
        });
      });
      
      return expenses;
    } catch (error) {
      console.error('Error getting expenses from collection for P&L:', error);
      return [];
    }
  }

  private isDirectExpenseForPL(categoryName: string): boolean {
    const directCategories = [
      'cost of goods sold',
      'cogs',
      'raw materials',
      'manufacturing',
      'production',
      'direct labor',
      'direct materials',
      'purchase',
      'inventory'
    ];
    
    const category = categoryName.toLowerCase();
    return directCategories.some(direct => category.includes(direct));
  }

  /**
   * Helper method to format date for input
   */
  private formatDateForInput(date: Date): string {
    return date.toISOString().split('T')[0];
  }
  /**
   * Categorize accounts into balance sheet sections
   */
  private categorizeAccounts(accounts: any[]): void {
    accounts.forEach(account => {
      if (account.accountHead?.group) {
        const group = account.accountHead.group.toLowerCase();
        const value = account.openingBalance || 0;
        
        // Skip profit/loss related accounts as they will be handled separately
        const accountName = account.name.toLowerCase();
        if (accountName.includes('profit') || 
            accountName.includes('loss') || 
            accountName.includes('retained earnings') || 
            accountName.includes('accumulated')) {
          console.log(`Skipping profit/loss account from categorization: ${account.name}`);
          return;
        }
        
        const balanceSheetItem: BalanceSheetItem = {
          name: account.name,
          accountNumber: account.accountNumber || '',
          value: value,
          accountHead: account.accountHead.value || account.accountHead.group
        };
        
        console.log(`Categorizing account: ${account.name} -> ${group}`);
        
        switch (group) {
          case 'equity':
            this.addAccountToSection('equity', balanceSheetItem);
            break;
          case 'liabilities':
            this.addAccountToSection('liabilities', balanceSheetItem);
            break;
          case 'asset':
          case 'assets':
            this.addAccountToSection('assets', balanceSheetItem);
            break;
          default:
            console.warn(`Unknown account group: ${group} for account: ${account.name}`);
        }
      } else {
        console.warn(`Account missing accountHead.group: ${account.name}`);
      }
    });
  }

  /**
   * Add account to specific section
   */
  private addAccountToSection(section: keyof Pick<BalanceSheetData, 'equity' | 'liabilities' | 'assets'>, item: BalanceSheetItem): void {
    this.balanceSheetData[section].push(item);
    this.balanceSheetData.totals[section] += item.value;
  }  /**
   * Add real-time profit/loss to equity section
   */
  private addProfitLossToEquity(profitLossData: any): void {
    const profitLossValue = profitLossData.netProfit || 0;
    
    console.log('Adding profit/loss to equity:', {
      profitLossData,
      netProfit: profitLossData.netProfit,
      grossProfit: profitLossData.grossProfit,
      profitLossValue
    });
    
    if (profitLossValue !== 0) {
      const profitLossItem: BalanceSheetItem = {
        name: profitLossValue >= 0 ? 'Retained Earnings (Profit)' : 'Accumulated Loss',
        accountNumber: '',
        value: profitLossValue,
        accountHead: 'Profit & Loss',
        isRealtimeData: profitLossData.isRealtimeData
      };
      
      this.addAccountToSection('equity', profitLossItem);
      console.log(`Added ${profitLossValue >= 0 ? 'profit' : 'loss'} to equity: ${this.formatCurrency(profitLossValue)}`);
    }
  }
  /**
   * Add calculated profit/loss to balance the sheet (only if no real-time P&L was added)
   */
  private addCalculatedProfitLoss(): void {
    // Check if we already have any profit/loss entry 
    const hasProfitLossEntry = this.balanceSheetData.equity.some(item => 
      item.accountHead === 'Profit & Loss' || 
      item.name.toLowerCase().includes('profit') || 
      item.name.toLowerCase().includes('loss') ||
      item.name.toLowerCase().includes('retained earnings') ||
      item.name.toLowerCase().includes('accumulated')
    );
    
    if (hasProfitLossEntry) {
      console.log('Profit/loss entry already exists, skipping calculated profit/loss');
      return;
    }
    
    const profitLoss = this.balanceSheetData.totals.assets - 
                      (this.balanceSheetData.totals.liabilities + this.balanceSheetData.totals.equity);
    
    if (Math.abs(profitLoss) > 0.01) { // Only add if significant difference
      const calculatedItem: BalanceSheetItem = {
        name: profitLoss >= 0 ? 'Profit & Loss (Calculated)' : 'Accumulated Loss (Calculated)',
        accountNumber: '',
        value: profitLoss,
        accountHead: 'Calculated P&L'
      };
      
      this.addAccountToSection('equity', calculatedItem);
      console.warn(`Added calculated profit/loss to balance sheet: ${this.formatCurrency(profitLoss)}`);
    }
  }

  /**
   * Validate that the balance sheet balances
   */
  private validateBalanceSheet(): void {
    const totalEquityAndLiabilities = this.balanceSheetData.totals.equity + this.balanceSheetData.totals.liabilities;
    const totalAssets = this.balanceSheetData.totals.assets;
    const difference = Math.abs(totalAssets - totalEquityAndLiabilities);
    
    if (difference > 0.01) {
      console.warn(`Balance sheet does not balance! Difference: ${this.formatCurrency(difference)}`);
      this.errorMessage = `Warning: Balance sheet does not balance. Difference: ${this.formatCurrency(difference)}`;
    } else {
      console.log('Balance sheet validates successfully');
    }
  }

  /**
   * Get all accounts from Firestore
   */
  private async getAllAccounts(): Promise<any[]> {
    try {
      const accountsRef = collection(this.firestore, 'accounts');
      const snapshot = await getDocs(accountsRef);
      const accounts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log(`Fetched ${accounts.length} accounts`);
      return accounts;
    } catch (error) {
      console.error('Error fetching accounts:', error);
      throw new Error(`Failed to fetch accounts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Format currency value
   */
  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(value);
  }

  /**
   * Get balance sheet status
   */
  getBalanceSheetStatus(): string {
    if (this.isLoading) return 'Loading...';
    if (this.errorMessage) return 'Error';
    
    const totalEquityAndLiabilities = this.balanceSheetData.totals.equity + this.balanceSheetData.totals.liabilities;
    const totalAssets = this.balanceSheetData.totals.assets;
    const difference = Math.abs(totalAssets - totalEquityAndLiabilities);
    
    if (difference > 0.01) return 'Unbalanced';
    return 'Balanced';
  }

  exportToExcel(): void {
    try {
      // Prepare data for Excel
      const excelData = [
        ['HERBALY TOUCH AYURVEDA PRODUCTS PRIVATE LIMITED', '', '', ''],
        ['Balance Sheet', '', '', ''],
        [`As on ${new Date(this.balanceSheetDate).toLocaleDateString()}`, '', '', ''],
        ['', '', '', ''],
        ['Equity', '', '', ''],
        ...this.balanceSheetData.equity.map((item: { name: any; accountNumber: any; accountHead: any; value: number; }) => [
          item.name, 
          item.accountNumber, 
          item.accountHead, 
          this.formatCurrency(item.value)
        ]),
        ['Total Equity', '', '', this.formatCurrency(this.balanceSheetData.totals.equity)],
        ['', '', '', ''],
        ['Liabilities', '', '', ''],
        ...this.balanceSheetData.liabilities.map((item: { name: any; accountNumber: any; accountHead: any; value: number; }) => [
          item.name, 
          item.accountNumber, 
          item.accountHead, 
          this.formatCurrency(item.value)
        ]),
        ['Total Liabilities', '', '', this.formatCurrency(this.balanceSheetData.totals.liabilities)],
        ['', '', '', ''],
        ['Assets', '', '', ''],
        ...this.balanceSheetData.assets.map((item: { name: any; accountNumber: any; accountHead: any; value: number; }) => [
          item.name, 
          item.accountNumber, 
          item.accountHead, 
          this.formatCurrency(item.value)
        ]),
        ['Total Assets', '', '', this.formatCurrency(this.balanceSheetData.totals.assets)]
      ];

      // Create worksheet
      const worksheet = XLSX.utils.aoa_to_sheet(excelData);
      
      // Create workbook
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Balance Sheet');
      
      // Generate file name
      const fileName = `Herbaly_Touch_Balance_Sheet_${this.balanceSheetDate}.xlsx`;
      
      // Export to Excel
      XLSX.writeFile(workbook, fileName);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Error exporting to Excel. Please try again.');
    }
  }

  exportToPDF(): void {
    try {
      // Create new PDF document in portrait mode
      const doc = new jsPDF('p', 'pt');
      
      // Add title
      doc.setFontSize(16);
      doc.setTextColor(40, 40, 40);
      doc.text('HERBALY TOUCH AYURVEDA PRODUCTS PRIVATE LIMITED', 40, 40);
      doc.setFontSize(14);
      doc.text('Balance Sheet', 40, 60);
      doc.setFontSize(12);
      doc.text(`As on ${new Date(this.balanceSheetDate).toLocaleDateString()}`, 40, 80);
      
      // Add Equity section
      doc.setFontSize(14);
      doc.text('Equity', 40, 120);
      doc.setFontSize(10);
      
      const equityData = this.balanceSheetData.equity.map((item: { name: any; accountNumber: any; accountHead: any; value: number; }) => [
        item.name,
        item.accountNumber,
        item.accountHead,
        this.formatCurrency(item.value)
      ]);
      
      equityData.push([
        'Total Equity', '', '', this.formatCurrency(this.balanceSheetData.totals.equity)
      ]);
      
      (doc as any).autoTable({
        startY: 130,
        head: [['Account Name', 'Account Number', 'Account Head', 'Amount']],
        body: equityData,
        styles: {
          fontSize: 8,
          cellPadding: 5
        },
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: 255,
          fontStyle: 'bold'
        }
      });
      
      // Add Liabilities section
      doc.setFontSize(14);
      (doc as any).lastAutoTable.finalY || 130;
      doc.text('Liabilities', 40, (doc as any).lastAutoTable.finalY + 30);
      doc.setFontSize(10);
      
      const liabilitiesData = this.balanceSheetData.liabilities.map((item: { name: any; accountNumber: any; accountHead: any; value: number; }) => [
        item.name,
        item.accountNumber,
        item.accountHead,
        this.formatCurrency(item.value)
      ]);
      
      liabilitiesData.push([
        'Total Liabilities', '', '', this.formatCurrency(this.balanceSheetData.totals.liabilities)
      ]);
      
      (doc as any).autoTable({
        startY: (doc as any).lastAutoTable.finalY + 40,
        head: [['Account Name', 'Account Number', 'Account Head', 'Amount']],
        body: liabilitiesData,
        styles: {
          fontSize: 8,
          cellPadding: 5
        },
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: 255,
          fontStyle: 'bold'
        }
      });
      
      // Add Assets section
      doc.setFontSize(14);
      doc.text('Assets', 40, (doc as any).lastAutoTable.finalY + 30);
      doc.setFontSize(10);
      
      const assetsData = this.balanceSheetData.assets.map((item: { name: any; accountNumber: any; accountHead: any; value: number; }) => [
        item.name,
        item.accountNumber,
        item.accountHead,
        this.formatCurrency(item.value)
      ]);
      
      assetsData.push([
        'Total Assets', '', '', this.formatCurrency(this.balanceSheetData.totals.assets)
      ]);
      
      (doc as any).autoTable({
        startY: (doc as any).lastAutoTable.finalY + 40,
        head: [['Account Name', 'Account Number', 'Account Head', 'Amount']],
        body: assetsData,
        styles: {
          fontSize: 8,
          cellPadding: 5
        },
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: 255,
          fontStyle: 'bold'
        }
      });
      
      // Add summary
      doc.setFontSize(12);
      doc.text('Summary', 40, (doc as any).lastAutoTable.finalY + 30);
      
      const summaryData = [
        ['Total Equity', this.formatCurrency(this.balanceSheetData.totals.equity)],
        ['Total Liabilities', this.formatCurrency(this.balanceSheetData.totals.liabilities)],
        ['Total Equity + Liabilities', this.formatCurrency(this.balanceSheetData.totals.equity + this.balanceSheetData.totals.liabilities)],
        ['Total Assets', this.formatCurrency(this.balanceSheetData.totals.assets)]
      ];
      
      (doc as any).autoTable({
        startY: (doc as any).lastAutoTable.finalY + 40,
        body: summaryData,
        styles: {
          fontSize: 10,
          cellPadding: 5
        },
        columnStyles: {
          1: { fontStyle: 'bold' }
        }
      });
      
      // Save the PDF
      doc.save(`Herbaly_Touch_Balance_Sheet_${this.balanceSheetDate}.pdf`);
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      alert('Error exporting to PDF. Please try again.');
    }
  }

  printBalanceSheet(): void {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Popup was blocked. Please allow popups for this site to print.');
      return;
    }

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Balance Sheet - HERBALY TOUCH AYURVEDA PRODUCTS PRIVATE LIMITED</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1, h2 { color: #333; }
          .header { text-align: center; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          .total-row { font-weight: bold; }
          .section-title { margin-top: 20px; font-weight: bold; }
          .text-right { text-align: right; }
          @media print {
            @page { size: portrait; margin: 10mm; }
            body { margin: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>HERBALY TOUCH AYURVEDA PRODUCTS PRIVATE LIMITED</h1>
          <h2>Balance Sheet</h2>
          <p>As on ${new Date(this.balanceSheetDate).toLocaleDateString()}</p>
        </div>
        
        <div class="section-title">Equity</div>
        <table>
          <thead>
            <tr>
              <th>Account Name</th>
              <th>Account Number</th>
              <th>Account Head</th>
              <th class="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${this.balanceSheetData.equity.map((item: { name: any; accountNumber: any; accountHead: any; value: number; }) => `
              <tr>
                <td>${item.name}</td>
                <td>${item.accountNumber}</td>
                <td>${item.accountHead}</td>
                <td class="text-right">${this.formatCurrency(item.value)}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="3">Total Equity</td>
              <td class="text-right">${this.formatCurrency(this.balanceSheetData.totals.equity)}</td>
            </tr>
          </tbody>
        </table>
        
        <div class="section-title">Liabilities</div>
        <table>
          <thead>
            <tr>
              <th>Account Name</th>
              <th>Account Number</th>
              <th>Account Head</th>
              <th class="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${this.balanceSheetData.liabilities.map((item: { name: any; accountNumber: any; accountHead: any; value: number; }) => `
              <tr>
                <td>${item.name}</td>
                <td>${item.accountNumber}</td>
                <td>${item.accountHead}</td>
                <td class="text-right">${this.formatCurrency(item.value)}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="3">Total Liabilities</td>
              <td class="text-right">${this.formatCurrency(this.balanceSheetData.totals.liabilities)}</td>
            </tr>
          </tbody>
        </table>
        
        <div class="section-title">Assets</div>
        <table>
          <thead>
            <tr>
              <th>Account Name</th>
              <th>Account Number</th>
              <th>Account Head</th>
              <th class="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${this.balanceSheetData.assets.map((item: { name: any; accountNumber: any; accountHead: any; value: number; }) => `
              <tr>
                <td>${item.name}</td>
                <td>${item.accountNumber}</td>
                <td>${item.accountHead}</td>
                <td class="text-right">${this.formatCurrency(item.value)}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="3">Total Assets</td>
              <td class="text-right">${this.formatCurrency(this.balanceSheetData.totals.assets)}</td>
            </tr>
          </tbody>
        </table>
        
        <div class="section-title">Summary</div>
        <table>
          <tbody>
            <tr>
              <td>Total Equity</td>
              <td class="text-right">${this.formatCurrency(this.balanceSheetData.totals.equity)}</td>
            </tr>
            <tr>
              <td>Total Liabilities</td>
              <td class="text-right">${this.formatCurrency(this.balanceSheetData.totals.liabilities)}</td>
            </tr>
            <tr class="total-row">
              <td>Total Equity + Liabilities</td>
              <td class="text-right">${this.formatCurrency(this.balanceSheetData.totals.equity + this.balanceSheetData.totals.liabilities)}</td>
            </tr>
            <tr class="total-row">
              <td>Total Assets</td>
              <td class="text-right">${this.formatCurrency(this.balanceSheetData.totals.assets)}</td>
            </tr>
          </tbody>
        </table>
        
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
              window.close();
            }, 200);
          }
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(printContent);
    printWindow.document.close();
  }
}