import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { PurchaseOrderService } from '../services/purchase-order.service';
import { ProductsService } from '../services/products.service';
import { Subscription } from 'rxjs';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { AuthService } from '../auth.service';
import autoTable from 'jspdf-autotable';
import { Modal } from 'bootstrap';
import { LocationService } from '../services/location.service';
import { SupplierService } from '../services/supplier.service';
import { TaxService } from '../services/tax.service';
import { TaxRate } from '../tax/tax.model';

interface PurchaseOrder {
  id: string;
  date: string;
  referenceNo: string;
  requiredByDate: string;
  businessLocation: string;
  businessLocationId: string;
  supplier: string;
  supplierName: string;
  status: string;
  quantityRemaining: number;
  shippingStatus: string;
  shippingCharges: number;
  addedBy: string;
  createdAt?: Date;
    additionalNotes?: string; // Add this line

  brand?: string;
  category?: string;
    isFromRequisition?: boolean; // Add this line

  shippingDate?: string | ((shippingDate: any) => any);
  unitPurchasePrice?: number;
  purchaseTotal?: number;
  requisitionId?: string;
  products: {
    productId: string;
    productName: string;
    quantity: number;
    unitCost: number;
    alertQuantity?: number;
    currentStock?: number;
    requiredQuantity?: number;
    taxPercent?: number;
    hsnCode?: string;
    discountPercent?: number;
    discountAmount?: number;
  }[];
  items?: {
    productId: string;
    productName: string;
    quantity: number;
    unitCost: number;
    alertQuantity?: number;
    currentStock?: number;
    requiredQuantity?: number;
    taxPercent?: number;
    hsnCode?: string;
    discountPercent?: number;
    discountAmount?: number;
  }[];
  locationName?: string;
  shippingDetails?: {
    deliveredTo?: string;
    deliveryPerson?: string;
    note?: string;
    activities?: any[];
  };
  supplierContact?: string;
  supplierAddress?: string;
  orderTotal?: number;
  batchNumber?: string;
  expiryDate?: string | Date;
}

interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  alertQuantity?: number;
  currentStock?: number;
  requiredQuantity?: number;
  batchNumber?: string;
  expiryDate?: string | Date;
  unitPurchasePrice?: number;
  taxPercent?: number;
  hsnCode?: string;
  discountPercent?: number;
  discountAmount?: number;
}

interface Product {
  id: string;
  productName: string;
  sku?: string;
  hsnCode?: string;
  displayTax?: string;
  applicableTax?: string | { name: string; percentage: number };
  purchasePrice?: number;
  sellingPrice?: number;
  defaultPurchasePrice?: number;
  alertQuantity?: number;
  currentStock?: number;
  unitPurchasePrice?: number;
  taxPercentage?: number;
}

@Component({
  selector: 'app-purchase-order',
  templateUrl: './purchase-order.component.html',
  styleUrls: ['./purchase-order.component.scss']
})
export class PurchaseOrderComponent implements OnInit, OnDestroy {
  
  purchaseOrders: PurchaseOrder[] = [];
  filteredOrders: PurchaseOrder[] = [];
  entriesPerPage: number = 10;
  currentPage: number = 1;
  showDateOptions = true;
  showFilterSidebar: boolean = false;
  supplierSearchTerm: string = '';
  taxRates: TaxRate[] = [];
  filteredSuppliers: string[] = [];
  totalPages: number = 1;
  sortColumn: string = '';
  currentActionPopup: string | null = null;
  showSupplierDropdown: boolean = false;
  sortDirection: 'asc' | 'desc' = 'asc';
  showColumnVisibility: boolean = false;
  searchTerm: string = '';
  Math = Math;
  activeActionMenu: string | null = null;
  private ordersSubscription!: Subscription;
  private productsSubscription!: Subscription;
  productsList: Product[] = [];
  selectedShippingStatusForEdit: string = '';
  selectedDeliveredTo: string = '';
  selectedDeliveryPerson: string = '';
  shippingNote: string = '';
  uploadedFiles: File[] = [];
  shippingActivities: any[] = [];
  deliveryPersons: string[] = [''];
  isDateDrawerOpen: boolean = false;
  selectedRange: string = '';
  isCustomDate: boolean = false;
  dateRangeLabel: string = '';
  selectedOrderForEdit: PurchaseOrder | null = null;
  selectedStatusForEdit: string = '';
  private statusModal: Modal | null = null;

  visibleColumns: { [key: string]: boolean } = {
    date: true,
    referenceNo: true,
    requiredByDate: true,
    businessLocation: true,
    products: true,
    status: true,
    addedBy: true,
    supplier: true,
    brand: true,
    category: true,
    shippingStatus: true,
    shippingDate: true,
    totalQuantity: true,
    currentStock: true
  };

  columns = [
    { name: 'Date', visible: true },
    { name: 'Reference No', visible: true },
    { name: 'Brand', visible: true },
    { name: 'Category', visible: true },
    { name: 'Location', visible: true },
    { name: 'Status', visible: true },
    { name: 'Shipping Status', visible: true },
    { name: 'Required by date', visible: true },
    { name: 'Added By', visible: true },
    { name: 'Supplier', visible: true },
    { name: 'Shipping Date', visible: true },
    { name: 'Products', visible: true },
    { name: 'Total Required Qty', visible: true },
    { name: 'Quantity Remaining', visible: true },
    { name: 'Unit Purchase Price', visible: true },
    { name: 'Batch No', visible: true },
    { name: 'Expiry Date', visible: true },
    { name: 'Purchase Price', visible: true },
    { name: 'Supplier Address', visible: true },
    { name: 'Required Date', visible: true }
  ];
  
  businessLocations: string[] = ['All'];
  suppliers: string[] = ['All'];
  statuses: string[] = ['All'];
  shippingStatuses: string[] = ['All'];
  selectedLocation: string = 'All';
  selectedSupplier: string = 'All';
  selectedStatus: string = 'All';
  selectedShippingStatus: string = 'All';
  dateRange: string = '04/01/2025 - 03/31/2026';
  fromDate: Date | null = null;
  toDate: Date | null = null;
  showFilters: any;
  visiblePageNumbers: any;
  showStatusModal: any;

  constructor(
    private orderService: PurchaseOrderService, 
    private router: Router,
    private authService: AuthService, 
    private productsService: ProductsService,
    private locationService: LocationService,
    private supplierService: SupplierService,
    private taxService: TaxService
  ) {}

  ngOnInit(): void {
    this.loadProducts();
    this.loadPurchaseOrders();
    document.addEventListener('click', this.onDocumentClick.bind(this));
    this.filteredSuppliers = [...this.suppliers];
    this.ordersSubscription = this.orderService.getOrders().subscribe(orders => {
  this.applyFilters();
});

  }

  ngOnDestroy(): void {
    if (this.ordersSubscription) {
      this.ordersSubscription.unsubscribe();
    }
    if (this.productsSubscription) {
      this.productsSubscription.unsubscribe();
    }
    document.removeEventListener('click', this.onDocumentClick.bind(this));
  }

