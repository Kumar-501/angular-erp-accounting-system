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
  getDocs
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { COLLECTIONS } from '../../utils/constants';
import { AccountService } from './account.service';
import { PurchaseService } from './purchase.service';

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
  id?: string;
  returnDate: string;
  referenceNo: string;
  parentPurchaseId: string;
  parentPurchaseRef: string;
  businessLocation: string;
  businessLocationId?: string;
  supplier: string;
  returnStatus: string;
  paymentStatus: string;
  products: ReturnProductItem[];
  reason: string;
  grandTotal: number;
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
    private purchaseService: PurchaseService
  ) {}

  // Get purchase return logs
  getPurchaseReturnLogs(): Observable<PurchaseReturnLog[]> {
    const colRef = collection(this.firestore, this.logCollectionName);
    const q = query(colRef, orderBy('createdAt', 'desc'));

    return new Observable<PurchaseReturnLog[]>(observer => {
      const unsubscribe = onSnapshot(
        q,
        (snapshot: QuerySnapshot<DocumentData>) => {
          const data = snapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({
            id: doc.id,
            ...doc.data()
          })) as PurchaseReturnLog[];
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
          const data = snapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({
            id: doc.id,
            ...doc.data()
          })) as PurchaseReturnLog[];
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
          const data = snapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({
            id: doc.id,
            ...doc.data()
          })) as PurchaseReturn[];
          observer.next(data);
        },
        (error: FirestoreError) => observer.error(error)
      );

      return { unsubscribe };
    });
  }

  // Get purchase returns by parent purchase ID in real-time
  getPurchaseReturnsByPurchaseId(purchaseId: string): Observable<PurchaseReturn[]> {
    const colRef = collection(this.firestore, this.collectionName);
    const q = query(
      colRef,
      where('parentPurchaseId', '==', purchaseId),
      orderBy('createdAt', 'desc')
    );

    return new Observable<PurchaseReturn[]>(observer => {
      const unsubscribe = onSnapshot(
        q,
        (snapshot: QuerySnapshot<DocumentData>) => {
          const data = snapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({
            id: doc.id,
            ...doc.data()
          })) as PurchaseReturn[];
          observer.next(data);
        },
        (error: FirestoreError) => observer.error(error)
      );

      return { unsubscribe };
    });
  }

  // Get a single purchase return by ID (real-time)
  getPurchaseReturn(id: string): Observable<PurchaseReturn | undefined> {
    const docRef = doc(this.firestore, `${this.collectionName}/${id}`);

    return new Observable<PurchaseReturn | undefined>(observer => {
      const unsubscribe = onSnapshot(
        docRef,
        (docSnap: DocumentSnapshot<DocumentData>) => {
          if (docSnap.exists()) {
            observer.next({ id: docSnap.id, ...docSnap.data() } as PurchaseReturn);
          } else {
            observer.next(undefined);
          }
        },
        (error: FirestoreError) => observer.error(error)
      );

      return { unsubscribe };
    });
  }

  /**
   * Add a new purchase return with comprehensive logging
   * This method stores data in both purchase-returns and purchase-return-log collections
   */
  async addPurchaseReturn(purchaseReturn: PurchaseReturn): Promise<any> {
    try {
      // Get the original purchase details for proper logging
      const originalPurchase = await this.purchaseService.getPurchaseById(purchaseReturn.parentPurchaseId);
      
      if (!originalPurchase) {
        throw new Error('Original purchase not found');
      }

      // Add the purchase return to the main collection
      const colRef = collection(this.firestore, this.collectionName);
      const returnDocRef = await addDoc(colRef, {
        ...purchaseReturn,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Create log entries for each product in the return
      const logCollection = collection(this.firestore, this.logCollectionName);
      
      const logPromises = purchaseReturn.products.map(async (product) => {
        // Find the original purchased quantity from the parent purchase
        const originalProduct = originalPurchase.products?.find(
          p => p.productId === (product.productId || product.id)
        );
        
        const purchasedQuantity = originalProduct?.quantity || 0;
        const returnQuantity = product.returnQuantity || product.quantity || 0;
        const subTotal = returnQuantity * (product.price || product.unitCost || originalProduct?.unitCost || 0);

        const logData: PurchaseReturnLog = {
          purchaseRefNo: purchaseReturn.parentPurchaseRef,
          returnDate: purchaseReturn.returnDate,
          purchasedQuantity: purchasedQuantity,
          returnQuantity: returnQuantity,
          subTotal: subTotal,
          productId: product.productId || product.id!,
          productName: product.productName || product.name!,
          businessLocation: purchaseReturn.businessLocation,
          businessLocationId: purchaseReturn.businessLocationId || '',
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        return addDoc(logCollection, logData);
      });

      // Wait for all log entries to be created
      await Promise.all(logPromises);

      console.log('Purchase return and logs created successfully');
      return returnDocRef;
      
    } catch (error) {
      console.error('Error adding purchase return:', error);
      throw error;
    }
  }

  /**
   * Add a log entry to purchase-return-log collection
   */
  async addPurchaseReturnLog(logData: PurchaseReturnLog): Promise<any> {
    try {
      const logCollection = collection(this.firestore, this.logCollectionName);
      return await addDoc(logCollection, {
        ...logData,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error adding purchase return log:', error);
      throw error;
    }
  }

  // Update a purchase return
  updatePurchaseReturn(id: string, data: Partial<PurchaseReturn>): Promise<void> {
    const docRef = doc(this.firestore, `${this.collectionName}/${id}`);
    return updateDoc(docRef, {
      ...data,
      updatedAt: new Date()
    } as any);
  }

  // Delete a purchase return
  deletePurchaseReturn(id: string): Promise<void> {
    const docRef = doc(this.firestore, `${this.collectionName}/${id}`);
    return deleteDoc(docRef);
  }

  // Generate unique reference number
  generateReferenceNumber(): string {
    return `PRN-${Date.now()}`;
  }

  // Get return status class for styling
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

  /**
   * Process purchase return and update stock with comprehensive logging
   */
  async processPurchaseReturnWithStock(returnData: PurchaseReturn): Promise<string> {
    try {
      // Validate return data
      if (!returnData.businessLocationId && returnData.businessLocation) {
        // Extract location ID if businessLocation is an object
        const location = typeof returnData.businessLocation === 'object' 
          ? (returnData.businessLocation as any).id 
          : returnData.businessLocation;
        returnData.businessLocationId = location;
      }

      if (!returnData.businessLocationId) {
        throw new Error('Business location ID is required');
      }

      // Get the original purchase details for proper logging
      const originalPurchase = await this.purchaseService.getPurchaseById(returnData.parentPurchaseId);
      
      if (!originalPurchase) {
        throw new Error('Original purchase not found');
      }

      // Add return document to main collection
      const returnDocRef = await addDoc(collection(this.firestore, this.collectionName), {
        ...returnData,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Process stock returns and create logs for each product
      const logCollection = collection(this.firestore, this.logCollectionName);
      
      for (const product of returnData.products) {
        // Find the original purchased quantity from the parent purchase
        const originalProduct = originalPurchase.products?.find(
          p => p.productId === (product.productId || product.id)
        );
        
        const purchasedQuantity = originalProduct?.quantity || 0;
        const returnQuantity = product.returnQuantity || product.quantity || 0;
        const subTotal = returnQuantity * (product.price || product.unitCost || originalProduct?.unitCost || 0);

        // Update stock
        await this.returnProductStock(
          product.productId || product.id!,
          returnData.businessLocationId,
          returnQuantity,
          returnData.referenceNo,
          `Purchase return: ${returnData.reason}`,
          returnData.createdBy
        );

        // Create log entry
        const logData: PurchaseReturnLog = {
          purchaseRefNo: returnData.parentPurchaseRef,
          returnDate: returnData.returnDate,
          purchasedQuantity: purchasedQuantity,
          returnQuantity: returnQuantity,
          subTotal: subTotal,
          productId: product.productId || product.id!,
          productName: product.productName || product.name!,
          businessLocation: returnData.businessLocation,
          businessLocationId: returnData.businessLocationId,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        await addDoc(logCollection, logData);
      }

      // Create transaction record for the purchase return
      await this.createReturnTransaction(returnData, returnDocRef.id);

      return returnDocRef.id;
    } catch (error) {
      console.error('Error processing purchase return:', error);
      throw error;
    }
  }

  /**
   * Return stock to specific location
   */
  private async returnProductStock(
    productId: string,
    locationId: string,
    quantity: number,
    referenceNo: string,
    notes: string,
    userId: string
  ): Promise<void> {
    try {
      // Get current stock
      const stockDocId = `${productId}_${locationId}`;
      const stockDocRef = doc(this.firestore, COLLECTIONS.PRODUCT_STOCK, stockDocId);
      const stockDoc = await getDoc(stockDocRef);
      
      let currentStock = 0;
      if (stockDoc.exists()) {
        currentStock = stockDoc.data()['quantity'] || 0;
      }
      
      const newStock = currentStock + quantity;
      
      // Update product-stock
      await setDoc(stockDocRef, {
        productId,
        locationId,
        quantity: newStock,
        lastUpdated: new Date(),
        updatedBy: userId
      }, { merge: true });
      
      // Create stock history entry
      await this.createReturnStockHistory({
        productId,
        locationId,
        action: 'return',
        quantity,
        oldStock: currentStock,
        newStock,
        referenceNo,
        notes,
        userId
      });
      
    } catch (error) {
      console.error('Error returning product stock:', error);
      throw error;
    }
  }

  /**
   * Create stock history entry for returns
   */
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

  /**
   * Get stock available for return at a location
   */
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

  /**
   * Validate return quantities against available stock
   */
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
   * Create transaction record for purchase return
   */
  private async createReturnTransaction(returnData: PurchaseReturn, returnId: string): Promise<void> {
    try {
      // Get the original purchase to find the payment account
      const originalPurchase = await this.purchaseService.getPurchaseById(returnData.parentPurchaseId);
      
      if (!originalPurchase) {
        console.warn('Original purchase not found for return:', returnData.parentPurchaseId);
        return;
      }

      // For purchase returns, we typically:
      // - Credit the same account that was debited during the original purchase
      // - This increases cash (if cash purchase) or reduces accounts payable (if credit purchase)
      
      const transactionData = {
        amount: returnData.grandTotal,
        type: 'purchase_return',
        date: new Date(returnData.returnDate),
        description: `Purchase Return: ${returnData.referenceNo} - ${returnData.reason}`,
        paymentMethod: originalPurchase.paymentMethod || 'Purchase Return',
        paymentDetails: returnData.referenceNo,
        note: `Returned to supplier: ${returnData.supplier}. Reason: ${returnData.reason}`,
        addedBy: returnData.createdBy || 'System',
        reference: returnData.referenceNo,
        relatedDocId: returnId,
        source: 'purchase_return',
        supplier: returnData.supplier,
        returnStatus: returnData.returnStatus,
        paymentStatus: returnData.paymentStatus,
        originalPurchaseId: returnData.parentPurchaseId
      };

      // Use the payment account from the original purchase
      const paymentAccountId = typeof originalPurchase.paymentAccount === 'object' 
        ? originalPurchase.paymentAccount.id 
        : originalPurchase.paymentAccount;
      
      if (paymentAccountId) {
        await this.accountService.addTransaction(paymentAccountId, transactionData);
      } else {
        console.warn('No payment account found in original purchase:', returnData.parentPurchaseId);
      }
      
    } catch (error) {
      console.error('Error creating return transaction:', error);
      // Don't throw here to avoid breaking the return process
    }
  }

  /**
   * Get purchase return summary by date range
   */
  async getPurchaseReturnSummary(startDate: Date, endDate: Date): Promise<any> {
    try {
      const q = query(
        collection(this.firestore, this.collectionName),
        where('returnDate', '>=', startDate.toISOString().split('T')[0]),
        where('returnDate', '<=', endDate.toISOString().split('T')[0])
      );
      
      const snapshot = await getDocs(q);
      const returns = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
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
}