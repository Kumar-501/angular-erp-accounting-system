import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CustomerService, Customer } from '../services/customer.service';
import { CallLogService } from '../services/call-log.service';
import { CallLog } from '../services/call-log.service';
import { Subscription } from 'rxjs';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-customer-detail',
  templateUrl: './customer-detail.component.html',
  styleUrls: ['./customer-detail.component.scss']
})
export class CustomerDetailComponent implements OnInit, OnDestroy {
  customers: Customer[] = [];
  selectedCustomer: Customer | null = null;
  callLogs: CallLog[] = [];
  callLogForm: FormGroup;
  loading = false;
  loadingCallLogs = false;
  showAddCallLogForm = false;
  private subscriptions: Subscription[] = [];
  currentUserId: string = '';

  constructor(
    private customerService: CustomerService,
    private callLogService: CallLogService,
    private fb: FormBuilder,
    private authService: AuthService // Inject auth service to get current user
  ) {
    this.callLogForm = this.fb.group({
      subject: ['', Validators.required],
      description: ['', Validators.required],
      callType: ['Outbound'], // Default value
      callDuration: [0],
      callOutcome: [''],
      followUpRequired: [false],
      followUpDate: [null],
      tags: [[]]
    });
  }

  ngOnInit(): void {
    this.loading = true;
    
    // Get current user ID (adjust according to your auth implementation)
    this.getCurrentUser();
    
    // Load customers
    const customerSub = this.customerService.getCustomers().subscribe({
      next: (customers) => {
        this.customers = customers;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading customers:', err);
        this.loading = false;
      }
    });
    
    this.subscriptions.push(customerSub);
  }

  ngOnDestroy(): void {
    // Clean up subscriptions to prevent memory leaks
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  getCurrentUser(): void {
    // Replace with your actual auth implementation
    const authSub = this.authService.getCurrentUser().subscribe({
      next: (user) => {
        if (user) {
          this.currentUserId = user.uid;
        }
      },
      error: (err) => {
        console.error('Error getting current user:', err);
      }
    });
    
    this.subscriptions.push(authSub);
  }

  selectCustomer(customer: Customer): void {
    this.selectedCustomer = customer;
    this.loadCallLogs(customer.id!);
    this.showAddCallLogForm = false; // Hide form when switching customers
  }

  loadCallLogs(customerId: string): void {
    this.loadingCallLogs = true;
    
    const callLogSub = this.callLogService.getCallLogsForCustomer(customerId).subscribe({
      next: (logs) => {
        this.callLogs = logs;
        this.loadingCallLogs = false;
      },
      error: (err) => {
        console.error('Error loading call logs:', err);
        this.loadingCallLogs = false;
      }
    });
    
    this.subscriptions.push(callLogSub);
  }

  toggleAddCallLogForm(): void {
    this.showAddCallLogForm = !this.showAddCallLogForm;
    if (this.showAddCallLogForm) {
      this.callLogForm.reset({
        subject: '',
        description: '',
        callType: 'Outbound', // Default value
        callDuration: 0,
        callOutcome: '',
        followUpRequired: false,
        followUpDate: null,
        tags: []
      });
    }
  }

  addCallLog(): void {
    if (this.callLogForm.valid && this.selectedCustomer && this.selectedCustomer.id) {
      this.loading = true;
      
      const callLogData: Omit<CallLog, 'id'> = {
        ...this.callLogForm.value,
        createdAt: new Date(),
        createdBy: this.currentUserId || 'unknown-user' // Fallback if user ID not available
      };
      
      const addLogSub = this.callLogService.addCallLog(this.selectedCustomer.id, callLogData).subscribe({
        next: () => {
          this.loading = false;
          this.toggleAddCallLogForm();
          this.loadCallLogs(this.selectedCustomer!.id!);
        },
        error: (err) => {
          console.error('Error adding call log:', err);
          this.loading = false;
        }
      });
      
      this.subscriptions.push(addLogSub);
    }
  }

  formatDate(timestamp: any): string {
    if (!timestamp) return '';
    
    try {
      // Handle both Firestore Timestamp and Date objects
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleString();
    } catch (err) {
      console.error('Error formatting date:', err);
      return '';
    }
  }

  deleteCallLog(logId: string): void {
    if (!this.selectedCustomer || !this.selectedCustomer.id) return;
    
    if (confirm('Are you sure you want to delete this call log?')) {
      this.loading = true;
      
      const deleteLogSub = this.callLogService.deleteCallLog(this.selectedCustomer.id, logId).subscribe({
        next: () => {
          this.loading = false;
          this.loadCallLogs(this.selectedCustomer!.id!);
        },
        error: (err) => {
          console.error('Error deleting call log:', err);
          this.loading = false;
        }
      });
      
      this.subscriptions.push(deleteLogSub);
    }
  }

  toggleFollowUp(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      // Set default follow-up date to tomorrow if checked
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      this.callLogForm.get('followUpDate')?.setValue(tomorrow);
    } else {
      this.callLogForm.get('followUpDate')?.setValue(null);
    }
  }
}