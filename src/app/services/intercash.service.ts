// src/app/services/intercash.service.ts

import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  getDocs,
  addDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  Timestamp,
  orderBy,
  limit,
  CollectionReference,
  DocumentData
} from '@angular/fire/firestore';
import { Observable, from, map } from 'rxjs';
import { AccountService } from './account.service';

// Interface for a debit or credit line item
export interface TransferItem {
  accountId: string;
  accountName: string;
  amount: number;
}

// NEW: Interface for the file attachment, consistent with other modules
export interface TransferAttachment {
  name: string;
  type: string;
  data: string; // Base64 encoded data URL
}

// Interface for the entire transfer voucher
export interface InterCashTransfer {
  id?: string;
  voucherNo: string;
  date: Timestamp;
  narration: string;
  debits: TransferItem[];  // "Deposited In" accounts
  credits: TransferItem[]; // "Paid From" accounts
  totalAmount: number;
  attachment?: TransferAttachment; // MODIFIED: Changed from attachmentUrl to a structured object
  createdAt: Timestamp;
}

@Injectable({
  providedIn: 'root'
})
export class IntercashService {
  private readonly transfersCollection: CollectionReference<DocumentData>;
  private readonly transactionsCollection: CollectionReference<DocumentData>;

  constructor(
    private firestore: Firestore,
    private accountService: AccountService
  ) {
    this.transfersCollection = collection(this.firestore, 'interCashTransfers');
    this.transactionsCollection = collection(this.firestore, 'transactions');
  }

  /**
   * Generates a new voucher number based on the last entry for the current fiscal year.
   * Example: C-1/2025-2026
   */
  async getNewVoucherNumber(): Promise<string> {
    const q = query(this.transfersCollection, orderBy('createdAt', 'desc'), limit(1));
    const querySnapshot = await getDocs(q);
    
    const today = new Date();
    const currentYear = today.getFullYear();
    const nextYear = currentYear + 1;
    const fiscalYear = `${currentYear}-${nextYear}`;

    if (querySnapshot.empty) {
      return `C-1/${fiscalYear}`;
    }
    
    const lastVoucher = querySnapshot.docs[0].data()['voucherNo'] || 'C-0/0-0';
    const lastNum = parseInt(lastVoucher.split('/')[0].split('-')[1], 10);
    const newNum = lastNum + 1;
    
    return `C-${newNum}/${fiscalYear}`;
  }

  /**
   * Retrieves all saved transfers, ordered by date descending, then by creation time descending.
   */
  getTransfers(): Observable<InterCashTransfer[]> {
    const q = query(
      this.transfersCollection,
      orderBy('date', 'desc'),
      orderBy('createdAt', 'desc')
    );
    return from(getDocs(q)).pipe(
      map(snapshot =>
        snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InterCashTransfer))
      )
    );
  }

  /**
   * Adds a new transfer record and creates the corresponding debit and credit transactions in Firestore.
   */
  async addTransfer(transferData: Omit<InterCashTransfer, 'id' | 'createdAt'>): Promise<void> {
    const batch = writeBatch(this.firestore);
    const now = Timestamp.now();
    const transferRef = doc(this.transfersCollection);

    // 1. Add the main transfer document
    batch.set(transferRef, {
      ...transferData,
      createdAt: now,
    });

    const affectedAccountIds = new Set<string>();

    // 2. Create DEBIT transactions for each "Deposited In" item
    transferData.debits.forEach(item => {
      const transactionRef = doc(this.transactionsCollection);
      batch.set(transactionRef, {
        accountId: item.accountId,
        date: transferData.date,
        description: `Contra Entry: ${transferData.voucherNo} - ${transferData.narration}`,
        debit: item.amount,
        credit: 0,
        relatedDocId: transferRef.id,
        source: 'contra',
        type: 'transfer_in',
        createdAt: now
      });
      affectedAccountIds.add(item.accountId);
    });

    // 3. Create CREDIT transactions for each "Paid From" item
    transferData.credits.forEach(item => {
        const transactionRef = doc(this.transactionsCollection);
        batch.set(transactionRef, {
          accountId: item.accountId,
          date: transferData.date,
          description: `Contra Entry: ${transferData.voucherNo} - ${transferData.narration}`,
          debit: 0,
          credit: item.amount,
          relatedDocId: transferRef.id,
          source: 'contra',
          type: 'transfer_out',
          createdAt: now
        });
        affectedAccountIds.add(item.accountId);
      });

    // 4. Commit all operations
    await batch.commit();

    // 5. Recalculate balances for all affected accounts to ensure data consistency
    for (const accountId of affectedAccountIds) {
      await this.accountService.recalculateAndSaveBalance(accountId);
    }
  }
  
  /**
   * Deletes a transfer record and all of its associated financial transactions.
   */
  async deleteTransfer(transferId: string): Promise<void> {
    const batch = writeBatch(this.firestore);
    const transferRef = doc(this.firestore, 'interCashTransfers', transferId);

    // Find all transactions linked to this transfer
    const transactionsQuery = query(this.transactionsCollection, where('relatedDocId', '==', transferId));
    const transactionsSnapshot = await getDocs(transactionsQuery);
    
    const affectedAccountIds = new Set<string>();
    transactionsSnapshot.forEach(doc => {
        affectedAccountIds.add(doc.data()['accountId']);
        batch.delete(doc.ref); // Delete each transaction
    });

    // Delete the main transfer document
    batch.delete(transferRef);
    await batch.commit();

    // Recalculate balances for the affected accounts
    for (const accountId of affectedAccountIds) {
        await this.accountService.recalculateAndSaveBalance(accountId);
    }
  }
}