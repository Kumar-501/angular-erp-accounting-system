import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { PurchaseService } from '../services/purchase.service';
import { Router, ActivatedRoute } from '@angular/router';
import { SupplierService } from '../services/supplier.service';
import { LocationService } from '../services/location.service';
import { ProductsService } from '../services/products.service';
import { PurchaseOrderService } from '../services/purchase-order.service';
import { PurchaseOrder } from '../services/purchase-order.service';
import { AuthService } from '../auth.service';
import { UserService } from '../services/user.service';
import { TaxService } from '../services/tax.service';
import { TaxRate } from '../tax/tax.model';
import { AccountService } from '../services/account.service';
import { PurchaseRequisitionService } from '../services/purchase-requisition.service';

import { Supplier } from '../models/supplier.model'; // Keep this import
interface PaymentAccount {
  id: string;
  name: string;
  accountNumber?: string;
  accountType?: string;
}
// src/app/models/supplier.model.ts


interface Product {
  id?: string;
  productId?: string;
  productName: string;
  sku: string;
  hsnCode: string;
  barcode?: string;
  unit: string;
  quantity: number;
  unitCost: number;
  discountPercent: number;
    totalQuantity?: number; // Add this
  stockByLocation?: { [locationId: string]: number }; 
  unitCostBeforeTax: number;
  subtotal: number;
  batchNumber?: string;  // This is the key addition
  expiryDate: string;
  taxAmount: number;
  lineTotal: number;
  netCost: number;

  cgst?: number;
  sgst?: number;
  igst?: number;
  isInterState?: boolean;

  productTax: number;
  profitMargin: number;
  sellingPrice: number;
  taxRate?: number;
  commissionPercent?: number;
  commissionAmount?: number;
  currentStock: number;
  weight?: number;
  length?: number;
  breadth?: number;
  height?: number;
  category?: string;
  subCategory?: string;
  unitPurchasePrice?: number;
  defaultPurchasePrice?: number;
  defaultPurchasePriceExcTax?: number;
  defaultPurchasePriceIncTax?: number;
  defaultSellingPriceIncTax?: number;
  defaultSellingPriceExcTax?: number;
  unitSellingPrice?: number;
  taxPercentage?: number;
}
interface PaymentAccount {
  id: string;
  name: string;
  accountNumber?: string;
  accountType?: string;
}




@Component({
  selector: 'app-add-purchase',
  templateUrl: './add-purchase.component.html',
  styleUrls: ['./add-purchase.component.scss']
})
export class AddPurchaseComponent implements OnInit {
[x: string]: any;
  purchaseForm!: FormGroup;
  suppliers: Supplier[] = [];
  discountTypes: ('percent' | 'amount')[] = [];
  requisitions: any[] = [];
  selectedRequisition: any = null;
  purchaseOrders: any[] = [];
  requisitionData: any = null;
filteredPurchaseOrders: any[] = [];
  businessLocations: any[] = [];
  filteredSuppliers: Supplier[] = [];
  selectedSupplier: Supplier | null = null;
  totalItems = 0;
  netTotalAmount = 0;

// Add these properties to your AddPurchaseComponent class
searchTerm: string = '';
searchResults: Product[] = [];
showSearchResults: boolean = false;
  productSearchText: string = '';
searchedProducts: any[] = [];
showProductDropdown: boolean = false;
  totalTax = 0;
  batchList = ["BATCH001", "BATCH002", "BATCH003"]; // Your predefined options
isReadonly = true; // Set to false if users should select
  paymentAccounts: any[] = [];
  selectedProducts: Set<number> = new Set<number>();
  taxRates: TaxRate[] = [];
  users: any[] = [];
  productsList: any[] = [];
  purchaseOrderId: string | null = null;
  purchaseOrderData: any = null;
  isLoadingFromPurchaseOrder = false;
  currentUser: any = null;
  taxRatesList: TaxRate[] = [];
  additionalTaxAmount = 0;

