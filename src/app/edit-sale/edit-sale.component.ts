import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { SaleService } from '../services/sale.service';
import { Router, ActivatedRoute } from '@angular/router';
import { DatePipe } from '@angular/common';
import { CustomerService } from '../services/customer.service';
import { AccountService } from '../services/account.service';
import { ProductsService } from '../services/products.service';

interface Product {
  name: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  subtotal: number;
  taxAmount?: number;
  taxRate?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  taxType?: string;
  priceBeforeTax?: number;
  id?: string;
  productId?: string;
  discountType?: string;
}

interface SalesOrder {
  customerId: string;
  billingAddress?: string;
  shippingAddress?: string;
  saleDate: string;
  status: string;
  invoiceScheme?: string;
  paymentStatus: string;
  
  invoiceNo?: string;
  document?: string;
  discountType?: string;
  transactionId?: string;
  discountAmount?: number;
  orderTax?: number; 
  sellNote?: string;
  shippingCharges?: number;
  paymentAccount: string;

  shippingStatus?: string;
  deliveryPerson?: string;
  shippingDocuments?: string;
  totalPayable?: number;
  paymentAmount?: number;
  paidOn?: string;
  paymentMethod?: string;
  paymentNote?: string;
  changeReturn?: number;
  balance?: number;
  products?: Product[];
  itemsTotal?: number;
  customerAge?: number | null;
  customerDob?: string | null;
  customerGender?: string;
  
  productTaxAmount?: number;
  shippingTaxAmount?: number;
  roundOff?: number;
  grossTotal?: number;
  netTotal?: number;
}

interface Customer {
  id: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  businessName?: string;
  age?: number;
  gender?: string;
  email?: string;
}

@Component({
  selector: 'app-edit-sale',
  templateUrl: './edit-sale.component.html',
  styleUrls: ['./edit-sale.component.scss'],
  providers: [DatePipe]
})
export class EditSaleComponent implements OnInit {
  saleForm!: FormGroup;
  todayDate: string;
  products: Product[] = [];
  allProducts: any[] = [];
  filteredProducts: any[] = [];
  customers: any[] = [];
  accounts: any[] = [];

  productSearchTerm: string = '';
  saleId: string = '';
  isEditing: boolean = false;
  isLoading: boolean = false;
  
  itemsTotal: number = 0;
  taxAmount: number = 0;
  productTaxAmount: number = 0;
  shippingTaxAmount: number = 0;
  grossTotal: number = 0;
  netTotal: number = 0;

  originalTotalPayable: number = 0;
  originalBalance: number = 0;
  originalPaymentAmount: number = 0;
  preserveOriginalTotals: boolean = true;

  constructor(
    private fb: FormBuilder,
    private saleService: SaleService,
    private router: Router,
    private route: ActivatedRoute,
    private datePipe: DatePipe,
    private accountService: AccountService,
    private customerService: CustomerService,
    private productService: ProductsService
  ) {
    this.todayDate = this.datePipe.transform(new Date(), 'yyyy-MM-dd') || '';
  }

  ngOnInit(): void {
    this.initializeForm();
    this.setupValueChanges();
    this.loadCustomers();
    this.loadAccounts();
    this.loadProducts();
    
    this.route.params.subscribe(params => {
      this.saleId = params['id'];
      if (this.saleId) {
        this.isEditing = true;
        this.loadSaleData(this.saleId);
      }
    });
  }

  loadAccounts(): void {
    this.isLoading = true;
    this.accountService.getAccounts((accounts: any[]) => {
      this.accounts = accounts;
      this.isLoading = false;
    });
  }

