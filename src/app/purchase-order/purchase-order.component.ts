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
   batchNumber?: string;  // Add this
    expiryDate?: string | Date;
  status: string;
  quantityRemaining: number;
  shippingStatus: string;
  shippingCharges: number;
  addedBy: string;
  createdAt?: Date;
  brand?: string;
  category?: string;
  shippingDate?: string;
  requisitionId?: string;
  products: {
    productId: string;
    productName: string;
    quantity: number;
    unitCost: number;
    alertQuantity?: number;
    currentStock?: number;
    requiredQuantity?: number;
  }[];
  items?: {
    productId: string;
    productName: string;
    quantity: number;
    unitCost: number;
    alertQuantity?: number;
    currentStock?: number;
    requiredQuantity?: number;
    
  }[];
  locationName?: string;
  shippingDetails?: {
    deliveredTo?: string;
    deliveryPerson?: string;
    
    note?: string;
    activities?: any[];
  };
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
  // Add other properties that might be needed
}

@Component({
  selector: 'app-purchase-order',
  templateUrl: './purchase-order.component.html',
  styleUrls: ['./purchase-order.component.scss']
})
export class PurchaseOrderComponent implements OnInit, OnDestroy {
  exportToExcel() {
    throw new Error('Method not implemented.');
  }
  exportToPDF() {
    throw new Error('Method not implemented.');
  }
  clearSearch() {
    throw new Error('Method not implemented.');
  }
  toggleFilters() {
    throw new Error('Method not implemented.');
  }
  goToPage(arg0: number) {
    throw new Error('Method not implemented.');
  }
  
  purchaseOrders: PurchaseOrder[] = [];
  filteredOrders: PurchaseOrder[] = [];
  entriesPerPage: number = 25;
  currentPage: number = 1;
  showFilterSidebar: boolean = false;
supplierSearchTerm: string = '';
  taxRates: TaxRate[] = []; // Array to store tax rates

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
  deliveryPersons: string[] = ['']; // Example data
// Add these properties to your component class
isDateDrawerOpen: boolean = false;
selectedRange: string = '';
isCustomDate: boolean = false;
dateRangeLabel: string = '';
  selectedOrderForEdit: PurchaseOrder | null = null;
  selectedStatusForEdit: string = '';
  private statusModal: Modal | null = null;
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
  
      // Special handling for nested properties
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
  
      // Handle dates
      if (column.includes('Date') || column === 'date') {
        valueA = new Date(valueA).getTime();
        valueB = new Date(valueB).getTime();
      }
  
      // Handle undefined/null values
      if (valueA === undefined || valueA === null) valueA = '';
      if (valueB === undefined || valueB === null) valueB = '';
  
      // Compare values
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
  
