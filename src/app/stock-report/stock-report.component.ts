import { Component, OnInit, OnDestroy } from '@angular/core';
import { ProductsService } from '../services/products.service';
import { LocationService } from '../services/location.service';
import { Firestore, collection, doc, getDoc, getDocs, query, where, Timestamp, writeBatch } from '@angular/fire/firestore';
import { StockService } from '../services/stock.service';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { SaleService } from '../services/sale.service';
import { EndOfDayService } from '../services/end-of-day.service';
import { DailyStockService } from '../services/daily-stock.service';
import { SalesStockPriceLogService } from '../services/sales-stock-price-log.service';
import { PurchaseReturnService } from '../services/purchase-return.service';
import { COLLECTIONS } from '../../utils/constants';

interface StockHistoryEntry {
  id?: string;
  productId: string;
  locationId: string;
  action: 'goods_received' | 'transfer' | 'adjustment' | 'sale' | 'initial_stock' | 'return' | 'purchase_return';
  quantity: number;
  oldStock: number;
  newStock: number;
  timestamp: Date | any;
  userId: string;
  referenceNo?: string;
  notes?: string;
  locationFrom?: string;
  locationTo?: string;
  transferId?: string;
}

interface StockItem {
  productId?: string;
  sku?: string;
  productName?: string;
  quantity?: number;
  unit?: string;
  unitCost?: number;
  date?: string | Date | Timestamp;
  note?: string;
  subtotal?: number;
  category?: string;
  brand?: string;
  sellingPriceExcTax?: number;
  sellingPriceIncTax?: number;
  taxPercentage?: number;
  timestamp?: Timestamp;
  createdAt?: Date | Timestamp;
}

interface StockReportItem {
  id: string;
  productName: string;
  sku: string;
  category: string;
  brand: string;
   totalPurchaseReturned: number; // Renamed for clarity
  totalSalesReturned: number; 
  totalSold: number;
  totalReturned: number;
  unit: string;
  alertQuantity: number;
  purchasePrice: number;
  sellingPrice: number;
  margin: number;
  tax: number;
  lastUpdated: Date;
  openingStock: number;
  closingStock: number;
  currentStock: number;
  locationStocks: { [locationId: string]: LocationStockInfo };
}

interface LocationStockInfo {
  locationId: string;
  locationName: string;
  currentStock: number;
  openingStock: number;
  closingStock: number;
  totalPurchaseReturned: number; // Renamed for clarity
  totalSalesReturned: number;    // *** ADDED: New field for sales returns ***
  totalSold: number;
  totalReturned: number;
}

interface Product {
  id?: string;
  productName: string;
  sku: string;
  barcodeType?: string;
  unit: string;
  brand?: string | null;
  location?: string;
  locationName?: string;
  category?: string | null;
  subCategory?: string | null;
  manageStock?: boolean;
  alertQuantity?: number | null;
  productDescription?: string | null;
  productImage?: any;
  productBrochure?: any;
  enableProductDescription?: boolean;
  notForSelling?: boolean;
  weight?: number | null;
  preparationTime?: number | null;
  applicableTax?: string | any;
  taxPercentage?: number;
  sellingPriceTaxType?: string;
  productType?: string;
  defaultPurchasePriceExcTax?: number | null;
  defaultPurchasePriceIncTax?: number | null;
  marginPercentage?: number;
  defaultSellingPriceExcTax?: number | null;
  defaultSellingPriceIncTax?: number | null;
  createdAt?: Date | any;
  updatedAt?: Date | any;
  currentStock?: number;
}

interface Location {
  id: string;
  name: string;
  address?: string;
  isActive?: boolean;
}

interface Sale {
  id: string;
  saleDate: Date;
  status: string;
  products: Array<{
    productId?: string;
    id?: string;
    quantity: number;
  }>;
}

interface SalesStockPriceLog {
  id?: string;
  productId: string;
  productName: string;
  quantity: number;
  sellingPrice: number;
  locationId?: string;
  saleCreatedDate?: any;
  createdAt?: any;
  invoiceNo?: string;
}

interface PurchaseReturnLog {
  id?: string;
  productId: string;
  productName: string;
  returnQuantity: number;
  businessLocationId: string;
  returnDate: any;
  createdAt?: any;
}

type DateFilterType = 'today' | 'yesterday' | 'week' | 'all';

