import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { LeaveService } from '../../services/leave.service';
import { UserService } from '../../services/user.service';
import { Modal } from 'bootstrap';
import { AuthService } from '../../auth.service';
import jsPDF from 'jspdf';
import 'jspdf-autotable'; // Import for PDF table functionality
import * as XLSX from 'xlsx'; // Import XLSX library
import { parse, isValid, format } from 'date-fns';

import {  format as dateFormat } from 'date-fns';
import { type } from 'node:os';

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
  bulkRejectForm: FormGroup;
  editLeaveForm!: FormGroup;
selectedLeaveId: string | null = null;
private editLeaveModalInstance!: Modal;
  currentUser: any;
currentUserName: string = '';
  modal: Modal | null = null;
  importInProgress = false;
  importProgress = 0;
  importMessage = '';
  importMessageClass = 'alert-info';
  importData: any[] = [];
  importFile: File | null = null;
  showAvailableEmployees() {
    console.log("Available Employees:", this.users.map(u => ({
      username: u.username,
      fullName: `${u.firstName} ${u.lastName}`,
      email: u.email
    })));
  }
  
isLoading: boolean = false;
importError: string | null = null;
  filterForm: FormGroup; // Added for filter sidebar
  showForm = false;
  showFilterSidebar = false; // Added for filter sidebar toggle

  importModalInstance!: Modal;
  @ViewChild('importModal') importModalRef!: ElementRef;
  leaveTypes: any[] = [];
  users: any[] = [];
  leaves: any[] = [];
  filteredLeaves: any[] = []; // Added for filtered leaves display
  selectedLeave: any;
  leaveActivities: any[] = [];
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
    { field: 'approvalLeaveType', header: 'Approval Leave Type', visible: true },
    { field: 'note', header: 'Note', visible: true },
    { field: 'createdAt', header: 'Created At', visible: true },
    { field: 'days', header: 'Days', visible: true }, // New column
    { field: 'actions', header: 'Actions', visible: true },
      { field: 'maxLeaveCount', header: 'Max Days', visible: true }, // Add this line
        { field: 'endDate', header: 'End Date', visible: true },
          { field: 'daysTaken', header: 'Days Taken', visible: true },
  { field: 'remainingLeave', header: 'Remaining Leave', visible: true },


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
      private authService: AuthService // Add this

  ) {
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
    this.filterForm = this.fb.group({
      employee: [''],
          department: ['', Validators.required], // Add department field

      status: [''],
      leaveType: [''],
      approvalStatus: [''],
      startDate: [''],
      endDate: ['']
    });
    {
      this.statusForm = this.fb.group({
        status: ['pending', Validators.required],
        approvedBy: [''],
        approvalLeaveType: [''],
        note: ['']
      });
    }
  }
