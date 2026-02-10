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
  Timestamp,
  setDoc
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { AuthService } from '../auth.service';

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
  daysRequested: number;
  createdAt: Date;
  updatedAt: Date;
  approvedBy?: string;
  rejectedBy?: string;
  approvedAt?: Date;
  rejectedAt?: Date;
  note?: string;
  maxLeaveCount?: number;
  remainingLeave?: number;
}

export interface UserLeaveBalance {
  id?: string;
  userId: string;
  leaveTypeId: string;
  leaveTypeName: string;
  allocated: number;
  used: number;
  remaining: number;
  year: number;
  createdAt: Date;
  updatedAt: Date;
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
  leaveType: string;
  description?: string;
  maxLeaveCount: number;
  maxDays: number;
  carryForward: boolean;
  active: boolean;
  interval: string;
}

@Injectable({
  providedIn: 'root'
})
export class LeaveService {
    private currentUserId: string | null = null;

  constructor(private firestore: Firestore, private auth: AuthService) {
    this.auth.getCurrentUser().subscribe(user => {
      this.currentUserId = user?.uid || null;
    });
  }
  
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

  // User Leave Balance Management
  async initializeUserLeaveBalances(userId: string): Promise<void> {
    try {
      const currentYear = new Date().getFullYear();
      const leaveTypesSnapshot = await getDocs(collection(this.firestore, 'leave-types'));
      
      for (const leaveTypeDoc of leaveTypesSnapshot.docs) {
        const leaveType = leaveTypeDoc.data() as LeaveType;
        
        // Check if balance already exists for this user and leave type
        const existingBalance = await this.getUserLeaveBalance(userId, leaveTypeDoc.id);
        
        if (!existingBalance) {
          await this.createUserLeaveBalance({
            userId,
            leaveTypeId: leaveTypeDoc.id,
            leaveTypeName: leaveType.leaveType || leaveType.name,
            allocated: leaveType.maxLeaveCount || leaveType.maxDays || 0,
            used: 0,
            remaining: leaveType.maxLeaveCount || leaveType.maxDays || 0,
            year: currentYear,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
      }
    } catch (error) {
      console.error('Error initializing user leave balances:', error);
      throw error;
    }
  }

  async createUserLeaveBalance(balance: Omit<UserLeaveBalance, 'id'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(this.firestore, 'user-leave-balances'), balance);
      return docRef.id;
    } catch (error) {
      console.error('Error creating user leave balance:', error);
      throw error;
    }
  }

  async getUserLeaveBalance(userId: string, leaveTypeId: string): Promise<UserLeaveBalance | null> {
    try {
      const currentYear = new Date().getFullYear();
      const balanceCollection = collection(this.firestore, 'user-leave-balances');
      const q = query(
        balanceCollection,
        where('userId', '==', userId),
        where('leaveTypeId', '==', leaveTypeId),
        where('year', '==', currentYear)
      );
      
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        return null;
      }
      
      const doc = snapshot.docs[0];
      return { 
        id: doc.id,
        ...doc.data() 
      } as UserLeaveBalance;
    } catch (error) {
      console.error('Error fetching user leave balance:', error);
      throw error;
    }
  }