  loadSaleData(saleId: string): void {
    this.isLoading = true;
    this.saleService.getSaleById(saleId).subscribe({
      next: (sale) => {
        console.log('🔍 Original sale data loaded:', sale);
        
        this.originalTotalPayable = sale.totalPayable || 0;
        this.originalBalance = sale.balance || 0;
        this.originalPaymentAmount = sale.paymentAmount || 0;
        
        console.log('💰 Preserving original financial values:', {
          totalPayable: this.originalTotalPayable,
          balance: this.originalBalance,
          paymentAmount: this.originalPaymentAmount
        });

        this.saleForm.patchValue({
          customer: sale.customerId,
          paymentStatus: sale.paymentStatus || 'Due',
          billingAddress: sale.billingAddress,
          shippingAddress: sale.shippingAddress,
          paymentAccount: sale.paymentAccount || '',
          saleDate: sale.saleDate,
          status: sale.status,
          invoiceScheme: sale.invoiceScheme,
          invoiceNo: sale.invoiceNo,
          document: sale.document,
          discountType: sale.discountType || 'Percentage',
          discountAmount: sale.discountAmount || 0,
          orderTax: sale.orderTax || 0,
          sellNote: sale.sellNote,
          shippingCharges: sale.shippingCharges || 0,
          shippingStatus: sale.shippingStatus,
          deliveryPerson: sale.deliveryPerson,
          transactionId: sale.transactionId || '',
          shippingDocuments: sale.shippingDocuments,
          paidOn: sale.paidOn || this.todayDate,
          paymentMethod: sale.paymentMethod,
          paymentNote: sale.paymentNote,
          customerAge: sale.customerAge || null,
          customerDob: sale.customerDob || null,
          customerGender: sale.customerGender || '',
          
          totalPayable: this.originalTotalPayable,
          paymentAmount: this.originalPaymentAmount,
          balance: this.originalBalance,
          changeReturn: sale.changeReturn || 0,
          productTaxAmount: sale.productTaxAmount || 0,
          shippingTaxAmount: sale.shippingTaxAmount || 0,
          roundOff: sale.roundOff || 0
        });

        if (sale.products && sale.products.length > 0) {
          this.products = sale.products.map(product => ({
            name: product.name || product.productName || '',
            quantity: product.quantity || 0,
            unitPrice: product.unitPrice || 0,
            discount: product.discount || 0,
            subtotal: product.subtotal || 0,
            taxRate: product.taxRate || 0,
            taxAmount: product.taxAmount || 0,
            priceBeforeTax: product.priceBeforeTax || 0,
            id: product.id || product.productId,
            productId: product.productId || product.id
          }));
        } else {
          this.products = [];
        }

        this.calculateItemsTotal();
        this.calculateProductTaxes();
        this.calculateShippingTax();
        
        console.log('✅ Sale data loaded with preserved totals');
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading sale data:', error);
        alert('Error loading sale data. Please try again.');
        this.isLoading = false;
      }
    });
  }

  loadCustomers(): void {
    this.isLoading = true;
    this.customerService.getCustomers().subscribe({
      next: (customers: any[]) => {
        this.customers = customers.map(customer => ({
          ...customer,
          displayName: customer.businessName || 
                     `${customer.firstName} ${customer.middleName ? customer.middleName + ' ' : ''}${customer.lastName}`
        }));
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading customers:', error);
        this.isLoading = false;
      }
    });
  }
  
  loadProducts(): void {
    this.isLoading = true;
    this.productService.getProductsRealTime().subscribe({
      next: (products: any[]) => {
        this.allProducts = products;
        this.filteredProducts = [...products];
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading products:', error);
        this.isLoading = false;
      }
    });
  }

  filterProducts(): void {
    if (!this.productSearchTerm) {
      this.filteredProducts = [...this.allProducts];
      return;
    }
    
    const searchTerm = this.productSearchTerm.toLowerCase();
    this.filteredProducts = this.allProducts.filter(product => 
      product.productName.toLowerCase().includes(searchTerm)
    );
  }
  
