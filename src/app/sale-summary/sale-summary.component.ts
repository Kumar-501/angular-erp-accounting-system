// sale-summary.component.ts
import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { TypeOfServiceService, Service } from '../services/type-of-service.service';
import { SaleService } from '../services/sale.service';
import { Subscription } from 'rxjs';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

interface ServiceSummary {
  service: Service;
  salesCount: number;
  totalValue: number;
}

interface Column {
  field: string;
  header: string;
  visible: boolean;
}

interface Sale {
  id?: string;
  typeOfService?: string; // Made optional
  typeOfServiceName?: string;
  status: string;
  total?: number;
  totalAmount?: number;
  paymentAmount?: number;
  products?: any[];
  date?: Date | string;
}
@Component({
  selector: 'app-sale-summary',
  templateUrl: './sale-summary.component.html',
  styleUrls: ['./sale-summary.component.scss']
})
export class SaleSummaryComponent implements OnInit, OnDestroy {
  serviceSummaries: ServiceSummary[] = [];
  filteredSummaries: ServiceSummary[] = [];
  allSales: Sale[] = []; // Store all sales for filtering
  loading = true;
    private services: Service[] = []; // Add this line to store services locally

  searchText = '';
  showColumnVisibility = false;
  
  // Date filter properties
  startDate: string = '';
  endDate: string = '';
  dateFilterActive = false;
  
  columns: Column[] = [
    { field: 'service.name', header: 'Service Name', visible: true },
    { field: 'service.description', header: 'Description', visible: true },
    { field: 'salesCount', header: 'Sales Count', visible: true },
    { field: 'totalValue', header: 'Total Value', visible: true }
  ];

  private subscriptions: Subscription[] = [];

