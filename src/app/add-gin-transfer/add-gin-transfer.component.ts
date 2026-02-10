import { Component, HostListener, OnInit, ViewChild, ElementRef } from '@angular/core';import { FormBuilder, FormGroup, Validators, FormArray, AbstractControl, FormControl, ValidatorFn } from '@angular/forms';
import { ProductsService } from '../services/products.service';
import { LocationService } from '../services/location.service';
import { formatDate } from '@angular/common';
import { GinTransferService, GinTransfer, LocationTransfer, TransferProduct } from '../services/gin-transfer.service';
import { Firestore, collection, doc, setDoc, getDoc, getDocs } from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { StockService } from '../services/stock.service';

const COLLECTIONS = {
  PRODUCT_STOCK: 'product-stock',
  PRODUCTS: 'products',
  LOCATIONS: 'locations',
  GIN_STOCK_LOG: 'gin-stock-log'
};

interface Product {
  id: string;
  productName: string;
  sku: string;
  unit: string;
  barcode?: string;
  defaultSellingPriceExcTax: number | null;
  location?: string;
  locationName?: string;
  locations?: string[];
  locationNames?: string[];
}

@Component({
  selector: 'app-add-gin-transfer',
  templateUrl: './add-gin-transfer.component.html',
  styleUrls: ['./add-gin-transfer.component.scss']
})
export class AddGinTransferComponent implements OnInit {
  ginTransferForm: FormGroup;
  
  locations: any[] = [];
  products: Product[] = [];
  filteredProducts: Product[] = [];
  @ViewChild('datePicker') datePicker!: ElementRef;

  searchTerm: string = '';
  currentDate: string;
  isSaving: boolean = false;
  showSearchResults: boolean = false;
  stockDisplayMap = new Map<string, number>();
  
  grandTotal: number = 0;
  submitError: string | null = null;
  stockValidationErrors: { [key: number]: string | null } = {};
  
  debugMode: boolean = false;
  lastError: string = '';



  @HostListener('window:beforeunload', ['$event'])
  handleBeforeUnload(event: BeforeUnloadEvent) {
    if (this.hasProductsToTransfer() && !this.isSaving) {
      event.preventDefault();
      event.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      return event.returnValue;
    }
    return;
  }

  ngOnInit(): void {
    this.loadLocations();
    this.loadProducts();
  }

  get locationTransfers(): FormArray {
    return this.ginTransferForm.get('locationTransfers') as FormArray;
  }

  createLocationTransfer(): FormGroup {
    return this.fb.group({
      locationTo: ['', Validators.required],
      products: this.fb.array([], this.atLeastOneProductValidator())
    });
  }

  addLocationTransfer(): void {
    this.locationTransfers.push(this.createLocationTransfer());
    this.calculateTotal();
  }

  removeLocationTransfer(index: number): void {
    if (this.locationTransfers.length > 1) {
      this.locationTransfers.removeAt(index);
      this.calculateTotal();
    }
  }

  getProductsArray(transfer: AbstractControl): FormArray {
    return transfer.get('products') as FormArray;
  }

  createProduct(): FormGroup {
    return this.fb.group({
      productId: ['', Validators.required],
      productName: [''],
      sku: [''],
      barcode: [''],
      quantity: [1, [Validators.required, Validators.min(1)]],
      unitPrice: [0, [Validators.required, Validators.min(0.01)]],
      subtotal: [0],
      unit: [''],
      currentStock: [0]
    });
  }

  addProduct(transferIndex: number): void {
    const productsArray = this.getProductsArray(this.locationTransfers.at(transferIndex));
    productsArray.push(this.createProduct());
  }

  removeProduct(transferIndex: number, productIndex: number): void {
    const productsArray = this.getProductsArray(this.locationTransfers.at(transferIndex));
    productsArray.removeAt(productIndex);
    this.calculateTotal();
  }

  generateReferenceNumber(): string {
    const today = new Date();
    const dateString = today.getFullYear().toString() +
                      (today.getMonth() + 1).toString().padStart(2, '0') +
                      today.getDate().toString().padStart(2, '0');
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    return `GIN-${dateString}-${randomNum}`;
  }

