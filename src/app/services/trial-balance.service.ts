import { Injectable } from '@angular/core';
import { AccountService } from './account.service';
import { Firestore, collection, query, where, getDocs } from '@angular/fire/firestore';
import { ExpenseService } from './expense.service';
import { PurchaseService } from './purchase.service';
import { SaleService } from './sale.service';

export interface TrialBalanceEntry {
  accountId: string;
  accountName: string;
  accountNumber: string;
  debit: number;
  credit: number;
}

export interface TrialBalance {
  entries: TrialBalanceEntry[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class TrialBalanceService {
  constructor(
    private firestore: Firestore,
    private accountService: AccountService,
    private expenseService: ExpenseService,
    private purchaseService: PurchaseService,
    private saleService: SaleService
    // private incomeService: IncomeService
  ) {}

  async getDetailedTrialBalance(asOfDate: Date): Promise<TrialBalance> {
    // Get all accounts first
    const accounts = await new Promise<any[]>((resolve) => {
      this.accountService.getAccounts(resolve);
    });

    // Initialize trial balance entries with opening balances
    const trialBalanceEntries: TrialBalanceEntry[] = accounts.map(account => {
      const accountHead = (account.accountHead?.value || account.accountHead || '').toLowerCase();
      let debit = 0;
      let credit = 0;

      // For asset and expense accounts, opening balance is debit
      if (accountHead.includes('asset') || accountHead.includes('expense') || 
          accountHead.includes('purchase') || accountHead.includes('cost')) {
        debit = account.openingBalance || 0;
      } 
      // For liability, equity, and income accounts, opening balance is credit
      else if (accountHead.includes('liability') || accountHead.includes('equity') || 
               accountHead.includes('capital') || accountHead.includes('income') || 
               accountHead.includes('revenue') || accountHead.includes('sale')) {
        credit = account.openingBalance || 0;
      }

      return {
        accountId: account.id,
        accountName: account.name,
        accountNumber: account.accountNumber || '',
        debit,
        credit
      };
    });

    // Get all transactions from various sources
    const transactions = await this.getAllTransactions(asOfDate);

    // Process each transaction to update debit/credit amounts
    transactions.forEach(transaction => {
      const entry = trialBalanceEntries.find(e => e.accountId === transaction.accountId);
      if (!entry) return;

      if (transaction.type === 'expense' || transaction.type === 'purchase' || 
          transaction.type === 'debit' || transaction.type === 'payment') {
        entry.debit += transaction.amount;
      } else if (transaction.type === 'income' || transaction.type === 'sale' || 
                 transaction.type === 'credit' || transaction.type === 'receipt') {
        entry.credit += transaction.amount;
      } else if (transaction.type === 'transfer_out') {
        entry.debit += transaction.amount;
      } else if (transaction.type === 'transfer_in') {
        entry.credit += transaction.amount;
      }
    });

    // Filter out accounts with zero balances
    const nonZeroEntries = trialBalanceEntries.filter(
      entry => Math.abs(entry.debit - entry.credit) > 0.01
    );

    // Calculate totals
    const totalDebit = nonZeroEntries.reduce((sum, entry) => sum + entry.debit, 0);
    const totalCredit = nonZeroEntries.reduce((sum, entry) => sum + entry.credit, 0);

    return {
      entries: nonZeroEntries,
      totalDebit,
      totalCredit,
      isBalanced: Math.abs(totalDebit - totalCredit) < 0.01
    };
  }

  private async getAllTransactions(asOfDate: Date): Promise<any[]> {
    // Get transactions from all sources
    const accountTransactions = await this.getAccountTransactions(asOfDate);
    const expenses = await this.getExpenses(asOfDate);
    const purchases = await this.getPurchases(asOfDate);
    const sales = await this.getSales(asOfDate);
    // const incomes = await this.getIncomes(asOfDate);

    return [
      ...accountTransactions,
      ...expenses,
      ...purchases,
      ...sales
    ];
  }

  private async getAccountTransactions(asOfDate: Date): Promise<any[]> {
    const transactionsRef = collection(this.firestore, 'transactions');
    const q = query(transactionsRef, where('date', '<=', asOfDate));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      date: doc.data()['date']?.toDate(),
      accountId: doc.data()['accountId'],
      amount: doc.data()['amount'] || doc.data()['debit'] || doc.data()['credit'] || 0,
      type: doc.data()['type']
    }));
  }

  private async getExpenses(asOfDate: Date): Promise<any[]> {
    try {
      const expenses = await this.expenseService.getExpensesByDateRange(new Date(0), asOfDate);
      return expenses.map((expense: any) => ({
        accountId: expense.paymentAccount?.id || expense.paymentAccount,
        amount: expense.paymentAmount || expense.totalAmount || 0,
        type: 'expense',
        date: expense.paidOn || expense.date
      }));
    } catch (error) {
      console.error('Error getting expenses:', error);
      return [];
    }
  }

  // private async getIncomes(asOfDate: Date): Promise<any[]> {
  //   try {
  //     const incomes = await this.incomeService.getIncomesByDateRange(new Date(0), asOfDate);
  //     return incomes.map((income: any) => ({
  //       accountId: income.paymentAccount?.id || income.paymentAccount,
  //       amount: income.paymentAmount || income.totalAmount || 0,
  //       type: 'income',
  //       date: income.paidOn || income.date
  //     }));
  //   } catch (error) {
  //     console.error('Error getting incomes:', error);
  //     return [];
  //   }
  // }

  private async getPurchases(asOfDate: Date): Promise<any[]> {
    try {
      const purchases = await this.purchaseService.getPurchasesByDateRange(new Date(0), asOfDate);
      return purchases.map((purchase: any) => ({
        accountId: purchase.paymentAccount?.id || purchase.paymentAccount,
        amount: purchase.paymentAmount || purchase.grandTotal || 0,
        type: 'purchase',
        date: purchase.purchaseDate
      }));
    } catch (error) {
      console.error('Error getting purchases:', error);
      return [];
    }
  }

  private async getSales(asOfDate: Date): Promise<any[]> {
    try {
      const sales = await this.saleService['getSalesByDateRange'](new Date(0), asOfDate);
      return sales.map((sale: any) => ({
        accountId: sale.paymentAccount?.id || sale.paymentAccount,
        amount: sale.paymentAmount || sale.totalAmount || 0,
        type: 'sale',
        date: sale.saleDate
      }));
    } catch (error) {
      console.error('Error getting sales:', error);
      return [];
    }
  }
}