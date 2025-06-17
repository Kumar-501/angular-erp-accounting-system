// roles.service.ts
import { Injectable } from '@angular/core';
import { 
  Firestore, 
  collection, 
  addDoc, 
  doc, 
  getDoc, 
  updateDoc, 
  deleteDoc,
  onSnapshot,
  query,
  orderBy
} from '@angular/fire/firestore';
import { Observable, BehaviorSubject } from 'rxjs';

export interface Role {
  id?: string;
  name: string;
  description?: string;
  permissions: {
    [key: string]: {
      view: boolean;
      create: boolean;
      edit: boolean;
      delete: boolean;
    }
  };
  createdAt?: Date;
  updatedAt?: Date;
}

@Injectable({
  providedIn: 'root'
})
export class RolesService {
  private rolesSubject = new BehaviorSubject<Role[]>([]);

  constructor(private firestore: Firestore) {
    this.setupRolesListener();
  }

  private setupRolesListener(): void {
    const rolesCollection = collection(this.firestore, 'roles');
    const q = query(rolesCollection, orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const roles: Role[] = [];
      querySnapshot.forEach((doc) => {
        roles.push({
          id: doc.id,
          ...doc.data()
        } as Role);
      });
      this.rolesSubject.next(roles);
    });

    // You might want to handle unsubscribe when service is destroyed
    // but for a singleton service, it's not strictly necessary
  }

  // Get roles as observable (real-time updates)
  getRoles(): Observable<Role[]> {
    return this.rolesSubject.asObservable();
  }

  // Create a new role
  async createRole(roleData: Omit<Role, 'id'>): Promise<string> {
    try {
      const roleWithTimestamps = {
        ...roleData,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const docRef = await addDoc(collection(this.firestore, 'roles'), roleWithTimestamps);
      return docRef.id;
    } catch (error) {
      console.error('Error creating role:', error);
      throw error;
    }
  }

  // Get a single role by ID
  async getRoleById(roleId: string): Promise<Role | null> {
    try {
      const docRef = doc(this.firestore, 'roles', roleId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Role;
      }
      return null;
    } catch (error) {
      console.error('Error getting role:', error);
      throw error;
    }
  }

  // Update a role
  async updateRole(roleId: string, roleData: Partial<Role>): Promise<void> {
    try {
      const roleDoc = doc(this.firestore, 'roles', roleId);
      await updateDoc(roleDoc, {
        ...roleData,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error updating role:', error);
      throw error;
    }
  }

  // Delete a role
  async deleteRole(roleId: string): Promise<void> {
    try {
      const roleDoc = doc(this.firestore, 'roles', roleId);
      await deleteDoc(roleDoc);
    } catch (error) {
      console.error('Error deleting role:', error);
      throw error;
    }
  }
}