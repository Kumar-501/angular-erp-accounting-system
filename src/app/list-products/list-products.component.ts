import { ProductsService } from '../services/products.service';
import { Router } from '@angular/router';
import { LocationService } from '../services/location.service';
import { StockService } from '../services/stock.service';
import { FileUploadService } from '../services/file-upload.service';
import { forkJoin, Subscription } from 'rxjs';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { BrandsService } from '../services/brands.service';
import { CategoriesService } from '../services/categories.service';
import { TaxService } from '../services/tax.service';
import { Component, HostListener, OnInit, OnDestroy } from '@angular/core';
import { EventEmitter } from '@angular/core';
import { PurchaseService } from '../services/purchase.service';
import { Firestore, doc, getDoc, collection, getDocs, query, where, onSnapshot } from '@angular/fire/firestore';
import { COLLECTIONS } from '../../utils/constants';
import { TaxRate } from '../tax/tax.model';

@Component({
  selector: 'app-list-products',
  templateUrl: './list-products.component.html',
  styleUrls: ['./list-products.component.scss']
})
export class ListProductsComponent implements OnInit, OnDestroy {
  products: any[] = [];
  filteredProducts: any[] = [];
  selectedStatus: string = '';
  currentSortColumn: string = 'productName';
  isAscending: boolean = true;
  brands: any[] = [];
  taxRates: any[] = [];

  // Image modal properties
  locations: any[] = [];
  private locationsSubscription: Subscription | undefined;
  private stockSubscription: Subscription | undefined;
  private productStockSubscriptions: Map<string, () => void> = new Map();
  
  showImageModal = false;
  selectedProductForImage: any = null;
  selectedProductImageUrl: string = '';
  // In your component class
  showInactiveProducts = false;
  filtersChanged = new EventEmitter<any>();
      percentage?: number; // For backward compatibility
  taxRateObject?: TaxRate | null; // ✅ CRITICAL: This is the key property

  fromDate: Date | null = null;
  toDate: Date | null = null;
  isDateDrawerOpen = false;
  isCustomDate = false;
  isDateFilterActive = false;
  selectedRange = '';
  dateRangeLabel = '';
  itemsPerPage: number = 10;

  selectedBrand: string = '';
  selectedTax: string = '';
  selectedLocation: string = '';
  showFilterSidebar = false;
  selectedCategory = '';
  categories: any[] = [];

  currentActionPopup: string | null = null;

  showAddToLocationModal = false;
  selectedLocationForAdd: string = '';
  isDeactivating: boolean = false;
  searchText: string = '';
  currentPage: number = 1;
  Math = Math;
  originalProducts: any[] = [];
  showProductDetailsModal = false;
  isLoading: boolean = false;

  selectedProduct: any = null;
  showHistoryModal: boolean = false;
  productHistory: any[] = [];
  
  showStockHistoryModal = false;
  stockHistory: any[] = [];
  users: any[] = [];

  filterOptions: {
    [x: string]: any;
    brandId: string;
    categoryId: string;
    taxId: string;
    locationId: string;
    statusId: string;
    fromDate: Date | null;
    toDate: Date | null;
  } = {
    brandId: '',
    categoryId: '',
    taxId: '',
    locationId: '',
    statusId: '',
    fromDate: null,
    toDate: null
  };

  searchTimeout: any = null;
  totalPages!: number;

  constructor(
    private productService: ProductsService,
    private router: Router,
    private locationService: LocationService,
    private stockService: StockService,
    private brandService: BrandsService,
    private categoryService: CategoriesService,
    private taxService: TaxService,
    private purchaseService: PurchaseService,
    private fileUploadService: FileUploadService,
    private firestore: Firestore
  ) {}

  ngOnInit(): void {
    this.loadUsers();
    this.loadLocations().then(() => {
      this.loadProducts();
      this.loadBrands();
      this.loadCategories();
      this.loadTaxRates();
      this.subscribeToStockUpdates();
    });
  }

 ngOnDestroy(): void {
    if (this.locationsSubscription) {
      this.locationsSubscription.unsubscribe();
    }
    // Correctly unsubscribe from the main stock update listener
    if (this.stockSubscription) {
      this.stockSubscription.unsubscribe();
    }
    this.productStockSubscriptions.forEach(unsubscribe => unsubscribe());
    this.productStockSubscriptions.clear();
  }
  private async refreshAllProductStockData(): Promise<void> {
    if (this.products.length === 0) return;

    console.log('Refreshing stock for all loaded products...');

    const stockUpdatePromises = this.products.map(product =>
      this.fetchAuthoritativeStockForProduct(product.id).then(stockData => ({
        productId: product.id,
        ...stockData
      }))
    );

    try {
      const updatedStocks = await Promise.all(stockUpdatePromises);
      const stockMap = new Map(updatedStocks.map(s => [s.productId, s]));

      // Update the main products array with the new stock data
      this.products = this.products.map(p => {
        const newStockData = stockMap.get(p.id);
        if (newStockData) {
          return {
            ...p,
            locationStocks: newStockData.locationStocks,
            totalStock: newStockData.totalStock,
            displayStock: newStockData.totalStock,
          };
        }
        return p;
      });

      // Update the arrays that depend on the main product list
      this.originalProducts = [...this.products].filter(p => !p.notForSelling);

      // Re-apply filters to ensure the UI reflects the changes
      this.applyFilters();
      console.log('Product stock data refreshed successfully.');

    } catch (error) {
      console.error('Error during bulk stock refresh:', error);
    }
  }
  getProductTaxDisplay(product: any): string {
  if (!product.applicableTax) {
    return '-';
  }

  // Handle different tax formats
  if (typeof product.applicableTax === 'string') {
    // If it's a string ID, find the tax rate
    const taxRate = this.taxRates.find(tax => tax.id === product.applicableTax);
    if (taxRate) {
      return `${taxRate.name} (${taxRate.rate}%)`;
    }
    return '-';
  } else if (typeof product.applicableTax === 'object') {
    // If it's already an object with rate information
    const name = product.applicableTax.name || 'Tax';
    const rate = product.applicableTax.rate || product.applicableTax.percentage || 0;
    return `${name} (${rate}%)`;
  }

  return '-';
}
  private subscribeToStockUpdates(): void {
    this.stockSubscription = this.stockService.stockUpdated$.subscribe(() => {
      console.log('Stock update detected. Refreshing stock data for all products.');
      this.refreshAllProductStockData();
    });
  }

  // UPDATED: Enhanced method to refresh stock data considering purchase returns
  private async refreshProductStockDataWithReturns(): Promise<void> {
    if (this.products.length === 0) return;

    try {
      console.log('Refreshing product stock data with returns consideration...');
      
      // Get purchase returns data to ensure stock reflects returns
      const purchaseReturnsMap = await this.getPurchaseReturnsData();
      
      const productStockUpdates = await Promise.all(
        this.products.map(async (product) => {
          if (product.id) {
            // Get fresh stock data from database
            const locationStocks = await this.getProductStockAtAllLocationsWithReturns(product.id, purchaseReturnsMap);
            const totalStock = this.getTotalStockAcrossLocations({ locationStocks });
            
            return {
              ...product,
              locationStocks,
              totalStock,
              displayStock: totalStock
            };
          }
          return product;
        })
      );

      this.products = productStockUpdates;
      this.originalProducts = [...this.products].filter(p => !p.notForSelling);
      this.applyFilters();
      
      console.log('Product stock data refreshed successfully with returns');
      
    } catch (error) {
      console.error('Error refreshing product stock data with returns:', error);
    }
  }

