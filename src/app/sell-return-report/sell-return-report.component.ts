// sell-return-report.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { SaleService } from '../services/sale.service';
import { Subscription } from 'rxjs';

declare var bootstrap: any;

@Component({
  selector: 'app-sell-return-report',
  templateUrl: './sell-return-report.component.html',
  styleUrls: ['./sell-return-report.component.scss']
})
export class SellReturnReportComponent implements OnInit, OnDestroy {
printReturn(_t80: any) {
throw new Error('Method not implemented.');
}
  returns: any[] = [];
  filteredReturns: any[] = [];
  private returnsSubscription: Subscription | undefined;
  
  // Filter properties
  searchTerm: string = '';
  fromDate: string = '';
  toDate: string = '';
  statusFilter: string = '';
  
  // Pagination properties
  currentPage: number = 1;
  entriesPerPage: number = 10;
  totalEntries: number = 0;
  
  // Modal properties
  selectedReturn: any = null;
Math: any;

  constructor(private saleService: SaleService) {
    // Set default date range (last 30 days)
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
    
    this.toDate = today.toISOString().split('T')[0];
    this.fromDate = thirtyDaysAgo.toISOString().split('T')[0];
  }

  ngOnInit(): void {
    this.loadReturns();
  }

  ngOnDestroy(): void {
    if (this.returnsSubscription) {
      this.returnsSubscription.unsubscribe();
    }
  }

  private loadReturns(): void {
    this.returnsSubscription = this.saleService.getReturns().subscribe({
      next: (returns) => {
        console.log('Raw returns data:', returns);
        this.returns = this.processReturnsData(returns);
        console.log('Processed returns data:', this.returns);
        this.applyFilters();
      },
      error: (error) => {
        console.error('Error loading returns:', error);
        this.returns = [];
        this.filteredReturns = [];
        this.totalEntries = 0;
      }
    });
  }

  private processReturnsData(returns: any[]): any[] {
    return returns.map(returnItem => {
      // Ensure return date is properly set
      let returnDate = null;
      
      // Try multiple possible date fields
      if (returnItem.returnDate) {
        returnDate = new Date(returnItem.returnDate);
      } else if (returnItem.createdAt) {
        returnDate = new Date(returnItem.createdAt);
      } else if (returnItem.timestamp) {
        returnDate = new Date(returnItem.timestamp);
      } else if (returnItem.date) {
        returnDate = new Date(returnItem.date);
      } else {
        // If no date found, use current date as fallback
        returnDate = new Date();
        console.warn('No return date found for return, using current date:', returnItem);
      }

      // Validate the date
      if (isNaN(returnDate.getTime())) {
        returnDate = new Date();
        console.warn('Invalid return date found, using current date:', returnItem);
      }

      // Process returned items to ensure they have proper structure
      const processedReturnedItems = (returnItem.returnedItems || []).map((item: any) => ({
        id: item.id || item.productId || item.itemId,
        name: item.name || item.productName || item.itemName || 'Unknown Item',
        productName: item.name || item.productName || item.itemName || 'Unknown Item',
        quantity: item.quantity || item.returnQuantity || 0,
        returnQuantity: item.quantity || item.returnQuantity || 0,
        originalQuantity: item.originalQuantity || item.quantity || 0,
        unitPrice: parseFloat(item.unitPrice || item.price || item.unit_price || 0),
        price: parseFloat(item.unitPrice || item.price || item.unit_price || 0),
        subtotal: item.subtotal || (parseFloat(item.unitPrice || item.price || 0) * (item.quantity || item.returnQuantity || 0)),
        ...item // Preserve all original fields
      }));

      return {
        ...returnItem,
        returnDate: returnDate,
        createdAt: returnDate, // Ensure we have both fields
        timestamp: returnDate.getTime(),
        returnedItems: processedReturnedItems,
        
        // Ensure we have customer info
        customer: returnItem.customer || returnItem.saleData?.customer || 'Unknown Customer',
        
        // Ensure we have invoice number
        invoiceNo: returnItem.invoiceNo || returnItem.saleData?.invoiceNo || 'N/A',
        
        // Ensure we have return reason
        returnReason: returnItem.returnReason || returnItem.reason || '',
        reason: returnItem.returnReason || returnItem.reason || '',
        
        // Calculate total refund if not present
        totalRefund: returnItem.totalRefund || returnItem.refundAmount || this.calculateTotalRefund(processedReturnedItems),
        refundAmount: returnItem.totalRefund || returnItem.refundAmount || this.calculateTotalRefund(processedReturnedItems),
        
        // Set default status if not present
        status: returnItem.status || 'Processed'
      };
    });
  }

