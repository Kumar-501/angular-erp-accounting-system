import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { PurchaseRequisitionService } from '../services/purchase-requisition.service';
import { PurchaseOrderService } from '../services/purchase-order.service';
import { LocationService } from '../services/location.service';
import { SupplierService } from '../services/supplier.service';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { AuthService } from '../auth.service';


interface RequisitionItem {
  productId: string;
  productName: string;
  requiredQuantity: number;
    subtotal?: number; // Add this line
  supplierAddress?: string; // Ensure this exists

  alertQuantity: number;
  currentStock?: number;
  unitPurchasePrice: number;       // Add this
  purchasePriceIncTax: number;     // Add this
  itemReference?: string;          // Optional if you're using this
}

interface Requisition {
  id: string;
  date: string;
  referenceNo: string;
  location: string;
  locationName: string;
  status: string;
  requiredByDate: string;
  addedBy: string;
  items: RequisitionItem[];
  createdAt?: Date;
  updatedAt?: Date;
  brand?: string;
  category?: string;
    supplierAddress?: string; // Add this line

  shippingStatus?: string;
  supplier?: string;
  supplierName?: string;
  shippingDate?: string;
}

interface ColumnVisibility {
  name: string;
  field: string;
  visible: boolean;
}
interface Product {
  id: string;
  productName: string;
  sku: string;
  currentStock: number;
  alertQuantity: number;
}

@Component({
  selector: 'app-purchase-requisition',
  templateUrl: './purchase-requisition.component.html',
  styleUrls: ['./purchase-requisition.component.scss']
})
export class PurchaseRequisitionComponent implements OnInit {
  rows: Requisition[] = [];
  filteredRows: Requisition[] = [];
  isLoading: boolean = false;
  selectedRequisitions: string[] = [];
allSelected: boolean = false;
// Add these properties to your component class
  isDateDrawerOpen: boolean = false;
  
selectedRange: string = '';
  isCustomDate: boolean = false;
  // In your component class
isSaving: boolean = false;
fromDate: string = '';
toDate: string = '';
  showFilters: boolean = false;
  showColumnVisibility: boolean = false;
  currentPage: number = 1;
  // Change from 25 to 10 as default
entriesPerPage: number = 10;
  totalPages: number = 1;
  searchTerm: string = '';
  private searchTerms = new Subject<string>();
startDate: string = '';
endDate: string = '';
selectedSupplier: string = 'All';
  
  openActionDropdownId: string | null = null;
  
  columns: ColumnVisibility[] = [
    { name: 'Date', field: 'date', visible: true },
    { name: 'Reference No', field: 'referenceNo', visible: true },
    { name: 'Brand', field: 'brand', visible: true },
    { name: 'Category', field: 'category', visible: true },
    { name: 'Location', field: 'locationName', visible: true },
    { name: 'Status', field: 'status', visible: true },
    { name: 'Shipping Status', field: 'shippingStatus', visible: true },
    { name: 'Required by date', field: 'requiredByDate', visible: true },
    { name: 'Added By', field: 'addedBy', visible: true },
    { name: 'Supplier', field: 'supplierName', visible: true },
    { name: 'Shipping Date', field: 'shippingDate', visible: true },
    { name: 'Products', field: 'items', visible: true },
    { name: 'Total Required Qty', field: 'totalQuantity', visible: true },
    { name: 'Current Stock', field: 'currentStock', visible: true }, // Add this new column
    { name: 'Unit Purchase Price', field: 'unitPurchasePrice', visible: true },
    { name: 'Purchase Price (Inc Tax)', field: 'purchasePriceIncTax', visible: true },
    { name: 'Purchase Price', field: 'subtotal', visible: true },
     { name: 'Supplier Address', field: 'supplierAddress', visible: true }, // Add this line

  ];
  
  businessLocations: any[] = [];
  suppliers: any[] = [];
  statuses: string[] = ['All', 'Pending', 'Approved', 'Rejected'];
  selectedLocation: string = 'All';
  selectedStatus: string = 'All';
  dateRange: string = '';
  requiredByDate: string = '';
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  afs: any;