  // Add visibleColumns property
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
    { name: 'Unit Purchase Price', visible: true }, // Add this new column
        { name: 'Batch No', visible: true },
    { name: 'Expiry Date', visible: true },
    { name: 'Shipping Status', visible: true }, // Make sure this is included


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
// Add these methods to your component class
toggleDateDrawer(): void {
  this.isDateDrawerOpen = !this.isDateDrawerOpen;
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
      // Assuming financial year starts April 1 (common in many countries)
      const currentYear = today.getFullYear();
      const financialYearStartMonth = 3; // April (0-indexed)
      
      let financialYearStart;
      if (today.getMonth() >= financialYearStartMonth) {
        // Current financial year started this year
        financialYearStart = new Date(currentYear, financialYearStartMonth, 1);
      } else {
        // Current financial year started last year
        financialYearStart = new Date(currentYear - 1, financialYearStartMonth, 1);
      }
      
      this.fromDate = financialYearStart;
      this.toDate = new Date(today);
      this.dateRangeLabel = 'This Financial Year';
      break;
    case 'lastFinancialYear':
      const currentYearForLast = today.getFullYear();
      const financialYearStartMonthForLast = 3; // April (0-indexed)
      
      let lastFinancialYearStart;
      let lastFinancialYearEnd;
      if (today.getMonth() >= financialYearStartMonthForLast) {
        // Last financial year was previous year to current year
        lastFinancialYearStart = new Date(currentYearForLast - 1, financialYearStartMonthForLast, 1);
        lastFinancialYearEnd = new Date(currentYearForLast, financialYearStartMonthForLast, 0);
      } else {
        // Last financial year was two years back to previous year
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
  // Reset dates when switching to custom
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

  toggleActionMenu(orderId: string, event: Event): void {
    event.stopPropagation();
    this.activeActionMenu = this.activeActionMenu === orderId ? null : orderId;
  }

  onDocumentClick(event: MouseEvent): void {
    if (!(event.target as HTMLElement).closest('.action-dropdown')) {
      this.activeActionMenu = null;
    }
  }
loadPurchaseOrders(): void {
  this.ordersSubscription = this.orderService.getOrders().subscribe({
    next: (orders: any[]) => {
      this.purchaseOrders = orders.map(order => ({
        id: order.id,
        date: order.orderDate || (order.createdAt?.toDate().toLocaleDateString()) || order.date || 'N/A',
        referenceNo: order.referenceNo?.startsWith('PR-') ? order.referenceNo : 
                   (order.referenceNo || 'N/A'),
        requiredByDate: order.requiredDate || order.requiredByDate || order.required_date || 'N/A',
        businessLocation: order.businessLocation || 'N/A',
        businessLocationId: order.businessLocationId || order.location || 'N/A',
        supplier: order.supplier || 'N/A',
        supplierName: order.supplierName || order.supplier || 'Unknown Supplier',
        status: order.status || 'Pending',
        quantityRemaining: order.quantityRemaining || 0,
        shippingStatus: order.shippingStatus || 'Not Shipped',
        shippingCharges: order.shippingCharges || 0,
        addedBy: order.addedBy || 'System',
        createdAt: order.createdAt?.toDate(),
        brand: order.brand || 'N/A',
        category: order.category || 'N/A',
        shippingDate: order.shippingDate || 'N/A',
        requisitionId: order.requisitionId || null,
        // Include both items and products for compatibility
        items: order.items ? order.items.map((item: any) => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity || item.requiredQuantity || 0,
          requiredQuantity: item.requiredQuantity || item.quantity || 0,
          unitCost: item.unitCost || 0,
          unitPurchasePrice: item.unitPurchasePrice || item.unitCost || 0,
          alertQuantity: item.alertQuantity || 0,
          currentStock: item.currentStock || 0,
          batchNumber: item.batchNumber || 'N/A',
          expiryDate: item.expiryDate || 'N/A'
        })) : [],
        products: order.items ? order.items.map((item: any) => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity || item.requiredQuantity || 0,
          requiredQuantity: item.requiredQuantity || item.quantity || 0,
          unitCost: item.unitCost || 0,
          unitPurchasePrice: item.unitPurchasePrice || item.unitCost || 0,
          alertQuantity: item.alertQuantity || 0,
          currentStock: item.currentStock || 0
        })) : [],
        locationName: order.locationName || order.businessLocation || 'N/A',
        shippingDetails: order.shippingDetails || {}
      }));
      
      this.extractFilterValues();
      this.applyFilters();
      this.calculateTotalPages();
    },
    error: (err) => console.error('Error loading orders:', err)
  });
}

  mapProductItems(order: any): any[] {
    if (order.items && order.items.length > 0) {
      return order.items.map((item: any) => ({
        productId: item.productId || '',
        productName: item.productName || item.name || 'Unknown Product',
        quantity: item.requiredQuantity || item.quantity || 0,
        unitCost: item.unitCost || 0,
        alertQuantity: item.alertQuantity || 0,
              unitPurchasePrice: item.unitPurchasePrice || item.unitCost || 0, // Ensure this is mapped
      batchNumber: item.batchNumber || 'N/A',  // Add this
      expiryDate: item.expiryDate || 'N/A'  ,
        currentStock: item.currentStock || 0,
        requiredQuantity: item.requiredQuantity || item.quantity || 0
      }));
    }
    
    if (order.products && order.products.length > 0) {
      return order.products.map((product: any) => {
        let productName = 'Unknown Product';
        
        if (product.productId) {
          const foundProduct = this.productsList.find(p => p.id === product.productId);
          if (foundProduct) {
            productName = foundProduct.productName;
          }
        }
        
        return {
          productId: product.productId || '',
          productName: product.productName || productName,
          quantity: product.quantity || 0,
          unitCost: product.unitCost || product.price || 0,
          alertQuantity: product.alertQuantity || 0,
          currentStock: product.currentStock || 0,
          requiredQuantity: product.requiredQuantity || product.quantity || 0
        };
      });
    }
    
    return [];
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
  
  // Initialize filtered suppliers
  this.filteredSuppliers = [...this.suppliers];
}

  calculateTotalPages(): void {
    this.totalPages = Math.ceil(this.filteredOrders.length / this.entriesPerPage);
    if (this.currentPage > this.totalPages && this.totalPages > 0) {
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

    // Search across multiple fields
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

    // Filter by dropdown selections
    const matchesLocation = this.selectedLocation === 'All' || 
                          order.businessLocation === this.selectedLocation;
    const matchesSupplier = this.selectedSupplier === 'All' || 
                          order.supplierName === this.selectedSupplier;
    const matchesStatus = this.selectedStatus === 'All' || 
                         order.status === this.selectedStatus;
    const matchesShippingStatus = this.selectedShippingStatus === 'All' || 
                                order.shippingStatus === this.selectedShippingStatus;

    // Date range filtering
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

    // Combine all filters
    return matchesSearch && 
           matchesLocation && 
           matchesSupplier && 
           matchesStatus && 
           matchesShippingStatus && 
           matchesDateRange;
  });

  // Update pagination
  this.calculateTotalPages();
  this.currentPage = 1;
}


  previousPage(): void {
    if (this.currentPage > 1) this.currentPage--;
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) this.currentPage++;
  }

  viewOrder(order: PurchaseOrder): void {
    this.router.navigate(['/purchase-orders/view', order.id]);
    this.activeActionMenu = null;
  }
