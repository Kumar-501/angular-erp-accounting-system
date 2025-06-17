import { Component, Input, OnInit } from '@angular/core';
import { SaleService } from '../services/sale.service';
import { map, Observable, of } from 'rxjs';

@Component({
  selector: 'app-sales-invoice',
  templateUrl: './sales-invoice.component.html',
  styleUrls: ['./sales-invoice.component.scss']
})
export class SalesInvoiceComponent implements OnInit {
  @Input() saleId?: string;
  sales$: Observable<any[]> = of([]);
  filteredSales$: Observable<any[]> = of([]);
  
  // Filter properties
  fromDate: string = '';
  toDate: string = '';
  searchText: string = '';
  
  constructor(private saleService: SaleService) {}

  ngOnInit() {
    if (this.saleId) {
      this.sales$ = this.saleService.getSaleById(this.saleId).pipe(
        map(sale => [{
          ...sale,
          addedBy: (sale as any).addedBy || 'N/A',
          addedByDisplayName: (sale as any).addedByDisplayName || (sale as any).addedBy || 'N/A'
        }])
      );
    } else {
      this.sales$ = this.saleService.listenForSales({}).pipe(
        map(sales => sales.map(sale => ({
          ...sale,
          addedBy: (sale as any).addedBy || 'N/A',
          addedByDisplayName: (sale as any).addedByDisplayName || (sale as any).addedBy || 'N/A'
        })))
      );
    }
    
    this.filteredSales$ = this.sales$;
  }

  applyFilters(): void {
    this.filteredSales$ = this.sales$.pipe(
      map(sales => {
        let filtered = sales;
        
        // Date filter
        if (this.fromDate) {
          filtered = filtered.filter(sale => {
            const saleDate = new Date(sale.saleDate);
            return saleDate >= new Date(this.fromDate);
          });
        }
        
        if (this.toDate) {
          filtered = filtered.filter(sale => {
            const saleDate = new Date(sale.saleDate);
            return saleDate <= new Date(this.toDate);
          });
        }
        
        // Search filter
        if (this.searchText) {
          const searchLower = this.searchText.toLowerCase();
          filtered = filtered.filter(sale => 
            (sale.invoiceNo || '').toLowerCase().includes(searchLower) ||
            (sale.orderNo || '').toLowerCase().includes(searchLower) ||
            (sale.addedByDisplayName || '').toLowerCase().includes(searchLower)
          );
        }
        
        return filtered;
      })
    );
  }

  resetFilters(): void {
    this.fromDate = '';
    this.toDate = '';
    this.searchText = '';
    this.filteredSales$ = this.sales$;
  }

  exportToCSV(): void {
    this.filteredSales$.subscribe(sales => {
      const csvContent = this.convertToCSV(sales);
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sales-report.csv';
      a.click();
      window.URL.revokeObjectURL(url);
    });
  }

  exportToExcel(): void {
    this.filteredSales$.subscribe(sales => {
      // This would require a library like xlsx for proper Excel export
      // For now, we'll export as CSV with .xlsx extension
      const csvContent = this.convertToCSV(sales);
      const blob = new Blob([csvContent], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sales-report.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
    });
  }

  private convertToCSV(data: any[]): string {
    const headers = ['S.No', 'Invoice No', 'Date', 'Sales Value', 'Order No', 'Incentive User'];
    const csvRows = [headers.join(',')];
    
    data.forEach((sale, index) => {
      const row = [
        index + 1,
        sale.invoiceNo || 'N/A',
        new Date(sale.saleDate).toLocaleDateString(),
        sale.totalPayable || 0,
        sale.orderNo || 'N/A',
        sale.addedByDisplayName || sale.addedBy || 'N/A'
      ];
      csvRows.push(row.join(','));
    });
    
    return csvRows.join('\n');
  }

  getTotalSales(): number {
    let total = 0;
    this.filteredSales$.subscribe(sales => {
      total = sales.reduce((sum, sale) => sum + (sale.totalPayable || 0), 0);
    });
    return total;
  }

  getTotalQuantity(): number {
    let total = 0;
    this.filteredSales$.subscribe(sales => {
      total = sales.length;
    });
    return total;
  }

  viewInvoice(saleId: string): void {
    console.log('Viewing invoice for sale:', saleId);
    // Your existing implementation
  }
}