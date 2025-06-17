import { Component, OnInit } from '@angular/core';
import { SaleService } from '../services/sale.service';
import { Observable, BehaviorSubject, combineLatest } from 'rxjs';
import { Router } from '@angular/router';
import { FormControl } from '@angular/forms';
import { map, startWith, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { LocationService } from '../services/location.service';
import { TypeOfServiceService } from '../services/type-of-service.service';
import { AuthService } from '../auth.service';
import * as moment from 'moment'; // Add moment.js for date handling
import { Modal } from 'bootstrap';interface SelectedSale {
  id: string;
  selected: boolean;
}

interface Product {
  name: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  subtotal: number;
  quantityRemaining?: number;
  taxRate: number;
  taxAmount: number;
  taxType?: string; // 'CGST+SGST' or 'IGST'
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  batchNumber?: string;
  expiryDate?: string;
  priceBeforeTax?: number;
}

interface BusinessLocation {
  id: string;
  name: string;
}

interface SalesOrder {
  paymentAccountName: any;
  id: string;
  customer: string;
  invoiceNo: string;
  paymentDue: number;
  alternateContact?: string;
  totalPayable?: number;
  balanceAmount: number;
  customerPhone: string;
  shippingDetails?: string;
  businessLocation: string;
  location: string;
  paymentStatus: string;
  billingAddress: string;
  transactionId?: string;
  prescriptions?: Prescription[];
  saleDate: string;
  orderNo: string;
  status: string;
  serviceType: string;
  typeOfService: string;
  customerName?: string;
  typeOfServiceName: string;
  shippingStatus: string;
  shippingCharges: number;
  discountType: string;
  discountAmount: number;
  orderTax: number;
  paymentAmount: number;
  paymentMethod: string;
  paidOn: string;
  balance: number;
  changeReturn: number;
  quantityRemaining: number;
  addedBy?: string;
  addedByDisplayName?: string;
  addedByDepartment?: string;
  shippingAddress: string;
  sellNote: string;
  paymentNote: string;
  deliveryPerson: string;
  products: Product[];
  
  // Tax-related properties
  taxAmount?: number;
  taxDetails?: {
    cgst: number;
    sgst: number;
    igst: number;
    total: number;
  };
  productTaxAmount?: number;
  shippingTaxAmount?: number;
}

interface Prescription {
  id?: string;
  patientName: string;
  date: string;
  medicines: Medicine[];
  doctorName?: string;
  createdAt?: Date;
  saleId?: string;
}

interface Medicine {
  name: string;
  type: string;
  dosage?: string;
  instructions?: string;
  time: string;
}

interface PartialSalesOrder {
  paymentAccountName: any;
  paymentAccount: any;
  id?: string;
  customer?: string;
  customerPhone?: string;
  businessLocation?: string;
  location?: string;
  saleDate?: string;
  alternateContact?: string;
  invoiceNo?: string;
  shippingDetails?: string;
  orderNo?: string;
  paymentStatus?: string;
  total?: number;
  totalPayable?: number; 
  status?: string;
  serviceType?: string;
  typeOfService?: string;
  typeOfServiceName?: string;
  shippingStatus?: string;
  shippingCharges?: number;
  discountType?: string;
  discountAmount?: number;
  orderTax?: number;
  paymentAmount?: number;
  paymentMethod?: string;
  paidOn?: string;
  balance?: number;
  changeReturn?: number;
  quantityRemaining?: number;
  addedBy?: string;
  addedByDisplayName?: string;
  addedByDepartment?: string;
  billingAddress?: string;
  shippingAddress?: string;
  sellNote?: string;
  paymentNote?: string;
  deliveryPerson?: string;
  products?: Array<Partial<Product>>;
  product?: Array<Partial<Product>>;
  transactionId?: string;
  prescriptions?: Prescription[];
  
  // Tax-related properties
  taxAmount?: number;
  taxDetails?: {
    cgst: number;
    sgst: number;
    igst: number;
    total: number;
  };
  productTaxAmount?: number;
  shippingTaxAmount?: number;
}

interface FilterOptions {
  businessLocation: string;
  customer: string;
  status: string;
  shippingStatus: string;
  addedBy?: string;
  addedByDepartment?: string;
  addedByRole?: string;
  serviceType: string;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  quickDateFilter?: string;
}

interface Customer {
  id: string;
  displayName: string;
  contactId?: string;
}

interface User {
  uid: string;
  email: string;
  department?: string;
  displayName?: string;
  username?: string;
  role?: string;
  permissions?: any;
  businessId?: string;
}

interface DepartmentExecutive {
  id: string;
  displayName: string;
  email: string;
  department: string;
}

@Component({
  selector: 'app-sales-order',
  templateUrl: './sales-order.component.html',
  styleUrls: ['./sales-order.component.scss']
})
export class SalesOrderComponent implements OnInit {
  selectedSales: SelectedSale[] = [];
  allSelected = false;
  // In your sales-order.component.ts
// Date filter properties
isDateDrawerOpen: boolean = false;
selectedRange: string = '';
isCustomDate: boolean = false;
dateRangeLabel: string = '';
  currentUser: User | null = null;
  departmentExecutives: DepartmentExecutive[] = [];
  departmentSalesCount = 0;
  selectedSaleForAction: SalesOrder | null = null;
actionModal: any;
  private allSalesData$ = new BehaviorSubject<SalesOrder[]>([]);
  private modal: any;
// Add these properties to your component class
quickDateFilters = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'thisWeek', label: 'This Week' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'lastMonth', label: 'Last Month' },
  { value: 'custom', label: 'Custom Range' }
];

