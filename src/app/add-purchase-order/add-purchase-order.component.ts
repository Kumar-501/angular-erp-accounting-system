import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators, AbstractControl } from '@angular/forms';
import { Router } from '@angular/router';
import { PurchaseOrderService } from '../services/purchase-order.service';
import { SupplierService } from '../services/supplier.service';
import { LocationService } from '../services/location.service';
import { ProductsService } from '../services/products.service';
import { UserService } from '../services/user.service';
import { TaxRate } from '../tax/tax.model';
import { TaxService } from '../services/tax.service';


interface Supplier {
  id?: string;
  contactId?: string;
  businessName?: string;
  firstName?: string;
  lastName?: string;
  isIndividual?: boolean;
  address: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  zipCode?: string; // Add this line
}
interface Product {
  id?: string;
  productName: string;
  sku?: string;
  unitPurchasePrice: number | null;
  unitSellingPrice: number | null;
  defaultPurchasePrice?: number;
  defaultPurchasePriceExcTax?: number | null;
  defaultPurchasePriceIncTax?: number | null;
  currentStock?: number;
  totalQuantity?: number; // Add this line
  stockByLocation?: { [locationId: string]: number }; // Add this line if using location-based stock
  taxPercentage?: number;
  defaultSellingPriceIncTax?: number;
  barcode?: string;
  productDescription?: string;
  defaultSellingPriceExcTax?: number;
}

@Component({
  selector: 'app-add-purchase-order',
  templateUrl: './add-purchase-order.component.html',
  styleUrls: ['./add-purchase-order.component.scss']
})
export class AddPurchaseOrderComponent implements OnInit {
  [x: string]: any;
  purchaseOrderForm!: FormGroup;
  suppliers: Supplier[] = [];
  businessLocations: any[] = [];
  productsList: Product[] = [];
  lastEditedShippingField: 'before' | 'after' = 'before';
  productFormGroup!: FormGroup; // Direct property declaration

  filteredProducts: Product[] = [];
  searchResults: Product[] = []; // Added for search results
  showSearchResults: boolean = false; // Control visibility of search results
  searchTerm: string = ''; // Track search term
  totalItems: number = 0;
  taxRates: TaxRate[] = []; // Replace any existing taxRates declaration

  supplierSearchTerm: string = '';
showSupplierDropdown: boolean = false;
filteredSuppliers: Supplier[] = [];
  discountTypes: ('percent' | 'amount')[] = [];
  netTotalAmount: number = 0;
  users: any[] = [];
  selectedSupplierDetails: any = null;
  private searchTimeout: any; // or more specifically: private searchTimeout: ReturnType<typeof setTimeout> | null = null;

  selectedProductIndex: number = -1;

  constructor(
    private fb: FormBuilder,
    private orderService: PurchaseOrderService,
    private supplierService: SupplierService,
    private locationService: LocationService,
    private productsService: ProductsService,
    private router: Router,
    private userService: UserService,
        private taxService: TaxService // Add this line

  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadSuppliers();
    this.loadBusinessLocations();
    this.loadProducts();
    this.generateReferenceNumber();
    this.loadUsers();
      this.loadTaxRates(); // Add this line

      this.filteredSuppliers = [...this.suppliers];

    
  }
initForm(): void {
  this.purchaseOrderForm = this.fb.group({
    supplier: ['', Validators.required],
    address: [''],
    referenceNo: [{ value: '', disabled: true }, Validators.required],
    orderDate: [new Date().toISOString().split('T')[0], Validators.required],
    deliveryDate: [''],
    shippingDate: [''],
    purchaseOrder: [''],
    requiredDate: [''],
    addedBy: [''],
    businessLocation: ['', Validators.required],
    payTerm: [''],
    products: this.fb.array([]), // Empty array by default
    shippingDetails: this.fb.group({
      shippingDetails: [''],
      shippingAddress: [''],
      shippingChargesBeforeTax: [0, [Validators.min(0)]],
      shippingTaxPercent: [18, [Validators.min(0), Validators.max(100)]],
      shippingTaxAmount: [0],
      shippingChargesAfterTax: [0],
      shippingStatus: [''],
      deliveredTo: [''],
      shippingDocuments: [null]
    }),
    attachDocument: [null],
    additionalNotes: ['']
  });

  this.calculateShippingTax();
}



