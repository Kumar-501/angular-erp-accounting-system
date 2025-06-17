import { Component, OnInit, OnDestroy } from '@angular/core';
import { SaleService } from '../services/sale.service';
import { Subscription, Observable } from 'rxjs';
import { StockService } from '../services/stock.service';
import { Router } from '@angular/router';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { ActivatedRoute } from '@angular/router';
import 'jspdf-autotable';
interface FilterOptions {
  status?: string;
  dateRange?: any;
  productId?: string;
  productName?: string;
}

interface SalesOrder {
  transactionId: string;
  paymentStatus: string;
  totalAmount: any;
  contactNumber?: string;
  shippingDetails?: string;
  activities?: {
    userId: string;
    userName: string;
    fromStatus: string;
    toStatus: string;
    timestamp: Date;
    notes?: string;
  }[];
  typeOfService: string | undefined;
  typeOfServiceName: string;
  total: any;
  subtotal: number;
  tax: number;
  shippingCost: number;
  id: string;
  customer: string;
  customerId: string;
  saleDate: string;
  invoiceNo: string;
  invoiceScheme?: string;
  status: string;
  shippingStatus: string;
  paymentAmount: number;
  shippingCharges: number;
  discountAmount: number;
  balance: number;
  businessLocation?: string;
  products?: Product[];
  billingAddress?: string;
  shippingAddress?: string;
  orderTax?: number;
  discountType?: string;
  sellNote?: string;
  deliveryPerson?: string;
  paidOn?: string;
  paymentMethod?: string;
  paymentNote?: string;
  changeReturn?: number;
  itemsTotal?: number;
  document?: string;
  shippingDocuments?: string;
  createdAt?: Date;
  updatedAt?: Date;
  totalPayable?: number;
  customerAge?: number;
  customerGender?: string;
  customerOccupation?: string;
  productInterested?: string;
  customerDob?: string | null;
  creditLimit?: number;
  otherData?: string;
  customerEmail?: string;
  customerPhone?: string;
  alternateContact?: string;
  addedBy?: string;
  addedByDisplayName?: string;
  commissionPercentage?: number;
  orderNo?: string;
  customerGst?: string;
  shippingTaxAmount?: number;
}

interface Product {
  id?: string;
  name: string;
  productName?: string;
  sku?: string;
  barcode?: string;
  currentStock?: number;
  defaultSellingPriceExcTax?: number;
  defaultSellingPriceIncTax?: number;
  batchNumber?: string;
  expiryDate?: string;
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
  discountType: 'Amount' | 'Percentage';
  taxType?: 'GST' | 'IGST';
  cgstRate?: number;
  sgstRate?: number;
  igstRate?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  taxableValue?: number;
}

interface FilterOptions {
  businessLocation?: string;
  customer?: string;
  status?: string;
  shippingStatus?: string;
  dateRange?: any;

  addedBy?: string;
  addedByDepartment?: string;
  paymentMethod?: string;
  minCommission?: number;
  maxCommission?: number;
  productId?: string;
  productName?: string;
}

interface Column {
  field: string;
  header: string;
  visible: boolean;
}

@Component({
  selector: 'app-product-sales',
  templateUrl: './product-sales.component.html',
  styleUrls: ['./product-sales.component.scss']
})
export class ProductSalesComponent implements OnInit, OnDestroy {
  Math = Math;
  sales: SalesOrder[] = [];
  filteredSales: SalesOrder[] = [];
  loading = false;
  error: string | null = null;
  filters: FilterOptions = {};
  searchTerm = '';
  currentPage = 1;
  itemsPerPage = 25;
  totalItems = 0;
  sortField = 'saleDate';
  sortDirection: 'asc' | 'desc' = 'desc';
  totalSales = 0;
  totalRevenue = 0;
  completedSales = 0;
  pendingSales = 0;
  private subscriptions: Subscription[] = [];
  statusOptions = ['All', 'Pending', 'Processing', 'Completed', 'Cancelled', 'Refunded'];
  shippingStatusOptions = ['All', 'Pending', 'Processing', 'Shipped', 'Delivered', 'Returned'];
  paymentStatusOptions = ['All', 'Paid', 'Unpaid', 'Partial', 'Refunded'];
  showColumnMenu = false;
  showFilterSidebar = false;
  quickDateFilter = '';
  selectedSale: SalesOrder | null = null;
  expandedSaleId: string | null = null;
  productFilterName: string = '';

