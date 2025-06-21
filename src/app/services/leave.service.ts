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
  orderBy,
  getDoc,
  Timestamp
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';

// Interfaces for type safety
export interface LeaveApplication {
  id?: string;
  userId: string;
  leaveTypeId: string;
  employeeName: string;
  leaveType: string;
  startDate: Date;
  endDate: Date;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  session: 'Full Day' | 'First Half' | 'Second Half';
  daysTaken: number;
  createdAt: Date;
  updatedAt: Date;
  approvedBy?: string;
  rejectedBy?: string;
  approvedAt?: Date;
  rejectedAt?: Date;
  note?: string;
  maxLeaveCount?: number;
}

export interface UserLeaveBalance {
  id?: string;
  userId: string;
  leaveTypeId: string;
  allocated: number;
  used: number;
  remaining: number;
  year: number;
}

export interface LeaveActivity {
  id?: string;
  leaveId: string;
  action: string;
  status: string;
  timestamp: Date;
  by: string;
  note: string;
  previousStatus?: string;
  newStatus?: string;
  details?: any;
}

export interface LeaveType {
  id?: string;
  name: string;
  description?: string;
  maxDays: number;
  carryForward: boolean;
  active: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class LeaveService {
  constructor(private firestore: Firestore) {}

  // Leave Types Management
  getLeaveTypes(): Observable<LeaveType[]> {
    const leaveCollection = collection(this.firestore, 'leave-types');
    return new Observable(observer => {
      const unsubscribe = onSnapshot(leaveCollection, snapshot => {
        const leaves = snapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        } as LeaveType));
        observer.next(leaves);
      }, error => {
        console.error('Error fetching leave types:', error);
        observer.error(error);
      });
      return () => unsubscribe();
    });
  }

  async addLeaveType(leaveType: Omit<LeaveType, 'id'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(this.firestore, 'leave-types'), {
        ...leaveType,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error adding leave type:', error);
      throw error;
    }
  }

  async updateLeaveType(id: string, updates: Partial<LeaveType>): Promise<void> {
    try {
      const leaveTypeRef = doc(this.firestore, 'leave-types', id);
      await updateDoc(leaveTypeRef, {
        ...updates,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error updating leave type:', error);
      throw error;
    }
  }

  async deleteLeaveType(id: string): Promise<void> {
    try {
      const leaveTypeRef = doc(this.firestore, 'leave-types', id);
      await deleteDoc(leaveTypeRef);
    } catch (error) {
      console.error('Error deleting leave type:', error);
      throw error;
    }
  }

  // Leave Activities Management
  async getLeaveActivities(leaveId: string): Promise<LeaveActivity[]> {
    try {
      const activitiesCollection = collection(this.firestore, 'leave-activities');
      const q = query(
        activitiesCollection, 
        where('leaveId', '==', leaveId),
        orderBy('timestamp', 'desc')
      );
      
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        return [];
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
          newStatus: data['newStatus'],
          details: data['details']
        } as LeaveActivity;
      });
    } catch (error) {
      console.error('Error fetching activities:', error);
      throw error;
    }
  }

  async addLeaveActivity(activity: Omit<LeaveActivity, 'id' | 'timestamp'>): Promise<void> {
    try {
      const activityCollection = collection(this.firestore, 'leave-activities');
      await addDoc(activityCollection, {
        ...activity,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error adding leave activity:', error);
      throw error;
    }
  }

  // User Leave Balance Management
  async getUserLeaveBalance(userId: string, leaveTypeId: string): Promise<UserLeaveBalance | null> {
    try {
      const balanceCollection = collection(this.firestore, 'user-leave-balances');
      const q = query(
        balanceCollection,
        where('userId', '==', userId),
        where('leaveTypeId', '==', leaveTypeId)
      );
      
      const snapshot = await getDocs(q);
      return snapshot.empty ? null : { 
        id: snapshot.docs[0].id,
        ...snapshot.docs[0].data() 
      } as UserLeaveBalance;
    } catch (error) {
      console.error('Error fetching user leave balance:', error);
      throw error;
    }
  }

  async getUserLeaveBalances(userId: string): Promise<UserLeaveBalance[]> {
    try {
      const balanceCollection = collection(this.firestore, 'user-leave-balances');
      const q = query(balanceCollection, where('userId', '==', userId));
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as UserLeaveBalance));
    } catch (error) {
      console.error('Error fetching user leave balances:', error);
      throw error;
    }
  }

  async updateUserLeaveBalance(userId: string, leaveTypeId: string, updates: Partial<UserLeaveBalance>): Promise<void> {
    try {
      const balanceCollection = collection(this.firestore, 'user-leave-balances');
      const q = query(
        balanceCollection,
        where('userId', '==', userId),
        where('leaveTypeId', '==', leaveTypeId)
      );
      
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const balanceRef = snapshot.docs[0].ref;
        await updateDoc(balanceRef, {
          ...updates,
          updatedAt: new Date()
        });
      }
    } catch (error) {
      console.error('Error updating user leave balance:', error);
      throw error;
    }
  }

  async initializeUserLeaveBalance(balance: Omit<UserLeaveBalance, 'id'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(this.firestore, 'user-leave-balances'), {
        ...balance,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error initializing user leave balance:', error);
      throw error;
    }
  }

  // Leave Application Management
  async applyForLeave(application: Omit<LeaveApplication, 'id' | 'status' | 'createdAt' | 'updatedAt'>): Promise<{ success: boolean; message?: string }> {
    try {
      // Check if user has this leave type
      const balance = await this.getUserLeaveBalance(application.userId, application.leaveTypeId);
      
      if (!balance) {
        return { success: false, message: 'You do not have access to this leave type' };
      }
      
      // Check if sufficient balance
      if (balance.remaining < application.daysTaken) {
        return { 
          success: false, 
          message: `Insufficient balance. You have ${balance.remaining} days remaining but requested ${application.daysTaken} days` 
        };
      }
      
      // Start transaction
      const batch = writeBatch(this.firestore);
      
      // 1. Add leave application
      const leaveCollection = collection(this.firestore, 'leave-applications');
      const leaveRef = doc(leaveCollection);
      batch.set(leaveRef, {
        ...application,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      // 2. Update leave balance (reserve the days)
      const balanceCollection = collection(this.firestore, 'user-leave-balances');
      const balanceQuery = query(
        balanceCollection,
        where('userId', '==', application.userId),
        where('leaveTypeId', '==', application.leaveTypeId)
      );
      
      const balanceSnapshot = await getDocs(balanceQuery);
      if (balanceSnapshot.empty) {
        return { success: false, message: 'Leave balance record not found' };
      }
      
      const balanceDoc = balanceSnapshot.docs[0];
      const currentBalance = balanceDoc.data() as UserLeaveBalance;
      
      batch.update(balanceDoc.ref, {
        remaining: currentBalance.remaining - application.daysTaken,
        used: currentBalance.used + application.daysTaken,
        updatedAt: new Date()
      });

      // 3. Add initial activity
      const activityCollection = collection(this.firestore, 'leave-activities');
      const activityRef = doc(activityCollection);
      batch.set(activityRef, {
        leaveId: leaveRef.id,
        action: 'created',
        status: 'pending',
        timestamp: new Date(),
        by: application.employeeName || 'User',
        note: 'Leave application submitted'
      });
      
      await batch.commit();
      return { success: true };
    } catch (error) {
      console.error('Error applying for leave:', error);
      return { success: false, message: 'Failed to apply for leave' };
    }
  }

  async getLeaveApplication(id: string): Promise<LeaveApplication | null> {
    try {
      const leaveRef = doc(this.firestore, 'leave-applications', id);
      const snapshot = await getDoc(leaveRef);
      
      if (!snapshot.exists()) {
        return null;
      }
      
      const data = snapshot.data();
      return {
        id: snapshot.id,
        ...data,
        startDate: data['startDate']?.toDate() || new Date(),
        endDate: data['endDate']?.toDate() || new Date(),
        createdAt: data['createdAt']?.toDate() || new Date(),
        updatedAt: data['updatedAt']?.toDate() || new Date(),
        approvedAt: data['approvedAt']?.toDate(),
        rejectedAt: data['rejectedAt']?.toDate()
      } as LeaveApplication;
    } catch (error) {
      console.error('Error fetching leave application:', error);
      throw error;
    }
  }

  getLeaveApplications(): Observable<LeaveApplication[]> {
    const leaveCollection = collection(this.firestore, 'leave-applications');
    const q = query(leaveCollection, orderBy('createdAt', 'desc'));
    
    return new Observable(observer => {
      const unsubscribe = onSnapshot(q, snapshot => {
        const leaves = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            startDate: data['startDate']?.toDate() || new Date(),
            endDate: data['endDate']?.toDate() || new Date(),
            createdAt: data['createdAt']?.toDate() || new Date(),
            updatedAt: data['updatedAt']?.toDate() || new Date(),
            approvedAt: data['approvedAt']?.toDate(),
            rejectedAt: data['rejectedAt']?.toDate()
          } as LeaveApplication;
        });
        observer.next(leaves);
      }, error => {
        console.error('Error fetching leave applications:', error);
        observer.error(error);
      });
      return () => unsubscribe();
    });
  }

  async approveLeave(leaveId: string, approvedBy: string, note: string = ''): Promise<void> {
    try {
      const leaveRef = doc(this.firestore, 'leave-applications', leaveId);
      await updateDoc(leaveRef, {
        status: 'approved',
        updatedAt: new Date(),
        approvedBy,
        approvedAt: new Date(),
        note
      });

      // Add activity log
      await this.addLeaveActivity({
        leaveId,
        action: 'status_change',
        status: 'approved',
        by: approvedBy,
        note: note || 'Leave approved',
        newStatus: 'approved',
        previousStatus: 'pending'
      });
    } catch (error) {
      console.error('Error approving leave:', error);
      throw error;
    }
  }

  async rejectLeave(leaveId: string, rejectedBy: string, note: string = ''): Promise<void> {
    try {
      // Get leave application details first
      const leaveApp = await this.getLeaveApplication(leaveId);
      if (!leaveApp) {
        throw new Error('Leave application not found');
      }

      const batch = writeBatch(this.firestore);

      // 1. Update leave status
      const leaveRef = doc(this.firestore, 'leave-applications', leaveId);
      batch.update(leaveRef, {
        status: 'rejected',
        updatedAt: new Date(),
        rejectedBy,
        rejectedAt: new Date(),
        note
      });

      // 2. Restore leave balance
      const balanceCollection = collection(this.firestore, 'user-leave-balances');
      const balanceQuery = query(
        balanceCollection,
        where('userId', '==', leaveApp.userId),
        where('leaveTypeId', '==', leaveApp.leaveTypeId)
      );
      
      const balanceSnapshot = await getDocs(balanceQuery);
      if (!balanceSnapshot.empty) {
        const balanceDoc = balanceSnapshot.docs[0];
        const currentBalance = balanceDoc.data() as UserLeaveBalance;
        
        batch.update(balanceDoc.ref, {
          remaining: currentBalance.remaining + leaveApp.daysTaken,
          used: currentBalance.used - leaveApp.daysTaken,
          updatedAt: new Date()
        });
      }

      // 3. Add activity log
      const activityCollection = collection(this.firestore, 'leave-activities');
      const activityRef = doc(activityCollection);
      batch.set(activityRef, {
        leaveId,
        action: 'status_change',
        status: 'rejected',
        timestamp: new Date(),
        by: rejectedBy,
        note: note || 'Leave rejected',
        newStatus: 'rejected',
        previousStatus: 'pending'
      });

      await batch.commit();
    } catch (error) {
      console.error('Error rejecting leave:', error);
      throw error;
    }
  }

  // Legacy methods for backward compatibility
  getLeaves(): Observable<any[]> {
    const leaveCollection = collection(this.firestore, 'leaves');
    return new Observable(observer => {
      const unsubscribe = onSnapshot(leaveCollection, snapshot => {
        const leaves = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        observer.next(leaves);
      }, error => {
        console.error('Error fetching leaves:', error);
        observer.error(error);
      });
      return () => unsubscribe();
    });
  }

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
      createdAt: leaveData.createdAt || new Date(),
      maxLeaveCount: leaveData.maxLeaveCount || 1,
    };

    // Add to Firestore
    return addDoc(collection(this.firestore, 'leaves'), sanitizedData);
  }

  async deleteLeave(id: string): Promise<void> {
    try {
      const leaveDocRef = doc(this.firestore, 'leaves', id);
      await deleteDoc(leaveDocRef);
    } catch (error) {
      console.error('Error deleting leave:', error);
      throw error;
    }
  }

  async updateLeaveStatus(
    id: string, 
    status: string, 
    note: string = '', 
    approvedBy: string = '',
    previousStatus: string = ''
  ): Promise<void> {
    try {
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
    } catch (error) {
      console.error('Error updating leave status:', error);
      throw error;
    }
  }

  async bulkApproveLeaves(leaveIds: string[], approvedBy: string, note: string = ''): Promise<void> {
    try {
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
          updatedAt: new Date(),
          approvedAt: new Date()
        });
        
        // Create activity record
        const newActivityRef = doc(activityCollection);
        activityBatch.set(newActivityRef, {
          leaveId: id,
          action: 'status_change',
          status: 'approved',
          newStatus: 'approved',
          previousStatus: 'pending',
          note: note,
          timestamp: new Date(),
          by: approvedBy
        });
      });
      
      await batch.commit();
      await activityBatch.commit();
    } catch (error) {
      console.error('Error bulk approving leaves:', error);
      throw error;
    }
  }
  
  async bulkRejectLeaves(leaveIds: string[], rejectedBy: string, note: string = ''): Promise<void> {
    try {
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
          updatedAt: new Date(),
          rejectedAt: new Date()
        });
        
        // Create activity record
        const newActivityRef = doc(activityCollection);
        activityBatch.set(newActivityRef, {
          leaveId: id,
          action: 'status_change',
          status: 'rejected',
          newStatus: 'rejected',
          previousStatus: 'pending',
          note: note,
          timestamp: new Date(),
          by: rejectedBy
        });
      });
      
      await batch.commit();
      await activityBatch.commit();
    } catch (error) {
      console.error('Error bulk rejecting leaves:', error);
      throw error;
    }
  }

  // Utility Methods
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

  // Additional utility methods
  async getUserLeaveHistory(userId: string, year?: number): Promise<LeaveApplication[]> {
    try {
      const leaveCollection = collection(this.firestore, 'leave-applications');
      let q = query(
        leaveCollection,
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(q);
      let leaves = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          startDate: data['startDate']?.toDate() || new Date(),
          endDate: data['endDate']?.toDate() || new Date(),
          createdAt: data['createdAt']?.toDate() || new Date(),
          updatedAt: data['updatedAt']?.toDate() || new Date(),
          approvedAt: data['approvedAt']?.toDate(),
          rejectedAt: data['rejectedAt']?.toDate()
        } as LeaveApplication;
      });

      // Filter by year if specified
      if (year) {
        leaves = leaves.filter(leave => leave.startDate.getFullYear() === year);
      }

      return leaves;
    } catch (error) {
      console.error('Error fetching user leave history:', error);
      throw error;
    }
  }

  async getLeaveStatistics(userId?: string): Promise<any> {
    try {
      const leaveCollection = collection(this.firestore, 'leave-applications');
      let q = query(leaveCollection);

      if (userId) {
        q = query(leaveCollection, where('userId', '==', userId));
      }

      const snapshot = await getDocs(q);
      const leaves = snapshot.docs.map(doc => doc.data());

      const stats = {
        total: leaves.length,
        pending: leaves.filter(l => l['status'] === 'pending').length,
        approved: leaves.filter(l => l['status'] === 'approved').length,
        rejected: leaves.filter(l => l['status'] === 'rejected').length,
        totalDays: leaves.reduce((sum, l) => sum + (l['daysTaken'] || 0), 0)
      };

      return stats;
    } catch (error) {
      console.error('Error fetching leave statistics:', error);
      throw error;
    }
  }

  // Date utility methods
  isWeekend(date: Date): boolean {
    const day = date.getDay();
    return day === 0 || day === 6; // Sunday = 0, Saturday = 6
  }

  calculateWorkingDays(startDate: Date, endDate: Date): number {
    let count = 0;
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      if (!this.isWeekend(currentDate)) {
        count++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return count;
  }

  formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
// Add this method to your LeaveService
async updateLeave(id: string, updates: Partial<any>): Promise<void> {
  try {
    const leaveDocRef = doc(this.firestore, 'leaves', id);
    await updateDoc(leaveDocRef, updates);
    
    // Add activity log
    const activityCollection = collection(this.firestore, 'leave-activities');
    await addDoc(activityCollection, {
      leaveId: id,
      action: 'updated',
      timestamp: new Date(),
      by: 'System',
      note: 'Leave details were updated',
      details: updates
    });
  } catch (error) {
    console.error('Error updating leave:', error);
    throw error;
  }
}
  formatDateTime(date: Date): string {
    return date.toLocaleString();
  }
}