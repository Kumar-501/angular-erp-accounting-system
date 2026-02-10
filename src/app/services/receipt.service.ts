// src/app/services/receipt.service.ts

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

// Interface for a single line item in a receipt's journal entry
export interface JournalItem {
  accountId: string;
  accountName: string;
  accountType: string;
  accountHead?: string;
  debit: number;
  credit: number;
}

// Interface for the file attachment
export interface ReceiptAttachment {
  name: string;
  type: string;
  data: string;
}

// Interface for a single receipt
export interface Receipt {
  id?: string;
  date: Timestamp;
  referenceNo: string;
  description: string;
  items: JournalItem[];
  totalAmount: number; 
  status: 'Posted' | 'Pending';
  attachment?: ReceiptAttachment;
  createdAt: Timestamp;
}

@Injectable({
  providedIn: 'root'
})
export class ReceiptService {
  private readonly receiptsCollection: CollectionReference<DocumentData>;
  private readonly transactionsCollection: CollectionReference<DocumentData>;

  constructor(
    private firestore: Firestore,
    private accountService: AccountService
  ) {
    this.receiptsCollection = collection(this.firestore, 'receipts');
    this.transactionsCollection = collection(this.firestore, 'transactions');
  }

  async getNewReferenceNumber(): Promise<string> {
    const q = query(this.receiptsCollection, orderBy('createdAt', 'desc'), limit(1));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      return 'REF001';
    }
    const lastRef = querySnapshot.docs[0].data()['referenceNo'] || 'REF000';
    const lastNum = parseInt(lastRef.replace('REF', ''), 10);
    const newNum = lastNum + 1;
    return `REF${String(newNum).padStart(3, '0')}`;
  }

  getReceipts(): Observable<Receipt[]> {
    return from(getDocs(query(this.receiptsCollection, orderBy('date', 'desc')))).pipe(
      map(snapshot =>
        snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Receipt))
      )
    );
  }

  /**
   * [FIXED] Fetches and aggregates income/expense data, including operational expenses.
   */
  async getReceiptAggregatesByDateRange(startDate: Date, endDate: Date): Promise<{
    directIncome: number;
    indirectIncome: number;
    directExpense: number;
    indirectExpense: number;
    operationalExpense: number; // [ADDED]
  }> {
    const aggregates = {
      directIncome: 0,
      indirectIncome: 0,
      directExpense: 0,
      indirectExpense: 0,
      operationalExpense: 0, // [ADDED]
    };

    const q = query(
      this.receiptsCollection,
      where('date', '>=', Timestamp.fromDate(startDate)),
      where('date', '<=', Timestamp.fromDate(endDate)),
      where('status', '==', 'Posted')
    );

    try {
      const querySnapshot = await getDocs(q);
      querySnapshot.forEach(doc => {
        const receipt = doc.data() as Receipt;
        receipt.items.forEach((item: JournalItem) => {
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
            } else if (item.accountHead === 'Expense|Operational Expense') { // [ADDED]
              aggregates.operationalExpense += item.debit;
            }
          }
        });
      });
    } catch (error) {
      console.error("Error fetching receipt aggregates for reports:", error);
    }

    return aggregates;
  }

  async addReceipt(receiptData: Omit<Receipt, 'id' | 'createdAt'>): Promise<void> {
    const batch = writeBatch(this.firestore);
    const now = Timestamp.now();
    const receiptRef = doc(this.receiptsCollection);

    batch.set(receiptRef, { ...receiptData, createdAt: now });

    const affectedAccountIds = new Set<string>();

    if (receiptData.status === 'Posted') {
      receiptData.items.forEach(item => {
        if (item.debit > 0 || item.credit > 0) {
          const transactionRef = doc(this.transactionsCollection);
          let transactionType = 'income';
          if (item.accountType === 'tax_rate') {
            if (item.debit > 0) transactionType = 'input_tax';
            if (item.credit > 0) transactionType = 'output_tax';
          } else if (item.accountType === 'expense_category') {
              transactionType = 'expense';
          }
          batch.set(transactionRef, {
            accountId: item.accountId,
            date: receiptData.date,
            description: `Receipt: ${receiptData.referenceNo} - ${receiptData.description}`,
            debit: item.debit,
            credit: item.credit,
            relatedDocId: receiptRef.id, 
            source: 'receipt',
            type: transactionType,
            accountType: item.accountType,
            accountHead: item.accountHead || null, 
            createdAt: now
          });
          if (item.accountType === 'account') {
              affectedAccountIds.add(item.accountId);
          }
        }
      });
    }
    await batch.commit();
    for (const accountId of affectedAccountIds) {
      await this.accountService.recalculateAndSaveBalance(accountId);
    }
  }

  async updateReceipt(receiptId: string, receiptData: Partial<Receipt>): Promise<void> {
    const batch = writeBatch(this.firestore);
    const receiptRef = doc(this.firestore, 'receipts', receiptId);

    const oldTransactionsQuery = query(this.transactionsCollection, where('relatedDocId', '==', receiptId));
    const oldTransactionsSnapshot = await getDocs(oldTransactionsQuery);
    
    const affectedAccountIds = new Set<string>();
    oldTransactionsSnapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data['accountType'] === 'account') {
            affectedAccountIds.add(data['accountId']);
        }
        batch.delete(docSnap.ref);
    });

    batch.update(receiptRef, receiptData);

    if (receiptData.status === 'Posted' && receiptData.items && receiptData.date && receiptData.referenceNo && receiptData.description) {
      receiptData.items.forEach(item => {
        if (item.debit > 0 || item.credit > 0) {
          const transactionRef = doc(this.transactionsCollection);
          let transactionType = 'income';
          if (item.accountType === 'tax_rate') {
            if (item.debit > 0) transactionType = 'input_tax';
            if (item.credit > 0) transactionType = 'output_tax';
          } else if (item.accountType === 'expense_category') {
              transactionType = 'expense';
          }
          batch.set(transactionRef, {
            accountId: item.accountId,
            date: receiptData.date,
            description: `Receipt: ${receiptData.referenceNo} - ${receiptData.description}`,
            debit: item.debit,
            credit: item.credit,
            relatedDocId: receiptId,
            source: 'receipt',
            type: transactionType,
            accountType: item.accountType,
            accountHead: item.accountHead || null,
            createdAt: Timestamp.now()
          });
          if (item.accountType === 'account') {
              affectedAccountIds.add(item.accountId);
          }
        }
      });
    }
    await batch.commit();
    for (const accountId of affectedAccountIds) {
      await this.accountService.recalculateAndSaveBalance(accountId);
    }
  }

  async deleteReceipt(receiptId: string): Promise<void> {
    const batch = writeBatch(this.firestore);
    const receiptRef = doc(this.firestore, 'receipts', receiptId);

    const transactionsQuery = query(this.transactionsCollection, where('relatedDocId', '==', receiptId));
    const transactionsSnapshot = await getDocs(transactionsQuery);
    
    const affectedAccountIds = new Set<string>();
    transactionsSnapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data['accountType'] === 'account') {
            affectedAccountIds.add(data['accountId']);
        }
        batch.delete(docSnap.ref);
    });

    batch.delete(receiptRef);
    await batch.commit();
    for (const accountId of affectedAccountIds) {
        await this.accountService.recalculateAndSaveBalance(accountId);
    }
  }
}