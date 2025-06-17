import { Component, OnInit } from '@angular/core';
import { AccountService } from '../services/account.service';
import { DatePipe } from '@angular/common';
import { FormBuilder, FormGroup } from '@angular/forms';

interface CashFlowTransaction {
  id: string;
  date: Date;
  account: string;
  description: string;
  paymentMethod: string;
  paymentDetails: string;
  note: string;
  addedBy: string;
  debit: number;
  credit: number;
  balance: number;
  accountBalance: number;
  totalBalance: number;
  type: string;
  hasDocument: boolean;
  attachmentUrl?: string;
}

interface TrialBalanceItem {
  name: string;
  debit: number | null;
  credit: number | null;
}

@Component({
  selector: 'app-cash-flow',
  templateUrl: './cash-flow.component.html',
  styleUrls: ['./cash-flow.component.scss'],
  providers: [DatePipe]
})
export class CashFlowComponent implements OnInit {
  allAccounts: any[] = [];
  transactions: CashFlowTransaction[] = [];
  filteredTransactions: CashFlowTransaction[] = [];
  pagedTransactions: CashFlowTransaction[] = [];
  totalDebit: number = 0;
  totalCredit: number = 0;
  loading: boolean = true; // Set to true initially to show loading
  isLoading: boolean = false; // Added for trial balance loading state
  isEmpty: boolean = false; // Set to false by default, will be updated after loading
  
  // Trial Balance properties
  trialBalanceItems: TrialBalanceItem[] = [
    { name: 'Supplier Due', debit: null, credit: null },
    { name: 'Customer Due', debit: null, credit: null }
  ];
  accountBalanceItems: TrialBalanceItem[] = [];
  
  // Pagination
  currentPage: number = 1;
  entriesPerPage: number = 25;
  
  // Filter options
  viewMode: 'table' | 'card' = 'table';
  dateRange = {
    from: new Date(new Date().setDate(new Date().getDate() - 30)),
    to: new Date()
  };
  transactionType: string = 'All';
  searchQuery: string = '';
  
  filterForm: FormGroup;

  constructor(
    private accountService: AccountService,
    private datePipe: DatePipe,
    private formBuilder: FormBuilder
  ) {
    this.filterForm = this.formBuilder.group({
      fromDate: [this.dateRange.from],
      toDate: [this.dateRange.to],
      transactionType: ['All'],
      searchQuery: [''],
      accountId: ['All']
    });
  }

  ngOnInit(): void {
    // First load accounts
    this.loadAccounts();
    
    // Load trial balance
    this.loadTrialBalance();
    
    // Watch for filter changes
    this.filterForm.valueChanges.subscribe(() => {
      this.applyFilters();
    });
  }

  loadAccounts(): void {
    this.loading = true; // Show loading indicator
    this.accountService.getAccounts((accounts) => {
      this.allAccounts = accounts;
      // After accounts are loaded, load transactions
      this.loadAllTransactions();
    });
  }

  loadAllTransactions(): void {
    this.loading = true;
    let accountsProcessed = 0;
    let allTransactions: CashFlowTransaction[] = [];
    
    // If no accounts found or loading
    if (this.allAccounts.length === 0) {
      this.isEmpty = true;
      this.loading = false;
      return;
    }
    
    // Filter by account if selected
    const selectedAccountId = this.filterForm.get('accountId')?.value;
    const accountsToProcess = selectedAccountId === 'All' ? 
      this.allAccounts : 
      this.allAccounts.filter(acc => acc.id === selectedAccountId);
    
    if (accountsToProcess.length === 0) {
      this.transactions = [];
      this.filteredTransactions = [];
      this.pagedTransactions = [];
      this.isEmpty = true;
      this.loading = false;
      return;
    }
    
    // Process each account
    accountsToProcess.forEach(account => {
      this.accountService.getAllAccountTransactions(account.id, (transactions) => {
        // Map transactions to our format with account info
        const mappedTransactions: CashFlowTransaction[] = transactions.map(t => {
          return {
            id: t.id,
            date: new Date(t.date), // Ensure date is properly converted
            account: account.name,
            description: t.description,
            paymentMethod: t.paymentMethod || '',
            paymentDetails: t.paymentDetails || '',
            note: t.note || '',
            addedBy: t.addedBy || 'System',
            debit: Number(t.debit) || 0,
            credit: Number(t.credit) || 0,
            balance: t.balance || 0,
            accountBalance: t.balance || 0,
            totalBalance: 0, // Will calculate later
            type: t.type || 'transaction',
            hasDocument: t.hasDocument || false,
            attachmentUrl: t.attachmentUrl
          };
        });
        
        allTransactions = [...allTransactions, ...mappedTransactions];
        
        accountsProcessed++;
        
        // Once all accounts are processed
        if (accountsProcessed === accountsToProcess.length) {
          // Sort by date (newest first)
          allTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          
          // Calculate total balance
          this.calculateTotalBalance(allTransactions);
          
          this.transactions = allTransactions;
          this.filterTransactions();
          this.loading = false;
          this.isEmpty = this.filteredTransactions.length === 0;
        }
      });
    });
  }
  
