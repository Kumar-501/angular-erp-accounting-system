// product-sell.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { SaleService } from '../services/sale.service';
import { Subscription } from 'rxjs';
import * as bootstrap from 'bootstrap';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface Column {
  field: string;
  header: string;
  visible: boolean;
}

interface StateDistrict {
  state: string;
  districts: string[];
}

@Component({
  selector: 'app-product-sell',
  templateUrl: './product-sell.component.html',
  styleUrls: ['./product-sell.component.scss']
})
export class ProductSellComponent implements OnInit, OnDestroy {
  sales: any[] = [];
  filteredSales: any[] = [];
  selectedSale: any = null;
  private salesSubscription: Subscription | undefined;
  private modal: any;
  Math = Math;

  // Pagination
  currentPage: number = 1;
  itemsPerPage: number = 10;
  totalItems: number = 0;

  // Filters
  searchTerm: string = '';
  startDate: string = '';
  endDate: string = '';
  productFilter: string = '';
  customerFilter: string = '';
  billingAddressFilter: string = '';
  paymentStatusFilter: string = '';
  minAmount: number | null = null;
  maxAmount: number | null = null;
  
  // New State and District Filters
  selectedState: string = '';
  selectedDistrict: string = '';
  availableDistricts: string[] = [];
  
  // Quick filters
  quickDateFilter: string = '';
  quickStatusFilter: string = '';
  
  // UI state
  showFilterSidebar: boolean = false;
  showColumnMenu: boolean = false;
  showQuickFilters: boolean = false;

  // Sorting
  sortField: string = 'saleDate';
  sortDirection: 'asc' | 'desc' = 'desc';

  // State-District mapping
  stateDistrictData: StateDistrict[] = [
    {
      state: 'Tamil Nadu',
      districts: [
        'Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 
        'Tirunelveli', 'Tiruppur', 'Vellore', 'Erode', 'Thoothukkudi',
        'Dindigul', 'Thanjavur', 'Ranipet', 'Sivaganga', 'Karur',
        'Kanchipuram', 'Cuddalore', 'Nagapattinam', 'Viluppuram', 'Ramanathapuram'
      ]
    },
    {
      state: 'Kerala',
      districts: [
        'Thiruvananthapuram', 'Kollam', 'Pathanamthitta', 'Alappuzha', 'Kottayam',
        'Idukki', 'Ernakulam', 'Thrissur', 'Palakkad', 'Malappuram',
        'Kozhikode', 'Wayanad', 'Kannur', 'Kasaragod'
      ]
    }
  ];

  columns: Column[] = [
    { field: 'invoiceNo', header: 'Invoice', visible: true },
    { field: 'saleDate', header: 'Date', visible: true },
    { field: 'customer', header: 'Customer', visible: true },
    { field: 'products', header: 'Products', visible: true },
    { field: 'quantity', header: 'Qty', visible: true },
    { field: 'unitPrice', header: 'Unit Price', visible: true },
    { field: 'subtotal', header: 'Subtotal', visible: true },
    { field: 'state', header: 'State', visible: true },
    { field: 'district', header: 'District', visible: true },
    { field: 'totalPayable', header: 'Total', visible: true },
    { field: 'paymentStatus', header: 'Payment Status', visible: true }
  ];

  constructor(private saleService: SaleService) {}

  ngOnInit(): void {
    this.modal = new bootstrap.Modal(document.getElementById('saleDetailsModal')!);
    
    this.salesSubscription = this.saleService.listenForSales().subscribe((salesData) => {
      this.sales = salesData.filter(sale => sale.status === 'Completed');
      this.sales = this.sales.map(sale => ({
        ...sale,
        products: sale.products || [],
        paymentStatus: this.getPaymentStatus(sale),
        billingAddress: sale.billingAddress || 'N/A',
        state: this.extractStateFromAddress(sale.billingAddress),
        district: this.extractDistrictFromAddress(sale.billingAddress)
      }));
      
      this.applyFilters();
    });
  }

  ngOnDestroy(): void {
    if (this.salesSubscription) {
      this.salesSubscription.unsubscribe();
    }
  }

