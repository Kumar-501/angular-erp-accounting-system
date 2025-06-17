import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CustomerService } from '../services/customer.service';
import { SaleService } from '../services/sale.service';
import { Address, Customer } from '../models/customer.model';
import { DatePipe } from '@angular/common';
import { AuthService } from '../auth.service';
import { Subscription } from 'rxjs';
import { FollowUpService } from '../services/follow-up.service';
import { UserService } from '../services/user.service';
import { SalesOrder } from '../models/sales-order.model';
interface ExtendedSalesOrder extends SalesOrder {
  shippingCharges?: number;
  shippingDetails?: string;
  shippingStatus?: string;
}


@Component({
  selector: 'app-customer-view',
  templateUrl: './customer-view.component.html',
  styleUrls: ['./customer-view.component.scss'],
  providers: [DatePipe]
})
export class CustomerViewComponent implements OnInit, OnDestroy {
  customer: Customer | null = null;
  isLoading = true;
  showDepartmentModal = false;
  showAddDepartmentModal = false;
  availableDepartments: string[] = ['PC1', 'PC2', 'PC3', 'PC4', 'PC5', 'PC6', 'PC7', 'PC8'];
  selectedDepartment = '';
  newDepartmentName = '';
  showAddFollowUpModal = false;
  isSavingFollowUp = false;
  showLifeStageModal = false;
showLeadCategoryModal = false;
showAlternateContactModal = false;
selectedAlternateContact = '';
selectedLifeStage = '';
selectedLeadCategory = '';
availableLifeStages: string[] = ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiation', 'Closed Won', 'Closed Lost'];
availableLeadCategories: string[] = ['Diabetes', 'Cholestrol', 'Blood Pressure', 'Digestion', 'Kshara Karma', 'SkinDisease'];

  availableUsers: any[] = [];
  customerFollowUps: any[] = [];
  followUpForm: FormGroup;
  editFollowUpForm: FormGroup; // Fixed: properly declared as non-optional
  newDepartmentError = '';
  address?: string;
  notes?: string;
  callLogForm: FormGroup;
  showAddCallLogForm = false;
  isAddingCallLog = false;
  currentUserId = '';
  callLogs: any[] = [];
  private callLogsSubscription: Subscription | null = null;
  private customerSubscription: Subscription | null = null;
  private customerSalesSubscription: Subscription | null = null;
  isUpdatingStatus = false;
  activeTab: 'info' | 'calls' | 'purchases' | 'followups' = 'info';
  customerSales: any[] = [];
  isSalesLoading = false;
  expandedSaleId: string | null = null;
  customerId: string | null = null;
  
  // Adding missing properties for follow-up functionality
  showRescheduleModal = false;
  newFollowUpDate: string | null = null;
  selectedFollowUpLog: any = null;
  purchaseStatusFilter = 'completed'; // Default to show only completed sales
  purchaseSearchTerm = '';
  filteredCustomerSales: any[] = [];
  currentPurchasePage = 1;
  purchasesPerPage = 10;
  totalPurchasePages = 1;
  isLoadingFollowUps = false;
  showViewFollowUpModal = false;
  selectedFollowUp: any = null;
  showEditFollowUpModal = false;
  isUpdatingFollowUp = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private customerService: CustomerService,
    private saleService: SaleService,
    public datePipe: DatePipe,
    private followUpService: FollowUpService,
    private userService: UserService,
    private fb: FormBuilder,
    private authService: AuthService
  ) {
    // Initialize the call log form
    this.callLogForm = this.fb.group({
      subject: ['', Validators.required],
      description: ['', Validators.required],
      callType: ['Outbound'], // Default value
      callDuration: [0],
      callOutcome: [''],
      followUpRequired: [false],
      followUpDate: [null]
    });
    
    this.followUpForm = this.fb.group({
      title: ['', Validators.required],
      status: ['Pending', Validators.required],
      startDatetime: ['', Validators.required],
      endDatetime: ['', Validators.required],
      description: [''],
      assignedTo: [''],
      sendNotification: [false]
    });
    interface Address {
      street?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
      total?: number;
      subtotal?: number;
      tax?: number;
      shippingCost?: number;
      balance?: number;
      
    }
    
    // Fixed: Initialize editFollowUpForm properly
    this.editFollowUpForm = this.fb.group({
      title: ['', Validators.required],
      status: ['Pending', Validators.required],
      startDatetime: ['', Validators.required],
      endDatetime: ['', Validators.required],
      description: [''],
      assignedTo: [''],
      sendNotification: [false]
    });
  }

  ngOnInit(): void {
    this.customerId = this.route.snapshot.paramMap.get('id');
    if (this.customerId) {
      this.loadCustomer(this.customerId);
      this.loadCallLogs(this.customerId);
      this.loadCustomerFollowUps(this.customerId);
    }
    this.getCurrentUser();
  }
