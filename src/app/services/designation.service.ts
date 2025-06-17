import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  CollectionReference,
  DocumentData,
  DocumentReference
} from '@angular/fire/firestore';
import { BehaviorSubject, Observable } from 'rxjs';

// Define the interface for the Designation object
export interface Designation {
  id?: string;
  name: string;
  description?: string;
  department: string;  // Assuming you need a department field in designation
}

@Injectable({
  providedIn: 'root'
})
export class DesignationService {
  private collectionRef: CollectionReference<DocumentData>;
  private designationsSubject = new BehaviorSubject<Designation[]>([]);

  constructor(private firestore: Firestore) {
    this.collectionRef = collection(this.firestore, 'designations');
    this.listenToDesignations();
  }

  // Listen to changes in the designations collection and update the BehaviorSubject
  private listenToDesignations() {
    onSnapshot(this.collectionRef, snapshot => {
      const designations: Designation[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data() as Designation,  // Typecast the data to the Designation interface
      }));
      this.designationsSubject.next(designations);
    });
  }

  // Get the observable stream of designations
  getDesignations(): Observable<Designation[]> {
    return this.designationsSubject.asObservable();
  }

  // Add a new designation to Firestore
  addDesignation(data: Designation): Promise<DocumentReference<DocumentData>> {
    return addDoc(this.collectionRef, data);
  }

  // Update an existing designation in Firestore
  updateDesignation(id: string, data: Partial<Designation>): Promise<void> {
    const docRef = doc(this.firestore, `designations/${id}`);
    return updateDoc(docRef, data);
  }

  // Delete a designation from Firestore
  deleteDesignation(id: string): Promise<void> {
    const docRef = doc(this.firestore, `designations/${id}`);
    return deleteDoc(docRef);
  }
}
