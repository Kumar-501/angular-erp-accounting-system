import { Component, OnInit } from '@angular/core';
import { QuotationService } from '../services/quotations.service';
import { Router } from '@angular/router';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-list-quotations',
  templateUrl: './list-quotations.component.html',
  styleUrls: ['./list-quotations.component.scss']
})
export class ListQuotationsComponent implements OnInit {
  quotations: any[] = [];
  filteredQuotations: any[] = [];
  searchText: string = '';
  itemsPerPage: number = 10;
  public Math = Math;
  currentPage: number = 1;
  sortDirection: 'asc' | 'desc' = 'asc';
  sortField: string = 'saleDate';
  showColumnVisibilityCard: boolean = false;

  columnDefinitions = [
    { key: 'referenceNo', label: 'Reference No' },
    { key: 'customer', label: 'Customer' },
    { key: 'saleDate', label: 'Date' },
    { key: 'products', label: 'Products' },
    { key: 'totalPayable', label: 'Amount' },
    { key: 'status', label: 'Status' }
  ];

  columnsVisibility: { [key: string]: boolean } = {
    referenceNo: true,
    customer: true,
    saleDate: true,
    products: true,
    totalPayable: true,
    status: true
  };

  constructor(
    private quotationsService: QuotationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.fetchQuotations();
  }

  fetchQuotations(): void {
    this.quotationsService.getAllQuotations().subscribe(
      data => {
        this.quotations = data;
        this.applyFilter();
      },
      error => {
        console.error('Error fetching quotations', error);
      }
    );
  }

  applyFilter(): void {
    this.currentPage = 1;
    this.filteredQuotations = this.quotations.filter(quote => {
      // Base search on customer and reference number
      const baseSearch = quote.customer?.toLowerCase().includes(this.searchText.toLowerCase()) ||
                        quote.referenceNo?.toLowerCase().includes(this.searchText.toLowerCase());
      
      // Add search in product names
      const productSearch = quote.salesOrder?.some((item: any) => 
        item.productName?.toLowerCase().includes(this.searchText.toLowerCase())
      );
      
      return baseSearch || productSearch;
    });
    
    this.sort(this.sortField);
  }

