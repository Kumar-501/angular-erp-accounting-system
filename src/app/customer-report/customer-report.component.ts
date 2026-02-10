import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CustomerService } from '../services/customer.service';
import { UserService } from '../services/user.service';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { Chart, ChartConfiguration, ChartType, registerables } from 'chart.js';

// Register Chart.js components
Chart.register(...registerables);

@Component({
  selector: 'app-customer-report',
  templateUrl: './customer-report.component.html',
  styleUrls: ['./customer-report.component.scss']
})
export class CustomerReportComponent implements OnInit, AfterViewInit {
  @ViewChild('chartCanvas', { static: false }) chartCanvas!: ElementRef<HTMLCanvasElement>;
  
  reportType: 'department' | 'executive' = 'department';
  departments: string[] = [];
  executives: any[] = [];
  selectedDepartment = '';
  selectedExecutive = '';
  reportData: any[] = [];
  loading = false;
  showChart = false;
  chart: Chart | null = null;

  // Table columns
  columns = [
    { name: 'contactId', label: 'Contact ID' },
    { name: 'name', label: 'Name' },
    { name: 'businessName', label: 'Business Name' },
    { name: 'mobile', label: 'Mobile' },
    { name: 'email', label: 'Email' },
    { name: 'status', label: 'Status' },
    { name: 'createdAt', label: 'Created Date' }
  ];

  constructor(
    private customerService: CustomerService,
    private userService: UserService
  ) { }

  ngOnInit(): void {
    this.loadDepartments();
    this.loadExecutives();
  }

  ngAfterViewInit(): void {
    // Chart canvas is now available
  }

  // Add getter methods for template calculations
  get totalCustomers(): number {
    return this.reportData.length;
  }

  get activeCustomers(): number {
    return this.reportData.filter(c => c.status === 'Active').length;
  }

  get uniqueDepartments(): number {
    const departments = this.reportData.map(c => c.department);
    return new Set(departments).size;
  }

  // Add method to check if customer is active (for template binding)
  isCustomerActive(status: string): boolean {
    return status === 'Active';
  }

  async loadDepartments(): Promise<void> {
    try {
      this.departments = await this.customerService.getAvailableDepartments();
      if (this.departments.length > 0) {
        this.selectedDepartment = this.departments[0];
      }
    } catch (error) {
      console.error('Error loading departments:', error);
    }
  }

  loadExecutives(): void {
    this.userService.getUsers().subscribe(users => {
      this.executives = users.map(user => ({
        id: user.id,
        username: user.username || user.displayName || user.email.split('@')[0]
      }));
      if (this.executives.length > 0) {
        this.selectedExecutive = this.executives[0].username;
      }
    });
  }

  async generateReport(): Promise<void> {
    this.loading = true;
    this.reportData = [];

    try {
      if (this.reportType === 'department') {
        this.reportData = await this.getCustomersByDepartment(this.selectedDepartment);
      } else {
        this.reportData = await this.getCustomersByExecutive(this.selectedExecutive);
      }
      this.createChart();
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      this.loading = false;
    }
  }