  constructor(
    private requisitionService: PurchaseRequisitionService,
    private purchaseOrderService: PurchaseOrderService,
    private locationService: LocationService,
    private supplierService: SupplierService,
    private router: Router,
    private cdr: ChangeDetectorRef,
      private authService: AuthService,

  ) {}

  ngOnInit(): void {
    this.loadLocations();
    
    // First load suppliers, then load requisitions
    this.supplierService.getSuppliers().subscribe({
      next: (suppliers) => {
        this.suppliers = suppliers;
        this.loadRequisitions(); // Load requisitions after suppliers are loaded
      },
      error: (error) => {
        console.error('Error loading suppliers:', error);
        this.loadRequisitions(); // Still try to load requisitions even if suppliers fail
      }
    });
    
    // Setup search debounce
    this.searchTerms.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(term => {
      this.searchTerm = term;
      this.applyFilters();
    });

    document.addEventListener('click', (event) => {
      if (this.openActionDropdownId && !(event.target as HTMLElement).closest('.action-dropdown-container')) {
        this.openActionDropdownId = null;
      }
    });
  }
  calculateTotalRequiredQuantity(items: RequisitionItem[]): number {
    if (!items || items.length === 0) return 0;
    return items.reduce((total, item) => total + (item.requiredQuantity || 0), 0);
  }
  toggleDateDrawer(): void {
  this.isDateDrawerOpen = !this.isDateDrawerOpen;
  }
  

filterByDate(range: string): void {
  this.selectedRange = range;
  this.isCustomDate = false;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  switch (range) {
    case 'today':
      this.startDate = this.endDate = this.formatDate(today);
      break;
    case 'yesterday':
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      this.startDate = this.endDate = this.formatDate(yesterday);
      break;
    case 'sevenDays':
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      this.startDate = this.formatDate(sevenDaysAgo);
      this.endDate = this.formatDate(today);
      break;
    case 'thirtyDays':
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      this.startDate = this.formatDate(thirtyDaysAgo);
      this.endDate = this.formatDate(today);
      break;
    case 'lastMonth':
      const firstDayLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastDayLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      this.startDate = this.formatDate(firstDayLastMonth);
      this.endDate = this.formatDate(lastDayLastMonth);
      break;
    case 'thisMonth':
      const firstDayThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      this.startDate = this.formatDate(firstDayThisMonth);
      this.endDate = this.formatDate(today);
      break;
    case 'thisFinancialYear':
      const financialYearStart = this.getFinancialYearStart(today);
      this.startDate = this.formatDate(financialYearStart);
      this.endDate = this.formatDate(today);
      break;
    case 'lastFinancialYear':
      const lastFinancialYearStart = new Date(today.getFullYear() - 1, 3, 1);
      const lastFinancialYearEnd = new Date(today.getFullYear(), 2, 31);
      this.startDate = this.formatDate(lastFinancialYearStart);
      this.endDate = this.formatDate(lastFinancialYearEnd);
      break;
  }
  
  this.applyFilters();
  this.isDateDrawerOpen = false;
}
selectCustomRange(): void {
  this.selectedRange = 'custom';
  this.isCustomDate = true;
  this.fromDate = '';
  this.toDate = '';
}

