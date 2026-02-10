import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  DocumentData,
  QuerySnapshot,
  QueryDocumentSnapshot,
  DocumentSnapshot,
  FirestoreError,
  getDoc,
  setDoc,
  getDocs,
  Timestamp,
  increment
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { COLLECTIONS } from '../../utils/constants';
import { AccountService } from './account.service';
import { PurchaseService } from './purchase.service';
import { SupplierService } from './supplier.service';

// Define return product item interface
interface ReturnProductItem {
  id?: string;
  productId?: string;
  name?: string;
  productName?: string;
  sku?: string;
  quantity?: number;
  returnQuantity: number;
  price?: number;
  unitCost?: number;
  subtotal: number;
  totalCost?: number;
  code?: string;
  batchNumber?: string;
  expiryDate?: Date;
}

// Define the PurchaseReturn interface
interface PurchaseReturn {
  [x: string]: any;
  id?: string;
  returnDate: string | Date;
  referenceNo: string;
  parentPurchaseId: string;
  parentPurchaseRef: string;
  businessLocation: string;
  businessLocationId?: string;
  supplier: string;
  supplierId?: string;
  returnStatus: string;
  paymentStatus: string;
  products: ReturnProductItem[];
  reason: string;
  grandTotal: number;
  totalWithoutTax?: number;
  totalTaxReturned?: number;
  createdAt: Date;
  createdBy: string;
}

// Add the PurchaseReturnLog interface
interface PurchaseReturnLog {
  id?: string;
  purchaseRefNo: string;
  returnDate: string | Date;
  purchasedQuantity: number;
  returnQuantity: number;
  subTotal: number;
  productId: string;
  productName: string;
  businessLocation: string;
  businessLocationId: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable({
  providedIn: 'root'
})
export class PurchaseReturnService {

  private collectionName = 'purchase-returns';
  private logCollectionName = 'purchase-return-log';

  constructor(
    private firestore: Firestore,
    private accountService: AccountService,
    private purchaseService: PurchaseService,
    private supplierService: SupplierService
  ) {}

  // Helper method to properly convert Firestore Timestamps to JavaScript Dates
  private convertTimestampToDate(timestamp: any): Date {
    if (!timestamp) return new Date();
    if (timestamp instanceof Date) return timestamp;
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }
    if (timestamp.seconds) {
      return new Date(timestamp.seconds * 1000);
    }
    if (typeof timestamp === 'string') {
      const parsedDate = new Date(timestamp);
      return isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
    }
    return new Date();
  }

  // Helper method to properly convert JavaScript Dates to Firestore Timestamps
  private convertDateToTimestamp(date: any): Timestamp {
    if (!date) return Timestamp.now();
    if (date.seconds && date.nanoseconds !== undefined) {
      return date;
    }
    if (date instanceof Date) {
      return Timestamp.fromDate(date);
    }
    if (typeof date === 'string') {
      const parsedDate = new Date(date);
      return isNaN(parsedDate.getTime()) ? Timestamp.now() : Timestamp.fromDate(parsedDate);
    }
    return Timestamp.now();
  }

  // Helper method to normalize date data from Firestore
  private normalizeDateData(data: any): any {
    return {
      ...data,
      returnDate: this.convertTimestampToDate(data.returnDate),
      createdAt: this.convertTimestampToDate(data.createdAt),
      updatedAt: this.convertTimestampToDate(data.updatedAt)
    };
  }
  
