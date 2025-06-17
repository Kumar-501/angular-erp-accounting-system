import { Injectable } from '@angular/core';
import { 
  Firestore, 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  Timestamp
} from '@angular/fire/firestore';
import { Observable, from, map } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TransactionsService {
  constructor(private firestore: Firestore) {}

  // Get all transactions for an account
  getTransactionsByAccount(accountId: string): Observable<any[]> {
    const transactionsRef = collection(this.firestore, 'transactions');
    const q = query(
      transactionsRef, 
      where('accountId', '==', accountId),
      orderBy('date', 'desc')
    );
    
    return from(getDocs(q)).pipe(
      map(snapshot => snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data()['date']?.toDate() || new Date()
      })))
    );
  }

  // Add a new transaction
  async addTransaction(transaction: any): Promise<string> {
    const transactionsRef = collection(this.firestore, 'transactions');
    const docRef = await addDoc(transactionsRef, {
      ...transaction,
      date: transaction.date instanceof Date ? Timestamp.fromDate(transaction.date) : transaction.date,
      createdAt: Timestamp.now()
    });
    return docRef.id;
  }

  // Update a transaction
  async updateTransaction(id: string, data: any): Promise<void> {
    const transactionRef = doc(this.firestore, 'transactions', id);
    await updateDoc(transactionRef, {
      ...data,
      date: data.date instanceof Date ? Timestamp.fromDate(data.date) : data.date,
      updatedAt: Timestamp.now()
    });
  }

  // Delete a transaction
  async deleteTransaction(id: string): Promise<void> {
    const transactionRef = doc(this.firestore, 'transactions', id);
    await deleteDoc(transactionRef);
  }

  // Get transactions with filters
  getFilteredTransactions(params: {
    accountId?: string,
    fromDate?: Date,
    toDate?: Date,
    type?: string
  }): Observable<any[]> {
    const transactionsRef = collection(this.firestore, 'transactions');
    let q = query(transactionsRef);

    if (params.accountId) {
      q = query(q, where('accountId', '==', params.accountId));
    }

    if (params.fromDate && params.toDate) {
      q = query(
        q,
        where('date', '>=', Timestamp.fromDate(params.fromDate)),
        where('date', '<=', Timestamp.fromDate(params.toDate))
      );
    }

    if (params.type) {
      q = query(q, where('type', '==', params.type));
    }

    q = query(q, orderBy('date', 'desc'));

    return from(getDocs(q)).pipe(
      map(snapshot => snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data()['date']?.toDate() || new Date()
      })))
    );
  }
}