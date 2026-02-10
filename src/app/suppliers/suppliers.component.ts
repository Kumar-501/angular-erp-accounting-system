import { Component, OnInit, ViewChild, ElementRef, Renderer2, HostListener } from '@angular/core';
import { SupplierService } from '../services/supplier.service';
import { CustomerService } from '../services/customer.service';
import { UserService } from '../services/user.service';
import { Purchase, PurchaseService } from '../services/purchase.service';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { PaymentService } from '../services/payment.service';
import { collection, getDoc, getDocs, or, query, where } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { Router } from '@angular/router';
import { LocationService } from '../services/location.service';
import { AccountService } from '../services/account.service';
import { Firestore } from '@angular/fire/firestore';

interface ColumnVisibility {
  name: string;
  label: string;
  visible: boolean;
}

interface Supplier {
  bankDetails: any;
  id?: string;
  totalPurchases?: number;
  paymentAmount?: number;
  contactId?: string;
  payTerm?: number;
  bankBranchName?: string;
  identificationCode?: string;
  swiftCode?: string;
  businessName?: string;
  firstName?: string;
  lastName?: string;
  isIndividual?: boolean;
  email?: string;
  mobile?: string;
  paymentDue?: number;
  landline?: string;
  alternateContact?: string;
  assignedTo?: string;
  createdAt?: Date | string;
  status?: 'Active' | 'Inactive';
  district?: string;
  taxNumber?: string;
  openingBalance?: number;
  purchaseDue?: number;
  purchaseReturn?: number;
  advanceBalance?: number;
  grandTotal?: number;
  addressLine1?: string;
  addressLine2?: string;
  shippingAddress?: {
    customerName?: string;
    address1?: string;
    address2?: string;
    country?: string;
    state?: string;
    district?: string;
    zipCode?: string;
  };
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
  prefix?: string;
  middleName?: string;
  dob?: Date;
  contactType?: string;
  address: string;
}

@Component({
  selector: 'app-suppliers',
  templateUrl: './suppliers.component.html',
  styleUrls: ['./suppliers.component.scss']
})
export class SuppliersComponent implements OnInit {
  showColumnSelector = false;
  columnVisibility: ColumnVisibility[] = [
    { name: 'contactId', label: 'Contact ID', visible: true },
    { name: 'createdAt', label: 'Created Date', visible: true },
    { name: 'businessName', label: 'Business Name', visible: true },
    { name: 'payTerm', label: 'Pay Term', visible: false },
    { name: 'firstName', label: 'Name', visible: true },
    { name: 'email', label: 'Email', visible: true },
    { name: 'taxNumber', label: 'Tax Number', visible: false },
    { name: 'openingBalance', label: 'Opening Balance', visible: false },
    { name: 'mobile', label: 'Mobile', visible: true },
    { name: 'landline', label: 'Landline', visible: false },
    { name: 'alternateContact', label: 'Alternate Contact', visible: false },
    { name: 'prefix', label: 'Prefix', visible: false },
    { name: 'middleName', label: 'Middle Name', visible: false },
    { name: 'dob', label: 'Date of Birth', visible: false },
    { name: 'addressLine1', label: 'Address Line 1', visible: false },
    { name: 'addressLine2', label: 'Address Line 2', visible: false },
    { name: 'state', label: 'State', visible: false },
    { name: 'country', label: 'Country', visible: false },
    { name: 'zipCode', label: 'Zip Code', visible: false },
    { name: 'totalPurchases', label: 'Total Purchases', visible: true },
    { name: 'contactType', label: 'Contact Type', visible: false },
    { name: 'bankName', label: 'Bank Name', visible: false },
    { name: 'bankBranchName', label: 'Branch Name', visible: false },
    { name: 'identificationCode', label: 'ID Code', visible: false },
    { name: 'swiftCode', label: 'Swift Code', visible: false }
  ];
  
  isSubmitting = false;
  selectedSuppliers = new Set<string>();
  allSelected = false;
  isDropdownOpen = false;
  currentActionPopup: string | null = null;
  currentUser: any;

  @ViewChild('actionsDropdown', { static: false }) actionsDropdown!: ElementRef;
  @ViewChild('dropdownMenu', { static: false }) dropdownMenu!: ElementRef;
  @ViewChild('dropdownElement', { static: false }) dropdownElement!: ElementRef;

  // Payment related properties
  paymentAccounts: any[] = [];
  paymentAccountsLoading = false;
  showPaymentForm = false;
  selectedFile: File | null = null;
  currentPaymentSupplier: Supplier | null = null;
  paymentSummary = {
    totalPurchase: 0,
    totalPaid: 0,
    totalPurchaseDue: 0,
    openingBalance: 0,
    openingBalanceDue: 0
  };

  // Form and data properties
  showForm = false;
  searchText: string = '';
  showMoreInfo = false;
  isIndividual = true;
  currentOpenDropdown: string | null = null;
  entriesPerPage: number = 10;
  isLoading = false;
  searchTimeout: any = null;
  dropdownOpen = false;
  clickInsideDropdown = false;
  supplierData: Partial<Supplier> = {};
  suppliersList: Supplier[] = [];
  filteredSuppliers: Supplier[] = [];
  assignedUsers: {id: string, username: string}[] = []; 
  editingSupplierId: string | null = null;
  statesList: string[] = []; 
  selectedFileName = '';
  currentPaymentPurchase: any = null;

  // Address and location properties
  filteredShippingDistricts: string[] = [];
  showLedgerView = false;
  selectedSupplierForLedger: Supplier | null = null;
  isFilterVisible = false;
  dateRangeLabel: string = '';
  isCustomDate: boolean = false;
  isDrawerOpen = false;
  selectedRange = '';
  isDateDrawerOpen = false;
  fromDate: string = '';
  toDate: string = '';

  stateDistricts: { [key: string]: string[] } = {
    'Kerala': [
      'Thiruvananthapuram', 'Kollam', 'Pathanamthitta', 'Alappuzha', 
      'Kottayam', 'Idukki', 'Ernakulam', 'Thrissur', 
      'Palakkad', 'Malappuram', 'Kozhikode', 'Wayanad', 
      'Kannur', 'Kasaragod'
    ],
    'Tamil Nadu': [
      'Ariyalur', 'Chengalpattu', 'Chennai', 'Coimbatore', 
      'Cuddalore', 'Dharmapuri', 'Dindigul', 'Erode', 
      'Kallakurichi', 'Kancheepuram', 'Karur', 'Krishnagiri', 
      'Madurai', 'Mayiladuthurai', 'Nagapattinam', 'Namakkal', 
      'Perambalur', 'Pudukkottai', 'Ramanathapuram', 'Ranipet', 
      'Salem', 'Sivaganga', 'Tenkasi', 'Thanjavur', 
      'Theni', 'Thoothukudi', 'Tiruchirappalli', 'Tirunelveli', 
      'Tirupathur', 'Tiruppur', 'Tiruvallur', 'Tiruvannamalai', 
      'Tiruvarur', 'Vellore', 'Viluppuram', 'Virudhunagar'
    ]
  };

