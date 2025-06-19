import { Component, OnInit, OnDestroy } from '@angular/core';
import { SalesCallService } from '../../services/sales-call.service';
import { Subscription } from 'rxjs';
import { CallLogService } from '../../services/call-log.service';
import { Router } from '@angular/router';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { take } from 'rxjs/operators';
import { Timestamp } from '@angular/fire/firestore';
import { AuthService } from '../../auth.service';
import 'jspdf-autotable';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-sales-call',
  templateUrl: './sales-call.component.html',
  styleUrls: ['./sales-call.component.scss']
})
export class SalesCallComponent implements OnInit, OnDestroy {
  salesCalls: any[] = [];
  filteredCalls: any[] = [];
  selectedStatus = '';
  availableUsers: any[] = [];
  isUpdatingStatus = new Set<string>();

  searchTerm = '';
  allColumns = [
    { key: 'select', label: 'Select' },
    { key: 'customerName', label: 'Customer Name' },
    { key: 'mobile', label: 'Mobile' },
    { key: 'lastTransactionDate', label: 'Last Transaction' },
    { key: 'assignedTo', label: 'Assigned To' },
    { key: 'callStatus', label: 'Call Status' },
    { key: 'department', label: 'Department' },
    { key: 'notes', label: 'Notes' },
    { key: 'actions', label: 'Actions' }
  ];
  
  visibleColumns = [
    'select', 'customerName', 'mobile', 'lastTransactionDate', 'department',
    'assignedTo', 'callStatus', 'notes', 'actions'
  ];

  showColumnDropdown = false;
  private callsSubscription!: Subscription;
  sortColumn: string = 'customerName';
  sortDirection: 'asc' | 'desc' = 'asc';

  showFilterSidebar = false;
  salesAgents: string[] = ['Agent 1', 'Agent 2', 'Agent 3'];

  filters = {
    status: '',
    assignedTo: '',
    startDate: '',
    endDate: '',
    transactionType: '',
    callOutcome: ''
  };

  // Pagination
  currentPage = 1;
  itemsPerPage = 10;
  totalItems = 0;
  totalPages = 0;

  // Bulk actions
  selectedCalls: string[] = [];
  selectAll = false;

  customerCallLogs: { [customerId: string]: any[] } = {};
  Math = Math;

  constructor(
    private salesCallService: SalesCallService,
    private callLogService: CallLogService,
    private userService: UserService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadSalesCalls();
    this.loadAvailableUsers();
  }

  ngOnDestroy(): void {
    if (this.callsSubscription) {
      this.callsSubscription.unsubscribe();
    }
  }

  // FIXED: Simplified and more reliable status update method
  async updateIndividualCallStatus(customerId: string, event: any): Promise<void> {
    const newStatus = event.target.value;
    
    if (!customerId || !newStatus) {
      console.warn('Invalid customerId or status');
      return;
    }

    // Prevent multiple simultaneous updates for the same customer
    if (this.isUpdatingStatus.has(customerId)) {
      console.log('Update already in progress for customer:', customerId);
      return;
    }

    console.log('Updating status for customer:', customerId, 'to:', newStatus);
    
    // Mark as updating
    this.isUpdatingStatus.add(customerId);
    
    try {
      // Update the status using the service
      await this.salesCallService.updateSalesCall(customerId, {
        callStatus: newStatus,
        statusUpdatedAt: new Date()
      });
      
      // Update local state immediately for better UX
      this.updateLocalCallStatus(customerId, newStatus);
      
      // Create a call log entry for this status change
      const currentUserId = await this.getCurrentUserId();
      await this.callLogService.addCallLog(customerId, {
        subject: `Status changed to ${newStatus}`,
        description: `Status manually changed to ${newStatus}`,
        callOutcome: this.mapStatusToCallOutcome(newStatus),
        createdAt: Timestamp.now(),
        createdBy: currentUserId,
        isStatusUpdate: true
      });

      console.log('Status updated successfully for customer:', customerId);
      
    } catch (error) {
      console.error('Error updating status for customer:', customerId, error);
      
      // Revert the UI change on error
      const originalCall = this.salesCalls.find(call => call.customerId === customerId);
      if (originalCall) {
        event.target.value = originalCall.callStatus || 'Pending';
      }
      
      alert('Failed to update status. Please try again.');
    } finally {
      // Remove from updating set
      this.isUpdatingStatus.delete(customerId);
    }
  }

