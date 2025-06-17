import { Component, OnInit, OnDestroy } from '@angular/core';
import { FollowUpService } from '../../services/follow-up.service';
import { LeadService } from '../../services/leads.service';
import { UserService } from '../../services/user.service';
import { FollowupCategoryService } from '../../services/followup-category.service';
import { FollowUp } from '../../models/follow-up.model';
import { Subscription } from 'rxjs';
import { Router } from '@angular/router';

interface LeadContact {
  id: string;
  contactId: string;
  firstName?: string;
  lastName?: string;
  businessName?: string;
  email?: string;
}

@Component({
  selector: 'app-follows-up',
  templateUrl: './follows-up.component.html',
  styleUrls: ['./follows-up.component.scss']
})
export class FollowsUpComponent implements OnInit, OnDestroy {
  title = 'All Follow ups';
  entriesPerPage = 25;
  currentPage = 1;
  totalEntries = 0;
  sortColumnName: string = 'createdAt';
sortDirection: 'asc' | 'desc' = 'desc';

  totalPages = 1;
  showColumnVisibilityOptions = false;
  showAddForm = false;
  showAdvancedForm = false;
  // Add these properties
showFilterSidebar = false;
// Add these properties
filters = {
  status: '',
  followUpType: '',
  assignedTo: '',
  dateRange: 'all',
  startDate: '',
  endDate: '',
  searchText: ''
};
defaultFilters = {
  status: '',
  followUpType: '',
  assignedTo: '',
  dateRange: 'all',
  startDate: null,
  endDate: null,
  searchText: ''
};


// Add these properties
searchText: string = '';
originalFollowUps: FollowUp[] = []; // To store the original unfiltered data
  showPopupModal = false;
  showAddLogForm = false;
  isLoading = false;
  activeDropdown: string | null = null;
  editingFollowUpId: string | null = null;
  
  completedFollowUpsCount = 0;
  
  public Math = Math;

  newFollowUp: FollowUp = {
    title: '',
    status: '',
    description: '',
    customerLead: '',
    startDatetime: '',
    endDatetime: '',
    followUpType: '',
    followupCategory: '',
    assignedTo: '',
    additionalInfo: '',
    addedBy: '',
    sendNotification: false
  };

  newFollowUpLog = {
    subject: '',
    logType: 'Call',
    startDatetime: '',
    endDatetime: '',
    description: '',
    status: 'Scheduled',
    customerLead: '',
    assignedTo: ''
  };
  

  statusOptions = ['Open', 'Pending', 'In Progress', 'Completed', 'Cancelled', 'Call'];
  followUpTypeOptions = ['Call', 'Email', 'Meeting', 'Task'];
  followupCategoryOptions: string[] = [];
  logStatusOptions = ['Scheduled', 'Completed', 'Cancelled', 'Pending'];

  followUps: FollowUp[] = [];
  paginatedFollowUps: FollowUp[] = [];
  leadsList: LeadContact[] = [];
  usersList: any[] = [];

  openFollowUpsCount = 0;
  callFollowUpsCount = 0;
  columns = [
    { name: 'Action', visible: true },
    { name: 'Contact ID', visible: true },
    { name: 'Start Datetime', visible: true },
    { name: 'End Datetime', visible: true },
    { name: 'Status', visible: true },
    { name: 'Follow Up Type', visible: true },
    { name: 'Followup Category', visible: true },
    { name: 'Assigned to', visible: true },
    { name: 'Description', visible: true },
    { name: 'Additional info', visible: true },
    { name: 'Title', visible: true },
    { name: 'Added by', visible: true },
    { name: 'Added On', visible: true }
  ]
  private followUpsSubscription: Subscription | undefined;
  private leadsSubscription: Subscription | undefined;
  private usersSubscription: Subscription | undefined;
  private followupCategoriesSubscription: Subscription | undefined;

