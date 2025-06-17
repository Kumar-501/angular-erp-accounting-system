import { Component, OnInit, OnDestroy } from '@angular/core';
import { AttendanceService, Attendance } from '../../services/attendance.service';
import { UserService } from '../../services/user.service';
import { Subscription, Observable } from 'rxjs';

// Define User interface locally since it's not exported from user.service
export interface User {
  id?: string;
  username: string;
  email: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  shift?: string;
}

export interface Shift {
  shiftName: string;
  startTime: string;
  endTime: string;
  description: string;
  shiftType: string;
  holiday: string;

  id?: string;
}

export interface ImportColumn {
  number: number;
  name: string;
  required: boolean;
  description: string;
  format?: string;
}

@Component({
  selector: 'app-attendance',
  templateUrl: './attendance.component.html',
  styleUrls: ['./attendance.component.scss'],
})
export class AttendanceComponent implements OnInit, OnDestroy {
  activeTab = 'shifts';
  showModal = false;
  showAttendanceModal = false;
  showClockInModal = false;
  showClockOutSuccessModal = false;
  showClockOutModal = false;
workDuration: string = '';
isClockingOut = false;
currentTime: Date = new Date(); // Initialize current time

  attendanceFilterDate: string = '';
filteredAttendances: Attendance[] = [];
clockOutData = {
  employee: '',
  shift: '',
  clockOutNote: ''
};

  showClockInSuccessModal = false;
  isEditMode = false;
  currentShiftId = '';
  currentUser: User | null = null;
  clockedInShift: any = null;
  isClockingIn = false;

  shifts: Shift[] = [];
  attendances: Attendance[] = [];
  users: User[] = [];
  userAttendances: Attendance[] = [];
  currentAttendance: Attendance | null = null;

  // For attendance by shift
  selectedDate: string = new Date().toISOString().split('T')[0];
  presentEmployees: any[] = [];
  absentEmployees: any[] = [];
  allEmployees: User[] = [];

  // For attendance by date
  dateRange: string = '';
  startDate: string = '';
  endDate: string = '';
  dateWiseAttendance: any[] = [];
  dateRangeText: string = '';

  // For import attendance
  selectedFile: File | null = null;
  importColumns: ImportColumn[] = [
    { number: 1, name: 'Email', required: true, description: 'Email id of the user' },
    { number: 2, name: 'Clock in time', required: true, description: 'Clock in time in "Y-m-d H:i:s" format', format: '(2025-04-15 04:45:14)' },
    { number: 3, name: 'Clock out time', required: false, description: 'Clock out time in "Y-m-d H:i:s" format', format: '(2025-04-15 04:45:14)' },
    { number: 4, name: 'Clock in note', required: false, description: 'Clock in note' },
    { number: 5, name: 'Clock out note', required: false, description: 'Clock out note' },
    { number: 6, name: 'IP Address', required: false, description: 'IP Address' }
  ];
  importError: string = '';
  importSuccess: string = '';
  isImporting: boolean = false;

  shiftSub!: Subscription;
  attendanceSub!: Subscription;
  usersSub!: Subscription;
  currentUserSub!: Subscription;

  newShift: Shift = {
    shiftName: '',
    startTime: '',
    endTime: '',
    description: '',
    shiftType: 'Fixed shift',
    holiday: '',
 
  };

  newAttendance: Attendance = {
    employee: '',
    clockInTime: '',
    clockOutTime: '',
    shift: '',
    ipAddress: '',
    clockInNote: '',
    clockOutNote: '',
  };

  clockInData = {
    employee: '',
    shift: '',
    ipAddress: '',
    clockInNote: ''
  };



  constructor(
    private attendanceService: AttendanceService,
    private userService: UserService
  ) {}

  ngOnInit(): void {
    // Check local storage first
    const storedAttendance = localStorage.getItem('currentAttendance');
    if (storedAttendance) {
      try {
        this.currentAttendance = JSON.parse(storedAttendance);
      } catch (e) {
        console.error('Error parsing stored attendance', e);
        localStorage.removeItem('currentAttendance');
      }
    }
  
    this.loadShifts();
    this.loadAttendance();
    this.loadUsers();
    this.loadAttendanceByShift();
    this.getCurrentUser();
    
    setInterval(() => {
      this.currentTime = new Date();
    }, 1000);
  
    // Initialize date range with current week
    const currentDate = new Date();
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    this.startDate = startOfWeek.toISOString().split('T')[0];
    this.endDate = endOfWeek.toISOString().split('T')[0];
    this.dateRangeText = this.formatDateRangeText(startOfWeek, endOfWeek);
    this.loadAttendanceByDate();
  }