@Component({
  selector: 'app-stock-report',
  templateUrl: 'stock-report.component.html',
  styleUrls: ['stock-report.component.scss']
})
export class StockReportComponent implements OnInit, OnDestroy {
  [x: string]: any;
  stockData: StockReportItem[] = [];
  locations: Location[] = [];
  filteredData: StockReportItem[] = [];
  paginatedStockData: StockReportItem[] = [];
  isLoading = true;
  searchTerm = '';
  currentYear = new Date().getFullYear();
  totalPurchasePrice = 0;
  totalSellingPrice = 0;

  selectedDateFilter: DateFilterType = 'today';
  openingStockStartTime: Date = new Date();
  closingStockEndTime: Date = new Date();
  
  currentPage = 1;
  itemsPerPage = 10;
  totalItems = 0;
  totalPages = 1;

  sortColumn: keyof StockReportItem = 'productName';
  sortDirection: 'asc' | 'desc' = 'asc';

  eodProcessing = false;
  eodError: string | null = null;
  eodSuccess = false;

  private stockUpdateSubscription: Subscription | undefined;
  private salesUpdateSubscription: Subscription | undefined;

  constructor(
    private productsService: ProductsService,
    private stockService: StockService,
    private firestore: Firestore,
    private locationService: LocationService,
    private router: Router,
    public saleService: SaleService,
    private endOfDayService: EndOfDayService,
    private dailyStockService: DailyStockService,
    private salesStockPriceLogService: SalesStockPriceLogService,
    private purchaseReturnService: PurchaseReturnService
  ) {}

  async ngOnInit() {
    this.setDateFilter('today');
    await this.loadLocations();

    this.stockUpdateSubscription = this.stockService.stockUpdated$.subscribe(() => {
      console.log('Stock update detected - refreshing report');
      this.loadStockReport();
    });

    this.salesUpdateSubscription = this.saleService.salesUpdated$.subscribe(() => {
      console.log('Sales update detected - refreshing report');
      this.loadStockReport();
    });

    this.saleService.stockUpdated$?.subscribe(() => {
      console.log('Stock update from sale service detected - refreshing report');
      this.loadStockReport();
    });

    await this.loadStockReport();
  }

  ngOnDestroy() {
    if (this.stockUpdateSubscription) {
      this.stockUpdateSubscription.unsubscribe();
    }
    if (this.salesUpdateSubscription) {
      this.salesUpdateSubscription.unsubscribe();
    }
  }
 
  async loadLocations(): Promise<void> {
    try {
      this.locationService.getLocations().subscribe({
        next: (locations) => {
          this.locations = locations.map(loc => ({
            id: loc.id,
            name: loc.name || loc.locationName || 'Unknown Location',
            address: loc.address,
            isActive: loc.isActive !== false
          }));
          console.log('Locations loaded from LocationService:', this.locations);
        },
        error: (error) => {
          console.error('Error loading locations from LocationService:', error);
          this.loadLocationsFromProducts();
        }
      });
    } catch (error) {
      console.error('Error loading locations:', error);
      this.loadLocationsFromProducts();
    }
  }

  viewStockDetails(productId: string) {
    this.router.navigate(['/stock-details', productId]);
  }

  getTotalSold(): number {
    return this.filteredData.reduce((total, item) => total + (item.totalSold || 0), 0);
  }

  getTotalReturned(): number {
    return this.filteredData.reduce((total, item) => total + (item.totalReturned || 0), 0);
  }

  getProductsWithSalesCount(): number {
    return this.filteredData.filter(item => item.totalSold > 0).length;
  }

  getProductsWithReturnsCount(): number {
    return this.filteredData.filter(item => item.totalReturned > 0).length;
  }

