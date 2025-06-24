import { Injectable } from '@angular/core';
import { 
  Firestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  writeBatch,
  serverTimestamp,
  Timestamp 
} from '@angular/fire/firestore';
import { ProductsService } from './products.service';
import { COLLECTIONS } from '../../utils/constants';

export interface DailyStockSnapshot {
  id?: string;
  productId: string;
  locationId: string;
  date: string; // YYYY-MM-DD format
  openingStock: number;
  closingStock: number;
  totalReceived: number; // Purchases, transfers in, adjustments
  totalIssued: number; // Sales, transfers out, adjustments
  lastUpdated: Date | Timestamp | any; // Allow FieldValue for serverTimestamp
  createdAt: Date | Timestamp | any; // Allow FieldValue for serverTimestamp
  businessDate: Date | Timestamp | any; // Allow FieldValue for serverTimestamp
}

export interface StockMovement {
  productId: string;
  locationId: string;
  date: Date;
  movementType: 'in' | 'out';
  quantity: number;
  action: string;
  reference?: string;
}

@Injectable({
  providedIn: 'root'
})
export class DailyStockService {
  private readonly DAILY_STOCK_COLLECTION = 'dailyStockSnapshots';
  
  constructor(
    private firestore: Firestore,
    private productsService: ProductsService
  ) {}

  /**
   * Get the business cut-off time (configurable, defaults to midnight)
   */
  private getBusinessCutoffTime(): { hour: number; minute: number } {
    return { hour: 0, minute: 1 }; // 12:01 AM
  }

  /**
   * Convert date to business date string (YYYY-MM-DD)
   */
  private toBusinessDateString(date: Date): string {
    const utcDate = new Date(Date.UTC(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    ));
    return utcDate.toISOString().split('T')[0];
  }

  /**
   * Get business date range for a given date
   */
  private getBusinessDateRange(date: Date): { start: Date; end: Date } {
    const cutoff = this.getBusinessCutoffTime();
    
    const start = new Date(Date.UTC(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      cutoff.hour,
      cutoff.minute,
      0,
      0
    ));
    
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    end.setUTCMinutes(end.getUTCMinutes() - 1); // 11:59 PM

    return { start, end };
  }

  /**
   * Create or update daily stock snapshot
   */
  async createDailySnapshot(date: Date): Promise<void> {
    const businessDate = this.toBusinessDateString(date);
    const { start: businessStart, end: businessEnd } = this.getBusinessDateRange(date);
    
    console.log(`Creating daily snapshot for ${businessDate}`, { businessStart, businessEnd });

    try {
      // Get all products with current stock
      const products = await this.productsService.fetchAllProducts();
      const productStockSnapshot = await this.getCurrentProductStockSnapshot();
      
      const batch = writeBatch(this.firestore);
      const snapshotCollection = collection(this.firestore, this.DAILY_STOCK_COLLECTION);

      for (const product of products) {
        if (!product.id) continue;

        // Get current stock for all locations for this product
        const productStocks = this.filterStockByProduct(productStockSnapshot, product.id);
        
        for (const [locationId, stockData] of Object.entries(productStocks)) {
          const snapshotId = `${product.id}_${locationId}_${businessDate}`;
          const currentStock = stockData.quantity || 0;
          
          // Get previous day's closing stock as today's opening stock
          const previousDate = new Date(date);
          previousDate.setDate(previousDate.getDate() - 1);
          const previousClosingStock = await this.getClosingStock(product.id, locationId, previousDate);
          
          const snapshotData: Partial<DailyStockSnapshot> = {
            productId: product.id,
            locationId: locationId,
            date: businessDate,
            openingStock: previousClosingStock,
            closingStock: currentStock, // Will be updated throughout the day
            totalReceived: 0, // Will be calculated from movements
            totalIssued: 0, // Will be calculated from movements
            businessDate: businessStart,
            lastUpdated: serverTimestamp(),
            createdAt: serverTimestamp()
          };

          batch.set(doc(snapshotCollection, snapshotId), snapshotData, { merge: true });
        }
      }

      await batch.commit();
      console.log(`Daily snapshot created for ${businessDate}`);
    } catch (error) {
      console.error('Error creating daily snapshot:', error);
      throw error;
    }
  }

