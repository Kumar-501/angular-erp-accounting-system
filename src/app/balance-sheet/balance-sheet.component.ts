// balance-sheet.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { AccountService } from '../services/account.service';
import { ProfitLossService } from '../services/profit-loss.service';
import { Firestore, collection, getDocs } from '@angular/fire/firestore';
import { Subscription, interval } from 'rxjs';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

interface BalanceSheetItem {
  name: string;
  accountNumber: string;
  value: number;
  accountHead: string;
  isRealtimeData?: boolean;
}

interface BalanceSheetData {
  equity: BalanceSheetItem[];
  liabilities: BalanceSheetItem[];
  assets: BalanceSheetItem[];
  totals: {
    equity: number;
    liabilities: number;
    assets: number;
  };
  lastUpdated?: Date;
  profitLossLastUpdated?: Date;
}

@Component({
  selector: 'app-balance-sheet',
  templateUrl: './balance-sheet.component.html',
  styleUrls: ['./balance-sheet.component.scss']
})
export class BalanceSheetComponent implements OnInit, OnDestroy {
  balanceSheetDate: string = new Date().toISOString().split('T')[0];
  balanceSheetData: BalanceSheetData = {
    equity: [],
    liabilities: [],
    assets: [],
    totals: {
      equity: 0,
      liabilities: 0,
      assets: 0
    }
  };
  profitLossData: any = null;
  isLoading = false;
  errorMessage = '';
  autoRefreshEnabled = true;
  refreshInterval = 5; // minutes
  
  private refreshSubscription?: Subscription;
  private readonly COMPANY_NAME = 'HERBALY TOUCH AYURVEDA PRODUCTS PRIVATE LIMITED';

  constructor(
    private accountService: AccountService,
    private profitLossService: ProfitLossService,
    private firestore: Firestore
  ) {}

  async ngOnInit(): Promise<void> {
    await this.generateBalanceSheet();
    this.startAutoRefresh();
  }

  ngOnDestroy(): void {
    this.stopAutoRefresh();
  }

  /**
   * Start auto-refresh timer
   */
  private startAutoRefresh(): void {
    if (this.autoRefreshEnabled && this.refreshInterval > 0) {
      this.refreshSubscription = interval(this.refreshInterval * 60 * 1000)
        .subscribe(() => {
          if (!this.isLoading) {
            console.log('Auto-refreshing balance sheet...');
            this.generateBalanceSheet(true);
          }
        });
    }
  }

  /**
   * Stop auto-refresh timer
   */
  private stopAutoRefresh(): void {
    if (this.refreshSubscription) {
      this.refreshSubscription.unsubscribe();
      this.refreshSubscription = undefined;
    }
  }

  /**
   * Toggle auto-refresh
   */
  toggleAutoRefresh(): void {
    this.autoRefreshEnabled = !this.autoRefreshEnabled;
    
    if (this.autoRefreshEnabled) {
      this.startAutoRefresh();
    } else {
      this.stopAutoRefresh();
    }
  }

  /**
   * Manual refresh
   */
  async manualRefresh(): Promise<void> {
    await this.generateBalanceSheet(true);
  }

