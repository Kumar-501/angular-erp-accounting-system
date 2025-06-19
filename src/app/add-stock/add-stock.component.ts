import { Component, OnInit } from '@angular/core';
import { FormGroup, FormBuilder, FormArray, Validators, FormControl, ValidatorFn, AbstractControl } from '@angular/forms';
import { StockService } from '../services/stock.service';
import { Router } from '@angular/router';
import { ProductsService } from '../services/products.service';
import { LocationService } from '../services/location.service';

@Component({
  selector: 'app-add-stock',
  templateUrl: './add-stock.component.html',
  styleUrls: ['./add-stock.component.scss']
})
export class AddStockComponent implements OnInit {
  stockForm: FormGroup;
  grandTotal: number = 0;
  isSubmitting: boolean = false;
  submitError: string | null = null;
  allProducts: any[] = [];
  searchTerm: string = '';
  searchResults: any[] = [];
  showSearchResults: boolean = false;
  private searchTimeout: any;
  allLocations: any[] = []; 
  stockValidationErrors: { [key: number]: string | null } = {};
  i: any;

  constructor(
    private fb: FormBuilder,
    private stockService: StockService,
    private router: Router,
    private productService: ProductsService,
    private locationService: LocationService
  ) {
    this.stockForm = this.fb.group({
      date: ['', Validators.required],
      referenceNo: [{ value: this.generateReferenceNumber(), disabled: true }],
      status: ['pending', Validators.required],
      additionalNotes: [''],
      locationTransfers: this.fb.array([this.createLocationTransfer()], this.atLeastOneTransferValidator())
    });
  }

  ngOnInit(): void {
    this.loadProducts();
    this.loadLocations();
  }

  get locationTransfers(): FormArray {
    return this.stockForm.get('locationTransfers') as FormArray;
  }

  createLocationTransfer(): FormGroup {
    return this.fb.group({
      locationFrom: ['', Validators.required],
      locationTo: ['', Validators.required],
      products: this.fb.array([], this.atLeastOneProductValidator())
    });
  }

  addLocationTransfer(): void {
    this.locationTransfers.push(this.createLocationTransfer());
    this.calculateTotal();
  }

  removeLocationTransfer(index: number): void {
    this.locationTransfers.removeAt(index);
    this.calculateTotal();
  }

  getProductsArray(transfer: AbstractControl): FormArray {
    return transfer.get('products') as FormArray;
  }

