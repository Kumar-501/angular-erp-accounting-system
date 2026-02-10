// src/app/account-home/account-home.component.ts

import { Component, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AccountService } from '../services/account.service';

// Define an interface for the account data we need in this component
interface DisplayAccount {
  id: string;
  name: string;
  currentBalance: number;
}

@Component({
  selector: 'app-account-home',
  templateUrl: './account-home.component.html',
  styleUrls: ['./account-home.component.scss']
})
export class AccountHomeComponent implements OnInit, OnDestroy {
  @ViewChild('scrollContainer') scrollContainer!: ElementRef;
  
  assetAccounts: DisplayAccount[] = [];
  isLoading = true;
  private accountsSub!: Subscription;

  constructor(
    private accountService: AccountService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.loadAssetAccounts();
  }

  ngOnDestroy(): void {
    if (this.accountsSub) {
      this.accountsSub.unsubscribe();
    }
  }

  /**
   * Fetches all accounts, then filters for 'Asset' type accounts to display.
   * This includes cash, bank accounts, and credit cards.
   */
  loadAssetAccounts(): void {
    this.isLoading = true;
    const unsub = this.accountService.getAccounts(allAccounts => {
      this.assetAccounts = allAccounts
        .filter(acc => acc.accountHead?.group === 'Asset')
        .map(acc => ({
          id: acc.id,
          name: acc.name,
          // Use currentBalance if available, otherwise fallback to openingBalance
          currentBalance: acc.currentBalance !== undefined ? acc.currentBalance : acc.openingBalance
        }))
        .sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically
      
      this.isLoading = false;
    });
    // This is a one-time load pattern for a dashboard. If you need real-time updates,
    // you would manage the subscription differently (e.g., this.accountsSub = unsub;)
  }

  /**
   * Navigates to the Account Book page for the selected account.
   * @param accountId The ID of the account to check.
   */
  checkAccountBook(accountId: string): void {
    if (accountId) {
      // Navigate to the account-book route with the account's ID
      this.router.navigate(['/account-book', accountId]);
    } else {
      console.error("Account ID is missing, cannot navigate.");
    }
  }

  /**
   * Scrolls the container of account cards horizontally.
   * @param direction The direction to scroll, 'left' or 'right'.
   */
  scroll(direction: 'left' | 'right'): void {
    const container = this.scrollContainer.nativeElement;
    const scrollAmount = container.clientWidth * 0.8; // Scroll by 80% of the visible width

    if (direction === 'left') {
      container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    } else {
      container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  }
}