import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, deleteDoc, doc, updateDoc, Timestamp, onSnapshot } from '@angular/fire/firestore';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class WarrantiesService {
  private warrantiesSubject = new BehaviorSubject<any[]>([]);
  warranties$ = this.warrantiesSubject.asObservable();

  constructor(private firestore: Firestore) {
    this.fetchWarranties(); // Automatically start listening to Firestore changes
  }

  // Fetch warranties in real-time
  fetchWarranties() {
    const warrantiesRef = collection(this.firestore, 'warranties');

    onSnapshot(warrantiesRef, (snapshot) => {
      const warrantiesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      this.warrantiesSubject.next(warrantiesData);
    });
  }

  // Add warranty
  async addWarranty(warranty: any): Promise<void> {
    const warrantiesRef = collection(this.firestore, 'warranties');
    await addDoc(warrantiesRef, {
      ...warranty,
      createdAt: Timestamp.now()
    });
  }

  // Update warranty
  async updateWarranty(id: string, warranty: any): Promise<void> {
    const warrantyDoc = doc(this.firestore, `warranties/${id}`);
    await updateDoc(warrantyDoc, warranty);
  }

  // Delete warranty
  async deleteWarranty(id: string): Promise<void> {
    const warrantyDoc = doc(this.firestore, `warranties/${id}`);
    await deleteDoc(warrantyDoc);
  }
}