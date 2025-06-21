import { Component, OnInit } from '@angular/core';
import { SupplierService } from '../services/supplier.service';
import { CustomerService } from '../services/customer.service';
import { UserService } from '../services/user.service';
import { Purchase, PurchaseService } from '../services/purchase.service'; // Add PurchaseService import
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { PaymentService } from '../services/payment.service';
import { collection, getDoc, getDocs, or, query, where } from 'firebase/firestore';import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';

import 'jspdf-autotable';
import { Router } from '@angular/router';

import { LocationService } from '../services/location.service';
import { AccountService } from '../services/account.service';
import { HostListener } from '@angular/core';
import { Input } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';

interface Supplier {
  id?: string;
    totalPurchases?: number;

  paymentAmount?: number; // Add this property

  contactId?: string;
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
  status?: 'Active' | 'Inactive'; // Add this line
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
  payTerm?: number;
  contactType?: string;
  address:string;
}

import { ViewChild, ElementRef, Renderer2 } from '@angular/core';

@Component({
  selector: 'app-suppliers',
  templateUrl: './suppliers.component.html',
  styleUrls: ['./suppliers.component.scss']
})
export class SuppliersComponent implements OnInit {
payCash: any;
handleAction(arg0: string,_t151: Supplier) {
throw new Error('Method not implemented.');
}
  isDropdownOpen = false;
  currentActionPopup: string | null = null;

  @ViewChild('actionsDropdown', { static: false }) actionsDropdown!: ElementRef;
  @ViewChild('dropdownMenu', { static: false }) dropdownMenu!: ElementRef; // Add this line
  @ViewChild('dropdownElement', { static: false }) dropdownElement!: ElementRef;

// Add these methods to your component
onPaymentMethodChange(): void {
  // You can add logic here if needed
}


  paymentAccounts: any[] = [];
  paymentAccountsLoading = false;
// Add these properties
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


  showForm = false;
    searchText: string = '';
  showMoreInfo = false;
  isIndividual = true;
  currentOpenDropdown: string | null = null;
  entriesPerPage: number = 10; // Default to 10
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
  
// selectedFile: File | null = null; // <-- REMOVE this duplicate line
  currentPaymentPurchase: any = null;


  // In your component class
get combinedAddress(): string {
  const form = this.supplierForm.value;
  const parts = [];
  
  if (form.addressLine1) parts.push(form.addressLine1);
  if (form.addressLine2) parts.push(form.addressLine2);
  if (form.city) parts.push(form.city);
  if (form.district) parts.push(form.district);
  if (form.state) parts.push(form.state);
  if (form.country) parts.push(form.country);
  if (form.zipCode) parts.push(form.zipCode);
  
  return parts.join(', ');
  }
  
  filteredShippingDistricts: string[] = [];
  showLedgerView = false;  // Add this property
  selectedSupplierForLedger: Supplier | null = null;
  isFilterVisible = false;
  dateRangeLabel: string = '';
  isCustomDate: boolean = false;
    isDrawerOpen = false;
  selectedRange = '';
// Add these properties to your component class
isDateDrawerOpen = false;
fromDate: string = '';
toDate: string = '';
// In your component class
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
  state: '',  // This was already there
  fromDate: '',
  toDate: '',
};

  
  // Moving this declaration to the constructor after fb is initialized
  paymentForm: FormGroup;
  // Changed entriesPerPage default value to 4
  
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
    private purchaseService: PurchaseService, // Add PurchaseService
    private fb: FormBuilder,
    private paymentService: PaymentService, // Add PaymentService injection
    private router: Router,
    private locationService: LocationService,
    private elementRef: ElementRef,
    private renderer: Renderer2,
      private firestore: Firestore // Add this line

  ) {
    this.supplierForm = this.fb.group({
      contactId: [''],
      businessName: [''],
      firstName: [''],
      lastName: [''],
      middleName: [''],
      prefix: [''],
      dob: [null],
     mobile: ['', [Validators.required, Validators.pattern('^[0-9]{10}$')]],
  landline: ['', [Validators.pattern('^[0-9]{12}$')]],
  alternateContact: ['', [Validators.pattern('^[0-9]{10}$')]],
      email: ['', [Validators.email]],
      createdAt: [new Date().toISOString().slice(0, 16), Validators.required],
      district: [''], // Make sure this is included

      assignedTo: [''],
      taxNumber: [''],
      openingBalance: [0],
      payTerm: [0],
      addressLine1: [''],
      addressLine2: [''],
      city: [''],
      state: [''],
      country: [''],
      zipCode: [''],
      
      contactType: ['Supplier']
    });

this.paymentForm = this.fb.group({
  supplierName: ['', Validators.required],
  businessName: [''],
  paymentMethod: ['Cash', Validators.required],
  paymentNote: [''],
  reference: [''],
  paidDate: [new Date().toISOString().slice(0, 16), Validators.required],
  amount: [0, [Validators.required, Validators.min(0.01)]],
  paymentAccount: [null, Validators.required] // Changed from string to object
});
  }
