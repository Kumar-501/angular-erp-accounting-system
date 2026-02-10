// purchase-stock-price-log.service.ts
import { Injectable } from '@angular/core';
import { 
  Firestore, 
  collection, 
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs
} from '@angular/fire/firestore';
import { from, Observable } from 'rxjs';

export interface PurchaseStockPriceLog {
  id?: string;
  productId: string;
  productName: string;
  sku?: string | null;  // Make optional fields explicitly nullable
  locationId: string;
  locationName: string;
  receivedQuantity: number;
  
  unitPurchasePrice: number;
  paymentAccountId: string | null;  // Explicit null type
  paymentType: string | null;
  taxRate: number;
  shippingCharge?: number;
  purchaseRefNo?: string;
  grnRefNo?: string;
  grnCreatedDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable({
  providedIn: 'root'
})
export class PurchaseStockPriceLogService {
  private collectionName = 'purchase-stock-price-log';

  constructor(private firestore: Firestore) {}

  // Add a new log entry
  addLogEntry(logData: Omit<PurchaseStockPriceLog, 'id' | 'createdAt' | 'updatedAt'>): Observable<string> {
    const completeData = {
      ...logData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    const collectionRef = collection(this.firestore, this.collectionName);
    return from(addDoc(collectionRef, completeData).then(docRef => docRef.id));
  }

 // New method to fetch payment accounts
  getPaymentAccounts(): Observable<any[]> {
    const paymentAccountsCollection = collection(this.firestore, 'payment-accounts');
    return from(getDocs(paymentAccountsCollection).then(snapshot => {
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    }));
  }

  // New method to get payment account by ID
  getPaymentAccountById(accountId: string): Observable<any> {
    if (!accountId) return new Observable(subscriber => subscriber.next(null));
    
    const paymentAccountsCollection = collection(this.firestore, 'payment-accounts');
    const q = query(paymentAccountsCollection, where('id', '==', accountId));
    return from(getDocs(q).then(snapshot => {
      if (snapshot.empty) return null;
      return {
        id: snapshot.docs[0].id,
        ...snapshot.docs[0].data()
      };
    }));
  }
  
  
  
// In purchase-stock-price-log.service.ts
async getLogsByProductId(productId: string): Promise<PurchaseStockPriceLog[]> {
  const collectionRef = collection(this.firestore, this.collectionName);
  const productQuery = query(collectionRef, where('productId', '==', productId));
  
  const querySnapshot = await getDocs(productQuery);
  return querySnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      grnCreatedDate: data['grnCreatedDate']?.toDate(),
      createdAt: data['createdAt']?.toDate(),
      updatedAt: data['updatedAt']?.toDate()
    } as PurchaseStockPriceLog;
  });
}
logPriceChange(logData: Omit<PurchaseStockPriceLog, 'id' | 'createdAt' | 'updatedAt'>): Observable<string> {
  // Create a new object with all fields, explicitly handling undefined values
  const completeData: any = {
    ...logData,
    paymentAccountId: logData.paymentAccountId ?? null,  // Convert undefined to null
    paymentType: logData.paymentType ?? null,
    shippingCharge: logData.shippingCharge ?? 0,
    purchaseRefNo: logData.purchaseRefNo ?? null,
    grnRefNo: logData.grnRefNo ?? null,
    sku: logData.sku ?? null,  // Ensure SKU is handled
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  
  // Remove any remaining undefined values that might have been missed
  Object.keys(completeData).forEach(key => {
    if (completeData[key] === undefined) {
      completeData[key] = null;
    }
  });
  
  const collectionRef = collection(this.firestore, this.collectionName);
  return from(addDoc(collectionRef, completeData).then(docRef => docRef.id));
}
  // Get logs by purchase reference number
  getLogsByPurchaseRef(purchaseRefNo: string): Observable<PurchaseStockPriceLog[]> {
    return new Observable(observer => {
      const collectionRef = collection(this.firestore, this.collectionName);
      const purchaseQuery = query(collectionRef, where('purchaseRefNo', '==', purchaseRefNo));
      
      getDocs(purchaseQuery).then(querySnapshot => {
        const logs = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            grnCreatedDate: data['grnCreatedDate']?.toDate(),
            createdAt: data['createdAt']?.toDate(),
            updatedAt: data['updatedAt']?.toDate()
          } as PurchaseStockPriceLog;
        });
        observer.next(logs);
        observer.complete();
      }).catch(error => {
        observer.error(error);
      });
    });
  }
}