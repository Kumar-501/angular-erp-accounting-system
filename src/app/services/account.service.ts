import { Injectable } from '@angular/core';
import { 
  Firestore, 
  collection, 
  doc, 
  getDoc, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  DocumentSnapshot,
  DocumentData,
  getDocs,
  or,
  writeBatch,
  increment,
  Timestamp,
  runTransaction,
  orderBy,
  limit
} from '@angular/fire/firestore';

import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';

// Type Interfaces
interface AccountData {
  name: string;
  accountNumber: string;
  balance: number;
  accountHead: string;
}

interface BalanceSheetData {
  equity: AccountData[];
  liabilities: AccountData[];
  assets: AccountData[];
  totals: {
    equity: number;
    liabilities: number;
    assets: number;
  };
}

interface DetailedBalanceSheetData {
  equity: {
    capital: AccountData[];
    reserves: AccountData[];
    profitLoss: AccountData[];
    total: number;
  };
  liabilities: {
    current: AccountData[];
    longTerm: AccountData[];
    provisions: AccountData[];
    total: number;
  };
  assets: {
    fixed: AccountData[];
    current: AccountData[];
    investments: AccountData[];
    loansAdvances: AccountData[];
    total: number;
  };
}

interface TransactionData {
  amount: number;
  type: 'income' | 'expense' | 'transfer' | 'deposit';
  date: Date;
  reference: string;
  relatedDocId: string;
  description: string;
  category?: string;
  paymentMethod?: string;
}

