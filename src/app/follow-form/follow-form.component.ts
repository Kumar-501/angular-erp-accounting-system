// follow-form.component.ts
import { Component, EventEmitter, Input, OnInit, Output, OnDestroy } from '@angular/core';
import { FollowUpService } from '../services/follow-up.service';
import { LeadService } from '../services/leads.service';
import { UserService } from '../services/user.service';
import { FollowupCategory, FollowupCategoryService } from '../services/followup-category.service';
import { FollowUp } from '../models/follow-up.model';
import { Subscription } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router'; // Import Router


interface LeadContact {
  id: string;
  contactId: string;
  firstName?: string;
  lastName?: string;
  businessName?: string;
  email?: string;
}

@Component({
  selector: 'app-follow-form',
  templateUrl: './follow-form.component.html',
  styleUrls: ['./follow-form.component.scss']
})
export class FollowFormComponent implements OnInit, OnDestroy {
  @Input() followUpData: FollowUp = {
    title: '',
    status: '',
    description: '',
    customerLead: '',
    startDatetime: '',
    endDatetime: '',
    followUpType: '',
    followupCategory: '',
    assignedTo: '',
    additionalInfo: '',
    addedBy: '',
    sendNotification: false
  };

  @Input() isEditing = false;
  @Output() formSubmit = new EventEmitter<FollowUp>();
  @Output() formCancel = new EventEmitter<void>();
  @Output() formSaved = new EventEmitter<FollowUp>(); // New event emitter

  isLoading = false;
  statusOptions = ['Open', 'Pending', 'In Progress', 'Completed', 'Cancelled', 'Call'];
  followUpTypeOptions = ['Call', 'Email', 'Meeting', 'Task'];
  followupCategoryOptions: string[] = [];
  
  leadsList: LeadContact[] = [];
  usersList: any[] = [];

  private leadsSubscription: Subscription | undefined;
  private usersSubscription: Subscription | undefined;
  private followupCategoriesSubscription: Subscription | undefined;

  constructor(
    private leadService: LeadService,
    private userService: UserService,
    private followupCategoryService: FollowupCategoryService,
    private followUpService: FollowUpService,
    private route: ActivatedRoute,
    private router: Router // Inject the Router service
  ) {}

  ngOnInit(): void {
    this.loadLeads();
    this.loadUsers();
    this.loadFollowupCategories();
    this.route.queryParams.subscribe(params => {
      if (params['leadId']) {
        // Pre-fill form with lead data
        this.followUpData = {
          ...this.followUpData,
          title: params['title'] || 'Follow Up',
          customerLead: params['leadId'],
          assignedTo: params['assignedTo'] || '',
          status: 'Open' // Default status
        };
      }
    });
  }

  ngOnDestroy(): void {
    if (this.leadsSubscription) this.leadsSubscription.unsubscribe();
    if (this.usersSubscription) this.usersSubscription.unsubscribe();
    if (this.followupCategoriesSubscription) this.followupCategoriesSubscription.unsubscribe();
  }

loadFollowupCategories(): void {
  this.followupCategoryService.getFollowupCategories()
    .subscribe({
      next: (categories: FollowupCategory[]) => {
        this.followupCategoryOptions = categories.map((category: FollowupCategory) => category.name);
      },
      error: (err: any) => {
        console.error('Error loading followup categories:', err);
      }
    });
}

  loadLeads(): void {
    this.leadsSubscription = this.leadService.getLeads().subscribe({
      next: (leads) => {
        this.leadsList = leads
          .filter(lead => lead.id !== undefined)
          .map(lead => ({
            id: lead.id!,
            contactId: lead.contactId || '',
            firstName: lead.firstName,
            lastName: lead.lastName,
            businessName: lead.businessName,
            email: lead.email
          }));
      },
      error: (err) => {
        console.error('Error loading leads:', err);
      }
    });
  }

  loadUsers(): void {
    this.usersSubscription = this.userService.getUsers().subscribe({
      next: (users) => {
        this.usersList = users.map(user => ({
          id: user.id,
          name: user.name || `${user.firstName} ${user.lastName}`.trim()
        }));
      },
      error: (err) => {
        console.error('Error loading users:', err);
      }
    });
  }

  onSubmit(): void {
    if (!this.validateForm()) {
      alert('Please fill all required fields');
      return;
    }

    this.isLoading = true;
    
    if (this.isEditing && this.followUpData.id) {
      // Update existing follow-up
      this.followUpService.updateFollowUp(this.followUpData.id, this.followUpData)
        .then(() => {
          this.isLoading = false;
          this.formSaved.emit(this.followUpData); // Emit saved data
          this.formSubmit.emit(this.followUpData);
          
          // Navigate to follow-up component after saving
          this.router.navigate(['/follow-ups']);
        })
        .catch(error => {
          console.error('Error updating follow-up:', error);
          this.isLoading = false;
        });
    } else {
      // Add new follow-up
      this.followUpService.addFollowUp(this.followUpData)
        .then((docRef) => {
          // Create a copy of the follow-up data with the new ID
          const savedFollowUp: FollowUp = {
            ...this.followUpData,
            id: docRef.id // Assign the document ID from Firestore
          };
          
          this.isLoading = false;
          this.formSaved.emit(savedFollowUp); // Emit saved data with ID
          this.formSubmit.emit(savedFollowUp);
          
          // Navigate to follow-up component after saving
          this.router.navigate(['/crm/follows-up']);
        })
        .catch(error => {
          console.error('Error adding follow-up:', error);
          this.isLoading = false;
        });
    }
  }

  onCancel(): void {
    this.formCancel.emit();
  }

  validateForm(): boolean {
    return !!this.followUpData.title && 
           !!this.followUpData.customerLead && 
           !!this.followUpData.assignedTo && 
           !!this.followUpData.startDatetime && 
           !!this.followUpData.endDatetime;
  }
}