  // NEW: Get purchase returns data to adjust stock calculations
  private async getPurchaseReturnsData(): Promise<{ [productId: string]: number }> {
    try {
      const purchaseReturnsMap: { [productId: string]: number } = {};

      console.log('Fetching purchase returns data for stock adjustment...');

      const purchaseReturnLogsSnapshot = await getDocs(collection(this.firestore, 'purchase-return-log'));
      
      purchaseReturnLogsSnapshot.forEach(doc => {
        const data = doc.data();
        if (data['productId']) {
          purchaseReturnsMap[data['productId']] = (purchaseReturnsMap[data['productId']] || 0) + (data['returnQuantity'] || 0);
        }
      });

      console.log('Purchase returns data fetched:', Object.keys(purchaseReturnsMap).length, 'products have returns');
      return purchaseReturnsMap;
    } catch (error) {
      console.error('Error fetching purchase returns data:', error);
      return {};
    }
  }

  // UPDATED: Enhanced method to get product stock considering returns
  private async getProductStockAtAllLocationsWithReturns(
    productId: string, 
    purchaseReturnsMap: { [productId: string]: number }
  ): Promise<{[key: string]: number}> {
    try {
      const stockQuery = query(
        collection(this.firestore, COLLECTIONS.PRODUCT_STOCK),
        where('productId', '==', productId)
      );
      const stockSnapshot = await getDocs(stockQuery);
      
      const locationStocks: {[key: string]: number} = {};
      const productReturns = purchaseReturnsMap[productId] || 0;
      
      stockSnapshot.forEach((doc: any) => {
        const stockData = doc.data() as any;
        if (stockData.locationId && stockData.quantity !== undefined) {
          // Subtract returns from stock to get actual current stock
          const actualStock = Math.max(0, stockData.quantity - productReturns);
          locationStocks[stockData.locationId] = actualStock;
        }
      });
      
      return locationStocks;
    } catch (error) {
      console.error('Error fetching product stock with returns consideration:', error);
      return {};
    }
  }

  // Subscribe to real-time stock updates for a specific product
  private subscribeToProductStock(productId: string): void {
    if (this.productStockSubscriptions.has(productId)) {
      return; // Already subscribed
    }

    const stockQuery = query(
      collection(this.firestore, COLLECTIONS.PRODUCT_STOCK),
      where('productId', '==', productId)
    );

    const unsubscribe = onSnapshot(stockQuery, async (snapshot) => {
      // Get purchase returns to adjust stock calculation
      const purchaseReturnsMap = await this.getPurchaseReturnsData();
      const productReturns = purchaseReturnsMap[productId] || 0;
      
      const locationStocks: {[key: string]: number} = {};
      
      snapshot.forEach((doc) => {
        const stockData = doc.data() as any;
        if (stockData.locationId && stockData.quantity !== undefined) {
          // Adjust stock considering returns
          const actualStock = Math.max(0, stockData.quantity - productReturns);
          locationStocks[stockData.locationId] = actualStock;
        }
      });

      // Update the specific product in the products array
      const productIndex = this.products.findIndex(p => p.id === productId);
      if (productIndex !== -1) {
        this.products[productIndex].locationStocks = locationStocks;
        this.products[productIndex].totalStock = this.getTotalStockAcrossLocations(this.products[productIndex]);
        this.products[productIndex].displayStock = this.products[productIndex].totalStock;

        // Update filtered products if necessary
        const filteredIndex = this.filteredProducts.findIndex(p => p.id === productId);
        if (filteredIndex !== -1) {
          this.filteredProducts[filteredIndex] = { ...this.products[productIndex] };
        }

        // Update original products if necessary
        const originalIndex = this.originalProducts.findIndex(p => p.id === productId);
        if (originalIndex !== -1) {
          this.originalProducts[originalIndex] = { ...this.products[productIndex] };
        }
      }
    }, (error) => {
      console.error(`Error subscribing to stock updates for product ${productId}:`, error);
    });

    this.productStockSubscriptions.set(productId, unsubscribe);
  }

  // Method to calculate unit purchase price excluding tax
  calculateUnitPurchasePriceExcTax(product: any): number {
    if (!product.defaultPurchasePriceIncTax) {
      return 0;
    }

    const priceIncTax = Number(product.defaultPurchasePriceIncTax) || 0;
    
    // Get tax rate for this product
    const taxRate = this.getProductTaxRate(product);
    
    if (taxRate === 0) {
      return priceIncTax; // If no tax, price inc tax = price exc tax
    }
    
    // Calculate price excluding tax: Price Exc Tax = Price Inc Tax / (1 + Tax Rate/100)
    const priceExcTax = priceIncTax / (1 + (taxRate / 100));
    
    return Math.round(priceExcTax * 100) / 100; // Round to 2 decimal places
  }

  // Method to get tax rate for a product
  getProductTaxRate(product: any): number {
    if (!product.applicableTax) {
      return 0;
    }

    // Handle different tax formats
    if (typeof product.applicableTax === 'string') {
      // If it's a string, try to find the tax rate by ID
      const taxRate = this.taxRates.find(tax => tax.id === product.applicableTax);
      return taxRate ? Number(taxRate.rate || taxRate.percentage || 0) : 0;
    } else if (typeof product.applicableTax === 'object') {
      // If it's an object, get the rate directly
      return Number(product.applicableTax.rate || product.applicableTax.percentage || 0);
    }

    return 0;
  }

  // Method to format currency display
  formatCurrency(amount: number): string {
    if (!amount && amount !== 0) return '0.00';
    return Number(amount).toFixed(2);
  }

  // Add these navigation methods
  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  // Update the calculateTotalPages method
  calculateTotalPages(): void {
    this.totalPages = Math.ceil(this.filteredProducts.length / this.itemsPerPage);
    if (this.currentPage > this.totalPages && this.totalPages > 0) {
      this.currentPage = this.totalPages;
    } else if (this.totalPages === 0) {
      this.currentPage = 1;
    }
  }

  // File and image methods
  hasProductImage(product: any): boolean {
    if (!product) return false;
    
    // This now checks for the object format { data: '...' } that you are saving
    return !!(
      (product.productImage && typeof product.productImage === 'object' && product.productImage.data) ||
      product.productImage?.url ||
      product.productImage?.downloadURL ||
      (typeof product.productImage === 'string' && product.productImage.startsWith('http'))
    );
  }

  hasProductBrochure(product: any): boolean {
    return !!(product?.productBrochureBase64 || 
              product?.productBrochure?.url || 
              product?.productBrochure?.downloadURL ||
              (typeof product?.productBrochure === 'string' && product?.productBrochure.startsWith('http')));
  }

