import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AccountService } from '../services/account.service';
import { Expense, ExpenseService } from '../services/expense.service';
import { PurchaseService } from '../services/purchase.service';
import { DatePipe } from '@angular/common';
import { SaleService } from '../services/sale.service';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { AuthService } from '../auth.service';
import { Subscription } from 'rxjs';

interface AccountDetails {
  id: string;
  name: string;
  type: string;
  number: string;
  balance: number;
}

interface Timestamp {
  toDate(): Date;
}

interface Transaction {
  id: string;
  date: Date;
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
  private subscriptions: Subscription[] = [];
  private accountTransactionsUnsubscribe: () => void = () => { };
  private expensesUnsubscribe: () => void = () => { };
  private incomesUnsubscribe: () => void = () => { };
  private purchasesUnsubscribe: () => void = () => { };
  private salesUnsubscribe: () => void = () => { };

  accountId: string = '';
  accountDetails: AccountDetails = {
    id: '',
    name: '',
    type: '',
    number: '',
    balance: 0
  };
  transactions: Transaction[] = [];
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
  
  showFundTransferModal: boolean = false;
  fundTransferForm: FormGroup;
  selectedFile: File | null = null;

  constructor(
    private route: ActivatedRoute,
    private accountService: AccountService,
    private saleService: SaleService,
    private expenseService: ExpenseService,
    private purchaseService: PurchaseService,
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
  }

  ngOnInit(): void {
    this.accountId = this.route.snapshot.paramMap.get('id') || '';
    if (this.accountId) {
      this.loadAllAccounts();
      this.loadAccountDetails();
          this.loadRecentTransactions(); // Add this line

      this.setupRealtimeListeners();
    }
  }

  ngOnDestroy(): void {
    // Unsubscribe from all real-time listeners
    this.accountTransactionsUnsubscribe();
    this.expensesUnsubscribe();
    this.incomesUnsubscribe();
    this.purchasesUnsubscribe();
    this.salesUnsubscribe();
    
    // Unsubscribe from all subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

private loadRecentTransactions(): void {
  this.accountService.getRecentTransactions(this.accountId, this.recentTransactionsLimit)
    .subscribe({
      next: (transactions) => {
        this.recentTransactions = transactions;
      },
      error: (error) => {
        console.error('Error loading recent transactions:', error);
      }
    });
}  private convertToDate(dateValue: any): Date {
    if (!dateValue) return new Date();
    if (dateValue instanceof Date) return dateValue;
    if (dateValue?.toDate && typeof dateValue.toDate === 'function') return dateValue.toDate(); // Handle Firestore Timestamp
    if (typeof dateValue === 'string') return new Date(dateValue);
    if (typeof dateValue === 'number') return new Date(dateValue);
    return new Date();
  }

  getEmptyEditingTransaction(): EditingTransaction {
    return {
      id: '',
      date: new Date(),
      dateString: '',
      description: '',
      paymentMethod: '',
      paymentDetails: '',
      note: '',
      addedBy: '',
      debit: 0,
      credit: 0,
      hasDocument: false
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
        }
        this.loading = false;
      },
      error: (error: any) => {
        console.error('Error loading account details:', error);
        this.loading = false;
      }
    });
  }

// Correct - move private method to class level
setupRealtimeListeners(): void {
  this.loading = true;
  
  // Clear existing transactions
  this.transactions = [];
  
  // First load account transactions
  this.accountTransactionsUnsubscribe = this.accountService.getAllAccountTransactions(
    this.accountId,
    (transactions) => {
      this.processAccountTransactions(transactions);
      this.loadSalesData(); // Then load sales
    }
  );
}
private loadSalesData(): void {
  if (this.saleService.getSalesByPaymentAccount) {
    const saleSub = this.saleService.getSalesByPaymentAccount(this.accountId).subscribe({
      next: (sales: any[]) => {
        // Include all sales for this account
        const accountSales = sales.map(sale => this.mapSaleToTransaction(sale));
        this.transactions = [
          ...this.transactions.filter(t => t.source !== 'sale'),
          ...accountSales
        ];
        this.loadPurchasesData(); // Then load purchases
      },
      error: (error) => {
        console.error('Error loading sales:', error);
        this.loadPurchasesData(); // Continue with purchases even if sales fail
      }
    });
    this.subscriptions.push(saleSub);
    this.salesUnsubscribe = () => saleSub.unsubscribe();
  } else {
    this.loadPurchasesData();
  }
}

