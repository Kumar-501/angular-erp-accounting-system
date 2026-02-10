import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core'; // Add ViewChild, ElementRef
import { ActivatedRoute, Router } from '@angular/router';
import { AccountService } from '../services/account.service';
import { Expense, ExpenseService } from '../services/expense.service';
import { PurchaseService } from '../services/purchase.service';
import { DatePipe } from '@angular/common';
import { SaleService } from '../services/sale.service';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { AuthService } from '../auth.service';
import { JournalService, Journal, JournalItem } from '../services/journal.service';
import { Subscription, Subject } from 'rxjs';
import { debounceTime, take } from 'rxjs/operators';

interface AccountDetails {
  id: string;
  name: string;
  type: string;
  number: string;
  balance: number;
}

interface Transaction {
  roundingAdjustment: any;
  exactRefund: any;
  roundedRefund: any;
  id: string;
  relatedDocId?: string;
  date: Date;
  createdAt?: Date;
  transactionTime?: Date;
  description: string;
  paymentMethod: string;
  paymentDetails: string;
  note: string;
  addedBy: string;
  debit: number;
  credit: number;
  balance: number;
  
  hasDocument: boolean;
  type?: string;
  attachmentUrl?: string;
  fromAccountId?: string;
  toAccountId?: string;
  referenceNo?: string;
  category?: string;
  totalAmount?: number;
  source?: string;
  customer?: string;
  supplier?: string;
  saleId?: string;
  invoiceNo?: string;
  customerName?: string;
  paymentStatus?: string;
  purchaseId?: string;
  transactionCredit?: boolean;
  returnId?: string;
  originalSaleId?: string;
  hasReturns?: boolean;
  saleStatus?: string;
  originalSaleAmount?: number;
  returnStatus?: string;
  journalDetails?: string;
}

interface EditingTransaction extends Omit<Transaction, 'balance'> {
  dateString: string;
}

@Component({
  selector: 'app-account-book',
  templateUrl: './account-book.component.html',
  styleUrls: ['./account-book.component.scss'],
  providers: [DatePipe]
})
export class AccountBookComponent implements OnInit, OnDestroy {
  openingBalance: number = 0;
  private isOpeningBalanceLoaded: boolean = false;
  private subscriptions: Subscription[] = [];
  private legacyList: Transaction[] = [];
    @ViewChild('fromDatePicker') fromDatePicker!: ElementRef;
  @ViewChild('toDatePicker') toDatePicker!: ElementRef;
  private newBookList: Transaction[] = [];

  // Specific unsubscribers
  private accountTransactionsUnsubscribe: () => void = () => { };
  private expensesUnsubscribe: () => void = () => { };
  private incomesUnsubscribe: () => void = () => { };
  private purchasesUnsubscribe: () => void = () => { };
  private salesUnsubscribe: () => void = () => { };
  private returnsUnsubscribe: () => void = () => { };

  // Subject to handle debouncing for refreshes
  private updateTrigger = new Subject<void>();

  accountId: string = '';
  accountDetails: AccountDetails = {
    id: '',
    name: '',
    type: '',
    number: '',
    balance: 0
  };

  transactions: Transaction[] = [];
  
  // Source lists
  private accountTransactionList: Transaction[] = [];
  private saleTransactionList: Transaction[] = [];
  private expenseTransactionList: Transaction[] = [];
  private returnTransactionList: Transaction[] = [];

  filteredTransactions: Transaction[] = [];
  pagedTransactions: Transaction[] = [];
  recentTransactions: any[] = [];
  showRecentTransactions: boolean = true;
  recentTransactionsLimit: number = 5;
  allAccounts: any[] = [];
  accounts: any[] = [];
  
  viewMode: 'table' | 'card' = 'table';
  currentPage: number = 1;
  entriesPerPage: number = 25;
  
  // ✅ CHANGED: Added temporary date storage for user input
  tempDateRange = {
    from: '',
    to: ''
  };
  
  dateRange = {
    from: new Date(new Date().setDate(new Date().getDate() - 30)),
    to: new Date()
  };
  
  transactionType: string = 'All';
  searchQuery: string = '';
  totalDebit: number = 0;
  totalCredit: number = 0;
  loading: boolean = false;
  isEmpty: boolean = true;

  showEditModal: boolean = false;
  editingTransaction: EditingTransaction = this.getEmptyEditingTransaction();

  // Journal View Modal Properties
  showJournalViewModal: boolean = false;
  selectedJournalForView: Journal | null = null;
  
  showFundTransferModal: boolean = false;
  fundTransferForm: FormGroup;
  selectedFile: File | null = null;
  Math = Math; 

