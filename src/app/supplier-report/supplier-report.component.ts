import { Component, OnInit } from '@angular/core';
import { SupplierService } from '../services/supplier.service';
import { CustomerService } from '../services/customer.service';
import { UserService } from '../services/user.service';
import { PurchaseService } from '../services/purchase.service';
import { FormBuilder } from '@angular/forms';
import { PaymentService } from '../services/payment.service';
import { Router } from '@angular/router';
import { LocationService } from '../services/location.service';
import { AccountService } from '../services/account.service';

interface Supplier {
  id?: string;
  paymentAmount?: number;
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
  purchaseDue?: number;
  purchaseReturn?: number;
  advanceBalance?: number;
  grandTotal?: number;
  paymentDue?: number;
  addressLine1?: string;
  addressLine2?: string;
  shippingAddress?: {
    customerName?: string;
    address1?: string;
    address2?: string;
    country?: string;
    state?: string;
    district?: string;
    zipCode?: string;
  };
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
  prefix?: string;
  middleName?: string;
  dob?: Date;
  payTerm?: number;
  contactType?: string;
  address: string;
}

@Component({
  selector: 'app-supplier-report',
  templateUrl: './supplier-report.component.html',
  styleUrls: ['./supplier-report.component.scss']
})
export class SupplierReportComponent implements OnInit {
  suppliersList: Supplier[] = [];
  filteredSuppliers: Supplier[] = [];
  assignedUsers: {id: string, username: string}[] = []; 
  isFilterVisible = false;
  dateRangeLabel: string = '';
  isCustomDate: boolean = false;
  isDrawerOpen = false;
  selectedRange = '';
  isDateDrawerOpen = false;
  fromDate: string = '';
  toDate: string = '';
  statesList: string[] = [];
  filteredDistricts: string[] = [];
  currentPage = 1;
  totalPages = 1;
  entriesPerPage = 10;
  sortColumn = 'businessName';
  sortDirection = 'asc';
  searchTerm = '';

  filterOptions = {
    purchaseDue: false,
    purchaseReturn: false,
    advanceBalance: false,
    openingBalance: false,
    assignedTo: '',
    status: '',
    state: '',
    district: '', // Added missing district property
    fromDate: '',
    toDate: '',
  };

  stateDistricts: { [key: string]: string[] } = {
    'Kerala': [
      'Thiruvananthapuram', 'Kollam', 'Pathanamthitta', 'Alappuzha', 
      'Kottayam', 'Idukki', 'Ernakulam', 'Thrissur', 
      'Palakkad', 'Malappuram', 'Kozhikode', 'Wayanad', 
      'Kannur', 'Kasaragod'
    ],
    'Tamil Nadu': [
      'Ariyalur', 'Chengalpattu', 'Chennai', 'Coimbatore', 
      'Cuddalore', 'Dharmapuri', 'Dindigul', 'Erode', 
      'Kallakurichi', 'Kancheepuram', 'Karur', 'Krishnagiri', 
      'Madurai', 'Mayiladuthurai', 'Nagapattinam', 'Namakkal', 
      'Perambalur', 'Pudukkottai', 'Ramanathapuram', 'Ranipet', 
      'Salem', 'Sivaganga', 'Tenkasi', 'Thanjavur', 
      'Theni', 'Thoothukudi', 'Tiruchirappalli', 'Tirunelveli', 
      'Tirupathur', 'Tiruppur', 'Tiruvallur', 'Tiruvannamalai', 
      'Tiruvarur', 'Vellore', 'Viluppuram', 'Virudhunagar'
    ]
  };

  constructor(
    private supplierService: SupplierService,
    private accountService: AccountService,
    private customerService: CustomerService,
    private userService: UserService,
    private purchaseService: PurchaseService,
    private fb: FormBuilder,
    private paymentService: PaymentService,
    private router: Router,
    private locationService: LocationService
  ) {}

  ngOnInit(): void {
    this.loadSuppliers();
    this.loadAssignedUsers();
    this.loadStates();
  }

  loadSuppliers(): void {
    this.supplierService.getSuppliers().subscribe((suppliers: any[]) => {
      this.suppliersList = suppliers.map(supplier => ({
        ...supplier,
        createdAt: supplier.createdAt ? new Date(supplier.createdAt) : new Date(),
        status: supplier.status === 'Active' || supplier.status === 'Inactive'
          ? supplier.status
          : undefined
      }));
      this.applyFilters();
    });
  }

