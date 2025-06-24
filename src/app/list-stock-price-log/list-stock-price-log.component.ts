// components/stock-price-log/list-stock-price-log.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { StockPriceLogService } from '../services/stock-price-log.service';
import { LocationService } from '../services/location.service';
import { ProductsService } from '../services/products.service';
import { StockPriceLog, StockPriceLogFilter, StockPriceLogSummary } from '../models/stock-price.log.model';
import { Subscription } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-list-stock-price-log',
  templateUrl: './list-stock-price-log.component.html',
  styleUrls: ['./list-stock-price-log.component.scss'],
  providers: [DatePipe]
})
export class ListStockPriceLogComponent implements OnInit, OnDestroy {
  stockPriceLogs: StockPriceLog[] = [];
  filteredLogs: StockPriceLog[] = [];
  paginatedLogs: StockPriceLog[] = [];
  
  isLoading = true;
  searchText = '';
  
  // Pagination
  currentPage = 1;
  pageSize = 25;
  totalPages = 1;
  startItem = 0;
  endItem = 0;

  // Sorting
  sortColumn = 'grnCreatedDate';
  sortDirection: 'asc' | 'desc' = 'desc';

  // Filtering
  showFilterSidebar = false;
  filter: StockPriceLogFilter = {};
  
  // Data for dropdowns
  locations: any[] = [];
  products: any[] = [];
  paymentTypes: string[] = ['Cash', 'Bank Transfer', 'Cheque', 'Credit Card', 'Other'];
  
  // Summary
  summary: StockPriceLogSummary = {
    totalRecords: 0,
    totalStockReceived: 0,
    totalPurchaseValue: 0,
    totalTaxAmount: 0,
    averageUnitPrice: 0
  };

  private subscriptions: Subscription[] = [];

  constructor(
    private stockPriceLogService: StockPriceLogService,
    private locationService: LocationService,
    private productsService: ProductsService,
    private snackBar: MatSnackBar,
    private router: Router,
    private datePipe: DatePipe
  ) {}