  async getCustomersByDepartment(department: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.customerService.getCustomersByDepartment(department).subscribe({
        next: (customers) => {
          resolve(this.formatReportData(customers));
        },
        error: (err) => reject(err)
      });
    });
  }

  async getCustomersByExecutive(executive: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.customerService.getCustomers().subscribe({
        next: (customers) => {
          const filtered = customers.filter(c => c.assignedTo === executive);
          resolve(this.formatReportData(filtered));
        },
        error: (err) => reject(err)
      });
    });
  }

  formatReportData(customers: any[]): any[] {
    return customers.map(customer => ({
      contactId: customer.contactId,
      name: customer.isIndividual ? 
        `${customer.prefix || ''} ${customer.firstName || ''} ${customer.lastName || ''}`.trim() : 
        customer.businessName,
      businessName: customer.isIndividual ? '' : customer.businessName,
      mobile: customer.mobile,
      email: customer.email,
      status: customer.status,
      createdAt: customer.createdAt ? new Date(customer.createdAt).toLocaleDateString() : 'N/A',
      department: customer.department,
      assignedTo: customer.assignedTo
    }));
  }

  createChart(): void {
    if (!this.chartCanvas || this.reportData.length === 0) {
      return;
    }

    // Destroy existing chart if it exists
    if (this.chart) {
      this.chart.destroy();
    }

    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    let chartData: any;
    let title: string;

    if (this.reportType === 'department') {
      // Department-wise chart (status distribution)
      const statusCounts = this.reportData.reduce((acc, customer) => {
        acc[customer.status] = (acc[customer.status] || 0) + 1;
        return acc;
      }, {});

      chartData = {
        labels: Object.keys(statusCounts),
        datasets: [{
          data: Object.values(statusCounts),
          backgroundColor: [
            '#42A5F5',
            '#66BB6A',
            '#FFA726',
            '#EC407A'
          ]
        }]
      };
      title = `Customer Status Distribution - ${this.selectedDepartment}`;
    } else {
      // Executive-wise chart (department distribution)
      const departmentCounts = this.reportData.reduce((acc, customer) => {
        acc[customer.department] = (acc[customer.department] || 0) + 1;
        return acc;
      }, {});

      chartData = {
        labels: Object.keys(departmentCounts),
        datasets: [{
          data: Object.values(departmentCounts),
          backgroundColor: [
            '#FF6384',
            '#36A2EB',
            '#FFCE56',
            '#4BC0C0',
            '#9966FF',
            '#FF9F40'
          ]
        }]
      };
      title = `Department Distribution - ${this.selectedExecutive}`;
    }

    const config: ChartConfiguration = {
      type: 'pie' as ChartType,
      data: chartData,
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: title,
            font: {
              size: 16
            }
          },
          legend: {
            position: 'top'
          }
        }
      }
    };

    this.chart = new Chart(ctx, config);
    this.showChart = true;
  }

  exportToExcel(): void {
    if (this.reportData.length === 0) {
      alert('No data to export');
      return;
    }

    const ws = XLSX.utils.json_to_sheet(this.reportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Customer Report');
    
    const fileName = this.reportType === 'department' ? 
      `Customer_Report_Department_${this.selectedDepartment}.xlsx` : 
      `Customer_Report_Executive_${this.selectedExecutive}.xlsx`;
    
    XLSX.writeFile(wb, fileName);
  }

  exportToPDF(): void {
    if (this.reportData.length === 0) {
      alert('No data to export');
      return;
    }

    const doc = new jsPDF();
    const title = this.reportType === 'department' ? 
      `Customer Report - Department: ${this.selectedDepartment}` : 
      `Customer Report - Executive: ${this.selectedExecutive}`;
    
    // Add title
    doc.setFontSize(16);
    doc.text(title, 14, 15);
    
    // Prepare data for the table
    const tableData = this.reportData.map(item => [
      item.contactId,
      item.name,
      item.businessName,
      item.mobile,
      item.email,
      item.status,
      item.createdAt
    ]);

    // Add table
    (doc as any).autoTable({
      head: [this.columns.map(col => col.label)],
      body: tableData,
      startY: 20,
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 2
      },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 30 },
        2: { cellWidth: 30 },
        3: { cellWidth: 25 },
        4: { cellWidth: 40 },
        5: { cellWidth: 20 },
        6: { cellWidth: 25 }
      }
    });

    // Save the PDF
    const fileName = this.reportType === 'department' ? 
      `Customer_Report_Department_${this.selectedDepartment}.pdf` : 
      `Customer_Report_Executive_${this.selectedExecutive}.pdf`;
    
    doc.save(fileName);
  }

  toggleReportType(): void {
    this.reportType = this.reportType === 'department' ? 'executive' : 'department';
    this.reportData = [];
    this.showChart = false;
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }

  ngOnDestroy(): void {
    if (this.chart) {
      this.chart.destroy();
    }
  }
}