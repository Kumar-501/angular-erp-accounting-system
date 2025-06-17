import { Component, Inject, OnInit } from '@angular/core';
import { CustomerService } from '../services/customer.service';
import { SupplierService } from '../services/supplier.service';
import { UserService } from '../services/user.service';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { LifeStageService } from '../services/life-stage.service'; // Add this import
import { LeadStatusService } from '../services/lead-status.service';
import { ActivatedRoute } from '@angular/router';


interface Customer {
  id?: string;
  contactId?: string;
  businessName?: string;
  firstName?: string;
  lastName?: string;
  isIndividual?: boolean;
    department?: string;
  gender?: 'Male' | 'Female' | 'Other' | ''; // Add this
  age?: number; // Add this
  email?: string;
  mobile?: string;
  landline?: string;
  alternateContact?: string;
  assignedTo?: string;
  taxNumber?: string;
  openingBalance?: number;
  saleDue?: number;
  saleReturn?: number;
  advanceBalance?: number;
  status?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
  prefix?: string;
  middleName?: string;
  dob?: Date;
  payTerm?: number;
  contactType?: string;
  billingAddress?: string;
  shippingAddress?: string;
  createdAt?: Date;
  updatedAt?: Date;
  lifestage?: string; // Add this
  adcode?: string;    // Add this
}
@Component({
  selector: 'app-customers',
  templateUrl: './customers.component.html',
  styleUrls: ['./customers.component.scss']
})
export class CustomersComponent implements OnInit {
  showForm = false;
  showMoreInfo = false;
  isIndividual = true;
  customerData: Partial<Customer> = {};
  lifestage?: string;
  adcode?: string;
  selectedCustomers: string[] = []; // Array to store selected customer IDs
allSelected = false; 
  gender?: 'Male' | 'Female' | 'Other' | '';
  age?: number;
  // Add these properties
adCodes: any[] = [];
leadStatuses: any[] = [];
lifeStages: any[] = [];
  customersList: Customer[] = [];
  filteredCustomers: Customer[] = [];
  editingCustomerId: string | null = null;
  assignedUsers: {id: string, username: string}[] = [];
  showFilterSidebar = false;

  // Add these properties to your component class
showColumnVisibilityMenu = false;
allColumns = [
  { name: 'Action', displayName: 'Action', visible: true },
  { name: 'Contact ID', displayName: 'Contact ID', visible: true },
  { name: 'Prefix', displayName: 'Prefix', visible: true },
  { name: 'First Name', displayName: 'First Name', visible: true },
  { name: 'Middle Name', displayName: 'Middle Name', visible: true },
  { name: 'Last Name', displayName: 'Last Name', visible: true },
  { name: 'Business Name', displayName: 'Business Name', visible: true },
  { name: 'Life Stage', displayName: 'Life Stage', visible: true },
  { name: 'Ad Code', displayName: 'Ad Code', visible: true },
  { name: 'Email', displayName: 'Email', visible: true },
  { name: 'Mobile', displayName: 'Mobile', visible: true },
  { name: 'Landline', displayName: 'Landline', visible: true },
  { name: 'Alternate Contact', displayName: 'Alternate Contact', visible: true },
  { name: 'Date of Birth', displayName: 'Date of Birth', visible: true },
  { name: 'Address Line 1', displayName: 'Address Line 1', visible: true },
  { name: 'Address Line 2', displayName: 'Address Line 2', visible: true },
  { name: 'City', displayName: 'City', visible: true },
  { name: 'State', displayName: 'State', visible: true },
  { name: 'Country', displayName: 'Country', visible: true },
  { name: 'Zip Code', displayName: 'Zip Code', visible: true },
  { name: 'Tax Number', displayName: 'Tax Number', visible: true },
  { name: 'Pay Term', displayName: 'Pay Term', visible: true },
  { name: 'Opening Balance', displayName: 'Opening Balance', visible: true },
  { name: 'Assigned To', displayName: 'Assigned To', visible: true },
  { name: 'Contact Type', displayName: 'Contact Type', visible: true },
  { name: 'Department', displayName: 'Department', visible: true },
      { name: 'Gender', displayName: 'Gender', visible: true },
  { name: 'Age', displayName: 'Age', visible: true },

];

