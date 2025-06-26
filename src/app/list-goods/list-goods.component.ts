import { Component, OnInit, OnDestroy } from '@angular/core';
import { GoodsService } from '../services/goods.service';
import { LocationService } from '../services/location.service';
import { Subscription } from 'rxjs';
import { formatDate } from '@angular/common';
import { Router } from '@angular/router';
import { StockService } from '../services/stock.service';
import { SupplierService } from '../services/supplier.service';

@Component({
  selector: 'app-list-goods',
  templateUrl: './list-goods.component.html',
  styleUrls: ['./list-goods.component.scss']
})
export class ListGoodsComponent implements OnInit, OnDestroy {
  goodsReceived: any[] = [];
  filteredGoodsReceived: any[] = [];
  paginatedGoodsReceived: any[] = [];
  suppliers: any[] = [];
  locations: any[] = [];
  selectedGrn: any = null;

  currentPage: number = 1;
  pageSize: number = 10;
  totalPages: number = 1;
  pageNumbers: number[] = [];
  startItem: number = 0;
  endItem: number = 0;

  sortColumn: string = 'purchaseDate';
  sortDirection: string = 'desc';

  searchQuery: string = '';
  currentView: string = 'all';
  startDate: Date = new Date();
  endDate: Date = new Date();

  showDeleteModal: boolean = false;
  grnToDelete: string | null = null;

  private subscriptions: Subscription[] = [];

  constructor(
    private goodsService: GoodsService,
    private stockService: StockService,
    private locationService: LocationService,
    private router: Router,
    private supplierService: SupplierService
  ) {
    this.endDate = new Date();
    this.startDate = new Date();
    this.startDate.setDate(this.startDate.getDate() - 30);
  }