  getProductImageUrl(product: any): string {
    if (!product || !product.productImage) {
      return 'path/to/your/default/placeholder-image.png'; // Return a placeholder if no image
    }

    const image = product.productImage;

    // 1. Check for the new object format with base64 data first.
    //    This is what the edit page saves.
    if (typeof image === 'object' && image.data) {
      return image.data;
    }

    // 2. Fallback for other possible formats (like a direct URL from cloud storage)
    if (image.url) {
      return image.url;
    }
    if (image.downloadURL) {
      return image.downloadURL;
    }
    if (typeof image === 'string' && image.startsWith('http')) {
      return image;
    }

    // Return placeholder if no valid format is found
    return 'path/to/your/default/placeholder-image.png';
  }
  // +++ END: UPDATE THIS METHOD +++


  getProductBrochureUrl(product: any): string {
    if (!product) return '';
    
    if (product.productBrochureBase64) {
      return product.productBrochureBase64;
    } else if (product.productBrochure?.url) {
      return product.productBrochure.url;
    } else if (product.productBrochure?.downloadURL) {
      return product.productBrochure.downloadURL;
    } else if (typeof product.productBrochure === 'string' && product.productBrochure.startsWith('http')) {
      return product.productBrochure;
    }
    
    return '';
  }

  viewProductImage(product: any): void {
    if (this.hasProductImage(product)) {
      this.selectedProductForImage = product;
      this.selectedProductImageUrl = this.getProductImageUrl(product);
      this.showImageModal = true;
    }
  }

  closeImageModal(): void {
    this.showImageModal = false;
    this.selectedProductForImage = null;
    this.selectedProductImageUrl = '';
  }

  downloadProductImage(): void {
    if (this.selectedProductImageUrl && this.selectedProductForImage) {
      const link = document.createElement('a');
      link.href = this.selectedProductImageUrl;
      link.download = `${this.selectedProductForImage.productName}_image.jpg`;
      link.click();
    }
  }

  viewProductBrochure(product: any): void {
    if (this.hasProductBrochure(product)) {
      const brochureUrl = this.getProductBrochureUrl(product);
      if (brochureUrl) {
        // For base64 data, create a downloadable link
        if (brochureUrl.startsWith('data:')) {
          const link = document.createElement('a');
          link.href = brochureUrl;
          link.download = `${product.productName}_brochure.${this.getBrochureExtension(product)}`;
          link.click();
        } else {
          // For URLs, open in new tab
          window.open(brochureUrl, '_blank');
        }
      }
    }
  }

  private getBrochureExtension(product: any): string {
    if (product.productBrochure?.type) {
      const type = product.productBrochure.type;
      switch (type) {
        case 'application/pdf': return 'pdf';
        case 'text/csv': return 'csv';
        case 'application/zip': return 'zip';
        case 'application/msword': return 'doc';
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': return 'docx';
        case 'image/jpeg': return 'jpg';
        case 'image/png': return 'png';
        default: return 'file';
      }
    }
    return 'file';
  }

  // Component product methods
  getComponentProductName(productId: string): string {
    const product = this.products.find(p => p.id === productId);
    return product ? product.productName : 'Unknown Product';
  }

  // Method to get not-selling product name for Single type products
  getNotSellingProductName(productId: string): string {
    const product = this.products.find(p => p.id === productId);
    return product ? product.productName : 'Unknown Product';
  }