  loadLocations() {
    this.locationService.getLocations().subscribe(locations => {
      this.locations = locations;
      this.debugLog('Locations loaded:', locations.length);
    });
  }

  loadProducts() {
    this.productsService.getProductsRealTime().subscribe(products => {
      this.products = products;
      this.debugLog('Products loaded:', products.length);
    });
  }

  debugLog(message: string, data?: any) {
    if (this.debugMode) {
      console.log(`[GIN Transfer Debug] ${message}`, data || '');
    }
  }

  getFilteredToLocations(transferIndex: number): any[] {
    const currentFromLocation = this.ginTransferForm.get('locationFrom')?.value;
    return this.locations.filter(location => 
      location.id !== currentFromLocation && 
      !this.isLocationUsedInOtherTransfers(location.id, transferIndex)
    );
  }

  isLocationUsedInOtherTransfers(locationId: string, excludeIndex: number): boolean {
    for (let i = 0; i < this.locationTransfers.length; i++) {
      if (i !== excludeIndex) {
        const transfer = this.locationTransfers.at(i);
        if (transfer.get('locationTo')?.value === locationId) {
          return true;
        }
      }
    }
    return false;
  }

  async searchProducts() {
    this.showSearchResults = true;
    
    const locationFrom = this.ginTransferForm.get('locationFrom')?.value;
    if (!locationFrom) {
      this.filteredProducts = [];
      return;
    }

    this.debugLog('Searching products at location:', this.getLocationName(locationFrom));

    const availableProducts = await this.getProductsWithStockAtLocation(locationFrom);

    if (this.searchTerm.trim() === '') {
      this.filteredProducts = availableProducts.slice(0, 10);
    } else {
      const searchTermLower = this.searchTerm.toLowerCase();
      this.filteredProducts = availableProducts.filter(product => 
        product.productName.toLowerCase().includes(searchTermLower) ||
        (product.sku && product.sku.toLowerCase().includes(searchTermLower)) ||
        (product.barcode && product.barcode.toLowerCase().includes(searchTermLower))
      ).slice(0, 10);
    }

    this.debugLog('Filtered products found:', this.filteredProducts.length);
    this.preloadStockForProducts();
  }

  onSearchInput(event: any): void {
    this.searchTerm = event.target.value;
    this.searchProducts();
  }

  onSearchFocus() {
    this.showSearchResults = true;
  }

  onSearchBlur() {
    setTimeout(() => {
      this.showSearchResults = false;
    }, 200);
  }

  async addProductFromSearch(transferIndex: number, product: any) {
    const transfer = this.locationTransfers.at(transferIndex);
    const productsArray = this.getProductsArray(transfer);
    
    const existingIndex = productsArray.controls.findIndex(
      control => control.get('productId')?.value === product.id
    );
    
    if (existingIndex >= 0) {
      const currentQty = productsArray.at(existingIndex).get('quantity')?.value || 0;
      productsArray.at(existingIndex).get('quantity')?.setValue(currentQty + 1);
      this.calculateSubtotal(transferIndex, existingIndex);
    } else {
      const productDetails = await this.productsService.getProductById(product.id);
      
      const productFormGroup = this.createProduct();
      productFormGroup.patchValue({
        productId: product.id,
        productName: product.productName,
        sku: product.sku,
        barcode: product.barcode || '',
        unitPrice: productDetails?.defaultSellingPriceExcTax || 0,
        quantity: 1,
        unit: product.unit,
        currentStock: await this.getAndCacheStock(product.id)
      });
      
      productsArray.push(productFormGroup);
      this.calculateSubtotal(transferIndex, productsArray.length - 1);
    }
    
    this.clearSearch();
  }

  clearSearch() {
    this.searchTerm = '';
    this.filteredProducts = [];
    this.showSearchResults = false;
  }

  calculateSubtotal(transferIndex: number, productIndex: number): void {
    const productsArray = this.getProductsArray(this.locationTransfers.at(transferIndex));
    const productGroup = productsArray.at(productIndex) as FormGroup;
    
    const quantity = productGroup.get('quantity')?.value || 0;
    const unitPrice = productGroup.get('unitPrice')?.value || 0;
    const subtotal = quantity * unitPrice;

    productGroup.patchValue({ subtotal });
    this.calculateTotal();
  }

