import { Injectable } from '@angular/core';
import { Firestore, collection, collectionData, addDoc, deleteDoc, doc, updateDoc, onSnapshot, DocumentData, DocumentReference } from '@angular/fire/firestore';
import { map, Observable } from 'rxjs';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CategoriesService {
  private categoriesSubject = new BehaviorSubject<any[]>([]); // Create a BehaviorSubject to store the categories
  categories$ = this.categoriesSubject.asObservable(); // Observable to subscribe to the categories

  constructor(private firestore: Firestore) {
    this.fetchCategories(); // Start listening for real-time updates
  }

  // Fetch categories and listen for real-time updates
  private fetchCategories() {
    const categoriesCollection = collection(this.firestore, 'categories');
    onSnapshot(categoriesCollection, (snapshot) => {
      const categoriesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Ensure isSubCategory is properly set
        isSubCategory: !!doc.data()['parentCategory']
      }));
      this.categoriesSubject.next(categoriesData);
    });
  }
  getMainCategories(): Observable<any[]> {
    return this.categories$.pipe(
      map(categories => categories.filter(cat => !cat.isSubCategory))
    );
  }
  // Add a new category
  addCategory(category: any): Promise<DocumentReference<DocumentData>> {
    const categoriesCollection = collection(this.firestore, 'categories');
    return addDoc(categoriesCollection, category);
  }
  getSubCategoriesForParent(parentId: string): Observable<any[]> {
    return this.categories$.pipe(
      map(categories => categories.filter(cat => cat.parentCategory === parentId))
    );
  }

  // Delete a category
  deleteCategory(id: string): Promise<void> {
    const categoryDocRef = doc(this.firestore, `categories/${id}`);
    return deleteDoc(categoryDocRef);
  }

  // Update an existing category
  updateCategory(id: string, category: any): Promise<void> {
    const categoryDocRef = doc(this.firestore, `categories/${id}`);
    return updateDoc(categoryDocRef, category);
  }
   getCategories(): Observable<any[]> {
    return this.categories$;
  }
}