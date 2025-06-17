import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidatorFn } from '@angular/forms';
import { LocationService } from '../services/location.service';
import { Subscription } from 'rxjs';

// Custom validator function for exactly 10 digits
function mobileNumberValidator(): ValidatorFn {
  return (control: AbstractControl): {[key: string]: any} | null => {
    if (!control.value) return null; // Allow empty values
    const valid = /^[0-9]{10}$/.test(control.value || '');
    return valid ? null : {'invalidMobile': {value: control.value}};
  };
}

@Component({
  selector: 'app-business-locations',
  templateUrl: './business-locations.component.html',
  styleUrls: ['./business-locations.component.scss']
})
export class BusinessLocationsComponent implements OnInit, OnDestroy {
  showPopup = false;
  locationForm!: FormGroup;
  locations: any[] = [];
  private locationsSubscription: Subscription | undefined;
  editMode = false;
  currentLocationId: string | null = null;
  
  // Add states and districts data
  states = ['Tamil Nadu', 'Kerala'];
  districts: { [key: string]: string[] } = {
   'Tamil Nadu': [
  'Ariyalur', 'Chengalpattu', 'Chennai', 'Coimbatore', 'Cuddalore',
  'Dharmapuri', 'Dindigul', 'Erode', 'Kallakurichi', 'Kancheepuram',
  'Karur', 'Krishnagiri', 'Madurai', 'Mayiladuthurai', 'Nagapattinam',
  'Namakkal', 'Nilgiris', 'Perambalur', 'Pudukkottai', 'Ramanathapuram',
  'Ranipet', 'Salem', 'Sivaganga', 'Tenkasi', 'Thanjavur',
  'Theni', 'Thoothukudi', 'Tiruchirappalli', 'Tirunelveli', 'Tirupathur',
  'Tiruppur', 'Tiruvallur', 'Tiruvannamalai', 'Tiruvarur', 'Vellore',
  'Viluppuram', 'Virudhunagar'
],

    'Kerala': [
      'Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Thrissur', 'Kollam',
      'Alappuzha', 'Kannur', 'Kottayam', 'Palakkad', 'Malappuram',
      'Kasaragod', 'Pathanamthitta', 'Idukki', 'Wayanad'
    ]
  };
  
  // City dropdown options based on selected state
  cityOptions: string[] = [];

  constructor(private fb: FormBuilder, private locationService: LocationService) {
    this.createForm();
  }

  ngOnInit() {
    this.loadLocations();
    
    // Listen for changes to the state field
    this.locationForm.get('state')?.valueChanges.subscribe(state => {
      this.updateCityOptions(state);
    });
  }

  ngOnDestroy() {
    // Clean up subscription when component is destroyed
    if (this.locationsSubscription) {
      this.locationsSubscription.unsubscribe();
    }
  }

  createForm() {
    this.locationForm = this.fb.group({
      name: ['', Validators.required],
      locationId: [''],
      landmark: [''],
      city: ['', Validators.required],
      zipCode: ['', Validators.required],
      state: ['', Validators.required],
      country: ['India', Validators.required],
      mobile: ['', mobileNumberValidator()], 
      alternateContact: ['', mobileNumberValidator()], // Added mobile validator to alternate contact
      email: [''],
      website: [''],
      invoiceSchemePOS: ['Default', Validators.required],
      invoiceSchemeSale: ['Default', Validators.required],
      invoiceLayoutPOS: ['Default', Validators.required],
      invoiceLayoutSale: ['Default', Validators.required],
      sellingPriceGroup: ['Default'],
      customField1: [''],
      customField2: [''],
      customField3: [''],
      customField4: [''],
      paymentOptions: this.fb.group({
        cash: ['None'],
        card: ['None'],
        cheque: ['None'],
        bankTransfer: ['None'],
        other: ['None']
      })
    });
  }
  
  // Update city options based on selected state
  updateCityOptions(state: string) {
    if (state && this.districts[state]) {
      this.cityOptions = this.districts[state];
      // Reset city field when state changes
      this.locationForm.get('city')?.setValue('');
    } else {
      this.cityOptions = [];
    }
  }

  loadLocations() {
    // Subscribe to the observable returned by getLocations
    this.locationsSubscription = this.locationService.getLocations().subscribe(
      (data) => {
        this.locations = data;
        console.log('Locations loaded:', this.locations);
      },
      (error) => {
        console.error('Error loading locations:', error);
      }
    );
  }

