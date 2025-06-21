import { ProductsService } from '../services/products.service';
import { Router } from '@angular/router';
import { LocationService } from '../services/location.service';
import { StockService } from '../services/stock.service';
import { FileUploadService } from '../services/file-upload.service';
import { forkJoin } from 'rxjs';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { BrandsService } from '../services/brands.service';
import { CategoriesService } from '../services/categories.service';
import { TaxService } from '../services/tax.service';
import { Component, HostListener, OnInit } from '@angular/core';
import { EventEmitter } from '@angular/core';
import { PurchaseService } from '../services/purchase.service';

@Component({
  selector: 'app-list-products',
  templateUrl: './list-products.component.html',
  styleUrls: ['./list-products.component.scss']
})
export class ListProductsComponent implements OnInit {
  products: any[] = [];
  filteredProducts: any[] = [];
  selectedStatus: string = '';
  currentSortColumn: string = 'productName';
  isAscending: boolean = true;
  brands: any[] = [];
  taxRates: any[] = [];

  // Image modal properties
  showImageModal = false;
  selectedProductForImage: any = null;
  selectedProductImageUrl: string = '';

  showInactiveProducts = false;
  filtersChanged = new EventEmitter<any>();
  fromDate: Date | null = null;
  toDate: Date | null = null;
  isDateDrawerOpen = false;
  isCustomDate = false;
  isDateFilterActive = false;
  selectedRange = '';
  dateRangeLabel = '';

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
  itemsPerPage: number = 25;
  Math = Math;
  originalProducts: any[] = [];
  showProductDetailsModal = false;
  isLoading: boolean = false;

  selectedProduct: any = null;
  showHistoryModal: boolean = false;
  productHistory: any[] = [];
  
  locations: any[] = [];
  showStockHistoryModal = false;
  stockHistory: any[] = [];
  users: any[] = [];

  filterOptions: {
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
  ) {}

  ngOnInit(): void {
    this.loadUsers();
    this.loadLocations().then(() => {
      this.loadProducts();
      this.loadBrands();
      this.loadCategories();
      this.loadTaxRates();
    });
  }

  // File and image methods
  hasProductImage(product: any): boolean {
    return !!(product?.productImageBase64 || 
              product?.productImage?.url || 
              product?.productImage?.downloadURL ||
              (typeof product?.productImage === 'string' && product?.productImage.startsWith('http')));
  }

  hasProductBrochure(product: any): boolean {
    return !!(product?.productBrochureBase64 || 
              product?.productBrochure?.url || 
              product?.productBrochure?.downloadURL ||
              (typeof product?.productBrochure === 'string' && product?.productBrochure.startsWith('http')));
  }

  getProductImageUrl(product: any): string {
    if (!product) return '';
    
    if (product.productImageBase64) {
      return product.productImageBase64;
    } else if (product.productImageThumbnail) {
      return product.productImageThumbnail;
    } else if (product.productImage?.url) {
      return product.productImage.url;
    } else if (product.productImage?.downloadURL) {
      return product.productImage.downloadURL;
    } else if (typeof product.productImage === 'string' && product.productImage.startsWith('http')) {
      return product.productImage;
    }
    
    return '';
  }

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