  ngOnDestroy(): void {
    if (this.shiftSub) this.shiftSub.unsubscribe();
    if (this.attendanceSub) this.attendanceSub.unsubscribe();
    if (this.usersSub) this.usersSub.unsubscribe();
    if (this.currentUserSub) this.currentUserSub.unsubscribe();
  }

  getCurrentUser() {
    // Fix: Ensure getCurrentUser returns an Observable<User>
    const userObservable: Observable<User> = this.userService.getCurrentUser() as unknown as Observable<User>;
    this.currentUserSub = userObservable.subscribe((user: User) => {
      if (user) {
        this.currentUser = user;
        this.checkUserClockStatus();
      }
    });
  }
  openClockOutModal(attendance: Attendance) {
    console.log('Opening modal...');
    this.currentAttendance = attendance;
    this.clockOutData = {
      employee: attendance.employee,
      shift: attendance.shift,
      clockOutNote: ''
    };
    this.showClockOutModal = true;
    console.log('Modal should be visible now');
  }
  
  closeClockOutModal() {
    this.showClockOutModal = false;
  }
  checkUserClockStatus() {
    // First check local storage for active attendance
    const storedAttendance = localStorage.getItem('currentAttendance');
    if (storedAttendance) {
      try {
        this.currentAttendance = JSON.parse(storedAttendance);
        this.clockedInShift = this.shifts.find(s => s.shiftName === this.currentAttendance?.shift);
        return;
      } catch (e) {
        console.error('Error parsing stored attendance', e);
        localStorage.removeItem('currentAttendance');
      }
    }
  
    // Fall back to checking database if nothing in local storage
    if (!this.currentUser) return;
  
    const userIdentifier = this.currentUser.username || this.currentUser.email;
    const today = new Date().toISOString().split('T')[0];
  
    // Find today's attendance records for this user
    this.userAttendances = this.attendances.filter(a => {
      if (!a.clockInTime) return false;
      
      const clockInDate = new Date(a.clockInTime).toISOString().split('T')[0];
      return a.employee === userIdentifier && clockInDate === today;
    });
  
    // Check for active attendance (clocked in but not clocked out)
    const activeAttendance = this.userAttendances.find(a => !a.clockOutTime);
  
    if (activeAttendance) {
      this.currentAttendance = activeAttendance;
      this.clockedInShift = this.shifts.find(s => s.shiftName === activeAttendance.shift);
      // Store in local storage
      localStorage.setItem('currentAttendance', JSON.stringify(this.currentAttendance));
    } else {
      this.currentAttendance = null;
      this.clockedInShift = null;
    }
  }

  setActiveTab(tab: string) {
    this.activeTab = tab;
    if (tab === 'byShift') {
      this.loadAttendanceByShift();
    } else if (tab === 'byDate') {
      this.loadAttendanceByDate();
    } else if (tab === 'all') {
      this.filteredAttendances = [...this.attendances];
    }
  }

  // Date range selection changed
  onDateRangeChange() {
    if (this.startDate && this.endDate) {
      const start = new Date(this.startDate);
      const end = new Date(this.endDate);
      this.dateRangeText = this.formatDateRangeText(start, end);
      this.loadAttendanceByDate();
    }
  }

  formatDateRangeText(start: Date, end: Date): string {
    const formatOptions: Intl.DateTimeFormatOptions = { month: '2-digit', day: '2-digit', year: 'numeric' };
    const startStr = start.toLocaleDateString('en-US', formatOptions);
    const endStr = end.toLocaleDateString('en-US', formatOptions);
    return `${startStr} - ${endStr}`;
  }

