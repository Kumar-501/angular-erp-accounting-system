import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { PurchaseOrderService } from '../services/purchase-order.service';
import { SupplierService } from '../services/supplier.service';
import { LocationService } from '../services/location.service';
import { ProductsService } from '../services/products.service';
import { UserService } from '../services/user.service';
import { TaxService } from '../services/tax.service'; // Adjust the path as needed


interface Supplier {
  id?: string;
  contactId?: string;
  businessName?: string;
  firstName?: string;
  lastName?: string;
  isIndividual?: boolean;
}

interface Product {
  id: string;
  productName: string;
  purchasePrice?: number;
  sellingPrice?: number;
  defaultPurchasePrice?: number;
  currentStock?: number;
  taxPercentage?: number;
    notForSelling?: boolean; // Add this line

  sku?: string;
  totalQuantity?: number;
  defaultSellingPriceExcTax?: number;
  defaultSellingPriceIncTax?: number;
  defaultPurchasePriceIncTax?: number;
  defaultPurchasePriceExcTax?: number;
  unitPurchasePrice?: number;
  unitSellingPrice?: number;
  barcode?: string;
}

interface TaxRate {
  name: string;
  rate: number;
}

@Component({
  selector: 'app-edit-purchase-order',
  templateUrl: './edit-purchase-order.component.html',
  styleUrls: ['./edit-purchase-order.component.scss']
})
export class EditPurchaseOrderComponent implements OnInit {
  purchaseOrderForm!: FormGroup;
  suppliers: Supplier[] = [];
  businessLocations: any[] = [];
  productsList: Product[] = [];
  users: any[] = [];
  taxRates: TaxRate[] = []; // This will be populated by the service
  orderId: string = '';
  isLoading: boolean = true;
  searchTerm: string = '';
  searchResults: Product[] = [];
  showSearchResults: boolean = false;
  selectedProductIndex: number = -1;
  private searchTimeout: any;

  totalItems: number = 0;
  netTotalAmount: number = 0;
  
  // Added missing taxRates property


  constructor(
    private fb: FormBuilder,
    private orderService: PurchaseOrderService,
    private supplierService: SupplierService,
    private locationService: LocationService,
    private productsService: ProductsService,
    private userService: UserService,
    private router: Router,
    private route: ActivatedRoute,
      private taxService: TaxService

  ) {}

ngOnInit(): void {
  this.initForm();
  this.loadSuppliers();
  this.loadBusinessLocations();
  this.loadProducts();
  this.loadUsers();
  this.loadTaxRates();

  this.route.params.subscribe(params => {
    this.orderId = params['id'];
    if (this.orderId) {
      this.loadOrderDetails(this.orderId).then(() => {
        // Initialize taxes for all products after loading
        this.initializeProductTaxes();
      });
    } else {
      this.isLoading = false;
      this.addProduct();
    }
  });
}

  addEmptyProduct() {
    this.productsFormArray.push(
      this.fb.group({
        productId: ['', Validators.required],
        quantity: [1, [, Validators.min(1)]],
        unitCost: [0, [, Validators.min(0)]],
        discountType: ['percent'],
        discountPercent: [0, [Validators.min(0), Validators.max(100)]],
        discountAmount: [0, [Validators.min(0)]],
        unitCostBeforeTax: [0],
        subtotalBeforeTax: [0],
        taxPercent: [0, [Validators.min(0), Validators.max(100)]],
        taxAmount: [0],
        netCost: [0],
        lineTotal: [0],
        currentStock: [0],
        selected: [false],
        profitMargin: [0],
        sellingPrice: [0],
        lotNumber: ['']
      })
    );
  }

  onSearchInput(event: any): void {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    
    this.searchTimeout = setTimeout(() => {
      this.searchProducts(event);
    }, 300);
  }

  onSearchFocus() {
    this.showSearchResults = true;
  }

