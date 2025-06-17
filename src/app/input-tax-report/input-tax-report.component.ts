// input-tax-report.component.ts
import { Component, OnInit } from '@angular/core';
import { PurchaseService } from '../services/purchase.service';
import { DatePipe } from '@angular/common';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { SupplierService } from '../services/supplier.service';
interface SummaryData {
  totalPurchases: number;
  totalTax: number;
  totalCGST: number;
  totalSGST: number;
  totalDiscount: number;
  totalSubtotal: number;
}
interface Purchase {
  id: string;
  purchaseDate?: string;
  referenceNo?: string;
  invoiceNo?: string;
  businessLocation?: string;
  supplier?: string;
  
  supplierAddress?: string;
  purchaseStatus?: string;
    discountAmount?: number;
  purchaseTotal?: number;
  paymentMethod?: string;
  totalTax?: number;
  cgst?: number;
  sgst?: number;
  grandTotal?: number;
  paymentAccount?: {
    name: string;
    accountNumber?: string;
  };
  paymentDue?: number;
}

interface SummaryData {
  totalPurchases: number;
  totalTax: number;
  totalCGST: number;
  totalSGST: number;
}

@Component({
  selector: 'app-input-tax-report',
  templateUrl: './input-tax-report.component.html',
  styleUrls: ['./input-tax-report.component.scss'],
  providers: [DatePipe]
})
export class InputTaxReportComponent implements OnInit {
  allPurchases: Purchase[] = [];
  filteredPurchases: Purchase[] = [];
    totalGrandTotal: number = 0; // Add this line

  isLoading = true;
  itemsPerPage = 25;
  currentPage = 1;
  totalPages = 1;
  purchases: any[] = []; // this should be filled with your purchase data

  sortColumn = 'date';
  sortDirection: 'asc' | 'desc' = 'desc';
summaryData: SummaryData = {
  totalPurchases: 0,
  totalTax: 0,
  totalCGST: 0,
  totalSGST: 0,
  totalDiscount: 0,
  totalSubtotal: 0
};
  dateFilter = {
    startDate: '',
    endDate: ''
  };
  supplierFilter = '';
  uniqueSuppliers: string[] = [];
  filteredSuppliers: string[] = [];
  supplierSearchText = '';


  constructor(
    private purchaseService: PurchaseService,
    private supplierService: SupplierService,
    private datePipe: DatePipe
  ) {}

  ngOnInit(): void {
    this.loadPurchases();
    this.loadSuppliers();
      this.calculateTotalGrandTotal();

  }
calculateTotalGrandTotal() {
  this.totalGrandTotal = this.purchases.reduce((sum, p) => {
    return sum + (p.grandTotal || 0);
  }, 0);
}
  loadPurchases(): void {
    this.isLoading = true;
    this.purchaseService.getPurchases().subscribe({
      next: (purchases: any[]) => {
        this.allPurchases = purchases.map(p => ({
          id: p.id,
          purchaseDate: this.formatDate(p.purchaseDate),
          referenceNo: p.referenceNo,
          invoiceNo: p.invoiceNo,
          businessLocation: p.businessLocation,
          supplier: p.supplier || p.supplierName,
          supplierAddress: p.supplierAddress,
          purchaseStatus: p.purchaseStatus,
          paymentMethod: p.paymentMethod,
          totalTax: p.totalTax || 0,
            discountAmount: p.discountAmount || 0,
  purchaseTotal: p.purchaseTotal || 0,

          cgst: p.cgst || 0,
          sgst: p.sgst || 0,
          grandTotal: p.grandTotal || 0,
          paymentAccount: p.paymentAccount,
          paymentDue: p.paymentDue || 0
        }));

        this.applyFilters();
        this.calculateSummary();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading purchases:', error);
        this.isLoading = false;
      }
    });
  }

  loadSuppliers(): void {
    this.supplierService.getSuppliers().subscribe({
      next: (suppliers: any[]) => {
        this.uniqueSuppliers = suppliers
          .map(s => this.getSupplierDisplayName(s))
          .filter((name, index, self) => name && self.indexOf(name) === index)
          .sort();
        
        this.filteredSuppliers = [...this.uniqueSuppliers];
      },
      error: (error) => {
        console.error('Error loading suppliers:', error);
      }
    });
  }

  getSupplierDisplayName(supplier: any): string {
    if (!supplier) return '';
    if (supplier.isIndividual) {
      return `${supplier.firstName || ''} ${supplier.lastName || ''}`.trim();
    }
    return supplier.businessName || '';
  }

  filterSuppliers(): void {
    if (!this.supplierSearchText) {
      this.filteredSuppliers = [...this.uniqueSuppliers];
      return;
    }
    
    const searchText = this.supplierSearchText.toLowerCase();
    this.filteredSuppliers = this.uniqueSuppliers.filter(supplier => 
      supplier.toLowerCase().includes(searchText)
  )}

