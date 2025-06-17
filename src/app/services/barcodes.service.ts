import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, onSnapshot, doc, deleteDoc } from '@angular/fire/firestore';
import { inject } from '@angular/core'; // Needed for new Firebase SDK injection
import { BehaviorSubject, Observable } from 'rxjs'; // Import Observable here

@Injectable({
  providedIn: 'root'
})
export class BarcodesService {
  
  private firestore: Firestore;
  private barcodesSubject = new BehaviorSubject<any[]>([]); // A BehaviorSubject to store real-time data

  constructor() {
    // Initialize Firestore
    this.firestore = inject(Firestore); // Inject Firestore using the new SDK (v9+)
    this.listenForBarcodeChanges(); // Start listening for real-time updates
  }

  // Method to save barcode settings to Firestore
  saveBarcodeSettings(barcodeSettings: any): Promise<any> {
    const barcodesCollection = collection(this.firestore, 'barcodes');
    return addDoc(barcodesCollection, barcodeSettings);
  }

  // Listen for real-time updates to the 'barcodes' collection
  listenForBarcodeChanges() {
    const barcodesCollection = collection(this.firestore, 'barcodes');
    
    // Listen for real-time changes to the collection
    onSnapshot(barcodesCollection, (snapshot) => {
      const barcodesList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Push the updated list to the BehaviorSubject
      this.barcodesSubject.next(barcodesList);
    });
  }

  // Get the real-time barcodes data as an observable
  getBarcodes(): Observable<any[]> {
    return this.barcodesSubject.asObservable();
  }

  // Method to delete a barcode setting from Firestore
  deleteBarcode(barcodeId: string): Promise<void> {
    const barcodeDocRef = doc(this.firestore, 'barcodes', barcodeId);  // Get reference to the barcode document
    return deleteDoc(barcodeDocRef); // Delete the document from Firestore
  }
}