  getSubtotal(transferIndex: number, productIndex: number): number {
    const productsArray = this.getProductsArray(this.locationTransfers.at(transferIndex));
    const productGroup = productsArray.at(productIndex) as FormGroup;
    return productGroup.get('subtotal')?.value || 0;
  }

  getTransferSubtotal(transferIndex: number): number {
    const productsArray = this.getProductsArray(this.locationTransfers.at(transferIndex));
    return productsArray.controls.reduce((sum, productGroup) => {
      return sum + (productGroup.get('subtotal')?.value || 0);
    }, 0);
  }

  calculateTotal(): void {
    this.grandTotal = this.locationTransfers.controls.reduce((sum, transfer) => {
      return sum + this.getTransferSubtotal(this.locationTransfers.controls.indexOf(transfer));
    }, 0);
    
    const shippingCharges = parseFloat(this.ginTransferForm.get('shippingCharges')?.value || 0);
    this.grandTotal += shippingCharges;
  }

  async validateStockQuantities(): Promise<boolean> {
    this.stockValidationErrors = {};
    let isValid = true;

    for (let i = 0; i < this.locationTransfers.length; i++) {
      const transfer = this.locationTransfers.at(i);
      const productsArray = this.getProductsArray(transfer);
      const locationFrom = this.ginTransferForm.get('locationFrom')?.value;

      for (let j = 0; j < productsArray.length; j++) {
        const productGroup = productsArray.at(j) as FormGroup;
        const productId = productGroup.get('productId')?.value;
        const requestedQuantity = productGroup.get('quantity')?.value || 0;
        
        if (productId && requestedQuantity > 0) {
          try {
            const currentStock = await this.getCurrentStockAtLocation(productId, locationFrom);
            
            if (requestedQuantity > currentStock) {
              const productName = productGroup.get('productName')?.value || 'Product';
              this.stockValidationErrors[i] = `Insufficient stock for ${productName}. Available: ${currentStock}, Requested: ${requestedQuantity}`;
              isValid = false;
              productGroup.get('quantity')?.setErrors({ insufficientStock: true });
            }
          } catch (error) {
            console.error(`Error validating stock for product ${productId}:`, error);
            this.stockValidationErrors[i] = `Error validating stock for product`;
            isValid = false;
          }
        }
      }
    }
    
    return isValid;
  }

  private async getCurrentStockAtLocation(productId: string, locationId: string): Promise<number> {
    try {
      const stockDocId = `${productId}_${locationId}`;
      const stockDocRef = doc(this.firestore, COLLECTIONS.PRODUCT_STOCK, stockDocId);
      const stockDoc = await getDoc(stockDocRef);
      
      if (stockDoc.exists()) {
        const data = stockDoc.data();
        return data?.['quantity'] || 0;
      }
      
      return 0;
    } catch (error) {
      this.debugLog('Error getting stock at location:', error);
      return 0;
    }
  }

  getStockDisplayText(productId: string): string {
    const locationFrom = this.ginTransferForm.get('locationFrom')?.value;
    if (!locationFrom) return 'Select location first';
    if (!productId) return '0';

    const cacheKey = `${productId}_${locationFrom}`;
    
    if (this.stockDisplayMap.has(cacheKey)) {
      return this.stockDisplayMap.get(cacheKey)?.toString() || '0';
    }

    this.getAndCacheStock(productId);
    return 'Loading...';
  }

  async getAndCacheStock(productId: string): Promise<number> {
    const locationFrom = this.ginTransferForm.get('locationFrom')?.value;
    if (!locationFrom || !productId) return 0;

    const cacheKey = `${productId}_${locationFrom}`;
    
    if (this.stockDisplayMap.has(cacheKey)) {
      return this.stockDisplayMap.get(cacheKey) || 0;
    }

    try {
      const stock = await this.getCurrentStockAtLocation(productId, locationFrom);
      this.stockDisplayMap.set(cacheKey, stock);
      return stock;
    } catch (error) {
      this.debugLog('Error fetching stock:', error);
      this.stockDisplayMap.set(cacheKey, 0);
      return 0;
    }
  }

