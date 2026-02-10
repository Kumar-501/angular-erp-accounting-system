import { Injectable } from '@angular/core';
import { 
  Firestore, 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  where, 
  orderBy,
  getDoc,
  getDocs,
  serverTimestamp
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';

interface PurchaseOrderReference {
  id: string;
  referenceNo: string;
  date?: string;
  status?: string;
}

interface PurchaseOrderData {
  id?: string;
  requisitionId?: string;
  isUsedForPurchase?: boolean;
}

export interface PurchaseOrder {
  invoiceNo: string;
  purchaseDate: string;
  shippingTaxPercent: number;
  shippingTaxAmount: number;
  supplierAddress: any;
  orderDate: string;
  shippingDate(shippingDate: any): any;
  id?: string;
  date: string;
  location?: string;

  deliveryStatus?: 'new' | 'partial' | 'completed';
  referenceNo: string;
  businessLocation: string;
  businessLocationId?: string;
  supplier: string;
  grandTotal?: number; 
  isUsedForPurchase?: boolean;
  isUsedForGoods?: boolean;
  requiredDate?: string | Date;
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
  isFromRequisition?: boolean;
  supplierName?: string;
  locationName?: string;
  orderTotal?: number;
}

@Injectable({
  providedIn: 'root'
})
export class PurchaseOrderService {
  private collectionName = 'purchase-orders';
  private requisitionsCollectionName = 'purchase-requisitions';

  constructor(private firestore: Firestore) {}

  // Get all orders (original method)
  getOrders(): Observable<PurchaseOrder[]> {
    return new Observable(observer => {
      const ordersCollection = collection(this.firestore, this.collectionName);
      const q = query(ordersCollection, orderBy('createdAt', 'desc'));
      
      const unsubscribe = onSnapshot(q, async (snapshot) => {
        const purchaseOrders = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          products: doc.data()['products'] || this.mapItemsToProducts(doc.data()['items'] || []),
          isFromRequisition: false
        } as PurchaseOrder));

        const approvedRequisitions = await this.getAllApprovedRequisitions();
        
        const allOrders = [...purchaseOrders, ...approvedRequisitions];
        observer.next(allOrders);
      });
      
      return () => unsubscribe();
    });
  }

  // Get orders specifically for purchase component (excluding those used for purchase)
  getOrdersForPurchase(): Observable<PurchaseOrder[]> {
    return new Observable(observer => {
      const ordersCollection = collection(this.firestore, this.collectionName);
      const q = query(
        ordersCollection, 
        where('isUsedForPurchase', '!=', true),
        orderBy('createdAt', 'desc')
      );
      
      const unsubscribe = onSnapshot(q, async (snapshot) => {
        const purchaseOrders = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          products: doc.data()['products'] || this.mapItemsToProducts(doc.data()['items'] || []),
          isFromRequisition: false
        } as PurchaseOrder));

        const approvedRequisitions = await this.getApprovedRequisitionsForPurchase();
        
        const allOrders = [...purchaseOrders, ...approvedRequisitions];
        observer.next(allOrders);
      });
      
      return () => unsubscribe();
    });
  }

  // Get orders specifically for goods component (excluding those used for goods)
  getOrdersForGoods(): Observable<PurchaseOrder[]> {
    return new Observable(observer => {
      const ordersCollection = collection(this.firestore, this.collectionName);
      const q = query(
        ordersCollection, 
        where('isUsedForGoods', '!=', true),
        orderBy('createdAt', 'desc')
      );
      
      const unsubscribe = onSnapshot(q, async (snapshot) => {
        const purchaseOrders = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          products: doc.data()['products'] || this.mapItemsToProducts(doc.data()['items'] || []),
          isFromRequisition: false
        } as PurchaseOrder));

        const approvedRequisitions = await this.getApprovedRequisitionsForGoods();
        
        const allOrders = [...purchaseOrders, ...approvedRequisitions];
        observer.next(allOrders);
      });
      
      return () => unsubscribe();
    });
  }

  // Get approved requisitions for purchase (not used for purchase)
  private async getApprovedRequisitionsForPurchase(): Promise<PurchaseOrder[]> {
    try {
      const requisitionsRef = collection(this.firestore, this.requisitionsCollectionName);
      const q = query(
        requisitionsRef,
        where('status', '==', 'approved'),
        where('isUsedForPurchase', '!=', true),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      return this.mapRequisitionsToPurchaseOrders(querySnapshot.docs);
    } catch (error) {
      console.error('Error loading approved requisitions for purchase:', error);
      return [];
    }
  }

  // Get approved requisitions for goods (not used for goods)
  private async getApprovedRequisitionsForGoods(): Promise<PurchaseOrder[]> {
    try {
      const requisitionsRef = collection(this.firestore, this.requisitionsCollectionName);
      const q = query(
        requisitionsRef,
        where('status', '==', 'approved'),
        where('isUsedForGoods', '!=', true),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      return this.mapRequisitionsToPurchaseOrders(querySnapshot.docs);
    } catch (error) {
      console.error('Error loading approved requisitions for goods:', error);
      return [];
    }
  }

  // Get all approved requisitions (for general listing)
  private async getAllApprovedRequisitions(): Promise<PurchaseOrder[]> {
    try {
      const requisitionsRef = collection(this.firestore, this.requisitionsCollectionName);
      const q = query(
        requisitionsRef,
        where('status', '==', 'approved'),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      return this.mapRequisitionsToPurchaseOrders(querySnapshot.docs);
    } catch (error) {
      console.error('Error loading all approved requisitions:', error);
      return [];
    }
  }

  // Helper method to map requisitions to purchase order format
  private mapRequisitionsToPurchaseOrders(docs: any[]): PurchaseOrder[] {
    return docs.map(doc => {
      const requisitionData = doc.data();
      
      return {
        id: doc.id,
        referenceNo: requisitionData['referenceNo'] || `PR-${doc.id.substring(0, 8)}`,
        date: requisitionData['date'] || requisitionData['createdAt']?.toDate() || new Date(),
        orderDate: requisitionData['date'] || requisitionData['createdAt']?.toDate() || new Date(),
        businessLocation: requisitionData['businessLocation'] || requisitionData['locationName'] || 'N/A',
        businessLocationId: requisitionData['businessLocationId'] || requisitionData['locationId'] || '',
        supplier: requisitionData['supplierId'] || '',
        supplierName: requisitionData['supplierName'] || 'Unknown Supplier',
        supplierId: requisitionData['supplierId'] || '',
        status: 'approved',
        shippingStatus: 'Pending',
        shippingCharges: 0,
        addedBy: requisitionData['addedBy'] || 'System',
        createdAt: requisitionData['createdAt']?.toDate() || new Date(),
        updatedAt: requisitionData['updatedAt']?.toDate() || new Date(),
        requisitionId: doc.id,
        requiredDate: requisitionData['requiredDate'] || requisitionData['requiredByDate'],
        requiredByDate: requisitionData['requiredDate'] || requisitionData['requiredByDate'],
        items: requisitionData['items'] || requisitionData['products'] || [],
        products: this.mapRequisitionItemsToProducts(requisitionData['items'] || requisitionData['products'] || []),
        orderTotal: this.calculateOrderTotal(requisitionData['items'] || requisitionData['products'] || []),
        quantityRemaining: 0,
        isFromRequisition: true,
        locationName: requisitionData['businessLocation'] || requisitionData['locationName'] || 'N/A'
      } as PurchaseOrder;
    });
  }

  // Map requisition items to purchase order products format
  private mapRequisitionItemsToProducts(items: any[]): any[] {
    if (!items || !Array.isArray(items)) return [];
    
    return items.map(item => ({
      productId: item.productId || item.id || '',
      productName: item.productName || item.name || 'Unknown Product',
      quantity: item.quantity || item.requiredQuantity || 0,
      requiredQuantity: item.quantity || item.requiredQuantity || 0,
      unitCost: item.unitCost || item.price || item.unitPrice || 0,
      unitPurchasePrice: item.unitCost || item.price || item.unitPrice || 0,
      alertQuantity: item.alertQuantity || 0,
      currentStock: item.currentStock || 0,
      sku: item.sku || '',
      batchNumber: item.batchNumber || '',
      expiryDate: item.expiryDate || null
    }));
  }

  // Calculate total for requisition items
  private calculateOrderTotal(items: any[]): number {
    if (!items || !Array.isArray(items)) return 0;
    
    return items.reduce((total, item) => {
      const quantity = item.quantity || item.requiredQuantity || 0;
      const unitCost = item.unitCost || item.price || item.unitPrice || 0;
      return total + (quantity * unitCost);
    }, 0);
  }

  // Map items to products format
  private mapItemsToProducts(items: any[]): any[] {
    if (!items || !Array.isArray(items)) return [];
    
    return items.map(item => ({
      productName: item.productName || 'Unknown Product',
      quantity: item.requiredQuantity || item.quantity || 0,
      unitCost: item.unitCost || 0,
      productId: item.productId || '',
      alertQuantity: item.alertQuantity || 0,
      unitPurchasePrice: item.unitPurchasePrice || 0
    }));
  }

  async getOrderById(id: string): Promise<PurchaseOrder | null> {
    try {
      console.log(`Attempting to fetch document with ID: ${id}`);
      
      const orderDocRef = doc(this.firestore, this.collectionName, id);
      const orderSnap = await getDoc(orderDocRef);
  
      if (orderSnap.exists()) {
        console.log('Document found in purchase-orders collection');
        const orderData = orderSnap.data() as PurchaseOrder;
        
        if (orderData.requisitionId) {
          const requisitionDocRef = doc(this.firestore, this.requisitionsCollectionName, orderData.requisitionId);
          const requisitionSnap = await getDoc(requisitionDocRef);
          
          if (requisitionSnap.exists()) {
            console.log('Found linked requisition, merging data');
            const requisitionData = requisitionSnap.data();
            
            return {
              ...orderData,
              id: orderSnap.id,
              products: this.mergeItems(
                orderData['items'] || orderData['products'] || [],
                requisitionData['items'] || []
              ),
              items: this.mergeItems(
                orderData['items'] || orderData['products'] || [],
                requisitionData['items'] || []
              ),
              isFromRequisition: true,
              requisitionId: orderData.requisitionId
            };
          }
        }
  
        const products = (orderData['products'] || orderData['items'] || []).map(p => ({
          ...p,
          unitCost: p.unitCost || p.unitPurchasePrice || 0,
          unitPurchasePrice: p.unitPurchasePrice || p.unitCost || 0,
          quantity: p.quantity || p.requiredQuantity || 0
        }));
  
        return {
          id: orderSnap.id,
          ...orderData,
          products: products,
          items: products,
          isFromRequisition: false
        };
      }
  
      console.log('Checking purchase-requisitions collection');
      const requisitionDocRef = doc(this.firestore, this.requisitionsCollectionName, id);
      const requisitionSnap = await getDoc(requisitionDocRef);
  
      if (requisitionSnap.exists()) {
        console.log('Document found in purchase-requisitions collection');
        return this.mapRequisitionsToPurchaseOrders([requisitionSnap])[0];
      }
  
      console.error(`No document found for ID: ${id}`);
      return null;
  
    } catch (error) {
      console.error(`Error fetching document by ID ${id}:`, error);
      throw error;
    }
  }
  
  private mergeItems(orderItems: any[], requisitionItems: any[]): any[] {
    const requisitionItemsMap = new Map(
      requisitionItems.map(item => [item.productId, item])
    );
  
    return orderItems.map(orderItem => {
      const requisitionItem = requisitionItemsMap.get(orderItem.productId);
      if (requisitionItem) {
        return {
          ...orderItem,
          requiredQuantity: requisitionItem.requiredQuantity || orderItem.quantity,
          unitPurchasePrice: requisitionItem.unitPurchasePrice || orderItem.unitCost,
          currentStock: requisitionItem.currentStock || orderItem.currentStock
        };
      }
      return orderItem;
    });
  }
  
  addOrder(order: PurchaseOrder): Promise<any> {
    const ordersCollection = collection(this.firestore, this.collectionName);
    return addDoc(ordersCollection, {
      ...order,
      createdAt: new Date(),
      updatedAt: new Date(),
      isUsedForPurchase: false,
      isUsedForGoods: false
    });
  }
  
  updateOrder(id: string, order: Partial<PurchaseOrder>): Promise<void> {
    const orderDoc = doc(this.firestore, this.collectionName, id);
    return updateDoc(orderDoc, {
      ...order,
      updatedAt: new Date()
    });
  }
  
  async updateOrderAndRequisition(orderId: string, orderData: Partial<PurchaseOrder>): Promise<void> {
    try {
      const orderRef = doc(this.firestore, 'purchase-orders', orderId);
      await updateDoc(orderRef, {
        ...orderData,
        updatedAt: serverTimestamp()
      });
  
      const orderDoc = await getDoc(orderRef);
      const order = orderDoc.data() as PurchaseOrder;
      
      if (order.requisitionId) {
        const requisitionRef = doc(this.firestore, 'purchase-requisitions', order.requisitionId);
        
        const requisitionItems = (order['items'] || order['products'] || []).map(item => ({
          productId: item.productId,
          productName: item.productName,
          requiredQuantity: item.quantity || item.requiredQuantity,
          unitPurchasePrice: item.unitCost,
          purchasePriceIncTax: item.unitCost || 0,
          currentStock: item.currentStock,
          alertQuantity: item.alertQuantity
        }));
  
        await updateDoc(requisitionRef, {
          items: requisitionItems,
          updatedAt: serverTimestamp(),
          status: order.status === 'Approved' ? 'Approved' : 'Pending'
        });
      }
    } catch (error) {
      console.error('Error updating order and requisition:', error);
      throw error;
    }
  }
  
  async deleteOrderAndRequisition(orderId: string): Promise<void> {
    const orderRef = doc(this.firestore, 'purchase-orders', orderId);
    const orderDoc = await getDoc(orderRef);
    
    if (orderDoc.exists()) {
      const order = orderDoc.data() as PurchaseOrder;
      
      if (order.requisitionId) {
        const requisitionRef = doc(this.firestore, 'purchase-requisitions', order.requisitionId);
        await deleteDoc(requisitionRef);
      }
      
      await deleteDoc(orderRef);
    }
  }
  
  deleteOrder(id: string): Promise<void> {
    const orderDoc = doc(this.firestore, this.collectionName, id);
    return deleteDoc(orderDoc);
  }
  
  async markOrderAsUsedForPurchase(orderId: string): Promise<void> {
    try {
      const orderRef = doc(this.firestore, 'purchase-orders', orderId);
      
      const orderDoc = await getDoc(orderRef);
      if (!orderDoc.exists()) {
        console.warn(`Purchase order ${orderId} not found`);
        return;
      }
  
      await updateDoc(orderRef, {
        isUsedForPurchase: true,
        updatedAt: serverTimestamp()
      });
      
      const orderData = orderDoc.data() as PurchaseOrderData;
      if (orderData?.['requisitionId']) {
        const requisitionRef = doc(this.firestore, 'purchase-requisitions', orderData['requisitionId']);
        const requisitionDoc = await getDoc(requisitionRef);
        
        if (requisitionDoc.exists()) {
          await updateDoc(requisitionRef, {
            isUsedForPurchase: true,
            updatedAt: serverTimestamp()
          });
        } else {
          console.warn(`Requisition ${orderData['requisitionId']} not found, skipping update`);
        }
      }
    } catch (error) {
      console.error('Error marking order as used for purchase:', error);
      console.warn('Continuing with purchase creation despite requisition update failure');
    }
  }
  
  async markOrderAsUsedForGoods(orderId: string, id: string): Promise<void> {
    try {
      const orderDoc = doc(this.firestore, this.collectionName, orderId);
      await updateDoc(orderDoc, {
        isUsedForGoods: true,
        usedForGoodsDate: new Date(),
        updatedAt: new Date()
      });
      console.log('Order marked as used for goods:', orderId);
    } catch (error) {
      console.error('Error marking order as used for goods:', error);
      throw error;
    }
  }
  
  async markRequisitionAsUsedForPurchase(requisitionId: string): Promise<void> {
    try {
      const requisitionDoc = doc(this.firestore, this.requisitionsCollectionName, requisitionId);
      await updateDoc(requisitionDoc, {
        isUsedForPurchase: true,
        usedForPurchaseDate: new Date(),
        updatedAt: new Date()
      });
      console.log('Requisition marked as used for purchase:', requisitionId);
    } catch (error) {
      console.error('Error marking requisition as used for purchase:', error);
      throw error;
    }
  }
  
  async markRequisitionAsUsedForGoods(requisitionId: string): Promise<void> {
    try {
      const requisitionDoc = doc(this.firestore, this.requisitionsCollectionName, requisitionId);
      await updateDoc(requisitionDoc, {
        isUsedForGoods: true,
        usedForGoodsDate: new Date(),
        updatedAt: new Date()
      });
      console.log('Requisition marked as used for goods:', requisitionId);
    } catch (error) {
      console.error('Error marking requisition as used for goods:', error);
      throw error;
    }
  }
  
  async resetOrderUsageFlags(orderId: string): Promise<void> {
    try {
      const orderDoc = doc(this.firestore, this.collectionName, orderId);
      await updateDoc(orderDoc, {
        isUsedForPurchase: false,
        isUsedForGoods: false,
        updatedAt: new Date()
      });
      console.log('Order usage flags reset:', orderId);
    } catch (error) {
      console.error('Error resetting order usage flags:', error);
      throw error;
    }
  }
  
  async resetRequisitionUsageFlags(requisitionId: string): Promise<void> {
    try {
      const requisitionDoc = doc(this.firestore, this.requisitionsCollectionName, requisitionId);
      await updateDoc(requisitionDoc, {
        isUsedForPurchase: false,
        isUsedForGoods: false,
        updatedAt: new Date()
      });
      console.log('Requisition usage flags reset:', requisitionId);
    } catch (error) {
      console.error('Error resetting requisition usage flags:', error);
      throw error;
    }
  }
  
  getOrdersBySupplier(supplierId: string): Observable<PurchaseOrder[]> {
    return new Observable(observer => {
      const ordersCollection = collection(this.firestore, this.collectionName);
      const q = query(
        ordersCollection, 
        where('supplierId', '==', supplierId),
        orderBy('createdAt', 'desc')
      );
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const orders = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as PurchaseOrder));
        observer.next(orders);
      });
      
      return () => unsubscribe();
    });
  }
  
  getOrdersByStatus(status: string): Observable<PurchaseOrder[]> {
    return new Observable(observer => {
      const ordersCollection = collection(this.firestore, this.collectionName);
      const q = query(
        ordersCollection, 
        where('status', '==', status),
        orderBy('createdAt', 'desc')
      );
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const orders = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as PurchaseOrder));
        observer.next(orders);
      });
      
      return () => unsubscribe();
    });
  }
  
  async updateOrderShippingDetails(id: string, shippingDetails: any): Promise<void> {
    try {
      const orderRef = doc(this.firestore, this.collectionName, id);
      
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
  
  async updateOrderStatus(id: string, newStatus: string): Promise<void> {
    try {
      const orderRef = doc(this.firestore, this.collectionName, id);
      
      return updateDoc(orderRef, {
        status: newStatus,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error updating order status:', error);
      throw error;
    }
  }
  
  async getOrderReferencesBySupplier(supplierId: string): Promise<PurchaseOrderReference[]> {
    try {
      const ordersRef = collection(this.firestore, this.collectionName);
      const q = query(
        ordersRef,
        where('supplierId', '==', supplierId),
        where('status', '==', 'approved'),
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
  
  async createPurchaseOrderFromRequisition(orderData: any): Promise<any> {
    orderData.createdAt = new Date();
    orderData.updatedAt = new Date();
    orderData.isUsedForPurchase = false;
    orderData.isUsedForGoods = false;
    
    if (orderData['items'] && !orderData['products']) {
      orderData['products'] = this.mapItemsToProducts(orderData['items']);
    }
    
    console.log('Creating purchase order with data:', orderData);
  
    try {
      const ordersCollection = collection(this.firestore, this.collectionName);
      const docRef = await addDoc(ordersCollection, orderData);
      return { id: docRef.id, ...orderData };
    } catch (error) {
      console.error('Error creating purchase order:', error);
      throw error;
    }
  }
  
  private calculatePaymentStatus(paymentAmount: number, orderTotal: number): string {
    if (!paymentAmount) return 'unpaid';
    if (paymentAmount >= orderTotal) return 'paid';
    if (paymentAmount > 0) return 'partial';
    return 'unpaid';
  }
  
  async markOrderAsUsed(orderId: string): Promise<void> {
    console.warn('markOrderAsUsed is deprecated. Use markOrderAsUsedForPurchase or markOrderAsUsedForGoods instead.');
    return this.markOrderAsUsedForPurchase(orderId);
  }
  
  async addPurchaseOrder(purchaseData: any): Promise<any> {
    try {
      if (!purchaseData.orderTotal) {
        purchaseData.orderTotal = purchaseData['items']?.reduce((total: number, item: any) => {
          return total + (item.quantity * item.unitCost);
        }, 0) || 0;
      }
  
      if (purchaseData.shippingCharges) {
        purchaseData.orderTotal += purchaseData.shippingCharges;
      }
  
      const purchaseToAdd = {
        ...purchaseData,
        orderTotal: purchaseData.orderTotal,
        paymentDue: purchaseData.orderTotal - (purchaseData.paymentAmount || 0),
        paymentStatus: this.calculatePaymentStatus(purchaseData.paymentAmount, purchaseData.orderTotal),
        createdAt: new Date(),
        updatedAt: new Date(),
        status: purchaseData.status || 'pending',
        isFromRequisition: false,
        isUsedForPurchase: false,
        isUsedForGoods: false
      };
  
      const ordersCollection = collection(this.firestore, this.collectionName);
      const docRef = await addDoc(ordersCollection, purchaseToAdd);
      
      return { id: docRef.id, ...purchaseToAdd };
    } catch (error) {
      console.error('Error creating purchase order:', error);
      throw error;
    }
  }
}