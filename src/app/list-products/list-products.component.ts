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
  selectedStatus: string = ''; // Add this with other filter properties
  currentSortColumn: string = 'productName';
isAscending: boolean = true;
  brands: any[] = [];
  taxRates: any[] = [];

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
originalProducts: any[] = []; // To store the original unfiltered products
  showProductDetailsModal = false;
  isLoading: boolean = false;

  selectedProduct: any = null;
  showHistoryModal: boolean = false;
  productHistory: any[] = [];
  
  locations: any[] = [];
  showStockHistoryModal = false;
  stockHistory: any[] = [];
  users: any[] = []; // To store user information

  constructor(
    private productService: ProductsService,
    private router: Router,
    private locationService: LocationService,
    private stockService: StockService,
      private brandService: BrandsService,
  private categoryService: CategoriesService,
  private taxService: TaxService,
  private purchaseService:PurchaseService,
  ) {}

  ngOnInit(): void {
    this.loadUsers(); // Load users on init
    this.loadLocations().then(() => {
      this.loadProducts();
        this.loadBrands();
  this.loadCategories();
  this.loadTaxRates();
    });
  }

  // Add method to toggle all products
  toggleAllProducts(event: Event): void {
    const isChecked = (event.target as HTMLInputElement).checked;
    this.filteredProducts.forEach(product => {
      product.selected = isChecked;
    });
  }
  // Add these methods to your component class
openAddToLocationModal(): void {
  this.showAddToLocationModal = true;
}
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

 
filterOptions: {
  brandId: string;
  categoryId: string;
  taxId: string;
  locationId: string;
  statusId: string; // Added statusId to the type definition
  fromDate: Date | null;
  toDate: Date | null;
} = {
  brandId: '',
  categoryId: '',
  taxId: '',
  locationId: '',
  statusId: '', // Added statusId to the initial value
  fromDate: null,
  toDate: null
};
loadCategories(): void {
  this.categoryService.getCategories().subscribe(categories => {
    console.log('Loaded categories:', categories);
    this.categories = categories;
  });
}

