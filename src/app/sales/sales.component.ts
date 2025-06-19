import { Component, OnInit, OnDestroy } from '@angular/core';
import { SaleService } from '../services/sale.service';
import { Subscription } from 'rxjs';
import * as bootstrap from 'bootstrap';
import { StockService } from '../services/stock.service';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { AccountService } from '../services/account.service';
import 'jspdf-autotable';
import { Router } from '@angular/router';
import { ProductsService } from '../services/products.service';
import { Expense, ExpenseService } from '../services/expense.service';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../auth.service';


// Add this interface at the top of your sales.component.ts file
interface InvoiceData {
shippingTax: any;
totalTaxableValue: string|number;
  invoiceNo: string;
  date: string;
  from: {
    companyName: string;
    address: string;
    mobile: string;
    gst: string;
  };
  to: {
    name: string;
    address: string;
    mobile: string;
  };
  products: Array<{
discountPercent: string|number;
    discount: any;
    taxableValue: any;
    taxType: string;
    cgstAmount: any;
    cgstRate: any;
    sgstAmount: any;
    sgstRate: any;
    igstAmount: any;
    igstRate: any;
    name: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }>;
  shippingCharge: number;
  taxes: Array<{
    name: string;
    amount: number;
  }>;
  total: number;
}

interface SaleItem {
  customer?: string;
  saleDate?: string | Date;
  invoiceNo?: string;
  status?: string;
  currentShipment: any; // Or use a more specific interface/type
  shippingDetails?: string; // Add this line

  shippingStatus?: string;
  totalPayable?: number;


  
  paymentAmount?: number;
    balanceAmount: number;

  balance?: number;
  products?: Product[];
  commissionPercentage?: number;
}
interface Product {
  id?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  priceBeforeTax: number;
  taxRate: number;
  taxType: 'GST' | 'IGST'; // Add this to distinguish between GST and IGST
  cgstRate?: number;
  sgstRate?: number;
  igstRate?: number;
  discount: number;
  taxableValue: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  subtotal: number;
}

interface RowData {
  'S.No': number;
  'Customer': string;
  'Sale Date': string;
  'Invoice No': string;
  'Products': string;
  'Status': string;
  'Commission %': number;
  'Shipping Status': string;
  'Payment Amount': string;
  'Balance': string;
}

interface Column {
  field: string;
  header: string;
  visible: boolean;
}

@Component({
  selector: 'app-sales',
  templateUrl: './sales.component.html',
  styleUrls: ['./sales.component.scss']
})
export class SalesComponent implements OnInit, OnDestroy {
  sales: any[] = [];
  totalCreditBalance: number = 0;
  filteredSales: any[] = [];
    userAllowedLocations: string[] = [];

  selectedSale: any = null;
  private salesSubscription: Subscription | undefined;
  totalEntries: number = 0;
  shipment: any; // Or use a more specific type
  productFilterName: string = '';
  private printModal: any;


filters: any = {};
loading: boolean = false;
error: string | null = null;
subscriptions: Subscription[] = [];totalShippingCharge: number = 0;
totalCommission: number = 0;
  totalDueAmount: number = 0;
  quickDateFilter: string = '';

  // Add this property
  invoiceData: InvoiceData = {
    invoiceNo: '',
    date: '',
    from: {
      companyName: 'HERBALY TOUCH AYURVEDA PRODUCTS PRIVATE LIMITED',
      address: '',
      mobile: '',
      gst: ''
    },
    to: {
      name: '',
      address: '',
      mobile: ''
    },
    products: [],
    shippingCharge: 0,
    taxes: [],
    total: 0,
    shippingTax: undefined,
    totalTaxableValue: ''
  };

  currentPage: number = 1;
  entriesPerPage: number = 25;
  searchTerm: string = '';
  private modal: any;
  startDate: string = '';
  Math = Math;
  endDate: string = '';
  
  private invoiceModal: any; // New property for invoice modal
  showColumnMenu: boolean = false;
  expandedSaleId: string | null = null;
  showFilterSidebar: boolean = false;
statusFilter: string = '';
paymentMethodFilter: string = '';
shippingStatusFilter: string = '';
minCommission: number | null = null;
maxCommission: number | null = null;
  
  totalPaymentAmount: number = 0;
  totalBalance: number = 0;
  
  // Add sorting variables
  sortField: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  
  // Add missing properties
  addedByFilter: string = '';
  locationFilter: string = '';
  products: Product[] = []; // Add this property that was missing
  
  columns: Column[] = [
    { field: 'customer', header: 'Customer', visible: true },
    { field: 'saleDate', header: 'Sale Date', visible: true },
    
    { field: 'invoiceNo', header: 'Invoice No', visible: true },
    { field: 'products', header: 'Products', visible: true },
    { field: 'status', header: 'Status', visible: true },
    { field: 'commissionPercentage', header: 'Commission %', visible: true },
    { field: 'shippingStatus', header: 'Shipping Status', visible: true },
    { field: 'paymentAmount', header: 'Payment Amount', visible: true },
    { field: 'balance', header: 'Balance', visible: true },
    { field: 'typeOfService', header: 'Type of Service', visible: true }, 
    { field: 'customerPhone', header: 'Contact', visible: true }, // Add this
    { field: 'billingAddress', header: 'Billing Address', visible: true }, // Add this line
    { field: 'shippingDetails', header: 'Shipping Details', visible: true },
       { field: 'paymentDue', header: 'Payment Due', visible: true },
    { field: 'balanceAmount', header: 'Balance Amount', visible: true },
  



    // Add this line

  ];

  constructor(private saleService: SaleService,
    private stockService:StockService,
    private productService: ProductsService, // Add this line
    private accountService: AccountService,
    private authService:AuthService,
        private expenseService: ExpenseService,


  private route: ActivatedRoute,  // Add this

    
    
    
    private router: Router) {}

