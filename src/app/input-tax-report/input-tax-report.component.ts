import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { DatePipe, formatDate } from '@angular/common'; // Fixed combined import and added formatDate
import { PurchaseService } from '../services/purchase.service';
import { ExpenseService, Expense as RawExpense } from '../services/expense.service';
import { SupplierService } from '../services/supplier.service';
import { TaxService } from '../services/tax.service';
import { TaxRate } from '../tax/tax.model';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { JournalService } from '../services/journal.service';
import { PurchaseReturnService } from '../services/purchase-return.service';


interface Journal {
  id: string;
  type: 'journal';
  date: string;
  referenceNo: string;
  businessLocationName: string;
  expenseFor: string;
  categoryName: string;
  paymentMethod: string;
  totalAmount: number;
  taxAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  paymentStatus: string;
  taxRate?: number;
}

// TaxEntry now supports Purchase Returns
type TaxEntry = Purchase | Expense | Journal | PurchaseReturnEntry;

interface Purchase {
  id: string;
  type: 'purchase';
  purchaseDate: string;
  referenceNo: string;
  invoiceNo: string;
  businessLocation: string;
  supplier: string;
  purchaseStatus: string;
  paymentMethod: string;
  totalTax: number;
  cgst: number;
  sgst: number;
  igst: number;
  grandTotal: number;
  paymentDue: number;
  taxRate: number; 
}

interface PurchaseReturnEntry {
  id: string;
  type: 'return';
  date: string;
  referenceNo: string;
  parentReference: string;
  businessLocation: string;
  supplier: string;
  status: string;
  totalTax: number; // Negative
  cgst: number; // Negative
  sgst: number; // Negative
  igst: number; // Negative
  grandTotal: number; // Negative
  taxRate: number;
}

interface Expense {
  id: string;
  type: 'expense';
  date: string;
  referenceNo: string;
  businessLocationName: string;
  expenseFor: string;
  categoryName: string;
  paymentMethod: string;
  totalAmount: number;
  taxAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  paymentStatus: string;
  taxRate?: number;
}

interface SummaryData {
  totalEntries: number;
  totalAmount: number;
  totalTax: number;
  totalCGST: number;
  totalSGST: number;
  totalIGST: number;
  totalSubtotal: number;
}

@Component({
  selector: 'app-input-tax-report',
  templateUrl: './input-tax-report.component.html',
  styleUrls: ['./input-tax-report.component.scss'],
  providers: [DatePipe]
})
export class InputTaxReportComponent implements OnInit {
  allEntries: TaxEntry[] = [];
  filteredEntries: TaxEntry[] = [];
  paginatedEntries: TaxEntry[] = [];
  
  @ViewChild('startDatePicker') startDatePicker!: ElementRef;
@ViewChild('endDatePicker') endDatePicker!: ElementRef;
  isLoading = true;
  itemsPerPage = 25;
  currentPage = 1;
  totalPages = 1;

  sortColumn = 'date';
  sortDirection: 'asc' | 'desc' = 'desc';
  
  summaryData: SummaryData = {
    totalEntries: 0, totalAmount: 0, totalTax: 0, totalCGST: 0,
    totalSGST: 0, totalIGST: 0, totalSubtotal: 0
  };
  
  dateFilter = { startDate: '', endDate: '' };
  supplierFilter = '';
  taxRateFilter = '';
  uniqueSuppliers: string[] = [];
  taxRates: TaxRate[] = [];

  constructor(
    private purchaseService: PurchaseService,
    private expenseService: ExpenseService,
    private supplierService: SupplierService,
    private taxService: TaxService,
    private journalService: JournalService,
    private returnService: PurchaseReturnService, // ✅ ADDED
    private datePipe: DatePipe
  ) {}
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
        this.dateFilter.startDate = formattedDate;
      } else {
        this.dateFilter.endDate = formattedDate;
      }
      this.applyFilters(); // Re-trigger filter
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
  const value = type === 'start' ? this.dateFilter.startDate : this.dateFilter.endDate;
  event.target.value = this.getFormattedDateForInput(value);
}
  ngOnInit(): void {
    this.loadTaxRates();
    this.loadSuppliers();
    this.loadData();
  }

  loadData(): void {
    this.isLoading = true;
    this.allEntries = [];
    
    Promise.all([
      this.loadPurchases(), 
      this.loadExpenses(),
      this.loadJournals(),
      this.loadPurchaseReturns() // ✅ ADDED
    ])
      .then(() => {
        this.applyFilters();
        this.isLoading = false;
      })
      .catch(error => {
        console.error('Error loading data:', error);
        this.isLoading = false;
      });
  }

  private loadPurchases(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.purchaseService.getPurchases().subscribe({
        next: (purchases: any[]) => {
          const normalized = purchases.flatMap(p => this.normalizePurchase(p));
          this.allEntries.push(...normalized);
          resolve();
        },
        error: (error) => reject(error)
      });
    });
  }