  filteredDistricts: string[] = [];
  supplierForm: FormGroup;
  validationErrors = {
    mobile: '',
    landline: '',
    alternateContact: ''
  };
  
  filterOptions = {
    purchaseDue: false,
    purchaseReturn: false,
    advanceBalance: false,
    openingBalance: false,
    assignedTo: '',
    status: '',
    state: '',
    fromDate: '',
    toDate: '',
  };

  paymentForm: FormGroup;
  currentPage = 1;
  totalPages = 1;
  sortColumn = 'businessName';
  sortDirection = 'asc';
  searchTerm = '';

  constructor(
    private supplierService: SupplierService,
    private accountService: AccountService,
    private customerService: CustomerService,
    private userService: UserService,
    private purchaseService: PurchaseService,
    private fb: FormBuilder,
    private paymentService: PaymentService,
    private router: Router,
    private locationService: LocationService,
    private elementRef: ElementRef,
    private renderer: Renderer2,
    private firestore: Firestore
  ) {
 this.supplierForm = this.fb.group({
      contactId: [{value: '', disabled: false}],
      businessName: [''],
      firstName: [''],
      lastName: [''],
        createdAt: [new Date().toISOString().split('T')[0], Validators.required],

      payTerm: [0, [Validators.min(0)]],
      middleName: [''],
      prefix: [''],
      dob: [null],
      mobile: ['', [Validators.required, Validators.pattern('^[0-9]{10}$')]],
      landline: ['', [Validators.pattern('^[0-9]{12}$')]],
      alternateContact: ['', [Validators.pattern('^[0-9]{10}$')]],
      email: ['', [Validators.email]],
      district: [''],
      assignedTo: [''],
      taxNumber: [''],
      openingBalance: [0],
      addressLine1: [''],
      addressLine2: [''],
      city: [''],
      state: [''],
      country: ['India'], // <--- CHANGE 1: Set default value here
      zipCode: [''],
      contactType: ['Supplier'],
      businessType: [''],
      billingType: ['Prepaid'],
      verificationStatus: ['Not Verified'],
      creditLimit: [0, [Validators.min(0)]],
      bankDetails: this.fb.group({
        accountHolderName: [''],
        accountNumber: [''],
        bankName: [''],
        bankBranchName: [''],
        identificationCode: [''],
        swiftCode: ['']
      })
    });

    this.paymentForm = this.fb.group({
      supplierName: [''],
      businessName: [''],
      paymentMethod: ['Cash', Validators.required],
      paymentNote: [''],
      reference: [''],
      paidDate: [new Date().toISOString().slice(0, 16), Validators.required],
      amount: [0, [Validators.required, Validators.min(0.01)]],
      paymentAccount: [null, Validators.required]
    });
  }

  ngOnInit(): void {
    this.loadSuppliers();
    this.loadAssignedUsers();
    this.loadStates();
    
    this.userService.getCurrentUser().subscribe(user => {
      this.currentUser = user;
    });

    this.paymentForm.valueChanges.subscribe(val => {
      if (this.currentPaymentSupplier?.id) {
        localStorage.setItem(
          `paymentInProgress_${this.currentPaymentSupplier.id}`,
          JSON.stringify(val)
        );
      }
    });
  }

  validatePayTerm(): void {
    const payTermControl = this.supplierForm.get('payTerm');
    if (payTermControl && payTermControl.value < 0) {
      payTermControl.setValue(0);
    }
  }

  loadSuppliers(): void {
    this.isLoading = true;
    console.log('Loading suppliers...');
    
    this.supplierService.getSuppliers().subscribe({
      next: (suppliers: any[]) => {
        console.log('Raw suppliers data:', suppliers);
        
        this.suppliersList = suppliers.map(supplier => ({
          ...supplier,
          createdAt: supplier.createdAt ? this.convertToDate(supplier.createdAt) : new Date(),
          totalPurchases: 0,
          paymentAmount: 0,
          paymentDue: 0,
          status: supplier.status || 'Active'
        }));

        console.log('Processed suppliers list:', this.suppliersList);
        this.applyFiltersImmediate();
        this.isLoading = false;
        this.loadSupplierPaymentDataBackground();
      },
      error: (error) => {
        console.error('Error loading suppliers:', error);
        this.isLoading = false;
        this.showSnackbar('Error loading suppliers', 'error');
      }
    });
  }

  private applyFiltersImmediate(): void {
    this.filteredSuppliers = [...this.suppliersList];
    this.totalPages = Math.ceil(this.filteredSuppliers.length / this.entriesPerPage);
    this.currentPage = 1;
    console.log('Filtered suppliers immediately:', this.filteredSuppliers.length);
  }

  private loadSupplierPaymentDataBackground(): void {
    const supplierPromises = this.suppliersList.map(supplier => {
      if (!supplier.id) return Promise.resolve();

      return new Promise<void>((resolve) => {
        this.purchaseService.getPurchasesBySupplier(supplier.id!).subscribe({
          next: (purchases) => {
            const totalPurchases = purchases.reduce((sum, purchase) => 
              sum + (purchase.grandTotal || purchase.purchaseTotal || 0), 0);
            
            this.paymentService.getPaymentsBySupplier(supplier.id!).subscribe({
              next: (payments) => {
                const totalPaid = payments.reduce((sum, payment) => 
                  sum + (payment.amount || 0), 0);
                
                supplier.totalPurchases = totalPurchases;
                supplier.paymentAmount = totalPaid;
                supplier.paymentDue = Math.max(0, totalPurchases + (supplier.openingBalance || 0) - totalPaid);
                
                resolve();
              },
              error: () => resolve()
            });
          },
          error: () => resolve()
        });
      });
    });

    Promise.all(supplierPromises).then(() => {
      console.log('All supplier payment data loaded, refreshing display');
      this.applyFilters();
    });
  }

  private convertToDate(dateValue: any): Date {
    if (dateValue instanceof Date) {
      return dateValue;
    }
    
    if (typeof dateValue === 'string') {
      if (dateValue.includes('T')) {
        return new Date(dateValue);
      }
    }
    
    if (dateValue?.seconds) {
      return new Date(dateValue.seconds * 1000);
    }
    
    return new Date(dateValue);
  }