openLifeStageModal(): void {
  this.selectedLifeStage = this.customer?.lifeStage || '';
  this.showLifeStageModal = true;
}
closeLifeStageModal(): void {
  this.showLifeStageModal = false;
  this.selectedLifeStage = '';
}
updateLifeStage(): void {
  if (!this.customer?.id || !this.selectedLifeStage || this.isUpdatingStatus) return;
  
  this.isUpdatingStatus = true;
  
  this.customerService.updateCustomer(this.customer.id, { 
    lifeStage: this.selectedLifeStage 
  })
    .then(() => {
      if (this.customer) {
        this.customer.lifeStage = this.selectedLifeStage;
      }
      this.closeLifeStageModal();
      this.isUpdatingStatus = false;
    })
    .catch(error => {
      console.error('Failed to update life stage:', error);
      this.isUpdatingStatus = false;
    });
}
openLeadCategoryModal(): void {
  this.selectedLeadCategory = this.customer?.leadCategory || '';
  this.showLeadCategoryModal = true;
}

closeLeadCategoryModal(): void {
  this.showLeadCategoryModal = false;
  this.selectedLeadCategory = '';
}updateLeadCategory(): void {
  if (!this.customer?.id || !this.selectedLeadCategory || this.isUpdatingStatus) return;
  
  this.isUpdatingStatus = true;
  
  this.customerService.updateCustomer(this.customer.id, { 
    leadCategory: this.selectedLeadCategory 
  })
    .then(() => {
      if (this.customer) {
        this.customer.leadCategory = this.selectedLeadCategory;
      }
      this.closeLeadCategoryModal();
      this.isUpdatingStatus = false;
    })
    .catch(error => {
      console.error('Failed to update lead category:', error);
      this.isUpdatingStatus = false;
    });
}
openAlternateContactModal(): void {
  this.selectedAlternateContact = this.customer?.alternateContact || '';
  this.showAlternateContactModal = true;
}

closeAlternateContactModal(): void {
  this.showAlternateContactModal = false;
  this.selectedAlternateContact = '';
}

