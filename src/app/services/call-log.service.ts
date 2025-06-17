import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, query, onSnapshot, doc, updateDoc, deleteDoc, orderBy, limit, where, getDocs, collectionGroup, Timestamp } from '@angular/fire/firestore';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';

export interface CallLog {
  id?: string;
  subject: string;
  description: string;
  createdAt: any; 
  createdBy: string;
  
  callType?: string;
  callDuration?: number;
  callOutcome?: string;
  followUpRequired?: boolean;
  followUpDate?: any;
  tags?: string[];
  isStatusUpdate?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class CallLogService {
  private customersCollection = 'customers';

  constructor(private firestore: Firestore) { }

  getCallLogsForCustomer(customerId: string): Observable<CallLog[]> {
    const callLogsRef = collection(this.firestore, `${this.customersCollection}/${customerId}/callLogs`);
    const q = query(callLogsRef, orderBy('createdAt', 'desc'));
    
    return new Observable<CallLog[]>(observer => {
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const callLogs: CallLog[] = [];
        snapshot.forEach(doc => {
          const data = doc.data() as Omit<CallLog, 'id'>;
          callLogs.push({ id: doc.id, ...data });
        });
        observer.next(callLogs);
      }, (error) => {
        observer.error(error);
      });
      
      return { unsubscribe };
    });
  }

  getAllCallLogs(): Observable<any[]> {
    const callLogsCollectionGroup = collectionGroup(this.firestore, 'callLogs');
    return new Observable<any[]>(observer => {
      const unsubscribe = onSnapshot(callLogsCollectionGroup, (snapshot) => {
        const callLogs = snapshot.docs.map(doc => {
          const path = doc.ref.path.split('/');
          return {
            id: doc.id,
            customerId: path[1],
            ...doc.data()
          };
        });
        observer.next(callLogs);
      });
      return { unsubscribe };
    });
  }

  getCallLogsForCustomerRealtime(customerId: string, callback: (callLogs: CallLog[]) => void): { unsubscribe: () => void } {
    const callLogsRef = collection(this.firestore, `${this.customersCollection}/${customerId}/callLogs`);
    const q = query(callLogsRef, orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const callLogs: CallLog[] = [];
      snapshot.forEach(doc => {
        const data = doc.data() as Omit<CallLog, 'id'>;
        callLogs.push({ id: doc.id, ...data });
      });
      callback(callLogs);
    }, (error) => {
      console.error('Error getting call logs:', error);
    });
    
    return { unsubscribe };
  }

  // FIXED: Updated addCallLog method to handle Firestore Timestamps properly
  addCallLog(customerId: string, callLogData: Omit<CallLog, 'id'>): Observable<string> {
    const callLogsRef = collection(this.firestore, `${this.customersCollection}/${customerId}/callLogs`);
    
    // Ensure createdAt is properly handled
    let data: any = { ...callLogData };
    
    // If createdAt is already a Firestore Timestamp, use it as is
    if (callLogData.createdAt instanceof Timestamp) {
      data.createdAt = callLogData.createdAt;
    } 
    // If createdAt is a Date, convert to Firestore Timestamp
    else if (callLogData.createdAt instanceof Date) {
      data.createdAt = Timestamp.fromDate(callLogData.createdAt);
    } 
    // If no createdAt or invalid, use current timestamp
    else {
      data.createdAt = Timestamp.now();
    }
    
    // Handle followUpDate if present
    if (callLogData.followUpDate) {
      if (callLogData.followUpDate instanceof Date) {
        data.followUpDate = Timestamp.fromDate(callLogData.followUpDate);
      } else if (!(callLogData.followUpDate instanceof Timestamp)) {
        // If it's not a Date or Timestamp, try to convert
        try {
          data.followUpDate = Timestamp.fromDate(new Date(callLogData.followUpDate));
        } catch (error) {
          console.warn('Invalid followUpDate, removing from data:', error);
          delete data.followUpDate;
        }
      }
    }
    
    console.log('Adding call log with data:', data);
    
    return from(addDoc(callLogsRef, data).then(docRef => docRef.id));
  }

  updateCallLog(customerId: string, callLogId: string, callLogData: Partial<CallLog>): Observable<void> {
    const callLogDoc = doc(this.firestore, `${this.customersCollection}/${customerId}/callLogs/${callLogId}`);
    
    let data: any = { ...callLogData };
    
    // Handle date conversion if needed
    if (callLogData.createdAt instanceof Date) {
      data.createdAt = Timestamp.fromDate(callLogData.createdAt);
    }
    
    if (callLogData.followUpDate instanceof Date) {
      data.followUpDate = Timestamp.fromDate(callLogData.followUpDate);
    }
    
    return from(updateDoc(callLogDoc, data));
  }

  deleteCallLog(customerId: string, callLogId: string): Observable<void> {
    const callLogDoc = doc(this.firestore, `${this.customersCollection}/${customerId}/callLogs/${callLogId}`);
    return from(deleteDoc(callLogDoc));
  }

  getCallLogById(customerId: string, callLogId: string): Observable<CallLog | undefined> {
    const callLogDoc = doc(this.firestore, `${this.customersCollection}/${customerId}/callLogs/${callLogId}`);
    
    return new Observable<CallLog | undefined>(observer => {
      const unsubscribe = onSnapshot(callLogDoc, (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data() as Omit<CallLog, 'id'>;
          observer.next({ id: docSnapshot.id, ...data });
        } else {
          observer.next(undefined);
        }
      }, (error) => {
        observer.error(error);
      });
      
      return { unsubscribe };
    });
  }

  getRecentCallLogs(limitCount: number = 10): Observable<Array<CallLog & { customerId: string }>> {
    const callLogsCollectionGroup = collectionGroup(this.firestore, 'callLogs');
    const q = query(callLogsCollectionGroup, orderBy('createdAt', 'desc'), limit(limitCount));
    
    return new Observable<Array<CallLog & { customerId: string }>>(observer => {
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const callLogs: Array<CallLog & { customerId: string }> = [];
        snapshot.forEach(doc => {
          const data = doc.data() as Omit<CallLog, 'id'>;
          const path = doc.ref.path;
          const pathSegments = path.split('/');
          const customerId = pathSegments[1];
          
          callLogs.push({ 
            id: doc.id, 
            customerId, 
            ...data 
          });
        });
        observer.next(callLogs);
      }, (error) => {
        observer.error(error);
      });
      
      return { unsubscribe };
    });
  }

  getFollowUpCallLogs(): Observable<Array<CallLog & { customerId: string }>> {
    const callLogsCollectionGroup = collectionGroup(this.firestore, 'callLogs');
    const q = query(
      callLogsCollectionGroup, 
      where('followUpRequired', '==', true),
      orderBy('followUpDate', 'asc')
    );
    
    return new Observable<Array<CallLog & { customerId: string }>>(observer => {
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const callLogs: Array<CallLog & { customerId: string }> = [];
        snapshot.forEach(doc => {
          const data = doc.data() as Omit<CallLog, 'id'>;
          const path = doc.ref.path;
          const pathSegments = path.split('/');
          const customerId = pathSegments[1];
          
          callLogs.push({ 
            id: doc.id, 
            customerId, 
            ...data 
          });
        });
        observer.next(callLogs);
      }, (error) => {
        observer.error(error);
      });
      
      return { unsubscribe };
    });
  }

  getCallLogsByUser(userId: string, limitCount: number = 50): Observable<Array<CallLog & { customerId: string }>> {
    const callLogsCollectionGroup = collectionGroup(this.firestore, 'callLogs');
    const q = query(
      callLogsCollectionGroup, 
      where('createdBy', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    
    return new Observable<Array<CallLog & { customerId: string }>>(observer => {
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const callLogs: Array<CallLog & { customerId: string }> = [];
        snapshot.forEach(doc => {
          const data = doc.data() as Omit<CallLog, 'id'>;
          const path = doc.ref.path;
          const pathSegments = path.split('/');
          const customerId = pathSegments[1];
          
          callLogs.push({ 
            id: doc.id, 
            customerId, 
            ...data 
          });
        });
        observer.next(callLogs);
      }, (error) => {
        observer.error(error);
      });
      
      return { unsubscribe };
    });
  }

  getCallLogsByDateRange(startDate: Date, endDate: Date): Observable<Array<CallLog & { customerId: string }>> {
    const startTimestamp = Timestamp.fromDate(startDate);
    const endTimestamp = Timestamp.fromDate(endDate);
    
    const callLogsCollectionGroup = collectionGroup(this.firestore, 'callLogs');
    const q = query(
      callLogsCollectionGroup, 
      where('createdAt', '>=', startTimestamp),
      where('createdAt', '<=', endTimestamp),
      orderBy('createdAt', 'desc')
    );
    
    return new Observable<Array<CallLog & { customerId: string }>>(observer => {
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const callLogs: Array<CallLog & { customerId: string }> = [];
        snapshot.forEach(doc => {
          const data = doc.data() as Omit<CallLog, 'id'>;
          const path = doc.ref.path;
          const pathSegments = path.split('/');
          const customerId = pathSegments[1];
          
          callLogs.push({ 
            id: doc.id, 
            customerId, 
            ...data 
          });
        });
        observer.next(callLogs);
      }, (error) => {
        observer.error(error);
      });
      
      return { unsubscribe };
    });
  }

  async getCallLogCount(customerId: string): Promise<number> {
    const callLogsRef = collection(this.firestore, `${this.customersCollection}/${customerId}/callLogs`);
    const snapshot = await getDocs(callLogsRef);
    return snapshot.size;
  }

  async getCallLogStatistics(customerId: string): Promise<{ 
    total: number,
    thisWeek: number, 
    thisMonth: number, 
    followUpRequired: number 
  }> {
    const callLogsRef = collection(this.firestore, `${this.customersCollection}/${customerId}/callLogs`);
    
    const totalSnapshot = await getDocs(callLogsRef);
    const total = totalSnapshot.size;
    
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    const thisWeekSnapshot = await getDocs(
      query(callLogsRef, where('createdAt', '>=', Timestamp.fromDate(startOfWeek)))
    );
    const thisWeek = thisWeekSnapshot.size;
    
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const thisMonthSnapshot = await getDocs(
      query(callLogsRef, where('createdAt', '>=', Timestamp.fromDate(startOfMonth)))
    );
    const thisMonth = thisMonthSnapshot.size;
    
    const followUpSnapshot = await getDocs(
      query(callLogsRef, where('followUpRequired', '==', true))
    );
    const followUpRequired = followUpSnapshot.size;
    
    return { total, thisWeek, thisMonth, followUpRequired };
  }
}