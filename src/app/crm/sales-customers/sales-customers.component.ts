import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CustomerService } from '../../services/customer.service';
import { Customer } from '../../models/customer.model';
import { UserService } from '../../services/user.service';
import { DatePipe } from '@angular/common';
import { debounceTime, distinctUntilChanged, Subject, forkJoin } from 'rxjs';
import * as XLSX from 'xlsx';
import { SalesCallService } from '../../services/sales-call.service';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { AuthService } from '../../auth.service';


@Component({
  selector: 'app-sales-customers',
  templateUrl: './sales-customers.component.html',
  styleUrls: ['./sales-customers.component.scss'],
  providers: [DatePipe]
})
  
  
  
export class SalesCustomersComponent implements OnInit {
hasRole(role: string): boolean {
  return this.authService.hasRole(role);
}
 customersList: Customer[] = [];
  filteredCustomers: Customer[] = [];
  paginatedCustomers: Customer[] = [];
  showEditModal = false;
  editForm!: FormGroup;
  customerToEdit: Customer | null = null;
  isLoadingUsers = false;
  isUpdating = false;
  showColumnVisibilityPanel = false;



columnDefinitions = [
    { field: 'checkbox', header: 'Select', visible: true },
    { field: 'firstName', header: 'Customer Name', visible: true },
    { field: 'mobile', header: 'Mobile Number', visible: true },
    { field: 'alternateContact', header: 'Alternate Number', visible: true },
    { field: 'adcode', header: 'Ad Code', visible: true },
    { field: 'assignedTo', header: 'Assigned To', visible: true },
    { field: 'lifeStage', header: 'Life Stage', visible: true },
    { field: 'department', header: 'Department', visible: true },
    { field: 'leadCategory', header: 'Lead Category', visible: true },
    { field: 'lastCallTime', header: 'Last Call Time', visible: true },
    { field: 'currentState', header: 'Current State', visible: true },
    { field: 'status', header: 'Status', visible: true },
    { field: 'callCount', header: 'Call Count', visible: true },
    { field: 'actions', header: 'Actions', visible: true },
  ];

  allCustomersSelected = false;
  showFilters = false;

  filterStatus = '';
  filterAssignStatus = '';
  filterCurrentState = '';
  filterLifeStage = '';
  filterAssignedTo = '';
  departmentUsers: any[] = [];

  filterDepartment = '';
  filterLeadCategory = '';
  filterDateFrom: string | null = null;
  filterDateTo: string | null = null;
  filterCallCountMin: number | null = null;
  filterCallCountMax: number | null = null;
  
  // Modals
  showDepartmentModal = false;
  showLifeStageModal = false;
  showLeadCategoryModal = false;
  showAssignUserModal = false;
  showPc1AssignModal = false;
  
  // Bulk actions
  isBulkAssign = false;
  isBulkDepartment = false;
  isBulkPc1Assign = false;
  
  // Selected items
  selectedCustomers: string[] = [];
  selectedCustomer: Customer | null = null;
  selectedCustomerForDept: Customer | null = null;
  selectedCustomerForLifeStage: Customer | null = null;
  selectedCustomerForLeadCategory: Customer | null = null;
  
  availableStates: string[] = ['Active', 'Inactive', 'Pending'];
  availableDepartments: string[] = ['PC1', 'PC2', 'PC3', 'PC4', 'PC5', 'PC6', 'PC7', 'PC8'];
  availableLifeStages: string[] = ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiation', 'Closed Won', 'Closed Lost'];
  availableLeadCategories: string[] = ['Diabetes', 'Cholestrol', 'Blood Pressure', 'Digestion', 'Kshara Karma', 'SkinDisease'];
  
  availableUsers: any[] = [];
  pc1Users: any[] = []; // Users under PC1 department
  
  // Selected values
  selectedDepartment = '';
  selectedLifeStage = '';
  selectedLeadCategory = '';
  selectedUserId = '';
  selectedPc1UserId = '';
  
  // Pagination
  currentPage = 1;
  entriesPerPage = 10;
  totalPages = 1;
  