  initializeForm(): void {
    this.saleForm = this.fb.group({
      customer: ['', Validators.required],
      customerName: [''],
      invoiceNo: [''],
      orderNo: [''],
      customerPhone: [''],
      transactionId: [''],
      status: ['Pending', Validators.required],
      paymentStatus: ['Due', Validators.required],
      alternateContact: [''],
      customerAge: [null],
      customerDob: [null],
      customerGender: [''],
      customerEmail: [''],
      shippingDetails: [''],
      roundOff: [0],
      productTaxAmount: [0],
      shippingTaxAmount: [0],
      codTaxAmount: [0],
      ppTaxAmount: [0],
      billingAddress: [''],
      shippingAddress: [''],
      saleDate: [this.todayDate, Validators.required],
      businessLocation: [''],
      invoiceScheme: [''],
      document: [null],
      discountType: ['Percentage'],
      discountAmount: [0, [Validators.min(0)]],
      orderTax: [18, [Validators.min(0), Validators.max(100)]],
      sellNote: [''],
      shippingCharges: [0, [Validators.min(0)]],
      shippingStatus: [''],
      deliveryPerson: [''],
      shippingDocuments: [null],
      totalPayable: [0],
      paymentAmount: [0, [Validators.required, Validators.min(0)]],
      paidOn: [this.todayDate],
      paymentMethod: ['', Validators.required],
      paymentNote: [''],
      changeReturn: [0],
      balance: [0],
      addedBy: [''],
      paymentAccount: ['', Validators.required]
    });
  }

  onDynamicProductSelect(productName: string, index: number): void {
    if (!productName) {
      this.products[index].unitPrice = 0;
      this.products[index].quantity = 0;
      this.updateProduct(index);
      return;
    }

    const selectedProduct = this.allProducts.find(p => p.productName === productName);
    if (selectedProduct) {
      this.products[index].name = selectedProduct.productName;
      this.products[index].unitPrice = selectedProduct.defaultSellingPriceExcTax || 0;
      this.products[index].taxRate = selectedProduct.taxRate || 0;
      this.products[index].id = selectedProduct.id;
      this.products[index].productId = selectedProduct.id;
      
      if (this.products[index].quantity <= 0) {
        this.products[index].quantity = 1;
      }
      
      this.updateProduct(index);
    }
  }

  setupValueChanges(): void {
    this.saleForm.get('paymentAmount')?.valueChanges.subscribe(() => {
      this.calculateBalanceOnly();
    });

    this.saleForm.get('discountAmount')?.valueChanges.subscribe(() => {
      if (!this.preserveOriginalTotals) {
        this.recalculateAllTotals();
      }
    });
    
    this.saleForm.get('discountType')?.valueChanges.subscribe(() => {
      if (!this.preserveOriginalTotals) {
        this.recalculateAllTotals();
      }
    });
    
    this.saleForm.get('shippingCharges')?.valueChanges.subscribe(() => {
      if (!this.preserveOriginalTotals) {
        this.recalculateAllTotals();
      }
    });
    
    this.saleForm.get('orderTax')?.valueChanges.subscribe(() => {
      if (!this.preserveOriginalTotals) {
        this.recalculateAllTotals();
      }
    });
  }

  calculateBalanceOnly(): void {
    const totalPayable = this.originalTotalPayable;
    const paymentAmount = this.saleForm.get('paymentAmount')?.value || 0;
    const roundOff = this.saleForm.get('roundOff')?.value || 0;
    
    const roundedTotal = totalPayable + roundOff;

    if (paymentAmount > roundedTotal) {
      this.saleForm.patchValue({
        changeReturn: parseFloat((paymentAmount - roundedTotal).toFixed(2)),
        balance: 0
      }, { emitEvent: false });
    } else {
      this.saleForm.patchValue({
        changeReturn: 0,
        balance: parseFloat((roundedTotal - paymentAmount).toFixed(2))
      }, { emitEvent: false });
    }

    console.log('💰 Balance calculated:', {
      totalPayable: totalPayable,
      paymentAmount: paymentAmount,
      balance: this.saleForm.get('balance')?.value
    });
  }

  getProductStock(productName: string): number {
    const product = this.allProducts.find(p => p.productName === productName);
    return product?.currentStock || 0;
  }

  addProduct(): void {
    this.products.push({
      name: '',
      quantity: 1,
      unitPrice: 0,
      discount: 0,
      subtotal: 0,
      taxRate: 0,
      taxAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      taxType: '',
      priceBeforeTax: 0
    });
    
    if (!this.preserveOriginalTotals) {
      this.recalculateAllTotals();
    } else {
      this.calculateItemsTotal();
    }
  }

