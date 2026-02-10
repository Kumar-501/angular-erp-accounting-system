import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { SaleService } from '../services/sale.service';
import { Subscription } from 'rxjs';
import * as XLSX from 'xlsx';

declare var bootstrap: any;

@Component({
  selector: 'app-sell-return-report',
  templateUrl: './sell-return-report.component.html',
  styleUrls: ['./sell-return-report.component.scss']
})
export class SellReturnReportComponent implements OnInit, OnDestroy {
  @ViewChild('fromDatePicker') fromDatePicker!: ElementRef;
  @ViewChild('toDatePicker') toDatePicker!: ElementRef;

  returns: any[] = [];
  filteredReturns: any[] = [];
  private returnsSubscription: Subscription | undefined;
  
  // Filter properties (Internal values kept in YYYY-MM-DD)
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
  Math: any = Math;

  constructor(private saleService: SaleService) {
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
    
    // Default range in YYYY-MM-DD
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

  // --- DATE UI HELPERS ---
  getDisplayDate(dateString: string): string {
    if (!dateString) return '';
    const parts = dateString.split('-');
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }

  openDatePicker(type: 'from' | 'to'): void {
    if (type === 'from') {
      this.fromDatePicker.nativeElement.showPicker();
    } else {
      this.toDatePicker.nativeElement.showPicker();
    }
  }

  onDateInput(event: any, type: 'from' | 'to'): void {
    const input = event.target.value.trim();
    const match = input.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (match) {
      const internalValue = `${match[3]}-${match[2]}-${match[1]}`;
      if (type === 'from') this.fromDate = internalValue;
      else this.toDate = internalValue;
      this.applyFilters();
    } else if (input === '') {
      if (type === 'from') this.fromDate = '';
      else this.toDate = '';
      this.applyFilters();
    }
  }

  private loadReturns(): void {
    this.returnsSubscription = this.saleService.getReturns().subscribe({
      next: (returns) => {
        this.returns = this.processReturnsData(returns);
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
      let returnDate = null;
      if (returnItem.returnDate) returnDate = new Date(returnItem.returnDate);
      else if (returnItem.createdAt) returnDate = new Date(returnItem.createdAt);
      else if (returnItem.timestamp) returnDate = new Date(returnItem.timestamp);
      else returnDate = new Date();

      if (isNaN(returnDate.getTime())) returnDate = new Date();

      const processedItems = (returnItem.returnedItems || []).map((item: any) => ({
        ...item,
        name: item.name || item.productName || 'Unknown Item',
        quantity: item.quantity || item.returnQuantity || 0,
        unitPrice: parseFloat(item.unitPrice || item.price || 0),
        subtotal: item.subtotal || (parseFloat(item.unitPrice || item.price || 0) * (item.quantity || 0))
      }));

      return {
        ...returnItem,
        returnDate: returnDate,
        returnedItems: processedItems,
        customer: returnItem.customer || returnItem.saleData?.customer || 'Unknown Customer',
        invoiceNo: returnItem.invoiceNo || returnItem.saleData?.invoiceNo || 'N/A',
        totalRefund: returnItem.totalRefund || this.calculateTotalRefund(processedItems),
        status: returnItem.status || 'Processed'
      };
    });
  }

  private calculateTotalRefund(items: any[]): number {
    return items.reduce((total, item) => total + (item.quantity * item.unitPrice), 0);
  }

  getReturnDate(returnItem: any): Date {
    let dateValue = returnItem.returnDate || new Date();
    if (!(dateValue instanceof Date)) dateValue = new Date(dateValue);
    return isNaN(dateValue.getTime()) ? new Date() : dateValue;
  }

  getReturnStatus(returnItem: any): string {
    return returnItem.status || 'Processed';
  }

  applyFilters(): void {
    let filtered = [...this.returns];

    if (this.searchTerm && this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase().trim();
      filtered = filtered.filter(ret => 
        (ret.invoiceNo || '').toLowerCase().includes(term) || 
        (ret.customer || '').toLowerCase().includes(term)
      );
    }

    if (this.fromDate) {
      const from = new Date(this.fromDate);
      from.setHours(0, 0, 0, 0);
      filtered = filtered.filter(ret => this.getReturnDate(ret) >= from);
    }

    if (this.toDate) {
      const to = new Date(this.toDate);
      to.setHours(23, 59, 59, 999);
      filtered = filtered.filter(ret => this.getReturnDate(ret) <= to);
    }

    if (this.statusFilter) {
      filtered = filtered.filter(ret => this.getReturnStatus(ret) === this.statusFilter);
    }

    filtered.sort((a, b) => this.getReturnDate(b).getTime() - this.getReturnDate(a).getTime());

    this.filteredReturns = filtered;
    this.totalEntries = this.filteredReturns.length;
    this.currentPage = 1;
  }

  getTotalRefundAmount(returnedItems: any[]): number {
    return (returnedItems || []).reduce((total, item) => total + (item.subtotal || 0), 0);
  }

  getProcessedReturnsCount(): number {
    return this.returns.filter(ret => this.getReturnStatus(ret) === 'Processed').length;
  }

  getPendingReturnsCount(): number {
    return this.returns.filter(ret => this.getReturnStatus(ret) === 'Pending').length;
  }

  getTotalRefundAmountAll(): number {
    return this.returns.reduce((total, ret) => total + this.getTotalRefundAmount(ret.returnedItems), 0);
  }

  previousPage(): void { if (this.currentPage > 1) this.currentPage--; }
  nextPage(): void { if (this.currentPage * this.entriesPerPage < this.totalEntries) this.currentPage++; }
  onEntriesPerPageChange(): void { this.currentPage = 1; this.entriesPerPage = Number(this.entriesPerPage); }

  exportToExcel(): void {
    if (this.filteredReturns.length === 0) return;
    const dataToExport = this.filteredReturns.map(ret => ({
      'Return Date': this.datePipeTransform(this.getReturnDate(ret)),
      'Invoice No': ret.invoiceNo,
      'Customer Name': ret.customer,
      'Refund Amount': this.getTotalRefundAmount(ret.returnedItems),
      'Status': this.getReturnStatus(ret)
    }));
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sales Returns');
    XLSX.writeFile(wb, `Sales_Return_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  private datePipeTransform(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}-${month}-${date.getFullYear()}`;
  }

  viewReturnDetails(returnItem: any): void {
    this.selectedReturn = returnItem;
    if (typeof bootstrap !== 'undefined') {
      const element = document.getElementById('returnDetailsModal');
      if (element) new bootstrap.Modal(element).show();
    }
  }

  printReturn(returnItem: any) { window.print(); }
}