  // Helper method to update local state
  private updateLocalCallStatus(customerId: string, newStatus: string): void {
    // Update in salesCalls array
    const salesCallIndex = this.salesCalls.findIndex(call => call.customerId === customerId);
    if (salesCallIndex >= 0) {
      this.salesCalls[salesCallIndex] = {
        ...this.salesCalls[salesCallIndex],
        callStatus: newStatus,
        statusUpdatedAt: new Date()
      };
    }
    
    // Update in filteredCalls array
    const filteredCallIndex = this.filteredCalls.findIndex(call => call.customerId === customerId);
    if (filteredCallIndex >= 0) {
      this.filteredCalls[filteredCallIndex] = {
        ...this.filteredCalls[filteredCallIndex],
        callStatus: newStatus,
        statusUpdatedAt: new Date()
      };
    }
  }

  // Track by function for better performance
  trackByFn(index: number, item: any): any {
    return item.customerId || index;
  }

  // Get visible column count for colspan
  getVisibleColumnCount(): number {
    return this.visibleColumns.length;
  }

  loadSalesCalls(): void {
    this.callsSubscription = this.salesCallService.getSalesCalls().subscribe({
      next: (calls) => {
        console.log('Loaded sales calls:', calls.length);
        this.salesCalls = calls;
        this.filteredCalls = [...calls];
        this.totalItems = calls.length;
        this.calculateTotalPages();
      },
      error: (err) => {
        console.error('Error loading sales calls:', err);
        alert('Failed to load sales calls. Please refresh the page.');
      }
    });
  }

  loadAvailableUsers(): void {
    this.userService.getUsers().pipe(take(1)).subscribe({
      next: (users) => {
        this.availableUsers = users.filter(user => 
          user.role === 'Executive' || user.role === 'Sales'
        );
      },
      error: (err) => {
        console.error('Error loading users:', err);
      }
    });
  }

  async getCurrentUserId(): Promise<string> {
    try {
      return new Promise((resolve) => {
        this.authService.getCurrentUser().pipe(take(1)).subscribe(user => {
          resolve(user?.uid || 'anonymous');
        });
      });
    } catch (error) {
      console.error('Error getting current user:', error);
      return 'anonymous';
    }
  }

  private mapStatusToCallOutcome(status: string): string {
    switch(status) {
      case 'Completed': return 'Successful';
      case 'Pending': return 'No Answer';
      case 'Follow-up': return 'Left Message';
      case 'Not Interested': return 'Wrong Number';
      default: return status;
    }
  }
  // Enhanced bulk update method with call logs
  async bulkUpdateStatus(newStatus: string): Promise<void> {
    if (!newStatus || this.selectedCalls.length === 0) {
      return;
    }

    console.log('Bulk updating status to:', newStatus, 'for calls:', this.selectedCalls);

    // Mark all as updating
    this.selectedCalls.forEach(id => this.isUpdatingStatus.add(id));
    
    try {
      // Get current user ID for the call logs
      const currentUserId = await this.getCurrentUserId();
      
      // Prepare updates
      const updates = this.selectedCalls.map(customerId => ({
        id: customerId,
        data: { 
          callStatus: newStatus,
          statusUpdatedAt: new Date()
        }
      }));

      // Perform the bulk update
      const result = await this.salesCallService.bulkUpdateCalls(updates);
      console.log('Bulk update result:', result);
      
      // Create call logs and update local state for successful updates
      const successfulIds = updates
        .map(update => update.id)
        .filter(id => !result.failures.find(f => f.id === id));
      
      // Update local state and create call logs for successful updates
      for (const customerId of successfulIds) {
        // Update local state
        this.updateLocalCallStatus(customerId, newStatus);
        
        // Create call log entry
        await this.callLogService.addCallLog(customerId, {
          subject: `Status changed to ${newStatus}`,
          description: `Status bulk updated to ${newStatus}`,
          callOutcome: this.mapStatusToCallOutcome(newStatus),
          createdAt: Timestamp.now(),
          createdBy: currentUserId,
          isStatusUpdate: true
        });
      }
      
      // Clear selection after update
      this.selectedCalls = [];
      this.selectAll = false;

      if (result.failures.length > 0) {
        alert(`Updated ${result.success} calls successfully. Failed to update ${result.failures.length} calls.`);
      } else {
        console.log('Bulk status update completed successfully');
      }

    } catch (error) {
      console.error('Bulk update failed:', error);
      alert('Failed to update status for some calls. Please try again.');
    } finally {
      // Remove all from updating set
      this.selectedCalls.forEach(id => this.isUpdatingStatus.delete(id));
    }
  }

