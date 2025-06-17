import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SupplierDocument, SupplierNote, SupplierService } from '../services/supplier.service';
import { PaymentService } from '../services/payment.service';
import { PurchaseService } from '../services/purchase.service';
import { AuthService } from '../auth.service';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Firestore, collection, onSnapshot, Unsubscribe, query, where } from '@angular/fire/firestore';
import { LocationService } from '../services/location.service';
import { ListPurchaseComponent } from '../list-purchase/list-purchase.component';
import { PurchaseItem } from '../models/purchase-item.model';
import { Purchase } from '../models/purchase.model'; // Adjust path as needed

@Component({
  selector: 'app-supplier-purchases',
  templateUrl: './supplier-purchases.component.html',
  styleUrls: ['./supplier-purchases.component.scss']
})
export class SupplierPurchasesComponent implements OnInit, OnDestroy {
  selectedFiles: File[] = [];
  isUploading: boolean = false;
  uploadProgress: number | null = null;
  invoiceNo?: string;
  selectedQuickFilter: string = '';
  showCustomDateRange: boolean = false;
  financialYearStartMonth: number = 4; 
  purchaseDate: Date | string | any; 
  payments: any[] = [];
paymentLoading = false;
  supplierId: string = '';
  supplierDetails: any = {};
  locations: any[] = [];
  filteredPurchases: Purchase[] = [];
  purchases: Purchase[] = [];
  // Add these properties to the component class
customFromDate: string = '';
customToDate: string = '';

  searchTerm: string = '';
  currentPage: number = 1;

  isLoadingPurchases = true;
  itemsPerPage: number = 10;
  totalPages: number = 1;
  dateFilterOptions = [
    { label: 'Today', value: 'today' },
    { label: 'Yesterday', value: 'yesterday' },
    { label: 'This Week', value: 'thisWeek' },
    { label: 'This Month', value: 'thisMonth' },
    { label: 'This Financial Year', value: 'thisFinancialYear' },
    { label: 'Previous Year', value: 'previousYear' },
    { label: 'Custom Date Range', value: 'custom' }
  ];
  selectedDateFilter: string = 'thisMonth';

  selectedLocation: string = 'all';
  purchasesUnsubscribe: Unsubscribe | null = null;
  
  isLoading = true;
  activeTab: string = 'purchases';
  documents: SupplierDocument[] = [];
  notes: SupplierNote[] = [];
  newNote: SupplierNote = {
    title: '',
    content: '',
    createdAt: new Date(),
    createdBy: '', 
    isPrivate: false
  };
  
  currentUserId: string = '';
  currentUserName: string = '';
  
  transactions: any[] = [];
  filteredTransactions: any[] = [];
  
  ledgerLoading = true;
  fromDate: string = this.getFormattedDate(new Date(new Date().setMonth(new Date().getMonth() - 1)));
  toDate: string = this.getFormattedDate(new Date());
  accountSummary = {
    openingBalance: 0,
    totalPurchase: 0,
    totalPaid: 0,
    balanceDue: 0
  };
  currentBalance = 0;

  stockReport: any[] = [];
  filteredStockReport: any[] = [];
  stockReportLoading = true;
  stockReportFromDate: string = '';
  stockReportToDate: string = '';
  selectedStockLocation: string = 'all';
  stockLocations: string[] = [];
purchase: Purchase | undefined;
  router: any;