  // **CRITICAL FIX: Enhanced editOrder method to ensure proper data loading**
  editOrder(order: PurchaseOrder): void {
    console.log('Editing order:', order);
    
    // Store the current order data in session storage for backup
    sessionStorage.setItem('editingOrder', JSON.stringify(order));
    
    // Navigate to edit page with order ID
    this.router.navigate(['/edit-purchase-order', order.id]).then(
      (success) => {
        if (success) {
          console.log('Navigation to edit page successful');
        } else {
          console.error('Navigation failed');
        }
      }
    ).catch(error => {
      console.error('Navigation error:', error);
    });
    
    this.activeActionMenu = null;
  }
private formatDateForPrint(dateString: string | Date): string {
  if (!dateString) return 'N/A';
  
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (e) {
    return String(dateString);
  }
}
  // Enhanced data loading and mapping
  loadPurchaseOrders(): void {
    this.ordersSubscription = this.orderService.getOrders().subscribe({
      next: (orders: any[]) => {
        console.log('Loaded orders from service:', orders);
        
        this.purchaseOrders = orders.map(order => {
          // Enhanced mapping to ensure all data is properly structured
          const mappedOrder: PurchaseOrder = {
            id: order.id,
            date: order.orderDate || (order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString() : null) || order.date || 'N/A',
            referenceNo: order.referenceNo?.startsWith('PR-') ? order.referenceNo : (order.referenceNo || 'N/A'),
            businessLocation: order.businessLocation || 'N/A',
            businessLocationId: order.businessLocationId || order.location || 'N/A',
            supplier: order.supplier || 'N/A',
            supplierAddress: order.supplierAddress || order.supplier?.address || 'N/A',
            supplierName: order.supplierName || order.supplier || 'Unknown Supplier',
            status: order.status || 'Pending',
            orderTotal: order.orderTotal || this.calculatePurchaseTotal(order),
            requiredByDate: order.requiredDate || order.requiredByDate || order.required_date || 'N/A',
            quantityRemaining: order.quantityRemaining || 0,
            shippingStatus: order.shippingStatus || 'Not Shipped',
            shippingCharges: order.shippingCharges || 0,
            addedBy: order.addedBy || 'System',
            createdAt: order.createdAt?.toDate ? order.createdAt.toDate() : null,
            brand: order.brand || 'N/A',
            category: order.category || 'N/A',
            shippingDate: order.shippingDate || 'N/A',
            purchaseTotal: this.calculatePurchaseTotal(order),
            requisitionId: order.requisitionId || null,

            // **ENHANCED: Ensure items and products are properly mapped**
            items: this.mapOrderItems(order, 'items'),
            products: this.mapOrderItems(order, 'products'),

            locationName: order.locationName || order.businessLocation || 'N/A',
            shippingDetails: {
              deliveredTo: order.shippingDetails?.deliveredTo || '',
              deliveryPerson: order.shippingDetails?.deliveryPerson || '',
              note: order.shippingDetails?.note || '',
              activities: order.shippingDetails?.activities || []
            },
            supplierContact: ''
          };
          
          return mappedOrder;
        });
        
        console.log('Mapped purchase orders:', this.purchaseOrders);
        
        this.extractFilterValues();
        this.applyFilters();
        this.calculateTotalPages();
      },
      error: (err) => {
        console.error('Error loading orders:', err);
      }
    });
  }

  // **ENHANCED: Better item mapping for both items and products**
  private mapOrderItems(order: any, itemType: 'items' | 'products'): OrderItem[] {
    const sourceItems = order[itemType] || order.items || order.products || [];
    
    return sourceItems.map((item: any) => {
      // Find full product details if available
      const fullProduct = this.productsList.find(p => p.id === item.productId);
      
      return {
        productId: item.productId || '',
        productName: item.productName || fullProduct?.productName || 'Unknown Product',
        quantity: item.quantity || item.requiredQuantity || 0,
        requiredQuantity: item.requiredQuantity || item.quantity || 0,
        unitCost: item.unitCost || item.unitPurchasePrice || 0,
        unitPurchasePrice: item.unitPurchasePrice || item.unitCost || 0,
        alertQuantity: item.alertQuantity || fullProduct?.alertQuantity || 0,
        currentStock: item.currentStock || fullProduct?.currentStock || 0,
        batchNumber: item.batchNumber || 'N/A',
        expiryDate: item.expiryDate || 'N/A',
        taxPercent: item.taxPercent || fullProduct?.taxPercentage || 0,
        hsnCode: item.hsnCode || fullProduct?.hsnCode || '',
        discountPercent: item.discountPercent || 0,
        discountAmount: item.discountAmount || 0
      };
    });
  }

  // Rest of the component methods remain the same...
  loadProducts(): void {
    this.productsSubscription = this.productsService.getProductsRealTime().subscribe({
      next: (products: any[]) => {
        this.productsList = products;
      },
      error: (err) => {
        console.error('Error loading products:', err);
      }
    });
  }

  sortTable(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
  
    this.filteredOrders.sort((a, b) => {
      let valueA: any;
      let valueB: any;
  
      if (column === 'products') {
        valueA = this.calculateTotalQuantity(a.products);
        valueB = this.calculateTotalQuantity(b.products);
      } else if (column === 'items') {
        valueA = this.calculateTotalRequiredQuantity(a.items);
        valueB = this.calculateTotalRequiredQuantity(b.items);
      } else {
        valueA = a[column as keyof PurchaseOrder];
        valueB = b[column as keyof PurchaseOrder];
      }
  
      if (column.includes('Date') || column === 'date') {
        valueA = new Date(valueA).getTime();
        valueB = new Date(valueB).getTime();
      }
  
      if (valueA === undefined || valueA === null) valueA = '';
      if (valueB === undefined || valueB === null) valueB = '';
  
      if (valueA < valueB) {
        return this.sortDirection === 'asc' ? -1 : 1;
      } else if (valueA > valueB) {
        return this.sortDirection === 'asc' ? 1 : -1;
      } else {
        return 0;
      }
    });
  }

  toggleFilterSidebar(): void {
    this.showFilterSidebar = !this.showFilterSidebar;
  }

  filterSuppliers(): void {
    if (!this.supplierSearchTerm) {
      this.filteredSuppliers = [...this.suppliers];
      return;
    }
    
    const searchTerm = this.supplierSearchTerm.toLowerCase();
    this.filteredSuppliers = this.suppliers.filter(supplier => 
      supplier.toLowerCase().includes(searchTerm)
    );
  }

  resetFilters(): void {
    this.selectedLocation = 'All';
    this.selectedSupplier = 'All';
    this.selectedStatus = 'All';
    this.supplierSearchTerm = '';
    this.dateRange = '';
    this.fromDate = null;
    this.toDate = null;
    this.applyFilters();
  }

  selectSupplier(supplier: string): void {
    this.selectedSupplier = supplier;
    this.supplierSearchTerm = supplier;
    this.showSupplierDropdown = false;
    this.applyFilters();
  }

