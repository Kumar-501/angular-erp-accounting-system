import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, getDoc } from '@angular/fire/firestore';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AdjustmentService {
  private adjustmentsCollection;

  constructor(private firestore: Firestore) {
    this.adjustmentsCollection = collection(this.firestore, 'stock-adjustments');
  }

  // Get real-time stock adjustments
  getStockAdjustments(): Observable<any[]> {
    return new Observable<any[]>(observer => {
      const unsubscribe = onSnapshot(this.adjustmentsCollection, (snapshot) => {
        const adjustments = snapshot.docs.map(doc => {
          return { id: doc.id, ...doc.data() };
        });
        observer.next(adjustments);
      }, error => {
        console.error('Error fetching stock adjustments:', error);
        observer.error(error);
      });
      
      // Return the unsubscribe function to clean up on component destroy
      return unsubscribe;
    });
  }

  // Get a single stock adjustment by ID
  getStockAdjustmentById(id: string): Observable<any> {
    const adjustmentDoc = doc(this.firestore, `stock-adjustments/${id}`);
    return from(getDoc(adjustmentDoc)).pipe(
      map(docSnap => {
        if (docSnap.exists()) {
          return { id: docSnap.id, ...docSnap.data() };
        } else {
          return null;
        }
      })
    );
  }


   async addStockAdjustment(adjustment: any): Promise<string> {
     try {
       const adjustmentToSave = {
         ...adjustment,

       date: adjustment.date, // Keep the user-selected date/time
         createdAt: new Date(),
         updatedAt: new Date()
       };
           console.log('Saving adjustment to Firestore:', {
        referenceNo: adjustmentToSave.referenceNo,
       userSelectedDate: adjustmentToSave.date,
       systemCreatedAt: adjustmentToSave.createdAt
     });
     
       const docRef = await addDoc(this.adjustmentsCollection, adjustmentToSave);
       return docRef.id;
     } catch (error) {
       console.error('Error adding stock adjustment:', error);
       throw error;
     }
   }

  // Update existing stock adjustment
  async updateStockAdjustment(adjustmentId: string, updatedData: any): Promise<void> {
    try {
      const adjustmentDoc = doc(this.firestore, `stock-adjustments/${adjustmentId}`);
      await updateDoc(adjustmentDoc, {
        ...updatedData,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error updating stock adjustment:', error);
      throw error;
    }
  }

  // Delete stock adjustment
  async deleteStockAdjustment(adjustmentId: string): Promise<void> {
    try {
      const adjustmentDoc = doc(this.firestore, `stock-adjustments/${adjustmentId}`);
      await deleteDoc(adjustmentDoc);
    } catch (error) {
      console.error('Error deleting stock adjustment:', error);
      throw error;
    }
  }

  // Alias for deleteStockAdjustment to support existing code
  delete(adjustmentId: string): Promise<void> {
    return this.deleteStockAdjustment(adjustmentId);
  }
}