import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Supplier, SupplierService } from '../services/supplier.service';
import { LocationService } from '../services/location.service';
import { Purchase, PurchaseService } from '../services/purchase.service';
import { GoodsService } from '../services/goods.service';
import { ProductsService } from '../services/products.service';
import { Subscription } from 'rxjs';
import { AuthService } from '../auth.service';
import { StockService } from '../services/stock.service';
import { Firestore, collection, doc, setDoc, getDoc, increment } from '@angular/fire/firestore';
import { PurchaseStockPriceLogService } from '../services/purchase-stock-price-log.service';

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

interface PurchaseOrder {
  id: string;
  referenceNo: string;
  supplierId: string;
  supplierName: string;
  purchaseDate: string | Date;
  status: string;
  products: any[];
  invoiceNo?: string;
  businessLocation: {
    id: string;
    name: string;
  };
  reciviedDate?: string | Date;
}

interface ExtendedSupplier extends Supplier {
  formattedAddress?: string;
}

@Component({
  selector: 'app-add-goods',
  templateUrl: './add-goods.component.html',
  styleUrls: ['./add-goods.component.scss'],
})
export class AddGoodsComponent implements OnInit, OnDestroy {
  goodsReceivedForm!: FormGroup;
  products: any[] = [];
  totalItems: number = 0;
  paymentAccounts: any[] = [];
  selectedPaymentAccount: any = null;

  netTotalAmount: number = 0;
  purchaseTotal: number = 0;
  filteredPurchaseOrders: PurchaseOrder[] = [];
  selectedPurchaseOrder: PurchaseOrder | null = null;
  invoiceNumbers: string[] = [];
  filteredInvoiceNumbers: string[] = [];
  formattedAddress?: string;
  filteredSuppliers: Supplier[] = [];
  searchSupplierTerm: string = '';
  searchPurchaseOrderTerm: string = '';
  isProcessing: boolean = false;

  suppliers: Supplier[] = [];
  locations: any[] = [];
  selectedSupplier: ExtendedSupplier | null = null;

  purchaseOrders: any[] = [];
  private subscriptions: Subscription[] = []; constructor(
    private fb: FormBuilder,
    private supplierService: SupplierService,
    private locationService: LocationService,
    private purchaseService: PurchaseService,
    private goodsService: GoodsService,
    private productsService: ProductsService,
    private authService: AuthService,
    private stockService: StockService,
    private firestore: Firestore,
    private purchaseStockLogService: PurchaseStockPriceLogService

  ) { }

