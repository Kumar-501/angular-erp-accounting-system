import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, onSnapshot, doc, deleteDoc, getDoc, updateDoc, query, where, getDocs, QuerySnapshot, DocumentData, runTransaction, arrayUnion, Timestamp } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { PurchaseItem } from '../models/purchase-item.model';

export interface Purchase {
  [x: string]: any;
  id?: string;
  supplierId: string;
  supplierName: string;
  purchaseNumber?: string;
  paymentAccount?: {
    id: string;
    name: string;
    accountNumber?: string;
  };
  cgst?: number;
  sgst?: number;
  igst?: number;
  address?: string;
  referenceNo: string;
  purchaseDate: string | Date | any;
  purchaseStatus: string;
  businessLocation: string;
      receivedQuantity?: number; // Add this field

  payTerm?: string;
  document?: string | null;
  discountType?: string;
  discountAmount?: number;
  purchaseTax?: number;
  additionalNotes?: string;
  shippingCharges?: number;
  purchaseTotal: number;
  paymentAmount: number;
  paidOn: string | Date | any;
  paymentMethod: string;
  paymentStatus?: string;
  paymentNote?: string;
  paymentDue?: number;
  grandTotal?: number;
  addedBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
  purchaseOrder?: string;

  // New fields
  invoiceNo?: string;
  invoicedDate?: string | Date;
  receivedDate?: string | Date;
  totalTax?: number;
  // Products with new fields
  products?: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitCost: number;
    discountPercent: number;
    unitCostBeforeTax: number;
    subtotal: number;
    taxAmount: number;
    lineTotal: number;
    profitMargin: number;
    sellingPrice: number;
    batchNumber: string;
    expiryDate: string;
    taxRate: number;
    roundOffAmount: number;
    roundedTotal: number;
  }>;
}

export interface PaymentAccount {
  id: string;
  name: string;
  accountNumber: string;
  // Add any other fields you need
}

@Injectable({
  providedIn: 'root'
})
export class PurchaseService {
  [x: string]: any;
  private purchasesCollection;
  private paymentAccountsCollection;

  constructor(private firestore: Firestore) {
    this.purchasesCollection = collection(this.firestore, 'purchases');
    this.paymentAccountsCollection = collection(this.firestore, 'paymentAccounts');
  }

// In purchase.service.ts
async createPurchase(purchaseData: any): Promise<any> {
  try {
     const taxRate = purchaseData.taxRate || 18; // Default to 18%
    const isInterState = purchaseData.isInterState || false;
    
    let totalTax = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;   if (purchaseData.products && purchaseData.products.length > 0) {
      purchaseData.products.forEach((product: any) => {
        const productSubtotal = product.quantity * product.unitCost;
        const productTax = productSubtotal * (taxRate / 100);
        
        product.taxAmount = productTax;
        totalTax += productTax;
        
        if (isInterState) {
          product.igst = productTax;
          igst += productTax;
        } else {
          product.cgst = productTax / 2;
          product.sgst = productTax / 2;
          cgst += productTax / 2;
          sgst += productTax / 2;
        }
      });
    }
   purchaseData.totalTax = totalTax;
    purchaseData.cgst = cgst;
    purchaseData.sgst = sgst;
    purchaseData.igst = igst;
    // First, ensure we have all required data
    if (!purchaseData.supplierId || !purchaseData.products || purchaseData.products.length === 0) {
      throw new Error('Supplier and at least one product are required');
    }

    // Calculate totals if not provided
    if (!purchaseData.purchaseTotal) {
      purchaseData.purchaseTotal = purchaseData.products.reduce((total: number, product: any) => {
        return total + (product.quantity * product.unitCost);
      }, 0);
    }

    // Set default values
    const purchaseToAdd = {
      ...purchaseData,
      paymentDue: purchaseData.purchaseTotal - (purchaseData.paymentAmount || 0),
      paymentStatus: this.calculatePaymentStatus(purchaseData.paymentAmount, purchaseData.purchaseTotal),
      createdAt: new Date(),
      updatedAt: new Date(),
      status: purchaseData.purchaseStatus || 'received'
    };

    // Add to Firestore
    const docRef = await addDoc(this.purchasesCollection, purchaseToAdd);
    
    return { id: docRef.id, ...purchaseToAdd };
  } catch (error) {
    console.error('Error creating purchase:', error);
    throw error;
  }
}

private calculatePaymentStatus(paymentAmount: number, totalAmount: number): string {
  if (!paymentAmount) return 'due';
  if (paymentAmount >= totalAmount) return 'paid';
  if (paymentAmount > 0) return 'partial';
  return 'due';
}
async getPurchasesByDateRange(startDate: Date, endDate: Date): Promise<Purchase[]> {
  try {
    const q = query(
      this.purchasesCollection,
      where('purchaseDate', '>=', startDate),
      where('purchaseDate', '<=', endDate)
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data() as Purchase
    }));
  } catch (error) {
    console.error('Error fetching purchases by date range:', error);
    throw error;
  }
}
  async getPaymentAccounts(): Promise<PaymentAccount[]> {
    try {
      const snapshot = await getDocs(this.paymentAccountsCollection);
      return snapshot.docs.map(doc => {
        const data = doc.data() as PaymentAccount;
        return {
          ...data,
          id: doc.id
        };
      });
    } catch (error) {
      console.error('Error fetching payment accounts:', error);
      throw error;
    }
  }
  
  async addPurchase(purchase: Purchase): Promise<any> {
    // Calculate payment due and payment status
    const paymentDue = purchase.purchaseTotal - purchase.paymentAmount;
    let paymentStatus = 'Due';
    
    if (purchase.paymentAmount >= purchase.purchaseTotal) {
      paymentStatus = 'Paid';
    } else if (purchase.paymentAmount > 0) {
      paymentStatus = 'Partial';
    }

    // Convert dates to proper format and add timestamps
    const purchaseData = {
      ...purchase,
      purchaseDate: new Date(purchase.purchaseDate),
      paidOn: new Date(purchase.paidOn),
      paymentDue,
      paymentStatus,
      grandTotal: purchase.purchaseTotal,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    try {
      const docRef = await addDoc(this.purchasesCollection, purchaseData);
      return { id: docRef.id, ...purchaseData };
    } catch (error) {
      console.error('Error adding purchase:', error);
      throw error;
    }
  }

  // Get all purchases as Observable for real-time updates
  getPurchases(): Observable<Purchase[]> {
    return new Observable(observer => {
      const unsubscribe = onSnapshot(this.purchasesCollection, (snapshot) => {
        const purchases = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data() as Purchase
        }));
        observer.next(purchases);
      }, (error) => {
        console.error('Error fetching purchases:', error);
        observer.error(error);
      });
      
      // Return unsubscribe function to clean up when Observable is destroyed
      return () => unsubscribe();
    });
  }

