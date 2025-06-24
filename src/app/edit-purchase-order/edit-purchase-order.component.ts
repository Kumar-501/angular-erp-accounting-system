import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators, AbstractControl } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { PurchaseOrderService } from '../services/purchase-order.service';
import { SupplierService } from '../services/supplier.service';
import { LocationService } from '../services/location.service';
import { ProductsService } from '../services/products.service';
import { UserService } from '../services/user.service';
import { TaxService } from '../services/tax.service';
import { TaxRate } from '../tax/tax.model';

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
  zipCode?: string;
}

interface Product {
  defaultSellingPriceIncTax: number | undefined;
  id: string;
  productName: string;
  sku?: string;
  unitPurchasePrice?: number;
  unitSellingPrice?: number;
  defaultPurchasePrice?: number;
  defaultPurchasePriceExcTax?: number | null;
  defaultPurchasePriceIncTax?: number | null;
  currentStock?: number;
  totalQuantity?: number;
  taxPercentage?: number;
  
  notForSelling?: boolean;
  marginPercentage?: number;
  barcode?: string;
  productDescription?: string;
  defaultSellingPriceExcTax?: number;
}

@Component({
  selector: 'app-edit-purchase-order',
  templateUrl: './edit-purchase-order.component.html',
  styleUrls: ['./edit-purchase-order.component.scss']
})
export class EditPurchaseOrderComponent implements OnInit {
  [x: string]: any;
  purchaseOrderForm!: FormGroup;
  suppliers: Supplier[] = [];
  businessLocations: any[] = [];
  productsList: Product[] = [];
  lastEditedShippingField: 'before' | 'after' = 'before';
  
  filteredProducts: Product[] = [];
  searchResults: Product[] = [];
  showSearchResults: boolean = false;
  searchTerm: string = '';
  totalItems: number = 0;
  taxRates: TaxRate[] = [];
  isSaving: boolean = false;
  supplierSearchTerm: string = '';
  showSupplierDropdown: boolean = false;
  filteredSuppliers: Supplier[] = [];
  discountTypes: ('percent' | 'amount')[] = [];
  netTotalAmount: number = 0;
  users: any[] = [];
  selectedSupplierDetails: any = null;
  private searchTimeout: any;
  
