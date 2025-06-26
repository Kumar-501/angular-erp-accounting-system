import { inject, Injectable } from '@angular/core';
import { 
  Firestore, 
  collection, 
  addDoc, 
  doc, 
  updateDoc, 
  getDoc, 
  query, 
  where, 
  collectionData,
  docData,
  orderBy,
  Timestamp,
  DocumentReference,
  QueryConstraint,
  onSnapshot,
  getDocs
} from '@angular/fire/firestore';
import { Observable, from, throwError, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { SupplierService } from './supplier.service';

export interface PaymentData {
  id?: string;
  purchaseId?: string; // Made optional for supplier payments
  supplierId: string;
  amount: number;
  paymentDate: Date | Timestamp;
  paymentMethod?: string;
  notes?: string;
  status?: string;
  createdAt?: Date | Timestamp;
  updatedAt?: Date | Timestamp;
  referenceNo?: string;
  location?: string;
  // Add fields for supplier payments
  supplierName?: string;
  document?: string | null;
  appliedToPurchases?: { purchaseId: string; amount: number; }[];
  type?: string; // 'supplier' or 'purchase'
  paymentAccount?: string;
}

export interface PaymentFilters {
  status?: string;
  startDate?: Date;
  endDate?: Date;
  supplierId?: string;
  purchaseId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private readonly paymentsCollection = 'payments';
  private readonly purchasesCollection = 'purchases';
  uploadPaymentDocument: any;
  supplierService: any;
  purchaseService: any;

  constructor(private firestore: Firestore) {}

  /**
   * Add a new payment record
   * @param paymentData Payment data to be added
   * @returns Promise with the new payment ID
   */
async addPayment(paymentData: any): Promise<string> {
  const paymentRef = await addDoc(collection(this.firestore, 'payments'), {
    ...paymentData,
    isImmutable: true, // Mark as immutable
    createdAt: new Date()
  });
  
  // Only update purchase status, don't delete anything
  if (paymentData.purchaseId) {
    await this.updatePurchaseStatus(paymentData.purchaseId, paymentData.amount);
  }
  
  return paymentRef.id;
}

private async updatePurchaseStatus(purchaseId: string, paymentAmount: number): Promise<void> {
  const purchaseRef = doc(this.firestore, 'purchases', purchaseId);
  const purchaseDoc = await getDoc(purchaseRef);
  
  if (purchaseDoc.exists()) {
    const purchaseData = purchaseDoc.data();
    const newPaymentAmount = (purchaseData['paymentAmount'] || 0) + paymentAmount;
    const newPaymentDue = (purchaseData['grandTotal'] || 0) - newPaymentAmount;
    const newStatus = newPaymentDue <= 0 ? 'Paid' : 'Partial';
    
    await updateDoc(purchaseRef, {
      paymentAmount: newPaymentAmount,
      paymentDue: newPaymentDue,
      paymentStatus: newStatus,
      updatedAt: new Date()
    });
  }
}


  /**
   * Add a new supplier payment
   * @param paymentData Supplier payment data
   * @returns Promise with the new payment ID
   */
// In payment.service.ts


  /**
   * Get payments by purchase ID
   * @param purchaseId Purchase ID to filter by
   * @returns Observable of payments array
   */
  // payment.service.ts

// Fix for the processSupplierPayment method
// Remove the accountingEntries property from the addSupplierPayment call
// In payment.service.ts

async addSupplierPayment(paymentData: any): Promise<string> {
  try {
    const paymentsRef = collection(this.firestore, 'payments');
    const docRef = await addDoc(paymentsRef, {
      ...paymentData,
      paymentDate: Timestamp.fromDate(new Date(paymentData.paymentDate)),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      status: 'completed'
    });
    return docRef.id;
  } catch (error) {
    console.error('Error adding supplier payment:', error);
    throw error;
  }
}

async processSupplierPayment(paymentData: any): Promise<string> {
  try {
    const paymentsRef = collection(this.firestore, 'payments');
    const docRef = await addDoc(paymentsRef, {
      ...paymentData,
      paymentDate: Timestamp.fromDate(new Date(paymentData.paymentDate)),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      status: 'completed'
    });
    
    return docRef.id;
  } catch (error) {
    console.error('Error adding supplier payment:', error);
    throw error;
  }
}

  getPaymentsByPurchase(purchaseId: string): Observable<PaymentData[]> {
    if (!purchaseId) {
      return throwError(() => new Error('Purchase ID is required'));
    }

    const paymentsRef = collection(this.firestore, this.paymentsCollection);
    const q = query(
      paymentsRef, 
      where('purchaseId', '==', purchaseId),
      orderBy('createdAt', 'desc')
    );

    return (collectionData(q, { idField: 'id' }) as Observable<PaymentData[]>).pipe(
      map(payments => payments.map(payment => this.processPaymentData(payment))),
      catchError(error => {
        console.error('Error getting payments by purchase:', error);
        // Try without orderBy if index error occurs
        if (error.code === 'failed-precondition') {
          const simpleQuery = query(paymentsRef, where('purchaseId', '==', purchaseId));
          return (collectionData(simpleQuery, { idField: 'id' }) as Observable<PaymentData[]>).pipe(
            map(payments => payments.map(payment => this.processPaymentData(payment))),
            map(payments => payments.sort((a, b) => {
              const dateA = this.getDateFromTimestamp(a.createdAt);
              const dateB = this.getDateFromTimestamp(b.createdAt);
              return dateB.getTime() - dateA.getTime();
            }))
          );
        }
        return throwError(() => new Error('Failed to get payments. Please check the purchase ID.'));
      })
    );
  }

  /**
   * Get a single payment by ID
   * @param paymentId Payment ID to retrieveS
   * @returns Observable of payment data
   */
  getPaymentById(paymentId: string): Observable<PaymentData> {
    if (!paymentId) {
      return throwError(() => new Error('Payment ID is required'));
    }

    const paymentRef = doc(this.firestore, this.paymentsCollection, paymentId);
    return (docData(paymentRef, { idField: 'id' }) as Observable<PaymentData>).pipe(
      map(payment => this.processPaymentData(payment)),
      catchError(error => {
        console.error('Error getting payment by ID:', error);
        return throwError(() => new Error('Payment not found'));
      })
    );
  }

  /**
   * Update purchase payment status and amounts
   * @param purchaseId Purchase ID to update
   * @param paymentAmount Payment amount to add
   * @returns Promise that resolves when update is complete
   */
  async updatePurchasePayment(purchaseId: string, paymentAmount: number): Promise<void> {
    if (!purchaseId || paymentAmount === undefined || paymentAmount === null) {
      throw new Error('Purchase ID and payment amount are required');
    }

    try {
      const purchaseRef = doc(this.firestore, this.purchasesCollection, purchaseId) as DocumentReference<any>;
      const purchaseDoc = await getDoc(purchaseRef);
      
      if (!purchaseDoc.exists()) {
        throw new Error('Purchase not found');
      }

      const purchaseData = purchaseDoc.data();
      const currentPayment = purchaseData['paymentAmount'] || 0;
      const grandTotal = purchaseData['grandTotal'] || purchaseData['purchaseTotal'] || 0;
      
      const newPaymentAmount = currentPayment + paymentAmount;
      const newPaymentDue = grandTotal - newPaymentAmount;
      const paymentStatus = newPaymentDue <= 0 ? 'Paid' : (newPaymentAmount > 0 ? 'Partial' : 'Due');

      await updateDoc(purchaseRef, {
        paymentAmount: newPaymentAmount,
        paymentDue: Math.max(newPaymentDue, 0),
        paymentStatus: paymentStatus,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error updating purchase payment:', error);
      throw new Error(`Failed to update purchase payment: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get payments by supplier ID
   * @param supplierId Supplier ID to filter by
   * @returns Observable of payments array
   */
 getPaymentsBySupplier(supplierId: string): Observable<any[]> {
  return new Observable(observer => {
    const q = query(
      collection(this.firestore, 'supplierPayments'),
      where('supplierId', '==', supplierId),
      orderBy('paymentDate', 'desc')
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const payments = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        paymentDate: doc.data()['paymentDate']?.toDate()
      }));
      observer.next(payments);
    });

    return () => unsubscribe();
  });
}


  /**
   * Get supplier payments (specific type filter)
   * @param supplierId Supplier ID to filter by
   * @returns Observable of supplier payments array
   */
  getSupplierPayments(supplierId: string): Observable<PaymentData[]> {
    console.log('getSupplierPayments called with supplierId:', supplierId);
    if (!supplierId) {
      return throwError(() => new Error('Supplier ID is required'));
    }

    try {
      const paymentsRef = collection(this.firestore, this.paymentsCollection);
      const q = query(
        paymentsRef,
        where('supplierId', '==', supplierId),
        // where('type', '==', 'supplier'), // Temporarily remove type filter for debugging
        orderBy('paymentDate', 'desc')
      );

      return (collectionData(q, { idField: 'id' }) as Observable<PaymentData[]>).pipe(
        map(payments => {
          console.log('Payments fetched from Firestore:', payments);
          return payments.map(payment => this.processPaymentData(payment));
        }),
        catchError(error => {
          console.error('Error getting supplier payments:', error);
          // Try without orderBy if index error occurs
          if (error.code === 'failed-precondition') {
            const simpleQuery = query(
              paymentsRef,
              where('supplierId', '==', supplierId)
              // where('type', '==', 'supplier')
            );
            return (collectionData(simpleQuery, { idField: 'id' }) as Observable<PaymentData[]>).pipe(
              map(payments => payments.map(payment => this.processPaymentData(payment)))
            );
          }
          return throwError(() => error);
        })
      );
    } catch (error) {
      console.error('Error in getSupplierPayments setup:', error);
      return throwError(() => error);
    }
  }

  /**
   * Get real-time updates of supplier payments
   * @param supplierId Supplier ID to filter by
   * @param callback Callback function to receive updates
   * @returns Unsubscribe function
   */
getSupplierPaymentsRealtime(supplierId: string, callback: (payments: PaymentData[]) => void): () => void {
    if (!supplierId) {
      throw new Error('Supplier ID is required');
    }
    
    const paymentsRef = collection(this.firestore, this.paymentsCollection);
    const q = query(
      paymentsRef,
      where('supplierId', '==', supplierId),
      where('type', '==', 'supplier'),
      orderBy('paymentDate', 'desc')
    );
    
    let activeUnsubscribe: (() => void) | null = null;
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const payments: PaymentData[] = [];
      querySnapshot.forEach((doc) => {
        payments.push(this.processPaymentData({
          id: doc.id,
          ...doc.data()
        }));
      });
      callback(payments);
    }, (error) => {
      console.error('Error getting real-time payments:', error);
      
      if (error.code === 'failed-precondition') {
        // Fallback to simple query if orderBy fails due to missing index
        const simpleQuery = query(
          paymentsRef,
          where('supplierId', '==', supplierId),
          where('type', '==', 'supplier')
        );
        
        activeUnsubscribe = onSnapshot(simpleQuery, (querySnapshot) => {
          const payments: PaymentData[] = [];
          querySnapshot.forEach((doc) => {
            payments.push(this.processPaymentData({
              id: doc.id,
              ...doc.data()
            }));
          });
          // Sort manually since orderBy failed
          payments.sort((a, b) => {
            const dateA = this.getDateFromTimestamp(a.paymentDate);
            const dateB = this.getDateFromTimestamp(b.paymentDate);
            return dateB.getTime() - dateA.getTime();
          });
          callback(payments);
        });
      } else {
        // For other errors, return empty array
        callback([]);
      }
    });
    
    // Return cleanup function that handles both scenarios
    return () => {
      if (activeUnsubscribe) {
        activeUnsubscribe();
      } else {
        unsubscribe();
      }
    };
  }

  /**
   * Get all payments with optional filters
   * @param filters Optional query filters
   * @returns Observable of payments array
   */
  getAllPayments(filters?: PaymentFilters): Observable<PaymentData[]> {
    try {
      const paymentsRef = collection(this.firestore, this.paymentsCollection);
      const queryConstraints: QueryConstraint[] = [];

      if (filters?.status) {
        queryConstraints.push(where('status', '==', filters.status));
      }
      if (filters?.supplierId) {
        queryConstraints.push(where('supplierId', '==', filters.supplierId));
      }
      if (filters?.purchaseId) {
        queryConstraints.push(where('purchaseId', '==', filters.purchaseId));
      }
      if (filters?.startDate) {
        queryConstraints.push(where('paymentDate', '>=', this.convertToTimestamp(filters.startDate)));
      }
      if (filters?.endDate) {
        queryConstraints.push(where('paymentDate', '<=', this.convertToTimestamp(filters.endDate)));
      }

      const q = query(paymentsRef, ...queryConstraints);

      return (collectionData(q, { idField: 'id' }) as Observable<any[]>).pipe(
        map(payments => {
          const processedPayments = payments.map(payment => this.processPaymentData(payment));
          return processedPayments.sort((a, b) => {
            const dateA = this.getDateFromTimestamp(a.createdAt);
            const dateB = this.getDateFromTimestamp(b.createdAt);
            return dateB.getTime() - dateA.getTime();
          });
        }),
        catchError(error => {
          console.error('Error getting all payments:', error);
          return of([]);
        })
      );
    } catch (error) {
      console.error('Error in getAllPayments setup:', error);
      return of([]);
    }
  }

  /**
   * Update a payment record
   * @param paymentId Payment ID to update
   * @param updateData Data to update
   * @returns Promise that resolves when update is complete
   */
  async updatePayment(paymentId: string, updateData: Partial<PaymentData>): Promise<void> {
    if (!paymentId) {
      throw new Error('Payment ID is required');
    }

    try {
      const paymentRef = doc(this.firestore, this.paymentsCollection, paymentId);
      
      const processedData: Partial<PaymentData> = {
        ...updateData,
        updatedAt: Timestamp.now()
      };

      if (updateData.paymentDate) {
        processedData.paymentDate = this.convertToTimestamp(updateData.paymentDate);
      }

      await updateDoc(paymentRef, processedData);
    } catch (error) {
      console.error('Error updating payment:', error);
      throw new Error(`Failed to update payment: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Process a payment and update both payment and purchase records
   * @param paymentData Payment data
   * @returns Observable of the complete process
   */
async processPayment(paymentData: PaymentData): Promise<void> {
  try {
    // Add the payment record
    const paymentRef = await addDoc(collection(this.firestore, 'payments'), paymentData);
    
    // Update the purchase status if this is a purchase payment
    if (paymentData.purchaseId) {
      const purchaseRef = doc(this.firestore, 'purchases', paymentData.purchaseId);
      const purchaseDoc = await getDoc(purchaseRef);
      
      if (purchaseDoc.exists()) {
        const purchaseData = purchaseDoc.data();
        const newPaymentAmount = (purchaseData['paymentAmount'] || 0) + paymentData.amount;
        const newPaymentDue = (purchaseData['grandTotal'] || 0) - newPaymentAmount;
        const newStatus = newPaymentDue <= 0 ? 'Paid' : 'Partial';
        
        await updateDoc(purchaseRef, {
          paymentAmount: newPaymentAmount,
          paymentDue: newPaymentDue,
          paymentStatus: newStatus,
          updatedAt: new Date()
        });
      }
    }
  } catch (error) {
    console.error('Error processing payment:', error);
    throw error;
  }
}


  /**
   * Get total payments for a purchase
   * @param purchaseId Purchase ID
   * @returns Observable of total amount
   */
  getTotalPaymentsForPurchase(purchaseId: string): Observable<number> {
    return this.getPaymentsByPurchase(purchaseId).pipe(
      map(payments => payments.reduce((sum, payment) => sum + (payment.amount || 0), 0)),
      catchError(error => {
        console.error('Error calculating total payments:', error);
        return of(0); // Return 0 if there's an error
      })
    );
  }
// Add these methods to your existing PaymentService class

/**
 * Get all supplier payments with real-time updates using direct onSnapshot
 * @param callback Callback function to receive real-time updates
 * @returns Unsubscribe function
 */
getAllSupplierPaymentsRealtime(callback: (payments: PaymentData[]) => void): () => void {
  const paymentsRef = collection(this.firestore, this.paymentsCollection);
  const q = query(
    paymentsRef,
    where('type', '==', 'supplier'),
    orderBy('paymentDate', 'desc')
  );

  let activeUnsubscribe: (() => void) | null = null;

  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    try {
      const payments: PaymentData[] = [];
      querySnapshot.forEach((doc) => {
        const paymentData = this.processPaymentData({
          id: doc.id,
          ...doc.data()
        });
        payments.push(paymentData);
      });
      
      console.log(`Real-time update: ${payments.length} supplier payments fetched`);
      callback(payments);
    } catch (error) {
      console.error('Error processing real-time payment data:', error);
      callback([]);
    }
  }, (error) => {
    console.error('Error in real-time supplier payments listener:', error);
    
    // Handle missing index error by falling back to simple query
    if (error.code === 'failed-precondition') {
      console.log('Falling back to simple query due to missing index');
      const simpleQuery = query(
        paymentsRef,
        where('type', '==', 'supplier')
      );
      
      activeUnsubscribe = onSnapshot(simpleQuery, (querySnapshot) => {
        try {
          const payments: PaymentData[] = [];
          querySnapshot.forEach((doc) => {
            const paymentData = this.processPaymentData({
              id: doc.id,
              ...doc.data()
            });
            payments.push(paymentData);
          });
          
          // Sort manually since orderBy failed
          payments.sort((a, b) => {
            const dateA = this.getDateFromTimestamp(a.paymentDate);
            const dateB = this.getDateFromTimestamp(b.paymentDate);
            return dateB.getTime() - dateA.getTime();
          });
          
          console.log(`Fallback real-time update: ${payments.length} supplier payments fetched`);
          callback(payments);
        } catch (error) {
          console.error('Error in fallback real-time processing:', error);
          callback([]);
        }
      }, (fallbackError) => {
        console.error('Error in fallback real-time listener:', fallbackError);
        callback([]);
      });
    } else {
      // For other errors, return empty array
      console.error('Unhandled real-time error:', error);
      callback([]);
    }
  });

  // Return cleanup function that handles both scenarios
  return () => {
    try {
      if (activeUnsubscribe) {
        activeUnsubscribe();
      } else {
        unsubscribe();
      }
    } catch (error) {
      console.error('Error during unsubscribe:', error);
    }
  };
}

/**
 * Get payments by supplier with real-time updates
 * @param supplierId Supplier ID to filter by
 * @param callback Callback function to receive updates
 * @returns Unsubscribe function
 */
getPaymentsBySupplierRealtime(supplierId: string, callback: (payments: PaymentData[]) => void): () => void {
  if (!supplierId) {
    console.error('Supplier ID is required for real-time payments');
    callback([]);
    return () => {};
  }

  const paymentsRef = collection(this.firestore, this.paymentsCollection);
  const q = query(
    paymentsRef,
    where('supplierId', '==', supplierId),
    orderBy('paymentDate', 'desc')
  );

  let activeUnsubscribe: (() => void) | null = null;

  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    try {
      const payments: PaymentData[] = [];
      querySnapshot.forEach((doc) => {
        const paymentData = this.processPaymentData({
          id: doc.id,
          ...doc.data()
        });
        payments.push(paymentData);
      });
      
      console.log(`Real-time update for supplier ${supplierId}: ${payments.length} payments`);
      callback(payments);
    } catch (error) {
      console.error('Error processing supplier payments:', error);
      callback([]);
    }
  }, (error) => {
    console.error('Error in supplier payments listener:', error);
    
    if (error.code === 'failed-precondition') {
      const simpleQuery = query(
        paymentsRef,
        where('supplierId', '==', supplierId)
      );
      
      activeUnsubscribe = onSnapshot(simpleQuery, (querySnapshot) => {
        try {
          const payments: PaymentData[] = [];
          querySnapshot.forEach((doc) => {
            const paymentData = this.processPaymentData({
              id: doc.id,
              ...doc.data()
            });
            payments.push(paymentData);
          });
          
          payments.sort((a, b) => {
            const dateA = this.getDateFromTimestamp(a.paymentDate);
            const dateB = this.getDateFromTimestamp(b.paymentDate);
            return dateB.getTime() - dateA.getTime();
          });
          
          callback(payments);
        } catch (error) {
          console.error('Error in fallback supplier payments:', error);
          callback([]);
        }
      });
    } else {
      callback([]);
    }
  });

  return () => {
    try {
      if (activeUnsubscribe) {
        activeUnsubscribe();
      } else {
        unsubscribe();
      }
    } catch (error) {
      console.error('Error during supplier payments unsubscribe:', error);
    }
  };
}

/**
 * Enhanced getAllSupplierPayments method with better real-time handling
 * This replaces your existing Observable-based method
 */
getAllSupplierPayments(): Observable<PaymentData[]> {
  return new Observable<PaymentData[]>(observer => {
    let unsubscribe: (() => void) | null = null;
    
    try {
      unsubscribe = this.getAllSupplierPaymentsRealtime((payments) => {
        observer.next(payments);
      });
    } catch (error) {
      console.error('Error setting up real-time supplier payments observable:', error);
      observer.error(error);
    }

    // Return cleanup function
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  });
}

/**
 * Get real-time payment statistics
 * @param callback Callback to receive statistics updates
 * @returns Unsubscribe function
 */
getPaymentStatisticsRealtime(callback: (stats: {
  totalPayments: number;
  totalAmount: number;
  averagePayment: number;
  paymentCount: number;
}) => void): () => void {
  return this.getAllSupplierPaymentsRealtime((payments) => {
    const validPayments = payments.filter(p => p.status !== 'deleted');
    const totalAmount = validPayments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
    const paymentCount = validPayments.length;
    
    const stats = {
      totalPayments: totalAmount,
      totalAmount,
      averagePayment: paymentCount > 0 ? totalAmount / paymentCount : 0,
      paymentCount
    };
    
    callback(stats);
  });
}

/**
 * Monitor payments for a specific purchase in real-time
 * @param purchaseId Purchase ID to monitor
 * @param callback Callback to receive payment updates
 * @returns Unsubscribe function
 */
monitorPurchasePayments(purchaseId: string, callback: (payments: PaymentData[], totalPaid: number) => void): () => void {
  if (!purchaseId) {
    callback([], 0);
    return () => {};
  }

  const paymentsRef = collection(this.firestore, this.paymentsCollection);
  const q = query(
    paymentsRef,
    where('purchaseId', '==', purchaseId),
    orderBy('createdAt', 'desc')
  );

  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    try {
      const payments: PaymentData[] = [];
      let totalPaid = 0;
      
      querySnapshot.forEach((doc) => {
        const paymentData = this.processPaymentData({
          id: doc.id,
          ...doc.data()
        });
        payments.push(paymentData);
        if (paymentData.status !== 'deleted') {
          totalPaid += paymentData.amount || 0;
        }
      });
      
      callback(payments, totalPaid);
    } catch (error) {
      console.error('Error monitoring purchase payments:', error);
      callback([], 0);
    }
  }, (error) => {
    console.error('Error in purchase payments monitor:', error);
    
    // Fallback without orderBy
    if (error.code === 'failed-precondition') {
      const simpleQuery = query(paymentsRef, where('purchaseId', '==', purchaseId));
      const fallbackUnsubscribe = onSnapshot(simpleQuery, (querySnapshot) => {
        try {
          const payments: PaymentData[] = [];
          let totalPaid = 0;
          
          querySnapshot.forEach((doc) => {
            const paymentData = this.processPaymentData({
              id: doc.id,
              ...doc.data()
            });
            payments.push(paymentData);
            if (paymentData.status !== 'deleted') {
              totalPaid += paymentData.amount || 0;
            }
          });
          
          // Sort manually
          payments.sort((a, b) => {
            const dateA = this.getDateFromTimestamp(a.createdAt);
            const dateB = this.getDateFromTimestamp(b.createdAt);
            return dateB.getTime() - dateA.getTime();
          });
          
          callback(payments, totalPaid);
        } catch (error) {
          console.error('Error in fallback purchase payments monitor:', error);
          callback([], 0);
        }
      });
      
      // Return the fallback unsubscribe function
      return fallbackUnsubscribe;
    } else {
      callback([], 0);
      return () => {}; // Return empty unsubscribe function for other errors
    }
  });

  return unsubscribe;
}
  /**
   * Delete a payment (soft delete by updating status)
   * @param paymentId Payment ID to delete
   * @returns Promise that resolves when deletion is complete
   */
  async deletePayment(paymentId: string): Promise<void> {
    if (!paymentId) {
      throw new Error('Payment ID is required');
    }

    try {
      await this.updatePayment(paymentId, {
        status: 'deleted'
      });
    } catch (error) {
      console.error('Error deleting payment:', error);
      throw new Error(`Failed to delete payment: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get payment statistics
   * @param filters Optional filters for statistics
   * @returns Observable of payment statistics
   */
  // payment.service.ts


  getPaymentStatistics(filters?: PaymentFilters): Observable<{
    totalPayments: number;
    totalAmount: number;
    averagePayment: number;
    paymentCount: number;
  }> {
    return this.getAllPayments(filters).pipe(
      map(payments => {
        const validPayments = payments.filter(p => p.status !== 'deleted');
        const totalAmount = validPayments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
        const paymentCount = validPayments.length;
        
        return {
          totalPayments: totalAmount,
          totalAmount,
          averagePayment: paymentCount > 0 ? totalAmount / paymentCount : 0,
          paymentCount
        };
      }),
      catchError(error => {
        console.error('Error getting payment statistics:', error);
        return of({
          totalPayments: 0,
          totalAmount: 0,
          averagePayment: 0,
          paymentCount: 0
        });
      })
    );
  }

  // Helper methods
  private convertToTimestamp(date: Date | Timestamp): Timestamp {
    if (!date) {
      return Timestamp.now();
    }
    if (date instanceof Timestamp) {
      return date;
    }
    if (date instanceof Date) {
      return Timestamp.fromDate(date);
    }
    // Handle string dates or other formats
    if (typeof date === 'string' || typeof date === 'number') {
      return Timestamp.fromDate(new Date(date));
    }
    return Timestamp.now();
  }

 private getDateFromTimestamp(timestamp: Date | Timestamp | any): Date {
  try {
    if (!timestamp) {
      return new Date();
    }
    
    // If it's already a Date object
    if (timestamp instanceof Date) {
      return timestamp;
    }
    
    // If it's a Firestore Timestamp
    if (timestamp instanceof Timestamp) {
      return timestamp.toDate();
    }
    
    // If it has toDate method (Firestore Timestamp-like object)
    if (timestamp && typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }
    
    // If it has seconds and nanoseconds (Firestore Timestamp structure)
    if (timestamp && typeof timestamp.seconds === 'number') {
      return new Timestamp(timestamp.seconds, timestamp.nanoseconds || 0).toDate();
    }
    
    // Handle cases where timestamp might be { _seconds, _nanoseconds }
    if (timestamp && typeof timestamp._seconds === 'number') {
      return new Timestamp(timestamp._seconds, timestamp._nanoseconds || 0).toDate();
    }
    
    // If it's a string or number, try to parse it
    if (typeof timestamp === 'string' || typeof timestamp === 'number') {
      const date = new Date(timestamp);
      return isNaN(date.getTime()) ? new Date() : date;
    }
    
    // Default fallback
    return new Date();
  } catch (error) {
    console.error('Error converting timestamp to date:', error, timestamp);
    return new Date();
  }
}

  /**
   * Process payment data to ensure proper date conversion
   * @param payment Raw payment data from Firestore
   * @returns Processed payment data
   */
private processPaymentData(payment: any): PaymentData {
  try {
    if (!payment) {
      throw new Error('Payment data is null or undefined');
    }

    // Handle the case where paymentDate might be a string or number
    let paymentDate = payment.paymentDate;
    if (paymentDate && typeof paymentDate === 'object' && !(paymentDate instanceof Timestamp) && !(paymentDate instanceof Date)) {
      // If it's an object but not a Timestamp or Date, try to convert it
      if (paymentDate.seconds && paymentDate.nanoseconds) {
        paymentDate = new Timestamp(paymentDate.seconds, paymentDate.nanoseconds);
      } else if (paymentDate._seconds && paymentDate._nanoseconds) {
        paymentDate = new Timestamp(paymentDate._seconds, paymentDate._nanoseconds);
      }
    }

    return {
      ...payment,
      paymentDate: this.getDateFromTimestamp(paymentDate),
      createdAt: this.getDateFromTimestamp(payment.createdAt),
      updatedAt: this.getDateFromTimestamp(payment.updatedAt),
      amount: typeof payment.amount === 'number' ? payment.amount : parseFloat(payment.amount) || 0,
      status: payment.status || 'completed',
      supplierId: payment.supplierId || '',
      paymentMethod: payment.paymentMethod || '',
      notes: payment.notes || '',
      referenceNo: payment.referenceNo || '',
      location: payment.location || '',
      type: payment.type || 'purchase',
      supplierName: payment.supplierName || '',
      document: payment.document || null,
      paymentAccount: payment.paymentAccount || ''
    };
  } catch (error) {
    console.error('Error processing payment data:', error, payment);
    return {
      id: payment?.id || '',
      supplierId: payment?.supplierId || '',
      amount: 0,
      paymentDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'error'
    };
  }
}
}