import { Component, ElementRef, EventEmitter, HostListener, Input, OnInit, Output, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { LeadService } from '../../services/leads.service';
import { SourceService } from '../../services/source.service';
import { LifeStageService } from '../../services/life-stage.service';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../auth.service';
import { ProductsService } from '../../services/products.service';
import { CustomerService } from '../../services/customer.service';
import { ActivatedRoute, Router } from '@angular/router';
import { FollowupCategoryService } from '../../services/followup-category.service';
import { LeadStatusService } from '../../services/lead-status.service';
import { debounceTime, distinctUntilChanged, Subject, Subscription } from 'rxjs';
import jsPDF from 'jspdf';
import { Product } from '../../models/product.model';

interface DistrictMap {
  [key: string]: string[];
}
interface ValidationMessage {
  type: 'error' | 'success' | 'duplicate';
  text: string;
}

@Component({
  selector: 'app-lead-add',
  templateUrl: './lead-add.component.html',
  styleUrls: ['./lead-add.component.scss']
})
export class LeadAddComponent implements OnInit {
 @Input() products: any[] = [];
   @Input() size: 'small' | 'medium' | 'large' = 'medium';
   @Output() selectionChange = new EventEmitter<any[]>();
   
   @ViewChild('searchInput') searchInput!: ElementRef;
    shown = false;
   searchKeyword = '';
  selectedProducts: any[] = [];
  searchQuery = '';
showSearchDropdown = false;
isSaving = false;

searchResults: any[] = [];
   filteredUsers: any[] = [];
 departments = ['PC1', 'PC2', 'PC3', 'PC4', 'PC5', 'PC6', 'PC7', 'PC8'];
   filteredProducts: any[] = [];
 pageSizeOptions = [10, 25, 50, 100];  // Add this line
 selectedProduct: any = null; // Only one selected product

   paginatedLeads: any[] = [];
    private blurTimeout: any;
   private searchSubject = new Subject<string>();
   loading = true;

   private searchSubscription!: Subscription;
 getLeadNameById(_t896: string) {
 throw new Error('Method not implemented.');
 }
 exportCSV: any;
 
   leadsTable: any;
   todayDate: Date = new Date();
 currentDate = new Date();
 todaysLeadsCount: number = 0;
 
 clearForm() {
 throw new Error('Method not implemented.');
 }
 private resetForm(): void {
   this.leadForm.reset({
     contactType: 'Lead',
     isIndividual: true,
       alternateContact: ['', [Validators.pattern(/^[0-9]{10}$/)]], // Add validation
 
     status: 'New',
     source: this.sources.length > 0 ? this.sources[0].name : '',
       occupation: [''],

     lifeStage: this.lifeStages.length > 0 ? this.lifeStages[0].name : '',
     addedBy: this.authService.getCurrentUserName()
   });
   this.selectedProducts = [];
   this.availableDistricts = [];
   this.editingLeadId = null;
 }
 closeValidationPopup() {
   this.validationMessage = null;
 }
 
   // Add missing validation message properties
   mobileValidationMessage: string = '';
   mobileExists: boolean = false;
   existingCustomer: any = null;
   selectedUserDepartment: string = '';
 
   alternateContactValidationMessage: string = '';
   landlineValidationMessage: string = '';
 validationMessage: {text: string, type: 'error' | 'success'} | null = null;
 addedBy?: {
   userId: string;
   userName: string;
   timestamp: Date | string;
  };
  

onContactTypeChange(isIndividual: boolean) {
  this.isIndividualType = isIndividual;
  
  // Don't clear values, just update validators
  if (isIndividual) {
    this.leadForm.get('firstName')?.setValidators([Validators.required]);
    this.leadForm.get('lastName')?.setValidators([]);
    this.leadForm.get('gender')?.clearValidators();
    this.leadForm.get('dateOfBirth')?.clearValidators();
    this.leadForm.get('businessName')?.clearValidators();
  } else {
    this.leadForm.get('businessName')?.setValidators([Validators.required]);
    this.leadForm.get('firstName')?.clearValidators();
    this.leadForm.get('lastName')?.clearValidators();
    this.leadForm.get('gender')?.clearValidators();
    this.leadForm.get('dateOfBirth')?.clearValidators();
  }
  
  this.leadForm.get('firstName')?.updateValueAndValidity();
  this.leadForm.get('lastName')?.updateValueAndValidity();
  this.leadForm.get('gender')?.updateValueAndValidity();
  this.leadForm.get('dateOfBirth')?.updateValueAndValidity();
  this.leadForm.get('businessName')?.updateValueAndValidity();
}
// Add these methods to your component class
onSearchInput(): void {
  if (this.searchQuery.length >= 2) {
    this.searchProducts(this.searchQuery);
  } else {
    this.searchResults = [];
    this.showSearchDropdown = false;
  }
}



  


async searchProducts(query: string): Promise<void> {
  try {
    if (query.length >= 2) {
      const products = await this.productsService.searchProducts(query);
      
      // Filter out products marked as "not for selling"
      // Option 1: Simple boolean check
      this.searchResults = products.filter(product => 
        !product.notForSelling
      );
      
      this.showSearchDropdown = this.searchResults.length > 0;
    } else {
      this.searchResults = [];
      this.showSearchDropdown = false;
    }
  } catch (error) {
    console.error('Error searching products:', error);
    this.searchResults = [];
    this.showSearchDropdown = false;
  }
}

   
   getPriorityClass(arg0: any): string|string[]|Set<string>|{ [klass: string]: any; }|null|undefined {
     throw new Error('Method not implemented.');
   }
   
   getDealStatusClass(arg0: any): string|string[]|Set<string>|{ [klass: string]: any; }|null|undefined {
     throw new Error('Method not implemented.');
   }
   
 
   allLeads: any[] = [];
   filteredLeads: any[] = [];
   sources: any[] = [];
   allSelected: boolean = false;
   
 selectedLeads: Set<string> = new Set<string>(); 
   createdBy?: string; // Add this property
   defaultProduct: { name: string } = { name: '' };
   recentLeads: any[] = [];
     activeActionMenu: string | null = null;
 
   tableData: any[] = []; 
   showDepartmentPopup = false;
   productSearchInput: string = '';
 showProductDropdown: boolean = false;
 
showSuccessPopup = false;
showDuplicateWarning = false;
duplicateLeadData: any = null;
 showLeadDetailsPopup = false;
 selectedLeadDetails: any = null;
 selectedLeadForDepartment: any = null;
 departmentForm!: FormGroup;
   selectedProductName: string = '';
   // Add these methods to your component class
 initDepartmentForm(): void {
   this.departmentForm = this.fb.group({
     department: ['', Validators.required]
   });
 }
 
   // Add these to your component class
   pageSize: number = 10;
   currentPage: number = 1;
   totalItems: number = 0;
   totalPages: number = 1;
 // In your component class
 public Math = Math;  // Add these properties
 allProducts: any[] = []; // Your full product list
 searchText: string = '';
 electedProduct: Product | null = null; // Track single selected product
 
 // Component
 optionalBoolean?: boolean;  // Could be undefined
 sortColumn = '';
 sortDirection: 'asc' | 'desc' = 'asc';
 showLifeStagePopup = false;
 selectedLifeStage = '';
 selectedLeadsForLifeStage: any[] = [];
 productSearchTerm: string = '';
 originalProducts: any[] = []; // Store the original unfiltered products
 showNotesPopup = false;
 currentNotes = '';
 selectedLead: any = null;
 showColumnDropdown = false;
 allColumns = [
   { key: 'select', label: 'Select' },
   { key: 'action', label: 'Action' },
   { key: 'createdAt', label: 'Created Date' },
   { key: 'contactId', label: 'Contact ID' },
   { key: 'fullName', label: 'Name' },
   { key: 'mobile', label: 'Mobile' },
   { key: 'productName', label: 'Product Interested' },
   { key: 'addedBy', label: 'Added By' },
   { key: 'lifeStage', label: 'Life Stage' },
   { key: 'dealStatus', label: 'Deal' },
   { key: 'source', label: 'Source' },
   { key: 'leadStatus', label: 'Adcode' },
   { key: 'priority', label: 'Priority' },
   { key: 'note', label: 'Note' },
   { key: 'assignedTo', label: 'Assigned To' },
  { key: 'assignedTo', label: 'Assigned To', visible: true }, // This should show the name
   { key: 'assignedToId', label: 'Assigned To ID', visible: false } ,
   { key: 'upcomingFollowUp', label: 'Upcoming follow up' },
   { key: 'department', label: 'Department', visible: true }
 ];
 currentUserRole: string = '';
 currentUserDepartment: string = '';
 // Add these methods
 openNotes(lead: any) {
   this.selectedLead = lead;
   this.currentNotes = lead.notes || '';
   this.showNotesPopup = true;
 }
   isMouseOverDropdown = false;
 // Add these to your existing properties
 productDropdownOpen = false;
 
 filteredProductsForInterested: any[] = [];
 selectedProductsForInterested: any[] = [];
 options = {
   
   expressDelivery: false,
   giftWrap: false,
   insurance: false
 };
 
 productSearchText = '';
 isDropdownOpen = false;
 productsList: any[] = [];
   convertedCustomer: any = null;
   customProductName: string = '';
 
   searchTerm: string = '';
 showSearchResults: boolean = false;
 filterOptions = {
   inStockOnly: false,
   priceRange: {
     min: 0,
     max: 10000
   }
   
 };
   fromDate: string = '';
   toDate: string = '';
   lifeStages: any[] = []; // This should already be defined
   usersList: any[] = [];
   followupCategories: any[] = [];
   randomAssignMode = false;
   leadStatuses: any[] = [];
   showCategoryPopup = false;
   selectedLeadForCategory: any = null;
   availableCategories: string[] =['Diabetes', 'Cholestrol', 'Blood Pressure', 'Digestion','Kshara Karma','SkinDisease'];
   categoryForm!: FormGroup;
   selectedProductFile: File | null = null;
   showFilterSidebar = false;
 
   
 
   toggleFilterSidebar() {
     this.showFilterSidebar = !this.showFilterSidebar;
   }
   // Add this method to handle user selection
 onUserSelected(event: Event): void {
   const selectElement = event.target as HTMLSelectElement;
   const userId = selectElement.value;
 
   if (!userId) {
     this.selectedUserDepartment = '';
     return;
   }
   
   const selectedUser = this.usersList.find(user => user.id === userId);
   this.selectedUserDepartment = selectedUser?.department || '';
   
   // If you want to automatically set the department in the form:
   this.leadForm.patchValue({
     department: this.selectedUserDepartment,

   });
 }
   
   filterProducts() {
     if (!this.searchKeyword) {
       this.filteredProducts = [...this.products];
     } else {
       const keyword = this.searchKeyword.toLowerCase();
       this.filteredProducts = this.products.filter(product => 
         (product.productName || product.name).toLowerCase().includes(keyword) ||
         (product.sku && product.sku.toLowerCase().includes(keyword))
       );
     }
   }
   closeSuccessPopup() {
  this.showSuccessPopup = false;
}

handleDuplicateResponse(continueAnyway: boolean) {
  this.showDuplicateWarning = false;
  
  if (continueAnyway) {
    // Proceed with saving the lead
    this.saveLeadAfterValidation();
  }
}
   
   visibleColumns = [
     'select', 'action', 'createdAt', 'contactId', 'fullName', 'mobile', 'addedBy',
     'lifeStage', 'dealStatus', 'source', 'leadStatus', 'priority', 'status',
     'note', 'assignedTo', 'upcomingFollowUp', 'department', 'productName'
   ];
 
   isIndividualType = true;
 selectedFile: File | null = null;
 uploadProgress: number | null = null;
 downloadURL: string | null = null;
   prefixes = ['Mr', 'Mrs', 'Miss', 'Dr', 'Prof'];
   genders = ['Male', 'Female', 'Other'];
   leadCategories = ['Diabetes', 'Cholestrol', 'Blood Pressure', 'Digestion','Kshara Karma','SkinDisease'];
   dealStatuses = ['Open', 'Closed', 'Lost', 'Won'];
   priorities = ['New', 'Allotted', 'Lost', 'Urgent'];
   
   states = ['Kerala', 'Tamil Nadu'];
   districtsByState: DistrictMap = {
     'Kerala': [
       'Thiruvananthapuram', 'Kollam', 'Pathanamthitta', 'Alappuzha', 
       'Kottayam', 'Idukki', 'Ernakulam', 'Thrissur', 'Palakkad', 
       'Malappuram', 'Kozhikode', 'Wayanad', 'Kannur', 'Kasaragod'
     ],
     'Tamil Nadu': [
       'Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli',
       'Salem', 'Tirunelveli', 'Tiruppur', 'Vellore', 'Erode',
       'Thoothukkudi', 'Dindigul', 'Thanjavur', 'Ranipet', 'Sivakasi',
       'Ariyalur', 'Chengalpattu', 'Cuddalore', 'Dharmapuri',
       'Kanchipuram', 'Kallakurichi', 'Kanyakumari', 'Karur',
       'Krishnagiri', 'Mayiladuthurai', 'Nagapattinam', 'Namakkal',
       'Nilgiris', 'Perambalur', 'Pudukkottai', 'Ramanathapuram',
       'Tenkasi', 'Theni', 'Tirupattur', 'Tiruvallur',
       'Tiruvannamalai', 'Tiruvarur', 'Viluppuram', 'Virudhunagar'
     ]
   };
   // Update the onPageSizeChange method
 onPageSizeChange(): void {
   this.currentPage = 1; // Reset to first page when changing page size
   this.updatePagination();
 }
 private async saveLeadAfterValidation() {
  // Your save lead logic here
  // This is the same as your existing saveLead() method but without the duplicate check
  try {
    const formData = this.leadForm.value;
    const mobile = formData.mobile;

    // Get assigned user data
    const assignedUserId = this.leadForm.get('assignedTo')?.value;
    const assignedUser = this.usersList.find(u => u.id === assignedUserId);
    const assignedToName = assignedUser ? assignedUser.name : '';

    // Prepare lead data
    const leadData = { 
      ...formData,
      updatedAt: new Date(),
      assignedTo: assignedToName,
      assignedToId: assignedUserId,
        occupation: formData.occupation || '', // Add this line

    productInterested: this.selectedProducts.length > 0 ? this.selectedProducts : null,
      addedBy: {
        userId: this.authService.getCurrentUserId(),
        userName: formData.addedBy || this.authService.getCurrentUserName()
      },
      isDuplicate: true,
      mobileExists: this.mobileExists
    };

    // Remove irrelevant fields based on contact type
    if (!leadData.isIndividual) {
      delete leadData.firstName;
      delete leadData.lastName;
      delete leadData.prefix;
      delete leadData.middleName;
      delete leadData.gender;
      delete leadData.dateOfBirth;
      delete leadData.age;
    } else {
      delete leadData.businessName;
    }

    if (this.editingLeadId) {
      // Update existing lead
      await this.leadService.updateLead(this.editingLeadId, leadData);
      this.showSuccessPopup = true;
          this.router.navigate(['/crm/leads']);

    } else {
      // Create new lead
      leadData.createdAt = new Date();
      leadData.contactId = this.generateContactId();
          this.showForm = !this.showForm;

      await this.leadService.addLead(leadData, {
        userId: this.authService.getCurrentUserId(),
        userName: this.authService.getCurrentUserName()
      });

      this.showSuccessPopup = true;
    }

    // Reset form and reload data after a short delay
    setTimeout(() => {
      this.loadLeads();
      if (!this.editingLeadId) {
        this.toggleForm();
      }
    }, 2000);

  } catch (error) {
    console.error('Error saving lead:', error);
    this.validationMessage = {
      text: 'Error saving lead. Please try again.',
      type: 'error'
    };
  }
}
 updatePagination(): void {
   this.totalPages = Math.ceil(this.totalItems / this.pageSize);
   
   // Ensure current page is within valid range
   if (this.currentPage > this.totalPages) {
     this.currentPage = this.totalPages > 0 ? this.totalPages : 1;
   }
 
   this.startIndex = (this.currentPage - 1) * this.pageSize;
   this.endIndex = Math.min(this.startIndex + this.pageSize, this.totalItems);
 
   // Apply pagination to filtered data
   this.paginatedLeads = this.filteredLeads.slice(this.startIndex, this.endIndex);
 }
   
   availableDistricts: string[] = [];
 
   // Forms
   leadForm: FormGroup;
   followUpForm: FormGroup;
   
   assignForm: FormGroup;
   activeDropdown: string = '';
   // Modals
   showForm = false;
   showFollowUpForm = false;
   showAssignModal = false;
   showMoreInfo = false;
   convertedLeadsCount: number = 0;
 
   // Current selections
   editingLeadId: string | null = null;
   selectedLeadForFollowUp: any = null;
   dateRangeStart: Date | null = null;
   dateRangeEnd: Date | null = null;
   
 
 availableUsers: any[] = [];
 selectedUserId: string = '';
 
   // Table and pagination
 
 
   pages: number[] = [];
   startIndex = 0;
   endIndex = 0;
   private searchTimeout: any;
   private filterDebounceTimer: any;
 
 
   constructor(
     private fb: FormBuilder,
     private leadService: LeadService,
     private sourceService: SourceService,
     private lifeStageService: LifeStageService,
     private userService: UserService,
     public authService: AuthService,
       private route: ActivatedRoute, // Add this

       private productsService: ProductsService, // Add this line
  // Add this line
 
     private router: Router,
     private followupCategoryService: FollowupCategoryService,
     private customerService: CustomerService,
     private leadStatusService: LeadStatusService,
     private elementRef: ElementRef
     
 
     
 
   ) {
   this.leadForm = this.fb.group({
   contactType: ['Lead', Validators.required],
   isIndividual: [true],
   prefix: [''],
   firstName: [''],
   middleName: [''],
   lastName: [''],
   gender: [''],
   dateOfBirth: [''],
   age: [''],
   businessName: [''],
  mobile: ['', [Validators.required, Validators.pattern(/^(?:\s*\d\s*){10,12}$/)]],
  alternateContact: ['', [Validators.pattern(/^(?:\s*\d\s*){10,12}$/)]],
  landline: ['', [Validators.pattern(/^(?:\s*\d\s*){10,12}$/)]],
   email: ['', [Validators.email]], // Made email mandatory
   department: [''],
   leadStatus: ['', Validators.required],
   leadCategory: [''],
   dealStatus: [''],
   priority: [''],
   estimatedValue: [''],
   source: ['', Validators.required],
   lifeStage: ['', Validators.required],
   assignedTo: [''],
   notes: [''],
   addressLine1: [''],
   addressLine2: [''],
   city: [''],
   state: [''],
   country: [''],
   zipCode: ['']
 });
 
     // Follow Up Form
     this.followUpForm = this.fb.group({
       title: ['', Validators.required],
       customerLead: ['', Validators.required],
       status: [''],
       startDateTime: ['', Validators.required],
 
       endDateTime: ['', Validators.required],
       description: [''],
       followUpType: ['', Validators.required],
       followupCategory: ['', Validators.required],
       assignedTo: ['', Validators.required],
       sendNotification: [true],
       notifySms: [false],
       notifyEmail: [true],
       
       notifyBeforeValue: [15],
       notifyBeforeUnit: ['Minute']
     });
 
     this.assignForm = this.fb.group({
       assignedTo: ['', Validators.required]
     });
   }
 
   
   nextPage(): void {
     if (this.currentPage < this.totalPages) {
       this.currentPage++;
       this.updatePagination();
     }
   }
closeForm() {
  this.router.navigate(['/crm/leads']);
}
 // Update the applyFilters method
 
   prevPage(): void {
     if (this.currentPage > 1) {
       this.currentPage--;
       this.updatePagination();
     }
   }
// File: src/app/lead-add/lead-add.component.ts

// File: src/app/lead-add/lead-add.component.ts

// Make sure you have imported ChangeDetectorRef from '@angular/core'
// import { ChangeDetectorRef, ... } from '@angular/core';

// And injected it in your constructor:
// constructor(..., private cdr: ChangeDetectorRef) { ... }



// Helper to restrict input to numbers and spaces, capping at 12 digits
onPhoneNumberInput(event: any, controlName: string) {
  const input = event.target;
  let val = input.value.replace(/[^0-9 ]/g, ''); // Remove alphabets/symbols
  
  let digitCount = 0;
  let limitedValue = '';

  // Loop through input and stop exactly at the 12th digit
  for (let char of val) {
    if (/[0-9]/.test(char)) {
      if (digitCount < 12) {
        digitCount++;
        limitedValue += char;
      }
    } else if (char === ' ') {
      limitedValue += char; // Always allow spaces
    }
  }

  // Update the form control value
  this.leadForm.get(controlName)?.setValue(limitedValue, { emitEvent: false });
  
  // Trigger specific validation logic
  if (controlName === 'mobile') this.validateMobileNumber();
  if (controlName === 'alternateContact') this.validateAlternateContact();
  if (controlName === 'landline') this.validateLandline();
}

async saveLead() {
  this.leadForm.markAllAsTouched();

  if (this.isSaving) return;
  this.isSaving = true;

  // Check if form is valid
  if (this.leadForm.invalid) {
    // DEBUG: Find out which field is failing
    Object.keys(this.leadForm.controls).forEach(key => {
      const controlErrors = this.leadForm.get(key)?.errors;
      if (controlErrors != null) {
        console.log('Validation failed on field: ' + key, controlErrors);
      }
    });

    this.validationMessage = { text: 'Please fill all required fields correctly.', type: 'error' };
    this.isSaving = false;
    return;
  }

  const formData = { ...this.leadForm.value };
  
  // Clean numbers for database
  const mobileClean = this.getDigitsOnly(formData.mobile);
  const altClean = this.getDigitsOnly(formData.alternateContact);
  const landlineClean = this.getDigitsOnly(formData.landline);

  // Range Check
  if (mobileClean.length < 10 || mobileClean.length > 12) {
    this.validationMessage = { text: 'Mobile number must be 10-12 digits', type: 'error' };
    this.isSaving = false;
    return;
  }

  try {
    // Duplicate check using digits only
    const duplicateLeads = this.allLeads.filter(l => 
      this.getDigitsOnly(l.mobile) === mobileClean && 
      (!this.editingLeadId || l.id !== this.editingLeadId)
    );

    if (duplicateLeads.length > 0) {
      if (!confirm('This mobile number already exists in another lead. Continue?')) {
        this.isSaving = false;
        return;
      }
    }

    const mobileExistsInCustomers = await this.customerService.checkMobileNumberExists(mobileClean);

    const leadData = { 
      ...formData,
      mobile: mobileClean,
      alternateContact: altClean,
      landline: landlineClean,
      updatedAt: new Date(),
      assignedTo: this.usersList.find(u => u.id === formData.assignedTo)?.name || '',
      assignedToId: formData.assignedTo,
      productInterested: this.selectedProducts.length > 0 ? this.selectedProducts : null,
      addedBy: {
        userId: this.authService.getCurrentUserId(),
        userName: formData.addedBy || this.authService.getCurrentUserName()
      },
      isDuplicate: duplicateLeads.length > 0,
      mobileExists: mobileExistsInCustomers
    };

    if (this.editingLeadId) {
      await this.leadService.updateLead(this.editingLeadId, leadData);
      this.showSuccessPopup = true;
    } else {
      leadData.createdAt = new Date();
      leadData.contactId = this.generateContactId();
      await this.leadService.addLead(leadData, {
        userId: this.authService.getCurrentUserId(),
        userName: this.authService.getCurrentUserName()
      });
      this.showSuccessPopup = true;
    }

    // Success Actions
    setTimeout(() => {
      this.isSaving = false;
      this.router.navigate(['/crm/leads']);
    }, 1500);

  } catch (error) {
    console.error('Save error:', error);
    this.validationMessage = { text: 'Error saving lead. Check console.', type: 'error' };
    this.isSaving = false;
  }
}
async validateMobileNumber(): Promise<void> {
  const control = this.leadForm.get('mobile');
  const digits = this.getDigitsOnly(control?.value);
  
  this.validationMessage = null;
  this.existingCustomer = null;

  // 1. Check Range Validation
  if (digits.length > 0 && (digits.length < 10 || digits.length > 12)) {
    this.mobileValidationMessage = 'Mobile number must be 10-12 digits';
  } else {
    this.mobileValidationMessage = '';
  }

  // 2. Check for Existing Customer (Reorder Logic)
  if (digits.length >= 10 && digits.length <= 12) {
    try {
      const customer = await this.customerService.getCustomerByMobile(digits);
      if (customer) {
        this.existingCustomer = customer;
        this.mobileExists = true;
        this.validationMessage = { text: 'Note: This number belongs to an existing customer.', type: 'success' };
        this.prefillFromExistingCustomer(customer);
      } else {
        this.mobileExists = false;
      }
    } catch (error) {
      console.error('Error validating mobile:', error);
    }
  }
}

validateAlternateContact() {
  const digits = this.getDigitsOnly(this.leadForm.get('alternateContact')?.value);
  if (digits.length > 0 && (digits.length < 10 || digits.length > 12)) {
    this.alternateContactValidationMessage = 'Alternate contact must be 10-12 digits';
  } else {
    this.alternateContactValidationMessage = '';
  }
}

validateLandline() {
  const digits = this.getDigitsOnly(this.leadForm.get('landline')?.value);
  if (digits.length > 0 && (digits.length < 10 || digits.length > 12)) {
    this.landlineValidationMessage = 'Landline must be 10-12 digits';
  } else {
    this.landlineValidationMessage = '';
  }
}
 
 
   private searchInLead(lead: any, term: string): boolean {
   const fieldsToSearch = [
     'businessName', 'firstName', 'lastName', 'middleName',
     'email', 'mobile', 'alternateContact', 'landline', // Already includes alternateContact
     'status', 'source', 'assignedTo', 'lifeStage',
     'department', 'leadCategory', 'dealStatus', 'priority',
     'contactId', 'notes'
   ];
 
   return fieldsToSearch.some(field => {
     const value = lead[field];
     if (typeof value === 'string') {
       return value.toLowerCase().includes(term);
     }
     return false;
   });
 }
 
 // In leads.component.ts
 getUserDepartment(assignedTo: string): string {
   if (!assignedTo) return '';
   
   const user = this.usersList.find(u => 
     u.id === assignedTo || 
     u.name === assignedTo || 
     u.username === assignedTo
   );
   
   return user?.department || '';
 }
 
 getUserUsername(assignedTo: string): string {
   if (!assignedTo) return '';
   
   const user = this.usersList.find(u => 
     u.id === assignedTo || 
     u.name === assignedTo || 
     u.username === assignedTo
   );
   
   return user?.username || '';
 }
 onDepartmentChange(event: Event): void {
   const selectElement = event.target as HTMLSelectElement;
   const department = selectElement.value;
   const currentUserRole = this.authService.currentUserValue?.role || '';
   const currentUserDepartment = this.authService.currentUserValue?.department || '';
   
   // Reset the assignedTo field
   this.leadForm.get('assignedTo')?.setValue('');
   
   if (department) {
     // Filter users by department and role
     if (currentUserRole === 'Supervisor') {
       // Supervisor can only assign to executives in their own department
       this.filteredUsers = this.usersList.filter(user => 
         user.department === currentUserDepartment && 
         user.role === 'Executive'
       );
     } else {
       // Admin/Manager can assign to executives in the selected department
       this.filteredUsers = this.usersList.filter(user => 
         user.department === department && 
         user.role === 'Executive'
       );
     }
   } else {
     // If no department selected, filter based on user role
     if (currentUserRole === 'Supervisor') {
       this.filteredUsers = this.usersList.filter(user => 
         user.department === currentUserDepartment && 
         user.role === 'Executive'
       );
     } else {
       this.filteredUsers = this.usersList.filter(user => user.role === 'Executive');
     }
   }
   
   // Set the selected user's department
   this.selectedUserDepartment = department;
 }
   viewLeadDetails(leadId: string): void {
     // Find the complete lead details from your allLeads array
     this.selectedLeadDetails = this.allLeads.find(lead => lead.id === leadId);
     
     if (!this.selectedLeadDetails) {
       console.error('Lead not found with ID:', leadId);
       return;
     }
     
     this.showLeadDetailsPopup = true;
   }
   closeLeadDetailsPopup(): void {
     this.showLeadDetailsPopup = false;
     this.selectedLeadDetails = null;
   }
   openDepartmentPopup(lead?: any): void {
     if (lead) {
       // Single lead update
       this.selectedLeadForDepartment = lead;
       this.departmentForm.patchValue({
         department: lead.department || ''
       });
     } else {
       // Bulk update for selected leads
       this.selectedLeadForDepartment = null;
       this.departmentForm.reset();
     }
     this.showDepartmentPopup = true;
   }closeDepartmentPopup(): void {
     this.showDepartmentPopup = false;
     this.selectedLeadForDepartment = null;
   }
   async saveDepartment(): Promise<void> {
     if (this.departmentForm.invalid) {
       this.departmentForm.markAllAsTouched();
       return;
     }
   
     const department = this.departmentForm.get('department')?.value;
   
     try {
       if (this.selectedLeadForDepartment) {
         // Update single lead
         await this.leadService.updateLead(this.selectedLeadForDepartment.id, { department });
         // Update local data
         const lead = this.allLeads.find(l => l.id === this.selectedLeadForDepartment.id);
         if (lead) {
           lead.department = department;
 
         }
       } else {
         // Bulk update selected leads
         const updatePromises = Array.from(this.selectedLeads).map(leadId => 
           this.leadService.updateLead(leadId, { department })
         );
         await Promise.all(updatePromises);
         
         // Update local data
         this.allLeads.forEach(lead => {
           if (this.selectedLeads.has(lead.id)) {
             lead.department = department;
           }
         });
       }
 
       this.closeDepartmentPopup();
       this.applyFilters(); // Refresh the filtered data
       
       // Show success message
       this.validationMessage = {
         text: 'Department updated successfully',
         type: 'success'
       };
       
       setTimeout(() => {
         this.validationMessage = null;
       }, 3000);
       
     } catch (error) {
       console.error('Error updating department:', error);
       this.validationMessage = {
         text: 'Error updating department. Please try again.',
         type: 'error'
       };
     }
   }
   goToFirstPage(): void {
     this.currentPage = 1;
     this.updatePagination();
   }
   
   goToLastPage(): void {
     this.currentPage = this.totalPages;
     this.updatePagination();
   }
toggleProductSelection(product: any): void {
  const index = this.selectedProducts.findIndex(p => p.id === product.id);
  
  if (index >= 0) {
    // Product already selected - remove it
    this.selectedProducts.splice(index, 1);
  } else {
    // Product not selected - add it
    this.selectedProducts.push({ ...product });
  }
  
  this.selectionChange.emit([...this.selectedProducts]);
  this.searchQuery = '';
  this.searchResults = [];
  this.showSearchDropdown = false;
}

clearSelectedProducts(): void {
  this.selectedProducts = [];
  this.selectionChange.emit([]);
}

isProductSelected(product: any): boolean {
  return this.selectedProducts.some(p => p.id === product.id);
}

// Remove a selected product
removeSelectedProduct(product: any): void {
  this.selectedProducts = this.selectedProducts.filter(p => p.id !== product.id);
  this.selectionChange.emit([...this.selectedProducts]);
}
   onProductMouseDown(product: any, event: MouseEvent): void {
  event.preventDefault(); // Prevent blur from triggering unexpectedly
  event.stopPropagation();

  const index = this.selectedProducts.findIndex(p => p.id === product.id);

  if (index >= 0) {
    this.selectedProducts.splice(index, 1);
  } else {
    this.selectedProducts.push({ ...product });
  }

  this.searchQuery = '';
  this.searchResults = [];
  this.showSearchDropdown = false;

  this.selectionChange.emit([...this.selectedProducts]);
}

   
   toggleColumnDropdown(): void {
     this.showColumnDropdown = !this.showColumnDropdown;
   }
   isColumnVisible(columnKey: string): boolean {
     return this.visibleColumns.includes(columnKey);
   }
   toggleColumnVisibility(columnKey: string): void {
     if (this.isColumnVisible(columnKey)) {
       this.visibleColumns = this.visibleColumns.filter(col => col !== columnKey);
     } else {
       this.visibleColumns = [...this.visibleColumns, columnKey];
     }
     
     // Ensure at least one column remains visible
     if (this.visibleColumns.length === 0) {
       this.visibleColumns = ['select', 'action']; // Default columns
     }
   }  
   
   closeNotes() {
     this.showNotesPopup = false;
     this.selectedLead = null;
     this.currentNotes = '';
   }
   // Method to open the life stage popup
 // Update the openLifeStagePopup method
 openLifeStagePopup(lead?: any): void {
   if (lead) {
     // Single lead update
     this.selectedLeadsForLifeStage = [lead];
     this.selectedLifeStage = lead.lifeStage || '';
   } else {
     // Bulk update for selected leads
     this.selectedLeadsForLifeStage = this.allLeads.filter(lead => 
       this.selectedLeads.has(lead.id)
     );
     this.selectedLifeStage = '';
   }
   this.showLifeStagePopup = true;
 }
 
   // Method to close the popup
 closeLifeStagePopup(): void {
   this.showLifeStagePopup = false;
   this.selectedLeadsForLifeStage = [];
   this.selectedLifeStage = '';
 }
   onProductSelectAndUpdateInput(productName: string): void {
     if (productName) {
       const selectedProduct = this.filteredProducts.find(p => 
         p.productName === productName || p.name === productName
       );
       
       if (selectedProduct && !this.selectedProducts.some(p => 
         p.productName === selectedProduct.productName || 
         p.name === selectedProduct.name
       )) {
         this.selectedProducts.push(selectedProduct);
         this.customProductName = selectedProduct.productName || selectedProduct.name || '';
       }
     }
  }
  
   // Get display text for selected items
   getSelectedText(): string {
     return this.selectedProducts.length 
       ? this.selectedProducts.map(p => p.productName).join(', ') 
       : 'Select products...';
   } 
   // Individual filter methods
 applySourceFilter(source: string): void {
   this.filters.source = source;
   this.applyFilters();
 }
 // Initialize the assign form
 private initAssignForm(): void {
   this.assignForm = this.fb.group({
     assignedTo: ['', Validators.required],
     lifeStage: ['', Validators.required]
   });
 }
 
 
 applyLifeStageFilter(lifeStage: string): void {
   this.filters.lifeStage = lifeStage;
   this.applyFilters();
 }
 toggleDropdown(dropdownName: string): void {
   if (this.activeDropdown === dropdownName) {
     this.activeDropdown = '';
   } else {
     this.activeDropdown = dropdownName;
   }
 }
 
 applyLeadStatusFilter(leadStatus: string): void {
   this.filters.leadStatus = leadStatus;
   this.applyFilters();
 }
   @HostListener('document:click', ['$event'])
   onClickOutside(event: Event) {
     if (!this.elementRef.nativeElement.contains(event.target)) {
       this.shown = false;
     }
   }
   
 
 applyAssignedToFilter(assignedTo: string): void {
   this.filters.assignedTo = assignedTo;
   this.applyFilters();
 }
 
 applyDealStatusFilter(dealStatus: string): void {
   this.filters.dealStatus = dealStatus;
   this.applyFilters();
 }
 // In your component.ts file
 onProductCheckboxChange(event: any, product: any) {
   // Handle checkbox change here
   console.log('Checkbox changed for product:', product);
   // You can access the checked state via event.target.checked or product.selected
 }
 
 getSelectedProducts() {
   return this.filteredProducts.filter(p => p.selected);
 }
 // Clear all selected products
 clearSelection(): void {
   this.selectedProducts = [];
 }selectAllVisible(): void {
   // First clear the selection
   this.selectedProducts = [];
   
   // Add all filtered products that aren't already selected
   this.filteredProducts.forEach(product => {
     if (!this.isProductSelected(product)) {
       this.selectedProducts.push(product);
     }
   });
 }
 
 // Add this method to your component class
 
 // Add this method to your component class
 addCustomProduct() {
   if (this.customProductName.trim()) {
     // Create a custom product object
     const customProduct = {
       productName: this.customProductName,
       name: this.customProductName,
       // Add any other required properties with default values
       currentStock: null,
       // You might need to add other properties based on your product model
     };
     
     // Add to selected products
     this.selectedProducts.push(customProduct);
     
     // Clear the input field
     this.customProductName = '';
   }
 }
 getVisiblePages(): number[] {
   const totalPages = Math.ceil(this.totalItems / this.pageSize);
   const visiblePages = 5; // Number of page buttons to show
   const pages: number[] = [];
   
   if (totalPages <= visiblePages) {
     return Array.from({ length: totalPages }, (_, i) => i + 1);
   }
 
   let startPage = Math.max(1, this.currentPage - Math.floor(visiblePages / 2));
   const endPage = Math.min(totalPages, startPage + visiblePages - 1);
 
   if (endPage - startPage + 1 < visiblePages) {
     startPage = Math.max(1, endPage - visiblePages + 1);
   }
 
   for (let i = startPage; i <= endPage; i++) {
     pages.push(i);
   }
 
   return pages;
 }
 // Method to handle product selection and addition
 onProductSelectAndAdd(productName: string) {
   if (productName) {
     // Find the selected product
     const selectedProduct = this.filteredProducts.find(p => p.productName === productName);
     
     if (selectedProduct) {
       // Add the selected product directly to selectedProducts array
       this.selectedProducts.push(selectedProduct);
       
       // Reset the dropdown to show "Select a product"
       this.defaultProduct.name = "";
     }
   }
 }
 applyPriorityFilter(priority: string): void {
   this.filters.priority = priority;
   this.applyFilters();
 }
 
 applyDepartmentFilter(department: string): void {
   const currentUserRole = this.authService.currentUserValue?.role || '';
   const currentUserDepartment = this.authService.currentUserValue?.department || '';
   
   // For supervisors, they can only filter within their own department
   if (currentUserRole === 'Supervisor' && department && department !== currentUserDepartment) {
     this.validationMessage = {
       text: 'You can only view leads from your department',
       type: 'error'
     };
     return;
   }
   
   this.filters.department = department;
   this.applyFilters();
 }
 onDropdownMouseEnter() {
   this.isMouseOverDropdown = true;
 }
 
  removeProduct(product: any) {
     this.selectedProducts = this.selectedProducts.filter(p => p !== product && p.id !== product.id);
     this.selectionChange.emit([...this.selectedProducts]);
     event?.stopPropagation();
   }
   
 
 
 closeAssignModal() {
   this.showAssignModal = false;
   this.availableUsers = [];
   this.selectedUserId = '';
 }
 // Update the assignSelectedLeads method
 async assignSelectedLeads() {
   if (this.selectedLeads.size === 0) {
     alert('Please select leads to assign');
     return;
   }
 
   try {
     // Prepare update data
     const updateData: any = {};
     
     // Only include assignedTo if a user is selected (for random assignment)
     if (this.selectedUserId) {
       const selectedUser = this.availableUsers.find(u => u.id === this.selectedUserId);
       if (selectedUser) {
         updateData.assignedTo = selectedUser.name || selectedUser.email;
       }
     }
     
     // Include life stage if selected
     if (this.selectedLifeStage) {
       updateData.lifeStage = this.selectedLifeStage;
     }
 
     // Update all selected leads
     const updatePromises = Array.from(this.selectedLeads).map(leadId => 
       this.leadService.updateLead(leadId, updateData)
     );
     
     await Promise.all(updatePromises);
     
     // Update local data
     this.allLeads.forEach(lead => {
       if (this.selectedLeads.has(lead.id)) {
         if (updateData.assignedTo) {
           lead.assignedTo = updateData.assignedTo;
         }
         if (updateData.lifeStage) {
           lead.lifeStage = updateData.lifeStage;
         }
       }
     });
 
     // Show success message
     this.validationMessage = {
       text: 'Leads updated successfully',
       type: 'success'
     };
     
     // Close modal and clear selections
     this.closeAssignModal();
     this.selectedLeads.clear();
     this.allSelected = false;
     
     // Refresh the filtered data
     this.applyFilters();
     
     // Hide success message after 3 seconds
     setTimeout(() => {
       this.validationMessage = null;
     }, 3000);
     
   } catch (error) {
     console.error('Error assigning leads:', error);
     this.validationMessage = {
       text: 'Error assigning leads. Please try again.',
       type: 'error'
     };
   }
 }
 
 
 // Method to update life stages
 async updateSelectedLifeStages(): Promise<void> {
   if (!this.selectedLifeStage || this.selectedLeadsForLifeStage.length === 0) {
     alert('Please select a life stage');
     return;
   }
 
   try {
     const updatePromises = this.selectedLeadsForLifeStage.map(lead => 
       this.leadService.updateLead(lead.id, { lifeStage: this.selectedLifeStage })
     );
     
     await Promise.all(updatePromises);
     
     // Update local data
     this.selectedLeadsForLifeStage.forEach(lead => {
       const foundLead = this.allLeads.find(l => l.id === lead.id);
       if (foundLead) {
         foundLead.lifeStage = this.selectedLifeStage;
       }
     });
     
     this.closeLifeStagePopup();
     this.loadLeads(); // Refresh the data
     
     // Show success message
     this.validationMessage = {
       text: `Successfully updated ${this.selectedLeadsForLifeStage.length} lead(s)`,
       type: 'success'
     };
     
     setTimeout(() => {
       this.validationMessage = null;
     }, 3000);
     
   } catch (error) {
     console.error('Error updating life stages:', error);
     this.validationMessage = {
       text: 'Error updating life stages. Please try again.',
       type: 'error'
     };
   }
 }
 toggleSelectAll(event: Event) {
   const isChecked = (event.target as HTMLInputElement).checked;
   this.allSelected = isChecked;
   
   if (isChecked) {
     // Select all filtered leads
     this.filteredLeads.forEach(lead => this.selectedLeads.add(lead.id));
   } else {
     // Deselect all
     this.selectedLeads.clear();
   }
 }
 highlightMatch(text: string, searchTerm: string): string {
   if (!text || !searchTerm) return text;
   
   const regex = new RegExp(searchTerm, 'gi');
   return text.replace(regex, match => 
     `<span class="highlight">${match}</span>`
   );
 }
 
 
   
   
 
 
 
 
 
 
 
 
 
 // Date filter methods
 applyFromDateFilter(date: string): void {
   this.filters.fromDate = date;
   this.applyFilters();
 }
 
 
 applyToDateFilter(date: string): void {
   this.filters.toDate = date;
   this.applyFilters();
 }
   // Add this method
   getFormattedDateRange(): string {
     if (this.dateRangeStart && this.dateRangeEnd) {
       const start = this.dateRangeStart.toLocaleDateString();
       const end = this.dateRangeEnd.toLocaleDateString();
       return `${start} - ${end}`;
     }
     return '';
   }
 
 // Clear all filters
 clearAllFilters(): void {
   this.filters = {
     searchTerm: '',
     source: '',
     lifeStage: '',
     leadStatus: '',
     assignedTo: '',
     dealStatus: '',
     priority: '',
     department: '',
     orderStatus: '',
     addedBy: '',
     fromDate: '',
     toDate: '', 
     code: '' ,
     adCode: '' // Add this line
 
   };
   this.applyFilters();
 }
 // In your component class
 showAdvancedFilters = false;
 filters = {
   searchTerm: '',
   source: '',
   lifeStage: '',
   leadStatus: '',
   assignedTo: '',
   dealStatus: '',
   priority: '',
   department: '',
   addedBy: '',
   fromDate: '',
   toDate: '',
   code: '' ,
   orderStatus: '' as '' | 'Reordered' | 'No Reordered',
   adCode: '' // Add this line
 
 };
ngOnInit(): void {
  this.initializeForm();
  this.loadDependencies().then(() => {
    this.handleQueryParams();
  });
}
async loadData() {
  this.loading = true;
  try {
    await this.loadDependencies();
    await this.handleQueryParams();
  } finally {
    this.loading = false;
  }
}
private getDigitsOnly(value: any): string {
  if (!value) return '';
  return String(value).replace(/\s+/g, '');
}
private initializeForm() {
  this.leadForm = this.fb.group({
    contactType: ['Lead', Validators.required],
    isIndividual: [true],
    prefix: [''],
    firstName: ['', [Validators.required]], 
    middleName: [''],
    occupation: [''], 
    lastName: ['',],
    gender: ['', []], 
    dateOfBirth: ['', []], 
    age: [''],
    businessName: [''],
    // UPDATE THIS LINE: Use the new regex that allows spaces and 10-12 digits
    mobile: ['', [Validators.required, Validators.pattern(/^(?:\s*\d\s*){10,12}$/)]],
    alternateContact: ['', [Validators.pattern(/^(?:\s*\d\s*){10,12}$/)]],
    landline: ['', [Validators.pattern(/^(?:\s*\d\s*){10,12}$/)]],
    email: ['', []],
    department: [''],
    leadStatus: ['', Validators.required],
    leadCategory: [''],
    leadStatusNote: [''],
    dealStatus: [''],
    priority: [''],
    estimatedValue: [''],
    source: ['', Validators.required],
    lifeStage: ['', Validators.required],
    assignedTo: [''],
    notes: [''],
    addressLine1: [''],
    addressLine2: [''],
    city: [''],
    state: [''],
    country: ['India'],
    zipCode: ['']
  });
}

private async loadDependencies() {
  await Promise.all([
    this.loadSources(),
    this.loadLifeStages(),
    this.loadLeadStatuses(),
    this.loadUsers(),
    this.loadProducts()
  ]);
  this.loadRecentLeads();
}

private handleQueryParams() {
  this.route.queryParams.subscribe(params => {
    if (!params['id']) {
      this.initializeNewLead();
      return;
    }

    this.editingLeadId = params['id'];
    this.populateFormFromParams(params);
  });
}

private initializeNewLead() {
  this.leadForm.reset({
    contactType: 'Lead',
    isIndividual: true,
    status: 'New',
    source: this.sources.length > 0 ? this.sources[0].name : '',
    lifeStage: this.lifeStages.length > 0 ? this.lifeStages[0].name : '',
    addedBy: this.authService.getCurrentUserName(),
    country: 'India'
  });
}

private populateFormFromParams(params: any) {
  const isIndividual = params['isIndividual'] === 'true' || !params['businessName'];
  
  // First set the contact type and individual status
  this.leadForm.patchValue({
    contactType: params['contactType'] || 'Lead',
    isIndividual: isIndividual
  });

  // Then patch all other values
  const formValues = {
    prefix: params['prefix'] || '',
    firstName: params['firstName'] || '',
    middleName: params['middleName'] || '',
    lastName: params['lastName'] || '',
    gender: params['gender'] || '',
    dateOfBirth: params['dateOfBirth'] || '',
    age: params['age'] || '',
    businessName: params['businessName'] || '',
    mobile: params['mobile'] || '',
    alternateContact: params['alternateContact'] || '',
    landline: params['landline'] || '',
    email: params['email'] || '',
    department: params['department'] || '',
    leadStatus: params['leadStatus'] || '',
    leadCategory: params['leadCategory'] || '',
    leadStatusNote: params['leadStatusNote'] || '',
    dealStatus: params['dealStatus'] || '',
    priority: params['priority'] || '',
    estimatedValue: params['estimatedValue'] || '',
    source: params['source'] || '',
        occupation: params['occupation'] || '', // Add this line

    lifeStage: params['lifeStage'] || '',
    assignedTo: params['assignedTo'] || params['assignedToId'] || '',
    notes: params['notes'] || '',
    addressLine1: params['addressLine1'] || '',
    addressLine2: params['addressLine2'] || '',
    city: params['city'] || '',
    state: params['state'] || '',
    country: params['country'] || 'India',
    zipCode: params['zipCode'] || ''
  };

  this.leadForm.patchValue(formValues);

  // Handle product interested data
  if (params['productInterested']) {
    try {
      const productData = JSON.parse(params['productInterested']);
      this.selectedProducts = Array.isArray(productData) ? productData : [productData];
    } catch (e) {
      console.error('Error parsing product interested data:', e);
    }
  }

  // Update form validators based on contact type
  this.onContactTypeChange(isIndividual);

  // Handle state/district selection
  if (params['state']) {
    this.updateDistrictsByState(params['state']);
    setTimeout(() => {
      this.leadForm.get('city')?.setValue(params['city'] || '');
    }, 100);
  }
}

 ngOnDestroy(): void {
   if (this.searchSubscription) {
     this.searchSubscription.unsubscribe();
   }
   if (this.blurTimeout) {
     clearTimeout(this.blurTimeout);
   }
   // ... any other cleanup you need
 }
 
 
 // Filter method
 applyOrderStatusFilter(status: '' | 'Reordered' | 'No Reordered') {
   this.filters.orderStatus = status;
   this.activeDropdown = '';
   this.applyFilters();
 }
 
 private initializeProducts(): void {
   // Your initialization logic here
   this.filteredProducts = [...this.productsList];
 }

   
   updateDistrictsByState(state: string) {
     if (state && state in this.districtsByState) {
       this.availableDistricts = this.districtsByState[state];
       this.leadForm.get('city')?.setValue('');
     } else {
       this.availableDistricts = [];
     }
   }
  // Add the filter method
 applyAdCodeFilter(adCode: string): void {
   this.filters.adCode = adCode;
   this.applyFilters();
 }
  // Add these methods
 async loadProducts() {
   try {
     this.allProducts = await this.productsService.fetchAllProducts();
     this.filteredProductsForInterested = [...this.allProducts].slice(0, 10);
   } catch (error) {
     console.error('Error loading products:', error);
   }
 }
 
selectProduct(product: any): void {
  if (!this.isProductSelected(product)) {
    this.selectedProducts.push({ ...product });
    this.selectionChange.emit([...this.selectedProducts]);
  }
  this.searchQuery = '';
  this.searchResults = [];
  this.showSearchDropdown = false;
}

  toggleHideCompleted(): void {
     // Your existing implementation
   }
 
 
 async saveNotes() {
   if (this.selectedLead) {
     try {
       await this.leadService.updateLead(this.selectedLead.id, { 
         notes: this.currentNotes 
       });
       
       // Update local data
       const lead = this.allLeads.find(l => l.id === this.selectedLead.id);
       if (lead) {
         lead.notes = this.currentNotes;
       }
       
       this.closeNotes();
     } catch (error) {
       console.error('Error saving notes:', error);
     }
   }
 }
 
 loadRecentLeads() {
   const currentUserRole = this.authService.currentUserValue?.role || '';
   const currentUsername = this.authService.getCurrentUserName();
   const currentUserDepartment = this.authService.currentUserValue?.department || '';
 
   this.leadService.getLeads(currentUserRole, currentUsername).subscribe(leads => {
     // For recent leads, filter based on role
     if (currentUserRole === 'Executive') {
       this.recentLeads = leads
         .filter(lead => lead.assignedTo === currentUsername)
         .sort((a, b) => {
           const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
           const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
           return dateB - dateA;
         })
         .slice(0, 10);
     } else if (currentUserRole === 'Supervisor') {
       // Filter by department for supervisors
       this.recentLeads = leads
         .filter(lead => lead.department === currentUserDepartment)
         .sort((a, b) => {
           const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
           const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
           return dateB - dateA;
         })
         .slice(0, 10);
     } else {
       // Admin or other roles see all leads
       this.recentLeads = leads
         .sort((a, b) => {
           const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
           const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
           return dateB - dateA;
         })
         .slice(0, 10);
     }
   });
 }
 removeInterestedProduct(product: Product): void {
   this.selectedProductsForInterested = this.selectedProductsForInterested.filter(
     p => p.id !== product.id
   );
 }
 
 async openAssignModal(randomMode: boolean) {
   this.randomAssignMode = randomMode;
   const currentUserRole = this.authService.currentUserValue?.role || '';
   const currentUserDepartment = this.authService.currentUserValue?.department || '';
 
   if (randomMode) {
     try {
       // For supervisors, get random users from their department only
       if (currentUserRole === 'Supervisor') {
         this.availableUsers = await this.userService.getRandomUsersFromDepartment(
           currentUserDepartment, 
           3
         );
       } else {
         // For admins/managers, get random users from all departments
         this.availableUsers = await this.userService.getRandomUsers(3);
       }
       
       if (this.availableUsers.length > 0) {
         this.selectedUserId = this.availableUsers[0].id;
       }
     } catch (error) {
       console.error('Error getting random users:', error);
       return;
     }
   } else {
     // For manual assignment, filter users based on role
     if (currentUserRole === 'Supervisor') {
       this.availableUsers = this.usersList
         .filter(user => 
           user.role === 'Executive' && 
           user.department === currentUserDepartment
         )
         .map(user => ({
           id: user.id,
           name: user.name,
           email: user.email
         }));
     } else if (currentUserRole === 'Admin' || currentUserRole === 'Manager') {
       // For admin/manager, show all executive users
       this.availableUsers = this.usersList
         .filter(user => user.role === 'Executive')
         .map(user => ({
           id: user.id,
           name: user.name,
           email: user.email
         }));
     } else {
       // For other roles, show no users (or adjust as needed)
       this.availableUsers = [];
     }
   }
   
   this.showAssignModal = true;
 }
   
 
   loadConvertedCustomer() {
     // Check if there's a recently converted customer in local storage
     const convertedCustomer = localStorage.getItem('recentlyConvertedCustomer');
     if (convertedCustomer) {
       this.convertedCustomer = JSON.parse(convertedCustomer);
       // Clear it after displaying
       setTimeout(() => {
         localStorage.removeItem('recentlyConvertedCustomer');
         this.convertedCustomer = null;
       }, 10000); // Show for 10 seconds
     }
   }
   openCategoryPopup(lead: any): void {
     this.selectedLeadForCategory = lead;
     this.initializeCategoryForm(lead.categories || []);
     this.showCategoryPopup = true;
   }
   closeCategoryPopup(): void {
     this.showCategoryPopup = false;
     this.selectedLeadForCategory = null;
   }
   initializeCategoryForm(selectedCategories: string[]): void {
     this.categoryForm = this.fb.group({
       categories: [selectedCategories, Validators.required]
     });
   }
   
   isCategorySelected(category: string): boolean {
     const categories = this.categoryForm?.get('categories')?.value || [];
     return categories.includes(category);
   }  
 async loadLeads() {
   const currentUserRole = this.authService.currentUserValue?.role || '';
   const currentUsername = this.authService.getCurrentUserName();
   const currentUserDepartment = this.authService.currentUserValue?.department || '';
 
   this.leadService.getLeads().subscribe(async leads => {
     // Process each lead to check for duplicates and reorders
     for (const lead of leads) {
       if (lead.mobile) {
         lead.mobileExists = await this.customerService.checkMobileNumberExists(lead.mobile);
         lead.isReordered = lead.mobileExists;
         
         const duplicateLeads = leads.filter(l => 
           l.mobile === lead.mobile && 
           l.id !== lead.id && 
           (!l.convertedAt || (lead.createdAt && l.convertedAt > lead.createdAt))
         );
         
         lead.isDuplicate = duplicateLeads.length > 0;
         if (lead.isDuplicate) {
           lead.originalLeadId = duplicateLeads[0].id;
         }
       } else {
         lead.mobileExists = false;
         lead.isReordered = false;
         lead.isDuplicate = false;
       }
     }
       let filtered = leads;
     if (currentUserRole === 'Executive') {
       // Executives see only leads assigned to them
       filtered = leads.filter(lead => 
         lead.assignedTo === this.authService.getCurrentUserName() || 
         lead.assignedToId === this.authService.getCurrentUserId()
       );
     } else if (currentUserRole === 'Supervisor') {
       // Supervisors see leads from their department only
       filtered = leads.filter(lead => 
         lead.department === currentUserDepartment
       );
     }
     // Admin and other roles see all leads
     
     this.allLeads = filtered.map(lead => ({
       ...lead,
       productInterested: this.formatProductData(lead.productInterested)
     }));
     
     this.totalItems = this.allLeads.length;
     this.updatePagination();
     this.updateTodaysLeadsCount();
     this.applyFilter();
   });
 }
// In lead-add.component.ts
loadLeadStatuses() {
  console.log('Loading lead statuses...');
  this.leadStatusService.getLeadStatuses().subscribe(
    statuses => {
      console.log('Lead statuses loaded:', statuses);
      this.leadStatuses = statuses;
      
      // If the array is empty, add a default value for testing
      if (!this.leadStatuses || this.leadStatuses.length === 0) {
        console.warn('No lead statuses found');
      }
    }, 
    error => {
      console.error('Error loading lead statuses:', error);
    }
  );
}
   
 applyDateFilter() {
   let filtered = [...this.allLeads];
   
   if (this.fromDate || this.toDate) {
     filtered = filtered.filter(lead => {
       const leadDate = lead.createdAt ? new Date(lead.createdAt) : null;
       if (!leadDate) return false;
       
       if (this.fromDate && this.toDate) {
         const fromDate = new Date(this.fromDate);
         const toDate = new Date(this.toDate);
         // Set toDate to end of day for inclusive range
         toDate.setHours(23, 59, 59, 999);
         return leadDate >= fromDate && leadDate <= toDate;
       } else if (this.fromDate) {
         const fromDate = new Date(this.fromDate);
         return leadDate >= fromDate;
       } else if (this.toDate) {
         const toDate = new Date(this.toDate);
         // Set toDate to end of day for inclusive range
         toDate.setHours(23, 59, 59, 999);
         return leadDate <= toDate;
       }
       
       return true;
     });
   }
   
   // Apply search term filter after date filter
   if (this.searchTerm) {
     const term = this.searchTerm.toLowerCase();
     filtered = filtered.filter(lead =>
       (lead.businessName?.toLowerCase().includes(term)) ||
       (lead.firstName?.toLowerCase().includes(term)) ||
       (lead.lastName?.toLowerCase().includes(term)) ||
       (lead.middleName?.toLowerCase().includes(term)) ||
       (lead.email?.toLowerCase().includes(term)) ||
       (lead.mobile?.includes(term)) ||
       (lead.alternateContact?.includes(term)) ||
       (lead.landline?.includes(term)) ||
       (lead.status?.toLowerCase().includes(term)) ||
       (lead.source?.toLowerCase().includes(term)) ||
       (lead.assignedTo?.toLowerCase().includes(term)) ||
       (lead.lifeStage?.toLowerCase().includes(term)) ||
       (lead.department?.toLowerCase().includes(term)) ||
       (lead.leadCategory?.toLowerCase().includes(term)) ||
       (lead.dealStatus?.toLowerCase().includes(term)) ||
       (lead.priority?.toLowerCase().includes(term)) 
     );
   }
 
   this.filteredLeads = filtered;
   this.totalItems = filtered.length;
   this.updatePagination();
 }
 
 clearDateFilter() {
   this.fromDate = '';
   this.toDate = '';
   this.applyFilter(); // Use the existing filter method without date filters
 }
   viewCustomerDetails(customerId: string) {
     this.router.navigate(['/customers', customerId]);
   }
   toggleLeadSelection(leadId: string) {
     if (this.selectedLeads.has(leadId)) {
       this.selectedLeads.delete(leadId);
     } else {
       this.selectedLeads.add(leadId);
     }
     
     // Update the "select all" checkbox state
     this.allSelected = this.filteredLeads.length > 0 && 
                      this.selectedLeads.size === this.filteredLeads.length;
   }
   
   isSelected(leadId: string): boolean {
     return this.selectedLeads.has(leadId);
   }
 
 
 
 
 
 
  
 
 
   firestore(firestore: any, arg1: string, leadId: string) {
     throw new Error('Method not implemented.');
   }
   getLeadById(leadId: string): any {
     return this.allLeads.find(lead => lead.id === leadId);
   }
   getLeadDisplay(lead: any): string {
     if (!lead) return '';
     if (lead.businessName) {
       return `${lead.businessName} - (${lead.contactId}) (Lead)`;
     } else {
       const name = `${lead.firstName || ''} ${lead.lastName || ''}`.trim();
       return `${name} - (${lead.contactId}) (Cus)`;
     }
   }
   
onStateChange() {
  const selectedState = this.leadForm.get('state')?.value;
  if (selectedState && this.districtsByState[selectedState]) {
    this.availableDistricts = this.districtsByState[selectedState];
    // Don't reset district if we're editing and the state hasn't changed
    if (!this.editingLeadId || this.leadForm.get('city')?.value === '') {
      this.leadForm.get('city')?.setValue('');
    }
  } else {
    this.availableDistricts = [];
    this.leadForm.get('city')?.setValue('');
  }
}
 // Add these helper methods
 onCategoryChange(event: any, category: string) {
   const categories = this.categoryForm.get('categories')?.value || [];
   if (event.target.checked) {
     if (!categories.includes(category)) {
       categories.push(category);
     }
   } else {
     const index = categories.indexOf(category);
     if (index > -1) {
       categories.splice(index, 1);
     }
   }
   this.categoryForm.get('categories')?.setValue(categories);
 }
 
 saveCategories(): void {
   if (this.categoryForm.valid) {
     const categories = this.categoryForm.get('categories')?.value || [];
     // Update the lead with the selected categories
     if (this.selectedLeadForCategory) {
       this.selectedLeadForCategory.categories = categories;
       // Call your service to save the lead with updated categories
       // this.leadService.updateLeadCategories(this.selectedLeadForCategory.id, categories)
       //   .subscribe(...);
     }
     this.closeCategoryPopup();
   }
 }
 getCurrentUserId(): string {
   // Replace with authService call
   return this.authService.getCurrentUserId();
 }
 
 getCurrentUserName(): string {
   // Replace with authService call
   return this.authService.getCurrentUserName();
 }
 loadUsers() {
   const currentUserRole = this.authService.currentUserValue?.role || '';
   const currentUserDepartment = this.authService.currentUserValue?.department || '';
 
   this.userService.getUsers().subscribe(users => {
     // Map all users first
     this.usersList = users.map(user => ({
       id: user.id,
       name: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || user.email,
       department: user.department || '',
       email: user.email || '',
       username: user.username || '',
       role: user.role || ''
     }));
     
     // Initialize filteredUsers based on role
     if (currentUserRole === 'Supervisor') {
       // For supervisors, show only executives in their department
       this.filteredUsers = this.usersList.filter(user => 
         user.role === 'Executive' && 
         user.department === currentUserDepartment
       );
     } else if (currentUserRole === 'Admin' || currentUserRole === 'Manager') {
       // For admins/managers, show all executives
       this.filteredUsers = this.usersList.filter(user => user.role === 'Executive');
     } else {
       // For other roles (like Executive), show no users (or adjust as needed)
       this.filteredUsers = [];
     }
     
     if (!this.editingLeadId) {
       this.leadForm.patchValue({
         addedBy: this.authService.getCurrentUserName()
       });
     }
     
     // For editing, set the department and filter users
     if (this.editingLeadId) {
       const currentLead = this.allLeads.find(lead => lead.id === this.editingLeadId);
       if (currentLead) {
         // Set addedBy if it exists
         if (currentLead.addedBy) {
           this.leadForm.get('addedBy')?.setValue(currentLead.addedBy.userName);
         }
         
         // Set department and filter users
         if (currentLead.department) {
           this.leadForm.get('department')?.setValue(currentLead.department);
           
           // Apply the same filtering logic for editing
           if (currentUserRole === 'Supervisor') {
             this.filteredUsers = this.usersList.filter(user => 
               user.department === currentLead.department &&
               user.role === 'Executive'
             );
           } else {
             this.filteredUsers = this.usersList.filter(user => 
               user.department === currentLead.department &&
               user.role === 'Executive'
             );
           }
           
           this.selectedUserDepartment = currentLead.department;
         }
         
         // Set assignedTo if it exists - lookup by name or username
         if (currentLead.assignedTo) {
           const assignedUser = this.usersList.find(u => 
             u.name === currentLead.assignedTo || 
             u.username === currentLead.assignedTo ||
             u.id === currentLead.assignedTo
           );
           if (assignedUser) {
             this.leadForm.get('assignedTo')?.setValue(assignedUser.id);
           }
         }
       }
     }
   });
 }
 onUserSelectionChange(userId: string): void {
   if (!userId) {
     this.selectedUserDepartment = '';
     return;
   }
   
   const selectedUser = this.usersList.find(user => user.id === userId);
   if (selectedUser) {
     // Update the department field to match the selected user's department
     this.leadForm.get('department')?.setValue(selectedUser.department);
     this.selectedUserDepartment = selectedUser.department;
   }
 }
loadFollowupCategories(): void {
  this.followupCategoryService.getFollowupCategories()
    .subscribe({
      next: (categories) => {
        this.followupCategories = categories;
      },
      error: (error) => {
        console.error('Error loading followup categories:', error);
      }
    });
}
   
 
 
 
 
 
 
 
 
   loadLifeStages() {
     this.lifeStageService.getLifeStages().then(stages => {
       this.lifeStages = stages;
       // Set default value if needed
       if (stages.length > 0 && !this.assignForm.get('lifeStage')?.value) {
         this.assignForm.get('lifeStage')?.setValue(stages[0].name);
       }
     }).catch(error => {
       console.error('Error loading life stages:', error);
     });
   }
 
   loadSources() {
     this.sourceService.getSources().then(sources => {
       this.sources = sources;
       if (sources.length > 0 && !this.leadForm.get('source')?.value) {
         this.leadForm.get('source')?.setValue(sources[0]['name']);
       }
     }).catch(error => {
       console.error('Error loading sources:', error);
     });
   }
 
   get f() { return this.leadForm.controls; }
   get followUpControls() { return this.followUpForm.controls; }
 async convertToCustomer(lead: any) {
   // Check if mobile exists in customers
   const mobileExists = await this.customerService.checkMobileNumberExists(lead.mobile);
   this.mobileExists = mobileExists;
   
   // Scenario 1: New Lead (Convert to Customer)
   if (!mobileExists) {
     if (!confirm('Convert this lead to new customer and create sales order?')) {
       return;
     }
 
     try {
       // 1. Convert lead to customer (preserving assignedTo)
       const customerData = await this.leadService.convertLeadToCustomer({
         ...lead,
         assignedTo: lead.assignedTo,
         assignedToId: lead.assignedToId
       });
       
       // 2. Delete the lead after successful conversion
       await this.leadService.deleteLead(lead.id);
 
       // 3. Prepare data for sales order
       localStorage.setItem('convertedLeadForSale', JSON.stringify({
         customerData: {
           ...customerData,
           displayName: lead.businessName || `${lead.firstName} ${lead.lastName}`.trim(),
           assignedTo: lead.assignedTo, // Ensure assignedTo is passed to sales
           assignedToId: lead.assignedToId
         },
         isExistingCustomer: false,
         leadId: lead.id
       }));
 
       // 4. Navigate to sales order
       this.router.navigate(['/add-sale']);
 
     } catch (error) {
       console.error('Conversion error:', error);
       alert('Error converting lead to customer');
     }
   } 
   // Scenario 2: Existing Customer (Create Sales Order)
   else {
     this.prepareForSalesOrder(lead);
   }
 }
 async prepareForSalesOrder(lead: any) {
   try {
     // 1. Delete the lead first
     await this.leadService.deleteLead(lead.id);
     
     // 2. Get customer data (since mobile exists)
     const customerData = await this.customerService.getCustomerByMobile(lead.mobile);
     
     // 3. Prepare data for sales order
     localStorage.setItem('convertedLeadForSale', JSON.stringify({
       customerData: {
         ...customerData,
         displayName: lead.businessName || `${lead.firstName} ${lead.lastName}`.trim()
       },
       isExistingCustomer: true,
       leadId: lead.id
     }));
 
     // 4. Navigate to sales order
     this.router.navigate(['/add-sale']);
     
   } catch (error) {
     console.error('Error preparing for sales order:', error);
     this.validationMessage = {
       text: 'Error creating sales order. Please try again.',
       type: 'error'
     };
   }
 }
 
 addFollowUp(lead: any): void {
   // Navigate to follow-form with lead data as query params
   this.router.navigate(['/follow-form'], {
     queryParams: { 
       leadId: lead.id,
       title: `Follow up for ${lead.businessName || lead.firstName}`,
       customerLead: lead.id,
       assignedTo: lead.assignedTo
     }
   });
 }
   
   saveFollowUp() {
     if (this.followUpForm.invalid) {
       this.followUpForm.markAllAsTouched();
       return;
     }
 
     const followUpData = {
       leadId: this.selectedLeadForFollowUp.id,
       title: this.followUpForm.get('title')?.value,
       startDateTime: this.followUpForm.get('startDateTime')?.value,
       endDateTime: this.followUpForm.get('endDateTime')?.value,
       description: this.followUpForm.get('description')?.value,
       type: this.followUpForm.get('followUpType')?.value,
       category: this.followUpForm.get('followupCategory')?.value,
       assignedTo: this.followUpForm.get('assignedTo')?.value,
       notification: this.followUpForm.get('sendNotification')?.value ? {
         sms: this.followUpForm.get('notifySms')?.value,
         email: this.followUpForm.get('notifyEmail')?.value,
         beforeValue: this.followUpForm.get('notifyBeforeValue')?.value,
         beforeUnit: this.followUpForm.get('notifyBeforeUnit')?.value
       } : null,
       status: this.followUpForm.get('status')?.value || 'Scheduled'
     };
 
     this.leadService.addFollowUp(followUpData).then(() => {
       this.closeFollowUpForm();
       this.loadLeads();
     }).catch(error => {
       console.error('Error adding follow up:', error);
       alert('Error adding follow up. Please try again.');
     });
   }
   
   closeFollowUpForm() {
     this.showFollowUpForm = false;
     this.selectedLeadForFollowUp = null;
   }

   updateValidators() {
     if (this.isIndividualType) {
       this.f['firstName'].setValidators([Validators.required]);
       this.f['businessName'].clearValidators();
     } else {
       this.f['businessName'].setValidators([Validators.required]);
       this.f['firstName'].clearValidators();
     }
     this.f['firstName'].updateValueAndValidity();
     this.f['businessName'].updateValueAndValidity();
   }
 
 
 
 formatDateForDisplay(dateString: string): string {
   if (!dateString) return '';
   const date = new Date(dateString);
   const day = date.getDate().toString().padStart(2, '0');
   const month = (date.getMonth() + 1).toString().padStart(2, '0');
   const year = date.getFullYear().toString().slice(-2);
   return `${day}/${month}/${year}`;
 }
 
 formatDateForInput(dateString: string): string {
   if (!dateString) return '';
   const [day, month, year] = dateString.split('/');
   const fullYear = '20' + year; // Assuming 21st century
   return `${fullYear}-${month}-${day}`;
 }
 updateTodaysLeadsCount(): void {
   const today = new Date();
   today.setHours(0, 0, 0, 0);
   
   this.todaysLeadsCount = this.allLeads.filter(lead => {
     if (!lead.createdAt) return false;
     const leadDate = new Date(lead.createdAt);
     leadDate.setHours(0, 0, 0, 0);
     return leadDate.getTime() === today.getTime();
   }).length;
 }
   private formatProductData(products: any): any {
     if (!products) return null;
     
     // If it's already a string, return as is
     if (typeof products === 'string') return products;
     
     // If it's an array, ensure each item has productName/name
     if (Array.isArray(products)) {
       return products.map(p => ({
         productName: p.productName || p.name || '',
         ...p
       }));
     }
     
     // If it's a single object, ensure it has productName/name
     if (typeof products === 'object') {
       return {
         productName: products.productName || products.name || '',
         ...products
       };
     }
     
     return null;
   }
 
   toggleMoreInfo() {
     this.showMoreInfo = !this.showMoreInfo;
   }
editLead(lead: any) {
 this.showForm = true;  // Ensure form is visible
  this.editingLeadId = lead.id;
  this.router.navigate(['/crm/lead-add'], { 
    queryParams: { 
      id: lead.id,
      
      // Pass all relevant lead data
      contactType: lead.contactType,
      
      isIndividual: !lead.businessName, // If businessName exists, it's not individual
      firstName: lead.firstName,
      lastName: lead.lastName,
      businessName: lead.businessName,
      mobile: lead.mobile,
            occupation: lead.occupation || '', // Add this line

      alternateContact: lead.alternateContact,
      landline: lead.landline, // Add landline
       leadStatusNote: lead.leadStatusNote, // Add lead status note
      email: lead.email,
      department: lead.department,
      productInterested: lead.productInterested ? JSON.stringify(lead.productInterested) : '',

      leadStatus: lead.leadStatus,
      leadCategory: lead.leadCategory,
      gender: lead.gender || '',
      age: lead.age || '',
      dateOfBirth: lead.dateOfBirth || '',
      prefix: lead.prefix || '',
      middleName: lead.middleName || '',
      dealStatus: lead.dealStatus,
      priority: lead.priority,
      estimatedValue: lead.estimatedValue,
      source: lead.source,
      lifeStage: lead.lifeStage,
      assignedTo: lead.assignedToId || lead.assignedTo, // Include assignedTo
      notes: lead.notes,
      addressLine1: lead.addressLine1,
      addressLine2: lead.addressLine2,
      city: lead.city, // Add city (district)
      state: lead.state, // Add state
      country: lead.country,
      zipCode: lead.zipCode,
    }
  });
}
// In lead-add.component.ts

// File: src/app/lead-add/lead-add.component.ts
// File: src/app/lead-add/lead-add.component.ts

// REPLACE your existing prefillFromExistingCustomer method with this complete version.
// File: src/app/lead-add/lead-add.component.ts

// REPLACE your existing prefillFromExistingCustomer method with this one.
// File: src/app/lead-add/lead-add.component.ts

// REPLACE your existing prefillFromExistingCustomer method with this complete version.
// REPLACE your existing prefillFromExistingCustomer method with this one.
prefillFromExistingCustomer(customer: any): void {
    const isIndividual = !customer.businessName;
    this.onContactTypeChange(isIndividual);

    this.leadForm.patchValue({
      // ... (all other existing fields like firstName, mobile, address, etc. remain the same)
      isIndividual: isIndividual,
      prefix: customer.prefix || '',
      firstName: customer.firstName || '',
      middleName: customer.middleName || '',
      lastName: customer.lastName || '',
      businessName: customer.businessName || '',
      gender: customer.gender || '',
      dateOfBirth: customer.dateOfBirth || customer.dob || '',
      age: customer.age || null,
      occupation: customer.occupation || '',
      email: customer.email || '',
      alternateContact: customer.alternateContact || '',
      landline: customer.landline || '',
      addressLine1: customer.addressLine1 || customer.address || '',
      addressLine2: customer.addressLine2 || '',
      city: customer.city || customer.district || '',
      state: customer.state || '',
      country: customer.country || 'India',
      zipCode: customer.zipCode || '',
      
      // ======================= THE FIX =======================
      // This part now correctly reads the fields that were saved in Part 1.
      leadCategory: customer.leadCategory || '',
      dealStatus: customer.dealStatus || '',
      priority: customer.priority || '',
      estimatedValue: customer.estimatedValue || '',
      leadStatus: customer.leadStatus || '', // READING from 'leadStatus'
      lifeStage: customer.lifeStage || '',  // READING from 'lifeStage'
      source: customer.source || '',
      department: customer.department || '',
      assignedTo: customer.assignedToId || customer.assignedTo || '',
      notes: customer.notes || '',
      // ===================== END OF THE FIX ====================
    });

    // This part for state/district dropdowns remains the same.
    if (customer.state) {
      this.updateDistrictsByState(customer.state);
      setTimeout(() => {
        this.leadForm.get('city')?.setValue(customer.city || customer.district || '');
      }, 100);
    }
  }
prefillFormWithCustomerData(customer: any) {
  // Determine if it's an individual or business based on businessName
  const isIndividual = !customer.businessName;
  this.onContactTypeChange(isIndividual); // This updates validators correctly

  this.leadForm.patchValue({
    // Personal Info
    isIndividual: isIndividual,
    prefix: customer.prefix || '',
    firstName: customer.firstName || '',
    middleName: customer.middleName || '',
    lastName: customer.lastName || '',
    businessName: customer.businessName || '',
    gender: customer.gender || '',
    dateOfBirth: customer.dateOfBirth || customer.dob || '',
    age: customer.age || '',
    occupation: customer.occupation || '',
    
    // Contact Info
    email: customer.email || '',
    alternateContact: customer.alternateContact || '',
    landline: customer.landline || '',
    
    // Address Info
    addressLine1: customer.addressLine1 || customer.address || '',
    addressLine2: customer.addressLine2 || '',
    city: customer.city || '',
    state: customer.state || '',
    country: customer.country || 'India',
    zipCode: customer.zipCode || '',
    
    // Lead Info
    leadCategory: customer.leadCategory || '',
    dealStatus: customer.dealStatus || '',
    priority: customer.priority || '',
    estimatedValue: customer.estimatedValue || '',
    source: customer.source || '',
    lifeStage: customer.lifeStage || customer.lifestage || '',
    department: customer.department || '',
    assignedTo: customer.assignedToId || customer.assignedTo || '', // Prefer ID
    notes: customer.notes || ''
  });

  // Handle state/district selection if state data exists
  if (customer.state) {
    this.updateDistrictsByState(customer.state);
    // Use a small timeout to allow the districts to load before setting the city
    setTimeout(() => {
      this.leadForm.get('city')?.setValue(customer.city || '');
    }, 100);
  }
}

 viewLead(lead: any) {
   this.router.navigate(['/lead', lead.id]);
 }
 
   

 

 selectAllFilteredLeads() {
   // Clear previous selections
   this.selectedLeads.clear();
   
   // Add all filtered leads
   this.filteredLeads.forEach(lead => this.selectedLeads.add(lead.id));
   
   // Update select all checkbox state
   this.allSelected = this.filteredLeads.length > 0 && 
                    this.selectedLeads.size === this.filteredLeads.length;
   
   // Show feedback
   this.validationMessage = {
     text: `Selected ${this.selectedLeads.size} leads for bulk action`,
     type: 'success'
   };
   
   setTimeout(() => this.validationMessage = null, 2000);
 }
 
 
 private generateContactId(): string {
   const prefix = 'LID';
   const randomNum = Math.floor(100000 + Math.random() * 900000);
   return `${prefix}${randomNum}`;
 }
   deleteLead(leadId: string) {
     if (confirm('Are you sure you want to delete this lead?')) {
       this.leadService.deleteLead(leadId).then(() => {
         console.log('Lead deleted');
       });
     }
   }
 
 applyFilter() {
   if (this.filterDebounceTimer) {
     clearTimeout(this.filterDebounceTimer);
   }
 
   this.filterDebounceTimer = setTimeout(() => {
     let filtered = [...this.allLeads];
     const currentUser = this.authService.currentUserValue;
     const currentUserRole = currentUser?.role || '';
     const currentUserDepartment = currentUser?.department || '';
 
     // Supervisors can only see leads from their department
     if (currentUserRole === 'Supervisor') {
       filtered = filtered.filter(lead => lead.department === currentUserDepartment);
     }
 
     // Search term filter
     if (this.filters.searchTerm) {
       const term = this.filters.searchTerm.toLowerCase();
       filtered = filtered.filter(lead =>
         (lead.businessName?.toLowerCase().includes(term)) ||
         (lead.firstName?.toLowerCase().includes(term)) ||
         (lead.lastName?.toLowerCase().includes(term)) ||
         (lead.middleName?.toLowerCase().includes(term)) ||
         (lead.email?.toLowerCase().includes(term)) ||
         (lead.mobile?.includes(term)) ||
         (lead.alternateContact?.includes(term)) ||
         (lead.landline?.includes(term)) ||
         (lead.status?.toLowerCase().includes(term)) ||
         (lead.source?.toLowerCase().includes(term)) ||
         (lead.assignedTo?.toLowerCase().includes(term)) ||
         (lead.lifeStage?.toLowerCase().includes(term)) ||
         (lead.department?.toLowerCase().includes(term)) ||
         (lead.leadCategory?.toLowerCase().includes(term)) ||
         (lead.dealStatus?.toLowerCase().includes(term)) ||
         (lead.priority?.toLowerCase().includes(term))
       );
     }
 
     // Source filter
     if (this.filters.source) {
       filtered = filtered.filter(lead => lead.source === this.filters.source);
     }
 
     this.filteredLeads = filtered;
     this.totalItems = filtered.length;
     this.updatePagination();
   }, 300); // Add debounce delay if needed
 }
 
 
   sortTable(column: string) {
     if (this.sortColumn === column) {
       // Reverse the sort direction if same column clicked again
       this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
     } else {
       // New column to sort, default to ascending
       this.sortColumn = column;
       this.sortDirection = 'asc';
     }
   
     // Apply the sorting
     this.applySorting();
   }
   applySorting() {
     if (!this.sortColumn) return;
   
     this.filteredLeads.sort((a, b) => {
       let valueA = a[this.sortColumn];
       let valueB = b[this.sortColumn];
   
       // Handle dates
       if (this.sortColumn.includes('Date') || this.sortColumn === 'createdAt' || this.sortColumn === 'upcomingFollowUp') {
         valueA = valueA ? new Date(valueA).getTime() : 0;
         valueB = valueB ? new Date(valueB).getTime() : 0;
       }
   
       // Handle string comparison
       if (typeof valueA === 'string') valueA = valueA.toLowerCase();
       if (typeof valueB === 'string') valueB = valueB.toLowerCase();
   
       // Handle null/undefined values
       if (valueA == null) valueA = '';
       if (valueB == null) valueB = '';
   
       // Compare values
       if (valueA < valueB) {
         return this.sortDirection === 'asc' ? -1 : 1;
       }
       if (valueA > valueB) {
         return this.sortDirection === 'asc' ? 1 : -1;
       }
       return 0;
     });
   
     // Update pagination after sorting
     this.updatePagination();
   }
   
 
 
 
 
   goToPage(page: number) {
     this.currentPage = page;
     this.updatePagination();
   }
 
 async mergeDuplicate(leadId: string, keepOriginal: boolean) {
   if (confirm(`Are you sure you want to merge this lead? All information will be ${keepOriginal ? 'merged into the original lead' : 'kept in this lead and the original will be deleted'}`)) {
     try {
       // Implement your merge logic here since mergeDuplicateLeads doesn't exist in the service
       const lead = await this.leadService.getLeadById(leadId);
       const originalLead = await this.leadService.getLeadById(lead.originalLeadId);
       
       if (keepOriginal) {
         // Merge data into original lead
         const mergedData = {
           ...originalLead,
           notes: `${originalLead.notes || ''}\n\nMerged from duplicate lead ${lead.contactId} on ${new Date().toLocaleString()}:\n${lead.notes || ''}`,
           updatedAt: new Date()
         };
         
         await this.leadService.updateLead(originalLead.id, mergedData);
         await this.leadService.deleteLead(lead.id);
       } else {
         // Merge data into the duplicate lead and delete original
         const mergedData = {
           ...lead,
           isDuplicate: false,
           originalLeadId: undefined,
           notes: `${lead.notes || ''}\n\nMerged from original lead ${originalLead.contactId} on ${new Date().toLocaleString()}:\n${originalLead.notes || ''}`,
           updatedAt: new Date()
         };
         
         await this.leadService.updateLead(lead.id, mergedData);
         await this.leadService.deleteLead(originalLead.id);
       }
 
       this.validationMessage = {
         text: 'Leads merged successfully',
         type: 'success'
       };
       this.loadLeads();
     } catch (error) {
       console.error('Error merging leads:', error);
       this.validationMessage = {
         text: 'Error merging leads. Please try again.',
         type: 'error'
       };
     }
   }
 }
  async updateLead(leadId: string, data: any): Promise<void> {
   try {
     await this.leadService.updateLead(leadId, data);
   } catch (error) {
     console.error('Error updating lead:', error);
     throw error;
   }
 }
 
   getStatusClass(status: string) {
     switch (status) {
       case 'New': return 'status-new';
       case 'Contacted': return 'status-contacted';
       case 'Qualified': return 'status-qualified';
       case 'Proposal Sent': return 'status-proposal';
       case 'Negotiation': return 'status-negotiation';
       case 'Closed Won': return 'status-won';
       case 'Closed Lost': return 'status-lost';
       case 'Converted': return 'status-converted';
       default: return 'status-new';
     }
   }
 
   getLifeStageClass(lifeStage: string) {
     switch (lifeStage) {
       case 'Awareness': return 'lifestage-awareness';
       case 'Consideration': return 'lifestage-consideration';
       case 'Decision': return 'lifestage-decision';
       case 'Retention': return 'lifestage-retention';
       case 'Advocacy': return 'lifestage-advocacy';
       default: return 'lifestage-awareness';
     }
   }
  // Export to Excel

  // Print Functionality

   
   // PDF Export
   exportPDF(): void {
     const doc = new jsPDF();
     const title = `Leads Report - ${new Date().toLocaleDateString()}`;
     
     // Add title
     doc.setFontSize(18);
     doc.text(title, 14, 15);
     
     // Prepare data for the table
     const data = this.allLeads.map(lead => [
       lead.contactId,
       lead.businessName || `${lead.firstName} ${lead.lastName}`.trim(),
       lead.mobile,
       lead.lifeStage,
       lead.dealStatus,
       lead.leadStatus,
       lead.priority,
       lead.department || '',
 
       lead.assignedTo,
       lead.upcomingFollowUp ? new Date(lead.upcomingFollowUp).toLocaleString() : '',
       lead.createdAt ? new Date(lead.createdAt).toLocaleString() : ''
     ]);
     
     // Add table
     (doc as any).autoTable({
       head: [
         ['Contact ID', 'Name', 'Mobile', 'Life Stage', 'Deal Status', 
          'Status', 'Priority', 'department','Assigned To', 'Upcoming Follow Up', 'Created At']
       ],
       body: data,
       startY: 25,
       styles: {
         fontSize: 8,
         cellPadding: 1,
         overflow: 'linebreak'
       },
       columnStyles: {
         0: { cellWidth: 20 },
         1: { cellWidth: 25 },
         2: { cellWidth: 20 },
         3: { cellWidth: 20 },
         4: { cellWidth: 20 },
         5: { cellWidth: 20 },
         6: { cellWidth: 15 },
         7: { cellWidth: 20 },
         8: { cellWidth: 25 },
         9: { cellWidth: 25 }
       }
     });
     
     // Save the PDF
     doc.save(`leads_${new Date().toISOString().slice(0, 10)}.pdf`);
   }
   toggleAdvancedFilters(): void {
     this.showAdvancedFilters = !this.showAdvancedFilters;
   }
   toggleProductDropdown(): void {
     this.showProductDropdown = !this.showProductDropdown;
     if (this.showProductDropdown) {
       this.filterProductsForInterested();
     }
   }
 filterProductsForInterested(): void {
   if (!this.productSearchInput) {
     this.filteredProductsForInterested = [...this.productsList];
     return;
   }
   
   const searchTerm = this.productSearchInput.toLowerCase();
   this.filteredProductsForInterested = this.productsList.filter(product => 
     (product.productName?.toLowerCase().includes(searchTerm) || 
      product.name?.toLowerCase().includes(searchTerm) ||
      product.sku?.toLowerCase().includes(searchTerm))
   );
 }

preventBlur(event: MouseEvent): void {
  event.preventDefault();
}
   

onSearchFocus(): void {
  if (this.searchQuery && this.searchQuery.length >= 2) {
    this.showSearchDropdown = true;
  }
}


onSearchBlur(): void {
  // Use setTimeout to allow click events to process before hiding
  setTimeout(() => {
    this.showSearchDropdown = false;
  }, 200);
}
 
toggleForm() {
  if (this.editingLeadId) {
    // If editing, navigate back to the leads list
    this.router.navigate(['/crm/leads']);
  } else {
    // If adding new, just hide the form without clearing data
    this.showForm = !this.showForm;
  }
}
 applyFilters(): void {
   if (this.filterDebounceTimer) {
     clearTimeout(this.filterDebounceTimer);
   }
    this.filterDebounceTimer = setTimeout(() => {
     let filtered = [...this.allLeads];
     
     // For supervisors, always filter by their department first
     if (this.currentUserRole === 'Supervisor') {
       filtered = filtered.filter(lead => 
         lead.department === this.currentUserDepartment
       );
     }
 
  if (this.filters.searchTerm) {
       const term = this.filters.searchTerm.toLowerCase();
       filtered = filtered.filter(lead => 
         this.searchInLead(lead, term)
       );
     }
 
     if (this.filters.lifeStage) {
       filtered = filtered.filter(lead => 
         lead.lifeStage?.toLowerCase() === this.filters.lifeStage.toLowerCase()
       );
     }
 
     if (this.filters.leadStatus) {
       filtered = filtered.filter(lead => 
         lead.leadStatus?.toLowerCase() === this.filters.leadStatus.toLowerCase()
       );
     }
 
     if (this.filters.assignedTo) {
       filtered = filtered.filter(lead => 
         lead.assignedTo?.toLowerCase().includes(this.filters.assignedTo.toLowerCase())
       );
     }
 
     if (this.filters.dealStatus) {
       filtered = filtered.filter(lead => 
         lead.dealStatus?.toLowerCase() === this.filters.dealStatus.toLowerCase()
       );
     }
 
     if (this.filters.priority) {
       filtered = filtered.filter(lead => 
         lead.priority?.toLowerCase() === this.filters.priority.toLowerCase()
       );
     }
 
     if (this.filters.department) {
       filtered = filtered.filter(lead => 
         lead.department?.toLowerCase() === this.filters.department.toLowerCase()
       );
     }
 
     if (this.filters.addedBy) {
       filtered = filtered.filter(lead => 
         lead.addedBy?.userName?.toLowerCase().includes(this.filters.addedBy.toLowerCase())
       );
     }
 
     if (this.filters.orderStatus) {
       filtered = filtered.filter(lead => {
         if (this.filters.orderStatus === 'Reordered') {
           return lead.status === 'Reordered' || lead.mobileExists;
         } else if (this.filters.orderStatus === 'No Reordered') {
           return lead.status !== 'Reordered' && !lead.mobileExists;
         }
         return true;
       });
     }
 
      if (this.filters.fromDate || this.filters.toDate) {
       filtered = filtered.filter(lead => {
         if (!lead.createdAt) return false;
         
         const leadDate = new Date(lead.createdAt);
         leadDate.setHours(0, 0, 0, 0); // Normalize time to midnight
         
         if (this.filters.fromDate && this.filters.toDate) {
           const fromDate = new Date(this.filters.fromDate);
           fromDate.setHours(0, 0, 0, 0);
           const toDate = new Date(this.filters.toDate);
           toDate.setHours(23, 59, 59, 999);
           return leadDate >= fromDate && leadDate <= toDate;
         } else if (this.filters.fromDate) {
           const fromDate = new Date(this.filters.fromDate);
           fromDate.setHours(0, 0, 0, 0);
           return leadDate >= fromDate;
         } else if (this.filters.toDate) {
           const toDate = new Date(this.filters.toDate);
           toDate.setHours(23, 59, 59, 999);
           return leadDate <= toDate;
         }
         return true;
       });
     }
 
     this.filteredLeads = filtered;
     this.totalItems = filtered.length;
     this.currentPage = 1;
   this.leadForm.value,
     this.selectedProductsForInterested.length > 0 
       ? this.selectedProductsForInterested 
       : null,
     this.updatePagination();
   }, 300);
 }
 
 
 
 
   getProductNames(products: any): string {
     if (!products) return '';
     
     // Handle case where it's already a string
     if (typeof products === 'string') return products;
     
     // Handle array of products
     if (Array.isArray(products)) {
       return products.map(p => p.productName || p.name || '').filter(Boolean).join(', ');
     }
     
     // Handle single product object
     if (typeof products === 'object') {
       return products.productName || products.name || '';
     }
     
     return '';
   }
   // Add method to remove selected product

   clearFilters(): void {
     this.filters = {
       searchTerm: '',
       source: '',
       lifeStage: '',
       leadStatus: '',
       assignedTo: '',
       dealStatus: '',
       priority: '',
       department: '',
       addedBy: '',
       fromDate: '',
       toDate: '',
       code: '',
       adCode:'',
       orderStatus: '',
     };
     this.applyFilters();
   }
   onProductSelect(productName: string): void {
     const selectedProduct = this.filteredProducts.find(p => p.productName === productName);
     if (selectedProduct) {
       console.log('Selected product:', selectedProduct);
       // Add your selection logic here
     }
   }
   
 
   
   
   
   
   
   
   
 
 
  }
 
 function doc(firestore: any, arg1: string, leadId: string) {
   throw new Error('Function not implemented.');
 }
 
 
 function updateDoc(leadDocRef: any, updateData: any): any {
   throw new Error('Function not implemented.');
 }