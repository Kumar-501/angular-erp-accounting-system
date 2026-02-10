import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges } from '@angular/core';
import { CustomerService } from '../services/customer.service';

@Component({
  selector: 'app-customer-edit-popup',
  templateUrl: './customer-edit-popup.component.html',
  styleUrls: ['./customer-edit-popup.component.scss']
})
export class CustomerEditPopupComponent implements OnChanges {
  @Input() customerData: any;
  @Output() save = new EventEmitter<any>();
  @Output() close = new EventEmitter<void>();
genders = ['Male', 'Female', 'Other'];

  show = true;
  isSaving = false;
  sameAsBilling = false;
  showCopySuccessMsg = false;
  showMoreInfo = false;
    combinedAddress: string = '';

  isIndividual = true;
  phoneErrors = {
    mobile: '',
    landline: '',
    alternateContact: ''
  };
  assignedUsers: any[] = [];
  leadStatuses: any[] = [];
  lifeStages: any[] = [];
  states: string[] = ['Tamil Nadu', 'Kerala', 'Karnataka', 'Andhra Pradesh', 'Maharashtra'];
  contactTypes = ['Customer', 'Supplier', 'Both'];
  prefixes = ['', 'Mr', 'Mrs', 'Ms', 'Dr'];
  payTerms = [
    { value: 0, label: 'Immediate' },
    { value: 15, label: '15 Days' },
    { value: 30, label: '30 Days' },
    { value: 45, label: '45 Days' },
    { value: 60, label: '60 Days' },
    { value: 90, label: '90 Days' }
  ];

  constructor(private customerService: CustomerService) {}

// Update the ngOnChanges method
ngOnChanges(changes: SimpleChanges): void {
  if (changes['customerData'] && this.customerData) {
    // Initialize isIndividual
    this.isIndividual = !this.customerData.businessName;
    
    // Initialize name fields
    this.customerData.prefix = this.customerData.prefix || '';
    this.customerData.firstName = this.customerData.firstName || '';
    this.customerData.middleName = this.customerData.middleName || '';
    this.customerData.lastName = this.customerData.lastName || '';
    
    // Initialize demographic fields
    this.customerData.age = this.customerData.age || null;
    this.customerData.dob = this.customerData.dob || '';
    this.customerData.gender = this.customerData.gender || '';
    this.customerData.occupation = this.customerData.occupation || '';
        this.customerData.district = this.customerData.district || '';

    // Initialize addresses
    if (!this.customerData.billingAddress) {
      this.customerData.billingAddress = this.customerData.addressLine1 || '';
    }
    if (!this.customerData.shippingAddress) {
      this.customerData.shippingAddress = this.customerData.addressLine1 || '';
    }
    
    // Check if addresses are same
    this.sameAsBilling = this.customerData.billingAddress === this.customerData.shippingAddress;
    
    // Update display name
    this.updateDisplayName();
    
    // Update combined address with contact info
    this.updateCombinedAddress();
    
    // Load additional data
    this.loadAssignedUsers();
    this.loadLeadStatuses();
    this.loadLifeStages();
  }
}
  loadAssignedUsers(): void {
    // Implement your user service call here
    // this.userService.getUsers().subscribe(users => {
    //   this.assignedUsers = users;
    // });
  }
  districtsByState: { [key: string]: string[] } = {
    'Tamil Nadu': [
    'Ariyalur',
    'Chengalpattu',
    'Chennai',
    'Coimbatore',
    'Cuddalore',
    'Dharmapuri',
    'Dindigul',
    'Erode',
    'Kallakurichi',
    'Kancheepuram',
    'Karur',
    'Krishnagiri',
    'Madurai',
    'Mayiladuthurai',
    'Nagapattinam',
    'Namakkal',
    'Nilgiris',
    'Perambalur',
    'Pudukkottai',
    'Ramanathapuram',
    'Ranipet',
    'Salem',
    'Sivaganga',
    'Tenkasi',
    'Thanjavur',
    'Theni',
    'Thoothukudi',
    'Tiruchirappalli',
    'Tirunelveli',
    'Tirupathur',
    'Tiruppur',
    'Tiruvallur',
    'Tiruvannamalai',
    'Tiruvarur',
    'Vellore',
    'Viluppuram',
    'Virudhunagar'
  ],
    'Kerala': [
    'Alappuzha',
    'Ernakulam',
    'Idukki',
    'Kannur',
    'Kasaragod',
    'Kollam',
    'Kottayam',
    'Kozhikode',
    'Malappuram',
    'Palakkad',
    'Pathanamthitta',
    'Thiruvananthapuram',
    'Thrissur',
    'Wayanad'
  ]

};

