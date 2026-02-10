import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';import { AccountService } from '../services/account.service';
import { FormBuilder, FormGroup } from '@angular/forms';
import * as XLSX from 'xlsx'; // Import the xlsx library
import { DatePipe, formatDate } from '@angular/common'; // Added formatDate

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
  @ViewChild('fromDatePicker') fromDatePicker!: ElementRef;
  @ViewChild('toDatePicker') toDatePicker!: ElementRef;

  allAccounts: any[] = [];
  transactions: CashFlowTransaction[] = [];
  filteredTransactions: CashFlowTransaction[] = [];
  pagedTransactions: CashFlowTransaction[] = [];
  totalDebit: number = 0;
  totalCredit: number = 0;
  loading: boolean = true;
  isLoading: boolean = false;
  isEmpty: boolean = false;

  trialBalanceItems: TrialBalanceItem[] = [
    { name: 'Supplier Due', debit: null, credit: null },
    { name: 'Customer Due', debit: null, credit: null }
  ];
  accountBalanceItems: TrialBalanceItem[] = [];

  currentPage: number = 1;
  entriesPerPage: number = 25;

  viewMode: 'table' | 'card' = 'table';
  filterForm: FormGroup;

  constructor(
    private accountService: AccountService,
    private datePipe: DatePipe,
    private fb: FormBuilder
  ) {
    this.filterForm = this.fb.group({
      fromDate: [new Date(new Date().setDate(new Date().getDate() - 30))],
      toDate: [new Date()],
      transactionType: ['All'],
      searchQuery: [''],
      accountId: ['All'],
      entriesPerPage: [25] // Added entries per page to the form
    });
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
  openDatePicker(type: 'from' | 'to'): void {
    if (type === 'from') {
      this.fromDatePicker.nativeElement.showPicker();
    } else {
      this.toDatePicker.nativeElement.showPicker();
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
        
        const formattedDate = `${year}-${month}-${day}`;
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
  ngOnInit(): void {
    this.loadAccounts();
    this.loadTrialBalance();

    // Subscribe to form changes to re-filter data
    this.filterForm.valueChanges.subscribe(values => {
      this.entriesPerPage = +values.entriesPerPage;
      this.filterTransactions();
    });
  }

  loadAccounts(): void {
    this.loading = true;
    this.accountService.getAccounts((accounts) => {
      this.allAccounts = accounts;
      this.loadAllTransactions();
    });
  }

  loadAllTransactions(): void {
    this.loading = true;
    const selectedAccountId = this.filterForm.get('accountId')?.value;
    const accountsToProcess = selectedAccountId === 'All'
      ? this.allAccounts
      : this.allAccounts.filter(acc => acc.id === selectedAccountId);

    if (accountsToProcess.length === 0) {
      this.transactions = [];
      this.filterTransactions();
      this.loading = false;
      return;
    }

    let allTransactions: CashFlowTransaction[] = [];
    let accountsProcessed = 0;

    accountsToProcess.forEach(account => {
      this.accountService.getAllAccountTransactions(account.id, (transactions) => {
        const mappedTransactions = transactions.map(t => ({
          id: t.id,
          date: new Date(t.date),
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
          totalBalance: 0,
          type: t.type || 'transaction',
          hasDocument: !!t.hasDocument,
          attachmentUrl: t.attachmentUrl
        }));

        allTransactions = [...allTransactions, ...mappedTransactions];
        accountsProcessed++;

        if (accountsProcessed === accountsToProcess.length) {
          allTransactions.sort((a, b) => b.date.getTime() - a.date.getTime());
          this.calculateTotalBalance(allTransactions);
          this.transactions = allTransactions;
          this.filterTransactions(); // Apply initial filters
          this.loading = false;
        }
      });
    });
  }

  calculateTotalBalance(transactions: CashFlowTransaction[]): void {
    const sorted = [...transactions].sort((a, b) => a.date.getTime() - b.date.getTime());
    let runningTotal = this.allAccounts.reduce((sum, acc) => sum + (acc.openingBalance || 0), 0);
    sorted.forEach(t => {
      runningTotal += t.credit - t.debit;
      t.totalBalance = runningTotal;
    });
  }

  filterTransactions(): void {
    const filters = this.filterForm.value;
    const fromDate = new Date(filters.fromDate);
    const toDate = new Date(filters.toDate);
    toDate.setHours(23, 59, 59, 999); // Include the entire 'to' day

    let filtered = this.transactions.filter(t => {
      const transactionDate = new Date(t.date);
      return transactionDate >= fromDate && transactionDate <= toDate;
    });

    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        Object.values(t).some(val => String(val).toLowerCase().includes(query))
      );
    }

    if (filters.transactionType !== 'All') {
      if (filters.transactionType === 'Debit') {
        filtered = filtered.filter(t => t.debit > 0);
      } else if (filters.transactionType === 'Credit') {
        filtered = filtered.filter(t => t.credit > 0);
      }
    }
    
    // Account filter is handled by `loadAllTransactions`, but we ensure consistency
    if (filters.accountId !== 'All') {
        const selectedAccount = this.allAccounts.find(a => a.id === filters.accountId);
        if (selectedAccount) {
            filtered = filtered.filter(t => t.account === selectedAccount.name);
        }
    }


    this.filteredTransactions = filtered;
    this.calculateTotals();
    this.currentPage = 1;
    this.updatePagedTransactions();
    this.isEmpty = this.filteredTransactions.length === 0;
  }

  calculateTotals(): void {
    this.totalDebit = this.filteredTransactions.reduce((sum, t) => sum + t.debit, 0);
    this.totalCredit = this.filteredTransactions.reduce((sum, t) => sum + t.credit, 0);
  }

  updatePagedTransactions(): void {
    const start = (this.currentPage - 1) * this.entriesPerPage;
    const end = start + this.entriesPerPage;
    this.pagedTransactions = this.filteredTransactions.slice(start, end);
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePagedTransactions();
    }
  }

  nextPage(): void {
    if ((this.currentPage * this.entriesPerPage) < this.filteredTransactions.length) {
      this.currentPage++;
      this.updatePagedTransactions();
    }
  }

  getMinValue(a: number, b: number): number {
    return Math.min(a, b);
  }

  /**
   * Generates and downloads an Excel file from the filtered transactions.
   */
  downloadCashFlowData(): void {
    if (this.filteredTransactions.length === 0) {
      alert('No data to download.');
      return;
    }

    // 1. Map the data to a simpler format for the Excel sheet
    const dataForExcel = this.filteredTransactions.map(t => ({
      'Date': this.datePipe.transform(t.date, 'MM/dd/yyyy HH:mm'),
      'Account': t.account,
      'Description': t.description,
      'Payment Method': t.paymentMethod,
      'Note': t.note,
      'Added By': t.addedBy,
      'Debit': t.debit,
      'Credit': t.credit,
      'Account Balance': t.accountBalance,
      'Total Balance': t.totalBalance
    }));

    // 2. Create a worksheet from the data
    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(dataForExcel);

    // Optional: Set column widths for better readability
    const colWidths = [{ wch: 20 }, { wch: 25 }, { wch: 40 }, { wch: 20 }, { wch: 30 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
    ws['!cols'] = colWidths;
    
    // Add total row at the bottom
    XLSX.utils.sheet_add_json(ws,
        [{ 'Debit': this.totalDebit, 'Credit': this.totalCredit }],
        { header: ['Debit', 'Credit'], skipHeader: true, origin: -1 } // -1 means append from the end
    );


    // 3. Create a workbook and add the worksheet
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'CashFlow');

    // 4. Trigger the download
    const fileName = `CashFlow_Report_${this.datePipe.transform(new Date(), 'yyyyMMdd')}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }
  
  // No changes needed for the rest of the methods
  // ... (downloadDocument, loadTrialBalance, etc.)
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