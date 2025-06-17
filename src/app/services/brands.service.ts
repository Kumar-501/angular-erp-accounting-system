import { Injectable } from '@angular/core';
import { Firestore, collection, collectionData, addDoc, deleteDoc, doc, updateDoc, onSnapshot, DocumentData, DocumentReference } from '@angular/fire/firestore';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Brand {
  id?: string; // Optional field
  name: string;
  description: string;
}

@Injectable({
  providedIn: 'root',
})
export class BrandsService {
  private brandsSubject = new BehaviorSubject<Brand[]>([]); // BehaviorSubject to hold brands data
  brands$ = this.brandsSubject.asObservable(); // Observable to subscribe to the brands data

  private brandsCollection;

  constructor(private firestore: Firestore) {
    this.brandsCollection = collection(this.firestore, 'brands'); // Initialize collection
    this.fetchBrands(); // Fetch brands in real-time
  }

  // Real-time data fetching using onSnapshot
  private fetchBrands() {
    onSnapshot(this.brandsCollection, (snapshot) => {
      const brandsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Brand[];
      this.brandsSubject.next(brandsData); // Push the data to the BehaviorSubject
    });
  }

  // Add new brand
  addBrand(brand: Brand): Promise<DocumentReference<DocumentData>> {
    // Ensure that the data passed to Firestore is in the correct format
    return addDoc(this.brandsCollection, brand as Record<string, any>);
  }

  // Delete a brand
  deleteBrand(id: string): Promise<void> {
    const brandDocRef = doc(this.firestore, `brands/${id}`);
    return deleteDoc(brandDocRef);
  }

  // Update a brand (Optional, if required)
  updateBrand(id: string, brand: Brand): Promise<void> {
    const brandDocRef = doc(this.firestore, `brands/${id}`);
    return updateDoc(brandDocRef, brand as Record<string, any>);
  }
   getBrands(): Observable<Brand[]> {
    return this.brands$;
  }

}
