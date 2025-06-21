import { Component, OnInit, OnDestroy } from '@angular/core';
import { UserService } from '../services/user.service';
import { HolidayService } from '../services/holiday.service';
import { DepartmentService } from '../services/department.service';
import { DesignationService } from '../services/designation.service';
import { Subscription } from 'rxjs';

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
  
  // Stats cards data
  cards = [
    { title: 'Total Users', value: 0, icon: 'fa-users', color: 'bg-primary' },
    { title: 'Total Holidays', value: 0, icon: 'fa-calendar', color: 'bg-success' },
    { title: 'Total Departments', value: 0, icon: 'fa-building', color: 'bg-warning' },
    { title: 'Total Designations', value: 0, icon: 'fa-id-badge', color: 'bg-danger' }
  ];

  private subscriptions: Subscription[] = [];

  constructor(
    private userService: UserService,
    private holidayService: HolidayService,
    private departmentService: DepartmentService,
    private designationService: DesignationService
  ) {}

  ngOnInit(): void {
    this.loadAllData();
  }

  loadAllData(): void {
    // Load users data
    const usersSub = this.userService.getUsers().subscribe(users => {
      this.totalUsers = users.length;
      this.cards[0].value = this.totalUsers;
    });
    this.subscriptions.push(usersSub);

    // Load holidays data
    const holidaysSub = this.holidayService.getHolidays().subscribe(holidays => {
      this.totalHolidays = holidays.length;
      this.cards[1].value = this.totalHolidays;
    });
    this.subscriptions.push(holidaysSub);

    // Load departments data
    const departmentsSub = this.departmentService.getDepartments().subscribe(departments => {
      this.totalDepartments = departments.length;
      this.cards[2].value = this.totalDepartments;
    });
    this.subscriptions.push(departmentsSub);

    // Load designations data
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