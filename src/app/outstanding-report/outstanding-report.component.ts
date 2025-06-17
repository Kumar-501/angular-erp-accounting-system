// outstanding-report.component.ts
import { Component, OnInit } from '@angular/core';
import { PurchaseService } from '../services/purchase.service';
import { DatePipe } from '@angular/common';
import { MatSnackBar } from '@angular/material/snack-bar';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

interface Purchase {
  id: string;
  purchaseDate?: Date | string;
  referenceNo?: string;
  invoiceNo?: string;
  supplier?: string;
  supplierTaxNo?: string;
  purchaseStatus?: string;
  grandTotal?: number;
  paymentAmount?: number;
  paymentDue?: number;
  businessLocation?: string;
  addedBy?: string;
}

@Component({
  selector: 'app-outstanding-report',
  templateUrl: './outstanding-report.component.html',
  styleUrls: ['./outstanding-report.component.scss'],
  providers: [DatePipe]
})
export class OutstandingReportComponent implements OnInit {
  purchases: Purchase[] = [];
  filteredPurchases: Purchase[] = [];
  isLoading = true;
  searchText = '';
  dateFilter = {
    startDate: '',
    endDate: ''
  };
  statusFilter = '';
  locationFilter = '';
  uniqueLocations: string[] = [];
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  constructor(
    private purchaseService: PurchaseService,
    private datePipe: DatePipe,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadOutstandingPurchases();
  }
loadOutstandingPurchases(): void {
  this.isLoading = true;
  this.purchaseService.getPurchases().subscribe({
    next: (purchases: any[]) => {
      // Filter purchases with balance due > 0
      this.purchases = purchases
        .filter(p => (p.paymentDue || 0) > 0)
        .map(p => ({
          id: p.id,
          purchaseDate: this.getFormattedDate(p.purchaseDate),
          referenceNo: p.referenceNo,
          invoiceNo: p.invoiceNo,
          supplier: p.supplierName || 
                   (p.supplier?.businessName || 
                    `${p.supplier?.firstName || ''} ${p.supplier?.lastName || ''}`.trim()),
          supplierTaxNo: p.supplier?.taxNumber || p.supplierTaxNo || 'N/A', // Include tax number
          purchaseStatus: p.purchaseStatus,
          grandTotal: (p.paymentAmount || 0) + (p.paymentDue || 0),
          paymentAmount: p.paymentAmount || 0,
          paymentDue: p.paymentDue || 0,
          businessLocation: p.businessLocation,
          addedBy: p.addedBy?.name || p.addedBy || 'System'
        }));
      
      this.filteredPurchases = [...this.purchases];
      this.loadUniqueLocations();
      this.isLoading = false;
    },
    error: (error) => {
      this.snackBar.open('Failed to load outstanding purchases', 'Close', {
        duration: 3000,
        panelClass: ['snackbar-error']
      });
      this.isLoading = false;
    }
  });
}
// Update the export methods to include tax number
exportToExcel(): void {
  const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(
    this.filteredPurchases.map(p => ({
      'Date': p.purchaseDate || 'N/A',
      'Reference No': p.referenceNo || 'N/A',
      'Invoice No': p.invoiceNo || 'N/A',
      'Supplier': p.supplier || 'N/A',
      'Supplier Tax No': p.supplierTaxNo || 'N/A', // Include tax number in export
      'Status': p.purchaseStatus || 'N/A',
      'Grand Total': p.grandTotal?.toFixed(2) || '0.00',
      'Payment': p.paymentAmount?.toFixed(2) || '0.00',
      'Balance Due': p.paymentDue?.toFixed(2) || '0.00',
      'Location': p.businessLocation || 'N/A'
    }))
  );
  
  const workbook: XLSX.WorkBook = { Sheets: { 'Outstanding_Purchases': worksheet }, SheetNames: ['Outstanding_Purchases'] };
  XLSX.writeFile(workbook, `outstanding_purchases_${new Date().toISOString().slice(0,10)}.xlsx`);
}

exportToPDF(): void {
  const doc = new jsPDF();
  const title = 'Outstanding Purchases Report';
  
  doc.setFontSize(18);
  doc.text(title, 14, 15);
  doc.setFontSize(10);
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 22);
  
