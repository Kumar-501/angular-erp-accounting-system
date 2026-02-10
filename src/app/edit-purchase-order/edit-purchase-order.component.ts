import { Component, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
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
  defaultSellingPriceIncTax?: number;
}


@Component({
  selector: 'app-edit-purchase-order',
  templateUrl: './edit-purchase-order.component.html',
  styleUrls: ['./edit-purchase-order.component.scss']
})
export class EditPurchaseOrderComponent implements OnInit {
  purchaseOrderForm!: FormGroup;
  suppliers: Supplier[] = [];
   @ViewChild('orderDatePicker') orderDatePicker!: ElementRef;
  @ViewChild('requiredDatePicker') requiredDatePicker!: ElementRef;
  @ViewChild('shippingDatePicker') shippingDatePicker!: ElementRef;
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
  selectedShippingDocument: File | null = null;
  selectedAttachDocument: File | null = null;

  constructor(
    private fb: FormBuilder,
    private orderService: PurchaseOrderService,
    private supplierService: SupplierService,
    private locationService: LocationService,
    private productsService: ProductsService,
    private userService: UserService,
    private router: Router,
    private route: ActivatedRoute,
    private taxService: TaxService,
      private cdr: ChangeDetectorRef


  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadInitialData();
    this.setupCalculatedFieldListeners();

    
    // Get order ID from route parameters
    this.route.params.subscribe(params => {
      this.orderId = params['id'];
      if (this.orderId) {
        // Wait for initial data to load before loading order details
        this.waitForInitialDataAndLoadOrder();
      } else {
        this.isLoading = false;
        this.addEmptyProduct();
      }
    });
  }
 getFormattedDateForInput(dateString: any): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  }

  openDatePicker(type: 'order' | 'shipping' | 'required'): void {
    if (type === 'order') this.orderDatePicker.nativeElement.showPicker();
    else if (type === 'shipping') this.shippingDatePicker.nativeElement.showPicker();
    else if (type === 'required') this.requiredDatePicker.nativeElement.showPicker();
  }

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
        
        // Update the reactive form with the YYYY-MM-DD string
        const formattedDate = `${year}-${month}-${day}`;
        this.purchaseOrderForm.get(controlName)?.setValue(formattedDate);
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
    event.target.value = this.getFormattedDateForInput(this.purchaseOrderForm.get(controlName)?.value);
  }
  private async waitForInitialDataAndLoadOrder(): Promise<void> {
    // Wait for all initial data to be loaded
    await Promise.all([
      this.loadSuppliersPromise(),
      this.loadBusinessLocationsPromise(),
      this.loadProductsPromise(),
      this.loadUsersPromise(),
      this.loadTaxRatesPromise()
    ]);
    
    // Now load the order details
    await this.loadOrderDetails(this.orderId);
  }

  private loadInitialData(): void {
    this.loadSuppliers();
    this.loadBusinessLocations();
    this.loadProducts();
    this.loadUsers();
    this.loadTaxRates();
  }

  initForm(): void {
    this.purchaseOrderForm = this.fb.group({
      referenceNo: [{ value: '', disabled: true }],
      orderDate: ['', Validators.required],
      requiredDate: ['', Validators.required],
      shippingDate: [''],
      addedBy: [''],
      supplier: ['', Validators.required],
      address: ['N/A'],
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

    this.filteredSuppliers = [...this.suppliers];
  }

  // Convert load methods to return promises
  private loadSuppliersPromise(): Promise<void> {
    return new Promise((resolve) => {
      this.supplierService.getSuppliers().subscribe({
        next: (suppliers: Supplier[]) => {
          this.suppliers = suppliers;
          this.filteredSuppliers = [...this.suppliers];
          resolve();
        },
        error: (err) => {
          console.error('Error loading suppliers:', err);
          resolve();
        }
      });
    });
  }



  
  private loadBusinessLocationsPromise(): Promise<void> {
    return new Promise((resolve) => {
      this.locationService.getLocations().subscribe({
        next: (locations) => {
          this.businessLocations = locations;
          resolve();
        },
        error: (error) => {
          console.error('Error loading business locations:', error);
          resolve();
        }
      });
    });
  }

  private loadProductsPromise(): Promise<void> {
    return new Promise((resolve) => {
      this.productsService.getProductsRealTime().subscribe({
        next: (products: any[]) => {
          this.productsList = products.map(product => ({
            ...product,
            defaultPurchasePrice: product.purchasePrice || product.sellingPrice || 100,
            currentStock: product.currentStock || 0
          }));
          this.filteredProducts = [...this.productsList];
          resolve();
        },
        error: (err) => {
          console.error('Error loading products:', err);
          resolve();
        }
      });
    });
  }

  private loadUsersPromise(): Promise<void> {
    return new Promise((resolve) => {
      this.userService.getUsers().subscribe({
        next: (users) => {
          this.users = users;
          resolve();
        },
        error: (err) => {
          console.error('Error loading users:', err);
          resolve();
        }
      });
    });
  }
private setupCalculatedFieldListeners(): void {
  this.productsFormArray.controls.forEach((control, index) => {
    // When unitCostBeforeTax changes manually
    control.get('unitCostBeforeTax')?.valueChanges.subscribe(value => {
      if (control.get('unitCostBeforeTax')?.dirty) {
        const unitCostBeforeTax = parseFloat(value) || 0;
        const quantity = parseFloat(control.get('quantity')?.value) || 0;
        const taxPercent = parseFloat(control.get('taxPercent')?.value) || 0;
        
        const taxAmountPerUnit = (unitCostBeforeTax * taxPercent) / 100;
        const netCostPerUnit = unitCostBeforeTax + taxAmountPerUnit;
        const subtotalBeforeTax = unitCostBeforeTax * quantity;
        const taxAmount = taxAmountPerUnit * quantity;
        const lineTotal = netCostPerUnit * quantity;
        
        control.patchValue({
          subtotalBeforeTax: this.roundToTwo(subtotalBeforeTax),
          taxAmount: this.roundToTwo(taxAmount),
          netCost: this.roundToTwo(netCostPerUnit),
          lineTotal: this.roundToTwo(lineTotal)
        }, { emitEvent: false });
        
        this.updateTotals();
      }
    });
    
  });
}
  private loadTaxRatesPromise(): Promise<void> {
    return new Promise((resolve) => {
      this.taxService.getTaxRates().subscribe({
        next: (rates) => {
          this.taxRates = rates;
          this.taxRates.sort((a, b) => a.rate - b.rate);
          resolve();
        },
        error: (err) => {
          console.error('Error loading tax rates:', err);
          resolve();
        }
      });
    });
  }

  // Keep original load methods for backward compatibility
  loadSuppliers(): void {
    this.supplierService.getSuppliers().subscribe((suppliers: Supplier[]) => {
      this.suppliers = suppliers;
      this.filteredSuppliers = [...this.suppliers];
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

  loadTaxRates(): void {
    this.taxService.getTaxRates().subscribe(rates => {
      this.taxRates = rates;
      this.taxRates.sort((a, b) => a.rate - b.rate);
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
  
        // Set supplier information
        if (orderData.supplier) {
          const supplier = this.suppliers.find(s => s.id === orderData.supplier);
          if (supplier) {
            this.selectedSupplierDetails = supplier;
            this.supplierSearchTerm = this.getSupplierDisplayName(supplier);
            
            // =================================================================
            // ### FIX 1: CONSTRUCT THE FULL SUPPLIER ADDRESS ON LOAD ###
            // =================================================================
            const addressParts = [
              supplier.address,
              supplier.addressLine1,
              supplier.addressLine2,
              supplier.city,
              supplier.state,
              'postalCode' in supplier ? supplier.postalCode : supplier.zipCode,
              supplier.country
            ].filter(part => !!part); // Filter out null/undefined/empty parts
            
            const fullAddress = addressParts.join(', ');
  
            this.purchaseOrderForm.patchValue({
              supplier: orderData.supplier,
              // Use the newly constructed full address
              address: fullAddress || orderData.address || 'N/A' 
            });
          }
        }
  
        // Populate basic form data
        this.purchaseOrderForm.patchValue({
          referenceNo: orderData.referenceNo || '',
          orderDate: this.formatDateForInput(orderData.date || orderData.orderDate),
          requiredDate: this.formatDateForInput(orderData.requiredByDate || orderData.requiredDate),
          businessLocation: orderData.businessLocation || orderData.location || '',
          status: orderData.status || 'Pending',
          shippingDate: this.formatDateForInput(orderData.shippingDate),
          additionalNotes: orderData.additionalNotes || ''
        });
  
        // =================================================================
        // ### FIX 2: POPULATE ALL SHIPPING FIELDS FROM orderData ###
        // =================================================================
        if (orderData.shippingDetails) {
          this.purchaseOrderForm.get('shippingDetails')?.patchValue({
            // Existing fields
            shippingDetails: orderData.shippingDetails.shippingDetails || orderData.shippingDetails.note || '',
            shippingAddress: orderData.shippingDetails.shippingAddress || this.buildShippingAddress(),
            shippingStatus: orderData.shippingDetails.shippingStatus || '',
            deliveredTo: orderData.shippingDetails.deliveredTo || '',
            
            // Newly added fields to populate the form correctly
            shippingChargesBeforeTax: orderData.shippingDetails.shippingChargesBeforeTax || 0,
            shippingTaxPercent: orderData.shippingDetails.shippingTaxPercent ?? 18, // Use ?? to handle 0 value correctly
            shippingTaxAmount: orderData.shippingDetails.shippingTaxAmount || 0,
            shippingChargesAfterTax: orderData.shippingDetails.shippingChargesAfterTax || 0
          });
        }
  
        // Add products/items
        const items = orderData.items || orderData.products || [];
        if (items.length > 0) {
          for (const item of items) {
            await this.addProductToForm(item);
          }
        } else {
          this.addEmptyProduct();
        }

        // IMPORTANT: Recalculate all totals after the form is fully populated
        this.updateTotals();

      }
    } catch (error) {
      console.error('Error loading order details:', error);
    } finally {
      this.isLoading = false;
    }
  }


formatDateForInput(dateInput: string | Date | null | undefined | Function): string {
  if (typeof dateInput === 'function') return '';
  if (!dateInput) return '';
  
  try {
    // Handle both string dates and Date objects
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    
    // Check if date is valid
    if (isNaN(date.getTime())) return '';
    
    // Format as YYYY-MM-DD for the date input
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  } catch {
    return '';
  }
}
private async addProductToForm(item: any): Promise<void> {
  const fullProduct = this.productsList.find(p => p.id === item.productId);
  
  // Calculate values with proper defaults
  const unitCost = item.unitCost || item.unitPurchasePrice || 0;
  const quantity = item.quantity || item.requiredQuantity || 1;
  const discountType = item.discountType || 'percent';
  const discountPercent = item.discountPercent || 0;
  const discountAmount = item.discountAmount || 0;
  const taxPercent = item.taxPercent || fullProduct?.taxPercentage || 0;
  
  // Calculate derived values
  const discount = discountType === 'percent' ? (unitCost * discountPercent) / 100 : discountAmount;
  const unitCostBeforeTax = unitCost - discount;
  const subtotalBeforeTax = unitCostBeforeTax * quantity;
  const taxAmount = subtotalBeforeTax * (taxPercent / 100);
  const netCost = unitCostBeforeTax + (unitCostBeforeTax * (taxPercent / 100));
  const lineTotal = netCost * quantity;

  const productFormGroup = this.fb.group({
    productId: [item.productId || '', Validators.required],
    quantity: [quantity, [Validators.required, Validators.min(1)]],
    unitCost: [unitCost, [Validators.required, Validators.min(0)]],
    discountType: [discountType],
    discountPercent: [discountPercent, [Validators.min(0), Validators.max(100)]],
    discountAmount: [discountAmount, [Validators.min(0)]],
    unitCostBeforeTax: [this.roundToTwo(unitCostBeforeTax)],
    subtotalBeforeTax: [this.roundToTwo(subtotalBeforeTax)],
    taxPercent: [taxPercent, [Validators.min(0), Validators.max(100)]],
    taxAmount: [this.roundToTwo(taxAmount)],
    netCost: [this.roundToTwo(netCost)],
    lineTotal: [this.roundToTwo(lineTotal)],
    selected: [false]
  });

  this.productsFormArray.push(productFormGroup);
}

  private buildShippingAddress(): string {
    if (this.selectedSupplierDetails) {
      const supplierName = this.getSupplierDisplayName(this.selectedSupplierDetails);
      const address = this.purchaseOrderForm.get('address')?.value;
      return `${supplierName}\n${address}`;
    }
    return '';
  }



  private roundToTwo(num: number): number {
    return Math.round((num + Number.EPSILON) * 100) / 100;
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

  filterSuppliers(): void {
    if (!this.supplierSearchTerm) {
      this.filteredSuppliers = [...this.suppliers];
      return;
    }

    const searchTerm = this.supplierSearchTerm.toLowerCase();
    this.filteredSuppliers = this.suppliers.filter(supplier => {
      const name = this.getSupplierDisplayName(supplier).toLowerCase();
      const businessName = supplier.businessName?.toLowerCase() || '';
      return name.includes(searchTerm) || businessName.includes(searchTerm);
    });
  }

  selectSupplier(supplier: Supplier): void {
    this.purchaseOrderForm.get('supplier')?.setValue(supplier.id);
    this.supplierSearchTerm = this.getSupplierDisplayName(supplier);
    this.showSupplierDropdown = false;
    this.selectedSupplierDetails = supplier;
    
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
      address: fullAddress || 'N/A',
      shippingDetails: {
        shippingAddress: `${this.getSupplierDisplayName(supplier)}\n${fullAddress}`
      }
    });
    
    this.onSupplierChange();
  }

  onSupplierFocus() {
    this.showSupplierDropdown = true;
    if (!this.supplierSearchTerm) {
      this.filteredSuppliers = [...this.suppliers];
    }
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
calculateLineTotal(index: number): void {
  const productFormGroup = this.productsFormArray.at(index) as FormGroup;
  
  const quantity = parseFloat(productFormGroup.get('quantity')?.value) || 0;
  const unitCost = parseFloat(productFormGroup.get('unitCost')?.value) || 0;
  const discountType = productFormGroup.get('discountType')?.value;
  const discountPercent = parseFloat(productFormGroup.get('discountPercent')?.value) || 0;
  const discountAmount = parseFloat(productFormGroup.get('discountAmount')?.value) || 0;
  const taxPercent = parseFloat(productFormGroup.get('taxPercent')?.value) || 0;
  
  // Calculate discount
  const discount = discountType === 'percent' ? 
    (unitCost * discountPercent) / 100 : 
    discountAmount;

  // Calculate values
  const unitCostBeforeTax = unitCost - discount;
  const subtotalBeforeTax = unitCostBeforeTax * quantity;
  const taxAmount = subtotalBeforeTax * (taxPercent / 100);
  const netCost = unitCostBeforeTax + (unitCostBeforeTax * (taxPercent / 100));
  const lineTotal = netCost * quantity;

  // Update form values
  productFormGroup.patchValue({
    unitCostBeforeTax: this.roundToTwo(unitCostBeforeTax),
    subtotalBeforeTax: this.roundToTwo(subtotalBeforeTax),
    taxAmount: this.roundToTwo(taxAmount),
    netCost: this.roundToTwo(netCost),
    lineTotal: this.roundToTwo(lineTotal)
  }, { emitEvent: false });
  
  this.updateTotals();
}

updateTotals(): void {
  // Calculate total items
  this.totalItems = this.productsFormArray.controls.reduce((total, control) => {
    return total + (parseInt(control.get('quantity')?.value) || 0);
  }, 0);
  
  // Calculate net total amount from products
  let productsTotal = this.productsFormArray.controls.reduce((total, control) => {
    return total + (parseFloat(control.get('lineTotal')?.value) || 0);
  }, 0);
  
  // Get shipping charges after tax from the form
  const shippingCharges = parseFloat(
    this.purchaseOrderForm.get('shippingDetails.shippingChargesAfterTax')?.value
  ) || 0;
  
  // Final total amount
  this.netTotalAmount = productsTotal + shippingCharges;
}


  calculateShippingTax(calculationType: 'before' | 'after' | 'both' = 'both'): void {
    const shippingDetails = this.purchaseOrderForm.get('shippingDetails') as FormGroup;
    
    const beforeTaxCtrl = shippingDetails.get('shippingChargesBeforeTax');
    const afterTaxCtrl = shippingDetails.get('shippingChargesAfterTax');
    const taxPercentCtrl = shippingDetails.get('shippingTaxPercent');
    const taxAmountCtrl = shippingDetails.get('shippingTaxAmount');
    
    if (!beforeTaxCtrl || !afterTaxCtrl || !taxPercentCtrl || !taxAmountCtrl) return;

    if (calculationType === 'before') {
      this.lastEditedShippingField = 'before';
    } else if (calculationType === 'after') {
      this.lastEditedShippingField = 'after';
    }

    const taxPercent = parseFloat(taxPercentCtrl.value) || 0;
    
    if (calculationType === 'before' || (calculationType === 'both' && this.lastEditedShippingField === 'before')) {
      const beforeTax = parseFloat(beforeTaxCtrl.value) || 0;
      const taxAmount = beforeTax * (taxPercent / 100);
      const afterTax = beforeTax + taxAmount;
      
      afterTaxCtrl.setValue(afterTax.toFixed(2), { emitEvent: false });
      taxAmountCtrl.setValue(taxAmount.toFixed(2), { emitEvent: false });
    }
    else if (calculationType === 'after' || (calculationType === 'both' && this.lastEditedShippingField === 'after')) {
      const afterTax = parseFloat(afterTaxCtrl.value) || 0;
      
      if (taxPercent > 0) {
        const beforeTax = afterTax / (1 + (taxPercent / 100));
        const taxAmount = afterTax - beforeTax;
        
        beforeTaxCtrl.setValue(beforeTax.toFixed(2), { emitEvent: false });
        taxAmountCtrl.setValue(taxAmount.toFixed(2), { emitEvent: false });
      } else {
        beforeTaxCtrl.setValue(afterTax.toFixed(2), { emitEvent: false });
        taxAmountCtrl.setValue(0, { emitEvent: false });
      }
    }
    
    this.updateTotals();
  }

  getTaxName(rate: number): string {
    const tax = this.taxRates.find(t => t.rate === rate);
    return tax ? tax.name : 'No Tax';
  }

  onFileChange(event: any, fieldName: string) {
    const file = event.target.files[0];
    if (file && file.size <= 5 * 1024 * 1024) {
      const allowedExtensions = ['.pdf', '.csv', '.zip', '.doc', '.docx', '.jpeg', '.jpg', '.png'];
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      
      if (allowedExtensions.includes(fileExtension)) {
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
      
      // Handle file uploads separately
      let attachDocumentUrl = null;
      let shippingDocumentUrl = null;

      if (this.selectedAttachDocument) {
        attachDocumentUrl = this.selectedAttachDocument.name;
      }

      if (this.selectedShippingDocument) {
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

      if (!formData.address) {
        formData.address = 'N/A';
      }

      formData.updatedAt = new Date().toISOString();
      formData.date = formData.orderDate;
      formData.supplierName = this.getSupplierDisplayName(this.selectedSupplierDetails);
      formData.locationName = formData.businessLocation;
      formData.requiredDate = formData.requiredDate || formData.orderDate;
      formData.shippingDate = formData.shippingDate;

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

  onAddressInput(event: Event) {
    const inputElement = event.target as HTMLInputElement;
    this.purchaseOrderForm.get('address')?.setValue(inputElement.value);
  }

  getDisplayAddress(): string {
    const address = this.purchaseOrderForm.get('address')?.value;
    return address && address.trim() !== '' ? address : 'N/A';
  }

  cancelEdit() {
    this.router.navigate(['/purchase-order']);
  }
}