  loadProducts(): void {
    this.productsService.getProductsRealTime().subscribe({
      next: (products: any[]) => {
        this.productsList = products.map(product => ({
          ...product,
          defaultPurchasePrice: product.purchasePrice || product.sellingPrice || 100,
          currentStock: product.currentStock || 0
        }));
        this.filteredProducts = [...this.productsList];
      },
      error: (err) => {
        console.error('Error loading products:', err);
      }
    });
  }

  loadUsers(): void {
    this.userService.getUsers().subscribe(users => {
      this.users = users;
    });
  }
calculateShippingTax(calculationType: 'before' | 'after' | 'both' = 'both'): void {
  const shippingDetails = this.purchaseOrderForm.get('shippingDetails') as FormGroup;
  
  // Get current values
  const beforeTaxCtrl = shippingDetails.get('shippingChargesBeforeTax');
  const afterTaxCtrl = shippingDetails.get('shippingChargesAfterTax');
  const taxPercentCtrl = shippingDetails.get('shippingTaxPercent');
  const taxAmountCtrl = shippingDetails.get('shippingTaxAmount');
  
  const taxPercent = parseFloat(taxPercentCtrl?.value) || 0;
  
  if (calculationType === 'before') {
    // Calculate from before tax amount
    const beforeTax = parseFloat(beforeTaxCtrl?.value) || 0;
    const taxAmount = beforeTax * (taxPercent / 100);
    const afterTax = beforeTax + taxAmount;
    
    afterTaxCtrl?.setValue(afterTax.toFixed(2), { emitEvent: false });
    taxAmountCtrl?.setValue(taxAmount.toFixed(2), { emitEvent: false });
  } 
  else if (calculationType === 'after') {
    // Calculate from after tax amount
    const afterTax = parseFloat(afterTaxCtrl?.value) || 0;
    
    if (taxPercent > 0) {
      const beforeTax = afterTax / (1 + (taxPercent / 100));
      const taxAmount = afterTax - beforeTax;
      
      beforeTaxCtrl?.setValue(beforeTax.toFixed(2), { emitEvent: false });
      taxAmountCtrl?.setValue(taxAmount.toFixed(2), { emitEvent: false });
    } else {
      beforeTaxCtrl?.setValue(afterTax.toFixed(2), { emitEvent: false });
      taxAmountCtrl?.setValue(0, { emitEvent: false });
    }
  }
    
  else if (calculationType === 'both') {
    // When tax percentage changes, calculate based on which field was last edited
    const lastEdited = this.lastEditedShippingField;
    
    if (lastEdited === 'after') {
      this.calculateShippingTax('after');
    } else {
      this.calculateShippingTax('before');
    }
  }
  
  this.updateTotals();
}

loadTaxRates(): void {
  this.taxService.getTaxRates().subscribe(rates => {
    this.taxRates = rates;
    // Sort by rate if needed
    this.taxRates.sort((a, b) => a.rate - b.rate);
  });
}
  loadBusinessLocations(): void {
    this.locationService.getLocations().subscribe(
      (locations) => {
        this.businessLocations = locations;
      },
      (error) => {
        console.error('Error loading business locations:', error);
      }
    );
  }
  // Add these methods to your component class
filterSuppliers(): void {
  if (!this.supplierSearchTerm) {
    this.filteredSuppliers = [...this.suppliers];
    return;
  }

  const searchTerm = this.supplierSearchTerm.toLowerCase();
  this.filteredSuppliers = this.suppliers.filter(supplier => {
    const name = this.getSupplierDisplayName(supplier).toLowerCase();
    const businessName = supplier.businessName?.toLowerCase() || '';
    return name.includes(searchTerm) || 
           businessName.includes(searchTerm);
  });
}
selectSupplier(supplier: Supplier): void {
  this.purchaseOrderForm.get('supplier')?.setValue(supplier.id);
  this.supplierSearchTerm = this.getSupplierDisplayName(supplier);
  this.showSupplierDropdown = false;
  
  // Build the shipping address string
  const addressParts = [
    supplier.address,
    supplier.addressLine1,
    supplier.addressLine2,
    supplier.city,
    supplier.state,
    'postalCode' in supplier ? supplier.postalCode : supplier.zipCode,
    supplier.country
  ].filter(part => !!part);
  
  const fullAddress = addressParts.join(', ');
  
  // Update the shipping address field
  this.purchaseOrderForm.patchValue({
    shippingDetails: {
      shippingAddress: `${this.getSupplierDisplayName(supplier)}\n${fullAddress}`
    }
  });
  
  this.onSupplierChange(); // Call your existing method
  }
  copySupplierAddress(): void {
  if (this.selectedSupplierDetails) {
    const addressParts = [
      this.selectedSupplierDetails.address,
      this.selectedSupplierDetails.addressLine1,
      this.selectedSupplierDetails.addressLine2,
      this.selectedSupplierDetails.city,
      this.selectedSupplierDetails.state,
      'postalCode' in this.selectedSupplierDetails ? 
        this.selectedSupplierDetails.postalCode : 
        this.selectedSupplierDetails.zipCode,
      this.selectedSupplierDetails.country
    ].filter(part => !!part);
    
    const fullAddress = addressParts.join(', ');
    
    this.purchaseOrderForm.patchValue({
      shippingDetails: {
        shippingAddress: `${this.getSupplierDisplayName(this.selectedSupplierDetails)}\n${fullAddress}`
      }
    });
  } else {
    alert('Please select a supplier first');
  }
}
  onSupplierBlur(): void {
  setTimeout(() => {
    this.showSupplierDropdown = false;
    
    // If the selected supplier doesn't match the search term, clear it
    const selectedSupplierId = this.purchaseOrderForm.get('supplier')?.value;
    if (selectedSupplierId) {
      const selectedSupplier = this.suppliers.find(s => s.id === selectedSupplierId);
      if (selectedSupplier && 
          !this.getSupplierDisplayName(selectedSupplier).toLowerCase().includes(this.supplierSearchTerm.toLowerCase())) {
        this.purchaseOrderForm.get('supplier')?.setValue('');
        this.supplierSearchTerm = '';
      }
    }
  }, 200);
}


generateReferenceNumber(): void {
  // Generate a 6-digit random number between 100000 and 999999 with "PR" prefix
  const refNumber = 'PR' + Math.floor(100000 + Math.random() * 900000).toString();
  this.purchaseOrderForm.get('referenceNo')?.setValue(refNumber);
} 

loadSuppliers(): void {
    this.supplierService.getSuppliers().subscribe((suppliers: Supplier[]) => {
      this.suppliers = suppliers;
    });
  }

