import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { SupplierService } from '../services/supplier.service';
import { PurchaseService } from '../services/purchase.service';
import { Router } from '@angular/router';
import * as XLSX from 'xlsx';

interface Supplier {
  id?: string;
  contactId?: string;
  businessName?: string;
  firstName?: string;
  lastName?: string;
  isIndividual?: boolean;
  email?: string;
  mobile?: string;
  landline?: string;
  alternateContact?: string;
  assignedTo?: string;
  createdAt?: Date | string;
  status?: 'Active' | 'Inactive';
  district?: string;
  taxNumber?: string;
  openingBalance?: number;
  paymentDue?: number;
  paymentAmount?: number;
  totalPurchases?: number;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
  prefix?: string;
  middleName?: string;
  dob?: Date;
  payTerm?: number;
  contactType?: string;
}

interface ColumnVisibility {
  name: string;
  label: string;
  visible: boolean;
}

@Component({
  selector: 'app-supplier-summary',
  templateUrl: './supplier-summary.component.html',
  styleUrls: ['./supplier-summary.component.scss']
})
export class SupplierSummaryComponent implements OnInit {
  suppliers: Supplier[] = [];
  filteredSuppliers: Supplier[] = [];
  isLoading = true;

  @ViewChild('startDatePicker') startDatePicker!: ElementRef;
  @ViewChild('endDatePicker') endDatePicker!: ElementRef;

  // Pagination
  currentPage = 1;
  entriesPerPage = 25;
  totalPages = 1;
  
  // Search and filters
  searchTerm = '';
  filterOptions = {
    status: '',
    state: '',
    contactType: '',
    hasPaymentDue: false,
    hasOpeningBalance: false,
    startDate: '', 
    endDate: '' 
  };
  
  // Column visibility
  showColumnSelector = false;
  columnVisibility: ColumnVisibility[] = [
    { name: 'contactId', label: 'Contact ID', visible: true },
    { name: 'createdAt', label: 'Created Date', visible: true },
    { name: 'businessName', label: 'Business Name', visible: true },
    { name: 'firstName', label: 'Name', visible: true },
    { name: 'email', label: 'Email', visible: true },
    { name: 'mobile', label: 'Mobile', visible: true },
    { name: 'taxNumber', label: 'Tax Number', visible: false },
    { name: 'payTerm', label: 'Pay Term', visible: false },
    { name: 'openingBalance', label: 'Opening Balance', visible: true },
    { name: 'city', label: 'City', visible: false },
    { name: 'state', label: 'State', visible: true },
    { name: 'paymentDue', label: 'Payment Due', visible: true },
    { name: 'paymentAmount', label: 'Paid Amount', visible: true },
    { name: 'totalPurchases', label: 'Total Purchases', visible: true },
    { name: 'contactType', label: 'Contact Type', visible: true },
    { name: 'status', label: 'Status', visible: true }
  ];
  
  sortColumn = 'businessName';
  sortDirection = 'asc';
  
  summaryStats = {
    totalSuppliers: 0,
    activeSuppliers: 0,
    inactiveSuppliers: 0,
    totalPaymentDue: 0,
    totalPaid: 0,
    totalPurchases: 0
  };
  
  statesList: string[] = [];
  contactTypesList: string[] = ['Supplier', 'Customer', 'Both'];

  constructor(
    private supplierService: SupplierService,
    private purchaseService: PurchaseService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadSuppliers();
  }

  loadSuppliers(): void {
    this.isLoading = true;
    this.supplierService.getSuppliers().subscribe((suppliers: Supplier[]) => {
      this.suppliers = suppliers.map(supplier => ({
        ...supplier,
        createdAt: supplier.createdAt ? new Date(supplier.createdAt) : new Date()
      }));

      this.suppliers.forEach(supplier => {
        if (supplier.id) {
          this.purchaseService.getPurchasesBySupplier(supplier.id).subscribe(purchases => {
            const totalPurchase = purchases.reduce((sum, purchase) => 
              sum + (purchase.grandTotal || purchase.purchaseTotal || 0), 0);
            const totalPaid = purchases.reduce((sum, purchase) => 
              sum + (purchase.paymentAmount || 0), 0);
            
            supplier.totalPurchases = totalPurchase;
            supplier.paymentAmount = totalPaid;
            supplier.paymentDue = totalPurchase - totalPaid;
            
            this.applyFilters();
            this.calculateSummaryStats();
          });
        }
      });
      
      this.extractFilterLists();
      this.applyFilters();
      this.calculateSummaryStats();
      this.isLoading = false;
    });
  }

