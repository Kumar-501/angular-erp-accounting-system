import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { LocationService } from '../services/location.service';
import { SaleService } from '../services/sale.service';
import { PurchaseStockPriceLogService, PurchaseStockPriceLog } from '../services/purchase-stock-price-log.service';
import { SalesStockPriceLogService, SalesStockPriceLog } from '../services/sales-stock-price-log.service';
import { GinTransferService, GinTransfer } from '../services/gin-transfer.service';
import { GoodsService } from '../services/goods.service';
import { ReturnService } from '../services/return.service';
import { AdjustmentService } from '../services/adjustment.service';
import { PurchaseReturnService } from '../services/purchase-return.service';
import { Subscription } from 'rxjs';
import { Firestore, collection, getDocs, query, where, doc, getDoc } from '@angular/fire/firestore';

interface ProductHistoryItem {
  id: string;
  date: Date;
  type: string;
  referenceNo: string;
  locationName: string;
  locationId: string;
  quantityChange: number;
  newQuantity: number;
  unitPrice: number;
  totalValue: number;
  taxRate: number;
  taxAmount: number;
  status: string;
  details: string;
  originalData?: any;
}

interface Location {
  id: string;
  name: string;
  locationName?: string;
  address?: string;
  isActive?: boolean;
}

interface SalesReturnLog {
  id?: string;
  saleId: string;
  returnDate: Date;
  paymentAccountId: string;
  items: SalesReturnLogItem[];
  createdAt?: Date;
  taxRate?: number;
  taxAmount?: number;
  locationId?: string;
  locationName?: string;
}

interface SalesReturnLogItem {
  productId: string;
  productName: string;
  quantity: number;
  returnQuantity: number;
  unitPrice: number;
  subtotal: number;
  reason?: string;
  taxRate?: number;
  taxAmount?: number;
  locationId?: string;
  locationName?: string;
}

interface PurchaseReturnItem {
  id?: string;
  returnDate: any;
  productId?: string;
  productName?: string;
  returnQuantity?: number;
  quantity?: number;
  referenceNo?: string;
  parentPurchaseRef?: string;
  businessLocationId?: string;
  businessLocation?: string;
  returnStatus?: string;
  status?: string;
  products?: {
    productId: any;
    productName: any;
    quantity: any;
    returnQuantity: any;
  }[];
}

interface StockAdjustment {
  _debugInfo: any;
  id?: string;
  date: Date | any;
  referenceNo?: string;
  businessLocation?: string;
  businessLocationId?: string;
  adjustmentType: 'addition' | 'deduction';
  products: StockAdjustmentProduct[];
  totalAmount: number;
  totalAmountRecovered?: number;
  reason?: string;
  createdAt?: Date | any;
  updatedAt?: Date | any;
  addedBy?: string;
  status?: string;
}

interface StockAdjustmentProduct {
  id: string;
  productId: string;
  productName: string;
  name?: string;
  sku?: string;
  quantity: number;
  unitPrice?: number;
  currentStock?: number;
  adjustedQuantity?: number;
  reason?: string;
}

@Component({
  selector: 'app-product-purchase-details',
  templateUrl: './product-purchase-details.component.html',
  styleUrls: ['./product-purchase-details.component.scss']
})
export class ProductPurchaseDetailsComponent implements OnInit, OnDestroy {
  product: any = null;
  locations: Location[] = [];
  locationMap: Map<string, string> = new Map();
  isLoading: boolean = false;
  
  // Filter properties
  selectedLocationId: string = '';
  dateFromFilter: string = '';
  dateToFilter: string = '';
  
  // Data arrays for all transaction types
  private purchaseLogs: PurchaseStockPriceLog[] = [];
  private salesLogs: SalesStockPriceLog[] = [];
  private grnLogs: any[] = [];
  private ginTransfers: GinTransfer[] = [];
  private stockAdjustments: StockAdjustment[] = [];
  private purchaseReturns: PurchaseReturnItem[] = [];
  private salesReturns: SalesReturnLog[] = [];
  
  // Product History Timeline properties
  productHistory: ProductHistoryItem[] = [];
  filteredProductHistory: ProductHistoryItem[] = [];
  displayedTransactionsCount: number = 10;
  transactionsPerPage: number = 10;
  private runningQuantity: number = 0;

