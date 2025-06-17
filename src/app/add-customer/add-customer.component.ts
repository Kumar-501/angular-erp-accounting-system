import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CustomerDataService } from '../customer-data.service';
import { SalesOrderService } from '../services/sales-order.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { LocationService } from '../services/location.service';
import { UserService } from '../services/user.service';
import { TypeOfServiceService, Service } from '../services/type-of-service.service';
import { ProductsService } from '../services/products.service';
import { TaxService } from '../services/tax.service';
import { CommissionService } from '../services/commission.service';
interface Product {
  name: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  commissionPercent: number;
  commissionAmount: number;
  subtotal: number;
  currentStock: number;
  purchasePrice: number;
}


@Component({
  selector: 'app-add-customer',
  templateUrl: './add-customer.component.html',
  styleUrls: ['./add-customer.component.scss']
})

export class AddCustomerComponent implements OnInit {
  customerForm!: FormGroup;
  customerData: any;
  isSubmitting = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  locations: any[] = [];
  users: any[] = [];
  currentUser: any;
  services: Service[] = [];
  taxes: any[] = [];
  selectedTaxRate: number = 0;
  
  // Product related properties
  productSearchTerm: string = '';
  filteredProducts: any[] = [];
  allProducts: any[] = [];
  products: Product[] = [];
  defaultProduct: Product = {
    name: '',
    quantity: 0,
    unitPrice: 0,
    discount: 0,
    commissionPercent: 0,
    commissionAmount: 0,
    subtotal: 0,
    currentStock: 0,
    purchasePrice: 0
  };
  totalCommission: number = 0;
  itemsTotal: number = 0;
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    public router: Router,
    private route: ActivatedRoute,
    private customerDataService: CustomerDataService,
    private salesOrderService: SalesOrderService,
    private locationService: LocationService,
    private userService: UserService,
    private typeOfServiceService: TypeOfServiceService,
    private productsService: ProductsService,
    private taxService: TaxService,
    private commissionService: CommissionService
  ) {
    this.initializeForm();
  }


  initializeForm() {
    this.customerForm = this.fb.group({
      // New fields
      location: ['', Validators.required],
      addedBy: ['', Validators.required],
      typeOfService: ['', Validators.required],
      
         // Original fields
         customerName: ['', Validators.required],
         mobile: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
         email: ['', [Validators.required, Validators.email]],
         address: [''],
         city: [''],
         state: [''],
         country: [''],
         zipCode: [''],
         contactNumber: [''],
         billingAddress: [''],
         shippingAddress: [''],
         saleDate: ['', Validators.required],
         status: [''],
         invoiceScheme: [''],
         orderNo: [{value: '', disabled: true}, Validators.required],
         invoiceNo: [{value: '', disabled: true}],
         document: [''],
         discountType: ['percentage'],
         discountAmount: [0],
         orderTax: [0],
         sellNote: [''],
         shippingCharges: [0],
         shippingStatus: [''],
         deliveryPerson: [''],
         shippingDocuments: [''],
         totalPayable: [0, Validators.required],
         paymentAmount: [0, Validators.required],
         paidOn: [''],
         paymentMethod: ['', Validators.required],
         paymentNote: [''],
         changeReturn: [0],
         balance: [0]
       });
     
      // Setup value changes for calculations
      this.setupValueChanges();
    }
   
    ngOnInit(): void {
      this.getCustomerData();
      this.loadProducts();
      this.loadLocations();
      this.loadUsers();
      this.loadServices();
      this.loadTaxes();
      this.generateOrderNumber();
      this.generateInvoiceNumber();
   // Keep this call, but modify the method

    // Auto-generate order number if not editing an existing order
  if (!this.customerData?.orderNo) {
    this.generateOrderNumber();
    this.loadUsers(); // Add this line to load users
    this.loadServices(); // Add this line to load services
    if (!this.customerData?.invoiceNo) {
      this.generateInvoiceNumber();
    }

  }

  }
  loadTaxes() {
    this.taxService.getTaxes().subscribe({
      next: (taxes: any[]) => {  // Explicitly type the taxes parameter
        this.taxes = taxes;
      },
      error: (error: any) => {  // Explicitly type the error parameter
        console.error('Error loading taxes:', error);
      }
    });
  }

  setupValueChanges() {
    this.customerForm.get('discountAmount')?.valueChanges.subscribe(() => {
      this.calculateTotalPayable();
    });

    this.customerForm.get('orderTax')?.valueChanges.subscribe(() => {
      this.calculateTotalPayable();
    });

    this.customerForm.get('shippingCharges')?.valueChanges.subscribe(() => {
      this.calculateTotalPayable();
    });

    this.customerForm.get('discountType')?.valueChanges.subscribe(() => {
      this.calculateTotalPayable();
    });

    this.customerForm.get('paymentAmount')?.valueChanges.subscribe(() => {
      this.calculateBalance();
    });

    this.customerForm.get('addedBy')?.valueChanges.subscribe(userId => {
      this.onUserSelect(userId);
    });
  }

  async onUserSelect(userId: string): Promise<void> {
    if (!userId) return;
    
    const commissionPercent = await this.getAgentCommission(userId);
    
    this.products.forEach(product => {
      product.commissionPercent = commissionPercent;
      this.updateProduct(this.products.indexOf(product));
    });
    
    this.defaultProduct.commissionPercent = commissionPercent;
    this.updateDefaultProduct();
  }
  private async getAgentCommission(userId: string): Promise<number> {
    return new Promise((resolve) => {
      const unsubscribe = this.commissionService.listenToSalesAgents((agents) => {
        const agent = agents.find(a => a.userId === userId);
        unsubscribe(); 
        resolve(agent ? agent.commissionPercentage : 0);
      });
    });
  }

  async generateInvoiceNumber() {
    // Only generate if the field is empty
    if (!this.customerForm.get('invoiceNo')?.value) {
      try {
        const invoiceNo = await this.salesOrderService.generateInvoiceId();
        this.customerForm.patchValue({ invoiceNo: invoiceNo });
        // Make sure the form control is readonly
        this.customerForm.get('invoiceNo')?.disable();
      } catch (error) {
        console.error('Error generating invoice number:', error);
      }
    }
  }
