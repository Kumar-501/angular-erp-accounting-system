import { CustomerService } from '../services/customer.service';
import { SupplierService } from '../services/supplier.service';
import { UserService } from '../services/user.service';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { Component, HostListener, Inject, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';

import 'jspdf-autotable';
import { LifeStageService } from '../services/life-stage.service';
import { LeadStatusService } from '../services/lead-status.service';
import { ActivatedRoute } from '@angular/router';
import { Subject, forkJoin, of } from 'rxjs';
import { takeUntil, catchError, finalize } from 'rxjs/operators';
import { AuthService } from '../auth.service';

import { Router } from '@angular/router'; // Import the Router


// File: src/app/customers/customers.component.ts

interface Customer {
  id?: string;
  contactId?: string;
  businessName?: string;
  firstName?: string;
  lastName?: string;
  occupation?: string;
  isIndividual?: boolean;
  department?: string;
  gender?: 'Male' | 'Female' | 'Other' | '';
  age?: number;
  email?: string;
  mobile?: string;
  landline?: string;
  alternateContact?: string;
  assignedTo?: string;
  taxNumber?: string;
  openingBalance?: number;
  saleDue?: number;
  saleReturn?: number;
  advanceBalance?: number;
  status?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
  district?: string;
  prefix?: string;
  middleName?: string;
  dob?: Date;
  payTerm?: number;
  contactType?: string;
  billingAddress?: string;
  shippingAddress?: string;
  createdAt?: Date;
  updatedAt?: Date;

  // ======================= THE FIX =======================
  // Corrected 'lifestage' to 'lifeStage' to match your data.
  // Added the missing 'leadStatus' property.
  lifeStage?: string; 
  leadStatus?: string; 
  adcode?: string; // Kept for any legacy data that might still use it.
  // ===================== END OF THE FIX ====================
  
  createdDate?: string;
  
  // Banking and Financial Fields
  billingType?: string;
  creditLimit?: number;
  accountHolderName?: string;
  bankAccountNumber?: string;
  bankName?: string;
  bankIdentifierCode?: string;
  branch?: string;
  swiftCode?: string;
}

@Component({
  selector: 'app-customers',
  templateUrl: './customers.component.html',
  styleUrls: ['./customers.component.scss']
})
export class CustomersComponent implements OnInit, OnDestroy {
[x: string]: any;
  private destroy$ = new Subject<void>();
  
  // Loading states
  isLoading = false;
    @ViewChild('startDatePicker') startDatePicker!: ElementRef;
  @ViewChild('endDatePicker') endDatePicker!: ElementRef;
  @ViewChild('dobPicker') dobPicker!: ElementRef;
  @ViewChild('formDatePicker') formDatePicker!: ElementRef;
  isInitialized = false;
  
  showForm = false;
  showMoreInfo = false;
  isIndividual = true;
  customerData: Partial<Customer> = {};
  lifestage?: string;
  adcode?: string;
  currentActionPopup: string | null = null;

  // Add view modal properties
  showViewModal = false;
  viewingCustomer: Customer | null = null;

  selectedCustomers: string[] = [];
  allSelected = false; 
  gender?: 'Male' | 'Female' | 'Other' | '';
  age?: number;
  currentUserName: string = '';

  // Data arrays
  adCodes: any[] = [];
  leadStatuses: any[] = [];
  lifeStages: any[] = [];
  customersList: Customer[] = [];
  filteredCustomers: Customer[] = [];
  assignedUsers: {id: string, username: string}[] = [];

  // States and districts
  states = ['Tamil Nadu', 'Kerala'];
  districts: string[] = [];
  tamilNaduDistricts = [
    'Ariyalur', 'Chengalpattu', 'Chennai', 'Coimbatore', 'Cuddalore', 
    'Dharmapuri', 'Dindigul', 'Erode', 'Kallakurichi', 'Kancheepuram', 
    'Karur', 'Krishnagiri', 'Madurai', 'Mayiladuthurai', 'Nagapattinam',
    'Namakkal', 'Nilgiris', 'Perambalur', 'Pudukkottai', 'Ramanathapuram',
    'Ranipet', 'Salem', 'Sivaganga', 'Tenkasi', 'Thanjavur', 
    'Theni', 'Thoothukudi', 'Tiruchirappalli', 'Tirunelveli', 'Tirupathur',
    'Tiruppur', 'Tiruvallur', 'Tiruvannamalai', 'Tiruvarur', 'Vellore',
    'Viluppuram', 'Virudhunagar'
  ];

  keralaDistricts = [
    'Alappuzha', 'Ernakulam', 'Idukki', 'Kannur', 'Kasaragod',
    'Kollam', 'Kottayam', 'Kozhikode', 'Malappuram', 'Palakkad',
    'Pathanamthitta', 'Thiruvananthapuram', 'Thrissur', 'Wayanad'
  ];

  isSaving = false;
  editingCustomerId: string | null = null;
  showFilterSidebar = false;
  popupPosition = { top: '0', left: '0' };

  // Column visibility
  showColumnVisibilityMenu = false;
  allColumns = [
    { name: 'Select', displayName: 'Select', visible: true },
    { name: 'Action', displayName: 'Action', visible: true },
    { name: 'Contact ID', displayName: 'Contact ID', visible: true },
    { name: 'District', displayName: 'District', visible: true },
    { name: 'Prefix', displayName: 'Prefix', visible: true },
    { name: 'First Name', displayName: 'First Name', visible: true },
    { name: 'Middle Name', displayName: 'Middle Name', visible: true },
    { name: 'Last Name', displayName: 'Last Name', visible: true },
    { name: 'Business Name', displayName: 'Business Name', visible: true },
    { name: 'Department', displayName: 'Department', visible: true },
    { name: 'Life Stage', displayName: 'Life Stage', visible: true },
    { name: 'Ad Code', displayName: 'Ad Code', visible: true },
    { name: 'Email', displayName: 'Email', visible: true },
    { name: 'Mobile', displayName: 'Mobile', visible: true },
    { name: 'Landline', displayName: 'Landline', visible: true },
    { name: 'Occupation', displayName: 'Occupation', visible: true },
    { name: 'Alternate Contact', displayName: 'Alternate Contact', visible: true },
    { name: 'Date of Birth', displayName: 'Date of Birth', visible: true },
    { name: 'Address Line 1', displayName: 'Address Line 1', visible: true },
    { name: 'Address Line 2', displayName: 'Address Line 2', visible: true },
    { name: 'State', displayName: 'State', visible: true },
    { name: 'Country', displayName: 'Country', visible: true },
    { name: 'Zip Code', displayName: 'Zip Code', visible: true },
    { name: 'Tax Number', displayName: 'Tax Number', visible: true },
    { name: 'Billing Type', displayName: 'Billing Type', visible: true },
    { name: 'Credit Limit', displayName: 'Credit Limit', visible: true },
    { name: 'Account Holder Name', displayName: 'Account Holder Name', visible: true },
    { name: 'Bank Account Number', displayName: 'Bank Account Number', visible: true },
    { name: 'Bank Name', displayName: 'Bank Name', visible: true },
    { name: 'Bank Identifier Code', displayName: 'Bank Identifier Code', visible: true },
    { name: 'Branch', displayName: 'Branch', visible: true },
    { name: 'Swift Code', displayName: 'Swift Code', visible: true },
    { name: 'Opening Balance', displayName: 'Opening Balance', visible: true },
    { name: 'Assigned To', displayName: 'Assigned To', visible: true },
    { name: 'Contact Type', displayName: 'Contact Type', visible: true },
    { name: 'Gender', displayName: 'Gender', visible: true },
    { name: 'Age', displayName: 'Age', visible: true },
    { name: 'Created Date', displayName: 'Created Date', visible: true }
  ];

  // Phone validation errors
  phoneErrors: {
    mobile: string;
    landline: string;
    alternateContact: string;
  } = {
    mobile: '',
    landline: '',
    alternateContact: ''
  };
  
  // Filter options with date range
  filterOptions = {
    saleDue: false,
    saleReturn: false,
    advanceBalance: false,
    openingBalance: false,
    assignedTo: '',
    status: '',
    state: '',
    department: '',
    lifeStage: '', // CORRECTED TO camelCase
    adcode: '',
    dateRange: '',
    customStartDate: '',
    customEndDate: ''
  };
  
  // Pagination
  entriesPerPage = 10;
  currentPage = 1;
  totalPages = 1;
  sortColumn = 'businessName';
  sortDirection = 'asc';
  searchTerm = '';

  constructor(
    private customerService: CustomerService,
    @Inject(SupplierService) private supplierService: SupplierService,
    private userService: UserService,
    private leadStatusService: LeadStatusService,
    private lifeStageService: LifeStageService,
        private authService: AuthService,

    private route: ActivatedRoute,
        private router: Router // Inject the Router

  ) {}

  ngOnInit(): void {
    this.initializeComponent();
        this.currentUserName = this.authService.getCurrentUserName() || 'User';

  }
openDatePicker(type: 'start' | 'end' | 'form' | 'dob'): void {
  if (type === 'start') {
    this.startDatePicker.nativeElement.showPicker();
  } else if (type === 'end') {
    this.endDatePicker.nativeElement.showPicker();
  } else if (type === 'form') {
    this.formDatePicker.nativeElement.showPicker();
  } else if (type === 'dob') {
    this.dobPicker.nativeElement.showPicker();
  }
}
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private async initializeComponent(): Promise<void> {
    if (this.isInitialized) return;
    
    this.isLoading = true;
    
    try {
      // Load saved column preferences first
      this.loadColumnPreferences();
      
      // Load all data concurrently with proper error handling
      await this.loadAllData();
      
      this.isInitialized = true;
    } catch (error) {
      console.error('Error initializing component:', error);
      // Set defaults even if some data fails to load
      this.setDefaults();
    } finally {
      this.isLoading = false;
    }
  }
   getFormattedDateForInput(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  }


onDobChange(event: any): void {
  const dateValue = event.target.value;
  if (dateValue) {
    this.customerData.dob = new Date(dateValue);
  } else {
    this.customerData.dob = undefined;
  }
}
onManualDateInput(event: any, type: 'start' | 'end' | 'form' | 'dob'): void {
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
      
      const formattedDate = `${year}-${month}-${day}`;
      if (type === 'start') {
        this.filterOptions.customStartDate = formattedDate;
        this.applyFilters();
      } else if (type === 'end') {
        this.filterOptions.customEndDate = formattedDate;
        this.applyFilters();
      } else if (type === 'form') {
        this.customerData.createdDate = formattedDate;
        this.customerData.createdAt = dateObj;
      } else if (type === 'dob') {
        this.customerData.dob = dateObj; // Sets the actual Date object
      }
    } else {
      alert('Invalid date! Please enter a valid date in DD-MM-YYYY format.');
      // Reset to previous value
      const prevValue = type === 'dob' ? this.getFormattedDate(this.customerData.dob) : '';
      event.target.value = this.getFormattedDateForInput(prevValue);
    }
  }
}


  private loadColumnPreferences(): void {
    try {
      const savedColumns = localStorage.getItem('customerColumnsVisibility');
      if (savedColumns) {
        this.allColumns = JSON.parse(savedColumns);
      }
    } catch (error) {
      console.warn('Error loading column preferences:', error);
    }
  }
  /**
   * Navigates to the detailed contact view page for the selected customer.
   * @param customer The customer to view.
   */
  viewContactPage(customer: Customer): void {
    if (customer && customer.id) {
      this.closeActionPopup(); // Close the menu
      this.router.navigate(['/view-contact', customer.id]);
    } else {
      console.error('Cannot view contact: Customer or Customer ID is missing.');
    }
  }  viewCustomer(customer: Customer): void {
    this.viewingCustomer = { ...customer };
    this.showViewModal = true;
    this.closeActionPopup();
  }

  private async loadAllData(): Promise<void> {
    const loadOperations = [
      this.loadCustomersData(),
      this.loadLeadStatusesData(),
      this.loadLifeStagesData(),
      this.loadAssignedUsersData()
    ];

    try {
      await Promise.all(loadOperations);
    } catch (error) {
      console.error('Error loading some data:', error);
      // Continue with partial data
    }
  }