updateAlternateContact(): void {
  if (!this.customer?.id || this.isUpdatingStatus) return;
  
  this.isUpdatingStatus = true;
  
  this.customerService.updateCustomer(this.customer.id, { 
    alternateContact: this.selectedAlternateContact 
  })
    .then(() => {
      if (this.customer) {
        this.customer.alternateContact = this.selectedAlternateContact;
      }
      this.closeAlternateContactModal();
      this.isUpdatingStatus = false;
    })
    .catch(error => {
      console.error('Failed to update alternate contact:', error);
      this.isUpdatingStatus = false;
    });
}
  ngOnDestroy(): void {
    // Clean up subscriptions to prevent memory leaks
    if (this.callLogsSubscription) {
      this.callLogsSubscription.unsubscribe();
    }
    if (this.customerSubscription) {
      this.customerSubscription.unsubscribe();
    }
    if (this.customerSalesSubscription) {
      this.customerSalesSubscription.unsubscribe();
    }
  }
  
  // Add the missing method implementations
  viewFollowUpDetails(followUp: any): void {
    this.selectedFollowUp = followUp;
    this.showViewFollowUpModal = true;
  }
  
  closeViewFollowUpModal(): void {
    this.showViewFollowUpModal = false;
    this.selectedFollowUp = null;
  }
  
  editSelectedFollowUp(): void {
    if (!this.selectedFollowUp) return;
    
    this.showViewFollowUpModal = false;
    this.showEditFollowUpModal = true;
    
    this.editFollowUpForm.patchValue({
      title: this.selectedFollowUp.title,
      status: this.selectedFollowUp.status,
      startDatetime: this.selectedFollowUp.startDatetime,
      endDatetime: this.selectedFollowUp.endDatetime,
      description: this.selectedFollowUp.description,
      assignedTo: this.selectedFollowUp.assignedTo,
      sendNotification: this.selectedFollowUp.sendNotification || false
    });
  }
  
  closeEditFollowUpModal(): void {
    this.showEditFollowUpModal = false;
    this.editFollowUpForm.reset({
      status: 'Pending',
      sendNotification: false
    });
  }
  
  updateFollowUp(): void {
    if (this.editFollowUpForm.invalid || !this.selectedFollowUp?.id) return;
    
    this.isUpdatingFollowUp = true;
    
    const followUpData = {
      ...this.editFollowUpForm.value,
      updatedAt: new Date().toISOString()
    };
    
    this.followUpService.updateFollowUp(this.selectedFollowUp.id, followUpData)
      .then(() => {
        this.isUpdatingFollowUp = false;
        this.closeEditFollowUpModal();
        if (this.customer?.id) {
          this.loadCustomerFollowUps(this.customer.id);
        }
      })
      .catch((error: any) => {
        console.error('Failed to update follow-up:', error);
        this.isUpdatingFollowUp = false;
      });
  }
  
  getAllFollowUps(): any[] {
    return [...this.customerFollowUps, ...this.getFollowUpLogs()];
  }
  
  // Get current user ID
  getCurrentUser(): void {
    this.authService.getCurrentUser().subscribe({
      next: (user) => {
        if (user) {
          this.currentUserId = user.uid;
        }
      },
      error: (err) => {
        console.error('Error getting current user:', err);
      }
    });
  }
  loadCustomer(id: string): void {
    this.isLoading = true;
    
    if (this.customerSubscription) {
      this.customerSubscription.unsubscribe();
    }
    
    this.customerSubscription = this.customerService.getCustomerById(id).subscribe({
      next: (customer) => {
        if (customer) {
          // Process address data
          const billingAddress: Address = typeof customer.billingAddress === 'string' 
            ? {} 
            : customer.billingAddress || {};
          
          const shippingAddress: Address = typeof customer.shippingAddress === 'string'
            ? {}
            : customer.shippingAddress || {};
  
          // If billing/shipping address is empty but we have addressLine1, use that
          if (!billingAddress.street && customer.addressLine1) {
            billingAddress.street = customer.addressLine1;
            billingAddress.city = customer.city;
            billingAddress.state = customer.state;
            billingAddress.postalCode = customer.zipCode;
            billingAddress.country = customer.country;
          }
  
          if (!shippingAddress.street && customer.addressLine1) {
            shippingAddress.street = customer.addressLine1;
            shippingAddress.city = customer.city;
            shippingAddress.state = customer.state;
            shippingAddress.postalCode = customer.zipCode;
            shippingAddress.country = customer.country;
          }
  
          this.customer = {
            ...customer,
            department: customer.department || '',
            isIndividual: customer.isIndividual ?? !customer.businessName,
            lastCallTime: customer.lastCallTime ? 
              (this.isFirebaseTimestamp(customer.lastCallTime) ? 
                this.convertToDate(customer.lastCallTime) : 
                new Date(customer.lastCallTime)) : 
              undefined,
            callCount: customer.callCount || 0,
            currentState: customer.currentState || '-',
            billingAddress: billingAddress,
            shippingAddress: shippingAddress,
            address: customer.address || '',
              alternateContact: customer.alternateContact || '-', 

            notes: customer.notes || ''
          } as Customer;
          
          // Load sales data after customer is loaded
          if (!this.customerSalesSubscription && this.activeTab === 'purchases') {
            this.loadCustomerSales(id);
          }
        } else {
          this.customer = null;
        }
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Failed to load customer', err);
        this.isLoading = false;
      }
    });
  }

  // Helper method to check if an object is a Firebase timestamp
  isFirebaseTimestamp(obj: any): boolean {
    return obj && typeof obj === 'object' && typeof obj.toDate === 'function';
  }

  // Helper method to convert Firebase timestamp to Date
  convertToDate(timestamp: any): Date {
    if (timestamp instanceof Date) {
      return timestamp;
    }
    if (this.isFirebaseTimestamp(timestamp)) {
      return timestamp.toDate();
    }
    return new Date(timestamp);
  }

  // Department modal methods
  openDepartmentModal(): void {
    this.selectedDepartment = this.customer?.department || '';
    this.showDepartmentModal = true;
  }

  closeDepartmentModal(): void {
    this.showDepartmentModal = false;
    this.selectedDepartment = '';
  }
  
  closeAddFollowUpModal(): void {
    this.showAddFollowUpModal = false;
    this.followUpForm.reset({
      status: 'Pending',
      sendNotification: false
    });
  }
  
  updateDepartment(): void {
    if (!this.customer?.id || !this.selectedDepartment) return;
    
    this.customerService.updateCustomer(this.customer.id, { 
      department: this.selectedDepartment 
    }).then(() => {
      if (this.customer) {
        this.customer.department = this.selectedDepartment;
      }
      this.closeDepartmentModal();
    }).catch(error => {
      console.error('Failed to update department:', error);
    });
  }
  
  loadCustomerFollowUps(customerId: string): void {
    if (!customerId) return;
    
    this.isLoadingFollowUps = true;
    
    this.followUpService.getFollowUpsByLeadId(customerId)
      .then((followUps: any[]) => {
        this.customerFollowUps = followUps;
        this.isLoadingFollowUps = false;
      })
      .catch((err: any) => {
        console.error('Failed to load follow-ups:', err);
        this.isLoadingFollowUps = false;
      });
  }
  
  saveFollowUp(): void {
    if (this.followUpForm.invalid || !this.customer?.id) return;
  
    this.isSavingFollowUp = true;
    
    const followUpData = {
      ...this.followUpForm.value,
      customerLead: this.customer.id,
      addedBy: this.currentUserId,
      addedOn: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  
    this.followUpService.addFollowUp(followUpData)
      .then(() => {
        this.isSavingFollowUp = false;
        this.closeAddFollowUpModal();
        if (this.customer?.id) {
          this.loadCustomerFollowUps(this.customer.id);
        }
      })
      .catch((error: any) => {
        console.error('Failed to save follow-up:', error);
        this.isSavingFollowUp = false;
      });
  }
  
  addNewDepartment(): void {
    this.showDepartmentModal = false;
    this.newDepartmentName = '';
    this.newDepartmentError = '';
    this.showAddDepartmentModal = true;
  }

  closeAddDepartmentModal(): void {
    this.showAddDepartmentModal = false;
    this.newDepartmentName = '';
    this.newDepartmentError = '';
  }

  saveNewDepartment(): void {
    if (!this.newDepartmentName) {
      this.newDepartmentError = 'Please enter a department name';
      return;
    }

    if (this.availableDepartments.includes(this.newDepartmentName)) {
      this.newDepartmentError = 'Department already exists';
      return;
    }

    this.availableDepartments.push(this.newDepartmentName);
    this.selectedDepartment = this.newDepartmentName;
    this.closeAddDepartmentModal();
    this.showDepartmentModal = true;
  }
  
  getUserName(userId: string): string {
    const user = this.availableUsers.find(u => u.id === userId);
    return user ? user.name : 'Unknown';
  }

  editFollowUp(followUp: any): void {
    // Implement edit functionality if needed
    console.log('Edit follow-up:', followUp);
  }

  deleteFollowUp(followUpId: string): void {
    if (confirm('Are you sure you want to delete this follow-up?')) {
      this.followUpService.deleteFollowUp(followUpId)
        .then(() => {
          this.customerFollowUps = this.customerFollowUps.filter(f => f.id !== followUpId);
        })
        .catch((error: any) => {
          console.error('Failed to delete follow-up:', error);
        });
    }
  }

  // Call log methods
loadCallLogs(customerId: string): void {
    // Clean up previous subscription if it exists
    if (this.callLogsSubscription) {
        this.callLogsSubscription.unsubscribe();
    }
    
    this.callLogsSubscription = this.customerService.getCallLogsForCustomer(customerId).subscribe({
        next: (logs) => {
            this.callLogs = logs.map(log => ({
                ...log,
                createdAt: this.isFirebaseTimestamp(log.createdAt) ? 
                          this.convertToDate(log.createdAt) : 
                          new Date(log.createdAt || Date.now()),
                followUpDate: this.isFirebaseTimestamp(log.followUpDate) ? 
                          this.convertToDate(log.followUpDate) : 
                          log.followUpDate ? new Date(log.followUpDate) : null
            }));
            
            // Sort call logs by date (newest first)
            this.callLogs.sort((a, b) => {
                return b.createdAt.getTime() - a.createdAt.getTime();
            });

            // Update the customer's call count to match the actual logs
            if (this.customer) {
                this.customer.callCount = this.callLogs.length;
                // Update the customer record in the database
                this.customerService.updateCustomer(this.customer.id!, {
                    callCount: this.callLogs.length,
                    lastCallTime: this.callLogs.length > 0 ? 
                                 this.callLogs[0].createdAt : 
                                 null
                }).catch(err => console.error('Error updating call count:', err));
            }
        },
        error: (err) => {
            console.error('Failed to load call logs', err);
        }
    });
}
  
  openAddFollowUpModal(): void {
    this.loadAvailableUsers();
    this.showAddFollowUpModal = true;
  }
  
  loadAvailableUsers(): void {
    this.userService.getUsers().subscribe({
      next: (users: any[]) => {
        this.availableUsers = users.map(user => ({
          id: user.id,
          name: `${user.firstName} ${user.lastName}`
        }));
      },
      error: (err: any) => {
        console.error('Failed to load users:', err);
      }
    });
  }
  
  // Purchase-related methods - fixing access modifiers
  applyPurchaseFilters(): void {
    if (!this.customerSales) {
      this.filteredCustomerSales = [];
      return;
    }

    // Apply status filter
    let filtered = this.customerSales;
    if (this.purchaseStatusFilter !== 'all') {
      filtered = filtered.filter(sale => sale.status.toLowerCase() === this.purchaseStatusFilter);
    }

    // Apply search term
    if (this.purchaseSearchTerm) {
      const term = this.purchaseSearchTerm.toLowerCase();
      filtered = filtered.filter(sale => 
        sale.invoiceNo?.toLowerCase().includes(term) ||
        this.getProductsDisplayText(sale.products).toLowerCase().includes(term)
      );
    }

    this.filteredCustomerSales = filtered;
    this.totalPurchasePages = Math.ceil(this.filteredCustomerSales.length / this.purchasesPerPage);
    this.currentPurchasePage = 1;
  }

  getPaginatedPurchases(): any[] {
    const startIndex = (this.currentPurchasePage - 1) * this.purchasesPerPage;
    const endIndex = startIndex + this.purchasesPerPage;
    return this.filteredCustomerSales.slice(startIndex, endIndex);
  }

  previousPurchasePage(): void {
    if (this.currentPurchasePage > 1) {
      this.currentPurchasePage--;
    }
  }

  nextPurchasePage(): void {
    if (this.currentPurchasePage < this.totalPurchasePages) {
      this.currentPurchasePage++;
    }
  }

  viewSaleDetails(sale: any): void {
    // You can implement a modal or navigate to a sale details page
    console.log('View sale details:', sale);
    // Or open a modal:
    // this.selectedSale = sale;
    // this.saleDetailsModal.show();
  }

  // Load customer sales - fixing duplicate function and property errors
// Then in your method:
// In your loadCustomerSales method, make sure to include shipping details
// In your customer-view.component.ts
loadCustomerSales(customerId: string): void {
  this.isSalesLoading = true;
  
  if (this.customerSalesSubscription) {
    this.customerSalesSubscription.unsubscribe();
  }
  
  this.customerSalesSubscription = this.saleService.listenForSales().subscribe({
    next: (sales: SalesOrder[]) => {
      this.customerSales = sales
        .filter(sale => sale.customerId === customerId)
        .map(sale => {
          const subtotal = sale.subtotal ?? 0;
          const tax = sale.tax ?? 0;
          // Use shippingCharges if available, otherwise fall back to shippingCost
          const shippingCost = sale.shippingCharges ?? sale.shippingCost ?? 0;
          
          return {
            ...sale,
            saleDate: this.isFirebaseTimestamp(sale.saleDate) ? 
                    this.convertToDate(sale.saleDate) : 
                    new Date(sale.saleDate || Date.now()),
            total: sale.total ?? (subtotal + tax + shippingCost),
            balance: sale.balance ?? 0,
            shippingDetails: sale.shippingDetails || 'N/A',
            shippingStatus: sale.shippingStatus || 'N/A',
            shippingCharges: shippingCost // Use the calculated shipping cost
          };
        });
      
      this.applyPurchaseFilters();
      this.isSalesLoading = false;
    },
    error: (err) => {
      console.error('Failed to load customer sales', err);
      this.isSalesLoading = false;
    }
  });
}
getInitials(firstName: string | undefined, lastName: string | undefined): string {
  const firstInitial = firstName ? firstName.charAt(0) : '';
  const lastInitial = lastName ? lastName.charAt(0) : '';
  return (firstInitial + lastInitial).toUpperCase();
}
  // Call log form methods
  toggleAddCallLogForm(): void {
    this.showAddCallLogForm = !this.showAddCallLogForm;
    if (this.showAddCallLogForm) {
      this.callLogForm.reset({
        subject: '',
        description: '',
        callType: 'Outbound',
        callDuration: 0,
        callOutcome: '',
        followUpRequired: false,
        followUpDate: null
      });
    }
  }

  toggleFollowUp(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      this.callLogForm.get('followUpDate')?.setValue(tomorrow);
    } else {
      this.callLogForm.get('followUpDate')?.setValue(null);
    }
  }

