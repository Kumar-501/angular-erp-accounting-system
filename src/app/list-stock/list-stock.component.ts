import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { StockService } from '../services/stock.service';
import { LocationService } from '../services/location.service';
import { ProductsService } from '../services/products.service';
import { Router } from '@angular/router';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

interface StockTransfer {
  locationFrom: string;
  locationTo: string;
  shippingCharges: number;
  totalAmount: number;
  products: any[];
  subtotal: number;
}

interface Stock {
  id: string;
  date: string;
  referenceNo: string;
  status: string;
  additionalNotes: string;
  grandTotal: number;
  locationTransfers: StockTransfer[];
  locationFrom: string;
  locationTo: string;
  shippingCharges: number;
  totalAmount: number;
}

interface Column {
  field: string;
  title: string;
  visible: boolean;
}

interface Location {
  id: string;
  name: string;
}

@Component({
  selector: 'app-list-stock',
  templateUrl: './list-stock.component.html',
  styleUrls: ['./list-stock.component.scss']
})
export class ListStockComponent implements OnInit {
  stockList: Stock[] = [];
  filteredStocks: Stock[] = [];
  paginatedStocks: Stock[] = [];
  locations: Location[] = [];
  allProducts: any[] = []; // Added missing array for products

  searchControl = new FormControl('');
  sortField: string = 'date';
  sortDirection: 'asc' | 'desc' = 'desc';
  currentPage: number = 1;
  entriesPerPage: number = 25;
  totalPages: number = 1;
  highlightedRowId: string | null = null;
  showDeleteModal: boolean = false;
  stockToDelete: Stock | null = null;
  showColumnModal: boolean = false;
  isDeleting: boolean = false;
  showColumnDropdown = false;

  columns: Column[] = [
    { field: 'date', title: 'Date', visible: true },
    { field: 'referenceNo', title: 'Reference No', visible: true },
    { field: 'locationFrom', title: 'Location (From)', visible: true },
    { field: 'locationTo', title: 'Location (To)', visible: true },
    { field: 'products', title: 'Products', visible: true }, // New column
    { field: 'status', title: 'Status', visible: true },
    { field: 'shippingCharges', title: 'Shipping Charges', visible: true },
    { field: 'totalAmount', title: 'Total Amount', visible: true },
    { field: 'additionalNotes', title: 'Additional Notes', visible: true },
    { field: 'actions', title: 'Actions', visible: true }
  ];

  Math = Math;

  constructor(
    private stockService: StockService,
    private router: Router,
    private locationService: LocationService,
    private productService: ProductsService // Added ProductsService
  ) {}

  getProductNames(stock: Stock): string {
    if (!stock.locationTransfers || stock.locationTransfers.length === 0) {
      return '-';
    }
    
    // Get products from all transfers
    const productsList: string[] = [];
    stock.locationTransfers.forEach(transfer => {
      if (transfer.products && transfer.products.length > 0) {
        transfer.products.forEach(product => {
          if (product.product) {
            // Find product name if available
            const productObj = this.allProducts.find(p => p.id === product.product);
            const productName = productObj ? productObj.productName : product.product;
            // Add product name with quantity
            productsList.push(`${productName} (${product.quantity})`);
          }
        });
      }
    });
    
    // Display up to 3 products + "and X more" if applicable
    if (productsList.length === 0) {
      return '-';
    } else if (productsList.length <= 3) {
      return productsList.join(', ');
    } else {
      return `${productsList.slice(0, 3).join(', ')} and ${productsList.length - 3} more`;
    }
  }

  ngOnInit(): void {
    this.loadLocations();
    this.loadProducts(); // Add this call to load products
    this.loadStocks();

    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(() => {
        this.currentPage = 1;
        this.applyFilters();
      });
  }

  // Add method to load products
  loadProducts(): void {
    this.productService.getProductsRealTime().subscribe({
      next: (products: any[]) => {
        this.allProducts = products;
        // If we already have stock data, we might need to update the display
        if (this.stockList.length > 0) {
          this.applyFilters();
        }
      },
      error: (error) => {
        console.error('Error loading products:', error);
      }
    });
  }

