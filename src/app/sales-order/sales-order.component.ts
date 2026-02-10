import { Component, OnInit } from '@angular/core';
import { SaleService } from '../services/sale.service';
import { Observable, BehaviorSubject, combineLatest, async } from 'rxjs';
import { Router } from '@angular/router';
import { FormControl } from '@angular/forms';
import { map, startWith, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { LocationService } from '../services/location.service';
import { TypeOfServiceService } from '../services/type-of-service.service';
import { AuthService } from '../auth.service';
import * as moment from 'moment';
import { Modal } from 'bootstrap';
import { UserService } from '../services/user.service';
import * as XLSX from 'xlsx'; // Import the Excel library


interface SelectedSale {
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
  taxType?: string;
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
  orderStatus: string;

  balanceAmount: number;
  customerPhone: string;
  shippingDetails?: string;
  businessLocation: string;
  location: string;
  paymentStatus: string;
  billingAddress: string;
  transactionId?: string;
  prescriptions?: Prescription[];
  orderNo: string;
  status: string;
    saleDate?: string | Date | { toDate: () => Date };

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
    department?: string; // For filtering and display

  paymentNote: string;
  deliveryPerson: string;
  products: Product[];
  commissionPercentage?: number;
  
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
  commissionPercentage: number;
  paymentAccountName: any;
  paymentAccount: any;
  id?: string;
  customer?: string;
  customerPhone?: string;
  businessLocation?: string;
  location?: string;
    orderStatus?: string; // Add this line

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
    department?: string; // <-- FIX: Added this property to resolve the error

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
    department?: string; // Added for filtering

  serviceType: string;
  paymentMethod?: string;
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
  isDateDrawerOpen: boolean = false;
  selectedRange: string = '';
  
  isCustomDate: boolean = false;
  pageSize = 10;
  dateRangeLabel: string = '';
  currentUser: User | null = null;
  departmentExecutives: DepartmentExecutive[] = [];
  departmentSalesCount = 0;
  selectedSaleForAction: SalesOrder | null = null;
  actionModal: any;
    users: any[] = []; // Add this property to store user data

  // Raw data from service
  private allSalesData$ = new BehaviorSubject<SalesOrder[]>([]);
  
  // Filtered data
  filteredSales: SalesOrder[] = [];
  
  // Filter properties
  searchTerm: string = '';
  statusFilter: string = '';
  paymentMethodFilter: string = '';
  shippingStatusFilter: string = '';
  addedByFilter: string = '';
  locationFilter: string = '';
  startDate: string = '';
  endDate: string = '';
  quickDateFilter: string = '';
  minCommission: number | null = null;
  maxCommission: number | null = null;

  quickDateFilters = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'thisWeek', label: 'This Week' },
    { value: 'thisMonth', label: 'This Month' },
    { value: 'lastMonth', label: 'Last Month' },
    { value: 'custom', label: 'Custom Range' }
  ];

  activeQuickFilter: string = '';

  searchControl = new FormControl('');
  selectedSale: SalesOrder | null = null;
  viewSaleModal: any;

  sales$!: Observable<SalesOrder[]>;
  sortedSales$!: Observable<SalesOrder[]>;
  displayedSales: SalesOrder[] = [];
  businessLocations: BusinessLocation[] = [];

  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  
columns = [
  { key: 'actions', label: 'Actions', visible: true },
    { key: 'select', label: 'Select', visible: true }, // Changed from false to true

  { key: 'select', label: 'Select', visible: false }, // Hidden by default
  { key: 'sno', label: 'S.No', visible: false }, // Hidden by default
  { key: 'saleDate', label: 'Sale Date', visible: true },
    { key: 'invoiceNo', label: 'Invoice No', visible: true }, // Change this to true

  { key: 'orderNo', label: 'Order No', visible: true },
    { key: 'orderStatus', label: 'Order Status', visible: true },

  { key: 'customer', label: 'Customer Name', visible: true },
  { key: 'customerPhone', label: 'Contact Number', visible: true },
  { key: 'transactionId', label: 'Transaction ID', visible: true },
  { key: 'location', label: 'Location', visible: true },
  { key: 'status', label: 'Status', visible: true },
  { key: 'typeOfService', label: 'Type of Service', visible: true },
  { key: 'shippingStatus', label: 'Shipping Status', visible: true },
  { key: 'addedBy', label: 'Added By', visible: true },
   { key: 'product', label: 'Product', visible: true },
    { key: 'quantity', label: 'Total Qty', visible: true },
    { key: 'totalPayable', label: 'Total Payable', visible: true },
  
  // All other columns should be hidden by default
  { key: 'alternateContact', label: 'Alternate Contact', visible: false },
  { key: 'product', label: 'Product', visible: true },
  { key: 'shippingAddress', label: 'Shipping Address', visible: false },
  { key: 'paymentMethod', label: 'Payment Method', visible: false },
  { key: 'paymentAccount', label: 'Payment Account', visible: false },
  { key: 'billingAddress', label: 'Billing Address', visible: false },
  { key: 'shippingDetails', label: 'Shipping Details', visible: false },
  { key: 'invoiceNo', label: 'Invoice No', visible: false },
  { key: 'paymentDue', label: 'Payment Due', visible: false },
  { key: 'balanceAmount', label: 'Balance Amount', visible: false },
  { key: 'batchNumber', label: 'Batch No', visible: false },
  { key: 'expiryDate', label: 'Expiry Date', visible: false },
  { key: 'totalPayable', label: 'Total Payable', visible: false },
  { key: 'taxAmount', label: 'Tax Amount', visible: false },
  { key: 'cgstAmount', label: 'CGST', visible: false },
  { key: 'sgstAmount', label: 'SGST', visible: false },
  { key: 'igstAmount', label: 'IGST', visible: false }
];
  
  showFilters = false;
  Math = Math;
  filterOptions: FilterOptions = {
    businessLocation: '',
    customer: '',
    status: '',
    serviceType: '',
        department: '', // <-- ADDED THIS LINE

    shippingStatus: '',
    paymentMethod: '',
    dateRange: {
      startDate: '',
      endDate: ''
    }
  };
  
  currentPage = 1;
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
    private authService: AuthService,
    private userService:UserService
  ) {}

