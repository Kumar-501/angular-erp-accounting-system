// src/app/day-book/day-book.component.ts

import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AccountService } from '../services/account.service';
import { PurchaseService } from '../services/purchase.service';
import { SaleService } from '../services/sale.service';
import { ExpenseService } from '../services/expense.service';
import { ExpenseCategoriesService } from '../services/expense-categories.service';
// *** MODIFICATION: Import TaxService and TaxRate model ***
import { TaxService } from '../services/tax.service';
import { TaxRate } from '../tax/tax.model';

// Interface for a processed transaction ready for display in the Day Book
interface DaybookEntry {
  date: Date;
  voucher: string;
  entry: string; // This will be the account name or description
  debit: number;
  credit: number;
}

@Component({
  selector: 'app-day-book',
  templateUrl: './day-book.component.html',
  styleUrls: ['./day-book.component.scss']
})
export class DayBookComponent implements OnInit, OnDestroy {
  filterForm!: FormGroup;
@ViewChild('startDatePicker') startDatePicker!: ElementRef;
@ViewChild('endDatePicker') endDatePicker!: ElementRef;
  isLoading = true;
  
  allTransactions: any[] = [];
  allAccounts: any[] = [];
  allExpenseCategories: any[] = [];
  allIncomeCategories: any[] = [];
  // *** MODIFICATION: Added property to store tax rates ***
  allTaxRates: TaxRate[] = [];
  
  daybookEntries: DaybookEntry[] = [];
  
  private transactionsSub!: () => void;
  private accountsSub!: () => void;

  constructor(
    private fb: FormBuilder,
    private accountService: AccountService,
    private saleService: SaleService,
    private purchaseService: PurchaseService,
    private expenseService: ExpenseService,
    private categorySevice: ExpenseCategoriesService,
    // *** MODIFICATION: Inject TaxService ***
    private taxService: TaxService
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadInitialData();
  }

  ngOnDestroy(): void {
    if (this.transactionsSub) this.transactionsSub();
    if (this.accountsSub) this.accountsSub();
  }
// 1. Helper to convert internal YYYY-MM-DD to display format DD-MM-YYYY
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
      