// Add these methods to handle dropdown toggling
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
  // Reset district when state changes
  this.supplierForm.patchValue({ shippingDistrict: '' });
  }
  onAddressChange(): void {
  // This will trigger change detection and update the combined address display
  this.supplierForm.updateValueAndValidity();
  }
  // Add this method to your SuppliersComponent class
goToShopping(supplier: Supplier): void {
  if (supplier.id) {
    this.router.navigate(['/shopping'], {
      queryParams: { supplierId: supplier.id }
    });
  }
  }
  // In your component
// In your component
openDropdown(supplierId: string) {
  this.renderer.appendChild(document.body, this.dropdownElement.nativeElement);
  // Position dropdown near the button
}
  closeAllDropdowns(): void {
    if (this.currentOpenDropdown) {
      this.updateDropdownDisplay(this.currentOpenDropdown, false);
      this.currentOpenDropdown = null;
    }
  }
   private updateDropdownDisplay(supplierId: string, show: boolean): void {
    const dropdown = document.getElementById(`dropdownMenu_${supplierId}`);
    if (dropdown) {
      if (show) {
        dropdown.classList.add('show');
        dropdown.style.display = 'block';
      } else {
        dropdown.classList.remove('show');
        dropdown.style.display = 'none';
      }
    }
  }

get customerFullName(): string {
  const form = this.supplierForm.value;
  if (this.isIndividual) {
    return `${form.prefix || ''} ${form.firstName || ''} ${form.middleName || ''} ${form.lastName || ''}`.trim();
  } else {
    return form.businessName || '';
  }
  }
  
  // In your component