  onLocationFromChange(): void {
    this.stockDisplayMap.clear();
    if (this.searchTerm || this.showSearchResults) {
      this.searchProducts();
    }
  }

  getLocationName(locationId: string): string {
    if (!locationId) return 'N/A';
    const location = this.locations.find(l => l.id === locationId);
    return location ? location.name : 'Unknown Location';
  }

  async preloadStockForProducts(): Promise<void> {
    const locationFrom = this.ginTransferForm.get('locationFrom')?.value;
    if (!locationFrom || !this.filteredProducts.length) return;

    this.debugLog(`Pre-loading stock for ${this.filteredProducts.length} products at location ${this.getLocationName(locationFrom)}`);
    
    const stockPromises = this.filteredProducts.map(product => 
      this.getAndCacheStock(product.id)
    );
    
    await Promise.all(stockPromises);
    this.debugLog('Stock pre-loading completed');
  }

  private async getProductsWithStockAtLocation(locationId: string): Promise<Product[]> {
    try {
      this.debugLog(`Checking product-stock collection for location: ${locationId}`);
      
      const stockQuery = collection(this.firestore, COLLECTIONS.PRODUCT_STOCK);
      const stockSnapshot = await getDocs(stockQuery);
      
      const productIdsWithStock = new Set<string>();
      stockSnapshot.forEach((doc: any) => {
        const docId = doc.id;
        if (docId.endsWith(`_${locationId}`)) {
          const stockData = doc.data();
          if (stockData['quantity'] && stockData['quantity'] > 0) {
            const productId = docId.replace(`_${locationId}`, '');
            productIdsWithStock.add(productId);
          }
        }
      });
      
      this.debugLog(`Found ${productIdsWithStock.size} products with stock at this location`);
      
      const availableProducts = this.products.filter(product => 
        productIdsWithStock.has(product.id)
      );
      
      this.debugLog(`Filtered to ${availableProducts.length} products that exist in products collection`);
      return availableProducts;
      
    } catch (error) {
      this.debugLog('Error getting products with stock at location:', error);
      return [];
    }
  }

  hasProductsToTransfer(): boolean {
    return this.locationTransfers.controls.some(transfer => {
      const productsArray = this.getProductsArray(transfer);
      return productsArray.length > 0;
    });
  }

  private atLeastOneTransferValidator(): ValidatorFn {
    return (control: AbstractControl): { [key: string]: boolean } | null => {
      const transfersArray = control as FormArray;
      if (!transfersArray || !transfersArray.controls) {
        return { noValidTransfers: true };
      }

      const hasValidTransfers = transfersArray.controls.some(transferGroup => {
        if (!(transferGroup instanceof FormGroup)) return false;
        
        const locationTo = transferGroup.get('locationTo')?.value;
        const products = transferGroup.get('products') as FormArray;
        
        return locationTo && products && products.length > 0;
      });

      return hasValidTransfers ? null : { noValidTransfers: true };
    };
  }

  private atLeastOneProductValidator(): ValidatorFn {
    return (control: AbstractControl): { [key: string]: boolean } | null => {
      const productsArray = control as FormArray;
      if (!productsArray || !productsArray.controls) {
        return { noValidProducts: true };
      }

      const hasValidProducts = productsArray.controls.some(productGroup => {
        if (!(productGroup instanceof FormGroup)) return false;
        
        const productId = productGroup.get('productId')?.value;
        const quantity = productGroup.get('quantity')?.value;
        const unitPrice = productGroup.get('unitPrice')?.value;
        return productId && quantity > 0 && unitPrice > 0;
      });

      return hasValidProducts ? null : { noValidProducts: true };
    };
  }