activeQuickFilter: string = '';

// Add this method to your component
// Add this method to your component
applyQuickDateFilter(filter: string): void {
  this.activeQuickFilter = filter;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  switch(filter) {
    case 'today':
      this.filterOptions.dateRange.startDate = today.toISOString().split('T')[0];
      this.filterOptions.dateRange.endDate = today.toISOString().split('T')[0];
      break;
      
    case 'yesterday':
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      this.filterOptions.dateRange.startDate = yesterday.toISOString().split('T')[0];
      this.filterOptions.dateRange.endDate = yesterday.toISOString().split('T')[0];
      break;
      
    case 'thisWeek':
      const firstDayOfWeek = new Date(today);
      firstDayOfWeek.setDate(today.getDate() - today.getDay()); // Sunday
      this.filterOptions.dateRange.startDate = firstDayOfWeek.toISOString().split('T')[0];
      this.filterOptions.dateRange.endDate = today.toISOString().split('T')[0];
      break;
      
    case 'thisMonth':
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      this.filterOptions.dateRange.startDate = firstDayOfMonth.toISOString().split('T')[0];
      this.filterOptions.dateRange.endDate = today.toISOString().split('T')[0];
      break;
      
    case 'lastMonth':
      const firstDayOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastDayOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      this.filterOptions.dateRange.startDate = firstDayOfLastMonth.toISOString().split('T')[0];
      this.filterOptions.dateRange.endDate = lastDayOfLastMonth.toISOString().split('T')[0];
      break;
      
    case 'custom':
      // You'll need to implement custom date picker logic here
      // For now, just clear the dates
      this.filterOptions.dateRange.startDate = '';
      this.filterOptions.dateRange.endDate = '';
      return;
  }
  
  // Apply the filters
  this.applyFilters();
}
  searchControl = new FormControl('');
  selectedSale: SalesOrder | null = null;
  viewSaleModal: any;

  viewSale(sale: SalesOrder, event?: Event): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    
    this.selectedSale = sale;
    this.viewSaleModal?.show();
  }

  sales$!: Observable<SalesOrder[]>;
  sortedSales$!: Observable<SalesOrder[]>;
  displayedSales: SalesOrder[] = [];
  businessLocations: BusinessLocation[] = [];

  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  
  columns = [
    { key: 'actions', label: 'Actions', visible: true },
    { key: 'select', label: 'Select', visible: true },
    { key: 'contactNumbers', label: 'Contact Numbers', visible: true },
    { key: 'sno', label: 'S.No', visible: true },
    { key: 'alternateContact', label: 'Alternate Contact', visible: true },
    { key: 'department', label: 'Department', visible: true },
    { key: 'customer', label: 'Customer Name', visible: true },
    { key: 'product', label: 'Product', visible: true },
    { key: 'customerPhone', label: 'Contact Number', visible: true },
    { key: 'location', label: 'Location', visible: true },
    { key: 'shippingAddress', label: 'Shipping Address', visible: true },
    { key: 'paymentMethod', label: 'Payment Method', visible: true },
    { key: 'paymentAccount', label: 'Payment Account', visible: true },
    { key: 'saleDate', label: 'Sale Date', visible: true },
    { key: 'orderNo', label: 'Order No', visible: true },
    { key: 'typeOfService', label: 'Type of Service', visible: true },
    { key: 'status', label: 'Status', visible: true },
    { key: 'shippingStatus', label: 'Shipping Status', visible: true },
    { key: 'addedBy', label: 'Added By', visible: true },
    { key: 'billingAddress', label: 'Billing Address', visible: true },
    { key: 'transactionId', label: 'Transaction ID', visible: true },
    { key: 'shippingDetails', label: 'Shipping Details', visible: true },
    { key: 'invoiceNo', label: 'Invoice No', visible: true },
    { key: 'paymentDue', label: 'Payment Due', visible: true },
    { key: 'balanceAmount', label: 'Balance Amount', visible: true },
    { key: 'batchNumber', label: 'Batch No', visible: true },
    { key: 'expiryDate', label: 'Expiry Date', visible: true },
    { key: 'totalPayable', label: 'Total Payable', visible: true },
    { key: 'taxAmount', label: 'Tax Amount', visible: true },
    { key: 'cgstAmount', label: 'CGST', visible: true },
    { key: 'sgstAmount', label: 'SGST', visible: true },
    { key: 'igstAmount', label: 'IGST', visible: true }
  ];
  
  showFilters = false;
  Math = Math;
  filterOptions: FilterOptions = {
    businessLocation: '',
    customer: '',
    status: '',
    serviceType: '',
    shippingStatus: '',
    dateRange: {
      startDate: '',
      endDate: ''
    }
  };
  
  currentPage = 1;
  pageSize = 25;
  expandedSaleId: string | null = null;
  
  serviceTypes: any[] = [];

  customers: Customer[] = [
    { id: 'CC0001', displayName: 'Walk-In Customer', contactId: 'CC0001' }
  ];

  constructor(
    private saleService: SaleService, 
    private router: Router,
    private modalService: NgbModal,  
    private locationService: LocationService,
    private typeOfServiceService: TypeOfServiceService,
    private authService: AuthService
  ) {}

  toggleSelectAll(): void {
    this.allSelected = !this.allSelected;
    
    const displayedSales = this.getDisplayedSales();
    
    if (this.allSelected) {
      displayedSales.forEach(sale => {
        const existingIndex = this.selectedSales.findIndex(s => s.id === sale.id);
        if (existingIndex === -1) {
          this.selectedSales.push({ id: sale.id, selected: true });
        } else {
          this.selectedSales[existingIndex].selected = true;
        }
      });
    } else {
      displayedSales.forEach(sale => {
        const existingIndex = this.selectedSales.findIndex(s => s.id === sale.id);
        if (existingIndex > -1) {
          this.selectedSales[existingIndex].selected = false;
        }
      });
      
      this.selectedSales = this.selectedSales.filter(s => s.selected);
    }
  }