      const formattedDate = `${year}-${month}-${day}`; // ISO format for internal
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
  event.target.value = this.getFormattedDateForInput(this.filterForm.get(controlName)?.value);
}
  initForm(): void {
    const today = new Date().toISOString().split('T')[0];
    this.filterForm = this.fb.group({
      startDate: [today, Validators.required],
      endDate: [today, Validators.required]
    });
  }

  loadInitialData(): void {
    this.isLoading = true;
    Promise.all([
      this.loadAccounts(),
      this.loadAllTransactions(),
      this.loadCategories(),
      this.loadTaxRates() // *** MODIFICATION: Load tax rates on init ***
    ]).then(() => {
      this.generateDaybookReport();
    }).catch(error => {
      console.error("Error loading initial data:", error);
      this.isLoading = false;
    });
  }
  
  loadCategories(): Promise<void> {
      const incomePromise = new Promise<void>(resolve => {
        this.categorySevice.getIncomeCategories().subscribe(cats => {
            this.allIncomeCategories = cats;
            resolve();
        });
      });
      const expensePromise = new Promise<void>(resolve => {
        this.categorySevice.getExpenseCategories().subscribe(cats => {
            this.allExpenseCategories = cats;
            resolve();
        });
      });
      return Promise.all([incomePromise, expensePromise]).then(() => {});
  }
  
  // *** MODIFICATION: New method to load tax rates ***
  loadTaxRates(): Promise<void> {
      return new Promise<void>(resolve => {
          this.taxService.getTaxRates().subscribe(rates => {
              this.allTaxRates = rates;
              resolve();
          });
      });
  }

  loadAccounts(): Promise<void> {
    return new Promise((resolve) => {
      this.accountsSub = this.accountService.getAccounts(accounts => {
        this.allAccounts = accounts;
        resolve();
      });
    });
  }

  loadAllTransactions(): Promise<void> {
    return new Promise((resolve) => {
      this.transactionsSub = this.accountService.getAllTransactions(transactions => {
        this.allTransactions = transactions;
        resolve();
      });
    });
  }

  private getPreciseTransactionDate(transaction: any): Date {
    const dateSource = transaction.date || transaction.createdAt || transaction.paidOn;
    if (!dateSource) return new Date();
    return dateSource.toDate ? dateSource.toDate() : new Date(dateSource);
  }

   async generateDaybookReport(): Promise<void> {
    if (this.filterForm.invalid) {
      alert('Please select a valid start and end date.');
      return;
    }
    this.isLoading = true;

    const { startDate, endDate } = this.filterForm.value;
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const financialTransactions = this.allTransactions.filter(t => {
      const transactionDate = this.getPreciseTransactionDate(t);
      return transactionDate >= start && transactionDate <= end;
    });

    let combinedEntries: DaybookEntry[] = financialTransactions.map(t => {
      let entryName = 'Unknown Entry';
      const account = this.allAccounts.find(a => a.id === t.accountId);
      if (account) {
        entryName = account.name;
      } else {
        const expenseCat = this.allExpenseCategories.find(c => c.id === t.accountId);
        if (expenseCat) {
          entryName = expenseCat.categoryName;
        } else {
          const incomeCat = this.allIncomeCategories.find(c => c.id === t.accountId);
          if (incomeCat) {
            entryName = incomeCat.categoryName;
          } else {
            const taxRate = this.allTaxRates.find(tax => tax.id === t.accountId);
            if (taxRate) {
              entryName = `${taxRate.name} (${taxRate.rate}%)`;
            }
          }
        }
      }

      return {
        date: this.getPreciseTransactionDate(t),
        voucher: t.referenceNo || t.relatedDocId?.slice(-6) || 'N/A',
        entry: entryName,
        debit: t.debit || 0,
        credit: t.credit || 0
      };
    });

    try {
      const [sales, purchases, expenses, incomes] = await Promise.all([
        this.saleService.getSalesByDateRange(start, end),
        this.purchaseService.getPurchasesByDateRange(start, end),
        this.expenseService.getExpensesByDateRange(start, end),
        this.expenseService.getIncomesByDateRange(start, end)
      ]);
      
      const expenseEntries = expenses.map(e => ({
        date: this.getPreciseTransactionDate(e),
        voucher: e.referenceNo || 'N/A',
        entry: e.expenseCategoryName || e.accountHead || 'Expense',
        debit: e.totalAmount || 0,
        credit: 0
      }));

      const incomeEntries = incomes.map(i => ({
        date: this.getPreciseTransactionDate(i),
        voucher: i.referenceNo || 'N/A',
        entry: i.incomeCategoryName || i.accountHead || 'Income',
        debit: 0,
        credit: i.totalAmount || 0
      }));

      const purchaseEntries = purchases.map(p => ({
        date: this.getPreciseTransactionDate(p),
        voucher: p['referenceNo'] || p['invoiceNo'] || 'N/A',
        entry: 'Inventory / Stock (Purchase)',
        debit: 0,
        credit: p['grandTotal'] || p['purchaseTotal'] || 0,
      }));

      const saleEntries: DaybookEntry[] = [];
      sales.forEach(s => {
        const stockValue = s['subtotal'] || (s['products'] || []).reduce((sum: any, prod: { subtotal: any; }) => sum + (prod.subtotal || 0), 0);
        if (stockValue > 0) {
            saleEntries.push({
                date: this.getPreciseTransactionDate(s),
                voucher: s['invoiceNo'] || 'N/A',
                entry: 'Inventory / Stock (Sale)',
                debit: stockValue,
                credit: 0,
            });
        }
        const saleTotal = s['totalAmount'] || s['total'] || s['paymentAmount'] || 0;
        if (saleTotal > 0) {
            let accountName = 'Sales Revenue';
            const paymentAccountId = s['paymentAccount'] || s['paymentAccountId'];
            if (paymentAccountId) {
                const account = this.allAccounts.find(acc => acc.id === paymentAccountId);
                accountName = account ? account.name : (s['paymentAccountName'] || s['paymentMethod'] || 'Sales Revenue');
            } else {
                accountName = s['paymentAccountName'] || s['paymentMethod'] || 'Sales Revenue';
            }
            saleEntries.push({
                date: this.getPreciseTransactionDate(s),
                voucher: s['invoiceNo'] || 'N/A',
                entry: accountName,
                debit: 0,
                credit: saleTotal,
            });
        }
      });
      
      const otherEntries = [...purchaseEntries, ...saleEntries, ...expenseEntries, ...incomeEntries];
      const filteredFinancials = combinedEntries.filter(fin => fin.entry !== 'Unknown Entry');

      // MODIFICATION START: Updated sorting logic
      this.daybookEntries = [...filteredFinancials, ...otherEntries].sort((a, b) => {
        const dateComparison = a.date.getTime() - b.date.getTime();
        if (dateComparison !== 0) {
          return dateComparison;
        }
        // If dates are the same, sort by voucher for consistent grouping
        // Ensure voucher is a string for localeCompare
        const voucherA = a.voucher || '';
        const voucherB = b.voucher || '';
        return voucherA.localeCompare(voucherB);
      });
      // MODIFICATION END

    } catch (error) {
      console.error("Error fetching report data:", error);
      // MODIFICATION START: Apply secondary sort here as well for consistency
      this.daybookEntries = combinedEntries.sort((a, b) => {
        const dateComparison = a.date.getTime() - b.date.getTime();
        if (dateComparison !== 0) {
          return dateComparison;
        }
        const voucherA = a.voucher || '';
        const voucherB = b.voucher || '';
        return voucherA.localeCompare(voucherB);
      });
      // MODIFICATION END
    } finally {
      this.isLoading = false;
    }
  }
}