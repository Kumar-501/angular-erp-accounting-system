import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  Timestamp,
  orderBy,
  limit,
  getDoc,
  CollectionReference,
  DocumentData
} from '@angular/fire/firestore';
import { Observable, from, map } from 'rxjs';
import { AccountService } from './account.service';
import { Expense, ExpenseService } from './expense.service';

// Interface for a single line item in a journal (debit/credit)
export interface JournalItem {
  accountId: string;
  accountName: string;
  accountType: string;
  accountHead?: string;
  debit: number;
  credit: number;
}

// Interface for the file attachment
export interface JournalAttachment {
  name: string;
  type: string;
  data: string; // Base64 encoded data URL
}

// Interface for the entire journal entry
export interface Journal {
  id?: string;
  date: Timestamp;
  reference: string;
  description: string;
  items: JournalItem[];
  totalAmount: number;
  isCapitalTransaction?: boolean;
  attachment?: JournalAttachment;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

@Injectable({
  providedIn: 'root'
})
export class JournalService {
  private readonly journalsCollection: CollectionReference<DocumentData>;
  private readonly transactionsCollection: CollectionReference<DocumentData>;

  constructor(
    private firestore: Firestore,
    private accountService: AccountService,
    private expenseService: ExpenseService
  ) {
    this.journalsCollection = collection(this.firestore, 'journals');
    this.transactionsCollection = collection(this.firestore, 'transactions');
  }

  // Generate a new reference number (e.g., JRN-0005)
  async getNewReferenceNumber(): Promise<string> {
    const q = query(this.journalsCollection, orderBy('createdAt', 'desc'), limit(1));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      return 'JRN-0001';
    }
    const lastRef = querySnapshot.docs[0].data()['reference'] || 'JRN-0000';
    const lastNum = parseInt(lastRef.split('-')[1], 10);
    const newNum = lastNum + 1;
    return `JRN-${String(newNum).padStart(4, '0')}`;
  }