  // Phone validation errors
  phoneErrors: {
    mobile: string;
    landline: string;
    alternateContact: string;
  } = {
    mobile: '',
    landline: '',
    alternateContact: ''
  };
  
  // Filter options - add state property
  filterOptions = {
    saleDue: false,
    saleReturn: false,
    advanceBalance: false,
    openingBalance: false,
    assignedTo: '',
    status: '',
    state: '',
      department: '',

    lifestage: '',      // new
    adcode: ''    
  };
  assignForm: any;

  cleanPhoneNumber(phone: string): string {
    // Remove all non-digit characters
    return phone.replace(/\D/g, '');
  }
  entriesPerPage = 25;
  currentPage = 1;
  totalPages = 1;
  sortColumn = 'businessName';
  sortDirection = 'asc';
  searchTerm = '';
  states: string[] = ['Tamil Nadu', 'Kerala', 'Karnataka', 'Andhra Pradesh', 'Maharashtra'];


  constructor(
    private customerService: CustomerService,
    @Inject(SupplierService) private supplierService: SupplierService, // Explicit injection
    private userService: UserService,
    private leadStatusService: LeadStatusService, // Add this
    private lifeStageService: LifeStageService    // Add this
  ) { }

  ngOnInit(): void {
    this.loadCustomers();
    this.loadLeadStatuses();  // Add this
    this.loadLifeStages();    // Add this
    this.loadAssignedUsers();
    this.loadLifeStages(); // Add this line

    const savedColumns = localStorage.getItem('customerColumnsVisibility');
  if (savedColumns) {
    this.allColumns = JSON.parse(savedColumns);
  }
  }
  // Add these methods to your component class
toggleSelectAll(): void {
  this.allSelected = !this.allSelected;
  if (this.allSelected) {
    this.selectedCustomers = this.paginatedCustomers.map(c => c.id || '');
  } else {
    this.selectedCustomers = [];
  }
}
toggleCustomerSelection(customerId: string): void {
  const index = this.selectedCustomers.indexOf(customerId);
  if (index === -1) {
    this.selectedCustomers.push(customerId);
  } else {
    this.selectedCustomers.splice(index, 1);
  }
  // Update "select all" checkbox state
  this.allSelected = this.selectedCustomers.length === this.paginatedCustomers.length;
}

isCustomerSelected(customerId: string): boolean {
  return this.selectedCustomers.includes(customerId);
}
async deleteSelectedCustomers(): Promise<void> {
  if (this.selectedCustomers.length === 0) {
    alert('Please select at least one customer to delete');
    return;
  }

  if (confirm(`Are you sure you want to delete ${this.selectedCustomers.length} selected customers?`)) {
    try {
      await this.customerService.bulkDeleteCustomers(this.selectedCustomers);
      
      // Refresh the customer list
      this.loadCustomers();
      
      // Reset selection
      this.selectedCustomers = [];
      this.allSelected = false;
      
      alert(`${this.selectedCustomers.length} customers deleted successfully!`);
    } catch (error) {
      console.error('Error deleting customers:', error);
      alert('Error deleting customers. Please try again.');
    }
  }
}
  getAdCodeName(adcodeId: string | undefined): string {
    if (!adcodeId) return '';
    const status = this.leadStatuses.find(s => s.id === adcodeId);
    return status ? `${status.leadStatus} (${status.id})` : '';
  }
  toggleFilterSidebar(): void {
    this.showFilterSidebar = !this.showFilterSidebar;
  }
  
  
// Add these new methods
loadLeadStatuses(): void {
  this.leadStatusService.getLeadStatuses().subscribe(
    (statuses) => {
      this.leadStatuses = statuses;
      // Set default adcode if none is selected
      if (statuses.length > 0 && !this.customerData.adcode) {
        const defaultStatus = statuses.find(s => s.isDefault);
        if (defaultStatus) {
          this.customerData.adcode = defaultStatus.id;
        }
      }
    },
    (error) => {
      console.error('Error loading lead statuses:', error);
    }
  );
}


loadLifeStages(): void {
  this.lifeStageService.getLifeStages().then(stages => {
    this.lifeStages = stages;
    // Set default lifestage if none is selected
    if (stages.length > 0 && !this.customerData.lifestage) {
      this.customerData.lifestage = stages[0].name;
    }
  }).catch(error => {
    console.error('Error loading life stages:', error);
  });
}



