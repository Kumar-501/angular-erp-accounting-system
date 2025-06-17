// crm.component.ts
import { Component, OnInit } from '@angular/core';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-crm',
  templateUrl: './crm.component.html',
  styleUrl: './crm.component.scss'
})
export class CrmComponent implements OnInit {
  isExecutive = false;

  constructor(private authService: AuthService) {}

  ngOnInit() {
    // Check if current user is executive
    this.authService.getCurrentUser().subscribe(user => {
      this.isExecutive = user?.role?.toLowerCase() === 'executive';
    });
  }

  // Helper method to check if user can see restricted items
  canViewRestrictedItems(): boolean {
    return !this.isExecutive;
  }
}