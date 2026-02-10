import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { PayrollService } from '../../services/payroll.service';
import { LocationService } from '../../services/location.service';
import { UserService } from '../../services/user.service';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Subscription } from 'rxjs';

interface Employee {
  id: string;
  name?: string;
  username?: string;
}

interface PayrollEmployee {
  id: string;
  name: string;
}

@Component({
  selector: 'app-payroll',
  templateUrl: './payroll.component.html',
  styleUrls: ['./payroll.component.scss']
})
export class PayrollComponent implements OnInit, OnDestroy {
  activeTab: string = 'payrolls';
  payrolls: any[] = [];
  locations: any[] = [];
  users: Employee[] = [];
  isEditing: boolean = false;
    filteredUsersForAddModal: Employee[] = [];

  editPayrollId: string = '';
  payrollData: any = {
    location: '',
    employees: [],
    monthYear: '',
    selectedEmployeeId: '',
    employeeDetails: []
  };
  private payrollSubscription!: Subscription;
  private usersSubscription!: Subscription;

  constructor(
    private payrollService: PayrollService,
    private locationService: LocationService,
    private userService: UserService,
    private router: Router,
    private modalService: NgbModal
  ) {}

  ngOnInit(): void {
    this.fetchLocations();
    this.fetchUsersAndPayrolls();
    
    // Set default month/year to current month
    const now = new Date();
    this.payrollData.monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  ngOnDestroy(): void {
    if (this.payrollSubscription) {
      this.payrollSubscription.unsubscribe();
    }
    if (this.usersSubscription) {
      this.usersSubscription.unsubscribe();
    }
  }

  fetchUsersAndPayrolls() {
    this.usersSubscription = this.userService.getUsers().subscribe(users => {
      this.users = users;
      this.setupPayrollListener();
    });
  }

  setupPayrollListener() {
    this.payrollSubscription = this.payrollService.getPayrollsRealTime().subscribe({
      next: (payrolls) => {
        this.payrolls = payrolls.map(payroll => {
          // Create employee details with proper names
          const employeeDetails = (payroll.employees || []).map((emp: any) => {
            if (typeof emp === 'string') {
              const user = this.users.find(u => u.id === emp);
              return {
                id: emp,
                name: user ? (user.username || user.name || emp) : emp
              };
            }
            return {
              id: emp.id,
              name: emp.name || emp.username || emp.id
            };
          });
  
          return {
            ...payroll,
            employeeDetails
          };
        });
      },
      error: (err) => console.error('Error in payroll subscription:', err)
    });
  }
  getEmployeeNames(employees: any): string {
    if (!employees) return 'Unknown';
    
   // Handle case where employees is already a string (pre-formatted names)
   if (typeof employees === 'string') {
    return employees;
  }
  
  return 'Unknown';
}


// Update the getFormattedEmployeeNames method
getFormattedEmployeeNames(employees: any[]): string {
  if (!employees || employees.length === 0) return 'No employees';
  
  return employees.map(emp => {
    // Handle different employee data structures
    if (typeof emp === 'string') {
      const user = this.users.find(u => u.id === emp);
      return user ? (user.username || user.name || 'Unknown') : emp;
    } else if (emp.id) {
      const user = this.users.find(u => u.id === emp.id);
      return user ? (user.username || user.name || emp.id) : (emp.name || emp.username || emp.id);
    }
    return 'Unknown';
  }).join(', ');
}

  getEmployeeName(employeeId: string): string {
    const user = this.users.find(u => u.id === employeeId);
    return user ? (user.username || user.name || 'Unknown') : 'Unknown';
  }

removeEmployee(employeeId: string) {
  this.payrollData.employees = this.payrollData.employees.filter((id: string) => id !== employeeId);
  // After removing an employee, refresh the dropdown list
  this.updateFilteredUsers();
}

  fetchLocations() {
    this.locationService.getLocations().subscribe(locations => {
      this.locations = locations;
    });
  }

  openAddPayrollModal(content: any) {
    this.isEditing = false;
    this.editPayrollId = '';
    this.payrollData = {
      location: '',
      employees: [],
      monthYear: this.getCurrentMonthYear(),
      selectedEmployeeId: '',
      employeeDetails: []
    };
    this.modalService.open(content, { size: 'lg' });
  }

// In payroll.component.ts

// ... inside the PayrollComponent class

// --- REPLACE this method with the updated version ---
openEditPayrollModal(content: any, payroll: any) {
  this.isEditing = true;
  this.editPayrollId = payroll.id;
  this.updateFilteredUsers();

  // --- THIS IS THE FIX ---
  // 1. Format the monthYear from the payroll object.
  // Firestore might store it as a Timestamp or a different string format.
  // We need to convert it to the 'yyyy-MM' string format for the input field.
  let formattedMonthYear = '';
  if (payroll.monthYear) {
    try {
      // Handles both 'yyyy-MM' strings and Date objects/Timestamps
      const date = new Date(payroll.monthYear.toDate ? payroll.monthYear.toDate() : payroll.monthYear);
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      formattedMonthYear = `${year}-${month}`;
    } catch (e) {
      console.error("Could not format monthYear:", payroll.monthYear, e);
      formattedMonthYear = this.getCurrentMonthYear(); // Fallback to current month
    }
  }

  // 2. Set the payrollData for the modal form.
  this.payrollData = {
    location: payroll.location,
    employees: payroll.employees ? [...payroll.employees] : [],
    monthYear: formattedMonthYear, // Use the correctly formatted date string
    selectedEmployeeId: '',
    employeeDetails: payroll.employeeDetails || []
  };
  // --- END OF FIX ---

  this.modalService.open(content, { size: 'lg' });
}
updateFilteredUsers(): void {
  if (this.isEditing && this.payrollData.employees) {
    // Filter out users who are already in the payroll's employee list
    this.filteredUsersForAddModal = this.users.filter(user => 
      !this.payrollData.employees.includes(user.id)
    );
  } else {
    // If adding a new payroll, all users are available
    this.filteredUsersForAddModal = [...this.users];
  }
}
  getCurrentMonthYear(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  submitPayroll() {
    if (!this.payrollData.location || !this.payrollData.monthYear) {
      alert('Please fill all required fields');
      return;
    }
  
    if (this.payrollData.selectedEmployeeId && !this.isEditing) {
      this.goToAddDetailedPayroll();
      return;
    }

    // For editing, add the selected employee to the existing list
    if (this.isEditing && this.payrollData.selectedEmployeeId) {
      if (!this.payrollData.employees.includes(this.payrollData.selectedEmployeeId)) {
        this.payrollData.employees.push(this.payrollData.selectedEmployeeId);
      }
      this.payrollData.selectedEmployeeId = '';
    }

    const payroll = {
      name: this.isEditing ? this.payrolls.find(p => p.id === this.editPayrollId)?.name : 
            'Payroll for ' + new Date(this.payrollData.monthYear).toLocaleString('default', { month: 'long', year: 'numeric' }),
      location: this.payrollData.location,
      // Use the existing employees array for editing, or add the selected employee for new payroll
      employees: this.isEditing ? this.payrollData.employees : 
                 this.payrollData.selectedEmployeeId ? [this.payrollData.selectedEmployeeId] : [],
      monthYear: this.payrollData.monthYear,
      createdAt: this.isEditing ? this.payrolls.find(p => p.id === this.editPayrollId)?.createdAt : new Date(),
      status: this.isEditing ? this.payrolls.find(p => p.id === this.editPayrollId)?.status : 'Draft',
      totalGross: this.isEditing ? this.payrolls.find(p => p.id === this.editPayrollId)?.totalGross : 0,
    };

    if (this.isEditing) {
      this.payrollService.updatePayroll(this.editPayrollId, payroll)
        .then(() => {
          this.modalService.dismissAll();
        })
        .catch(err => {
          console.error('Error updating payroll:', err);
          alert('Failed to update payroll');
        });
    } else {
      this.payrollService.createPayroll(payroll)
        .then(() => {
          this.modalService.dismissAll();
        })
        .catch(err => {
          console.error('Error creating payroll:', err);
          alert('Failed to create payroll');
        });
    }
  }

  deletePayroll(payrollId: string) {
    if (confirm('Are you sure you want to delete this payroll?')) {
      this.payrollService.deletePayroll(payrollId)
        .then(() => {
          console.log('Payroll deleted successfully');
        })
        .catch(err => {
          console.error('Error deleting payroll:', err);
          alert('Failed to delete payroll');
        });
    }
  }

  goToAddDetailedPayroll() {
    if (!this.payrollData.location || !this.payrollData.monthYear) {
      alert('Please fill required fields');
      return;
    }
  
    const selectedEmployee = this.users.find(u => u.id === this.payrollData.selectedEmployeeId);
    
    this.modalService.dismissAll();
    
    // Create a payroll object for potential future use
    const payroll = {
      location: this.payrollData.location,
      employees: this.payrollData.selectedEmployeeId ? [this.payrollData.selectedEmployeeId] : [],
      monthYear: this.payrollData.monthYear,
      createdAt: new Date(),
      status: 'Draft',
      name: 'Payroll for ' + new Date(this.payrollData.monthYear).toLocaleString('default', { month: 'long', year: 'numeric' })
    };

    this.payrollService.setCurrentPayrollData({
      location: this.payrollData.location,
      monthYear: this.payrollData.monthYear,
      employeeId: this.payrollData.selectedEmployeeId,
      employeeName: selectedEmployee ? (selectedEmployee.username || selectedEmployee.name || 'Unknown') : 'Unknown'
    });
    
    this.router.navigate(['/add-payroll']);
  }
}