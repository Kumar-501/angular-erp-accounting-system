import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { SaleService } from '../services/sale.service';
import { Subscription, forkJoin } from 'rxjs'; // Added forkJoin
import * as bootstrap from 'bootstrap';
import { StockService } from '../services/stock.service';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { LocationService } from '../services/location.service'; // Added
import { UserService } from '../services/user.service'; // Added
import { TypeOfServiceService } from '../services/type-of-service.service'; // Added
import { AccountService } from '../services/account.service';
import 'jspdf-autotable';
import { Router } from '@angular/router';
import { ProductsService } from '../services/products.service';
import { Expense, ExpenseService } from '../services/expense.service';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../auth.service';
import { take } from 'rxjs/operators';
import { TaxService } from '../services/tax.service';

// Add this interface at the top of your sales.component.ts file
interface InvoiceData {
  shippingTax: number;
  totalTaxableValue: number;
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
    discountPercent: number;
    discount: number;
    taxableValue: number;
    taxType: string;
    cgstAmount: number;
    cgstRate: number;
    sgstAmount: number;
    sgstRate: number;
    igstAmount: number;
    igstRate: number;
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
  currentShipment: any;
  shippingDetails?: string;
  shippingStatus?: string;
  totalPayable?: number;
  paymentAmount?: number;
  balanceAmount: number;
  balance?: number;
    orderStatus?: string;  // Add this line

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
  taxType: 'GST' | 'IGST';
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
  'Shipping (Before Tax)': string;
  'Shipping Tax': string;
  'Shipping (With Tax)': string;
  'Shipping Returned': string;
  'Net Shipping': string;
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
  availableTaxRates: any[] = []; 
  actionModal: any;
  selectedSale: any;
    invoiceHasIgst: boolean = false;
    businessLocations: any[] = [];
serviceTypes: any[] = [];
users: any[] = [];
typeOfServiceFilter: string = ''; // New filter property

  invoiceHasCgstSgst: boolean = false;

  selectedSaleForAction: any = null;
  selectedAction: string = 'delete';
  deleteReason: string = '';
  isFullReturn: boolean = true;
  private salesSubscription: Subscription | undefined;
  totalEntries: number = 0;
  shipment: any;
  productFilterName: string = '';
  private printModal: any;
  private viewSaleModal: any;

  filters: any = {};
  loading: boolean = false;
  error: string | null = null;
  
  subscriptions: Subscription[] = [];
  totalShippingCharge: number = 0;
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
    shippingTax: 0,
    totalTaxableValue: 0
  };

  currentPage: number = 1;
  entriesPerPage: number = 25;
  searchTerm: string = '';
  private modal: any;
  startDate: string = '';
  Math = Math;
  endDate: string = '';
  
  private invoiceModal: any;
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
  totalTotalPayable: number = 0;
  
  // Add sorting variables
  sortField: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  
  // Add missing properties
  addedByFilter: string = '';
  locationFilter: string = '';
  products: Product[] = [];
  
  columns: Column[] = [
    { field: 'customer', header: 'Customer', visible: true },
    { field: 'saleDate', header: 'Sale Date', visible: true },
    { field: 'invoiceNo', header: 'Invoice No', visible: true },
    { field: 'products', header: 'Products', visible: true },
    { field: 'status', header: 'Status', visible: true },
      { field: 'orderStatus', header: 'Order Status', visible: true },

    { field: 'paymentStatus', header: 'Payment Status', visible: true },
    { field: 'paymentMethod', header: 'Payment Method', visible: true },
    { field: 'paymentAccountName', header: 'Payment Account', visible: true },
    { field: 'paymentAmount', header: 'Payment Amount', visible: true },
    { field: 'balance', header: 'Balance (Due)', visible: true },
    { field: 'totalPayable', header: 'Total Payable', visible: true },
    { field: 'commissionPercentage', header: 'Commission %', visible: true },
    { field: 'shippingStatus', header: 'Shipping Status', visible: true },
    { field: 'shippingCharges', header: 'Shipping Charges', visible: true },
    { field: 'billingAddress', header: 'Billing Address', visible: true },
    { field: 'shippingAddress', header: 'Shipping Address', visible: true },
    { field: 'shippingDetails', header: 'Shipping Details', visible: true },
    { field: 'typeOfService', header: 'Type of Service', visible: true }, 
    { field: 'customerPhone', header: 'Contact', visible: true },
    { field: 'addedByDisplayName', header: 'Added By', visible: true },
    { field: 'businessLocation', header: 'Business Location', visible: true },
    
  
  ];



  constructor(
    private saleService: SaleService,
    private stockService: StockService,
    private productService: ProductsService,
    private accountService: AccountService,
    private authService: AuthService,
    private expenseService: ExpenseService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private taxService: TaxService,
    private locationService: LocationService, // New
    private userService: UserService, // New
    private typeOfServiceService: TypeOfServiceService // New
  ) {}
