import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  doc,
  updateDoc,
  writeBatch,
  getDocs,
  query,
  where,
  orderBy
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LeaveService {
  constructor(private firestore: Firestore) {}
 
  getLeaveTypes(): Observable<any[]> {
    const leaveCollection = collection(this.firestore, 'leave-types');
    return new Observable(observer => {
      const unsubscribe = onSnapshot(leaveCollection, snapshot => {
        const leaves = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        observer.next(leaves);
      });
      return () => unsubscribe();
    });
  }
  async getLeaveActivities(leaveId: string): Promise<any[]> {
    try {
      const activitiesCollection = collection(this.firestore, 'leave-activities');
      const q = query(
        activitiesCollection, 
        where('leaveId', '==', leaveId),
        orderBy('timestamp', 'desc')
      );
      
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        return []; // Return empty array if no activities found
      }
      
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          leaveId: leaveId,
          action: data['action'] || 'status_change',
          status: data['status'] || data['newStatus'] || 'unknown',
          timestamp: data['timestamp']?.toDate() || new Date(),
          by: data['by'] || 'System',
          note: data['note'] || '',
          previousStatus: data['previousStatus'],
          newStatus: data['newStatus']
        };
      });
    } catch (error) {
      console.error('Error fetching activities:', error);
      throw error; // Re-throw to handle in component
    }
  }
  getLeaves(): Observable<any[]> {
    const leaveCollection = collection(this.firestore, 'leaves');
    return new Observable(observer => {
      const unsubscribe = onSnapshot(leaveCollection, snapshot => {
        const leaves = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        observer.next(leaves);
      });
      return () => unsubscribe();
    });
  }
  

// In your LeaveService
addLeave(leaveData: any): Promise<any> {
  // Ensure no undefined values
  const sanitizedData = {
    employeeName: leaveData.employeeName || '',
    leaveType: leaveData.leaveType || 'Annual',
    startDate: leaveData.startDate || new Date(),
    endDate: leaveData.endDate || leaveData.startDate || new Date(),
    reason: leaveData.reason || '',
    status: leaveData.status || 'pending',
    session: leaveData.session || 'Full Day',
    createdAt: leaveData.createdAt || new Date()
  };

  // Add to Firestore
  return addDoc(collection(this.firestore, 'leaves'), sanitizedData);
}

  async deleteLeave(id: string) {
    const leaveDocRef = doc(this.firestore, 'leaves', id);
    return await deleteDoc(leaveDocRef);
  }
  private formatActivityAction(activity: any): string {
    switch (activity.action) {
      case 'status_change':
        if (activity.newStatus === 'approved') return 'approved';
        if (activity.newStatus === 'rejected') return 'rejected';
        return 'status updated';
      case 'created': return 'created';
      case 'updated': return 'updated';
      default: return activity.action;
    }
  }
  
  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'approved': return 'bg-success';
      case 'rejected': return 'bg-danger';
      case 'pending': return 'bg-warning text-dark';
      default: return 'bg-secondary';
    }
  }
  
  getActivityIcon(action: string): string {
    switch (action) {
      case 'created': return 'bi-plus-circle';
      case 'approved': return 'bi-check-circle';
      case 'rejected': return 'bi-x-circle';
      case 'updated': return 'bi-pencil';
      default: return 'bi-clock-history';
    }
  }
  
  calculateLeaveDays(startDate: Date, endDate: Date, session: string): number {
    if (!startDate || !endDate) return 0;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Calculate difference in days
    const diffTime = Math.abs(end.getTime() - start.getTime());
    let days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both dates
    
    // Adjust for session
    if (session === 'First Half' || session === 'Second Half') {
      days = days - 0.5;
    }
    
    return days;
  }
  async updateLeaveStatus(
    id: string, 
    status: string, 
    note: string = '', 
    approvedBy: string = '',
    previousStatus: string = ''
  ) {
    const leaveDocRef = doc(this.firestore, 'leaves', id);
    const updateData: any = {
      status: status,
      note: note,
      updatedAt: new Date(),
    };
  
    if (status === 'approved' && approvedBy) {
      updateData.approvedBy = approvedBy;
      updateData.approvedAt = new Date();
    } else if (status === 'rejected' && approvedBy) {
      updateData.rejectedBy = approvedBy;
      updateData.rejectedAt = new Date();
    }
  
    await updateDoc(leaveDocRef, updateData);
    
    // Add activity log for status update
    const activityCollection = collection(this.firestore, 'leave-activities');
    await addDoc(activityCollection, {
      leaveId: id,
      action: 'status_change',
      previousStatus: previousStatus,
      newStatus: status,
      note: note,
      timestamp: new Date(),
      by: approvedBy || 'System',
      details: {
        approvedBy: status === 'approved' ? approvedBy : null,
        rejectedBy: status === 'rejected' ? approvedBy : null
      }
    });
  }

  async bulkApproveLeaves(leaveIds: string[], approvedBy: string, note: string = '') {
    // Use batch write for bulk operations
    const batch = writeBatch(this.firestore);
    const activityBatch = writeBatch(this.firestore);
    const activityCollection = collection(this.firestore, 'leave-activities');
    
    leaveIds.forEach(id => {
      const leaveDocRef = doc(this.firestore, 'leaves', id);
      batch.update(leaveDocRef, {
        status: 'approved',
        approvedBy: approvedBy,
        note: note,
        updatedAt: new Date()
      });
      
      // Create activity record
      const newActivityRef = doc(activityCollection);
      activityBatch.set(newActivityRef, {
        leaveId: id,
        action: 'approved',
        status: 'approved',
        note: note,
        timestamp: new Date(),
        by: approvedBy
      });
    });
    
    await batch.commit();
    await activityBatch.commit();
    return;
  }
  
  async bulkRejectLeaves(leaveIds: string[], rejectedBy: string, note: string = '') {
    // Use batch write for bulk operations
    const batch = writeBatch(this.firestore);
    const activityBatch = writeBatch(this.firestore);
    const activityCollection = collection(this.firestore, 'leave-activities');
    
    leaveIds.forEach(id => {
      const leaveDocRef = doc(this.firestore, 'leaves', id);
      batch.update(leaveDocRef, {
        status: 'rejected',
        rejectedBy: rejectedBy,
        note: note,
        updatedAt: new Date()
      });
      
      // Create activity record
      const newActivityRef = doc(activityCollection);
      activityBatch.set(newActivityRef, {
        leaveId: id,
        action: 'rejected',
        status: 'rejected',
        note: note,
        timestamp: new Date(),
        by: rejectedBy
      });
    });
    
    await batch.commit();
    await activityBatch.commit();
    return;
  }
  

}
