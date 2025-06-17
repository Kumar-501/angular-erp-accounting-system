import { Component, OnInit, OnDestroy } from '@angular/core';
import { PaymentService } from '../services/payment.service';
import { PaymentData } from '../services/payment.service';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-paycash-details',
  templateUrl: './paycash-details.component.html',
  styleUrls: ['./paycash-details.component.scss'],
  providers: [DatePipe]
})
export class PaycashDetailsComponent implements OnInit, OnDestroy {
  payments: PaymentData[] = [];
  filteredPayments: PaymentData[] = [];
  private unsubscribePayments!: () => void; // Changed from Subscription to unsubscribe function
  
  // Search and filter properties
  searchTerm: string = '';
  statusFilter: string = 'all';
  dateRange: { start: Date | null; end: Date | null } = { start: null, end: null };
  
  // Pagination properties
  currentPage: number = 1;
  itemsPerPage: number = 10;
  totalItems: number = 0;
  Math = Math; // Fix for Math reference in template

  // Loading state
  isLoading: boolean = true;
  error: string | null = null;

  constructor(
    private paymentService: PaymentService,
    private datePipe: DatePipe
  ) {}

  ngOnInit(): void {
    this.loadPaymentsRealtime();
  }

  ngOnDestroy(): void {
    // Unsubscribe from real-time updates
    if (this.unsubscribePayments) {
      this.unsubscribePayments();
    }
  }

  /**
   * Load payments with real-time updates using onSnapshot
   */
  loadPaymentsRealtime(): void {
    this.isLoading = true;
    this.error = null;

    try {
      // Use the existing real-time method from PaymentService
      this.unsubscribePayments = this.paymentService.getAllSupplierPayments().subscribe({
        next: (payments) => {
          console.log('Real-time payments update received:', payments.length);
          this.payments = payments;
          this.applyFilters();
          this.isLoading = false;
          this.error = null;
        },
        error: (err) => {
          console.error('Error loading payments:', err);
          this.error = 'Failed to load payments. Please try again.';
          this.isLoading = false;
          this.payments = [];
          this.filteredPayments = [];
        }
      }).unsubscribe; // Get the unsubscribe function
    } catch (error) {
      console.error('Error setting up real-time payments:', error);
      this.error = 'Failed to initialize payment updates.';
      this.isLoading = false;
    }
  }

  /**
   * Alternative method using the direct onSnapshot approach
   * This method directly uses onSnapshot for more control
   */
  loadPaymentsWithDirectSnapshot(): void {
    this.isLoading = true;
    this.error = null;

    try {
      // Create a direct onSnapshot listener
      this.unsubscribePayments = this.paymentService.getAllSupplierPaymentsRealtime((payments) => {
        console.log('Direct snapshot update received:', payments.length);
        this.payments = payments;
        this.applyFilters();
        this.isLoading = false;
        this.error = null;
      });
    } catch (error) {
      console.error('Error setting up direct snapshot:', error);
      this.error = 'Failed to initialize real-time updates.';
      this.isLoading = false;
    }
  }

  applyFilters(): void {
    // Apply search filter
    let filtered = [...this.payments];
    
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(payment => 
        (payment.supplierName?.toLowerCase().includes(term)) ||
        (payment.referenceNo?.toLowerCase().includes(term)) ||
        (payment.paymentMethod?.toLowerCase().includes(term)) ||
        (payment.amount?.toString().includes(term))
      );
    }
    
    // Apply status filter
    if (this.statusFilter !== 'all') {
      filtered = filtered.filter(payment => payment.status === this.statusFilter);
    }
    
    // Apply date range filter
    if (this.dateRange.start || this.dateRange.end) {
      filtered = filtered.filter(payment => {
        if (!payment.paymentDate) return false;
        
        // Convert Firebase Timestamp to Date
        const paymentDate = this.convertToDate(payment.paymentDate);
        const start = this.dateRange.start ? new Date(this.dateRange.start) : null;
        const end = this.dateRange.end ? new Date(this.dateRange.end) : null;
        
        if (start && paymentDate < start) return false;
        if (end && paymentDate > end) return false;
        
        return true;
      });
    }
    
    this.filteredPayments = filtered;
    this.totalItems = filtered.length;
    this.currentPage = 1; // Reset to first page when filters change
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.statusFilter = 'all';
    this.dateRange = { start: null, end: null };
    this.applyFilters();
  }

  /**
   * Refresh data manually (useful for error recovery)
   */
  refreshData(): void {
    if (this.unsubscribePayments) {
      this.unsubscribePayments();
    }
    this.loadPaymentsRealtime();
  }

  /**
   * Retry loading data after an error
   */
  retryLoading(): void {
    this.refreshData();
  }

  // Pagination methods
  get paginatedPayments(): PaymentData[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredPayments.slice(startIndex, startIndex + this.itemsPerPage);
  }

  onPageChange(page: number): void {
    this.currentPage = page;
  }

  // Helper method to convert Firebase Timestamp to Date
  private convertToDate(dateValue: any): Date {
    if (!dateValue) return new Date();
    
    // If it's a Firebase Timestamp, use toDate() method
    if (dateValue && typeof dateValue.toDate === 'function') {
      return dateValue.toDate();
    }
    
    // If it's already a Date object
    if (dateValue instanceof Date) {
      return dateValue;
    }
    
    // If it's a string or number, convert to Date
    return new Date(dateValue);
  }

  // Format date for display
  formatDate(date: Date | string | any): string {
    if (!date) return '';
    
    // Convert to Date if it's a Firebase Timestamp
    const convertedDate = this.convertToDate(date);
    
    return this.datePipe.transform(convertedDate, 'medium') || '';
  }

  // Format currency for display
  formatCurrency(amount: number | undefined): string {
    if (amount === undefined) return '₹ 0.00';
    return `₹ ${amount.toFixed(2)}`;
  }

  /**
   * Get status badge class for styling
   */
  getStatusBadgeClass(status: string): string {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'badge-success';
      case 'pending':
        return 'badge-warning';
      case 'failed':
        return 'badge-danger';
      default:
        return 'badge-secondary';
    }
  }

  /**
   * Check if component is in a good state
   */
  get hasData(): boolean {
    return !this.isLoading && !this.error && this.payments.length > 0;
  }

  /**
   * Check if there are no results after filtering
   */
  get hasNoResults(): boolean {
    return !this.isLoading && !this.error && this.payments.length > 0 && this.filteredPayments.length === 0;
  }

  /**
   * Check if there's no data at all
   */
  get hasNoData(): boolean {
    return !this.isLoading && !this.error && this.payments.length === 0;
  }
}