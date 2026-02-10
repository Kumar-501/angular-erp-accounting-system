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
  DocumentData,
  getDoc,
  doc
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
  locationId?: string;       // Add location ID
  locationName?: string; 
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
  locationId?: string;       // Add location ID
  locationName?: string; 
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
    originalQuantity?: number;
  locationId?: string;       // Add location ID
  locationName?: string; 
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
      returnDate: this.convertTimestampToDate(data.returnDate),
      paymentAccountId: data.paymentAccountId,
      items: data.items,
      createdAt: this.convertTimestampToDate(data.createdAt)
    };
  }

  // Helper method to properly convert Firestore Timestamps to JavaScript Dates
  private convertTimestampToDate(timestamp: any): Date {
    if (!timestamp) return new Date();
    
    // If it's already a Date object
    if (timestamp instanceof Date) return timestamp;
    
    // If it's a Firestore Timestamp
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }
    
    // If it's a timestamp object with seconds
    if (timestamp.seconds) {
      return new Date(timestamp.seconds * 1000);
    }
    
    // If it's a string, try to parse it
    if (typeof timestamp === 'string') {
      return new Date(timestamp);
    }
    
    // Fallback to current date
    return new Date();
  }

  // Helper method to properly convert JavaScript Dates to Firestore Timestamps
  private convertDateToTimestamp(date: any): Timestamp {
    if (!date) return Timestamp.now();
    
    // If it's already a Firestore Timestamp
    if (date.seconds && date.nanoseconds !== undefined) {
      return date;
    }
    
    // If it's a Date object
    if (date instanceof Date) {
      return Timestamp.fromDate(date);
    }
    
    // If it's a string, parse it first
    if (typeof date === 'string') {
      const parsedDate = new Date(date);
      return Timestamp.fromDate(parsedDate);
    }
    
    // Fallback to current timestamp
    return Timestamp.now();
  }

  // Updated getReturnsByProductId method with proper timestamp handling
  async getReturnsByProductId(productId: string): Promise<SalesReturnLog[]> {
    try {
      const returnsRef = collection(this.firestore, 'sales-returns');
      const q = query(
        returnsRef,
        where('items', 'array-contains', { productId: productId })
      );
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          returnDate: this.convertTimestampToDate(data['returnDate']),
          createdAt: this.convertTimestampToDate(data['createdAt']),
          items: data['items'].map((item: any) => ({
            ...item,
            taxRate: item.taxRate || 0,
            taxAmount: item.taxAmount || 0
          }))
        } as SalesReturnLog;
      });
    } catch (error) {
      console.error('Error getting returns by product ID:', error);
      return [];
    }
  }

  // Updated getReturnsByProductName method with proper timestamp handling
  async getReturnsByProductName(productName: string): Promise<SalesReturnLog[]> {
    try {
      const returnLogCollection = collection(this.firestore, 'sales-return-log');
      const q = query(returnLogCollection);
      
      const querySnapshot = await getDocs(q);
      const allReturns = querySnapshot.docs.map(doc => this.toSalesReturnLog({
        id: doc.id,
        ...doc.data()
      }));

      // Filter returns that contain the product by name
      return allReturns.filter(ret => 
        ret.items.some(item => 
          item.productName?.toLowerCase() === productName.toLowerCase()
        )
      );
    } catch (error) {
      console.error('Error fetching returns by product name:', error);
      return [];
    }
  }

  // Updated log return method with proper timestamp handling
  async logReturn(returnLog: SalesReturnLog): Promise<string> {
    try {
      const returnLogCollection = collection(this.firestore, 'sales-return-log');
      const firestoreLog: Omit<FirestoreSalesReturnLog, 'id'> = {
        saleId: returnLog.saleId,
        returnDate: this.convertDateToTimestamp(returnLog.returnDate),
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

  // Updated get return logs by sale method with proper timestamp handling
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

// In ReturnService, modify the getReturnLogsByDateRange method
async getReturnLogsByDateRange(startDate: Date, endDate: Date): Promise<SalesReturnLog[]> {
  try {
    const returnLogCollection = collection(this.firestore, 'sales-return-log');
    const q = query(
      returnLogCollection,
      where('returnDate', '>=', this.convertDateToTimestamp(startDate)),
      where('returnDate', '<=', this.convertDateToTimestamp(endDate)),
      orderBy('returnDate', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const logs = querySnapshot.docs.map(doc => this.toSalesReturnLog({
      id: doc.id,
      ...doc.data()
    }));

    // Fetch location names for each log
    const logsWithLocations = await Promise.all(logs.map(async log => {
      const itemsWithLocations = await Promise.all(log.items.map(async item => {
        if (item.locationId) {
          const locationDoc = await getDoc(doc(this.firestore, 'businessLocations', item.locationId));
          const locationData = locationDoc.data();
          return {
            ...item,
            locationName: locationData?.['name'] || 'Unknown Location'
          };
        }
        return item;
      }));
      
      return {
        ...log,
        items: itemsWithLocations
      };
    }));

    return logsWithLocations;
  } catch (error) {
    console.error('Error fetching return logs by date range:', error);
    return [];
  }
}
}