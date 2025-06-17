import { Injectable } from '@angular/core';
import { Firestore, collection, collectionData, addDoc, doc, updateDoc, getDoc, getDocs, query, where, deleteDoc, onSnapshot, orderBy, limit } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
interface RequisitionItem {
  productId: string;
  productName: string;
  requiredQuantity: number;
  alertQuantity: number;
  currentStock?: number;
  unitPurchasePrice: number;
  purchasePriceIncTax: number;
}

interface Requisition {
  supplier: boolean;
  id: string;
  date: string;
  referenceNo: string;
  location: string;
  locationName: string;
  status: string;
  requiredByDate: string;
  addedBy: string;
  items: RequisitionItem[];
  createdAt?: Date;
  updatedAt?: Date;
  // Add the missing properties
  brand?: string;
  category?: string;
  shippingStatus?: string;
  supplierName?: string;
  shippingDate?: string;
}

@Injectable({
  providedIn: 'root'
})
export class PurchaseRequisitionService {
  private requisitionCollection;

  constructor(private firestore: Firestore) {
    this.requisitionCollection = collection(this.firestore, 'purchase-requisitions');
  }

  // New method to update requisition status
  async updateRequisitionStatus(id: string, status: string): Promise<void> {
    const requisitionDoc = doc(this.firestore, `purchase-requisitions/${id}`);
    return updateDoc(requisitionDoc, { 
      status: status,
      updatedAt: new Date()
    });
  }

  getRequisitionById(id: string): Observable<Requisition> {
    return new Observable(observer => {
      const requisitionDoc = doc(this.firestore, `purchase-requisitions/${id}`);
      
      const unsubscribe = onSnapshot(requisitionDoc, (docSnapshot) => {
        if (docSnapshot.exists()) {
          const requisition = {
            id: docSnapshot.id,
            ...docSnapshot.data()
          } as Requisition;
          observer.next(requisition);
        } else {
          observer.error(new Error('Requisition not found'));
        }
      });

      // Cleanup on unsubscribing
      return () => unsubscribe();
    });
  }

  async getLatestRequisition(): Promise<Requisition | null> {
    try {
      // Create a query to get the latest requisition ordered by createdAt in descending order
      const q = query(
        this.requisitionCollection,
        orderBy('createdAt', 'desc'),
        limit(1)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        return {
          id: doc.id,
          ...doc.data()
        } as Requisition;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting latest requisition:', error);
      return null;
    }
  }

  addRequisition(requisition: any) {
    requisition.createdAt = new Date();
    requisition.updatedAt = new Date();
    return addDoc(this.requisitionCollection, requisition);
  }

  getRequisitions(): Observable<Requisition[]> {
    return new Observable(observer => {
      const unsubscribe = onSnapshot(this.requisitionCollection, (snapshot) => {
        const requisitions = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Requisition));
        observer.next(requisitions);
      });
      return () => unsubscribe();
    });
  }

  getFilteredRequisitions(filters: { location: string; status: string; dateRange: string; requiredByDate: string; }): Observable<Requisition[]> {
    return new Observable(observer => {
      let q = query(this.requisitionCollection);
      
      if (filters.location && filters.location !== 'All') {
        q = query(q, where('location', '==', filters.location));
      }
      
      if (filters.status && filters.status !== 'All') {
        q = query(q, where('status', '==', filters.status));
      }
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        let requisitions = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Requisition));
        
        if (filters.dateRange) {
          const [startDate, endDate] = filters.dateRange.split(' - ');
          if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            end.setHours(23, 59, 59);
            
            requisitions = requisitions.filter(req => {
              const reqDate = req.date ? new Date(req.date) : null;
              return reqDate && reqDate >= start && reqDate <= end;
            });
          }
        }
        
        if (filters.requiredByDate) {
          const requiredDate = new Date(filters.requiredByDate);
          requisitions = requisitions.filter(req => {
            const reqRequiredDate = req.requiredByDate ? new Date(req.requiredByDate) : null;
            return reqRequiredDate && 
                   reqRequiredDate.getDate() === requiredDate.getDate() &&
                   reqRequiredDate.getMonth() === requiredDate.getMonth() &&
                   reqRequiredDate.getFullYear() === requiredDate.getFullYear();
          });
        }
        
        observer.next(requisitions);
      });
      
      return () => unsubscribe();
    });
  }

  async deleteRequisition(id: string): Promise<void> {
    const requisitionDoc = doc(this.firestore, `purchase-requisitions/${id}`);
    return deleteDoc(requisitionDoc);
  }
}