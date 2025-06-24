import { Injectable } from '@angular/core';
import { 
  Firestore, 
  collection, 
  addDoc, 
  doc, 
  deleteDoc, 
  updateDoc, 
  onSnapshot, 
  query, 
  where, 
  getDocs, 
  getDoc, 
  DocumentData, 
  DocumentReference,
  serverTimestamp,
  increment
} from '@angular/fire/firestore';
import { Observable, from, Subject, BehaviorSubject } from 'rxjs';
import { StockService } from './stock.service';
import { PurchaseStockPriceLogService } from './purchase-stock-price-log.service';


@Injectable({
   providedIn: 'root'
})
export class GoodsService {
  private goodsSubject = new BehaviorSubject<DocumentData[]>([]);
  goods$ = this.goodsSubject.asObservable();
  private collectionName = 'goodsReceived';

  constructor(
    private firestore: Firestore,
    private stockService: StockService,
        private purchaseStockLogService: PurchaseStockPriceLogService

  ) {
    this.setupGoodsListener();
  }

  private setupGoodsListener(): void {
    const goodsCollection = collection(this.firestore, this.collectionName);
    onSnapshot(goodsCollection, (snapshot) => {
      const goods = snapshot.docs.map(doc => {
        const data = doc.data() as Record<string, any>;
        return { id: doc.id, ...data };
      });
      this.goodsSubject.next(goods);
    });
  }

async addGoodsReceived(goodsData: any): Promise<DocumentReference> {
  const goodsCollection = collection(this.firestore, 'goodsReceived');
  
  const completeData = {
    ...goodsData,
    createdAt: serverTimestamp(),
    receivedDate: serverTimestamp(),
    status: 'received',
    linkedPurchaseId: goodsData.purchaseOrder || null,
    paymentAccount: goodsData.paymentAccount || null,
    paymentMethod: goodsData.paymentMethod || null
  };

  const docRef = await addDoc(goodsCollection, completeData);
  
  if (completeData.products && completeData.products.length > 0) {
    const updatePromises = completeData.products.map(async (product: any) => {
      if (product.id && product.receivedQuantity > 0) {
        // Update product stock
        await this.stockService.adjustProductStock(
          product.id,
          product.receivedQuantity,
          'add',
          completeData.businessLocation,
          `Goods received (Ref: ${docRef.id})`,
          completeData.addedBy || 'system'
        );

        // Log the purchase stock price details
        await this.purchaseStockLogService.addLogEntry({
          productId: product.id,
          productName: product.productName || product.name,
          sku: product.sku,
          locationId: completeData.businessLocation.id,
          locationName: completeData.businessLocation.name,
          receivedQuantity: product.receivedQuantity,
          unitPurchasePrice: product.unitPrice || 0,
          paymentAccountId: completeData.paymentAccount?.id || null,
          paymentType: completeData.paymentMethod || null,
          taxRate: product.taxRate || 0,
          shippingCharge: completeData.shippingCharges || 0,
          purchaseRefNo: completeData.purchaseOrder,
          grnRefNo: docRef.id,
          grnCreatedDate: new Date()
        }).toPromise();
      }
    });
    
    await Promise.all(updatePromises);
  }
  
  // Update purchase status if linked
  if (completeData.linkedPurchaseId) {
    const purchaseRef = doc(this.firestore, `purchases/${completeData.linkedPurchaseId}`);
    await updateDoc(purchaseRef, {
      status: 'completed',
      updatedAt: serverTimestamp()
    });
  }
  
  return docRef;
}


  private async updateStockQuantities(goodsData: any, referenceId: string) {
  const updatePromises = goodsData.products.map(async (product: any) => {
    if (!product.id || product.receivedQuantity <= 0) return;
    
    await this.stockService.adjustProductStock(
      product.id,
      product.receivedQuantity,
      'add', // Critical - ensures we ADD to existing stock
      goodsData.businessLocation,
      `GRN-${referenceId}`,
      goodsData.addedBy || 'system'
    );
  });
  
  await Promise.all(updatePromises);
}
  // Keep all existing methods unchanged
  updateGoodsReceived(id: string, data: any): Promise<void> {
    const goodsDoc = doc(this.firestore, this.collectionName, id);
    return updateDoc(goodsDoc, data);
  }

  deleteGoodsReceived(id: string): Promise<void> {
    const goodsDoc = doc(this.firestore, this.collectionName, id);
    return deleteDoc(goodsDoc);
  }

  getGoodsReceived(id: string): Observable<DocumentData | null> {
    return new Observable(observer => {
      const goodsDoc = doc(this.firestore, this.collectionName, id);
      const unsubscribe = onSnapshot(goodsDoc, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as Record<string, any>;
          observer.next({ id: docSnap.id, ...data });
        } else {
          observer.next(null);
        }
      }, error => {
        observer.error(error);
      });
      return () => unsubscribe();
    });
  }

// In goods.service.ts
getAllGoodsReceived(id?: string): Observable<DocumentData[]> {
  if (id) {
    // If you need specific functionality when an ID is provided
    const goodsDoc = doc(this.firestore, this.collectionName, id);
    return from(getDoc(goodsDoc).then(doc => doc.exists() ? [{ id: doc.id, ...doc.data() }] : []));
  } else {
    // Return all goods when no ID is provided
    return this.goods$;
  }
}

  getGoodsBySupplier(supplierId: string): Observable<DocumentData[]> {
    return new Observable(observer => {
      const goodsCollection = collection(this.firestore, this.collectionName);
      const supplierQuery = query(goodsCollection, where('supplier.id', '==', supplierId));

      const unsubscribe = onSnapshot(supplierQuery, (snapshot) => {
        const goods = snapshot.docs.map(doc => {
          const data = doc.data() as Record<string, any>;
          return { id: doc.id, ...data };
        });
        observer.next(goods);
      }, error => {
        observer.error(error);
      });
      return () => unsubscribe();
    });
  }
}