  loadAssignedUsers(): void {
    this.userService.getUsers().subscribe((users) => {
      this.assignedUsers = users.map(user => ({
        id: user.id,
        username: user.username || user.displayName || user.email || 'Unknown User'
      }));
    }, error => {
      console.error('Error loading users:', error);
      this.assignedUsers = [];
    });
  }

  loadStates(): void {
    this.supplierService.getSuppliers().subscribe(suppliers => {
      this.statesList = [...new Set(
        suppliers
          .map(s => s.state)
          .filter((state): state is string => !!state && state.trim() !== '')
      )].sort((a, b) => a.localeCompare(b));
    });
  }

  getAssignedUserName(userId: string): string {
    if (!userId) return '';
    const user = this.assignedUsers.find(u => u.id === userId);
    return user ? user.username : userId;
  }

  // Added missing getTotal method
  getTotal(field: 'openingBalance' | 'purchaseDue' | 'purchaseReturn' | 'advanceBalance'): number {
    return this.filteredSuppliers.reduce((total, supplier) => {
      return total + (supplier[field] || 0);
    }, 0);
  }

  applyFilters(): void {
    let filtered = [...this.suppliersList];
    
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(supplier => 
        (supplier.businessName?.toLowerCase().includes(term) || 
        `${supplier.firstName ?? ''} ${supplier.lastName ?? ''}`.toLowerCase().includes(term) ||
        supplier.email?.toLowerCase().includes(term) ||
        supplier.mobile?.toLowerCase().includes(term) ||
        supplier.contactId?.toLowerCase().includes(term) ||
        supplier.landline?.toLowerCase().includes(term) ||
        supplier.alternateContact?.toLowerCase().includes(term) ||
        supplier.taxNumber?.toLowerCase().includes(term) ||
        supplier.city?.toLowerCase().includes(term) ||
        supplier.state?.toLowerCase().includes(term) ||
        supplier.country?.toLowerCase().includes(term))
    )}
    
    if (this.filterOptions.fromDate) {
      const fromDate = new Date(this.filterOptions.fromDate);
      filtered = filtered.filter(supplier => {
        const supplierDate = supplier.createdAt ? new Date(supplier.createdAt) : new Date();
        return supplierDate >= fromDate;
      });
    }
    
    if (this.filterOptions.toDate) {
      const toDate = new Date(this.filterOptions.toDate);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(supplier => {
        const supplierDate = supplier.createdAt ? new Date(supplier.createdAt) : new Date();
        return supplierDate <= toDate;
      });
    }
    
    if (this.filterOptions.purchaseDue) {
      filtered = filtered.filter(supplier => supplier.purchaseDue && supplier.purchaseDue > 0);
    }
    
    if (this.filterOptions.purchaseReturn) {
      filtered = filtered.filter(supplier => supplier.purchaseReturn && supplier.purchaseReturn > 0);
    }
    
    if (this.filterOptions.advanceBalance) {
      filtered = filtered.filter(supplier => supplier.advanceBalance && supplier.advanceBalance > 0);
    }
    
    if (this.filterOptions.openingBalance) {
      filtered = filtered.filter(supplier => supplier.openingBalance && supplier.openingBalance > 0);
    }
    
    if (this.filterOptions.assignedTo) {
      filtered = filtered.filter(supplier => supplier.assignedTo === this.filterOptions.assignedTo);
    }
    
    if (this.filterOptions.status) {
      filtered = filtered.filter(supplier => supplier.status === this.filterOptions.status);
    }
    
    if (this.filterOptions.state) {
      filtered = filtered.filter(supplier => supplier.state === this.filterOptions.state);
    }

    // Added district filter
    if (this.filterOptions.district) {
      filtered = filtered.filter(supplier => supplier.district === this.filterOptions.district);
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
    this.currentPage = Math.min(this.currentPage, this.totalPages);
  }

  toggleFilters(): void {
    this.isFilterVisible = !this.isFilterVisible;
  }

  toggleDateDrawer(): void {
    this.isDateDrawerOpen = !this.isDateDrawerOpen;
  }

