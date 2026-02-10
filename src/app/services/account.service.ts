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
  
  limit,
  Transaction as FirestoreTransaction,
  DocumentReference
} from '@angular/fire/firestore';

import { BehaviorSubject, Observable, from } from 'rxjs';
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
  private accountBalancesSubject = new BehaviorSubject<Map<string, number>>(new Map());
  public accountBalances$ = this.accountBalancesSubject.asObservable();
  private debitCreditTotals: { [accountId: string]: { debit: number, credit: number } } = {};
  
  // Store original opening balances (before any transactions)
  private originalOpeningBalances: { [accountId: string]: number } = {};
  
  // Store calculated current balances to ensure synchronization
  private calculatedCurrentBalances: { [key: string]: number } = {};

  // ENHANCED: Add cache management for account book refresh
  private accountBookRefreshFlags: { [accountId: string]: boolean } = {};
  private accountCacheData: { [accountId: string]: any } = {};

  // ENHANCED: Improved timestamp conversion that preserves exact time including milliseconds
  private convertTimestampToDate(timestamp: any): Date {
    if (!timestamp) return new Date();
    
    // If it's already a Date object, return as is
    if (timestamp instanceof Date) return timestamp;
    
    // Handle Firestore Timestamp with exact time preservation
    if (timestamp && typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }
    
    // Handle Firestore Timestamp object format with nanoseconds
    if (timestamp && typeof timestamp === 'object' && timestamp.seconds !== undefined) {
      const date = new Date(timestamp.seconds * 1000);
      // Add nanosecond precision
      if (timestamp.nanoseconds !== undefined) {
        date.setMilliseconds(date.getMilliseconds() + Math.floor(timestamp.nanoseconds / 1000000));
      }
      return date;
    }
    
    // Handle string dates - preserve exact time if present
    if (typeof timestamp === 'string') {
      const parsedDate = new Date(timestamp);
      return isNaN(parsedDate.getTime()) ? parsedDate : new Date();
    }
    
    // Handle numeric timestamps with millisecond precision
    if (typeof timestamp === 'number') {
      return new Date(timestamp);
    }
    
    // Fallback to current date with exact time
    return new Date();
  }

// In AccountService.ts
// In AccountService.ts
  async getAccountsWithBalanceAsOfDate(asOfDate: Date): Promise<any[]> {
    console.log(`📅 Calculating historical balances as of: ${asOfDate.toDateString()}`);
    
    // 1. Get All Accounts (Base Data)
    const accountsRef = collection(this.firestore, 'accounts');
    const accountsSnap = await getDocs(accountsRef);
    const accountsMap = new Map<string, any>();
    
    accountsSnap.forEach(doc => {
      const data = doc.data();
      accountsMap.set(doc.id, {
        id: doc.id,
        ...data,
        // Start with the original opening balance (not currentBalance)
        calculatedBalance: Number(data['openingBalance']) || 0 
      });
    });

    // 2. Get All Transactions up to the specific date
    // We query the Ledger (accountBookTransactions)
    const transactionsRef = collection(this.firestore, this.ACCOUNT_BOOK_COLLECTION);
    
    // Create a timestamp for the end of the selected day
    const endOfDay = new Date(asOfDate);
    endOfDay.setHours(23, 59, 59, 999);
    const endTimestamp = Timestamp.fromDate(endOfDay);

    const q = query(
      transactionsRef,
      where('date', '<=', endTimestamp) // Only fetch transactions up to this date
    );

    const transactionsSnap = await getDocs(q);

    // 3. Apply Transactions to Balances
    transactionsSnap.forEach(doc => {
      const tx = doc.data();
      const accountId = tx['accountId'];
      const credit = Number(tx['credit']) || 0;
      const debit = Number(tx['debit']) || 0;

      if (accountsMap.has(accountId)) {
        const account = accountsMap.get(accountId);
        
        // Apply logic: Balance increases with Credit, decreases with Debit
        // (Matches your recalculateAndSaveBalance logic)
        account.calculatedBalance += (credit - debit);
      }
    });

    // 4. Return formatted array with 'currentBalance' overwritten by history
    return Array.from(accountsMap.values()).map(acc => ({
      ...acc,
      currentBalance: acc.calculatedBalance // Override for the Balance Sheet UI
    }));
  }
// Add these methods to account.service.ts:

// 1. ENHANCED: Delete sale transaction with proper balance reversal
async deleteTransactionForSale(transaction: FirestoreTransaction, saleId: string): Promise<void> {
    if (!saleId) return;
    
    const accountBookRef = collection(this.firestore, this.ACCOUNT_BOOK_COLLECTION);
    
    const q = query(
        accountBookRef, 
        where('relatedDocId', '==', saleId),
        where('source', '==', 'sale')
    );
    
    const querySnapshot = await getDocs(q);

    querySnapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const creditAmount = Number(data['credit']) || 0;
        const accountId = data['accountId'];

        // Delete transaction
        transaction.delete(docSnap.ref);

        // ✅ Deduct the amount from the account balance immediately
        if (accountId && creditAmount > 0) {
            const accountRef = doc(this.firestore, 'accounts', accountId);
            transaction.update(accountRef, { 
                currentBalance: increment(-creditAmount),
                balanceUpdatedAt: Timestamp.now()
            });
            console.log(`✅ Reversed sale transaction for account ${accountId}: -₹${creditAmount}`);
        }
    });
}

// In account.service.ts

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
  paymentDetails?: string;
  transactionTime?: Date;
  source?: string;
  type?: string;
  relatedDocId?: string;
  supplier?: string;
  supplierId?: string;
}): Promise<string> {
  try {
    const transactionsRef = collection(this.firestore, this.ACCOUNT_BOOK_COLLECTION);
    const accountRef = doc(this.firestore, 'accounts', transactionData.accountId);
    const now = new Date();

    // ✅ FIX: Respect the provided date, don't override with 'now'
    const transactionDate = transactionData.date || now;
    const transactionTime = transactionData.transactionTime || transactionData.date || now;

    let createdTransactionId = '';

    await runTransaction(this.firestore, async (tx) => {
      const newDocRef = doc(transactionsRef);
      createdTransactionId = newDocRef.id;

      // ✅ FIX: Use the provided dates from the transaction data
      tx.set(newDocRef, {
        accountId: transactionData.accountId,
        accountName: transactionData.accountName,
        date: Timestamp.fromDate(transactionDate), // ✅ Use provided date
        transactionTime: Timestamp.fromDate(transactionTime), // ✅ Use provided time
        description: transactionData.description,
        debit: Number(transactionData.debit) || 0,
        credit: Number(transactionData.credit) || 0,
        paymentMethod: transactionData.paymentMethod || '',
        paymentDetails: transactionData.paymentDetails || '',
        note: transactionData.note || '',
        reference: transactionData.reference || '',
        source: transactionData.source || 'account',
        type: transactionData.type || 'manual',
        relatedDocId: transactionData.relatedDocId || '',
        supplier: transactionData.supplier || '',
        supplierId: transactionData.supplierId || '',
        createdAt: Timestamp.fromDate(now), // ✅ Keep createdAt as actual creation time
        updatedAt: Timestamp.fromDate(now)
      });

      // Update account balance
      const netChange =
        (Number(transactionData.credit) || 0) -
        (Number(transactionData.debit) || 0);

      tx.update(accountRef, {
        currentBalance: increment(netChange),
        balanceUpdatedAt: Timestamp.now()
      });
    });

    console.log(
      `✅ Account book transaction added (${createdTransactionId}) with date ${transactionDate.toISOString()}`
    );

    return createdTransactionId;
  } catch (error) {
    console.error('❌ Error adding account book transaction:', error);
    throw error;
  }
}

