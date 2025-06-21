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

@Injectable({
   providedIn: 'root'
})
export class GoodsService {
  private goodsSubject = new BehaviorSubject<DocumentData[]>([]);
  goods$ = this.goodsSubject.asObservable();
  private collectionName = 'goodsReceived';

  constructor(
    private firestore: Firestore,
    private stockService: StockService
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

  // Add new goods received note with stock update
// Add new goods received note with stock update
// goods.service.ts
async addGoodsReceived(goodsData: any): Promise<DocumentReference> {
  const goodsCollection = collection(this.firestore, 'goodsReceived');
  
  // Add timestamps
  const completeData = {
    ...goodsData,
    createdAt: serverTimestamp(),
        receivedDate: serverTimestamp(), // This ensures the server timestamp is used

    status: 'received',
    linkedPurchaseId: goodsData.purchaseOrder || null // Add this field to link to purchase
  };

  // Save the goods received note first
  const docRef = await addDoc(goodsCollection, completeData);

  // Update stock for each product
  if (completeData.products && completeData.products.length > 0) {
    const updatePromises = completeData.products.map(async (product: any) => {
      if (product.id && product.receivedQuantity > 0) {
        // Update product stock
        const productRef = doc(this.firestore, `products/${product.id}`);
        await updateDoc(productRef, {
          currentStock: increment(product.receivedQuantity),
          totalQuantity: increment(product.receivedQuantity),
          updatedAt: serverTimestamp()
        });

        // Record stock adjustment
        await this.stockService.adjustProductStock(
          product.id,
          product.receivedQuantity,
          'add',
          completeData.businessLocation,
          `Goods received (Ref: ${docRef.id})`,
          completeData.addedBy || 'system'
        );
      }
    });
    
    await Promise.all(updatePromises);
  }
  
  // If this goods receipt is linked to a purchase, update the purchase status
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

  getAllGoodsReceived(): Observable<DocumentData[]> {
    return this.goods$;
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