  constructor(
    private route: ActivatedRoute,
    private purchaseService: PurchaseService,
    private supplierService: SupplierService,
    private paymentService: PaymentService,
    private authService: AuthService,
    private firestore: Firestore,
    private locationService: LocationService,
  ) { }

ngOnInit(): void {
  this.supplierId = this.route.snapshot.params['id'];
  this.currentUserId = this.authService.getCurrentUserId();
  this.currentUserName = this.authService.getCurrentUserName();
  this.newNote.createdBy = this.currentUserName || this.currentUserId;
  
  // Initialize dates with default range (last 30 days)
  const today = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(today.getDate() - 30);
  
  this.fromDate = this.formatDate(thirtyDaysAgo);
  this.toDate = this.formatDate(today);
  this.stockReportFromDate = this.fromDate;
  this.stockReportToDate = this.toDate;

  this.loadSupplierDetails();
  this.loadPurchases();
  this.loadLedgerData();
  this.loadPurchaseOrderStockData();
  this.loadDocumentsAndNotes();
  this.loadStockReport();
  this.loadLocations();
}

private formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

applyDateFilter(): void {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  switch (this.selectedDateFilter) {
    case 'today':
      this.fromDate = this.formatDate(today);
      this.toDate = this.formatDate(today);
      break;
    case 'yesterday':
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      this.fromDate = this.formatDate(yesterday);
      this.toDate = this.formatDate(yesterday);
      break;
    case 'thisWeek':
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Sunday
      this.fromDate = this.formatDate(weekStart);
      this.toDate = this.formatDate(today);
      break;
    case 'thisMonth':
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      this.fromDate = this.formatDate(monthStart);
      this.toDate = this.formatDate(today);
      break;
    case 'thisFinancialYear':
      const financialYear = this.getFinancialYear(today);
      this.fromDate = this.formatDate(financialYear.start);
      this.toDate = this.formatDate(financialYear.end);
      break;
    case 'previousYear':
      const prevYear = new Date(today.getFullYear() - 1, 0, 1);
      const prevYearEnd = new Date(today.getFullYear() - 1, 11, 31);
      this.fromDate = this.formatDate(prevYear);
      this.toDate = this.formatDate(prevYearEnd);
      break;
    case 'custom':
      // Custom dates are already set by the user
      break;
  }

  // Apply the same date range to stock report
  this.stockReportFromDate = this.fromDate;
  this.stockReportToDate = this.toDate;

  // Apply the filters to all tabs
  this.filterPurchases();
  this.filterLedger();
  this.filterStockReport();
}

// Update the stock report filter to use the same date range
filterStockReport(): void {
  if (!this.stockReport) return;

  this.filteredStockReport = this.stockReport.filter(item => {
    // Check if item has purchases in the date range
    const hasPurchaseInRange = item.purchases.some((p: any) => {
      const purchaseDate = new Date(p.date).toISOString().split('T')[0];
      return purchaseDate >= this.fromDate && purchaseDate <= this.toDate;
    });
    
    if (!hasPurchaseInRange) return false;
    
    // Location filter
    if (this.selectedLocation !== 'all') {
      const hasPurchaseInLocation = item.purchases.some((p: any) => 
        p.location === this.selectedLocation
      );
      if (!hasPurchaseInLocation) return false;
    }
    
    return true;
  });
}
  // Add this new method to load purchases
  loadPurchases(supplierId?: string, supplierDisplayName?: string): void {
    this.isLoadingPurchases = true;
    
    const targetSupplierId = supplierId || this.supplierId;
    const targetSupplierName = supplierDisplayName || this.getSupplierDisplayName(this.supplierDetails);
    
    // First try to load by supplier ID using the correct method name
    this.purchaseService.getPurchasesBySupplier(targetSupplierId).subscribe({
      next: (purchases: Purchase[]) => {
        if (purchases.length > 0) {
          this.processPurchases(purchases);
        } else {
          // Fallback to name matching if no purchases found by ID
          this.purchaseService.getPurchasesBySupplierName(targetSupplierName)
            .subscribe({
              next: (nameMatchedPurchases: Purchase[]) => {
                this.processPurchases(nameMatchedPurchases);
              },
              error: (err: any) => {
                this.handlePurchaseLoadError(err);
              }
            });
        }
      },
      error: (err: any) => {
        this.handlePurchaseLoadError(err);
      }
    });
  }
loadPayments(): void {
  this.paymentLoading = true;
  this.paymentService.getSupplierPayments(this.supplierId).subscribe({
    next: (payments) => {
      this.payments = payments;
      this.paymentLoading = false;
    },
    error: (error) => {
      console.error('Error loading payments:', error);
      this.paymentLoading = false;
    }
  });
}
  handlePurchaseLoadError(error: any): void {
    console.error('Error loading purchases:', error);
    this.isLoadingPurchases = false;
    this.purchases = [];
    this.filteredPurchases = [];
  }