  constructor(
    private typeOfServiceService: TypeOfServiceService,
    private saleService: SaleService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
private loadData(): void {
  this.loading = true;
  
  const servicesSub = this.typeOfServiceService.getServicesRealtime().subscribe(services => {
    this.services = services; // Store services locally
    const salesSub = this.saleService.listenForSales().subscribe((sales: any[]) => {
      this.allSales = sales
        .filter(sale => sale.status === 'Completed')
        .map(sale => ({
          ...sale,
          typeOfService: sale.typeOfService || '',
          date: sale.date || sale.createdAt || new Date()
        }));
      
      this.updateSummaries(this.services, this.allSales);
      this.loading = false;
      this.cdr.detectChanges();
    });
    
    this.subscriptions.push(salesSub);
  });
  
  this.subscriptions.push(servicesSub);
}
private updateSummaries(services: Service[], sales: Sale[]): void {
  this.serviceSummaries = services.map(service => {
    const serviceSales = sales.filter(sale => {
      // Check all possible ways a sale might reference this service
      return (sale.typeOfService === service.id) || 
             (sale.typeOfServiceName === service.name) ||
             (sale.typeOfService === service.name);
    });
    
    const totalValue = serviceSales.reduce((sum, sale) => {
      const saleValue = sale.total || 
                      sale.totalAmount || 
                      sale.paymentAmount || 
                      (sale.products?.reduce((pSum, p) => pSum + (p.subtotal || 0), 0) || 0);
      return sum + Number(saleValue);
    }, 0);
    
    return {
      service,
      salesCount: serviceSales.length,
      totalValue
    };
  });
  
  this.filterData();
}

  filterData(): void {
    let filtered = [...this.serviceSummaries];
    
    // Apply search text filter
    if (this.searchText) {
      const searchLower = this.searchText.toLowerCase();
      filtered = filtered.filter(summary => 
        summary.service.name.toLowerCase().includes(searchLower) ||
        (summary.service.description && summary.service.description.toLowerCase().includes(searchLower)) ||
        summary.salesCount.toString().includes(searchLower) ||
        summary.totalValue.toString().includes(searchLower)
      );
    }
    
    this.filteredSummaries = filtered;
  }

// In applyDateFilter()
applyDateFilter(): void {
  if (!this.startDate && !this.endDate) {
    this.dateFilterActive = false;
    this.updateSummaries(this.services, this.allSales);
    return;
  }

  this.dateFilterActive = true;

  const start = this.startDate ? new Date(this.startDate) : new Date(0);
  start.setHours(0, 0, 0, 0);

  const end = this.endDate ? new Date(this.endDate) : new Date();
  end.setHours(23, 59, 59, 999);

  const filteredSales = this.allSales.filter(sale => {
    if (!sale.date) return false;
    try {
      const saleDate = new Date(sale.date);
      return !isNaN(saleDate.getTime()) && saleDate >= start && saleDate <= end;
    } catch {
      return false;
    }
  });

  this.updateSummaries(this.services, filteredSales);
}

clearDateFilter(): void {
  this.startDate = '';
  this.endDate = '';
  this.dateFilterActive = false;
  // Use the already loaded data
  this.updateSummaries(this.serviceSummaries.map(s => s.service), this.allSales);
}

  clearSearch(): void {
    this.searchText = '';
    this.filterData();
  }

  toggleColumnVisibility(): void {
    this.showColumnVisibility = !this.showColumnVisibility;
  }

  isColumnVisible(field: string): boolean {
    const column = this.columns.find(c => c.field === field);
    return column ? column.visible : false;
  }

  getColspan(): number {
    // Calculate how many columns should be spanned for the "Total" cell
    let visibleCount = 0;
    if (this.isColumnVisible('service.name')) visibleCount++;
    if (this.isColumnVisible('service.description')) visibleCount++;
    return visibleCount;
  }

  getTotalSales(): number {
    return this.filteredSummaries.reduce((sum, summary) => sum + summary.salesCount, 0);
  }

  getTotalValue(): number {
    return this.filteredSummaries.reduce((sum, summary) => sum + summary.totalValue, 0);
  }

  getVisibleColumnsCount(): number {
    return this.columns.filter(c => c.visible).length;
  }

  exportAsCSV(): void {
    const visibleColumns = this.columns.filter(c => c.visible);
    const headers = visibleColumns.map(c => c.header);
    const data = this.filteredSummaries.map(summary => {
      return visibleColumns.map(col => {
        switch(col.field) {
          case 'service.name': return summary.service.name;
          case 'service.description': return summary.service.description || 'N/A';
          case 'salesCount': return summary.salesCount;
          case 'totalValue': return summary.totalValue;
          default: return '';
        }
      });
    });

    let csv = headers.join(',') + '\n';
    data.forEach(row => {
      csv += row.join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'sales-summary.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  exportAsExcel(): void {
    const visibleColumns = this.columns.filter(c => c.visible);
    const headers = visibleColumns.map(c => c.header);
    const data = this.filteredSummaries.map(summary => {
      return visibleColumns.map(col => {
        switch(col.field) {
          case 'service.name': return summary.service.name;
          case 'service.description': return summary.service.description || 'N/A';
          case 'salesCount': return summary.salesCount;
          case 'totalValue': return summary.totalValue;
          default: return '';
        }
      });
    });

    const ws: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sales Summary');
    XLSX.writeFile(wb, 'sales-summary.xlsx');
  }

  exportAsPDF(): void {
    const doc = new jsPDF();
    const title = 'Sales Summary by Service';
    const visibleColumns = this.columns.filter(c => c.visible);
    const headers = visibleColumns.map(c => c.header);
    const data = this.filteredSummaries.map(summary => {
      return visibleColumns.map(col => {
        switch(col.field) {
          case 'service.name': return summary.service.name;
          case 'service.description': return summary.service.description || 'N/A';
          case 'salesCount': return summary.salesCount.toString();
          case 'totalValue': return '₹' + summary.totalValue.toFixed(2);
          default: return '';
        }
      });
    });

    // Add title
    doc.setFontSize(16);
    doc.text(title, 14, 15);

    // Add date range if active
    if (this.dateFilterActive) {
      doc.setFontSize(10);
      const dateText = `Date Range: ${this.startDate || 'All'} to ${this.endDate || 'Current'}`;
      doc.text(dateText, 14, 22);
    }

    // Add table
    (doc as any).autoTable({
      head: [headers],
      body: data,
      startY: this.dateFilterActive ? 25 : 22,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      styles: { cellPadding: 3, fontSize: 10 },
      columnStyles: {
        2: { halign: 'right' },
        3: { halign: 'right' }
      }
    });

    // Add totals
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text('Total Sales: ' + this.getTotalSales(), 14, finalY);
    doc.text('Total Value: ₹' + this.getTotalValue().toFixed(2), 14, finalY + 7);

    doc.save('sales-summary.pdf');
  }

  print(): void {
    const printContent = document.getElementById('summaryTable');
    const WindowObject = window.open('', 'PrintWindow', 'width=750,height=650,top=50,left=50,toolbars=no,scrollbars=yes,status=no,resizable=yes');
    
    if (WindowObject) {
      WindowObject.document.writeln(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Print Sales Summary</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h2 { color: #333; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background-color: #f8f9fa; text-align: left; padding: 8px; border: 1px solid #ddd; }
            td { padding: 8px; border: 1px solid #ddd; }
            .text-end { text-align: right; }
            .fw-bold { font-weight: bold; }
          </style>
        </head>
        <body>
          <h2>Sales Summary by Service</h2>
          ${this.dateFilterActive ? 
            `<p>Date Range: ${this.startDate || 'All'} to ${this.endDate || 'Current'}</p>` : ''}
          ${printContent?.outerHTML}
          <p>Printed on: ${new Date().toLocaleString()}</p>
        </body>
        </html>
      `);
      
      WindowObject.document.close();
      WindowObject.focus();
      setTimeout(() => {
        WindowObject.print();
        WindowObject.close();
      }, 500);
    }
  }
}