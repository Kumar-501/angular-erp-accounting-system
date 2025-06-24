import { Injectable } from '@angular/core';
import { 
  Firestore, 
  collection, 
  addDoc,
  query,
  where,
  getDocs,
  orderBy,
  Timestamp,
  DocumentData
} from '@angular/fire/firestore';

// Update your interfaces to be consistent
interface ReturnItem {
  productId: string;
  name: string;                // This was missing in SalesReturnLogItem
  quantity: number;
  originalQuantity: number;    // This was 'quantity' in SalesReturnLogItem
  unitPrice: number;
  reason?: string;
  subtotal: number;
}

interface Return {
  id?: string;
  originalSaleId: string;
  invoiceNo: string;
  customer: string;
  returnedItems: ReturnItem[];
  totalRefund: number;
  returnDate: Date;
  status: string;
  returnReason?: string;
  createdAt?: Date;
  processedBy?: string;
}

interface SalesReturnLogItem {
  productId: string;
  productName: string;        // Align with 'name' in ReturnItem
  quantity: number;           // Original quantity
  returnQuantity: number;     // This is the actual returned quantity
  unitPrice: number;
  subtotal: number;
  reason?: string;
}

interface SalesReturnLog {
  id?: string;
  saleId: string;
  returnDate: Date;
  paymentAccountId: string;
  items: SalesReturnLogItem[];
  createdAt?: Date;
}

interface FirestoreSalesReturnLog extends Omit<SalesReturnLog, 'returnDate' | 'createdAt'> {
  returnDate: Timestamp;
  createdAt: Timestamp;
}

@Injectable({
  providedIn: 'root'
})
export class ReturnService {
  constructor(private firestore: Firestore) {}

  private toSalesReturnLog(docData: DocumentData): SalesReturnLog {
    const data = docData as FirestoreSalesReturnLog;
    return {
      id: docData['id'],
      saleId: data.saleId,
      returnDate: data.returnDate.toDate(),
      paymentAccountId: data.paymentAccountId,
      items: data.items,
      createdAt: data.createdAt.toDate()
    };
  }

  // Log a return transaction
  async logReturn(returnLog: SalesReturnLog): Promise<string> {
    try {
      const returnLogCollection = collection(this.firestore, 'sales-return-log');
      const firestoreLog: Omit<FirestoreSalesReturnLog, 'id'> = {
        saleId: returnLog.saleId,
        returnDate: Timestamp.fromDate(returnLog.returnDate),
        paymentAccountId: returnLog.paymentAccountId,
        items: returnLog.items,
        createdAt: Timestamp.now()
      };
      
      const docRef = await addDoc(returnLogCollection, firestoreLog);
      return docRef.id;
    } catch (error) {
      console.error('Error logging return:', error);
      throw error;
    }
  }

  // Get return logs by sale ID
  async getReturnLogsBySale(saleId: string): Promise<SalesReturnLog[]> {
    try {
      const returnLogCollection = collection(this.firestore, 'sales-return-log');
      const q = query(
        returnLogCollection,
        where('saleId', '==', saleId),
        orderBy('returnDate', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => this.toSalesReturnLog({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error fetching return logs:', error);
      return [];
    }
  }

  // Get all return logs within a date range
  async getReturnLogsByDateRange(startDate: Date, endDate: Date): Promise<SalesReturnLog[]> {
    try {
      const returnLogCollection = collection(this.firestore, 'sales-return-log');
      const q = query(
        returnLogCollection,
        where('returnDate', '>=', Timestamp.fromDate(startDate)),
        where('returnDate', '<=', Timestamp.fromDate(endDate)),
        orderBy('returnDate', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => this.toSalesReturnLog({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error fetching return logs by date range:', error);
      return [];
    }
  }
}