  private async loadLocationsFromProducts(): Promise<void> {
    try {
      const locations = await this.productsService.getLocations();
      this.locations = locations.map(loc => ({
        id: loc.id,
        name: loc.name || loc.locationName || 'Unknown Location',
        address: loc.address,
        isActive: loc.isActive !== false
      }));
      console.log('Locations loaded from ProductsService:', this.locations);
    } catch (error) {
      console.error('Error loading locations from ProductsService:', error);
      this.locations = [];
    }
  }
  private async getSalesReturnsData(): Promise<{ [productId: string]: number }> {
    try {
        const salesReturnsMap: { [productId: string]: number } = {};
        console.log('Fetching sales returns data...');

        const historyCollection = collection(this.firestore, COLLECTIONS.PRODUCT_STOCK_HISTORY);
        // Query specifically for 'sales_return' actions
        const q = query(historyCollection, where('action', '==', 'sales_return'));
        const salesReturnsSnapshot = await getDocs(q);

        salesReturnsSnapshot.forEach(doc => {
            const data = doc.data() as StockHistoryEntry;
            if (data.productId) {
                // Sum up all returned quantities for each product
                salesReturnsMap[data.productId] = (salesReturnsMap[data.productId] || 0) + (data.quantity || 0);
            }
        });

        console.log('Sales returns data calculated:', Object.keys(salesReturnsMap).length, 'products have sales returns');
        return salesReturnsMap;
    } catch (error) {
        console.error('Error fetching sales returns data:', error);
        return {};
    }
  }
  setDateFilter(filter: DateFilterType) {
    this.selectedDateFilter = filter;
    this.calculateBusinessDateRange();
    this.loadStockReport();
  }

  calculateBusinessDateRange() {
    const now = new Date();
    
    switch (this.selectedDateFilter) {
      case 'today':
        this.openingStockStartTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 1, 0);
        this.closingStockEndTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        break;
        
      case 'yesterday':
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        this.openingStockStartTime = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 1, 0);
        this.closingStockEndTime = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59);
        break;
        
      case 'week':
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay() + 1);
        this.openingStockStartTime = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate(), 0, 1, 0);
        
        const endOfWeek = new Date(startOfWeek.getTime() + 6 * 24 * 60 * 60 * 1000);
        this.closingStockEndTime = new Date(endOfWeek.getFullYear(), endOfWeek.getMonth(), endOfWeek.getDate(), 23, 59, 59);
        break;
        
      case 'all':
        this.openingStockStartTime = new Date(0);
        this.closingStockEndTime = new Date();
        break;
    }
  }

  getOpeningStockTime(): string {
    if (this.selectedDateFilter === 'all') return 'All Time';
    return this.openingStockStartTime.toLocaleString();
  }

  getClosingStockTime(): string {
    if (this.selectedDateFilter === 'all') return 'Current';
    return this.closingStockEndTime.toLocaleString();
  }

  // UPDATED: Load stock report with proper opening/closing stock calculation from daily snapshots