  async getUserLeaveBalances(userId: string): Promise<UserLeaveBalance[]> {
    try {
      const currentYear = new Date().getFullYear();
      const balanceCollection = collection(this.firestore, 'user-leave-balances');
      const q = query(
        balanceCollection, 
        where('userId', '==', userId),
        where('year', '==', currentYear)
      );
      
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
      const currentYear = new Date().getFullYear();
      const balanceCollection = collection(this.firestore, 'user-leave-balances');
      const q = query(
        balanceCollection,
        where('userId', '==', userId),
        where('leaveTypeId', '==', leaveTypeId),
        where('year', '==', currentYear)
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
async applyForLeave(application: any): Promise<{ success: boolean; error?: string; leaveId?: string }> {
  try {
    console.log('Applying for leave:', application); // Debug log
    
    if (!application.userId) {
      return { success: false, error: 'User ID is required' };
    }

    // Convert dates to Firestore Timestamp if needed
    const leaveData = {
      ...application,
      startDate: application.startDate instanceof Date ? application.startDate : new Date(application.startDate),
      endDate: application.endDate instanceof Date ? application.endDate : new Date(application.endDate),
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'pending'
    };

    console.log('Processed leave data:', leaveData); // Debug log

    const docRef = await addDoc(collection(this.firestore, 'leaves'), leaveData);
    console.log('Leave created with ID:', docRef.id); // Debug log

    return { success: true, leaveId: docRef.id };
  } catch (error) {
    console.error('Error applying for leave:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
async approveLeave(leaveId: string, approvedBy: string, note: string = ''): Promise<void> {
  const batch = writeBatch(this.firestore);
  
  try {
    // 1. Get leave details
    const leaveRef = doc(this.firestore, 'leaves', leaveId);
    const leaveSnap = await getDoc(leaveRef);
    
    if (!leaveSnap.exists()) {
      throw new Error('Leave not found');
    }
    
    const leaveData = leaveSnap.data();
    const daysRequested = this.calculateLeaveDays(
      leaveData['startDate'].toDate(),
      leaveData['endDate'].toDate(),
      leaveData['session']
    );
    
    // 2. Get current balance
    const currentBalance = await this.getUserLeaveBalance(
      leaveData['userId'], 
      leaveData['leaveTypeId']
    );
    
    if (!currentBalance) {
      throw new Error('User leave balance not found');
    }
    
    // 3. Calculate new balance
    const newRemaining = currentBalance.remaining - daysRequested;
    
    if (newRemaining < 0) {
      throw new Error('Insufficient leave balance');
    }
    
    // 4. Update leave record with proper calculations
    batch.update(leaveRef, {
      status: 'approved',
      daysTaken: daysRequested,
      remainingLeave: newRemaining, // Store the actual remaining balance
      approvedBy,
      approvedAt: new Date(),
      note,
      updatedAt: new Date()
    });
    
    // 5. Update user balance
    const balanceRef = doc(this.firestore, 'user-leave-balances', currentBalance.id!);
    batch.update(balanceRef, {
      used: currentBalance.used + daysRequested,
      remaining: newRemaining,
      updatedAt: new Date()
    });
    
    // 6. Add activity log
    const activityRef = doc(collection(this.firestore, 'leave-activities'));
    batch.set(activityRef, {
      leaveId,
      action: 'status_change',
      status: 'approved',
      previousStatus: leaveData['status'],
      newStatus: 'approved',
      by: approvedBy,
      note: note || 'Leave approved',
      timestamp: new Date(),
      details: {
        daysDeducted: daysRequested,
        previousBalance: currentBalance.remaining,
        newBalance: newRemaining
      }
    });
    
    await batch.commit();
    
  } catch (error) {
    console.error('Error approving leave:', error);
    throw error;
  }
}


  // Enhanced leave rejection with balance restoration if needed
  async rejectLeave(leaveId: string, rejectedBy: string, note: string = ''): Promise<void> {
    const batch = writeBatch(this.firestore);
    
    try {
      // 1. Get leave details
      const leaveRef = doc(this.firestore, 'leaves', leaveId);
      const leaveSnap = await getDoc(leaveRef);
      if (!leaveSnap.exists()) throw new Error('Leave not found');
      
      const leaveData = leaveSnap.data();
      const daysTaken = leaveData['daysTaken'] || 0;
      
      // 2. Update leave status
      batch.update(leaveRef, {
        status: 'rejected',
        rejectedBy,
        rejectedAt: new Date(),
        note,
        updatedAt: new Date()
      });
      
      // 3. Restore balance if leave was previously approved
      if (leaveData['status'] === 'approved' && daysTaken > 0) {
        const currentBalance = await this.getUserLeaveBalance(
          leaveData['userId'], 
          leaveData['leaveTypeId']
        );
        
        if (currentBalance) {
          const balanceRef = doc(this.firestore, 'user-leave-balances', currentBalance.id!);
          batch.update(balanceRef, {
            used: currentBalance.used - daysTaken,
            remaining: currentBalance.remaining + daysTaken,
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
        timestamp: new Date(),
        details: daysTaken > 0 ? { daysRestored: daysTaken } : {}
      });
      
      await batch.commit();
      
    } catch (error) {
      console.error('Error rejecting leave:', error);
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

  async addLeave(leaveData: any): Promise<any> {
    // Use the enhanced applyForLeave method
    return this.applyForLeave(leaveData);
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

  async updateLeave(id: string, updates: Partial<any>): Promise<void> {
    try {
      const leaveDocRef = doc(this.firestore, 'leaves', id);
      await updateDoc(leaveDocRef, {
        ...updates,
        updatedAt: new Date()
      });
      
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

  async updateLeaveStatus(
    leaveId: string,
    updateData: StatusUpdateData,
    previousStatus?: string
  ): Promise<void> {
    try {
      if (updateData.status === 'approved') {
        await this.approveLeave(leaveId, updateData.changedBy, updateData.note);
      } else if (updateData.status === 'rejected') {
        await this.rejectLeave(leaveId, updateData.changedBy, updateData.note);
      } else {
        // For other status changes, use basic update
        const leaveRef = doc(this.firestore, 'leaves', leaveId);
        await updateDoc(leaveRef, {
          status: updateData.status,
          updatedAt: new Date()
        });
      }
    } catch (error) {
      console.error('Error updating leave status:', error);
      throw error;
    }
  }

  async bulkApproveLeaves(leaveIds: string[], approvedBy: string, note: string = ''): Promise<void> {
    try {
      for (const leaveId of leaveIds) {
        await this.approveLeave(leaveId, approvedBy, note);
      }
    } catch (error) {
      console.error('Error bulk approving leaves:', error);
      throw error;
    }
  }
  
  async bulkRejectLeaves(leaveIds: string[], rejectedBy: string, note: string = ''): Promise<void> {
    try {
      for (const leaveId of leaveIds) {
        await this.rejectLeave(leaveId, rejectedBy, note);
      }
    } catch (error) {
      console.error('Error bulk rejecting leaves:', error);
      throw error;
    }
  }

  // Utility Methods
calculateLeaveDays(startDate: Date, endDate: Date, session: string): number {
  if (!startDate || !endDate) return 0;
  
  // Handle same-day leave
  if (startDate.toDateString() === endDate.toDateString()) {
    return session === 'Full Day' ? 1 : 0.5;
  }
  
  // Calculate difference in days
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Inclusive counting
  
  // Adjust for half days
  if (session === 'First Half' || session === 'Second Half') {
    return diffDays - 0.5;
  }
  
  return diffDays;
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

  // Additional utility methods
  async getUserLeaveHistory(userId: string, year?: number): Promise<LeaveApplication[]> {
    try {
      const leaveCollection = collection(this.firestore, 'leaves');
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
      const leaveCollection = collection(this.firestore, 'leaves');
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

  formatDateTime(date: Date): string {
    return date.toLocaleString();
  }
}