  ngOnInit(): void {
 this.userAllowedLocations = this.authService.getUserAllowedLocations();
      this.loadSales();

  this.modal = new bootstrap.Modal(document.getElementById('saleDetailsModal')!);
  this.invoiceModal = new bootstrap.Modal(document.getElementById('invoiceModal')!);
  this.printModal = new bootstrap.Modal(document.getElementById('printInvoiceModal')!);
  
  this.route.queryParams.subscribe(params => {
    if (params['productId']) {
      this.filters.productId = params['productId'];
      this.productFilterName = params['productName'] || '';
    }
    this.loadSales();
  });
    this.salesSubscription = this.saleService.listenForSales().subscribe((salesData) => {
      this.sales = salesData.filter(sale => sale.status === 'Completed');
      
      this.sales = this.sales.map(sale => ({
        ...sale,
        products: sale.products || []
      }));
      this.filteredSales = [...this.sales];
      this.totalEntries = this.filteredSales.length;
      this.calculateTotals();
    });
    
  }
  

/* Removed duplicate getTotalCGSTForPrint() */



calculateCreditBalances(): void {
  this.totalCreditBalance = this.filteredSales.reduce((sum, sale) => {
    if (sale.paymentStatus === 'Due' || sale.paymentStatus === 'Partial') {
      return sum + (sale.balance || 0);
    }
    return sum;
  }, 0);
}printInvoiceNow(): void {
  const printContent = document.getElementById('printInvoiceContent')?.cloneNode(true) as HTMLElement;
  
  // Remove any buttons or elements that shouldn't be printed
  const buttons = printContent.querySelectorAll('button');
  buttons.forEach(button => button.remove());

  // Create a new window for printing
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Popup blocker might be preventing the print window from opening. Please allow popups for this site.');
    return;
  }

