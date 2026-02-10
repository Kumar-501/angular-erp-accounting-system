import { SaleService } from '../services/sale.service';
import { ExpenseService } from '../services/expense.service';
import { Observable, BehaviorSubject, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import * as XLSX from 'xlsx';
import { JournalService } from '../services/journal.service';
import { OutputTaxService } from '../services/output-tax.service';
import { TaxService } from '../services/tax.service';
import { TaxRate } from '../tax/tax.model';
import { Component, OnInit, ViewChild, ElementRef } from '@angular/core'; // Added ViewChild, ElementRef

interface ReportEntry {
  id: string;
  entryType: 'Sale' | 'Income' | 'Return';
  customer: string;
  invoiceNo: string;
  totalPayable: number;
  saleDate: string | Date;
  taxAmount: number;
  taxDetails: {
    cgst: number;
    sgst: number;
    igst: number;
    total: number;
  };
  products?: any[];
  orderNo?: string;
  paymentStatus?: string;
}

interface FilterOptions {
  dateRange: { startDate: string; endDate: string; };
  quickDateFilter?: string;
}

@Component({
  selector: 'app-output-tax-report',
  templateUrl: './output-tax-report.component.html',
  styleUrls: ['./output-tax-report.component.scss']
})
export class OutputTaxReportComponent implements OnInit {
  allSalesData$ = new BehaviorSubject<ReportEntry[]>([]);
  filteredSales$!: Observable<ReportEntry[]>;
  @ViewChild('startDatePicker') startDatePicker!: ElementRef;
@ViewChild('endDatePicker') endDatePicker!: ElementRef;
  currentPage = 1;
  pageSize = 10;
  sortColumn = 'saleDate';
  sortDirection: 'asc' | 'desc' = 'desc';
  
  isSaving = false;
  saveSuccess = false;
  saveError: string | null = null;
  searchTerm$ = new BehaviorSubject<string>('');
  
  taxRates: TaxRate[] = [];
  taxRateFilter = '';

  filterOptions: FilterOptions = {
    dateRange: { startDate: '', endDate: '' }
  };

  columnVisibility = {
    date: true,
    type: true,
    invoiceNo: true,
    customer: true,
    taxableAmount: true,
    cgst: true,
    sgst: true,
    igst: true,
    totalTax: true,
    taxPercentage: true,
    totalAmount: true
  };

  Math = Math;
  Object = Object;

  constructor(
    private saleService: SaleService,
    private outputTaxService: OutputTaxService,
    private journalService: JournalService,
    private expenseService: ExpenseService,
    private taxService: TaxService,
  ) {}

  ngOnInit(): void {
    this.loadTaxRates();
    this.loadReportData();
    this.setupFilter();
  }

  toggleColumn(colKey: keyof typeof this.columnVisibility): void {
    this.columnVisibility[colKey] = !this.columnVisibility[colKey];
  }

  getVisibleColumnCount(): number {
    return Object.values(this.columnVisibility).filter(v => v).length;
  }

  loadTaxRates(): void {
    this.taxService.getTaxRates().subscribe({
      next: (rates) => this.taxRates = rates.filter(r => r.active).sort((a, b) => a.rate - b.rate),
      error: (err) => console.error('Error loading tax rates:', err)
    });
  }
getFormattedDateForInput(dateString: any): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

// 2. Trigger the hidden native picker
openDatePicker(type: 'start' | 'end'): void {
  if (type === 'start') {
    this.startDatePicker.nativeElement.showPicker();
  } else {
    this.endDatePicker.nativeElement.showPicker();
  }
}

// 3. Handle manual entry with validation
onManualDateInput(event: any, type: 'start' | 'end'): void {
  const input = event.target.value.trim();
  const datePattern = /^(\d{2})-(\d{2})-(\d{4})$/;
  const match = input.match(datePattern);
  
  if (match) {
    const day = match[1];
    const month = match[2];
    const year = match[3];
    
    const dateObj = new Date(`${year}-${month}-${day}`);
    if (dateObj && dateObj.getDate() === parseInt(day) && 
        dateObj.getMonth() + 1 === parseInt(month)) {
      
      const formattedDate = `${year}-${month}-${day}`; // Internal ISO string
      if (type === 'start') {
        this.filterOptions.dateRange.startDate = formattedDate;
      } else {
        this.filterOptions.dateRange.endDate = formattedDate;
      }
      this.setupFilter(); // Re-trigger filter
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
  const value = type === 'start' ? this.filterOptions.dateRange.startDate : this.filterOptions.dateRange.endDate;
  event.target.value = this.getFormattedDateForInput(value);
}
  loadReportData(): void {
    const sales$ = this.saleService.listenForSales({});
    const incomes$ = this.expenseService.getIncomes();
    const journals$ = this.journalService.getJournals();
    const returns$ = this.saleService.getReturns(); 

    combineLatest([sales$, incomes$, journals$, returns$]).subscribe(
      ([sales, incomes, journals, returns]) => {
        const mappedSales: ReportEntry[] = [];
        sales.forEach(sale => mappedSales.push(...this.mapSaleToReportEntries(sale)));
        
        // -------------------------------------------------------------
        // FIX: Strict filtering for Output Tax Report
        // -------------------------------------------------------------
        const taxableIncomes = incomes.filter(inc => {
          const hasTax = Number(inc.taxAmount) > 0;
          
          // Check if this is truly an Income type
          // 1. Check explicit type property
          // 2. Check if accountHead string contains 'Income'
          // 3. Exclude if type is 'expense'
          const isIncomeType = (inc.type === 'income') || 
                               (inc.accountHead && String(inc.accountHead).startsWith('Income'));
          
          const isExpenseType = (inc.type === 'expense') || 
                                (inc.accountHead && String(inc.accountHead).startsWith('Expense'));

          return hasTax && isIncomeType && !isExpenseType;
        });

        const mappedIncomes = taxableIncomes.map(this.mapIncomeToReportEntry.bind(this));
        
        const mappedJournals = this.extractOutputTaxFromJournals(journals);
        const mappedReturns = returns.map(this.mapReturnToReportEntry.bind(this));
        
        const combinedData = [...mappedSales, ...mappedIncomes, ...mappedJournals, ...mappedReturns];
        this.allSalesData$.next(combinedData);
      },
      error => console.error('Error loading report data:', error)
    );
  }

  private mapSaleToReportEntries(sale: any): ReportEntry[] {
    const saleDate = sale.saleDate?.toDate ? sale.saleDate.toDate() : new Date(sale.saleDate);
    const entries: ReportEntry[] = [];
    
    // Ignore invalid entries
    if (Number(sale.totalPayable) === 0 && sale.status !== 'Returned') return [];

    const groups: { [key: string]: any } = {};

    if (sale.products && Array.isArray(sale.products)) {
      sale.products.forEach((p: any) => {
        const qty = Number(p.quantity) || 0;
        if (qty > 0) {
          const rate = Number(p.taxRate) || 0;
          const isIgst = p.taxType === 'IGST';
          const key = `${rate}_${isIgst ? 'IGST' : 'GST'}`;

          const unitPriceMRP = Number(p.unitPrice) || 0;
          const lineTotalWithTax = unitPriceMRP * qty;
          const disc = Number(p.discount) || 0;
          
          const finalLineTotal = lineTotalWithTax - disc;
          
          const taxableValue = finalLineTotal / (1 + (rate / 100));
          const taxAmt = finalLineTotal - taxableValue;

          if (!groups[key]) groups[key] = { taxable: 0, cgst: 0, sgst: 0, igst: 0, rate: rate };
          
          groups[key].taxable += taxableValue;
          if (isIgst) groups[key].igst += taxAmt;
          else {
            groups[key].cgst += taxAmt / 2;
            groups[key].sgst += taxAmt / 2;
          }
        }
      });
    }

    Object.keys(groups).forEach(key => {
      const g = groups[key];
      const t = g.cgst + g.sgst + g.igst;
      entries.push({
        id: `${sale.id}_${key}`,
        entryType: 'Sale',
        saleDate,
        invoiceNo: sale.invoiceNo || 'N/A',
        customer: sale.customer || 'N/A',
        totalPayable: parseFloat((g.taxable + t).toFixed(2)),
        taxAmount: parseFloat(t.toFixed(2)),
        taxDetails: { 
          cgst: parseFloat(g.cgst.toFixed(2)), 
          sgst: parseFloat(g.sgst.toFixed(2)), 
          igst: parseFloat(g.igst.toFixed(2)), 
          total: parseFloat(t.toFixed(2)) 
        },
        orderNo: sale.orderNo || 'N/A'
      });
    });

    const ship = Number(sale.shippingCharges) || 0;
    const shipTax = Number(sale.shippingTaxAmount) || 0;
    if ((ship + shipTax) > 0) {
        const isIgst = Number(sale.igstAmount) > 0;
        const totalShip = ship + shipTax;
        entries.push({
            id: `${sale.id}_ship`,
            entryType: 'Sale',
            saleDate,
            invoiceNo: sale.invoiceNo || 'N/A',
            customer: sale.customer || 'N/A',
            totalPayable: parseFloat(totalShip.toFixed(2)),
            taxAmount: parseFloat(shipTax.toFixed(2)),
            taxDetails: { 
              cgst: isIgst ? 0 : parseFloat((shipTax/2).toFixed(2)), 
              sgst: isIgst ? 0 : parseFloat((shipTax/2).toFixed(2)), 
              igst: isIgst ? parseFloat(shipTax.toFixed(2)) : 0, 
              total: parseFloat(shipTax.toFixed(2)) 
            },
            orderNo: 'Shipping'
        });
    }

    return entries;
  }

  private mapReturnToReportEntry(ret: any): ReportEntry {
    const saleDate = ret.returnDate?.toDate ? ret.returnDate.toDate() : new Date(ret.returnDate);
    const taxReturned = Number(ret.totalTaxReturned) || 0;
    const totalRefund = Number(ret.totalRefund) || 0;
    const isIgst = !!ret.returnedItems?.some((i: any) => i.taxType === 'IGST');

    return {
      id: ret.id,
      entryType: 'Return',
      saleDate,
      invoiceNo: `RE-${ret.invoiceNo || 'N/A'}`,
      customer: ret.customer || 'N/A',
      totalPayable: -totalRefund,
      taxAmount: -taxReturned,
      taxDetails: {
        cgst: isIgst ? 0 : -(taxReturned / 2),
        sgst: isIgst ? 0 : -(taxReturned / 2),
        igst: isIgst ? -taxReturned : 0,
        total: -taxReturned
      },
      orderNo: `Ref: ${ret.invoiceNo}`
    };
  }

  private mapIncomeToReportEntry(income: any): ReportEntry {
    const taxAmount = Number(income.taxAmount) || 0;
    const isIgst = (income.applicableTax?.toLowerCase().includes('igst'));
    const incomeDate = income.date?.toDate ? income.date.toDate() : new Date(income.date);
    return {
      id: income.id,
      entryType: 'Income',
      saleDate: incomeDate,
      invoiceNo: income.referenceNo || 'N/A',
      customer: income.incomeForContact || income.incomeFor || 'N/A',
      totalPayable: income.totalAmount || 0,
      taxAmount: taxAmount,
      taxDetails: {
        cgst: isIgst ? 0 : taxAmount / 2,
        sgst: isIgst ? 0 : taxAmount / 2,
        igst: isIgst ? taxAmount : 0,
        total: taxAmount
      },
      orderNo: 'Income'
    };
  }

  private extractOutputTaxFromJournals(journals: any[]): ReportEntry[] {
    const entries: ReportEntry[] = [];
    journals.forEach(journal => {
      // For Output Tax, look for Tax Credit entries 
      // (Usually tax collected on income is Credited to Tax Liability)
      // However, typically journals show tax separated. 
      const taxItem = journal.items.find((item: any) => item.accountType === 'tax_rate');
      
      if (!taxItem) return;
      
      // Check if it's related to Income (Output Tax)
      // We look for a credit on an Income Category or similar structure
      const incomeItem = journal.items.find((item: any) => item.accountType === 'income_category');
      
      // If there is no income category involved, this might be input tax adjustment, skip it.
      if (!incomeItem) return;

      const taxAmount = Math.max(taxItem.debit || 0, taxItem.credit || 0);
      if (taxAmount === 0) return;
      
      const isIgst = (taxItem.accountName || '').toLowerCase().includes('igst');
      entries.push({
        id: journal.id,
        entryType: 'Income',
        saleDate: journal.date?.toDate ? journal.date.toDate() : new Date(journal.date),
        invoiceNo: journal.reference || 'N/A',
        customer: incomeItem?.accountName || 'Journal Entry',
        totalPayable: (incomeItem?.credit || 0) + taxAmount,
        taxAmount: taxAmount,
        taxDetails: {
          cgst: isIgst ? 0 : taxAmount / 2,
          sgst: isIgst ? 0 : taxAmount / 2,
          igst: isIgst ? taxAmount : 0,
          total: taxAmount
        },
        orderNo: 'Journal'
      });
    });
    return entries;
  }

  setupFilter(): void {
    this.filteredSales$ = this.allSalesData$.pipe(
      map(entries => {
        let filtered = [...entries];
        if (this.filterOptions.dateRange.startDate && this.filterOptions.dateRange.endDate) {
          filtered = this.filterEntriesByDate(filtered);
        }
        if (this.taxRateFilter) {
            const selectedRate = parseFloat(this.taxRateFilter);
            filtered = filtered.filter(e => Math.round(this.getEntryTaxPercentage(e)) === Math.round(selectedRate));
        }
        const term = this.searchTerm$.value.toLowerCase();
        if (term) {
          filtered = filtered.filter(e => e.invoiceNo?.toLowerCase().includes(term) || e.customer?.toLowerCase().includes(term));
        }
        return this.sortSalesData(filtered, this.sortColumn, this.sortDirection);
      })
    );
  }

  filterEntriesByDate(entries: ReportEntry[]): ReportEntry[] {
    const start = new Date(this.filterOptions.dateRange.startDate);
    const end = new Date(this.filterOptions.dateRange.endDate);
    end.setHours(23, 59, 59);
    return entries.filter(e => {
      const d = e.saleDate instanceof Date ? e.saleDate : new Date(e.saleDate);
      return d >= start && d <= end;
    });
  }

  sortData(column: string): void {
    if (this.sortColumn === column) this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    else { this.sortColumn = column; this.sortDirection = 'asc'; }
    this.setupFilter();
  }

  private sortSalesData(entries: ReportEntry[], column: string, direction: 'asc' | 'desc'): ReportEntry[] {
    return [...entries].sort((a, b) => {
      let vA: any = a[column as keyof ReportEntry];
      let vB: any = b[column as keyof ReportEntry];
      if (column === 'saleDate') { vA = new Date(a.saleDate).getTime(); vB = new Date(b.saleDate).getTime(); }
      if (vA < vB) return direction === 'asc' ? -1 : 1;
      if (vA > vB) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  }

  getEntryTaxPercentage(e: ReportEntry): number {
    const base = Math.abs(e.totalPayable) - Math.abs(e.taxAmount);
    return base <= 0 ? 0 : (Math.abs(e.taxAmount) / base) * 100;
  }

  getEntryTaxDisplay(e: ReportEntry): string {
    const rate = this.getEntryTaxPercentage(e);
    if (rate === 0) return '0.00%';
    const matched = this.taxRates.find(r => Math.abs(r.rate - rate) < 0.1);
    return matched ? `${matched.name} (${matched.rate}%)` : `${rate.toFixed(2)}%`;
  }

  getTotalCGST(entries: ReportEntry[]): number { return entries.reduce((s, e) => s + (e.taxDetails?.cgst || 0), 0); }
  getTotalSGST(entries: ReportEntry[]): number { return entries.reduce((s, e) => s + (e.taxDetails?.sgst || 0), 0); }
  getTotalIGST(entries: ReportEntry[]): number { return entries.reduce((s, e) => s + (e.taxDetails?.igst || 0), 0); }
  getTotalTax(entries: ReportEntry[]): number { return entries.reduce((s, e) => s + (e.taxDetails?.total || 0), 0); }
  getTotalAmount(entries: ReportEntry[]): number { return entries.reduce((s, e) => s + (e.totalPayable || 0), 0); }

  setQuickDateFilter(type: string): void {
    this.filterOptions.quickDateFilter = type;
    const today = new Date();
    if (type === 'today') { this.filterOptions.dateRange.startDate = this.filterOptions.dateRange.endDate = today.toISOString().split('T')[0]; }
    else if (type === 'thisMonth') {
        this.filterOptions.dateRange.startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        this.filterOptions.dateRange.endDate = today.toISOString().split('T')[0];
    }
    this.setupFilter();
  }

  getQuickDateLabel(f: any): string {
    return f === 'today' ? 'Today' : f === 'thisMonth' ? 'This Month' : 'Select Date Range';
  }

  exportToExcel(): void {
    this.filteredSales$.subscribe(entries => {
      const data = entries.map(e => ({
        'Date': new Date(e.saleDate).toLocaleDateString(),
        'Type': e.entryType,
        'Invoice': e.invoiceNo,
        'Customer': e.customer,
        'Taxable': e.totalPayable - e.taxAmount,
        'CGST': e.taxDetails.cgst,
        'SGST': e.taxDetails.sgst,
        'IGST': e.taxDetails.igst,
        'Total Tax': e.taxAmount,
        'Rate': this.getEntryTaxDisplay(e),
        'Total': e.totalPayable
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'TaxReport');
      XLSX.writeFile(wb, 'TaxReport.xlsx');
    }).unsubscribe();
  }

  async saveReport() { 
      // Existing save logic
  }

  trackBySaleId(index: number, entry: ReportEntry): string { return entry.id; }
}