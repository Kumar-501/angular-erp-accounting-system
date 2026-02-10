import { Injectable } from '@angular/core';
import { increment, runTransaction, writeBatch } from '@angular/fire/firestore';
import { COLLECTIONS } from '../../utils/constants';
import { AuthService } from '../auth.service';
import { LogStockMovementService } from './log-stock-movement.service';
import { serverTimestamp } from '@angular/fire/firestore';

import {
  Firestore,
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  onSnapshot,
  orderBy,
  setDoc,
  CollectionReference,
} from '@angular/fire/firestore';
import { Observable, from, map, Subject } from 'rxjs';
import { LocationService } from './location.service';

import { ProductsService } from '../services/products.service';
import { Product } from '../models/product.model';
import { DailyStockService } from './daily-stock.service';
import { StockLog, StockAction } from './log-stock-movement.service';
import { GinTransfer } from './gin-transfer.service';
import { SalesOrder } from '../models/sales-order.model';

interface StockHistoryEntry {
  id?: string;
  productId: string;
  locationId: string;
  action: 'goods_received' | 'transfer' | 'adjustment' | 'sale' | 'initial_stock' | 'return' | 'add' | 'subtract' | 'purchase_return' | 'sales_return';
  quantity: number;
  oldStock: number;
  newStock: number;
  timestamp: Date | any;
  userId: string;
  referenceNo?: string;
  invoiceNo?: string;
  notes?: string;
  locationFrom?: string;
  locationTo?: string;
  transferId?: string;
  purchaseOrderId?: string;
  supplierName?: string;
  adjustmentId?: string;
  saleId?: string;
  returnId?: string;
}

export interface Stock {
  id: string;
  date: string;
  referenceNo: string;
  locationFrom: string;
  locationTo: string;
  status: string;
  locationTransfers: LocationTransfer[];
  shippingCharges: number;
  totalAmount: number;
  additionalNotes: string;
  products?: any[];
  createdAt?: Date;
  updatedAt?: Date;
  userId?: string;
  productIds?: string[];
}

export interface LocationTransfer {
  locationFrom: string;
  locationTo: string;
  shippingCharges: number;
  subtotal: number;
  totalAmount: number;
  products: ProductTransfer[];
}

export interface ProductTransfer {
  product: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  lastLogin?: Date;
  createdAt?: Date;
}

export interface StockReductionParams {
  productId: string;
  quantity: number;
  locationId: string;
  reference: string;
  action: string;
}

export interface StockAdjustmentParams {
  productId: string;
  quantity: number;
  action: 'add' | 'subtract';
  locationId: string;
  notes: string;
  userId: string;
}

@Injectable({
  providedIn: 'root'
})
export class StockService {
  [x: string]: any;
  private stockCollection: CollectionReference;
  private usersCollection: CollectionReference;
  private stockHistoryCollection: CollectionReference;

  private stockUpdatedSource = new Subject<void>();
  public stockUpdated$ = this.stockUpdatedSource.asObservable();
  
  private authService!: AuthService;
  
  constructor(
    private firestore: Firestore,
    private productService: ProductsService,
    private dailyStockService: DailyStockService,
    private logStockService: LogStockMovementService,
    private locationService: LocationService,
  ) {
    this.stockCollection = collection(this.firestore, 'stockTransfers');
    this.usersCollection = collection(this.firestore, 'users');
    this.stockHistoryCollection = collection(this.firestore, COLLECTIONS.PRODUCT_STOCK_HISTORY);
  }

  public notifyStockUpdate(): void {
    this.stockUpdatedSource.next();
  }