// 3. MAIN: Add or Update Transaction for Sale
// ⚠️ IMPORTANT: This ONLY writes to 'accountBookTransactions' collection
async addOrUpdateTransactionForSale(transaction: FirestoreTransaction, sale: any): Promise<void> {
    const accountBookRef = collection(this.firestore, this.ACCOUNT_BOOK_COLLECTION); // 'accountBookTransactions'
    
    // --- 1. DELETE EXISTING TRANSACTIONS (CLEANUP) ---
    const q = query(
        accountBookRef, 
        where('relatedDocId', '==', sale.id),
        where('source', '==', 'sale')
    );
    const existingDocs = await getDocs(q);
    
    existingDocs.forEach(docSnap => {
        const data = docSnap.data();
        const prevAmount = Number(data['credit']) || 0;
        const prevAccountId = data['accountId'];
        
        transaction.delete(docSnap.ref);

        if (prevAccountId) {
            const accountRef = doc(this.firestore, 'accounts', prevAccountId);
            transaction.update(accountRef, { 
                currentBalance: increment(-prevAmount),
                balanceUpdatedAt: Timestamp.now()
            });
        }
    });

    // Helper function to safely convert dates
    const getSafeDate = (dateValue: any): Date => {
        if (!dateValue) return new Date();
        if (dateValue instanceof Date) return dateValue;
        if (dateValue?.toDate && typeof dateValue.toDate === 'function') {
            return dateValue.toDate();
        }
        if (dateValue && typeof dateValue === 'object' && dateValue.seconds) {
            return new Date(dateValue.seconds * 1000);
        }
        if (typeof dateValue === 'string' || typeof dateValue === 'number') {
            const parsed = new Date(dateValue);
            return isNaN(parsed.getTime()) ? new Date() : parsed;
        }
        return new Date();
    };

    const transactionDate = getSafeDate(sale.completedAt || sale.saleDate || sale.paidOn);
    const createdAtDate = getSafeDate(sale.createdAt);

    // --- 2. HANDLE SPLIT PAYMENTS ---
    if (sale.payments && Array.isArray(sale.payments) && sale.payments.length > 0) {
        
        for (const [index, payment] of sale.payments.entries()) {
            if (!payment.amount || Number(payment.amount) <= 0 || !payment.accountId) {
                continue;
            }

            const accountName = await this.getAccountNameById(payment.accountId);
            
            const transactionData = {
                accountId: payment.accountId,
                accountName: accountName,
                date: Timestamp.fromDate(transactionDate),
                transactionTime: Timestamp.fromDate(createdAtDate),
                description: `Sale: ${sale.invoiceNo || sale.id} (${payment.method || 'Split Payment'})`,
                credit: Number(payment.amount),
                debit: 0,
                reference: `${sale.invoiceNo || sale.id}-${index + 1}`,
                paymentDetails: `${sale.invoiceNo || sale.id}-${index + 1}`,
                relatedDocId: sale.id,
                source: 'sale',  // ✅ CRITICAL: Must be 'sale' not 'account'
                type: 'sale',    // ✅ CRITICAL: This determines the badge display
                paymentMethod: payment.method || 'Split Payment',
                customerName: sale.customer || sale.customerName || '',
                note: `Split payment ${index + 1} for Invoice #${sale.invoiceNo || sale.id}`,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                saleStatus: sale.status || 'Completed',
                hasReturns: sale.hasReturns || false,
                isSplitPayment: true,
                saleId: sale.id
            };

            const newTransactionRef = doc(accountBookRef);
            transaction.set(newTransactionRef, transactionData);

            // ✅ Update Account Balance IMMEDIATELY
            const accountRef = doc(this.firestore, 'accounts', payment.accountId);
            transaction.update(accountRef, { 
                currentBalance: increment(Number(payment.amount)),
                balanceUpdatedAt: Timestamp.now()
            });

            console.log(`✅ Created split payment ledger entry ${index + 1} for ${payment.accountId}: ₹${payment.amount}`);
        }

    } else {
        // --- 3. HANDLE SINGLE PAYMENT ---
        const paymentAccountId = sale.paymentAccountId || sale.paymentAccount;
        const paymentAmount = Number(sale.paymentAmount) || 0;
        
        if (!paymentAccountId || paymentAmount <= 0) {
            console.log('⚠️ No valid payment account or amount found, skipping ledger entry');
            return;
        }

        const accountName = await this.getAccountNameById(paymentAccountId);

        const transactionData = {
            accountId: paymentAccountId,
            accountName: accountName,
            date: Timestamp.fromDate(transactionDate),
            transactionTime: Timestamp.fromDate(createdAtDate),
            description: `Sale: ${sale.invoiceNo || sale.id}`,
            credit: paymentAmount,
            debit: 0,
            reference: sale.invoiceNo || sale.id,
            paymentDetails: sale.invoiceNo || sale.id,
            relatedDocId: sale.id,
            source: 'sale',  // ✅ CRITICAL: Must be 'sale' not 'account'
            type: 'sale',    // ✅ CRITICAL: This determines the badge display
            paymentMethod: sale.paymentMethod || 'Cash',
            customerName: sale.customer || sale.customerName || '',
            note: `Payment for Invoice #${sale.invoiceNo || sale.id}`,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
            saleStatus: sale.status || 'Completed',
            hasReturns: sale.hasReturns || false,
            isSplitPayment: false,
            saleId: sale.id
        };

        const newTransactionRef = doc(accountBookRef);
        transaction.set(newTransactionRef, transactionData);

        // ✅ Update Account Balance IMMEDIATELY
        const accountRef = doc(this.firestore, 'accounts', paymentAccountId);
        transaction.update(accountRef, { 
            currentBalance: increment(paymentAmount),
            balanceUpdatedAt: Timestamp.now()
        });

        console.log(`✅ Created single payment ledger entry for ${paymentAccountId}: ₹${paymentAmount}`);
    }
}
// 1. ENHANCED: Delete sale transaction with proper balance reversal


