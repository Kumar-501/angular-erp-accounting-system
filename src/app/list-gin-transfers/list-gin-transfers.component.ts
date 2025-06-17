import { Component, OnInit, OnDestroy } from '@angular/core';
import { GinTransferService, GinTransfer } from '../services/gin-transfer.service';
import { LocationService } from '../services/location.service';
import { Subscription } from 'rxjs';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { MatDialog } from '@angular/material/dialog';
import { GinTransferViewComponent } from '../gin-transfer-view/gin-transfer-view.component';

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
  // Properties for the status update modal
showStatusModal: boolean = false;
selectedTransfer: GinTransfer | null = null;
selectedStatus: string = '';

  
  // Pagination
  currentPage = 1;
  itemsPerPage = 15;
  totalItems = 0;
  
  // Filters
  searchTerm: string = '';
  
  // Subscriptions
  private ginTransfersSub: Subscription | null = null;
  private locationsSub: Subscription | null = null;
  private routerSub: Subscription | null = null;
  Math = Math;

  constructor(
    private ginTransferService: GinTransferService,
    private locationService: LocationService,
    private router: Router,
    private dialog: MatDialog
  ) { }

  ngOnInit(): void {
    this.loadLocations();
    this.loadGinTransfers();
    
    this.routerSub = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      if (event.url === '/gin-transfers' || event.url === '/') {
        this.loadGinTransfers();
      }
    });
    
    this.ginTransferService.getUpdateEmitter().subscribe(() => {
      this.loadGinTransfers();
    });
  }
// Method to open the status update modal
openStatusModal(transfer: GinTransfer) {
  this.selectedTransfer = {...transfer}; // Create a copy of the transfer
  this.selectedStatus = transfer.status; // Set the current status
  this.showStatusModal = true;
}

// Method to close the status update modal
closeStatusModal() {
  this.showStatusModal = false;
  this.selectedTransfer = null;
}

// Method to update the status
updateStatus() {
  if (!this.selectedTransfer || !this.selectedTransfer.id) {
    console.error('No transfer selected or transfer ID is missing');
    return;
  }

  // Update the status in the selected transfer
  this.selectedTransfer.status = this.selectedStatus;

  // Update the transfer in the database
  this.ginTransferService.updateGinTransfer(this.selectedTransfer.id, this.selectedTransfer)
    .then(() => {
      console.log('Status updated successfully');
      
      // Update the status in the local array
      const index = this.ginTransfers.findIndex(t => t.id === this.selectedTransfer!.id);
      if (index !== -1) {
        this.ginTransfers[index].status = this.selectedStatus;
      }
      
      // Reapply filters to update the view
      this.applyFilters();
      
      // Close the modal
      this.closeStatusModal();
    })
    .catch(error => {
      console.error('Error updating status:', error);
      alert('Error updating status. Please try again.');
    });
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
        (transfer.locationTo && this.getLocationName(transfer.locationTo).toLowerCase().includes(searchLower)) ||
        (transfer.status && transfer.status.toLowerCase().includes(searchLower))
      );
    }
    
    this.filteredGinTransfers = filtered;
    this.totalItems = filtered.length;
    this.sortData(this.currentSortColumn);
    this.currentPage = 1;
  }

  getLocationName(locationId: string): string {
    return this.locationMap.get(locationId) || locationId || 'Unknown Location';
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
      if (column === 'date') {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return this.isAscending ? dateA - dateB : dateB - dateA;
      }
      else if (column === 'locationFrom' || column === 'locationTo') {
        const aValue = this.getLocationName(a[column as keyof GinTransfer] as string).toLowerCase();
        const bValue = this.getLocationName(b[column as keyof GinTransfer] as string).toLowerCase();
        return this.isAscending 
          ? aValue.localeCompare(bValue) 
          : bValue.localeCompare(aValue);
      }
      else if (column === 'shippingCharges' || column === 'totalAmount') {
        const aValue = a[column as keyof GinTransfer] as number;
        const bValue = b[column as keyof GinTransfer] as number;
        return this.isAscending 
          ? aValue - bValue 
          : bValue - aValue;
      }
      else {
        const aValue = String(a[column as keyof GinTransfer] || '').toLowerCase();
        const bValue = String(b[column as keyof GinTransfer] || '').toLowerCase();
        return this.isAscending 
          ? aValue.localeCompare(bValue) 
          : bValue.localeCompare(aValue);
      }
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
    this.dialog.open(GinTransferViewComponent, {
      width: '800px',
      data: { 
        transfer: transfer,
        getLocationName: (id: string) => this.getLocationName(id)
      },
      panelClass: 'gin-transfer-dialog'
    });
  }

  deleteGinTransfer(id: string) {
    if (confirm('Are you sure you want to delete this GIN Transfer?')) {
      this.ginTransferService.deleteGinTransfer(id)
        .then(() => {
          console.log('GIN Transfer deleted successfully');
          this.loadGinTransfers();
        })
        .catch(error => {
          console.error('Error deleting GIN transfer:', error);
          alert('Error deleting GIN transfer. Please try again.');
        });
    }
  }

  exportToExcel() {
    // Implement Excel export logic here
    console.log('Exporting to Excel');
  }

  exportToCsv() {
    // Implement CSV export logic here
    console.log('Exporting to CSV');
  }

  exportToPdf() {
    // Implement PDF export logic here
    console.log('Exporting to PDF');
  }
