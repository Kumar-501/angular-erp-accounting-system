import { Component, OnInit, OnDestroy } from '@angular/core';
import { PurchaseReturnService } from '../services/purchase-return.service';
import { Subscription } from 'rxjs';
import { Modal } from 'bootstrap';
import * as XLSX from 'xlsx';
import * as FileSaver from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PurchaseReturn {
  id?: string;
  returnDate: string;
  referenceNo: string;
  parentPurchaseId: string;
  parentPurchaseRef: string;
  businessLocation: string;
  supplier: string;
  returnStatus: string;
  paymentStatus: string;
  products: any[];
  reason: string;
  grandTotal: number;
  createdAt: Date;
  createdBy: string;
}

@Component({
  selector: 'app-purchase-return',
  templateUrl: './purchase-return.component.html',
  styleUrls: ['./purchase-return.component.scss']
})
export class PurchaseReturnComponent implements OnInit, OnDestroy {
  purchaseReturns: PurchaseReturn[] = [];
  sortedPurchaseReturns: PurchaseReturn[] = [];
  isLoading = true;
  isUpdating = false;
  errorMessage: string | null = null;
  pageSize = 25;
  currentPage = 1;
  sortColumn: string = 'returnDate';
  sortDirection: 'asc' | 'desc' = 'desc';

  selectedReturn!: PurchaseReturn;
  tempStatus: string = '';
  private subscription!: Subscription;

  constructor(private purchaseReturnService: PurchaseReturnService) {}

  ngOnInit(): void {
    this.loadPurchaseReturns();
  }

  loadPurchaseReturns(): void {
    this.subscription = this.purchaseReturnService.getPurchaseReturns().subscribe({
      next: (data) => {
        this.purchaseReturns = data;
        this.sortData();
        this.isLoading = false;
        this.errorMessage = null;
      },
      error: (err) => {
        this.errorMessage = 'Failed to load purchase returns. Please refresh or try again later.';
        this.isLoading = false;
      }
    });
  }

  ngOnDestroy(): void {
    if (this.subscription) this.subscription.unsubscribe();
  }

  get totalRecords(): number {
    return this.purchaseReturns.length;
  }

  get totalGrandTotal(): number {
    return this.purchaseReturns.reduce((sum, item) => sum + item.grandTotal, 0);
  }

  get totalPaymentDue(): number {
    return this.purchaseReturns.reduce((sum, item) => sum + item.grandTotal, 0);
  }

  getStatusClass(status: string): string {
    const statusMap: Record<string, string> = {
      'completed': 'badge bg-success',
      'pending': 'badge bg-warning text-dark',
      'partial': 'badge bg-info',
      'rejected': 'badge bg-danger',
    };
    return statusMap[status.toLowerCase()] || 'badge bg-secondary';
  }

  sort(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.sortData();
  }

  sortData(): void {
    this.sortedPurchaseReturns = [...this.purchaseReturns].sort((a, b) => {
      const aValue = a[this.sortColumn as keyof PurchaseReturn];
      const bValue = b[this.sortColumn as keyof PurchaseReturn];
  
      // Handle undefined/null values
      if (aValue === undefined || aValue === null) return 1;
      if (bValue === undefined || bValue === null) return -1;
      if (aValue === undefined && bValue === undefined) return 0;
      if (aValue === null && bValue === null) return 0;
  
      // For string comparison
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return this.sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
  
      // For number comparison
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return this.sortDirection === 'asc' 
          ? aValue - bValue
          : bValue - aValue;
      }
  
      // Fallback for other types
      return this.sortDirection === 'asc'
        ? String(aValue).localeCompare(String(bValue))
        : String(bValue).localeCompare(String(aValue));
    });
  }

  onDelete(id: string): void {
    if (confirm('Delete this purchase return? This action cannot be undone.')) {
      this.purchaseReturnService.deletePurchaseReturn(id)
        .then(() => {
          this.purchaseReturns = this.purchaseReturns.filter(item => item.id !== id);
          this.sortData();
        })
        .catch(err => this.errorMessage = 'Delete failed. Please try again.');
    }
  }

  onExport(format: string): void {
    if (format === 'excel') {
      const worksheet = XLSX.utils.json_to_sheet(this.purchaseReturns);
      const workbook = { Sheets: { 'PurchaseReturns': worksheet }, SheetNames: ['PurchaseReturns'] };
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      FileSaver.saveAs(new Blob([excelBuffer], { type: 'application/octet-stream' }), 'PurchaseReturns.xlsx');
    } else if (format === 'csv') {
      const worksheet = XLSX.utils.json_to_sheet(this.purchaseReturns);
      const csv = XLSX.utils.sheet_to_csv(worksheet);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      FileSaver.saveAs(blob, 'PurchaseReturns.csv');
    } else if (format === 'pdf') {
      const doc = new jsPDF();
      const headers = [['Return Date', 'Reference No', 'Supplier', 'Status', 'Payment', 'Grand Total']];
      const rows = this.purchaseReturns.map(item => [
        item.returnDate,
        item.referenceNo,
        item.supplier,
        item.returnStatus,
        item.paymentStatus,
        item.grandTotal.toFixed(2)
      ]);

      autoTable(doc, {
        head: headers,
        body: rows,
        startY: 20,
        theme: 'striped',
        headStyles: { fillColor: [41, 128, 185] }
      });

      doc.save('PurchaseReturns.pdf');
    } else if (format === 'print') {
      const printSection = document.getElementById('print-section');
      if (!printSection) {
        console.error('Print section not found');
        return;
      }
      
      const popupWin = window.open('', '_blank', 'width=1000,height=800');
      if (!popupWin) {
        alert('Please allow pop-ups for printing');
        return;
      }
      
      const printContents = printSection.innerHTML;
      
      popupWin.document.open();
      popupWin.document.write(`
        <html>
          <head>
            <title>Purchase Return Print</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
              th { background-color: #f4f4f4; }
              h2 { text-align: center; }
              p { text-align: right; }
              tfoot td { font-weight: bold; }
            </style>
          </head>
          <body>
            ${printContents}
            <script>
              window.onload = function() {
                window.print();
                window.setTimeout(function() {
                  window.close();
                }, 500);
              }
            </script>
          </body>
        </html>
      `);
      popupWin.document.close();
    }
  }

  openStatusModal(returnItem: PurchaseReturn): void {
    this.selectedReturn = returnItem;
    this.tempStatus = returnItem.returnStatus;
  }

  updateReturnStatus(id: string, newStatus: string): void {
    this.isUpdating = true;
    this.purchaseReturnService.updatePurchaseReturn(id, {
      returnStatus: newStatus
    })
    .then(() => {
      const index = this.purchaseReturns.findIndex(item => item.id === id);
      if (index !== -1) {
        this.purchaseReturns[index].returnStatus = newStatus;
        this.sortData();
      }
      this.isUpdating = false;
      const modalElement = document.getElementById('statusModal');
      if (modalElement) {
        const modalInstance = Modal.getInstance(modalElement);
        modalInstance?.hide();
      }
    })
    .catch(err => {
      this.errorMessage = 'Failed to update status. Please try again.';
      this.isUpdating = false;
    });
  }
}