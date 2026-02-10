import { Component, OnInit } from '@angular/core';
import { SourceService } from '../../services/source.service';

@Component({
  selector: 'app-sources',
  templateUrl: './sources.component.html',
  styleUrls: ['./sources.component.scss']
})
export class SourcesComponent implements OnInit {
  // To toggle form visibility
  showForm = false;
  currentPage = 1;
itemsPerPage = 10; // Number of items to show per page
totalPages = 1;
paginatedSources: any[] = [];
  isSaving = false; // Add this to your component class
// Add these properties for column visibility
showColumnVisibility = false;
columns = [
  { name: 'Source', visible: true, property: 'name' },
  { name: 'Description', visible: true, property: 'description' },
  { name: 'Actions', visible: true, property: 'actions' }
];
  // Model for the source data
  source = {
    id: '',
    name: '',
    description: ''
  };

  // List of sources fetched from Firestore
  sources: any[] = [];
  
  // Filtered sources for search functionality
  filteredSources: any[] = [];
  
  // Search text
  searchText: string = '';

  // Edit mode flag
  isEditMode = false;

  constructor(private sourceService: SourceService) {}

  ngOnInit(): void {
    this.loadSources(); // Load sources when the component is initialized
  }

  // Toggle the form visibility
  toggleForm(): void {
    this.showForm = !this.showForm;
    if (this.showForm === false) {
      this.resetForm();
    }
  }

  // Load all sources from Firestore
  loadSources(): void {
    this.sourceService.getSources().then(data => {
      this.sources = data; // Store the fetched data in the sources array
      this.filteredSources = [...this.sources]; // Initialize filtered sources with all sources
    }).catch(error => {
      console.error("Error fetching sources: ", error);
    });
  }
  
nextPage(): void {
  if (this.currentPage < this.totalPages) {
    this.currentPage++;
    this.updatePaginatedSources();
  }
}

updatePaginatedSources(): void {
  const startIndex = (this.currentPage - 1) * this.itemsPerPage;
  const endIndex = startIndex + this.itemsPerPage;
  this.paginatedSources = this.filteredSources.slice(startIndex, endIndex);
}
prevPage(): void {
  if (this.currentPage > 1) {
    this.currentPage--;
    this.updatePaginatedSources();
  }
}
// Toggle column visibility dropdown
toggleColumnVisibility(event: Event): void {
  event.stopPropagation();
  this.showColumnVisibility = !this.showColumnVisibility;
  }
  calculatePagination(): void {
  this.totalPages = Math.ceil(this.filteredSources.length / this.itemsPerPage);
  this.currentPage = Math.min(this.currentPage, this.totalPages || 1);
  this.updatePaginatedSources();
}


// Update visible columns
updateVisibleColumns(): void {
  // This method is called when checkbox state changes
  // No need to do anything special as the *ngIf directives handle visibility
}

  // Filter sources based on search text
  filterSources(): void {
    if (!this.searchText) {
      this.filteredSources = [...this.sources];
      return;
    }
    
    const searchTerm = this.searchText.toLowerCase();
    this.filteredSources = this.sources.filter(source => 
      source.name.toLowerCase().includes(searchTerm) || 
      source.description.toLowerCase().includes(searchTerm)
    );
  }
onSave(): void {
  // Prevent multiple saves
  if (this.isSaving) return;
  
  if (this.source.name && this.source.description) {
    this.isSaving = true; // Disable the button
    
    if (this.isEditMode) {
      this.sourceService.updateSource(this.source.id, {
        name: this.source.name,
        description: this.source.description
      }).then(() => {
        console.log('Source updated!');
        this.loadSources();
        this.resetForm();
        this.toggleForm();
      }).catch((error) => {
        console.error('Error updating source: ', error);
      }).finally(() => {
        this.isSaving = false; // Re-enable the button
      });
    } else {
      this.sourceService.addSource({
        name: this.source.name,
        description: this.source.description
      }).then(() => {
        console.log('Source added!');
        this.loadSources();
        this.resetForm();
        this.toggleForm();
      }).catch((error) => {
        console.error('Error adding source: ', error);
      }).finally(() => {
        this.isSaving = false; // Re-enable the button
      });
    }
  } else {
    alert('Please fill in all fields!');
  }
}

  // Edit a source
  onEdit(source: any): void {
    this.isEditMode = true;
    this.source = { ...source };
    this.showForm = true;
  }

  // Delete a source
  onDelete(id: string): void {
    this.sourceService.deleteSource(id).then(() => {
      console.log('Source deleted!');
      this.loadSources();  // Reload the sources after deleting
    }).catch((error) => {
      console.error('Error deleting source: ', error);
    });
  }

  // Reset the form after saving data
  resetForm(): void {
    this.source = {
      id: '',
      name: '',
      description: ''
    };
    this.isEditMode = false;
  }
}