// 2. STANDALONE: Delete sale transaction (for use outside of transactions)
// Standalone method to delete a sale's ledger entry and reverse the balance
  async deleteSaleTransactionStandalone(saleId: string, invoiceNo: string): Promise<void> {
    if (!saleId) return;
    
    const accountBookRef = collection(this.firestore, 'accountBookTransactions');
    
    try {
        await runTransaction(this.firestore, async (transaction) => {
            // Find all ledger entries related to this Sale ID
            const q = query(
                accountBookRef, 
                where('relatedDocId', '==', saleId),
                where('source', '==', 'sale')
            );
            
            const querySnapshot = await getDocs(q);

            querySnapshot.docs.forEach((docSnap) => {
                const data = docSnap.data();
                const creditAmount = Number(data['credit']) || 0;
                const accountId = data['accountId'];

                // 1. Delete the ledger transaction
                transaction.delete(docSnap.ref);

                // 2. Reverse the balance (Deduct the sale amount from the account)
                if (accountId && creditAmount > 0) {
                    const accountRef = doc(this.firestore, 'accounts', accountId);
                    transaction.update(accountRef, { 
                        currentBalance: increment(-creditAmount), // Negative increment subtracts
                        balanceUpdatedAt: Timestamp.now()
                    });
                }
            });
        });
        console.log(`✅ Ledger entries deleted and balances reversed for sale ${saleId}`);
    } catch (error) {
        console.error('❌ Error deleting sale transaction:', error);
        throw error;
    }
  }

 async createReturnDebitTransaction(returnData: any, paymentAccountId: string, transactionDate: Date = new Date(), paymentMethod: string = 'Cash'): Promise<void> {
    const roundedRefund = Number(returnData.roundedRefund) || 0;
    if (!paymentAccountId || roundedRefund <= 0) return;

    try {
        const accountBookRef = collection(this.firestore, this.ACCOUNT_BOOK_COLLECTION);
        const accountRef = doc(this.firestore, 'accounts', paymentAccountId);

        await runTransaction(this.firestore, async (transaction) => {
            const newReturnTxRef = doc(accountBookRef);
            
            // 1. Create the Ledger Entry
            transaction.set(newReturnTxRef, {
                accountId: paymentAccountId,
                accountName: await this.getAccountNameById(paymentAccountId),
                date: Timestamp.fromDate(transactionDate), // ✅ USE USER SELECTED DATE
                transactionTime: Timestamp.fromDate(transactionDate),
                description: `Sales Return Refund: ${returnData.invoiceNo}`,
                debit: roundedRefund, 
                credit: 0,
                reference: returnData.invoiceNo,
                relatedDocId: returnData.id, 
                originalSaleId: returnData.originalSaleId,
                source: 'sales_return',
                paymentMethod: paymentMethod, // ✅ USE USER SELECTED METHOD
                customerName: returnData.customerName || '',
                createdAt: Timestamp.now()
            });

            // 2. Subtract from the current balance
            transaction.update(accountRef, {
                currentBalance: increment(-roundedRefund),
                balanceUpdatedAt: Timestamp.now()
            });
        });
        console.log(`✅ Refund processed on ${transactionDate} via ${paymentMethod}`);
    } catch (error) {
        console.error('Error in return debit:', error);
    }
  }

