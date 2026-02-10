import { Component, OnInit } from '@angular/core';
import { ProductsService } from '../services/products.service';
import { Router } from '@angular/router';
import { LocationService } from '../services/location.service';
import { StockService } from '../services/stock.service';
import { forkJoin } from 'rxjs';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { BrandsService } from '../services/brands.service';
import { CategoriesService } from '../services/categories.service';
import { TaxService } from '../services/tax.service';
import { Firestore, doc, getDoc, collection, getDocs, query, where } from '@angular/fire/firestore';
import { COLLECTIONS } from '../../utils/constants';

@Component({
  selector: 'app-not-selling',
  templateUrl: './not-selling.component.html',
  styleUrls: ['./not-selling.component.scss']
})
export class NotSellingComponent implements OnInit {
  products: any[] = [];
  filteredProducts: any[] = [];
  currentSortColumn: string = 'productName';
  isAscending: boolean = true;
  brands: any[] = [];
  taxRates: any[] = [];
  categories: any[] = [];
  locations: any[] = [];
  itemsPerPage: number = 10;

  searchText: string = '';
  currentPage: number = 1;
  totalPages: number = 1;
  Math = Math;
  isLoading: boolean = false;
  selectedProduct: any = null;
  showProductDetailsModal = false;

  constructor(
    private productService: ProductsService,
    private router: Router,
    private locationService: LocationService,
    private brandService: BrandsService,
    private categoryService: CategoriesService,
    private taxService: TaxService,
    private stockService: StockService,
    private firestore: Firestore
  ) {}

  ngOnInit(): void {
    this.loadLocations().then(() => {
      this.loadProducts();
      this.loadBrands();
      this.loadCategories();
      this.loadTaxRates();
    });
  }

  async loadProducts(): Promise<void> {
    this.isLoading = true;
    
    try {
      this.productService.getProductsRealTime().subscribe(async (data: any[]) => {
        // Filter only not-for-selling products
        const notForSellingProducts = data.filter(product => product.notForSelling === true);
        
        // Process each product and load its stock per location (same as list-products)
        const processedProducts = await Promise.all(notForSellingProducts.map(async (product) => {
          if (product.isActive === undefined) {
            product.isActive = true;
          }
          
          if (!product.status) {
            product.status = product.isActive ? 'Active' : 'Inactive';
          }
          
          // Format expiry date
          if (product.expiryDate) {
            product.formattedExpiryDate = this.formatExpiryDate(product.expiryDate);
          }
          
          // Format tax display
          if (product.applicableTax) {
            if (typeof product.applicableTax === 'string') {
              product.displayTax = product.applicableTax;
            } else if (product.applicableTax.name) {
              product.displayTax = `${product.applicableTax.name} (${product.applicableTax.percentage}%)`;
            } else {
              product.displayTax = '-';
            }
          } else {
            product.displayTax = '-';
          }
          
          // Load stock per location for this product (same method as list-products)
          if (product.id) {
            try {
              product.locationStocks = await this.getProductStockAtAllLocations(product.id);
              product.totalStock = this.getTotalStockAcrossLocations(product);
              product.currentStock = product.totalStock; // For backward compatibility
              
              // Set displayStock to show total across all locations
              product.displayStock = product.totalStock;
            } catch (error) {
              console.error(`Error loading stock for product ${product.id}:`, error);
              product.locationStocks = {};
              product.totalStock = 0;
              product.currentStock = 0;
              product.displayStock = '0';
            }
          }
          
          return product;
        }));
        
        this.products = processedProducts;
        this.filteredProducts = [...this.products];
        this.updatePagination();
        this.isLoading = false;
      }, error => {
        console.error('Error loading products:', error);
        this.isLoading = false;
      });
    } catch (error) {
      console.error('Error in loadProducts:', error);
      this.isLoading = false;
    }
  }

  // Use the same stock loading method as list-products component
  async getProductStockAtAllLocations(productId: string): Promise<{[key: string]: number}> {
    try {
      const stockQuery = query(
        collection(this.firestore, COLLECTIONS.PRODUCT_STOCK),
        where('productId', '==', productId)
      );
      const stockSnapshot = await getDocs(stockQuery);
      
      const locationStocks: {[key: string]: number} = {};
      
      stockSnapshot.forEach((doc: any) => {
        const stockData = doc.data() as any;
        if (stockData.locationId && stockData.quantity !== undefined) {
          locationStocks[stockData.locationId] = stockData.quantity;
        }
      });
      
      return locationStocks;
    } catch (error) {
      console.error('Error fetching product stock at all locations:', error);
      return {};
    }
  }

/**
 * Checks if a product has a valid image to display.
 * @param product The product object.
 * @returns True if an image is available, false otherwise.
 */
hasProductImage(product: any): boolean {
  if (!product || !product.productImage) {
    return false;
  }
  const image = product.productImage;
  // This handles both the new object format { data: '...' } and older URL formats.
  return !!(
    (typeof image === 'object' && image.data) ||
    (typeof image === 'string' && image.startsWith('data:image')) ||
    image.url ||
    image.downloadURL
  );
}

/**
 * Gets the correct, displayable URL for a product's image.
 * @param product The product object.
 * @returns A base64 data URL or a standard URL, or a placeholder path.
 */
getProductImageUrl(product: any): string {
  const placeholder = 'assets/img/placeholder.png'; // <-- IMPORTANT: Add a real path to a placeholder image
  if (!this.hasProductImage(product)) {
    return placeholder;
  }

  const image = product.productImage;

  // 1. Prioritize the new base64 object format.
  if (typeof image === 'object' && image.data) {
    return image.data;
  }
  
  // 2. Handle older base64 string format.
  if (typeof image === 'string' && image.startsWith('data:image')) {
    return image;
  }

  // 3. Handle cloud storage URL formats.
  if (image.url) return image.url;
  if (image.downloadURL) return image.downloadURL;

  return placeholder;
}