  async submitPayment(): Promise<void> {
    if (this.paymentForm.invalid || !this.currentPaymentSupplier?.id) {
      this.paymentForm.markAllAsTouched();
      return;
    }
    
    this.isSubmitting = true;
    console.log('Submitting payment for supplier:', this.currentPaymentSupplier.id);

    try {
      const paymentData = {
        supplierId: this.currentPaymentSupplier.id,
        supplierName: this.paymentForm.value.supplierName,
        amount: this.paymentForm.value.amount,
        paymentDate: new Date(this.paymentForm.value.paidDate),
        paymentMethod: this.paymentForm.value.paymentMethod,
        paymentNote: this.paymentForm.value.paymentNote,
        reference: this.paymentForm.value.reference,
        paymentAccount: this.paymentForm.value.paymentAccount,
        type: 'supplier'
      };

      console.log('Payment data:', paymentData);

      await this.paymentService.addPayment(paymentData);
      console.log('Payment recorded successfully');

      if (paymentData.paymentAccount?.id) {
        await this.accountService.updateAccountBalance(
          paymentData.paymentAccount.id,
          -paymentData.amount
        );

        await this.accountService.recordTransaction(paymentData.paymentAccount.id, {
          amount: paymentData.amount,
          type: 'expense',
          date: paymentData.paymentDate,
          reference: paymentData.reference,
          relatedDocId: this.currentPaymentSupplier.id,
          description: `Payment to supplier ${paymentData.supplierName}`,
          paymentMethod: paymentData.paymentMethod
        });
        console.log('Account balance updated');
      }

      this.closePaymentForm();
      this.showSnackbar('Payment recorded successfully!', 'success');

      setTimeout(() => {
        console.log('Reloading suppliers after payment...');
        this.loadSuppliers();
      }, 1000);

    } catch (error) {
      console.error('Error processing payment:', error);
      this.showSnackbar('Error processing payment', 'error');
    } finally {
      this.isSubmitting = false;
    }
  }

  calculateSupplierPaymentDue(supplierId: string): Promise<number> {
    return new Promise((resolve) => {
      console.log('Calculating payment due for supplier:', supplierId);
      
      this.purchaseService.getPurchasesBySupplier(supplierId).subscribe({
        next: (purchases) => {
          const totalPurchases = purchases.reduce((sum, purchase) => 
            sum + (purchase.grandTotal || purchase.purchaseTotal || 0), 0);
          
          this.paymentService.getPaymentsBySupplier(supplierId).subscribe({
            next: (payments) => {
              const totalPaid = payments.reduce((sum, payment) => 
                sum + (payment.amount || 0), 0);
              
              const supplier = this.suppliersList.find(s => s.id === supplierId);
              const openingBalance = supplier?.openingBalance || 0;
              const paymentDue = Math.max(0, totalPurchases + openingBalance - totalPaid);
              
              console.log('Payment calculation:', {
                totalPurchases,
                totalPaid,
                openingBalance,
                paymentDue
              });
              
              resolve(paymentDue);
            },
            error: (error) => {
              console.error('Error getting payments:', error);
              resolve(0);
            }
          });
        },
        error: (error) => {
          console.error('Error getting purchases:', error);
          resolve(0);
        }
      });
    });
  }

  onPaymentMethodChange(): void {
    // Logic for payment method change if needed
  }

  toggleSelectAll(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.allSelected = target.checked;
    
    if (this.allSelected) {
      this.paginatedSuppliers.forEach(supplier => {
        if (supplier.id) {
          this.selectedSuppliers.add(supplier.id);
        }
      });
    } else {
      this.selectedSuppliers.clear();
    }
  }

  toggleSupplierSelection(supplierId: string): void {
    if (this.selectedSuppliers.has(supplierId)) {
      this.selectedSuppliers.delete(supplierId);
      this.allSelected = false;
    } else {
      this.selectedSuppliers.add(supplierId);
      this.allSelected = this.paginatedSuppliers.every(supplier => 
        supplier.id && this.selectedSuppliers.has(supplier.id));
    }
  }

  toggleColumnSelector(): void {
    this.showColumnSelector = !this.showColumnSelector;
  }

  toggleColumnVisibility(columnName: string): void {
    const column = this.columnVisibility.find(c => c.name === columnName);
    if (column) {
      column.visible = !column.visible;
    }
  }

  isColumnVisible(columnName: string): boolean {
    const column = this.columnVisibility.find(c => c.name === columnName);
    return column ? column.visible : false;
  }

  async deleteSelectedSuppliers(): Promise<void> {
    if (this.selectedSuppliers.size === 0) return;
    
    const confirmDelete = confirm(`Are you sure you want to delete ${this.selectedSuppliers.size} suppliers?`);
    if (!confirmDelete) return;

    try {
      const deletePromises = Array.from(this.selectedSuppliers).map(id => 
        this.supplierService.deleteSupplier(id)
      );
      
      await Promise.all(deletePromises);
      this.selectedSuppliers.clear();
      this.allSelected = false;
      this.loadSuppliers();
      this.showSnackbar(`${deletePromises.length} suppliers deleted successfully`, 'success');
    } catch (error) {
      console.error('Error deleting suppliers:', error);
      this.showSnackbar('Error deleting suppliers', 'error');
    }
  }

  get combinedAddress(): string {
    const form = this.supplierForm.value;
    const parts = [];

    if (this.isIndividual) {
      const nameParts = [];
      if (form.firstName) nameParts.push(form.firstName);
      if (form.lastName) nameParts.push(form.lastName);
      if (nameParts.length > 0) {
        parts.push(nameParts.join(' '));
      }
    }

    if (form.businessName) {
      parts.push(form.businessName);
    }

    if (form.mobile) {
      parts.push(`Mobile: ${form.mobile}`);
    }

    if (form.addressLine1) parts.push(form.addressLine1);
    if (form.addressLine2) parts.push(form.addressLine2);
    if (form.city) parts.push(form.city);
    if (form.district) parts.push(form.district);
    if (form.state) parts.push(form.state);
    if (form.country) parts.push(form.country);
    if (form.zipCode) parts.push(form.zipCode);

    return parts.join(', ');
  }

  isFormValid(): boolean {
    const basicValid = this.supplierForm.valid;
    
    if (this.isIndividual) {
      return basicValid && !!this.supplierForm.get('firstName')?.value;
    } else {
      return basicValid && !!this.supplierForm.get('businessName')?.value;
    }
  }

  updateFormValidation(): void {
    const firstNameControl = this.supplierForm.get('firstName');
    const businessNameControl = this.supplierForm.get('businessName');
    
    if (this.isIndividual) {
      firstNameControl?.setValidators([Validators.required]);
      businessNameControl?.clearValidators();
    } else {
      businessNameControl?.setValidators([Validators.required]);
      firstNameControl?.clearValidators();
    }
    
    firstNameControl?.updateValueAndValidity();
    businessNameControl?.updateValueAndValidity();
  }

  toggleDropdown(supplierId: string): void {
    if (this.currentOpenDropdown === supplierId) {
      this.currentOpenDropdown = null;
    } else {
      this.currentOpenDropdown = supplierId;
    }
  }

  closeDropdown(): void {
    this.currentOpenDropdown = null;
  }

  getFullName(supplier: Supplier): string {
    return `${supplier.prefix ? supplier.prefix + ' ' : ''}${supplier.firstName || ''}${supplier.middleName ? ' ' + supplier.middleName : ''}${supplier.lastName ? ' ' + supplier.lastName : ''}`.trim();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const clickedInside = this.elementRef.nativeElement.contains(event.target);
    if (!clickedInside) {
      this.closeDropdown();
    }
  }

  onShippingStateChange(): void {
    const selectedState = this.supplierForm.get('shippingState')?.value;
    this.filteredShippingDistricts = selectedState ? this.stateDistricts[selectedState] : [];
    this.supplierForm.patchValue({ shippingDistrict: '' });
  }

  onAddressChange(): void {
    this.supplierForm.updateValueAndValidity();
  }

