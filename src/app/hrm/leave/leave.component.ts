import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { LeaveService, UserLeaveBalance } from '../../services/leave.service';
import { UserService } from '../../services/user.service';
import { Modal } from 'bootstrap';
import { AuthService } from '../../auth.service';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { parse, isValid, format } from 'date-fns';
import { collection as firestoreCollection, CollectionReference, DocumentData, getDoc, doc } from '@firebase/firestore';
import { format as dateFormat } from 'date-fns';
import { addDoc } from 'firebase/firestore';
import { Firestore } from '@angular/fire/firestore';

@Component({
  selector: 'app-leave',
  templateUrl: './leave.component.html',
  styleUrls: ['./leave.component.scss'],
})
export class LeaveComponent implements OnInit {
  @ViewChild('editLeaveModal') editLeaveModalRef!: ElementRef;
  leaveForm!: FormGroup;
  
  statusForm: FormGroup;
  searchQuery: string = '';
  selectedFile: File | null = null;
  bulkApproveForm: FormGroup;
  selectedLeave: any = null;
  isLoadingActivities = false;
  bulkRejectForm: FormGroup;
  editLeaveForm!: FormGroup;
  selectedLeaveId: string | null = null;
  private editLeaveModalInstance!: Modal;
  currentUser: any;
  currentUserName: string = '';
  currentUserRole: string = '';
  canApproveLeaves: boolean = false;
  modal: Modal | null = null;
  importInProgress = false;
  importProgress = 0;
  importMessage = '';
  importMessageClass = 'alert-info';
  importData: any[] = [];
  importFile: File | null = null;
  
  isLoading: boolean = false;
  importError: string | null = null;
  filterForm!: FormGroup;
  showForm = false;
  showFilterSidebar = false;

  importModalInstance!: Modal;
  @ViewChild('importModal') importModalRef!: ElementRef;
  leaveTypes: any[] = [];
  users: any[] = [];
  leaves: any[] = [];
  filteredLeaves: any[] = [];
  leaveActivities: any[] = [];
  userLeaveBalances: UserLeaveBalance[] = [];
  Math = Math;

  columns = [
    { field: 'select', header: 'Select', visible: true },
    { field: 'referenceNo', header: 'Reference No', visible: true },
    { field: 'leaveType', header: 'Leave Type', visible: true },
    { field: 'employeeName', header: 'Employee', visible: true },
    { field: 'startDate', header: 'Start Date', visible: true },
    { field: 'endDate', header: 'End Date', visible: true },
    { field: 'session', header: 'Session', visible: true },
    { field: 'reason', header: 'Reason', visible: true },
    { field: 'status', header: 'Status', visible: true },
    { field: 'approvedBy', header: 'Approved By', visible: true },
    { field: 'maxLeaveCount', header: 'Max Days', visible: true },
    { field: 'daysTaken', header: 'Days Taken', visible: true },
    { field: 'remainingLeave', header: 'Remaining Leave', visible: true },
    { field: 'actions', header: 'Actions', visible: true },
  ];
  
  // For checkboxes and bulk operations
  selectedLeaves: { [id: string]: boolean } = {};
  selectAll: boolean = false;

  @ViewChild('statusModal') statusModalRef!: ElementRef;
  @ViewChild('bulkApproveModal') bulkApproveModalRef!: ElementRef;
  @ViewChild('bulkRejectModal') bulkRejectModalRef!: ElementRef;
  @ViewChild('fileInput') fileInput!: ElementRef;
  
  private importModal: Modal | undefined;
  @ViewChild('activityModal') activityModalRef!: ElementRef;
  
  private bootstrapModalInstance!: Modal;
  private bulkApproveModalInstance!: Modal;
  private bulkRejectModalInstance!: Modal;
  private activityModalInstance!: Modal;
  private addLeaveModalInstance!: Modal;
  leaveTableRef: any;

  constructor(
    private fb: FormBuilder,
    private leaveService: LeaveService,
    private userService: UserService,
    private firestore: Firestore,
    private authService: AuthService
  ) {
    // Initialize forms
    this.statusForm = this.fb.group({
      status: ['pending', Validators.required],
      note: [''],
      approvedBy: ['']
    });
    
    this.bulkApproveForm = this.fb.group({
      approvedBy: ['', Validators.required],
      note: ['']
    });
    
    this.bulkRejectForm = this.fb.group({
      rejectedBy: ['', Validators.required],
      note: ['']
    });

    // Initialize filter form
    this.initFilterForm();
  }