  // Write the HTML content to the new window
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Invoice #${this.selectedSale?.invoiceNo}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; color: #000; }
          .invoice-header { text-align: center; margin-bottom: 20px; }
          .invoice-title { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
          .invoice-details { margin-bottom: 30px; }
          .from-to-section { display: flex; justify-content: space-between; margin-bottom: 30px; }
          .from-section, .to-section { width: 48%; }
          .section-title { font-weight: bold; margin-bottom: 10px; border-bottom: 1px solid #000; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          .text-end { text-align: right; }
          .text-center { text-align: center; }
          .totals-section { text-align: right; margin-top: 20px; }
          .footer { margin-top: 50px; text-align: center; font-style: italic; }
          @media print {
            body { margin: 0; padding: 10px; }
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        ${printContent?.innerHTML || 'No content to print'}
        <script>
          // Automatically trigger print and close after printing
          setTimeout(() => {
            window.print();
            window.close();
          }, 300);
        </script>
      </body>
    </html>
  `);

  printWindow.document.close();
  this.printModal.hide();
}
  // Add this method to your SalesComponent class
  resetFilters(): void {
    this.startDate = '';
    this.endDate = '';
    this.searchTerm = '';
    this.applyFilters();
  }
getTotalTaxableValue(): number {
  return this.invoiceData.products.reduce((sum: number, product: any) => 
    sum + product.taxableValue, 0) || 0;
}

getTotalCGST(): number {
  return this.invoiceData.products.reduce((sum: number, product: any) => 
    sum + (product.cgstAmount || 0), 0) || 0;
}

getTotalSGST(): number {
  return this.invoiceData.products.reduce((sum: number, product: any) => 
    sum + (product.sgstAmount || 0), 0) || 0;
}
getStatusCounts(): {status: string, count: number}[] {
  const statusMap = new Map<string, number>();
  
  this.filteredSales.forEach(sale => {
    statusMap.set(sale.status, (statusMap.get(sale.status) || 0) + 1);
  });
  
  return Array.from(statusMap.entries()).map(([status, count]) => ({ status, count }));
}

applyFiltersAndSort(): void {
  this.applyFilters();
    this.calculateCreditBalances();

  if (this.sortField) {
    this.sortData();
    
  }
}

calculateStatistics(): void {
  // Implement your statistics calculation logic here
}
getTotalIGST(): number {
  return this.invoiceData.products.reduce((sum: number, product: any) => 
    sum + (product.igstAmount || 0), 0) || 0;
}
loadSales(): void {
  this.loading = true;
  this.error = null;

  const subscription = this.saleService.listenForSales().subscribe({
    next: (sales) => {
      // Automatically filter by user's locations
      if (this.userAllowedLocations.length > 0) {
        this.filteredSales = sales.filter(sale => 
          this.userAllowedLocations.includes(sale.location) || 
          this.userAllowedLocations.includes(sale.businessLocation)
        );
      } else {
        // If no locations restricted, show all sales
        this.filteredSales = [...sales];
      }
         if (this.userAllowedLocations.length > 0) {
      this.filters.locations = this.userAllowedLocations;
    }
    
    const subscription = this.saleService.listenForSales(this.filters).subscribe({
      next: (sales) => {
        // Apply product filter if exists
        if (this.filters.productId) {
          sales = sales.filter(sale => 
            sale.products?.some((product: any) => product.id === this.filters.productId)
          );
        }
        
        // Additional location filter (client-side as backup)
        if (this.userAllowedLocations.length > 0) {
          sales = sales.filter(sale => 
            this.userAllowedLocations.includes(sale.businessLocation)
          );
        }
        
        this.sales = sales;
        this.applyFiltersAndSort();
        this.calculateStatistics();
        this.calculateTotals();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading sales:', error);
        this.error = 'Failed to load sales data';
        this.loading = false;
      }
    });
    
    this.subscriptions.push(subscription);
  
  
      this.totalEntries = this.filteredSales.length;
      this.calculateTotals();
      this.loading = false;
    },
    
    error: (error) => {
      console.error('Error loading sales:', error);
      this.error = 'Failed to load sales data';
      this.loading = false;
    }
  });
  
  this.subscriptions.push(subscription);
}
// In sales.component.ts
viewProductSales(productId: string, productName: string): void {
  this.router.navigate(['/product-purchase-details', productId], {
    state: { productName: productName }
  });
}  
clearProductFilter(): void {
  this.filters.productId = '';
  this.productFilterName = '';
  this.applyFiltersAndSort();
}
toggleFilterSidebar(): void {
  this.showFilterSidebar = !this.showFilterSidebar;
}
 resetSidebarFilters(): void {
  this.statusFilter = '';
  this.paymentMethodFilter = '';
  this.shippingStatusFilter = '';
  this.minCommission = null;
  this.maxCommission = null;
  this.startDate = '';
  this.endDate = '';
  this.addedByFilter = '';
  this.locationFilter = '';
  this.quickDateFilter = ''; // Add this line
  this.applyFilters();
}
  ngOnDestroy(): void {
    if (this.salesSubscription) {
      this.salesSubscription.unsubscribe();
    }
  }
  // In sales.component.ts


private calculatePaymentStatus(sale: any): string {
  if (sale.paymentAmount >= sale.total) return 'Paid';
  if (sale.paymentAmount > 0) return 'Partial';
  return 'Due';
}
 // Update your calculateTotals method to include the new totals
calculateTotals(): void {
  const currentPageData = this.filteredSales.slice(
    (this.currentPage - 1) * this.entriesPerPage,
    this.currentPage * this.entriesPerPage
  );
  
  this.totalPaymentAmount = currentPageData.reduce((sum, sale) => 
    sum + (sale.paymentAmount ? Number(sale.paymentAmount) : 0), 0);
  
  this.totalBalance = currentPageData.reduce((sum, sale) => 
    sum + (sale.balance ? Number(sale.balance) : 0), 0);
    
  this.totalShippingCharge = currentPageData.reduce((sum, sale) => 
    sum + (sale.shippingCharge ? Number(sale.shippingCharge) : 0), 0);
    
  this.totalCommission = currentPageData.reduce((sum, sale) => 
    sum + (sale.commissionPercentage ? Number(sale.commissionPercentage) : 0), 0);
    
  this.totalDueAmount = currentPageData.reduce((sum, sale) => {
    const status = this.calculatePaymentStatus(sale);
    if (status === 'Due' || status === 'Partial') {
      return sum + (sale.balance ? Number(sale.balance) : 0);
    }
    return sum;
  }, 0);
}
  applyQuickDateFilter(): void {
  if (!this.quickDateFilter) {
    // If custom date range is selected, clear the dates
    this.startDate = '';
    this.endDate = '';
  } else {
    const dateRange = this.getDateRangeForFilter(this.quickDateFilter);
    this.startDate = dateRange.startDate;
    this.endDate = dateRange.endDate;
  }
  this.applyFilters();
  }
  getDateRangeForFilter(filter: string): { startDate: string, endDate: string } {
  const today = new Date();
  const currentYear = today.getFullYear();
  let startDate: Date;
  let endDate: Date;

  switch (filter) {
    case 'today':
      startDate = new Date(today);
      endDate = new Date(today);
      break;

    case 'yesterday':
      startDate = new Date(today);
      startDate.setDate(today.getDate() - 1);
      endDate = new Date(startDate);
      break;

    case 'tomorrow':
      startDate = new Date(today);
      startDate.setDate(today.getDate() + 1);
      endDate = new Date(startDate);
      break;

    case 'thisWeek':
      const thisWeekStart = new Date(today);
      thisWeekStart.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
      const thisWeekEnd = new Date(thisWeekStart);
      thisWeekEnd.setDate(thisWeekStart.getDate() + 6); // End of week (Saturday)
      startDate = thisWeekStart;
      endDate = thisWeekEnd;
      break;

    case 'lastWeek':
      const lastWeekStart = new Date(today);
      lastWeekStart.setDate(today.getDate() - today.getDay() - 7);
      const lastWeekEnd = new Date(lastWeekStart);
      lastWeekEnd.setDate(lastWeekStart.getDate() + 6);
      startDate = lastWeekStart;
      endDate = lastWeekEnd;
      break;

    case 'nextWeek':
      const nextWeekStart = new Date(today);
      nextWeekStart.setDate(today.getDate() - today.getDay() + 7);
      const nextWeekEnd = new Date(nextWeekStart);
      nextWeekEnd.setDate(nextWeekStart.getDate() + 6);
      startDate = nextWeekStart;
      endDate = nextWeekEnd;
      break;

    case 'thisMonth':
      startDate = new Date(currentYear, today.getMonth(), 1);
      endDate = new Date(currentYear, today.getMonth() + 1, 0);
      break;

    case 'lastMonth':
      startDate = new Date(currentYear, today.getMonth() - 1, 1);
      endDate = new Date(currentYear, today.getMonth(), 0);
      break;

    case 'thisQuarter':
      const thisQuarterMonth = Math.floor(today.getMonth() / 3) * 3;
      startDate = new Date(currentYear, thisQuarterMonth, 1);
      endDate = new Date(currentYear, thisQuarterMonth + 3, 0);
      break;

    case 'lastQuarter':
      const lastQuarterMonth = Math.floor(today.getMonth() / 3) * 3 - 3;
      if (lastQuarterMonth < 0) {
        startDate = new Date(currentYear - 1, 9, 1); // Oct 1 of previous year
        endDate = new Date(currentYear - 1, 12, 0); // Dec 31 of previous year
      } else {
        startDate = new Date(currentYear, lastQuarterMonth, 1);
        endDate = new Date(currentYear, lastQuarterMonth + 3, 0);
      }
      break;

    case 'thisYear':
      startDate = new Date(currentYear, 0, 1); // Jan 1
      endDate = new Date(currentYear, 11, 31); // Dec 31
      break;

    case 'lastYear':
      startDate = new Date(currentYear - 1, 0, 1);
      endDate = new Date(currentYear - 1, 11, 31);
      break;

    case 'thisFinancialYear':
      // Indian Financial Year: April 1 to March 31
      if (today.getMonth() >= 3) { // April to March (current FY)
        startDate = new Date(currentYear, 3, 1); // April 1 current year
        endDate = new Date(currentYear + 1, 2, 31); // March 31 next year
      } else { // January to March (previous FY)
        startDate = new Date(currentYear - 1, 3, 1); // April 1 previous year
        endDate = new Date(currentYear, 2, 31); // March 31 current year
      }
      break;

    case 'lastFinancialYear':
      // Previous Financial Year
      if (today.getMonth() >= 3) {
        startDate = new Date(currentYear - 1, 3, 1); // April 1 previous year
        endDate = new Date(currentYear, 2, 31); // March 31 current year
      } else {
        startDate = new Date(currentYear - 2, 3, 1); // April 1 two years ago
        endDate = new Date(currentYear - 1, 2, 31); // March 31 previous year
      }
      break;

    case 'last7Days':
      startDate = new Date(today);
      startDate.setDate(today.getDate() - 6);
      endDate = new Date(today);
      break;

    case 'last30Days':
      startDate = new Date(today);
      startDate.setDate(today.getDate() - 29);
      endDate = new Date(today);
      break;

    case 'last90Days':
      startDate = new Date(today);
      startDate.setDate(today.getDate() - 89);
      endDate = new Date(today);
      break;

    default:
      startDate = new Date();
      endDate = new Date();
  }

  return {
    startDate: this.formatDateForInput(startDate),
    endDate: this.formatDateForInput(endDate)
  };
  }
  
getDateRangeDisplay(): string {
  if (!this.quickDateFilter) return '';

  const today = new Date();
  const formatOptions: Intl.DateTimeFormatOptions = { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  };

  switch (this.quickDateFilter) {
    case 'today':
      return `Today: ${today.toLocaleDateString('en-US', formatOptions)}`;
    
    case 'yesterday':
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      return `Yesterday: ${yesterday.toLocaleDateString('en-US', formatOptions)}`;
    
    case 'tomorrow':
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      return `Tomorrow: ${tomorrow.toLocaleDateString('en-US', formatOptions)}`;
    
    case 'thisWeek':
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      return `This Week: ${weekStart.toLocaleDateString('en-US', formatOptions)} - ${weekEnd.toLocaleDateString('en-US', formatOptions)}`;
    
    case 'lastWeek':
      const lastWeekStart = new Date(today);
      lastWeekStart.setDate(today.getDate() - today.getDay() - 7);
      const lastWeekEnd = new Date(lastWeekStart);
      lastWeekEnd.setDate(lastWeekStart.getDate() + 6);
      return `Last Week: ${lastWeekStart.toLocaleDateString('en-US', formatOptions)} - ${lastWeekEnd.toLocaleDateString('en-US', formatOptions)}`;
    
    case 'nextWeek':
      const nextWeekStart = new Date(today);
      nextWeekStart.setDate(today.getDate() - today.getDay() + 7);
      const nextWeekEnd = new Date(nextWeekStart);
      nextWeekEnd.setDate(nextWeekStart.getDate() + 6);
      return `Next Week: ${nextWeekStart.toLocaleDateString('en-US', formatOptions)} - ${nextWeekEnd.toLocaleDateString('en-US', formatOptions)}`;
    
    case 'thisMonth':
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return `This Month: ${monthStart.toLocaleDateString('en-US', formatOptions)} - ${monthEnd.toLocaleDateString('en-US', formatOptions)}`;
    
    case 'lastMonth':
      const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
      return `Last Month: ${lastMonthStart.toLocaleDateString('en-US', formatOptions)} - ${lastMonthEnd.toLocaleDateString('en-US', formatOptions)}`;
    
    case 'thisFinancialYear':
      const fyStart = today.getMonth() >= 3 ? 
        new Date(today.getFullYear(), 3, 1) : 
        new Date(today.getFullYear() - 1, 3, 1);
      const fyEnd = today.getMonth() >= 3 ? 
        new Date(today.getFullYear() + 1, 2, 31) : 
        new Date(today.getFullYear(), 2, 31);
      return `This FY: ${fyStart.toLocaleDateString('en-US', formatOptions)} - ${fyEnd.toLocaleDateString('en-US', formatOptions)}`;
    
    case 'lastFinancialYear':
      const lastFyStart = today.getMonth() >= 3 ? 
        new Date(today.getFullYear() - 1, 3, 1) : 
        new Date(today.getFullYear() - 2, 3, 1);
      const lastFyEnd = today.getMonth() >= 3 ? 
        new Date(today.getFullYear(), 2, 31) : 
        new Date(today.getFullYear() - 1, 2, 31);
      return `Last FY: ${lastFyStart.toLocaleDateString('en-US', formatOptions)} - ${lastFyEnd.toLocaleDateString('en-US', formatOptions)}`;
    
    case 'last7Days':
      const week7Start = new Date(today);
      week7Start.setDate(today.getDate() - 6);
      return `Last 7 Days: ${week7Start.toLocaleDateString('en-US', formatOptions)} - ${today.toLocaleDateString('en-US', formatOptions)}`;
    
    case 'last30Days':
      const days30Start = new Date(today);
      days30Start.setDate(today.getDate() - 29);
      return `Last 30 Days: ${days30Start.toLocaleDateString('en-US', formatOptions)} - ${today.toLocaleDateString('en-US', formatOptions)}`;
    
    case 'last90Days':
      const days90Start = new Date(today);
      days90Start.setDate(today.getDate() - 89);
      return `Last 90 Days: ${days90Start.toLocaleDateString('en-US', formatOptions)} - ${today.toLocaleDateString('en-US', formatOptions)}`;
    
    default:
      return '';
  }
}

private formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

  get visibleColumns(): Column[] {
    return this.columns.filter(column => column.visible);
  }
  getPaymentStatusCount(status: string): number {
  const currentPageData = this.filteredSales.slice(
    (this.currentPage - 1) * this.entriesPerPage,
    this.currentPage * this.entriesPerPage
  );
  
  return currentPageData.filter(sale => {
    const paymentStatus = this.calculatePaymentStatus(sale);
    return paymentStatus === status;
  }).length;
}

getPaymentMethodSummary(): {method: string, count: number}[] {
  const currentPageData = this.filteredSales.slice(
    (this.currentPage - 1) * this.entriesPerPage,
    this.currentPage * this.entriesPerPage
  );
  
  const methodMap = new Map<string, number>();
  
  currentPageData.forEach(sale => {
    const method = sale.paymentMethod || 'Unknown';
    methodMap.set(method, (methodMap.get(method) || 0) + 1);
  });
  
  return Array.from(methodMap.entries()).map(([method, count]) => ({ method, count }));
}getServiceTypeSummary(): {type: string, count: number}[] {
  const currentPageData = this.filteredSales.slice(
    (this.currentPage - 1) * this.entriesPerPage,
    this.currentPage * this.entriesPerPage
  );
  
  const typeMap = new Map<string, number>();
  
  currentPageData.forEach(sale => {
    const type = sale.typeOfService || 'Unknown';
    typeMap.set(type, (typeMap.get(type) || 0) + 1);
  });
  
  return Array.from(typeMap.entries()).map(([type, count]) => ({ type, count }));
}

  toggleColumnVisibility(): void {
    this.showColumnMenu = !this.showColumnMenu;
  }
  
  // Fixed updateProduct method - now uses this.products array
  updateProduct(index: number): void {
    const product = this.products[index];
    
    // Calculate taxable value (after discount)
    const taxableValue = (product.quantity * product.unitPrice) - product.discount;
    product.taxableValue = taxableValue;
    
    // Determine tax type based on business rules (same state = GST, different state = IGST)
    const isSameState = true; // You need to implement your logic to check if customer is in same state
    product.taxType = isSameState ? 'GST' : 'IGST';
    
    if (product.taxType === 'GST') {
      // Split the tax rate into CGST and SGST
      product.cgstRate = product.taxRate / 2;
      product.sgstRate = product.taxRate / 2;
      product.igstRate = 0;
      
      product.cgstAmount = taxableValue * (product.cgstRate / 100);
      product.sgstAmount = taxableValue * (product.sgstRate / 100);
      product.igstAmount = 0;
    } else {
      // IGST case
      product.igstRate = product.taxRate;
      product.cgstRate = 0;
      product.sgstRate = 0;
      
      product.igstAmount = taxableValue * (product.igstRate / 100);
      product.cgstAmount = 0;
      product.sgstAmount = 0;
    }
    
    // Calculate subtotal
    product.subtotal = taxableValue + (product.cgstAmount || 0) + (product.sgstAmount || 0) + (product.igstAmount || 0);
    
    this.calculateItemsTotal();
    this.calculateTotalPayable();
  }

  // Add missing methods
  calculateItemsTotal(): void {
    // Calculate total of all items
    const itemsTotal = this.products.reduce((sum, product) => sum + product.subtotal, 0);
    // You can store this in a component property if needed
  }

  calculateTotalPayable(): void {
    // Calculate total payable amount including items total, shipping, taxes etc.
    const itemsTotal = this.products.reduce((sum, product) => sum + product.subtotal, 0);
    // Add shipping charges, additional taxes etc. based on your business logic
    // You can store this in a component property if needed
  }

  updateColumnVisibility(): void {
    console.log('Column visibility updated', this.columns);
  }

  viewSale(sale: any): void {
    this.selectedSale = sale;
    this.modal.show();
  }

generateInvoice(sale: any): void {
  this.selectedSale = sale;
  
  // Simple calculation - Grand Total = Amount Paid + Balance Due
  const amountPaid = sale.paymentAmount || 0;
  const balanceDue = sale.balance || 0;
  const grandTotal = amountPaid + balanceDue;

  // Calculate product subtotals (without tax breakdown)
  const processedProducts = (sale.products || []).map((product: any) => {
    const unitPrice = product.unitPrice || product.price || 0;
    const quantity = product.quantity || 1;
    const subtotal = unitPrice * quantity;
    
    return {
      ...product,
      unitPrice,
      quantity,
      subtotal
    };
  });

  // Calculate product subtotal sum
  const productsSubtotal = processedProducts.reduce((sum: number, p: any) => sum + p.subtotal, 0);

  this.invoiceData = {
    invoiceNo: sale.invoiceNo || 'N/A',
    date: sale.saleDate ? new Date(sale.saleDate).toLocaleDateString() : 'N/A',
    from: {
      companyName: 'HERBALY TOUCH AYURVEDA PRODUCTS PRIVATE LIMITED',
      address: '1st Floor, Chirackal Tower, Ayroor P.O, Emakulam, Kerala, 683579, India',
      mobile: '00917034110999',
      gst: '32AAGCH3136H12X'
    },
    to: {
      name: sale.customer || 'N/A',
      address: sale.billingAddress || sale.shippingAddress || 'N/A',
      mobile: sale.customerPhone || 'N/A'
    },
    products: processedProducts,
    shippingCharge: sale.shippingCharges || 0,
    shippingTax: sale.shippingTaxAmount || ((sale.shippingCharges || 0) * (sale.orderTax || 0) / 100),
    totalTaxableValue: productsSubtotal + (sale.shippingCharges || 0),
    taxes: this.calculateTaxes(sale),
    total: grandTotal
  };

  this.invoiceModal.show();
}

getTotalTaxableValueForPrint(): number {
  if (!this.selectedSale?.products) return 0;
  
  // Calculate product taxable values (price * quantity - discount)
  return this.selectedSale.products.reduce((sum: number, product: any) => {
    const price = product.unitPrice || product.price || 0;
    const quantity = product.quantity || 1;
    const discount = product.discount || 0;
    return sum + (price * quantity - discount);
  }, 0);
}

getTotalCGSTForPrint(): number {
  const taxableValue = this.getTotalTaxableValueForPrint();
  return taxableValue * 0.025; // 2.5% CGST
}

getTotalSGSTForPrint(): number {
  const taxableValue = this.getTotalTaxableValueForPrint();
  return taxableValue * 0.025; // 2.5% SGST
}

getGrandTotalForPrint(): number {
  // Use the actual total from the sale record
  return this.selectedSale?.totalPayable || 
         (this.selectedSale?.paymentAmount || 0) + (this.selectedSale?.balance || 0);
}

private calculateAllTaxes(products: any[], shippingTax: number): any[] {
  const taxes: any[] = [];
  
  // Calculate product taxes
  const productTaxes = products.reduce((acc, product) => {
    if (product.taxType === 'GST') {
      acc.cgst += product.cgstAmount;
      acc.sgst += product.sgstAmount;
    } else if (product.taxType === 'IGST') {
      acc.igst += product.igstAmount;
    }
    return acc;
  }, { cgst: 0, sgst: 0, igst: 0 });
  
  // Add product taxes to the list
  if (productTaxes.cgst > 0) {
    taxes.push({
      name: `CGST @${products.find(p => p.taxType === 'GST')?.cgstRate || 9}%`,
      amount: parseFloat(productTaxes.cgst.toFixed(2))
    });
  }
  if (productTaxes.sgst > 0) {
    taxes.push({
      name: `SGST @${products.find(p => p.taxType === 'GST')?.sgstRate || 9}%`,
      amount: parseFloat(productTaxes.sgst.toFixed(2))
    });
  }
  if (productTaxes.igst > 0) {
    taxes.push({
      name: `IGST @${products.find(p => p.taxType === 'IGST')?.igstRate || 18}%`,
      amount: parseFloat(productTaxes.igst.toFixed(2))
    });
  }
  
  // Add shipping tax if applicable
  if (shippingTax > 0) {
    taxes.push({
      name: `Shipping Tax @${this.selectedSale.orderTax || 0}%`,
      amount: parseFloat(shippingTax.toFixed(2))
    });
  }
  
  return taxes;
}

// Calculate shipping tax separately
private calculateShippingTax(sale: any): any[] {
  const shippingTax = sale.shippingTaxAmount || 
                    ((sale.shippingCharges || 0) * (sale.orderTax || 0) / 100);
  
  if (shippingTax > 0) {
    return [{
      name: `Shipping Tax @${sale.orderTax || 0}%`,
      amount: shippingTax
    }];
  }
  return [];
}

// Update the calculateTaxes method to include shipping tax
private calculateTaxes(sale: any): any[] {
  const taxes = [];
  const taxRate = sale.orderTax || 0;
  
  // Product taxes
  if (taxRate > 0) {
    taxes.push({
      name: `Tax @${taxRate}%`,
      amount: sale.taxAmount || 0
    });
  }
  
  // Shipping tax if applicable
  const shippingTax = sale.shippingTaxAmount || 
                     ((sale.shippingCharges || 0) * taxRate / 100);
  if (shippingTax > 0) {
    taxes.push({
      name: `Shipping Tax @${taxRate}%`,
      amount: shippingTax
    });
  }
  
  return taxes;
}
private calculateTotal(sale: any): number {
  const subtotal = sale.products?.reduce((sum: number, product: any) => 
    sum + (product.subtotal || (product.unitPrice * product.quantity)), 0) || 0;
  const shipping = sale.shippingCost || sale.shippingCharges || 0;
  return subtotal + shipping;
}

printGeneratedInvoice(): void {
  // Create a clone of the invoice content for printing
  const printContent = document.getElementById('invoicePrintContent')?.cloneNode(true) as HTMLElement;
  
  // Remove any buttons or elements that shouldn't be printed
  const buttons = printContent.querySelectorAll('button');
  buttons.forEach(button => button.remove());

  // Create a new window for printing
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Popup blocker might be preventing the print window from opening. Please allow popups for this site.');
    return;
  }

  // Write the HTML content to the new window
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Invoice #${this.invoiceData.invoiceNo}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; color: #000; }
          .invoice-header { text-align: center; margin-bottom: 20px; }
          .invoice-title { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
          .invoice-details { margin-bottom: 30px; }
          .from-to-section { display: flex; justify-content: space-between; margin-bottom: 30px; }
          .from-section, .to-section { width: 48%; }
          .section-title { font-weight: bold; margin-bottom: 10px; border-bottom: 1px solid #000; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          .text-end { text-align: right; }
          .text-center { text-align: center; }
          .totals-section { text-align: right; margin-top: 20px; }
          .footer { margin-top: 50px; text-align: center; font-style: italic; }
          @media print {
            body { margin: 0; padding: 10px; }
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        ${printContent?.innerHTML || 'No content to print'}
        <script>
          // Automatically trigger print and close after printing
          setTimeout(() => {
            window.print();
            window.close();
          }, 300);
        </script>
      </body>
    </html>
  `);

  printWindow.document.close();
}
  
  // Make sure this method exists and works properly
closeFilterSidebar(): void {
  this.showFilterSidebar = false;
}
  printInvoice(): void {
    const printContent = document.getElementById('saleDetailsModal');
    const WindowPrt = window.open('', '', 'left=0,top=0,width=900,height=900,toolbar=0,scrollbars=0,status=0');
    WindowPrt?.document.write(printContent?.innerHTML ?? '');
    WindowPrt?.document.close();
    WindowPrt?.focus();
    WindowPrt?.print();
    WindowPrt?.close();
  }
async updateSaleStatus(sale: any, newStatus: string): Promise<void> {
  try {
    if (confirm(`Are you sure you want to change the status to ${newStatus}?`)) {
      await this.saleService.updateSale(sale.id, { 
        status: newStatus,
        updatedAt: new Date()
      });
      alert(`Sale status updated to ${newStatus}`);
      
      // Refresh the sales list to show updated quantities
      this.salesSubscription = this.saleService.listenForSales().subscribe((salesData) => {
        this.sales = salesData.filter(sale => sale.status === 'Completed');
        this.sales = this.sales.map(sale => ({
          ...sale,
          products: sale.products || []
        }));
        this.filteredSales = [...this.sales];
        this.totalEntries = this.filteredSales.length;
        this.calculateTotals();
      });
    }
  } catch (error) {
    console.error('Error updating sale status:', error);
    alert('Error updating sale status: ' + (error as Error).message);
  }
}

  async deleteSale(saleId: string): Promise<void> {
    if (confirm('Are you sure you want to delete this sale? This will restore the product quantities to inventory.')) {
      try {
        await this.saleService.deleteSale(saleId);
        alert('Sale deleted successfully!');
      } catch (error) {
        console.error('Error deleting sale:', error);
        alert('Error deleting sale. Please try again.');
      }
    }
  }

  navigateToAddSales() {
    this.router.navigate(['/add-sale']);
  }

applyFilters(): void {
  // If search term is empty, reset to original data
  if (!this.searchTerm) {
    this.filteredSales = [...this.sales];
    this.totalEntries = this.filteredSales.length;
    this.currentPage = 1;
    this.calculateTotals();
    return;
  }

  // Apply other filters if needed
  let filtered = [...this.sales];
  
  const term = this.searchTerm.toLowerCase();
  filtered = filtered.filter(sale =>
    (sale.customer?.toLowerCase()?.includes(term) ||
    sale.invoiceNo?.toLowerCase()?.includes(term) ||
    this.getProductNames(sale.products).toLowerCase().includes(term))
  );
  
  this.filteredSales = filtered;
  this.totalEntries = this.filteredSales.length;
  this.currentPage = 1;
  this.calculateTotals();
}

  toggleColumnMenu(): void {
    this.showColumnMenu = !this.showColumnMenu;
  }
  getUniqueLocations(): string[] {
  const locations = new Set<string>();
  
  // If user has access to all locations, return all unique locations
  if (this.userAllowedLocations.length === 0) {
    this.sales.forEach(sale => {
      if (sale.location || sale.businessLocation) {
        locations.add(sale.location || sale.businessLocation);
      }
    });
  } else {
    // Otherwise only return locations the user has access to
    this.userAllowedLocations.forEach(location => {
      locations.add(location);
    });
  }
  
  return Array.from(locations).sort();
}
isColumnVisible(columnKey: string): boolean {
  const column = this.columns.find(c => c.field === columnKey);
  return column ? column.visible : true;
}

resetColumnVisibility(): void {
  this.columns.forEach(column => {
    column.visible = true;
  });
  this.showColumnMenu = false;
}
// Add this method to get unique locations


  // New sort method
  sortData(field?: string): void {
    // If a field is provided and it's the same as current sortField, toggle direction
    if (field) {
      if (this.sortField === field) {
        this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        this.sortField = field;
        this.sortDirection = 'asc';
      }
    }

    // Sort the data based on the sortField and sortDirection
    if (this.sortField) {
      this.filteredSales.sort((a, b) => {
        let valueA: any;
        let valueB: any;

        // Handle special cases for different field types
        switch (this.sortField) {
          case 'saleDate':
            valueA = new Date(a.saleDate || 0).getTime();
            valueB = new Date(b.saleDate || 0).getTime();
            break;
          case 'paymentAmount':
          case 'balance':
          case 'commissionPercentage':
            valueA = Number(a[this.sortField] || 0);
            valueB = Number(b[this.sortField] || 0);
            break;
          case 'products':
            valueA = this.getProductsDisplayText(a.products || []);
            valueB = this.getProductsDisplayText(b.products || []);
            break;
          default:
            valueA = a[this.sortField]?.toString().toLowerCase() || '';
            valueB = b[this.sortField]?.toString().toLowerCase() || '';
        }

        // Compare values based on sort direction
        if (this.sortDirection === 'asc') {
          return valueA > valueB ? 1 : valueA < valueB ? -1 : 0;
        } else {
          return valueA < valueB ? 1 : valueA > valueB ? -1 : 0;
        }
      });
    }
    
    this.calculateTotals();
  }
  getUniqueAddedByUsers(): string[] {
    const users = new Set<string>();
    this.sales.forEach(sale => {
      if (sale.addedByDisplayName || sale.addedBy) {
        users.add(sale.addedByDisplayName || sale.addedBy);
      }
    });
    return Array.from(users).sort();
  }
  // Get sort icon class based on current sort state
  getSortIconClass(field: string): string {
    if (this.sortField !== field) {
      return 'fa-sort'; // default icon
    }
    return this.sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
  }

  toggleProductDetails(saleId: string): void {
    if (this.expandedSaleId === saleId) {
      this.expandedSaleId = null;
    } else {
      this.expandedSaleId = saleId;
    }
  }


  getProductsDisplayText(products: Product[]): string {
    if (!products || products.length === 0) return 'No products';
    
    if (products.length === 1) {
      return `${products[0].name} (${products[0].quantity})`;
    } else {
      return `${products[0].name} (${products[0].quantity}) and ${products.length - 1} more`;
    }
  }

  getProductNames(products: Product[]): string {
    if (!products || products.length === 0) return '';
    return products.map(p => p.name).join(' ');
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.calculateTotals();
    }
  }

