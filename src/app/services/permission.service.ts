import { Injectable } from '@angular/core';
import { AuthService } from '../auth.service';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class PermissionService {
  private permissionCache = new Map<string, boolean>();

  constructor(
    private authService: AuthService,
    private firestore: Firestore
  ) {}

  async hasPermission(permission: string): Promise<boolean> {
    // Check cache first
    if (this.permissionCache.has(permission)) {
      return this.permissionCache.get(permission) as boolean;
    }

    const user = this.authService.currentUserValue;
    if (!user || !user.role) return false;

    // For predefined roles like cashier
    if (user.role === 'cashier') {
      const cashierPermissions = this.getCashierPermissions();
      const hasAccess = cashierPermissions.includes(permission);
      this.permissionCache.set(permission, hasAccess);
      return hasAccess;
    }

    // For other roles, check Firestore
    try {
      const roleDoc = await getDoc(doc(this.firestore, 'roles', user.role));
      if (!roleDoc.exists()) {
        this.permissionCache.set(permission, false);
        return false;
      }

      const roleData = roleDoc.data() as any;
      const hasAccess = this.checkPermissionInRole(permission, roleData.permissions);
      this.permissionCache.set(permission, hasAccess);
      return hasAccess;
    } catch (error) {
      console.error('Error checking permissions:', error);
      return false;
    }
  }

  private getCashierPermissions(): string[] {
    return [
      'dashboard.view',
      'sales.view',
      'sales.create',
      'products.view',
      'customers.view'
    ];
  }

  private checkPermissionInRole(permission: string, rolePermissions: any): boolean {
    const parts = permission.split('.');
    let current = rolePermissions;
    
    for (const part of parts) {
      if (current[part] === undefined) {
        return false;
      }
      current = current[part];
    }
    
    return current === true;
  }

  clearCache() {
    this.permissionCache.clear();
  }
}