// UPDATED loadSales() METHOD
// Replace the existing loadSales() method in your sales.component.ts with this updated version

loadSales(): void {
  if (this.salesSubscription) this.salesSubscription.unsubscribe();

  this.salesSubscription = this.saleService.listenForSales(this.filters, this.userAllowedLocations).subscribe({
    next: (sales) => {
      // ============ FILTER TO ONLY SHOW COMPLETED ORDERS ============
      const completedSales = sales.filter(sale => {
        const status = sale.orderStatus || sale.status || 'Pending';
        return status === 'Completed';
      });
      // ===============================================================

      this.sales = completedSales.map(sale => {
        // Resolve Reference Names
        const loc = this.businessLocations.find(l => l.id === (sale.businessLocation || sale.location));
        const serv = this.serviceTypes.find(s => s.id === sale.typeOfService);
        const user = this.users.find(u => u.id === sale.addedBy);

        return {
          ...sale,
          // LOGIC FIELDS (IDs used for filtering)
          locationId: sale.businessLocation || sale.location,
          serviceId: sale.typeOfService,
          addedById: sale.addedBy,

          // DISPLAY FIELDS (Names used for table)
          businessLocation: loc ? loc.name : (sale.businessLocation || 'N/A'),
          typeOfService: serv ? serv.name : (sale.typeOfService || 'N/A'),
          addedByDisplayName: user ? user.displayName : (sale.addedByDisplayName || 'N/A'),
          
          orderStatus: sale.orderStatus || sale.status || 'Pending',
          saleDate: sale.saleDate?.toDate ? sale.saleDate.toDate() : sale.saleDate,
          products: sale.products || []
        };
      });
      
      this.applyFilters();
      this.loading = false;
      this.cdr.detectChanges();
    },
    error: (error) => {
      this.error = 'Failed to load sales';
      this.loading = false;
      this.cdr.detectChanges(); 
    }
  });
}


  getShippingChargeWithoutTax(sale: any): number {
    return Number(sale.shippingCharges || 0);
  }

  getShippingTaxAmount(sale: any): number {
    const shippingCharge = this.getShippingChargeWithoutTax(sale);
    const taxRate = Number(sale.orderTax || 18); // Default 18% tax rate
    return shippingCharge * (taxRate / 100);
  }