  async bulkAssignTo(userId: string): Promise<void> {
    if (!userId || this.selectedCalls.length === 0) return;
    
    try {
      const user = this.availableUsers.find(u => u.id === userId);
      if (!user) return;
      
      const userName = `${user.firstName} ${user.lastName}`;
      const updates = this.selectedCalls.map(customerId => ({
        id: customerId,
        data: { 
          assignedTo: userName,
          assignedToId: userId,
          department: user.department
        }
      }));

      await this.salesCallService.bulkUpdateCalls(updates);

      // Update local state
      this.salesCalls = this.salesCalls.map(call => 
        this.selectedCalls.includes(call.customerId) 
          ? { ...call, assignedTo: userName, assignedToId: userId, department: user.department } 
          : call
      );
      
      this.filteredCalls = this.filteredCalls.map(call => 
        this.selectedCalls.includes(call.customerId) 
          ? { ...call, assignedTo: userName, assignedToId: userId, department: user.department } 
          : call
      );
      
      this.selectedCalls = [];
      this.selectAll = false;
      
    } catch (error) {
      console.error('Bulk assign failed:', error);
      alert('Failed to assign users. Please try again.');
    }
  }

  updateCallNotes(customerId: string, notes: string): void {
    if (!customerId) return;
    
    this.salesCallService.updateSalesCall(customerId, { notes })
      .catch(err => {
        console.error('Error updating call notes:', err);
        alert('Failed to update notes. Please try again.');
      });
  }

  // Column visibility methods
  toggleColumnDropdown(): void {
    this.showColumnDropdown = !this.showColumnDropdown;
  }
  
  isColumnVisible(columnKey: string): boolean {
    return this.visibleColumns.includes(columnKey);
  }

  toggleColumnVisibility(columnKey: string): void {
    if (this.isColumnVisible(columnKey)) {
      this.visibleColumns = this.visibleColumns.filter(col => col !== columnKey);
    } else {
      this.visibleColumns = [...this.visibleColumns, columnKey];
    }
    
    if (this.visibleColumns.length === 0) {
      this.visibleColumns = ['customerName'];
    }
  }

  resetColumnVisibility(): void {
    this.visibleColumns = [
      'select', 'customerName', 'mobile', 'lastTransactionDate', 
      'assignedTo', 'callStatus', 'department', 'notes', 'actions'
    ];
  }

  // Sorting
  sort(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    
    this.applySorting();
  }

  applySorting(): void {
    this.filteredCalls.sort((a, b) => {
      const aValue = a[this.sortColumn] ?? '';
      const bValue = b[this.sortColumn] ?? '';
      
      if (this.sortColumn === 'lastTransactionDate') {
        const dateA = aValue ? new Date(aValue).getTime() : 0;
        const dateB = bValue ? new Date(bValue).getTime() : 0;
        return this.sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
      }
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return this.sortDirection === 'asc' 
          ? aValue.localeCompare(bValue) 
          : bValue.localeCompare(aValue);
      }
      
      return this.sortDirection === 'asc' 
        ? (aValue > bValue ? 1 : -1) 
        : (bValue > aValue ? 1 : -1);
    });
    