  getSortIcon(column: string): string {
    if (this.sortColumn !== column) {
      return 'fa-sort';
    }
    return this.sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  toggleDateDrawer(): void {
    this.showDateOptions = true;
  }

  filterByDate(range: string): void {
    this.selectedRange = range;
    this.isCustomDate = false;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    switch (range) {
      case 'today':
        this.fromDate = new Date(today);
        this.toDate = new Date(today);
        this.dateRangeLabel = 'Today';
        break;
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        this.fromDate = yesterday;
        this.toDate = yesterday;
        this.dateRangeLabel = 'Yesterday';
        break;
      case 'sevenDays':
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        this.fromDate = sevenDaysAgo;
        this.toDate = new Date(today);
        this.dateRangeLabel = 'Last 7 Days';
        break;
      case 'thirtyDays':
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        this.fromDate = thirtyDaysAgo;
        this.toDate = new Date(today);
        this.dateRangeLabel = 'Last 30 Days';
        break;
      case 'lastMonth':
        const firstDayOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastDayOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
        this.fromDate = firstDayOfLastMonth;
        this.toDate = lastDayOfLastMonth;
        this.dateRangeLabel = 'Last Month';
        break;
      case 'thisMonth':
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        this.fromDate = firstDayOfMonth;
        this.toDate = new Date(today);
        this.dateRangeLabel = 'This Month';
        break;
      case 'thisFinancialYear':
        const currentYear = today.getFullYear();
        const financialYearStartMonth = 3;
        
        let financialYearStart;
        if (today.getMonth() >= financialYearStartMonth) {
          financialYearStart = new Date(currentYear, financialYearStartMonth, 1);
        } else {
          financialYearStart = new Date(currentYear - 1, financialYearStartMonth, 1);
        }
        
        this.fromDate = financialYearStart;
        this.toDate = new Date(today);
        this.dateRangeLabel = 'This Financial Year';
        break;
      case 'lastFinancialYear':
        const currentYearForLast = today.getFullYear();
        const financialYearStartMonthForLast = 3;
        
        let lastFinancialYearStart;
        let lastFinancialYearEnd;
        if (today.getMonth() >= financialYearStartMonthForLast) {
          lastFinancialYearStart = new Date(currentYearForLast - 1, financialYearStartMonthForLast, 1);
          lastFinancialYearEnd = new Date(currentYearForLast, financialYearStartMonthForLast, 0);
        } else {
          lastFinancialYearStart = new Date(currentYearForLast - 2, financialYearStartMonthForLast, 1);
          lastFinancialYearEnd = new Date(currentYearForLast - 1, financialYearStartMonthForLast, 0);
        }
        
        this.fromDate = lastFinancialYearStart;
        this.toDate = lastFinancialYearEnd;
        this.dateRangeLabel = 'Last Financial Year';
        break;
    }
    
    this.applyFilters();
    this.isDateDrawerOpen = false;
  }

  selectCustomRange(): void {
    this.selectedRange = 'custom';
    this.isCustomDate = true;
    this.fromDate = null;
    this.toDate = null;
  }

  cancelCustomRange(): void {
    this.isCustomDate = false;
    this.fromDate = null;
    this.toDate = null;
  }

  applyCustomRange(): void {
    if (this.fromDate && this.toDate) {
      this.dateRangeLabel = `${this.formatDate(this.fromDate)} - ${this.formatDate(this.toDate)}`;
      this.applyFilters();
      this.isDateDrawerOpen = false;
    } else {
      alert('Please select both from and to dates');
    }
  }

  openActionPopup(order: PurchaseOrder, event: Event): void {
    event.stopPropagation();
    this.currentActionPopup = order.id;
  }

  closeActionPopup(): void {
    this.currentActionPopup = null;
  }

  @HostListener('document:keydown.escape', ['$event'])
  onKeydownHandler(event: KeyboardEvent) {
    this.closeActionPopup();
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  toggleActionMenu(orderId: string, event: Event): void {
    event.stopPropagation();
    this.activeActionMenu = this.activeActionMenu === orderId ? null : orderId;
  }

  onDocumentClick(event: MouseEvent): void {
    if (!(event.target as HTMLElement).closest('.action-dropdown')) {
      this.activeActionMenu = null;
    }
  }

  calculateTotalQuantity(products: any[]): number {
    if (!products || products.length === 0) return 0;
    return products.reduce((total, product) => total + (product.quantity || 0), 0);
  }

  calculateTotalRequiredQuantity(items: any[] | undefined): number {
    if (!items || items.length === 0) return 0;
    return items.reduce((total, item) => total + (item.requiredQuantity || item.quantity || 0), 0);
  }

  extractFilterValues(): void {
    this.businessLocations = ['All', ...new Set(
      this.purchaseOrders.map(order => order.businessLocation).filter(Boolean)
    )];
    this.suppliers = ['All', ...new Set(
      this.purchaseOrders.map(order => order.supplierName).filter(Boolean)
    )];
    this.statuses = [
      'All', 
      'Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled','Onhold','Reached hub','Out for delivery','Returned','Packed','Ordered'
    ];
    this.shippingStatuses = ['All', ...new Set(
      this.purchaseOrders.map(order => order.shippingStatus).filter(Boolean)
    )];
    
    this.filteredSuppliers = [...this.suppliers];
  }

  calculateTotalPages(): void {
    this.totalPages = Math.ceil(this.filteredOrders.length / this.entriesPerPage);
    if (this.currentPage > this.totalPages && this.totalPages > 0) {
      this.currentPage = this.totalPages;
    } else if (this.totalPages === 0) {
      this.currentPage = 1;
    }
  }

  onSearch(event: any): void {
    const searchTerm = event.target.value.toLowerCase();
    this.applyFilters(searchTerm);
  }

  onDateRangeChange(range: string): void {
    if (range) {
      const [from, to] = range.split(' - ');
      this.fromDate = new Date(from);
      this.toDate = new Date(to);
    } else {
      this.fromDate = null;
      this.toDate = null;
    }
    this.applyFilters();
  }
  
  applyFilters(searchTerm: string = ''): void {
    this.filteredOrders = this.purchaseOrders.filter(order => {
      const searchTermLower = searchTerm.toLowerCase();

      const matchesSearch = searchTerm ? 
        (order.referenceNo?.toLowerCase().includes(searchTermLower) || false) ||
        (order.supplier?.toLowerCase().includes(searchTermLower) || false) ||
        (order.supplierName?.toLowerCase().includes(searchTermLower) || false) ||
        (order.businessLocation?.toLowerCase().includes(searchTermLower) || false) ||
        (order.requiredByDate?.toLowerCase().includes(searchTermLower) || false) ||
        (order.addedBy?.toLowerCase().includes(searchTermLower) || false) ||
        (order.status?.toLowerCase().includes(searchTermLower) || false) ||
        (order.brand?.toLowerCase().includes(searchTermLower) || false) ||
        (order.category?.toLowerCase().includes(searchTermLower) || false) ||
        (order.products?.some(p => p.productName.toLowerCase().includes(searchTermLower)) || false) ||
        (order.date?.toLowerCase().includes(searchTermLower) || false) : true;

      const matchesLocation = this.selectedLocation === 'All' || 
                            order.businessLocation === this.selectedLocation;
      const matchesSupplier = this.selectedSupplier === 'All' || 
                            order.supplierName === this.selectedSupplier;
      const matchesStatus = this.selectedStatus === 'All' || 
                           order.status === this.selectedStatus;
      const matchesShippingStatus = this.selectedShippingStatus === 'All' || 
                                  order.shippingStatus === this.selectedShippingStatus;

      let matchesDateRange = true;
      if (this.fromDate && this.toDate) {
        try {
          const orderDate = new Date(order.date);
          const fromDate = new Date(this.fromDate);
          fromDate.setHours(0, 0, 0, 0);
          const toDate = new Date(this.toDate);
          toDate.setHours(23, 59, 59, 999);
          matchesDateRange = orderDate >= fromDate && orderDate <= toDate;
        } catch (e) {
          console.error('Error parsing dates:', e);
          matchesDateRange = true;
        }
      }

      return matchesSearch && 
             matchesLocation && 
             matchesSupplier && 
             matchesStatus && 
             matchesShippingStatus && 
             matchesDateRange;
    });

    this.calculateTotalPages();
    this.currentPage = 1;
  }

  viewOrder(order: PurchaseOrder): void {
    this.router.navigate(['/purchase-orders/view', order.id]);
    this.activeActionMenu = null;
  }

printOrder(order: PurchaseOrder): void {
  const formattedOrder = this.formatOrderForPrint(order);
  
  const printContent = `
    <html>
      <head>
        <title>Purchase Order - ${formattedOrder.referenceNo}</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            margin: 0; 
            padding: 30px; 
            font-size: 18px;
            line-height: 1.7;
            color: #333;
          }
          .print-header {
            display: flex;
            align-items: center;
            margin-bottom: 20px;
            border-bottom: 2px solid #eee;
            padding-bottom: 20px;
          }
          .logo {
            width: 80px; /* Adjust size as needed */
            height: auto;
            margin-right: 20px;
          }
          .company-info {
            text-align: left;
          }
          .company-name {
            font-size: 24px;
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 5px;
          }
          .company-info p {
            margin: 2px 0;
            font-size: 14px;
          }
          .header { 
            display: flex; 
            justify-content: space-between; 
            margin-bottom: 25px; 
            align-items: flex-start;
          }
          .header-left { 
            flex: 1; 
            padding-right: 30px;
            text-align: left;
          }
          .header-right { 
            flex: 1; 
            text-align: right;
            padding-left: 30px;
          }
          .document-title {
            text-align: center;
            font-size: 36px;
            font-weight: bold;
            margin-bottom: 30px;
            text-transform: uppercase;
            color: #2c3e50;
          }
          .supplier-section {
            margin-bottom: 20px;
            text-align: left;
          }
          .supplier-label {
            font-weight: bold;
            margin-bottom: 10px;
            font-size: 20px;
            color: #2c3e50;
            text-align: left;
          }
          .supplier-details {
            font-size: 18px;
            line-height: 1.5;
            text-align: left;
          }
          .business-section {
            font-size: 18px;
            text-align: right;
          }
          .business-label {
            font-weight: bold;
            margin-bottom: 10px;
            font-size: 20px;
            color: #2c3e50;
            text-align: right;
          }
          .info-row {
            margin-bottom: 5px;
            text-align: right;
          }
          .info-label {
            font-weight: bold;
            display: inline-block;
            min-width: 140px;
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin: 25px 0; 
            font-size: 17px;
          }
          th, td { 
            border: 1px solid #333; 
            padding: 12px 15px; 
            text-align: left; 
            vertical-align: middle;
          }
          th { 
            background-color: #f8f8f8; 
            font-weight: bold; 
            text-align: center;
            font-size: 17px;
            color: #2c3e50;
          }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .text-left { text-align: left; }
          .totals-section { 
            margin-top: 25px; 
            display: flex;
            justify-content: flex-end;
          }
          .totals-table {
            width: 400px;
            font-size: 25px;
            border-collapse: collapse;
          }
          .totals-table td {
            padding: 10px 18px;
            border: none;
            border-bottom: 1px solid #ddd;
          }
          .total-label { 
            font-weight: bold; 
            text-align: left;
          }
          .final-total { 
            font-weight: bold; 
            border-top: 2px solid #333;
            border-bottom: 2px solid #333;
            font-size: 25px;
            background-color: #f8f8f8;
          }
          .notes-section {
            margin-top: 30px;
            font-size: 18px;
            text-align: left;
          }
          .notes-title {
            font-weight: bold;
            margin-bottom: 10px;
            font-size: 20px;
            color: #2c3e50;
            text-align: left;
          }
          .shipping-section {
            margin-top: 30px;
            font-size: 18px;
            text-align: left;
          }
          .shipping-title {
            font-weight: bold;
            margin-bottom: 10px;
            font-size: 20px;
            color: #2c3e50;
            text-align: left;
          }
          .shipping-box {
            height: 40px;
            border: 1px solid #333;
            margin-top: 8px;
          }
          .footer {
            margin-top: 35px;
            display: flex;
            justify-content: space-between;
            font-size: 18px;
            font-weight: 500;
          }
          .footer-left {
            text-align: left;
          }
          .footer-right {
            text-align: right;
          }
          .barcode-section {
            text-align: center;
            margin: 30px 0;
          }
          .barcode-title {
            font-size: 14px;
            margin-bottom: 8px;
            font-weight: bold;
            color: #2c3e50;
          }
          .barcode-display {
            font-family: 'Courier New', monospace;
            font-size: 24px;
            letter-spacing: 1px;
            margin: 8px 0;
          }
          .barcode-text {
            font-size: 12px;
            margin-top: 8px;
          }
          .website-link {
            margin-top: 20px;
            font-size: 12px;
            text-align: center;
            color: #666;
          }
          .no-break { 
            page-break-inside: avoid; 
          }
          .supplier-details div {
            margin-bottom: 3px;
            text-align: left;
          }
          .supplier-details div:first-child {
            font-size: 20px;
            font-weight: bold;
            color: #2c3e50;
            text-align: left;
          }
        </style>
      </head>
      <body>
        <div class="print-header">
            <img src="assets/logo2.png" alt="Company Logo" class="logo">
            <div class="company-info">
                <div class="company-name">HERBALY TOUCH AYURVEDA PRODUCTS PRIVATE LIMITED</div>
                <p><strong>1/438A,Parambussery Kurumassery,Aluva,Ernakulam,Kerala,India</strong></p>
                <p><strong>GST: 32AAGCH3136HIZX | Mobile: 0091778609869</strong></p>
            </div>
        </div>
        
        <div class="header">
          <div class="header-left">
            <div class="supplier-section">
              <div class="supplier-label">Supplier:</div>
              <div class="supplier-details">
                <div>${formattedOrder.supplierName}</div>
                <div>${formattedOrder.supplierAddress}</div>
                <div>Ph: ${formattedOrder.supplierContact || 'N/A'}</div>
              </div>
            </div>
          </div>
          
          <div class="header-right">
            <div class="business-section">
              <div class="business-label">Business:</div>
              <div class="info-row">
                <span class="info-label">Location:</span> ${formattedOrder.businessLocation}
              </div>
              <div class="info-row">
                <span class="info-label">Date:</span> ${formattedOrder.date}
              </div>
              <div class="info-row">
                <span class="info-label">Purchase Status:</span> ${formattedOrder.status}
              </div>
              <div class="info-row">
                <span class="info-label">Shipping:</span> ${formattedOrder.shippingStatus}
              </div>
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 4%;">#</th>
              <th style="width: 28%;">Product Name</th>
              <th style="width: 10%;">SKU</th>
              <th style="width: 8%;">Quantity Remaining</th>
              <th style="width: 8%;">HSN Code</th>
              <th style="width: 6%;">Tax</th>
              <th style="width: 8%;">Unit Cost</th>
              <th style="width: 8%;">Discount</th>
              <th style="width: 10%;">Unit Price (Inc Tax)</th>
              <th style="width: 10%;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${formattedOrder.items.map((item: any, index: number) => {
              const discount = item.discountAmount || 0;
              const unitCostAfterDiscount = item.unitCost - discount;
              const taxAmount = (unitCostAfterDiscount * item.taxPercent) / 100;
              const unitPriceIncTax = unitCostAfterDiscount + taxAmount;
              const lineTotal = unitPriceIncTax * item.quantity;
              
              return `
                <tr>
                  <td class="text-center">${index + 1}</td>
                  <td class="text-left">${item.productName}</td>
                  <td class="text-center">${item.sku || 'N/A'}</td>
                  <td class="text-center">${item.currentStock || 0}</td>
                  <td class="text-center">${item.hsnCode || 'N/A'}</td>
                  <td class="text-center">${item.taxPercent}%</td>
                  <td class="text-right">₹${item.unitCost.toFixed(2)}</td>
                  <td class="text-right">₹${discount.toFixed(2)}</td>
                  <td class="text-right">₹${unitPriceIncTax.toFixed(2)}</td>
                  <td class="text-right">₹${lineTotal.toFixed(2)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div class="totals-section no-break">
          <table class="totals-table">
            <tr>
              <td class="total-label">Total Before Tax:</td>
              <td class="text-right">₹${formattedOrder.subtotalBeforeTax.toFixed(2)}</td>
            </tr>
            ${formattedOrder.taxBreakdown.map((tax: any) => `
              <tr>
                <td class="text-left">${tax.name}:</td>
                <td class="text-right">₹${tax.amount.toFixed(2)}</td>
              </tr>
            `).join('')}
            <tr>
              <td class="total-label">Net Amount:</td>
              <td class="text-right">₹${formattedOrder.netAmount.toFixed(2)}</td>
            </tr>
            <tr>
              <td class="text-left">Add: Shipping charges:</td>
              <td class="text-right">₹${formattedOrder.shippingCharges.toFixed(2)}</td>
            </tr>
            <tr>
              <td class="text-left">Round Off Amount:</td>
              <td class="text-right">₹${formattedOrder.roundOffAmount.toFixed(2)}</td>
            </tr>
            <tr class="final-total">
              <td class="total-label">Purchase Total:</td>
              <td class="text-right">₹${formattedOrder.total.toFixed(2)}</td>
            </tr>
          </table>
        </div>

        <div class="notes-section">
          <div class="notes-title">Additional Notes:</div>
          <div class="text-left">${formattedOrder.additionalNotes || '--'}</div>
        </div>

        <div class="shipping-section">
          <div class="shipping-title">Shipping Details:</div>
          <div class="shipping-box"></div>
        </div>

        <div class="footer">
          <div class="footer-left">
            <strong>Prepared by:</strong> ${formattedOrder.addedBy}
          </div>
          <div class="footer-right">
            <strong>Date:</strong> ${new Date().toLocaleDateString()}
          </div>
        </div>

       
      </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.onload = () => printWindow.print();
  } else {
    alert('Please allow popups for printing.');
  }
}

private formatOrderForPrint(order: PurchaseOrder): any {
  // Get items with enhanced data
  const items = (order.items || order.products || []).map((item: any) => {
    const product = this.productsList.find(p => p.id === item.productId);
    
    return {
      productName: item.productName || 'N/A',
      sku: product?.sku || 'N/A',
      quantity: item.quantity || item.requiredQuantity || 0,
      currentStock: item.currentStock || 0,
      unitCost: item.unitCost || item.unitPurchasePrice || 0,
      taxPercent: item.taxPercent || product?.taxPercentage || 0,
      hsnCode: item.hsnCode || product?.hsnCode || 'N/A',
      discountPercent: item.discountPercent || 0,
      discountAmount: item.discountAmount || 0
    };
  });

  // Calculate financial totals
  let subtotalBeforeTax = 0;
  let totalTaxAmount = 0;
  const taxBreakdown: { [key: string]: number } = {};

  items.forEach(item => {
    const discount = item.discountAmount || 0;
    const unitCostAfterDiscount = item.unitCost - discount;
    const itemSubtotal = unitCostAfterDiscount * item.quantity;
    subtotalBeforeTax += itemSubtotal;

    if (item.taxPercent > 0) {
      const itemTaxAmount = (itemSubtotal * item.taxPercent) / 100;
      totalTaxAmount += itemTaxAmount;

      // Split GST into CGST and SGST
      if (item.taxPercent === 18) {
        const cgstAmount = itemTaxAmount / 2;
        const sgstAmount = itemTaxAmount / 2;
        taxBreakdown['CGST@9%'] = (taxBreakdown['CGST@9%'] || 0) + cgstAmount;
        taxBreakdown['SGST@9%'] = (taxBreakdown['SGST@9%'] || 0) + sgstAmount;
      } else {
        const taxKey = `Tax@${item.taxPercent}%`;
        taxBreakdown[taxKey] = (taxBreakdown[taxKey] || 0) + itemTaxAmount;
      }
    }
  });

  const netAmount = subtotalBeforeTax + totalTaxAmount;
  const shippingCharges = Number(order.shippingCharges) || 0;
  const totalBeforeRounding = netAmount + shippingCharges;
  const roundedTotal = Math.round(totalBeforeRounding);
  const roundOffAmount = roundedTotal - totalBeforeRounding;

  // Format tax breakdown for display
  const taxBreakdownArray = Object.entries(taxBreakdown).map(([name, amount]) => ({
    name,
    amount
  }));

  return {
    ...order,
    referenceNo: order.referenceNo || `PR-${order.id?.substring(0, 8)}`,
    supplierName: order.supplierName || 'Unknown Supplier',
    supplierAddress: order.supplierAddress || 'N/A',
    supplierContact: order.supplierContact || 'N/A',
    date: this.formatDateForPrint(order.date),
    status: order.status || 'Pending',
    shippingStatus: order.shippingStatus || 'Not Shipped',
    businessLocation: order.businessLocation || order.locationName || 'N/A',
    items,
    subtotalBeforeTax,
    totalTaxAmount,
    taxBreakdown: taxBreakdownArray,
    netAmount,
    shippingCharges,
    roundOffAmount,
    total: roundedTotal,
    addedBy: order.addedBy || 'System',
    additionalNotes: order.additionalNotes || ''
  };
}
private prepareOrderForPrint(order: PurchaseOrder): any {
  // Calculate order total if not provided
  const calculatedTotal = this.calculateOrderTotal(order.items || order.products || []);
  
  // Safely handle orderTotal conversion
  let orderTotal: number | undefined;
  if (order.orderTotal !== undefined && order.orderTotal !== null) {
    orderTotal = typeof order.orderTotal === 'string' ? 
                parseFloat(order.orderTotal) : 
                Number(order.orderTotal);
    if (isNaN(orderTotal)) {
      orderTotal = undefined;
    }
  }

  return {
    ...order,
    referenceNo: order.referenceNo || (order.isFromRequisition ? `PR-${order.id?.substring(0, 8)}` : 'N/A'),
    supplierName: order.supplierName || 'Supplier Not Specified',
    businessLocation: order.businessLocation || order.locationName || 'Location Not Specified',
    status: order.status || 'Approved',
    shippingStatus: order.shippingStatus || 'Pending',
    requiredByDate: order.requiredByDate || 'N/A',
    items: order.items || order.products || [],
    orderTotal: orderTotal ?? calculatedTotal
  };
}

private calculateOrderTotal(items: Array<{quantity?: number, requiredQuantity?: number, unitCost?: number, unitPurchasePrice?: number}>): number {
  if (!items || !Array.isArray(items)) return 0;
  
  return items.reduce((total: number, item) => {
    const quantity = item.quantity || item.requiredQuantity || 0;
    const unitCost = item.unitCost || item.unitPurchasePrice || 0;
    return total + (quantity * unitCost);
  }, 0);
}

  // Helper method to calculate round off amount
  private calculateRoundOff(order: PurchaseOrder): number {
    const total = this.calculateNetTotal(order) + (order.shippingCharges || 0);
    const rounded = Math.round(total);
    return rounded - total;
  }

  renderTaxBreakdownForPrint(order: PurchaseOrder): string {
    const taxBreakdown: { [key: string]: number } = {};
    
    (order.items || order.products || []).forEach(item => {
      const product = this.productsList.find(p => p.id === item.productId);
      const quantity = item.quantity || item.requiredQuantity || 0;
      const unitCost = item.unitCost || 0;
      const itemTotal = quantity * unitCost;
      
      if (product && product.applicableTax) {
        let taxName = '';
        let taxPercentage = 0;
        
        if (typeof product.applicableTax === 'string') {
          taxName = product.applicableTax;
          const match = taxName.match(/\((\d+(?:\.\d+)?)\%\)/);
          if (match) {
            taxPercentage = parseFloat(match[1]);
          }
        } else if (product.applicableTax.name && product.applicableTax.percentage) {
          taxName = product.applicableTax.name;
          taxPercentage = product.applicableTax.percentage;
        }
        
        if (taxName && taxPercentage > 0) {
          const taxAmount = (itemTotal * taxPercentage) / 100;
          
          if (taxName.toLowerCase().includes('gst')) {
            const cgstAmount = taxAmount / 2;
            const sgstAmount = taxAmount / 2;
            
            taxBreakdown[`CGST (${taxPercentage/2}%)`] = (taxBreakdown[`CGST (${taxPercentage/2}%)`] || 0) + cgstAmount;
            taxBreakdown[`SGST (${taxPercentage/2}%)`] = (taxBreakdown[`SGST (${taxPercentage/2}%)`] || 0) + sgstAmount;
          } else {
            taxBreakdown[`${taxName} (${taxPercentage}%)`] = (taxBreakdown[`${taxName} (${taxPercentage}%)`] || 0) + taxAmount;
          }
        }
      }
    });
    
    let taxRows = '';
    for (const [taxName, taxAmount] of Object.entries(taxBreakdown)) {
      if (taxAmount > 0) {
        taxRows += `
          <tr>
            <td class="label">${taxName}:</td>
            <td class="text-right">₹${taxAmount.toFixed(2)}</td>
          </tr>
        `;
      }
    }
    
    return taxRows;
  }

downloadPdf(order: PurchaseOrder): void {
  // Create new PDF document
  const doc = new jsPDF();
  
  // Set document properties
  doc.setProperties({
    title: `Purchase Order - ${order.referenceNo}`,
    subject: 'Purchase Order Details',
    author: 'Your Company Name'
  });

  // Page margins and dimensions
  const margins = { left: 20, right: 20, top: 20 };
  const pageWidth = doc.internal.pageSize.width;
  const contentWidth = pageWidth - margins.left - margins.right;
  
  let currentY = margins.top;

  // Helper function for adding sections with consistent spacing
  const addSection = (height: number) => {
    currentY += height;
    return currentY;
  };

  // Add logo placeholder (if available)
  // doc.addImage(logoData, 'JPEG', margins.left, currentY, 40, 20);

  // Company Information - Centered and well-spaced
  doc.setFontSize(18);
  doc.setTextColor(51, 51, 51);
  doc.setFont('helvetica', 'bold');
  doc.text('YOUR COMPANY NAME', pageWidth / 2, addSection(25), { align: 'center' });
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(85, 85, 85);
  doc.text('123 Business Street', pageWidth / 2, addSection(8), { align: 'center' });
  doc.text('City, State, ZIP Code', pageWidth / 2, addSection(6), { align: 'center' });
  doc.text('Phone: (123) 456-7890 | Email: info@company.com', pageWidth / 2, addSection(6), { align: 'center' });

  // Purchase Order Title with better styling
  addSection(15);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(41, 98, 255); // Modern blue
  doc.text('PURCHASE ORDER', pageWidth / 2, currentY, { align: 'center' });

  // Decorative line under title
  addSection(10);
  doc.setDrawColor(41, 98, 255);
  doc.setLineWidth(0.8);
  doc.line(margins.left + 50, currentY, pageWidth - margins.right - 50, currentY);

  // Two-column layout for order and supplier info
  addSection(20);
  const columnWidth = contentWidth / 2 - 10;
  const leftColumnX = margins.left;
  const rightColumnX = margins.left + columnWidth + 20;

  // Order Information Section
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 51, 51);
  doc.text('Order Information', leftColumnX, currentY);

  // Order info box
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.5);
  doc.rect(leftColumnX, currentY + 5, columnWidth, 45);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(68, 68, 68);
  
  const orderInfoY = currentY + 15;
  const orderInfo = [
    { label: 'Order Number:', value: order.referenceNo || 'N/A' },
    { label: 'Order Date:', value: this.formatDateForPdf(order.date) },
    { label: 'Required By:', value: this.formatDateForPdf(order.requiredByDate) },
    { label: 'Status:', value: order.status || 'N/A' }
  ];

  orderInfo.forEach((info, index) => {
    const yPos = orderInfoY + (index * 8);
    doc.setFont('helvetica', 'bold');
    doc.text(info.label, leftColumnX + 5, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(info.value, leftColumnX + 45, yPos);
  });

  // Supplier Information Section
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 51, 51);
  doc.text('Supplier Information', rightColumnX, currentY);

  // Supplier info box
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.5);
  doc.rect(rightColumnX, currentY + 5, columnWidth, 45);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(68, 68, 68);
  
