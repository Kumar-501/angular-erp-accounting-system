// src/app/services/pay.service.ts

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
  CollectionReference,
  DocumentData,
  getDoc
} from '@angular/fire/firestore';
import { Observable, from, map } from 'rxjs';
import { AccountService } from './account.service';

// Interface for a single line item in a payment journal
export interface JournalItem {
  accountId: string;
  accountName: string;
  accountType: string;
  accountHead?: string; // [ADDED] To store if it's direct/indirect etc.
  debit: number;
  credit: number;
}

// Interface for the file attachment
export interface PaymentAttachment {
  name: string;
  type: string;
  data: string; // Base64 encoded data URL
}

// Interface for a single payment transaction
export interface Payment {
  id?: string;
  date: Timestamp;
  referenceNo: string;
  description: string;
  items: JournalItem[];
  totalAmount: number;
  status: 'Posted' | 'Pending';
  attachment?: PaymentAttachment;
  createdAt: Timestamp;
}

@Injectable({
  providedIn: 'root'
})
export class PayService {
  private readonly paymentsCollection: CollectionReference<DocumentData>;
  private readonly transactionsCollection: CollectionReference<DocumentData>;

  constructor(
    private firestore: Firestore,
    private accountService: AccountService
  ) {
    this.paymentsCollection = collection(this.firestore, 'payments');
    this.transactionsCollection = collection(this.firestore, 'transactions');
  }

  async getNewReferenceNumber(): Promise<string> {
    const q = query(this.paymentsCollection, orderBy('createdAt', 'desc'), limit(1));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      return 'PAY-001';
    }
    const lastRef = querySnapshot.docs[0].data()['referenceNo'] || 'PAY-000';
    const lastNum = parseInt(lastRef.split('-')[1], 10);
    const newNum = lastNum + 1;
    return `PAY-${String(newNum).padStart(3, '0')}`;
  }

  getPayments(): Observable<Payment[]> {
    const q = query(
      this.paymentsCollection,
      orderBy('createdAt', 'desc')
    );
    return from(getDocs(q)).pipe(
      map(snapshot =>
        snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment))
      )
    );
  }

  /**
   * [ADDED] Fetches and aggregates income/expense data from payments for reports.
   */
  async getPaymentAggregatesByDateRange(startDate: Date, endDate: Date): Promise<{
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
      this.paymentsCollection,
      where('date', '>=', Timestamp.fromDate(startDate)),
      where('date', '<=', Timestamp.fromDate(endDate)),
      where('status', '==', 'Posted')
    );

    try {
      const querySnapshot = await getDocs(q);
      querySnapshot.forEach(doc => {
        const payment = doc.data() as Payment;
        payment.items.forEach((item: JournalItem) => {
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
      console.error("Error fetching payment aggregates:", error);
    }
    return aggregates;
  }

  async addPayment(paymentData: Omit<Payment, 'id' | 'createdAt'>): Promise<void> {
    const batch = writeBatch(this.firestore);
    const now = Timestamp.now();
    const paymentRef = doc(this.paymentsCollection);

    batch.set(paymentRef, { ...paymentData, createdAt: now });

    const affectedAccountIds = new Set<string>();
    
    if (paymentData.status === 'Posted') {
      paymentData.items.forEach(item => {
        if (item.debit > 0 || item.credit > 0) {
          const transactionRef = doc(this.transactionsCollection);
          
          let transactionType = 'expense';
          if (item.accountType === 'tax_rate') {
              if (item.debit > 0) transactionType = 'input_tax';
              if (item.credit > 0) transactionType = 'output_tax';
          } else if (item.accountType === 'income_category') {
              transactionType = 'income';
          }

          batch.set(transactionRef, {
            accountId: item.accountId,
            date: paymentData.date,
            description: `Payment: ${paymentData.referenceNo} - ${paymentData.description}`,
            debit: item.debit,
            credit: item.credit,
            relatedDocId: paymentRef.id,
            source: 'payment',
            type: transactionType,
            accountType: item.accountType,
            accountHead: item.accountHead || null, // [MODIFIED] Save accountHead
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

  async updatePayment(paymentId: string, paymentData: Partial<Payment>): Promise<void> {
    const batch = writeBatch(this.firestore);
    const paymentRef = doc(this.firestore, 'payments', paymentId);
    
    const oldTransactionsQuery = query(this.transactionsCollection, where('relatedDocId', '==', paymentId));
    const oldTransactionsSnapshot = await getDocs(oldTransactionsQuery);
    
    const affectedAccountIds = new Set<string>();
    oldTransactionsSnapshot.forEach(doc => {
        if (doc.data()['accountType'] === 'account') {
            affectedAccountIds.add(doc.data()['accountId']);
        }
        batch.delete(doc.ref);
    });

    batch.update(paymentRef, { ...paymentData, updatedAt: Timestamp.now() });

    if (paymentData.status === 'Posted' && paymentData.items) {
      paymentData.items.forEach(item => {
        if (item.debit > 0 || item.credit > 0) {
          const transactionRef = doc(this.transactionsCollection);

          let transactionType = 'expense';
          if (item.accountType === 'tax_rate') {
              if (item.debit > 0) transactionType = 'input_tax';
              if (item.credit > 0) transactionType = 'output_tax';
          } else if (item.accountType === 'income_category') {
              transactionType = 'income';
          }

          batch.set(transactionRef, {
            accountId: item.accountId,
            date: paymentData.date || Timestamp.now(),
            description: `Payment: ${paymentData.referenceNo} - ${paymentData.description}`,
            debit: item.debit,
            credit: item.credit,
            relatedDocId: paymentId,
            source: 'payment',
            type: transactionType,
            accountType: item.accountType,
            accountHead: item.accountHead || null, // [MODIFIED] Save accountHead
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

  async deletePayment(paymentId: string): Promise<void> {
    const batch = writeBatch(this.firestore);
    const paymentRef = doc(this.firestore, 'payments', paymentId);

    const transactionsQuery = query(this.transactionsCollection, where('relatedDocId', '==', paymentId));
    const transactionsSnapshot = await getDocs(transactionsQuery);
    
    const affectedAccountIds = new Set<string>();
    transactionsSnapshot.forEach(doc => {
        if (doc.data()['accountType'] === 'account') {
            affectedAccountIds.add(doc.data()['accountId']);
        }
        batch.delete(doc.ref);
    });

    batch.delete(paymentRef);
    await batch.commit();

    for (const accountId of affectedAccountIds) {
        await this.accountService.recalculateAndSaveBalance(accountId);
    }
  }
}