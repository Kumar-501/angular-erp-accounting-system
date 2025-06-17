import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc } from '@angular/fire/firestore';
import { BehaviorSubject } from 'rxjs';

interface ExpenseCategory {
  id?: string;
  categoryName: string;
  categoryCode?: string;
  isSubCategory: boolean;
  parentCategory?: string;
  accountHead?: string;
  type?: string; // Add this for income/expense type
}

@Injectable({
  providedIn: 'root'
})
export class ExpenseCategoriesService {
  private expenseCategoriesCollection;
  private incomeCategoriesCollection;
  private expenseCategories = new BehaviorSubject<ExpenseCategory[]>([]);
  private incomeCategories = new BehaviorSubject<ExpenseCategory[]>([]);

  constructor(private firestore: Firestore) {
    this.expenseCategoriesCollection = collection(this.firestore, 'expense-categories');
    this.incomeCategoriesCollection = collection(this.firestore, 'income-categories');
    this.listenToExpenseCategories();
    this.listenToIncomeCategories();
  }

  // Add new category (expense or income)
  async addCategory(category: ExpenseCategory): Promise<void> {
    try {
      if (category.type === 'income') {
        await addDoc(this.incomeCategoriesCollection, category);
        console.log('Income Category Added Successfully!');
      } else {
        await addDoc(this.expenseCategoriesCollection, category);
        console.log('Expense Category Added Successfully!');
      }
    } catch (error) {
      console.error('Error adding category:', error);
    }
  }

  // Listen to Expense Categories Firestore changes in real-time
  private listenToExpenseCategories(): void {
    onSnapshot(this.expenseCategoriesCollection, (snapshot) => {
      const categories = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        type: 'expense'
      })) as ExpenseCategory[];
      
      this.expenseCategories.next(categories);
    });
  }

  // Listen to Income Categories Firestore changes in real-time
  private listenToIncomeCategories(): void {
    onSnapshot(this.incomeCategoriesCollection, (snapshot) => {
      const categories = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        type: 'income'
      })) as ExpenseCategory[];
      
      this.incomeCategories.next(categories);
    });
  }

  // Get expense categories as an observable
  getExpenseCategories() {
    return this.expenseCategories.asObservable();
  }

  // Get income categories as an observable
  getIncomeCategories() {
    return this.incomeCategories.asObservable();
  }

  // Get all categories (both expense and income) combined
  getCategories() {
    return new BehaviorSubject([
      ...this.expenseCategories.value,
      ...this.incomeCategories.value
    ]).asObservable();
  }

  // Delete category
  async deleteCategory(id: string, type: string): Promise<void> {
    try {
      if (type === 'income') {
        await deleteDoc(doc(this.firestore, 'income-categories', id));
        console.log('Income Category Deleted Successfully!');
      } else {
        await deleteDoc(doc(this.firestore, 'expense-categories', id));
        console.log('Expense Category Deleted Successfully!');
      }
    } catch (error) {
      console.error('Error deleting category:', error);
    }
  }

  // Update category
  async updateCategory(id: string, updatedCategory: Partial<ExpenseCategory>, originalType: string): Promise<void> {
    try {
      const newType = updatedCategory.type;
      
      // If type is changing, we need to delete from old collection and add to new collection
      if (originalType !== newType) {
        // Delete from original collection
        if (originalType === 'income') {
          await deleteDoc(doc(this.firestore, 'income-categories', id));
        } else {
          await deleteDoc(doc(this.firestore, 'expense-categories', id));
        }
        
        // Add to new collection
        const { id: _, ...categoryData } = updatedCategory as ExpenseCategory;
        await this.addCategory(categoryData);
      } else {
        // Same type, just update
        if (originalType === 'income') {
          await updateDoc(doc(this.firestore, 'income-categories', id), updatedCategory);
        } else {
          await updateDoc(doc(this.firestore, 'expense-categories', id), updatedCategory);
        }
      }
      
      console.log('Category Updated Successfully!');
    } catch (error) {
      console.error('Error updating category:', error);
    }
  }
}