  async getPurchaseReturnsByDateRange(startDate: Date, endDate: Date): Promise<PurchaseReturn[]> {
    try {
      const returnsCollection = collection(this.firestore, this.collectionName);
      const startTimestamp = Timestamp.fromDate(startDate);
      const endTimestamp = Timestamp.fromDate(endDate);

      const q = query(
        returnsCollection,
        where('returnDate', '>=', startTimestamp),
        where('returnDate', '<=', endTimestamp)
      );

      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => {
        return this.normalizeDateData({
          id: doc.id,
          ...doc.data()
        }) as PurchaseReturn;
      });

    } catch (error) {
      console.error('Error fetching purchase returns by date range:', error);
      return []; 
    }
  }
  
  async getReturnedQuantityForProduct(parentPurchaseRef: string, productId: string): Promise<number> {
    try {
      const logCollection = collection(this.firestore, this.logCollectionName);
      const q = query(
        logCollection,
        where('purchaseRefNo', '==', parentPurchaseRef),
        where('productId', '==', productId)
      );

      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return 0;
      }

      const totalReturned = querySnapshot.docs.reduce((sum, doc) => {
        const data = doc.data();
        return sum + (data['returnQuantity'] || 0);
      }, 0);

      return totalReturned;
    } catch (error) {
      console.error('Error getting returned quantity for product:', error);
      return 0; 
    }
  }

  getPurchaseReturnLogs(): Observable<PurchaseReturnLog[]> {
    const colRef = collection(this.firestore, this.logCollectionName);
    const q = query(colRef, orderBy('createdAt', 'desc'));

    return new Observable<PurchaseReturnLog[]>(observer => {
      const unsubscribe = onSnapshot(
        q,
        (snapshot: QuerySnapshot<DocumentData>) => {
          const data = snapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => 
            this.normalizeDateData({
              id: doc.id,
              ...doc.data()
            })
          ) as PurchaseReturnLog[];
          observer.next(data);
        },
        (error: FirestoreError) => observer.error(error)
      );

      return { unsubscribe };
    });
  }

  getPurchaseReturnLogsByProduct(productId: string): Observable<PurchaseReturnLog[]> {
    const colRef = collection(this.firestore, this.logCollectionName);
    const q = query(
      colRef,
      where('productId', '==', productId),
      orderBy('returnDate', 'desc')
    );

    return new Observable<PurchaseReturnLog[]>(observer => {
      const unsubscribe = onSnapshot(
        q,
        (snapshot: QuerySnapshot<DocumentData>) => {
          const data = snapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) =>
            this.normalizeDateData({
              id: doc.id,
              ...doc.data()
            })
          ) as PurchaseReturnLog[];
          observer.next(data);
        },
        (error: FirestoreError) => observer.error(error)
      );

      return { unsubscribe };
    });
  }

  getPurchaseReturns(): Observable<PurchaseReturn[]> {
    const colRef = collection(this.firestore, this.collectionName);
    const q = query(colRef, orderBy('createdAt', 'desc'));

    return new Observable<PurchaseReturn[]>(observer => {
      const unsubscribe = onSnapshot(
        q,
        (snapshot: QuerySnapshot<DocumentData>) => {
          const data = snapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) =>
            this.normalizeDateData({
              id: doc.id,
              ...doc.data()
            })
          ) as PurchaseReturn[];
          observer.next(data);
        },
        (error: FirestoreError) => observer.error(error)
      );

      return { unsubscribe };
    });
  }

  async getPurchaseReturnsByProductId(productId: string): Promise<any[]> {
    try {
      const returnsRef = collection(this.firestore, 'purchase-returns');
      const querySnapshot = await getDocs(returnsRef);
      
      const currentProduct = (this as any)['currentProduct'];

      return querySnapshot.docs
        .map(doc => {
          const data = doc.data();
          return this.normalizeDateData({
            id: doc.id,
            ...data
          });
        })
        .filter((returnItem: any) => 
          returnItem.products?.some((p: any) => 
            p.productId === productId || 
            (currentProduct && p.productName === currentProduct.productName) ||
            (currentProduct && currentProduct.productName && p.name === currentProduct.productName)
          )
        );
    } catch (error) {
      console.error('Error getting purchase returns by product ID:', error);
      return [];
    }
  }

  getPurchaseReturn(id: string): Observable<PurchaseReturn | undefined> {
    const docRef = doc(this.firestore, `${this.collectionName}/${id}`);

    return new Observable<PurchaseReturn | undefined>(observer => {
      const unsubscribe = onSnapshot(
        docRef,
        (docSnap: DocumentSnapshot<DocumentData>) => {
          if (docSnap.exists()) {
            const data = this.normalizeDateData({ id: docSnap.id, ...docSnap.data() });
            observer.next(data as PurchaseReturn);
          } else {
            observer.next(undefined);
          }
        },
        (error: FirestoreError) => observer.error(error)
      );

      return { unsubscribe };
    });
  }

  async addPurchaseReturn(purchaseReturn: PurchaseReturn): Promise<any> {
    try {
      const originalPurchase = await this.purchaseService.getPurchaseById(purchaseReturn.parentPurchaseId);
      
      if (!originalPurchase) {
        throw new Error('Original purchase not found');
      }

      const returnData = {
        ...purchaseReturn,
        returnDate: this.convertDateToTimestamp(purchaseReturn.returnDate),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      const returnDocRef = await addDoc(collection(this.firestore, this.collectionName), returnData);
      const logCollection = collection(this.firestore, this.logCollectionName);
      
      const logPromises = purchaseReturn.products.map(async (product) => {
        const originalProduct = originalPurchase.products?.find(p => p.productId === (product.productId || product.id));
        
        const purchasedQuantity = originalProduct?.quantity || 0;
        const returnQuantity = product.returnQuantity || product.quantity || 0;
        const subTotal = returnQuantity * (product.price || product.unitCost || originalProduct?.unitCost || 0);

        const logData = {
          purchaseRefNo: purchaseReturn.parentPurchaseRef,
          returnDate: this.convertDateToTimestamp(purchaseReturn.returnDate),
          purchasedQuantity: purchasedQuantity,
          returnQuantity: returnQuantity,
          subTotal: subTotal,
          productId: product.productId || product.id!,
          productName: product.productName || product.name!,
          businessLocation: purchaseReturn.businessLocation,
          businessLocationId: purchaseReturn.businessLocationId || '',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        };
        
        return addDoc(logCollection, logData);
      });

      await Promise.all(logPromises);

      console.log('Purchase return and logs created successfully');
      return returnDocRef;
      
    } catch (error) {
      console.error('Error adding purchase return:', error);
      throw error;
    }
  }

  async addPurchaseReturnLog(logData: PurchaseReturnLog): Promise<any> {
    try {
      const logCollection = collection(this.firestore, this.logCollectionName);
      const firestoreLogData = {
        ...logData,
        returnDate: this.convertDateToTimestamp(logData.returnDate),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };
      
      return await addDoc(logCollection, firestoreLogData);
    } catch (error) {
      console.error('Error adding purchase return log:', error);
      throw error;
    }
  }

  updatePurchaseReturn(id: string, data: Partial<PurchaseReturn>): Promise<void> {
    const docRef = doc(this.firestore, `${this.collectionName}/${id}`);
    
    const updateData: any = { ...data };
    if (data.returnDate) {
      updateData.returnDate = this.convertDateToTimestamp(data.returnDate);
    }
    updateData.updatedAt = Timestamp.now();
    
    return updateDoc(docRef, updateData);
  }

  deletePurchaseReturn(id: string): Promise<void> {
    const docRef = doc(this.firestore, `${this.collectionName}/${id}`);
    return deleteDoc(docRef);
  }

  generateReferenceNumber(): string {
    const now = new Date();
    return `PRN-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Date.now()}`;
  }

  getReturnStatusClass(status: string): string {
    if (!status) return 'status-unknown';

    switch (status.toLowerCase()) {
      case 'completed':
        return 'status-active';
      case 'pending':
        return 'status-inactive';
      case 'partial':
        return 'status-partial';
      case 'rejected':
        return 'status-rejected';
      default:
        return 'status-unknown';
    }
  }

// In src/app/services/purchase-return.service.ts

// In src/app/services/purchase-return.service.ts

async processPurchaseReturnWithStock(returnData: PurchaseReturn): Promise<string> {
  try {
    // Step 1: Ensure Business Location ID is set
    if (!returnData.businessLocationId && returnData.businessLocation) {
      const location = typeof returnData.businessLocation === 'object'
        ? (returnData.businessLocation as any).id
        : returnData.businessLocation;
      returnData.businessLocationId = location;
    }

    if (!returnData.businessLocationId) {
      throw new Error('Business location ID is required');
    }

    // Step 2: Get the original purchase to validate against
    const originalPurchase = await this.purchaseService.getPurchaseById(returnData.parentPurchaseId);
    if (!originalPurchase) {
      throw new Error('Original purchase not found');
    }

    // Step 3: Prepare and create the new purchase return document
    const firestoreReturnData = {
      ...returnData,
      returnDate: this.convertDateToTimestamp(returnData.returnDate),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };
    const returnDocRef = await addDoc(collection(this.firestore, this.collectionName), firestoreReturnData);

    // Step 4: Process each returned product
    const logCollection = collection(this.firestore, this.logCollectionName);
    for (const product of returnData.products) {
      const originalProduct = originalPurchase.products?.find(p => p.productId === (product.productId || product.id));

      const purchasedQuantity = originalProduct?.quantity || 0;
      const returnQuantity = product.returnQuantity || product.quantity || 0;
      const subTotal = returnQuantity * (product.price || product.unitCost || originalProduct?.unitCost || 0);

      // 4a: Reduce the product's stock quantity for this location
      await this.reduceProductStock(
        product.productId || product.id!,
        returnData.businessLocationId,
        returnQuantity,
        returnData.referenceNo,
        `Purchase return: ${returnData.reason}`,
        returnData.createdBy
      );

      // 4b: Create a detailed log entry for the return
      const logData = {
        purchaseRefNo: returnData.parentPurchaseRef,
        returnDate: this.convertDateToTimestamp(returnData.returnDate),
        purchasedQuantity: purchasedQuantity,
        returnQuantity: returnQuantity,
        subTotal: subTotal,
        productId: product.productId || product.id!,
        productName: product.productName || product.name!,
        businessLocation: returnData.businessLocation,
        businessLocationId: returnData.businessLocationId,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };
      await addDoc(logCollection, logData);
    }

    // Step 5: Handle the financial transactions
    // This intelligently reduces the supplier's balance (Sundry Creditors) for due purchases
    // or creates a cash refund transaction for paid purchases.
    await this.createReturnTransaction(returnData, returnDocRef.id);

    // ======================= THE FINAL FIX =======================
    // Step 6: Update the original purchase document itself.
    // This is the critical step that reduces the 'paymentDue' amount and updates the
    // 'paymentStatus' on the original purchase record, ensuring it reflects the return.
    await this.purchaseService.updatePurchaseAfterReturn(
      returnData.parentPurchaseId,
      returnData.grandTotal
    );
    // ===================== END OF THE FINAL FIX ====================

    console.log(`✅ Purchase return ${returnDocRef.id} processed successfully. Original purchase ${returnData.parentPurchaseId} has been updated.`);
    return returnDocRef.id;

  } catch (error) {
    console.error('Error processing purchase return with stock:', error);
    // Re-throw the error so the component can handle it and notify the user
    throw error;
  }
}
private isFullReturn(returnData: PurchaseReturn, originalPurchase: any): boolean {
  if (!returnData.products || !originalPurchase.products) return false;
  
  return returnData.products.every(returnProduct => {
    const originalProduct = originalPurchase.products.find((p: any) => 
      (p.productId || p.id) === (returnProduct.productId || returnProduct.id)
    );
    
    if (!originalProduct) return false;
    
    const returnQty = returnProduct.returnQuantity || 0;
    const originalQty = originalProduct.quantity || 0;
    
    return returnQty >= originalQty;
  });
}

getReturnTotals(returns: any[]): { 
  totalWithoutTax: number; 
  totalTax: number; 
  totalShipping: number;
  totalShippingTax: number;
} {
  let totalWithoutTax = 0;
  let totalTax = 0;
  let totalShipping = 0;
  let totalShippingTax = 0;

  returns.forEach(returnItem => {
    if (returnItem.totalWithoutTax !== undefined && returnItem.totalWithoutTax !== null) {
      totalWithoutTax += Number(returnItem.totalWithoutTax);
    } else if (returnItem.products && Array.isArray(returnItem.products)) {
      const productsTotal = returnItem.products.reduce((productSum: number, product: any) => {
        const quantity = product.returnQuantity || 0;
        const unitPriceBeforeTax = this.getUnitCostBeforeTaxFromProduct(product);
        return productSum + (quantity * unitPriceBeforeTax);
      }, 0);
      totalWithoutTax += productsTotal;
    }

    if (returnItem.totalTaxReturned !== undefined && returnItem.totalTaxReturned !== null) {
      totalTax += Number(returnItem.totalTaxReturned);
    } else if (returnItem.products && Array.isArray(returnItem.products)) {
      const taxTotal = returnItem.products.reduce((taxSum: number, product: any) => {
        return taxSum + (Number(product.taxAmount) || 0);
      }, 0);
      totalTax += taxTotal;
    }

    totalShipping += (Number(returnItem.shippingChargesRefunded) || 0);
    totalShippingTax += (Number(returnItem.shippingTaxRefunded) || 0);

  });

  return { totalWithoutTax, totalTax, totalShipping, totalShippingTax };
}

  async getTotalRefundedShippingChargesByDateRange(startDate: Date, endDate: Date): Promise<number> {
    try {
      const purchaseReturnsCollection = collection(this.firestore, 'purchase-returns');
      
      const q = query(
        purchaseReturnsCollection,
        where('returnDate', '>=', startDate),
        where('returnDate', '<=', endDate)
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return 0;
      }

      const totalRefunded = querySnapshot.docs.reduce((sum, doc) => {
        const data = doc.data() as any;
        return sum + (Number(data.shippingChargesRefunded) || 0);
      }, 0);

      return totalRefunded;
    } catch (error) {
      console.error('Error fetching total refunded shipping charges:', error);
      return 0;
    }
  }
    async getTotalRefundedShippingTaxByDateRange(startDate: Date, endDate: Date): Promise<number> {
    try {
      const purchaseReturnsCollection = collection(this.firestore, 'purchase-returns');
      
      const q = query(
        purchaseReturnsCollection,
        where('returnDate', '>=', startDate),
        where('returnDate', '<=', endDate)
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return 0;
      }
      
      const totalRefundedTax = querySnapshot.docs.reduce((sum, doc) => {
        const data = doc.data() as any;
        return sum + (Number(data.shippingTaxRefunded) || 0);
      }, 0);

      return totalRefundedTax;
    } catch (error) {
      console.error('Error fetching total refunded shipping tax:', error);
      return 0;
    }
  }
  
  private async reduceProductStock(
    productId: string,
    locationId: string,
    quantity: number,
    referenceNo: string,
    notes: string,
    userId: string
  ): Promise<void> {
    try {
      const stockDocId = `${productId}_${locationId}`;
      const stockDocRef = doc(this.firestore, COLLECTIONS.PRODUCT_STOCK, stockDocId);
      const stockDoc = await getDoc(stockDocRef);
      
      let currentStock = 0;
      if (stockDoc.exists()) {
        currentStock = stockDoc.data()['quantity'] || 0;
      }
      
      const newStock = Math.max(0, currentStock - quantity);
      
      await setDoc(stockDocRef, {
        productId,
        locationId,
        quantity: newStock,
        lastUpdated: Timestamp.now(),
        updatedBy: userId
      }, { merge: true });
      
      await this.createReturnStockHistory({
        productId,
        locationId,
        action: 'purchase_return',
        quantity,
        oldStock: currentStock,
        newStock,
        referenceNo,
        notes,
        userId
      });
      
    } catch (error) {
      console.error('Error reducing product stock for return:', error);
      throw error;
    }
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
        timestamp: Timestamp.now()
      });
    } catch (error) {
      console.error('Error creating return stock history:', error);
    }
  }

  async getAvailableStockForReturn(productId: string, locationId: string): Promise<number> {
    try {
      const stockDocId = `${productId}_${locationId}`;
      const stockDocRef = doc(this.firestore, COLLECTIONS.PRODUCT_STOCK, stockDocId);
      const stockDoc = await getDoc(stockDocRef);
      
      if (stockDoc.exists()) {
        return stockDoc.data()['quantity'] || 0;
      }
      return 0;
    } catch (error) {
      console.error('Error getting available stock:', error);
      return 0;
    }
  }

  async validateReturnQuantities(returnData: PurchaseReturn): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    if (!returnData.businessLocationId) {
      errors.push('Business location is required');
      return { isValid: false, errors };
    }
    
    for (const product of returnData.products) {
      const availableStock = await this.getAvailableStockForReturn(
        product.productId || product.id!,
        returnData.businessLocationId
      );
      
      if (product.returnQuantity > availableStock) {
        errors.push(
          `Cannot return ${product.returnQuantity} units of ${product.productName || product.name}. ` +
          `Only ${availableStock} units available at this location.`
        );
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * ✅ [FIXED AGAIN] Creates a transaction record for a purchase return, handling multi-step partial returns correctly.
// In src/app/services/purchase-return.service.ts

  /**
   * ✅ [FIXED] Creates a transaction for a purchase return, correctly handling all scenarios.
   * - If the purchase was DUE, it reduces the supplier's balance (Sundry Creditors).
   * - If the purchase was PAID, it creates a cash refund (credit) to the original payment account.
   * - If the purchase was PARTIALLY PAID, it does both: first clears the due, then refunds the rest.
   */
// ... other code in the file

// Find the createReturnTransaction method and modify it as shown below:


private async createReturnTransaction(returnData: PurchaseReturn, returnId: string): Promise<void> {
    try {
        // Step 1: Get the most up-to-date state of the original purchase.
        const originalPurchase = await this.purchaseService.getPurchaseById(returnData.parentPurchaseId);
        if (!originalPurchase) {
            console.warn('Original purchase not found. Cannot create financial transaction for return.');
            return;
        }

        // Steps 2, 3, and 4 correctly calculate the amounts and remain unchanged.
        const grandTotal = originalPurchase.grandTotal || 0;
        const paymentAmount = originalPurchase.paymentAmount || 0;
        const totalPreviouslyReturned = originalPurchase['totalReturned'] || 0;
        const balanceBeforeThisReturn = grandTotal - paymentAmount - totalPreviouslyReturned;

        const currentReturnAmount = returnData.grandTotal;

        const amountToReduceLiability = Math.min(Math.max(0, balanceBeforeThisReturn), currentReturnAmount);
        const cashRefundAmount = currentReturnAmount - amountToReduceLiability;

        console.log('--- Purchase Return Financial Logic ---', {
            Balance_DUE_Before_This_Return: `₹${balanceBeforeThisReturn.toFixed(2)}`,
            Current_Return_Value: `₹${currentReturnAmount.toFixed(2)}`,
            Decision_Reduce_Liability_By: `₹${amountToReduceLiability.toFixed(2)}`,
            Decision_Cash_Refund_Amount: `₹${cashRefundAmount.toFixed(2)}`
        });

        // ======================= ✅ THE DEFINITIVE FIX =======================
        // Step 5: ACTION - Directly and atomically reduce the supplier's liability (Sundry Creditors).
        // This block ONLY runs if the return is against a balance that was due.
        if (amountToReduceLiability > 0) {
            const supplierId = returnData.supplierId || originalPurchase.supplierId;
            if (supplierId) {
                // We now bypass the supplierService and perform a direct, atomic update.
                // This is the most reliable way to ensure the balance is changed.
                const supplierRef = doc(this.firestore, 'suppliers', supplierId);
                await updateDoc(supplierRef, {
                    balance: increment(-amountToReduceLiability) // Use negative to decrease the balance.
                });
                console.log(`✅ Success: Directly reduced supplier balance (Sundry Creditors) by ₹${amountToReduceLiability.toFixed(2)}.`);
            } else {
                console.warn(`Could not reduce Sundry Creditors for return ${returnData.referenceNo}: Supplier ID is missing from the purchase record.`);
            }
        }
        // ===================== END OF THE DEFINITIVE FIX ====================

        // Step 6: ACTION - Create a Cash Refund Transaction if applicable.
        // This logic is correct and remains unchanged. It handles returns for PAID purchases.
        if (cashRefundAmount > 0) {
            const paymentAccountId = originalPurchase.paymentAccount?.id;
            if (paymentAccountId) {
                const transactionData = {
                    amount: cashRefundAmount,
                    type: 'purchase_return',
                    date: this.convertTimestampToDate(returnData.returnDate),
                    description: `Cash Refund from Purchase Return: ${returnData.referenceNo}`,
                    reference: returnData.referenceNo,
                    relatedDocId: returnId,
                    credit: cashRefundAmount,
                    debit: 0,
                    createdAt: new Date()
                };
                await this.accountService.addTransaction(paymentAccountId, transactionData);
                console.log(`✅ Success: Created account book credit of ₹${cashRefundAmount.toFixed(2)} for return ${returnData.referenceNo}`);
            } else {
                console.warn(`Return ${returnData.referenceNo} resulted in a cash refund of ₹${cashRefundAmount.toFixed(2)}, but the original purchase has no payment account. Cannot create transaction.`);
            }
        }

    } catch (error) {
        console.error('Error during the creation of the return transaction:', error);
    }
  }

// ... rest of the file

  async getTotalReturnsWithoutTaxByDateRange(startDate: Date, endDate: Date): Promise<number> {
    try {
      const returnsCollection = collection(this.firestore, this.collectionName);
      const startTimestamp = Timestamp.fromDate(startDate);
      const endTimestamp = Timestamp.fromDate(endDate);

      const q = query(
        returnsCollection,
        where('returnDate', '>=', startTimestamp),
        where('returnDate', '<=', endTimestamp)
      );

      const querySnapshot = await getDocs(q);

      const totalReturns = querySnapshot.docs.reduce((sum, doc) => {
        const data = doc.data();
        return sum + (data['grandTotal'] || 0);
      }, 0);

      return totalReturns;

    } catch (error) {
      console.error('Error fetching total purchase returns by date range:', error);
      return 0;
    }
  }
  async getPurchaseReturnSummary(startDate: Date, endDate: Date): Promise<any> {
    try {
      const startTimestamp = this.convertDateToTimestamp(startDate);
      const endTimestamp = this.convertDateToTimestamp(endDate);
      
      const q = query(
        collection(this.firestore, this.collectionName),
        where('returnDate', '>=', startTimestamp),
        where('returnDate', '<=', endTimestamp)
      );
      
      const snapshot = await getDocs(q);
      const returns = snapshot.docs.map(doc => this.normalizeDateData({ id: doc.id, ...doc.data() }));
      
      return {
        totalReturns: returns.length,
        totalAmount: returns.reduce((sum: number, ret: any) => sum + (ret.grandTotal || 0), 0),
        completedReturns: returns.filter((ret: any) => ret.returnStatus === 'completed').length,
        pendingReturns: returns.filter((ret: any) => ret.returnStatus === 'pending').length
      };
    } catch (error) {
      console.error('Error getting purchase return summary:', error);
      throw error;
    }
  }

  async getAllPurchaseReturns(): Promise<any[]> {
    try {
      const returnsRef = collection(this.firestore, this.collectionName);
      const snapshot = await getDocs(returnsRef);
      return snapshot.docs.map(doc => this.normalizeDateData({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error getting all returns:', error);
      return [];
    }
  }

  async getPurchaseReturnsByProductName(productName: string): Promise<any[]> {
    try {
      const returnsRef = collection(this.firestore, this.collectionName);
      const querySnapshot = await getDocs(returnsRef);
      
      return querySnapshot.docs
        .map(doc => this.normalizeDateData({
          id: doc.id,
          ...doc.data()
        }))
        .filter((returnItem: any) => 
          returnItem.products?.some((p: any) => 
            p.productName?.toLowerCase() === productName.toLowerCase() || 
            p.name?.toLowerCase() === productName.toLowerCase()
          )
        );
    } catch (error) {
      console.error('Error getting purchase returns by product name:', error);
      return [];
    }
  }
  
  private getUnitCostBeforeTaxFromProduct(product: any): number {
    if (product.unitPriceBeforeTax !== undefined && product.unitPriceBeforeTax !== null) {
        return Number(product.unitPriceBeforeTax);
    }
    if (product.unitCostBeforeTax !== undefined && product.unitCostBeforeTax !== null) {
        return Number(product.unitCostBeforeTax);
    }
    if (product.unitPrice && product.taxRate) {
        const taxRate = Number(product.taxRate) || 0;
        return Number(product.unitPrice) / (1 + (taxRate / 100));
    }
    if (product.unitCost && product.taxRate) {
        const taxRate = Number(product.taxRate) || 0;
        return Number(product.unitCost) / (1 + (taxRate / 100));
    }
    return Number(product.unitPrice) || Number(product.unitCost) || 0;
  }

 async getTotalPurchaseReturnTaxByDateRange(startDate: Date, endDate: Date): Promise<number> {
    try {
      const returnsCollection = collection(this.firestore, this.collectionName);
      const startTimestamp = Timestamp.fromDate(startDate);
      const endTimestamp = Timestamp.fromDate(endDate);

      const q = query(
        returnsCollection,
        where('returnDate', '>=', startTimestamp),
        where('returnDate', '<=', endTimestamp)
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return 0;
      }

      const totalTax = querySnapshot.docs.reduce((sum, doc) => {
        const returnData = doc.data();
        
        if (typeof returnData['totalTaxReturned'] === 'number') {
          return sum + returnData['totalTaxReturned'];
        }

        if (returnData['products'] && Array.isArray(returnData['products'])) {
          const productsTax = returnData['products'].reduce((productTaxSum: number, product: any) => {
            return productTaxSum + (Number(product.taxAmount) || 0);
          }, 0);
          return sum + productsTax;
        }

        return sum;
      }, 0);

      return totalTax;

    } catch (error) {
      console.error('Error fetching total purchase return tax:', error);
      return 0;
    }
  }
}