  initFilterForm() {
    this.filterForm = this.fb.group({
      employee: [''],
      status: [''],
      leaveType: [''],
      startDate: [''],
      endDate: ['']
    });

    // Load initial data when filters are initialized
    this.loadInitialData();
  }

ngOnInit(): void {
  this.initializeForm(); // Initialize fresh form
  this.loadInitialData();
  this.initializeEditForm();
  this.setupFormListeners();
  
  // Initialize modals after view is initialized
  setTimeout(() => {
    this.initModals();
  });
  
  // Enhanced leave type change listener
  this.leaveForm.get('leaveTypeId')?.valueChanges.subscribe(leaveTypeId => {
    this.updateMaxLeaveCountAndBalance(leaveTypeId);
  });
  
  this.statusForm = this.fb.group({
    status: ['', Validators.required],
    note: [''],
    approvedBy: ['']
  });
  
  this.currentUser = this.authService.currentUserValue;
  this.currentUserName = this.currentUser?.displayName || this.currentUser?.username || '';
  
  // Check user role and permissions
  this.checkUserPermissions();
  
  // Initialize user leave balances
  this.initializeCurrentUserBalances();
  
  this.authService.getCurrentUser().subscribe(user => {
    if (user) {
      this.initializeForm(); // Reinitialize form for new user
      this.loadUserLeaveBalances(user.uid);
      this.checkUserPermissions(); // Recheck permissions when user changes
    }
  });
}

private async checkUserPermissions(): Promise<void> {
  if (!this.currentUser) {
    this.canApproveLeaves = false;
    return;
  }

  try {
    // Get current user's complete profile from the users collection
    this.userService.getUserByIdOnce(this.currentUser.uid).subscribe(
      (userProfile) => {
        if (userProfile) {
          this.currentUserRole = userProfile.role?.toLowerCase() || '';
          
          // Check if user has approval permissions
          this.canApproveLeaves = this.currentUserRole === 'hr manager' || 
                                 this.currentUserRole === 'admin' ||
                                 this.currentUserRole === 'hrmanager';
          
          console.log('User role:', this.currentUserRole, 'Can approve:', this.canApproveLeaves);
        } else {
          // Fallback: check auth user role if user profile not found
          this.currentUserRole = this.currentUser.role?.toLowerCase() || '';
          this.canApproveLeaves = this.currentUserRole === 'hr manager' || 
                                 this.currentUserRole === 'admin' ||
                                 this.currentUserRole === 'hrmanager';
        }
      },
      (error) => {
        console.error('Error getting user profile:', error);
        // Fallback to auth user role
        this.currentUserRole = this.currentUser.role?.toLowerCase() || '';
        this.canApproveLeaves = this.currentUserRole === 'hr manager' || 
                               this.currentUserRole === 'admin' ||
                               this.currentUserRole === 'hrmanager';
      }
    );
  } catch (error) {
    console.error('Error checking user permissions:', error);
    this.canApproveLeaves = false;
  }
}

private initModals(): void {
  if (this.editLeaveModalRef) {
    this.editLeaveModalInstance = new Modal(this.editLeaveModalRef.nativeElement);
  }
  
  if (this.statusModalRef) {
    this.bootstrapModalInstance = new Modal(this.statusModalRef.nativeElement);
  }
  
  if (this.bulkApproveModalRef) {
    this.bulkApproveModalInstance = new Modal(this.bulkApproveModalRef.nativeElement);
  }
  
  if (this.bulkRejectModalRef) {
    this.bulkRejectModalInstance = new Modal(this.bulkRejectModalRef.nativeElement);
  }
  
  if (this.activityModalRef) {
    this.activityModalInstance = new Modal(this.activityModalRef.nativeElement);
  }
  
  const addLeaveModalElement = document.getElementById('addLeaveModal');
  if (addLeaveModalElement) {
    this.addLeaveModalInstance = new Modal(addLeaveModalElement);
  }
}

  

  async initializeCurrentUserBalances() {
    if (this.currentUser) {
      const user = this.users.find(u => 
        u.username === this.currentUser.username || 
        u.email === this.currentUser.email
      );
      
      if (user) {
        try {
          await this.leaveService.initializeUserLeaveBalances(user.id);
          await this.loadUserLeaveBalances(user.id);
        } catch (error) {
          console.error('Error initializing user balances:', error);
        }
      }
    }
  }

async loadUserLeaveBalances(userId: string) {
  try {
    // First try to get existing balances
    this.userLeaveBalances = await this.leaveService.getUserLeaveBalances(userId);
    
    // If no balances exist, initialize them
    if (this.userLeaveBalances.length === 0) {
      await this.leaveService.initializeUserLeaveBalances(userId);
      this.userLeaveBalances = await this.leaveService.getUserLeaveBalances(userId);
    }
  } catch (error) {
    console.error('Error loading user leave balances:', error);
    // Fallback to properly formatted leave type max values
    const currentDate = new Date();
    this.userLeaveBalances = this.leaveTypes.map(type => ({
      userId: userId,
      leaveTypeId: type.id,
      leaveTypeName: type.leaveType || type.name,
      allocated: type.maxLeaveCount || type.maxDays || 0,
      used: 0,
      remaining: type.maxLeaveCount || type.maxDays || 0,
      year: currentDate.getFullYear(),
      createdAt: currentDate,
      updatedAt: currentDate
    } as UserLeaveBalance));
  }
}

