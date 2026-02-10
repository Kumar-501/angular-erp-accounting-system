import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject } from 'rxjs';
import { take } from 'rxjs/operators';
import { 
  Firestore, 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  where, 
  getDocs,
  DocumentData,
  QuerySnapshot,
  DocumentSnapshot
} from '@angular/fire/firestore';

export interface FollowupCategory {
  id?: string;
  name: string;
  description: string;
  createdAt?: Date;
  updatedAt?: Date;
}

@Injectable({
  providedIn: 'root'
})
export class FollowupCategoryService {
  private collectionName = 'followup-categories';
  private categoriesSubject = new BehaviorSubject<FollowupCategory[]>([]);
  private unsubscribe: (() => void) | null = null;

  constructor(private firestore: Firestore) {
    this.initializeSnapshot();
  }

  // Initialize real-time listener using onSnapshot
  private initializeSnapshot(): void {
    const categoriesCollection = collection(this.firestore, this.collectionName);
    const q = query(categoriesCollection, orderBy('name', 'asc'));
    
    this.unsubscribe = onSnapshot(q, 
      (snapshot: QuerySnapshot<DocumentData>) => {
        const categories: FollowupCategory[] = [];
        snapshot.forEach((doc: DocumentSnapshot<DocumentData>) => {
          const data = doc.data();
          if (data) {
            categories.push({
              id: doc.id,
              name: data['name'],
              description: data['description'],
              createdAt: data['createdAt']?.toDate(),
              updatedAt: data['updatedAt']?.toDate()
            });
          }
        });
        this.categoriesSubject.next(categories);
      },
      (error: Error) => {
        console.error('Error listening to categories:', error);
        this.categoriesSubject.error(error);
      }
    );
  }

  // Get observable of all follow-up categories
  getFollowupCategories(): Observable<FollowupCategory[]> {
    return this.categoriesSubject.asObservable();
  }

  // Get current categories value (synchronous)
  getCurrentCategories(): FollowupCategory[] {
    return this.categoriesSubject.value;
  }

  // Get categories as Promise (for backward compatibility)
  async getFollowupCategoriesAsPromise(): Promise<FollowupCategory[]> {
    return this.categoriesSubject.pipe(take(1)).toPromise() as Promise<FollowupCategory[]>;
  }

  // Add a new follow-up category
  async addFollowupCategory(category: Omit<FollowupCategory, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const categoriesCollection = collection(this.firestore, this.collectionName);
      const docData = {
        name: category.name,
        description: category.description,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const docRef = await addDoc(categoriesCollection, docData);
      return docRef.id;
    } catch (error) {
      console.error('Error adding category:', error);
      throw new Error('Failed to add category');
    }
  }

  // Update an existing follow-up category
  async updateFollowupCategory(category: FollowupCategory): Promise<void> {
    if (!category.id) {
      throw new Error('Category ID is required for update');
    }

    try {
      const docRef = doc(this.firestore, this.collectionName, category.id);
      const updateData = {
        name: category.name,
        description: category.description,
        updatedAt: new Date()
      };
      
      await updateDoc(docRef, updateData);
    } catch (error) {
      console.error('Error updating category:', error);
      throw new Error('Failed to update category');
    }
  }

  // Delete a follow-up category
  async deleteFollowupCategory(id: string): Promise<void> {
    if (!id) {
      throw new Error('Category ID is required for deletion');
    }

    try {
      const docRef = doc(this.firestore, this.collectionName, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting category:', error);
      throw new Error('Failed to delete category');
    }
  }

  // Clear all categories (useful for testing)
  async clearAllCategories(): Promise<void> {
    try {
      const categoriesCollection = collection(this.firestore, this.collectionName);
      const snapshot = await getDocs(categoriesCollection);
      
      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
    } catch (error) {
      console.error('Error clearing categories:', error);
      throw new Error('Failed to clear categories');
    }
  }

  // Get category by ID
  async getCategoryById(id: string): Promise<FollowupCategory | null> {
    try {
      const categories = this.getCurrentCategories();
      return categories.find(c => c.id === id) || null;
    } catch (error) {
      console.error('Error getting category by ID:', error);
      return null;
    }
  }

  // Check if category name already exists (for validation)
  async categoryNameExists(name: string, excludeId?: string): Promise<boolean> {
    try {
      const categoriesCollection = collection(this.firestore, this.collectionName);
      const q = query(categoriesCollection, where('name', '==', name));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        return false;
      }
      
      // If we're excluding an ID (during edit), check if any other document has this name
      if (excludeId) {
        return snapshot.docs.some(doc => doc.id !== excludeId);
      }
      
      return !snapshot.empty;
    } catch (error) {
      console.error('Error checking category name:', error);
      return false;
    }
  }

  // Clean up subscription when service is destroyed
  ngOnDestroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }
}