  getSupplierDisplayName(supplier: Supplier): string {
    if (supplier.isIndividual) {
      return `${supplier.firstName || ''} ${supplier.lastName || ''}`.trim();
    }
    return supplier.businessName || '';
  }

onSupplierChange(): void {
  const supplierId = this.purchaseOrderForm.get('supplier')?.value;
  if (supplierId) {
    this.supplierService.getSupplierById(supplierId).subscribe({
      next: (supplier: Supplier | undefined) => {
        if (supplier) {
          this.selectedSupplierDetails = supplier;
          this.supplierSearchTerm = this.getSupplierDisplayName(supplier);
          
          // Build address string
          const addressParts = [
            supplier.address,
            supplier.addressLine1,
            supplier.addressLine2,
            supplier.city,
            supplier.state,
            'postalCode' in supplier ? supplier.postalCode : supplier.zipCode,
            supplier.country
          ].filter(part => !!part);
          
          const fullAddress = addressParts.join(', ');
          
          // Update both address and shipping address fields
          this.purchaseOrderForm.patchValue({
            address: fullAddress,
            shippingDetails: {
              shippingAddress: `${this.getSupplierDisplayName(supplier)}\n${fullAddress}`
            }
          });
        }
      },
      error: (err) => {
        console.error('Error loading supplier:', err);
      }
    });
  }
}