  filterByDate(range: string) {
    this.selectedRange = range;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (range) {
      case 'today':
        this.filterOptions.fromDate = this.filterOptions.toDate = this.formatDate(today);
        this.dateRangeLabel = 'Today';
        break;
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        this.filterOptions.fromDate = this.filterOptions.toDate = this.formatDate(yesterday);
        this.dateRangeLabel = 'Yesterday';
        break;
      case 'sevenDays':
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        this.filterOptions.fromDate = this.formatDate(sevenDaysAgo);
        this.filterOptions.toDate = this.formatDate(today);
        this.dateRangeLabel = 'Last 7 Days';
        break;
      case 'thirtyDays':
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        this.filterOptions.fromDate = this.formatDate(thirtyDaysAgo);
        this.filterOptions.toDate = this.formatDate(today);
        this.dateRangeLabel = 'Last 30 Days';
        break;
      case 'thisWeek':
        const firstDayOfWeek = new Date(today);
        firstDayOfWeek.setDate(firstDayOfWeek.getDate() - firstDayOfWeek.getDay());
        this.filterOptions.fromDate = this.formatDate(firstDayOfWeek);
        this.filterOptions.toDate = this.formatDate(today);
        this.dateRangeLabel = 'This Week';
        break;
      case 'thisMonth':
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        this.filterOptions.fromDate = this.formatDate(firstDayOfMonth);
        this.filterOptions.toDate = this.formatDate(today);
        this.dateRangeLabel = 'This Month';
        break;
      case 'lastMonth':
        const firstDayOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastDayOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
        this.filterOptions.fromDate = this.formatDate(firstDayOfLastMonth);
        this.filterOptions.toDate = this.formatDate(lastDayOfLastMonth);
        this.dateRangeLabel = 'Last Month';
        break;
      case 'thisYear':
        const firstDayOfYear = new Date(today.getFullYear(), 0, 1);
        this.filterOptions.fromDate = this.formatDate(firstDayOfYear);
        this.filterOptions.toDate = this.formatDate(today);
        this.dateRangeLabel = 'This Year';
        break;
      case 'custom':
        this.isCustomDate = true;
        return;
    }

    this.isCustomDate = false;
    this.isDateDrawerOpen = false;
    this.applyFilters();
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  clearFilters(): void {
    this.filterOptions = {
      purchaseDue: false,
      purchaseReturn: false,
      advanceBalance: false,
      openingBalance: false,
      assignedTo: '',
      status: '',
      state: '',
      district: '', // Added district reset
      fromDate: '',
      toDate: ''
    };
    this.fromDate = '';
    this.toDate = '';
    this.dateRangeLabel = '';
    this.isCustomDate = false;
    this.selectedRange = '';
    this.applyFilters();
  }

  selectCustomRange(): void {
    this.selectedRange = 'custom';
    this.isCustomDate = true;
  }

  cancelCustomRange(): void {
    this.isCustomDate = false;
    this.selectedRange = '';
  }

  applyCustomRange(): void {
    if (this.fromDate && this.toDate) {
      const fromDate = new Date(this.fromDate);
      const toDate = new Date(this.toDate);
      this.dateRangeLabel = `${fromDate.toLocaleDateString()} - ${toDate.toLocaleDateString()}`;
      
      this.filterOptions = {
        ...this.filterOptions,
        fromDate: this.fromDate,
        toDate: this.toDate
      };
      
      this.applyFilters();
      this.toggleDateDrawer();
    }
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

  get paginatedSuppliers(): Supplier[] {
    const start = (this.currentPage - 1) * this.entriesPerPage;
    const end = start + this.entriesPerPage;
    return this.filteredSuppliers.slice(start, end);
  }

  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  exportCSV(): void {
    try {
      const csvData = this.filteredSuppliers.map(supplier => ({
        'Contact ID': supplier.contactId || '',
        'Name': supplier.isIndividual 
          ? `${supplier.prefix || ''} ${supplier.firstName || ''} ${supplier.middleName || ''} ${supplier.lastName || ''}`.trim() 
          : supplier.businessName || '',
        'Mobile': supplier.mobile || '',
        'Email': supplier.email || '',
        'Landline': supplier.landline || '',
        'Alternate Contact': supplier.alternateContact || '',
        'Tax Number': supplier.taxNumber || '',
        'Opening Balance': supplier.openingBalance || 0,
        'Purchase Due': supplier.purchaseDue || 0,
        'Purchase Return': supplier.purchaseReturn || 0,
        'Advance Balance': supplier.advanceBalance || 0,
        'Status': supplier.status || '',
        'Assigned To': supplier.assignedTo || '',
        'Address': `${supplier.addressLine1 || ''} ${supplier.addressLine2 || ''}`.trim(),
        'City': supplier.city || '',
        'State': supplier.state || '',
        'Country': supplier.country || '',
        'Zip Code': supplier.zipCode || ''
      }));
  
      let csvContent = "data:text/csv;charset=utf-8,";
      const headers = Object.keys(csvData[0]);
      csvContent += headers.join(",") + "\r\n";
      
      csvData.forEach(row => {
        const values = headers.map(header => {
          const value = row[header as keyof typeof row];
          return typeof value === 'string' && value.includes(',') 
            ? `"${value.replace(/"/g, '""')}"` 
            : value;
        });
        csvContent += values.join(",") + "\r\n";
      });
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `suppliers_report_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('Error exporting CSV. Please try again.');
    }
  }
  
  exportExcel(): void {
    try {
      const excelData = this.filteredSuppliers.map(supplier => ({
        'Contact ID': supplier.contactId || '',
        'Name': supplier.isIndividual 
          ? `${supplier.prefix || ''} ${supplier.firstName || ''} ${supplier.middleName || ''} ${supplier.lastName || ''}`.trim() 
          : supplier.businessName || '',
        'Mobile': supplier.mobile || '',
        'Email': supplier.email || '',
        'Landline': supplier.landline || '',
        'Alternate Contact': supplier.alternateContact || '',
        'Tax Number': supplier.taxNumber || '',
        'Opening Balance': supplier.openingBalance || 0,
        'Purchase Due': supplier.purchaseDue || 0,
        'Purchase Return': supplier.purchaseReturn || 0,
        'Advance Balance': supplier.advanceBalance || 0,
        'Status': supplier.status || '',
        'Assigned To': supplier.assignedTo || '',
        'Address Line 1': supplier.addressLine1 || '',
        'Address Line 2': supplier.addressLine2 || '',
        'City': supplier.city || '',
        'State': supplier.state || '',
        'Country': supplier.country || '',
        'Zip Code': supplier.zipCode || ''
      }));
      
      // Fixed XLSX import and typing issue
      import('xlsx').then((XLSX) => {
        const ws = XLSX.utils.json_to_sheet(excelData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Suppliers Report');
        XLSX.writeFile(wb, `suppliers_report_${new Date().toISOString().slice(0,10)}.xlsx`);
      }).catch(error => {
        console.error('Error loading XLSX library:', error);
        alert('Error exporting Excel. Please make sure xlsx library is installed.');
      });
    } catch (error) {
      console.error('Error exporting Excel:', error);
      alert('Error exporting Excel. Please try again.');
    }
  }

  exportPDF(): void {
    import('jspdf').then((jsPDFModule) => {
      const JsPDF = jsPDFModule.default;
      import('jspdf-autotable').then((autoTableModule) => {
        const doc = new JsPDF();
        
        // Add title
        doc.setFontSize(18);
        doc.text('Suppliers Report', 14, 22);
        
        // Add date range if filtered
        if (this.dateRangeLabel) {
          doc.setFontSize(10);
          doc.text(`Date Range: ${this.dateRangeLabel}`, 14, 30);
        }
        
        // Prepare data for PDF
        const pdfData = this.filteredSuppliers.map(supplier => [
          supplier.contactId || '',
          supplier.isIndividual 
            ? `${supplier.prefix || ''} ${supplier.firstName || ''} ${supplier.middleName || ''} ${supplier.lastName || ''}`.trim() 
            : supplier.businessName || '',
          supplier.mobile || '',
          supplier.email || '',
          supplier.status || '',
          supplier.openingBalance?.toFixed(2) || '0.00',
          supplier.purchaseDue?.toFixed(2) || '0.00',
          supplier.advanceBalance?.toFixed(2) || '0.00'
        ]);
        
        // Add table
        (doc as any).autoTable({
          head: [['ID', 'Name', 'Mobile', 'Email', 'Status', 'Opening Bal', 'Due', 'Advance']],
          body: pdfData,
          startY: 35,
          styles: {
            fontSize: 8,
            cellPadding: 2
          },
          headStyles: {
            fillColor: [41, 128, 185],
            textColor: 255,
            fontStyle: 'bold'
          },
          alternateRowStyles: {
            fillColor: [245, 245, 245]
          },
          columnStyles: {
            0: { cellWidth: 20 },
            1: { cellWidth: 30 },
            2: { cellWidth: 25 },
            3: { cellWidth: 35 },
            4: { cellWidth: 15 },
            5: { cellWidth: 20 },
            6: { cellWidth: 20 },
            7: { cellWidth: 20 }
          }
        });
        
        // Save the PDF
        doc.save(`suppliers_report_${new Date().toISOString().slice(0,10)}.pdf`);
      }).catch(error => {
        console.error('Error loading jsPDF autoTable:', error);
        alert('Error exporting PDF. Please make sure jspdf-autotable library is installed.');
      });
    }).catch(error => {
      console.error('Error loading jsPDF:', error);
      alert('Error exporting PDF. Please make sure jspdf library is installed.');
    });
  }

  onStateChange(): void {
    const selectedState = this.filterOptions.state;
    this.filteredDistricts = selectedState ? this.stateDistricts[selectedState] : [];
    this.applyFilters();
  }
}