// in src/app/components/stock-report/stock-report.component.ts

  async loadStockReport() {
    try {
      this.isLoading = true;
      console.log('Loading stock report - Start');
      
      await this.dailyStockService.initializeDailySnapshotsIfNeeded(this.closingStockEndTime);
      
      if (this.locations.length === 0) {
        await this.loadLocations();
      }

      // *** FIXED: Added salesReturnsMap to be fetched along with other data ***
      const [products, sales, correctTotalSoldMap, purchaseReturnsMap, salesReturnsMap] = await Promise.all([
        this.productsService.fetchAllProducts(),
        this.getSalesForDateRange(this.openingStockStartTime, this.closingStockEndTime),
        this.getCorrectTotalSoldData(), // This method will be fixed below
        this.getPurchaseReturnsData(),
        this.getSalesReturnsData() // Ensures sales return data is fetched
      ]);

      const dateRangeProductSalesMap = this.createProductSalesMapForDateRange(sales);
      const productLocationSalesMap = this.createProductLocationSalesMapForDateRange(sales);

      // Pass the new salesReturnsMap to the next function
      const stockMap = await this.getProductStockDataWithOpeningClosingFromDailySnapshots(
        correctTotalSoldMap, 
        purchaseReturnsMap
      );

      // Also pass it to the final processing function
      this.stockData = await this.processStockDataWithDailySnapshots(
        products,
        stockMap,
        dateRangeProductSalesMap,
        correctTotalSoldMap,
        purchaseReturnsMap,
        salesReturnsMap,
        productLocationSalesMap
      );

      this.calculateStockValues();
      this.applyFilter();

      console.log('Stock report loaded successfully - Total products:', this.stockData.length);
      
    } catch (error) {
      console.error('Error loading stock report:', error);
      this['error'] = 'Failed to load stock data. Please try again.';
    } finally {
      this.isLoading = false;
    }
  }

  // NEW: Get purchase returns data mapped by product and location
  private async getPurchaseReturnsData(): Promise<{ [productId: string]: number }> {
    try {
      const purchaseReturnsMap: { [productId: string]: number } = {};

      console.log('Fetching purchase returns data...');

      const purchaseReturnLogsSnapshot = await getDocs(collection(this.firestore, 'purchase-return-log'));
      
      purchaseReturnLogsSnapshot.forEach(doc => {
        const data = doc.data();
        if (data['productId']) {
          purchaseReturnsMap[data['productId']] = (purchaseReturnsMap[data['productId']] || 0) + (data['returnQuantity'] || 0);
        }
      });

      console.log('Purchase returns data calculated:', Object.keys(purchaseReturnsMap).length, 'products have returns');
      return purchaseReturnsMap;
    } catch (error) {
      console.error('Error fetching purchase returns data:', error);
      return {};
    }
  }

  // UPDATED: Get product stock data with proper opening/closing stock from daily snapshots
  private async getProductStockDataWithOpeningClosingFromDailySnapshots(
    totalSoldMap: { [productId: string]: number },
    purchaseReturnsMap: { [productId: string]: number }
  ) {
    const stockMap: { [productId: string]: { [locationId: string]: LocationStockInfo } } = {};
    const productStockCollection = collection(this.firestore, COLLECTIONS.PRODUCT_STOCK);
    
    const productStockSnapshot = await getDocs(productStockCollection);

    for (const doc of productStockSnapshot.docs) {
      const data = doc.data();
      const docId = doc.id;
      const parts = docId.split('_');

      if (parts.length >= 2) {
        const productId = parts[0];
        const locationId = parts.slice(1).join('_');

        if (productId && locationId && typeof locationId === 'string') {
          if (!stockMap[productId]) stockMap[productId] = {};

          const location = this.locations.find(l => l.id === locationId);
          
          // Get actual current stock from database
          const actualCurrentStock = data['quantity'] || 0;
          
          // CRITICAL FIX: Get opening and closing stock from daily stock service
          const [openingStock, closingStock] = await Promise.all([
            this.dailyStockService.getOpeningStock(productId, locationId, this.openingStockStartTime),
            this.dailyStockService.getClosingStock(productId, locationId, this.closingStockEndTime)
          ]);

          // Get sales and returns for this product
          const productSold = totalSoldMap[productId] || 0;
          const productReturned = purchaseReturnsMap[productId] || 0;

          stockMap[productId][locationId] = {
            locationId,
            locationName: location?.name || `Location ${locationId}`,
            // Current stock is the actual stock from database
            currentStock: actualCurrentStock,
            // Opening stock from daily snapshots (based on previous day's closing)
            openingStock: openingStock,
            // Closing stock from daily snapshots (reflects all transactions for the day)
            closingStock: closingStock,
            totalSold: productSold,
            totalReturned: productReturned,
            totalPurchaseReturned: 0, // Provide a default or calculated value as needed
            totalSalesReturned: 0     // Provide a default or calculated value as needed
          };

          console.log(`✅ Stock data for ${productId} at ${locationId}:`, {
            current: actualCurrentStock,
            opening: openingStock,
            closing: closingStock,
            sold: productSold,
            returned: productReturned
          });
        }
      }
    }

    return stockMap;
  }

