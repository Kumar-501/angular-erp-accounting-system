import { Component, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
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
  timing?: string;
  quantity?: string;
  combinationName?: string; // For kashayam combination
  combinationQuantity?: string; // For kashayam combination
  [key: string]: any;
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
export class EditSaleComponent implements OnInit, OnDestroy {
  @ViewChild('prescriptionModal', { static: false }) prescriptionModalRef!: ElementRef;
  
  saleForm!: FormGroup;
  todayDate: string;
  @ViewChild('saleDatePicker') saleDatePicker!: ElementRef;
@ViewChild('paidOnDatePicker') paidOnDatePicker!: ElementRef;
  products: Product[] = [];
  lastInteractionTime = 0;
  // In the component class
availableTaxRates: TaxRate[] = [];
availableTaxGroups: (TaxGroup & { calculatedRate: number })[] = [];

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
  shippingDocuments: File[] = [];
  afterTaxShippingControl: FormControl<number | null> = new FormControl<number | null>(null);
  showTransactionIdField = false;
  dropdownFilterFocused = false;
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
  preserveOriginalTotals: boolean = false; // CHANGED: Set to false by default to allow calculations
  
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


  // FIXED: Add tracking for manual prescription edits
  private hasManualPrescriptionEdit = false;
  private manualPatientName = '';
  private manualPatientAge = '';

  private searchTimeout: any;
  private closeDropdownTimeout: any;
  private modalInstance: any = null;
  private isModalProcessing = false;

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

  // Medicine types - Updated to include kasayam_combination
  medicineTypes = [
    { value: 'kasayam', label: ' കഷായം' },
    { value: 'kasayam_combination', label: 'കഷായം ' }, // Added this line
    { value: 'buligha', label: 'ഗുളിക' },
    { value: 'bhasmam', label: 'ഭസ്മം' },
    { value: 'krudham', label: 'ഘൃതം' },
    { value: 'suranam', label: 'ചൂർണ്ണം' },
    { value: 'rasayanam', label: 'രസായനം' },
    { value: 'lagium', label: 'ലേഹ്യം' }
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
// Converts internal date (YYYY-MM-DD) to DD-MM-YYYY for display in text box
getFormattedDateForInput(dateString: any): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

// Triggers the hidden native date picker
openDatePicker(type: 'saleDate' | 'paidOn'): void {
  if (type === 'saleDate') this.saleDatePicker.nativeElement.showPicker();
  else if (type === 'paidOn') this.paidOnDatePicker.nativeElement.showPicker();
}
calculateItemsTotal(): void {
  // Use the product subtotal (which includes tax and row discount)
  this.itemsTotal = this.products.reduce((sum, product) => {
    return sum + (product.subtotal || 0);
  }, 0);
  
  console.log('Total Items (Incl. Tax & Row Discount):', this.itemsTotal);
}

// Handles manual typing in DD-MM-YYYY format
onManualDateInput(event: any, controlName: string): void {
  const input = event.target.value.trim();
  const datePattern = /^(\d{2})-(\d{2})-(\d{4})$/;
  const match = input.match(datePattern);
  
  if (match) {
    const day = match[1];
    const month = match[2];
    const year = match[3];
    const isoDate = `${year}-${month}-${day}`;
    this.saleForm.get(controlName)?.setValue(isoDate);
  } else if (input !== '') {
    alert('Format must be DD-MM-YYYY');
    event.target.value = this.getFormattedDateForInput(this.saleForm.get(controlName)?.value);
  }
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

  ngOnDestroy(): void {
    // Clean up timeouts
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    if (this.closeDropdownTimeout) {
      clearTimeout(this.closeDropdownTimeout);
    }
    
    // Clean up modal
    this.cleanupModal();
  }
// --- Find and Replace these specific methods in edit-sale.component.ts ---

/**
 * UPDATED: Combined calculation logic to ensure decimals are handled 
 * and rounded consistently with the Add Sale component.
 */
recalculateAllTotals(): void {
  console.log('🔄 Recalculating all totals with rounding');
  
  // 1. Basic Items Total (Sum of priceBeforeTax * quantity)
  this.calculateItemsTotal();

  // 2. Apply Order-level Discount
  const discountedTotal = this.calculateDiscountedTotal();

  // 3. Calculate Product Taxes
  this.calculateProductTaxes();

  // 4. Calculate Shipping with Tax
  const shippingWithTax = this.calculateShippingWithTax();

  // 5. Finalize and Round
  this.calculateFinalTotals(discountedTotal, shippingWithTax);
}

/**
 * UPDATED: This is the core rounding logic.
 * It sets the totalPayable to a whole number and stores the difference in roundOff.
 */


/**
 * UPDATED: Simple balance calculation using the rounded totalPayable.
 */
calculateBalance(): void {
  const totalPayable = this.saleForm.get('totalPayable')?.value || 0; // This is now the whole number
  const paymentAmount = this.saleForm.get('paymentAmount')?.value || 0;
  const roundOff = this.saleForm.get('roundOff')?.value || 0;

  // Since totalPayable is already the rounded sum, calculation is direct
  if (paymentAmount > totalPayable) {
    this.saleForm.patchValue({
      changeReturn: parseFloat((paymentAmount - totalPayable).toFixed(2)),
      balance: 0
    }, { emitEvent: false });
  } else {
    this.saleForm.patchValue({
      changeReturn: 0,
      balance: parseFloat((totalPayable - paymentAmount).toFixed(2))
    }, { emitEvent: false });
  }
}

/**
 * UPDATED: Link the totalPayable trigger to the full recalculation flow.
 */
calculateTotalPayable(): void {
  this.recalculateAllTotals();
}

/**
 * UPDATED: Integrated rounding into the preservation toggle.
 */
togglePreservationMode(): void {
  this.preserveOriginalTotals = !this.preserveOriginalTotals;
  
  if (!this.preserveOriginalTotals) {
    this.recalculateAllTotals();
  } else {
    // Revert to original data stored when sale was first loaded
    this.saleForm.patchValue({
      totalPayable: this.originalTotalPayable,
      balance: this.originalBalance
    });
    this.calculateBalance();
  }
}

/**
 * UPDATED: Modified the save logic to ensure roundOff is explicitly sent to Firestore.
 */
updateSale(): void {
  if (this.isSubmitting) return;
  
  if (this.saleForm.invalid) {
    this.markFormGroupTouched(this.saleForm);
    this.showToast('Please fill all required fields correctly', 'error');
    return;
  }

  // Ensure calculations are fresh before saving
  this.recalculateAllTotals();
  this.isSubmitting = true;

  const formValue = this.saleForm.getRawValue();
  const selectedCustomerId = formValue.customer; 
  const customerObject = this.customers.find(c => c.id === selectedCustomerId);
  const customerNameToSave = customerObject ? customerObject.displayName : (formValue.customerName || 'Unknown Customer');

  const productsToSave = [...this.products].map(product => ({
    // ... (map logic same as before)
    ...product,
    subtotal: product.subtotal // Ensure row-level subtotals are preserved
  }));

  const saleData = {
    ...formValue,
    customer: customerNameToSave,
    customerId: selectedCustomerId,
    products: productsToSave,
    // Explicitly confirm these are numbers for the DB
    totalPayable: Number(formValue.totalPayable),
    roundOff: Number(formValue.roundOff),
    balance: Number(formValue.balance),
    prescriptions: this.prescriptions.length > 0 ? this.prescriptions : null,
    updatedAt: new Date(),
    isEditOperation: true,
    skipStockValidation: true
  };

  const cleanedSaleData = this.cleanObjectForFirestore(saleData);

  this.saleService.updateSaleWithStockHandling(this.saleId, cleanedSaleData)
    .then(() => {
      this.isSubmitting = false;
      this.showToast('Sale updated successfully! 🎉', 'success');
      this.router.navigate(['/sales-order']);
    })
    .catch((error: any) => { 
      this.isSubmitting = false;
      this.showToast(error.message || 'Error updating sale.', 'error');
    });
}
  private cleanupModal(): void {
    try {
      if (this.modalInstance) {
        this.modalInstance.dispose();
        this.modalInstance = null;
      }
      
      // Remove any remaining modal backdrops
      const backdrops = document.querySelectorAll('.modal-backdrop');
      backdrops.forEach(backdrop => backdrop.remove());
      
      // Remove modal-open class from body
      document.body.classList.remove('modal-open');
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
      
      this.isModalProcessing = false;
    } catch (error) {
      console.warn('Error cleaning up modal:', error);
    }
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

        // Correctly format the sale date before patching the form
        let formattedSaleDate = this.todayDate;
        if (sale.saleDate) {
            try {
                let saleDateObject: Date;

                // FIXED: Add a more robust type check for Firestore Timestamps
                if (sale.saleDate && typeof sale.saleDate === 'object' && typeof (sale.saleDate as any).toDate === 'function') {
                    // It's a Firestore Timestamp, so call toDate()
                    saleDateObject = (sale.saleDate as any).toDate();
                } else {
                    // It's likely an ISO string or a Date object already
                    saleDateObject = new Date(sale.saleDate as string | number | Date);
                }

                // Ensure the date is valid before transforming
                if (!isNaN(saleDateObject.getTime())) {
                    formattedSaleDate = this.datePipe.transform(saleDateObject, 'yyyy-MM-dd') || this.todayDate;
                }
            } catch (error) {
                console.error("Could not parse sale date, defaulting to today.", error);
                formattedSaleDate = this.todayDate;
            }
        }

        // Populate form with sale data
        this.saleForm.patchValue({
          customer: sale.customerId || sale.customer || '',
          customerName: sale.customerName || '',
          customerPhone: sale.customerPhone || '',
          customerEmail: sale.customerEmail || '',
          alternateContact: sale.alternateContact || '',
          customerAge: sale.customerAge || null,
                    // orderStatus: sale.orderStatus || '', // <-- Removed: orderStatus does not exist on SalesOrder

          customerDob: sale.customerDob || null,
          customerOccupation: sale.customerOccupation || '',
          customerGender: sale.customerGender || '',
          billingAddress: sale.billingAddress || '',
          shippingAddress: sale.shippingAddress || '',
          saleDate: formattedSaleDate, // Use the correctly formatted date here
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
                  orderStatus: 'Pending',

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
      this.products = [];

        // Load products only if they exist in the sale
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

addNewPrescription(): void {
  console.log('➕ Adding new prescription');
  
  // Reset the editing index and manual edit tracking
  this.editingPrescriptionIndex = null;
  this.hasManualPrescriptionEdit = false;
  this.manualPatientName = '';
  this.manualPatientAge = '';
  
  // Auto-fetch and set customer details
  this.autoFetchCustomerDetails();
  
  // Reset prescription data with fresh customer info from form
  this.resetPrescriptionDataWithCustomerInfo();
  
  // Open the modal
  this.openPrescriptionModal();
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
          orderStatus: ['', Validators.required], // <-- FIX: Add this line

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
      paymentAccount: [''],
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
      paymentMethod: [''],
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

    // UPDATED: Make discount and shipping changes trigger recalculation
    this.saleForm.get('discountAmount')?.valueChanges.subscribe(() => {
      this.recalculateAllTotals();
    });

    this.saleForm.get('orderTax')?.valueChanges.subscribe(() => {
      this.recalculateAllTotals();
    });

    this.saleForm.get('shippingCharges')?.valueChanges.subscribe(() => {
      this.recalculateAllTotals();
    });

    this.saleForm.get('discountType')?.valueChanges.subscribe(() => {
      this.recalculateAllTotals();
    });
  }

calculateDiscountedTotal(): number {
  const discountAmount = this.saleForm.get('discountAmount')?.value || 0;
  const discountType = this.saleForm.get('discountType')?.value || 'Percentage';
  
  let finalAmount = this.itemsTotal; // This is now sum of subtotals
  
  if (discountType === 'Percentage') {
    finalAmount = this.itemsTotal - (this.itemsTotal * discountAmount / 100);
  } else {
    finalAmount = this.itemsTotal - discountAmount;
  }
  
  return Math.max(0, finalAmount);
}
// In your component class, add this method:
calculateSubtotalsTotal(): number {
  return this.products.reduce((sum, product) => {
    return sum + (product.subtotal || 0);
  }, 0);
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
  
  this.shippingTaxAmount = parseFloat((shippingBeforeTax * (taxRate / 100)).toFixed(2));
  
  this.saleForm.patchValue({
    shippingTaxAmount: this.shippingTaxAmount
  }, { emitEvent: false });
  
  // Update the after-tax shipping control value with rounded number
  const afterTaxValue = parseFloat((shippingBeforeTax + this.shippingTaxAmount).toFixed(2));
  this.afterTaxShippingControl.setValue(afterTaxValue, { emitEvent: false });
}

  calculateBalanceOnly(): void {
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



calculateFinalTotals(discountedTotal: number, shippingWithTax: number): void {
  const serviceCharge = this.ppServiceData?.packingCharge || this.codData?.packingCharge || 0;
  
  /* 
     CRITICAL CHANGE: 
     We no longer add this.productTaxAmount here because it is 
     already inside the 'discountedTotal' (which came from itemsTotal/subtotals)
  */
  const rawTotal = discountedTotal + shippingWithTax + serviceCharge;
  
  const roundedTotal = Math.round(rawTotal);
  const roundOff = roundedTotal - rawTotal;
  
  this.saleForm.patchValue({
    roundOff: parseFloat(roundOff.toFixed(2)),
    totalPayable: roundedTotal 
  }, { emitEvent: false });
  
  this.calculateBalance();
}

 calculateProductTax(product: Product): void {
  const taxRate = product.taxRate || 0;
  const taxableAmount = (product.priceBeforeTax || 0) * product.quantity;
  
  product.taxAmount = (taxableAmount * taxRate) / 100;
  
  if (taxRate === 18) {
    product.taxType = 'GST'; // Changed from 'CGST+SGST' to just 'GST'
    product.cgstAmount = product.taxAmount / 2;
    product.sgstAmount = product.taxAmount / 2;
    product.igstAmount = 0;
  } else if (taxRate === 28) {
    product.taxType = 'IGST';
    product.igstAmount = product.taxAmount;
    product.cgstAmount = 0;
    product.sgstAmount = 0;
  } else if (taxRate > 0) {
    product.taxType = 'GST'; // Changed from 'CGST+SGST' to just 'GST'
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

    // UPDATED: Always recalculate totals when products change
    this.recalculateAllTotals();
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
    
    // UPDATED: Always recalculate totals when products are added
    this.recalculateAllTotals();
  }

  private showToast(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') {
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
      case 'warning':
        this.toastr.warning(message, 'Warning', toastOptions);
        break;
      default:
        this.toastr.info(message, 'Info', toastOptions);
    }
  }

  removeProduct(index: number): void {
    if (this.products.length <= 1) {
      this.showToast('At least one product is required', 'error');
      return;
    }
    
    this.products.splice(index, 1);
    
    // UPDATED: Always recalculate totals when products are removed
    this.recalculateAllTotals();
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
    
    // Trigger customer details change event
    this.onCustomerDetailsChange();
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
          customerOccupation: foundCustomer.occupation || '', // Add this line

        customerGender: foundCustomer.gender || '',
        billingAddress: foundCustomer.addressLine1 || '',
        shippingAddress: foundCustomer.addressLine1 || '',
        creditLimit: foundCustomer.creditLimit || 0
      });
      this.customerSearchInput = foundCustomer.displayName;
      
      // Trigger customer details change event
      this.onCustomerDetailsChange();
    }
  }

  onCustomerBlur(): void {
    setTimeout(() => {
      this.showCustomerDropdown = false;
    }, 200);
  }

  // FIXED: Customer details change handler
  onCustomerDetailsChange(): void {
    console.log('🔄 Customer details changed');
    
    // Only update prescription if modal is open and no manual edits have been made
    if (this.modalInstance && 
        document.getElementById('prescriptionModal')?.classList.contains('show') &&
        !this.hasManualPrescriptionEdit) {
      
      console.log('📝 Updating prescription with new customer details');
      
      // Update prescription data
      this.prescriptionData.patientName = this.saleForm.get('customerName')?.value || '';
      this.prescriptionData.patientAge = this.saleForm.get('customerAge')?.value?.toString() || '';
      
      // Update the modal fields
      this.updatePatientInfoInModal();
    }
  }

  // FIXED: Patient name edit handlers
  onPatientNameEdit(event: any): void {
    const newValue = event.target.textContent?.trim() || '';
    console.log('✏️ Patient name manually edited to:', newValue);
    
    this.hasManualPrescriptionEdit = true;
    this.manualPatientName = newValue;
    this.prescriptionData.patientName = newValue;
  }

  onPatientNameInput(event: any): void {
    const newValue = event.target.textContent?.trim() || '';
    this.hasManualPrescriptionEdit = true;
    this.manualPatientName = newValue;
    this.prescriptionData.patientName = newValue;
  }

  onPatientAgeEdit(event: any): void {
    const newValue = event.target.textContent?.trim() || '';
    console.log('✏️ Patient age manually edited to:', newValue);
    
    this.hasManualPrescriptionEdit = true;
    this.manualPatientAge = newValue;
    this.prescriptionData.patientAge = newValue;
  }

  onPatientAgeInput(event: any): void {
    const newValue = event.target.textContent?.trim() || '';
    this.hasManualPrescriptionEdit = true;
    this.manualPatientAge = newValue;
    this.prescriptionData.patientAge = newValue;
  }

// Method to manually refresh customer info in prescription
refreshCustomerInfoInPrescription(): void {
  if (this.prescriptionData && !this.hasManualPrescriptionEdit) {
    this.autoFetchCustomerDetails();
    this.prescriptionData.patientName = this.saleForm.get('customerName')?.value || '';
    this.prescriptionData.patientAge = this.saleForm.get('customerAge')?.value?.toString() || '';
    this.updatePatientInfoInModal();
    this.showToast('Customer information updated in prescription', 'success');
  }
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
 async onCustomerSave(updatedCustomer: any): Promise<void> {
    try {
      const updatedBy = this.currentUser; // Get the name of the user making the change

      // Step 1: Update the main customer record in the database
      // This also creates a detailed activity log for the customer.
      await this.customerService.updateCustomer(updatedCustomer.id, updatedCustomer, updatedBy);

      // Step 2: Prepare the data to update on the current sale document
      const saleUpdateData = {
        customerName: updatedCustomer.displayName || 
                      `${updatedCustomer.firstName || ''} ${updatedCustomer.lastName || ''}`.trim(),
        customerPhone: updatedCustomer.mobile || updatedCustomer.phone || '',
        customerEmail: updatedCustomer.email || '',
        billingAddress: updatedCustomer.billingAddress || updatedCustomer.addressLine1 || '',
        shippingAddress: updatedCustomer.shippingAddress || updatedCustomer.addressLine1 || '',
        alternateContact: updatedCustomer.alternateContact || '',
        customerAge: updatedCustomer.age || null,
        customerDob: updatedCustomer.dob || null,
        customerGender: updatedCustomer.gender || '',
        customerOccupation: updatedCustomer.occupation || '',
        updatedAt: new Date() // Mark the sale as updated
      };
      
      // Step 3: Update the current sale document in the database
      if (this.saleId) {
        await this.saleService.updateSaleWithStockHandling(this.saleId, saleUpdateData);
      }
      
      // Step 4: Update the local component state to reflect the changes instantly
      
      // Update the main form
      this.saleForm.patchValue(saleUpdateData);
      
      // Update the customer in the local customers array
      const index = this.customers.findIndex(c => c.id === updatedCustomer.id);
      if (index >= 0) {
        this.customers[index] = { ...this.customers[index], ...updatedCustomer };
        this.filteredCustomers = [...this.customers]; // Refresh filtered list
      } else {
        // If for some reason the customer wasn't in the list, add them
        this.customers.push(updatedCustomer);
      }
      
      // Update the search input to show the new customer name
      this.customerSearchInput = updatedCustomer.displayName || 
                                 `${updatedCustomer.firstName || ''} ${updatedCustomer.lastName || ''}`.trim();
      
      // Close the popup
      this.showCustomerEditPopup = false;
      
      // Notify the user of success
      this.showToast('Customer and sale information updated successfully!', 'success');

      // Trigger change detection to be sure the UI updates
      this.changeDetectorRef.detectChanges();

    } catch (error) {
      console.error('Error saving customer changes:', error);
      this.showToast('Failed to save customer changes. Please try again.', 'error');
    }
  }

onCodFormSubmit(formData: any): void {
  this.codData = formData;
  this.showCodPopup = false;
  
  // CRITICAL FIX: Recalculate all totals to include the new COD packing charge.
  this.recalculateAllTotals();
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
  
  // CRITICAL FIX: Recalculate all totals to include the new PP service packing charge.
  this.recalculateAllTotals();
}

  onPpServiceClose(): void {
    this.showPpServicePopup = false;
    
    if (!this.ppServiceData) {
      this.saleForm.patchValue({
        typeOfService: ''
      });
    }
  }

  // Prescription methods with improved modal handling - FIXED VERSION
  selectMedicineType(type: string): void {
    this.selectedMedicineType = type;
  }

  getMedicineTypeName(type: string): string {
    const typeNames: {[key: string]: string} = {
      'kasayam': 'കഷായം',
      'kasayam_combination': 'കഷായം', // Added this line
      'buligha': 'ഗുളിക',
      'bhasmam': 'ഭസ്മം',
      'krudham': 'ഘൃതം',
      'suranam': 'ചൂർണ്ണം',
      'rasayanam': 'രസായനം',
      'lagium': 'ലേഹ്യം'
    };
    return typeNames[type] || 'Medicine';
  }

  // Updated addMedicineByType method to include kasayam_combination
  addMedicineByType(): void {
    if (!this.selectedMedicineType) return;

    const newMedicine: Medicine = {
      name: '',
      type: this.selectedMedicineType,
      time: 'രാവിലെ / ഉച്ചയ്ക്ക് / രാത്രി',
      timing: 'before' // Default timing
    };

    switch(this.selectedMedicineType) {
      case 'kasayam':
        newMedicine.instructions = '';
        newMedicine.quantity = '';
        newMedicine.powder = '';
        newMedicine.pills = '';
        break;
      case 'kasayam_combination': // Added this case
        newMedicine.instructions = '';
        newMedicine.quantity = '';
        newMedicine.combinationName = '';
        newMedicine.combinationQuantity = '';
        newMedicine.frequency = '';
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
        newMedicine.frequency = '';
        break;
      case 'suranam':
        newMedicine.instructions = '';
        newMedicine.powder = '';
        newMedicine.dosage = '';
        newMedicine.frequency = '';
        break;
      case 'rasayanam':
        newMedicine.instructions = '';
        break;
      case 'lagium':
        newMedicine.instructions = '';
        newMedicine.dosage = '';
        newMedicine.frequency = '';
        break;
    }

    this.prescriptionData.medicines.push(newMedicine);
    this.selectedMedicineType = '';
    
    // Force change detection and wait for DOM update
    this.changeDetectorRef.detectChanges();
    
    setTimeout(() => {
      const lastIndex = this.prescriptionData.medicines.length - 1;
      const firstField = document.getElementById(`medicineName_${lastIndex}`);
      if (firstField) {
        firstField.focus();
      }
    }, 100);
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
    
    // Force change detection and wait for DOM update
    this.changeDetectorRef.detectChanges();
    
    setTimeout(() => {
      const lastIndex = this.prescriptionData.medicines.length - 1;
      const firstField = document.getElementById(`medicineName_${lastIndex}`);
      if (firstField) {
        firstField.focus();
      }
    }, 100);
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
      type: '',
      timing: 'before'
    });

    // Force change detection and wait for DOM update
    this.changeDetectorRef.detectChanges();

    setTimeout(() => {
      const lastIndex = this.prescriptionData.medicines.length - 1;
      const firstField = document.getElementById(`medicineName_${lastIndex}`);
      if (firstField) {
        firstField.focus();
      }
    }, 100);
  }

  removeMedicine(index: number): void {
    this.prescriptionData.medicines.splice(index, 1);
    this.changeDetectorRef.detectChanges();
  }

openPrescriptionModal(): void {
  console.log('🔵 openPrescriptionModal called');
  
  // Prevent multiple modal operations
  if (this.isModalProcessing) {
    console.log('⚠️ Modal operation already in progress');
    return;
  }

  this.isModalProcessing = true;

  try {
    // Clean up any existing modal first
    this.cleanupModal();

    // If not editing, reset prescription data with customer info
    if (this.editingPrescriptionIndex === null) {
      this.resetPrescriptionDataWithCustomerInfo();
    } else {
      // For editing, preserve the existing medicines but update patient info only if no manual edits
      this.prescriptionData = {
        ...this.prescriptions[this.editingPrescriptionIndex]
      };
      
      // Don't override manual edits
      if (!this.hasManualPrescriptionEdit) {
        this.prescriptionData.patientName = this.saleForm.get('customerName')?.value || this.prescriptionData.patientName || '';
        this.prescriptionData.patientAge = this.saleForm.get('customerAge')?.value?.toString() || this.prescriptionData.patientAge || '';
      }
    }
    
    // Force change detection before showing modal
    this.changeDetectorRef.detectChanges();

    // Use setTimeout to ensure DOM is ready
    setTimeout(() => {
      const modalElement = document.getElementById('prescriptionModal');
      if (modalElement) {
        try {
          this.modalInstance = new bootstrap.Modal(modalElement, {
            focus: true,
            keyboard: true,
            backdrop: 'static'
          });
          
          // Add event listeners for modal events
          modalElement.addEventListener('hidden.bs.modal', () => {
            this.onModalHidden();
          });

          modalElement.addEventListener('shown.bs.modal', () => {
            this.isModalProcessing = false;
            console.log('✅ Modal shown successfully');
            
            // Update form fields after modal is shown
            this.updatePatientInfoInModal();
            
            // If editing, populate the fields after modal is fully shown
            if (this.editingPrescriptionIndex !== null) {
              setTimeout(() => {
                this.updateFormFieldsFromPrescription();
              }, 100);
            }
          });

          this.modalInstance.show();
          console.log('🚀 Modal show() called');
        } catch (error) {
          console.error('❌ Error creating modal:', error);
          this.isModalProcessing = false;
          this.showToast('Error opening prescription modal. Please try again.', 'error');
        }
      } else {
        console.error('❌ Modal element not found');
        this.isModalProcessing = false;
        this.showToast('Modal element not found. Please refresh the page.', 'error');
      }
    }, 150);

  } catch (error) {
    console.error('❌ Error in openPrescriptionModal:', error);
    this.isModalProcessing = false;
    this.showToast('Error opening prescription modal. Please try again.', 'error');
  }
}

// Auto-fetch customer details from the form
private autoFetchCustomerDetails(): void {
  const customerName = this.saleForm.get('customerName')?.value || '';
  const customerAge = this.saleForm.get('customerAge')?.value || '';
  const customerPhone = this.saleForm.get('customerPhone')?.value || '';

  console.log('📝 Auto-fetching customer details:', {
    customerName,
    customerAge,
    customerPhone
  });

  // If customer name is empty but we have a phone, try to find customer
  if (!customerName && customerPhone) {
    const foundCustomer = this.customers.find(customer => {
      const customerPhones = [
        customer.mobile,
        customer.phone,
        customer.alternateContact,
        customer.landline
      ].filter(phone => phone);

      return customerPhones.some(phone => {
        const cleanPhone = phone?.replace(/\D/g, '') || '';
        const cleanInputPhone = customerPhone.replace(/\D/g, '');
        return phone === customerPhone || cleanPhone === cleanInputPhone;
      });
    });

    if (foundCustomer) {
      this.saleForm.patchValue({
        customerName: foundCustomer.displayName,
        customerAge: foundCustomer.age
      });
    }
  }
}

// Reset prescription data with customer information
private resetPrescriptionDataWithCustomerInfo(): void {
  // Reset manual edit tracking
  this.hasManualPrescriptionEdit = false;
  this.manualPatientName = '';
  this.manualPatientAge = '';
  
  const customerName = this.saleForm.get('customerName')?.value || '';
  const customerAge = this.saleForm.get('customerAge')?.value || '';

  this.prescriptionData = {
    medicines: [],
    patientName: customerName,
    patientAge: customerAge?.toString() || '',
    date: this.todayDate,
    additionalNotes: ''
  };

  console.log('🔄 Reset prescription data with customer info:', this.prescriptionData);
}

// Update patient info in modal after it's shown
private updatePatientInfoInModal(): void {
  setTimeout(() => {
    // Only update if no manual edits have been made
    if (!this.hasManualPrescriptionEdit) {
      // Update patient name field
      const patientNameElement = document.getElementById('patientName');
      if (patientNameElement) {
        patientNameElement.textContent = this.prescriptionData.patientName || '';
      }

      // Update patient age field
      const patientAgeElement = document.getElementById('patientAge');
      if (patientAgeElement) {
        patientAgeElement.textContent = this.prescriptionData.patientAge || '';
      }
    }

    // Always update date field
    const dateElement = document.getElementById('prescriptionDate');
    if (dateElement) {
      dateElement.textContent = this.prescriptionData.date || this.todayDate;
    }

    console.log('✅ Updated patient info in modal');
  }, 100);
}
  private onModalHidden(): void {
    console.log('🔴 Modal hidden event triggered');
    this.cleanupModal();
    this.editingPrescriptionIndex = null;
    this.isModalProcessing = false;
    
    // Reset manual edit tracking when modal is closed
    this.hasManualPrescriptionEdit = false;
    this.manualPatientName = '';
    this.manualPatientAge = '';
    
    // Force change detection
    this.changeDetectorRef.detectChanges();
  }

  editPrescription(index: number): void {
    // Prevent multiple rapid clicks
    if (this.isModalProcessing) {
      console.log('⚠️ Modal operation already in progress, ignoring edit request');
      return;
    }

    try {
      console.log('✏️ Editing prescription at index:', index);
      
      if (index < 0 || index >= this.prescriptions.length) {
        this.showToast('Invalid prescription index', 'error');
        return;
      }

      // Set editing index and copy prescription data
      this.editingPrescriptionIndex = index;
      this.prescriptionData = JSON.parse(JSON.stringify(this.prescriptions[index]));
      
      // Mark as manual edit since we're editing an existing prescription
      this.hasManualPrescriptionEdit = true;
      this.manualPatientName = this.prescriptionData.patientName || '';
      this.manualPatientAge = this.prescriptionData.patientAge || '';
      
      // Ensure required fields have default values
      this.prescriptionData.date = this.prescriptionData.date || this.todayDate;
      
      // Ensure all medicines have required properties
      this.prescriptionData.medicines = this.prescriptionData.medicines.map(medicine => ({
        ...medicine,
        timing: medicine.timing || 'before',
        name: medicine.name || '',
        type: medicine.type || '',
        time: medicine.time || 'രാവിലെ / ഉച്ചയ്ക്ക് / രാത്രി'
      }));

      console.log('📝 Prescription data to edit:', this.prescriptionData);
      
      // Open the modal
      this.openPrescriptionModal();

    } catch (error) {
      console.error('❌ Error in editPrescription:', error);
      this.showToast('Error loading prescription for editing. Please try again.', 'error');
      this.editingPrescriptionIndex = null;
      this.isModalProcessing = false;
    }
  }

  deletePrescription(index: number): void {
    if (confirm('Are you sure you want to delete this prescription?')) {
      this.prescriptions.splice(index, 1);
      this.showToast('Prescription deleted successfully!', 'success');
    }
  }

  // FIXED: Updated updateFormFieldsFromPrescription method
  private updateFormFieldsFromPrescription(): void {
    try {
      console.log('🔄 Updating form fields from prescription data:', this.prescriptionData);

      // Update patient information only if manual edits are allowed
      if (this.hasManualPrescriptionEdit) {
        this.setEditableFieldValue('patientName', this.prescriptionData.patientName);
        this.setEditableFieldValue('patientAge', this.prescriptionData.patientAge || '');
      }

      // Update prescription date
      const dateElement = document.getElementById('prescriptionDate');
      if (dateElement) {
        dateElement.textContent = this.prescriptionData.date || this.todayDate;
      }

      // Update medicines
      this.prescriptionData.medicines.forEach((medicine, index) => {
        console.log(`🔄 Updating medicine ${index}:`, medicine);
        
        switch(medicine.type) {
          case 'kasayam':
            this.setEditableFieldValue(`kasayamName_${index}`, medicine.name);
            this.setEditableFieldValue(`kasayamInstructions_${index}`, medicine.instructions);
            this.setEditableFieldValue(`kasayamQuantity_${index}`, medicine.quantity);
            this.setEditableFieldValue(`kasayamPowder_${index}`, medicine.powder);
            this.setEditableFieldValue(`kasayamPills_${index}`, medicine.pills);
            
            // Set timing dropdown
            this.setSelectValue(`timing_${index}`, medicine.timing || 'before');
            break;
            
          case 'kasayam_combination':
            this.setEditableFieldValue(`combkasayamName_${index}`, medicine.name);
            this.setEditableFieldValue(`combquantity_${index}`, medicine.quantity);
            this.setEditableFieldValue(`combquantity2_${index}`, medicine.combinationQuantity);
            this.setEditableFieldValue(`combMedicineNam_${index}`, medicine.combinationName);
            this.setEditableFieldValue(`combfrequency_${index}`, medicine.frequency);
            
            // Set timing dropdown
            this.setSelectValue(`timing_${index}`, medicine.timing || 'before');
            break;
            
          case 'buligha':
            this.setEditableFieldValue(`bulighaName_${index}`, medicine.name);
            this.setEditableFieldValue(`bulighaInstructions_${index}`, medicine.instructions);
            this.setEditableFieldValue(`bulighaPowder_${index}`, medicine.powder);
            this.setSelectValue(`timing_${index}`, medicine.timing || 'before');
            break;
            
          case 'bhasmam':
            this.setEditableFieldValue(`bhasmamName_${index}`, medicine.name);
            this.setEditableFieldValue(`bhasmamDosage_${index}`, medicine.dosage);
            this.setEditableFieldValue(`bhasmamQuantity_${index}`, medicine.quantity);
            this.setEditableFieldValue(`bhasmamInstructions_${index}`, medicine.instructions);
            this.setEditableFieldValue(`bhasmamPowder_${index}`, medicine.powder);
            this.setSelectValue(`timing_${index}`, medicine.timing || 'before');
            break;
            
          case 'krudham':
            this.setEditableFieldValue(`krudhamName_${index}`, medicine.name);
            this.setEditableFieldValue(`krudhamInstructions_${index}`, medicine.instructions);
            this.setEditableFieldValue(`krudhamFrequency_${index}`, medicine.frequency);
            this.setSelectValue(`timing_${index}`, medicine.timing || 'before');
            break;
            
          case 'suranam':
            this.setEditableFieldValue(`suranamName_${index}`, medicine.name);
            this.setEditableFieldValue(`suranamInstructions_${index}`, medicine.instructions);
            this.setEditableFieldValue(`suranamPowder_${index}`, medicine.powder);
            this.setEditableFieldValue(`suranamFrequency_${index}`, medicine.frequency);
            this.setSelectValue(`timing_${index}`, medicine.timing || 'before');
            break;
            
          case 'rasayanam':
            this.setEditableFieldValue(`rasayanamName_${index}`, medicine.name);
            this.setEditableFieldValue(`rasayanamInstructions_${index}`, medicine.instructions);
            this.setSelectValue(`timing_${index}`, medicine.timing || 'before');
            break;
            
          case 'lagium':
            this.setEditableFieldValue(`lagiumName_${index}`, medicine.name);
            this.setEditableFieldValue(`lagiumInstructions_${index}`, medicine.instructions);
            this.setEditableFieldValue(`lagiumFrequency_${index}`, medicine.frequency);
            this.setSelectValue(`timing_${index}`, medicine.timing || 'before');
            break;
            
          default:
            this.setEditableFieldValue(`medicineName_${index}`, medicine.name);
            break;
        }
      });

      // Update additional notes
      const notesElement = document.getElementById('additionalNotes') as HTMLTextAreaElement;
      if (notesElement && this.prescriptionData.additionalNotes) {
        notesElement.value = this.prescriptionData.additionalNotes;
      }

      console.log('✅ Form fields updated successfully');
    } catch (error) {
      console.error('❌ Error updating form fields from prescription:', error);
    }
  }

  // FIXED: Helper method to set editable field values
  private setEditableFieldValue(id: string, value: string | undefined): void {
    setTimeout(() => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = value || '';
        console.log(`✅ Set field ${id} to: ${value || ''}`);
      } else {
        console.warn(`⚠️ Element with id ${id} not found`);
      }
    }, 50);
  }

  // FIXED: Helper method to set select values
  private setSelectValue(name: string, value: string): void {
    setTimeout(() => {
      const selectElement = document.querySelector(`[name="${name}"]`) as HTMLSelectElement;
      if (selectElement) {
        selectElement.value = value;
        console.log(`✅ Set select ${name} to: ${value}`);
      } else {
        console.warn(`⚠️ Select element with name ${name} not found`);
      }
    }, 50);
  }

  // Keep the old method for backward compatibility
  private setEditableField(id: string, value: string | undefined): void {
    this.setEditableFieldValue(id, value);
  }

  // FIXED: savePrescription method
  savePrescription(): void {
    try {
      console.log('💾 Saving prescription...');
      console.log('Current prescription data:', this.prescriptionData);
      console.log('Editing index:', this.editingPrescriptionIndex);
      
      // Collect data from DOM elements
      this.savePrescriptionData();
      
      if (this.editingPrescriptionIndex !== null) {
        // Update existing prescription
        console.log('📝 Updating existing prescription at index:', this.editingPrescriptionIndex);
        this.prescriptions[this.editingPrescriptionIndex] = JSON.parse(JSON.stringify(this.prescriptionData));
        this.showToast('Prescription updated successfully!', 'success');
      } else {
        // Add new prescription
        console.log('➕ Adding new prescription');
        this.prescriptions.push(JSON.parse(JSON.stringify(this.prescriptionData)));
        this.showToast('Prescription saved successfully!', 'success');
      }
      
      console.log('📋 All prescriptions:', this.prescriptions);
      
      // Close modal properly
      if (this.modalInstance) {
        this.modalInstance.hide();
      }
      
      // Reset state
      this.editingPrescriptionIndex = null;
      this.resetPrescriptionData();
      
      // Force change detection
      this.changeDetectorRef.detectChanges();
      
    } catch (error) {
      console.error('❌ Error saving prescription:', error);
      this.showToast('Error saving prescription. Please try again.', 'error');
    }
  }

  // FIXED: Updated savePrescriptionData method to handle manual edits properly
  private savePrescriptionData(): void {
    // Get patient information - prioritize manual edits over form data
    if (this.hasManualPrescriptionEdit) {
      // Use manually edited values
      this.prescriptionData.patientName = this.getEditableFieldContent('patientName') || this.manualPatientName || 'Unknown Patient';
      this.prescriptionData.patientAge = this.getEditableFieldContent('patientAge') || this.manualPatientAge || '';
    } else {
      // Use form data as fallback
      this.prescriptionData.patientName = this.getEditableFieldContent('patientName') || 
                                          this.saleForm.get('customerName')?.value || 
                                          'Unknown Patient';
      this.prescriptionData.patientAge = this.getEditableFieldContent('patientAge') || 
                                         this.saleForm.get('customerAge')?.value?.toString() || 
                                         '';
    }
    
    this.prescriptionData.date = this.todayDate;

    console.log('💾 Saving patient info:', {
      patientName: this.prescriptionData.patientName,
      patientAge: this.prescriptionData.patientAge,
      hasManualEdit: this.hasManualPrescriptionEdit
    });

    // Update medicines from DOM
    this.prescriptionData.medicines.forEach((medicine, index) => {
      console.log(`💾 Saving medicine ${index} of type ${medicine.type}`);
      
      switch(medicine.type) {
        case 'kasayam':
          medicine.name = this.getEditableFieldContent(`kasayamName_${index}`) || medicine.name || '';
          medicine.instructions = this.getEditableFieldContent(`kasayamInstructions_${index}`) || medicine.instructions || '';
          medicine.pills = this.getEditableFieldContent(`kasayamPills_${index}`) || medicine.pills || '';
          medicine.quantity = this.getEditableFieldContent(`kasayamQuantity_${index}`) || medicine.quantity || '';
          medicine.powder = this.getEditableFieldContent(`kasayamPowder_${index}`) || medicine.powder || '';
          medicine.timing = this.getSelectValue(`timing_${index}`) || medicine.timing || 'before';
          break;
          
        case 'kasayam_combination':
          medicine.name = this.getEditableFieldContent(`combkasayamName_${index}`) || medicine.name || '';
          medicine.quantity = this.getEditableFieldContent(`combquantity_${index}`) || medicine.quantity || '';
          medicine.combinationQuantity = this.getEditableFieldContent(`combquantity2_${index}`) || medicine.combinationQuantity || '';
          medicine.combinationName = this.getEditableFieldContent(`combMedicineNam_${index}`) || medicine.combinationName || '';
          medicine.frequency = this.getEditableFieldContent(`combfrequency_${index}`) || medicine.frequency || '';
          medicine.timing = this.getSelectValue(`timing_${index}`) || medicine.timing || 'before';
          break;
          
        case 'buligha':
          medicine.name = this.getEditableFieldContent(`bulighaName_${index}`) || medicine.name || '';
          medicine.instructions = this.getEditableFieldContent(`bulighaInstructions_${index}`) || medicine.instructions || '';
          medicine.powder = this.getEditableFieldContent(`bulighaPowder_${index}`) || medicine.powder || '';
          medicine.timing = this.getSelectValue(`timing_${index}`) || medicine.timing || 'before';
          break;
          
        case 'bhasmam':
          medicine.name = this.getEditableFieldContent(`bhasmamName_${index}`) || medicine.name || '';
          medicine.dosage = this.getEditableFieldContent(`bhasmamDosage_${index}`) || medicine.dosage || '';
          medicine.quantity = this.getEditableFieldContent(`bhasmamQuantity_${index}`) || medicine.quantity || '';
          medicine.instructions = this.getEditableFieldContent(`bhasmamInstructions_${index}`) || medicine.instructions || '';
          medicine.powder = this.getEditableFieldContent(`bhasmamPowder_${index}`) || medicine.powder || '';
          medicine.timing = this.getSelectValue(`timing_${index}`) || medicine.timing || 'before';
          break;
          
        case 'krudham':
          medicine.name = this.getEditableFieldContent(`krudhamName_${index}`) || medicine.name || '';
          medicine.instructions = this.getEditableFieldContent(`krudhamInstructions_${index}`) || medicine.instructions || '';
          medicine.frequency = this.getEditableFieldContent(`krudhamFrequency_${index}`) || medicine.frequency || '';
          medicine.timing = this.getSelectValue(`timing_${index}`) || medicine.timing || 'before';
          break;
          
        case 'suranam':
          medicine.name = this.getEditableFieldContent(`suranamName_${index}`) || medicine.name || '';
          medicine.instructions = this.getEditableFieldContent(`suranamInstructions_${index}`) || medicine.instructions || '';
          medicine.powder = this.getEditableFieldContent(`suranamPowder_${index}`) || medicine.powder || '';
          medicine.frequency = this.getEditableFieldContent(`suranamFrequency_${index}`) || medicine.frequency || '';
          medicine.timing = this.getSelectValue(`timing_${index}`) || medicine.timing || 'before';
          break;
          
        case 'rasayanam':
          medicine.name = this.getEditableFieldContent(`rasayanamName_${index}`) || medicine.name || '';
          medicine.instructions = this.getEditableFieldContent(`rasayanamInstructions_${index}`) || medicine.instructions || '';
          medicine.timing = this.getSelectValue(`timing_${index}`) || medicine.timing || 'before';
          break;
          
        case 'lagium':
          medicine.name = this.getEditableFieldContent(`lagiumName_${index}`) || medicine.name || '';
          medicine.instructions = this.getEditableFieldContent(`lagiumInstructions_${index}`) || medicine.instructions || '';
          medicine.frequency = this.getEditableFieldContent(`lagiumFrequency_${index}`) || medicine.frequency || '';
          medicine.timing = this.getSelectValue(`timing_${index}`) || medicine.timing || 'before';
          break;
          
        default:
          medicine.name = this.getEditableFieldContent(`medicineName_${index}`) || medicine.name || '';
          break;
      }
      
      console.log(`✅ Saved medicine ${index}:`, medicine);
    });

    // Get additional notes
    const notesElement = document.getElementById('additionalNotes') as HTMLTextAreaElement;
    if (notesElement) {
      this.prescriptionData.additionalNotes = notesElement.value;
    }

    console.log('💾 Final prescription data:', this.prescriptionData);
  }

  // Helper method to get select values
  private getSelectValue(name: string): string {
    const selectElement = document.querySelector(`[name="${name}"]`) as HTMLSelectElement;
    return selectElement?.value || '';
  }

  // Keep existing method for getting editable field content
  private getEditableFieldContent(id: string): string {
    const element = document.getElementById(id);
    return element?.textContent?.trim() || element?.innerText?.trim() || '';
  }

resetPrescriptionData(): void {
  // Reset manual edit tracking
  this.hasManualPrescriptionEdit = false;
  this.manualPatientName = '';
  this.manualPatientAge = '';
  
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

  // Updated generateMedicineDetails method to handle kasayam_combination
  private generateMedicineDetails(medicine: Medicine, index: number): string {
    let details = '';
    
    switch(medicine.type) {
      case 'kasayam':
        const kasayamName = medicine.name || '';
        const kasayamInstructions = medicine.instructions || '';
        const kasayamQuantity = medicine.quantity || '';
        const kasayamPowder = medicine.powder || '';
        const kasayamPills = medicine.pills || '';
        const kasayamTiming = medicine.timing === 'before' ? 'ഭക്ഷണത്തിനുമുൻപ്' : 'ശേഷംസേവിക്കുക';
        
        details += `
          <p><strong>${kasayamName}</strong></p>
          <p>${kasayamName}കഷായം ${kasayamInstructions}ml എടുത്ത് ${kasayamQuantity}ml തിളപ്പിച്ചാറ്റിയവെള്ളം ചേർത്ത് ${kasayamPowder}. 
          ഗുളിക . പൊടിച്ച്ചേർത്ത് ${kasayamPills} നേരം ${kasayamTiming}.</p>
        `;
        break;
      
      case 'kasayam_combination':
        const combName = medicine.name || '';
        const combQuantity = medicine.quantity || '';
        const combQuantity2 = medicine.combinationQuantity || '';
        const combMedicineName = medicine.combinationName || '';
        const combFrequency = medicine.frequency || '';
        const combTiming = medicine.timing === 'before' ? 'ഭക്ഷണത്തിനുമുൻപ്' : 'ശേഷംസേവിക്കുക';
        
        details += `
          <p><strong>${combName}</strong></p>
          <p>${combName}കഷായം ${combQuantity}ml എടുത്ത് ${combQuantity2}ml തിളപ്പിച്ചാറ്റിയവെള്ളം ചേർത്ത് ${combMedicineName}ഗുളിക പൊടിച്ച്ചേർത്ത് ${combFrequency}നേരം ${combTiming}.</p>
        `;
        break;
        
      // Add other medicine types as needed
      default:
        const defaultTime = medicine.time || 'രാവിലെ / ഉച്ചയ്ക്ക് / രാത്രി';
        const defaultTiming = medicine.timing === 'before' ? 'ഭക്ഷണത്തിനുമുൻപ്' : 'ശേഷം സേവിക്കുക';
        details += `
          <p><strong>${medicine.name || ''}</strong></p>
          <p>Type: ${medicine.type || '______'}</p>
          ${medicine.dosage ? `<p>Dosage: ${medicine.dosage}</p>` : ''}
          ${medicine.instructions ? `<p>Instructions: ${medicine.instructions}</p>` : ''}
          <p>നേരം: ${defaultTime} ${defaultTiming}.</p>
        `;
    }
    
    return details;
  }

onTaxChange(selectedRate: string): void {
  const rate = parseFloat(selectedRate) || 0;
  console.log('🔄 Tax rate changed to:', rate);
  
  this.saleForm.patchValue({ orderTax: rate });
  
  // Recalculate shipping tax with new rate
  this.calculateShippingTax();
  
  // UPDATED: Force recalculation regardless of preservation mode
  this.recalculateAllTotals();
  
  console.log('💰 Total payable after tax change:', this.saleForm.get('totalPayable')?.value);
}

onAfterTaxShippingChange(afterTaxValue: string | number | null): void {
  if (afterTaxValue === null || afterTaxValue === '') return;
  
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
    
    // Calculate and update shipping tax
    const shippingTax = beforeTax * (taxRate / 100);
    this.shippingTaxAmount = parseFloat(shippingTax.toFixed(2));
    this.saleForm.patchValue({
      shippingTaxAmount: this.shippingTaxAmount
    }, { emitEvent: false });
  } else {
    this.saleForm.patchValue({
      shippingCharges: numericValue,
      shippingTaxAmount: 0
    }, { emitEvent: false });
    this.shippingTaxAmount = 0;
  }
  
  this.recalculateAllTotals();
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
// In src/app/edit-sale/edit-sale.component.ts

// In src/app/edit-sale/edit-sale.component.ts
// In src/app/edit-sale/edit-sale.component.ts

// In src/app/edit-sale/edit-sale.component.ts

// In src/app/edit-sale/edit-sale.component.ts

// In src/app/edit-sale/edit-sale.component.ts


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