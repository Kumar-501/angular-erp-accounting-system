import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, collectionData, doc, updateDoc, deleteDoc, query, where, getDocs } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SalaryService {
  constructor(private firestore: Firestore) {}

  // Add a new salary record
  async addSalary(salaryData: any): Promise<string> {
    try {
      const salariesRef = collection(this.firestore, 'salaries');
      const docRef = await addDoc(salariesRef, salaryData);
      return docRef.id;
    } catch (error) {
      console.error('Error adding salary record:', error);
      throw error;
    }
  }

  // Get all salaries
  getSalaries(): Observable<any[]> {
    const salariesRef = collection(this.firestore, 'salaries');
    return collectionData(salariesRef, { idField: 'id' }) as Observable<any[]>;
  }

  // Get salaries by employee ID and month/year
  async getSalariesByEmployeeAndMonth(employeeId: string, monthYear: string): Promise<any[]> {
    try {
      const salariesRef = collection(this.firestore, 'salaries');
      const q = query(
        salariesRef, 
        where('id', '==', employeeId),
        where('monthYear', '==', monthYear)
      );
      
      const querySnapshot = await getDocs(q);
      const salaries: any[] = [];
      
      querySnapshot.forEach((doc) => {
        salaries.push({ id: doc.id, ...doc.data() });
      });
      
      return salaries;
    } catch (error) {
      console.error('Error getting salary records:', error);
      throw error;
    }
  }

  // Update a salary record
  async updateSalary(salaryId: string, updateData: any): Promise<void> {
    try {
      const salaryDocRef = doc(this.firestore, 'salaries', salaryId);
      return updateDoc(salaryDocRef, updateData);
    } catch (error) {
      console.error('Error updating salary record:', error);
      throw error;
    }
  }

  // Delete a salary record
  async deleteSalary(salaryId: string): Promise<void> {
    try {
      const salaryDocRef = doc(this.firestore, 'salaries', salaryId);
      return deleteDoc(salaryDocRef);
    } catch (error) {
      console.error('Error deleting salary record:', error);
      throw error;
    }
  }

  // Get salary records by payroll ID
  async getSalariesByPayrollId(payrollId: string): Promise<any[]> {
    try {
      const salariesRef = collection(this.firestore, 'salaries');
      const q = query(salariesRef, where('payrollId', '==', payrollId));
      
      const querySnapshot = await getDocs(q);
      const salaries: any[] = [];
      
      querySnapshot.forEach((doc) => {
        salaries.push({ id: doc.id, ...doc.data() });
      });
      
      return salaries;
    } catch (error) {
      console.error('Error getting salary records by payroll ID:', error);
      throw error;
    }
  }
}