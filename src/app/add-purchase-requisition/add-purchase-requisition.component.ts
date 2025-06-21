import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { PurchaseRequisitionService } from '../services/purchase-requisition.service';
import { BrandsService, Brand } from '../services/brands.service';
import { CategoriesService } from '../services/categories.service';
import { LocationService } from '../services/location.service';
import { ProductsService } from '../services/products.service';
import { UserService } from '../services/user.service';
import { SupplierService } from '../services/supplier.service';
import { AuthService } from '../auth.service';
import { Firestore, collection, doc, getDoc } from '@angular/fire/firestore';

import { Subscription } from 'rxjs';

// Constants for Firestore collections
const COLLECTIONS = {
  PRODUCT_STOCK: 'product-stock'
};

interface RequisitionItem {
  productId: string;
  productName: string;
  requiredQuantity: number;
  alertQuantity: number;
  currentStock?: number;
  unitPurchasePrice: number;       
  purchasePriceIncTax: number;    
}
interface Supplier {
  // ... other fields ...
  address: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  zipCode?: string;
  // ... other fields ...
}
@Component({
  selector: 'app-add-purchase-requisition',
  templateUrl: './add-purchase-requisition.component.html',
  styleUrls: ['./add-purchase-requisition.component.scss']
})
export class AddPurchaseRequisitionComponent implements OnInit, OnDestroy {
  purchaseForm!: FormGroup;
  brands: Brand[] = [];
  categories: any[] = [];
  private referenceNumberGenerated = false;

  businessLocations: any[] = [];
  productsList: any[] = [];
  users: any[] = [];
  searchTerm: string = '';
searchResults: any[] = [];
  showSearchResults: boolean = false;
  // In your component class
isSaving: boolean = false;
  suppliers: any[] = [];
  filteredProducts: any[] = [];
  private locationsSubscription: Subscription | undefined;
  private usersSubscription: Subscription | undefined;
  private suppliersSubscription: Subscription | undefined;
  private searchTimeout: any;

selectedItems = new Set<number>();
allSelected = false;  constructor(
    private fb: FormBuilder,
    private requisitionService: PurchaseRequisitionService,
    private brandsService: BrandsService,
    private categoriesService: CategoriesService,
    private locationService: LocationService,
    private productsService: ProductsService,
    private userService: UserService,
    private supplierService: SupplierService,
    public router: Router,
    private authService: AuthService,
    private firestore: Firestore
  ) {}

  ngOnInit(): void {
    this.initializeForm();
    this.loadData();
    this.generateReferenceNumber();
        this.setCurrentUser(); // Add this line

  }
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
  
  this.searchResults = this.productsList.filter(product => {
    // Skip products marked as not for selling
    if (product.notForSelling) {
      return false;
    }
    
    const searchString = [
      product.productName,
      product.sku,
      product.barcode
    ]
    .filter(field => field)
    .join(' ')
    .toLowerCase();
    
    return searchString.includes(searchTerm);
  });
  
  this.showSearchResults = this.searchResults.length > 0;
}
onSearchFocus() {
  if (this.searchTerm && this.searchTerm.length >= 2) {
    this.showSearchResults = true;
  }
}

onSearchBlur() {
  setTimeout(() => {
    this.showSearchResults = false;
  }, 200);
}highlightMatch(text: string, searchTerm: string): string {
  if (!text || !searchTerm) return text;
  
  const regex = new RegExp(searchTerm, 'gi');
  return text.replace(regex, match => 
    `<span class="highlight">${match}</span>`
  );
  }
  // Toggle selection for a single item
toggleSelection(index: number): void {
  if (this.selectedItems.has(index)) {
    this.selectedItems.delete(index);
  } else {
    this.selectedItems.add(index);
  }
  this.allSelected = this.selectedItems.size === this.products.length;
}

