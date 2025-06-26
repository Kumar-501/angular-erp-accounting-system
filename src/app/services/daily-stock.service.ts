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
  Timestamp,
  onSnapshot,
  increment
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
  ) { }

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
          const previousClosingStock = await this.getOpeningStockFromPreviousDay(product.id, locationId, previousDate);
          const snapshotData: Partial<DailyStockSnapshot> = {
            productId: product.id,
            locationId: locationId,
            date: businessDate,
            openingStock: previousClosingStock, // Will be 0 if no previous data exists
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
  }  /**
   * Update daily stock snapshot when stock changes
   */
/**
   * Create a minimal daily snapshot for a specific product and location
   */
  private async createMinimalDailySnapshot(
    productId: string,
    locationId: string,
    date: Date,
    movementType: 'in' | 'out',
    quantity: number
  ): Promise<void> {
    const businessDate = this.toBusinessDateString(date);
    const { start: businessStart } = this.getBusinessDateRange(date);
    const snapshotId = `${productId}_${locationId}_${businessDate}`;

    console.log(`Creating minimal snapshot: ${snapshotId}`, {
      productId,
      locationId,
      businessDate,
      movementType,
      quantity
    });

    try {
      // Get current stock for this product and location
      const stockDocId = `${productId}_${locationId}`;
      const stockRef = doc(this.firestore, COLLECTIONS.PRODUCT_STOCK, stockDocId);
      const stockDoc = await getDoc(stockRef);
      const currentStock = stockDoc.exists() ? (stockDoc.data()['quantity'] || 0) : 0;

      // Get previous day's closing stock as today's opening stock
      const previousDate = new Date(date);
      previousDate.setDate(previousDate.getDate() - 1);
      const previousClosingStock = await this.getOpeningStockFromPreviousDay(productId, locationId, previousDate);
      const snapshotData: Partial<DailyStockSnapshot> = {
        productId: productId,
        locationId: locationId,
        date: businessDate,
        openingStock: previousClosingStock,
        closingStock: currentStock, // Use actual current stock
        totalReceived: 0, // Don't track movements here anymore
        totalIssued: 0,   // Don't track movements here anymore
        businessDate: businessStart,
        lastUpdated: serverTimestamp(),
        createdAt: serverTimestamp()
      };

      console.log(`Snapshot data for ${snapshotId}:`, {
        openingStock: previousClosingStock,
        closingStock: currentStock,
        movementType,
        quantity,
        note: 'Not tracking movements in snapshots anymore'
      });

      const snapshotRef = doc(this.firestore, this.DAILY_STOCK_COLLECTION, snapshotId);
      await setDoc(snapshotRef, snapshotData);

      console.log(`Minimal daily snapshot created for ${productId} at ${locationId} on ${businessDate}`);
    } catch (error) {
      console.error('Error creating minimal daily snapshot:', error);
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
      return await this.getOpeningStockFromPreviousDay(productId, locationId, previousDate);
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
      const stockDocId = `${productId}_${locationId}`; // TODO: Fanisus 
      const stockRef = doc(this.firestore, COLLECTIONS.PRODUCT_STOCK, stockDocId);
      const stockDoc = await getDoc(stockRef);
      if (snapshotDoc.exists()) {
        const data = snapshotDoc.data() as DailyStockSnapshot;
        if (stockDoc.exists()) {
          // return stockDoc.data()['quantity'] - data.closingStock || 0; // TODO
          return data.closingStock - (data.closingStock - stockDoc.data()['quantity']);
        }
        return data.closingStock || 0;
      }

      // If no snapshot exists for the date, return current stock from product-stock




      return 0;
    } catch (error) {
      console.error('Error getting closing stock:', error);
      return 0;
    }
  }