  initializeEditForm() {
    this.editLeaveForm = this.fb.group({
      leaveTypeId: ['', Validators.required],
      maxLeaveCount: [1, [Validators.required, Validators.min(1)]],
      session: ['Full Day', Validators.required],
      startDate: ['', Validators.required],
      endDate: ['', Validators.required],
      reason: ['', Validators.required]
    });
  }

  // Enhanced method to update max leave count and show current balance
  async updateMaxLeaveCountAndBalance(leaveTypeId: string): Promise<void> {
    if (!leaveTypeId) {
      this.leaveForm.patchValue({ maxLeaveCount: 1 });
      return;
    }

    const selectedLeaveType = this.leaveTypes.find(type => type.id === leaveTypeId);
    if (!selectedLeaveType) return;

    // Get current user
    const user = this.users.find(u => u.id === this.leaveForm.get('employeeId')?.value);
    if (!user) return;

    try {
      // Get user's current balance for this leave type
      const balance = await this.leaveService.getUserLeaveBalance(user.id, leaveTypeId);
      
      if (balance) {
        this.leaveForm.patchValue({
          maxLeaveCount: balance.remaining // Show remaining balance, not total allocation
        });
        
        // Show balance information to user
        console.log(`Available ${selectedLeaveType.leaveType} balance: ${balance.remaining} days`);
      } else {
        // If no balance record exists, show total allocation
        this.leaveForm.patchValue({
          maxLeaveCount: selectedLeaveType.maxLeaveCount || selectedLeaveType.maxDays || 0
        });
      }
    } catch (error) {
      console.error('Error getting balance:', error);
      // Fallback to leave type max
      this.leaveForm.patchValue({
        maxLeaveCount: selectedLeaveType.maxLeaveCount || selectedLeaveType.maxDays || 0
      });
    }
  }

getRemainingBalance(leaveTypeId: string): number {
  const balance = this.userLeaveBalances.find(b => b.leaveTypeId === leaveTypeId);
  if (balance) {
    return balance.remaining;
  }
  
  // If no balance record exists, check the leave type's max days
  const leaveType = this.leaveTypes.find(t => t.id === leaveTypeId);
  return leaveType ? (leaveType.maxLeaveCount || leaveType.maxDays || 0) : 0;
}

  // Get used balance for display
  getUsedBalance(leaveTypeId: string): number {
    const balance = this.userLeaveBalances.find(b => b.leaveTypeId === leaveTypeId);
    return balance ? balance.used : 0;
  }