  private async createReturnStockHistory(entry: {
    productId: string;
    locationId: string;
    action: string;
    quantity: number;
    oldStock: number;
    newStock: number;
    referenceNo: string;
    notes: string;
    userId: string;
  }): Promise<void> {
    try {
      const historyCollection = collection(this.firestore, COLLECTIONS.PRODUCT_STOCK_HISTORY);
      await addDoc(historyCollection, {
        ...entry,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error creating return stock history:', error);
    }
  }

  async addStock(stockData: any): Promise<string> {
    try {
      const productIds = stockData.locationTransfers.flatMap((transfer: any) =>
        transfer.products.map((product: any) => product.product)
      );

      const docRef = await addDoc(this.stockCollection, {
        ...stockData,
        productIds,
        createdAt: new Date()
      });

      for (const transfer of stockData.locationTransfers) {
        for (const product of transfer.products) {
          if (product.product && product.quantity > 0) {
            const currentProduct = await this.productService.getProductById(product.product);
          
            if (currentProduct) {
              const newStock = Math.max(0, (currentProduct.currentStock || 0) - product.quantity);
            
              await this.productService.updateProductStock(product.product, newStock);
              
              await this.dailyStockService.updateDailySnapshot(
                product.product,
                transfer.locationFrom,
                new Date(),
                newStock,
                'out',
                product.quantity
              );
              
              await this.addStockHistoryEntry({
                productId: product.product,
                locationId: transfer.locationFrom,
                transferId: docRef.id,
                action: 'transfer',
                quantity: product.quantity,
                locationFrom: transfer.locationFrom,
                locationTo: transfer.locationTo,
                oldStock: currentProduct.currentStock || 0,
                newStock,
                referenceNo: stockData.referenceNo,
                userId: stockData.userId || 'system',
                timestamp: new Date(),
                notes: stockData.additionalNotes || `Transfer from ${transfer.locationFrom} to ${transfer.locationTo}`
              });
            }
          }
        }
      }

      this.notifyStockUpdate();
      return docRef.id;
    } catch (error) {
      console.error('Error adding stock transfer:', error);
      throw error;
    }
  }

  async processGinTransfer(transfer: GinTransfer): Promise<void> {
      if (!transfer.id || !transfer.locationFrom) {
          throw new Error('Invalid transfer data: Missing ID or source location.');
      }

      console.log(`Processing stock movements for GIN: ${transfer.referenceNo}`);
      const batch = writeBatch(this.firestore);
      const historyEntries: StockHistoryEntry[] = [];
      
      // *** FIX START: In-memory tracker for source stock levels ***
      const sourceStockTracker = new Map<string, number>();

      if (!transfer.transfers || transfer.transfers.length === 0) {
          console.warn('Transfer object has no items to process.');
          return;
      }

      for (const locationTransfer of transfer.transfers) {
          for (const product of locationTransfer.products) {
              const sourceStockDocId = `${product.productId}_${transfer.locationFrom}`;
              const destStockDocId = `${product.productId}_${locationTransfer.locationId}`;

              const sourceStockRef = doc(this.firestore, COLLECTIONS.PRODUCT_STOCK, sourceStockDocId);
              const destStockRef = doc(this.firestore, COLLECTIONS.PRODUCT_STOCK, destStockDocId);

              // --- Source Stock Calculation (Corrected Logic) ---
              let sourceOldStock: number;
              
              // 1. Check if we've already processed this product from the source location
              if (sourceStockTracker.has(sourceStockDocId)) {
                  sourceOldStock = sourceStockTracker.get(sourceStockDocId)!;
              } else {
                  // 2. If not, fetch it from the database for the first time
                  const sourceStockSnap = await getDoc(sourceStockRef);
                  sourceOldStock = sourceStockSnap.exists() ? sourceStockSnap.data()['quantity'] || 0 : 0;
              }
              
              if (sourceOldStock < product.quantity) {
                  throw new Error(`Insufficient stock for ${product.productName} at source location. Available: ${sourceOldStock}, Required: ${product.quantity}`);
              }

              const sourceNewStock = sourceOldStock - product.quantity;
              
              // 3. Update our in-memory tracker for the next iteration
              sourceStockTracker.set(sourceStockDocId, sourceNewStock);
              
              // --- Destination Stock Calculation (Remains the same) ---
              const destStockSnap = await getDoc(destStockRef);
              const destOldStock = destStockSnap.exists() ? destStockSnap.data()['quantity'] || 0 : 0;
              const destNewStock = destOldStock + product.quantity;

              // Use the final tracked value for the source batch operation
              batch.set(sourceStockRef, { quantity: sourceNewStock, lastUpdated: new Date() }, { merge: true });
              batch.set(destStockRef, { productId: product.productId, locationId: locationTransfer.locationId, quantity: destNewStock, lastUpdated: new Date() }, { merge: true });

              // --- History & Snapshot Logic (Remains the same) ---
              historyEntries.push({
                  productId: product.productId, locationId: transfer.locationFrom, action: 'transfer', quantity: product.quantity,
                  oldStock: sourceOldStock, newStock: sourceNewStock, userId: 'system', referenceNo: transfer.referenceNo,
                  notes: `Transfer Out to ${locationTransfer.locationName}`, locationFrom: transfer.locationFrom, locationTo: locationTransfer.locationId,
                  transferId: transfer.id, 
                  timestamp: new Date()
              });
              historyEntries.push({
                  productId: product.productId, locationId: locationTransfer.locationId, action: 'transfer', quantity: product.quantity,
                  oldStock: destOldStock, newStock: destNewStock, userId: 'system', referenceNo: transfer.referenceNo,
                  notes: `Transfer In from ${transfer.locationFromName}`, locationFrom: transfer.locationFrom, locationTo: locationTransfer.locationId,
                  transferId: transfer.id, 
                  timestamp: new Date()
              });

              await this.dailyStockService.updateDailySnapshot(product.productId, transfer.locationFrom, new Date(), sourceNewStock, 'out', product.quantity, `gin_${transfer.id}`);
              await this.dailyStockService.updateDailySnapshot(product.productId, locationTransfer.locationId, new Date(), destNewStock, 'in', product.quantity, `gin_${transfer.id}`);
          }
      }

      await batch.commit();

      for (const entry of historyEntries) {
          await this.addStockHistoryEntry(entry);
      }
      
      console.log(`Stock movements for GIN ${transfer.referenceNo} committed successfully.`);
      this.notifyStockUpdate();
  }

  async updateStockAfterSale(productId: string, locationId: string, quantitySold: number, action: string, referenceId: string): Promise<void> {
      const stockDocId = `${productId}_${locationId}`;
      const stockRef = doc(this.firestore, COLLECTIONS.PRODUCT_STOCK, stockDocId);
      
      try {
        const stockSnap = await getDoc(stockRef);
        const currentStock = stockSnap.exists() ? (stockSnap.data()['quantity'] || 0) : 0;
        
        const newStock = Math.max(0, currentStock - quantitySold);
        
        console.log(`🔄 Sale stock reduction: ${productId} at ${locationId} - ${currentStock} → ${newStock} (sold: ${quantitySold})`);
        
        await setDoc(stockRef, {
          productId,
          locationId,
          quantity: newStock,
          lastUpdated: new Date()
        }, { merge: true });
        
        await this.dailyStockService.updateDailySnapshot(
          productId,
          locationId,
          new Date(),
          newStock,
          'out',
          quantitySold,
          `sale_${referenceId}`
        );
        
        await this.recordStockHistory({
          productId,
          locationId,
          action: 'sale',
          quantity: quantitySold,
          oldStock: currentStock,
          newStock,
          referenceNo: referenceId,
          timestamp: new Date(),
          userId: 'system',
          saleId: referenceId
        });
        
        this.notifyStockUpdate();
        console.log(`✅ Sale stock reduction completed for ${productId}`);
        
      } catch (error) {
        console.error('Error updating stock after sale:', error);
        throw error;
      }
  }

  async processReturn(saleId: string, returnedProducts: any[]): Promise<void> {
    try {
      for (const product of returnedProducts) {
        await this.updateStockAfterSale(
          product.productId,
          product.locationId,
          product.returnedQuantity,
          'return',
          saleId
        );
      }
    } catch (error) {
      console.error('Error processing return:', error);
      throw error;
    }
  }

  private async recordStockHistory(historyData: StockHistoryEntry): Promise<void> {
    try {
      const historyRef = collection(this.firestore, 'stock-history');
      await addDoc(historyRef, { ...historyData, timestamp: new Date() });
    } catch (error) {
      console.error('Error recording stock history:', error);
      throw error;
    }
  }

  private async addStockHistoryEntry(historyData: StockHistoryEntry): Promise<void> {
    try {
      const product = await this.productService.getProductById(historyData.productId);
      const location = await this.locationService.getLocationById(historyData.locationId);
      
      const stockLogData: Omit<StockLog, 'id' | 'timestamp'> = {
        productId: historyData.productId,
        productName: product?.productName || '',
        sku: product?.sku || '',
        locationId: historyData.locationId,
        locationName: location?.name || historyData.locationId,
        action: this.mapActionType(historyData.action),
        quantity: historyData.quantity,
        oldStock: historyData.oldStock,
        newStock: historyData.newStock,
        userId: historyData.userId,
        referenceNo: historyData.referenceNo,
        notes: historyData.notes,
        sourceLocationId: historyData.locationFrom,
        destinationLocationId: historyData.locationTo,
        transferId: historyData.transferId
      };

      await this.logStockService.logStockMovement(stockLogData);
      await addDoc(this.stockHistoryCollection, { ...historyData, timestamp: new Date() });

    } catch (error) {
      console.error('Error adding stock history entry:', error);
      throw error;
    }
  }

  private mapActionType(action: string): StockAction {
    switch(action) {
      case 'add': return 'adjustment';
      case 'subtract': return 'adjustment';
      case 'transfer': return 'transfer_out';
      case 'sales_return': return 'return';
      default: return action as StockAction;
    }
  }

  getStockList(): Observable<Stock[]> {
    return from(getDocs(this.stockCollection)).pipe(
      map(snapshot =>
        snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Stock))
      )
    );
  }