getPurchasesBySupplier(supplierId: string): Observable<Purchase[]> {
  return new Observable<Purchase[]>(observer => {
    const q = query(
      collection(this.firestore, 'purchases'),
      where('supplierId', '==', supplierId)
    );

    const unsubscribe = onSnapshot(q, 
      (querySnapshot: QuerySnapshot<DocumentData>) => {
        const purchases: Purchase[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          const purchase: Purchase = {
            id: doc.id,
            supplierId: data['supplierId'],
            supplierName: data['supplierName'],
            referenceNo: data['referenceNo'],
            purchaseDate: data['purchaseDate']?.toDate(),
            purchaseStatus: data['purchaseStatus'],
            businessLocation: data['businessLocation'],
            purchaseTotal: data['purchaseTotal'] || 0,
            paymentAmount: data['paymentAmount'] || 0,
            paymentMethod: data['paymentMethod'],
            paymentStatus: data['paymentStatus'],
            products: data['products'] || [],
            grandTotal: data['grandTotal'] || data['purchaseTotal'] || 0,
            paymentDue: data['paymentDue'] || 0,
            paidOn: undefined
          };
          purchases.push(purchase);
        });
        observer.next(purchases);
      },
      (error) => {
        console.error('Error fetching supplier purchases:', error);
        observer.error(error);
      }
    );

    return () => unsubscribe();
  });
  }
  async getPurchaseById(id: string): Promise<Purchase> {
    try {
      const purchaseRef = doc(this.firestore, 'purchases', id);
      const purchaseSnap = await getDoc(purchaseRef);
      
      if (purchaseSnap.exists()) {
        return { id: purchaseSnap.id, ...purchaseSnap.data() } as Purchase;
      } else {
        throw new Error('Purchase not found');
      }
    } catch (error) {
      console.error('Error fetching purchase:', error);
      throw error;
    }
  }
  

  async getPurchasesByProductId(productId: string): Promise<Purchase[]> {
    try {
      const querySnapshot = await getDocs(this.purchasesCollection);
      const purchases: Purchase[] = [];
      
      querySnapshot.forEach(doc => {
        const purchaseData = doc.data() as Purchase;
        
        // Check the products array (as defined in the Purchase interface)
        const products = purchaseData.products || [];
        
        const hasProduct = products.some(item => 
          item.productId === productId
        );
        
        if (hasProduct) {
          purchases.push({
            id: doc.id,
            ...purchaseData
          });
        }
      });
      
      return purchases;
    } catch (error) {
      console.error('Error fetching purchases by product:', error);
      throw error;
    }
  }
  
 

 async updatePurchase(id: string, updateData: Partial<Purchase>): Promise<void> {
  try {
    if (!id) {
      throw new Error('Purchase ID is required for update');
    }
    
    // Calculate payment due if paymentAmount is being updated
    if (updateData.paymentAmount !== undefined) {
      const purchase = await this.getPurchaseById(id);
      const grandTotal = purchase.grandTotal || purchase.purchaseTotal || 0;
      updateData.paymentDue = Math.max(grandTotal - updateData.paymentAmount, 0);
      
      // Update payment status
      if (updateData.paymentAmount >= grandTotal) {
        updateData.paymentStatus = 'Paid';
      } else if (updateData.paymentAmount > 0) {
        updateData.paymentStatus = 'Partial';
      } else {
        updateData.paymentStatus = 'Due';
      }
    }
    
    // Add updated timestamp
    updateData.updatedAt = new Date();
    
    const purchaseRef = doc(this.firestore, 'purchases', id);
    return updateDoc(purchaseRef, updateData);
  } catch (error) {
    console.error('Error updating purchase:', error);
    throw error;
  }
}
async updatePurchasePayment(purchaseId: string, paymentAmount: number): Promise<void> {
  if (!purchaseId || paymentAmount === undefined || paymentAmount === null) {
    throw new Error('Purchase ID and payment amount are required');
  }

  try {
    const purchaseRef = doc(this.firestore, 'purchases', purchaseId);
    
    return runTransaction(this.firestore, async (transaction) => {
      const purchaseDoc = await transaction.get(purchaseRef);
      
      if (!purchaseDoc.exists()) {
        throw new Error('Purchase not found');
      }

      const purchaseData = purchaseDoc.data() as Purchase;
      const currentPayment = purchaseData.paymentAmount || 0;
      const grandTotal = purchaseData.grandTotal || purchaseData.purchaseTotal || 0;
      
      const newPaymentAmount = currentPayment + paymentAmount;
      const newPaymentDue = Math.max(grandTotal - newPaymentAmount, 0);
      
      let paymentStatus = 'Due';
      if (newPaymentDue <= 0) {
        paymentStatus = 'Paid';
      } else if (newPaymentAmount > 0) {
        paymentStatus = 'Partial';
      }

      transaction.update(purchaseRef, {
        paymentAmount: newPaymentAmount,
        paymentDue: newPaymentDue,
        paymentStatus: paymentStatus,
        updatedAt: Timestamp.now()
      });
    });
  } catch (error) {
    console.error('Error updating purchase payment:', error);
    throw error;
  }
}

 getPurchasesBySupplierName(supplierName: string): Observable<Purchase[]> {
    return new Observable<Purchase[]>(observer => {
      const q = query(
        collection(this.firestore, 'purchases'),
        where('supplierName', '==', supplierName)
      );

      const unsubscribe = onSnapshot(q, 
        (querySnapshot: QuerySnapshot<DocumentData>) => {
          const purchases: Purchase[] = [];
          querySnapshot.forEach((doc) => {
            const data = doc.data();
            const purchase: Purchase = {
              id: doc.id,
              supplierId: data['supplierId'],
              supplierName: data['supplierName'],
              referenceNo: data['referenceNo'],
              purchaseDate: data['purchaseDate']?.toDate(),
              purchaseStatus: data['purchaseStatus'],
              businessLocation: data['businessLocation'],
              purchaseTotal: data['purchaseTotal'] || 0,
              paymentAmount: data['paymentAmount'] || 0,
              paymentMethod: data['paymentMethod'],
              paymentStatus: data['paymentStatus'],
              products: data['products'] || [],
              grandTotal: data['grandTotal'] || data['purchaseTotal'] || 0,
              createdAt: data['createdAt']?.toDate(),
              updatedAt: data['updatedAt']?.toDate(),
              paidOn: data['paidOn']?.toDate()
            };
            purchases.push(purchase);
          });
          observer.next(purchases);
        },
        (error) => {
          console.error('Error fetching purchases by supplier name:', error);
          observer.error(error);
        }
      );

      return () => unsubscribe();
    });
  }