  loadLocations() {
    this.locationService.getLocations().subscribe(locations => {
      this.businessLocations = locations;
    });
  }
  toggleSelectAll(event: Event): void {
  const target = event.target as HTMLInputElement;
  this.allSelected = target.checked;
  
  if (this.allSelected) {
    this.selectedRequisitions = this.getPaginatedRows().map(row => row.id);
  } else {
    this.selectedRequisitions = [];
  }
}

toggleSelection(id: string): void {
  const index = this.selectedRequisitions.indexOf(id);
  if (index === -1) {
    this.selectedRequisitions.push(id);
  } else {
    this.selectedRequisitions.splice(index, 1);
  }
  this.allSelected = this.selectedRequisitions.length === this.getPaginatedRows().length;
}

isSelected(id: string): boolean {
  return this.selectedRequisitions.includes(id);
}
// Add these methods to your component class
calculateTotalUnitPurchasePrice(): number {
  return this.filteredRows.reduce((total, row) => {
    if (row.items && row.items.length > 0) {
      return total + row.items.reduce((itemTotal, item) => {
        return itemTotal + (item.unitPurchasePrice || 0) * (item.requiredQuantity || 0);
      }, 0);
    }
    return total;
  }, 0);
}

calculateTotalPurchasePriceIncTax(): number {
  return this.filteredRows.reduce((total, row) => {
    if (row.items && row.items.length > 0) {
      return total + row.items.reduce((itemTotal, item) => {
        return itemTotal + (item.purchasePriceIncTax || 0) * (item.requiredQuantity || 0);
      }, 0);
    }
    return total;
  }, 0);
}
deleteSelectedRequisitions(): void {
  if (this.selectedRequisitions.length === 0) return;
  
  if (confirm(`Are you sure you want to delete ${this.selectedRequisitions.length} selected requisition(s)?`)) {
    this.isLoading = true;
    
    // Create an array of delete promises
    const deletePromises = this.selectedRequisitions.map(id => 
      this.requisitionService.deleteRequisition(id)
    );
    
    // Execute all delete operations
    Promise.all(deletePromises)
      .then(() => {
        this.loadRequisitions();
        this.selectedRequisitions = [];
        this.allSelected = false;
      })
      .catch(error => {
        console.error('Error deleting requisitions:', error);
        alert('Some requisitions could not be deleted. Please try again.');
      })
      .finally(() => {
        this.isLoading = false;
      });
  }
}
   // Add sorting method
   sortTable(column: string) {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    this.filteredRows.sort((a, b) => {
      let valueA: any;
      let valueB: any;

      // Special handling for nested properties
      if (column === 'items') {
        valueA = this.calculateTotalRequiredQuantity(a.items);
        valueB = this.calculateTotalRequiredQuantity(b.items);
      } else if (column === 'totalQuantity') {
        valueA = this.calculateTotalRequiredQuantity(a.items);
        valueB = this.calculateTotalRequiredQuantity(b.items);
      } else {
        valueA = a[column as keyof Requisition];
        valueB = b[column as keyof Requisition];
      }

      // Handle dates
      if (column.includes('Date') || column === 'date') {
        valueA = new Date(valueA).getTime();
        valueB = new Date(valueB).getTime();
      }

      // Handle undefined/null values
      if (valueA === undefined || valueA === null) valueA = '';
      if (valueB === undefined || valueB === null) valueB = '';

      // Compare values
      if (valueA < valueB) {
        return this.sortDirection === 'asc' ? -1 : 1;
      } else if (valueA > valueB) {
        return this.sortDirection === 'asc' ? 1 : -1;
      } else {
        return 0;
      }
    });
  }