  applyFilters(): void {
    let filtered = [...this.allPurchases];

    // Apply date filter
    if (this.dateFilter.startDate || this.dateFilter.endDate) {
      filtered = filtered.filter(purchase => {
        const purchaseDate = new Date(purchase.purchaseDate || '').getTime();
        const startDate = this.dateFilter.startDate ? new Date(this.dateFilter.startDate).getTime() : 0;
        const endDate = this.dateFilter.endDate ? new Date(this.dateFilter.endDate).getTime() : Date.now();
        
        return purchaseDate >= startDate && purchaseDate <= endDate;
      });
    }

    // Apply supplier filter
    if (this.supplierFilter) {
      filtered = filtered.filter(purchase => 
        purchase.supplier === this.supplierFilter
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      const valueA = a[this.sortColumn as keyof Purchase] || '';
      const valueB = b[this.sortColumn as keyof Purchase] || '';

      if (valueA < valueB) {
        return this.sortDirection === 'asc' ? -1 : 1;
      } else if (valueA > valueB) {
        return this.sortDirection === 'asc' ? 1 : -1;
      }
      return 0;
    });

    this.filteredPurchases = filtered;
    this.totalPages = Math.ceil(this.filteredPurchases.length / this.itemsPerPage);
    this.changePage(1);
    this.calculateSummary();
  }

  resetFilters(): void {
    this.dateFilter = { startDate: '', endDate: '' };
    this.supplierFilter = '';
    this.applyFilters();
  }

  sortTable(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.applyFilters();
  }

  getSortIcon(column: string): string {
    if (this.sortColumn !== column) {
      return 'fa-sort';
    }
    return this.sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
  }

  getStatusClass(status: string | undefined): string {
    if (!status) return 'status-unknown';
    
    status = status.toLowerCase();
    if (status === 'received' || status === 'paid') {
      return 'status-active';
    } else if (status === 'pending' || status === 'due') {
      return 'status-inactive';
    } else if (status === 'partial') {
      return 'status-partial';
    }
    return 'status-unknown';
  }