  loadCustomers(): void {
    this.customerService.getCustomers().subscribe((customers: Customer[]) => {
      this.customersList = customers;
      this.applyFilters();
    });
  }

  loadAssignedUsers(): void {
    this.userService.getUsers().subscribe(users => {
      this.assignedUsers = users.map(user => ({
        id: user.id,
        username: user.username || user.displayName || user.email.split('@')[0]
      }));
    });
  }
  // Add these methods to your component class
toggleColumnVisibilityMenu(): void {
  this.showColumnVisibilityMenu = !this.showColumnVisibilityMenu;
}

isColumnVisible(columnName: string): boolean {
  const column = this.allColumns.find(c => c.displayName === columnName);
  return column ? column.visible : true;
}

updateVisibleColumns(): void {
  // Save column visibility preferences to localStorage
  localStorage.setItem('customerColumnsVisibility', JSON.stringify(this.allColumns));
}
get visibleColumns(): any[] {
  return this.allColumns.filter(column => column.visible);
}

applyFilters(): void {
  let filtered = [...this.customersList];
  
  // Existing search term filter
  if (this.searchTerm) {
    const term = this.searchTerm.toLowerCase().trim();
    filtered = filtered.filter(customer => {
      return Object.keys(customer).some(key => {
        const value = customer[key as keyof Customer];
        if (value === null || value === undefined) return false;
        
        if (typeof value === 'string') {
          return value.toLowerCase().includes(term);
        } else if (typeof value === 'number') {
          return value.toString().includes(term);
        } else if (value instanceof Date) {
          return value.toISOString().toLowerCase().includes(term);
        }
        return false;
      }) || this.searchInCombinedFields(customer, term);
    });
  }
  
  // Status filter
  if (this.filterOptions.status) {
    filtered = filtered.filter(customer => customer.status === this.filterOptions.status);
  }
  if (this.filterOptions.department) {
  filtered = filtered.filter(customer => customer.department === this.filterOptions.department);
}
  // Assigned To filter
  if (this.filterOptions.assignedTo) {
    filtered = filtered.filter(customer => customer.assignedTo === this.filterOptions.assignedTo);
  }
  
  // State filter
  if (this.filterOptions.state) {
    filtered = filtered.filter(customer => customer.state === this.filterOptions.state);
  }

  // Ad Code filter
  if (this.filterOptions.adcode) {
    filtered = filtered.filter(customer => customer.adcode === this.filterOptions.adcode);
  }

  // Life Stage filter
  if (this.filterOptions.lifestage) {
    filtered = filtered.filter(customer => customer.lifestage === this.filterOptions.lifestage);
  }
  
  // Sort the filtered list
  filtered.sort((a, b) => {
    const valA = this.getSortValue(a, this.sortColumn);
    const valB = this.getSortValue(b, this.sortColumn);
    
    if (valA < valB) return this.sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return this.sortDirection === 'asc' ? 1 : -1;
    return 0;
  });
  
  this.filteredCustomers = filtered;
  this.totalPages = Math.ceil(this.filteredCustomers.length / this.entriesPerPage);
  this.currentPage = Math.min(this.currentPage, this.totalPages);
}




  // Helper method to search in combined fields like full name
  private searchInCombinedFields(customer: Customer, term: string): boolean {
    // Search in full name (firstName + middleName + lastName)
    const fullName = `${customer.firstName || ''} ${customer.middleName || ''} ${customer.lastName || ''}`.toLowerCase().trim();
    if (fullName && fullName.includes(term)) return true;
    if (!this.customerData.lifestage && this.lifeStages.length > 0) {
      this.customerData.lifestage = this.lifeStages[0].name;
    }
    // Search in full address
    const fullAddress = `${customer.addressLine1 || ''} ${customer.addressLine2 || ''} ${customer.city || ''} ${customer.state || ''} ${customer.country || ''} ${customer.zipCode || ''}`.toLowerCase().trim();
    if (fullAddress && fullAddress.includes(term)) return true;
    
    // Search in combined contact info
    const contactInfo = `${customer.mobile || ''} ${customer.landline || ''} ${customer.alternateContact || ''}`.toLowerCase().trim();
    if (contactInfo && contactInfo.includes(term)) return true;
    
    return false;
  }