  ngOnInit(): void {
    this.loadGoodsReceived();
    this.loadLocations();
    
    this.subscriptions.push(
      this.stockService.stockUpdated$.subscribe(() => {
        this.loadGoodsReceived();
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  loadGoodsReceived(): void {
    const supplierSub = this.supplierService.getSuppliers().subscribe(suppliers => {
      this.suppliers = suppliers;
      
      const grnSub = this.goodsService.getAllGoodsReceived().subscribe(goods => {
        this.goodsReceived = goods.map(grn => ({
          ...grn,
          referenceNo: grn['referenceNo'] || this.generateReferenceNo(grn),
          invoiceNo: grn['invoiceNo'] || grn['invoiceRef'] || 'N/A',
          addedBy: grn['addedBy'] || grn['createdBy'] || 'N/A',
          purchaseDate: this.parseDate(grn['purchaseDate']),
          receivedDate: this.parseDate(grn['receivedDate']),
          products: grn['products'] || []
        }));
        this.applyFilters();
      });
      this.subscriptions.push(grnSub);
    });
    this.subscriptions.push(supplierSub);
  }

  private loadLocations(): void {
    this.locationService.getLocations().subscribe(locations => {
      this.locations = locations;
    });
  }

  private parseDate(dateValue: any): Date {
    if (!dateValue) return new Date();
    
    if (dateValue instanceof Date) {
      return dateValue;
    }
    
    if (dateValue.toDate) {
      return dateValue.toDate();
    }
    
    return new Date(dateValue);
  }

  private generateReferenceNo(grn: any): string {
    if (grn.purchaseOrderDetails?.referenceNo) {
      return `GRN-${grn.purchaseOrderDetails.referenceNo}`;
    }
    return `GRN-${grn.id.substring(0, 8).toUpperCase()}`;
  }

  // Product view methods
  viewProducts(grn: any): void {
    this.selectedGrn = grn;
  }

  closeProductsView(): void {
    this.selectedGrn = null;
  }

  getTotalQuantity(products: any[]): number {
    if (!products) return 0;
    return products.reduce((total, product) => {
      return total + (product.quantity || product.receivedQuantity || 0);
    }, 0);
  }

  getTotalValue(products: any[]): number {
    if (!products) return 0;
    return products.reduce((total, product) => {
      return total + this.getProductLineTotal(product);
    }, 0);
  }

  getProductLineTotal(product: any): number {
    const quantity = product.quantity || product.receivedQuantity || 0;
    const unitPrice = product.unitCost || product.unitPrice || 0;
    return quantity * unitPrice;
  }

  getProductStatus(product: any): string {
    const ordered = product.orderQuantity || product.orderedQty || 0;
    const received = product.quantity || product.receivedQuantity || 0;
    
    if (received === 0) return 'Not Received';
    if (received < ordered) return 'Partial';
    if (received === ordered) return 'Complete';
    if (received > ordered) return 'Over Received';
    
    return 'Received';
  }

  getProductStatusClass(product: any): string {
    const status = this.getProductStatus(product);
    switch (status) {
      case 'Complete': return 'status-complete';
      case 'Partial': return 'status-partial';
      case 'Over Received': return 'status-over';
      case 'Not Received': return 'status-not-received';
      default: return 'status-received';
    }
  }

  getProductRowClass(product: any): string {
    const received = product.quantity || product.receivedQuantity || 0;
    return received > 0 ? 'product-received' : 'product-not-received';
  }

  printProductsList(): void {
    if (!this.selectedGrn) return;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const html = this.generatePrintHTML(this.selectedGrn);
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.print();
    }
  }

  private generatePrintHTML(grn: any): string {
    const productsRows = grn.products?.map((product: any, index: number) => `
      <tr>
        <td>${index + 1}</td>
        <td>${product.productName || product.name}</td>
        <td>${product.sku || product.code || 'N/A'}</td>
        <td>${product.orderQuantity || product.orderedQty || 0}</td>
        <td>${product.quantity || product.receivedQuantity || 0}</td>
        <td>₹${(product.unitCost || product.unitPrice || 0).toFixed(2)}</td>
        <td>₹${this.getProductLineTotal(product).toFixed(2)}</td>
      </tr>
    `).join('') || '<tr><td colspan="7">No products found</td></tr>';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>GRN Products - ${grn.referenceNo}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .info { margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          .total-row { font-weight: bold; background-color: #f9f9f9; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>Goods Received Note - Products Details</h2>
          <h3>${grn.referenceNo}</h3>
        </div>
        <div class="info">
          <p><strong>Supplier:</strong> ${this.getSupplierName(grn)}</p>
          <p><strong>Location:</strong> ${this.getLocationName(grn)}</p>
          <p><strong>Received Date:</strong> ${this.formatDate(grn.receivedDate)}</p>
          <p><strong>Invoice No:</strong> ${grn.invoiceNo || 'N/A'}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Product Name</th>
              <th>SKU/Code</th>
              <th>Order Qty</th>
              <th>Received Qty</th>
              <th>Unit Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${productsRows}
            <tr class="total-row">
              <td colspan="4">Total</td>
              <td>${this.getTotalQuantity(grn.products)}</td>
              <td></td>
              <td>₹${this.getTotalValue(grn.products).toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </body>
      </html>
    `;
  }

  private formatDate(date: any): string {
    if (!date) return 'N/A';
    const parsedDate = this.parseDate(date);
    return formatDate(parsedDate, 'dd-MM-yyyy HH:mm', 'en-US');
  }

sortBy(column: string): void {
  if (this.sortColumn === column) {
    this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    this.sortColumn = column;
    this.sortDirection = 'asc';
  }
 if (column === 'productName') {
    this.filteredGoodsReceived.sort((a, b) => {
      const nameA = (a.products?.[0]?.productName || a.products?.[0]?.name || '').toLowerCase();
      const nameB = (b.products?.[0]?.productName || b.products?.[0]?.name || '').toLowerCase();
      return this.sortDirection === 'asc' 
        ? nameA.localeCompare(nameB) 
        : nameB.localeCompare(nameA);
    });
  } 
    if (column === 'purchaseDate' || column === 'receivedDate') {
      this.filteredGoodsReceived.sort((a, b) => {
        const dateA = this.parseDate(a[column]).getTime();
        const dateB = this.parseDate(b[column]).getTime();
        return this.sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
      });
    } else {
      this.applyFilters();
    }
    
    this.updatePagination();
  }

  applyFilters(): void {
    this.filteredGoodsReceived = this.goodsReceived.filter(grn => {
      const purchaseDate = grn.purchaseDate instanceof Date ? 
        grn.purchaseDate : new Date(grn.purchaseDate);
      return purchaseDate >= this.startDate && purchaseDate <= this.endDate;
    });

    if (this.searchQuery && this.searchQuery.trim() !== '') {
      const query = this.searchQuery.toLowerCase().trim();
      this.filteredGoodsReceived = this.filteredGoodsReceived.filter(grn => {
        return (
          (grn.referenceNo?.toLowerCase().includes(query)) ||
          (grn.invoiceNo?.toLowerCase().includes(query)) ||
          (this.getLocationName(grn)?.toLowerCase().includes(query)) ||
          (this.getSupplierName(grn)?.toLowerCase().includes(query)) ||
          (grn.status?.toLowerCase().includes(query)) ||
          (grn.addedBy?.toLowerCase().includes(query))
        );
      });
    }

    this.filteredGoodsReceived.sort((a, b) => {
      let valueA: any;
      let valueB: any;

      switch(this.sortColumn) {
        case 'purchaseDate':
        case 'receivedDate':
          valueA = a[this.sortColumn] instanceof Date ? a[this.sortColumn] : new Date(a[this.sortColumn]);
          valueB = b[this.sortColumn] instanceof Date ? b[this.sortColumn] : new Date(b[this.sortColumn]);
          break;
        case 'locationName':
          valueA = this.getLocationName(a) || '';
          valueB = this.getLocationName(b) || '';
          break;
        case 'supplierName':
          valueA = this.getSupplierName(a) || '';
          valueB = this.getSupplierName(b) || '';
          break;
        default:
          valueA = a[this.sortColumn] || '';
          valueB = b[this.sortColumn] || '';
      }

      if (this.sortDirection === 'asc') {
        return valueA > valueB ? 1 : valueA < valueB ? -1 : 0;
      } else {
        return valueA < valueB ? 1 : valueA > valueB ? -1 : 0;
      }
    });

    this.updatePagination();
  }

  applySearch(): void {
    this.currentPage = 1;
    this.applyFilters();
  }

  // Helper methods
  getSupplierName(grn: any): string {
    if (grn.supplierName) {
      return grn.supplierName;
    }
    
    if (grn.supplierDetails) {
      return grn.supplierDetails.isIndividual ? 
        `${grn.supplierDetails.firstName} ${grn.supplierDetails.lastName || ''}`.trim() :
        grn.supplierDetails.businessName;
    }
    
    if (typeof grn.supplier === 'string') {
      const foundSupplier = this.suppliers.find(s => s.id === grn.supplier);
      if (foundSupplier) {
        return foundSupplier.isIndividual ? 
          `${foundSupplier.firstName} ${foundSupplier.lastName || ''}`.trim() :
          foundSupplier.businessName;
      }
      return 'Supplier Not Found';
    }
    
    return 'N/A';
  }

  getLocationName(grn: any): string {
    if (grn.businessLocationDetails) {
      return grn.businessLocationDetails.name || 
             grn.businessLocationDetails.address || 
             'N/A';
    }
    
    if (grn.businessLocation) {
      const location = this.locations.find(loc => loc.id === grn.businessLocation);
      return location?.name || location?.address || 'N/A';
    }
    
    return 'N/A';
  }

  formatStatus(status: string): string {
    if (!status) return 'N/A';
    return status.charAt(0).toUpperCase() + 
           status.slice(1).toLowerCase().replace(/_/g, ' ');
  }

  getStatusClass(status: string): string {
    if (!status) return '';
    
    switch(status.toLowerCase()) {
      case 'received':
        return 'status-received';
      case 'pending':
        return 'status-pending';
      case 'cancelled':
        return 'status-cancelled';
      default:
        return '';
    }
  }

  formatDateRange(): string {
    const start = formatDate(this.startDate, 'dd-MM-yyyy', 'en-US');
    const end = formatDate(this.endDate, 'dd-MM-yyyy', 'en-US');
    return `${start} - ${end}`;
  }

  openFilters(): void {
    // Implementation for opening filter dialog
  }

  setView(view: string): void {
    this.currentView = view;
    this.currentPage = 1;
    this.applyFilters();
  }

  updatePageSize(): void {
    this.currentPage = 1;
    this.updatePagination();
  }

  updatePagination(): void {
    this.totalPages = Math.ceil(this.filteredGoodsReceived.length / this.pageSize);
    
    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages || 1;
    }
    
    this.pageNumbers = [];
    const maxPages = 5;
    let startPage = Math.max(1, this.currentPage - Math.floor(maxPages / 2));
    let endPage = Math.min(this.totalPages, startPage + maxPages - 1);
    
    if (endPage - startPage + 1 < maxPages && startPage > 1) {
      startPage = Math.max(1, endPage - maxPages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      this.pageNumbers.push(i);
    }
    
    const startIndex = (this.currentPage - 1) * this.pageSize;
    this.startItem = this.filteredGoodsReceived.length > 0 ? startIndex + 1 : 0;
    this.endItem = Math.min(startIndex + this.pageSize, this.filteredGoodsReceived.length);
    
    this.paginatedGoodsReceived = this.filteredGoodsReceived.slice(startIndex, this.endItem);
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePagination();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePagination();
    }
  }

  goToPage(page: number): void {
    this.currentPage = page;
    this.updatePagination();
  }

  deleteGrn(id: string): void {
    this.grnToDelete = id;
    this.showDeleteModal = true;
  }

  cancelDelete(): void {
    this.showDeleteModal = false;
    this.grnToDelete = null;
  }

  confirmDelete(): void {
    if (this.grnToDelete) {
      this.goodsService.deleteGoodsReceived(this.grnToDelete)
        .then(() => {
          this.showDeleteModal = false;
          this.grnToDelete = null;
          this.loadGoodsReceived();
        })
        .catch(error => {
          console.error('Error deleting goods received note:', error);
          this.showDeleteModal = false;
          this.grnToDelete = null;
        });
    }
  }
}