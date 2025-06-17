import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Supplier, SupplierService } from '../services/supplier.service';
import { LocationService } from '../services/location.service';
import { PurchaseService } from '../services/purchase.service';
import { GoodsService } from '../services/goods.service';
import { Subscription } from 'rxjs';
import { AuthService } from '../auth.service';
import { StockService } from '../services/stock.service';

interface PurchaseOrder {
  id: string;
  referenceNo: string;
  supplierId: string;
  supplierName: string;
  purchaseDate: string | Date;
  status: string;
  products: any[];
  invoiceNo?: string;
}

interface Purchase {
  id?: string;
  referenceNo: string;
  supplierId: string;
  supplierName?: string;
  purchaseDate: string | Date;
  status?: string;
  products?: any[];
  invoiceNo?: string;
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
  private subscriptions: Subscription[] = [];

  constructor(
    private fb: FormBuilder,
    private supplierService: SupplierService,
    private locationService: LocationService,
    private purchaseService: PurchaseService,
    private goodsService: GoodsService,
    private authService: AuthService,
      private stockService: StockService

  ) { }

  ngOnInit(): void {
    this.initForm();
    this.loadSuppliers();
    this.loadLocations();
    this.loadPurchaseOrders();
    this.loadInvoiceNumbers();
    this.setAddedByField();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  initForm(): void {
    this.goodsReceivedForm = this.fb.group({
      supplier: ['', Validators.required],
      businessLocation: ['', Validators.required],
      purchaseDate: ['', Validators.required],
      purchaseOrder: [''], // Optional field
      additionalNotes: [''], // Optional field
      invoiceNo: [''], // Optional field
      addedBy: [''] // This will be set automatically
    });

    // Subscribe to form changes - REMOVED THE PROBLEMATIC VALUE CHANGES SUBSCRIPTIONS
    // These were causing circular updates and form sync issues
  }

  setAddedByField(): void {
    const currentUser = this.authService.currentUserValue;
    if (currentUser) {
      const userName = currentUser.displayName || currentUser.email || 'System';
      this.goodsReceivedForm.get('addedBy')?.setValue(userName);
    }
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

  loadPurchaseOrders(): void {
    this.subscriptions.push(
      this.purchaseService.getPurchases().subscribe((orders: Purchase[]) => {
        this.purchaseOrders = orders
          .filter(order => 
            (order.status === undefined || order.status !== 'Completed') && 
            order.referenceNo
          )
          .map(order => ({
            id: order.id,
            referenceNo: order.referenceNo,
            supplierId: order.supplierId,
            supplierName: order.supplierName || 'Unknown Supplier',
            purchaseDate: order.purchaseDate,
            status: order.status || 'Pending',
            products: order.products || [],
            invoiceNo: order.invoiceNo
          }));
        
        this.filteredPurchaseOrders = [...this.purchaseOrders];
        console.log('Purchase orders loaded:', this.purchaseOrders.length);
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

  // FIXED: Simplified purchase order change handler
  onPurchaseOrderChange(event: any): void {
    const orderId = event?.target?.value || event;
    
    console.log('Purchase order changed:', orderId);
    
    // Update form control value explicitly
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
      
      // Auto-fill form fields from purchase order
      this.goodsReceivedForm.patchValue({
        supplier: order.supplierId,
        invoiceNo: order.invoiceNo || '',
        purchaseDate: order.purchaseDate ? 
          this.formatDateForInput(order.purchaseDate) : ''
      });
      
      // Update supplier details
      const supplier = this.suppliers.find(s => s.id === order.supplierId);
      if (supplier) {
        this.selectedSupplier = { ...supplier };
        this.selectedSupplier.formattedAddress = this.getFormattedAddress(supplier);
      }
      
      this.populateProductsFromOrder(order);
      console.log('Selected purchase order:', this.selectedPurchaseOrder);
    }
  }

  onInvoiceNoChange(invoiceNo: string): void {
    if (!invoiceNo) return;
    
    // Update form control value explicitly
    this.goodsReceivedForm.get('invoiceNo')?.setValue(invoiceNo);
    
    this.subscriptions.push(
      this.purchaseService.getPurchases().subscribe((purchases: Purchase[]) => {
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
            this.products = purchase.products.map((product: any) => ({
              id: product.id || product.productId,
              name: product.productName || product.name,
              orderQuantity: product.quantity || 0,
              receivedQuantity: product.quantity || 0,
              unitPrice: product.unitCost || product.price || 0,
              lineTotal: (product.quantity || 0) * (product.unitCost || product.price || 0),
              batchNumber: product.batchNumber || '',
              expiryDate: product.expiryDate || '',
              taxRate: product.taxRate || 0
            }));
            this.calculateTotals();
          }
        }
      })
    );
  }

  populateProductsFromOrder(order: PurchaseOrder): void {
    if (order.products && order.products.length) {
      this.products = order.products.map((product: any) => ({
        id: product.id || product.productId,
        name: product.productName || product.name,
        orderQuantity: product.quantity || 0,
        receivedQuantity: product.quantity || 0,
        unitPrice: product.unitCost || product.price || 0,
        lineTotal: (product.quantity || 0) * (product.unitCost || product.price || 0),
        batchNumber: product.batchNumber || '',
        expiryDate: product.expiryDate || '',
        taxRate: product.taxRate || 0
      }));
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
      orderQuantity: 0,
      receivedQuantity: 0,
      unitPrice: 0,
      lineTotal: 0
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
  
  // Check if form is initialized
  if (!this.goodsReceivedForm) {
    console.error('Form is not initialized');
    alert('Form initialization error. Please refresh the page.');
    this.isProcessing = false;
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
    
    this.isProcessing = false;
    return;
  }

  // Additional validation checks
  const supplierId = this.goodsReceivedForm.get('supplier')?.value;
  if (!supplierId) {
    console.error('No supplier ID in form value');
    alert('Please select a supplier from the dropdown');
    this.isProcessing = false;
    return;
  }

  const selectedSupplier = this.suppliers.find(s => s.id === supplierId);
  if (!selectedSupplier) {
    console.error('Selected supplier not found in suppliers array');
    alert('Selected supplier is invalid. Please refresh and try again.');
    this.isProcessing = false;
    return;
  }

  // Validate products if needed
  if (this.products.length === 0) {
    const proceed = confirm('No products added. Do you want to continue anyway?');
    if (!proceed) {
      this.isProcessing = false;
      return;
    }
  }

  // Validate business location
  const locationId = this.goodsReceivedForm.get('businessLocation')?.value;
  const selectedLocation = this.locations.find(l => l.id === locationId);
  if (!selectedLocation) {
    console.error('Selected location not found');
    alert('Selected business location is invalid. Please refresh and try again.');
    this.isProcessing = false;
    return;
  }

  // Prepare form data - MERGED VERSION with enhanced product mapping
  const formData = {
    ...this.goodsReceivedForm.value,
    supplier: selectedSupplier.id,
    supplierName: selectedSupplier.isIndividual 
      ? `${selectedSupplier.firstName} ${selectedSupplier.lastName || ''}`.trim()
      : selectedSupplier.businessName,
    locationName: selectedLocation.name || selectedLocation.address,
    products: this.products.filter(p => p.name && p.name.trim() !== '').map(p => ({
      id: p.id,
      productId: p.id, // Ensure productId is set for stock updates
      productName: p.name,
      name: p.name, // Keep both for compatibility
      quantity: Number(p.receivedQuantity) || 0, // This is the received quantity
      receivedQuantity: Number(p.receivedQuantity) || 0,
      unitPrice: Number(p.unitPrice) || 0,
      lineTotal: Number(p.receivedQuantity) * (Number(p.unitPrice) || 0),
      orderQuantity: Number(p.orderQuantity) || 0
    })),
    totalItems: this.totalItems,
    netTotalAmount: this.netTotalAmount,
    purchaseTotal: this.purchaseTotal,
    purchaseOrder: this.selectedPurchaseOrder?.id || null,
    status: 'received',
    addedBy: this.goodsReceivedForm.get('addedBy')?.value || 'System',
    referenceNo: this.goodsReceivedForm.get('referenceNo')?.value || '',
    additionalNotes: this.goodsReceivedForm.get('additionalNotes')?.value || ''
  };

  console.log('=== FINAL FORM DATA ===');
  console.log(JSON.stringify(formData, null, 2));

  try {
    // First save the goods received note
    const goodsReceivedRef = await this.goodsService.addGoodsReceived({
      ...formData,
      receivedDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Then update stock for each product (using INCREMENT operation)
    if (formData.products && formData.products.length > 0) {
      const processedProducts = new Set(); 
      
      const stockUpdatePromises = formData.products.map(async (product: any) => {
        // Skip if invalid or already processed
        if (!product.id || product.receivedQuantity <= 0 || processedProducts.has(product.id)) {
          console.log(`Skipping product: ${product.id} - Invalid or already processed`);
          return;
        }
        processedProducts.add(product.id); // Mark as processed
        
        console.log(`Updating stock for product ${product.id}: +${product.receivedQuantity}`);
        
        await this.stockService.adjustProductStock(
          product.id,
          product.receivedQuantity, // Only this quantity gets added
          'add', // Ensures we INCREMENT rather than replace
          formData.businessLocation,
          `GRN-${goodsReceivedRef.id}`,
          formData.addedBy,
          {
            purchaseOrder: formData.purchaseOrder,
            invoiceNo: formData.invoiceNo || formData.referenceNo,
            supplierName: formData.supplierName
          }
        );
      });

      await Promise.all(stockUpdatePromises);
    }

    console.log('Goods received note saved and stock updated successfully');
    alert('Goods received successfully! Received quantities added to current stock.');
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
    if (error.code === 'stock-update-failed') {
      console.error('Stock update failed for one or more products');
      alert('Goods received note was saved, but stock update failed. Please check stock levels manually.');
    } else if (error.code === 'permission-denied') {
      alert('You do not have permission to perform this operation. Please contact your administrator.');
    } else if (error.code === 'network-request-failed') {
      alert('Network error occurred. Please check your internet connection and try again.');
    }
    
  } finally {
    this.isProcessing = false;
    console.log('=== SAVE FORM DEBUG END ===');
  }
}
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
}