  // Helper method to get value for sorting, with type safety
  private getSortValue(customer: Customer, column: string): any {
    const value = customer[column as keyof Customer];
    
    // Return empty string for null/undefined for consistent sorting
    if (value === null || value === undefined) return '';
    
    return value;
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.applyFilters();
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.filterOptions = {
      saleDue: false,
      saleReturn: false,
      advanceBalance: false,
      openingBalance: false,
      assignedTo: '',
      status: '',
      state: '',
      lifestage: '',      // new
      adcode: '',
      department:''
    };
    this.applyFilters();
    // Optional: Close the sidebar when clearing filters
    // this.showFilterSidebar = false;
  }

  sortBy(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.applyFilters();
  }

  get paginatedCustomers(): Customer[] {
    const start = (this.currentPage - 1) * this.entriesPerPage;
    const end = start + this.entriesPerPage;
    return this.filteredCustomers.slice(start, end);
  }

  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  // Pagination range method
  getPaginationRange(): number[] {
    const range: number[] = [];
    const rangeSize = 3; // Show 3 page numbers around current page
    
    let start = Math.max(2, this.currentPage - Math.floor(rangeSize / 2));
    let end = Math.min(this.totalPages - 1, start + rangeSize - 1);
    
    // Adjust start if we're near the end
    if (end === this.totalPages - 1) {
      start = Math.max(2, end - rangeSize + 1);
    }
    
    for (let i = start; i <= end; i++) {
      range.push(i);
    }
    
    return range;
  }

  // Make Math available in the template
  get Math() {
    return Math;
  }

  toggleForm(): void {
    this.showForm = !this.showForm;
    if (this.showForm && !this.editingCustomerId) {
      // Auto-generate contact ID when opening form for a new customer
      this.customerData = {
        contactId: this.generateContactId(),
        contactType: 'Customer', // Set default contact type
        payTerm: 0, // Set default pay term
        status: 'Active' // Set default status
      };
    }
    if (!this.showForm) {
      this.resetForm();
    }
  }

  resetForm(): void {
    this.customerData = {};
    this.editingCustomerId = null;
    this.showMoreInfo = false;
    this.isIndividual = true;
    
    // Reset phone errors
    this.phoneErrors = {
      mobile: '',
      landline: '',
      alternateContact: '',
      
    };
  }

  toggleMoreInfo(): void {
    this.showMoreInfo = !this.showMoreInfo;
  }

  onContactTypeChange(): void {
    const contactType = this.customerData.contactType;
    // Keep the existing isIndividual value
    const isIndividualValue = this.isIndividual;
    
    // Preserve other important fields
    const preservedFields = {
      firstName: this.customerData.firstName,
      lastName: this.customerData.lastName,
      businessName: this.customerData.businessName,
      mobile: this.customerData.mobile,
      email: this.customerData.email
    };
    
    // Reset the form but keep the contact type and preserved fields
    this.customerData = { 
      contactType,
      ...preservedFields,
      contactId: this.generateContactId()
    };
    
    // Restore the isIndividual value
    this.isIndividual = isIndividualValue;
  }

  // Phone number validation
  validatePhoneNumber(event: any, field: string): void {
    const input = event.target.value;
    
    // Allow only digits
    if (!/^\d*$/.test(input)) {
      event.target.value = input.replace(/[^\d]/g, '');
      return;
    }
    
    // Check if the length is exactly 10 digits
    if (input.length > 0 && input.length !== 10) {
      this.phoneErrors[field as keyof typeof this.phoneErrors] = 'Phone number must be exactly 10 digits';
    } else {
      this.phoneErrors[field as keyof typeof this.phoneErrors] = '';
    }
  }

