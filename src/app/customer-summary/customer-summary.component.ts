import { Component, OnInit } from '@angular/core';
import { Customer, CustomerService } from '../services/customer.service';
import { SaleService } from '../services/sale.service';
import { UserService } from '../services/user.service';
import { SalesCallService } from '../services/sales-call.service';
import * as XLSX from 'xlsx';

interface UserSummary {
  id: string;
  name: string;
  customerCount: number;
  totalCallCount: number;
  averageCallCount: number;
}

@Component({
  selector: 'app-customer-summary',
  templateUrl: './customer-summary.component.html',
  styleUrls: ['./customer-summary.component.scss']
})
export class CustomerSummaryComponent implements OnInit {
  userSummaries: UserSummary[] = [];
  isLoading = true;

  constructor(
    private customerService: CustomerService,
    private salesCallService: SalesCallService,
    private userService: UserService
  ) { }

  ngOnInit(): void {
    this.loadCustomerSummary();
  }

  loadCustomerSummary(): void {
    this.isLoading = true;
        
    // Get all users first
    this.userService.getUsers().subscribe(users => {
      // Then get all customers
      this.customerService.getCustomers('all').subscribe(customers => {
        // Process the data to create summaries
        this.userSummaries = this.createUserSummaries(users, customers);
        this.isLoading = false;
      });
    });
  }

  private createUserSummaries(users: any[], customers: any[]): UserSummary[] {
    // Create a map to store user summaries
    const summaryMap = new Map<string, UserSummary>();

    // Initialize summaries for all users
    users.forEach(user => {
      const userName = `${user.firstName} ${user.lastName}`.trim() || user.username;
      summaryMap.set(user.id, {
        id: user.id,
        name: userName,
        customerCount: 0,
        totalCallCount: 0,
        averageCallCount: 0
      });
    });

    // Process customers to count assignments and calls
    customers.forEach(customer => {
      if (customer.assignedTo) {
        // Find the user this customer is assigned to
        const assignedUser = users.find(user => 
          `${user.firstName} ${user.lastName}`.trim() === customer.assignedTo ||
          user.username === customer.assignedTo
        );

        if (assignedUser) {
          const userSummary = summaryMap.get(assignedUser.id);
          if (userSummary) {
            userSummary.customerCount++;
            userSummary.totalCallCount += customer.callCount || 0;
          }
        }
      }
    });

    // Calculate averages and convert to array
    return Array.from(summaryMap.values()).map(summary => ({
      ...summary,
      averageCallCount: summary.customerCount > 0 
        ? Math.round((summary.totalCallCount / summary.customerCount) * 10) / 10 
        : 0
    })).sort((a, b) => b.customerCount - a.customerCount); // Sort by customer count descending
  }

  // Helper methods for template
  trackByUserId(index: number, item: UserSummary): string {
    return item.id;
  }

  getInitials(name: string): string {
    return name.split(' ')
      .map(n => n.charAt(0))
      .join('')
      .toUpperCase()
      .substring(0, 2);
  }

  getTotalUsers(): number {
    return this.userSummaries.length;
  }

  getTotalCustomers(): number {
    return this.userSummaries.reduce((total, summary) => total + summary.customerCount, 0);
  }

  getTotalCalls(): number {
    return this.userSummaries.reduce((total, summary) => total + summary.totalCallCount, 0);
  }

  // Excel export functionality
  exportToExcel(): void {
    if (this.userSummaries.length === 0) {
      return;
    }

    // Prepare data for Excel
    const excelData = this.userSummaries.map(summary => ({
      'User Name': summary.name,
      'Customers Assigned': summary.customerCount,
      'Total Calls': summary.totalCallCount,
      'Average Calls per Customer': summary.averageCallCount
    }));

    // Add summary row
    const summaryRow = {
      'User Name': 'TOTAL',
      'Customers Assigned': this.getTotalCustomers(),
      'Total Calls': this.getTotalCalls(),
      'Average Calls per Customer': this.getTotalCustomers() > 0 
        ? Math.round((this.getTotalCalls() / this.getTotalCustomers()) * 10) / 10 
        : 0
    };

    excelData.push(summaryRow);

    // Create workbook and worksheet
    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(excelData);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    
    // Style the header row
    const headerRange = XLSX.utils.decode_range(ws['!ref'] || 'A1:D1');
    for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
      if (!ws[cellAddress]) continue;
      ws[cellAddress].s = {
        font: { bold: true },
        fill: { fgColor: { rgb: "E3F2FD" } }
      };
    }

    // Style the summary row (last row)
    const lastRowIndex = excelData.length - 1;
    for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: lastRowIndex + 1, c: col });
      if (!ws[cellAddress]) continue;
      ws[cellAddress].s = {
        font: { bold: true },
        fill: { fgColor: { rgb: "FFF3E0" } }
      };
    }

    // Set column widths
    ws['!cols'] = [
      { wch: 25 }, // User Name
      { wch: 18 }, // Customers Assigned
      { wch: 15 }, // Total Calls
      { wch: 22 }  // Average Calls per Customer
    ];

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Customer Summary');

    // Generate filename with current date
    const currentDate = new Date();
    const dateStr = currentDate.toISOString().split('T')[0];
    const filename = `customer-assignment-summary-${dateStr}.xlsx`;

    // Save file
    XLSX.writeFile(wb, filename);
  }
}