  loadAttendanceByDate() {
    if (!this.startDate || !this.endDate) return;

    const start = new Date(this.startDate);
    const end = new Date(this.endDate);
    
    // Get all dates in the range
    const dateArray: Date[] = [];
    let currentDate = new Date(start);
    
    while (currentDate <= end) {
      dateArray.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Process attendance data for each date
    this.dateWiseAttendance = dateArray.map(date => {
      const dateStr = date.toISOString().split('T')[0];
      const formattedDate = date.toLocaleDateString('en-US', { 
        month: '2-digit', 
        day: '2-digit', 
        year: 'numeric' 
      });

      // Count present employees for this date
      const presentCount = this.attendances.filter(a => {
        if (!a.clockInTime) return false;
        const clockInDate = new Date(a.clockInTime).toISOString().split('T')[0];
        return clockInDate === dateStr;
      }).length;

      // Count absent employees (total employees - present)
      const absentCount = Math.max(0, this.allEmployees.length - presentCount);

      return {
        date: formattedDate,
        present: presentCount,
        absent: absentCount
      };
    });
  }

  loadAttendanceByShift() {
    if (!this.selectedDate) return;

    this.presentEmployees = [];
    this.absentEmployees = [];

    const selectedDateObj = new Date(this.selectedDate);
    const selectedDateStr = selectedDateObj.toISOString().split('T')[0];

    this.presentEmployees = this.attendances.filter(a => {
      if (!a.clockInTime) return false;
      const clockInDate = new Date(a.clockInTime).toISOString().split('T')[0];
      return clockInDate === selectedDateStr;
    });

    const presentEmployeeNames = this.presentEmployees.map(e => e.employee);
    this.absentEmployees = this.allEmployees
      .filter(user => {
        // Fix: Make sure we don't access non-existent properties
        const userName = user.username || user.email;
        return !presentEmployeeNames.includes(userName);
      })
      .map(user => ({
        // Fix: Handle missing properties properly
        name: user.username || user.email,
        shift: user.shift || 'Not assigned'
      }));
  }

  loadUsers() {
    // Fix: Ensure getUsers returns an Observable<User[]>
    const usersObservable: Observable<User[]> = this.userService.getUsers() as Observable<User[]>;
    this.usersSub = usersObservable.subscribe(users => {
      this.allEmployees = users;
      this.users = users;
      this.loadAttendanceByShift();
      this.loadAttendanceByDate();
    });
  }

  loadShifts() {
    this.shiftSub = this.attendanceService.getShiftsRealTime().subscribe((data) => {
      this.shifts = data;
      this.checkUserClockStatus();
    });
  }

  loadAttendance() {
    this.attendanceSub = this.attendanceService.getAttendanceRealTime().subscribe({
      next: (data) => {
        this.attendances = data;
        this.filteredAttendances = [...this.attendances];
        this.checkUserClockStatus(); // Always check status after loading data
        this.loadAttendanceByShift();
        this.loadAttendanceByDate();
      },
      error: (err) => console.error('Error loading attendance:', err)
    });
  }

  openModal() {
    this.resetForm();
    this.isEditMode = false;
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
    this.isEditMode = false;
    this.currentShiftId = '';
  }

  openEditModal(shift: Shift) {
    this.isEditMode = true;
    this.currentShiftId = shift.id || '';
    this.newShift = { ...shift };
    this.showModal = true;
  }

  openAttendanceModal() {
    this.resetAttendanceForm();
    this.getIPAddress();
    this.showAttendanceModal = true;
  }

  closeAttendanceModal() {
    this.showAttendanceModal = false;
  }
// Add these new methods for filtering
filterAttendanceByDate() {
  if (!this.attendanceFilterDate) {
    this.filteredAttendances = [...this.attendances];
    return;
  }

  this.filteredAttendances = this.attendances.filter(a => {
    if (!a.clockInTime) return false;
    const clockInDate = new Date(a.clockInTime).toISOString().split('T')[0];
    return clockInDate === this.attendanceFilterDate;
  });
}
  resetForm() {
    this.newShift = {
      shiftName: '',
      startTime: '',
      endTime: '',
      description: '',
      shiftType: 'Fixed shift',
      holiday: '',
   
    };
  }

  resetAttendanceForm() {
    this.newAttendance = {
      employee: '',
      clockInTime: '',
      clockOutTime: '',
      shift: '',
      ipAddress: '',
      clockInNote: '',
      clockOutNote: '',
    };
  }

  addShift() {
    if (
      this.newShift.shiftName &&
      this.newShift.startTime &&
      this.newShift.endTime &&
      this.newShift.shiftType
    ) {
      if (this.isEditMode && this.currentShiftId) {
        this.attendanceService.updateShift(this.currentShiftId, this.newShift).then(() => {
          this.closeModal();
        });
      } else {
        this.attendanceService.addShift(this.newShift).then(() => {
          this.closeModal();
        });
      }
    } else {
      alert('Please fill in all required fields.');
    }
  }



  addAttendance() {
    if (
      this.newAttendance.employee &&
      this.newAttendance.clockInTime &&
      this.newAttendance.shift
    ) {
      this.attendanceService.addAttendance(this.newAttendance).then(() => {
        this.closeAttendanceModal();
      });
    } else {
      alert('Please fill in all required fields.');
    }
  }

  getIPAddress() {
    fetch('https://api.ipify.org?format=json')
      .then((res) => res.json())
      .then((data) => {
        this.newAttendance.ipAddress = data.ip;
        this.clockInData.ipAddress = data.ip;
      });
  }

  openClockInModal() {
    this.getIPAddress();
    this.clockInData = {
      employee: this.currentUser?.username || this.currentUser?.email || '',
      shift: this.currentUser?.shift || '',
      ipAddress: '',
      clockInNote: ''
    };
    this.showClockInModal = true;
    
    // Update current time every second
  setInterval(() => {
      this.currentTime = new Date();
    }, 1000);
  }

  closeClockInModal() {
    this.showClockInModal = false;
  }


// In your attendance.component.ts
// Update the submitClockIn method to set currentAttendance after successful clock-in

submitClockIn() {
  if (this.isClockingIn) return;
  
  if (!this.clockInData.employee) {
    alert('Please select an employee');
    return;
  }
  
  if (!this.clockInData.shift) {
    alert('Please select a shift');
    return;
  }
  
  this.isClockingIn = true;

  const selectedShift = this.shifts.find(s => s.shiftName === this.clockInData.shift);
  if (!selectedShift) {
    alert('Selected shift not found');
    this.isClockingIn = false;
    return;
  }

  const newClockIn: Attendance = {
    employee: this.clockInData.employee,
    clockInTime: new Date().toISOString(),
    clockOutTime: '',
    shift: this.clockInData.shift,
    ipAddress: this.clockInData.ipAddress || '',
    clockInNote: this.clockInData.clockInNote || '',
    clockOutNote: ''
  };

  this.attendanceService.addAttendance(newClockIn).then((response) => {
    // Update local state immediately
    this.currentAttendance = {
      ...newClockIn,
      id: response.id
    };
    this.clockedInShift = selectedShift;
    
    // Store in local storage
    localStorage.setItem('currentAttendance', JSON.stringify(this.currentAttendance));
    
    this.closeClockInModal();
    this.showClockInSuccessModal = true;
    this.isClockingIn = false;
  }).catch(error => {
    console.error('Error clocking in:', error);
    alert('Error clocking in. Please try again.');
    this.isClockingIn = false;
  });
}

// Also make sure the closeClockInSuccessModal method updates the state properly
closeClockInSuccessModal() {
  this.showClockInSuccessModal = false;
  // Force check user clock status again to refresh UI
  this.checkUserClockStatus();
}


submitClockOut() {
  if (this.isClockingOut || !this.currentAttendance || !this.currentAttendance.id) {
    return;
  }
  
  this.isClockingOut = true;
  const clockOutTime = new Date().toISOString();
  
  // Calculate work duration
  if (this.currentAttendance.clockInTime) {
    const start = new Date(this.currentAttendance.clockInTime);
    const end = new Date(clockOutTime);
    const diffMs = end.getTime() - start.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const hours = Math.floor(diffSec / 3600);
    const minutes = Math.floor((diffSec % 3600) / 60);
    const seconds = diffSec % 60;
    this.workDuration = [
      hours.toString().padStart(2, '0'),
      minutes.toString().padStart(2, '0'),
      seconds.toString().padStart(2, '0')
    ].join(':');
  }
  
  const updatedAttendance = {
    ...this.currentAttendance,
    clockOutTime: clockOutTime,
    clockOutNote: this.clockOutData.clockOutNote || '',
    ipAddress: this.currentAttendance.ipAddress || this.clockInData.ipAddress || ''
  };

  this.attendanceService.updateAttendance(this.currentAttendance.id, updatedAttendance)
    .then(() => {
      // Clear current attendance and update UI
      this.currentAttendance = null;
      this.clockOutData = {
        employee: '',
        shift: '',
        clockOutNote: ''
      };
      
      // Remove from local storage
      localStorage.removeItem('currentAttendance');
      
      // Close modals and show success
      this.closeClockOutModal();
      this.showClockOutSuccessModal = true;
      this.isClockingOut = false;
      
      // Refresh attendance data
      this.loadAttendance();
    })
    .catch(error => {
      console.error('Error clocking out:', error);
      alert('Error clocking out. Please try again.');
      this.isClockingOut = false;
    });
}

closeClockOutSuccessModal() {
  this.showClockOutSuccessModal = false;
  // Reset current attendance
  this.currentAttendance = null;
  // Force check user clock status again to refresh UI
  this.checkUserClockStatus();
}

  // Import functionality
  onFileSelected(event: any) {
    this.selectedFile = event.target.files[0];
    this.importError = '';
    this.importSuccess = '';
  }

  // Alias for onFileSelected to match the method name in the template
  onFileSelect(event: any) {
    this.onFileSelected(event);
  }

  downloadTemplateFile() {
    // Create CSV content
    let csvContent = "Email,Clock in time,Clock out time,Clock in note,Clock out note,IP Address\n";
    csvContent += "user@example.com,2025-04-15 09:00:00,2025-04-15 17:00:00,Morning check-in,Left office,192.168.1.1\n";
    
    // Create a blob and download it
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', 'attendance_import_template.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  submitImport() {
    if (!this.selectedFile) {
      this.importError = 'Please select a file to import';
      return;
    }

    this.isImporting = true;
    this.importError = '';
    this.importSuccess = '';

    // Check file type (should be CSV or Excel)
    const fileExt = this.selectedFile.name.split('.').pop()?.toLowerCase();
    if (fileExt !== 'csv' && fileExt !== 'xlsx' && fileExt !== 'xls') {
      this.importError = 'Invalid file format. Please upload a CSV or Excel file.';
      this.isImporting = false;
      return;
    }

    // In a real application, you would use a file reading library to parse the CSV/Excel
    // Here we'll simulate the import process
    setTimeout(() => {
      this.importSuccess = `Successfully imported attendance data from ${this.selectedFile?.name}`;
      this.isImporting = false;
      
      // Reset file input
      this.selectedFile = null;
      const fileInput = document.getElementById('fileImport') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }
    }, 1500);
  }

  // Alias for submitImport to match the method name in the template
  uploadFile() {
    this.submitImport();
  }

  calculateWorkDuration(clockIn: string | undefined, clockOut: string | undefined): string {
    if (!clockIn || !clockOut) return '-';
    
    try {
      const start = new Date(clockIn);
      const end = new Date(clockOut);
      const diffMs = end.getTime() - start.getTime();
      
      // Calculate hours, minutes, seconds
      const diffSec = Math.floor(diffMs / 1000);
      const hours = Math.floor(diffSec / 3600);
      const minutes = Math.floor((diffSec % 3600) / 60);
      const seconds = diffSec % 60;
      
      // Format as HH:MM:SS
      return [
        hours.toString().padStart(2, '0'),
        minutes.toString().padStart(2, '0'),
        seconds.toString().padStart(2, '0')
      ].join(':');
    } catch (e) {
      console.error('Error calculating work duration:', e);
      return '-';
    }
  }
  deleteShift(shift: Shift) {
    if (!shift.id) return;
    
    if (confirm(`Are you sure you want to delete the shift "${shift.shiftName}"?`)) {
      this.attendanceService.deleteShift(shift.id)
        .then(() => {
          console.log('Shift deleted successfully');
        })
        .catch(error => {
          console.error('Error deleting shift:', error);
          alert('Error deleting shift. Please try again.');
        });
    }
  }
  formatDateTime(dateTimeStr: string | undefined): string {
    if (!dateTimeStr) return '';
    
    try {
      const date = new Date(dateTimeStr);
      return date.toLocaleString();
    } catch (e) {
      console.error('Error formatting date:', e);
      return '';
    }
  }}