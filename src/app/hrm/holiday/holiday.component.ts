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
      startDate: ['', Validators.required],
      endDate: ['', Validators.required],
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

  openPopup() {
    this.showPopup = true;
  }

  closePopup() {
    this.showPopup = false;
    this.holidayForm.reset();
  }

  saveHoliday() {
    if (this.holidayForm.valid) {
      const holidayData = this.holidayForm.value;

      this.holidayService.addHoliday(holidayData).then(() => {
        this.closePopup();
        this.loadHolidays();
      });
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