  loadLeadStatuses(): void {
    // Implement your lead status service call here
    // this.leadStatusService.getLeadStatuses().subscribe(statuses => {
    //   this.leadStatuses = statuses;
    // });
  }

  loadLifeStages(): void {
    // Implement your life stage service call here
    // this.lifeStageService.getLifeStages().then(stages => {
    //   this.lifeStages = stages;
    // });
  }

updateDisplayName(): void {
  if (this.isIndividual) {
    // For individuals: "FirstName LastName"
    const names = [
      this.customerData.prefix,
      this.customerData.firstName,
      this.customerData.middleName,
      this.customerData.lastName
    ].filter(name => name && name.trim());
    
    this.customerData.displayName = names.join(' ');
  } else {
    // For businesses: use business name
    this.customerData.displayName = this.customerData.businessName;
  }
  
  // Update the combined address when name changes
  this.updateCombinedAddress();
}
get districts(): string[] {
  return this.customerData.state ? this.districtsByState[this.customerData.state] || [] : [];
}
updateCombinedAddress(): void {
  // Build name part
  const namePart = this.customerData.displayName || 
                  [this.customerData.firstName, this.customerData.lastName]
                    .filter(n => n).join(' ');

  // Build address parts array
  const addressParts = [
    this.customerData.addressLine1,
    this.customerData.addressLine2,
    this.customerData.state,
        this.customerData.district, // Add district here

    this.customerData.country,
    this.customerData.zipCode
  ].filter(part => part && part.trim());

  // Build contact info string
  const contactInfo = [
    this.customerData.mobile ? `Ph: ${this.customerData.mobile}` : '',
    this.customerData.alternateContact ? `Alt: ${this.customerData.alternateContact}` : ''
  ].filter(part => part).join(', ');

  // Combine all parts
  const fullAddress = [
    namePart,
    ...addressParts,
    contactInfo
  ].filter(part => part).join(', ');

  // Update billing address
  this.customerData.billingAddress = fullAddress;

  // Update shipping address if "same as billing" is checked
  if (this.sameAsBilling) {
    this.customerData.shippingAddress = fullAddress;
  }
}
  

onSameAsBillingChange(): void {
  if (this.sameAsBilling) {
    this.customerData.shippingAddress = this.customerData.billingAddress;
  }
}

  toggleMoreInfo(): void {
    this.showMoreInfo = !this.showMoreInfo;
  }
onAddressFieldChange(): void {
  this.updateCombinedAddress();
}
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

  cleanPhoneNumber(phone: string): string {
    return phone.replace(/\D/g, '');
  }

  async onSave(): Promise<void> {
    this.isSaving = true;
    try {
      // First set the isIndividual property
      this.customerData.isIndividual = this.isIndividual;
       this.updateCombinedAddress();
      this.customerData.combinedAddress = this.combinedAddress;
      // Clean phone numbers
      this.customerData.mobile = this.cleanPhoneNumber(this.customerData.mobile || '');
      this.customerData.landline = this.cleanPhoneNumber(this.customerData.landline || '');
      this.customerData.alternateContact = this.cleanPhoneNumber(this.customerData.alternateContact || '');
      
      // Validate required fields
      if (this.isIndividual && !this.customerData.firstName) {
        alert('First Name is required for individuals');
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
      
      // Validate other phone numbers if provided
      if (this.customerData.landline && this.customerData.landline.length !== 10) {
        alert('Landline number must be exactly 10 digits');
        return;
      }
      
      if (this.customerData.alternateContact && this.customerData.alternateContact.length !== 10) {
        alert('Alternate contact number must be exactly 10 digits');
        return;
      }

      // Ensure display name is updated
      this.updateDisplayName();
      
      // Set updated timestamp
      this.customerData.updatedAt = new Date();
      
      // Emit the updated customer data to parent
      this.save.emit(this.customerData);
      this.show = false;
    } catch (error) {
      console.error('Error in customer edit popup:', error);
      alert('Failed to save customer changes. Please try again.');
    } finally {
      this.isSaving = false;
    }
  }

  onClose(): void {
    this.close.emit();
  }
}