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
  providedIn: 'root'
})
export class FollowupCategoryService {
  
  private firestore: Firestore = inject(Firestore);
  
  private followupCategoryCollection = collection(this.firestore, 'followupCategories');
  
  constructor() { }
  
  // Add a new Follow-up Category to Firestore
  addFollowupCategory(category: { name: string; description: string }): Promise<DocumentData> {
    return addDoc(this.followupCategoryCollection, category);
  }
  
  // Get all follow-up categories from Firestore
  async getFollowupCategories(): Promise<any[]> {
    const snapshot = await getDocs(this.followupCategoryCollection);
    return snapshot.docs.map(doc => {
      return {
        id: doc.id,
        ...doc.data()
      };
    });
  }
  
  // Update an existing follow-up category
  async updateFollowupCategory(category: { id: string; name: string; description: string }): Promise<void> {
    const { id, ...data } = category;
    const docRef = doc(this.firestore, 'followupCategories', id);
    return updateDoc(docRef, data);
  }
  
  // Delete a follow-up category
  async deleteFollowupCategory(id: string): Promise<void> {
    const docRef = doc(this.firestore, 'followupCategories', id);
    return deleteDoc(docRef);
  }
}