  async saveGinTransfer() {
    this.debugLog('Save button clicked');
    this.lastError = '';
    
    try {
      this.markAllAsTouched();

      if (!this.ginTransferForm.valid) {
        this.debugLog('Form validation failed', this.getFormErrors());
        this.submitError = 'Please fill in all required fields';
        return;
      }

      const formData = this.ginTransferForm.value;
      this.debugLog('Form data:', formData);

      const hasProducts = this.hasProductsToTransfer();
      this.debugLog('Has products to transfer:', hasProducts);
      
      if (!hasProducts) {
        this.submitError = 'No products to transfer';
        alert('Please add at least one product to the transfer.');
        return;
      }

      const invalidTransfers = this.locationTransfers.controls.filter((transfer, index) => {
        const productsArray = this.getProductsArray(transfer);
        return productsArray.length > 0 && !transfer.get('locationTo')?.value;
      });
      
      if (invalidTransfers.length > 0) {
        this.submitError = 'Invalid transfer destinations';
        alert('Please ensure all transfers have a destination location.');
        return;
      }

      this.isSaving = true;
      this.debugLog('Starting save process...');

      if (formData.status === 'Completed') {
        this.debugLog('Validating stock availability...');
        const stockValid = await this.validateStockQuantities();
        if (!stockValid) {
          this.submitError = 'Some products have insufficient stock. Please check the quantities.';
          this.isSaving = false;
          return;
        }
      }

      const sourceLocation = this.locations.find(l => l.id === formData.locationFrom);
      
      const transfersWithNames: LocationTransfer[] = [];
      
      for (let i = 0; i < this.locationTransfers.length; i++) {
        const transfer = this.locationTransfers.at(i);
        const productsArray = this.getProductsArray(transfer);
        
        if (productsArray.length > 0) {
          const locationTo = transfer.get('locationTo')?.value;
          const locationToName = this.getLocationName(locationTo);
          
          const products: TransferProduct[] = [];
          for (let j = 0; j < productsArray.length; j++) {
            const productGroup = productsArray.at(j) as FormGroup;
            products.push({
              productId: productGroup.get('productId')?.value || '',
              productName: productGroup.get('productName')?.value || '',
              sku: productGroup.get('sku')?.value || '',
              barcode: productGroup.get('barcode')?.value || '',
              quantity: productGroup.get('quantity')?.value || 0,
              unitPrice: productGroup.get('unitPrice')?.value || 0,
              subtotal: productGroup.get('subtotal')?.value || 0,
              unit: productGroup.get('unit')?.value || '',
              currentStock: productGroup.get('currentStock')?.value || 0
            });
          }
          
          transfersWithNames.push({
            locationId: locationTo,
            locationName: locationToName,
            products: products
          });
        }
      }

      const ginTransfer: GinTransfer = {
        date: formData.date || this.currentDate,
        referenceNo: formData.referenceNo || this.generateReferenceNumber(),
        locationFrom: formData.locationFrom || '',
        locationFromName: sourceLocation?.name || 'Unknown Location',
        status: formData.status || 'Draft',
        transfers: transfersWithNames,
        shippingCharges: formData.shippingCharges || 0,
        additionalNotes: formData.additionalNotes || '',
        totalAmount: this.grandTotal,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const sanitizedGinTransfer = this.sanitizeForFirestore(ginTransfer);
      this.debugLog('Prepared GIN transfer data:', sanitizedGinTransfer);

      const docId = await this.ginTransferService.addGinTransfer(sanitizedGinTransfer);
      this.debugLog('GIN Transfer saved with ID:', docId);

      const finalGinTransfer = { ...sanitizedGinTransfer, id: docId };
      
      if (finalGinTransfer.status === 'Completed') {
        await this.stockService.processGinTransfer(finalGinTransfer);
        this.debugLog('Stock movements processed via StockService.');
      } else {
        this.debugLog(`GIN Transfer saved with status: ${finalGinTransfer.status}. Stock movements will be processed when status is set to "Completed".`);
      }
      
      this.resetForm();
      alert('GIN Transfer saved successfully!');
      this.router.navigate(['/gin-transfers']);
      
    } catch (error) {
      this.debugLog('Error saving GIN transfer:', error);
      this.lastError = error instanceof Error ? error.message : 'Unknown error occurred';
      this.submitError = `Error saving GIN transfer: ${this.lastError}`;
      alert(this.submitError);
    } finally {
      this.isSaving = false;
    }
  }

  private markAllAsTouched(): void {
    Object.values(this.ginTransferForm.controls).forEach(control => {
      if (control instanceof FormControl) {
        control.markAsTouched();
      } else if (control instanceof FormArray) {
        control.controls.forEach(group => {
          if (group instanceof FormGroup) {
            Object.values(group.controls).forEach(c => {
              if (c instanceof FormControl) {
                c.markAsTouched();
              } else if (c instanceof FormArray) {
                c.controls.forEach(productGroup => {
                  if (productGroup instanceof FormGroup) {
                    Object.values(productGroup.controls).forEach(pc => pc.markAsTouched());
                  }
                });
              }
            });
          }
        });
      }
    });
  }

  private getFormErrors(): any {
    const errors: any = {};
    Object.keys(this.ginTransferForm.controls).forEach(key => {
      const control = this.ginTransferForm.get(key);
      if (control && control.errors) {
        errors[key] = control.errors;
      }
    });
    return errors;
  }

  private sanitizeForFirestore(obj: any): any {
    if (obj === null || obj === undefined) {
      return null;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeForFirestore(item));
    }
    
    if (typeof obj === 'object' && obj.constructor === Object) {
      const sanitized: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const value = obj[key];
          if (value !== undefined) {
            sanitized[key] = this.sanitizeForFirestore(value);
          }
        }
      }
      return sanitized;
    }
    
    return obj;
  }