  removeProduct(index: number): void {
    if (this.isEditing && this.products.length <= 1) {
      alert('In edit mode, you must keep at least one product.');
      return;
    }
    
    this.products.splice(index, 1);
    
    if (!this.preserveOriginalTotals) {
      this.recalculateAllTotals();
    } else {
      this.calculateItemsTotal();
    }
  }

  recalculateAllTotals(): void {
    if (this.preserveOriginalTotals && this.isEditing) {
      console.log('🔒 Preserving original totals in edit mode');
      this.calculateItemsTotal();
      this.calculateProductTaxes();
      this.calculateShippingTax();
      this.calculateBalanceOnly();
      return;
    }

    console.log('🚀 Starting comprehensive calculation...');
    
    this.calculateItemsTotal();
    const discountedTotal = this.calculateDiscountedTotal();
    this.calculateProductTaxes();
    const shippingWithTax = this.calculateShippingWithTax();
    this.calculateFinalTotals(discountedTotal, shippingWithTax);
    this.calculateRoundOff();
    this.calculateBalance();
    
    console.log('✅ Calculation completed successfully!');
  }

  calculateProductTaxes(): void {
    this.productTaxAmount = 0;
    for (const product of this.products) {
      this.calculateProductTax(product);
      this.productTaxAmount += product.taxAmount || 0;
    }
    
    this.saleForm.patchValue({
      productTaxAmount: this.productTaxAmount
    }, { emitEvent: false });
  }

  calculateShippingTax(): void {
    const shippingBeforeTax = this.saleForm.get('shippingCharges')?.value || 0;
    const taxRate = this.saleForm.get('orderTax')?.value || 0;
    
    this.shippingTaxAmount = shippingBeforeTax * (taxRate / 100);
    
    this.saleForm.patchValue({
      shippingTaxAmount: this.shippingTaxAmount
    }, { emitEvent: false });
  }

  calculateItemsTotal(): void {
    this.itemsTotal = this.products.reduce((sum, product) => {
      return sum + (product.subtotal || 0);
    }, 0);
    
    console.log('📊 Items Total:', this.itemsTotal);
  }

  calculateDiscountedTotal(): number {
    const discountAmount = this.saleForm.get('discountAmount')?.value || 0;
    const discountType = this.saleForm.get('discountType')?.value || 'Percentage';
    
    let discountedTotal = this.itemsTotal;
    
    if (discountType === 'Percentage') {
      discountedTotal = this.itemsTotal - (this.itemsTotal * discountAmount / 100);
    } else {
      discountedTotal = this.itemsTotal - discountAmount;
    }
    
    discountedTotal = Math.max(0, discountedTotal);
    
    console.log('💰 Discounted Total:', discountedTotal);
    
    return discountedTotal;
  }

  calculateProductTax(product: Product): void {
    const taxRate = product.taxRate || 0;
    const taxableAmount = (product.priceBeforeTax ?? 0) * product.quantity;
    
    product.taxAmount = (taxableAmount * taxRate) / 100;
    
    if (taxRate === 18) {
      product.taxType = 'CGST+SGST';
      product.cgstAmount = product.taxAmount / 2;
      product.sgstAmount = product.taxAmount / 2;
      product.igstAmount = 0;
    } else if (taxRate === 28) {
      product.taxType = 'IGST';
      product.igstAmount = product.taxAmount;
      product.cgstAmount = 0;
      product.sgstAmount = 0;
    } else if (taxRate === 12) {
      product.taxType = 'CGST+SGST';
      product.cgstAmount = product.taxAmount / 2;
      product.sgstAmount = product.taxAmount / 2;
      product.igstAmount = 0;
    } else if (taxRate === 5) {
      product.taxType = 'CGST+SGST';
      product.cgstAmount = product.taxAmount / 2;
      product.sgstAmount = product.taxAmount / 2;
      product.igstAmount = 0;
    } else if (taxRate > 0) {
      product.taxType = 'CGST+SGST';
      product.cgstAmount = product.taxAmount / 2;
      product.sgstAmount = product.taxAmount / 2;
      product.igstAmount = 0;
    } else {
      product.taxType = 'None';
      product.cgstAmount = 0;
      product.sgstAmount = 0;
      product.igstAmount = 0;
    }
  }

