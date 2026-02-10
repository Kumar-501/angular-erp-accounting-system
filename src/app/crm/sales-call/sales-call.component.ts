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
      this.loadUsersForFilter(); // <-- ADD THIS LINE

  }

  ngOnDestroy(): void {
    if (this.callsSubscription) {
      this.callsSubscription.unsubscribe();
    }
  }

  loadSalesCalls(): void {
    this.callsSubscription = this.salesCallService.getSalesCalls().subscribe({
      next: (calls) => {
        const currentUser = this.authService.currentUserValue;
        let finalCalls = calls;

        // If the user is not an admin, filter the calls by their department
        if (currentUser && currentUser.role?.toLowerCase() !== 'admin') {
          if (currentUser.department) {
            finalCalls = calls.filter(call => call.department === currentUser.department);
          } else {
            // If a non-admin user has no department assigned, show an empty list
            finalCalls = [];
          }
        }
        // Admins will see all calls as `finalCalls` remains unfiltered

        console.log(`Loaded ${calls.length} total calls, displaying ${finalCalls.length} for the current user.`);

        this.salesCalls = finalCalls;
        this.filteredCalls = [...finalCalls];
        this.totalItems = finalCalls.length;
        this.calculateTotalPages();
        this.applyFilters(); // Re-apply any UI filters
      },
      error: (err) => {
        console.error('Error loading sales calls:', err);
        alert('Failed to load sales calls. Please refresh the page.');
      }
    });
  }

  async updateIndividualCallStatus(customerId: string, newStatus: string): Promise<void> {
    if (!customerId || !newStatus) {
      console.warn('Invalid customerId or status');
      return;
    }

    if (this.isUpdatingStatus.has(customerId)) {
      return;
    }

    this.isUpdatingStatus.add(customerId);
    
    try {
      const callIndex = this.salesCalls.findIndex(c => c.customerId === customerId);
      if (callIndex === -1) return;
      
      await this.salesCallService.updateSalesCall(customerId, {
        callStatus: newStatus,
        statusUpdatedAt: new Date()
      });
      
      this.updateLocalCallStatus(customerId, newStatus);
      
      const currentUserId = await this.getCurrentUserId();
      await this.callLogService.addCallLog(customerId, {
        subject: `Status changed to ${newStatus}`,
        description: `Status manually changed to ${newStatus}`,
        callOutcome: this.mapStatusToCallOutcome(newStatus),
        createdAt: Timestamp.now(),
        createdBy: currentUserId,
        isStatusUpdate: true
      });
    } catch (error) {
      console.error('Error updating status for customer:', customerId, error);
      const originalCall = this.salesCalls.find(call => call.customerId === customerId);
      if (originalCall) {
        originalCall.callStatus = originalCall.callStatus || 'Pending';
      }
      alert('Failed to update status. Please try again.');
    } finally {
      this.isUpdatingStatus.delete(customerId);
    }
  }

  private updateLocalCallStatus(customerId: string, newStatus: string): void {
    const salesCallIndex = this.salesCalls.findIndex(call => call.customerId === customerId);
    if (salesCallIndex >= 0) {
      this.salesCalls[salesCallIndex].callStatus = newStatus;
      this.salesCalls[salesCallIndex].statusUpdatedAt = new Date();
    }
    
    const filteredCallIndex = this.filteredCalls.findIndex(call => call.customerId === customerId);
    if (filteredCallIndex >= 0) {
      this.filteredCalls[filteredCallIndex].callStatus = newStatus;
      this.filteredCalls[filteredCallIndex].statusUpdatedAt = new Date();
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

  trackByFn(index: number, item: any): any {
    return item.customerId || index;
  }

  getVisibleColumnCount(): number {
    return this.visibleColumns.length;
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

  async bulkUpdateStatus(newStatus: string): Promise<void> {
    if (!newStatus || this.selectedCalls.length === 0) return;

    this.selectedCalls.forEach(id => this.isUpdatingStatus.add(id));
    
    try {
      const currentUserId = await this.getCurrentUserId();
      const updates = this.selectedCalls.map(customerId => ({
        id: customerId,
        data: { 
          callStatus: newStatus,
          statusUpdatedAt: new Date()
        }
      }));

      const result = await this.salesCallService.bulkUpdateCalls(updates);
      const successfulIds = updates
        .map(update => update.id)
        .filter(id => !result.failures.find(f => f.id === id));
      
      for (const customerId of successfulIds) {
        this.updateLocalCallStatus(customerId, newStatus);
        await this.callLogService.addCallLog(customerId, {
          subject: `Status changed to ${newStatus}`,
          description: `Status bulk updated to ${newStatus}`,
          callOutcome: this.mapStatusToCallOutcome(newStatus),
          createdAt: Timestamp.now(),
          createdBy: currentUserId,
          isStatusUpdate: true
        });
      }
      
      this.clearSelection();

      if (result.failures.length > 0) {
        alert(`Updated ${result.success} calls successfully. Failed to update ${result.failures.length} calls.`);
      }
    } catch (error) {
      console.error('Bulk update failed:', error);
      alert('Failed to update status for some calls. Please try again.');
    } finally {
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
      
      const updateLocal = (call: any) => 
        this.selectedCalls.includes(call.customerId) 
          ? { ...call, assignedTo: userName, assignedToId: userId, department: user.department } 
          : call;

      this.salesCalls = this.salesCalls.map(updateLocal);
      this.filteredCalls = this.filteredCalls.map(updateLocal);
      
      this.clearSelection();
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
loadUsersForFilter(): void {
  this.userService.getUsers().pipe(take(1)).subscribe({
    next: (users) => {
      // You can filter for specific roles if needed, e.g., only show sales executives
      this.availableUsers = users.filter(user => 
        user.role === 'Executive' || user.role === 'Sales' || user.role === 'Admin'
      );
      console.log('Loaded users for filter dropdown:', this.availableUsers);
    },
    error: (err) => {
      console.error('Error loading users for filter:', err);
    }
  });
}

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
  }

  resetColumnVisibility(): void {
    this.visibleColumns = this.allColumns.map(c => c.key);
  }

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
      filtered = filtered.filter(call => call.callDate && new Date(call.callDate) >= startDate);
    }
    if (this.filters.endDate) {
      const endDate = new Date(this.filters.endDate);
      filtered = filtered.filter(call => call.callDate && new Date(call.callDate) <= endDate);
    }

    this.filteredCalls = filtered;
    this.totalItems = filtered.length;
    this.currentPage = 1;
    this.calculateTotalPages();
    this.showFilterSidebar = false;
  }

  resetAdvancedFilters(): void {
    this.filters = { status: '', assignedTo: '', startDate: '', endDate: '', transactionType: '', callOutcome: '' };
    this.applyFilters();
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

  toggleCallSelection(callId: string): void {
    const index = this.selectedCalls.indexOf(callId);
    if (index === -1) {
      this.selectedCalls.push(callId);
    } else {
      this.selectedCalls.splice(index, 1);
    }
    this.selectAll = this.selectedCalls.length > 0 && this.selectedCalls.length === this.paginatedCalls.length;
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
    // This is a simplified pagination display logic, can be enhanced
    for (let i = 1; i <= this.totalPages; i++) {
      pages.push(i);
    }
    return pages;
  }
  
  onItemsPerPageChange(): void {
    this.currentPage = 1;
    this.calculateTotalPages();
  }

  viewCustomerDetails(customerId: string): void {
    this.router.navigate(['/crm/customers/view', customerId]);
  }

  addNewCallLog(customerId: string): void {
    this.router.navigate(['/crm/calls/new'], { queryParams: { customerId } });
  }

  exportToExcel(): void {
    const dataForExport = this.filteredCalls.map(call => ({
      'Customer Name': call.customerName,
      'Business Name': call.businessName || '',
      'Mobile': call.mobile,
      'Last Transaction': call.lastTransactionDate ? new Date(call.lastTransactionDate).toLocaleDateString() : 'None',
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
    if (!printContent) return;
  
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
  
    printWindow.document.write(`
      <html>
        <head>
          <title>Sales Calls Report</title>
          <style>
            body { font-family: Arial, sans-serif; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
          </style>
        </head>
        <body>
          <h1>Sales Calls Report</h1>
          ${printContent}
          <script>
            window.onload = function() {
              window.print();
              window.close();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }
}