  nextPage(): void {
    if (this.currentPage * this.entriesPerPage < this.totalEntries) {
      this.currentPage++;
      this.calculateTotals();
    }
  }

  exportCSV(): void {
    const headers = ['S.No', 'Customer', 'Sale Date', 'Invoice No', 'Products', 'Status', 
      'Commission %', 'Shipping Status', 'Payment Amount', 'Balance', 'Billing Address']; // 
    
    const data = this.filteredSales.map((sale, index) => {
      return {
        'S.No': index + 1,
        'Customer': sale.customer || 'N/A',
        'Sale Date': sale.saleDate ? new Date(sale.saleDate).toLocaleDateString() : 'N/A',
        'Invoice No': sale.invoiceNo || 'N/A',
        'Products': this.getProductsDisplayText(sale.products),
        'Status': sale.status || 'N/A',
        'Commission %': sale.commissionPercentage || 0,
        'Shipping Status': sale.shippingStatus || 'N/A',
        'Billing Address': sale.billingAddress || 'N/A' ,// Add this line

        'Payment Amount': sale.paymentAmount !== undefined ? `$${Number(sale.paymentAmount).toFixed(2)}` : '$0.00',
        'Balance': sale.balance !== undefined ? `$${Number(sale.balance).toFixed(2)}` : '$0.00'
      };
    });

    const csv = this.convertToCSV(data, headers);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', 'completed_sales_data.csv');
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
async completeSale(sale: any): Promise<void> {
  try {
    // First update the sale status to "Completed"
    await this.saleService.updateSale(sale.id, { 
      status: 'Completed',
      updatedAt: new Date()
    });

    // Create transaction in the payment account
    if (sale.paymentAccount && sale.paymentAmount > 0) {
      // Record as income in the expenses service
      const incomeData = {
        type: 'income',
        businessLocation: sale.businessLocation || sale.location,
        incomeCategory: 'Sales Income',
        referenceNo: sale.invoiceNo,
        date: sale.saleDate || new Date().toISOString(),
        incomeFor: 'Sales',
        totalAmount: sale.total || sale.paymentAmount,
        paymentAmount: sale.paymentAmount,
        paidOn: sale.saleDate || new Date().toISOString(),
        paymentMethod: sale.paymentMethod || 'Cash',
        paymentAccount: sale.paymentAccount,
        addedBy: sale.addedBy || 'System',
        addedByDisplayName: sale.addedByDisplayName || sale.addedBy || 'System',
        entryType: 'sale'
      };

      // Add to incomes collection
      await this.expenseService.addIncome(incomeData);

      // Record the transaction in the account service
      const transactionData = {
        accountId: sale.paymentAccount,
        date: new Date(sale.saleDate || new Date()),
        description: `Sale: ${sale.invoiceNo}`,
        paymentMethod: sale.paymentMethod || 'Cash',
        paymentDetails: sale.invoiceNo,
        note: sale.sellNote || sale.note || '',
        addedBy: sale.addedByDisplayName || sale.addedBy || 'System',
        debit: 0,
        credit: sale.paymentAmount,
        balance: 0,
        hasDocument: false,
        type: 'sale',
        source: 'sale',
        saleId: sale.id,
        referenceNo: sale.invoiceNo,
        customer: sale.customer,
        invoiceNo: sale.invoiceNo
      };

      await this.accountService.addTransaction(sale.paymentAccount, transactionData);

      // If it's a partial payment, record the remaining balance as due
      if (sale.balance > 0) {
        const dueTransaction = {
          accountId: sale.paymentAccount,
          date: new Date(sale.saleDate || new Date()),
          description: `Sale Due: ${sale.invoiceNo}`,
          paymentMethod: 'Account Receivable',
          paymentDetails: sale.invoiceNo,
          note: 'Pending payment for sale',
          addedBy: sale.addedByDisplayName || sale.addedBy || 'System',
          debit: 0,
          credit: sale.balance,
          balance: 0,
          hasDocument: false,
          type: 'receivable',
          source: 'sale',
          saleId: sale.id,
          referenceNo: sale.invoiceNo,
          customer: sale.customer,
          invoiceNo: sale.invoiceNo,
          paymentStatus: 'Due'
        };
        
        await this.accountService.addTransaction(sale.paymentAccount, dueTransaction);
      }
    }

    alert('Sale completed and payment recorded successfully!');
    
    // Refresh the sales list
    this.salesSubscription = this.saleService.listenForSales().subscribe((salesData) => {
      this.sales = salesData.filter(sale => sale.status === 'Completed');
      this.filteredSales = [...this.sales];
      this.totalEntries = this.filteredSales.length;
      this.calculateTotals();
    });
  } catch (error) {
    console.error('Error completing sale:', error);
    alert('Error completing sale: ' + (error as Error).message);
  }
}
  
  private convertToCSV(data: any[], headers: string[]): string {
    const headerString = headers.join(',');
    const rowStrings = data.map(row => 
      headers.map(fieldName => 
        `"${(row[fieldName] ?? '').toString().replace(/"/g, '""')}"`
      ).join(',')
    );
    
    return [headerString, ...rowStrings].join('\n');
  }

  exportExcel(): void {
    const headers = ['S.No', 'Customer', 'Sale Date', 'Invoice No', 'Products', 'Status', 'Commission %', 'Shipping Status', 'Payment Amount', 'Balance'];
    
    const data = this.filteredSales.map((sale, index) => {
      return [
        index + 1,
        sale.customer || 'N/A',
        sale.saleDate ? new Date(sale.saleDate).toLocaleDateString() : 'N/A',
        sale.invoiceNo || 'N/A',
        this.getProductsDisplayText(sale.products),
        sale.status || 'N/A',
        sale.commissionPercentage || 0,
        sale.shippingStatus || 'N/A',
        sale.paymentAmount !== undefined ? `$${Number(sale.paymentAmount).toFixed(2)}` : '$0.00',
        sale.balance !== undefined ? `$${Number(sale.balance).toFixed(2)}` : '$0.00'
      ];
    });

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Completed Sales');
    
    XLSX.writeFile(workbook, 'completed_sales_data.xlsx');
  }

  printData(): void {
    const printContent = document.querySelector('.table-responsive')?.innerHTML;
    const WindowPrt = window.open('', '', 'left=0,top=0,width=900,height=900,toolbar=0,scrollbars=0,status=0');
    
    WindowPrt?.document.write(`
      <html>
        <head>
          <title>Completed Sales Data</title>
          <style>
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .no-print { display: none; }
          </style>
        </head>
        <body>
          <h2>Completed Sales Data</h2>
          <p>Generated on: ${new Date().toLocaleString()}</p>
          ${printContent}
          <script>
            setTimeout(() => {
              window.print();
              window.close();
            }, 500);
          </script>
        </body>
      </html>
    `);
    
    WindowPrt?.document.close();
  }

  exportPDF(): void {
    const headers = ['S.No', 'Customer', 'Sale Date', 'Invoice No', 'Products', 'Status', 'Commission %', 'Shipping Status', 'Payment Amount', 'Balance'];
    
    const data = this.filteredSales.map((sale, index) => {
      return [
        index + 1,
        sale.customer || 'N/A',
        sale.saleDate ? new Date(sale.saleDate).toLocaleDateString() : 'N/A',
        sale.invoiceNo || 'N/A',
        this.getProductsDisplayText(sale.products),
        sale.status || 'N/A',
        sale.commissionPercentage || 0,
        sale.shippingStatus || 'N/A',
        sale.paymentAmount !== undefined ? `$${Number(sale.paymentAmount).toFixed(2)}` : '$0.00',
        sale.balance !== undefined ? `$${Number(sale.balance).toFixed(2)}` : '$0.00'
      ];
    });

    const doc = new jsPDF({ orientation: 'landscape' });
    doc.text('Completed Sales Report', 14, 15);
    
    (doc as any).autoTable({
      head: [headers],
      body: data,
      startY: 25,
      margin: { top: 10 },
      theme: 'grid',
      headStyles: {
        fillColor: [22, 160, 133]
      }
    });
    
    doc.save('completed-sales-report.pdf');
  }
  
initiateReturn(sale: any): void {
  if (confirm(`Initiate return for invoice #${sale.invoiceNo}?`)) {
    this.router.navigate(['/sell-return'], {
      state: { 
        saleData: sale,
        markAsReturned: true // Explicitly indicate we want to mark as returned
      }
    });
  }
}
  
}