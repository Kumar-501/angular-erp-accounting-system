import {  OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AccountService } from '../services/account.service';
import { Router } from '@angular/router';
import { collection, addDoc, Firestore, writeBatch, doc } from '@angular/fire/firestore';
import { UserService } from '../services/user.service';
import { Component, ElementRef, ViewChild } from '@angular/core';
import { SaleService } from '../services/sale.service';

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
  sortColumn: string = 'name'; // Default sort column
  sortDirection: 'asc' | 'desc' = 'asc'; // Default sort direction
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
  constructor(
    private fb: FormBuilder,
    private accountService: AccountService,
    private router: Router,
    private firestore: Firestore,
    private userService: UserService,
    private saleService: SaleService
  ) {}

// 2. Replace the existing ngOnInit method (around line 60) with:
ngOnInit(): void {
  this.initForm();
  this.initFundTransferForm();
  this.initDepositForm();
  this.loadUsers();
  
  // Load sales first, then accounts to ensure sales data is available
  this.loadSalesRealtime();
  this.loadAccountsRealtime();
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

  // Initialize deposit form
  initDepositForm(): void {
    this.depositForm = this.fb.group({
      depositTo: ['', Validators.required],
      amount: [0, [Validators.required, Validators.min(1)]],
      depositFrom: ['', Validators.required],
      date: [new Date().toISOString().split('T')[0], Validators.required],
      note: [''],
      attachmentUrl: ['']
    });
  }
  loadUsers(): void {
    this.userService.getUsers().subscribe(users => {
      this.users = users;
      console.log('Users loaded:', this.users);
    });
  }
sortData(column: string): void {
  if (this.sortColumn === column) {
    this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    this.sortColumn = column;
    this.sortDirection = 'asc';
  }

  this.accounts = [...this.accounts].sort((a, b) => {
    let valueA, valueB;

    // Special handling for account head
    if (column === 'accountHead') {
      valueA = a.accountHead ? `${a.accountHead.group} ${a.accountHead.value}` : '';
      valueB = b.accountHead ? `${b.accountHead.group} ${b.accountHead.value}` : '';
    } else {
      valueA = a[column] === null || a[column] === undefined ? '' : a[column];
      valueB = b[column] === null || b[column] === undefined ? '' : b[column];
    }

    // Numeric sorting for balance
    if (column === 'openingBalance') {
      const numA = parseFloat(valueA) || 0;
      const numB = parseFloat(valueB) || 0;
      return this.sortDirection === 'asc' ? numA - numB : numB - numA;
    }

    // String sorting for other columns
    if (typeof valueA === 'string' && typeof valueB === 'string') {
      const comparison = valueA.toLowerCase().localeCompare(valueB.toLowerCase());
      return this.sortDirection === 'asc' ? comparison : -comparison;
    }

    // Default comparison
    if (valueA < valueB) return this.sortDirection === 'asc' ? -1 : 1;
    if (valueA > valueB) return this.sortDirection === 'asc' ? 1 : -1;
    return 0;
  });
}
loadTransactionsRealtime(): void {
  this.accountService.getAllTransactions((transactions) => {
    this.transactions = transactions;
    this.processAccountTransactions();
  });
}
  
processAccountTransactions(): void {
    this.accountTransactions = {};
    this.debitCreditTotals = {};
    
    // Group account service transactions by account
    this.transactions.forEach(transaction => {
      const accountId = transaction.accountId;
      if (!this.accountTransactions[accountId]) {
        this.accountTransactions[accountId] = [];
      }
      
      // Calculate debit/credit based on transaction type and amount
      let debit = 0;
      let credit = 0;
      const amount = Number(transaction.amount || 0);
      
      // If transaction already has debit/credit fields, use them
      if (transaction.debit !== undefined && transaction.credit !== undefined) {
        debit = Number(transaction.debit || 0);
        credit = Number(transaction.credit || 0);
      } else {
        // Calculate debit/credit from amount and type
        switch (transaction.type) {
          case 'expense':
          case 'transfer_out':
          case 'purchase_payment':
            debit = amount;
            break;
          case 'income':
          case 'transfer_in':
          case 'sale':
          case 'purchase_return':
          case 'deposit':
            credit = amount;
            break;
          default:
            // For unknown types, assume expense types are debits, others are credits
            if (transaction.type?.includes('expense') || transaction.type?.includes('payment')) {
              debit = amount;
            } else {
              credit = amount;
            }
        }
      }
      
      this.accountTransactions[accountId].push({
        ...transaction,
        debit: debit,
        credit: credit
      });
    });
    
    // Include sales payments as credit transactions
    this.sales.forEach(sale => {
      const accountId = sale.paymentAccountId || sale.paymentAccount;
      if (accountId) {
        if (!this.accountTransactions[accountId]) {
          this.accountTransactions[accountId] = [];
        }
        // Push a sale transaction with credit amount
        const paymentAmount = Number(sale.paymentAmount) || 0;
        this.accountTransactions[accountId].push({ 
          debit: 0, 
          credit: paymentAmount,
          type: 'sale',
          description: `Sale: ${sale.invoiceNo || 'No invoice'}`,
          date: sale.saleDate || sale.createdAt,
          amount: paymentAmount
        });
      }
    });
    
    // Calculate debit and credit totals per account
    Object.keys(this.accountTransactions).forEach(accountId => {
      const txns = this.accountTransactions[accountId];
      const totalDebit = txns.reduce((sum, t) => sum + (Number(t.debit) || 0), 0);
      const totalCredit = txns.reduce((sum, t) => sum + (Number(t.credit) || 0), 0);
      this.debitCreditTotals[accountId] = { debit: totalDebit, credit: totalCredit };
    });
    
    // Update overall balance display
    this.calculateTotalBalance();
  }
  
  
  
  
  
  
  applySearchFilter(): void {
  if (!this.searchTerm || this.searchTerm.trim() === '') {
    this.filteredAccounts = [...this.accounts];
    this.totalEntries = this.filteredAccounts.length;
    this.calculateTotalBalance();
    return;
  }

  const searchTermLower = this.searchTerm.toLowerCase().trim();
  
  this.filteredAccounts = this.accounts.filter(account => {
    // Check each field for a match
    return (
      (account.name?.toLowerCase().includes(searchTermLower)) ||
      (account.accountNumber?.toLowerCase().includes(searchTermLower)) ||
      (account.accountHead?.value?.toLowerCase().includes(searchTermLower)) ||
      (account.accountHead?.group?.toLowerCase().includes(searchTermLower)) ||
      (account.note?.toLowerCase().includes(searchTermLower)) ||
      (account.addedBy?.toLowerCase().includes(searchTermLower)) ||
      (account.accountSubType?.toLowerCase().includes(searchTermLower)));
  });
  
  this.totalEntries = this.filteredAccounts.length;
  this.calculateTotalBalance();
}

// Update clearSearch function
clearSearch(): void {
  this.searchTerm = '';
  this.applySearchFilter();
}
getAccBalance(accountId: string): number {
  // Return calculated balance if available, otherwise use opening balance
  return this.accounts.find(acc => acc.id === accountId)?.calculatedBalance
}
loadAccountsRealtime(): void {
  this.accountService.getAccounts((accounts: any[]) => {
    // First get all accounts
    this.accounts = accounts;
    
    // Then get all transactions to calculate final balances and debit/credit totals
    this.accountService.getAllTransactions((transactions: any[]) => {
      this.transactions = transactions;
      
      // Create a map to store calculated balances
      const accountBalances = new Map<string, number>();
      
      // Initialize account transactions and debit/credit totals
      this.accountTransactions = {};
      this.debitCreditTotals = {};
      
      // Initialize with opening balances
      accounts.forEach(account => {
        accountBalances.set(account.id, account.openingBalance || 0);
        this.accountTransactions[account.id] = [];
        this.debitCreditTotals[account.id] = { debit: 0, credit: 0 };
      });

      // Process all transactions chronologically
      transactions.sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      ).forEach(transaction => {
        const accountId = transaction.accountId;
        
        if (accountBalances.has(accountId)) {
          const currentBalance = accountBalances.get(accountId) || 0;
          const amount = Number(transaction.amount || 0);
          
          // Calculate debit/credit based on transaction type and amount
          let debit = 0;
          let credit = 0;
          let balanceChange = 0;
          
          // If transaction already has debit/credit fields, use them
          if (transaction.debit !== undefined && transaction.credit !== undefined) {
            debit = Number(transaction.debit || 0);
            credit = Number(transaction.credit || 0);
            balanceChange = credit - debit;
          } else {
            // Calculate debit/credit from amount and type
            switch (transaction.type) {
              case 'expense':
              case 'transfer_out':
              case 'purchase_payment':
                debit = amount;
                balanceChange = -amount; // Debit decreases balance
                break;
              case 'income':
              case 'transfer_in':
              case 'deposit':
              case 'sale':
              case 'purchase_return':
                credit = amount;
                balanceChange = amount; // Credit increases balance
                break;
              default:
                // For unknown types, assume expense types decrease balance
                if (transaction.type?.includes('expense') || transaction.type?.includes('payment')) {
                  debit = amount;
                  balanceChange = -amount;
                } else {
                  credit = amount;
                  balanceChange = amount;
                }
            }
          }
          
          // Update balance
          accountBalances.set(accountId, currentBalance + balanceChange);
          
          // Store transaction with calculated debit/credit for display
          this.accountTransactions[accountId].push({
            ...transaction,
            debit: debit,
            credit: credit
          });
          
          // Update debit/credit totals
          this.debitCreditTotals[accountId].debit += debit;
          this.debitCreditTotals[accountId].credit += credit;
        }
      });

      // Also process sales data for balance calculation
      this.sales.forEach(sale => {
        const accountId = sale.paymentAccountId || sale.paymentAccount;
        const paymentAmount = Number(sale.paymentAmount) || 0;
        
        if (accountId && paymentAmount > 0 && accountBalances.has(accountId)) {
          const currentBalance = accountBalances.get(accountId) || 0;
          accountBalances.set(accountId, currentBalance + paymentAmount);
          
          // Add sale as a credit transaction
          if (!this.accountTransactions[accountId]) {
            this.accountTransactions[accountId] = [];
          }
          this.accountTransactions[accountId].push({ 
            debit: 0, 
            credit: paymentAmount,
            type: 'sale',
            description: `Sale: ${sale.invoiceNo || 'No invoice'}`,
            date: sale.saleDate || sale.createdAt,
            amount: paymentAmount
          });
          
          // Update credit total
          if (!this.debitCreditTotals[accountId]) {
            this.debitCreditTotals[accountId] = { debit: 0, credit: 0 };
          }
          this.debitCreditTotals[accountId].credit += paymentAmount;
        }
      });      // Update accounts with calculated balances
      this.accounts = accounts.map(account => {
        const calculatedBalance = accountBalances.get(account.id) || account.openingBalance || 0;
        console.log("Fanisus: b: ", this.getAccBalance(account.id))
        console.log("Fanisus: ", calculatedBalance)
        return {
          ...account,
          calculatedBalance: calculatedBalance
        };
      });

      this.filteredAccounts = [...this.accounts];
      this.totalEntries = this.accounts.length;
      this.calculateTotalBalance();
      this.sortData('name');
    });
  });
}

