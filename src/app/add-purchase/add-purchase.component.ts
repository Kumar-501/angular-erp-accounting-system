import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
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
import { GoodsService } from '../services/goods.service';

import { Supplier } from '../models/supplier.model';
import { StockService } from '../services/stock.service';
interface PaymentAccount {
  id: string;
  name: string;
  accountNumber?: string;
  accountType?: string;
}

interface GrnData {
  id: string;
  referenceNo: string;
  receivedDate: Date;
  products: GrnProduct[];
  supplierName: string;
  purchaseReferenceNo: string;
}

interface GrnProduct {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  receivedQuantity: number;
  pendingQuantity: number;
  orderQuantity: number;
  unitPrice: number;
  lineTotal: number;
  batchNumber?: string;
  expiryDate?: string;
}

interface ProductReceivedSummary {
  productId: string;
  productName: string;
  sku: string;
  totalOrdered: number;
  totalReceived: number;
  pendingQuantity: number;
  lastReceivedDate: Date;
  grnEntries: GrnProduct[];
}

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
  totalQuantity?: number;
  stockByLocation?: { [locationId: string]: number };
  unitCostBeforeTax: number;
  subtotal: number;
  batchNumber?: string;
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
  marginPercentage: number;
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

@Component({
  selector: 'app-add-purchase',
  templateUrl: './add-purchase.component.html',
  styleUrls: ['./add-purchase.component.scss']
})
export class AddPurchaseComponent implements OnInit {
  purchaseForm!: FormGroup;
  suppliers: Supplier[] = [];
  discountTypes: ('percent' | 'amount')[] = [];
  requisitions: any[] = [];
  selectedRequisition: any = null;
    @ViewChild('purchaseDatePicker') purchaseDatePicker!: ElementRef;
  @ViewChild('invoicedDatePicker') invoicedDatePicker!: ElementRef;
  @ViewChild('receivedDatePicker') receivedDatePicker!: ElementRef;
  @ViewChild('paidOnDatePicker') paidOnDatePicker!: ElementRef;
  purchaseOrders: any[] = [];
  isSaving: boolean = false;
  showGrnDetails: Map<string, boolean> = new Map<string, boolean>();
  isLoadingPurchaseOrder: boolean = false; // Add loading state

  requisitionData: any = null;
  filteredPurchaseOrders: any[] = [];
  businessLocations: any[] = [];
  filteredSuppliers: Supplier[] = [];
  selectedSupplier: Supplier | null = null;
  totalItems = 0;
  netTotalAmount = 0;
productsOnlyTotal = 0; 
  searchTerm: string = '';
  searchResults: Product[] = [];
  showSearchResults: boolean = false;
  productSearchText: string = '';
  searchedProducts: any[] = [];
  showProductDropdown: boolean = false;
  totalTax = 0;
  batchList = ["BATCH001", "BATCH002", "BATCH003"];
  isReadonly = true;
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

  // GRN related properties
  grnData: GrnData[] = [];
  productReceivedSummaries: Map<string, ProductReceivedSummary> = new Map();
  showGrnSummary: boolean = false;
  isLoadingGrnData: boolean = false;

  getTotalReceivedQuantityForGrn(grn: any): number {
    if (!grn.products) return 0;
    return grn.products.reduce((total: number, p: any) => total + (p.receivedQuantity || p.quantity || 0), 0);
  }

  getGrnReferenceForEntry(grnEntry: any): string {
    const grn = this.grnData.find(g => g.products && g.products.includes(grnEntry));
    return grn?.referenceNo || 'GRN';
  }

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
    private purchaseRequisitionService: PurchaseRequisitionService,
    private goodsService: GoodsService,
     private stockService: StockService,
  ) {}

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
      } else    if (orderId) {
        this.purchaseOrderId = orderId;
        this.loadPurchaseOrderData(orderId);
      
        this.purchaseOrderId = orderId;
        this.isLoadingFromPurchaseOrder = true;
        this.loadPurchaseOrderData(orderId);
      } else if (fromSupplier && supplierId) {
        this.purchaseForm.patchValue({
          supplierId: supplierId,
          supplierName: supplierName,
          address: supplierAddress
        });
        
        const foundSupplier = this.suppliers.find(s => s.id === supplierId);
        if (foundSupplier) {
          this.selectedSupplier = foundSupplier;
        } else {
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
 // add-purchase.component.ts
 getFormattedDateForInput(dateString: any): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  }

  openDatePicker(type: 'purchase' | 'invoiced' | 'received' | 'paidOn'): void {
    if (type === 'purchase') this.purchaseDatePicker.nativeElement.showPicker();
    else if (type === 'invoiced') this.invoicedDatePicker.nativeElement.showPicker();
    else if (type === 'received') this.receivedDatePicker.nativeElement.showPicker();
    else if (type === 'paidOn') this.paidOnDatePicker.nativeElement.showPicker();
  }

getFormattedDate(dateValue: any): string {
  if (!dateValue) return '';
  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  } catch (e) {
    return '';
  }
}