private loadPurchasesData(): void {
  // Purchases are excluded from account book - skip loading
  this.combineAndProcessTransactions();
}

private processAccountBookTransactions(transactions: any[]): void {
  const accountTransactions = transactions.map(t => ({
    id: t.id,
    date: t.date,
    description: t.description,
    paymentMethod: t.paymentMethod,
    paymentDetails: t.reference,
    note: t.note,
    debit: t.debit,
    credit: t.credit,
    balance: 0, // Will be calculated later
    hasDocument: false,
    type: t.debit > 0 ? 'expense' : 'income',
    source: 'accountBook',
    accountName: t.accountName,
    addedBy: 'System' // Or you can add this field to your transaction data
  }));
  
  this.transactions = [
    ...this.transactions.filter(t => t.source !== 'accountBook'),
    ...accountTransactions
  ];
}
  // Properly define the loadSalesFallback method as a class method
  private loadSalesFallback(): void {
    // Listen to sales for this account
    if (this.saleService.getSalesByPaymentAccount && typeof this.saleService.getSalesByPaymentAccount === 'function') {
      const salesObservable = this.saleService.getSalesByPaymentAccount(this.accountId);
      if (salesObservable && typeof salesObservable.subscribe === 'function') {
        const saleSub = salesObservable.subscribe({
          next: (sales: any[]) => {
            const accountSales = sales.map(sale => this.mapSaleToTransaction(sale));
            this.transactions = [
              ...this.transactions.filter(t => t.source !== 'sale'),
              ...accountSales
            ];
            this.combineAndProcessTransactions();
          },
          error: (error: any) => {
            console.error('Error fetching sales:', error);
            this.loading = false;
          }
        });
        this.subscriptions.push(saleSub);
        this.salesUnsubscribe = () => saleSub.unsubscribe();
      } else {
        this.salesUnsubscribe = () => {};
      }
    } else if (this.saleService['getSales']) {
      const saleSub = this.saleService['getSales']().subscribe({
        next: (sales: any[]) => {
          const accountSales = sales
            .filter((sale: any) => 
              sale.paymentAccount === this.accountId || 
              sale.paymentAccount?.id === this.accountId
            )
            .map(sale => this.mapSaleToTransaction(sale));
          this.transactions = [
            ...this.transactions.filter(t => t.source !== 'sale'),
            ...accountSales
          ];
          this.combineAndProcessTransactions();
        },
        error: (error: any) => {
          console.error('Error in fallback sale loading:', error);
          this.loading = false;
        }
      });
      this.subscriptions.push(saleSub);
      this.salesUnsubscribe = () => saleSub.unsubscribe();
    } else {
      this.salesUnsubscribe = () => {};
    }

  // Listen to expenses for this account
  if (this.expenseService.getExpensesByAccount) {
    this.expensesUnsubscribe = this.expenseService.getExpensesByAccount(
      this.accountId, 
      (expenses: Expense[]) => {
        const accountExpenses = expenses.map(expense => this.mapExpenseToTransaction(expense));
        this.transactions = [
          ...this.transactions.filter(t => t.source !== 'expense'),
          ...accountExpenses
        ];
        this.combineAndProcessTransactions();
      }
    );
  } else {
    const expenseSub = this.expenseService.getExpenses().subscribe(expenses => {
      const accountExpenses = expenses
        .filter((expense: any) => expense.paymentAccount === this.accountId)
        .map(expense => this.mapExpenseToTransaction(expense));
      this.transactions = [
        ...this.transactions.filter(t => t.source !== 'expense'),
        ...accountExpenses
      ];
      this.combineAndProcessTransactions();
    });
    this.subscriptions.push(expenseSub);
    this.expensesUnsubscribe = () => expenseSub.unsubscribe();
  }

  // Incomes are now handled through transactions collection only
  // No need to load from incomes collection separately
  this.incomesUnsubscribe = () => {};

  // Purchases are excluded from account book
}

  // Map Expense to Transaction
  mapExpenseToTransaction(expense: any): Transaction {
    return {
      id: expense.id,
      date: this.convertToDate(expense.paidOn || expense.date),
      description: `${expense.expenseCategory || 'Expense'}: ${expense.expenseNote || 'No description'}`,
      paymentMethod: expense.paymentMethod || '',
      paymentDetails: expense.referenceNo || '',
      note: expense.expenseNote || '',
      addedBy: expense.addedByDisplayName || expense.addedBy || 'System',
      debit: Number(expense.paymentAmount || 0),
      credit: 0,
      balance: 0,
      hasDocument: !!expense.document,
      type: 'expense',
      attachmentUrl: expense.document || '',
      referenceNo: expense.referenceNo,
      category: expense.expenseCategory,
      totalAmount: expense.totalAmount,
      source: 'expense'
    };
  }
  // Map Purchase to Transaction
  mapPurchaseToTransaction(purchase: any): Transaction {
    return {
      id: purchase.id,
      date: this.convertToDate(purchase.purchaseDate),
      description: `Purchase: ${purchase.referenceNo || purchase.invoiceNo || 'No reference'}`,
      paymentMethod: purchase.paymentMethod || '',
      paymentDetails: purchase.invoiceNo || '',
      note: purchase.paymentNote || purchase.additionalNotes || '',
      addedBy: this.getAddedByName(purchase.addedBy),
      debit: Number(purchase.paymentAmount || purchase.grandTotal || 0),
      credit: 0,
      balance: 0,
      hasDocument: !!purchase.document,
      type: 'purchase',
      attachmentUrl: purchase.document || '',
      referenceNo: purchase.referenceNo || purchase.invoiceNo,
      supplier: purchase.supplier,
      source: 'purchase'
    };
  }