  constructor(
    private followUpService: FollowUpService,
    private leadService: LeadService,
    private userService: UserService,
    private followupCategoryService: FollowupCategoryService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadFollowUps();
    this.loadLeads();
    this.loadUsers();
    this.loadFollowupCategories();
    document.addEventListener('click', this.closeDropdowns.bind(this));
  }
  ngOnDestroy(): void {
    this.cleanupSubscriptions();
    document.removeEventListener('click', this.closeDropdowns.bind(this));
  }
  getContactDisplay(customerLeadId: string): string {
    if (!customerLeadId) return '-';
    
    const lead = this.leadsList.find(l => l.id === customerLeadId);
    
    if (lead) {
      // First priority: show contactId if available (this is what we want to display)
      if (lead.contactId) return lead.contactId;
      
      // Second priority: business name
      if (lead.businessName) return lead.businessName;
      
      // Third priority: full name if available
      if (lead.firstName || lead.lastName) {
        return `${lead.firstName || ''} ${lead.lastName || ''}`.trim();
      }
      
      // This line keeps backward compatibility with your existing code
      return lead.contactId || lead.businessName || `${lead.firstName || ''} ${lead.lastName || ''}`.trim();
    }
    
    // Keep existing functionality for handling IDs when no lead is found
    // But add a prefix to make it clear it's an ID
    if (/^[A-Za-z0-9]+$/.test(customerLeadId)) {
      return `ID: ${customerLeadId}`;
    }
    
    // Keep existing truncation logic but add prefix
    return customerLeadId.length > 8 
      ? `ID: ${customerLeadId.substring(0, 4)}...${customerLeadId.substring(customerLeadId.length - 4)}`
      : `ID: ${customerLeadId}`;
  }

  getUserName(userId: string): string {
    if (!userId) return '-';
    const user = this.usersList.find(u => u.id === userId);
    return user ? user.name : userId;
  }
// Add these methods
toggleFilterSidebar(): void {
  this.showFilterSidebar = !this.showFilterSidebar;
}
applyFilters(): void {
  let filtered = [...this.followUps];

  // Apply status filter
  if (this.filters.status) {
    filtered = filtered.filter(f => f.status === this.filters.status);
  }

  // Apply type filter
  if (this.filters.followUpType) {
    filtered = filtered.filter(f => f.followUpType === this.filters.followUpType);
  }

  // Apply assigned to filter
  if (this.filters.assignedTo) {
    filtered = filtered.filter(f => f.assignedTo === this.filters.assignedTo);
  }

  // Apply date range filter
  if (this.filters.dateRange !== 'all') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (this.filters.dateRange) {
      case 'today':
        filtered = filtered.filter(f => {
          const date = new Date(f.startDatetime);
          return date.toDateString() === today.toDateString();
        });
        break;
      case 'tomorrow':
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        filtered = filtered.filter(f => {
          const date = new Date(f.startDatetime);
          return date.toDateString() === tomorrow.toDateString();
        });
        break;
      case 'thisWeek':
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        const endOfWeek = new Date(today);
        endOfWeek.setDate(today.getDate() + (6 - today.getDay()));
        filtered = filtered.filter(f => {
          const date = new Date(f.startDatetime);
          return date >= startOfWeek && date <= endOfWeek;
        });
        break;
      case 'nextWeek':
        const nextWeekStart = new Date(today);
        nextWeekStart.setDate(today.getDate() + (7 - today.getDay()));
        const nextWeekEnd = new Date(nextWeekStart);
        nextWeekEnd.setDate(nextWeekStart.getDate() + 6);
        filtered = filtered.filter(f => {
          const date = new Date(f.startDatetime);
          return date >= nextWeekStart && date <= nextWeekEnd;
        });
        break;
      case 'thisMonth':
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        filtered = filtered.filter(f => {
          const date = new Date(f.startDatetime);
          return date >= startOfMonth && date <= endOfMonth;
        });
        break;
      case 'custom':
        if (this.filters.startDate && this.filters.endDate) {
          const startDate = new Date(this.filters.startDate);
          const endDate = new Date(this.filters.endDate);
          endDate.setHours(23, 59, 59, 999);
          filtered = filtered.filter(f => {
            const date = new Date(f.startDatetime);
            return date >= startDate && date <= endDate;
          });
        }
        break;
    }
  }

  // Apply search text filter
  if (this.filters.searchText) {
    const searchText = this.filters.searchText.toLowerCase();
    filtered = filtered.filter(f => 
      (f.title && f.title.toLowerCase().includes(searchText)) ||
      (f.description && f.description.toLowerCase().includes(searchText))
    );
  }

