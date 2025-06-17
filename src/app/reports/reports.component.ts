// reports.component.ts
import { Component, OnInit } from '@angular/core';
import { SaleService } from '../services/sale.service';

// Define interfaces for better type safety
export interface Sale {
  invoiceNo: string;
  saleDate: Date | string;
  customer: string;
  status: string;
  totalAmount: number;
  paymentStatus: string;
}

export interface FilterOptions {
  dateRange: {
    startDate: string;
    endDate: string;
  };
  status: string;
}

@Component({
  selector: 'app-reports',
  templateUrl: './reports.component.html',
  styleUrls: ['./reports.component.scss']
})
export class ReportsComponent implements OnInit {
  isLoading = true;
  errorMessage = '';
  salesData: Sale[] = []; // Added missing property

  // Updated filters - simplified to avoid index requirement
  filters: FilterOptions = {
    dateRange: {
      startDate: '', // Empty to avoid complex query
      endDate: ''
    },
    status: 'Completed' // Keep only status filter
  };

  constructor(private saleService: SaleService) {}

  ngOnInit(): void {
    this.loadSalesData();
  }

  loadSalesData(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.saleService.listenForSales(this.filters).subscribe({
      next: (data: Sale[]) => {
        this.salesData = data;
        this.isLoading = false;
      },
      error: (err: any) => {
        console.error('Error loading sales data:', err);
        
        // Check if it's an index error
        if (err.code === 'failed-precondition' || err.message?.includes('index')) {
          this.errorMessage = 'Database index required. Loading data without filters...';
          this.loadSalesDataWithoutFilters();
        } else {
          this.errorMessage = 'Failed to load sales data';
          this.isLoading = false;
        }
      }
    });
  }

  // Fallback method to load data without complex filters
 // Update this method in ReportsComponent
loadSalesDataWithoutFilters(): void {
  (this.saleService as any).getAllSales().subscribe({
    next: (data: Sale[]) => {
      // Apply filters client-side as fallback
      this.salesData = this.applyClientSideFilters(data);
      this.isLoading = false;
      this.errorMessage = 'Data loaded successfully (filters applied locally)';
    },
    error: (err: any) => {
      this.errorMessage = 'Failed to load sales data';
      this.isLoading = false;
      console.error('Error loading all sales data:', err);
    }
  });
}

  // Client-side filtering as fallback
  private applyClientSideFilters(data: Sale[]): Sale[] {
    return data.filter(sale => {
      // Filter by status
      if (this.filters.status && sale.status !== this.filters.status) {
        return false;
      }

      // Filter by date range
      if (this.filters.dateRange.startDate && this.filters.dateRange.endDate) {
        const saleDate = new Date(sale.saleDate);
        const startDate = new Date(this.filters.dateRange.startDate);
        const endDate = new Date(this.filters.dateRange.endDate);
        
        if (saleDate < startDate || saleDate > endDate) {
          return false;
        }
      }

      return true;
    });
  }

  // Export to CSV method
  exportToCSV(): void {
    this.saleService.exportSales('csv', this.filters)
      .catch((err: any) => {
        console.error('Error exporting to CSV:', err);
        this.errorMessage = 'Failed to export data';
      });
  }

  // Calculate total sales with proper typing
  getTotalSales(): number {
    return this.salesData.reduce((total: number, sale: Sale) => total + (sale.totalAmount || 0), 0);
  }

  // Additional utility methods you might need
  getAverageSale(): number {
    if (this.salesData.length === 0) return 0;
    return this.getTotalSales() / this.salesData.length;
  }

  getPendingOrders(): Sale[] {
    return this.salesData.filter(sale => sale.paymentStatus === 'Pending');
  }

  getCompletedOrders(): Sale[] {
    return this.salesData.filter(sale => sale.paymentStatus === 'Completed');
  }
}