  /**
   * Generate balance sheet with real-time profit/loss data
   */
  async generateBalanceSheet(forceRefresh = false): Promise<void> {
    this.isLoading = true;
    this.errorMessage = '';
    
    // Reset balance sheet data
    this.balanceSheetData = {
      equity: [],
      liabilities: [],
      assets: [],
      totals: {
        equity: 0,
        liabilities: 0,
        assets: 0
      },
      lastUpdated: new Date()
    };

    try {
      console.log('Generating balance sheet with real-time data...');

      // Load accounts and profit/loss data in parallel
      const [accounts, profitLossData] = await Promise.all([
        this.getAllAccounts(),
        this.loadRealtimeProfitLossData(forceRefresh)
      ]);
      
      // Categorize accounts into balance sheet sections
      this.categorizeAccounts(accounts);

      // Add real-time profit/loss to equity
      if (profitLossData && profitLossData.netProfit !== undefined) {
        this.addProfitLossToEquity(profitLossData);
        this.balanceSheetData.profitLossLastUpdated = profitLossData.lastUpdated;
      } else {
        // Fallback: Calculate profit/loss as difference to balance the sheet
        this.addCalculatedProfitLoss();
      }

      // Validate balance sheet
      this.validateBalanceSheet();

      console.log('Balance sheet generated successfully:', this.balanceSheetData);
    } catch (error) {
      console.error('Error generating balance sheet:', error);
      this.errorMessage = `Failed to generate balance sheet: ${error instanceof Error ? error.message : 'Unknown error'}`;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Load real-time profit/loss data
   */
  private async loadRealtimeProfitLossData(forceRefresh = false): Promise<any> {
    try {
      const endDate = new Date(this.balanceSheetDate);
      const startDate = new Date(endDate.getFullYear(), 0, 1); // Fiscal year start
      
      console.log('Loading real-time profit/loss data for period:', {
        start: startDate.toDateString(),
        end: endDate.toDateString(),
        forceRefresh
      });
      
      this.profitLossData = await this.profitLossService.getProfitLossReport(
        startDate,
        endDate,
        forceRefresh
      );
      
      console.log('Real-time profit/loss data loaded:', {
        netProfit: this.profitLossData.netProfit,
        grossProfit: this.profitLossData.grossProfit,
        isRealtimeData: this.profitLossData.isRealtimeData,
        lastUpdated: this.profitLossData.lastUpdated
      });
      
      return this.profitLossData;
    } catch (error) {
      console.error('Error loading real-time profit/loss data:', error);
      this.profitLossData = null;
      return null;
    }
  }

  /**
   * Categorize accounts into balance sheet sections
   */
  private categorizeAccounts(accounts: any[]): void {
    accounts.forEach(account => {
      if (account.accountHead?.group) {
        const group = account.accountHead.group.toLowerCase();
        const value = account.openingBalance || 0;
        
        const balanceSheetItem: BalanceSheetItem = {
          name: account.name,
          accountNumber: account.accountNumber || '',
          value: value,
          accountHead: account.accountHead.value || account.accountHead.group
        };
        
        switch (group) {
          case 'equity':
            this.addAccountToSection('equity', balanceSheetItem);
            break;
          case 'liabilities':
            this.addAccountToSection('liabilities', balanceSheetItem);
            break;
          case 'asset':
          case 'assets':
            this.addAccountToSection('assets', balanceSheetItem);
            break;
          default:
            console.warn(`Unknown account group: ${group} for account: ${account.name}`);
        }
      } else {
        console.warn(`Account missing accountHead.group: ${account.name}`);
      }
    });
  }

  /**
   * Add account to specific section
   */
  private addAccountToSection(section: keyof Pick<BalanceSheetData, 'equity' | 'liabilities' | 'assets'>, item: BalanceSheetItem): void {
    this.balanceSheetData[section].push(item);
    this.balanceSheetData.totals[section] += item.value;
  }

  /**
   * Add real-time profit/loss to equity section
   */
  private addProfitLossToEquity(profitLossData: any): void {
    const profitLossValue = profitLossData.netProfit || 0;
    
    if (profitLossValue !== 0) {
      const profitLossItem: BalanceSheetItem = {
        name: profitLossValue >= 0 ? 'Retained Earnings (Profit)' : 'Accumulated Loss',
        accountNumber: '',
        value: profitLossValue,
        accountHead: 'Profit & Loss',
        isRealtimeData: profitLossData.isRealtimeData
      };
      
      this.addAccountToSection('equity', profitLossItem);
      console.log(`Added ${profitLossValue >= 0 ? 'profit' : 'loss'} to equity: ${this.formatCurrency(profitLossValue)}`);
    }
  }

  /**
   * Add calculated profit/loss to balance the sheet
   */
  private addCalculatedProfitLoss(): void {
    const profitLoss = this.balanceSheetData.totals.assets - 
                      (this.balanceSheetData.totals.liabilities + this.balanceSheetData.totals.equity);
    
    if (Math.abs(profitLoss) > 0.01) { // Only add if significant difference
      const calculatedItem: BalanceSheetItem = {
        name: profitLoss >= 0 ? 'Profit & Loss (Calculated)' : 'Loss (Calculated)',
        accountNumber: '',
        value: profitLoss,
        accountHead: 'Calculated P&L'
      };
      
      this.addAccountToSection('equity', calculatedItem);
      console.warn(`Added calculated profit/loss to balance sheet: ${this.formatCurrency(profitLoss)}`);
    }
  }

  /**
   * Validate that the balance sheet balances
   */
  private validateBalanceSheet(): void {
    const totalEquityAndLiabilities = this.balanceSheetData.totals.equity + this.balanceSheetData.totals.liabilities;
    const totalAssets = this.balanceSheetData.totals.assets;
    const difference = Math.abs(totalAssets - totalEquityAndLiabilities);
    
    if (difference > 0.01) {
      console.warn(`Balance sheet does not balance! Difference: ${this.formatCurrency(difference)}`);
      this.errorMessage = `Warning: Balance sheet does not balance. Difference: ${this.formatCurrency(difference)}`;
    } else {
      console.log('Balance sheet validates successfully');
    }
  }

  /**
   * Get all accounts from Firestore
   */
  private async getAllAccounts(): Promise<any[]> {
    try {
      const accountsRef = collection(this.firestore, 'accounts');
      const snapshot = await getDocs(accountsRef);
      const accounts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log(`Fetched ${accounts.length} accounts`);
      return accounts;
    } catch (error) {
      console.error('Error fetching accounts:', error);
      throw new Error(`Failed to fetch accounts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Format currency value
   */
  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(value);
  }

  /**
   * Get balance sheet status
   */
  getBalanceSheetStatus(): string {
    if (this.isLoading) return 'Loading...';
    if (this.errorMessage) return 'Error';
    
    const totalEquityAndLiabilities = this.balanceSheetData.totals.equity + this.balanceSheetData.totals.liabilities;
    const totalAssets = this.balanceSheetData.totals.assets;
    const difference = Math.abs(totalAssets - totalEquityAndLiabilities);
    
    if (difference > 0.01) return 'Unbalanced';
    return 'Balanced';
  }

  exportToExcel(): void {
    try {
      // Prepare data for Excel
      const excelData = [
        ['HERBALY TOUCH AYURVEDA PRODUCTS PRIVATE LIMITED', '', '', ''],
        ['Balance Sheet', '', '', ''],
        [`As on ${new Date(this.balanceSheetDate).toLocaleDateString()}`, '', '', ''],
        ['', '', '', ''],
        ['Equity', '', '', ''],
        ...this.balanceSheetData.equity.map((item: { name: any; accountNumber: any; accountHead: any; value: number; }) => [
          item.name, 
          item.accountNumber, 
          item.accountHead, 
          this.formatCurrency(item.value)
        ]),
        ['Total Equity', '', '', this.formatCurrency(this.balanceSheetData.totals.equity)],
        ['', '', '', ''],
        ['Liabilities', '', '', ''],
        ...this.balanceSheetData.liabilities.map((item: { name: any; accountNumber: any; accountHead: any; value: number; }) => [
          item.name, 
          item.accountNumber, 
          item.accountHead, 
          this.formatCurrency(item.value)
        ]),
        ['Total Liabilities', '', '', this.formatCurrency(this.balanceSheetData.totals.liabilities)],
        ['', '', '', ''],
        ['Assets', '', '', ''],
        ...this.balanceSheetData.assets.map((item: { name: any; accountNumber: any; accountHead: any; value: number; }) => [
          item.name, 
          item.accountNumber, 
          item.accountHead, 
          this.formatCurrency(item.value)
        ]),
        ['Total Assets', '', '', this.formatCurrency(this.balanceSheetData.totals.assets)]
      ];

      // Create worksheet
      const worksheet = XLSX.utils.aoa_to_sheet(excelData);
      
      // Create workbook
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Balance Sheet');
      
      // Generate file name
      const fileName = `Herbaly_Touch_Balance_Sheet_${this.balanceSheetDate}.xlsx`;
      
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
      doc.text('Balance Sheet', 40, 60);
      doc.setFontSize(12);
      doc.text(`As on ${new Date(this.balanceSheetDate).toLocaleDateString()}`, 40, 80);
      
      // Add Equity section
      doc.setFontSize(14);
      doc.text('Equity', 40, 120);
      doc.setFontSize(10);
      
      const equityData = this.balanceSheetData.equity.map((item: { name: any; accountNumber: any; accountHead: any; value: number; }) => [
        item.name,
        item.accountNumber,
        item.accountHead,
        this.formatCurrency(item.value)
      ]);
      
      equityData.push([
        'Total Equity', '', '', this.formatCurrency(this.balanceSheetData.totals.equity)
      ]);
      
      (doc as any).autoTable({
        startY: 130,
        head: [['Account Name', 'Account Number', 'Account Head', 'Amount']],
        body: equityData,
        styles: {
          fontSize: 8,
          cellPadding: 5
        },
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: 255,
          fontStyle: 'bold'
        }
      });
      
      // Add Liabilities section
      doc.setFontSize(14);
      (doc as any).lastAutoTable.finalY || 130;
      doc.text('Liabilities', 40, (doc as any).lastAutoTable.finalY + 30);
      doc.setFontSize(10);
      
      const liabilitiesData = this.balanceSheetData.liabilities.map((item: { name: any; accountNumber: any; accountHead: any; value: number; }) => [
        item.name,
        item.accountNumber,
        item.accountHead,
        this.formatCurrency(item.value)
      ]);
      
      liabilitiesData.push([
        'Total Liabilities', '', '', this.formatCurrency(this.balanceSheetData.totals.liabilities)
      ]);
      
      (doc as any).autoTable({
        startY: (doc as any).lastAutoTable.finalY + 40,
        head: [['Account Name', 'Account Number', 'Account Head', 'Amount']],
        body: liabilitiesData,
        styles: {
          fontSize: 8,
          cellPadding: 5
        },
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: 255,
          fontStyle: 'bold'
        }
      });
      
      // Add Assets section
      doc.setFontSize(14);
      doc.text('Assets', 40, (doc as any).lastAutoTable.finalY + 30);
      doc.setFontSize(10);
      
      const assetsData = this.balanceSheetData.assets.map((item: { name: any; accountNumber: any; accountHead: any; value: number; }) => [
        item.name,
        item.accountNumber,
        item.accountHead,
        this.formatCurrency(item.value)
      ]);
      
      assetsData.push([
        'Total Assets', '', '', this.formatCurrency(this.balanceSheetData.totals.assets)
      ]);
      
      (doc as any).autoTable({
        startY: (doc as any).lastAutoTable.finalY + 40,
        head: [['Account Name', 'Account Number', 'Account Head', 'Amount']],
        body: assetsData,
        styles: {
          fontSize: 8,
          cellPadding: 5
        },
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: 255,
          fontStyle: 'bold'
        }
      });
      
      // Add summary
      doc.setFontSize(12);
      doc.text('Summary', 40, (doc as any).lastAutoTable.finalY + 30);
      
      const summaryData = [
        ['Total Equity', this.formatCurrency(this.balanceSheetData.totals.equity)],
        ['Total Liabilities', this.formatCurrency(this.balanceSheetData.totals.liabilities)],
        ['Total Equity + Liabilities', this.formatCurrency(this.balanceSheetData.totals.equity + this.balanceSheetData.totals.liabilities)],
        ['Total Assets', this.formatCurrency(this.balanceSheetData.totals.assets)]
      ];
      
      (doc as any).autoTable({
        startY: (doc as any).lastAutoTable.finalY + 40,
        body: summaryData,
        styles: {
          fontSize: 10,
          cellPadding: 5
        },
        columnStyles: {
          1: { fontStyle: 'bold' }
        }
      });
      
      // Save the PDF
      doc.save(`Herbaly_Touch_Balance_Sheet_${this.balanceSheetDate}.pdf`);
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      alert('Error exporting to PDF. Please try again.');
    }
  }

  printBalanceSheet(): void {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Popup was blocked. Please allow popups for this site to print.');
      return;
    }

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Balance Sheet - HERBALY TOUCH AYURVEDA PRODUCTS PRIVATE LIMITED</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1, h2 { color: #333; }
          .header { text-align: center; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          .total-row { font-weight: bold; }
          .section-title { margin-top: 20px; font-weight: bold; }
          .text-right { text-align: right; }
          @media print {
            @page { size: portrait; margin: 10mm; }
            body { margin: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>HERBALY TOUCH AYURVEDA PRODUCTS PRIVATE LIMITED</h1>
          <h2>Balance Sheet</h2>
          <p>As on ${new Date(this.balanceSheetDate).toLocaleDateString()}</p>
        </div>
        
        <div class="section-title">Equity</div>
        <table>
          <thead>
            <tr>
              <th>Account Name</th>
              <th>Account Number</th>
              <th>Account Head</th>
              <th class="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${this.balanceSheetData.equity.map((item: { name: any; accountNumber: any; accountHead: any; value: number; }) => `
              <tr>
                <td>${item.name}</td>
                <td>${item.accountNumber}</td>
                <td>${item.accountHead}</td>
                <td class="text-right">${this.formatCurrency(item.value)}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="3">Total Equity</td>
              <td class="text-right">${this.formatCurrency(this.balanceSheetData.totals.equity)}</td>
            </tr>
          </tbody>
        </table>
        
        <div class="section-title">Liabilities</div>
        <table>
          <thead>
            <tr>
              <th>Account Name</th>
              <th>Account Number</th>
              <th>Account Head</th>
              <th class="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${this.balanceSheetData.liabilities.map((item: { name: any; accountNumber: any; accountHead: any; value: number; }) => `
              <tr>
                <td>${item.name}</td>
                <td>${item.accountNumber}</td>
                <td>${item.accountHead}</td>
                <td class="text-right">${this.formatCurrency(item.value)}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="3">Total Liabilities</td>
              <td class="text-right">${this.formatCurrency(this.balanceSheetData.totals.liabilities)}</td>
            </tr>
          </tbody>
        </table>
        
        <div class="section-title">Assets</div>
        <table>
          <thead>
            <tr>
              <th>Account Name</th>
              <th>Account Number</th>
              <th>Account Head</th>
              <th class="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${this.balanceSheetData.assets.map((item: { name: any; accountNumber: any; accountHead: any; value: number; }) => `
              <tr>
                <td>${item.name}</td>
                <td>${item.accountNumber}</td>
                <td>${item.accountHead}</td>
                <td class="text-right">${this.formatCurrency(item.value)}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="3">Total Assets</td>
              <td class="text-right">${this.formatCurrency(this.balanceSheetData.totals.assets)}</td>
            </tr>
          </tbody>
        </table>
        
        <div class="section-title">Summary</div>
        <table>
          <tbody>
            <tr>
              <td>Total Equity</td>
              <td class="text-right">${this.formatCurrency(this.balanceSheetData.totals.equity)}</td>
            </tr>
            <tr>
              <td>Total Liabilities</td>
              <td class="text-right">${this.formatCurrency(this.balanceSheetData.totals.liabilities)}</td>
            </tr>
            <tr class="total-row">
              <td>Total Equity + Liabilities</td>
              <td class="text-right">${this.formatCurrency(this.balanceSheetData.totals.equity + this.balanceSheetData.totals.liabilities)}</td>
            </tr>
            <tr class="total-row">
              <td>Total Assets</td>
              <td class="text-right">${this.formatCurrency(this.balanceSheetData.totals.assets)}</td>
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
  }
}