  private locationsSubscription: Subscription | undefined;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private locationService: LocationService,
    private saleService: SaleService,
    private purchaseStockPriceLogService: PurchaseStockPriceLogService,
    private salesStockPriceLogService: SalesStockPriceLogService,
    private ginTransferService: GinTransferService,
    private goodsService: GoodsService,
    private firestore: Firestore,
    private purchaseReturnService: PurchaseReturnService,
    private returnService: ReturnService,
    private adjustmentService: AdjustmentService
  ) { }

  async ngOnInit(): Promise<void> {
    this.isLoading = true;
    
    try {
      // Load locations first
      await this.loadLocationsEnhanced();

      // Get product data from navigation or route
      const navigation = window.history.state;
      
      if (navigation.productData) {
        this.product = navigation.productData;
      } else {
        // Handle case where data wasn't passed via state
        const productId = this.route.snapshot.paramMap.get('id');
        if (productId) {
          console.log('Loading product data for ID:', productId);
        }
      }

      if (this.product) {
        // Initialize date filters to current financial year or reasonable defaults
        this.initializeDateFilters();
        
        // Load all transaction data
        await this.loadAllTransactionData();
        
        // Build the unified product history timeline
        this.buildProductHistoryTimeline();
        
        // Apply initial filters
        this.applyFilters();
        
        // Log final data state for debugging
        console.log('Final data state:', {
          product: this.product,
          totalTransactions: this.productHistory.length,
          filteredTransactions: this.filteredProductHistory.length,
          locations: this.locations.length
        });
      }
      
    } catch (error) {
      console.error('Error initializing component:', error);
    } finally {
      this.isLoading = false;
    }
  }

  ngOnDestroy(): void {
    if (this.locationsSubscription) {
      this.locationsSubscription.unsubscribe();
    }
  }

  // Initialize date filters
  private initializeDateFilters(): void {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    
    // Set default date range to current financial year (April to March)
    const financialYearStart = new Date(currentYear, 3, 1); // April 1st
    const financialYearEnd = new Date(currentYear + 1, 2, 31); // March 31st next year
    
    // If current date is before April, use previous financial year
    if (currentDate.getMonth() < 3) {
      financialYearStart.setFullYear(currentYear - 1);
      financialYearEnd.setFullYear(currentYear);
    }
    
    this.dateFromFilter = this.formatDateForInput(financialYearStart);
    this.dateToFilter = this.formatDateForInput(financialYearEnd);
  }

  // Filter event handlers
  onLocationFilterChange(): void {
    console.log('Location filter changed:', this.selectedLocationId);
    this.applyFilters();
  }

  onDateFilterChange(): void {
    console.log('Date filter changed:', this.dateFromFilter, this.dateToFilter);
    this.applyFilters();
  }

  // Apply all active filters
  private applyFilters(): void {
    this.filteredProductHistory = this.productHistory.filter(item => {
      // Location filter
      if (this.selectedLocationId && item.locationId !== this.selectedLocationId) {
        return false;
      }

      // Date range filter
      if (this.dateFromFilter || this.dateToFilter) {
        const itemDate = item.date;
        
        if (this.dateFromFilter) {
          const fromDate = new Date(this.dateFromFilter);
          if (itemDate < fromDate) return false;
        }
        
        if (this.dateToFilter) {
          const toDate = new Date(this.dateToFilter);
          toDate.setHours(23, 59, 59, 999); // Include the entire day
          if (itemDate > toDate) return false;
        }
      }

      return true;
    });

    // Recalculate running quantity for filtered results
    this.recalculateFilteredQuantities();

    // Reset pagination
    this.displayedTransactionsCount = this.transactionsPerPage;

    console.log('Filters applied. Showing', this.filteredProductHistory.length, 'of', this.productHistory.length, 'transactions');
  }

  // Recalculate running quantities for filtered data
  private recalculateFilteredQuantities(): void {
    // Sort filtered data by date (oldest first) for quantity calculation
    const sortedForCalculation = [...this.filteredProductHistory].sort((a, b) => a.date.getTime() - b.date.getTime());
    
    let runningQty = 0;
    
    sortedForCalculation.forEach(item => {
      runningQty += item.quantityChange;
      item.newQuantity = runningQty;
    });

    this.runningQuantity = runningQty;

    // Sort back to newest first for display
    this.filteredProductHistory.sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  // Filter management methods
  resetFilters(): void {
    this.selectedLocationId = '';
    this.dateFromFilter = '';
    this.dateToFilter = '';
    this.applyFilters();
  }

  clearLocationFilter(): void {
    this.selectedLocationId = '';
    this.applyFilters();
  }

  clearDateFromFilter(): void {
    this.dateFromFilter = '';
    this.applyFilters();
  }

  clearDateToFilter(): void {
    this.dateToFilter = '';
    this.applyFilters();
  }

  hasActiveFilters(): boolean {
    return !!(this.selectedLocationId || this.dateFromFilter || this.dateToFilter);
  }

  getFilteredTransactionsCount(): number {
    return this.filteredProductHistory.length;
  }

  getDateRangeDisplay(): string {
    if (this.dateFromFilter && this.dateToFilter) {
      return `${this.dateFromFilter} to ${this.dateToFilter}`;
    } else if (this.dateFromFilter) {
      return `From ${this.dateFromFilter}`;
    } else if (this.dateToFilter) {
      return `Until ${this.dateToFilter}`;
    }
    return 'All Time';
  }

  // Get filtered product history for display
  getFilteredProductHistory(): ProductHistoryItem[] {
    return this.filteredProductHistory;
  }

  // Updated methods to work with filtered data
  getDisplayedHistory(): ProductHistoryItem[] {
    return this.filteredProductHistory.slice(0, this.displayedTransactionsCount);
  }

  hasMoreTransactions(): boolean {
    return this.displayedTransactionsCount < this.filteredProductHistory.length;
  }

  getRemainingTransactionsCount(): number {
    return this.filteredProductHistory.length - this.displayedTransactionsCount;
  }

  loadMoreTransactions(): void {
    this.displayedTransactionsCount += this.transactionsPerPage;
  }

  // Updated summary calculation methods to work with filtered data
  getTotalPurchaseQuantity(): number {
    return this.filteredProductHistory
      .filter(h => h.type === 'purchase')
      .reduce((sum, h) => sum + h.quantityChange, 0);
  }

  getTotalSalesReturnQuantity(): number {
    return this.filteredProductHistory
      .filter(h => h.type === 'sales_return')
      .reduce((sum, h) => sum + h.quantityChange, 0);
  }

    // UPDATED: Include transfer_in for this calculation
  getTotalGoodsIssueInQuantity(): number {
    return this.filteredProductHistory
      .filter(h => h.type === 'adjustment_in' || h.type === 'transfer_in')
      .reduce((sum, h) => sum + h.quantityChange, 0);
  }

  getTotalSoldQuantity(): number {
    return this.filteredProductHistory
      .filter(h => h.type === 'sale')
      .reduce((sum, h) => sum + Math.abs(h.quantityChange), 0);
  }

  getTotalStockAdjustmentQuantity(): number {
    return this.filteredProductHistory
      .filter(h => h.type === 'adjustment_out')
      .reduce((sum, h) => sum + Math.abs(h.quantityChange), 0);
  }

  getTotalPurchaseReturnQuantity(): number {
    return this.filteredProductHistory
      .filter(h => h.type === 'purchase_return')
      .reduce((sum, h) => sum + Math.abs(h.quantityChange), 0);
  }

  getTotalGoodsIssueOutQuantity(): number {
    return this.filteredProductHistory
      .filter(h => h.type === 'transfer_out')
      .reduce((sum, h) => sum + Math.abs(h.quantityChange), 0);
  }

  getCurrentStock(): number {
    return this.runningQuantity;
  }

  // Helper method to format date for input
  private formatDateForInput(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private async loadAllTransactionData(): Promise<void> {
    const productId = this.product?.id;
    if (!productId) return;

    try {
      await Promise.all([
        this.loadPurchaseLogs(productId),
        this.loadSalesLogs(productId),
        this.loadGrnLogs(productId),
        this.loadGinTransferLogs(productId),
        this.loadStockAdjustmentLogs(productId),
        this.loadPurchaseReturnLogs(productId),
        this.loadSalesReturnLogs(productId)
      ]);
    } catch (error) {
      console.error('Error loading transaction data:', error);
    }
  }

  private async loadPurchaseLogs(productId: string): Promise<void> {
    try {
      this.purchaseLogs = await this.purchaseStockPriceLogService.getLogsByProductId(productId);
      console.log('Purchase logs loaded:', this.purchaseLogs.length);
    } catch (error) {
      console.warn('Error loading purchase logs:', error);
      this.purchaseLogs = [];
    }
  }

  private async loadSalesLogs(productId: string): Promise<void> {
    try {
      // Try service method first
      if (this.salesStockPriceLogService['getLogsByProductId']) {
        this.salesLogs = await this.salesStockPriceLogService['getLogsByProductId'](productId);
      } else {
        // Fallback to sales service
        const sales = await this.saleService.getSalesByProductId(productId);
        this.salesLogs = sales.map(sale => {
          const productItem = sale.products?.find((p: any) => 
            p.productId === productId || p.id === productId
          );
          if (!productItem) return null;
          
          return {
            saleId: sale['id'],
            invoiceNo: sale['invoiceNo'],
            productId: productItem.productId || (productItem as any).id,
            productName: (productItem as any).name || productItem.productName,
            quantity: productItem.quantity,
            sellingPrice: productItem.unitPrice,
            location: sale['businessLocation'] || sale['location'],
            locationId: sale['businessLocationId'] || sale['businessLocation'],
            paymentAccountId: sale['paymentAccountId'] || sale['paymentAccount'],
            paymentType: sale['paymentMethod'],
            // CRITICAL FIX: Use completedAt first, then saleDate, then createdAt
            saleCreatedDate: sale['completedAt'] || sale['saleDate'] || sale['createdAt'],
            createdAt: sale['createdAt']
          } as SalesStockPriceLog;
        }).filter(log => log !== null) as SalesStockPriceLog[];
      }
      console.log('Sales logs loaded:', this.salesLogs.length);
    } catch (error) {
      console.warn('Error loading sales logs:', error);
      this.salesLogs = [];
    }
  }

  private async loadGrnLogs(productId: string): Promise<void> {
    return new Promise((resolve) => {
      this.goodsService.getAllGoodsReceived().subscribe({
        next: (allGrns: any[]) => {
          this.grnLogs = allGrns.filter((grn: any) => {
            if (!grn.products || !Array.isArray(grn.products)) return false;
            return grn.products.some((product: any) => 
              product.productId === productId || 
              product.id === productId ||
              (this.product?.productName && product.productName === this.product.productName)
            );
          });
          console.log('GRN logs loaded:', this.grnLogs.length);
          resolve();
        },
        error: (error) => {
          console.warn('Error loading GRN logs:', error);
          this.grnLogs = [];
          resolve();
        }
      });
    });
  }

private async loadGinTransferLogs(productId: string): Promise<void> {
  return new Promise((resolve) => {
    this.ginTransferService.getGinTransfers().subscribe({
      next: (allTransfers) => {
        // Product டேட்டா இருக்கிறதா என சரிபார்க்கவும்
        if (!this.product || !this.product.id) {
          console.warn('Product data is not available for filtering GIN transfers.');
          this.ginTransfers = [];
          resolve();
          return;
        }

        const currentProductId = this.product.id.toLowerCase();
        const currentProductName = this.product.productName?.toLowerCase() || '---';

        this.ginTransfers = allTransfers.filter(transfer => {
          // புதிய structure-ஐ சரிபார்க்கவும் (transfers array)
          const inNewStructure = transfer.transfers?.some(locTransfer =>
            locTransfer.products.some(p =>
              (p.productId?.toLowerCase() === currentProductId) ||
              (p.productName?.toLowerCase() === currentProductName)
            )
          );

          // பழைய structure-ஐ சரிபார்க்கவும் (items array)
          const inLegacyStructure = transfer.items?.some(item =>
            (item.productId?.toLowerCase() === currentProductId) ||
            (item.productName?.toLowerCase() === currentProductName)
          );

          return !!(inNewStructure || inLegacyStructure);
        });

        console.log(`GIN transfers loaded and filtered: ${this.ginTransfers.length} entries found for product ID ${this.product.id}`);
        resolve();
      },
      error: (error) => {
        console.warn('Error loading GIN transfer logs:', error);
        this.ginTransfers = [];
        resolve();
      }
    });
  });
}

  // FIXED: Enhanced stock adjustment loading with proper timestamp handling
  private async loadStockAdjustmentLogs(productId: string): Promise<void> {
    return new Promise((resolve) => {
      this.adjustmentService.getStockAdjustments().subscribe({
        next: (allAdjustments: StockAdjustment[]) => {
          console.log('Raw adjustments loaded:', allAdjustments.length);
          
          // Filter adjustments that contain our target product
          this.stockAdjustments = allAdjustments.filter(adjustment => {
            if (!adjustment.products || !Array.isArray(adjustment.products)) return false;
            
            const hasTargetProduct = adjustment.products.some(product => 
              product.productId === productId || 
              product.id === productId ||
              product.productName === this.product?.productName ||
              product.name === this.product?.productName
            );
            
            if (hasTargetProduct) {
              console.log('Found matching product in adjustment:', {
                adjustmentId: adjustment.id,
                referenceNo: adjustment.referenceNo,
                adjustmentType: adjustment.adjustmentType,
                rawDate: adjustment.date,
                createdAt: adjustment.createdAt,
                targetProductId: productId,
                targetProductName: this.product?.productName
              });
            }
            
            return hasTargetProduct;
          }).map(adjustment => {
            // FIXED: Ensure proper date parsing for adjustments
            return {
              ...adjustment,
              date: this.parseAdjustmentDate(adjustment.date || adjustment.createdAt),
              createdAt: this.parseAdjustmentDate(adjustment.createdAt),
              updatedAt: this.parseAdjustmentDate(adjustment.updatedAt),
              // Enhanced logging for debugging
              _debugInfo: {
                originalDate: adjustment.date,
                originalCreatedAt: adjustment.createdAt,
                parsedDate: this.parseAdjustmentDate(adjustment.date || adjustment.createdAt),
                adjustmentType: adjustment.adjustmentType,
                referenceNo: adjustment.referenceNo
              }
            };
          });
          
          console.log('Stock adjustment logs loaded and filtered:', this.stockAdjustments.length);
          console.log('Filtered adjustments:', this.stockAdjustments.map(adj => ({
            id: adj.id,
            referenceNo: adj.referenceNo,
            type: adj.adjustmentType,
            date: adj.date,
            debugInfo: adj._debugInfo,
            products: adj.products?.map(p => ({ name: p.name || p.productName, qty: p.quantity }))
          })));
          
          resolve();
        },
        error: (error) => {
          console.warn('Error loading stock adjustment logs:', error);
          this.stockAdjustments = [];
          resolve();
        }
      });
    });
  }

  // ENHANCED: Specific method for parsing adjustment dates with better handling
  private parseAdjustmentDateCorrectly(adjustment: any): Date {
    console.log('Parsing adjustment date for:', adjustment.referenceNo, 'Raw date:', adjustment.date);
    
    // Priority 1: Use the 'date' field (user-selected datetime from form)
    if (adjustment.date) {
      let parsedDate = this.parseDate(adjustment.date);
      if (parsedDate.getTime() > 0) { // Valid date
        console.log('✅ Used adjustment.date:', parsedDate);
        return parsedDate;
      } else {
        console.warn('⚠️ adjustment.date was invalid:', adjustment.date);
      }
    }
    
    // Priority 2: Use createdAt as fallback
    if (adjustment.createdAt) {
      let parsedDate = this.parseDate(adjustment.createdAt);
      if (parsedDate.getTime() > 0) { // Valid date
        console.log('✅ Used adjustment.createdAt as fallback:', parsedDate);
        return parsedDate;
      } else {
        console.warn('⚠️ adjustment.createdAt was invalid:', adjustment.createdAt);
      }
    }
    
    // Priority 3: Use updatedAt as last resort
    if (adjustment.updatedAt) {
      let parsedDate = this.parseDate(adjustment.updatedAt);
      if (parsedDate.getTime() > 0) { // Valid date
        console.log('✅ Used adjustment.updatedAt as last resort:', parsedDate);
        return parsedDate;
      } else {
        console.warn('⚠️ adjustment.updatedAt was invalid:', adjustment.updatedAt);
      }
    }
    
    console.error('❌ Could not parse any date for adjustment:', adjustment.referenceNo);
    return new Date(); // Current time as absolute fallback
  }

  // Enhanced date parsing specifically for adjustments
  private parseAdjustmentDate(dateValue: any): Date {
    if (!dateValue) {
      console.warn('parseAdjustmentDate: No date value provided');
      return new Date(0);
    }
    
    // If it's already a Date object, validate and return it
    if (dateValue instanceof Date) {
      if (isNaN(dateValue.getTime())) {
        console.warn('Invalid Date object in adjustment:', dateValue);
        return new Date(0);
      }
      return dateValue;
    }
    
    // Handle Firestore Timestamp object (most common case)
    if (typeof dateValue === 'object' && typeof dateValue.toDate === 'function') {
      try {
        const parsed = dateValue.toDate();
        if (parsed instanceof Date && !isNaN(parsed.getTime())) {
          return parsed;
        }
      } catch (error) {
        console.warn('Error calling toDate() on Firestore Timestamp:', error);
      }
    }
    
    // Handle older Firestore Timestamp format (seconds/nanoseconds)
    if (typeof dateValue === 'object' && dateValue.seconds) {
      try {
        const milliseconds = dateValue.seconds * 1000 + (dateValue.nanoseconds || 0) / 1000000;
        const parsed = new Date(milliseconds);
        if (!isNaN(parsed.getTime())) {
          return parsed;
        }
      } catch (error) {
        console.warn('Error parsing Firestore Timestamp format:', error);
      }
    }
    
    // Handle datetime-local strings (from HTML forms)
    if (typeof dateValue === 'string') {
      // Check if it's a datetime-local format (YYYY-MM-DDTHH:mm)
      const datetimeLocalRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
      if (datetimeLocalRegex.test(dateValue)) {
        try {
          // Parse as local time (not UTC)
          const parsed = new Date(dateValue);
          if (!isNaN(parsed.getTime())) {
            console.log('Parsed datetime-local string:', dateValue, 'as:', parsed);
            return parsed;
          }
        } catch (error) {
          console.warn('Error parsing datetime-local string:', error);
        }
      }
    }
    
    // Handle ISO strings, Unix timestamps, or other parsable formats
    try {
      const parsed = new Date(dateValue);
      if (!isNaN(parsed.getTime())) {
        // Additional validation: ensure it's not an absurdly old or future date
        const year = parsed.getFullYear();
        if (year >= 1900 && year <= 3000) {
          return parsed;
        } else {
          console.warn(`parseAdjustmentDate: Date year ${year} is outside reasonable range`);
        }
      }
    } catch (error) {
      console.warn('parseAdjustmentDate: Error parsing date with Date constructor:', error);
    }
    
    // Fallback if parsing fails
    console.warn('Could not parse adjustment date, returning epoch. Input was:', dateValue);
    return new Date(0);
  }

  private async loadPurchaseReturnLogs(productId: string): Promise<void> {
    try {
      this.purchaseReturns = await this.purchaseReturnService.getPurchaseReturnsByProductId(productId);
      console.log('Purchase return logs loaded:', this.purchaseReturns.length);
    } catch (error) {
      console.warn('Error loading purchase return logs:', error);
      this.purchaseReturns = [];
    }
  }

  // FIXED: Enhanced sales return loading with location resolution
  private async loadSalesReturnLogs(productId: string): Promise<void> {
    try {
      // Get sales returns by product ID
      const returnsByProductId = await this.returnService.getReturnsByProductId(productId);
      
      // Also try to get by product name if available
      let returnsByProductName: SalesReturnLog[] = [];
      if (this.product?.productName) {
        returnsByProductName = await this.returnService.getReturnsByProductName(this.product.productName);
      }
      
      // Combine and deduplicate results
      const allReturns = [...returnsByProductId, ...returnsByProductName];
      const uniqueReturns = allReturns.filter((item, index, self) => 
        index === self.findIndex(t => t.id === item.id)
      );
      
      // Filter returns to only include items for this specific product and enhance with location data
      this.salesReturns = await Promise.all(
        uniqueReturns.map(async (returnLog) => {
          // Get location information from the original sale
          let locationId = '';
          let locationName = 'Unknown Location';
          
          try {
            // Try to get location from the original sale
            if (returnLog.saleId) {
              const saleDoc = await getDoc(doc(this.firestore, 'sales', returnLog.saleId));
              if (saleDoc.exists()) {
                const saleData = saleDoc.data();
                locationId = saleData['businessLocationId'] || saleData['businessLocation'] || '';
                locationName = this.getLocationName(locationId) || 'Unknown Location';
              }
            }
          } catch (error) {
            console.warn('Error getting sale location for return:', error);
          }
          
          return {
            ...returnLog,
            locationId,
            locationName,
            items: returnLog.items.filter(item => 
              item.productId === productId || 
              item.productName === this.product?.productName
            ).map(item => ({
              ...item,
              locationId,
              locationName
            }))
          };
        })
      );
      
      // Filter out returns with no matching items
      this.salesReturns = this.salesReturns.filter(returnLog => returnLog.items.length > 0);
      
      console.log('Sales return logs loaded:', this.salesReturns.length);
    } catch (error) {
      console.warn('Error loading sales return logs:', error);
      this.salesReturns = [];
    }
  }

  // Build unified product history timeline
  private buildProductHistoryTimeline(): void {
    this.productHistory = [];
    this.runningQuantity = 0;

    // Get all transaction data
    const allTransactions = this.getAllTransactionsForTimeline();
    
    console.log('All transactions before timeline building:', {
      total: allTransactions.length,
      byType: allTransactions.reduce((acc, t) => {
        acc[t.type] = (acc[t.type] || 0) + 1;
        return acc;
      }, {} as any)
    });
    
    // Sort by date (oldest first for quantity calculation)
    allTransactions.sort((a, b) => a.date.getTime() - b.date.getTime());
    
    // Process each transaction to build history
    allTransactions.forEach(transaction => {
      const historyItem = this.createHistoryItem(transaction);
      if (historyItem) {
        this.productHistory.push(historyItem);
      }
    });

    // Sort final history by date (newest first for display)
    this.productHistory.sort((a, b) => b.date.getTime() - a.date.getTime());

    console.log('Product history timeline built:', {
      totalItems: this.productHistory.length,
      byType: this.productHistory.reduce((acc, h) => {
        acc[h.type] = (acc[h.type] || 0) + 1;
        return acc;
      }, {} as any),
      adjustmentItems: this.productHistory.filter(h => h.type.includes('adjustment')).length
    });
  }

private getAllTransactionsForTimeline(): any[] {
    const transactions: any[] = [];
    const productId = this.product?.id;
    const productName = this.product?.productName;
    
    // Add purchase transactions (from GRN data)
    this.grnLogs.forEach((grn: any) => {
      if (grn.products && Array.isArray(grn.products)) {
        grn.products.forEach((product: any) => {
          if (product.productId === productId || product.productName === productName) {
            transactions.push({
              type: 'purchase',
              date: this.parseDate(grn.receivedDate || grn.createdAt),
              referenceNo: grn.referenceNo,
              locationId: grn.businessLocation?.id || grn.businessLocationId,
              quantity: product.receivedQuantity || product.quantity || 0,
              unitPrice: product.unitPrice || 0,
              status: grn.status || 'completed',
              originalData: grn
            });
          }
        });
      }
    });

    // CRITICAL FIX: Add sales transactions with correct date handling
    this.salesLogs.forEach((sale: any) => {
      transactions.push({
        type: 'sale',
        date: this.parseDate(sale.saleCreatedDate || sale.createdAt), // Use the correct timestamp
        referenceNo: sale.invoiceNo,
        locationId: sale.locationId || sale.location,
        quantity: -(sale.quantity || 0), // Negative for sales
        unitPrice: sale.sellingPrice || 0,
        status: 'completed',
        originalData: sale
      });
    });

    // ENHANCED: Add stock adjustments with proper date handling and detailed logging
    console.log('Processing stock adjustments for timeline:', this.stockAdjustments.length);
    
    this.stockAdjustments.forEach((adjustment: StockAdjustment) => {
      if (adjustment.products && Array.isArray(adjustment.products)) {
        adjustment.products.forEach((product: any) => {
          // Enhanced product matching
          const isTargetProduct = 
            product.productId === productId ||
            product.id === productId ||
            product.productName === productName ||
            product.name === productName;
          
          if (isTargetProduct) {
            const quantity = product.quantity || product.adjustedQuantity || 0;
            
            // FIX APPLIED HERE for logging
            console.log('Processing adjustment for timeline:', {
              adjustmentId: adjustment.id,
              referenceNo: adjustment.referenceNo,
              adjustmentType: adjustment.adjustmentType,
              productName: product.name || product.productName,
              quantity: quantity,
              targetProduct: { productId, productName },
              rawDate: adjustment.date,
              parsedDate: this.parseAdjustmentDateCorrectly(adjustment),
              locationId: adjustment.businessLocationId || adjustment.businessLocation
            });
            
            const adjustmentTransaction = {
              type: adjustment.adjustmentType === 'addition' ? 'adjustment_in' : 'adjustment_out',
              date: this.parseAdjustmentDateCorrectly(adjustment),
              referenceNo: adjustment.referenceNo,
              // FIX APPLIED HERE for the actual transaction data
              locationId: adjustment.businessLocationId || adjustment.businessLocation,
              quantity: adjustment.adjustmentType === 'addition' ? quantity : -quantity,
              unitPrice: product.unitPrice || 0,
              status: adjustment.status || 'completed',
              originalData: adjustment
            };
            
            console.log('Adding adjustment transaction to timeline:', adjustmentTransaction);
            transactions.push(adjustmentTransaction);
          }
        });
      }
    });

    // Add purchase returns
    this.purchaseReturns.forEach((returnItem: any) => {
      if (returnItem.products && Array.isArray(returnItem.products)) {
        returnItem.products.forEach((product: any) => {
          if (product.productId === productId || product.productName === productName) {
            transactions.push({
              type: 'purchase_return',
              date: this.parseDate(returnItem.returnDate || returnItem.createdAt), // Use returnItem instead of adjustment
              referenceNo: returnItem.referenceNo,
              locationId: returnItem.businessLocationId || returnItem.businessLocation?.id,
              quantity: -(product.returnQuantity || product.quantity || 0), // Negative for returns
              unitPrice: product.unitPrice || 0,
              status: returnItem.returnStatus || 'completed',
              originalData: returnItem
            });
          }
        });
      }
    });

    // FIXED: Add sales returns with proper location data
    this.salesReturns.forEach((returnLog: SalesReturnLog) => {
      returnLog.items.forEach((item: SalesReturnLogItem) => {
        if (item.productId === productId || item.productName === productName) {
          transactions.push({
            type: 'sales_return',
            date: this.parseDate(returnLog.returnDate),
            referenceNo: 'RET-' + (returnLog.id?.substring(0, 8) || 'UNKNOWN'),
            locationId: returnLog.locationId || item.locationId || '', // Use enhanced location data
            quantity: item.returnQuantity || 0, // Positive for sales returns (back to inventory)
            unitPrice: item.unitPrice || 0,
            taxRate: item.taxRate || 0,
            taxAmount: item.taxAmount || 0,
            status: 'completed',
            originalData: { returnLog, item }
          });
        }
      });
    });

    // ############ ENHANCED GIN TRANSFER LOGIC ############
    this.ginTransfers.forEach((transfer: GinTransfer) => {
        const productId = this.product?.id;
        const productName = this.product?.productName;

        // புதிய structure-ஐ கையாளவும் (transfers array)
        if (transfer.transfers && transfer.transfers.length > 0) {
            let totalQuantityTransferredOut = 0;
            const sourceLocationId = transfer.locationFrom;
            let productUnitPrice = 0;

            // முதலில், ஒவ்வொரு destination-க்கும் 'transfer_in' ரெக்கார்டை உருவாக்கவும்
            transfer.transfers.forEach(locationTransfer => {
                locationTransfer.products.forEach(product => {
                    if (product.productId === productId || product.productName === productName) {
                        const quantity = product.quantity || 0;
                        totalQuantityTransferredOut += quantity;
                        if (product.unitPrice > 0) {
                            productUnitPrice = product.unitPrice;
                        }

                        transactions.push({
                            type: 'transfer_in',
                            date: this.parseDate(transfer.date),
                            referenceNo: transfer.referenceNo,
                            locationId: locationTransfer.locationId, // Destination location
                            quantity: quantity, // IN-க்கு பாசிட்டிவ் குவாண்டிட்டி
                            unitPrice: product.unitPrice || 0,
                            status: transfer.status || 'completed',
                            originalData: transfer
                        });
                    }
                });
            });

            // பிறகு, source location-க்கு ஒரே ஒரு 'transfer_out' ரெக்கார்டை உருவாக்கவும்
            if (totalQuantityTransferredOut > 0) {
                transactions.push({
                    type: 'transfer_out',
                    date: this.parseDate(transfer.date),
                    referenceNo: transfer.referenceNo,
                    locationId: sourceLocationId, // Source location
                    quantity: -totalQuantityTransferredOut, // OUT-க்கு நெகட்டிவ் குவாண்டிட்டி
                    unitPrice: productUnitPrice,
                    status: transfer.status || 'completed',
                    originalData: transfer
                });
            }
        }
        // பழைய structure-ஐ கையாளவும் (items array)
        else if (transfer.items && transfer.locationTo) {
            transfer.items.forEach(item => {
                if (item.productId === productId || item.productName === productName) {
                    const quantity = item.quantity || 0;
                    if (quantity > 0) {
                        // Source-லிருந்து 'transfer_out'
                        transactions.push({
                            type: 'transfer_out',
                            date: this.parseDate(transfer.date),
                            referenceNo: transfer.referenceNo,
                            locationId: transfer.locationFrom,
                            quantity: -quantity,
                            unitPrice: item.unitPrice || 0,
                            status: transfer.status || 'completed',
                            originalData: transfer
                        });
                        // Destination-க்கு 'transfer_in'
                        transactions.push({
                            type: 'transfer_in',
                            date: this.parseDate(transfer.date),
                            referenceNo: transfer.referenceNo,
                            locationId: transfer.locationTo,
                            quantity: quantity,
                            unitPrice: item.unitPrice || 0,
                            status: transfer.status || 'completed',
                            originalData: transfer
                        });
                    }
                }
            });
        }
    });

    console.log('Final transactions for timeline:', {
      total: transactions.length,
      byType: transactions.reduce((acc, t) => {
        acc[t.type] = (acc[t.type] || 0) + 1;
        return acc;
      }, {} as any)
    });

    return transactions;
  }

  private createHistoryItem(transaction: any): ProductHistoryItem | null {
    if (!transaction) return null;

    // Update running quantity
    this.runningQuantity += transaction.quantity;

    // Calculate total value including tax if available
    const baseValue = Math.abs(transaction.quantity) * (transaction.unitPrice || 0);
    const totalValue = transaction.taxAmount ? 
      baseValue + (transaction.taxAmount || 0) : 
      baseValue;

    return {
      id: transaction.originalData?.adjustment?.id ||
          transaction.originalData?.id ||
          Math.random().toString(36).substr(2, 9),
      date: transaction.date,
      type: transaction.type,
      referenceNo: transaction.referenceNo || '-',
      locationName: this.getLocationName(transaction.locationId),
      locationId: transaction.locationId || '',
      quantityChange: transaction.quantity,
      newQuantity: this.runningQuantity,
      unitPrice: transaction.unitPrice || 0,
      totalValue: totalValue,
      taxRate: transaction.taxRate || 0,
      taxAmount: transaction.taxAmount || 0,
      status: transaction.status || 'completed',
      details: this.getTransactionDetails(transaction),
      originalData: transaction.originalData
    };
  }

  private getTransactionDetails(transaction: any): string {
    if (!transaction) return 'Transaction';
    
    const type = transaction.type;
    const originalData = transaction.originalData;
    
    switch (type) {
      case 'purchase':
        const supplier = this.getSupplierName(originalData);
        const poNumber = originalData?.poNumber || originalData?.referenceNo;
        const grnDetails = [];
        if (poNumber) grnDetails.push(`PO: ${poNumber}`);
        if (originalData?.receivedDate) {
          grnDetails.push(`Received: ${this.formatDate(this.parseDate(originalData.receivedDate))}`);
        }
        return `Purchased from ${supplier}${grnDetails.length ? ` (${grnDetails.join(', ')})` : ''}`;

      case 'sale':
        const saleDetails = [];
        const customerName = originalData?.customerName || originalData?.customer?.name || 'customer';
        if (originalData?.invoiceNo) saleDetails.push(`Invoice: ${originalData.invoiceNo}`);
        if (originalData?.saleDate) {
          saleDetails.push(`Date: ${this.formatDate(this.parseDate(originalData.saleDate))}`);
        }
        return `Sold to ${customerName}${saleDetails.length ? ` (${saleDetails.join(', ')})` : ''}`;

      case 'adjustment_in':
      case 'adjustment_out':
        const adjDetails = [];
        if (originalData?.referenceNo) adjDetails.push(`Ref: ${originalData.referenceNo}`);
        if (originalData?.reason) adjDetails.push(`Reason: ${originalData.reason}`);
        if (originalData?.addedBy) adjDetails.push(`By: ${originalData.addedBy}`);
        return `Stock ${type === 'adjustment_in' ? 'addition' : 'deduction'}${adjDetails.length ? ` (${adjDetails.join(', ')})` : ''}`;

      case 'purchase_return':
        const returnDetails = [];
        const returnSupplier = originalData?.supplier || 'supplier';
        if (originalData?.referenceNo) returnDetails.push(`Ref: ${originalData.referenceNo}`);
        if (originalData?.returnDate) {
          returnDetails.push(`Date: ${this.formatDate(this.parseDate(originalData.returnDate))}`);
        }
        return `Return to ${returnSupplier}${returnDetails.length ? ` (${returnDetails.join(', ')})` : ''}`;

      case 'sales_return':
        const salesReturnDetails = [];
        const returnCustomer = originalData?.returnLog?.customerName || 'customer';
        if (originalData?.returnLog?.saleId) salesReturnDetails.push(`Sale ID: ${originalData.returnLog.saleId}`);
        if (originalData?.item?.reason) salesReturnDetails.push(`Reason: ${originalData.item.reason}`);
        if (originalData?.item?.taxRate) {
          salesReturnDetails.push(`Tax: ${originalData.item.taxRate}%`);
        }
        return `Return from ${returnCustomer}${salesReturnDetails.length ? ` (${salesReturnDetails.join(', ')})` : ''}`;

      // UPDATED: Handle both transfer in and out details
     case 'transfer_out':
      case 'transfer_in':
        const fromLocation = this.getLocationName(originalData.locationFrom);
        const toLocations = (originalData.transfers || [])
          .map((t: any) => this.getLocationName(t.locationId))
          .join(', ');
        const legacyToLocation = this.getLocationName(originalData.locationTo);
        const allToLocations = toLocations || legacyToLocation;

        if (type === 'transfer_out') {
            return `Transfer from ${fromLocation} to ${allToLocations}`;
        } else {
            // For 'transfer_in', the 'transaction.locationId' is the destination
            return `Transfer from ${fromLocation} to ${this.getLocationName(transaction.locationId)}`;
        }

      default:
        return 'Transaction';
    }
  }


  // UI Helper Methods for timeline
  getTypeDisplayName(type: string): string {
    const typeMap: {[key: string]: string} = {
      'purchase': 'Purchase',
      'sale': 'Sale',
      'adjustment_in': 'Stock Add',
      'adjustment_out': 'Stock Deduct',
      'purchase_return': 'Purch Return',
      'sales_return': 'Sales Return',
          'transfer_in': 'Transfer In',    // Added
      'transfer_out': 'Transfer Out' 
    };
    return typeMap[type] || type;
  }

  getTypeBadgeClass(type: string): string {
    switch (type) {
      case 'purchase':
        return 'bg-success';
      case 'sale':
        return 'bg-primary';
      case 'adjustment_in':
        return 'bg-info';
      case 'adjustment_out':
        return 'bg-warning text-dark';
      case 'purchase_return':
        return 'bg-danger';
      case 'sales_return':
        return 'bg-secondary';
            case 'transfer_out':
        return 'bg-dark';
      case 'transfer_in':
        return 'bg-light text-dark';
      default:
        return 'bg-secondary';

    }
  }

  getTypeIcon(type: string): string {
    switch (type) {
      case 'purchase':
        return 'fa-plus-circle';
      case 'sale':
        return 'fa-minus-circle';
      case 'adjustment_in':
        return 'fa-arrow-up';
      case 'adjustment_out':
        return 'fa-arrow-down';
      case 'purchase_return':
        return 'fa-undo';
      case 'sales_return':
        return 'fa-undo-alt';
      case 'transfer_out':
        return 'fa-arrow-right';
      case 'transfer_in':
        return 'fa-arrow-left';
      default:
        return 'fa-circle';
    }
  }

  getQuantityChangeClass(quantityChange: number): string {
    if (quantityChange > 0) {
      return 'text-success fw-bold';
    } else if (quantityChange < 0) {
      return 'text-danger fw-bold';
    }
    return 'text-muted';
  }

  getStatusBadgeClass(status: string): string {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'received':
        return 'bg-success';
      case 'pending':
        return 'bg-warning text-dark';
      case 'cancelled':
        return 'bg-danger';
      default:
        return 'bg-secondary';
    }
  }

  // FIXED: Enhanced date and time methods with proper timezone handling
  /**
   * Formats only the date part of a Date object in local timezone.
   * @param date The full Date object.
   * @returns A formatted date string (e.g., "13/07/2025").
   */
  formatDate(date: Date): string {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) return '-';
    
    // Use Indian timezone formatting
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'Asia/Kolkata'
    });
  }

  /**
   * Formats only the time part of a Date object in local timezone.
   * @param date The full Date object.
   * @returns A formatted time string (e.g., "17:49:23").
   */
  formatTime(date: Date): string {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) return '-';
    
    // Use Indian timezone formatting with 24-hour format for accuracy
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false, // Use 24-hour format for precision
      timeZone: 'Asia/Kolkata'
    });
  }
  
  /**
   * ENHANCED: Robustly parses different date formats into a JavaScript Date object.
   * Handles Firestore Timestamps, ISO strings, and Date objects.
   * @param dateValue The raw date value from any data source.
   * @returns A valid Date object.
   */