  // Sorting
  sortColumn = 'firstName';
  sortDirection = 'asc';
  
  // Search
  searchTerm = '';
  private searchSubject = new Subject<string>();





  constructor(
    private customerService: CustomerService,
    private userService: UserService,
    private authService: AuthService,
    private datePipe: DatePipe,
    private router: Router,
    private salesCallService: SalesCallService, // Add this
    private formBuilder: FormBuilder // Added FormBuilder
  ) { }

  ngOnInit(): void {
    // Initialize form first
    this.initEditForm();
    
    // Load data
    this.loadCustomers();
    this.loadAvailableUsers();

    // Setup search debouncing
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(() => {
      this.applyFilters();
    });
    
    // Load saved column visibility
    const savedVisibility = localStorage.getItem('columnVisibility');
    if (savedVisibility) {
      this.columnDefinitions = JSON.parse(savedVisibility);
    }
  }
  
  getVisibleColumnsCount(): number {
    return this.columnDefinitions.filter(c => c.visible).length;
  }
  
  applyFiltersDebounced(): void {
    this.searchSubject.next(this.searchTerm);
  }

  // Initialize the edit form with all necessary fields
  initEditForm(): void {
    this.editForm = this.formBuilder.group({
      prefix: [''],
      firstName: ['', Validators.required],
      middleName: [''],
      lastName: ['', Validators.required],
      mobile: ['', [Validators.required, Validators.pattern('[0-9]{10}')]],
      alternateContact: [''],
      adcode: [''],
      businessName: [''],
      isIndividual: [true],
      status: ['Active', Validators.required]
    });
  }

loadAvailableUsers(): void {
  this.isLoadingUsers = true;
  this.userService.getUsers().subscribe({
    next: (users) => {
      this.availableUsers = users.map(user => ({
        id: user.id,
        name: `${user.firstName} ${user.lastName}`.trim() || user.username,
        department: user.department || ''
      }));
      this.isLoadingUsers = false;
    },
    error: (err) => {
      console.error('Failed to load users', err);
      this.isLoadingUsers = false;
    }
  });
}
onDepartmentChange(): void {
  if (this.selectedDepartment) {
    // Filter users by selected department
    this.departmentUsers = this.availableUsers.filter(user => 
      user.department === this.selectedDepartment
    );
    this.selectedUserId = ''; // Reset user selection when department changes
  } else {
    this.departmentUsers = [];
    this.selectedUserId = '';
  }
}
  closeEditModal(): void {
    this.showEditModal = false;
    this.customerToEdit = null;
    this.editForm.reset();
  }

  onEditSubmit(): void {
    if (this.editForm.invalid || !this.customerToEdit?.id) return;
    
    this.isUpdating = true;
    const updatedData = this.editForm.value;
    
    this.customerService.updateCustomer(this.customerToEdit.id, updatedData)
      .then(() => {
        this.closeEditModal();
        this.loadCustomers();
        this.isUpdating = false;
        alert('Customer updated successfully');
      })
      .catch((error: any) => {
        console.error('Failed to update customer:', error);
        this.isUpdating = false;
        alert('Failed to update customer. Please try again.');
      });
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
    if (this.showFilters) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
  }
  
  resetFilters(): void {
    this.filterStatus = '';
    this.filterAssignStatus = '';
    this.filterCurrentState = '';
    this.filterLifeStage = '';
    this.filterAssignedTo = '';
    this.filterDepartment = '';
    this.filterLeadCategory = '';
    this.filterDateFrom = null;
    this.filterDateTo = null;
    this.filterCallCountMin = null;
    this.filterCallCountMax = null;
    this.applyFilters();
  }

  applyFilters(): void {
    let filtered = [...this.customersList];
    
    // Apply search filter
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase().trim();
      filtered = filtered.filter(customer => {
        const fieldsToSearch = [
          customer.firstName,
          customer.lastName,
          customer.middleName,
          customer.businessName,
          customer.mobile,
          customer.alternateContact, // Added alternate contact number for search
          customer.assignedTo,
          customer.lifeStage,
          customer.department,
          customer.leadCategory,
          customer.currentState,
          customer.status,
          customer.prefix,
          customer.id,
          customer.adcode // Also added adcode for search
        ];

        return fieldsToSearch.some(
          field => field && field.toString().toLowerCase().includes(term)
        );
      });
    }
    