  // Add these properties for totals
  totalPaymentAmount = 0;
  totalBalance = 0;
  totalShippingCharge = 0;
  totalCommission = 0;
  totalDueAmount = 0;

  columns: Column[] = [
    { field: 'customer', header: 'Customer', visible: true },
    { field: 'saleDate', header: 'Sale Date', visible: true },
    { field: 'invoiceNo', header: 'Invoice No', visible: true },
    { field: 'products', header: 'Products', visible: true },
    { field: 'status', header: 'Status', visible: true },
    { field: 'commissionPercentage', header: 'Commission %', visible: true },
    { field: 'shippingStatus', header: 'Shipping Status', visible: true },
    { field: 'paymentAmount', header: 'Payment Amount', visible: true },
    { field: 'balance', header: 'Balance', visible: true },
    { field: 'typeOfService', header: 'Type of Service', visible: true },
    { field: 'customerPhone', header: 'Contact', visible: true },
    { field: 'alternateContact', header: 'Alternate Contact', visible: true },
    { field: 'billingAddress', header: 'Billing Address', visible: true },
    { field: 'shippingDetails', header: 'Shipping Details', visible: true },
    { field: 'paymentMethod', header: 'Payment Method', visible: true },
    { field: 'businessLocation', header: 'Location', visible: true },
    { field: 'addedBy', header: 'Added By', visible: true }
  ];

