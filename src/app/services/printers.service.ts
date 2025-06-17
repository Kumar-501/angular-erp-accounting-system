// src/app/services/printers.service.ts
import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, doc, setDoc, onSnapshot, collectionData } from '@angular/fire/firestore';
import { Inject } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class PrinterService {
  constructor(@Inject(Firestore) private firestore: Firestore) {}

  // Add a new printer to Firestore
  addPrinter(printerData: any) {
    const printersRef = collection(this.firestore, 'printers');
    return addDoc(printersRef, printerData);
  }

  // Update an existing printer in Firestore
  updatePrinter(printerId: string, printerData: any) {
    const printerDocRef = doc(this.firestore, 'printers', printerId);
    return setDoc(printerDocRef, printerData, { merge: true });
  }

  // Get all printers in real-time
  getPrintersRealTime(): Observable<any[]> {
    const printersRef = collection(this.firestore, 'printers');
    return new Observable((observer) => {
      const unsubscribe = onSnapshot(printersRef, (snapshot) => {
        const printersList: any[] = [];
        snapshot.forEach((doc) => {
          printersList.push({ id: doc.id, ...doc.data() });
        });
        observer.next(printersList);
      });

      // Cleanup on unsubscribe
      return () => unsubscribe();
    });
  }

  // Get a specific printer by ID
  getPrinterById(printerId: string): Observable<any> {
    const printerDocRef = doc(this.firestore, 'printers', printerId);
    return new Observable((observer) => {
      const unsubscribe = onSnapshot(printerDocRef, (docSnap) => {
        observer.next(docSnap.data());
      });

      return () => unsubscribe();
    });
  }
}