  const supplierInfoY = currentY + 15;
  const supplierInfo = [
    { label: 'Name:', value: order.supplierName || 'N/A' },
    { label: 'Address:', value: order.supplierAddress || 'N/A' },
    { label: 'Contact:', value: order.supplierContact || 'N/A' }
  ];

  supplierInfo.forEach((info, index) => {
    const yPos = supplierInfoY + (index * 8);
    doc.setFont('helvetica', 'bold');
    doc.text(info.label, rightColumnX + 5, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(info.value, rightColumnX + 35, yPos);
  });

  // Items Table
  addSection(65);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 51, 51);
  doc.text('Order Items', margins.left, currentY);

  addSection(15);
  
  // Enhanced table with better column widths and alignment
  const tableHeaders = [
    { label: '#', width: 15, align: 'center' as const },
    { label: 'Product Name', width: 60, align: 'left' as const },
    { label: 'SKU', width: 30, align: 'center' as const },
    { label: 'Qty', width: 20, align: 'center' as const },
    { label: 'Unit Price', width: 30, align: 'right' as const },
    { label: 'Total', width: 35, align: 'right' as const }
  ];
  
  const tableWidth = tableHeaders.reduce((sum, header) => sum + header.width, 0);
  const tableStartX = margins.left;
  
  // Table header with gradient-like effect
  doc.setFillColor(41, 98, 255);
  doc.rect(tableStartX, currentY, tableWidth, 12, 'F');
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  
  let xPos = tableStartX;
  tableHeaders.forEach(header => {
    const textX = header.align === 'center' ? xPos + (header.width / 2) : 
                  header.align === 'right' ? xPos + header.width - 3 : xPos + 3;
    doc.text(header.label, textX, currentY + 8, { align: header.align });
    xPos += header.width;
  });