  // Enhanced date formatting method
  formatExpiryDate(dateString: string | null | undefined): string {
    if (!dateString) return 'No expiry';
    
    try {
      let date: Date;
      
      if (typeof dateString === 'string') {
        if (dateString.includes('-') && dateString.length === 10) {
          date = new Date(dateString + 'T00:00:00.000Z');
        } else {
          date = new Date(dateString);
        }
      } else {
        date = new Date(dateString);
      }
      
      if (isNaN(date.getTime())) {
        console.warn('Invalid date:', dateString);
        return 'Invalid date';
      }
      
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (e) {
      console.error('Error formatting expiry date:', e, dateString);
      return 'Invalid date';
    }
  }

  // Enhanced expiry status methods
  isExpired(expiryDate: string | null | undefined): boolean {
    if (!expiryDate) return false;
    
    try {
      let date: Date;
      
      if (typeof expiryDate === 'string') {
        if (expiryDate.includes('-') && expiryDate.length === 10) {
          date = new Date(expiryDate + 'T00:00:00.000Z');
        } else {
          date = new Date(expiryDate);
        }
      } else {
        date = new Date(expiryDate);
      }
      
      if (isNaN(date.getTime())) return false;
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      date.setHours(0, 0, 0, 0);
      
      return date < today;
    } catch (e) {
      console.error('Error checking if expired:', e);
      return false;
    }
  }

  isExpiringSoon(expiryDate: string | null | undefined): boolean {
    if (!expiryDate || this.isExpired(expiryDate)) return false;
    
    try {
      let date: Date;
      
      if (typeof expiryDate === 'string') {
        if (expiryDate.includes('-') && expiryDate.length === 10) {
          date = new Date(expiryDate + 'T00:00:00.000Z');
        } else {
          date = new Date(expiryDate);
        }
      } else {
        date = new Date(expiryDate);
      }
      
      if (isNaN(date.getTime())) return false;
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      date.setHours(0, 0, 0, 0);
      
      const oneMonthFromNow = new Date();
      oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
      oneMonthFromNow.setHours(0, 0, 0, 0);
      
      return date >= today && date <= oneMonthFromNow;
    } catch (e) {
      console.error('Error checking if expiring soon:', e);
      return false;
    }
  }

  private async fetchAuthoritativeStockForProduct(productId: string): Promise<{ locationStocks: { [key: string]: number }, totalStock: number }> {
    if (!productId) {
      return { locationStocks: {}, totalStock: 0 };
    }

    try {
      const stockQuery = query(
        collection(this.firestore, COLLECTIONS.PRODUCT_STOCK),
        where('productId', '==', productId)
      );
      const stockSnapshot = await getDocs(stockQuery);

      const locationStocks: { [key: string]: number } = {};
      let totalStock = 0;

      stockSnapshot.forEach((doc) => {
        const stockData = doc.data() as any;
        if (stockData.locationId && typeof stockData.quantity === 'number') {
          const currentStock = stockData.quantity;
          locationStocks[stockData.locationId] = currentStock;
          totalStock += currentStock;
        }
      });

      return { locationStocks, totalStock };
    } catch (error) {
      console.error(`Error fetching authoritative stock for product ${productId}:`, error);
      return { locationStocks: {}, totalStock: 0 };
    }
  }

  async loadProducts(): Promise<void> {
    this.isLoading = true;
    try {
      this.productService.getProductsRealTime().subscribe(async (data: any[]) => {

        const processedProducts = await Promise.all(data.map(async (product) => {
          if (product.isActive === undefined) product.isActive = true;
          if (!product.status) product.status = product.isActive ? 'Active' : 'Inactive';
          
          product.formattedExpiryDate = this.formatExpiryDate(product.expiryDate);
          product.displayTax = product.applicableTax?.name ? `${product.applicableTax.name} (${product.applicableTax.percentage}%)` : '-';
          product.calculatedUnitPurchasePrice = this.calculateUnitPurchasePriceExcTax(product);

          // UPDATED: Use the new authoritative stock fetch method
          if (product.id) {
            try {
              const stockData = await this.fetchAuthoritativeStockForProduct(product.id);
              product.locationStocks = stockData.locationStocks;
              product.totalStock = stockData.totalStock;
              product.displayStock = stockData.totalStock;
            } catch (error) {
              console.error(`Error loading initial stock for product ${product.id}:`, error);
              product.locationStocks = {};
              product.alertQuantity = product.alertQuantity || 0;
              product.totalStock = 0;
              product.displayStock = '0';
            }
          }
          return product;
        }));

        this.products = processedProducts;
        this.originalProducts = [...this.products].filter(p => !p.notForSelling);
        
        // Apply filters to initialize the view correctly
        this.applyFilters();
        
        this.isLoading = false;
        console.log('Products loaded with current stock data.');
      }, error => {
        console.error('Error loading products:', error);
        this.isLoading = false;
      });
    } catch (error) {
      console.error('Error in loadProducts:', error);
      this.isLoading = false;
    }
  }

  // Toggle all products selection
  toggleAllProducts(event: Event): void {
    const isChecked = (event.target as HTMLInputElement).checked;
    this.filteredProducts.forEach(product => {
      product.selected = isChecked;
    });
  }

  // Filter management
  toggleFilterSidebar(): void {
    this.showFilterSidebar = !this.showFilterSidebar;
  }

  loadBrands(): void {
    this.brandService.getBrands().subscribe(brands => {
      console.log('Loaded brands:', brands);
      this.brands = brands;
    }, error => {
      console.error('Error loading brands:', error);
    });
  }

  loadCategories(): void {
    this.categoryService.getCategories().subscribe(categories => {
      console.log('Loaded categories:', categories);
      this.categories = categories;
    });
  }

  loadTaxRates(): void {
    this.taxService.getTaxRates().subscribe(taxes => {
      this.taxRates = taxes;
    });
  }

  addOpeningStock(product: any) {
    this.router.navigate(['/opening-stock'], {
      queryParams: { 
        productId: product.id,
        productData: JSON.stringify(product)
      }
    });
  }

  viewProductHistory(product: any): void {
    this.productService.getProductPurchaseHistory(product.id).subscribe(purchaseOrders => {
      this.router.navigate(['/product-history', product.id], {
        state: { 
          productData: product,
          purchaseOrders: purchaseOrders,
          locationName: product.locationName,
          purchasePrice: product.defaultPurchasePriceExcTax,
          sellingPrice: product.defaultSellingPriceExcTax,
          location: product.location,
          locationNames: product.locationNames,
          locationIds: product.locationIds
        }
      });
    });
  }

  // Action popup management
  openActionPopup(product: any): void {
    this.currentActionPopup = product.id;
  }

  closeActionPopup(): void {
    this.currentActionPopup = null;
  }

  @HostListener('document:keydown.escape', ['$event'])
  onKeydownHandler(event: KeyboardEvent) {
    this.closeActionPopup();
  }

  // Sorting functionality
  sortBy(column: string): void {
    if (this.currentSortColumn === column) {
      this.isAscending = !this.isAscending;

    } 
    else {
      this.currentSortColumn = column;
      this.isAscending = true;
    }
    

    this.filteredProducts.sort((a, b) => {
      const valA = a[column] === undefined || a[column] === null ? '' : a[column];
      const valB = b[column] === undefined || b[column] === null ? '' : b[column];

      // Special handling for calculated unit purchase price
      if (column === 'calculatedUnitPurchasePrice') {
        const numA = this.calculateUnitPurchasePriceExcTax(a);
        const numB = this.calculateUnitPurchasePriceExcTax(b);
        return this.isAscending ? numA - numB : numB - numA;
      }
  if (column === 'alertQuantity') {
      const numA = Number(valA) || 0;
      const numB = Number(valB) || 0;
      return this.isAscending ? numA - numB : numB - numA;
    }
      // Special handling for numeric fields
      if (column === 'defaultPurchasePriceExcTax' || 
          column === 'defaultSellingPriceExcTax' || 
          column === 'defaultPurchasePriceIncTax' ||
          column === 'defaultSellingPriceIncTax' ||
          column === 'unitPurchasePrice' ||
          column === 'currentStock' || 
          column === 'totalStock') {
        const numA = Number(valA) || 0;
        const numB = Number(valB) || 0;
        return this.isAscending ? numA - numB : numB - numA;
      }

      // Special handling for expiry dates
      if (column === 'expiryDate') {
        const dateA = valA ? new Date(valA).getTime() : 0;
        const dateB = valB ? new Date(valB).getTime() : 0;
        return this.isAscending ? dateA - dateB : dateB - dateA;
      }

      // Default string comparison
      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      
      if (strA < strB) {
        return this.isAscending ? -1 : 1;
      }
      if (strA > strB) {
        return this.isAscending ? 1 : -1;
      }
      return 0;
    });

    this.currentPage = 1;
  }

  // Product status management
  async toggleSellingStatus(productId: string, notForSelling: boolean): Promise<void> {
    try {
      this.isLoading = true;
      await this.productService.updateProduct(productId, {
        notForSelling: notForSelling
      });
      const message = notForSelling ? 'marked as not for selling' : 'marked as available for selling';
      alert(`Product ${message} successfully`);
      this.loadProducts();
    } catch (error) {
      console.error('Error toggling selling status:', error);
      alert('Failed to update product status');
    } finally {
      this.isLoading = false;
    }
  }

  async toggleBulkSellingStatus(): Promise<void> {
    const selectedProducts = this.filteredProducts.filter(p => p.selected);
    if (selectedProducts.length === 0) {
      alert('No products selected');
      return;
    }

    const allNotForSelling = selectedProducts.every(p => p.notForSelling);
    const allForSelling = selectedProducts.every(p => !p.notForSelling);
    
    let action: string;
    let newStatus: boolean;
    
    if (allNotForSelling) {
      action = 'mark as available for selling';
      newStatus = false;
    } else if (allForSelling) {
      action = 'mark as not for selling';
      newStatus = true;
    } else {
      const userChoice = confirm('You have selected both "Not for Selling" and regular products. Do you want to mark all as "Not for Selling"?');
      action = userChoice ? 'mark as not for selling' : 'mark as available for selling';
      newStatus = userChoice;
    }

    if (!confirm(`Are you sure you want to ${action} ${selectedProducts.length} selected products?`)) {
      return;
    }

    try {
      this.isLoading = true;
      
      const updatePromises = selectedProducts.map(product => {
        return this.productService.updateProduct(product.id, {
          notForSelling: newStatus
        });
      });

      await Promise.all(updatePromises);
      alert(`${selectedProducts.length} products ${action} successfully`);
      
      this.filteredProducts.forEach(p => p.selected = false);
      this.loadProducts();
    } catch (error) {
      console.error(`Error ${action} products:`, error);
      alert(`Failed to ${action} products. Please try again.`);
    } finally {
      this.isLoading = false;
    }
  }

  // Location management
  async addToLocation(): Promise<void> {
    if (!this.selectedLocationForAdd) {
      alert('Please select a location');
      return;
    }

    const selectedProducts = this.filteredProducts.filter(p => p.selected);
    if (selectedProducts.length === 0) {
      alert('No products selected');
      return;
    }

    try {
      this.isLoading = true;
      const location = this.locations.find(l => l.id === this.selectedLocationForAdd);
      
      const updatePromises = selectedProducts.map(product => {
        const updateData = {
          location: this.selectedLocationForAdd,
          locationName: location?.name || 'Unknown Location',
          locations: [this.selectedLocationForAdd],
          locationNames: [location?.name || 'Unknown Location']
        };
        return this.productService.updateProduct(product.id, updateData);
      });

      await Promise.all(updatePromises);
      alert(`${selectedProducts.length} products added to ${location?.name || 'selected location'}`);
      
      this.filteredProducts.forEach(p => p.selected = false);
      this.closeAddToLocationModal();
      this.loadProducts();
      
    } catch (error) {
      console.error('Error adding products to location:', error);
    } finally {
      this.isLoading = false;
    }
  }

  openAddToLocationModal(): void {
    this.showAddToLocationModal = true;
  }

  closeAddToLocationModal(): void {
    this.showAddToLocationModal = false;
    this.selectedLocationForAdd = '';
  }

  async removeFromLocation(): Promise<void> {
    const selectedProducts = this.filteredProducts.filter(p => p.selected);
    if (selectedProducts.length === 0) {
      alert('No products selected');
      return;
    }

    if (!confirm(`Are you sure you want to remove ${selectedProducts.length} products from their locations?`)) {
      return;
    }

    try {
      this.isLoading = true;
      
      const updatePromises = selectedProducts.map(product => {
        return this.productService.updateProduct(product.id, {
          location: '',
          locationName: ''
        });
      });

      await Promise.all(updatePromises);
      alert(`${selectedProducts.length} products removed from their locations`);
      
      this.filteredProducts.forEach(p => p.selected = false);
    } catch (error) {
      console.error('Error removing products from location:', error);
      alert('Successfully removed products from location.');
    } finally {
      this.isLoading = false;
    }
  }

  async toggleProductActivation(): Promise<void> {
    const selectedProducts = this.filteredProducts.filter(p => p.selected);
    if (selectedProducts.length === 0) {
      alert('No products selected');
      return;
    }

    const firstSelected = selectedProducts[0];
    const activate = !firstSelected.isActive;
    const action = activate ? 'activate' : 'deactivate';

    if (!confirm(`Are you sure you want to ${action} ${selectedProducts.length} selected products?`)) {
      return;
    }

    try {
      this.isLoading = true;
      
      const updatePromises = selectedProducts.map(product => {
        return this.productService.updateProduct(product.id, {
          isActive: activate,
          status: activate ? 'Active' : 'Inactive'
        });
      });

      await Promise.all(updatePromises);
      alert(`${selectedProducts.length} products ${action}d successfully`);
      
      this.filteredProducts.forEach(p => p.selected = false);
      this.loadProducts();
    } catch (error) {
      console.error(`Error ${action}ing products:`, error);
      alert(`Failed to ${action} products. Please try again.`);
    } finally {
      this.isLoading = false;
    }
  }

  loadUsers(): void {
    this.stockService.getUsers().subscribe((users: any[]) => {
      this.users = users;
    }, error => {
      console.error('Error loading users:', error);
    });
  }

  viewProductDetails(product: any): void {
    this.selectedProduct = product;
    this.showProductDetailsModal = true;
  }

  viewStockHistory(product: any): void {
    this.selectedProduct = product;
    this.showStockHistoryModal = true;
    this.loadEnhancedStockHistory(product.id);
  }

  getActivationButtonText(): string {
    const selectedProducts = this.filteredProducts.filter(p => p.selected);
    if (selectedProducts.length === 0) {
      return 'Toggle Activation';
    }
    
    const allInactive = selectedProducts.every(p => !p.isActive);
    if (allInactive) {
      return 'Activate Selected';
    }
    
    const allActive = selectedProducts.every(p => p.isActive);
    if (allActive) {
      return 'Deactivate Selected';
    }
    
    return 'Toggle Activation';
  }

  closeStockHistoryModal(): void {
    this.showStockHistoryModal = false;
    this.selectedProduct = null;
    this.stockHistory = [];
  }

  async loadEnhancedStockHistory(productId: string): Promise<void> {
    try {
      const product = await this.productService.getProductById(productId);
      const productHistory = await this.productService.getProductStockHistory(productId).toPromise();
      const stockTransfers = await this.stockService.getStockTransfersByProduct(productId).toPromise();
      
      this.stockHistory = [
        ...(productHistory ? productHistory.map((entry: any) => {
          const user = this.users.find(u => u.id === entry.userId);
          
          return {
            ...entry,
            timestamp: entry.timestamp,
            action: entry.action,
            quantity: entry.quantity,
            notes: entry.notes,
            userName: user ? user.name : 'System',
            productName: product?.productName || 'Unknown Product',
            currentStock: entry.newStock || product?.currentStock || 0,
            previousStock: entry.oldStock || 0,
            purchasePrice: product?.defaultPurchasePriceExcTax || 0,
            sellingPrice: product?.defaultSellingPriceExcTax || 0,
            sku: product?.sku || 'N/A',
            location: this.getLocationName(entry.locationId || product?.location),
            formattedTimestamp: this.formatDate(entry.timestamp)
          };
        }) : []),
        ...(stockTransfers ? stockTransfers.map((transfer: any) => {
          const productTransfer = transfer.locationTransfers
            .flatMap((t: any) => t.products)
            .find((p: any) => p.product === productId);
          
          const transferQuantity = productTransfer ? productTransfer.quantity : 0;
          const user = this.users.find(u => u.id === transfer.userId);
          
          return {
            timestamp: transfer.date,
            action: 'transfer',
            fromLocation: this.getLocationName(transfer.locationFrom),
            toLocation: this.getLocationName(transfer.locationTo),
            quantity: transferQuantity,
            referenceNo: transfer.referenceNo,
            notes: transfer.additionalNotes,
            userName: user ? user.name : 'System',
            productName: product?.productName || 'Unknown Product',
            currentStock: product?.currentStock || 0,
            purchasePrice: product?.defaultPurchasePriceExcTax || 0,
            sellingPrice: product?.defaultSellingPriceExcTax || 0,
            sku: product?.sku || 'N/A',
            formattedTimestamp: this.formatDate(transfer.date)
          };
        }) : [])
      ].sort((a, b) => {
        const dateA = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : new Date(a.timestamp).getTime();
        const dateB = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : new Date(b.timestamp).getTime();
        return dateB - dateA;
      });
    } catch (error) {
      console.error('Error loading enhanced stock history:', error);
      this.stockHistory = [];
    }
  }

  getStockActionLabel(action: string): string {
    switch(action) {
      case 'stock_in': return 'Stock In';
      case 'stock_out': return 'Stock Out';
      case 'transfer': return 'Transfer';
      case 'adjustment': return 'Adjustment';
      case 'purchase': return 'Purchase';
      case 'sale': return 'Sale';
      default: return action;
    }
  }

  // Helper method for template to access Object.keys
  getObjectKeys(obj: any): string[] {
    return Object.keys(obj || {});
  }

  // UPDATED: Fetch stock data for a product at all locations with real-time updates and returns consideration
  async getProductStockAtAllLocations(productId: string): Promise<{[key: string]: number}> {
    try {
      const stockQuery = query(
        collection(this.firestore, COLLECTIONS.PRODUCT_STOCK),
        where('productId', '==', productId)
      );
      const stockSnapshot = await getDocs(stockQuery);
      
      const locationStocks: {[key: string]: number} = {};
      
      // Get purchase returns for this product
      const purchaseReturnsMap = await this.getPurchaseReturnsData();
      const productReturns = purchaseReturnsMap[productId] || 0;
      
      stockSnapshot.forEach((doc: any) => {
        const stockData = doc.data() as any;
        if (stockData.locationId && stockData.quantity !== undefined) {
          // Adjust for returns - subtract returns from stock to get actual current stock
          const actualStock = Math.max(0, stockData.quantity - productReturns);
          locationStocks[stockData.locationId] = actualStock;
        }
      });
      
      return locationStocks;
    } catch (error) {
      console.error('Error fetching product stock at all locations:', error);
      return {};
    }
  }

  // Calculate total stock across all locations for a product
  getTotalStockAcrossLocations(product: any): number {
    if (!product.locationStocks) return 0;
    
    return Object.values(product.locationStocks)
      .filter(stock => typeof stock === 'number')
      .reduce((total: number, stock: number) => total + Math.max(0, stock), 0);
  }

  // Format date helper method
  formatDate(date: any): string {
    if (!date) return '-';
    
    // Handle Firestore timestamp
    if (date.toDate) {
      return date.toDate().toLocaleDateString();
    }
    
    // Handle regular Date object
    if (date instanceof Date) {
      return date.toLocaleDateString();
    }
    
    // Handle string dates
    if (typeof date === 'string') {
      const parsedDate = new Date(date);
      return isNaN(parsedDate.getTime()) ? '-' : parsedDate.toLocaleDateString();
    }
    
    return '-';
  }

  // Get location stock entries for display
  getLocationStockEntries(locationStocks: {[key: string]: number}): {locationId: string, stock: number}[] {
    if (!locationStocks) return [];
    
    return Object.entries(locationStocks)
      .filter(([locationId, stock]) => stock > 0)
      .map(([locationId, stock]) => ({ locationId, stock }))
      .sort((a, b) => b.stock - a.stock); // Sort by stock descending
  }

  // Enhanced location name method
  getLocationName(locationId: string): string {
    if (!locationId) return '-';
    const location = this.locations.find(l => l.id === locationId);
    return location ? location.name : 'Unknown Location';
  }

  // Helper method to get location stock summary for exports/display
  getLocationStockSummary(product: any): string {
    if (!product.locationStocks) return '';
    
    const entries = this.getLocationStockEntries(product.locationStocks);
    return entries.map(entry => 
      `${this.getLocationName(entry.locationId)}: ${entry.stock}`
    ).join('; ');
  }

  loadLocations(): Promise<void> {
    return new Promise((resolve) => {
      this.locationService.getLocations().subscribe((locations: any[]) => {
        this.locations = locations;
        resolve();
      }, error => {
        console.error('Error loading locations:', error);
        resolve();
      });
    });
  }

  toggleInactiveProducts(): void {
    this.showInactiveProducts = !this.showInactiveProducts;
    this.loadProducts();
  }

  applyLocationFilter(): void {
    if (!this.selectedLocation) {
      this.filteredProducts = [...this.originalProducts];
    } else {
      this.filteredProducts = this.originalProducts.filter(product => {
        // Check if product has stock at the selected location
        return product.locationStocks && product.locationStocks[this.selectedLocation] > 0;
      });
    }

    if (this.searchText && this.searchText.trim() !== '') {
      const searchLower = this.searchText.toLowerCase().trim();
      this.filteredProducts = this.filteredProducts.filter(product => {
        const searchString = [
          product.productName,
          product.sku,
          product.category,
          product.brand,
          product.productType,
          this.getLocationStockSummary(product),
          product.totalStock?.toString(),
          product.defaultPurchasePriceExcTax?.toString(),
          product.defaultSellingPriceExcTax?.toString()
        ]
        .filter(field => field)
        .join(' ')
        .toLowerCase();
        
        return searchString.includes(searchLower);
      });
    }

    this.sortBy(this.currentSortColumn);
    this.currentPage = 1;
  }

  // Navigation and UI methods
  navigateToAddProduct(): void {
    this.router.navigate(['/add-product']);
  }

  updatePaginatedProducts(): void {
    this.currentPage = 1;
  }

  // Search and filtering methods
  onSearchInput(): void {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    
    this.searchTimeout = setTimeout(() => {
      this.applyLocationFilter();
    }, 300);
  }

  // Date filter methods
  toggleDateDrawer(): void {
    this.isDateDrawerOpen = !this.isDateDrawerOpen;
  }

  filterByDate(range: string): void {
    this.selectedRange = range;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (range) {
      case 'today':
        this.filterOptions.fromDate = new Date(today);
        this.filterOptions.toDate = new Date(today);
        this.dateRangeLabel = 'Today';
        break;
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        this.filterOptions.fromDate = yesterday;
        this.filterOptions.toDate = yesterday;
        this.dateRangeLabel = 'Yesterday';
        break;
      case 'sevenDays':
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        this.filterOptions.fromDate = sevenDaysAgo;
        this.filterOptions.toDate = new Date(today);
        this.dateRangeLabel = 'Last 7 Days';
        break;
      case 'thirtyDays':
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        this.filterOptions.fromDate = thirtyDaysAgo;
        this.filterOptions.toDate = new Date(today);
        this.dateRangeLabel = 'Last 30 Days';
        break;
      case 'lastMonth':
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 0);
        this.filterOptions.fromDate = firstDayOfMonth;
        this.filterOptions.toDate = lastDayOfMonth;
        this.dateRangeLabel = 'Last Month';
        break;
    }

    this.isCustomDate = false;
    this.isDateFilterActive = true;
    this.applyFilters();
    this.toggleDateDrawer();
  }