// Make sure these helper methods are present in your component:

/**
 * Helper: Check if any sales are selected
 */
hasSelectedSales(): boolean {
  return this.selectedSales.some(s => s.selected);
}

/**
 * Helper: Toggle selection of a single sale
 */
toggleSelectSale(saleId: string, event: any): void {
  const checked = event.target.checked;
  if (checked) {
    if (!this.selectedSales.find(s => s.id === saleId)) {
      this.selectedSales.push({ id: saleId, selected: true });
    }
  } else {
    this.selectedSales = this.selectedSales.filter(s => s.id !== saleId);
    this.allSelected = false;
  }
}

/**
 * Helper: Toggle select all checkboxes
 */
toggleSelectAll(): void {
  if (this.allSelected) {
    // Select all filtered sales on current page
    const currentPageSales = this.filteredSales.slice(
      (this.currentPage - 1) * this.pageSize,
      this.currentPage * this.pageSize
    );
    
    currentPageSales.forEach(sale => {
      if (!this.isSaleSelected(sale.id)) {
        this.selectedSales.push({ id: sale.id, selected: true });
      }
    });
  } else {
    // Unselect all on current page
    const currentPageSaleIds = this.filteredSales
      .slice((this.currentPage - 1) * this.pageSize, this.currentPage * this.pageSize)
      .map(s => s.id);
    
    this.selectedSales = this.selectedSales.filter(
      s => !currentPageSaleIds.includes(s.id)
    );
  }
}

/**
 * Helper: Check if a sale is selected
 */
isSaleSelected(saleId: string): boolean {
  return this.selectedSales.some(s => s.id === saleId && s.selected);
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
        this.loadUsers(); // Add this call

    this.loadServiceTypes();
    this.setupSearchFilter();
    this.loadSalesData();
  }
// Add these methods inside the SalesOrderComponent class

/**
 * Returns an array of currently active filters for display as chips
 */

// Toggle all checkboxes based on current filtered results
/**
 * ✅ FIXED: Bulk convert selected sales to Completed with proper UI refresh
 */
async bulkConvertToCompleted(): Promise<void> {
  const selectedIds = this.selectedSales
    .filter(sale => sale.selected)
    .map(sale => sale.id);

  if (selectedIds.length === 0) {
    alert('Please select at least one order to convert to Completed');
    return;
  }

  // Get orders to convert (exclude already completed)
  const ordersToConvert = this.filteredSales.filter(sale => 
    selectedIds.includes(sale.id) && sale.orderStatus !== 'Completed'
  );

  if (ordersToConvert.length === 0) {
    alert('All selected orders are already Completed');
    return;
  }

  const skippedCount = selectedIds.length - ordersToConvert.length;
  const confirmMsg = `Are you sure you want to mark ${ordersToConvert.length} selected order(s) as Completed?\n\n` +
    `This will:\n` +
    `- Update order status to Completed\n` +
    `- Reduce stock levels\n` +
    `- Create account ledger entries\n\n` +
    (skippedCount > 0 ? `Note: ${skippedCount} order(s) are already completed and will be skipped.` : '');
  
  if (!confirm(confirmMsg)) return;

  try {
    console.log(`Converting ${ordersToConvert.length} orders to Completed...`);
    
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Process in batches of 5
    const batchSize = 5;
    for (let i = 0; i < ordersToConvert.length; i += batchSize) {
      const batch = ordersToConvert.slice(i, i + batchSize);
      
      await Promise.allSettled(
        batch.map(async (sale) => {
          try {
            console.log(`Converting sale ${sale.id} to Completed...`);
            await this.saleService.updateSaleStatus(sale.id, 'Completed');
            successCount++;
            console.log(`✅ Sale ${sale.id} converted successfully`);
          } catch (error: any) {
            errorCount++;
            errors.push(`Order #${sale.orderNo}: ${error.message}`);
            console.error(`❌ Failed to convert sale ${sale.id}:`, error);
          }
        })
      );
    }

    // ✅ FIX: Clear selections BEFORE showing alert
    this.selectedSales = [];
    this.allSelected = false;
    
    // ✅ FIX: Force UI refresh by manually updating the local data
    // This ensures the UI updates immediately without waiting for Firebase
    ordersToConvert.forEach(convertedSale => {
      const saleInList = this.filteredSales.find(s => s.id === convertedSale.id);
      if (saleInList) {
        saleInList.orderStatus = 'Completed';
        saleInList.status = 'Completed';
      }
    });
    
    // ✅ FIX: Trigger change detection
    this.filteredSales = [...this.filteredSales];
    
    // Show results
    let message = `Bulk conversion completed:\n✅ ${successCount} order(s) successfully converted to Completed`;
    
    if (errorCount > 0) {
      message += `\n❌ ${errorCount} order(s) failed`;
      if (errors.length > 0) {
        message += '\n\nErrors:\n' + errors.slice(0, 5).join('\n');
        if (errors.length > 5) {
          message += `\n... and ${errors.length - 5} more errors`;
        }
      }
    }
    
    alert(message);
    
    // ✅ FIX: Wait a moment for Firebase to sync, then refresh data
    setTimeout(() => {
      console.log('Refreshing sales data after bulk conversion...');
      this.loadSalesData();
    }, 1000);
    
  } catch (error: any) {
    console.error('Error in bulk conversion:', error);
    alert('Error during bulk conversion. Please check the console for details.');
  }
}

