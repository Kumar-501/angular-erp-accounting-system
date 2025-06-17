// header.component.ts
import { Component, EventEmitter, Output, OnInit } from '@angular/core';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit {
  @Output() toggleSidebar = new EventEmitter<void>();
  currentDate: Date = new Date();
  userEmail: string = '';
  userName: string = '';
  showUserMenu: boolean = false;

  constructor(
    private authService: AuthService
  ) {}

  ngOnInit() {
    // Update the date every minutey
    setInterval(() => {
      this.currentDate = new Date();
    }, 60000);

    // Subscribe to current user observable
    this.authService.getCurrentUser().subscribe(user => {
      if (user) {
        this.userEmail = user.email;
        this.userName = user.displayName || user.email.split('@')[0];
      } else {
        this.userEmail = '';
        this.userName = '';
      }
    });
  }

  onToggleSidebar() {
    this.toggleSidebar.emit();
  }

  toggleUserMenu() {
    this.showUserMenu = !this.showUserMenu;
  }

  logout() {
    this.showUserMenu = false;
    this.authService.logout();
    // No need to navigate manually as the authService.logout() already handles navigation
  }
}