// Add this method to open the edit modal with data
openEditModal(leave: any) {
  this.selectedLeaveId = leave.id;
  
  // Find the leave in the leaves array to get all data
  const selectedLeave = this.leaves.find(l => l.id === leave.id);
  
  if (selectedLeave) {
    this.editLeaveForm.patchValue({
      leaveTypeId: selectedLeave.leaveTypeId, // Make sure this matches your data structure
      maxLeaveCount: selectedLeave.maxLeaveCount,
      session: selectedLeave.session,
      startDate: this.formatDateForInput(selectedLeave.startDate),
      endDate: this.formatDateForInput(selectedLeave.endDate),
      reason: selectedLeave.reason
    });
  }
  
  // Show the modal
  this.editLeaveModalInstance = new Modal(this.editLeaveModalRef.nativeElement);
  this.editLeaveModalInstance.show();
}// Helper method to format date for input field
private formatDateForInput(date: Date | string): string {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}
  ngOnInit(): void {
    this.initializeForm();
    this.loadInitialData();
      this.initializeEditForm(); // Add this line

    this.setupFormListeners();
    const modalElement = document.getElementById('importModal');
    if (modalElement) {
      this.modal = new Modal(modalElement);
    }
     this.leaveForm.get('leaveTypeId')?.valueChanges.subscribe(leaveTypeId => {
    this.updateMaxLeaveCount(leaveTypeId);
     });
      this.editLeaveModalInstance = new Modal(this.editLeaveModalRef.nativeElement);

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
  // Add this new method
updateMaxLeaveCount(leaveTypeId: string): void {
  if (!leaveTypeId) {
    this.leaveForm.patchValue({ maxLeaveCount: 1 }); // Reset to default
    return;
  }

  const selectedLeaveType = this.leaveTypes.find(type => type.id === leaveTypeId);
  if (selectedLeaveType) {
    this.leaveForm.patchValue({
      maxLeaveCount: selectedLeaveType.maxLeaveCount || 1
    });
  }
}

  setupFormListeners(): void {
    // Add valueChanges subscription for status in the status form
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
  
  // Export functionality methods
  exportToCSV(): void {
    const data = this.filteredLeaves.map(leave => ({
      'Reference No': leave.referenceNo,
      'Leave Type': leave.leaveType,
      'Employee': leave.employeeName,
      'Start Date': this.formatDate(leave.startDate),
      'Session': leave.session,
      'Reason': leave.reason,
      'Status': leave.status,
          'End Date': this.formatDate(leave.endDate),  // Add this line

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
      'Session': leave.session,
      'Reason': leave.reason,
      'Status': leave.status
    }));

    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leaves');
    XLSX.writeFile(wb, 'leaves_export.xlsx');
  }

  exportToPDF(): void {
    const doc = new jsPDF();
    const title = 'Leaves Report';
    const currentDate = new Date().toLocaleDateString();
    
    // Add title and date
    doc.setFontSize(18);
    doc.text(title, 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${currentDate}`, 14, 22);
    
    // Prepare data for the table
    const data = this.filteredLeaves.map(leave => [
      leave.referenceNo,
      leave.leaveType,
      leave.employeeName,
      this.formatDate(leave.startDate),
      leave.session,
      leave.reason,
      leave.status
    ]);
    
    // Add table
    (doc as any).autoTable({
      head: [['Reference No', 'Leave Type', 'Employee', 'Date', 'Session', 'Reason', 'Status']],
      body: data,
      startY: 30,
      styles: {
        fontSize: 8,
        cellPadding: 2,
        overflow: 'linebreak'
      },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: 'bold'
      }
    });
    
    doc.save('leaves_export.pdf');
  }

  printTable(): void {
    const printContent = this.leaveTableRef.nativeElement.innerHTML;
    const originalContent = document.body.innerHTML;
    
    document.body.innerHTML = `
      <h2>Leaves Report</h2>
      <p>Generated on: ${new Date().toLocaleDateString()}</p>
      ${printContent}
    `;
    
    window.print();
    document.body.innerHTML = originalContent;
    window.location.reload();
  }

  updateColumnVisibility(): void {
    // This method is triggered when column visibility checkboxes are changed
    // No need to do anything as the template uses *ngIf to show/hide columns
  }

  private convertToCSV(objArray: any[]): string {
    const array = typeof objArray !== 'object' ? JSON.parse(objArray) : objArray;
    let str = '';
    let row = '';

    // Add headers
    for (const index in objArray[0]) {
      row += index + ',';
    }
    row = row.slice(0, -1);
    str += row + '\r\n';

    // Add data
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
    
    // Set column widths and formats
    if (ws['!ref']) {
      const range = XLSX.utils.decode_range(ws['!ref']);
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const header = XLSX.utils.encode_col(C) + "1";
        if (ws[header]?.v?.includes('Date')) {
          // Apply date format to date columns
          for (let R = range.s.r + 1; R <= range.e.r; ++R) {
            const cell = XLSX.utils.encode_col(C) + (R + 1);
            if (!ws[cell]) continue;
            ws[cell].z = 'yyyy-mm-dd';
          }
        }
      }
    }
  
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
  
  initializeForm() {
    this.leaveForm = this.fb.group({
      employeeId: ['', Validators.required],
      leaveTypeId: ['', Validators.required],
      session: ['Full Day', Validators.required],
      startDate: ['', Validators.required],
      reason: ['', Validators.required],
          endDate: ['', Validators.required],  // Add this line

          maxLeaveCount: [1, [Validators.required, Validators.min(1)]], // Add this line

    });
  }
  updateEndDate() {
  const startDate = this.leaveForm.get('startDate')?.value;
  if (startDate) {
    // Set end date same as start date by default
    this.leaveForm.patchValue({
      endDate: startDate
    });
  }
}
  
  // Search methods
  applySearch() {
    if (!this.searchQuery) {
      this.applyFilters(); // If search is empty, just apply other filters
      return;
    }

    const query = this.searchQuery.toLowerCase();
    this.filteredLeaves = this.leaves.filter(leave => {
      // Search across multiple fields
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
  
loadInitialData() {
  // Get current user
  this.currentUser = this.authService.currentUserValue;
  this.currentUserName = this.currentUser?.displayName || this.currentUser?.username || '';
  
  this.leaveService.getLeaveTypes().subscribe((types) => {
    this.leaveTypes = types;
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
    }
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

}

  

  // Update the applyFilters method to include search
  applyFilters() {
    const filters = this.filterForm.value;
    
    let filtered = [...this.leaves];
    
    // Apply form filters
    filtered = filtered.filter(leave => {
      // Employee filter
      if (filters.employee && leave.employeeId !== filters.employee) {
        return false;
      }
      
      // Status filter
      if (filters.status && leave.status !== filters.status) {
        return false;
      }
      
      // Leave type filter
      if (filters.leaveType && leave.leaveTypeId !== filters.leaveType) {
        return false;
      }
      
      // Approval status filter
      if (filters.approvalStatus && leave.approvalStatus !== filters.approvalStatus) {
        return false;
      }
      
      // Date range filter
      if (filters.startDate && filters.endDate) {
        const leaveDate = new Date(leave.startDate);
        const filterStartDate = new Date(filters.startDate);
        const filterEndDate = new Date(filters.endDate);
        
        filterStartDate.setHours(0, 0, 0, 0);
        filterEndDate.setHours(23, 59, 59, 999);
        
        if (leaveDate < filterStartDate || leaveDate > filterEndDate) {
          return false;
        }
      } else if (filters.startDate) {
        const leaveDate = new Date(leave.startDate);
        const filterStartDate = new Date(filters.startDate);
        filterStartDate.setHours(0, 0, 0, 0);
        
        if (leaveDate < filterStartDate) {
          return false;
        }
      } else if (filters.endDate) {
        const leaveDate = new Date(leave.startDate);
        const filterEndDate = new Date(filters.endDate);
        filterEndDate.setHours(23, 59, 59, 999);
        
        if (leaveDate > filterEndDate) {
          return false;
        }
      }
      
      return true;
    });
    
    // Apply search if there's a query
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(leave => {
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
  
    this.filteredLeaves = filtered;
  }
  
  // Template and import methods
  async downloadTemplate() {
    const templateData = [
      {
        'Leave Type': 'Annual Leave',
        'Employee': 'john.doe@example.com',
        'Start Date': '2023-01-01',
        'Session': 'Full Day',
        'Reason': 'Vacation',
        'Status': 'pending'
      }
    ];
  
    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(templateData);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leaves Template');
    XLSX.writeFile(wb, 'leaves_template.xlsx');
  }
  

  
 
  

  
  resetSelections() {
    this.selectedLeaves = {};
    this.selectAll = false;
  }
  
  toggleSelectAll() {
    this.selectAll = !this.selectAll;
    
    this.leaves.forEach(leave => {
      // Allow selecting all leaves regardless of status
      this.selectedLeaves[leave.id] = this.selectAll;
    });
  }
  
  toggleSelect(leaveId: string) {
    this.selectedLeaves[leaveId] = !this.selectedLeaves[leaveId];
    
    // Update selectAll status
    this.selectAll = this.leaves.every(leave => this.selectedLeaves[leave.id]);
  }
  
  get hasSelectedLeaves(): boolean {
    return Object.values(this.selectedLeaves).some(selected => selected);
  }
  
  get selectedLeaveCount(): number {
    return Object.values(this.selectedLeaves).filter(selected => selected).length;
  }
  
  // Get selected leaves with specific status
  getSelectedLeavesByStatus(status: string): number {
    const selectedIds = Object.entries(this.selectedLeaves)
      .filter(([_, selected]) => selected)
      .map(([id, _]) => id);
      
    return this.leaves.filter(leave => 
      selectedIds.includes(leave.id) && leave.status === status
    ).length;
  }
  
  // Get all selected leaves that are not of a specific status
  getSelectedLeavesNotOfStatus(status: string): number {
    const selectedIds = Object.entries(this.selectedLeaves)
      .filter(([_, selected]) => selected)
      .map(([id, _]) => id);
      
    return this.leaves.filter(leave => 
      selectedIds.includes(leave.id) && leave.status !== status
    ).length;
  }
  openImportModal() {
    this.resetImportState();
    const modalElement = document.getElementById('importModal');
    if (modalElement) {
      const modal = new Modal(modalElement);
      modal.show();
    }
  }

  
  resetImportState() {
    this.importData = [];
    this.importFile = null;
    this.importMessage = '';
    this.importInProgress = false;
    this.importProgress = 0;
  }



  private async readExcelFile(file: File): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const fileReader = new FileReader();
      
      fileReader.onload = (e: any) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          
          if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            reject(new Error('No sheets found in the Excel file'));
            return;
          }
          
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, {
            defval: null,
            raw: false
          });
          
          resolve(jsonData);
        } catch (parseError) {
          reject(new Error('Could not parse Excel file. Please check the file format.'));
        }
      };
      
      fileReader.onerror = () => {
        reject(new Error('Error reading file'));
      };
      
      fileReader.readAsArrayBuffer(file);
    });
  }

  /**
   * Validates the imported data structure
   */
  private validateImportData(data: any[]): boolean {
    // Check if data array exists and has items
    if (!Array.isArray(data) || data.length === 0) {
      return false;
    }
    
    // Check if required columns exist
    // Replace with your actual required columns
    const requiredColumns = ['name', 'date', 'status'];
    const firstRow = data[0];
    
    return requiredColumns.every(col => 
      Object.keys(firstRow).some(key => 
        key.toLowerCase().includes(col.toLowerCase())
      )
    );
  }




  
  private async processImportedData(data: any[]) {
    if (!data.length) {
      throw new Error('File is empty');
    }
  
    // Transform and validate data
    const leavesToImport = data.map((item, index) => {
      // Ensure employeeName exists
      const employeeName = item['Employee Name'] || item['Employee'];
      if (!employeeName) {
        throw new Error(`Missing employee name in row ${index + 1}`);
      }
  
      // Ensure leaveType exists
      const leaveType = item['Leave Type'] || 'Annual';
      
      // Validate start date
      let startDate: Date;
      try {
        startDate = new Date(item['Start Date']);
        if (isNaN(startDate.getTime())) {
          throw new Error('Invalid date');
        }
      } catch (e) {
        throw new Error(`Invalid start date in row ${index + 1}`);
      }
  
      // Validate end date (default to start date if not provided)
      let endDate: Date;
      if (item['End Date']) {
        try {
          endDate = new Date(item['End Date']);
          if (isNaN(endDate.getTime())) {
            endDate = new Date(startDate);
          }
        } catch (e) {
          endDate = new Date(startDate);
        }
      } else {
        endDate = new Date(startDate);
      }
  
      return {
        employeeName,
        leaveType,
          endDate: new Date(item['End Date'] || item['Start Date']),  // Default to start date if not provided

        reason: item['Reason'] || '',
        status: 'pending',
        // Add other required fields with defaults if needed
        session: item['Session'] || 'Full Day',
        createdAt: new Date()
      };
    });
  
    // Save to database
    for (const leave of leavesToImport) {
      try {
        await this.leaveService.addLeave(leave);
      } catch (error) {
        console.error('Error saving leave:', leave, error);
        throw new Error(`Failed to save leave for ${leave.employeeName}`);
      }
    }
  }


// Fix for handleFileInput to prevent null reference issues
handleFileInput(event: Event): void {
  const input = event.target as HTMLInputElement;
  const files = input.files;
  
  if (!files || files.length === 0) {
    this.selectedFile = null;
    return;
  }

  this.selectedFile = files[0];
  this.importError = null;
  
  // Validate file type
  const validExtensions = ['.xlsx', '.xls', '.csv'];
  const fileName = this.selectedFile.name.toLowerCase();
  
  if (!validExtensions.some(ext => fileName.endsWith(ext))) {
    this.importError = 'Please select a valid Excel or CSV file.';
    this.clearFileSelection();
    return;
  }
}

  clearFileSelection(): void {
    this.selectedFile = null;
    if (this.fileInput && this.fileInput.nativeElement) {
      this.fileInput.nativeElement.value = '';
    }
  }

  

  getImportDataKeys(): string[] {
    if (this.importData.length === 0) return [];
    return Object.keys(this.importData[0]);
  }
  async importLeaves() {
    if (!this.importData.length || !this.importFile) return;
    
    // Validate all records first
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
    
    // Proceed with import...
  }

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
        
        // Convert to JSON with proper date handling
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          raw: false,
          dateNF: 'yyyy-mm-dd', // Specify the desired date format
          defval: null
        });
  
        // Process the imported data
        this.importData = jsonData.map((item: any) => {
          // Ensure required fields exist
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
  // Add this new helper method
  private formatExcelDate(excelDate: any): string {
    if (!excelDate) return '';
    
    // If already a Date object
    if (excelDate instanceof Date) {
      return excelDate.toISOString().split('T')[0];
    }
    
    // If Excel serial number
    if (typeof excelDate === 'number') {
      const date = new Date((excelDate - (25567 + 2)) * 86400 * 1000);
      return date.toISOString().split('T')[0];
    }
    
    // If string, try to parse
    if (typeof excelDate === 'string') {
      // Try common date formats
      const formats = [
        'yyyy-MM-dd', 'MM/dd/yyyy', 'dd-MM-yyyy',
        'yyyy/MM/dd', 'MM-dd-yyyy', 'dd/MM/yyyy'
      ];
      
      for (const formatStr of formats) {
        try {
          const parsed = parse(excelDate, formatStr, new Date());
          if (isValid(parsed)) {
            // Use dateFormat (the alias) instead of format
            return dateFormat(parsed, 'yyyy-MM-dd');
          }
        } catch (e) {
          // Just try the next format
          continue;
        }
      }
    }
    
    // Fallback - return as-is
    return String(excelDate);
  }
  
  private parseExcelDate(excelDate: any): Date | null {
    if (!excelDate) return null;
    
    // If already a Date object
    if (excelDate instanceof Date) {
      return excelDate;
    }
    
    // If Excel serial number (number of days since 1900-01-01)
    if (typeof excelDate === 'number') {
      return new Date((excelDate - (25567 + 2)) * 86400 * 1000);
    }
    
    // If string, try parsing different formats
    if (typeof excelDate === 'string') {
      // Try ISO format first
      const isoDate = new Date(excelDate);
      if (!isNaN(isoDate.getTime())) return isoDate;
      
      // Try common date formats
      const formats = [
        'yyyy-MM-dd', 'MM/dd/yyyy', 'dd-MM-yyyy',
        'yyyy/MM/dd', 'MM-dd-yyyy', 'dd/MM/yyyy',
        'EEE MMM dd yyyy HH:mm:ss' // For formats like 'Sun Jan 01 2023 05:30:00'
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
  
 
  openBulkApproveModal() {
    if (!this.hasSelectedLeaves) {
      alert('Please select at least one leave request to approve');
      return;
    }
    
    this.bulkApproveForm.reset({
      approvedBy: '',
      note: ''
    });
    
    this.bulkApproveModalInstance = new Modal(this.bulkApproveModalRef.nativeElement);
    this.bulkApproveModalInstance.show();
  }
  
  openBulkRejectModal() {
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
    if (this.bulkApproveForm.invalid) {
      this.bulkApproveForm.markAllAsTouched();
      return;
    }
    
    const { approvedBy, note } = this.bulkApproveForm.value;
    const selectedLeaveIds = Object.entries(this.selectedLeaves)
      .filter(([_, selected]) => selected)
      .map(([id, _]) => id);
    
    try {
      await this.leaveService.bulkApproveLeaves(selectedLeaveIds, approvedBy, note);
      this.bulkApproveModalInstance.hide();
      this.resetSelections();
    } catch (error) {
      console.error('Error approving leaves:', error);
    }
  }

  async rejectBulkLeaves() {
    if (this.bulkRejectForm.invalid) {
      this.bulkRejectForm.markAllAsTouched();
      return;
    }
    
    const { rejectedBy, note } = this.bulkRejectForm.value;
    const selectedLeaveIds = Object.entries(this.selectedLeaves)
      .filter(([_, selected]) => selected)
      .map(([id, _]) => id);
    
    try {
      await this.leaveService.bulkRejectLeaves(selectedLeaveIds, rejectedBy, note);
      this.bulkRejectModalInstance.hide();
      this.resetSelections();
    } catch (error) {
      console.error('Error rejecting leaves:', error);
    }
  }
getCurrentUserName(): string {
  const currentUser = this.authService.currentUserValue;
  if (!currentUser) return '';
  
  const user = this.users.find(u => u.id === this.leaveForm.get('employeeId')?.value);
  return user?.username || currentUser.displayName || '';
}
  toggleForm() {
    // Reset form before showing modal
    this.leaveForm.reset();
    const currentUser = this.authService.currentUserValue;

    if (currentUser) {
      // Find the user in the users list to get their ID
      const user = this.users.find(
        (u) => u.username === currentUser.displayName || u.email === currentUser.email
      );

      if (user) {
        this.leaveForm.patchValue({
          employeeId: user.id,
        });
      }
    }

    // Show modal instead of inline form
    const addLeaveModal = document.getElementById('addLeaveModal');
    if (addLeaveModal) {
      this.addLeaveModalInstance = new Modal(addLeaveModal);
      this.addLeaveModalInstance.show();
    }
  }
async submitForm() {
  if (this.leaveForm.invalid) {
    this.leaveForm.markAllAsTouched();
    return;
  }

  const formValue = this.leaveForm.value;
  
  // Find selected user and leave type
  const selectedUser = this.users.find(user => user.id === formValue.employeeId);
  const selectedLeaveType = this.leaveTypes.find(type => type.id === formValue.leaveTypeId);

  if (!selectedUser || !selectedLeaveType) {
    alert('Please select valid employee and leave type.');
    return;
  }

  // Prepare leave data
  const leaveData = {
    referenceNo: 'LV' + new Date().getFullYear() + '/' + Math.floor(Math.random() * 100000),
    leaveType: selectedLeaveType.leaveType,
    leaveTypeId: selectedLeaveType.id,
    maxLeaveCount: formValue.maxLeaveCount, // Add this line
    employeeName: selectedUser.username,
    employeeId: selectedUser.id,
    startDate: new Date(formValue.startDate),
    session: formValue.session,
    reason: formValue.reason,
        endDate: new Date(formValue.endDate),  // Add this line

    status: 'pending',
    createdAt: new Date(),
  };

  try {
    // Add the leave
    await this.leaveService.addLeave(leaveData);
    
    // Reset form and close modal
    this.leaveForm.reset();
    if (this.addLeaveModalInstance) {
      this.addLeaveModalInstance.hide();
    }
    
    // Refresh the list
    this.loadInitialData();
  } catch (error) {
    console.error('Error submitting leave:', error);
    alert('Failed to submit leave. Please try again.');
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

  openStatusModal(leave: any) {
    this.selectedLeave = leave;
    this.statusForm.patchValue({
      status: leave.status,
      note: leave.note || '',
      approvedBy: leave.approvedBy || ''
    });
    
    // Update validation based on current status
    const approvedByControl = this.statusForm.get('approvedBy');
    if (leave.status === 'approved') {
      approvedByControl?.setValidators([Validators.required]);
    } else {
      approvedByControl?.clearValidators();
    }
    approvedByControl?.updateValueAndValidity();

    this.bootstrapModalInstance = new Modal(this.statusModalRef.nativeElement);
    this.bootstrapModalInstance.show();
  }

// Update leave method
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

    // Update in Firestore
    await this.leaveService.updateLeave(this.selectedLeaveId, updates);
    
    // Update in local array
    const index = this.leaves.findIndex(l => l.id === this.selectedLeaveId);
    if (index !== -1) {
      this.leaves[index] = { 
        ...this.leaves[index], 
        ...updates,
        leaveType: this.leaveTypes.find(t => t.id === formValue.leaveTypeId)?.leaveType || ''
      };
      this.filteredLeaves = [...this.leaves];
    }

    // Close modal and reset
    this.editLeaveModalInstance.hide();
    this.selectedLeaveId = null;
    
    // Show success message
    alert('Leave updated successfully!');
  } catch (error) {
    console.error('Error updating leave:', error);
    alert('Failed to update leave. Please try again.');
  }
}
  async updateStatus() {
    if (this.statusForm.invalid) return;

    const { status, note, approvedBy, approvalLeaveType } = this.statusForm.value;
    try {
      if (status === 'approved' || status === 'rejected') {
        if (!approvedBy) {
          alert('Please select an approver/rejector');
          return;
        }
        await this.leaveService.updateLeaveStatus(
          this.selectedLeave.id, 
          status, 
          note, 
          approvedBy,
          this.selectedLeave.status // Pass current status for activity log
        );
      } else {
        await this.leaveService.updateLeaveStatus(
          this.selectedLeave.id, 
          status, 
          note,
          '',
          this.selectedLeave.status
        );
      }
      this.bootstrapModalInstance.hide();
    } catch (error) {
      console.error('Error updating leave status:', error);
    }
    const updateData = {
      status,
      note,
      approvedBy,
      approvalLeaveType: status === 'approved' ? approvalLeaveType : null
    };
  }

  async viewActivity(leave: any) {
    this.selectedLeave = leave;
    
    try {
      // Show loading state
      this.leaveActivities = [];
      
      // Load activities from service
      this.leaveActivities = await this.leaveService.getLeaveActivities(leave.id);
      
      // If no activities found, create a default one
      if (this.leaveActivities.length === 0) {
        this.leaveActivities = [{
          action: 'created',
          status: leave.status || 'pending',
          timestamp: leave.createdAt || new Date(),
          by: leave.employeeName || 'System',
          note: 'Leave request was created'
        }];
      }
      
      // Format activities for display
      this.leaveActivities = this.leaveActivities.map(activity => ({
        ...activity,
        action: this.formatActivityAction(activity),
        timestamp: activity.timestamp instanceof Date ? activity.timestamp : 
                  activity.timestamp?.toDate ? activity.timestamp.toDate() : 
                  new Date(activity.timestamp)
      }));
  
      // Show the modal
      if (!this.activityModalInstance) {
        this.activityModalInstance = new Modal(this.activityModalRef.nativeElement);
      }
      this.activityModalInstance.show();
    } catch (error) {
      console.error('Error loading activities:', error);
      // Create a fallback activity if there's an error
      this.leaveActivities = [{
        action: 'error',
        status: leave.status || 'unknown',
        timestamp: new Date(),
        by: 'System',
        note: 'Failed to load activity history. Showing current status.'
      }];
      
      if (!this.activityModalInstance) {
        this.activityModalInstance = new Modal(this.activityModalRef.nativeElement);
      }
      this.activityModalInstance.show();
    }
  }
  private hideModal(): void {
    const modalElement = document.getElementById('importModal');
    if (modalElement) {
      const modal = Modal.getInstance(modalElement);
      if (modal) {
        modal.hide();
      }
    }
  }
  
  formatDate(excelDate: string | Date, formatString: string = 'yyyy-MM-dd'): string {
    if (!excelDate) return '';
    
    // If date is already a Date object
    if (excelDate instanceof Date) {
      return dateFormat(excelDate, 'yyyy-MM-dd');
    }
    
    // If date is a string, parse it using appropriate format
    try {
      // Adjust the format parameter according to your actual date string format
      // For example, if the input is '2023-01-01', the format should be 'yyyy-MM-dd'
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
  private formatActivityAction(activity: any): string {
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

  // New methods for filtering functionality
  toggleFilterSidebar() {
    this.showFilterSidebar = !this.showFilterSidebar;
  }


  resetFilters() {
    this.filterForm.reset();
    this.filteredLeaves = [...this.leaves];
  }

  applyDateFilter(filter: string) {
    const today = new Date();
    const startDate = new Date();
    const endDate = new Date();
    
    switch (filter) {
      case 'today':
        // Today
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
        
      case 'yesterday':
        // Yesterday
        startDate.setDate(today.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setDate(today.getDate() - 1);
        endDate.setHours(23, 59, 59, 999);
        break;
        
      case 'last7days':
        // Last 7 days
        startDate.setDate(today.getDate() - 6);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
        
      case 'last30days':
        // Last 30 days
        startDate.setDate(today.getDate() - 29);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
        
      case 'thisMonth':
        // This month
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setMonth(today.getMonth() + 1, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
        
      case 'lastMonth':
        // Last month
        startDate.setMonth(today.getMonth() - 1, 1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setMonth(today.getMonth(), 0);
        endDate.setHours(23, 59, 59, 999);
        break;
        
      case 'thisYear':
        // This year
        startDate.setMonth(0, 1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setMonth(11, 31);
        endDate.setHours(23, 59, 59, 999);
        break;
        
      case 'lastYear':
        // Last year
        startDate.setFullYear(today.getFullYear() - 1, 0, 1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setFullYear(today.getFullYear() - 1, 11, 31);
        endDate.setHours(23, 59, 59, 999);
        break;
        
      case 'currentFinancialYear':
        // Current financial year (assuming April to March)
        if (today.getMonth() >= 3) { // April or later
          startDate.setFullYear(today.getFullYear(), 3, 1);
        } else { // January to March
          startDate.setFullYear(today.getFullYear() - 1, 3, 1);
        }
        startDate.setHours(0, 0, 0, 0);
        
        if (today.getMonth() >= 3) { // April or later
          endDate.setFullYear(today.getFullYear() + 1, 2, 31);
        } else { // January to March
          endDate.setFullYear(today.getFullYear(), 2, 31);
        }
        endDate.setHours(23, 59, 59, 999);
        break;
        
      case 'lastFinancialYear':
        // Last financial year (assuming April to March)
        if (today.getMonth() >= 3) { // April or later
          startDate.setFullYear(today.getFullYear() - 1, 3, 1);
          endDate.setFullYear(today.getFullYear(), 2, 31);
        } else { // January to March
          startDate.setFullYear(today.getFullYear() - 2, 3, 1);
          endDate.setFullYear(today.getFullYear() - 1, 2, 31);
        }
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
        
      case 'customRange':
        // Don't set anything, just clear the current dates to let user select custom range
        this.filterForm.patchValue({
          startDate: '',
          endDate: ''
        });
        return;
    }
    
    // Format dates for form input (YYYY-MM-DD)
    const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    // Update form values
    this.filterForm.patchValue({
      startDate: formatDate(startDate),
      endDate: formatDate(endDate)
    });
    
    // Apply the filters with the new date range
    this.applyFilters();
  }
  calculateLeaveDetails(leave: any): any {
  // Calculate days taken
  const startDate = leave.startDate instanceof Date ? leave.startDate : new Date(leave.startDate);
  const endDate = leave.endDate instanceof Date ? leave.endDate : new Date(leave.endDate || leave.startDate);
  
  // Calculate difference in days
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  let daysTaken = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both dates
  
  // Adjust for half-day sessions
  if (leave.session === 'First Half' || leave.session === 'Second Half') {
    daysTaken = daysTaken - 0.5;
  }
  
  // Calculate remaining leave
  const maxLeaveCount = leave.maxLeaveCount || 0;
  const remainingLeave = maxLeaveCount - daysTaken;
  
  return {
    ...leave,
    daysTaken,
    remainingLeave: remainingLeave > 0 ? remainingLeave : 0
  };
}
  calculateLeaveDays(startDate: Date, endDate: Date, session: string): number {
    if (!startDate || !endDate) return 0;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Calculate difference in days
    const diffTime = Math.abs(end.getTime() - start.getTime());
    let days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end dates
    
    // Adjust for session
    if (session === 'First Half' || session === 'Second Half') {
      days = days - 0.5;
    }
    
    return days;
  }  
  formatDisplayDate(dateValue: any): string {
    if (!dateValue) return '';
    
    try {
      // If already formatted correctly
      if (typeof dateValue === 'string' && dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return dateValue;
      }
      
      // If Date object
      if (dateValue instanceof Date) {
        return format(dateValue, 'yyyy-MM-dd');
      }
      
      // Try to parse
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