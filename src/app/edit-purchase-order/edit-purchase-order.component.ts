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
      this.loadTaxRates(); // Add this line

    // Get the order ID from route params
    this.route.params.subscribe(params => {
      this.orderId = params['id'];
      if (this.orderId) {
        this.loadOrderDetails(this.orderId);
      } else {
        this.isLoading = false;
        this.addProduct(); // Add at least one empty product row
      }
    });
  }

  addEmptyProduct() {
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
      const searchString = [
        product.productName,
        product.sku || '',
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
        quantity: [1, [Validators.required, Validators.min(1)]],
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
      supplier: ['', Validators.required],
      address: [''],
      referenceNo: [{ value: '', disabled: true }, Validators.required],
      orderDate: ['', Validators.required],
      deliveryDate: [''],
      requiredDate: ['', Validators.required],
      addedBy: ['', Validators.required],
      businessLocation: ['', Validators.required],
      payTerm: [''],
      status: ['Pending'],
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
          address: orderData.address || '',
          referenceNo: orderData.referenceNo,
          orderDate: this.formatDateForInput(orderData.date),
          // Fix: Change property names to match PurchaseOrder interface
          deliveryDate: orderData.expectedDeliveryDate ? this.formatDateForInput(orderData.expectedDeliveryDate) : '',
          requiredDate: orderData.requiredByDate ? this.formatDateForInput(orderData.requiredByDate) : '',
          addedBy: orderData.addedBy || '',
          businessLocation: orderData.businessLocation,
          payTerm: orderData.payTerm || '',
          status: orderData.status || 'Pending',
          additionalNotes: orderData.additionalNotes || ''
        });
        
        // Populate shipping details if they exist
        if (orderData.shippingDetails) {
          this.purchaseOrderForm.get('shippingDetails')?.patchValue({
            shippingAddress: orderData.shippingDetails.shippingAddress || '',
            shippingCharges: orderData.shippingDetails.shippingCharges || 0,
            shippingStatus: orderData.shippingDetails.shippingStatus || '',
            deliveredTo: orderData.shippingDetails.deliveredTo || ''
          });
        }
        
        // Add products if they exist
        if (orderData.products && orderData.products.length > 0) {
          orderData.products.forEach((product: any) => {
            this.productsFormArray.push(
              this.fb.group({
                productId: [product.productId, Validators.required],
                quantity: [product.quantity, [Validators.required, Validators.min(1)]],
                unitCost: [product.unitCost, [Validators.required, Validators.min(0)]],
                discountType: [product.discountType || 'percent'],
                discountPercent: [product.discountPercent || 0, [Validators.min(0), Validators.max(100)]],
                discountAmount: [product.discountAmount || 0, [Validators.min(0)]],
                unitCostBeforeTax: [product.unitCostBeforeTax || 0],
                subtotalBeforeTax: [product.subtotalBeforeTax || 0],
                taxPercent: [product.taxPercent || 0, [Validators.min(0), Validators.max(100)]],
                taxAmount: [product.taxAmount || 0],
                netCost: [product.netCost || 0],
                lineTotal: [product.lineTotal || 0],
                currentStock: [product.currentStock || 0],
                selected: [false],
                profitMargin: [product.profitMargin || 0],
                sellingPrice: [product.sellingPrice || 0],
                lotNumber: [product.lotNumber || '']
              })
            );
          });
          this.updateTotals();
        } else {
          // Add at least one empty product
          this.addProduct();
        }
      } else {
        alert('Purchase order not found!');
        this.router.navigate(['/purchase-order']);
      }
    } catch (error) {
      console.error('Error loading order details:', error);
      alert('Error loading purchase order details');
      this.router.navigate(['/purchase-order']);
    } finally {
      this.isLoading = false;
    }
  }

  formatDateForInput(dateString: string | Date): string {
    if (!dateString) return '';
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
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

  onProductSelect(index: number) {
    const productFormGroup = this.productsFormArray.at(index);
    const productId = productFormGroup.get('productId')?.value;
    
    if (productId) {
      const selectedProduct = this.productsList.find(p => p.id === productId);
      if (selectedProduct) {
        const unitPrice = selectedProduct.defaultPurchasePrice || 
                         selectedProduct.purchasePrice || 
                         selectedProduct.sellingPrice || 
                         100;
        
        productFormGroup.patchValue({
          unitCost: unitPrice,
          currentStock: selectedProduct.currentStock || 0, // Fixed: Now using optional property
          taxPercent: selectedProduct.taxPercentage || 0 // Fixed: Now using optional property
        });
        
        this.calculateLineTotal(index);
      }
    }
  }

  calculateLineTotal(index: number) {
    const productFormGroup = this.productsFormArray.at(index);
    const quantity = productFormGroup.get('quantity')?.value || 0;
    const unitCost = productFormGroup.get('unitCost')?.value || 0;
    const discountType = productFormGroup.get('discountType')?.value;
    let discountValue = 0;

    // Calculate discount based on type
    if (discountType === 'percent') {
      const discountPercent = productFormGroup.get('discountPercent')?.value || 0;
      discountValue = (unitCost * discountPercent) / 100;
      productFormGroup.get('discountAmount')?.setValue(discountValue.toFixed(2));
    } else {
      discountValue = productFormGroup.get('discountAmount')?.value || 0;
      const discountPercent = unitCost > 0 ? (discountValue / unitCost) * 100 : 0;
      productFormGroup.get('discountPercent')?.setValue(discountPercent.toFixed(2));
    }

    // Calculate costs after discount
    const unitCostBeforeTax = unitCost - discountValue;
    const subtotalBeforeTax = unitCostBeforeTax * quantity;
    
    // Calculate tax
    const taxPercent = productFormGroup.get('taxPercent')?.value || 0;
    const taxAmount = (subtotalBeforeTax * taxPercent) / 100;
    const netCost = subtotalBeforeTax + taxAmount;

    productFormGroup.patchValue({
      unitCostBeforeTax: unitCostBeforeTax.toFixed(2),
      subtotalBeforeTax: subtotalBeforeTax.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      netCost: netCost.toFixed(2),
      lineTotal: netCost.toFixed(2)
    });

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
    this.totalItems = this.productsFormArray.length;
    
    this.netTotalAmount = this.productsFormArray.controls.reduce((total, control) => {
      return total + (parseFloat(control.get('lineTotal')?.value) || 0);
    }, 0);
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
          address: formData.address,
          referenceNo: formData.referenceNo,
          date: formData.orderDate,
          // Fix: Map form field names to match PurchaseOrder interface
          expectedDeliveryDate: formData.deliveryDate,
          requiredByDate: formData.requiredDate,
          addedBy: formData.addedBy,
          businessLocation: formData.businessLocation,
          payTerm: formData.payTerm,
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