loadUsers() {
  this.userService.getUsers().pipe(
    takeUntil(this.destroy$)
  ).subscribe({
    next: (users) => {
      this.users = users;
      console.log('Users loaded:', this.users);
      
      // If current user is set in the service, use it as default
      this.userService.getUserByIdOnce(localStorage.getItem('currentUserId') || '').subscribe(user => {
        if (user) {
          this.currentUser = user;
          this.customerForm.patchValue({
            addedBy: user.username || user.displayName || ''
          });
        }
      });
    },
    error: (err) => {
      console.error('Error loading users:', err);
    }
  });
}
async generateOrderNumber() {
  // Only generate if the field is empty
  if (!this.customerForm.get('orderNo')?.value) {
    try {
      const orderNo = await this.salesOrderService.generateOrderId();
      this.customerForm.patchValue({ orderNo: orderNo });
      // Make sure the form control is readonly
      this.customerForm.get('orderNo')?.disable();
    } catch (error) {
      console.error('Error generating order number:', error);
    }
  }
}
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  getCustomerData() {
    this.route.params.subscribe(params => {
      const customerId = params['id'];
      if (customerId) {
        this.customerDataService.getCustomer(customerId)
          .then(customer => {
            if (customer) {
              this.customerData = customer;
              this.prefillForm();
            } else {
              this.errorMessage = `No customer found with ID: ${customerId}`;
              this.customerData = null;
            }
          })
          .catch(error => {
            console.error('Error fetching customer data:', error);
            this.errorMessage = `Error loading customer data: ${error.message || 'Unknown error'}`;
          });
        return;
      }

      const navigation = this.router.getCurrentNavigation();
      this.customerData = navigation?.extras?.state?.['customerData'];

      if (!this.customerData) {
        const storedCustomer = localStorage.getItem('recentlyConvertedCustomer');
        if (storedCustomer) {
          try {
            this.customerData = JSON.parse(storedCustomer);
            localStorage.removeItem('recentlyConvertedCustomer');
          } catch (error) {
            console.error('Error parsing stored customer data:', error);
          }
        }
      }

      if (this.customerData) {
        this.prefillForm();
      }
    });
  }
  loadServices() {
    this.typeOfServiceService.getServicesRealtime().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (services) => {
        this.services = services;
        console.log('Services loaded:', this.services);
      },
      error: (err) => {
        console.error('Error loading services:', err);
      }
    });
  }

  loadLocations() {
    this.locationService.getLocations().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (locations) => {
        this.locations = locations.filter(loc => loc.active);
        console.log('Locations loaded:', this.locations);
      },
      error: (err) => {
        console.error('Error loading locations:', err);
        this.errorMessage = 'Failed to load locations. Using default options.';
        // Fallback to some default locations if needed
        this.locations = [
          { id: '1', name: 'Main Store' },
          { id: '2', name: 'Warehouse' },
          { id: '3', name: 'Online' }
        ];
      }
    });
  }

  prefillForm() {
    if (this.customerData) {
      this.customerForm.patchValue({
        customerName: this.customerData.displayName || this.customerData.customerName || '',
        mobile: this.customerData.mobile || '',
        email: this.customerData.email || '',
        address: `${(this.customerData.address || '').trim()} ${(this.customerData.addressLine1 || '').trim()} ${(this.customerData.addressLine2 || '').trim()}`.trim(),
        city: this.customerData.city || '',
        state: this.customerData.state || '',
        country: this.customerData.country || '',
        zipCode: this.customerData.zipCode || '',
        contactNumber: this.customerData.contactNumber || '',
        billingAddress: this.customerData.billingAddress || '',
        shippingAddress: this.customerData.shippingAddress || '',
        saleDate: this.customerData.saleDate || '',
        status: this.customerData.status || '',
        invoiceScheme: this.customerData.invoiceScheme || '',
        invoiceNo: this.customerData.invoiceNo || '',
        document: this.customerData.document || '',
        discountType: this.customerData.discountType || '',
        discountAmount: this.customerData.discountAmount || null,
        orderTax: this.customerData.orderTax || null,
        sellNote: this.customerData.sellNote || '',
        shippingCharges: this.customerData.shippingCharges || null,
        shippingStatus: this.customerData.shippingStatus || '',
        deliveryPerson: this.customerData.deliveryPerson || '',
        shippingDocuments: this.customerData.shippingDocuments || '',
        totalPayable: this.customerData.totalPayable || null,
        paymentAmount: this.customerData.paymentAmount || null,
        paidOn: this.customerData.paidOn || '',
        paymentMethod: this.customerData.paymentMethod || '',
        paymentNote: this.customerData.paymentNote || '',
        changeReturn: this.customerData.changeReturn || null,
        balance: this.customerData.balance || null,
        // New fields
        location: this.customerData.location || '',
        orderNo: this.customerData.orderNo || '',
        addedBy: this.customerData.addedBy || '',
        typeOfService: this.customerData.typeOfService || ''
      });
    }
  }

  async onSubmit() {
    if (this.customerForm.valid) {
      this.isSubmitting = true;
      this.errorMessage = null;
      this.successMessage = null;
  
      // Prepare data for convert collection
      const convertData = {
        customerName: this.customerForm.value.customerName,
        mobile: this.customerForm.value.mobile,
        email: this.customerForm.value.email,
        location: this.customerForm.value.location,
        orderNo: this.customerForm.value.orderNo,
        addedBy: this.customerForm.value.addedBy,
        typeOfService: this.customerForm.value.typeOfService,
        address: this.customerForm.value.address,
        billingAddress: this.customerForm.value.billingAddress,
        shippingAddress: this.customerForm.value.shippingAddress,
        city: this.customerForm.value.city,
        state: this.customerForm.value.state,
        country: this.customerForm.value.country,
        zipCode: this.customerForm.value.zipCode,
        contactNumber: this.customerForm.value.contactNumber,
        status: 'active'
      };
  
      // Prepare data for sales collection
      const salesData = {
        customer: this.customerForm.value.customerName,
        customerId: this.customerData?.id || '',
        customerPhone: this.customerForm.value.mobile,
        customerEmail: this.customerForm.value.email,
        businessLocation: this.customerForm.value.location,
        orderNo: this.customerForm.value.orderNo,
        addedBy: this.customerForm.value.addedBy,
        typeOfServiceName: this.customerForm.value.typeOfService,
        products: this.products.length > 0 ? this.products : [this.defaultProduct],
        saleDate: this.customerForm.value.saleDate || new Date().toISOString(),
        status: this.mapStatus(this.customerForm.value.status || 'Pending'),
        shippingStatus: this.customerForm.value.shippingStatus || 'Pending',
        paymentAmount: this.customerForm.value.paymentAmount || 0,
        totalPayable: this.itemsTotal,
        billingAddress: this.customerForm.value.billingAddress,
        shippingAddress: this.customerForm.value.shippingAddress,
        discountAmount: this.customerForm.value.discountAmount || 0,
        shippingCharges: this.customerForm.value.shippingCharges || 0,
        orderTax: this.customerForm.value.orderTax || 0,
        sellNote: this.customerForm.value.sellNote || '',
        paymentMethod: this.customerForm.value.paymentMethod || '',
        paymentNote: this.customerForm.value.paymentNote || ''
      };
  
      try {
        // Save customer data first
        const customerResult = await this.customerDataService.addCustomer(convertData);
        
        // Update sales data with customer ID if this is a new customer
        if (!salesData.customerId && customerResult?.id) {
          salesData.customerId = customerResult.id;
        }
        
        // Save sales data
        await this.customerDataService.addSale(salesData);
  
        this.successMessage = 'Customer and sales order saved successfully!';
        setTimeout(() => this.router.navigate(['/sales-order']), 1500);
      } catch (error: any) {
        console.error('Error saving data:', error);
        this.errorMessage = error.message || 'Failed to save data. Please try again.';
        this.isSubmitting = false;
      }
    } else {
      this.markFormGroupTouched(this.customerForm);
      this.errorMessage = 'Please fill in all required fields correctly.';
    }
  }
  private mapStatus(status: string): string {
    const statusMap: {[key: string]: string} = {
      'active': 'Completed',
      'inactive': 'Cancelled',
      'pending': 'Pending'
    };
    return statusMap[status.toLowerCase()] || status;
  }
  saveCustomerData(salesOrderData: any) {
    const customerData = {
      ...this.customerForm.value,
      id: this.customerData?.id,
      contactId: this.customerData?.contactId,
      createdAt: this.customerData?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      salesOrders: this.customerData?.salesOrders ? [...this.customerData.salesOrders, salesOrderData] : [salesOrderData]
    };

    if (this.customerData?.id) {
      return this.customerDataService.updateCustomer(this.customerData.id, customerData)
        .catch(error => {
          if (error.message && error.message.includes('No document to update')) {
            delete customerData.id;
            return this.customerDataService.addCustomer(customerData);
          }
          throw error;
        });
    } else {
      return this.customerDataService.addCustomer(customerData);
    }
  }

  // ... (rest of the methods remain the same)
  markFormGroupTouched(formGroup: FormGroup) {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();

      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  navigateToCustomers() {
    this.router.navigate(['/sales-order']);
  }
  loadProducts() {
    this.productsService.getProductsRealTime().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (products) => {
        this.allProducts = products.map(p => ({
          ...p,
          productName: p.name || p.productName
        }));
        this.filteredProducts = [...this.allProducts];
      },
      error: (err) => {
        console.error('Error loading products:', err);
        this.allProducts = [];
        this.filteredProducts = [];
      }
    });
  }

  
  filterProducts() {
    if (!this.productSearchTerm.trim()) {
      this.filteredProducts = [...this.allProducts];
      return;
    }
    
    const searchTerm = this.productSearchTerm.toLowerCase().trim();
    this.filteredProducts = this.allProducts.filter(product => 
      product.productName.toLowerCase().includes(searchTerm)
    );
  }
  onProductSelect(productName: string) {
    if (!productName) {
      this.resetDefaultProduct();
      return;
    }

    const selectedProduct = this.allProducts.find(p => p.productName === productName);
    if (selectedProduct) {
      this.defaultProduct = {
        name: selectedProduct.productName,
        quantity: 1,
        unitPrice: selectedProduct.defaultSellingPriceExcTax || 0,
        discount: 0,
        commissionPercent: this.defaultProduct.commissionPercent || 0,
        commissionAmount: 0,
        subtotal: selectedProduct.defaultSellingPriceExcTax || 0,
        currentStock: selectedProduct.currentStock || 0,
        purchasePrice: selectedProduct.defaultPurchasePriceExcTax || 0
      };
      this.updateDefaultProduct();
    }
  }

  
  onDynamicProductSelect(productName: string, index: number) {
    if (!productName) {
      this.products[index] = this.createEmptyProduct();
      this.updateTotals();
      return;
    }
    
    const selectedProduct = this.allProducts.find(p => p.productName === productName);
    if (selectedProduct) {
      this.products[index] = {
        name: selectedProduct.productName,
        quantity: 1,
        unitPrice: selectedProduct.defaultSellingPriceExcTax || 0,
        discount: 0,
        commissionPercent: this.products[index]?.commissionPercent || this.defaultProduct.commissionPercent || 0,
        commissionAmount: 0,
        subtotal: selectedProduct.defaultSellingPriceExcTax || 0,
        currentStock: selectedProduct.currentStock || 0,
        purchasePrice: selectedProduct.defaultPurchasePriceExcTax || 0
      };
      this.updateProduct(index);
    }
  }
  updateDefaultProduct() {
    const product = this.defaultProduct;
    
    // Validate quantity doesn't exceed stock
    if (product.quantity > (product.currentStock || 0)) {
      product.quantity = product.currentStock || 0;
      this.errorMessage = `Quantity cannot exceed available stock (${product.currentStock})`;
      setTimeout(() => this.errorMessage = null, 3000);
    }

    const subtotalBeforeDiscount = product.quantity * product.unitPrice;
    const discountedSubtotal = subtotalBeforeDiscount - product.discount;
    
    product.commissionAmount = (product.commissionPercent || 0) / 100 * discountedSubtotal;
    product.subtotal = discountedSubtotal - product.commissionAmount;
    
    this.calculateItemsTotal();
    this.calculateTotalPayable();
  }
  updateProduct(index: number) {
    const product = this.products[index];
    
    // Validate quantity doesn't exceed stock
    if (product.quantity > (product.currentStock || 0)) {
      product.quantity = product.currentStock || 0;
      this.errorMessage = `Quantity cannot exceed available stock (${product.currentStock})`;
      setTimeout(() => this.errorMessage = null, 3000);
    }

    const subtotalBeforeDiscount = product.quantity * product.unitPrice;
    const discountedSubtotal = subtotalBeforeDiscount - product.discount;
    
    product.commissionAmount = (product.commissionPercent || 0) / 100 * discountedSubtotal;
    product.subtotal = discountedSubtotal - product.commissionAmount;
    
    this.calculateItemsTotal();
    this.calculateTotalPayable();
  }
  

  addProduct() {
    if (this.defaultProduct.name || this.defaultProduct.quantity > 0 || this.defaultProduct.unitPrice > 0) {
      this.products.push({...this.defaultProduct});
      this.resetDefaultProduct();
    } else {
      this.products.push(this.createEmptyProduct());
    }
    
    this.calculateItemsTotal();
    this.calculateTotalPayable();
  }
  

  removeProduct(index: number) {
    this.products.splice(index, 1);
    this.calculateItemsTotal();
    this.calculateTotalPayable();
  }
  updateTotals() {
    this.totalCommission = this.products.reduce((sum, product) => sum + product.commissionAmount, 0);
    this.itemsTotal = this.products.reduce((sum, product) => sum + product.subtotal, 0);
    
    this.customerForm.patchValue({
      totalPayable: this.itemsTotal
    });
  }
  calculateItemsTotal() {
    const defaultProductValue = (this.defaultProduct.name || this.defaultProduct.quantity > 0 || this.defaultProduct.unitPrice > 0) 
      ? this.defaultProduct.subtotal 
      : 0;
    
    this.itemsTotal = this.products.reduce((sum, product) => sum + product.subtotal, defaultProductValue);
    this.totalCommission = this.products.reduce((sum, product) => sum + (product.commissionAmount || 0), 
      (this.defaultProduct.name || this.defaultProduct.quantity > 0 || this.defaultProduct.unitPrice > 0) 
        ? (this.defaultProduct.commissionAmount || 0) 
        : 0);
  }
  calculateTotalPayable() {
    const discount = this.customerForm.get('discountAmount')?.value || 0;
    const tax = this.customerForm.get('orderTax')?.value || 0;
    const shipping = this.customerForm.get('shippingCharges')?.value || 0;

    let total = this.itemsTotal;
    
    if (this.customerForm.get('discountType')?.value === 'percentage') {
      total -= (total * discount / 100);
    } else {
      total -= discount;
    }

    total += (total * tax / 100);
    total += shipping;

    this.customerForm.patchValue({ totalPayable: total.toFixed(2) });
    this.calculateBalance();
  }
  calculateBalance() {
    const totalPayable = this.customerForm.get('totalPayable')?.value || 0;
    const paymentAmount = this.customerForm.get('paymentAmount')?.value || 0;

    if (paymentAmount > totalPayable) {
      this.customerForm.patchValue({
        changeReturn: (paymentAmount - totalPayable).toFixed(2),
        balance: 0
      });
    } else {
      this.customerForm.patchValue({
        changeReturn: 0,
        balance: (totalPayable - paymentAmount).toFixed(2)
      });
    }
  }
  private resetDefaultProduct() {
    this.defaultProduct = {
      name: '',
      quantity: 0,
      unitPrice: 0,
      discount: 0,
      commissionPercent: this.defaultProduct.commissionPercent || 0,
      commissionAmount: 0,
      subtotal: 0,
      currentStock: 0,
      purchasePrice: 0
    };
  }
  private createEmptyProduct(): Product {
    return {
      name: '',
      quantity: 0,
      unitPrice: 0,
      discount: 0,
      commissionPercent: this.defaultProduct.commissionPercent || 0,
      commissionAmount: 0,
      subtotal: 0,
      currentStock: 0,
      purchasePrice: 0
    };
  }

}