async repairAllAccountBalances(): Promise<void> {
    console.log('🛠️ Starting Account Balance Repair...');
    const accountsRef = collection(this.firestore, 'accounts');
    const snapshot = await getDocs(accountsRef);
    
    let count = 0;
    // Process one by one to avoid overwhelming the connection
    for (const docSnap of snapshot.docs) {
        await this.recalculateAndSaveBalance(docSnap.id);
        count++;
    }
    console.log(`✅ Repair Complete. Synced ${count} accounts.`);
    alert(`Repair Complete. Synced ${count} accounts.`);
}
async syncAllAccountBalances(): Promise<void> {
    console.log('🔄 Starting full balance sync...');
    const accountsRef = collection(this.firestore, 'accounts');
    const snapshot = await getDocs(accountsRef);
    
    let count = 0;
    for (const docSnap of snapshot.docs) {
        await this.recalculateAndSaveBalance(docSnap.id);
        count++;
    }
    console.log(`✅ Synced balances for ${count} accounts.`);
}
async syncSaleTransaction(sale: any): Promise<void> {
      if (!sale.id) {
          console.warn('Sale ID missing, cannot sync transaction');
          return;
      }

      // 1. Validate we have necessary payment info
      if (sale.paymentAccountId && sale.paymentAmount && Number(sale.paymentAmount) > 0) {
          const accountBookRef = collection(this.firestore, this.ACCOUNT_BOOK_COLLECTION);
          
          // 2. Find existing transaction for this sale
          const q = query(
              accountBookRef, 
              where('relatedDocId', '==', sale.id), 
              where('source', '==', 'sale')
          );
          const querySnapshot = await getDocs(q);

          // 3. Prepare the new transaction data
          const newAmount = Number(sale.paymentAmount);
          const newAccountId = sale.paymentAccountId;
          
          const transactionData = {
              accountId: newAccountId,
              accountName: sale.paymentAccountName || await this.getAccountNameById(newAccountId),
              date: Timestamp.fromDate(this._convertToValidDate(sale.completedAt || sale.paidOn)),
              description: `Payment for Sale: ${sale.invoiceNo || sale.id}`,
              credit: newAmount,
              debit: 0,
              reference: sale.invoiceNo || sale.id,
              relatedDocId: sale.id,
              source: 'sale',
              paymentMethod: sale.paymentMethod || 'Cash', // Ensure payment method is updated
              updatedAt: Timestamp.now(),
              saleStatus: sale.status || 'Completed',
              hasReturns: sale.hasReturns || false
          };

          const batch = writeBatch(this.firestore);

          if (querySnapshot.empty) {
              // --- SCENARIO 1: NEW TRANSACTION ---
              console.log(`Creating NEW credit transaction for sale ${sale.id}`);
              
              // Create the transaction doc
              const newDocRef = doc(accountBookRef);
              batch.set(newDocRef, { ...transactionData, createdAt: Timestamp.now() });

              // Update Account Balance (Add)
              const accountRef = doc(this.firestore, 'accounts', newAccountId);
              batch.update(accountRef, { 
                  currentBalance: increment(newAmount),
                  balanceUpdatedAt: Timestamp.now()
              });

          } else {
              // --- SCENARIO 2: UPDATE EXISTING ---
              console.log(`Updating existing sale transaction for sale ${sale.id}`);
              
              const existingDoc = querySnapshot.docs[0];
              const existingData = existingDoc.data();
              const oldAccountId = existingData['accountId'];
              const oldAmount = Number(existingData['credit']) || 0;

              // Update the transaction document with ALL new data (including potential account/amount changes)
              batch.update(existingDoc.ref, transactionData);

              // HANDLE BALANCE ADJUSTMENTS
              if (oldAccountId !== newAccountId) {
                  // Case A: The Account Changed (e.g., changed from Cash to Bank)
                  // 1. Revert balance from OLD account
                  if (oldAccountId) {
                      const oldAccRef = doc(this.firestore, 'accounts', oldAccountId);
                      batch.update(oldAccRef, { 
                          currentBalance: increment(-oldAmount),
                          balanceUpdatedAt: Timestamp.now()
                      });
                  }
                  // 2. Add balance to NEW account
                  const newAccRef = doc(this.firestore, 'accounts', newAccountId);
                  batch.update(newAccRef, { 
                      currentBalance: increment(newAmount),
                      balanceUpdatedAt: Timestamp.now()
                  });
              } else if (Math.abs(oldAmount - newAmount) > 0.01) {
                  // Case B: Same Account, but Amount Changed
                  const diff = newAmount - oldAmount;
                  const accRef = doc(this.firestore, 'accounts', newAccountId);
                  batch.update(accRef, { 
                      currentBalance: increment(diff),
                      balanceUpdatedAt: Timestamp.now()
                  });
              }
              // Case C: Metadata update only (Status change), no balance impact needed
          }
          
          // 4. Commit all changes atomically
          await batch.commit();
          
          // Optional: Double-check calculation as a safety net, 
          // but the batch increment above should handle 99% of cases instantly.
          // await this.recalculateAndSaveBalance(sale.paymentAccountId);
      }
  }
  private _convertToValidDate(dateInput: any): Date {
    if (!dateInput) return new Date();
    if (dateInput instanceof Date) return dateInput;
    if (dateInput?.toDate) return dateInput.toDate();
    const parsedDate = new Date(dateInput);
    return isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
  }

  calculateBalanceFromTransactions(account: any, transactions: any[]): number {
    let balance = Number(account.openingBalance) || 0;

    const sortedTransactions = transactions.sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateA - dateB;
    });

    for (const transaction of sortedTransactions) {
        const credit = Number(transaction.credit) || 0;
        const debit = Number(transaction.debit) || 0;
        balance += credit;
        balance -= debit;
    }
    return balance;
  }

  public async getCalculatedBalance(accountId: string): Promise<number> {
    const accountDocRef = doc(this.firestore, 'accounts', accountId);
    const transactionsRef = collection(this.firestore, 'transactions');
    
    const accountSnap = await getDoc(accountDocRef);
    if (!accountSnap.exists()) {
      throw new Error(`Account with ID ${accountId} not found.`);
    }
    const openingBalance = Number(accountSnap.data()['openingBalance']) || 0;

    const q = query(transactionsRef, where('accountId', '==', accountId));
    const transactionsSnap = await getDocs(q);

    let currentBalance = openingBalance;
    transactionsSnap.forEach(tDoc => {
      const tData = tDoc.data();
      const credit = Number(tData['credit']) || 0;
      const debit = Number(tData['debit']) || 0;
      currentBalance += credit - debit;
    });

    this.calculatedCurrentBalances[accountId] = currentBalance;
    return currentBalance;
  }



  async updateAllAccountBalances(): Promise<void> {
    const accounts = await this.getAccountsOnce();
    const batch = writeBatch(this.firestore);
    
    for (const account of accounts) {
      const balance = await this.getCalculatedBalance(account.id);
      const accountRef = doc(this.firestore, 'accounts', account.id);
      batch.update(accountRef, {
        currentBalance: balance,
        balanceUpdatedAt: this.createPreciseTimestamp()
      });
    }
    
    await batch.commit();
    console.log('Updated all account balances');
  }

  public async batchUpdateCurrentBalances(updates: Map<string, number>): Promise<void> {
    if (updates.size === 0) {
      return;
    }

    const batch = writeBatch(this.firestore);
    const timestamp = this.createPreciseTimestamp();

    updates.forEach((balance, accountId) => {
      const accountRef = doc(this.firestore, 'accounts', accountId);
      batch.update(accountRef, {
        currentBalance: balance,
        balanceUpdatedAt: timestamp
      });
    });

    try {
      await batch.commit();
      console.log(`Successfully updated the current balance for ${updates.size} accounts.`);
    } catch (error) {
      console.error('Error committing batch update for account balances:', error);
      throw error;
    }
  }

  public getAllTransactionsUpToDate(asOfDate: Date, callback: (transactions: any[]) => void): void {
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
          date: this.convertTimestampToDate(data['date']),
          transactionTime: this.convertTimestampToDate(data['transactionTime'] || data['createdAt']),
          createdAt: this.convertTimestampToDate(data['createdAt'])
        };
      });
      callback(transactions);
    });
  }

  async updateCurrentBalance(accountId: string, currentBalance: number): Promise<void> {
    try {
      const accountRef = doc(this.firestore, 'accounts', accountId);
      await updateDoc(accountRef, {
        currentBalance: currentBalance,
        balanceUpdatedAt: this.createPreciseTimestamp()
      });
      console.log(`Updated current balance for account ${accountId} to ${currentBalance}`);
    } catch (error) {
      console.error('Error updating current balance:', error);
      throw error;
    }
  }

  public getCachedBalance(accountId: string): number | undefined {
    return this.calculatedCurrentBalances[accountId];
  }

  private createPreciseTimestamp(): Timestamp {
    return Timestamp.now();
  }

  clearAccountCache(accountId: string): void {
    console.log(`Clearing cache for account: ${accountId}`);
    delete this.accountCacheData[accountId];
    delete this.calculatedCurrentBalances[accountId];
    delete this.originalOpeningBalances[accountId];
    delete this.accountTransactions[accountId];
    delete this.debitCreditTotals[accountId];
  }

  setAccountBookRefreshFlag(accountId: string, shouldRefresh: boolean): void {
    console.log(`Setting refresh flag for account ${accountId}: ${shouldRefresh}`);
    this.accountBookRefreshFlags[accountId] = shouldRefresh;
  }

  shouldRefreshAccountBook(accountId: string): boolean {
    const shouldRefresh = this.accountBookRefreshFlags[accountId] || false;
    console.log(`Checking refresh flag for account ${accountId}: ${shouldRefresh}`);
    return shouldRefresh;
  }

  clearAccountBookRefreshFlag(accountId: string): void {
    console.log(`Clearing refresh flag for account: ${accountId}`);
    delete this.accountBookRefreshFlags[accountId];
  }

  async recordTransaction(accountId: string, transactionData: any): Promise<void> {
    try {
      const transactionsRef = collection(this.firestore, 'transactions');
      await addDoc(transactionsRef, {
        ...transactionData,
        accountId,
        createdAt: this.createPreciseTimestamp(),
        transactionTime: this.createPreciseTimestamp()
      });
    } catch (error) {
      console.error('Error recording transaction:', error);
      throw error;
    }
  }

  setOriginalOpeningBalance(accountId: string, balance: number): void {
    if (!(accountId in this.originalOpeningBalances)) {
      this.originalOpeningBalances[accountId] = balance;
      console.log(`Setting original opening balance for ${accountId}: ${balance}`);
    }
  }

  getOriginalOpeningBalance(accountId: string): number {
    const balance = this.originalOpeningBalances[accountId];
    console.log(`Getting original opening balance for ${accountId}: ${balance || 0}`);
    return balance || 0;
  }

  async updateAccountBalance(accountId: string, balance: number): Promise<void> {
    const accountDocRef = doc(this.firestore, 'accounts', accountId);
    await updateDoc(accountDocRef, {
      currentBalance: balance
    });
  }

  async calculateAndStoreCurrentBalance(accountId: string): Promise<number> {
    const balance = await this.getCalculatedBalance(accountId);
    await this.updateCurrentBalance(accountId, balance);
    return balance;
  }
  
  getIncomeTypes(): string[] {
    return Object.values(this.INCOME_TYPES);
  }

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


// In AccountService.ts

