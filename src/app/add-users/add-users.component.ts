import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { UserService } from '../services/user.service';
import { LocationService } from '../services/location.service';
import { RolesService } from '../services/roles.service';
import { DepartmentService } from '../services/department.service';
import { DesignationService } from '../services/designation.service';
import { Router } from '@angular/router';


@Component({
  selector: 'app-add-users',
  templateUrl: './add-users.component.html',
  styleUrls: ['./add-users.component.scss']
})
export class AddUsersComponent implements OnInit {
  addUserForm!: FormGroup;
  users: any[] = [];
  departments: any[] = [];
  designations: any[] = [];
  filteredDesignations: any[] = [];
  businessLocations: any[] = [];
  selectedLocations: string[] = [];
  roles: any[] = [];

  constructor(
    private fb: FormBuilder, 
    private userService: UserService,
    private locationService: LocationService,
    private rolesService: RolesService,
    private departmentService: DepartmentService,
    private designationService: DesignationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.initializeForm();
    this.fetchUsers();
    this.fetchBusinessLocations();
    this.fetchRoles();
    this.fetchDepartments();
    this.fetchDesignations();
  }

  fetchDepartments(): void {
    this.departmentService.getDepartments().subscribe((departments: any[]) => {
      this.departments = departments;
      console.log('Departments loaded:', this.departments);
    });
  }

  fetchDesignations(): void {
    this.designationService.getDesignations().subscribe((designations: any[]) => {
      this.designations = designations;
      console.log('Designations loaded:', this.designations);
      this.filterDesignations();
    });
  }

  onDepartmentChange(): void {
    this.filterDesignations();
    // Removed the auto-generation of employeeId
  }

  filterDesignations(): void {
    const selectedDept = this.addUserForm.get('department')?.value;
    if (selectedDept) {
      this.filteredDesignations = this.designations.filter(
        desig => desig.department === selectedDept
      );
    } else {
      this.filteredDesignations = [];
    }
    this.addUserForm.get('designation')?.setValue('');
  }

  // Removed the generateEmployeeId method since we want manual entry

  // Custom validator for 10-digit phone number
  phoneNumberValidator(control: AbstractControl): ValidationErrors | null {
    const phoneNumber = control.value;
    if (!phoneNumber) {
      return null; // Allow empty phone numbers (not required)
    }
    
    // Check if the phone number is exactly 10 digits
    const isValid = /^[0-9]{10}$/.test(phoneNumber);
    return isValid ? null : { 'invalidPhoneNumber': true };
  }
  
  // Validate and allow only digits, max 10
  validateDigitsOnly(event: any, controlName: string): void {
    const input = event.target as HTMLInputElement;
    const value = input.value;
    
    // Remove any non-digit characters
    const digitsOnly = value.replace(/[^0-9]/g, '');
    
    // Ensure maximum 10 digits
    const truncated = digitsOnly.substring(0, 10);
    
    // Only update if the value has changed to avoid recursion
    if (value !== truncated) {
      this.addUserForm.get(controlName)?.setValue(truncated, { emitEvent: false });
      input.value = truncated;
    }
  }

  // Custom validator to check if password and confirm password match
  passwordMatchValidator(group: FormGroup): ValidationErrors | null {
    const password = group.get('password')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    
    // Only validate if both fields have values
    if (password && confirmPassword) {
      return password === confirmPassword ? null : { 'passwordMismatch': true };
    }
    return null;
  }

  fetchRoles(): void {
    this.rolesService.getRoles().subscribe((roles: any[]) => {
      this.roles = roles;
      console.log('Available Roles:', this.roles);
    });
  }

  initializeForm(): void {
    this.addUserForm = this.fb.group({
      // Basic Info
      prefix: ['Mr'],
      firstName: ['', Validators.required],
      lastName: [''],
      department: ['', ],
      designation: ['', ],
      employeeId: [''], // No longer readonly, will be manually entered

      email: ['', [Validators.required, Validators.email]],
      isActive: [false],
      enableServicePin: [false],

      // Login
      allowLogin: [false],
      role: [''],
      allLocations: [true],
      username: [''],
      password: [''],
      confirmPassword: [''],

      // Rest of the form fields remain unchanged
      salesCommission: [''],
      maxDiscount: [''],
      allowSelectedContacts: [false],
      selectedContact: [''],

      // More Information
      dob: [''],
      gender: [''],
      maritalStatus: [''],
      bloodGroup: [''],
      mobileNumber: ['', this.phoneNumberValidator],
      alternateContactNumber: ['', this.phoneNumberValidator],
      familyContactNumber: ['', this.phoneNumberValidator],
      facebookLink: [''],
      twitterLink: [''],
      socialMedia1: [''],
      socialMedia2: [''],
      customField1: [''],
      customField2: [''],
      customField3: [''],
      customField4: [''],
      guardianName: [''],
      idProofName: [''],
      idProofNumber: [''],
      permanentAddress: [''],
      currentAddress: [''],

      // Bank Details
      accountHolderName: [''],
      accountNumber: [''],
      bankName: [''],
      bankIdentifierCode: [''],
      branch: [''],
      taxPayerId: ['']
    }, { validators: this.passwordMatchValidator });

    // Adding valueChanges listener to check password match on each change
    this.addUserForm.get('confirmPassword')?.valueChanges.subscribe(() => {
      this.addUserForm.updateValueAndValidity();
    });

    // Removed the department valueChanges subscription that called generateEmployeeId
  
    this.addUserForm.get('password')?.valueChanges.subscribe(() => {
      if (this.addUserForm.get('confirmPassword')?.value) {
        this.addUserForm.updateValueAndValidity();
      }
    });
  }

  fetchUsers(): void {
    this.userService.getUsers().subscribe((users: any[]) => {
      this.users = users;
      console.log('Real-time Users:', this.users);
    });
  }

  fetchBusinessLocations(): void {
    this.locationService.getLocations().subscribe(
      (locations) => {
        this.businessLocations = locations;
        console.log('Business Locations:', this.businessLocations);
      },
      (error) => {
        console.error('Error fetching locations:', error);
      }
    );
  }
  
  onAllLocationsChange(): void {
    const allLocationsControl = this.addUserForm.get('allLocations');
    if (allLocationsControl?.value) {
      this.selectedLocations = [];
    }
  }

  isLocationSelected(locationId: string): boolean {
    return this.selectedLocations.includes(locationId);
  }

  onLocationSelect(locationId: string, event: any): void {
    if (event.target.checked) {
      if (!this.selectedLocations.includes(locationId)) {
        this.selectedLocations.push(locationId);
      }
    } else {
      this.selectedLocations = this.selectedLocations.filter(id => id !== locationId);
    }
  }

  onSubmit(): void {
    // Mark all fields as touched to show validation errors
    if (this.addUserForm.invalid) {
      Object.keys(this.addUserForm.controls).forEach(key => {
        this.addUserForm.get(key)?.markAsTouched();
      });
      return;
    }
  
    const formData = {
      ...this.addUserForm.value,
      selectedLocations: this.selectedLocations,
    };
  
    this.userService.addUser(formData)
      .then((docRef) => {
        console.log("User added with ID: ", docRef.id);
        this.addUserForm.reset();
        this.selectedLocations = [];
        // Navigate after successful submission
        this.router.navigate(['hrm/user1']);
      })
      .catch((error) => {
        console.error("Error adding user: ", error);
      });
  }
}