import { Component, OnInit } from '@angular/core';
import { AdjustmentService } from '../services/adjustment.service';
import { Observable, map, startWith } from 'rxjs';
import { Router } from '@angular/router';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { FormControl } from '@angular/forms';

@Component({
  selector: 'app-list-adjustment',
  templateUrl: './list-adjustment.component.html',
  styleUrls: ['./list-adjustment.component.scss']
})
export class ListAdjustmentComponent implements OnInit {
  stockAdjustments$!: Observable<any>;
  filteredAdjustments$!: Observable<any>;
  adjustmentsList: any[] = [];
  adjustmentToDelete: any = null;
  showDeleteModal = false;
  isDeleting = false;
  sortField: string = 'date';
sortDirection: 'asc' | 'desc' = 'desc';

  showColumnVisibility = false;
  searchControl = new FormControl('');
  
  // Updated column configuration with products column
  columnHeaders = [
    { key: 'date', label: 'Date', visible: true },
    { key: 'referenceNo', label: 'Reference No', visible: true },
    { key: 'businessLocation', label: 'Location', visible: true },
    { key: 'adjustmentType', label: 'Adjustment type', visible: true },
    { key: 'products', label: 'Product', visible: true },
    { key: 'totalAmount', label: 'Total Amount', visible: true },
    { key: 'totalAmountRecovered', label: 'Total amount recovered', visible: true },
    { key: 'reason', label: 'Reason', visible: true },
    { key: 'addedBy', label: 'Added By', visible: true }
  ];