  // Update the getSortIcon method to determine which icon to show
  getSortIcon(column: string): string {
    if (this.sortColumn !== column) {
      return 'fa-sort';
    }
    return this.sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
  }
loadRequisitions() {
  this.isLoading = true;
  this.requisitionService.getRequisitions().subscribe({
    next: (data) => {
      this.rows = data.map(req => {
        const locationObj = this.businessLocations.find(loc => loc.id === req.location);
        const locationName = locationObj ? locationObj.name : req.location;
        const itemsWithPrices = req.items ? req.items.map(item => ({
          ...item,
          currentStock: item.currentStock || 0,
          unitPurchasePrice: item.unitPurchasePrice || 0,
          purchasePriceIncTax: item.purchasePriceIncTax || 0
        })) : [];
        
        let supplierName = 'N/A';
        let supplierValue: string | undefined = undefined;
        let supplierAddress = 'N/A'; // Add this line
        
        if ('supplier' in req) {
          if (typeof req.supplier === 'string') {
            const supplierStr = req.supplier as string;
            if (supplierStr && supplierStr !== '') {
              supplierValue = supplierStr;
              const supplierObj = this.suppliers.find(s => s.id === supplierStr);
              if (supplierObj) {
                supplierName = supplierObj.businessName || 
                              `${supplierObj.firstName} ${supplierObj.lastName}`.trim();
                
                // Build the address string
                const addressParts = [
                  supplierObj.address,
                  supplierObj.addressLine1,
                  supplierObj.addressLine2,
                  supplierObj.city,
                  supplierObj.state,
                  supplierObj.postalCode || supplierObj.zipCode,
                  supplierObj.country
                ].filter(part => !!part); // Remove empty parts
                
                supplierAddress = addressParts.join(', '); // Set the address
              }
            }
          }
        }
        
        return {
          id: req.id,
          date: req.date,
          referenceNo: req.referenceNo,
          location: req.location,
          locationName: locationName,
          itemsWithPrices,
          status: req.status,
          requiredByDate: req.requiredByDate,
          addedBy: req.addedBy,
          items: req.items ? req.items.map(item => ({
            ...item,
            currentStock: item.currentStock || 0
          })) : [],
          brand: ('brand' in req) ? req.brand || 'N/A' : 'N/A',
          category: ('category' in req) ? req.category || 'N/A' : 'N/A',
          shippingStatus: ('shippingStatus' in req) ? req.shippingStatus || 'Not Shipped' : 'Not Shipped',
          supplier: supplierValue,
          supplierName: supplierName,
          supplierAddress: supplierAddress, // Add this line
          shippingDate: ('shippingDate' in req) ? req.shippingDate || 'N/A' : 'N/A',
          totalQuantity: this.calculateTotalRequiredQuantity(req.items || [])
        };
      });
      
      this.applyFilters();
      this.isLoading = false;
      this.cdr.detectChanges();
    },
    error: (error) => {
      console.error('Error loading requisitions:', error);
      this.isLoading = false;
    }
  });
}

applyCustomRange(): void {
  if (this.fromDate && this.toDate) {
    this.startDate = this.fromDate;
    this.endDate = this.toDate;
    this.applyFilters();
    this.isDateDrawerOpen = false;
  } else {
    alert('Please select both from and to dates');
  }
  }
  cancelCustomRange(): void {
  this.isCustomDate = false;
  this.selectedRange = '';
}private formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}
private getFinancialYearStart(date: Date): Date {
  // Assuming financial year starts April 1st
  const currentMonth = date.getMonth();
  const currentYear = date.getFullYear();
  
  if (currentMonth < 3) { // April is month 3 (0-indexed)
    return new Date(currentYear - 1, 3, 1);
  } else {
    return new Date(currentYear, 3, 1);
  }
}
  onSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchTerms.next(target.value);
  }

  toggleActionDropdown(id: string, event: Event): void {
    event.stopPropagation();
    this.openActionDropdownId = this.openActionDropdownId === id ? null : id;
  }

getPaginatedRows(): Requisition[] {
  const startIndex = (this.currentPage - 1) * this.entriesPerPage;
  return this.filteredRows.slice(startIndex, startIndex + this.entriesPerPage);
}

  getFirstEntryIndex(): number {
    if (this.filteredRows.length === 0) return 0;
    return (this.currentPage - 1) * this.entriesPerPage + 1;
  }

  getLastEntryIndex(): number {
    return Math.min(this.currentPage * this.entriesPerPage, this.filteredRows.length);
  }