  constructor(
    private saleService: SaleService,
    private stockService: StockService,
    private router: Router,
    private route: ActivatedRoute 
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
    if (params['productId']) {
      this.filters.productId = params['productId'];
      this.productFilterName = params['productName'] || '';
    }
  });

    this.loadSales();
    this.subscribeToStockUpdates();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  loadSales(): void {
    this.loading = true;
    this.error = null;
    
    const subscription = this.saleService.listenForSales(this.filters).subscribe({
      next: (sales) => {
        this.sales = sales;
        this.applyFiltersAndSort();
        this.calculateStatistics();
        this.calculateTotals();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading sales:', error);
        this.error = 'Failed to load sales data';
        this.loading = false;
      }
    });
    
    this.subscriptions.push(subscription);
  }

  subscribeToStockUpdates(): void {
    const stockSubscription = this.saleService.stockUpdated$.subscribe(() => {
      this.loadSales();
    });
    this.subscriptions.push(stockSubscription);
  }

  applyFiltersAndSort(): void {
    let filtered = [...this.sales];
    
    // Apply search filter
    if (this.searchTerm) {
      const search = this.searchTerm.toLowerCase();
      filtered = filtered.filter(sale =>
        sale.customer?.toLowerCase()?.includes(search) ||
        sale.invoiceNo?.toLowerCase()?.includes(search) ||
        sale.status?.toLowerCase()?.includes(search) ||
        (sale.products && sale.products.some(p => 
          p.name?.toLowerCase()?.includes(search) || 
          p.productName?.toLowerCase()?.includes(search)
        )) ||
        sale.customerPhone?.toLowerCase()?.includes(search) ||
        sale.billingAddress?.toLowerCase()?.includes(search) ||
        sale.shippingDetails?.toLowerCase()?.includes(search)
      );
    }
      
  // Apply product filter if exists
  if (this.filters.productId) {
    filtered = filtered.filter(sale => 
      sale.products?.some((product: any) => product.id === this.filters.productId)
    );
  }
    
    // Apply status filter
    if (this.filters.status && this.filters.status !== 'All') {
      filtered = filtered.filter(sale => sale.status === this.filters.status);
    }
    
    // Apply shipping status filter
    if (this.filters.shippingStatus && this.filters.shippingStatus !== 'All') {
      filtered = filtered.filter(sale => sale.shippingStatus === this.filters.shippingStatus);
    }
    
    // Apply business location filter
    if (this.filters.businessLocation) {
      filtered = filtered.filter(sale => sale.businessLocation === this.filters.businessLocation);
    }
    
    // Apply payment method filter
    if (this.filters.paymentMethod) {
      filtered = filtered.filter(sale => sale.paymentMethod === this.filters.paymentMethod);
    }
    
    // Apply added by filter
    if (this.filters.addedBy) {
      filtered = filtered.filter(sale => sale.addedBy === this.filters.addedBy);
    }
    
    // Apply commission range filter
    if (this.filters.minCommission !== undefined) {
      filtered = filtered.filter(sale => 
        (sale.commissionPercentage || 0) >= this.filters.minCommission!);
    }
    
    if (this.filters.maxCommission !== undefined) {
      filtered = filtered.filter(sale => 
        (sale.commissionPercentage || 0) <= this.filters.maxCommission!);
    }
    
    // Apply date range filter
    if (this.filters.dateRange?.startDate && this.filters.dateRange?.endDate) {
      filtered = filtered.filter(sale => {
        const saleDate = new Date(sale.saleDate);
        const startDate = new Date(this.filters.dateRange!.startDate!);
        const endDate = new Date(this.filters.dateRange!.endDate!);
        return saleDate >= startDate && saleDate <= endDate;
      });
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any = a[this.sortField as keyof SalesOrder];
      let bValue: any = b[this.sortField as keyof SalesOrder];
      
      if (this.sortField === 'saleDate') {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      } else if (this.sortField === 'paymentAmount' || this.sortField === 'balance') {
        aValue = Number(aValue) || 0;
        bValue = Number(bValue) || 0;
      }
      
      if (aValue < bValue) return this.sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return this.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    
    this.filteredSales = filtered;
    this.totalItems = filtered.length;
  }
clearProductFilter(): void {
  this.filters.productId = '';
  this.productFilterName = '';
  this.applyFiltersAndSort();
}
  calculateStatistics(): void {
    this.totalSales = this.sales.length;
    this.totalRevenue = this.sales.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0);
    this.completedSales = this.sales.filter(sale => sale.status === 'Completed').length;
    this.pendingSales = this.sales.filter(sale => sale.status === 'Pending').length;
  }

  calculateTotals(): void {
    const currentPageData = this.filteredSales.slice(
      (this.currentPage - 1) * this.itemsPerPage,
      this.currentPage * this.itemsPerPage
    );
    
    this.totalPaymentAmount = currentPageData.reduce((sum, sale) => 
      sum + (sale.paymentAmount || 0), 0);
    
    this.totalBalance = currentPageData.reduce((sum, sale) => 
      sum + (sale.balance || 0), 0);
    
    this.totalShippingCharge = currentPageData.reduce((sum, sale) => 
      sum + (sale.shippingCharges || 0), 0);
    
    this.totalCommission = currentPageData.reduce((sum, sale) => 
      sum + (sale.commissionPercentage || 0), 0);
    
    this.totalDueAmount = currentPageData.reduce((sum, sale) => {
      const status = this.calculatePaymentStatus(sale);
      if (status === 'Due' || status === 'Partial') {
        return sum + (sale.balance || 0);
      }
      return sum;
    }, 0);
  }

  calculatePaymentStatus(sale: SalesOrder): string {
    if (sale.paymentAmount && sale.totalAmount) {
      if (sale.paymentAmount >= sale.totalAmount) return 'Paid';
      if (sale.paymentAmount > 0) return 'Partial';
    }
    return 'Due';
  }

  getPaginatedSales(): SalesOrder[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    return this.filteredSales.slice(startIndex, endIndex);
  }

  trackBySaleId(index: number, sale: SalesOrder): string {
    return sale.id;
  }

  getTotalPages(): number {
    return Math.ceil(this.totalItems / this.itemsPerPage);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.getTotalPages()) {
      this.currentPage = page;
      this.calculateTotals();
    }
  }

  getPageNumbers(): number[] {
    const totalPages = this.getTotalPages();
    const currentPage = this.currentPage;
    const delta = 2;
    
    let pages: number[] = [];
    
    if (totalPages > 0) {
      pages.push(1);
    }
    
    const rangeStart = Math.max(2, currentPage - delta);
    const rangeEnd = Math.min(totalPages - 1, currentPage + delta);
    
    if (rangeStart > 2) {
      pages.push(-1);
    }
    
    for (let i = rangeStart; i <= rangeEnd; i++) {
      pages.push(i);
    }
    
    if (rangeEnd < totalPages - 1) {
      pages.push(-1);
    }
    
    if (totalPages > 1) {
      pages.push(totalPages);
    }
    
    return [...new Set(pages)].filter(page => page > 0);
  }

  sortBy(field: string): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }
    this.applyFiltersAndSort();
  }

  applyFilters(): void {
    this.currentPage = 1;
    this.applyFiltersAndSort();
  }

  clearFilters(): void {
    this.filters = {};
    this.searchTerm = '';
    this.currentPage = 1;
    this.applyFiltersAndSort();
  }

  onSearch(): void {
    this.currentPage = 1;
    this.applyFiltersAndSort();
  }

  async updateSaleStatus(saleId: string, newStatus: string): Promise<void> {
    try {
      this.loading = true;
      await this.saleService.updateSaleStatus(saleId, newStatus);
    } catch (error) {
      console.error('Error updating sale status:', error);
      this.error = 'Failed to update sale status';
    } finally {
      this.loading = false;
    }
  }

  onStatusChange(event: Event, saleId: string): void {
    const target = event.target as HTMLSelectElement;
    if (target && target.value) {
      this.updateSaleStatus(saleId, target.value);
    }
  }

  async deleteSale(saleId: string): Promise<void> {
    if (confirm('Are you sure you want to delete this sale?')) {
      try {
        this.loading = true;
        await this.saleService.deleteSale(saleId);
      } catch (error) {
        console.error('Error deleting sale:', error);
        this.error = 'Failed to delete sale';
      } finally {
        this.loading = false;
      }
    }
  }

  async exportSales(format: 'csv' | 'excel' | 'pdf'): Promise<void> {
    try {
      this.loading = true;
      
      if (format === 'csv') {
        this.exportCSV();
      } else if (format === 'excel') {
        this.exportExcel();
      } else if (format === 'pdf') {
        this.exportPDF();
      }
      
    } catch (error) {
      console.error('Error exporting sales:', error);
      this.error = 'Failed to export sales';
    } finally {
      this.loading = false;
    }
  }

  exportCSV(): void {
    const headers = ['S.No', 'Customer', 'Sale Date', 'Invoice No', 'Products', 'Status', 
      'Commission %', 'Shipping Status', 'Payment Amount', 'Balance'];
    
    const data = this.filteredSales.map((sale, index) => {
      return {
        'S.No': index + 1,
        'Customer': sale.customer || 'N/A',
        'Sale Date': sale.saleDate ? new Date(sale.saleDate).toLocaleDateString() : 'N/A',
        'Invoice No': sale.invoiceNo || 'N/A',
        'Products': this.getProductsDisplayText(sale.products || []),
        'Status': sale.status || 'N/A',
        'Commission %': sale.commissionPercentage || 0,
        'Shipping Status': sale.shippingStatus || 'N/A',
        'Payment Amount': sale.paymentAmount !== undefined ? `$${Number(sale.paymentAmount).toFixed(2)}` : '$0.00',
        'Balance': sale.balance !== undefined ? `$${Number(sale.balance).toFixed(2)}` : '$0.00'
      };
    });

    const csv = this.convertToCSV(data, headers);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', 'sales_data.csv');
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  private convertToCSV(data: any[], headers: string[]): string {
    const headerString = headers.join(',');
    const rowStrings = data.map(row => 
      headers.map(fieldName => 
        `"${(row[fieldName] ?? '').toString().replace(/"/g, '""')}"`
      ).join(',')
    );
    
    return [headerString, ...rowStrings].join('\n');
  }

  exportExcel(): void {
    const headers = ['S.No', 'Customer', 'Sale Date', 'Invoice No', 'Products', 'Status', 
      'Commission %', 'Shipping Status', 'Payment Amount', 'Balance'];
    
    const data = this.filteredSales.map((sale, index) => {
      return [
        index + 1,
        sale.customer || 'N/A',
        sale.saleDate ? new Date(sale.saleDate).toLocaleDateString() : 'N/A',
        sale.invoiceNo || 'N/A',
        this.getProductsDisplayText(sale.products || []),
        sale.status || 'N/A',
        sale.commissionPercentage || 0,
        sale.shippingStatus || 'N/A',
        sale.paymentAmount !== undefined ? `$${Number(sale.paymentAmount).toFixed(2)}` : '$0.00',
        sale.balance !== undefined ? `$${Number(sale.balance).toFixed(2)}` : '$0.00'
      ];
    });

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sales Data');
    
    XLSX.writeFile(workbook, 'sales_data.xlsx');
  }

  exportPDF(): void {
    const headers = ['S.No', 'Customer', 'Sale Date', 'Invoice No', 'Products', 'Status', 
      'Commission %', 'Shipping Status', 'Payment Amount', 'Balance'];
    
    const data = this.filteredSales.map((sale, index) => {
      return [
        index + 1,
        sale.customer || 'N/A',
        sale.saleDate ? new Date(sale.saleDate).toLocaleDateString() : 'N/A',
        sale.invoiceNo || 'N/A',
        this.getProductsDisplayText(sale.products || []),
        sale.status || 'N/A',
        sale.commissionPercentage || 0,
        sale.shippingStatus || 'N/A',
        sale.paymentAmount !== undefined ? `$${Number(sale.paymentAmount).toFixed(2)}` : '$0.00',
        sale.balance !== undefined ? `$${Number(sale.balance).toFixed(2)}` : '$0.00'
      ];
    });

    const doc = new jsPDF({ orientation: 'landscape' });
    doc.text('Sales Report', 14, 15);
    
    (doc as any).autoTable({
      head: [headers],
      body: data,
      startY: 25,
      margin: { top: 10 },
      theme: 'grid',
      headStyles: {
        fillColor: [22, 160, 133]
      }
    });
    
    doc.save('sales-report.pdf');
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount || 0);
  }

  formatDate(date: string | Date): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-IN');
  }

  getStatusClass(status: string): string {
    switch (status?.toLowerCase()) {
      case 'completed': return 'status-completed';
      case 'pending': return 'status-pending';
      case 'processing': return 'status-processing';
      case 'cancelled': return 'status-cancelled';
      case 'refunded': return 'status-refunded';
      default: return 'status-default';
    }
  }

  getPaymentStatusClass(status: string): string {
    switch (status?.toLowerCase()) {
      case 'paid': return 'payment-paid';
      case 'unpaid': return 'payment-unpaid';
      case 'partial': return 'payment-partial';
      case 'refunded': return 'payment-refunded';
      default: return 'payment-default';
    }
  }

  getTotalProductQuantity(sale: SalesOrder): number {
    return sale.products?.reduce((sum, product) => sum + product.quantity, 0) || 0;
  }

  getUniqueProductCount(sale: SalesOrder): number {
    return sale.products?.length || 0;
  }

  getSaleActivities(sale: SalesOrder): any[] {
    return sale.activities || [];
  }

  getLatestActivity(sale: SalesOrder): any {
    const activities = this.getSaleActivities(sale);
    return activities.length > 0 ? activities[activities.length - 1] : null;
  }

  getProductsDisplayText(products: Product[]): string {
    if (!products || products.length === 0) return 'No products';
    
    if (products.length === 1) {
      return `${products[0].name} (${products[0].quantity})`;
    } else {
      return `${products[0].name} (${products[0].quantity}) and ${products.length - 1} more`;
    }
  }

  toggleColumnMenu(): void {
    this.showColumnMenu = !this.showColumnMenu;
  }

  toggleFilterSidebar(): void {
    this.showFilterSidebar = !this.showFilterSidebar;
  }

  resetColumnVisibility(): void {
    this.columns.forEach(column => {
      column.visible = true;
    });
  }

  isColumnVisible(columnKey: string): boolean {
    const column = this.columns.find(c => c.field === columnKey);
    return column ? column.visible : true;
  }

  viewSale(sale: SalesOrder): void {
    this.selectedSale = sale;
    // You can implement a modal here if needed
  }

  toggleProductDetails(saleId: string): void {
    if (this.expandedSaleId === saleId) {
      this.expandedSaleId = null;
    } else {
      this.expandedSaleId = saleId;
    }
  }