/**
 * ✅ FIXED: Convert single sale with proper UI refresh
 */
async convertToCompleted(sale: SalesOrder): Promise<void> {
  if (!sale || !sale.id) {
    alert('Invalid sale data');
    return;
  }

  if (sale.orderStatus === 'Completed') {
    alert('This order is already completed');
    return;
  }

  const confirmMsg = `Are you sure you want to mark Order #${sale.orderNo} as Completed?\n\n` +
    `This will:\n` +
    `- Update the order status to Completed\n` +
    `- Reduce stock levels\n` +
    `- Create account ledger entries`;
  
  if (confirm(confirmMsg)) {
    try {
      console.log(`Converting sale ${sale.id} to Completed...`);
      
      await this.saleService.updateSaleStatus(sale.id, 'Completed');
      
      console.log(`✅ Sale ${sale.id} converted successfully`);
      
      // ✅ FIX: Update local data immediately
      const saleInList = this.filteredSales.find(s => s.id === sale.id);
      if (saleInList) {
        saleInList.orderStatus = 'Completed';
        saleInList.status = 'Completed';
      }
      
      // ✅ FIX: Trigger change detection
      this.filteredSales = [...this.filteredSales];
      
      alert(`Order #${sale.orderNo} has been successfully marked as Completed`);
      
      // Close the modal if it's open
      if (this.actionModal) {
        this.actionModal.hide();
      }
      
      // ✅ FIX: Refresh data after a moment
      setTimeout(() => {
        console.log('Refreshing sales data after conversion...');
        this.loadSalesData();
      }, 1000);
      
    } catch (error: any) {
      console.error('Error converting sale to completed:', error);
      alert('Failed to convert order to Completed: ' + (error.message || 'Unknown error'));
    }
  }
}


/**
 * Removes a specific filter and recalculates the list
 */
removeActiveFilter(key: string): void {
  switch (key) {
    case 'searchTerm':
      this.searchControl.setValue('');
      this.searchTerm = '';
      break;
    case 'dateRange':
      this.filterOptions.dateRange.startDate = '';
      this.filterOptions.dateRange.endDate = '';
      this.dateRangeLabel = '';
      this.selectedRange = '';
      break;
    case 'status':
      this.filterOptions.status = '';
      break;
    case 'department':
      this.filterOptions.department = '';
      break;
    case 'addedBy':
      this.filterOptions.addedBy = '';
      break;
    case 'shippingStatus':
      this.filterOptions.shippingStatus = '';
      break;
    case 'paymentMethod':
      this.filterOptions.paymentMethod = '';
      break;
    case 'businessLocation':
      this.filterOptions.businessLocation = '';
      break;
    case 'commission':
      this.minCommission = null;
      this.maxCommission = null;
      break;
  }
  this.applyFilters();
}
getActiveFilters(): { label: string, key: string }[] {
  const active: { label: string, key: string }[] = [];

  if (this.searchTerm) {
    active.push({ label: `Search: ${this.searchTerm}`, key: 'searchTerm' });
  }

  if (this.dateRangeLabel) {
    active.push({ label: `Date: ${this.dateRangeLabel}`, key: 'dateRange' });
  }

  if (this.filterOptions.status) {
    active.push({ label: `Status: ${this.filterOptions.status}`, key: 'status' });
  }

  // FIXED: Find the Name from the ID for the label
  if (this.filterOptions.businessLocation) {
    const loc = this.businessLocations.find(l => l.id === this.filterOptions.businessLocation);
    active.push({ label: `Location: ${loc ? loc.name : this.filterOptions.businessLocation}`, key: 'businessLocation' });
  }

  // FIXED: Find the Service Name from the ID for the label
  if (this.filterOptions.serviceType) {
    const serv = this.serviceTypes.find(s => s.id === this.filterOptions.serviceType);
    active.push({ label: `Service: ${serv ? serv.name : this.filterOptions.serviceType}`, key: 'serviceType' });
  }

  if (this.filterOptions.addedBy) {
    active.push({ label: `User: ${this.filterOptions.addedBy}`, key: 'addedBy' });
  }

  return active;
}

