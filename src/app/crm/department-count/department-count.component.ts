import { Component, OnInit, OnDestroy } from '@angular/core';
import { Customer, CustomerService } from '../../services/customer.service';
import { CallLogService } from '../../services/call-log.service';
import { UserService } from '../../services/user.service';
import { Subscription } from 'rxjs';

interface UserStats {
  name: string;
  customerCount: number;
  callCount: number;
}

interface DepartmentStat {
  name: string;
  totalCustomers: number;
  totalCalls: number;
  users: UserStats[];
}

@Component({
  selector: 'app-department-count',
  templateUrl: './department-count.component.html',
  styleUrls: ['./department-count.component.scss']
})
export class DepartmentCountComponent implements OnInit, OnDestroy {
  departments = ['PC1', 'PC2', 'PC3', 'PC4', 'PC5', 'PC6', 'PC7', 'PC8'];
  departmentStats: DepartmentStat[] = [];
  isLoading = true;
  private customerSubscription: Subscription | null = null;
  
  constructor(
    private customerService: CustomerService,
    private callLogService: CallLogService,
    private userService: UserService
  ) { }
  
  ngOnInit(): void {
    this.loadDepartmentStats();
  }
  
  ngOnDestroy(): void {
    // Clean up subscription when component is destroyed
    if (this.customerSubscription) {
      this.customerSubscription.unsubscribe();
    }
  }
  
  loadDepartmentStats() {
    this.isLoading = true;
    this.departmentStats = [];
    
    // Subscribe to customers data
    this.customerSubscription = this.customerService.getAllCustomers().subscribe(
      (customers: Customer[]) => {
        this.processCustomerData(customers);
        this.isLoading = false;
      },
      (error: any) => {
        console.error('Failed to load department stats:', error);
        this.isLoading = false;
      }
    );
  }
  
  private processCustomerData(customers: Customer[] | undefined) {
    this.departmentStats = [];
    
    // Group customers by department
    const customersByDept: {[key: string]: Customer[]} = {};
    this.departments.forEach(dept => {
      customersByDept[dept] = customers?.filter(c => c.department === dept) || [];
    });
    
    // Process each department
    for (const dept of this.departments) {
      const deptCustomers = customersByDept[dept];
      
      // Group customers by assigned user
      const usersMap: {[key: string]: UserStats} = {};
      
      for (const customer of deptCustomers) {
        if (!customer.assignedTo) continue;
        
        if (!usersMap[customer.assignedTo]) {
          usersMap[customer.assignedTo] = {
            name: customer.assignedTo,
            customerCount: 0,
            callCount: 0
          };
        }
        
        usersMap[customer.assignedTo].customerCount++;
        usersMap[customer.assignedTo].callCount += customer.callCount || 0;
      }
      
      this.departmentStats.push({
        name: dept,
        totalCustomers: deptCustomers.length,
        totalCalls: deptCustomers.reduce((sum, c) => sum + (c.callCount || 0), 0),
        users: Object.values(usersMap)
      });
    }
  }
}