private loadCustomersData(): Promise<void> {
  return new Promise((resolve, reject) => {
    this.customerService.getCustomers()
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Error loading customers:', error);
          return of([]);
        })
      )
      .subscribe({
        next: (customers: Customer[]) => {
          // Convert createdAt strings to Date objects for all customers
          this.customersList = (customers || []).map(customer => ({
            ...customer,
            createdAt: customer.createdAt ? this.convertToDate(customer.createdAt) : new Date()
          }));
          this.applyFilters();
          resolve();
        },
        error: (error) => {
          console.error('Error in customer subscription:', error);
          this.customersList = [];
          this.applyFilters();
          reject(error);
        }
      });
  });
}

// Helper method to convert various date formats to Date object
private convertToDate(dateValue: any): Date {
  if (dateValue instanceof Date) {
    return dateValue;
  }
  
  if (typeof dateValue === 'string') {
    // Handle ISO string or datetime-local string
    if (dateValue.includes('T')) {
      return new Date(dateValue);
    }
    // Handle other string formats if needed
  }
  
  if (dateValue?.seconds) {
    // Handle Firebase Timestamp
    return new Date(dateValue.seconds * 1000);
  }
  
  return new Date(dateValue);
}
  private loadLeadStatusesData(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.leadStatusService.getLeadStatuses()
        .pipe(
          takeUntil(this.destroy$),
          catchError(error => {
            console.error('Error loading lead statuses:', error);
            return of([]);
          })
        )
        .subscribe({
          next: (statuses) => {
            this.leadStatuses = statuses || [];
            resolve();
          },
          error: (error) => {
            console.error('Error in lead status subscription:', error);
            this.leadStatuses = [];
            reject(error);
          }
        });
    });
  }

  private loadLifeStagesData(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.lifeStageService.getLifeStages()
        .then(stages => {
          this.lifeStages = stages || [];
          resolve();
        })
        .catch(error => {
          console.error('Error loading life stages:', error);
          this.lifeStages = [];
          reject(error);
        });
    });
  }

  private loadAssignedUsersData(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.userService.getUsers()
        .pipe(
          takeUntil(this.destroy$),
          catchError(error => {
            console.error('Error loading users:', error);
            return of([]);
          })
        )
        .subscribe({
          next: (users) => {
            this.assignedUsers = (users || []).map(user => ({
              id: user.id,
              username: user.username || user.displayName || user.email?.split('@')[0] || 'Unknown'
            }));
            resolve();
          },
          error: (error) => {
            console.error('Error in users subscription:', error);
            this.assignedUsers = [];
            reject(error);
          }
        });
    });
  }

  private setDefaults(): void {
    if (!this.customersList) this.customersList = [];
    if (!this.leadStatuses) this.leadStatuses = [];
    if (!this.lifeStages) this.lifeStages = [];
    if (!this.assignedUsers) this.assignedUsers = [];
    this.applyFilters();
  }

  // Keep the old method name for backward compatibility
  loadCustomers(): void {
    this.loadCustomersData();
  }

  // Force reload method for external calls
  public forceReload(): void {
    this.isInitialized = false;
    this.initializeComponent();
  }

  // Date Range Filter Methods
  onDateRangeChange(): void {
    if (this.filterOptions.dateRange !== 'custom') {
      // Clear custom dates when not using custom range
      this.filterOptions.customStartDate = '';
      this.filterOptions.customEndDate = '';
    }
    this.applyFilters();
  }

  getSelectedDateRangeText(): string {
    if (!this.filterOptions.dateRange) return '';

    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    switch (this.filterOptions.dateRange) {
      case 'today':
        return `Today (${this.formatDate(today)})`;
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return `Yesterday (${this.formatDate(yesterday)})`;
      case 'last7days':
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return `Last 7 Days (${this.formatDate(sevenDaysAgo)} - ${this.formatDate(today)})`;
      case 'last30days':
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return `Last 30 Days (${this.formatDate(thirtyDaysAgo)} - ${this.formatDate(today)})`;
      case 'lastMonth':
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
        return `Last Month (${this.formatDate(lastMonth)} - ${this.formatDate(lastMonthEnd)})`;
      case 'thisMonth':
        const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        return `This Month (${this.formatDate(thisMonthStart)} - ${this.formatDate(today)})`;
      case 'thisFinancialYear':
        const fyStart = this.getFinancialYearStart(today);
        return `This Financial Year (${this.formatDate(fyStart)} - ${this.formatDate(today)})`;
      case 'lastFinancialYear':
        const lastFyStart = this.getFinancialYearStart(today, -1);
        const lastFyEnd = new Date(lastFyStart);
        lastFyEnd.setFullYear(lastFyEnd.getFullYear() + 1);
        lastFyEnd.setDate(lastFyEnd.getDate() - 1);
        return `Last Financial Year (${this.formatDate(lastFyStart)} - ${this.formatDate(lastFyEnd)})`;
      case 'custom':
        if (this.filterOptions.customStartDate && this.filterOptions.customEndDate) {
          return `Custom Range (${this.filterOptions.customStartDate} - ${this.filterOptions.customEndDate})`;
        }
        return 'Custom Range';
      default:
        return '';
    }
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  private getFinancialYearStart(date: Date, offset: number = 0): Date {
    // Assuming financial year starts April 1st
    const year = date.getFullYear() + offset;
    const fyStart = new Date(year, 3, 1); // April 1st
    
    // If current date is before April 1st, financial year started previous year
    if (date.getMonth() < 3) {
      fyStart.setFullYear(year - 1);
    }
    
    return fyStart;
  }

  private isDateInRange(customerDate: Date | undefined, rangeType: string): boolean {
    if (!customerDate) return false;
    
    const date = new Date(customerDate);
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1);
    
    switch (rangeType) {
      case 'today':
        return date >= startOfToday && date < endOfToday;
        
      case 'yesterday':
        const startOfYesterday = new Date(startOfToday);
        startOfYesterday.setDate(startOfYesterday.getDate() - 1);
        return date >= startOfYesterday && date < startOfToday;
        
      case 'last7days':
        const sevenDaysAgo = new Date(startOfToday);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return date >= sevenDaysAgo && date < endOfToday;
        
      case 'last30days':
        const thirtyDaysAgo = new Date(startOfToday);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return date >= thirtyDaysAgo && date < endOfToday;
        
      case 'lastMonth':
        const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
        const endOfLastMonth = new Date(lastMonthEnd);
        endOfLastMonth.setDate(endOfLastMonth.getDate() + 1);
        return date >= lastMonthStart && date < endOfLastMonth;
        
      case 'thisMonth':
        const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        return date >= thisMonthStart && date < endOfToday;
        
      case 'thisFinancialYear':
        const fyStart = this.getFinancialYearStart(today);
        return date >= fyStart && date < endOfToday;
        
      case 'lastFinancialYear':
        const lastFyStart = this.getFinancialYearStart(today, -1);
        const lastFyEnd = new Date(lastFyStart);
        lastFyEnd.setFullYear(lastFyEnd.getFullYear() + 1);
        return date >= lastFyStart && date < lastFyEnd;
        
      case 'custom':
        if (this.filterOptions.customStartDate && this.filterOptions.customEndDate) {
          const startDate = new Date(this.filterOptions.customStartDate);
          const endDate = new Date(this.filterOptions.customEndDate);
          endDate.setDate(endDate.getDate() + 1); // Include end date
          return date >= startDate && date < endDate;
        }
        return true;
        
      default:
        return true;
    }
  }

  // Format created date for display
  formatCreatedDate(date: Date | undefined): string {
    if (!date) return '';
    
    try {
      const dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) return '';
      
      return dateObj.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return '';
    }
  }

  // Get visible column count for colspan
  getVisibleColumnCount(): number {
    return this.allColumns.filter(col => col.visible).length;
  }