    // Apply individual filters
    if (this.filterStatus) {
      filtered = filtered.filter(customer => customer.status === this.filterStatus);
    }
    
    if (this.filterAssignStatus) {
      if (this.filterAssignStatus === 'Assigned') {
        filtered = filtered.filter(customer => customer.assignedTo);
      } else {
        filtered = filtered.filter(customer => !customer.assignedTo);
      }
    }
    
    if (this.filterCurrentState) {
      filtered = filtered.filter(customer => customer.currentState === this.filterCurrentState);
    }
    
    if (this.filterLifeStage) {
      filtered = filtered.filter(customer => customer.lifeStage === this.filterLifeStage);
    }
    
    if (this.filterAssignedTo) {
      filtered = filtered.filter(customer => 
        customer.assignedTo && 
        this.availableUsers.some(user => 
          user.id === this.filterAssignedTo && 
          user.name === customer.assignedTo
        )
      );
    }
    
    if (this.filterDepartment) {
      filtered = filtered.filter(customer => customer.department === this.filterDepartment);
    }
    
    if (this.filterLeadCategory) {
      filtered = filtered.filter(customer => customer.leadCategory === this.filterLeadCategory);
    }
    
    if (this.filterDateFrom) {
      const fromDate = new Date(this.filterDateFrom);
      filtered = filtered.filter(customer => {
        if (!customer.lastCallTime) return false;
        const callDate = new Date(customer.lastCallTime);
        return callDate >= fromDate;
      });
    }
    
    if (this.filterDateTo) {
      const toDate = new Date(this.filterDateTo);
      toDate.setHours(23, 59, 59, 999); // Include entire end day
      filtered = filtered.filter(customer => {
        if (!customer.lastCallTime) return false;
        const callDate = new Date(customer.lastCallTime);
        return callDate <= toDate;
      });
    }
    
    if (this.filterCallCountMin !== null) {
      filtered = filtered.filter(customer => 
        (customer.callCount || 0) >= this.filterCallCountMin!
      );
    }
    
    if (this.filterCallCountMax !== null) {
      filtered = filtered.filter(customer => 
        (customer.callCount || 0) <= this.filterCallCountMax!
      );
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      const valA = this.getSortValue(a, this.sortColumn);
      const valB = this.getSortValue(b, this.sortColumn);
      
      if (valA < valB) return this.sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return this.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    
    this.filteredCustomers = filtered;
    this.totalPages = Math.ceil(this.filteredCustomers.length / this.entriesPerPage);
    this.currentPage = this.totalPages > 0 ? Math.min(this.currentPage, this.totalPages) : 1;
    this.updatePaginatedCustomers();
  }
  
  toggleBulkSelect(): void {
    if (this.selectedCustomers.length === this.filteredCustomers.length) {
      // Deselect all if all are currently selected
      this.selectedCustomers = [];
    } else {
      // Select all filtered customers
      this.selectedCustomers = this.filteredCustomers
        .map(c => c.id)
        .filter((id): id is string => !!id);
    }
  }

  getSortValue(customer: Customer, column: string): any {
    switch (column) {
      case 'lastCallTime':
        return customer.lastCallTime ? new Date(customer.lastCallTime).getTime() : 0;
      case 'callCount':
        return customer.callCount || 0;
      default:
        const value = customer[column as keyof Customer];
        return value === null || value === undefined ? '' : value;
    }
  }
  
  toggleColumnVisibilityPanel(): void {
    this.showColumnVisibilityPanel = !this.showColumnVisibilityPanel;
  }
  
  updateColumnVisibility(): void {
    // Save to localStorage if you want to persist user preferences
    localStorage.setItem('columnVisibility', JSON.stringify(this.columnDefinitions));
  }
  