// Update the mapSaleToTransaction method to include more details
mapSaleToTransaction(sale: any): Transaction {
  const transactionDate = this.convertToDate(sale.saleDate || sale.createdAt || new Date());
  const paymentAmount = Number(sale.paymentAmount || sale.totalAmount || sale.total || 0);
  
  return {
    id: sale.id,
    date: transactionDate,
    description: `Sale: ${sale.invoiceNo || 'No invoice'}`,
    paymentMethod: sale.paymentMethod || '',
    paymentDetails: sale.transactionId || '',
    note: sale.note || '',
    addedBy: sale.addedByDisplayName || sale.addedBy || 'System',
    debit: 0,
    credit: paymentAmount,
    balance: 0, // Will be calculated later
    hasDocument: !!sale.document,
    type: 'sale',
    attachmentUrl: sale.document || '',
    referenceNo: sale.invoiceNo,
    source: 'sale',
    customer: sale.customer,
    saleId: sale.id,
    invoiceNo: sale.invoiceNo,
    customerName: sale.customer,
    totalAmount: paymentAmount,
    paymentStatus: sale.paymentStatus || 'unpaid'
  };
}


private getEmptyTransaction(): Transaction {
  return {
    id: '',
    date: new Date(),
    description: '',
    paymentMethod: '',
    paymentDetails: '',
    note: '',
    addedBy: '',
    debit: 0,
    credit: 0,
    balance: 0,
    hasDocument: false,
    type: '',
    source: ''
  };
}
  processAccountTransactions(transactions: any[]): void {
    console.log('Raw account transactions:', transactions); // Debug log
    const accountTransactions = transactions.map(t => this.mapAccountTransaction(t));
    console.log('Mapped account transactions:', accountTransactions); // Debug log
    this.transactions = [
      ...this.transactions.filter(t => t.source !== 'account'),
      ...accountTransactions
    ];
  }mapAccountTransaction(t: any): Transaction {
    const transactionDate = this.convertToDate(t.date);
    
    let description = t.description;
    let paymentMethod = t.paymentMethod || '';
    let type = t.type || '';
    let debit = 0;
    let credit = 0;
    
    // If transaction already has debit/credit fields, use them
    if (t.debit !== undefined && t.credit !== undefined) {
      debit = Number(t.debit || 0);
      credit = Number(t.credit || 0);
    } else {
      // Calculate debit/credit from amount and type
      const amount = Number(t.amount || 0);
      
      // Handle purchase payment transactions
      if (type === 'purchase_payment') {
        description = `Purchase Payment: ${t.reference || ''}`;
        paymentMethod = t.paymentMethod || 'Cash';
        debit = amount; // Purchase payments are debits (money going out)
      }
      // Handle purchase return transactions
      else if (type === 'purchase_return') {
        description = `Purchase Return: ${t.reference || ''}`;
        paymentMethod = t.paymentMethod || 'Purchase Return';
        credit = amount; // Purchase returns are credits (money coming back)
      }
      // Handle expense transactions
      else if (type === 'expense') {
        debit = amount; // Expenses are debits (money going out)
      }
      // Handle income transactions
      else if (type === 'income') {
        credit = amount; // Income is credit (money coming in)
      }
      // Handle transfer transactions
      else if (type === 'transfer' || type === 'transfer_in' || type === 'transfer_out') {
        if (t.fromAccountId === this.accountId || type === 'transfer_out') {
          description = `Transfer to ${this.getAccountName(t.toAccountId)}`;
          paymentMethod = 'Fund Transfer';
          debit = amount; // Outgoing transfer is debit
        } else if (t.toAccountId === this.accountId || type === 'transfer_in') {
          description = `Transfer from ${this.getAccountName(t.fromAccountId)}`;
          paymentMethod = 'Fund Transfer';
          credit = amount; // Incoming transfer is credit
        }
      }
      // Default handling for other transaction types
      else {
        // If no specific rule, assume expense types are debits, others are credits
        if (type.includes('expense') || type.includes('payment')) {
          debit = amount;
        } else {
          credit = amount;
        }
      }
    }
    
    return {
      id: t.id,
      date: transactionDate,
      description: description,
      paymentMethod: paymentMethod,
      paymentDetails: t.reference || t.paymentDetails || '',
      note: t.note || '',
      addedBy: t.addedBy || 'System',
      debit: debit,
      credit: credit,
      balance: 0,
      hasDocument: t.hasDocument || false,
      type: type,
      attachmentUrl: t.attachmentUrl,
      fromAccountId: t.fromAccountId,
      toAccountId: t.toAccountId,
      referenceNo: t.reference || t.referenceNo || '',
      source: 'account'
    };
  }

  getAddedByName(addedBy: any): string {
    if (typeof addedBy === 'string') return addedBy;
    if (addedBy && typeof addedBy === 'object') {
      return addedBy.displayName || addedBy.name || addedBy.email || 'System';
    }
    return 'System';
  }

  getAccountName(accountId: string | undefined): string {
    if (!accountId) return 'Unknown Account';
    const account = this.allAccounts.find(a => a.id === accountId);
    return account ? account.name : 'Unknown Account';
  }