  createProduct(): FormGroup {
    return this.fb.group({
      product: ['', Validators.required],
      productName: [''],
      quantity: [1, [Validators.required, Validators.min(1)]],
      unitPrice: [0, [Validators.min(0)]], // Removed Validators.required
      subtotal: [0]
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
  }

  // Search functionality methods
  onSearchInput(event: any): void {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    
    this.searchTimeout = setTimeout(() => {
      this.searchProducts(event);
    }, 300);
  }

  searchProducts(event: any) {
    const searchTerm = event.target.value.toLowerCase().trim();
    this.searchTerm = searchTerm;
    
    if (!searchTerm || searchTerm.length < 2) {
      this.searchResults = [];
      this.showSearchResults = false;
      return;
    }
    
    this.searchResults = this.allProducts.filter(product => {
      const searchString = [
        product.productName,
        product.sku,
      ]
      .filter(field => field)
      .join(' ')
      .toLowerCase();
      
      return searchString.includes(searchTerm);
    });
    
    this.showSearchResults = this.searchResults.length > 0;
  }

  onSearchFocus() {
    this.showSearchResults = true;
  }

  onSearchBlur() {
    setTimeout(() => {
      this.showSearchResults = false;
    }, 200);
  }

  highlightMatch(text: string, searchTerm: string): string {
    if (!text || !searchTerm) return text;
    
    const regex = new RegExp(searchTerm, 'gi');
    return text.replace(regex, match => 
      `<span class="highlight">${match}</span>`
    );
  }

  handleKeyDown(event: KeyboardEvent) {
    if (!this.showSearchResults) return;
    
    const results = document.querySelectorAll('.search-results-dropdown .list-group-item');
    
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const currentIndex = Array.from(results).findIndex(el => el === document.activeElement);
      if (currentIndex < results.length - 1) {
        (results[currentIndex + 1] as HTMLElement)?.focus();
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const currentIndex = Array.from(results).findIndex(el => el === document.activeElement);
      if (currentIndex > 0) {
        (results[currentIndex - 1] as HTMLElement)?.focus();
      } else {
        (event.target as HTMLElement)?.focus();
      }
    } else if (event.key === 'Enter') {
      const activeElement = document.activeElement;
      if (activeElement?.classList.contains('list-group-item')) {
        const index = Array.from(results).findIndex(el => el === activeElement);
        if (index >= 0) {
          this.addProductFromSearch(0, this.searchResults[index]);
        }
      }
    }
  }

  async addProductFromSearch(transferIndex: number, product: any) {
    const transfer = this.locationTransfers.at(transferIndex);
    const productsArray = this.getProductsArray(transfer);
    
    const existingIndex = productsArray.controls.findIndex(
      control => control.get('product')?.value === product.id
    );
    
    if (existingIndex >= 0) {
      const currentQty = productsArray.at(existingIndex).get('quantity')?.value || 0;
      productsArray.at(existingIndex).get('quantity')?.setValue(currentQty + 1);
      this.calculateSubtotal(transferIndex, existingIndex);
    } else {
      // Get the product details including the price
      const productDetails = await this.productService.getProductById(product.id);
      
      const productFormGroup = this.createProduct();
      productFormGroup.patchValue({
        product: product.id,
        productName: product.productName,
        unitPrice: productDetails?.defaultPurchasePriceIncTax || 
                  productDetails?.defaultPurchasePriceExcTax || 
                  productDetails?.unitPurchasePrice || 
                  0, // Default to 0 if no price found
        quantity: 1
      });
      
      productsArray.push(productFormGroup);
      this.calculateSubtotal(transferIndex, productsArray.length - 1);
    }
    
    this.clearSearch();
  }

  clearSearch() {
    this.searchTerm = '';
    this.searchResults = [];
    this.showSearchResults = false;
  }

  getFilteredFromLocations(transferIndex: number): any[] {
    const currentToLocation = this.locationTransfers.at(transferIndex).get('locationTo')?.value;
    return this.allLocations.filter(location => 
      location.id !== currentToLocation && 
      !this.isLocationUsedInOtherTransfers(location.id, 'locationTo', transferIndex)
    );
  }

  getFilteredToLocations(transferIndex: number): any[] {
    const currentFromLocation = this.locationTransfers.at(transferIndex).get('locationFrom')?.value;
    return this.allLocations.filter(location => 
      location.id !== currentFromLocation && 
      !this.isLocationUsedInOtherTransfers(location.id, 'locationFrom', transferIndex)
    );
  }

  isLocationUsedInOtherTransfers(locationId: string, field: 'locationFrom' | 'locationTo', excludeIndex: number): boolean {
    for (let i = 0; i < this.locationTransfers.length; i++) {
      if (i !== excludeIndex) {
        const transfer = this.locationTransfers.at(i);
        if (transfer.get(field)?.value === locationId) {
          return true;
        }
      }
    }
    return false;
  }

  loadLocations(): void {
    this.locationService.getLocations().subscribe({
      next: (locations: any[]) => {
        this.allLocations = locations.filter(location => location.active);
      },
      error: (error) => {
        console.error('Error loading locations:', error);
      }
    });
  }

  loadProducts(): void {
    this.productService.getProductsRealTime().subscribe({
      next: (products: any[]) => {
        this.allProducts = products;
      },
      error: (error) => {
        console.error('Error loading products:', error);
      }
    });
  }

  generateReferenceNumber(): string {
    const date = new Date();
    const year = date.getFullYear().toString().substr(-2);
    const month = ('0' + (date.getMonth() + 1)).slice(-2);
    const day = ('0' + date.getDate()).slice(-2);
    const random = Math.floor(Math.random() * 9000) + 1000;
    
    return `REF-${year}${month}${day}-${random}`;
  }

  private atLeastOneTransferValidator(): ValidatorFn {
    return (control: AbstractControl): { [key: string]: boolean } | null => {
      const transfersArray = control as FormArray;
      if (!transfersArray || !transfersArray.controls) {
        return { noValidTransfers: true };
      }

      const hasValidTransfers = transfersArray.controls.some(transferGroup => {
        if (!(transferGroup instanceof FormGroup)) return false;
        
        const locationFrom = transferGroup.get('locationFrom')?.value;
        const locationTo = transferGroup.get('locationTo')?.value;
        const products = transferGroup.get('products') as FormArray;
        
        return locationFrom && locationTo && products && products.valid;
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
        
        const product = productGroup.get('product')?.value;
        const quantity = productGroup.get('quantity')?.value;
        // Removed unitPrice check
        return product && quantity > 0;
      });

      return hasValidProducts ? null : { noValidProducts: true };
    };
  }

  async validateStockQuantities(): Promise<boolean> {
    this.stockValidationErrors = {};
    let isValid = true;

    for (let i = 0; i < this.locationTransfers.length; i++) {
      const transfer = this.locationTransfers.at(i);
      const productsArray = this.getProductsArray(transfer);
      const locationFrom = transfer.get('locationFrom')?.value;

      for (let j = 0; j < productsArray.length; j++) {
        const productGroup = productsArray.at(j) as FormGroup;
        const productId = productGroup.get('product')?.value;
        const requestedQuantity = productGroup.get('quantity')?.value || 0;
        
        if (productId && requestedQuantity > 0) {
          try {
            const product = await this.productService.getProductById(productId);
            
            if (product) {
              const currentStock = product.currentStock || 0;
              
              if (requestedQuantity > currentStock) {
                const productName = product.productName || 'Product';
                this.stockValidationErrors[i] = `Insufficient stock for ${productName}. Available: ${currentStock}, Requested: ${requestedQuantity}`;
                isValid = false;
                // Highlight the problematic row
                productGroup.get('quantity')?.setErrors({ insufficientStock: true });
              }
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

  async onSubmit(): Promise<void> {
    // Mark all form controls as touched to trigger validation messages
    this.markAllAsTouched();

    if (this.stockForm.invalid) {
      this.submitError = 'Please fill all required fields correctly.';
      return;
    }

    // Validate stock quantities before submitting
    const isStockValid = await this.validateStockQuantities();
    if (!isStockValid) {
      this.submitError = 'Some products have insufficient stock. Please check the quantities.';
      return;
    }

    this.isSubmitting = true;
    this.submitError = null;

    try {
      // Prepare the form data
      const formValue = this.stockForm.getRawValue();
      
      // Format the data for the service
      const transfersData = {
        date: new Date(formValue.date).toISOString(),
        referenceNo: formValue.referenceNo,
        status: formValue.status,
        additionalNotes: formValue.additionalNotes,
        locationTransfers: formValue.locationTransfers.map((transfer: any, index: number) => ({
          locationFrom: transfer.locationFrom,
          locationTo: transfer.locationTo,
          products: transfer.products.map((product: any) => ({
            product: product.product,
            productName: product.productName,
            quantity: product.quantity,
            unitPrice: product.unitPrice,
            subtotal: product.quantity * product.unitPrice
          })),
          subtotal: this.getTransferSubtotal(index),
          totalAmount: this.getTransferSubtotal(index)
        })),
        grandTotal: this.grandTotal,
        createdAt: new Date().toISOString()
      };

      // Call the service to add stock
      await this.stockService.addStock(transfersData);
      
      // Navigate to list page after successful submission
      this.router.navigate(['/list-stock']);
    } catch (error) {
      console.error('Error adding stock:', error);
      this.submitError = 'Failed to save stock transfer. Please try again.';
      if (error instanceof Error) {
        this.submitError += ` Error: ${error.message}`;
      }
    } finally {
      this.isSubmitting = false;
    }
  }

  private markAllAsTouched(): void {
    Object.values(this.stockForm.controls).forEach(control => {
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

  getProductCurrentStock(productId: string): number {
    if (!productId) return 0;
    
    const selectedProduct = this.allProducts.find(p => p.id === productId);
    return selectedProduct ? (selectedProduct.currentStock || 0) : 0;
  }
}