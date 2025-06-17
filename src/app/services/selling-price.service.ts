import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, collectionData, doc, updateDoc, deleteDoc, onSnapshot } from '@angular/fire/firestore';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SellingPriceService {
  private sellingPriceSubject = new BehaviorSubject<any[]>([]); // Observable to store selling price data
  sellingPrice$ = this.sellingPriceSubject.asObservable(); // Observable to access the data

  private sellingPriceCollection;

  constructor(private firestore: Firestore) {
    this.sellingPriceCollection = collection(this.firestore, 'selling-price');
    this.fetchSellingPrices(); // Initialize real-time data fetching
  }

  // Fetch real-time selling price data using onSnapshot
  private fetchSellingPrices() {
    onSnapshot(this.sellingPriceCollection, (snapshot) => {
      const sellingPriceData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      this.sellingPriceSubject.next(sellingPriceData); // Push new data to BehaviorSubject
    });
  }

  // Add a new selling price group
  addSellingPrice(priceGroup: any) {
    return addDoc(this.sellingPriceCollection, priceGroup);
  }

  // Update an existing selling price group
  updateSellingPrice(id: string, priceGroup: any) {
    const priceDoc = doc(this.firestore, `selling-price/${id}`);
    return updateDoc(priceDoc, priceGroup);
  }

  // Delete a selling price group
  deleteSellingPrice(id: string) {
    const priceDoc = doc(this.firestore, `selling-price/${id}`);
    return deleteDoc(priceDoc);
  }
}