  /**
   * Get current product-stock snapshot
   */
  private async getCurrentProductStockSnapshot(): Promise<Record<string, any>> {
    const stockCollection = collection(this.firestore, COLLECTIONS.PRODUCT_STOCK);
    const snapshot = await getDocs(stockCollection);
    
    const stockMap: Record<string, any> = {};
    snapshot.docs.forEach(doc => {
      stockMap[doc.id] = doc.data();
    });
    
    return stockMap;
  }

  /**
   * Filter stock data by product ID
   */
  private filterStockByProduct(stockSnapshot: Record<string, any>, productId: string): Record<string, any> {
    const productStocks: Record<string, any> = {};
    
    Object.entries(stockSnapshot).forEach(([docId, data]) => {
      if (docId.startsWith(`${productId}_`)) {
        const locationId = docId.replace(`${productId}_`, '');
        productStocks[locationId] = data;
      }
    });
    
    return productStocks;
  }

  /**
   * Update daily stock snapshot when stock changes
   */
  async updateDailySnapshot(
    productId: string, 
    locationId: string, 
    date: Date, 
    newStock: number,
    movementType: 'in' | 'out',
    quantity: number
  ): Promise<void> {
    const businessDate = this.toBusinessDateString(date);
    const snapshotId = `${productId}_${locationId}_${businessDate}`;
    
    try {
      const snapshotRef = doc(this.firestore, this.DAILY_STOCK_COLLECTION, snapshotId);
      const snapshotDoc = await getDoc(snapshotRef);
      
      if (snapshotDoc.exists()) {
        const currentData = snapshotDoc.data() as DailyStockSnapshot;
        const updates: Partial<DailyStockSnapshot> = {
          closingStock: newStock,
          lastUpdated: serverTimestamp()
        };

        // Update movement totals
        if (movementType === 'in') {
          updates.totalReceived = (currentData.totalReceived || 0) + quantity;
        } else {
          updates.totalIssued = (currentData.totalIssued || 0) + quantity;
        }

        await setDoc(snapshotRef, updates, { merge: true });
      } else {
        // Create snapshot if it doesn't exist
        await this.createDailySnapshot(date);
        // Recursively call to update the newly created snapshot
        await this.updateDailySnapshot(productId, locationId, date, newStock, movementType, quantity);
      }
    } catch (error) {
      console.error('Error updating daily snapshot:', error);
      throw error;
    }
  }

  /**
   * Get opening stock for a specific product, location, and date
   */
  async getOpeningStock(productId: string, locationId: string, date: Date): Promise<number> {
    const businessDate = this.toBusinessDateString(date);
    const snapshotId = `${productId}_${locationId}_${businessDate}`;
    
    try {
      const snapshotRef = doc(this.firestore, this.DAILY_STOCK_COLLECTION, snapshotId);
      const snapshotDoc = await getDoc(snapshotRef);
      
      if (snapshotDoc.exists()) {
        const data = snapshotDoc.data() as DailyStockSnapshot;
        return data.openingStock || 0;
      }
      
      // If no snapshot exists, try to get from previous day's closing stock
      const previousDate = new Date(date);
      previousDate.setDate(previousDate.getDate() - 1);
      return await this.getClosingStock(productId, locationId, previousDate);
    } catch (error) {
      console.error('Error getting opening stock:', error);
      return 0;
    }
  }

  /**
   * Get closing stock for a specific product, location, and date
   */
  async getClosingStock(productId: string, locationId: string, date: Date): Promise<number> {
    const businessDate = this.toBusinessDateString(date);
    const snapshotId = `${productId}_${locationId}_${businessDate}`;
    
    try {
      const snapshotRef = doc(this.firestore, this.DAILY_STOCK_COLLECTION, snapshotId);
      const snapshotDoc = await getDoc(snapshotRef);
      
      if (snapshotDoc.exists()) {
        const data = snapshotDoc.data() as DailyStockSnapshot;
        return data.closingStock || 0;
      }
      
      // If no snapshot exists for the date, return current stock from product-stock
      const stockDocId = `${productId}_${locationId}`;
      const stockRef = doc(this.firestore, COLLECTIONS.PRODUCT_STOCK, stockDocId);
      const stockDoc = await getDoc(stockRef);
      
      if (stockDoc.exists()) {
        return stockDoc.data()['quantity'] || 0;
      }
      
      return 0;
    } catch (error) {
      console.error('Error getting closing stock:', error);
      return 0;
    }
  }

