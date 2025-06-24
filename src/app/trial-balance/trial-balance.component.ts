import { Component, OnInit } from '@angular/core';
import { AccountService } from '../services/account.service';
import { SaleService } from '../services/sale.service';
import { PurchaseService } from '../services/purchase.service';
import { Firestore, collection, getDocs, query, where } from '@angular/fire/firestore';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

interface TrialBalanceItem {
  accountName: string;
  accountNumber: string;
  accountHead: string;
  accountType: string;
  debit: number;
  credit: number;
  balance: number;
  openingBalance: number;
  totalDebits: number;
  totalCredits: number;
}

@Component({
  selector: 'app-trial-balance',
  templateUrl: './trial-balance.component.html',
  styleUrls: ['./trial-balance.component.scss']
})
export class TrialBalanceComponent implements OnInit {
  asOfDate: string = new Date().toISOString().split('T')[0];
  trialBalanceData: TrialBalanceItem[] = [];
  totalDebit: number = 0;
  totalCredit: number = 0;
  difference: number = 0;
  isLoading: boolean = false;
  errorMessage: string = '';
  constructor(
    private accountService: AccountService,
    private saleService: SaleService,
    private purchaseService: PurchaseService,
    private firestore: Firestore
  ) {}

  ngOnInit(): void {
    this.generateTrialBalance();
  }
  async generateTrialBalance(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = '';
    this.trialBalanceData = [];
    this.totalDebit = 0;
    this.totalCredit = 0;
    this.difference = 0;    try {
      // Get all accounts
      const accounts = await this.getAllAccounts();
      
      // Get all financial data up to the selected date
      const [transactions, sales, purchases] = await Promise.all([
        this.getTransactionsUpToDate(new Date(this.asOfDate)),
        this.getSalesUpToDate(new Date(this.asOfDate)),
        this.getPurchasesUpToDate(new Date(this.asOfDate))
      ]);
      
      console.log('Accounts found:', accounts.length);
      console.log('Transactions found:', transactions.length);
      console.log('Sales found:', sales.length);
      console.log('Purchases found:', purchases.length);
      
      // Calculate balances for each account using account-book logic
      const accountBalances = new Map<string, { 
        openingBalance: number, 
        totalDebits: number, 
        totalCredits: number, 
        finalBalance: number 
      }>();
      
      // Initialize accounts with opening balances
      accounts.forEach(account => {
        const openingBalance = Number(account.openingBalance) || 0;
        accountBalances.set(account.id, { 
          openingBalance: openingBalance,
          totalDebits: 0, 
          totalCredits: 0, 
          finalBalance: openingBalance 
        });
      });

      // Process direct transactions
      transactions.forEach(transaction => {
        this.processTransaction(transaction, accountBalances);
      });

      // Process sales (these increase account balances - credits)
      sales.forEach(sale => {
        this.processSale(sale, accountBalances);
      });

      // Process purchases (these decrease account balances - debits)
      purchases.forEach(purchase => {
        this.processPurchase(purchase, accountBalances);
      });

      // Prepare trial balance data following accounting principles
      accounts.forEach(account => {
        const balances = accountBalances.get(account.id)!;
        const accountType = (account.accountHead?.value || account.accountHead || '').toLowerCase();
        
        // Determine if this account type normally has a debit or credit balance
        const normallyDebitAccount = this.isNormallyDebitAccount(accountType);
        
        let debitAmount = 0;
        let creditAmount = 0;
        
        // Apply proper trial balance presentation
        if (balances.finalBalance > 0) {
          if (normallyDebitAccount) {
            debitAmount = balances.finalBalance;
          } else {
            creditAmount = balances.finalBalance;
          }
        } else if (balances.finalBalance < 0) {
          if (normallyDebitAccount) {
            creditAmount = Math.abs(balances.finalBalance);
          } else {
            debitAmount = Math.abs(balances.finalBalance);
          }
        }
        // If balance is 0, both debit and credit remain 0
          this.trialBalanceData.push({
          accountName: account.name,
          accountNumber: account.accountNumber || '',
          accountHead: account.accountHead?.value || account.accountHead || '',
          accountType: this.getAccountType(account.accountHead?.value || account.accountHead || ''),
          debit: debitAmount,
          credit: creditAmount,
          balance: balances.finalBalance,
          openingBalance: balances.openingBalance,
          totalDebits: balances.totalDebits,
          totalCredits: balances.totalCredits
        });

        console.log(`${account.name}: Balance ${balances.finalBalance}, TB Debit: ${debitAmount}, TB Credit: ${creditAmount}`);
      });      // Calculate totals
      this.totalDebit = this.trialBalanceData.reduce((sum, item) => sum + item.debit, 0);
      this.totalCredit = this.trialBalanceData.reduce((sum, item) => sum + item.credit, 0);
      this.difference = this.totalDebit - this.totalCredit;

      // Sort by account name
      this.trialBalanceData.sort((a, b) => a.accountName.localeCompare(b.accountName));

      console.log('Trial Balance Summary:');
      console.log('Total Debits:', this.totalDebit.toFixed(2));
      console.log('Total Credits:', this.totalCredit.toFixed(2));
      console.log('Difference:', this.difference.toFixed(2));
      
      if (Math.abs(this.difference) < 0.01) {
        console.log('✅ Trial Balance is BALANCED');
      } else {
        console.log('⚠️ Trial Balance is UNBALANCED - needs investigation');
      }

    } catch (error) {
      console.error('Error generating trial balance:', error);
      this.errorMessage = 'Failed to generate trial balance. Please try again.';
    } finally {
      this.isLoading = false;
    }
  }