// Select all or none
selectAll(event: Event): void {
  const isChecked = (event.target as HTMLInputElement).checked;
  this.allSelected = isChecked;
  
  if (isChecked) {
    for (let i = 0; i < this.products.length; i++) {
      this.selectedItems.add(i);
    }
  } else {
    this.selectedItems.clear();
  }
}
// Bulk delete selected items
bulkDelete(): void {
  if (this.selectedItems.size === 0) return;
  
  // Convert to array and sort in descending order to avoid index issues
  const indicesToDelete = Array.from(this.selectedItems).sort((a, b) => b - a);
  
  for (const index of indicesToDelete) {
    this.products.removeAt(index);
  }
  
  this.selectedItems.clear();
  this.allSelected = false;
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
        this.addProductFromSearch(this.searchResults[index]);
      }
    }
  }
  }
   private setCurrentUser(): void {
    const currentUser = this.authService.currentUserValue;
    if (currentUser) {
      // Set the form control value to the current user's display name
      this.purchaseForm.get('addedBy')?.setValue(currentUser.displayName || currentUser.email);
      
      // If you want to store the user ID as well, you might want to add a hidden field
      // this.purchaseForm.get('addedById')?.setValue(currentUser.uid);
    }
  }
  onUserSelect(userName: string): void {
  if (userName) {
    this.purchaseForm.get('addedBy')?.setValue(userName);
  }
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
      console.error('Error getting stock at location:', error);
      return 0;
    }
  }

async addProductFromSearch(product: any) {
  // Double-check that the product is not marked as "not for selling"
  if (product.notForSelling) {
    alert('This product is marked as "Not for Selling" and cannot be added to purchase requisitions.');
    return;
  }

  const existingIndex = this.products.controls.findIndex(
    control => control.get('productId')?.value === product.id
  );

  if (existingIndex >= 0) {
    // If product already exists, just increase the quantity
    const currentQty = this.products.at(existingIndex).get('requiredQuantity')?.value || 0;
    this.products.at(existingIndex).get('requiredQuantity')?.setValue(currentQty + 1);
    this.calculateSubtotal(existingIndex);
  } else {
    // Get current stock at the selected location
    const selectedLocationId = this.purchaseForm.get('location')?.value;
    const currentStock = selectedLocationId ? 
      await this.getCurrentStockAtLocation(product.id, selectedLocationId) : 0;

    // Calculate purchase price including tax
    const unitPurchasePrice = product.unitPurchasePrice || 
                            product.defaultPurchasePrice || 
                            0;
    const taxPercentage = product.taxPercentage || 0;
    const purchasePriceIncTax = product.defaultPurchasePriceIncTax || 
                              (unitPurchasePrice * (1 + (taxPercentage / 100)));
    
    // Add new product
    const productGroup = this.fb.group({
      productId: [product.id, Validators.required],
      productName: [product.productName, Validators.required],
      alertQuantity: [product.alertQuantity || 0, [Validators.required, Validators.min(0)]],
      currentStock: [currentStock, [Validators.required, Validators.min(0)]],
      unitPurchasePrice: [unitPurchasePrice, [Validators.required, Validators.min(0)]],
      purchasePriceIncTax: [purchasePriceIncTax, [Validators.required, Validators.min(0)]],
      requiredQuantity: [1, [Validators.required, Validators.min(1)]],
      subtotal: [purchasePriceIncTax * 1] // Initial subtotal
    });
    
    this.products.push(productGroup);
    
    // Mark all controls as touched to show validation immediately
    Object.keys(productGroup.controls).forEach(key => {
      productGroup.get(key)?.markAsTouched();
    });
  }
  
  this.clearSearch();
}

clearSearch() {
  this.searchTerm = '';
  this.searchResults = [];
  this.showSearchResults = false;
}
  ngOnDestroy(): void {
    if (this.locationsSubscription) {
      this.locationsSubscription.unsubscribe();
    }
    if (this.usersSubscription) {
      this.usersSubscription.unsubscribe();
    }
    if (this.suppliersSubscription) {
      this.suppliersSubscription.unsubscribe();
    }
  }
