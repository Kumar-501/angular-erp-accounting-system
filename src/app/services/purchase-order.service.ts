import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, doc, deleteDoc, onSnapshot, getDoc, updateDoc, query, getDocs, orderBy, where } from '@angular/fire/firestore';
import { map, Observable } from 'rxjs';
interface PurchaseOrderReference {
  id: string;
  referenceNo: string;
  date?: string;
  status?: string;
}

export interface PurchaseOrder {
  id?: string;
  date: string;
  referenceNo: string;
  businessLocation: string;
  businessLocationId?: string;
  supplier: string;
    grandTotal?: number; 
  isUsedForPurchase?: boolean;

  status: string;
  quantityRemaining: number;
  shippingStatus: string;
  shippingCharges: number;
  addedBy: string;
  createdAt?: Date;
  updatedAt?: Date;
  requisitionId?: string;
  requisitions?: any[];
  shippingDetails?: any;
  additionalNotes?: string;
  address?: string;
  requiredByDate?: string;
  expectedDeliveryDate?: any;
  payTerm?: string;
  hasPurchase?: boolean;
  supplierId?: string;
  products?: any[];
  items?: any[];
  notes?: string;
  purchaseOrder?: string;
}


@Injectable({
  providedIn: 'root'
})
export class PurchaseOrderService {
  private ordersCollection;

  constructor(private firestore: Firestore) {
    this.ordersCollection = collection(this.firestore, 'purchase-orders');
  }
  

  // Add a new purchase order
  async addOrder(orderData: PurchaseOrder): Promise<any> {
    // Add timestamps
    orderData.createdAt = new Date();
    
    // Ensure products array exists
    if (!orderData.products && orderData.items) {
      orderData.products = this.mapItemsToProducts(orderData.items);
    }

    try {
      const docRef = await addDoc(this.ordersCollection, orderData);
      return { id: docRef.id, ...orderData };
    } catch (error) {
      console.error('Error adding order:', error);
      throw error;
    }
  }

  async updateOrderShippingDetails(id: string, shippingDetails: any): Promise<void> {
    try {
      const orderRef = doc(this.firestore, 'purchase-orders', id);
      
      return updateDoc(orderRef, {
        shippingStatus: shippingDetails.status,
        shippingDetails: shippingDetails,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error updating shipping details:', error);
      throw error;
    }
  }
private mapItemsToProducts(items: any[]): any[] {
    if (!items || !Array.isArray(items)) return [];
    
    return items.map(item => ({
      productName: item.productName || 'Unknown Product',
      quantity: item.requiredQuantity || item.quantity || 0,
      unitCost: item.unitCost || 0,
      productId: item.productId || '',
      alertQuantity: item.alertQuantity || 0,
      unitPurchasePrice: item.unitPurchasePrice || 0  // Changed from product.unitPurchasePrice to item.unitPurchasePrice
    }));
}

  // Get order by ID
  async getOrderById(id: string): Promise<PurchaseOrder | null> {
    try {
      const orderRef = doc(this.firestore, 'purchase-orders', id);
      const orderSnap = await getDoc(orderRef);

      if (orderSnap.exists()) {
        const orderData = orderSnap.data() as PurchaseOrder;
        return { 
          id: orderSnap.id, 
          ...orderData,
          products: orderData.products || this.mapItemsToProducts(orderData.items || [])
        };
      } else {
        console.log('No order found with ID:', id);
        return null;
      }
    } catch (error) {
      console.error('Error fetching order:', error);
      throw error;
    }
  }
  // Add a new purchase order

// In purchase-order.service.ts
async markOrderAsUsed(orderId: string): Promise<void> {
  const orderRef = doc(this.firestore, 'purchase-orders', orderId);
  return updateDoc(orderRef, {
    isUsedForPurchase: true,
    updatedAt: new Date()
  });
}
  // Update an existing purchase order
  async updateOrder(id: string, orderData: Partial<PurchaseOrder>): Promise<void> {
    try {
      // Add update timestamp
      orderData.updatedAt = new Date();

      const orderRef = doc(this.firestore, 'purchase-orders', id);

      // Remove the id field if it exists
      if (orderData.id) {
        delete orderData.id;
      }

      // Ensure products are properly formatted if items exist
      if (!orderData.products && orderData.items) {
        orderData.products = this.mapItemsToProducts(orderData.items);
      }

      return updateDoc(orderRef, { ...orderData });
    } catch (error) {
      console.error('Error updating order:', error);
      throw error;
    }
  }

  // Method to create a purchase order from an approved requisition
  async createPurchaseOrderFromRequisition(orderData: any): Promise<any> {
    // Add timestamps
    orderData.createdAt = new Date();
    
    // Ensure products array exists and is properly formatted
    if (orderData.items && !orderData.products) {
      orderData.products = this.mapItemsToProducts(orderData.items);
    }
    
    console.log('Creating purchase order with data:', orderData);
  
    try {
      const docRef = await addDoc(this.ordersCollection, orderData);
      return { id: docRef.id, ...orderData };
    } catch (error) {
      console.error('Error creating purchase order:', error);
      throw error;
    }
  }
  


  // Get all orders
  getOrders(): Observable<PurchaseOrder[]> {
    return new Observable(observer => {
      const unsubscribe = onSnapshot(this.ordersCollection, (snapshot) => {
        const orders = snapshot.docs.map(doc => {
          const data = doc.data() as PurchaseOrder;
          return {
            id: doc.id,
            ...data,
            // Ensure products array exists
            products: data.products || this.mapItemsToProducts(data.items || [])
          } as PurchaseOrder;
        });
        observer.next(orders);
      }, (error: Error) => {
        console.error('Error fetching orders:', error);
        observer.error(error);
      });

      return () => unsubscribe();
    });
  }
// In purchase-order.service.ts
// In purchase-order.service.ts
async getOrderReferencesBySupplier(supplierId: string): Promise<PurchaseOrderReference[]> {
  try {
    const ordersRef = collection(this.firestore, 'purchase-orders');
    const q = query(
      ordersRef,
      where('supplierId', '==', supplierId),
      where('status', '==', 'Approved'), // Only show approved orders
      orderBy('date', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      referenceNo: doc.data()['referenceNo'],
      date: doc.data()['date'],
      status: doc.data()['status']
    }));
  } catch (error) {
    console.error('Error loading supplier purchase orders:', error);
    return [];
  }
}
async getOrdersBySupplier(supplierId: string): Promise<any[]> {
  try {
    const ordersRef = collection(this.firestore, 'purchase-orders');
    const q = query(
      ordersRef,
      where('supplierId', '==', supplierId),
      orderBy('date', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error loading supplier purchase orders:', error);
    return [];
  }
}
  // Delete order
  async deleteOrder(id: string): Promise<void> {
    try {
      const orderRef = doc(this.firestore, 'purchase-orders', id);
      return deleteDoc(orderRef);
    } catch (error) {
      console.error('Error deleting order:', error);
      throw error;
    }
  }

  // Update order status
  async updateOrderStatus(id: string, newStatus: string): Promise<void> {
    try {
      const orderRef = doc(this.firestore, 'purchase-orders', id);
      
      return updateDoc(orderRef, {
        status: newStatus,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error updating order status:', error);
      throw error;
    }
  }
}