  calculateShippingWithTax(): number {
    const shippingBeforeTax = this.saleForm.get('shippingCharges')?.value || 0;
    const taxRate = this.saleForm.get('orderTax')?.value || 0;
    
    const shippingTax = shippingBeforeTax * (taxRate / 100);
    const shippingWithTax = shippingBeforeTax + shippingTax;
    
    this.saleForm.patchValue({
      shippingTaxAmount: shippingTax
    }, { emitEvent: false });
    
    return shippingWithTax;
  }

  calculateFinalTotals(discountedTotal: number, shippingWithTax: number): void {
    this.grossTotal = discountedTotal;
    this.netTotal = discountedTotal + this.productTaxAmount + shippingWithTax;
    
    const totalPayable = this.netTotal;
    
    this.saleForm.patchValue({
      totalPayable: parseFloat(totalPayable.toFixed(2))
    }, { emitEvent: false });
    
    console.log('💎 Final Totals:', {
      grossTotal: this.grossTotal,
      productTax: this.productTaxAmount,
      shippingWithTax: shippingWithTax,
      netTotal: this.netTotal,
      totalPayable: totalPayable
    });
  }

  calculateRoundOff(): void {
    const totalPayable = this.saleForm.get('totalPayable')?.value || 0;
    const roundedTotal = Math.round(totalPayable);
    const roundOff = roundedTotal - totalPayable;
    
    this.saleForm.patchValue({
      roundOff: parseFloat(roundOff.toFixed(2)),
      totalPayable: parseFloat(totalPayable.toFixed(2))
    }, { emitEvent: false });
    
    this.calculateBalance();
  }

  calculateBalance(): void {
    const totalPayable = this.saleForm.get('totalPayable')?.value || 0;
    const paymentAmount = this.saleForm.get('paymentAmount')?.value || 0;
    const roundOff = this.saleForm.get('roundOff')?.value || 0;
    
    const roundedTotal = totalPayable + roundOff;

    if (paymentAmount > roundedTotal) {
      this.saleForm.patchValue({
        changeReturn: parseFloat((paymentAmount - roundedTotal).toFixed(2)),
        balance: 0
      }, { emitEvent: false });
    } else {
      this.saleForm.patchValue({
        changeReturn: 0,
        balance: parseFloat((roundedTotal - paymentAmount).toFixed(2))
      }, { emitEvent: false });
    }
  }

  updateProduct(index: number): void {
    const product = this.products[index];
    
    if (product.priceBeforeTax !== undefined && product.taxRate !== undefined) {
      product.unitPrice = product.priceBeforeTax * (1 + (product.taxRate / 100));
    } else if (product.unitPrice !== undefined && product.taxRate !== undefined) {
      product.priceBeforeTax = product.unitPrice / (1 + (product.taxRate / 100));
    }

    this.calculateProductTax(product);

    const subtotalBeforeDiscount = product.quantity * product.unitPrice;

    let discountAmount = 0;
    if (product.discountType === 'Percentage') {
      discountAmount = (subtotalBeforeDiscount * product.discount) / 100;
    } else {
      discountAmount = product.discount;
    }

    const discountedSubtotal = subtotalBeforeDiscount - discountAmount;
    product.subtotal = discountedSubtotal;

    if (!this.preserveOriginalTotals) {
      this.recalculateAllTotals();
    } else {
      this.calculateItemsTotal();
      this.calculateProductTaxes();
      this.calculateBalanceOnly();
    }
  }

  togglePreservationMode(): void {
    this.preserveOriginalTotals = !this.preserveOriginalTotals;
    console.log('🔄 Preservation mode:', this.preserveOriginalTotals ? 'ON' : 'OFF');
    
    if (!this.preserveOriginalTotals) {
      this.recalculateAllTotals();
    } else {
      this.saleForm.patchValue({
        totalPayable: this.originalTotalPayable,
        balance: this.originalBalance
      });
    }
  }