  loadStocks(): void {
    this.stockService.getStockList().subscribe({
      next: (data: any[]) => {
        // Map the data to match your Stock interface
        this.stockList = data.map((item: any) => {
          // Extract location transfer data from the first transfer if available
          const firstTransfer = item.locationTransfers && item.locationTransfers.length > 0 
            ? item.locationTransfers[0] 
            : null;
          
          return {
            id: item.id,
            date: item.date,
            referenceNo: item.referenceNo,
            status: item.status,
            additionalNotes: item.additionalNotes || '',
            grandTotal: item.grandTotal || 0,
            locationTransfers: item.locationTransfers || [],
            // Use data from first transfer or fallback to empty values
            locationFrom: firstTransfer ? firstTransfer.locationFrom : '',
            locationTo: firstTransfer ? firstTransfer.locationTo : '',
            shippingCharges: firstTransfer ? firstTransfer.shippingCharges : 0,
            totalAmount: firstTransfer ? firstTransfer.totalAmount : 0
          };
        });
        this.applyFilters();
      },
      error: (error) => {
        console.error('Error loading stocks:', error);
      }
    });
  }

  loadLocations(): void {
    this.locationService.getLocations().subscribe((locations: Location[]) => {
      this.locations = locations;
      // If we already have stock data, we need to update the display
      if (this.stockList.length > 0) {
        this.applyFilters();
      }
    });
  }

  applyFilters(): void {
    const searchTerm = this.searchControl.value?.toLowerCase() || '';
    
    this.filteredStocks = !searchTerm
      ? [...this.stockList]
      : this.stockList.filter(stock => {
          // Basic fields search
          if (stock.referenceNo?.toLowerCase().includes(searchTerm) ||
              stock.status?.toLowerCase().includes(searchTerm)) {
            return true;
          }

          // Search in locations
          const fromLocation = this.getLocationName(stock.locationFrom).toLowerCase();
          const toLocation = this.getLocationName(stock.locationTo).toLowerCase();
          
          if (fromLocation.includes(searchTerm) || toLocation.includes(searchTerm)) {
            return true;
          }
          
          // Search in product names
          if (stock.locationTransfers) {
            for (const transfer of stock.locationTransfers) {
              if (transfer.products) {
                for (const product of transfer.products) {
                  const productObj = this.allProducts.find(p => p.id === product.product);
                  if (productObj && productObj.productName.toLowerCase().includes(searchTerm)) {
                    return true;
                  }
                }
              }
            }
          }
          
          return false;
        });

    this.applySorting();
    this.updatePagination();
  }

  applySorting(): void {
    this.filteredStocks.sort((a, b) => {
      let valueA, valueB;

      // Handle special cases for nested properties
      switch (this.sortField) {
        case 'date':
          valueA = new Date(a.date).getTime();
          valueB = new Date(b.date).getTime();
          break;
        case 'referenceNo':
          valueA = a.referenceNo?.toLowerCase() || '';
          valueB = b.referenceNo?.toLowerCase() || '';
          break;
        case 'status':
          valueA = a.status?.toLowerCase() || '';
          valueB = b.status?.toLowerCase() || '';
          break;
        case 'locationFrom':
          valueA = this.getLocationName(a.locationFrom).toLowerCase();
          valueB = this.getLocationName(b.locationFrom).toLowerCase();
          break;
        case 'locationTo':
          valueA = this.getLocationName(a.locationTo).toLowerCase();
          valueB = this.getLocationName(b.locationTo).toLowerCase();
          break;
        case 'products':
          valueA = this.getProductNames(a).toLowerCase();
          valueB = this.getProductNames(b).toLowerCase();
          break;
        case 'shippingCharges':
          valueA = Number(a.shippingCharges) || 0;
          valueB = Number(b.shippingCharges) || 0;
          break;
        case 'totalAmount':
          valueA = Number(a.totalAmount) || 0;
          valueB = Number(b.totalAmount) || 0;
          break;
        default:
          valueA = a[this.sortField as keyof Stock];
          valueB = b[this.sortField as keyof Stock];
          
          if (typeof valueA === 'string') {
            valueA = valueA.toLowerCase();
          }
          if (typeof valueB === 'string') {
            valueB = valueB.toLowerCase();
          }
      }

      if (valueA < valueB) return this.sortDirection === 'asc' ? -1 : 1;
      if (valueA > valueB) return this.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  updatePagination(): void {
    this.totalPages = Math.ceil(this.filteredStocks.length / this.entriesPerPage);
    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages || 1;
    }

    const startIndex = (this.currentPage - 1) * this.entriesPerPage;
    this.paginatedStocks = this.filteredStocks.slice(startIndex, startIndex + this.entriesPerPage);
  }

  getPageNumbers(): (number | string)[] {
    const totalPages = this.totalPages;
    const currentPage = this.currentPage;

    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);

    if (currentPage <= 4) return [1, 2, 3, 4, 5, '...', totalPages];
    if (currentPage >= totalPages - 3) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }

    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
  }

