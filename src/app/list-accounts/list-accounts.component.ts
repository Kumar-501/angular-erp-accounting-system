import {  OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AccountService } from '../services/account.service';
import { Router } from '@angular/router';
import { collection, addDoc, Firestore, writeBatch, doc } from '@angular/fire/firestore';
import { UserService } from '../services/user.service';
import { Component, ElementRef, ViewChild } from '@angular/core';
import { SaleService } from '../services/sale.service';
import { AccountDataService } from '../services/account-data.service'; // <-- Import the new service


import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

@Component({
  selector: 'app-list-accounts',
  templateUrl: './list-accounts.component.html',
  styleUrls: ['./list-accounts.component.scss']
})
export class ListAccountsComponent implements OnInit {
removeAccountDetail(_t226: number) {
throw new Error('Method not implemented.');
}
addAccountDetail() {
throw new Error('Method not implemented.');
}
  accountForm!: FormGroup;
  fundTransferForm!: FormGroup;
  sortColumn: string = 'name';
  sortDirection: 'asc' | 'desc' = 'asc';
  @ViewChild('table') table!: ElementRef;
  depositForm!: FormGroup;
  showModal = false;
  showFundTransferModal = false;
searchTerm: string = '';
filteredAccounts: any[] = [];
  showDepositModal = false;
transactions: any[] = [];
accountTransactions: { [key: string]: any[] } = {};
debitCreditTotals: { [key: string]: { debit: number, credit: number } } = {};  showCloseConfirmModal = false;
  accounts: any[] = [];
  isEdit = false;
  currentUser: any;
  users: any[] = [];
  sales: any[] = [];
  currentAccountId: string | null = null;
  selectedFromAccount: any = null;
  selectedAccount: any = null;
  accountToClose: any = null;
  totalBalance: string = '0.00';

  // UI properties
  activeTab = 'Accounts';
  entriesPerPage = 25;
  totalEntries = 0;
  currentPage = 1;
  unlinkedPayments = 3;
acc: any;

  // **NEW**: State flags to ensure all data is loaded before processing
  private accountsLoaded = false;
  private transactionsLoaded = false;
  private salesLoaded = false;

  constructor(
    private fb: FormBuilder,
    private accountService: AccountService,
    private router: Router,
        private accountDataService: AccountDataService ,// <-- Inject here

    private firestore: Firestore,
    private userService: UserService,
    private saleService: SaleService
  ) {}
ngOnInit(): void {
  this.initForm();
  this.initFundTransferForm();
  this.initDepositForm();

      this.loadAccounts();

  this.loadUsers();
  
  this.userService.getCurrentUser().subscribe(user => {
    this.currentUser = user;
  });
  
  // Load accounts and transactions
  this.loadAccountsRealtime();
  this.loadTransactionsRealtime(); // CRITICAL: Load transactions
  this.loadSalesRealtime(); // CRITICAL: Load sales
}

 getAccountHeadOptions(): any[] {
  return [
    {
      group: 'Asset',
      options: [
        { value: 'Asset|fixed_assets', label: 'Fixed Assets' },
        { value: 'Asset|deposits_assets', label: 'Deposits (Assets)' },
        { value: 'Asset|investments', label: 'Investments' },
        { value: 'Asset|loans_advances', label: 'Loans and Advances' },
        { value: 'Asset|sundry_debtors', label: 'Sundry Debtors' },
        { value: 'Asset|suspense_account', label: 'Suspense A/C' },
        { value: 'Asset|income_receivables', label: 'Income Receivables' },
        { value: 'Asset|input_tax_credits', label: 'Input Tax Credits' },
        { value: 'Asset|prepaid_advances', label: 'Prepaid Advances' },
        { value: 'Asset|bank_accounts', label: 'Banks' },
        { value: 'Asset|current_assets', label: 'Current Assets' }
      ]
    },
   

    {
      group: 'Equity',
      options: [
        { value: 'Equity|capital_account', label: 'Capital Account' }
      ]
    },
    {
      group: 'Liabilities',
      options: [
        { value: 'Liabilities|current_liabilities', label: 'Current Liabilities' },
        { value: 'Liabilities|duties_taxes', label: 'Duties and Taxes' },
        { value: 'Liabilities|loans_liabilities', label: 'Loans (Liabilities)' },
        { value: 'Liabilities|secured_loans', label: 'Secured Loans' },
        { value: 'Liabilities|sundry_creditors', label: 'Sundry Creditors' },
        { value: 'Liabilities|expenses_payable', label: 'Expense Payable' },
        { value: 'Liabilities|advance_earned', label: 'Advance Earned' },
        { value: 'Liabilities|tax_payable', label: 'Tax Payable' },
        { value: 'Liabilities|tds_payable', label: 'TDS Payable' }
      ]
    }
  ];
}

initDepositForm(): void {
  this.depositForm = this.fb.group({
    depositTo: ['', Validators.required],
    amount: [0, [Validators.required, Validators.min(1)]],
    depositFrom: [''],
    date: [new Date().toISOString().split('T')[0], Validators.required],
    note: [''],
    attachmentUrl: ['']
  });
}
  loadUsers(): void {
    this.userService.getUsers().subscribe(users => {
      this.users = users;
    });
  }