// in src/app/components/stock-report/stock-report.component.ts

  private async getCorrectTotalSoldData(): Promise<{ [productId: string]: number }> {
    try {
      const totalSoldMap: { [productId: string]: number } = {};

      console.log('Fetching total sold data from authoritative source...');

      // Using sales-stock-price-log is best as it's an immutable record
      const salesLogsSnapshot = await getDocs(collection(this.firestore, COLLECTIONS.SALES_STOCK_PRICE_LOGS));
      
      if (!salesLogsSnapshot.empty) {
        console.log('Using sales-stock-price-log as authoritative source');
        salesLogsSnapshot.forEach(doc => {
          const data = doc.data();
          if (data['productId']) {
            totalSoldMap[data['productId']] = (totalSoldMap[data['productId']] || 0) + (data['quantity'] || 0);
          }
        });
      } else {
        // Fallback logic, which is likely the source of the "Total Sold" issue.
        console.log('Fallback: Using sales collection as authoritative source');
        
        // *** THE FIX IS HERE ***
        // We now query for all statuses that represent a completed transaction, even if it was later returned.
        const salesSnapshot = await getDocs(
          query(
            collection(this.firestore, COLLECTIONS.SALES),
            where('status', 'in', ['Completed', 'Returned', 'Partial Return']) // Include returned sales in the query
          )
        );
        
        salesSnapshot.forEach(doc => {
          const sale = doc.data();
          if (sale['products']?.length) {
            sale['products'].forEach((product: any) => {
              const productId = product.productId || product.id;
              if (productId) {
                totalSoldMap[productId] = (totalSoldMap[productId] || 0) + (product.quantity || 0);
              }
            });
          }
        });
      }

      console.log('Total sold data calculated:', Object.keys(totalSoldMap).length, 'products have sales');
      return totalSoldMap;
    } catch (error) {
      console.error('Error fetching correct total sold data:', error);
      return {};
    }
  }

  async getTotalSoldForProduct(productId: string): Promise<number> {
    try {
      let totalSold = 0;

      const salesLogsQuery = query(
        collection(this.firestore, COLLECTIONS.SALES_STOCK_PRICE_LOGS),
        where('productId', '==', productId)
      );
      const salesLogsSnapshot = await getDocs(salesLogsQuery);
      salesLogsSnapshot.forEach(doc => {
        const data = doc.data();
        totalSold += (data['quantity'] || 0);
      });

      if (totalSold === 0) {
        const salesQuery = query(
          collection(this.firestore, COLLECTIONS.SALES),
          where('status', '==', 'Completed')
        );
        const salesSnapshot = await getDocs(salesQuery);
        salesSnapshot.forEach(doc => {
          const sale = doc.data();
          if (sale['products']?.length) {
            sale['products'].forEach((product: any) => {
              if ((product.productId || product.id) === productId) {
                totalSold += (product.quantity || 0);
              }
            });
          }
        });
      }

      return totalSold;
    } catch (error) {
      console.error('Error getting total sold for product:', error);
      return 0;
    }
  }

  async getTotalReturnedForProduct(productId: string): Promise<number> {
    try {
      let totalReturned = 0;

      const returnLogsQuery = query(
        collection(this.firestore, 'purchase-return-log'),
        where('productId', '==', productId)
      );
      const returnLogsSnapshot = await getDocs(returnLogsQuery);
      returnLogsSnapshot.forEach(doc => {
        const data = doc.data();
        totalReturned += (data['returnQuantity'] || 0);
      });

      return totalReturned;
    } catch (error) {
      console.error('Error getting total returned for product:', error);
      return 0;
    }
  }

  async validateTotalSoldData(): Promise<void> {
    console.log('Validating total sold data consistency...');
    
    for (const item of this.stockData.slice(0, 5)) {
      const calculatedTotal = await this.getTotalSoldForProduct(item.id);
      const calculatedReturned = await this.getTotalReturnedForProduct(item.id);
      if (Math.abs(calculatedTotal - item.totalSold) > 0) {
        console.warn(`Total sold mismatch for ${item.productName}: Expected ${calculatedTotal}, Got ${item.totalSold}`);
      } else {
        console.log(`✅ Total sold correct for ${item.productName}: ${item.totalSold}`);
      }
      
      if (Math.abs(calculatedReturned - item.totalReturned) > 0) {
        console.warn(`Total returned mismatch for ${item.productName}: Expected ${calculatedReturned}, Got ${item.totalReturned}`);
      } else {
        console.log(`✅ Total returned correct for ${item.productName}: ${item.totalReturned}`);
      }
    }
  }

  async refreshTotalSoldData(): Promise<void> {
    try {
      console.log('Refreshing total sold and returns data...');
      
      const [correctTotalSoldMap, purchaseReturnsMap] = await Promise.all([
        this.getCorrectTotalSoldData(),
        this.getPurchaseReturnsData()
      ]);
      
      // Reload the entire stock report to ensure all calculations are correct
      await this.loadStockReport();
      
      console.log('Total sold and returns data refreshed successfully');
    } catch (error) {
      console.error('Error refreshing total sold and returns data:', error);
    }
  }

  exportTotalSoldData(): void {
    const totalSoldData = this.stockData.map(item => ({
      productId: item.id,
      productName: item.productName,
      sku: item.sku,
      totalSold: item.totalSold,
      totalReturned: item.totalReturned,
      openingStock: item.openingStock,
      closingStock: item.closingStock,
      currentStock: item.currentStock,
      stockAdjustedForSales: item.openingStock - item.totalSold + item.totalReturned,
      isCurrentEqualAdjusted: item.currentStock === (item.openingStock - item.totalSold + item.totalReturned) ? 'YES' : 'NO'
    }));
    
    console.table(totalSoldData);
    
    const csvContent = [
      'Product ID,Product Name,SKU,Total Sold,Total Returned,Opening Stock,Closing Stock,Current Stock,Stock Adjusted for Sales,Current=Adjusted',
      ...totalSoldData.map(item => 
        `${item.productId},${item.productName},${item.sku},${item.totalSold},${item.totalReturned},${item.openingStock},${item.closingStock},${item.currentStock},${item.stockAdjustedForSales},${item.isCurrentEqualAdjusted}`
      )
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'stock-with-sales-and-returns.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private createProductSalesMapForDateRange(sales: any[]): { [productId: string]: number } {
    const salesMap: { [productId: string]: number } = {};
    
    sales.forEach(sale => {
      if (sale.products?.length) {
        sale.products.forEach((product: any) => {
          const productId = product.productId || product.id;
          if (productId) {
            salesMap[productId] = (salesMap[productId] || 0) + (product.quantity || 0);
          }
        });
      }
    });
    
    return salesMap;
  }

  private createProductLocationSalesMapForDateRange(sales: any[]): { [key: string]: number } {
    const locationSalesMap: { [key: string]: number } = {};
    
    sales.forEach(sale => {
      if (sale.products?.length) {
        sale.products.forEach((product: any) => {
          const productId = product.productId || product.id;
          if (productId) {
            const locationId = sale.locationId || 'default';
            const key = `${productId}_${locationId}`;
            locationSalesMap[key] = (locationSalesMap[key] || 0) + (product.quantity || 0);
          }
        });
      }
    });
    
    return locationSalesMap;
  }

  private calculateStockValues() {
    const { totalOpeningValue, totalClosingValue } = this.stockData.reduce(
      (totals, item) => ({
        totalOpeningValue: totals.totalOpeningValue + (item.openingStock * (item.purchasePrice || 0)),
        totalClosingValue: totals.totalClosingValue + (item.closingStock * (item.purchasePrice || 0))
      }),
      { totalOpeningValue: 0, totalClosingValue: 0 }
    );

    localStorage.setItem('openingStockValue', totalOpeningValue.toString());
    localStorage.setItem('closingStockValue', totalClosingValue.toString());
  }

  private parseDate(date: any): Date {
    if (!date) return new Date();
    if (date instanceof Date) return date;
    if (typeof date.toDate === 'function') return date.toDate();
    return new Date(date);
  }

  private async getSalesForDateRange(startDate: Date, endDate: Date): Promise<any[]> {
    try {
      const salesRef = collection(this.firestore, 'sales');
      const q = query(
        salesRef,
        where('status', '==', 'Completed'),
        where('saleDate', '>=', startDate),
        where('saleDate', '<=', endDate)
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        saleDate: this.parseDate(doc.data()['saleDate']),
        products: doc.data()['products'] || []
      }));
    } catch (error) {
      console.error('Error fetching sales:', error);
      return [];
    }
  }

  private convertTimestampToDate(timestamp: any): Date {
    if (timestamp instanceof Date) {
      return timestamp;
    }
    if (timestamp && typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }
    if (timestamp && typeof timestamp.seconds === 'number') {
      return new Date(timestamp.seconds * 1000);
    }
    return new Date(timestamp);
  }

  async checkStockAvailability(productId: string, locationId: string, requiredQuantity: number): Promise<boolean> {
    const stockDocId = `${productId}_${locationId}`;
    const stockDocRef = doc(this.firestore, COLLECTIONS.PRODUCT_STOCK, stockDocId);
    const stockSnap = await getDoc(stockDocRef);

    if (!stockSnap.exists()) return false;

    const currentStock = stockSnap.data()['quantity'] || 0;
    return currentStock >= requiredQuantity;
  }

  applyFilter() {
    let filtered = [...this.stockData];

    if (this.searchTerm && this.searchTerm.trim() !== '') {
      const term = this.searchTerm.toLowerCase().trim();
      filtered = filtered.filter(item => {
        const basicFieldsMatch = (
          (String(item.productName || '').toLowerCase().includes(term)) ||
          (String(item.sku || '').toLowerCase().includes(term)) ||
          (String(item.category || '').toLowerCase().includes(term)) ||
          (String(item.brand || '').toLowerCase().includes(term)) ||
          (String(item.unit || '').toLowerCase().includes(term))
        );
        
        const locationFieldsMatch = Object.values(item.locationStocks || {}).some(stock => 
          String(stock.locationName || '').toLowerCase().includes(term)
        );
        
        return basicFieldsMatch || locationFieldsMatch;
      });
    }

    this.filteredData = filtered;
    this.totalItems = this.filteredData.length;
    this.totalPages = Math.max(Math.ceil(this.totalItems / this.itemsPerPage), 1);
    this.currentPage = 1;
    
    this.applySorting();
    this.calculateTotals();
    this.updatePaginatedData();
  }

  applySorting() {
    this.filteredData.sort((a, b) => {
      const valueA = a[this.sortColumn];
      const valueB = b[this.sortColumn];
      
      if (valueA === null || valueA === undefined) return this.sortDirection === 'asc' ? -1 : 1;
      if (valueB === null || valueB === undefined) return this.sortDirection === 'asc' ? 1 : -1;
      
      if (typeof valueA === 'string' && typeof valueB === 'string') {
        return this.sortDirection === 'asc' 
          ? valueA.localeCompare(valueB)
          : valueB.localeCompare(valueA);
      } else if (valueA instanceof Date && valueB instanceof Date) {
        return this.sortDirection === 'asc'
          ? valueA.getTime() - valueB.getTime()
          : valueB.getTime() - valueA.getTime();
      } else if (typeof valueA === 'number' && typeof valueB === 'number') {
        return this.sortDirection === 'asc'
          ? valueA - valueB
          : valueB - valueA;
      }
      return 0;
    });
  }

  sortData(column: keyof StockReportItem) {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    
    this.applySorting();
    this.updatePaginatedData();
  }

  updatePaginatedData() {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = Math.min(startIndex + this.itemsPerPage, this.filteredData.length);
    this.paginatedStockData = this.filteredData.slice(startIndex, endIndex);
    
    this.calculateTotals();
  }

  calculateTotals() {
    this.totalPurchasePrice = this.paginatedStockData.reduce((sum, item) => sum + (item.purchasePrice || 0), 0);
    this.totalSellingPrice = this.paginatedStockData.reduce((sum, item) => sum + (item.sellingPrice || 0), 0);
  }

  get paginatedData(): StockReportItem[] {
    return this.paginatedStockData;
  }

  changePage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePaginatedData();
    }
  }

  clearFilters() {
    this.searchTerm = '';
    this.applyFilter();
  }

  getStockForLocation(item: StockReportItem, locationId: string): LocationStockInfo | null {
    return item.locationStocks[locationId] || null;
  }

  // UPDATED: Total stock equals current stock (which reflects sales and returns)
  getTotalStock(item: StockReportItem): number {
    return item.currentStock; // Current stock is the actual stock after all transactions
  }

  getLocationsWithStock(item: StockReportItem): string[] {
    return Object.keys(item.locationStocks || {}).filter(locationId => 
      item.locationStocks[locationId].currentStock > 0
    );
  }

 // in src/app/components/stock-report/stock-report.component.ts