addCallLog(): void {
    if (this.callLogForm.valid && this.customer && this.customer.id) {
        this.isAddingCallLog = true;
        
        // Determine current state based on call outcome
        let currentState = this.customer.currentState || '-';
        if (this.callLogForm.value.callOutcome) {
            switch(this.callLogForm.value.callOutcome) {
                case 'Successful':
                    currentState = 'Engaged';
                    break;
                case 'No Answer':
                    currentState = 'Not Reachable';
                    break;
                case 'Left Message':
                    currentState = 'Follow-up Required';
                    break;
                case 'Wrong Number':
                    currentState = 'Invalid Contact';
                    break;
                default:
                    currentState = this.callLogForm.value.callOutcome;
            }
        }
        
        const callLogData = {
            ...this.callLogForm.value,
            createdAt: new Date(),
            createdBy: this.currentUserId || 'unknown-user'
        };
        
        // First update the call log
        this.customerService.addCallLog(this.customer.id, callLogData)
            .then(() => {
                // Then update the customer with the new lastCallTime and currentState
                // BUT DON'T update callCount here - it will be updated when we refresh the call logs
                return this.customerService.updateCustomer(this.customer!.id!, {
                    lastCallTime: new Date(),
                    currentState: currentState
                });
            })
            .then(() => {
                this.isAddingCallLog = false;
                this.toggleAddCallLogForm();
                
                // Refresh the call logs - this will automatically update the call count
                this.loadCallLogs(this.customer!.id!);
            })
            .catch(error => {
                console.error('Failed to add call log:', error);
                this.isAddingCallLog = false;
            });
    }
}