  selectCustomRange(): void {
    this.selectedRange = 'custom';
    this.isCustomDate = true;
    this.filterOptions.fromDate = null;
    this.filterOptions.toDate = null;
  }

  cancelCustomRange(): void {
    this.isCustomDate = false;
    this.selectedRange = '';
    this.toggleDateDrawer();
  }

  applyCustomRange(): void {
    if (!this.fromDate || !this.toDate) {
      alert('Please select both start and end dates');
      return;
    }

    this.filterOptions.fromDate = new Date(this.fromDate);
    this.filterOptions.toDate = new Date(this.toDate);

    if (this.filterOptions.fromDate > this.filterOptions.toDate) {
      alert('End date must be after start date');
      return;
    }

    this.dateRangeLabel = 
      `${this.filterOptions.fromDate.toLocaleDateString()} - ${this.filterOptions.toDate.toLocaleDateString()}`;
    
    this.isDateFilterActive = true;
    this.isCustomDate = false;
    this.selectedRange = 'custom';
    this.applyFilters();
    this.toggleDateDrawer();
  }

  // Main filtering method
  applyFilters(): void {
    this.currentPage = 1; // Always reset to first page when filters change
      
    // Start with all products that are not marked as "Not for Selling"
    let filtered = this.originalProducts.filter(p => !p.notForSelling);
    
    // Only include "Not for Selling" products if explicitly requested
    if (this.selectedStatus === 'notForSelling') {
      filtered = this.originalProducts.filter(p => p.notForSelling);
    }
    
    this.filteredProducts = filtered.filter(product => {
      // Location filter
      if (this.selectedLocation) {
        const hasLocation = product.locationStocks && product.locationStocks[this.selectedLocation] > 0;
        if (!hasLocation) return false;
      }
      
      // Brand filter
      if (this.selectedBrand) {
        if (product.brandId === this.selectedBrand) {
          // Simple case where product has brandId that matches
        } else if (product.brand && typeof product.brand === 'object' && product.brand.id === this.selectedBrand) {
          // Case where brand is an object with id property
        } else if (product.brand === this.selectedBrand) {
          // Case where brand is just the ID as a string
        } else {
          return false;
        }
      }
      
      // Category filter
      if (this.selectedCategory) {
        if (product.categoryId === this.selectedCategory) {
          // Simple case where product has categoryId that matches
        } else if (product.category && typeof product.category === 'object' && product.category.id === this.selectedCategory) {
          // Case where category is an object with id property
        } else if (product.category === this.selectedCategory) {
          // Case where category is just the ID as a string
        } else {
          return false;
        }
      }
      
      // Tax filter
      if (this.selectedTax) {
        if (typeof product.applicableTax === 'string') {
          if (product.applicableTax !== this.selectedTax) {
            return false;
          }
        } else if (product.applicableTax?.id !== this.selectedTax) {
          return false;
        }
      }
      
      // Status filter
      if (this.selectedStatus) {
        if (this.selectedStatus === 'active' && !product.isActive) {
          return false;
        }
        if (this.selectedStatus === 'inactive' && product.isActive) {
          return false;
        }
      }
      
      // Date filter
      if (this.isDateFilterActive && this.filterOptions.fromDate && this.filterOptions.toDate) {
        let productDate: Date | null = null;
        
        if (product.createdDate?.toDate) {
          productDate = product.createdDate.toDate();
        } else if (product.createdDate) {
          productDate = new Date(product.createdDate);
        } else if (product.addedDate) {
          productDate = new Date(product.addedDate);
        }
        
        if (!productDate || isNaN(productDate.getTime())) {
          return false;
        }
        
        const fromDate = new Date(this.filterOptions.fromDate);
        fromDate.setHours(0, 0, 0, 0);
        
        const toDate = new Date(this.filterOptions.toDate);
        toDate.setHours(23, 59, 59, 999);
        
        productDate.setHours(12, 0, 0, 0);
        
        if (productDate < fromDate || productDate > toDate) {
          return false;
        }
      }
      
      return true;
    });
// In your applyFilters() method
if (this.filterOptions['lowStockOnly']) {
  filtered = filtered.filter(product => 
    product.alertQuantity && product.totalStock <= product.alertQuantity
  );
}
    // Apply search filter
    if (this.searchText && this.searchText.trim() !== '') {
      const searchLower = this.searchText.toLowerCase().trim();
      this.filteredProducts = this.filteredProducts.filter(product => {
        const searchString = [
          product.productName,
          product.sku,
          product.category,
          product.brand,
          product.productType,
          this.getLocationStockSummary(product),
          product.totalStock?.toString(),
          product.defaultPurchasePriceExcTax?.toString(),
          product.defaultSellingPriceExcTax?.toString()
        ]
        .filter(field => field)
        .join(' ')
        .toLowerCase();
        
        return searchString.includes(searchLower);
      });
    }
    
    this.sortBy(this.currentSortColumn);
  }

