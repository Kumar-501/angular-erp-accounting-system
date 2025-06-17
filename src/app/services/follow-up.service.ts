import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, doc, deleteDoc, updateDoc, onSnapshot, query, where } from '@angular/fire/firestore';
import { FollowUp } from '../models/follow-up.model';
import { Observable, BehaviorSubject } from 'rxjs';
import { TaskService } from './task.service';

@Injectable({
  providedIn: 'root'
})
export class FollowUpService {
  private followUpsSubject = new BehaviorSubject<FollowUp[]>([]);
  followUps$ = this.followUpsSubject.asObservable();
  
  // Add a private property to store the original follow-ups data
  private allFollowUps: FollowUp[] = [];
  
  private unsubscribe: (() => void) | undefined;
  
  constructor(
    private firestore: Firestore,
    private taskService: TaskService
  ) {
    this.getFollowUpsRealtime();
  }

  // Fixed method to return original follow-ups data
  getOriginalFollowUps(): FollowUp[] {
    // Return a copy of the cached follow-ups data
    return [...this.allFollowUps];
  }

  private mapDocumentToFollowUp(doc: any): FollowUp {
    const data = doc.data();
    return {
      id: doc.id,
      title: data['title'] || '',
      status: data['status'] || 'Pending',
      description: data['description'] || '',
      customerLead: data['customerLead'] || '',
      startDatetime: data['startDatetime'] || '',
      endDatetime: data['endDatetime'] || '',
      followUpType: data['followUpType'] || '',
      followupCategory: data['followupCategory'] || '',
      assignedTo: data['assignedTo'] || '',
      additionalInfo: data['additionalInfo'] || '',
      addedBy: data['addedBy'] || '',
      addedOn: data['addedOn'] || '',
      createdAt: data['createdAt'] || '',
      updatedAt: data['updatedAt'] || '',
      sendNotification: data['sendNotification'] || false
    };
  }

  addFollowUp(followUp: FollowUp) {
    const followUpsRef = collection(this.firestore, 'followUps');
    const followUpWithTimestamp = {
      ...followUp,
      createdAt: new Date().toISOString(),
      addedOn: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    return addDoc(followUpsRef, followUpWithTimestamp);
  }
  
  // New method to add a follow up log
  addFollowUpLog(followUpLog: any) {
    // Convert the log to a follow up object
    const followUpFromLog: FollowUp = {
      title: followUpLog.subject,
      status: followUpLog.status,
      description: followUpLog.description,
      customerLead: followUpLog.customerLead,
      startDatetime: followUpLog.startDatetime,
      endDatetime: followUpLog.endDatetime,
      followUpType: followUpLog.logType,
      followupCategory: 'General', // Default category for logs
      assignedTo: followUpLog.assignedTo,
      additionalInfo: 'Created from follow up log',
      addedBy: '', // Will be set by service
      sendNotification: false
    };

    // Use the existing addFollowUp method
    return this.addFollowUp(followUpFromLog);
  }

  getFollowUpsByLeadId(leadId: string): Promise<FollowUp[]> {
    const followUpsRef = collection(this.firestore, 'followUps');
    const q = query(followUpsRef, where('customerLead', '==', leadId));
    
    return new Promise<FollowUp[]>((resolve, reject) => {
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const followUps: FollowUp[] = [];
        snapshot.forEach((doc) => {
          followUps.push(this.mapDocumentToFollowUp(doc));
        });
        resolve(followUps);
      }, (error) => {
        reject(error);
      });
    });
  }

  getFollowUpsRealtime() {
    const followUpsRef = collection(this.firestore, 'followUps');
    
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    
    this.unsubscribe = onSnapshot(followUpsRef, (snapshot) => {
      const followUps: FollowUp[] = [];
      snapshot.forEach((doc) => {
        followUps.push(this.mapDocumentToFollowUp(doc));
      });
      
      // Sort by startDatetime (ascending)
      followUps.sort((a, b) => {
        const dateA = a.startDatetime ? new Date(a.startDatetime).getTime() : 0;
        const dateB = b.startDatetime ? new Date(b.startDatetime).getTime() : 0;
        return dateA - dateB;
      });
      
      // Store the full list of follow-ups in the allFollowUps property
      this.allFollowUps = [...followUps];
      
      // Update the BehaviorSubject
      this.followUpsSubject.next(followUps);
    }, (error) => {
      console.error('Error getting real-time updates:', error);
    });
  }
  
  getFollowUps(): Observable<FollowUp[]> {
    return this.followUps$;
  }

  deleteFollowUp(id: string): Promise<void> {
    const followUpDoc = doc(this.firestore, `followUps/${id}`);
    return deleteDoc(followUpDoc);
  }

  updateFollowUp(id: string, data: Partial<FollowUp>): Promise<void> {
    const followUpDoc = doc(this.firestore, `followUps/${id}`);
    const updatedData = {
      ...data,
      updatedAt: new Date().toISOString()
    };
    return updateDoc(followUpDoc, updatedData);
  }

  cleanup() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  getFollowUpsByStatus(status: string): Promise<FollowUp[]> {
    const followUpsRef = collection(this.firestore, 'followUps');
    const q = query(followUpsRef, where('status', '==', status));
    
    return new Promise<FollowUp[]>((resolve, reject) => {
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const followUps: FollowUp[] = [];
        snapshot.forEach((doc) => {
          followUps.push(this.mapDocumentToFollowUp(doc));
        });
        resolve(followUps);
      }, (error) => {
        reject(error);
      });
    });
  }

  getFollowUpsByAssignedTo(userId: string): Promise<FollowUp[]> {
    const followUpsRef = collection(this.firestore, 'followUps');
    const q = query(followUpsRef, where('assignedTo', '==', userId));
    
    return new Promise<FollowUp[]>((resolve, reject) => {
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const followUps: FollowUp[] = [];
        snapshot.forEach((doc) => {
          followUps.push(this.mapDocumentToFollowUp(doc));
        });
        resolve(followUps);
      }, (error) => {
        reject(error);
      });
    });
  }

  getUpcomingFollowUps(): Promise<FollowUp[]> {
    const followUpsRef = collection(this.firestore, 'followUps');
    const now = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(now.getDate() + 7);
    
    const q = query(
      followUpsRef,
      where('startDatetime', '>=', now.toISOString()),
      where('startDatetime', '<=', nextWeek.toISOString())
    );
    
    return new Promise<FollowUp[]>((resolve, reject) => {
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const followUps: FollowUp[] = [];
        snapshot.forEach((doc) => {
          followUps.push(this.mapDocumentToFollowUp(doc));
        });
        resolve(followUps);
      }, (error) => {
        reject(error);
      });
    });
  }
}