  sort(field: string): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }

    this.filteredQuotations.sort((a, b) => {
      let valueA: any = a[field] || '';
      let valueB: any = b[field] || '';
      
      // Special handling for date fields
      if (field === 'saleDate') {
        valueA = new Date(valueA).getTime();
        valueB = new Date(valueB).getTime();
        return this.sortDirection === 'asc' ? valueA - valueB : valueB - valueA;
      }
      
      // Special handling for numerical fields
      if (field === 'totalPayable') {
        valueA = parseFloat(valueA) || 0;
        valueB = parseFloat(valueB) || 0;
        return this.sortDirection === 'asc' ? valueA - valueB : valueB - valueA;
      }
      
      // Default string comparison
      return this.sortDirection === 'asc'
        ? String(valueA).localeCompare(String(valueB))
        : String(valueB).localeCompare(String(valueA));
    });
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  nextPage(): void {
    if (this.currentPage * this.itemsPerPage < this.filteredQuotations.length) {
      this.currentPage++;
    }
  }

  viewQuotation(id: string): void {
    this.router.navigate([`/view-quotation/${id}`]);
  }

  navigateToQuotation(): void {
    this.router.navigate(['/add-quotation']);
  }

  onDelete(id: string): void {
    if (confirm('Are you sure you want to delete this quotation?')) {
      this.quotationsService.deleteQuotation(id)
        .then(() => this.fetchQuotations())
        .catch(error => console.error('Error deleting quotation:', error));
    }
  }

  convertToSalesOrder(id: string): void {
    if (confirm('Are you sure you want to convert this quotation to a sales order? The quotation will be removed.')) {
      // Get the quotation data
      this.quotationsService.getQuotationById(id).subscribe(
        quotation => {
          // Store quotation in localStorage to pass data to the add-sale component
          localStorage.setItem('quotationToSalesOrder', JSON.stringify(quotation));
          
          // Delete the quotation
          this.quotationsService.deleteQuotation(id)
            .then(() => {
              // Navigate to add-sale page
              this.router.navigate(['/add-sale', { fromQuotation: 'true' }]);
            })
            .catch(error => console.error('Error deleting quotation:', error));
        },
        error => {
          console.error('Error fetching quotation details:', error);
          alert('Error converting quotation to sales order. Please try again.');
        }
      );
    }
  }

  getProductsInfo(salesOrder: any[]): string {
    if (!salesOrder || salesOrder.length === 0) {
      return 'No products';
    }
    
    return salesOrder.map(item => `${item.productName} (${item.quantity})`).join(', ');
  }

  exportCSV(): void {
    const visibleColumns = this.columnDefinitions.filter(col => this.columnsVisibility[col.key]);
    const headers = visibleColumns.map(col => col.label);

    const rows = this.filteredQuotations.map(quote => {
      return visibleColumns.map(col => {
        switch (col.key) {
          case 'saleDate':
            return new Date(quote[col.key]).toLocaleDateString();
          case 'totalPayable':
            return quote[col.key] ? `${quote[col.key].toString()}` : '';
          case 'products':
            return this.getProductsInfo(quote.salesOrder);
          default:
            return quote[col.key] || 'N/A';
        }
      });
    });

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'quotations.csv';
    link.click();
    window.URL.revokeObjectURL(url);
  }

  exportExcel(): void {
    const visibleColumns = this.columnDefinitions.filter(col => this.columnsVisibility[col.key]);
    const data = this.filteredQuotations.map(quote => {
      const row: any = {};
      visibleColumns.forEach(col => {
        if (col.key === 'saleDate') {
          row[col.label] = new Date(quote[col.key]).toLocaleDateString();
        } else if (col.key === 'products') {
          row[col.label] = this.getProductsInfo(quote.salesOrder);
        } else {
          row[col.label] = quote[col.key] || 'N/A';
        }
      });
      return row;
    });

    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Quotations');
    XLSX.writeFile(wb, 'quotations.xlsx');
  }

  printTable(): void {
    const printWindow = window.open('', '', 'height=600,width=800');
    if (printWindow) {
      printWindow.document.write('<html><head><title>Print</title><style>');
      printWindow.document.write(`
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .status-badge { padding: 3px 6px; border-radius: 3px; font-size: 12px; }
        .shipped { background-color: #ffcc00; color: #000; }
        .pending { background-color: #ff6666; color: #fff; }
        .delivered { background-color: #66cc66; color: #fff; }
        .product-item { margin-bottom: 4px; }
      `);
      printWindow.document.write('</style></head><body><table><thead><tr>');

      this.columnDefinitions.forEach(col => {
        if (this.columnsVisibility[col.key]) {
          printWindow?.document.write(`<th>${col.label}</th>`);
        }
      });

      printWindow.document.write('<th>Action</th></tr></thead><tbody>');

      this.filteredQuotations.forEach(quote => {
        printWindow?.document.write('<tr>');
        this.columnDefinitions.forEach(col => {
          if (this.columnsVisibility[col.key]) {
            let content = '';
            if (col.key === 'saleDate') {
              content = new Date(quote[col.key]).toLocaleDateString();
            } else if (col.key === 'status') {
              const statusClass = quote.shippingStatus === 'shipped' ? 'shipped' :
                                 quote.shippingStatus === 'pending' ? 'pending' :
                                 quote.shippingStatus === 'delivered' ? 'delivered' : '';
              content = `<span class="status-badge ${statusClass}">${quote.shippingStatus || 'Pending'}</span>`;
            } else if (col.key === 'products') {
              if (quote.salesOrder && quote.salesOrder.length > 0) {
                content = quote.salesOrder.map((item: any) => 
                  `<div class="product-item">${item.productName} (Qty: ${item.quantity})</div>`
                ).join('');
              } else {
                content = 'No products';
              }
            } else {
              content = quote[col.key] || 'N/A';
            }
            printWindow?.document.write(`<td>${content}</td>`);
          }
        });
        printWindow?.document.write(`
          <td>
            <button class="view-btn">View</button>
            <button class="convert-btn">Convert to Sales Order</button>
            <button class="delete-btn">Delete</button>
          </td>
        `);
        printWindow?.document.write('</tr>');
      });

      printWindow.document.write('</tbody></table></body></html>');
      printWindow.document.close();
      printWindow.print();
    }
  }

  exportPDF(): void {
    const doc = new jsPDF();
    const visibleColumns = this.columnDefinitions.filter(col => this.columnsVisibility[col.key]);
    const headers = visibleColumns.map(col => col.label);

    const data = this.filteredQuotations.map(quote =>
      visibleColumns.map(col => {
        if (col.key === 'saleDate') {
          return new Date(quote[col.key]).toLocaleDateString();
        } else if (col.key === 'status') {
          return quote.shippingStatus || 'Pending';
        } else if (col.key === 'products') {
          return this.getProductsInfo(quote.salesOrder);
        } else {
          return quote[col.key] || 'N/A';
        }
      })
    );

    autoTable(doc, {
      head: [headers],
      body: data,
      startY: 20,
      styles: {
        fontSize: 8,
        cellPadding: 2,
        overflow: 'linebreak'
      },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: 'bold'
      }
    });

    doc.save('quotations.pdf');
  }

  toggleColumnVisibility(): void {
    this.showColumnVisibilityCard = !this.showColumnVisibilityCard;
  }

  applyColumnVisibility(): void {
    // Updates dynamically through ngIf bindings
  }

  atLeastOneColumnVisible(): boolean {
    return Object.values(this.columnsVisibility).some(visible => visible);
  }
}