// In your component class (customers.component.ts)
public getFormattedDate(date: Date | undefined): string {
  if (!date) return '';
  
  try {
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) return '';
    
    return dateObj.toISOString().split('T')[0];
  } catch (error) {
    console.error('Error formatting date for input:', error);
    return '';
  }
}

  onCreatedDateChange(event: any): void {
    const dateValue = event.target.value;
    if (dateValue) {
      // Convert the date string to a Date object
      this.customerData.createdAt = new Date(dateValue);
    } else {
      this.customerData.createdAt = undefined;
    }
  }


  closeViewModal(): void {
    this.showViewModal = false;
    this.viewingCustomer = null;
  }

  getCustomerDisplayName(customer: Customer): string {
    if (customer.isIndividual) {
      const parts = [customer.prefix, customer.firstName, customer.middleName, customer.lastName].filter(Boolean);
      return parts.join(' ') || 'N/A';
    } else {
      return customer.businessName || 'N/A';
    }
  }

  getFullAddress(customer: Customer): string {
    const addressParts = [
      customer.addressLine1,
      customer.addressLine2,
      customer.city,
      customer.district,
      customer.state,
      customer.country,
      customer.zipCode
    ].filter(Boolean);
    
    return addressParts.length > 0 ? addressParts.join(', ') : 'N/A';
  }

  // Existing methods with improved error handling
  toggleSelectAll(): void {
    this.allSelected = !this.allSelected;
    if (this.allSelected) {
      this.selectedCustomers = this.paginatedCustomers.map(c => c.id || '').filter(id => id);
    } else {
      this.selectedCustomers = [];
    }
  }

  getAdCodeDisplay(adcode: any): string {
    if (!adcode) return '';
    return typeof adcode === 'object' ? adcode.name : adcode;
  }

  onStateChange(): void {
    if (this.customerData.state === 'Tamil Nadu') {
      this.districts = [...this.tamilNaduDistricts];
    } else if (this.customerData.state === 'Kerala') {
      this.districts = [...this.keralaDistricts];
    } else {
      this.districts = [];
      this.customerData.district = '';
    }
  }

  toggleCustomerSelection(customerId: string): void {
    if (!customerId) return;
    
    const index = this.selectedCustomers.indexOf(customerId);
    if (index === -1) {
      this.selectedCustomers.push(customerId);
    } else {
      this.selectedCustomers.splice(index, 1);
    }
    this.allSelected = this.selectedCustomers.length === this.paginatedCustomers.length;
  }

  isCustomerSelected(customerId: string): boolean {
    return customerId ? this.selectedCustomers.includes(customerId) : false;
  }

  async deleteSelectedCustomers(): Promise<void> {
    if (this.selectedCustomers.length === 0) {
      alert('Please select at least one customer to delete');
      return;
    }

    if (confirm(`Are you sure you want to delete ${this.selectedCustomers.length} selected customers?`)) {
      try {
        await this.customerService.bulkDeleteCustomers(this.selectedCustomers);
        await this.loadCustomersData();
        this.selectedCustomers = [];
        this.allSelected = false;
        alert(`${this.selectedCustomers.length} customers deleted successfully!`);
      } catch (error) {
        console.error('Error deleting customers:', error);
        alert('Error deleting customers. Please try again.');
      }
    }
  }

  openActionPopup(customer: Customer): void {
    this.currentActionPopup = customer.id || null;
  }

  closeActionPopup(): void {
    this.currentActionPopup = null;
  }

