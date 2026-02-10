// fresh-data.guard.ts - Alternative approach
import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class FreshDataGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate(
    next: ActivatedRouteSnapshot,
    state: RouterStateSnapshot): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    
    // Clear any stored form data when navigating to the route
    this.clearFormData();
    return true;
  }

  private clearFormData() {
    // Clear any form-related data from storage
    sessionStorage.removeItem('leaveFormData');
    localStorage.removeItem('leaveFormData');
    sessionStorage.removeItem('formData');
    localStorage.removeItem('formData');
    // Add other form data keys as needed
  }
}