  calculateTotalBalance(transactions: CashFlowTransaction[]): void {
    // Sort by date (oldest first) for running total calculation
    const sortedTransactions = [...transactions].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime());
    
    let runningTotal = 0;
    // Calculate initial balance from all accounts
    this.allAccounts.forEach(account => {
      runningTotal += account.openingBalance || 0;
    });
    
    // Calculate running total
    sortedTransactions.forEach(t => {
      runningTotal = runningTotal + t.credit - t.debit;
      t.totalBalance = runningTotal;
    });
    
    // Resort to newest first
    transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  applyFilters(): void {
    // Get values from form
    const formValues = this.filterForm.value;
    this.dateRange.from = formValues.fromDate;
    this.dateRange.to = formValues.toDate;
    this.transactionType = formValues.transactionType;
    this.searchQuery = formValues.searchQuery;
    
    // Load fresh data with new filters
    this.loadAllTransactions();
  }

  filterTransactions(): void {
    // Apply date filter
    this.filteredTransactions = this.transactions.filter(t => {
      const transactionDate = new Date(t.date);
      return transactionDate >= new Date(this.dateRange.from) && 
             transactionDate <= new Date(this.dateRange.to);
    });
    
    // Apply search filter
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      this.filteredTransactions = this.filteredTransactions.filter(t => 
        t.description.toLowerCase().includes(query) ||
        t.account.toLowerCase().includes(query) ||
        t.paymentMethod.toLowerCase().includes(query) ||
        t.addedBy.toLowerCase().includes(query) ||
        (t.note && t.note.toLowerCase().includes(query))
      );
    }
    
    // Apply transaction type filter
    if (this.transactionType !== 'All') {
      if (this.transactionType === 'Debit') {
        this.filteredTransactions = this.filteredTransactions.filter(t => t.debit > 0);
      } else if (this.transactionType === 'Credit') {
        this.filteredTransactions = this.filteredTransactions.filter(t => t.credit > 0);
      } else if (this.transactionType === 'Transfer') {
        this.filteredTransactions = this.filteredTransactions.filter(t => 
          t.type === 'transfer' || 
          t.type === 'transfer_in' || 
          t.type === 'transfer_out'
        );
      }
    }
    
    // Calculate totals
    this.calculateTotals();
    
    // Update pagination
    this.currentPage = 1;
    this.updatePagedTransactions();
    