printGinTransfers() {
  // Create a new window for printing
  const printWindow = window.open('', '_blank');
  
  if (printWindow) {
    // Start building the HTML content
    let htmlContent = `
      <html>
        <head>
          <title>GIN Transfers Report</title>
          <style>
            body { font-family: Arial, sans-serif; }
            h1 { color: #333; text-align: center; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background-color: #f2f2f2; text-align: left; padding: 8px; border: 1px solid #ddd; }
            td { padding: 8px; border: 1px solid #ddd; }
            .status-badge { 
              padding: 4px 8px; 
              border-radius: 12px; 
              font-size: 12px; 
              font-weight: bold; 
              text-transform: capitalize;
            }
            .completed { background-color: #d4edda; color: #155724; }
            .pending { background-color: #fff3cd; color: #856404; }
            .cancelled { background-color: #f8d7da; color: #721c24; }
            .header { margin-bottom: 20px; }
            .date { text-align: right; margin-bottom: 10px; }
            @media print {
              .no-print { display: none; }
              body { padding: 20px; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Goods Issue Note (GIN) Transfers</h1>
            <div class="date">Generated on: ${new Date().toLocaleString()}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Reference No</th>
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

    // Add table rows
    this.filteredGinTransfers.forEach(transfer => {
      htmlContent += `
        <tr>
          <td>${transfer.date}</td>
          <td>${transfer.referenceNo}</td>
          <td>${this.getLocationName(transfer.locationFrom)}</td>
          <td>${this.getLocationName(transfer.locationTo)}</td>
          <td><span class="status-badge ${transfer.status.toLowerCase()}">${transfer.status}</span></td>
          <td>₹ ${transfer.shippingCharges.toFixed(2)}</td>
          <td>₹ ${transfer.totalAmount.toFixed(2)}</td>
          <td>${transfer.additionalNotes || '-'}</td>
        </tr>
      `;
    });

    // Close HTML tags
    htmlContent += `
            </tbody>
          </table>
          <div class="no-print" style="margin-top: 20px; text-align: center;">
            <button onclick="window.print()" style="padding: 8px 16px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">Print</button>
            <button onclick="window.close()" style="padding: 8px 16px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer; margin-left: 10px;">Close</button>
          </div>
        </body>
      </html>
    `;

    // Write the content to the new window
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();

    // Focus the window (needed for some browsers)
    printWindow.focus();
  } else {
    alert('Popup blocker might be preventing the print window from opening. Please allow popups for this site.');
  }
}
  ngOnDestroy() {
    if (this.ginTransfersSub) {
      this.ginTransfersSub.unsubscribe();
    }
    if (this.locationsSub) {
      this.locationsSub.unsubscribe();
    }
    if (this.routerSub) {
      this.routerSub.unsubscribe();
    }
  }
}