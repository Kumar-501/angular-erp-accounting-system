import { Injectable } from '@angular/core';
import { 
  Firestore,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
  getDocs,
  CollectionReference,
  serverTimestamp
} from '@angular/fire/firestore';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CustomerDataService {
  private customersSubject = new BehaviorSubject<any[]>([]);
  customers$ = this.customersSubject.asObservable();
  private salesSubject = new BehaviorSubject<any[]>([]);
  sales$ = this.salesSubject.asObservable();

  constructor(private firestore: Firestore) {
    this.setupRealTimeUpdates();
    this.setupSalesRealTimeUpdates();
  }

  private get convertCollection() {
    return collection(this.firestore, 'convert');
  }

  private get salesCollection() {
    return collection(this.firestore, 'sales');
  }

  private setupRealTimeUpdates() {
    try {
      const q = query(this.convertCollection);
      onSnapshot(q, (querySnapshot) => {
        const customers = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        this.customersSubject.next(customers);
      }, (error) => {
        console.error('Error setting up real-time updates:', error);
      });
    } catch (error) {
      console.error('Error in setupRealTimeUpdates:', error);
    }
  }

  private setupSalesRealTimeUpdates() {
    try {
      const q = query(this.salesCollection);
      onSnapshot(q, (querySnapshot) => {
        const sales = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        this.salesSubject.next(sales);
      }, (error) => {
        console.error('Error setting up sales real-time updates:', error);
      });
    } catch (error) {
      console.error('Error in setupSalesRealTimeUpdates:', error);
    }
  }

  async addCustomer(customerData: any) {
    try {
      const cleanData = this.sanitizeData(customerData);
      cleanData.createdAt = serverTimestamp();
      cleanData.updatedAt = serverTimestamp();
      
      const docRef = await addDoc(this.convertCollection, cleanData);
      console.log('Customer document written with ID: ', docRef.id);
      
      return { id: docRef.id, ...cleanData };
    } catch (error) {
      console.error('Error adding customer:', error);
      throw error;
    }
  }

  async addSale(saleData: any) {
    try {
      const cleanData = this.sanitizeData(saleData);
      cleanData.createdAt = serverTimestamp();
      cleanData.updatedAt = serverTimestamp();
      
      const docRef = await addDoc(this.salesCollection, cleanData);
      console.log('Sale document written with ID: ', docRef.id);
      
      return { id: docRef.id, ...cleanData };
    } catch (error) {
      console.error('Error adding sale:', error);
      throw error;
    }
  }

  async getCustomer(customerId: string) {
    try {
      const docRef = doc(this.firestore, 'convert', customerId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      } else {
        console.log('No such customer document!');
        return null;
      }
    } catch (error) {
      console.error('Error getting customer:', error);
      throw error;
    }
  }

  async getSale(saleId: string) {
    try {
      const docRef = doc(this.firestore, 'sales', saleId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      } else {
        console.log('No such sale document!');
        return null;
      }
    } catch (error) {
      console.error('Error getting sale:', error);
      throw error;
    }
  }

  async updateCustomer(customerId: string, updateData: any) {
    try {
      const docRef = doc(this.firestore, 'convert', customerId);
      const cleanData = this.sanitizeData(updateData);
      cleanData.updatedAt = serverTimestamp();
      
      await updateDoc(docRef, cleanData);
      console.log('Customer document updated successfully');
      return true;
    } catch (error) {
      console.error('Error updating customer:', error);
      throw error;
    }
  }

  async updateSale(saleId: string, updateData: any) {
    try {
      const docRef = doc(this.firestore, 'sales', saleId);
      const cleanData = this.sanitizeData(updateData);
      cleanData.updatedAt = serverTimestamp();
      
      await updateDoc(docRef, cleanData);
      console.log('Sale document updated successfully');
      return true;
    } catch (error) {
      console.error('Error updating sale:', error);
      throw error;
    }
  }

  async deleteCustomer(customerId: string) {
    try {
      const docRef = doc(this.firestore, 'convert', customerId);
      await deleteDoc(docRef);
      console.log('Customer document deleted successfully');
      return true;
    } catch (error) {
      console.error('Error deleting customer:', error);
      throw error;
    }
  }

  async deleteSale(saleId: string) {
    try {
      const docRef = doc(this.firestore, 'sales', saleId);
      await deleteDoc(docRef);
      console.log('Sale document deleted successfully');
      return true;
    } catch (error) {
      console.error('Error deleting sale:', error);
      throw error;
    }
  }

  async getCustomersByCondition(field: string, value: any) {
    try {
      const q = query(this.convertCollection, where(field, '==', value));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error querying customers:', error);
      throw error;
    }
  }

  async getSalesByCondition(field: string, value: any) {
    try {
      const q = query(this.salesCollection, where(field, '==', value));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error querying sales:', error);
      throw error;
    }
  }

  async getSalesByCustomer(customerId: string) {
    try {
      const q = query(this.salesCollection, where('customerId', '==', customerId));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error querying sales by customer:', error);
      throw error;
    }
  }

  private sanitizeData(data: any): any {
    const result: any = {};
    Object.keys(data).forEach(key => {
      if (data[key] !== undefined && data[key] !== null) {
        result[key] = data[key];
      }
    });
    return result;
  }
}