  calculateTotal(property: keyof Purchase): string {
    const total = this.filteredPurchases.reduce((sum, purchase) => {
      return sum + (Number(purchase[property]) || 0);
    }, 0);
    return total.toFixed(2);
  }
calculateSummary(): void {
  this.summaryData = {
    totalPurchases: this.filteredPurchases.reduce((sum, p) => sum + (p.grandTotal || 0), 0),
    totalTax: this.filteredPurchases.reduce((sum, p) => sum + (p.totalTax || 0), 0),
    totalCGST: this.filteredPurchases.reduce((sum, p) => sum + (p.cgst || 0), 0),
    totalSGST: this.filteredPurchases.reduce((sum, p) => sum + (p.sgst || 0), 0),
    // Add these if you want them in your summary cards
    totalDiscount: this.filteredPurchases.reduce((sum, p) => sum + (p.discountAmount || 0), 0),
    totalSubtotal: this.filteredPurchases.reduce((sum, p) => sum + (p.purchaseTotal || 0), 0)
  };
}
  changePage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    
    this.currentPage = page;
    const startIndex = (page - 1) * this.itemsPerPage;
    const endIndex = Math.min(startIndex + this.itemsPerPage, this.filteredPurchases.length);
    this.filteredPurchases = this.allPurchases.slice(startIndex, endIndex);
  }

  getPages(): number[] {
    const pages: number[] = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = startPage + maxVisiblePages - 1;

    if (endPage > this.totalPages) {
      endPage = this.totalPages;
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return pages;
  }

  exportToCSV(): void {
    const headers = [
      'Date', 'Reference No', 'Invoice No', 'To Location', 'Supplier', 'From Address',
      'Status', 'Payment Method', 'Tax', 'CGST', 'SGST', 'Grand Total', 
      'Payment Account', 'Payment Due' , 'Discount', 'Subtotal',

    ];
    
    const data = this.filteredPurchases.map(purchase => [
      purchase.purchaseDate || 'N/A',
      purchase.referenceNo || 'N/A',
      purchase.invoiceNo || 'N/A',
      purchase.businessLocation || 'N/A',
      purchase.supplier || 'N/A',
      purchase.supplierAddress || 'N/A',
      purchase.purchaseStatus || 'N/A',
       `₹ ${purchase.discountAmount?.toFixed(2) || '0.00'}`,
  `₹ ${purchase.purchaseTotal?.toFixed(2) || '0.00'}`,
      purchase.paymentMethod || 'N/A',
      `₹ ${purchase.totalTax?.toFixed(2) || '0.00'}`,
      `₹ ${purchase.cgst?.toFixed(2) || '0.00'}`,
      `₹ ${purchase.sgst?.toFixed(2) || '0.00'}`,
      `₹ ${purchase.grandTotal?.toFixed(2) || '0.00'}`,
      purchase.paymentAccount?.name || 'N/A',
      `₹ ${purchase.paymentDue?.toFixed(2) || '0.00'}`
    ]);

    let csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(',') + '\n'
      + data.map(row => row.join(',')).join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `input_tax_report_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  exportToExcel(): void {
    const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(this.filteredPurchases.map(purchase => ({
      'Date': purchase.purchaseDate || 'N/A',
      'Reference No': purchase.referenceNo || 'N/A',
      'Invoice No': purchase.invoiceNo || 'N/A',
      'To Location': purchase.businessLocation || 'N/A',
      'Supplier': purchase.supplier || 'N/A',
      'From Address': purchase.supplierAddress || 'N/A',
      'Status': purchase.purchaseStatus || 'N/A',
      'Payment Method': purchase.paymentMethod || 'N/A',
      'Tax': `₹ ${purchase.totalTax?.toFixed(2) || '0.00'}`,
      'CGST': `₹ ${purchase.cgst?.toFixed(2) || '0.00'}`,
      'SGST': `₹ ${purchase.sgst?.toFixed(2) || '0.00'}`,
      'Grand Total': `₹ ${purchase.grandTotal?.toFixed(2) || '0.00'}`,
      'Payment Account': purchase.paymentAccount?.name || 'N/A',
      'Payment Due': `₹ ${purchase.paymentDue?.toFixed(2) || '0.00'}`
    })));

    const workbook: XLSX.WorkBook = { Sheets: { 'InputTax': worksheet }, SheetNames: ['InputTax'] };
    const excelBuffer: any = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    this.saveAsExcelFile(excelBuffer, `input_tax_report_${new Date().toISOString().slice(0,10)}`);
  }

  private saveAsExcelFile(buffer: any, fileName: string): void {
    const data: Blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(data);
    link.download = `${fileName}.xlsx`;
    link.click();
  }

  exportToPDF(): void {
    const doc = new jsPDF('landscape');
    const title = 'Input Tax Report';
    const currentDate = new Date().toLocaleDateString();
    
    doc.setFontSize(18);
    doc.text(title, 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${currentDate}`, 14, 22);
    
    const headers = [
      ['Date', 'Ref No', 'Inv No', 'To Location', 'Supplier', 'From Address', 
       'Status', 'Payment', 'Tax', 'CGST', 'SGST', 'Total', 'Account', 'Due']
    ];
    
    const data = this.filteredPurchases.map(purchase => [
      purchase.purchaseDate || '',
      purchase.referenceNo || '',
      purchase.invoiceNo || '',
      purchase.businessLocation || '',
      purchase.supplier || '',
      purchase.supplierAddress || '',
      purchase.purchaseStatus || '',
      purchase.paymentMethod || '',
      `₹ ${purchase.totalTax?.toFixed(2) || '0.00'}`,
      `₹ ${purchase.cgst?.toFixed(2) || '0.00'}`,
      `₹ ${purchase.sgst?.toFixed(2) || '0.00'}`,
      `₹ ${purchase.grandTotal?.toFixed(2) || '0.00'}`,
      purchase.paymentAccount?.name || '',
      `₹ ${purchase.paymentDue?.toFixed(2) || '0.00'}`
    ]);
    
    (doc as any).autoTable({
      head: headers,
      body: data,
      startY: 30,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 15 },
        1: { cellWidth: 15 },
        2: { cellWidth: 15 },
        3: { cellWidth: 15 },
        4: { cellWidth: 20 },
        5: { cellWidth: 20 },
        6: { cellWidth: 12 },
        7: { cellWidth: 15 },
        8: { cellWidth: 10 },
        9: { cellWidth: 10 },
        10: { cellWidth: 10 },
        11: { cellWidth: 15 },
        12: { cellWidth: 15 },
        13: { cellWidth: 15 }
      }
    });
    
    // Add summary
    (doc as any).autoTable({
      body: [
        ['Total Purchases:', `₹ ${this.summaryData.totalPurchases.toFixed(2)}`],
        ['Total Tax:', `₹ ${this.summaryData.totalTax.toFixed(2)}`],
        ['Total CGST:', `₹ ${this.summaryData.totalCGST.toFixed(2)}`],
        ['Total SGST:', `₹ ${this.summaryData.totalSGST.toFixed(2)}`]
      ],
      startY: (doc as any).lastAutoTable.finalY + 10,
      styles: { fontSize: 9, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 30 }
      }
    });
    
    doc.save(`input_tax_report_${new Date().toISOString().slice(0,10)}.pdf`);
  }

  print(): void {
    window.print();
  }

  private formatDate(date: any): string {
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
      console.error('Error formatting date:', e);
      return '';
    }
  }
}