  orderId: string = '';
  isLoading: boolean = true;
  selectedProductIndex: number = -1;

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
  ) { }

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
          this.initializeProductTaxes();
        });
      } else {
        this.isLoading = false;
        this.addEmptyProduct();
      }
    });

    this.filteredSuppliers = [...this.suppliers];
  }

  initForm(): void {
    this.purchaseOrderForm = this.fb.group({
      supplier: ['', Validators.required],
      address: [''],
      referenceNo: [{ value: '', disabled: true }, Validators.required],
      orderDate: ['', Validators.required],
    requiredDate: ['', Validators.required], // Make sure this exists

      addedBy: ['', Validators.required],
      businessLocation: ['', Validators.required],
      status: ['Pending'],
      products: this.fb.array([]),
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
    
    const beforeTaxCtrl = shippingDetails.get('shippingChargesBeforeTax');
    const afterTaxCtrl = shippingDetails.get('shippingChargesAfterTax');
    const taxPercentCtrl = shippingDetails.get('shippingTaxPercent');
    const taxAmountCtrl = shippingDetails.get('shippingTaxAmount');
    
    const taxPercent = parseFloat(taxPercentCtrl?.value) || 0;
    
    if (calculationType === 'before') {
      const beforeTax = parseFloat(beforeTaxCtrl?.value) || 0;
      const taxAmount = beforeTax * (taxPercent / 100);
      const afterTax = beforeTax + taxAmount;
      
      afterTaxCtrl?.setValue(afterTax.toFixed(2), { emitEvent: false });
      taxAmountCtrl?.setValue(taxAmount.toFixed(2), { emitEvent: false });
    }
    else if (calculationType === 'after') {
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
    
    this.purchaseOrderForm.patchValue({
      address: fullAddress,
      shippingDetails: {
        shippingAddress: `${this.getSupplierDisplayName(supplier)}\n${fullAddress}`
      }
    });
    
    this.onSupplierChange();
  }

  onSupplierBlur(): void {
    setTimeout(() => {
      this.showSupplierDropdown = false;
      
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

  loadSuppliers(): void {
    this.supplierService.getSuppliers().subscribe((suppliers: Supplier[]) => {
      this.suppliers = suppliers;
      this.filteredSuppliers = [...this.suppliers];
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
        selected: [false]
      })
    );
  }

  removeProduct(index: number) {
    this.discountTypes.splice(index, 1);
    this.productsFormArray.removeAt(index);
    this.updateTotals();
  }

  onSupplierFocus() {
    this.showSupplierDropdown = true;
    if (!this.supplierSearchTerm) {
      this.filteredSuppliers = [...this.suppliers];
    }
  }

  onProductSelect(index: number) {
    const productFormGroup = this.productsFormArray.at(index);
    const productId = productFormGroup.get('productId')?.value;
    
    if (productId) {
      const selectedProduct = this.productsList.find(p => p.id === productId && !p.notForSelling);
      
      if (!selectedProduct) {
        if (this.productsList.find(p => p.id === productId)?.notForSelling) {
          alert('This product is marked as "Not for Selling" and cannot be added to purchase orders.');
          productFormGroup.get('productId')?.setValue('');
          return;
        }
        return;
      }

      const unitPurchasePrice = selectedProduct.defaultPurchasePriceExcTax || 
                              selectedProduct.unitPurchasePrice || 
                              0;
      
      productFormGroup.patchValue({
        productName: selectedProduct.productName,
        unitCost: unitPurchasePrice,
        unitCostBeforeTax: unitPurchasePrice,
        taxPercent: selectedProduct.taxPercentage || 0,
        currentStock: selectedProduct.currentStock || selectedProduct.totalQuantity || 0
      });
      
      this.calculateLineTotal(index);
    }
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
    
    if (discountType === 'percent') {
      discountAmount = (unitCost * discountPercent) / 100;
      productFormGroup.get('discountAmount')?.setValue(discountAmount.toFixed(2), { emitEvent: false });
    } else {
      discountPercent = (discountAmount / unitCost) * 100;
      productFormGroup.get('discountPercent')?.setValue(discountPercent.toFixed(2), { emitEvent: false });
    }

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

  updateTotals() {
    this.totalItems = this.productsFormArray.controls.reduce((total, control) => {
      return total + (parseInt(control.get('quantity')?.value) || 0);
    }, 0);
    
    const productsTotal = this.productsFormArray.controls.reduce((total, control) => {
      return total + (parseFloat(control.get('lineTotal')?.value) || 0);
    }, 0);
    
    const shippingTotal = parseFloat(this.purchaseOrderForm.get('shippingDetails.shippingChargesAfterTax')?.value) || 0;
    
    this.netTotalAmount = productsTotal + shippingTotal;
  }

  onFileChange(event: any, fieldName: string) {
    const file = event.target.files[0];
    if (file && file.size <= 5 * 1024 * 1024) {
      const allowedExtensions = ['.pdf', '.csv', '.zip', '.doc', '.docx', '.jpeg', '.jpg', '.png'];
      const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
      
      if (allowedExtensions.includes(fileExtension)) {
        // Store file reference for later upload, don't set directly in form
        if (fieldName === 'shippingDocuments') {
          this.selectedShippingDocument = file;
        } else {
          this.selectedAttachDocument = file;
        }
      } else {
        alert('Invalid file type!');
      }
    } else {
      alert('File size exceeds 5MB!');
    }
  }

  // Add these properties to store file references
  selectedShippingDocument: File | null = null;
  selectedAttachDocument: File | null = null;

  searchProducts(event: any) {
    const searchTerm = event.target.value.toLowerCase().trim();
    this.searchTerm = searchTerm;
    
    if (!searchTerm || searchTerm.length < 2) {
      this.searchResults = [];
      this.showSearchResults = false;
      return;
    }
    
    this.searchResults = this.productsList.filter(product => {
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
    this.showSearchResults = true;
  }

  onSearchInput(event: any): void {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    
    this.searchTimeout = setTimeout(() => {
      this.searchProducts(event);
    }, 300);
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
          this.addProductFromSearch(this.searchResults[index]);
        }
      }
    }
  }

  addProductFromSearch(product: Product) {
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
      0;

    const sellingPrice = product.defaultSellingPriceIncTax ||
      product.unitSellingPrice ||
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

  selectAllProducts(event: any) {
    const isChecked = event.target.checked;
    this.productsFormArray.controls.forEach(control => {
      control.get('selected')?.setValue(isChecked);
    });
  }

  onDiscountTypeChange(index: number) {
    const productFormGroup = this.productsFormArray.at(index) as FormGroup;
    productFormGroup.get('discountPercent')?.setValue(0);
    productFormGroup.get('discountAmount')?.setValue(0);
    this.calculateLineTotal(index);
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

async loadOrderDetails(orderId: string): Promise<void> {
  this.isLoading = true;
  try {
    const orderData = await this.orderService.getOrderById(orderId);
    
    if (orderData) {
      // Clear existing products
      while (this.productsFormArray.length) {
        this.productsFormArray.removeAt(0);
      }
      
      // Wait for suppliers to load before setting supplier data
      if (this.suppliers.length === 0) {
        await new Promise(resolve => {
          const subscription = this.supplierService.getSuppliers().subscribe(suppliers => {
            this.suppliers = suppliers;
            this.filteredSuppliers = [...this.suppliers];
            subscription.unsubscribe();
            resolve(true);
          });
        });
      }

      // Set supplier search term for display
      if (orderData.supplier) {
        const supplier = this.suppliers.find(s => s.id === orderData.supplier);
        if (supplier) {
          this.supplierSearchTerm = this.getSupplierDisplayName(supplier);
          this.selectedSupplierDetails = supplier;
        }
      }
      
      // Populate the form with order data
      this.purchaseOrderForm.patchValue({
        supplier: orderData.supplier,
        address: orderData.address,
        referenceNo: orderData.referenceNo,
        orderDate: this.formatDateForInput(orderData.date),

        addedBy: orderData.addedBy || this.users[0]?.username,
        businessLocation: orderData.businessLocation,
        status: orderData.status || 'Pending',
        additionalNotes: orderData.additionalNotes || '',
        shippingDetails: {
          shippingDetails: orderData.shippingDetails?.shippingDetails || '',
          shippingAddress: orderData.shippingDetails?.shippingAddress || '',
          shippingChargesBeforeTax: orderData.shippingDetails?.shippingChargesBeforeTax || 0,
          shippingTaxPercent: orderData.shippingDetails?.shippingTaxPercent || 18,
          shippingTaxAmount: orderData.shippingDetails?.shippingTaxAmount || 0,
          shippingChargesAfterTax: orderData.shippingDetails?.shippingChargesAfterTax || orderData.shippingCharges || 0,
          shippingStatus: orderData.shippingDetails?.shippingStatus || '',
          deliveredTo: orderData.shippingDetails?.deliveredTo || '',
        requiredDate: this.formatDateForInput(orderData.requiredDate || orderData.requiredByDate), // Add this line

        }
      });

      // Add products if they exist
      if (orderData.products && orderData.products.length > 0) {
        for (const product of orderData.products) {
          const fullProduct = this.productsList.find(p => p.id === product.productId) || product;
          
          // Calculate discount values
          let discountType = 'percent';
          let discountPercent = 0;
          let discountAmount = 0;
          
          if (product.discountType) {
            discountType = product.discountType;
          } else {
            // Determine discount type from existing values
            if (product.discountPercent !== undefined) {
              discountType = 'percent';
              discountPercent = product.discountPercent;
              discountAmount = (product.unitCost * discountPercent) / 100;
            } else if (product.discountAmount !== undefined) {
              discountType = 'amount';
              discountAmount = product.discountAmount;
              discountPercent = (discountAmount / product.unitCost) * 100;
            }
          }
          
          const unitCostBeforeTax = product.unitCostBeforeTax || 
                                  (product.unitCost - discountAmount);
          const subtotalBeforeTax = product.subtotalBeforeTax || 
                                   (unitCostBeforeTax * product.quantity);
          
          const taxPercent = fullProduct?.taxPercentage || product.taxPercent || 0;
          const taxAmount = product.taxAmount || 
                           (subtotalBeforeTax * (taxPercent / 100));
          const netCost = product.netCost || 
                         (unitCostBeforeTax + (unitCostBeforeTax * (taxPercent / 100)));
          const lineTotal = product.lineTotal || 
                          (netCost * product.quantity);
          
          const productFormGroup = this.fb.group({
            productId: [product.productId, Validators.required],
            quantity: [product.quantity, [Validators.required, Validators.min(1)]],
            unitCost: [product.unitCost, [Validators.required, Validators.min(0)]],
            discountType: [discountType],
            discountPercent: [discountPercent, [Validators.min(0), Validators.max(100)]],
            discountAmount: [discountAmount, [Validators.min(0)]],
            unitCostBeforeTax: [this.roundToTwo(unitCostBeforeTax)],
            subtotalBeforeTax: [this.roundToTwo(subtotalBeforeTax)],
            taxPercent: [taxPercent, [Validators.min(0), Validators.max(100)]],
            taxAmount: [this.roundToTwo(taxAmount)],
            netCost: [this.roundToTwo(netCost)],
            lineTotal: [this.roundToTwo(lineTotal)],
            currentStock: [fullProduct?.currentStock || product.currentStock || 0],
            selected: [false]
          });
          
          this.productsFormArray.push(productFormGroup);
        }
        this.updateTotals();
      } else {
        this.addEmptyProduct();
      }
      
      // Handle document references if they exist
      // (Removed check for orderData.attachDocument as it does not exist on PurchaseOrder)
      
      if (orderData.shippingDetails?.shippingDocuments) {
        // Display existing shipping document info
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
    
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    
    if (isNaN(date.getTime())) return '';
    
    return date.toISOString().split('T')[0];
  }

  private initializeProductTaxes() {
    this.productsFormArray.controls.forEach((control, index) => {
      const productId = control.get('productId')?.value;
      if (productId) {
        const product = this.productsList.find(p => p.id === productId);
        if (product && product.taxPercentage !== undefined) {
          control.get('taxPercent')?.setValue(product.taxPercentage);
          this.calculateLineTotal(index);
        }
      }
    });
  }

  private roundToTwo(num: number): number {
    return Math.round((num + Number.EPSILON) * 100) / 100;
  }

  async updateOrder() {
    if (this.isSaving) return;

    this.markFormGroupTouched(this.purchaseOrderForm);

    if (this.purchaseOrderForm.invalid) {
      this.highlightInvalidFields();
      
      const firstInvalidControl = this.findFirstInvalidControl();
      if (firstInvalidControl) {
        firstInvalidControl.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
        
        if (firstInvalidControl.tagName === 'INPUT' ||
          firstInvalidControl.tagName === 'SELECT') {
          (firstInvalidControl as HTMLElement).focus();
        }
      }
      
      alert('Please fill all mandatory fields correctly.');
      return;
    }

    if (this.productsFormArray.length === 0) {
      alert('Please add at least one product.');
      return;
    }

    this.isSaving = true;

    try {
      this.purchaseOrderForm.get('referenceNo')?.enable();
      const formData = this.purchaseOrderForm.value;
      
      // Handle file uploads separately - don't include File objects in the main data
      let attachDocumentUrl = null;
      let shippingDocumentUrl = null;

      // Upload files if selected (implement your file upload service here)
      if (this.selectedAttachDocument) {
        // attachDocumentUrl = await this.uploadFile(this.selectedAttachDocument);
        // For now, just store the filename
        attachDocumentUrl = this.selectedAttachDocument.name;
      }

      if (this.selectedShippingDocument) {
        // shippingDocumentUrl = await this.uploadFile(this.selectedShippingDocument);
        // For now, just store the filename
        shippingDocumentUrl = this.selectedShippingDocument.name;
      }
      
      formData.items = formData.products.map((product: any) => {
        const foundProduct = this.productsList.find(p => p.id === product.productId);
        return {
          productId: product.productId,
          productName: foundProduct?.productName || 'Unknown Product',
          quantity: product.quantity,
          requiredQuantity: product.quantity,
          unitCost: product.unitCost,
          unitPurchasePrice: product.unitCost,
          unitCostBeforeTax: product.unitCostBeforeTax,
          subtotalBeforeTax: product.subtotalBeforeTax,
          taxPercent: product.taxPercent,
          taxAmount: product.taxAmount,
          netCost: product.netCost,
          
          lineTotal: product.lineTotal,
          currentStock: foundProduct?.currentStock || 0,
          discountType: product.discountType,
          discountPercent: product.discountPercent,
          discountAmount: product.discountAmount
        };
      });

      delete formData.products;

      // Remove File objects and replace with URLs/filenames
      if (attachDocumentUrl) {
        formData.attachDocument = attachDocumentUrl;
      } else {
        delete formData.attachDocument;
      }

      if (shippingDocumentUrl) {
        formData.shippingDetails.shippingDocuments = shippingDocumentUrl;
      } else {
        delete formData.shippingDetails.shippingDocuments;
      }

      formData.updatedAt = new Date().toISOString();
      formData.date = formData.orderDate;
      formData.supplierName = this.getSupplierDisplayName(this.selectedSupplierDetails);
      formData.locationName = formData.businessLocation;
    formData.requiredDate = formData.requiredDate || formData.orderDate;

      formData.totalItems = this.totalItems;
      formData.subTotal = this.productsFormArray.controls.reduce((total, control) => {
        return total + (parseFloat(control.get('subtotalBeforeTax')?.value) || 0);
      }, 0);
      
      formData.totalTax = this.productsFormArray.controls.reduce((total, control) => {
        return total + (parseFloat(control.get('taxAmount')?.value) || 0);
      }, 0);
      
      formData.shippingCharges = parseFloat(this.purchaseOrderForm.get('shippingDetails.shippingChargesAfterTax')?.value) || 0;
      formData.orderTotal = this.netTotalAmount;
      
      await this.orderService.updateOrder(this.orderId, formData);
      
      alert('Purchase Order Updated Successfully!');
      this.router.navigate(['/purchase-order']);
    } catch (error) {
      console.error('Detailed error:', error);
      alert(`Error updating purchase order: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      this.isSaving = false;
      this.purchaseOrderForm.get('referenceNo')?.disable();
    }
  }

  private highlightInvalidFields() {
    const formControls = this.purchaseOrderForm.controls;
    
    Object.keys(formControls).forEach(key => {
      const control = formControls[key];
      if (control.invalid) {
        const element = document.querySelector(`[formcontrolname="${key}"]`);
        if (element) {
          element.classList.add('highlight-mandatory');
          setTimeout(() => {
            element.classList.remove('highlight-mandatory');
          }, 1500);
        }
      }
    });
  }

  private markFormGroupTouched(formGroup: FormGroup) {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();

      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      } else if (control instanceof FormArray) {
        control.controls.forEach(arrayControl => {
          if (arrayControl instanceof FormGroup) {
            this.markFormGroupTouched(arrayControl);
          } else {
            arrayControl.markAsTouched();
          }
        });
      }
    });
  }

  private findFirstInvalidControl(): HTMLElement | null {
    const fieldOrder = [
      'supplier',
      'orderDate',
      'requiredDate',
      'addedBy',
      'businessLocation'
    ];

    for (const key of fieldOrder) {
      const control = this.purchaseOrderForm.get(key);
      if (control?.invalid) {
        const element = document.querySelector(`[formcontrolname="${key}"]`);
        if (element) {
          return element as HTMLElement;
        }
      }
    }
    
    for (const key of Object.keys(this.purchaseOrderForm.controls)) {
      const control = this.purchaseOrderForm.get(key);
      if (control?.invalid) {
        const element = document.querySelector(`[formcontrolname="${key}"]`);
        if (element) {
          return element as HTMLElement;
        }
      }
    }
    
    return null;
  }

  cancelEdit() {
    this.router.navigate(['/purchase-order']);
  }
}