getCurrentDateRangeDisplay(): string {
  if (!this.filterOptions.dateRange.startDate || !this.filterOptions.dateRange.endDate) {
    return '';
  }

  const start = new Date(this.filterOptions.dateRange.startDate);
  const end = new Date(this.filterOptions.dateRange.endDate);
  
  return `Showing data from ${start.toLocaleDateString()} to ${end.toLocaleDateString()}`;
}
  private getDisplayedSales(): SalesOrder[] {
    const allSales = this.allSalesData$.value || [];
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    return allSales.slice(startIndex, endIndex);
  }

  private getCurrentPageSales(): SalesOrder[] {
    const allSales = this.allSalesData$.value || [];
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    return allSales.slice(startIndex, endIndex);
  }

  getProductTaxTotal(products: Product[]): number {
    if (!products) return 0;
    return products.reduce((sum, product) => sum + (product.taxAmount || 0), 0);
  }

  getProductTaxBreakdown(products: Product[], taxType: 'cgst' | 'sgst' | 'igst'): number {
    if (!products) return 0;
    return products.reduce((sum, product) => {
      switch(taxType) {
        case 'cgst': return sum + (product.cgstAmount || 0);
        case 'sgst': return sum + (product.sgstAmount || 0);
        case 'igst': return sum + (product.igstAmount || 0);
        default: return sum;
      }
    }, 0);
  }
// In your sales-order.component.ts

  getColSpanCount(): number {
    const columns = [
      'actions', 'sno', 'saleDate', 'orderNo', 'customer', 
      'customerPhone', 'location', 'status', 'typeOfService', 
      'shippingStatus', 'addedBy', 'product', 'shippingDetails', 
      'paymentMethod', 'transactionId', 'invoiceNo', 
      'paymentDue', 'balanceAmount', 'taxAmount', 'cgstAmount', 'sgstAmount', 'igstAmount'
    ];

    return columns.filter(col => this.isColumnVisible(col)).length;
  }
openActionModal(sale: SalesOrder): void {
  this.selectedSaleForAction = sale;
  
  if (!this.actionModal) {
    const modalElement = document.getElementById('actionModal');
    if (modalElement) {
      this.actionModal = new Modal(modalElement);
    }
  }
  
  if (this.actionModal) {
    this.actionModal.show();
  }
}
// Date filter methods

filterByDate(range: string): void {
  this.selectedRange = range;
  this.isCustomDate = false;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  switch (range) {
    case 'today':
      this.filterOptions.dateRange.startDate = today.toISOString().split('T')[0];
      this.filterOptions.dateRange.endDate = today.toISOString().split('T')[0];
      this.dateRangeLabel = 'Today';
      break;
      
    case 'yesterday':
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      this.filterOptions.dateRange.startDate = yesterday.toISOString().split('T')[0];
      this.filterOptions.dateRange.endDate = yesterday.toISOString().split('T')[0];
      this.dateRangeLabel = 'Yesterday';
      break;
      
    case 'sevenDays':
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      this.filterOptions.dateRange.startDate = sevenDaysAgo.toISOString().split('T')[0];
      this.filterOptions.dateRange.endDate = today.toISOString().split('T')[0];
      this.dateRangeLabel = 'Last 7 Days';
      break;
      
    case 'thirtyDays':
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      this.filterOptions.dateRange.startDate = thirtyDaysAgo.toISOString().split('T')[0];
      this.filterOptions.dateRange.endDate = today.toISOString().split('T')[0];
      this.dateRangeLabel = 'Last 30 Days';
      break;
      
    case 'lastMonth':
      const firstDayOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastDayOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      this.filterOptions.dateRange.startDate = firstDayOfLastMonth.toISOString().split('T')[0];
      this.filterOptions.dateRange.endDate = lastDayOfLastMonth.toISOString().split('T')[0];
      this.dateRangeLabel = 'Last Month';
      break;
      
    case 'thisMonth':
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      this.filterOptions.dateRange.startDate = firstDayOfMonth.toISOString().split('T')[0];
      this.filterOptions.dateRange.endDate = today.toISOString().split('T')[0];
      this.dateRangeLabel = 'This Month';
      break;
      
    case 'thisFinancialYear':
      // Assuming financial year starts April 1
      const currentYear = today.getFullYear();
      const financialYearStartMonth = 3; // April (0-indexed)
      
      let financialYearStart;
      if (today.getMonth() >= financialYearStartMonth) {
        financialYearStart = new Date(currentYear, financialYearStartMonth, 1);
      } else {
        financialYearStart = new Date(currentYear - 1, financialYearStartMonth, 1);
      }
      
      this.filterOptions.dateRange.startDate = financialYearStart.toISOString().split('T')[0];
      this.filterOptions.dateRange.endDate = today.toISOString().split('T')[0];
      this.dateRangeLabel = 'This Financial Year';
      break;
      
    case 'lastFinancialYear':
      const currentYearForLast = today.getFullYear();
      const financialYearStartMonthForLast = 3; // April (0-indexed)
      
      let lastFinancialYearStart;
      let lastFinancialYearEnd;
      if (today.getMonth() >= financialYearStartMonthForLast) {
        lastFinancialYearStart = new Date(currentYearForLast - 1, financialYearStartMonthForLast, 1);
        lastFinancialYearEnd = new Date(currentYearForLast, financialYearStartMonthForLast, 0);
      } else {
        lastFinancialYearStart = new Date(currentYearForLast - 2, financialYearStartMonthForLast, 1);
        lastFinancialYearEnd = new Date(currentYearForLast - 1, financialYearStartMonthForLast, 0);
      }
      
      this.filterOptions.dateRange.startDate = lastFinancialYearStart.toISOString().split('T')[0];
      this.filterOptions.dateRange.endDate = lastFinancialYearEnd.toISOString().split('T')[0];
      this.dateRangeLabel = 'Last Financial Year';
      break;
  }
  
  this.applyFilters();
  this.isDateDrawerOpen = false;
}