deleteCallLog(logId: string): void {
    if (!this.customer || !this.customer.id) return;
    
    if (confirm('Are you sure you want to delete this call log?')) {
        this.customerService.deleteCallLog(this.customer.id, logId)
            .then(() => {
                // Calculate new count based on current callLogs array length - 1
                const newCount = Math.max(this.callLogs.length - 1, 0);
                
                return this.customerService.updateCustomer(this.customer!.id!, {
                    callCount: newCount
                });
            })
            .then(() => {
                // Refresh call logs
                this.loadCallLogs(this.customer!.id!);
            })
            .catch(error => {
                console.error('Failed to delete call log:', error);
            });
    }
}

  navigateToCustomers(): void {
    this.router.navigate(['/crm/sales-customers']); // Correct route path
  }

  // Status update methods
  markAsLost(): void {
    if (!this.customer?.id) return;
    
    this.isUpdatingStatus = true;
    this.customerService.updateCustomer(this.customer.id, { 
      status: 'Lost',
      currentState: 'Lost Customer'
    })
      .then(() => {
        if (this.customer) {
          this.customer.status = 'Lost';
          this.customer.currentState = 'Lost Customer';
        }
        this.isUpdatingStatus = false;
      })
      .catch((err: any) => {
        console.error('Failed to update status', err);
        this.isUpdatingStatus = false;
      });
  }

  activateCustomer(): void {
    if (!this.customer?.id) return;
    
    this.isUpdatingStatus = true;
    this.customerService.updateCustomer(this.customer.id, { 
      status: 'Active',
      currentState: 'Active Customer'
    })
      .then(() => {
        if (this.customer) {
          this.customer.status = 'Active';
          this.customer.currentState = 'Active Customer';
        }
        this.isUpdatingStatus = false;
      })
      .catch((err: any) => {
        console.error('Failed to update status', err);
        this.isUpdatingStatus = false;
      });
  }

  // Tab navigation
  changeTab(tab: 'info' | 'calls' | 'purchases' | 'followups'): void {
    this.activeTab = tab;
    if (tab === 'purchases' && this.customer && this.customerSales.length === 0) {
      this.loadCustomerSales(this.customer.id as string);
    }
  }

  // Helper methods
  getFormattedDate(date: Date | undefined): string {
    if (!date) return '-';
    return this.datePipe.transform(date, 'medium') || '-';
  }

  toggleProductDetails(saleId: string): void {
    if (this.expandedSaleId === saleId) {
      this.expandedSaleId = null;
    } else {
      this.expandedSaleId = saleId;
    }
  }

  getProductsDisplayText(products: any[]): string {
    if (!products || products.length === 0) return 'No products';
    if (products.length === 1) {
      return `${products[0].name} (${products[0].quantity})`;
    }
    return `${products[0].name} (${products[0].quantity}) and ${products.length - 1} more`;
  }

  // Follow-up functionality methods
  getFollowUpLogs(): any[] {
    return this.callLogs.filter(log => log.followUpRequired && log.followUpDate);
  }

  markFollowUpComplete(log: any): void {
    if (!this.customer?.id) return;
    
    const updatedLog = {
      ...log,
      followUpRequired: false,
      followUpCompleted: true,
      followUpCompletedDate: new Date()
    };
    
    this.customerService.updateCallLog(this.customer.id, log.id, updatedLog)
      .then(() => {
        // Refresh the call logs
        this.loadCallLogs(this.customer!.id!);
      })
      .catch(error => {
        console.error('Failed to mark follow-up as complete:', error);
      });
  }

  rescheduleFollowUp(log: any): void {
    this.selectedFollowUpLog = log;
    
    // Format date for input element
    const followUpDate = new Date(log.followUpDate);
    const year = followUpDate.getFullYear();
    const month = String(followUpDate.getMonth() + 1).padStart(2, '0');
    const day = String(followUpDate.getDate()).padStart(2, '0');
    this.newFollowUpDate = `${year}-${month}-${day}`;
    
    this.showRescheduleModal = true;
  }

  closeRescheduleModal(): void {
    this.showRescheduleModal = false;
    this.selectedFollowUpLog = null;
    this.newFollowUpDate = null;
  }

  updateFollowUpDate(): void {
    if (!this.customer?.id || !this.selectedFollowUpLog || !this.newFollowUpDate) return;
    
    const updatedLog = {
      ...this.selectedFollowUpLog,
      followUpDate: new Date(this.newFollowUpDate)
    };
    
    this.customerService.updateCallLog(this.customer.id, this.selectedFollowUpLog.id, updatedLog)
      .then(() => {
        // Refresh the call logs
        this.loadCallLogs(this.customer!.id!);
        this.closeRescheduleModal();
      })
      .catch(error => {
        console.error('Failed to update follow-up date:', error);
      });
  }
}