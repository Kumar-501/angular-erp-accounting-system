import { Component, OnInit, OnDestroy } from '@angular/core';
import { ProductsService } from '../services/products.service';
import { LocationService } from '../services/location.service';
import { Firestore, collection, doc, getDoc, getDocs, query, where, Timestamp } from '@angular/fire/firestore';
import { StockService } from '../services/stock.service';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { SaleService } from '../services/sale.service';
import { EndOfDayService } from '../services/end-of-day.service'; // Add this import

interface StockHistoryEntry {
  productId: string;
  locationId: string;
  action: string; 
  quantityChange: number;
  newStock: number;
  timestamp: any;
  reference?: string;
  user?: string;
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
  locationId: string;
  locationName: string;
  openingStock: number;
  currentStock: number;
  closingStock: number;
  totalSold: number;
  salesHistory: Array<{
    date: Date;
    quantity: number;
    invoiceNo: string;
  }>;
  alertQuantity: number;
  purchasePrice: number;
  sellingPrice: number;
  margin: number;
  taxPercentage: number;
  lastUpdated: Date;
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
  
  // Location filtering
  selectedLocationId: string = '';

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
    private endOfDayService: EndOfDayService // Add this injection
  ) {}

  async ngOnInit() {
    this.setDateFilter('today'); // Initialize with today's filter
    await this.loadLocations();  // Load locations first
    await this.loadStockReport();
      this.loadStockReport();

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
      
      // Get current products with real-time stock
      const products = await this.productsService.fetchAllProducts();
      
      // Get previous day's closing stock (which becomes today's opening stock)
      const previousDayEnd = new Date(this.openingStockStartTime);
      previousDayEnd.setDate(previousDayEnd.getDate() - 1);
      previousDayEnd.setHours(23, 59, 59, 999);
      
      // Initialize today's stock records if not exists
      await this.stockService.initializeDailyStock(new Date());
      
      // Get yesterday's closing stock snapshot
      const previousDayStock = await this.stockService.getDailyStockSnapshot(previousDayEnd);
      
      this.stockData = products.map((product: Product) => {
        // Previous day's closing becomes today's opening
        const openingStock = previousDayStock[product.id || '']?.closing || 
                           product.currentStock || 0;
        
        // Current stock is real-time value
        const currentStock = product.currentStock || 0;
        
        // Closing stock equals current stock (simplified approach)
        const closingStock = currentStock;
        
        // Calculate total sold as opening stock - closing stock
        const totalSold = Math.max(openingStock - closingStock, 0);
        
        const location = this.locations.find(l => l.id === product.location);
        
        return {
          id: product.id || '',
          productName: product.productName || '',
          sku: product.sku || '',
          category: product.category || '-',
          brand: product.brand || '-',
          locationId: product.location || '',
          locationName: location ? location.name : 'No Location',
          unit: product.unit || '',
          openingStock: openingStock,
          currentStock: currentStock,
          closingStock: closingStock,
          totalSold: totalSold,
          salesHistory: [],
          alertQuantity: product.alertQuantity || 0,
          purchasePrice: product.defaultPurchasePriceExcTax || 0,
          sellingPrice: product.defaultSellingPriceExcTax || 0,
          margin: product.marginPercentage || 0,
          taxPercentage: product.taxPercentage || 0,
          lastUpdated: product.updatedAt ? 
            (typeof product.updatedAt === 'object' && 'toDate' in product.updatedAt ? 
             product.updatedAt.toDate() : new Date(product.updatedAt)) : new Date()
        };
      });
      
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
        return (
          (String(item.productName || '').toLowerCase().includes(term)) ||
          (String(item.sku || '').toLowerCase().includes(term)) ||
          (String(item.category || '').toLowerCase().includes(term)) ||
          (String(item.brand || '').toLowerCase().includes(term)) ||
          (String(item.locationName || '').toLowerCase().includes(term)) ||
          (String(item.unit || '').toLowerCase().includes(term))
        );
      });
    }

    // Apply location filter
    if (this.selectedLocationId && this.selectedLocationId.trim() !== '') {
      filtered = filtered.filter(item => item.locationId === this.selectedLocationId);
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
    this.selectedLocationId = '';
    this.applyFilter();
  }

  // End of Day Processing Method
  async processEndOfDay() {
    this.eodProcessing = true;
    this.eodError = null;
    this.eodSuccess = false;
    
    try {
      await this.endOfDayService.processEndOfDay();
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