import { Injectable, Inject } from '@angular/core';
import { Firestore, collection, addDoc, doc, updateDoc, deleteDoc, query, onSnapshot } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class DiscountService {
  private discountCollection;

  constructor(@Inject(Firestore) private firestore: Firestore) {
    this.discountCollection = collection(this.firestore, 'discounts'); // Changed to plural 'discounts' (recommended)
  }

  // Add a new discount to Firestore
  async addDiscount(discountData: any): Promise<{id: string}> {
    const docRef = await addDoc(this.discountCollection, discountData);
    return { id: docRef.id, ...discountData };
  }

  // Update an existing discount in Firestore
  async updateDiscount(id: string, discountData: any): Promise<void> {
    if (!id) throw new Error('No ID provided for update');
    const discountDocRef = doc(this.firestore, `discounts/${id}`);
    return updateDoc(discountDocRef, discountData);
  }

  // Delete a discount from Firestore
  async deleteDiscount(id: string): Promise<void> {
    if (!id) throw new Error('No ID provided for deletion');
    const discountDocRef = doc(this.firestore, `discounts/${id}`);
    return deleteDoc(discountDocRef);
  }

  // Get discounts in real-time using onSnapshot
  getDiscountsRealTime(): Observable<any[]> {
    const q = query(this.discountCollection);

    return new Observable<any[]>((observer) => {
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const discounts = snapshot.docs.map(doc => ({
            id: doc.id, // Always use 'id' as the primary identifier
            _originalDoc: doc.data(), // Store original data if needed
            ...doc.data()
          }));
          observer.next(discounts);
        },
        (error) => observer.error(error) // Handle errors properly
      );

      return () => unsubscribe();
    });
  }
}