import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PayrollService {
  constructor(private firestore: Firestore) {}
  async addPayroll(payrollData: any): Promise<string> {
    try {
      const payrollsRef = collection(this.firestore, 'payrolls');
      const docRef = await addDoc(payrollsRef, payrollData);
      return docRef.id;
    } catch (error: any) {  // Explicitly type error as 'any' or use a more specific type
      console.error('Error adding payroll:', error);
      throw error; // Re-throw the error to handle it in the component
    }
  }


  // Create new payroll
  async createPayroll(payroll: any): Promise<any> {
    try {
      const payrollsRef = collection(this.firestore, 'payrolls');
      const docRef = await addDoc(payrollsRef, payroll);
      return { id: docRef.id, ...payroll };
    } catch (error) {
      console.error('Error creating payroll:', error);
      throw error;
    }
  }

  // Update payroll
  async updatePayroll(id: string, data: any): Promise<void> {
    try {
      const payrollDocRef = doc(this.firestore, 'payrolls', id);
      await updateDoc(payrollDocRef, data);
    } catch (error) {
      console.error('Error updating payroll:', error);
      throw error;
    }
  }

  // Delete payroll
  async deletePayroll(id: string): Promise<void> {
    try {
      const payrollDocRef = doc(this.firestore, 'payrolls', id);
      await deleteDoc(payrollDocRef);
    } catch (error) {
      console.error('Error deleting payroll:', error);
      throw error;
    }
  }

  // Get real-time list of payrolls
  getPayrollsRealTime(): Observable<any[]> {
    return new Observable((observer) => {
      const payrollsRef = collection(this.firestore, 'payrolls');
      const q = query(payrollsRef, orderBy('createdAt', 'desc'));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const payrolls = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        observer.next(payrolls);
      }, (error) => {
        observer.error(error);
      });

      return () => unsubscribe();
    });
  }

  // For passing data between components
  private currentPayrollData: any;

  setCurrentPayrollData(data: any): void {
    this.currentPayrollData = data;
  }

  getCurrentPayrollData(): any {
    return this.currentPayrollData;
  }

  clearCurrentPayrollData(): void {
    this.currentPayrollData = null;
  }
}