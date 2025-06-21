import { Component, OnInit, OnDestroy } from '@angular/core';
import { AttendanceService, Attendance } from '../../services/attendance.service';
import { UserService, User } from '../../services/user.service';
import { Subscription, Observable } from 'rxjs';
import { Papa } from 'ngx-papaparse';
import { AuthService } from '../../auth.service';

export interface Shift {
  shiftName: string;
  startTime: string;
  endTime: string;
  description: string;
  shiftType: string;
  holiday: string;
  id?: string;
}

interface ImportResults {
  total: number;
  success: number;
  errors: string[];
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
  showEditAttendanceModal = false;
  isUpdatingAttendance = false;
  currentAttendanceId = '';

  editAttendanceData: any = {
    employee: '',
    clockInTime: '',
    clockOutTime: '',
    shift: '',
    ipAddress: '',
    clockInNote: '',
    clockOutNote: '',
    location: null,
    imageUrl: ''
  };
  
  showClockInModal = false;
  showClockOutSuccessModal = false;
  showClockOutModal = false;
  showImageModal = false;
  selectedImageUrl = '';
  workDuration: string = '';
  isClockingOut = false;
  currentTime: Date = new Date();

  attendanceFilterDate: string = '';
  filteredAttendances: Attendance[] = [];
  clockOutData = {
    employee: '',
    shift: '',
    clockOutNote: '',
    latitude: '',
    longitude: '',
    locationAddress: '',
    ipAddress: '',
    imageFile: null as File | null,
    imagePreview: ''
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
  importResults: ImportResults | null = null;

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

  // Update the clockInData interface
  clockInData = {
    employee: '',
    shift: '',
    ipAddress: '',
    clockInNote: '',
    latitude: '',
    longitude: '',
    locationAddress: '',
    imageFile: null as File | null,
    imagePreview: ''
  };

  constructor(
    private attendanceService: AttendanceService,
    private userService: UserService,
    private authService: AuthService,
    private papa: Papa
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

  openImageModal(imageUrl: string) {
    this.selectedImageUrl = imageUrl;
    this.showImageModal = true;
  }

  closeImageModal() {
    this.showImageModal = false;
    this.selectedImageUrl = '';
  }

  ngOnDestroy(): void {
    if (this.shiftSub) this.shiftSub.unsubscribe();
    if (this.attendanceSub) this.attendanceSub.unsubscribe();
    if (this.usersSub) this.usersSub.unsubscribe();
    if (this.currentUserSub) this.currentUserSub.unsubscribe();
  }

  getCurrentLocationForClockOut() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          this.clockOutData.latitude = position.coords.latitude.toString();
          this.clockOutData.longitude = position.coords.longitude.toString();
          this.getAddressFromCoordinatesForClockOut(
            position.coords.latitude, 
            position.coords.longitude
          );
        },
        (error) => {
          console.error('Error getting location:', error);
          alert('Unable to get your location. Please ensure location services are enabled.');
        },
        { enableHighAccuracy: true }
      );
    } else {
      alert('Geolocation is not supported by this browser.');
    }
  }

  async getAddressFromCoordinatesForClockOut(lat: number, lng: number) {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
      );
      const data = await response.json();
      
      if (data.display_name) {
        this.clockOutData.locationAddress = data.display_name;
      } else {
        this.clockOutData.locationAddress = 'Address not available';
      }
    } catch (error) {
      console.error('Error getting address:', error);
      this.clockOutData.locationAddress = 'Could not retrieve address';
    }
  }

  clearClockOutLocation() {
    this.clockOutData.latitude = '';
    this.clockOutData.longitude = '';
    this.clockOutData.locationAddress = '';
  }

  onClockOutImageSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.clockOutData.imageFile = file;
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.clockOutData.imagePreview = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  getCurrentUser() {
    // Subscribe to current user from UserService
    this.currentUserSub = this.userService.getCurrentUser().subscribe((user: User | null) => {
      if (user) {
        this.currentUser = user;
        console.log('Current user loaded:', this.currentUser); // Debug log
        this.checkUserClockStatus();
      } else {
        console.log('No current user found'); // Debug log
        this.currentUser = null;
      }
    });
  }

  getCurrentLocation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          this.clockInData.latitude = position.coords.latitude.toString();
          this.clockInData.longitude = position.coords.longitude.toString();
          
          // Reverse geocode to get address (using Nominatim as example)
          this.getAddressFromCoordinates(
            position.coords.latitude, 
            position.coords.longitude
          );
        },
        (error) => {
          console.error('Error getting location:', error);
          alert('Unable to get your location. Please ensure location services are enabled.');
        },
        { enableHighAccuracy: true }
      );
    } else {
      alert('Geolocation is not supported by this browser.');
    }
  }

  async getAddressFromCoordinates(lat: number, lng: number) {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
      );
      const data = await response.json();
      
      if (data.display_name) {
        this.clockInData.locationAddress = data.display_name;
      } else {
        this.clockInData.locationAddress = 'Address not available';
      }
    } catch (error) {
      console.error('Error getting address:', error);
      this.clockInData.locationAddress = 'Could not retrieve address';
    }
  }

  clearLocation() {
    this.clockInData.latitude = '';
    this.clockInData.longitude = '';
    this.clockInData.locationAddress = '';
  }

  // Convert ISO date to datetime-local format
  toDateTimeLocal(isoDate: string | undefined): string {
    if (!isoDate) return '';
    const date = new Date(isoDate);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  openEditAttendanceModal(attendance: any) {
    this.currentAttendanceId = attendance.id || '';
    this.editAttendanceData = {
      employee: attendance.employee,
      clockInTime: attendance.clockInTime,
      clockOutTime: attendance.clockOutTime || '',
      shift: attendance.shift,
      ipAddress: attendance.ipAddress || '',
      clockInNote: attendance.clockInNote || '',
      clockOutNote: attendance.clockOutNote || '',
      location: attendance.location || null,
      imageUrl: attendance.imageUrl || ''
    };
    this.showEditAttendanceModal = true;
  }

  closeEditAttendanceModal() {
    this.showEditAttendanceModal = false;
    this.currentAttendanceId = '';
    this.isUpdatingAttendance = false;
    this.editAttendanceData = {
      employee: '',
      clockInTime: '',
      clockOutTime: '',
      shift: '',
      ipAddress: '',
      clockInNote: '',
      clockOutNote: '',
      location: null,
      imageUrl: ''
    };
  }

  updateAttendance() {
    if (!this.currentAttendanceId) return;
    
    this.isUpdatingAttendance = true;
    
    // Prepare the data to update
    const updatedData = {
      employee: this.editAttendanceData.employee,
      clockInTime: this.editAttendanceData.clockInTime,
      clockOutTime: this.editAttendanceData.clockOutTime || '',
      shift: this.editAttendanceData.shift,
      ipAddress: this.editAttendanceData.ipAddress,
      clockInNote: this.editAttendanceData.clockInNote,
      clockOutNote: this.editAttendanceData.clockOutNote,
      location: this.editAttendanceData.location,
      imageUrl: this.editAttendanceData.imageUrl
    };
    
    this.attendanceService.updateAttendance(this.currentAttendanceId, updatedData)
      .then(() => {
        this.closeEditAttendanceModal();
        this.loadAttendance(); // Refresh the data
      })
      .catch(error => {
        console.error('Error updating attendance:', error);
        alert('Error updating attendance. Please try again.');
        this.isUpdatingAttendance = false;
      });
  }

  deleteAttendance(attendance: any) {
    if (!attendance.id) return;
    
    if (confirm(`Are you sure you want to delete this attendance record for ${attendance.employee}?`)) {
      this.attendanceService.deleteAttendance(attendance.id)
        .then(() => {
          this.loadAttendance(); // Refresh the data
        })
        .catch((error: any) => {
          console.error('Error deleting attendance:', error);
          alert('Error deleting attendance. Please try again.');
        });
    }
  }

  onImageSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.clockInData.imageFile = file;
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.clockInData.imagePreview = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  openClockOutModal(attendance: Attendance) {
    console.log('Opening modal...');
    this.currentAttendance = attendance;
    this.clockOutData = {
      employee: attendance.employee,
      shift: attendance.shift,
      clockOutNote: '',
      latitude: '',
      longitude: '',
      locationAddress: '',
      ipAddress: this.clockInData.ipAddress || '',
      imageFile: null,
      imagePreview: ''
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
    
    // Auto-fill employee name with current user's details
    const userDisplayName = this.currentUser?.displayName || 
                           this.currentUser?.username || 
                           this.currentUser?.email ||
                           '';
    
    console.log('Auto-filling employee name:', userDisplayName); // Debug log
    
    // Set up clockInData with current user's information
    this.clockInData = {
      employee: userDisplayName,
      shift: this.currentUser?.shift || '', // Auto-fill shift if available in user data
      ipAddress: '',
      clockInNote: '',
      latitude: '',
      longitude: '',
      locationAddress: '',
      imageFile: null,
      imagePreview: ''
    };
    
    this.showClockInModal = true;
  }

  closeClockInModal() {
    this.showClockInModal = false;
  }

  async submitClockIn() {
    if (this.isClockingIn) return;
    
    if (!this.clockInData.employee) {
      alert('Please select an employee');
      return;
    }
    
    if (!this.clockInData.shift) {
      alert('Please select a shift');
      return;
    }
    
    if (!this.clockInData.imageFile) {
      alert('Please upload an image');
      return;
    }
    
    this.isClockingIn = true;

    const selectedShift = this.shifts.find(s => s.shiftName === this.clockInData.shift);
    if (!selectedShift) {
      alert('Selected shift not found');
      this.isClockingIn = false;
      return;
    }

    // Upload image first
    let imageUrl = '';
    try {
      // Call your image upload service
      imageUrl = await this.attendanceService.uploadImage(this.clockInData.imageFile);
      
      // Create the attendance record
      const newClockIn: any = {
        employee: this.clockInData.employee,
        clockInTime: new Date().toISOString(),
        clockOutTime: '',
        shift: this.clockInData.shift,
        ipAddress: this.clockInData.ipAddress || '',
        clockInNote: this.clockInData.clockInNote || '',
        clockOutNote: '',
        imageUrl: imageUrl // Make sure this is stored
      };

      // Add location data if available
      if (this.clockInData.latitude) {
        newClockIn.location = {
          latitude: this.clockInData.latitude,
          longitude: this.clockInData.longitude,
          address: this.clockInData.locationAddress || ''
        };
      }

      // Save to database
      const response = await this.attendanceService.addAttendance(newClockIn);
      
      this.currentAttendance = {
        ...newClockIn,
        id: response.id
      };
      this.clockedInShift = selectedShift;
      
      localStorage.setItem('currentAttendance', JSON.stringify(this.currentAttendance));
      
      this.closeClockInModal();
      this.showClockInSuccessModal = true;
    } catch (error) {
      console.error('Error during clock in:', error);
      alert('Error during clock in. Please try again.');
    } finally {
      this.isClockingIn = false;
    }
  }

  // Also make sure the closeClockInSuccessModal method updates the state properly
  closeClockInSuccessModal() {
    this.showClockInSuccessModal = false;
    // Force check user clock status again to refresh UI
    this.checkUserClockStatus();
  }

  async submitClockOut() {
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

    // Upload image first if exists
    let imageUrl = this.currentAttendance.imageUrl || '';
    if (this.clockOutData.imageFile) {
      try {
        imageUrl = await this.attendanceService.uploadImage(this.clockOutData.imageFile);
      } catch (error) {
        console.error('Error uploading image:', error);
        this.isClockingOut = false;
        alert('Error uploading image. Please try again.');
        return;
      }
    }
    
    const updatedAttendance: any = {
      ...this.currentAttendance,
      clockOutTime: clockOutTime,
      clockOutNote: this.clockOutData.clockOutNote || '',
      ipAddress: this.currentAttendance.ipAddress || this.clockOutData.ipAddress || '',
      imageUrl: imageUrl,
      clockOutLocation: this.clockOutData.latitude ? {
        latitude: this.clockOutData.latitude,
        longitude: this.clockOutData.longitude,
        address: this.clockOutData.locationAddress || ''
      } : null,
      clockOutImageUrl: imageUrl
    };

    // Add location data if available
    if (this.clockOutData.latitude) {
      updatedAttendance.location = {
        latitude: this.clockOutData.latitude,
        longitude: this.clockOutData.longitude,
        address: this.clockOutData.locationAddress || ''
      };
    }

    this.attendanceService.updateAttendance(this.currentAttendance.id, updatedAttendance)
      .then(() => {
        // Clear current attendance and update UI
        this.currentAttendance = null;
        this.clockOutData = {
          employee: '',
          shift: '',
          clockOutNote: '',
          latitude: '',
          longitude: '',
          locationAddress: '',
          ipAddress: '',
          imageFile: null,
          imagePreview: ''
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

  async uploadFile() {
    if (!this.selectedFile) {
      this.importError = 'Please select a file to import';
      return;
    }

    this.isImporting = true;
    this.importError = '';
    this.importSuccess = '';
    this.importResults = null;

    try {
      if (this.selectedFile.name.endsWith('.csv')) {
        await this.parseCSVFile(this.selectedFile);
      } else if (this.selectedFile.name.endsWith('.xlsx') || this.selectedFile.name.endsWith('.xls')) {
        await this.parseExcelFile(this.selectedFile);
      } else {
        this.importError = 'Unsupported file format. Please upload a CSV or Excel file.';
      }
    } catch (error) {
      console.error('Error importing file:', error);
      this.importError = 'Error processing file. Please check the format and try again.';
    } finally {
      this.isImporting = false;
    }
  }

  private parseCSVFile(file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      this.papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          this.processImportData(results.data);
          resolve();
        },
        error: (error) => {
          reject(error);
        }
      });
    });
  }

  private async parseExcelFile(file: File): Promise<void> {
    // In a real app, you would use a library like xlsx to parse Excel files
    // This is a simplified version for demonstration
    this.importError = 'Excel file parsing not implemented in this demo. Please use CSV.';
    throw new Error('Excel parsing not implemented');
  }

  private async processImportData(data: any[]) {
    const results = {
      total: data.length,
      success: 0,
      errors: [] as string[]
    };

    for (const [index, row] of data.entries()) {
      try {
        // Validate required fields
        if (!row['Email']) {
          throw new Error('Missing email');
        }

        if (!row['Clock in time']) {
          throw new Error('Missing clock in time');
        }

        // Find user by email
        const user = this.users.find(u => u.email === row['Email']);
        if (!user) {
          throw new Error('User not found');
        }

        // Parse dates
        const clockInTime = new Date(row['Clock in time']);
        if (isNaN(clockInTime.getTime())) {
          throw new Error('Invalid clock in time format');
        }

        let clockOutTime = null;
        if (row['Clock out time']) {
          clockOutTime = new Date(row['Clock out time']);
          if (isNaN(clockOutTime.getTime())) {
            throw new Error('Invalid clock out time format');
          }
        }

        // Prepare attendance record
        const attendance: any = {
          employee: user.username || user.email,
          clockInTime: clockInTime.toISOString(),
          clockOutTime: clockOutTime ? clockOutTime.toISOString() : '',
          shift: user.shift || '',
          ipAddress: row['IP Address'] || '',
          clockInNote: row['Clock in note'] || '',
          clockOutNote: row['Clock out note'] || ''
        };

        // Save to database
        await this.attendanceService.addAttendance(attendance);
        results.success++;
      } catch (error) {
        const errorMsg = `Row ${index + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        results.errors.push(errorMsg);
        console.error(`Error processing row ${index + 1}:`, error);
      }
    }

    this.importResults = results;
    if (results.success > 0) {
      this.importSuccess = `Successfully imported ${results.success} of ${results.total} records`;
      // Refresh attendance data
      this.loadAttendance();
    } else {
      this.importError = `Failed to import any records. ${results.errors[0] || 'Unknown error'}`;
    }
  }

  downloadTemplateFile() {
    // CSV header row
    let csvContent = "Email,Clock in time,Clock out time,Clock in note,Clock out note,IP Address\n";
    
    // Example data row
    const exampleDate = new Date();
    const clockInTime = exampleDate.toISOString().replace('T', ' ').replace(/\..+/, '');
    
    exampleDate.setHours(exampleDate.getHours() + 8);
    const clockOutTime = exampleDate.toISOString().replace('T', ' ').replace(/\..+/, '');
    
    csvContent += `user@example.com,${clockInTime},${clockOutTime},Morning check-in,Left office,192.168.1.1\n`;
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', 'attendance_template.csv');
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
  }
}