  resetFilters(): void {
    this.selectedBrand = '';
    this.selectedCategory = '';
    this.selectedTax = '';
    this.selectedLocation = '';
    this.selectedStatus = '';
    this.searchText = '';
    
    this.clearDateFilter();
    
    this.filterOptions = {
      brandId: '',
      categoryId: '',
      taxId: '',
      locationId: '',
      statusId: '',
      fromDate: null,
      toDate: null
    };
    
    this.isDateFilterActive = false;
    this.selectedRange = '';
    this.dateRangeLabel = '';
    
    this.applyFilters();
  }

  clearDateFilter(): void {
    this.selectedRange = '';
    this.dateRangeLabel = '';
    this.isDateFilterActive = false;
    this.filterOptions.fromDate = null;
    this.filterOptions.toDate = null;
    this.applyFilters();
  }

  // Selection methods
  hasSelectedProducts(): boolean {
    return this.filteredProducts.some(product => product.selected);
  }

  getSelectedCount(): number {
    return this.filteredProducts.filter(product => product.selected).length;
  }

  // Product action methods
  editProduct(productId: string): void {
    // This correctly closes the modal before navigating
    if (this.showProductDetailsModal) {
      this.closeProductDetailsModal();
    }
    this.router.navigate(['/products/edit', productId]);
  }