  processPurchases(purchases: Purchase[]): void {
    this.purchases = purchases.map(purchase => {
      // Your existing purchase processing logic
      return {
        ...purchase,
        // Ensure supplier details are consistent
        supplierName: this.supplierDetails.businessName || 
                     `${this.supplierDetails.firstName} ${this.supplierDetails.lastName}`.trim(),
        supplierId: this.supplierId
      };
    });
    
    this.filteredPurchases = [...this.purchases];
    this.calculateTotalPages();
    this.isLoadingPurchases = false;
  }

  // Add this method to calculate total pages
  calculateTotalPages(): void {
    this.totalPages = Math.ceil(this.filteredPurchases.length / this.itemsPerPage);
    if (this.currentPage > this.totalPages && this.totalPages > 0) {
      this.currentPage = this.totalPages;
    }
  }

  ngOnDestroy(): void {
    if (this.purchasesUnsubscribe) {
      this.purchasesUnsubscribe();
    }
  }

  private getFormattedDate(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  loadLocations(): void {
    this.locationService.getLocations().subscribe({
      next: (locations) => {
        this.locations = locations;
        // Set default location to first one or 'all'
        if (this.locations.length > 0) {
          this.selectedLocation = this.locations[0].id;
        }
      },
      error: (error) => {
        console.error('Error loading locations:', error);
      }
    });
  }
  
onDateFilterChange(): void {
  if (this.selectedDateFilter !== 'custom') {
    this.showCustomDateRange = false;
    this.applyDateFilter();
  } else {
    this.showCustomDateRange = true;
    // Initialize custom dates with current range when selecting custom
    this.customFromDate = this.fromDate;
    this.customToDate = this.toDate;
  }
}
applyCustomDateRange(): void {
  if (!this.customFromDate || !this.customToDate) {
    alert('Please select both from and to dates');
    return;
  }

  const fromDate = new Date(this.customFromDate);
  const toDate = new Date(this.customToDate);

  if (fromDate > toDate) {
    alert('From date cannot be after To date');
    return;
  }

  this.fromDate = this.customFromDate;
  this.toDate = this.customToDate;
  
  // Apply the same date range to all tabs
  this.stockReportFromDate = this.fromDate;
  this.stockReportToDate = this.toDate;

  // Apply filters to all tabs
  this.filterPurchases();
  this.filterLedger();
  this.filterStockReport();
}




  filterLedger(): void {
    if (!this.transactions) return;

    let filtered = this.transactions.filter(t => {
      // Filter by date
      const tDate = new Date(t.date);
      const fromDate = new Date(this.fromDate);
      const toDate = new Date(this.toDate);
      toDate.setHours(23, 59, 59, 999);

      if (tDate < fromDate || tDate > toDate) {
        return false;
      }

      // Filter by location if not 'all'
      if (this.selectedLocation !== 'all') {
        return t.location === this.selectedLocation;
      }

      return true;
    });

    this.filteredTransactions = filtered;
  }

  getLocationName(locationId: string): string {
    const location = this.locations.find(l => l.id === locationId);
    return location ? location.name : 'All Locations';
  }

  filterPurchases(): void {
    if (!this.purchases || this.purchases.length === 0) {
      this.filteredPurchases = [];
      this.calculateTotalPages();
      return;
    }

    const fromDate = new Date(this.fromDate);
    const toDate = new Date(this.toDate);
    toDate.setHours(23, 59, 59, 999);

    this.filteredPurchases = this.purchases.filter(purchase => {
      // Skip if purchase date is invalid
      if (!purchase.purchaseDate) return false;
      
      const purchaseDate = new Date(purchase.purchaseDate);
      
      // Date filter
      if (purchaseDate < fromDate || purchaseDate > toDate) {
        return false;
      }

      // Location filter
      if (this.selectedLocation !== 'all') {
        return purchase.businessLocation === this.selectedLocation;
      }

      return true;
    });

    this.calculateTotalPages();
  }

  // Add this method to your SupplierPurchasesComponent class
  private convertTimestamp(timestamp: any): Date | null {
    if (!timestamp) return null;
    
    // Firestore Timestamp
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }
    
    // JavaScript Date or string
    if (timestamp instanceof Date || typeof timestamp === 'string') {
      return new Date(timestamp);
    }
    
    // Unix timestamp (seconds)
    if (typeof timestamp === 'number' && timestamp < 1000000000000) {
      return new Date(timestamp * 1000);
    }
    
    // Unix timestamp (milliseconds)
    if (typeof timestamp === 'number') {
      return new Date(timestamp);
    }
    
    return null;
  }