async addPaymentToPurchase(purchaseId: string, paymentData: any): Promise<void> {
  const purchaseRef = doc(this.firestore, 'purchases', purchaseId);
  
  return runTransaction(this.firestore, async (transaction) => {
    const purchaseDoc = await transaction.get(purchaseRef);
    if (!purchaseDoc.exists()) {
      throw new Error('Purchase not found');
    }

    const purchase = purchaseDoc.data() as Purchase;
    const newPaymentAmount = (purchase.paymentAmount || 0) + paymentData.amount;
    const newPaymentDue = (purchase.grandTotal || purchase.purchaseTotal) - newPaymentAmount;

    // Update payment status
    let paymentStatus = 'due';
    if (newPaymentDue <= 0) {
      paymentStatus = 'paid';
    } else if (newPaymentAmount > 0) {
      paymentStatus = 'partial';
    }

    transaction.update(purchaseRef, {
      paymentAmount: newPaymentAmount,
      paymentDue: newPaymentDue,
      paymentStatus: paymentStatus,
      updatedAt: new Date(),
      payments: arrayUnion({
        amount: paymentData.amount,
        date: paymentData.paidDate,
        method: paymentData.paymentMethod,
        reference: paymentData.reference,
        note: paymentData.paymentNote
      })
    });
  });
}



  // Delete a purchase
  async deletePurchase(id: string): Promise<void> {
    try {
      const purchaseRef = doc(this.firestore, 'purchases', id);
      return deleteDoc(purchaseRef);
    } catch (error) {
      console.error('Error deleting purchase:', error);
      throw error;
    }
  }
}