  deleteProduct(productId: string): void {
    if (confirm('Are you sure you want to delete this product?')) {
      this.productService.deleteProduct(productId).then(() => {
        // Product will be automatically removed due to real-time subscription
      }).catch(error => {
        console.error('Error deleting product:', error);
      });
    }
  }

  duplicateProduct(productId: string): void {
    this.productService.getProductById(productId).then((product) => {
      if (product) {
        const duplicatedProduct = {
          ...product,
          id: undefined,
          productName: `${product.productName} (Copy)`,
          sku: product.sku ? `${product.sku}-COPY` : '',
        };
  
        this.router.navigate(['/add-product'], {
          queryParams: { duplicate: JSON.stringify(duplicatedProduct) },
        });
      }
    });
  }

  viewProductSales(product: any): void {
    this.router.navigate(['/product-sales'], { 
      queryParams: { 
        productId: product.id,
        productName: product.productName 
      } 
    });
  }

  async viewProductAndPurchaseData(product: any): Promise<void> {
    try {
      const purchases = await this.purchaseService.getPurchasesByProductId(product.id);
      
      this.router.navigate(['/product-details', product.id], {
        state: {
          productData: product,
          purchaseData: purchases
        }
      });
    } catch (error) {
      console.error('Error loading product and purchase data:', error);
      alert('Error loading product details. Please try again.');
    }
  }

  async deleteSelectedProducts(): Promise<void> {
    const selectedProducts = this.filteredProducts.filter(product => product.selected);
    
    if (selectedProducts.length === 0) {
      alert('No products selected');
      return;
    }

    if (!confirm(`Are you sure you want to delete ${selectedProducts.length} selected products?`)) {
      return;
    }

    try {
      this.isLoading = true;
      
      const deletePromises = selectedProducts.map(product => 
        this.productService.deleteProduct(product.id)
      );
      
      await Promise.all(deletePromises);
      
      alert(`${selectedProducts.length} products deleted successfully`);
      
      this.filteredProducts.forEach(product => product.selected = false);
      
    } catch (error) {
      console.error('Error deleting selected products:', error);
      alert('Error deleting some products. Please try again.');
    } finally {
      this.isLoading = false;
    }
  }

