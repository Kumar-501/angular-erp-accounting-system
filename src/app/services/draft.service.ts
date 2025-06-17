import { Injectable } from '@angular/core';
import { Firestore, collection, query, orderBy, onSnapshot, addDoc } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'  // Ensure that this is provided at the root level
})
export class DraftService {
  private draftCollection;

  constructor(private firestore: Firestore) {
    this.draftCollection = collection(this.firestore, 'drafts');
  }

  // Method to add a new draft to Firestore
  addDraft(draftData: any) {
    return addDoc(this.draftCollection, draftData); // Adds the draft data to Firestore
  }

  // Method to listen for real-time updates using onSnapshot()
  getDraftsRealTime(callback: (drafts: any[]) => void) {
    const draftQuery = query(this.draftCollection, orderBy('saleDate', 'desc')); // Optionally, order by saleDate
    onSnapshot(draftQuery, (snapshot) => {
      const drafts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(drafts); // Pass the drafts data to the callback function
    });
  }
}