// ... (other methods of the component)

  /**
   * *** CORRECTED METHOD - FIX for TS2322 Error ***
   * This version ensures the returned object includes all properties
   * required by the StockReportItem interface.
   */
// in src/app/components/stock-report/stock-report.component.ts

  // ... (other methods of the component)

  /**
   * *** CORRECTED METHOD - FIX for Missing Property Error ***
   * This version ensures the returned object includes all properties
   * required by the StockReportItem interface.
   */
  private async processStockDataWithDailySnapshots(
    products: Product[],
    stockMap: { [productId: string]: { [locationId: string]: LocationStockInfo } },
    dateRangeProductSalesMap: { [productId: string]: number },
    correctTotalSoldMap: { [productId: string]: number },
    purchaseReturnsMap: { [productId: string]: number },
    salesReturnsMap: { [productId: string]: number },
    productLocationSalesMap: { [key: string]: number }
  ): Promise<StockReportItem[]> {
    return products.map((product: Product): StockReportItem => {
      const productId = product.id || '';
      const productStocks = stockMap[productId] || {};
      
      const totalPurchaseReturnedAllTime = purchaseReturnsMap[productId] || 0;
      const totalSalesReturnedAllTime = salesReturnsMap[productId] || 0;
      
      const stockValues = Object.values(productStocks).reduce((acc, stock) => {
        acc.opening += stock.openingStock || 0;
        acc.current += stock.currentStock || 0;
        return acc;
      }, { opening: 0, current: 0 });

      // FIX IS APPLIED IN THIS RETURN STATEMENT
      return {
        // --- Product Info ---
        id: productId,
        productName: product.productName || '',
        sku: product.sku || '',
        category: product.category || '-',
        brand: product.brand || '-',
        unit: product.unit || '',
        alertQuantity: product.alertQuantity || 0,
        purchasePrice: product.defaultPurchasePriceExcTax || 0,
        sellingPrice: product.defaultSellingPriceExcTax || 0,
        margin: product.marginPercentage || 0,
        tax: product.taxPercentage || 0,
        lastUpdated: this.parseDate(product.updatedAt),

        // --- Calculated Values (Corrected) ---
        totalSold: correctTotalSoldMap[productId] || 0,
        
        // This variable from purchaseReturnsMap now correctly populates 'totalPurchaseReturned'.
        totalPurchaseReturned: totalPurchaseReturnedAllTime,
        
        // The old property is also populated to satisfy the interface if it's still in use elsewhere.
        totalReturned: totalPurchaseReturnedAllTime, 
        
        // The new sales return property.
        totalSalesReturned: totalSalesReturnedAllTime,
        
        openingStock: stockValues.opening,
        closingStock: stockValues.current,
        currentStock: stockValues.current,
        locationStocks: productStocks,
      };
    });
  }

