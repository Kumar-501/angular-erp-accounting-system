import { Injectable } from '@angular/core';
import { increment } from '@angular/fire/firestore';
import { COLLECTIONS } from '../../utils/constants';

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
  writeBatch,
  CollectionReference,
  serverTimestamp
} from '@angular/fire/firestore';
import { Observable, from, map, Subject } from 'rxjs';
import { ProductsService } from '../services/products.service';
import { Product } from '../models/product.model';
import { DailyStockService } from './daily-stock.service';

// Standardized interface for stock history entries
interface StockHistoryEntry {
  id?: string;
  productId: string;
  locationId: string;
  action: 'goods_received' | 'transfer' | 'adjustment' | 'sale' | 'initial_stock' | 'return' | 'add' | 'subtract';
  quantity: number;
  oldStock: number;
  newStock: number;
  timestamp: Date | any; // Allow both Date and Firestore serverTimestamp
  userId: string;
  referenceNo?: string;
  invoiceNo?: string;
  notes?: string;
  // Transfer specific fields
  locationFrom?: string;
  locationTo?: string;
  transferId?: string;
  // Purchase specific fields
  purchaseOrderId?: string;
  supplierName?: string;
  // Other reference fields
  adjustmentId?: string;
  saleId?: string;
  returnId?: string;
}