  public convertToDate(dateValue: any): Date {
    if (!dateValue) return new Date();
    if (dateValue instanceof Date) return dateValue;
    
    if (dateValue?.toDate && typeof dateValue.toDate === 'function') {
      return dateValue.toDate();
    }
    
    if (dateValue && typeof dateValue === 'object' && dateValue.seconds) {
      const date = new Date(dateValue.seconds * 1000);
      if (dateValue.nanoseconds) {
        date.setMilliseconds(Math.floor(dateValue.nanoseconds / 1000000));
      }
      return date;
    }
    
    if (typeof dateValue === 'string') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
        const [year, month, day] = dateValue.split('-').map(Number);
        return new Date(year, month - 1, day);
      }
      const parsedDate = new Date(dateValue);
      return isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
    }
    
    if (typeof dateValue === 'number') {
      return new Date(dateValue);
    }
    
    return new Date();
  }

  formatTransactionDate(transaction: Transaction): string {
    const displayTime = this.getTransactionDisplayTime(transaction);
    return this.datePipe.transform(displayTime, 'dd-MM-yyyy') || 'N/A';
  }

  sortDirection: 'asc' | 'desc' = 'desc'; 

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private accountService: AccountService,
    private saleService: SaleService,
    private expenseService: ExpenseService,
    private purchaseService: PurchaseService,
    private journalService: JournalService,
    private authService: AuthService,
    private datePipe: DatePipe,
    private formBuilder: FormBuilder
  ) {
    this.fundTransferForm = this.formBuilder.group({
      fromAccount: ['', Validators.required],
      toAccount: ['', Validators.required],
      amount: [0, [Validators.required, Validators.min(1)]],
      date: [new Date().toISOString().split('T')[0], Validators.required],
      note: ['']
    });

    this.subscriptions.push(
      this.updateTrigger.pipe(debounceTime(50)).subscribe(() => {
        this.processTransactionsInternal();
      })
    );
  }

  ngOnInit(): void {
    this.accountId = this.route.snapshot.paramMap.get('id') || '';

    if (this.accountId) {
      const navigationState = this.router.getCurrentNavigation()?.extras?.state || history.state;
      const shouldForceRefresh = navigationState?.forceRefresh ||
        this.accountService.shouldRefreshAccountBook(this.accountId);

      if (shouldForceRefresh) {
        this.accountService.clearAccountCache(this.accountId);
        this.accountService.clearAccountBookRefreshFlag(this.accountId);
      }

      // ✅ CHANGED: Initialize temp dates from actual date range
      this.tempDateRange.from = this.formatDateToYYYYMMDD(this.dateRange.from);
      this.tempDateRange.to = this.formatDateToYYYYMMDD(this.dateRange.to);

      this.loadAllAccounts();
      this.loadAccountDetails();
      this.loadRecentTransactions();
      this.setupRealtimeListeners();
    }
  }

  // ✅ NEW: Helper to format Date to yyyy-MM-dd for input fields
  private formatDateToYYYYMMDD(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // ✅ NEW: Apply filters button handler
  applyDateFilters(): void {
    if (this.tempDateRange.from) {
      this.dateRange.from = new Date(this.tempDateRange.from);
    }
    if (this.tempDateRange.to) {
      this.dateRange.to = new Date(this.tempDateRange.to);
    }
    this.filterTransactions();
  }

  // ✅ NEW: Reset filters button handler
  resetFilters(): void {
    const defaultFrom = new Date(new Date().setDate(new Date().getDate() - 30));
    const defaultTo = new Date();
    
    this.dateRange.from = defaultFrom;
    this.dateRange.to = defaultTo;
    this.tempDateRange.from = this.formatDateToYYYYMMDD(defaultFrom);
    this.tempDateRange.to = this.formatDateToYYYYMMDD(defaultTo);
    this.transactionType = 'All';
    this.searchQuery = '';
    
    this.filterTransactions();
  }
 getFormattedDate(dateString: string): string {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-');
    return `${day}-${month}-${year}`;
  }

  // Opens the hidden native date picker when clicking the calendar icon
  openDatePicker(type: 'from' | 'to'): void {
    if (type === 'from') {
      this.fromDatePicker.nativeElement.showPicker();
    } else {
      this.toDatePicker.nativeElement.showPicker();
    }
  }

  // Handles manual typing in DD-MM-YYYY format
  onDateInput(event: any, type: 'from' | 'to'): void {
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
        
        const formattedDate = `${year}-${month}-${day}`; // Internal format YYYY-MM-DD
        if (type === 'from') this.tempDateRange.from = formattedDate;
        else this.tempDateRange.to = formattedDate;
      } else {
        alert('Invalid date! Please enter a valid date in DD-MM-YYYY format.');
        // Revert to current value
        event.target.value = type === 'from' ? this.getFormattedDate(this.tempDateRange.from) : this.getFormattedDate(this.tempDateRange.to);
      }
    }
  }
  downloadTransactionData(): void {
    if (this.filteredTransactions.length === 0) {
      alert('No data to download');
      return;
    }

    let csvContent = 'Date,Transaction Time,Description,Payment Method,Payment Details,Note,Added By,Debit,Credit,Balance,Type,Reference No,Category,Source\n';
    
    this.filteredTransactions.forEach(t => {
      const formattedDate = this.formatTransactionDate(t);
      const formattedTime = this.formatTransactionTime(t);
      const description = (t.description || '').replace(/,/g, ' ');
      const paymentMethod = (t.paymentMethod || '').replace(/,/g, ' ');
      const paymentDetails = (t.paymentDetails || '').replace(/,/g, ' ');
      const note = (t.note || '').replace(/,/g, ' ');
      const addedBy = (t.addedBy || '').replace(/,/g, ' ');
      const debit = t.debit || 0;
      const credit = t.credit || 0;
      const balance = t.balance || 0;
      const type = this.getTransactionTypeDisplay(t.type);
      const referenceNo = (t.referenceNo || '').replace(/,/g, ' ');
      const category = (t.category || '').replace(/,/g, ' ');
      const source = t.source || 'account';
      
      csvContent += `"${formattedDate}","${formattedTime}","${description}","${paymentMethod}","${paymentDetails}","${note}","${addedBy}",${debit},${credit},${balance},"${type}","${referenceNo}","${category}","${source}"\n`;
    });
    
    csvContent += `Total,,,,,,,,${this.totalDebit},${this.totalCredit},,,,\n`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = window.URL.createObjectURL(blob);
    link.setAttribute('href', url);
    const dateStr = this.datePipe.transform(new Date(), 'dd-MM-yyyy');
    link.setAttribute('download', `${this.accountDetails.name}_transactions_${dateStr}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  ngOnDestroy(): void {
    this.accountTransactionsUnsubscribe();
    this.expensesUnsubscribe();
    this.incomesUnsubscribe();
    this.purchasesUnsubscribe();
    this.salesUnsubscribe();
    this.returnsUnsubscribe();
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private getTransactionDisplayTime(transaction: any): Date {
    if (transaction.transactionTime) return this.convertToDate(transaction.transactionTime);
    if (transaction.createdAt) return this.convertToDate(transaction.createdAt);
    return this.convertToDate(transaction.date);
  }

  formatTransactionTime(transaction: Transaction): string {
    const displayTime = this.getTransactionDisplayTime(transaction);
    return this.datePipe.transform(displayTime, 'MM/dd/yyyy HH:mm:ss') || 'N/A';
  }

  onDateInputFocus(event: Event): void {
    const input = event.target as HTMLInputElement;
    input.type = 'date';
    input.showPicker();
  }

  onDateInputBlur(event: Event): void {
    const input = event.target as HTMLInputElement;
    input.type = 'text'; 
  }

  handleDateFromChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.onDateFromChange(input.value);
  }

  handleDateToChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.onDateToChange(input.value);
  }

  // ✅ CHANGED: Only updates temp storage, doesn't trigger filter
  onDateFromChange(dateString: string): void {
    if (!dateString) return;
    this.tempDateRange.from = dateString;
  }

  // ✅ CHANGED: Only updates temp storage, doesn't trigger filter
  onDateToChange(dateString: string): void {
    if (!dateString) return;
    this.tempDateRange.to = dateString;
  }

  getEmptyEditingTransaction(): EditingTransaction {
    const now = new Date();
    return {
      id: '', date: now, createdAt: now, transactionTime: now, dateString: now.toISOString().slice(0, 16),
      description: '', paymentMethod: '', paymentDetails: '', note: '', addedBy: '',
      debit: 0, credit: 0, hasDocument: false, roundingAdjustment: 0, exactRefund: 0, roundedRefund: 0
    };
  }

  loadAllAccounts(): void {
    this.accountService.getAccounts((accounts: any[]) => {
      this.allAccounts = accounts;
      this.accounts = accounts;
    });
  }

  loadAccountDetails(): void {
    this.loading = true;
    this.accountService.getAccountById(this.accountId).subscribe({
      next: (account) => {
        if (account) {
          this.accountDetails = {
            id: account.id || this.accountId,
            name: account.name || '',
            type: account.accountType || '',
            number: account.accountNumber || '',
            balance: account.openingBalance || 0
          };
          this.openingBalance = account.openingBalance || 0;
          this.accountService.setOriginalOpeningBalance(this.accountId, this.openingBalance);
          this.isOpeningBalanceLoaded = true;
          this.combineAndProcessTransactions();
        }
        this.loading = false;
      },
      error: (error: any) => {
        console.error('Error loading account details:', error);
        this.loading = false;
      }
    });
  }

  private loadRecentTransactions(): void {
    this.accountService.getRecentTransactions(this.accountId, this.recentTransactionsLimit)
      .subscribe({
        next: (transactions) => { this.recentTransactions = transactions; },
        error: (error) => { console.error('Error loading recent transactions:', error); }
      });
  }

  setupRealtimeListeners(): void {
    this.loading = true;
    this.transactions = [];
    this.accountTransactionList = [];
    this.saleTransactionList = [];
    this.expenseTransactionList = [];
    this.returnTransactionList = [];
    
    this.loadAccountTransactions();
    this.loadSalesTransactions();
    this.loadExpenseTransactions();
    this.loadSalesReturns();
  }

  private loadAccountTransactions(): void {
    const legacyUnsub = this.accountService.getAllAccountTransactions(
      this.accountId,
      (transactions) => {
        this.legacyList = transactions
          .map(t => this.mapAccountTransaction(t))
          .filter(t => t !== null) as Transaction[];
        
        this.mergeAndProcessAccountTransactions();
      }
    );

    const newBookUnsub = this.accountService.getAccountBookTransactions(
      this.accountId,
      (transactions) => {
        this.newBookList = transactions
          .map(t => this.mapAccountTransaction(t))
          .filter(t => t !== null) as Transaction[];
        
        this.mergeAndProcessAccountTransactions();
      }
    );

    this.accountTransactionsUnsubscribe = () => {
      legacyUnsub();
      newBookUnsub();
    };
  }

  private mergeAndProcessAccountTransactions(): void {
    this.accountTransactionList = [...this.legacyList, ...this.newBookList];
    this.combineAndProcessTransactions();
  }

  private mapAccountBookReturnToTransaction(accountTransaction: any): Transaction | null {
    if (!accountTransaction || accountTransaction.source !== 'sales_return') return null;
    const transactionDate = this.convertToDate(accountTransaction.date);
    return {
      id: accountTransaction.id, 
      date: transactionDate, 
      createdAt: this.convertToDate(accountTransaction.createdAt),
      transactionTime: this.getTransactionDisplayTime(accountTransaction),
      description: accountTransaction.description || 'Sales Return', 
      paymentMethod: 'Sales Return',
      paymentDetails: accountTransaction.reference || '', 
      note: accountTransaction.note || '', 
      addedBy: 'System',
      debit: Number(accountTransaction.debit) || 0, 
      credit: 0, 
      balance: 0, 
      type: 'sales_return', 
      source: 'sales_return', 
      customerName: accountTransaction.customerName || '', 
      returnId: accountTransaction.relatedDocId,
      originalSaleId: accountTransaction.originalSaleId, 
      relatedDocId: accountTransaction.relatedDocId,
      roundingAdjustment: 0, exactRefund: 0, roundedRefund: 0
    } as Transaction;
  }

  getDisplayDebit(t: Transaction): number { 
    return Number(t.debit) || 0; 
  }

  private loadSalesReturns(): void {
    const accountBookUnsubscribe = this.accountService.getAccountBookTransactions(
      this.accountId,
      (transactions) => {
        this.returnTransactionList = transactions
          .filter(t => t.source === 'sales_return')
          .map(t => this.mapAccountBookReturnToTransaction(t))
          .filter(t => t !== null) as Transaction[];
        
        this.combineAndProcessTransactions();
      }
    );
    this.returnsUnsubscribe = accountBookUnsubscribe;
  }

  private loadSalesTransactions(): void {
    if (this.saleService.getSalesByPaymentAccount) {
        const saleSub = this.saleService.getSalesByPaymentAccount(this.accountId).subscribe({
            next: (sales: any[]) => {
                this.saleTransactionList = sales
                    .filter(sale => {
                        const wasCompleted = ['Completed', 'Returned', 'Partial Return'].includes(sale.status);
                        const hasPayment = Number(sale.paymentAmount) > 0;
                        return wasCompleted && hasPayment;
                    })
                    .map(sale => this.mapSaleToTransaction(sale))
                    .filter(t => t !== null) as Transaction[];
                this.combineAndProcessTransactions();
            },
            error: (error) => console.error('Error loading sales:', error)
        });
        this.subscriptions.push(saleSub);
        this.salesUnsubscribe = () => saleSub.unsubscribe();
    } else {
        this.loadSalesFallback();
    }
  }

  private loadExpenseTransactions(): void {
    const processExpenses = (expenses: Expense[]) => {
      this.expenseTransactionList = expenses
        .filter(expense => expense.source !== 'journal') 
        .map(expense => this.mapExpenseToTransaction(expense));
        
      this.combineAndProcessTransactions();
    };

    if (this.expenseService.getExpensesByAccount) {
      this.expensesUnsubscribe = this.expenseService.getExpensesByAccount(
        this.accountId,
        processExpenses
      );
    } else {
      const expenseSub = this.expenseService.getExpenses().subscribe(expenses => {
        const accountExpenses = expenses
          .filter((expense: any) => expense.paymentAccount === this.accountId);
        processExpenses(accountExpenses);
      });
      this.subscriptions.push(expenseSub);
      this.expensesUnsubscribe = () => expenseSub.unsubscribe();
    }
  }

  mapExpenseToTransaction(expense: any): Transaction {
    const expenseDate = this.convertToDate(expense.paidOn || expense.date);
    const createdAt = this.convertToDate(expense.createdAt || expense.timestamp);
    return {
      id: expense.id, date: expenseDate, createdAt: createdAt, transactionTime: expenseDate,
      description: `${expense.expenseCategory || 'Expense'}: ${expense.expenseNote || 'No description'}`,
      paymentMethod: expense.paymentMethod || '', paymentDetails: expense.referenceNo || '',
      note: expense.expenseNote || '', addedBy: expense.addedByDisplayName || expense.addedBy || 'System',
      debit: Number(expense.paymentAmount || 0), credit: 0, balance: 0,
      hasDocument: !!expense.document, type: 'expense', attachmentUrl: expense.document || '',
      referenceNo: expense.referenceNo, category: expense.expenseCategory, totalAmount: expense.totalAmount,
      source: 'expense', roundingAdjustment: 0, exactRefund: 0, roundedRefund: 0
    };
  }

  private processTransactionsInternal(): void {
    const ledgerTransactions = [...this.accountTransactionList];
    const recordedDocIds = new Set<string>();
    
    ledgerTransactions.forEach(t => {
        if (t.relatedDocId) recordedDocIds.add(t.relatedDocId);
        if (t.saleId) recordedDocIds.add(t.saleId);
        
        if (t.referenceNo) recordedDocIds.add(t.referenceNo);
        if (t.paymentDetails) recordedDocIds.add(t.paymentDetails);
        
        if (t.referenceNo && t.referenceNo.includes('-')) {
            const baseRef = t.referenceNo.split('-')[0];
            recordedDocIds.add(baseRef);
        }
        if (t.paymentDetails && t.paymentDetails.includes('-')) {
            const baseDetails = t.paymentDetails.split('-')[0];
            recordedDocIds.add(baseDetails);
        }
    });

    const uniqueSalesList = this.saleTransactionList.filter(saleTx => {
        if (saleTx.id && recordedDocIds.has(saleTx.id)) return false;
        if (saleTx.relatedDocId && recordedDocIds.has(saleTx.relatedDocId)) return false;
        if (saleTx.invoiceNo && recordedDocIds.has(saleTx.invoiceNo)) return false;
        if (saleTx.paymentDetails && recordedDocIds.has(saleTx.paymentDetails)) return false;
        return true;
    });

    const allTransactions = [
        ...ledgerTransactions,
        ...uniqueSalesList, 
        ...this.expenseTransactionList,
        ...this.returnTransactionList
    ];
    
    const transactionMap = new Map<string, Transaction>();
    allTransactions.forEach(t => {
        if (!transactionMap.has(t.id)) {
            transactionMap.set(t.id, t);
        }
    });

    this.transactions = Array.from(transactionMap.values());
    this.calculateRunningBalanceForView();

    if (this.transactions.length > 0) {
        if (this.sortDirection === 'desc') {
           this.accountDetails.balance = this.transactions[0].balance;
        } else {
           this.accountDetails.balance = this.transactions[this.transactions.length - 1].balance;
        }
    } else {
        this.accountDetails.balance = this.openingBalance;
    }
    
    this.loadJournalContextDetails();

    this.saveCurrentBalanceToDatabase();
    this.accountService.setCalculatedCurrentBalance(this.accountId, this.accountDetails.balance);
    this.filterTransactions();
    this.isEmpty = this.transactions.length === 0;
    this.loading = false;
  }

  private loadJournalContextDetails(): void {
    const journalTransactions = this.transactions.filter(t => 
      t.source === 'journal' && 
      t.relatedDocId && 
      !t.journalDetails
    );

    const uniqueJournalIds = [...new Set(journalTransactions.map(t => t.relatedDocId))];

    uniqueJournalIds.forEach(journalId => {
      if (!journalId) return;

      this.journalService.getJournalById(journalId).pipe(take(1)).subscribe(journal => {
        if (!journal || !journal.items) return;

        const contraItems = journal.items.filter(item => item.accountId !== this.accountId);

        if (contraItems.length > 0) {
          const detailsString = 'Vs: ' + contraItems.map(item => {
             const type = item.debit > 0 ? '(Dr)' : '(Cr)'; 
             return `${item.accountName} ${type}`;
          }).join(', ');

          this.transactions.forEach(t => {
            if (t.relatedDocId === journalId) {
              t.journalDetails = detailsString;
            }
          });
        }
      });
    });
  }

  viewJournalDetails(journalId: string | undefined): void {
    if (!journalId) return;
    this.loading = true;
    this.journalService.getJournalById(journalId).pipe(take(1)).subscribe(journal => {
      this.selectedJournalForView = journal;
      this.showJournalViewModal = true;
      this.loading = false;
    });
  }

  closeJournalViewModal(): void {
    this.showJournalViewModal = false;
    this.selectedJournalForView = null;
  }

  getJournalTotalDebit(items: JournalItem[]): number {
    if (!items) return 0;
    return items.reduce((sum, item) => sum + (item.debit || 0), 0);
  }

  getJournalTotalCredit(items: JournalItem[]): number {
    if (!items) return 0;
    return items.reduce((sum, item) => sum + (item.credit || 0), 0);
  }

  private mapSaleToTransaction(sale: any): Transaction | null {
    if (!sale.paymentAmount || Number(sale.paymentAmount) <= 0) return null;
    const transactionDate = this.convertToDate(sale.completedAt || sale.saleDate);
    let creditAmount = Number(sale.paymentAmount);
    let paymentMethod = sale.paymentMethod || 'Cash';

    if (sale.payments && Array.isArray(sale.payments) && sale.payments.length > 0) {
        const splitPayment = sale.payments.find((p: any) => p.accountId === this.accountId);
        if (splitPayment) {
            creditAmount = Number(splitPayment.amount);
            paymentMethod = splitPayment.method;
        }
    }

    const finalPaymentDetails = sale.invoiceNo || sale.id;

    return {
        id: sale.id, 
        date: transactionDate, 
        transactionTime: transactionDate,
        description: `Sale: ${sale.invoiceNo || 'N/A'}`, 
        paymentMethod: paymentMethod,
        paymentDetails: finalPaymentDetails, 
        note: sale.note || '',
        addedBy: sale.addedByDisplayName || 'System', 
        debit: 0, 
        credit: creditAmount, 
        balance: 0,
        hasDocument: !!sale.document, 
        type: 'sale', 
        source: 'sale', 
        customerName: sale.customer,
        saleId: sale.id, 
        invoiceNo: sale.invoiceNo, 
        hasReturns: sale.hasReturns || false, 
        relatedDocId: sale.id,
        roundingAdjustment: 0, 
        exactRefund: 0, 
        roundedRefund: 0
    } as Transaction;
  }

  getAddedByName(addedBy: any): string {
    if (typeof addedBy === 'string') return addedBy;
    return addedBy?.displayName || addedBy?.name || 'System';
  }
  getAccountName(id: string): string {
    return this.allAccounts.find(a => a.id === id)?.name || 'Unknown Account';
  }
  private loadSalesFallback(): void {
    if (this.saleService['getSales']) {
      const saleSub = this.saleService['getSales']().subscribe({
        next: (sales: any[]) => {
          const accountSales = sales
            .filter((sale: any) => {
              const paymentAccountId = sale.paymentAccount || sale.paymentAccountId || sale.account || sale.accountId;
              const matchesAccount = paymentAccountId === this.accountId ||
                (typeof paymentAccountId === 'object' && paymentAccountId?.id === this.accountId);
              const wasCompleted = sale.status === 'Completed' || sale.status === 'Returned' || sale.status === 'Partial Return';
              const hasPayment = Number(sale.paymentAmount) > 0;
              return matchesAccount && wasCompleted && hasPayment;
            })
            .map(sale => this.mapSaleToTransaction(sale))
            .filter(t => t !== null) as Transaction[];
          this.saleTransactionList = accountSales;
          this.combineAndProcessTransactions();
        },
        error: (error: any) => console.error('Error in fallback sale loading:', error)
      });
      this.subscriptions.push(saleSub);
      this.salesUnsubscribe = () => saleSub.unsubscribe();
    } else {
      console.warn('No sales service method available');
      this.salesUnsubscribe = () => { };
    }
  }

  private combineAndProcessTransactions(): void {
    if (!this.isOpeningBalanceLoaded) return;
    this.updateTrigger.next();
  }

  private async saveCurrentBalanceToDatabase(): Promise<void> {
    try {
      await this.accountService.updateCurrentBalance(this.accountId, this.accountDetails.balance);
    } catch (error) {
      console.error('❌ Error saving current balance:', error);
    }
  }

  mapAccountTransaction(t: any): Transaction {
    const transactionDate = this.convertToDate(t.date);
    const createdAt = this.convertToDate(t.createdAt || t.timestamp);
    let description = t.description || 'General Ledger Entry';
    let paymentMethod = t.paymentMethod || '';
    
    let type = t.type || 'manual_entry';
    const source = t.source || 'account';

    if (source === 'sale') {
      type = 'sale';
      if (!description || description === 'General Ledger Entry') {
         description = `Sale: ${t.reference || t.paymentDetails || ''}`;
      }
    }
    else if (source === 'journal') { type = 'Journal Entry'; description = t.description; }
    else if (type.includes('transfer')) { paymentMethod = 'Fund Transfer'; }
    else if (source === 'deposit') { type = 'Deposit'; }
    else if (source === 'sale' && (!description || description === 'General Ledger Entry')) {
      description = `Sale: ${t.reference || t.paymentDetails || ''}`;
    }

    let debit = 0, credit = 0;
    if (t.debit !== undefined && t.credit !== undefined) {
      debit = Number(t.debit || 0); credit = Number(t.credit || 0);
    } else {
      const amount = Number(t.amount || 0);
      if (type.includes('expense') || type.includes('payment') || type.includes('return')) debit = amount;
      else credit = amount;
    }

    if (source === 'purchase_return') {
      const isFull = t.isFullReturn || false;
      const hasShip = (t.shippingChargesRefunded || 0) > 0;
      description += isFull && hasShip ? ' (Full Return - shipping included)' : ' (Partial Return)';
    }

    return {
      id: t.id, date: transactionDate, createdAt: createdAt, transactionTime: this.getTransactionDisplayTime(t),
      description: description, paymentMethod: paymentMethod, paymentDetails: t.reference || t.paymentDetails || '',
      note: t.note || '', addedBy: this.getAddedByName(t.addedBy), debit: debit, credit: credit, balance: 0,
      hasDocument: t.hasDocument || !!t.attachmentUrl, type: type, attachmentUrl: t.attachmentUrl,
      fromAccountId: t.fromAccountId, toAccountId: t.toAccountId, referenceNo: t.reference || t.referenceNo || '',
      source: source, relatedDocId: t.relatedDocId || '', transactionCredit: t.isCapitalTransaction === true,
      roundingAdjustment: t.roundingAdjustment || 0, exactRefund: t.exactRefund || 0, roundedRefund: t.roundedRefund || 0,
      customerName: t.customerName || t.customer || '',
      saleId: t.relatedDocId || t.saleId 
    };
  }

  calculateRunningBalanceForView(): void {
    const sorted = [...this.transactions].sort((a, b) => {
        const timeA = this.getTransactionDisplayTime(a).getTime();
        const timeB = this.getTransactionDisplayTime(b).getTime();
        
        if (timeA !== timeB) return timeA - timeB;

        const createdA = a.createdAt ? this.convertToDate(a.createdAt).getTime() : 0;
        const createdB = b.createdAt ? this.convertToDate(b.createdAt).getTime() : 0;
        return createdA - createdB;
    });

    let runningBalance = this.openingBalance;
    
    sorted.forEach(t => {
        const debit = Number(t.debit) || 0;
        const credit = Number(t.credit) || 0;

        if (t.source === 'sales_return') {
            runningBalance = runningBalance - debit;
        } 
        else if (t.transactionCredit) { 
            runningBalance = runningBalance + credit + debit; 
        } 
        else {
            runningBalance = runningBalance + credit - debit;
        }
        
        t.balance = runningBalance;
    });

    if (this.sortDirection === 'desc') {
        this.transactions = sorted.reverse(); 
    } else {
        this.transactions = sorted;
    }
  }

  toggleSortOrder(): void {
    this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    this.calculateRunningBalanceForView();
    this.filterTransactions();
  }

  filterTransactions(): void {
    const fromDate = new Date(this.dateRange.from); fromDate.setHours(0, 0, 0, 0);
    const toDate = new Date(this.dateRange.to); toDate.setHours(23, 59, 59, 999);

    this.filteredTransactions = this.transactions.filter(t => {
      const transactionTime = this.getTransactionDisplayTime(t);
      if (t.type === 'purchase' || t.source === 'purchase') return false;
      return transactionTime >= fromDate && transactionTime <= toDate;
    });

    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      this.filteredTransactions = this.filteredTransactions.filter(t =>
        t.description?.toLowerCase().includes(query) || t.paymentMethod?.toLowerCase().includes(query) ||
        t.addedBy?.toLowerCase().includes(query) || t.note?.toLowerCase().includes(query) ||
        t.referenceNo?.toLowerCase().includes(query) || t.customer?.toLowerCase().includes(query)
      );
    }

    if (this.transactionType !== 'All') {
      this.filteredTransactions = this.filteredTransactions.filter(t => {
        switch (this.transactionType) {
          case 'Debit': return Number(t.debit) > 0;
          case 'Credit': return Number(t.credit) > 0;
          case 'Transfer': return t.type?.includes('transfer');
          case 'Expense': return t.type === 'expense';
          case 'Income': return t.type === 'income';
          case 'Sale': return t.type === 'sale';
          case 'Sales Return': return t.type === 'sales_return';
          default: return true;
        }
      });
    }

    this.calculateTotals();
    this.currentPage = 1;
    this.updatePagedTransactions();
  }

  calculateTotals(): void {
    this.totalDebit = this.filteredTransactions.reduce((sum, t) => sum + this.getDisplayDebit(t), 0);
    this.totalCredit = this.filteredTransactions.reduce((sum, t) => sum + this.getDisplayCredit(t), 0);
  }

  getTransactionTypeDisplay(type: string | undefined): string {
    if (!type) return 'Unknown';
    if (type === 'income') return 'Income';
    if (type === 'sale') return 'Sale';
    if (type === 'sales_return') return 'Sales Return';
    if (type === 'expense') return 'Expense';
    if (type.includes('transfer')) return type.includes('in') ? 'Transfer In' : 'Transfer Out';
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  updatePagedTransactions(): void {
    const start = (this.currentPage - 1) * this.entriesPerPage;
    this.pagedTransactions = this.filteredTransactions.slice(start, start + this.entriesPerPage);
  }

  previousPage(): void { if (this.currentPage > 1) { this.currentPage--; this.updatePagedTransactions(); } }
  nextPage(): void { if (this.currentPage * this.entriesPerPage < this.filteredTransactions.length) { this.currentPage++; this.updatePagedTransactions(); } }
  
  onTransactionTypeChange(): void { this.filterTransactions(); }
  onSearchChange(): void { this.filterTransactions(); }

  deleteTransaction(id: string): void {
    if (!confirm('Are you sure?')) return;
    const transaction = this.transactions.find(t => t.id === id);
    if (!transaction) return;
    if (transaction.source === 'sale' || transaction.source === 'sales_return') {
        alert('Manage sales/returns from Sales module.'); return;
    }
    if (transaction.type?.startsWith('transfer')) {
        const related = transaction.paymentDetails?.replace('TRF-', '');
        if (related) this.accountService.deleteFundTransfer(related);
    } else {
        this.accountService.deleteTransaction(id);
    }
  }

  downloadDocument(url: string | undefined): void { if(url) window.open(url, '_blank'); }
  getMinValue(a: number, b: number): number { return Math.min(a, b); }

  editTransaction(transaction: Transaction): void {
    if (['expense', 'income', 'purchase', 'sale', 'sales_return', 'journal'].includes(transaction.source || '')) {
      alert(`Edit from ${transaction.source} module.`); return;
    }
    const tTime = this.getTransactionDisplayTime(transaction);
    this.editingTransaction = { ...transaction, dateString: tTime.toISOString().slice(0, 16) };
    this.showEditModal = true;
  }

  saveTransaction(): void { 
    let updatedDate = new Date(this.editingTransaction.dateString);
    if (isNaN(updatedDate.getTime())) {
      updatedDate = this.editingTransaction.date instanceof Date ? this.editingTransaction.date : new Date();
    }
    const transactionData = {
      date: updatedDate,
      transactionTime: updatedDate,
      description: this.editingTransaction.description,
      paymentMethod: this.editingTransaction.paymentMethod,
      debit: Number(this.editingTransaction.debit) || 0,
      credit: Number(this.editingTransaction.credit) || 0,
      note: this.editingTransaction.note,
      reference: this.editingTransaction.paymentDetails
    };
    if (this.editingTransaction.id) {
      this.accountService.updateAccountBookTransaction(
        this.editingTransaction.id,
        transactionData
      ).then(() => {
        this.showEditModal = false;
      }).catch(error => {
        console.error('Error updating transaction:', error);
        alert('Failed to update transaction');
      });
    } else {
      this.accountService.addAccountBookTransaction({
        accountId: this.accountId,
        accountName: this.accountDetails.name,
        ...transactionData
      }).then(() => {
        this.showEditModal = false;
      }).catch(error => {
        console.error('Error adding transaction:', error);
        alert('Failed to add transaction');
      });
    }
  }
  
  cancelEdit(): void { this.showEditModal = false; }
  
  openFundTransferModal(): void { 
    this.showFundTransferModal = true; 
    this.fundTransferForm.patchValue({ fromAccount: this.accountId, date: new Date().toISOString().split('T')[0] });
  }
  closeFundTransferForm(): void { this.showFundTransferModal = false; this.fundTransferForm.reset(); }
  
  onFileSelected(event: any): void { 
    const file = event.target.files[0];
    if (file && file.size <= 5 * 1024 * 1024) {
      const allowedTypes = ['.pdf', '.csv', '.zip', '.doc', '.docx', '.jpeg', '.jpg', '.png'];
      const fileExt = '.' + file.name.split('.').pop().toLowerCase();
      if (allowedTypes.includes(fileExt)) {
        this.selectedFile = file;
      } else {
        alert('Invalid file type. Allowed types: PDF, CSV, ZIP, DOC, DOCX, JPEG, JPG, PNG');
        event.target.value = null;
      }
    } else {
      alert('File size should not exceed 5MB');
      event.target.value = null;
    }
  }

  submitFundTransfer(): void {
    if (this.fundTransferForm.invalid) return;
    const val = this.fundTransferForm.value;
    const now = new Date();
    const tDate = new Date(val.date);
    tDate.setHours(now.getHours(), now.getMinutes());
    
    const data = {
      fromAccountId: val.fromAccount, fromAccountName: this.getAccountName(val.fromAccount),
      toAccountId: val.toAccount, toAccountName: this.getAccountName(val.toAccount),
      amount: Number(val.amount), date: tDate, createdAt: now, transactionTime: now,
      note: val.note || '', addedBy: this.authService.getCurrentUserName(), type: 'transfer',
      hasDocument: !!this.selectedFile, timestamp: now.getTime()
    };
    this.accountService.addFundTransfer(data).then(() => this.closeFundTransferForm());
  }

  getDisplayCredit(t: Transaction): number { 
    if (t.source === 'sales_return') return 0;
    return Number(t.credit) || 0; 
  }
}