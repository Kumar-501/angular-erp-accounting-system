import { Injectable } from '@angular/core';
import { Firestore, addDoc, collection, query, where, orderBy, getDocs, limit as firestoreLimit } from '@angular/fire/firestore';
import { Timestamp, DocumentData } from 'firebase/firestore';

export type StockAction = 
  | 'goods_received' 
  | 'transfer_in' 
  | 'transfer_out' 
  | 'adjustment' 
  | 'sale' 
  | 'return'
  | 'initial_stock'
  | 'damaged'
  | 'expired'
  | 'eod_adjustment';

export interface StockLog {
  id?: string;
  productId: string;
  productName: string;
  sku: string;
  locationId: string;
  locationName: string;
  action: StockAction;
  quantity: number;
  oldStock: number;
  newStock: number;
  timestamp: Date; // Consistently use Date object in the application
  userId: string;
  referenceNo?: string;
  notes?: string;
  costPrice?: number;
  sellingPrice?: number;
  sourceLocationId?: string;
  destinationLocationId?: string;
  transferId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class LogStockMovementService {
  private readonly collectionName = 'stock_logs';

  constructor(private firestore: Firestore) {}

  /**
   * Log a stock movement.
   * This function now uses 'new Date()' to prevent the "custom object" error.
   */
  async logStockMovement(logData: Omit<StockLog, 'id' | 'timestamp'>): Promise<string> {
    try {
      const logsCollection = collection(this.firestore, this.collectionName);
      const docRef = await addDoc(logsCollection, {
        ...logData,
        timestamp: new Date() // THE FIX: Use a standard JavaScript Date object.
      });
      return docRef.id;
    } catch (error) {
      console.error('Error logging stock movement:', error);
      // Re-throwing the error to be handled by the calling service
      throw error;
    }
  }

  /**
   * Get product stock history (No changes needed, functionality preserved)
   */
  async getProductStockHistory(
    productId: string, 
    options: {
      locationId?: string;
      limit?: number;
      startDate?: Date;
      endDate?: Date;
      actions?: StockAction[];
    } = {}
  ): Promise<StockLog[]> {
    try {
      const {
        locationId,
        limit: limitValue = 50,
        startDate,
        endDate,
        actions
      } = options;

      const logsCollection = collection(this.firestore, this.collectionName);
      let q = query(
        logsCollection,
        where('productId', '==', productId),
        orderBy('timestamp', 'desc')
      );

      if (locationId) {
        q = query(q, where('locationId', '==', locationId));
      }

      if (startDate) {
        // Correctly using Timestamp.fromDate for querying
        q = query(q, where('timestamp', '>=', Timestamp.fromDate(startDate)));
      }

      if (endDate) {
        // Correctly using Timestamp.fromDate for querying
        q = query(q, where('timestamp', '<=', Timestamp.fromDate(endDate)));
      }

      if (actions && actions.length > 0) {
        q = query(q, where('action', 'in', actions));
      }

      q = query(q, firestoreLimit(limitValue));

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => {
        // The convertTimestamps helper ensures the app receives a standard Date object
        const data = this.convertTimestamps(doc.data()) as Omit<StockLog, 'id'>;
        return {
          id: doc.id,
          ...data
        };
      });
    } catch (error) {
      console.error('Error getting product stock history:', error);
      throw error;
    }
  }

  /**
   * Get location stock history (No changes needed, functionality preserved)
   */
  async getLocationStockHistory(
    locationId: string,
    options: {
      productId?: string;
      limit?: number;
      startDate?: Date;
      endDate?: Date;
      actions?: StockAction[];
    } = {}
  ): Promise<StockLog[]> {
    try {
      const {
        productId,
        limit: limitValue = 100,
        startDate,
        endDate,
        actions
      } = options;

      const logsCollection = collection(this.firestore, this.collectionName);
      let q = query(
        logsCollection,
        where('locationId', '==', locationId),
        orderBy('timestamp', 'desc')
      );

      if (productId) {
        q = query(q, where('productId', '==', productId));
      }

      if (startDate) {
        q = query(q, where('timestamp', '>=', Timestamp.fromDate(startDate)));
      }

      if (endDate) {
        q = query(q, where('timestamp', '<=', Timestamp.fromDate(endDate)));
      }

      if (actions && actions.length > 0) {
        q = query(q, where('action', 'in', actions));
      }

      q = query(q, firestoreLimit(limitValue));

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => {
        const data = this.convertTimestamps(doc.data()) as Omit<StockLog, 'id'>;
        return {
            id: doc.id,
            ...data
        };
      });
    } catch (error) {
      console.error('Error getting location stock history:', error);
      throw error;
    }
  }

  /**
   * Convert Firestore Timestamps to Date objects after reading from the database.
   * (No changes needed, this is best practice for handling data in the app)
   */
  private convertTimestamps(data: DocumentData): DocumentData {
    if (data && typeof data === 'object') {
      for (const key of Object.keys(data)) {
        const value = data[key];
        if (value instanceof Timestamp) {
          data[key] = value.toDate();
        }
      }
    }
    return data;
  }
}