  setupFormListeners(): void {
    this.statusForm.get('status')?.valueChanges.subscribe(status => {
      const approvedByControl = this.statusForm.get('approvedBy');
      if (status === 'approved') {
        approvedByControl?.setValidators([Validators.required]);
      } else {
        approvedByControl?.clearValidators();
      }
      approvedByControl?.updateValueAndValidity();
    });
  }

// In leave.component.ts

initializeForm() {
  this.leaveForm = this.fb.group({
    employeeId: ['', ],
    leaveTypeId: ['', ],
    session: ['Full Day', ],
    startDate: ['', ],
    endDate: ['', ],
    reason: ['', ]
  });

  // Set current user if available
  const currentUser = this.authService.currentUserValue;
  if (currentUser) {
    const user = this.users.find(u => u.id === currentUser.uid);
    if (user) {
      this.leaveForm.patchValue({
        employeeId: user.id,
      });
    }
  }
}
  loadInitialData() {
    this.currentUser = this.authService.currentUserValue;
    this.currentUserName = this.currentUser?.displayName || this.currentUser?.username || '';
    
    this.leaveService.getLeaveTypes().subscribe((types) => {
      this.leaveTypes = types;
    });

    this.leaveService.getLeaves().subscribe((leaves) => {
      this.leaves = leaves.map(leave => {
        const processedLeave = {
          ...leave,
          startDate: leave.startDate?.toDate ? leave.startDate.toDate() : new Date(leave.startDate),
          endDate: leave.endDate?.toDate ? leave.endDate.toDate() : new Date(leave.endDate || leave.startDate),
          session: leave.session || 'Full Day'
        };
        return this.calculateLeaveDetails(processedLeave);
      });
      this.filteredLeaves = [...this.leaves];
      this.resetSelections();
    });

    this.userService.getUsers().subscribe((users) => {
      this.users = users;
      const user = this.users.find(u => 
        u.username === this.currentUser?.username || 
        u.email === this.currentUser?.email
      );
      
      if (user) {
        this.leaveForm.patchValue({
          employeeId: user.id,
          department: user.department
        });
        
        // Load user's leave balances
        this.loadUserLeaveBalances(user.id);
      }
    });

    this.filteredLeaves = [...this.leaves];
    this.isLoading = false;
    this.resetSelections();
  }

// In leave.component.ts

async submitForm() {
  if (this.leaveForm.invalid) {
    this.leaveForm.markAllAsTouched();
    return;
  }

  const formValue = this.leaveForm.value;
  
  // Validate leave type selection
  if (!formValue.leaveTypeId) {
    alert('Please select a valid leave type');
    return;
  }

  // Validate dates
  if (!formValue.startDate || !formValue.endDate) {
    alert('Please select valid start and end dates');
    return;
  }

  const startDate = new Date(formValue.startDate);
  const endDate = new Date(formValue.endDate);
  
  if (startDate > endDate) {
    alert('End date cannot be before start date');
    return;
  }

  // Find selected user and leave type
  const selectedUser = this.users.find(user => user.id === formValue.employeeId);
  const selectedLeaveType = this.leaveTypes.find(type => type.id === formValue.leaveTypeId);

  if (!selectedUser || !selectedLeaveType) {
    alert('Please select valid employee and leave type');
    return;
  }

  // Calculate requested days
  const daysRequested = this.leaveService.calculateLeaveDays(
    startDate,
    endDate,
    formValue.session
  );

  // Get current balance (or default to leave type max if no balance record exists)
  let remainingBalance = this.getRemainingBalance(selectedLeaveType.id);
  
  // If no balance record exists, use the leave type's max days as initial balance
  if (remainingBalance === 0 && !this.userLeaveBalances.some(b => b.leaveTypeId === selectedLeaveType.id)) {
    remainingBalance = selectedLeaveType.maxLeaveCount || selectedLeaveType.maxDays || 0;
  }

  // Check available balance (allow 0 days if that's all they have)
  if (daysRequested > remainingBalance) {
    alert(`Insufficient balance. You only have ${remainingBalance} days remaining.`);
    return;
  }

  // Prepare leave data
  const leaveData = {
    referenceNo: 'LV' + new Date().getFullYear() + '/' + Math.floor(Math.random() * 100000),
    leaveType: selectedLeaveType.leaveType,
    leaveTypeId: selectedLeaveType.id,
    employeeName: selectedUser.username,
    employeeId: selectedUser.id,
    userId: selectedUser.id,
    startDate: startDate,
    endDate: endDate,
    session: formValue.session,
    reason: formValue.reason,
    daysRequested: daysRequested,
    status: 'pending',
    remainingLeave: remainingBalance - daysRequested
  };

  try {
    const result = await this.leaveService.applyForLeave(leaveData);
    
    if (result.success) {
      // Reset form and close modal
      this.leaveForm.reset({
        employeeId: selectedUser.id,
        session: 'Full Day'
      });
      
      if (this.addLeaveModalInstance) {
        this.addLeaveModalInstance.hide();
      }
      
      alert('Leave application submitted successfully!');
      
      // Refresh the data
      this.loadInitialData();
      
      // Reload user balances to show updated remaining balance
      await this.loadUserLeaveBalances(selectedUser.id);
    } else {
      alert(`Leave application failed: ${result.error}`);
    }
  } catch (error) {
    console.error('Error submitting leave:', error);
    alert('Failed to submit leave. Please try again.');
  }
}

  // Enhanced approve/reject with proper balance handling and permission check
  async updateStatus() {
    // Check permissions first
    if (!this.canApproveLeaves) {
      alert('You do not have permission to approve or reject leave requests.');
      return;
    }

    if (this.statusForm.invalid || !this.selectedLeave) return;

    const { status, note, approvedBy } = this.statusForm.value;
    const changedBy = approvedBy || this.currentUserName;

    try {
      if (status === 'approved') {
        await this.leaveService.approveLeave(this.selectedLeave.id, changedBy, note);
      } else if (status === 'rejected') {
        await this.leaveService.rejectLeave(this.selectedLeave.id, changedBy, note);
      }

      // Close modal and refresh data
      this.bootstrapModalInstance.hide();
      this.loadInitialData();
      
      // Reload user balances
      if (this.selectedLeave.userId) {
        await this.loadUserLeaveBalances(this.selectedLeave.userId);
      }
    } catch (error) {
      console.error('Error updating status:', error);
      alert(`Error updating status: ${error}`);
    }
  }

  // Rest of the methods remain the same, but with enhanced balance tracking...
  
openEditModal(leave: any) {
  this.selectedLeaveId = leave.id;
  
  const selectedLeave = this.leaves.find(l => l.id === leave.id);
  
  if (selectedLeave) {
    this.editLeaveForm.patchValue({
      leaveTypeId: selectedLeave.leaveTypeId,
      maxLeaveCount: selectedLeave.maxLeaveCount,
      session: selectedLeave.session,
      startDate: this.formatDateForInput(selectedLeave.startDate),
      endDate: this.formatDateForInput(selectedLeave.endDate),
      reason: selectedLeave.reason
    });
  }
  
  // Initialize modal if not already done
  if (!this.editLeaveModalInstance && this.editLeaveModalRef) {
    this.editLeaveModalInstance = new Modal(this.editLeaveModalRef.nativeElement);
  }
  
  this.editLeaveModalInstance?.show();
}