  constructor(
    private fb: FormBuilder,
    private purchaseService: PurchaseService,
    private supplierService: SupplierService,
    private locationService: LocationService,
    private router: Router,
    private productsService: ProductsService,
    private route: ActivatedRoute,
    private purchaseOrderService: PurchaseOrderService,
    private authService: AuthService,
    private userService: UserService,
    private taxService: TaxService,
    private accountService: AccountService,
    private purchaseRequisitionService: PurchaseRequisitionService
  ) {}
// In add-purchase.component.ts
ngOnInit(): void {
  this.initForm();
  this.loadSuppliers();
  this.loadBusinessLocations();
  this.loadProducts();
  this.getCurrentUser();
  this.loadUsers();
  this.loadTaxRates();
  this.loadPurchaseOrders();
  this.loadPaymentAccounts();

  this.route.queryParams.subscribe(params => {
    const requisitionId = params['requisitionId'];
    const orderId = params['orderId'];
    const supplierId = params['supplierId'];
    const fromSupplier = params['fromSupplier'];
    const supplierName = params['supplierName'];
    const supplierAddress = params['supplierAddress'];
    
    if (requisitionId) {
      this.loadRequisitionData(requisitionId);
    } else if (orderId) {
      this.purchaseOrderId = orderId;
      this.isLoadingFromPurchaseOrder = true;
      this.loadPurchaseOrderData(orderId);
    } else if (fromSupplier && supplierId) {
      // Handle supplier details from query params
      this.purchaseForm.patchValue({
        supplierId: supplierId,
        supplierName: supplierName,
        address: supplierAddress
      });
      
      // Try to find the supplier in the loaded suppliers list
      const foundSupplier = this.suppliers.find(s => s.id === supplierId);
      if (foundSupplier) {
        this.selectedSupplier = foundSupplier;
      } else {
        // If supplier not found in the list, load it separately
        this.loadSupplierData(supplierId);
      }
      
      this.generateReferenceNumber();
      this.generateInvoiceNumber();
    } else {
      this.generateReferenceNumber();
      this.generateInvoiceNumber();
        this.updatePurchaseOrderDropdownState();

    }
  });
}

// Add this method to load supplier data if not found in the list
async loadSupplierData(supplierId: string) {
  try {
    const supplier = await this.supplierService.getSupplierById(supplierId).toPromise();
    if (supplier) {
      this.selectedSupplier = supplier;
      this.purchaseForm.patchValue({
        supplierId: supplier.id,
        supplierName: this.getSupplierDisplayName(supplier),
        address: supplier.addressLine1 || ''
      });
    }
  } catch (error) {
    console.error('Error loading supplier:', error);
  }
}

// Add this method to load supplier data

onSearchInput(event: any): void {
  this.searchTerm = event.target.value;
  
  if (this.searchTerm.length > 1) {
    this.searchResults = this.productsList.filter(product => 
      product.productName.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
      (product.sku && product.sku.toLowerCase().includes(this.searchTerm.toLowerCase())) ||
      (product.barcode && product.barcode.toLowerCase().includes(this.searchTerm.toLowerCase()))
    );
    this.showSearchResults = true;
  } else {
    this.searchResults = [];
    this.showSearchResults = false;
  }
}handleKeyDown(event: KeyboardEvent): void {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    // Handle arrow key navigation through search results
    const buttons = document.querySelectorAll('.search-results-dropdown .list-group-item-action');
    if (buttons.length > 0) {
      const currentFocus = document.activeElement;
      let currentIndex = Array.from(buttons).indexOf(currentFocus as Element);
      
      if (event.key === 'ArrowDown') {
        currentIndex = currentIndex < buttons.length - 1 ? currentIndex + 1 : 0;
      } else {
        currentIndex = currentIndex > 0 ? currentIndex - 1 : buttons.length - 1;
      }
      
      (buttons[currentIndex] as HTMLElement).focus();
    }
  } else if (event.key === 'Escape') {
    this.clearSearch();
  }
}
// Add this new method to load supplier data
clearSupplier(): void {
  this.selectedSupplier = null;
  this.purchaseForm.patchValue({
    supplierId: '',
    supplierName: '',
    address: ''
  });
  
  // Update the purchase order dropdown state
  this.updatePurchaseOrderDropdownState();
}
onSearchFocus(): void {
  if (this.searchTerm.length > 1) {
    this.showSearchResults = true;
  }
}

onSearchBlur(): void {
  // Delay hiding to allow for click events on search results
  setTimeout(() => {
    this.showSearchResults = false;
  }, 150);
}
addProductFromSearch(product: Product): void {
  // Check if product is already added
  const existingProductIndex = this.productsFormArray.controls.findIndex(
    control => control.get('productId')?.value === product.id
  );

  if (existingProductIndex >= 0) {
    // If product exists, increase quantity
    const existingProduct = this.productsFormArray.at(existingProductIndex);
    const currentQuantity = existingProduct.get('quantity')?.value || 0;
    existingProduct.get('quantity')?.setValue(currentQuantity + 1);
    this.calculateLineTotal(existingProductIndex);
  } else {
    // Add new product with all necessary data including stock
    const productToAdd = {
      ...product,
      currentStock: product.currentStock || product.totalQuantity || 0 // Use totalQuantity if currentStock not available
    };
    this.addProductToTable(productToAdd);
  }

  // Clear search
  this.clearSearch();
}