// Update the manual input logic to handle the internal date objects correctly
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
      
      // Store as ISO string or Date object depending on your preference
      // Here we use YYYY-MM-DD string to satisfy the reactive form's native date binding
      const isoDate = `${year}-${month}-${day}`;
      this.purchaseForm.get(controlName)?.setValue(isoDate);
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
    event.target.value = this.getFormattedDateForInput(this.purchaseForm.get(controlName)?.value);
  }

  async loadProducts(): Promise<void> {
    this.productsService.getProductsRealTime().subscribe(async (products: any[]) => {
      
      // Use Promise.all to efficiently fetch the correct stock for all products.
      const productPromises = products.map(async (product) => {
        if (!product.id) {
          return { ...product, currentStock: 0, totalQuantity: 0 };
        }
        
        // 1. Fetch the detailed stock data using the now-fixed service method.
        const stockData = await this.stockService.getProductStock(product.id);
        
        // 2. Calculate the total stock by summing the quantities from all locations.
        // This mimics the logic from the Stock Report, ensuring consistency.
        const totalStock = Object.values(stockData).reduce((sum: number, loc: any) => sum + (loc.quantity || 0), 0);
        
        // 3. Return a new product object with 'currentStock' updated to the correct total.
        return {
          ...product,
          currentStock: totalStock, // This now holds the correct value (e.g., 1980)
          totalQuantity: totalStock, // Also update totalQuantity for consistency.
          defaultPurchasePriceExcTax: product.defaultPurchasePriceExcTax || 0,
          defaultSellingPriceExcTax: product.defaultSellingPriceExcTax || 0,
          defaultSellingPriceIncTax: product.defaultSellingPriceIncTax || 0,
          marginPercentage: product.marginPercentage || 0,
          applicableTax: product.applicableTax || { percentage: 0 },
          batchNumber: product.batchNumber || '',
          expiryDate: product.expiryDate || ''
        };
      });
      
      // Wait for all calculations to complete and update the component's product list.
      this.productsList = await Promise.all(productPromises);
    });
  }
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

  toggleGrnDetails(productId: string): void {
    const currentValue = this.showGrnDetails.get(productId) || false;
    this.showGrnDetails.set(productId, !currentValue);
  }

  // UPDATED: Enhanced loadPurchaseOrderData method to always fetch fresh data
  async loadPurchaseOrderData(orderId: string): Promise<void> {
    if (!orderId) {
      console.error('No order ID provided for loading.');
      return;
    }
  
    this.isLoadingPurchaseOrder = true;
    
    try {
      // **ALWAYS fetch fresh data from the service**
      const orderData = await this.purchaseOrderService.getOrderById(orderId);
      
      if (orderData) {
        console.log('Successfully loaded fresh purchase order data:', orderData);
        this.purchaseOrderData = orderData;
        
        // **MODIFICATION**: Await the prefill method as it's now async
        await this.prefillFormFromPurchaseOrder(orderData);
        
      } else {
        console.error('Could not find purchase order with ID:', orderId);
        alert('The selected purchase order could not be found. It may have been deleted.');
        this.router.navigate(['/list-purchase']);
      }
    } catch (error) {
      console.error('Failed to load purchase order data:', error);
    } finally {
      this.isLoadingPurchaseOrder = false;
    }
  }

  // **CRITICAL FIX: Replaced method with async version to fetch full product details**
  private async prefillFormFromPurchaseOrder(orderData: any): Promise<void> {
    const supplierId = orderData.supplierId || orderData.supplier;

    const foundSupplier = this.suppliers.find(s => s.id === supplierId);
    if (foundSupplier) {
      this.selectedSupplier = foundSupplier;
    }
    
    this.purchaseForm.patchValue({
      supplierId: supplierId,
      supplierName: foundSupplier ? this.getSupplierDisplayName(foundSupplier) : orderData.supplierName,
      address: orderData.address || orderData.supplierAddress || (foundSupplier ? foundSupplier.addressLine1 : ''),
      referenceNo: orderData.referenceNo,
      purchaseDate: new Date().toISOString().substring(0, 10),
      businessLocation: orderData.businessLocation,
      shippingCharges: orderData.shippingCharges || 0,
      additionalNotes: orderData.notes || '',
      purchaseOrderId: orderData.id,
      receivedDate: orderData.requiredDate || orderData.requiredByDate
    });

    const itemsToProcess = orderData.products || orderData.items || [];
    
    this.productsFormArray.clear();

    if (itemsToProcess.length > 0) {
        // Fetch all product details in parallel to be more efficient
        const productDetailPromises = itemsToProcess.map((item: any) => 
            this.productsService.getProductById(item.productId).catch(() => null)
        );
        const fullProducts = await Promise.all(productDetailPromises);

        itemsToProcess.forEach((item: any, index: number) => {
            const fullProductDetails = fullProducts[index];

            // **THE FIX**: Prioritize tax from PO, fallback to master product's tax, then default to 0
            const taxRate = item.taxPercent || item.taxRate || (fullProductDetails ? fullProductDetails.taxPercentage : 0) || 0;

            const productGroup = this.fb.group({
                productId: [item.productId, Validators.required],
                productName: [item.productName],
                quantity: [item.quantity || item.requiredQuantity, [Validators.required, Validators.min(1)]],
                unitCost: [item.unitCost || item.unitPurchasePrice, [Validators.required, Validators.min(0)]],
                discountPercent: [item.discountPercent || 0],
                taxRate: [taxRate], // Use the resolved tax rate
                unitCostBeforeTax: [0],
                subtotal: [0],
                lineTotal: [0],
                netCost: [0],
                taxAmount: [0],
                batchNumber: [''],
                expiryDate: [''],
                sellingPrice: [0],
                marginPercentage: [0]
            });
            this.productsFormArray.push(productGroup);
      });
    }

    // Recalculate all totals for the form
    this.calculateTotals();
  }

  // NEW: Method to clear form data before loading fresh data
  private clearFormData(): void {
    // Clear existing products
    while (this.productsFormArray.length !== 0) {
      this.productsFormArray.removeAt(0);
    }
    
    // Reset form values
    this.purchaseForm.patchValue({
      supplierName: '',
      address: '',
      purchaseOrder: '',
      referenceNo: '',
      businessLocation: '',
      additionalNotes: '',
      shippingCharges: 0,
      invoicedDate: '',
      receivedDate: '',
      invoiceNo: '',
      purchaseTaxId: ''
    });
  }

  // UPDATED: Enhanced prefillFormFromPurchaseOrder method to use fresh data

  // NEW: Enhanced method to add products with fresh data from purchase order
  async addProductFromPurchaseOrderWithFreshData(product: any): Promise<void> {
    try {
      console.log('Adding product with fresh data:', product);
      
      // Use the most recent unit cost from the purchase order
      const unitCost = product.unitCost || product.unitPurchasePrice || product.unitPrice || 0;
      
      // Get complete product details for additional information
      let completeProduct: any = null;
      try {
        if (product.productId || product.id) {
          completeProduct = await this.productsService.getProductById(product.productId || product.id);
        }
      } catch (error) {
        console.log('Could not fetch complete product details, using purchase order data');
      }
      
      // Use tax rate from purchase order first, then fall back to product data
      const taxRate = product.taxRate || product.taxPercent || 
                     completeProduct?.taxPercentage || 0;
      
      // Use selling price from purchase order if available, otherwise from product data
      const sellingPrice = product.sellingPrice || 
                          completeProduct?.defaultSellingPriceIncTax || 
                          completeProduct?.defaultSellingPriceExcTax || 
                          completeProduct?.unitSellingPrice || 0;
      
      // Use margin from purchase order if available, otherwise from product data
      const marginPercentage = product.marginPercentage || 
                              completeProduct?.marginPercentage || 0;
      
      const productGroup = this.fb.group({
        productId: [product.productId || product.id || ''],
        productName: [product.productName || completeProduct?.productName || '', Validators.required],
        quantity: [product.quantity || product.requiredQuantity || 1, [Validators.required, Validators.min(1)]],
        unitCost: [unitCost, [Validators.required, Validators.min(0)]], // Use fresh unit cost
        discountPercent: [product.discountPercent || 0, [Validators.min(0), Validators.max(100)]],
        unitCostBeforeTax: [product.unitCostBeforeTax || unitCost],
        netCost: [product.netCost || 0],
        productTax: [product.productTax || 0],
        subtotal: [product.subtotal || 0],
        taxAmount: [product.taxAmount || 0],
        lineTotal: [product.lineTotal || 0],
        profitMargin: [product.profitMargin || marginPercentage],
        sellingPrice: [sellingPrice],
        marginPercentage: [marginPercentage],
        batchNumber: [product.batchNumber || ''],
        expiryDate: [product.expiryDate || ''],
        taxRate: [taxRate], // Use fresh tax rate
        commissionPercent: [product.commissionPercent || 0, [Validators.min(0), Validators.max(100)]],
        commissionAmount: [product.commissionAmount || 0],
        currentStock: [completeProduct?.currentStock || product.currentStock || 0]
      });

      this.productsFormArray.push(productGroup);
      
      // Calculate totals with fresh data
      const currentIndex = this.productsFormArray.length - 1;
      this.calculateLineTotal(currentIndex);
      this.calculateMargin(currentIndex);
      
      console.log('Product added successfully with fresh data');
      
    } catch (error) {
      console.error('Error adding product with fresh data:', error);
      
      // Fallback to basic product addition
      const productGroup = this.fb.group({
        productId: [product.productId || product.id || ''],
        productName: [product.productName || '', Validators.required],
        quantity: [product.quantity || 1, [Validators.required, Validators.min(1)]],
        unitCost: [product.unitCost || 0, [Validators.required, Validators.min(0)]],
        discountPercent: [product.discountPercent || 0, [Validators.min(0), Validators.max(100)]],
        unitCostBeforeTax: [product.unitCost || 0],
        netCost: [0],
        productTax: [0],
        subtotal: [0],
        taxAmount: [0],
        lineTotal: [0],
        profitMargin: [0],
        sellingPrice: [0],
        marginPercentage: [0],
        batchNumber: [product.batchNumber || ''],
        expiryDate: [product.expiryDate || ''],
        taxRate: [product.taxRate || 0],
        commissionPercent: [0],
        commissionAmount: [0]
      });

      this.productsFormArray.push(productGroup);
      this.calculateLineTotal(this.productsFormArray.length - 1);
      this.calculateMargin(this.productsFormArray.length - 1);
    }
  }

  // UPDATED: Enhanced onPurchaseOrderSelect method to force fresh data load
  onPurchaseOrderSelect(orderId: string): void {
    if (orderId) {
      console.log('Purchase order selected:', orderId);
      this.purchaseOrderId = orderId;
      this.isLoadingFromPurchaseOrder = true;
      
      // Force fresh data load
      this.loadPurchaseOrderData(orderId);
      
      // Load GRN data for the selected purchase order
      const selectedOrder = this.purchaseOrders.find(o => o.id === orderId);
      if (selectedOrder) {
        this.loadGrnDataForPurchaseOrder(selectedOrder.referenceNo);
      }
    } else {
      this.purchaseOrderId = null;
      this.isLoadingFromPurchaseOrder = false;
      this.generateReferenceNumber();
      this.generateInvoiceNumber();
      this.grnData = [];
      this.productReceivedSummaries.clear();
      this.showGrnSummary = false;
    }
  }

  // NEW: Method to refresh purchase order data
  async refreshPurchaseOrderData(): Promise<void> {
    if (this.purchaseOrderId) {
      await this.loadPurchaseOrderData(this.purchaseOrderId);
    }
  }

  // Updated loadPurchaseOrders method
  loadPurchaseOrders(): void {
    this.purchaseOrderService.getOrdersForPurchase().subscribe(orders => {
      this.purchaseOrders = orders;
      this.filteredPurchaseOrders = [...this.purchaseOrders];
      
      // If coming from a purchase order, filter for that supplier
      if (this.purchaseOrderId) {
        const selectedOrder = this.purchaseOrders.find(o => o.id === this.purchaseOrderId);
        if (selectedOrder) {
          this.filterPurchaseOrders(selectedOrder.supplierId || selectedOrder.supplier);
        }
      }
    });
  }

  // Load GRN data for selected purchase order
  async loadGrnDataForPurchaseOrder(purchaseOrderRef: string): Promise<void> {
    if (!purchaseOrderRef) {
      this.grnData = [];
      this.productReceivedSummaries.clear();
      this.showGrnSummary = false;
      return;
    }

    this.isLoadingGrnData = true;
    
    try {
      this.goodsService.getAllGoodsReceived().subscribe(allGrn => {
        const filteredGrn = allGrn.filter(grn => 
          grn['purchaseReferenceNo'] === purchaseOrderRef || 
          grn['purchaseOrderRef'] === purchaseOrderRef ||
          (grn['purchaseOrderDetails'] && grn['purchaseOrderDetails'].referenceNo === purchaseOrderRef)
        );

        this.grnData = filteredGrn.map(grn => ({
          id: grn['id'],
          referenceNo: grn['referenceNo'] || `GRN-${grn['id'].substring(0, 8)}`,
          receivedDate: this.parseDate(grn['receivedDate']),
          products: grn['products'] || [],
          supplierName: grn['supplierName'] || '',
          purchaseReferenceNo: grn['purchaseReferenceNo'] || ''
        }));

        this.calculateProductReceivedSummaries();
        this.showGrnSummary = this.grnData.length > 0;
        this.isLoadingGrnData = false;
      });
    } catch (error) {
      console.error('Error loading GRN data:', error);
      this.isLoadingGrnData = false;
      this.showGrnSummary = false;
    }
  }

  private calculateProductReceivedSummaries(): void {
    this.productReceivedSummaries.clear();

    this.grnData.forEach(grn => {
      grn.products.forEach(product => {
        const productId = product.productId || product.id;
        
        if (!this.productReceivedSummaries.has(productId)) {
          this.productReceivedSummaries.set(productId, {
            productId: productId,
            productName: product.productName,
            sku: product.sku || `SKU-${productId}`,
            totalOrdered: 0,
            totalReceived: 0,
            pendingQuantity: 0,
            lastReceivedDate: grn.receivedDate,
            grnEntries: []
          });
        }

        const summary = this.productReceivedSummaries.get(productId)!;
        summary.totalOrdered += product.orderQuantity || 0;
        summary.totalReceived += product.receivedQuantity || product.quantity || 0;
        summary.pendingQuantity += product.pendingQuantity || 0;
        summary.grnEntries.push(product);
        
        if (grn.receivedDate > summary.lastReceivedDate) {
          summary.lastReceivedDate = grn.receivedDate;
        }
      });
    });
  }

  getProductReceivedQuantity(productId: string): number {
    const summary = this.productReceivedSummaries.get(productId);
    return summary ? summary.totalReceived : 0;
  }

  getProductPendingQuantity(productId: string): number {
    const summary = this.productReceivedSummaries.get(productId);
    return summary ? summary.pendingQuantity : 0;
  }

  getProductOrderedQuantity(productId: string): number {
    const summary = this.productReceivedSummaries.get(productId);
    return summary ? summary.totalOrdered : 0;
  }

  getProductGrnEntries(productId: string): GrnProduct[] {
    const summary = this.productReceivedSummaries.get(productId);
    return summary ? summary.grnEntries : [];
  }

  hasReceivedQuantities(productId: string): boolean {
    return this.getProductReceivedQuantity(productId) > 0;
  }

  getProductDeliveryStatus(productId: string): string {
    const ordered = this.getProductOrderedQuantity(productId);
    const received = this.getProductReceivedQuantity(productId);
    const pending = this.getProductPendingQuantity(productId);

    if (received === 0) return 'Not Received';
    if (pending > 0) return 'Partial';
    if (received >= ordered) return 'Complete';
    return 'Received';
  }

  getProductDeliveryStatusClass(productId: string): string {
    const status = this.getProductDeliveryStatus(productId);
    switch (status) {
      case 'Complete': return 'delivery-complete';
      case 'Partial': return 'delivery-partial';
      case 'Not Received': return 'delivery-not-received';
      default: return 'delivery-received';
    }
  }

  private parseDate(dateValue: any): Date {
    if (!dateValue) return new Date();
    
    if (dateValue instanceof Date) {
      return dateValue;
    }
    
    if (dateValue.toDate) {
      return dateValue.toDate();
    }
    
    return new Date(dateValue);
  }

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
  }

  handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
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

  clearSupplier(): void {
    this.selectedSupplier = null;
    this.purchaseForm.patchValue({
      supplierId: '',
      supplierName: '',
      address: ''
    });
    
    this.updatePurchaseOrderDropdownState();
  }

  onSearchFocus(): void {
    if (this.searchTerm.length > 1) {
      this.showSearchResults = true;
    }
  }

  onSearchBlur(): void {
    setTimeout(() => {
      this.showSearchResults = false;
    }, 150);
  }

  addProductFromSearch(product: Product): void {
    const existingProductIndex = this.productsFormArray.controls.findIndex(
      control => control.get('productId')?.value === product.id
    );

    if (existingProductIndex >= 0) {
      const existingProduct = this.productsFormArray.at(existingProductIndex);
      const currentQuantity = existingProduct.get('quantity')?.value || 0;
      existingProduct.get('quantity')?.setValue(currentQuantity + 1);
      this.calculateLineTotal(existingProductIndex);
    } else {
      const productToAdd = {
        ...product,
        currentStock: product.currentStock || product.totalQuantity || 0
      };
      this.addProductToTable(productToAdd);
    }

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
    this.addProductToTable(product);
    
    this.productSearchText = '';
    this.searchedProducts = [];
    this.showProductDropdown = false;
  }

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
      taxRate: [product.taxPercentage || product.taxRate || 0],
      taxAmount: [0],
      batchNumber: [product.batchNumber || ''],
      expiryDate: [product.expiryDate || ''],
      netCost: [0],
      currentStock: [product.currentStock || product.totalQuantity || 0],
      sellingPrice: [product.defaultSellingPriceIncTax || 
                    product.defaultSellingPriceExcTax || 
                    product.unitSellingPrice || 
                    product.sellingPrice || 0, 
                    [Validators.min(0)]],
      marginPercentage: [product.marginPercentage || 0, [Validators.min(0)]]
    });

    this.productsFormArray.push(productGroup);
    this.calculateLineTotal(this.productsFormArray.length - 1);
    this.calculateMargin(this.productsFormArray.length - 1);
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
      purchaseOrderControl?.setValue('');
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
      sellingPrice: [0, [Validators.min(0)]],
      marginPercentage: [0, [Validators.min(0)]],
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
      expiryDate: [''],
      sellingPrice: [0, [Validators.min(0)]],
      marginPercentage: [0, [Validators.min(0)]]
    });

    this.productsFormArray.push(productGroup);
  }

  // ✅ MODIFICATION: Updated to make shippingCharges editable
  initForm(): void {
      this.purchaseForm = this.fb.group({
        address: [''],
        supplierId: [''],
        referenceNo: [{value: '', disabled: true}, Validators.required],
        purchaseDate: [new Date().toISOString().substring(0, 10), Validators.required],
        purchaseStatus: ['Received', Validators.required],
        businessLocation: ['', Validators.required],
        payTerm: [''],
        paymentStatus: ['due'],
        purchaseOrder: [''],
        purchaseOrderId: [''],
        document: [null],
        supplierName: [''],
        discountType: [''],
        discountAmount: [0],
        additionalNotes: [''],
        
        // --- UPDATED SHIPPING FIELDS ---
        shippingChargesBeforeTax: [0, [Validators.min(0)]],
        shippingTaxRate: [0],
        shippingTaxAmount: [{value: 0, disabled: true}],
        // shippingCharges is now an editable field for the after-tax value
        shippingCharges: [0, [Validators.min(0)]], 

        products: this.fb.array([], Validators.required),
        purchaseTotal: [0],
        paymentAmount: [0, [Validators.required, Validators.min(0.0)]],
        paidOn: [new Date().toISOString().substring(0, 10), Validators.required],
        paymentMethod: ['', Validators.required],
        paymentAccount: ['', Validators.required],
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

 calculateMargin(index: number): void {
    const productFormGroup = this.productsFormArray.at(index) as FormGroup;
    const unitCostBeforeTax = parseFloat(productFormGroup.get('unitCostBeforeTax')?.value) || 0;
    const discountPercent = parseFloat(productFormGroup.get('discountPercent')?.value) || 0;
    const sellingPrice = parseFloat(productFormGroup.get('sellingPrice')?.value) || 0;
    
    const effectivePurchaseCost = unitCostBeforeTax * (1 - (discountPercent / 100));
    
    let marginPercentage = 0;
    if (effectivePurchaseCost > 0 && sellingPrice > effectivePurchaseCost) {
      marginPercentage = ((sellingPrice - effectivePurchaseCost) / effectivePurchaseCost) * 100;
    }
    
    productFormGroup.patchValue({
      marginPercentage: parseFloat(marginPercentage.toFixed(2))
    }, {emitEvent: false});
  }

calculateSellingPriceFromMargin(index: number): void {
    const productFormGroup = this.productsFormArray.at(index) as FormGroup;
    const unitCostBeforeTax = parseFloat(productFormGroup.get('unitCostBeforeTax')?.value) || 0;
    const discountPercent = parseFloat(productFormGroup.get('discountPercent')?.value) || 0;
    const marginPercentage = parseFloat(productFormGroup.get('marginPercentage')?.value) || 0;
    
    const effectivePurchaseCost = unitCostBeforeTax * (1 - (discountPercent / 100));
    const sellingPrice = effectivePurchaseCost * (1 + (marginPercentage / 100));
    
    productFormGroup.patchValue({
      sellingPrice: parseFloat(sellingPrice.toFixed(2))
    }, {emitEvent: false});
  }

  async onProductSelect(index: number) {
    const productFormGroup = this.productsFormArray.at(index);
    const productId = productFormGroup.get('productId')?.value;
    
    if (productId) {
      try {
        const product = await this.productsService.getProductById(productId);
        if (product) {
          const taxRate = product.taxPercentage || 0;
          const sellingPrice = product.defaultSellingPriceIncTax || 
                             product.defaultSellingPriceExcTax || 
                             product.unitSellingPrice || 0;
          
          productFormGroup.patchValue({
            productName: product.productName,
            sku: product.sku,
            hsnCode: product.hsnCode,
            unit: product.unit,
            unitCost: product.defaultPurchasePriceIncTax || 
                     product.defaultPurchasePriceExcTax || 
                     product.unitPurchasePrice || 
                     0,
            sellingPrice: sellingPrice,
            marginPercentage: product.marginPercentage || 0,
            currentStock: product.currentStock || 0,
            taxRate: taxRate,
            unitCostBeforeTax: product.defaultPurchasePriceExcTax || 0,
            batchNumber: product.batchNumber || '',
            expiryDate: product.expiryDate || ''
          });

          if (taxRate > 0) {
            const selectedTax = this.taxRates.find(t => t.rate === taxRate);
            if (selectedTax) {
              productFormGroup.get('taxRate')?.setValue(selectedTax.rate);
            }
          }

          this.calculateMargin(index);
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
        marginPercentage: 0,
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

/**
 * Calculates all totals for a single product line, ensuring that the
 * final line total is consistent with the visually rounded unit price after tax.
 * This prevents rounding discrepancies for the user.
 * @param index The index of the product in the FormArray.
 */
// In src/app/add-purchase/add-purchase.component.ts

/**
 * ✅ FIXED: This function now calculates totals without premature rounding.
 * This is the definitive fix to match the calculation in the Edit Purchase component.
 * @param index The index of the product in the FormArray.
 */
calculateLineTotal(index: number): void {
  const productFormGroup = this.productsFormArray.at(index) as FormGroup;

  // Use 0 as a fallback for any invalid or empty number fields.
  const quantity = parseFloat(productFormGroup.get('quantity')?.value) || 0;
  const unitCostBeforeTax = parseFloat(productFormGroup.get('unitCostBeforeTax')?.value) || 0;
  const discountPercent = parseFloat(productFormGroup.get('discountPercent')?.value) || 0;
  const taxRate = parseFloat(productFormGroup.get('taxRate')?.value) || 0;

  // 1. Calculate the subtotal for the entire line *before* tax but *after* discount. This is the taxable base.
  // This is the most important change: we multiply by quantity BEFORE calculating tax.
  const subtotal = (quantity * unitCostBeforeTax) * (1 - (discountPercent / 100));

  // 2. Calculate the tax amount based on this precise subtotal.
  const taxAmount = subtotal * (taxRate / 100);

  // 3. The final line total is the sum of the precise subtotal and the precise tax amount.
  const lineTotal = subtotal + taxAmount;
  
  // Calculate netCost (cost per item after discount, before tax) for reference.
  const netCost = unitCostBeforeTax * (1 - (discountPercent / 100));

  // 4. Patch the form with the new, correct, and precise values.
  productFormGroup.patchValue({
    subtotal: parseFloat(subtotal.toFixed(2)),
    taxAmount: parseFloat(taxAmount.toFixed(2)),
    lineTotal: parseFloat(lineTotal.toFixed(2)),
    netCost: parseFloat(netCost.toFixed(2))
  }, { emitEvent: false }); // Use emitEvent: false to prevent infinite loops.
  
  // 5. After calculating the line, update the grand totals.
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

  // NEW METHOD: Calculate unit price after tax for display
  getUnitPriceAfterTax(index: number): number {
    const productFormGroup = this.productsFormArray.at(index) as FormGroup;
    const unitPriceBeforeTax = parseFloat(productFormGroup.get('unitCostBeforeTax')?.value) || 0;
    const taxRate = parseFloat(productFormGroup.get('taxRate')?.value) || 0;
    const taxAmount = unitPriceBeforeTax * (taxRate / 100);
    return unitPriceBeforeTax + taxAmount;
  }
  
  // ✅ NEW METHOD: Handles the reverse calculation for shipping charges.
  calculateBeforeTaxFromAfterTax(): void {
    const shippingChargesAfterTax = parseFloat(this.purchaseForm.get('shippingCharges')?.value) || 0;
    const shippingTaxRate = parseFloat(this.purchaseForm.get('shippingTaxRate')?.value) || 0;
  
    let shippingChargesBeforeTax = shippingChargesAfterTax; // Default if tax rate is 0
  
    // Calculate before-tax amount only if there's a tax rate
    if (shippingTaxRate > 0) {
      shippingChargesBeforeTax = shippingChargesAfterTax / (1 + (shippingTaxRate / 100));
    }
  
    // Update the 'before tax' field without triggering its own input event, to prevent a loop.
    this.purchaseForm.patchValue({
      shippingChargesBeforeTax: parseFloat(shippingChargesBeforeTax.toFixed(2))
    }, { emitEvent: false });
  
    // Now, run the main calculateTotals function to update everything else consistently.
    this.calculateTotals();
  }

  /**
   * ✅ UPDATED: This method now correctly calculates totals and ensures both forward
   * and reverse shipping calculations update the form consistently.
   */
 /**
 * ✅ UPDATED: This method now calculates the display "Grand Total" based only on products,
 * while the final payable total correctly includes shipping charges, addressing the user's request.
 */
/**
 * ✅ UPDATED: Separates product total from net total (products + shipping)
 */
calculateTotals(): void {
  this.totalItems = this.productsFormArray.length;
  
  // 1. Calculate the total from products only (this is your "Grand Total" in the table)
  let productsOnlyTotal = 0;
  this.productsFormArray.controls.forEach(productGroup => {
    productsOnlyTotal += parseFloat(productGroup.get('lineTotal')?.value) || 0;
  });
  
  // Store products-only total separately
  this.productsOnlyTotal = parseFloat(productsOnlyTotal.toFixed(2));

  // 2. Calculate shipping charges separately
  const shippingChargesBeforeTax = parseFloat(this.purchaseForm.get('shippingChargesBeforeTax')?.value) || 0;
  const shippingTaxRate = parseFloat(this.purchaseForm.get('shippingTaxRate')?.value) || 0;
  const shippingTaxAmount = shippingChargesBeforeTax * (shippingTaxRate / 100);
  const totalShippingCharges = shippingChargesBeforeTax + shippingTaxAmount;
  
  // 3. Calculate the final "Net Total Amount" which INCLUDES shipping
  this.netTotalAmount = parseFloat((productsOnlyTotal + totalShippingCharges).toFixed(2));
  
  // 4. Round the final total for payment
  const roundedTotal = Math.round(this.netTotalAmount);

  // 5. Update the reactive form
  this.purchaseForm.patchValue({
    purchaseTotal: this.netTotalAmount, // Full total with shipping
    totalPayable: roundedTotal,
    roundedTotal: roundedTotal,
    
    // Update all shipping fields
    shippingTaxAmount: parseFloat(shippingTaxAmount.toFixed(2)),
    shippingCharges: parseFloat(totalShippingCharges.toFixed(2))
  }, { emitEvent: false });

  // 6. Update the payment balance
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

// File: src/app/add-purchase/add-purchase.component.ts

// in add-purchase.component.ts
async savePurchase() {
    this.markFormGroupTouched(this.purchaseForm);
    this.isSaving = true;

    if (this.purchaseForm.invalid) {
      alert('Please fill all required fields correctly!');
      this.isSaving = false;
      return;
    }
    
    if (this.productsFormArray.length === 0) {
      alert('Please add at least one product!');
      this.isSaving = false;
      return;
    }
    
    try {
      const formValue = this.purchaseForm.getRawValue();
      
      if (formValue.purchaseOrderId) {
        await this.purchaseOrderService.markOrderAsUsedForPurchase(formValue.purchaseOrderId);
      }
      
      const supplierName = this.selectedSupplier 
        ? this.getSupplierDisplayName(this.selectedSupplier) 
        : 'Unknown Supplier';
      
      const selectedAccount = this.paymentAccounts.find(acc => acc.id === formValue.paymentAccount);
      
      const paymentAccount = selectedAccount ? {
        id: selectedAccount.id,
        name: selectedAccount.name,
        accountNumber: selectedAccount.accountNumber || '',
        accountType: selectedAccount.accountType || ''
      } : null;
      
      let productsSubtotal = 0;
      let totalTaxFromProducts = 0;
      
      const products = this.productsFormArray.value.map((product: any) => {
        const lineTotalBeforeTax = (product.quantity * product.unitCostBeforeTax) * (1 - (product.discountPercent / 100));
        const taxAmount = lineTotalBeforeTax * (product.taxRate / 100);
        
        productsSubtotal += lineTotalBeforeTax;
        totalTaxFromProducts += taxAmount;
        
        return {
          ...product,
          subtotal: parseFloat(lineTotalBeforeTax.toFixed(2)),
          taxAmount: parseFloat(taxAmount.toFixed(2)),
          lineTotal: parseFloat((lineTotalBeforeTax + taxAmount).toFixed(2)),
          supplierId: formValue.supplierId,
        };
      });
      
      // Calculate precise (unrounded) total for internal records
      const shippingCharges = Number(formValue.shippingCharges) || 0;
      const preciseTotal = productsSubtotal + totalTaxFromProducts + shippingCharges;
      
      const purchaseData = {
        ...formValue,
        supplierId: this.selectedSupplier?.id || '',
        supplier: supplierName, // For display in the list
        supplierName: supplierName, // For consistency
        products: products,
        productsSubtotal: parseFloat(productsSubtotal.toFixed(2)),
        totalTax: parseFloat(totalTaxFromProducts.toFixed(2)),
        
        // ✅ THE FIX IS HERE:
        // 'grandTotal' is now the final, rounded amount that the user sees and pays against.
        grandTotal: formValue.totalPayable,
        
        // 'purchaseTotal' stores the precise, unrounded value for accurate accounting behind the scenes.
        purchaseTotal: parseFloat(preciseTotal.toFixed(2)),

        paymentAccount: paymentAccount,
        paidOn: new Date(formValue.paidOn),
        purchaseDate: new Date(formValue.purchaseDate),
        addedBy: {
          id: this.currentUser?.uid || '',
          name: this.currentUser?.displayName || this.currentUser?.email || '',
          email: this.currentUser?.email || ''
        },
      };
      
      await this.purchaseService.createPurchase(purchaseData);
      
      alert('Purchase saved successfully!');
      this.router.navigate(['/list-purchase']);

    } catch (error) {
      console.error('Error saving purchase:', error);
      alert('Error saving purchase. Please check the console for details.');
    } finally {
      this.isSaving = false;
    }
  }

  forceZeroAmount(event: any) {
    event.target.value = 0;
    
    this.purchaseForm.patchValue({
      paymentAmount: 0
    });

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