 closeProductDetailsModal(): void {
    this.showProductDetailsModal = false;
    this.selectedProduct = null;
  }

  // Export methods
  exportToCSV(): void {
    try {
      if (this.filteredProducts.length === 0) {
        alert('No products to export');
        return;
      }

      const data = this.filteredProducts.map(product => ({
        'Product Name': product.productName || '',
        'SKU': product.sku || '',
        'Unit Purchase Price (Exc Tax)': this.formatCurrency(this.calculateUnitPurchasePriceExcTax(product)),
        'Purchase Price (Inc Tax)': this.formatCurrency(product.defaultPurchasePriceIncTax || 0),
        'Selling Price (Exc Tax)': this.formatCurrency(product.defaultSellingPriceExcTax || 0),
        'Selling Price (Inc Tax)': this.formatCurrency(product.defaultSellingPriceIncTax || 0),
        'Total Stock': product.totalStock || 0,
        'Stock by Location': this.getLocationStockSummary(product),
        'Category': product.category || '-',
        'Alert Quantity': product.alertQuantity || '-',
'Stock Status': product.totalStock <= product.alertQuantity ? 'Low Stock' : 'OK',

        'Brand': product.brand || '-',
        'Tax': product.displayTax || '-',
        'Expiry Date': product.formattedExpiryDate || 'No expiry'
      }));
    
      const csvRows = [];
      const headers = Object.keys(data[0]);
      csvRows.push(headers.join(','));
    
      for (const row of data) {
        const values = headers.map(header => {
          const value = (row as any)[header];
          const escaped = ('' + value).replace(/"/g, '\\"');
          return `"${escaped}"`;
        });
        csvRows.push(values.join(','));
      }
    
      const csvString = csvRows.join('\n');
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'products_' + new Date().toISOString().slice(0, 10) + '.csv';
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('Failed to export CSV. Please try again.');
    }
  }
  
  exportToExcel(): void {
    try {
      if (this.filteredProducts.length === 0) {
        alert('No products to export');
        return;
      }

      const data = this.filteredProducts.map(product => ({
        'Product Name': product.productName || '',
        'SKU': product.sku || '',
        'Unit Purchase Price (Exc Tax)': this.formatCurrency(this.calculateUnitPurchasePriceExcTax(product)),
        'Purchase Price (Inc Tax)': this.formatCurrency(product.defaultPurchasePriceIncTax || 0),
        'Selling Price (Exc Tax)': this.formatCurrency(product.defaultSellingPriceExcTax || 0),
        'Selling Price (Inc Tax)': this.formatCurrency(product.defaultSellingPriceIncTax || 0),
        'Total Stock': product.totalStock || 0,
        'Stock by Location': this.getLocationStockSummary(product),
        'Category': product.category || '-',
        'Brand': product.brand || '-',
              'Alert Quantity': product.alertQuantity || '-',
'Stock Status': product.totalStock <= product.alertQuantity ? 'Low Stock' : 'OK',
        'Tax': product.displayTax || '-',
        'Expiry Date': product.formattedExpiryDate || 'No expiry'
      }));
  
      // For now, just export as CSV until XLSX is properly configured
      this.exportToCSV();
    } catch (error) {
      console.error('Error exporting Excel:', error);
      alert('Failed to export Excel. Please try again.');
    }
  }
// Pagination methods
getTotalPages(): number {
  return Math.ceil(this.filteredProducts.length / this.itemsPerPage);
}

getStartIndex(): number {
  return (this.currentPage - 1) * this.itemsPerPage + 1;
}

getEndIndex(): number {
  return Math.min(this.currentPage * this.itemsPerPage, this.filteredProducts.length);
}

goToPage(page: number | string): void {
  if (typeof page === 'number' && page >= 1 && page <= this.getTotalPages()) {
    this.currentPage = page;
  }
}


getPaginationPages(): (number | string)[] {
  const totalPages = this.getTotalPages();
  const currentPage = this.currentPage;
  const pages: (number | string)[] = [];
  
  // Always show first page
  pages.push(1);
  
  // Show ellipsis if current page is more than 3 pages away from start
  if (currentPage > 4) {
    pages.push('...');
  }
  
  // Show pages around current page
  const startPage = Math.max(2, currentPage - 2);
  const endPage = Math.min(totalPages - 1, currentPage + 2);
  
  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }
  
  // Show ellipsis if current page is more than 3 pages away from end
  if (currentPage < totalPages - 3) {
    pages.push('...');
  }
  
  // Always show last page if there's more than one page
  if (totalPages > 1) {
    pages.push(totalPages);
  }
  
  return pages;
}
  getPages(): number[] {
    const pageCount = Math.ceil(this.filteredProducts.length / this.itemsPerPage);
    return Array.from({length: pageCount}, (_, i) => i + 1);
  }

  print(): void {
    try {
      if (this.filteredProducts.length === 0) {
        alert('No products to print');
        return;
      }
      
      const WindowPrt = window.open('', '', 'left=0,top=0,width=900,height=900,toolbar=0,scrollbars=0,status=0');
      
      if (WindowPrt) {
        let tableRows = '';
        
        tableRows += `
          <tr>
            <th>Product</th>
            <th>SKU</th>
            <th>Unit Purchase Price (Exc Tax)</th>
            <th>Purchase Price (Inc Tax)</th>
            <th>Total Stock</th>
            <th>Stock by Location</th>
            <th>Category</th>
            <th>Brand</th>
            <th>Expiry Date</th>
          </tr>
        `;
        
        this.filteredProducts.forEach(product => {
          tableRows += `
            <tr>
              <td>${product.productName || ''}</td>
              <td>${product.sku || '-'}</td>
              <td>₹${this.formatCurrency(this.calculateUnitPurchasePriceExcTax(product))}</td>
              <td>₹${this.formatCurrency(product.defaultPurchasePriceIncTax || 0)}</td>
              <td>${product.totalStock || '0'}</td>
              <td>${this.getLocationStockSummary(product) || '-'}</td>
              <td>${product.category || '-'}</td>
              <td>${product.brand || '-'}</td>
              <td>${product.formattedExpiryDate || 'No expiry'}</td>
            </tr>
          `;
        });
        
        WindowPrt.document.write(`
          <html>
            <head>
              <title>Products Report</title>
              <style>
                body { font-family: Arial, sans-serif; }
                table { width: 100%; border-collapse: collapse; }
                th { background-color: #2980b9; color: white; text-align: left; }
                th, td { padding: 8px; border: 1px solid #ddd; }
                .title { text-align: center; margin-bottom: 20px; }
                .date { text-align: right; margin-bottom: 20px; }
              </style>
            </head>
            <body>
              <h1 class="title">Products Report</h1>
              <div class="date">${new Date().toLocaleDateString()}</div>
              <table>
                ${tableRows}
              </table>
            </body>
          </html>
        `);
        
        WindowPrt.document.close();
        WindowPrt.focus();
        
        setTimeout(() => {
          WindowPrt.print();
          WindowPrt.close();
        }, 500);
      }
    } catch (error) {
      console.error('Error printing:', error);
      alert('Failed to print. Please try again.');
    }
  }
}