// ... (rest of the component)

// ... (rest of the component)
  getTotalStockForLocation(locationId: string): number {
    return this.filteredData.reduce((total, item) => {
      const stock = this.getStockForLocation(item, locationId);
      return total + (stock ? (stock.currentStock || 0) : 0);
    }, 0);
  }

  getGrandTotalStock(): number {
    return this.filteredData.reduce(
      (total, item) => total + this.getTotalStock(item), 
      0
    );
  }

  getLowStockProducts(): StockReportItem[] {
    return this.filteredData.filter(item => this.hasLowStockAlert(item));
  }

  getLocationsWithLowStock(item: StockReportItem): string[] {
    return Object.values(item.locationStocks || {})
      .filter(stock => stock.currentStock <= item.alertQuantity)
      .map(stock => stock.locationName);
  }

  hasLowStockAlert(item: StockReportItem): boolean {
    return Object.values(item.locationStocks || {}).some(stock => 
      stock.currentStock <= item.alertQuantity
    );
  }

  getCurrentDate(): string {
    return new Date().toLocaleString();
  }

  async getCurrentStockWithSalesAndReturns(productId: string, locationId: string): Promise<number> {
    try {
      const stockDocId = `${productId}_${locationId}`;
      const stockDocRef = doc(this.firestore, COLLECTIONS.PRODUCT_STOCK, stockDocId);
      const stockDoc = await getDoc(stockDocRef);
      
      if (stockDoc.exists()) {
        // Return actual current stock (already reflects sales and returns)
        return stockDoc.data()['quantity'] || 0;
      }
      return 0;
    } catch (error) {
      console.error('Error getting current stock with sales and returns:', error);
      return 0;
    }
  }

  getTotalOpeningStock(item: StockReportItem): number {
    return Object.values(item.locationStocks).reduce((total, stock) => {
      return total + (stock.openingStock || 0);
    }, 0);
  }

  getTotalClosingStock(item: StockReportItem): number {
    return Object.values(item.locationStocks).reduce((total, stock) => {
      return total + (stock.closingStock || 0);
    }, 0);
  }

  getOpeningStockForLocation(item: StockReportItem, locationId: string): number {
    const stock = this.getStockForLocation(item, locationId);
    return stock ? stock.openingStock : 0;
  }

  getClosingStockForLocation(item: StockReportItem, locationId: string): number {
    const stock = this.getStockForLocation(item, locationId);
    return stock ? stock.closingStock : 0;
  }

  async processEndOfDay() {
    this.eodProcessing = true;
    this.eodError = null;
    this.eodSuccess = false;
    
    try {
      await this.endOfDayService.processEndOfDay();
      await this.dailyStockService.processEndOfDay(new Date());
      
      this.eodSuccess = true;
      await this.loadStockReport();
    } catch (error) {
      this.eodError = error instanceof Error ? error.message : 'Unknown error occurred during End of Day processing';
      console.error('End of Day processing error:', error);
    } finally {
      this.eodProcessing = false;
    }
  }
}