calculateRunningBalance(): void {
  // Sort by date (oldest first) for balance calculation, excluding purchase transactions
  const sorted = [...this.transactions]
    .filter(t => t.type !== 'purchase' && t.source !== 'purchase')
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  
  // Start from the original opening balance, not current accountDetails.balance
  let balance = this.openingBalance;

  sorted.forEach(t => {
    // Ensure we're working with numbers
    const debit = Number(t.debit) || 0;
    const credit = Number(t.credit) || 0;
    
    // Update balance based on transaction type
    if (t.type === 'transfer' || t.type === 'transfer_in' || t.type === 'transfer_out') {
      if (t.fromAccountId === this.accountId) {
        // Outgoing transfer - debit
        balance -= debit;
      } else if (t.toAccountId === this.accountId) {
        // Incoming transfer - credit
        balance += credit;
      }
    } else {
      // Regular transaction
      balance = balance + credit - debit;
    }
    
    t.balance = balance;
  });

  // Reverse to show newest first
  this.transactions = sorted.reverse();
  this.accountDetails.balance = balance;
}

combineAndProcessTransactions(): void {
  // Create a unique key for each transaction to prevent duplicates and exclude purchases
  const transactionMap = new Map<string, Transaction>();
    this.accountService.setAccountTransactions(this.accountId, this.transactions);

  this.transactions.forEach(t => {
    // Skip purchase transactions completely
    if (t.type === 'purchase' || t.source === 'purchase') {
      return;
    }
    const key = `${t.source}-${t.id}`;
    if (!transactionMap.has(key)) {
      transactionMap.set(key, t);
    }
  });
  
  // Convert back to array and sort
  this.transactions = Array.from(transactionMap.values())
    .sort((a, b) => b.date.getTime() - a.date.getTime());
  
  this.calculateRunningBalance();
  this.filterTransactions();
  this.isEmpty = this.transactions.length === 0;
  this.loading = false;
}