  private calculateTotalRefund(items: any[]): number {
    return items.reduce((total, item) => {
      const quantity = item.quantity || item.returnQuantity || 0;
      const unitPrice = parseFloat(item.unitPrice || item.price || 0);
      return total + (quantity * unitPrice);
    }, 0);
  }

  getReturnDate(returnItem: any): Date {
    // Try multiple possible date fields with fallbacks
    let dateValue = returnItem.returnDate || 
                   returnItem.createdAt || 
                   returnItem.timestamp || 
                   returnItem.date ||
                   new Date();

    // If timestamp is a number, convert to Date
    if (typeof dateValue === 'number') {
      dateValue = new Date(dateValue);
    } else if (typeof dateValue === 'string') {
      dateValue = new Date(dateValue);
    } else if (!(dateValue instanceof Date)) {
      dateValue = new Date();
    }

    // Validate the date
    if (isNaN(dateValue.getTime())) {
      console.warn('Invalid date found, using current date:', returnItem);
      return new Date();
    }

    return dateValue;
  }

  getReturnStatus(returnItem: any): string {
    return returnItem.status || 'Processed';
  }

  applyFilters(): void {
    let filtered = [...this.returns];

    // Apply search filter
    if (this.searchTerm && this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase().trim();
      filtered = filtered.filter(ret => {
        const invoiceNo = (ret.invoiceNo || ret.saleData?.invoiceNo || '').toLowerCase();
        const customer = (ret.customer || ret.saleData?.customer || '').toLowerCase();
        const reason = (ret.returnReason || ret.reason || '').toLowerCase();
        
        return invoiceNo.includes(term) || 
               customer.includes(term) || 
               reason.includes(term);
      });
    }

    // Apply date filters
    if (this.fromDate) {
      const fromDate = new Date(this.fromDate);
      fromDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter(ret => {
        const returnDate = this.getReturnDate(ret);
        returnDate.setHours(0, 0, 0, 0);
        return returnDate >= fromDate;
      });
    }

    if (this.toDate) {
      const toDate = new Date(this.toDate);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(ret => {
        const returnDate = this.getReturnDate(ret);
        return returnDate <= toDate;
      });
    }

    // Apply status filter
    if (this.statusFilter) {
      filtered = filtered.filter(ret => 
        this.getReturnStatus(ret).toLowerCase() === this.statusFilter.toLowerCase()
      );
    }

    // Sort by return date (newest first)
    filtered.sort((a, b) => {
      const dateA = this.getReturnDate(a);
      const dateB = this.getReturnDate(b);
      return dateB.getTime() - dateA.getTime();
    });

    this.filteredReturns = filtered;
    this.totalEntries = this.filteredReturns.length;
    this.currentPage = 1; // Reset to first page when filters change
  }

  getTotalRefundAmount(returnedItems: any[]): number {
    if (!returnedItems || !Array.isArray(returnedItems)) {
      return 0;
    }

    return returnedItems.reduce((total, item) => {
      if (item.subtotal && !isNaN(item.subtotal)) {
        return total + parseFloat(item.subtotal);
      }
      
      const quantity = item.quantity || item.returnQuantity || 0;
      const unitPrice = parseFloat(item.unitPrice || item.price || item.unit_price || 0);
      return total + (quantity * unitPrice);
    }, 0);
  }

  // Summary methods
  getProcessedReturnsCount(): number {
    return this.returns.filter(ret => this.getReturnStatus(ret) === 'Processed').length;
  }

  getPendingReturnsCount(): number {
    return this.returns.filter(ret => this.getReturnStatus(ret) === 'Pending').length;
  }

  getTotalRefundAmountAll(): number {
    return this.returns.reduce((total, ret) => {
      return total + this.getTotalRefundAmount(ret.returnedItems);
    }, 0);
  }

  // Pagination methods
  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  nextPage(): void {
    if (this.currentPage * this.entriesPerPage < this.totalEntries) {
      this.currentPage++;
    }
  }

  onEntriesPerPageChange(): void {
    this.currentPage = 1; // Reset to first page
    this.entriesPerPage = Number(this.entriesPerPage);
  }

  // Modal and action methods
  viewReturnDetails(returnItem: any): void {
    this.selectedReturn = returnItem;
    
    // Use Bootstrap modal if available, or implement your own modal logic
    if (typeof bootstrap !== 'undefined') {
      const modal = new bootstrap.Modal(document.getElementById('returnDetailsModal'));
      modal.show();
    } else {
      // Fallback: could use Angular Material dialog or other modal library
      console.log('Return details:', returnItem);
      alert('Return details logged to console. Implement modal library for better UX.');
    }
  }}