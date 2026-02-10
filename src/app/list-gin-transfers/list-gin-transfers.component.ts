import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { GinTransferService, GinTransfer } from '../services/gin-transfer.service';
import { LocationService } from '../services/location.service';
import { Subscription } from 'rxjs';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { GinTransferViewComponent } from '../gin-transfer-view/gin-transfer-view.component';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { StockService } from '../services/stock.service';
import * as XLSX from 'xlsx';

const COLLECTIONS = {
  PRODUCT_STOCK: 'product-stock',
  PRODUCTS: 'products',
  LOCATIONS: 'locations'
};

@Component({
  selector: 'app-list-gin-transfers',
  templateUrl: './list-gin-transfers.component.html',
  styleUrls: ['./list-gin-transfers.component.scss']
})
export class ListGinTransfersComponent implements OnInit, OnDestroy {
  ginTransfers: GinTransfer[] = [];
  filteredGinTransfers: GinTransfer[] = [];
  locations: any[] = [];
  currentSortColumn: string = 'date';
  isAscending: boolean = false;
  locationMap: Map<string, string> = new Map();
  showStatusModal: boolean = false;
  selectedTransfer: GinTransfer | null = null;
  selectedStatus: string = '';
  
  currentPage = 1;
  itemsPerPage = 15;
  totalItems = 0;
  
  searchTerm: string = '';

  // Property for column visibility
  columnVisibility = {
    date: true,
    referenceNo: true,
    locationFrom: true,
    locationTo: true,
    products: true,
    status: true,
    shippingCharges: true,
    totalAmount: true,
    additionalNotes: true,
    action: true
  };

  // Add this property to control the dropdown visibility
  showColumnVisibilityDropdown: boolean = false;
  
  private ginTransfersSub: Subscription | null = null;
  private locationsSub: Subscription | null = null;
  private routerSub: Subscription | null = null;
  
  Math = Math;

  constructor(
    private ginTransferService: GinTransferService,
    private locationService: LocationService,
    private stockService: StockService,
    private router: Router,
    private dialog: MatDialog,
    private firestore: Firestore
  ) { }