  saveCustomer(): void {
    // First set the isIndividual property
    this.customerData.isIndividual = this.isIndividual;
    this.customerData.mobile = this.cleanPhoneNumber(this.customerData.mobile || '');
  this.customerData.landline = this.cleanPhoneNumber(this.customerData.landline || '');
  this.customerData.alternateContact = this.cleanPhoneNumber(this.customerData.alternateContact || '');
    // Validate based on whether it's an individual or business
    if (this.isIndividual && !this.customerData.firstName) {
      alert('First Name is required for individuals');
      return;
    }
    // Add this to your validation checks
if (this.customerData.age && (this.customerData.age < 0 || this.customerData.age > 120)) {
  alert('Age must be between 0 and 120');
  return;
}
    if (!this.isIndividual && !this.customerData.businessName) {
      alert('Business Name is required for businesses');
      return;
    }
    
    // Validate mobile number
    if (!this.customerData.mobile || this.customerData.mobile.length !== 10) {
      alert('Mobile number must be exactly 10 digits');
      return;
    }
    
    // Validate landline if provided
    if (this.customerData.landline && this.customerData.landline.length !== 10) {
      alert('Landline number must be exactly 10 digits');
      return;
    }
    
    // Validate alternate contact if provided
    if (this.customerData.alternateContact && this.customerData.alternateContact.length !== 10) {
      alert('Alternate contact number must be exactly 10 digits');
      return;
    }

    if (this.customerData.lifestage) {
      this.customerData.lifestage = this.customerData.lifestage;
    }
    
    // Set the createdAt and updatedAt fields
    const now = new Date();
    if (!this.editingCustomerId) {
      this.customerData.createdAt = now;
    }
    this.customerData.updatedAt = now;
    
    // Set status to 'Active' if not defined
    if (!this.customerData.status) {
      this.customerData.status = 'Active';
    }
    
    // Process based on editing state
    if (this.editingCustomerId) {
      this.updateExistingCustomer();
    } else {
      this.addNewCustomer();
    }
  }

  addNewCustomer(): void {
    // Ensure contact ID is generated
    if (!this.customerData.contactId) {
      this.customerData.contactId = this.generateContactId();
    }
    
    // Ensure the isIndividual property is properly set
    this.customerData.isIndividual = this.isIndividual;
    
    // Save to appropriate collection based on contact type
    if (this.customerData.contactType === 'Customer' || this.customerData.contactType === 'Both') {
      this.customerService.addCustomer(this.customerData as Customer)
        .then(() => {
          if (this.customerData.contactType !== 'Both') {
            this.toggleForm();
            this.loadCustomers();
            alert('Customer added successfully!');
          }
        })
        .catch((error) => {
          console.error('Error adding customer: ', error);
          alert('Error adding customer. Please try again.');
        });
    }
    
    if (this.customerData.contactType === 'Supplier' || this.customerData.contactType === 'Both') {
      this.supplierService.addSupplier(this.customerData as any)
        .then(() => {
          this.toggleForm();
          this.loadCustomers();
          alert(`${this.customerData.contactType === 'Both' ? 'Contact' : 'Supplier'} added successfully!`);
        })
        .catch((error) => {
          console.error('Error adding supplier: ', error);
          alert('Error adding supplier. Please try again.');
        });
    }
  }

  updateExistingCustomer(): void {
    if (this.editingCustomerId) {
      // Ensure the isIndividual property is properly set
      this.customerData.isIndividual = this.isIndividual;
      
      if (this.customerData.contactType === 'Customer' || this.customerData.contactType === 'Both') {
        this.customerService.updateCustomer(this.editingCustomerId, this.customerData as Customer)
          .then(() => {
            if (this.customerData.contactType !== 'Both') {
              this.toggleForm();
              this.loadCustomers();
              alert('Customer updated successfully!');
            }
          })
          .catch((error) => {
            console.error('Error updating customer: ', error);
            alert('Error updating customer. Please try again.');
          });
      }
      
      if (this.customerData.contactType === 'Supplier' || this.customerData.contactType === 'Both') {
        this.supplierService.updateSupplier(this.editingCustomerId, this.customerData as any)
          .then(() => {
            this.toggleForm();
            this.loadCustomers();
            alert(`${this.customerData.contactType === 'Both' ? 'Contact' : 'Supplier'} updated successfully!`);
          })
          .catch((error) => {
            console.error('Error updating supplier: ', error);
            alert('Error updating supplier. Please try again.');
          });
      }
    }
  }

