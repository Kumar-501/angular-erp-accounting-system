import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HolidayService } from '../../services/holiday.service';
import { LocationService } from '../../services/location.service';

@Component({
  selector: 'app-holiday',
  templateUrl: './holiday.component.html',
  styleUrls: ['./holiday.component.scss'],
})
export class HolidayComponent implements OnInit {
  showPopup = false;
  holidayForm!: FormGroup;
  holidays: any[] = [];
  locations: any[] = [];
    isEditMode = false; // Add this flag
  currentHolidayId: string | null = null;

  constructor(
    private fb: FormBuilder,
    private holidayService: HolidayService,
    private locationService: LocationService
  ) {
    this.createForm();
  }

  ngOnInit(): void {
    this.loadLocations();
  }

  createForm() {
    this.holidayForm = this.fb.group({
      name: ['', Validators.required],
      startDate: ['',],
      endDate: ['',],
      businessLocation: ['', Validators.required],
      note: [''],
    });
  }

  loadHolidays() {
    this.holidayService.getHolidays().subscribe((holidays: any[]) => {
      this.holidays = holidays.map(holiday => {
        const location = this.locations.find(loc => loc.id === holiday.businessLocation);
        return {
          ...holiday,
          locationName: location ? location.name : 'Unknown Location'
        };
      });
    });
  }

  loadLocations() {
    this.locationService.getLocations().subscribe((locations: any[]) => {
      this.locations = locations;
      // After loading locations, reload holidays to update location names
      this.loadHolidays();
    });
  }

  openPopup(holiday?: any) {
    this.showPopup = true;
    if (holiday) {
      // Edit mode
      this.isEditMode = true;
      this.currentHolidayId = holiday.id;
      this.holidayForm.patchValue({
        name: holiday.name,
        startDate: holiday.startDate,
        endDate: holiday.endDate,
        businessLocation: holiday.businessLocation,
        note: holiday.note
      });
    } else {
      // Add mode
      this.isEditMode = false;
      this.currentHolidayId = null;
      this.holidayForm.reset();
    }
  }
  
 closePopup() {
    this.showPopup = false;
    this.isEditMode = false;
    this.currentHolidayId = null;
    this.holidayForm.reset();
  }
  editHoliday(holiday: any) {
    this.openPopup(holiday);
  }
  deleteHoliday(id: string) {
    if (confirm('Are you sure you want to delete this holiday?')) {
      this.holidayService.deleteHoliday(id)
        .then(() => {
          this.loadHolidays();
        });
    }
  }
  saveHoliday() {
    if (this.holidayForm.valid) {
      const holidayData = this.holidayForm.value;

      if (this.isEditMode && this.currentHolidayId) {
        // Update existing holiday
        this.holidayService.updateHoliday(this.currentHolidayId, holidayData)
          .then(() => {
            this.closePopup();
            this.loadHolidays();
          });
      } else {
        // Add new holiday
        this.holidayService.addHoliday(holidayData)
          .then(() => {
            this.closePopup();
            this.loadHolidays();
          });
      }
    } else {
      alert('Please fill out all required fields');
    }
  }
  // Helper function to get location name by ID
  getLocationName(locationId: string): string {
    const location = this.locations.find(loc => loc.id === locationId);
    return location ? location.name : 'Unknown Location';
  }
}
