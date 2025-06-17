import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../auth.service';
import { AppComponent } from '../app.component';
import { Router, NavigationStart } from '@angular/router';
import { Location } from '@angular/common';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  errorMessage: string = '';
  loading = false;
  showPassword = false;
  rememberMe = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private appComponent: AppComponent,
    private router: Router,
    private location: Location
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });

    // Prevent forward navigation when on login page
    this.preventForwardNavigation();
  }

  ngOnInit(): void {
    // Check for remembered credentials
    const savedEmail = localStorage.getItem('rememberedEmail');
    if (savedEmail) {
      this.loginForm.patchValue({ email: savedEmail });
      this.rememberMe = true;
    }
  }

  // Method to prevent forward navigation from login page
  preventForwardNavigation(): void {
    // Add listener for popstate events (browser back/forward)
    window.addEventListener('popstate', (event) => {
      // If we're on the login page and user isn't authenticated
      if (this.router.url === '/login' && !this.authService.isLoggedIn()) {
        // Push login page to history again to prevent forward navigation
        setTimeout(() => {
          this.location.replaceState('/login');
        }, 0);
      }
    });

    // Subscribe to router navigation events
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        // If user tries to navigate away from login page without authentication
        if (this.router.url === '/login' && !this.authService.isLoggedIn() && 
            !event.url.includes('/login') && 
            !event.url.includes('/register') && 
            !event.url.includes('/forgot-password')) {
          // Block the navigation and stay on login page
          this.router.navigate(['/login']);
        }
      }
    });

    // Implement forward navigation prevention using history API
    history.pushState(null, '', window.location.href);
    window.onpopstate = () => {
      if (!this.authService.isLoggedIn()) {
        history.pushState(null, '', window.location.href);
      }
    };
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  async onSubmit() {
    this.errorMessage = '';
    if (this.loginForm.valid) {
      this.loading = true;
      const { email, password } = this.loginForm.value;
      
      // Handle Remember Me functionality
      if (this.rememberMe) {
        localStorage.setItem('rememberedEmail', email);
      } else {
        localStorage.removeItem('rememberedEmail');
      }
      
      try {
        const success = await this.authService.login(email, password);
        if (success) {
          this.appComponent.setUserEmail(email);
          this.router.navigate(['/dashboard']);
        } else {
          this.errorMessage = 'Invalid credentials';
        }
      } catch (error) {
        this.errorMessage = 'Login failed. Please try again.';
        console.error('Login error:', error);
      } finally {
        this.loading = false;
      }
    } else {
      // Mark form controls as touched to trigger validation messages
      Object.keys(this.loginForm.controls).forEach(key => {
        this.loginForm.get(key)?.markAsTouched();
      });
    }
  }

  onForgotPassword(event: Event): void {
    event.preventDefault();
    // Handle forgot password functionality
    this.router.navigate(['/forgot-password']);
  }


}