  loadAccounts(): void {
    this.accountService.getAccounts((fetchedAccounts) => {
      this.accounts = fetchedAccounts;

      // --- THIS IS THE CRITICAL NEW LINE ---
      // After fetching the accounts for this component,
      // also send a copy to the shared service for other components to use.
      this.accountDataService.updateAccounts(this.accounts);

      // ... rest of your existing logic for this component
    });
  }

// **MODIFIED**: Sets a flag and calls the central processing function
loadAccountsRealtime(): void {
  this.accountService.getAccounts((accounts: any[]) => {
    this.accounts = accounts;
    this.accountsLoaded = true;
    this.processAccountTransactions();
  });
}

// ================================================================
// ========= REPLACE THIS ENTIRE FUNCTION IN list-accounts.component.ts =========
// ================================================================

private async updateAccountBalancesInDatabase(): Promise<void> {
  if (!this.accounts || this.accounts.length === 0) {
    return;
  }
  
  console.log('🔄 Checking for balance discrepancies and updating database...');
  
  try {
    const balanceUpdates = new Map<string, number>();
    
    this.accounts.forEach(account => {
      // 1. Store the balance that was originally loaded from the database.
      const storedBalanceInDB = account.currentBalance || 0; 
      
      // 2. Calculate the fresh, transaction-based balance.
      const calculatedBalance = this.calculateAccountCurrentBalance(account);
      
      // 3. Compare the FRESHLY CALCULATED balance with the ORIGINAL database balance.
      if (Math.abs(calculatedBalance - storedBalanceInDB) > 0.01) {
        balanceUpdates.set(account.id, calculatedBalance);
        console.log(`📊 Balance update needed for ${account.name}: ${storedBalanceInDB.toFixed(2)} → ${calculatedBalance.toFixed(2)}`);
      }
      
      // 4. Finally, update the local component's account object for the UI.
      account.currentBalance = calculatedBalance;
    });
    
    if (balanceUpdates.size > 0) {
      await this.accountService.batchUpdateCurrentBalances(balanceUpdates);
      console.log(`✅ Successfully updated ${balanceUpdates.size} account balances in database`);
    } else {
      console.log('✅ All account balances are up to date in the database.');
    }
  } catch (error) {
    console.error('❌ Error updating account balances:', error);
  }
}
calculateAccountCurrentBalance(account: any): number {
  if (!account || !account.id) {
    return 0;
  }

  const openingBalance = Number(account.openingBalance || 0);
  const transactionsForAccount = this.accountTransactions[account.id] || [];

  if (transactionsForAccount.length === 0) {
    return openingBalance;
  }

  const finalBalance = transactionsForAccount.reduce((balance, transaction) => {
    const credit = Number(transaction.credit) || 0;
    const debit = Number(transaction.debit) || 0;
    
    if (transaction.isCapitalTransaction === true) {
      return balance + credit + debit;
    } else {
      return balance + credit - debit;
    }
  }, openingBalance);

  return finalBalance;
}

// Use this method in your template
getAccountCurrentBalance(account: any): number {
  // Always use the calculated balance from transactions
  return this.calculateAccountCurrentBalance(account);
}

// OPTIONAL: Add a refresh button to manually update balances
async refreshAllBalances(): Promise<void> {
  console.log('🔄 Refreshing all account balances...');
  
  // Recalculate all balances
  this.accounts.forEach(account => {
    const calculatedBalance = this.calculateAccountCurrentBalance(account);
    account.currentBalance = calculatedBalance;
  });
  
  // Optionally save to database
  const updates = new Map<string, number>();
  this.accounts.forEach(account => {
    updates.set(account.id, account.currentBalance);
  });
  
  await this.accountService.batchUpdateCurrentBalances(updates);
  
  this.applySearchFilter();
  this.calculateTotalBalance();
  
  console.log('✅ All balances refreshed');
}

// **MODIFIED & FIXED**: This is now the central coordinator.
private processAccountTransactions(): void {
  // Guard prevents the function from running until all data is ready.
  if (!this.accountsLoaded || !this.transactionsLoaded || !this.salesLoaded) {
    console.log('⏳ Data not fully loaded, skipping transaction processing for now...');
    return;
  }
  console.log('✅ All data loaded, processing transactions...');

  this.accountTransactions = {};
  this.debitCreditTotals = {};
  const processedTxIds = new Set<string>();

  // Process regular transactions
  this.transactions.forEach(transaction => {
    const accountId = transaction.accountId;
    if (!accountId || processedTxIds.has(transaction.id)) return;
    processedTxIds.add(transaction.id);
    if (!this.accountTransactions[accountId]) this.accountTransactions[accountId] = [];
    this.accountTransactions[accountId].push(transaction);
  });

  // Process sales as credit entries
  this.sales.forEach(sale => {
    const accountId = sale.paymentAccountId || sale.paymentAccount;
    if (!accountId) return;
    
    const paymentAmount = this.calculateSalesPaymentAmount(sale);
    if (paymentAmount > 0) {
      if (!this.accountTransactions[accountId]) this.accountTransactions[accountId] = [];
      
      const saleTransactionId = `sale_${sale.id}`;
      
      if (!processedTxIds.has(saleTransactionId)) {
        this.accountTransactions[accountId].push({ 
          id: saleTransactionId, 
          credit: paymentAmount, 
          debit: 0, 
          type: 'sale',
          source: 'sale',
          description: `Sale: ${sale.invoiceNo || 'N/A'}`,
          date: this.convertToDate(sale.paidOn || sale.saleDate || sale.createdAt),
          hasReturns: sale.hasReturns || false,
          saleStatus: sale.status || 'Completed'
        });
        processedTxIds.add(saleTransactionId);
      }
    }
  });
  
  // Calculate debit/credit totals
  Object.keys(this.accountTransactions).forEach(accountId => {
    const txns = this.accountTransactions[accountId];
    const totalDebit = txns.reduce((sum, t) => sum + (Number(t.debit) || 0), 0);
    const totalCredit = txns.reduce((sum, t) => sum + (Number(t.credit) || 0), 0);
    this.debitCreditTotals[accountId] = { debit: totalDebit, credit: totalCredit };
  });

  // **CORE FIX**: Call the database sync function. This function will now
  // handle the balance calculation, comparison, local state update, and DB update.
  this.updateAccountBalancesInDatabase();
  
  // Update the UI with the fresh data
  this.applySearchFilter();
  this.sortData(this.sortColumn);
  this.calculateTotalBalance();
}



// **MODIFIED**: Sets a flag and calls the central processing function
loadTransactionsRealtime(): void {
  this.accountService.getAllTransactions((transactions) => {
    this.transactions = transactions;
    this.transactionsLoaded = true;
    this.processAccountTransactions();
  });
}
 sortData(column: string, toggleDirection: boolean = true): void {
    if (this.sortColumn === column && toggleDirection) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    this.filteredAccounts.sort((a, b) => {
      let valueA, valueB;

      if (column === 'balance') {
        valueA = this.getAccountCurrentBalance(a);
        valueB = this.getAccountCurrentBalance(b);
      } else if (column === 'accountHead') {
        valueA = a.accountHead ? `${a.accountHead.group} ${a.accountHead.value}` : '';
        valueB = b.accountHead ? `${b.accountHead.group} ${b.accountHead.value}` : '';
      } else {
        valueA = a[column] ?? '';
        valueB = b[column] ?? '';
      }

      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return this.sortDirection === 'asc' ? valueA - valueB : valueB - valueA;
      }

      const comparison = String(valueA).toLowerCase().localeCompare(String(valueB).toLowerCase());
      return this.sortDirection === 'asc' ? comparison : -comparison;
    });