getUniqueAddedByUsers(): string[] {
  const users = new Set<string>();
  this.sales.forEach(sale => {
    const name = sale.addedByDisplayName || sale.addedBy;
    if (typeof name === 'string') {
      users.add(name);
    }
  });
  return Array.from(users).sort();
}


  getUniqueLocations(): string[] {
    const locations = new Set<string>();
    this.sales.forEach(sale => {
      if (sale.businessLocation) {
        locations.add(sale.businessLocation);
      }
    });
    return Array.from(locations).sort();
  }

  getPaymentStatusCount(status: string): number {
    return this.filteredSales.filter(sale => {
      const paymentStatus = this.calculatePaymentStatus(sale);
      return paymentStatus === status;
    }).length;
  }

  getPaymentMethodSummary(): {method: string, count: number}[] {
    const methodMap = new Map<string, number>();
    
    this.filteredSales.forEach(sale => {
      const method = sale.paymentMethod || 'Unknown';
      methodMap.set(method, (methodMap.get(method) || 0) + 1);
    });
    
    return Array.from(methodMap.entries()).map(([method, count]) => ({ method, count }));
  }

  getServiceTypeSummary(): {type: string, count: number}[] {
    const typeMap = new Map<string, number>();
    
    this.filteredSales.forEach(sale => {
      const type = sale.typeOfServiceName || sale.typeOfService || 'Standard';
      typeMap.set(type, (typeMap.get(type) || 0) + 1);
    });
    
    return Array.from(typeMap.entries()).map(([type, count]) => ({ type, count }));
  }

  resetSidebarFilters(): void {
    this.filters = {};
    this.applyFiltersAndSort();
  }

  applyQuickDateFilter(): void {
    if (!this.quickDateFilter) {
      this.filters.dateRange = undefined;
    } else {
      const dateRange = this.getDateRangeForFilter(this.quickDateFilter);
      this.filters.dateRange = {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      };
    }
    this.applyFiltersAndSort();
  }

  getDateRangeForFilter(filter: string): { startDate: string, endDate: string } {
    const today = new Date();
    const currentYear = today.getFullYear();
    let startDate: Date;
    let endDate: Date;

    switch (filter) {
      case 'today':
        startDate = new Date(today);
        endDate = new Date(today);
        break;
      case 'yesterday':
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 1);
        endDate = new Date(startDate);
        break;
      case 'tomorrow':
        startDate = new Date(today);
        startDate.setDate(today.getDate() + 1);
        endDate = new Date(startDate);
        break;
      case 'thisWeek':
        const thisWeekStart = new Date(today);
        thisWeekStart.setDate(today.getDate() - today.getDay());
        const thisWeekEnd = new Date(thisWeekStart);
        thisWeekEnd.setDate(thisWeekStart.getDate() + 6);
        startDate = thisWeekStart;
        endDate = thisWeekEnd;
        break;
      case 'lastWeek':
        const lastWeekStart = new Date(today);
        lastWeekStart.setDate(today.getDate() - today.getDay() - 7);
        const lastWeekEnd = new Date(lastWeekStart);
        lastWeekEnd.setDate(lastWeekStart.getDate() + 6);
        startDate = lastWeekStart;
        endDate = lastWeekEnd;
        break;
      case 'nextWeek':
        const nextWeekStart = new Date(today);
        nextWeekStart.setDate(today.getDate() - today.getDay() + 7);
        const nextWeekEnd = new Date(nextWeekStart);
        nextWeekEnd.setDate(nextWeekStart.getDate() + 6);
        startDate = nextWeekStart;
        endDate = nextWeekEnd;
        break;
      case 'thisMonth':
        startDate = new Date(currentYear, today.getMonth(), 1);
        endDate = new Date(currentYear, today.getMonth() + 1, 0);
        break;
      case 'lastMonth':
        startDate = new Date(currentYear, today.getMonth() - 1, 1);
        endDate = new Date(currentYear, today.getMonth(), 0);
        break;
      case 'thisQuarter':
        const thisQuarterMonth = Math.floor(today.getMonth() / 3) * 3;
        startDate = new Date(currentYear, thisQuarterMonth, 1);
        endDate = new Date(currentYear, thisQuarterMonth + 3, 0);
        break;
      case 'lastQuarter':
        const lastQuarterMonth = Math.floor(today.getMonth() / 3) * 3 - 3;
        if (lastQuarterMonth < 0) {
          startDate = new Date(currentYear - 1, 9, 1);
          endDate = new Date(currentYear - 1, 12, 0);
        } else {
          startDate = new Date(currentYear, lastQuarterMonth, 1);
          endDate = new Date(currentYear, lastQuarterMonth + 3, 0);
        }
        break;
      case 'thisYear':
        startDate = new Date(currentYear, 0, 1);
        endDate = new Date(currentYear, 11, 31);
        break;
      case 'lastYear':
        startDate = new Date(currentYear - 1, 0, 1);
        endDate = new Date(currentYear - 1, 11, 31);
        break;
      case 'thisFinancialYear':
        if (today.getMonth() >= 3) {
          startDate = new Date(currentYear, 3, 1);
          endDate = new Date(currentYear + 1, 2, 31);
        } else {
          startDate = new Date(currentYear - 1, 3, 1);
          endDate = new Date(currentYear, 2, 31);
        }
        break;
      case 'lastFinancialYear':
        if (today.getMonth() >= 3) {
          startDate = new Date(currentYear - 1, 3, 1);
          endDate = new Date(currentYear, 2, 31);
        } else {
          startDate = new Date(currentYear - 2, 3, 1);
          endDate = new Date(currentYear - 1, 2, 31);
        }
        break;
      case 'last7Days':
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 6);
        endDate = new Date(today);
        break;
      case 'last30Days':
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 29);
        endDate = new Date(today);
        break;
      case 'last90Days':
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 89);
        endDate = new Date(today);
        break;
      default:
        startDate = new Date();
        endDate = new Date();
    }

    return {
      startDate: this.formatDateForInput(startDate),
      endDate: this.formatDateForInput(endDate)
    };
  }

  private formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  getDateRangeDisplay(): string {
    if (!this.quickDateFilter) return '';
    return this.quickDateFilter.split(/(?=[A-Z])/).join(' ');
  }

  navigateToAddSales() {
    this.router.navigate(['/add-sale']);
  }
}