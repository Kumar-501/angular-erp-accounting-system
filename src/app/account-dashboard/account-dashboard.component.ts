// src/app/account-dashboard/account-dashboard.component.ts

import { Component, OnInit, OnDestroy } from '@angular/core';
import { AccountService } from '../services/account.service';

@Component({
  selector: 'app-account-dashboard',
  templateUrl: './account-dashboard.component.html',
  styleUrls: ['./account-dashboard.component.scss']
})
export class AccountDashboardComponent implements OnInit, OnDestroy {
  // --- State for Data Loading ---
  isLoading = true;
  
  // --- Data for Summary Cards ---
  totalAssets = 0;
  totalLiabilities = 0;
  netProfit = 0;
  activeAccountsCount = 0;

  // --- Data for Account Summary Section ---
  summary = {
    assets: 0,
    liabilities: 0,
    equity: 0,
    income: 0,
    expenses: 0,
    netProfit: 0
  };

  // --- Data for Recent Transactions Section ---
  recentTransactions: any[] = [];
  
  // --- Private properties for data and subscriptions ---
  private allAccounts: any[] = [];
  private allTransactions: any[] = [];
  private accountsUnsubscribe!: () => void;
  private transactionsUnsubscribe!: () => void;

  constructor(private accountService: AccountService) {}

  ngOnInit(): void {
    this.loadDashboardData();
  }

  ngOnDestroy(): void {
    if (this.accountsUnsubscribe) this.accountsUnsubscribe();
    if (this.transactionsUnsubscribe) this.transactionsUnsubscribe();
  }

  loadDashboardData(): void {
    this.isLoading = true;

    this.accountsUnsubscribe = this.accountService.getAccounts(accounts => {
      this.allAccounts = accounts;
      // Use a flag or check length to ensure both sets of data are present before calculating
      if (this.allTransactions.length > 0) {
        this.calculateDashboardData();
      }
    });

    this.transactionsUnsubscribe = this.accountService.getAllTransactions(transactions => {
      this.allTransactions = transactions;
      if (this.allAccounts.length > 0) {
        this.calculateDashboardData();
      }
    });
  }

  calculateDashboardData(): void {
    this.activeAccountsCount = this.allAccounts.length;
    
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;
    
    for (const account of this.allAccounts) {
      const balance = account.currentBalance !== undefined ? account.currentBalance : account.openingBalance;
      const group = account.accountHead?.group?.toLowerCase();

      switch (group) {
        case 'asset': totalAssets += balance; break;
        case 'liabilities': totalLiabilities += balance; break;
        case 'equity': totalEquity += balance; break;
      }
    }

    const totalIncome = this.allTransactions
      .filter(t => ['income', 'sale', 'receipt'].includes(t.source))
      .reduce((sum, t) => sum + (t.credit || 0), 0);
      
    const totalExpenses = this.allTransactions
      .filter(t => ['expense', 'payment', 'purchase'].includes(t.source))
      .reduce((sum, t) => sum + (t.debit || 0), 0);
      
    this.netProfit = totalIncome - totalExpenses;
    
    this.totalAssets = totalAssets;
    this.totalLiabilities = totalLiabilities;
    
    this.summary = {
      assets: totalAssets,
      liabilities: totalLiabilities,
      equity: totalEquity,
      income: totalIncome,
      expenses: totalExpenses,
      netProfit: this.netProfit
    };

    // --- 4. Get the 5 most recent transactions ---
    this.recentTransactions = [...this.allTransactions]
      //
      // FIX: Removed the redundant .toDate() calls.
      // 'a.date' and 'b.date' are already JS Date objects from the service.
      //
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 5)
      .map(t => ({
        description: t.description,
        date: t.date, // Keep it as a Date object for the pipe
        source: t.source,
        amount: (t.debit || t.credit),
        type: (t.debit > 0) ? 'debit' : 'credit'
      }));
      
    this.isLoading = false;
  }
}