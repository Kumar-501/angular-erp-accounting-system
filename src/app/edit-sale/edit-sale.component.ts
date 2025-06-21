import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { SaleService } from '../services/sale.service';
import { Router, ActivatedRoute } from '@angular/router';
import { DatePipe } from '@angular/common';
import { CustomerService } from '../services/customer.service';
import { ProductsService } from '../services/products.service';
import { LocationService } from '../services/location.service';
import { TypeOfServiceService, Service } from '../services/type-of-service.service';
import { UserService } from '../services/user.service';
import { CommissionService } from '../services/commission.service';
import { LeadService } from '../services/leads.service';
import { TaxService } from '../services/tax.service';
import { TaxRate, TaxGroup } from '../tax/tax.model';
import { AccountService } from '../services/account.service';
import { AuthService } from '../auth.service';
import * as bootstrap from 'bootstrap';
import { ToastrService } from 'ngx-toastr';
import { defaultIfEmpty, lastValueFrom } from 'rxjs';

interface Product {
  id?: string;
  name: string;
  productName?: string;
  sku?: string;
  discountType: 'Amount' | 'Percentage'; 
  barcode?: string;
  stockByLocation?: { [locationId: string]: number };
  totalQuantity?: number;
  manageStock?: boolean; 
  taxType?: string;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  lastNumber?: string;
  lastNumbers?: string[];
  currentStock?: number;
  defaultSellingPriceExcTax?: number;
  defaultSellingPriceIncTax?: number;
  batchNumber?: string;
  expiryDate?: string;
  batches?: {
    batchNumber: string;
    expiryDate: string;
    quantity: number;
  }[];
  taxRate?: number;
  taxAmount?: number;
  quantity: number;
  unitPrice: number;
  discount: number;
  commissionPercent?: number;
  commissionAmount?: number;
  subtotal: number;
  priceBeforeTax: number;
  taxIncluded: boolean;
}

interface Medicine {
  name: string;
  type: string;
  dosage?: string;
  instructions?: string;
  instructions1?: string;
  instructions2?: string;
  ingredients?: string;
  pills?: string;
  powder?: string;
  time: string;
  frequency?: string;
  [key: string]: any;
  quantity?: string;
}

interface PrescriptionData {
  patientName: any;
  date: string;
  medicines: Medicine[];
  patientAge?: string;
  additionalNotes?: string;
}

@Component({
  selector: 'app-edit-sale',
  templateUrl: './edit-sale.component.html',
  styleUrls: ['./edit-sale.component.scss'],
  providers: [DatePipe],
})
export class EditSaleComponent implements OnInit {
  saleForm!: FormGroup;
  todayDate: string;
  products: Product[] = [];
  lastInteractionTime = 0;
  showProductsInterestedDropdown = false;
  productInterestedSearch = '';
  isSubmitting = false;
  filteredProductsForInterested: any[] = [];
  prescriptions: PrescriptionData[] = [];
  editingPrescriptionIndex: number | null = null;
  currentPrescriptionModal: any;
  selectedProductsForInterested: any[] = [];
  selectedPaymentAccount: any = null;
  taxAmount: number = 0;
  availableTaxRates: TaxRate[] = [];
  shippingDocuments: File[] = [];
  afterTaxShippingControl: FormControl<number | null> = new FormControl<number | null>(null);
  showTransactionIdField = false;
  dropdownFilterFocused = false;
  availableTaxGroups: (TaxGroup & { calculatedRate: number })[] = [];
  allProducts: any[] = [];
  filteredProducts: any[] = [];
  customers: any[] = [];
  currentDate = new Date();
  Date = Date; 
  showCustomerEditPopup = false;

  // Edit mode specific properties
  saleId: string = '';
  isEditing: boolean = true;
  originalTotalPayable: number = 0;
  originalBalance: number = 0;
  originalPaymentAmount: number = 0;
  preserveOriginalTotals: boolean = true;
  
  // Prescription data
  prescriptionData: PrescriptionData = {
    medicines: [{
      name: '',
      dosage: '',
      instructions: '',
      ingredients: '',
      pills: '',
      powder: '',
      time: '',
      type: ''
    }],
    patientName: undefined,
    date: ''
  };

  selectedCustomerForEdit: any = null;
  users: any[] = [];
  dropdownClosing = false;
  totalCommission: number = 0;
  businessLocations: any[] = [];
  showCodPopup = false;
  codData: any = null;
  serviceTypes: Service[] = [];
  productSearchTerm: string = '';
  currentUser: string = '';
  selectedMedicineType: string = '';
  customerSearchInput: string = '';
  showCustomerDropdown: boolean = false;
  paymentAccounts: any[] = [];
  showPpServicePopup = false;
  ppServiceData: any = null;
  searchTerm: string = '';
  searchResults: Product[] = [];
  showSearchResults: boolean = false;
  filterOptions = {
    inStockOnly: false,
    priceRange: {
      min: 0,
      max: 10000
    }
  };

  private searchTimeout: any;
  private closeDropdownTimeout: any;

  defaultProduct: Product = {
    name: '',
    quantity: 1,
    unitPrice: 0,
    discount: 0,
    subtotal: 0,
    commissionPercent: 0,
    commissionAmount: 0,
    priceBeforeTax: 0,
    taxIncluded: false,
    discountType: 'Amount',
    batchNumber: '',
    lastNumber: '',
    lastNumbers: [],
    batches: [],
    taxRate: 0,
    taxAmount: 0,
    cgstAmount: 0,
    sgstAmount: 0,
    igstAmount: 0,
    taxType: ''
  };
  
  itemsTotal: number = 0;
  filteredCustomers: any[] = [];
  productTaxAmount: number = 0;
  shippingTaxAmount: number = 0;
  isLoading: boolean = false;

  // Medicine types
  medicineTypes = [
    { value: 'kasayam', label: 'Kasayam (കഷായം)' },
    { value: 'buligha', label: 'Buligha (ഗുളിക)' },
    { value: 'bhasmam', label: 'Bhasmam (ഭസ്മം)' },
    { value: 'krudham', label: 'Krudham (ഘൃതം)' },
    { value: 'suranam', label: 'Suranam (ചൂർണ്ണം)' },
    { value: 'rasayanam', label: 'Rasayanam (രസായനം)' },
    { value: 'lagium', label: 'Lagium (ലേഹ്യം)' }
  ];

  constructor(
    private fb: FormBuilder,
    private saleService: SaleService,
    private router: Router,
    private route: ActivatedRoute,
    private datePipe: DatePipe,
    private customerService: CustomerService,
    private productService: ProductsService,
    private accountService: AccountService,
    private locationService: LocationService,
    private userService: UserService,
    private typeOfServiceService: TypeOfServiceService,
    private commissionService: CommissionService,
    private taxService: TaxService,
    private authService: AuthService,
    private changeDetectorRef: ChangeDetectorRef,
    private toastr: ToastrService,
    private leadService: LeadService
  ) {
    this.todayDate = this.datePipe.transform(new Date(), 'yyyy-MM-dd') || '';
    this.currentUser = this.getCurrentUser();
  }