    this.calculateTotalBalance();
  }
  applySearchFilter(): void {
    const searchTermLower = this.searchTerm.toLowerCase().trim();
    
    this.filteredAccounts = this.searchTerm
      ? this.accounts.filter(account =>
          (account.name?.toLowerCase().includes(searchTermLower)) ||
          (account.accountNumber?.toLowerCase().includes(searchTermLower)) ||
          (account.accountHead?.value?.toLowerCase().includes(searchTermLower)) ||
          (account.accountHead?.group?.toLowerCase().includes(searchTermLower))
        )
      : [...this.accounts];
    
    this.totalEntries = this.filteredAccounts.length;
    this.sortData(this.sortColumn, false); // Re-sort the filtered data
  }


  clearSearch(): void {
    this.searchTerm = '';
    this.applySearchFilter();
  }

 accountBook(account: any): void {
    // Set a flag to ensure the account book refreshes its data upon navigation
    this.accountService.setAccountBookRefreshFlag(account.id, true);
    this.router.navigate(['/account-book', account.id]);
  }

// **NEW METHOD**: Trigger balance update for specific account
private async triggerBalanceUpdateForAccount(accountId: string): Promise<void> {
  try {
    const account = this.accounts.find(acc => acc.id === accountId);
    if (account) {
      const calculatedBalance = this.calculateAccountCurrentBalance(account);
      await this.accountService.updateCurrentBalance(accountId, calculatedBalance);
      console.log(`✅ Updated balance for ${account.name}: ₹${calculatedBalance.toFixed(2)}`);
    }
  } catch (error) {
    console.error(`❌ Error updating balance for account ${accountId}:`, error);
  }
}
getSortIcon(column: string): string {
    if (this.sortColumn !== column) return 'fa-sort';
    return this.sortDirection === 'asc' ? 'fa-sort-up active' : 'fa-sort-down active';
  }

  calculateTotalBalance(): void {
    const total = this.filteredAccounts.reduce(
      (sum, acc) => sum + this.getAccountCurrentBalance(acc),
      0
    );
    this.totalBalance = total.toFixed(2);
  }

  initForm(): void {
    this.accountForm = this.fb.group({
      name: ['', Validators.required],
      accountNumber: ['', Validators.required],
      accountSubType: [''],
      openingBalance: [0, [Validators.required, Validators.min(0)]],
      accountHeadGroup: ['', Validators.required],
      accountHeadValue: ['', Validators.required],
      accountDetails: this.fb.array([]),
      note: [''],
      addedBy: ['']
    });

    for (let i = 0; i < 5; i++) {
      this.accountDetailsArray.push(this.createAccountDetail());
    }
  }

  initFundTransferForm(): void {
    this.fundTransferForm = this.fb.group({
      fromAccount: ['', Validators.required],
      toAccount: ['', Validators.required],
      amount: [0, [Validators.required, Validators.min(1)]],
      date: [new Date().toISOString().split('T')[0], Validators.required],
      note: [''],
      attachmentUrl: ['']
    });
  }

  get accountDetailsArray(): FormArray {
    return this.accountForm.get('accountDetails') as FormArray;
  }

  createAccountDetail(): FormGroup {
    return this.fb.group({
      label: [''],
      value: ['']
    });
  }

 getMinValue(a: number, b: number): number {
    return Math.min(a, b);
  }

  formatAccountDetails(details: any[]): string {
    if (!details || !Array.isArray(details)) return '';
    return details
      .filter(detail => detail && detail.label && detail.value)
      .map(detail => `${detail.label}: ${detail.value}`)
      .join(', ');
  }