  openPopup() {
    this.editMode = false;
    this.currentLocationId = null;
    this.resetForm();
    this.showPopup = true;
  }

  closePopup() {
    this.showPopup = false;
    this.resetForm();
  }

  resetForm() {
    this.locationForm.reset({
      invoiceSchemePOS: 'Default',
      invoiceSchemeSale: 'Default',
      invoiceLayoutPOS: 'Default',
      invoiceLayoutSale: 'Default',
      sellingPriceGroup: 'Default',
      paymentOptions: {
        cash: 'None',
        card: 'None',
        cheque: 'None',
        bankTransfer: 'None',
        other: 'None'
      }
    });
    this.editMode = false;
    this.currentLocationId = null;
    this.cityOptions = [];
  }

  // Check if the mobile field has errors
  isMobileInvalid(): boolean {
    const control = this.locationForm.get('mobile');
    return control ? (control.invalid && (control.dirty || control.touched)) : false;
  }
  
  // Check if the alternate contact field has errors
  isAlternateContactInvalid(): boolean {
    const control = this.locationForm.get('alternateContact');
    return control ? (control.invalid && (control.dirty || control.touched)) : false;
  }

  saveLocation() {
    if (this.locationForm.valid) {
      const formData = this.locationForm.value;
      
      if (this.editMode && this.currentLocationId) {
        this.locationService.updateLocation(this.currentLocationId, formData)
          .then(() => {
            console.log('Location updated successfully');
            this.closePopup(); // This will close the popup after successful edit
          })
          .catch(error => {
            console.error('Error updating location:', error);
            alert('Error updating location. Please try again.');
          });
      } else {
        this.locationService.addLocation(formData)
          .then(() => {
            console.log('Location added successfully');
            this.closePopup(); // This will close the popup after successful add
          })
          .catch(error => {
            console.error('Error adding location:', error);
            alert('Error adding location. Please try again.');
          });
      }
    } else {
      // Mark all fields as touched to trigger validation errors
      Object.keys(this.locationForm.controls).forEach(key => {
        const control = this.locationForm.get(key);
        control?.markAsTouched();
      });
      
      // Check if mobile numbers are invalid
      if (this.isMobileInvalid()) {
        alert('Please enter a valid 10-digit mobile number');
      } else if (this.isAlternateContactInvalid()) {
        alert('Please enter a valid 10-digit alternate contact number');
      } else {
        alert('Please fill all required fields');
      }
    }
  }

  editLocation(location: any) {
    this.editMode = true;
    this.currentLocationId = location.id;
    
    // Update city options based on the location's state
    if (location.state) {
      this.updateCityOptions(location.state);
    }
    
    this.locationForm.patchValue({
      name: location.name || '',
      locationId: location.locationId || '',
      landmark: location.landmark || '',
      city: location.city || '',
      zipCode: location.zipCode || '',
      state: location.state || '',
      country: location.country || '',
      mobile: location.mobile || '',
      alternateContact: location.alternateContact || '',
      email: location.email || '',
      website: location.website || '',
      invoiceSchemePOS: location.invoiceSchemePOS || 'Default',
      invoiceSchemeSale: location.invoiceSchemeSale || 'Default',
      invoiceLayoutPOS: location.invoiceLayoutPOS || 'Default',
      invoiceLayoutSale: location.invoiceLayoutSale || 'Default',
      sellingPriceGroup: location.sellingPriceGroup || 'Default',
      customField1: location.customField1 || '',
      customField2: location.customField2 || '',
      customField3: location.customField3 || '',
      customField4: location.customField4 || '',
      paymentOptions: {
        cash: location.paymentOptions?.cash || 'None',
        card: location.paymentOptions?.card || 'None',
        cheque: location.paymentOptions?.cheque || 'None',
        bankTransfer: location.paymentOptions?.bankTransfer || 'None',
        other: location.paymentOptions?.other || 'None'
      }
    });
    
    this.showPopup = true;
  }
    
  deactivateLocation(location: any) {
    if (confirm('Are you sure you want to deactivate this location?')) {
      this.locationService.deactivateLocation(location.id)
        .then(() => {
          console.log('Location deactivated successfully');
          // Refresh the locations list to reflect the changes
          this.loadLocations();
        })
        .catch(error => {
          console.error('Error deactivating location:', error);
          alert('Error deactivating location. Please try again.');
        });
    }
  }
}