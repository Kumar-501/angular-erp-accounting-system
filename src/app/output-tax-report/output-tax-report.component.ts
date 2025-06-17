import { Component, OnInit } from '@angular/core';
import { SaleService } from '../services/sale.service';
import { Observable, BehaviorSubject, combineLatest, of } from 'rxjs';
import { Router } from '@angular/router';
import { FormControl } from '@angular/forms';
import { map, startWith, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { LocationService } from '../services/location.service';
import { TypeOfServiceService } from '../services/type-of-service.service';
import { AuthService } from '../auth.service';
import * as XLSX from 'xlsx';

// Reuse the same interfaces from SalesOrderComponent
interface Product {
  name: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  subtotal: number;
  quantityRemaining?: number;
  taxRate: number;
  taxAmount: number;
  taxType?: string; // 'CGST+SGST' or 'IGST'
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  batchNumber?: string;
  expiryDate?: string;
  priceBeforeTax?: number;
}

interface SalesOrder {
  id: string;
  customer: string;
  invoiceNo: string;
  paymentDue: number;
  totalPayable?: number;
  customerPhone: string;
  businessLocation: string;
  location: string;
  paymentStatus: string;
  saleDate: string;
  orderNo: string;
  status: string;
  typeOfService: string;
  typeOfServiceName: string;
  shippingStatus: string;
  shippingCharges: number;
  discountAmount: number;
  orderTax: number;
  paymentAmount: number;
  products: Product[];
  taxAmount?: number;
  taxDetails?: {
    cgst: number;
    sgst: number;
    igst: number;
    total: number;
  };
}

interface FilterOptions {
  dateRange: {
    startDate: string;
    endDate: string;
  };
  quickDateFilter?: string;
}

@Component({
  selector: 'app-output-tax-report',
  templateUrl: './output-tax-report.component.html',
  styleUrls: ['./output-tax-report.component.scss']
})
export class OutputTaxReportComponent implements OnInit {
  allSalesData$ = new BehaviorSubject<SalesOrder[]>([]);
  filteredSales$!: Observable<SalesOrder[]>;
  currentPage = 1;
  pageSize = 10;
  sortColumn = 'saleDate';
  sortDirection: 'asc' | 'desc' = 'desc';

  // Search term for filtering
  searchTerm$ = new BehaviorSubject<string>('');

  // Date filter options
  filterOptions: FilterOptions = {
    dateRange: {
      startDate: '',
      endDate: ''
    }
  };

  // Add Math to component for template access
  Math = Math;

  constructor(
    private saleService: SaleService,
    private locationService: LocationService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadSalesData();
    this.setupFilter();
  }

  loadSalesData(): void {
    this.saleService.listenForSales({}).subscribe(
      (salesFromService: any[]) => {
        const processedSales = salesFromService.map(sale => ({
          ...sale,
          taxAmount: sale.taxAmount || this.calculateTotalTax(sale),
          taxDetails: sale.taxDetails || {
            cgst: this.getProductTaxBreakdown(sale.products, 'cgst'),
            sgst: this.getProductTaxBreakdown(sale.products, 'sgst'),
            igst: this.getProductTaxBreakdown(sale.products, 'igst'),
            total: this.calculateTotalTax(sale)
          }
        }));
        this.allSalesData$.next(processedSales);
      },
      error => console.error('Error loading sales data:', error)
    );
  }

  setupFilter(): void {
    this.filteredSales$ = combineLatest([
      this.allSalesData$,
      this.searchTerm$
    ]).pipe(
      map(([sales, searchTerm]) => {
        let filtered = [...sales];
        
        // Apply date filter if set
        if (this.filterOptions.dateRange.startDate && this.filterOptions.dateRange.endDate) {
          filtered = this.filterSalesByDate(filtered);
        }
        
        // Apply search term if exists
        if (searchTerm) {
          const term = searchTerm.toLowerCase();
          filtered = filtered.filter(sale => 
            sale.invoiceNo?.toLowerCase().includes(term) ||
            sale.customer?.toLowerCase().includes(term) ||
            sale.orderNo?.toLowerCase().includes(term)
          );
        }
        
        return this.sortSalesData(filtered, this.sortColumn, this.sortDirection);
      })
    );
  }

  filterSalesByDate(sales: SalesOrder[]): SalesOrder[] {
    const startDate = new Date(this.filterOptions.dateRange.startDate);
    const endDate = new Date(this.filterOptions.dateRange.endDate);
    endDate.setHours(23, 59, 59, 999);
    
    return sales.filter(sale => {
      const saleDate = new Date(sale.saleDate);
      return saleDate >= startDate && saleDate <= endDate;
    });
  }

  sortData(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.setupFilter();
  }

  private sortSalesData(sales: SalesOrder[], column: string, direction: 'asc' | 'desc'): SalesOrder[] {
    return sales.sort((a, b) => {
      let valueA: any = a[column as keyof SalesOrder];
      let valueB: any = b[column as keyof SalesOrder];
      
      if (column === 'saleDate') {
        valueA = new Date(valueA).getTime();
        valueB = new Date(valueB).getTime();
      } 
      else if (typeof valueA === 'string' && typeof valueB === 'string') {
        valueA = valueA.toLowerCase();
        valueB = valueB.toLowerCase();
      }
      
      if (valueA < valueB) {
        return direction === 'asc' ? -1 : 1;
      }
      if (valueA > valueB) {
        return direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }

  // Tax calculation methods
  calculateTotalTax(sale: SalesOrder): number {
    if (!sale.products) return 0;
    return sale.products.reduce((sum, product) => sum + (product.taxAmount || 0), 0);
  }

  getProductTaxBreakdown(products: Product[], taxType: 'cgst' | 'sgst' | 'igst'): number {
    if (!products) return 0;
    return products.reduce((sum, product) => {
      switch(taxType) {
        case 'cgst': return sum + (product.cgstAmount || 0);
        case 'sgst': return sum + (product.sgstAmount || 0);
        case 'igst': return sum + (product.igstAmount || 0);
        default: return sum;
      }
    }, 0);
  }

  getTotalCGST(sales: SalesOrder[]): number {
    return sales.reduce((sum, sale) => sum + (sale.taxDetails?.cgst || 0), 0);
  }

  getTotalSGST(sales: SalesOrder[]): number {
    return sales.reduce((sum, sale) => sum + (sale.taxDetails?.sgst || 0), 0);
  }

  getTotalIGST(sales: SalesOrder[]): number {
    return sales.reduce((sum, sale) => sum + (sale.taxDetails?.igst || 0), 0);
  }

  getTotalTax(sales: SalesOrder[]): number {
    return sales.reduce((sum, sale) => sum + (sale.taxAmount || 0), 0);
  }

  getTotalAmount(sales: SalesOrder[]): number {
    return sales.reduce((sum, sale) => sum + (sale.totalPayable || 0), 0);
  }

  // Date filter methods
  setQuickDateFilter(filterType: string): void {
    this.filterOptions.quickDateFilter = filterType;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    this.filterOptions.dateRange.startDate = '';
    this.filterOptions.dateRange.endDate = '';
    
    switch(filterType) {
      case 'today':
        this.filterOptions.dateRange.startDate = today.toISOString().split('T')[0];
        this.filterOptions.dateRange.endDate = today.toISOString().split('T')[0];
        break;
      case 'yesterday':
        this.filterOptions.dateRange.startDate = yesterday.toISOString().split('T')[0];
        this.filterOptions.dateRange.endDate = yesterday.toISOString().split('T')[0];
        break;
      case 'thisWeek':
        this.filterOptions.dateRange.startDate = startOfWeek.toISOString().split('T')[0];
        this.filterOptions.dateRange.endDate = today.toISOString().split('T')[0];
        break;
      case 'thisMonth':
        this.filterOptions.dateRange.startDate = startOfMonth.toISOString().split('T')[0];
        this.filterOptions.dateRange.endDate = today.toISOString().split('T')[0];
        break;
      case 'custom':
        break;
    }
    
    this.setupFilter();
  }

  getQuickDateLabel(filter: string): string {
    switch (filter) {
      case 'today': return 'Today';
      case 'yesterday': return 'Yesterday';
      case 'thisWeek': return 'This Week';
      case 'thisMonth': return 'This Month';
      case 'custom': return 'Custom Range';
      default: return 'Select Date Range';
    }
  }


exportToExcel(): void {
  // Get current filtered data
  this.filteredSales$.subscribe(sales => {
    if (!sales || sales.length === 0) {
      alert('No data available to export');
      return;
    }

    // Prepare data for Excel
    const excelData = sales.map(sale => ({
      'Date': new Date(sale.saleDate).toLocaleDateString('en-IN'),
      'Invoice No': sale.invoiceNo || 'N/A',
      'Customer': sale.customer,
      'Order No': sale.orderNo,
      'Taxable Amount': (sale.totalPayable || 0) - (sale.taxAmount || 0),
      'CGST': sale.taxDetails?.cgst || 0,
      'SGST': sale.taxDetails?.sgst || 0,
      'IGST': sale.taxDetails?.igst || 0,
      'Total Tax': sale.taxAmount || 0,
      'Total Amount': sale.totalPayable || 0
    }));

    // Add summary row
    const summaryRow = {
      'Date': '',
      'Invoice No': '',
      'Customer': '',
      'Order No': 'TOTAL:',
      'Taxable Amount': this.getTotalAmount(sales) - this.getTotalTax(sales),
      'CGST': this.getTotalCGST(sales),
      'SGST': this.getTotalSGST(sales),
      'IGST': this.getTotalIGST(sales),
      'Total Tax': this.getTotalTax(sales),
      'Total Amount': this.getTotalAmount(sales)
    };

    excelData.push(summaryRow);

    // Create workbook and worksheet
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();

    // Set column widths
    const columnWidths = [
      { wch: 12 }, // Date
      { wch: 15 }, // Invoice No
      { wch: 20 }, // Customer
      { wch: 15 }, // Order No
      { wch: 15 }, // Taxable Amount
      { wch: 12 }, // CGST
      { wch: 12 }, // SGST
      { wch: 12 }, // IGST
      { wch: 12 }, // Total Tax
      { wch: 15 }  // Total Amount
    ];
    worksheet['!cols'] = columnWidths;

    // Style the summary row (make it bold)
    const summaryRowIndex = excelData.length;
    const summaryRowRange = XLSX.utils.encode_range({
      s: { c: 0, r: summaryRowIndex - 1 },
      e: { c: 9, r: summaryRowIndex - 1 }
    });

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Output Tax Report');

    // Generate filename with current date and filter info
    const currentDate = new Date().toISOString().split('T')[0];
    let filename = `Output_Tax_Report_${currentDate}`;
    
    // Add date range to filename if applicable
    if (this.filterOptions.dateRange.startDate && this.filterOptions.dateRange.endDate) {
      const startDate = this.filterOptions.dateRange.startDate;
      const endDate = this.filterOptions.dateRange.endDate;
      filename += `_${startDate}_to_${endDate}`;
    } else if (this.filterOptions.quickDateFilter) {
      filename += `_${this.filterOptions.quickDateFilter}`;
    }
    
    filename += '.xlsx';

    // Save the file
    XLSX.writeFile(workbook, filename);
    
    console.log('Excel file exported successfully:', filename);
  }).unsubscribe(); // Unsubscribe immediately after getting the data
}

// Alternative method with more detailed export including metadata
exportToExcelDetailed(): void {
  this.filteredSales$.subscribe(sales => {
    if (!sales || sales.length === 0) {
      alert('No data available to export');
      return;
    }

    // Create workbook
    const workbook = XLSX.utils.book_new();

    // Summary Sheet
    const summaryData = [
      ['Output Tax Report Summary'],
      ['Generated on:', new Date().toLocaleString('en-IN')],
      [''],
      ['Total CGST:', this.getTotalCGST(sales)],
      ['Total SGST:', this.getTotalSGST(sales)],
      ['Total IGST:', this.getTotalIGST(sales)],
      ['Total Tax:', this.getTotalTax(sales)],
      ['Total Amount:', this.getTotalAmount(sales)],
      [''],
      ['Date Range:', this.getDateRangeText()]
    ];

    const summaryWorksheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Summary');

    // Detailed data sheet
    const detailedData = sales.map(sale => ({
      'Date': new Date(sale.saleDate).toLocaleDateString('en-IN'),
      'Invoice No': sale.invoiceNo || 'N/A',
      'Customer': sale.customer,
      'Customer Phone': sale.customerPhone,
      'Order No': sale.orderNo,
      'Business Location': sale.businessLocation,
      'Type of Service': sale.typeOfServiceName,
      'Payment Status': sale.paymentStatus,
      'Shipping Status': sale.shippingStatus,
      'Taxable Amount': (sale.totalPayable || 0) - (sale.taxAmount || 0),
      'CGST': sale.taxDetails?.cgst || 0,
      'SGST': sale.taxDetails?.sgst || 0,
      'IGST': sale.taxDetails?.igst || 0,
      'Total Tax': sale.taxAmount || 0,
      'Discount Amount': sale.discountAmount || 0,
      'Shipping Charges': sale.shippingCharges || 0,
      'Total Amount': sale.totalPayable || 0
    }));

    const detailedWorksheet = XLSX.utils.json_to_sheet(detailedData);
    XLSX.utils.book_append_sheet(workbook, detailedWorksheet, 'Detailed Report');

    // Generate filename
    const currentDate = new Date().toISOString().split('T')[0];
    const filename = `Output_Tax_Report_Detailed_${currentDate}.xlsx`;

    // Save the file
    XLSX.writeFile(workbook, filename);
    
    console.log('Detailed Excel file exported successfully:', filename);
  }).unsubscribe();
}
private getDateRangeText(): string {
  if (this.filterOptions.quickDateFilter && this.filterOptions.quickDateFilter !== 'custom') {
    return this.getQuickDateLabel(this.filterOptions.quickDateFilter);
  } else if (this.filterOptions.dateRange.startDate && this.filterOptions.dateRange.endDate) {
    return `${this.filterOptions.dateRange.startDate} to ${this.filterOptions.dateRange.endDate}`;
  }
  return 'All Records';
}
trackBySaleId(index: number, sale: SalesOrder): string {
  return sale.id;
}
  printReport(): void {
    window.print();
  }
}