openForm(account?: any): void {
  if (account) {
    this.isEdit = true;
    this.currentAccountId = account.id;

    const formData = {
      name: account.name,
      accountNumber: account.accountNumber,
      accountType: account.accountType,
      accountSubType: account.accountSubType || '',
      incomeType: account.incomeType || '',
      openingBalance: account.openingBalance || 0,
      paidOnDate: account.paidOnDate || new Date().toISOString().split('T')[0],
      paymentAccount: account.paymentAccount || '',
      note: account.note || '',
      addedBy: account.addedBy || this.currentUser?.username || '',
      accountHeadGroup: account.accountHead?.group || '',
      accountHeadValue: account.accountHead 
        ? `${account.accountHead.group}|${account.accountHead.value}` 
        : (account.accountHeadValue || '')
    };

    this.accountForm.patchValue(formData);

    if (account.accountDetails && Array.isArray(account.accountDetails)) {
      while (this.accountDetailsArray.length) {
        this.accountDetailsArray.removeAt(0);
      }
      
      account.accountDetails.forEach((detail: any) => {
        this.accountDetailsArray.push(
          this.fb.group({
            label: [detail.label || ''],
            value: [detail.value || '']
          })
        );
      });
      
      const remainingDetails = 5 - account.accountDetails.length;
      if (remainingDetails > 0) {
        for (let i = 0; i < remainingDetails; i++) {
          this.accountDetailsArray.push(this.createAccountDetail());
        }
      }
    }
  } else {
    this.isEdit = false;
    this.currentAccountId = null;
    this.accountForm.reset({
      paidOnDate: new Date().toISOString().split('T')[0],
      openingBalance: 0,
      accountHeadGroup: '',
      accountHeadValue: '',
      accountSubType: '',
      addedBy: this.currentUser?.username || ''
    });
    
    while (this.accountDetailsArray.length) {
      this.accountDetailsArray.removeAt(0);
    }
    for (let i = 0; i < 5; i++) {
      this.accountDetailsArray.push(this.createAccountDetail());
    }
  }
  this.showModal = true;
}

  closeForm(): void {
    this.showModal = false;
    this.isEdit = false;
    this.currentAccountId = null;
    this.accountForm.reset();
  }