accountBook(account: any): void {
  this.router.navigate(['/account-book', account.id], {
    state: { accountName: account.name } // Optional: pass account name for display
  });
}
getSortIcon(column: string): string {
  if (this.sortColumn !== column) {
    return 'fa-sort'; // Default icon when column is not being sorted
  }
  
  return this.sortDirection === 'asc' 
    ? 'fa-sort-up active' 
    : 'fa-sort-down active';
}
calculateTotalBalance(): void {
  const total = this.filteredAccounts.reduce(
    (sum, acc) => sum + (acc.calculatedBalance || acc.openingBalance || 0), 
    0
  );
  this.totalBalance = total.toFixed(2);
}
initForm(): void {
  this.accountForm = this.fb.group({
    name: ['', Validators.required],
    accountNumber: ['', Validators.required],
    accountType: [''],
    accountSubType: [''],
    incomeType: [''],
    openingBalance: [0, [Validators.required, Validators.min(0)]],
    paidOnDate: [new Date().toISOString().split('T')[0], Validators.required],
    paymentAccount: [''],
    accountHeadGroup: ['', Validators.required], // New field for group selection
    accountHeadValue: ['', Validators.required], // New field for value selection
    accountDetails: this.fb.array([]),
    note: [''],
    addedBy: ['']
  });

  // Initialize with empty account details
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
      accountHeadGroup: account.accountHead?.group || '',
      accountHeadValue: account.accountHead?.value || '',
      note: account.note || '',
      addedBy: account.addedBy || ''
    };


    this.accountForm.patchValue(formData);

    // Handle account details
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
      
      // Fill remaining slots if needed
      const remainingDetails = 5 - account.accountDetails.length;
      if (remainingDetails > 0) {
        for (let i = 0; i < remainingDetails; i++) {
          this.accountDetailsArray.push(this.createAccountDetail());
        }
      }
    }
   } else {
    // Reset form for new account
    this.isEdit = false;
    this.currentAccountId = null;
    this.accountForm.reset({
      paidOnDate: new Date().toISOString().split('T')[0],
      openingBalance: 0
    });
    
    // Reset account details
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
    this.accountForm.reset();
    this.initForm();
    this.showModal = false;
    this.isEdit = false;
    this.currentAccountId = null;
  }
