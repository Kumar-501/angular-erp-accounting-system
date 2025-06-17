import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  CollectionReference,
  DocumentData
} from '@angular/fire/firestore';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LeaveTypeService {
  private collectionRef: CollectionReference<DocumentData>;
  private leaveTypesSubject = new BehaviorSubject<any[]>([]);

  constructor(private firestore: Firestore) {
    this.collectionRef = collection(this.firestore, 'leave-types');
    this.listenToLeaveTypes();
  }

  private listenToLeaveTypes() {
    onSnapshot(this.collectionRef, snapshot => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      this.leaveTypesSubject.next(data);
    });
  }

  getLeaveTypes() {
    return this.leaveTypesSubject.asObservable();
  }

  addLeaveType(data: any) {
    return addDoc(this.collectionRef, data);
  }

  updateLeaveType(id: string, data: any) {
    const docRef = doc(this.firestore, `leave-types/${id}`);
    return updateDoc(docRef, data);
  }

  deleteLeaveType(id: string) {
    const docRef = doc(this.firestore, `leave-types/${id}`);
    return deleteDoc(docRef);
  }
}