  (doc as any).autoTable({
    head: [['Date', 'Ref No', 'Invoice No', 'Supplier', 'Tax No', 'Status', 'Grand Total', 'Paid', 'Balance Due']],
    body: this.filteredPurchases.map(p => [
      p.purchaseDate || 'N/A',
      p.referenceNo || 'N/A',
      p.invoiceNo || 'N/A',
      p.supplier || 'N/A',
      p.supplierTaxNo || 'N/A', // Include tax number in PDF
      p.purchaseStatus || 'N/A',
      p.grandTotal?.toFixed(2) || '0.00',
      p.paymentAmount?.toFixed(2) || '0.00',
      p.paymentDue?.toFixed(2) || '0.00'
    ]),
    startY: 30,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [41, 128, 185], textColor: 255 }
  });
  
  doc.save(`outstanding_purchases_${new Date().toISOString().slice(0,10)}.pdf`);
}

  loadUniqueLocations(): void {
    // Filter out undefined/null values and get unique locations
    this.uniqueLocations = [...new Set(
      this.purchases
        .map(p => p.businessLocation)
        .filter((location): location is string => !!location)
    )];
  }

  private getFormattedDate(date: any): string {
    if (!date) return '';
    try {
      if (typeof date === 'object' && 'toDate' in date) {
        return this.datePipe.transform(date.toDate(), 'mediumDate') || '';
      } else if (date instanceof Date) {
        return this.datePipe.transform(date, 'mediumDate') || '';
      } else {
        return this.datePipe.transform(new Date(date), 'mediumDate') || '';
      }
    } catch (e) {
      return '';
    }
  }

  applyFilters(): void {
    let filtered = [...this.purchases];
    
    // Date filter
    if (this.dateFilter.startDate || this.dateFilter.endDate) {
      filtered = filtered.filter(purchase => {
        const purchaseDate = new Date(purchase.purchaseDate || '').getTime();
        const startDate = this.dateFilter.startDate ? new Date(this.dateFilter.startDate).getTime() : 0;
        const endDate = this.dateFilter.endDate ? new Date(this.dateFilter.endDate).getTime() : Date.now();
        
        return purchaseDate >= startDate && purchaseDate <= endDate;
      });
    }
    
    // Status filter
    if (this.statusFilter) {
      filtered = filtered.filter(purchase => 
        purchase.purchaseStatus?.toLowerCase() === this.statusFilter.toLowerCase()
      );
    }
    
    // Location filter
    if (this.locationFilter) {
      filtered = filtered.filter(purchase => 
        purchase.businessLocation === this.locationFilter
      );
    }
    
    // Search text filter
    if (this.searchText) {
      const searchTextLower = this.searchText.toLowerCase();
      filtered = filtered.filter(purchase => 
        (purchase.referenceNo && purchase.referenceNo.toLowerCase().includes(searchTextLower)) ||
        (purchase.invoiceNo && purchase.invoiceNo.toLowerCase().includes(searchTextLower)) ||
        (purchase.supplier && purchase.supplier.toLowerCase().includes(searchTextLower)) ||
        (purchase.supplierTaxNo && purchase.supplierTaxNo.toLowerCase().includes(searchTextLower))
      );
    }
    
    this.filteredPurchases = filtered;
  }

  sortTable(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    
    this.filteredPurchases.sort((a, b) => {
      const valueA = this.getSortValue(a, column);
      const valueB = this.getSortValue(b, column);
      
      if (valueA < valueB) {
        return this.sortDirection === 'asc' ? -1 : 1;
      } else if (valueA > valueB) {
        return this.sortDirection === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }

  private getSortValue(purchase: Purchase, column: string): any {
    switch (column) {
      case 'purchaseDate':
        return new Date(purchase.purchaseDate || '').getTime();
      case 'grandTotal':
      case 'paymentAmount':
      case 'paymentDue':
        return Number(purchase[column as keyof Purchase]) || 0;
      default:
        return purchase[column as keyof Purchase] || '';
    }
  }

  getTotal(property: string): number {
    return this.filteredPurchases.reduce((sum, purchase) => 
      sum + (Number(purchase[property as keyof Purchase]) || 0), 0);
  }



 

  print(): void {
    window.print();
  }

  resetFilters(): void {
    this.dateFilter = { startDate: '', endDate: '' };
    this.statusFilter = '';
    this.locationFilter = '';
    this.searchText = '';
    this.filteredPurchases = [...this.purchases];
  }
}