  // Table rows with alternating colors
  addSection(12);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 51, 51);
  
  const items = order.items || order.products || [];
  items.forEach((item, index) => {
    const product = this.productsList.find(p => p.id === item.productId);
    const quantity = item.quantity || item.requiredQuantity || 0;
    const unitCost = item.unitCost || 0;
    const total = quantity * unitCost;
    
    // Alternating row colors
    if (index % 2 === 0) {
      doc.setFillColor(248, 249, 250);
      doc.rect(tableStartX, currentY - 2, tableWidth, 10, 'F');
    }
    
    const rowData = [
      { value: (index + 1).toString(), align: 'center' as const },
      { value: item.productName || 'N/A', align: 'left' as const },
      { value: product?.sku || 'N/A', align: 'center' as const },
      { value: quantity.toString(), align: 'center' as const },
      { value: this.formatCurrency(unitCost), align: 'right' as const },
      { value: this.formatCurrency(total), align: 'right' as const }
    ];
    
    xPos = tableStartX;
    rowData.forEach((cell, cellIndex) => {
      const header = tableHeaders[cellIndex];
      const textX = header.align === 'center' ? xPos + (header.width / 2) : 
                    header.align === 'right' ? xPos + header.width - 3 : xPos + 3;
      
      // Truncate long text to fit in cell
      let displayText = cell.value;
      if (cellIndex === 1 && displayText.length > 25) { // Product name
        displayText = displayText.substring(0, 22) + '...';
      }
      
      doc.text(displayText, textX, currentY + 6, { align: header.align });
      xPos += header.width;
    });
    
    addSection(10);
  });

  // Table border
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.5);
  doc.rect(tableStartX, currentY - (items.length * 10) - 12, tableWidth, (items.length * 10) + 12);

  // Summary Section with modern styling
  addSection(20);
  const summaryBoxWidth = 120;
  const summaryBoxX = pageWidth - margins.right - summaryBoxWidth;
  
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 51, 51);
  doc.text('Order Summary', summaryBoxX, currentY);

  addSection(10);
  
  // Summary box
  doc.setDrawColor(220, 220, 220);
  doc.setFillColor(252, 252, 252);
  doc.rect(summaryBoxX, currentY, summaryBoxWidth, 50, 'FD');

  const subtotal = this.calculateTotalBeforeTax(order);
  const taxAmount = this.calculateTaxAmount(order);
  const shipping = order.shippingCharges || 0;
  const total = subtotal + taxAmount + shipping;

  const summaryData = [
    { label: 'Subtotal:', value: this.formatCurrency(subtotal), bold: false },
    { label: 'Tax:', value: this.formatCurrency(taxAmount), bold: false },
    { label: 'Shipping:', value: this.formatCurrency(shipping), bold: false },
    { label: 'Total:', value: this.formatCurrency(total), bold: true }
  ];

  doc.setFontSize(11);
  summaryData.forEach((item, index) => {
    const yPos = currentY + 10 + (index * 10);
    
    if (item.bold) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      
      // Highlight total row
      doc.setFillColor(41, 98, 255);
      doc.rect(summaryBoxX + 2, yPos - 6, summaryBoxWidth - 4, 8, 'F');
      doc.setTextColor(255, 255, 255);
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(68, 68, 68);
    }
    
    doc.text(item.label, summaryBoxX + 5, yPos);
    doc.text(item.value, summaryBoxX + summaryBoxWidth - 5, yPos, { align: 'right' });
  });

  // Footer section
  addSection(80);
  doc.setDrawColor(220, 220, 220);
  doc.line(margins.left, currentY, pageWidth - margins.right, currentY);

  addSection(15);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(41, 98, 255);
  doc.text('Thank you for your business!', pageWidth / 2, currentY, { align: 'center' });

  addSection(10);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(136, 136, 136);
  doc.text(`Generated on: ${new Date().toLocaleString()}`, pageWidth / 2, currentY, { align: 'center' });

  // Add page numbers if needed
  doc.setFontSize(8);
  doc.text(`Page 1 of 1`, pageWidth - margins.right, doc.internal.pageSize.height - 10, { align: 'right' });

  // Save the PDF
  doc.save(`Purchase_Order_${order.referenceNo}.pdf`);
  this.activeActionMenu = null;
}