initializeForm(): void {
  const today = new Date().toISOString().split('T')[0];
  
  this.purchaseForm = this.fb.group({
    brand: ['', Validators.required],
    category: ['', Validators.required],
    location: ['', Validators.required],
        supplierAddress: [''], // Add this line

    locationName: [''],
    referenceNo: ['', Validators.required],
    requiredByDate: [''], // Removed Validators.required
    date: [today, Validators.required],
    addedBy: ['', Validators.required],
    status: ['pending', Validators.required],
    shippingStatus: ['not_shipped'],
    supplier:  ['', Validators.required],
    shippingDate: [''], // Removed Validators.required
    products: this.fb.array([])
  });
    
    this.purchaseForm.get('location')?.valueChanges.subscribe((locationId) => {
      if (locationId && this.businessLocations.length > 0) {
        const selectedLocation = this.businessLocations.find(loc => loc.id === locationId);
        if (selectedLocation) {
          this.purchaseForm.get('locationName')?.setValue(selectedLocation.name);
        }
      }
    });
  }

  async loadData(): Promise<void> {
    try {
      this.brandsService.brands$.subscribe(brands => {
        this.brands = brands;
      });

      this.categoriesService.categories$.subscribe(categories => {
        this.categories = categories;
      });

      this.locationsSubscription = this.locationService.getLocations().subscribe(locations => {
        if (locations && locations.length > 0) {
          this.businessLocations = locations;
          console.log('Business Locations loaded:', this.businessLocations);
          
          const locationId = this.purchaseForm.get('location')?.value;
          if (locationId) {
            const selectedLocation = this.businessLocations.find(loc => loc.id === locationId);
            if (selectedLocation) {
              this.purchaseForm.get('locationName')?.setValue(selectedLocation.name);
            }
          }
        } else {
          console.log('No business locations found');
          this.businessLocations = [];
        }
      });

      this.productsService.getProductsRealTime().subscribe(products => {
        this.productsList = products;
        this.filteredProducts = products;
      });

      this.usersSubscription = this.userService.getUsers().subscribe(users => {
        this.users = users;
      });

      this.suppliersSubscription = this.supplierService.getSuppliers().subscribe(suppliers => {
        this.suppliers = suppliers;
      });
      
    } catch (error) {
      console.error('Error loading data:', error);
    }
     this.purchaseForm.get('supplier')?.valueChanges.subscribe(supplierId => {
    this.onSupplierChange(supplierId);
  });

  }
// Add this method to handle supplier changes
onSupplierChange(supplierId: string): void {
  if (!supplierId) {
    this.purchaseForm.get('supplierAddress')?.setValue('');
    return;
  }

  this.supplierService.getSupplierById(supplierId).subscribe(supplier => {
    if (supplier) {
      const addressParts = [
        supplier.address,
        supplier.addressLine1,
        supplier.addressLine2,
        supplier.city,
        supplier.state,
        supplier.postalCode || supplier.zipCode,
        supplier.country
      ].filter(part => !!part); // Remove empty parts

      const fullAddress = addressParts.join(', ');
      this.purchaseForm.get('supplierAddress')?.setValue(fullAddress);
    }
  });
}
async generateReferenceNumber(): Promise<void> {
  // Only generate if we haven't already
  if (this.referenceNumberGenerated) return;

  try {
    const latestRequisition = await this.requisitionService.getLatestRequisition();
    
    let nextPrNumber = 1;
    if (latestRequisition) {
      const match = latestRequisition.referenceNo.match(/PR-(\d+)/);
      if (match) {
        nextPrNumber = parseInt(match[1], 10) + 1;
      }
    }

    const formattedPrNumber = `PR-${nextPrNumber.toString().padStart(3, '0')} 001`;
    
    this.purchaseForm.patchValue({
      referenceNo: formattedPrNumber
    });
    
    console.log('Generated reference number:', formattedPrNumber);
    this.referenceNumberGenerated = true; // Mark as generated
  } catch (error) {
    console.error('Error generating reference number:', error);
    const fallbackRef = `PR-001 001`;
    this.purchaseForm.patchValue({
      referenceNo: fallbackRef
    });
    this.referenceNumberGenerated = true; // Mark as generated even if fallback
  }
}


  get products() {
    return this.purchaseForm.get('products') as FormArray;
  }

addProduct(): void {
  this.products.push(
    this.fb.group({
      productId: ['', Validators.required],
      productName: ['', Validators.required],
      alertQuantity: ['', [Validators.required, Validators.min(0)]],
      currentStock: ['', [Validators.required, Validators.min(0)]],
      unitPurchasePrice: ['', [Validators.required, Validators.min(0)]],
      purchasePriceIncTax: ['', [Validators.required, Validators.min(0)]],
      requiredQuantity: ['', [Validators.required, Validators.min(1)]],
      subtotal: [0] // Initialize subtotal to 0
    })
  );
}
 calculateSubtotal(index: number): void {
  const productGroup = this.products.at(index);
  const quantity = productGroup.get('requiredQuantity')?.value || 0;
  const price = productGroup.get('purchasePriceIncTax')?.value || 0;
  const subtotal = quantity * price;
  
  productGroup.get('subtotal')?.setValue(subtotal.toFixed(2));
  }
  // Add this method to calculate tax when unit price changes