  get productsFormArray() {
    return this.purchaseOrderForm.get('products') as FormArray;
  }
addEmptyProduct() {
  this.productsFormArray.push(
    this.fb.group({
      productId: ['', Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]],
      unitCost: [0, [Validators.required, Validators.min(0)]],
      discountType: ['percent'], // Default to percentage
      discountPercent: [0, [Validators.min(0), Validators.max(100)]],
      discountAmount: [0, [Validators.min(0)]], // Fixed amount discount
      unitCostBeforeTax: [0],
      subtotalBeforeTax: [0],
      taxPercent: [0, [Validators.min(0), Validators.max(100)]],
      taxAmount: [0],
      netCost: [0],
      lineTotal: [0],
      selected: [false]
    })
  );
}
removeProduct(index: number) {
  this.discountTypes.splice(index, 1);
  this.productsFormArray.removeAt(index);
  this.updateTotals();
}
  get orderItemsFormArray() {
    return this.purchaseOrderForm.get('orderItems') as FormArray;
  }

// Update the onProductSelect method
async onProductSelect(index: number) {
  const productFormGroup = this.productsFormArray.at(index);
  const productId = productFormGroup.get('productId')?.value;
  
  if (productId) {
    try {
      const product = await this.productsService.getProductById(productId);
      if (product) {
        const unitPurchasePrice = product.unitPurchasePrice || 
                                product.defaultPurchasePriceExcTax || 
                                0;
        
        const sellingPrice = product.defaultSellingPriceIncTax || 
                           product.unitSellingPrice || 
                           0;

        // Get the correct stock value - prioritize currentStock, fall back to totalQuantity
        const currentStock = product.currentStock || product.totalQuantity || 0;

        productFormGroup.patchValue({
          productName: product.productName,
          unitCost: unitPurchasePrice,
          sellingPrice: sellingPrice,
          unitPurchasePrice: unitPurchasePrice,
          currentStock: currentStock, // This will now show the correct stock
          taxPercent: product.taxPercentage || 0,
          unitCostBeforeTax: product.defaultPurchasePriceExcTax || unitPurchasePrice,
          marginPercentage: product.marginPercentage || 0
        });
        
        this.calculateLineTotal(index);
      }
    } catch (error) {
      console.error('Error loading product details:', error);
    }
  }
}
calculateOverallTotals(): void {
  let totalBeforeTax = 0;
  let totalTax = 0;
  let totalNet = 0;

  this.productsFormArray.controls.forEach((control: AbstractControl) => {
    const formGroup = control as FormGroup;
    totalBeforeTax += formGroup.get('subtotalBeforeTax')?.value || 0;
    totalTax += ((formGroup.get('taxPercent')?.value || 0) / 100) * (formGroup.get('unitCostBeforeTax')?.value || 0) * (formGroup.get('quantity')?.value || 0);
    totalNet += formGroup.get('netCost')?.value || 0;
  });

  // Example: update total fields in form
  this.purchaseOrderForm.get('totalBeforeTax')?.setValue(totalBeforeTax);
  this.purchaseOrderForm.get('totalTax')?.setValue(totalTax);
  this.purchaseOrderForm.get('totalNet')?.setValue(totalNet);
}
getTaxName(rate: number): string {
  const tax = this.taxRates.find(t => t.rate === rate);
  return tax ? tax.name : 'No Tax';
}

calculateLineTotal(index: number): void {
  const productFormGroup = this.productsFormArray.at(index) as FormGroup;
  
  const quantity = productFormGroup.get('quantity')?.value || 0;
  const unitCost = productFormGroup.get('unitCost')?.value || 0;
  const discountType = productFormGroup.get('discountType')?.value;
  let discountPercent = productFormGroup.get('discountPercent')?.value || 0;
  let discountAmount = productFormGroup.get('discountAmount')?.value || 0;
  const taxPercent = productFormGroup.get('taxPercent')?.value || 0;
  
  // Calculate discount based on type
  if (discountType === 'percent') {
    discountAmount = (unitCost * discountPercent) / 100;
    productFormGroup.get('discountAmount')?.setValue(discountAmount.toFixed(2), { emitEvent: false });
  } else {
    discountPercent = (discountAmount / unitCost) * 100;
    productFormGroup.get('discountPercent')?.setValue(discountPercent.toFixed(2), { emitEvent: false });
  }

  // Ensure discount doesn't exceed price
  discountAmount = Math.min(discountAmount, unitCost);
  const unitCostBeforeTax = unitCost - discountAmount;
  const taxAmountPerUnit = (unitCostBeforeTax * taxPercent) / 100;
  const netCostPerUnit = unitCostBeforeTax + taxAmountPerUnit;
  const lineTotal = netCostPerUnit * quantity;

  productFormGroup.patchValue({
    unitCostBeforeTax: unitCostBeforeTax.toFixed(2),
    subtotalBeforeTax: (unitCostBeforeTax * quantity).toFixed(2),
    taxAmount: (taxAmountPerUnit * quantity).toFixed(2),
    netCost: netCostPerUnit.toFixed(2),
    lineTotal: lineTotal.toFixed(2)
  }, { emitEvent: false });
  
  this.updateTotals();
}
  calculateSellingPrice(index: number) {
    const productFormGroup = this.productsFormArray.at(index);
    const unitCostBeforeTax = parseFloat(productFormGroup.get('unitCostBeforeTax')?.value) || 0;
    const profitMargin = parseFloat(productFormGroup.get('profitMargin')?.value) || 0;

    const profitAmount = (unitCostBeforeTax * profitMargin) / 100;
    const sellingPrice = unitCostBeforeTax + profitAmount;
    
    productFormGroup.get('sellingPrice')?.setValue(sellingPrice.toFixed(2));
  }