filterTransactions(): void {
  // Apply date filter first and exclude purchase transactions
  // Properly set date boundaries to ensure consistent filtering
  const fromDate = new Date(this.dateRange.from);
  fromDate.setHours(0, 0, 0, 0);
  
  const toDate = new Date(this.dateRange.to);
  toDate.setHours(23, 59, 59, 999);
  
  this.filteredTransactions = this.transactions.filter(t => {
    const transactionDate = t.date;
    // Exclude purchase transactions completely
    if (t.type === 'purchase' || t.source === 'purchase') {
      return false;
    }
    return transactionDate >= fromDate && transactionDate <= toDate;
  });
  
  // Apply search filter if exists
  if (this.searchQuery) {
    const query = this.searchQuery.toLowerCase();
    this.filteredTransactions = this.filteredTransactions.filter(t => 
      t.description?.toLowerCase().includes(query) ||
      t.paymentMethod?.toLowerCase().includes(query) ||
      t.addedBy?.toLowerCase().includes(query) ||
      (t.note && t.note.toLowerCase().includes(query)) ||
      (t.referenceNo && t.referenceNo.toLowerCase().includes(query)) ||
      (t.category && t.category.toLowerCase().includes(query)) ||
      (t.supplier && t.supplier.toLowerCase().includes(query)) ||
      (t.customer && t.customer.toLowerCase().includes(query))
    );
  }
    // Apply transaction type filter
  if (this.transactionType !== 'All') {
    this.filteredTransactions = this.filteredTransactions.filter(t => {
      switch(this.transactionType) {
        case 'Debit': 
          return Number(t.debit) > 0;
        case 'Credit': 
          return Number(t.credit) > 0;
        case 'Transfer': 
          return t.type === 'transfer' || t.type === 'transfer_in' || t.type === 'transfer_out';
        case 'Expense': 
          return t.type === 'expense';
        case 'Income': 
          return t.type === 'income';
        case 'Sale': 
          return t.type === 'sale';
        case 'Purchase Return':
          return t.type === 'purchase_return';
        default: 
          return true;
      }
    });
  }
  
  this.calculateTotals();
  this.currentPage = 1;
  this.updatePagedTransactions();
}