onUnitPriceChange(index: number): void {
  const productGroup = this.products.at(index);
  const unitPrice = productGroup.get('unitPurchasePrice')?.value || 0;
  const selectedProductId = productGroup.get('productId')?.value;
  const selectedProduct = this.productsList.find(p => p.id === selectedProductId);
  
  if (selectedProduct) {
    const taxPercentage = selectedProduct.taxPercentage || 0;
    const priceIncTax = unitPrice * (1 + (taxPercentage / 100));
    productGroup.get('purchasePriceIncTax')?.setValue(priceIncTax.toFixed(2));
  }
  
  this.calculateSubtotal(index);
}

calculateTotal(): number {
  return this.products.controls.reduce((total, productGroup) => {
    return total + (parseFloat(productGroup.get('subtotal')?.value || 0));
  }, 0);
}


  removeProduct(index: number): void {
    this.products.removeAt(index);
  }
async onProductSelect(index: number): Promise<void> {
  const selectedProductId = this.products.at(index).get('productId')?.value;
  const selectedProduct = this.productsList.find(p => p.id === selectedProductId && !p.notForSelling);
  
  if (!selectedProduct) {
    if (this.productsList.find(p => p.id === selectedProductId)?.notForSelling) {
      alert('This product is marked as "Not for Selling" and cannot be added to purchase requisitions.');
      this.products.at(index).get('productId')?.setValue('');
      return;
    }
    return;
  }
  
  // Get current stock at the selected location
  const selectedLocationId = this.purchaseForm.get('location')?.value;
  const currentStock = selectedLocationId ? 
    await this.getCurrentStockAtLocation(selectedProduct.id, selectedLocationId) : 0;
  
  // Rest of your existing code...
  const unitPurchasePrice = selectedProduct.unitPurchasePrice || 
                          selectedProduct.defaultPurchasePrice || 
                          0;
  
  // Calculate purchase price including tax
  const taxPercentage = selectedProduct.taxPercentage || 0;
  const purchasePriceIncTax = selectedProduct.defaultPurchasePriceIncTax || 
                            (unitPurchasePrice * (1 + (taxPercentage / 100)));
  
  this.products.at(index).patchValue({
    productName: selectedProduct.productName,
    alertQuantity: selectedProduct.alertQuantity || 0,
    currentStock: currentStock,
    unitPurchasePrice: unitPurchasePrice,
    purchasePriceIncTax: purchasePriceIncTax,
    requiredQuantity: 1 // Default to 1 when selecting a product
  });
  
  // Calculate initial subtotal
  this.calculateSubtotal(index);
}

  

async savePurchase(): Promise<void> {
  if (this.isSaving) return; // Prevent multiple clicks
  
  if (this.purchaseForm.invalid) {
    alert('Please fill all required fields!');
    return;
  }

  if (this.products.length === 0) {
    alert('Please add at least one product!');
    return;
  }

  this.isSaving = true;

  try {
    const formData = this.purchaseForm.getRawValue();
        formData.supplierAddress = this.purchaseForm.get('supplierAddress')?.value; // Add this line

    
    formData.items = formData.products.map((product: any, index: number) => {
      const refParts = formData.referenceNo.split(' ');
      const prNumber = refParts[0];
      const itemNumber = (index + 1).toString().padStart(3, '0');
      
      return {
        productId: product.productId,
        productName: product.productName,
        requiredQuantity: product.requiredQuantity,
        alertQuantity: product.alertQuantity,
        currentStock: product.currentStock,
        unitPurchasePrice: product.unitPurchasePrice,
        purchasePriceIncTax: product.purchasePriceIncTax,
        subtotal: product.subtotal,
        itemReference: `${prNumber} ${itemNumber}`
      };
    });
    
    formData.total = this.calculateTotal();
    delete formData.products;

    await this.requisitionService.addRequisition(formData);
    alert('Purchase Requisition Added Successfully!');
    this.router.navigate(['/purchase-requisition']);
  } catch (error) {
    console.error('Error adding requisition:', error);
    alert('Failed to add purchase requisition. Please try again.');
  } finally {
    this.isSaving = false;
  }
}
}