printOrder(order: PurchaseOrder): void {
  // Format the date as DD-MM-YYYY
  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-GB').replace(/\//g, '-');
    } catch {
      return dateStr;
    }
  };

  // Create the print content with styling similar to the PDF
  const printContent = `
    <html>
      <head>
        <title>Purchase Order - ${order.referenceNo}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { display: flex; justify-content: space-between; margin-bottom: 20px; }
          .supplier-info, .business-info { width: 48%; }
          .title { text-align: center; font-size: 18px; font-weight: bold; margin: 20px 0; }
          .reference { margin-bottom: 20px; }
          .table-container { margin: 20px 0; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          .totals { margin-left: auto; width: 300px; }
          .totals table { width: 100%; }
          .totals td { border: none; padding: 5px; }
          .totals .label { font-weight: bold; }
          .signature { margin-top: 50px; display: flex; justify-content: space-between; }
          .page-break { page-break-after: always; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="supplier-info">
            <h3>Supplier:</h3>
            <p>${order.supplierName || 'N/A'}</p>
            ${order.supplier ? `<p>${order.supplier.replace(/\n/g, '<br>')}</p>` : ''}
            ${order.shippingDetails?.deliveredTo ? `<p>Delivered To: ${order.shippingDetails.deliveredTo}</p>` : ''}
          </div>
          <div class="business-info">
            <h3>Business:</h3>
            <p>${order.businessLocation || 'N/A'}</p>
            ${order.locationName ? `<p>${order.locationName}</p>` : ''}
          </div>
        </div>

        <div class="reference">
          <p><strong>Reference No:</strong> ${order.referenceNo || 'N/A'}</p>
          <p><strong>Date:</strong> ${formatDate(order.date)}</p>
          <p><strong>Purchase Status:</strong> ${order.status || 'Pending'}</p>
          <p><strong>Shipping:</strong> ${order.shippingStatus || 'Not Shipped'}</p>
        </div>

        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Product Name</th>
                <th>SKU</th>
                <th>HSN Code</th>
                <th>Tax</th>
                <th>Qty</th>
                <th>Unit Cost</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${(order.items || order.products || []).map((item, index) => {
                // Find the product in productsList to get additional details
                const product: Product | undefined = this.productsList.find(p => p.id === item.productId);
                
                // Safely access product properties with proper type checking
                const sku = product?.sku || 'N/A';
                const hsnCode = product?.hsnCode || 'N/A';
                
                let taxDisplay = 'N/A';
                if (product) {
                  if (typeof product.applicableTax === 'string') {
                    taxDisplay = product.applicableTax;
                  } else if (product.applicableTax?.name) {
                    taxDisplay = `${product.applicableTax.name} (${product.applicableTax.percentage}%)`;
                  } else if (product.displayTax) {
                    taxDisplay = product.displayTax;
                  }
                }
                
                return `
                  <tr>
                    <td>${index + 1}</td>
                    <td>${item.productName || 'N/A'}</td>
                    <td>${sku}</td>
                    <td>${hsnCode}</td>
                    <td>${taxDisplay}</td>
                    <td>${item.quantity || item.requiredQuantity || 0}</td>
                    <td>₹ ${item.unitCost?.toFixed(2) || '0.00'}</td>
                    <td>₹ ${((item.quantity || item.requiredQuantity || 0) * (item.unitCost || 0)).toFixed(2)}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        <div class="totals">
          <table>
            <tr>
              <td class="label">Total Before Tax:</td>
              <td>₹ ${this.calculateTotalBeforeTax(order).toFixed(2)}</td>
            </tr>
            ${this.renderTaxBreakdown(order)}
            <tr>
              <td class="label">Net Total Amount:</td>
              <td>₹ ${this.calculateNetTotal(order).toFixed(2)}</td>
            </tr>
            <tr>
              <td class="label">Shipping charges:</td>
              <td>₹ ${order.shippingCharges?.toFixed(2) || '0.00'}</td>
            </tr>
            <tr>
              <td class="label">Round Off Amount:</td>
              <td>₹ 0.00</td>
            </tr>
            <tr>
              <td class="label">Purchase Total:</td>
              <td>₹ ${this.calculatePurchaseTotal(order).toFixed(2)}</td>
            </tr>
          </table>
        </div>

        <div class="additional-notes">
          <p><strong>Additional Notes:</strong> ${order.shippingDetails?.note || '--'}</p>
        </div>

        <div class="signature">
          <div>
            <p>Prepared by: ${order.addedBy || 'System'}</p>
          </div>
          <div>
            <p>Authorized Signature</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  printWindow?.document.write(printContent);
  printWindow?.document.close();
  printWindow?.focus();
  printWindow?.print();
  this.activeActionMenu = null;
}
  downloadPdf(order: PurchaseOrder): void {
    const doc = new jsPDF();
    doc.text(`Purchase Order: ${order.referenceNo}`, 10, 10);
    autoTable(doc, {
      head: [['Field', 'Value']],
      body: [
        ['Date', order.date],
        ['Reference No', order.referenceNo],
        ['Required Date', order.requiredByDate],
        ['Location', order.businessLocation],
        ['Supplier', order.supplierName],
        ['Status', order.status],
        ['Brand', order.brand || 'N/A'],
        ['Category', order.category || 'N/A'],
        ['Shipping Status', order.shippingStatus],
        ['Shipping Date', order.shippingDate || 'N/A'],
        ['Added By', order.addedBy]
      ]
    });
    
    // Add product details table
    doc.addPage();
    doc.text('Products:', 10, 10);
    autoTable(doc, {
      head: [['Product Name', 'Quantity', 'Alert Quantity', 'Current Stock', 'Unit Cost']],
      body: order.products.map(product => [
        product.productName,
        product.quantity.toString(),
        (product.alertQuantity || 'N/A').toString(),
        (product.currentStock || 'N/A').toString(),
        product.unitCost.toString()
      ]),
      startY: 20
    });
    
    doc.save(`order_${order.referenceNo}.pdf`);
    this.activeActionMenu = null;
  }

  editOrder(order: PurchaseOrder): void {
    this.router.navigate(['/edit-purchase-order', order.id]);
    this.activeActionMenu = null;
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
  return this.calculateTotalBeforeTax(order) + (order.shippingCharges || 0);
}

