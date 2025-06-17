import { Injectable } from '@angular/core';
import { Firestore, doc, getDoc, updateDoc, deleteDoc, collection, addDoc, onSnapshot, query, where } from '@angular/fire/firestore';
import { inject } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { map, catchError, take } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  getCurrentUser(): unknown {
    throw new Error('Method not implemented.');
  }
  private firestore: Firestore = inject(Firestore);

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
        ...doc.data()
      }));
        observer.next(users);
      });
      return () => unsubscribe();
    });
  }
// In user.service.ts
async getRandomUsersFromDepartment(department: string, count: number): Promise<any[]> {
  const users = await this.getUsers().toPromise(); // Convert Observable to Promise
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