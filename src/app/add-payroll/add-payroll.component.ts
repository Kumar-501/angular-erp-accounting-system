import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { PayrollService } from '../services/payroll.service';
import { LocationService } from '../services/location.service';
import { UserService } from '../services/user.service';
import { AttendanceService } from '../services/attendance.service';
import { Subscription } from 'rxjs';
import {
  Firestore,
  collection,
  addDoc,
  onSnapshot,
  doc,
  updateDoc,
} from '@angular/fire/firestore';

@Component({
  selector: 'app-add-payroll',
  templateUrl: './add-payroll.component.html',
  styleUrls: ['./add-payroll.component.scss']
})
export class AddPayrollComponent implements OnInit, OnDestroy {
  payrollGroup = {
    name: '',
    status: 'Draft' as 'Draft' | 'Final',
    location: 'All locations',
    monthYear: '',
    employees: [] as any[]
  };

  selectedEmployee: any = null;
  selectedEmployeeId: string = '';
  locations: any[] = [];
  users: any[] = [];
  attendanceRecords: any[] = [];
  attendanceStats: any = {
    presentDays: 0,
    absentDays: 0,
    leaveDays: 0,
    totalWorkHours: 0
  };
  
  // Subscriptions
  private attendanceSubscription: Subscription | null = null;
  private userSubscription: Subscription | null = null;
  private locationSubscription: Subscription | null = null;
  
  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private payrollService: PayrollService,
    private locationService: LocationService,
    private userService: UserService,
    private attendanceService: AttendanceService,
    private firestore: Firestore
  ) {}

  ngOnInit(): void {
    // Check for existing payroll data in localStorage (passed from payroll list)
    const storedPayrollData = this.payrollService.getCurrentPayrollData();
    
    if (storedPayrollData) {
      // Update payroll group with stored data
      this.payrollGroup.location = storedPayrollData.location || 'All locations';
      this.payrollGroup.monthYear = storedPayrollData.monthYear || this.getCurrentMonthYear();
      this.payrollGroup.name = `Payroll for ${this.formatMonthYear(this.payrollGroup.monthYear)}`;
      
      // Clear stored data after using it
      // Clear stored data after using it
      this.payrollService['clearCurrentPayrollData']();
    } else {
      // Set default values if no stored data
      const currentDate = new Date();
      const month = currentDate.toLocaleString('default', { month: 'long' });
      const year = currentDate.getFullYear();
      this.payrollGroup.name = `Payroll for ${month} ${year}`;
      this.payrollGroup.monthYear = `${year}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}`;
    }
    
    this.fetchLocations();
    this.fetchUsers();
    this.subscribeToAttendance();
    
    // Check for employee selection from URL params
    this.route.queryParams.subscribe(params => {
      if (params['employeeId']) {
        this.selectedEmployeeId = params['employeeId'];
        // Will fetch employee details once users are loaded
      }
    });
  }

  ngOnDestroy(): void {
    // Clean up subscriptions to prevent memory leaks
    if (this.attendanceSubscription) {
      this.attendanceSubscription.unsubscribe();
    }
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
    if (this.locationSubscription) {
      this.locationSubscription.unsubscribe();
    }
  }

  getCurrentMonthYear(): string {
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  }

  formatMonthYear(monthYearStr: string): string {
    if (!monthYearStr) return '';
    
    try {
      const [year, month] = monthYearStr.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
      return `${date.toLocaleString('default', { month: 'long' })} ${year}`;
    } catch (error) {
      console.error('Error formatting month/year:', error);
      return monthYearStr;
    }
  }

  fetchLocations() {
    this.locationSubscription = this.locationService.getLocations().subscribe(locations => {
      this.locations = locations;
    });
  }

  fetchUsers() {
    this.userSubscription = this.userService.getUsers().subscribe(users => {
      this.users = users;
      
      // If we have a selected employee ID from URL params, fetch details after users are loaded
      if (this.selectedEmployeeId) {
        this.fetchEmployeeDetails();
      }
    });
  }

  subscribeToAttendance() {
    // Use real-time listener for attendance records
    this.attendanceSubscription = this.attendanceService.getAttendanceRealTime().subscribe(records => {
      this.attendanceRecords = records;
      console.log('Attendance records updated:', records.length);
      
      // If an employee is already selected, refresh their attendance data
      if (this.selectedEmployee) {
        this.loadEmployeeAttendanceData(this.selectedEmployee);
      }
    });
  }

  // Method to handle employee selection from dropdown
  fetchEmployeeDetails() {
    if (this.selectedEmployeeId) {
      const selectedUser = this.users.find(user => user.id === this.selectedEmployeeId);
      if (selectedUser) {
        this.loadEmployeeData(selectedUser);
      }
    } else {
      this.selectedEmployee = null;
    }
  }

  loadEmployeeData(employee: any) {
    // Check if the employee is already in the payroll group
    const existingEmployeeData = this.payrollGroup.employees.find(emp => emp.id === employee.id);
    
    this.selectedEmployee = {
      ...employee,
      totalWorkDuration: existingEmployeeData?.totalWorkDuration || 0,
      durationUnit: existingEmployeeData?.durationUnit || 'Month',
      amountPerUnit: existingEmployeeData?.amountPerUnit || 0,
      totalAmount: existingEmployeeData?.totalAmount || 0,
      earnings: existingEmployeeData?.earnings || [],
      deductions: existingEmployeeData?.deductions || [],
      earningsTotal: existingEmployeeData?.earningsTotal || 0,
      deductionsTotal: existingEmployeeData?.deductionsTotal || 0,
      grossAmount: existingEmployeeData?.grossAmount || 0,
      note: existingEmployeeData?.note || ''
    };

    // Load attendance data for the selected employee
    this.loadEmployeeAttendanceData(employee);

    // Add default earning and deduction entries if needed
    if (!this.selectedEmployee.earnings || this.selectedEmployee.earnings.length === 0) {
      this.addEarning();
    }
    if (!this.selectedEmployee.deductions || this.selectedEmployee.deductions.length === 0) {
      this.addDeduction();
    }
  }

  loadEmployeeAttendanceData(employee: any) {
    // Get all attendance records for the selected employee
    const empAttendance = this.getEmployeeAttendance(employee.id);
    
    // Filter records for the current month and year if monthYear is selected
    let filteredAttendance = empAttendance;
    if (this.payrollGroup.monthYear) {
      const [year, month] = this.payrollGroup.monthYear.split('-');
      const monthStart = new Date(parseInt(year), parseInt(month) - 1, 1);
      const monthEnd = new Date(parseInt(year), parseInt(month), 0); // Last day of month
      
      filteredAttendance = empAttendance.filter(record => {
        if (!record.clockInTime) return false;
        const recordDate = new Date(record.clockInTime);
        return recordDate >= monthStart && recordDate <= monthEnd;
      });
    }
    
    // Calculate work hours and attendance days precisely from records
    const workDuration = this.calculateWorkDuration(filteredAttendance);
    const attendanceDays = this.calculateAttendanceDays(filteredAttendance);
    const leaveDays = this.calculateLeaveDays(employee.id);
    
    // Calculate working days in the selected month
    const [year, month] = this.payrollGroup.monthYear.split('-');
    const workingDaysInMonth = this.calculateWorkingDays(parseInt(year), parseInt(month) - 1);
    
    // Calculate absent days (working days minus present days and leave days)
    const absentDays = Math.max(0, workingDaysInMonth - attendanceDays - leaveDays);
    
    // Update attendance stats
    this.attendanceStats = {
      presentDays: attendanceDays,
      absentDays: absentDays,
      leaveDays: leaveDays,
      totalWorkHours: workDuration
    };

    // Update the selected employee with attendance data
    this.selectedEmployee = {
      ...this.selectedEmployee,
      workDuration: workDuration,
      attendance: attendanceDays,
      leaves: leaveDays
    };

    // Use simple whole number for total work duration instead of fraction
    // Based on the duration unit selected
    if (this.selectedEmployee.durationUnit === 'Day') {
      // For day-based calculations, use the actual present days
      this.selectedEmployee.totalWorkDuration = attendanceDays;
    } else if (this.selectedEmployee.durationUnit === 'Month') {
      // For month-based calculations, use 1 (one month)
      this.selectedEmployee.totalWorkDuration = 1;  // Simplified calculation - just use whole month
    } else if (this.selectedEmployee.durationUnit === 'Year') {
      // For year-based, use 1/12 (one month in a year)
      this.selectedEmployee.totalWorkDuration = 1;  // Simplified to entire duration
    }

    // Recalculate totals
    this.calculateTotals();
  }

  // Calculate working days in a month (excluding weekends)
  calculateWorkingDays(year: number, month: number): number {
    const date = new Date(year, month, 1);
    let workDays = 0;
    
    while (date.getMonth() === month) {
      // 0 = Sunday, 6 = Saturday
      const day = date.getDay();
      if (day !== 0 && day !== 6) {
        workDays++;
      }
      date.setDate(date.getDate() + 1);
    }
    
    return workDays;
  }

  getEmployeeAttendance(employeeId: string): any[] {
    // Improved method to get employee attendance records
    if (!this.attendanceRecords || !employeeId) return [];
    
    // Check for matches in employee, employeeName, employeeId, or username fields
    return this.attendanceRecords.filter(record => {
      // Check all possible ID/name fields that could be used in attendance records
      const matchesId = record.employee === employeeId || 
                        record.employeeId === employeeId;
      
      // Find the corresponding user to match by username if needed
      const user = this.users.find(u => u.id === employeeId);
      const username = user ? (user.username || user.name) : '';
      
      const matchesName = record.employeeName === username || 
                         record.username === username ||
                         record.employee === username;
                         
      return matchesId || matchesName;
    });
  }

  calculateWorkDuration(attendanceRecords: any[]): number {
    let totalHours = 0;
    
    attendanceRecords.forEach(record => {
      if (record.clockInTime && record.clockOutTime) {
        const clockIn = new Date(record.clockInTime);
        const clockOut = new Date(record.clockOutTime);
        // Make sure clockOut is after clockIn to avoid negative time
        if (clockOut > clockIn) {
          const hours = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
          totalHours += hours;
        }
      }
    });
    
    return parseFloat(totalHours.toFixed(2));
  }

  calculateAttendanceDays(attendanceRecords: any[]): number {
    const uniqueDays = new Set();
    
    attendanceRecords.forEach(record => {
      if (record.clockInTime) {
        const date = new Date(record.clockInTime).toDateString();
        uniqueDays.add(date);
      }
    });
    
    return uniqueDays.size;
  }

  calculateLeaveDays(employeeId: string): number {
    // In a real implementation, you would fetch leave data from your leave service
    // For now, we'll implement a basic calculation using sample data
    
    if (!this.payrollGroup.monthYear) return 0;
    
    const [year, month] = this.payrollGroup.monthYear.split('-');
    const monthStart = new Date(parseInt(year), parseInt(month) - 1, 1);
    const monthEnd = new Date(parseInt(year), parseInt(month), 0);
    
    // Here you would normally fetch leave records from your database
    // For this example, we're returning 0 as placeholder
    // In a real implementation, you would count leave records between monthStart and monthEnd
    
    return 0;
  }

  calculateRecordHours(record: any): string {
    if (record.clockInTime && record.clockOutTime) {
      const clockIn = new Date(record.clockInTime);
      const clockOut = new Date(record.clockOutTime);
      
      // Validate dates to prevent errors
      if (clockOut > clockIn) {
        const hours = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
        return hours.toFixed(2);
      }
    }
    return '0.00';
  }

  getMonthlyAttendanceSummary(employeeId: string): any {
    if (!this.payrollGroup.monthYear) {
      return {
        presentDays: 0,
        absentDays: 0,
        totalHours: 0,
        attendanceRecords: []
      };
    }
    
    const [year, month] = this.payrollGroup.monthYear.split('-');
    const monthStart = new Date(parseInt(year), parseInt(month) - 1, 1);
    const monthEnd = new Date(parseInt(year), parseInt(month), 0); // Last day of month
    
    // Filter attendance records for selected month and employee
    const monthlyAttendance = this.attendanceRecords.filter(record => {
      if (!record.clockInTime) return false;
      
      const recordDate = new Date(record.clockInTime);
      const isInSelectedMonth = recordDate >= monthStart && recordDate <= monthEnd;
      
      // Find the corresponding user to match by username if needed
      const user = this.users.find(u => u.id === employeeId);
      const username = user ? (user.username || user.name) : '';
      
      const matchesEmployee = (
        record.employee === employeeId || 
        record.employeeName === employeeId || 
        record.employeeId === employeeId ||
        record.employeeName === username ||
        record.username === username ||
        record.employee === username
      );
      
      return isInSelectedMonth && matchesEmployee;
    });
    
    // Calculate metrics
    const uniqueDays = new Set();
    let totalHours = 0;
    
    monthlyAttendance.forEach(record => {
      if (record.clockInTime) {
        const date = new Date(record.clockInTime).toDateString();
        uniqueDays.add(date);
      }
      
      if (record.clockInTime && record.clockOutTime) {
        const clockIn = new Date(record.clockInTime);
        const clockOut = new Date(record.clockOutTime);
        if (clockOut > clockIn) {
          const hours = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
          totalHours += hours;
        }
      }
    });
    
    // Calculate working days in month
    const workingDaysInMonth = this.calculateWorkingDays(parseInt(year), parseInt(month) - 1);
    const leaveDays = this.calculateLeaveDays(employeeId);
    
    return {
      presentDays: uniqueDays.size,
      absentDays: Math.max(0, workingDaysInMonth - uniqueDays.size - leaveDays),
      leaveDays: leaveDays,
      totalHours: parseFloat(totalHours.toFixed(2)),
      attendanceRecords: monthlyAttendance
    };
  }

  // Add the missing methods that are referenced in the template
  getWorkingDaysInSelectedMonth(): number {
    if (!this.payrollGroup.monthYear) return 0;
    
    const [year, month] = this.payrollGroup.monthYear.split('-');
    return this.calculateWorkingDays(parseInt(year), parseInt(month) - 1);
  }

  getAttendanceRate(): number {
    const workingDays = this.getWorkingDaysInSelectedMonth();
    if (workingDays === 0) return 0;
    
    const presentDays = this.attendanceStats.presentDays || 0;
    return Math.round((presentDays / workingDays) * 100);
  }

  addEarning() {
    if (!this.selectedEmployee.earnings) {
      this.selectedEmployee.earnings = [];
    }
    
    this.selectedEmployee.earnings.push({
      description: '',
      amountType: 'Fixed',
      amount: 0
    });
    
    this.calculateTotals();
  }

  removeEarning(index: number) {
    this.selectedEmployee.earnings.splice(index, 1);
    this.calculateTotals();
  }

  addDeduction() {
    if (!this.selectedEmployee.deductions) {
      this.selectedEmployee.deductions = [];
    }
    
    this.selectedEmployee.deductions.push({
      description: '',
      amountType: 'Fixed',
      amount: 0
    });
    
    this.calculateTotals();
  }

  removeDeduction(index: number) {
    this.selectedEmployee.deductions.splice(index, 1);
    this.calculateTotals();
  }

  calculateTotals() {
    if (!this.selectedEmployee) return;
    
    // Use whole number values for work duration to make calculation more straightforward
    const workDuration = parseInt(this.selectedEmployee.totalWorkDuration) || 0;
    const amountPerUnit = parseFloat(this.selectedEmployee.amountPerUnit) || 0;
    
    // Calculate basic salary
    this.selectedEmployee.totalAmount = parseFloat((workDuration * amountPerUnit).toFixed(2));
    
    let earningsTotal = 0;
    let deductionsTotal = 0;
    const basicSalary = this.selectedEmployee.totalAmount;
    
    if (this.selectedEmployee.earnings) {
      earningsTotal = this.selectedEmployee.earnings.reduce((sum: number, item: any) => {
        if (item.amountType === 'Percentage') {
          return sum + ((basicSalary * (parseFloat(item.amount) / 100)) || 0);
        } else {
          return sum + (parseFloat(item.amount) || 0);
        }
      }, 0);
    }
    
    if (this.selectedEmployee.deductions) {
      deductionsTotal = this.selectedEmployee.deductions.reduce((sum: number, item: any) => {
        if (item.amountType === 'Percentage') {
          return sum + (basicSalary * (parseFloat(item.amount) / 100) || 0);
        } else {
          return sum + (parseFloat(item.amount) || 0);
        }
      }, 0);
    }
    
    this.selectedEmployee.earningsTotal = parseFloat(earningsTotal.toFixed(2));
    this.selectedEmployee.deductionsTotal = parseFloat(deductionsTotal.toFixed(2));
    this.selectedEmployee.grossAmount = parseFloat((basicSalary + earningsTotal - deductionsTotal).toFixed(2));
  }

  saveEmployeeData() {
    if (!this.selectedEmployee) return;
    
    this.calculateTotals();
    
    // Create a clean copy of the employee data to save
    const employeeData = {
      id: this.selectedEmployee.id,
      name: this.selectedEmployee.name,
      username: this.selectedEmployee.username,
      totalWorkDuration: parseInt(this.selectedEmployee.totalWorkDuration) || 0,
      durationUnit: this.selectedEmployee.durationUnit,
      amountPerUnit: parseFloat(this.selectedEmployee.amountPerUnit) || 0,
      totalAmount: parseFloat(this.selectedEmployee.totalAmount) || 0,
      earnings: this.selectedEmployee.earnings || [],
      deductions: this.selectedEmployee.deductions || [],
      earningsTotal: parseFloat(this.selectedEmployee.earningsTotal) || 0,
      deductionsTotal: parseFloat(this.selectedEmployee.deductionsTotal) || 0,
      grossAmount: parseFloat(this.selectedEmployee.grossAmount) || 0,
      note: this.selectedEmployee.note,
      attendance: this.selectedEmployee.attendance || 0,
      leaves: this.selectedEmployee.leaves || 0
    };
    
    const existingIndex = this.payrollGroup.employees.findIndex(
      emp => emp.id === this.selectedEmployee.id
    );
    
    if (existingIndex >= 0) {
      this.payrollGroup.employees[existingIndex] = {...employeeData};
    } else {
      this.payrollGroup.employees.push({...employeeData});
    }
    
    alert(`Employee ${this.selectedEmployee.username || this.selectedEmployee.name} data saved to payroll.`);
  }

  editEmployee(index: number) {
    const employeeToEdit = this.payrollGroup.employees[index];
    this.selectedEmployee = {...employeeToEdit};
    // Update the selectedEmployeeId to match the UI
    this.selectedEmployeeId = this.selectedEmployee.id;
    
    if (!this.selectedEmployee.earnings) {
      this.selectedEmployee.earnings = [];
    }
    if (!this.selectedEmployee.deductions) {
      this.selectedEmployee.deductions = [];
    }
    
    if (this.selectedEmployee.earnings.length === 0) {
      this.addEarning();
    }
    if (this.selectedEmployee.deductions.length === 0) {
      this.addDeduction();
    }
    
    // Refresh attendance data when editing an employee
    this.loadEmployeeAttendanceData(this.selectedEmployee);
  }

  getTotalBasicSalary(): string {
    const total = this.payrollGroup.employees.reduce((sum, emp) => {
      return sum + (parseFloat(emp.totalAmount) || 0);
    }, 0);
    return total.toFixed(2);
  }

  getTotalEarnings(): string {
    const total = this.payrollGroup.employees.reduce((sum, emp) => {
      return sum + ((parseFloat(emp.earningsTotal) || 0));
    }, 0);
    return total.toFixed(2);
  }

  getTotalDeductions(): string {
    const total = this.payrollGroup.employees.reduce((sum, emp) => {
      return sum + (parseFloat(emp.deductionsTotal) || 0);
    }, 0);
    return total.toFixed(2);
  }

  getTotalGrossAmount(): string {
    const total = this.payrollGroup.employees.reduce((sum, emp) => {
      return sum + (parseFloat(emp.grossAmount) || 0);
    }, 0);
    return total.toFixed(2);
  }

  submitPayroll() {
    // Save current employee data if there's an active selection
    if (this.selectedEmployee) {
      this.saveEmployeeData();
    }
    
    if (!this.payrollGroup.name || this.payrollGroup.employees.length === 0) {
      alert('Please fill payroll name and add at least one employee.');
      return;
    }
    
    // Prepare payroll data for saving
    const payrollData = {
      name: this.payrollGroup.name,
      status: this.payrollGroup.status,
      location: this.payrollGroup.location,
      monthYear: this.payrollGroup.monthYear,
      employees: this.payrollGroup.employees.map(emp => ({
        id: emp.id,
        name: emp.name || '',
        username: emp.username || '',
        totalWorkDuration: parseInt(emp.totalWorkDuration) || 0,
        durationUnit: emp.durationUnit || 'Month',
        amountPerUnit: parseFloat(emp.amountPerUnit) || 0,
        totalAmount: parseFloat(emp.totalAmount) || 0,
        attendance: emp.attendance || 0,
        leaves: emp.leaves || 0,
        earnings: emp.earnings || [],
        deductions: emp.deductions || [],
        earningsTotal: parseFloat(emp.earningsTotal) || 0,
        deductionsTotal: parseFloat(emp.deductionsTotal) || 0,
        grossAmount: parseFloat(emp.grossAmount) || 0,
        note: emp.note || ''
      })),
      createdAt: new Date(),
      updatedAt: new Date(),
      totalAmount: parseFloat(this.getTotalBasicSalary()),
      totalEarnings: parseFloat(this.getTotalEarnings()),
      totalDeductions: parseFloat(this.getTotalDeductions()),
      totalGross: parseFloat(this.getTotalGrossAmount())
    };
    
    // Use the PayrollService to save to Firestore
    this.payrollService.addPayroll(payrollData)
      .then((docId) => {
        console.log('Payroll added successfully with ID:', docId);
        alert('Payroll saved successfully!');
        this.router.navigate(['/payroll']);
      })
      .catch((error) => {
        console.error('Error adding payroll:', error);
        alert('Failed to save payroll. Please try again.');
      });
  }
}