updateCustomerStatus(customer: Customer, status: 'Active' | 'Inactive'): void {
    if (!customer.id) return;
    
    // Pass the current user's name here too
    this.customerService.updateCustomer(customer.id, { status }, this.currentUserName)
      .then(() => {
        customer.status = status;
      })
      .catch(error => {
        console.error('Error updating status:', error);
      });
  }



  getLeadStatusText(adcodeId: string): string {
    if (!adcodeId || !this.leadStatuses) return '';
    const foundStatus = this.leadStatuses.find(status => status.id === adcodeId);
    return foundStatus ? foundStatus.leadStatus : '';
  }

  @HostListener('document:keydown.escape', ['$event'])
  onKeydownHandler(event: KeyboardEvent) {
    this.closeActionPopup();
    this.closeViewModal();
  }

  getAdCodeName(adcodeId: string | undefined): string {
    if (!adcodeId || !this.leadStatuses) return '';
    const status = this.leadStatuses.find(s => s.id === adcodeId);
    return status ? `${status.leadStatus} (${status.id})` : '';
  }

  toggleFilterSidebar(): void {
    this.showFilterSidebar = !this.showFilterSidebar;
  }

  // Improved applyFilters method with date range functionality
  applyFilters(): void {
    if (!this.customersList) {
      this.filteredCustomers = [];
      this.updatePagination();
      return;
    }

    let filtered = [...this.customersList];

    // Search filter - case insensitive and comprehensive
    if (this.searchTerm?.trim()) {
      const term = this.searchTerm.toLowerCase().trim();
      filtered = filtered.filter(customer => 
        this.searchInAllFields(customer, term)
      );
    }

    // Date Range filter
    if (this.filterOptions.dateRange) {
      filtered = filtered.filter(customer => 
        this.isDateInRange(customer.createdAt, this.filterOptions.dateRange)
      );
    }

    // Status filter
    if (this.filterOptions.status) {
      filtered = filtered.filter(customer => 
        customer.status === this.filterOptions.status
      );
    }

    // Assigned To filter
    if (this.filterOptions.assignedTo) {
      filtered = filtered.filter(customer => 
        customer.assignedTo === this.filterOptions.assignedTo
      );
    }

    // State filter
    if (this.filterOptions.state) {
      filtered = filtered.filter(customer => 
        customer.state === this.filterOptions.state
      );
    }

    // Department filter
    if (this.filterOptions.department) {
      filtered = filtered.filter(customer => 
        customer.department === this.filterOptions.department
      );
    }

    // Life Stage filter
 if (this.filterOptions.lifeStage) { // CORRECTED TO camelCase
      filtered = filtered.filter(customer => 
        customer.lifeStage === this.filterOptions.lifeStage // CORRECTED TO camelCase
      );
    }

    // Ad Code filter
    if (this.filterOptions.adcode) {
      filtered = filtered.filter(customer => 
        customer.adcode === this.filterOptions.adcode
      );
    }

    // Financial filters
    if (this.filterOptions.saleDue) {
      filtered = filtered.filter(customer => 
        customer.saleDue && customer.saleDue > 0
      );
    }

    if (this.filterOptions.saleReturn) {
      filtered = filtered.filter(customer => 
        customer.saleReturn && customer.saleReturn > 0
      );
    }

    if (this.filterOptions.advanceBalance) {
      filtered = filtered.filter(customer => 
        customer.advanceBalance && customer.advanceBalance > 0
      );
    }

    if (this.filterOptions.openingBalance) {
      filtered = filtered.filter(customer => 
        customer.openingBalance && customer.openingBalance > 0
      );
    }

    // Apply sorting
    filtered = this.applySorting(filtered);

    this.filteredCustomers = filtered;
    this.updatePagination();
  }

  private searchInAllFields(customer: Customer, term: string): boolean {
    if (!customer || !term) return true;

    const fieldsToSearch = [
      customer.contactId,
      customer.firstName,
      customer.middleName, 
      customer.lastName,
      customer.businessName,
      customer.email,
      customer.mobile,
      customer.landline,
      customer.alternateContact,
      customer.occupation,
      customer.department,
      customer.addressLine1,
      customer.addressLine2,
      customer.city,
      customer.district,
      customer.state,
      customer.country,
      customer.zipCode,
      customer.taxNumber,
      customer.assignedTo,
 customer.lifeStage,
      customer.gender,
      customer.prefix,
      customer.contactType,
      customer.billingType,
      customer.accountHolderName,
      customer.bankName,
      customer.bankIdentifierCode,
      customer.branch,
      customer.swiftCode
    ];

    // Check individual fields
    const fieldMatch = fieldsToSearch.some(field => 
      field?.toString().toLowerCase().includes(term)
    );

    if (fieldMatch) return true;

    // Check combined fields
    const fullName = `${customer.firstName || ''} ${customer.middleName || ''} ${customer.lastName || ''}`.toLowerCase().trim();
    if (fullName.includes(term)) return true;

    const fullAddress = `${customer.addressLine1 || ''} ${customer.addressLine2 || ''} ${customer.city || ''} ${customer.district || ''} ${customer.state || ''} ${customer.country || ''} ${customer.zipCode || ''}`.toLowerCase().trim();
    if (fullAddress.includes(term)) return true;

    // Check Ad Code text
    const adCodeText = this.getLeadStatusText(customer.adcode || '').toLowerCase();
    if (adCodeText.includes(term)) return true;

    return false;
  }

  private applySorting(data: Customer[]): Customer[] {
    if (!this.sortColumn || !data.length) return data;

    return data.sort((a, b) => {
      const aValue = this.getSortValue(a, this.sortColumn);
      const bValue = this.getSortValue(b, this.sortColumn);

      let comparison = 0;
      
      if (aValue < bValue) comparison = -1;
      else if (aValue > bValue) comparison = 1;
      
      return this.sortDirection === 'desc' ? -comparison : comparison;
    });
  }

  private getSortValue(customer: Customer, column: string): any {
    const value = customer[column as keyof Customer];
    if (value === null || value === undefined) return '';
    return value;
  }

  private updatePagination(): void {
    this.totalPages = Math.ceil((this.filteredCustomers?.length || 0) / this.entriesPerPage);
    this.currentPage = Math.min(this.currentPage, Math.max(1, this.totalPages));
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.applyFilters();
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.filterOptions = {
      saleDue: false,
      saleReturn: false,
      advanceBalance: false,
      openingBalance: false,
      assignedTo: '',
      status: '',
      state: '',
      lifeStage: '', // CORRECTED TO camelCase
      adcode: '',
      department: '',
      dateRange: '',
      customStartDate: '',
      customEndDate: ''
    };
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

  get paginatedCustomers(): Customer[] {
    if (!this.filteredCustomers?.length) return [];
    
    const start = (this.currentPage - 1) * this.entriesPerPage;
    const end = start + this.entriesPerPage;
    return this.filteredCustomers.slice(start, end);
  }

  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  getPaginationRange(): number[] {
    const range: number[] = [];
    const rangeSize = 3;
    
    let start = Math.max(2, this.currentPage - Math.floor(rangeSize / 2));
    let end = Math.min(this.totalPages - 1, start + rangeSize - 1);
    
    if (end === this.totalPages - 1) {
      start = Math.max(2, end - rangeSize + 1);
    }
    
    for (let i = start; i <= end; i++) {
      range.push(i);
    }
    
    return range;
  }

  get Math() {
    return Math;
  }

  toggleForm(): void {
    this.showForm = !this.showForm;
    if (this.showForm && !this.editingCustomerId) {
      this.customerData = {
        contactId: this.generateContactId(),
        contactType: 'Customer',
        payTerm: 0,
        status: 'Active',
        createdAt: new Date(), // Set default created date to today
        createdDate: new Date().toISOString().split('T')[0] // Initialize with current date
      };
    }
    if (!this.showForm) {
      this.resetForm();
    }
  }

  resetForm(): void {
    this.customerData = {};
    this.editingCustomerId = null;
    this.showMoreInfo = false;
    this.isIndividual = true;
    
    this.phoneErrors = {
      mobile: '',
      landline: '',
      alternateContact: ''
    };
  }

  toggleMoreInfo(): void {
    this.showMoreInfo = !this.showMoreInfo;
  }

  onContactTypeChange(): void {
    const contactType = this.customerData.contactType;
    const isIndividualValue = this.isIndividual;
    const createdAt = this.customerData.createdAt;
    
    const preservedFields = {
      firstName: this.customerData.firstName,
      lastName: this.customerData.lastName,
      businessName: this.customerData.businessName,
      mobile: this.customerData.mobile,
      email: this.customerData.email
    };
    
    this.customerData = { 
      contactType,
      createdAt,
      ...preservedFields,
      contactId: this.generateContactId()
    };
    
    this.isIndividual = isIndividualValue;
  }

  toggleColumnVisibilityMenu(): void {
    this.showColumnVisibilityMenu = !this.showColumnVisibilityMenu;
  }

  isColumnVisible(columnName: string): boolean {
    const column = this.allColumns.find(c => c.displayName === columnName);
    return column ? column.visible : true;
  }

  updateVisibleColumns(): void {
    try {
      localStorage.setItem('customerColumnsVisibility', JSON.stringify(this.allColumns));
    } catch (error) {
      console.warn('Error saving column preferences:', error);
    }
  }

  get visibleColumns(): any[] {
    return this.allColumns.filter(column => column.visible);
  }


  cleanPhoneNumber(phone: string): string {
    return phone?.replace(/\D/g, '') || '';
  }
// Helper to get only digits (removes spaces)
private getDigitsOnly(value: any): string {
  if (!value) return '';
  return String(value).replace(/\s+/g, '');
}

// Logic to block alphabets and cap input at exactly 12 digits (ignoring spaces)
onPhoneNumberInput(event: any, field: string): void {
  const input = event.target;
  // 1. Remove everything except numbers and spaces
  let val = input.value.replace(/[^0-9 ]/g, ''); 
  
  let digitCount = 0;
  let limitedValue = '';

  // 2. Build the string character by character until 12 digits are reached
  for (let char of val) {
    if (/[0-9]/.test(char)) {
      if (digitCount < 12) {
        digitCount++;
        limitedValue += char;
      }
    } else if (char === ' ') {
      // Always allow spaces, they don't count towards the 12
      limitedValue += char;
    }
  }

  // 3. Manually update the data model and the input display
  (this.customerData as any)[field] = limitedValue;
  input.value = limitedValue;
  
  // 4. Trigger validation for the red error messages
  this.validatePhoneNumber(field);
}

// Simplified validation check
validatePhoneNumber(field: string): void {
  const value = (this.customerData as any)[field] || '';
  const digits = this.getDigitsOnly(value);
  
  if (digits.length > 0 && (digits.length < 10 || digits.length > 12)) {
    this.phoneErrors[field as keyof typeof this.phoneErrors] = 'Must be 10-12 digits';
  } else {
    this.phoneErrors[field as keyof typeof this.phoneErrors] = '';
  }
}
async saveCustomer(): Promise<void> {
    // Prevent multiple clicks
    if (this.isSaving) return;

    // 1. Clean Phone Numbers (Strip spaces for storage and accurate length validation)
    const mobileClean = this.getDigitsOnly(this.customerData.mobile);
    const landlineClean = this.getDigitsOnly(this.customerData.landline);
    const alternateClean = this.getDigitsOnly(this.customerData.alternateContact);

    // 2. Perform Logical Validations
    if (this.isIndividual && !this.customerData.firstName) {
      alert('First Name is required for individuals');
      return;
    }

    if (!this.isIndividual && !this.customerData.businessName) {
      alert('Business Name is required for businesses');
      return;
    }

    if (this.customerData.age && (this.customerData.age < 0 || this.customerData.age > 120)) {
      alert('Age must be between 0 and 120');
      return;
    }

    // Mobile Validation (Required + 10-12 digits)
    if (!mobileClean || mobileClean.length < 10 || mobileClean.length > 12) {
      alert('Mobile number must be between 10 to 12 digits');
      return;
    }

    // Landline Validation (Optional, but if exists must be 10-12 digits)
    if (landlineClean && (landlineClean.length < 10 || landlineClean.length > 12)) {
      alert('Landline number must be between 10 to 12 digits');
      return;
    }

    // Alternate Contact Validation (Optional, but if exists must be 10-12 digits)
    if (alternateClean && (alternateClean.length < 10 || alternateClean.length > 12)) {
      alert('Alternate contact number must be between 10 to 12 digits');
      return;
    }

    // 3. Start Saving Process
    this.isSaving = true;

    try {
      this.customerData.isIndividual = this.isIndividual;
      
      // Store cleaned digits only in the database
      this.customerData.mobile = mobileClean;
      this.customerData.landline = landlineClean;
      this.customerData.alternateContact = alternateClean;

      // Handle Life Stage default
      if (!this.customerData.lifeStage && this.lifeStages.length > 0) {
        this.customerData.lifeStage = this.lifeStages[0].name;
      }

      // Date Handling
      const now = new Date();
      if (this.customerData.createdDate) {
        this.customerData.createdAt = new Date(this.customerData.createdDate);
      } else if (!this.customerData.createdAt) {
        this.customerData.createdAt = now;
      }
      this.customerData.updatedAt = now;

      // Status Handling
      if (!this.customerData.status) {
        this.customerData.status = 'Active';
      }

      // 4. Persistence
      if (this.editingCustomerId) {
        await this.updateExistingCustomer();
      } else {
        await this.addNewCustomer();
      }

    } catch (error) {
      console.error('Error saving customer:', error);
      alert('Error saving customer. Please try again.');
    } finally {
      this.isSaving = false;
    }
  }

  async addNewCustomer(): Promise<void> {
    try {
      if (!this.customerData.contactId) {
        this.customerData.contactId = this.generateContactId();
      }
      
      this.customerData.isIndividual = this.isIndividual;
      
      if (this.customerData.contactType === 'Customer' || this.customerData.contactType === 'Both') {
        await this.customerService.addCustomer(this.customerData as Customer);
        
        if (this.customerData.contactType !== 'Both') {
          this.toggleForm();
          await this.loadCustomersData();
          alert('Customer added successfully!');
        }
      }
      
      if (this.customerData.contactType === 'Supplier' || this.customerData.contactType === 'Both') {
        await this.supplierService.addSupplier(this.customerData as any);
        
        this.toggleForm();
        await this.loadCustomersData();
        alert(`${this.customerData.contactType === 'Both' ? 'Contact' : 'Supplier'} added successfully!`);
      }
    } catch (error) {
      console.error('Error adding customer: ', error);
      alert('Error adding customer. Please try again.');
      throw error;
    }
  }

  async updateExistingCustomer(): Promise<void> {
    if (!this.editingCustomerId) return;

    try {
      this.customerData.isIndividual = this.isIndividual;
      const updatedBy = this.currentUserName; // Get the logged-in user's name

      if (this.customerData.contactType === 'Customer' || this.customerData.contactType === 'Both') {
        // Pass the user's name to the update function
        await this.customerService.updateCustomer(this.editingCustomerId, this.customerData as Customer, updatedBy);
        
        if (this.customerData.contactType !== 'Both') {
          this.toggleForm();
          await this.loadCustomersData();
          alert('Customer updated successfully!');
        }
      }
      
      if (this.customerData.contactType === 'Supplier' || this.customerData.contactType === 'Both') {
        await this.supplierService.updateSupplier(this.editingCustomerId, this.customerData as any);
        
        this.toggleForm();
        await this.loadCustomersData();
        alert(`${this.customerData.contactType === 'Both' ? 'Contact' : 'Supplier'} updated successfully!`);
      }
    } catch (error) {
      console.error('Error updating customer: ', error);
      alert('Error updating customer. Please try again.');
      throw error;
    }
  }


  editCustomer(customer: Customer): void {
  this.customerData = JSON.parse(JSON.stringify(customer));
    this.editingCustomerId = customer.id || null;
    
    this.isIndividual = customer.isIndividual !== undefined ? customer.isIndividual : true;
    
    this.showForm = true;
    
    this.phoneErrors = {
      mobile: '',
      landline: '',
      alternateContact: ''
    };
    
    if (customer.taxNumber || customer.addressLine1 || customer.openingBalance) {
      this.showMoreInfo = true;
    }
     if (customer.createdAt) {
    this.customerData.createdDate = this.getFormattedDate(customer.createdAt);
  } else {
    this.customerData.createdDate = '';
  }
   if (!this.customerData.lifeStage && this.lifeStages.length > 0) { // CORRECTED TO camelCase
      this.customerData.lifeStage = this.lifeStages[0].name; // CORRECTED TO camelCase
    }
  }

  deleteCustomer(id?: string): void {
    if (!id) return;
    
    if (confirm('Are you sure you want to delete this customer?')) {
      this.customerService.deleteCustomer(id)
        .then(async () => {
          await this.loadCustomersData();
          alert('Customer deleted successfully!');
        })
        .catch((error) => {
          console.error('Error deleting customer: ', error);
          alert('Error deleting customer. Please try again.');
        });
    }
  }

  generateContactId(): string {
    const existingIds = this.customersList
      .map(c => c.contactId || '')
      .filter(id => id.startsWith('CO'))
      .map(id => parseInt(id.substring(2), 10) || 0);
  
    const maxId = Math.max(0, ...existingIds);
    return `CO${String(maxId + 1).padStart(4, '0')}`;
  }

  exportCSV(): void {
    if (!this.filteredCustomers?.length) {
      alert('No data to export');
      return;
    }

    try {
      const headers = Object.keys(this.filteredCustomers[0]).filter(key => key !== 'id');
      const csvRows = [];
      
      csvRows.push(headers.join(','));
      
      this.filteredCustomers.forEach(customer => {
        const values = headers.map(header => {
          const value = customer[header as keyof Customer];
          if (value === null || value === undefined) return '';
          if (value instanceof Date) return value.toISOString();
          if (typeof value === 'string') return `"${value.replace(/"/g, '""')}"`;
          return value;
        });
        csvRows.push(values.join(','));
      });

      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `customers_${new Date().toISOString().slice(0,10)}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('Error exporting CSV. Please try again.');
    }
  }

  exportExcel(): void {
    if (!this.filteredCustomers?.length) {
      alert('No data to export');
      return;
    }

    try {
      const worksheet = XLSX.utils.json_to_sheet(this.filteredCustomers.map(customer => {
        const flatCustomer: any = {};
        Object.keys(customer).forEach(key => {
          if (key !== 'id') {
            const value = customer[key as keyof Customer];
            flatCustomer[key] = value instanceof Date ? value.toISOString() : value;
          }
        });
        return flatCustomer;
      }));
      
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Customers');
      
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `customers_${new Date().toISOString().slice(0,10)}.xlsx`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
    } catch (error) {
      console.error('Error exporting Excel:', error);
      alert('Error exporting Excel. Please try again.');
    }
  }

  exportPDF(): void {
    console.log('Exporting to PDF:', this.filteredCustomers);
    // Implement PDF export logic here
  }
}