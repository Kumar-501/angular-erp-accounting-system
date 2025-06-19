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
  where
} from '@angular/fire/firestore';
import { BehaviorSubject, from, Observable, firstValueFrom } from 'rxjs';
import { AccountService } from './account.service';
import { LocationService } from './location.service';
import { ExpenseCategoriesService } from './expense-categories.service';

export interface Expense {
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
  taxRate?: string; // Optional: if you want to store the tax rate separately
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
  entryType: 'expense' | 'income' | 'sale' | 'shipment' | 'payroll' | 'purchase'; // Add this

  repetitions?: number;
  paymentAmount: number;
  paidOn: string;
  paymentMethod: string;
  paymentAccount?: string;
  paymentAccountName?: string;
  paymentNote?: string;
  addedBy?: string;
  addedByDisplayName?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ExpenseService {
  deleteIncome(docId: string) {
    throw new Error('Method not implemented.');
  }
  uploadDocument(id: string, selectedFile: File) {
    throw new Error('Method not implemented.');
  }
  
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

  private async resolveDocumentReferences(expenseData: any): Promise<any> {
    try {
      // Resolve business location name
      if (expenseData.businessLocation) {
        try {
          const locations = await firstValueFrom(this.locationService.getLocations());
          const location = locations.find(loc => loc.id === expenseData.businessLocation);
          expenseData.businessLocationName = location?.name || '';
        } catch (error) {
          console.warn('Error resolving business location:', error);
          expenseData.businessLocationName = '';
        }
      }

      // Resolve expense category name
      if (expenseData.expenseCategory) {
        try {
          const categories = await firstValueFrom(this.expenseCategoriesService.getCategories());
          const category = categories.find(cat => cat.id === expenseData.expenseCategory);
          expenseData.expenseCategoryName = category?.categoryName || '';
          expenseData.expenseType = category?.type || '';
        } catch (error) {
          console.warn('Error resolving expense category:', error);
          expenseData.expenseCategoryName = '';
          expenseData.expenseType = '';
        }
      }

      // Resolve income category name
      if (expenseData.incomeCategory) {
        try {
          const categories = await firstValueFrom(this.expenseCategoriesService.getCategories());
          const category = categories.find(cat => cat.id === expenseData.incomeCategory);
          expenseData.incomeCategoryName = category?.categoryName || '';
          expenseData.incomeType = category?.type || '';
        } catch (error) {
          console.warn('Error resolving income category:', error);
          expenseData.incomeCategoryName = '';
          expenseData.incomeType = '';
        }
      }

      // Resolve payment account name
      if (expenseData.paymentAccount) {
        try {
          const account = await this.accountService.getAccountById(expenseData.paymentAccount);
          // Assuming getAccountById returns a Promise or Observable, handle accordingly
          if (account) {
            // If it's an Observable, convert to Promise
            const accountData = account instanceof Observable ? await firstValueFrom(account) : account;
            expenseData.paymentAccountName = accountData?.name || '';
          } else {
            expenseData.paymentAccountName = '';
          }
        } catch (error) {
          console.warn('Error resolving payment account:', error);
          expenseData.paymentAccountName = '';
        }
      }

      // Resolve expense for contact name (if applicable)
      if (expenseData.expenseForContact) {
        // You'll need to implement this based on how you store contacts
        // expenseData.expenseForContactName = await this.getContactName(expenseData.expenseForContact);
      }

      return expenseData;
    } catch (error) {
      console.error('Error in resolveDocumentReferences:', error);
      return expenseData;
    }
  }
private async processIncomeData(incomeData: any): Promise<any> {
    // Generate reference number if not provided
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
  }
  private async recordIncomeTransaction(incomeData: any, docId: string): Promise<void> {
    try {
      await this.accountService.recordTransaction(
        incomeData.paymentAccount,
        {
          amount: incomeData.paymentAmount,
          type: 'income',
          date: new Date(incomeData.paidOn || incomeData.date),
          reference: incomeData.referenceNo || docId,
          relatedDocId: docId,
          description: `Income: ${incomeData.incomeCategoryName || incomeData.incomeCategory} - ${incomeData.incomeNote || ''}`,
          category: incomeData.incomeCategoryName || incomeData.incomeCategory,
          paymentMethod: incomeData.paymentMethod
        }
      );
      
      // Update account balance
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
    // Convert to storage format (keep only IDs for references)
    const storageData = {
      ...expenseData,
      businessLocation: expenseData.businessLocation, // Keep ID
      expenseCategory: expenseData.expenseCategory, // Keep ID
      incomeCategory: expenseData.incomeCategory, // Keep ID
      paymentAccount: expenseData.paymentAccount, // Keep ID
      expenseForContact: expenseData.expenseForContact, // Keep ID
          taxAmount: Number(expenseData.taxAmount) || 0,

    };

    // Remove resolved names (they'll be resolved when read)
    delete storageData.businessLocationName;
    delete storageData.expenseCategoryName;
    delete storageData.incomeCategoryName;
    delete storageData.paymentAccountName;
    delete storageData.expenseForContactName;

    return storageData;
  }

private listenToExpenses(): void {
  const q = query(this.expensesCollection, orderBy('date', 'desc'));

  onSnapshot(q, async (snapshot) => {
    const expenses = await Promise.all(snapshot.docs.map(async doc => {
      const expenseData = doc.data() as Expense;

      // Pass only necessary fields to resolveDocumentReferences
      const resolvedData = await this.resolveDocumentReferences({
        id: doc.id,
        ...expenseData
      });

      // Return final expense object with type and entryType set
      return {
        ...resolvedData,
        type: 'expense' as const,
        entryType: 'expense' as const
      };
    }));

    // Update the observable/subject with the new expenses list
    this.expenses.next(expenses);
  });
}

private listenToIncomes(): void {
  const q = query(this.incomesCollection, orderBy('date', 'desc'));

  onSnapshot(q, async (snapshot) => {
    const incomes = await Promise.all(snapshot.docs.map(async doc => {
      const incomeData = doc.data() as Expense;

      // Don't include entryType here to avoid overwrite conflicts
      const resolvedData = await this.resolveDocumentReferences({
        id: doc.id,
        ...incomeData
      });

      return {
        ...resolvedData,
        type: 'income' as const,
        entryType: 'income' as const
      };
    }));

    this.incomes.next(incomes);
  });
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
      });
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
      });
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

  async addExpense(expenseData: any): Promise<DocumentReference> {
    try {
      // Check if already processed
      if (expenseData._processed) {
        console.warn('This expense has already been processed');
        throw new Error('Expense already processed');
      }
      
      // Mark as processed to prevent duplicate processing
      expenseData._processed = true;

      // Process the expense data for storage
      const storageData = await this.processExpenseForStorage(expenseData);
      
      // Generate reference number if not provided
      if (!storageData.referenceNo) {
        storageData.referenceNo = this.generateReferenceNumber('EXP');
      }

// In your addExpense method, modify the expense object creation:
const expense: Expense = {
  type: 'expense',
  businessLocation: storageData.businessLocation,
  expenseCategory: storageData.expenseCategory,
  subCategory: storageData.subCategory,
  expenseType: storageData.expenseType || '', // Get from resolved data
  accountHead: storageData.accountHead,
  referenceNo: storageData.referenceNo,
  date: storageData.date,
  applicableTax: storageData.applicableTax,
      taxAmount: Number(expenseData.taxAmount) || 0, 
  expenseFor: storageData.expenseFor,
  entryType: 'expense',
  expenseForContact: storageData.expenseForContact,
  document: storageData.document,


  totalAmount: Number(storageData.totalAmount),
  expenseNote: storageData.expenseNote,
  isRefund: storageData.isRefund || false,
  isRecurring: storageData.isRecurring || false,
  recurringInterval: storageData.recurringInterval || 'Days',
  repetitions: storageData.repetitions,
  paymentAmount: Number(storageData.paymentAmount),
  paidOn: storageData.paidOn,
  paymentMethod: storageData.paymentMethod,
  paymentAccount: storageData.paymentAccount,
  paymentNote: storageData.paymentNote,
  addedBy: storageData.addedBy,
  addedByDisplayName: storageData.addedByDisplayName
};

console.log('Adding expense to Firestore:', expense);
    const docRef = await addDoc(this.expensesCollection, expense);
      console.log('Adding expense to Firestore:', expense);
      console.log('Expense added successfully with ID:', docRef.id);
      
      // Record transaction in account book if payment account exists
      if (expense.paymentAccount && expense.paymentAmount) {
        await this.accountService.recordTransaction(
          expense.paymentAccount,
          {
            amount: expense.paymentAmount,
            type: 'expense',
            date: new Date(expense.paidOn || expense.date),
            reference: expense.referenceNo || docRef.id,
            relatedDocId: docRef.id,
            description: `Expense: ${expenseData.expenseCategoryName || expense.expenseCategory} - ${expense.expenseNote || ''}`,
            category: expenseData.expenseCategoryName || expense.expenseCategory,
            paymentMethod: expense.paymentMethod
          }
        );
        
        // Also update account balance (keeping existing functionality)
        await this.updateAccountBalance(
          expense.paymentAccount, 
          -expense.paymentAmount,
          docRef.id,
          'expense',
          expense
        );
      }
      
      return docRef;
    } catch (error) {
      console.error('Error adding expense:', error);
      // Clean up the _processed flag if there was an error
      if (expenseData) expenseData._processed = false;
      throw error;
    }
  }

   async addIncome(incomeData: any): Promise<string> {
    try {
      // Process and validate income data
      const processedData = await this.processIncomeData(incomeData);
      
      // Add to Firestore
      const docRef = await addDoc(this.incomesCollection, processedData);
      
      // Record transaction if payment account exists
      if (processedData.paymentAccount && processedData.paymentAmount) {
        await this.recordIncomeTransaction(processedData, docRef.id);
      }
      
      return docRef.id;
    } catch (error) {
      console.error('Error adding income:', error);
      throw error;
    }
  }


  getExpenses() {
    return this.expenses.asObservable();
  }

  getIncomes() {
    return this.incomes.asObservable();
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

      // Handle balance update based on transaction type
      if (type === 'expense') {
        // For expenses, subtract from balance
        newBalance = currentBalance - absoluteAmount;
        
        // Check for negative balance
        if (newBalance < 0) {
          throw new Error(`Insufficient balance in account ${accountId}`);
        }
      } else if (type === 'income') {
        // For incomes, add to balance
        newBalance = currentBalance + absoluteAmount;
      } else {
        throw new Error(`Invalid transaction type: ${type}`);
      }

      // Update the account balance
      await updateDoc(accountDocRef, {
        openingBalance: newBalance
      });

      // Only record a new transaction if this isn't part of an update operation
      if (!isUpdateOperation) {
        const transactionsRef = collection(this.firestore, 'transactions');
        
        const transactionDataToSave = {
          accountId: accountId,
          date: transactionData.paidOn || new Date().toISOString(),
          description: type === 'expense' ? 
            `Expense: ${transactionData.expenseNote || 'No description'}` :
            `Income: ${transactionData.incomeNote || 'No description'}`,
          paymentMethod: transactionData.paymentMethod,
          paymentDetails: '',
          note: type === 'expense' ? transactionData.expenseNote : transactionData.incomeNote,
          addedBy: transactionData.addedByDisplayName || transactionData.addedBy || 'System',
          debit: type === 'expense' ? absoluteAmount : 0,
          credit: type === 'income' ? absoluteAmount : 0,
          type: type,
          referenceId: transactionId,
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

    // Reverse the original transaction from account balance
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
      // Delete original and create new transaction
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
        docRef = await this.addIncome(transactionToAdd);
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
      // Same type: update directly
      const processedUpdate = await this.processExpenseForStorage(updatedTransaction);

      const paymentAmount = processedUpdate.paymentAmount ?? originalData.paymentAmount;
      const finalTransaction = {
        ...processedUpdate,
        entryType: newType,
        paymentAmount
      };

      await updateDoc(
        doc(this.firestore, originalType === 'expense' ? 'expenses' : 'incomes', id),
        finalTransaction
      );

      if (finalTransaction.paymentAccount && paymentAmount !== undefined) {
        const newAmount = newType === 'expense' ? -paymentAmount : paymentAmount;

        await this.updateAccountBalance(
          finalTransaction.paymentAccount,
          newAmount,
          id,
          newType,
          finalTransaction
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
        });
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
        });
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

  // Add this method to your ExpenseService class
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
        });
        return {
          ...resolvedData,
          type: 'expense' as const
        };
      }));
      callback(expenses);
    });
    
    return unsubscribe;
  }

  // Similarly, add this method for incomes by account
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
        });
        return {
          ...resolvedData,
          type: 'income' as const
        };
      }));
      callback(incomes);
    });
    
    return unsubscribe;
  }

  async getTransactionById(id: string, type: 'expense' | 'income'): Promise<Expense | null> {
    if (type === 'expense') {
      return this.getExpenseById(id);
    } else {
      return this.getIncomeById(id);
    }
  }

  getTransactionByIdObservable(id: string, type: 'expense' | 'income'): Observable<Expense | null> {
    return from(this.getTransactionById(id, type));
  }
}