selectCustomRange(): void {
  this.selectedRange = 'custom';
  this.isCustomDate = true;
  this.filterOptions.dateRange.startDate = '';
  this.filterOptions.dateRange.endDate = '';
}


cancelCustomRange(): void {
  this.isCustomDate = false;
  this.filterOptions.dateRange.startDate = '';
  this.filterOptions.dateRange.endDate = '';
}

toggleDateDrawer(): void {
  this.isDateDrawerOpen = !this.isDateDrawerOpen;
}

applyCustomRange(): void {
  if (this.filterOptions.dateRange.startDate && this.filterOptions.dateRange.endDate) {
    const start = new Date(this.filterOptions.dateRange.startDate);
    const end = new Date(this.filterOptions.dateRange.endDate);
    
    this.dateRangeLabel = `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
    this.applyFilters();
    this.isDateDrawerOpen = false;
  } else {
    alert('Please select both from and to dates');
  }
}
  toggleSelectSale(saleId: string, event: Event): void {
    event.stopPropagation();
    
    const saleIndex = this.selectedSales.findIndex(s => s.id === saleId);
    
    if (saleIndex > -1) {
      this.selectedSales[saleIndex].selected = !this.selectedSales[saleIndex].selected;
      
      if (!this.selectedSales[saleIndex].selected) {
        this.selectedSales.splice(saleIndex, 1);
      }
    } else {
      this.selectedSales.push({
        id: saleId,
        selected: true
      });
    }
    
    this.allSelected = this.selectedSales.length > 0 && 
      this.getCurrentPageSales().every(sale => 
        this.selectedSales.some(s => s.id === sale.id && s.selected)
      );
  }
  async deleteSelectedSales(): Promise<void> {
  // Get the IDs of selected sales
  const selectedIds = this.selectedSales
    .filter(sale => sale.selected)
    .map(sale => sale.id);
    
  if (selectedIds.length === 0) {
    alert('Please select at least one sale to delete');
    return;
  }
  
  const confirmed = confirm(`Are you sure you want to delete ${selectedIds.length} selected sales?`);
  if (!confirmed) return;
  
  try {
    // Delete in batches to avoid overloading
    const batchSize = 10;
    for (let i = 0; i < selectedIds.length; i += batchSize) {
      const batch = selectedIds.slice(i, i + batchSize);
      await Promise.all(batch.map(id => this.saleService.deleteSale(id)));
    }
    
    // Refresh the data
    this.loadSalesData();
    this.selectedSales = [];
    this.allSelected = false;
    
    alert(`${selectedIds.length} sales deleted successfully`);
    
  } catch (error) {
    console.error('Error deleting sales:', error);
    alert('Error deleting sales. Please try again.');
  }
}

  getProductBatchNumbers(products: Product[]): string {
    if (!products || products.length === 0) return 'N/A';
    
    const batches = [...new Set(products
      .filter(p => p.batchNumber)
      .map(p => p.batchNumber)
    )];
    
    return batches.length > 0 ? batches.join(', ') : 'N/A';
  }

  getProductExpiryDates(products: Product[]): string {
    if (!products || products.length === 0) return 'N/A';
    
    const dates = [...new Set(products
      .filter(p => p.expiryDate)
      .map(p => this.formatDate(p.expiryDate))
    )];
    
    return dates.length > 0 ? dates.join(', ') : 'N/A';
  }

  formatDate(dateString: string | undefined): string {
    if (!dateString) return 'N/A';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString();
    } catch {
      return dateString;
    }
  }

  isSaleSelected(saleId: string): boolean {
    return this.selectedSales.some(s => s.id === saleId && s.selected);
  }

  hasSelectedSales(): boolean {
    return this.selectedSales.some(s => s.selected);
  }

  getSortIconClass(column: string): string {
    if (this.sortColumn !== column) {
      return 'fa-sort';
    }
    return this.sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
  }

  ngOnInit(): void {
    this.authService.getCurrentUser().subscribe(user => {
      this.currentUser = user;
      
      if (user) {
        this.loadDepartmentInfo();
        this.applyRoleBasedFilters();
      }
    });
    
    this.loadBusinessLocations();
    this.loadCustomers();
    this.loadServiceTypes();
    this.setupSearchFilter();
  }

  private async loadDepartmentInfo(): Promise<void> {
    if (!this.currentUser) return;

    if (this.currentUser.role === 'supervisor' && this.currentUser.department) {
      this.departmentExecutives = await this.saleService.getDepartmentExecutives(this.currentUser.department);
      console.log('Department executives:', this.departmentExecutives);
    }
  }




  private applyRoleBasedFilters(): void {
    if (!this.currentUser) return;

    this.resetFilters();

    switch(this.currentUser.role?.toLowerCase()) {
      case 'admin':
        console.log('Admin view - showing all sales');
        break;
        
      case 'supervisor':
        if (this.currentUser.department) {
          this.filterOptions.addedByDepartment = this.currentUser.department;
          console.log('Supervisor view - filtering by department:', this.currentUser.department);
        }
        break;
        
      case 'executive':
        this.filterOptions.addedBy = this.currentUser.uid;
        console.log('Executive view - filtering by user ID:', this.currentUser.uid);
        break;
    }

    this.loadSalesData();
  }

  getRoleBasedViewDescription(): string {
    if (!this.currentUser) return '';

    switch(this.currentUser.role?.toLowerCase()) {
      case 'admin':
        return 'All Sales Orders';
      case 'supervisor':
        return `Sales from ${this.currentUser.department} Department (${this.departmentExecutives.length} executives)`;
      case 'executive':
        return 'Your Sales Orders';
      default:
        return 'Sales Orders';
    }
  }

  isColumnVisible(columnKey: string): boolean {
    const column = this.columns.find(c => c.key === columnKey);
    return column ? column.visible : true;
  }
  
  toggleColumnVisibility(columnKey: string): void {
    const column = this.columns.find(c => c.key === columnKey);
    if (column) {
      column.visible = !column.visible;
    }
  }

  setupSearchFilter(): void {
    const search$ = this.searchControl.valueChanges.pipe(
      startWith(''),
      debounceTime(300),
      distinctUntilChanged()
    );
    
    this.sales$ = combineLatest([
      this.allSalesData$,
      search$
    ]).pipe(
      map(([sales, searchTerm]) => {
        if (!searchTerm || typeof searchTerm !== 'string' || searchTerm.trim() === '') {
          return sales;
        }
        
        const term = searchTerm.toLowerCase().trim();
        
        return sales.filter(sale => {
          const customerMatch = this.safeIncludes(sale.customer, term);
          const phoneMatch = this.safeIncludes(sale.customerPhone, term);
          const orderMatch = this.safeIncludes(sale.orderNo, term);
          const invoiceMatch = this.safeIncludes(sale.invoiceNo, term);
          const locationMatch = 
            this.safeIncludes(sale.location, term) || 
            this.safeIncludes(sale.businessLocation, term);
          const statusMatch = this.safeIncludes(sale.status, term);
          const shippingStatusMatch = this.safeIncludes(sale.shippingStatus, term);
          const serviceMatch = 
            this.safeIncludes(sale.typeOfService, term) || 
            this.safeIncludes(sale.typeOfServiceName, term);
          const addedByMatch = 
            this.safeIncludes(sale.addedBy, term) || 
            this.safeIncludes(sale.addedByDisplayName, term);
          const shippingAddressMatch = this.safeIncludes(sale.shippingAddress, term);
          const paymentMethodMatch = this.safeIncludes(sale.paymentMethod, term);
          
          let productMatch = false;
          if (sale.products && sale.products.length > 0) {
            productMatch = sale.products.some(product => 
              this.safeIncludes(product.name, term)
            );
          }
          
          return customerMatch || phoneMatch || orderMatch || invoiceMatch || 
                 locationMatch || statusMatch || shippingStatusMatch || 
                 serviceMatch || addedByMatch || shippingAddressMatch || 
                 paymentMethodMatch || productMatch;
        });
      })
    );

    this.sortedSales$ = this.sales$.pipe(
      map(sales => {
        if (!this.sortColumn) {
          return sales;
        }

        return this.sortSalesData([...sales], this.sortColumn, this.sortDirection);
      })
    );
  }

deleteSale(id: string): void {
  if (confirm('Are you sure you want to delete this sale?')) {
    this.saleService.deleteSale(id)
      .then(() => {
        console.log('Sale deleted successfully');
        this.loadSalesData();
        if (this.actionModal) {
          this.actionModal.hide();
        }
      })
      .catch(error => {
        console.error('Delete failed:', error);
        alert('Failed to delete sale: ' + error.message);
      });
  }
}

  loadBusinessLocations(): void {
    this.locationService.getLocations().subscribe({
      next: (locations) => {
        this.businessLocations = locations.map(loc => ({
          id: loc.id,
          name: loc.name || 'Unnamed Location'
        }));
      },
      error: (err) => console.error('Error loading locations:', err)
    });
  }

  safeIncludes(value: any, searchTerm: string): boolean {
    if (value === null || value === undefined) {
      return false;
    }
    
    const strValue = String(value).toLowerCase();
    return strValue.includes(searchTerm);
  }
  
  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  sortData(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    this.sortedSales$ = this.sales$.pipe(
      map(sales => this.sortSalesData([...sales], this.sortColumn, this.sortDirection))
    );
  }

  private sortSalesData(sales: SalesOrder[], column: string, direction: 'asc' | 'desc'): SalesOrder[] {
    return sales.sort((a, b) => {
      let valueA: any = a[column as keyof SalesOrder];
      let valueB: any = b[column as keyof SalesOrder];
      
      if (column === 'saleDate') {
        valueA = new Date(valueA).getTime();
        valueB = new Date(valueB).getTime();
      } 
      else if (typeof valueA === 'string' && typeof valueB === 'string') {
        valueA = valueA.toLowerCase();
        valueB = valueB.toLowerCase();
      }
      
      if (valueA < valueB) {
        return direction === 'asc' ? -1 : 1;
      }
      if (valueA > valueB) {
        return direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }

  loadSalesData(): void {
    const filters: any = {};
    
    if (this.currentUser) {
      switch(this.currentUser.role?.toLowerCase()) {
        case 'admin':
          break;
        case 'supervisor':
          if (this.currentUser.department) {
            filters.supervisorDepartment = this.currentUser.department;
            filters.supervisorId = this.currentUser.uid;
          }
          break;
        case 'executive':
          filters.addedBy = this.currentUser.uid;
          break;
          
      }
    }
    if (this.filterOptions.dateRange.startDate && this.filterOptions.dateRange.endDate) {
    filters.startDate = this.filterOptions.dateRange.startDate;
    filters.endDate = this.filterOptions.dateRange.endDate;
  }
    if (this.filterOptions.businessLocation) {
      filters.businessLocation = this.filterOptions.businessLocation;
    }
    if (this.filterOptions.customer) {
      filters.customer = this.filterOptions.customer;
    }
    if (this.filterOptions.status) {
      filters.status = this.filterOptions.status;
    }
    if (this.filterOptions.shippingStatus) {
      filters.shippingStatus = this.filterOptions.shippingStatus;
    }
    if (this.filterOptions.serviceType) {
      filters.serviceType = this.filterOptions.serviceType;
    }
    
    if (this.filterOptions.dateRange.startDate && this.filterOptions.dateRange.endDate) {
      filters.startDate = this.filterOptions.dateRange.startDate;
      filters.endDate = this.filterOptions.dateRange.endDate;
    }

    console.log('Loading sales with filters:', filters);
  this.saleService.listenForSales(filters).subscribe(
    (salesFromService: PartialSalesOrder[]) => {
      const salesWithProducts = salesFromService.map((sale: PartialSalesOrder) => {
        const productItems = Array.isArray(sale.products) ? sale.products : 
                          Array.isArray(sale.product) ? sale.product : [];
          
          const paymentDue = sale.balance || 0;
          const balanceAmount = sale.balance || 0;
          
          return {
            prescriptions: sale.prescriptions || [],
            id: sale.id || '',
            customer: sale.customer || 'Unknown Customer',
            customerPhone: sale.customerPhone || '',
            alternateContact: sale.alternateContact || '',
            shippingDetails: sale.shippingDetails || '',
            paymentAccount: sale.paymentAccountName || sale.paymentAccount || 'N/A',
            paymentAccountName: sale.paymentAccountName || sale.paymentAccount || 'N/A',
            businessLocation: sale.businessLocation || '',
            totalPayable: sale.totalPayable || sale.total || 0,
            location: sale.location || sale.businessLocation || '',
            saleDate: sale.saleDate || new Date().toISOString(),
            invoiceNo: sale.invoiceNo || '',
            paymentStatus: sale.paymentStatus || 'Due',
            transactionId: sale.transactionId || '',
            balanceAmount: sale.balance || 0,
            shippingStatus: sale.shippingStatus || 'Pending',
            orderNo: sale.orderNo || `SO-${new Date().getTime().toString().slice(-6)}`,
            status: sale.status || 'Pending',
            serviceType: sale.serviceType || sale.typeOfService || 'Standard',
            typeOfService: sale.typeOfServiceName || sale.typeOfService || '',
            typeOfServiceName: sale.typeOfServiceName || sale.typeOfService || '',
            shippingCharges: sale.shippingCharges || 0,
            discountType: sale.discountType || 'Percentage',
            discountAmount: sale.discountAmount || 0,
            orderTax: sale.orderTax || 0,
            paymentAmount: sale.paymentAmount || 0,
            paymentMethod: sale.paymentMethod || '',
            paidOn: sale.paidOn || '',
            balance: sale.balance || 0,
            changeReturn: sale.changeReturn || 0,
            quantityRemaining: sale.quantityRemaining || 0,
            addedBy: sale.addedBy || 'System',
            addedByDisplayName: sale.addedByDisplayName || sale.addedBy || 'System',
            addedByDepartment: sale.addedByDepartment || '',
            billingAddress: sale.billingAddress || '',
            shippingAddress: sale.shippingAddress || '',
            sellNote: sale.sellNote || '',
            paymentNote: sale.paymentNote || '',
            deliveryPerson: sale.deliveryPerson || '',
            paymentDue: paymentDue,
            
            // Tax information - use the comprehensive tax data from the sale
            taxAmount: sale.taxAmount || sale.taxDetails?.total || 0,
            taxDetails: sale.taxDetails || {
              cgst: 0,
              sgst: 0,
              igst: 0,
              total: sale.taxAmount || 0
            },
            productTaxAmount: sale.productTaxAmount || 0,
            shippingTaxAmount: sale.shippingTaxAmount || 0,
            
            products: productItems.map(product => ({
              name: product.name || '',
              quantity: product.quantity || 0,
              unitPrice: product.unitPrice || 0,
              discount: product.discount || 0,
              subtotal: product.subtotal || 0,
              quantityRemaining: product.quantityRemaining || 0,
              taxRate: product.taxRate || 0,
              taxAmount: product.taxAmount || 0,
              taxType: product.taxType || '',
              cgstAmount: product.cgstAmount || 0,
              sgstAmount: product.sgstAmount || 0,
              igstAmount: product.igstAmount || 0,
              batchNumber: product.batchNumber || '',
              expiryDate: product.expiryDate || '',
              priceBeforeTax: product.priceBeforeTax || 0
            }))
          } as unknown as SalesOrder;
        });

        this.selectedSales = salesWithProducts.map(sale => ({
          id: sale.id,
          selected: false
        }));
     let filteredSales = salesWithProducts;
      if (this.filterOptions.dateRange.startDate && this.filterOptions.dateRange.endDate) {
        filteredSales = this.filterSalesByDate(salesWithProducts);
      }
              this.allSalesData$.next(filteredSales);

        console.log('Processed sales data with tax info:', filteredSales);
        this.allSalesData$.next(filteredSales);
        this.departmentSalesCount = filteredSales.length;
        
        this.allSelected = false;
      },
      (error: any) => console.error('Error loading sales data:', error)
    );
  }

private filterSalesByDate(sales: SalesOrder[]): SalesOrder[] {
  if (!this.filterOptions.dateRange.startDate || !this.filterOptions.dateRange.endDate) {
    return sales;
  }

  const startDate = new Date(this.filterOptions.dateRange.startDate);
  const endDate = new Date(this.filterOptions.dateRange.endDate);
  
  // Set time to end of day for end date
  endDate.setHours(23, 59, 59, 999);
  
  return sales.filter(sale => {
    const saleDate = new Date(sale.saleDate);
    return saleDate >= startDate && saleDate <= endDate;
  });
}

  loadServiceTypes(): void {
    this.typeOfServiceService.getServicesRealtime().subscribe({
      next: (services) => {
        this.serviceTypes = services.map(service => ({
          id: service.id,
          name: service.name
        }));
      },
      error: (err) => console.error('Error loading service types:', err)
    });
  }
    
  loadCustomers(): void {
    // In a real application, you would fetch this from a service
  }

  calculateSubtotal(products: any[]): number {
    return products.reduce((sum, product) => sum + (product.unitPrice * product.quantity), 0);
  }

applyFilters(): void {
  this.currentPage = 1;
  
  // If we have a date range selected, ensure the dates are properly set
  if (this.selectedRange && this.selectedRange !== 'custom') {
    this.filterByDate(this.selectedRange);
  }
  
  // Load data with current filters
  this.loadSalesData();
  this.showFilters = false;
}
    
resetFilters(): void {
  this.filterOptions = {
    businessLocation: '',
    customer: '',
    status: '',
    shippingStatus: '',
    serviceType: '',
    dateRange: {
      startDate: '',
      endDate: ''
    }
  };

  this.selectedRange = '';
  this.isCustomDate = false;
  this.dateRangeLabel = '';

  // Reset the search term
  this.searchControl.setValue('');

  // Reset sorting
  this.sortColumn = '';
  this.sortDirection = 'asc';

  // Reload data with cleared filters and update displayed sales
  this.loadSalesData();

  // If you want to immediately update the filtered table in the UI:
  // (This will trigger the observable pipeline to update sortedSales$)
  this.setupSearchFilter();
}

  changePageSize(size: number): void {
    this.pageSize = size;
    this.currentPage = 1;
  }
    
  nextPage(): void {
    this.currentPage++;
  }
    
  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  // Ensure quick date filter applies and updates the UI
  onQuickDateFilterChange(filter: string): void {
    this.filterOptions.quickDateFilter = filter;
    this.applyQuickDateFilter(filter);
    this.currentPage = 1;
    // No need to call loadSalesData() here, as applyQuickDateFilter already calls applyFilters, which calls loadSalesData.
  }
    
  exportData(format: 'csv' | 'excel' | 'pdf'): void {
    this.saleService.exportSales(format, this.filterOptions)
      .catch(error => console.error('Export failed:', error));
  }

  formatInvoiceNumber(invoiceNo: string): string {
    if (!invoiceNo) return 'N/A';
    return invoiceNo;
  }

printData(): void {
    this.showFilters = false;
    
    setTimeout(() => {
      // Create optimized print styles
      const printStyle = `
        <style>
          @media print {
            body, body * {
              visibility: hidden;
              margin: 0;
              padding: 0;
            }
            .print-container, .print-container * {
              visibility: visible;
            }
            .print-container {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              padding: 20px;
              box-sizing: border-box;
            }
            .print-header {
              text-align: center;
              margin-bottom: 20px;
              padding-bottom: 10px;
              border-bottom: 1px solid #eee;
            }
            .print-title {
              font-size: 24px;
              font-weight: bold;
              margin-bottom: 5px;
            }
            .print-meta {
              color: #666;
              font-size: 14px;
            }
            .print-content {
              margin-top: 20px;
            }
            .table {
              width: 100% !important;
              border-collapse: collapse;
            }
            .table th {
              background-color: #f8f9fa !important;
              text-align: left;
              padding: 8px;
              border: 1px solid #dee2e6;
            }
            .table td {
              padding: 8px;
              border: 1px solid #dee2e6;
            }
            .no-print, .no-print * {
              display: none !important;
            }
            @page {
              size: auto;
              margin: 10mm;
            }
          }
        </style>
      `;
      
      // Get current date for the report
      const currentDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      
      // Try to open print window
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        // Get the card content to print
        const cardContent = document.querySelector('.card')?.outerHTML || '<div>No content available</div>';
        
        printWindow.document.write(`
          <html>
            <head>
              <title>Sales Order Report - ${currentDate}</title>
              ${printStyle}
            </head>
            <body>
              <div class="print-container">
                <div class="print-header">
                  <div class="print-title">Sales Order Report</div>
                  <div class="print-meta">Generated on: ${currentDate}</div>
                </div>
                <div class="print-content">
                  ${cardContent}
                </div>
              </div>
            </body>
          </html>
        `);
        
        printWindow.document.close();
        
        // Ensure content is loaded before printing
        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.focus();
            printWindow.print();
            // Don't close immediately to allow print dialog to appear properly
          }, 200);
        };
      } else {
        // Fallback to regular print if popup is blocked
        window.print();
      }
    }, 100);
  }
  editSale(saleId: string): void {
    this.router.navigate(['/sales-order/edit', saleId]);
  }
    


  viewPrescription(sale: SalesOrder, event?: Event): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    
    if (!sale.prescriptions || sale.prescriptions.length === 0) {
      this.saleService.getPrescriptionsBySaleId(sale.id).subscribe({
        next: (prescriptions) => {
          if (prescriptions.length > 0) {
            this.viewPrescriptionDetails(prescriptions[0]);
          } else {
            alert('No prescriptions found for this sale');
          }
        },
        error: (err) => {
          console.error('Error loading prescriptions:', err);
          alert('Error loading prescriptions');
        }
      });
    } else {
      this.viewPrescriptionDetails(sale.prescriptions[0]);
    }
  }

  private viewPrescriptionDetails(prescription: any): void {
    const printContent = this.generatePrescriptionContent(prescription);
    const viewWindow = window.open('', '_blank');
    if (viewWindow) {
      viewWindow.document.write(printContent);
      viewWindow.document.close();
    }
  }

  private getMedicineTypeName(type: string): string {
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

  getQuickDateLabel(filter: string): string {
    switch (filter) {
      case 'today': return 'Today';
      case 'yesterday': return 'Yesterday';
      case 'thisWeek': return 'This Week';
      case 'thisMonth': return 'This Month';
      case 'thisFinancialYear': return 'This Financial Year';
      case 'previousFinancialYear': return 'Previous Financial Year';
      case 'custom': return 'Custom Range';
      default: return 'Select Filter';
    }
  }

  private generatePrescriptionContent(prescription: any): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Prescription</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; padding: 20px; }
          .header { text-align: center; margin-bottom: 20px; }
          .patient-info { margin-bottom: 20px; }
          .medicine-item { margin-bottom: 15px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>Prescription</h2>
        </div>
        
        <div class="patient-info">
          <p><strong>Patient:</strong> ${prescription.patientName || 'N/A'}</p>
          <p><strong>Date:</strong> ${prescription.date || 'N/A'}</p>
        </div>
        
        <div class="prescription-items">
          ${prescription.medicines.map((med: any, i: number) => `
            <div class="medicine-item">
              <h4>${i + 1}. ${this.getMedicineTypeName(med.type)}</h4>
              ${this.generateMedicineDetails(med)}
            </div>
          `).join('')}
        </div>
        
        ${prescription.additionalNotes ? `
          <div class="additional-notes">
            <h4>Additional Notes:</h4>
            <p>${prescription.additionalNotes}</p>
          </div>
        ` : ''}
      </body>
      </html>
    `;
  }

  private generateMedicineDetails(medicine: any): string {
    switch(medicine.type) {
      case 'kasayam':
        return `
          <p>${medicine.name || '______'} കഷായം എടുത്ത് തിളപ്പിച്ചാറ്റിയവെള്ളം ചേർത്ത് ${medicine.instructions || '______'}</p>
          <p>ഗുളിക ${medicine.pills || '______'} പൊടി ചേർത്ത് ${medicine.powder || '______'}</p>
          <p>നേരം: ${medicine.time || 'രാവിലെ / ഉച്ചയ്ക്ക് / രാത്രി'} ഭക്ഷണത്തിനുമുൻപ് / ശേഷം സേവിക്കുക.</p>
        `;
      default:
        return `
          <p>${medicine.name || '______'}</p>
          <p>Dosage: ${medicine.dosage || '______'}</p>
          <p>Time: ${medicine.time || '______'}</p>
        `;
    }
  }

  toggleProductDetails(saleId: string): void {
    if (this.expandedSaleId === saleId) {
      this.expandedSaleId = null;
    } else {
      this.expandedSaleId = saleId;
    }
  }

  getProductsDisplayText(products: Product[]): string {
    if (!products || products.length === 0) return 'No products';
    
    if (products.length === 1) {
      return `${products[0].name} (${products[0].quantity})`;
    } else {
      return `${products[0].name} (${products[0].quantity}) and ${products.length - 1} more`;
    }
  }
}