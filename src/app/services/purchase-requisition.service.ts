import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  doc,
  updateDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  onSnapshot,
  orderBy,
  limit,
  serverTimestamp
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';

/**
 * Interface for an individual item within a purchase requisition.
 */
interface RequisitionItem {
  productId: string;
  productName: string;
  requiredQuantity: number;
  alertQuantity: number;
  currentStock?: number;
  unitPurchasePrice: number;
  purchasePriceIncTax: number;
  subtotal?: number; // Optional subtotal for the line item
  taxPercent?: number; // Ensure tax is part of the model
}

/**
 * Interface for the main Purchase Requisition document.
 */
interface Requisition {
  id: string;
  date: string;
  referenceNo: string;
  location: string;
  locationName: string;
  status: string;
  requiredByDate: string;
  addedBy: string;
  items: RequisitionItem[];
  supplier: string; // The ID of the supplier
  supplierName?: string;
  brand?: string;
  category?: string;
  shippingStatus?: string;
  shippingDate?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

@Injectable({
  providedIn: 'root'
})
export class PurchaseRequisitionService {
  private requisitionCollection;
  private poCollection;

  constructor(private firestore: Firestore) {
    this.requisitionCollection = collection(this.firestore, 'purchase-requisitions');
    this.poCollection = collection(this.firestore, 'purchase-orders');
  }

  /**
   * Adds a new purchase requisition to Firestore.
   * @param requisition The requisition data to add.
   * @returns A promise that resolves with the document reference.
   */
  addRequisition(requisition: Omit<Requisition, 'id'>) {
    const requisitionWithTimestamps = {
      ...requisition,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    return addDoc(this.requisitionCollection, requisitionWithTimestamps);
  }

  /**
   * Retrieves all purchase requisitions in real-time, ordered by creation date.
   * @returns An observable of the requisition array.
   */
  getRequisitions(): Observable<Requisition[]> {
    return new Observable(observer => {
      const q = query(this.requisitionCollection, orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const requisitions = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Requisition));
        observer.next(requisitions);
      }, (error) => {
        console.error("Error fetching requisitions in real-time:", error);
        observer.error(error);
      });
      // Cleanup function to unsubscribe when the observable is completed.
      return () => unsubscribe();
    });
  }

  /**
   * Retrieves a single purchase requisition by its ID in real-time.
   * @param id The document ID of the requisition.
   * @returns An observable of the requisition.
   */
  getRequisitionById(id: string): Observable<Requisition> {
    return new Observable(observer => {
      const requisitionDoc = doc(this.firestore, `purchase-requisitions/${id}`);
      const unsubscribe = onSnapshot(requisitionDoc, (docSnapshot) => {
        if (docSnapshot.exists()) {
          observer.next({ id: docSnapshot.id, ...docSnapshot.data() } as Requisition);
        } else {
          observer.error(new Error('Requisition not found'));
        }
      }, (error) => {
        console.error(`Error fetching requisition ${id}:`, error);
        observer.error(error);
      });
      // Cleanup function
      return () => unsubscribe();
    });
  }

  /**
   * Deletes a purchase requisition from Firestore.
   * @param id The document ID of the requisition to delete.
   * @returns A promise that resolves when the deletion is complete.
   */
  async deleteRequisition(id: string): Promise<void> {
    const requisitionDoc = doc(this.firestore, `purchase-requisitions/${id}`);
    return deleteDoc(requisitionDoc);
  }

  /**
   * Updates the status of a specific requisition.
   * @param id The document ID of the requisition.
   * @param status The new status (e.g., 'Approved', 'Rejected').
   * @returns A promise that resolves when the update is complete.
   */
  async updateRequisitionStatus(id: string, status: string): Promise<void> {
    const requisitionDoc = doc(this.firestore, `purchase-requisitions/${id}`);
    return updateDoc(requisitionDoc, {
      status: status,
      updatedAt: new Date()
    });
  }

  /**
   * CRITICAL FIX: Updates a requisition and synchronizes the changes with its linked purchase order.
   * This ensures that edits to an approved requisition are reflected in the PO.
   * @param requisitionId The ID of the requisition to update.
   * @param requisitionData The partial data to update the requisition with, including the pre-calculated orderTotal.
   */
  async updateRequisitionAndOrder(requisitionId: string, requisitionData: Partial<Requisition & { orderTotal: number }>): Promise<void> {
    try {
      // 1. Update the primary requisition document
      const requisitionRef = doc(this.firestore, 'purchase-requisitions', requisitionId);
      await updateDoc(requisitionRef, {
        ...requisitionData,
        updatedAt: serverTimestamp()
      });

      // 2. Find the purchase order that was created from this requisition
      const ordersQuery = query(
        this.poCollection,
        where('requisitionId', '==', requisitionId),
        limit(1)
      );
      const querySnapshot = await getDocs(ordersQuery);

      // 3. If a linked purchase order exists, update it
      if (!querySnapshot.empty) {
        const orderDoc = querySnapshot.docs[0];
        const orderRef = doc(this.firestore, 'purchase-orders', orderDoc.id);

        const newItems = requisitionData.items || [];

        // 4. Map the updated requisition items to the purchase order's format
        const orderItemsPayload = newItems.map(item => ({
          productId: item.productId || '',
          productName: item.productName || 'Unknown Product',
          quantity: item.requiredQuantity || 0,
          requiredQuantity: item.requiredQuantity || 0,
          unitCost: item.unitPurchasePrice || 0,
          unitPurchasePrice: item.unitPurchasePrice || 0,
          purchasePriceIncTax: item.purchasePriceIncTax || 0,
          currentStock: item.currentStock || 0,
          alertQuantity: item.alertQuantity || 0,
          taxPercent: item.taxPercent || 0,
        }));

        // 5. **THE FIX**: Use the orderTotal calculated and passed from the component.
        // This prevents incorrect recalculation in the service. The internal calculation
        // is now only a defensive fallback.
        const poUpdatePayload = {
          items: orderItemsPayload,
          products: orderItemsPayload, // Update both `items` and `products` for consistency
          orderTotal: requisitionData.orderTotal ?? this.calculateOrderTotal(orderItemsPayload),
          updatedAt: serverTimestamp()
        };

        // 6. Execute the update on the purchase order
        await updateDoc(orderRef, poUpdatePayload);
      }
    } catch (error) {
      console.error('Error updating requisition and linked order:', error);
      throw error;
    }
  }

  /**
   * Fetches the most recently created requisition.
   * Useful for generating the next reference number.
   * @returns A promise that resolves with the latest requisition or null if none exist.
   */
  async getLatestRequisition(): Promise<Requisition | null> {
    try {
      const q = query(
        this.requisitionCollection,
        orderBy('createdAt', 'desc'),
        limit(1)
      );
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        return { id: doc.id, ...doc.data() } as Requisition;
      }
      return null;
    } catch (error) {
      console.error('Error getting latest requisition:', error);
      return null;
    }
  }

  /**
   * A private helper method to calculate the total order value from its items.
   * This serves as a defensive fallback if the orderTotal is not provided.
   * @param items An array of items, each with quantity, price, and tax.
   * @returns The calculated total number.
   */
  private calculateOrderTotal(items: any[]): number {
    if (!items || items.length === 0) {
      return 0;
    }
    return items.reduce((total, item) => {
      const quantity = item.quantity || item.requiredQuantity || 0;
      // Prioritize the price including tax, otherwise calculate it from unit cost and tax percent.
      const priceWithTax = item.purchasePriceIncTax || (item.unitCost * (1 + (item.taxPercent || 0) / 100));
      return total + (quantity * priceWithTax);
    }, 0);
  }
}