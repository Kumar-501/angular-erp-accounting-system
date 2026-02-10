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
  increment,
  runTransaction,
  writeBatch,
  orderBy,
  DocumentSnapshot,
  Timestamp // Import Timestamp
} from '@angular/fire/firestore';
import { Observable, from, Subject, BehaviorSubject, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { StockService } from './stock.service';
import { DailyStockService } from './daily-stock.service';
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
        private dailyStockService: DailyStockService ,// ADD THIS TO CONSTRUCTOR

    public purchaseStockLogService: PurchaseStockPriceLogService
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
    }, (error) => {
      console.error('Error in goods listener:', error);
      this.goodsSubject.error(error);
    });
  }
private async updateStockQuantities(
  goodsData: any,
  referenceId: string
): Promise<void> {
  const locationId = goodsData.businessLocation.id;
  const locationName = goodsData.businessLocation.name;
  const receivedDate = goodsData.receivedDate || new Date();

  console.log(`🔄 Processing stock updates and logging for GRN ${referenceId}`);

  const tasks = goodsData.products.map(async (product: any) => {
    if (!product.id || product.receivedQuantity <= 0) return;

    try {
      // 1. Extract the price
      const unitPrice = Number(product.unitPrice) || 
                       Number(product.unitCost) || 
                       Number(product.unitCostBeforeTax) || 0;

      // 2. Adjust product stock
      await this.stockService.adjustProductStock(
        product.id,
        product.receivedQuantity,
        'add',
        locationId,
        `GRN-${referenceId}`,
        goodsData.addedBy || 'system',
        { 
          unitPrice: unitPrice,
          unitCost: unitPrice 
        }
      );

      // 3. ✅ CRITICAL FIX: Update daily snapshot WITH unit cost
      await this.dailyStockService.updateDailySnapshot(
        product.id,
        locationId,
        receivedDate,
        0,
        'in',
        product.receivedQuantity,
        `GRN-${referenceId}`,
        unitPrice // ✅ THIS PARAMETER WAS MISSING
      );

      // 4. Prepare Log Data
      const logData: any = {
        productId: product.id,
        productName: product.productName || product.name || 'Unknown Product',
        sku: product.sku || `SKU-${product.id}`,
        locationId: locationId,
        locationName: locationName,
        receivedQuantity: Number(product.receivedQuantity) || 0,
        unitPurchasePrice: unitPrice,
        taxRate: product.taxRate || 0,
        grnRefNo: referenceId,
        grnCreatedDate: receivedDate,
        supplierName: goodsData.supplierName || '',
        paymentAccountId: goodsData.paymentAccount?.id || 'none',
        paymentType: goodsData.paymentMethod || 'Credit',
        adjustmentType: 'increase'
      };

      // 5. Create the log entry
      this.purchaseStockLogService.addLogEntry(logData).subscribe({
        next: () => console.log(`✅ Audit log created for ${product.sku}`),
        error: (err) => console.error(`❌ Failed to create audit log for ${product.sku}:`, err)
      });

      console.log(`✅ Stock updated for ${product.sku}: +${product.receivedQuantity} @ ₹${unitPrice}`);

    } catch (error) {
      console.error(`❌ Stock update failed for ${product.sku}:`, error);
      throw error;
    }
  });

  await Promise.all(tasks);
}
private async refreshAllSnapshotsForLocation(
  locationId: string,
  productIds: string[]
): Promise<void> {
  try {
    console.log(`🔄 Refreshing snapshots for ${productIds.length} products at location ${locationId}`);
    
    const today = new Date();
    
    for (const productId of productIds) {
      if (productId) {
        await this.dailyStockService.updateDailySnapshot(
          productId,
          locationId,
          today,
          0, // Will be fetched from database inside the method
          'in',
          0, // No additional quantity, just refreshing
          'refresh'
        );
      }
    }
    
    console.log('✅ All snapshots refreshed');
  } catch (error) {
    console.error('❌ Error refreshing snapshots:', error);
  }
}
// src/app/services/goods.service.ts


 getAvailablePurchaseOrdersByLocation(locationIds: string[]): Observable<DocumentData[]> {
    const toDate = (timestamp: any): Date | null => {
      if (timestamp instanceof Timestamp) {
        return timestamp.toDate();
      }
      if (timestamp && typeof timestamp.toDate === 'function') {
        return timestamp.toDate();
      }
      return timestamp;
    };

    return new Observable(observer => {
      // Get purchase orders filtered by location
      const ordersCollection = collection(this.firestore, 'purchase-orders');
      let availableOrdersQuery;
      
      if (!locationIds || locationIds.length === 0) {
        availableOrdersQuery = query(
          ordersCollection,
          where('isUsedForGoods', '!=', true),
          orderBy('createdAt', 'desc')
        );
      } else {
        availableOrdersQuery = query(
          ordersCollection,
          where('isUsedForGoods', '!=', true),
          where('businessLocationId', 'in', locationIds.slice(0, 10)),
          orderBy('createdAt', 'desc')
        );
      }

      // Observable for Purchase Orders
      const ordersObservable = new Observable<DocumentData[]>(ordersObserver => {
        const unsubscribe = onSnapshot(availableOrdersQuery, (snapshot) => {
          const orders = snapshot.docs.map(doc => {
            const data = doc.data() as Record<string, any>;
            return {
              ...data, // Spreading the original data
              id: doc.id,
              purchaseDate: toDate(data['orderDate'] || data['createdAt']),
              type: 'purchase-order',
              displayName: `PO: ${data['referenceNo'] || doc.id}`
            };
          }).filter(order => {
            // =========================================================================
            // ✅ FIX 1: Cast 'order' to 'any' to resolve TS2339 errors.
            // This tells TypeScript to trust that 'isUsedForGoods' and 'status' exist.
            // =========================================================================
            return !(order as any).isUsedForGoods && (order as any).status !== 'completed';
          });
          ordersObserver.next(orders);
        }, error => {
          console.error('Error fetching available purchase orders:', error);
          ordersObserver.error(error);
        });
        return () => unsubscribe();
      });

      // Observable for Direct Purchases (with the fix)
      const purchasesObservable = new Observable<DocumentData[]>(purchasesObserver => {
        // =========================================================================
        // ✅ FIX 2: Declare the unsubscribe function in the outer scope to resolve TS7030.
        // Initialize it with an empty function for safety.
        // =========================================================================
        let unsubscribeFromSnapshot = () => {};

        (async () => {
          try {
            const purchasesCollection = collection(this.firestore, 'purchases');
            let availablePurchasesQuery;

            if (!locationIds || locationIds.length === 0) {
              availablePurchasesQuery = query(
                purchasesCollection,
                where('isUsedForGoods', '!=', true),
                orderBy('createdAt', 'desc')
              );
            } else {
              const locationsCollection = collection(this.firestore, 'locations');
              const locationsSnapshot = await getDocs(locationsCollection);
              const locationIdToNameMap = new Map<string, string>();
              locationsSnapshot.forEach(doc => {
                  const data = doc.data();
                  locationIdToNameMap.set(doc.id, data['name']);
              });

              const userLocationNames = locationIds
                .map(id => locationIdToNameMap.get(id))
                .filter((name): name is string => !!name);

              if (userLocationNames.length > 0) {
                availablePurchasesQuery = query(
                  purchasesCollection,
                  where('isUsedForGoods', '!=', true),
                  where('businessLocation', 'in', userLocationNames.slice(0, 10)),
                  orderBy('createdAt', 'desc')
                );
              } else {
                purchasesObserver.next([]);
                return;
              }
            }
            
            // Assign the returned unsubscribe function to the outer-scoped variable
            unsubscribeFromSnapshot = onSnapshot(availablePurchasesQuery, (snapshot) => {
              const purchases = snapshot.docs.map(doc => {
                const data = doc.data() as Record<string, any>;
                return {
                  ...data,
                  id: doc.id,
                  type: 'direct-purchase',
                  displayName: `Purchase: ${data['referenceNo'] || doc.id}`,
                  purchaseDate: toDate(data['purchaseDate'] || data['createdAt']),
                  orderDate: toDate(data['purchaseDate'] || data['createdAt']),
                  items: data['products'] || [],
                  isUsedForGoods: data['isUsedForGoods'] || false
                };
              }).filter(purchase => !purchase.isUsedForGoods);
              purchasesObserver.next(purchases);
            }, error => {
              console.error('Error fetching available direct purchases:', error);
              purchasesObserver.error(error);
            });

          } catch (error) {
            purchasesObserver.error(error);
          }
        })();

        // Return the outer-scoped function, which will be populated by the async logic.
        return () => {
          unsubscribeFromSnapshot();
        };
      });

      const combinedSubscription = combineLatest([
        ordersObservable,
        purchasesObservable
      ]).subscribe(([orders, purchases]) => {
        const combined = [...orders, ...purchases].sort((a, b) => {
          const aDate = a['createdAt']?.toDate?.() || a['createdAt'] || new Date(0);
          const bDate = b['createdAt']?.toDate?.() || b['createdAt'] || new Date(0);
          return bDate.getTime() - aDate.getTime();
        });
        observer.next(combined);
      }, error => {
        observer.error(error);
      });

      return () => combinedSubscription.unsubscribe();
    });
  }
  // Helper method to clean data before sending to Firestore
  private cleanDataForFirestore(data: any): any {
    if (data === null || data === undefined) {
      return null;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.cleanDataForFirestore(item));
    }

    if (data instanceof Date) {
      return data;
    }

    if (typeof data === 'object' && !(data instanceof Timestamp)) { // Avoid converting Timestamps
        const cleaned: any = {};
        for (const key in data) {
            if (Object.prototype.hasOwnProperty.call(data, key)) {
                const value = data[key];
                if (value !== undefined) {
                    cleaned[key] = this.cleanDataForFirestore(value);
                }
            }
        }
        return cleaned;
    }

    return data;
  }

  // Enhanced validation method with detailed error messages
  private async validatePurchaseOrder(purchaseOrderId: string): Promise<void> {
    if (!purchaseOrderId) return;

    try {
      // Check in purchase-orders collection first
      const orderRef = doc(this.firestore, 'purchase-orders', purchaseOrderId);
      const orderDoc = await getDoc(orderRef);

      if (orderDoc.exists()) {
        const orderData = orderDoc.data();
        if (orderData?.['isUsedForGoods']) {
          throw new Error('PURCHASE_ORDER_ALREADY_USED');
        }
        if (orderData?.['status'] === 'completed') {
          throw new Error('PURCHASE_ORDER_COMPLETED');
        }
        return;
      }

      // Check in purchases collection
      const purchaseRef = doc(this.firestore, 'purchases', purchaseOrderId);
      const purchaseDoc = await getDoc(purchaseRef);

      if (purchaseDoc.exists()) {
        const purchaseData = purchaseDoc.data();
        if (purchaseData?.['isUsedForGoods']) {
          throw new Error('PURCHASE_ALREADY_USED');
        }
        return;
      }

      throw new Error('PURCHASE_ORDER_NOT_FOUND');
    } catch (error) {
      console.error('Purchase order/purchase validation failed:', error);
      throw error;
    }
  }

  // Enhanced method to check if purchase order or direct purchase is available
  async isPurchaseOrderAvailable(purchaseOrderId: string): Promise<{available: boolean, reason?: string}> {
    if (!purchaseOrderId) {
      return { available: false, reason: 'No purchase order ID provided' };
    }

    try {
      // Check in purchase-orders collection first
      const orderRef = doc(this.firestore, 'purchase-orders', purchaseOrderId);
      const orderDoc = await getDoc(orderRef);

      if (orderDoc.exists()) {
        const orderData = orderDoc.data();
        
        if (orderData?.['isUsedForGoods']) {
          return { available: false, reason: 'Purchase order has already been used for goods receiving' };
        }

        if (orderData?.['status'] === 'completed') {
          return { available: false, reason: 'Purchase order is already completed' };
        }

        return { available: true };
      }

      // Check in purchases collection
      const purchaseRef = doc(this.firestore, 'purchases', purchaseOrderId);
      const purchaseDoc = await getDoc(purchaseRef);

      if (purchaseDoc.exists()) {
        const purchaseData = purchaseDoc.data();
        
        if (purchaseData?.['isUsedForGoods']) {
          return { available: false, reason: 'Purchase has already been used for goods receiving' };
        }

        return { available: true };
      }

      return { available: false, reason: 'Purchase order/purchase does not exist' };
    } catch (error) {
      console.error('Error checking purchase order availability:', error);
      return { available: false, reason: 'Error checking purchase order status' };
    }
  }

