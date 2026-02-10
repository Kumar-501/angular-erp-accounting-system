// src/app/balance-sheet-2/balance-sheet-2.component.ts

import { Component, OnInit, OnDestroy } from '@angular/core';
import { AccountService } from '../services/account.service';

// Interface for a single account line item
interface ReportItem {
  name: string;
  balance: number;
}

// Interface for a categorized group (e.g., Fixed Assets)
interface ReportGroup {
  groupName: string;
  items: ReportItem[];
  total: number;
}

@Component({
  selector: 'app-balance-sheet-2',
  templateUrl: './balance-sheet-2.component.html',
  styleUrls: ['./balance-sheet-2.component.scss']
})
export class BalanceSheet2Component implements OnInit, OnDestroy {
  isLoading = true;
  asOfDate: string = new Date().toISOString().split('T')[0];

  // Data structures for the report
  assetGroups: ReportGroup[] = [];
  liabilityEquityGroups: ReportGroup[] = [];

  totalAssets = 0;
  totalLiabilitiesAndEquity = 0;
  
  private accountsUnsubscribe!: () => void;
  private transactionsUnsubscribe!: () => void;
  
  constructor(private accountService: AccountService) {}

  ngOnInit(): void {
    this.generateReport();
  }

  ngOnDestroy(): void {
    if (this.accountsUnsubscribe) this.accountsUnsubscribe();
    if (this.transactionsUnsubscribe) this.transactionsUnsubscribe();
  }

  /**
   * Main function to generate the entire balance sheet report.
   */
  generateReport(): void {
    this.isLoading = true;
    
    // Fetch fresh data every time the report is generated
    this.accountsUnsubscribe = this.accountService.getAccounts(allAccounts => {
        // Now that we have the latest accounts, we can build the report
        this.buildReport(allAccounts);
        this.isLoading = false;
    });
  }

  /**
   * Processes the raw account data into the structured format needed for the template.
   * @param allAccounts - The array of account objects from the AccountService.
   */
  private buildReport(allAccounts: any[]): void {
    // --- Reset all data structures ---
    this.assetGroups = [];
    this.liabilityEquityGroups = [];
    this.totalAssets = 0;
    this.totalLiabilitiesAndEquity = 0;

    // --- Define the structure and mapping for our report ---
    const reportStructure = {
      assets: {
        'Fixed Assets': 'fixed_assets',
        'Current Assets': 'current_assets',
      },
      liabilitiesAndEquity: {
        'Current Liabilities': 'current_liabilities',
        'Long-Term Liabilities': 'loans_liabilities', // Assuming this mapping
        'Equity': 'capital_account'
      }
    };
    
    // --- Process ASSETS ---
    for (const [groupName, headValue] of Object.entries(reportStructure.assets)) {
      const groupAccounts = allAccounts.filter(acc => acc.accountHead?.value === headValue);
      
      const group: ReportGroup = {
        groupName: groupName,
        items: groupAccounts.map(acc => ({
          name: acc.name,
          balance: acc.currentBalance ?? acc.openingBalance ?? 0
        })),
        total: 0
      };
      group.total = group.items.reduce((sum, item) => sum + item.balance, 0);
      
      this.assetGroups.push(group);
      this.totalAssets += group.total;
    }

    // --- Process LIABILITIES & EQUITY ---
     for (const [groupName, headValue] of Object.entries(reportStructure.liabilitiesAndEquity)) {
      const groupAccounts = allAccounts.filter(acc => acc.accountHead?.value === headValue);
      
      const group: ReportGroup = {
        groupName: groupName,
        items: groupAccounts.map(acc => ({
          name: acc.name,
          balance: acc.currentBalance ?? acc.openingBalance ?? 0
        })),
        total: 0
      };
      group.total = group.items.reduce((sum, item) => sum + item.balance, 0);
      
      this.liabilityEquityGroups.push(group);
      this.totalLiabilitiesAndEquity += group.total;
    }
  }

  get isBalanced(): boolean {
    // Using a small tolerance for floating point comparisons
    return Math.abs(this.totalAssets - this.totalLiabilitiesAndEquity) < 0.01;
  }
}