  // Get all journal entries
  getJournals(): Observable<Journal[]> {
    return from(getDocs(this.journalsCollection)).pipe(
      map(snapshot =>
        snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Journal))
      )
    );
  }

  // Get a single journal entry by its ID
  getJournalById(id: string): Observable<Journal | null> {
    const journalDocRef = doc(this.firestore, 'journals', id);
    return from(getDoc(journalDocRef)).pipe(
      map(docSnap => {
        if (docSnap.exists()) {
          return { id: docSnap.id, ...docSnap.data() } as Journal;
        }
        return null;
      })
    );
  }

  /**
   * Fetches transactions created from journal entries within a specific date range.
   */
  async getTransactionsByDateRange(startDate: Date, endDate: Date): Promise<DocumentData[]> {
    const transactionsRef = collection(this.firestore, 'transactions');
    const q = query(
      transactionsRef,
      where('source', '==', 'journal'),
      where('date', '>=', startDate),
      where('date', '<=', endDate)
    );

    try {
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => doc.data());
    } catch (error) {
      console.error("Error fetching journal transactions by date:", error);
      return [];
    }
  }

  /**
   * Fetches and aggregates income/expense data from journals for reports within a specified date range.
   */
  async getJournalAggregatesByDateRange(startDate: Date, endDate: Date): Promise<{
    directIncome: number;
    indirectIncome: number;
    directExpense: number;
    indirectExpense: number;
    operationalExpense: number;
  }> {
    const aggregates = {
      directIncome: 0,
      indirectIncome: 0,
      directExpense: 0,
      indirectExpense: 0,
      operationalExpense: 0,
    };

    const q = query(
      this.journalsCollection,
      where('date', '>=', Timestamp.fromDate(startDate)),
      where('date', '<=', Timestamp.fromDate(endDate))
    );

    try {
      const querySnapshot = await getDocs(q);
      querySnapshot.forEach(doc => {
        const journal = doc.data() as Journal;
        journal.items.forEach((item: JournalItem) => {
          if (item.accountType === 'income_category') {
            if (item.accountHead === 'Income|Direct Income') {
              aggregates.directIncome += item.credit;
            } else if (item.accountHead === 'Income|Indirect Income') {
              aggregates.indirectIncome += item.credit;
            }
          } else if (item.accountType === 'expense_category') {
            if (item.accountHead === 'Expense|Direct Expense') {
              aggregates.directExpense += item.debit;
            } else if (item.accountHead === 'Expense|Indirect Expense') {
              aggregates.indirectExpense += item.debit;
            } else if (item.accountHead === 'Expense|Operational Expense') {
              aggregates.operationalExpense += item.debit;
            }
          }
        });
      });
    } catch (error) {
      console.error("Error fetching journal aggregates for Trial Balance:", error);
    }

    return aggregates;
  }
  
  // ======================= THE FIX =======================
  // This method's logic is now corrected to be based on the journal's context.
  /**
   * Fetches and aggregates only the TAX amounts from journals for the Balance Sheet.
   */
  async getJournalTaxAggregatesByDateRange(startDate: Date, endDate: Date): Promise<{
    journalInputTax: number;
    journalOutputTax: number;
  }> {
    const aggregates = {
      journalInputTax: 0,
      journalOutputTax: 0,
    };

    const q = query(
      this.journalsCollection,
      where('date', '>=', Timestamp.fromDate(startDate)),
      where('date', '<=', Timestamp.fromDate(endDate))
    );

    try {
      const querySnapshot = await getDocs(q);
      querySnapshot.forEach(doc => {
        const journal = doc.data() as Journal;

        // First, determine the context of the entire journal entry
        const isExpenseJournal = journal.items.some(item => item.accountType === 'expense_category');
        const isIncomeJournal = journal.items.some(item => item.accountType === 'income_category');

        // Now, process the tax item based on that context
        journal.items.forEach((item: JournalItem) => {
          if (item.accountType === 'tax_rate') {
            // Get the tax amount, regardless of whether it was debited or credited
            const taxAmount = Math.max(item.debit, item.credit);

            if (isExpenseJournal) {
              // If the journal contains an expense, this tax is an Input Tax Credit.
              aggregates.journalInputTax += taxAmount;
            } else if (isIncomeJournal) {
              // If the journal contains an income, this tax is an Output Tax Payable.
              aggregates.journalOutputTax += taxAmount;
            }
          }
        });
      });
    } catch (error) {
      console.error("Error fetching journal tax aggregates for Balance Sheet:", error);
    }

    return aggregates;
  }
  // ===================== END OF THE FIX ====================

  // Add a new journal entry and create corresponding transactions
  async addJournal(journalData: Omit<Journal, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
    const batch = writeBatch(this.firestore);
    const now = Timestamp.now();
    const journalRef = doc(this.journalsCollection);

    batch.set(journalRef, {
      ...journalData,
      createdAt: now,
      updatedAt: now,
    });

    const affectedAccountIds = new Set<string>();

    journalData.items.forEach(item => {
      if (item.debit > 0 || item.credit > 0) {
        const transactionRef = doc(this.transactionsCollection);
        let transactionType = 'journal_entry';
        if (item.accountType === 'tax_rate') {
            // This logic is now only for classification, not for balance sheet calculation
            if (item.debit > 0) transactionType = 'input_tax';
            else if (item.credit > 0) transactionType = 'output_tax';
        }
        batch.set(transactionRef, {
          accountId: item.accountId,
          accountName: item.accountName,
          date: journalData.date,
          referenceNo: journalData.reference,
          description: `Journal: ${journalData.reference} - ${journalData.description}`,
          debit: item.debit,
          credit: item.credit,
          relatedDocId: journalRef.id,
          source: 'journal',
          type: transactionType,
          accountType: item.accountType,
          accountHead: item.accountHead || null,
          isCapitalTransaction: journalData.isCapitalTransaction || false,
          createdAt: now
        });
        if (item.accountType === 'account') {
          affectedAccountIds.add(item.accountId);
        }
      }
    });

    await batch.commit();
    await this.syncExpensesFromJournal(journalData, journalRef.id);
    for (const accountId of affectedAccountIds) {
      await this.accountService.recalculateAndSaveBalance(accountId);
    }
  }

  // Update a journal entry and its corresponding transactions
  async updateJournal(journalId: string, journalData: Partial<Journal>): Promise<void> {
    const batch = writeBatch(this.firestore);
    const journalRef = doc(this.firestore, 'journals', journalId);

    await this.expenseService.deleteJournalTransactions(journalId);

    const oldTransactionsQuery = query(this.transactionsCollection, where('relatedDocId', '==', journalId));
    const oldTransactionsSnapshot = await getDocs(oldTransactionsQuery);

    const affectedAccountIds = new Set<string>();
    const oldJournalSnap = await getDoc(journalRef);
    if (oldJournalSnap.exists()) {
      const oldJournal = oldJournalSnap.data() as Journal;
      oldJournal.items.forEach(item => {
        if (item.accountType === 'account') {
          affectedAccountIds.add(item.accountId);
        }
      });
    }

    oldTransactionsSnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });

    batch.update(journalRef, {
      ...journalData,
      updatedAt: Timestamp.now()
    });

    if (journalData.items && journalData.reference) {
      const reference = journalData.reference;
      journalData.items.forEach(item => {
        if (item.debit > 0 || item.credit > 0) {
          const transactionRef = doc(this.transactionsCollection);
          let transactionType = 'journal_entry';
          if (item.accountType === 'tax_rate') {
            if (item.debit > 0) transactionType = 'input_tax';
            else if (item.credit > 0) transactionType = 'output_tax';
          }
          batch.set(transactionRef, {
            accountId: item.accountId,
            accountName: item.accountName,
            date: journalData.date || Timestamp.now(),
            referenceNo: reference,
            description: `Journal: ${reference} - ${journalData.description}`,
            debit: item.debit,
            credit: item.credit,
            relatedDocId: journalId,
            source: 'journal',
            type: transactionType,
            accountType: item.accountType,
            accountHead: item.accountHead || null,
            isCapitalTransaction: journalData.isCapitalTransaction || false,
            createdAt: Timestamp.now()
          });
          if (item.accountType === 'account') {
            affectedAccountIds.add(item.accountId);
          }
        }
      });
    }

    await batch.commit();
    await this.syncExpensesFromJournal(journalData, journalId);
    for (const accountId of affectedAccountIds) {
      await this.accountService.recalculateAndSaveBalance(accountId);
    }
  }

  async deleteJournal(journalId: string): Promise<void> {
    const batch = writeBatch(this.firestore);
    const journalRef = doc(this.firestore, 'journals', journalId);

    await this.expenseService.deleteJournalTransactions(journalId);

    const journalDoc = await getDoc(journalRef);
    if (!journalDoc.exists()) return;
    const journalData = journalDoc.data() as Journal;

    const transactionsQuery = query(this.transactionsCollection, where('relatedDocId', '==', journalId));
    const transactionsSnapshot = await getDocs(transactionsQuery);

    const affectedAccountIds = new Set<string>();
    journalData.items.forEach(item => {
      if (item.accountType === 'account') {
        affectedAccountIds.add(item.accountId);
      }
    });

    transactionsSnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });

    batch.delete(journalRef);

    await batch.commit();

    for (const accountId of affectedAccountIds) {
      await this.accountService.recalculateAndSaveBalance(accountId);
    }
  }

  private async syncExpensesFromJournal(journalData: any, journalId: string): Promise<void> {
    const paymentItems = journalData.items.filter((i: JournalItem) => i.accountType === 'account');
    const primaryPaymentAccount = paymentItems.length > 0 ? paymentItems[0] : null;

    for (const item of journalData.items) {
      const date = (journalData.date as Timestamp).toDate().toISOString();

      const baseData: Partial<Expense> = {
        source: 'journal',
        sourceId: journalId,
        referenceNo: journalData.reference,
        date: date,
        expenseNote: journalData.description,
        incomeNote: journalData.description,
        paymentMethod: 'Journal Entry',
        paymentStatus: 'Paid',
        paidOn: date,
        balanceAmount: 0,
        businessLocation: '',
        paymentAccount: primaryPaymentAccount?.accountId || null,
      };

      if (item.accountType === 'expense_category' && item.debit > 0) {
        const expenseData: Partial<Expense> = {
          ...baseData,
          expenseCategory: item.accountId,
          accountHead: item.accountHead,
          totalAmount: item.debit,
          paymentAmount: item.debit,
          expenseFor: journalData.description,
        };
        await this.expenseService.addJournalTransaction(expenseData, 'expense');

      } else if (item.accountType === 'income_category' && item.credit > 0) {
        const incomeData: Partial<Expense> = {
          ...baseData,
          incomeCategory: item.accountId,
          accountHead: item.accountHead,
          totalAmount: item.credit,
          paymentAmount: item.credit,
          incomeFor: journalData.description,
        };
        await this.expenseService.addJournalTransaction(incomeData, 'income');
      }
    }
  }
}