  this.followUps = filtered;
  this.totalEntries = filtered.length;
  this.updateStatusCounts();
  this.updatePagination();
}
applySearch(): void {
  if (!this.searchText) {
    // If search text is empty, reset to original data
    this.followUps = [...this.originalFollowUps];
  } else {
    const searchTerm = this.searchText.toLowerCase();
    this.followUps = this.originalFollowUps.filter(followUp => {
      return (
        (followUp.title && followUp.title.toLowerCase().includes(searchTerm)) ||
        (followUp.description && followUp.description.toLowerCase().includes(searchTerm)) ||
        (followUp.additionalInfo && followUp.additionalInfo.toLowerCase().includes(searchTerm)) ||
        (this.getContactDisplay(followUp.customerLead).toLowerCase().includes(searchTerm)) ||
        (this.getUserName(followUp.assignedTo).toLowerCase().includes(searchTerm))
      );
    });
  }
  
  this.totalEntries = this.followUps.length;
  this.updateStatusCounts();
  this.updatePagination();
}
resetFilters(): void {
  // Reset filters to default values
  this.filters = {
    status: '',
    followUpType: '',
    assignedTo: '',
    dateRange: 'all',
    startDate: '',
    endDate: '',
    searchText: ''
  };
  
  // Reload the original follow-ups data
  this.loadFollowUps();
  
  // Close the filter sidebar if needed
  this.showFilterSidebar = false;
}
  loadFollowupCategories(): void {
    this.followupCategoryService.getFollowupCategories()
      .then((categories: any[]) => {
        this.followupCategoryOptions = categories.map((category: any) => category.name);
      })
      .catch((err: any) => {
        console.error('Error loading followup categories:', err);
      });
  }
  sortColumn(columnName: string): void {
    if (this.sortColumnName === columnName) {
      // Reverse the sort direction if clicking the same column
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      // Default to ascending sort for new column
      this.sortColumnName = columnName;
      this.sortDirection = 'asc';
    }
    
    this.sortFollowUps();
  }
  onDateRangeChange(): void {
    if (this.filters.dateRange !== 'custom') {
      this.filters.startDate = '';
      this.filters.endDate = '';
    }
  }
  
  sortFollowUps(): void {
    this.followUps.sort((a, b) => {
      const aValue = this.getSortableValue(a, this.sortColumnName);
      const bValue = this.getSortableValue(b, this.sortColumnName);
  
      if (aValue === bValue) return 0;
      
      if (this.sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  
    this.updatePagination();
  }
  
  getSortableValue(item: any, columnName: string): any {
    switch (columnName) {
      case 'customerLead':
        return this.getContactDisplay(item.customerLead).toLowerCase();
      case 'assignedTo':
        return this.getUserName(item.assignedTo).toLowerCase();
      case 'addedBy':
        return this.getUserName(item.addedBy).toLowerCase();
      case 'startDatetime':
      case 'endDatetime':
      case 'createdAt':
        return new Date(item[columnName]).getTime();
      default:
        return item[columnName] ? item[columnName].toString().toLowerCase() : '';
    }
  }
  loadFollowUps(): void {
    this.isLoading = true;
    this.followUpsSubscription = this.followUpService.followUps$.subscribe({
      next: (data) => {
        this.followUps = data;
        this.totalEntries = data.length;
        this.updateStatusCounts();
        this.updatePagination();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading follow-ups:', err);
        this.isLoading = false;
      }
    });
  }

  loadLeads(): void {
    this.leadsSubscription = this.leadService.getLeads().subscribe({
      next: (leads) => {
        this.leadsList = leads
          .filter(lead => lead.id !== undefined)
          .map(lead => {
            console.log(`Lead loaded - ID: ${lead.id}, ContactID: ${lead.contactId}`); // Debug log
            return {
              id: lead.id!,
              contactId: lead.contactId || '',
              firstName: lead.firstName,
              lastName: lead.lastName,
              businessName: lead.businessName,
              email: lead.email
            };
          });
        console.log(`Total leads loaded: ${this.leadsList.length}`); // Debug total count
      },
      error: (err) => {
        console.error('Error loading leads:', err);
      }
    });
  }

  private extractContactId(lead: any): string {
    return lead.contactId || 
           lead.contact?.id || 
           lead.contactDetails?.contactId ||
           lead.contactNumber ||
           '';
  }
  loadUsers(): void {
    this.usersSubscription = this.userService.getUsers().subscribe({
      next: (users) => {
        this.usersList = users.map(user => ({
          id: user.id,
          name: user.name || `${user.firstName} ${user.lastName}`.trim()
        }));
      },
      error: (err) => {
        console.error('Error loading users:', err);
      }
    });
  }


  updateStatusCounts(): void {
    this.openFollowUpsCount = this.followUps.filter(f => f.status === 'Open').length;
    this.callFollowUpsCount = this.followUps.filter(f => f.status === 'Call').length;
    this.completedFollowUpsCount = this.followUps.filter(f => f.status === 'Completed').length;
  }

  updatePagination(): void {
    this.totalPages = Math.ceil(this.totalEntries / this.entriesPerPage);
    this.paginateFollowUps();
  }

  paginateFollowUps(): void {
    const startIndex = (this.currentPage - 1) * this.entriesPerPage;
    const endIndex = Math.min(startIndex + this.entriesPerPage, this.totalEntries);
    this.paginatedFollowUps = this.followUps.slice(startIndex, endIndex);
  }

  onPageSizeChange(): void {
    this.currentPage = 1;
    this.updatePagination();
  }

  getPages(): number[] {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (this.totalPages <= maxVisiblePages) {
      for (let i = 1; i <= this.totalPages; i++) {
        pages.push(i);
      }
    } else {
      let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
      let endPage = startPage + maxVisiblePages - 1;
      
      if (endPage > this.totalPages) {
        endPage = this.totalPages;
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
      }
      
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
    }
    
    return pages;
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.paginateFollowUps();
    }
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.paginateFollowUps();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.paginateFollowUps();
    }
  }

  toggleDropdown(event: Event, id: string = ''): void {
    event.preventDefault();
    event.stopPropagation();
    this.activeDropdown = id;
  }

  closeDropdowns(): void {
    this.activeDropdown = null;
  }

  addNewFollowUp(): void {
    this.editingFollowUpId = null;
    this.resetForm();
    this.showAddForm = true;
  }

  editFollowUp(followUp: FollowUp): void {
    this.editingFollowUpId = followUp.id || null;
    this.newFollowUp = { ...followUp };
    this.showAddForm = true;
    this.closeDropdowns();
  }

  deleteFollowUp(id?: string): void {
    if (!id) return;
    
    if (confirm('Are you sure you want to delete this follow-up?')) {
      this.isLoading = true;
      this.followUpService.deleteFollowUp(id)
        .then(() => {
          this.isLoading = false;
          this.closeDropdowns();
        })
        .catch(error => {
          console.error('Error deleting follow-up:', error);
          this.isLoading = false;
        });
    }
  }

  viewFollowUpDetails(followUp: FollowUp): void {
    console.log('Viewing follow up details:', followUp);
    this.closeDropdowns();
  }

  convertToTask(followUp: FollowUp): void {
    if (confirm('Convert this follow up to a task?')) {
      this.isLoading = true;
      // Implementation depends on your task service
      this.isLoading = false;
      this.closeDropdowns();
    }
  }

  openAddLogFormWithItem(item: any): void {
    this.newFollowUpLog = {
      subject: `Follow up for ${item.title || 'item'}`,
      logType: 'Call',
      startDatetime: new Date().toISOString(),
      endDatetime: new Date(new Date().getTime() + 30 * 60000).toISOString(),
      description: '',
      status: 'Scheduled',
      customerLead: item.customerLead || '',
      assignedTo: item.assignedTo || ''
    };
    this.showAddLogForm = true;
    this.closeDropdowns();
  }

  onSubmit(): void {
    if (!this.validateFollowUpForm()) {
      alert('Please fill all required fields');
      return;
    }

    this.isLoading = true;
    
    if (this.editingFollowUpId) {
      this.followUpService.updateFollowUp(this.editingFollowUpId, this.newFollowUp)
        .then(() => {
          this.closeForm();
          this.isLoading = false;
        })
        .catch(error => {
          console.error('Error updating follow-up:', error);
          this.isLoading = false;
        });
    } else {
      this.followUpService.addFollowUp(this.newFollowUp)
        .then(() => {
          this.closeForm();
          this.isLoading = false;
        })
        .catch(error => {
          console.error('Error adding follow-up:', error);
          this.isLoading = false;
        });
    }
  }

  onSubmitLog(): void {
    if (!this.validateLogForm()) {
      alert('Please fill all required fields');
      return;
    }

    this.isLoading = true;
    
    const followUpFromLog: FollowUp = {
      title: this.newFollowUpLog.subject,
      status: this.newFollowUpLog.status,
      description: this.newFollowUpLog.description,
      customerLead: this.newFollowUpLog.customerLead,
      startDatetime: this.newFollowUpLog.startDatetime,
      endDatetime: this.newFollowUpLog.endDatetime,
      followUpType: this.newFollowUpLog.logType,
      followupCategory: 'General',
      assignedTo: this.newFollowUpLog.assignedTo,
      additionalInfo: 'Created from follow up log',
      addedBy: this.getCurrentUserId(),
      sendNotification: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.followUpService.addFollowUp(followUpFromLog)
      .then(() => {
        this.closeLogForm();
        this.isLoading = false;
      })
      .catch(error => {
        console.error('Error adding follow-up log:', error);
        this.isLoading = false;
      });
  }

  validateFollowUpForm(): boolean {
    return !!this.newFollowUp.title && 
           !!this.newFollowUp.customerLead && 
           !!this.newFollowUp.assignedTo && 
           !!this.newFollowUp.startDatetime && 
           !!this.newFollowUp.endDatetime;
  }

  validateLogForm(): boolean {
    return !!this.newFollowUpLog.subject && 
           !!this.newFollowUpLog.customerLead && 
           !!this.newFollowUpLog.assignedTo && 
           !!this.newFollowUpLog.startDatetime && 
           !!this.newFollowUpLog.endDatetime;
  }

  getCurrentUserId(): string {
    // Implement based on your authentication service
    return 'current-user-id';
  }

  resetForm(): void {
    this.newFollowUp = {
      title: '',
      status: '',
      description: '',
      customerLead: '',
      startDatetime: '',
      endDatetime: '',
      followUpType: '',
      followupCategory: '',
      assignedTo: '',
      additionalInfo: '',
      addedBy: '',
      sendNotification: false
    };
    this.editingFollowUpId = null;
  }

  resetLogForm(): void {
    this.newFollowUpLog = {
      subject: '',
      logType: 'Call',
      startDatetime: '',
      endDatetime: '',
      description: '',
      status: 'Scheduled',
      customerLead: '',
      assignedTo: ''
    };
  }

  closeForm(): void {
    this.showAddForm = false;
    this.resetForm();
  }

  closeLogForm(): void {
    this.showAddLogForm = false;
    this.resetLogForm();
  }

  openRecurringFollowUpPopup(): void {
    this.showPopupModal = true;
  }
  
  closePopupModal(): void {
    this.showPopupModal = false;
  }

  addAdvancedFollowUp(): void {
    this.showAdvancedForm = true;
  }

  addRecurringFollowUp(): void {
    this.closePopupModal();
    this.addAdvancedFollowUp();
  }

  closeAdvancedForm(): void {
    this.showAdvancedForm = false;
  }

  addOneTimeFollowUp(): void {
    this.closePopupModal();
    this.router.navigate(['/crm/create']);
  }

  onColumnVisibilityChange(): void {
    // Any additional logic when column visibility changes
  }

  get visibleColumnsCount(): number {
    return this.columns.filter(c => c.visible).length;
  }

  toggleColumnVisibility(): void {
    this.showColumnVisibilityOptions = !this.showColumnVisibilityOptions;
  }

  private cleanupSubscriptions(): void {
    if (this.followUpsSubscription) this.followUpsSubscription.unsubscribe();
    if (this.leadsSubscription) this.leadsSubscription.unsubscribe();
    if (this.usersSubscription) this.usersSubscription.unsubscribe();
    if (this.followupCategoriesSubscription) this.followupCategoriesSubscription.unsubscribe();
  }

  exportToCSV(): void {
    console.log('Exporting to CSV');
  }

  exportToExcel(): void {
    console.log('Exporting to Excel');
  }

  exportToPDF(): void {
    console.log('Exporting to PDF');
  }

  printTable(): void {
    console.log('Printing table');
  }
}