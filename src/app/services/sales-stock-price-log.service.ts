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

export interface SalesStockPriceLog {
  id?: string;
  saleId: string;
  invoiceNo: string;
  productId: string;
  productName: string;
  quantity: number;
  sellingPrice: number;
  location: string;
  paymentAccountId?: string;
  paymentType?: string;
  taxRate: number;
  packingCharge?: number;
  shippingCharge?: number;
  saleCreatedDate: Date | string;
  createdAt?: Date | Timestamp;
  updatedAt?: Date | Timestamp;
}

export interface SalesStockPriceLogFilter {
  productId?: string;
  locationId?: string;
  invoiceNo?: string;
  saleId?: string;
  startDate?: Date;
  endDate?: Date;
  paymentType?: string;
}

export interface SalesStockPriceLogSummary {
  totalRecords: number;
  totalQuantitySold: number;
  totalSalesValue: number;
  totalTaxAmount: number;
  averageSellingPrice: number;
}

@Injectable({
  providedIn: 'root'
})
export class SalesStockPriceLogService {
  private collectionName = 'sales-stock-price-log';
  private collection;

  constructor(private firestore: Firestore) {
    this.collection = collection(this.firestore, this.collectionName);
  }

  // Create a new sales stock price log entry
  async createSalesStockPriceLog(logData: Partial<SalesStockPriceLog>): Promise<any> {
    try {
      const completeData = {
        ...logData,
        totalValue: (logData.sellingPrice || 0) * (logData.quantity || 0),
        taxAmount: ((logData.sellingPrice || 0) * (logData.quantity || 0)) * ((logData.taxRate || 0) / 100),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      return await addDoc(this.collection, completeData);
    } catch (error) {
      console.error('Error creating sales stock price log:', error);
      throw error;
    }
  }

  // Get all sales stock price logs with real-time updates
  getSalesStockPriceLogs(): Observable<SalesStockPriceLog[]> {
    return new Observable(observer => {
      const q = query(this.collection, orderBy('createdAt', 'desc'));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const logs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          saleCreatedDate: doc.data()['saleCreatedDate'] instanceof Date ? 
            doc.data()['saleCreatedDate'] : 
            (doc.data()['saleCreatedDate']?.toDate?.() || new Date(doc.data()['saleCreatedDate'] || '')),
          createdAt: doc.data()['createdAt']?.toDate?.() || doc.data()['createdAt'],
          updatedAt: doc.data()['updatedAt']?.toDate?.() || doc.data()['updatedAt']
        })) as SalesStockPriceLog[];
        
        observer.next(logs);
      }, (error) => {
        observer.error(error);
      });

      return { unsubscribe };
    });
  }

  // Get filtered sales stock price logs
  async getFilteredSalesStockPriceLogs(filter: SalesStockPriceLogFilter): Promise<SalesStockPriceLog[]> {
    try {
      let q = query(this.collection);

      if (filter.productId) {
        q = query(q, where('productId', '==', filter.productId));
      }
      if (filter.locationId) {
        q = query(q, where('location', '==', filter.locationId));
      }
      if (filter.invoiceNo) {
        q = query(q, where('invoiceNo', '==', filter.invoiceNo));
      }
      if (filter.saleId) {
        q = query(q, where('saleId', '==', filter.saleId));
      }
      if (filter.paymentType) {
        q = query(q, where('paymentType', '==', filter.paymentType));
      }

      q = query(q, orderBy('createdAt', 'desc'));

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        saleCreatedDate: doc.data()['saleCreatedDate'] instanceof Date ? 
          doc.data()['saleCreatedDate'] : 
          (doc.data()['saleCreatedDate']?.toDate?.() || new Date(doc.data()['saleCreatedDate'] || '')),
        createdAt: doc.data()['createdAt']?.toDate?.() || doc.data()['createdAt'],
        updatedAt: doc.data()['updatedAt']?.toDate?.() || doc.data()['updatedAt']
      })) as SalesStockPriceLog[];
    } catch (error) {
      console.error('Error fetching filtered sales stock price logs:', error);
      throw error;
    }
  }
  // Get sales stock price logs by product ID
  async getSalesStockPriceLogsByProduct(productId: string): Promise<SalesStockPriceLog[]> {
    try {
      const q = query(
        this.collection, 
        where('productId', '==', productId),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        saleCreatedDate: doc.data()['saleCreatedDate'] instanceof Date ? 
          doc.data()['saleCreatedDate'] : 
          (doc.data()['saleCreatedDate']?.toDate?.() || new Date(doc.data()['saleCreatedDate'] || '')),
        createdAt: doc.data()['createdAt']?.toDate?.() || doc.data()['createdAt'],
        updatedAt: doc.data()['updatedAt']?.toDate?.() || doc.data()['updatedAt']
      })) as SalesStockPriceLog[];
    } catch (error) {
      console.error('Error fetching sales stock price logs by product:', error);
      throw error;
    }
  }

  // Get sales stock price logs by product name (for cases where productId might be empty)
  async getSalesStockPriceLogsByProductName(productName: string): Promise<SalesStockPriceLog[]> {
    try {
      const q = query(
        this.collection, 
        where('productName', '==', productName),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        saleCreatedDate: doc.data()['saleCreatedDate'] instanceof Date ? 
          doc.data()['saleCreatedDate'] : 
          (doc.data()['saleCreatedDate']?.toDate?.() || new Date(doc.data()['saleCreatedDate'] || '')),
        createdAt: doc.data()['createdAt']?.toDate?.() || doc.data()['createdAt'],
        updatedAt: doc.data()['updatedAt']?.toDate?.() || doc.data()['updatedAt']
      })) as SalesStockPriceLog[];
    } catch (error) {
      console.error('Error fetching sales stock price logs by product name:', error);
      throw error;
    }
  }

  // Get sales stock price logs by sale ID
  async getSalesStockPriceLogsBySale(saleId: string): Promise<SalesStockPriceLog[]> {
    try {
      const q = query(
        this.collection, 
        where('saleId', '==', saleId),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        saleCreatedDate: doc.data()['saleCreatedDate'] instanceof Date ? 
          doc.data()['saleCreatedDate'] : 
          (doc.data()['saleCreatedDate']?.toDate?.() || new Date(doc.data()['saleCreatedDate'] || '')),
        createdAt: doc.data()['createdAt']?.toDate?.() || doc.data()['createdAt'],
        updatedAt: doc.data()['updatedAt']?.toDate?.() || doc.data()['updatedAt']
      })) as SalesStockPriceLog[];
    } catch (error) {
      console.error('Error fetching sales stock price logs by sale:', error);
      throw error;
    }
  }

  // Update sales stock price log
  async updateSalesStockPriceLog(id: string, updateData: Partial<SalesStockPriceLog>): Promise<void> {
    try {
      const docRef = doc(this.firestore, this.collectionName, id);
      
      // Recalculate totals if relevant fields are updated
      if (updateData.sellingPrice || updateData.quantity || updateData.taxRate) {
        const currentData = await this.getSalesStockPriceLogById(id);
        const sellingPrice = updateData.sellingPrice || currentData.sellingPrice;
        const quantity = updateData.quantity || currentData.quantity;
        const taxRate = updateData.taxRate || currentData.taxRate;

        (updateData as any).totalValue = sellingPrice * quantity;
        (updateData as any).taxAmount = (sellingPrice * quantity) * (taxRate / 100);
      }

      (updateData as any).updatedAt = serverTimestamp();
      
      return await updateDoc(docRef, updateData);
    } catch (error) {
      console.error('Error updating sales stock price log:', error);
      throw error;
    }
  }

  // Delete sales stock price log
  async deleteSalesStockPriceLog(id: string): Promise<void> {
    try {
      const docRef = doc(this.firestore, this.collectionName, id);
      return await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting sales stock price log:', error);
      throw error;
    }
  }

  // Get sales stock price log by ID
  private async getSalesStockPriceLogById(id: string): Promise<SalesStockPriceLog> {
    const q = query(this.collection, where('__name__', '==', id));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data(),
        saleCreatedDate: doc.data()['saleCreatedDate'] instanceof Date ? 
          doc.data()['saleCreatedDate'] : 
          (doc.data()['saleCreatedDate']?.toDate?.() || new Date(doc.data()['saleCreatedDate'] || '')),
        createdAt: doc.data()['createdAt']?.toDate?.() || doc.data()['createdAt'],
        updatedAt: doc.data()['updatedAt']?.toDate?.() || doc.data()['updatedAt']
      } as SalesStockPriceLog;
    }
    throw new Error('Sales stock price log not found');
  }

  // Get summary statistics
  async getSalesStockPriceLogSummary(filter?: SalesStockPriceLogFilter): Promise<SalesStockPriceLogSummary> {
    try {
      const logs = filter ? 
        await this.getFilteredSalesStockPriceLogs(filter) : 
        await this.getAllSalesStockPriceLogs();

      const summary: SalesStockPriceLogSummary = {
        totalRecords: logs.length,
        totalQuantitySold: logs.reduce((sum, log) => sum + (log.quantity || 0), 0),
        totalSalesValue: logs.reduce((sum, log) => sum + ((log.sellingPrice || 0) * (log.quantity || 0)), 0),
        totalTaxAmount: logs.reduce((sum, log) => sum + (((log.sellingPrice || 0) * (log.quantity || 0)) * ((log.taxRate || 0) / 100)), 0),
        averageSellingPrice: logs.length > 0 ? 
          logs.reduce((sum, log) => sum + (log.sellingPrice || 0), 0) / logs.length : 0
      };

      return summary;
    } catch (error) {
      console.error('Error getting sales stock price log summary:', error);
      throw error;
    }
  }

  // Helper method to get all logs without real-time updates
  private async getAllSalesStockPriceLogs(): Promise<SalesStockPriceLog[]> {
    const q = query(this.collection, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      saleCreatedDate: doc.data()['saleCreatedDate'] instanceof Date ? 
        doc.data()['saleCreatedDate'] : 
        (doc.data()['saleCreatedDate']?.toDate?.() || new Date(doc.data()['saleCreatedDate'] || '')),
      createdAt: doc.data()['createdAt']?.toDate?.() || doc.data()['createdAt'],
      updatedAt: doc.data()['updatedAt']?.toDate?.() || doc.data()['updatedAt']
    })) as SalesStockPriceLog[];
  }

  // Get all sales stock price logs (public method for filtering)
  async getAllSalesStockPriceLogsPublic(): Promise<SalesStockPriceLog[]> {
    try {
      const q = query(this.collection, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        saleCreatedDate: doc.data()['saleCreatedDate'] instanceof Date ? 
          doc.data()['saleCreatedDate'] : 
          (doc.data()['saleCreatedDate']?.toDate?.() || new Date(doc.data()['saleCreatedDate'] || '')),
        createdAt: doc.data()['createdAt']?.toDate?.() || doc.data()['createdAt'],
        updatedAt: doc.data()['updatedAt']?.toDate?.() || doc.data()['updatedAt']
      })) as SalesStockPriceLog[];
    } catch (error) {
      console.error('Error fetching all sales stock price logs:', error);
      throw error;
    }
  }

  // Bulk create sales stock price logs
  async bulkCreateSalesStockPriceLogs(logs: Partial<SalesStockPriceLog>[]): Promise<void> {
    try {
      const promises = logs.map(log => this.createSalesStockPriceLog(log));
      await Promise.all(promises);
    } catch (error) {
      console.error('Error bulk creating sales stock price logs:', error);
      throw error;
    }
  }

  // Add log entry method for compatibility
  async addLogEntry(logData: Partial<SalesStockPriceLog>): Promise<any> {
    return this.createSalesStockPriceLog(logData);
  }

  // Log price change method for compatibility
  async logPriceChange(
    productId: string,
    productName: string,
    saleId: string,
    invoiceNo: string,
    quantity: number,
    sellingPrice: number,
    location: string,
    paymentAccountId?: string,
    paymentType?: string,
    taxRate: number = 0,
    packingCharge: number = 0,
    shippingCharge: number = 0
  ): Promise<void> {
    const logData: Partial<SalesStockPriceLog> = {
      saleId,
      invoiceNo,
      productId,
      productName,
      quantity,
      sellingPrice,
      location,
      paymentAccountId,
      paymentType,
      taxRate,
      packingCharge,
      shippingCharge,
      saleCreatedDate: new Date()
    };

    await this.createSalesStockPriceLog(logData);
  }
}