  getPaginatedPurchases(): Purchase[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredPurchases.slice(startIndex, startIndex + this.itemsPerPage);
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    for (let i = 1; i <= this.totalPages; i++) {
      pages.push(i);
    }
    return pages;
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
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



  private getFinancialYear(date: Date): { start: Date, end: Date } {
    const year = date.getMonth() >= this.financialYearStartMonth - 1 ? 
      date.getFullYear() : 
      date.getFullYear() - 1;
    
    const start = new Date(year, this.financialYearStartMonth - 1, 1);
    const end = new Date(year + 1, this.financialYearStartMonth - 1, 0);
    end.setHours(23, 59, 59, 999);
    
    return { start, end };
  }

  deletePurchase(purchaseId: string): void {
    if (confirm('Are you sure you want to delete this purchase?')) {
      this.purchaseService.deletePurchase(purchaseId)
        .catch(error => {
          console.error('Error deleting purchase:', error);
          alert('Error deleting purchase');
        });
    }
  }

  changeTab(tab: string): void {
    this.activeTab = tab;
  }

  initializeStockReportDates(): void {
    const today = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(today.getFullYear() - 1);
    
    this.stockReportFromDate = oneYearAgo.toISOString().split('T')[0];
    this.stockReportToDate = today.toISOString().split('T')[0];
  }
  
  loadPurchaseOrderStockData(): void {
    this.stockReportLoading = true;
    
    this.purchaseService.getPurchasesBySupplier(this.supplierId).subscribe((purchases: any[]) => {
      this.stockReport = purchases.flatMap((purchase: { products: any[]; purchaseDate: any; }) => {
        if (!purchase.products) return [];
        
        return purchase.products.map((product: any) => ({
          productId: product.productId,
          productName: product.productName,
          sku: product.sku || 'N/A',
          category: product.category || 'N/A',
          purchasedQty: product.quantity,
          unit: product.unit || 'pcs',
          purchasePrice: product.unitCost,
          totalAmount: product.quantity * product.unitCost,
          lastPurchaseDate: purchase.purchaseDate,
          currentStock: product.currentStock || 0
        }));
      });
  
      this.filteredStockReport = [...this.stockReport];
      this.stockReportLoading = false;
    });
  }
  
  loadSupplierDetails(): void {
    this.supplierService.getSupplierById(this.supplierId).subscribe(supplier => {
      this.supplierDetails = supplier;
      
      // Get the supplier's display name for matching
      const supplierDisplayName = this.getSupplierDisplayName(supplier);
      
      // Load purchases using both ID and name matching
      this.loadPurchases(this.supplierId, supplierDisplayName);
      
      if (this.supplierDetails) {
        this.accountSummary.openingBalance = this.supplierDetails.openingBalance || 0;
        this.currentBalance = this.supplierDetails.openingBalance || 0;
      }
    });
  }

  getSupplierDisplayName(supplier: any): string {
    if (!supplier) return '';
    
    if (supplier.isIndividual) {
      return `${supplier.firstName || ''} ${supplier.lastName || ''}`.trim();
    }
    return supplier.businessName || '';
  }

// In supplier-purchases.component.ts
loadLedgerData(): void {
  this.ledgerLoading = true;
  
  // Load purchases
  this.purchaseService.getPurchasesBySupplier(this.supplierId).subscribe((purchases: any[]) => {
    purchases.forEach((purchase: any) => {
      if (purchase.purchaseDate) {
        const purchaseDate = new Date(purchase.purchaseDate);
        const formattedDate = this.getFormattedDate(purchaseDate);
        
        this.transactions.push({
          date: formattedDate,
          reference: purchase.referenceNo || 'PUR-' + purchase.id?.substring(0, 5),
          type: 'Purchase',
          description: 'Purchase of goods',
          debit: purchase.grandTotal || 0,
          credit: 0,
          balance: this.currentBalance + (purchase.grandTotal || 0)
        });

        this.currentBalance += purchase.grandTotal || 0;
        this.accountSummary.totalPurchase += purchase.grandTotal || 0;
      }
    });

    // Load payments
    this.paymentService.getPaymentsBySupplier(this.supplierId).subscribe((payments: any[]) => {
      payments.forEach((payment: any) => {
        const paymentDate = new Date(payment.paymentDate);
        const formattedDate = this.getFormattedDate(paymentDate);
        
        this.transactions.push({
          date: formattedDate,
          reference: payment.reference || 'PAY-' + payment.id?.substring(0, 5),
          type: 'Payment',
          description: payment.paymentNote || 'Payment to supplier',
          debit: 0,
          credit: payment.amount,
          balance: this.currentBalance - payment.amount
        });

        this.currentBalance -= payment.amount;
        this.accountSummary.totalPaid += payment.amount;
      });

      // Sort transactions by date
      this.transactions.sort((a, b) => {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      });

      this.accountSummary.balanceDue = this.currentBalance;
      this.filteredTransactions = [...this.transactions];
      this.ledgerLoading = false;
    });
  });
}

  onDateRangeChange(): void {
    this.applyFilters();
  }

  onLocationChange(): void {
    this.applyFilters();
  }

  getDateFromTimestamp(value: any): Date {
    if (!value) return new Date(0);
    return value instanceof Date ? value : value.toDate(); 
  }

  applyFilters(): void {
    let filtered = this.transactions.filter(t => {
      const tDate = new Date(t.date);
      const fromDate = new Date(this.fromDate);
      const toDate = new Date(this.toDate);
      return tDate >= fromDate && tDate <= toDate;
    });

    if (this.selectedLocation !== 'All locations') {
      filtered = filtered.filter(t => t.location === this.selectedLocation);
    }

    this.filteredTransactions = filtered;
  }

  getLocations(): string[] {
    const locations = new Set<string>(['All locations']);
    this.transactions.forEach(t => {
      if (t.location && t.location !== 'N/A') {
        locations.add(t.location);
      }
    });
    return Array.from(locations);
  }

  loadStockReport(): void {
    this.stockReportLoading = true;
    this.purchaseService.getPurchasesBySupplier(this.supplierId).subscribe((purchases: any[]) => {
      const stockMap = new Map<string, any>();
      const locations = new Set<string>();
      
      purchases.forEach((purchase: { products: any[]; businessLocation: string; purchaseDate: any; }) => {
        if (purchase.products && purchase.products.length > 0) {
          if (purchase.businessLocation) {
            locations.add(purchase.businessLocation);
          }
          
          purchase.products.forEach((product: any) => {
            const key = product.productId || product.productName;
            if (!key) return;
            
            if (stockMap.has(key)) {
              const existing = stockMap.get(key);
              existing.totalQuantity += product.quantity || 0;
              existing.totalAmount += (product.quantity || 0) * (product.unitCost || 0);
              existing.purchases.push({
                date: purchase.purchaseDate,
                quantity: product.quantity,
                price: product.unitCost,
                location: purchase.businessLocation
              });
            } else {
              stockMap.set(key, {
                productId: product.productId,
                productName: product.productName,
                sku: product.sku || 'N/A',
                category: product.category || 'N/A',
                unit: product.unit || 'pcs',
                alertQuantity: product.alertQuantity,
                currentStock: product.currentStock || 0,
                totalQuantity: product.quantity || 0,
                totalAmount: (product.quantity || 0) * (product.unitCost || 0),
                avgPurchasePrice: product.unitCost || 0,
                lastPurchaseDate: purchase.purchaseDate,
                purchases: [{
                  date: purchase.purchaseDate,
                  quantity: product.quantity,
                  price: product.unitCost,
                  location: purchase.businessLocation
                }]
              });
            }
          });
        }
      });
      
      this.stockReport = Array.from(stockMap.values()).map(item => {
        item.avgPurchasePrice = item.totalAmount / item.totalQuantity;
        item.lastPurchaseDate = item.purchases.reduce((latest: string, purchase: any) => {
          return (!latest || purchase.date > latest) ? purchase.date : latest;
        }, '');
        return item;
      }).sort((a, b) => a.productName.localeCompare(b.productName));
      
      this.stockLocations = Array.from(locations);
      this.filterStockReport();
      this.stockReportLoading = false;
    });
  }

 

  getTotalPurchasedQty(): number {
    return this.filteredStockReport.reduce((sum, item) => sum + (item.totalQuantity || 0), 0);
  }

  getTotalAmount(): number {
    return this.filteredStockReport.reduce((sum, item) => sum + (item.totalAmount || 0), 0);
  }

  exportStockReportToExcel(): void {
    const data = this.filteredStockReport.map(item => ({
      'Product Name': item.productName,
      'SKU': item.sku,
      'Category': item.category,
      'Purchased Qty': item.totalQuantity,
      'Unit': item.unit,
      'Purchase Price': item.avgPurchasePrice,
      'Total Amount': item.totalAmount,
      'Last Purchase Date': item.lastPurchaseDate,
      'Current Stock': item.currentStock
    }));
  
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock Report');
    XLSX.writeFile(workbook, `Stock_Purchased_${this.supplierDetails.businessName}.xlsx`);
  }

  exportStockReportToPDF(): void {
    const doc = new jsPDF();
    const title = `Stock Purchased from ${this.supplierDetails.businessName || 'Supplier'}`;
    const dateRange = `From ${this.stockReportFromDate} to ${this.stockReportToDate}`;
    
    doc.setFontSize(16);
    doc.text(title, 14, 15);
    doc.setFontSize(10);
    doc.text(dateRange, 14, 22);
    
    const tableData = this.filteredStockReport.map(item => [
      item.productName,
      item.sku || 'N/A',
      item.category || 'N/A',
      item.totalQuantity.toString(),
      item.unit || 'pcs',
      '₹' + item.avgPurchasePrice.toFixed(2),
      '₹' + item.totalAmount.toFixed(2),
      new Date(item.lastPurchaseDate).toLocaleDateString(),
      item.currentStock.toString()
    ]);
    
    autoTable(doc, {
      head: [['Product', 'SKU', 'Category', 'Qty', 'Unit', 'Price', 'Amount', 'Last Purchase', 'Current Stock']],
      body: tableData,
      startY: 30,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255 }
    });
    
    autoTable(doc, {
      body: [
        ['Total Products:', this.filteredStockReport.length.toString()],
        ['Total Purchased Quantity:', this.getTotalPurchasedQty().toString()],
        ['Total Amount:', '₹' + this.getTotalAmount().toFixed(2)]
      ],
      startY: (doc as any).lastAutoTable.finalY + 10,
      styles: { fontSize: 10, cellPadding: 5 },
      columnStyles: { 0: { fontStyle: 'bold' } }
    });
    
    doc.save(`Supplier_Stock_Report_${this.supplierDetails.businessName || this.supplierId}.pdf`);
  }