  logCalculationDetails(): void {
    console.log('🔍 COMPLETE CALCULATION BREAKDOWN:');
    console.log('================================');
    console.log('Edit Mode:', this.isEditing);
    console.log('Preserve Original Totals:', this.preserveOriginalTotals);
    console.log('Original Total Payable:', this.originalTotalPayable);
    console.log('Current Total Payable:', this.saleForm.get('totalPayable')?.value);
    console.log('Original Balance:', this.originalBalance);
    console.log('Current Balance:', this.saleForm.get('balance')?.value);
    console.log('Products:', this.products);
    console.log('Items Total:', this.itemsTotal);
    console.log('Discount Amount:', this.saleForm.get('discountAmount')?.value);
    console.log('Discount Type:', this.saleForm.get('discountType')?.value);
    console.log('Product Tax Amount:', this.productTaxAmount);
    console.log('Shipping Charges:', this.saleForm.get('shippingCharges')?.value);
    console.log('Shipping Tax Rate:', this.saleForm.get('orderTax')?.value);
    console.log('Shipping Tax Amount:', this.shippingTaxAmount);
    console.log('Round Off:', this.saleForm.get('roundOff')?.value);
    console.log('Payment Amount:', this.saleForm.get('paymentAmount')?.value);
    console.log('Payment Status:', this.saleForm.get('paymentStatus')?.value);
    console.log('================================');
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.saleForm.patchValue({ document: file.name });
    }
  }

  onShippingDocumentSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.saleForm.patchValue({ shippingDocuments: file.name });
    }
  }

  // Helper function to clean undefined values
  private cleanObjectForFirestore(obj: any): any {
    const cleaned: any = {};
    
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];
        
        // Skip undefined values
        if (value === undefined) {
          continue;
        }
        
        // Handle null values (Firestore accepts null)
        if (value === null) {
          cleaned[key] = null;
          continue;
        }
        
        // Handle arrays
        if (Array.isArray(value)) {
          cleaned[key] = value.map(item => 
            typeof item === 'object' && item !== null 
              ? this.cleanObjectForFirestore(item) 
              : item
          );
          continue;
        }
        
        // Handle objects
        if (typeof value === 'object' && value !== null) {
          cleaned[key] = this.cleanObjectForFirestore(value);
          continue;
        }
        
        // Handle primitive values
        cleaned[key] = value;
      }
    }
    
    return cleaned;
  }

  updateSale(): void {
    console.log('🚀 Update Sale function called');
    console.log('Form valid:', this.saleForm.valid);
    console.log('Form errors:', this.getFormErrors());
    console.log('Products count:', this.products.length);

    // Check form validity
    if (this.saleForm.invalid) {
      this.markFormGroupTouched(this.saleForm);
      const errors = this.getFormErrors();
      console.error('Form validation errors:', errors);
      alert('Please fill all required fields correctly. Check: Customer, Sale Date, Status, Payment Amount, Payment Method, Payment Account');
      return;
    }

    // Check products
    if (this.products.length === 0) {
      alert('Please add at least one product');
      return;
    }

    // Validate products
    const invalidProducts = this.products.filter(p => 
      !p.name || p.quantity <= 0 || p.unitPrice < 0
    );

    if (invalidProducts.length > 0) {
      alert('Some products are invalid. Please check product name and quantity.');
      console.log('Invalid products:', invalidProducts);
      return;
    }

    // Final calculation before submission
    if (!this.preserveOriginalTotals) {
      this.recalculateAllTotals();
    } else {
      this.calculateBalanceOnly();
    }
    
    this.logCalculationDetails();

    this.isLoading = true;

    // Get selected customer details
    const selectedCustomerId = this.saleForm.get('customer')?.value;
    const selectedCustomer = this.customers.find(c => c.id === selectedCustomerId);
    const customerName = selectedCustomer?.displayName || 'Unknown Customer';

    // Create the sale data object with proper null/undefined handling
    const formValue = this.saleForm.value;
    
    const saleData = {
      // Basic sale information
      invoiceNo: formValue.invoiceNo || '',
      customerId: selectedCustomerId || '',
      paymentStatus: formValue.paymentStatus || 'Due',
      customer: customerName,
      balanceAmount: formValue.balance || 0,
      paymentAccount: formValue.paymentAccount || '',
      itemsTotal: this.itemsTotal || 0,
      
      // Customer details
      customerAge: formValue.customerAge || null,
      transactionId: formValue.transactionId || '',
      customerDob: formValue.customerDob || null,
      customerGender: formValue.customerGender || '',
      
      // Addresses and shipping
      billingAddress: formValue.billingAddress || '',
      shippingAddress: formValue.shippingAddress || '',
      shippingCharges: formValue.shippingCharges || 0,
      shippingStatus: formValue.shippingStatus || '',
      deliveryPerson: formValue.deliveryPerson || '',
      
      // Sale details
      saleDate: formValue.saleDate || this.todayDate,
      status: formValue.status || 'Pending',
      invoiceScheme: formValue.invoiceScheme || '',
      document: formValue.document || '',
      discountType: formValue.discountType || 'Percentage',
      discountAmount: formValue.discountAmount || 0,
      orderTax: formValue.orderTax || 0,
      sellNote: formValue.sellNote || '',
      shippingDocuments: formValue.shippingDocuments || '',
      
      // Payment details
      paymentAmount: formValue.paymentAmount || 0,
      paidOn: formValue.paidOn || this.todayDate,
      paymentMethod: formValue.paymentMethod || '',
      paymentNote: formValue.paymentNote || '',
      changeReturn: formValue.changeReturn || 0,
      
      // Tax and calculation fields
      productTaxAmount: this.productTaxAmount || 0,
      shippingTaxAmount: this.shippingTaxAmount || 0,
      grossTotal: this.grossTotal || 0,
      netTotal: this.netTotal || 0,
      roundOff: formValue.roundOff || 0,
      
      // Financial totals - preserve original if in preservation mode
      totalPayable: this.preserveOriginalTotals ? this.originalTotalPayable : (formValue.totalPayable || 0),
      balance: formValue.balance || 0,
      
      // Products with proper cleaning
      products: this.products.map(product => ({
        name: product.name || '',
        quantity: product.quantity || 0,
        unitPrice: product.unitPrice || 0,
        discount: product.discount || 0,
        subtotal: product.subtotal || 0,
        taxRate: product.taxRate || 0,
        taxAmount: product.taxAmount || 0,
        priceBeforeTax: product.priceBeforeTax || 0,
        id: product.id || '',
        productId: product.productId || '',
        discountType: product.discountType || 'Percentage',
        taxType: product.taxType || '',
        cgstAmount: product.cgstAmount || 0,
        sgstAmount: product.sgstAmount || 0,
        igstAmount: product.igstAmount || 0
      })),
      
      // Metadata
      updatedAt: new Date(),
      isEditOperation: true,
      skipStockValidation: true
    };

    // Clean the data to remove any undefined values
    const cleanedSaleData = this.cleanObjectForFirestore(saleData);

    console.log('🚀 Submitting cleaned sale data:', cleanedSaleData);

    this.saleService.updateSale(this.saleId, cleanedSaleData)
      .then(() => {
        this.isLoading = false;
        alert('Sale updated successfully! 🎉');
        this.router.navigate(['/sales-order']);
      })
      .catch(error => {
        this.isLoading = false;
        console.error('Error updating sale:', error);
        
        let errorMessage = 'Error updating sale. Please try again.';
        if (error?.message) {
          errorMessage = error.message;
        } else if (error?.error) {
          if (typeof error.error === 'string') {
            errorMessage = error.error;
          } else if (error.error.message) {
            errorMessage = error.error.message;
          }
        }

        alert(errorMessage);
      });
  }

  resetForm(): void {
    if (confirm('Are you sure you want to reset the form?')) {
      this.isLoading = true;
      this.loadSaleData(this.saleId);
    }
  }

  cancelEdit(): void {
    if (confirm('Are you sure you want to cancel? All unsaved changes will be lost.')) {
      this.router.navigate(['/sales-order']);
    }
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  private getFormErrors(): any {
    const errors: any = {};
    Object.keys(this.saleForm.controls).forEach(key => {
      const control = this.saleForm.get(key);
      if (control?.errors) {
        errors[key] = control.errors;
      }
    });
    return errors;
  }
}