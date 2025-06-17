import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot } from '@angular/router';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(
    next: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): boolean {
    // Check if user is logged in via sessionStorage (using authService)
    if (this.authService.isLoggedIn()) {
      // Check if route has required permissions defined in route data
      const requiredPermissions = next.data['permissions'] || [];

      // If the route requires specific permissions, check if the user has them
      if (requiredPermissions.length > 0 && !this.authService.hasAnyPermission(requiredPermissions)) {
        // If user does not have required permissions, redirect to forbidden page or any other page
        this.router.navigate(['/forbidden']);
        return false;
      }

      // If no permissions are required or the user has them, allow access
      return true;
    }

    // If user is not logged in, redirect to login page with a returnUrl to redirect after login
    this.router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }
}
