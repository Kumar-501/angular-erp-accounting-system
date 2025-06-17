import { Injectable } from '@angular/core';
import { Firestore, collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, query, where } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

interface Modifier {
  id: string;
  modifierSet: string;
  modifiers: { name: string; price: number }[];
  products?: string;
}

@Injectable({
  providedIn: 'root',
})
export class ModifierService {
  constructor(private firestore: Firestore) {}

  async addModifier(modifierData: Omit<Modifier, 'id'>): Promise<void> {
    const modifierRef = doc(collection(this.firestore, 'modifiers'));
    await setDoc(modifierRef, modifierData);
  }

  getModifiers(): Observable<Modifier[]> {
    const modifiersCollection = collection(this.firestore, 'modifiers');
    return new Observable<Modifier[]>(observer => {
      const unsubscribe = onSnapshot(modifiersCollection, (snapshot) => {
        const modifiers = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data() as Omit<Modifier, 'id'>
        }));
        observer.next(modifiers);
      });
      
      return { unsubscribe };
    });
  }

  async updateModifier(id: string, modifierData: Partial<Modifier>): Promise<void> {
    const modifierRef = doc(this.firestore, 'modifiers', id);
    await updateDoc(modifierRef, modifierData);
  }

  async deleteModifier(id: string): Promise<void> {
    const modifierRef = doc(this.firestore, 'modifiers', id);
    await deleteDoc(modifierRef);
  }
}