  private formatDateForInput(date: Date | string): string {
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  }

  async updateLeave() {
    if (this.editLeaveForm.invalid || !this.selectedLeaveId) {
      this.editLeaveForm.markAllAsTouched();
      return;
    }

    try {
      const formValue = this.editLeaveForm.value;
      const updates = {
        leaveTypeId: formValue.leaveTypeId,
        maxLeaveCount: formValue.maxLeaveCount,
        session: formValue.session,
        startDate: new Date(formValue.startDate),
        endDate: new Date(formValue.endDate),
        reason: formValue.reason,
        updatedAt: new Date()
      };

      await this.leaveService.updateLeave(this.selectedLeaveId, updates);
      
      const index = this.leaves.findIndex(l => l.id === this.selectedLeaveId);
      if (index !== -1) {
        this.leaves[index] = { 
          ...this.leaves[index], 
          ...updates,
          leaveType: this.leaveTypes.find(t => t.id === formValue.leaveTypeId)?.leaveType || ''
        };
        this.filteredLeaves = [...this.leaves];
      }

      this.editLeaveModalInstance.hide();
      this.selectedLeaveId = null;
      
      alert('Leave updated successfully!');
    } catch (error) {
      console.error('Error updating leave:', error);
      alert('Failed to update leave. Please try again.');
    }
  }



private calculateDaysForLeave(leave: any): number {
  const startDate = new Date(leave.startDate);
  const endDate = new Date(leave.endDate || leave.startDate);
  
  // Same day leave
  if (startDate.toDateString() === endDate.toDateString()) {
    return leave.session === 'Full Day' ? 1 : 0.5;
  }
  
  // Multi-day leave
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Inclusive counting
  
  // Adjust for half days
  if (leave.session === 'First Half' || leave.session === 'Second Half') {
    return diffDays - 0.5;
  }
  
  return diffDays;
}

  calculateLeaveDays(startDate: Date, endDate: Date, session: string): number {
    if (!startDate || !endDate) return 0;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const diffTime = Math.abs(end.getTime() - start.getTime());
    let days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    
    if (session === 'First Half' || session === 'Second Half') {
      days = days - 0.5;
    }
    
    return days;
  }

  // Export functionality methods
  exportToCSV(): void {
    const data = this.filteredLeaves.map(leave => ({
      'Reference No': leave.referenceNo,
      'Leave Type': leave.leaveType,
      'Employee': leave.employeeName,
      'Start Date': this.formatDate(leave.startDate),
      'End Date': this.formatDate(leave.endDate),
      'Session': leave.session,
      'Reason': leave.reason,
      'Status': leave.status,
    }));

    const csv = this.convertToCSV(data);
    this.downloadFile(csv, 'leaves_export.csv', 'text/csv');
  }

  exportToExcel(): void {
    const data = this.filteredLeaves.map(leave => ({
      'Reference No': leave.referenceNo,
      'Leave Type': leave.leaveType,
      'Employee': leave.employeeName,
      'Start Date': this.formatDate(leave.startDate),
      'End Date': this.formatDate(leave.endDate),
      'Session': leave.session,
      'Reason': leave.reason,
      'Status': leave.status
    }));

    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leaves');
    XLSX.writeFile(wb, 'leaves_export.xlsx');
  }

  updateColumnVisibility(): void {
    // This method is triggered when column visibility checkboxes are changed
  }

  private convertToCSV(objArray: any[]): string {
    const array = typeof objArray !== 'object' ? JSON.parse(objArray) : objArray;
    let str = '';
    let row = '';

    for (const index in objArray[0]) {
      row += index + ',';
    }
    row = row.slice(0, -1);
    str += row + '\r\n';

    for (let i = 0; i < array.length; i++) {
      let line = '';
      for (const index in array[i]) {
        if (line !== '') line += ',';
        line += '"' + array[i][index] + '"';
      }
      str += line + '\r\n';
    }

    return str;
  }

  downloadTemplateFile(): void {
    const templateData = [
      {
        'Employee Name': 'john.doe@example.com',
        'Leave Type': 'Annual Leave',
        'Start Date': '2023-01-01',
        'End Date': '2023-01-05',
        'Session': 'Full Day',
        'Reason': 'Vacation',
        'Status': 'pending'
      }
    ];
  
    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(templateData);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leaves Template');
    XLSX.writeFile(wb, 'leaves_import_template.xlsx');
  }

