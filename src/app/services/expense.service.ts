// src/app/services/expense.service.ts

import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  getDoc,
  onSnapshot,
  deleteDoc,
  doc,
  updateDoc,
  query,
  orderBy,
  DocumentReference,
  getDocs,
  where,
  runTransaction,
  writeBatch // Import writeBatch
} from '@angular/fire/firestore';
import { BehaviorSubject, from, Observable, firstValueFrom } from 'rxjs';
import { AccountService } from './account.service';
import { LocationService } from './location.service';
import { ExpenseCategoriesService } from './expense-categories.service';

export interface Expense {
  balanceAmount: number;
  paymentStatus: string;
  id?: string;
  type: 'expense' | 'income';
  businessLocation: string;
  businessLocationName?: string;
  expenseCategory?: string;
  expenseCategoryName?: string;
  incomeCategory?: string;
  incomeCategoryName?: string;
  subCategory?: string;
  expenseType?: string;
  incomeType?: string;
  taxAmount?: number;
  taxRate?: string;
  paymentAmountWithTax?: number;
  accountHead?: string;
  referenceNo: string;
  date: string;
  expenseFor?: string;
  incomeFor?: string;
  expenseForContact?: string;
  expenseForContactName?: string;
  incomeForContact?: string;
  document?: string;
  applicableTax: string;
  totalAmount: number;
  expenseNote?: string;
  incomeNote?: string;
  isRefund?: boolean;
  isRecurring: boolean;
  recurringInterval: string;
  entryType: 'expense' | 'income' | 'sale' | 'shipment' | 'payroll' | 'purchase';
  repetitions?: number;
  paymentAmount: number;
  paidOn: string;
  paymentMethod: string;
  paymentAccount?: string;
  paymentAccountName?: string;
  paymentNote?: string;
  addedBy?: string;
  addedByDisplayName?: string;
  source?: 'journal'; // To identify journal-created entries
  sourceId?: string;   // To store the journal document ID
}

@Injectable({
  providedIn: 'root'
})
export class ExpenseService {
  // ... (existing properties)

  private expensesCollection;
  private incomesCollection;
  private expenses = new BehaviorSubject<Expense[]>([]);
  private incomes = new BehaviorSubject<Expense[]>([]);

  constructor(
    private firestore: Firestore,
    private accountService: AccountService,
    private locationService: LocationService,
    private expenseCategoriesService: ExpenseCategoriesService
  ) {
    this.expensesCollection = collection(this.firestore, 'expenses');
    this.incomesCollection = collection(this.firestore, 'incomes');
    this.listenToExpenses();
    this.listenToIncomes();
  }

  // ... (existing methods like listenToExpenses, getExpenses, addExpense, etc. remain unchanged)

  /**
   * [NEW] Adds an expense or income record from a journal entry without creating new financial transactions.
   */
  async addJournalTransaction(data: Partial<Expense>, type: 'expense' | 'income'): Promise<void> {
    const collectionRef = type === 'expense' ? this.expensesCollection : this.incomesCollection;
    const processedData = {
        ...data,
        entryType: type,
        type: type,
        // Ensure required fields have defaults if not provided
        isRecurring: data.isRecurring || false,
        recurringInterval: data.recurringInterval || 'days',
        applicableTax: data.applicableTax || 'none'
    };
    await addDoc(collectionRef, processedData);
  }

  /**
   * [NEW] Deletes all expense and income records associated with a specific journal ID.
   */
  async deleteJournalTransactions(journalId: string): Promise<void> {
    const batch = writeBatch(this.firestore);

    // Query and delete from expenses
    const expensesQuery = query(this.expensesCollection, where('sourceId', '==', journalId));
    const expenseDocs = await getDocs(expensesQuery);
    expenseDocs.forEach(doc => batch.delete(doc.ref));

    // Query and delete from incomes
    const incomesQuery = query(this.incomesCollection, where('sourceId', '==', journalId));
    const incomeDocs = await getDocs(incomesQuery);
    incomeDocs.forEach(doc => batch.delete(doc.ref));

    await batch.commit();
  }
  
