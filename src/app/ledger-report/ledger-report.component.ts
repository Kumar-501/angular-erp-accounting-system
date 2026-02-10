// src/app/ledger-report/ledger-report.component.ts

import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AccountService } from '../services/account.service';
import { SaleService } from '../services/sale.service';
import { PurchaseService } from '../services/purchase.service';
import { ExpenseService } from '../services/expense.service';
import { ExpenseCategoriesService } from '../services/expense-categories.service';
import { TaxService } from '../services/tax.service';
import { TaxRate } from '../tax/tax.model';
import { Subscription } from 'rxjs';

// Interface to structure the final report data for the template
interface ReportData {
  transactions: any[];
  openingBalance: number;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
}

// Interface for ledger entry similar to Day Book
interface LedgerEntry {
  date: Date;
  voucher: string;
  entry: string;
  debit: number;
  credit: number;
  source: string;
  accountId?: string;
  description?: string;
}

@Component({
  selector: 'app-ledger-report',
  templateUrl: './ledger-report.component.html',
  styleUrls: ['./ledger-report.component.scss']
})
export class LedgerReportComponent implements OnInit, OnDestroy {
  filterForm!: FormGroup;
  @ViewChild('startDatePicker') startDatePicker!: ElementRef;
@ViewChild('endDatePicker') endDatePicker!: ElementRef;
  allAccounts: any[] = [];
  allTransactions: any[] = [];
  allSales: any[] = [];
  allPurchases: any[] = [];
  allExpenses: any[] = [];
  allIncomes: any[] = [];
  allExpenseCategories: any[] = [];
  allIncomeCategories: any[] = [];
  allTaxRates: TaxRate[] = [];
  
  reportData: ReportData | null = null;
  showReport = false;
  isLoading = true;
  selectedLedgerName = '';
  
  private accountsUnsubscribe!: () => void;
  private transactionsUnsubscribe!: () => void;
  private salesSubscription!: Subscription;
  // Removed purchasesSubscription since we're using Promise-based approach

  constructor(
    private fb: FormBuilder,
    private accountService: AccountService,
    private saleService: SaleService,
    private purchaseService: PurchaseService,
    private expenseService: ExpenseService,
    private categoriesService: ExpenseCategoriesService,
    private taxService: TaxService
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadInitialData();
  }

  ngOnDestroy(): void {
    if (this.accountsUnsubscribe) this.accountsUnsubscribe();
    if (this.transactionsUnsubscribe) this.transactionsUnsubscribe();
    if (this.salesSubscription) this.salesSubscription.unsubscribe();
    // purchasesSubscription is no longer needed since we're using Promise-based approach
  }

  initForm(): void {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    this.filterForm = this.fb.group({
      ledgerId: ['All', Validators.required],
      startDate: [this.formatDateForInput(firstDayOfMonth)],
      endDate: [this.formatDateForInput(today)]
    });
  }
  getFormattedDateForDisplay(dateString: any): string {
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
onManualDateInput(event: any, controlName: string): void {
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
      
      const formattedDate = `${year}-${month}-${day}`; // ISO format for internal form
      this.filterForm.get(controlName)?.setValue(formattedDate);
    } else {
      alert('Invalid date! Please enter a valid date in DD-MM-YYYY format.');
      this.resetVisibleInput(event, controlName);
    }
  } else if (input !== '') {
    alert('Format must be DD-MM-YYYY');
    this.resetVisibleInput(event, controlName);
  }
}