  resetColumnVisibility(): void {
    this.columnDefinitions = [
      { field: 'checkbox', header: 'Select', visible: true },
      { field: 'firstName', header: 'Customer Name', visible: true },
      { field: 'mobile', header: 'Mobile Number', visible: true },
      { field: 'assignedTo', header: 'Assigned To', visible: true },
      { field: 'lifeStage', header: 'Life Stage', visible: true },
      { field: 'department', header: 'Department', visible: true },
      { field: 'leadCategory', header: 'Lead Category', visible: true },
      { field: 'lastCallTime', header: 'Last Call Time', visible: true },
      { field: 'currentState', header: 'Current State', visible: true },
      { field: 'status', header: 'Status', visible: true },
      { field: 'callCount', header: 'Call Count', visible: true },
      { field: 'actions', header: 'Actions', visible: true }
    ];
    localStorage.removeItem('columnVisibility');
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

  updatePaginatedCustomers(): void {
    const start = (this.currentPage - 1) * this.entriesPerPage;
    const end = start + this.entriesPerPage;
    this.paginatedCustomers = this.filteredCustomers.slice(start, end);
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.applyFilters();
  }

  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePaginatedCustomers();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePaginatedCustomers();
    }
  }

  getPaginationRange(): number[] {
    const range: number[] = [];
    const rangeSize = 3;
    
    let start = Math.max(2, this.currentPage - Math.floor(rangeSize / 2));
    let end = Math.min(this.totalPages - 1, start + rangeSize - 1);
    
    if (end === this.totalPages - 1) {
      start = Math.max(2, end - rangeSize + 1);
    }
    
    for (let i = start; i <= end; i++) {
      range.push(i);
    }
    
    return range;
  }

  // Department Modal Functions
  openDepartmentModal(customer: Customer): void {
    this.isBulkDepartment = false;
    this.selectedCustomerForDept = customer;
    this.selectedDepartment = customer.department || '';
    this.showDepartmentModal = true;
  }

  openBulkDepartmentModal(): void {
    if (this.selectedCustomers.length === 0) return;
    this.isBulkDepartment = true;
    this.selectedCustomerForDept = null;
    this.selectedDepartment = '';
    this.showDepartmentModal = true;
  }

  closeDepartmentModal(): void {
    this.showDepartmentModal = false;
    this.selectedCustomerForDept = null;
    this.selectedDepartment = '';
    this.isBulkDepartment = false;
  }