// In purchase-order.component.ts

async saveOrderChanges(order: PurchaseOrder, updatedData: Partial<PurchaseOrder>): Promise<void> {
  try {
    // Convert the updatedData to match the service's expected type
    const serviceCompatibleData: any = {
      ...updatedData,
      shippingDate: typeof updatedData.shippingDate === 'function' ? 
                   updatedData.shippingDate : 
                   (updatedData.shippingDate || order.shippingDate)
    };
    
    await this.orderService.updateOrderAndRequisition(order.id, serviceCompatibleData);
    this.loadPurchaseOrders(); // Refresh the list
    alert('Order and linked requisition updated successfully!');
  } catch (error) {
    console.error('Error updating order:', error);
    alert('Failed to update order');
  }
}

  deleteOrder(order: PurchaseOrder): void {
    if (confirm('Are you sure you want to delete this order?')) {
      this.orderService.deleteOrder(order.id).then(() => {
        this.loadPurchaseOrders();
      }).catch(err => {
        console.error('Error deleting order:', err);
      });
      this.activeActionMenu = null;
    }
  }

  private calculateTotalBeforeTax(order: PurchaseOrder): number {
    if (!order.items && !order.products) return 0;
    const items = order.items || order.products || [];
    return items.reduce((total, item) => {
      const quantity = item.quantity || item.requiredQuantity || 0;
      const unitCost = item.unitCost || 0;
      return total + (quantity * unitCost);
    }, 0);
  }

  private calculateNetTotal(order: PurchaseOrder): number {
    const subtotal = this.calculateTotalBeforeTax(order);
    const taxAmount = this.calculateTaxAmount(order);
    return subtotal + taxAmount;
  }

  private calculatePurchaseTotal(order: PurchaseOrder): number {
    if (order.orderTotal) return order.orderTotal;
    
    if (!order.items && !order.products) return 0;
    
    const items = order.items || order.products || [];
    const subtotal = items.reduce((total, item) => {
      const quantity = item.quantity || item.requiredQuantity || 0;
      const unitCost = item.unitCost || 0;
      return total + (quantity * unitCost);
    }, 0);
    
    const taxAmount = this.calculateTaxAmount(order);
    const shippingCharges = order.shippingCharges || 0;
    const roundOff = this.calculateRoundOff(order);
    
    return subtotal + taxAmount + shippingCharges + roundOff;
  }

  addPurchaseForOrder(order: PurchaseOrder, event: Event): void {
    event.stopPropagation();
    this.router.navigate(['/add-purchase', { orderId: order.id }]);
  }

  openStatusModal(order: PurchaseOrder, modalId: string): void {
    this.selectedOrderForEdit = order;
    this.selectedShippingStatusForEdit = order.shippingStatus || 'Pending';
    this.selectedDeliveredTo = order.shippingDetails?.deliveredTo || order.businessLocation || '';
    this.selectedDeliveryPerson = order.shippingDetails?.deliveryPerson || '';
    this.shippingNote = order.shippingDetails?.note || '';
    this.uploadedFiles = [];
    this.shippingActivities = order.shippingDetails?.activities || [];
    
    const modalElement = document.getElementById(modalId);
    if (modalElement) {
      this.statusModal = new Modal(modalElement);
      this.statusModal.show();
    }
    
    this.activeActionMenu = null;
  }

  onFileSelected(event: any): void {
    this.uploadedFiles = Array.from(event.target.files);
  }

  saveShippingStatusChanges(): void {
    if (this.selectedOrderForEdit) {
      const orderId = this.selectedOrderForEdit.id;
      
      const currentUser = this.authService.getCurrentUserName();
      
      const shippingDetails = {
        status: this.selectedShippingStatusForEdit,
        deliveredTo: this.selectedDeliveredTo,
        deliveryPerson: this.selectedDeliveryPerson,
        note: this.shippingNote,
        documents: this.uploadedFiles?.map(file => file.name) || [],
        activities: [
          ...(this.selectedOrderForEdit.shippingDetails?.activities || []),
          {
            date: new Date(),
            action: 'Status updated to ' + this.selectedShippingStatusForEdit,
            by: currentUser,
            note: this.shippingNote
          }
        ]
      };
      
      this.orderService.updateOrderShippingDetails(orderId, shippingDetails).then(() => {
        const orderToUpdateInMain = this.purchaseOrders?.find(o => o.id === orderId);
        const orderToUpdateInFiltered = this.filteredOrders?.find(o => o.id === orderId);
        
        if (orderToUpdateInMain) {
          orderToUpdateInMain.shippingStatus = this.selectedShippingStatusForEdit;
          orderToUpdateInMain.shippingDetails = shippingDetails;
        }
        
        if (orderToUpdateInFiltered) {
          orderToUpdateInFiltered.shippingStatus = this.selectedShippingStatusForEdit;
          orderToUpdateInFiltered.shippingDetails = shippingDetails;
        }
        
        if (this.selectedOrderForEdit) {
          this.selectedOrderForEdit.shippingStatus = this.selectedShippingStatusForEdit;
          this.selectedOrderForEdit.shippingDetails = shippingDetails;
        }
        
        if (this.statusModal) {
          this.statusModal.hide();
        }
        
        alert('Shipping details updated successfully!');
      }).catch(error => {
        console.error('Error updating shipping details:', error);
        alert('Failed to update shipping details');
      });
    }
  }

  private formatDateForPdf(dateString: string | Date): string {
    if (!dateString) return 'N/A';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (e) {
      return String(dateString);
    }
  }

  private formatCurrency(amount: number): string {
    return '₹' + amount.toFixed(2);
  }

  private calculateTaxAmount(order: PurchaseOrder): number {
    if (!order.items && !order.products) return 0;
    
    const items = order.items || order.products || [];
    return items.reduce((totalTax, item) => {
      const product = this.productsList.find(p => p.id === item.productId);
      if (!product) return totalTax;
      
      const quantity = item.quantity || item.requiredQuantity || 0;
      const unitCost = item.unitCost || 0;
      const itemTotal = quantity * unitCost;
      
      let taxRate = 0;
      if (typeof product.applicableTax === 'string') {
        // Extract tax rate from string if needed
        const match = product.applicableTax.match(/(\d+)%/);
        taxRate = match ? parseFloat(match[1]) : 0;
      } else if (product.applicableTax?.percentage) {
        taxRate = product.applicableTax.percentage;
      }
      
      return totalTax + (itemTotal * taxRate / 100);
    }, 0);
  }

  closeStatusModal(): void {
    if (this.statusModal) {
      this.statusModal.hide();
    }
  }

  exportToExcel() {
    this.exportExcel();
  }

  exportToPDF() {
    this.exportPDF();
  }

  clearSearch() {
    this.searchTerm = '';
    this.applyFilters();
  }

  toggleFilters() {
    this.toggleFilterSidebar();
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  exportCSV(): void {
    const headers = [
      'Date', 
      'Reference No', 
      'Required Date', 
      'Location', 
      'Supplier', 
      'Brand',
      'Category',
      'Status', 
      'Shipping Status',
      'Shipping Date',
      'Products',
      'Total Quantity',
      'Added By'
    ];
    
    const data = this.filteredOrders.map(order => [
      order.date,
      order.referenceNo,
      order.requiredByDate,
      order.businessLocation,
      order.supplierName,
      order.brand,
      order.category,
      order.status,
      order.shippingStatus,
      order.shippingDate,
      order.products.map(p => `${p.productName} (${p.quantity})`).join(', '),
      this.calculateTotalQuantity(order.products),
      order.addedBy
    ]);

    let csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(',') + '\n'
      + data.map(row => row.join(',')).join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'purchase_orders.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  exportExcel(): void {
    const data = this.filteredOrders.map(order => ({
      'Date': order.date,
      'Reference No': order.referenceNo,
      'Required Date': order.requiredByDate,
      'Location': order.businessLocation,
      'Supplier': order.supplierName,
      'Brand': order.brand,
      'Category': order.category,
      'Status': order.status,
      'Shipping Status': order.shippingStatus,
      'Shipping Date': order.shippingDate,
      'Products': order.products.map(p => `${p.productName} (${p.quantity})`).join(', '),
      'Total Quantity': this.calculateTotalQuantity(order.products),
      'Added By': order.addedBy
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Purchase Orders');
    XLSX.writeFile(workbook, 'purchase_orders.xlsx');
  }

  exportPDF(): void {
    const doc = new jsPDF();
    doc.text('Purchase Orders', 10, 10);
    
    const headers = [
      ['Date', 'Reference No', 'Location', 'Supplier', 'Status', 'Products', 'Added By']
    ];
    
    const data = this.filteredOrders.map(order => [
      order.date,
      order.referenceNo,
      order.businessLocation,
      order.supplierName,
      order.status,
      order.products.map(p => `${p.productName} (${p.quantity})`).join(', ').substring(0, 30) + '...',
      order.addedBy
    ]);

    autoTable(doc, {
      head: headers,
      body: data,
      startY: 20,
      styles: { overflow: 'ellipsize', cellWidth: 'wrap' },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 25 },
        2: { cellWidth: 25 },
        3: { cellWidth: 25 },
        4: { cellWidth: 25 },
        5: { cellWidth: 60 },
        6: { cellWidth: 25 }
      }
    });

    doc.save('purchase_orders.pdf');
  }

  print(): void {
    const printContent = `
      <h2>Purchase Orders</h2>
      <table border="1" style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            <th>Date</th>
            <th>Reference No</th>
            <th>Required Date</th>
            <th>Location</th>
            <th>Supplier</th>
            <th>Brand</th>
            <th>Category</th>
            <th>Status</th>
            <th>Shipping Status</th>
            <th>Shipping Date</th>
            <th>Products</th>
            <th>Added By</th>
          </tr>
        </thead>
        <tbody>
          ${this.filteredOrders.map(order => `
            <tr>
              <td>${order.date}</td>
              <td>${order.referenceNo}</td>
              <td>${order.requiredByDate}</td>
              <td>${order.businessLocation}</td>
              <td>${order.supplierName}</td>
              <td>${order.brand}</td>
              <td>${order.category}</td>
              <td>${order.status}</td>
              <td>${order.shippingStatus}</td>
              <td>${order.shippingDate}</td>
              <td>${order.products.map(p => `${p.productName} (${p.quantity})`).join(', ')}</td>
              <td>${order.addedBy}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    const printWindow = window.open('', '_blank');
    printWindow?.document.write(printContent);
    printWindow?.document.close();
    printWindow?.focus();
    printWindow?.print();
  }

  toggleColumnVisibility(): void {
    this.showColumnVisibility = !this.showColumnVisibility;
  }
  
  updateColumnVisibility(column: any): void {
    if (!column.visible && this.hasVisibleColumns()) {
      column.visible = !column.visible;
    }
  }

  openFilterSidebar(): void {
    this.showFilterSidebar = true;
  }

  closeFilterSidebar(): void {
    this.showFilterSidebar = false;
  }

  hasVisibleColumns(): boolean {
    return this.columns.filter(col => col.visible).length > 1;
  }
  
  getVisibleColumnsCount(): number {
    return this.columns.filter(col => col.visible).length;
  }

  getFirstEntryIndex(): number {
    if (this.filteredOrders.length === 0) return 0;
    return (this.currentPage - 1) * this.entriesPerPage + 1;
  }

  getLastEntryIndex(): number {
    const lastIndex = this.currentPage * this.entriesPerPage;
    return Math.min(lastIndex, this.filteredOrders.length);
  }
  
  trackByFn(index: number, item: any): string {
    return item.id;
  }

  addPurchaseOrder(): void {
    this.router.navigate(['/add-purchase-order']);
  }

  onEntriesChange(): void {
    this.entriesPerPage = Number(this.entriesPerPage);
    this.calculateTotalPages();
    this.currentPage = 1;
  }
}