applyFilters(): void {
  let filtered = [...this.sales];

  // 1. Search Term (Includes names of location/service)
  const term = this.searchTerm.toLowerCase().trim();
  if (term) {
    filtered = filtered.filter(s =>
      (s.customer?.toLowerCase()?.includes(term) ||
      s.invoiceNo?.toLowerCase()?.includes(term) ||
      s.orderNo?.toLowerCase()?.includes(term) ||
      s.orderStatus?.toLowerCase()?.includes(term) ||
      s.businessLocation?.toLowerCase()?.includes(term) ||
      s.typeOfService?.toLowerCase()?.includes(term) ||
      this.getProductNames(s.products).toLowerCase().includes(term))
    );
  }

  // 2. Status Filter
  if (this.statusFilter) {
    filtered = filtered.filter(s => s.orderStatus === this.statusFilter);
  }

  // 3. FIXED: Location ID Filter
  if (this.locationFilter) {
    filtered = filtered.filter(s => s.locationId === this.locationFilter);
  }

  // 4. FIXED: Incentive User ID Filter
  if (this.addedByFilter) {
    filtered = filtered.filter(s => s.addedById === this.addedByFilter);
  }

  // 5. FIXED: Type of Service ID Filter
  if (this.typeOfServiceFilter) {
    filtered = filtered.filter(s => s.serviceId === this.typeOfServiceFilter);
  }

  // 6. Payment & Shipping Filters
  if (this.paymentMethodFilter) filtered = filtered.filter(s => s.paymentMethod === this.paymentMethodFilter);
  if (this.shippingStatusFilter) filtered = filtered.filter(s => s.shippingStatus === this.shippingStatusFilter);

  // 7. Date Range Filter
  if (this.startDate && this.endDate) {
    const start = new Date(this.startDate);
    const end = new Date(this.endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    filtered = filtered.filter(s => {
      const d = new Date(s.saleDate);
      return d >= start && d <= end;
    });
  }

  this.filteredSales = filtered;
  this.totalEntries = this.filteredSales.length;
  this.currentPage = 1;
  this.calculateTotals();
}
  getShippingChargeWithTax(sale: any): number {
    return this.getShippingChargeWithoutTax(sale) + this.getShippingTaxAmount(sale);
  }

  getShippingReturnedAmount(sale: any): number {
    return Number(sale.totalShippingReturned || 0);
  }

  // Enhanced calculateTotals method
  calculateTotals(): void {
    const currentPageData = this.filteredSales.slice(
      (this.currentPage - 1) * this.entriesPerPage,
      this.currentPage * this.entriesPerPage
    );
    
    this.totalPaymentAmount = currentPageData.reduce((sum, sale) => 
      sum + (sale.paymentAmount ? Number(sale.paymentAmount) : 0), 0);
    
    this.totalBalance = currentPageData.reduce((sum, sale) => 
      sum + (sale.balance ? Number(sale.balance) : 0), 0);
      
    // Enhanced shipping calculations
    this.totalShippingCharge = currentPageData.reduce((sum, sale) => 
      sum + this.getShippingChargeWithoutTax(sale), 0);
      
    this.totalShippingTax = currentPageData.reduce((sum, sale) => 
      sum + this.getShippingTaxAmount(sale), 0);
      
    this.totalShippingWithTax = currentPageData.reduce((sum, sale) => 
      sum + this.getShippingChargeWithTax(sale), 0);
      
    this.totalCommission = currentPageData.reduce((sum, sale) => 
      sum + (sale.totalCommission ? Number(sale.totalCommission) : 0), 0);
      
    this.totalDueAmount = currentPageData.reduce((sum, sale) => {
      const status = this.calculatePaymentStatus(sale);
      if (status === 'Due' || status === 'Partial') {
        return sum + (sale.balance ? Number(sale.balance) : 0);
      }
      return sum;
    }, 0);

    this.totalTotalPayable = currentPageData.reduce((sum, sale) =>
      sum + (sale.totalPayable ? Number(sale.totalPayable) : 0), 0);
      
    // Calculate sales without tax and shipping
    this.totalSalesWithoutTax = currentPageData.reduce((sum, sale) => {
      if (sale.products && Array.isArray(sale.products)) {
        const productTotal = sale.products.reduce((productSum: number, product: any) => {
          const quantity = Number(product.quantity) || 1;
          const unitPrice = Number(product.unitPrice) || 0;
          const discount = Number(product.discount) || 0;
          
          // Use priceBeforeTax if available, otherwise calculate from unitPrice and tax
          let priceBeforeTax = Number(product.priceBeforeTax) || 0;
          if (priceBeforeTax === 0 && unitPrice > 0) {
            const taxRate = Number(product.taxRate) || 0;
            priceBeforeTax = taxRate > 0 ? unitPrice / (1 + (taxRate / 100)) : unitPrice;
          }
          
          return productSum + (priceBeforeTax * quantity) - discount;
        }, 0);
        return sum + productTotal;
      }
      // Fallback to subtotal if products array is not available
      return sum + (Number(sale.subtotal) || 0);
    }, 0);
    
    // Calculate total sales with shipping and tax
    this.totalSalesWithShippingTax = this.totalSalesWithoutTax + this.totalShippingWithTax;
  }

  // Enhanced method to get shipping breakdown for a specific sale
  getShippingBreakdownForSale(sale: any): {
    chargeWithoutTax: number;
    taxAmount: number;
    chargeWithTax: number;
    taxRate: number;
    returnedAmount: number;
    netShipping: number;
  } {
    const chargeWithoutTax = this.getShippingChargeWithoutTax(sale);
    const taxAmount = this.getShippingTaxAmount(sale);
    const chargeWithTax = chargeWithoutTax + taxAmount;
    const returnedAmount = this.getShippingReturnedAmount(sale);
    const netShipping = chargeWithTax - returnedAmount;
    
    return {
      chargeWithoutTax,
      taxAmount,
      chargeWithTax,
      taxRate: Number(sale.orderTax || 18),
      returnedAmount,
      netShipping: Math.max(0, netShipping)
    };
  }

  // Method to check if sale has shipping charges
  hasShippingCharges(sale: any): boolean {
    return this.getShippingChargeWithoutTax(sale) > 0;
  }



getRowDataForExport(sale: any, index: number): RowData {
  const shippingBreakdown = this.getShippingBreakdownForSale(sale);
  
  return {
    'S.No': index + 1,
    'Customer': sale.customer || '',
    'Sale Date': sale.saleDate ? new Date(sale.saleDate).toLocaleDateString() : 'N/A',
    'Invoice No': sale.invoiceNo || '',
    'Products': this.getProductsDisplayText(sale.products),
    'Status': sale.status || '',
    'Commission %': sale.commissionPercentage || 0,
    'Shipping Status': this.getShippingStatusWithReturns(sale),
    'Payment Amount': this.formatCurrency(sale.paymentAmount),
    'Balance': this.formatCurrency(sale.balance),
    'Shipping (Before Tax)': this.formatCurrency(shippingBreakdown.chargeWithoutTax),
    'Shipping Tax': this.formatCurrency(shippingBreakdown.taxAmount),
    'Shipping (With Tax)': this.formatCurrency(shippingBreakdown.chargeWithTax),
    'Shipping Returned': this.formatCurrency(shippingBreakdown.returnedAmount),
    'Net Shipping': this.formatCurrency(shippingBreakdown.netShipping)
  };
}

  calculateCreditBalances(): void {
    this.totalCreditBalance = this.filteredSales.reduce((sum, sale) => {
      if (sale.paymentStatus === 'Due' || sale.paymentStatus === 'Partial') {
        return sum + (sale.balance || 0);
      }
      return sum;
    }, 0);
  }

  printInvoiceNow(): void {
    const printContent = document.getElementById('printInvoiceContent')?.cloneNode(true) as HTMLElement;
    
    const buttons = printContent.querySelectorAll('button');
    buttons.forEach(button => button.remove());

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Popup blocker might be preventing the print window from opening. Please allow popups for this site.');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice #${this.selectedSale?.invoiceNo}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; color: #000; }
            .invoice-print-header { display: flex; align-items: center; margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #eee; }
            .logo { width: 80px; height: auto; margin-right: 20px; }
            .company-details { text-align: left; }
            .company-details h3 { font-size: 18px; margin: 0; }
            .company-details p { font-size: 12px; margin: 2px 0; }
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

  resetFilters(): void {
    this.startDate = '';
    this.endDate = '';
    this.searchTerm = '';
    this.applyFilters();
  }

  getTotalTaxableValue(): number {
    return this.invoiceData.products.reduce(
      (sum, product) => sum + product.taxableValue, 0
    );
  }

getTotalSGST(): number {
  if (!this.invoiceHasCgstSgst) return 0;
  return this.invoiceData.products.reduce(
    (sum, product) => sum + (product.sgstAmount || 0), 0
  );
}


  confirmAction(): void {
    if (!this.selectedSale) return;
    
    switch (this.selectedAction) {
      case 'delete':
        this.deleteSale(this.selectedSale.id);
        break;
      case 'return':
        this.initiateReturn(this.selectedSale);
        break;
      case 'invoice':
        this.generateInvoice(this.selectedSale);
        break;
    }
    
    if (this.actionModal) {
      this.actionModal.hide();
    }
  }
openActionPopup(sale: any) {
  this.selectedSale = sale;
  const modalElement = document.getElementById('actionModal');
  if (modalElement) {
    const modal = new bootstrap.Modal(modalElement);
    modal.show();
  }
}
viewSaleDetails(sale: any): void {
  this.selectedSale = sale;
  this.viewSaleModal.show();
}
closeModal() {
  const modalElement = document.getElementById('actionModal');
  if (modalElement) {
    const modal = bootstrap.Modal.getInstance(modalElement);
    modal?.hide();
  }
}

 getTotalCGST(): number {
  if (!this.invoiceHasCgstSgst) return 0;
  return this.invoiceData.products.reduce(
    (sum, product) => sum + (product.cgstAmount || 0), 0
  );
}

getTotalIGST(): number {
  if (!this.invoiceHasIgst) return 0;
  return this.invoiceData.products.reduce(
    (sum, product) => sum + (product.igstAmount || 0), 0
  );
}
  getStatusCounts(): {status: string, count: number}[] {
    const statusMap = new Map<string, number>();
    
    this.filteredSales.forEach(sale => {
      statusMap.set(sale.status, (statusMap.get(sale.status) || 0) + 1);
    });
    
    return Array.from(statusMap.entries()).map(([status, count]) => ({ status, count }));
  }

  showActionModal(sale: any): void {
    this.selectedSale = sale;
    
    if (!this.actionModal) {
      const modalElement = document.getElementById('actionModal');
      if (modalElement) {
        this.actionModal = new bootstrap.Modal(modalElement);
      }
    }
    
    if (this.actionModal) {
      this.actionModal.show();
    }
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


// Updated methods for sales.component.ts

// Add these new methods to calculate shipping properly






// Add these new properties to the component class
totalShippingTax: number = 0;
totalShippingWithTax: number = 0;
totalSalesWithoutTax: number = 0;
totalSalesWithShippingTax: number = 0;


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
    this.quickDateFilter = '';
    this.applyFilters();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    
    if (this.viewSaleModal) {
      this.viewSaleModal.dispose();
    }
  }

  private calculatePaymentStatus(sale: any): string {
    if (sale.paymentAmount >= sale.totalPayable) return 'Paid';
    if (sale.paymentAmount > 0) return 'Partial';
    return 'Due';
  }



  applyQuickDateFilter(): void {
    if (!this.quickDateFilter) {
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
        thisWeekStart.setDate(today.getDate() - today.getDay());
        const thisWeekEnd = new Date(thisWeekStart);
        thisWeekEnd.setDate(thisWeekStart.getDate() + 6);
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
          startDate = new Date(currentYear - 1, 9, 1);
          endDate = new Date(currentYear - 1, 12, 0);
        } else {
          startDate = new Date(currentYear, lastQuarterMonth, 1);
          endDate = new Date(currentYear, lastQuarterMonth + 3, 0);
        }
        break;
      case 'thisYear':
        startDate = new Date(currentYear, 0, 1);
        endDate = new Date(currentYear, 11, 31);
        break;
      case 'lastYear':
        startDate = new Date(currentYear - 1, 0, 1);
        endDate = new Date(currentYear - 1, 11, 31);
        break;
      case 'thisFinancialYear':
        if (today.getMonth() >= 3) {
          startDate = new Date(currentYear, 3, 1);
          endDate = new Date(currentYear + 1, 2, 31);
        } else {
          startDate = new Date(currentYear - 1, 3, 1);
          endDate = new Date(currentYear, 2, 31);
        }
        break;
      case 'lastFinancialYear':
        if (today.getMonth() >= 3) {
          startDate = new Date(currentYear - 1, 3, 1);
          endDate = new Date(currentYear, 2, 31);
        } else {
          startDate = new Date(currentYear - 2, 3, 1);
          endDate = new Date(currentYear - 1, 2, 31);
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
  }

  getServiceTypeSummary(): {type: string, count: number}[] {
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

  updateColumnVisibility(): void {
    console.log('Column visibility updated', this.columns);
  }

  viewSale(sale: any): void {
    this.selectedSale = sale;
    this.modal.show();
  }

// src/app/sales/sales.component.ts
// src/app/sales/sales.component.ts

// src/app/sales/sales.component.ts

// In sales.component.ts - Replace the existing generateInvoice method with this fixed version
// In sales.component.ts - Replace the existing generateInvoice method with this fixed version

// src/app/sales/sales.component.ts

// ... (inside the SalesComponent class)
// src/app/sales/sales.component.ts

// ... (inside the SalesComponent class)

// In sales.component.ts - Replace the existing generateInvoice method with this fixed version

generateInvoice(sale: any): void {
    this.selectedSale = sale;
    console.log('--- Generating Invoice ---');
    console.log('Sale Data from DB:', JSON.parse(JSON.stringify(sale)));

    this.invoiceHasIgst = false;
    this.invoiceHasCgstSgst = false;

    const processedProducts = (sale.products || []).map((product: any) => {
      console.log(`Processing product: '${product.name}', Saved Tax Type: '${product.taxType}'`);
      
      const isIGST = product.taxType === 'IGST';
      
      if (isIGST) {
        console.log(` -> This product is IGST. Setting invoiceHasIgst flag to true.`);
        this.invoiceHasIgst = true;
      } else if (Number(product.taxRate) > 0) {
        console.log(` -> This product is CGST/SGST.`);
        this.invoiceHasCgstSgst = true;
      }

      const unitPriceBeforeTax = Number(product.priceBeforeTax) || 0;
      const quantity = Number(product.quantity) || 1;
      const discount = Number(product.discount) || 0;
      const taxableValue = (unitPriceBeforeTax * quantity) - discount;

      const cgstAmount = Number(product.cgstAmount) || 0;
      const sgstAmount = Number(product.sgstAmount) || 0;
      const igstAmount = Number(product.igstAmount) || 0;
      
      const taxRateValue = Number(product.taxRate) || 0;
      const cgstRate = isIGST ? 0 : taxRateValue / 2;
      const sgstRate = isIGST ? 0 : taxRateValue / 2;
      const igstRate = isIGST ? taxRateValue : 0;

      const subtotal = taxableValue + cgstAmount + sgstAmount + igstAmount;

      return {
        name: product.name || 'Unknown Product',
        quantity: quantity,
        unitPrice: parseFloat(unitPriceBeforeTax.toFixed(2)),
        discount: parseFloat(discount.toFixed(2)),
        discountPercent: Number(product.discountPercent) || 0,
        taxableValue: parseFloat(taxableValue.toFixed(2)),
        cgstAmount: parseFloat(cgstAmount.toFixed(2)),
        sgstAmount: parseFloat(sgstAmount.toFixed(2)),
        igstAmount: parseFloat(igstAmount.toFixed(2)),
        cgstRate: parseFloat(cgstRate.toFixed(2)),
        sgstRate: parseFloat(sgstRate.toFixed(2)),
        igstRate: parseFloat(igstRate.toFixed(2)),
        subtotal: parseFloat(subtotal.toFixed(2))
      };
    });

    if (this.invoiceHasIgst) {
      this.invoiceHasCgstSgst = false; 
      console.log('--- Final Decision: Invoice will show IGST column. ---');
    } else {
      console.log('--- Final Decision: Invoice will show CGST/SGST columns. ---');
    }
    
    const totalTaxableValue = processedProducts.reduce((sum: any, p: { taxableValue: any; }) => sum + p.taxableValue, 0);
    const grandTotal = sale.totalPayable || 0;

    // ======================= FULL OBJECT ASSIGNMENT (FIX) =======================
    // This block populates all required fields for the InvoiceData interface.
    this.invoiceData = {
      invoiceNo: sale.invoiceNo || 'N/A',
      date: sale.saleDate || new Date().toISOString(),
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
      shippingCharge: Number(sale.shippingCharges) || 0,
      shippingTax: (Number(sale.shippingCharges) || 0) * ((Number(sale.orderTax) || 18) / 100),
      totalTaxableValue: parseFloat(totalTaxableValue.toFixed(2)),
      taxes: [], // This can be left empty as taxes are handled within products
      total: parseFloat(grandTotal.toFixed(2))
    };
    // ===================== END OF FULL OBJECT ASSIGNMENT ====================

    this.invoiceModal.show();
}


  getTotalTaxableValueForPrint(): number {
    return this.selectedSale?.totalBeforeTax || 
           this.selectedSale?.products?.reduce((sum: number, product: any) => {
             const price = product.unitPrice || product.price || 0;
             const quantity = product.quantity || 1;
             const discount = product.discount || 0;
             return sum + (price * quantity - discount);
           }, 0) || 0;
  }

  getTotalCGSTForPrint(): number {
     const cgstAmount = this.selectedSale?.taxDetails?.cgst || 0;
     return cgstAmount;
  }

  getTotalSGSTForPrint(): number {
     const sgstAmount = this.selectedSale?.taxDetails?.sgst || 0;
     return sgstAmount;
  }

  getGrandTotalForPrint(): number {
    return this.selectedSale?.totalPayable || 
           (this.selectedSale?.paymentAmount || 0) + (this.selectedSale?.balance || 0);
  }
// Edit sale
editSale(sale: any): void {
  this.router.navigate(['/edit-sale', sale.id]);
}
getGrandTotal(): number {
  const productSubtotal = this.invoiceData.products.reduce(
    (sum, product) => sum + product.subtotal, 0
  );

  const total = productSubtotal + 
                this.invoiceData.shippingCharge + 
                this.invoiceData.shippingTax;
  
  // Round to nearest whole number
  return Math.round(total);
}
roundAmount(amount: number): number {
  return Math.round(amount || 0);
}
  printGeneratedInvoice(): void {
    const printContent = document.getElementById('invoicePrintContent')?.cloneNode(true) as HTMLElement;
    
    const buttons = printContent.querySelectorAll('button');
    buttons.forEach(button => button.remove());

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Popup blocker might be preventing the print window from opening. Please allow popups for this site.');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice #${this.invoiceData.invoiceNo}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; color: #000; }
            .invoice-print-header { display: flex; align-items: center; margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #eee; }
            .logo { width: 80px; height: auto; margin-right: 20px; }
            .company-details { text-align: left; }
            .company-details h3 { font-size: 18px; margin: 0; }
            .company-details p { font-size: 12px; margin: 2px 0; }
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
        await this.saleService['updateSale'](sale.id, { 
          status: newStatus,
          updatedAt: new Date()
        });
        alert(`Sale status updated to ${newStatus}`);
        this.loadSales();
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
        this.loadSales();
      } catch (error) {
        console.error('Error deleting sale:', error);
        alert('Error deleting sale. Please try again.');
      }
    }
  }

  navigateToAddSales() {
    this.router.navigate(['/add-sale']);
  }

getActiveFilters(): { label: string, key: string }[] {
  const active: { label: string, key: string }[] = [];

  if (this.searchTerm) active.push({ label: `Search: ${this.searchTerm}`, key: 'searchTerm' });
  if (this.statusFilter) active.push({ label: `Status: ${this.statusFilter}`, key: 'status' });

  if (this.locationFilter) {
    const loc = this.businessLocations.find(l => l.id === this.locationFilter);
    active.push({ label: `Loc: ${loc ? loc.name : 'Selected Location'}`, key: 'location' });
  }

  if (this.typeOfServiceFilter) {
    const serv = this.serviceTypes.find(s => s.id === this.typeOfServiceFilter);
    active.push({ label: `Service: ${serv ? serv.name : 'Selected Service'}`, key: 'typeOfService' });
  }

  if (this.addedByFilter) {
    const user = this.users.find(u => u.id === this.addedByFilter);
    active.push({ label: `User: ${user ? user.displayName : 'Selected User'}`, key: 'addedBy' });
  }

  if (this.quickDateFilter) active.push({ label: `Date: ${this.quickDateFilter}`, key: 'date' });

  return active;
}

removeActiveFilter(key: string): void {
  switch (key) {
    case 'searchTerm': this.searchTerm = ''; break;
    case 'status': this.statusFilter = ''; break;
    case 'location': this.locationFilter = ''; break;
    case 'typeOfService': this.typeOfServiceFilter = ''; break;
    case 'addedBy': this.addedByFilter = ''; break;
    case 'date': 
      this.startDate = ''; this.endDate = ''; this.quickDateFilter = ''; 
      break;
  }
  this.applyFilters();
}
getShippingStatusWithReturns(sale: any): string {
  // 1. Highest Priority: Full Return
  if (sale.status === 'Returned') {
    return 'Returned';
  }

  // 2. High Priority: Partial Return
  if (sale.status === 'Partial Return') {
    return 'Partially Returned';
  }

  // 3. Normal Priority: Shipping Status
  if (sale.shippingStatus && sale.shippingStatus.trim() !== '') {
    // Standardize to Capital Case (e.g., 'shipped' -> 'Shipped')
    const status = sale.shippingStatus.toLowerCase();
    
    // Check for "on hold" or specific statuses that might come from the DB
    if (status === 'pending') return 'Pending';
    
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  // 4. Final Fallback
  return 'N/A';
}
  toggleColumnMenu(): void {
    this.showColumnMenu = !this.showColumnMenu;
  }

  getUniqueLocations(): string[] {
    const locations = new Set<string>();
    
    if (this.userAllowedLocations.length === 0) {
      this.sales.forEach(sale => {
        if (sale.location || sale.businessLocation) {
          locations.add(sale.location || sale.businessLocation);
        }
      });
    } else {
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

  sortData(field?: string): void {
    if (field) {
      if (this.sortField === field) {
        this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        this.sortField = field;
        this.sortDirection = 'asc';
      }
    }

    if (this.sortField) {
      this.filteredSales.sort((a, b) => {
        let valueA: any;
        let valueB: any;

        switch (this.sortField) {
          case 'saleDate':
            valueA = new Date(a.saleDate || 0).getTime();
            valueB = new Date(b.saleDate || 0).getTime();
            break;
          case 'paymentAmount':
          case 'balance':
          case 'totalPayable':
          case 'shippingCharges':
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

  getSortIconClass(field: string): string {
    if (this.sortField !== field) {
      return 'fa-sort';
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

  formatCurrency(amount: number | string | undefined | null): string {
    const numAmount = Number(amount || 0);
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(numAmount);
  }

  exportCSV(): void {
    const headers = this.columns.map(col => col.header);
    
    const data = this.filteredSales.map((sale, index) => {
      const rowData: any = {};
      this.columns.forEach(col => {
        switch (col.field) {
          case 'S.No':
            rowData[col.header] = index + 1;
            break;
          case 'saleDate':
            rowData[col.header] = sale.saleDate ? new Date(sale.saleDate).toLocaleDateString() : 'N/A';
            break;
          case 'products':
            rowData[col.header] = this.getProductsDisplayText(sale.products);
            break;
          case 'paymentAmount':
          case 'balance':
          case 'totalPayable':
          case 'shippingCharges':
            rowData[col.header] = this.formatCurrency(sale[col.field]);
            break;
          default:
            rowData[col.header] = sale[col.field] ?? 'N/A';
        }
      });
      return rowData;
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
    // 1. Input Validation: Ensure the sale object is valid.
    if (!sale || !sale.id) {
      console.error('Error: Invalid sale object provided to completeSale.', sale);
      alert('Cannot complete the sale. Invalid data provided.');
      return;
    }

    if (!confirm(`Are you sure you want to complete this sale? This will reduce product stock.`)) {
      return;
    }

    console.log(`Starting to complete sale for Invoice #${sale.invoiceNo} (ID: ${sale.id})`);

    try {
      // 2. Update Sale Status: Mark the sale as 'Completed'.
      await this.saleService['updateSale'](sale.id, {
        status: 'Completed',
        updatedAt: new Date()
      });
      console.log(`Sale ${sale.id} status updated to 'Completed'.`);

      // 3. Stock Reduction Logic: Process each product in the sale.
      if (sale.products && sale.products.length > 0) {
        for (const product of sale.products) {
          const productId = product.productId || product.id;
          const locationId = sale.businessLocationId || sale.location; // Use correct location field
          const quantitySold = product.quantity;

          if (!productId || !locationId || !quantitySold || quantitySold <= 0) {
            console.warn('Skipping stock update for an invalid product entry:', product);
            continue;
          }

          console.log(`Reducing stock for Product ID: ${productId} at Location: ${locationId} by ${quantitySold} units.`);

          // THIS IS THE CRITICAL FIX: This service call handles the stock decrement
          // and triggers the daily snapshot update.
          await this.stockService.updateStockAfterSale(
            productId,
            locationId,
            quantitySold,
            'sale',   // The action type
            sale.id   // A reference to the sale for tracking
          );
        }
        console.log(`Stock reduction process finished for sale ${sale.id}.`);
      } else {
        console.warn(`Sale ${sale.id} has no products. No stock was updated.`);
      }

      // 4. User Feedback
      alert('Sale completed successfully! Stock has been updated.');

      // 5. Refresh Data
      this.loadSales();

    } catch (error) {
      // 6. Comprehensive Error Handling
      console.error(`An error occurred while completing sale ${sale.id}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      alert(`Failed to complete the sale. Error: ${errorMessage}`);
    }
  }
  
  private convertToCSV(data: any[], headers: string[]): string {
    const headerString = headers.join(',');
    const rowStrings = data.map(row => {
      headers.map(fieldName => {
        const value = row[fieldName] ?? '';
        return `"${String(value).replace(/"/g, '""')}"`;
      }).join(',')
    });
    
    return [headerString, ...rowStrings].join('\n');
  }
ngOnInit(): void {
  this.loading = true;

  // 1. Load all reference data in parallel
  const refDataSub = forkJoin({
    locations: this.locationService.getLocations().pipe(take(1)),
    services: this.typeOfServiceService.getServicesRealtime().pipe(take(1)),
    users: this.userService.getUsers().pipe(take(1)),
    taxes: this.taxService.getTaxRates().pipe(take(1))
  }).subscribe({
    next: (data) => {
      this.businessLocations = data.locations;
      this.serviceTypes = data.services;
      this.users = data.users.map(u => ({
        id: u.id,
        displayName: u.displayName || u.username || u.email
      }));
      this.availableTaxRates = data.taxes;

      // 2. Now that we have Names for the IDs, load the Sales
      this.checkAuthAndLoadSales();
    },
    error: (err) => {
      console.error("Error loading reference data", err);
      this.loading = false;
    }
  });
  this.subscriptions.push(refDataSub);

  // Initialize modals
  setTimeout(() => {
    try {
      this.viewSaleModal = new bootstrap.Modal(document.getElementById('viewSaleModal')!);
      this.modal = new bootstrap.Modal(document.getElementById('saleDetailsModal')!);
      this.invoiceModal = new bootstrap.Modal(document.getElementById('invoiceModal')!);
      this.printModal = new bootstrap.Modal(document.getElementById('printInvoiceModal')!);
    } catch (e) { console.error("Modal init error", e); }
  }, 500);

  // Product deep-link filter
  this.route.queryParams.subscribe(params => {
    if (params['productId']) {
      this.filters.productId = params['productId'];
      this.productFilterName = params['productName'] || '';
      if(this.authService.isLoggedIn()) this.loadSales(); 
    }
  });
}

private checkAuthAndLoadSales(): void {
  this.authService.authState$.pipe(take(1)).subscribe(user => {
    if (user) {
      this.userAllowedLocations = this.authService.getUserAllowedLocations();
      this.loadSales();
    } else {
      this.loading = false;
      this.error = "Please login to continue.";
      this.cdr.detectChanges();
    }
  });
}
  exportExcel(): void {
    const headers = this.columns.map(col => col.header);
    
    const data = this.filteredSales.map((sale, index) => {
      const rowData: any[] = [];
      this.columns.forEach(col => {
        switch (col.field) {
          case 'S.No':
            rowData.push(index + 1);
            break;
          case 'saleDate':
            rowData.push(sale.saleDate ? new Date(sale.saleDate).toLocaleDateString() : 'N/A');
            break;
          case 'products':
            rowData.push(this.getProductsDisplayText(sale.products));
            break;
          case 'paymentAmount':
          case 'balance':
          case 'totalPayable':
          case 'shippingCharges':
             rowData.push(this.formatCurrency(sale[col.field]));
            break;
          default:
            rowData.push(sale[col.field] ?? 'N/A');
        }
      });
      return rowData;
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
    const headers = this.columns.map(col => col.header);
    
    const data = this.filteredSales.map((sale, index) => {
      const rowData: any[] = [];
      this.columns.forEach(col => {
        switch (col.field) {
          case 'S.No':
            rowData.push(index + 1);
            break;
          case 'saleDate':
            rowData.push(sale.saleDate ? new Date(sale.saleDate).toLocaleDateString() : 'N/A');
            break;
          case 'products':
            rowData.push(this.getProductsDisplayText(sale.products));
            break;
          case 'paymentAmount':
          case 'balance':
          case 'totalPayable':
          case 'shippingCharges':
             rowData.push(this.formatCurrency(sale[col.field]));
            break;
          default:
            rowData.push(sale[col.field] ?? 'N/A');
        }
      });
      return rowData;
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
          markAsReturned: true
        }
      });
    }
  }
}