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
    currentGrn: any; // or your specific GRN type
  grnList: any[] = []; 
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
  locations: any;

  constructor(
    private goodsService: GoodsService,
    private stockService:StockService,
    private locationService: LocationService,
    private router: Router,
      private supplierService: SupplierService, // Add this

  ) {
    this.endDate = new Date();
    this.startDate = new Date();
    this.startDate.setDate(this.startDate.getDate() - 30);
  }

  ngOnInit(): void {
    this.loadGoodsReceived();
    
      this.loadGoodsReceived(); // Refresh the list when stock changes
  this.subscriptions.push(
    this.stockService.stockUpdated$.subscribe(() => {
      this.loadGoodsReceived(); // Refresh the list when stock changes
    })
  );

  }
viewProducts(grn: any): void {
  this.selectedGrn = grn;
}

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

loadGoodsReceived(): void {
  // Load suppliers first
  const supplierSub = this.supplierService.getSuppliers().subscribe(suppliers => {
    this.suppliers = suppliers;
    
    // Then load GRNs
    const grnSub = this.goodsService.getAllGoodsReceived().subscribe(goods => {
      this.goodsReceived = goods.map(grn => ({
        ...grn,
        referenceNo: grn['referenceNo'] || this.generateReferenceNo(grn),
        invoiceNo: grn['invoiceNo'] || grn['invoiceRef'] || 'N/A',
        addedBy: grn['addedBy'] || grn['createdBy'] || 'N/A',
        // Ensure products array exists
        products: grn['products'] || []
      }));
      this.applyFilters();
    });
    this.subscriptions.push(grnSub);
  });
  this.subscriptions.push(supplierSub);
}


  // Generate a reference number if none exists
  private generateReferenceNo(grn: any): string {
    if (grn.purchaseOrderDetails?.referenceNo) {
      return `GRN-${grn.purchaseOrderDetails.referenceNo}`;
    }
    return `GRN-${grn.id.substring(0, 8).toUpperCase()}`;
  }

  sortBy(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.applyFilters();
  }

  applyFilters(): void {
    // Filter by date range
    this.filteredGoodsReceived = this.goodsReceived.filter(grn => {
      const purchaseDate = grn.purchaseDate instanceof Date ? 
        grn.purchaseDate : new Date(grn.purchaseDate);
      return purchaseDate >= this.startDate && purchaseDate <= this.endDate;
    });

    // Apply search filter
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
    this.loadLocations(); // Load locations first

    // Apply sorting
    this.filteredGoodsReceived.sort((a, b) => {
      let valueA: any;
      let valueB: any;

      switch(this.sortColumn) {
        case 'purchaseDate':
          valueA = a.purchaseDate instanceof Date ? a.purchaseDate : new Date(a.purchaseDate);
          valueB = b.purchaseDate instanceof Date ? b.purchaseDate : new Date(b.purchaseDate);
          break;
        case 'referenceNo':
          valueA = a.referenceNo || '';
          valueB = b.referenceNo || '';
          break;
        case 'invoiceNo':
          valueA = a.invoiceNo || '';
          valueB = b.invoiceNo || '';
          break;
        case 'locationName':
          valueA = this.getLocationName(a) || '';
          valueB = this.getLocationName(b) || '';
          break;
        case 'supplierName':
          valueA = this.getSupplierName(a) || '';
          valueB = this.getSupplierName(b) || '';
          break;
        case 'status':
          valueA = a.status || '';
          valueB = b.status || '';
          break;
        case 'addedBy':
          valueA = a.addedBy || '';
          valueB = b.addedBy || '';
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

getSupplierName(grn: any): string {
  // If supplier details are embedded directly in the GRN
  if (grn.supplierName) {
    return grn.supplierName;
  }
  
  // If supplier details are embedded as an object
  if (grn.supplierDetails) {
    return grn.supplierDetails.isIndividual ? 
      `${grn.supplierDetails.firstName} ${grn.supplierDetails.lastName || ''}`.trim() :
      grn.supplierDetails.businessName;
  }
  
  // If supplier is just a reference ID (old format)
  if (typeof grn.supplier === 'string') {
    // Try to find the supplier in the loaded suppliers list
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
    // If location details are embedded
    if (grn.businessLocationDetails) {
      return grn.businessLocationDetails.name || 
             grn.businessLocationDetails.address || 
             'N/A';
    }
    // If location is just an ID, try to find it in locations
    else if (grn.businessLocation) {
      const location = this.locations.find((loc: { id: any; }) => loc.id === grn.businessLocation);
      return location?.name || location?.address || 'N/A';
    }
    return 'N/A';
  }
  private loadLocations(): void {
    this.locationService.getLocations().subscribe(locations => {
      this.locations = locations;
      // After loading locations, refresh the data display
      this.applyFilters();
    });
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

  viewGrn(id: string): void {
    this.router.navigate(['/view-grn', id]);
  }

  printGrn(id: string): void {
    // Implementation for printing the GRN
  }
}