saveAccount(): void {
  console.log('Form submitted', this.accountForm.value); // Debug log
  
  if (this.accountForm.valid) {
    console.log('Form is valid');
    
    const formValue = {...this.accountForm.value};
    console.log('Form values before processing:', formValue);
    
    // Process account head
    if (formValue.accountHeadGroup && formValue.accountHeadValue) {
      formValue.accountHead = {
        group: formValue.accountHeadGroup,
        value: formValue.accountHeadValue
      };
      console.log('Processed account head:', formValue.accountHead);
    }
    
    // Remove the separate group and value fields
    delete formValue.accountHeadGroup;
    delete formValue.accountHeadValue;
    
    // Filter out empty account details
    formValue.accountDetails = formValue.accountDetails.filter(
      (detail: any) => detail.label && detail.value && 
      detail.label.trim() !== '' && detail.value.trim() !== ''
    );
    console.log('Filtered account details:', formValue.accountDetails);
    
    if (this.isEdit && this.currentAccountId) {
      console.log('Updating existing account');
      this.accountService.updateAccount(this.currentAccountId, formValue)
        .then(() => {
          console.log('Account updated successfully');
          alert('Account updated successfully!');
          this.closeForm();
        })
        .catch((err: any) => {
          console.error('Error updating account:', err);
          alert('Error updating account: ' + err.message);
        });
    } else {
      console.log('Creating new account');
      this.accountService.addAccount(formValue)
        .then(() => {
          console.log('Account created successfully');
          alert('Account created successfully!');
          this.closeForm();
        })
        .catch((err: any) => {
          console.error('Error creating account:', err);
          alert('Error creating account: ' + err.message);
        });
    }
  } else {
    console.log('Form is invalid');
    // Display which fields are invalid
    Object.keys(this.accountForm.controls).forEach(key => {
      const control = this.accountForm.get(key);
      if (control?.invalid) {
        console.log('Invalid field:', key, control.errors);
      }
    });
    alert('Please fill all required fields correctly');
  }
}

  deleteAccount(id: string | null): void {
    if (id && confirm('Are you sure to delete?')) {
      this.accountService.deleteAccount(id)
        .then(() => alert('Account deleted!'))
        .catch((err: string) => alert('Error: ' + err));
    }
  }

  // UI functions
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
  
  // Ensure all transactions have proper debit/credit values
  return transactions.map(tx => ({
    ...tx,
    debit: Number(tx.debit || 0),
    credit: Number(tx.credit || 0),
    description: tx.description || 'No description',
    date: tx.date || new Date()
  })).sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );
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
// Get options for a specific group
getAccountHeadOptionsForGroup(groupName: string): any[] {
  const group = this.getAccountHeadOptions().find(g => g.group === groupName);
  return group ? group.options : [];
}


