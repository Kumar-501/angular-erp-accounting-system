// services/stock-price-log.service.ts
import { Injectable } from '@angular/core';
import { 
  Firestore, 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp 
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { StockPriceLog, StockPriceLogFilter, StockPriceLogSummary } from '../models/stock-price.log.model';

@Injectable({
  providedIn: 'root'
})
export class StockPriceLogService {
  private collectionName = 'purchase-stock-price-log';
  private collection;

  constructor(private firestore: Firestore) {
    this.collection = collection(this.firestore, this.collectionName);
  }

  // Create a new stock price log entry
  async createStockPriceLog(logData: Partial<StockPriceLog>): Promise<any> {
    try {
      const completeData = {
        ...logData,
        totalCost: (logData.unitPurchasePrice || 0) * (logData.receivedStockFromGrn || 0),
        taxAmount: ((logData.unitPurchasePrice || 0) * (logData.receivedStockFromGrn || 0)) * ((logData.taxRate || 0) / 100),
        lineTotal: ((logData.unitPurchasePrice || 0) * (logData.receivedStockFromGrn || 0)) + 
                   (((logData.unitPurchasePrice || 0) * (logData.receivedStockFromGrn || 0)) * ((logData.taxRate || 0) / 100)) + 
                   (logData.shippingCharge || 0),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      return await addDoc(this.collection, completeData);
    } catch (error) {
      console.error('Error creating stock price log:', error);
      throw error;
    }
  }

  // Get all stock price logs with real-time updates
  getStockPriceLogs(): Observable<StockPriceLog[]> {
    return new Observable(observer => {
      const q = query(this.collection, orderBy('createdAt', 'desc'));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const logs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          grnCreatedDate: doc.data()['grnCreatedDate']?.toDate?.() || doc.data()['grnCreatedDate'],
          createdAt: doc.data()['createdAt']?.toDate?.() || doc.data()['createdAt'],
          updatedAt: doc.data()['updatedAt']?.toDate?.() || doc.data()['updatedAt'],
          expiryDate: doc.data()['expiryDate']?.toDate?.() || doc.data()['expiryDate']
        })) as StockPriceLog[];
        
        observer.next(logs);
      }, (error) => {
        console.error('Error fetching stock price logs:', error);
        observer.error(error);
      });

      return () => unsubscribe();
    });
  }

  // Get filtered stock price logs
  async getFilteredStockPriceLogs(filter: StockPriceLogFilter): Promise<StockPriceLog[]> {
    try {
      let q = query(this.collection);

      // Apply filters
      if (filter.productId) {
        q = query(q, where('productId', '==', filter.productId));
      }
      if (filter.locationId) {
        q = query(q, where('locationId', '==', filter.locationId));
      }
      if (filter.paymentType) {
        q = query(q, where('paymentType', '==', filter.paymentType));
      }
      if (filter.supplierName) {
        q = query(q, where('supplierName', '==', filter.supplierName));
      }
      if (filter.purchaseRefNo) {
        q = query(q, where('purchaseRefNo', '==', filter.purchaseRefNo));
      }

      // Add date range filter if provided
      if (filter.startDate) {
        q = query(q, where('grnCreatedDate', '>=', filter.startDate));
      }
      if (filter.endDate) {
        q = query(q, where('grnCreatedDate', '<=', filter.endDate));
      }

      q = query(q, orderBy('grnCreatedDate', 'desc'));

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        grnCreatedDate: doc.data()['grnCreatedDate']?.toDate?.() || doc.data()['grnCreatedDate'],
        createdAt: doc.data()['createdAt']?.toDate?.() || doc.data()['createdAt'],
        updatedAt: doc.data()['updatedAt']?.toDate?.() || doc.data()['updatedAt'],
        expiryDate: doc.data()['expiryDate']?.toDate?.() || doc.data()['expiryDate']
      })) as StockPriceLog[];
    } catch (error) {
      console.error('Error fetching filtered stock price logs:', error);
      throw error;
    }
  }

  // Get stock price logs by product ID
  async getStockPriceLogsByProduct(productId: string): Promise<StockPriceLog[]> {
    try {
      const q = query(
        this.collection, 
        where('productId', '==', productId),
        orderBy('grnCreatedDate', 'desc')
      );
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        grnCreatedDate: doc.data()['grnCreatedDate']?.toDate?.() || doc.data()['grnCreatedDate'],
        createdAt: doc.data()['createdAt']?.toDate?.() || doc.data()['createdAt'],
        updatedAt: doc.data()['updatedAt']?.toDate?.() || doc.data()['updatedAt'],
        expiryDate: doc.data()['expiryDate']?.toDate?.() || doc.data()['expiryDate']
      })) as StockPriceLog[];
    } catch (error) {
      console.error('Error fetching stock price logs by product:', error);
      throw error;
    }
  }

  // Get stock price logs by purchase reference
  async getStockPriceLogsByPurchaseRef(purchaseRefNo: string): Promise<StockPriceLog[]> {
    try {
      const q = query(
        this.collection, 
        where('purchaseRefNo', '==', purchaseRefNo),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        grnCreatedDate: doc.data()['grnCreatedDate']?.toDate?.() || doc.data()['grnCreatedDate'],
        createdAt: doc.data()['createdAt']?.toDate?.() || doc.data()['createdAt'],
        updatedAt: doc.data()['updatedAt']?.toDate?.() || doc.data()['updatedAt'],
        expiryDate: doc.data()['expiryDate']?.toDate?.() || doc.data()['expiryDate']
      })) as StockPriceLog[];
    } catch (error) {
      console.error('Error fetching stock price logs by purchase ref:', error);
      throw error;
    }
  }

  // Update stock price log
  async updateStockPriceLog(id: string, updateData: Partial<StockPriceLog>): Promise<void> {
    try {
      const docRef = doc(this.firestore, this.collectionName, id);
      
      // Recalculate totals if relevant fields are updated
      if (updateData.unitPurchasePrice || updateData.receivedStockFromGrn || updateData.taxRate || updateData.shippingCharge) {
        const currentData = await this.getStockPriceLogById(id);
        const unitPrice = updateData.unitPurchasePrice || currentData.unitPurchasePrice;
        const quantity = updateData.receivedStockFromGrn || currentData.receivedStockFromGrn;
        const taxRate = updateData.taxRate || currentData.taxRate;
        const shipping = updateData.shippingCharge ?? currentData.shippingCharge ?? 0;

        updateData.totalCost = unitPrice * quantity;
        updateData.taxAmount = (unitPrice * quantity) * (taxRate / 100);
        updateData.lineTotal = (unitPrice * quantity) + ((unitPrice * quantity) * (taxRate / 100)) + shipping;
      }

      // Use type assertion to allow FieldValue for Firestore timestamps
      (updateData as any).updatedAt = serverTimestamp();
      
      return await updateDoc(docRef, updateData);
    } catch (error) {
      console.error('Error updating stock price log:', error);
      throw error;
    }
  }

  // Delete stock price log
  async deleteStockPriceLog(id: string): Promise<void> {
    try {
      const docRef = doc(this.firestore, this.collectionName, id);
      return await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting stock price log:', error);
      throw error;
    }
  }

  // Get stock price log by ID
  private async getStockPriceLogById(id: string): Promise<StockPriceLog> {
    const q = query(this.collection, where('__name__', '==', id));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data(),
        grnCreatedDate: doc.data()['grnCreatedDate']?.toDate?.() || doc.data()['grnCreatedDate'],
        createdAt: doc.data()['createdAt']?.toDate?.() || doc.data()['createdAt'],
        updatedAt: doc.data()['updatedAt']?.toDate?.() || doc.data()['updatedAt'],
        expiryDate: doc.data()['expiryDate']?.toDate?.() || doc.data()['expiryDate']
      } as StockPriceLog;
    }
    throw new Error('Stock price log not found');
  }

  // Get summary statistics
  async getStockPriceLogSummary(filter?: StockPriceLogFilter): Promise<StockPriceLogSummary> {
    try {
      const logs = filter ? await this.getFilteredStockPriceLogs(filter) : await this.getAllStockPriceLogs();
      
      const summary: StockPriceLogSummary = {
        totalRecords: logs.length,
        totalStockReceived: logs.reduce((sum, log) => sum + (log.receivedStockFromGrn || 0), 0),
        totalPurchaseValue: logs.reduce((sum, log) => sum + (log.totalCost || 0), 0),
        totalTaxAmount: logs.reduce((sum, log) => sum + (log.taxAmount || 0), 0),
        averageUnitPrice: logs.length > 0 ? 
          logs.reduce((sum, log) => sum + (log.unitPurchasePrice || 0), 0) / logs.length : 0
      };

      return summary;
    } catch (error) {
      console.error('Error calculating summary:', error);
      throw error;
    }
  }

  // Helper method to get all logs without real-time updates
  private async getAllStockPriceLogs(): Promise<StockPriceLog[]> {
    const snapshot = await getDocs(this.collection);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      grnCreatedDate: doc.data()['grnCreatedDate']?.toDate?.() || doc.data()['grnCreatedDate'],
      createdAt: doc.data()['createdAt']?.toDate?.() || doc.data()['createdAt'],
      updatedAt: doc.data()['updatedAt']?.toDate?.() || doc.data()['updatedAt'],
      expiryDate: doc.data()['expiryDate']?.toDate?.() || doc.data()['expiryDate']
    })) as StockPriceLog[];
  }

  // Bulk create stock price logs
  async bulkCreateStockPriceLogs(logs: Partial<StockPriceLog>[]): Promise<void> {
    try {
      const promises = logs.map(log => this.createStockPriceLog(log));
      await Promise.all(promises);
    } catch (error) {
      console.error('Error bulk creating stock price logs:', error);
      throw error;
    }
  }
}