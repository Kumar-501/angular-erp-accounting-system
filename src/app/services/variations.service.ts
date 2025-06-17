import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  addDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
  onSnapshot,
  DocumentData,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';

export interface Variation {
  id: string;
  name: string;
  values: string[];
  createdAt: Date;
}

@Injectable({
  providedIn: 'root',
})
export class VariationsService {
  constructor(private firestore: Firestore) {}

  // ✅ Get all variations (Real-time updates)
  getVariations(): Observable<Variation[]> {
    const variationsRef = collection(this.firestore, 'variations');
    const q = query(variationsRef, orderBy('createdAt', 'desc'));

    return new Observable<Variation[]>((observer) => {
      const unsubscribe = onSnapshot(
        q,
        (querySnapshot) => {
          const variations: Variation[] = [];
          querySnapshot.forEach((doc) => {
            const data = doc.data() as DocumentData;
            variations.push({
              id: doc.id,
              name: data['name'],
              values: data['values'],
              createdAt: data['createdAt']?.toDate(),
            });
          });
          observer.next(variations);
        },
        (error) => {
          observer.error(error);
        }
      );
      return () => unsubscribe();
    });
  }

  // ✅ Add a new variation
  async addVariation(variation: Omit<Variation, 'id' | 'createdAt'>): Promise<void> {
    const variationsRef = collection(this.firestore, 'variations');
    await addDoc(variationsRef, {
      name: variation.name,
      values: variation.values,
      createdAt: serverTimestamp(),
    });
  }

  // ✅ Delete a variation
  async deleteVariation(id: string): Promise<void> {
    const docRef = doc(this.firestore, 'variations', id);
    await deleteDoc(docRef);
  }

  // ✅ Update a variation (delete + recreate)
  async updateVariation(id: string, variation: Omit<Variation, 'id' | 'createdAt'>): Promise<void> {
    await this.deleteVariation(id);
    await this.addVariation(variation);
  }
}