  // ... (rest of the existing methods in the service)
  private async resolveDocumentReferences(data: any, type: 'expense' | 'income'): Promise<any> {
    const resolvedData = { ...data };
    
    // Lazy load categories only when needed
    let allCategories: any[] | null = null;
    const getCategories = async () => {
        if (allCategories === null) {
            allCategories = await firstValueFrom(this.expenseCategoriesService.getCategories());
        }
        return allCategories;
    };

    if (type === 'expense' && resolvedData.expenseCategory) {
        const categories = await getCategories();
        const category = categories.find(cat => cat.id === resolvedData.expenseCategory);
        resolvedData.expenseCategoryName = category?.categoryName || 'Unknown Category';
        resolvedData.expenseType = category?.type || 'Expense';
    } else if (type === 'income' && resolvedData.incomeCategory) {
        const categories = await getCategories();
        const category = categories.find(cat => cat.id === resolvedData.incomeCategory);
        resolvedData.incomeCategoryName = category?.categoryName || 'Unknown Category';
        resolvedData.incomeType = category?.type || 'Income';
    }

    // Resolve other references as before...
    if (resolvedData.businessLocation) {
        const locations = await firstValueFrom(this.locationService.getLocations());
        const location = locations.find(loc => loc.id === resolvedData.businessLocation);
        resolvedData.businessLocationName = location?.name || '';
    }

    if (resolvedData.paymentAccount) {
        const account = await this.accountService.getAccountById(resolvedData.paymentAccount);
        const accountData = account instanceof Observable ? await firstValueFrom(account) : account;
        resolvedData.paymentAccountName = accountData?.name || '';
    }

    return resolvedData;
  }

  private listenToExpenses(): void {
    const q = query(this.expensesCollection, orderBy('date', 'desc'));

    onSnapshot(q, async (snapshot) => {
      const expensesPromises = snapshot.docs.map(doc => 
        this.resolveDocumentReferences({ id: doc.id, ...doc.data() }, 'expense')
      );
      const resolvedExpenses = await Promise.all(expensesPromises);
      this.expenses.next(resolvedExpenses);
    });
  }

  private listenToIncomes(): void {
    const q = query(this.incomesCollection, orderBy('date', 'desc'));

    onSnapshot(q, async (snapshot) => {
        const incomesPromises = snapshot.docs.map(doc => 
            this.resolveDocumentReferences({ id: doc.id, ...doc.data() }, 'income')
        );
        const resolvedIncomes = await Promise.all(incomesPromises);
        this.incomes.next(resolvedIncomes);
    });
  }

  getExpenses() {
    return this.expenses.asObservable();
  }

  getIncomes() {
    return this.incomes.asObservable();
  }