// **CRITICAL FIX**: Updated saveAccount to trigger balance update
saveAccount(): void {
  if (!this.accountForm.valid) {
    alert('Please fill all required fields correctly');
    return;
  }

  const formValue = { ...this.accountForm.value };

  if (formValue.accountHeadGroup && formValue.accountHeadValue) {
    formValue.accountHead = {
      group: formValue.accountHeadGroup,
      value: formValue.accountHeadValue
    };
  }
  delete formValue.accountHeadGroup;
  delete formValue.accountHeadValue;

  formValue.accountDetails = formValue.accountDetails.filter(
    (detail: any) => detail.label?.trim() && detail.value?.trim()
  );

  if (this.isEdit && this.currentAccountId) {
    this.accountService.updateAccount(this.currentAccountId, formValue)
      .then(async () => {
        alert('Account updated successfully!');
        // **CRITICAL FIX**: Update balance after account modification
        await this.triggerBalanceUpdateForAccount(this.currentAccountId!);
        this.closeForm();
      })
      .catch((err: any) => alert('Error updating account: ' + err.message));
  } else {
    this.accountService.addAccount(formValue)
      .then(async (docRef) => {
        alert('Account created successfully!');
        // **CRITICAL FIX**: Set initial balance after account creation
        const accountId = docRef.id;
        await this.accountService.updateCurrentBalance(accountId, formValue.openingBalance || 0);
        this.closeForm();
      })
      .catch((err: any) => alert('Error creating account: ' + err.message));
  }
}

  deleteAccount(id: string | null): void {
    if (id) {
        this.accountService.deleteAccount(id)
          .then(() => alert('Account deleted!'))
          .catch((err: string) => alert('Error: ' + err));
    }
    this.closeConfirmModal();
  }

  changeTab(tab: string): void {
    this.activeTab = tab;
  }

get accountHeadGroups(): any[] {
  return this.getAccountHeadOptions().map(group => ({
    group: group.group
  }));
}

