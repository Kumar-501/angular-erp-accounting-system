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
  limit
} from '@angular/fire/firestore';
import { ProductsService } from './products.service';
import { COLLECTIONS } from '../../utils/constants';

export interface DailyStockSnapshot {
  id?: string;
  productId: string;
  locationId: string;
  date: string;
  openingStock: number;
  closingStock: number;
  unitCost?: number; // <--- ADD THIS LINE
  totalReceived: number;
  totalIssued: number;
  lastUpdated: Date | Timestamp | any;
  createdAt: Date | Timestamp | any;
  businessDate: Date | Timestamp | any;
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

  private getBusinessCutoffTime(): { hour: number; minute: number } {
    return { hour: 0, minute: 1 };
  }
// src/app/services/daily-stock.service.ts
// src/app/services/daily-stock.service.ts

private async hasTransactionsOnDate(date: Date): Promise<boolean> {
  try {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const startTimestamp = Timestamp.fromDate(startOfDay);
    const endTimestamp = Timestamp.fromDate(endOfDay);

    // 1. Check for sales
    const salesSnapshot = await getDocs(query(collection(this.firestore, 'sales'), 
      where('saleDate', '>=', startTimestamp), where('saleDate', '<=', endTimestamp)));
    if (!salesSnapshot.empty) return true;

    // 2. Check for purchases
    const purchasesSnapshot = await getDocs(query(collection(this.firestore, 'purchases'), 
      where('purchaseDate', '>=', startTimestamp), where('purchaseDate', '<=', endTimestamp)));
    if (!purchasesSnapshot.empty) return true;

    // 3. ADDED: Check for Goods Received (GRN)
    const grnSnapshot = await getDocs(query(collection(this.firestore, 'goodsReceived'), 
      where('receivedDate', '>=', startTimestamp), where('receivedDate', '<=', endTimestamp)));
    if (!grnSnapshot.empty) return true;

    // 4. Check for Stock History/Adjustments
    const historySnapshot = await getDocs(query(collection(this.firestore, COLLECTIONS.PRODUCT_STOCK_HISTORY), 
      where('timestamp', '>=', startTimestamp), where('timestamp', '<=', endTimestamp)));
    if (!historySnapshot.empty) return true;

    return false;
  } catch (error) {
    console.error('Error checking for transactions:', error);
    return true; 
  }
}
  private toBusinessDateString(date: Date): string {
    const utcDate = new Date(Date.UTC(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    ));
    return utcDate.toISOString().split('T')[0];
  }
// In daily-stock.service.ts - Replace the getStockValueForDate method

async getStockValueForDate(date: Date, type: 'opening' | 'closing'): Promise<number> {
  try {
    const products = await this.productsService.fetchAllProducts();
    let totalValue = 0;

    let queryDate = new Date(date);
    if (type === 'opening') {
      queryDate.setDate(queryDate.getDate() - 1);
    }
    
    const queryDateStr = this.toBusinessDateString(queryDate);
    const snapshotCollection = collection(this.firestore, this.DAILY_STOCK_COLLECTION);
    const q = query(snapshotCollection, where('date', '==', queryDateStr));
    const querySnapshot = await getDocs(q);

    let stockMap: Record<string, any> = {}; 
    querySnapshot.forEach(doc => {
      const data = doc.data();
      stockMap[`${data['productId']}_${data['locationId']}`] = data; 
    });

    const missingSnapshotPromises: Promise<number>[] = [];

    for (const product of products) {
      if (!product.id) continue;
      
      const purchaseCost = product.defaultPurchasePriceExcTax || product.unitPurchasePrice || 0;

      const productStockSnapshot = await this.getCurrentProductStockSnapshot(); 
      const productStocksAtLocations = this.filterStockByProduct(productStockSnapshot, product.id);

      for (const locationId of Object.keys(productStocksAtLocations)) {
        const key = `${product.id}_${locationId}`;

        if (stockMap[key] !== undefined) {
          const data = stockMap[key];
          const qty = data['closingStock'] || 0;
          totalValue += (qty * purchaseCost);
        }
        else {
          const lookbackTask = this.getLastAvailableClosingStock(product.id, locationId, queryDateStr)
            .then(qty => qty * purchaseCost);
          
          missingSnapshotPromises.push(lookbackTask);
        }
      }
    }

    if (missingSnapshotPromises.length > 0) {
      const resolvedValues = await Promise.all(missingSnapshotPromises);
      totalValue += resolvedValues.reduce((sum, val) => sum + val, 0);
    }

    // ✅ NEW LOGIC: If no transactions happened today, closing = opening
    if (type === 'closing') {
      const hasTransactionsToday = await this.hasTransactionsOnDate(date);
      
      if (!hasTransactionsToday) {
        console.log(`⚠️ No transactions on ${date.toDateString()}, using opening stock as closing`);
        return this.getStockValueForDate(date, 'opening');
      }
    }

    return parseFloat(totalValue.toFixed(2));
  } catch (error) {
    console.error(`Error getting ${type} stock value:`, error);
    return 0;
  }
}
async updateDailySnapshot(
  productId: string,
  locationId: string,
  date: Date,
  newStock: number, 
  movementType: 'in' | 'out' | 'refresh',
  quantity: number,
  reference?: string,
  unitCost?: number  // ✅ This parameter must exist
): Promise<void> {
  const businessDateStr = this.toBusinessDateString(date);
  const snapshotId = `${productId}_${locationId}_${businessDateStr}`;
  const snapshotRef = doc(this.firestore, this.DAILY_STOCK_COLLECTION, snapshotId);

  try {
    const stockDocId = `${productId}_${locationId}`;
    const stockRef = doc(this.firestore, COLLECTIONS.PRODUCT_STOCK, stockDocId);
    const stockDoc = await getDoc(stockRef);
    
    const actualCurrentStock = stockDoc.exists() ? (stockDoc.data()['quantity'] || 0) : 0;
    
    // ✅ CRITICAL: Prioritize the cost passed from the transaction
    const actualUnitCost = unitCost || (stockDoc.exists() ? (stockDoc.data()['unitCost'] || 0) : 0);

    const snapshotSnap = await getDoc(snapshotRef);

    if (snapshotSnap.exists()) {
      const existing = snapshotSnap.data();
      const updates: any = {
        closingStock: actualCurrentStock,
        unitCost: actualUnitCost,  // ✅ MUST UPDATE THIS
        lastUpdated: serverTimestamp()
      };
      if (movementType === 'in') updates.totalReceived = (existing['totalReceived'] || 0) + quantity;
      if (movementType === 'out') updates.totalIssued = (existing['totalIssued'] || 0) + quantity;
      
      await setDoc(snapshotRef, updates, { merge: true });
    } else {
      // Creating new snapshot
      const openingStock = await this.getLastAvailableClosingStock(productId, locationId, businessDateStr);

      const snapshotData: DailyStockSnapshot = {
        productId,
        locationId,
        date: businessDateStr,
        openingStock: openingStock, 
        closingStock: actualCurrentStock,
        unitCost: actualUnitCost,  // ✅ MUST SET THIS
        totalReceived: movementType === 'in' ? quantity : 0,
        totalIssued: movementType === 'out' ? quantity : 0,
        lastUpdated: serverTimestamp(),
        createdAt: serverTimestamp(),
        businessDate: Timestamp.fromDate(date)
      };
      await setDoc(snapshotRef, snapshotData);
    }
  } catch (error) {
    console.error('Error in updateDailySnapshot:', error);
  }
}

private async getLastAvailableClosingStock(productId: string, locationId: string, beforeDateStr: string): Promise<number> {
  try {
    const snapshotCollection = collection(this.firestore, this.DAILY_STOCK_COLLECTION);
    
    // This query is what requires the Index created in Step 1
    const q = query(
      snapshotCollection,
      where('productId', '==', productId),
      where('locationId', '==', locationId),
      where('date', '<', beforeDateStr),
      orderBy('date', 'desc'),
      limit(1)
    );

    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const data = querySnapshot.docs[0].data();
      return data['closingStock'] || 0;
    }
  } catch (error) {
    console.warn(`[DailyStockService] Index query failed, using manual 30-day lookback for ${productId}`);
  }

