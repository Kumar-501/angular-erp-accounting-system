import { Component, OnInit } from '@angular/core';
import { ReturnService } from '../services/return.service';
import { DatePipe } from '@angular/common';

interface SalesReturnLogItem {
  productId: string;
  productName: string;
  quantity: number;
  returnQuantity?: number;
  unitPrice: number;
  subtotal: number;
  reason?: string;
    taxRate?: number; // Add tax rate
  taxAmount?: number; 
  sku?: string;
  originalQuantity?: number;
    location?: string; // Add location field
  locationId?: string; 
}

interface SalesReturnLog {
  id?: string;
  saleId: string;
  returnDate: Date;
  items: SalesReturnLogItem[];
  processedBy?: string;
}

interface ReturnedProduct extends SalesReturnLogItem {
  returnId: string;
  returnDate: Date;
  originalSaleId: string;
  processedBy?: string;
    locationId?: string;       // Add location ID
  locationName?: string;
}

@Component({
  selector: 'app-returned-products',
  templateUrl: './returned-products.component.html',
  styleUrls: ['./returned-products.component.scss'],
  providers: [DatePipe]
})
export class ReturnedProductsComponent implements OnInit {
  // Original data arrays
  returnedProducts: ReturnedProduct[] = [];
  filteredProducts: ReturnedProduct[] = [];
  paginatedProducts: ReturnedProduct[] = [];
  
  // Loading and search states
  isLoading: boolean = false;
  searchTerm: string = '';
  
  // Date range filter
  dateRange: { start: Date | null, end: Date | null } = {
    start: null,
    end: null
  };

  // Pagination properties
  pageSize: number = 10;
  currentPage: number = 1;
  totalPages: number = 1;
  maxVisiblePages: number = 5;

  constructor(
    private returnService: ReturnService,
    private datePipe: DatePipe
  ) { }

  ngOnInit(): void {
    this.loadReturnedProducts();
  }

  // Computed properties for totals (based on filtered data)
  get totalQuantityReturned(): number {
    return this.filteredProducts.reduce((sum, p) => sum + (p.returnQuantity || p.quantity || 0), 0);
  }

  get totalRefundAmount(): number {
    return this.filteredProducts.reduce((sum, p) => sum + (p.subtotal || 0), 0);
  }

  // Pagination computed properties
  get totalRecords(): number {
    return this.filteredProducts.length;
  }

  get startRecord(): number {
    return this.filteredProducts.length === 0 ? 0 : (this.currentPage - 1) * this.pageSize + 1;
  }

  get endRecord(): number {
    return Math.min(this.currentPage * this.pageSize, this.filteredProducts.length);
  }

  async loadReturnedProducts(): Promise<void> {
    this.isLoading = true;
    try {
      const logs = await this.returnService.getReturnLogsByDateRange(
        new Date(0),
        new Date()
      ) as unknown as SalesReturnLog[];
      
      this.returnedProducts = logs.flatMap(log => 
        log.items.map(item => ({
          ...item,
          returnId: log.id || '',
          returnDate: log.returnDate,
          originalSaleId: log.saleId,
          processedBy: log.processedBy
        }))
      );
      
      // Apply initial filtering and pagination
      this.applyFilter();
    } catch (error) {
      console.error('Error loading returned products:', error);
    } finally {
      this.isLoading = false;
    }
  }

  // Search and Filter functionality
  applyFilter(): void {
    let filtered = [...this.returnedProducts];

    // Apply search term filter
    if (this.searchTerm && this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase().trim();
      filtered = filtered.filter(product => 
        product.productName.toLowerCase().includes(term) ||
        product.productId.toLowerCase().includes(term) ||
        (product.sku && product.sku.toLowerCase().includes(term)) ||
        product.returnId.toLowerCase().includes(term) ||
        product.originalSaleId.toLowerCase().includes(term) ||
        (product.reason && product.reason.toLowerCase().includes(term))
      );
    }

    // Apply date range filter
    if (this.dateRange.start && this.dateRange.end) {
      const startDate = new Date(this.dateRange.start);
      const endDate = new Date(this.dateRange.end);
      endDate.setHours(23, 59, 59, 999); // Include the entire end date
      
      filtered = filtered.filter(product => {
        const returnDate = new Date(product.returnDate);
        return returnDate >= startDate && returnDate <= endDate;
      });
    }

    this.filteredProducts = filtered;
    this.currentPage = 1; // Reset to first page when filtering
    this.updatePagination();
  }