  // Helper method to determine if an account type normally has a debit balance
  private isNormallyDebitAccount(accountType: string): boolean {
    const debitAccountTypes = [
      'assets', 'asset', 'bank', 'cash', 'accounts receivable', 'inventory', 
      'equipment', 'expenses', 'expense', 'cost of goods sold', 'cogs'
    ];
    
    return debitAccountTypes.some(type => accountType.includes(type));
  }
  private async getAllAccounts(): Promise<any[]> {
    try {
      console.log('Fetching all accounts...');
      
      const accountsRef = collection(this.firestore, 'accounts');
      const snapshot = await getDocs(accountsRef);      const accounts = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data['name'] || 'Unknown Account',
          accountNumber: data['accountNumber'] || '',
          accountHead: data['accountHead'] || '',
          openingBalance: Number(data['openingBalance']) || 0,
          ...data
        };
      });console.log('Accounts fetched:', accounts.length);
      accounts.forEach(account => {
        console.log(`Account: ${account['name'] || 'Unknown'} (${account.id}) - Opening Balance: ${account.openingBalance}`);
      });

      return accounts;
    } catch (error) {
      console.error('Error fetching accounts:', error);
      throw error;
    }
  }
  private async getTransactionsUpToDate(asOfDate: Date): Promise<any[]> {
    try {
      // Adjust date to include the entire day
      const endDate = new Date(asOfDate);
      endDate.setHours(23, 59, 59, 999);

      console.log('Fetching transactions up to:', endDate);

      const transactionsRef = collection(this.firestore, 'transactions');
      const q = query(
        transactionsRef,
        where('date', '<=', endDate)
      );
      
      const snapshot = await getDocs(q);
      const transactions = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          // Convert Firestore timestamp to Date
          date: this.convertToDate(data['date'])
        };
      });

      console.log('Raw transactions fetched:', transactions.length);
      return transactions;
    } catch (error) {
      console.error('Error fetching transactions:', error);
      throw error;
    }
  }

  // Get sales data up to date
  private async getSalesUpToDate(asOfDate: Date): Promise<any[]> {
    try {
      const endDate = new Date(asOfDate);
      endDate.setHours(23, 59, 59, 999);

      console.log('Fetching sales up to:', endDate);

      const salesRef = collection(this.firestore, 'sales');
      const q = query(
        salesRef,
        where('saleDate', '<=', endDate)
      );
      
      const snapshot = await getDocs(q);
      const sales = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          saleDate: this.convertToDate(data['saleDate'] || data['createdAt'])
        };
      });

      console.log('Sales fetched:', sales.length);
      return sales;
    } catch (error) {
      console.error('Error fetching sales:', error);
      return [];
    }
  }

  // Get purchases data up to date
  private async getPurchasesUpToDate(asOfDate: Date): Promise<any[]> {
    try {
      const endDate = new Date(asOfDate);
      endDate.setHours(23, 59, 59, 999);

      console.log('Fetching purchases up to:', endDate);

      const purchasesRef = collection(this.firestore, 'purchases');
      const q = query(
        purchasesRef,
        where('purchaseDate', '<=', endDate)
      );
      
      const snapshot = await getDocs(q);
      const purchases = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          purchaseDate: this.convertToDate(data['purchaseDate'] || data['createdAt'])
        };
      });

      console.log('Purchases fetched:', purchases.length);
      return purchases;
    } catch (error) {
      console.error('Error fetching purchases:', error);
      return [];
    }
  }

  // Helper method to convert various date formats to Date object (from account-book)
  private convertToDate(dateValue: any): Date {
    if (!dateValue) return new Date();
    if (dateValue instanceof Date) return dateValue;
    if (dateValue?.toDate && typeof dateValue.toDate === 'function') return dateValue.toDate(); // Handle Firestore Timestamp
    if (typeof dateValue === 'string') return new Date(dateValue);
    if (typeof dateValue === 'number') return new Date(dateValue);
    return new Date();
  }

  // Process individual transaction
  private processTransaction(transaction: any, accountBalances: Map<string, any>): void {
    const accountId = transaction.accountId;
    if (!accountBalances.has(accountId)) {
      console.warn('Transaction for unknown account:', accountId, transaction.description);
      return;
    }

    const balances = accountBalances.get(accountId)!;
    const debit = Number(transaction.debit) || 0;
    const credit = Number(transaction.credit) || 0;

    // Add to running totals
    balances.totalDebits += debit;
    balances.totalCredits += credit;
    
    // Calculate final balance: opening + credits - debits
    balances.finalBalance = balances.openingBalance + balances.totalCredits - balances.totalDebits;

    console.log(`Transaction - Account ${accountId}: Debit +${debit}, Credit +${credit}, Balance: ${balances.finalBalance}`);
  }
  // Process sale transaction
  private processSale(sale: any, accountBalances: Map<string, any>): void {
    const accountId = sale.paymentAccountId || sale.paymentAccount;
    if (!accountId || !accountBalances.has(accountId)) {
      console.warn('Sale for unknown account:', accountId, sale.invoiceNo);
      return;
    }

    // Only process if payment was made (not just "due")
    const paymentStatus = sale.paymentStatus || 'due';
    const paymentAmount = Number(sale.paymentAmount) || 0;
    
    if (paymentStatus !== 'due' || paymentAmount > 0) {
      const balances = accountBalances.get(accountId)!;
      // Sales increase account balance (credit)
      const saleAmount = paymentAmount > 0 ? paymentAmount : (Number(sale.itemsTotal) || 0);
      
      balances.totalCredits += saleAmount;
      balances.finalBalance = balances.openingBalance + balances.totalCredits - balances.totalDebits;

      console.log(`Sale - Account ${accountId}: Credit +${saleAmount}, Balance: ${balances.finalBalance}, Invoice: ${sale.invoiceNo}, Status: ${paymentStatus}`);
    } else {
      console.log(`Sale skipped (due/unpaid) - Account ${accountId}: Amount ${paymentAmount}, Status: ${paymentStatus}, Invoice: ${sale.invoiceNo}`);
    }
  }
  // Process purchase transaction
  private processPurchase(purchase: any, accountBalances: Map<string, any>): void {
    const paymentAccount = purchase.paymentAccount;
    const accountId = paymentAccount?.id || paymentAccount;
    
    if (!accountId || !accountBalances.has(accountId)) {
      console.warn('Purchase for unknown account:', accountId, purchase.referenceNo);
      return;
    }

    // Only process if payment was made (not just "due")
    const paymentStatus = purchase.paymentStatus || 'due';
    const paymentAmount = Number(purchase.paymentAmount) || 0;
    
    if (paymentStatus !== 'due' && paymentAmount > 0) {
      const balances = accountBalances.get(accountId)!;
      // Purchases decrease account balance (debit)
      
      balances.totalDebits += paymentAmount;
      balances.finalBalance = balances.openingBalance + balances.totalCredits - balances.totalDebits;

      console.log(`Purchase - Account ${accountId}: Debit +${paymentAmount}, Balance: ${balances.finalBalance}, Ref: ${purchase.referenceNo}, Status: ${paymentStatus}`);
    } else {
      console.log(`Purchase skipped (due/unpaid) - Account ${accountId}: Amount ${paymentAmount}, Status: ${paymentStatus}, Ref: ${purchase.referenceNo}`);
    }
  }  exportToExcel(): void {
    try {
      // Prepare data for Excel
      const excelData = [
        ['HERBALY TOUCH AYURVEDA PRODUCTS PRIVATE LIMITED', '', '', '', ''],
        ['Trial Balance', '', '', '', ''],
        [`As on ${new Date(this.asOfDate).toLocaleDateString()}`, '', '', '', ''],
        ['', '', '', '', ''],
        ['Account Name', 'Account Number', 'Account Head', 'Debit (₹)', 'Credit (₹)'],
        ...this.trialBalanceData.map(item => [
          item.accountName,
          item.accountNumber,
          item.accountHead,
          item.debit > 0 ? item.debit : '',
          item.credit > 0 ? item.credit : ''
        ]),
        ['Total', '', '', this.totalDebit, this.totalCredit]
      ];

      if (Math.abs(this.difference) > 0.01) {
        excelData.push(['Difference', '', '', this.difference > 0 ? this.difference : '', this.difference < 0 ? Math.abs(this.difference) : '']);
      }

      // Create worksheet
      const worksheet = XLSX.utils.aoa_to_sheet(excelData);
      
      // Create workbook
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Trial Balance');
      
      // Generate file name
      const fileName = `Trial_Balance_${this.asOfDate}.xlsx`;
      
      // Export to Excel
      XLSX.writeFile(workbook, fileName);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Error exporting to Excel. Please try again.');
    }
  }
  exportToPDF(): void {
    try {
      // Create new PDF document in portrait mode for simpler layout
      const doc = new jsPDF('p', 'pt');
      
      // Add title
      doc.setFontSize(16);
      doc.setTextColor(40, 40, 40);
      doc.text('HERBALY TOUCH AYURVEDA PRODUCTS PRIVATE LIMITED', 40, 40);
      doc.setFontSize(14);
      doc.text('Trial Balance', 40, 60);
      doc.setFontSize(12);
      doc.text(`As on ${new Date(this.asOfDate).toLocaleDateString()}`, 40, 80);

      // Prepare data for the table
      const tableData = this.trialBalanceData.map(item => [
        item.accountName,
        item.accountNumber,
        item.accountHead,
        item.debit > 0 ? item.debit.toFixed(2) : '-',
        item.credit > 0 ? item.credit.toFixed(2) : '-'
      ]);

      // Add total row
      tableData.push([
        'Total',
        '',
        '',
        this.totalDebit.toFixed(2),
        this.totalCredit.toFixed(2)
      ]);

      // Add difference row if needed
      if (Math.abs(this.difference) > 0.01) {
        tableData.push([
          'Difference',
          '',
          '',
          this.difference > 0 ? this.difference.toFixed(2) : '-',
          this.difference < 0 ? Math.abs(this.difference).toFixed(2) : '-'
        ]);
      }

      // Add table
      (doc as any).autoTable({
        startY: 100,
        head: [['Account Name', 'Account No.', 'Account Head', 'Debit (₹)', 'Credit (₹)']],
        body: tableData,
        styles: {
          fontSize: 10,
          cellPadding: 5
        },
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: 255,
          fontStyle: 'bold'
        },
        columnStyles: {
          3: { halign: 'right' },
          4: { halign: 'right' }
        }
      });

      // Add summary
      doc.setFontSize(12);
      const finalY = (doc as any).lastAutoTable.finalY || 100;
      doc.text('Summary', 40, finalY + 30);
      doc.text(`Total Debit: ₹${this.totalDebit.toFixed(2)}`, 40, finalY + 50);
      doc.text(`Total Credit: ₹${this.totalCredit.toFixed(2)}`, 40, finalY + 70);
      
      if (Math.abs(this.difference) > 0.01) {
        doc.setTextColor(this.difference > 0 ? 255 : 0, 0, 0);
        doc.text(`Difference: ₹${Math.abs(this.difference).toFixed(2)} ${this.difference > 0 ? '(Debit excess)' : '(Credit excess)'}`, 40, finalY + 90);
      } else {
        doc.setTextColor(0, 128, 0);
        doc.text('Trial Balance is balanced', 40, finalY + 90);
      }
      
      // Save the PDF
      doc.save(`Trial_Balance_${this.asOfDate}.pdf`);
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      alert('Error exporting to PDF. Please try again.');
    }
  }
  printReport(): void {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Popup was blocked. Please allow popups for this site to print.');
      return;
    }

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Trial Balance - HERBALY TOUCH AYURVEDA PRODUCTS PRIVATE LIMITED</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1, h2 { color: #333; }
          .header { text-align: center; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          .debit-amount { text-align: right; }
          .credit-amount { text-align: right; }
          .total-row { font-weight: bold; }
          .difference-row { font-weight: bold; }
          .positive { color: green; }
          .negative { color: red; }
          .balanced { color: green; font-weight: bold; }
          .unbalanced { color: red; font-weight: bold; }
          @media print {
            @page { size: portrait; margin: 10mm; }
            body { margin: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>HERBALY TOUCH AYURVEDA PRODUCTS PRIVATE LIMITED</h1>
          <h2>Trial Balance</h2>
          <p>As on ${new Date(this.asOfDate).toLocaleDateString()}</p>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>Account Name</th>
              <th>Account No.</th>
              <th>Account Head</th>
              <th class="debit-amount">Debit (₹)</th>
              <th class="credit-amount">Credit (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${this.trialBalanceData.map(item => `
              <tr>
                <td>${item.accountName}</td>
                <td>${item.accountNumber}</td>
                <td>${item.accountHead}</td>
                <td class="debit-amount">${item.debit > 0 ? item.debit.toFixed(2) : '-'}</td>
                <td class="credit-amount">${item.credit > 0 ? item.credit.toFixed(2) : '-'}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="3"><strong>Total</strong></td>
              <td class="debit-amount"><strong>${this.totalDebit.toFixed(2)}</strong></td>
              <td class="credit-amount"><strong>${this.totalCredit.toFixed(2)}</strong></td>
            </tr>
            ${Math.abs(this.difference) > 0.01 ? `
              <tr class="difference-row">
                <td colspan="3"><strong>Difference</strong></td>
                <td class="debit-amount"><strong>${this.difference > 0 ? this.difference.toFixed(2) : '-'}</strong></td>
                <td class="credit-amount"><strong>${this.difference < 0 ? Math.abs(this.difference).toFixed(2) : '-'}</strong></td>
              </tr>
            ` : ''}
          </tbody>
        </table>
        
        <div style="margin-top: 30px;">
          <h3>Summary</h3>
          <p>Total Debit: ₹${this.totalDebit.toFixed(2)}</p>
          <p>Total Credit: ₹${this.totalCredit.toFixed(2)}</p>
          <p>Status: <span class="${Math.abs(this.difference) < 0.01 ? 'balanced' : 'unbalanced'}">
            ${Math.abs(this.difference) < 0.01 ? 'Balanced' : `Unbalanced (Difference: ₹${Math.abs(this.difference).toFixed(2)})`}
          </span></p>
        </div>
        
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
  }

  // Computed properties for account type totals
  get assetsTotalDebit(): number {
    return this.trialBalanceData
      .filter(item => item.accountType === 'Assets')
      .reduce((sum, item) => sum + item.debit, 0);
  }

  get assetsTotalCredit(): number {
    return this.trialBalanceData
      .filter(item => item.accountType === 'Assets')
      .reduce((sum, item) => sum + item.credit, 0);
  }

  get liabilitiesTotalDebit(): number {
    return this.trialBalanceData
      .filter(item => item.accountType === 'Liabilities')
      .reduce((sum, item) => sum + item.debit, 0);
  }

  get liabilitiesTotalCredit(): number {
    return this.trialBalanceData
      .filter(item => item.accountType === 'Liabilities')
      .reduce((sum, item) => sum + item.credit, 0);
  }

  get incomeTotal(): number {
    return this.trialBalanceData
      .filter(item => item.accountType === 'Income')
      .reduce((sum, item) => sum + item.credit, 0);
  }

  get expenseTotal(): number {
    return this.trialBalanceData
      .filter(item => item.accountType === 'Expenses')
      .reduce((sum, item) => sum + item.debit, 0);
  }

  get accountTypeGroups(): {type: string, accounts: TrialBalanceItem[], totalDebit: number, totalCredit: number}[] {
    const types = ['Assets', 'Liabilities', 'Equity', 'Income', 'Expenses', 'Other'];
    return types.map(type => {
      const accounts = this.trialBalanceData.filter(item => item.accountType === type);
      const totalDebit = accounts.reduce((sum, item) => sum + item.debit, 0);
      const totalCredit = accounts.reduce((sum, item) => sum + item.credit, 0);
      return { type, accounts, totalDebit, totalCredit };
    }).filter(group => group.accounts.length > 0);
  }

  // Helper method to determine account type for better categorization
  private getAccountType(accountHead: string): string {
    const head = accountHead.toLowerCase();
    
    if (head.includes('asset')) return 'Assets';
    if (head.includes('liability') || head.includes('payable')) return 'Liabilities';
    if (head.includes('equity') || head.includes('capital')) return 'Equity';
    if (head.includes('income') || head.includes('revenue') || head.includes('sales')) return 'Income';
    if (head.includes('expense') || head.includes('cost')) return 'Expenses';
    
    // Default categorization based on common account types
    if (head.includes('bank') || head.includes('cash') || head.includes('receivable') || head.includes('inventory')) return 'Assets';
    if (head.includes('loan') || head.includes('credit')) return 'Liabilities';
    
    return 'Other';
  }

  // Helper methods for template
  Math = Math; // Make Math available in template

  // Computed properties for absolute difference and balance status
  get absDifference(): number {
    return Math.abs(this.difference);
  }

  get isBalanced(): boolean {
    return this.absDifference < 0.01;
  }
}