updateTotals() {
  this.totalItems = this.productsFormArray.controls.reduce((total, control) => {
    return total + (parseInt(control.get('quantity')?.value) || 0);
  }, 0);
  
  // Calculate products total
  const productsTotal = this.productsFormArray.controls.reduce((total, control) => {
    return total + (parseFloat(control.get('lineTotal')?.value) || 0);
  }, 0);
  
  // Get shipping charges after tax
  const shippingTotal = parseFloat(this.purchaseOrderForm.get('shippingDetails.shippingChargesAfterTax')?.value) || 0;
  
  this.netTotalAmount = productsTotal + shippingTotal;
}

  onFileChange(event: any, fieldName: string) {
    const file = event.target.files[0];
    if (file && file.size <= 5 * 1024 * 1024) {
      const allowedExtensions = ['.pdf', '.csv', '.zip', '.doc', '.docx', '.jpeg', '.jpg', '.png'];
      const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
      
      if (allowedExtensions.includes(fileExtension)) {
        if (fieldName === 'shippingDocuments') {
          this.purchaseOrderForm.get('shippingDetails')?.get('shippingDocuments')?.setValue(file);
        } else {
          this.purchaseOrderForm.get(fieldName)?.setValue(file);
        }
      } else {
        alert('Invalid file type!');
      }
    } else {
      alert('File size exceeds 5MB!');
    }
  }

// Update the searchProducts function in your component
searchProducts(event: any) {
  const searchTerm = event.target.value.toLowerCase().trim();
  this.searchTerm = searchTerm;
  
  if (!searchTerm || searchTerm.length < 2) {
    this.searchResults = [];
    this.showSearchResults = false;
    return;
  }
  
  this.searchResults = this.productsList.filter(product => {
    // Create a search string containing all relevant fields
    const searchString = [
      product.productName,
      product.sku,
    ]
    .filter(field => field) // Remove null/undefined
    .join(' ') // Combine into one string
    .toLowerCase();
    
    return searchString.includes(searchTerm);
  });
  
  this.showSearchResults = this.searchResults.length > 0;
}

onSearchFocus() {
  this.showSearchResults = true;
  // You might want to trigger an initial search here if needed
}

onSearchInput(event: any): void {
  // Clear the previous timeout
  if (this.searchTimeout) {
    clearTimeout(this.searchTimeout);
  }
  
  // Set a new timeout to avoid excessive filtering
  this.searchTimeout = setTimeout(() => {
    this.searchProducts(event);
  }, 300); // 300ms debounce time
}

onSearchBlur() {
  // Add a small delay to allow click events to process
  setTimeout(() => {
    this.showSearchResults = false;
  }, 200);
}

// Add debounce to prevent excessive searching
private debounceTimer: any;
debounceSearch(searchTerm: string) {
  clearTimeout(this.debounceTimer);
  this.debounceTimer = setTimeout(() => {
    this.performSearch(searchTerm);
  }, 300);
}

