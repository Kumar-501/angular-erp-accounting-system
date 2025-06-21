import { Injectable } from '@angular/core';
import { Firestore, doc, getDoc, updateDoc, deleteDoc, collection, addDoc, onSnapshot, query, where } from '@angular/fire/firestore';
import { inject } from '@angular/core';
import { Observable, BehaviorSubject, from, of } from 'rxjs';
import { map, catchError, take } from 'rxjs/operators';
import { AuthService } from '../auth.service';

export interface User {
  id?: string;
  username: string;
  email: string;
  displayName?: string;
  shift?: string;
  firstName?: string;
  lastName?: string;
  department?: string;
  role?: string;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private firestore: Firestore = inject(Firestore);
  private currentUserSubject = new BehaviorSubject<User | null>(null);

  constructor(private authService: AuthService) {
    // Initialize current user from auth service
    this.initializeCurrentUser();
  }

  private initializeCurrentUser() {
    this.authService.getCurrentUser().subscribe(authUser => {
      if (authUser) {
        // Convert auth user to our User interface
        const user: User = {
          id: authUser.uid,
          username: authUser.displayName || authUser.email?.split('@')[0] || '',
          email: authUser.email || '',
          displayName: authUser.displayName || authUser.email?.split('@')[0] || '',
          shift: (authUser as any).shift || '',
          department: authUser.department || '',
          role: authUser.role || ''
        };
        this.currentUserSubject.next(user);
      } else {
        this.currentUserSubject.next(null);
      }
    });
  }

  // Get current authenticated user
  getCurrentUser(): Observable<User | null> {
    return this.currentUserSubject.asObservable();
  }

  // Add a new user to Firestore
  async addUser(userData: any): Promise<any> {
    try {
      const userCollection = collection(this.firestore, 'users');
      const docRef = await addDoc(userCollection, userData);
      return docRef;
    } catch (error) {
      console.error('Error adding user: ', error);
      throw error;
    }
  }

  // Get all users (real-time updates using onSnapshot)
  getUsers(): Observable<any[]> {
    const userCollection = collection(this.firestore, 'users');
    return new Observable(observer => {
      const unsubscribe = onSnapshot(userCollection, snapshot => {
        const users = snapshot.docs.map(doc => ({
          id: doc.id,
          firstName: doc.data()['firstName'],
          lastName: doc.data()['lastName'],
          username: doc.data()['username'] || doc.data()['email']?.split('@')[0] || '',
          email: doc.data()['email'] || '',
          displayName: doc.data()['displayName'] || doc.data()['firstName'] + ' ' + doc.data()['lastName'] || doc.data()['username'] || '',
          ...doc.data()
        }));
        observer.next(users);
      });
      return () => unsubscribe();
    });
  }

  // In user.service.ts
  async getRandomUsersFromDepartment(department: string, count: number): Promise<any[]> {
    const users = await this.getUsers().pipe(take(1)).toPromise(); // Convert Observable to Promise
    if (!users) return [];
    
    const departmentUsers = users.filter((user: any) => 
      user.department === department && 
      user.role === 'Executive'
    );
    
    // Shuffle and take 'count' users
    const shuffled = departmentUsers.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  // Get users with filtering (optional)
  getUsersWithFilter(field: string, value: any): Observable<any[]> {
    const userCollection = collection(this.firestore, 'users');
    const q = query(userCollection, where(field, '==', value));
    return new Observable(observer => {
      const unsubscribe = onSnapshot(q, snapshot => {
        const users = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        observer.next(users);
      });
      return () => unsubscribe();
    });
  }

  // user.service.ts
  getRandomUsers(count: number): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const usersCollection = collection(this.firestore, 'users');
      const q = query(usersCollection);
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const allUsers = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // Shuffle array and get first 'count' elements
        const shuffled = [...allUsers].sort(() => 0.5 - Math.random());
        resolve(shuffled.slice(0, count));
        unsubscribe();
      }, (error) => {
        reject(error);
      });
    });
  }

  // Get a user by ID with real-time updates
  getUserById(userId: string): Observable<any> {
    const userDoc = doc(this.firestore, 'users', userId);
    return new Observable(observer => {
      const unsubscribe = onSnapshot(userDoc, (snapshot) => {
        if (snapshot.exists()) {
          observer.next({ id: snapshot.id, ...snapshot.data() });
        } else {
          observer.next(null);
        }
      });
      return () => unsubscribe();
    }).pipe(take(1));
  }

  // Get a user by ID (single fetch)
  getUserByIdOnce(userId: string): Observable<any> {
    const userDoc = doc(this.firestore, 'users', userId);
    return from(getDoc(userDoc)).pipe(
      map(snapshot => {
        if (snapshot.exists()) {
          return { id: snapshot.id, ...snapshot.data() };
        } else {
          throw new Error('User not found');
        }
      }),
      catchError(error => {
        console.error('Error getting user:', error);
        return of(null);
      })
    );
  }

  // Update an existing user
  async updateUser(userId: string, userData: any): Promise<void> {
    try {
      // Clean up data before saving
      const dataToUpdate = { ...userData };
      if (!dataToUpdate.password) {
        delete dataToUpdate.password; // Don't update password if not changed
      }
      delete dataToUpdate.confirmPassword; // Never save confirmPassword

      const userDoc = doc(this.firestore, 'users', userId);
      await updateDoc(userDoc, dataToUpdate);
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  // Delete a user from Firestore
  async deleteUser(userId: string): Promise<void> {
    try {
      const userDoc = doc(this.firestore, 'users', userId);
      await deleteDoc(userDoc);
    } catch (error) {
      console.error('Error deleting user: ', error);
      throw error;
    }
  }
}