  constructor(
    private adjustmentService: AdjustmentService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadAdjustments();
    this.setupSearchFilter();
  }
  sortData(field: string): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }
  
    this.adjustmentsList.sort((a, b) => {
      let valueA = a[field];
      let valueB = b[field];
  
      // Special handling for dates
      if (field === 'date') {
        valueA = new Date(valueA).getTime();
        valueB = new Date(valueB).getTime();
      }
  
      // Special handling for products
      if (field === 'products') {
        valueA = a.products?.[0]?.name || '';
        valueB = b.products?.[0]?.name || '';
      }
  
      if (valueA < valueB) return this.sortDirection === 'asc' ? -1 : 1;
      if (valueA > valueB) return this.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  
    // Trigger search filter update to refresh the view
    this.searchControl.setValue(this.searchControl.value || '');
  }
  // Setup search filter
  private setupSearchFilter(): void {
    this.filteredAdjustments$ = this.searchControl.valueChanges.pipe(
      startWith(''),
      map(searchText => {
        if (!searchText) {
          return this.adjustmentsList;
        }
        return this.filterAdjustments(searchText.toLowerCase());
      })
    );
  }

  // Enhanced filter to search in product names as well
  private filterAdjustments(searchText: string): any[] {
    return this.adjustmentsList.filter(adjustment => {
      // Check regular fields
      const matchesRegularFields = Object.keys(adjustment).some(key => {
        if (key === 'products') return false; // Handle products separately
        const value = adjustment[key];
        if (value === null || value === undefined) {
          return false;
        }
        return String(value).toLowerCase().includes(searchText);
      });

      // Check product names if exists
      const matchesProductNames = adjustment.products?.some((product: any) => {
        return product?.name?.toLowerCase().includes(searchText);
      });

      return matchesRegularFields || matchesProductNames;
    });
  }

  // Getter for visible columns count
  get visibleColumnsCount(): number {
    return this.columnHeaders.filter(header => header.visible).length;
  }

  // Get visible headers for export functions
  private getVisibleHeaders(): string[] {
    return this.columnHeaders
      .filter(header => header.visible)
      .map(header => header.key);
  }

  // Toggle column visibility dropdown
  toggleColumnVisibility(): void {
    this.showColumnVisibility = !this.showColumnVisibility;
  }

  loadAdjustments(): void {
    this.stockAdjustments$ = this.adjustmentService.getStockAdjustments();
    this.stockAdjustments$.subscribe(adjustments => {
      this.adjustmentsList = adjustments;
      this.searchControl.setValue(''); // Reset search when new data loads
    });
  }

  goToAddAdjustment(): void {
    this.router.navigate(['/add-adjustment']);
  }

  goToEditAdjustment(id: string): void {
    this.router.navigate([`/edit-adjustment`, id]);
  }

  confirmDeleteAdjustment(adjustment: any): void {
    this.adjustmentToDelete = adjustment;
    this.showDeleteModal = true;
  }
    
  cancelDelete(): void {
    this.showDeleteModal = false;
    this.adjustmentToDelete = null;
  }

  async deleteAdjustment(): Promise<void> {
    if (!this.adjustmentToDelete?.id) return;

    this.isDeleting = true;
    
    try {
      await this.adjustmentService.delete(this.adjustmentToDelete.id);
      this.loadAdjustments(); // Refresh the list after deletion
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Failed to delete adjustment. Please try again.');
    } finally {
      this.isDeleting = false;
      this.cancelDelete();
    }
  }

  // Export Functions with product name handling
  exportToCSV(): void {
    const dataToExport = this.searchControl.value ? 
      this.filterAdjustments(this.searchControl.value.toLowerCase()) : 
      this.adjustmentsList;

    if (!dataToExport.length) {
      alert('No data to export');
      return;
    }

    const visibleHeaders = this.getVisibleHeaders();
    const csvData = this.convertToCSV(dataToExport, visibleHeaders);
    
    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', 'stock_adjustments.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  exportToExcel(): void {
    const dataToExport = this.searchControl.value ? 
      this.filterAdjustments(this.searchControl.value.toLowerCase()) : 
      this.adjustmentsList;

    if (!dataToExport.length) {
      alert('No data to export');
      return;
    }

    const visibleHeaders = this.getVisibleHeaders();
    const data = this.prepareDataForExport(dataToExport, visibleHeaders);
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock Adjustments');
    XLSX.writeFile(workbook, 'stock_adjustments.xlsx');
  }

  exportToPDF(): void {
    const dataToExport = this.searchControl.value ? 
      this.filterAdjustments(this.searchControl.value.toLowerCase()) : 
      this.adjustmentsList;

    if (!dataToExport.length) {
      alert('No data to export');
      return;
    }
  
    const visibleHeaders = this.getVisibleHeaders();
    const headers = visibleHeaders.map(header => this.formatHeader(header));
    const data = this.prepareDataForExport(dataToExport, visibleHeaders);
    
    this.exportToPDFHelper(data, headers, 'List Adjustment');
  }
  
  private exportToPDFHelper(data: any[], headers: string[], title: string): void {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFontSize(16);
    doc.text(title, pageWidth / 2, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);
    
    const columnWidth = pageWidth / headers.length;
    const startY = 40;
    let currentY = startY;
    
    headers.forEach((header, index) => {
      doc.text(header, 14 + columnWidth * index, currentY);
    });
    currentY += 6;
    
    data.forEach(row => {
      headers.forEach((header, index) => {
        const originalHeader = this.getVisibleHeaders()[index];
        let cellText = '';
        
        if (originalHeader === 'products') {
          cellText = row[originalHeader]?.length ? 
            row[originalHeader][0].name + (row[originalHeader].length > 1 ? ` +${row[originalHeader].length - 1} more` : '') : '';
        } else {
          cellText = String(row[originalHeader] ?? '');
        }
        
        doc.text(cellText, 14 + columnWidth * index, currentY);
      });
      currentY += 6;
      
      if (currentY > 280) {
        doc.addPage();
        currentY = 20;
      }
    });
    
    doc.save('ListAdjustment.pdf');
  }

  printData(): void {
    const dataToPrint = this.searchControl.value ? 
      this.filterAdjustments(this.searchControl.value.toLowerCase()) : 
      this.adjustmentsList;

    if (!dataToPrint.length) {
      alert('No data to print');
      return;
    }

    const visibleHeaders = this.getVisibleHeaders();
    let printContents = '<div style="padding: 20px;">';
    printContents += '<h1>Stock Adjustments</h1>';
    printContents += '<table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%;">';
    
    printContents += '<tr>';
    visibleHeaders.forEach(header => {
      printContents += `<th style="background-color: #f2f2f2;">${this.formatHeader(header)}</th>`;
    });
    printContents += '</tr>';
    
    dataToPrint.forEach(item => {
      printContents += '<tr>';
      visibleHeaders.forEach(header => {
        if (header === 'products') {
          const productText = item[header]?.length ? 
            item[header][0].name + (item[header].length > 1 ? ` +${item[header].length - 1} more` : '') : '';
          printContents += `<td>${productText}</td>`;
        } else {
          printContents += `<td>${item[header] || ''}</td>`;
        }
      });
      printContents += '</tr>';
    });
    
    printContents += '</table></div>';
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(`
        <html>
          <head>
            <title>Stock Adjustments</title>
            <style>
              body { font-family: Arial, sans-serif; }
              table { border-collapse: collapse; width: 100%; }
              th, td { padding: 8px; text-align: left; border: 1px solid #ddd; }
              th { background-color: #f2f2f2; }
              h1 { color: #333; }
              @media print {
                button { display: none; }
              }
            </style>
          </head>
          <body>
            ${printContents}
            <button onclick="window.print()" style="margin-top: 20px; padding: 10px 20px;">Print</button>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  }

  // Helper functions
  private formatHeader(header: string): string {
    return header
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase());
  }

  private prepareDataForExport(data: any[], visibleHeaders?: string[]): any[] {
    const headers = visibleHeaders || this.getVisibleHeaders();
    return data.map(item => {
      const exportItem: any = {};
      headers.forEach(header => {
        if (header === 'products') {
          exportItem[header] = item[header]?.length ? 
            item[header][0].name + (item[header].length > 1 ? ` +${item[header].length - 1} more` : '') : '';
        } else {
          exportItem[header] = item[header];
        }
      });
      return exportItem;
    });
  }

  private convertToCSV(data: any[], headers: string[]): string {
    let csv = headers.map(header => `"${this.formatHeader(header)}"`).join(',') + '\r\n';
    
    data.forEach(item => {
      const row = headers.map(header => {
        let value = '';
        if (header === 'products') {
          value = item[header]?.length ? 
            item[header][0].name + (item[header].length > 1 ? ` +${item[header].length - 1} more` : '') : '';
        } else {
          value = item[header] || '';
        }
        return `"${String(value).replace(/"/g, '""')}"`;
      }).join(',');
      csv += row + '\r\n';
    });
    
    return csv;
  }
}