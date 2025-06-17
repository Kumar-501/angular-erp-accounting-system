// notification.service.ts
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  showSuccess(message: string): void {
    // You can implement this with toast notifications, alerts, etc.
    console.log('Success:', message);
    alert(`Success: ${message}`);
  }

  showError(message: string): void {
    console.error('Error:', message);
    alert(`Error: ${message}`);
  }
}