// 1. Helper to convert YYYY-MM-DD (internal) to DD-MM-YYYY (display)
getFormattedDateForInput(dateString: any): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

// 2. Trigger the hidden native date picker
openDatePicker(): void {
  this.datePicker.nativeElement.showPicker();
}

// 3. Handle manual typing in DD-MM-YYYY format
onManualDateInput(event: any, controlName: string): void {
  const input = event.target.value.trim();
  const datePattern = /^(\d{2})-(\d{2})-(\d{4})$/;
  const match = input.match(datePattern);
  
  if (match) {
    const day = match[1];
    const month = match[2];
    const year = match[3];
    
    const dateObj = new Date(`${year}-${month}-${day}`);
    if (dateObj && dateObj.getDate() === parseInt(day) && 
        dateObj.getMonth() + 1 === parseInt(month)) {
      
      // Store as YYYY-MM-DD internally so Firestore and the native picker understand it
      const isoDate = `${year}-${month}-${day}`;
      this.ginTransferForm.get(controlName)?.setValue(isoDate);
    } else {
      alert('Invalid date! Please enter a valid date in DD-MM-YYYY format.');
      this.resetVisibleInput(event, controlName);
    }
  } else if (input !== '') {
    alert('Format must be DD-MM-YYYY');
    this.resetVisibleInput(event, controlName);
  }
}

private resetVisibleInput(event: any, controlName: string): void {
  event.target.value = this.getFormattedDateForInput(this.ginTransferForm.get(controlName)?.value);
}

// 4. Update the constructor initialization to use YYYY-MM-DD (compatible with input type="date")
constructor(
  private fb: FormBuilder,
  private productsService: ProductsService,
  private locationService: LocationService,
  private ginTransferService: GinTransferService,
  private stockService: StockService,
  private firestore: Firestore,
  private router: Router
) {
  // Use YYYY-MM-DD for internal reactive form value
  this.currentDate = formatDate(new Date(), 'yyyy-MM-dd', 'en');
  
  this.ginTransferForm = this.fb.group({
    date: [this.currentDate, Validators.required],
    referenceNo: [this.generateReferenceNumber()],
    locationFrom: ['', Validators.required],
    status: ['', Validators.required],
    shippingCharges: [0],
    additionalNotes: [''],
    locationTransfers: this.fb.array([this.createLocationTransfer()], this.atLeastOneTransferValidator())
  });
}
  resetForm() {
    this.ginTransferForm.reset({
      date: this.currentDate,
      referenceNo: this.generateReferenceNumber(),
      locationFrom: '',
      status: '',
      shippingCharges: 0,
      additionalNotes: ''
    });
    
    const transfersArray = this.ginTransferForm.get('locationTransfers') as FormArray;
    transfersArray.clear();
    transfersArray.push(this.createLocationTransfer());
    
    this.searchTerm = '';
    this.showSearchResults = false;
    this.lastError = '';
    this.submitError = null;
    this.stockValidationErrors = {};
    this.grandTotal = 0;
    this.stockDisplayMap.clear();
    this.debugLog('Form reset');
  }
}