updateDepartment(): void {
  if (!this.selectedDepartment || !this.selectedUserId || this.isUpdating) return;
  
  const user = this.departmentUsers.find(u => u.id === this.selectedUserId);
  if (!user) return;
  
  this.isUpdating = true;
  
  if (this.isBulkDepartment) {
    const updateObservables = this.selectedCustomers.map(customerId => {
      return this.customerService.updateCustomerObservable(customerId, { 
        department: this.selectedDepartment,
        assignedTo: user.name
      });
    });
    
    forkJoin(updateObservables).subscribe({
      next: (results) => {
        console.log('Bulk department and user update successful', results);
        this.loadCustomers();
        this.selectedCustomers = [];
        this.closeDepartmentModal();
        this.isUpdating = false;
      },
      error: (error) => {
        console.error('Failed to bulk update departments and users:', error);
        this.isUpdating = false;
        alert('Some updates could not be completed. Please try again.');
      }
    });
  } else {
    if (!this.selectedCustomerForDept?.id) {
      this.isUpdating = false;
      return;
    }
    
    this.customerService.updateCustomerObservable(this.selectedCustomerForDept.id, { 
      department: this.selectedDepartment,
      assignedTo: user.name
    }).subscribe({
      next: (result) => {
        console.log('Department and user update successful', result);
        this.loadCustomers();
        this.closeDepartmentModal();
        this.isUpdating = false;
      },
      error: (error) => {
        console.error('Failed to update department and user:', error);
        this.isUpdating = false;
        alert('Update could not be completed. Please try again.');
      }
    });
  }
}


  // Life Stage Modal Functions
  openLifeStageModal(customer: Customer): void {
    this.selectedCustomerForLifeStage = customer;
    this.selectedLifeStage = customer.lifeStage || '';
    this.showLifeStageModal = true;
  }

  closeLifeStageModal(): void {
    this.showLifeStageModal = false;
    this.selectedCustomerForLifeStage = null;
    this.selectedLifeStage = '';
  }

  updateLifeStage(): void {
    if (!this.selectedCustomerForLifeStage?.id || !this.selectedLifeStage || this.isUpdating) return;
    
    this.isUpdating = true;
    
    const updateData = { 
      lifeStage: this.selectedLifeStage 
    };
    
    this.customerService.updateCustomerObservable(this.selectedCustomerForLifeStage.id, updateData)
      .subscribe({
        next: (result) => {
          console.log('Life stage update successful', result);
          this.loadCustomers();
          this.closeLifeStageModal();
          this.isUpdating = false;
        },
        error: (error) => {
          console.error('Failed to update life stage:', error);
          this.isUpdating = false;
          alert('Life stage could not be updated. Please try again.');
        }
      });
  }
  
  // Lead Category Modal Functions
  openLeadCategoryModal(customer: Customer): void {
    this.selectedCustomerForLeadCategory = customer;
    this.selectedLeadCategory = customer.leadCategory || '';
    this.showLeadCategoryModal = true;
  }

  closeLeadCategoryModal(): void {
    this.showLeadCategoryModal = false;
    this.selectedCustomerForLeadCategory = null;
    this.selectedLeadCategory = '';
  }

  updateLeadCategory(): void {
    if (!this.selectedCustomerForLeadCategory?.id || !this.selectedLeadCategory || this.isUpdating) return;
    
    this.isUpdating = true;
    
    const updateData = { leadCategory: this.selectedLeadCategory };
    
    this.customerService.updateCustomerObservable(this.selectedCustomerForLeadCategory.id, updateData)
      .subscribe({
        next: (result) => {
          console.log('Lead category update successful', result);
          this.loadCustomers();
          this.closeLeadCategoryModal();
          this.isUpdating = false;
        },
        error: (error) => {
          console.error('Failed to update lead category:', error);
          this.isUpdating = false;
          alert('Lead category could not be updated. Please try again.');
        }
      });
  }