async deleteAccountBookTransaction(transactionId: string, accountId: string): Promise<void> {
  try {
    if (!transactionId || !accountId) {
      throw new Error("Transaction ID and Account ID are required.");
    }

    const transactionRef = doc(this.firestore, this.ACCOUNT_BOOK_COLLECTION, transactionId);
    const accountRef = doc(this.firestore, 'accounts', accountId);

    await runTransaction(this.firestore, async (transaction) => {
        // 1. Get the transaction to know how much to reverse
        const txDoc = await transaction.get(transactionRef);
        if (!txDoc.exists()) throw new Error("Transaction does not exist!");

        const data = txDoc.data();
        const debit = Number(data['debit']) || 0;
        const credit = Number(data['credit']) || 0;

        // 2. Delete the transaction
        transaction.delete(transactionRef);

        // 3. ✅ Reverse the balance effect
        // If it was a Credit (+), we subtract it.
        // If it was a Debit (-), we add it back.
        const reverseChange = debit - credit; 

        transaction.update(accountRef, {
            currentBalance: increment(reverseChange),
            balanceUpdatedAt: Timestamp.now()
        });
    });

    console.log(`Deleted transaction ${transactionId} and updated balance.`);
  } catch (error) {
    console.error('Error deleting account book transaction:', error);
    throw error;
  }
}
  getAccountBookTransactions(accountId: string, callback: (transactions: any[]) => void): () => void {
    const transactionsRef = collection(this.firestore, this.ACCOUNT_BOOK_COLLECTION);
    const q = query(transactionsRef, where('accountId', '==', accountId));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const transactions = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          accountId: data['accountId'],
          accountName: data['accountName'],
          date: this.convertTimestampToDate(data['date']),
          transactionTime: this.convertTimestampToDate(data['transactionTime'] || data['createdAt']),
          description: data['description'],
          debit: Number(data['debit']) || 0,
          credit: Number(data['credit']) || 0,
          paymentMethod: data['paymentMethod'],
          note: data['note'],
          reference: data['reference'],
          source: data['source'] || 'account', // Include source field
          originalSaleId: data['originalSaleId'],
          customerName: data['customerName'],
          exactRefund: data['exactRefund'], // Include exact refund amount for audit
          roundedRefund: data['roundedRefund'], // Include rounded refund amount  
          roundingAdjustment: data['roundingAdjustment'], // Include rounding adjustment
          createdAt: this.convertTimestampToDate(data['createdAt']),
          updatedAt: this.convertTimestampToDate(data['updatedAt'])
        };
      });
      callback(transactions);
    });
    
    return unsubscribe;
  }

  getAccountById(id: string): Observable<any> {
    const accountDocRef = doc(this.firestore, 'accounts', id);
    
    return from(getDoc(accountDocRef)).pipe(
      map((docSnap: DocumentSnapshot<DocumentData>) => {
        if (docSnap.exists()) {
          const accountData = { 
            id: docSnap.id, 
            ...docSnap.data(),
            openingBalance: docSnap.data()['openingBalance'] || 0
          };
          this.setOriginalOpeningBalance(id, accountData.openingBalance);
          console.log(`Account ${id} loaded with opening balance: ${accountData.openingBalance}`);
          return accountData;
        } else {
          console.error('Account not found');
          return null;
        }
      })
    );
  }

  setAccountTransactions(accountId: string, transactions: any[]): void {
    this.accountTransactions[accountId] = transactions;
    
    const totals = { debit: 0, credit: 0 };
    transactions.forEach(tx => {
      totals.debit += Number(tx.debit) || 0;
      totals.credit += Number(tx.credit) || 0;
    });
    
    this.debitCreditTotals[accountId] = totals;
  }

  getAccountTransactions(accountId: string): any[] {
    return this.accountTransactions[accountId] || [];
  }

  getAccountDebitCreditTotals(accountId: string): { debit: number, credit: number } {
    return this.debitCreditTotals[accountId] || { debit: 0, credit: 0 };
  }