toggleStatus(supplier: Supplier): void {
  const newStatus = supplier.status === 'Active' ? 'Inactive' : 'Active';
  
  this.supplierService.updateSupplier(supplier.id!, { status: newStatus })
    .then(() => {
      supplier.status = newStatus;
      // If contact type is customer or both, update customer status too
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
    // Prevent body scrolling when drawer is open
    document.body.style.overflow = this.isDrawerOpen ? 'hidden' : '';
  }
  onStateChange(): void {
  const selectedState = this.supplierForm.get('state')?.value;
  this.filteredDistricts = selectedState ? this.stateDistricts[selectedState] : [];
  // Reset district when state changes
  this.supplierForm.patchValue({ district: '' });
}
  ngOnInit(): void {
    this.loadSuppliers();
    this.loadAssignedUsers();
      this.loadStates(); // Add this line
 this.paymentForm.valueChanges.subscribe(val => {
    if (this.currentPaymentSupplier?.id) {
      localStorage.setItem(
        `paymentInProgress_${this.currentPaymentSupplier.id}`,
        JSON.stringify(val)
      );
    }
  });
  }
  
toggleDateDrawer(): void {
  this.isDateDrawerOpen = !this.isDateDrawerOpen;
}
loadSuppliers(): void {
  this.supplierService.getSuppliers().subscribe((suppliers: any[]) => {
    this.suppliersList = suppliers;
    
    // For each supplier, ensure payment data is calculated
    this.suppliersList.forEach(supplier => {
      if (supplier.id) {
        this.purchaseService.getPurchasesBySupplier(supplier.id).subscribe(purchases => {
          const totalPurchase = purchases.reduce((sum, purchase) => 
            sum + (purchase.grandTotal || purchase.purchaseTotal || 0), 0);
          const totalPaid = purchases.reduce((sum, purchase) => 
            sum + (purchase.paymentAmount || 0), 0);
          
          // Update supplier object
          supplier.totalPurchases = totalPurchase;
          supplier.paymentAmount = totalPaid;
          supplier.paymentDue = totalPurchase - totalPaid;
          
          this.applyFilters(); // Refresh the filtered list
        });
      }
    });
    
    this.applyFilters();
  });
}
// suppliers.component.ts

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

toggleFilters(): void {
  this.isFilterVisible = !this.isFilterVisible;
}
calculateSupplierPaymentDue(supplierId: string): Promise<number> {
  return new Promise((resolve) => {
    this.purchaseService.getPurchasesBySupplier(supplierId).subscribe(purchases => {
      const totalPurchase = purchases.reduce((sum, purchase) => 
        sum + (purchase.grandTotal || purchase.purchaseTotal || 0), 0);
      const totalPaid = purchases.reduce((sum, purchase) => 
        sum + (purchase.paymentAmount || 0), 0);
      resolve(totalPurchase - totalPaid);
    });
  });
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
  return user ? user.username : userId; // Fallback to ID if user not found
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

applyFilters(): void {
  let filtered = [...this.suppliersList];
  
  // Search term filter (now includes zipCode)
  if (this.searchTerm) {
    const term = this.searchTerm.toLowerCase();
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
      (supplier.zipCode?.toString().includes(term)) // Add this line for zip code search
    );
  }

  // State filter
  if (this.filterOptions.state) {
    filtered = filtered.filter(supplier => supplier.state === this.filterOptions.state);
  }

  // Date range filter
  if (this.filterOptions.fromDate) {
    const fromDate = new Date(this.filterOptions.fromDate);
    filtered = filtered.filter(supplier => {
      const supplierDate = supplier.createdAt ? new Date(supplier.createdAt) : new Date();
      return supplierDate >= fromDate;
    });
  }
  
  if (this.filterOptions.toDate) {
    const toDate = new Date(this.filterOptions.toDate);
    toDate.setHours(23, 59, 59, 999); // Include entire day
    filtered = filtered.filter(supplier => {
      const supplierDate = supplier.createdAt ? new Date(supplier.createdAt) : new Date();
      return supplierDate <= toDate;
    });
  }
  
  // Other filters (purchaseDue, purchaseReturn, etc.)
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
  
  // Sorting
  filtered.sort((a, b) => {
    const valA = a[this.sortColumn as keyof Supplier] || '';
    const valB = b[this.sortColumn as keyof Supplier] || '';
    
    if (valA < valB) return this.sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return this.sortDirection === 'asc' ? 1 : -1;
    return 0;
  });
  
  this.filteredSuppliers = filtered;
  this.totalPages = Math.ceil(this.filteredSuppliers.length / this.entriesPerPage);
  this.currentPage = Math.min(this.currentPage, this.totalPages);
}

filterByDate(range: string) {
  this.selectedRange = range;
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize to start of day

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
    case 'thisWeek':
      const firstDayOfWeek = new Date(today);
      firstDayOfWeek.setDate(firstDayOfWeek.getDate() - firstDayOfWeek.getDay());
      this.filterOptions.fromDate = this.formatDate(firstDayOfWeek);
      this.filterOptions.toDate = this.formatDate(today);
      this.dateRangeLabel = 'This Week';
      break;
    case 'thisMonth':
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      this.filterOptions.fromDate = this.formatDate(firstDayOfMonth);
      this.filterOptions.toDate = this.formatDate(today);
      this.dateRangeLabel = 'This Month';
      break;
    case 'lastMonth':
      const firstDayOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastDayOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      this.filterOptions.fromDate = this.formatDate(firstDayOfLastMonth);
      this.filterOptions.toDate = this.formatDate(lastDayOfLastMonth);
      this.dateRangeLabel = 'Last Month';
      break;
    case 'thisYear':
      const firstDayOfYear = new Date(today.getFullYear(), 0, 1);
      this.filterOptions.fromDate = this.formatDate(firstDayOfYear);
      this.filterOptions.toDate = this.formatDate(today);
      this.dateRangeLabel = 'This Year';
      break;
    case 'thisFinancialYear':
      // April to March financial year (adjust if your financial year is different)
      const currentMonth = today.getMonth();
      let financialYearStart, financialYearEnd;
      
      if (currentMonth >= 3) { // April or later
        financialYearStart = new Date(today.getFullYear(), 3, 1); // April 1
        financialYearEnd = new Date(today.getFullYear() + 1, 2, 31); // March 31 next year
      } else { // January-March
        financialYearStart = new Date(today.getFullYear() - 1, 3, 1); // April 1 last year
        financialYearEnd = new Date(today.getFullYear(), 2, 31); // March 31 this year
      }
      
      this.filterOptions.fromDate = this.formatDate(financialYearStart);
      this.filterOptions.toDate = today > financialYearEnd ? 
        this.formatDate(financialYearEnd) : 
        this.formatDate(today);
      this.dateRangeLabel = 'This Financial Year';
      break;
    case 'previousFinancialYear':
      const currentMonthPrev = today.getMonth();
      let prevFinancialYearStart, prevFinancialYearEnd;
      
      if (currentMonthPrev >= 3) { // April or later
        prevFinancialYearStart = new Date(today.getFullYear() - 1, 3, 1); // April 1 last year
        prevFinancialYearEnd = new Date(today.getFullYear(), 2, 31); // March 31 this year
      } else { // January-March
        prevFinancialYearStart = new Date(today.getFullYear() - 2, 3, 1); // April 1 year before last
        prevFinancialYearEnd = new Date(today.getFullYear() - 1, 2, 31); // March 31 last year
      }
      
      this.filterOptions.fromDate = this.formatDate(prevFinancialYearStart);
      this.filterOptions.toDate = this.formatDate(prevFinancialYearEnd);
      this.dateRangeLabel = 'Previous Financial Year';
      break;
    case 'custom':
      this.isCustomDate = true;
      return;
  }

  this.isCustomDate = false;
  this.isDateDrawerOpen = false;
  this.applyFilters();
}
loadStates(): void {
  this.supplierService.getSuppliers().subscribe(suppliers => {
    // Get unique states from suppliers and sort them
    this.statesList = [...new Set(
      suppliers
        .map(s => s.state)
        .filter((state): state is string => !!state && state.trim() !== '')
    )].sort((a, b) => a.localeCompare(b));
  });
}
// Helper function to format date as YYYY-MM-DD
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
  this.applyFilters();
}
selectCustomRange(): void {
  this.selectedRange = 'custom';
  this.isCustomDate = true;
}