  goToPage(page: number | string): void {
    if (typeof page === 'number' && page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePagination();
    }
  }

  sortBy(field: string): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }

    this.applySorting();
    this.updatePagination();
  }

  getSortIconClass(field: string): string {
    if (this.sortField !== field) return 'fas fa-sort';
    return this.sortDirection === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down';
  }

  getStatusClass(status: string): string {
    switch (status?.toLowerCase()) {
      case 'pending': return 'pending';
      case 'in transit': return 'in-transit';
      case 'completed': return 'completed';
      case 'cancelled': return 'cancelled';
      default: return '';
    }
  }

  getLocationName(locationId: string): string {
    if (!locationId) return '-';
    const location = this.locations.find(loc => loc.id === locationId);
    return location ? location.name : locationId;
  }

  addNewStock(): void {
    this.router.navigate(['/add-stock']);
  }

  editStock(stock: Stock): void {
    this.highlightedRowId = stock.id;
    this.router.navigate(['/edit-stock', stock.id]);
  }

  confirmDelete(stock: Stock): void {
    this.stockToDelete = stock;
    this.showDeleteModal = true;
  }

  deleteStock(): void {
    if (this.stockToDelete) {
      this.isDeleting = true;
      this.stockService.deleteStock(this.stockToDelete.id)
        .then(() => {
          console.log(`Stock ${this.stockToDelete?.referenceNo} deleted successfully`);
          // Remove the deleted item from the list
          this.stockList = this.stockList.filter(item => item.id !== this.stockToDelete?.id);
          this.applyFilters();
        })
        .catch(error => {
          console.error('Error deleting stock:', error);
        })
        .finally(() => {
          this.isDeleting = false;
          this.cancelDelete();
        });
    }
  }

  cancelDelete(): void {
    this.showDeleteModal = false;
    this.stockToDelete = null;
  }

  toggleColumnDropdown(): void {
    this.showColumnDropdown = !this.showColumnDropdown;
  }

  toggleColumn(field: string): void {
    const column = this.columns.find(col => col.field === field);
    if (column) column.visible = !column.visible;
  }

  resetColumns(): void {
    this.columns.forEach(column => column.visible = true);
  }

  applyColumnChanges(): void {
    this.showColumnDropdown = false;
  }

  exportData(format: 'csv' | 'excel' | 'pdf'): void {
    const visibleColumns = this.columns
      .filter(col => col.visible && col.field !== 'actions')
      .map(col => ({ title: col.title, field: col.field }));

    // Prepare data for export
    const data: any[] = this.filteredStocks.map(stock => {
      const row: any = {};
      
      visibleColumns.forEach(col => {
        switch (col.field) {
          case 'date':
            row[col.title] = this.formatDate(stock.date);
            break;
          case 'referenceNo':
            row[col.title] = stock.referenceNo || '-';
            break;
          case 'status':
            row[col.title] = stock.status ? (stock.status.charAt(0).toUpperCase() + stock.status.slice(1)) : '-';
            break;
          case 'additionalNotes':
            row[col.title] = stock.additionalNotes || '-';
            break;
          case 'locationFrom':
            row[col.title] = this.getLocationName(stock.locationFrom);
            break;
          case 'locationTo':
            row[col.title] = this.getLocationName(stock.locationTo);
            break;
          case 'products':
            row[col.title] = this.getProductNames(stock);
            break;
          case 'shippingCharges':
            row[col.title] = this.formatCurrency(Number(stock.shippingCharges) || 0);
            break;
          case 'totalAmount':
            row[col.title] = this.formatCurrency(Number(stock.totalAmount) || 0);
            break;
          default:
            row[col.title] = '-';
        }
      });
      
      return row;
    });

    switch (format) {
      case 'csv':
        this.exportToCSV(data, visibleColumns.map(col => col.title));
        break;
      case 'excel':
        this.exportToExcel(data, 'StockTransfers');
        break;
      case 'pdf':
        this.exportToPDF(data, visibleColumns.map(col => col.title), 'Stock Transfers');
        break;
    }
  }

  private exportToCSV(data: any[], headers: string[]): void {
    const csvRows = [];
    csvRows.push(headers.join(','));
    data.forEach(row => {
      const values = headers.map(header => {
        const escaped = ('' + row[header]).replace(/"/g, '\\"');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(','));
    });
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    this.downloadFile(blob, 'StockTransfers.csv');
  }

  private exportToExcel(data: any[], sheetName: string): void {
    const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data);
    const workbook: XLSX.WorkBook = { Sheets: { [sheetName]: worksheet }, SheetNames: [sheetName] };
    const excelBuffer: any = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    this.downloadFile(blob, 'StockTransfers.xlsx');
  }

  private exportToPDF(data: any[], headers: string[], title: string): void {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
  
    doc.setFontSize(16);
    doc.text(title, pageWidth / 2, 20, { align: 'center' });
  
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);
  
    // @ts-ignore
    doc.autoTable({
      head: [headers],
      body: data.map(row => headers.map(header => row[header] || '-')),
      startY: 40,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [66, 139, 202] },
      alternateRowStyles: { fillColor: [240, 240, 240] }
    });
  
    doc.save('StockTransfers.pdf');
  }
  
  printData(): void {
    const printWindow = window.open('', '', 'width=800,height=600');

    if (printWindow) {
      // Create data for printing
      const printData = this.filteredStocks.map(stock => ({
        date: this.formatDate(stock.date),
        referenceNo: stock.referenceNo || '-',
        products: this.getProductNames(stock),
        locationFrom: this.getLocationName(stock.locationFrom),
        locationTo: this.getLocationName(stock.locationTo),
        status: stock.status,
        shippingCharges: Number(stock.shippingCharges) || 0,
        totalAmount: Number(stock.totalAmount) || 0,
        additionalNotes: stock.additionalNotes || '-'
      }));
      
      let tableHTML = `
        <table border="1" cellpadding="5" cellspacing="0" style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background-color: #f2f2f2;">
              <th>Date</th>
              <th>Reference No</th>
              <th>Products</th>
              <th>Location (From)</th>
              <th>Location (To)</th>
              <th>Status</th>
              <th>Shipping Charges</th>
              <th>Total Amount</th>
              <th>Additional Notes</th>
            </tr>
          </thead>
          <tbody>
      `;
      
      printData.forEach(item => {
        tableHTML += `
          <tr>
            <td>${item.date}</td>
            <td>${item.referenceNo}</td>
            <td>${item.products}</td>
            <td>${item.locationFrom}</td>
            <td>${item.locationTo}</td>
            <td>${item.status}</td>
            <td>${this.formatCurrency(item.shippingCharges)}</td>
            <td>${this.formatCurrency(item.totalAmount)}</td>
            <td>${item.additionalNotes}</td>
          </tr>
        `;
      });
      
      tableHTML += `
          </tbody>
        </table>
      `;
      
      printWindow.document.write(`
        <html>
          <head>
            <title>Stock Transfers Report</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              h1 { text-align: center; }
              p { margin-bottom: 20px; }
              table { width: 100%; border-collapse: collapse; }
              th, td { padding: 8px; text-align: left; border: 1px solid #ddd; }
              th { background-color: #f2f2f2; }
              .status-badge {
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
                display: inline-block;
              }
              .pending { background-color: #ffc107; }
              .in-transit { background-color: #17a2b8; }
              .completed { background-color: #28a745; }
              .cancelled { background-color: #dc3545; }
            </style>
          </head>
          <body>
            <h1>Stock Transfers Report</h1>
            <p>Generated on: ${new Date().toLocaleString()}</p>
            ${tableHTML}
          </body>
        </html>
      `);
      
      printWindow.document.close();
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
        printWindow.close();
      }, 500);
    } else {
      console.error('Could not open print window');
    }
  }

  private formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  }

  private downloadFile(blob: Blob, filename: string): void {
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(link.href);
  }
}