async getTotalStockSold(productId: string, locationId: string, date: Date): Promise<number> {
    const businessDate = this.toBusinessDateString(date);
    const snapshotId = `${productId}_${locationId}_${businessDate}`;

    try {
      const snapshotRef = doc(this.firestore, this.DAILY_STOCK_COLLECTION, snapshotId);
      const snapshotDoc = await getDoc(snapshotRef);
      const stockDocId = `${productId}_${locationId}`; // TODO: Fanisus 
      const stockRef = doc(this.firestore, COLLECTIONS.PRODUCT_STOCK, stockDocId);
      const stockDoc = await getDoc(stockRef);
      if (snapshotDoc.exists()) {
        const data = snapshotDoc.data() as DailyStockSnapshot;
        if (stockDoc.exists()) {
          return data.closingStock - stockDoc.data()['quantity'];
        }
        return data.closingStock || 0;
      }
      // If no snapshot exists for the date, return current stock from product-stock

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

  /**
   * Subscribe to all daily snapshots for a date range in real-time (no cache)
   * Returns the unsubscribe function from onSnapshot.
   */
  subscribeToDailySnapshots(
    startDate: Date,
    endDate: Date,
    callback: (snapshots: DailyStockSnapshot[]) => void
  ): () => void {
    const startDateStr = this.toBusinessDateString(startDate);
    const endDateStr = this.toBusinessDateString(endDate);
    const snapshotCollection = collection(this.firestore, this.DAILY_STOCK_COLLECTION);
    const q = query(
      snapshotCollection,
      where('date', '>=', startDateStr),
      where('date', '<=', endDateStr),
      orderBy('date', 'asc')
    );
    // Use Firestore's onSnapshot for real-time updates
    return onSnapshot(q, (querySnapshot) => {
      const results: DailyStockSnapshot[] = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }) as DailyStockSnapshot);
      callback(results);
    }, (error) => {
      console.error('Error in real-time daily snapshots listener:', error);
      callback([]);
    });
  }  /**
   * Process GIN stock log movement
   */
  private async processGinStockLogMovement(data: any): Promise<void> {
    try {
      const fromLocationId = this.validateLocationId(data.fromLocation, 'GIN stock movement - from location');
      const toLocationId = this.validateLocationId(data.toLocationId, 'GIN stock movement - to location');
      const productId = data.productId;
      const transferAmount = data.transferAmount || 0;
      const createdDate = data.createdDate?.toDate() || new Date();

      if (productId && fromLocationId && toLocationId && transferAmount > 0) {
        console.log(`GIN stock movement: ${productId}, from ${fromLocationId} to ${toLocationId}, qty: ${transferAmount}`);

        // Update daily snapshots for both locations
        await this.updateDailySnapshot(productId, fromLocationId, createdDate, 0, 'out', transferAmount);
        await this.updateDailySnapshot(productId, toLocationId, createdDate, 0, 'in', transferAmount);
      }
    } catch (error) {
      console.error('Error processing GIN stock log movement:', error);
    }
  }  /**
   * Process purchase return movement
   */
  private async processPurchaseReturnMovement(data: any): Promise<void> {
    try {
      const productId = data.productId;
      const businessLocationId = this.validateLocationId(data.businessLocationId, 'purchase return movement');
      const returnQuantity = data.returnQuantity || 0;
      const returnDate = data.returnDate ? new Date(data.returnDate) : new Date();

      if (productId && businessLocationId && returnQuantity > 0) {
        console.log(`Purchase return movement: ${productId} at ${businessLocationId}, qty: ${returnQuantity}`);

        // Purchase return reduces stock (item goes back to supplier)
        await this.updateDailySnapshot(productId, businessLocationId, returnDate, 0, 'out', returnQuantity);
      }
    } catch (error) {
      console.error('Error processing purchase return movement:', error);
    }
  }

  /**
   * Process sales return movement
   */
  private async processSalesReturnMovement(data: any): Promise<void> {
    try {
      const items = data.items || [];
      const returnDate = data.returnDate?.toDate() || new Date();

      for (const item of items) {
        const productId = item.productId;
        const returnQuantity = item.returnQuantity || 0;

        if (productId && returnQuantity > 0) {
          console.log(`Sales return movement: ${productId}, qty: ${returnQuantity}`);

          // Sales return adds back to stock
          // We need to determine the location - this might need to be enhanced based on your business logic
          // For now, we'll try to find the product in product-stock collection
          const productStockSnapshot = await this.getCurrentProductStockSnapshot();

          Object.entries(productStockSnapshot).forEach(async ([docId, stockData]) => {
            if (docId.startsWith(`${productId}_`)) {
              const locationId = docId.replace(`${productId}_`, '');
              await this.updateDailySnapshot(productId, locationId, returnDate, 0, 'in', returnQuantity);
            }
          });
        }
      }
    } catch (error) {
      console.error('Error processing sales return movement:', error);
    }
  }

  /**
   * Subscribe to GIN stock log changes in real-time
   */
  subscribeToGinStockLog(callback: (changes: any[]) => void): () => void {
    const ginStockLogCollection = collection(this.firestore, 'gin-stock-log');

    return onSnapshot(ginStockLogCollection, (snapshot) => {
      console.log('GIN stock log changes detected');

      const changes = snapshot.docChanges().map(change => ({
        type: change.type,
        doc: change.doc,
        data: change.doc.data()
      }));

      // Process GIN transfers
      changes.forEach(change => {
        if (change.type === 'added') {
          this.processGinStockLogMovement(change.data);
        }
      });

      callback(changes);
    }, (error) => {
      console.error('Error listening to GIN stock log changes:', error);
      callback([]);
    });
  }

  /**
   * Subscribe to purchase return log changes in real-time
   */
  subscribeToPurchaseReturnLog(callback: (changes: any[]) => void): () => void {
    const purchaseReturnLogCollection = collection(this.firestore, 'purchase-return-log');

    return onSnapshot(purchaseReturnLogCollection, (snapshot) => {
      console.log('Purchase return log changes detected');

      const changes = snapshot.docChanges().map(change => ({
        type: change.type,
        doc: change.doc,
        data: change.doc.data()
      }));

      // Process purchase returns
      changes.forEach(change => {
        if (change.type === 'added') {
          this.processPurchaseReturnMovement(change.data);
        }
      });

      callback(changes);
    }, (error) => {
      console.error('Error listening to purchase return log changes:', error);
      callback([]);
    });
  }

  /**
   * Subscribe to sales return log changes in real-time
   */
  subscribeToSalesReturnLog(callback: (changes: any[]) => void): () => void {
    const salesReturnLogCollection = collection(this.firestore, 'sales-return-log');

    return onSnapshot(salesReturnLogCollection, (snapshot) => {
      console.log('Sales return log changes detected');

      const changes = snapshot.docChanges().map(change => ({
        type: change.type,
        doc: change.doc,
        data: change.doc.data()
      }));

      // Process sales returns
      changes.forEach(change => {
        if (change.type === 'added') {
          this.processSalesReturnMovement(change.data);
        }
      });

      callback(changes);
    }, (error) => {
      console.error('Error listening to sales return log changes:', error);
      callback([]);
    });
  }

  /**
   * Subscribe to product stock changes in real-time
   */
  subscribeToProductStock(callback: (changes: any[]) => void): () => void {
    const productStockCollection = collection(this.firestore, COLLECTIONS.PRODUCT_STOCK);

    return onSnapshot(productStockCollection, (snapshot) => {
      console.log('Product stock changes detected');

      const changes = snapshot.docChanges().map(change => ({
        type: change.type,
        doc: change.doc,
        data: change.doc.data()
      }));

      // Process stock changes
      changes.forEach(change => {
        if (change.type === 'added' || change.type === 'modified') {
          this.processProductStockChange(change.doc.id, change.data);
        }
      });

      callback(changes);
    }, (error) => {
      console.error('Error listening to product stock changes:', error);
      callback([]);
    });
  }

  /**
   * Subscribe to purchase stock price log changes in real-time
   */
  subscribeToPurchaseStockPriceLog(callback: (changes: any[]) => void): () => void {
    const purchaseLogCollection = collection(this.firestore, 'purchase-stock-price-log');

    return onSnapshot(purchaseLogCollection, (snapshot) => {
      console.log('Purchase stock price log changes detected');

      const changes = snapshot.docChanges().map(change => ({
        type: change.type,
        doc: change.doc,
        data: change.doc.data()
      }));

      // Process purchase movements
      changes.forEach(change => {
        if (change.type === 'added') {
          this.processPurchaseStockMovement(change.data);
        }
      });

      callback(changes);
    }, (error) => {
      console.error('Error listening to purchase stock price log changes:', error);
      callback([]);
    });
  }

  /**
   * Subscribe to sales stock price log changes in real-time
   */
  subscribeToSalesStockPriceLog(callback: (changes: any[]) => void): () => void {
    const salesLogCollection = collection(this.firestore, 'sales-stock-price-log');

    return onSnapshot(salesLogCollection, (snapshot) => {
      console.log('Sales stock price log changes detected');

      const changes = snapshot.docChanges().map(change => ({
        type: change.type,
        doc: change.doc,
        data: change.doc.data()
      }));

      // Process sales movements
      changes.forEach(change => {
        if (change.type === 'added') {
          this.processSalesStockMovement(change.data);
        }
      });

      callback(changes);
    }, (error) => {
      console.error('Error listening to sales stock price log changes:', error);
      callback([]);
    });
  }

  /**
   * Process product stock change
   */
  private async processProductStockChange(docId: string, data: any): Promise<void> {
    try {
      const parts = docId.split('_');
      if (parts.length >= 2) {
        const productId = parts[0];
        const locationId = parts.slice(1).join('_');
        const currentStock = data.quantity || 0;
        const updatedAt = data.updatedAt?.toDate() || new Date();

        console.log(`Product stock changed: ${productId} at ${locationId}, new stock: ${currentStock}`);

        // Update daily snapshot with current stock as closing stock
        await this.updateDailySnapshotClosingStock(productId, locationId, updatedAt, currentStock);
      }
    } catch (error) {
      console.error('Error processing product stock change:', error);
    }
  }  /**
   * Process purchase stock movement
   */
  private async processPurchaseStockMovement(data: any): Promise<void> {
    try {
      const productId = data.productId;
      const locationId = this.validateLocationId(data.locationId, 'purchase stock movement');
      const receivedQuantity = data.receivedQuantity || 0;
      const grnCreatedDate = data.grnCreatedDate?.toDate() || new Date();

      if (productId && locationId && receivedQuantity > 0) {
        console.log(`Purchase stock movement: ${productId} at ${locationId}, qty: ${receivedQuantity}`);

        // Purchase increases stock
        await this.updateDailySnapshot(productId, locationId, grnCreatedDate, 0, 'in', receivedQuantity);
      }
    } catch (error) {
      console.error('Error processing purchase stock movement:', error);
    }
  }

  /**
   * Process sales stock movement
   */
  private async processSalesStockMovement(data: any): Promise<void> {
    try {
      const productId = data.productId;
      const location = data.location; // This is location name
      const quantity = data.quantity || 0;
      const saleCreatedDate = data.saleCreatedDate ? new Date(data.saleCreatedDate) : new Date();

      if (productId && location && quantity > 0) {
        // Map location name to location ID
        const locationId = this.getLocationIdByName(location);

        if (locationId) {
          console.log(`Sales stock movement: ${productId} at ${locationId}, qty: ${quantity}`);

          // Sales decreases stock
          await this.updateDailySnapshot(productId, locationId, saleCreatedDate, 0, 'out', quantity);
        }
      }
    } catch (error) {
      console.error('Error processing sales stock movement:', error);
    }
  }

  /**
   * Helper method to map location names to IDs
   */
  private getLocationIdByName(locationName: string): string | null {
    const locationMappings: Record<string, string> = {
      'Herbaly Touch Main': '6j0v6tR66jGMPLG2xRPW',
      'Herbaly Touch PP': '8YbvSEo0viqLT3Bg0GYi',
      'Herbaly Touch COD': '8sYWrQexfc6BnTyIuZtK'
    };

    return locationMappings[locationName] || null;
  }