  extractFilterLists(): void {
    this.statesList = [...new Set(
      this.suppliers
        .map(s => s.state)
        .filter((state): state is string => !!state && state.trim() !== '')
    )].sort();
  }

  // === NEW DATE HELPERS ===
  getFormattedDateForInput(dateString: any): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  }

  openDatePicker(type: 'start' | 'end'): void {
    if (type === 'start') {
      this.startDatePicker.nativeElement.showPicker();
    } else {
      this.endDatePicker.nativeElement.showPicker();
    }
  }

  onManualDateInput(event: any, type: 'start' | 'end'): void {
    const input = event.target.value.trim();
    const datePattern = /^(\d{2})-(\d{2})-(\d{4})$/;
    const match = input.match(datePattern);
    
    if (match) {
      const day = match[1];
      const month = match[2];
      const year = match[3];
      const dateObj = new Date(`${year}-${month}-${day}`);
      if (dateObj && dateObj.getDate() === parseInt(day) && dateObj.getMonth() + 1 === parseInt(month)) {
        const formattedDate = `${year}-${month}-${day}`;
        if (type === 'start') this.filterOptions.startDate = formattedDate;
        else this.filterOptions.endDate = formattedDate;
        this.applyFilters();
      } else {
        alert('Invalid date! Please enter a valid date in DD-MM-YYYY format.');
        this.resetVisibleInput(event, type);
      }
    } else if (input !== '') {
      alert('Format must be DD-MM-YYYY');
      this.resetVisibleInput(event, type);
    }
  }

  private resetVisibleInput(event: any, type: 'start' | 'end'): void {
    const value = type === 'start' ? this.filterOptions.startDate : this.filterOptions.endDate;
    event.target.value = this.getFormattedDateForInput(value);
  }

  calculateSummaryStats(): void {
    this.summaryStats = {
      totalSuppliers: this.suppliers.length,
      activeSuppliers: this.suppliers.filter(s => s.status === 'Active').length,
      inactiveSuppliers: this.suppliers.filter(s => s.status !== 'Active').length,
      totalPaymentDue: this.suppliers.reduce((sum, s) => sum + (s.paymentDue || 0), 0),
      totalPaid: this.suppliers.reduce((sum, s) => sum + (s.paymentAmount || 0), 0),
      totalPurchases: this.suppliers.reduce((sum, s) => sum + (s.totalPurchases || 0), 0)
    };
  }

  applyFilters(): void {
    let filtered = [...this.suppliers];
    
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(supplier => 
        (supplier.businessName?.toLowerCase().includes(term)) || 
        (supplier.firstName?.toLowerCase().includes(term)) ||
        (supplier.lastName?.toLowerCase().includes(term)) ||
        (supplier.email?.toLowerCase().includes(term)) ||
        (supplier.mobile?.toLowerCase().includes(term)) ||
        (supplier.contactId?.toLowerCase().includes(term))
      );
    }

    // Date Range Filter
    if (this.filterOptions.startDate || this.filterOptions.endDate) {
      filtered = filtered.filter(supplier => {
        if (!supplier.createdAt) return false;
        const supDate = new Date(supplier.createdAt).getTime();
        const start = this.filterOptions.startDate ? new Date(this.filterOptions.startDate).getTime() : 0;
        const end = this.filterOptions.endDate ? new Date(this.filterOptions.endDate).getTime() : Infinity;
        return supDate >= start && supDate <= end;
      });
    }

    if (this.filterOptions.status) {
      filtered = filtered.filter(supplier => supplier.status === this.filterOptions.status);
    }

    if (this.filterOptions.state) {
      filtered = filtered.filter(supplier => supplier.state === this.filterOptions.state);
    }

    if (this.filterOptions.contactType) {
      filtered = filtered.filter(supplier => supplier.contactType === this.filterOptions.contactType);
    }

    if (this.filterOptions.hasPaymentDue) {
      filtered = filtered.filter(supplier => (supplier.paymentDue || 0) > 0);
    }

    if (this.filterOptions.hasOpeningBalance) {
      filtered = filtered.filter(supplier => (supplier.openingBalance || 0) > 0);
    }
    
    filtered.sort((a, b) => {
      const valA = a[this.sortColumn as keyof Supplier] || '';
      const valB = b[this.sortColumn as keyof Supplier] || '';
      if (valA < valB) return this.sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return this.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    
    this.filteredSuppliers = filtered;
    this.totalPages = Math.ceil(this.filteredSuppliers.length / this.entriesPerPage);
    this.currentPage = Math.min(this.currentPage, this.totalPages || 1);
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

  clearFilters(): void {
    this.filterOptions = {
      status: '',
      state: '',
      contactType: '',
      hasPaymentDue: false,
      hasOpeningBalance: false,
      startDate: '',
      endDate: ''
    };
    this.searchTerm = '';
    this.applyFilters();
  }

  get paginatedSuppliers(): Supplier[] {
    if (this.filteredSuppliers.length === 0) return [];
    const start = (this.currentPage - 1) * this.entriesPerPage;
    const end = start + this.entriesPerPage;
    return this.filteredSuppliers.slice(start, Math.min(end, this.filteredSuppliers.length));
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) this.currentPage = page;
  }

  prevPage(): void { if (this.currentPage > 1) this.currentPage--; }
  nextPage(): void { if (this.currentPage < this.totalPages) this.currentPage++; }

  getPageNumbers(): number[] {
    const pagesToShow = 5;
    const pages: number[] = [];
    if (this.totalPages <= pagesToShow) {
      for (let i = 1; i <= this.totalPages; i++) pages.push(i);
    } else {
      let startPage = Math.max(1, this.currentPage - Math.floor(pagesToShow / 2));
      let endPage = startPage + pagesToShow - 1;
      if (endPage > this.totalPages) {
        endPage = this.totalPages;
        startPage = Math.max(1, endPage - pagesToShow + 1);
      }
      for (let i = startPage; i <= endPage; i++) pages.push(i);
    }
    return pages;
  }

  toggleColumnSelector(): void { this.showColumnSelector = !this.showColumnSelector; }
  toggleColumnVisibility(columnName: string): void {
    const column = this.columnVisibility.find(c => c.name === columnName);
    if (column) column.visible = !column.visible;
  }
  isColumnVisible(columnName: string): boolean {
    const column = this.columnVisibility.find(c => c.name === columnName);
    return column ? column.visible : false;
  }
  getVisibleColumnsCount(): number {
    return this.columnVisibility.filter(c => c.visible).length + 1;
  }

  viewSupplier(supplier: Supplier): void {
    if (supplier.id) this.router.navigate(['/suppliers', supplier.id]);
  }

  editSupplier(supplier: Supplier): void {
    if (supplier.id) this.router.navigate(['/suppliers'], { queryParams: { edit: supplier.id } });
  }

  exportToExcel(): void {
    if (this.filteredSuppliers.length === 0) {
      alert('No data to export');
      return;
    }
    const exportData = this.filteredSuppliers.map(supplier => ({
      'Contact ID': supplier.contactId || '',
      'Created Date': supplier.createdAt ? new Date(supplier.createdAt).toLocaleDateString() : '',
      'Name': this.getFullName(supplier),
      'Business Name': supplier.businessName || '',
      'Mobile': supplier.mobile || '',
      'Opening Balance': supplier.openingBalance || 0,
      'Payment Due': supplier.paymentDue || 0,
      'Paid Amount': supplier.paymentAmount || 0,
      'Total Purchases': supplier.totalPurchases || 0,
      'State': supplier.state || '',
      'Status': supplier.status || 'Inactive'
    }));
    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(exportData);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Suppliers Summary');
    XLSX.writeFile(wb, `Suppliers_Summary_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  exportToCSV(): void {
    if (this.filteredSuppliers.length === 0) return;
    const csvData = this.filteredSuppliers.map(supplier => ({
      'Contact ID': supplier.contactId || '',
      'Name': this.getFullName(supplier),
      'Mobile': supplier.mobile || '',
      'Status': supplier.status || 'Inactive',
      'Payment Due': supplier.paymentDue || 0
    }));
    let csvContent = "data:text/csv;charset=utf-8,Contact ID,Name,Mobile,Status,Payment Due\n";
    csvData.forEach(row => {
      csvContent += `${row['Contact ID']},"${row.Name}",${row.Mobile},${row.Status},${row['Payment Due']}\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Suppliers_Summary_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  getFullName(supplier: Supplier): string {
    if (supplier.isIndividual) {
      return `${supplier.prefix || ''} ${supplier.firstName || ''} ${supplier.middleName || ''} ${supplier.lastName || ''}`.trim();
    }
    return supplier.businessName || '';
  }

  getFirstItemNumber(): number { return (this.currentPage - 1) * this.entriesPerPage + 1; }
  getLastItemNumber(): number {
    const last = this.currentPage * this.entriesPerPage;
    return last > this.filteredSuppliers.length ? this.filteredSuppliers.length : last;
  }
}