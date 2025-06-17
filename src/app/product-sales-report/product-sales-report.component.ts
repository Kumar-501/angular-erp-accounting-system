import { Component, OnInit } from '@angular/core';
import { SaleService } from '../services/sale.service';
import { ProductsService } from '../services/products.service';
import { DatePipe } from '@angular/common';
import { FormBuilder, FormGroup } from '@angular/forms';

// Import Chart.js with error handling
let Chart: any;
try {
  const chartModule = require('chart.js');
  Chart = chartModule.Chart;
  if (chartModule.registerables) {
    Chart.register(...chartModule.registerables);
  }
} catch (error) {
  console.warn('Chart.js not found. Charts will not be available.');
}

@Component({
  selector: 'app-product-sales-report',
  templateUrl: './product-sales-report.component.html',
  styleUrls: ['./product-sales-report.component.scss'],
  providers: [DatePipe]
})
export class ProductSalesReportComponent implements OnInit {
  salesData: any[] = [];
  filteredSales: any[] = [];
  salesByUser: any[] = [];
  salesByDepartment: any[] = [];
  topSellingProducts: any[] = [];
  isLoading = false;
  errorMessage = '';
  filterForm: FormGroup;
  chart: any;
  userChart: any;
  departmentChart: any;

  constructor(
    private saleService: SaleService,
    private productsService: ProductsService,
    private datePipe: DatePipe,
    private fb: FormBuilder
  ) {
    this.filterForm = this.fb.group({
      startDate: [''],
      endDate: [''],
      productId: [''],
      userId: [''],
      department: ['']
    });
  }

  ngOnInit(): void {
    this.loadSalesData();
    this.setupFormListeners();
  }

  setupFormListeners(): void {
    this.filterForm.valueChanges.subscribe(() => {
      this.applyFilters();
    });
  }

  // Add getter methods for template calculations
  get totalSales(): number {
    return this.filteredSales.reduce((sum, sale) => sum + (sale.total || 0), 0);
  }

  get totalTransactions(): number {
    return this.filteredSales.length;
  }

  get averageSaleValue(): number {
    return this.filteredSales.length > 0 ? this.totalSales / this.filteredSales.length : 0;
  }

 async loadSalesData(): Promise<void> {
  this.isLoading = true;
  try {
    // Get all completed sales
    const sales = await this.saleService['getAllSales']().toPromise();
    this.salesData = sales || [];
    this.applyFilters();
    
    // Generate reports
    this.generateSalesByUserReport();
    this.generateSalesByDepartmentReport();
    this.generateTopSellingProducts();
    
    // Create charts
    this.createSalesChart();
    this.createUserSalesChart();
    this.createDepartmentSalesChart();
  } catch (error) {
    console.error('Error loading sales data:', error);
    this.errorMessage = 'Failed to load sales data';
  } finally {
    this.isLoading = false;
  }
}

  applyFilters(): void {
    const filters = this.filterForm.value;
    this.filteredSales = this.salesData.filter(sale => {
      // Filter by date range
      if (filters.startDate && filters.endDate) {
        const saleDate = new Date(sale.saleDate);
        const startDate = new Date(filters.startDate);
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999); // Include entire end day
        
        if (saleDate < startDate || saleDate > endDate) {
          return false;
        }
      }
      
      // Filter by product
      if (filters.productId && sale.products) {
        const hasProduct = sale.products.some((p: any) => p.productId === filters.productId);
        if (!hasProduct) return false;
      }
      
      // Filter by user
      if (filters.userId && sale.addedBy !== filters.userId) {
        return false;
      }
      
      // Filter by department
      if (filters.department && sale.department !== filters.department) {
        return false;
      }
      
      return true;
    });
    