  ngOnInit(): void {
    this.initializeForm();
    this.setupValueChanges();
    
    // Load all required data
    Promise.all([
      this.loadCustomers(),
      this.loadProducts(),
      this.loadBusinessLocations(),
      this.loadServiceTypes(),
      this.loadUsers(),
      this.loadTaxRates(),
      this.loadTaxGroups(),
      this.loadPaymentAccounts()
    ]).then(() => {
      // Get sale ID from route and load sale data
      this.route.params.subscribe(params => {
        this.saleId = params['id'];
        if (this.saleId) {
          this.loadSaleData(this.saleId);
        }
      });
    });
  }

  loadSaleData(saleId: string): void {
    this.isLoading = true;
    this.saleService.getSaleById(saleId).subscribe({
      next: (sale) => {
        console.log('🔍 Loading sale data for editing:', sale);
        
        // Store original values
        this.originalTotalPayable = sale.totalPayable || 0;
        this.originalBalance = sale.balance || 0;
        this.originalPaymentAmount = sale.paymentAmount || 0;
        
        // Populate form with sale data
        this.saleForm.patchValue({
          customer: sale.customerId || sale.customer || '',
          customerName: sale.customerName || '',
          customerPhone: sale.customerPhone || '',
          customerEmail: sale.customerEmail || '',
          alternateContact: sale.alternateContact || '',
          customerAge: sale.customerAge || null,
          customerDob: sale.customerDob || null,
          customerGender: sale.customerGender || '',
          billingAddress: sale.billingAddress || '',
          shippingAddress: sale.shippingAddress || '',
          saleDate: sale.saleDate || this.todayDate,
          businessLocation: sale.businessLocationId || sale.businessLocation || '',
          invoiceNo: sale.invoiceNo || '',
          orderNo: sale.orderNo || '',
          typeOfService: sale.typeOfService || '',
          transactionId: sale.transactionId || '',
          invoiceScheme: sale.invoiceScheme || '',
          document: sale.document || null,
          discountType: sale.discountType || 'Percentage',
          discountAmount: sale.discountAmount || 0,
          orderTax: sale.orderTax || 18,
          sellNote: sale.sellNote || '',
          shippingCharges: sale.shippingCharges || 0,
          shippingStatus: sale.shippingStatus || '',
          deliveryPerson: sale.deliveryPerson || '',
          shippingDetails: sale.shippingDetails || '',
          status: sale.status || 'Pending',
          paymentStatus: sale.paymentStatus || 'Due',
          paymentMethod: sale.paymentMethod || '',
          paymentAccount: sale.paymentAccountId || sale.paymentAccount || '',
          totalPayable: this.originalTotalPayable,
          paymentAmount: this.originalPaymentAmount,
          balance: this.originalBalance,
          paidOn: sale.paidOn || this.todayDate,
          paymentNote: sale.paymentNote || '',
          changeReturn: sale.changeReturn || 0,
          roundOff: sale.roundOff || 0,
          addedBy: sale.addedBy || '',
          productTaxAmount: sale.productTaxAmount || 0,
          shippingTaxAmount: sale.shippingTaxAmount || 0
        });

        // Load products
        if (sale.products && sale.products.length > 0) {
          this.products = sale.products.map(product => ({
            id: product.id || '',
            name: product.name || product.productName || '',
            productName: product.productName || product.name || '',
            sku: product.sku || '',
            quantity: product.quantity || 1,
            unitPrice: product.unitPrice || 0,
            discount: product.discount || 0,
            discountType: product.discountType || 'Amount',
            subtotal: product.subtotal || 0,
            batchNumber: product.batchNumber || '',
            expiryDate: product.expiryDate || '',
            taxRate: product.taxRate || 0,
            taxAmount: product.taxAmount || 0,
            cgstAmount: product.cgstAmount || 0,
            sgstAmount: product.sgstAmount || 0,
            igstAmount: product.igstAmount || 0,
            taxType: product.taxType || '',
            priceBeforeTax: product.priceBeforeTax || 0,
            taxIncluded: product.taxIncluded || false,
            commissionPercent: product.commissionPercent || 0,
            commissionAmount: product.commissionAmount || 0
          }));
        }

        // Load prescriptions if available
        if (sale.prescriptions && sale.prescriptions.length > 0) {
          this.prescriptions = sale.prescriptions;
        }

        // Load service data
        if (sale.ppServiceData) {
          this.ppServiceData = sale.ppServiceData;
          this.showPpServicePopup = false;
        }
        if (sale.codData) {
          this.codData = sale.codData;
          this.showCodPopup = false;
        }

        // Set customer search input
        if (sale.customerName) {
          this.customerSearchInput = sale.customerName;
        }

        // Calculate totals
        this.calculateItemsTotal();
        this.calculateProductTaxes();
        this.calculateShippingTax();
        this.calculateBalanceOnly();

        this.isLoading = false;
        console.log('✅ Sale data loaded successfully');
      },
      error: (error) => {
        console.error('Error loading sale data:', error);
        this.showToast('Error loading sale data. Please try again.', 'error');
        this.isLoading = false;
      }
    });
  }

  private showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
    const toastOptions = {
      timeOut: 5000,
      progressBar: true,
      closeButton: true
    };