  ngOnInit(): void {
    this.loadStockPriceLogs();
    this.loadLocations();
    this.loadProducts();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  loadStockPriceLogs(): void {
    this.isLoading = true;
    
    const sub = this.stockPriceLogService.getStockPriceLogs().subscribe({
      next: (logs) => {
        this.stockPriceLogs = logs;
        this.applyFilters();
        this.calculateSummary();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading stock price logs:', error);
        this.showSnackbar('Failed to load stock price logs', 'error');
        this.isLoading = false;
      }
    });

    this.subscriptions.push(sub);
  }

  loadLocations(): void {
    const sub = this.locationService.getLocations().subscribe({
      next: (locations) => {
        this.locations = locations;
      },
      error: (error) => {
        console.error('Error loading locations:', error);
      }
    });

    this.subscriptions.push(sub);
  }

  loadProducts(): void {
    const productsResult = this.productsService.getProducts();
    if (typeof productsResult !== 'undefined' && productsResult !== null) {
      if (typeof (productsResult as any).subscribe === 'function') {
        const sub = (productsResult as any).subscribe({
          next: (products: any[]) => {
            this.products = products;
          },
          error: (error: any) => {
            console.error('Error loading products:', error);
          }
        });
        this.subscriptions.push(sub);
      } else if (Array.isArray(productsResult)) {
        this.products = productsResult;
      } else {
        console.error('Error loading products: getProducts() did not return an Observable or array.');
      }
    } else {
      console.error('Error loading products: getProducts() returned void or undefined.');
    }
  }

  applyFilters(): void {
    let filtered = [...this.stockPriceLogs];

    // Text search
    if (this.searchText) {
      const searchLower = this.searchText.toLowerCase();
      filtered = filtered.filter(log => 
        (log.productName?.toLowerCase().includes(searchLower)) ||
        (log.locationName?.toLowerCase().includes(searchLower)) ||
        (log.purchaseRefNo?.toLowerCase().includes(searchLower)) ||
        (log.supplierName?.toLowerCase().includes(searchLower)) ||
        (log.batchNumber?.toLowerCase().includes(searchLower)) ||
        (log.invoiceNo?.toLowerCase().includes(searchLower))
      );
    }

    // Date range filter
    if (this.filter.startDate) {
      filtered = filtered.filter(log => {
        const logDate = new Date(log.grnCreatedDate);
        return logDate >= this.filter.startDate!;
      });
    }

    if (this.filter.endDate) {
      filtered = filtered.filter(log => {
        const logDate = new Date(log.grnCreatedDate);
        return logDate <= this.filter.endDate!;
      });
    }

    // Other filters
    if (this.filter.productId) {
      filtered = filtered.filter(log => log.productId === this.filter.productId);
    }

    if (this.filter.locationId) {
      filtered = filtered.filter(log => log.locationId === this.filter.locationId);
    }

    if (this.filter.paymentType) {
      filtered = filtered.filter(log => log.paymentType === this.filter.paymentType);
    }

    if (this.filter.supplierName) {
      filtered = filtered.filter(log => log.supplierName === this.filter.supplierName);
    }

    if (this.filter.purchaseRefNo) {
      filtered = filtered.filter(log => log.purchaseRefNo === this.filter.purchaseRefNo);
    }

    this.filteredLogs = filtered;
    this.sortLogs();
    this.updatePagination();
  }

  sortLogs(): void {
    this.filteredLogs.sort((a, b) => {
      let valueA: any;
      let valueB: any;

      switch (this.sortColumn) {
        case 'grnCreatedDate':
          valueA = new Date(a.grnCreatedDate).getTime();
          valueB = new Date(b.grnCreatedDate).getTime();
          break;
        case 'unitPurchasePrice':
        case 'receivedStockFromGrn':
        case 'totalCost':
        case 'taxAmount':
          valueA = Number(a[this.sortColumn as keyof StockPriceLog]) || 0;
          valueB = Number(b[this.sortColumn as keyof StockPriceLog]) || 0;
          break;
        default:
          valueA = (a[this.sortColumn as keyof StockPriceLog] || '').toString().toLowerCase();
          valueB = (b[this.sortColumn as keyof StockPriceLog] || '').toString().toLowerCase();
      }

      if (this.sortDirection === 'asc') {
        return valueA > valueB ? 1 : valueA < valueB ? -1 : 0;
      } else {
        return valueA < valueB ? 1 : valueA > valueB ? -1 : 0;
      }
    });
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

  getSortIcon(column: string): string {
    if (this.sortColumn !== column) return 'fa-sort';
    return this.sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
  }

  updatePagination(): void {
    this.totalPages = Math.ceil(this.filteredLogs.length / this.pageSize);
    
    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages || 1;
    }

    const startIndex = (this.currentPage - 1) * this.pageSize;
    this.startItem = this.filteredLogs.length > 0 ? startIndex + 1 : 0;
    this.endItem = Math.min(startIndex + this.pageSize, this.filteredLogs.length);
    
    this.paginatedLogs = this.filteredLogs.slice(startIndex, this.endItem);
  }

  changePage(page: number): void {
    this.currentPage = page;
    this.updatePagination();
  }

  changePageSize(): void {
    this.currentPage = 1;
    this.updatePagination();
  }

  toggleFilterSidebar(): void {
    this.showFilterSidebar = !this.showFilterSidebar;
  }

  applyAdvancedFilters(): void {
    this.currentPage = 1;
    this.applyFilters();
    this.toggleFilterSidebar();
  }

  resetFilters(): void {
    this.filter = {};
    this.searchText = '';
    this.currentPage = 1;
    this.applyFilters();
  }

  calculateSummary(): void {
    this.summary = {
      totalRecords: this.filteredLogs.length,
      totalStockReceived: this.filteredLogs.reduce((sum, log) => sum + (log.receivedStockFromGrn || 0), 0),
      totalPurchaseValue: this.filteredLogs.reduce((sum, log) => sum + (log.totalCost || 0), 0),
      totalTaxAmount: this.filteredLogs.reduce((sum, log) => sum + (log.taxAmount || 0), 0),
      averageUnitPrice: this.filteredLogs.length > 0 ? 
        this.filteredLogs.reduce((sum, log) => sum + (log.unitPurchasePrice || 0), 0) / this.filteredLogs.length : 0
    };
  }

  deleteLog(id: string): void {
    if (confirm('Are you sure you want to delete this stock price log?')) {
      this.stockPriceLogService.deleteStockPriceLog(id)
        .then(() => {
          this.showSnackbar('Stock price log deleted successfully', 'success');
        })
        .catch(error => {
          console.error('Error deleting stock price log:', error);
          this.showSnackbar('Failed to delete stock price log', 'error');
        });
    }
  }

  exportToExcel(): void {
    const exportData = this.filteredLogs.map(log => ({
      'GRN Date': this.datePipe.transform(log.grnCreatedDate, 'dd/MM/yyyy'),
      'Purchase Ref': log.purchaseRefNo,
      'Invoice No': log.invoiceNo,
      'Product': log.productName,
      'Location': log.locationName,
      'Supplier': log.supplierName,
      'Batch Number': log.batchNumber,
      'Unit Price': log.unitPurchasePrice,
      'Received Qty': log.receivedStockFromGrn,
      'Total Cost': log.totalCost,
      'Tax Rate': `${log.taxRate}%`,
      'Tax Amount': log.taxAmount,
      'Payment Type': log.paymentType,
      'Payment Account': log.paymentAccountName,
      'Expiry Date': log.expiryDate ? this.datePipe.transform(log.expiryDate, 'dd/MM/yyyy') : '',
      'Created Date': this.datePipe.transform(log.createdAt, 'dd/MM/yyyy HH:mm')
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock Price Logs');
    
    const fileName = `stock-price-logs-${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  }

  viewPurchaseDetails(purchaseRefNo: string): void {
    // Navigate to purchase details or open modal
    this.router.navigate(['/purchase-details'], { queryParams: { ref: purchaseRefNo } });
  }

  viewProductDetails(productId: string): void {
    this.router.navigate(['/product-details', productId]);
  }

  private showSnackbar(message: string, type: 'success' | 'error' | 'info'): void {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      panelClass: [`snackbar-${type}`]
    });
  }

  // Quick filter methods
  filterByLastDays(days: number): void {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    this.filter.startDate = startDate;
    this.filter.endDate = endDate;
    this.applyAdvancedFilters();
  }

  filterByCurrentMonth(): void {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    this.filter.startDate = startDate;
    this.filter.endDate = endDate;
    this.applyAdvancedFilters();
  }

  filterByCurrentYear(): void {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), 0, 1);
    const endDate = new Date(now.getFullYear(), 11, 31);
    
    this.filter.startDate = startDate;
    this.filter.endDate = endDate;
    this.applyAdvancedFilters();
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxPages = 5;
    let startPage = Math.max(1, this.currentPage - Math.floor(maxPages / 2));
    let endPage = Math.min(this.totalPages, startPage + maxPages - 1);
    
    if (endPage - startPage + 1 < maxPages && startPage > 1) {
      startPage = Math.max(1, endPage - maxPages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    
    return pages;
  }

  isExpiringSoon(expiryDate: Date | string): boolean {
    if (!expiryDate) return false;
    const expiry = new Date(expiryDate);
    const today = new Date();
    const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 30 && diffDays >= 0;
  }

  isNearExpiry(expiryDate: Date | string): boolean {
    if (!expiryDate) return false;
    const expiry = new Date(expiryDate);
    const today = new Date();
    const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 90 && diffDays > 30;
  }
}