getAccountTransactions(accountId: string): any[] {
  const transactions = this.accountTransactions[accountId] || [];
  // **CRITICAL FIX**: Sort transactions by date and ensure proper display
  const processedTransactions = transactions.map(tx => ({
    ...tx,
    debit: Number(tx.debit || 0),
    credit: Number(tx.credit || 0),
    description: this.getTransactionDescription(tx),
    date: tx.date || new Date(),
    displayType: this.getTransactionDisplayType(tx)
  }));
  
  // Sort by date (newest first) and return
  return processedTransactions.sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

// **NEW METHOD**: Get proper transaction description
private getTransactionDescription(tx: any): string {
  if (tx.source === 'sale') {
    let desc = tx.description || 'Sale';
    if (tx.hasReturns) {
      desc += ' (Has Returns)';
    }
    return desc;
  } else if (tx.source === 'sales_return') {
    return tx.description || 'Sales Return';
  }
  return tx.description || 'Transaction';
}

// **NEW METHOD**: Get transaction display type
private getTransactionDisplayType(tx: any): string {
  if (tx.source === 'sale') {
    return 'Sale';
  } else if (tx.source === 'sales_return') {
    return 'Sales Return';
  }
  return tx.type || 'Transaction';
}

getAccountDebitTotal(accountId: string): number {
  return this.debitCreditTotals[accountId]?.debit || 0;
}

getAccountCreditTotal(accountId: string): number {
  return this.debitCreditTotals[accountId]?.credit || 0;
}

getTotalDebit(): number {
  return this.filteredAccounts.reduce((sum, acc) => {
    const totals = this.debitCreditTotals[acc.id];
    return sum + (totals?.debit || 0);
  }, 0);
}

getTotalCredit(): number {
  return this.filteredAccounts.reduce((sum, acc) => {
    const totals = this.debitCreditTotals[acc.id];
    return sum + (totals?.credit || 0);
  }, 0);
}

getAccountHeadOptionsForGroup(groupName: string): any[] {
  const group = this.getAccountHeadOptions().find(g => g.group === groupName);
  return group ? group.options : [];
}

onAccountHeadGroupChange(event: any): void {
  const selectedGroup = event.target.value;
  
  this.accountForm.get('accountHeadValue')?.setValue('');
  
  this.accountForm.get('accountHeadValue')?.markAsUntouched();
}

  exportCSV(): void {
    try {
      interface CsvRow {
        Name: string;
        'Account Type': string;
        'Account Sub Type': string;
        'Account Number': string;
        Note: string;
        Balance: string;
        'Account Details': string;
        'Added By': string;
      }
  
      const csvData: CsvRow[] = this.accounts.map(account => ({
        'Name': account.name || '',
        'Account Type': account.accountType || '',
        'Account Sub Type': account.accountSubType || '',
        'Account Number': account.accountNumber || '',
        'Note': account.note || '',
        'Balance': `₹ ${this.calculateAccountCurrentBalance(account).toFixed(2)}`,
        'Account Details': this.formatAccountDetails(account.accountDetails),
        'Added By': account.addedBy || ''
      }));
  
      const headers = Object.keys(csvData[0]) as Array<keyof CsvRow>;
      let csvContent = headers.join(',') + '\n';
  
      csvData.forEach(row => {
        const values = headers.map(header => {
          const value = row[header];
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        });
        csvContent += values.join(',') + '\n';
      });
  
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `payment_accounts_${new Date().toISOString().slice(0,10)}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('Error exporting CSV. Please try again.');
    }
  }

  exportExcel(): void {
    try {
      const excelData = this.accounts.map(account => ({
        'Name': account.name || '',
        'Account Type': account.accountType || '',
        'Account Sub Type': account.accountSubType || '',
        'Account Number': account.accountNumber || '',
        'Note': account.note || '',
        'Balance': this.calculateAccountCurrentBalance(account),
        'Account Details': this.formatAccountDetails(account.accountDetails),
        'Added By': account.addedBy || ''
      }));

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      
      const range = XLSX.utils.decode_range(worksheet['!ref'] || '');
      for (let i = range.s.r + 1; i <= range.e.r; ++i) {
        const cellAddress = { c: 5, r: i };
        const cellRef = XLSX.utils.encode_cell(cellAddress);
        if (worksheet[cellRef]) {
          worksheet[cellRef].z = '"₹"#,##0.00';
        }
      }
      
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Payment Accounts');
      
      const fileName = `payment_accounts_${new Date().toISOString().slice(0,10)}.xlsx`;
      
      XLSX.writeFile(workbook, fileName);
    } catch (error) {
      console.error('Error exporting Excel:', error);
      alert('Error exporting Excel. Please try again.');
    }
  }

printData(): void {
  try {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Popup was blocked. Please allow popups for this site to print.');
      return;
    }

    const currentDate = new Date().toLocaleDateString();

    const totalForPrint = this.accounts.reduce((sum, acc) => sum + this.calculateAccountCurrentBalance(acc), 0).toFixed(2);
    
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Payment Accounts Report</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #333; text-align: center; }
          .report-header { 
            display: flex;
            justify-content: space-between;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid #ddd;
          }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          .no-data { text-align: center; padding: 20px; }
          .total-row { font-weight: bold; }
          @media print {
            @page { size: landscape; margin: 10mm; }
            body { margin: 0; }
          }
        </style>
      </head>
      <body>
        <div class="report-header">
          <h1>Payment Accounts Report</h1>
          <div>Generated on: ${currentDate}</div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Account Type</th>
              <th>Account Sub Type</th>
              <th>Account Number</th>
              <th>Note</th>
              <th>Balance</th>
              <th>Account Details</th>
              <th>Added By</th>
            </tr>
          </thead>
          <tbody>
            ${this.accounts.map(account => `
              <tr>
                <td>${account.name || ''}</td>
                <td>${account.accountType || ''}</td>
                <td>${account.accountSubType || ''}</td>
                <td>${account.accountNumber || ''}</td>
                <td>${account.note || ''}</td>
                <td>₹ ${this.calculateAccountCurrentBalance(account).toFixed(2)}</td>
                <td>${this.formatAccountDetails(account.accountDetails)}</td>
                <td>${account.addedBy || ''}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="5">Total:</td>
              <td>₹ ${totalForPrint}</td>
              <td colspan="2"></td>
            </tr>
          </tbody>
        </table>
        
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
              window.close();
            }, 200);
          }
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(printContent);
    printWindow.document.close();
  } catch (error) {
    console.error('Error printing:', error);
    alert('Error printing table. Please try again.');
  }
}

  toggleColumnVisibility(): void {
    console.log('Toggling column visibility');
  }

