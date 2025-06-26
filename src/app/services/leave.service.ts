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

interface StatusUpdateData {
  status: 'pending' | 'approved' | 'rejected';
  changedBy: string;
  note?: string;
}

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
      const activitiesRef = collection(this.firestore, 'leave-activities');
      const q = query(
        activitiesRef,
        where('leaveId', '==', leaveId),
        orderBy('timestamp', 'desc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          leaveId: data['leaveId'],
          action: data['action'] || 'status_change',
          status: data['status'],
          previousStatus: data['previousStatus'],
          newStatus: data['newStatus'],
          note: data['note'] || '',
          by: data['by'] || 'System',
          timestamp: data['timestamp']?.toDate() || new Date(),
          details: data['details'] || {}
        } as LeaveActivity;
      });
    } catch (error) {
      console.error('Error fetching leave activities:', error);
      throw error;
    }
  }

async addLeave(leaveData: any): Promise<any> {
  // Calculate days taken
  const startDate = new Date(leaveData.startDate);
  const endDate = new Date(leaveData.endDate || leaveData.startDate);
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  let daysTaken = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  
  if (leaveData.session === 'First Half' || leaveData.session === 'Second Half') {
    daysTaken = daysTaken - 0.5;
  }

  // Calculate remaining leave
  const maxLeaveCount = leaveData.maxLeaveCount || 1;
  const remainingLeave = maxLeaveCount - daysTaken;

  // Prepare data for Firestore
  const sanitizedData = {
    employeeName: leaveData.employeeName || '',
    leaveType: leaveData.leaveType || 'Annual',
    startDate: leaveData.startDate || new Date(),
    endDate: leaveData.endDate || leaveData.startDate || new Date(),
    reason: leaveData.reason || '',
    status: leaveData.status || 'pending',
    session: leaveData.session || 'Full Day',
    createdAt: leaveData.createdAt || new Date(),
    maxLeaveCount: maxLeaveCount,
    daysTaken: daysTaken,
    remainingLeave: remainingLeave > 0 ? remainingLeave : 0
  };

  // Add to Firestore
  return addDoc(collection(this.firestore, 'leaves'), sanitizedData);
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
// In your leave.service.ts
// In your leave.service.ts
async applyForLeave(application: any): Promise<any> {
  try {
    // 1. Validate leave type exists
    const leaveTypeDoc = await getDoc(doc(this.firestore, 'leave-types', application.leaveTypeId));
    if (!leaveTypeDoc.exists()) throw new Error('Leave type not found');
    
    // 2. Calculate requested days
    const daysRequested = this.calculateLeaveDays(
      new Date(application.startDate),
      new Date(application.endDate || application.startDate),
      application.session
    );
    
    // 3. Check available balance
    const currentBalance = await this.getRemainingLeave(application.userId, application.leaveTypeId);
    if (currentBalance < daysRequested) {
      throw new Error(`Insufficient leave balance. Available: ${currentBalance}, Requested: ${daysRequested}`);
    }
    
    // 4. Create transaction
    const batch = writeBatch(this.firestore);
    
    // Update balance
    const balanceQuery = query(
      collection(this.firestore, 'user-leave-balances'),
      where('userId', '==', application.userId),
      where('leaveTypeId', '==', application.leaveTypeId)
    );
    const balanceSnapshot = await getDocs(balanceQuery);
    
    if (!balanceSnapshot.empty) {
      const balanceRef = balanceSnapshot.docs[0].ref;
      const currentData = balanceSnapshot.docs[0].data();
      batch.update(balanceRef, {
        used: (currentData['used'] || 0) + daysRequested,
        remaining: currentBalance - daysRequested,
        updatedAt: new Date()
      });
    }
    
    // Create leave application
    const leaveRef = doc(collection(this.firestore, 'leaves'));
    batch.set(leaveRef, {
      ...application,
      daysTaken: daysRequested,
      remainingLeave: currentBalance - daysRequested,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    await batch.commit();
    return { success: true, newBalance: currentBalance - daysRequested };
    
  } catch (error) {
    console.error('Leave application failed:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}
async getRemainingLeave(userId: string, leaveTypeId: string): Promise<number> {
  try {
    const balanceQuery = query(
      collection(this.firestore, 'user-leave-balances'),
      where('userId', '==', userId),
      where('leaveTypeId', '==', leaveTypeId)
    );
    
    const snapshot = await getDocs(balanceQuery);
    
    if (snapshot.empty) {
      const leaveTypeDoc = await getDoc(doc(this.firestore, 'leave-types', leaveTypeId));
      if (leaveTypeDoc.exists()) {
        const leaveType = leaveTypeDoc.data() as LeaveType;
        return leaveType.maxDays;
      }
      return 0;
    }
    
    const balance = snapshot.docs[0].data() as UserLeaveBalance;
    return balance.remaining;
  } catch (error) {
    console.error('Error getting remaining leave:', error);
    return 0;
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
    const leaveRef = doc(this.firestore, 'leaves', leaveId);
    const leaveSnapshot = await getDoc(leaveRef);
    const leaveData = leaveSnapshot.data();
    
    if (!leaveData) throw new Error('Leave not found');
    
    // Calculate days for this leave only
    const daysForThisLeave = this.calculateLeaveDays(
      new Date(leaveData['startDate']),
      new Date(leaveData['endDate'] || leaveData['startDate']),
      leaveData['session']
    );
    
    // Get user's current leave balance
    const balanceQuery = query(
      collection(this.firestore, 'user-leave-balances'),
      where('userId', '==', leaveData['employeeId']),
      where('leaveTypeId', '==', leaveData['leaveTypeId'])
    );
    
    const balanceSnapshot = await getDocs(balanceQuery);
    
    if (balanceSnapshot.empty) {
      throw new Error('User leave balance record not found');
    }

    const balanceDoc = balanceSnapshot.docs[0].data() as UserLeaveBalance;
    const newRemaining = balanceDoc.remaining - daysForThisLeave;

    if (newRemaining < 0) {
      throw new Error('Insufficient remaining leave balance');
    }

    // Update the user's leave balance first
    const balanceRef = balanceSnapshot.docs[0].ref;
    await updateDoc(balanceRef, {
      used: balanceDoc.used + daysForThisLeave,
      remaining: newRemaining,
      updatedAt: new Date()
    });

    // Then update the leave record
    await updateDoc(leaveRef, {
      status: 'approved',
      approvedBy: approvedBy,
      note: note,
      daysTaken: daysForThisLeave,
      remainingLeave: newRemaining, // Use the updated remaining balance
      approvedAt: new Date(),
      updatedAt: new Date()
    });

    // Add activity log
    await this.addLeaveActivity({
      leaveId,
      action: 'status_change',
      status: 'approved',
      by: approvedBy,
      note: note || 'Leave approved',
      newStatus: 'approved',
      previousStatus: 'pending',
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Error approving leave:', error);
    throw error;
  }
}

async rejectLeave(leaveId: string, rejectedBy: string, note: string = ''): Promise<void> {
  const batch = writeBatch(this.firestore);
  
  // 1. Get leave details
  const leaveRef = doc(this.firestore, 'leaves', leaveId);
  const leaveSnap = await getDoc(leaveRef);
  if (!leaveSnap.exists()) throw new Error('Leave not found');
  
  const leaveData = leaveSnap.data();
  const daysToRestore = leaveData['daysTaken'] || 0;
  
  // 2. Update leave status
  batch.update(leaveRef, {
    status: 'rejected',
    rejectedBy,
    rejectedAt: new Date(),
    note,
    updatedAt: new Date()
  });
  
  // 3. Restore balance if leave was previously approved
  if (leaveData['status'] === 'approved') {
    const balanceQuery = query(
      collection(this.firestore, 'user-leave-balances'),
      where('userId', '==', leaveData['userId']),
      where('leaveTypeId', '==', leaveData['leaveTypeId'])
    );
    
    const balanceSnap = await getDocs(balanceQuery);
    if (!balanceSnap.empty) {
      const balanceRef = balanceSnap.docs[0].ref;
      const balanceData = balanceSnap.docs[0].data();
      batch.update(balanceRef, {
        used: balanceData['used'] - daysToRestore,
        remaining: balanceData['remaining'] + daysToRestore,
        updatedAt: new Date()
      });
    }
  }
  
  // 4. Add activity log
  const activityRef = doc(collection(this.firestore, 'leave-activities'));
  batch.set(activityRef, {
    leaveId,
    action: 'status_change',
    status: 'rejected',
    previousStatus: leaveData['status'],
    newStatus: 'rejected',
    by: rejectedBy,
    note: note || 'Leave rejected',
    timestamp: new Date()
  });
  
  await batch.commit();
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



  async deleteLeave(id: string): Promise<void> {
    try {
      const leaveDocRef = doc(this.firestore, 'leaves', id);
      await deleteDoc(leaveDocRef);
    } catch (error) {
      console.error('Error deleting leave:', error);
      throw error;
    }
  }
async getTotalTakenDays(userId: string, leaveTypeId: string): Promise<number> {
  try {
    const leavesCollection = collection(this.firestore, 'leaves');
    const q = query(
      leavesCollection,
      where('employeeId', '==', userId),
      where('leaveTypeId', '==', leaveTypeId),
      where('status', '==', 'approved')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.reduce((sum, doc) => {
      return sum + (doc.data()['daysTaken'] || 0);
    }, 0);
  } catch (error) {
    console.error('Error calculating total taken days:', error);
    return 0;
  }
}
  async updateLeaveStatus(
    leaveId: string,
    updateData: StatusUpdateData,
    previousStatus?: string
  ): Promise<void> {
    try {
      const leaveRef = doc(this.firestore, 'leaves', leaveId);
      const updatePayload: any = {
        status: updateData.status,
        updatedAt: new Date()
      };

      // Set approver/rejector info
      if (updateData.status === 'approved') {
        updatePayload.approvedBy = updateData.changedBy;
        updatePayload.approvedAt = new Date();
      } else if (updateData.status === 'rejected') {
        updatePayload.rejectedBy = updateData.changedBy;
        updatePayload.rejectedAt = new Date();
      }

      // Set note if provided
      if (updateData.note) {
        updatePayload.note = updateData.note;
      }

      // Update leave record
      await updateDoc(leaveRef, updatePayload);

      // Create activity log
      await this.addLeaveActivity({
        leaveId,
        action: 'status_change',
        status: updateData.status,
        previousStatus: previousStatus || 'pending',
        newStatus: updateData.status,
        note: updateData.note || `Status changed to ${updateData.status}`,
        by: updateData.changedBy,
        timestamp: new Date()
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
  private async addLeaveActivity(activity: Omit<LeaveActivity, 'id'>): Promise<void> {
    try {
      const activitiesRef = collection(this.firestore, 'leave-activities');
      await addDoc(activitiesRef, {
        ...activity,
        timestamp: activity.timestamp || new Date()
      });
    } catch (error) {
      console.error('Error adding leave activity:', error);
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
  // Ensure we have valid dates
  if (!(startDate instanceof Date) || !(endDate instanceof Date)) {
    throw new Error('Invalid date parameters');
  }
  
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  let days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Inclusive of both dates
  
  // Adjust for half-day sessions
  if (session === 'First Half' || session === 'Second Half') {
    days -= 0.5;
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