  loadDocumentsAndNotes(): void {
    this.supplierService.getSupplierById(this.supplierId).subscribe(supplier => {
      this.documents = supplier?.documents || [];
      this.notes = supplier?.notes || [];
    });
  }
  
  addNote(): void {
    if (!this.newNote.title || !this.newNote.content) {
      alert('Please fill all required fields');
      return;
    }
  
    this.newNote.createdAt = new Date();
    this.newNote.createdBy = this.currentUserName || this.currentUserId;
    
    this.supplierService.addSupplierNote(this.supplierId, this.newNote).then(() => {
      this.loadDocumentsAndNotes();
      this.newNote = {
        title: '',
        content: '',
        createdAt: new Date(),
        createdBy: this.currentUserName || this.currentUserId,
        isPrivate: false
      };
    }).catch(error => {
      console.error('Error adding note:', error);
      alert('Error adding note');
    });
  }
  
  deleteNote(noteId: string): void {
    if (confirm('Are you sure you want to delete this note?')) {
      this.supplierService.deleteSupplierNote(this.supplierId, noteId)
        .then(() => {
          this.notes = this.notes.filter(note => note.id !== noteId);
        })
        .catch(error => {
          console.error('Error deleting note:', error);
          alert('Error deleting note');
        });
    }
  }