  // Enhanced loadProducts method
  loadProducts(): void {
    this.productService.getProductsRealTime().subscribe((data: any[]) => {
      this.products = data.map(product => {
        if (product.isActive === undefined) {
          product.isActive = true;
        }
        
        if (!product.status) {
          product.status = product.isActive ? 'Active' : 'Inactive';
        }
        
        product.formattedExpiryDate = this.formatExpiryDate(product.expiryDate);
        
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
        
        return product;
      });
      
      this.originalProducts = [...this.products];
      this.filteredProducts = [...this.products];
    }, error => {
      console.error('Error loading products:', error);
    });
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
          column === 'currentStock') {
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

  getLocationName(locationId: string): string {
    if (!locationId) return '-';
    
    if (this.selectedProduct?.locationNames?.length) {
      const index = this.selectedProduct.locations.indexOf(locationId);
      if (index >= 0 && this.selectedProduct.locationNames[index]) {
        return this.selectedProduct.locationNames[index];
      }
    }
    
    const location = this.locations.find(l => l.id === locationId);
    return location ? location.name : 'Unknown Location';
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
        const hasLocation = 
          (product.locationIds && product.locationIds.includes(this.selectedLocation)) ||
          (product.location === this.selectedLocation);
        
        return hasLocation;
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
          ...product.locationNames,
          product.displayStock?.toString(),
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

  viewProductSales(product: any): void {
    this.router.navigate(['/product-sales'], { 
      queryParams: { 
        productId: product.id,
        productName: product.productName 
      } 
    });
  }

  filterProducts(): void {
    this.currentPage = 1;
    
    if (!this.searchText || this.searchText.trim() === '') {
      this.applyLocationFilter();
      return;
    }

    const searchLower = this.searchText.toLowerCase().trim();
    const sourceProducts = this.selectedLocation ? 
      this.originalProducts.filter(p => p.location === this.selectedLocation) : 
      this.originalProducts;
      
    this.filteredProducts = sourceProducts.filter(product => {
      const searchString = [
        product.productName,
        product.sku,
        product.hsnCode,
        product.barcode,
        product.category,
        product.brand,
        product.productType,
        product.locationName,
        product.displayStock?.toString(),
        product.defaultPurchasePriceExcTax?.toString(),
        product.defaultSellingPriceExcTax?.toString()
      ]
      .filter(field => field)
      .join(' ')
      .toLowerCase();
      
      return searchString.includes(searchLower);
    });
    
    this.sortBy(this.currentSortColumn);
  }

  onSearchInput(): void {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    
    this.searchTimeout = setTimeout(() => {
      this.filterProducts();
    }, 300);
  }

  getPages(): number[] {
    const pageCount = Math.ceil(this.filteredProducts.length / this.itemsPerPage);
    return Array.from({length: pageCount}, (_, i) => i + 1);
  }

  updatePaginatedProducts(): void {
    this.currentPage = 1;
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

  navigateToAddProduct(): void {
    this.router.navigate(['/add-product']);
  }

  closeHistoryModal(): void {
    this.showHistoryModal = false;
    this.selectedProduct = null;
    this.productHistory = [];
  }

  formatDate(timestamp: any): string {
    if (!timestamp) return '';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleString();
    } catch (error) {
      console.error('Error formatting date:', error);
      return '';
    }
  }

  getHistoryIcon(action: string): string {
    switch (action) {
      case 'add': return '➕';
      case 'update': return '🔄';
      case 'stock_update': return '📦';
      case 'stock_in': return '⬆️';
      case 'stock_out': return '⬇️';
      case 'transfer': return '↔️';
      case 'delete': return '🗑️';
      case 'adjustment': return '⚖️';
      case 'purchase': return '🛒';
      case 'sale': return '💰';
      default: return '📝';
    }
  }

  editProduct(productId: string): void {
    this.router.navigate(['/products/edit', productId]);
  }

  closeProductDetailsModal(): void {
    this.showProductDetailsModal = false;
    this.selectedProduct = null;
  }
  
  getHistoryClass(action: string): string {
    switch (action) {
      case 'add': return 'text-success';
      case 'update': return 'text-primary';
      case 'stock_update': return 'text-info';
      case 'stock_in': return 'text-success';
      case 'stock_out': return 'text-warning';
      case 'transfer': return 'text-info';
      case 'delete': return 'text-danger';
      case 'adjustment': return 'text-secondary';
      case 'purchase': return 'text-success';
      case 'sale': return 'text-primary';
      default: return '';
    }
  }
  
  calculateStockValue(quantity: number, price: number): number {
    return quantity * price;
  }
  
  exportToCSV(): void {
    try {
      if (this.filteredProducts.length === 0) {
        alert('No products to export');
        return;
      }

      const data = this.filteredProducts.map(product => ({
        'Product Name': product.productName || '',
        'SKU': product.sku || '',
        'Purchase Price': product.defaultPurchasePriceExcTax || 0,
        'Alert Quantity': product.alertQuantity || 0,
        'Selling Price': product.defaultSellingPriceExcTax || 0,
        'Current Stock': product.displayStock || '0',
        'Location': product.locationName || '-',
        'Product Type': product.productType || '-',
        'Unit Purchase Price': product.unitPurchasePrice || 0,
        'Unit Selling Price': product.unitSellingPrice || 0,
        'Category': product.category || '-',
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
      saveAs(blob, 'products_' + new Date().toISOString().slice(0, 10) + '.csv');
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
        'Purchase Price': product.defaultPurchasePriceExcTax || 0,
        'Selling Price': product.defaultSellingPriceExcTax || 0,
        'Current Stock': product.displayStock || '0',
        'Location': product.locationName || '-',
        'Product Type': product.productType || '-',
        'Alert Quantity': product.alertQuantity || 0,
        'Category': product.category || '-',
        'Brand': product.brand || '-',
        'Tax': product.displayTax || '-',
        'Expiry Date': product.formattedExpiryDate || 'No expiry'
      }));
  
      const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data);
      const workbook: XLSX.WorkBook = { Sheets: { 'data': worksheet }, SheetNames: ['data'] };
      const excelBuffer: any = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      this.saveAsExcelFile(excelBuffer, 'products');
    } catch (error) {
      console.error('Error exporting Excel:', error);
      alert('Failed to export Excel. Please try again.');
    }
  }
  
  private saveAsExcelFile(buffer: any, fileName: string): void {
    const data: Blob = new Blob([buffer], { type: 'application/octet-stream' });
    saveAs(data, fileName + '_' + new Date().toISOString().slice(0, 10) + '.xlsx');
  }
  
  exportToPDF(): void {
    try {
      if (this.filteredProducts.length === 0) {
        alert('No products to export');
        return;
      }

      const doc = new jsPDF();
      const title = 'Products Report - ' + new Date().toLocaleDateString();
      
      doc.text(title, 14, 16);
      
      (doc as any).autoTable({
        head: [['Product', 'SKU', 'Purchase Price', 'Selling Price', 'Stock', 'Location', 'Expiry Date']],
        body: this.filteredProducts.map(product => [
          product.productName || '',
          product.sku || '',
          '₹' + (product.defaultPurchasePriceExcTax || 0).toFixed(2),
          '₹' + (product.defaultSellingPriceExcTax || 0).toFixed(2),
          product.displayStock || '0',
          product.locationName || '-',
          product.formattedExpiryDate || 'No expiry'
        ]),
        startY: 20,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [41, 128, 185], textColor: 255 }
      });
  
      doc.save('products_' + new Date().toISOString().slice(0, 10) + '.pdf');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Failed to export PDF. Please try again.');
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

  hasSelectedProducts(): boolean {
    return this.filteredProducts.some(product => product.selected);
  }

  getSelectedCount(): number {
    return this.filteredProducts.filter(product => product.selected).length;
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

  applyFilters(): void {
    this.currentPage = 1;
    
    this.filteredProducts = this.originalProducts.filter(product => {
      // Location filter
      if (this.selectedLocation) {
        const hasLocation = 
          (product.locationIds && product.locationIds.includes(this.selectedLocation)) ||
          (product.location === this.selectedLocation) ||
          (product.primaryLocationId === this.selectedLocation);
        
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
        if (this.selectedStatus === 'active' && (!product.isActive || product.notForSelling)) {
          return false;
        }
        if (this.selectedStatus === 'notForSelling' && !product.notForSelling) {
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
          product.locationName,
          product.displayStock?.toString(),
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

  clearDateFilter(): void {
    this.selectedRange = '';
    this.dateRangeLabel = '';
    this.isDateFilterActive = false;
    this.filterOptions.fromDate = null;
    this.filterOptions.toDate = null;
    this.applyFilters();
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
            <th>Purchase Price</th>
            <th>Selling Price</th>
            <th>Stock</th>
            <th>Location</th>
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
              <td>₹${(product.defaultPurchasePriceExcTax || 0).toFixed(2)}</td>
              <td>₹${(product.defaultSellingPriceExcTax || 0).toFixed(2)}</td>
              <td>${product.displayStock || '0'}</td>
              <td>${product.locationName || '-'}</td>
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
}