import { Injectable } from '@angular/core';
import { increment } from '@angular/fire/firestore';

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
    private productService: ProductsService
  ) {
    this.stockCollection = collection(this.firestore, 'stockTransfers');
    this.usersCollection = collection(this.firestore, 'users');
    this.stockHistoryCollection = collection(this.firestore, 'product_stock_history');
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
            
              // Add stock history entry
              await this.addStockHistoryEntry({
                productId: product.product,
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

  private async addStockHistoryEntry(historyData: any): Promise<void> {
    try {
      const stockHistoryCollection = collection(this.firestore, 'product_stock_history');
      await addDoc(stockHistoryCollection, historyData);
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

// In stock.service.ts
async getDailyStockValue(date: Date): Promise<number> {
  try {
    const stockSnapshot = await this.getDailyStockSnapshot(date);
    const products = await this.getAllProductsWithPrices();
    
    let totalValue = 0;
    
    for (const [productId, stockData] of Object.entries(stockSnapshot)) {
      const product = products.find(p => p.id === productId);
      if (product) {
        const purchasePrice = product.defaultPurchasePriceExcTax || 0;
        const stockQty = (stockData as any).closing || 0;
        totalValue += stockQty * purchasePrice;
      }
    }
    
    return totalValue;
  } catch (error) {
    console.error('Error getting daily stock value:', error);
    return 0;
  }
}
async getClosingStockValue(date: Date): Promise<number> {
  try {
    const stockSnapshot = await this.getDailyStockSnapshot(date);
    const products = await this.getAllProductsWithPrices();
    
    let totalValue = 0;
    
    for (const [productId, stockData] of Object.entries(stockSnapshot)) {
      const product = products.find(p => p.id === productId);
      if (product) {
        const purchasePrice = product.defaultPurchasePriceExcTax || 0;
        const stockQty = (stockData as any).closing || (stockData as any).closingStock || 0;
        totalValue += stockQty * purchasePrice;
      }
    }
    
    return totalValue;
  } catch (error) {
    console.error('Error getting closing stock value:', error);
    return 0;
  }
}
async getOpeningStockValue(date: Date): Promise<number> {
  try {
    const stockSnapshot = await this.getDailyStockSnapshot(date);
    const products = await this.getAllProductsWithPrices();
    
    let totalValue = 0;
    
    for (const [productId, stockData] of Object.entries(stockSnapshot)) {
      const product = products.find(p => p.id === productId);
      if (product) {
        const purchasePrice = product.defaultPurchasePriceExcTax || 0;
        const stockQty = (stockData as any).opening || 0;
        totalValue += stockQty * purchasePrice;
      }
    }
    
    return totalValue;
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
    const productRef = doc(this.firestore, `products/${params.productId}`);
    
    const stockChange = params.action === 'add' ? params.quantity : -params.quantity;

    await updateDoc(productRef, {
      currentStock: increment(stockChange),
      totalQuantity: increment(stockChange),
      updatedAt: serverTimestamp()
    });

    await this.addStockHistoryEntry({
      productId: params.productId,
      action: params.action,
      quantity: params.quantity,
      locationId: params.locationId,
      notes: params.notes,
      userId: params.userId,
      timestamp: serverTimestamp()
    });

    this.notifyStockUpdate();
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
      newStock: currentStock + params.receivedQuantity,
      timestamp: serverTimestamp()
    });

    this.notifyStockUpdate();
  }

  getStockHistory(productId: string): Observable<any[]> {
    return new Observable(observer => {
      const q = query(
        collection(this.firestore, 'product_stock_history'),
        where('productId', '==', productId),
        orderBy('timestamp', 'desc')
      );
      const unsubscribe = onSnapshot(q, snapshot => {
        observer.next(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
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

  private getDailyStockCollectionRef(date: Date) {
    return collection(this.firestore, `dailyStock/${date.toISOString().split('T')[0]}/products`);
  }

  async recordDailyStock(productId: string, stockData: { openingStock: number; closingStock: number; date: Date }): Promise<void> {
    const dailyStockRef = this.getDailyStockCollectionRef(stockData.date);
    await setDoc(doc(dailyStockRef, productId), {
      productId,
      openingStock: stockData.openingStock,
      closingStock: stockData.closingStock,
      date: stockData.date,
      updatedAt: new Date()
    }, { merge: true });
  }

  async getDailyStockSnapshot(date: Date): Promise<Record<string, { opening: number; closing: number }>> {
    const snapshot = await getDocs(query(this.getDailyStockCollectionRef(date)));
    const result: Record<string, { opening: number; closing: number }> = {};
    snapshot.forEach(doc => {
      const data = doc.data();
      result[data['productId']] = {
        opening: data['openingStock'],
        closing: data['closingStock']
      };
    });
    return result;
  }

  async initializeDailyStock(date: Date): Promise<void> {
    const products = await this.productService.fetchAllProducts();
    const yesterday = new Date(date);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStock = await this.getDailyStockSnapshot(yesterday);
    const dailyStockRef = this.getDailyStockCollectionRef(date);
    const batch = writeBatch(this.firestore);

    for (const product of products) {
      if (!product.id) continue;
      const openingStock = yesterdayStock[product.id]?.closing ?? product.currentStock ?? 0;
      batch.set(doc(dailyStockRef, product.id), {
        productId: product.id,
        openingStock,
        closingStock: openingStock,
        date,
        createdAt: new Date()
      }, { merge: true });
    }

    await batch.commit();
  }

  async closeBusinessDay(date: Date): Promise<void> {
    const snapshot = await getDocs(query(this.getDailyStockCollectionRef(date)));
    const batch = writeBatch(this.firestore);
    for (const docSnapshot of snapshot.docs) {
      const data = docSnapshot.data();
      const product = await this.productService.getProductById(data['productId']);
      batch.update(docSnapshot.ref, {
        closingStock: product?.currentStock ?? data['openingStock'],
        updatedAt: new Date()
      });
    }
    await batch.commit();
  }

  async recordDailyClosingStock(date: Date): Promise<void> {
    const products = await this.productService.fetchAllProducts();
    const dailyStockRef = this.getDailyStockCollectionRef(date);
    const batch = writeBatch(this.firestore);
    
    for (const product of products) {
      if (!product.id) continue;
      
      // Get today's opening stock
      const todayDoc = await getDoc(doc(dailyStockRef, product.id));
      const openingStock = todayDoc.exists() ? todayDoc.data()['openingStock'] : product.currentStock || 0;
      
      // Record closing stock (current stock)
      batch.set(doc(dailyStockRef, product.id), {
        productId: product.id,
        openingStock,
        closingStock: product.currentStock || 0,
        date,
        updatedAt: new Date()
      }, { merge: true });
    }
    await batch.commit();
  }

  async initializeNextDayOpeningStock(currentDate: Date): Promise<void> {
    const nextDay = new Date(currentDate);
    nextDay.setDate(nextDay.getDate() + 1);
    
    // Get today's closing stock
    const todayClosing = await this.getDailyStockSnapshot(currentDate);
    const nextDayRef = this.getDailyStockCollectionRef(nextDay);
    const batch = writeBatch(this.firestore);
    
    for (const [productId, stockData] of Object.entries(todayClosing)) {
      batch.set(doc(nextDayRef, productId), {
        productId,
        openingStock: stockData.closing,
        closingStock: stockData.closing, // Initialize with same value
        date: nextDay,
        createdAt: new Date()
      }, { merge: true });
    }
    await batch.commit();
  }

  async reduceStock(params: StockReductionParams): Promise<void> {
    const productRef = doc(this.firestore, `products/${params.productId}`);
    const productSnap = await getDoc(productRef);

    if (!productSnap.exists()) return;

    const currentStock = productSnap.data()['currentStock'] || 0;
    const newStock = Math.max(0, currentStock - params.quantity);

    await updateDoc(productRef, { currentStock: newStock });

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

  // Updated adjustProductStock method - merged with your simplified version
  async adjustProductStock(
    productId: string,
    quantity: number,
    action: 'add' | 'subtract' | 'set',
    locationId: string,
    reference: string,
    userId: string,
    context?: any
  ): Promise<void> {
    const productRef = doc(this.firestore, `products/${productId}`);
    
    const updateData: any = {
      updatedAt: serverTimestamp()
    };
    
    // Handle different stock adjustment types
    switch (action) {
      case 'add':
        updateData.currentStock = increment(quantity);
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
    
    // Add stock history record
    const historyEntry = {
      productId,
      quantity,
      locationId,
      referenceNo: reference,
      userId,
      timestamp: serverTimestamp(),
      action: 'goods_received',
      notes: `Added ${quantity} units (Ref: ${reference})`,
      ...(context || {})
    };
    
    await this.addStockHistoryEntry(historyEntry);
    this.notifyStockUpdate(); // This will refresh components listening to stock updates
  }

  async initializeProductStock(product: any, initialQuantity: number): Promise<void> {
    if (!product.id || initialQuantity < 0) {
      throw new Error('Invalid product or quantity');
    }

    const productRef = doc(this.firestore, `products/${product.id}`);
    
    try {
      await updateDoc(productRef, {
        currentStock: initialQuantity,
        totalQuantity: initialQuantity,
        updatedAt: serverTimestamp()
      });

      await this.addStockHistoryEntry({
        productId: product.id,
        action: 'initial_stock',
        quantity: initialQuantity,
        referenceNo: 'initial_setup',
        userId: 'system',
        notes: `Initial stock setup with ${initialQuantity} units`,
        timestamp: serverTimestamp()
      });

      this.notifyStockUpdate();
    } catch (error) {
      console.error('Error initializing product stock:', error);
      throw error;
    }
  }
}