// src/app/services/target.service.ts
import { Injectable } from '@angular/core';
import { Firestore, collection, collectionData, doc, getDoc, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit, DocumentReference, DocumentData, addDoc, onSnapshot } from '@angular/fire/firestore';
import { Observable, from, throwError, BehaviorSubject } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

export interface TargetRange {
  fromAmount: number;
  toAmount: number;
  commissionPercent: number;
}

export interface SalesTarget {
  id?: string;
  userId: string;
  username?: string;
  targetValue: number;
  currentValue?: number;
  period?: string;
  year: number;
  month: number;
  quarter?: number;
  isAchieved?: boolean;
  targetRanges?: TargetRange[];
  createdAt?: Date;
  updatedAt?: Date;
}

@Injectable({
  providedIn: 'root'
})
export class TargetService {
  private readonly collectionName = 'targets';
  private targetsSubject = new BehaviorSubject<SalesTarget[]>([]);

  constructor(private firestore: Firestore) {
    // Initialize real-time updates when service is created
    this.initializeTargetsListener();
  }

  /**
   * Initialize real-time listener for all targets
   * Updates the BehaviorSubject whenever changes occur in Firestore
   */
  private initializeTargetsListener(): void {
    const collectionRef = collection(this.firestore, this.collectionName);
    
    // Set up the snapshot listener
    onSnapshot(collectionRef, 
      (snapshot) => {
        const targets: SalesTarget[] = [];
        snapshot.forEach(doc => {
          targets.push({ id: doc.id, ...doc.data() } as SalesTarget);
        });
        this.targetsSubject.next(targets);
      },
      (error) => {
        console.error('Error in targets snapshot listener:', error);
      }
    );
  }

  /**
   * Get observable for real-time targets updates
   * @returns Observable with array of targets that updates in real-time
   */
  getTargetsSnapshot(): Observable<SalesTarget[]> {
    return this.targetsSubject.asObservable();
  }

  /**
   * Create a new sales target
   * @param target The target data to be stored
   * @returns Promise with the document reference
   */
  async addTarget(target: SalesTarget): Promise<DocumentReference<DocumentData>> {
    try {
      const collectionRef = collection(this.firestore, this.collectionName);
      return await addDoc(collectionRef, {
        ...target,
        createdAt: new Date(),
        updatedAt: new Date(),
        isAchieved: false,
        currentValue: target.currentValue || 0
      });
    } catch (error) {
      console.error('Error adding target:', error);
      throw error;
    }
  }