  ngOnInit(): void {
    this.loadLocations();
    this.loadGinTransfers();
    
    this.routerSub = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.loadGinTransfers();
    });
    
    if (this.ginTransferService.getUpdateEmitter) {
      this.ginTransferService.getUpdateEmitter().subscribe(() => {
        this.loadGinTransfers();
      });
    }
  }
  
  // Helper function to get the count of visible columns for table colspan
  getVisibleColumnsCount(): number {
    return Object.values(this.columnVisibility).filter(isVisible => isVisible).length;
  }

  // Add method to toggle column visibility dropdown
  toggleColumnVisibilityDropdown(): void {
    this.showColumnVisibilityDropdown = !this.showColumnVisibilityDropdown;
  }

  // Add method to close dropdown when clicking outside
  closeColumnVisibilityDropdown(): void {
    this.showColumnVisibilityDropdown = false;
  }

  // Add method to handle column visibility change
  onColumnVisibilityChange(columnKey: string): void {
    // Toggle the visibility
    this.columnVisibility[columnKey as keyof typeof this.columnVisibility] = 
      !this.columnVisibility[columnKey as keyof typeof this.columnVisibility];
  }

  // Add method to get column display name
  getColumnDisplayName(columnKey: string): string {
    const displayNames: { [key: string]: string } = {
      date: 'Date',
      referenceNo: 'Reference No',
      locationFrom: 'Location (From)',
      locationTo: 'Location (To)',
      products: 'Products',
      status: 'Status',
      shippingCharges: 'Shipping Charges',
      totalAmount: 'Total Amount',
      additionalNotes: 'Additional Notes',
      action: 'Action'
    };
    return displayNames[columnKey] || columnKey;
  }

  openStatusModal(transfer: GinTransfer) {
    this.selectedTransfer = {...transfer};
    this.selectedStatus = transfer.status || '';
    this.showStatusModal = true;
  }

  closeStatusModal() {
    this.showStatusModal = false;
    this.selectedTransfer = null;
  }

  async updateStatus() {
    if (!this.selectedTransfer || !this.selectedTransfer.id) {
      console.error('No transfer selected or missing ID');
      return;
    }

    const oldStatus = this.selectedTransfer.status;
    const newStatus = this.selectedStatus;

    if (oldStatus === newStatus) {
        this.closeStatusModal();
        return; 
    }

    try {
        await this.ginTransferService.updateGinTransfer(this.selectedTransfer.id, { 
            status: newStatus,
            updatedAt: new Date()
        });

        if (newStatus === 'Completed' && oldStatus !== 'Completed') {
            console.log(`Status changed to Completed. Processing stock for GIN: ${this.selectedTransfer.referenceNo}`);
            try {
                await this.stockService.processGinTransfer(this.selectedTransfer);
                console.log('Stock processing completed successfully');
            } catch (stockError) {
                console.error('Error processing stock:', stockError);
                await this.ginTransferService.updateGinTransfer(this.selectedTransfer.id, { 
                    status: oldStatus,
                    updatedAt: new Date()
                });
                throw new Error(`Stock processing failed: ${stockError instanceof Error ? stockError.message : 'Unknown error'}`);
            }
        }

        const index = this.ginTransfers.findIndex(t => t.id === this.selectedTransfer!.id);
        if (index !== -1) {
            this.ginTransfers[index].status = newStatus;
        }
        
        const filteredIndex = this.filteredGinTransfers.findIndex(t => t.id === this.selectedTransfer!.id);
        if (filteredIndex !== -1) {
            this.filteredGinTransfers[filteredIndex].status = newStatus;
        }

        this.closeStatusModal();
        alert('Status updated and stock processed successfully!');

    } catch (error) {
        console.error('Error updating status or processing stock:', error);
        alert(`Error: ${error instanceof Error ? error.message : 'Failed to update status'}`);
    }
  }

  loadLocations() {
    this.locationsSub = this.locationService.getLocations().subscribe({
      next: (locations) => {
        this.locations = locations;
        locations.forEach(location => {
          this.locationMap.set(location.id, location.name);
        });
        this.applyFilters();
      },
      error: (err) => {
        console.error('Error loading locations:', err);
      }
    });
  }

  loadGinTransfers() {
    this.ginTransfersSub = this.ginTransferService.getGinTransfers().subscribe({
      next: (transfers) => {
        this.ginTransfers = transfers;
        this.applyFilters();
      },
      error: (err) => {
        console.error('Error loading GIN transfers:', err);
      }
    });
  }

  applyFilters() {
    let filtered = [...this.ginTransfers];
    
    if (this.searchTerm.trim() !== '') {
      const searchLower = this.searchTerm.toLowerCase();
      filtered = filtered.filter(transfer => 
        (transfer.referenceNo && transfer.referenceNo.toLowerCase().includes(searchLower)) ||
        (transfer.locationFrom && this.getLocationName(transfer.locationFrom).toLowerCase().includes(searchLower)) ||
        (transfer.status && transfer.status.toLowerCase().includes(searchLower)) ||
        (transfer.additionalNotes && transfer.additionalNotes.toLowerCase().includes(searchLower)) ||
        this.getDestinationLocationsText(transfer).toLowerCase().includes(searchLower) ||
        this.getProductsText(transfer).toLowerCase().includes(searchLower)
      );
    }
    
    this.filteredGinTransfers = filtered;
    this.totalItems = filtered.length;
    this.sortData(this.currentSortColumn);
    this.currentPage = 1;
  }

  getLocationName(locationId: string | undefined): string {
    if (!locationId) return 'Unknown Location';
    return this.locationMap.get(locationId) || locationId;
  }

  getDestinationLocationsText(transfer: GinTransfer): string {
    if (transfer.transfers && transfer.transfers.length > 0) {
      return transfer.transfers.map(t => t.locationName || this.getLocationName(t.locationId)).join(', ');
    }
    if (transfer.locationTo) {
      return this.getLocationName(transfer.locationTo);
    }
    return 'Unknown Location';
  }

  getProductsText(transfer: GinTransfer): string {
    const products = this.getAllProducts(transfer);
    return products.map(p => `${p.productName} (x${p.quantity})`).join(', ');
  }

  getAllProducts(transfer: GinTransfer): any[] {
    if (transfer.transfers && transfer.transfers.length > 0) {
      return transfer.transfers.flatMap(t => t.products);
    }
    return transfer.items || [];
  }

  onSearch() {
    this.applyFilters();
  }

  clearFilters() {
    this.searchTerm = '';
    this.applyFilters();
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.getTotalPages()) {
      this.currentPage = page;
    }
  }
  
  sortData(column: string): void {
    if (this.currentSortColumn === column) {
      this.isAscending = !this.isAscending;
    } else {
      this.currentSortColumn = column;
      this.isAscending = true;
    }

    this.filteredGinTransfers.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (column) {
        case 'date':
          aValue = a.date ? new Date(a.date).getTime() : 0;
          bValue = b.date ? new Date(b.date).getTime() : 0;
          break;
        case 'locationFrom':
          aValue = this.getLocationName(a.locationFrom).toLowerCase();
          bValue = this.getLocationName(b.locationFrom).toLowerCase();
          break;
        case 'locationTo':
          aValue = this.getDestinationLocationsText(a).toLowerCase();
          bValue = this.getDestinationLocationsText(b).toLowerCase();
          break;
        case 'shippingCharges':
        case 'totalAmount':
          aValue = (a as any)[column] || 0;
          bValue = (b as any)[column] || 0;
          break;
        default:
          aValue = String((a as any)[column] || '').toLowerCase();
          bValue = String((b as any)[column] || '').toLowerCase();
      }
      
      if (aValue < bValue) return this.isAscending ? -1 : 1;
      if (aValue > bValue) return this.isAscending ? 1 : -1;
      return 0;
    });

    this.currentPage = 1;
  }

  getTotalPages(): number {
    return Math.ceil(this.totalItems / this.itemsPerPage) || 1;
  }

  getCurrentPageItems(): GinTransfer[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredGinTransfers.slice(startIndex, startIndex + this.itemsPerPage);
  }

  viewGinTransfer(transfer: GinTransfer) {
    const dialogRef = this.dialog.open(GinTransferViewComponent, {
      width: '900px',
      maxHeight: '90vh',
      data: { 
        transfer: transfer,
        getLocationName: (id: string) => this.getLocationName(id)
      },
      panelClass: 'gin-transfer-dialog'
    });

    dialogRef.afterClosed().subscribe(() => {});
  }

  deleteGinTransfer(id: string) {
    if (confirm('Are you sure you want to delete this GIN Transfer?')) {
      this.ginTransferService.deleteGinTransfer(id)
        .then(() => this.loadGinTransfers())
        .catch(error => {
          console.error('Error deleting GIN transfer:', error);
          alert('Error deleting GIN transfer. Please try again.');
        });
    }
  }

  exportToExcel(): void {
    if (this.filteredGinTransfers.length === 0) {
      alert('No data to export.');
      return;
    }

    const dataToExport = this.filteredGinTransfers.map(transfer => ({
      'Date': transfer.date,
      'Reference No': transfer.referenceNo,
      'Location (From)': this.getLocationName(transfer.locationFrom),
      'Location (To)': this.getDestinationLocationsText(transfer),
      'Products': this.getProductsText(transfer),
      'Status': transfer.status,
      'Shipping Charges': transfer.shippingCharges || 0,
      'Total Amount': transfer.totalAmount || 0,
      'Additional Notes': transfer.additionalNotes || ''
    }));

    const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook: XLSX.WorkBook = { Sheets: { 'data': worksheet }, SheetNames: ['data'] };
    const excelBuffer: any = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    this.saveAsExcelFile(excelBuffer, 'gin_transfers');
  }

  private saveAsExcelFile(buffer: any, fileName: string): void {
    const data: Blob = new Blob([buffer], {type: 'application/octet-stream'});
    const url = window.URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}_${new Date().getTime()}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  printTable(): void {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write('<html><head><title>GIN Transfers</title>');
      printWindow.document.write('<style> body { font-family: sans-serif; } table { width: 100%; border-collapse: collapse; } th, td { border: 1px solid #ddd; padding: 8px; text-align: left; } th { background-color: #f2f2f2; } </style>');
      printWindow.document.write('</head><body>');
      printWindow.document.write('<h1>GIN Transfers</h1>');
      
      const table = document.querySelector('.gin-transfers-table')?.cloneNode(true) as HTMLElement;
      table.querySelectorAll('.action-column, .action-buttons').forEach(el => el.remove());
      
      printWindow.document.write(table.outerHTML);
      printWindow.document.write('</body></html>');
      printWindow.document.close();
      printWindow.print();
    }
  }

  ngOnDestroy() {
    this.ginTransfersSub?.unsubscribe();
    this.locationsSub?.unsubscribe();
    this.routerSub?.unsubscribe();
  }
}