// In daily-stock.service.ts

async updateDailySnapshot(
  productId: string,
  locationId: string,
  date: Date,
  newStock: number,
  movementType: 'in' | 'out',
  quantity: number
): Promise<void> {
  try {
    const dateKey = date.toISOString().split('T')[0];
    const snapshotId = `${productId}_${locationId}_${dateKey}`;
    const snapshotRef = doc(this.firestore, COLLECTIONS.DAILY_STOCK, snapshotId);
    
    const snapshotData = {
      productId,
      locationId,
      date: dateKey,
      lastUpdated: new Date(),
      [movementType === 'in' ? 'stockIn' : 'stockOut']: increment(quantity),
      closingStock: newStock
    };
    
    await setDoc(snapshotRef, snapshotData, { merge: true });
  } catch (error) {
    console.error('Error updating daily stock snapshot:', error);
    throw error;
  }
}
  private async updateDailySnapshotClosingStock(
    productId: string,
    locationId: string,
    date: Date,
    newStock: number
  ): Promise<void> {
    const businessDate = this.toBusinessDateString(date);
    const snapshotId = `${productId}_${locationId}_${businessDate}`;

    try {
      const snapshotRef = doc(this.firestore, this.DAILY_STOCK_COLLECTION, snapshotId);

      // Get the actual current stock from product-stock collection to be sure
      const stockDocId = `${productId}_${locationId}`;
      const stockRef = doc(this.firestore, COLLECTIONS.PRODUCT_STOCK, stockDocId);
      const stockDoc = await getDoc(stockRef);
      const actualCurrentStock = stockDoc.exists() ? (stockDoc.data()['quantity'] || 0) : newStock;

      const updates: Partial<DailyStockSnapshot> = {
        closingStock: actualCurrentStock, // Use actual current stock
        lastUpdated: serverTimestamp()
      };

      await setDoc(snapshotRef, updates, { merge: true });

      console.log(`Updated closing stock for ${productId} at ${locationId} on ${businessDate}: ${actualCurrentStock}`);
    } catch (error) {
      console.error('Error updating daily snapshot closing stock:', error);
    }
  }

  /**
   * Subscribe to all stock movement collections
   * Returns an object with unsubscribe functions for each listener
   */
  subscribeToAllStockMovements(callbacks?: {
    onGinStockLog?: (changes: any[]) => void;
    onPurchaseReturnLog?: (changes: any[]) => void;
    onSalesReturnLog?: (changes: any[]) => void;
    onProductStock?: (changes: any[]) => void;
    onPurchaseStockPriceLog?: (changes: any[]) => void;
    onSalesStockPriceLog?: (changes: any[]) => void;
  }): {
    unsubscribeGinStockLog: () => void;
    unsubscribePurchaseReturnLog: () => void;
    unsubscribeSalesReturnLog: () => void;
    unsubscribeProductStock: () => void;
    unsubscribePurchaseStockPriceLog: () => void;
    unsubscribeSalesStockPriceLog: () => void;
    unsubscribeAll: () => void;
  } {
    const unsubscribeGinStockLog = this.subscribeToGinStockLog(
      callbacks?.onGinStockLog || (() => { })
    );

    const unsubscribePurchaseReturnLog = this.subscribeToPurchaseReturnLog(
      callbacks?.onPurchaseReturnLog || (() => { })
    );

    const unsubscribeSalesReturnLog = this.subscribeToSalesReturnLog(
      callbacks?.onSalesReturnLog || (() => { })
    );

    const unsubscribeProductStock = this.subscribeToProductStock(
      callbacks?.onProductStock || (() => { })
    );

    const unsubscribePurchaseStockPriceLog = this.subscribeToPurchaseStockPriceLog(
      callbacks?.onPurchaseStockPriceLog || (() => { })
    );

    const unsubscribeSalesStockPriceLog = this.subscribeToSalesStockPriceLog(
      callbacks?.onSalesStockPriceLog || (() => { })
    );

    return {
      unsubscribeGinStockLog,
      unsubscribePurchaseReturnLog,
      unsubscribeSalesReturnLog,
      unsubscribeProductStock,
      unsubscribePurchaseStockPriceLog,
      unsubscribeSalesStockPriceLog,
      unsubscribeAll: () => {
        unsubscribeGinStockLog();
        unsubscribePurchaseReturnLog();
        unsubscribeSalesReturnLog();
        unsubscribeProductStock();
        unsubscribePurchaseStockPriceLog();
        unsubscribeSalesStockPriceLog();
      }
    };
  }
  /**
   * Validate and extract locationId from various formats
   */
  private validateLocationId(locationId: any, context: string = ''): string | null {
    // If it's already a string, return it
    if (typeof locationId === 'string') {
      return locationId;
    }

    // If it's an object, try to extract the ID
    if (typeof locationId === 'object' && locationId !== null) {
      // Try common property names for location ID
      const extractedId = locationId.id ||
        locationId.locationId ||
        locationId.value ||
        locationId._id ||
        locationId.key;

      if (typeof extractedId === 'string') {
        console.log(`Extracted locationId from object in ${context}:`, extractedId);
        return extractedId;
      }

      // Log the object structure for debugging
      console.warn(`Could not extract locationId from object in ${context}:`, {
        object: locationId,
        keys: Object.keys(locationId),
        values: Object.values(locationId)
      });
    }

    console.warn(`Invalid locationId in ${context}:`, locationId);
    return null;
  }
  /**
   * Clean up existing daily snapshots with invalid locationId objects
   */
  async cleanupInvalidLocationIds(): Promise<void> {
    console.log('Starting cleanup of invalid locationId objects in daily snapshots...');

    try {
      const snapshotCollection = collection(this.firestore, this.DAILY_STOCK_COLLECTION);
      const snapshot = await getDocs(snapshotCollection);
      const batch = writeBatch(this.firestore);
      let cleanupCount = 0;

      for (const doc of snapshot.docs) {
        const data = doc.data();
        const docRef = doc.ref;

        // Check if locationId is an object
        if (typeof data['locationId'] === 'object' && data['locationId'] !== null) {
          const validLocationId = this.validateLocationId(data['locationId'], 'cleanup');

          if (validLocationId) {
            // Update the document with the correct locationId
            batch.update(docRef, {
              locationId: validLocationId,
              lastUpdated: serverTimestamp()
            });

            cleanupCount++;
            console.log(`Queued cleanup for document ${doc.id}: ${JSON.stringify(data['locationId'])} -> ${validLocationId}`);
          } else {
            console.warn(`Could not extract valid locationId from document ${doc.id}:`, data['locationId']);
          }
        }
      }

      if (cleanupCount > 0) {
        await batch.commit();
        console.log(`Successfully cleaned up ${cleanupCount} documents with invalid locationIds`);
      } else {
        console.log('No documents found with invalid locationIds');
      }
    } catch (error) {
      console.error('Error during cleanup of invalid locationIds:', error);
      throw error;
    }
  }

  /**
   * Helper method to call cleanup from console or other parts of the app
   */
  async runCleanup(): Promise<void> {
    console.log('Running daily stock snapshot cleanup...');
    await this.cleanupInvalidLocationIds();
  }

  /**
   * Fix existing daily snapshots with incorrect closing stock
   * This method recalculates closing stock based on actual current stock
   */
  async fixDailySnapshots(): Promise<void> {
    try {
      console.log('Starting to fix daily snapshots...');

      // Get all daily snapshots
      const snapshotsCollection = collection(this.firestore, this.DAILY_STOCK_COLLECTION);
      const snapshotsSnapshot = await getDocs(snapshotsCollection);

      console.log(`Found ${snapshotsSnapshot.docs.length} daily snapshots to process`);

      // Group snapshots by product and location
      const productLocationDates: { [key: string]: { date: string, docId: string, data: any }[] } = {};
      snapshotsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const key = `${data['productId']}_${data['locationId']}`;

        if (!productLocationDates[key]) {
          productLocationDates[key] = [];
        }

        productLocationDates[key].push({
          date: data['date'],
          docId: doc.id,
          data: data
        });
      });

      // Process each product-location combination
      for (const [productLocationKey, snapshots] of Object.entries(productLocationDates)) {
        const [productId, locationId] = productLocationKey.split('_');

        // Sort snapshots by date
        snapshots.sort((a, b) => a.date.localeCompare(b.date));

        console.log(`Processing ${snapshots.length} snapshots for ${productId} at ${locationId}`);
        // Get current actual stock for this product and location
        const stockDocId = `${productId}_${locationId}`;
        const stockRef = doc(this.firestore, COLLECTIONS.PRODUCT_STOCK, stockDocId);
        const stockDoc = await getDoc(stockRef);
        const currentActualStock = stockDoc.exists() ? (stockDoc.data()['quantity'] || 0) : 0;

        console.log(`Current actual stock for ${productId} at ${locationId}: ${currentActualStock}`);

        // Process each snapshot
        for (let i = 0; i < snapshots.length; i++) {
          const snapshot = snapshots[i];
          let correctClosingStock: number;

          // For the latest snapshot, use actual current stock
          if (i === snapshots.length - 1) {
            correctClosingStock = currentActualStock;
          } else {
            // For older snapshots, calculate based on the opening stock of the next day
            const nextSnapshot = snapshots[i + 1];
            correctClosingStock = nextSnapshot.data['openingStock'] || 0;
          }

          // Update the snapshot if the closing stock is wrong or reset movement tracking
          if (snapshot.data['closingStock'] !== correctClosingStock ||
            snapshot.data['totalReceived'] !== 0 ||
            snapshot.data['totalIssued'] !== 0) {
            const snapshotRef = doc(this.firestore, this.DAILY_STOCK_COLLECTION, snapshot.docId);
            await setDoc(snapshotRef, {
              closingStock: correctClosingStock,
              totalReceived: 0, // Reset movement tracking
              totalIssued: 0,   // Reset movement tracking
              lastUpdated: serverTimestamp()
            }, { merge: true });

            console.log(`Fixed snapshot ${snapshot.docId}: closing ${snapshot.data['closingStock']} → ${correctClosingStock}, reset movements`);
          }
        }
      }

      console.log('Daily snapshots fix completed');
    } catch (error) {
      console.error('Error fixing daily snapshots:', error);
      throw error;
    }
  }

  /**
   * Helper method to run the fix from console or other parts of the app
   */
  async runSnapshotFix(): Promise<void> {
    try {
      await this.fixDailySnapshots();
      console.log('✅ Daily snapshot fix completed successfully');
    } catch (error) {
      console.error('❌ Daily snapshot fix failed:', error);
    }
  }

  /**
   * Completely rebuild daily snapshots based on actual current stock
   * This method removes all movement tracking and uses only actual stock values
   */
  async rebuildDailySnapshotsFromCurrentStock(): Promise<void> {
    try {
      console.log('Starting complete rebuild of daily snapshots from current stock...');

      // Get all daily snapshots
      const snapshotsCollection = collection(this.firestore, this.DAILY_STOCK_COLLECTION);
      const snapshotsSnapshot = await getDocs(snapshotsCollection);

      console.log(`Found ${snapshotsSnapshot.docs.length} daily snapshots to rebuild`);

      // Get current stock for all products and locations
      const currentStockSnapshot = await this.getCurrentProductStockSnapshot();
      console.log(`Found ${Object.keys(currentStockSnapshot).length} current stock entries`);

      // Group snapshots by product and location
      const productLocationDates: { [key: string]: { date: string, docId: string, data: any }[] } = {};

      snapshotsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const key = `${data['productId']}_${data['locationId']}`;

        if (!productLocationDates[key]) {
          productLocationDates[key] = [];
        }

        productLocationDates[key].push({
          date: data['date'],
          docId: doc.id,
          data: data
        });
      });

      // Process each product-location combination
      for (const [productLocationKey, snapshots] of Object.entries(productLocationDates)) {
        const [productId, locationId] = productLocationKey.split('_');

        // Get current actual stock for this product and location
        const stockDocId = `${productId}_${locationId}`;
        const currentActualStock = currentStockSnapshot[stockDocId]?.quantity || 0;

        // Sort snapshots by date
        snapshots.sort((a, b) => a.date.localeCompare(b.date));

        console.log(`Rebuilding ${snapshots.length} snapshots for ${productId} at ${locationId}, current stock: ${currentActualStock}`);

        // For the latest snapshot, set closing stock to current actual stock
        if (snapshots.length > 0) {
          const latestSnapshot = snapshots[snapshots.length - 1];
          const snapshotRef = doc(this.firestore, this.DAILY_STOCK_COLLECTION, latestSnapshot.docId);

          await setDoc(snapshotRef, {
            closingStock: currentActualStock,
            totalReceived: 0, // Remove movement tracking
            totalIssued: 0,   // Remove movement tracking
            lastUpdated: serverTimestamp()
          }, { merge: true });

          console.log(`Rebuilt latest snapshot ${latestSnapshot.docId}: closing stock set to ${currentActualStock}`);

          // For older snapshots, set closing stock to next day's opening stock
          for (let i = snapshots.length - 2; i >= 0; i--) {
            const snapshot = snapshots[i];
            const nextSnapshot = snapshots[i + 1];
            const correctClosingStock = nextSnapshot.data['openingStock'] || 0;

            const snapshotRef = doc(this.firestore, this.DAILY_STOCK_COLLECTION, snapshot.docId);
            await setDoc(snapshotRef, {
              closingStock: correctClosingStock,
              totalReceived: 0, // Remove movement tracking
              totalIssued: 0,   // Remove movement tracking
              lastUpdated: serverTimestamp()
            }, { merge: true });

            console.log(`Rebuilt snapshot ${snapshot.docId}: closing stock set to ${correctClosingStock}`);
          }
        }
      }

      console.log('Complete rebuild of daily snapshots completed');
    } catch (error) {
      console.error('Error rebuilding daily snapshots:', error);
      throw error;
    }
  }

  /**
   * Helper method to run the complete rebuild from console
   */
  async runCompleteRebuild(): Promise<void> {
    try {
      await this.rebuildDailySnapshotsFromCurrentStock();
      console.log('✅ Complete daily snapshot rebuild completed successfully');
    } catch (error) {
      console.error('❌ Complete daily snapshot rebuild failed:', error);
    }
  }

  /**
   * Get opening stock from previous day's closing stock, defaulting to 0 if no historical data exists
   */
  private async getOpeningStockFromPreviousDay(productId: string, locationId: string, previousDate: Date): Promise<number> {
    const businessDate = this.toBusinessDateString(previousDate);
    const snapshotId = `${productId}_${locationId}_${businessDate}`;

    try {
      const snapshotRef = doc(this.firestore, this.DAILY_STOCK_COLLECTION, snapshotId);
      const snapshotDoc = await getDoc(snapshotRef);

      if (snapshotDoc.exists()) {
        const data = snapshotDoc.data() as DailyStockSnapshot;
        const closingStock = data.closingStock || 0;
        console.log(`Found previous day closing stock for ${productId} at ${locationId} on ${businessDate}: ${closingStock}`);
        return closingStock;
      }

      // If no previous snapshot exists, start with 0 opening stock for new tracking
      console.log(`No previous snapshot found for ${productId} at ${locationId} on ${businessDate}, defaulting opening stock to 0`);
      return 0;
    } catch (error) {
      console.error('Error getting opening stock from previous day:', error);
      // Default to 0 if there's any error
      return 0;
    }
  }

  /**
   * Initialize opening stock for a new product/location combination
   * This is useful when a product is first introduced to a location
   */
  async initializeProductLocationStock(productId: string, locationId: string, initialStock: number = 0): Promise<void> {
    const today = new Date();
    const businessDate = this.toBusinessDateString(today);
    const { start: businessStart } = this.getBusinessDateRange(today);
    const snapshotId = `${productId}_${locationId}_${businessDate}`;

    try {
      const snapshotRef = doc(this.firestore, this.DAILY_STOCK_COLLECTION, snapshotId);
      const existingSnapshot = await getDoc(snapshotRef);

      if (!existingSnapshot.exists()) {
        const snapshotData: Partial<DailyStockSnapshot> = {
          productId: productId,
          locationId: locationId,
          date: businessDate,
          openingStock: initialStock,
          closingStock: initialStock,
          totalReceived: initialStock > 0 ? initialStock : 0,
          totalIssued: 0,
          businessDate: businessStart,
          lastUpdated: serverTimestamp(),
          createdAt: serverTimestamp()
        };

        await setDoc(snapshotRef, snapshotData);
        console.log(`Initialized stock tracking for ${productId} at ${locationId} with opening stock: ${initialStock}`);
      } else {
        console.log(`Stock tracking already exists for ${productId} at ${locationId}`);
      }
    } catch (error) {
      console.error('Error initializing product location stock:', error);
      throw error;
    }
  }

  /**
   * Debug method to check current stock for a specific product
   */
  async debugProductStock(productId: string, locationId: string): Promise<void> {
    try {
      console.log(`=== DEBUG: Product Stock for ${productId} at ${locationId} ===`);

      // Get current stock from product-stock collection
      const stockDocId = `${productId}_${locationId}`;
      const stockRef = doc(this.firestore, COLLECTIONS.PRODUCT_STOCK, stockDocId);
      const stockDoc = await getDoc(stockRef);
      const currentStock = stockDoc.exists() ? (stockDoc.data()['quantity'] || 0) : 0;

      console.log(`Current actual stock in product-stock: ${currentStock}`);

      // Get all daily snapshots for this product/location
      const snapshotsCollection = collection(this.firestore, this.DAILY_STOCK_COLLECTION);
      const q = query(
        snapshotsCollection,
        where('productId', '==', productId),
        where('locationId', '==', locationId),
        orderBy('date', 'asc')
      );

      const querySnapshot = await getDocs(q);
      console.log(`Found ${querySnapshot.docs.length} daily snapshots:`);

      querySnapshot.docs.forEach(doc => {
        const data = doc.data();
        console.log(`Date: ${data['date']}, Opening: ${data['openingStock']}, Closing: ${data['closingStock']}, Received: ${data['totalReceived']}, Issued: ${data['totalIssued']}`);
      });

      console.log(`=== END DEBUG ===`);
    } catch (error) {
      console.error('Error in debug product stock:', error);
    }
  }

  /**
   * Helper method to run debug from console
   */
  async runDebug(productId: string = 'Cr1KZ3WOFKXHAfZxPeEN', locationId: string = '6j0v6tR66jGMPLG2xRPW'): Promise<void> {
    await this.debugProductStock(productId, locationId);
  }
}