/**
   * Individual Functionality: Convert a specific Sales Order to 'Completed' status
   * This calls the service which handles stock reduction and ledger entries.
   */
  async updateSaleStatus(sale: SalesOrder, newStatus: string): Promise<void> {
    if (!sale || !sale.id) return;

    const confirmMsg = `Are you sure you want to change Order #${sale.orderNo} status to ${newStatus}? \n\nThis will reduce stock and create account ledger entries if marked as Completed.`;
    
    if (confirm(confirmMsg)) {
      try {
        await this.saleService.updateSaleStatus(sale.id, newStatus);
        
        // UI Notification (Optional)
        console.log(`Sale ${sale.orderNo} updated to ${newStatus}`);
        
        // Note: The onSnapshot listener in loadSalesData() will automatically 
        // refresh the table data when the Firestore document changes.
      } catch (error: any) {
        console.error('Error updating status:', error);
        alert('Failed to update status: ' + error.message);
      }
    }
  }

  /**
   * Bulk Functionality: Change status for all selected checkboxes to 'Completed'
   */
  async bulkUpdateStatus(newStatus: string): Promise<void> {
    const selectedIds = this.selectedSales
      .filter(sale => sale.selected)
      .map(sale => sale.id);

    if (selectedIds.length === 0) {
      alert('Please select at least one sale to update.');
      return;
    }

    const confirmed = confirm(`Are you sure you want to mark ${selectedIds.length} selected orders as "${newStatus}"?`);
    if (!confirmed) return;

    try {
      // Show a simple loading state if needed
      const batchSize = 5; // Update in small chunks to avoid transaction locks
      for (let i = 0; i < selectedIds.length; i += batchSize) {
        const batch = selectedIds.slice(i, i + batchSize);
        await Promise.all(batch.map(id => this.saleService.updateSaleStatus(id, newStatus)));
      }

      // Clear selections
      this.selectedSales = [];
      this.allSelected = false;
      
      alert(`${selectedIds.length} orders updated to ${newStatus} successfully.`);
      
    } catch (error: any) {
      console.error('Error in bulk status update:', error);
      alert('Error updating some orders. Please check logs.');
    }
  }

  // Helper method to get product names for search
  private getProductNames(products: Product[]): string {
    if (!products || products.length === 0) return '';
    return products.map(p => p.name).join(' ');
  }