  /**
   * Set a target with a specific ID
   * @param targetId The target document ID
   * @param target The target data
   * @returns Promise that resolves when complete
   */
  async setTarget(targetId: string, target: SalesTarget): Promise<void> {
    try {
      const docRef = doc(this.firestore, this.collectionName, targetId);
      return await setDoc(docRef, {
        ...target,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error(`Error setting target with ID ${targetId}:`, error);
      throw error;
    }
  }

  /**
   * Update an existing target
   * @param targetId The target document ID
   * @param data The partial data to update
   * @returns Promise that resolves when complete
   */
  async updateTarget(targetId: string, data: Partial<SalesTarget>): Promise<void> {
    try {
      const docRef = doc(this.firestore, this.collectionName, targetId);
      return await updateDoc(docRef, {
        ...data,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error(`Error updating target with ID ${targetId}:`, error);
      throw error;
    }
  }

  /**
   * Delete a target
   * @param targetId The target document ID
   * @returns Promise that resolves when complete
   */
  async deleteTarget(targetId: string): Promise<void> {
    try {
      const docRef = doc(this.firestore, this.collectionName, targetId);
      return await deleteDoc(docRef);
    } catch (error) {
      console.error(`Error deleting target with ID ${targetId}:`, error);
      throw error;
    }
  }

  /**
   * Get a single target by ID
   * @param targetId The target document ID
   * @returns Observable with the target data
   */
  getTarget(targetId: string): Observable<SalesTarget> {
    const docRef = doc(this.firestore, this.collectionName, targetId);
    return from(getDoc(docRef)).pipe(
      map(snapshot => {
        if (snapshot.exists()) {
          return { id: snapshot.id, ...snapshot.data() } as SalesTarget;
        } else {
          throw new Error(`Target with ID ${targetId} not found`);
        }
      }),
      catchError(error => {
        console.error(`Error getting target with ID ${targetId}:`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get all targets
   * @returns Observable with array of targets
   */
  getAllTargets(): Observable<SalesTarget[]> {
    const collectionRef = collection(this.firestore, this.collectionName);
    return collectionData(collectionRef, { idField: 'id' }).pipe(
      map(targets => targets as SalesTarget[]),
      catchError(error => {
        console.error('Error getting all targets:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get targets for a specific user
   * @param userId The user ID
   * @returns Observable with array of user's targets
   */
  getUserTargets(userId: string): Observable<SalesTarget[]> {
    const collectionRef = collection(this.firestore, this.collectionName);
    const queryRef = query(collectionRef, where('userId', '==', userId));
    
    return collectionData(queryRef, { idField: 'id' }).pipe(
      map(targets => targets as SalesTarget[]),
      catchError(error => {
        console.error(`Error getting targets for user ${userId}:`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get targets for a specific period (month and year)
   * @param year The year
   * @param month The month (1-12)
   * @returns Observable with array of targets for the period
   */
  getTargetsByPeriod(year: number, month: number): Observable<SalesTarget[]> {
    const collectionRef = collection(this.firestore, this.collectionName);
    const queryRef = query(
      collectionRef, 
      where('year', '==', year),
      where('month', '==', month)
    );
    
    return collectionData(queryRef, { idField: 'id' }).pipe(
      map(targets => targets as SalesTarget[]),
      catchError(error => {
        console.error(`Error getting targets for period ${month}/${year}:`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get targets for the current month
   * @returns Observable with array of targets for the current month
   */
  getCurrentMonthTargets(): Observable<SalesTarget[]> {
    const now = new Date();
    return this.getTargetsByPeriod(now.getFullYear(), now.getMonth() + 1);
  }

  /**
   * Update the current value of a user's target
   * @param targetId The target document ID
   * @param currentValue The current achieved value
   * @returns Promise that resolves when complete
   */
  async updateTargetProgress(targetId: string, currentValue: number): Promise<void> {
    try {
      // First get the target to check against the target value
      const targetDoc = await getDoc(doc(this.firestore, this.collectionName, targetId));
      
      if (targetDoc.exists()) {
        const targetData = targetDoc.data() as SalesTarget;
        const isAchieved = currentValue >= targetData.targetValue;
        
        // Update the document
        return this.updateTarget(targetId, {
          currentValue: currentValue,
          isAchieved: isAchieved
        });
      } else {
        throw new Error(`Target with ID ${targetId} not found`);
      }
    } catch (error) {
      console.error(`Error updating target progress for ${targetId}:`, error);
      throw error;
    }
  }

  /**
   * Calculate commission based on sales amount and target ranges
   * @param amount Sales amount
   * @param targetRanges Array of target ranges with commission percentages
   * @returns Calculated commission amount
   */
  calculateCommission(amount: number, targetRanges: TargetRange[]): number {
    if (!targetRanges || targetRanges.length === 0) {
      return 0;
    }
    
    // Sort ranges by fromAmount to ensure proper calculation
    const sortedRanges = [...targetRanges].sort((a, b) => a.fromAmount - b.fromAmount);
    
    // Find the applicable range
    const applicableRange = sortedRanges.find(range => 
      amount >= range.fromAmount && amount <= range.toAmount
    );
    
    if (applicableRange) {
      return (amount * applicableRange.commissionPercent) / 100;
    }
    
    return 0;
  }
}