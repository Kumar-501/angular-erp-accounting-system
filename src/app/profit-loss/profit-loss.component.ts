import { Component, OnInit } from '@angular/core';
import { SaleService } from '../services/sale.service';
import { ExpenseService } from '../services/expense.service';
import { PurchaseService } from '../services/purchase.service';
import { StockService } from '../services/stock.service';
import { DailyStockService } from '../services/daily-stock.service';
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
    private dailyStockService: DailyStockService,
    private datePipe: DatePipe,
    private firestore: Firestore,
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
    date.setDate(date.getDate() - 7); // Use last 7 days instead of 30
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
    XLSX.writeFile(wb, `ProfitLoss_${this.today.toISOString().slice(0, 10)}.xlsx`);
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
  } async loadData(): Promise<void> {
    if (!this.dateRangeForm.valid) {
      this.errorMessage = 'Please select valid start and end dates';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    try {
      // Debug collection data first
      await this.debugCollectionData();

      const { startDate, endDate } = this.validateAndParseDates();
      this.currentDateRange = this.createDateRangeString(startDate, endDate);

      console.log('Loading P&L data for date range:', { startDate, endDate });

      this.resetProfitLossData();

      await Promise.all([
        this.loadStockData(startDate, endDate),
        this.loadTransactionData(startDate, endDate),
        this.loadExpenseData(startDate, endDate)
      ]);

      console.log('Final Profit & Loss Data:', this.profitLossData);
      console.log('Calculated values:', {
        grossProfit: this.grossProfit,
        netProfit: this.netProfit,
        netSales: this.netSales,
        netPurchases: this.netPurchases,
        costOfGoodsSold: this.costOfGoodsSold
      });
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

  // Load stock data using dailyStockSnapshot collection
  private async loadStockData(startDate: Date, endDate: Date): Promise<void> {
    try {
      console.log('Loading stock data from dailyStockSnapshot collection...');

      // Get opening stock (from day before start date, or earliest available)
      const openingDate = new Date(startDate);
      openingDate.setDate(openingDate.getDate() - 1);

      // Get closing stock (from end date, or latest available)
      const closingDate = new Date(endDate);

      const [openingStock, closingStock] = await Promise.all([
        this.getStockValueFromSnapshots(openingDate, 'opening'),
        this.getStockValueFromSnapshots(closingDate, 'closing')
      ]);

      this.profitLossData.openingStock = openingStock;
      this.profitLossData.closingStock = closingStock;

      console.log('Stock values from dailyStockSnapshot:', {
        opening: this.profitLossData.openingStock,
        closing: this.profitLossData.closingStock
      });
    } catch (error) {
      console.error('Error loading stock data from dailyStockSnapshot:', error);
      // Fallback to 0 values
      this.profitLossData.openingStock = 0;
      this.profitLossData.closingStock = 0;
    }
  }

  /**
   * Get stock value from dailyStockSnapshot collection combined with products collection
   */

  private async getStockValueFromSnapshots(date: Date, type: 'opening' | 'closing'): Promise<number> {
    try {
      const businessDate = this.formatDateForSnapshot(date);
      console.log(`Getting ${type} stock value for date: ${businessDate}`);

      // Get daily snapshots for the date
      const snapshotsCollection = collection(this.firestore, 'dailyStockSnapshots');
      let q = query(
        snapshotsCollection,
        where('date', '==', businessDate)
      );

      let querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        console.log(`No dailyStockSnapshots found for ${businessDate}`);
        // Fallback logic to find the closest available date...
        const allSnapshotsQuery = query(snapshotsCollection);
        const allSnapshots = await getDocs(allSnapshotsQuery);
        const availableDates: string[] = [];
        allSnapshots.docs.forEach(doc => {
          const data = doc.data();
          availableDates.push(data['date']);
        });
        availableDates.sort();
        console.log('Available dates in dailyStockSnapshots:', availableDates);

        if (availableDates.length === 0) {
          console.log('No snapshots available at all');
          return 0;
        }

        let closestDate = null;
        if (type === 'opening') {
          for (let i = availableDates.length - 1; i >= 0; i--) {
            if (availableDates[i] <= businessDate) {
              closestDate = availableDates[i];
              break;
            }
          }
          if (!closestDate) {
            closestDate = availableDates[0];
          }
        } else {
          for (let i = 0; i < availableDates.length; i++) {
            if (availableDates[i] >= businessDate) {
              closestDate = availableDates[i];
              break;
            }
          }
          if (!closestDate) {
            closestDate = availableDates[availableDates.length - 1];
          }
        }

        console.log(`Using closest available date: ${closestDate} for ${type} stock`);

        q = query(
          snapshotsCollection,
          where('date', '==', closestDate)
        );
        querySnapshot = await getDocs(q);
      }

      if (querySnapshot.empty) {
        console.log(`Still no snapshots found after fallback`);
        return 0;
      }

      // Get all products for cost price reference
      const productsCollection = collection(this.firestore, 'products');
      const productsSnapshot = await getDocs(productsCollection);
      const productsMap = new Map();

      console.log(`Found ${productsSnapshot.docs.length} products in collection`);

      // MODIFICATION START
      productsSnapshot.docs.forEach(doc => {
        const product = doc.data();
        // Per the requirement, use only the non-tax amount for stock valuation.
        // defaultPurchasePriceExcTax is the explicit "no tax amount".
        const costPrice = product['defaultPurchasePriceExcTax'] || 0;

        productsMap.set(doc.id, {
          ...product,
          costPrice: costPrice,
          productName: product['productName'] || product['name'] || 'Unknown'
        });

        // Debug log for first few products
        if (productsMap.size <= 3) {
          console.log(`Product ${doc.id}: ${product['productName'] || 'Unknown'}, Cost (using defaultPurchasePriceExcTax): ${costPrice}`);
        }
      });
      // MODIFICATION END

      console.log(`Found ${productsMap.size} products for cost calculation`);

      // Calculate total stock value
      let totalStockValue = 0;
      let processedSnapshots = 0;

      console.log(`Processing ${querySnapshot.docs.length} snapshots for ${type} stock`);
      querySnapshot.docs.forEach(doc => {
        const snapshot = doc.data();
        const productId = snapshot['productId'];
        const stockQuantity = type === 'opening' ?
          (snapshot['openingStock'] || 0) :
          (snapshot['closingStock'] || 0);

        const product = productsMap.get(productId);
        if (product && stockQuantity > 0) {
          const stockValue = stockQuantity * product.costPrice;
          totalStockValue += stockValue;
          processedSnapshots++;

          console.log(`Product ${product.productName} (${productId}): Quantity=${stockQuantity}, Cost=${product.costPrice}, Value=${stockValue}`);
        } else if (!product) {
          console.warn(`Product not found for productId: ${productId}. Available product IDs:`, Array.from(productsMap.keys()).slice(0, 5));
        } else if (stockQuantity === 0) {
          console.log(`Product ${product.productName} has zero ${type} stock`);
        }
      });

      console.log(`Processed ${processedSnapshots}/${querySnapshot.docs.length} snapshots, Total ${type} stock value: ${totalStockValue}`);
      return totalStockValue;

    } catch (error) {
      console.error(`Error getting ${type} stock value from snapshots:`, error);
      return 0;
    }
  }

  /**
   * Format date for dailyStockSnapshot collection (YYYY-MM-DD format)
   */
  private formatDateForSnapshot(date: Date): string {
    return date.toISOString().split('T')[0];
  }
  private async loadTransactionData(startDate: Date, endDate: Date): Promise<void> {
    try {
      console.log('Loading transaction data...', { startDate, endDate });

      const adjustedStartDate = new Date(startDate);
      adjustedStartDate.setHours(0, 0, 0, 0);

      const adjustedEndDate = new Date(endDate);
      adjustedEndDate.setHours(23, 59, 59, 999);

      console.log('Adjusted date range:', { adjustedStartDate, adjustedEndDate });

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
      console.log('Fetching sales data (excluding tax)', { startDate, endDate });

      const salesCollection = collection(this.firestore, 'sales');

      let querySnapshot;
      let foundData = false;

      try {
        const startDateStr = this.formatDateForSnapshot(startDate);
        const endDateStr = this.formatDateForSnapshot(endDate);

        console.log('Trying saleDate string query:', { startDateStr, endDateStr });

        const q1 = query(
          salesCollection,
          where('saleDate', '>=', startDateStr),
          where('saleDate', '<=', endDateStr)
        );
        querySnapshot = await getDocs(q1);
        if (!querySnapshot.empty) {
          foundData = true;
          console.log(`Found ${querySnapshot.docs.length} sales using saleDate (string)`);
        }
      } catch (error) {
        console.log('saleDate string query failed:', error);
      }

      // If no data with saleDate string, try saleDate as timestamp
      if (!foundData) {
        try {
          const q2 = query(
            salesCollection,
            where('saleDate', '>=', startDate),
            where('saleDate', '<=', endDate)
          );
          querySnapshot = await getDocs(q2);
          if (!querySnapshot.empty) {
            foundData = true;
            console.log(`Found ${querySnapshot.docs.length} sales using saleDate (timestamp)`);
          }
        } catch (error) {
          console.log('saleDate timestamp query failed:', error);
        }
      }

      // If no data with saleDate, try createdAt
      if (!foundData) {
        try {
          const q3 = query(
            salesCollection,
            where('createdAt', '>=', startDate),
            where('createdAt', '<=', endDate)
          );
          querySnapshot = await getDocs(q3);
          if (!querySnapshot.empty) {
            foundData = true;
            console.log(`Found ${querySnapshot.docs.length} sales using createdAt`);
          }
        } catch (error) {
          console.log('createdAt query failed:', error);
        }
      }

      // If still no data, get all sales and filter manually
      if (!foundData) {
        console.log('Getting all sales and filtering manually');
        querySnapshot = await getDocs(salesCollection);
        console.log(`Found ${querySnapshot.docs.length} total sales documents`);
      }

      if (!querySnapshot || querySnapshot.empty) {
        console.log('No sales found');
        return 0;
      }

      let totalSales = 0;
      let processedCount = 0;
      let skippedCount = 0;

      querySnapshot.docs.forEach(doc => {
        const saleData = doc.data();

        // If we got all sales, filter by date manually
        if (!foundData) {
          const saleDate = this.parseSaleDate(saleData);

          if (!saleDate || saleDate < startDate || saleDate > endDate) {
            skippedCount++;
            return; // Skip this sale
          }
        }

        let saleAmount = 0;

        // Calculate from products array if available (more accurate)
        if (saleData['products'] && Array.isArray(saleData['products'])) {
          saleAmount = saleData['products'].reduce((sum: number, product: any) => {
            const quantity = product['quantity'] || 1;
            // Use selling price excluding tax
            const unitPrice = product['sellingPriceExcTax'] || product['unitPriceExcTax'] || product['unitPrice'] || 0;
            const discount = product['discount'] || 0;
            return sum + ((unitPrice * quantity) - discount);
          }, 0);
        }

        // If no products or amount is 0, try other fields but subtract tax
        if (saleAmount === 0) {
          const totalAmount = saleData['paymentAmount'] || saleData['total'] || saleData['itemsTotal'] || 0;
          const totalTax = saleData['totalTax'] ||
            (saleData['cgst'] || 0) +
            (saleData['sgst'] || 0) +
            (saleData['igst'] || 0);

          saleAmount = totalAmount - totalTax;
        }

        // Ensure amount is positive
        saleAmount = Math.max(0, saleAmount || 0);
        totalSales += saleAmount;
        processedCount++;

        console.log('Sale (excl. tax):', {
          id: doc.id,
          amount: saleAmount,
          originalTotal: saleData['paymentAmount'] || saleData['total'],
          tax: saleData['totalTax'],
          saleDate: saleData['saleDate']
        });
      });

      console.log(`Processed ${processedCount} sales, skipped ${skippedCount}. Total sales (excluding tax):`, totalSales);
      return totalSales;
    } catch (error) {
      console.error('Error getting sales:', error);
      return 0;
    }
  }

  /**
   * Parse purchase date from various formats
   */
  private parsePurchaseDate(purchaseData: any): Date | null {
    try {
      const purchaseDate = purchaseData['purchaseDate'];

      if (!purchaseDate) {
        // Fallback to createdAt
        const createdAt = purchaseData['createdAt'];
        if (createdAt?.toDate) {
          return createdAt.toDate();
        } else if (createdAt) {
          return new Date(createdAt);
        }
        return null;
      }

      // If purchaseDate is a Firestore timestamp
      if (purchaseDate.toDate && typeof purchaseDate.toDate === 'function') {
        return purchaseDate.toDate();
      }

      // If purchaseDate is a string
      if (typeof purchaseDate === 'string') {
        return new Date(purchaseDate);
      }

      // If purchaseDate is already a Date
      if (purchaseDate instanceof Date) {
        return purchaseDate;
      }

      // Try to parse as date
      return new Date(purchaseDate);
    } catch (error) {
      console.warn('Could not parse purchase date:', purchaseData['purchaseDate'], error);
      return null;
    }
  }

  /**
   * Parse sale date from various formats
   */
  private parseSaleDate(saleData: any): Date | null {
    try {
      const saleDate = saleData['saleDate'];

      if (!saleDate) {
        // Fallback to createdAt
        const createdAt = saleData['createdAt'];
        if (createdAt?.toDate) {
          return createdAt.toDate();
        } else if (createdAt) {
          return new Date(createdAt);
        }
        return null;
      }

      // If saleDate is a Firestore timestamp
      if (saleDate.toDate && typeof saleDate.toDate === 'function') {
        return saleDate.toDate();
      }

      // If saleDate is a string
      if (typeof saleDate === 'string') {
        return new Date(saleDate);
      }

      // If saleDate is already a Date
      if (saleDate instanceof Date) {
        return saleDate;
      }

      // Try to parse as date
      return new Date(saleDate);
    } catch (error) {
      console.warn('Could not parse sale date:', saleData['saleDate'], error);
      return null;
    }
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
      console.log('Fetching purchases (excluding tax)...', { startDate, endDate });

      const purchasesCollection = collection(this.firestore, 'purchases');

      let querySnapshot;
      let foundData = false;
      try {
        const startDateStr = this.formatDateForSnapshot(startDate);
        const endDateStr = this.formatDateForSnapshot(endDate);

        console.log('Trying purchaseDate string query:', { startDateStr, endDateStr });

        const q1 = query(
          purchasesCollection,
          where('purchaseDate', '>=', startDateStr),
          where('purchaseDate', '<=', endDateStr),
          where('status', '==', 'completed')
        );
        querySnapshot = await getDocs(q1);
        if (!querySnapshot.empty) {
          foundData = true;
          console.log(`Found ${querySnapshot.docs.length} purchases using purchaseDate (string)`);
        }
      } catch (error) {
        console.log('purchaseDate string query failed:', error);
      }

      // Second try with purchaseDate as timestamp
      if (!foundData) {
        try {
          const q1b = query(
            purchasesCollection,
            where('purchaseDate', '>=', startDate),
            where('purchaseDate', '<=', endDate),
            where('status', '==', 'completed')
          );
          querySnapshot = await getDocs(q1b);
          if (!querySnapshot.empty) {
            foundData = true;
            console.log(`Found ${querySnapshot.docs.length} purchases using purchaseDate (timestamp)`);
          }
        } catch (error) {
          console.log('purchaseDate timestamp query failed, trying alternatives');
        }
      }

      // If no data with purchaseDate, try createdAt
      if (!foundData) {
        try {
          const q2 = query(
            purchasesCollection,
            where('createdAt', '>=', startDate),
            where('createdAt', '<=', endDate),
            where('status', '==', 'completed')
          );
          querySnapshot = await getDocs(q2);
          if (!querySnapshot.empty) {
            foundData = true;
            console.log(`Found ${querySnapshot.docs.length} purchases using createdAt`);
          }
        } catch (error) {
          console.log('createdAt query failed');
        }
      }

      // If still no data, get all completed purchases and filter by date
      if (!foundData) {
        console.log('Trying to get all completed purchases and filter manually');
        const q3 = query(purchasesCollection, where('status', '==', 'completed'));
        querySnapshot = await getDocs(q3);
        console.log(`Found ${querySnapshot.docs.length} total completed purchases`);
      }

      if (!querySnapshot || querySnapshot.empty) {
        console.log('No purchases found for the date range');
        return 0;
      } let totalPurchases = 0;
      let processedCount = 0;
      let skippedCount = 0;

      querySnapshot.docs.forEach(doc => {
        const purchaseData = doc.data();

        // If we got all purchases, filter by date manually
        if (!foundData) {
          const purchaseDate = this.parsePurchaseDate(purchaseData);

          if (!purchaseDate || purchaseDate < startDate || purchaseDate > endDate) {
            skippedCount++;
            return; // Skip this purchase
          }
        }

        // Use productsSubtotal (excludes tax) as first preference
        let purchaseAmount = purchaseData['productsSubtotal'];

        // If productsSubtotal not available, calculate from products array
        if (!purchaseAmount && purchaseData['products'] && Array.isArray(purchaseData['products'])) {
          purchaseAmount = purchaseData['products'].reduce((sum: number, product: any) => {
            // Use netCost or unitCost (which should be excluding tax)
            const costExcTax = product['netCost'] || product['unitCost'] || 0;
            const quantity = product['quantity'] || 1;
            return sum + (costExcTax * quantity);
          }, 0);
        }

        // If still no amount, try other fields but subtract tax
        if (!purchaseAmount) {
          const totalAmount = purchaseData['purchaseTotal'] || purchaseData['grandTotal'] || 0;
          const totalTax = purchaseData['totalTax'] ||
            (purchaseData['cgst'] || 0) +
            (purchaseData['sgst'] || 0) +
            (purchaseData['igst'] || 0);

          purchaseAmount = totalAmount - totalTax;
        }

        // Ensure amount is positive
        purchaseAmount = Math.max(0, purchaseAmount || 0);
        totalPurchases += purchaseAmount;
        processedCount++;

        console.log('Purchase (excl. tax):', {
          reference: purchaseData['referenceNo'],
          amount: purchaseAmount,
          originalTotal: purchaseData['grandTotal'],
          tax: purchaseData['totalTax'],
          purchaseDate: purchaseData['purchaseDate']
        });
      });

      console.log(`Processed ${processedCount} purchases, skipped ${skippedCount}. Total purchases (excluding tax):`, totalPurchases);
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
      console.log('Loading expense data (excluding tax components)...');

      const adjustedStartDate = new Date(startDate);
      adjustedStartDate.setHours(0, 0, 0, 0);

      const adjustedEndDate = new Date(endDate);
      adjustedEndDate.setHours(23, 59, 59, 999);

      // Get all expenses and incomes first
      const [expenses, incomes] = await Promise.all([
        this.getExpensesExcludingTax(adjustedStartDate, adjustedEndDate),
        this.getIncomesExcludingTax(adjustedStartDate, adjustedEndDate)
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

      console.log('Expense data loaded (excluding tax):', {
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

  /**
   * Get expenses excluding tax-related items
   */
  private async getExpensesExcludingTax(startDate: Date, endDate: Date): Promise<any[]> {
    try {
      console.log('Getting expenses for date range:', { startDate, endDate });
      const expenses = await this.expenseService.getExpensesByDateRange(startDate, endDate);
      console.log('Raw expenses received:', expenses?.length || 0);

      if (!Array.isArray(expenses)) return [];

      // Filter out tax-related expenses
      const filteredExpenses = expenses.filter(expense => {
        const categoryName = (expense.categoryName || expense.expenseCategory || '').toLowerCase();
        const description = (expense.description || '').toLowerCase();

        // Exclude tax-related categories
        const isTaxRelated = categoryName.includes('tax') ||
          categoryName.includes('gst') ||
          categoryName.includes('vat') ||
          description.includes('tax') ||
          description.includes('gst');

        return !isTaxRelated;
      });

      console.log('Filtered expenses (excluding tax):', filteredExpenses.length);
      return filteredExpenses;
    } catch (error) {
      console.error('Error getting expenses excluding tax:', error);
      return [];
    }
  }

  /**
   * Get incomes excluding tax-related items
   */
  private async getIncomesExcludingTax(startDate: Date, endDate: Date): Promise<any[]> {
    try {
      if ((this.expenseService as any).getIncomesByDateRange) {
        const incomes = await (this.expenseService as any).getIncomesByDateRange(startDate, endDate);
        if (!Array.isArray(incomes)) return [];

        // Filter out tax-related incomes
        return incomes.filter(income => {
          const categoryName = (income.categoryName || income.incomeCategory || '').toLowerCase();
          const description = (income.description || '').toLowerCase();

          // Exclude tax-related categories
          const isTaxRelated = categoryName.includes('tax') ||
            categoryName.includes('gst') ||
            categoryName.includes('vat') ||
            description.includes('tax') ||
            description.includes('gst');

          return !isTaxRelated;
        });
      }
      return [];
    } catch (error) {
      console.error('Error getting incomes excluding tax:', error);
      return [];
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

    // console.log("Fanisus: netPurchases, netSales, cogs", netPurchases, netSales, cogs)

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

  /**
   * Debug method to check available data in collections
   */
  async debugCollectionData(): Promise<void> {
    try {
      console.log('=== DEBUGGING COLLECTION DATA ===');

      // Check dailyStockSnapshots
      const snapshotsCollection = collection(this.firestore, 'dailyStockSnapshots');
      const snapshotsSnapshot = await getDocs(snapshotsCollection);
      console.log(`dailyStockSnapshots: ${snapshotsSnapshot.docs.length} documents`);

      const dates = new Set();
      snapshotsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        dates.add(data['date']);
      });
      console.log('Available snapshot dates:', Array.from(dates).sort());

      // Check purchases
      const purchasesCollection = collection(this.firestore, 'purchases');
      const purchasesSnapshot = await getDocs(purchasesCollection);
      console.log(`purchases: ${purchasesSnapshot.docs.length} documents`);

      if (purchasesSnapshot.docs.length > 0) {
        const firstPurchase = purchasesSnapshot.docs[0].data();
        console.log('First purchase structure:', Object.keys(firstPurchase));
        console.log('First purchase date fields:', {
          purchaseDate: firstPurchase['purchaseDate'],
          createdAt: firstPurchase['createdAt']
        });
      }

      // Check sales
      const salesCollection = collection(this.firestore, 'sales');
      const salesSnapshot = await getDocs(salesCollection);
      console.log(`sales: ${salesSnapshot.docs.length} documents`);

      if (salesSnapshot.docs.length > 0) {
        const firstSale = salesSnapshot.docs[0].data();
        console.log('First sale structure:', Object.keys(firstSale));
        console.log('First sale date fields:', {
          saleDate: firstSale['saleDate'],
          createdAt: firstSale['createdAt']
        });
      }

      // Check products
      const productsCollection = collection(this.firestore, 'products');
      const productsSnapshot = await getDocs(productsCollection);
      console.log(`products: ${productsSnapshot.docs.length} documents`);

      if (productsSnapshot.docs.length > 0) {
        const firstProduct = productsSnapshot.docs[0].data();
        console.log('First product cost fields:', {
          defaultPurchasePriceExcTax: firstProduct['defaultPurchasePriceExcTax'],
          defaultPurchasePriceIncTax: firstProduct['defaultPurchasePriceIncTax']
        });
      }

      console.log('=== END DEBUG ===');
    } catch (error) {
      console.error('Error in debug method:', error);
    }
  }
}