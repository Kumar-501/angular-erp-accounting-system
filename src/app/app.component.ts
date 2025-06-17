import { Component, OnInit } from '@angular/core';
import { Router, NavigationEnd, NavigationStart } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { Location } from '@angular/common';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'Stellar';
  userEmail: string | null = null;
  currentUrl: string = '';
  previousUrl: string = '';

  constructor(
    private router: Router,
    private authService: AuthService,
    private location: Location
  ) {}

  ngOnInit() {
    // Track navigation for previous and current URL
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.previousUrl = this.currentUrl;
      this.currentUrl = event.urlAfterRedirects;
      
      // If navigating to login page from a protected route
      if (this.currentUrl === '/login' && this.previousUrl.includes('/dashboard')) {
        this.preventForwardNavigation();
      }
    });

    // Handle navigation attempts while on login page
    this.router.events.pipe(
      filter(event => event instanceof NavigationStart)
    ).subscribe((event: any) => {
      // If navigating from login to a protected page without auth
      if (this.isLoginPage() && !this.authService.isLoggedIn() && 
          !event.url.includes('/login') && 
          !event.url.includes('/register') && 
          !event.url.includes('/forgot-password')) {
        this.router.navigate(['/login']);
      }
    });

    // Set user email after login if it's available
    this.authService.getCurrentUser().subscribe(user => {
      if (user) {
        this.setUserEmail(user.email);
      }
    });
  }

  setUserEmail(email: string) {
    console.log('AppComponent storing email:', email);
    this.userEmail = email;
  }

  isLoginPage(): boolean {
    return this.currentUrl === '/login' || this.currentUrl === '/';
  }

  // Prevent forward navigation from login page
  preventForwardNavigation(): void {
    // Replace current state to prevent forward navigation
    this.location.replaceState('/login');
    
    // Update browser history to prevent forward navigation
    history.pushState(null, '', window.location.href);
  }
}
