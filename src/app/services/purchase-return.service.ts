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
  FirestoreError
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';

// Define return product item interface
interface ReturnProductItem {
  id?: string;
  name?: string;
  productName?: string;
  quantity?: number;
  returnQuantity: number;
  price?: number;
  subtotal: number;
  code?: string;
}

// Define the PurchaseReturn interface
interface PurchaseReturn {
  id?: string;
  returnDate: string;
  referenceNo: string;
  parentPurchaseId: string;
  parentPurchaseRef: string;
  businessLocation: string;
  supplier: string;
  returnStatus: string;
  paymentStatus: string;
  products: ReturnProductItem[];
  reason: string;
  grandTotal: number;
  createdAt: Date;
  createdBy: string;
}

@Injectable({
  providedIn: 'root'
})
export class PurchaseReturnService {
  private collectionName = 'purchase-returns';

  constructor(private firestore: Firestore) {}

  // Get all purchase returns in real-time
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

  // Add a new purchase return
  addPurchaseReturn(purchaseReturn: PurchaseReturn): Promise<any> {
    const colRef = collection(this.firestore, this.collectionName);
    return addDoc(colRef, purchaseReturn);
  }

  // Update a purchase return
  updatePurchaseReturn(id: string, data: Partial<PurchaseReturn>): Promise<void> {
    const docRef = doc(this.firestore, `${this.collectionName}/${id}`);
    return updateDoc(docRef, data as any);
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
}