  // Added missing onSearchBlur method
  onSearchBlur() {
    // Delay hiding search results to allow for click events
    setTimeout(() => {
      this.showSearchResults = false;
    }, 150);
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
loadTaxRates() {
  this.taxService.getTaxRates().subscribe({
    next: (rates) => {
      this.taxRates = rates;
    },
    error: (err) => {
      console.error('Error loading tax rates:', err);
      // Optionally fall back to hardcoded rates if needed
      this.taxRates = [];
    }
  });
}

addProductFromSearch(product: Product) {
  // Double-check that the product is not marked as "not for selling"
  if (product.notForSelling) {
    alert('This product is marked as "Not for Selling" and cannot be added to purchase orders.');
    return;
  }

  const existingIndex = this.productsFormArray.controls.findIndex(
    control => control.get('productId')?.value === product.id
  );
  
  const unitCost = product.defaultPurchasePriceIncTax || 
                 product.defaultPurchasePriceExcTax || 
                 product.unitPurchasePrice || 
                 product.purchasePrice ||
                 0;

  const sellingPrice = product.defaultSellingPriceIncTax || 
                     product.unitSellingPrice || 
                     product.sellingPrice ||
                     0;

  const currentStock = product.currentStock || product.totalQuantity || 0;

  if (existingIndex >= 0) {
    const currentQty = this.productsFormArray.at(existingIndex).get('quantity')?.value || 0;
    this.productsFormArray.at(existingIndex).get('quantity')?.setValue(currentQty + 1);
    this.productsFormArray.at(existingIndex).get('currentStock')?.setValue(currentStock);
    this.calculateLineTotal(existingIndex);
  } else {
    const productFormGroup = this.fb.group({
      productId: [product.id, Validators.required],
      productName: [product.productName],
      quantity: [1, [, Validators.min(1)]],
      unitCost: [unitCost, [Validators.required, Validators.min(0)]],
      sellingPrice: [sellingPrice],
      currentStock: [currentStock],
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

  highlightMatch(text: string, searchTerm: string): string {
    if (!text || !searchTerm) return text;
    
    const regex = new RegExp(searchTerm, 'gi');
    return text.replace(regex, match => 
      `<span class="highlight">${match}</span>`
    );
  }

  initForm(): void {
    this.purchaseOrderForm = this.fb.group({
      supplier: [''],
      // address: [''],
      referenceNo: [{ value: '', disabled: true }, Validators.required],
      orderDate: ['', ],
      deliveryDate: [''],
      requiredDate: ['', ],
      businessLocation: ['', ],
      status: ['Pending'],
          addedBy: [''], // Add this line

      products: this.fb.array([]),
      shippingDetails: this.fb.group({
        shippingAddress: [''],
        shippingCharges: [0],
        shippingStatus: [''],
        deliveredTo: [''],
        shippingDocuments: [null]
      }),
      attachDocument: [null],
      additionalNotes: ['']
    });
  }

  selectAllProducts(event: any) {
    const isChecked = event.target.checked;
    this.productsFormArray.controls.forEach(control => {
      control.get('selected')?.setValue(isChecked);
    });
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

  // Added missing onDiscountTypeChange method
  onDiscountTypeChange(index: number) {
    const productFormGroup = this.productsFormArray.at(index);
    const discountType = productFormGroup.get('discountType')?.value;
    
    // Reset discount values when type changes
    if (discountType === 'percent') {
      productFormGroup.get('discountAmount')?.setValue(0);
    } else {
      productFormGroup.get('discountPercent')?.setValue(0);
    }
    
    this.calculateLineTotal(index);
  }

  loadUsers(): void {
    this.userService.getUsers().subscribe(users => {
      this.users = users;
    });
  }

  loadProducts(): void {
    this.productsService.getProductsRealTime().subscribe({
      next: (products: any[]) => {
        this.productsList = products.map(product => ({
          ...product,
          // Use purchasePrice if available, otherwise use sellingPrice or set a default
          defaultPurchasePrice: product.purchasePrice || product.sellingPrice || 100,
          currentStock: product.currentStock || 0, // Ensure currentStock is always present
          taxPercentage: product.taxPercentage || 0 // Ensure taxPercentage is always present
        }));
        console.log('Loaded products:', this.productsList); // Debug log
      },
      error: (err) => {
        console.error('Error loading products:', err);
      }
    });
  }

async loadOrderDetails(orderId: string): Promise<void> {
  this.isLoading = true;
  try {
    const orderData = await this.orderService.getOrderById(orderId);
    
    if (orderData) {
      // Clear existing products
      while (this.productsFormArray.length) {
        this.productsFormArray.removeAt(0);
      }
      
      // Populate the form with order data
      this.purchaseOrderForm.patchValue({
        supplier: orderData.supplier,
        // address: orderData.address,
        referenceNo: orderData.referenceNo,
        orderDate: this.formatDateForInput(orderData.date),
        deliveryDate: this.formatDateForInput(orderData.expectedDeliveryDate),
        requiredDate: this.formatDateForInput(orderData.requiredByDate),
        addedBy: orderData.addedBy,
        businessLocation: orderData.businessLocation,
        status: orderData.status,
        shippingDetails: {
          shippingAddress: orderData.shippingDetails?.shippingAddress || '',
          shippingCharges: orderData.shippingDetails?.shippingCharges || 0,
          shippingStatus: orderData.shippingDetails?.shippingStatus || '',
          deliveredTo: orderData.shippingDetails?.deliveredTo || ''
        },
        additionalNotes: orderData.additionalNotes || ''
      });
      
      // Add products if they exist
      if (orderData.products && orderData.products.length > 0) {
        for (const product of orderData.products) {
          // Get the full product details from productsList
          const fullProduct = this.productsList.find(p => p.id === product.productId);
          
          // Calculate before-tax values
          const discountValue = product.discountType === 'percent' 
            ? (product.unitCost * (product.discountPercent || 0)) / 100
            : (product.discountAmount || 0);
            
          const unitCostBeforeTax = product.unitCost - discountValue;
          const subtotalBeforeTax = unitCostBeforeTax * product.quantity;
          
          // Use product's tax rate if available, otherwise use the one from order data
          const taxPercent = fullProduct?.taxPercentage || product.taxPercent || 0;
          
          const productFormGroup = this.fb.group({
            productId: [product.productId, Validators.required],
            quantity: [product.quantity, [Validators.required, Validators.min(1)]],
            unitCost: [product.unitCost, [Validators.required, Validators.min(0)]],
            discountType: [product.discountType || 'percent'],
            discountPercent: [product.discountPercent || 0, [Validators.min(0), Validators.max(100)]],
            discountAmount: [product.discountAmount || 0, [Validators.min(0)]],
            unitCostBeforeTax: [this.roundToTwo(unitCostBeforeTax)],
            subtotalBeforeTax: [this.roundToTwo(subtotalBeforeTax)],
            taxPercent: [taxPercent, [Validators.min(0), Validators.max(100)]],
            taxAmount: [product.taxAmount || 0],
            netCost: [product.netCost || 0],
            lineTotal: [product.lineTotal || 0],
            currentStock: [fullProduct?.currentStock || 0],
            selected: [false]
          });
          
          this.productsFormArray.push(productFormGroup);
          
          // Calculate line total to ensure all values are correct
          this.calculateLineTotal(this.productsFormArray.length - 1);
        }
        this.updateTotals();
      } else {
        this.addProduct();
      }
    }
  } catch (error) {
    console.error('Error loading order details:', error);
  } finally {
    this.isLoading = false;
  }
}

formatDateForInput(dateString: string | Date | undefined | null): string {
  if (!dateString) return '';
  
  // Handle both string and Date inputs
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  
  // Check if the date is valid
  if (isNaN(date.getTime())) return '';
  
  return date.toISOString().split('T')[0];
}
  loadBusinessLocations(): void {
    this.locationService.getLocations().subscribe(
      (locations) => {
        this.businessLocations = locations;
      },
      (error: any) => {
        console.error('Error loading business locations:', error);
      }
    );
  }

  loadSuppliers(): void {
    this.supplierService.getSuppliers().subscribe((suppliers: Supplier[]) => {
      this.suppliers = suppliers;
    });
  }

  getSupplierDisplayName(supplier: Supplier): string {
    if (supplier?.isIndividual) {
      return `${supplier.firstName || ''} ${supplier.lastName || ''}`.trim();
    }
    return supplier?.businessName || '';
  }

  get productsFormArray() {
    return this.purchaseOrderForm.get('products') as FormArray;
  }

  addProduct() {
    this.productsFormArray.push(
      this.fb.group({
        productId: ['', Validators.required],
        quantity: [1, [Validators.required, Validators.min(1)]],
        unitCost: [0, [Validators.required, Validators.min(0)]],
        discountType: ['percent'],
        discountPercent: [0, [Validators.min(0), Validators.max(100)]],
        discountAmount: [0, [Validators.min(0)]],
        unitCostBeforeTax: [0],
        subtotalBeforeTax: [0],
        taxPercent: [0, [Validators.min(0), Validators.max(100)]],
        taxAmount: [0],
        netCost: [0],
        lineTotal: [0],
        currentStock: [0],
        selected: [false],
        profitMargin: [0],
        sellingPrice: [0],
        lotNumber: ['']
      })
    );
    this.updateTotals();
  }

  removeProduct(index: number) {
    this.productsFormArray.removeAt(index);
    this.updateTotals();
  }
private initializeProductTaxes() {
  this.productsFormArray.controls.forEach((control, index) => {
    const productId = control.get('productId')?.value;
    if (productId) {
      const product = this.productsList.find(p => p.id === productId);
      if (product && product.taxPercentage !== undefined) {
        // Only update if we have a tax percentage from the product
        control.get('taxPercent')?.setValue(product.taxPercentage);
        this.calculateLineTotal(index);
      }
    }
  });
}
onProductSelect(index: number) {
  const productFormGroup = this.productsFormArray.at(index);
  const productId = productFormGroup.get('productId')?.value;
  
  if (productId) {
    const selectedProduct = this.productsList.find(p => p.id === productId);
    
    if (!selectedProduct) {
      return;
    }

    // Check if product is marked as not for selling
    if (selectedProduct.notForSelling) {
      alert('This product is marked as "Not for Selling" and cannot be added to purchase orders.');
      productFormGroup.get('productId')?.setValue('');
      return;
    }

    const unitPrice = selectedProduct.defaultPurchasePriceIncTax || 
                    selectedProduct.defaultPurchasePriceExcTax || 
                    selectedProduct.unitPurchasePrice || 
                    selectedProduct.purchasePrice ||
                    selectedProduct.defaultSellingPriceIncTax ||
                    selectedProduct.sellingPrice || 
                    0;
    
    const taxPercent = selectedProduct.taxPercentage || 0;
    
    productFormGroup.patchValue({
      unitCost: unitPrice,
      currentStock: selectedProduct.currentStock || 0,
      taxPercent: taxPercent
    });
    
    this.calculateLineTotal(index);
  }
}
calculateLineTotal(index: number) {
  const productFormGroup = this.productsFormArray.at(index);
  
  // Get all necessary values with proper defaults
  const quantity = parseFloat(productFormGroup.get('quantity')?.value) || 1;
  const unitCost = parseFloat(productFormGroup.get('unitCost')?.value) || 0;
  const discountType = productFormGroup.get('discountType')?.value || 'percent';
  const discountPercent = parseFloat(productFormGroup.get('discountPercent')?.value) || 0;
  const discountAmount = parseFloat(productFormGroup.get('discountAmount')?.value) || 0;
  const taxPercent = parseFloat(productFormGroup.get('taxPercent')?.value) || 0;

  // Calculate discount value
  const discountValue = discountType === 'percent' 
    ? (unitCost * discountPercent) / 100
    : Math.min(discountAmount, unitCost); // Ensure discount doesn't exceed unit cost

  // Calculate before-tax values
  const unitCostBeforeTax = unitCost - discountValue;
  const subtotalBeforeTax = unitCostBeforeTax * quantity;
  
  // Calculate tax and total
  const taxAmount = (subtotalBeforeTax * taxPercent) / 100;
  const lineTotal = subtotalBeforeTax + taxAmount;

  // Update form values without triggering events
  productFormGroup.patchValue({
    unitCostBeforeTax: this.roundToTwo(unitCostBeforeTax),
    subtotalBeforeTax: this.roundToTwo(subtotalBeforeTax),
    taxAmount: this.roundToTwo(taxAmount),
    lineTotal: this.roundToTwo(lineTotal)
  }, { emitEvent: false });

  // Update the grand totals
  this.updateTotals();
}

// Helper function to round to 2 decimal places
private roundToTwo(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
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
  let totalItems = 0;
  let netTotalAmount = 0;

  // Calculate totals for all products
  this.productsFormArray.controls.forEach(control => {
    const quantity = parseFloat(control.get('quantity')?.value) || 0;
    const lineTotal = parseFloat(control.get('lineTotal')?.value) || 0;
    
    totalItems += quantity;
    netTotalAmount += lineTotal;
  });

  // Add shipping charges if applicable
  const shippingCharges = parseFloat(this.purchaseOrderForm.get('shippingDetails.shippingCharges')?.value) || 0;
  netTotalAmount += shippingCharges;

  // Update component properties
  this.totalItems = totalItems;
  this.netTotalAmount = netTotalAmount;
}

  onFileChange(event: any, fieldName: string) {
    const file = event.target.files[0];
    if (file && file.size <= 5 * 1024 * 1024) {
      const allowedExtensions = ['.pdf', '.csv', '.zip', '.doc', '.docx', '.jpeg', '.jpg', '.png'];
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      
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

  async updateOrder() {
    if (this.purchaseOrderForm.valid && this.productsFormArray.length > 0) {
      this.purchaseOrderForm.get('referenceNo')?.enable();
      
      const formData = this.purchaseOrderForm.value;
      
      try {
        // Create a purchase order object with the form data
        const updatedOrder = {
          id: this.orderId,
          supplier: formData.supplier,
          // address: formData.address,
          referenceNo: formData.referenceNo,
          date: formData.orderDate,
          // Fix: Map form field names to match PurchaseOrder interface
          expectedDeliveryDate: formData.deliveryDate,
          requiredByDate: formData.requiredDate,
          addedBy: formData.addedBy,
          businessLocation: formData.businessLocation,
          
          status: formData.status,
          products: formData.products,
          shippingDetails: formData.shippingDetails,
          additionalNotes: formData.additionalNotes,
          attachDocument: formData.attachDocument,
          updatedAt: new Date()
        };
        
        // Now use the updateOrder method from the service
        await this.orderService.updateOrder(this.orderId, updatedOrder);
        
        alert('Purchase Order Updated Successfully!');
        this.router.navigate(['/purchase-order']);
      } catch (error: any) {
        console.error('Error updating order:', error);
        alert('Error updating purchase order: ' + error.message);
      } finally {
        this.purchaseOrderForm.get('referenceNo')?.disable();
      }
    } else {
      alert('Please fill all required fields and add at least one product.');
    }
  }

  cancelEdit() {
    this.router.navigate(['/purchase-order']);
  }
}