approveRequisition(requisition: Requisition, event?: Event) {
  if (event) event.stopPropagation();
  
  if (confirm('Are you sure you want to approve this requisition?')) {
    // Get the supplier details including address
    const supplier = this.suppliers.find(s => s.id === requisition.supplier);
    let supplierAddress = '';
    
    if (supplier) {
      // Build the address string from supplier details
      const addressParts = [
        supplier.address,
        supplier.addressLine1,
        supplier.addressLine2,
        supplier.city,
        supplier.state,
        supplier.postalCode || supplier.zipCode,
        supplier.country
      ].filter(part => !!part); // Remove empty parts
      
      supplierAddress = addressParts.join(', ');
    }

    // Create a complete purchase order object from the requisition
    const purchaseOrder = {
      date: new Date().toLocaleDateString(),
      referenceNo: requisition.referenceNo,
      businessLocation: requisition.locationName,
      businessLocationId: requisition.location,
      supplier: requisition.supplier || 'To be assigned',
      supplierName: requisition.supplierName || 'To be assigned',
      supplierAddress: supplierAddress || requisition.supplierAddress || 'N/A', // Add supplier address
      status: 'Pending',
      quantityRemaining: 0,
      shippingStatus: requisition.shippingStatus || 'Not Shipped',
      shippingCharges: 0,
      addedBy: requisition.addedBy,
      createdAt: new Date(),
      requisitionId: requisition.id,
      requiredByDate: requisition.requiredByDate,
      // Transfer all product items with unit purchase price
      products: requisition.items.map(item => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.requiredQuantity,
        unitCost: item.unitPurchasePrice || 0,
        unitPurchasePrice: item.unitPurchasePrice || 0,
        alertQuantity: item.alertQuantity,
        currentStock: item.currentStock,
        requiredQuantity: item.requiredQuantity,
        subtotal: item.subtotal // Include subtotal from requisition
      })),
      // Keep original items for reference
      items: requisition.items.map(item => ({
        ...item,
        unitCost: item.unitPurchasePrice || 0,
        subtotal: item.subtotal // Include subtotal from requisition
      })),
      brand: requisition.brand,
      category: requisition.category,
      shippingDate: requisition.shippingDate,
      orderTotal: this.calculateRequisitionTotal(requisition.items) // Calculate total
    };

    this.isLoading = true;
    
    // First update the requisition status
    this.requisitionService.updateRequisitionStatus(requisition.id, 'Approved')
      .then(() => {
        // Then create the purchase order
        return this.purchaseOrderService.createPurchaseOrderFromRequisition(purchaseOrder);
      })
      .then((createdOrder) => {
        this.router.navigate(['/purchase-order'], {
          queryParams: { 
            newlyApproved: requisition.id 
          }
        });
      })
      .catch(error => {
        console.error('Error in approval process:', error);
        alert('Error during approval process. Please try again.');
      })
      .finally(() => {
        this.isLoading = false;
      });
  }
  }
 createPurchaseOrderFromRequisition(order: any): Promise<any> {
  // Include supplierAddress in the data being saved
  const orderData = {
    ...order,
    supplierAddress: order.supplierAddress || 'N/A'
  };
  
  return this.afs.collection('purchaseOrders').add(orderData);
}
calculateRequisitionTotal(items: RequisitionItem[]): number {
  if (!items || items.length === 0) return 0;
  return items.reduce((total, item) => {
    return total + (item.subtotal || (item.requiredQuantity * (item.unitPurchasePrice || 0)));
  }, 0);
}

previousPage(): void {
  if (this.currentPage > 1) {
    this.currentPage--;
  }
}


nextPage(): void {
  if (this.currentPage < this.totalPages) {
    this.currentPage++;
  }
}

calculateTotalPages(): void {
  this.totalPages = Math.max(1, Math.ceil(this.filteredRows.length / this.entriesPerPage));
  if (this.currentPage > this.totalPages && this.totalPages > 0) {
    this.currentPage = 1;
  }
}