loadCustomers(): void {
  this.customerService.getCustomers('all').subscribe((customers) => {
    // Get current user
    const currentUser = this.authService.currentUserValue;
    
    console.log('Current user:', currentUser); // Debug log
    console.log('All customers before filtering:', customers.length); // Debug log
    
    // Filter customers based on user role
    let filteredCustomers = customers as Customer[];
    
    // Check if user is executive (case-insensitive)
    if (currentUser?.role?.toLowerCase() === 'executive') {
      console.log('Filtering for executive user'); // Debug log
      
      // Get possible user identifiers to match against assignedTo field
      const userIdentifiers = [
        currentUser.displayName,
        currentUser.username,
        currentUser.email
      ].filter(identifier => identifier && identifier.length > 0);
      
      console.log('User identifiers to match:', userIdentifiers); // Debug log
      
      // Filter customers assigned to the current executive
      filteredCustomers = filteredCustomers.filter(customer => {
        const customerAssignedTo = customer.assignedTo;
        
        if (!customerAssignedTo) {
          return false; // Skip customers not assigned to anyone
        }
        
        // Check if assignedTo matches any of the user identifiers (case-insensitive)
        const isAssigned = userIdentifiers.some(identifier => 
          identifier && customerAssignedTo.toLowerCase().trim() === identifier.toLowerCase().trim()
        );
        
        if (isAssigned) {
          console.log('Customer assigned to executive:', customer.firstName, 'AssignedTo:', customer.assignedTo); // Debug log
        }
        
        return isAssigned;
      });
      
      console.log('Filtered customers for executive:', filteredCustomers.length); // Debug log
    } else {
      console.log('User is not executive, showing all customers'); // Debug log
    }
    
    // Process the filtered customers
    this.customersList = filteredCustomers.map(customer => ({
      ...customer,
      isIndividual: customer.isIndividual ?? !customer.businessName,
      lastCallTime: customer.lastCallTime ? 
        (this.isFirebaseTimestamp(customer.lastCallTime) ? 
          this.convertToDate(customer.lastCallTime) : 
          new Date(customer.lastCallTime)) : 
        undefined,
      callCount: customer.callCount || 0
    }));
    
    console.log('Final customers list:', this.customersList.length); // Debug log
    
    this.applyFilters();
  });
}

  // Helper method to check if an object is a Firebase timestamp
  isFirebaseTimestamp(obj: any): boolean {
    return obj && typeof obj === 'object' && typeof obj.toDate === 'function';
  }

  // Helper method to convert Firebase timestamp to Date
  convertToDate(timestamp: any): Date {
    if (timestamp instanceof Date) {
      return timestamp;
    }
    if (this.isFirebaseTimestamp(timestamp)) {
      return timestamp.toDate();
    }
    return new Date(timestamp);
  }

  toggleAllCustomers(event: Event): void {
    const isChecked = (event.target as HTMLInputElement).checked;
    this.selectedCustomers = isChecked 
      ? this.paginatedCustomers.map(c => c.id).filter((id): id is string => !!id) 
      : [];
  }
  
  openEditCustomerModal(customer: Customer): void {
    this.customerToEdit = customer;
    
    // Patch the form values with customer data
    this.editForm.patchValue({
      prefix: customer.prefix || '',
      firstName: customer.firstName || '',
      middleName: customer.middleName || '',
      lastName: customer.lastName || '',
      mobile: customer.mobile || '',
      alternateContact: customer.alternateContact || '',
      adcode: customer.adcode || '',
      businessName: customer.businessName || '',
      isIndividual: customer.isIndividual ?? true,
      status: customer.status || 'Active'
    });
    
    this.showEditModal = true;
  }

  // Confirm delete dialog
  confirmDeleteCustomer(customer: Customer): void {
    if (confirm(`Are you sure you want to delete ${customer.firstName} ${customer.lastName}? This action cannot be undone.`)) {
      this.deleteCustomer(customer.id!);
    }
  }

  // Delete customer
  deleteCustomer(customerId: string): void {
    this.customerService.deleteCustomer(customerId)
      .then(() => {
        // Show success message
        alert('Customer deleted successfully');
        // Reload customers
        this.loadCustomers();
      })
      .catch((error: any) => {
        console.error('Failed to delete customer:', error);
        alert('Failed to delete customer. Please try again.');
      });
  }
  
  toggleCustomerSelection(customerId: string): void {
    if (this.selectedCustomers.includes(customerId)) {
      this.selectedCustomers = this.selectedCustomers.filter(id => id !== customerId);
    } else {
      this.selectedCustomers.push(customerId);
    }
  }

  openAssignUserModal(customer: Customer): void {
    this.isBulkAssign = false;
    this.selectedCustomer = customer;
    this.selectedUserId = '';
    this.showAssignUserModal = true;
  }

  openBulkAssignModal(): void {
    this.isBulkAssign = true;
    this.selectedCustomer = null;
    this.selectedUserId = '';
    this.showAssignUserModal = true;
  }

  closeAssignUserModal(): void {
    this.showAssignUserModal = false;
    this.selectedCustomer = null;
    this.selectedUserId = '';
    this.isBulkAssign = false;
  }

  assignUser(): void {
    if (!this.selectedUserId || this.isUpdating) return;
  
    const user = this.availableUsers.find(u => u.id === this.selectedUserId);
    if (!user) return;
    
    this.isUpdating = true;
  
    if (this.isBulkAssign) {
      const updateObservables = this.selectedCustomers.map(customerId => 
        this.customerService.updateCustomerObservable(customerId, {
          assignedTo: user.name
        })
      );
      
      forkJoin(updateObservables).subscribe({
        next: (results) => {
          console.log('Bulk assign successful', results);
          this.loadCustomers();
          this.selectedCustomers = [];
          this.closeAssignUserModal();
          this.isUpdating = false;
        },
        error: (error) => {
          console.error('Failed to bulk assign users:', error);
          this.isUpdating = false;
          alert('Some users could not be assigned. Please try again.');
        }
      });
    } else {
      if (this.selectedCustomer && this.selectedCustomer.id) {
        this.customerService.updateCustomerObservable(this.selectedCustomer.id, {
          assignedTo: user.name
        }).subscribe({
          next: (result) => {
            console.log('User assign successful', result);
            this.loadCustomers();
            this.closeAssignUserModal();
            this.isUpdating = false;
          },
          error: (error) => {
            console.error('Failed to assign user:', error);
            this.isUpdating = false;
            alert('User could not be assigned. Please try again.');
          }
        });
      } else {
        this.isUpdating = false;
      }
    }
  }

  viewCustomerDetails(customer: Customer): void {
    if (customer && customer.id) {
      // Pass the entire customer object via route state
      this.router.navigate(['/crm/customers/view', customer.id], {
        state: { customerData: customer }
      });
    } else {
      console.error('Cannot view customer: Missing customer ID');
    }
  }
  
  get Math() {
    return Math;
  }