  extractStateFromAddress(address: string): string {
    if (!address) return 'N/A';
    
    // Check if address contains Tamil Nadu or Kerala
    const lowerAddress = address.toLowerCase();
    if (lowerAddress.includes('tamil nadu') || lowerAddress.includes('tamilnadu')) {
      return 'Tamil Nadu';
    }
    if (lowerAddress.includes('kerala')) {
      return 'Kerala';
    }
    
    return 'Other';
  }

  extractDistrictFromAddress(address: string): string {
    if (!address) return 'N/A';
    
    const lowerAddress = address.toLowerCase();
    
    // Check Tamil Nadu districts
    for (const stateData of this.stateDistrictData) {
      for (const district of stateData.districts) {
        if (lowerAddress.includes(district.toLowerCase())) {
          return district;
        }
      }
    }
    
    return 'Other';
  }

  getPaymentStatus(sale: any): string {
    if (sale.paymentAmount >= sale.totalPayable) return 'Paid';
    if (sale.paymentAmount > 0) return 'Partial';
    return 'Due';
  }

  // State filter methods
  onStateChange(): void {
    this.selectedDistrict = ''; // Reset district when state changes
    this.updateAvailableDistricts();
    this.applyFilters();
  }

  onDistrictChange(): void {
    this.applyFilters();
  }

  updateAvailableDistricts(): void {
    if (this.selectedState) {
      const stateData = this.stateDistrictData.find(s => s.state === this.selectedState);
      this.availableDistricts = stateData ? stateData.districts : [];
    } else {
      this.availableDistricts = [];
    }
  }

  getUniqueStates(): string[] {
    const states = new Set<string>();
    this.sales.forEach(sale => {
      const state = this.extractStateFromAddress(sale.billingAddress);
      if (state && state !== 'N/A') {
        states.add(state);
      }
    });
    return Array.from(states).sort();
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.applyFilters();
  }

  toggleQuickFilters(): void {
    this.showQuickFilters = !this.showQuickFilters;
  }