  async addExpense(expenseData: any): Promise<DocumentReference> {
    const accountId = expenseData.paymentAccount;
    const expenseAmount = Number(expenseData.paymentAmount) || 0;

    // If there's no payment involved, just save the expense record.
    if (!accountId || expenseAmount <= 0) {
      return await addDoc(this.expensesCollection, { ...expenseData, entryType: 'expense' });
    }

    try {
      // Use Firestore's `runTransaction` to ensure the balance check and write operations are atomic.
      const expenseDocRef = await runTransaction(this.firestore, async (transaction) => {
        
        // 1. Get the TRUE current balance using the reliable service method.
        const currentBalance = await this.accountService.getCalculatedBalance(accountId);

        // 2. Perform the critical balance check.
        if (currentBalance < expenseAmount) {
          // This is a safe failure. The transaction will abort.
          throw new Error(`Insufficient balance in account. Current: ₹${currentBalance.toFixed(2)}, Required: ₹${expenseAmount.toFixed(2)}`);
        }

        // 3. If the balance is sufficient, proceed to create the documents within the transaction.
        const newExpenseRef = doc(collection(this.firestore, 'expenses'));
        const newTransactionRef = doc(collection(this.firestore, 'transactions'));
        
        // Create the expense document
        transaction.set(newExpenseRef, {
            ...expenseData,
            entryType: 'expense',
            referenceNo: expenseData.referenceNo || this.generateReferenceNumber('EXP')
        });

        // Create the corresponding financial transaction document (the debit)
        transaction.set(newTransactionRef, {
            accountId: accountId,
            date: expenseData.paidOn || new Date(),
            createdAt: new Date(),
            description: `Expense: ${expenseData.expenseCategoryName || 'N/A'} - ${expenseData.expenseNote || ''}`,
            paymentMethod: expenseData.paymentMethod,
            debit: expenseAmount,
            credit: 0,
            amount: expenseAmount,
            reference: expenseData.referenceNo,
            relatedDocId: newExpenseRef.id,
            type: 'expense'
        });

        return newExpenseRef; // Return the reference from the transaction
      });

      return expenseDocRef;

    } catch (error) {
        console.error('Error in addExpense transaction:', error);
        // Re-throw the error so the component can catch it and show it to the user.
        throw error;
    }
  }
  async addIncome(incomeData: any): Promise<DocumentReference> {
      const processedData = {
          ...incomeData,
          taxAmount: Number(incomeData.taxAmount) || 0,
          entryType: 'income'
      };
      const docRef = await addDoc(this.incomesCollection, processedData);
      if (processedData.paymentAccount && processedData.paymentAmount) {
          await this.updateAccountBalance(processedData.paymentAccount, processedData.paymentAmount, docRef.id, 'income', processedData);
      }
      return docRef;
  }

  // No changes needed for the rest of the file...
  // ... (deleteExpense, updateTransaction, getExpenseById, etc. remain the same)
  deleteIncome(docId: string) {
    throw new Error('Method not implemented.');
  }
  uploadDocument(id: string, selectedFile: File) {
    throw new Error('Method not implemented.');
  }

private async processIncomeData(incomeData: any): Promise<any> {
    if (!incomeData.referenceNo) {
      incomeData.referenceNo = this.generateReferenceNumber('INC');
    }

    return {
      ...incomeData,
      type: 'income',
      entryType: incomeData.entryType || 'income',
      date: incomeData.date || new Date().toISOString(),
      taxAmount: incomeData.taxAmount || 0,
      paidOn: incomeData.paidOn || incomeData.date || new Date().toISOString(),
      paymentAmount: Number(incomeData.paymentAmount) || 0,
      totalAmount: Number(incomeData.totalAmount) || Number(incomeData.paymentAmount) || 0,
      isRecurring: incomeData.isRecurring || false,
      addedBy: incomeData.addedBy || 'System',
      addedByDisplayName: incomeData.addedByDisplayName || incomeData.addedBy || 'System'
    };
  }  private async recordIncomeTransaction(incomeData: any, docId: string): Promise<void> {
    try {
      await this.updateAccountBalance(
        incomeData.paymentAccount, 
        incomeData.paymentAmount,
        docId,
        'income',
        incomeData
      );
    } catch (error) {
      console.error('Error recording income transaction:', error);
      throw error;
    }
  }
  private async processExpenseForStorage(expenseData: any): Promise<any> {
    const storageData = {
      ...expenseData,
      businessLocation: expenseData.businessLocation,
      expenseCategory: expenseData.expenseCategory,
      incomeCategory: expenseData.incomeCategory,
      paymentAccount: expenseData.paymentAccount,
      expenseForContact: expenseData.expenseForContact,
          taxAmount: Number(expenseData.taxAmount) || 0,
    };
    delete storageData.businessLocationName;
    delete storageData.expenseCategoryName;
    delete storageData.incomeCategoryName;
    delete storageData.paymentAccountName;
    delete storageData.expenseForContactName;

    return storageData;
  }

  async getExpensesByDateRange(startDate: Date, endDate: Date): Promise<any[]> {
    const expensesCollection = collection(this.firestore, 'expenses');
    const q = query(
      expensesCollection,
      where('date', '>=', startDate),
      where('date', '<=', endDate)
    );
    
    const snapshot = await getDocs(q);
    return Promise.all(snapshot.docs.map(async doc => {
      const expenseData = doc.data();
      const resolvedData = await this.resolveDocumentReferences({
        id: doc.id,
        ...expenseData
      }, 'expense');
      return resolvedData;
    }));
  }