/**
   * ✅ FIXED: Aligns tax calculation logic with Add/Edit Purchase screens.
   * Ensures Subtotal is (Base Price * Qty) and Tax is (Total - Subtotal).
   */
  private normalizePurchase(p: any): Purchase[] {
    const entries: Purchase[] = [];
    const products = p.products || [];

    const taxGroups = products.reduce((acc: any, item: any) => {
      const rate = parseFloat(item.taxRate) || 0;
      const qty = parseFloat(item.quantity) || 0;
      const unitCostBeforeTax = parseFloat(item.unitCostBeforeTax) || 0;
      const discountPercent = parseFloat(item.discountPercent) || 0;

      // 1. Calculate the precise price after discount
      const discPrice = unitCostBeforeTax * (1 - (discountPercent / 100));
      
      // 2. Calculate rounded unit price after tax (Visual Match: 104.75)
      const unitPriceAfterTax = discPrice * (1 + (rate / 100));
      const roundedUnitPriceAfterTax = Math.round(unitPriceAfterTax * 100) / 100;

      // 3. Calculate Line Total (Matches screen: 104,750.00)
      const lineTotal = qty * roundedUnitPriceAfterTax;
      
      // 4. ✅ THE KEY FIX: Subtotal must be (Price * Qty) 
      // Do NOT back-calculate using division here.
      const lineSubtotal = qty * discPrice; // 1000 * 99.76 = 99,760.00
      
      // 5. Tax is the difference (104,750 - 99,760 = 4,990.00)
      const lineTax = lineTotal - lineSubtotal; 
      
      if (!acc[rate]) {
        acc[rate] = { subtotal: 0, tax: 0, cgst: 0, sgst: 0, igst: 0 };
      }
      
      acc[rate].subtotal += lineSubtotal;
      acc[rate].tax += lineTax;
      
      const isInterState = p.isInterState || false;
      if (isInterState) {
        acc[rate].igst += lineTax;
      } else {
        acc[rate].cgst += lineTax / 2;
        acc[rate].sgst += lineTax / 2;
      }
      return acc;
    }, {});

    const rates = Object.keys(taxGroups);

    if (rates.length === 0) {
      const total = Number(p.grandTotal) || Number(p.roundedTotal) || 0;
      const tax = Number(p.totalTax) || 0;
      entries.push(this.createPurchaseEntry(p, tax, p.cgst || 0, p.sgst || 0, p.igst || 0, total, 0));
    } else {
      rates.forEach(rateStr => {
        const rate = parseFloat(rateStr);
        const group = taxGroups[rateStr];
        const groupTotal = group.subtotal + group.tax;
        
        entries.push(this.createPurchaseEntry(
          p, 
          parseFloat(group.tax.toFixed(2)), 
          parseFloat(group.cgst.toFixed(2)), 
          parseFloat(group.sgst.toFixed(2)), 
          parseFloat(group.igst.toFixed(2)), 
          parseFloat(groupTotal.toFixed(2)), 
          rate
        ));
      });
    }
    return entries;
  }
  private createPurchaseEntry(p: any, tax: number, cgst: number, sgst: number, igst: number, total: number, rate: number): Purchase {
    return {
      id: p.id,
      type: 'purchase',
      purchaseDate: this.formatDate(p.purchaseDate),
      referenceNo: p.referenceNo || 'N/A',
      invoiceNo: p.invoiceNo || 'N/A',
      businessLocation: p.businessLocation || 'N/A',
      supplier: this.getSupplierDisplayName(p.supplier) || p.supplierName || 'N/A',
      purchaseStatus: p.purchaseStatus || 'N/A',
      paymentMethod: p.paymentMethod || 'N/A',
      totalTax: tax,
      cgst: cgst,
      sgst: sgst,
      igst: igst,
      grandTotal: total,
      paymentDue: p.paymentDue || 0,
      taxRate: rate
    };
  }

  /**
   * ✅ NEW: Load and split Purchase Returns by tax rate (NEGATED)
   */
  private loadPurchaseReturns(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.returnService.getPurchaseReturns().subscribe({
        next: (returns: any[]) => {
          const normalized = returns.flatMap(ret => this.normalizeReturn(ret));
          this.allEntries.push(...normalized);
          resolve();
        },
        error: (error) => reject(error)
      });
    });
  }

  private normalizeReturn(ret: any): PurchaseReturnEntry[] {
    const entries: PurchaseReturnEntry[] = [];
    const products = ret.products || [];

    const taxGroups = products.reduce((acc: any, item: any) => {
      const rate = parseFloat(item.taxRate) || 0;
      if (!acc[rate]) {
        acc[rate] = { tax: 0, subtotal: 0 };
      }
      acc[rate].tax += parseFloat(item.taxAmount) || 0;
      acc[rate].subtotal += parseFloat(item.subtotal) || 0;
      return acc;
    }, {});

    Object.keys(taxGroups).forEach(rateStr => {
      const rate = parseFloat(rateStr);
      const group = taxGroups[rateStr];
      const tax = group.tax;
      const total = group.subtotal + tax;

      entries.push({
        id: ret.id,
        type: 'return',
        date: this.formatDate(ret.returnDate),
        referenceNo: ret.referenceNo || 'N/A',
        parentReference: ret.parentPurchaseRef || '',
        businessLocation: ret.businessLocation || 'N/A',
        supplier: ret.supplier || 'N/A',
        status: ret.returnStatus || 'Completed',
        taxRate: rate,
        // ✅ NEGATE VALUES for report
        totalTax: -tax,
        cgst: -(tax / 2),
        sgst: -(tax / 2),
        igst: 0,
        grandTotal: -total
      });
    });

    return entries;
  }

  private loadJournals(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.journalService.getJournals().subscribe({
        next: (journals: any[]) => {
          const journalsWithTax = journals.filter(journal => {
            return journal.items?.some((item: any) => item.accountType === 'tax_rate');
          });
          this.allEntries.push(...journalsWithTax.map(j => this.normalizeJournal(j)));
          resolve();
        },
        error: (error) => reject(error)
      });
    });
  }

  private normalizeJournal(j: any): any {
    const taxItem = j.items?.find((item: any) => item.accountType === 'tax_rate');
    const expenseItem = j.items?.find((item: any) => item.accountType === 'expense_category');
    const accountItem = j.items?.find((item: any) => item.accountType === 'account');
    
    const taxAmount = taxItem ? (taxItem.debit || taxItem.credit || 0) : 0;
    const baseAmount = expenseItem ? (expenseItem.debit || 0) : 0;
    
    let taxRate = 0;
    if (baseAmount > 0) taxRate = (taxAmount / baseAmount) * 100;
    
    return {
      id: j.id,
      type: 'journal' as const,
      date: this.formatDate(j.date),
      referenceNo: j.reference || 'N/A',
      businessLocationName: 'N/A',
      expenseFor: j.description || 'Journal Entry',
      categoryName: expenseItem?.accountName || 'Journal Entry',
      paymentMethod: accountItem?.accountName || 'Journal',
      totalAmount: baseAmount + taxAmount,
      taxAmount: taxAmount,
      cgstAmount: taxAmount / 2,
      sgstAmount: taxAmount / 2,
      igstAmount: 0,
      paymentStatus: 'Paid',
      taxRate: taxRate
    };
  }

  loadTaxRates(): void {
    this.taxService.getTaxRates().subscribe({
      next: (rates) => this.taxRates = rates.filter(r => r.active).sort((a, b) => a.rate - b.rate)
    });
  }

  private loadExpenses(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.expenseService.getExpenses().subscribe({
        next: (expenses: RawExpense[]) => {
          this.allEntries.push(...expenses.filter(e => e.taxAmount && e.taxAmount > 0).map(e => this.normalizeExpense(e)));
          resolve();
        },
        error: (error) => reject(error)
      });
    });
  }

  private normalizeExpense(e: RawExpense): Expense {
    const tax = e.taxAmount || 0;
    const base = e.totalAmount || 0;
    let rate = 0;
    if (base > 0) rate = (tax / base) * 100;

    return {
      id: e.id!,
      type: 'expense',
      date: this.formatDate(e.date),
      referenceNo: e.referenceNo || 'N/A',
      businessLocationName: e.businessLocationName || 'N/A',
      expenseFor: e.expenseFor || 'N/A',
      categoryName: e.expenseCategoryName || 'N/A',
      paymentMethod: e.paymentMethod || 'N/A',
      totalAmount: base + tax,
      taxAmount: tax,
      cgstAmount: tax / 2,
      sgstAmount: tax / 2,
      igstAmount: 0,
      paymentStatus: 'Paid',
      taxRate: rate
    };
  }

  loadSuppliers(): void {
    this.supplierService.getSuppliers().subscribe({
      next: (suppliers: any[]) => {
        this.uniqueSuppliers = [...new Set(suppliers.map(s => this.getSupplierDisplayName(s)).filter(Boolean))].sort();
      }
    });
  }

  applyFilters(): void {
    let filtered = [...this.allEntries];

    if (this.dateFilter.startDate || this.dateFilter.endDate) {
      filtered = filtered.filter(entry => {
        const entryDate = new Date(this.getEntryDate(entry)).getTime();
        const start = this.dateFilter.startDate ? new Date(this.dateFilter.startDate).getTime() : 0;
        const end = this.dateFilter.endDate ? new Date(this.dateFilter.endDate).getTime() : Date.now();
        return entryDate >= start && entryDate <= end;
      });
    }

    if (this.supplierFilter) {
      filtered = filtered.filter(entry => this.getEntrySupplier(entry).includes(this.supplierFilter));
    }

    if (this.taxRateFilter) {
      const selectedRate = parseFloat(this.taxRateFilter);
      filtered = filtered.filter(entry => Math.abs(this.getEntryTaxPercentage(entry) - selectedRate) < 0.1);
    }

    filtered.sort((a, b) => this.sortData(a, b));
    this.filteredEntries = filtered;
    this.totalPages = Math.ceil(this.filteredEntries.length / this.itemsPerPage);
    this.calculateSummary();
    this.changePage(1);
  }

  private sortData(a: TaxEntry, b: TaxEntry): number {
    let valueA: any, valueB: any;
    switch (this.sortColumn) {
        case 'date': valueA = new Date(this.getEntryDate(a)).getTime(); valueB = new Date(this.getEntryDate(b)).getTime(); break;
        case 'totalAmount': valueA = this.getEntryTotalAmount(a); valueB = this.getEntryTotalAmount(b); break;
        case 'totalTax': valueA = this.getEntryTaxAmount(a); valueB = this.getEntryTaxAmount(b); break;
        case 'taxPercentage': valueA = this.getEntryTaxPercentage(a); valueB = this.getEntryTaxPercentage(b); break;
        default: valueA = (a as any)[this.sortColumn] || ''; valueB = (b as any)[this.sortColumn] || '';
    }
    if (valueA < valueB) return this.sortDirection === 'asc' ? -1 : 1;
    if (valueA > valueB) return this.sortDirection === 'asc' ? 1 : -1;
    return 0;
  }

  calculateSummary(): void {
    const summary = { totalSubtotal: 0, totalTax: 0, totalCGST: 0, totalSGST: 0, totalIGST: 0, totalAmount: 0 };
    for (const entry of this.filteredEntries) {
        const totalAmount = this.getEntryTotalAmount(entry);
        const totalTax = this.getEntryTaxAmount(entry);
        summary.totalSubtotal += totalAmount - totalTax;
        summary.totalTax += totalTax;
        summary.totalCGST += this.getEntryCGST(entry);
        summary.totalSGST += this.getEntrySGST(entry);
        summary.totalIGST += this.getEntryIGST(entry);
        summary.totalAmount += totalAmount;
    }
    this.summaryData = { ...summary, totalEntries: this.filteredEntries.length };
  }

  resetFilters(): void {
    this.dateFilter = { startDate: '', endDate: '' };
    this.supplierFilter = '';
    this.taxRateFilter = '';
    this.applyFilters();
  }

  sortTable(column: string): void {
    this.sortDirection = this.sortColumn === column && this.sortDirection === 'asc' ? 'desc' : 'asc';
    this.sortColumn = column;
    this.applyFilters();
  }

  changePage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    const start = (this.currentPage - 1) * this.itemsPerPage;
    this.paginatedEntries = this.filteredEntries.slice(start, start + this.itemsPerPage);
  }

  getEntryDate(entry: TaxEntry): string { 
    if (entry.type === 'purchase') return entry.purchaseDate;
    return entry.date; 
  }

  getEntryLocation(entry: TaxEntry): string { 
    if (entry.type === 'purchase') return entry.businessLocation;
    if (entry.type === 'return') return entry.businessLocation;
    return entry.businessLocationName; 
  }

  getEntrySupplier(entry: TaxEntry): string {
    if (entry.type === 'purchase') return `${entry.supplier} (Inv: ${entry.invoiceNo})`;
    if (entry.type === 'return') return `${entry.supplier} (Ret: ${entry.referenceNo})`;
    if (entry.type === 'journal') return 'Journal Entry';
    return entry.expenseFor;
  }

  getEntryStatus(entry: TaxEntry): string { 
    if (entry.type === 'purchase') return entry.purchaseStatus;
    if (entry.type === 'return') return entry.status;
    return entry.paymentStatus; 
  }

  getEntryTotalAmount(entry: TaxEntry): number { 
    if (entry.type === 'purchase') return entry.grandTotal;
    if (entry.type === 'return') return entry.grandTotal;
    return entry.totalAmount; 
  }

  getEntryTaxAmount(entry: TaxEntry): number { 
    if (entry.type === 'purchase') return entry.totalTax;
    if (entry.type === 'return') return entry.totalTax;
    return entry.taxAmount; 
  }

  getEntryCGST(entry: TaxEntry): number { 
    if (entry.type === 'purchase') return entry.cgst;
    if (entry.type === 'return') return entry.cgst;
    return entry.cgstAmount; 
  }

  getEntrySGST(entry: TaxEntry): number { 
    if (entry.type === 'purchase') return entry.sgst;
    if (entry.type === 'return') return entry.sgst;
    return entry.sgstAmount; 
  }

  getEntryIGST(entry: TaxEntry): number { 
    if (entry.type === 'purchase') return entry.igst;
    if (entry.type === 'return') return entry.igst;
    return entry.igstAmount; 
  }

  getEntryPaymentDue(entry: TaxEntry): number { 
    return entry.type === 'purchase' ? entry.paymentDue : 0; 
  }

  getSupplierDisplayName(supplier: any): string {
    if (!supplier) return '';
    return supplier.isIndividual ? `${supplier.firstName || ''} ${supplier.lastName || ''}`.trim() : supplier.businessName || '';
  }

  getEntryTaxPercentage(entry: TaxEntry): number { return entry.taxRate || 0; }

  getEntryTaxDisplay(entry: TaxEntry): string {
    const rate = this.getEntryTaxPercentage(entry);
    if (rate === 0) return '0.00%';
    const matched = this.taxRates.find(r => Math.abs(r.rate - rate) < 0.1);
    return matched ? `${matched.name} (${rate.toFixed(2)}%)` : `${rate.toFixed(2)}%`;
  }

  getSortIcon(column: string): string {
    if (this.sortColumn !== column) return 'fa-sort';
    return this.sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
  }

  getStatusClass(status: string | undefined): string {
    if (!status) return 'badge-secondary';
    const s = status.toLowerCase();
    if (s === 'received' || s === 'paid' || s === 'completed') return 'badge-success';
    if (s === 'pending' || s === 'due') return 'badge-warning';
    return 'badge-secondary';
  }

  getPages(): (number | string)[] {
    const pages: (number | string)[] = [];
    for (let i = 1; i <= this.totalPages; i++) pages.push(i);
    return pages;
  }

  private formatDate(date: any): string {
    if (!date) return 'N/A';
    const jsDate = (date.toDate && typeof date.toDate === 'function') ? date.toDate() : new Date(date);
    return this.datePipe.transform(jsDate, 'yyyy-MM-dd') || 'N/A';
  }

  exportToExcel(): void {
    const data = this.filteredEntries.map(e => ({
      'Date': this.getEntryDate(e),
      'To Location': this.getEntryLocation(e),
      'Supplier': this.getEntrySupplier(e),
      'Status': this.getEntryStatus(e),
      'Tax': this.getEntryTaxAmount(e),
      'CGST': this.getEntryCGST(e),
      'SGST': this.getEntrySGST(e),
      'IGST': this.getEntryIGST(e),
      'Tax %': this.getEntryTaxDisplay(e),
      'Total Amount': this.getEntryTotalAmount(e)
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = { Sheets: { 'data': ws }, SheetNames: ['data'] };
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([excelBuffer], { type: 'application/octet-stream' }), 'InputTaxReport.xlsx');
  }
}