import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { UserService } from '../services/user.service';
import { LocationService } from '../services/location.service';
import { RolesService } from '../services/roles.service';
import { DepartmentService } from '../services/department.service';
import { DesignationService } from '../services/designation.service';

@Component({
  selector: 'app-edit-user',
  templateUrl: './edit-user.component.html',
  styleUrls: ['./edit-user.component.scss']
})
export class EditUserComponent implements OnInit {
  editUserForm!: FormGroup;
  userId!: string;
  user: any;
  departments: any[] = [];
  designations: any[] = [];
  filteredDesignations: any[] = [];
  businessLocations: any[] = [];
  selectedLocations: string[] = [];
  roles: any[] = [];
  employeeIdPrefix = 'EMP';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private userService: UserService,
    private locationService: LocationService,
    private rolesService: RolesService,
    private departmentService: DepartmentService,
    private designationService: DesignationService
  ) {}

  ngOnInit(): void {
    this.userId = this.route.snapshot.paramMap.get('id')!;
    this.initializeForm();
    this.fetchBusinessLocations();
    this.fetchRoles();
    this.fetchDepartments();
    this.fetchDesignations();
    this.loadUserData();
  }

  initializeForm(): void {
    this.editUserForm = this.fb.group({
      // Basic Info
      prefix: ['Mr'],
      firstName: ['', ],
      lastName: [''],
      department: ['', ],
      designation: ['',],
      employeeId: [''],

      email: ['', [, Validators.email]],
      isActive: [false],
      enableServicePin: [false],

      // Login
      allowLogin: [false],
      role: [''],
      allLocations: [true],
      username: [''],
      password: [''],
      confirmPassword: [''],

      // Sales
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

    // Adding valueChanges listeners
    this.editUserForm.get('confirmPassword')?.valueChanges.subscribe(() => {
      this.editUserForm.updateValueAndValidity();
    });

    this.editUserForm.get('department')?.valueChanges.subscribe(() => {
      this.generateEmployeeId();
    });
  
    this.editUserForm.get('password')?.valueChanges.subscribe(() => {
      if (this.editUserForm.get('confirmPassword')?.value) {
        this.editUserForm.updateValueAndValidity();
      }
    });
  }

  loadUserData(): void {
    this.userService.getUserById(this.userId).subscribe(user => {
      this.user = user;
      
      // Set form values
      this.editUserForm.patchValue({
        prefix: user.prefix || 'Mr',
        firstName: user.firstName,
        lastName: user.lastName,
        department: user.department,
        designation: user.designation,
        employeeId: user.employeeId,
        email: user.email,
        isActive: user.isActive || false,
        enableServicePin: user.enableServicePin || false,
        allowLogin: user.allowLogin || false,
        role: user.role || '',
        allLocations: user.allLocations || true,
        username: user.username || '',
        salesCommission: user.salesCommission || '',
        maxDiscount: user.maxDiscount || '',
        allowSelectedContacts: user.allowSelectedContacts || false,
        selectedContact: user.selectedContact || '',
        dob: user.dob || '',
        gender: user.gender || '',
        maritalStatus: user.maritalStatus || '',
        bloodGroup: user.bloodGroup || '',
        mobileNumber: user.mobileNumber || '',
        alternateContactNumber: user.alternateContactNumber || '',
        familyContactNumber: user.familyContactNumber || '',
        facebookLink: user.facebookLink || '',
        twitterLink: user.twitterLink || '',
        socialMedia1: user.socialMedia1 || '',
        socialMedia2: user.socialMedia2 || '',
        customField1: user.customField1 || '',
        customField2: user.customField2 || '',
        customField3: user.customField3 || '',
        customField4: user.customField4 || '',
        guardianName: user.guardianName || '',
        idProofName: user.idProofName || '',
        idProofNumber: user.idProofNumber || '',
        permanentAddress: user.permanentAddress || '',
        currentAddress: user.currentAddress || '',
        accountHolderName: user.accountHolderName || '',
        accountNumber: user.accountNumber || '',
        bankName: user.bankName || '',
        bankIdentifierCode: user.bankIdentifierCode || '',
        branch: user.branch || '',
        taxPayerId: user.taxPayerId || ''
      });

      // Set locations if not all locations
      if (!user.allLocations && user.selectedLocations) {
        this.selectedLocations = [...user.selectedLocations];
      }

      // Filter designations based on department
      if (user.department) {
        this.filterDesignations();
      }
    });
  }

  fetchDepartments(): void {
    this.departmentService.getDepartments().subscribe((departments: any[]) => {
      this.departments = departments;
    });
  }

  fetchDesignations(): void {
    this.designationService.getDesignations().subscribe((designations: any[]) => {
      this.designations = designations;
      this.filterDesignations();
    });
  }

  onDepartmentChange(): void {
    this.filterDesignations();
    this.generateEmployeeId();
  }

  filterDesignations(): void {
    const selectedDept = this.editUserForm.get('department')?.value;
    if (selectedDept) {
      this.filteredDesignations = this.designations.filter(
        desig => desig.department === selectedDept
      );
    } else {
      this.filteredDesignations = [];
    }
  }

  generateEmployeeId(): void {
    const dept = this.editUserForm.get('department')?.value;
    if (!dept) return;

    // Get first 3 letters of department in uppercase
    const deptCode = dept.substring(0, 3).toUpperCase();
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const employeeId = `${this.employeeIdPrefix}-${deptCode}-${randomNum}`;
    
    this.editUserForm.get('employeeId')?.setValue(employeeId);
  }

  phoneNumberValidator(control: AbstractControl): ValidationErrors | null {
    const phoneNumber = control.value;
    if (!phoneNumber) {
      return null;
    }
    
    const isValid = /^[0-9]{10}$/.test(phoneNumber);
    return isValid ? null : { 'invalidPhoneNumber': true };
  }

  validateDigitsOnly(event: any, controlName: string): void {
    const input = event.target as HTMLInputElement;
    const value = input.value;
    
    const digitsOnly = value.replace(/[^0-9]/g, '');
    const truncated = digitsOnly.substring(0, 10);
    
    if (value !== truncated) {
      this.editUserForm.get(controlName)?.setValue(truncated, { emitEvent: false });
      input.value = truncated;
    }
  }

  passwordMatchValidator(group: FormGroup): ValidationErrors | null {
    const password = group.get('password')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    
    if (password && confirmPassword) {
      return password === confirmPassword ? null : { 'passwordMismatch': true };
    }
    return null;
  }

  fetchRoles(): void {
    this.rolesService.getRoles().subscribe((roles: any[]) => {
      this.roles = roles;
    });
  }

  fetchBusinessLocations(): void {
    this.locationService.getLocations().subscribe(
      (locations) => {
        this.businessLocations = locations;
      },
      (error) => {
        console.error('Error fetching locations:', error);
      }
    );
  }
  
  onAllLocationsChange(): void {
    const allLocationsControl = this.editUserForm.get('allLocations');
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
    if (this.editUserForm.invalid) {
      Object.keys(this.editUserForm.controls).forEach(key => {
        this.editUserForm.get(key)?.markAsTouched();
      });
      return;
    }

    const formData = {
      ...this.editUserForm.value,
      selectedLocations: this.selectedLocations,
      // Don't update password if not changed
      password: this.editUserForm.get('password')?.value || undefined
    };

    this.userService.updateUser(this.userId, formData)
      .then(() => {
        console.log("User updated successfully");
        this.router.navigate(['hrm/user1']);
      })
      .catch((error) => {
        console.error("Error updating user: ", error);
      });
  }

  onCancel(): void {
    this.router.navigate(['/users']);
  }
}