calculateTotals(): void {
  this.totalDebit = this.filteredTransactions.reduce((sum, t) => sum + Number(t.debit || 0), 0);
  this.totalCredit = this.filteredTransactions.reduce((sum, t) => sum + Number(t.credit || 0), 0);
}
getTransactionTypeDisplay(type: string | undefined): string {
  if (!type) return 'Unknown';
  
  switch(type.toLowerCase()) {
    case 'income': 
      return 'Income';
    case 'sale':
      return 'Sale';
    case 'expense': 
      return 'Expense';
    case 'purchase': 
      return 'Purchase';
    case 'purchase_return':
      return 'Purchase Return';
    case 'transfer': 
      return 'Transfer';
    case 'transfer_in': 
      return 'Transfer In';
    case 'transfer_out': 
      return 'Transfer Out';
    case 'deposit': 
      return 'Deposit';
    default: 
      return type;
  }
}


  updatePagedTransactions(): void {
    const start = (this.currentPage - 1) * this.entriesPerPage;
    this.pagedTransactions = this.filteredTransactions.slice(start, start + this.entriesPerPage);
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePagedTransactions();
    }
  }

  nextPage(): void {
    if (this.currentPage * this.entriesPerPage < this.filteredTransactions.length) {
      this.currentPage++;
      this.updatePagedTransactions();
    }
  }  onDateRangeChange(): void {
    // Use the same filtering logic as filterTransactions()
    this.filterTransactions();
  }

  onDateFromChange(dateString: string): void {
    this.dateRange.from = new Date(dateString);
    this.onDateRangeChange();
  }

  onDateToChange(dateString: string): void {
    this.dateRange.to = new Date(dateString);
    this.onDateRangeChange();
  }

  onTransactionTypeChange(): void {
    this.filterTransactions();
  }

  onSearchChange(): void {
    this.filterTransactions();
  }

deleteTransaction(id: string): void {
  if (confirm('Are you sure you want to delete this transaction?')) {
    const transaction = this.transactions.find(t => t.id === id);
    
    if (transaction) {
      // Handle accountBook transactions
      if (transaction.source === 'accountBook') {
        this.accountService.deleteAccountBookTransaction(id, this.accountId)
          .then(() => console.log('Transaction deleted successfully'))
          .catch(error => {
            console.error('Error deleting transaction:', error);
            alert('Failed to delete transaction');
          });
      }      // Handle expense source transactions
      else if (transaction.source === 'expense') {
        if (transaction.type === 'expense') {
          this.expenseService.deleteExpense(id)
            .then(() => console.log('Expense deleted successfully'))
            .catch(error => {
              console.error('Error deleting expense:', error);
              alert('Failed to delete expense');
            });
        } else if (transaction.type === 'income') {
          this.expenseService.deleteTransaction(id, 'income')
            .then(() => console.log('Income deleted successfully'))
            .catch(error => {
              console.error('Error deleting income:', error);
              alert('Failed to delete income');
            });
        }
      }
      // Income transactions are now handled through the transactions collection only
      // Purchase transactions are not displayed in account book
      // Handle sale transactions
      else if (transaction.source === 'sale') {
        this.saleService.deleteSale(id)
          .then(() => console.log('Sale deleted successfully'))
          .catch(error => {
            console.error('Error deleting sale:', error);
            alert('Failed to delete sale');
          });
      }
      // Handle default/other transactions
      else {
        if (transaction.type === 'transfer' || transaction.type === 'transfer_in' || transaction.type === 'transfer_out') {
          this.accountService.deleteFundTransfer(id)
            .then(() => console.log('Fund transfer deleted successfully'))
            .catch(error => {
              console.error('Error deleting fund transfer:', error);
              alert('Failed to delete fund transfer');
            });
        } else {
          this.accountService.deleteTransaction(id)
            .then(() => console.log('Transaction deleted successfully'))
            .catch(error => {
              console.error('Error deleting transaction:', error);
              alert('Failed to delete transaction');
            });
        }
      }
    }
  }
}

  downloadDocument(url: string | undefined): void {
    if (url) {
      window.open(url, '_blank');
    }
  }

  getMinValue(a: number, b: number): number {
    return Math.min(a, b);
  }

  editTransaction(transaction: Transaction): void {
    if (transaction.source === 'expense' || transaction.source === 'income' || 
        transaction.source === 'purchase' || transaction.source === 'sale') {
      alert(`This transaction should be edited from the ${transaction.source} module.`);
      return;
    }

    // Ensure we have a valid date
    const transactionDate = transaction.date instanceof Date && !isNaN(transaction.date.getTime()) 
      ? transaction.date 
      : new Date();

    // Format the date for the datetime-local input
    const year = transactionDate.getFullYear();
    const month = (transactionDate.getMonth() + 1).toString().padStart(2, '0');
    const day = transactionDate.getDate().toString().padStart(2, '0');
    const hours = transactionDate.getHours().toString().padStart(2, '0');
    const minutes = transactionDate.getMinutes().toString().padStart(2, '0');
    const dateString = `${year}-${month}-${day}T${hours}:${minutes}`;
    
    this.editingTransaction = {
      ...transaction,
      dateString: dateString
    };
    
    this.showEditModal = true;
  }
  