// ... existing imports
// Make sure to import 'getDocs' and 'query' and 'where' if not already imported

  // +++ REVISED METHOD TO PREVENT DOUBLE COUNTING +++
  async addGoodsReceived(goodsData: any): Promise<DocumentReference> {
    try {
      // Validate required data
      if (!goodsData.supplier || !goodsData.businessLocation) {
        throw new Error('Supplier and business location are required');
      }
      if (!goodsData.products || goodsData.products.length === 0) {
        throw new Error('At least one product is required');
      }

      // 1. PRE-TRANSACTION: Identify IDs for both PO and Purchase to ensure we lock BOTH
      let targetPoId: string | null = null;
      let targetPurchaseId: string | null = null;
      const selectedId = goodsData.purchaseOrder; // This is the ID selected in the dropdown

      if (selectedId) {
        // Check if the selected ID is a Direct Purchase
        const purchaseRef = doc(this.firestore, 'purchases', selectedId);
        const purchaseSnap = await getDoc(purchaseRef);

        if (purchaseSnap.exists()) {
          // User selected a PURCHASE
          targetPurchaseId = selectedId;
          const pData = purchaseSnap.data();
          // If this purchase was created from a PO, get that PO's ID
          if (pData['purchaseOrderId']) {
            targetPoId = pData['purchaseOrderId'];
          }
        } else {
          // User selected a PURCHASE ORDER (or it doesn't exist)
          const poRef = doc(this.firestore, 'purchase-orders', selectedId);
          const poSnap = await getDoc(poRef);
          
          if (poSnap.exists()) {
            targetPoId = selectedId;
            // Find if there is a linked Purchase for this PO
            const purchasesQuery = query(
              collection(this.firestore, 'purchases'), 
              where('purchaseOrderId', '==', targetPoId)
            );
            const linkedPurchases = await getDocs(purchasesQuery);
            if (!linkedPurchases.empty) {
              targetPurchaseId = linkedPurchases.docs[0].id;
            }
          }
        }
      }

      console.log(`Linking documents - PO: ${targetPoId}, Purchase: ${targetPurchaseId}`);

      // Use transaction to ensure data consistency
      return await runTransaction(this.firestore, async (transaction) => {
        
        // --- READ PHASE ---
        let poRef: DocumentReference | null = null;
        let purchaseRef: DocumentReference | null = null;

        if (targetPoId) {
          poRef = doc(this.firestore, 'purchase-orders', targetPoId);
          const poDoc = await transaction.get(poRef);
          if (poDoc.exists()) {
            const data = poDoc.data();
            if (data['isUsedForGoods']) throw new Error('PURCHASE_ORDER_ALREADY_USED');
          }
        }

        if (targetPurchaseId) {
          purchaseRef = doc(this.firestore, 'purchases', targetPurchaseId);
          const pDoc = await transaction.get(purchaseRef);
          if (pDoc.exists()) {
            const data = pDoc.data();
            if (data['isUsedForGoods']) throw new Error('PURCHASE_ALREADY_USED');
          }
        }

        // --- WRITE PHASE ---
        
        // Create the new goods received document reference
        const goodsCollection = collection(this.firestore, 'goodsReceived');
        const docRef = doc(goodsCollection);

        // Update PO Status (if exists)
        if (poRef) {
           transaction.update(poRef, {
            isUsedForGoods: true,
            usedForGoodsDate: serverTimestamp(),
            status: 'completed',
            updatedAt: serverTimestamp(),
            goodsReceivedId: docRef.id
          });
        }

        // Update Purchase Status (if exists)
        if (purchaseRef) {
          transaction.update(purchaseRef, {
            isUsedForGoods: true,
            usedForGoodsDate: serverTimestamp(),
            updatedAt: serverTimestamp(),
            goodsReceivedId: docRef.id
          });
        }
        
        // Prepare and write the main GRN document
        const cleanedData = this.cleanDataForFirestore(goodsData);
        const referenceNo = cleanedData.referenceNo || `GRN-${Date.now()}`;
        const completeData = {
          ...cleanedData,
          referenceNo,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          receivedDate: cleanedData.receivedDate || serverTimestamp(),
          status: 'received',
          // Save links to both originals if they exist
          linkedPurchaseOrderId: targetPoId,
          linkedPurchaseId: targetPurchaseId
        };
        
        transaction.set(docRef, completeData);
        
        return docRef;
      }).then(async (docRef) => {
        // Post-transaction: Update stock
        const cleanedData = this.cleanDataForFirestore(goodsData);
        if (cleanedData.products && cleanedData.products.length > 0) {
          await this.updateStockQuantities(cleanedData, docRef.id);
        }
        return docRef;
      });

    } catch (error) {
      console.error('Error in addGoodsReceived:', error);
      if (error instanceof Error) {
        if (error.message.includes('ALREADY_USED')) {
           throw new Error('This order (or its linked purchase) has already been processed. Please refresh.');
        }
      }
      throw error;
    }
  }


  // Updated method to handle updates properly
  async updateGoodsReceived(id: string, data: any): Promise<void> {
    try {
      if (!id) {
        throw new Error('Goods received ID is required for update');
      }

      const goodsDoc = doc(this.firestore, this.collectionName, id);
      
      // Check if document exists
      const docSnap = await getDoc(goodsDoc);
      if (!docSnap.exists()) {
        throw new Error(`Goods received document ${id} does not exist`);
      }

      const cleanedData = this.cleanDataForFirestore({
        ...data,
        updatedAt: serverTimestamp()
      });

      await updateDoc(goodsDoc, cleanedData);
      console.log(`Goods received ${id} updated successfully`);
    } catch (error) {
      console.error('Error updating goods received:', error);
      throw error;
    }
  }

  async deleteGoodsReceived(id: string): Promise<void> {
    try {
      if (!id) {
        throw new Error('Goods received ID is required for deletion');
      }

      const goodsDoc = doc(this.firestore, this.collectionName, id);
      
      // Check if document exists
      const docSnap = await getDoc(goodsDoc);
      if (!docSnap.exists()) {
        throw new Error(`Goods received document ${id} does not exist`);
      }

      await deleteDoc(goodsDoc);
      console.log(`Goods received ${id} deleted successfully`);
    } catch (error) {
      console.error('Error deleting goods received:', error);
      throw error;
    }
  }

  getGoodsReceived(id: string): Observable<DocumentData | null> {
    return new Observable(observer => {
      if (!id) {
        observer.error(new Error('Goods received ID is required'));
        return;
      }

      const goodsDoc = doc(this.firestore, this.collectionName, id);
      const unsubscribe = onSnapshot(goodsDoc, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as Record<string, any>;
          observer.next({ id: docSnap.id, ...data });
        } else {
          observer.next(null);
        }
      }, error => {
        console.error('Error fetching goods received:', error);
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
      if (!supplierId) {
        observer.error(new Error('Supplier ID is required'));
        return;
      }

      const goodsCollection = collection(this.firestore, this.collectionName);
      const supplierQuery = query(goodsCollection, where('supplier', '==', supplierId));

      const unsubscribe = onSnapshot(supplierQuery, (snapshot) => {
        const goods = snapshot.docs.map(doc => {
          const data = doc.data() as Record<string, any>;
          return { id: doc.id, ...data };
        });
        observer.next(goods);
      }, error => {
        console.error('Error fetching goods by supplier:', error);
        observer.error(error);
      });
      
      return () => unsubscribe();
    });
  }

  // Method to get goods with pending deliveries
  getGoodsWithPendingDeliveries(): Observable<DocumentData[]> {
    return new Observable(observer => {
      const goodsCollection = collection(this.firestore, this.collectionName);
      const pendingQuery = query(goodsCollection, where('hasPartialDeliveries', '==', true));

      const unsubscribe = onSnapshot(pendingQuery, (snapshot) => {
        const goods = snapshot.docs.map(doc => {
          const data = doc.data() as Record<string, any>;
          return { id: doc.id, ...data };
        });
        observer.next(goods);
      }, error => {
        console.error('Error fetching goods with pending deliveries:', error);
        observer.error(error);
      });
      
      return () => unsubscribe();
    });
  }

  // Method to get delivery history for a specific original GRN
  getDeliveryHistory(originalGrnId: string): Observable<DocumentData[]> {
    return new Observable(observer => {
      if (!originalGrnId) {
        observer.error(new Error('Original GRN ID is required'));
        return;
      }

      const goodsCollection = collection(this.firestore, this.collectionName);
      const historyQuery = query(goodsCollection, where('originalGrnId', '==', originalGrnId));

      const unsubscribe = onSnapshot(historyQuery, (snapshot) => {
        const deliveries = snapshot.docs.map(doc => {
          const data = doc.data() as Record<string, any>;
          return { id: doc.id, ...data };
        });
        observer.next(deliveries);
      }, error => {
        console.error('Error fetching delivery history:', error);
        observer.error(error);
      });
      
      return () => unsubscribe();
    });
  }

  // Method to get goods received by date range
  getGoodsByDateRange(startDate: Date, endDate: Date): Observable<DocumentData[]> {
    return new Observable(observer => {
      if (!startDate || !endDate) {
        observer.error(new Error('Start date and end date are required'));
        return;
      }

      const goodsCollection = collection(this.firestore, this.collectionName);
      const dateQuery = query(
        goodsCollection, 
        where('receivedDate', '>=', startDate),
        where('receivedDate', '<=', endDate)
      );

      const unsubscribe = onSnapshot(dateQuery, (snapshot) => {
        const goods = snapshot.docs.map(doc => {
          const data = doc.data() as Record<string, any>;
          return { id: doc.id, ...data };
        });
        observer.next(goods);
      }, error => {
        console.error('Error fetching goods by date range:', error);
        observer.error(error);
      });
      
      return () => unsubscribe();
    });
  }

  // Method to get goods received by reference number
  async getGoodsByReferenceNo(referenceNo: string): Promise<DocumentData | null> {
    try {
      if (!referenceNo) {
        throw new Error('Reference number is required');
      }

      const goodsCollection = collection(this.firestore, this.collectionName);
      const refQuery = query(goodsCollection, where('referenceNo', '==', referenceNo));
      
      const querySnapshot = await getDocs(refQuery);
      
      if (querySnapshot.empty) {
        return null;
      }

      const doc = querySnapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    } catch (error) {
      console.error('Error fetching goods by reference number:', error);
      throw error;
    }
  }

  // Method to check if a purchase order is already used
  async isPurchaseOrderUsed(purchaseOrderId: string): Promise<boolean> {
    try {
      if (!purchaseOrderId) return false;

      // Check purchase-orders collection first
      const orderRef = doc(this.firestore, 'purchase-orders', purchaseOrderId);
      const orderDoc = await getDoc(orderRef);
      
      if (orderDoc.exists()) {
        const orderData = orderDoc.data();
        return orderData?.['isUsedForGoods'] === true;
      }

      // Check purchases collection
      const purchaseRef = doc(this.firestore, 'purchases', purchaseOrderId);
      const purchaseDoc = await getDoc(purchaseRef);
      
      if (purchaseDoc.exists()) {
        const purchaseData = purchaseDoc.data();
        return purchaseData?.['isUsedForGoods'] === true;
      }

      return true; // If it doesn't exist, consider it "used"
    } catch (error) {
      console.error('Error checking if purchase order is used:', error);
      return true; // If error, consider it used to be safe
    }
  }

  // **UPDATED METHOD**: Now combines both purchase orders and direct purchases
  getAvailablePurchaseOrders(): Observable<DocumentData[]> {
    // Helper to convert Firestore Timestamp to JS Date
    const toDate = (timestamp: any): Date | null => {
        if (timestamp instanceof Timestamp) {
            return timestamp.toDate();
        }
        if (timestamp && typeof timestamp.toDate === 'function') {
            return timestamp.toDate();
        }
        return timestamp; // Return as is if not a convertable timestamp
    };

    return new Observable(observer => {
      // Get purchase orders
      const ordersCollection = collection(this.firestore, 'purchase-orders');
      const availableOrdersQuery = query(
        ordersCollection, 
        where('isUsedForGoods', '!=', true),
        orderBy('createdAt', 'desc')
      );

      // Get direct purchases
      const purchasesCollection = collection(this.firestore, 'purchases');
      const availablePurchasesQuery = query(
        purchasesCollection, 
        where('isUsedForGoods', '!=', true),
        orderBy('createdAt', 'desc')
      );

      // Combine both observables
      const ordersObservable = new Observable<DocumentData[]>(ordersObserver => {
        const unsubscribe = onSnapshot(availableOrdersQuery, (snapshot) => {
          const orders = snapshot.docs.map(doc => {
            const data = doc.data() as Record<string, any>;
            return { 
              id: doc.id, 
              ...data,
              // *** FIX: Convert timestamp to Date object ***
              purchaseDate: toDate(data['orderDate'] || data['createdAt']),
              type: 'purchase-order',
              displayName: `PO: ${data['referenceNo'] || doc.id}`
            };
          }).filter(order => {
            return !(order as any).isUsedForGoods && (order as any).status !== 'completed';
          });
          ordersObserver.next(orders);
        }, error => {
          console.error('Error fetching available purchase orders:', error);
          ordersObserver.error(error);
        });
        
        return () => unsubscribe();
      });

      const purchasesObservable = new Observable<DocumentData[]>(purchasesObserver => {
        const unsubscribe = onSnapshot(availablePurchasesQuery, (snapshot) => {
          const purchases = snapshot.docs.map(doc => {
            const data = doc.data() as Record<string, any>;
            return { 
              id: doc.id, 
              ...data,
              type: 'direct-purchase',
              displayName: `Purchase: ${data['referenceNo'] || doc.id}`,
              // Map purchase fields to match purchase order structure
              supplierId: data['supplierId'],
              supplierName: data['supplierName'],
              // *** FIX: Convert timestamp to Date object ***
              purchaseDate: toDate(data['purchaseDate'] || data['createdAt']),
              orderDate: toDate(data['purchaseDate'] || data['createdAt']),
              referenceNo: data['referenceNo'],
              status: data['purchaseStatus'] || 'received',
              products: data['products'] || [],
              items: data['products'] || [],
              invoiceNo: data['invoiceNo'],
              businessLocation: data['businessLocation'],
              businessLocationId: data['businessLocation'],
orderTotal: data['grandTotal'] || data['purchaseTotal'] || 0,
              isUsedForGoods: data['isUsedForGoods'] || false
            };
          }).filter(purchase => {
            return !(purchase as any).isUsedForGoods;
          });
          purchasesObserver.next(purchases);
        }, error => {
          console.error('Error fetching available direct purchases:', error);
          purchasesObserver.error(error);
        });
        
        return () => unsubscribe();
      });

      // Combine both streams
      const combinedSubscription = combineLatest([
        ordersObservable, 
        purchasesObservable
      ]).subscribe(([orders, purchases]) => {
        // Combine and sort by creation date (newest first)
        const combined = [...orders, ...purchases].sort((a, b) => {
          const aDate = a['createdAt']?.toDate?.() || a['createdAt'] || new Date(0);
          const bDate = b['createdAt']?.toDate?.() || b['createdAt'] || new Date(0);
          return bDate.getTime() - aDate.getTime();
        });
        observer.next(combined);
      }, error => {
        observer.error(error);
      });
      
      return () => combinedSubscription.unsubscribe();
    });
  }


  // **NEW METHOD**: Get available direct purchases only
  getAvailableDirectPurchases(): Observable<DocumentData[]> {
    return new Observable(observer => {
      const purchasesCollection = collection(this.firestore, 'purchases');
      const availablePurchasesQuery = query(
        purchasesCollection, 
        where('isUsedForGoods', '!=', true),
        orderBy('createdAt', 'desc')
      );

      const unsubscribe = onSnapshot(availablePurchasesQuery, (snapshot) => {
        const purchases = snapshot.docs.map(doc => {
          const data = doc.data() as Record<string, any>;
          return { 
            id: doc.id, 
            ...data,
            type: 'direct-purchase'
          };
        }).filter(purchase => {
          return !(purchase as any).isUsedForGoods;
        });
        observer.next(purchases);
      }, error => {
        console.error('Error fetching available direct purchases:', error);
        observer.error(error);
      });
      
      return () => unsubscribe();
    });
  }
}