exportPDF(): void {
  try {
    const doc = new jsPDF('landscape');
    
    doc.setFontSize(16);
    doc.setTextColor(40, 40, 40);
    doc.text('Payment Accounts Report', 14, 15);
    
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 22);
    
    const data = this.accounts.map(account => [
      account.name || '-',
      account.accountType || '-',
      account.accountSubType || '-',
      account.accountNumber || '-',
      account.note || '-',
      `₹ ${this.calculateAccountCurrentBalance(account).toFixed(2)}`,
      this.formatAccountDetails(account.accountDetails) || '-',
      account.addedBy || '-'
    ]);

    const totalForPdf = this.accounts.reduce((sum, acc) => sum + this.calculateAccountCurrentBalance(acc), 0).toFixed(2);
    
    data.push([
      { content: 'Total:', colSpan: 5, styles: { fontStyle: 'bold' } },
      { content: `₹ ${totalForPdf}`, styles: { fontStyle: 'bold' } },
      { content: '', colSpan: 2, styles: { fontStyle: 'bold' } }
    ]);
    
    (doc as any).autoTable({
      head: [
        ['Name', 'Account Type', 'Account Sub Type', 'Account Number', 
         'Note', 'Balance', 'Account Details', 'Added By']
      ],
      body: data,
      startY: 30,
      styles: {
        fontSize: 8,
        cellPadding: 2,
        overflow: 'linebreak'
      },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      },
      margin: { top: 30 },
      columnStyles: {
        5: { cellWidth: 20 }
      }
    });
    
    doc.save(`payment_accounts_${new Date().toISOString().slice(0,10)}.pdf`);
  } catch (error) {
    console.error('Error exporting PDF:', error);
    alert('Error exporting PDF. Please try again.');
  }
}

  editAccount(account: any): void {
    this.openForm(account);
  }

fundTransfer(account: any): void {
  console.log('Opening fund transfer modal for account:', account);
  this.selectedFromAccount = account;
  this.fundTransferForm.patchValue({
    fromAccount: account.id,
    date: new Date().toISOString().split('T')[0]
  });
  console.log('Fund transfer form after patch:', this.fundTransferForm.value);
  this.showFundTransferModal = true;
}

deposit(account: any): void {
  this.selectedAccount = account;
  this.depositForm.patchValue({
    depositTo: account.id,
    date: new Date().toISOString().split('T')[0]
  });
  this.showDepositModal = true;
}

  closeFundTransferForm(): void {
    this.fundTransferForm.reset();
    this.initFundTransferForm();
    this.showFundTransferModal = false;
    this.selectedFromAccount = null;
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      if (this.showFundTransferModal) {
        this.fundTransferForm.patchValue({
          attachmentUrl: file.name
        });
      } else if (this.showDepositModal) {
        this.depositForm.patchValue({
          attachmentUrl: file.name
        });
      }
    }
  }

  closeDepositForm(): void {
    this.depositForm.reset();
    this.initDepositForm();
    this.showDepositModal = false;
    this.selectedAccount = null;
  }  
  
  submitDeposit(): void {
    if (this.depositForm.valid) {
      const formValue = this.depositForm.value;
      
      const toAccount = this.accounts.find(acc => acc.id === formValue.depositTo);
      
      if (!toAccount) {
        alert('Target account not found');
        return;
      }
      
      const depositAmount = parseFloat(formValue.amount);
      const depositDate = new Date(formValue.date);
      
      const hasFromAccount = formValue.depositFrom && formValue.depositFrom.trim() !== '';
      let fromAccount = null;
      
      if (hasFromAccount) {
        fromAccount = this.accounts.find(acc => acc.id === formValue.depositFrom);
        
        if (!fromAccount) {
          alert('Source account not found');
          return;
        }
        
        const currentBalance = this.calculateAccountCurrentBalance(fromAccount);
        if (currentBalance < depositAmount) {
          alert('Insufficient balance in the source account');
          return;
        }
      }
      
      const depositData = {
        accountId: formValue.depositTo,
        accountName: toAccount.name,
        depositFrom: hasFromAccount ? formValue.depositFrom : null,
        depositFromName: hasFromAccount ? fromAccount?.name : null,
        amount: depositAmount,
        date: depositDate,
        note: formValue.note || '',
        attachmentUrl: formValue.attachmentUrl || '',
        description: hasFromAccount ? `Deposit from ${fromAccount?.name}` : 'Direct deposit',
        addedBy: 'User',
        hasDocument: !!formValue.attachmentUrl
      };
      
      this.accountService.addDeposit(depositData).then(async () => {
        alert('Deposit processed successfully!');
        
        // **CRITICAL FIX**: Update balances after deposit
        await this.triggerBalanceUpdateForAccount(formValue.depositTo);
        if (hasFromAccount) {
          await this.triggerBalanceUpdateForAccount(formValue.depositFrom);
        }
        
        this.closeDepositForm();
      }).catch((error) => {
        console.error('Error processing deposit:', error);
        alert('Error processing deposit. Please try again.');
      });    
    } else {
      alert('Please fill all required fields');
    }
  }

  submitFundTransfer(): void {
    if (!this.fundTransferForm.valid) {
      alert('Please correct the form errors.');
      return;
    }

    const formValue = this.fundTransferForm.value;
    
    if (formValue.fromAccount === formValue.toAccount) {
      alert('Transfer from and to accounts cannot be the same');
      return;
    }
    
    const fromAccount = this.accounts.find(acc => acc.id === formValue.fromAccount);
    const toAccount = this.accounts.find(acc => acc.id === formValue.toAccount);
    
    if (!fromAccount || !toAccount) {
      alert('One or both accounts not found');
      return;
    }
    
    const fromAccountCurrentBalance = this.calculateAccountCurrentBalance(fromAccount);
    const transferAmount = parseFloat(formValue.amount);
    
    if (fromAccountCurrentBalance < transferAmount) {
      alert(`Insufficient balance in ${fromAccount.name}. Available: ₹${fromAccountCurrentBalance.toFixed(2)}`);
      return;
    }
    
    const transferData = {
      fromAccountId: formValue.fromAccount,
      fromAccountName: fromAccount.name,
      toAccountId: formValue.toAccount,
      toAccountName: toAccount.name,
      amount: transferAmount,
      date: new Date(formValue.date),
      note: formValue.note || '',
      attachmentUrl: formValue.attachmentUrl || '',
      addedBy: 'User',
      hasDocument: !!formValue.attachmentUrl
    };
    
    this.accountService.addFundTransfer(transferData).then(async () => {
      alert('Fund transfer completed successfully!');
      
      // **CRITICAL FIX**: Update balances after transfer
      await this.triggerBalanceUpdateForAccount(formValue.fromAccount);
      await this.triggerBalanceUpdateForAccount(formValue.toAccount);
      
      this.closeFundTransferForm();
    }).catch((error) => {
      alert('Error during fund transfer: ' + error.message);
    });
  }
  
  getAccountName(accountId: string): string {
    const account = this.accounts.find(a => a.id === accountId);
    return account ? account.name : 'Unknown Account';
  }

  close(account: any): void {
    this.accountToClose = account;
    this.showCloseConfirmModal = true;
  }

  confirmClose(): void {
    if (this.accountToClose && this.accountToClose.id) {
        this.deleteAccount(this.accountToClose.id);
    }
  }

  closeConfirmModal(): void {
    this.showCloseConfirmModal = false;
    this.accountToClose = null;
  }

  previousPage(): void {
    if (this.currentPage > 1) this.currentPage--;
  }

  nextPage(): void {
    if (this.currentPage * this.entriesPerPage < this.totalEntries) this.currentPage++;
  }


  