  onFileSelected(event: any): void {
    this.selectedFiles = Array.from(event.target.files);
  }
  
  uploadDocuments(): void {
    if (this.selectedFiles.length === 0) {
      alert('Please select files to upload');
      return;
    }
  
    this.isUploading = true;
    this.uploadProgress = 0;
  
    const uploadPromises = this.selectedFiles.map((file: File) => {
      return this.uploadFile(file).then(downloadURL => {
        const document: SupplierDocument = {
          name: file.name,
          url: downloadURL,
          uploadedAt: new Date(),
          uploadedBy: this.currentUserName || this.currentUserId,
          isPrivate: false
        };
        return this.supplierService.addSupplierDocument(this.supplierId, document);
      });
    });
  
    Promise.all(uploadPromises)
      .then(() => {
        this.loadDocumentsAndNotes();
        this.selectedFiles = [];
        this.uploadProgress = null;
        this.isUploading = false;
      })
      .catch(error => {
        console.error('Error uploading documents:', error);
        this.isUploading = false;
        this.uploadProgress = null;
        alert('Error uploading documents');
      });
  }
viewPayments(purchase?: Purchase): void {
  if (!purchase) return;
  this.router.navigate(['/payment-history'], {
    queryParams: { 
      purchaseId: purchase.id,
      purchaseRef: purchase.referenceNo,
      supplierId: this.supplierId,
      supplierName: this.supplierDetails.businessName || 
                   `${this.supplierDetails.firstName} ${this.supplierDetails.lastName || ''}`.trim()
    }
  });
}
viewPaymentDetails(paymentId: string) {
  // Your implementation here
}
addPayment(purchase?: Purchase): void {
  if (!purchase) return;
  this.router.navigate(['/suppliers', this.supplierId, 'payments'], {
    queryParams: { 
      purchaseId: purchase.id,
      purchaseRef: purchase.referenceNo
    }
  });
}
  private uploadFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        resolve(`https://example.com/uploads/${file.name}`);
      }, 2000);
    });
  }
  
  deleteDocument(documentId: string): void {
    if (confirm('Are you sure you want to delete this document?')) {
      this.supplierService.deleteSupplierDocument(this.supplierId, documentId)
        .then(() => {
          this.documents = this.documents.filter(doc => doc.id !== documentId);
        })
        .catch(error => {
          console.error('Error deleting document:', error);
          alert('Error deleting document');
        });
    }
  }
}