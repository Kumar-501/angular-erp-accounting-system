import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Supplier, SupplierService } from '../services/supplier.service';
import { LocationService } from '../services/location.service';
import { Purchase, PurchaseService } from '../services/purchase.service';
import { PurchaseOrderService, PurchaseOrder } from '../services/purchase-order.service';
import { GoodsService } from '../services/goods.service';
import { ProductsService } from '../services/products.service';
import { Subscription, combineLatest, of } from 'rxjs';
import { switchMap, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { AuthService } from '../auth.service';
import { StockService } from '../services/stock.service';
import { Firestore, collection, doc, setDoc, getDoc, increment, where, getDocs, query, updateDoc, serverTimestamp } from '@angular/fire/firestore';
import { PurchaseStockPriceLogService } from '../services/purchase-stock-price-log.service';
// ✅ IMPORT ADDED
import { DailyStockService } from '../services/daily-stock.service';
import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';

// Constants for Firestore collections
const COLLECTIONS = {
  PRODUCT_STOCK: 'product-stock',
  PRODUCTS: 'products',
  LOCATIONS: 'locations'
};

interface ProductStock {
  productId: string;
  productName: string;
  sku: string;
  locationId: string;
  locationName: string;
  quantity: number;
  unitCost?: number;
  batchNumber?: string;
  expiryDate?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Updated interface to handle both purchase orders and direct purchases
interface PurchaseOrderReference {
  id: string;
  referenceNo: string;
  supplierId: string;
  supplierName: string;
  purchaseDate: string | Date;
  orderDate?: string | Date;
  status?: string;
  products: any[];
  invoiceNo?: string;
  businessLocation: any;
  businessLocationId?: string;
  receivedDate?: string | Date;
  orderTotal?: number;
  items?: any[];
  isUsedForGoods?: boolean;
  supplier?: any;
  type?: 'purchase-order' | 'direct-purchase'; // NEW: Type to distinguish between PO and direct purchase
  displayName?: string; // NEW: Display name for dropdown
}

interface ExtendedSupplier extends Supplier {
  formattedAddress?: string;
}

interface ProductWithReason {
  id: string;
  name: string;
  sku: string;
  orderQuantity: number;
  receivedQuantity: number;
  unitPrice: number;
  lineTotal: number;
  batchNumber: string;
  expiryDate: string;
  taxRate: number;
  pendingQuantity: number;
  pendingReason?: string;
  isPartialDelivery: boolean;
}

@Component({
  selector: 'app-add-goods',
  templateUrl: './add-goods.component.html',
  styleUrls: ['./add-goods.component.scss'],
})
export class AddGoodsComponent implements OnInit, OnDestroy {
  goodsReceivedForm!: FormGroup;
  products: ProductWithReason[] = [];
  totalItems: number = 0;
  @ViewChild('receivedDatePicker') receivedDatePicker!: ElementRef;

  paymentAccounts: any[] = [];
  selectedPaymentAccount: any = null;

  netTotalAmount: number = 0;
  purchaseTotal: number = 0;
  filteredPurchaseOrders: PurchaseOrderReference[] = [];
  selectedPurchaseOrder: PurchaseOrderReference | null = null;
  selectedPurchaseReferenceNo: string = '';
  invoiceNumbers: string[] = [];
  filteredInvoiceNumbers: string[] = [];
  formattedAddress?: string;
  filteredSuppliers: Supplier[] = [];
  searchSupplierTerm: string = '';
  searchPurchaseOrderTerm: string = '';
  isProcessing: boolean = false;
  isValidatingOrder: boolean = false;

  suppliers: Supplier[] = [];
  locations: any[] = [];
  selectedSupplier: ExtendedSupplier | null = null;

  // Updated to use PurchaseOrderReference type (now includes both POs and direct purchases)
  purchaseOrders: PurchaseOrderReference[] = [];
  private subscriptions: Subscription[] = [];

  constructor(
    private fb: FormBuilder,
    private supplierService: SupplierService,
    private locationService: LocationService,
    private purchaseService: PurchaseService,
    private purchaseOrderService: PurchaseOrderService,
    private goodsService: GoodsService,
    private productsService: ProductsService,
    private authService: AuthService,
    private stockService: StockService,
    private firestore: Firestore,
    private purchaseStockLogService: PurchaseStockPriceLogService,
    // ✅ SERVICE INJECTED
    // private dailyStockService: DailyStockService
  ) { }
  
  get purchaseOrdersOnly(): PurchaseOrderReference[] {
    if (!this.filteredPurchaseOrders) {
        return [];
    }
    return this.filteredPurchaseOrders.filter(o => o.type === 'purchase-order');
  }

  get directPurchasesOnly(): PurchaseOrderReference[] {
      if (!this.filteredPurchaseOrders) {
          return [];
      }
      return this.filteredPurchaseOrders.filter(o => o.type === 'direct-purchase');
  }

  ngOnInit(): void {
    this.initForm();
    this.loadSuppliers();
    this.loadLocations();
    this.loadAvailablePurchaseOrders();
    this.loadInvoiceNumbers();
    this.loadPaymentAccounts();
    this.setAddedByField();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
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

// 2. Trigger the hidden native picker
openDatePicker(): void {
  this.receivedDatePicker.nativeElement.showPicker();
}

// 3. Handle manual entry with validation
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
      
      const formattedDate = `${year}-${month}-${day}`; // ISO format for internal
      this.goodsReceivedForm.get(controlName)?.setValue(formattedDate);
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
  event.target.value = this.getFormattedDateForInput(this.goodsReceivedForm.get(controlName)?.value);
}
async saveForm(): Promise<void> {
    if (this.isProcessing) {
      console.log('Operation already in progress');
      return;
    }
    this.isProcessing = true;

    try {
      if (!this.goodsReceivedForm) {
        console.error('Form is not initialized');
        alert('Form initialization error. Please refresh the page.');
        this.isProcessing = false;
        return;
      }

      this.goodsReceivedForm.markAllAsTouched();

      if (this.goodsReceivedForm.invalid) {
        alert('Please fix the validation errors before saving.');
        this.isProcessing = false;
        return;
      }

      if (this.products.length === 0) {
        alert('Please add at least one product before saving.');
        this.isProcessing = false;
        return;
      }

      if (this.selectedPurchaseOrder) {
        for (const product of this.products) {
          const poProduct = this.selectedPurchaseOrder.products.find((p: any) => (p.productId || p.id) === product.id);
          
          if (poProduct) {
            const orderedQuantity = poProduct.quantity || poProduct.requiredQuantity || 0;
            if (product.receivedQuantity > orderedQuantity) {
              const errorMessage = `Cannot receive more than the ordered quantity for ${product.name}.\n\nOrdered: ${orderedQuantity}\nAttempting to receive: ${product.receivedQuantity}`;
              alert(errorMessage);
              throw new Error(errorMessage);
            }
          }
        }
      }

      if (this.selectedPurchaseOrder) {
        const availability = await this.goodsService.isPurchaseOrderAvailable(this.selectedPurchaseOrder.id);
        if (!availability.available) {
          alert(`Cannot save: ${availability.reason}\nThe page will refresh to show current available orders.`);
          this.clearSelectedPurchaseOrder();
          this.loadAvailablePurchaseOrders();
          this.isProcessing = false;
          return;
        }
      }

      const supplierId = this.goodsReceivedForm.get('supplier')?.value;
      const selectedSupplier = this.suppliers.find(s => s.id === supplierId);
      const locationId = this.goodsReceivedForm.get('businessLocation')?.value;
      const selectedLocation = this.locations.find(l => l.id === locationId);

      if (!selectedSupplier || !selectedLocation) {
        alert('Invalid supplier or location selected. Please refresh and try again.');
        this.isProcessing = false;
        return;
      }

      const formData = {
        ...this.goodsReceivedForm.value,
        supplier: selectedSupplier.id,
        supplierName: selectedSupplier.isIndividual
          ? `${selectedSupplier.firstName} ${selectedSupplier.lastName || ''}`.trim()
          : selectedSupplier.businessName,
        businessLocation: {
          id: locationId,
          name: selectedLocation.name
        },
        paymentAccount: this.selectedPaymentAccount ? {
          id: this.selectedPaymentAccount.id,
          name: this.selectedPaymentAccount.name || this.selectedPaymentAccount.accountName
        } : null,
        products: this.products.filter(p => p.name && p.name.trim() !== '').map(p => ({
          id: p.id,
          productId: p.id,
          productName: p.name,
          name: p.name,
          quantity: Number(p.receivedQuantity) || 0,
          receivedQuantity: Number(p.receivedQuantity) || 0,
          unitPrice: Number(p.unitPrice) || 0,
          lineTotal: Number(p.receivedQuantity) * (Number(p.unitPrice) || 0),
          orderQuantity: Number(p.orderQuantity) || 0,
          sku: p.sku || `SKU-${p.id}`,
          batchNumber: p.batchNumber || '',
          expiryDate: p.expiryDate || null,
          taxRate: p.taxRate || 0,
          pendingQuantity: (Number(p.orderQuantity) || 0) - (Number(p.receivedQuantity) || 0),
          pendingReason: p.pendingReason || '',
          isPartialDelivery: (Number(p.receivedQuantity) || 0) < (Number(p.orderQuantity) || 0),
          deliveryStatus: (Number(p.receivedQuantity) || 0) >= (Number(p.orderQuantity) || 0) ? 'complete' : 'partial'
        })),
        totalItems: this.totalItems,
        netTotalAmount: this.netTotalAmount,
        purchaseTotal: this.purchaseTotal,
        purchaseOrder: this.selectedPurchaseOrder?.id || null,
        purchaseReferenceNo: this.selectedPurchaseReferenceNo || '',
        purchaseType: this.selectedPurchaseOrder?.type || null,
        status: 'received',
        addedBy: this.goodsReceivedForm.get('addedBy')?.value || 'System',
        referenceNo: this.goodsReceivedForm.get('referenceNo')?.value || '',
        additionalNotes: this.goodsReceivedForm.get('additionalNotes')?.value || '',
        hasPartialDeliveries: this.products.some(p => (Number(p.receivedQuantity) || 0) < (Number(p.orderQuantity) || 0))
      };
      
      const formDate = this.goodsReceivedForm.get('purchaseDate')?.value;
      if (formDate) {
        formData.receivedDate = new Date(formDate);
      }

      console.log('Saving goods received note...');
      
      // ✅ The goodsService now handles daily snapshots internally
      const goodsReceivedRef = await this.goodsService.addGoodsReceived(formData);
      console.log('Goods received note saved successfully:', goodsReceivedRef.id);

      if (this.selectedPurchaseOrder) {
        await this.updatePurchaseOrderStatus(this.selectedPurchaseOrder.id, this.selectedPurchaseOrder.type);
        this.removePurchaseOrderFromLists(this.selectedPurchaseOrder.id);
      }
      
      // ❌ REMOVE: await this.updateStockWithDailySnapshot(formData);

      console.log('Goods received note saved and stock updated successfully');
      alert('Goods received note saved successfully!');
      this.resetForm();
      this.loadAvailablePurchaseOrders();

    } catch (error: any) {
      console.error('Error saving goods received:', error);
      
      const errorMessage = error.message || 'An unknown error occurred while saving.';
      alert(`Error: ${errorMessage}`);
      
      if (error.message.includes('purchase order') || error.message.includes('purchase')) {
        this.clearSelectedPurchaseOrder();
        this.loadAvailablePurchaseOrders();
      }
    } finally {
      this.isProcessing = false;
    }
  }

  todayISOString(): string {
    return new Date().toISOString().split('T')[0];
  }

  initForm(): void {
    this.goodsReceivedForm = this.fb.group({
      supplier: ['', Validators.required],
      businessLocation: ['', Validators.required],
      businessLocationName: [''],
      purchaseDate: [this.todayISOString(), Validators.required], // Set today's date
      purchaseOrder: [''],
      receivedDate: [''],
      paymentAccount: [''],
      paymentMethod: [''],
      additionalNotes: [''],
      invoiceNo: [''],
      addedBy: ['']
    });
  }

  setAddedByField(): void {
    const currentUser = this.authService.currentUserValue;
    if (currentUser) {
      const userName = currentUser.displayName || currentUser.email || 'System';
      this.goodsReceivedForm.get('addedBy')?.setValue(userName);
    }
  }

  async loadPaymentAccounts(): Promise<void> {
    try {
      this.paymentAccounts = (await this.purchaseStockLogService.getPaymentAccounts().toPromise()) || [];
      console.log('Payment accounts loaded:', this.paymentAccounts);
    } catch (error) {
      console.error('Error loading payment accounts:', error);
    }
  }

  onPendingQuantityChange(index: number): void {
    const product = this.products[index];
    if (product) {
      // Update received quantity based on pending quantity change
      product.receivedQuantity = product.orderQuantity - (product.pendingQuantity || 0);
      product.lineTotal = (product.receivedQuantity || 0) * (product.unitPrice || 0);
      product.isPartialDelivery = (product.pendingQuantity || 0) > 0;
      this.calculateTotals();
    }
  }

  onPaymentAccountChange(accountId: string): void {
    this.selectedPaymentAccount = this.paymentAccounts.find(acc => acc.id === accountId);
    this.goodsReceivedForm.get('paymentAccount')?.setValue(accountId);
  }

  loadSuppliers(): void {
    this.subscriptions.push(
      this.supplierService.getSuppliers().subscribe(suppliers => {
        this.suppliers = suppliers;
        this.filteredSuppliers = [...this.suppliers];
        console.log('Suppliers loaded:', this.suppliers.length);
      })
    );
  }

  loadLocations(): void {
    this.subscriptions.push(
      this.locationService.getLocations().subscribe(locations => {
        this.locations = locations;
        console.log('Locations loaded:', this.locations.length);
      })
    );
  }

  loadAvailablePurchaseOrders(): void {
    console.log('Loading available purchase orders and direct purchases...');
    
    this.subscriptions.push(
      this.goodsService.getAvailablePurchaseOrders().subscribe({
        next: (orders) => {
          console.log('Raw available orders from service:', orders);
          
          this.purchaseOrders = orders
            .filter(order => {
              const hasId = !!order['id'];
              const hasReferenceNo = !!order['referenceNo'];
              const isNotUsed = !order['isUsedForGoods'];
              
              let isAvailable = true;
              if (order['type'] === 'purchase-order') {
                isAvailable = order['status'] !== 'completed';
              } else if (order['type'] === 'direct-purchase') {
                isAvailable = true;
              }
              
              return hasId && hasReferenceNo && isNotUsed && isAvailable;
            })
            .map(order => ({
              id: order['id']!,
              referenceNo: order['referenceNo'] || `${order['type'] === 'direct-purchase' ? 'PUR' : 'PO'}-${order['id']!.substring(0, 8)}`,
              supplierId: order['supplierId'] || order['supplier'] || '',
              supplierName: order['supplierName'] || 'Unknown Supplier',
              purchaseDate: order['date'] || order['orderDate'] || order['purchaseDate'] || order['createdAt'] || new Date(),
              status: order['status'] || order['purchaseStatus'] || 'pending',
              products: order['products'] || order['items'] || [],
              invoiceNo: (order as any).invoiceNo || '',
              
              businessLocation: order['businessLocationId'] || order['businessLocation'] || order['location'] || 
                               (typeof order['businessLocation'] === 'object' ? order['businessLocation']?.id : null),

              orderTotal: order['orderTotal'] || order['purchaseTotal'] || order['grandTotal'] || 0,
              items: order['items'] || order['products'] || [],
              isUsedForGoods: order['isUsedForGoods'] || false,
              type: order['type'] || 'purchase-order',
              displayName: order['displayName'] || order['referenceNo'] || order['id']
            } as PurchaseOrderReference));
          
          this.filteredPurchaseOrders = [...this.purchaseOrders];
          
          if (this.selectedPurchaseOrder && 
              !this.purchaseOrders.find(o => o.id === this.selectedPurchaseOrder!.id)) {
            this.clearSelectedPurchaseOrder();
          }
          
          console.log('Available purchase orders and direct purchases loaded:', this.purchaseOrders.length);
          console.log('Types breakdown:', {
            purchaseOrders: this.purchaseOrders.filter(o => o.type === 'purchase-order').length,
            directPurchases: this.purchaseOrders.filter(o => o.type === 'direct-purchase').length
          });
        },
        error: (error) => {
          console.error('Error loading available purchase orders and direct purchases:', error);
          this.purchaseOrders = [];
          this.filteredPurchaseOrders = [];
          this.clearSelectedPurchaseOrder();
        }
      })
    );
  }

  loadInvoiceNumbers(): void {
    this.subscriptions.push(
      this.purchaseService.getPurchases().subscribe((purchases: Purchase[]) => {
        this.invoiceNumbers = purchases
          .filter(p => p.invoiceNo)
          .map(p => p.invoiceNo as string)
          .filter((value, index, self) => self.indexOf(value) === index);

        this.filteredInvoiceNumbers = [...this.invoiceNumbers];
        console.log('Invoice numbers loaded:', this.invoiceNumbers.length);
      })
    );
  }

  onSupplierChange(event: any): void {
    const supplierId = event?.target?.value || event;
    console.log('Supplier changed:', supplierId);
    this.goodsReceivedForm.get('supplier')?.setValue(supplierId);

    if (!supplierId) {
      this.selectedSupplier = null;
      this.filteredPurchaseOrders = [...this.purchaseOrders];
      return;
    }

    const supplier = this.suppliers.find(s => s.id === supplierId);
    if (supplier) {
      this.selectedSupplier = { ...supplier };
      this.selectedSupplier.formattedAddress = this.getFormattedAddress(supplier);
      
      this.filteredPurchaseOrders = this.purchaseOrders.filter(order =>
        order.supplierId === supplierId
      );
      
      console.log('Selected supplier:', this.selectedSupplier);
      console.log('Filtered orders for supplier:', this.filteredPurchaseOrders);
    }
  }

  // +++ MODIFIED METHOD +++
  async onPurchaseOrderChange(event: any): Promise<void> {
    const orderId = event?.target?.value || event;
    this.goodsReceivedForm.get('purchaseOrder')?.setValue(orderId);

    if (!orderId) {
      this.clearSelectedPurchaseOrder();
      return;
    }

    this.isValidatingOrder = true;
    
    try {
      const availability = await this.goodsService.isPurchaseOrderAvailable(orderId);
      
      if (!availability.available) {
        console.warn('Purchase order/purchase not available:', availability.reason);
        alert(`Purchase order/purchase is not available: ${availability.reason}`);
        this.clearSelectedPurchaseOrder();
        this.loadAvailablePurchaseOrders();
        return;
      }

      const selectedOrderFromList = this.purchaseOrders.find(o => o.id === orderId);
      let order: any = null;

      if (selectedOrderFromList?.type === 'direct-purchase') {
        order = await this.purchaseService.getPurchaseById(orderId);
        if (order) {
          order = {
            ...order,
            type: 'direct-purchase',
            supplierId: order.supplierId,
            supplierName: order.supplierName,
            purchaseDate: order.purchaseDate,
            orderDate: order.purchaseDate,
            referenceNo: order.referenceNo,
            status: order.purchaseStatus || 'received',
            products: order.products || [],
            items: order.products || [],
            invoiceNo: order.invoiceNo,
            businessLocation: order.businessLocation,
            businessLocationId: order.businessLocation,
            orderTotal: order.purchaseTotal || order.grandTotal,
            isUsedForGoods: order.isUsedForGoods || false
          };
        }
      } else {
        order = await this.purchaseOrderService.getOrderById(orderId);
        if (order) {
          order = { ...order, type: 'purchase-order' };
        }
      }

      if (order) {
        this.selectedPurchaseOrder = order as PurchaseOrderReference;
        this.selectedPurchaseReferenceNo = order.referenceNo || '';
        console.log('Selected and re-fetched latest order/purchase data:', order);

        // --- START: FIX FOR BUSINESS LOCATION ---
        let locationIdToSet = '';
        let locationNameToSet = '';

        // The identifier could be an ID (from a PO) or a Name (from a direct purchase)
        const locationIdentifier = order.businessLocationId || order.businessLocation; 

        if (locationIdentifier) {
          // First, try to find by ID (best for Purchase Orders)
          let location = this.locations.find(l => l.id === locationIdentifier);
          
          // If not found by ID, try to find by name (fallback for Direct Purchases)
          if (!location) {
            location = this.locations.find(l => l.name === locationIdentifier);
          }
          
          if (location) {
            locationIdToSet = location.id; // Always set the ID in the form control
            locationNameToSet = location.name;
          } else {
            console.warn(`Could not find a matching business location for identifier: "${locationIdentifier}"`);
          }
        }
        // --- END: FIX FOR BUSINESS LOCATION ---

        this.goodsReceivedForm.patchValue({
          supplier: order.supplierId || order.supplier,
          businessLocation: locationIdToSet, // Use the resolved ID
          businessLocationName: locationNameToSet, // Store the name internally
          invoiceNo: order.invoiceNo || '',
          purchaseDate: order.purchaseDate || order.orderDate ? this.formatDateForInput(order.purchaseDate || order.orderDate) : ''
        });

        const supplier = this.suppliers.find(s => s.id === (order.supplierId || order.supplier));
        if (supplier) {
          this.selectedSupplier = { ...supplier };
          this.selectedSupplier.formattedAddress = this.getFormattedAddress(supplier);
        }

        await this.populateProductsFromOrder(order as PurchaseOrderReference);
      } else {
        alert('Could not retrieve the details for the selected purchase order/purchase.');
        this.clearSelectedPurchaseOrder();
      }
    } catch (error) {
      console.error('Error selecting or fetching purchase order/purchase:', error);
      alert('An error occurred while fetching the purchase order/purchase details. Please try again.');
      this.clearSelectedPurchaseOrder();
    } finally {
      this.isValidatingOrder = false;
    }
  }

  async onInvoiceNoChange(invoiceNo: string): Promise<void> {
    if (!invoiceNo) return;
    this.goodsReceivedForm.get('invoiceNo')?.setValue(invoiceNo);

    this.subscriptions.push(
      this.purchaseService.getPurchases().subscribe(async (purchases: Purchase[]) => {
        const purchase = purchases.find(p => p.invoiceNo === invoiceNo);
        if (purchase) {
          this.goodsReceivedForm.patchValue({
            supplier: purchase.supplierId,
            purchaseDate: purchase.purchaseDate ?
              this.formatDateForInput(purchase.purchaseDate) : ''
          });

          const supplier = this.suppliers.find(s => s.id === purchase.supplierId);
          if (supplier) {
            this.selectedSupplier = { ...supplier };
            this.selectedSupplier.formattedAddress = this.getFormattedAddress(supplier);
          }

          if (purchase.products) {
            const productPromises = purchase.products.map(async (product: any) => {
              const productId = product.id || product.productId;
              try {
                const productDetails = await this.productsService.getProductById(productId);
                return this.createProductWithReason({
                  id: productId,
                  name: productDetails?.productName || product.productName || product.name,
                  sku: productDetails?.sku || product.sku || `SKU-${productId}`,
                  orderQuantity: product.quantity || 0,
                  receivedQuantity: product.quantity || 0,
                  unitPrice: product.unitCost || product.price || 0,
                  batchNumber: product.batchNumber || '',
                  expiryDate: product.expiryDate || '',
                  taxRate: product.taxRate || 0
                });
              } catch (error) {
                console.error(`Error fetching details for product ${productId}:`, error);
                return this.createProductWithReason({
                  id: productId,
                  name: product.productName || product.name || 'Unknown Product',
                  sku: product.sku || `SKU-${productId}`,
                  orderQuantity: product.quantity || 0,
                  receivedQuantity: product.quantity || 0,
                  unitPrice: product.unitCost || product.price || 0,
                  batchNumber: product.batchNumber || '',
                  expiryDate: product.expiryDate || '',
                  taxRate: product.taxRate || 0
                });
              }
            });
            this.products = await Promise.all(productPromises);
            this.calculateTotals();
          }
        }
      })
    );
  }

  async populateProductsFromOrder(order: PurchaseOrderReference): Promise<void> {
    const orderItems = order.items || order.products || [];
    
    if (orderItems && orderItems.length > 0) {
      const productPromises = orderItems.map(async (item: any) => {
        const productId = item.id || item.productId;
        try {
          const productDetails = await this.productsService.getProductById(productId);
          const orderQuantity = item.quantity || item.requiredQuantity || 0;

          return this.createProductWithReason({
            id: productId,
            name: productDetails?.productName || item.productName || item.name,
            sku: productDetails?.sku || item.sku || `SKU-${productId}`,
            orderQuantity: orderQuantity,
            receivedQuantity: orderQuantity,
            unitPrice: item.unitCost || item.price || item.unitPurchasePrice || item.unitCostBeforeTax || 0,
            batchNumber: item.batchNumber || '',
            expiryDate: item.expiryDate || '',
            taxRate: item.taxRate || item.taxPercent || 0
          });
        } catch (error) {
          console.error(`Error fetching details for product ${productId}:`, error);
          const orderQuantity = item.quantity || item.requiredQuantity || 0;

          return this.createProductWithReason({
            id: productId,
            name: item.productName || item.name || 'Unknown Product',
            sku: item.sku || `SKU-${productId}`,
            orderQuantity: orderQuantity,
            receivedQuantity: orderQuantity,
            unitPrice: item.unitCost || item.price || item.unitPurchasePrice || item.unitCostBeforeTax || 0,
            batchNumber: item.batchNumber || '',
            expiryDate: item.expiryDate || '',
            taxRate: item.taxRate || item.taxPercent || 0
          });
        }
      });
      this.products = await Promise.all(productPromises);
      this.products.forEach((_, index) => this.onQuantityChange(index));
      this.calculateTotals();
    } else {
      this.products = [];
      this.calculateTotals();
    }
  }

  private createProductWithReason(productData: any): ProductWithReason {
    const product: ProductWithReason = {
      ...productData,
      lineTotal: (productData.receivedQuantity || 0) * (productData.unitPrice || 0),
      pendingQuantity: 0,
      pendingReason: '',
      isPartialDelivery: false
    };
    return product;
  }

  getFormattedAddress(supplier: Supplier | null): string {
    if (!supplier) return 'No address available';

    const addressParts = [
      supplier.addressLine1,
      supplier.addressLine2,
      supplier.city,
      supplier.state,
      supplier.country,
      supplier.zipCode ? `- ${supplier.zipCode}` : ''
    ].filter(part => part && part.trim() !== '');

    return addressParts.join(', ');
  }

  private formatDateForInput(date: any): string {
    try {
        let dateObj: Date;
        // Handle Firestore Timestamp, JS Date, and string formats
        if (date && typeof date.toDate === 'function') {
            dateObj = date.toDate();
        } else if (date instanceof Date) {
            dateObj = date;
        } else {
            dateObj = new Date(date);
        }

        if (isNaN(dateObj.getTime())) {
            throw new Error('Invalid date value');
        }

        // Return in YYYY-MM-DD format for <input type="date">
        const year = dateObj.getFullYear();
        const month = ('0' + (dateObj.getMonth() + 1)).slice(-2);
        const day = ('0' + dateObj.getDate()).slice(-2);
        
        return `${year}-${month}-${day}`;
    } catch (e) {
        console.error('Error formatting date:', e, 'original value:', date);
        return '';
    }
}

  filterSuppliers(searchTerm: string): void {
    this.searchSupplierTerm = searchTerm.toLowerCase();
    if (!searchTerm) {
      this.filteredSuppliers = [...this.suppliers];
    } else {
      this.filteredSuppliers = this.suppliers.filter(supplier => {
        const name = supplier.isIndividual
          ? `${supplier.firstName || ''} ${supplier.lastName || ''}`.toLowerCase()
          : (supplier.businessName || '').toLowerCase();
        return name.includes(this.searchSupplierTerm);
      });
    }
  }

  filterPurchaseOrders(searchTerm: string | Event): void {
    const term = typeof searchTerm === 'string' 
      ? searchTerm 
      : (searchTerm.target as HTMLInputElement)?.value || '';
      
    this.searchPurchaseOrderTerm = term?.toLowerCase() || '';
    if (!term) {
      this.filteredPurchaseOrders = [...this.purchaseOrders];
    } else {
      this.filteredPurchaseOrders = this.purchaseOrders.filter(order => {
        return (order.referenceNo || '').toLowerCase().includes(this.searchPurchaseOrderTerm) ||
          (order.supplierName || '').toLowerCase().includes(this.searchPurchaseOrderTerm) ||
          (order.displayName || '').toLowerCase().includes(this.searchPurchaseOrderTerm);
      });
    }
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      console.log('File selected:', file.name);
      if (file.size > 5 * 1024 * 1024) {
        console.error('File size exceeds the 5MB limit');
      }
    }
  }

  addProduct(): void {
    this.products.push(this.createProductWithReason({
      id: this.products.length + 1,
      name: '',
      sku: '',
      orderQuantity: 0,
      receivedQuantity: 0,
      unitPrice: 0,
      batchNumber: '',
      expiryDate: '',
      taxRate: 0
    }));
    this.calculateTotals();
  }

  removeProduct(index: number): void {
    this.products.splice(index, 1);
    this.calculateTotals();
  }

  onQuantityChange(index: number): void {
    const product = this.products[index];
    if (product) {
      product.lineTotal = (product.receivedQuantity || 0) * (product.unitPrice || 0);
      
      if (product.receivedQuantity < product.orderQuantity) {
        product.isPartialDelivery = true;
        product.pendingQuantity = product.orderQuantity - product.receivedQuantity;
      } else {
        product.isPartialDelivery = false;
        product.pendingQuantity = 0;
        product.pendingReason = '';
      }
      
      this.calculateTotals();
    }
  }

  onReasonChange(index: number, reason: string): void {
    const product = this.products[index];
    if (product) {
      product.pendingReason = reason;
    }
  }

  calculateTotals(): void {
    this.totalItems = this.products.length;
    this.netTotalAmount = this.products.reduce((sum, product) => sum + (product.lineTotal || 0), 0);
    this.purchaseTotal = this.netTotalAmount;
  }





  private async updatePurchaseOrderStatus(purchaseOrderId: string, type?: string): Promise<void> {
    try {
      const now = serverTimestamp();
      if (type === 'direct-purchase') {
        const purchaseRef = doc(this.firestore, 'purchases', purchaseOrderId);
        await updateDoc(purchaseRef, {
          isUsedForGoods: true,
          usedForGoodsDate: now,
          updatedAt: now
        });
        console.log('Direct purchase marked as used for goods');
      } else {
        const purchaseOrderRef = doc(this.firestore, 'purchase-orders', purchaseOrderId);
        const purchaseOrderDoc = await getDoc(purchaseOrderRef);
        
        if (purchaseOrderDoc.exists()) {
          const purchaseOrder = purchaseOrderDoc.data();
          const goodsReceived = await this.getGoodsReceivedForPurchaseOrder(purchaseOrderId);
          
          const allProductsReceived = purchaseOrder['products'].every((poProduct: any) => {
            const totalReceived = goodsReceived.reduce((sum, grn) => {
              const grnProduct = grn.products.find((p: any) => p.productId === poProduct.productId);
              return sum + (grnProduct?.receivedQuantity || 0);
            }, 0);
            return totalReceived >= poProduct.quantity;
          });

          await updateDoc(purchaseOrderRef, {
            status: allProductsReceived ? 'completed' : 'partial',
            isUsedForGoods: true,
            updatedAt: now
          });
        }
      }
    } catch (error) {
      console.error('Error updating purchase order/purchase status:', error);
    }
  }

  private async getGoodsReceivedForPurchaseOrder(purchaseOrderId: string): Promise<any[]> {
    const q = query(
      collection(this.firestore, 'goodsReceived'),
      where('purchaseOrder', '==', purchaseOrderId)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data());
  }

  // NOTE: This method is kept for compatibility but goodsService.addGoodsReceived handles this now
  private async updateStock(formData: any): Promise<void> {
    // This is handled inside goodsService.addGoodsReceived now
    // We only need to ensure daily snapshot is updated for backdated entries
    // which is done by updateStockWithDailySnapshot
  }

  resetForm(): void {
    this.goodsReceivedForm.reset();
    this.products = [];
    this.totalItems = 0;
    this.netTotalAmount = 0;
    this.purchaseTotal = 0;
    this.selectedSupplier = null;
    this.selectedPurchaseOrder = null;
    this.selectedPurchaseReferenceNo = '';
    this.setAddedByField();
    this.initForm(); // Re-initialize to set default date

    this.filteredSuppliers = [...this.suppliers];
    this.filteredPurchaseOrders = [...this.purchaseOrders];
    this.filteredInvoiceNumbers = [...this.invoiceNumbers];
  }

  debugFormState(): void {
    console.log('=== FORM DEBUG INFO ===');
    console.log('Form valid:', this.goodsReceivedForm.valid);
    console.log('Form value:', this.goodsReceivedForm.value);
    console.log('Form errors:', this.goodsReceivedForm.errors);

    Object.keys(this.goodsReceivedForm.controls).forEach(key => {
      const control = this.goodsReceivedForm.get(key);
      console.log(`${key}:`, {
        value: control?.value,
        valid: control?.valid,
        errors: control?.errors
      });
    });

    console.log('Data loaded:', {
      suppliers: this.suppliers.length,
      locations: this.locations.length,
      purchaseOrders: this.purchaseOrders.length
    });
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

  onBusinessLocationChange(locationId: string | Event): void {
    const location = typeof locationId === 'string' 
      ? locationId 
      : (locationId.target as HTMLSelectElement)?.value || '';
    console.log('Business location changed', location);
    
    const selectedLocation = this.locations.find(l => l.id === location);
    if (selectedLocation) {
      console.log(`New location selected: ${selectedLocation.name} (ID: ${location})`);
    }
  }

  async displayStockSummary(): Promise<void> {
    if (this.products.length === 0) {
      console.log('No products to display stock summary for');
      return;
    }

    const locationId = this.goodsReceivedForm.get('businessLocation')?.value;
    const selectedLocation = this.locations.find(l => l.id === locationId);

    if (!selectedLocation) {
      console.log('No location selected for stock summary');
      return;
    }

    console.log(`=== STOCK SUMMARY FOR ${selectedLocation.name.toUpperCase()} ===`);

    for (let index = 0; index < this.products.length; index++) {
      const product = this.products[index];
      if (product.id && product.name) {
        const currentStock = await this.getCurrentStockAtLocation(product.id, locationId);
        const receivedQty = product.receivedQuantity || 0;
        const newStock = currentStock + receivedQty;

        console.log(`${index + 1}. ${product.name}`);
        console.log(`   Current: ${currentStock} | Receiving: ${receivedQty} | New Total: ${newStock}`);
      }
    }
    console.log('=== END STOCK SUMMARY ===');
  }

  async getCurrentStockDisplay(productId: string): Promise<string> {
    if (!productId) return '0';

    const locationId = this.goodsReceivedForm.get('businessLocation')?.value;
    if (!locationId) return 'Select location first';

    try {
      const stock = await this.getCurrentStockAtLocation(productId, locationId);
      return stock.toString();
    } catch (error) {
      console.error('Error getting stock display:', error);
      return 'Error';
    }
  }

  async hasStockData(productId: string): Promise<boolean> {
    if (!productId) return false;

    const locationId = this.goodsReceivedForm.get('businessLocation')?.value;
    if (!locationId) return false;

    try {
      const stockDocId = `${productId}_${locationId}`;
      const stockDocRef = doc(this.firestore, COLLECTIONS.PRODUCT_STOCK, stockDocId);
      const stockDoc = await getDoc(stockDocRef);
      return stockDoc.exists();
    } catch (error) {
      console.error('Error checking stock data:', error);
      return false;
    }
  }

  private validateProductsForStockUpdate(): string[] {
    const errors: string[] = [];

    for (let i = 0; i < this.products.length; i++) {
      const product = this.products[i];

      if (!product.id) {
        errors.push(`Product ${i + 1}: Missing product ID`);
      }

      if (!product.name || product.name.trim() === '') {
        errors.push(`Product ${i + 1}: Missing product name`);
      }

      if (!product.receivedQuantity || product.receivedQuantity <= 0) {
        // This is a soft validation
      }
    }
    return errors;
  }

  private clearSelectedPurchaseOrder(): void {
    this.selectedPurchaseOrder = null;
    this.selectedPurchaseReferenceNo = '';
    this.goodsReceivedForm.get('purchaseOrder')?.setValue('');
    this.products = [];
    this.calculateTotals();
  }

  private removePurchaseOrderFromLists(purchaseOrderId: string): void {
    this.purchaseOrders = this.purchaseOrders.filter(order => order.id !== purchaseOrderId);
    this.filteredPurchaseOrders = this.filteredPurchaseOrders.filter(order => order.id !== purchaseOrderId);

    if (this.selectedPurchaseOrder?.id === purchaseOrderId) {
      this.clearSelectedPurchaseOrder();
    }

    console.log('Purchase order/purchase removed from selection lists:', purchaseOrderId);
  }

  refreshPurchaseOrders(): void {
    console.log('Refreshing purchase orders and direct purchases list...');
    this.loadAvailablePurchaseOrders();
  }
}