onAccountHeadGroupChange(event: any): void {
  const selectedGroup = event.target.value;
  
  // Reset the account head value when group changes
  this.accountForm.get('accountHeadValue')?.setValue('');
  
  // If you want to trigger validation
  this.accountForm.get('accountHeadValue')?.markAsUntouched();
}



  exportCSV(): void {
    try {
      // Define an interface for the row structure
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
  
      // Prepare data for CSV with explicit typing
      const csvData: CsvRow[] = this.accounts.map(account => ({
        'Name': account.name || '',
        'Account Type': account.accountType || '',
        'Account Sub Type': account.accountSubType || '',
        'Account Number': account.accountNumber || '',
        'Note': account.note || '',
        'Balance': `₹ ${(account.openingBalance || 0).toFixed(2)}`,
        'Account Details': this.formatAccountDetails(account.accountDetails),
        'Added By': account.addedBy || ''
      }));
  
      // Create CSV content
      const headers = Object.keys(csvData[0]) as Array<keyof CsvRow>;
      let csvContent = headers.join(',') + '\n';
  
      csvData.forEach(row => {
        const values = headers.map(header => {
          // Escape quotes in values and wrap in quotes if contains commas
          const value = row[header];
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        });
        csvContent += values.join(',') + '\n';
      });
  
      // Create download link
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
      // Prepare data for Excel
      const excelData = this.accounts.map(account => ({
        'Name': account.name || '',
        'Account Type': account.accountType || '',
        'Account Sub Type': account.accountSubType || '',
        'Account Number': account.accountNumber || '',
        'Note': account.note || '',
        'Balance': (account.openingBalance || 0),
        'Account Details': this.formatAccountDetails(account.accountDetails),
        'Added By': account.addedBy || ''
      }));

      // Create worksheet
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      
      // Format the balance column as currency
      const range = XLSX.utils.decode_range(worksheet['!ref'] || '');
      for (let i = range.s.r + 1; i <= range.e.r; ++i) {
        const cellAddress = { c: 5, r: i }; // Balance is column 5 (0-based index)
        const cellRef = XLSX.utils.encode_cell(cellAddress);
        if (worksheet[cellRef]) {
          worksheet[cellRef].z = '"₹"#,##0.00';
        }
      }
      
      // Create workbook
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Payment Accounts');
      
      // Generate file name with current date
      const fileName = `payment_accounts_${new Date().toISOString().slice(0,10)}.xlsx`;
      
      // Export to Excel
      XLSX.writeFile(workbook, fileName);
    } catch (error) {
      console.error('Error exporting Excel:', error);
      alert('Error exporting Excel. Please try again.');
    }
  }


