// src/app/services/account-data.service.ts

import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AccountDataService {

  // A BehaviorSubject holds the "current" list of accounts.
  // It starts with an empty array [].
  private accountsSource = new BehaviorSubject<any[]>([]);

  // Other components can subscribe to this to get real-time updates.
  public currentAccounts = this.accountsSource.asObservable();

  constructor() { }

  // This function is used to UPDATE the list of accounts from anywhere.
  updateAccounts(accounts: any[]) {
    this.accountsSource.next(accounts);
  }
}