  onSearchInput(): void {
    this.applyFilter();
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.applyFilter();
  }

  clearDateFilter(): void {
    this.dateRange = { start: null, end: null };
    this.applyFilter();
  }

  // Pagination functionality
  updatePagination(): void {
    this.totalPages = Math.ceil(this.filteredProducts.length / this.pageSize);
    this.updatePaginatedData();
  }

  updatePaginatedData(): void {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    this.paginatedProducts = this.filteredProducts.slice(startIndex, endIndex);
  }

  onPageSizeChange(): void {
    this.currentPage = 1;
    this.updatePagination();
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePaginatedData();
    }
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePaginatedData();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePaginatedData();
    }
  }

  getVisiblePages(): number[] {
    const pages: number[] = [];
    const start = Math.max(1, this.currentPage - Math.floor(this.maxVisiblePages / 2));
    const end = Math.min(this.totalPages, start + this.maxVisiblePages - 1);
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    
    return pages;
  }

  async searchReturns(): Promise<void> {
    this.isLoading = true;
    try {
      let results: ReturnedProduct[] = [];
      
      if (this.searchTerm) {
        const byId = await this.returnService.getReturnsByProductId(this.searchTerm) as unknown as SalesReturnLog[];
        const byName = await this.returnService.getReturnsByProductName(this.searchTerm) as unknown as SalesReturnLog[];
        
        results = [...byId, ...byName]
          .flatMap(log => log.items.map(item => ({
            ...item,
            returnId: log.id || '',
            returnDate: log.returnDate,
            originalSaleId: log.saleId
          } as ReturnedProduct)))
          .filter((item, index, self) => 
            index === self.findIndex(t => 
              t.productId === item.productId && 
              t.returnId === item.returnId
            )
          );
      } else if (this.dateRange.start && this.dateRange.end) {
        const logs = await this.returnService.getReturnLogsByDateRange(
          new Date(this.dateRange.start),
          new Date(this.dateRange.end)
        ) as unknown as SalesReturnLog[];
        
        results = logs.flatMap(log => 
          log.items.map(item => ({
            ...item,
            returnId: log.id || '',
            returnDate: log.returnDate,
            originalSaleId: log.saleId
          } as ReturnedProduct))
        );
      } else {
        return this.loadReturnedProducts();
      }
      
      this.returnedProducts = results;
      this.applyFilter();
    } catch (error) {
      console.error('Error searching returns:', error);
    } finally {
      this.isLoading = false;
    }
  }

  resetSearch(): void {
    this.searchTerm = '';
    this.dateRange = { start: null, end: null };
    this.loadReturnedProducts();
  }

  formatDate(date: Date): string {
    return this.datePipe.transform(date, 'mediumDate') || '';
  }

  // Export functionality (optional)
  exportToCSV(): void {
    const csvData = this.filteredProducts.map(product => ({
      'Product Name': product.productName,
      'Product ID': product.productId,
      'SKU': product.sku || '',
      'Return ID': product.returnId,
      'Sale ID': product.originalSaleId,
      'Quantity Returned': product.returnQuantity || product.quantity,
      'Unit Price': product.unitPrice,
      'Subtotal': product.subtotal,
      'Return Date': this.formatDate(product.returnDate),
      'Reason': product.reason || ''
    }));

    const csvContent = this.convertToCSV(csvData);
    this.downloadCSV(csvContent, 'returned-products.csv');
  }

  private convertToCSV(data: any[]): string {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          return typeof value === 'string' && value.includes(',') 
            ? `"${value}"` 
            : value;
        }).join(',')
      )
    ];
    
    return csvRows.join('\n');
  }

  private downloadCSV(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }
}