private parseDate(dateValue: any): Date {
  // If no value, return epoch to avoid confusion with current time
  if (!dateValue) {
    // console.warn('parseDate: No date value provided, returning epoch');
    return new Date(0);
  }
  
  // If it's already a Date object, validate and return it
  if (dateValue instanceof Date) {
    if (isNaN(dateValue.getTime())) {
      // console.warn('parseDate: Invalid Date object provided, returning epoch');
      return new Date(0);
    }
    return dateValue;
  }
  
  // Handle Firestore Timestamp object (most common case)
  if (typeof dateValue === 'object' && typeof dateValue.toDate === 'function') {
    try {
      const parsed = dateValue.toDate();
      if (parsed instanceof Date && !isNaN(parsed.getTime())) {
        return parsed;
      }
    } catch (error) {
      // console.warn('parseDate: Error calling toDate() on Firestore Timestamp:', error);
    }
  }

  // **** FIX ADDED HERE: Handle "DD-MM-YYYY HH:mm" format ****
  if (typeof dateValue === 'string') {
    const customFormatRegex = /(\d{2})-(\d{2})-(\d{4})\s*(\d{2}:\d{2})?/;
    const match = dateValue.match(customFormatRegex);

    if (match) {
      const day = match[1];
      const month = match[2];
      const year = match[3];
      const time = match[4] || '00:00';
      // Rearrange to a standard format that new Date() can understand
      const standardFormatString = `${year}-${month}-${day}T${time}:00`;
      const parsed = new Date(standardFormatString);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }
  }

  // Handle other standard string formats (ISO, etc.) as a fallback
  try {
    const parsed = new Date(dateValue);
    if (!isNaN(parsed.getTime())) {
      const year = parsed.getFullYear();
      if (year > 1900) { // Basic validation
        return parsed;
      }
    }
  } catch (error) {
    // Fallback
  }
  
  // If all else fails, log it and return epoch
  console.warn('parseDate: Could not parse date, returning epoch. Input was:', dateValue);
  return new Date(0);
}

  trackHistoryItem(index: number, item: ProductHistoryItem): string {
    return item.id;
  }

  private getSupplierName(grn: any): string {
    if (!grn) return 'Unknown Supplier';
    if (grn.supplierName) return grn.supplierName;
    if (grn.supplierDetails) {
      return grn.supplierDetails.isIndividual ? 
        `${grn.supplierDetails.firstName} ${grn.supplierDetails.lastName || ''}`.trim() :
        grn.supplierDetails.businessName;
    }
    return 'Unknown Supplier';
  }

  // Location Loading Methods (Enhanced)
  private async loadLocationsEnhanced(): Promise<void> {
    try {
      console.log('Starting enhanced location loading...');
      
      const [serviceLocations, businessLocations, locationsCollection] = await Promise.all([
        this.tryLoadFromLocationService(),
        this.tryLoadFromBusinessLocations(),
        this.tryLoadFromLocationsCollection()
      ]);

      const allLocations = [...serviceLocations, ...businessLocations, ...locationsCollection];
      const uniqueLocations = this.removeDuplicateLocations(allLocations);

      if (uniqueLocations.length > 0) {
        this.locations = uniqueLocations;
        this.buildLocationMap();
        console.log('✅ Locations loaded:', this.locations.length);
      } else {
        console.warn('⚠️ No locations found from any source');
        this.locations = [];
      }
      
    } catch (error) {
      console.error('❌ Error in enhanced location loading:', error);
      this.locations = [];
    }
  }

  private async tryLoadFromLocationService(): Promise<Location[]> {
    return new Promise((resolve) => {
      try {
        const timeout = setTimeout(() => {
          console.warn('LocationService timeout');
          resolve([]);
        }, 5000);

        this.locationsSubscription = this.locationService.getLocations().subscribe({
          next: (locations) => {
            clearTimeout(timeout);
            const processedLocations = locations.map(loc => ({
              id: loc.id,
              name: this.extractLocationName(loc),
              locationName: loc.locationName,
              address: loc.address,
              isActive: loc.isActive !== false
            }));
            resolve(processedLocations);
          },
          error: (error) => {
            clearTimeout(timeout);
            console.warn('LocationService failed:', error);
            resolve([]);
          }
        });
      } catch (error) {
        console.warn('LocationService subscription failed:', error);
        resolve([]);
      }
    });
  }

  private async tryLoadFromBusinessLocations(): Promise<Location[]> {
    try {
      const businessLocationsRef = collection(this.firestore, 'businessLocations');
      const snapshot = await getDocs(businessLocationsRef);
      
      const locations = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: this.extractLocationName(data),
          locationName: data['locationName'],
          address: data['address'],
          isActive: data['isActive'] !== false
        };
      });

      return locations;
    } catch (error) {
      console.warn('businessLocations collection failed:', error);
      return [];
    }
  }

  private async tryLoadFromLocationsCollection(): Promise<Location[]> {
    try {
      const locationsRef = collection(this.firestore, 'locations');
      const snapshot = await getDocs(locationsRef);
      
      const locations = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: this.extractLocationName(data),
          locationName: data['locationName'],
          address: data['address'],
          isActive: data['isActive'] !== false
        };
      });

      return locations;
    } catch (error) {
      console.warn('locations collection failed:', error);
      return [];
    }
  }

  private extractLocationName(locationData: any): string {
    if (!locationData) return 'Unknown Location';

    const nameFields = [
      'locationName',
      'name', 
      'businessName',
      'title',
      'displayName',
      'address',
      'businessLocationName',
      'location'
    ];
    
    for (const field of nameFields) {
      if (locationData[field] && typeof locationData[field] === 'string') {
        const trimmed = locationData[field].trim();
        if (trimmed) return trimmed;
      }
    }
    
    if (locationData.businessLocation && typeof locationData.businessLocation === 'object') {
      for (const field of nameFields) {
        if (locationData.businessLocation[field] && typeof locationData.businessLocation[field] === 'string') {
          const trimmed = locationData.businessLocation[field].trim();
          if (trimmed) return trimmed;
        }
      }
    }
    
    if (locationData.id && typeof locationData.id === 'string') {
      return `Location ${locationData.id}`;
    }
    
    return 'Unknown Location';
  }

  private removeDuplicateLocations(locations: Location[]): Location[] {
    const uniqueMap = new Map<string, Location>();
    
    locations.forEach(location => {
      if (!uniqueMap.has(location.id) || 
          (location.locationName && !uniqueMap.get(location.id)?.locationName)) {
        uniqueMap.set(location.id, location);
      }
    });
    
    return Array.from(uniqueMap.values());
  }

  private buildLocationMap(): void {
    this.locationMap.clear();
    
    this.locations.forEach(location => {
      this.locationMap.set(location.id, location.name);
      
      if (location.locationName && location.locationName !== location.name) {
        this.locationMap.set(location.locationName, location.name);
      }
      
      const idVariations = [
        location.id,
        location.id.toLowerCase(),
        location.id.toUpperCase(),
        location.id.replace(/-/g, '_'),
        location.id.replace(/_/g, '-')
      ];
      
      idVariations.forEach(variation => {
        if (variation && !this.locationMap.has(variation)) {
          this.locationMap.set(variation, location.name);
        }
      });
    });
  }

  getLocationName(locationId: string): string {
    if (!locationId) return 'Unknown Location';
    
    let locationName = this.locationMap.get(locationId);
    if (locationName && locationName !== 'Unknown Location') {
      return locationName;
    }
    
    locationName = this.locationMap.get(locationId.toLowerCase()) || 
                   this.locationMap.get(locationId.toUpperCase());
    if (locationName && locationName !== 'Unknown Location') {
      return locationName;
    }
    
    const location = this.locations.find(loc => loc.id === locationId);
    if (location) {
      this.locationMap.set(locationId, location.name);
      return location.name;
    }
    
    return locationId.length > 0 ? `Location (${locationId})` : 'Unknown Location';
  }
  
}