addAccount(accountData: any): Promise<any> {
    // ✅ ENHANCED: Properly handle accountHead structure
    if (accountData.accountHeadGroup && accountData.accountHeadValue) {
        // Split the accountHeadValue to get group and value
        const parts = accountData.accountHeadValue.split('|');
        accountData.accountHead = {
            group: accountData.accountHeadGroup,
            value: parts.length > 1 ? parts[1] : accountData.accountHeadValue
        };
    } else if (accountData.accountHead && typeof accountData.accountHead === 'string') {
        // Handle legacy format
        const [group, value] = accountData.accountHead.split('|');
        accountData.accountHead = {
            group: group,
            value: value
        };
    }
    
    // Set defaults
    if (!accountData.accountSubType) accountData.accountSubType = '';
    if (!accountData.incomeType) accountData.incomeType = '';
    if (!accountData.note) accountData.note = '';
    if (!accountData.currentBalance) accountData.currentBalance = accountData.openingBalance || 0;
    
    const accountsRef = collection(this.firestore, 'accounts');
    return addDoc(accountsRef, {
        ...accountData,
        createdAt: this.createPreciseTimestamp(),
        updatedAt: this.createPreciseTimestamp()
    })
        .then(docRef => {
            console.log('Account created with ID:', docRef.id);
            console.log('Account Head:', accountData.accountHead);
            this.setOriginalOpeningBalance(docRef.id, accountData.openingBalance || 0);
            return docRef;
        })
        .catch(error => {
            console.error('Error adding account:', error);
            throw error;
        });
}

  getTransactionsForAccount(accountId: string, callback: (transactions: any[]) => void): void {
    const transactionsRef = collection(this.firestore, 'transactions');
    const q = query(transactionsRef, where('accountId', '==', accountId));
    
    onSnapshot(q, (snapshot) => {
      const transactions = snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
          id: doc.id, 
          ...data,
          date: this.convertTimestampToDate(data['date']),
          transactionTime: this.convertTimestampToDate(data['transactionTime'] || data['createdAt']),
          createdAt: this.convertTimestampToDate(data['createdAt'])
        };
      });
      callback(transactions);
    });
  }

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
          date: this.convertTimestampToDate(data['date']),
          transactionTime: this.convertTimestampToDate(data['transactionTime'] || data['createdAt']),
          createdAt: this.convertTimestampToDate(data['createdAt'] || data['timestamp'])
        };
      });
      callback(transfers);
    });
  }

  getTransactionByReferenceId(referenceId: string, callback: (transaction: any | null) => void): void {
    const transactionsRef = collection(this.firestore, 'transactions');
    const q = query(transactionsRef, where('referenceId', '==', referenceId));
    
    onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        callback(null);
      } else {
        const doc = snapshot.docs[0];
        const data = doc.data();
        callback({ 
          id: doc.id, 
          ...data,
          date: this.convertTimestampToDate(data['date']),
          transactionTime: this.convertTimestampToDate(data['transactionTime'] || data['createdAt']),
          createdAt: this.convertTimestampToDate(data['createdAt'])
        });
      }
    });
  }

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
          transactionTime: this.convertTimestampToDate(data['transactionTime'] || data['createdAt']),
          createdAt: this.convertTimestampToDate(data['createdAt']),
          updatedAt: this.convertTimestampToDate(data['updatedAt'])
        };
      });
      callback(transactions);
    });
    
    return unsubscribe;
  }

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
          date: this.convertTimestampToDate(data['date']),
          transactionTime: this.convertTimestampToDate(data['transactionTime'] || data['createdAt']),
          createdAt: this.convertTimestampToDate(data['createdAt'])
        };
      });
      callback(transactions);
    });
  }

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
          date: this.convertTimestampToDate(data['date']),
          transactionTime: this.convertTimestampToDate(data['transactionTime'] || data['createdAt']),
          createdAt: this.convertTimestampToDate(data['createdAt'] || data['timestamp'])
        };
      });
      callback(transfers);
    });
  }

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
          date: this.convertTimestampToDate(data['date']),
          transactionTime: this.convertTimestampToDate(data['transactionTime'] || data['createdAt']),
          createdAt: this.convertTimestampToDate(data['createdAt'])
        };
      });
      callback(deposits);
    });
  }

  async updateAccountBookTransaction(transactionId: string, updateData: {
    date?: Date;
    transactionTime?: Date;
    description?: string;
    debit?: number;
    credit?: number;
    paymentMethod?: string;
    note?: string;
  }): Promise<void> {
    try {
      const transactionRef = doc(this.firestore, this.ACCOUNT_BOOK_COLLECTION, transactionId);
      
      const updateObject: any = {
        updatedAt: this.createPreciseTimestamp()
      };
      
      if (updateData.date) updateObject.date = Timestamp.fromDate(updateData.date);
      if (updateData.transactionTime) updateObject.transactionTime = Timestamp.fromDate(updateData.transactionTime);
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



  updateAccount(id: string, accountData: any): Promise<void> {
    if (accountData.accountHead && typeof accountData.accountHead === 'string') {
      const [group, value] = accountData.accountHead.split('|');
      accountData.accountHead = {
        group: group,
        value: value
      };
    }
    
    const accountDocRef = doc(this.firestore, 'accounts', id);
    return updateDoc(accountDocRef, {
      ...accountData,
      updatedAt: this.createPreciseTimestamp()
    });
  }

  deleteAccount(id: string): Promise<void> {
    const accountDocRef = doc(this.firestore, 'accounts', id);
    return deleteDoc(accountDocRef);
  }

  deleteTransaction(id: string): Promise<void> {
    const transactionDocRef = doc(this.firestore, 'transactions', id);
    return deleteDoc(transactionDocRef);
  }
  
  deleteFundTransfer(id: string): Promise<void> {
    const fundTransferDocRef = doc(this.firestore, 'fundTransfers', id);
    return deleteDoc(fundTransferDocRef);
  }

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

        this.getAllTransactionsUpToDate(asOfDate, (transactions) => {
          const accountBalances = new Map<string, number>();
          
          accounts.forEach((account: { id: string; openingBalance: any; }) => {
            accountBalances.set(account.id, account.openingBalance || 0);
          });

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

  getAccounts(callback: (accounts: any[]) => void): () => void {
    const accountsRef = collection(this.firestore, 'accounts');
    const unsubscribe = onSnapshot(accountsRef, (snapshot) => {
      const accounts = snapshot.docs.map(doc => {
        const data = doc.data();
        const accountData = {
          id: doc.id,
          name: data['name'] || 'Unnamed Account',
          accountNumber: data['accountNumber'] || '',
          accountType: data['accountType'] || '',
          openingBalance: Number(data['openingBalance']) || 0,
          
          currentBalance: data['currentBalance'] !== undefined ? Number(data['currentBalance']) : Number(data['openingBalance']) || 0,

          accountHead: data['accountHead'] || {},
          accountSubType: data['accountSubType'] || '',
          incomeType: data['incomeType'] || '',
          paidOnDate: data['paidOnDate'],
          note: data['note'] || '',
          addedBy: data['addedBy'] || '',
          accountDetails: data['accountDetails'] || [],
          createdAt: this.convertTimestampToDate(data['createdAt']),
          updatedAt: this.convertTimestampToDate(data['updatedAt'])
        };
        
        this.setOriginalOpeningBalance(accountData.id, accountData.openingBalance);
        
        return accountData;
      });
      callback(accounts);
    });
    
    return unsubscribe;
  }

  async addTransaction(accountId: string, transactionData: any): Promise<void> {
    try {
      const transactionsRef = collection(this.firestore, 'transactions');
      const now = new Date();
      
      let debit = 0;
      let credit = 0;
      
      if (transactionData.debit !== undefined && transactionData.credit !== undefined) {
        debit = Number(transactionData.debit) || 0;
        credit = Number(transactionData.credit) || 0;
        console.log(`✅ Using explicit debit/credit values: debit=${debit}, credit=${credit}`);
      } else {
        const amount = transactionData.amount || 0;
        
        switch (transactionData.type) {
          case 'expense':
          case 'transfer_out':
          case 'purchase_payment':
          case 'sales_return':
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
            if (transactionData.type?.includes('expense') || 
                transactionData.type?.includes('payment') ||
                transactionData.type?.includes('return')) {
              debit = amount;
            } else {
              credit = amount;
            }
        }
        console.log(`✅ Calculated debit/credit from amount: type=${transactionData.type}, amount=${amount}, debit=${debit}, credit=${credit}`);
      }
      
      const transaction = {
        accountId,
        amount: transactionData.amount || Math.max(debit, credit),
        type: transactionData.type,
        date: Timestamp.fromDate(new Date(transactionData.date)),
        transactionTime: Timestamp.fromDate(transactionData.transactionTime || now),
        description: transactionData.description,
        debit: debit,
        credit: credit,
        paymentMethod: transactionData.paymentMethod || '',
        note: transactionData.note || '',
        reference: transactionData.reference || '',
        relatedDocId: transactionData.relatedDocId || '',
        source: transactionData.source || '',
        saleId: transactionData.saleId || '',
        invoiceNo: transactionData.invoiceNo || '',
        customer: transactionData.customer || '',
        supplier: transactionData.supplier || '',
        paymentStatus: transactionData.paymentStatus || '',
        originalPurchaseId: transactionData.originalPurchaseId || '',
        createdAt: Timestamp.fromDate(now)
      };

      await addDoc(transactionsRef, transaction);
      console.log(`✅ Transaction added successfully: ${transactionData.type} - debit: ${debit}, credit: ${credit}`);
      
    } catch (error) {
      console.error('❌ Error adding transaction:', error);
      throw error;
    }
  }

  async updateAccountBalancesFromTransactions(): Promise<void> {
    const accounts = await this.getAccountsOnce();
    const transactions = await this.getAllTransactionsOnce();

    const batch = writeBatch(this.firestore);
    
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
        unsub();
        resolve(accounts);
      });
    });
  }

  private getAllTransactionsOnce(): Promise<any[]> {
    return new Promise((resolve) => {
      const unsub = this.getAllTransactions((transactions) => {
        unsub();
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

  updateTransaction(transaction: any): Promise<void> {
    const transactionDocRef = doc(this.firestore, 'transactions', transaction.id);
    
    const { id, balance, ...transactionData } = transaction;
    
    return updateDoc(transactionDocRef, {
      date: transaction.date,
      transactionTime: transaction.transactionTime || transaction.date,
      description: transaction.description,
      paymentMethod: transaction.paymentMethod,
      paymentDetails: transaction.paymentDetails,
      note: transaction.note,
      debit: transaction.debit,
      credit: transaction.credit,
      updatedAt: this.createPreciseTimestamp()
    });
  }
  
  updateFundTransfer(transfer: any): Promise<void> {
    const transferDocRef = doc(this.firestore, 'fundTransfers', transfer.id);
    
    return updateDoc(transferDocRef, {
      date: transfer.date,
      transactionTime: transfer.transactionTime || transfer.date,
      note: transfer.note || '',
      amount: transfer.type === 'transfer_out' ? Number(transfer.debit) : Number(transfer.credit),
      updatedAt: this.createPreciseTimestamp()
    });
  }

// In AccountService.ts

async addFundTransfer(transferData: any): Promise<any> {
  try {
    const transfersRef = collection(this.firestore, 'fundTransfers');
    const transferDocRef = doc(transfersRef);
    const now = new Date();
    
    const batch = writeBatch(this.firestore);
    
    // 1. Create the Transfer Document
    batch.set(transferDocRef, {
      ...transferData,
      createdAt: Timestamp.fromDate(now),
      transactionTime: Timestamp.fromDate(transferData.transactionTime || now),
      timestamp: now.getTime()
    });
    
    // 2. Add Transaction entries (as you were doing)
    const transactionsRef = collection(this.firestore, 'transactions');
    
    // Debit Entry (Source)
    batch.set(doc(transactionsRef), {
      accountId: transferData.fromAccountId,
      amount: transferData.amount,
      type: 'transfer_out',
      date: transferData.date,
      transactionTime: Timestamp.fromDate(transferData.transactionTime || now),
      description: `Transfer to ${transferData.toAccountName}`,
      paymentMethod: 'Fund Transfer',
      reference: `TRF-${transferDocRef.id}`,
      relatedDocId: transferDocRef.id,
      debit: transferData.amount,
      credit: 0,
      createdAt: Timestamp.fromDate(now)
    });
    
    // Credit Entry (Destination)
    batch.set(doc(transactionsRef), {
      accountId: transferData.toAccountId,
      amount: transferData.amount,
      type: 'transfer_in',
      date: transferData.date,
      transactionTime: Timestamp.fromDate(transferData.transactionTime || now),
      description: `Transfer from ${transferData.fromAccountName}`,
      paymentMethod: 'Fund Transfer',
      reference: `TRF-${transferDocRef.id}`,
      relatedDocId: transferDocRef.id,
      debit: 0,
      credit: transferData.amount,
      createdAt: Timestamp.fromDate(now)
    });

    // ---------------------------------------------------------
    // ✅ THE FIX: Update Account Balances INSTANTLY in the Batch
    // ---------------------------------------------------------
    
    // Decrease Source Account Balance
    const fromAccountRef = doc(this.firestore, 'accounts', transferData.fromAccountId);
    batch.update(fromAccountRef, {
      currentBalance: increment(-Number(transferData.amount)),
      balanceUpdatedAt: Timestamp.now()
    });

    // Increase Destination Account Balance
    const toAccountRef = doc(this.firestore, 'accounts', transferData.toAccountId);
    batch.update(toAccountRef, {
      currentBalance: increment(Number(transferData.amount)),
      balanceUpdatedAt: Timestamp.now()
    });
    
    await batch.commit();
    console.log('Fund transfer added and balances updated atomically.');
    return transferDocRef.id;

  } catch (error) {
    console.error('Error processing fund transfer:', error);
    throw error;
  }
}
  public async getAccountNameById(accountId: string): Promise<string> {
    if (!accountId) return 'Unknown';
    const docRef = doc(this.firestore, 'accounts', accountId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? (docSnap.data()['name'] || 'Unknown') : 'Unknown';
  }
  // In AccountService.ts

async addDeposit(depositData: any): Promise<any> {
  try {
    const depositsRef = collection(this.firestore, 'deposits');
    const depositDocRef = doc(depositsRef); 
    const now = new Date();
    
    const batch = writeBatch(this.firestore);
    
    // 1. Create Deposit Doc
    batch.set(depositDocRef, {
      ...depositData,
      createdAt: Timestamp.fromDate(now),
      transactionTime: Timestamp.fromDate(depositData.transactionTime || now),
      timestamp: now.getTime()
    });
    
    // 2. Create Transaction Doc (Credit to Account)
    const transactionsRef = collection(this.firestore, 'transactions');
    batch.set(doc(transactionsRef), {
      accountId: depositData.accountId,
      amount: depositData.amount,
      type: 'deposit',
      date: depositData.date,
      transactionTime: Timestamp.fromDate(depositData.transactionTime || now),
      description: depositData.depositFromName ? `Deposit from ${depositData.depositFromName}` : 'Direct Deposit',
      paymentMethod: 'Deposit',
      reference: `DEP-${depositDocRef.id}`,
      relatedDocId: depositDocRef.id,
      debit: 0,
      credit: depositData.amount,
      createdAt: Timestamp.fromDate(now)
    });

    // ---------------------------------------------------------
    // ✅ THE FIX: Update Account Balance INSTANTLY in the Batch
    // ---------------------------------------------------------
    const accountRef = doc(this.firestore, 'accounts', depositData.accountId);
    batch.update(accountRef, {
        currentBalance: increment(Number(depositData.amount)),
        balanceUpdatedAt: Timestamp.now()
    });

    // Handle "Deposit From" (Transfer scenario)
    if (depositData.depositFrom) {
      batch.set(doc(transactionsRef), {
        accountId: depositData.depositFrom,
        amount: depositData.amount,
        type: 'transfer_out',
        date: depositData.date,
        transactionTime: Timestamp.fromDate(depositData.transactionTime || now),
        description: `Transfer to ${depositData.accountName}`,
        paymentMethod: 'Deposit Transfer',
        reference: `DEP-${depositDocRef.id}`,
        relatedDocId: depositDocRef.id,
        debit: depositData.amount,
        credit: 0,
        createdAt: Timestamp.fromDate(now)
      });

      // Update Source Account Balance
      const fromAccountRef = doc(this.firestore, 'accounts', depositData.depositFrom);
      batch.update(fromAccountRef, {
        currentBalance: increment(-Number(depositData.amount)),
        balanceUpdatedAt: Timestamp.now()
      });
    }
    
    await batch.commit();
    console.log('Deposit processed and balances updated atomically.');
    return depositDocRef.id;
  } catch (error) {
    console.error('Error processing deposit:', error);
    throw error;
  }
}



  getDepositsForAccount(accountId: string, callback: (deposits: any[]) => void): void {
    const depositsRef = collection(this.firestore, 'deposits');
    const q = query(depositsRef, where('accountId', '==', accountId));
    
    onSnapshot(q, (snapshot) => {
      const deposits = snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
          id: doc.id, 
          ...data,
          date: this.convertTimestampToDate(data['date']),
          transactionTime: this.convertTimestampToDate(data['transactionTime'] || data['createdAt']),
          createdAt: this.convertTimestampToDate(data['createdAt'])
        };
      });
      callback(deposits);
    });
  }

  getTransactionsByIncomeType(incomeType: string, callback: (transactions: any[]) => void): void {
    this.getAccountsByIncomeType(incomeType, (accounts) => {
      const accountIds = accounts.map(a => a.id);
      
      if (accountIds.length === 0) {
        callback([]);
        return;
      }
      
      const transactionsRef = collection(this.firestore, 'transactions');
      const q = query(transactionsRef, where('accountId', 'in', accountIds));
      
      onSnapshot(q, (snapshot) => {
        const transactions = snapshot.docs.map(doc => {
          const data = doc.data();
          return { 
            id: doc.id, 
            ...data,
            date: this.convertTimestampToDate(data['date']),
            transactionTime: this.convertTimestampToDate(data['transactionTime'] || data['createdAt']),
            createdAt: this.convertTimestampToDate(data['createdAt'])
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

        this.getAllTransactionsUpToDate(asOfDate, (transactions) => {
          const accountBalances = new Map<string, number>();
          
          accounts.forEach((account: { id: string; openingBalance: any; }) => {
            accountBalances.set(account.id, account.openingBalance || 0);
          });

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

  getAllTransactions(callback: (transactions: any[]) => void): () => void {
    const transactionsRef = collection(this.firestore, 'transactions');
    const unsubscribe = onSnapshot(transactionsRef, (snapshot) => {
      const transactions = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          date: this.convertTimestampToDate(data['date']),
          transactionTime: this.convertTimestampToDate(data['transactionTime'] || data['createdAt']),
          createdAt: this.convertTimestampToDate(data['createdAt']),
          updatedAt: this.convertTimestampToDate(data['updatedAt'])
        };
      });
      callback(transactions);
    });
    return unsubscribe;
  }

  getAllAccountBookTransactions(callback: (transactions: any[]) => void): () => void {
    const transactionsRef = collection(this.firestore, this.ACCOUNT_BOOK_COLLECTION);
    const unsubscribe = onSnapshot(transactionsRef, (snapshot) => {
      const transactions = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          accountId: data['accountId'],
          accountName: data['accountName'],
          date: this.convertTimestampToDate(data['date']),
          transactionTime: this.convertTimestampToDate(data['transactionTime'] || data['createdAt']),
          description: data['description'],
          debit: Number(data['debit']) || 0,
          credit: Number(data['credit']) || 0,
          paymentMethod: data['paymentMethod'],
          note: data['note'],
          reference: data['reference'],
          source: data['source'] || 'account',
          originalSaleId: data['originalSaleId'],
          customerName: data['customerName'],
          exactRefund: data['exactRefund'], // Include exact refund amount for audit
          roundedRefund: data['roundedRefund'], // Include rounded refund amount  
          roundingAdjustment: data['roundingAdjustment'], // Include rounding adjustment
          createdAt: this.convertTimestampToDate(data['createdAt']),
          updatedAt: this.convertTimestampToDate(data['updatedAt'])
        };
      });
      callback(transactions);
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
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return { 
        id: doc.id, 
        ...data,
        date: this.convertTimestampToDate(data['date']),
        transactionTime: this.convertTimestampToDate(data['transactionTime'] || data['createdAt']),
        createdAt: this.convertTimestampToDate(data['createdAt'])
      };
    });
  }

  getRecentTransactions(accountId: string, transactionLimit: number = 5): Observable<any[]> {
    return new Observable(observer => {
      const transactionsRef = collection(this.firestore, 'transactions');
      const q = query(
        transactionsRef,
        where('accountId', '==', accountId),
        orderBy('transactionTime', 'desc'), 
        limit(transactionLimit)
      );
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const transactions = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            date: this.convertTimestampToDate(data['date']),
            transactionTime: this.convertTimestampToDate(data['transactionTime'] || data['createdAt']),
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

  async decreaseAccountBalance(accountId: string, amount: number, description: string): Promise<void> {
    try {
      const accountRef = doc(this.firestore, 'paymentAccounts', accountId);
      const now = new Date();
      
      await runTransaction(this.firestore, async (transaction) => {
        const accountDoc = await transaction.get(accountRef);
        if (!accountDoc.exists()) {
          throw new Error('Account not found');
        }
        
        const currentBalance = accountDoc.data()['balance'] || 0;
        const newBalance = currentBalance - amount;
        
        if (newBalance < 0) {
          throw new Error('Insufficient funds in account');
        }
        
        transaction.update(accountRef, {
          balance: newBalance,
          updatedAt: Timestamp.fromDate(now)
        });
        
        const transactionRef = doc(collection(this.firestore, 'accountTransactions'));
        transaction.set(transactionRef, {
          accountId,
          amount,
          type: 'debit',
          description,
          date: Timestamp.fromDate(now),
          transactionTime: Timestamp.fromDate(now),
          previousBalance: currentBalance,
          newBalance,
          reference: `PAY-${now.getTime()}`,
          createdAt: Timestamp.fromDate(now)
        });
      });
    } catch (error) {
      console.error('Error decreasing account balance:', error);
      throw error;
    }
  }

  setCalculatedCurrentBalance(accountId: string, balance: number): void {
    const currentBalances = this.accountBalancesSubject.getValue();
    currentBalances.set(accountId, balance);
    this.accountBalancesSubject.next(new Map(currentBalances));
  }

  getCalculatedCurrentBalance(accountId: string): number | undefined {
    return this.accountBalancesSubject.getValue().get(accountId);
  }

  getPaymentAccounts(): Observable<any[]> {
    const paymentAccountsRef = collection(this.firestore, 'accounts');
    
    return new Observable<any[]>(observer => {
      const unsubscribe = onSnapshot(paymentAccountsRef, (snapshot) => {
        const accounts = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data() as any
        }))
        .filter(account => {
            // Initialize checks
            let group = '';
            let rawValue = '';

            // 1. Normalize the data structure
            if (account.accountHead) {
              if (typeof account.accountHead === 'object') {
                // Handle Object format: { group: 'Asset', value: 'Asset|bank_accounts' }
                group = account.accountHead.group || '';
                rawValue = account.accountHead.value || '';
              } else if (typeof account.accountHead === 'string') {
                // Handle String format: 'Asset|bank_accounts'
                const parts = account.accountHead.split('|');
                group = parts[0] || '';
                // In string format, the raw value is the whole string, or we reconstruct it
                rawValue = account.accountHead; 
              }
            }
            
            // 2. Normalize the value to check (remove the 'Asset|' prefix if it exists to be safe, or check includes)
            // We need to support 'Asset|bank_accounts' and 'Asset|current_assets'
            
            const isAssetGroup = group === 'Asset';
            
            // Check if the value string contains the specific types we want
            const isBankAccount = rawValue.includes('bank_accounts');
            const isCurrentAsset = rawValue.includes('current_assets');

            // 3. Final Condition
            // We want accounts that are Assets AND are either Bank Accounts or Current Assets
            return isAssetGroup && (isBankAccount || isCurrentAsset);
        });
        
        console.log('✅ Filtered Payment Accounts:', accounts.length);
        observer.next(accounts);
      });
      return () => unsubscribe();
    });
  }
// src/app/services/account.service.ts

// This is the source of truth. ListAccounts will now rely on the 
// 'currentBalance' field updated by this method.
async recalculateAndSaveBalance(accountId: string): Promise<void> {
    if (!accountId) return;

    try {
        const accountRef = doc(this.firestore, 'accounts', accountId);
        const accountSnap = await getDoc(accountRef);
        if (!accountSnap.exists()) return;

        const openingBalance = Number(accountSnap.data()['openingBalance']) || 0;
        
        // CRITICAL: Queries the NEW collection
        const transactionsRef = collection(this.firestore, 'accountBookTransactions'); 
        const q = query(transactionsRef, where('accountId', '==', accountId));
        const transSnap = await getDocs(q);

        // Calculates accurate balance
        const newBalance = transSnap.docs.reduce((balance, tDoc) => {
            const tData = tDoc.data();
            const credit = Number(tData['credit']) || 0;
            const debit = Number(tData['debit']) || 0;
            return balance + credit - debit;
        }, openingBalance);

        // Saves to DB. ListAccounts will read this field.
        await updateDoc(accountRef, { 
            currentBalance: newBalance, 
            balanceUpdatedAt: Timestamp.now() 
        });
        
        console.log(`✅ Balance synced for ${accountId}: ${newBalance}`);
    } catch (error) {
        console.error(`❌ Failed to recalculate balance for ${accountId}:`, error);
    }
}
  async refreshAccountData(accountId: string): Promise<void> {
    this.clearAccountCache(accountId);
    this.setAccountBookRefreshFlag(accountId, true);
  }
  
  getIncomeSummary(callback: (summary: any) => void): void {
    const incomeTypes = this.getIncomeTypes();
    let summary: any = {};
    
    incomeTypes.forEach(type => {
      summary[type] = {
        total: 0,
        count: 0,
        accounts: []
      };
    });
    
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