  // FALLBACK: Manual loop if Index is still building
  let checkDate = new Date(beforeDateStr);
  for (let i = 0; i < 30; i++) {
    checkDate.setDate(checkDate.getDate() - 1);
    const prevStr = this.toBusinessDateString(checkDate);
    const snapId = `${productId}_${locationId}_${prevStr}`;
    const snapRef = doc(this.firestore, this.DAILY_STOCK_COLLECTION, snapId);
    const snapDoc = await getDoc(snapRef);
    if (snapDoc.exists()) return snapDoc.data()['closingStock'] || 0;
  }

  return 0;
}


/**
 * *** NEW HELPER METHOD ***
 * Force refresh today's snapshot to ensure stock report shows latest data
 */
private async refreshTodaysSnapshot(productId: string, locationId: string): Promise<void> {
  try {
    const today = new Date();
    const todayBusinessDate = this.toBusinessDateString(today);
    const snapshotId = `${productId}_${locationId}_${todayBusinessDate}`;
    
    // Get actual current stock
    const stockDocId = `${productId}_${locationId}`;
    const stockRef = doc(this.firestore, COLLECTIONS.PRODUCT_STOCK, stockDocId);
    const stockDoc = await getDoc(stockRef);
    const actualCurrentStock = stockDoc.exists() ? (stockDoc.data()['quantity'] || 0) : 0;
    
    // Update today's snapshot closing stock
    const snapshotRef = doc(this.firestore, this.DAILY_STOCK_COLLECTION, snapshotId);
    await setDoc(snapshotRef, {
      closingStock: actualCurrentStock,
      lastUpdated: serverTimestamp()
    }, { merge: true });
    
    console.log(`🔄 Refreshed today's snapshot for ${productId} at ${locationId}: ${actualCurrentStock}`);
  } catch (error) {
    console.error('❌ Error refreshing today\'s snapshot:', error);
  }
}
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
    end.setUTCMinutes(end.getUTCMinutes() - 1);

    return { start, end };
  }



  private async getCurrentProductStockSnapshot(): Promise<Record<string, any>> {
    const stockCollection = collection(this.firestore, COLLECTIONS.PRODUCT_STOCK);
    const snapshot = await getDocs(stockCollection);

    const stockMap: Record<string, any> = {};
    snapshot.docs.forEach(doc => {
      stockMap[doc.id] = doc.data();
    });

    return stockMap;
  }

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

      console.warn(`No daily snapshot found for ${snapshotId}. Falling back to live stock.`);
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
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyStockSnapshot));
    } catch (error) {
      console.error('Error getting daily snapshots:', error);
      return [];
    }
  }


