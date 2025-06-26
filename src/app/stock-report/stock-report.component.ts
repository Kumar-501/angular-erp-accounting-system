import { Component, OnInit, OnDestroy } from '@angular/core';
import { ProductsService } from '../services/products.service';
import { LocationService } from '../services/location.service';
import { Firestore, collection, doc, getDoc, getDocs, query, where, Timestamp } from '@angular/fire/firestore';
import { StockService } from '../services/stock.service';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { SaleService } from '../services/sale.service';
import { EndOfDayService } from '../services/end-of-day.service';
import { DailyStockService } from '../services/daily-stock.service';
import { COLLECTIONS } from '../../utils/constants';

interface StockHistoryEntry {
  id?: string;
  productId: string;
  locationId: string;
  action: 'goods_received' | 'transfer' | 'adjustment' | 'sale' | 'initial_stock' | 'return';
  quantity: number;
  oldStock: number;
  newStock: number;
  timestamp: Date | any;
  userId: string;
  referenceNo?: string;
  notes?: string;
  // Transfer specific fields  
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
  unit: string;
  alertQuantity: number;
  purchasePrice: number;
  sellingPrice: number;
  margin: number;
  tax: number; // Changed from taxPercentage to tax for consistency
  totalSold: number; // Added total sold field
  lastUpdated: Date;
  openingStock: number; // Added opening stock
  closingStock: number; // Added closing stock
  locationStocks: { [locationId: string]: LocationStockInfo };
}

interface LocationStockInfo {
  locationId: string;
  locationName: string;
  currentStock: number;
  openingStock: number;
  closingStock: number;
  totalSold: number;
}

interface Product {
  id?: string;
  productName: string;
  sku: string;
  barcodeType?: string;
  unit: string;
  brand?: string | null;
  location?: string;        // Make this optional
  locationName?: string;    // Make this optional
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

type DateFilterType = 'today' | 'yesterday' | 'week' | 'all';

@Component({
  selector: 'app-stock-report',
  templateUrl: './stock-report.component.html',
  styleUrls: ['./stock-report.component.scss']
})
export class StockReportComponent implements OnInit, OnDestroy {
  stockData: StockReportItem[] = [];
  locations: Location[] = [];
  filteredData: StockReportItem[] = [];
  paginatedStockData: StockReportItem[] = [];
  isLoading = true;
  searchTerm = '';
  currentYear = new Date().getFullYear();
  totalPurchasePrice = 0;
  totalSellingPrice = 0;

  // Date filtering
  selectedDateFilter: DateFilterType = 'today';
  openingStockStartTime: Date = new Date();
  closingStockEndTime: Date = new Date();
  
  // Pagination
  currentPage = 1;
  itemsPerPage = 10;
  totalItems = 0;
  totalPages = 1;

  // Sorting
  sortColumn: keyof StockReportItem = 'productName';
  sortDirection: 'asc' | 'desc' = 'asc';

  // End of Day Processing
  eodProcessing = false;
  eodError: string | null = null;
  eodSuccess = false;

  // Subscription for real-time updates
  private stockUpdateSubscription: Subscription | undefined;

  constructor(
    private productsService: ProductsService,
    private stockService: StockService,
    private firestore: Firestore,
    private locationService: LocationService,
    private router: Router,
    private saleService: SaleService,
    private endOfDayService: EndOfDayService,
    private dailyStockService: DailyStockService // Add this injection
  ) {}

  async ngOnInit() {
    this.setDateFilter('today'); // Initialize with today's filter, this will call loadStockReport()
    await this.loadLocations();  // Load locations first

    this.stockUpdateSubscription = this.stockService.stockUpdated$.subscribe(() => {
      this.loadStockReport(); // Refresh the report when stock changes
    });
  }

  ngOnDestroy() {
    if (this.stockUpdateSubscription) {
      this.stockUpdateSubscription.unsubscribe();
    }
  }
 