  applyQuickDateFilter(): void {
    const today = new Date();
    let startDate: Date | null = null;
    let endDate: Date | null = null;

    switch (this.quickDateFilter) {
      case 'today':
        startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
        break;
      case 'week':
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        startDate = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());
        endDate = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7);
        break;
      case 'month':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
        break;
      case 'quarter':
        const quarterStart = Math.floor(today.getMonth() / 3) * 3;
        startDate = new Date(today.getFullYear(), quarterStart, 1);
        endDate = new Date(today.getFullYear(), quarterStart + 3, 1);
        break;
      default:
        startDate = null;
        endDate = null;
    }

    this.startDate = startDate ? startDate.toISOString().split('T')[0] : '';
    this.endDate = endDate ? endDate.toISOString().split('T')[0] : '';
    this.applyFilters();
  }

  resetAllFilters(): void {
    this.searchTerm = '';
    this.startDate = '';
    this.endDate = '';
    this.productFilter = '';
    this.customerFilter = '';
    this.billingAddressFilter = '';
    this.paymentStatusFilter = '';
    this.minAmount = null;
    this.maxAmount = null;
    this.quickDateFilter = '';
    this.quickStatusFilter = '';
    this.selectedState = '';
    this.selectedDistrict = '';
    this.availableDistricts = [];
    this.applyFilters();
  }

  selectAllColumns(): void {
    this.columns.forEach(column => column.visible = true);
    this.updateColumnVisibility();
  }

  getVisibleColumnsCount(): number {
    return this.columns.filter(column => column.visible).length;
  }

  onItemsPerPageChange(): void {
    this.currentPage = 1;
    this.applyFilters();
  }

  applyFilters(): void {
    let filtered = [...this.sales];
    
    // Apply search term filter
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(sale =>
        (sale.customer?.toLowerCase()?.includes(term) ||
        sale.invoiceNo?.toLowerCase()?.includes(term) ||
        sale.billingAddress?.toLowerCase()?.includes(term) ||
        sale.products?.some((p: any) => p.name.toLowerCase().includes(term))
      ));
    }
    
    // Apply state filter
    if (this.selectedState) {
      filtered = filtered.filter(sale => sale.state === this.selectedState);
    }
    
    // Apply district filter
    if (this.selectedDistrict) {
      filtered = filtered.filter(sale => sale.district === this.selectedDistrict);
    }
    
    // Apply date range filter
    if (this.startDate || this.endDate) {
      filtered = filtered.filter(sale => {
        const saleDate = new Date(sale.saleDate);
        const start = this.startDate ? new Date(this.startDate) : null;
        const end = this.endDate ? new Date(this.endDate) : null;
  
        if (start && saleDate < start) return false;
        if (end && saleDate > end) return false;
        return true;
      });
    }
    
    // Apply product filter
    if (this.productFilter) {
      filtered = filtered.filter(sale => 
        sale.products?.some((p: any) => p.name === this.productFilter)
      );
    }
    
    // Apply customer filter
    if (this.customerFilter) {
      filtered = filtered.filter(sale => sale.customer === this.customerFilter);
    }

    // Apply billing address filter
    if (this.billingAddressFilter) {
      filtered = filtered.filter(sale => 
        sale.billingAddress === this.billingAddressFilter ||
        (this.billingAddressFilter === 'N/A' && (!sale.billingAddress || sale.billingAddress.trim() === ''))
      );
    }

    // Apply payment status filter
    if (this.paymentStatusFilter) {
      filtered = filtered.filter(sale => this.getPaymentStatus(sale) === this.paymentStatusFilter);
    }

    // Apply quick status filter
    if (this.quickStatusFilter) {
      filtered = filtered.filter(sale => this.getPaymentStatus(sale) === this.quickStatusFilter);
    }

    // Apply amount range filter
    if (this.minAmount !== null || this.maxAmount !== null) {
      filtered = filtered.filter(sale => {
        const amount = sale.totalPayable || 0;
        if (this.minAmount !== null && amount < this.minAmount) return false;
        if (this.maxAmount !== null && amount > this.maxAmount) return false;
        return true;
      });
    }
    
    // Sort the data
    if (this.sortField) {
      filtered.sort((a, b) => {
        let valueA = this.getSortValue(a, this.sortField);
        let valueB = this.getSortValue(b, this.sortField);
        
        if (valueA > valueB) return this.sortDirection === 'asc' ? 1 : -1;
        if (valueA < valueB) return this.sortDirection === 'asc' ? -1 : 1;
        return 0;
      });
    }
    
    this.filteredSales = filtered;
    this.totalItems = this.filteredSales.length;
    
    // Ensure current page is valid
    const maxPage = Math.ceil(this.totalItems / this.itemsPerPage);
    if (this.currentPage > maxPage && maxPage > 0) {
      this.currentPage = maxPage;
    } else if (this.currentPage < 1) {
      this.currentPage = 1;
    }
  }

  getSortValue(item: any, field: string): any {
    switch (field) {
      case 'saleDate': return new Date(item.saleDate).getTime();
      case 'totalPayable': return item.totalPayable || 0;
      case 'invoiceNo': return item.invoiceNo || '';
      case 'customer': return item.customer || '';
      case 'state': return item.state || '';
      case 'district': return item.district || '';
      default: return item[field] || '';
    }
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.startDate = '';
    this.endDate = '';
    this.productFilter = '';
    this.customerFilter = '';
    this.billingAddressFilter = '';
    this.paymentStatusFilter = '';
    this.minAmount = null;
    this.maxAmount = null;
    this.selectedState = '';
    this.selectedDistrict = '';
    this.availableDistricts = [];
    this.applyFilters();
  }

  getUniqueProducts(): string[] {
    const products = new Set<string>();
    this.sales.forEach(sale => {
      sale.products?.forEach((p: any) => products.add(p.name));
    });
    return Array.from(products).sort();
  }

  getUniqueCustomers(): string[] {
    const customers = new Set<string>();
    this.sales.forEach(sale => {
      if (sale.customer) customers.add(sale.customer);
    });
    return Array.from(customers).sort();
  }

  getUniqueBillingAddresses(): string[] {
    const addresses = new Set<string>();
    this.sales.forEach(sale => {
      if (sale.billingAddress) addresses.add(sale.billingAddress);
    });
    return Array.from(addresses).sort();
  }

  sortData(field: string): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }
    this.applyFilters();
  }

  getSortIconClass(field: string): string {
    if (this.sortField !== field) return 'fa-sort';
    return this.sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
  }

  toggleColumnMenu(): void {
    this.showColumnMenu = !this.showColumnMenu;
  }

  isColumnVisible(field: string): boolean {
    const column = this.columns.find(c => c.field === field);
    return column ? column.visible : false;
  }

  resetColumnVisibility(): void {
    this.columns.forEach(column => column.visible = true);
  }

  updateColumnVisibility(): void {
    console.log('Column visibility updated:', this.columns);
  }

  toggleFilterSidebar(): void {
    this.showFilterSidebar = !this.showFilterSidebar;
  }

  viewSaleDetails(sale: any): void {
    this.selectedSale = sale;
    this.modal.show();
  }

  getSubtotal(sale: any): number {
    if (!sale?.products) return 0;
    return sale.products.reduce((sum: number, p: any) => sum + (p.subtotal || 0), 0);
  }

  getActiveFiltersCount(): number {
    let count = 0;
    if (this.searchTerm) count++;
    if (this.startDate || this.endDate) count++;
    if (this.productFilter) count++;
    if (this.customerFilter) count++;
    if (this.billingAddressFilter) count++;
    if (this.paymentStatusFilter) count++;
    if (this.selectedState) count++;
    if (this.selectedDistrict) count++;
    if (this.minAmount !== null || this.maxAmount !== null) count++;
    return count;
  }

  getFilterSummary(): string {
    const filters: string[] = [];
    if (this.searchTerm) filters.push(`Search: "${this.searchTerm}"`);
    if (this.selectedState) filters.push(`State: ${this.selectedState}`);
    if (this.selectedDistrict) filters.push(`District: ${this.selectedDistrict}`);
    if (this.startDate || this.endDate) {
      const dateRange = `${this.startDate || 'Start'} to ${this.endDate || 'End'}`;
      filters.push(`Date: ${dateRange}`);
    }
    if (this.productFilter) filters.push(`Product: ${this.productFilter}`);
    if (this.customerFilter) filters.push(`Customer: ${this.customerFilter}`);
    if (this.paymentStatusFilter) filters.push(`Payment: ${this.paymentStatusFilter}`);
    if (this.minAmount !== null || this.maxAmount !== null) {
      filters.push(`Amount: ${this.minAmount || 0} - ${this.maxAmount || '∞'}`);
    }
    
    return filters.length > 0 ? filters.join(' | ') : 'No filters applied';
  }

  // Pagination methods
  previousPage(): void {
    if (this.currentPage > 1) this.currentPage--;
  }

  nextPage(): void {
    if (this.currentPage * this.itemsPerPage < this.totalItems) this.currentPage++;
  }

  goToPage(page: number): void {
    this.currentPage = page;
  }

  getPageNumbers(): number[] {
    const totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
    const maxVisiblePages = 5;
    const pages: number[] = [];
    
    if (totalPages <= maxVisiblePages) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    
    const start = Math.max(1, this.currentPage - 2);
    const end = Math.min(totalPages, start + maxVisiblePages - 1);
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    
    return pages;
  }

  // Export methods (keeping the same as before)
  exportCSV(): void {
    const headers = [
      'Invoice No', 'Date', 'Customer', 'Product', 'Quantity', 
      'Unit Price', 'Subtotal', 'State', 'District', 'Total Payable', 'Payment Status'
    ];
    
    const data = this.filteredSales.flatMap(sale => 
      sale.products.map((product: any) => ({
        'Invoice No': sale.invoiceNo,
        'Date': sale.saleDate ? new Date(sale.saleDate).toLocaleDateString() : 'N/A',
        'Customer': sale.customer || 'N/A',
        'Product': product.name,
        'Quantity': product.quantity,
        'Unit Price': product.unitPrice,
        'Subtotal': product.subtotal,
        'State': sale.state,
        'District': sale.district,
        'Total Payable': sale.totalPayable,
        'Payment Status': this.getPaymentStatus(sale)
      }))
    );

    const csv = this.convertToCSV(data, headers);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `product_sales_${new Date().toISOString().split('T')[0]}.csv`);
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
    const headers = [
      'Invoice No', 'Date', 'Customer', 'Product', 'Quantity', 
      'Unit Price', 'Subtotal', 'State', 'District', 'Total Payable', 'Payment Status'
    ];
    
    const data = this.filteredSales.flatMap(sale => 
      sale.products.map((product: any) => [
        sale.invoiceNo,
        sale.saleDate ? new Date(sale.saleDate).toLocaleDateString() : 'N/A',
        sale.customer || 'N/A',
        product.name,
        product.quantity,
        product.unitPrice,
        product.subtotal,
        sale.state,
        sale.district,
        sale.totalPayable,
        this.getPaymentStatus(sale)
      ])
    );

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const columnWidths = headers.map(() => ({ wch: 15 }));
    worksheet['!cols'] = columnWidths;
    
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Product Sales');
    
    XLSX.writeFile(workbook, `product_sales_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  exportPDF(): void {
    const doc = new jsPDF('l', 'mm', 'a4');
    const headers = [
      'Invoice', 'Date', 'Customer', 'Product', 'Qty', 
      'Unit Price', 'Subtotal', 'State', 'District', 'Total', 'Status'
    ];
    
    const data = this.filteredSales.flatMap(sale => 
      sale.products.map((product: any) => [
        sale.invoiceNo,
        sale.saleDate ? new Date(sale.saleDate).toLocaleDateString() : 'N/A',
        sale.customer || 'N/A',
        product.name,
        product.quantity,
        product.unitPrice.toFixed(2),
        product.subtotal.toFixed(2),
        sale.state,
        sale.district,
        sale.totalPayable.toFixed(2),
        this.getPaymentStatus(sale)
      ])
    );

    doc.text('Product Sales Report', 14, 15);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 25);
    doc.text(`Total Records: ${this.filteredSales.length}`, 14, 35);
    
    (doc as any).autoTable({
      head: [headers],
      body: data,
      startY: 45,
      margin: { top: 10, left: 10, right: 10 },
      theme: 'grid',
      headStyles: {
        fillColor: [22, 160, 133],
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: 'bold'
      },
      bodyStyles: {
        fontSize: 8
      },
      columnStyles: {
        0: { cellWidth: 20 }, // Invoice
        1: { cellWidth: 18 }, // Date
        2: { cellWidth: 25 }, // Customer
        3: { cellWidth: 30 }, // Product
        4: { cellWidth: 12 }, // Qty
        5: { cellWidth: 18 }, // Unit Price
        6: { cellWidth: 18 }, // Subtotal
        7: { cellWidth: 20 }, // State
        8: { cellWidth: 20 }, // District
        9: { cellWidth: 18 }, // Total
        10: { cellWidth: 18 } // Status
      }
    });
    
    doc.save(`product_sales_report_${new Date().toISOString().split('T')[0]}.pdf`);
  }

  printInvoice(sale: any): void {
    const printContent = document.getElementById('saleDetailsModal')?.innerHTML;
    const WindowPrt = window.open('', '', 'left=0,top=0,width=900,height=900,toolbar=0,scrollbars=0,status=0');
    
    WindowPrt?.document.write(`
      <html>
        <head>
          <title>Invoice - ${sale.invoiceNo}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .text-end { text-align: right; }
            .badge { padding: 4px 8px; border-radius: 4px; color: white; }
            .bg-success { background-color: #28a745; }
            .bg-danger { background-color: #dc3545; }
            .bg-warning { background-color: #ffc107; color: black; }
          </style>
        </head>
        <body>
          ${printContent}
          <script>
            setTimeout(() => {
              window.print();
              window.close();
            }, 300);
          </script>
        </body>
      </html>
    `);
    
    WindowPrt?.document.close();
  }
  extractDistrictAndCountry(address: string): string {
  if (!address) return 'N/A';

  // Split the address by commas assuming format like: "Street, District, State, Country"
  const parts = address.split(',');
  const district = parts.length >= 2 ? parts[1].trim() : 'Unknown District';
  const country = parts.length >= 4 ? parts[3].trim() : 'Unknown Country';

  return `${district}, ${country}`;
}
}