  // Calculate total stock across all locations for a product (same as list-products)
  getTotalStockAcrossLocations(product: any): number {
    if (!product.locationStocks) return 0;
    
    return Object.values(product.locationStocks)
      .filter(stock => typeof stock === 'number')
      .reduce((total: number, stock: number) => total + stock, 0);
  }

  // Enhanced date formatting method (same as list-products)
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

  getLocationName(locationId: string): string {
    if (!locationId) return '-';
    const location = this.locations.find(l => l.id === locationId);
    return location ? location.name : 'Unknown Location';
  }

  getLocationStockSummary(product: any): string {
    if (!product.locationStocks) return '';
    
    const entries = this.getLocationStockEntries(product.locationStocks);
    return entries.map(entry => 
      `${this.getLocationName(entry.locationId)}: ${entry.stock}`
    ).join('; ');
  }

  // Get location stock entries for display (same as list-products)
  getLocationStockEntries(locationStocks: {[key: string]: number}): {locationId: string, stock: number}[] {
    if (!locationStocks) return [];
    
    return Object.entries(locationStocks)
      .filter(([locationId, stock]) => stock > 0)
      .map(([locationId, stock]) => ({ locationId, stock }))
      .sort((a, b) => b.stock - a.stock); // Sort by stock descending
  }

  getLocationNames(locationStocks: any): string[] {
    return Object.keys(locationStocks || {});
  }

  // Helper method for template to access Object.keys
  getObjectKeys(obj: any): string[] {
    return Object.keys(obj || {});
  }

  getPages(): number[] {
    const pageCount = Math.ceil(this.filteredProducts.length / this.itemsPerPage);
    const visiblePages = 5;
    const pages: number[] = [];
    
    if (pageCount <= visiblePages) {
      for (let i = 1; i <= pageCount; i++) {
        pages.push(i);
      }
    } else {
      let startPage = Math.max(1, this.currentPage - Math.floor(visiblePages / 2));
      let endPage = startPage + visiblePages - 1;
      
      if (endPage > pageCount) {
        endPage = pageCount;
        startPage = Math.max(1, endPage - visiblePages + 1);
      }
      
      if (startPage > 1) {
        pages.push(1);
        if (startPage > 2) {
          pages.push(-1);
        }
      }
      
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
      
      if (endPage < pageCount) {
        if (endPage < pageCount - 1) {
          pages.push(-1);
        }
        pages.push(pageCount);
      }
    }
    
    return pages;
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

  loadBrands(): void {
    this.brandService.getBrands().subscribe(brands => {
      this.brands = brands;
    });
  }

  loadCategories(): void {
    this.categoryService.getCategories().subscribe(categories => {
      this.categories = categories;
    });
  }

  loadTaxRates(): void {
    this.taxService.getTaxRates().subscribe(taxes => {
      this.taxRates = taxes;
    });
  }

  sortBy(column: string): void {
    if (this.currentSortColumn === column) {
      this.isAscending = !this.isAscending;
    } else {
      this.currentSortColumn = column;
      this.isAscending = true;
    }

    this.filteredProducts.sort((a, b) => {
      const valA = a[column] === undefined || a[column] === null ? '' : a[column];
      const valB = b[column] === undefined || b[column] === null ? '' : b[column];

      // Special handling for numeric fields
      if (column === 'defaultPurchasePriceExcTax' || 
          column === 'defaultSellingPriceExcTax' || 
          column === 'currentStock' || 
          column === 'totalStock') {
        const numA = Number(valA) || 0;
        const numB = Number(valB) || 0;
        return this.isAscending ? numA - numB : numB - numA;
      }

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

  viewProductDetails(product: any): void {
    this.selectedProduct = product;
    this.showProductDetailsModal = true;
  }

  closeProductDetailsModal(): void {
    this.showProductDetailsModal = false;
    this.selectedProduct = null;
  }

  editProduct(productId: string): void {
    this.router.navigate(['/products/edit', productId]);
  }

  onSearchInput(): void {
    this.filterProducts();
  }

  filterProducts(): void {
    if (!this.searchText || this.searchText.trim() === '') {
      this.filteredProducts = [...this.products];
    } else {
      const searchLower = this.searchText.toLowerCase().trim();
      this.filteredProducts = this.products.filter(product => {
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
    this.updatePagination();
  }

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

  goToPage(page: number): void {
    if (page >= 1 && page <= Math.ceil(this.filteredProducts.length / this.itemsPerPage)) {
      this.currentPage = page;
    }
  }

  updatePaginatedProducts(): void {
    this.currentPage = 1;
  }

  updatePagination(): void {
    this.totalPages = Math.ceil(this.filteredProducts.length / this.itemsPerPage);
    if (this.currentPage > this.totalPages && this.totalPages > 0) {
      this.currentPage = this.totalPages;
    } else if (this.totalPages === 0) {
      this.currentPage = 1;
    }
  }

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

  goToAllProducts(): void {
    this.router.navigate(['/products']);
  }
}