    // Check if empty
    this.isEmpty = this.filteredTransactions.length === 0;
  }
  
  calculateTotals(): void {
    this.totalDebit = this.filteredTransactions.reduce((sum, t) => sum + t.debit, 0);
    this.totalCredit = this.filteredTransactions.reduce((sum, t) => sum + t.credit, 0);
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
  }
  
  getMinValue(a: number, b: number): number {
    return Math.min(a, b);
  }
  
  // Download cash flow data as CSV
  downloadCashFlowData(): void {
    if (this.filteredTransactions.length === 0) {
      alert('No data to download');
      return;
    }

    // Create CSV data
    let csvContent = 'Date,Account,Description,Payment Method,Payment Details,Note,Added By,Debit,Credit,Account Balance,Total Balance\n';
    
    this.filteredTransactions.forEach(t => {
      const formattedDate = this.datePipe.transform(t.date, 'MM/dd/yyyy HH:mm') || '';
      const account = t.account.replace(/,/g, ' ');
      const description = t.description.replace(/,/g, ' ');
      const paymentMethod = t.paymentMethod.replace(/,/g, ' ');
      const paymentDetails = (t.paymentDetails || '').replace(/,/g, ' ');
      const note = (t.note || '').replace(/,/g, ' ');
      const addedBy = t.addedBy.replace(/,/g, ' ');
      
      csvContent += `${formattedDate},"${account}","${description}","${paymentMethod}","${paymentDetails}","${note}","${addedBy}",${t.debit},${t.credit},${t.accountBalance},${t.totalBalance}\n`;
    });
    
    // Add total row
    csvContent += `Total,,,,,,,,${this.totalDebit},${this.totalCredit},,\n`;
    
    // Create a Blob with the CSV data
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // Create a download link
    const link = document.createElement('a');
    const url = window.URL.createObjectURL(blob);
    
    // Set link properties
    link.setAttribute('href', url);
    link.setAttribute('download', `cash_flow_${this.datePipe.transform(new Date(), 'yyyyMMdd')}.csv`);
    link.style.visibility = 'hidden';
    
    // Append to document, click to download, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Added downloadDocument method to handle document downloads for transactions
  downloadDocument(transaction: CashFlowTransaction): void {
    if (!transaction.hasDocument || !transaction.attachmentUrl) {
      alert('No document attached to this transaction');
      return;
    }
    
    // Create a link to download the attachment
    const link = document.createElement('a');
    link.setAttribute('href', transaction.attachmentUrl);
    link.setAttribute('download', `document_${transaction.id}`);
    link.setAttribute('target', '_blank');
    link.style.visibility = 'hidden';
    
    // Append to document, click to download, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Trial Balance Methods
  loadTrialBalance(): void {
    this.isLoading = true;
    
    // Fetch supplier due data
    this.fetchSupplierDueData();
    
    // Fetch customer due data
    this.fetchCustomerDueData();
    
    // Fetch account balances
    this.fetchAccountBalances();
    
    // Simulate API call completion
    setTimeout(() => {
      this.isLoading = false;
    }, 1000);
  }
  
  fetchSupplierDueData(): void {
    // In a real application, you would make an API call here
    // For this example, I'm using mock data
    const supplierDue = 15000; // Example value
    
    // Determine if it's a debit or credit
    if (supplierDue > 0) {
      this.trialBalanceItems[0].credit = supplierDue;
      this.trialBalanceItems[0].debit = null;
    } else {
      this.trialBalanceItems[0].debit = Math.abs(supplierDue);
      this.trialBalanceItems[0].credit = null;
    }
  }
  
  fetchCustomerDueData(): void {
    // In a real application, you would make an API call here
    // For this example, I'm using mock data
    const customerDue = 25000; // Example value
    
    // Determine if it's a debit or credit
    if (customerDue > 0) {
      this.trialBalanceItems[1].debit = customerDue;
      this.trialBalanceItems[1].credit = null;
    } else {
      this.trialBalanceItems[1].credit = Math.abs(customerDue);
      this.trialBalanceItems[1].debit = null;
    }
  }
  
  fetchAccountBalances(): void {
    // In a real application, you would use the account data
    // For this example, I'm creating mock data
    this.accountBalanceItems = [
      { name: 'Cash', debit: 10000, credit: null },
      { name: 'Bank Account 1', debit: 35000, credit: null },
      { name: 'Bank Account 2', debit: null, credit: 5000 },
      { name: 'Sales', debit: null, credit: 50000 },
      { name: 'Expenses', debit: 20000, credit: null }
    ];
    
    // Calculate the total debit and credit for all items
    this.calculateTrialBalanceTotals();
  }
  
  calculateTrialBalanceTotals(): void {
    // Reset totals
    let totalDebit = 0;
    let totalCredit = 0;
    
    // Add supplier and customer due amounts
    this.trialBalanceItems.forEach(item => {
      if (item.debit) totalDebit += item.debit;
      if (item.credit) totalCredit += item.credit;
    });
    
    // Add account balance amounts
    this.accountBalanceItems.forEach(item => {
      if (item.debit) totalDebit += item.debit;
      if (item.credit) totalCredit += item.credit;
    });
    
    // Only update the trial balance totals - not the transaction totals
    // Keep the transaction totals separate
  }
  
  // Method to download trial balance as CSV
  downloadTrialBalanceData(): void {
    // Create CSV data
    let csvContent = 'Trial Balance,Debit,Credit\n';
    
    // Add supplier due row
    csvContent += `Supplier Due,${this.trialBalanceItems[0].debit || ''},${this.trialBalanceItems[0].credit || ''}\n`;
    
    // Add customer due row
    csvContent += `Customer Due,${this.trialBalanceItems[1].debit || ''},${this.trialBalanceItems[1].credit || ''}\n`;
    
    // Add account balance header
    csvContent += 'Account Balances,,\n';
    
    // Add account balance items
    this.accountBalanceItems.forEach(item => {
      csvContent += `${item.name},${item.debit || ''},${item.credit || ''}\n`;
    });
    
    // Calculate trial balance totals
    let totalDebit = 0;
    let totalCredit = 0;
    
    // Add supplier and customer due amounts
    this.trialBalanceItems.forEach(item => {
      if (item.debit) totalDebit += item.debit;
      if (item.credit) totalCredit += item.credit;
    });
    
    // Add account balance amounts
    this.accountBalanceItems.forEach(item => {
      if (item.debit) totalDebit += item.debit;
      if (item.credit) totalCredit += item.credit;
    });
    
    // Add total row
    csvContent += `Total,${totalDebit.toFixed(2)},${totalCredit.toFixed(2)}\n`;
    
    // Create a Blob with the CSV data
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // Create a download link
    const link = document.createElement('a');
    const url = window.URL.createObjectURL(blob);
    
    // Set link properties
    link.setAttribute('href', url);
    link.setAttribute('download', `trial_balance_${this.datePipe.transform(new Date(), 'yyyyMMdd')}.csv`);
    link.style.visibility = 'hidden';
    
    // Append to document, click to download, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}