    // Refresh charts with filtered data
    this.createSalesChart();
    this.createUserSalesChart();
    this.createDepartmentSalesChart();
  }

  generateSalesByUserReport(): void {
    const userSalesMap = new Map<string, { userId: string, userName: string, totalSales: number, count: number }>();
    
    this.salesData.forEach(sale => {
      if (!sale.addedBy) return;
      
      const userData = userSalesMap.get(sale.addedBy) || {
        userId: sale.addedBy,
        userName: sale.addedByName || `User ${sale.addedBy}`,
        totalSales: 0,
        count: 0
      };
      
      userData.totalSales += sale.total || 0;
      userData.count++;
      userSalesMap.set(sale.addedBy, userData);
    });
    
    this.salesByUser = Array.from(userSalesMap.values())
      .sort((a, b) => b.totalSales - a.totalSales);
  }

  async generateSalesByDepartmentReport(): Promise<void> {
    const departmentSalesMap = new Map<string, { department: string, totalSales: number, count: number }>();
    
    for (const sale of this.salesData) {
      if (!sale.addedBy) continue;
      
      try {
        // In a real app, you'd get department from user data
        // This is a simplified version
        let department = sale.department || 'Unknown';
        
        const deptData = departmentSalesMap.get(department) || {
          department,
          totalSales: 0,
          count: 0
        };
        
        deptData.totalSales += sale.total || 0;
        deptData.count++;
        departmentSalesMap.set(department, deptData);
      } catch (error) {
        console.error('Error processing sale for department report:', error);
      }
    }
    
    this.salesByDepartment = Array.from(departmentSalesMap.values())
      .sort((a, b) => b.totalSales - a.totalSales);
  }

  generateTopSellingProducts(): void {
    const productSalesMap = new Map<string, { productId: string, productName: string, quantity: number, totalSales: number }>();
    
    this.salesData.forEach(sale => {
      if (!sale.products) return;
      
      sale.products.forEach((product: any) => {
        const productData = productSalesMap.get(product.productId) || {
          productId: product.productId,
          productName: product.productName || product.name || `Product ${product.productId}`,
          quantity: 0,
          totalSales: 0
        };
        
        productData.quantity += product.quantity || 0;
        productData.totalSales += product.lineTotal || (product.quantity * product.unitPrice) || 0;
        productSalesMap.set(product.productId, productData);
      });
    });
    
    this.topSellingProducts = Array.from(productSalesMap.values())
      .sort((a, b) => b.totalSales - a.totalSales)
      .slice(0, 10); // Top 10 products
  }

  createSalesChart(): void {
    if (!Chart) {
      console.warn('Chart.js not available');
      return;
    }
    
    if (this.chart) {
      this.chart.destroy();
    }
    
    // Group sales by date
    const salesByDate = new Map<string, number>();
    this.filteredSales.forEach(sale => {
      const dateStr = this.datePipe.transform(sale.saleDate, 'shortDate') || 'Unknown';
      const total = salesByDate.get(dateStr) || 0;
      salesByDate.set(dateStr, total + (sale.total || 0));
    });
    
    const dates = Array.from(salesByDate.keys());
    const totals = Array.from(salesByDate.values());
    
    const ctx = document.getElementById('salesChart') as HTMLCanvasElement;
    if (!ctx) return;
    
    this.chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: dates,
        datasets: [{
          label: 'Sales by Date',
          data: totals,
          backgroundColor: 'rgba(54, 162, 235, 0.5)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Daily Sales Report'
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Total Sales'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Date'
            }
          }
        }
      }
    });
  }

  createUserSalesChart(): void {
    if (!Chart) {
      console.warn('Chart.js not available');
      return;
    }
    
    if (this.userChart) {
      this.userChart.destroy();
    }
    
    const users = this.salesByUser.map(u => u.userName);
    const totals = this.salesByUser.map(u => u.totalSales);
    
    const ctx = document.getElementById('userSalesChart') as HTMLCanvasElement;
    if (!ctx) return;
    
    this.userChart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: users,
        datasets: [{
          label: 'Sales by User',
          data: totals,
          backgroundColor: [
            'rgba(255, 99, 132, 0.5)',
            'rgba(54, 162, 235, 0.5)',
            'rgba(255, 206, 86, 0.5)',
            'rgba(75, 192, 192, 0.5)',
            'rgba(153, 102, 255, 0.5)'
          ],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Sales by User'
          },
        }
      }
    });
  }

  createDepartmentSalesChart(): void {
    if (!Chart) {
      console.warn('Chart.js not available');
      return;
    }
    
    if (this.departmentChart) {
      this.departmentChart.destroy();
    }
    
    const departments = this.salesByDepartment.map(d => d.department);
    const totals = this.salesByDepartment.map(d => d.totalSales);
    
    const ctx = document.getElementById('departmentSalesChart') as HTMLCanvasElement;
    if (!ctx) return;
    
    this.departmentChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: departments,
        datasets: [{
          label: 'Sales by Department',
          data: totals,
          backgroundColor: [
            'rgba(255, 99, 132, 0.5)',
            'rgba(54, 162, 235, 0.5)',
            'rgba(255, 206, 86, 0.5)',
            'rgba(75, 192, 192, 0.5)',
            'rgba(153, 102, 255, 0.5)'
          ],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Sales by Department'
          },
        }
      }
    });
  }

  exportReport(format: 'csv' | 'excel'): void {
    this.saleService.exportSales(format, this.getCurrentFilters())
      .catch(error => {
        console.error('Error exporting report:', error);
        this.errorMessage = 'Failed to export report';
      });
  }

  private getCurrentFilters(): any {
    const filters = this.filterForm.value;
    const result: any = {};
    
    if (filters.startDate && filters.endDate) {
      result.dateRange = {
        startDate: filters.startDate,
        endDate: filters.endDate
      };
    }
    
    if (filters.productId) {
      // You might want to add product filtering logic here
    }
    
    if (filters.userId) {
      result.addedBy = filters.userId;
    }
    
    if (filters.department) {
      result.addedByDepartment = filters.department;
    }
    
    return result;
  }
}