highlightMatch(text: string, searchTerm: string): string {
  if (!text || !searchTerm) return text || '';
  
  const regex = new RegExp(`(${searchTerm})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

clearSearch(): void {
  this.searchTerm = '';
  this.searchResults = [];
  this.showSearchResults = false;
}

  onDiscountTypeChange(index: number): void {
    this.calculateLineTotal(index);
  }
searchProducts(): void {
  if (this.productSearchText.length > 1) {
    this.searchedProducts = this.productsList.filter(product => 
      product.productName.toLowerCase().includes(this.productSearchText.toLowerCase()) ||
      product.sku.toLowerCase().includes(this.productSearchText.toLowerCase())
    );
    this.showProductDropdown = true;
  } else {
    this.searchedProducts = [];
    this.showProductDropdown = false;
  }
}

selectProduct(product: any): void {
  // Add the selected product to the form array
  this.addProductToTable(product);
  
  // Reset search
  this.productSearchText = '';
  this.searchedProducts = [];
  this.showProductDropdown = false;
}

// Update the existing addProductToTable method to handle the Product interface properly
addProductToTable(product: Product): void {
  const productGroup = this.fb.group({
    productId: [product.id || product.productId, Validators.required],
    productName: [product.productName],
    quantity: [1, [Validators.required, Validators.min(1)]],
    unitCost: [product.defaultPurchasePriceIncTax || 
              product.unitPurchasePrice || 
              product.unitCost || 0, 
              [Validators.required, Validators.min(0)]],
    discountPercent: [0, [Validators.min(0), Validators.max(100)]],
    unitCostBeforeTax: [product.defaultPurchasePriceExcTax || 
                       product.unitCost || 0],
    subtotal: [0],
    lineTotal: [0],
    taxRate: [product.taxPercentage || product.taxRate || 0], // Initialize with product's tax rate
    taxAmount: [0],
    batchNumber: [product.batchNumber || ''],
    expiryDate: [product.expiryDate || ''],
    netCost: [0],
    currentStock: [product.currentStock || product.totalQuantity || 0]
  });

  this.productsFormArray.push(productGroup);
  this.calculateLineTotal(this.productsFormArray.length - 1);
}

  onPurchaseOrderSelect(orderId: string): void {
    if (orderId) {
      this.purchaseOrderId = orderId;
      this.isLoadingFromPurchaseOrder = true;
      this.loadPurchaseOrderData(orderId);
    } else {
      this.purchaseOrderId = null;
      this.isLoadingFromPurchaseOrder = false;
      this.generateReferenceNumber();
      this.generateInvoiceNumber();

    }
  }

loadPurchaseOrders(): void {
  this.purchaseOrderService.getOrders().subscribe(orders => {
    // Filter out completed orders and orders that have already been used
    this.purchaseOrders = orders.filter((order: any) => 
      order.status !== 'Completed' && !order.isUsedForPurchase
    );
    
    this.filteredPurchaseOrders = [...this.purchaseOrders]; // Initialize filtered list
    
    // If coming from a purchase order, filter for that supplier
    if (this.purchaseOrderId) {
      const selectedOrder = this.purchaseOrders.find(o => o.id === this.purchaseOrderId);
      if (selectedOrder) {
        this.filterPurchaseOrders(selectedOrder.supplierId || selectedOrder.supplier);
      }
    }
  });
}


  async loadRequisitionData(requisitionId: string) {
    try {
      const requisition = await this.purchaseRequisitionService.getRequisitionById(requisitionId).toPromise();
      this.requisitionData = requisition;
      this.prefillFormFromRequisition(requisition);
    } catch (error) {
      console.error('Error loading requisition:', error);
      this.generateReferenceNumber();
      this.generateInvoiceNumber();
    }
  }

  prefillFormFromRequisition(requisition: any) {
    this.purchaseForm.patchValue({
      referenceNo: requisition.referenceNo || '',
      businessLocation: requisition.location || '',
      additionalNotes: `Created from Requisition: ${requisition.referenceNo}`,
      purchaseDate: new Date().toISOString().substring(0, 10)
    });

    if (requisition.items && requisition.items.length > 0) {
      this.productsFormArray.clear();
      requisition.items.forEach((item: any) => {
        this.addProductFromRequisition(item);
      });
    }
    this.calculateTotals();
  }
updatePurchaseOrderDropdownState(): void {
  const purchaseOrderControl = this.purchaseForm.get('purchaseOrderId');
  if (this.selectedSupplier) {
    purchaseOrderControl?.enable();
  } else {
    purchaseOrderControl?.disable();
    purchaseOrderControl?.setValue(''); // Clear the value when disabled
  }
}
  updateTotals(): void {
    this.totalItems = this.productsFormArray.length;
    
    let productsTotal = 0;
    let productsTax = 0;

    this.productsFormArray.controls.forEach(productGroup => {
      productsTotal += (parseFloat(productGroup.get('lineTotal')?.value) || 0);
      productsTax += (parseFloat(productGroup.get('taxAmount')?.value) || 0);
    });

    this.netTotalAmount = productsTotal;
    this.totalTax = productsTax;

    this.purchaseForm.patchValue({
      purchaseTotal: this.netTotalAmount,
      totalPayable: this.netTotalAmount
    });

    this.calculatePaymentBalance();
  }

  addProductFromRequisition(item: any) {
    const productGroup = this.fb.group({
      productId: [item.productId || ''],
      productName: [item.productName || '', Validators.required],
      quantity: [item.requiredQuantity || 1, [Validators.required, Validators.min(1)]],
      unitCost: [0, [Validators.required, Validators.min(0)]],
      discountPercent: [0, [Validators.min(0), Validators.max(100)]],
      unitCostBeforeTax: [{value: 0, disabled: true}],
      netCost: [{value: 0, disabled: true}],
      productTax: [{value: 0, disabled: true}],
      subtotal: [{value: 0, disabled: true}],
      taxAmount: [{value: 0, disabled: true}],
      lineTotal: [{value: 0, disabled: true}],
      profitMargin: [0, [Validators.min(0)]],
      sellingPrice: [{value: 0, disabled: true}],
      batchNumber: [''],
      expiryDate: [''],
      taxRate: [0],
      commissionPercent: [0, [Validators.min(0), Validators.max(100)]],
      commissionAmount: [{value: 0, disabled: true}]
    });
    this.productsFormArray.push(productGroup);
  }

  loadTaxRates(): void {
    this.taxService.getTaxRates().subscribe(rates => {
      this.taxRates = rates;

    

      this.taxRates.sort((a, b) => a.rate - b.rate);
    });
  }

  loadPaymentAccounts(): void {
    this.accountService.getAccounts((accounts: any[]) => {
      this.paymentAccounts = accounts;
    });
  }

  loadUsers(): void {
    this.userService.getUsers().subscribe(users => {
      this.users = users;
    });
  }

  getTotalSubtotalBeforeTax(): number {
    let total = 0;
    this.productsFormArray.controls.forEach(productGroup => {
      total += (parseFloat(productGroup.get('subtotalBeforeTax')?.value) || 0);
    });
    return total;
  }

  getCommissionAmount(index: number): number {
    const productGroup = this.productsFormArray.at(index);
    const subtotal = parseFloat(productGroup.get('subtotal')?.value) || 0;
    const commissionPercent = parseFloat(productGroup.get('commissionPercent')?.value) || 0;
    return subtotal * (commissionPercent / 100);
  }

  getSubtotal(index: number): number {
    const productGroup = this.productsFormArray.at(index);
    return parseFloat(productGroup.get('subtotal')?.value) || 0;
  }

  get totalCommission(): number {
    let total = 0;
    for (let i = 0; i < this.productsFormArray.length; i++) {
      total += this.getCommissionAmount(i);
    }
    return total;
  }
// In onSupplierChange:
onSupplierChange(supplierId: string): void {
  const selectedSupplier = this.suppliers.find(s => s.id === supplierId);
  if (selectedSupplier) {
    this.selectedSupplier = selectedSupplier;
    this.purchaseForm.patchValue({
      supplierName: this.getSupplierDisplayName(selectedSupplier),
      address: selectedSupplier.addressLine1 || ''
    });
    this.filterPurchaseOrders(supplierId);
  }
}
filterPurchaseOrders(supplierIdentifier: string): void {
  if (!supplierIdentifier) {
    this.filteredPurchaseOrders = [...this.purchaseOrders];
    return;
  }

  this.filteredPurchaseOrders = this.purchaseOrders.filter(order => {
    // Match by supplier ID or name
    return order.supplierId === supplierIdentifier || 
           order.supplier === supplierIdentifier ||
           (this.selectedSupplier && 
            (order.supplier === this.getSupplierDisplayName(this.selectedSupplier)));
  });
}


  toggleProductSelection(index: number): void {
    if (this.selectedProducts.has(index)) {
      this.selectedProducts.delete(index);
    } else {
      this.selectedProducts.add(index);
    }
  }

  isProductSelected(index: number): boolean {
    return this.selectedProducts.has(index);
  }

  deleteSelectedProducts(): void {
    if (this.selectedProducts.size === 0) {
      alert('Please select at least one product to delete');
      return;
    }
  
    if (confirm(`Are you sure you want to delete ${this.selectedProducts.size} selected products?`)) {
      const indexesToDelete = Array.from(this.selectedProducts).sort((a, b) => b - a);
      
      indexesToDelete.forEach(index => {
        this.productsFormArray.removeAt(index);
      });
      
      this.selectedProducts.clear();
      this.calculateTotals();
    }
  }  

  toggleSelectAll(event: any): void {
    const isChecked = event.target.checked;
    
    if (isChecked) {
      this.productsFormArray.controls.forEach((_, index) => {
        this.selectedProducts.add(index);
      });
    } else {
      this.selectedProducts.clear();
    }
  }

  getCurrentUser(): void {
    this.authService.getCurrentUser().subscribe(user => {
      this.currentUser = user;
      if (user) {
        this.purchaseForm.patchValue({
          addedBy: {
            id: user.uid,
            name: user.displayName || user.email,
            email: user.email
          },
          assignedTo: user.uid
        });
      }
    });
  }
async loadPurchaseOrderData(orderId: string): Promise<void> {
  try {
    const orderData = await this.purchaseOrderService.getOrderById(orderId);
    if (orderData) {
      this.purchaseOrderData = orderData;
      this.prefillFormFromPurchaseOrder(orderData);
      
      // Set the purchase order ID in the form
      this.purchaseForm.patchValue({
        purchaseOrderId: orderId,
        purchaseOrder: orderData.referenceNo,
        shippingCharges: orderData.shippingCharges || 0,
        supplierName: orderData.supplier,
        // Add the required by date from the purchase order
        receivedDate: orderData.requiredByDate || ''
      });
    }
  } catch (error) {
    console.error('Error loading purchase order:', error);
    this.generateReferenceNumber();
    this.generateInvoiceNumber();
  }
}

// Updated method to fetch complete product details and tax rates
async addProductFromPurchaseOrder(product: any): Promise<void> {
  try {
    // Fetch complete product details from the products service
    const completeProduct = await this.productsService.getProductById(product.id || product.productId);
    
    // Use the complete product data if available, otherwise fall back to purchase order data
    const taxRate = completeProduct?.taxPercentage || completeProduct?.taxPercentage || product.taxRate || 0;
    const unitCost = product.unitCost || product.unitPrice || completeProduct?.defaultPurchasePriceIncTax || 0;
    
    const productGroup = this.fb.group({
      productId: [product.id || product.productId || ''],
      productName: [product.productName || completeProduct?.productName || '', Validators.required],
      quantity: [product.quantity || 1, [Validators.required, Validators.min(1)]],
      unitCost: [unitCost, [Validators.required, Validators.min(0)]],
      discountPercent: [product.discountPercent || 0, [Validators.min(0), Validators.max(100)]],
      unitCostBeforeTax: [{value: unitCost, disabled: true}],
      netCost: [{value: 0, disabled: true}],
      productTax: [{value: 0, disabled: true}],
      subtotal: [{value: 0, disabled: true}],
      taxAmount: [{value: 0, disabled: true}],
      lineTotal: [{value: 0, disabled: true}],
      profitMargin: [product.profitMargin || completeProduct?.marginPercentage || 0, [Validators.min(0)]],
      sellingPrice: [{value: 0, disabled: true}],
      batchNumber: [product.batchNumber || completeProduct?.batchNumber || ''],
      expiryDate: [product.expiryDate || completeProduct?.expiryDate || ''],
      taxRate: [taxRate], // Use the fetched tax rate
      commissionPercent: [product.commissionPercent || 0, [Validators.min(0), Validators.max(100)]],
      commissionAmount: [{value: 0, disabled: true}],
      currentStock: [completeProduct?.currentStock || 0]
    });

    this.productsFormArray.push(productGroup);
    this.calculateLineTotal(this.productsFormArray.length - 1);
    
  } catch (error) {
    console.error('Error loading complete product details:', error);
    
    // Fallback to original method if product details can't be fetched
    const productGroup = this.fb.group({
      productId: [product.id || product.productId || ''],
      productName: [product.productName || '', Validators.required],
      quantity: [product.quantity || 1, [Validators.required, Validators.min(1)]],
      unitCost: [product.unitCost || product.unitPrice || 0, [Validators.required, Validators.min(0)]],
      discountPercent: [product.discountPercent || 0, [Validators.min(0), Validators.max(100)]],
      unitCostBeforeTax: [{value: product.unitCost || 0, disabled: true}],
      netCost: [{value: 0, disabled: true}],
      productTax: [{value: 0, disabled: true}],
      subtotal: [{value: 0, disabled: true}],
      taxAmount: [{value: 0, disabled: true}],
      lineTotal: [{value: 0, disabled: true}],
      profitMargin: [product.profitMargin || 0, [Validators.min(0)]],
      sellingPrice: [{value: 0, disabled: true}],
      batchNumber: [product.batchNumber || ''],
      expiryDate: [product.expiryDate || ''],
      taxRate: [product.taxRate || 0],
      commissionPercent: [product.commissionPercent || 0, [Validators.min(0), Validators.max(100)]],
      commissionAmount: [{value: 0, disabled: true}]
    });

    this.productsFormArray.push(productGroup);
    this.calculateLineTotal(this.productsFormArray.length - 1);
  }
}

async prefillFormFromPurchaseOrder(orderData: any): Promise<void> {
  const supplierId = orderData.supplierId || '';
  
  this.purchaseForm.patchValue({
    supplierId: supplierId,
    supplierName: orderData.supplier || '',
    purchaseOrder: orderData.referenceNo || '',
    referenceNo: orderData.referenceNo || '',
    businessLocation: orderData.businessLocation || '',
    additionalNotes: orderData.notes || '',
    shippingCharges: orderData.shippingCharges || 0,
    invoicedDate: orderData.invoicedDate || '',
    receivedDate: orderData.requiredByDate || '',
    invoiceNo: orderData.invoiceNo || '',
    purchaseTaxId: orderData.purchaseTaxId || ''
  });
  this.purchaseForm.patchValue({
    shippingCharges: orderData.shippingCharges || 0
  });
  this.purchaseForm.get('referenceNo')?.enable();
  
  // Clear existing products
  while (this.productsFormArray.length !== 0) {
    this.productsFormArray.removeAt(0);
  }
  
  if (orderData.products && orderData.products.length > 0) {
    // Process products sequentially to ensure proper loading
    for (const product of orderData.products) {
      await this.addProductFromPurchaseOrder(product);
    }
  } else {
    this.addProduct();
  }
  
  if (supplierId) {
    this.onSupplierChange(supplierId);
  }
  
  // Force recalculation of totals after loading all products
  setTimeout(() => {
    this.calculateTotals();
  }, 100);
}

  navigateToAddSupplier(): void {
    this.router.navigate(['/suppliers']);
  }

addProduct(): void {
  const productGroup = this.fb.group({
    productId: ['', Validators.required],
    productName: [''],
    quantity: [1, [Validators.required, Validators.min(1)]],
    unitCost: [0, [Validators.required, Validators.min(0.01)]],
    discountPercent: [0, [Validators.min(0), Validators.max(100)]],
    unitCostBeforeTax: [0],
    subtotal: [0],
    lineTotal: [0],
    netCost: [0],
    taxRate: [0],
    taxAmount: [0],
    batchNumber: [''],
    expiryDate: ['']
  });

  this.productsFormArray.push(productGroup);
}

  loadProducts(): void {
    this.productsService.getProductsRealTime().subscribe((products: any[]) => {
      this.productsList = products.map(product => ({
        ...product,
        defaultPurchasePriceExcTax: product.defaultPurchasePriceExcTax || 0,
        defaultSellingPriceExcTax: product.defaultSellingPriceExcTax || 0,
        marginPercentage: product.marginPercentage || 0,
        applicableTax: product.applicableTax || { percentage: 0 },
        batchNumber: product.batchNumber || '',
        expiryDate: product.expiryDate || ''
      }));
    });
  }

 initForm(): void {
  this.purchaseForm = this.fb.group({
    address: [''],
    supplierId: ['',], // Add this line

    referenceNo: [{value: '', disabled: true}, Validators.required],
    purchaseDate: [new Date().toISOString().substring(0, 10), Validators.required],
    purchaseStatus: ['Received', Validators.required],
    businessLocation: ['', Validators.required],
    payTerm: [''],
        paymentStatus: ['due'], // Add this line for payment status

    purchaseOrder: [''],
    purchaseOrderId: [''],
    document: [null],
    supplierName: ['',],
    discountType: [''],
    discountAmount: [0],
    additionalNotes: [''],
    shippingCharges: [0, [Validators.min(0)]],
    products: this.fb.array([], Validators.required), // Add validation for at least one product
    purchaseTotal: [0],
    paymentAmount: [0, [Validators.required, Validators.min(0.0)]], // Initialize with 0
    paidOn: [new Date().toISOString().substring(0, 10), Validators.required],
    paymentMethod: ['', Validators.required],
    paymentAccount: ['', Validators.required], // Make payment account required
    paymentNote: [''],
    balance: [0],
    totalPayable: [0],
    roundedTotal: [0],
    addedBy: this.fb.group({
      id: [''],
      name: [''],
      email: ['']
    }),
    invoiceNo: [''],
    invoicedDate: [''],
    receivedDate: ['']
  });

  // Add initial product with validation
   this.addProduct();
   
}

  generateInvoiceNumber(): void {
    const randomNumber = Math.floor(100000 + Math.random() * 900000);
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const invNumber = `INV-${year}${month}${day}-${randomNumber}`;
    this.purchaseForm.get('invoiceNo')?.setValue(invNumber);
  }

calculatePaymentBalance(): void {
  const totalPayable = this.purchaseForm.get('totalPayable')?.value || 0;
  const paymentAmount = this.purchaseForm.get('paymentAmount')?.value || 0;
  
  const balance = Math.max(0, totalPayable - paymentAmount);
  
  // Determine payment status based on amounts
  let paymentStatus = 'due';
  if (paymentAmount >= totalPayable) {
    paymentStatus = 'paid';
  } else if (paymentAmount > 0) {
    paymentStatus = 'partial';
  }
  
  this.purchaseForm.patchValue({
    balance: balance,
    paymentStatus: paymentStatus
  });
}

  get productsFormArray(): FormArray {
    return this.purchaseForm.get('products') as FormArray;
  }

  getNetCost(index: number): number {
    const productGroup = this.productsFormArray.at(index);
    const quantity = productGroup.get('quantity')?.value || 0;
    const unitCost = productGroup.get('unitCost')?.value || 0;
    const discountPercent = productGroup.get('discountPercent')?.value || 0;
    
    const grossAmount = quantity * unitCost;
    const discountAmount = grossAmount * (discountPercent / 100);
    return grossAmount - discountAmount;
  }
async onProductSelect(index: number) {
  const productFormGroup = this.productsFormArray.at(index);
  const productId = productFormGroup.get('productId')?.value;
  
  if (productId) {
    try {
      const product = await this.productsService.getProductById(productId);
      if (product) {
        // Set the tax rate from the product data
        const taxRate = product.taxPercentage || 0;
        
        productFormGroup.patchValue({
          productName: product.productName,
          sku: product.sku,
          hsnCode: product.hsnCode,
          unit: product.unit,
          unitCost: product.defaultPurchasePriceIncTax || 
                   product.defaultPurchasePriceExcTax || 
                   product.unitPurchasePrice || 
                   0,
          sellingPrice: product.defaultSellingPriceIncTax || 
                      product.unitSellingPrice || 
                      0,
          currentStock: product.currentStock || 0,
          taxRate: taxRate, // Set the tax rate here
          unitCostBeforeTax: product.defaultPurchasePriceExcTax || 0,
          batchNumber: product.batchNumber || '',
          expiryDate: product.expiryDate || ''
        });

        // If the product has a tax rate, find the corresponding tax rate object
        if (taxRate > 0) {
          const selectedTax = this.taxRates.find(t => t.rate === taxRate);
          if (selectedTax) {
            productFormGroup.get('taxRate')?.setValue(selectedTax.rate);
          }
        }

        if (product.defaultPurchasePriceExcTax && product.defaultSellingPriceExcTax) {
          const marginPercentage = ((product.defaultSellingPriceExcTax - product.defaultPurchasePriceExcTax) / 
                                 product.defaultPurchasePriceExcTax) * 100;
          productFormGroup.get('marginPercentage')?.setValue(marginPercentage.toFixed(2));
        }

        this.calculateLineTotal(index);
      }
    } catch (error) {
      console.error('Error loading product details:', error);
    }
  } else {
    productFormGroup.patchValue({
      productName: '',
      sku: '',
      hsnCode: '',
      unit: '',
      unitCost: 0,
      sellingPrice: 0,
      currentStock: 0,
      taxRate: 0,
      unitCostBeforeTax: 0,
      batchNumber: '',
      expiryDate: ''
    });
  }
}

  calculateAdditionalTax(): void {
    const purchaseTaxId = this.purchaseForm.get('purchaseTaxId')?.value;
    const selectedTax = this.taxRatesList.find(tax => tax.id === purchaseTaxId);
    
    if (selectedTax) {
      const taxableAmount = this.netTotalAmount;
      this.additionalTaxAmount = taxableAmount * (selectedTax.rate / 100);
    } else {
      this.additionalTaxAmount = 0;
    }
    
    this.calculateTotals();
  }

  removeProduct(index: number): void {
    this.productsFormArray.removeAt(index);
    this.calculateTotals();
  }

calculateLineTotal(index: number): void {
  const productFormGroup = this.productsFormArray.at(index) as FormGroup;
  const quantity = productFormGroup.get('quantity')?.value || 0;
  const unitCost = productFormGroup.get('unitCost')?.value || 0;
  const discountPercent = productFormGroup.get('discountPercent')?.value || 0;
  const taxRate = productFormGroup.get('taxRate')?.value || 0;
  
  // Calculate discounted price
  const discountAmount = unitCost * (discountPercent / 100);
  const discountedPrice = unitCost - discountAmount;
  
  // Calculate subtotal before tax
  const subtotalBeforeTax = quantity * discountedPrice;
  
  // Calculate tax amount
  const taxAmount = subtotalBeforeTax * (taxRate / 100);
  
  // Calculate line total (subtotal + tax)
  const lineTotal = subtotalBeforeTax + taxAmount;

  // Update form values with proper rounding
  productFormGroup.patchValue({
    unitCostBeforeTax: parseFloat(discountedPrice.toFixed(2)),
    subtotal: parseFloat(subtotalBeforeTax.toFixed(2)),
    taxAmount: parseFloat(taxAmount.toFixed(2)),
    lineTotal: parseFloat(lineTotal.toFixed(2)),
    netCost: parseFloat(discountedPrice.toFixed(2))
  }, {emitEvent: false});
  
  this.calculateTotals();
}
  calculateSellingPrice(index: number): void {
    const productGroup = this.productsFormArray.at(index);
    const unitCostBeforeTax = parseFloat(productGroup.get('unitCostBeforeTax')?.value) || 0;
    const marginPercentage = parseFloat(productGroup.get('marginPercentage')?.value) || 0;
    const taxRate = parseFloat(productGroup.get('taxRate')?.value) || 0;
    
    const priceBeforeTax = unitCostBeforeTax * (1 + (marginPercentage / 100));
    const sellingPrice = priceBeforeTax * (1 + (taxRate / 100));
    
    productGroup.patchValue({
      sellingPrice: sellingPrice.toFixed(2)
    });
  }
calculateTotals(): void {
  this.totalItems = this.productsFormArray.length;
  
  let productsSubtotal = 0;
  let totalTax = 0;

  // Calculate product subtotals and taxes
  this.productsFormArray.controls.forEach(productGroup => {
    const quantity = parseFloat(productGroup.get('quantity')?.value) || 0;
    const unitCost = parseFloat(productGroup.get('unitCost')?.value) || 0;
    const discountPercent = parseFloat(productGroup.get('discountPercent')?.value) || 0;
    const taxRate = parseFloat(productGroup.get('taxRate')?.value) || 0;
    
    // Calculate line total before tax
    const lineTotalBeforeTax = quantity * unitCost * (1 - (discountPercent / 100));
    
    // Calculate tax amount
    const taxAmount = lineTotalBeforeTax * (taxRate / 100);
    
    // Calculate line total (including tax)
    const lineTotal = lineTotalBeforeTax + taxAmount;
    
    // Update form values
    productGroup.patchValue({
      subtotal: parseFloat(lineTotalBeforeTax.toFixed(2)),
      taxAmount: parseFloat(taxAmount.toFixed(2)),
      lineTotal: parseFloat(lineTotal.toFixed(2)),
      netCost: parseFloat((unitCost * (1 - (discountPercent / 100))).toFixed(2))
    }, {emitEvent: false});
    
    productsSubtotal += lineTotalBeforeTax;
    totalTax += taxAmount;
  });

  // Get shipping charges
  const shippingCharges = parseFloat(this.purchaseForm.get('shippingCharges')?.value) || 0;
  
  // Calculate grand total (products + tax + shipping)
  this.netTotalAmount = parseFloat((productsSubtotal + totalTax + shippingCharges).toFixed(2));
  this.totalTax = parseFloat(totalTax.toFixed(2));

  // Calculate rounded total and round off amount
  const roundedTotal = Math.round(this.netTotalAmount);
  const roundOffAmount = parseFloat((roundedTotal - this.netTotalAmount).toFixed(2));

  // Update form values - don't force payment amount to 0 here
  this.purchaseForm.patchValue({
    purchaseTotal: this.netTotalAmount,
    totalPayable: roundedTotal,
    roundOffAmount: roundOffAmount,
    roundedTotal: roundedTotal,
    totalTax: this.totalTax
  });

  this.calculatePaymentBalance();
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

  generateReferenceNumber(): void {
    const randomNumber = Math.floor(100000 + Math.random() * 900000);
    const refNumber = `PR${randomNumber}`;
    this.purchaseForm.get('referenceNo')?.setValue(refNumber);
  }

  loadSuppliers(): void {
    this.supplierService.getSuppliers().subscribe((suppliers: any[]) => {
      this.suppliers = suppliers.map(supplier => ({
        id: supplier.id,
        contactId: supplier.contactId,
        businessName: supplier.businessName || '',
        firstName: supplier.firstName || '',
        lastName: supplier.lastName || '',
        isIndividual: supplier.isIndividual || false,
        addressLine1: supplier.addressLine1 || '',
        postalCode: supplier.postalCode,
        address: supplier.address,
        email: supplier.email,
        mobile: supplier.mobile
      } as Supplier));
      
      this.filteredSuppliers = [...this.suppliers];
      
      this.suppliers.sort((a, b) => 
        this.getSupplierDisplayName(a).localeCompare(this.getSupplierDisplayName(b))
      );
    });
  }

  filterSuppliers(event: any): void {
    const searchTerm = event.target.value.toLowerCase();
    
    if (!searchTerm) {
      this.filteredSuppliers = [...this.suppliers];
      return;
    }
    
    this.filteredSuppliers = this.suppliers.filter(supplier => {
      const displayName = this.getSupplierDisplayName(supplier).toLowerCase();
      const email = supplier.email?.toLowerCase() || '';
      const mobile = supplier.mobile?.toLowerCase() || '';
      const businessName = supplier.businessName?.toLowerCase() || '';
      
      return displayName.includes(searchTerm) || 
             email.includes(searchTerm) || 
             mobile.includes(searchTerm) ||
             businessName.includes(searchTerm);
    });
  }

  getSupplierDisplayName(supplier: Supplier): string {
    if (!supplier) return '';
    
    if (supplier.isIndividual) {
      return `${supplier.firstName || ''} ${supplier.lastName || ''}`.trim();
    }
    return supplier.businessName || '';
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.purchaseForm.patchValue({ document: file.name });
    }
  }
async savePurchase() {
  // Mark all form controls as touched to show validation errors
  this.markFormGroupTouched(this.purchaseForm);
  
  // Check if form is valid and has at least one product
  if (this.purchaseForm.invalid) {
    alert('Please fill all required fields correctly!');
    return;
  }
  
  if (this.productsFormArray.length === 0) {
    alert('Please add at least one product!');
    return;
  }
  
  try {
    const formValue = this.purchaseForm.getRawValue();
    
    if (formValue.purchaseOrderId) {
      await this.purchaseOrderService.markOrderAsUsed(formValue.purchaseOrderId);
      // Refresh the purchase orders list
      this.loadPurchaseOrders();
    }
    
    // Get supplier name
    const supplierName = this.selectedSupplier ? 
      this.getSupplierDisplayName(this.selectedSupplier) : 
      'Unknown Supplier';
    
    // Get payment account details
    const selectedAccount = this.paymentAccounts.find(acc => acc.id === formValue.paymentAccount);
    
    const paymentAccount = selectedAccount ? {
      id: selectedAccount.id,
      name: selectedAccount.name,
      accountNumber: selectedAccount.accountNumber || '',
      accountType: selectedAccount.accountType || ''
    } : null;
    
    // Calculate totals correctly
    let productsSubtotal = 0;
    let totalTax = 0;
    
    // Prepare products data with proper calculations
    const products = this.productsFormArray.value.map((product: any) => {
      const productId = product.productId;
      const productName = product.productName || '';
      const quantity = Number(product.quantity) || 0;
      const unitCost = Number(product.unitCost) || 0;
      const discountPercent = Number(product.discountPercent) || 0;
      const taxRate = Number(product.taxRate) || 0;
      const batchNumber = product.batchNumber || '';
      const expiryDate = product.expiryDate || '';
      
      // Calculate line values step by step
      const unitCostBeforeTax = unitCost;
      const netCost = unitCost * (1 - (discountPercent / 100));
      const subtotal = quantity * netCost; // This is the line total before tax
      const taxAmount = subtotal * (taxRate / 100);
      const lineTotal = subtotal + taxAmount; // Final line total including tax
      
      // Accumulate totals
      productsSubtotal += subtotal;
      totalTax += taxAmount;
      
      return {
        productId: productId,
        productName: productName,
        quantity: quantity,
        unitCost: unitCost,
        discountPercent: discountPercent,
        unitCostBeforeTax: parseFloat(unitCostBeforeTax.toFixed(2)),
        subtotal: parseFloat(subtotal.toFixed(2)),
        taxAmount: parseFloat(taxAmount.toFixed(2)),
        supplierId: formValue.supplierId,
        lineTotal: parseFloat(lineTotal.toFixed(2)),
        taxRate: taxRate,
        batchNumber: batchNumber,
        expiryDate: expiryDate,
        netCost: parseFloat(netCost.toFixed(2))
      };
    });
    
    // Calculate final totals
    const shippingCharges = Number(formValue.shippingCharges) || 0;
    const grandTotal = productsSubtotal + totalTax + shippingCharges;
    const roundedTotal = Math.round(grandTotal);
    const roundOffAmount = parseFloat((roundedTotal - grandTotal).toFixed(2));
    
    // Calculate payment status based on amounts
    const paymentAmount = Number(formValue.paymentAmount) || 0;
    let calculatedPaymentStatus = 'due';
    
    if (paymentAmount >= grandTotal) {
      calculatedPaymentStatus = 'paid';
    } else if (paymentAmount > 0) {
      calculatedPaymentStatus = 'partial';
    }
    
    // Use the selected payment status or calculated one
    const paymentStatus = formValue.paymentStatus || calculatedPaymentStatus;
    const paymentDue = Math.max(0, grandTotal - paymentAmount);
    
    // Prepare purchase data with all required fields
    const purchaseData = {
      supplierId: this.selectedSupplier?.id || '',
      supplierName: supplierName,
      referenceNo: formValue.referenceNo,
      purchaseDate: new Date(formValue.purchaseDate),
      productsSubtotal: parseFloat(productsSubtotal.toFixed(2)),
      totalTax: parseFloat(totalTax.toFixed(2)),
      grandTotal: parseFloat(grandTotal.toFixed(2)),
      cgst: this.calculateCGST(totalTax, formValue.isInterState),
      sgst: this.calculateSGST(totalTax, formValue.isInterState),
      igst: this.calculateIGST(totalTax, formValue.isInterState),
      taxRate: this.getHighestTaxRate(),
      purchaseStatus: formValue.purchaseStatus,
      paymentStatus: paymentStatus,
      businessLocation: formValue.businessLocation,
      address: formValue.address || '',
      products: products,
      shippingCharges: shippingCharges,
      purchaseTotal: parseFloat(grandTotal.toFixed(2)), // Keep both for compatibility
      paymentAmount: paymentAmount,
      paymentDue: parseFloat(paymentDue.toFixed(2)),
      paidOn: formValue.paidOn ? new Date(formValue.paidOn) : null,
      paymentMethod: formValue.paymentMethod,
      paymentAccount: paymentAccount,
      paymentNote: formValue.paymentNote || '',
      additionalNotes: formValue.additionalNotes || '',
      invoiceNo: formValue.invoiceNo || '',
      invoicedDate: formValue.invoicedDate ? new Date(formValue.invoicedDate) : null,
      receivedDate: formValue.receivedDate ? new Date(formValue.receivedDate) : null,
      roundOffAmount: roundOffAmount,
      roundedTotal: roundedTotal,
      addedBy: {
        id: this.currentUser?.uid || '',
        name: this.currentUser?.displayName || this.currentUser?.email || '',
        email: this.currentUser?.email || ''
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      status: formValue.purchaseStatus || 'received'
    };
    
    // Save the purchase
    const result = await this.purchaseService.createPurchase(purchaseData);
    
    alert('Purchase saved successfully!');
    this.router.navigate(['/list-purchase']);
  } catch (error) {
    console.error('Error saving purchase:', error);
    alert('Error saving purchase. Please check console for details.');
  }
  }forceZeroAmount(event: any) {
  // Force the input value to 0
  event.target.value = 0;
  
  // Update the form control value to 0
  this.purchaseForm.patchValue({
    paymentAmount: 0
  });

  // If needed, trigger balance calculation
  this.calculatePaymentBalance();
}
  
selectSupplier(supplier: Supplier): void {
  this.selectedSupplier = supplier;
  this.purchaseForm.patchValue({
    supplierId: supplier.id,
    supplierName: this.getSupplierDisplayName(supplier),
    address: supplier.addressLine1 || ''
  });
  
  if (supplier.id) {
    this.filterPurchaseOrders(supplier.id);
  }
  
  // Update the purchase order dropdown state
  this.updatePurchaseOrderDropdownState();
  }
  private calculateCGST(totalTax: number, isInterState: boolean): number {
  return isInterState ? 0 : parseFloat((totalTax / 2).toFixed(2));
}

private calculateSGST(totalTax: number, isInterState: boolean): number {
  return isInterState ? 0 : parseFloat((totalTax / 2).toFixed(2));
}

private calculateIGST(totalTax: number, isInterState: boolean): number {
  return isInterState ? parseFloat(totalTax.toFixed(2)) : 0;
}

private getHighestTaxRate(): number {
  let highestRate = 0;
  this.productsFormArray.controls.forEach(control => {
    const rate = control.get('taxRate')?.value || 0;
    if (rate > highestRate) {
      highestRate = rate;
    }
  });
  return highestRate;
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
          }
        });
      }
    });
  }
}