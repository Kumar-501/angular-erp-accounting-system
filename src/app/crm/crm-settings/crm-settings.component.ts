// CRM Settings Component
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { LeadStatusService } from '../../services/lead-status.service';

@Component({
  selector: 'app-crm-settings',
  templateUrl: './crm-settings.component.html',
  styleUrls: ['./crm-settings.component.scss']
})
export class CrmSettingsComponent implements OnInit {
  leadStatuses: any[] = [];
  filteredStatuses: any[] = [];
  isDeleting = false;

  showPopup = false;
  leadStatusForm: FormGroup;
  // Add this property to your component class
isSaving = false;
  isLoading = false;
  isEditing = false;
  currentStatusId: string | null = null;
  searchTerm: string = '';

  constructor(
    private formBuilder: FormBuilder,
    private leadStatusService: LeadStatusService
  ) {
    this.leadStatusForm = this.formBuilder.group({
      addCode: ['', Validators.required], // Changed from leadStatus to addCode
      description: [''],
      order: [1, Validators.required],
      isActive: [true],
      isDefault: [false]
    });
  }

  ngOnInit(): void {
    this.loadLeadStatuses();
  }

  loadLeadStatuses(): void {
    this.isLoading = true;
    this.leadStatusService.getLeadStatuses().subscribe(
      statuses => {
        this.leadStatuses = statuses;
        this.filteredStatuses = [...statuses];
        this.isLoading = false;
      },
      error => {
        console.error('Error loading lead statuses:', error);
        this.isLoading = false;
      }
    );
  }

  openAddPopup(): void {
    this.isEditing = false;
    this.currentStatusId = null;
    this.leadStatusForm.reset({
      addCode: '',  // Changed from leadStatus to addCode
      description: '',
      order: 1,
      isActive: true,
      isDefault: false
    });
    this.showPopup = true;
  }

  openEditPopup(status: any): void {
    this.isEditing = true;
    this.currentStatusId = status.id;
    this.leadStatusForm.setValue({
      addCode: status.leadStatus,
      description: status.description || '',
      order: status.order || 1,
      isActive: status.isActive || false,
      isDefault: status.isDefault || false
    });
    this.showPopup = true;
  }

  closePopup(): void {
    this.showPopup = false;
  }

saveLeadStatus(): void {
  // Prevent multiple saves
  if (this.isSaving) return;
  
  if (this.leadStatusForm.valid) {
    const formData = this.leadStatusForm.value;
    
    // Map the form data to match the expected structure in the service
    const payloadData = {
      leadStatus: formData.addCode, // Map addCode back to leadStatus for the API
      description: formData.description,
      order: formData.order,
      isActive: formData.isActive,
      isDefault: formData.isDefault
    };
    
    this.isSaving = true;
    this.isLoading = true;

    if (this.isEditing && this.currentStatusId) {
      // Update existing lead status
      this.leadStatusService.updateLeadStatus(this.currentStatusId, payloadData).then(
        () => {
          this.showPopup = false;
          this.isLoading = false;
          this.isSaving = false;
          this.loadLeadStatuses(); // Refresh the table
        },
        error => {
          console.error('Error updating lead status:', error);
          this.isLoading = false;
          this.isSaving = false;
        }
      );
    } else {
      // Add new lead status
      this.leadStatusService.addLeadStatus(payloadData).then(
        () => {
          this.showPopup = false;
          this.isLoading = false;
          this.isSaving = false;
          this.loadLeadStatuses(); // Refresh the table
        },
        error => {
          console.error('Error adding code:', error);
          this.isLoading = false;
          this.isSaving = false;
        }
      );
    }
  }
}
deleteLeadStatus(status: any): void {
  if (this.isDeleting) return;
  
  if (confirm('Are you sure you want to delete this lead status?')) {
    this.isDeleting = true;
    this.isLoading = true;
    this.leadStatusService.deleteLeadStatus(status.id).then(
      () => {
        this.isLoading = false;
        this.isDeleting = false;
        this.loadLeadStatuses(); // Refresh the table
      },
      error => {
        console.error('Error deleting lead status:', error);
        this.isLoading = false;
        this.isDeleting = false;
      }
    );
  }
}

  searchLeadStatuses(): void {
    if (!this.searchTerm) {
      this.filteredStatuses = [...this.leadStatuses];
      return;
    }
    
    const term = this.searchTerm.toLowerCase();
    this.filteredStatuses = this.leadStatuses.filter(status => 
      status.leadStatus?.toLowerCase().includes(term) || 
      status.description?.toLowerCase().includes(term)
    );
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.filteredStatuses = [...this.leadStatuses];
  }
}