onEntriesChange(): void {
  this.calculateTotalPages();
  this.currentPage = 1;
}

  applyFilters() {
  this.filteredRows = this.rows.filter(row => {
      const searchTerm = this.searchTerm.toLowerCase();
      const matchesSearch = !this.searchTerm || 
        (row.referenceNo?.toLowerCase().includes(searchTerm) ||
        row.locationName?.toLowerCase().includes(searchTerm) || 
        row.addedBy?.toLowerCase().includes(searchTerm) || 
        row.status?.toLowerCase().includes(searchTerm) ||
        (row.brand && row.brand.toLowerCase().includes(searchTerm)) ||
        (row.category && row.category.toLowerCase().includes(searchTerm)) ||
        (row.supplierName && row.supplierName.toLowerCase().includes(searchTerm)) ||
        (row.items && row.items.some(item => 
          item.productName?.toLowerCase().includes(searchTerm)
        )));
      
      const matchesLocation = this.selectedLocation === 'All' || 
                            row.locationName === this.selectedLocation;
  
      const matchesStatus = this.selectedStatus === 'All' || 
                          row.status === this.selectedStatus;
  
      const matchesSupplier = this.selectedSupplier === 'All' || 
                            row.supplier === this.selectedSupplier;
  
    // Date range filter
    const matchesRequiredByDate = !this.requiredByDate || 
                                row.requiredByDate === this.requiredByDate;

    // Date range filter logic
    let matchesDateRange = true;
    if (this.startDate && this.endDate) {
      const rowDate = new Date(row.date);
      const start = new Date(this.startDate);
      const end = new Date(this.endDate);
      // Set time to 0 for comparison
      rowDate.setHours(0, 0, 0, 0);
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      matchesDateRange = rowDate >= start && rowDate <= end;
    }

    return matchesSearch && matchesLocation && matchesStatus && 
           matchesSupplier && matchesDateRange && matchesRequiredByDate;
  });

  this.calculateTotalPages();
  this.currentPage = 1;
  this.openActionDropdownId = null;
}