  private downloadFile(data: string, filename: string, type: string): void {
    const blob = new Blob([data], { type });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 100);
  }

  applySearch() {
    if (!this.searchQuery) {
      this.applyFilters();
      return;
    }

    const query = this.searchQuery.toLowerCase();
    this.filteredLeaves = this.leaves.filter(leave => {
      return (
        (leave.referenceNo?.toLowerCase().includes(query)) ||
        (leave.employeeName?.toLowerCase().includes(query)) ||
        (leave.leaveType?.toLowerCase().includes(query)) ||
        (leave.reason?.toLowerCase().includes(query)) ||
        (leave.status?.toLowerCase().includes(query)) ||
        (leave.session?.toLowerCase().includes(query)) ||
        (this.formatDate(leave.startDate)?.includes(query))
      );
    });
  }

  clearSearch() {
    this.searchQuery = '';
    this.applyFilters();
  }

  applyFilters() {
    const filters = this.filterForm.value;
    
    this.filteredLeaves = this.leaves.filter(leave => {
      if (filters.employee && leave.employeeId !== filters.employee) {
        return false;
      }
      
      if (filters.status && leave.status !== filters.status) {
        return false;
      }
      
      if (filters.leaveType && leave.leaveTypeId !== filters.leaveType) {
        return false;
      }
      
      if (filters.startDate || filters.endDate) {
        const leaveStartDate = this.parseDate(leave.startDate);
        const leaveEndDate = this.parseDate(leave.endDate || leave.startDate);
        
        const filterStartDate = filters.startDate ? this.parseDate(filters.startDate) : null;
        const filterEndDate = filters.endDate ? this.parseDate(filters.endDate) : null;
        
        if (filterStartDate && leaveEndDate < filterStartDate) {
          return false;
        }
        
        if (filterEndDate && leaveStartDate > filterEndDate) {
          return false;
        }
      }
      
      return true;
    });
  }

  private parseDate(date: any): Date {
    if (!date) return new Date(0);
    
    if (date instanceof Date && !isNaN(date.getTime())) {
      return date;
    }
    
    try {
      const parsed = new Date(date);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    } catch (e) {
      console.warn('Date parsing error:', e);
    }
    
    return new Date();
  }

  resetSelections() {
    this.selectedLeaves = {};
    this.selectAll = false;
  }
  
  toggleSelectAll() {
    this.selectAll = !this.selectAll;
    
    this.leaves.forEach(leave => {
      this.selectedLeaves[leave.id] = this.selectAll;
    });
  }
  
  toggleSelect(leaveId: string) {
    this.selectedLeaves[leaveId] = !this.selectedLeaves[leaveId];
    this.selectAll = this.leaves.every(leave => this.selectedLeaves[leave.id]);
  }
  
  get hasSelectedLeaves(): boolean {
    return Object.values(this.selectedLeaves).some(selected => selected);
  }
  
  get selectedLeaveCount(): number {
    return Object.values(this.selectedLeaves).filter(selected => selected).length;
  }

  openBulkApproveModal() {
    // Check permissions first
    if (!this.canApproveLeaves) {
      alert('You do not have permission to approve leave requests.');
      return;
    }

    if (!this.hasSelectedLeaves) {
      alert('Please select at least one leave request to approve');
      return;
    }
    
    this.bulkApproveForm.reset({
      approvedBy: '',
      note: '',
    });
    
    this.bulkApproveModalInstance = new Modal(this.bulkApproveModalRef.nativeElement);
    this.bulkApproveModalInstance.show();
  }
  
  openBulkRejectModal() {
    // Check permissions first
    if (!this.canApproveLeaves) {
      alert('You do not have permission to reject leave requests.');
      return;
    }

    if (!this.hasSelectedLeaves) {
      alert('Please select at least one leave request to reject');
      return;
    }
    
    this.bulkRejectForm.reset({
      rejectedBy: '',
      note: ''
    });
    
    this.bulkRejectModalInstance = new Modal(this.bulkRejectModalRef.nativeElement);
    this.bulkRejectModalInstance.show();
  }

  async approveBulkLeaves() {
    // Check permissions first
    if (!this.canApproveLeaves) {
      alert('You do not have permission to approve leave requests.');
      return;
    }

    if (this.bulkApproveForm.invalid) {
      this.bulkApproveForm.markAllAsTouched();
      return;
    }
    
    const { approvedBy, note } = this.bulkApproveForm.value;
    const currentUser = this.authService.currentUserValue;
    const userName = currentUser?.displayName || currentUser?.username || approvedBy;
    
    const selectedLeaveIds = Object.entries(this.selectedLeaves)
      .filter(([_, selected]) => selected)
      .map(([id, _]) => id);
    
    try {
      await this.leaveService.bulkApproveLeaves(selectedLeaveIds, userName, note);
      this.bulkApproveModalInstance.hide();
      this.resetSelections();
      this.loadInitialData();
    } catch (error) {
      console.error('Error approving leaves:', error);
    }
  }

  async rejectBulkLeaves() {
    // Check permissions first
    if (!this.canApproveLeaves) {
      alert('You do not have permission to reject leave requests.');
      return;
    }

    if (this.bulkRejectForm.invalid) {
      this.bulkRejectForm.markAllAsTouched();
      return;
    }
    
    const { rejectedBy, note } = this.bulkRejectForm.value;
    const currentUser = this.authService.currentUserValue;
    const userName = currentUser?.displayName || currentUser?.username || rejectedBy;
    
    const selectedLeaveIds = Object.entries(this.selectedLeaves)
      .filter(([_, selected]) => selected)
      .map(([id, _]) => id);
    
    try {
      await this.leaveService.bulkRejectLeaves(selectedLeaveIds, userName, note);
      this.bulkRejectModalInstance.hide();
      this.resetSelections();
      this.loadInitialData();
    } catch (error) {
      console.error('Error rejecting leaves:', error);
    }
  }

  toggleForm() {
    this.leaveForm.reset();
    const currentUser = this.authService.currentUserValue;

    if (currentUser) {
      const user = this.users.find(
        (u) => u.username === currentUser.displayName || u.email === currentUser.email
      );

      if (user) {
        this.leaveForm.patchValue({
          employeeId: user.id,
        });
      }
    }

    const addLeaveModal = document.getElementById('addLeaveModal');
    if (addLeaveModal) {
      this.addLeaveModalInstance = new Modal(addLeaveModal);
      this.addLeaveModalInstance.show();
    }
  }

  async deleteLeave(id: string) {
    if (confirm('Are you sure you want to delete this leave record?')) {
      try {
        await this.leaveService.deleteLeave(id);
      } catch (error) {
        console.error('Error deleting leave:', error);
      }
    }
  }

  async openStatusModal(leave: any) {
    // Check permissions first
    if (!this.canApproveLeaves) {
      alert('You do not have permission to change leave status.');
      return;
    }

    this.selectedLeave = leave;
    this.statusForm.reset({
      status: leave.status,
      approvedBy: this.currentUserName
    });

    this.statusForm.get('status')?.valueChanges.subscribe(status => {
      const approvedByControl = this.statusForm.get('approvedBy');
      if (status === 'approved') {
        approvedByControl?.setValidators([Validators.required]);
      } else {
        approvedByControl?.clearValidators();
      }
      approvedByControl?.updateValueAndValidity();
    });

    this.bootstrapModalInstance = new Modal(this.statusModalRef.nativeElement);
    this.bootstrapModalInstance.show();
  }

  async viewActivity(leave: any) {
    this.selectedLeave = leave;
    this.isLoadingActivities = true;
    
    try {
      this.leaveActivities = await this.leaveService.getLeaveActivities(leave.id);
      
      if (this.leaveActivities.length === 0) {
        this.leaveActivities = [{
          action: 'created',
          status: leave.status || 'pending',
          timestamp: leave.createdAt || new Date(),
          by: leave.employeeName || 'System',
          note: 'Leave request was created'
        }];
      }
    } catch (error) {
      console.error('Error loading activities:', error);
      this.leaveActivities = [{
        action: 'error',
        status: leave.status || 'unknown',
        timestamp: new Date(),
        by: 'System',
        note: 'Failed to load activity history. Showing current status.'
      }];
    } finally {
      this.isLoadingActivities = false;
    }

    this.activityModalInstance = new Modal(this.activityModalRef.nativeElement);
    this.activityModalInstance.show();
  }

  formatDate(excelDate: string | Date, formatString: string = 'yyyy-MM-dd'): string {
    if (!excelDate) return '';
    
    if (excelDate instanceof Date) {
      return dateFormat(excelDate, 'yyyy-MM-dd');
    }
    
    try {
      const parsed = parse(excelDate, 'yyyy-MM-dd', new Date());
      if (isValid(parsed)) {
        return dateFormat(parsed, 'yyyy-MM-dd');
      }
      return '';
    } catch (e) {
      console.error('Error parsing date:', e);
      return '';
    }
  }

  formatActivityAction(activity: any): string {
    if (activity.action === 'status_change') {
      if (activity.newStatus === 'approved') return 'approved';
      if (activity.newStatus === 'rejected') return 'rejected';
      return 'status updated';
    }
    return activity.action || 'updated';
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'approved': return 'bg-success';
      case 'rejected': return 'bg-danger';
      case 'pending': return 'bg-warning text-dark';
      default: return 'bg-secondary';
    }
  }

  getActivityIcon(action: string): string {
    switch (action) {
      case 'created': return 'bi-plus-circle';
      case 'approved': return 'bi-check-circle';
      case 'rejected': return 'bi-x-circle';
      case 'updated': return 'bi-pencil';
      default: return 'bi-clock-history';
    }
  }

  toggleFilterSidebar() {
    this.showFilterSidebar = !this.showFilterSidebar;
  }

  resetFilters() {
    this.filterForm.reset({
      employee: '',
      status: '',
      leaveType: '',
      startDate: '',
      endDate: ''
    });
    
    this.searchQuery = '';
    this.applyFilters();
  }

  // Import related methods (keeping existing functionality)
  onFileChange(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    const fileReader = new FileReader();
    fileReader.onload = (e) => {
      try {
        const arrayBuffer: any = e.target?.result;
        const data = new Uint8Array(arrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          raw: false,
          dateNF: 'yyyy-mm-dd',
          defval: null
        });

        this.importData = jsonData.map((item: any) => {
          if (!item['Employee Name'] && !item['Employee']) {
            throw new Error('Employee name is missing');
          }

          return {
            referenceNo: item['Reference No'] || '',
            employeeName: item['Employee Name'] || item['Employee'],
            leaveType: item['Leave Type'],
            startDate: this.parseExcelDate(item['Start Date']),
            endDate: this.parseExcelDate(item['End Date']),
            session: item['Session'] || 'Full Day',
            reason: item['Reason'] || '',
            status: item['Status'] || 'pending'
          };
        });

        this.importMessage = `Successfully loaded ${this.importData.length} records`;
        this.importMessageClass = 'alert-success';

      } catch (error) {
        console.error('Error parsing file:', error);
        this.importMessage = error instanceof Error ? error.message : 'Error parsing file';
        this.importMessageClass = 'alert-danger';
        this.importData = [];
      }
    };
    fileReader.readAsArrayBuffer(file);
  }

  private parseExcelDate(excelDate: any): Date | null {
    if (!excelDate) return null;
    
    if (excelDate instanceof Date) {
      return excelDate;
    }
    
    if (typeof excelDate === 'number') {
      return new Date((excelDate - (25567 + 2)) * 86400 * 1000);
    }
    
    if (typeof excelDate === 'string') {
      const isoDate = new Date(excelDate);
      if (!isNaN(isoDate.getTime())) return isoDate;
      
      const formats = [
        'yyyy-MM-dd', 'MM/dd/yyyy', 'dd-MM-yyyy',
        'yyyy/MM/dd', 'MM-dd-yyyy', 'dd/MM/yyyy',
        'EEE MMM dd yyyy HH:mm:ss'
      ];
      
      for (const fmt of formats) {
        try {
          const parsed = parse(excelDate, fmt, new Date());
          if (isValid(parsed)) return parsed;
        } catch (e) {
          continue;
        }
      }
    }
    
    console.warn('Could not parse date:', excelDate);
    return null;
  }

  getImportDataKeys(): string[] {
    if (this.importData.length === 0) return [];
    return Object.keys(this.importData[0]);
  }

  async importLeaves() {
    if (!this.importData.length || !this.importFile) return;
    
    const errors: string[] = [];
    
    this.importData.forEach((record, index) => {
      if (!record.employeeName) {
        errors.push(`Row ${index + 1}: Employee name is required`);
      }
      if (!record.startDate || isNaN(new Date(record.startDate).getTime())) {
        errors.push(`Row ${index + 1}: Invalid start date`);
      }
      if (!record.endDate || isNaN(new Date(record.endDate).getTime())) {
        errors.push(`Row ${index + 1}: Invalid end date`);
      }
      if (!record.leaveType) {
        errors.push(`Row ${index + 1}: Leave type is required`);
      }
    });
    
    if (errors.length) {
      this.importMessage = `Validation errors:\n${errors.join('\n')}`;
      this.importMessageClass = 'alert-danger';
      return;
    }
  }