addOpeningStock(product: any) {
  // Navigate to opening stock component with product data
  this.router.navigate(['/opening-stock'], {
    queryParams: { 
      productId: product.id,
      productData: JSON.stringify(product) // Pass the entire product object as string
    }
  });
}
loadTaxRates(): void {
  // Implement your tax service call here
  this.taxService.getTaxRates().subscribe(taxes => {
    this.taxRates = taxes;
  });
}
viewProductHistory(product: any): void {
  // Navigate to product history with both product data and purchase order data
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

closeAddToLocationModal(): void {
  console.log('Closing modal, setting showAddToLocationModal to false');
  this.showAddToLocationModal = false;
  this.selectedLocationForAdd = '';
}
// Add this method to your component
sortBy(column: string): void {
  if (this.currentSortColumn === column) {
    // If same column, toggle the direction
    this.isAscending = !this.isAscending;
  } else {
    // If new column, default to ascending
    this.currentSortColumn = column;
    this.isAscending = true;
  }

  this.filteredProducts.sort((a, b) => {
    // Handle null/undefined values
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

  // Reset to first page when sorting changes
  this.currentPage = 1;
}
async toggleSellingStatus(productId: string, notForSelling: boolean): Promise<void> {
  try {
    this.isLoading = true;
    await this.productService.updateProduct(productId, {
      notForSelling: notForSelling
    });
    const message = notForSelling ? 'marked as not for selling' : 'marked as available for selling';
    alert(`Product ${message} successfully`);
    this.loadProducts(); // Refresh the list
  } catch (error) {
    console.error('Error toggling selling status:', error);
    alert('Failed to update product status');
  } finally {
    this.isLoading = false;
  }
}async toggleBulkSellingStatus(): Promise<void> {
  const selectedProducts = this.filteredProducts.filter(p => p.selected);
  if (selectedProducts.length === 0) {
    alert('No products selected');
    return;
  }

  // Determine if we're marking as not for selling or available for selling
  const allNotForSelling = selectedProducts.every(p => p.notForSelling);
  const allForSelling = selectedProducts.every(p => !p.notForSelling);
  
  let action: string;
  let newStatus: boolean;
  
  if (allNotForSelling) {
    // All selected are not for selling, so we'll mark them as available
    action = 'mark as available for selling';
    newStatus = false;
  } else if (allForSelling) {
    // All selected are for selling, so we'll mark them as not for selling
    action = 'mark as not for selling';
    newStatus = true;
  } else {
    // Mixed selection - ask user what they want to do
    const userChoice = confirm('You have selected both "Not for Selling" and regular products. Do you want to mark all as "Not for Selling"?');
    action = userChoice ? 'mark as not for selling' : 'mark as available for selling';
    newStatus = userChoice;
  }

  if (!confirm(`Are you sure you want to ${action} ${selectedProducts.length} selected products?`)) {
    return;
  }

  try {
    this.isLoading = true;
    
    // Update each selected product's notForSelling status
    const updatePromises = selectedProducts.map(product => {
      return this.productService.updateProduct(product.id, {
        notForSelling: newStatus
      });
    });

    await Promise.all(updatePromises);
    alert(`${selectedProducts.length} products ${action} successfully`);
    
    // Clear selection
    this.filteredProducts.forEach(p => p.selected = false);
    
    // Refresh the list
    this.loadProducts();
  } catch (error) {
    console.error(`Error ${action} products:`, error);
    alert(`Failed to ${action} products. Please try again.`);
  } finally {
    this.isLoading = false;
  }
}
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
    
    console.log('Updating products with location:', {
      locationId: this.selectedLocationForAdd,
      locationName: location?.name || 'Unknown Location'
    });

    const updatePromises = selectedProducts.map(product => {
      const updateData = {
        location: this.selectedLocationForAdd,
        locationName: location?.name || 'Unknown Location',
        // Also update the locations array if you're using it
        locations: [this.selectedLocationForAdd],
        locationNames: [location?.name || 'Unknown Location']
      };
      console.log(`Updating product ${product.id}:`, updateData);
      return this.productService.updateProduct(product.id, updateData);
    });

    await Promise.all(updatePromises);
    console.log('Products updated successfully');
    alert(`${selectedProducts.length} products added to ${location?.name || 'selected location'}`);
    
    // Clear selection
    this.filteredProducts.forEach(p => p.selected = false);
    
    // Close the modal
    this.closeAddToLocationModal();
    
    // Refresh the products list
    this.loadProducts(); // This will reload all products with updated locations
    
  } catch (error) {
    console.error('Error adding products to location:', error);
    
  } 
  }
  
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
    
    // Update each selected product to remove location
    const updatePromises = selectedProducts.map(product => {
      return this.productService.updateProduct(product.id, {
        location: '',
        locationName: ''
      });
    });

    await Promise.all(updatePromises);
    alert(`${selectedProducts.length} products removed from their locations`);
    
    // Clear selection
    this.filteredProducts.forEach(p => p.selected = false);
  } catch (error) {
    console.error('Error removing products from location:', error);
    alert('successfully to remove products from location. ');
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

  // Determine if we're activating or deactivating based on the first selected product
  const firstSelected = selectedProducts[0];
  const activate = !firstSelected.isActive;
  const action = activate ? 'activate' : 'deactivate';

  if (!confirm(`Are you sure you want to ${action} ${selectedProducts.length} selected products?`)) {
    return;
  }

  try {
    this.isLoading = true;
    
    // Update each selected product's active status
    const updatePromises = selectedProducts.map(product => {
      return this.productService.updateProduct(product.id, {
        isActive: activate,
        status: activate ? 'Active' : 'Inactive'
      });
    });

    await Promise.all(updatePromises);
    alert(`${selectedProducts.length} products ${action}d successfully`);
    
    // Clear selection
    this.filteredProducts.forEach(p => p.selected = false);
    
    // Refresh the list
    this.loadProducts();
  } catch (error) {
    console.error(`Error ${action}ing products:`, error);
    alert(`Failed to ${action} products. Please try again.`);
  } finally {
    this.isLoading = false;
  }
}
  // Add method to load users
  loadUsers(): void {
    // Replace with your actual user service method
    // This is a placeholder assuming you have a method to get users
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
  
  // Check if all selected products are inactive
  const allInactive = selectedProducts.every(p => !p.isActive);
  if (allInactive) {
    return 'Activate Selected';
  }
  
  // Check if all selected products are active
  const allActive = selectedProducts.every(p => p.isActive);
  if (allActive) {
    return 'Deactivate Selected';
  }
  
  // Mixed selection
  return 'Toggle Activation';
}
  closeStockHistoryModal(): void {
    this.showStockHistoryModal = false;
    this.selectedProduct = null;
    this.stockHistory = [];
  }
  

  // Enhanced stock history loading with more details
  async loadEnhancedStockHistory(productId: string): Promise<void> {
    try {
      // Get the full product details
      const product = await this.productService.getProductById(productId).then(p => p);
      
      // Get stock history
      const productHistory = await this.productService.getProductStockHistory(productId).toPromise();
      
      // Get stock transfers
      const stockTransfers = await this.stockService.getStockTransfersByProduct(productId).toPromise();
      
      // Enhanced history entries with more details
      this.stockHistory = [
        ...(productHistory ? productHistory.map((entry: any) => {
          // Find the user who made this action
          const user = this.users.find(u => u.id === entry.userId);
          
          return {
            ...entry,
            timestamp: entry.timestamp,
            action: entry.action,
            quantity: entry.quantity,
            notes: entry.notes,
            userName: user ? user.name : 'System',
            // Add additional details
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
          
          // Find the user who made this transfer
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
            // Add additional details
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
        return dateB - dateA; // Sort newest first
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
  
  // First check if the product has locationNames array
  if (this.selectedProduct?.locationNames?.length) {
    const index = this.selectedProduct.locations.indexOf(locationId);
    if (index >= 0 && this.selectedProduct.locationNames[index]) {
      return this.selectedProduct.locationNames[index];
    }
  }
  
  // Fallback to locations service
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
loadProducts(): void {
  this.productService.getProductsRealTime().subscribe((data: any[]) => {
    this.products = data.map(product => {
      // Ensure isActive is properly set (default to true if undefined)
      if (product.isActive === undefined) {
        product.isActive = true;
      }
      
      // Ensure status is set
      if (!product.status) {
        product.status = product.isActive ? 'Active' : 'Inactive';
      }
      
      // Format tax display
      if (product.applicableTax) {
        if (typeof product.applicableTax === 'string') {
          // If tax is stored as string (name)
          product.displayTax = product.applicableTax;
        } else if (product.applicableTax.name) {
          // If tax is stored as object
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
  });
}
// In list-products.component.ts

applyLocationFilter(): void {
  if (!this.selectedLocation) {
    this.filteredProducts = [...this.originalProducts];
  } else {
    this.filteredProducts = this.originalProducts.filter(product => {
      // Check both the locations array and the single location field
      const hasLocation = 
        (product.locationIds && product.locationIds.includes(this.selectedLocation)) ||
        (product.location === this.selectedLocation);
      
      return hasLocation;
    });
  }


  // Apply search filter if there's search text
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

  // Reapply sorting
  this.sortBy(this.currentSortColumn);
  this.currentPage = 1;
  }
  formatExpiryDate(dateString: string): string {
  if (!dateString) return 'No expiry';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid date';
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (e) {
    return 'Invalid date';
  }
  }
  // Add these methods to check expiry status
isExpired(expiryDate: string): boolean {
  if (!expiryDate) return false;
  
  try {
    const expiry = new Date(expiryDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return expiry < today;
  } catch (e) {
    return false;
  }
}

isExpiringSoon(expiryDate: string): boolean {
  if (!expiryDate) return false;
  
  try {
    const expiry = new Date(expiryDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const oneMonthFromNow = new Date();
    oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
    oneMonthFromNow.setHours(0, 0, 0, 0);
    
    return expiry >= today && expiry <= oneMonthFromNow;
  } catch (e) {
    return false;
  }
}

  // In your product list component
// In your component class
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
      product.hsnCode, // Add HSN code to search
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

// Update the search handling to include debounce functionality
// Add this property and method to your component
searchTimeout: any = null;

onSearchInput(): void {
  // Clear the previous timeout
  if (this.searchTimeout) {
    clearTimeout(this.searchTimeout);
  }
  
  // Set a new timeout to avoid excessive filtering
  this.searchTimeout = setTimeout(() => {
    this.filterProducts();
  }, 300); // 300ms debounce time
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
        // Product will be automatically removed from the list
        // due to the real-time subscription
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
  
  // Calculate stock value based on purchase price
  calculateStockValue(quantity: number, price: number): number {
    return quantity * price;
  }
  
  // Export to CSV
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
  
  // Export to Excel
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
  
  // Export to PDF
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
        head: [['Product', 'SKU', 'Purchase Price', 'Selling Price', 'Stock', 'Location']],
        body: this.filteredProducts.map(product => [
          product.productName || '',
          product.sku || '',
          '₹' + (product.defaultPurchasePriceExcTax || 0).toFixed(2),
          '₹' + (product.defaultSellingPriceExcTax || 0).toFixed(2),
          product.displayStock || '0',
          product.locationName || '-'
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
  // Add to list-products.component.ts
  getProductImageUrl(product: any): string {
    if (!product) return '';
    
    // Handle different image formats
    if (product.productImageUrl) {
      return product.productImageUrl;
    } else if (typeof product.productImage === 'string' && product.productImage.startsWith('http')) {
      // If it's a URL string
      return product.productImage;
    } else if (product.productImage?.url) {
      // If it's an object with url property
      return product.productImage.url;
    } else if (product.productImage?.downloadURL) {
      // If it's a Firebase storage reference
      return product.productImage.downloadURL;
    }
    
    // Default placeholder if no image
    return 'assets/images/placeholder.png'; // Make sure this path exists in your assets folder
  }
// Check if any products are selected
hasSelectedProducts(): boolean {
  return this.filteredProducts.some(product => product.selected);
}

// Get count of selected products
getSelectedCount(): number {
  return this.filteredProducts.filter(product => product.selected).length;
}
// Delete selected products
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
    this.isLoading = true; // Show loading state
    
    // Create an array of delete promises
    const deletePromises = selectedProducts.map(product => 
      this.productService.deleteProduct(product.id)
    );
    
    // Execute all delete operations in parallel
    await Promise.all(deletePromises);
    
    alert(`${selectedProducts.length} products deleted successfully`);
    
    // Clear selection after deletion
    this.filteredProducts.forEach(product => product.selected = false);
    
  } catch (error) {
    console.error('Error deleting selected products:', error);
    alert('Error deleting some products. Please try again.');
  } finally {
    this.isLoading = false; // Hide loading state
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
    
    // Brand filter - enhanced to handle different data structures
    if (this.selectedBrand) {
      if (product.brandId === this.selectedBrand) {
        // Simple case where product has brandId that matches
      } else if (product.brand && typeof product.brand === 'object' && product.brand.id === this.selectedBrand) {
        // Case where brand is an object with id property
      } else if (product.brand === this.selectedBrand) {
        // Case where brand is just the ID as a string
      } else {
        return false; // Doesn't match the selected brand
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
        return false; // Doesn't match the selected category
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
    
    // Status filter - updated to handle isActive properly
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
    
    // Date filter - improved date handling
    if (this.isDateFilterActive && this.filterOptions.fromDate && this.filterOptions.toDate) {
      let productDate: Date | null = null;
      
      // Handle different date formats
      if (product.createdDate?.toDate) {
        productDate = product.createdDate.toDate();
      } else if (product.createdDate) {
        productDate = new Date(product.createdDate);
      } else if (product.addedDate) {
        productDate = new Date(product.addedDate);
      }
      
      // If we couldn't parse a date, exclude this product
      if (!productDate || isNaN(productDate.getTime())) {
        return false;
      }
      
      // Normalize dates by setting time to midnight for comparison
      const fromDate = new Date(this.filterOptions.fromDate);
      fromDate.setHours(0, 0, 0, 0);
      
      const toDate = new Date(this.filterOptions.toDate);
      toDate.setHours(23, 59, 59, 999);
      
      productDate.setHours(12, 0, 0, 0); // Set to noon to avoid timezone issues
      
      if (productDate < fromDate || productDate > toDate) {
        return false;
      }
    }
    
    return true;
  });

  // Apply search filter if there's search text
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
  
  // Reapply sorting
  this.sortBy(this.currentSortColumn);
}

// Reset all filters
resetFilters(): void {
  // Reset all filter values
  this.selectedBrand = '';
  this.selectedCategory = '';
  this.selectedTax = '';
  this.selectedLocation = '';
  this.selectedStatus = ''; // Added status filter reset
  this.searchText = '';
  
  // Reset date filter
  this.clearDateFilter();
  
  // Reset filter options
  this.filterOptions = {
    brandId: '',
    categoryId: '',
    taxId: '',
    locationId: '',
    statusId: '', // Added status to filter options
    fromDate: null,
    toDate: null
  };
  
  // Reset UI states
  this.isDateFilterActive = false;
  this.selectedRange = '';
  this.dateRangeLabel = '';
  
  // Apply the reset filters
  this.applyFilters();
}
  // Date filter related methods
// Date filter related methods
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
  // Reset dates when selecting custom range
  this.filterOptions.fromDate = null;
  this.filterOptions.toDate = null;
}cancelCustomRange(): void {
  this.isCustomDate = false;
  this.selectedRange = '';
  this.toggleDateDrawer();
}
// Update applyCustomRange
applyCustomRange(): void {
  if (!this.fromDate || !this.toDate) {
    alert('Please select both start and end dates');
    return;
  }

  // Set the filter options
  this.filterOptions.fromDate = new Date(this.fromDate);
  this.filterOptions.toDate = new Date(this.toDate);

  // Ensure fromDate is before toDate
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
      
      // Create a new window for printing
      const WindowPrt = window.open('', '', 'left=0,top=0,width=900,height=900,toolbar=0,scrollbars=0,status=0');
      
      if (WindowPrt) {
        // Generate table rows from filteredProducts
        let tableRows = '';
        
        // Add header row
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
          </tr>
        `;
        
        // Add data rows
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
            </tr>
          `;
        });
        
        // Write the complete HTML to the new window
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
        
        // Close the document writing, prepare for printing
        WindowPrt.document.close();
        WindowPrt.focus();
        
        // Add a slight delay to ensure content is fully loaded
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
    // Get purchase data for this product
    const purchases = await this.purchaseService.getPurchasesByProductId(product.id);
    
    // Navigate to the details component with both sets of data
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