// inside daily-stock.service.ts




  async initializeDailySnapshotsIfNeeded(date: Date): Promise<void> {
    const businessDate = this.toBusinessDateString(date);

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

  async processEndOfDay(date: Date): Promise<void> {
    console.log('Processing end of day for:', date);

    try {
      const productStockSnapshot = await this.getCurrentProductStockSnapshot();
      const businessDate = this.toBusinessDateString(date);
      const batch = writeBatch(this.firestore);

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

      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      await this.createDailySnapshot(nextDay);

      console.log('End of day processing completed - closing stock updated with actual current stock');
    } catch (error) {
      console.error('Error processing end of day:', error);
      throw error;
    }
  }

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
  }

  private async processGinStockLogMovement(data: any): Promise<void> {
    try {
      const fromLocationId = this.validateLocationId(data.fromLocation, 'GIN stock movement - from location');
      const toLocationId = this.validateLocationId(data.toLocationId, 'GIN stock movement - to location');
      const productId = data.productId;
      const transferAmount = data.transferAmount || 0;
      const createdDate = data.createdDate?.toDate() || new Date();

      if (productId && fromLocationId && toLocationId && transferAmount > 0) {
        console.log(`GIN stock movement: ${productId}, from ${fromLocationId} to ${toLocationId}, qty: ${transferAmount}`);

        await this.updateDailySnapshot(productId, fromLocationId, createdDate, 0, 'out', transferAmount);
        await this.updateDailySnapshot(productId, toLocationId, createdDate, 0, 'in', transferAmount);
      }
    } catch (error) {
      console.error('Error processing GIN stock log movement:', error);
    }
  }

  private async processPurchaseReturnMovement(data: any): Promise<void> {
    try {
      const productId = data.productId;
      const businessLocationId = this.validateLocationId(data.businessLocationId, 'purchase return movement');
      const returnQuantity = data.returnQuantity || 0;
      const returnDate = data.returnDate ? new Date(data.returnDate) : new Date();

      if (productId && businessLocationId && returnQuantity > 0) {
        console.log(`Processing purchase return: ${productId} at ${businessLocationId}, qty: ${returnQuantity}`);

        const stockDocId = `${productId}_${businessLocationId}`;
        const stockRef = doc(this.firestore, COLLECTIONS.PRODUCT_STOCK, stockDocId);
        const stockDoc = await getDoc(stockRef);
        const currentStock = stockDoc.exists() ? (stockDoc.data()['quantity'] || 0) : 0;
        const newStockAfterReturn = Math.max(0, currentStock - returnQuantity);

        await this.updateDailySnapshot(
          productId, 
          businessLocationId, 
          returnDate, 
          newStockAfterReturn,
          'out',
          returnQuantity,
          `purchase_return_${data.purchaseRefNo}`
        );

        console.log(`Purchase return processed: ${productId} stock reduced from ${currentStock} to ${newStockAfterReturn}`);
      }
    } catch (error) {
      console.error('Error processing purchase return movement:', error);
      throw error;
    }
  }

  private async processSalesReturnMovement(data: any): Promise<void> {
    try {
      const items = data.items || [];
      const returnDate = data.returnDate?.toDate() || new Date();

      for (const item of items) {
        const productId = item.productId;
        const returnQuantity = item.returnQuantity || 0;

        if (productId && returnQuantity > 0) {
          console.log(`Sales return movement: ${productId}, qty: ${returnQuantity}`);

          const productStockSnapshot = await this.getCurrentProductStockSnapshot();

          for (const [docId, stockData] of Object.entries(productStockSnapshot)) {
            if (docId.startsWith(`${productId}_`)) {
              const locationId = docId.replace(`${productId}_`, '');
              
              const currentStock = stockData.quantity || 0;
              const newStockAfterReturn = currentStock + returnQuantity;
              
              await this.updateDailySnapshot(
                productId, 
                locationId, 
                returnDate, 
                newStockAfterReturn,
                'in', 
                returnQuantity,
                `sales_return_${data.saleId}`
              );
              
              console.log(`Sales return processed for ${productId} at ${locationId}: stock increased from ${currentStock} to ${newStockAfterReturn}`);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error processing sales return movement:', error);
    }
  }

  subscribeToGinStockLog(callback: (changes: any[]) => void): () => void {
    const ginStockLogCollection = collection(this.firestore, 'gin-stock-log');

    return onSnapshot(ginStockLogCollection, (snapshot) => {
      console.log('GIN stock log changes detected');

      const changes = snapshot.docChanges().map(change => ({
        type: change.type,
        doc: change.doc,
        data: change.doc.data()
      }));

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

  subscribeToPurchaseReturnLog(callback: (changes: any[]) => void): () => void {
    const purchaseReturnLogCollection = collection(this.firestore, 'purchase-return-log');

    return onSnapshot(purchaseReturnLogCollection, (snapshot) => {
      console.log('Purchase return log changes detected');

      const changes = snapshot.docChanges().map(change => ({
        type: change.type,
        doc: change.doc,
        data: change.doc.data()
      }));

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

  subscribeToSalesReturnLog(callback: (changes: any[]) => void): () => void {
    const salesReturnLogCollection = collection(this.firestore, 'sales-return-log');

    return onSnapshot(salesReturnLogCollection, (snapshot) => {
      console.log('Sales return log changes detected');

      const changes = snapshot.docChanges().map(change => ({
        type: change.type,
        doc: change.doc,
        data: change.doc.data()
      }));

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

  subscribeToProductStock(callback: (changes: any[]) => void): () => void {
    const productStockCollection = collection(this.firestore, COLLECTIONS.PRODUCT_STOCK);

    return onSnapshot(productStockCollection, (snapshot) => {
      console.log('Product stock changes detected');

      const changes = snapshot.docChanges().map(change => ({
        type: change.type,
        doc: change.doc,
        data: change.doc.data()
      }));

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

  subscribeToPurchaseStockPriceLog(callback: (changes: any[]) => void): () => void {
    const purchaseLogCollection = collection(this.firestore, 'purchase-stock-price-log');

    return onSnapshot(purchaseLogCollection, (snapshot) => {
      console.log('Purchase stock price log changes detected');

      const changes = snapshot.docChanges().map(change => ({
        type: change.type,
        doc: change.doc,
        data: change.doc.data()
      }));

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

  subscribeToSalesStockPriceLog(callback: (changes: any[]) => void): () => void {
    const salesLogCollection = collection(this.firestore, 'sales-stock-price-log');

    return onSnapshot(salesLogCollection, (snapshot) => {
      console.log('Sales stock price log changes detected');

      const changes = snapshot.docChanges().map(change => ({
        type: change.type,
        doc: change.doc,
        data: change.doc.data()
      }));

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

  private async processProductStockChange(docId: string, data: any): Promise<void> {
    try {
      const parts = docId.split('_');
      if (parts.length >= 2) {
        const productId = parts[0];
        const locationId = parts.slice(1).join('_');
        const currentStock = data.quantity || 0;
        const updatedAt = data.updatedAt?.toDate() || new Date();

        console.log(`Product stock changed: ${productId} at ${locationId}, new stock: ${currentStock}`);

        await this.updateDailySnapshotClosingStock(productId, locationId, updatedAt, currentStock);
      }
    } catch (error) {
      console.error('Error processing product stock change:', error);
    }
  }

  private async processPurchaseStockMovement(data: any): Promise<void> {
    try {
      const productId = data.productId;
      const locationId = this.validateLocationId(data.locationId, 'purchase stock movement');
      const receivedQuantity = data.receivedQuantity || 0;
      const grnCreatedDate = data.grnCreatedDate?.toDate() || new Date();

      if (productId && locationId && receivedQuantity > 0) {
        console.log(`Purchase stock movement: ${productId} at ${locationId}, qty: ${receivedQuantity}`);

        await this.updateDailySnapshot(productId, locationId, grnCreatedDate, 0, 'in', receivedQuantity);
      }
    } catch (error) {
      console.error('Error processing purchase stock movement:', error);
    }
  }

  private async processSalesStockMovement(data: any): Promise<void> {
    try {
      const productId = data.productId;
      const location = data.location;
      const quantity = data.quantity || 0;
      const saleCreatedDate = data.saleCreatedDate ? new Date(data.saleCreatedDate) : new Date();

      if (productId && location && quantity > 0) {
        const locationId = this.getLocationIdByName(location);

        if (locationId) {
          console.log(`Sales stock movement: ${productId} at ${locationId}, qty: ${quantity}`);

          await this.updateDailySnapshot(productId, locationId, saleCreatedDate, 0, 'out', quantity);
        }
      }
    } catch (error) {
      console.error('Error processing sales stock movement:', error);
    }
  }

  private getLocationIdByName(locationName: string): string | null {
    const locationMappings: Record<string, string> = {
      'Herbaly Touch Main': '6j0v6tR66jGMPLG2xRPW',
      'Herbaly Touch PP': '8YbvSEo0viqLT3Bg0GYi',
      'Herbaly Touch COD': '8sYWrQexfc6BnTyIuZtK'
    };

    return locationMappings[locationName] || null;
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

      const stockDocId = `${productId}_${locationId}`;
      const stockRef = doc(this.firestore, COLLECTIONS.PRODUCT_STOCK, stockDocId);
      const stockDoc = await getDoc(stockRef);
      const actualCurrentStock = stockDoc.exists() ? (stockDoc.data()['quantity'] || 0) : newStock;

      const updates: Partial<DailyStockSnapshot> = {
        closingStock: actualCurrentStock,
        lastUpdated: serverTimestamp()
      };

      await setDoc(snapshotRef, updates, { merge: true });

      console.log(`Updated closing stock for ${productId} at ${locationId} on ${businessDate}: ${actualCurrentStock}`);
    } catch (error) {
      console.error('Error updating daily snapshot closing stock:', error);
    }
  }

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

  private validateLocationId(locationId: any, context: string = ''): string | null {
    if (typeof locationId === 'string') {
      return locationId;
    }

    if (typeof locationId === 'object' && locationId !== null) {
      const extractedId = locationId.id ||
        locationId.locationId ||
        locationId.value ||
        locationId._id ||
        locationId.key;

      if (typeof extractedId === 'string') {
        console.log(`Extracted locationId from object in ${context}:`, extractedId);
        return extractedId;
      }

      console.warn(`Could not extract locationId from object in ${context}:`, {
        object: locationId,
        keys: Object.keys(locationId),
        values: Object.values(locationId)
      });
    }

    console.warn(`Invalid locationId in ${context}:`, locationId);
    return null;
  }

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

        if (typeof data['locationId'] === 'object' && data['locationId'] !== null) {
          const validLocationId = this.validateLocationId(data['locationId'], 'cleanup');

          if (validLocationId) {
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

  async runCleanup(): Promise<void> {
    console.log('Running daily stock snapshot cleanup...');
    await this.cleanupInvalidLocationIds();
  }

  async fixDailySnapshots(): Promise<void> {
    try {
      console.log('Starting to fix daily snapshots...');

      const snapshotsCollection = collection(this.firestore, this.DAILY_STOCK_COLLECTION);
      const snapshotsSnapshot = await getDocs(snapshotsCollection);

      console.log(`Found ${snapshotsSnapshot.docs.length} daily snapshots to process`);

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

      for (const [productLocationKey, snapshots] of Object.entries(productLocationDates)) {
        const [productId, locationId] = productLocationKey.split('_');

        snapshots.sort((a, b) => a.date.localeCompare(b.date));

        console.log(`Processing ${snapshots.length} snapshots for ${productId} at ${locationId}`);
        
        const stockDocId = `${productId}_${locationId}`;
        const stockRef = doc(this.firestore, COLLECTIONS.PRODUCT_STOCK, stockDocId);
        const stockDoc = await getDoc(stockRef);
        const currentActualStock = stockDoc.exists() ? (stockDoc.data()['quantity'] || 0) : 0;

        console.log(`Current actual stock for ${productId} at ${locationId}: ${currentActualStock}`);

        for (let i = 0; i < snapshots.length; i++) {
          const snapshot = snapshots[i];
          let correctClosingStock: number;

          if (i === snapshots.length - 1) {
            correctClosingStock = currentActualStock;
          } else {
            const nextSnapshot = snapshots[i + 1];
            correctClosingStock = nextSnapshot.data['openingStock'] || 0;
          }

          if (snapshot.data['closingStock'] !== correctClosingStock ||
            snapshot.data['totalReceived'] !== 0 ||
            snapshot.data['totalIssued'] !== 0) {
            const snapshotRef = doc(this.firestore, this.DAILY_STOCK_COLLECTION, snapshot.docId);
            await setDoc(snapshotRef, {
              closingStock: correctClosingStock,
              totalReceived: 0,
              totalIssued: 0,
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

  async runSnapshotFix(): Promise<void> {
    try {
      await this.fixDailySnapshots();
      console.log('✅ Daily snapshot fix completed successfully');
    } catch (error) {
      console.error('❌ Daily snapshot fix failed:', error);
    }
  }

  async rebuildDailySnapshotsFromCurrentStock(): Promise<void> {
    try {
      console.log('Starting complete rebuild of daily snapshots from current stock...');

      const snapshotsCollection = collection(this.firestore, this.DAILY_STOCK_COLLECTION);
      const snapshotsSnapshot = await getDocs(snapshotsCollection);

      console.log(`Found ${snapshotsSnapshot.docs.length} daily snapshots to rebuild`);

      const currentStockSnapshot = await this.getCurrentProductStockSnapshot();
      console.log(`Found ${Object.keys(currentStockSnapshot).length} current stock entries`);

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

      for (const [productLocationKey, snapshots] of Object.entries(productLocationDates)) {
        const [productId, locationId] = productLocationKey.split('_');

        const stockDocId = `${productId}_${locationId}`;
        const currentActualStock = currentStockSnapshot[stockDocId]?.quantity || 0;

        snapshots.sort((a, b) => a.date.localeCompare(b.date));

        console.log(`Rebuilding ${snapshots.length} snapshots for ${productId} at ${locationId}, current stock: ${currentActualStock}`);

        if (snapshots.length > 0) {
          const latestSnapshot = snapshots[snapshots.length - 1];
          const snapshotRef = doc(this.firestore, this.DAILY_STOCK_COLLECTION, latestSnapshot.docId);

          await setDoc(snapshotRef, {
            closingStock: currentActualStock,
            totalReceived: 0,
            totalIssued: 0,
            lastUpdated: serverTimestamp()
          }, { merge: true });

          console.log(`Rebuilt latest snapshot ${latestSnapshot.docId}: closing stock set to ${currentActualStock}`);

          for (let i = snapshots.length - 2; i >= 0; i--) {
            const snapshot = snapshots[i];
            const nextSnapshot = snapshots[i + 1];
            const correctClosingStock = nextSnapshot.data['openingStock'] || 0;

            const snapshotRef = doc(this.firestore, this.DAILY_STOCK_COLLECTION, snapshot.docId);
            await setDoc(snapshotRef, {
              closingStock: correctClosingStock,
              totalReceived: 0,
              totalIssued: 0,
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

  async runCompleteRebuild(): Promise<void> {
    try {
      await this.rebuildDailySnapshotsFromCurrentStock();
      console.log('✅ Complete daily snapshot rebuild completed successfully');
    } catch (error) {
      console.error('❌ Complete daily snapshot rebuild failed:', error);
    }
  }



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


  async createDailySnapshot(date: Date): Promise<void> {
    const businessDate = this.toBusinessDateString(date);
    const { start: businessStart } = this.getBusinessDateRange(date);

    console.log(`Creating daily snapshot for ${businessDate}`);

    try {
      const products = await this.productsService.fetchAllProducts();
      const productStockSnapshot = await this.getCurrentProductStockSnapshot();

      const batch = writeBatch(this.firestore);
      const snapshotCollection = collection(this.firestore, this.DAILY_STOCK_COLLECTION);

      for (const product of products) {
        if (!product.id) continue;

        const productStocks = this.filterStockByProduct(productStockSnapshot, product.id);

        for (const [locationId, stockData] of Object.entries(productStocks)) {
          const snapshotId = `${product.id}_${locationId}_${businessDate}`;
          const currentStock = stockData.quantity || 0;
          
          const previousDate = new Date(date);
          previousDate.setDate(previousDate.getDate() - 1);
          const openingStock = await this.getOpeningStockFromPreviousDay(product.id, locationId, previousDate);
          
          const snapshotData: Partial<DailyStockSnapshot> = {
            productId: product.id,
            locationId: locationId,
            date: businessDate,
            openingStock: openingStock, 
            closingStock: currentStock, 
            totalReceived: 0,
            totalIssued: 0,
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

    try {
      const stockDocId = `${productId}_${locationId}`;
      const stockRef = doc(this.firestore, COLLECTIONS.PRODUCT_STOCK, stockDocId);
      const stockDoc = await getDoc(stockRef);
      const currentStock = stockDoc.exists() ? (stockDoc.data()['quantity'] || 0) : 0;

      const previousDate = new Date(date);
      previousDate.setDate(previousDate.getDate() - 1);
      const openingStock = await this.getOpeningStockFromPreviousDay(productId, locationId, previousDate);
      
      const snapshotData: Partial<DailyStockSnapshot> = {
        productId: productId,
        locationId: locationId,
        date: businessDate,
        openingStock: openingStock, 
        closingStock: currentStock,
        totalReceived: movementType === 'in' ? quantity : 0,
        totalIssued: movementType === 'out' ? quantity : 0,
        businessDate: businessStart,
        lastUpdated: serverTimestamp(),
        createdAt: serverTimestamp()
      };
      
      const snapshotRef = doc(this.firestore, this.DAILY_STOCK_COLLECTION, snapshotId);
      await setDoc(snapshotRef, snapshotData);

      console.log(`Minimal daily snapshot created for ${productId} at ${locationId} on ${businessDate}`);
    } catch (error) {
      console.error('Error creating minimal daily snapshot:', error);
      throw error;
    }
  }
  

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
      
      const previousDate = new Date(date);
      previousDate.setDate(previousDate.getDate() - 1);
      return await this.getOpeningStockFromPreviousDay(productId, locationId, previousDate);
    } catch (error) {
      console.error('Error getting opening stock:', error);
      return 0;
    }
  }


  /**
   * 2. UPDATED: Uses the robust lookup to fix the "Zero Opening Stock" issue for new days
   */
  private async getOpeningStockFromPreviousDay(productId: string, locationId: string, previousDate: Date): Promise<number> {
    // We want the closing stock of 'previousDate' OR the most recent one before that.
    // So we ask for the latest closing stock BEFORE 'previousDate + 1 day'.
    
    const targetDate = new Date(previousDate);
    targetDate.setDate(targetDate.getDate() + 1);
    const targetDateStr = this.toBusinessDateString(targetDate);

    return this.getLastAvailableClosingStock(productId, locationId, targetDateStr);
  }

  /**
   * 3. UPDATED: Main calculation method for Reports
   */

  /**
   * 3. UPDATED: Main calculation method for Reports
   * FIXED: Forces a "Lookback" for every single product if today's snapshot is missing.
   */


// Add this method to daily-stock.service.ts

/**
 * Get snapshot for a specific date
 * Returns all product snapshots for that date
 */
// Add this to daily-stock.service.ts
async debugCheckSnapshots(date: Date): Promise<void> {
    console.log('=== STOCK SNAPSHOTS DEBUG ===');
    console.log(`Checking for date: ${date.toDateString()}`);
    
    const dateStr = this.toBusinessDateString(date);
    const snapshotRef = collection(this.firestore, 'daily-stock-snapshots');
    const docRef = doc(snapshotRef, dateStr);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
        const data = docSnap.data();
        console.log(`Found snapshot for ${dateStr}`);
        console.log('Sample products:', Object.keys(data).slice(0, 5));
        
        let totalValue = 0;
        for (const [key, value] of Object.entries(data)) {
            const stockData = value as any;
            totalValue += (stockData.closing || 0) * (stockData.unitCost || 0);
        }
        console.log(`Total stock value: ₹${totalValue.toFixed(2)}`);
    } else {
        console.log(`❌ NO snapshot found for ${dateStr}`);
    }
}
async getSnapshotForDate(date: Date): Promise<Record<string, any>> {
  try {
    const businessDateStr = this.toBusinessDateString(date);
    
    console.log(`📅 Getting snapshot for date: ${businessDateStr}`);
    
    const snapshotCollection = collection(this.firestore, this.DAILY_STOCK_COLLECTION);
    const q = query(
      snapshotCollection,
      where('date', '==', businessDateStr)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      console.warn(`⚠️ No snapshots found for ${businessDateStr}`);
      return {};
    }
    
    const snapshot: Record<string, any> = {};
    
    querySnapshot.forEach(doc => {
      const data = doc.data();
      const key = `${data['productId']}_${data['locationId']}`;
      snapshot[key] = {
        productId: data['productId'],
        locationId: data['locationId'],
        closing: data['closingStock'] || 0,
        closingStock: data['closingStock'] || 0,
        opening: data['openingStock'] || 0,
        openingStock: data['openingStock'] || 0,
        unitCost: data['unitCost'] || 0,
        unitPrice: data['unitCost'] || 0,
        totalReceived: data['totalReceived'] || 0,
        totalIssued: data['totalIssued'] || 0,
        date: data['date']
      };
    });
    
    console.log(`✅ Found ${Object.keys(snapshot).length} product snapshots for ${businessDateStr}`);
    
    return snapshot;
    
  } catch (error) {
    console.error('❌ Error getting snapshot for date:', error);
    return {};
  }
}

/**
 * Get snapshot for a specific product and location on a date
 */
async getProductSnapshotForDate(
  productId: string, 
  locationId: string, 
  date: Date
): Promise<DailyStockSnapshot | null> {
  try {
    const businessDateStr = this.toBusinessDateString(date);
    const snapshotId = `${productId}_${locationId}_${businessDateStr}`;
    
    const snapshotRef = doc(this.firestore, this.DAILY_STOCK_COLLECTION, snapshotId);
    const snapshotDoc = await getDoc(snapshotRef);
    
    if (snapshotDoc.exists()) {
      return { 
        id: snapshotDoc.id, 
        ...snapshotDoc.data() 
      } as DailyStockSnapshot;
    }
    
    return null;
    
  } catch (error) {
    console.error('Error getting product snapshot:', error);
    return null;
  }
}

  async debugProductStock(productId: string, locationId: string): Promise<void> {
    try {
      console.log(`=== DEBUG: Product Stock for ${productId} at ${locationId} ===`);

      const stockDocId = `${productId}_${locationId}`;
      const stockRef = doc(this.firestore, COLLECTIONS.PRODUCT_STOCK, stockDocId);
      const stockDoc = await getDoc(stockRef);
      const currentStock = stockDoc.exists() ? (stockDoc.data()['quantity'] || 0) : 0;

      console.log(`Current actual stock in product-stock: ${currentStock}`);

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

  async runDebug(productId: string = 'Cr1KZ3WOFKXHAfZxPeEN', locationId: string = '6j0v6tR66jGMPLG2xRPW'): Promise<void> {
    await this.debugProductStock(productId, locationId);
  }
}