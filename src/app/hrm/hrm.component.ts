import { Component, OnInit, OnDestroy } from '@angular/core';
import { UserService } from '../services/user.service';
import { HolidayService } from '../services/holiday.service';
import { DepartmentService } from '../services/department.service';
import { DesignationService } from '../services/designation.service';
import { Subscription } from 'rxjs';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-hrm',
  templateUrl: './hrm.component.html',
  styleUrls: ['./hrm.component.scss']
})
export class HrmComponent implements OnInit, OnDestroy {
  totalUsers = 0;
  totalHolidays = 0;
  totalDepartments = 0;
  totalDesignations = 0;
    currentUserRole: string = '';

  // Stats cards data - Keep existing cards
  cards = [
    { title: 'Total Users', value: 0, icon: 'fa-users', color: 'bg-primary' },
    { title: 'Total Holidays', value: 0, icon: 'fa-calendar', color: 'bg-success' },
    { title: 'Total Departments', value: 0, icon: 'fa-building', color: 'bg-warning' },
    { title: 'Total Designations', value: 0, icon: 'fa-id-badge', color: 'bg-danger' }
  ];

  // Menu items configuration
  menuItems = [
    { path: 'leave', name: 'Leave', icon: 'fa-calendar-minus', roles: ['admin', 'executive', 'supervisor','leads'] },
    { path: 'attendance', name: 'Attendance', icon: 'fa-clipboard-check', roles: ['admin', 'executive', 'supervisor','leads'] },
    { path: 'holiday', name: 'Holiday', icon: 'fa-umbrella-beach', roles: ['admin', 'executive', 'supervisor','leads'] },
    // Admin-only items
    { path: 'leave-type', name: 'Leave Type', icon: 'fa-calendar-alt', roles: ['admin'] },
    { path: 'payroll', name: 'Payroll', icon: 'fa-money-bill-wave', roles: ['admin'] },
    { path: 'departments', name: 'Departments', icon: 'fa-building', roles: ['admin'] },
    { path: 'designations', name: 'Designations', icon: 'fa-id-card', roles: ['admin'] },
    { path: 'sales-targets', name: 'Sales Targets', icon: 'fa-bullseye', roles: ['admin'] },
    { path: 'user1', name: 'Users', icon: 'fa-users', roles: ['admin'] }
  ];

  filteredMenuItems: any[] = [];
  private subscriptions: Subscription[] = [];

  constructor(
    private userService: UserService,
    private holidayService: HolidayService,
    private departmentService: DepartmentService,
    private designationService: DesignationService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadAllData();
    this.filterMenuBasedOnRole();
  }

  filterMenuBasedOnRole(): void {
    const userSub = this.authService.getCurrentUser().subscribe(user => {
      if (user) {
        this.currentUserRole = user.role?.toLowerCase() || '';
        this.filteredMenuItems = this.menuItems.filter(item => 
          item.roles.map((r: string) => r.toLowerCase()).includes(this.currentUserRole)
        );
      }
    });
    this.subscriptions.push(userSub);
  }

  loadAllData(): void {
    // Existing data loading logic remains unchanged
    const usersSub = this.userService.getUsers().subscribe(users => {
      this.totalUsers = users.length;
      this.cards[0].value = this.totalUsers;
    });
    this.subscriptions.push(usersSub);

    const holidaysSub = this.holidayService.getHolidays().subscribe(holidays => {
      this.totalHolidays = holidays.length;
      this.cards[1].value = this.totalHolidays;
    });
    this.subscriptions.push(holidaysSub);

    const departmentsSub = this.departmentService.getDepartments().subscribe(departments => {
      this.totalDepartments = departments.length;
      this.cards[2].value = this.totalDepartments;
    });
    this.subscriptions.push(departmentsSub);

    const designationsSub = this.designationService.getDesignations().subscribe(designations => {
      this.totalDesignations = designations.length;
      this.cards[3].value = this.totalDesignations;
    });
    this.subscriptions.push(designationsSub);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
}