  async getIncomesByDateRange(startDate: Date, endDate: Date): Promise<any[]> {
    const incomesCollection = collection(this.firestore, 'incomes');
    const q = query(
      incomesCollection,
      where('date', '>=', startDate),
      where('date', '<=', endDate)
    );
    
    const snapshot = await getDocs(q);
    return Promise.all(snapshot.docs.map(async doc => {
      const incomeData = doc.data();
      const resolvedData = await this.resolveDocumentReferences({
        id: doc.id,
        ...incomeData
      }, 'income');
      return resolvedData;
    }));
  }

  private generateReferenceNumber(prefix: string): string {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${prefix}-${year}${month}${day}-${random}`;
  }

  getAllTransactions(): Observable<Expense[]> {
    return new BehaviorSubject([...this.expenses.value, ...this.incomes.value]).asObservable();
  }
  
  public async updateAccountBalance(
    accountId: string,
    amount: number,
    transactionId: string,
    type: 'expense' | 'income',
    transactionData: any,
    isUpdateOperation: boolean = false
  ): Promise<void> {
    try {
      if (!accountId) throw new Error('Account ID is required');
      if (typeof amount !== 'number' || isNaN(amount)) {
        throw new Error('Amount must be a valid number');
      }
      
      const accountDocRef = doc(this.firestore, 'accounts', accountId);
      const accountSnap = await getDoc(accountDocRef);
      
      if (!accountSnap.exists()) {
        throw new Error(`Account with ID ${accountId} not found`);
      }
      
      const accountData = accountSnap.data();
      const currentBalance = accountData['openingBalance'] || 0;
      let newBalance = currentBalance;
      const absoluteAmount = Math.abs(amount);

      if (type === 'expense') {
        newBalance = currentBalance - absoluteAmount;
        if (newBalance < 0) {
          throw new Error(`Insufficient balance in account ${accountId}`);
        }
      } else if (type === 'income') {
        newBalance = currentBalance + absoluteAmount;
      } else {
        throw new Error(`Invalid transaction type: ${type}`);
      }
      await updateDoc(accountDocRef, {
        openingBalance: newBalance
      });
      if (!isUpdateOperation) {
        const transactionsRef = collection(this.firestore, 'transactions');
        let categoryName = '';
        if (type === 'expense' && transactionData.expenseCategory) {
          categoryName = transactionData.expenseCategoryName || transactionData.expenseCategory;
        } else if (type === 'income' && transactionData.incomeCategory) {
          categoryName = transactionData.incomeCategoryName || transactionData.incomeCategory;
        }

        const transactionDataToSave = {
          accountId: accountId,
          date: transactionData.paidOn || new Date().toISOString(),
          createdAt: new Date(),
          category: categoryName || '',
          description: type === 'expense' ? 
            `Expense: ${categoryName} - ${transactionData.expenseNote || 'No description'}` :
            `Income: ${categoryName} - ${transactionData.incomeNote || 'No description'}`,
          paymentMethod: transactionData.paymentMethod,
          paymentDetails: '',
          note: type === 'expense' ? transactionData.expenseNote : transactionData.incomeNote,
          addedBy: transactionData.addedByDisplayName || transactionData.addedBy || 'System',
          debit: type === 'expense' ? absoluteAmount : 0,
          credit: type === 'income' ? absoluteAmount : 0,
          amount: absoluteAmount,
          reference: transactionData.referenceNo || transactionId,
          type: type,
          referenceId: transactionId,
          relatedDocId: transactionId,
          hasDocument: !!transactionData.document,
          attachmentUrl: transactionData.document || '',
          previousBalance: currentBalance,
          newBalance: newBalance
        };

        await addDoc(transactionsRef, transactionDataToSave);
      }

      console.log(`Account ${accountId} balance updated successfully from ${currentBalance} to ${newBalance}`);
    } catch (error) {
      console.error('Error in updateAccountBalance:', error);
      throw error;
    }
  }

  async deleteExpense(id: string): Promise<void> {
    try {
      await deleteDoc(doc(this.firestore, 'expenses', id));
    } catch (error) {
      console.error('Error deleting expense:', error);
      throw error;
    }
  }

  async deleteTransaction(id: string, type: 'expense' | 'income'): Promise<void> {
    try {
      await deleteDoc(doc(this.firestore, type === 'expense' ? 'expenses' : 'incomes', id));
    } catch (error) {
      console.error('Error deleting transaction:', error);
      throw error;
    }
  }

// In expense.service.ts - Replace the existing updateTransaction method
async updateTransaction(
  id: string,
  updatedTransaction: Partial<Expense>,
  originalType: 'expense' | 'income'
): Promise<void> {
  try {
    const originalDoc = await getDoc(
      doc(this.firestore, originalType === 'expense' ? 'expenses' : 'incomes', id)
    );
    if (!originalDoc.exists()) {
      throw new Error('Transaction not found');
    }

    const originalData = originalDoc.data() as Expense;
    const newType = updatedTransaction.type || originalType;
    
    if (originalData.paymentAccount && originalData.paymentAmount !== undefined) {
      const reverseAmount =
        originalType === 'expense' ? originalData.paymentAmount : -originalData.paymentAmount;

      await this.updateAccountBalance(
        originalData.paymentAccount,
        reverseAmount,
        id,
        originalType,
        originalData,
        true
      );
    }

    if (originalType !== newType) {
      await deleteDoc(doc(this.firestore, originalType === 'expense' ? 'expenses' : 'incomes', id));

      const paymentAmount = updatedTransaction.paymentAmount ?? originalData.paymentAmount ?? 0;

      const transactionToAdd: Expense = {
        ...originalData,
        ...updatedTransaction,
        paymentAmount,
        entryType: newType
      };

      let docRef: DocumentReference | string;

      if (newType === 'expense') {
        docRef = await this.addExpense(transactionToAdd);
      } else {
        docRef = await this.addIncome(transactionToAdd as any);
      }

      const newDocId = typeof docRef === 'string' ? docRef : (docRef as DocumentReference).id;

      if (updatedTransaction.paymentAccount && paymentAmount !== undefined) {
        const amount = newType === 'expense' ? -paymentAmount : paymentAmount;
        await this.updateAccountBalance(
          updatedTransaction.paymentAccount,
          amount,
          newDocId,
          newType,
          transactionToAdd
        );
      }
    } else {
      const processedUpdate = await this.processExpenseForStorage(updatedTransaction);
      const paymentAmount = processedUpdate.paymentAmount ?? originalData.paymentAmount;
      
      // Remove undefined values to prevent Firestore errors
      const updateData = {
        ...processedUpdate,
        entryType: newType,
        paymentAmount
      };
      
      // Create a clean object with proper typing for Firestore
      const cleanedUpdate: { [key: string]: any } = {};
      Object.entries(updateData).forEach(([key, value]) => {
        if (value !== undefined) {
          cleanedUpdate[key] = value;
        }
      });
      
      await updateDoc(
        doc(this.firestore, originalType === 'expense' ? 'expenses' : 'incomes', id),
        cleanedUpdate
      );

      if (cleanedUpdate['paymentAccount'] && paymentAmount !== undefined) {
        const newAmount = newType === 'expense' ? -paymentAmount : paymentAmount;

        await this.updateAccountBalance(
          cleanedUpdate['paymentAccount'] as string,
          newAmount,
          id,
          newType,
          cleanedUpdate
        );
      }
    }
  } catch (error) {
    console.error('Error updating transaction:', error);
    throw error;
  }
}
  async getExpenseById(id: string): Promise<Expense | null> {
    try {
      const snapshot = await getDoc(doc(this.firestore, 'expenses', id));
      if (snapshot.exists()) {
        const expenseData = snapshot.data() as Expense;
        const resolvedData = await this.resolveDocumentReferences({
          id: snapshot.id,
          ...expenseData
        }, 'expense');
        return { 
          ...resolvedData,
          type: 'expense' as const
        } as Expense;
      }
      return null;
    } catch (error) {
      console.error('Error getting expense by ID:', error);
      return null;
    }
  }

  async getIncomeById(id: string): Promise<Expense | null> {
    try {
      const snapshot = await getDoc(doc(this.firestore, 'incomes', id));
      if (snapshot.exists()) {
        const incomeData = snapshot.data() as Expense;
        const resolvedData = await this.resolveDocumentReferences({
          id: snapshot.id,
          ...incomeData
        }, 'income');
        return { 
          ...resolvedData,
          type: 'income' as const
        } as Expense;
      }
      return null;
    } catch (error) {
      console.error('Error getting income by ID:', error);
      return null;
    }
  }

  getExpenseByIdObservable(id: string): Observable<Expense | null> {
    return from(this.getExpenseById(id));
  }
  getExpensesByAccount(accountId: string, callback: (expenses: Expense[]) => void): () => void {
    const q = query(
      this.expensesCollection, 
      where('paymentAccount', '==', accountId),
      orderBy('date', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const expenses = await Promise.all(snapshot.docs.map(async doc => {
        const expenseData = doc.data() as Expense;
        const resolvedData = await this.resolveDocumentReferences({
          id: doc.id,
          ...expenseData
        }, 'expense');
        return {
          ...resolvedData,
          type: 'expense' as const
        };
      }));
      callback(expenses);
    });
    
    return unsubscribe;
  }

  getIncomesByAccount(accountId: string, callback: (incomes: Expense[]) => void): () => void {
    const q = query(
      this.incomesCollection, 
      where('paymentAccount', '==', accountId),
      orderBy('date', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const incomes = await Promise.all(snapshot.docs.map(async doc => {
        const incomeData = doc.data() as Expense;
        const resolvedData = await this.resolveDocumentReferences({
          id: doc.id,
          ...incomeData
        }, 'income');
        return {
          ...resolvedData,
          type: 'income' as const
        };
      }));
      callback(incomes);
    });
    
    return unsubscribe;
  }
  // src/app/services/expense.service.ts

// Add this new method inside the ExpenseService class
  
  async getAggregatedTotalsByDateRange(startDate: Date, endDate: Date): Promise<{
    directExpense: number;
    indirectExpense: number;
    operationalExpense: number;
    otherPurchases: number; // You may need to define this category
    directIncome: number;
    indirectIncome: number;
  }> {
    const totals = {
      directExpense: 0,
      indirectExpense: 0,
      operationalExpense: 0,
      otherPurchases: 0,
      directIncome: 0,
      indirectIncome: 0,
    };

    // Format dates to strings for querying, assuming 'YYYY-MM-DD' format in Firestore
    const startDateString = startDate.toISOString().split('T')[0];
    const endDateString = endDate.toISOString().split('T')[0];

    // Query Expenses
    const expenseQuery = query(
      this.expensesCollection,
      where('date', '>=', startDateString),
      where('date', '<=', endDateString)
    );
    const expenseSnapshot = await getDocs(expenseQuery);
    expenseSnapshot.forEach(doc => {
      const data = doc.data();
      const amount = Number(data['totalAmount']) || 0;
      switch (data['accountHead']) {
        case 'Expense|Direct Expense':
          totals.directExpense += amount;
          break;
        case 'Expense|Indirect Expense':
          totals.indirectExpense += amount;
          break;
        case 'Expense|Operational Expenses': // Ensure this matches your category value
          totals.operationalExpense += amount;
          break;
        // Add other expense cases as needed
      }
    });

    // Query Incomes
    const incomeQuery = query(
      this.incomesCollection,
      where('date', '>=', startDateString),
      where('date', '<=', endDateString)
    );
    const incomeSnapshot = await getDocs(incomeQuery);
    incomeSnapshot.forEach(doc => {
      const data = doc.data();
      const amount = Number(data['totalAmount']) || 0;
      switch (data['accountHead']) {
        case 'Income|Direct Income':
          totals.directIncome += amount;
          break;
        case 'Income|Indirect Income':
          totals.indirectIncome += amount;
          break;
        // Add other income cases as needed
      }
    });

    return totals;
  }
 async processPartialPayment(
    id: string,
    type: 'expense' | 'income',
    paymentData: {
      paymentAmount: number;
      paymentDate: string;
      paymentMethod: string;
      paymentAccount: string;
      paymentNote?: string;
    }
  ): Promise<void> {
    const expenseDocRef = doc(this.firestore, type === 'expense' ? 'expenses' : 'incomes', id);
    const accountDocRef = doc(this.firestore, 'accounts', paymentData.paymentAccount);

    try {
      await runTransaction(this.firestore, async (transaction) => {
        // Step 1: Get the current state of the expense and account documents atomically.
        const expenseDoc = await transaction.get(expenseDocRef);
        const accountDoc = await transaction.get(accountDocRef);

        if (!expenseDoc.exists()) {
          throw new Error(`${type} not found.`);
        }
        if (!accountDoc.exists()) {
          throw new Error('Payment account not found.');
        }

        const expenseData = expenseDoc.data() as Expense;
        const accountData = accountDoc.data();

        // Step 2: Perform the critical balance checks.
        const currentPaidAmount = expenseData.paymentAmount || 0;
        const totalAmount = (expenseData as any).finalAmount || expenseData.totalAmount || 0;
        const remainingBalanceDue = totalAmount - currentPaidAmount;
        const accountBalance = accountData['currentBalance'] || 0;

        // Check 2a: Ensure payment does not exceed the amount due.
        if (paymentData.paymentAmount > remainingBalanceDue) {
          throw new Error(`Payment amount (₹${paymentData.paymentAmount.toFixed(2)}) exceeds the remaining balance due (₹${remainingBalanceDue.toFixed(2)}).`);
        }
        
        // Check 2b: Ensure the selected account has sufficient funds.
        if (type === 'expense' && accountBalance < paymentData.paymentAmount) {
          throw new Error(`Insufficient funds in ${accountData['name']}. Available: ₹${accountBalance.toFixed(2)}, Required: ₹${paymentData.paymentAmount.toFixed(2)}`);
        }
        
        // Step 3: Prepare the updates.
        const newPaidAmount = currentPaidAmount + paymentData.paymentAmount;
        const newBalanceAmount = totalAmount - newPaidAmount;
        const newPaymentStatus = newBalanceAmount <= 0 ? 'Paid' : 'Partial';

        // Step 4: Queue up all write operations for the transaction.
        // Action 4a: Update the expense document.
        transaction.update(expenseDocRef, {
          paymentAmount: newPaidAmount,
          balanceAmount: newBalanceAmount,
          paymentStatus: newPaymentStatus
        });
        
        // Action 4b: Update the account balance.
        const newAccountBalance = type === 'expense' 
            ? accountBalance - paymentData.paymentAmount 
            : accountBalance + paymentData.paymentAmount;
        transaction.update(accountDocRef, { currentBalance: newAccountBalance });

        // Action 4c: Create a corresponding debit/credit transaction record.
        const newTransactionRef = doc(collection(this.firestore, 'transactions'));
        transaction.set(newTransactionRef, {
          accountId: paymentData.paymentAccount,
          date: new Date(paymentData.paymentDate),
          description: `Payment for ${type} #${expenseData.referenceNo}`,
          paymentMethod: paymentData.paymentMethod,
          debit: type === 'expense' ? paymentData.paymentAmount : 0,
          credit: type === 'income' ? paymentData.paymentAmount : 0,
          amount: paymentData.paymentAmount,
          reference: expenseData.referenceNo,
          relatedDocId: id,
          type: type,
          createdAt: new Date(),
        });
      });
    } catch (error) {
      console.error('Error processing partial payment transaction:', error);
      // Re-throw the error so the component can catch and display it.
      throw error;
    }
  }
}