// Print Functionality
printData(): void {
  try {
    // Create a printable version of the table
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Popup was blocked. Please allow popups for this site to print.');
      return;
    }

    // Get current date for header
    const currentDate = new Date().toLocaleDateString();
    
    // Create the print content
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
                <td>₹ ${(account.openingBalance || 0).toFixed(2)}</td>
                <td>${this.formatAccountDetails(account.accountDetails)}</td>
                <td>${account.addedBy || ''}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="5">Total:</td>
              <td>₹ ${this.calculateTotalBalance()}</td>
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

    // Write the content and print
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

// Export to PDF
exportPDF(): void {
  try {
    // Create new PDF document in landscape mode
    const doc = new jsPDF('landscape');
    
    // Add title
    doc.setFontSize(16);
    doc.setTextColor(40, 40, 40);
    doc.text('Payment Accounts Report', 14, 15);
    
    // Add subtitle with date
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 22);
    
    // Prepare data for the table
    const data = this.accounts.map(account => [
      account.name || '-',
      account.accountType || '-',
      account.accountSubType || '-',
      account.accountNumber || '-',
      account.note || '-',
      `₹ ${(account.openingBalance || 0).toFixed(2)}`,
      this.formatAccountDetails(account.accountDetails) || '-',
      account.addedBy || '-'
    ]);
    
    // Add total row
    data.push([
      { content: 'Total:', colSpan: 5, styles: { fontStyle: 'bold' } },
      { content: `₹ ${this.calculateTotalBalance()}`, styles: { fontStyle: 'bold' } },
      { content: '', colSpan: 2, styles: { fontStyle: 'bold' } }
    ]);
    
    // Add table
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
        5: { cellWidth: 20 } // Balance column width
      }
    });
    
    // Save the PDF
    doc.save(`payment_accounts_${new Date().toISOString().slice(0,10)}.pdf`);
  } catch (error) {
    console.error('Error exporting PDF:', error);
    alert('Error exporting PDF. Please try again.');
  }
}


  editAccount(account: any): void {
    this.openForm(account);
  }