calculateLeaveDetails(leave: any): any {
  // Get the leave type details
  const leaveType = this.leaveTypes.find(t => t.id === leave.leaveTypeId);
  
  // Calculate days for this leave
  const daysForThisLeave = this.calculateDaysForLeave(leave);
  
  // Get max days from leave type if not set
  const maxDays = leave.maxLeaveCount || leaveType?.maxLeaveCount || 12; // Default to 12 if not found
  
  // Calculate remaining leave based on all approved leaves of this type
  const approvedLeaves = this.leaves.filter(l => 
    l.leaveTypeId === leave.leaveTypeId && 
    l.status === 'approved' &&
    l.id !== leave.id // Exclude current leave
  );
  
  const totalDaysTaken = approvedLeaves.reduce((sum, l) => sum + (l.daysTaken || 0), 0);
  const remaining = maxDays - totalDaysTaken - (leave.status === 'approved' ? daysForThisLeave : 0);
  
  return {
    ...leave,
    days: daysForThisLeave,
    daysTaken: leave.status === 'approved' ? daysForThisLeave : 0,
    remainingLeave: remaining > 0 ? remaining : 0,
    maxLeaveCount: maxDays
  };
}

  formatDisplayDate(dateValue: any): string {
    if (!dateValue) return '';
    
    try {
      if (typeof dateValue === 'string' && dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return dateValue;
      }
      
      if (dateValue instanceof Date) {
        return format(dateValue, 'yyyy-MM-dd');
      }
      
      const parsed = new Date(dateValue);
      if (!isNaN(parsed.getTime())) {
        return format(parsed, 'yyyy-MM-dd');
      }
      
      return dateValue;
    } catch {
      return dateValue;
    }
  }
}