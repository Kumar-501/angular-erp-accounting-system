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
import { getDocs, limit, query, where } from '@angular/fire/firestore';

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
  foodTiming?: string;
}

interface PrescriptionData {
  patientName: string;
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
  
  isSubmitting = false;
  allProductsSelected: boolean = false;
  lastInteractionTime = 0;
  showProductsInterestedDropdown = false;
  productInterestedSearch = '';
  filteredProductsForInterested: any[] = [];
  prescriptions: PrescriptionData[] = [];

// Set a flag to track initial load
isInitialLoad = true;
  editingPrescriptionIndex: number | null = null;
  currentPrescriptionModal: any;
  currentViewModal: any;
  viewPrescriptionContent: string = '';
  discount: number | undefined;
  discountType: 'Amount' | 'Percentage' | undefined; 
  selectedProductsForInterested: any[] = [];
  selectedPaymentAccount: any = null;
  isFromLead: boolean = false;
  taxAmount: number = 0;
  availableTaxRates: TaxRate[] = [];
  shippingDocuments: File[] = [];
  afterTaxShippingControl: FormControl<number | null> = new FormControl<number | null>(null);
  productsCollection: any;
  showTransactionIdField = false;
  selected?: boolean;
  leadIdToDelete: string | null = null;
  dropdownFilterFocused = false;
  availableTaxGroups: (TaxGroup & { calculatedRate: number })[] = [];
  allProducts: any[] = [];
  filteredProducts: any[] = [];
  customers: any[] = [];
  currentDate = new Date();
  Date = Date; 
  showCustomerEditPopup = false;

  // Food timing options
  foodTimingOptions = [
    { value: 'before_food', label: 'ഭക്ഷണത്തിനുമുൻപ്' },
    { value: 'after_food', label: 'ഭക്ഷണത്തിന് ശേഷം' },
    { value: 'before_after_food', label: 'ഭക്ഷണത്തിനുമുൻപ് / ശേഷം' },
    { value: 'empty_stomach', label: 'വെറും വയറ്റിൽ' },
    { value: 'with_food', label: 'ഭക്ഷണത്തോടൊപ്പം' },
    { value: 'morning_empty', label: 'രാവിലെ വെറും വയറ്റിൽ' },
    { value: 'night_before_sleep', label: 'രാത്രി ഉറങ്ങുന്നതിനു മുൻപ്' }
  ];

  prescriptionData: PrescriptionData = {
    medicines: [],
    patientName: '',
    date: '',
    patientAge: '',
    additionalNotes: ''
  };

  selectedCustomerForEdit: any = null;
  users: any[] = [];
  dropdownClosing = false;
  totalCommission: number = 0;
  businessLocations: any[] = [];
  showCodPopup = false;
  codData: any = null;
  serviceTypes: Service[] = [];
  latestInvoiceNumber: number = 0;
  productSearchTerm: string = '';
  isFromQuotation: boolean = false;
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

  // Filter options
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

  // Edit mode specific properties
  saleId: string = '';
  isEditing: boolean = true;
  originalTotalPayable: number = 0;
  originalBalance: number = 0;
  originalPaymentAmount: number = 0;
  preserveOriginalTotals: boolean = false; // Changed to false for recalculation

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

  private showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
    const toastOptions = {
      timeOut: 5000,
      progressBar: true,
      closeButton: true,
      positionClass: 'toast-top-center'
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

  async getProductByName(productName: string): Promise<Product | null> {
    try {
      const q = query(
        this.productsCollection, 
        where("productName", "==", productName),
        limit(1)
      );
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const productData = querySnapshot.docs[0].data() as Product;
        return {
          id: querySnapshot.docs[0].id,
          ...productData,
          lastNumber: productData.lastNumber || ''
        };
      }
      return null;
    } catch (error) {
      console.error('Error getting product by Name:', error);
      throw error;
    }
  }

