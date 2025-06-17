import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  CollectionReference,
  DocumentData,
  DocumentReference
} from '@angular/fire/firestore';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DepartmentService {
  private collectionRef: CollectionReference<DocumentData>;
  private departmentsSubject = new BehaviorSubject<any[]>([]);

  constructor(private firestore: Firestore) {
    this.collectionRef = collection(this.firestore, 'departments');
    this.listenToDepartments();
  }

  private listenToDepartments() {
    onSnapshot(this.collectionRef, snapshot => {
      const departments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      this.departmentsSubject.next(departments);
    });
  }

  // Get observable of departments
  getDepartments() {
    return this.departmentsSubject.asObservable();
  }

  // Add department
  addDepartment(data: any) {
    return addDoc(this.collectionRef, data);
  }

  // Update department by ID
  updateDepartment(id: string, data: any) {
    const docRef = doc(this.firestore, `departments/${id}`);  // Fixed: use backticks to create the correct path
    return updateDoc(docRef, data);
  }

  // Delete department by ID
  deleteDepartment(id: string) {
    const docRef = doc(this.firestore, `departments/${id}`);  // Fixed: use backticks to create the correct path
    return deleteDoc(docRef);
  }
}