// **MODIFIED**: Sets a flag and calls the central processing function
loadSalesRealtime(): void {
  this.saleService.getSalesWithAccountInfo().subscribe(
    (sales: any[]) => {
      this.sales = sales;
      this.salesLoaded = true;
      this.processAccountTransactions();
    },
    (error: any) => {
      console.error('Error loading sales:', error);
      this.sales = [];
      this.salesLoaded = true; // Still set flag on error to not block processing
      this.processAccountTransactions();
    }
  );
}

  private convertToDate(dateValue: any): Date {
    if (!dateValue) return new Date();
    if (dateValue instanceof Date) return dateValue;
    if (dateValue?.toDate && typeof dateValue.toDate === 'function') return dateValue.toDate();
    if (typeof dateValue === 'string') {
      const date = new Date(dateValue);
      if (!isNaN(date.getTime())) return date;
      try {
        const cleanedDate = dateValue.replace(/\s+at\s+.*$/, '');
        return new Date(cleanedDate);
      } catch {
        return new Date();
      }
    }
    if (typeof dateValue === 'number') return new Date(dateValue);
    return new Date();
  }

// Add this method to properly format account head display
getAccountHeadDisplay(account: any): string {
    if (account.accountHead) {
        if (typeof account.accountHead === 'object') {
            return `${account.accountHead.group} - ${account.accountHead.value}`;
        } else if (typeof account.accountHead === 'string') {
            const parts = account.accountHead.split('|');
            return parts.length > 1 ? `${parts[0]} - ${parts[1]}` : account.accountHead;
        }
    } else if (account.accountHeadValue) {
        const parts = account.accountHeadValue.split('|');
        return parts.length > 1 ? `${parts[0]} - ${parts[1]}` : account.accountHeadValue;
    }
    return '';
}

 private calculateSalesPaymentAmount(sale: any): number {
    const paidAmount = sale.paymentAmount ? Number(sale.paymentAmount) : 0;
    
    return paidAmount;
  }
}