private calculatePurchaseTotal(order: PurchaseOrder): number {
  // In a real implementation, you might want to include taxes here
  return this.calculateNetTotal(order);
}

private renderTaxBreakdown(order: PurchaseOrder): string {
  // This is a simplified version - you should implement your actual tax calculation logic
  const totalBeforeTax = this.calculateTotalBeforeTax(order);
  const taxRate = 12; // Example tax rate - adjust as needed
  const taxAmount = totalBeforeTax * (taxRate / 100);
  
  return `
    <tr>
      <td class="label">Tax (${taxRate}%):</td>
      <td>₹ ${taxAmount.toFixed(2)}</td>
    </tr>
    <tr>
      <td class="label">CGST@${taxRate/2} (${taxRate/2}%):</td>
      <td>₹ ${(taxAmount/2).toFixed(2)}</td>
    </tr>
    <tr>
      <td class="label">SGST@${taxRate/2} (${taxRate/2}%):</td>
      <td>₹ ${(taxAmount/2).toFixed(2)}</td>
    </tr>
    
  `;
}
  addPurchaseForOrder(order: PurchaseOrder, event: Event): void {
    event.stopPropagation();
    this.router.navigate(['/add-purchase', { orderId: order.id }]);
  }

  openStatusModal(order: PurchaseOrder, modalId: string): void {
    this.selectedOrderForEdit = order;
    this.selectedShippingStatusForEdit = order.shippingStatus || 'Pending';
    this.selectedDeliveredTo = order.shippingDetails?.deliveredTo || '';
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

 // Update the saveShippingStatusChanges method in the PurchaseOrderComponent class

saveShippingStatusChanges(): void {
  if (this.selectedOrderForEdit) {
    const orderId = this.selectedOrderForEdit.id;
    
    // Get current user info from AuthService
    const currentUser = this.authService.getCurrentUserName();
    
    const shippingDetails = {
      status: this.selectedShippingStatusForEdit,
      deliveredTo: this.selectedDeliveredTo,
      deliveryPerson: this.selectedDeliveryPerson,
      note: this.shippingNote,
      documents: this.uploadedFiles?.map(file => file.name) || [], // Fix 1: Handle potential null uploadedFiles
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
      // Update the order in both arrays
      const orderToUpdateInMain = this.purchaseOrders?.find(o => o.id === orderId); // Fix 2: Handle potential null purchaseOrders
      const orderToUpdateInFiltered = this.filteredOrders?.find(o => o.id === orderId); // Fix 3: Handle potential null filteredOrders
      
      if (orderToUpdateInMain) {
        orderToUpdateInMain.shippingStatus = this.selectedShippingStatusForEdit;
        orderToUpdateInMain.shippingDetails = shippingDetails;
      }
      
      if (orderToUpdateInFiltered) {
        orderToUpdateInFiltered.shippingStatus = this.selectedShippingStatusForEdit;
        orderToUpdateInFiltered.shippingDetails = shippingDetails;
      }
      
      // Update the selected order for edit as well
      if (this.selectedOrderForEdit) { // Fix 4: Additional null check
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
  closeStatusModal(): void {
    if (this.statusModal) {
      this.statusModal.hide();
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

  // Changed method name to match template reference
  toggleColumnVisibility(): void {
    this.showColumnVisibility = !this.showColumnVisibility;
  }
  
  // Add method to update column visibility
  updateColumnVisibility(column: any): void {
    // Make sure at least one column remains visible
    if (!column.visible && this.hasVisibleColumns()) {
      column.visible = !column.visible;
    }
  }
  
  // Check if there are any visible columns
  hasVisibleColumns(): boolean {
    return this.columns.filter(col => col.visible).length > 1;
  }
  
  // Get count of visible columns
  getVisibleColumnsCount(): number {
    return this.columns.filter(col => col.visible).length;
  }

  // Add functions for pagination index calculations
  getFirstEntryIndex(): number {
    if (this.filteredOrders.length === 0) return 0;
    return (this.currentPage - 1) * this.entriesPerPage + 1;
  }

  getLastEntryIndex(): number {
    const lastIndex = this.currentPage * this.entriesPerPage;
    return Math.min(lastIndex, this.filteredOrders.length);
  }
  
  // Add trackBy function for ngFor performance optimization
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