interface IncomeSummary {
  [key: string]: {
    total: number;
    count: number;
    accounts: Array<{
      id: string;
      name: string;
      balance: number;
    }>;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AccountService {
  constructor(private firestore: Firestore) {}

  // Income Type Constants
  private readonly INCOME_TYPES = {
    DIRECT: 'Direct Income',
    INDIRECT: 'Indirect Income'
  };

  private accountBalances: { [key: string]: number } = {};
  private readonly ACCOUNT_BOOK_COLLECTION = 'accountBookTransactions';
  private accountTransactions: { [accountId: string]: any[] } = {};
  private debitCreditTotals: { [accountId: string]: { debit: number, credit: number } } = {};

  // Enhanced date conversion method
  private convertTimestampToDate(timestamp: any): Date {
    if (!timestamp) return new Date();
    
    // If it's already a Date object
    if (timestamp instanceof Date) return timestamp;
    
    // If it's a Firestore Timestamp
    if (timestamp && typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }
    
    // If it's a string or number, try to parse
    if (typeof timestamp === 'string' || typeof timestamp === 'number') {
      const date = new Date(timestamp);
      return isNaN(date.getTime()) ? new Date() : date;
    }
    
    // If it's an object with seconds (Firestore Timestamp format)
    if (timestamp && typeof timestamp === 'object' && timestamp.seconds) {
      return new Date(timestamp.seconds * 1000);
    }
    
    // Fallback to current date
    return new Date();
  }

  async recordTransaction(accountId: string, transactionData: any): Promise<void> {
    try {
      const transactionsRef = collection(this.firestore, 'transactions');
      await addDoc(transactionsRef, {
        ...transactionData,
        accountId,
        createdAt: new Date()
      });
    } catch (error) {
      console.error('Error recording transaction:', error);
      throw error;
    }
  }

  async updateAccountBalance(accountId: string, amount: number): Promise<void> {
    try {
      const accountRef = doc(this.firestore, 'accounts', accountId);
      await runTransaction(this.firestore, async (transaction) => {
        const accountDoc = await transaction.get(accountRef);
        if (!accountDoc.exists()) {
          throw new Error('Account not found');
        }
        
        const currentBalance = accountDoc.data()['openingBalance'] || 0;
        const newBalance = currentBalance + amount;
        
        transaction.update(accountRef, {
          openingBalance: newBalance,
          updatedAt: new Date()
        });
      });
    } catch (error) {
      console.error('Error updating account balance:', error);
      throw error;
    }
  }

  getIncomeTypes(): string[] {
    return Object.values(this.INCOME_TYPES);
  }

  // Get accounts by income type
  getAccountsByIncomeType(incomeType: string, callback: (accounts: any[]) => void): void {
    const accountsRef = collection(this.firestore, 'accounts');
    const q = query(accountsRef, where('incomeType', '==', incomeType));
    
    onSnapshot(q, (snapshot) => {
      const accounts = snapshot.docs.map(doc => {
        return { id: doc.id, ...doc.data() };
      });
      callback(accounts);
    });
  }

  async addAccountBookTransaction(transactionData: {
    accountId: string;
    accountName: string;
    date: Date;
    description: string;
    debit: number;
    credit: number;
    paymentMethod?: string;
    note?: string;
    reference?: string;
  }): Promise<string> {
    try {
      const transactionsRef = collection(this.firestore, this.ACCOUNT_BOOK_COLLECTION);
      const docRef = await addDoc(transactionsRef, {
        accountId: transactionData.accountId,
        accountName: transactionData.accountName,
        date: Timestamp.fromDate(transactionData.date),
        description: transactionData.description,
        debit: Number(transactionData.debit),
        credit: Number(transactionData.credit),
        paymentMethod: transactionData.paymentMethod || '',
        note: transactionData.note || '',
        reference: transactionData.reference || '',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      // Update account balance
      const amount = transactionData.credit - transactionData.debit;
      await this.updateAccountBalance(transactionData.accountId, amount);

      return docRef.id;
    } catch (error) {
      console.error('Error adding account book transaction:', error);
      throw error;
    }
  }

  getAccountBookTransactions(accountId: string, callback: (transactions: any[]) => void): () => void {
    const transactionsRef = collection(this.firestore, this.ACCOUNT_BOOK_COLLECTION);
    const q = query(transactionsRef, where('accountId', '==', accountId));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const transactions = snapshot.docs.map(doc => ({
        id: doc.id,
        accountId: doc.data()['accountId'],
        accountName: doc.data()['accountName'],
        date: this.convertTimestampToDate(doc.data()['date']),
        description: doc.data()['description'],
        debit: Number(doc.data()['debit']) || 0,
        credit: Number(doc.data()['credit']) || 0,
        paymentMethod: doc.data()['paymentMethod'],
        note: doc.data()['note'],
        reference: doc.data()['reference'],
        createdAt: this.convertTimestampToDate(doc.data()['createdAt']),
        updatedAt: this.convertTimestampToDate(doc.data()['updatedAt'])
      }));
      callback(transactions);
    });
    
    return unsubscribe;
  }

  // Get a single account by ID (enhanced to return proper Observable)
  getAccountById(id: string): Observable<any> {
    const accountDocRef = doc(this.firestore, 'accounts', id);
    
    return from(getDoc(accountDocRef)).pipe(
      map((docSnap: DocumentSnapshot<DocumentData>) => {
        if (docSnap.exists()) {
          return { id: docSnap.id, ...docSnap.data() };
        } else {
          console.error('Account not found');
          return null;
        }
      })
    );
  }

  setAccountTransactions(accountId: string, transactions: any[]): void {
    this.accountTransactions[accountId] = transactions;
    
    // Calculate debit/credit totals
    const totals = { debit: 0, credit: 0 };
    transactions.forEach(tx => {
      totals.debit += Number(tx.debit) || 0;
      totals.credit += Number(tx.credit) || 0;
    });
    
    this.debitCreditTotals[accountId] = totals;
  }

  // Add these methods to get the data
  getAccountTransactions(accountId: string): any[] {
    return this.accountTransactions[accountId] || [];
  }

  getAccountDebitCreditTotals(accountId: string): { debit: number, credit: number } {
    return this.debitCreditTotals[accountId] || { debit: 0, credit: 0 };
  }

  addAccount(accountData: any): Promise<any> {
    // Process account head if it exists
    if (accountData.accountHead) {
      accountData.accountHead = {
        group: accountData.accountHead.group,
        value: accountData.accountHead.value
      };
    }
    
    // Set default values for optional fields
    if (!accountData.accountSubType) accountData.accountSubType = '';
    if (!accountData.incomeType) accountData.incomeType = '';
    if (!accountData.note) accountData.note = '';
    
    const accountsRef = collection(this.firestore, 'accounts');
    return addDoc(accountsRef, accountData)
      .then(docRef => {
        console.log('Document written with ID: ', docRef.id);
        return docRef;
      })
      .catch(error => {
        console.error('Error adding document: ', error);
        throw error;
      });
  }

  // Get transactions for a specific account with realtime updates
  getTransactionsForAccount(accountId: string, callback: (transactions: any[]) => void): void {
    const transactionsRef = collection(this.firestore, 'transactions');
    const q = query(transactionsRef, where('accountId', '==', accountId));
    
    onSnapshot(q, (snapshot) => {
      const transactions = snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
          id: doc.id, 
          ...data,
          date: this.convertTimestampToDate(data['date'])
        };
      });
      callback(transactions);
    });
  }

  // Get fund transfers for a specific account (both incoming and outgoing)
  getFundTransfersForAccount(accountId: string, callback: (transfers: any[]) => void): void {
    const transfersRef = collection(this.firestore, 'fundTransfers');
    const q = query(transfersRef, 
      or(
        where('fromAccountId', '==', accountId),
        where('toAccountId', '==', accountId)
      )
    );
    
    onSnapshot(q, (snapshot) => {
      const transfers = snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
          id: doc.id, 
          ...data,
          date: this.convertTimestampToDate(data['date'])
        };
      });
      callback(transfers);
    });
  }

  // NEW METHOD: Get transaction by reference ID
  getTransactionByReferenceId(referenceId: string, callback: (transaction: any | null) => void): void {
    const transactionsRef = collection(this.firestore, 'transactions');
    const q = query(transactionsRef, where('referenceId', '==', referenceId));
    
    onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        callback(null);
      } else {
        const doc = snapshot.docs[0];
        callback({ id: doc.id, ...doc.data() });
      }
    });
  }

  // Enhanced getAllAccountTransactions with proper timestamp handling
  getAllAccountTransactions(accountId: string, callback: (transactions: any[]) => void): () => void {
    const transactionsRef = collection(this.firestore, 'transactions');
    const q = query(transactionsRef, where('accountId', '==', accountId));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const transactions = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          date: this.convertTimestampToDate(data['date']),
          createdAt: this.convertTimestampToDate(data['createdAt']),
          updatedAt: this.convertTimestampToDate(data['updatedAt'])
        };
      });
      callback(transactions);
    });
    
    return unsubscribe;
  }

  // Listen to transactions with filters (maintained for backward compatibility)
  listenToTransactions(
    callback: (transactions: any[]) => void, 
    fromDate?: string,
    toDate?: string,
    transactionType?: string
  ): void {
    const transactionsRef = collection(this.firestore, 'transactions');
    let q = query(transactionsRef);
    
    if (fromDate && toDate) {
      q = query(transactionsRef, 
        where('date', '>=', fromDate),
        where('date', '<=', toDate)
      );
    }
    
    if (transactionType) {
      q = query(q, where('type', '==', transactionType));
    }
    
    onSnapshot(q, (snapshot) => {
      const transactions = snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
          id: doc.id, 
          ...data,
          date: this.convertTimestampToDate(data['date'])
        };
      });
      callback(transactions);
    });
  }

  // Get fund transfers with optional date filtering (maintained for backward compatibility)
  getFundTransfers(
    callback: (transfers: any[]) => void,
    fromDate?: string,
    toDate?: string
  ): void {
    const transfersRef = collection(this.firestore, 'fundTransfers');
    let q = query(transfersRef);
    
    if (fromDate && toDate) {
      q = query(transfersRef, 
        where('date', '>=', fromDate),
        where('date', '<=', toDate)
      );
    }
    
    onSnapshot(q, (snapshot) => {
      const transfers = snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
          id: doc.id, 
          ...data,
          date: this.convertTimestampToDate(data['date'])
        };
      });
      callback(transfers);
    });
  }

  // Get deposits with optional date filtering (maintained for backward compatibility)
  getDeposits(
    callback: (deposits: any[]) => void,
    fromDate?: string,
    toDate?: string
  ): void {
    const depositsRef = collection(this.firestore, 'deposits');
    let q = query(depositsRef);
    
    if (fromDate && toDate) {
      q = query(depositsRef, 
        where('date', '>=', fromDate),
        where('date', '<=', toDate)
      );
    }
    
    onSnapshot(q, (snapshot) => {
      const deposits = snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
          id: doc.id, 
          ...data,
          date: this.convertTimestampToDate(data['date'])
        };
      });
      callback(deposits);
    });
  }

  async updateAccountBookTransaction(transactionId: string, updateData: {
    date?: Date;
    description?: string;
    debit?: number;
    credit?: number;
    paymentMethod?: string;
    note?: string;
  }): Promise<void> {
    try {
      const transactionRef = doc(this.firestore, this.ACCOUNT_BOOK_COLLECTION, transactionId);
      
      const updateObject: any = {
        updatedAt: Timestamp.now()
      };
      
      if (updateData.date) updateObject.date = Timestamp.fromDate(updateData.date);
      if (updateData.description) updateObject.description = updateData.description;
      if (updateData.debit !== undefined) updateObject.debit = Number(updateData.debit);
      if (updateData.credit !== undefined) updateObject.credit = Number(updateData.credit);
      if (updateData.paymentMethod) updateObject.paymentMethod = updateData.paymentMethod;
      if (updateData.note) updateObject.note = updateData.note;
      
      await updateDoc(transactionRef, updateObject);
    } catch (error) {
      console.error('Error updating account book transaction:', error);
      throw error;
    }
  }

  async deleteAccountBookTransaction(transactionId: string, accountId: string): Promise<void> {
    try {
      // First get the transaction to determine the amount to adjust
      const transactionRef = doc(this.firestore, this.ACCOUNT_BOOK_COLLECTION, transactionId);
      const transactionSnap = await getDoc(transactionRef);
      
      if (!transactionSnap.exists()) {
        throw new Error('Transaction not found');
      }
      
      const transactionData = transactionSnap.data();
      const amount = (transactionData['credit'] || 0) - (transactionData['debit'] || 0);
      
      // Create a batch to delete the transaction and update the account balance
      const batch = writeBatch(this.firestore);
      
      // Delete the transaction
      batch.delete(transactionRef);
      
      // Update the account balance (reverse the transaction effect)
      const accountRef = doc(this.firestore, 'accounts', accountId);
      batch.update(accountRef, {
        openingBalance: increment(-amount),
        updatedAt: Timestamp.now()
      });
      
      await batch.commit();
    } catch (error) {
      console.error('Error deleting account book transaction:', error);
      throw error;
    }
  }

  updateAccount(id: string, accountData: any): Promise<void> {
    // Process account head if it exists
    if (accountData.accountHead && typeof accountData.accountHead === 'string') {
      const [group, value] = accountData.accountHead.split('|');
      accountData.accountHead = {
        group: group,
        value: value
      };
    }
    
    const accountDocRef = doc(this.firestore, 'accounts', id);
    return updateDoc(accountDocRef, accountData);
  }

  // Delete an account
  deleteAccount(id: string): Promise<void> {
    const accountDocRef = doc(this.firestore, 'accounts', id);
    return deleteDoc(accountDocRef);
  }

  // Delete a transaction
  deleteTransaction(id: string): Promise<void> {
    const transactionDocRef = doc(this.firestore, 'transactions', id);
    return deleteDoc(transactionDocRef);
  }
  
  // Delete a fund transfer
  deleteFundTransfer(id: string): Promise<void> {
    const fundTransferDocRef = doc(this.firestore, 'fundTransfers', id);
    return deleteDoc(fundTransferDocRef);
  }

  // Enhanced getDetailedBalanceSheet with proper timestamp handling
  async getDetailedBalanceSheet(asOfDate: Date): Promise<DetailedBalanceSheetData> {
    return new Promise((resolve, reject) => {
      this.getAccounts((accounts: any[]) => {
        const balanceSheetData: DetailedBalanceSheetData = {
          equity: {
            capital: [] as AccountData[],
            reserves: [] as AccountData[],
            profitLoss: [] as AccountData[],
            total: 0
          },
          liabilities: {
            current: [] as AccountData[],
            longTerm: [] as AccountData[],
            provisions: [] as AccountData[],
            total: 0
          },
          assets: {
            fixed: [] as AccountData[],
            current: [] as AccountData[],
            investments: [] as AccountData[],
            loansAdvances: [] as AccountData[],
            total: 0
          }
        };

        // First get all transactions up to asOfDate
        this.getAllTransactionsUpToDate(asOfDate, (transactions) => {
          // Create a map of account balances
          const accountBalances = new Map<string, number>();
          
          // Initialize with opening balances
          accounts.forEach((account: { id: string; openingBalance: any; }) => {
            accountBalances.set(account.id, account.openingBalance || 0);
          });

          // Apply all transactions to update balances
          transactions.forEach(transaction => {
            if (accountBalances.has(transaction.accountId)) {
              const currentBalance = accountBalances.get(transaction.accountId)!;
              if (transaction.type === 'income' || transaction.type === 'transfer_in') {
                accountBalances.set(transaction.accountId, currentBalance + (transaction.amount || 0));
              } else if (transaction.type === 'expense' || transaction.type === 'transfer_out') {
                accountBalances.set(transaction.accountId, currentBalance - (transaction.amount || 0));
              }
            }
          });

          // Now categorize accounts with updated balances
          accounts.forEach((account: { accountHead: { value: any; }; name: any; id: string; accountNumber: any; }) => {
            if (!account.accountHead) {
              console.warn('Account without accountHead:', account.name);
              return;
            }

            const accountHead = account.accountHead.value || account.accountHead;
            const balance = accountBalances.get(account.id) || 0;

            const accountData: AccountData = {
              name: account.name,
              accountNumber: account.accountNumber,
              balance: balance,
              accountHead: accountHead
            };

            // Equity categorization
            if (accountHead.includes('Capital')) {
              balanceSheetData.equity.capital.push(accountData);
              balanceSheetData.equity.total += balance;
            } 
            else if (accountHead.includes('Reserve')) {
              balanceSheetData.equity.reserves.push(accountData);
              balanceSheetData.equity.total += balance;
            }
            else if (accountHead.includes('Profit') || accountHead.includes('Loss')) {
              balanceSheetData.equity.profitLoss.push(accountData);
              balanceSheetData.equity.total += balance;
            }
            // Liabilities categorization
            else if (accountHead.includes('Current Liability')) {
              balanceSheetData.liabilities.current.push(accountData);
              balanceSheetData.liabilities.total += balance;
            }
            else if (accountHead.includes('Long Term Liability')) {
              balanceSheetData.liabilities.longTerm.push(accountData);
              balanceSheetData.liabilities.total += balance;
            }
            else if (accountHead.includes('Provision')) {
              balanceSheetData.liabilities.provisions.push(accountData);
              balanceSheetData.liabilities.total += balance;
            }
            // Assets categorization
            else if (accountHead.includes('Fixed Asset')) {
              balanceSheetData.assets.fixed.push(accountData);
              balanceSheetData.assets.total += balance;
            }
            else if (accountHead.includes('Current Asset')) {
              balanceSheetData.assets.current.push(accountData);
              balanceSheetData.assets.total += balance;
            }
            else if (accountHead.includes('Investment')) {
              balanceSheetData.assets.investments.push(accountData);
              balanceSheetData.assets.total += balance;
            }
            else if (accountHead.includes('Loan') || accountHead.includes('Advance')) {
              balanceSheetData.assets.loansAdvances.push(accountData);
              balanceSheetData.assets.total += balance;
            }
          });

          resolve(balanceSheetData);
        });
      });
    });
  }

  // Enhanced addTransaction with proper timestamp handling
  async addTransaction(accountId: string, transactionData: any): Promise<void> {
    try {
      const transactionsRef = collection(this.firestore, 'transactions');
      const transaction = {
        accountId,
        amount: transactionData.amount,
        type: transactionData.type,
        date: Timestamp.fromDate(new Date(transactionData.date)),
        description: transactionData.description,
        debit: transactionData.type === 'expense' || transactionData.type === 'transfer_out' ? transactionData.amount : 0,
        credit: transactionData.type === 'income' || transactionData.type === 'transfer_in' || transactionData.type === 'sale' ? transactionData.amount : 0,
        paymentMethod: transactionData.paymentMethod || '',
        note: transactionData.note || '',
        reference: transactionData.reference || '',
        relatedDocId: transactionData.relatedDocId || '',
        source: transactionData.source || '',
        saleId: transactionData.saleId || '',
        invoiceNo: transactionData.invoiceNo || '',
        customer: transactionData.customer || '',
        paymentStatus: transactionData.paymentStatus || '',
        createdAt: Timestamp.now()
      };

      await addDoc(transactionsRef, transaction);
      
      // Update account balance
      const amount = transactionData.type === 'income' || transactionData.type === 'transfer_in' || transactionData.type === 'sale' 
        ? transactionData.amount 
        : -transactionData.amount;
        
      await this.updateAccountBalance(accountId, amount);
    } catch (error) {
      console.error('Error adding transaction:', error);
      throw error;
    }
  }

  async updateAccountBalancesFromTransactions(): Promise<void> {
    const accounts = await this.getAccountsOnce();
    const transactions = await this.getAllTransactionsOnce();

    const batch = writeBatch(this.firestore);
    
    // Calculate new balances
    accounts.forEach(account => {
      const accountTransactions = transactions.filter(t => t.accountId === account.id);
      let newBalance = account.openingBalance || 0;
      
      accountTransactions.forEach(t => {
        if (t.type === 'income' || t.type === 'transfer_in' || t.type === 'deposit') {
          newBalance += t.amount || t.credit || 0;
        } else if (t.type === 'expense' || t.type === 'transfer_out') {
          newBalance -= t.amount || t.debit || 0;
        }
      });
      
      // Only update if different
      if (newBalance !== (account.openingBalance || 0)) {
        const accountRef = doc(this.firestore, 'accounts', account.id);
        batch.update(accountRef, { openingBalance: newBalance });
      }
    });
    
    await batch.commit();
  }

  private getAccountsOnce(): Promise<any[]> {
    return new Promise((resolve) => {
      const unsub = this.getAccounts((accounts) => {
        unsub(); // Unsubscribe immediately
        resolve(accounts);
      });
    });
  }

  private getAllTransactionsOnce(): Promise<any[]> {
    return new Promise((resolve) => {
      const unsub = this.getAllTransactions((transactions) => {
        unsub(); // Unsubscribe immediately
        resolve(transactions);
      });
    });
  }

  async reconcileAccountBalances(): Promise<{accountId: string, expected: number, actual: number}[]> {
    const accounts = await this.getAccountsOnce();
    const transactions = await this.getAllTransactionsOnce();
    
    const discrepancies = [];
    
    for (const account of accounts) {
      const accountTransactions = transactions.filter(t => t.accountId === account.id);
      let calculatedBalance = account.openingBalance || 0;
      
      accountTransactions.forEach(t => {
        if (t.type === 'income' || t.type === 'transfer_in' || t.type === 'deposit') {
          calculatedBalance += t.amount || t.credit || 0;
        } else if (t.type === 'expense' || t.type === 'transfer_out') {
          calculatedBalance -= t.amount || t.debit || 0;
        }
      });
      
      if (calculatedBalance !== (account.openingBalance || 0)) {
        discrepancies.push({
          accountId: account.id,
          accountName: account.name,
          expected: calculatedBalance,
          actual: account.openingBalance || 0
        });
      }
    }
    
    return discrepancies;
  }

  // Update a transaction
  updateTransaction(transaction: any): Promise<void> {
    const transactionDocRef = doc(this.firestore, 'transactions', transaction.id);
    
    // Create a copy of the transaction without the id field (Firestore doesn't need it in the update)
    const { id, balance, ...transactionData } = transaction;
    
    return updateDoc(transactionDocRef, {
      date: transaction.date,
      description: transaction.description,
      paymentMethod: transaction.paymentMethod,
      paymentDetails: transaction.paymentDetails,
      note: transaction.note,
      debit: transaction.debit,
      credit: transaction.credit
      // Don't update fields like balance, attachmentUrl, type, etc. that shouldn't change
    });
  }
  
  // Update a fund transfer
  updateFundTransfer(transfer: any): Promise<void> {
    const transferDocRef = doc(this.firestore, 'fundTransfers', transfer.id);
    
    // For fund transfers, we need different fields
    return updateDoc(transferDocRef, {
      date: transfer.date,
      note: transfer.note || '',
      // For transfers, the amount is stored as debit/credit depending on direction
      amount: transfer.type === 'transfer_out' ? Number(transfer.debit) : Number(transfer.credit)
      // We don't update fromAccountId, toAccountId as these shouldn't change
    });
  }

  async addFundTransfer(transferData: any): Promise<any> {
    try {
      // First update the account balances
      const fromAccountRef = doc(this.firestore, 'accounts', transferData.fromAccountId);
      const toAccountRef = doc(this.firestore, 'accounts', transferData.toAccountId);
      
      const [fromAccountSnap, toAccountSnap] = await Promise.all([
        getDoc(fromAccountRef),
        getDoc(toAccountRef)
      ]);
      
      if (!fromAccountSnap.exists() || !toAccountSnap.exists()) {
        throw new Error('One or both accounts not found');
      }
      
      const fromAccount = fromAccountSnap.data();
      const toAccount = toAccountSnap.data();
      
      const newFromBalance = (fromAccount['openingBalance'] || 0) - transferData.amount;
      const newToBalance = (toAccount['openingBalance'] || 0) + transferData.amount;
      
      // Create a batch to update both accounts and create the transfer record
      const batch = writeBatch(this.firestore);
      
      // Update from account
      batch.update(fromAccountRef, {
        openingBalance: newFromBalance
      });
      
      // Update to account
      batch.update(toAccountRef, {
        openingBalance: newToBalance
      });
      
      // Create transfer record
      const transfersRef = collection(this.firestore, 'fundTransfers');
      const transferDocRef = doc(transfersRef);
      batch.set(transferDocRef, {
        ...transferData,
        timestamp: new Date()
      });
      
      // Create transaction records
      const transactionsRef = collection(this.firestore, 'transactions');
      
      // Outgoing transaction
      batch.set(doc(transactionsRef), {
        accountId: transferData.fromAccountId,
        amount: transferData.amount,
        type: 'transfer_out',
        date: transferData.date,
        description: `Transfer to ${transferData.toAccountName}`,
        paymentMethod: 'Fund Transfer',
        previousBalance: fromAccount['openingBalance'] || 0,
        newBalance: newFromBalance,
        reference: `TRF-${transferDocRef.id}`,
        relatedDocId: transferDocRef.id
      });
      
      // Incoming transaction
      batch.set(doc(transactionsRef), {
        accountId: transferData.toAccountId,
        amount: transferData.amount,
        type: 'transfer_in',
        date: transferData.date,
        description: `Transfer from ${transferData.fromAccountName}`,
        paymentMethod: 'Fund Transfer',
        previousBalance: toAccount['openingBalance'] || 0,
        newBalance: newToBalance,
        reference: `TRF-${transferDocRef.id}`,
        relatedDocId: transferDocRef.id
      });
      
      await batch.commit();
      return transferDocRef.id;
    } catch (error) {
      console.error('Error processing fund transfer:', error);
      throw error;
    }
  }

  // Get account name by ID (useful for displaying account names in transfers)
  async getAccountNameById(accountId: string): Promise<string> {
    const accountDocRef = doc(this.firestore, 'accounts', accountId);
    const docSnap = await getDoc(accountDocRef);
    
    if (docSnap.exists()) {
      return docSnap.data()['name'] || 'Unknown Account';
    }
    return 'Unknown Account';
  }

  async addDeposit(depositData: any): Promise<any> {
    try {
      const accountRef = doc(this.firestore, 'accounts', depositData.accountId);
      const accountSnap = await getDoc(accountRef);
      
      if (!accountSnap.exists()) {
        throw new Error('Account not found');
      }
      
      const account = accountSnap.data();
      const newBalance = (account['openingBalance'] || 0) + depositData.amount;
      
      // Create a batch to update account and create deposit record
      const batch = writeBatch(this.firestore);
      
      // Update account balance
      batch.update(accountRef, {
        openingBalance: newBalance
      });
      
      // Create deposit record
      const depositsRef = collection(this.firestore, 'deposits');
      const depositDocRef = doc(depositsRef);
      batch.set(depositDocRef, {
        ...depositData,
        timestamp: new Date()
      });
      
      // Create transaction record
      const transactionsRef = collection(this.firestore, 'transactions');
      batch.set(doc(transactionsRef), {
        accountId: depositData.accountId,
        amount: depositData.amount,
        type: 'deposit',
        date: depositData.date,
        description: `Deposit from ${depositData.depositFromName}`,
        paymentMethod: 'Deposit',
        previousBalance: account['openingBalance'] || 0,
        newBalance: newBalance,
        reference: `DEP-${depositDocRef.id}`,
        relatedDocId: depositDocRef.id
      });
      
      await batch.commit();
      return depositDocRef.id;
    } catch (error) {
      console.error('Error processing deposit:', error);
      throw error;
    }
  }

  // Get deposits for a specific account with realtime updates
  getDepositsForAccount(accountId: string, callback: (deposits: any[]) => void): void {
    const depositsRef = collection(this.firestore, 'deposits');
    const q = query(depositsRef, where('accountId', '==', accountId));
    
    onSnapshot(q, (snapshot) => {
      const deposits = snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
          id: doc.id, 
          ...data,
          date: this.convertTimestampToDate(data['date'])
        };
      });
      callback(deposits);
    });
  }

  // Get transactions by income type
  getTransactionsByIncomeType(incomeType: string, callback: (transactions: any[]) => void): void {
    // First get accounts with this income type
    this.getAccountsByIncomeType(incomeType, (accounts) => {
      const accountIds = accounts.map(a => a.id);
      
      if (accountIds.length === 0) {
        callback([]);
        return;
      }
      
      // Then get transactions for these accounts
      const transactionsRef = collection(this.firestore, 'transactions');
      const q = query(transactionsRef, where('accountId', 'in', accountIds));
      
      onSnapshot(q, (snapshot) => {
        const transactions = snapshot.docs.map(doc => {
          const data = doc.data();
          return { 
            id: doc.id, 
            ...data,
            date: this.convertTimestampToDate(data['date'])
          };
        });
        callback(transactions);
      });
    });
  }

  async getBalanceSheetData(asOfDate: Date): Promise<BalanceSheetData> {
    return new Promise((resolve, reject) => {
      this.getAccounts((accounts: any[]) => {
        const balanceSheetData: BalanceSheetData = {
          equity: [],
          liabilities: [],
          assets: [],
          totals: {
            equity: 0,
            liabilities: 0,
            assets: 0
          }
        };

        // First get all transactions up to asOfDate
        this.getAllTransactionsUpToDate(asOfDate, (transactions) => {
          // Create a map of account balances
          const accountBalances = new Map<string, number>();
          
          // Initialize with opening balances
          accounts.forEach((account: { id: string; openingBalance: any; }) => {
            accountBalances.set(account.id, account.openingBalance || 0);
          });

          // Apply all transactions to update balances
          transactions.forEach(transaction => {
            if (accountBalances.has(transaction.accountId)) {
              const currentBalance = accountBalances.get(transaction.accountId)!;
              if (transaction.type === 'income' || transaction.type === 'transfer_in') {
                accountBalances.set(transaction.accountId, currentBalance + (transaction.amount || 0));
              } else if (transaction.type === 'expense' || transaction.type === 'transfer_out') {
                accountBalances.set(transaction.accountId, currentBalance - (transaction.amount || 0));
              }
            }
          });

          // Now categorize accounts with updated balances
          accounts.forEach((account: { accountHead: { value: any; }; name: any; id: string; accountNumber: any; }) => {
            if (!account.accountHead) {
              console.warn('Account without accountHead:', account.name);
              return;
            }

            const accountHead = account.accountHead.value || account.accountHead;
            const balance = accountBalances.get(account.id) || 0;

            const accountData: AccountData = {
              name: account.name,
              accountNumber: account.accountNumber,
              balance: balance,
              accountHead: accountHead
            };

            const lowerHead = accountHead.toLowerCase();
            
            if (lowerHead.includes('equity') || lowerHead.includes('capital')) {
              balanceSheetData.equity.push(accountData);
              balanceSheetData.totals.equity += balance;
            } 
            else if (lowerHead.includes('liability') || lowerHead.includes('payable')) {
              balanceSheetData.liabilities.push(accountData);
              balanceSheetData.totals.liabilities += balance;
            } 
            else if (lowerHead.includes('asset')) {
              balanceSheetData.assets.push(accountData);
              balanceSheetData.totals.assets += balance;
            }
          });

          resolve(balanceSheetData);
        });
      });
    });
  }

  // Enhanced getAllTransactions with proper timestamp handling
  getAllTransactions(callback: (transactions: any[]) => void): () => void {
    const transactionsRef = collection(this.firestore, 'transactions');
    const unsubscribe = onSnapshot(transactionsRef, (snapshot) => {
      const transactions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: this.convertTimestampToDate(doc.data()['date']),
        createdAt: this.convertTimestampToDate(doc.data()['createdAt']),
        updatedAt: this.convertTimestampToDate(doc.data()['updatedAt'])
      }));
      callback(transactions);
    });
    return unsubscribe;
  }

  private getAllTransactionsUpToDate(asOfDate: Date, callback: (transactions: any[]) => void): void {
    const transactionsRef = collection(this.firestore, 'transactions');
    const q = query(transactionsRef, 
      where('date', '<=', asOfDate)
    );
    
    onSnapshot(q, (snapshot) => {
      const transactions = snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
          id: doc.id, 
          ...data,
          date: this.convertTimestampToDate(data['date'])
        };
      });
      callback(transactions);
    });
  }

  // Enhanced getAllAccountBookTransactions with proper timestamp handling
  getAllAccountBookTransactions(callback: (transactions: any[]) => void): () => void {
    const transactionsRef = collection(this.firestore, this.ACCOUNT_BOOK_COLLECTION);
    const unsubscribe = onSnapshot(transactionsRef, (snapshot) => {
      const transactions = snapshot.docs.map(doc => ({
        id: doc.id,
        accountId: doc.data()['accountId'],
        accountName: doc.data()['accountName'],
        date: this.convertTimestampToDate(doc.data()['date']),
        description: doc.data()['description'],
        debit: Number(doc.data()['debit']) || 0,
        credit: Number(doc.data()['credit']) || 0,
        paymentMethod: doc.data()['paymentMethod'],
        note: doc.data()['note'],
        reference: doc.data()['reference'],
        createdAt: this.convertTimestampToDate(doc.data()['createdAt']),
        updatedAt: this.convertTimestampToDate(doc.data()['updatedAt'])
      }));
      callback(transactions);
    });
    
    return unsubscribe;
  }

  // Enhanced getAccounts with proper timestamp handling
  getAccounts(callback: (accounts: any[]) => void): () => void {
    const accountsRef = collection(this.firestore, 'accounts');
    const unsubscribe = onSnapshot(accountsRef, (snapshot) => {
      const accounts = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data()['name'] || 'Unnamed Account',
        accountNumber: doc.data()['accountNumber'] || '',
        accountType: doc.data()['accountType'] || '',
        openingBalance: Number(doc.data()['openingBalance']) || 0,
        accountHead: doc.data()['accountHead'] || {},
        createdAt: this.convertTimestampToDate(doc.data()['createdAt']),
        updatedAt: this.convertTimestampToDate(doc.data()['updatedAt'])
      }));
      callback(accounts);
    });
    
    return unsubscribe;
  }

  async getTransactionsByReference(accountId: string, referenceId: string): Promise<any[]> {
    const transactionsRef = collection(this.firestore, 'transactions');
    const q = query(
      transactionsRef, 
      where('accountId', '==', accountId),
      where('relatedDocId', '==', referenceId)
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data(),
      date: this.convertTimestampToDate(doc.data()['date'])
    }));
  }

  // Enhanced getRecentTransactions with proper timestamp handling
  getRecentTransactions(accountId: string, transactionLimit: number = 5): Observable<any[]> {
    return new Observable(observer => {
      const transactionsRef = collection(this.firestore, 'transactions');
      const q = query(
        transactionsRef,
        where('accountId', '==', accountId),
        orderBy('date', 'desc'),
        limit(transactionLimit)
      );
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const transactions = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            date: this.convertTimestampToDate(data['date']),
            createdAt: this.convertTimestampToDate(data['createdAt']),
            updatedAt: this.convertTimestampToDate(data['updatedAt'])
          };
        });
        observer.next(transactions);
      });
      
      return () => unsubscribe();
    });
  }

  async deleteTransactionsByReference(accountId: string, referenceId: string): Promise<void> {
    const transactions = await this.getTransactionsByReference(accountId, referenceId);
    const batch = writeBatch(this.firestore);
    
    transactions.forEach(t => {
      const transactionRef = doc(this.firestore, 'transactions', t.id);
      batch.delete(transactionRef);
    });
    
    await batch.commit();
  }

  getIncomeSummary(callback: (summary: any) => void): void {
    const incomeTypes = this.getIncomeTypes();
    let summary: any = {};
    
    // Initialize summary
    incomeTypes.forEach(type => {
      summary[type] = {
        total: 0,
        count: 0,
        accounts: []
      };
    });
    
    // Get all accounts and calculate summary
    this.getAccounts((accounts: any[]) => {
      accounts.forEach((account: { incomeType: string; openingBalance: any; id: any; name: any; }) => {
        if (account.incomeType && incomeTypes.includes(account.incomeType)) {
          summary[account.incomeType].total += account.openingBalance || 0;
          summary[account.incomeType].count++;
          summary[account.incomeType].accounts.push({
            id: account.id,
            name: account.name,
            balance: account.openingBalance || 0
          });
        }
      });
      
      callback(summary);
    });
  }
}