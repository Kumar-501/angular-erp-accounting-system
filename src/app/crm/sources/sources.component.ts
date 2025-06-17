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
// Toggle column visibility dropdown
toggleColumnVisibility(event: Event): void {
  event.stopPropagation();
  this.showColumnVisibility = !this.showColumnVisibility;
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

  // Save the new source to Firestore
  onSave(): void {
    if (this.source.name && this.source.description) {
      if (this.isEditMode) {
        this.sourceService.updateSource(this.source.id, {
          name: this.source.name,
          description: this.source.description
        }).then(() => {
          console.log('Source updated!');
          this.loadSources();  // Reload the sources after updating
          this.resetForm();  // Reset the form after saving
          this.toggleForm();  // Close the form
        }).catch((error) => {
          console.error('Error updating source: ', error);
        });
      } else {
        this.sourceService.addSource({
          name: this.source.name,
          description: this.source.description
        }).then(() => {
          console.log('Source added!');
          this.loadSources();  // Reload the sources after adding a new one
          this.resetForm();  // Reset the form after saving
          this.toggleForm();  // Close the form
        }).catch((error) => {
          console.error('Error adding source: ', error);
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