  async getAllProductsWithPrices(): Promise<Product[]> {
    const productsCollection = collection(this.firestore, 'products');
    const snapshot = await getDocs(productsCollection);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      defaultPurchasePriceExcTax: doc.data()['defaultPurchasePriceExcTax'] || 0
    } as Product));
  }

  async getDailyStockValue(date: Date): Promise<number> {
    try {
      return await this.dailyStockService.getStockValueForDate(date, 'closing');
    } catch (error) {
      console.error('Error getting daily stock value:', error);
      return 0;
    }
  }

  async getClosingStockValue(date: Date): Promise<number> {
    try {
      return await this.dailyStockService.getStockValueForDate(date, 'closing');
    } catch (error) {
      console.error('Error getting closing stock value:', error);
      return 0;
    }
  }

  async getOpeningStockValue(date: Date): Promise<number> {
    try {
      return await this.dailyStockService.getStockValueForDate(date, 'opening');
    } catch (error) {
      console.error('Error getting opening stock value:', error);
      return 0;
    }
  }

  getStockValue(closingDate: Date): any {
    return this.getDailyStockValue(closingDate);
  }

  getStockListRealTime(): Observable<Stock[]> {
    const q = query(this.stockCollection, orderBy('createdAt', 'desc'));
    return new Observable<Stock[]>(observer => {
      const unsubscribe = onSnapshot(q, snapshot => {
        const stocks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Stock[];
        observer.next(stocks);
      }, error => observer.error(error));
      return unsubscribe;
    });
  }

  getStockById(stockId: string): Observable<Stock> {
    const stockDocRef = doc(this.firestore, `stockTransfers/${stockId}`);
    return from(getDoc(stockDocRef)).pipe(
      map(docSnapshot => {
        if (docSnapshot.exists()) {
          return { id: docSnapshot.id, ...docSnapshot.data() } as Stock;
        } else {
          throw new Error(`Stock with ID ${stockId} not found`);
        }
      })
    );
  }

  updateStock(stockId: string, stockData: any): Promise<void> {
    const stockDocRef = doc(this.firestore, `stockTransfers/${stockId}`);
    return updateDoc(stockDocRef, {
      ...stockData,
      updatedAt: new Date()
    });
  }

  updateStockStatus(stockId: string, status: string): Promise<void> {
    const stockDocRef = doc(this.firestore, `stockTransfers/${stockId}`);
    return updateDoc(stockDocRef, {
      status,
      updatedAt: new Date()
    });
  }

  deleteStock(stockId: string): Promise<void> {
    const stockDocRef = doc(this.firestore, `stockTransfers/${stockId}`);
    return deleteDoc(stockDocRef);
  }

  getStockTransfersByProduct(productId: string): Observable<any[]> {
    const q = query(
      this.stockCollection,
      where('productIds', 'array-contains', productId),
      orderBy('createdAt', 'desc')
    );
    return new Observable(observer => {
      const unsubscribe = onSnapshot(q, snapshot => {
        observer.next(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, error => observer.error(error));
      return unsubscribe;
    });
  }


  async adjustProductStockWithParams(params: StockAdjustmentParams): Promise<void> {
    const stockDocId = `${params.productId}_${params.locationId}`;
    const stockDocRef = doc(this.firestore, COLLECTIONS.PRODUCT_STOCK, stockDocId);
    
    const stockDoc = await getDoc(stockDocRef);
    const currentStock = stockDoc.exists() ? (stockDoc.data()['quantity'] || 0) : 0;
    
    const stockChange = params.action === 'add' ? params.quantity : -params.quantity;
    const newStock = Math.max(0, currentStock + stockChange);

    await setDoc(stockDocRef, {
      productId: params.productId,
      locationId: params.locationId,
      quantity: newStock,
      lastUpdated: new Date(),
      updatedBy: params.userId
    }, { merge: true });

    await this.dailyStockService.updateDailySnapshot(
      params.productId,
      params.locationId,
      new Date(),
      newStock,
      params.action === 'add' ? 'in' : 'out',
      params.quantity
    );

    await this.addStockHistoryEntry({
      productId: params.productId,
      locationId: params.locationId,
      action: params.action === 'add' ? 'adjustment' : 'adjustment',
      quantity: params.quantity,
      oldStock: currentStock,
      newStock: newStock,
      notes: params.notes,
      userId: params.userId,
      timestamp: new Date()
    });

    this.notifyStockUpdate();
  }

  getProductStockHistoryAllLocations(productId: string): Observable<StockHistoryEntry[]> {
    return this.getStockHistory(productId);
  }

  getProductStockHistoryByLocation(productId: string, locationId: string): Observable<StockHistoryEntry[]> {
    return this.getStockHistory(productId, locationId);
  }

  getStockTransferHistory(productId: string): Observable<StockHistoryEntry[]> {
    const q = query(
      this.stockHistoryCollection,
      where('productId', '==', productId),
      where('action', '==', 'transfer'),
      orderBy('timestamp', 'desc')
    );
    return new Observable(observer => {
      const unsubscribe = onSnapshot(q, snapshot => {
        const history = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StockHistoryEntry));
        observer.next(history);
      }, error => observer.error(error));
      return unsubscribe;
    });
  }

  getStockTransfersByLocation(locationId: string, isSource: boolean = true): Observable<Stock[]> {
    const field = isSource ? 'locationFrom' : 'locationTo';
    const q = query(this.stockCollection, where(field, '==', locationId), orderBy('createdAt', 'desc'));
    return new Observable(observer => {
      const unsubscribe = onSnapshot(q, snapshot => {
        observer.next(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Stock[]);
      }, error => observer.error(error));
      return unsubscribe;
    });
  }

  getUsers(): Observable<User[]> {
    const q = query(this.usersCollection, orderBy('name'));
    return new Observable(observer => {
      const unsubscribe = onSnapshot(q, snapshot => {
        observer.next(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as User[]);
      }, error => observer.error(error));
      return unsubscribe;
    });
  }

  getUserById(userId: string): Observable<User> {
    const userDocRef = doc(this.firestore, `users/${userId}`);
    return from(getDoc(userDocRef)).pipe(
      map(docSnapshot => {
        if (docSnapshot.exists()) {
          return { id: docSnapshot.id, ...docSnapshot.data() } as User;
        } else {
          throw new Error(`User with ID ${userId} not found`);
        }
      })
    );
  }

  async recordGoodsReceived(params: {
    productId: string;
    receivedQuantity: number;
    locationId: string;
    referenceNo: string;
    userId: string;
    notes?: string;
  }): Promise<void> {
    const productRef = doc(this.firestore, `products/${params.productId}`);
    
    const productSnap = await getDoc(productRef);
    const currentStock = productSnap.exists() ? (productSnap.data()['currentStock'] || 0) : 0;

    await updateDoc(productRef, {
      currentStock: increment(params.receivedQuantity),
      totalQuantity: increment(params.receivedQuantity),
      updatedAt: new Date()
    });

    const newStock = currentStock + params.receivedQuantity;

    await this.dailyStockService.updateDailySnapshot(
      params.productId,
      params.locationId,
      new Date(),
      newStock,
      'in',
      params.receivedQuantity
    );

    await this.addStockHistoryEntry({
      productId: params.productId,
      action: 'goods_received',
      quantity: params.receivedQuantity,
      locationId: params.locationId,
      referenceNo: params.referenceNo,
      userId: params.userId,
      notes: params.notes || `Goods received (Ref: ${params.referenceNo})`,
      oldStock: currentStock,
      newStock: newStock,
      timestamp: new Date()
    });

    this.notifyStockUpdate();
  }

  getStockHistory(productId: string, locationId?: string): Observable<StockHistoryEntry[]> {
    let q;
    if (locationId) {
      q = query(
        this.stockHistoryCollection,
        where('productId', '==', productId),
        where('locationId', '==', locationId),
        orderBy('timestamp', 'desc')
      );
    } else {
      q = query(
        this.stockHistoryCollection,
        where('productId', '==', productId),
        orderBy('timestamp', 'desc')
      );
    }
    return new Observable(observer => {
      const unsubscribe = onSnapshot(q, snapshot => {
        const history = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StockHistoryEntry));
        observer.next(history);
      }, error => observer.error(error));
      return unsubscribe;
    });
  }

  getStockTransactionsByDateRange(startDate: Date, endDate: Date): Observable<Stock[]> {
    const q = query(
      this.stockCollection,
      where('createdAt', '>=', startDate),
      where('createdAt', '<=', endDate),
      orderBy('createdAt', 'desc')
    );
    return new Observable(observer => {
      const unsubscribe = onSnapshot(q, snapshot => {
        observer.next(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Stock[]);
      }, error => observer.error(error));
      return unsubscribe;
    });
  }

  async recordDailyStock(productId: string, stockData: { openingStock: number; closingStock: number; date: Date }): Promise<void> {
    await this.dailyStockService.initializeDailySnapshotsIfNeeded(stockData.date);
  }

  async getDailyStockSnapshot(date: Date): Promise<Record<string, { opening: number; closing: number }>> {
    try {
      const snapshots = await this.dailyStockService.getDailySnapshots(date, date);
      const result: Record<string, { opening: number; closing: number }> = {};
      
      snapshots.forEach(snapshot => {
        const key = `${snapshot.productId}_${snapshot.locationId}`;
        result[key] = { opening: snapshot.openingStock, closing: snapshot.closingStock };
      });
      return result;
    } catch (error) {
      console.error('Error getting daily stock snapshot:', error);
      return {};
    }
  }

  async initializeDailyStock(date: Date): Promise<void> {
    await this.dailyStockService.createDailySnapshot(date);
  }

  async closeBusinessDay(date: Date): Promise<void> {
    await this.dailyStockService.processEndOfDay(date);
  }

  async recordDailyClosingStock(date: Date): Promise<void> {
    await this.dailyStockService.processEndOfDay(date);
  }

  async initializeNextDayOpeningStock(currentDate: Date): Promise<void> {
    const nextDay = new Date(currentDate);
    nextDay.setDate(nextDay.getDate() + 1);
    await this.dailyStockService.createDailySnapshot(nextDay);
  }

  async reduceStock(params: {
    productId: string;
    quantity: number;
    locationId: string;
    reference: string;
    action: string;
  }): Promise<void> {
    await this.updateStockAfterSale(
      params.productId,
      params.locationId,
      params.quantity,
      params.action,
      params.reference
    );
  }

  async adjustProductStock(
    productId: string,
    quantity: number,
    action: 'add' | 'subtract' | 'set',
    locationId: string,
    reference: string,
    userId: string,
    context?: any
  ): Promise<void> {
    const stockDocId = `${productId}_${locationId}`;
    const stockDocRef = doc(this.firestore, COLLECTIONS.PRODUCT_STOCK, stockDocId);
    
    const stockDoc = await getDoc(stockDocRef);
    const currentStock = stockDoc.exists() ? (stockDoc.data()?.['quantity'] || 0) : 0;
    
    let newStock = currentStock;
    switch (action) {
      case 'add': newStock = currentStock + quantity; break;
      case 'subtract': newStock = Math.max(0, currentStock - quantity); break;
      case 'set': newStock = quantity; break;
    }
    
    await setDoc(stockDocRef, {
      productId, locationId, quantity: newStock,
      lastUpdated: new Date(), updatedBy: userId
    }, { merge: true });
    
    const movementType = newStock > currentStock ? 'in' : 'out';
    const movementQuantity = Math.abs(newStock - currentStock);
    
    await this.dailyStockService.updateDailySnapshot(
      productId, locationId, new Date(),
      newStock, movementType, movementQuantity
    );
    
    const productRef = doc(this.firestore, `products/${productId}`);
    const updateData: any = { updatedAt: new Date() };
    
    switch (action) {
      case 'add': updateData.totalQuantity = increment(quantity); break;
      case 'subtract': updateData.currentStock = increment(-quantity); break;
      case 'set': updateData.currentStock = quantity; break;
    }
    
    await updateDoc(productRef, updateData);
    
    const historyEntry: StockHistoryEntry = {
      productId, quantity: Math.abs(newStock - currentStock),
      oldStock: currentStock, newStock, locationId, referenceNo: reference,
      userId, timestamp: new Date(), action: 'goods_received',
      notes: `Added ${quantity} units (Ref: ${reference})`,
      ...(context || {})
    };
    
    await this.addStockHistoryEntry(historyEntry);
    this.notifyStockUpdate();
  }

  /**
   * *** THIS IS THE PRIMARY FIX ***
   * This is the definitive method for processing a purchase return.
   * It uses a Firestore Transaction to guarantee the stock update is atomic and reliable.
   */
  async processPurchaseReturn(returnData: any): Promise<void> {
    console.log('🔄 [TRANSACTION START] Processing purchase return:', returnData);

    try {
      // A transaction ensures all database writes succeed or fail together.
      await runTransaction(this.firestore, async (transaction) => {
        for (const product of returnData.products) {
          const productId = product.productId || product.id;
          const locationId = returnData.businessLocationId;
          const returnQuantity = product.returnQuantity || product.quantity || 0;

          if (!productId || !locationId || returnQuantity <= 0) {
            console.warn('⚠️ Skipping invalid product in return:', { productId, locationId, returnQuantity });
            continue;
          }

          console.log(`📦 Processing item: ${productId} at ${locationId}, quantity: ${returnQuantity}`);

          const stockDocId = `${productId}_${locationId}`;
          const stockRef = doc(this.firestore, COLLECTIONS.PRODUCT_STOCK, stockDocId);
          
          // 1. READ the current stock within the transaction
          const stockDoc = await transaction.get(stockRef);
          const currentStock = stockDoc.exists() ? (stockDoc.data()['quantity'] || 0) : 0;
          console.log(`📊 Current stock for ${productId} is: ${currentStock}`);

          const newStock = Math.max(0, currentStock - returnQuantity);
          console.log(`📉 New calculated stock will be: ${newStock}`);

          // 2. WRITE the new stock value within the transaction
          transaction.set(stockRef, {
            quantity: newStock,
            lastUpdated: new Date()
          }, { merge: true });

          // 3. UPDATE the daily snapshot for accurate reporting
          await this.dailyStockService.updateDailySnapshot(
            productId,
            locationId,
            new Date(returnData.returnDate),
            newStock,
            'out', // A purchase return is an 'out' movement
            returnQuantity,
            `purchase_return_${returnData.referenceNo}`
          );

          // 4. Create a history log entry
          await this.createReturnStockHistory({
              productId,
              locationId,
              action: 'purchase_return',
              quantity: returnQuantity,
              oldStock: currentStock,
              newStock,
              referenceNo: returnData.referenceNo || `RETURN-${returnData.id}`,
              notes: `Purchase return: ${returnData.reason || 'No reason provided'}`,
              userId: returnData.createdBy || 'system'
          });
        }
      });

      this.notifyStockUpdate();
      console.log('✅ [TRANSACTION SUCCESS] Purchase return processed.');

    } catch (error) {
      console.error('❌ [TRANSACTION FAILED] Error processing purchase return:', error);
      throw new Error('Failed to process purchase return. Stock was not updated.');
    }
  }

  async processSalesReturn(returnData: {
    productId: string;
    locationId: string;
    returnQuantity: number;
    referenceNo: string;
    notes: string;
    userId: string;
  }): Promise<void> {
    try {
      console.log('🔄 Processing sales return:', returnData);

      const { productId, locationId, returnQuantity, referenceNo, notes, userId } = returnData;

      if (!productId || !locationId || returnQuantity <= 0) {
        console.warn('⚠️ Invalid sales return data:', returnData);
        return;
      }

      const stockDocId = `${productId}_${locationId}`;
      const stockRef = doc(this.firestore, COLLECTIONS.PRODUCT_STOCK, stockDocId);
      const stockDoc = await getDoc(stockRef);
      
      const currentStock = stockDoc.exists() ? (stockDoc.data()['quantity'] || 0) : 0;
      const newStock = currentStock + returnQuantity;
      
      await setDoc(stockRef, {
        productId, locationId, quantity: newStock,
        lastUpdated: new Date(), updatedBy: userId
      }, { merge: true });

      await this.dailyStockService.updateDailySnapshot(
        productId, locationId, new Date(),
        newStock, 'in', returnQuantity, referenceNo
      );

      await this.createReturnStockHistory({
        productId, locationId, action: 'sales_return',
        quantity: returnQuantity, oldStock: currentStock, newStock,
        referenceNo, notes, userId
      });

      this.notifyStockUpdate();
      console.log(`✅ Sales return processed successfully for ${productId}, stock restored`);
      
    } catch (error) {
      console.error('❌ Error processing sales return:', error);
      throw error;
    }
  }

  async initializeProductStock(product: any, initialQuantity: number, locationId: string): Promise<void> {
    if (!product.id || initialQuantity < 0 || !locationId) {
      throw new Error('Invalid product, quantity, or location');
    }

    const stockDocId = `${product.id}_${locationId}`;
    const stockDocRef = doc(this.firestore, COLLECTIONS.PRODUCT_STOCK, stockDocId);
    
    try {
      await setDoc(stockDocRef, {
        productId: product.id,
        locationId: locationId,
        quantity: initialQuantity,
        lastUpdated: new Date(),
        updatedBy: 'system'
      }, { merge: true });

      await this.dailyStockService.updateDailySnapshot(
        product.id,
        locationId,
        new Date(),
        initialQuantity,
        'in',
        initialQuantity
      );

      await this.addStockHistoryEntry({
        productId: product.id,
        locationId: locationId,
        action: 'initial_stock',
        quantity: initialQuantity,
        oldStock: 0,
        newStock: initialQuantity,
        referenceNo: 'initial_setup',
        userId: 'system',
        notes: `Initial stock setup with ${initialQuantity} units`,
        timestamp: new Date()
      });

      this.notifyStockUpdate();
    } catch (error) {
      console.error('Error initializing product stock:', error);
      throw error;
    }
  }


  async getProductStock(productId: string): Promise<any> {
    try {
      const stockCollection = collection(this.firestore, COLLECTIONS.PRODUCT_STOCK);
      const q = query(stockCollection, where('productId', '==', productId));
      const querySnapshot = await getDocs(q);

      const stockData: any = {};
      querySnapshot.forEach(doc => {
        const data = doc.data();
        stockData[data['locationId']] = {
          quantity: data['quantity'] || 0,
          locationId: data['locationId']
        };
      });

      return stockData;
    } catch (error) {
      console.error('Error getting product stock:', error);
      throw error;
    }
  }

  async reduceProductStockForSale(sale: SalesOrder): Promise<void> {
    if (!sale.id) throw new Error('Sale ID is required to reduce stock.');
    if (!sale.products || sale.products.length === 0) {
      console.warn(`Sale ${sale.id} has no products. Skipping stock reduction.`);
      return;
    }

    try {
      await runTransaction(this.firestore, async (transaction) => {
        for (const product of sale.products!) {
          const productId = product.productId || product.id;
          if (!productId) continue;

          const locationId = sale.businessLocationId || sale.businessLocation || 'default';
          const stockDocId = `${productId}_${locationId}`;
          const stockDocRef = doc(this.firestore, COLLECTIONS.PRODUCT_STOCK, stockDocId);

          const stockSnap = await transaction.get(stockDocRef);
          const currentStock = stockSnap.exists() ? (stockSnap.data()['quantity'] || 0) : 0;
          const quantitySold = product.quantity ?? 0;
          const newStock = currentStock - quantitySold;

          transaction.set(stockDocRef, { quantity: newStock, lastUpdated: serverTimestamp() }, { merge: true });

          await this.dailyStockService.updateDailySnapshot(
            productId,
            locationId,
            new Date(),
            newStock,
            'out',
            quantitySold,
            `sale_${sale.id}`
          );
        }
      });
      console.log(`Stock successfully reduced for sale ${sale.id}`);
    } catch (error) {
      console.error('Error in batch stock reduction transaction:', error);
      throw error;
    }
  }

  private async restoreProductStockForSale(sale: SalesOrder): Promise<void> {
    if (!sale.id) throw new Error('Sale ID is required to restore stock.');
    if (!sale.products || sale.products.length === 0) {
      console.warn(`Sale ${sale.id} has no products to restore stock for. Skipping.`);
      return;
    }
    
    try {
      await runTransaction(this.firestore, async (transaction) => {
        for (const product of sale.products!) {
          const productId = product.productId || product.id;
          if (!productId) continue;

          const locationId = sale.businessLocationId || sale.businessLocation || 'default';
          const stockDocId = `${productId}_${locationId}`;
          const stockDocRef = doc(this.firestore, COLLECTIONS.PRODUCT_STOCK, stockDocId);

          const stockSnap = await transaction.get(stockDocRef);
          const currentStock = stockSnap.exists() ? (stockSnap.data()['quantity'] || 0) : 0;
          const quantityToRestore = product.quantity ?? 0;
          const newStock = currentStock + quantityToRestore;

          transaction.set(stockDocRef, { quantity: newStock, lastUpdated: serverTimestamp() }, { merge: true });

          await this.dailyStockService.updateDailySnapshot(
            productId,
            locationId,
            new Date(),
            newStock,
            'in',
            quantityToRestore,
            `reversal_sale_${sale.id}`
          );
        }
      });
      console.log(`Stock successfully restored for reverted sale ${sale.id}`);
    } catch (error) {
        console.error('Error restoring product stock:', error);
        throw error;
    }
  }  
}