performSearch(searchTerm: string) {
  this.searchResults = this.productsList.filter(product => {
    if (!product) return false;
    
    // Check in multiple fields with exact matches first
    const exactMatch = 
      product.productName?.toLowerCase() === searchTerm ||
      product.sku?.toLowerCase() === searchTerm ||
      product.barcode?.toLowerCase() === searchTerm;
    
    if (exactMatch) return true;
    
    // Then check for partial matches
    return (
      product.productName?.toLowerCase().includes(searchTerm) ||
      product.sku?.toLowerCase().includes(searchTerm) ||
      product.barcode?.toLowerCase().includes(searchTerm) ||
      (product.productDescription?.toLowerCase().includes(searchTerm))
    );
  }).slice(0, 50); // Limit results for performance
  
  this.showSearchResults = true;
}

// Highlight matching text in results
highlightMatch(text: string, searchTerm: string): string {
  if (!text || !searchTerm) return text;
  
  const regex = new RegExp(searchTerm, 'gi');
  return text.replace(regex, match => 
    `<span class="highlight">${match}</span>`
  );
}

// Add keyboard navigation
// Keyboard navigation
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
        this.addProductFromSearch(this.searchResults[index]);
      }
    }
  }
}

addProductFromSearch(product: Product) {
  const existingIndex = this.productsFormArray.controls.findIndex(
    control => control.get('productId')?.value === product.id
  );
  
  const unitCost = product.defaultPurchasePriceIncTax || 
                 product.defaultPurchasePriceExcTax || 
                 product.unitPurchasePrice || 
                 0;

  const sellingPrice = product.defaultSellingPriceIncTax || 
                     product.unitSellingPrice || 
                     0;

  // Get the correct stock value
  const currentStock = product.currentStock || product.totalQuantity || 0;

  if (existingIndex >= 0) {
    const currentQty = this.productsFormArray.at(existingIndex).get('quantity')?.value || 0;
    this.productsFormArray.at(existingIndex).get('quantity')?.setValue(currentQty + 1);
    this.productsFormArray.at(existingIndex).get('currentStock')?.setValue(currentStock); // Update stock
    this.calculateLineTotal(existingIndex);
  } else {
    const productFormGroup = this.fb.group({
      productId: [product.id, Validators.required],
      productName: [product.productName],
      quantity: [1, [Validators.required, Validators.min(1)]],
      unitCost: [unitCost, [Validators.required, Validators.min(0)]],
      sellingPrice: [sellingPrice],
      currentStock: [currentStock], // Set correct stock value
      discountType: ['percent'],
      discountPercent: [0, [Validators.min(0), Validators.max(100)]],
      discountAmount: [0, [Validators.min(0)]],
      unitCostBeforeTax: [product.defaultPurchasePriceExcTax || unitCost],
      subtotalBeforeTax: [unitCost],
      taxPercent: [product.taxPercentage || 0, [Validators.min(0), Validators.max(100)]],
      taxAmount: [0],
      netCost: [unitCost],
      lineTotal: [unitCost],
      selected: [false]
    });
    
    this.productsFormArray.push(productFormGroup);
    this.calculateLineTotal(this.productsFormArray.length - 1);
  }
  
  this.updateTotals();
  this.clearSearch();
}

clearSearch() {
  this.searchTerm = '';
  this.searchResults = [];
  this.showSearchResults = false;
}

hideSearchResults() {
  setTimeout(() => {
    this.showSearchResults = false;
  }, 200);
}

  selectAllProducts(event: any) {
    const isChecked = event.target.checked;
    this.productsFormArray.controls.forEach(control => {
      control.get('selected')?.setValue(isChecked);
    });
  }
onDiscountTypeChange(index: number) {
  const productFormGroup = this.productsFormArray.at(index) as FormGroup;
  // Reset discount values when switching type
  productFormGroup.get('discountPercent')?.setValue(0);
  productFormGroup.get('discountAmount')?.setValue(0);
  this.calculateLineTotal(index);
}
getDiscountMax(index: number): number {
  const productFormGroup = this.productsFormArray.at(index) as FormGroup;
  const discountType = productFormGroup.get('discountType')?.value;
  const unitCost = productFormGroup.get('unitCost')?.value || 0;
  
  if (discountType === 'percentage') {
    return 100; // Max 100% discount
  } else if (discountType === 'fixed') {
    return unitCost; // Max discount cannot exceed unit cost
  }
  return 0;
}