  onStateChange(): void {
    const selectedState = this.supplierForm.get('state')?.value;
    this.filteredDistricts = selectedState ? this.stateDistricts[selectedState] : [];
    this.supplierForm.patchValue({ district: '' });
  }

  goToShopping(supplier: Supplier): void {
    if (supplier.id) {
      this.router.navigate(['/shopping'], {
        queryParams: { supplierId: supplier.id }
      });
    }
  }

  toggleStatus(supplier: Supplier): void {
    const newStatus = supplier.status === 'Active' ? 'Inactive' : 'Active';
    
    this.supplierService.updateSupplier(supplier.id!, { status: newStatus })
      .then(() => {
        supplier.status = newStatus;
        if (supplier.contactType === 'Customer' || supplier.contactType === 'Both') {
          this.customerService.updateCustomer(supplier.id!, { status: newStatus });
        }
      })
      .catch(error => {
        console.error('Error updating status:', error);
      });
  }

  toggleDrawer() {
    this.isDrawerOpen = !this.isDrawerOpen;
    document.body.style.overflow = this.isDrawerOpen ? 'hidden' : '';
  }

  toggleDateDrawer(): void {
    this.isDateDrawerOpen = !this.isDateDrawerOpen;
  }

  loadAssignedUsers(): void {
    this.userService.getUsers().subscribe((users) => {
      this.assignedUsers = users.map(user => ({
        id: user.id,
        username: user.username || user.displayName || user.email || 'Unknown User'
      }));
    }, error => {
      console.error('Error loading users:', error);
      this.assignedUsers = [];
    });
  }

  loadStates(): void {
    this.supplierService.getSuppliers().subscribe(suppliers => {
      this.statesList = [...new Set(
        suppliers
          .map(s => s.state)
          .filter((state): state is string => !!state && state.trim() !== '')
      )].sort((a, b) => a.localeCompare(b));
    });
  }