  ngOnInit(): void {
    this.initForm();
    this.loadSuppliers();
    this.loadLocations();
    this.loadPurchaseOrders();
    this.loadInvoiceNumbers();
    this.loadPaymentAccounts();

    this.setAddedByField();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
  todayISOString(): string {
    return new Date().toISOString().slice(0, 16);
  }

  initForm(): void {
    this.goodsReceivedForm = this.fb.group({
      supplier: ['', Validators.required],
      businessLocation: ['', Validators.required],
      businessLocationName: [''], // Initialize with empty string
      purchaseDate: ['', Validators.required],
      purchaseOrder: [''],
      receivedDate: ['', Validators.required],
      paymentAccount: [''],  // Add this
      paymentMethod: [''],   // Add this
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

  // In your component
  loadPurchaseOrders(): void {
    this.subscriptions.push(
      this.purchaseService.getPurchases().subscribe((orders: Purchase[]) => {
        this.purchaseOrders = orders
          .filter(order =>
            (order['status'] === undefined || order['status'] !== 'completed') &&
            order.referenceNo &&
            order.id !== undefined
          )
          .map(order => ({
            id: order.id,
            referenceNo: order.referenceNo,
            supplierId: order.supplierId,
            supplierName: order.supplierName || 'Unknown Supplier',
            purchaseDate: order.purchaseDate,
            status: order['status'] || 'pending',
            products: order.products || [],
            invoiceNo: order.invoiceNo,
            businessLocation: order.businessLocation // Add this line
          }));
        this.filteredPurchaseOrders = [...this.purchaseOrders];
      })
    );
  }


  private isOrderReceived(orderId: string): boolean {
    // You might want to check against a service or local list of received orders
    // This is just a placeholder - implement based on your actual data structure
    return false;
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

  // FIXED: Simplified supplier change handler
  onSupplierChange(event: any): void {
    const supplierId = event?.target?.value || event;

    console.log('Supplier changed:', supplierId);

    // Update form control value explicitly
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

      // Filter purchase orders for this supplier
      this.filteredPurchaseOrders = this.purchaseOrders.filter(order =>
        order.supplierId === supplierId
      );

      console.log('Selected supplier:', this.selectedSupplier);
      console.log('Form supplier value after change:', this.goodsReceivedForm.get('supplier')?.value);
    }
  }

  async onPurchaseOrderChange(event: any): Promise<void> {
    const orderId = event?.target?.value || event;
    this.goodsReceivedForm.get('purchaseOrder')?.setValue(orderId);

    if (!orderId) {
      this.selectedPurchaseOrder = null;
      this.products = [];
      this.calculateTotals();
      return;
    }

    const order = this.purchaseOrders.find(o => o.id === orderId);

    if (order) {
      this.selectedPurchaseOrder = order;

      // Get the location name from the order or find it in locations array
      let locationName = '';
      if (order.businessLocation && order.businessLocation.name) {
        locationName = order.businessLocation.name;
      } else {
        const location = this.locations.find(l => l.id === order.businessLocation?.id);
        locationName = location?.name || '';
      }

      this.goodsReceivedForm.patchValue({
        supplier: order.supplierId,
        businessLocation: order.businessLocation?.id,
        businessLocationName: locationName, // Ensure this is set
        invoiceNo: order.invoiceNo || '',
        purchaseDate: order.purchaseDate ?
          this.formatDateForInput(order.purchaseDate) : ''
      });

      const supplier = this.suppliers.find(s => s.id === order.supplierId); if (supplier) {
        this.selectedSupplier = { ...supplier };
        this.selectedSupplier.formattedAddress = this.getFormattedAddress(supplier);
      }
      await this.populateProductsFromOrder(order);
    }
  } async onInvoiceNoChange(invoiceNo: string): Promise<void> {
    if (!invoiceNo) return;

    // Update form control value explicitly
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
            // Fetch complete product details for each product to get SKU and other info
            const productPromises = purchase.products.map(async (product: any) => {
              const productId = product.id || product.productId;

              try {
                // Fetch complete product details to get SKU
                const productDetails = await this.productsService.getProductById(productId);

                return {
                  id: productId,
                  name: productDetails?.productName || product.productName || product.name,
                  sku: productDetails?.sku || product.sku || `SKU-${productId}`,
                  orderQuantity: product.quantity || 0,
                  receivedQuantity: product.quantity || 0,
                  unitPrice: product.unitCost || product.price || 0,
                  lineTotal: (product.quantity || 0) * (product.unitCost || product.price || 0),
                  batchNumber: product.batchNumber || '',
                  expiryDate: product.expiryDate || '',
                  taxRate: product.taxRate || 0
                };
              } catch (error) {
                console.error(`Error fetching details for product ${productId}:`, error);
                // Return basic product info if fetch fails
                return {
                  id: productId,
                  name: product.productName || product.name || 'Unknown Product',
                  sku: product.sku || `SKU-${productId}`,
                  orderQuantity: product.quantity || 0,
                  receivedQuantity: product.quantity || 0,
                  unitPrice: product.unitCost || product.price || 0,
                  lineTotal: (product.quantity || 0) * (product.unitCost || product.price || 0),
                  batchNumber: product.batchNumber || '',
                  expiryDate: product.expiryDate || '',
                  taxRate: product.taxRate || 0
                };
              }
            });

            this.products = await Promise.all(productPromises);
            this.calculateTotals();
          }
        }
      })
    );
  }

  async populateProductsFromOrder(order: PurchaseOrder): Promise<void> {
    if (order.products && order.products.length) {
      // Fetch complete product details for each product to get SKU and other info
      const productPromises = order.products.map(async (product: any) => {
        const productId = product.id || product.productId;

        try {
          // Fetch complete product details to get SKU
          const productDetails = await this.productsService.getProductById(productId);

          return {
            id: productId,
            name: productDetails?.productName || product.productName || product.name,
            sku: productDetails?.sku || product.sku || `SKU-${productId}`,
            orderQuantity: product.quantity || 0,
            receivedQuantity: product.quantity || 0,
            unitPrice: product.unitCost || product.price || 0,
            lineTotal: (product.quantity || 0) * (product.unitCost || product.price || 0),
            batchNumber: product.batchNumber || '',
            expiryDate: product.expiryDate || '',
            taxRate: product.taxRate || 0
          };
        } catch (error) {
          console.error(`Error fetching details for product ${productId}:`, error);
          // Return basic product info if fetch fails
          return {
            id: productId,
            name: product.productName || product.name || 'Unknown Product',
            sku: product.sku || `SKU-${productId}`,
            orderQuantity: product.quantity || 0,
            receivedQuantity: product.quantity || 0,
            unitPrice: product.unitCost || product.price || 0,
            lineTotal: (product.quantity || 0) * (product.unitCost || product.price || 0),
            batchNumber: product.batchNumber || '',
            expiryDate: product.expiryDate || '',
            taxRate: product.taxRate || 0
          };
        }
      });

      this.products = await Promise.all(productPromises);
      this.calculateTotals();
    } else {
      this.products = [];
      this.calculateTotals();
    }
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
      if (typeof date === 'object' && 'toDate' in date) {
        dateObj = date.toDate();
      } else if (date instanceof Date) {
        dateObj = date;
      } else {
        dateObj = new Date(date);
      }

      return dateObj.toISOString().slice(0, 16);
    } catch (e) {
      console.error('Error formatting date:', e);
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

  filterPurchaseOrders(searchTerm: string): void {
    this.searchPurchaseOrderTerm = searchTerm.toLowerCase();
    if (!searchTerm) {
      this.filteredPurchaseOrders = [...this.purchaseOrders];
    } else {
      this.filteredPurchaseOrders = this.purchaseOrders.filter(order => {
        return (order.referenceNo || '').toLowerCase().includes(this.searchPurchaseOrderTerm) ||
          (order.supplierName || '').toLowerCase().includes(this.searchPurchaseOrderTerm);
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
    this.products.push({
      id: this.products.length + 1,
      name: '',
      sku: '',
      orderQuantity: 0,
      receivedQuantity: 0,
      unitPrice: 0,
      lineTotal: 0,
      batchNumber: '',
      expiryDate: '', taxRate: 0
    });
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
      this.calculateTotals();
    }
  }

  calculateTotals(): void {
    this.totalItems = this.products.length;
    this.netTotalAmount = this.products.reduce((sum, product) => sum + (product.lineTotal || 0), 0);
    this.purchaseTotal = this.netTotalAmount;
  }

  async saveForm(): Promise<void> {
    // Add processing flag at class level (add this to your component properties)
    if (this.isProcessing) {
      console.log('Operation already in progress');
      return;
    }
    this.isProcessing = true;

    console.log('=== SAVE FORM DEBUG START ===')

    try {
      // Check if form is initialized
      if (!this.goodsReceivedForm) {
        console.error('Form is not initialized');
        alert('Form initialization error. Please refresh the page.');
        return;
      }

      // Mark all fields as touched first to trigger validation display
      this.goodsReceivedForm.markAllAsTouched();

      // Detailed form debugging
      console.log('Form valid:', this.goodsReceivedForm.valid);
      console.log('Form status:', this.goodsReceivedForm.status);
      console.log('Form value:', this.goodsReceivedForm.value);
      console.log('Form errors:', this.goodsReceivedForm.errors);

      // Check each required field individually
      const requiredFields = ['supplier', 'businessLocation', 'purchaseDate'];
      const fieldErrors: any = {};
      let hasErrors = false;

      requiredFields.forEach(fieldName => {
        const control = this.goodsReceivedForm.get(fieldName);
        if (control) {
          console.log(`${fieldName}:`, {
            value: control.value,
            valid: control.valid,
            errors: control.errors,
            touched: control.touched,
            dirty: control.dirty
          });

          if (control.invalid) {
            fieldErrors[fieldName] = control.errors;
            hasErrors = true;
          }
        } else {
          console.error(`Field ${fieldName} not found in form`);
        }
      });

      // Check data loading status
      console.log('Data Status:', {
        suppliers: this.suppliers.length,
        locations: this.locations.length,
        selectedSupplier: this.selectedSupplier,
        products: this.products.length
      });

      // ENHANCED: Better error handling and user feedback
      if (hasErrors) {
        console.log('=== FORM VALIDATION ERRORS ===');
        console.log('Field errors:', fieldErrors);

        // Create detailed error message
        const errorMessages = [];
        if (fieldErrors.supplier) {
          errorMessages.push('• Supplier is required - Please select a supplier from the dropdown');
        }
        if (fieldErrors.businessLocation) {
          errorMessages.push('• Business Location is required - Please select a location');
        }
        if (fieldErrors.purchaseDate) {
          errorMessages.push('• Purchase Date is required - Please select a date and time');
        }

        const errorTitle = 'Please fix the following validation errors:';
        const errorMessage = `${errorTitle}\n\n${errorMessages.join('\n')}`;

        alert(errorMessage);

        // Focus on the first invalid field
        const firstInvalidField = requiredFields.find(field =>
          this.goodsReceivedForm.get(field)?.invalid
        );
        if (firstInvalidField) {
          const element = document.getElementById(firstInvalidField);
          if (element) {
            element.focus();
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }

        return;
      }

      // Additional validation checks
      const supplierId = this.goodsReceivedForm.get('supplier')?.value;
      if (!supplierId) {
        console.error('No supplier ID in form value');
        alert('Please select a supplier from the dropdown');
        return;
      }

      const selectedSupplier = this.suppliers.find(s => s.id === supplierId);
      if (!selectedSupplier) {
        console.error('Selected supplier not found in suppliers array');
        alert('Selected supplier is invalid. Please refresh and try again.');
        return;
      }

      // Validate products if needed
      if (this.products.length === 0) {
        const proceed = confirm('No products added. Do you want to continue anyway?');
        if (!proceed) {
          return;
        }
      } else {
        // Validate that products have valid IDs for stock updates
        const productsWithoutIds = this.products.filter(p => !p.id && p.receivedQuantity > 0);
        if (productsWithoutIds.length > 0) {
          console.error('Some products do not have valid IDs:', productsWithoutIds);
          alert(`${productsWithoutIds.length} product(s) do not have valid IDs and cannot be processed for stock updates. Please check the product selection.`);
          return;
        }

        // Count products that will actually be processed for stock updates
        const validProducts = this.products.filter(p => p.id && p.receivedQuantity > 0);
        console.log(`✓ Products validation: ${validProducts.length} valid products will be processed for stock updates`);
      }

      // Validate business location
      const locationId = this.goodsReceivedForm.get('businessLocation')?.value;
      if (!locationId) {
        console.error('No business location selected');
        alert('Please select a business location before saving. This is required for stock updates.');
        return;
      }

      const selectedLocation = this.locations.find(l => l.id === locationId);
      if (!selectedLocation) {
        console.error('Selected location not found in locations array');
        alert('Selected business location is invalid. Please refresh and try again.');
        return;
      }

      console.log(`✓ Business location validated: ${selectedLocation.name} (ID: ${locationId})`);      // Prepare form data - MERGED VERSION with enhanced product mapping
      const formData = {
        ...this.goodsReceivedForm.value,
        supplier: selectedSupplier.id,
        supplierName: selectedSupplier.isIndividual
          ? `${selectedSupplier.firstName} ${selectedSupplier.lastName || ''}`.trim()
          : selectedSupplier.businessName,
        businessLocation: {
          id: this.goodsReceivedForm.get('businessLocation')?.value,
          name: selectedLocation?.name || this.goodsReceivedForm.get('businessLocationName')?.value || 'Unknown Location'
        },
        // Ensure payment account is properly structured
        paymentAccount: this.selectedPaymentAccount ? {
          id: this.selectedPaymentAccount.id,
          name: this.selectedPaymentAccount.name || this.selectedPaymentAccount.accountName
        } : null,
        products: this.products.filter(p => p.name && p.name.trim() !== '').map(p => ({
          id: p.id,
          productId: p.id, // Ensure productId is set for stock updates
          productName: p.name,
          name: p.name, // Keep both for compatibility
          quantity: Number(p.receivedQuantity) || 0, // This is the received quantity
          receivedQuantity: Number(p.receivedQuantity) || 0,
          unitPrice: Number(p.unitPrice) || 0,
          lineTotal: Number(p.receivedQuantity) * (Number(p.unitPrice) || 0),
          orderQuantity: Number(p.orderQuantity) || 0,
          sku: p.sku || `SKU-${p.id}`, // Ensure SKU is always set
          batchNumber: p.batchNumber || '',
          expiryDate: p.expiryDate || null,
          taxRate: p.taxRate || 0
        })),
        totalItems: this.totalItems,
        netTotalAmount: this.netTotalAmount,
        purchaseTotal: this.purchaseTotal,
        purchaseOrder: this.selectedPurchaseOrder?.id || null,
        status: 'received',
        addedBy: this.goodsReceivedForm.get('addedBy')?.value || 'System',
        referenceNo: this.goodsReceivedForm.get('referenceNo')?.value || '',
        additionalNotes: this.goodsReceivedForm.get('additionalNotes')?.value || '',
        receivedDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      console.log('=== FINAL FORM DATA ===');
      console.log(JSON.stringify(formData, null, 2));

      // Validate products for stock update
      const productValidationErrors = this.validateProductsForStockUpdate();
      if (productValidationErrors.length > 0) {
        console.error('Product validation errors:', productValidationErrors);
        alert('Product validation errors:\n' + productValidationErrors.join('\n'));
        return;
      }

      // First save the goods received note
      console.log('Saving goods received note...');
      const goodsReceivedRef = await this.goodsService.addGoodsReceived(formData);
      console.log('Goods received note saved successfully:', goodsReceivedRef.id);

      // Remove the purchase order from the dropdown lists if it was used
      if (formData.purchaseOrder) {
        this.removePurchaseOrderFromLists(formData.purchaseOrder);
      }      // Then update stock (price logging is handled by GoodsService)
      await this.updateStock(formData);

      console.log('Goods received note saved and stock updated successfully');

      // Count successful stock updates
      const validProducts = formData.products?.filter((p: any) => p.id && p.receivedQuantity > 0) || [];
      const successMessage = validProducts.length > 0
        ? `Goods received successfully! Stock updated for ${validProducts.length} product(s) at ${formData.businessLocation.name}.`
        : 'Goods received successfully!';

      alert(successMessage);
      this.resetForm();

    } catch (error: any) {
      console.error('Error saving goods received:', error);

      // Enhanced error messaging
      let errorMessage = 'Error saving goods received: ';
      if (error.message) {
        errorMessage += error.message;
      } else if (error.code) {
        errorMessage += `Error code: ${error.code}`;
      } else {
        errorMessage += 'Please try again.';
      }

      alert(errorMessage);

      // Additional error handling for specific scenarios
      if (error.message?.includes('Failed to update stock')) {
        console.error('Stock update failed for one or more products');
        alert('Goods received note was saved, but stock update failed for some products. Please check stock levels manually.');
      } else if (error.code === 'permission-denied') {
        alert('You do not have permission to perform this operation. Please contact your administrator.');
      } else if (error.code === 'network-request-failed') {
        alert('Network error occurred. Please check your internet connection and try again.');
      } else if (error.code === 'firestore/permission-denied') {
        alert('Permission denied. You may not have access to update stock at this location.');
      }
    } finally {
      this.isProcessing = false;
      console.log('=== SAVE FORM DEBUG END ===');
    }
  }  private async updateStock(formData: any): Promise<void> {
    const locationId = formData.businessLocation.id;
    const locationName = formData.businessLocation.name;

    for (const product of formData.products) {
      try {
        // Update stock
        await this.updateProductStockAtLocation(
          product.id,
          product.name,
          product.sku,
          locationId,
          locationName,
          product.receivedQuantity,
          product.unitPrice,
          product.batchNumber,
          product.expiryDate
        );

        // Note: Purchase stock price logging is now handled by GoodsService.addGoodsReceived()
        // to avoid duplicate entries. Removed the duplicate logPriceChange call.
      } catch (error) {
        console.error(`Error processing product ${product.id}:`, error);
        throw error;
      }
    }
  }

  // Helper method to ensure all products have SKUs
  private async ensureAllProductsHaveSkus(): Promise<void> {
    for (const product of this.products) {
      if (!product.sku) {
        try {
          const productDetails = await this.productsService.getProductById(product.id);
          product.sku = productDetails?.sku || `SKU-${product.id}`;
        } catch (error) {
          console.error(`Error fetching SKU for product ${product.id}:`, error);
          product.sku = `SKU-${product.id}`;
        }
      }
    }
  }

  private async updateStockForProducts(formData: any): Promise<void> {
    const locationId = formData.businessLocation.id;
    const locationName = formData.businessLocation.name;

    for (const product of formData.products) {
      try {
        await this.updateProductStockAtLocation(
          product.id,
          product.name,
          product.sku || `SKU-${product.id}`, // Fallback SKU
          locationId,
          locationName,
          product.receivedQuantity,
          product.unitPrice
        );
      } catch (error) {
        console.error(`Failed to update stock for product ${product.id}:`, error);
        // Continue with other products even if one fails
      }
    }
  }

  private removePurchaseOrderFromLists(purchaseOrderId: string): void {
    // Remove from main purchaseOrders array
    this.purchaseOrders = this.purchaseOrders.filter(order => order.id !== purchaseOrderId);

    // Remove from filteredPurchaseOrders array
    this.filteredPurchaseOrders = this.filteredPurchaseOrders.filter(order => order.id !== purchaseOrderId);

    // If this was the selected purchase order, clear it
    if (this.selectedPurchaseOrder?.id === purchaseOrderId) {
      this.selectedPurchaseOrder = null;
      this.goodsReceivedForm.get('purchaseOrder')?.setValue('');
    }

    console.log('Purchase order removed from selection lists:', purchaseOrderId);
  }
  // (Removed misplaced if block that caused syntax errors)

  resetForm(): void {
    this.goodsReceivedForm.reset();
    this.products = [];
    this.totalItems = 0;
    this.netTotalAmount = 0;
    this.purchaseTotal = 0;
    this.selectedSupplier = null;
    this.selectedPurchaseOrder = null;
    this.setAddedByField(); // Reset the addedBy field

    // Reset filtered arrays
    this.filteredSuppliers = [...this.suppliers];
    this.filteredPurchaseOrders = [...this.purchaseOrders];
    this.filteredInvoiceNumbers = [...this.invoiceNumbers];
  }

  // Debug method - you can call this from template to check form state
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
      locations: this.locations.length
    });
  }

  /**
   * Update stock for a product at a specific location using PRODUCT_STOCK collection
   */  private async updateProductStockAtLocation(
    productId: string,
    productName: string,
    sku: string, // Make sure this parameter is included
    locationId: string,
    locationName: string,
    quantityToAdd: number,
    unitCost?: number,
    batchNumber?: string,

    expiryDate?: string
  ): Promise<void> {
    try {
      // Validate inputs
      if (!productId || !locationId || quantityToAdd <= 0) {
        throw new Error(`Invalid parameters: productId=${productId}, locationId=${locationId}, quantityToAdd=${quantityToAdd}`);
      }

      const stockDocId = `${productId}_${locationId}`;
      const stockDocRef = doc(this.firestore, COLLECTIONS.PRODUCT_STOCK, stockDocId);

      console.log(`Processing stock update: Product ${sku} at ${locationName}, adding ${quantityToAdd} units`);

      // Get current stock document
      const stockDoc = await getDoc(stockDocRef);

      if (stockDoc.exists()) {
        // Update existing stock - increment quantity
        const currentData = stockDoc.data();
        const currentQuantity = currentData?.['quantity'] || 0;

        // await setDoc(stockDocRef, {
        //   quantity: increment(quantityToAdd),
        //   unitCost: unitCost || currentData?.['unitCost'],
        //   batchNumber: batchNumber || currentData?.['batchNumber'] || '',
        //   expiryDate: expiryDate || currentData?.['expiryDate'] || null,
        //   updatedAt: new Date()
        // }, { merge: true });

        console.log(`✓ Updated existing stock for ${sku} at ${locationName}: ${currentQuantity} → ${currentQuantity + quantityToAdd} (+${quantityToAdd})`);
      } else {
        // Create new stock entry
        const stockData: ProductStock = {
          productId: productId,
          productName: productName,
          sku: sku,
          locationId: locationId,
          locationName: locationName,
          quantity: quantityToAdd,
          unitCost: unitCost,
          batchNumber: batchNumber || '',
          expiryDate: expiryDate || null,

          createdAt: new Date(),
          updatedAt: new Date()
        };

        await setDoc(stockDocRef, stockData);
        console.log(`✓ Created new stock entry for ${sku} at ${locationName}: 0 → ${quantityToAdd} (+${quantityToAdd})`);
      }
    } catch (error) {
      console.error(`✗ Error updating stock for product ${productId} at location ${locationId}:`, error);
      throw new Error(`Failed to update stock for ${productName} at ${locationName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }


  /**
   * Get current stock quantity for a product at a specific location
   */
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

  /**
   * Handle business location change to update current stock for all products
   */async onBusinessLocationChange(locationId: string): Promise<void> {
    if (locationId && this.products.length > 0) {
      console.log('Business location changed');
      const selectedLocation = this.locations.find(l => l.id === locationId);
      if (selectedLocation) {
        console.log(`New location selected: ${selectedLocation.name} (ID: ${locationId})`);
      }
    }
  }
  /**
   * Display stock summary for debugging and user feedback
   */
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
        // Get current stock from PRODUCT_STOCK collection
        const currentStock = await this.getCurrentStockAtLocation(product.id, locationId);
        const receivedQty = product.receivedQuantity || 0;
        const newStock = currentStock + receivedQty;

        console.log(`${index + 1}. ${product.name}`);
        console.log(`   Current: ${currentStock} | Receiving: ${receivedQty} | New Total: ${newStock}`);
      }
    }
    console.log('=== END STOCK SUMMARY ===');
  }

  /**
   * Get current stock for display in UI (async method for template use)
   * This method can be called from the template to show current stock
   */
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

  /**
   * Check if we have valid stock data for a product at current location
   */
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

  /**
   * Validate that all products have the necessary data for stock updates
   */
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
      // SKU validation is optional here since we can fetch it from product details later
      // if (!product.sku || product.sku.trim() === '') {
      //   errors.push(`Product ${i + 1}: Missing SKU`);
      // }

      if (!product.receivedQuantity || product.receivedQuantity <= 0) {
        errors.push(`Product ${i + 1}: Invalid received quantity (${product.receivedQuantity})`);
      }
    }
    return errors;
  }
}