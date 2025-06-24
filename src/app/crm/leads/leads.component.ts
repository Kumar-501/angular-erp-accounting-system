import { Component, HostListener, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { LeadService } from '../../services/leads.service';
import { SourceService } from '../../services/source.service';
import { LifeStageService } from '../../services/life-stage.service';
import { UserService } from '../../services/user.service';
import { Router } from '@angular/router';
import { FollowupCategoryService } from '../../services/followup-category.service';
import { CustomerService } from '../../services/customer.service';
import { LeadStatusService } from '../../services/lead-status.service';
import { FileSizePipe } from './file-size.pipe';
import { getDocs } from '@angular/fire/firestore';

import * as XLSX from 'xlsx';
import {  Input, Output, EventEmitter, ViewChild, ElementRef } from '@angular/core';
import { Subscription, debounceTime, distinctUntilChanged, Subject } from 'rxjs';




import { jsPDF } from 'jspdf';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import 'jspdf-autotable';
import { Lead } from './lead.model';
import { AuthService } from '../../auth.service';
import { ProductsService } from '../../services/products.service';
import { Product } from '../../models/product.model';
interface DistrictMap {
  [key: string]: string[];
  Kerala: string[];
  'Tamil Nadu': string[];
}

interface LeadFilters {
  searchTerm: string;
  source: string;
  lifeStage: string;
  leadStatus: string;
  assignedTo: string;
  dealStatus: string;
  priority: string;
  department: string;
  addedBy: string;
  fromDate: string;
  toDate: string;
  orderStatus: '' | 'Reordered' | 'No Reordered';
  adCode: string;
  dateOption: string; // Add this
}


@Component({
  selector: 'app-leads',
  templateUrl: './leads.component.html',
  styleUrls: ['./leads.component.scss']
})
export class LeadsComponent implements OnInit {
 @Input() products: any[] = [];
  @Input() size: 'small' | 'medium' | 'large' = 'medium';
  @Output() selectionChange = new EventEmitter<any[]>();
  
  @ViewChild('searchInput') searchInput!: ElementRef;
   shown = false;
  searchKeyword = '';
  selectedProducts: any[] = [];
  filteredUsers: any[] = [];
departments = ['PC1', 'PC2', 'PC3', 'PC4', 'PC5', 'PC6', 'PC7', 'PC8'];
  filteredProducts: any[] = [];
  pageSizeOptions = [10, 25, 50, 100];  // Add this line
  readonly PC_DEPARTMENTS = ['PC1', 'PC2', 'PC3', 'PC4', 'PC5', 'PC6', 'PC7', 'PC8'];
  // ... other fields
  leadCategory?: string; // if you also track one main category
  categories?: string[]; // ✅ add this line
  showSearchDropdown = false;
  // Add to your component properties
quickDateRanges = [
  'Today', 
  'Yesterday', 
  'Last 7 Days', 
  'Last 30 Days',
  'Last Month',
  'This Month',
  'This Financial Year',
  'Last Financial Year',
  'Custom Range'
];
selectedDateRange: string = '';
  searchResults: any[] = [];
  paginatedLeads: any[] =[];
   private blurTimeout: any;
  private searchSubject = new Subject<string>();
  private searchSubscription!: Subscription;
  searchQuery = '';
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
  onSearchInput(): void {
    this.searchSubject.next(this.searchQuery);
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

  // Add to your component class properties
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
    { key: 'alternateContact', label: 'Alternate Contact' },

  { key: 'priority', label: 'Priority' },
  { key: 'note', label: 'Note' },
  { key: 'assignedTo', label: 'Assigned To' },
 { key: 'assignedTo', label: 'Assigned To', visible: true }, // This should show the name
  { key: 'assignedToId', label: 'Assigned To ID', visible: false } ,
  { key: 'upcomingFollowUp', label: 'Upcoming follow up' },
  { key: 'department', label: 'Department', visible: true },
    { key: 'leadCategory', label: 'Lead Category' },

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
  setQuickDate(option: string) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  let fromDate: Date;
  let toDate: Date = today;

  switch(option) {
     case 'today':
      fromDate = new Date(); // Create new instance to avoid reference issues
      toDate = new Date();  // Create new instance to avoid reference issues
      break;
    case 'yesterday':
      fromDate = yesterday;
      toDate = yesterday;
      break;
    case 'last7':
      fromDate = new Date(today);
      fromDate.setDate(fromDate.getDate() - 6);
      break;
    case 'last30':
      fromDate = new Date(today);
      fromDate.setDate(fromDate.getDate() - 29);
      break;
    case 'lastMonth':
      fromDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      toDate = new Date(today.getFullYear(), today.getMonth(), 0);
      break;
    case 'thisMonth':
      fromDate = new Date(today.getFullYear(), today.getMonth(), 1);
      break;
    case 'thisFY':
      // Adjust this based on your fiscal year start (April in this example)
      const fyStartMonth = 3; // April (0-indexed)
      fromDate = today.getMonth() >= fyStartMonth ? 
        new Date(today.getFullYear(), fyStartMonth, 1) :
        new Date(today.getFullYear() - 1, fyStartMonth, 1);
      break;
    case 'lastFY':
      const lastFYStartMonth = 3; // April (0-indexed)
      fromDate = new Date(today.getFullYear() - 1, lastFYStartMonth, 1);
      toDate = new Date(today.getFullYear(), lastFYStartMonth, 0);
      break;
    default:
      fromDate = new Date(0); // Default to beginning of time
  }

 this.filters.fromDate = this.formatDate(fromDate);
  this.filters.toDate = this.formatDate(toDate);
  this.filters.dateOption = option;
  
  this.applyFilters();
}
private formatDate(date: Date): string {
  if (!date) return '';
  
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}
isActiveDateOption(option: string): boolean {
  // Implement logic to check if the current filter matches this option
  // This is for highlighting the active option
  // You'll need to compare your current date range with what the option would set
  // This is a simplified version - you'll need to expand it
  return this.filters.dateOption === option;
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
    department: this.selectedUserDepartment
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
  
  
  visibleColumns = [
    'select', 'action', 'createdAt', 'contactId', 'fullName', 'mobile', 'addedBy',
    'lifeStage', 'dealStatus', 'source', 'leadStatus', 'priority', 'status',
    'note', 'assignedTo', 'upcomingFollowUp', 'department', 'productName',  'alternateContact',  'leadCategory',


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
  mobile: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
  alternateContact: ['', [Validators.pattern(/^[0-9]{10}$/)]],
  landline: ['', [Validators.pattern(/^[0-9]{10}$/)]],
  email: ['', [Validators.email]], // Made email mandatory
  department: [''],
  leadStatus: [''],
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
  
// Update the applyFilters method

  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePagination();
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
  const updateData: any = { 
    department, 
    // Explicitly preserve other fields
    alternateContact: this.selectedLeadForDepartment?.alternateContact || '' 
  };

  // If a user is selected, include assignment info
  if (this.selectedUserId) {
    const selectedUser = this.usersList.find(u => u.id === this.selectedUserId);
    if (selectedUser) {
      updateData.assignedTo = selectedUser.name;
      updateData.assignedToId = selectedUser.id;
    }
  }

  try {
    if (this.selectedLeadForDepartment) {
      // Update single lead
      await this.leadService.updateLead(this.selectedLeadForDepartment.id, updateData);
      // Update local data
      const lead = this.allLeads.find(l => l.id === this.selectedLeadForDepartment.id);
      if (lead) {
        Object.assign(lead, updateData);
      }
    } else {
      // Bulk update selected leads
      const updatePromises = Array.from(this.selectedLeads).map(leadId => {
        const lead = this.allLeads.find(l => l.id === leadId);
        return this.leadService.updateLead(leadId, {
          ...updateData,
          alternateContact: lead?.alternateContact || '' // Preserve alternate contact
        });
      });
      await Promise.all(updatePromises);
      
      // Update local data
      this.allLeads.forEach(lead => {
        if (this.selectedLeads.has(lead.id)) {
          lead.department = department;
          if (this.selectedUserId) {
            const selectedUser = this.usersList.find(u => u.id === this.selectedUserId);
            if (selectedUser) {
              lead.assignedTo = selectedUser.name;
              lead.assignedToId = selectedUser.id;
            }
          }
        }
      });
    }

    this.closeDepartmentPopup();
    this.applyFilters();
    
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
 toggleProductSelection(product: any) {
    const index = this.selectedProducts.findIndex(p => p === product || p.id === product.id);
    
    if (index >= 0) {
      this.selectedProducts.splice(index, 1);
    } else {
      this.selectedProducts.push(product);
    }
    
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
applySourceFilter(source: string, event?: Event): void {
  if (event) event.stopPropagation();
  this.filters.source = source;
  this.activeDropdown = '';
  this.applyFilters();
}
  
// Initialize the assign form
private initAssignForm(): void {
  this.assignForm = this.fb.group({
    assignedTo: ['', Validators.required],
    lifeStage: ['', Validators.required]
  });
}


applyLifeStageFilter(lifeStage: string, event?: Event): void {
  if (event) event.stopPropagation();
  this.filters.lifeStage = lifeStage;
  this.activeDropdown = '';
  this.applyFilters();
}
toggleDropdown(dropdownName: string, event?: Event): void {
  if (event) event.stopPropagation();
  
  this.activeDropdown = this.activeDropdown === dropdownName ? '' : dropdownName;
}
applyLeadStatusFilter(leadStatus: string, event?: Event): void {
  if (event) event.stopPropagation();
  this.filters.leadStatus = leadStatus;
  this.activeDropdown = '';
  this.applyFilters();
}

@HostListener('document:click', ['$event'])
onDocumentClick(event: MouseEvent) {
  if (!this.elementRef.nativeElement.contains(event.target)) {
    this.activeDropdown = '';
  }
}

  

applyAssignedToFilter(assignedTo: string, event?: Event): void {
  if (event) event.stopPropagation();
  this.filters.assignedTo = assignedTo;
  this.activeDropdown = '';
  this.applyFilters();
}

applyDealStatusFilter(dealStatus: string, event?: Event): void {
  if (event) event.stopPropagation();
  this.filters.dealStatus = dealStatus;
  this.activeDropdown = '';
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
applyPriorityFilter(priority: string, event?: Event): void {
  if (event) event.stopPropagation();
  this.filters.priority = priority;
  this.activeDropdown = '';
  this.applyFilters();
}

applyDepartmentFilter(department: string, event?: Event): void {
  if (event) {
    event.stopPropagation(); // Prevent event bubbling
    this.activeDropdown = ''; // Close the dropdown
  }

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
async assignSelectedLeads() {
  if (this.selectedLeads.size === 0) {
    alert('Please select leads to assign');
    return;
  }

  try {
    // Get all selected leads
    const leadsToUpdate = this.allLeads.filter(lead => this.selectedLeads.has(lead.id));
    
    if (this.randomAssignMode) {
      // Random assignment logic
      const availableUsers = [...this.availableUsers];
      const assignments: {[userId: string]: number} = {}; // Track assignments per user
      
      // Initialize assignment counts
      availableUsers.forEach(user => {
        assignments[user.id] = 0;
      });

      // Assign leads randomly but evenly
      const shuffledLeads = [...leadsToUpdate].sort(() => 0.5 - Math.random());
      
      for (const lead of shuffledLeads) {
        // Find user with least assignments who hasn't been assigned this lead before
        let selectedUser = null;
        let minAssignments = Infinity;
        
        // Shuffle users to randomize selection among those with same min assignments
        const shuffledUsers = [...availableUsers].sort(() => 0.5 - Math.random());
        
        for (const user of shuffledUsers) {
          // Check if this user has the least assignments and hasn't been assigned this lead before
          if (assignments[user.id] < minAssignments) {
            selectedUser = user;
            minAssignments = assignments[user.id];
          }
        }
        
        if (selectedUser) {
          // Prepare update data
          const updateData = {
            assignedTo: selectedUser.name,
            assignedToId: selectedUser.id,
            department: selectedUser.department,
            updatedAt: new Date()
          };

          // Update the lead
          await this.leadService.updateLead(lead.id, updateData);
          
          // Update local data
          Object.assign(lead, updateData);
          
          // Increment assignment count
          assignments[selectedUser.id]++;
        }
      }
    } else {
      // Manual assignment to a single user
      if (!this.selectedUserId) {
        alert('Please select a user to assign leads to');
        return;
      }
      
      const selectedUser = this.availableUsers.find(u => u.id === this.selectedUserId);
      if (!selectedUser) {
        alert('Selected user not found');
        return;
      }

      // Prepare update data for all selected leads
      const updateData: {
        assignedTo: any;
        assignedToId: any;
        department: any;
        updatedAt: Date;
        lifeStage?: string;
      } = {
        assignedTo: selectedUser.name,
        assignedToId: selectedUser.id,
        department: selectedUser.department,
        updatedAt: new Date()
      };

      // Include life stage if selected
      if (this.selectedLifeStage) {
        updateData.lifeStage = this.selectedLifeStage;
      }

      // Update all selected leads
      const updatePromises = leadsToUpdate.map(lead => 
        this.leadService.updateLead(lead.id, updateData)
      );
      
      await Promise.all(updatePromises);
      
      // Update local data
      leadsToUpdate.forEach(lead => {
        Object.assign(lead, updateData);
      });
    }

    // Show success message
    this.validationMessage = {
      text: 'Leads assigned successfully',
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
  searchProducts(query: string): void {
    if (!query || query.length < 2) {
      this.searchResults = [];
      this.showSearchDropdown = false;
      return;
    }

    this.searchSubscription = this.productsService.getProductsRealTime().subscribe({
      next: (products) => {
        this.searchResults = products.filter(product => 
          product.productName.toLowerCase().includes(query.toLowerCase())
        );
        this.showSearchDropdown = this.searchResults.length > 0;
      },
      error: (err) => {
        console.error('Error searching products:', err);
        this.searchResults = [];
        this.showSearchDropdown = false;
      }
    });
  }

// Method to update life stages
// Method to update life stages
async updateSelectedLifeStages(): Promise<void> {
  if (!this.selectedLifeStage || this.selectedLeadsForLifeStage.length === 0) {
    alert('Please select a life stage');
    return;
  }

  try {
    const updatePromises = this.selectedLeadsForLifeStage.map(lead => {
      // Create update data that preserves all existing fields
      const updateData = {
        lifeStage: this.selectedLifeStage,
        // Explicitly preserve other important fields
        alternateContact: lead.alternateContact || '',
        mobile: lead.mobile || '',
        firstName: lead.firstName || '',
        lastName: lead.lastName || '',
        businessName: lead.businessName || '',
        email: lead.email || '',
        // Add any other fields you want to preserve
        updatedAt: new Date()
      };
      
      return this.leadService.updateLead(lead.id, updateData);
    });
    
    await Promise.all(updatePromises);
    
    // Update local data
    this.selectedLeadsForLifeStage.forEach(lead => {
      const foundLead = this.allLeads.find(l => l.id === lead.id);
      if (foundLead) {
        foundLead.lifeStage = this.selectedLifeStage;
        // Ensure other fields are preserved in local data
        foundLead.alternateContact = lead.alternateContact || '';
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
    addedBy: '',
    fromDate: '',
    toDate: '',
    orderStatus: '',
    adCode: '',
      dateOption: '' // Add this new property

  };
  this.applyFilters();
}
// In your component class
showAdvancedFilters = false;
// In your component class

// Enhanced filters object
// In your component.ts file, update your filters definition
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
  orderStatus: '' as '' | 'Reordered' | 'No Reordered',
  adCode: '',
  dateOption: '' // Add this new property
};
get showBulkActions(): boolean {
  return this.currentUserRole !== 'Executive';
}
ngOnInit(): void {
  this.loadLeads();
  const currentUser = this.authService.currentUserValue;
  this.currentUserRole = currentUser?.role || '';
  this.currentUserDepartment = currentUser?.department || '';

  this.loadSources();
  this.initializeProducts();
  this.initDepartmentForm();
this.loadProducts();
this.filteredProductsForInterested = [...this.productsList];
  this.loadLifeStages();
  this.loadLeadStatuses();
  this.loadUsers();
  this.loadFollowupCategories();
  this.loadRecentLeads();
  this.loadConvertedCustomer();
     this.searchSubscription = this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(query => {
      this.searchProducts(query);
    });

  this.leadForm.get('isIndividual')?.valueChanges.subscribe(value => {
    this.isIndividualType = value;
    this.updateValidators();
  });

  
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
applyOrderStatusFilter(status: '' | 'Reordered' | 'No Reordered', event?: Event): void {
  if (event) event.stopPropagation();
  this.filters.orderStatus = status;
  this.activeDropdown = '';
  this.applyFilters();
}

private initializeProducts(): void {
  // Your initialization logic here
  this.filteredProducts = [...this.productsList];
}
 isProductSelected(product: any): boolean {
    return this.selectedProducts.some(p => p === product || p.id === product.id);
  }
  
  
  
  updateDistrictsByState(state: string) {
    if (state && state in this.districtsByState) {
      this.availableDistricts = this.districtsByState[state];
      this.leadForm.get('city')?.setValue('');
    } else {
      this.availableDistricts = [];
    }
  }
applyAdCodeFilter(adCode: string, event?: Event): void {
  if (event) event.stopPropagation();
  this.filters.adCode = adCode;
  this.activeDropdown = '';
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
 this.searchQuery = product.productName || product.name || '';
  this.showSearchDropdown = false;
    // You can add additional logic here for what happens when a product is selected
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
// Helper method to get common department among selected leads
private getCommonDepartment(leads: any[]): string | null {
  if (leads.length === 0) return null;
  
  const firstDept = leads[0].department;
  if (leads.every(lead => lead.department === firstDept)) {
    return firstDept;
  }
  return null;
  }
  
async openAssignModal(randomMode: boolean): Promise<void> {
  this.randomAssignMode = randomMode;
  const currentUserRole = this.authService.currentUserValue?.role || '';
  const currentUserDepartment = this.authService.currentUserValue?.department || '';

  try {
    // For random assignment, only show users from PC1-PC8 departments
    this.availableUsers = this.usersList.filter(user => 
      user.role === 'Executive' && 
      user.department && 
      user.department.match(/^PC[1-8]$/i) // Matches PC1 through PC8
    );

    // If current user is supervisor, filter to their department only
    if (currentUserRole === 'Supervisor' && currentUserDepartment) {
      this.availableUsers = this.availableUsers.filter(user => 
        user.department === currentUserDepartment
      );
    }

    // For random assignment, shuffle the users and select 3
    if (randomMode && this.availableUsers.length > 0) {
      const shuffledUsers = [...this.availableUsers]
        .sort(() => 0.5 - Math.random())
        .slice(0, 3);
      this.availableUsers = shuffledUsers;
      this.selectedUserId = shuffledUsers[0]?.id || '';
    }
  } catch (error) {
    console.error('Error getting users:', error);
    return;
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
    categories: [selectedCategories || [], Validators.required]
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
    this.applyFilters();
  });
}

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
  this.filters.fromDate = '';
  this.filters.toDate = '';
  this.filters.dateOption = '';
  this.applyFilters();
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
      // Reset district when state changes
      this.leadForm.get('city')?.setValue('');
    } else {
      this.availableDistricts = [];
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

async saveCategories(): Promise<void> {
  if (this.categoryForm.valid && this.selectedLeadForCategory) {
    const categories = this.categoryForm.get('categories')?.value || [];

    try {
      // Use type assertion to bypass the type check
      await this.leadService.updateLead(
        this.selectedLeadForCategory.id,
        { categories } as Partial<Lead>
      );

      // Update local state
      const lead = this.allLeads.find(l => l.id === this.selectedLeadForCategory.id);
      if (lead) {
        (lead as any).categories = categories; // Type assertion here too
      }

      this.closeCategoryPopup();
    } catch (error) {
      console.error('Error saving categories:', error);
    }
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
onUserSelectionChange(event: Event): void {
  const selectElement = event.target as HTMLSelectElement;
  const userId = selectElement.value;
  
  if (!userId) {
    this.selectedUserDepartment = '';
    return;
  }
  
  const selectedUser = this.usersList.find(user => user.id === userId);
  if (selectedUser) {
    this.selectedUserDepartment = selectedUser.department;
  }
}
  loadFollowupCategories(): void {
    this.followupCategoryService.getFollowupCategories()
      .then((categories) => {
        this.followupCategories = categories;
      })
      .catch((error) => {
        console.error('Error loading followup categories:', error);
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
      // 1. Convert lead to customer (including all demographic data)
      const customerData = await this.leadService.convertLeadToCustomer({
        ...lead,
        assignedTo: lead.assignedTo,
        assignedToId: lead.assignedToId,
        // Ensure all demographic fields are included
        age: lead.age,
        dob: lead.dateOfBirth,
        gender: lead.gender,
        prefix: lead.prefix,
        middleName: lead.middleName
      });
      
      // 2. Delete the lead after successful conversion
      await this.leadService.deleteLead(lead.id);

      // 3. Prepare data for sales order with ALL customer details
      localStorage.setItem('convertedLeadForSale', JSON.stringify({
        customerData: {
          ...customerData,
          displayName: lead.businessName || `${lead.firstName} ${lead.lastName}`.trim(),
          assignedTo: lead.assignedTo,
          assignedToId: lead.assignedToId,
          // Include all demographic fields
          age: lead.age,
          dob: lead.dateOfBirth,
          gender: lead.gender
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

// Update the prepareForSalesOrder method
async prepareForSalesOrder(lead: any) {
  try {
    // 1. Delete the lead first
    await this.leadService.deleteLead(lead.id);
    
    // 2. Get customer data (since mobile exists)
    const customerData = await this.customerService.getCustomerByMobile(lead.mobile);
    
    // 3. Prepare complete data for sales order
    const saleData = {
      customerData: {
        ...customerData,
        displayName: lead.businessName || `${lead.firstName} ${lead.lastName}`.trim(),
        // Include all demographic fields
        age: customerData.age || lead.age,
        dob: customerData.dob || lead.dateOfBirth,
        gender: customerData.gender || lead.gender,
        assignedTo: lead.assignedTo,
        assignedToId: lead.assignedToId
      },
      isExistingCustomer: true,
      leadId: lead.id
    };

    // 4. Navigate with state and query params
    this.router.navigate(['/add-sale'], {
      state: { 
        fromLead: true,
        leadData: saleData 
      },
      queryParams: { 
        customerId: customerData.id,
        fromLead: true 
      }
    });
    
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
  const queryParams: any = {
    id: lead.id,
    contactType: lead.contactType || 'Lead',
    isIndividual: !lead.businessName,
    prefix: lead.prefix || '',
    firstName: lead.firstName || '',
    middleName: lead.middleName || '',
    lastName: lead.lastName || '',
    gender: lead.gender || '',
    dateOfBirth: lead.dateOfBirth || '',
    age: lead.age || '',
    businessName: lead.businessName || '',
    mobile: lead.mobile || '',
    alternateContact: lead.alternateContact || '',
    landline: lead.landline || '',
    email: lead.email || '',
    department: lead.department || '',
    leadStatus: lead.leadStatus || '',
    leadCategory: lead.leadCategory || '',
    leadStatusNote: lead.leadStatusNote || '',
    dealStatus: lead.dealStatus || '',
    priority: lead.priority || '',
    estimatedValue: lead.estimatedValue || '',
    source: lead.source || '',
    lifeStage: lead.lifeStage || '',
    // Use assignedToId if available, otherwise fall back to assignedTo
    assignedTo: lead.assignedToId || lead.assignedTo || '',
    notes: lead.notes || '',
    addressLine1: lead.addressLine1 || '',
    addressLine2: lead.addressLine2 || '',
    city: lead.city || '',
    state: lead.state || '',
    country: lead.country || 'India',
    zipCode: lead.zipCode || ''
  };

  if (lead.productInterested) {
    queryParams.productInterested = JSON.stringify(lead.productInterested);
  }

  // Navigate to the lead-add component with all parameters
  this.router.navigate(['/crm/lead-add'], { queryParams });
}
async validateMobileNumber() {
  const mobileControl = this.leadForm.get('mobile');
  const mobile = mobileControl?.value;
  
  // Reset validation messages
  this.mobileValidationMessage = '';
  this.mobileExists = false;
  this.existingCustomer = null;

  if (!mobile || mobile.length !== 10) {
    return;
  }

  try {
    const { exists, customer } = await this.leadService.checkMobileExists(mobile);
    this.mobileExists = exists;
    this.existingCustomer = customer || null;
    
    if (exists) {
this.validationMessage = {
  text: 'Note: This mobile number belongs to an existing customer (will be marked as Reordered)',
  type: 'success'
};
      this.prefillFromExistingCustomer(customer);
    }
  } catch (error) {
    console.error('Error validating mobile:', error);
  }
}
prefillFromExistingCustomer(customer: any) {
    this.leadForm.patchValue({
      firstName: customer.firstName || '',
      lastName: customer.lastName || '',
      email: customer.email || '',
      addressLine1: customer.addressLine1 || '',
      addressLine2: customer.addressLine2 || '',
      city: customer.city || '',
      state: customer.state || '',
      country: customer.country || 'India',
      zipCode: customer.zipCode || '',
      landline: customer.landline || '',
      alternateContact: customer.alternateContact || ''
    });
    if (customer.state) {
      this.onStateChange();
      this.leadForm.get('city')?.setValue(customer.city || '');
    }
  }
viewLead(lead: any) {
  this.router.navigate(['/lead', lead.id]);
}

  
validateAlternateContact() {
  const alternateControl = this.leadForm.get('alternateContact');
  if (alternateControl?.value && alternateControl?.errors?.['pattern']) {
    this.alternateContactValidationMessage = 'Alternate contact must be exactly 10 digits';
  } else {
    this.alternateContactValidationMessage = '';
  }
}

validateLandline() {
  const landlineControl = this.leadForm.get('landline');
  if (landlineControl?.value && landlineControl?.errors?.['pattern']) {
    this.landlineValidationMessage = 'Landline must be exactly 10 digits';
  } else {
    this.landlineValidationMessage = '';
  }
}


async saveLead() {
  this.leadForm.markAllAsTouched();

  if (this.leadForm.invalid) {
    const invalidFields = [];
    for (const controlName in this.leadForm.controls) {
      const control = this.leadForm.get(controlName);
      if (control?.invalid) {
        invalidFields.push(controlName);
      }
    }
  for (const controlName in this.leadForm.controls) {
    if (controlName !== 'dateOfBirth' && controlName !== 'gender') {
      this.leadForm.get(controlName)?.markAsTouched();
    }
      const invalidFields = [];
  for (const controlName in this.leadForm.controls) {
    const control = this.leadForm.get(controlName);
    if (control?.invalid && controlName !== 'dateOfBirth' && controlName !== 'gender') {
      invalidFields.push(controlName);
    }
  }

    }
    
   this.validationMessage = {
      text: `Please fill all required fields correctly. Missing: ${invalidFields.join(', ')}`,
      type: 'error'
    };
    return;
  }

  const formData = this.leadForm.value;
  const mobile = formData.mobile;

  // Validate mobile number format
  if (!/^[0-9]{10}$/.test(mobile)) {
    this.validationMessage = {
      text: 'Mobile number must be exactly 10 digits',
      type: 'error'
    };
    return;
  }

  try {
    // Check for duplicate mobile in leads
    const duplicateLeads = this.allLeads.filter(l => 
      l.mobile === mobile && 
      (!this.editingLeadId || l.id !== this.editingLeadId)
    );

    if (duplicateLeads.length > 0 && !confirm('This mobile number already exists in another lead. Are you sure you want to continue?')) {
      return;
    }

    // Check if mobile exists in customers
    const mobileExists = await this.customerService.checkMobileNumberExists(mobile);
    this.mobileExists = mobileExists;

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
          leadCategory: formData.leadCategory, // Single category from form

      productInterested: this.selectedProducts.length > 0 ? this.selectedProducts : null,
      addedBy: {
        userId: this.authService.getCurrentUserId(),
        userName: formData.addedBy || this.authService.getCurrentUserName()
      },
      isDuplicate: duplicateLeads.length > 0,
      mobileExists: mobileExists
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
      this.validationMessage = {
        text: 'Lead updated successfully',
        type: 'success'
      };
    } else {
      // Create new lead
      leadData.createdAt = new Date();
      leadData.contactId = this.generateContactId();
      
      await this.leadService.addLead(leadData, {
        userId: this.authService.getCurrentUserId(),
        userName: this.authService.getCurrentUserName()
      });

      // Show appropriate success message
      if (duplicateLeads.length > 0) {
        this.validationMessage = {
          text: 'Duplicate lead added successfully',
          type: 'success'
        };
      } else if (mobileExists) {
        this.validationMessage = {
          text: 'Reordered lead added successfully',
          type: 'success'
        };
      } else {
        this.validationMessage = {
          text: 'Lead added successfully',
          type: 'success'
        };
      }
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
  onDepartmentSelect(event: Event): void {
  const selectElement = event.target as HTMLSelectElement;
  const department = selectElement.value;
  
  if (department) {
    this.filterUsersByDepartment(department);
  } else {
    this.filteredUsers = [];
  }
  }
private filterUsersByDepartment(department: string): void {
  // Only allow filtering by PC departments
  if (!this.PC_DEPARTMENTS.includes(department)) {
    this.filteredUsers = [];
    return;
  }

  this.filteredUsers = this.usersList.filter(user => 
    user.department === department && 
    user.role === 'Executive'
  );
  
  if (this.filteredUsers.length === 1) {
    this.selectedUserId = this.filteredUsers[0].id;
  } else {
    this.selectedUserId = '';
  }
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


// Enhanced applyFilters method
applyFilters(): void {
  if (this.filterDebounceTimer) {
    clearTimeout(this.filterDebounceTimer);
  }

  this.filterDebounceTimer = setTimeout(() => {
    let filtered = [...this.allLeads];
    
    // Apply each filter if it has a value
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
        (lead.priority?.toLowerCase().includes(term)) ||
        (lead.contactId?.toLowerCase().includes(term)) ||
        (lead.notes?.toLowerCase().includes(term))
      );
    }

    if (this.filters.source) {
      filtered = filtered.filter(lead => lead.source === this.filters.source);
    }

    if (this.filters.lifeStage) {
      filtered = filtered.filter(lead => lead.lifeStage === this.filters.lifeStage);
    }

    if (this.filters.leadStatus) {
      filtered = filtered.filter(lead => lead.leadStatus === this.filters.leadStatus);
    }

    if (this.filters.assignedTo) {
      filtered = filtered.filter(lead => lead.assignedTo === this.filters.assignedTo);
    }

    if (this.filters.dealStatus) {
      filtered = filtered.filter(lead => lead.dealStatus === this.filters.dealStatus);
    }

    if (this.filters.priority) {
      filtered = filtered.filter(lead => lead.priority === this.filters.priority);
    }

    if (this.filters.department) {
      filtered = filtered.filter(lead => lead.department === this.filters.department);
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

    if (this.filters.adCode) {
      filtered = filtered.filter(lead => 
        lead.leadStatus?.toLowerCase().includes(this.filters.adCode.toLowerCase())
      );
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
    this.updatePagination();
  }, 300); // 300ms debounce time
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
 exportExcel(): void {
  try {
    // Prepare data for Excel
    const excelData = this.allLeads.map(lead => ({
      'Contact ID': lead.contactId || '',
      'Name': lead.businessName || `${lead.firstName || ''} ${lead.lastName || ''}`.trim(),
      'Mobile': lead.mobile || '',
      'Email': lead.email || '',
      'Life Stage': lead.lifeStage || '',
      'Deal Status': lead.dealStatus || '',
      'Status': lead.leadStatus || '',
      'Priority': lead.priority || '',
      'Assigned To': lead.assignedTo || '',
      'Created Date': lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : '',
      'Upcoming Follow Up': lead.upcomingFollowUp ? new Date(lead.upcomingFollowUp).toLocaleString() : '',
      'Notes': lead.notes || ''
    }));

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    
    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads');
    
    // Generate file name with current date
    const fileName = `leads_export_${new Date().toISOString().slice(0,10)}.xlsx`;
    
    // Export to Excel
    XLSX.writeFile(workbook, fileName);
  } catch (error) {
    console.error('Error exporting Excel:', error);
    alert('Error exporting Excel. Please try again.');
  }
}
 // Print Functionality
 printTable(): void {
  try {
    // Create a printable version of the table
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Popup was blocked. Please allow popups for this site to print.');
      return;
    }

    // Get the table HTML
    const tableHtml = document.querySelector('.customer-table')?.outerHTML;
    
    // Create the print content
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Leads Report</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #333; text-align: center; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          .no-data { text-align: center; padding: 20px; }
          @media print {
            @page { size: landscape; margin: 10mm; }
            body { margin: 0; }
          }
        </style>
      </head>
      <body>
        <h1>Leads Report - ${new Date().toLocaleDateString()}</h1>
        ${tableHtml || '<p>No data available to print</p>'}
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
              window.close();
            }, 200);
          }
        </script>
      </body>
      </html>
    `;

    // Write the content and print
    printWindow.document.open();
    printWindow.document.write(printContent);
    printWindow.document.close();
  } catch (error) {
    console.error('Error printing:', error);
    alert('Error printing table. Please try again.');
  }
}
  
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
preventBlur(event: MouseEvent) {
    event.preventDefault();
    this.isDropdownOpen = true; // Changed from keepDropdownOpen to isDropdownOpen
  }

  
// Add this method for blur handling
onSearchBlur() {
  if (this.blurTimeout) {
    clearTimeout(this.blurTimeout);
  }
  this.blurTimeout = setTimeout(() => {
    this.showSearchDropdown = false;
  }, 200);
}


toggleForm() {
  this.showForm = !this.showForm;
  if (!this.showForm) {
    this.editingLeadId = null;
    this.leadForm.reset({
      contactType: 'Lead',
      isIndividual: true,
      status: 'New',
      source: this.sources.length > 0 ? this.sources[0].name : '',
      lifeStage: this.lifeStages.length > 0 ? this.lifeStages[0].name : '',
      assignedTo: '',
      addedBy: this.authService.getCurrentUserName() // Use authService directly

    });
    this.availableDistricts = []; // Reset available districts
  }
}


onSearchFocus() {
  if (this.searchQuery && this.searchQuery.length >= 2) {
    this.showSearchDropdown = true;
  }
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
removeSelectedProduct(product: any): void {
  this.selectedProducts = this.selectedProducts.filter(p => 
    p.id !== product.id && 
    p.productName !== product.productName &&
    p.name !== product.name
  );
  event?.stopPropagation();
}
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
          dateOption: '',

      toDate: '',
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