formatStatus(status: string): string {
  switch ((status || '').toLowerCase()) {
    case 'active':
    case 'completed':
      return 'Completed';
    case 'partial return':
      return 'Partial Return';
    case 'pending':
      return 'Pending';
    case 'inactive':
    case 'cancelled':
      return 'Cancelled';
    default:
      return status || 'Pending';
  }
}

  // Update sorted sales observable
  private updateSortedSales(): void {
    if (this.sortColumn) {
      this.filteredSales = this.sortSalesData([...this.filteredSales], this.sortColumn, this.sortDirection);
    }
  }

  // FIXED: Setup search filter to work with new filter system
  setupSearchFilter(): void {
    this.searchControl.valueChanges.pipe(
      startWith(''),
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(searchTerm => {
      this.searchTerm = searchTerm || '';
      this.applyFilters();
    });
  }
  getTotalQuantity(products: Product[]): number {
    if (!products || products.length === 0) return 0;
    return products.reduce((sum, product) => sum + (product.quantity || 0), 0);
  }  getProductsDisplayText(products: Product[]): string {
    if (!products || products.length === 0) return 'No products';
    
    if (products.length === 1) {
      return `${products[0].name}`; // Simplified to just show the name
    } else {
      return `${products[0].name} and ${products.length - 1} more`;
    }
  }
loadSalesData(): void {
  const filters: any = {};
  
  if (this.currentUser) {
    switch(this.currentUser.role?.toLowerCase()) {
      case 'admin': break;
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

  // combineLatest waits for all streams to emit at least once
  combineLatest([
    this.saleService.listenForSales(filters),
    this.loadUsers(),
    this.loadServiceTypes(),
    this.loadBusinessLocations()
  ]).subscribe({
    next: ([salesFromService, users, serviceTypes, locations]) => {
      const salesWithResolvedNames = salesFromService.map((sale: PartialSalesOrder) => {
        
        // Resolve Names from the fresh arrays provided by combineLatest
        const locationObj = locations.find(loc => loc.id === sale.businessLocation);
        const serviceObj = serviceTypes.find(st => st.id === sale.typeOfService);
        const userObj = users.find(u => u.id === sale.addedBy);

        const productItems = Array.isArray(sale.products) ? sale.products : 
                          Array.isArray(sale.product) ? sale.product : [];
          
        return {
          ...sale,
          id: sale.id || '',
          customer: sale.customer || 'Unknown Customer',
          totalPayable: sale.totalPayable || sale.total || 0,
          saleDate: this.convertSaleDateToString(sale.saleDate),
          orderStatus: sale.orderStatus || sale.status || 'Pending',
          department: sale.department || userObj?.department || '',

          // --- DISPLAY PROPERTIES (This fixes the "System" / "ID" issue) ---
          location: locationObj ? locationObj.name : (sale.location || 'N/A'),
          typeOfService: serviceObj ? serviceObj.name : (sale.typeOfService || 'N/A'),
          typeOfServiceName: serviceObj ? serviceObj.name : (sale.typeOfService || 'N/A'),
          addedByDisplayName: userObj ? userObj.displayName : (sale.addedByDisplayName || 'N/A'),

          // --- LOGIC PROPERTIES ---
          businessLocation: sale.businessLocation || '',
          typeOfServiceId: sale.typeOfService || '',
          addedBy: sale.addedBy || '',

          products: productItems.map(product => ({
            ...product,
            name: product.name || '',
            quantity: product.quantity || 0,
            subtotal: product.subtotal || 0
          }))
        } as unknown as SalesOrder;
      });

      this.allSalesData$.next(salesWithResolvedNames);
      this.applyFilters();
      this.departmentSalesCount = salesWithResolvedNames.length;
    },
    error: (error: any) => console.error('Error loading combined sales data:', error)
  });
}
  applyFilters(): void {
    let filtered = [...this.allSalesData$.value];

    // 1. Date Range Filter
    if (this.filterOptions.dateRange.startDate && this.filterOptions.dateRange.endDate) {
      const startDate = new Date(this.filterOptions.dateRange.startDate);
      const endDate = new Date(this.filterOptions.dateRange.endDate);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);

      filtered = filtered.filter(sale => {
        const saleDate = this.convertToDateForSorting(sale.saleDate);
        return saleDate >= startDate.getTime() && saleDate <= endDate.getTime();
      });
    }

    // 2. Search Term Filter (Checks against Names/Labels)
    if (this.searchTerm && this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase().trim();
      filtered = filtered.filter(sale =>
        this.safeIncludes(sale.customer, term) ||
        this.safeIncludes(sale.orderNo, term) ||
        this.safeIncludes(sale.invoiceNo, term) ||
        this.safeIncludes(sale.location, term) || // Searching by Name
        this.safeIncludes(sale.typeOfService, term) || // Searching by Name
        this.safeIncludes(sale.customerPhone, term) ||
        this.safeIncludes(sale.addedByDisplayName, term)
      );
    }

    // 3. Status Filter (orderStatus)
    if (this.filterOptions.status) {
      filtered = filtered.filter(sale => sale.orderStatus === this.filterOptions.status);
    }

    // 4. Department Filter
    if (this.filterOptions.department) {
      filtered = filtered.filter(sale => sale.department === this.filterOptions.department);
    }

    // 5. FIXED: Location Filter (ID vs ID)
    if (this.filterOptions.businessLocation) {
      filtered = filtered.filter(sale => 
        sale.businessLocation === this.filterOptions.businessLocation
      );
    }

    // 6. FIXED: Service Type Filter (ID vs ID)
    if (this.filterOptions.serviceType) {
      filtered = filtered.filter(sale => 
        (sale as any).typeOfServiceId === this.filterOptions.serviceType
      );
    }

    // 7. Shipping Status Filter
    if (this.filterOptions.shippingStatus) {
      filtered = filtered.filter(sale => sale.shippingStatus === this.filterOptions.shippingStatus);
    }

    // 8. Payment Method Filter
    if (this.filterOptions.paymentMethod) {
      filtered = filtered.filter(sale => sale.paymentMethod === this.filterOptions.paymentMethod);
    }

    // 9. Added By Filter (Checks ID if dropdown provides ID, or Name if custom)
    if (this.filterOptions.addedBy) {
      filtered = filtered.filter(sale => 
        sale.addedBy === this.filterOptions.addedBy || 
        sale.addedByDisplayName === this.filterOptions.addedBy
      );
    }

    this.filteredSales = filtered;
    this.currentPage = 1;
    this.allSelected = false;
    this.updateSortedSales();
}

// Update loadServiceTypes to return the Observable
loadServiceTypes(): Observable<any[]> {
  return this.typeOfServiceService.getServicesRealtime().pipe(
    map(services => {
      this.serviceTypes = services.map(service => ({
        id: service.id,
        name: service.name
      }));
      return this.serviceTypes;
    })
  );
}

// Update loadUsers to return the Observable
loadUsers(): Observable<any[]> {
  return this.userService.getUsers().pipe(
    map(users => {
      this.users = users.map(user => ({
        id: user.id,
        displayName: user.displayName || user.username || user.email,
        department: user.department || ''
      }));
      return this.users;
    })
  );
}

// Update loadBusinessLocations to return the Observable
loadBusinessLocations(): Observable<any[]> {
  return this.locationService.getLocations().pipe(
    map(locations => {
      this.businessLocations = locations.map(loc => ({
        id: loc.id,
        name: loc.name || 'Unnamed Location'
      }));
      return this.businessLocations;
    })
  );
}
  // Helper method to convert Firebase timestamp to string
private convertSaleDateToString(saleDate: any): string {
  if (!saleDate) return new Date().toISOString();
  
  try {
    // Handle Firestore Timestamp
    if (typeof saleDate === 'object' && 'toDate' in saleDate) {
      return saleDate.toDate().toISOString();
    }
    // Handle string date (ensure it's treated as local time)
    if (typeof saleDate === 'string') {
      // If it's already in ISO format, return as-is
      if (saleDate.includes('T')) {
        return saleDate;
      }
      // If it's just a date string (YYYY-MM-DD), add time component
      const parts = saleDate.split('-');
      if (parts.length === 3) {
        const localDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        return localDate.toISOString();
      }
      return `${saleDate}T00:00:00`;
    }
    // Handle Date object
    if (saleDate instanceof Date) {
      return saleDate.toISOString();
    }
  } catch (error) {
    console.error('Error converting sale date:', error);
  }
  
  return new Date().toISOString();
}

  // FIXED: Reset filters method
  resetFilters(): void {
    this.filterOptions = {
      businessLocation: '',
      customer: '',
      status: '',
      shippingStatus: '',
            department: '', // <-- ADDED THIS LINE

      serviceType: '',
      paymentMethod: '',
      dateRange: {
        startDate: '',
        endDate: ''
      }
    };

    this.selectedRange = '';
    this.isCustomDate = false;
    this.dateRangeLabel = '';
    this.searchTerm = '';
    this.statusFilter = '';
    this.paymentMethodFilter = '';
    this.shippingStatusFilter = '';
    this.addedByFilter = '';
    this.locationFilter = '';
    this.startDate = '';
    this.endDate = '';
    this.quickDateFilter = '';
    this.minCommission = null;
    this.maxCommission = null;

    // Reset the search control
    this.searchControl.setValue('');

    // Reset sorting
    this.sortColumn = '';
    this.sortDirection = 'asc';

    // Apply filters (which will now show all data)
    this.applyFilters();
  }
  getUniqueDepartments(): string[] {
    const departments = new Set<string>();
    this.allSalesData$.value.forEach(sale => {
      if (sale.department) {
        departments.add(sale.department);
      }
    });
    return Array.from(departments).sort();
  }

  // Add method to get unique values for filter dropdowns
  getUniqueAddedByUsers(): string[] {
    const users = new Set<string>();
    this.allSalesData$.value.forEach(sale => {
      const userName = sale.addedByDisplayName || sale.addedBy;
      if (userName) {
        users.add(userName);
      }
    });
    return Array.from(users).sort();
  }

  getUniqueLocations(): string[] {
    const locations = new Set<string>();
    this.allSalesData$.value.forEach(sale => {
      const locationName = sale.location || sale.businessLocation;
      if (locationName) {
        locations.add(locationName);
      }
    });
    return Array.from(locations).sort();
  }

  // Update observable when filters change
  private updateObservables(): void {
    this.sales$ = new BehaviorSubject(this.filteredSales).asObservable();
    this.sortedSales$ = this.sales$.pipe(
      map(sales => {
        if (!this.sortColumn) {
          return sales;
        }
        return this.sortSalesData([...sales], this.sortColumn, this.sortDirection);
      })
    );
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
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    return this.filteredSales.slice(startIndex, endIndex);
  }

  getTotalPages(): number {
    return Math.ceil(this.filteredSales.length / this.pageSize);
  }

  getPageNumbers(): number[] {
    const totalPages = this.getTotalPages();
    const maxVisiblePages = 5;
    const pages: number[] = [];
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      const start = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
      const end = Math.min(totalPages, start + maxVisiblePages - 1);
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      if (start > 1) {
        pages.unshift(1);
        if (start > 2) {
          pages.splice(1, 0, -1);
        }
      }
      
      if (end < totalPages) {
        if (end < totalPages - 1) {
          pages.push(-1);
        }
        pages.push(totalPages);
      }
    }
    
    return pages;
  }

  goToPage(page: number): void {
    if (page > 0 && page <= this.getTotalPages() && page !== this.currentPage) {
      this.currentPage = page;
    }
  }

  private getCurrentPageSales(): SalesOrder[] {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    return this.filteredSales.slice(startIndex, endIndex);
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

  getColSpanCount(): number {
    const columns = [
      'actions', 'sno', 'saleDate', 'orderNo', 'customer', 
      'customerPhone', 'location', 'status', 'typeOfService', 
      'shippingStatus', 'addedBy', 'product', 'shippingDetails', 
      'paymentMethod', 'transactionId', 'invoiceNo', 
      'paymentDue', 'balanceAmount', 'taxAmount', 'cgstAmount', 'sgstAmount', 'igstAmount','deppartment'
    ];

 const visibleColumns = this.columns.filter(col => col.visible);
  return visibleColumns.length;  }

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
  
  // Get current date in local timezone
  const today = new Date(); // FIXED: Removed the extra 'new' keyword
  today.setHours(0, 0, 0, 0); // Set to start of day in local time

  const currentMonth = today.getMonth(); // 0 = January, 11 = December
  const currentYear = today.getFullYear();
  
  // Helper function to format date as YYYY-MM-DD in local time
  const formatLocalDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  switch (range) {
    case 'today':
      this.filterOptions.dateRange.startDate = formatLocalDate(today);
      this.filterOptions.dateRange.endDate = formatLocalDate(today);
      this.dateRangeLabel = 'Today';
      break;
      
    case 'yesterday':
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      this.filterOptions.dateRange.startDate = formatLocalDate(yesterday);
      this.filterOptions.dateRange.endDate = formatLocalDate(yesterday);
      this.dateRangeLabel = 'Yesterday';
      break;
      
    case 'last7days':
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      this.filterOptions.dateRange.startDate = formatLocalDate(sevenDaysAgo);
      this.filterOptions.dateRange.endDate = formatLocalDate(today);
      this.dateRangeLabel = 'Last 7 Days';
      break;
      
    case 'last30days':
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
      this.filterOptions.dateRange.startDate = formatLocalDate(thirtyDaysAgo);
      this.filterOptions.dateRange.endDate = formatLocalDate(today);
      this.dateRangeLabel = 'Last 30 Days';
      break;
      
    case 'thisMonth':
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      this.filterOptions.dateRange.startDate = formatLocalDate(firstDayOfMonth);
      this.filterOptions.dateRange.endDate = formatLocalDate(today);
      this.dateRangeLabel = 'This Month';
      break;
      
    case 'lastMonth':
      const firstDayOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastDayOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      this.filterOptions.dateRange.startDate = formatLocalDate(firstDayOfLastMonth);
      this.filterOptions.dateRange.endDate = formatLocalDate(lastDayOfLastMonth);
      this.dateRangeLabel = 'Last Month';
      break;

    case 'thisFinancialYear':
      let startYear = currentMonth >= 3 ? currentYear : currentYear - 1;
      const financialYearStart = new Date(startYear, 3, 1); // April 1st
      const financialYearEnd = new Date(startYear + 1, 2, 31); // March 31st
      
      this.filterOptions.dateRange.startDate = formatLocalDate(financialYearStart);
      this.filterOptions.dateRange.endDate = formatLocalDate(financialYearEnd > today ? today : financialYearEnd);
      this.dateRangeLabel = 'This Financial Year';
      break;

    case 'lastFinancialYear':
      let lastStartYear = currentMonth >= 3 ? currentYear - 1 : currentYear - 2;
      const lastFinancialYearStart = new Date(lastStartYear, 3, 1); // April 1st
      const lastFinancialYearEnd = new Date(lastStartYear + 1, 2, 31); // March 31st
      
      this.filterOptions.dateRange.startDate = formatLocalDate(lastFinancialYearStart);
      this.filterOptions.dateRange.endDate = formatLocalDate(lastFinancialYearEnd);
      this.dateRangeLabel = 'Last Financial Year';
      break;
      
    case 'custom':
      this.selectCustomRange();
      return;
  }
  
  this.applyFilters();
}

selectCustomRange(): void {
  this.selectedRange = 'custom';
  this.isCustomDate = true;
  this.filterOptions.dateRange.startDate = '';
  this.filterOptions.dateRange.endDate = '';
}

private formatDateForInput(date: Date): string {
  return date.toISOString().split('T')[0];
}formatDisplayDate(date: any): string {
  if (!date) return '';
  
  try {
    let jsDate: Date;
    
    if (typeof date === 'object' && 'toDate' in date) {
      jsDate = date.toDate();
    } else if (typeof date === 'string') {
      jsDate = new Date(date.includes('T') ? date : `${date}T00:00:00`);
    } else if (date instanceof Date) {
      jsDate = date;
    } else {
      jsDate = new Date();
    }
    
    return jsDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
}
cancelCustomRange(): void {
  this.isCustomDate = false;
  this.filterOptions.dateRange.startDate = '';
  this.filterOptions.dateRange.endDate = '';
  this.selectedRange = '';
  this.dateRangeLabel = '';
  this.applyFilters();
}

 applyCustomRange(): void {
    // Ensure both dates are selected before applying
    if (this.filterOptions.dateRange.startDate && this.filterOptions.dateRange.endDate) {
      // Create the display label from the selected dates
      const start = this.convertToLocalDate(this.filterOptions.dateRange.startDate);
      const end = this.convertToLocalDate(this.filterOptions.dateRange.endDate);

      // Check for valid dates before setting the label
      if (start && end) {
        this.dateRangeLabel = `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
      }
      
      // Apply the filter and hide the custom date picker
      this.applyFilters();
      this.isCustomDate = false;
    } else {
      alert('Please select both a "From" and "To" date.');
    }
  }
  toggleDateDrawer(): void {
    this.isDateDrawerOpen = !this.isDateDrawerOpen;
    
    if (this.isDateDrawerOpen) {
      this.showFilters = false;
    }
  }





  async deleteSelectedSales(): Promise<void> {
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
      const batchSize = 10;
      for (let i = 0; i < selectedIds.length; i += batchSize) {
        const batch = selectedIds.slice(i, i + batchSize);
        await Promise.all(batch.map(id => this.saleService.deleteSale(id)));
      }
      
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





  getSortIconClass(column: string): string {
    if (this.sortColumn !== column) {
      return 'fa-sort';
    }
    return this.sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
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



  safeIncludes(value: any, searchTerm: string): boolean {
    if (value === null || value === undefined) {
      return false;
    }
    
    const strValue = String(value).toLowerCase();
    return strValue.includes(searchTerm);
  }
  
  toggleFilters(): void {
    this.showFilters = !this.showFilters;
    
    if (this.showFilters) {
      this.isDateDrawerOpen = false;
    }
    
    if (this.showFilters) {
      setTimeout(() => {
        const filterElement = document.querySelector('.filter-sidebar');
        if (filterElement) {
          filterElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  }

  sortData(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    this.updateSortedSales();
  }

  private sortSalesData(sales: SalesOrder[], column: string, direction: 'asc' | 'desc'): SalesOrder[] {
    return sales.sort((a, b) => {
      let valueA: any = a[column as keyof SalesOrder];
      let valueB: any = b[column as keyof SalesOrder];
      
      if (column === 'saleDate') {
        // Handle Firebase timestamp objects for sorting
        valueA = this.convertToDateForSorting(valueA);
        valueB = this.convertToDateForSorting(valueB);
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

  // Helper method to convert various date formats to timestamp for sorting
private convertToDateForSorting(dateValue: any): number {
  if (!dateValue) return 0;
  
  try {
    if (dateValue && typeof dateValue === 'object' && 'toDate' in dateValue) {
      return dateValue.toDate().getTime();
    } else if (typeof dateValue === 'string') {
      return new Date(dateValue).getTime();
    } else if (dateValue instanceof Date) {
      return dateValue.getTime();
    }
  } catch (error) {
    console.error('Error converting date for sorting:', error);
  }
  
  return 0;
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


    
  loadCustomers(): void {
    // In a real application, you would fetch this from a service
  }

  calculateSubtotal(products: any[]): number {
    return products.reduce((sum, product) => sum + (product.unitPrice * product.quantity), 0);
  }

  changePageSize(size: number): void {
    this.pageSize = size;
    this.currentPage = 1;
  }
    
  nextPage(): void {
    if (this.currentPage < this.getTotalPages()) {
      this.currentPage++;
    }
  }
    
  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
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
      
      const currentDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      
      const printWindow = window.open('', '_blank');
      if (printWindow) {
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
        
        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.focus();
            printWindow.print();
          }, 200);
        };
      } else {
        window.print();
      }
    }, 100);
  }

  editSale(saleId: string): void {
    this.router.navigate(['/sales-order/edit', saleId]);
  }

  viewSale(sale: SalesOrder, event?: Event): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    
    this.selectedSale = sale;
    this.viewSaleModal?.show();
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



  // Helper method to convert sale date for display in template
convertSaleDateForDisplay(saleDate: any): Date {
  if (!saleDate) return new Date();
  
  try {
    if (saleDate && typeof saleDate === 'object' && 'toDate' in saleDate) {
      return saleDate.toDate();
    } else if (typeof saleDate === 'string') {
      return new Date(saleDate);
    } else if (saleDate instanceof Date) {
      return saleDate;
    }
  } catch (error) {
    console.error('Error converting sale date for display:', error);
  }
  
  return new Date();
}
  private convertToLocalDate(dateInput: any): Date | null {
    if (!dateInput) return null;
    try {
      if (dateInput instanceof Date) {
        return dateInput;
      }
      // Handle Firebase Timestamp objects
      if (typeof dateInput === 'object' && typeof dateInput.toDate === 'function') {
        return dateInput.toDate();
      }
      if (typeof dateInput === 'string') {
        // If string is "YYYY-MM-DD", it's often parsed as UTC midnight.
        // Appending 'T00:00:00' forces it to be parsed in the local timezone.
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
          return new Date(`${dateInput}T00:00:00`);
        }
        // Handles full ISO strings and other valid date formats
        return new Date(dateInput);
      }
    } catch (error) {
      console.error('Failed to convert date:', dateInput, error);
      return null;
    }
    return null;
  }
  exportToExcel(): void {
  // Prepare the data for export
  const dataForExport = this.filteredSales.map(sale => {
    return {
      'S.No': this.filteredSales.indexOf(sale) + 1,
      'Sale Date': this.formatDisplayDate(sale.saleDate),
      'Order No': sale.orderNo || 'N/A',
      'Customer Name': sale.customer,
      'Contact Number': sale.customerPhone,
      'Location': sale.location,
      'Status': this.formatStatus(sale.status),
      'Type of Service': sale.typeOfServiceName || sale.typeOfService || 'N/A',
      'Shipping Status': sale.shippingStatus || 'Pending',
      'Added By': sale.addedByDisplayName || sale.addedBy || 'N/A',
      'Products': this.getProductsDisplayText(sale.products),
      'Payment Method': sale.paymentMethod || 'N/A',
      'Payment Account': sale.paymentAccountName || 'N/A',
      'Invoice No': sale.invoiceNo || 'N/A',
      'Total Payable': sale.totalPayable || 0,
      'Tax Amount': this.getProductTaxTotal(sale.products),
      'CGST': this.getProductTaxBreakdown(sale.products, 'cgst'),
      'SGST': this.getProductTaxBreakdown(sale.products, 'sgst'),
      'IGST': this.getProductTaxBreakdown(sale.products, 'igst'),
      'Payment Status': sale.paymentStatus || 'Due',
      'Balance Amount': sale.balanceAmount || 0
    };
  });

  // Create worksheet
  const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(dataForExport);

  // Create workbook
  const wb: XLSX.WorkBook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'SalesOrders');

  // Generate file name with current date
  const fileName = `SalesOrders_${new Date().toISOString().slice(0, 10)}.xlsx`;

  // Save to file
  XLSX.writeFile(wb, fileName);
}
}