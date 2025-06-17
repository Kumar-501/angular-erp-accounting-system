import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, query, onSnapshot, doc, updateDoc, deleteDoc } from '@angular/fire/firestore';
import { inject } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CustomerGroupService {

  private firestore: Firestore;

  constructor() {
    this.firestore = inject(Firestore);  // Using inject() method to get Firestore instance
  }

  // Add Customer Group to Firestore
  async addCustomerGroup(customerGroup: any): Promise<void> {
    try {
      const customerGroupsRef = collection(this.firestore, 'customerGroups');
      await addDoc(customerGroupsRef, customerGroup);
      console.log('Customer Group added successfully!');
    } catch (error) {
      console.error('Error adding customer group: ', error);
    }
  }

  // Fetch all Customer Groups (Real-time updates using onSnapshot)
  getCustomerGroups(): Observable<any[]> {
    const customerGroupsRef = collection(this.firestore, 'customerGroups');
    const q = query(customerGroupsRef);
    return new Observable(observer => {
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const customerGroups: any[] = [];
        snapshot.forEach(doc => {
          customerGroups.push({ id: doc.id, ...doc.data() });
        });
        observer.next(customerGroups);
      });
      return () => unsubscribe();  // Cleanup when unsubscribed
    });
  }

  // Update Customer Group in Firestore
  async updateCustomerGroup(id: string, customerGroup: any): Promise<void> {
    try {
      const customerGroupRef = doc(this.firestore, 'customerGroups', id);
      await updateDoc(customerGroupRef, customerGroup);
      console.log('Customer Group updated successfully!');
    } catch (error) {
      console.error('Error updating customer group: ', error);
    }
  }

  // Delete Customer Group from Firestore
  async deleteCustomerGroup(id: string): Promise<void> {
    try {
      const customerGroupRef = doc(this.firestore, 'customerGroups', id);
      await deleteDoc(customerGroupRef);
      console.log('Customer Group deleted successfully!');
    } catch (error) {
      console.error('Error deleting customer group: ', error);
    }
  }
}
