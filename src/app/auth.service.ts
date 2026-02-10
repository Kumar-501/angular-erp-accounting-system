import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Firestore, collection, query, where, getDocs, doc, getDoc } from '@angular/fire/firestore';
import { BehaviorSubject, Observable } from 'rxjs';

interface User {
  userRole?: string;
  uid: string;
  email: string;
  department?: string;
  displayName?: string;
  username?: string;
  role?: string;
  permissions?: any;
  businessId?: string;
  locations?: string[]; 
  allLocations?: boolean; 
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public authState$: Observable<User | null> = this.currentUserSubject.asObservable(); 
  private isAuthenticated = false;
  private permissionCache = new Map<string, boolean>();

  private rolePermissions = {
    admin: {
      all: true,
      sales: { viewAll: true, editAll: true, deleteAll: true },
      customers: { viewAll: true, editAll: true, deleteAll: true }
    },
    supervisor: {
      sales: { viewDepartment: true, editDepartment: true },
      customers: { viewDepartment: true, editDepartment: true },
      dashboard: { view: true },
      reports: { view: true }
    },
    executive: {
      sales: { viewOwn: true, create: true, editOwn: true },
      customers: { viewOwn: true, editOwn: true },
      dashboard: { view: true }
    }
  };

  constructor(private router: Router, private firestore: Firestore) {
    this.loadUserFromStorage();
  }

  isAdmin(): boolean {
    const user = this.currentUserSubject.value;
    return user?.role?.toLowerCase() === 'admin';
  }

  private async loadUserFromStorage(): Promise<void> {
    // CHANGED: Use localStorage instead of sessionStorage to persist login across tabs
    const storedUser = localStorage.getItem('currentUser'); 
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        this.currentUserSubject.next(user);
        this.isAuthenticated = true;
      } catch (e) {
        localStorage.removeItem('currentUser'); 
        this.currentUserSubject.next(null);
        this.isAuthenticated = false;
      }
    } else {
      this.currentUserSubject.next(null);
    }
  }

  async login(email: string, password: string): Promise<boolean> {
    try {
      // CHANGED: Clear localStorage
      localStorage.removeItem('formData');
      
      const usersRef = collection(this.firestore, 'users');
      const q = query(usersRef, where('email', '==', email), where('password', '==', password));

      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        const userData = userDoc.data();
        
        let permissions = {};
        if (userData['role'] && this.rolePermissions[userData['role'] as keyof typeof this.rolePermissions]) {
          permissions = this.rolePermissions[userData['role'] as keyof typeof this.rolePermissions];
        } else if (userData['role']) {
          const roleDoc = await getDoc(doc(this.firestore, 'roles', userData['role']));
          if (roleDoc.exists()) {
            permissions = roleDoc.data()['permissions'] || {};
          }
        }
        
        const userLocations = userData['locations'] || [];
        const allLocations = userData['allLocations'] || false;
        
        const user: User = {
          uid: userDoc.id,
          email: userData['email'],
          displayName: userData['displayName'] || userData['name'] || email.split('@')[0],
          role: userData['role'] || 'user',
          department: userData['department'] || '',
          permissions: permissions,
          businessId: userData['businessId'] || null,
          locations: userLocations,
          allLocations: allLocations,
          userRole: undefined
        };

        // CHANGED: Set to localStorage so new tabs can access this data
        localStorage.setItem('currentUser', JSON.stringify(user));
        this.currentUserSubject.next(user); 
        this.isAuthenticated = true;
        this.permissionCache.clear();

        this.clearFormData();

        if (user.role === 'cashier') {
          this.router.navigate(['/add-sale']);
        } else if (user.role === 'accountant') {
          this.router.navigate(['/list-accounts']);
        } else {
          this.router.navigate(['/dashboard']);
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  }

  private clearFormData() {
    // CHANGED: Use localStorage
    localStorage.removeItem('leaveFormData');
    localStorage.removeItem('formData');
  }
  
  logout(): void {
    // CHANGED: Use localStorage
    localStorage.removeItem('currentUser'); 
    this.currentUserSubject.next(null);
    this.isAuthenticated = false;
    this.permissionCache.clear();
    this.router.navigate(['/login']);
  }

  // Rest of your helper methods remain the same...
  isAccountant(): boolean {
    const user = this.currentUserSubject.value;
    return user?.role === 'accountant';
  }

  isCashier(): boolean {
    const user = this.currentUserSubject.value;
    return user?.role === 'cashier';
  }

  hasAnyPermission(permissions: string[]): boolean {
    return permissions.some(p => this.hasPermission(p));
  }
  
  hasPermission(permission: string): boolean {
    const user = this.currentUserSubject.value;
    if (!user || !user.permissions) return false;
    if (user.role === 'admin') return true;
  
    const parts = permission.split('.');
    let current = user.permissions;
    for (const part of parts) {
      if (current[part] === undefined) return false;
      current = current[part];
    }
    return current === true;
  }

  getUserLocations(): string[] {
    const user = this.currentUserSubject.value;
    return user?.allLocations ? ['all'] : user?.locations || [];
  }

  getUserAllowedLocations(): string[] {
    const user = this.currentUserSubject.value;
    if (!user || user.allLocations) return [];
    return user.locations || [];
  }

  hasLocationAccess(locationId: string): boolean {
    const user = this.currentUserSubject.value;
    if (!user) return false;
    if (user.allLocations) return true;
    return user.locations?.includes(locationId) || false;
  }

  hasAllPermissions(permissions: string[]): boolean {
    return permissions.every(p => this.hasPermission(p));
  }

  canAccessRoute(routePermissions: string[]): boolean {
    if (!routePermissions || routePermissions.length === 0) return true;
    return this.hasAnyPermission(routePermissions);
  }

  getCurrentUser(): Observable<User | null> {
    return this.currentUserSubject.asObservable();
  }

  hasRole(role: string): boolean {
    const user = this.currentUserSubject.value;
    return user?.role?.toLowerCase() === role.toLowerCase();
  }

  getCurrentUserId(): string {
    const user = this.currentUserSubject.value;
    return user?.uid || '';
  }

  getCurrentUserName(): string {
    const user = this.currentUserSubject.value;
    return user?.displayName || '';
  }

  get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  isLoggedIn(): boolean {
    return !!this.currentUserSubject.value && this.isAuthenticated;
  }

  async getUserById(userId: string): Promise<User | null> {
    try {
      const userDoc = await getDoc(doc(this.firestore, 'users', userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        return {
          uid: userDoc.id,
          email: userData['email'],
          displayName: userData['displayName'] || userData['name'] || userData['email'].split('@')[0],
          role: userData['role'] || 'user',
          businessId: userData['businessId'] || null,
          locations: userData['locations'] || [],
          allLocations: userData['allLocations'] || false
        };
      }
      return null;
    } catch (error) {
      console.error('Error getting user by ID:', error);
      return null;
    }
  }
}