  async loadLocations(): Promise<void> {
    try {
      // First try to get locations from LocationService
      this.locationService.getLocations().subscribe({
        next: (locations) => {
          this.locations = locations.map(loc => ({
            id: loc.id,
            name: loc.name || loc.locationName || 'Unknown Location',
            address: loc.address,
            isActive: loc.isActive !== false // Default to true if not specified
          }));
          console.log('Locations loaded from LocationService:', this.locations);
        },
        error: (error) => {
          console.error('Error loading locations from LocationService:', error);
          // Fallback to ProductsService
          this.loadLocationsFromProducts();
        }
      });
    } catch (error) {
      console.error('Error loading locations:', error);
      // Fallback to ProductsService
      this.loadLocationsFromProducts();
    }
  }

  // Add this method to navigate to stock details
  viewStockDetails(productId: string) {
    // Navigate to the stock details component with the product ID
    this.router.navigate(['/stock-details', productId]);
  }

  // Fallback method to load locations from ProductsService
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
      this.locations = []; // Fallback to empty array
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
        // Opening stock: Today 12:01 AM
        this.openingStockStartTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 1, 0);
        // Closing stock: Today 11:59 PM
        this.closingStockEndTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        break;
        
      case 'yesterday':
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        // Opening stock: Yesterday 12:01 AM
        this.openingStockStartTime = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 1, 0);
        // Closing stock: Yesterday 11:59 PM
        this.closingStockEndTime = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59);
        break;
        
      case 'week':
        // Get start of week (Monday 12:01 AM)
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay() + 1);
        this.openingStockStartTime = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate(), 0, 1, 0);
        
        // Closing stock: End of week (Sunday 11:59 PM)
        const endOfWeek = new Date(startOfWeek.getTime() + 6 * 24 * 60 * 60 * 1000);
        this.closingStockEndTime = new Date(endOfWeek.getFullYear(), endOfWeek.getMonth(), endOfWeek.getDate(), 23, 59, 59);
        break;
        
      case 'all':
        // No time restrictions
        this.openingStockStartTime = new Date(0); // Beginning of time
        this.closingStockEndTime = new Date(); // Current time
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

  async loadStockReport() {
    try {
      this.isLoading = true;
      
      // Initialize daily snapshots for the selected date if needed
      await this.dailyStockService.initializeDailySnapshotsIfNeeded(this.closingStockEndTime);
      
      // Get all products
      const products = await this.productsService.fetchAllProducts();
      console.log('Products loaded:', products.length);
      
      // Get all product-stock documents
      const productStockCollection = collection(this.firestore, COLLECTIONS.PRODUCT_STOCK);
      const productStockSnapshot = await getDocs(productStockCollection);
      console.log('Product stock documents:', productStockSnapshot.docs.length);
        
      // Create a map to store stock information by product ID and location ID
      const stockMap: { [productId: string]: { [locationId: string]: LocationStockInfo } } = {};
      const processedDocs = new Set<string>(); // Track processed documents to avoid duplicates
      
      // Process product-stock documents
      for (const doc of productStockSnapshot.docs) {
        const data = doc.data();
        const docId = doc.id;
        
        // Skip if already processed
        if (processedDocs.has(docId)) {
          console.log('Skipping duplicate document:', docId);
          continue;
        }
        processedDocs.add(docId);
        
        console.log('Processing stock document:', docId, data);
        
        // Parse document ID format: productId_locationId
        const parts = docId.split('_');
        console.log('Document ID parts:', parts);
        
        if (parts.length >= 2) {
          const productId = parts[0];
          const locationId = parts.slice(1).join('_'); // Handle location IDs that might contain underscores
            
          console.log('Parsed productId:', productId, 'locationId:', locationId, 'type:', typeof locationId);
          
          // Filter out invalid location IDs
          if (productId && locationId && typeof locationId === 'string' && locationId !== '[object Object]' && !locationId.includes('object')) {
            if (!stockMap[productId]) {
              stockMap[productId] = {};
            }
            
            const location = this.locations.find(l => l.id === locationId);
            const currentStock = data['quantity'] || 0;
              
            console.log(`Stock for product ${productId} at location ${locationId}:`, currentStock);
          
            // Get opening and closing stock from daily snapshots
            const openingStock = await this.dailyStockService.getOpeningStock(
              productId, 
              locationId, 
              this.openingStockStartTime
            );
            
            const closingStock = await this.dailyStockService.getClosingStock(
              productId, 
              locationId, 
              this.closingStockEndTime
            );
            console.log("Fanisus: sasdasd Closing S", closingStock)
            
            const totalStockSold = await this.dailyStockService.getTotalStockSold( // TODO
              productId,
              locationId,
              this.closingStockEndTime
            )
            // Calculate total sold for the period
            // const totalSold = Math.max(0, openingStock + 0 - closingStock); // Simplified calculation
            
            stockMap[productId][locationId] = {
              locationId: locationId,
              locationName: location?.name || `Location ${locationId}`,
              currentStock: currentStock,
              openingStock: openingStock,
              closingStock: closingStock,
              totalSold: totalStockSold
            };
          }
        }
      }
        
      // Create stock report items
      this.stockData = products.map((product: Product) => {
        const productStocks = stockMap[product.id || ''] || {};
        
        // Calculate total sold for the day (sum across all locations)
        let totalSold = 0;
        Object.values(productStocks).forEach(stock => {
          totalSold += stock.totalSold || 0;
        });
        
        // Calculate overall opening and closing stock
        let overallOpeningStock = 0;
        let overallClosingStock = 0;
        Object.values(productStocks).forEach(stock => {
          overallOpeningStock += stock.openingStock || 0;
          overallClosingStock += stock.closingStock || 0;
        });
        // TODO
        console.log("Fanisus: Opening Stock: ", overallOpeningStock, "Closing Stock:", overallClosingStock);
        
        const totalCurrentStock = Object.values(productStocks).reduce((total, stock) => total + (stock.currentStock || 0), 0);
        
        console.log(`Product ${product.productName} - Opening: ${overallOpeningStock}, Closing: ${overallClosingStock}, Current: ${totalCurrentStock}`, productStocks);
        
        return {
          id: product.id || '',
          productName: product.productName || '',
          sku: product.sku || '',
          category: product.category || '-',
          brand: product.brand || '-',
          unit: product.unit || '',
          alertQuantity: product.alertQuantity || 0,
          purchasePrice: product.defaultPurchasePriceExcTax || 0,
          sellingPrice: product.defaultSellingPriceExcTax || 0,
          margin: product.marginPercentage || 0,
          tax: product.taxPercentage || 0, // Changed from taxPercentage to tax
          totalSold: totalSold,
          openingStock: overallOpeningStock,
          closingStock: overallClosingStock,
          lastUpdated: product.updatedAt ? 
            (typeof product.updatedAt === 'object' && 'toDate' in product.updatedAt ? 
             product.updatedAt.toDate() : new Date(product.updatedAt)) : new Date(),
          locationStocks: productStocks
        };
      });
      
      console.log('Final stock data:', this.stockData);
      
      this.applyFilter();
      
    } catch (error) {
      console.error('Error loading stock report:', error);
    } finally {
      this.isLoading = false;
    }
  }

  applyFilter() {
    let filtered = [...this.stockData];

    // Apply search term filter
    if (this.searchTerm && this.searchTerm.trim() !== '') {
      const term = this.searchTerm.toLowerCase().trim();
      filtered = filtered.filter(item => {
        // Search in basic product fields
        const basicFieldsMatch = (
          (String(item.productName || '').toLowerCase().includes(term)) ||
          (String(item.sku || '').toLowerCase().includes(term)) ||
          (String(item.category || '').toLowerCase().includes(term)) ||
          (String(item.brand || '').toLowerCase().includes(term)) ||
          (String(item.unit || '').toLowerCase().includes(term))
        );
        
        // Search in location names
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
    
    // Calculate totals
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

  // Method to clear all filters
  clearFilters() {
    this.searchTerm = '';
    this.applyFilter();
  }

  /**
   * Get stock for a specific product at a specific location
   */
  getStockForLocation(item: StockReportItem, locationId: string): LocationStockInfo | null {
    return item.locationStocks[locationId] || null;
  }

  /**
   * Get total stock across all locations for a product
   */
  getTotalStock(item: StockReportItem): number {
    return Object.values(item.locationStocks || {}).reduce((total, stock) => total + (stock.currentStock || 0), 0);
  }

  /**
   * Get locations that have stock for a product
   */
  getLocationsWithStock(item: StockReportItem): string[] {
    return Object.keys(item.locationStocks || {}).filter(locationId => 
      item.locationStocks[locationId].currentStock > 0
    );
  }

  /**
   * Get total stock for a specific location across all products
   */
  getTotalStockForLocation(locationId: string): number {
    return this.paginatedStockData.reduce((total, item) => {
      const stock = this.getStockForLocation(item, locationId);
      return total + (stock ? (stock.currentStock || 0) : 0);
    }, 0);
  }

  /**
   * Get grand total stock across all locations and products
   */
  getGrandTotalStock(): number {
    return this.paginatedStockData.reduce((total, item) => total + this.getTotalStock(item), 0);
  }

  /**
   * Get products with low stock alerts
   */
  getLowStockProducts(): StockReportItem[] {
    return this.filteredData.filter(item => this.hasLowStockAlert(item));
  }

  /**
   * Get locations with low stock for a specific product
   */
  getLocationsWithLowStock(item: StockReportItem): string[] {
    return Object.values(item.locationStocks || {})
      .filter(stock => stock.currentStock <= item.alertQuantity)
      .map(stock => stock.locationName);
  }

  /**
   * Check if product has low stock alert at any location
   */
  hasLowStockAlert(item: StockReportItem): boolean {
    return Object.values(item.locationStocks || {}).some(stock => 
      stock.currentStock <= item.alertQuantity
    );
  }

  /**
   * Get current date formatted for display
   */
  getCurrentDate(): string {
    return new Date().toLocaleString();
  }

  /**
   * Get total opening stock across all locations for a product
   */
  getTotalOpeningStock(item: StockReportItem): number {
    return Object.values(item.locationStocks).reduce((total, stock) => {
      return total + (stock.openingStock || 0);
    }, 0);
  }

  /**
   * Get total closing stock across all locations for a product
   */
  getTotalClosingStock(item: StockReportItem): number {
    return Object.values(item.locationStocks).reduce((total, stock) => {
      return total + (stock.closingStock || 0);
    }, 0);
  }

  /**
   * Get opening stock for a specific product at a specific location
   */
  getOpeningStockForLocation(item: StockReportItem, locationId: string): number {
    const stock = this.getStockForLocation(item, locationId);
    return stock ? stock.openingStock : 0;
  }

  /**
   * Get closing stock for a specific product at a specific location
   */
  getClosingStockForLocation(item: StockReportItem, locationId: string): number {
    const stock = this.getStockForLocation(item, locationId);
    return stock ? stock.closingStock : 0;
  }

  // End of Day Processing Method
  async processEndOfDay() {
    this.eodProcessing = true;
    this.eodError = null;
    this.eodSuccess = false;
    
    try {
      await this.endOfDayService.processEndOfDay();
      
      // Also process end of day in DailyStockService
      await this.dailyStockService.processEndOfDay(new Date());
      
      this.eodSuccess = true;
      // Refresh the report after EOD processing
      await this.loadStockReport();
    } catch (error) {
      this.eodError = error instanceof Error ? error.message : 'Unknown error occurred during End of Day processing';
      console.error('End of Day processing error:', error);
    } finally {
      this.eodProcessing = false;
    }
  }
}