getDiscountStep(index: number): string {
  const productFormGroup = this.productsFormArray.at(index) as FormGroup;
  const discountType = productFormGroup.get('discountType')?.value;
  
  if (discountType === 'percentage') {
    return '1'; // Step by 1% for percentage
  } else if (discountType === 'fixed') {
    return '0.01'; // Step by 0.01 for fixed amount
  }
  return '1';
}

getDiscountPlaceholder(index: number): string {
  const productFormGroup = this.productsFormArray.at(index) as FormGroup;
  const discountType = productFormGroup.get('discountType')?.value;
  
  switch (discountType) {
    case 'percentage':
      return 'Enter %';
    case 'fixed':
      return 'Enter ₹';
    case 'none':
    default:
      return 'No discount';
  }
}
  toggleProductSelection(index: number) {
    const control = this.productsFormArray.at(index);
    const currentValue = control.get('selected')?.value || false;
    control.get('selected')?.setValue(!currentValue);
  }

  deleteSelectedProducts() {
    if (confirm('Are you sure you want to delete selected products?')) {
      for (let i = this.productsFormArray.length - 1; i >= 0; i--) {
        if (this.productsFormArray.at(i).get('selected')?.value) {
          this.productsFormArray.removeAt(i);
        }
      }
      this.updateTotals();
    }
  }
createProductFormGroup(): FormGroup {
  return this.fb.group({
    selected: [false],
    productId: ['', Validators.required],
    quantity: [1, [Validators.required, Validators.min(1)]],
    unitCost: [0, [Validators.required, Validators.min(0)]],
    unitPurchasePrice: [{ value: 0, disabled: true }],
    discountType: ['none'], // New field
    discountValue: [0], // Renamed from discountPercent
    unitCostBeforeTax: [{ value: 0, disabled: true }],
    subtotalBeforeTax: [{ value: 0, disabled: true }],
    taxPercent: [0, [Validators.min(0), Validators.max(100)]],
    netCost: [{ value: 0, disabled: true }]
  });
}
  addAdditionalExpenses() {
    alert('This feature will be implemented soon!');
  }

async saveOrder() {
  if (this.purchaseOrderForm.invalid) {
    this.markFormGroupTouched(this.purchaseOrderForm);
    alert('Please fill all required fields correctly.');
    return;
  }

  if (this.productsFormArray.length === 0) {
    alert('Please add at least one product.');
    return;
  }

  try {
    this.purchaseOrderForm.get('referenceNo')?.enable();
    const formData = this.purchaseOrderForm.value;
    
    // Format products data correctly
    formData.items = formData.products.map((product: any) => {
      const foundProduct = this.productsList.find(p => p.id === product.productId);
      return {
        productId: product.productId,
        productName: foundProduct?.productName || 'Unknown Product',
        quantity: product.quantity,
        requiredQuantity: product.quantity, // Add requiredQuantity
        unitCost: product.unitCost,
        unitPurchasePrice: product.unitCost, // Add unitPurchasePrice
        unitCostBeforeTax: product.unitCostBeforeTax,
        subtotalBeforeTax: product.subtotalBeforeTax,
        taxPercent: product.taxPercent,
        taxAmount: product.taxAmount,
        netCost: product.netCost,
        lineTotal: product.lineTotal,
        currentStock: foundProduct?.currentStock || 0 // Add current stock
      };
    });

    // Remove the original products array to avoid confusion
    delete formData.products;

    // Add metadata
    formData.createdAt = new Date().toISOString();
    formData.date = formData.orderDate;
    formData.status = 'pending';
    formData.supplierName = this.getSupplierDisplayName(this.selectedSupplierDetails);
    formData.locationName = formData.businessLocation;
    
    // Calculate totals
    formData.totalItems = this.totalItems;
    formData.netTotalAmount = this.netTotalAmount;

    // Save to Firestore
    await this.orderService.addOrder(formData);
    
    alert('Purchase Order Saved Successfully!');
    this.router.navigate(['/purchase-order']);
  } catch (error) {
    console.error('Detailed error:', error);
    alert(`Error saving purchase order: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    this.purchaseOrderForm.get('referenceNo')?.disable();
  }
}
  sanitizeData(data: any): any {
  return JSON.parse(JSON.stringify(data, (key, value) => 
    value === undefined ? null : value
  ));
    
}

  private markFormGroupTouched(formGroup: FormGroup) {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
  
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }
}