import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot } from '@angular/router';
import { AuthService } from './auth.service';
import { PermissionService } from './services/permission.service';
@Injectable({
  providedIn: 'root'
})
export class RoleGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private permissionService: PermissionService,
    private router: Router
  ) {}

  async canActivate(
    next: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Promise<boolean> {
    const requiredPermission = next.data['requiredPermission'];
    const requiredRole = next.data['role'];
    const user = this.authService.currentUserValue;

    // Check if user has the required role if specified
    if (requiredRole && user?.role !== requiredRole) {
      this.router.navigate(['/access-denied']);
      return false;
    }

    // Check if user has the required permission
    if (requiredPermission) {
      const hasPermission = await this.permissionService.hasPermission(requiredPermission);
      if (!hasPermission) {
        this.router.navigate(['/access-denied']);
        return false;
      }
    }

    return true;
  }
}