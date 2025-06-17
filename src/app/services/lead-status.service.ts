import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  DocumentData,
  doc,
  updateDoc,
  deleteDoc, 
  onSnapshot,
  QuerySnapshot
} from '@angular/fire/firestore';
import { Observable, from, BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class LeadStatusService {
  private readonly collectionName = 'leadStatuses';
  // BehaviorSubject to handle real-time updates
  private leadStatusesSubject = new BehaviorSubject<any[]>([]);
  leadStatuses$ = this.leadStatusesSubject.asObservable();

  constructor(private firestore: Firestore) {
    // Initialize real-time listener
    this.initLeadStatusListener();
  }

  // Add a new lead status to Firestore
  addLeadStatus(leadStatus: any): Promise<void> {
    const collectionRef = collection(this.firestore, this.collectionName);
    
    // Add a timestamp
    const leadStatusWithTimestamp = {
      ...leadStatus,
      createdAt: new Date(),
    };
    
    return addDoc(collectionRef, leadStatusWithTimestamp)
      .then(() => {
        console.log('Lead status added successfully');
      })
      .catch(error => {
        console.error('Error adding lead status: ', error);
        throw error;
      });
  }
// Add this method to LeadStatusService
deleteLeadStatus(id: string): Promise<void> {
  const docRef = doc(this.firestore, `${this.collectionName}/${id}`);
  
  return deleteDoc(docRef)
    .then(() => {
      console.log('Lead status deleted successfully');
    })
    .catch((error: Error) => {
      console.error('Error deleting lead status: ', error);
      throw error;
    });
}
  // Get all lead statuses from Firestore (one-time fetch)
  getLeadStatuses(): Observable<any[]> {
    const collectionRef = collection(this.firestore, this.collectionName);
    const q = query(collectionRef, orderBy('order', 'asc'));
    
    return from(getDocs(q)).pipe(
      map(snapshot => {
        return this.processLeadStatusDocs(snapshot);
      })
    );
  }

  // Update an existing lead status
  updateLeadStatus(id: string, changes: any): Promise<void> {
    const docRef = doc(this.firestore, `${this.collectionName}/${id}`);
    
    // Add updated timestamp
    const updatedData = {
      ...changes,
      updatedAt: new Date()
    };
    
    return updateDoc(docRef, updatedData)
      .then(() => {
        console.log('Lead status updated successfully');
      })
      .catch(error => {
        console.error('Error updating lead status: ', error);
        throw error;
      });
  }

  // Initialize real-time listener for lead statuses
  private initLeadStatusListener(): void {
    const collectionRef = collection(this.firestore, this.collectionName);
    const q = query(collectionRef, orderBy('order', 'asc'));
    
    // Set up real-time listener
    onSnapshot(q, (snapshot) => {
      const leadStatuses = this.processLeadStatusDocs(snapshot);
      this.leadStatusesSubject.next(leadStatuses);
    }, (error) => {
      console.error('Error listening to lead status changes:', error);
    });
  }

  // Helper method to process query snapshot
  private processLeadStatusDocs(snapshot: QuerySnapshot<DocumentData>): any[] {
    return snapshot.docs.map(doc => {
      const data = doc.data() as DocumentData;
      return {
        id: doc.id,
        ...data
      };
    });
  }
  
}