  /**
   * Get all daily snapshots for a date range
   */
  async getDailySnapshots(startDate: Date, endDate: Date): Promise<DailyStockSnapshot[]> {
    const startDateStr = this.toBusinessDateString(startDate);
    const endDateStr = this.toBusinessDateString(endDate);
    
    try {
      const snapshotCollection = collection(this.firestore, this.DAILY_STOCK_COLLECTION);
      const q = query(
        snapshotCollection,
        where('date', '>=', startDateStr),
        where('date', '<=', endDateStr),
        orderBy('date', 'asc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as DailyStockSnapshot));
    } catch (error) {
      console.error('Error getting daily snapshots:', error);
      return [];
    }
  }

  /**
   * Get stock value for a specific date
   */
  async getStockValueForDate(date: Date, type: 'opening' | 'closing'): Promise<number> {
    try {
      const products = await this.productsService.fetchAllProducts();
      let totalValue = 0;

      for (const product of products) {
        if (!product.id) continue;
        
        const costPrice = product.defaultPurchasePriceExcTax || 0;
        
        // Get stock for all locations for this product
        const productStockSnapshot = await this.getCurrentProductStockSnapshot();
        const productStocks = this.filterStockByProduct(productStockSnapshot, product.id);
        
        for (const locationId of Object.keys(productStocks)) {
          let stockQuantity = 0;
          
          if (type === 'opening') {
            stockQuantity = await this.getOpeningStock(product.id, locationId, date);
          } else {
            stockQuantity = await this.getClosingStock(product.id, locationId, date);
          }
          
          totalValue += stockQuantity * costPrice;
        }
      }

      return totalValue;
    } catch (error) {
      console.error(`Error getting ${type} stock value:`, error);
      return 0;
    }
  }

  /**
   * Initialize daily snapshots for a date if they don't exist
   */
  async initializeDailySnapshotsIfNeeded(date: Date): Promise<void> {
    const businessDate = this.toBusinessDateString(date);
    
    // Check if snapshots already exist for this date
    const snapshotCollection = collection(this.firestore, this.DAILY_STOCK_COLLECTION);
    const q = query(snapshotCollection, where('date', '==', businessDate));
    const existingSnapshots = await getDocs(q);
    
    if (existingSnapshots.empty) {
      console.log(`No snapshots found for ${businessDate}, creating...`);
      await this.createDailySnapshot(date);
    } else {
      console.log(`Snapshots already exist for ${businessDate}`);
    }
  }

  /**
   * Process end of day - finalize closing stock
   */
  async processEndOfDay(date: Date): Promise<void> {
    console.log('Processing end of day for:', date);
    
    try {
      // Get current stock snapshot
      const productStockSnapshot = await this.getCurrentProductStockSnapshot();
      const businessDate = this.toBusinessDateString(date);
      const batch = writeBatch(this.firestore);
      
      // Update all snapshots with final closing stock
      Object.entries(productStockSnapshot).forEach(([docId, stockData]) => {
        const parts = docId.split('_');
        if (parts.length >= 2) {
          const productId = parts[0];
          const locationId = parts.slice(1).join('_');
          const snapshotId = `${productId}_${locationId}_${businessDate}`;
          
          const snapshotRef = doc(this.firestore, this.DAILY_STOCK_COLLECTION, snapshotId);
          batch.update(snapshotRef, {
            closingStock: stockData.quantity || 0,
            lastUpdated: serverTimestamp()
          });
        }
      });
      
      await batch.commit();
      
      // Create next day's snapshots with today's closing as opening
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      await this.createDailySnapshot(nextDay);
      
      console.log('End of day processing completed');
    } catch (error) {
      console.error('Error processing end of day:', error);
      throw error;
    }
  }
}