private resetVisibleInput(event: any, controlName: string): void {
  event.target.value = this.getFormattedDateForDisplay(this.filterForm.get(controlName)?.value);
}
  loadInitialData(): void {
    this.isLoading = true;
    Promise.all([
      this.loadAccounts(),
      this.loadAllTransactions(),
      this.loadCategories(),
      this.loadTaxRates(),
      this.loadAllSales(),
      this.loadAllPurchases()
    ]).then(() => {
      this.isLoading = false;
      this.onSubmit();
    }).catch(error => {
      console.error("Error loading initial data:", error);
      this.isLoading = false;
    });
  }

  loadAccounts(): Promise<void> {
    return new Promise((resolve) => {
      this.accountsUnsubscribe = this.accountService.getAccounts(accounts => {
        this.allAccounts = accounts.sort((a, b) => a.name.localeCompare(b.name));
        resolve();
      });
    });
  }

  loadAllTransactions(): Promise<void> {
    return new Promise((resolve) => {
      this.transactionsUnsubscribe = this.accountService.getAllTransactions(transactions => {
        this.allTransactions = transactions;
        resolve();
      });
    });
  }

  loadCategories(): Promise<void> {
    const incomePromise = new Promise<void>(resolve => {
      this.categoriesService.getIncomeCategories().subscribe(cats => {
        this.allIncomeCategories = cats;
        resolve();
      });
    });
    const expensePromise = new Promise<void>(resolve => {
      this.categoriesService.getExpenseCategories().subscribe(cats => {
        this.allExpenseCategories = cats;
        resolve();
      });
    });
    return Promise.all([incomePromise, expensePromise]).then(() => {});
  }

  loadTaxRates(): Promise<void> {
    return new Promise<void>(resolve => {
      this.taxService.getTaxRates().subscribe(rates => {
        this.allTaxRates = rates;
        resolve();
      });
    });
  }

  loadAllSales(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.salesSubscription = this.saleService.listenForSales().subscribe(sales => {
        this.allSales = sales;
        resolve();
      });
    });
  }

  loadAllPurchases(): Promise<void> {
    return new Promise<void>((resolve) => {
      // If listenForPurchases doesn't exist, use getPurchasesByDateRange with a wide date range
      const startDate = new Date(2020, 0, 1); // Start from a very early date
      const endDate = new Date(2030, 11, 31); // End at a future date
      
      this.purchaseService.getPurchasesByDateRange(startDate, endDate).then((purchases: any[]) => {
        this.allPurchases = purchases;
        resolve();
      }).catch((error: any) => {
        console.error('Error loading purchases:', error);
        this.allPurchases = [];
        resolve();
      });
    });
  }

  private getPreciseTransactionDate(transaction: any): Date {
    const dateSource = transaction.date || transaction.createdAt || transaction.paidOn || transaction.transactionTime;
    if (!dateSource) return new Date();
    return dateSource.toDate ? dateSource.toDate() : new Date(dateSource);
  }

  private getAccountOrCategoryName(accountId: string): string {
    const account = this.allAccounts.find(a => a.id === accountId);
    if (account) return account.name;
    
    const expenseCat = this.allExpenseCategories.find(c => c.id === accountId);
    if (expenseCat) return expenseCat.categoryName;
    
    const incomeCat = this.allIncomeCategories.find(c => c.id === accountId);
    if (incomeCat) return incomeCat.categoryName;
    
    const taxRate = this.allTaxRates.find(tax => tax.id === accountId);
    if (taxRate) return `${taxRate.name} (${taxRate.rate}%)`;
    
    return 'Unknown Entry';
  }

  onSubmit(): void {
    if (this.filterForm.invalid) {
      alert('Please select a ledger.');
      return;
    }
    
    this.isLoading = true;
    this.showReport = false;

    setTimeout(() => {
      const { ledgerId, startDate, endDate } = this.filterForm.value;

      this.selectedLedgerName = ledgerId === 'All'
        ? 'All Ledgers'
        : this.allAccounts.find(acc => acc.id === ledgerId)?.name || '';

      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;
      if (start) start.setHours(0, 0, 0, 0);
      if (end) end.setHours(23, 59, 59, 999);

      // Create ledger entries from all data sources
      let ledgerEntries: LedgerEntry[] = [];

      // Add financial transactions
      const filteredTransactions = this.allTransactions.filter(t => {
        const transactionDate = this.getPreciseTransactionDate(t);
        const isAccountMatch = ledgerId === 'All' || t.accountId === ledgerId;
        const isDateMatch = (!start || transactionDate >= start) && (!end || transactionDate <= end);
        return isAccountMatch && isDateMatch;
      });

      filteredTransactions.forEach(t => {
        const entryName = this.getAccountOrCategoryName(t.accountId);
        if (entryName !== 'Unknown Entry') {
          ledgerEntries.push({
            date: this.getPreciseTransactionDate(t),
            voucher: t.referenceNo || t.relatedDocId?.slice(-6) || 'N/A',
            entry: entryName,
            debit: t.debit || 0,
            credit: t.credit || 0,
            source: t.source || 'Transaction',
            accountId: t.accountId,
            description: t.description || entryName
          });
        }
      });

      // Add purchase entries (as credits like in Day Book)
      const filteredPurchases = this.allPurchases.filter(p => {
        if (!start || !end) return true;
        const purchaseDate = this.getPreciseTransactionDate(p);
        return purchaseDate >= start && purchaseDate <= end;
      });

      filteredPurchases.forEach(p => {
        // Only add if this purchase affects the selected ledger or if showing all
        if (ledgerId === 'All' || this.purchaseAffectsLedger(p, ledgerId)) {
          ledgerEntries.push({
            date: this.getPreciseTransactionDate(p),
            voucher: p.referenceNo || p.invoiceNo || 'N/A',
            entry: 'Inventory / Stock (Purchase)',
            debit: 0,
            credit: p.grandTotal || p.purchaseTotal || 0,
            source: 'Purchase',
            description: 'Inventory / Stock (Purchase)'
          });
        }
      });

      // Add sale entries
      const filteredSales = this.allSales.filter(s => {
        if (!start || !end) return true;
        const saleDate = this.getPreciseTransactionDate(s);
        return saleDate >= start && saleDate <= end && s.status === 'Completed';
      });

      filteredSales.forEach(s => {
        // Stock debit entry
        const stockValue = s.subtotal || (s.products || []).reduce((sum: number, prod: any) => sum + (prod.subtotal || 0), 0);
        if (stockValue > 0 && (ledgerId === 'All' || this.saleAffectsLedger(s, ledgerId, 'stock'))) {
          ledgerEntries.push({
            date: this.getPreciseTransactionDate(s),
            voucher: s.invoiceNo || 'N/A',
            entry: 'Inventory / Stock (Sale)',
            debit: stockValue,
            credit: 0,
            source: 'Sale',
            description: 'Inventory / Stock (Sale)'
          });
        }

        // Payment credit entry
        const saleTotal = s.totalAmount || s.total || s.paymentAmount || 0;
        if (saleTotal > 0 && (ledgerId === 'All' || this.saleAffectsLedger(s, ledgerId, 'payment'))) {
          let accountName = 'Sales Revenue';
          const paymentAccountId = s.paymentAccount || s.paymentAccountId;
          if (paymentAccountId) {
            const account = this.allAccounts.find(acc => acc.id === paymentAccountId);
            accountName = account ? account.name : (s.paymentAccountName || s.paymentMethod || 'Sales Revenue');
          } else {
            accountName = s.paymentAccountName || s.paymentMethod || 'Sales Revenue';
          }
          
          ledgerEntries.push({
            date: this.getPreciseTransactionDate(s),
            voucher: s.invoiceNo || 'N/A',
            entry: accountName,
            debit: 0,
            credit: saleTotal,
            source: 'Sale',
            accountId: paymentAccountId,
            description: `Sale - ${s.customer || s.customerName || 'Customer'}`
          });
        }
      });

      // Sort entries by date and voucher (similar to Day Book)
      ledgerEntries.sort((a, b) => {
        const dateComparison = a.date.getTime() - b.date.getTime();
        if (dateComparison !== 0) {
          return dateComparison;
        }
        const voucherA = a.voucher || '';
        const voucherB = b.voucher || '';
        return voucherA.localeCompare(voucherB);
      });

      // Calculate opening balance
      let openingBalance = 0;
      if (ledgerId === 'All') {
        openingBalance = this.allAccounts.reduce((sum, acc) => sum + (acc.openingBalance || 0), 0);
      } else {
        const account = this.allAccounts.find(acc => acc.id === ledgerId);
        openingBalance = account?.openingBalance || 0;
      }

      // Calculate prior transactions for opening balance adjustment
      const priorEntries = this.getAllLedgerEntriesBeforeDate(start, ledgerId);
      priorEntries.forEach(entry => {
        openingBalance += (entry.credit || 0) - (entry.debit || 0);
      });

      const totalDebit = ledgerEntries.reduce((sum, entry) => sum + (entry.debit || 0), 0);
      const totalCredit = ledgerEntries.reduce((sum, entry) => sum + (entry.credit || 0), 0);
      const closingBalance = openingBalance + totalCredit - totalDebit;

      this.reportData = {
        transactions: ledgerEntries,
        openingBalance,
        totalDebit,
        totalCredit,
        closingBalance
      };
      
      this.showReport = true;
      this.isLoading = false;
    }, 50);
  }

  private purchaseAffectsLedger(purchase: any, ledgerId: string): boolean {
    // Check if purchase affects the selected ledger
    // This would typically be based on the payment account or supplier account
    return purchase.paymentAccountId === ledgerId || purchase.supplierAccountId === ledgerId;
  }

  private saleAffectsLedger(sale: any, ledgerId: string, type: 'stock' | 'payment'): boolean {
    if (type === 'payment') {
      return sale.paymentAccountId === ledgerId || sale.paymentAccount === ledgerId;
    }
    // For stock, you might have a specific stock account
    return false; // Adjust based on your business logic
  }

  private getAllLedgerEntriesBeforeDate(beforeDate: Date | null, ledgerId: string): LedgerEntry[] {
    if (!beforeDate) return [];

    let priorEntries: LedgerEntry[] = [];

    // Prior transactions
    const priorTransactions = this.allTransactions.filter(t => {
      const transactionDate = this.getPreciseTransactionDate(t);
      const isAccountMatch = ledgerId === 'All' || t.accountId === ledgerId;
      return isAccountMatch && transactionDate < beforeDate;
    });

    priorTransactions.forEach(t => {
      priorEntries.push({
        date: this.getPreciseTransactionDate(t),
        voucher: t.referenceNo || 'N/A',
        entry: this.getAccountOrCategoryName(t.accountId),
        debit: t.debit || 0,
        credit: t.credit || 0,
        source: 'Transaction'
      });
    });

    // Add prior purchases, sales, etc. following the same pattern as in onSubmit
    // This is a simplified version - you may need to expand based on your needs

    return priorEntries;
  }

  getRunningBalance(index: number): number {
    if (!this.reportData) return 0;
    const transactionsUpToIndex = this.reportData.transactions.slice(0, index + 1);
    const periodChange = transactionsUpToIndex.reduce((acc, cur) => acc + (cur.credit || 0) - (cur.debit || 0), 0);
    return this.reportData.openingBalance + periodChange;
  }
  
  private formatDateForInput(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}