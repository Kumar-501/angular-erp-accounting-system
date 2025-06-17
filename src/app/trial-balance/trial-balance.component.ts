import { Component, OnInit } from '@angular/core';
import { AccountService } from '../services/account.service';
import { Firestore, collection, getDocs, query, where } from '@angular/fire/firestore';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

interface TrialBalanceItem {
  accountName: string;
  accountNumber: string;
  accountHead: string;
  debit: number;
  credit: number;
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
    this.difference = 0;

    try {
      // Get all accounts
      const accounts = await this.getAllAccounts();
      
      // Get all transactions up to the selected date
      const transactions = await this.getTransactionsUpToDate(new Date(this.asOfDate));
      
      // Calculate debit/credit totals for each account
      const accountBalances = new Map<string, { debit: number, credit: number }>();
      
      // Initialize with zero balances
      accounts.forEach(account => {
        accountBalances.set(account.id, { debit: 0, credit: 0 });
      });

      // Process transactions
      transactions.forEach(transaction => {
        if (accountBalances.has(transaction.accountId)) {
          const balances = accountBalances.get(transaction.accountId)!;
          
          if (transaction.debit && transaction.debit > 0) {
            balances.debit += Number(transaction.debit);
          }
          
          if (transaction.credit && transaction.credit > 0) {
            balances.credit += Number(transaction.credit);
          }
        }
      });

      // Prepare trial balance data
      accounts.forEach(account => {
        const balances = accountBalances.get(account.id)!;
        const netBalance = balances.credit - balances.debit;
        
        this.trialBalanceData.push({
          accountName: account.name,
          accountNumber: account.accountNumber || '',
          accountHead: account.accountHead?.value || account.accountHead || '',
          debit: netBalance < 0 ? Math.abs(netBalance) : 0,
          credit: netBalance > 0 ? netBalance : 0
        });
      });

      // Calculate totals
      this.totalDebit = this.trialBalanceData.reduce((sum, item) => sum + item.debit, 0);
      this.totalCredit = this.trialBalanceData.reduce((sum, item) => sum + item.credit, 0);
      this.difference = this.totalDebit - this.totalCredit;

      // Sort by account name
      this.trialBalanceData.sort((a, b) => a.accountName.localeCompare(b.accountName));

    } catch (error) {
      console.error('Error generating trial balance:', error);
      this.errorMessage = 'Failed to generate trial balance. Please try again.';
    } finally {
      this.isLoading = false;
    }
  }

  private async getAllAccounts(): Promise<any[]> {
    try {
      const accountsRef = collection(this.firestore, 'accounts');
      const snapshot = await getDocs(accountsRef);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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

      const transactionsRef = collection(this.firestore, 'transactions');
      const q = query(
        transactionsRef,
        where('date', '<=', endDate)
      );
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error fetching transactions:', error);
      throw error;
    }
  }

  exportToExcel(): void {
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
          item.debit,
          item.credit
        ]),
        ['Total', '', '', this.totalDebit, this.totalCredit]
      ];

      if (this.difference !== 0) {
        excelData.push(['Difference', '', '', '', this.difference]);
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
      // Create new PDF document in portrait mode
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
        item.debit.toFixed(2),
        item.credit.toFixed(2)
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
      if (this.difference !== 0) {
        tableData.push([
          'Difference',
          '',
          '',
          '',
          this.difference.toFixed(2)
        ]);
      }

      // Add table
      (doc as any).autoTable({
        startY: 100,
        head: [['Account Name', 'Account No.', 'Account Head', 'Debit (₹)', 'Credit (₹)']],
        body: tableData,
        styles: {
          fontSize: 8,
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
      
      if (this.difference !== 0) {
        doc.setTextColor(this.difference > 0 ? 0 : 255, 0, 0);
        doc.text(`Difference: ₹${this.difference.toFixed(2)}`, 40, finalY + 90);
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
          .balanced { color: green; }
          .unbalanced { color: red; }
          @media print {
            @page { size: landscape; margin: 10mm; }
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
              <th>Account Number</th>
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
                <td class="debit-amount">${item.debit.toFixed(2)}</td>
                <td class="credit-amount">${item.credit.toFixed(2)}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="3">Total</td>
              <td class="debit-amount">${this.totalDebit.toFixed(2)}</td>
              <td class="credit-amount">${this.totalCredit.toFixed(2)}</td>
            </tr>
            ${this.difference !== 0 ? `
              <tr class="difference-row">
                <td colspan="3">Difference</td>
                <td colspan="2" class="${this.difference > 0 ? 'positive' : 'negative'}">
                  ${this.difference.toFixed(2)}
                </td>
              </tr>
            ` : ''}
          </tbody>
        </table>
        
        <div style="margin-top: 30px;">
          <h3>Summary</h3>
          <p>Total Debit: ₹${this.totalDebit.toFixed(2)}</p>
          <p>Total Credit: ₹${this.totalCredit.toFixed(2)}</p>
          <p>Status: <span class="${this.difference === 0 ? 'balanced' : 'unbalanced'}">
            ${this.difference === 0 ? 'Balanced' : 'Unbalanced'}
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
}