resetFilters(): void {
    this.selectedLocation = 'All';
    this.selectedStatus = 'All';
    this.selectedSupplier = 'All';
    this.startDate = '';
    this.endDate = '';
    this.requiredByDate = '';
    this.searchTerm = '';
    this.applyFilters();
  }

 exportCSV() {
  const visibleColumns = this.columns.filter(col => col.visible);
  const headers = visibleColumns.map(col => col.name);
  
  const data = this.filteredRows.map(row => 
    visibleColumns.map(col => {
      if (col.field === 'items') {
        return row.items.map(item => `${item.productName} (${item.requiredQuantity})`).join(', ');
      }
      if (col.field === 'totalQuantity') {
        return this.calculateTotalRequiredQuantity(row.items);
      }
      return row[col.field as keyof Requisition] || '';
    })
  );

  // Add totals row
  const totalsRow: (string | number)[] = visibleColumns.map(col => {
    if (col.field === 'unitPurchasePrice') {
      return this.calculateTotalUnitPurchasePrice();
    }
    if (col.field === 'purchasePriceIncTax') {
      return this.calculateTotalPurchasePriceIncTax();
    }
    return '';
  });
  totalsRow[0] = 'Totals:'; // Set the first column to "Totals"

  let csvContent = "data:text/csv;charset=utf-8," 
    + headers.join(',') + '\n'
    + data.map(e => e.join(',')).join('\n')
    + '\n' + totalsRow.join(',');

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "purchase_requisitions.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}


exportExcel() {
  const visibleData = this.filteredRows.map(row => {
    const newRow: any = {};
    this.columns.forEach(col => {
      if (col.visible) {
        if (col.field === 'items') {
          newRow[col.name] = row.items.map(item => `${item.productName} (${item.requiredQuantity})`).join(', ');
        } else if (col.field === 'totalQuantity') {
          newRow[col.name] = this.calculateTotalRequiredQuantity(row.items);
        } else {
          newRow[col.name] = row[col.field as keyof Requisition] || '';
        }
      }
    });
    return newRow;
  });
  
  // Add totals row
  const totalsRow: any = {};
  this.columns.forEach(col => {
    if (col.visible) {
      if (col.field === 'unitPurchasePrice') {
        totalsRow[col.name] = this.calculateTotalUnitPurchasePrice();
      } else if (col.field === 'purchasePriceIncTax') {
        totalsRow[col.name] = this.calculateTotalPurchasePriceIncTax();
      } else if (col.field === 'referenceNo') {
        totalsRow[col.name] = 'Totals:';
      }
    }
  });
  visibleData.push(totalsRow);
  
  const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(visibleData);
  const workbook: XLSX.WorkBook = { Sheets: { 'data': worksheet }, SheetNames: ['data'] };
  XLSX.writeFile(workbook, 'purchase_requisitions.xlsx');
}

  print() {
    const printDiv = document.createElement('div');
    printDiv.innerHTML = `
      <h2>Purchase Requisitions</h2>
      <table border="1" cellpadding="3" cellspacing="0" style="width:100%">
        <thead>
          <tr>
            ${this.columns.filter(col => col.visible)
              .map(col => `<th>${col.name}</th>`).join('')}
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${this.getPaginatedRows().map(row => `
            <tr>
              ${this.columns.filter(col => col.visible)
                .map(col => {
                  if (col.field === 'items') {
                    return `<td>${row.items.map(item => `${item.productName} (${item.requiredQuantity})`).join(', ')}</td>`;
                  }
                  return `<td>${row[col.field as keyof Requisition] || ''}</td>`;
                }).join('')}
              <td>View/Approve/Delete</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div style="margin-top: 20px;">
        Showing ${this.getFirstEntryIndex()} to ${this.getLastEntryIndex()} 
        of ${this.filteredRows.length} entries
      </div>
    `;
    
    const printWindow = window.open('', '_blank');
    printWindow?.document.write(printDiv.innerHTML);
    printWindow?.document.close();
    printWindow?.focus();
    printWindow?.print();
  }

  toggleColumnVisibility() {
    this.showColumnVisibility = !this.showColumnVisibility;
  }
  
  updateColumnVisibility(column: ColumnVisibility) {
    column.visible = !column.visible;
  }
  
  hasVisibleColumns(): boolean {
    return this.columns.filter(col => col.visible).length > 1;
  }

  viewRequisition(id: string, event?: Event) {
    if (event) event.stopPropagation();
    this.router.navigate(['/view-purchase-requisition', id]);
    this.openActionDropdownId = null;
  }

  deleteRequisition(id: string, event?: Event) {
    if (event) event.stopPropagation();
    
    if(confirm('Are you sure you want to delete this requisition?')) {
      this.requisitionService.deleteRequisition(id).then(() => {
        this.loadRequisitions();
        this.openActionDropdownId = null;
      });
    }
  }

  navigateToAddRequisition() {
    this.router.navigate(['/add-purchase-requisition']);
  }
  
  trackByFn(index: number, item: Requisition): string {
    return item.id;
  }
  
  getVisibleColumns(): ColumnVisibility[] {
    return this.columns.filter(col => col.visible);
  }
  
  formatItemList(items: RequisitionItem[]): string {
    return items.map(item => `${item.productName} (${item.requiredQuantity})`).join(', ');
  }
  
exportPDF() {
  const doc = new jsPDF();
  const title = 'Purchase Requisitions';

  const visibleColumns = this.getVisibleColumns();
  const headers = [visibleColumns.map(col => col.name)];

  const data = this.filteredRows.map(row =>
    visibleColumns.map(col => {
      if (col.field === 'items') {
        return this.formatItemList(row.items);
      }
      if (col.field === 'totalQuantity') {
        return this.calculateTotalRequiredQuantity(row.items).toString();
      }
      const value = row[col.field as keyof Requisition];
      return value !== undefined && value !== null ? value.toString() : '';
    })
  );

  // Add totals row
  const totalsRow = visibleColumns.map(col => {
    if (col.field === 'unitPurchasePrice') {
      return this.calculateTotalUnitPurchasePrice().toString();
    }
    if (col.field === 'purchasePriceIncTax') {
      return this.calculateTotalPurchasePriceIncTax().toString();
    }
    if (col.field === 'referenceNo') {
      return 'Totals:';
    }
    return '';
  });
  data.push(totalsRow);

  doc.setFontSize(14);
  doc.text(title, 14, 15);

  (doc as any).autoTable({
    head: headers,
    body: data,
    startY: 25,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontSize: 9 },
    // Style the totals row
    didDrawCell: (data: any) => {
      if (data.row.index === data.table.rows.length - 1) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
      }
    }
  });

  doc.save('purchase_requisitions.pdf');
}


  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }
}