  editCustomer(customer: Customer): void {
    // Create a deep copy of customer data
    this.customerData = JSON.parse(JSON.stringify(customer));
    this.editingCustomerId = customer.id || null;
    
    // Set isIndividual based on customer data
    this.isIndividual = customer.isIndividual !== undefined ? customer.isIndividual : true;
    
    this.showForm = true;
    
    // Reset phone errors when editing
    this.phoneErrors = {
      mobile: '',
      landline: '',
      alternateContact: ''
    };
    
    // Show more info section if any related fields are filled
    if (customer.taxNumber || customer.addressLine1 || customer.openingBalance) {
      this.showMoreInfo = true;
    }
    if (!this.customerData.lifestage && this.lifeStages.length > 0) {
      this.customerData.lifestage = this.lifeStages[0].name;
    }
  }

  deleteCustomer(id?: string): void {
    if (!id) return;
    
    if (confirm('Are you sure you want to delete this customer?')) {
      this.customerService.deleteCustomer(id)
        .then(() => {
          this.loadCustomers();
          alert('Customer deleted successfully!');
        })
        .catch((error) => {
          console.error('Error deleting customer: ', error);
          alert('Error deleting customer. Please try again.');
        });
    }
  }

  generateContactId(): string {
    const existingIds = this.customersList
      .map(c => c.contactId || '')
      .filter(id => id.startsWith('CO'))
      .map(id => parseInt(id.substring(2), 10) || 0);
  
    const maxId = Math.max(0, ...existingIds);
    return `CO${String(maxId + 1).padStart(4, '0')}`;
  }

  exportCSV(): void {
    if (this.filteredCustomers.length === 0) {
      alert('No data to export');
      return;
    }

    try {
      // Prepare CSV content
      const headers = Object.keys(this.filteredCustomers[0]).filter(key => key !== 'id');
      const csvRows = [];
      
      // Add headers
      csvRows.push(headers.join(','));
      
      // Add data rows
      this.filteredCustomers.forEach(customer => {
        const values = headers.map(header => {
          const value = customer[header as keyof Customer];
          // Handle special cases
          if (value === null || value === undefined) return '';
          if (value instanceof Date) return value.toISOString();
          // Escape quotes in strings
          if (typeof value === 'string') return `"${value.replace(/"/g, '""')}"`;
          return value;
        });
        csvRows.push(values.join(','));
      });

      // Create CSV file
      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      
      // Create download link
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `customers_${new Date().toISOString().slice(0,10)}.csv`);
      link.style.visibility = 'hidden';
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('Error exporting CSV. Please try again.');
    }
  }

  exportExcel(): void {
    if (this.filteredCustomers.length === 0) {
      alert('No data to export');
      return;
    }

    try {
      // Prepare worksheet
      const worksheet = XLSX.utils.json_to_sheet(this.filteredCustomers.map(customer => {
        // Flatten the customer object for Excel
        const flatCustomer: any = {};
        Object.keys(customer).forEach(key => {
          if (key !== 'id') {
            const value = customer[key as keyof Customer];
            flatCustomer[key] = value instanceof Date ? value.toISOString() : value;
          }
        });
        return flatCustomer;
      }));
      
      // Create workbook
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Customers');
      
      // Generate Excel file
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      
      // Create download link
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `customers_${new Date().toISOString().slice(0,10)}.xlsx`);
      link.style.visibility = 'hidden';
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
    } catch (error) {
      console.error('Error exporting Excel:', error);
      alert('Error exporting Excel. Please try again.');
    }
  }

  exportPDF(): void {
    console.log('Exporting to PDF:', this.filteredCustomers);
    // Implement PDF export logic here
  }
}