  applyFilters(): void {
    let filtered = [...this.suppliersList];
    
    if (this.searchTerm && this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase().trim();
      filtered = filtered.filter(supplier => 
        (supplier.businessName?.toLowerCase().includes(term)) || 
        (supplier.firstName?.toLowerCase().includes(term)) ||
        (supplier.lastName?.toLowerCase().includes(term)) ||
        (supplier.email?.toLowerCase().includes(term)) ||
        (supplier.mobile?.toLowerCase().includes(term)) ||
        (supplier.contactId?.toLowerCase().includes(term)) ||
        (supplier.landline?.toLowerCase().includes(term)) ||
        (supplier.alternateContact?.toLowerCase().includes(term)) ||
        (supplier.taxNumber?.toLowerCase().includes(term)) ||
        (supplier.city?.toLowerCase().includes(term)) ||
        (supplier.state?.toLowerCase().includes(term)) ||
        (supplier.country?.toLowerCase().includes(term)) ||
        (supplier.addressLine1?.toLowerCase().includes(term)) ||
        (supplier.addressLine2?.toLowerCase().includes(term)) ||
        (supplier.zipCode?.toString().includes(term))
      );
    }

    if (this.filterOptions.state && this.filterOptions.state.trim()) {
      filtered = filtered.filter(supplier => supplier.state === this.filterOptions.state);
    }

    if (this.filterOptions.fromDate && this.filterOptions.fromDate.trim()) {
      const fromDate = new Date(this.filterOptions.fromDate);
      filtered = filtered.filter(supplier => {
        const supplierDate = supplier.createdAt ? new Date(supplier.createdAt) : new Date();
        return supplierDate >= fromDate;
      });
    }

    if (this.filterOptions.toDate && this.filterOptions.toDate.trim()) {
      const toDate = new Date(this.filterOptions.toDate);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(supplier => {
        const supplierDate = supplier.createdAt ? new Date(supplier.createdAt) : new Date();
        return supplierDate <= toDate;
      });
    }
    
    if (this.filterOptions.purchaseDue) {
      filtered = filtered.filter(supplier => supplier.purchaseDue && supplier.purchaseDue > 0);
    }
    
    if (this.filterOptions.purchaseReturn) {
      filtered = filtered.filter(supplier => supplier.purchaseReturn && supplier.purchaseReturn > 0);
    }
    
    if (this.filterOptions.advanceBalance) {
      filtered = filtered.filter(supplier => supplier.advanceBalance && supplier.advanceBalance > 0);
    }
    
    if (this.filterOptions.openingBalance) {
      filtered = filtered.filter(supplier => supplier.openingBalance && supplier.openingBalance > 0);
    }
    
    filtered.sort((a, b) => {
      const valA = a[this.sortColumn as keyof Supplier] || '';
      const valB = b[this.sortColumn as keyof Supplier] || '';
      
      if (valA < valB) return this.sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return this.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    
    this.filteredSuppliers = filtered;
    this.totalPages = Math.ceil(this.filteredSuppliers.length / this.entriesPerPage);
    this.currentPage = Math.min(this.currentPage, this.totalPages || 1);
    this.selectedSuppliers.clear();
    this.allSelected = false;

    console.log('Applied filters:', {
      originalCount: this.suppliersList.length,
      filteredCount: this.filteredSuppliers.length,
      searchTerm: this.searchTerm,
      filters: this.filterOptions
    });
  }

  onEntriesPerPageChange(): void {
    this.currentPage = 1;
    this.applyFilters();
  }

  toggleFilters(): void {
    this.isFilterVisible = !this.isFilterVisible;
  }

  filterByDate(range: string) {
    this.selectedRange = range;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (range) {
      case 'today':
        this.filterOptions.fromDate = this.filterOptions.toDate = this.formatDate(today);
        this.dateRangeLabel = 'Today';
        break;
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        this.filterOptions.fromDate = this.filterOptions.toDate = this.formatDate(yesterday);
        this.dateRangeLabel = 'Yesterday';
        break;
      case 'sevenDays':
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        this.filterOptions.fromDate = this.formatDate(sevenDaysAgo);
        this.filterOptions.toDate = this.formatDate(today);
        this.dateRangeLabel = 'Last 7 Days';
        break;
      case 'thirtyDays':
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        this.filterOptions.fromDate = this.formatDate(thirtyDaysAgo);
        this.filterOptions.toDate = this.formatDate(today);
        this.dateRangeLabel = 'Last 30 Days';
        break;
      case 'lastMonth':
        const firstDayOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastDayOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
        this.filterOptions.fromDate = this.formatDate(firstDayOfLastMonth);
        this.filterOptions.toDate = this.formatDate(lastDayOfLastMonth);
        this.dateRangeLabel = 'Last Month';
        break;
      case 'custom':
        this.isCustomDate = true;
        return;
    }

    this.isCustomDate = false;
    this.isDateDrawerOpen = false;
    this.applyFilters();
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  clearFilters(): void {
    this.filterOptions = {
      purchaseDue: false,
      purchaseReturn: false,
      advanceBalance: false,
      openingBalance: false,
      assignedTo: '',
      status: '',
      state: '',
      fromDate: '',
      toDate: ''
    };
    this.fromDate = '';
    this.toDate = '';
    this.dateRangeLabel = '';
    this.isCustomDate = false;
    this.selectedRange = '';
    this.searchTerm = '';
    this.applyFilters();
  }

  selectCustomRange(): void {
    this.selectedRange = 'custom';
    this.isCustomDate = true;
  }

  applyCustomRange(): void {
    if (this.fromDate && this.toDate) {
      const fromDate = new Date(this.fromDate);
      const toDate = new Date(this.toDate);
      
      this.dateRangeLabel = `${fromDate.toLocaleDateString()} - ${toDate.toLocaleDateString()}`;
      
      this.filterOptions.fromDate = this.fromDate;
      this.filterOptions.toDate = this.toDate;
      
      this.applyFilters();
      
      this.isDateDrawerOpen = false;
      this.isCustomDate = false;
    }
  }

  cancelCustomRange(): void {
    this.isCustomDate = false;
    this.selectedRange = '';
  }

  clearDateFilter(): void {
    this.filterOptions.fromDate = '';
    this.filterOptions.toDate = '';
    this.dateRangeLabel = '';
    this.selectedRange = '';
    this.fromDate = '';
    this.toDate = '';
    this.isCustomDate = false;
    this.applyFilters();
  }

  sortBy(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.applyFilters();
  }

  get paginatedSuppliers(): Supplier[] {
    if (this.filteredSuppliers.length === 0) {
      return [];
    }
    
    const start = (this.currentPage - 1) * this.entriesPerPage;
    const end = start + this.entriesPerPage;
    
    return this.filteredSuppliers.slice(start, Math.min(end, this.filteredSuppliers.length));
  }

  prevPage(): void {
    if (this.currentPage > 1 && this.filteredSuppliers.length > 0) {
      this.currentPage--;
      this.selectedSuppliers.clear();
      this.allSelected = false;
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages && this.filteredSuppliers.length > 0) {
      this.currentPage++;
      this.selectedSuppliers.clear();
      this.allSelected = false;
    }
  }

  getFirstItemNumber(): number {
    return (this.currentPage - 1) * this.entriesPerPage + 1;
  }

  getLastItemNumber(): number {
    const last = this.currentPage * this.entriesPerPage;
    return last > this.filteredSuppliers.length ? this.filteredSuppliers.length : last;
  }

  getPageNumbers(): number[] {
    const pagesToShow = 5;
    const pages: number[] = [];
    
    if (this.totalPages <= pagesToShow) {
      for (let i = 1; i <= this.totalPages; i++) {
        pages.push(i);
      }
    } else {
      let startPage = Math.max(1, this.currentPage - Math.floor(pagesToShow / 2));
      let endPage = startPage + pagesToShow - 1;
      
      if (endPage > this.totalPages) {
        endPage = this.totalPages;
        startPage = Math.max(1, endPage - pagesToShow + 1);
      }
      
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
    }
    
    return pages;
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
      this.currentPage = page;
      this.selectedSuppliers.clear();
      this.allSelected = false;
      this.scrollToTableTop();
    }
  }

  private scrollToTableTop(): void {
    const tableElement = document.querySelector('.table-responsive');
    if (tableElement) {
      tableElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  updateSupplierStatus(supplier: Supplier, status: 'Active' | 'Inactive'): void {
    if (!supplier.id) {
      console.error('Supplier ID is missing');
      return;
    }

    this.supplierService.updateSupplierStatus(supplier.id, status)
      .then(() => {
        supplier.status = status;
        this.showSnackbar(`Status updated to ${status}`, 'success');
      })
      .catch(error => {
        console.error('Error updating status:', error);
        this.showSnackbar('Error updating status', 'error');
      });
  }

toggleForm(): void {
  this.showForm = !this.showForm;
  if (this.showForm && !this.editingSupplierId) {
    const contactId = this.generateContactId();
    // Get current date in YYYY-MM-DD format for the input field
    const currentDate = new Date().toISOString().split('T')[0]; 
    this.supplierForm.patchValue({ 
      contactId,
      createdAt: currentDate
    });
  }
    if (!this.showForm) {
      this.resetForm();
    }
    
    if (!this.showForm) {
      this.isSubmitting = false;
    }
  }

 resetForm(): void {
  const currentDate = new Date().toISOString().split('T')[0];
  this.supplierForm.reset({
      contactType: 'Supplier',
      country: 'India', // <--- CHANGE 2: Ensure reset sets it back to India
      openingBalance: 0,
      payTerm: 0,
    createdAt: currentDate,
      status: 'Active',
      businessType: '',
      billingType: 'Prepaid',
      verificationStatus: 'Not Verified',
      creditLimit: 0,
      bankDetails: {
        accountHolderName: '',
        accountNumber: '',
        bankName: '',
        bankBranchName: '',
        identificationCode: '',
        swiftCode: ''
      }
    });
    this.supplierData = {};
    this.editingSupplierId = null;
    this.showMoreInfo = false;
    this.isIndividual = true;
    this.clearValidationErrors();
  }


  clearValidationErrors(): void {
    this.validationErrors = {
      mobile: '',
      landline: '',
      alternateContact: ''
    };
  }

  toggleMoreInfo(): void {
    this.showMoreInfo = !this.showMoreInfo;
  }

  onContactTypeChange(): void {
    const contactType = this.supplierForm.get('contactType')?.value;
    this.supplierForm.reset({
      contactType,
      openingBalance: 0,
      payTerm: 0
    });
    const contactId = this.generateContactId();
    this.supplierForm.patchValue({ contactId });
    this.updateFormValidation();
  }

  toggleIndividualBusiness(isIndividual: boolean): void {
    this.isIndividual = isIndividual;
    this.updateFormValidation();
  }

  validatePhoneNumber(field: string): boolean {
    const control = this.supplierForm.get(field);
    if (!control) return true;
    
    if (control.value && control.value.length > 0) {
      let pattern: RegExp;
      let errorMessage: string;
      
      switch(field) {
        case 'mobile':
        case 'alternateContact':
          pattern = /^[0-9]{10}$/;
          errorMessage = 'Must be exactly 10 digits';
          break;
        case 'landline':
          pattern = /^[0-9]{12}$/;
          errorMessage = 'Must be exactly 12 digits';
          break;
        default:
          return true;
      }
      
      if (!pattern.test(control.value)) {
        this.validationErrors[field as keyof typeof this.validationErrors] = errorMessage;
        return false;
      }
    }
    
    this.validationErrors[field as keyof typeof this.validationErrors] = '';
    return true;
  }

  async saveSupplier(): Promise<void> {
    const isMobileValid = this.validatePhoneNumber('mobile');
    const isLandlineValid = this.validatePhoneNumber('landline');
    const isAlternateValid = this.validatePhoneNumber('alternateContact');
    
    if (!isMobileValid || !isLandlineValid || !isAlternateValid) {
      return;
    }
        
    if (!this.supplierForm.get('mobile')?.value) {
      alert('Mobile number is required');
      return;
    }
    
    this.isSubmitting = true;
    
    const formValue = this.supplierForm.value;
    
    let createdAtValue = formValue.createdAt;
    if (typeof createdAtValue === 'string') {
      createdAtValue = new Date(createdAtValue);
    }

    this.supplierData = {
      ...formValue,
      isIndividual: this.isIndividual,
      payTerm: formValue.payTerm || 0,
      district: formValue.district || null,
      createdAt: createdAtValue || new Date(),
      status: 'Active'
    };
    
    try {
      let successMessage = 'Supplier saved successfully!';
      if (this.editingSupplierId) {
        await this.updateExistingSupplier();
      } else {
        const accountCreated = await this.addNewSupplier();
        if (accountCreated) {
          successMessage = 'Supplier and linked account created successfully!';
        }
      }
      
      this.toggleForm();
      this.showSnackbar(successMessage, 'success');
    } catch (error: any) {
      console.error('Error saving supplier:', error);
      this.showSnackbar(error.message || 'Error saving supplier', 'error');
    } finally {
      this.isSubmitting = false;
    }
  }

  validateName(): void {
    const isIndividual = this.isIndividual;
    const firstName = this.supplierForm.get('firstName')?.value;
    const businessName = this.supplierForm.get('businessName')?.value;

    if (isIndividual) {
      this.supplierForm.get('businessName')?.clearValidators();
      this.supplierForm.get('firstName')?.setValidators([Validators.required]);
    } else {
      this.supplierForm.get('firstName')?.clearValidators();
      this.supplierForm.get('businessName')?.setValidators([Validators.required]);
    }

    this.supplierForm.get('firstName')?.updateValueAndValidity();
    this.supplierForm.get('businessName')?.updateValueAndValidity();
  }

private async addNewSupplier(): Promise<boolean> {
    if (!this.supplierData.contactId) {
        this.supplierData.contactId = this.generateContactId();
    }

    const contactIsSupplier = this.supplierData.contactType === 'Supplier' || this.supplierData.contactType === 'Both';
    const contactIsCustomer = this.supplierData.contactType === 'Customer' || this.supplierData.contactType === 'Both';
    let newSupplierId: string | null = null;
    let accountCreated = false;

    if (contactIsSupplier) {
        const supplierPayload = { ...this.supplierData };
        delete supplierPayload.id;
        newSupplierId = await this.supplierService.addSupplier(supplierPayload as Supplier);
    }

    if (contactIsCustomer) {
        const customerPayload = { ...this.supplierData };
        delete customerPayload.id;
        await this.customerService.addCustomer(customerPayload as any);
    }

    // Create the linked financial account if it was a supplier
    if (contactIsSupplier && newSupplierId) {
        try {
            const accountName = (this.supplierData.businessName || `${this.supplierData.firstName || ''} ${this.supplierData.lastName || ''}`).trim();
            
            // ✅ CRITICAL FIX: Properly set the account head structure
            const accountData = {
                name: accountName,
                accountNumber: this.supplierData.contactId,
                accountHeadGroup: 'Liabilities',  // Set the group
                accountHeadValue: 'Liabilities|sundry_creditors',  // Set the full path
                accountHead: {  // Also set the accountHead object for backward compatibility
                    group: 'Liabilities',
                    value: 'sundry_creditors'
                },
                openingBalance: this.supplierData.openingBalance || 0,
                currentBalance: this.supplierData.openingBalance || 0,  // Initialize current balance
                accountType: 'Creditor',
                accountSubType: '',
                incomeType: '',
                note: `Auto-generated account for supplier: ${accountName} (${this.supplierData.contactId})`,
                addedBy: this.currentUser?.username || 'System',
                paidOnDate: new Date().toISOString().split('T')[0],
                accountDetails: [],
                // Store supplier reference for easy linking
                linkedSupplierId: newSupplierId,
                linkedContactType: 'Supplier'
            };
            
            await this.accountService.addAccount(accountData);
            console.log(`✅ Successfully created linked account under Liabilities - Sundry Creditors for supplier ${accountName}`);
            accountCreated = true;
        } catch (accountError) {
            console.error('Supplier was created, but failed to create a linked account:', accountError);
            throw new Error('Supplier created, but linked account creation failed.');
        }
    }
    
    await this.loadSuppliers();
    return accountCreated;
}
  private async updateExistingSupplier(): Promise<void> {
    if (!this.editingSupplierId) return;
    
    // Here, you might also want to update the linked account's name or opening balance
    // For now, we just update the supplier/customer records as per original logic
    try {
      if (this.supplierData.contactType === 'Supplier') {
        await this.supplierService.updateSupplier(this.editingSupplierId, this.supplierData as Supplier);
      } else if (this.supplierData.contactType === 'Customer') {
        await this.customerService.updateCustomer(this.editingSupplierId, this.supplierData as any);
      } else if (this.supplierData.contactType === 'Both') {
        await Promise.all([
          this.supplierService.updateSupplier(this.editingSupplierId, this.supplierData as Supplier),
          this.customerService.updateCustomer(this.editingSupplierId, this.supplierData as any)
        ]);
      }
      
      await this.loadSuppliers();
    } catch (error) {
      console.error('Error updating supplier:', error);
      throw error;
    }
  }

editSupplier(supplier: any): void {
  // 1. Format Dates for native pickers (Must be YYYY-MM-DD)
  const createdAtFormatted = supplier.createdAt 
    ? this.convertToDate(supplier.createdAt).toISOString().split('T')[0] 
    : new Date().toISOString().split('T')[0];

  const dobFormatted = supplier.dob 
    ? this.convertToDate(supplier.dob).toISOString().split('T')[0] 
    : '';

  // 2. Set editing state & Individual/Business toggle
  this.editingSupplierId = supplier.id || null;
  this.isIndividual = supplier.isIndividual ?? true;
  
  // 3. Reset form with core values and formatted dates
  // Resetting first ensures the validation state and date pickers are clean
  this.supplierForm.reset({
    contactType: supplier.contactType || 'Supplier',
    openingBalance: supplier.openingBalance || 0,
    payTerm: supplier.payTerm || 0,
    createdAt: createdAtFormatted,
    dob: dobFormatted,
    country: supplier.country || 'India'
  });

  // 4. Sync UI states (Validation rules and District lists)
  this.updateFormValidation();
  if (supplier.state) {
    this.filteredDistricts = this.stateDistricts[supplier.state] || [];
  }

  // 5. Patch remaining values including nested bank details
  this.supplierForm.patchValue({
    ...supplier,
    createdAt: createdAtFormatted,
    dob: dobFormatted,
    assignedTo: supplier.assignedTo,
    district: supplier.district || '',
    businessType: supplier.businessType || '',
    billingType: supplier.billingType || 'Prepaid',
    verificationStatus: supplier.verificationStatus || 'Not Verified',
    creditLimit: supplier.creditLimit || 0,
    bankDetails: {
      accountHolderName: supplier.bankDetails?.accountHolderName || '',
      accountNumber: supplier.bankDetails?.accountNumber || '',
      bankName: supplier.bankDetails?.bankName || '',
      bankBranchName: supplier.bankDetails?.bankBranchName || '',
      identificationCode: supplier.bankDetails?.identificationCode || '',
      swiftCode: supplier.bankDetails?.swiftCode || ''
    }
  });

  // 6. Automatically expand "More Information" if data exists in those fields
  if (
    supplier.taxNumber || 
    supplier.addressLine1 || 
    supplier.openingBalance || 
    supplier.bankDetails?.bankName ||
    supplier.bankDetails?.accountNumber
  ) {
    this.showMoreInfo = true;
  }

  // 7. Show the Modal and clear any lingering UI popups
  this.showForm = true;
  this.closeActionPopup();
  this.currentActionPopup = null;
}

  closePaymentForm(): void {
    this.showPaymentForm = false;
    this.paymentForm.reset({
      paymentMethod: 'Cash',
      paidDate: new Date().toISOString().slice(0, 16),
      amount: 0
    });
    this.currentPaymentSupplier = null;
  }

  getAssignedUserName(userId: string): string {
    if (!userId) return '';
    
    const user = this.assignedUsers.find(u => u.id === userId);
    return user ? user.username : userId;
  }

  async refreshSupplierPayments(): Promise<void> {
    this.isLoading = true;
    try {
      for (const supplier of this.suppliersList) {
        if (supplier.id) {
          await this.supplierService.syncSupplierPaymentData(supplier.id);
        }
      }
      this.loadSuppliers();
    } catch (error) {
      console.error('Error refreshing supplier payments:', error);
      this.isLoading = false;
    }
  }

  viewPurchaseData(supplier: Supplier): void {
    if (supplier.id) {
      this.router.navigate(['/purchase-data'], { 
        queryParams: { supplierId: supplier.id } 
      });
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
      this.selectedFileName = this.selectedFile.name;
    }
  }

  calculateRemainingBalance(amountPaid: number): number {
    if (!this.currentPaymentSupplier) return 0;
    
    const totalOwed = (this.paymentSummary.totalPurchase + this.paymentSummary.openingBalance) || 0;
    const alreadyPaid = this.paymentSummary.totalPaid || 0;
    const balanceDue = totalOwed - alreadyPaid;
    
    return Math.max(balanceDue - amountPaid, 0);
  }

  generateReferenceNumber(): string {
    return 'PAY-' + new Date().getTime().toString().slice(-6);
  }

  showSnackbar(message: string, type: 'success' | 'error'): void {
    const snackbar = document.createElement('div');
    snackbar.className = `snackbar ${type}`;
    snackbar.textContent = message;
    document.body.appendChild(snackbar);
    
    setTimeout(() => {
      snackbar.className += ' show';
    }, 100);
    
    setTimeout(() => {
      snackbar.className = snackbar.className.replace(' show', '');
      setTimeout(() => {
        document.body.removeChild(snackbar);
      }, 500);
    }, 3000);
  }

  loadPurchases(): void {
    if (this.currentPaymentSupplier?.id) {
      this.purchaseService.getPurchasesBySupplier(this.currentPaymentSupplier.id)
        .subscribe(purchases => {
          // Handle purchases if needed
        });
    }
  }

  async addPayment(supplier: Supplier): Promise<void> {
    this.currentPaymentSupplier = supplier;
    
    try {
      const purchases = await this.purchaseService.getPurchasesBySupplier(supplier.id || '').toPromise() || [];
      const totalPurchases = purchases.reduce((sum: number, purchase: any) => sum + (purchase?.grandTotal || 0), 0);
      
      const payments = await this.paymentService.getPaymentsBySupplier(supplier.id || '').toPromise() || [];
      const totalPaid = payments.reduce((sum: number, payment: any) => sum + (payment?.amount || 0), 0);
      
      const openingBalance = supplier.openingBalance || 0;
      const totalDue = Math.max(0, (totalPurchases + openingBalance) - totalPaid);
      
      this.paymentForm.patchValue({
        supplierName: supplier.businessName || `${supplier.firstName} ${supplier.lastName || ''}`.trim(),
        amount: totalDue,
        reference: this.generateReferenceNumber(),
        paidDate: new Date().toISOString().slice(0, 16)
      });
      
      this.paymentSummary = {
        totalPurchase: totalPurchases,
        totalPaid: totalPaid,
        totalPurchaseDue: Math.max(0, totalPurchases - totalPaid),
        openingBalance: openingBalance,
        openingBalanceDue: Math.max(0, openingBalance - (totalPaid > totalPurchases ? totalPaid - totalPurchases : 0))
      };
      
      this.showPaymentForm = true;
      await this.loadPaymentAccounts();
    } catch (error) {
      console.error('Error calculating payment details:', error);
      this.paymentForm.patchValue({
        supplierName: supplier.businessName || `${supplier.firstName} ${supplier.lastName || ''}`.trim(),
        amount: 0,
        reference: this.generateReferenceNumber(),
        paidDate: new Date().toISOString().slice(0, 16)
      });
      
      this.paymentSummary = {
        totalPurchase: 0,
        totalPaid: 0,
        totalPurchaseDue: 0,
        openingBalance: supplier.openingBalance || 0,
        openingBalanceDue: supplier.openingBalance || 0
      };
      
      this.showPaymentForm = true;
      await this.loadPaymentAccounts();
    }
  }

  viewPaymentHistory(supplier: Supplier): void {
    if (supplier.id) {
      this.router.navigate(['/suppliers', supplier.id, 'payments']);
    }
  }

  deleteSupplier(id?: string): void {
    if (!id) return;
    
    if (confirm('Are you sure you want to delete this supplier?')) {
      this.supplierService.deleteSupplier(id)
        .then(() => {
          this.loadSuppliers();
          alert('Supplier deleted successfully!');
        })
        .catch((error) => {
          console.error('Error deleting supplier: ', error);
          alert('Error deleting supplier. Please try again.');
        });
    }
    this.closeDropdown();
    this.dropdownOpen = false;
  }

  openPaymentForm() {
    this.showPaymentForm = true;
    this.isSubmitting = false;
  }

  generateContactId(): string {
    const existingIds = this.suppliersList
      .map(s => s.contactId || '')
      .filter(id => id.startsWith('SU'))
      .map(id => parseInt(id.substring(2), 10) || 0);
    
    const maxId = Math.max(0, ...existingIds);
    return `SU${String(maxId + 1).padStart(4, '0')}`;
  }

  exportCSV(): void {
    try {
      const csvData = this.filteredSuppliers.map(supplier => ({
        'Contact ID': supplier.contactId || '',
        'Name': supplier.isIndividual 
          ? `${supplier.prefix || ''} ${supplier.firstName || ''} ${supplier.middleName || ''} ${supplier.lastName || ''}`.trim() 
          : supplier.businessName || '',
        'Mobile': supplier.mobile || '',
        'Email': supplier.email || '',
        'Landline': supplier.landline || '',
        'Alternate Contact': supplier.alternateContact || '',
        'Tax Number': supplier.taxNumber || '',
        'Opening Balance': supplier.openingBalance || 0,
        'Purchase Due': supplier.purchaseDue || 0,
        'Purchase Return': supplier.purchaseReturn || 0,
        'Paid Amount': supplier.paymentAmount || 0,
        'Payment Due': supplier.paymentDue || 0,
        'Advance Balance': supplier.advanceBalance || 0,
        'Status': supplier.status || '',
        'Assigned To': supplier.assignedTo || '',
        'Address': `${supplier.addressLine1 || ''} ${supplier.addressLine2 || ''}`.trim(),
        'City': supplier.city || '',
        'State': supplier.state || '',
        'Country': supplier.country || '',
        'Zip Code': supplier.zipCode || '',
        'Bank Name': supplier.bankDetails?.bankName || '',
        'Branch Name': supplier.bankDetails?.bankBranchName || '',
        'ID Code': supplier.bankDetails?.identificationCode || '',
        'Swift Code': supplier.bankDetails?.swiftCode || ''
      }));
  
      let csvContent = "data:text/csv;charset=utf-8,";
      
      const headers = Object.keys(csvData[0]);
      csvContent += headers.join(",") + "\r\n";
      
      csvData.forEach(row => {
        const values = headers.map(header => {
          const value = row[header as keyof typeof row];
          return typeof value === 'string' && value.includes(',') 
            ? `"${value.replace(/"/g, '""')}"` 
            : value;
        });
        csvContent += values.join(",") + "\r\n";
      });
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `suppliers_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      
      link.click();
      
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('Error exporting CSV. Please try again.');
    }
  }
  
  exportExcel(): void {
    try {
      const excelData = this.filteredSuppliers.map(supplier => ({
        'Contact ID': supplier.contactId || '',
        'Name': supplier.isIndividual 
          ? `${supplier.prefix || ''} ${supplier.firstName || ''} ${supplier.middleName || ''} ${supplier.lastName || ''}`.trim() 
          : supplier.businessName || '',
        'Mobile': supplier.mobile || '',
        'Email': supplier.email || '',
        'Landline': supplier.landline || '',
        'Alternate Contact': supplier.alternateContact || '',
        'Tax Number': supplier.taxNumber || '',
        'Opening Balance': supplier.openingBalance || 0,
        'Purchase Due': supplier.purchaseDue || 0,
        'Paid Amount': `₹ ${supplier.paymentAmount || '0.00'}`,
        'Payment Due': `₹ ${supplier.paymentDue || '0.00'}`,
        'Purchase Return': supplier.purchaseReturn || 0,
        'Advance Balance': supplier.advanceBalance || 0,
        'Status': supplier.status || '',
        'Assigned To': supplier.assignedTo || '',
        'Address Line 1': supplier.addressLine1 || '',
        'Address Line 2': supplier.addressLine2 || '',
        'City': supplier.city || '',
        'State': supplier.state || '',
        'Country': supplier.country || '',
        'Zip Code': supplier.zipCode || '',
        'Bank Name': supplier.bankDetails?.bankName || '',
        'Branch Name': supplier.bankDetails?.bankBranchName || '',
        'ID Code': supplier.bankDetails?.identificationCode || '',
        'Swift Code': supplier.bankDetails?.swiftCode || ''
      }));
      
      const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(excelData);
      const wb: XLSX.WorkBook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Suppliers');
      
      XLSX.writeFile(wb, `suppliers_${new Date().toISOString().slice(0,10)}.xlsx`);
    } catch (error) {
      console.error('Error exporting Excel:', error);
      alert('Error exporting Excel. Please try again.');
    }
  }

  async payDue(supplier: Supplier): Promise<void> {
    this.currentPaymentSupplier = supplier;
    
    const paymentDue = await this.calculateSupplierPaymentDue(supplier.id || '');
    const openingBalance = supplier.openingBalance || 0;
    const totalDue = paymentDue + openingBalance;
    
    this.paymentForm.patchValue({
      supplierName: supplier.businessName || `${supplier.firstName} ${supplier.lastName || ''}`.trim(),
      amount: totalDue > 0 ? totalDue : 0,
      reference: this.generateReferenceNumber(),
      paidDate: new Date().toISOString().slice(0, 16)
    });
    
    this.paymentSummary = {
      totalPurchase: paymentDue + (supplier.paymentAmount || 0),
      totalPaid: supplier.paymentAmount || 0,
      totalPurchaseDue: paymentDue,
      openingBalance: openingBalance,
      openingBalanceDue: openingBalance
    };
    
    this.showPaymentForm = true;
    await this.loadPaymentAccounts();
  }

  loadPaymentAccounts(): void {
    this.paymentAccountsLoading = true;
    this.accountService.getAccounts((accounts: any[]) => {
      this.paymentAccounts = accounts;
      this.paymentAccountsLoading = false;
    });
  }

  receiveCash(supplier: Supplier): void {
    console.log('Receive Cash from supplier:', supplier);
    alert(`Receive Cash from ${supplier.businessName || supplier.firstName}`);
  }

  viewSupplier(supplier: Supplier): void {
    if (supplier.id) {
      this.router.navigate(['/supplier-view', supplier.id]);
    }
  }

  printSupplier(supplier: Supplier): void {
    console.log('Print supplier:', supplier);
    alert(`Printing details for ${supplier.businessName || supplier.firstName}`);
  }

  openLedger(supplier: Supplier): void {
    this.selectedSupplierForLedger = supplier;
    this.showLedgerView = true;
    if (supplier.id) {
      this.router.navigate(['/suppliers', supplier.id, 'ledger']);
    }
    
    this.purchaseService.getPurchasesBySupplier(supplier.id || '').subscribe((purchases: any[]) => {
      const totalPurchase = purchases.reduce((sum: any, purchase: { grandTotal: any; }) => sum + (purchase.grandTotal || 0), 0);
      const totalPaid = purchases.reduce((sum: any, purchase: { paymentAmount: any; }) => sum + (purchase.paymentAmount || 0), 0);
      
      this.paymentSummary = {
        totalPurchase,
        totalPaid,
        totalPurchaseDue: totalPurchase - totalPaid,
        openingBalance: supplier.openingBalance || 0,
        openingBalanceDue: supplier.openingBalance || 0
      };
    });
  }

  closeLedgerView(): void {
    this.showLedgerView = false;
    this.selectedSupplierForLedger = null;
  }

  openActionPopup(supplier: Supplier): void {
    this.currentActionPopup = supplier.id || null;
  }

  closeActionPopup(): void {
    this.currentActionPopup = null;
  }

  @HostListener('document:keydown.escape', ['$event'])
  onKeydownHandler(event: KeyboardEvent) {
    this.closeActionPopup();
  }

  viewPurchases(supplier: Supplier): void {
    if (supplier.id) {
      this.router.navigate(['/suppliers', supplier.id, 'purchases']);
    }
    this.dropdownOpen = false;
  }

  viewStockReport(supplier: Supplier): void {
    if (supplier.id) {
      this.router.navigate(['/suppliers', supplier.id, 'purchases'], { 
        queryParams: { tab: 'stock-report' } 
      });
    }
    this.dropdownOpen = false;
  }

  viewDocuments(supplier: Supplier): void {
    if (supplier.id) {
      this.router.navigate(['/suppliers', supplier.id, 'purchases'], { 
        queryParams: { tab: 'documents' } 
      });
    }
    this.dropdownOpen = false;
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.applyFilters();
  }

  exportPDF(): void {
    console.log('Exporting to PDF:', this.filteredSuppliers);
  }
}