// Enhanced fund transfer method
fundTransfer(account: any): void {
  this.selectedFromAccount = account;
  this.fundTransferForm.patchValue({
    fromAccount: account.id,
    date: new Date().toISOString().split('T')[0]
  });
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
      // Here you would typically upload the file to storage
      // For now we'll just store the file name
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
    
    // Get the accounts involved
    const toAccount = this.accounts.find(acc => acc.id === formValue.depositTo);
    const fromAccount = this.accounts.find(acc => acc.id === formValue.depositFrom);
    
    if (!toAccount || !fromAccount) {
      alert('One or both accounts not found');
      return;
    }
    
    // Validate sufficient balance in from account
    const depositAmount = parseFloat(formValue.amount);
    if ((fromAccount.openingBalance || 0) < depositAmount) {
      alert('Insufficient balance in the source account');
      return;
    }
    
    const depositDate = new Date(formValue.date);
    
    // Create deposit record
    const depositData = {
      accountId: formValue.depositTo,
      accountName: toAccount.name,
      depositFrom: formValue.depositFrom,
      depositFromName: fromAccount.name,
      amount: depositAmount,
      date: depositDate,
      note: formValue.note || '',
      attachmentUrl: formValue.attachmentUrl || '',
      type: 'deposit',
      description: `Deposit from ${fromAccount.name}`,
      addedBy: 'User', // Replace with actual user
      hasDocument: !!formValue.attachmentUrl,
      createdAt: new Date()
    };
    
    // Create transaction records for both accounts
    const toTransaction = {
      accountId: formValue.depositTo,
      date: depositDate,
      description: `Deposit from ${fromAccount.name}`,
      paymentMethod: 'Deposit',
      paymentDetails: '',
      note: formValue.note || '',
      addedBy: 'User',
      debit: 0,
      credit: depositAmount,
      type: 'deposit',
      hasDocument: !!formValue.attachmentUrl,
      attachmentUrl: formValue.attachmentUrl || '',
      fromAccountId: formValue.depositFrom,
      toAccountId: formValue.depositTo
    };
    
    const fromTransaction = {
      accountId: formValue.depositFrom,
      date: depositDate,
      description: `Deposit to ${toAccount.name}`,
      paymentMethod: 'Deposit',
      paymentDetails: '',
      note: formValue.note || '',
      addedBy: 'User',
      debit: depositAmount,
      credit: 0,
      type: 'deposit_out',
      hasDocument: !!formValue.attachmentUrl,
      attachmentUrl: formValue.attachmentUrl || '',
      fromAccountId: formValue.depositFrom,
      toAccountId: formValue.depositTo
    };
    
    // Use a batch write to ensure all operations succeed or fail together
    const batch = writeBatch(this.firestore);
    
    // Add deposit record
    const depositsRef = collection(this.firestore, 'deposits');
    const depositRef = doc(depositsRef);
    batch.set(depositRef, depositData);
    
    // Add transaction records
    const transactionsRef = collection(this.firestore, 'transactions');
    const toTransactionRef = doc(transactionsRef);
    batch.set(toTransactionRef, toTransaction);
    
    const fromTransactionRef = doc(transactionsRef);
    batch.set(fromTransactionRef, fromTransaction);
    
 
    
  
    
    // Commit the batch operation
    batch.commit()
      .then(() => {
        alert('Deposit completed successfully!');
        this.closeDepositForm();
      })
      .catch((err) => {
        console.error('Error during deposit:', err);
        alert('Error during deposit: ' + err.message);
      });
  } else {
    alert('Please fill all required fields');
  }
}

  submitFundTransfer(): void {
    if (this.fundTransferForm.valid) {
      const formValue = this.fundTransferForm.value;
      
      // Validate that from and to accounts are different
      if (formValue.fromAccount === formValue.toAccount) {
        alert('Transfer from and to accounts cannot be the same');
        return;
      }
      
      // Get the account objects
      const fromAccount = this.accounts.find(acc => acc.id === formValue.fromAccount);
      const toAccount = this.accounts.find(acc => acc.id === formValue.toAccount);
      
      if (!fromAccount || !toAccount) {
        alert('One or both accounts not found');
        return;
      }
      
      // Validate sufficient balance // Fanisus 
      if ((fromAccount.openingBalance || 0) < formValue.amount) {
        alert('Insufficient balance in the source account');
        return;
      }
      
      // Create transaction records for both accounts
      const transferAmount = parseFloat(formValue.amount);
      const transferDate = new Date(formValue.date);
      
      const fromTransaction = {
        fromAccountId: formValue.fromAccount,
        toAccountId: formValue.toAccount,
        fromAccountName: fromAccount.name,
        toAccountName: toAccount.name,
        amount: transferAmount,
        date: transferDate,
        note: formValue.note || '',
        attachmentUrl: formValue.attachmentUrl || '',
        type: 'transfer',
        description: `Transfer to ${toAccount.name}`,
        paymentMethod: 'Transfer',
        debit: transferAmount,
        credit: 0,
        addedBy: 'User', // Replace with actual user
        hasDocument: !!formValue.attachmentUrl,
        createdAt: new Date()
      };
      
      const toTransaction = {
        fromAccountId: formValue.fromAccount,
        toAccountId: formValue.toAccount,
        fromAccountName: fromAccount.name,
        toAccountName: toAccount.name,
        amount: transferAmount,
        date: transferDate,
        note: formValue.note || '',
        attachmentUrl: formValue.attachmentUrl || '',
        type: 'transfer',
        description: `Transfer from ${fromAccount.name}`,
        paymentMethod: 'Transfer',
        debit: 0,
        credit: transferAmount,
        addedBy: 'User', // Replace with actual user
        hasDocument: !!formValue.attachmentUrl,
        createdAt: new Date()
      };
  
      // Use a batch write to ensure both transactions are created
      const transactionsRef = collection(this.firestore, 'transactions');
      const batch = writeBatch(this.firestore);
      
      const fromRef = doc(transactionsRef);
      batch.set(fromRef, fromTransaction);
      
      const toRef = doc(transactionsRef);
      batch.set(toRef, toTransaction);
  
      // Also create an entry in the fundTransfers collection for reference
      const fundTransferData = {
        fromAccountId: formValue.fromAccount,
        toAccountId: formValue.toAccount,
        fromAccountName: fromAccount.name,
        toAccountName: toAccount.name,
        amount: transferAmount,
        date: transferDate,
        note: formValue.note || '',
        attachmentUrl: formValue.attachmentUrl || '',
        addedBy: 'User', // Replace with actual user
        createdAt: new Date()
      };
      
      const transfersRef = collection(this.firestore, 'fundTransfers');
      const transferDoc = doc(transfersRef);
      batch.set(transferDoc, fundTransferData);
  

      

  
      // Commit the batch operation
      batch.commit()
        .then(() => {
          alert('Fund transfer completed successfully!');
          this.closeFundTransferForm();
        })
        .catch((err) => {
          console.error('Error during fund transfer:', err);
          alert('Error during fund transfer: ' + err.message);
        });
    } else {
      alert('Please fill all required fields');
    }
  }
  
  // Helper method to get account name
  getAccountName(accountId: string): string {
    const account = this.accounts.find(a => a.id === accountId);
    return account ? account.name : 'Unknown Account';
  }

  updateAccountBalances(fromAccountId: string, toAccountId: string, amount: number): void {
    // Find accounts
    const fromAccount = this.accounts.find(acc => acc.id === fromAccountId);
    const toAccount = this.accounts.find(acc => acc.id === toAccountId);
    
    if (fromAccount && toAccount) {
      // Update balances
      const fromNewBalance = (fromAccount.openingBalance || 0) - amount;
      const toNewBalance = (toAccount.openingBalance || 0) + amount;
      
      // Update in Firestore
      this.accountService.updateAccount(fromAccountId, { openingBalance: fromNewBalance })
        .then(() => console.log('From account balance updated'))
        .catch(err => console.error('Error updating from account:', err));
        
      this.accountService.updateAccount(toAccountId, { openingBalance: toNewBalance })
        .then(() => console.log('To account balance updated'))
        .catch(err => console.error('Error updating to account:', err));
    }
  }

  // Modified close function to show confirmation
  close(account: any): void {
    this.accountToClose = account;
    this.showCloseConfirmModal = true;
  }

  // Function to handle confirmation dialog
  confirmClose(): void {
    if (this.accountToClose && this.accountToClose.id) {
      this.accountService.deleteAccount(this.accountToClose.id)
        .then(() => {
          alert(`Account "${this.accountToClose.name}" deleted successfully!`);
          this.closeConfirmModal();
        })
        .catch((err) => {
          console.error('Error deleting account:', err);
          alert('Error deleting account: ' + err.message);
        });
    }
  }

  // Function to close the confirmation modal
  closeConfirmModal(): void {
    this.showCloseConfirmModal = false;
    this.accountToClose = null;
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  nextPage(): void {
    if (this.currentPage * this.entriesPerPage < this.totalEntries) {
      this.currentPage++;
    }
  }
  loadSalesRealtime(): void {
    this.saleService.getSalesWithAccountInfo().subscribe(
      (sales: any[]) => {
        this.sales = sales;
        // No need to reprocess here since loadAccountsRealtime handles sales integration
      },
      (error: any) => {
        console.error('Error loading sales:', error);
        this.sales = []; // Initialize empty array on error
      }
    );
  }
}