    this.currentPage = 1;
  }

  // Filtering
  applyFilters(): void {
    let filtered = [...this.salesCalls];

    if (this.selectedStatus) {
      filtered = filtered.filter(call => call.callStatus === this.selectedStatus);
    }

    if (this.searchTerm && this.searchTerm.trim() !== '') {
      const term = this.searchTerm.toLowerCase().trim();
      filtered = filtered.filter(call =>
        (call.customerName && call.customerName.toLowerCase().includes(term)) ||
        (call.mobile && call.mobile.toString().includes(term)) ||
        (call.businessName && call.businessName.toLowerCase().includes(term))
      );
    }

    this.filteredCalls = filtered;
    this.totalItems = filtered.length;
    this.currentPage = 1;
    this.calculateTotalPages();
  }

  applyAdvancedFilters(): void {
    let filtered = [...this.salesCalls];

    if (this.filters.status) {
      filtered = filtered.filter(call => call.callStatus === this.filters.status);
    }

    if (this.filters.assignedTo) {
      filtered = filtered.filter(call => call.assignedTo === this.filters.assignedTo);
    }

    if (this.filters.startDate) {
      const startDate = new Date(this.filters.startDate);
      filtered = filtered.filter(call => {
        const callDate = call.callDate ? new Date(call.callDate) : null;
        return callDate && callDate >= startDate;
      });
    }

    if (this.filters.endDate) {
      const endDate = new Date(this.filters.endDate);
      filtered = filtered.filter(call => {
        const callDate = call.callDate ? new Date(call.callDate) : null;
        return callDate && callDate <= endDate;
      });
    }

    this.filteredCalls = filtered;
    this.totalItems = filtered.length;
    this.currentPage = 1;
    this.calculateTotalPages();
    this.showFilterSidebar = false;
  }

  resetAdvancedFilters(): void {
    this.filters = {
      status: '',
      assignedTo: '',
      startDate: '',
      endDate: '',
      transactionType: '',
      callOutcome: ''
    };
    this.filteredCalls = [...this.salesCalls];
    this.totalItems = this.filteredCalls.length;
    this.currentPage = 1;
    this.calculateTotalPages();
  }

  resetFilters(): void {
    this.selectedStatus = '';
    this.searchTerm = '';
    this.filteredCalls = [...this.salesCalls];
    this.totalItems = this.filteredCalls.length;
    this.currentPage = 1;
    this.calculateTotalPages();
  }

  toggleFilterSidebar(): void {
    this.showFilterSidebar = !this.showFilterSidebar;
  }

  // Selection methods
  toggleCallSelection(callId: string): void {
    const index = this.selectedCalls.indexOf(callId);
    if (index === -1) {
      this.selectedCalls.push(callId);
    } else {
      this.selectedCalls.splice(index, 1);
    }
    
    // Update selectAll state
    this.selectAll = this.selectedCalls.length === this.paginatedCalls.length;
  }

  toggleSelectAll(): void {
    if (this.selectAll) {
      this.selectedCalls = this.paginatedCalls.map(call => call.customerId);
    } else {
      this.selectedCalls = [];
    }
  }

  isSelected(callId: string): boolean {
    return this.selectedCalls.includes(callId);
  }

  clearSelection(): void {
    this.selectedCalls = [];
    this.selectAll = false;
  }

  // Pagination
  get paginatedCalls(): any[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredCalls.slice(start, start + this.itemsPerPage);
  }

  pageChanged(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  calculateTotalPages(): void {
    this.totalPages = Math.ceil(this.filteredCalls.length / this.itemsPerPage);
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    const totalVisiblePages = 5;
    
    if (this.totalPages <= totalVisiblePages) {
      for (let i = 1; i <= this.totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      
      let startPage = Math.max(2, this.currentPage - 1);
      let endPage = Math.min(this.totalPages - 1, this.currentPage + 1);
      
      if (this.currentPage <= 3) {
        endPage = Math.min(totalVisiblePages - 1, this.totalPages - 1);
      }
      
      if (this.currentPage >= this.totalPages - 2) {
        startPage = Math.max(2, this.totalPages - (totalVisiblePages - 2));
      }
      
      if (startPage > 2) {
        pages.push(-1);
      }
      
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
      
      if (endPage < this.totalPages - 1) {
        pages.push(-2);
      }
      
      pages.push(this.totalPages);
    }
    
    return pages;
  }
  
  onItemsPerPageChange(): void {
    this.currentPage = 1;
    this.calculateTotalPages();
  }

  // Navigation methods
  viewCustomerDetails(customerId: string): void {
    this.router.navigate(['/crm/customers/view', customerId], {
      state: { 
        fromSalesCall: true,
        returnUrl: this.router.url 
      }
    });
  }

  addNewCallLog(customerId: string): void {
    this.router.navigate(['/crm/calls/new'], {
      queryParams: { customerId }
    });
  }

  // Export methods
  exportToExcel(): void {
    const dataForExport = this.filteredCalls.map(call => ({
      'Customer Name': call.customerName,
      'Business Name': call.businessName || '',
      'Mobile': call.mobile,
      'Last Transaction': call.lastTransactionDate ? 
        new Date(call.lastTransactionDate).toLocaleDateString() : 'None',
      'Assigned To': call.assignedTo || 'Not Assigned',
      'Department': call.department || 'Not assigned',
      'Status': call.callStatus || 'Pending',
      'Notes': call.notes || ''
    }));

    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(dataForExport);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'SalesCalls');
    
    const fileName = `SalesCalls_${new Date().toISOString().slice(0,10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }

  printTable(): void {
    const printContent = document.querySelector('.sales-call-table')?.outerHTML;
    
    if (!printContent) {
      console.error('Table not found for printing');
      return;
    }
  
    const printWindow = window.open('', '_blank');
    
    if (!printWindow) {
      alert('Pop-up blocker might be preventing the print window. Please allow pop-ups for this site.');
      return;
    }
  
    printWindow.document.write(`
      <html>
        <head>
          <title>Sales Calls Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #333; text-align: center; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .status-pending { color: #ff9800; }
            .status-completed { color: #4caf50; }
            .status-follow-up { color: #2196f3; }
            .status-not-interested { color: #f44336; }
          </style>
        </head>
        <body>
          <h1>Sales Calls Report</h1>
          <p>Generated on: ${new Date().toLocaleString()}</p>
          ${printContent}
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.close();
              }, 100);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }
}