exportToExcel(): void {
  // Prepare the data for export
  const data = this.filteredCustomers.map(customer => ({
    'Customer Name': `${customer.prefix} ${customer.firstName} ${customer.middleName} ${customer.lastName}` + 
                    (customer.businessName && !customer.isIndividual ? ` (${customer.businessName})` : ''),
    'Mobile Number': customer.mobile,
    'Assigned To': customer.assignedTo || 'Not assigned',
        'Alternate Number': customer.alternateContact || '-', // New field
    'Ad Code': customer.adcode || '-', // New field

    'Life Stage': customer.lifeStage || '-',
    'Department': customer.department || 'Not assigned',
    'Lead Category': customer.leadCategory || '-',
    'Last Call Time': customer.lastCallTime ? this.datePipe.transform(customer.lastCallTime, 'medium') : '-',
    'Current State': customer.currentState || '-',
    'Status': customer.status || '-',
    'Call Count': customer.callCount || 0
  }));

  // Create a worksheet
  const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data);

  // Create a workbook
  const wb: XLSX.WorkBook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sales Customers');

  // Generate a file name
  const fileName = `Sales_Customers_${this.datePipe.transform(new Date(), 'yyyy-MM-dd')}.xlsx`;

  // Export the Excel file
  XLSX.writeFile(wb, fileName);
}

printTable(): void {
  // Clone the table to print only the relevant data
  const printContent = document.createElement('div');
  const tableClone = document.querySelector('.sales-customers-table')?.cloneNode(true) as HTMLTableElement;
  
  if (!tableClone) return;

  // Remove action column if it exists
  const actionTh = tableClone.querySelector('th:last-child');
  const actionTds = tableClone.querySelectorAll('td:last-child');
  
  if (actionTh && actionTh.textContent?.includes('Actions')) {
    actionTh.remove();
    actionTds.forEach(td => td.remove());
  }

  // Create a print header
  const header = document.createElement('h2');
  header.textContent = 'Sales Call Schedule - ' + this.datePipe.transform(new Date(), 'medium');
  header.style.textAlign = 'center';
  header.style.marginBottom = '20px';

  printContent.appendChild(header);
  printContent.appendChild(tableClone);

  // Add summary info
  const summary = document.createElement('div');
  summary.textContent = `Total Customers: ${this.filteredCustomers.length} | Generated on: ${this.datePipe.transform(new Date(), 'medium')}`;
  summary.style.textAlign = 'center';
  summary.style.marginTop = '20px';
  summary.style.fontSize = '12px';
  printContent.appendChild(summary);

  // Open print window
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(`
      <html>
        <head>
          <title>Print Sales Customers</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            @page { size: auto; margin: 5mm; }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
          <script>
            setTimeout(function() {
              window.print();
              window.close();
            }, 100);
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }
}
}