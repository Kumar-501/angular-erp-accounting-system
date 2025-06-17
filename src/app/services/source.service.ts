// source.service.ts
import { Injectable } from '@angular/core';
import { 
  Firestore, 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  CollectionReference, 
  DocumentData 
} from '@angular/fire/firestore';
import { inject } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class SourceService {
  private firestore: Firestore = inject(Firestore);
  private sourceCollection = collection(this.firestore, 'sources');

  constructor() {}

  // Add a new source to Firestore
  addSource(source: { name: string; description: string }): Promise<DocumentData> {
    return addDoc(this.sourceCollection, source);
  }

  // Get all sources from Firestore
  getSources(): Promise<DocumentData[]> {
    return getDocs(this.sourceCollection).then(snapshot => {
      return snapshot.docs.map(doc => {
        return { id: doc.id, ...doc.data() };
      });
    });
  }

  // Update a source in Firestore
  updateSource(id: string, data: { name: string; description: string }): Promise<void> {
    const docRef = doc(this.firestore, 'sources', id);
    return updateDoc(docRef, data);
  }

  // Delete a source from Firestore
  deleteSource(id: string): Promise<void> {
    const docRef = doc(this.firestore, 'sources', id);
    return deleteDoc(docRef);
  }
}