// Interfaces
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
  userId: string; // Added userId property
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
  private stockCollection: CollectionReference;
  private usersCollection: CollectionReference;
  private stockHistoryCollection: CollectionReference;

  private stockUpdatedSource = new Subject<void>();
  public stockUpdated$ = this.stockUpdatedSource.asObservable();
  
  constructor(
    private firestore: Firestore,
    private productService: ProductsService,
    private dailyStockService: DailyStockService
  ) {
    this.stockCollection = collection(this.firestore, 'stockTransfers');
    this.usersCollection = collection(this.firestore, 'users');
    this.stockHistoryCollection = collection(this.firestore, COLLECTIONS.PRODUCT_STOCK_HISTORY);
  }

  public notifyStockUpdate(): void {
    this.stockUpdatedSource.next();
  }

  async addStock(stockData: any): Promise<string> {
    try {
      // Extract all product IDs from the transfer
      const productIds = stockData.locationTransfers.flatMap((transfer: any) =>
        transfer.products.map((product: any) => product.product)
      );

      // Add the stock transfer document
      const docRef = await addDoc(this.stockCollection, {
        ...stockData,
        productIds,
        createdAt: new Date()
      });

      // Process each product transfer
      for (const transfer of stockData.locationTransfers) {
        for (const product of transfer.products) {
          if (product.product && product.quantity > 0) {
            // Get current product data
            const currentProduct = await this.productService.getProductById(product.product);
          
            if (currentProduct) {
              // Calculate new stock (reducing from source location)
              const newStock = Math.max(0, (currentProduct.currentStock || 0) - product.quantity);
            
              // Update product stock
              await this.productService.updateProductStock(product.product, newStock);
              
              // Update daily stock snapshot
              await this.dailyStockService.updateDailySnapshot(
                product.product,
                transfer.locationFrom,
                new Date(),
                newStock,
                'out',
                product.quantity
              );
              
              // Add stock history entry for source location
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

      // Notify subscribers about the stock update
      this.notifyStockUpdate();
      return docRef.id;
    } catch (error) {
      console.error('Error adding stock transfer:', error);
      throw error;
    }
  }

  private async addStockHistoryEntry(historyData: StockHistoryEntry): Promise<void> {
    try {
      const stockHistoryCollection = collection(this.firestore, COLLECTIONS.PRODUCT_STOCK_HISTORY);
      
      // Ensure consistent data structure and filter out undefined values
      const standardizedEntry: any = {
        productId: historyData.productId,
        locationId: historyData.locationId,
        action: historyData.action,
        quantity: historyData.quantity,
        oldStock: historyData.oldStock,
        newStock: historyData.newStock,
        timestamp: historyData.timestamp || new Date(),
        userId: historyData.userId
      };

      // Only add optional fields if they have values
      if (historyData.referenceNo !== undefined && historyData.referenceNo !== null) {
        standardizedEntry.referenceNo = historyData.referenceNo;
      }
      if (historyData.invoiceNo !== undefined && historyData.invoiceNo !== null) {
        standardizedEntry.invoiceNo = historyData.invoiceNo;
      }
      if (historyData.notes !== undefined && historyData.notes !== null) {
        standardizedEntry.notes = historyData.notes;
      }
      if (historyData.locationFrom !== undefined && historyData.locationFrom !== null) {
        standardizedEntry.locationFrom = historyData.locationFrom;
      }
      if (historyData.locationTo !== undefined && historyData.locationTo !== null) {
        standardizedEntry.locationTo = historyData.locationTo;
      }
      if (historyData.transferId !== undefined && historyData.transferId !== null) {
        standardizedEntry.transferId = historyData.transferId;
      }
      if (historyData.purchaseOrderId !== undefined && historyData.purchaseOrderId !== null) {
        standardizedEntry.purchaseOrderId = historyData.purchaseOrderId;
      }
      if (historyData.supplierName !== undefined && historyData.supplierName !== null) {
        standardizedEntry.supplierName = historyData.supplierName;
      }
      if (historyData.adjustmentId !== undefined && historyData.adjustmentId !== null) {
        standardizedEntry.adjustmentId = historyData.adjustmentId;
      }
      if (historyData.saleId !== undefined && historyData.saleId !== null) {
        standardizedEntry.saleId = historyData.saleId;
      }
      if (historyData.returnId !== undefined && historyData.returnId !== null) {
        standardizedEntry.returnId = historyData.returnId;
      }
      
      await addDoc(stockHistoryCollection, standardizedEntry);
    } catch (error) {
      console.error('Error adding stock history entry:', error);
      throw error;
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

  // Updated stock value methods using DailyStockService
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
    return new Observable<Stock[]>(observer => {
      const q = query(this.stockCollection, orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(q, snapshot => {
        const stocks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Stock[];
        observer.next(stocks);
      }, error => observer.error(error));
      return unsubscribe;
    });
  }

  getStockById(stockId: string): Observable<Stock> {
    return from(getDoc(doc(this.firestore, `stockTransfers/${stockId}`))).pipe(
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
    return updateDoc(doc(this.firestore, `stockTransfers/${stockId}`), {
      ...stockData,
      updatedAt: new Date()
    });
  }

  updateStockStatus(stockId: string, status: string): Promise<void> {
    return updateDoc(doc(this.firestore, `stockTransfers/${stockId}`), {
      status,
      updatedAt: new Date()
    });
  }

  deleteStock(stockId: string): Promise<void> {
    return deleteDoc(doc(this.firestore, `stockTransfers/${stockId}`));
  }

  getStockTransfersByProduct(productId: string): Observable<any[]> {
    return new Observable(observer => {
      const q = query(
        this.stockCollection,
        where('productIds', 'array-contains', productId),
        orderBy('createdAt', 'desc')
      );
      const unsubscribe = onSnapshot(q, snapshot => {
        observer.next(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, error => observer.error(error));
      return unsubscribe;
    });
  }

  async adjustProductStockWithParams(params: StockAdjustmentParams): Promise<void> {
    // Get current stock from product-stock collection
    const stockDocId = `${params.productId}_${params.locationId}`;
    const stockDocRef = doc(this.firestore, COLLECTIONS.PRODUCT_STOCK, stockDocId);
    const stockDoc = await getDoc(stockDocRef);
    
    let currentStock = 0;
    if (stockDoc.exists()) {
      currentStock = stockDoc.data()['quantity'] || 0;
    }
    
    const stockChange = params.action === 'add' ? params.quantity : -params.quantity;
    const newStock = Math.max(0, currentStock + stockChange);

    // Update product-stock document
    await setDoc(stockDocRef, {
      productId: params.productId,
      locationId: params.locationId,
      quantity: newStock,
      lastUpdated: new Date(),
      updatedBy: params.userId
    }, { merge: true });

    // Update daily stock snapshot
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

  /**
   * Get consolidated stock history for a product across all locations
   */
  getProductStockHistoryAllLocations(productId: string): Observable<StockHistoryEntry[]> {
    return this.getStockHistory(productId);
  }

  /**
   * Get stock history for a specific product at a specific location
   */
  getProductStockHistoryByLocation(productId: string, locationId: string): Observable<StockHistoryEntry[]> {
    return this.getStockHistory(productId, locationId);
  }

  /**
   * Get stock movement history between locations for a product
   */
  getStockTransferHistory(productId: string): Observable<StockHistoryEntry[]> {
    return new Observable(observer => {
      const q = query(
        collection(this.firestore, COLLECTIONS.PRODUCT_STOCK_HISTORY),
        where('productId', '==', productId),
        where('action', '==', 'transfer'),
        orderBy('timestamp', 'desc')
      );
      
      const unsubscribe = onSnapshot(q, snapshot => {
        const history = snapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        } as StockHistoryEntry));
        observer.next(history);
      }, error => observer.error(error));
      return unsubscribe;
    });
  }

  getStockTransfersByLocation(locationId: string, isSource: boolean = true): Observable<Stock[]> {
    const field = isSource ? 'locationFrom' : 'locationTo';
    return new Observable(observer => {
      const q = query(this.stockCollection, where(field, '==', locationId), orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(q, snapshot => {
        observer.next(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Stock[]);
      }, error => observer.error(error));
      return unsubscribe;
    });
  }

  getUsers(): Observable<User[]> {
    return new Observable(observer => {
      const q = query(this.usersCollection, orderBy('name'));
      const unsubscribe = onSnapshot(q, snapshot => {
        observer.next(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as User[]);
      }, error => observer.error(error));
      return unsubscribe;
    });
  }

  getUserById(userId: string): Observable<User> {
    return from(getDoc(doc(this.firestore, `users/${userId}`))).pipe(
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
    
    // Get current stock first for verification
    const productSnap = await getDoc(productRef);
    const currentStock = productSnap.exists() ? (productSnap.data()['currentStock'] || 0) : 0;

    console.log(`Updating stock for ${params.productId}: 
      Current=${currentStock}, 
      Received=${params.receivedQuantity}, 
      New Total=${currentStock + params.receivedQuantity}`);

    // ATOMICALLY increment stock
    await updateDoc(productRef, {
      currentStock: increment(params.receivedQuantity),
      totalQuantity: increment(params.receivedQuantity),
      updatedAt: serverTimestamp()
    });

    const newStock = currentStock + params.receivedQuantity;

    // Update daily stock snapshot
    await this.dailyStockService.updateDailySnapshot(
      params.productId,
      params.locationId,
      new Date(),
      newStock,
      'in',
      params.receivedQuantity
    );

    // Add to stock history
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
      timestamp: serverTimestamp()
    });

    this.notifyStockUpdate();
  }

  getStockHistory(productId: string, locationId?: string): Observable<StockHistoryEntry[]> {
    return new Observable(observer => {
      let q;
      if (locationId) {
        // Get history for specific product at specific location
        q = query(
          collection(this.firestore, COLLECTIONS.PRODUCT_STOCK_HISTORY),
          where('productId', '==', productId),
          where('locationId', '==', locationId),
          orderBy('timestamp', 'desc')
        );
      } else {
        // Get history for product across all locations
        q = query(
          collection(this.firestore, COLLECTIONS.PRODUCT_STOCK_HISTORY),
          where('productId', '==', productId),
          orderBy('timestamp', 'desc')
        );
      }
      
      const unsubscribe = onSnapshot(q, snapshot => {
        const history = snapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        } as StockHistoryEntry));
        observer.next(history);
      }, error => observer.error(error));
      return unsubscribe;
    });
  }

  getStockTransactionsByDateRange(startDate: Date, endDate: Date): Observable<Stock[]> {
    return new Observable(observer => {
      const q = query(
        this.stockCollection,
        where('createdAt', '>=', startDate),
        where('createdAt', '<=', endDate),
        orderBy('createdAt', 'desc')
      );
      const unsubscribe = onSnapshot(q, snapshot => {
        observer.next(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Stock[]);
      }, error => observer.error(error));
      return unsubscribe;
    });
  }

  // Legacy methods for backward compatibility - now use DailyStockService
  private getDailyStockCollectionRef(date: Date) {
    return collection(this.firestore, `dailyStock/${date.toISOString().split('T')[0]}/products`);
  }

  async recordDailyStock(productId: string, stockData: { openingStock: number; closingStock: number; date: Date }): Promise<void> {
    // Delegate to DailyStockService
    await this.dailyStockService.initializeDailySnapshotsIfNeeded(stockData.date);
  }

  async getDailyStockSnapshot(date: Date): Promise<Record<string, { opening: number; closing: number }>> {
    try {
      const snapshots = await this.dailyStockService.getDailySnapshots(date, date);
      const result: Record<string, { opening: number; closing: number }> = {};
      
      snapshots.forEach(snapshot => {
        const key = `${snapshot.productId}_${snapshot.locationId}`;
        result[key] = {
          opening: snapshot.openingStock,
          closing: snapshot.closingStock
        };
      });
      
      return result;
    } catch (error) {
      console.error('Error getting daily stock snapshot:', error);
      return {};
    }
  }
// In stock.service.ts

async reduceProductStock(params: StockReductionParams): Promise<void> {
  try {
    // Get current stock
    const stockDocId = `${params.productId}_${params.locationId}`;
    const stockDocRef = doc(this.firestore, COLLECTIONS.PRODUCT_STOCK, stockDocId);
    const stockSnap = await getDoc(stockDocRef);
    
    let currentStock = 0;
    if (stockSnap.exists()) {
      currentStock = stockSnap.data()['quantity'] || 0;
    }
    
    // Calculate new stock
    const newStock = Math.max(0, currentStock - params.quantity);
    
    // Update stock document
    await setDoc(stockDocRef, {
      productId: params.productId,
      locationId: params.locationId,
      quantity: newStock,
      lastUpdated: new Date(),
      updatedBy: params.userId
    }, { merge: true });
    
    // Update daily stock snapshot
    await this.dailyStockService.updateDailySnapshot(
      params.productId,
      params.locationId,
      new Date(),
      newStock,
      'out',
      params.quantity
    );
    
    // Add stock history entry
    await this.addStockHistoryEntry({
      productId: params.productId,
      locationId: params.locationId,
      action: params.action as StockHistoryEntry['action'],
      quantity: params.quantity,
      oldStock: currentStock,
      newStock: newStock,
      referenceNo: params.reference,
      userId: params.userId,
      notes: `Stock reduced for ${params.action}`,
      timestamp: new Date()
    });
    
    this.notifyStockUpdate();
  } catch (error) {
    console.error('Error reducing product stock:', error);
    throw error;
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

  async reduceStock(params: StockReductionParams): Promise<void> {
    const productRef = doc(this.firestore, `products/${params.productId}`);
    const productSnap = await getDoc(productRef);

    if (!productSnap.exists()) return;

    const currentStock = productSnap.data()['currentStock'] || 0;
    const newStock = Math.max(0, currentStock - params.quantity);

    await updateDoc(productRef, { currentStock: newStock });

    // Update daily stock snapshot
    await this.dailyStockService.updateDailySnapshot(
      params.productId,
      params.locationId,
      new Date(),
      newStock,
      'out',
      params.quantity
    );

    await addDoc(collection(this.firestore, 'stockMovements'), {
      productId: params.productId,
      locationId: params.locationId,
      action: params.action,
      quantityChange: -params.quantity,
      reference: params.reference,
      timestamp: new Date()
    });

    await this.updateDailyStock(params.productId, params.locationId);
    this.notifyStockUpdate();
  }

  private async updateDailyStock(productId: string, locationId: string): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dailyStockRef = collection(this.firestore, 'dailyStock');
    const q = query(
      dailyStockRef,
      where('productId', '==', productId),
      where('locationId', '==', locationId),
      where('date', '==', today)
    );
    const snapshot = await getDocs(q);
    const currentProduct = await this.productService.getProductById(productId);

    if (!snapshot.empty) {
      await updateDoc(doc(this.firestore, `dailyStock/${snapshot.docs[0].id}`), {
        closingStock: currentProduct?.currentStock || 0,
        updatedAt: new Date()
      });
    } else {
      await addDoc(dailyStockRef, {
        productId,
        locationId,
        date: today,
        openingStock: currentProduct?.currentStock || 0,
        closingStock: currentProduct?.currentStock || 0,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
  }

  // Updated adjustProductStock method with daily stock tracking
  async adjustProductStock(
    productId: string,
    quantity: number,
    action: 'add' | 'subtract' | 'set',
    locationId: string,
    reference: string,
    userId: string,
    context?: any
  ): Promise<void> {
    // Get current stock from product-stock collection
    const stockDocId = `${productId}_${locationId}`;
    const stockDocRef = doc(this.firestore, COLLECTIONS.PRODUCT_STOCK, stockDocId);
    const stockDoc = await getDoc(stockDocRef);
    const currentStock = stockDoc.exists() ? (stockDoc.data()?.['quantity'] || 0) : 0;
    
    let newStock = currentStock;
    
    // Calculate new stock based on action
    switch (action) {
      case 'add':
        newStock = currentStock + quantity;
        break;
      case 'subtract':
        newStock = Math.max(0, currentStock - quantity);
        break;
      case 'set':
        newStock = quantity;
        break;
    }
    
    // Update product-stock collection
    await setDoc(stockDocRef, {
      productId,
      locationId,
      quantity: newStock,
      lastUpdated: new Date(),
      updatedBy: userId
    }, { merge: true });
    
    // Update daily stock snapshot
    const movementType = newStock > currentStock ? 'in' : 'out';
    const movementQuantity = Math.abs(newStock - currentStock);
    
    await this.dailyStockService.updateDailySnapshot(
      productId,
      locationId,
      new Date(),
      newStock,
      movementType,
      movementQuantity
    );
    
    // Update legacy product record (for backward compatibility)
    const productRef = doc(this.firestore, `products/${productId}`);
    const updateData: any = {
      updatedAt: serverTimestamp()
    };
    
    // Handle different stock adjustment types for legacy field
    switch (action) {
      case 'add':
        updateData.totalQuantity = increment(quantity);
        break;
      case 'subtract':
        updateData.currentStock = increment(-quantity);
        break;
      case 'set':
        updateData.currentStock = quantity;
        break;
    }
    
    await updateDoc(productRef, updateData);
    
    // Add stock history record with proper oldStock and newStock
    const historyEntry: StockHistoryEntry = {
      productId,
      quantity: Math.abs(newStock - currentStock),
      oldStock: currentStock,
      newStock: newStock,
      locationId,
      referenceNo: reference,
      userId,
      timestamp: new Date(),
      action: 'goods_received',
      notes: `Added ${quantity} units (Ref: ${reference})`,
      ...(context || {})
    };
    
    await this.addStockHistoryEntry(historyEntry);
    this.notifyStockUpdate(); // This will refresh components listening to stock updates
  }

  async initializeProductStock(product: any, initialQuantity: number, locationId: string): Promise<void> {
    if (!product.id || initialQuantity < 0 || !locationId) {
      throw new Error('Invalid product, quantity, or location');
    }

    // Update product-stock collection instead of product
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

      // Initialize daily stock snapshot
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
}