  debugCustomerPhones() {
    console.group('Customer Phone Data');
    this.customers.forEach(customer => {
      console.log({
        name: customer.displayName,
        id: customer.id,
        mobile: customer.mobile,
        phone: customer.phone,
        altContact: customer.alternateContact
      });
    });
    console.groupEnd();
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

  getTaxBreakdown(type: 'cgst' | 'sgst' | 'igst'): number {
    if (!this.products) return 0;
    
    return this.products.reduce((sum, product) => {
      switch(type) {
        case 'cgst': return sum + (product.cgstAmount || 0);
        case 'sgst': return sum + (product.sgstAmount || 0);
        case 'igst': return sum + (product.igstAmount || 0);
        default: return sum;
      }
    }, 0);
  }

  getTaxRate(type: 'cgst' | 'sgst' | 'igst'): number {
    switch(type) {
      case 'cgst': return 9;
      case 'sgst': return 9;
      case 'igst': return 18;
      default: return 0;
    }
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

  addMedicineByType(): void {
    if (!this.selectedMedicineType) return;

    const newMedicine: Medicine = {
      name: '',
      type: this.selectedMedicineType,
      time: 'രാവിലെ / ഉച്ചയ്ക്ക് / രാത്രി',
      foodTiming: 'before_after_food'
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

  getFoodTimingLabel(value: string): string {
    const option = this.foodTimingOptions.find(opt => opt.value === value);
    return option ? option.label : 'ഭക്ഷണത്തിനുമുൻപ് / ശേഷം';
  }

  onFoodTimingChange(medicineIndex: number, event: any): void {
    const selectedValue = event.target.value;
    if (this.prescriptionData.medicines[medicineIndex]) {
      this.prescriptionData.medicines[medicineIndex].foodTiming = selectedValue;
    }
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
      foodTiming: 'before_after_food'
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

  getCurrentUser(): string {
    const currentUser = this.authService.currentUserValue;
    return currentUser?.displayName || currentUser?.email || 'Current User';
  }

ngOnInit(): void {
  console.log('Initializing EditSaleComponent - products array:', this.products); // Should be empty initially
  
  this.initializeForm();
  this.setupValueChanges();
  this.loadTaxRates();
  this.loadPaymentAccounts();
  this.prefillCurrentUser();
  this.todayDate = this.datePipe.transform(this.currentDate, 'yyyy-MM-dd') || '';

  console.log('After initialization - products array:', this.products); // Should still be empty
this.route.params.subscribe(params => {
    this.saleId = params['id'];
    if (this.saleId) {
      this.loadSaleData(this.saleId);
    }
  });

  this.saleForm.get('totalPayable')?.valueChanges.subscribe(() => {
    this.calculateRoundOff();
  });
  
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
    console.log('All data loaded - products array:', this.products); // Should still be empty
    this.route.params.subscribe(params => {
      this.saleId = params['id'];
      if (this.saleId) {
        console.log('Loading sale data for ID:', this.saleId);
        this.loadSaleData(this.saleId);
      }
    });
  });
}

loadSaleData(saleId: string): void {
    console.log('Loading sale data - products array before:', this.products); // Should be empty

  this.saleService.getSaleById(saleId).subscribe({
    next: (sale) => {
      console.log('Loading sale data for editing:', sale);
      
      // Store original values
      this.originalTotalPayable = sale.totalPayable || 0;
      this.originalBalance = sale.balance || 0;
      this.originalPaymentAmount = sale.paymentAmount || 0;
      
      // Format date fields properly
      const formatDate = (dateValue: any) => {
        if (!dateValue) return this.todayDate;
        
        let date: Date;
        if (dateValue.toDate && typeof dateValue.toDate === 'function') {
          date = dateValue.toDate();
        } else if (dateValue instanceof Date) {
          date = dateValue;
        } else {
          date = new Date(dateValue);
        }
        
        return this.datePipe.transform(date, 'yyyy-MM-dd') || this.todayDate;
      };

      // Populate form with sale data including all fields
      this.saleForm.patchValue({
        customer: sale.customerId || sale.customer || '',
        customerName: sale.customerName || '',
        customerPhone: sale.customerPhone || '',
        customerEmail: sale.customerEmail || '',
        alternateContact: sale.alternateContact || '',
        customerAge: sale.customerAge || null,
        customerDob: sale.customerDob ? formatDate(sale.customerDob) : null,
        customerGender: sale.customerGender || '',
        customerOccupation: sale.customerOccupation || '',
        creditLimit: sale.creditLimit || 0,
        otherData: sale.otherData || '',
        billingAddress: sale.billingAddress || '',
        shippingAddress: sale.shippingAddress || '',
        saleDate: formatDate(sale.saleDate),
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
        shippingChargesAfterTax: sale.shippingChargesAfterTax || 0,
        shippingStatus: sale.shippingStatus || '',
        deliveryPerson: sale.deliveryPerson || '',
        shippingDetails: sale.shippingDetails || '',
        status: sale.status || 'Pending',
        paymentStatus: sale.paymentStatus || 'Due',
        paymentMethod: sale.paymentMethod || '',
        paymentAccount: sale.paymentAccountId || sale.paymentAccount || '',
        totalPayable: sale.totalPayable || 0,
        paymentAmount: sale.paymentAmount || 0,
        balance: sale.balance || 0,
        paidOn: formatDate(sale.paidOn),
        paymentNote: sale.paymentNote || '',
        changeReturn: sale.changeReturn || 0,
        roundOff: sale.roundOff || 0,
        addedBy: sale.addedBy || '',
        productTaxAmount: sale.productTaxAmount || 0,
        shippingTaxAmount: sale.shippingTaxAmount || 0,
        codTaxAmount: sale.codTaxAmount || 0,
        ppTaxAmount: sale.ppTaxAmount || 0
      });

      // Initialize products array only if sale has products
      this.products = sale.products && sale.products.length > 0 
        ? sale.products.map((product: any) => ({
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
            commissionAmount: product.commissionAmount || 0,
            currentStock: product.currentStock || 0,
            defaultSellingPriceExcTax: product.defaultSellingPriceExcTax || 0,
            defaultSellingPriceIncTax: product.defaultSellingPriceIncTax || 0
          }))
        : []; // Initialize as empty array if no products

      // Load prescriptions if available
      if (sale.prescriptions && sale.prescriptions.length > 0) {
        this.prescriptions = sale.prescriptions.map((prescription: any) => ({
          patientName: prescription.patientName || '',
          patientAge: prescription.patientAge || '',
          date: formatDate(prescription.date),
          medicines: prescription.medicines || [],
          additionalNotes: prescription.additionalNotes || ''
        }));
      }

      // Load service data
      if (sale.ppServiceData) {
        this.ppServiceData = sale.ppServiceData;
      }
      if (sale.codData) {
        this.codData = sale.codData;
      }

      // Set customer search input
      if (sale.customerName) {
        this.customerSearchInput = sale.customerName;
      }

      // Set interested products if any
if (Array.isArray(sale.interestedProductIds) && sale.interestedProductIds.length > 0) {
  const interestedIds: string[] = sale.interestedProductIds;
  this.selectedProductsForInterested = this.allProducts.filter(product => 
    product.id && interestedIds.includes(product.id)
  );
}

      // Calculate shipping after tax
      this.calculateAfterTaxShipping();
      
      // Calculate totals
      this.calculateItemsTotal();
      this.calculateTotalPayable();

      console.log('Sale data loaded successfully');
    },
    error: (error) => {
      console.error('Error loading sale data:', error);
      this.showToast('Error loading sale data. Please try again.', 'error');
    }
  });
}

  private async prefillCurrentUser(): Promise<void> {
    try {
      const currentUser = this.authService.currentUserValue;
      if (currentUser) {
        this.currentUser = currentUser.displayName || currentUser.email;
        
        this.users = await this.loadUsers();
        const loggedInUser = this.users.find(u => u.id === currentUser.uid);
        
        if (loggedInUser) {
          this.saleForm.patchValue({
            addedBy: loggedInUser.id
          });
          
          const commissionPercent = await this.getAgentCommission(loggedInUser.id);
          this.defaultProduct.commissionPercent = commissionPercent;
          this.updateDefaultProduct();
        }
      }
    } catch (error) {
      console.error('Error prefilling current user:', error);
    }
  }

  filterProductsForInterested(): void {
    let filtered = [...this.allProducts];
    
    if (this.productInterestedSearch) {
      const searchTerm = this.productInterestedSearch.toLowerCase();
      filtered = filtered.filter(product => 
        (product.productName?.toLowerCase().includes(searchTerm) ||
         product.sku?.toLowerCase().includes(searchTerm))
      );
    }
    
    if (this.filterOptions.inStockOnly) {
      filtered = filtered.filter(product => product.currentStock > 0);
    }
    
    filtered = filtered.filter(product => 
      product.defaultSellingPriceExcTax >= this.filterOptions.priceRange.min &&
      product.defaultSellingPriceExcTax <= this.filterOptions.priceRange.max
    );
    
    filtered.forEach(p => p.selected = p.selected || false);
    
    this.filteredProductsForInterested = filtered.slice(0, 50);
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

  calculateTaxes(): void {
    this.products.forEach(product => {
      this.calculateProductTax(product);
    });
    
    if (this.defaultProduct.name || this.defaultProduct.quantity > 0 || this.defaultProduct.unitPrice > 0) {
      this.calculateProductTax(this.defaultProduct);
    }

    const shippingBeforeTax = this.saleForm.get('shippingCharges')?.value || 0;
    const shippingTaxRate = this.saleForm.get('orderTax')?.value || 0;
    const shippingTax = shippingBeforeTax * (shippingTaxRate / 100);
    
    this.saleForm.patchValue({
      shippingTaxAmount: shippingTax
    });

    const productTax = this.products.reduce((sum, p) => sum + (p.taxAmount || 0), 0);
    const defaultProductTax = (this.defaultProduct.name || this.defaultProduct.quantity > 0 || this.defaultProduct.unitPrice > 0) 
      ? (this.defaultProduct.taxAmount || 0) 
      : 0;
    
    this.taxAmount = productTax + defaultProductTax + shippingTax;
    
    this.calculateTotalPayable();
  }

  private calculateProductTax(product: Product): void {
    const taxRate = product.taxRate || 0;
    const taxableAmount = product.priceBeforeTax * product.quantity;
    
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

  calculateTotalPayable(): void {
    const discount = this.saleForm.get('discountAmount')?.value || 0;
    const shippingBeforeTax = this.saleForm.get('shippingCharges')?.value || 0;
    const taxRate = this.saleForm.get('orderTax')?.value || 0;
    const shippingTax = shippingBeforeTax * (taxRate / 100);

    const packingCharge = this.ppServiceData?.packingCharge || this.codData?.packingCharge || 0;

    let productsTotal = this.itemsTotal;
    
    if (this.saleForm.get('discountType')?.value === 'Percentage') {
      productsTotal -= (this.itemsTotal * discount / 100);
    } else {
      productsTotal -= discount;
    }

    const shippingWithTax = this.calculateShippingWithTax();
    let totalBeforePacking = productsTotal + shippingWithTax;
    let totalPayable = totalBeforePacking + packingCharge;
    
    this.saleForm.patchValue({ 
      totalPayable: parseFloat(totalPayable.toFixed(2)),
      itemsTotal: parseFloat(productsTotal.toFixed(2)),
      shippingTotal: parseFloat(shippingWithTax.toFixed(2)),
      packingCharge: parseFloat(packingCharge.toFixed(2))
    });
    
    this.calculateRoundOff();
    this.calculateBalance();
  }

  onTaxChange(selectedRate: string): void {
    this.saleForm.patchValue({ orderTax: parseFloat(selectedRate) || 0 });
    this.calculateTotalPayable();
    this.calculateTaxes();
  }

  searchCustomerByPhone(): void {
    const inputPhone = this.saleForm.get('customerPhone')?.value?.trim();
    console.log('Searching for phone:', inputPhone);

    if (!inputPhone || inputPhone.length < 5) {
      this.clearNonPhoneFields();
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
      console.log('Customer found:', foundCustomer);
      
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
    } else {
      console.log('No customer found with phone:', inputPhone);
      this.clearNonPhoneFields();
    }
  }

  clearNonPhoneFields() {
    const currentPhone = this.saleForm.get('customerPhone')?.value;
    this.saleForm.patchValue({
      customer: '',
      customerName: '',
      customerEmail: '',
      billingAddress: '',
      shippingAddress: '',
      alternateContact: '',
      customerAge: null,
      customerDob: null,
      customerGender: '',
      customerPhone: currentPhone
    });
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

  private loadUsers(): Promise<any[]> {
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

  loadBusinessLocations(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.locationService.getLocations().subscribe({
        next: (locations: any[]) => {
          this.businessLocations = locations;
          if (locations.length > 0) {
            this.saleForm.patchValue({ businessLocation: locations[0].id });
          }
          resolve();
        },
        error: (error: any) => {
          console.error('Error loading business locations:', error);
          reject(error);
        }
      });
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

  findCustomerByPhone(phone: string): any {
    let customer = this.customers.find(c => 
      c.mobile === phone || 
      c.phone === phone ||
      c.alternateContact === phone ||
      c.landline === phone
    );
    if (customer) return customer;

    const cleanPhone = phone.replace(/\D/g, '');
    customer = this.customers.find(c => {
      const custMobile = c.mobile?.replace(/\D/g, '') || '';
      const custPhone = c.phone?.replace(/\D/g, '') || '';
      const custAlt = c.alternateContact?.replace(/\D/g, '') || '';
      const custLandline = c.landline?.replace(/\D/g, '') || '';
      return custMobile === cleanPhone || 
             custPhone === cleanPhone || 
             custAlt === cleanPhone ||
             custLandline === cleanPhone;
    });
    
    return customer;
  }

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
        if (this.filterOptions.inStockOnly && 
            (product.currentStock <= 0 && product.totalQuantity <= 0)) {
          return false;
        }
        if (product.defaultSellingPriceExcTax < this.filterOptions.priceRange.min || 
            product.defaultSellingPriceExcTax > this.filterOptions.priceRange.max) {
          return false;
        }
        
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
        defaultSellingPriceExcTax: product.defaultSellingPriceExcTax || 0,
        selected: product.selected || false
      }));
    
    this.showSearchResults = this.searchResults.length > 0;
  }

  onSearchFocus() {
    this.showSearchResults = true;
    if (this.searchTerm) {
      this.searchProducts({ target: { value: this.searchTerm } });
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

  onAddressChange(type: 'billing' | 'shipping') {
    const billingValue = this.saleForm.get('billingAddress')?.value;
    const shippingValue = this.saleForm.get('shippingAddress')?.value;
    
    if (type === 'billing') {
      this.saleForm.patchValue({ billingAddress: billingValue });
    } else {
      this.saleForm.patchValue({ shippingAddress: shippingValue });
    }
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
        taxRate: product.taxRate || (product.applicableTax?.percentage || 0),
        quantity: 1,
        discount: 0,
        commissionPercent: this.defaultProduct.commissionPercent || 0,
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

  onProductSelect(productName: string): void {
    if (!productName) {
      this.resetDefaultProduct();
      return;
    }

    const selectedProduct = this.allProducts.find(p => p.productName === productName);
    if (selectedProduct) {
      this.populateDefaultProduct(selectedProduct);
    }
  }

  private resetDefaultProduct(): void {
    this.defaultProduct = {
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
    this.updateDefaultProduct();
  }

  private populateDefaultProduct(selectedProduct: any): void {
    this.defaultProduct.name = selectedProduct.productName;
    this.defaultProduct.priceBeforeTax = selectedProduct.defaultSellingPriceExcTax || 0;
    
    const taxRate = selectedProduct.taxRate !== undefined
      ? selectedProduct.taxRate
      : (selectedProduct.applicableTax ? selectedProduct.applicableTax.percentage : 0);
    
    this.defaultProduct.taxRate = taxRate;
    this.defaultProduct.unitPrice = selectedProduct.defaultSellingPriceIncTax ||
      (this.defaultProduct.priceBeforeTax * (1 + (taxRate / 100)));
    this.defaultProduct.quantity = 1;
    
    this.defaultProduct.batchNumber = selectedProduct.batchNumber || '';
    this.defaultProduct.lastNumber = selectedProduct.lastNumber || '';
    this.defaultProduct.lastNumbers = selectedProduct.lastNumbers || [];
    
    this.updateDefaultProduct();
  }

  clearSearch() {
    this.searchTerm = '';
    this.searchResults = [];
    this.showSearchResults = false;
  }

  selectMedicineType(type: string): void {
    this.selectedMedicineType = type;
  }

  openPrescriptionModal(event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (this.editingPrescriptionIndex === null) {
      this.resetPrescriptionData();
      this.prescriptionData.patientName = this.saleForm.get('customerName')?.value || '';
      this.prescriptionData.date = this.todayDate;
    }

    const modalElement = document.getElementById('prescriptionModal');
    if (modalElement) {
      this.currentPrescriptionModal = new bootstrap.Modal(modalElement, {
        keyboard: false,
        backdrop: 'static'
      });
      this.currentPrescriptionModal.show();

      setTimeout(() => {
        this.forceLTRDirection();
      }, 150);
    }
  }

  private forceLTRDirection(): void {
    const editableFields = document.querySelectorAll('.prescription-template [contenteditable="true"], .prescription-template input, .prescription-template textarea, .prescription-template select');
    
    editableFields.forEach((field: Element) => {
      const htmlElement = field as HTMLElement;
      if (htmlElement) {
        htmlElement.style.direction = 'ltr';
        htmlElement.style.textAlign = 'left';
        htmlElement.style.unicodeBidi = 'embed';
        htmlElement.style.writingMode = 'horizontal-tb';
        
        htmlElement.addEventListener('input', this.maintainLTROnInput.bind(this));
        htmlElement.addEventListener('focus', this.maintainLTROnFocus.bind(this));
        htmlElement.addEventListener('keydown', this.maintainLTROnKeydown.bind(this));
        htmlElement.addEventListener('paste', this.maintainLTROnPaste.bind(this));
      }
    });
    
    const modalContent = document.querySelector('.prescription-template') as HTMLElement;
    if (modalContent) {
      modalContent.style.direction = 'ltr';
      modalContent.style.textAlign = 'left';
    }
  }

  private maintainLTROnPaste(event: any): void {
    const element = event.target;
    if (element) {
      setTimeout(() => {
        element.style.direction = 'ltr';
        element.style.textAlign = 'left';
        element.style.unicodeBidi = 'embed';
      }, 10);
    }
  }

  private maintainLTROnInput(event: any): void {
    const element = event.target;
    if (element) {
      element.style.direction = 'ltr';
      element.style.textAlign = 'left';
      element.style.unicodeBidi = 'embed';
    }
  }

  private maintainLTROnFocus(event: any): void {
    const element = event.target;
    if (element) {
      element.style.direction = 'ltr';
      element.style.textAlign = 'left';
      element.style.unicodeBidi = 'embed';
    }
  }

  private maintainLTROnKeydown(event: any): void {
    const element = event.target;
    if (element) {
      setTimeout(() => {
        element.style.direction = 'ltr';
        element.style.textAlign = 'left';
        element.style.unicodeBidi = 'embed';
      }, 1);
    }
  }

  preventEnterSubmission(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  updatePrescriptionField(field: string, event: any): void {
    const value = event.target.textContent || event.target.innerText || '';
    
    this.maintainLTROnInput(event);
    
    switch(field) {
      case 'patientName':
        this.prescriptionData.patientName = value;
        break;
      case 'patientAge':
        this.prescriptionData.patientAge = value;
        break;
      case 'date':
        this.prescriptionData.date = value;
        break;
    }
  }

  updateMedicineField(index: number, field: string, event: any): void {
    const value = event.target.textContent || event.target.innerText || '';
    
    this.maintainLTROnInput(event);
    
    if (this.prescriptionData.medicines[index]) {
      this.prescriptionData.medicines[index][field] = value;
    }
  }

  closePrescriptionModal(): void {
    if (this.currentPrescriptionModal) {
      this.currentPrescriptionModal.hide();
    }
    this.editingPrescriptionIndex = null;
    this.resetPrescriptionData();
  }

  savePrescription(): void {
    this.savePrescriptionData();
    
    if (this.editingPrescriptionIndex !== null) {
      this.prescriptions[this.editingPrescriptionIndex] = {...this.prescriptionData};
    } else {
      this.prescriptions.push({...this.prescriptionData});
    }
    
    this.closePrescriptionModal();
    this.showToast('Prescription saved successfully!', 'success');
  }

  viewPrescription(prescription: PrescriptionData): void {
    this.viewPrescriptionContent = this.generateViewContent(prescription);
    
    const modalElement = document.getElementById('prescriptionViewModal');
    if (modalElement) {
      if (this.currentViewModal) {
        this.currentViewModal.dispose();
      }
      
      this.currentViewModal = new bootstrap.Modal(modalElement);
      this.currentViewModal.show();
    }
  }

  private generateViewContent(prescription: PrescriptionData): string {
    const formattedDate = this.datePipe.transform(prescription.date || this.todayDate, 'MMMM d, yyyy') || this.todayDate;
    
    let medicinesHtml = '';
    prescription.medicines.forEach((medicine, index) => {
      medicinesHtml += `
        <div class="medicine-item mb-3 p-3 border rounded">
          <h6>${index + 1}. ${this.getMedicineTypeName(medicine.type)}</h6>
          ${this.generateMedicineViewDetails(medicine)}
        </div>
      `;
    });

    return `
      <div class="prescription-view">
        <div class="text-center mb-4">
          <h4>ഹെർബലി ടച്ച് ആയുര്‍വേദ ഉല്‍പ്പന്നങ്ങള്‍ പ്രൈവറ്റ് ലിമിറ്റഡ്</h4>
          <p>First Floor, Chirackal Tower, Ayroor P.O., Ernakulam Dt., Kerala - 683 579</p>
          <p>E-mail: contact@herballytouch.com | Ph: 7034110999</p>
          <p>ഡോ. രാജന പി.ആർ., BAMS</p>
        </div>
        
        <div class="patient-info mb-4">
          <div class="row">
            <div class="col-md-4"><strong>പേര്:</strong> ${prescription.patientName || 'Unknown Patient'}</div>
            <div class="col-md-4"><strong>Age:</strong> ${prescription.patientAge || '___'}</div>
            <div class="col-md-4"><strong>തീയതി:</strong> ${formattedDate}</div>
          </div>
        </div>
        
        <div class="medicines">
          ${medicinesHtml}
        </div>
        
        ${prescription.additionalNotes ? `
          <div class="additional-notes mt-4 p-3 bg-light rounded">
            <h6>Additional Notes:</h6>
            <p>${prescription.additionalNotes}</p>
          </div>
        ` : ''}
      </div>
    `;
  }

  private generateMedicineViewDetails(medicine: Medicine): string {
    let details = '';
    
    details += `<p><strong>${medicine.name || '___'}</strong></p>`;
    
    const foodTimingLabel = this.getFoodTimingLabel(medicine.foodTiming || 'before_after_food');
    
    switch(medicine.type) {
      case 'kasayam':
        details += `
          <p>കഷായം ${medicine.instructions || '___'}ml എടുത്ത് ${medicine.quantity || '___'}ml തിളപ്പിച്ചാറ്റിയവെള്ളം ചേർത്ത് ${medicine.powder || '___'} ഗുളിക പൊടിച്ച് ചേർത്ത് ${medicine.pills || '___'} നേരം ${foodTimingLabel} സേവിക്കുക.</p>
        `;
        break;
      case 'buligha':
        details += `
          <p>ഗുളിക ${medicine.instructions || '___'} എണ്ണം എടുത്ത് ${medicine.powder || '___'} നേരം ${foodTimingLabel} സേവിക്കുക.</p>
        `;
        break;
      default:
        if (medicine.dosage) details += `<p>Dosage: ${medicine.dosage}</p>`;
        if (medicine.instructions) details += `<p>Instructions: ${medicine.instructions}</p>`;
        details += `<p>${foodTimingLabel} സേവിക്കുക.</p>`;
    }
    
    return details;
  }

  closeViewModal(): void {
    if (this.currentViewModal) {
      this.currentViewModal.hide();
    }
  }

  printViewedPrescription(): void {
    const printContent = this.generatePrintContent(this.prescriptions.find(p => this.viewPrescriptionContent.includes(p.patientName || '')) || this.prescriptions[0]);
    
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

  editPrescription(index: number): void {
    this.editingPrescriptionIndex = index;
    
    this.prescriptionData = JSON.parse(JSON.stringify(this.prescriptions[index]));
    
    this.prescriptionData.patientName = this.prescriptionData.patientName || 
                                       this.saleForm.get('customerName')?.value || '';
    this.prescriptionData.date = this.prescriptionData.date || this.todayDate;
    
    this.openPrescriptionModal();
    
    setTimeout(() => {
      this.updateFormFieldsFromPrescription();
      this.forceLTRDirection();
    }, 200);
  }

  private setEditableField(id: string, value: string | undefined): void {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value || '';
      element.style.direction = 'ltr';
      element.style.textAlign = 'left';
      element.style.unicodeBidi = 'embed';
    }
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
        case 'buligha':
          this.setEditableField(`bulighaName_${index}`, medicine.name);
          this.setEditableField(`bulighaInstructions_${index}`, medicine.instructions);
          this.setEditableField(`bulighaPowder_${index}`, medicine.powder);
          break;
        case 'bhasmam':
          this.setEditableField(`bhasmamName_${index}`, medicine.name);
          this.setEditableField(`bhasmamDosage_${index}`, medicine.dosage);
          this.setEditableField(`bhasmamQuantity_${index}`, medicine.quantity);
          this.setEditableField(`bhasmamInstructions_${index}`, medicine.instructions);
          this.setEditableField(`bhasmamPowder_${index}`, medicine.powder);
          break;
        case 'krudham':
          this.setEditableField(`krudhamName_${index}`, medicine.name);
          this.setEditableField(`krudhamInstructions_${index}`, medicine.instructions);
          break;
        case 'suranam':
          this.setEditableField(`suranamName_${index}`, medicine.name);
          this.setEditableField(`suranamInstructions_${index}`, medicine.instructions);
          this.setEditableField(`suranamPowder_${index}`, medicine.powder);
          this.setEditableField(`suranamDosage_${index}`, medicine.dosage);
          break;
        case 'rasayanam':
          this.setEditableField(`rasayanamName_${index}`, medicine.name);
          this.setEditableField(`rasayanamInstructions_${index}`, medicine.instructions);
          break;
        case 'lagium':
          this.setEditableField(`lagiumName_${index}`, medicine.name);
          this.setEditableField(`lagiumInstructions_${index}`, medicine.instructions);
          this.setEditableField(`lagiumDosage_${index}`, medicine.dosage);
          break;
      }
      
      this.setEditableField(`${medicine.type}Time_${index}`, medicine.time);
    });

    const notesElement = document.getElementById('additionalNotes') as HTMLTextAreaElement;
    if (notesElement && this.prescriptionData.additionalNotes) {
      notesElement.value = this.prescriptionData.additionalNotes;
    }
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
          .logo-container {
            position: absolute;
            top: 20px;
            left: 20px;
            width: 120px;
            height: auto;
            z-index: 10;
          }
          .logo-container img {
            width: 100%;
            height: auto;
            max-width: 120px;
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
          .medicine-item { 
            margin-bottom: 20px; 
            padding: 15px;
            border: 1px solid #eee;
            border-radius: 5px;
          }
          .highlight { background-color: yellow; }
          .additional-notes {
            margin-top: 30px;
            padding: 15px;
            background: #f5f5f5;
            border-radius: 5px;
          }
          .prescription-header {
            text-align: center;
            margin-bottom: 20px;
            margin-left: 140px;
          }
          .doctor-title {
            font-weight: bold;
            margin-top: 10px;
          }
          .prescription-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }
          .prescription-table td {
            padding: 8px;
            vertical-align: top;
          }
          .medicine-content {
            margin-left: 20px;
          }
          
          @media print {
            .logo-container {
              position: absolute;
              top: 10px;
              left: 10px;
            }
          }
          
          @media (max-width: 600px) {
            .prescription-header {
              margin-left: 0;
              margin-top: 140px;
            }
            .logo-container {
              position: relative;
              width: 100px;
              margin-bottom: 20px;
            }
          }
        </style>
      </head>
      <body>
        <div class="logo-container">
          <img src="/assets/logo2.png">
        </div>
        
        <div class="prescription-header">
          <h2>DR.RAJANA P.R.,BAMS</h2>
          <h3>HERBALLY TOUCH AYURVEDA PRODUCTS PVT.LTD.</h3>
          <p>First Floor, Chirackal Tower, Ayroor P.O., Ernakulam Dt.,Kerala - 683 579</p>
          <p>E–mail: contact@herbalytouch.com | Ph: 7034110999</p>
        </div>
        
        
        <table class="prescription-table">
          <tr>
            <td><strong>Name</strong></td>
            <td>${prescription.patientName || '______'}</td>
            <td><strong>Age</strong></td>
            <td>${prescription.patientAge || '______'}</td>
            <td><strong>Date</strong></td>
            <td>${formattedDate}</td>
          </tr>
        </table>
        
        
        <div class="medicine-content">
          ${medicinesHtml}
        </div>
        
        ${prescription.additionalNotes ? `
          <div class="additional-notes">
            <h4 style="font-size: 16px; margin-bottom: 8px;">Additional Notes:</h4>
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

  private getEditableFieldContent(id: string): string {
    const element = document.getElementById(id);
    return element?.textContent?.trim() || element?.innerText?.trim() || '';
  }

  private generateMedicineDetails(medicine: Medicine, index: number): string {
    let details = '';
    
    const medicineName = this.getEditableFieldContent(`kasayamName_${index}`) || medicine.name || '';
    
    details += `<p><strong>${medicineName}</strong></p>`;
    
    const foodTimingLabel = this.getFoodTimingLabel(medicine.foodTiming || 'before_after_food');
    
    switch(medicine.type) {
      case 'kasayam':
        const kasayamInstructions = this.getEditableFieldContent(`kasayamInstructions_${index}`) || medicine.instructions || '';
        const kasayamQuantity = this.getEditableFieldContent(`kasayamQuantity_${index}`) || medicine.quantity || '';
        const kasayamPowder = this.getEditableFieldContent(`kasayamPowder_${index}`) || medicine.powder || '';
        const kasayamPills = this.getEditableFieldContent(`kasayamPills_${index}`) || medicine.pills || '';
        
        
        details += `
          <p>കഷായം ${kasayamInstructions}ml എടുത്ത് ${kasayamQuantity}ml തിളപ്പിച്ചാറ്റിയവെള്ളം ചേർത്ത് ${kasayamPowder}. </p>
          <p>ഗുളിക ${kasayamPills} പൊടി ചേർത്ത് ${foodTimingLabel} സേവിക്കുക.</p>
        `;
        break;
        
      case 'buligha':
        const bulighaInstructions = this.getEditableFieldContent(`bulighaInstructions_${index}`) || medicine.instructions || '';
        
        details += `
          <p>ഗുളിക ${bulighaInstructions} എണ്ണം എടുത്ത്</p>
          <p>${foodTimingLabel} സേവിക്കുക.</p>
        `;
        break;
        
      case 'bhasmam':
        const bhasmamDosage = this.getEditableFieldContent(`bhasmamDosage_${index}`) || medicine.dosage || '';
        const bhasmamQuantity = this.getEditableFieldContent(`bhasmamQuantity_${index}`) || medicine.quantity || '';
        
        details += `
          <p>ഭസ്മം ${bhasmamDosage} നുള്ള് എടുത്ത് ${bhasmamQuantity} ml. തേൻ / ചെറുനാരങ്ങാനീർ ചേർത്ത്</p>
          <p>${foodTimingLabel} സേവിക്കുക.</p>
        `;
        break;
        
      case 'krudham':
        details += `
          <p>ഘൃതം ഒരു ടീ - സ്പൂൺ എടുത്ത്</p>
          <p>${foodTimingLabel} സേവിക്കുക.</p>
        `;
        break;
        
      case 'suranam':
        details += `
          <p>ചൂർണ്ണം ഒരു ടീ - സ്പൂൺ എടുത്ത്</p>
          <p>${foodTimingLabel} സേവിക്കുക.</p>
        `;
        break;
        
      case 'rasayanam':
        details += `
          <p>രസായനം ഒരു ടീ - സ്പൂൺ എടുത്ത്</p>
          <p>${foodTimingLabel} സേവിക്കുക.</p>
        `;
        break;
        
      case 'lagium':
        details += `
          <p>ലേഹ്യം ഒരു ടീ - സ്പൂൺ എടുത്ത്</p>
          <p>${foodTimingLabel} സേവിക്കുക.</p>
        `;
        break;
        
      default:
        details += `
          <p>Type: ${medicine.type || '______'}</p>
          ${medicine.dosage ? `<p>Dosage: ${medicine.dosage}</p>` : ''}
          ${medicine.instructions ? `<p>Instructions: ${medicine.instructions}</p>` : ''}
          <p>${foodTimingLabel} സേവിക്കുക.</p>
        `;
    }
    
    return details;
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
          medicine.time = this.getEditableFieldContent(`kasayamTime_${index}`) || medicine.time || 'രാവിലെ / ഉച്ചയ്ക്ക് / രാത്രി';
          break;
          
        case 'buligha':
          medicine.instructions = this.getEditableFieldContent(`bulighaInstructions_${index}`) || medicine.instructions || '';
          medicine.name = this.getEditableFieldContent(`bulighaName_${index}`) || medicine.name || '';
          medicine.powder = this.getEditableFieldContent(`bulighaPowder_${index}`) || medicine.powder || '';
          break;
          
        case 'bhasmam':
          medicine.dosage = this.getEditableFieldContent(`bhasmamDosage_${index}`) || medicine.dosage || '';
          medicine.quantity = this.getEditableFieldContent(`bhasmamQuantity_${index}`) || medicine.quantity || '';
          medicine.time = this.getEditableFieldContent(`bhasmamTime_${index}`) || medicine.time || 'രാവിലെ / ഉച്ചയ്ക്ക് / രാത്രി';
          break;
          
        case 'krudham':
          medicine.time = this.getEditableFieldContent(`krudhamTime_${index}`) || medicine.time || 'രാവിലെ / ഉച്ചയ്ക്ക് / രാത്രി';
          break;
          
        case 'suranam':
          medicine.time = this.getEditableFieldContent(`suranamTime_${index}`) || medicine.time || 'രാവിലെ / ഉച്ചയ്ക്ക് / രാത്രി';
          break;
          
        case 'rasayanam':
          medicine.time = this.getEditableFieldContent(`rasayanamTime_${index}`) || medicine.time || 'രാവിലെ / ഉച്ചയ്ക്ക് / രാത്രി';
          break;
          
        case 'lagium':
          medicine.time = this.getEditableFieldContent(`lagiumTime_${index}`) || medicine.time || 'രാവിലെ / ഉച്ചയ്ക്ക് / രാത്രി';
          break;
      }
    });

    const notesElement = document.getElementById('additionalNotes') as HTMLTextAreaElement;
    if (notesElement) {
      this.prescriptionData.additionalNotes = notesElement.value;
    }
  }

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
      shippingStatus: [''],
      deliveryPerson: [''],
      shippingDocuments: [null],
      totalPayable: [0],
      paymentAmount: [0, [Validators.min(0)]],
      paidOn: [this.todayDate],
      paymentMethod: ['', Validators.required],
      paymentNote: [''],
      changeReturn: [0],
      balance: [0],
      shippingCharges: [0, [Validators.min(0)]],
      shippingChargesAfterTax: [0, [Validators.min(0)]],
      addedBy: ['', Validators.required]
    });
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

  onDynamicProductSelect(productName: string, index: number): void {
    if (!productName) {
      this.resetProductAtIndex(index);
      return;
    }

    const selectedProduct = this.allProducts.find(p => p.productName === productName);
    if (selectedProduct) {
      this.populateProductAtIndex(selectedProduct, index);
    }
  }

  private resetProductAtIndex(index: number): void {
    this.products[index] = {
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
      expiryDate: '',
      taxRate: 0,
      taxAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      taxType: ''
    };
    this.updateProduct(index);
  }

  private populateProductAtIndex(selectedProduct: any, index: number): void {
    this.products[index].name = selectedProduct.productName;
    this.products[index].priceBeforeTax = selectedProduct.defaultSellingPriceExcTax || 0;
    
    const taxRate = selectedProduct.taxRate !== undefined
      ? selectedProduct.taxRate
      : (selectedProduct.applicableTax ? selectedProduct.applicableTax.percentage : 0);
    
    this.products[index].taxRate = taxRate;
    this.products[index].unitPrice = selectedProduct.defaultSellingPriceIncTax ||
      (this.products[index].priceBeforeTax * (1 + (taxRate / 100)));
    this.products[index].quantity = 1;
    this.products[index].batchNumber = selectedProduct.batchNumber || '';
    this.products[index].expiryDate = selectedProduct.expiryDate || '';
    
    this.updateProduct(index);
  }

  setupValueChanges(): void {
    this.saleForm.get('paymentAmount')?.valueChanges.subscribe(() => {
      this.calculateBalance();
    });

    this.saleForm.get('discountAmount')?.valueChanges.subscribe(() => {
      this.calculateTotalPayable();
    });

    this.saleForm.get('orderTax')?.valueChanges.subscribe(() => {
      this.calculateTotalPayable();
    });

    this.saleForm.get('shippingCharges')?.valueChanges.subscribe(() => {
      this.calculateTotalPayable();
    });

    this.saleForm.get('shippingCharges')?.valueChanges.subscribe(value => {
      if (this.saleForm.get('shippingCharges')?.dirty) {
        this.calculateAfterTaxShipping();
      }
    });

    this.saleForm.get('shippingChargesAfterTax')?.valueChanges.subscribe(value => {
      if (this.saleForm.get('shippingChargesAfterTax')?.dirty) {
        this.calculateBeforeTaxShipping();
      }
    });

    this.saleForm.get('discountType')?.valueChanges.subscribe(() => {
      this.calculateTotalPayable();
    });

    this.saleForm.get('addedBy')?.valueChanges.subscribe(userId => {
      this.onUserSelect(userId);
    });
  }

  updateDefaultProduct(): void {
    const product = this.defaultProduct;
    const selectedProduct = this.allProducts.find(p => p.productName === product.name);
    
    if (selectedProduct) {
      if (product.quantity > selectedProduct.currentStock) {
        alert(`Cannot increase quantity. Only ${selectedProduct.currentStock} items available for "${product.name}".`);
        product.quantity = selectedProduct.currentStock;
      }
      
      if (!product.taxRate && selectedProduct.taxRate) {
        product.taxRate = selectedProduct.taxRate;
      }
    }

    this.calculateProductTax(product);

    if (product.priceBeforeTax !== undefined && product.taxRate !== undefined) {
      product.unitPrice = product.priceBeforeTax * (1 + (product.taxRate / 100));
    } else if (product.unitPrice !== undefined && product.taxRate !== undefined) {
      product.priceBeforeTax = product.unitPrice / (1 + (product.taxRate / 100));
    }

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
    
    this.calculateItemsTotal();
    this.calculateTotalPayable();
    this.calculateTaxes();
  }

  calculateAfterTaxShipping(): void {
    const beforeTax = this.saleForm.get('shippingCharges')?.value || 0;
    const taxRate = this.saleForm.get('orderTax')?.value || 0;
    
    const afterTax = beforeTax * (1 + (taxRate / 100));
    
    this.saleForm.patchValue({
      shippingChargesAfterTax: parseFloat(afterTax.toFixed(2))
    }, { emitEvent: false });
    
    this.calculateTotalPayable();
  }

  calculateBeforeTaxShipping(): void {
    const afterTax = this.saleForm.get('shippingChargesAfterTax')?.value || 0;
    const taxRate = this.saleForm.get('orderTax')?.value || 0;
    
    let beforeTax = afterTax;
    if (taxRate > 0) {
      beforeTax = afterTax / (1 + (taxRate / 100));
    }
    
    this.saleForm.patchValue({
      shippingCharges: parseFloat(beforeTax.toFixed(2))
    }, { emitEvent: false });
    
    this.calculateTotalPayable();
  }

  updateProduct(index: number): void {
    const product = this.products[index];
    const selectedProduct = this.allProducts.find(p => p.productName === product.name);

    if (selectedProduct && !product.taxRate && selectedProduct.taxRate) {
      product.taxRate = selectedProduct.taxRate;
    }

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

    this.calculateItemsTotal();
    this.calculateTotalPayable();
    this.calculateTaxes();
  }

addProduct(): void {
  // Only add if the default product has data
  if (this.defaultProduct.name || this.defaultProduct.quantity > 0 || this.defaultProduct.unitPrice > 0) {
    const productToAdd: Product = {
      ...this.defaultProduct,
      taxAmount: this.defaultProduct.taxAmount || 0,
      cgstAmount: this.defaultProduct.cgstAmount || 0,
      sgstAmount: this.defaultProduct.sgstAmount || 0,
      igstAmount: this.defaultProduct.igstAmount || 0,
      taxType: this.defaultProduct.taxType || ''
    };
    this.products.push(productToAdd);
  }

  // Reset the default product
  this.defaultProduct = {
    name: '',
    quantity: 1,
    unitPrice: 0,
    discount: 0,
    discountType: 'Amount',
    commissionPercent: this.defaultProduct.commissionPercent || 0,
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
  };
}

  removeProduct(index: number): void {
    this.products.splice(index, 1);
    this.calculateItemsTotal();
    this.calculateTotalPayable();
  }

  calculateItemsTotal(): void {
    const defaultProductValue = (this.defaultProduct.name || this.defaultProduct.quantity > 0 || this.defaultProduct.unitPrice > 0) 
      ? this.defaultProduct.subtotal 
      : 0;
    
    this.itemsTotal = this.products.reduce((sum, product) => sum + product.subtotal, defaultProductValue);
    this.totalCommission = this.products.reduce((sum, product) => sum + (product.commissionAmount || 0), 
      (this.defaultProduct.name || this.defaultProduct.quantity > 0 || this.defaultProduct.unitPrice > 0) 
        ? (this.defaultProduct.commissionAmount || 0) 
        : 0);
  }

  calculateShippingWithTax(): number {
    const shippingBeforeTax = this.saleForm.get('shippingCharges')?.value || 0;
    const taxRate = this.saleForm.get('orderTax')?.value || 0;
    
    const shippingTax = shippingBeforeTax * (taxRate / 100);
    const shippingWithTax = shippingBeforeTax + shippingTax;
    
    this.saleForm.patchValue({
      shippingTaxAmount: shippingTax
    });
    
    return shippingWithTax;
  }

  calculateBalance(): void {
    const totalPayable = this.saleForm.get('totalPayable')?.value || 0;
    const paymentAmount = this.saleForm.get('paymentAmount')?.value || 0;
    const roundOff = this.saleForm.get('roundOff')?.value || 0;
  
    const roundedTotal = totalPayable + roundOff;

    if (paymentAmount > roundedTotal) {
      this.saleForm.patchValue({
        changeReturn: (paymentAmount - roundedTotal).toFixed(2),
        balance: 0
      });
    } else {
      this.saleForm.patchValue({
        changeReturn: 0,
        balance: (roundedTotal - paymentAmount).toFixed(2)
      });
    }
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.saleForm.patchValue({ document: file.name });
    }
  }

  onCustomerChange(event: any): void {
    const customerId = event.target.value;
    const selectedCustomer = this.customers.find(c => c.id === customerId);
    if (selectedCustomer) {
      this.saleForm.patchValue({
        customerPhone: selectedCustomer.mobile || selectedCustomer.phone || '',
        billingAddress: selectedCustomer.address || '',
        shippingAddress: selectedCustomer.address || ''
      });
      this.customerSearchInput = selectedCustomer.displayName;
    }
  }

  onCustomerBlur(): void {
    setTimeout(() => {
      this.showCustomerDropdown = false;
    }, 200);
  }

  onCustomerSearchFocus(): void {
    this.showCustomerDropdown = true;
    this.filterCustomers();
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

  resetPrescriptionData(): void {
    this.prescriptionData = {
      medicines: [],
      patientName: this.saleForm.get('customerName')?.value || '',
      patientAge: this.saleForm.get('customerAge')?.value?.toString() || '',
      date: this.todayDate,
      additionalNotes: ''
    };
  }

  calculateRoundOff(): void {
    const totalPayable = this.saleForm.get('totalPayable')?.value || 0;
    
    const roundedTotal = Math.round(totalPayable);
    const roundOff = roundedTotal - totalPayable;
    
    this.saleForm.patchValue({
      roundOff: parseFloat(roundOff.toFixed(2)),
      totalPayable: parseFloat(totalPayable.toFixed(2))
    });
    
    this.calculateBalance();
  }

  private cleanObjectForFirestore(obj: any): any {
    if (obj === null || obj === undefined) {
      return null;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.cleanObjectForFirestore(item)).filter(item => item !== undefined);
    }
    
    if (typeof obj === 'object') {
      const cleaned: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const value = this.cleanObjectForFirestore(obj[key]);
          if (value !== undefined) {
            cleaned[key] = value;
          }
        }
      }
      return cleaned;
    }
    
    return obj;
  }

  private createCleanPrescription(): any {
    if (!this.prescriptions || this.prescriptions.length === 0) {
      return null;
    }

    return this.prescriptions.map(prescription => ({
      patientName: prescription.patientName || '',
      patientAge: prescription.patientAge || '',
      date: prescription.date || this.todayDate,
      additionalNotes: prescription.additionalNotes || '',
      medicines: (prescription.medicines || []).map(medicine => ({
        name: medicine.name || '',
        type: medicine.type || '',
        dosage: medicine.dosage || '',
        instructions: medicine.instructions || '',
        time: medicine.time || '',
        quantity: medicine.quantity || '',
        pills: medicine.pills || '',
        powder: medicine.powder || '',
        foodTiming: medicine.foodTiming || 'before_after_food'
      }))
    }));
  }

  private getFieldLabel(fieldName: string): string {
    const fieldLabels: {[key: string]: string} = {
      'customer': 'Customer',
      'customerName': 'Customer Name',
      'invoiceNo': 'Invoice Number',
      'orderNo': 'Order Number',
      'customerPhone': 'Customer Phone',
      'paymentAccount': 'Payment Account',
      'billingAddress': 'Billing Address',
      'shippingAddress': 'Shipping Address',
      'saleDate': 'Sale Date',
      'businessLocation': 'Business Location',
      'paymentMethod': 'Payment Method',
      'addedBy': 'Sales Agent'
    };
    
    return fieldLabels[fieldName] || fieldName;
  }

  async updateSale(): Promise<void> {
    if (this.isSubmitting) {
      return;
    }
    
    this.isSubmitting = true;
    
    try {
      this.markFormGroupTouched(this.saleForm);
      
      if (this.saleForm.invalid) {
        const invalidControls = this.findInvalidControls();
        if (invalidControls.length > 0) {
          const firstInvalid = invalidControls[0];
          this.focusOnField(firstInvalid.name);
          const fieldName = this.getFieldLabel(firstInvalid.name);
          this.showToast(`Please fill in the required field: ${fieldName}`, 'error');
        } else {
          this.showToast('Please fill in all required fields', 'error');
        }
        this.isSubmitting = false;
        return;
      }

      if (this.products.length === 0 &&
          !(this.defaultProduct.name || this.defaultProduct.quantity > 0 || this.defaultProduct.unitPrice > 0)) {
        this.showToast('Please add at least one product', 'error');
        this.isSubmitting = false;
        return;
      }

      // Calculate comprehensive tax amounts
      const productTax = this.products.reduce((sum, product) => sum + (product.taxAmount || 0), 0);
      const defaultProductTax = (this.defaultProduct.name || this.defaultProduct.quantity > 0 || this.defaultProduct.unitPrice > 0) 
        ? (this.defaultProduct.taxAmount || 0) 
        : 0;
      
      const shippingTax = (this.saleForm.get('shippingCharges')?.value || 0) *
        (this.saleForm.get('orderTax')?.value || 0) / 100;
      const totalTax = productTax + defaultProductTax + shippingTax;

      // Calculate tax breakdown
      const cgstTotal = this.products.reduce((sum, p) => sum + (p.cgstAmount || 0), 0) + 
                       (this.defaultProduct.cgstAmount || 0);
      const sgstTotal = this.products.reduce((sum, p) => sum +  (p.sgstAmount || 0), 0) + 
                       (this.defaultProduct.sgstAmount || 0);
      const igstTotal = this.products.reduce((sum, p) => sum + (p.igstAmount || 0), 0) + 
                       (this.defaultProduct.igstAmount || 0);

      const paymentAccountId = this.saleForm.get('paymentAccount')?.value;
      const selectedPaymentAccount = paymentAccountId ? this.paymentAccounts.find(acc => acc.id === paymentAccountId) : null;

      const selectedCustomerId = this.saleForm.get('customer')?.value;
      const selectedCustomer = selectedCustomerId ? this.customers.find(c => c.id === selectedCustomerId) : null;
      const customerName = selectedCustomer?.displayName || 'Walk-in Customer';

      const selectedLocationId = this.saleForm.get('businessLocation')?.value;
      const selectedLocation = selectedLocationId ? this.businessLocations.find(loc => loc.id === selectedLocationId) : null;
      const locationName = selectedLocation?.name || '';

      const selectedServiceId = this.saleForm.get('typeOfService')?.value;
      const selectedService = selectedServiceId ? this.serviceTypes.find(s => s.id === selectedServiceId) : null;
      const serviceName = selectedService?.name || '';

      const selectedUserId = this.saleForm.get('addedBy')?.value;
      const selectedUser = selectedUserId ? this.users.find(u => u.id === selectedUserId) : null;
      const userName = selectedUser?.displayName || selectedUser?.name || selectedUser?.email || 'System User';

      const commissionPercent = selectedUserId ? await this.getAgentCommission(selectedUserId) : 0;

      const productsToSave = [...this.products].map(product => ({
        id: product.id || '',
        name: product.name || '',
        productName: product.productName || product.name || '',
        sku: product.sku || '',
        quantity: product.quantity || 0,
        unitPrice: product.unitPrice || 0,
        batchNumber: product.batchNumber || '',
        expiryDate: product.expiryDate || '',
        discount: product.discount || 0,
        commissionPercent: product.commissionPercent || 0,
        commissionAmount: product.commissionAmount || 0,
        subtotal: product.subtotal || 0,
        taxRate: product.taxRate || 0,
        taxAmount: product.taxAmount || 0,
        taxType: product.taxType || '',
        cgstAmount: product.cgstAmount || 0,
        sgstAmount: product.sgstAmount || 0,
        igstAmount: product.igstAmount || 0,
        priceBeforeTax: product.priceBeforeTax || 0
      }));

      if (this.defaultProduct.name || this.defaultProduct.quantity > 0 || this.defaultProduct.unitPrice > 0) {
        productsToSave.push({
          id: '',
          name: this.defaultProduct.name || '',
          productName: this.defaultProduct.name || '',
          sku: '',
          quantity: this.defaultProduct.quantity || 0,
          unitPrice: this.defaultProduct.unitPrice || 0,
          discount: this.defaultProduct.discount || 0,
          commissionPercent: this.defaultProduct.commissionPercent || 0,
          commissionAmount: this.defaultProduct.commissionAmount || 0,
          subtotal: this.defaultProduct.subtotal || 0,
          batchNumber: this.defaultProduct.batchNumber || '',
          expiryDate: this.defaultProduct.expiryDate || '',
          taxRate: this.defaultProduct.taxRate || 0,
          taxAmount: this.defaultProduct.taxAmount || 0,
          taxType: this.defaultProduct.taxType || '',
          cgstAmount: this.defaultProduct.cgstAmount || 0,
          sgstAmount: this.defaultProduct.sgstAmount || 0,
          igstAmount: this.defaultProduct.igstAmount || 0,
          priceBeforeTax: this.defaultProduct.priceBeforeTax || 0
        });
      }

      // Create clean prescription data
      const cleanPrescriptions = this.createCleanPrescription();

      const saleData: any = {
        ...this.saleForm.value,
        prescriptions: cleanPrescriptions,
        
        // Comprehensive tax information
        taxAmount: parseFloat(totalTax.toFixed(2)),
        taxDetails: {
          cgst: parseFloat(cgstTotal.toFixed(2)),
          sgst: parseFloat(sgstTotal.toFixed(2)),
          igst: parseFloat(igstTotal.toFixed(2)),
          total: parseFloat(totalTax.toFixed(2))
        },
        productTaxAmount: parseFloat((productTax + defaultProductTax).toFixed(2)),
        shippingTaxAmount: parseFloat(shippingTax.toFixed(2)),
        
        orderTax: this.saleForm.get('orderTax')?.value || 0,
        paymentAccountId: selectedPaymentAccount?.id || '',
        paymentAccountName: selectedPaymentAccount?.name || '',
        paymentAccountType: selectedPaymentAccount?.accountType || '',
        ppServiceData: this.ppServiceData || null,
        hasPpService: !!this.ppServiceData,
        prescription: cleanPrescriptions && cleanPrescriptions.length > 0 ? cleanPrescriptions[0] : null,
        status: this.saleForm.get('status')?.value || 'Pending',
        paymentStatus: this.saleForm.get('paymentStatus')?.value ||
          (this.saleForm.get('status')?.value === 'Pending' ? 'Due' : 'Paid'),
        codData: this.codData || null,
        hasCod: !!this.codData,
        shippingDocuments: [],
        customerId: selectedCustomerId || '',
        customer: customerName,
        businessLocationId: selectedLocationId || '',
        businessLocation: locationName,
        location: locationName,
        transactionId: this.saleForm.get('transactionId')?.value || '',
        typeOfService: selectedServiceId || '',
        typeOfServiceName: serviceName,
        shippingCharges: this.saleForm.get('shippingCharges')?.value || 0,
        shippingChargesAfterTax: this.saleForm.get('shippingChargesAfterTax')?.value || 0,
        shippingTotal: this.calculateShippingWithTax ? this.calculateShippingWithTax() :
          (this.saleForm.get('shippingCharges')?.value || 0),
        subtotal: this.itemsTotal || 0,
        totalBeforeTax: (this.itemsTotal || 0) - totalTax,
        totalPayable: this.saleForm.get('totalPayable')?.value || 0,
        products: productsToSave,
        itemsTotal: this.itemsTotal || 0,
        totalCommission: this.totalCommission || 0,
        commissionPercentage: commissionPercent || 0,
        updatedAt: new Date(),
        addedBy: selectedUserId || '',
        addedByDisplayName: userName,
        interestedProductIds: this.selectedProductsForInterested.map(p => p.id || '') || []
      };

      // Clean the entire sale data object to remove undefined values
      const cleanSaleData = this.cleanObjectForFirestore(saleData);

      console.log('Updating sale data with tax details:', cleanSaleData);

      await this.saleService.updateSale(this.saleId, cleanSaleData);

      // Save prescription separately if it exists
      if (cleanPrescriptions && cleanPrescriptions.length > 0) {
        try {
          await this.saleService.savePrescription({
            patientName: cleanPrescriptions[0].patientName || 'Unknown Patient',
            date: this.todayDate,
            medicines: cleanPrescriptions[0].medicines || [],
            doctorName: this.currentUser
          });
        } catch (prescriptionError) {
          console.error('Error saving prescription:', prescriptionError);
          this.showToast('Sale updated successfully, but prescription could not be saved', 'info');
        }
      }

      this.showToast(`Sale updated successfully!`, 'success');
      
      setTimeout(() => {
        this.router.navigate(['/sales-order']);
      }, 1500);

    } catch (error: any) {
      console.error('Update sale error:', error);
      let errorMessage = 'Error updating sale. ';
      if (error.code) errorMessage += `Error code: ${error.code}. `;
      errorMessage += error.message || 'Please try again.';
      this.showToast(errorMessage, 'error');
    } finally {
      this.isSubmitting = false;
    }
  }

  private findInvalidControls(): { name: string; control: any }[] {
    const invalid = [];
    const controls = this.saleForm.controls;
    for (const name in controls) {
      if (controls[name].invalid) {
        invalid.push({ name, control: controls[name] });
      }
    }
    return invalid;
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
      
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  private focusOnField(fieldName: string): void {
    const element = document.querySelector(`[formControlName="${fieldName}"]`) as HTMLElement;
    if (element) {
      element.focus();
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  resetForm(): void {
    if (confirm('Are you sure you want to reset the form? All unsaved changes will be lost.')) {
      this.loadSaleData(this.saleId);
    }
  }

  cancelEdit(): void {
    if (confirm('Are you sure you want to cancel? All unsaved changes will be lost.')) {
      this.router.navigate(['/sales-order']);
    }
  }

  onContentEditableChange(event: Event, field: string, index?: number): void {
    const element = event.target as HTMLElement;
    const value = element.innerText.trim();

    if (index !== undefined) {
      this.prescriptionData.medicines[index][field as keyof Medicine] = value;
    } else {
      if (field !== 'medicines') {
        (this.prescriptionData as any)[field] = value;
      }
    }

    this.changeDetectorRef.detectChanges();
  }
}