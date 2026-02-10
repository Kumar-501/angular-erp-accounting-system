import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HolidayService } from '../../services/holiday.service';
import { LocationService } from '../../services/location.service';
import { AuthService } from '../../auth.service';

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
  showAddButton: boolean = true;
  showEditDeleteButtons: boolean = true;
  isEditMode = false;
  currentHolidayId: string | null = null;
  currentUserRole: string = '';

  constructor(
    private fb: FormBuilder,
    private holidayService: HolidayService,
    private locationService: LocationService,
    private authService: AuthService
  ) {
    this.createForm();
  }

  ngOnInit(): void {
    this.loadLocations();
    this.checkUserRole();
  }

  checkUserRole(): void {
    const user = this.authService.currentUserValue;
    if (user) {
      this.currentUserRole = user.role?.toLowerCase() || '';
      // Hide add button for executive/supervisor/lead roles
      this.showAddButton = !['executive', 'supervisor', 'leads'].includes(this.currentUserRole);
      // Hide edit/delete buttons for the same roles
      this.showEditDeleteButtons = !['executive', 'supervisor', 'leads'].includes(this.currentUserRole);
    }
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
      this.loadHolidays();
    });
  }

  openAddModal() {
    this.isEditMode = false;
    this.currentHolidayId = null;
    this.holidayForm.reset();
    this.showPopup = true;
  }

  editHoliday(holiday: any) {
    this.isEditMode = true;
    this.currentHolidayId = holiday.id;
    this.holidayForm.patchValue({
      name: holiday.name,
      startDate: holiday.startDate,
      endDate: holiday.endDate,
      businessLocation: holiday.businessLocation,
      note: holiday.note
    });
    this.showPopup = true;
  }

  deleteHoliday(id: string) {
    if (confirm('Are you sure you want to delete this holiday?')) {
      this.holidayService.deleteHoliday(id)
        .then(() => {
          this.loadHolidays();
        })
        .catch(error => {
          console.error('Error deleting holiday:', error);
        });
    }
  }

  closePopup() {
    this.showPopup = false;
    this.isEditMode = false;
    this.currentHolidayId = null;
    this.holidayForm.reset();
  }

  saveHoliday() {
    if (this.holidayForm.valid) {
      const holidayData = this.holidayForm.value;

      if (this.isEditMode && this.currentHolidayId) {
        this.holidayService.updateHoliday(this.currentHolidayId, holidayData)
          .then(() => {
            this.closePopup();
            this.loadHolidays();
          })
          .catch(error => {
            console.error('Error updating holiday:', error);
          });
      } else {
        this.holidayService.addHoliday(holidayData)
          .then(() => {
            this.closePopup();
            this.loadHolidays();
          })
          .catch(error => {
            console.error('Error adding holiday:', error);
          });
      }
    } else {
      alert('Please fill out all required fields');
    }
  }

  getLocationName(locationId: string): string {
    const location = this.locations.find(loc => loc.id === locationId);
    return location ? location.name : 'Unknown Location';
  }
}