    switch(type) {
      case 'success':
        this.toastr.success(message, 'Success', toastOptions);
        break;
      case 'error':
        this.toastr.error(message, 'Error', toastOptions);
        break;
      default:
        this.toastr.info(message, 'Info', toastOptions);
    }
  }

  getCurrentUser(): string {
    const currentUser = this.authService.currentUserValue;
    return currentUser?.displayName || currentUser?.email || 'Current User';
  }

  // Load methods (same as add-sale component)
  loadCustomers(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.customerService.getCustomers().subscribe({
        next: (customers: any[]) => {
          this.customers = customers.map(customer => ({
            ...customer,
            displayName: customer.businessName || 
                       `${customer.firstName || ''} ${customer.middleName ? customer.middleName + ' ' : ''}${customer.lastName || ''}`.trim(),
            contactId: customer.contactId || '',
            landline: customer.landline || ''
          }));
          
          this.filteredCustomers = [...this.customers];
          resolve();
        },
        error: (error: any) => {
          console.error('Error loading customers:', error);
          reject(error);
        }
      });
    });
  }

  loadProducts(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.productService.getProductsRealTime().subscribe({
        next: (products: any[]) => {
          this.allProducts = products.map(p => ({
            ...p,
            productName: p.name || p.productName
          }));
          this.filteredProducts = [...this.allProducts];
          resolve();
        },
        error: (error: any) => {
          console.error('Error loading products:', error);
          reject(error);
        }
      });
    });
  }

  loadBusinessLocations(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.locationService.getLocations().subscribe({
        next: (locations: any[]) => {
          this.businessLocations = locations;
          resolve();
        },
        error: (error: any) => {
          console.error('Error loading business locations:', error);
          reject(error);
        }
      });
    });
  }

  loadServiceTypes(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.typeOfServiceService.getServicesRealtime().subscribe({
        next: (services: Service[]) => {
          this.serviceTypes = services;
          resolve();
        },
        error: (error: any) => {
          console.error('Error loading service types:', error);
          reject(error);
        }
      });
    });
  }

  loadUsers(): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.userService.getUsers().subscribe({
        next: (users: any[]) => {
          const formattedUsers = users.map(user => ({
            ...user,
            displayName: user.displayName || `${user.firstName} ${user.lastName}`.trim() || user.email
          }));
          this.users = formattedUsers;
          resolve(formattedUsers);
        },
        error: (error: any) => {
          console.error('Error loading users:', error);
          reject(error);
        }
      });
    });
  }

  private loadTaxRates(): Promise<void> {
    return new Promise((resolve) => {
      this.taxService.getTaxRates().subscribe(rates => {
        this.availableTaxRates = rates;
        resolve();
      });
    });
  }

  loadPaymentAccounts(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.accountService.getAccounts((accounts: any[]) => {
        this.paymentAccounts = accounts;
        resolve();
      });
    });
  }

  private loadTaxGroups(): Promise<void> {
    return new Promise((resolve) => {
      this.taxService.getTaxGroups().subscribe(groups => {
        this.availableTaxGroups = groups.map(group => ({
          ...group,
          calculatedRate: this.calculateGroupRate(group.taxRates)
        }));
        resolve();
      });
    });
  }

  private calculateGroupRate(taxRates: TaxRate[]): number {
    return taxRates.reduce((total, rate) => total + rate.rate, 0);
  }

  initializeForm(): void {
    this.saleForm = this.fb.group({
      customer: ['', Validators.required],
      customerName: [''],
      invoiceNo: ['', Validators.required],
      orderNo: ['', Validators.required],
      customerPhone: ['', Validators.required],
      transactionId: [''],
      productInterested: [''],
      status: ['Pending', Validators.required],
      paymentStatus: ['Due'],
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
      customerSearch: [''],
      customerOccupation: [''],
      creditLimit: [0],
      otherData: [''],
      paymentAccount: ['', Validators.required],
      prescriptions: [[]],
      typeOfService: [''],
      billingAddress: [''],
      shippingAddress: [''],
      saleDate: [this.todayDate, Validators.required],
      businessLocation: ['', Validators.required],
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
      addedBy: ['', Validators.required]
    });

    this.afterTaxShippingControl.valueChanges.subscribe(value => {
      this.onAfterTaxShippingChange(value);
    });
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

    this.saleForm.get('orderTax')?.valueChanges.subscribe(() => {
      if (!this.preserveOriginalTotals) {
        this.recalculateAllTotals();
      }
    });

    this.saleForm.get('shippingCharges')?.valueChanges.subscribe(() => {
      if (!this.preserveOriginalTotals) {
        this.recalculateAllTotals();
      }
    });

    this.saleForm.get('discountType')?.valueChanges.subscribe(() => {
      if (!this.preserveOriginalTotals) {
        this.recalculateAllTotals();
      }
    });
  }

  // Calculation methods
  calculateItemsTotal(): void {
    this.itemsTotal = this.products.reduce((sum, product) => sum + (product.subtotal || 0), 0);
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

  calculateBalanceOnly(): void {
    const totalPayable = this.preserveOriginalTotals ? this.originalTotalPayable : (this.saleForm.get('totalPayable')?.value || 0);
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

  recalculateAllTotals(): void {
    if (this.preserveOriginalTotals && this.isEditing) {
      this.calculateItemsTotal();
      this.calculateProductTaxes();
      this.calculateShippingTax();
      this.calculateBalanceOnly();
      return;
    }

    this.calculateItemsTotal();
    const discountedTotal = this.calculateDiscountedTotal();
    this.calculateProductTaxes();
    const shippingWithTax = this.calculateShippingWithTax();
    this.calculateFinalTotals(discountedTotal, shippingWithTax);
    this.calculateRoundOff();
    this.calculateBalance();
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
    
    return Math.max(0, discountedTotal);
  }

  calculateProductTax(product: Product): void {
    const taxRate = product.taxRate || 0;
    const taxableAmount = (product.priceBeforeTax || 0) * product.quantity;
    
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
    const totalPayable = discountedTotal + this.productTaxAmount + shippingWithTax;
    
    this.saleForm.patchValue({
      totalPayable: parseFloat(totalPayable.toFixed(2))
    }, { emitEvent: false });
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

  calculateTotalPayable(): void {
    if (!this.preserveOriginalTotals) {
      this.recalculateAllTotals();
    } else {
      this.calculateBalanceOnly();
    }
  }

  togglePreservationMode(): void {
    this.preserveOriginalTotals = !this.preserveOriginalTotals;
    
    if (!this.preserveOriginalTotals) {
      this.recalculateAllTotals();
    } else {
      this.saleForm.patchValue({
        totalPayable: this.originalTotalPayable,
        balance: this.originalBalance
      });
      this.calculateBalanceOnly();
    }
  }

  logCalculationDetails(): void {
    console.log('🔍 CALCULATION DETAILS:');
    console.log('Edit Mode:', this.isEditing);
    console.log('Preserve Original Totals:', this.preserveOriginalTotals);
    console.log('Original Total Payable:', this.originalTotalPayable);
    console.log('Current Total Payable:', this.saleForm.get('totalPayable')?.value);
    console.log('Products:', this.products);
    console.log('Items Total:', this.itemsTotal);
  }

  // Product management methods
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
    product.commissionAmount = (product.commissionPercent || 0) / 100 * discountedSubtotal;
    product.subtotal = discountedSubtotal - product.commissionAmount;

    if (!this.preserveOriginalTotals) {
      this.recalculateAllTotals();
    } else {
      this.calculateItemsTotal();
      this.calculateProductTaxes();
      this.calculateBalanceOnly();
    }
  }

  addProduct(): void {
    this.products.push({
      name: '',
      quantity: 1,
      unitPrice: 0,
      discount: 0,
      discountType: 'Amount',
      commissionPercent: 0,
      commissionAmount: 0,
      subtotal: 0,
      priceBeforeTax: 0,
      taxIncluded: false,
      batchNumber: '',
      expiryDate: '',
      taxRate: 0,
      taxAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      taxType: ''
    });
    
    if (!this.preserveOriginalTotals) {
      this.recalculateAllTotals();
    } else {
      this.calculateItemsTotal();
    }
  }

  removeProduct(index: number): void {
    if (this.products.length <= 1) {
      this.showToast('At least one product is required', 'error');
      return;
    }
    
    this.products.splice(index, 1);
    
    if (!this.preserveOriginalTotals) {
      this.recalculateAllTotals();
    } else {
      this.calculateItemsTotal();
      this.calculateProductTaxes();
      this.calculateBalanceOnly();
    }
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
      this.products[index].productName = selectedProduct.productName;
      this.products[index].unitPrice = selectedProduct.defaultSellingPriceExcTax || 0;
      this.products[index].priceBeforeTax = selectedProduct.defaultSellingPriceExcTax || 0;
      this.products[index].taxRate = selectedProduct.taxRate || 0;
      this.products[index].id = selectedProduct.id;
      
      if (this.products[index].quantity <= 0) {
        this.products[index].quantity = 1;
      }
      
      this.updateProduct(index);
    }
  }

  // Search and filter methods
  onSearchInput(event: any): void {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    
    this.searchTimeout = setTimeout(() => {
      this.searchProducts(event);
    }, 300);
  }

  searchProducts(event: any) {
    const searchTerm = event.target.value.toLowerCase().trim();
    this.searchTerm = searchTerm;
    
    if (!searchTerm || searchTerm.length < 2) {
      this.searchResults = [];
      this.showSearchResults = false;
      return;
    }
    
    this.searchResults = this.allProducts
      .filter(product => {
        const searchString = [
          product.productName || product.name,
          product.sku,
          product.barcode
        ]
        .filter(field => field)
        .join(' ')
        .toLowerCase();
        
        return searchString.includes(searchTerm);
      })
      .map(product => ({
        ...product,
        productName: product.productName || product.name,
        currentStock: product.currentStock || product.totalQuantity || 0,
        defaultSellingPriceExcTax: product.defaultSellingPriceExcTax || 0
      }));
    
    this.showSearchResults = this.searchResults.length > 0;
  }

  onSearchFocus() {
    this.showSearchResults = true;
    if (this.searchTerm) {
      this.searchProducts({ target: { value: this.searchTerm } });
    }
  }

  onSearchBlur() {
    setTimeout(() => {
      this.showSearchResults = false;
    }, 200);
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

  addProductFromSearch(product: any) {
    const unitPrice = product.defaultSellingPriceIncTax || product.defaultSellingPriceExcTax || 0;
    
    const existingProductIndex = this.products.findIndex(p => 
      p.name === product.productName || p.productName === product.productName
    );
    
    if (existingProductIndex >= 0) {
      this.products[existingProductIndex].quantity += 1;
      this.updateProduct(existingProductIndex);
    } else {
      const newProduct: Product = {
        name: product.productName,
        productName: product.productName,
        sku: product.sku,
        barcode: product.barcode,
        priceBeforeTax: product.defaultSellingPriceExcTax || 0,
        taxIncluded: !!product.defaultSellingPriceIncTax,
        unitPrice: unitPrice,
        currentStock: product.currentStock || product.totalQuantity || 0,
        defaultSellingPriceExcTax: product.defaultSellingPriceExcTax,
        defaultSellingPriceIncTax: product.defaultSellingPriceIncTax,
        taxRate: product.taxRate || 0,
        quantity: 1,
        discount: 0,
        commissionPercent: 0,
        commissionAmount: 0,
        subtotal: unitPrice,
        batchNumber: product.batchNumber || '',
        expiryDate: product.expiryDate || '',
        discountType: 'Amount',
        taxAmount: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
        taxType: '',
        stockByLocation: product.stockByLocation || {},
        totalQuantity: product.totalQuantity || product.currentStock || 0,
        manageStock: product.manageStock !== false 
      };
      this.products.push(newProduct);
      this.updateProduct(this.products.length - 1);
    }
    
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

  // Customer management methods
  filterCustomers(): void {
    if (!this.customerSearchInput) {
      this.filteredCustomers = [...this.customers];
      return;
    }

    const filter = this.customerSearchInput.toUpperCase();
    
    this.filteredCustomers = this.customers.filter(customer => {
      const searchString = [
        customer.displayName || '',
        customer.contactId || '',
        customer.mobile || '',
        customer.phone || '',
        customer.alternateContact || '',
        customer.landline || ''
      ]
      .filter(field => field)
      .join(' ')
      .toUpperCase();
      
      return searchString.includes(filter);
    });
  }

  toggleCustomerDropdown(): void {
    this.showCustomerDropdown = !this.showCustomerDropdown;
    if (this.showCustomerDropdown) {
      this.filterCustomers();
    }
  }

  selectCustomer(customer: any): void {
    const addressParts = [
      customer.addressLine1,
      customer.addressLine2,
      customer.city,
      customer.state,
      customer.country,
      customer.zipCode
    ].filter(part => part);
    
    const fullAddress = addressParts.join(', ');
    const phoneNumber = customer.mobile || customer.phone || customer.alternateContact || customer.landline || '';

    let formattedDob = '';
    if (customer.dob) {
      const dobDate = customer.dob instanceof Date ? customer.dob : new Date(customer.dob);
      if (!isNaN(dobDate.getTime())) {
        formattedDob = this.datePipe.transform(dobDate, 'yyyy-MM-dd') || '';
      }
    }

    this.saleForm.patchValue({
      customer: customer.id,
      customerName: customer.displayName,
      customerPhone: phoneNumber,
      customerEmail: customer.email || '',
      billingAddress: fullAddress,
      shippingAddress: fullAddress,
      alternateContact: customer.alternateContact || '',
      customerAge: customer.age || null,
      customerDob: formattedDob, 
      customerGender: customer.gender || '',
      customerOccupation: customer.occupation || '',
      creditLimit: customer.creditLimit || 0,
      otherData: customer.otherData || customer.notes || '',
    });
    
    this.customerSearchInput = customer.displayName;
    this.showCustomerDropdown = false;
  }

  searchCustomerByPhone(): void {
    const inputPhone = this.saleForm.get('customerPhone')?.value?.trim();
    
    if (!inputPhone || inputPhone.length < 5) {
      return;
    }

    const cleanPhone = inputPhone.replace(/\D/g, '');

    const foundCustomer = this.customers.find(customer => {
      const customerPhones = [
        customer.mobile,
        customer.phone,
        customer.alternateContact,
        customer.landline
      ].filter(phone => phone);

      return customerPhones.some(phone => {
        const cleanCustomerPhone = phone?.replace(/\D/g, '') || '';
        return phone === inputPhone || cleanCustomerPhone === cleanPhone;
      });
    });

    if (foundCustomer) {
      let formattedDob = '';
      if (foundCustomer.dob) {
        const dobDate = foundCustomer.dob instanceof Date ? foundCustomer.dob : new Date(foundCustomer.dob);
        if (!isNaN(dobDate.getTime())) {
          formattedDob = this.datePipe.transform(dobDate, 'yyyy-MM-dd') || '';
        }
      }
      
      this.saleForm.patchValue({
        customer: foundCustomer.id,
        customerName: foundCustomer.displayName,
        customerPhone: foundCustomer.mobile || foundCustomer.phone || '',
        alternateContact: foundCustomer.alternateContact || '',
        customerEmail: foundCustomer.email || '',
        customerAge: foundCustomer.age || null,
        customerDob: formattedDob,
        customerGender: foundCustomer.gender || '',
        billingAddress: foundCustomer.addressLine1 || '',
        shippingAddress: foundCustomer.addressLine1 || '',
        creditLimit: foundCustomer.creditLimit || 0
      });
      this.customerSearchInput = foundCustomer.displayName;
    }
  }

  onCustomerBlur(): void {
    setTimeout(() => {
      this.showCustomerDropdown = false;
    }, 200);
  }

  openCustomerEditPopup(): void {
    const customerId = this.saleForm.get('customer')?.value;
    if (!customerId) {
      this.showToast('Please select a customer first', 'error');
      return;
    }

    const customer = this.customers.find(c => c.id === customerId);
    if (customer) {
      const formBillingAddress = this.saleForm.get('billingAddress')?.value;
      const formShippingAddress = this.saleForm.get('shippingAddress')?.value;
      const formAlternateContact = this.saleForm.get('alternateContact')?.value;

      this.selectedCustomerForEdit = { 
        ...customer,
        isIndividual: !customer.businessName,
        firstName: customer.firstName || '',
        lastName: customer.lastName || '',
        billingAddress: formBillingAddress || customer.billingAddress || customer.addressLine1 || '',
        shippingAddress: formShippingAddress || customer.shippingAddress || customer.addressLine1 || '',
        alternateContact: formAlternateContact || customer.alternateContact || '',
        email: this.saleForm.get('customerEmail')?.value || customer.email || '',
        mobile: this.saleForm.get('customerPhone')?.value || customer.mobile || '',
        age: this.saleForm.get('customerAge')?.value || customer.age || null,
        dob: this.saleForm.get('customerDob')?.value || customer.dob || null,
        gender: this.saleForm.get('customerGender')?.value || customer.gender || ''
      };
      this.showCustomerEditPopup = true;
    } else {
      this.showToast('Customer not found in local list', 'error');
    }
  }

  onCustomerSave(updatedCustomer: any): void {
    try {
      this.customerService.updateCustomer(updatedCustomer.id, updatedCustomer)
        .then(() => {
          this.saleForm.patchValue({
            customer: updatedCustomer.id,
            customerName: updatedCustomer.displayName,
            customerPhone: updatedCustomer.mobile || updatedCustomer.phone || '',
            customerEmail: updatedCustomer.email || '',
            billingAddress: updatedCustomer.billingAddress || updatedCustomer.addressLine1 || '',
            shippingAddress: updatedCustomer.shippingAddress || updatedCustomer.addressLine1 || '',
            alternateContact: updatedCustomer.alternateContact || ''
          });
          
          const index = this.customers.findIndex(c => c.id === updatedCustomer.id);
          if (index >= 0) {
            this.customers[index] = updatedCustomer;
          } else {
            this.customers.push(updatedCustomer);
          }
          
          this.customerSearchInput = updatedCustomer.displayName;
          this.showCustomerEditPopup = false;
          this.changeDetectorRef.detectChanges();
        })
        .catch(error => {
          console.error('Error updating customer:', error);
          this.showToast('Failed to save customer changes. Please try again.', 'error');
        });
    } catch (error) {
      console.error('Error handling customer save:', error);
      this.showToast('An unexpected error occurred. Please try again.', 'error');
    }
  }

  onCustomerEditClose(): void {
    this.showCustomerEditPopup = false;
  }

  // Service type methods
  onServiceTypeChange(event: any): void {
    const serviceId = event.target.value;
    
    if (this.showPpServicePopup && serviceId !== this.saleForm.get('typeOfService')?.value) {
      this.ppServiceData = null;
    }
    if (this.showCodPopup && serviceId !== this.saleForm.get('typeOfService')?.value) {
      this.codData = null;
    }

    const selectedService = this.serviceTypes.find(s => s.id === serviceId);
    const serviceName = selectedService?.name?.toLowerCase() || '';

    this.showPpServicePopup = false;
    this.showCodPopup = false;

    if (serviceName.includes('pp')) {
      this.showPpServicePopup = true;
      this.codData = null;
      this.saleForm.patchValue({ typeOfService: serviceId });
    } 
    else if (serviceId === 'COD' || serviceName.includes('cod')) {
      this.showCodPopup = true;
      this.ppServiceData = null;
      this.saleForm.patchValue({ typeOfService: serviceId });
    } 
    else {
      this.saleForm.patchValue({ typeOfService: serviceId });
    }

    this.showTransactionIdField = !!selectedService?.name && 
                              (serviceName.includes('pp') || 
                               serviceName.includes('payment'));
    
    const transactionIdControl = this.saleForm.get('transactionId');
    if (transactionIdControl) {
      if (this.showTransactionIdField) {
        transactionIdControl.setValidators([Validators.required]);
      } else {
        transactionIdControl.clearValidators();
      }
      transactionIdControl.updateValueAndValidity();
    }
  }

  onCodFormSubmit(formData: any): void {
    this.codData = formData;
    this.showCodPopup = false;
    
    if (formData.packingCharge) {
      const currentShipping = this.saleForm.get('shippingCharges')?.value || 0;
      this.saleForm.patchValue({
        shippingCharges: currentShipping + formData.packingCharge
      });
    }
  }

  onCodClose(): void {
    this.showCodPopup = false;
    
    if (!this.codData) {
      this.saleForm.patchValue({
        typeOfService: ''
      });
    }
  }

  onPpServiceFormSubmit(formData: any): void {
    this.ppServiceData = formData;
    this.showPpServicePopup = false;
    
    if (formData.transactionId && !this.saleForm.get('transactionId')?.value) {
      this.saleForm.patchValue({
        transactionId: formData.transactionId
      });
    }
  }

  onPpServiceClose(): void {
    this.showPpServicePopup = false;
    
    if (!this.ppServiceData) {
      this.saleForm.patchValue({
        typeOfService: ''
      });
    }
  }

  // Prescription methods (same as add-sale)
  selectMedicineType(type: string): void {
    this.selectedMedicineType = type;
  }

  getMedicineTypeName(type: string): string {
    const typeNames: {[key: string]: string} = {
      'kasayam': 'Kasayam (കഷായം)',
      'buligha': 'Buligha (ഗുളിക)',
      'bhasmam': 'Bhasmam (ഭസ്മം)',
      'krudham': 'Krudham (ഘൃതം)',
      'suranam': 'Suranam (ചൂർണ്ണം)',
      'rasayanam': 'Rasayanam (രസായനം)',
      'lagium': 'Lagium (ലേഹ്യം)'
    };
    return typeNames[type] || 'Medicine';
  }

  addMedicineByType(): void {
    if (!this.selectedMedicineType) return;

    const newMedicine: Medicine = {
      name: '',
      type: this.selectedMedicineType,
      time: 'രാവിലെ / ഉച്ചയ്ക്ക് / രാത്രി'
    };

    switch(this.selectedMedicineType) {
      case 'kasayam':
        newMedicine.instructions = '';
        newMedicine.quantity = '';
        newMedicine.powder = '';
        newMedicine.pills = '';
        break;
      case 'buligha':
        newMedicine.instructions = '';
        newMedicine.powder = '';
        break;
      case 'bhasmam':
        newMedicine.dosage = '';
        newMedicine.quantity = '';
        newMedicine.instructions = '';
        newMedicine.powder = '';
        break;
      case 'krudham':
        newMedicine.instructions = '';
        break;
      case 'suranam':
        newMedicine.instructions = '';
        newMedicine.powder = '';
        newMedicine.dosage = '';
        break;
      case 'rasayanam':
        newMedicine.instructions = '';
        break;
      case 'lagium':
        newMedicine.instructions = '';
        newMedicine.dosage = '';
        break;
    }

    this.prescriptionData.medicines.push(newMedicine);
    this.selectedMedicineType = '';
    
    setTimeout(() => {
      const lastIndex = this.prescriptionData.medicines.length - 1;
      const firstField = document.getElementById(`medicineName_${lastIndex}`);
      if (firstField) {
        firstField.focus();
      }
    });
  }

  addSameMedicineType(): void {
    if (!this.selectedMedicineType) return;

    const sameTypeMedicines = this.prescriptionData.medicines.filter(med => med.type === this.selectedMedicineType);
    
    if (sameTypeMedicines.length === 0) {
      this.addMedicineByType();
      return;
    }

    const lastMedicine = sameTypeMedicines[sameTypeMedicines.length - 1];
    const newMedicine: Medicine = JSON.parse(JSON.stringify(lastMedicine));
    
    this.prescriptionData.medicines.push(newMedicine);
    
    setTimeout(() => {
      const lastIndex = this.prescriptionData.medicines.length - 1;
      const firstField = document.getElementById(`medicineName_${lastIndex}`);
      if (firstField) {
        firstField.focus();
      }
    });
  }

  addMedicine(): void {
    this.prescriptionData.medicines.push({
      name: '',
      dosage: '',
      instructions: '',
      ingredients: '',
      pills: '',
      powder: '',
      time: '',
      type: ''
    });

    setTimeout(() => {
      const lastIndex = this.prescriptionData.medicines.length - 1;
      const firstField = document.getElementById(`medicineName_${lastIndex}`);
      if (firstField) {
        firstField.focus();
      }
    });
  }

  removeMedicine(index: number): void {
    this.prescriptionData.medicines.splice(index, 1);
  }

  openPrescriptionModal(): void {
    if (this.editingPrescriptionIndex === null) {
      this.resetPrescriptionData();
      
      if (!this.prescriptionData.patientName) {
        this.prescriptionData.patientName = this.saleForm.get('customerName')?.value || '';
      }
      
      if (!this.prescriptionData.date) {
        this.prescriptionData.date = this.todayDate;
      }
    }

    const modalElement = document.getElementById('prescriptionModal');
    if (modalElement) {
      if (this.currentPrescriptionModal) {
        this.currentPrescriptionModal.dispose();
      }
      
      this.currentPrescriptionModal = new bootstrap.Modal(modalElement, {
        focus: true,
        keyboard: true,
        backdrop: 'static'
      });
      
      this.currentPrescriptionModal.show();
    }
  }

  editPrescription(index: number): void {
    this.editingPrescriptionIndex = index;
    this.prescriptionData = JSON.parse(JSON.stringify(this.prescriptions[index]));
    
    this.prescriptionData.patientName = this.prescriptionData.patientName || 
                                       this.saleForm.get('customerName')?.value || '';
    this.prescriptionData.date = this.prescriptionData.date || this.todayDate;
    
    this.openPrescriptionModal();
    
    setTimeout(() => {
      this.updateFormFieldsFromPrescription();
    }, 100);
  }

  deletePrescription(index: number): void {
    if (confirm('Are you sure you want to delete this prescription?')) {
      this.prescriptions.splice(index, 1);
      this.showToast('Prescription deleted successfully!', 'success');
    }
  }

  private updateFormFieldsFromPrescription(): void {
    const patientNameElement = document.getElementById('patientName');
    if (patientNameElement) {
      patientNameElement.textContent = this.prescriptionData.patientName;
    }

    const patientAgeElement = document.getElementById('patientAge');
    if (patientAgeElement) {
      patientAgeElement.textContent = this.prescriptionData.patientAge || '';
    }

    this.prescriptionData.medicines.forEach((medicine, index) => {
      this.setEditableField(`medicineName_${index}`, medicine.name);
      
      switch(medicine.type) {
        case 'kasayam':
          this.setEditableField(`kasayamName_${index}`, medicine.name);
          this.setEditableField(`kasayamInstructions_${index}`, medicine.instructions);
          this.setEditableField(`kasayamQuantity_${index}`, medicine.quantity);
          this.setEditableField(`kasayamPowder_${index}`, medicine.powder);
          this.setEditableField(`kasayamPills_${index}`, medicine.pills);
          break;
        // Add other cases as needed
      }
      
      this.setEditableField(`${medicine.type}Time_${index}`, medicine.time);
    });

    const notesElement = document.getElementById('additionalNotes') as HTMLTextAreaElement;
    if (notesElement && this.prescriptionData.additionalNotes) {
      notesElement.value = this.prescriptionData.additionalNotes;
    }
  }

  private setEditableField(id: string, value: string | undefined): void {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value || '';
    }
  }

  savePrescription(): void {
    this.savePrescriptionData();
    
    if (this.editingPrescriptionIndex !== null) {
      this.prescriptions[this.editingPrescriptionIndex] = {...this.prescriptionData};
    } else {
      this.prescriptions.push({...this.prescriptionData});
    }
    
    if (this.currentPrescriptionModal) {
      this.currentPrescriptionModal.hide();
    }
    
    this.editingPrescriptionIndex = null;
    this.resetPrescriptionData();
    
    this.showToast('Prescription saved successfully!', 'success');
  }

  private savePrescriptionData(): void {
    const patientName = document.getElementById('patientName')?.textContent?.trim() || 
                       'Unknown Patient';
    const patientAge = document.getElementById('patientAge')?.textContent?.trim() || 
                      this.saleForm.get('customerAge')?.value || 
                      '';
    
    this.prescriptionData = {
      ...this.prescriptionData,
      patientName: patientName,
      patientAge: patientAge,
      date: this.todayDate
    };

    this.prescriptionData.medicines.forEach((medicine, index) => {
      medicine.name = this.getEditableFieldContent(`kasayamName_${index}`) || medicine.name;
      
      switch(medicine.type) {
        case 'kasayam':
          medicine.instructions = this.getEditableFieldContent(`kasayamInstructions_${index}`) || medicine.instructions || '';
          medicine.pills = this.getEditableFieldContent(`kasayamPills_${index}`) || medicine.pills || '';
          medicine.quantity = this.getEditableFieldContent(`kasayamQuantity_${index}`) || medicine.quantity || '';
          medicine.powder = this.getEditableFieldContent(`kasayamPowder_${index}`) || medicine.powder || '';
          medicine.time = this.getEditableFieldContent(`kasayamTime_${index}`) || medicine.time || '';
          break;
        // Add other cases as needed
      }
    });

    const notesElement = document.getElementById('additionalNotes') as HTMLTextAreaElement;
    if (notesElement) {
      this.prescriptionData.additionalNotes = notesElement.value;
    }
  }

  private getEditableFieldContent(id: string): string {
    const element = document.getElementById(id);
    return element?.textContent?.trim() || element?.innerText?.trim() || '';
  }

  resetPrescriptionData(): void {
    this.prescriptionData = {
      medicines: [],
      patientName: this.saleForm.get('customerName')?.value || '',
      patientAge: this.saleForm.get('customerAge')?.value?.toString() || '',
      date: this.todayDate,
      additionalNotes: ''
    };
  }

  printPrescription(): void {
    this.savePrescriptionData();
    
    const prescriptionToPrint = this.editingPrescriptionIndex !== null 
      ? this.prescriptions[this.editingPrescriptionIndex]
      : this.prescriptionData;

    const printContent = this.generatePrintContent(prescriptionToPrint);
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      
      printWindow.onload = () => {
        printWindow.focus();
        printWindow.print();
      };
    }
  }

  private generatePrintContent(prescription: PrescriptionData): string {
    const formattedDate = this.datePipe.transform(prescription.date || this.todayDate, 'MMMM d, yyyy') || this.todayDate;
    
    let medicinesHtml = '';
    prescription.medicines.forEach((medicine, index) => {
      medicinesHtml += `
        <div class="medicine-item" style="margin-bottom: 20px; page-break-inside: avoid;">
          <h4 style="font-size: 16px; margin-bottom: 8px;">${index + 1}. ${this.getMedicineTypeName(medicine.type)}</h4>
          ${this.generateMedicineDetails(medicine, index)}
        </div>
      `;
    });

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Prescription</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            line-height: 1.6; 
            padding: 20px; 
            max-width: 800px; 
            margin: 0 auto;
            position: relative;
          }
          .header { 
            text-align: center; 
            margin-bottom: 20px; 
            border-bottom: 1px solid #ddd;
            padding-bottom: 20px;
          }
          .patient-info { 
            display: flex; 
            justify-content: space-between; 
            margin-bottom: 30px;
            padding: 15px;
            background: #f9f9f9;
            border-radius: 5px;
          }
          .footer { 
            margin-top: 40px; 
            text-align: right; 
            border-top: 1px solid #ddd;
            padding-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>DR.RAJANA P.R.,BAMS</h2>
          <h3>HERBALLY TOUCH AYURVEDA PRODUCTS PVT.LTD.</h3>
          <p>First Floor, Chirackal Tower, Ayroor P.O., Ernakulam Dt.,Kerala - 683 579</p>
          <p>E–mail: contact@herbalytouch.com | Ph: 7034110999</p>
        </div>
        
        <div class="patient-info">
          <div>
            <p><strong>Name:</strong> ${prescription.patientName || '______'}</p>
            <p><strong>Age:</strong> ${prescription.patientAge || '______'}</p>
          </div>
          <p><strong>Date:</strong> ${formattedDate}</p>
        </div>
        
        <div class="medicine-content">
          ${medicinesHtml}
        </div>
        
        ${prescription.additionalNotes ? `
          <div class="additional-notes">
            <h4>Additional Notes:</h4>
            <p>${prescription.additionalNotes}</p>
          </div>
        ` : ''}
        
        <div class="footer">
          <p>Doctor's Signature: _________________</p>
          <p class="doctor-title">${this.currentUser}</p>
        </div>
      </body>
      </html>
    `;
  }

  private generateMedicineDetails(medicine: Medicine, index: number): string {
    let details = '';
    const medicineName = this.getEditableFieldContent(`kasayamName_${index}`) || medicine.name || '';
    details += `<p><strong>${medicineName}</strong></p>`;
    
    switch(medicine.type) {
      case 'kasayam':
        const kasayamInstructions = this.getEditableFieldContent(`kasayamInstructions_${index}`) || medicine.instructions || '';
        const kasayamQuantity = this.getEditableFieldContent(`kasayamQuantity_${index}`) || medicine.quantity || '';
        const kasayamPowder = this.getEditableFieldContent(`kasayamPowder_${index}`) || medicine.powder || '';
        const kasayamPills = this.getEditableFieldContent(`kasayamPills_${index}`) || medicine.pills || '';
        
        details += `
          <p>${medicineName}കഷായം ${kasayamInstructions}ml എടുത്ത് ${kasayamQuantity}ml തിളപ്പിച്ചാറ്റിയവെള്ളം ചേർത്ത് ${kasayamPowder}. 
          ഗുളിക . പൊടിച്ച്ചേർത്ത് ${kasayamPills} നേരം ഭക്ഷണത്തിനുമുൻപ് / ശേഷംസേവിക്കുക.</p>
        `;
        break;
        
      // Add other medicine types as needed
      default:
        const defaultTime = medicine.time || 'രാവിലെ / ഉച്ചയ്ക്ക് / രാത്രി';
        details += `
          <p>Type: ${medicine.type || '______'}</p>
          ${medicine.dosage ? `<p>Dosage: ${medicine.dosage}</p>` : ''}
          ${medicine.instructions ? `<p>Instructions: ${medicine.instructions}</p>` : ''}
          <p>നേരം: ${defaultTime} ഭക്ഷണത്തിനുമുൻപ് / ശേഷം സേവിക്കുക.</p>
        `;
    }
    
    return details;
  }

  // Tax methods
  onTaxChange(selectedRate: string): void {
    this.saleForm.patchValue({ orderTax: parseFloat(selectedRate) || 0 });
    this.calculateTotalPayable();
  }

  onAfterTaxShippingChange(afterTaxValue: string | number | null): void {
    if (!afterTaxValue) return;
    
    const numericValue = typeof afterTaxValue === 'string' ? 
                        parseFloat(afterTaxValue) : 
                        afterTaxValue;
    
    if (isNaN(numericValue)) return;

    const taxRate = this.saleForm.get('orderTax')?.value || 0;
    
    if (taxRate > 0) {
      const beforeTax = numericValue / (1 + (taxRate / 100));
      this.saleForm.patchValue({
        shippingCharges: parseFloat(beforeTax.toFixed(2))
      }, { emitEvent: false });
    } else {
      this.saleForm.patchValue({
        shippingCharges: numericValue
      }, { emitEvent: false });
    }
    
    this.calculateTotalPayable();
  }

  // File handling methods
  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.saleForm.patchValue({ document: file.name });
    }
  }

  onShippingDocumentSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const newFiles = Array.from(input.files) as File[];
      this.shippingDocuments = [...this.shippingDocuments, ...newFiles];
    }
  }

  removeShippingDocument(doc: File): void {
    this.shippingDocuments = this.shippingDocuments.filter(d => d !== doc);
  }

  // Form submission and validation
  updateSale(): void {
    if (this.isSubmitting) return;
    
    console.log('🚀 Update Sale function called');
    console.log('Form valid:', this.saleForm.valid);
    console.log('Products count:', this.products.length);

    if (this.saleForm.invalid) {
      this.markFormGroupTouched(this.saleForm);
      const errors = this.getFormErrors();
      console.error('Form validation errors:', errors);
      this.showToast('Please fill all required fields correctly', 'error');
      return;
    }

    if (this.products.length === 0) {
      this.showToast('Please add at least one product', 'error');
      return;
    }

    const invalidProducts = this.products.filter(p => 
      !p.name || p.quantity <= 0 || p.unitPrice < 0
    );

    if (invalidProducts.length > 0) {
      this.showToast('Some products are invalid. Please check product name and quantity.', 'error');
      return;
    }

    if (!this.preserveOriginalTotals) {
      this.recalculateAllTotals();
    } else {
      this.calculateBalanceOnly();
    }

    this.isSubmitting = true;

    const selectedCustomerId = this.saleForm.get('customer')?.value;
    const selectedCustomer = this.customers.find(c => c.id === selectedCustomerId);
    const customerName = selectedCustomer?.displayName || 'Unknown Customer';

    const formValue = this.saleForm.value;
    
    const saleData = {
      invoiceNo: formValue.invoiceNo || '',
      orderNo: formValue.orderNo || '',
      customerId: selectedCustomerId || '',
      customer: customerName,
      customerName: customerName,
      customerPhone: formValue.customerPhone || '',
      customerEmail: formValue.customerEmail || '',
      alternateContact: formValue.alternateContact || '',
      customerAge: formValue.customerAge || null,
      customerDob: formValue.customerDob || null,
      customerGender: formValue.customerGender || '',
      billingAddress: formValue.billingAddress || '',
      shippingAddress: formValue.shippingAddress || '',
      saleDate: formValue.saleDate || this.todayDate,
      businessLocationId: formValue.businessLocation || '',
      businessLocation: this.businessLocations.find(l => l.id === formValue.businessLocation)?.name || '',
      typeOfService: formValue.typeOfService || '',
      transactionId: formValue.transactionId || '',
      invoiceScheme: formValue.invoiceScheme || '',
      document: formValue.document || '',
      discountType: formValue.discountType || 'Percentage',
      discountAmount: formValue.discountAmount || 0,
      orderTax: formValue.orderTax || 0,
      sellNote: formValue.sellNote || '',
      shippingCharges: formValue.shippingCharges || 0,
      shippingStatus: formValue.shippingStatus || '',
      deliveryPerson: formValue.deliveryPerson || '',
      shippingDetails: formValue.shippingDetails || '',
      status: formValue.status || 'Pending',
      paymentStatus: formValue.paymentStatus || 'Due',
      paymentMethod: formValue.paymentMethod || '',
      paymentAccount: formValue.paymentAccount || '',
      paymentAccountId: formValue.paymentAccount || '',
      totalPayable: this.preserveOriginalTotals ? this.originalTotalPayable : (formValue.totalPayable || 0),
      paymentAmount: formValue.paymentAmount || 0,
      balance: formValue.balance || 0,
      paidOn: formValue.paidOn || this.todayDate,
      paymentNote: formValue.paymentNote || '',
      changeReturn: formValue.changeReturn || 0,
      roundOff: formValue.roundOff || 0,
      addedBy: formValue.addedBy || '',
      productTaxAmount: this.productTaxAmount || 0,
      shippingTaxAmount: this.shippingTaxAmount || 0,
      itemsTotal: this.itemsTotal || 0,
      
      // Service data
      ppServiceData: this.ppServiceData || null,
      hasPpService: !!this.ppServiceData,
      codData: this.codData || null,
      hasCod: !!this.codData,
      
      // Products
      products: this.products.map(product => ({
        id: product.id || '',
        name: product.name || '',
        productName: product.productName || product.name || '',
        sku: product.sku || '',
        quantity: product.quantity || 0,
        unitPrice: product.unitPrice || 0,
        discount: product.discount || 0,
        subtotal: product.subtotal || 0,
        batchNumber: product.batchNumber || '',
        expiryDate: product.expiryDate || '',
        taxRate: product.taxRate || 0,
        taxAmount: product.taxAmount || 0,
        cgstAmount: product.cgstAmount || 0,
        sgstAmount: product.sgstAmount || 0,
        igstAmount: product.igstAmount || 0,
        taxType: product.taxType || '',
        priceBeforeTax: product.priceBeforeTax || 0,
        discountType: product.discountType || 'Amount',
        commissionPercent: product.commissionPercent || 0,
        commissionAmount: product.commissionAmount || 0
      })),
      
      // Prescriptions
      prescriptions: this.prescriptions.length > 0 ? this.prescriptions.map(prescription => ({
        patientName: prescription.patientName || customerName || 'Unknown Patient',
        patientAge: prescription.patientAge || '',
        date: prescription.date || this.todayDate,
        medicines: prescription.medicines.map(medicine => ({
          name: medicine.name || '',
          type: medicine.type || '',
          dosage: medicine.dosage || '',
          instructions: medicine.instructions || '',
          quantity: medicine.quantity || '',
          powder: medicine.powder || '',
          pills: medicine.pills || '',
          time: medicine.time || ''
        })),
        additionalNotes: prescription.additionalNotes || '',
        doctorName: this.currentUser,
        createdAt: new Date()
      })) : null,
      
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
        this.isSubmitting = false;
        this.showToast('Sale updated successfully! 🎉', 'success');
        this.router.navigate(['/sales-order']);
      })
      .catch(error => {
        this.isSubmitting = false;
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

        this.showToast(errorMessage, 'error');
      });
  }

  // Helper function to clean undefined values
  private cleanObjectForFirestore(obj: any): any {
    const cleaned: any = {};
    
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];
        
        if (value === undefined) {
          continue;
        }
        
        if (value === null) {
          cleaned[key] = null;
          continue;
        }
        
        if (Array.isArray(value)) {
          cleaned[key] = value.map(item => 
            typeof item === 'object' && item !== null 
              ? this.cleanObjectForFirestore(item) 
              : item
          );
          continue;
        }
        
        if (typeof value === 'object' && value !== null) {
          cleaned[key] = this.cleanObjectForFirestore(value);
          continue;
        }
        
        cleaned[key] = value;
      }
    }
    
    return cleaned;
  }

  resetForm(): void {
    if (confirm('Are you sure you want to reset the form? All changes will be lost.')) {
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