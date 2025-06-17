import { Component, OnInit } from '@angular/core';
import { TypeOfServiceService } from '../services/type-of-service.service';
import { LocationService } from '../services/location.service';

export interface Service {
  id?: string;
  name: string;
  description?: string;
  location?: string;
  priceGroup?: string;
  packingChargeType?: 'Fixed' | 'Variable';
  packingCharge?: number;
  enableCustomFields?: boolean;
  createdAt?: any;
  updatedAt?: any;
}

interface Location {
  id: string;
  name: string;
  // Add other location properties if needed
}

@Component({
  selector: 'app-type-of-service',
  templateUrl: './type-of-service.component.html',
  styleUrls: ['./type-of-service.component.scss']
})
export class TypeOfServiceComponent implements OnInit {
  services: Service[] = [];
  locations: Location[] = [];
  service: Service = {
    name: '',
    description: '',
    location: '',
    priceGroup: 'Default Selling Price',
    packingChargeType: 'Fixed',
    packingCharge: 0.00,
    enableCustomFields: false
  };
  
  openForm: boolean = false;
  isEdit: boolean = false;
  searchText: string = '';
  entriesPerPage: number = 25;
  currentPage: number = 1;
  
  // Add sort properties
  sortColumn: string = 'name';
  sortDirection: 'asc' | 'desc' = 'asc';
  
  Math = Math;
  
  constructor(
    private typeService: TypeOfServiceService,
    private locationService: LocationService
  ) {}
  
  ngOnInit(): void {
    this.loadServices();
    this.loadLocations();
  }
  
  loadServices(): void {
    this.typeService.getServicesRealtime().subscribe({
      next: (data) => {
        this.services = data;
      },
      error: (err: any) => {
        console.error('Error fetching services:', err);
      }
    });
  }
  
  loadLocations(): void {
    this.locationService.getLocations().subscribe({
      next: (locations: any[]) => {
        // Filter active locations if needed
        this.locations = locations.filter(loc => loc.active !== false);
        // Set default location if none is selected
        if (this.locations.length > 0 && !this.service.location) {
          this.service.location = this.locations[0].name;
        }
      },
      error: (err) => {
        console.error('Error fetching locations:', err);
      }
    });
  }
  
  saveService() {
    if (this.isEdit && this.service.id) {
      this.typeService.updateService(this.service.id, this.service).then(() => {
        this.closeForm();
      });
    } else {
      this.typeService.addService(this.service).then(() => {
        this.closeForm();
      });
    }
  }
  
  editService(service: Service) {
    this.service = { ...service };
    this.isEdit = true;
    this.openForm = true;
  }
  
  deleteService(id: string | undefined) {
    if (!id) {
      console.error('Cannot delete service: ID is undefined');
      return;
    }
    
    if (confirm('Are you sure you want to delete this service?')) {
      this.typeService.deleteService(id);
    }
  }
  
  addNewService() {
    this.service = {
      name: '',
      description: '',
      location: this.locations.length > 0 ? this.locations[0].name : '',
      priceGroup: 'Default Selling Price',
      packingChargeType: 'Fixed',
      packingCharge: 0.00,
      enableCustomFields: false
    };
    this.isEdit = false;
    this.openForm = true;
  }
  
  closeForm() {
    this.openForm = false;
    this.isEdit = false;
    this.service = {
      name: '',
      description: '',
      location: this.locations.length > 0 ? this.locations[0].name : '',
      priceGroup: 'Default Selling Price',
      packingChargeType: 'Fixed',
      packingCharge: 0.00,
      enableCustomFields: false
    };
  }
  
  filteredServices() {
    return this.services.filter(item =>
      item.name?.toLowerCase().includes(this.searchText.toLowerCase()) ||
      item.description?.toLowerCase().includes(this.searchText.toLowerCase())
    );
  }
  
  // Sort services by column
  sortBy(column: string): void {
    if (this.sortColumn === column) {
      // If already sorting by this column, toggle direction
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      // New column, default to ascending
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
  }
  
  get sortedServices(): Service[] {
    const filtered = this.filteredServices();
    
    return [...filtered].sort((a, b) => {
      let valueA: any = a[this.sortColumn as keyof Service];
      let valueB: any = b[this.sortColumn as keyof Service];
      
      // Handle null or undefined values
      if (valueA === null || valueA === undefined) valueA = '';
      if (valueB === null || valueB === undefined) valueB = '';
      
      // Convert to strings for comparison if they're not numbers
      if (typeof valueA !== 'number') valueA = String(valueA).toLowerCase();
      if (typeof valueB !== 'number') valueB = String(valueB).toLowerCase();
      
      if (valueA < valueB) {
        return this.sortDirection === 'asc' ? -1 : 1;
      }
      if (valueA > valueB) {
        return this.sortDirection === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }
  
  get totalPages(): number {
    return Math.ceil(this.filteredServices().length / this.entriesPerPage);
  }
  
  get paginatedServices(): Service[] {
    const startIndex = (this.currentPage - 1) * this.entriesPerPage;
    const endIndex = startIndex + this.entriesPerPage;
    return this.sortedServices.slice(startIndex, endIndex);
  }
  
  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }
  
  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }
  
  exportCSV(): void {
    console.log('Export CSV');
  }
  
  exportExcel(): void {
    console.log('Export Excel');
  }
  
  print(): void {
    console.log('Print');
  }
  
  toggleColumnVisibility(): void {
    console.log('Toggle column visibility');
  }
  
  exportPDF(): void {
    console.log('Export PDF');
  }
}