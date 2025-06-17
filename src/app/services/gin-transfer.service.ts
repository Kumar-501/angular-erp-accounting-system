// gin-transfer.service.ts
import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, doc, deleteDoc, updateDoc, onSnapshot, query, where, getDocs, DocumentData, DocumentReference, getDoc, orderBy } from '@angular/fire/firestore';
import { Observable, BehaviorSubject } from 'rxjs';

export interface GinTransfer {
  id?: string;
  date: string;
  referenceNo: string;
  locationFrom: string;
  locationTo: string;
  locationTo2?: string | null; // Added secondary location field
  status: string;
  items: GinTransferItem[];
  shippingCharges: number;
  additionalNotes: string;
  totalAmount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface GinTransferItem {
  productId: string;
  productName: string;
  quantity: number;
  secondaryQuantity?: number; // Added secondary quantity field
  unitPrice: number;
  subtotal: number;
}

@Injectable({
  providedIn: 'root'
})
export class GinTransferService {
  private _ginTransfers = new BehaviorSubject<GinTransfer[]>([]);
  readonly ginTransfers$ = this._ginTransfers.asObservable();
  private unsubscribe: (() => void) | null = null;
  getUpdateEmitter: any;

  constructor(private firestore: Firestore) {
    // Start listening to gin transfers on service initialization
    this.subscribeToGinTransfers();
  }

  // Set up real-time listener for gin transfers
  private subscribeToGinTransfers(): void {
    // Clean up previous subscription if exists
    if (this.unsubscribe) {
      this.unsubscribe();
    }

    const ginTransfersRef = collection(this.firestore, 'ginTransfers');
    const q = query(ginTransfersRef, orderBy('createdAt', 'desc'));

    this.unsubscribe = onSnapshot(q, (querySnapshot) => {
      const ginTransfers: GinTransfer[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data() as GinTransfer;
        ginTransfers.push({ 
          id: doc.id, 
          ...data 
        });
      });
      this._ginTransfers.next(ginTransfers);
    }, (error) => {
      console.error('Error fetching gin transfers:', error);
    });
  }

  // Add a new GIN transfer
  async addGinTransfer(ginTransfer: GinTransfer): Promise<string> {
    try {
      // Add timestamps
      const timestamp = new Date();
      ginTransfer.createdAt = timestamp;
      ginTransfer.updatedAt = timestamp;
      
      const ginTransfersRef = collection(this.firestore, 'ginTransfers');
      const docRef = await addDoc(ginTransfersRef, ginTransfer);
      return docRef.id;
    } catch (error) {
      console.error('Error adding GIN transfer:', error);
      throw error;
    }
  }

  // Get all GIN transfers with real-time updates
  getGinTransfers(): Observable<GinTransfer[]> {
    return this.ginTransfers$;
  }

  // Get a single GIN transfer by ID
  async getGinTransfer(id: string): Promise<GinTransfer | undefined> {
    try {
      const docRef = doc(this.firestore, 'ginTransfers', id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() as GinTransfer };
      } else {
        return undefined;
      }
    } catch (error) {
      console.error('Error getting GIN transfer:', error);
      throw error;
    }
  }

  // Get a single GIN transfer by ID with real-time updates
  getGinTransferRealtime(id: string): Observable<GinTransfer | undefined> {
    return new Observable<GinTransfer | undefined>(observer => {
      const docRef = doc(this.firestore, 'ginTransfers', id);
      
      const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          observer.next({ id: docSnap.id, ...docSnap.data() as GinTransfer });
        } else {
          observer.next(undefined);
        }
      }, error => {
        observer.error(error);
      });
      
      // Return cleanup function
      return () => unsubscribe();
    });
  }

  // Update a GIN transfer
  async updateGinTransfer(id: string, ginTransfer: Partial<GinTransfer>): Promise<void> {
    try {
      const updateData = { ...ginTransfer, updatedAt: new Date() };
      const docRef = doc(this.firestore, 'ginTransfers', id);
      await updateDoc(docRef, updateData);
    } catch (error) {
      console.error('Error updating GIN transfer:', error);
      throw error;
    }
  }

  // Delete a GIN transfer
  async deleteGinTransfer(id: string): Promise<void> {
    try {
      const docRef = doc(this.firestore, 'ginTransfers', id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting GIN transfer:', error);
      throw error;
    }
  }

  // Clean up subscriptions when service is destroyed
  ngOnDestroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }
}