cancelCustomRange(): void {
  this.isCustomDate = false;
  this.selectedRange = '';
}

  
applyCustomRange(): void {
  if (this.fromDate && this.toDate) {
    // Format dates for display
    const fromDate = new Date(this.fromDate);
    const toDate = new Date(this.toDate);
    this.dateRangeLabel = `${fromDate.toLocaleDateString()} - ${toDate.toLocaleDateString()}`;
    
    // Update filter options
    this.filterOptions = {
      ...this.filterOptions,
      fromDate: this.fromDate,
      toDate: this.toDate
    };
    
    this.applyFilters();
    this.toggleDateDrawer(); // Close drawer after applying
  }
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
  return this.filteredSuppliers.slice(start, end);
}



prevPage(): void {
  if (this.currentPage > 1 && this.filteredSuppliers.length > 0) {
    this.currentPage--;
  }
}

nextPage(): void {
  if (this.currentPage < this.totalPages && this.filteredSuppliers.length > 0) {
    this.currentPage++;
  }
}
// suppliers.component.ts

updateSupplierStatus(supplier: Supplier, status: 'Active' | 'Inactive'): void {
  if (!supplier.id) {
    console.error('Supplier ID is missing');
    return;
  }

  this.supplierService.updateSupplierStatus(supplier.id, status)
    .then(() => {
      supplier.status = status; // Update local state
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
    const currentDateTime = new Date().toISOString().slice(0, 16); // Get current date/time in correct format
    this.supplierForm.patchValue({ 
      contactId,
      createdAt: currentDateTime // Always set current date/time for new suppliers
    });
  }
  if (!this.showForm) {
    this.resetForm();
  }
}

resetForm(): void {
  const currentDateTime = new Date().toISOString().slice(0, 16);
  this.supplierForm.reset({
    contactType: 'Supplier',
    openingBalance: 0,
    payTerm: 0,
    createdAt: currentDateTime // Include current date/time in reset
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
saveSupplier(): void {
  // Validate all phone fields
  const isMobileValid = this.validatePhoneNumber('mobile');
  const isLandlineValid = this.validatePhoneNumber('landline');
  const isAlternateValid = this.validatePhoneNumber('alternateContact');
    
  if (!isMobileValid || !isLandlineValid || !isAlternateValid) {
    return;
  }
    
  if (this.isIndividual && !this.supplierForm.get('firstName')?.value) {
    alert('First Name is required for individuals');
    return;
  }
    
  if (!this.isIndividual && !this.supplierForm.get('businessName')?.value) {
    alert('Business Name is required for businesses');
    return;
  }
    
  if (!this.supplierForm.get('mobile')?.value) {
    alert('Mobile number is required');
    return;
  }
  
  // Ensure createdAt is properly set
  let createdAt = this.supplierForm.get('createdAt')?.value;
  if (!createdAt) {
    createdAt = new Date().toISOString().slice(0, 16); // Fallback to current date/time
    this.supplierForm.patchValue({ createdAt });
  }
  
  // Update supplierData from form values
  this.supplierData = {
    ...this.supplierForm.value,
    isIndividual: this.isIndividual,
    district: this.supplierForm.value.district || null,
    createdAt: new Date(createdAt) // Ensure this is a Date object
  };
  
  if (this.editingSupplierId) {
    this.updateExistingSupplier();
  } else {
    this.addNewSupplier();
  }
}

  addNewSupplier(): void {
    if (!this.supplierData.contactId) {
      this.supplierData.contactId = this.generateContactId();
    }
    
    if (this.supplierData.contactType === 'Supplier') {
      this.supplierService.addSupplier(this.supplierData as Supplier)
        .then(() => {
          this.toggleForm();
          this.loadSuppliers();
          alert('Supplier added successfully!');
          
        })
        .catch((error) => {
          console.error('Error adding supplier: ', error);
          alert('Error adding supplier. Please try again.');
        });
    } else if (this.supplierData.contactType === 'Customer') {
      this.customerService.addCustomer(this.supplierData as any)
        .then(() => {
          this.toggleForm();
          this.loadSuppliers();
          alert('Customer added successfully!');
        })
        .catch((error) => {
          console.error('Error adding customer: ', error);
          alert('Error adding customer. Please try again.');
        });
    } else if (this.supplierData.contactType === 'Both') {
      Promise.all([
        this.supplierService.addSupplier(this.supplierData as Supplier),
        this.customerService.addCustomer(this.supplierData as any)
      ])
      .then(() => {
        this.toggleForm();
        this.loadSuppliers();
        alert('Contact added to both Suppliers and Customers successfully!');
      })
      .catch((error) => {
        console.error('Error adding contact: ', error);
        alert('Error adding contact. Please try again.');
      });
    }
  }

  updateExistingSupplier(): void {
    if (this.editingSupplierId) {
      if (this.supplierData.contactType === 'Supplier') {
        this.supplierService.updateSupplier(this.editingSupplierId, this.supplierData as Supplier)
          .then(() => {
            this.toggleForm();
            this.loadSuppliers();
            alert('Supplier updated successfully!');
          })
          .catch((error) => {
            console.error('Error updating supplier: ', error);
            alert('Error updating supplier. Please try again.');
          });
      } else if (this.supplierData.contactType === 'Customer') {
        this.customerService.updateCustomer(this.editingSupplierId, this.supplierData as any)
          .then(() => {
            this.toggleForm();
            this.loadSuppliers();
            alert('Customer updated successfully!');
          })
          .catch((error) => {
            console.error('Error updating customer: ', error);
            alert('Error updating customer. Please try again.');
          });
      } else if (this.supplierData.contactType === 'Both') {
        Promise.all([
          this.supplierService.updateSupplier(this.editingSupplierId, this.supplierData as Supplier),
          this.customerService.updateCustomer(this.editingSupplierId, this.supplierData as any)
        ])
        .then(() => {
          this.toggleForm();
          this.loadSuppliers();
          alert('Contact updated in both Suppliers and Customers successfully!');
        })
        .catch((error) => {
          console.error('Error updating contact: ', error);
          alert('Error updating contact. Please try again.');
        });
      }
    }
  }

 editSupplier(supplier: any): void {
  // Convert createdAt to the correct format for datetime-local input
  let createdAtFormatted = '';
  if (supplier.createdAt) {
    try {
      // Ensure createdAt is a Date object
      const date = supplier.createdAt instanceof Date ? 
        supplier.createdAt : 
        new Date(supplier.createdAt);
      
      // Check if the date is valid
      if (!isNaN(date.getTime())) {
        createdAtFormatted = date.toISOString().slice(0, 16);
      } else {
        createdAtFormatted = new Date().toISOString().slice(0, 16);
      }
    } catch (e) {
      createdAtFormatted = new Date().toISOString().slice(0, 16);
    }
  } else {
    createdAtFormatted = new Date().toISOString().slice(0, 16);
  }

  // Reset form first
  this.supplierForm.reset({
    contactType: supplier.contactType || 'Supplier',
    openingBalance: supplier.openingBalance || 0,
    payTerm: supplier.payTerm || 0
  });

  // Patch the form with supplier data
  this.supplierForm.patchValue({
    ...supplier,
    createdAt: createdAtFormatted,
    assignedTo: supplier.assignedTo,
    district: supplier.district || ''
  });

  // Set component state
  this.supplierData = { ...supplier };
  this.editingSupplierId = supplier.id || null;
  this.isIndividual = supplier.isIndividual ?? true;
  this.showForm = true;

  // If state is set, filter districts
  if (supplier.state) {
    this.filteredDistricts = this.stateDistricts[supplier.state] || [];
  }

  // Expand more info section if relevant fields exist
  if (supplier.taxNumber || supplier.addressLine1 || supplier.openingBalance) {
    this.showMoreInfo = true;
  }
    this.closeDropdown();
        this.dropdownOpen = false;


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

  // Add showSnackbar method
  showSnackbar(message: string, type: 'success' | 'error'): void {
    const snackbar = document.createElement('div');
    snackbar.className = `snackbar ${type}`;
    snackbar.textContent = message;
    document.body.appendChild(snackbar);
    
    // Show the snackbar
    setTimeout(() => {
      snackbar.className += ' show';
    }, 100);
    
    // Remove the snackbar after 3 seconds
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
  
  // Calculate payment due
  const paymentDue = await this.calculateSupplierPaymentDue(supplier.id || '');
  const openingBalance = supplier.openingBalance || 0;
  const totalDue = paymentDue + openingBalance;
  
  // Initialize form
  this.paymentForm.patchValue({
    supplierName: supplier.businessName || `${supplier.firstName} ${supplier.lastName || ''}`.trim(),
    amount: totalDue > 0 ? totalDue : 0,
    reference: this.generateReferenceNumber()
  });
  
  // Update payment summary
  this.paymentSummary = {
    totalPurchase: paymentDue + (supplier.paymentAmount || 0),
    totalPaid: supplier.paymentAmount || 0,
    totalPurchaseDue: paymentDue,
    openingBalance: openingBalance,
    openingBalanceDue: openingBalance
  };
  
  this.showPaymentForm = true;
}

async submitPayment(): Promise<void> {
  if (this.paymentForm.invalid || !this.currentPaymentSupplier?.id) {
    this.paymentForm.markAllAsTouched();
    return;
  }

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

    // 1. Record the payment
    await this.paymentService.addPayment(paymentData);

    // 2. Update the supplier's balance
    await this.supplierService.updateSupplierBalance(
      this.currentPaymentSupplier.id,
      paymentData.amount,
      true // isPayment
    );

    // 3. Update the payment account balance
    if (paymentData.paymentAccount?.id) {
      await this.accountService.updateAccountBalance(
        paymentData.paymentAccount.id,
        -paymentData.amount // Negative because it's an expense
      );

      // Record transaction in the account
      await this.accountService.recordTransaction(paymentData.paymentAccount.id, {
        amount: paymentData.amount,
        type: 'expense',
        date: paymentData.paymentDate,
        reference: paymentData.reference,
        relatedDocId: this.currentPaymentSupplier.id,
        description: `Payment to supplier ${paymentData.supplierName}`,
        paymentMethod: paymentData.paymentMethod
      });
    }

    // 4. Refresh data
    this.loadSuppliers();
    this.showSnackbar('Payment recorded successfully!', 'success');
    this.closePaymentForm();

  } catch (error) {
    console.error('Error processing payment:', error);
    this.showSnackbar('Error processing payment', 'error');
  }
}


  viewPaymentHistory(supplier: Supplier): void {
  if (supplier.id) {
    this.router.navigate(['/suppliers', supplier.id, 'payments']);
  }}


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
      // Prepare data for CSV
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
        'Zip Code': supplier.zipCode || ''
      }));
  
      // Create CSV content
      let csvContent = "data:text/csv;charset=utf-8,";
      
      // Add headers
      const headers = Object.keys(csvData[0]);
      csvContent += headers.join(",") + "\r\n";
      
      // Add rows
      csvData.forEach(row => {
        const values = headers.map(header => {
          const value = row[header as keyof typeof row];
          // Escape quotes and wrap in quotes if contains commas
          return typeof value === 'string' && value.includes(',') 
            ? `"${value.replace(/"/g, '""')}"` 
            : value;
        });
        csvContent += values.join(",") + "\r\n";
      });
      
      // Create download link
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `suppliers_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      
      // Trigger download
      link.click();
      
      // Clean up
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('Error exporting CSV. Please try again.');
    }
  }
  
  exportExcel(): void {
    try {
      // Prepare data for Excel
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
        'Zip Code': supplier.zipCode || ''
      }));
      
      // Create worksheet
      const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(excelData);
      
      // Create workbook
      const wb: XLSX.WorkBook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Suppliers');
      
      // Generate file and download
      XLSX.writeFile(wb, `suppliers_${new Date().toISOString().slice(0,10)}.xlsx`);
    } catch (error) {
      console.error('Error exporting Excel:', error);
      alert('Error exporting Excel. Please try again.');
    }
  }

async payDue(supplier: Supplier): Promise<void> {
  this.currentPaymentSupplier = supplier;
  
  // Calculate payment due
  const paymentDue = await this.calculateSupplierPaymentDue(supplier.id || '');
  const openingBalance = supplier.openingBalance || 0;
  const totalDue = paymentDue + openingBalance;
  
  // Initialize form
  this.paymentForm.patchValue({
    supplierName: supplier.businessName || `${supplier.firstName} ${supplier.lastName || ''}`.trim(),
    amount: totalDue > 0 ? totalDue : 0,
    reference: this.generateReferenceNumber(),
    paidDate: new Date().toISOString().slice(0, 16)
  });
  
  // Update payment summary
  this.paymentSummary = {
    totalPurchase: paymentDue + (supplier.paymentAmount || 0),
    totalPaid: supplier.paymentAmount || 0,
    totalPurchaseDue: paymentDue,
    openingBalance: openingBalance,
    openingBalanceDue: openingBalance
  };
  
  this.showPaymentForm = true;
  await this.loadPaymentAccounts(); // Load accounts when opening the form
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
  // Implement your receive cash logic here
  alert(`Receive Cash from ${supplier.businessName || supplier.firstName}`);
}

// In suppliers.component.ts
viewSupplier(supplier: Supplier): void {
  if (supplier.id) {
    this.router.navigate(['/supplier-view', supplier.id]);
  }
}

printSupplier(supplier: Supplier): void {
  console.log('Print supplier:', supplier);
  // Implement your print logic here
  alert(`Printing details for ${supplier.businessName || supplier.firstName}`);
}

// This method should be called when clicking "Ledger" in the actions dropdown
openLedger(supplier: Supplier): void {
  this.selectedSupplierForLedger = supplier;
  this.showLedgerView = true;
  if (supplier.id) {
    this.router.navigate(['/suppliers', supplier.id, 'ledger']);
  }
  // Load payment summary data
  this.purchaseService.getPurchasesBySupplier(supplier.id || '').subscribe((purchases: any[]) => {
    const totalPurchase = purchases.reduce((sum: any, purchase: { grandTotal: any; }) => sum + (purchase.grandTotal || 0), 0);
    const totalPaid = purchases.reduce((sum: any, purchase: { paymentAmount: any; }) => sum + (purchase.paymentAmount || 0), 0);
    
    // Update the payment summary
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


// In suppliers.component.ts
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
  exportPDF(): void {
    console.log('Exporting to PDF:', this.filteredSuppliers);
  }

}