saveTransaction(): void {
  // Parse the datetime-local input value
  let updatedDate = new Date(this.editingTransaction.dateString);
  
  // If invalid, use original date
  if (isNaN(updatedDate.getTime())) {
    updatedDate = this.editingTransaction.date instanceof Date ? 
      this.editingTransaction.date : 
      new Date();
  }

  const transactionData = {
    date: updatedDate,
    description: this.editingTransaction.description,
    paymentMethod: this.editingTransaction.paymentMethod,
    debit: Number(this.editingTransaction.debit) || 0,
    credit: Number(this.editingTransaction.credit) || 0,
    note: this.editingTransaction.note,
    reference: this.editingTransaction.paymentDetails
  };

  if (this.editingTransaction.id) {
    // Update existing transaction
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
    // Add new transaction
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
  
  cancelEdit(): void {
    this.showEditModal = false;
    this.editingTransaction = this.getEmptyEditingTransaction();
  }


  openFundTransferModal(): void {
    this.showFundTransferModal = true;
    this.fundTransferForm.patchValue({
      fromAccount: this.accountId,
      date: new Date().toISOString().split('T')[0]
    });
  }
  
  closeFundTransferForm(): void {
    this.showFundTransferModal = false;
    this.fundTransferForm.reset();
    this.selectedFile = null;
    this.fundTransferForm.patchValue({
      date: new Date().toISOString().split('T')[0]
    });
  }

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
    if (this.fundTransferForm.invalid) {
      Object.keys(this.fundTransferForm.controls).forEach(key => {
        this.fundTransferForm.get(key)?.markAsTouched();
      });
      return;
    }
    
    const formValue = this.fundTransferForm.value;
    const fromAccountName = this.getAccountName(formValue.fromAccount);
    const toAccountName = this.getAccountName(formValue.toAccount);
    const now = new Date();
    const transactionDate = new Date(formValue.date);
    
    transactionDate.setHours(now.getHours());
    transactionDate.setMinutes(now.getMinutes());
    transactionDate.setSeconds(now.getSeconds());
    
    const transferData = {
      fromAccountId: formValue.fromAccount,
      fromAccountName: fromAccountName,
      toAccountId: formValue.toAccount,
      toAccountName: toAccountName,
      amount: Number(formValue.amount),
      date: transactionDate,
      note: formValue.note || '',
      addedBy: this.authService.getCurrentUserName(),
      type: 'transfer',
      hasDocument: !!this.selectedFile,
      timestamp: new Date().getTime()
    };
    
    // Create fund transfer data
    if (this.selectedFile) {
      console.log('File would be uploaded here:', this.selectedFile.name);
    }
    
    this.accountService.addFundTransfer(transferData).then(() => {
      this.closeFundTransferForm();
    }).catch((error) => {
      console.error('Error adding fund transfer:', error);
      alert('Failed to add fund transfer');
    });
  }

  downloadTransactionData(): void {
    if (this.filteredTransactions.length === 0) {
      alert('No data to download');
      return;
    }

    let csvContent = 'Date,Description,Payment Method,Payment Details,Note,Added By,Debit,Credit,Balance,Type,Reference No,Category,Source\n';
    
    this.filteredTransactions.forEach(t => {
      const formattedDate = this.datePipe.transform(t.date, 'MM/dd/yyyy HH:mm') || '';
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
      
      csvContent += `${formattedDate},"${description}","${paymentMethod}","${paymentDetails}","${note}","${addedBy}",${debit},${credit},${balance},"${type}","${referenceNo}","${category}","${source}"\n`;
    });
    
    csvContent += `Total,,,,,,,${this.totalDebit},${this.totalCredit},,,,\n`;
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = window.URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `${this.accountDetails.name}_all_transactions.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}