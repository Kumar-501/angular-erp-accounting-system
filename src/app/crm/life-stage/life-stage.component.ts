import { Component, OnInit } from '@angular/core';
import { LifeStageService } from '../../services/life-stage.service';

@Component({
  selector: 'app-life-stage',
  templateUrl: './life-stage.component.html',
  styleUrls: ['./life-stage.component.scss']
})
export class LifeStageComponent implements OnInit {
  // Life stages data
  lifeStages: any[] = [];
  filteredLifeStages: any[] = [];
  paginatedLifeStages: any[] = [];
  
  // Pagination
  entriesPerPage: number = 25;
  currentPage: number = 1;
  totalPages: number = 1;
  startEntry: number = 0;
  endEntry: number = 0;
  totalEntries: number = 0;
  
  // Search
  searchText: string = '';
  
  // Sorting
  currentSortField: string = 'name';
  sortDirection: 'asc' | 'desc' = 'asc';
  
  // Modal flags
  showAddModal: boolean = false;
  showEditModal: boolean = false;
  showDeleteModal: boolean = false;
  showColumnModal: boolean = false;
  
  // Form models
  newLifeStage = {
    name: '',
    description: ''
  };
  
  editingLifeStage: any = null;
  stageToDelete: any = null;
  
  // Column visibility
  columns = {
    name: true,
    description: true,
    action: true
  };

  constructor(private lifeStageService: LifeStageService) {}

  ngOnInit(): void {
    this.loadLifeStages();
  }

  // Load life stages from Firestore
  loadLifeStages(): void {
    this.lifeStageService.getLifeStages().then(data => {
      this.lifeStages = data;
      this.applyFilter();
    }).catch(error => {
      console.error("Error fetching life stages: ", error);
    });
  }

  // Apply search filter and sorting
  applyFilter(): void {
    // Apply search filter
    if (this.searchText) {
      const searchLower = this.searchText.toLowerCase();
      this.filteredLifeStages = this.lifeStages.filter(stage => 
        stage.name.toLowerCase().includes(searchLower) || 
        stage.description.toLowerCase().includes(searchLower)
      );
    } else {
      this.filteredLifeStages = [...this.lifeStages];
    }
    
    // Apply sorting
    this.sortData();
    
    // Update pagination
    this.updatePagination();
  }

  // Sort data by field
  sortBy(field: string): void {
    if (this.currentSortField === field) {
      // Toggle sort direction
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.currentSortField = field;
      this.sortDirection = 'asc';
    }
    
    this.sortData();
    this.updatePagination();
  }

  // Sort the data
  sortData(): void {
    this.filteredLifeStages.sort((a, b) => {
      const valueA = a[this.currentSortField].toLowerCase();
      const valueB = b[this.currentSortField].toLowerCase();
      
      if (valueA < valueB) {
        return this.sortDirection === 'asc' ? -1 : 1;
      }
      if (valueA > valueB) {
        return this.sortDirection === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }

  // Update pagination
  updatePagination(): void {
    this.totalEntries = this.filteredLifeStages.length;
    this.totalPages = Math.ceil(this.totalEntries / this.entriesPerPage);
    
    // Ensure current page is valid
    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages || 1;
    }
    
    // Calculate visible entries range
    const startIndex = (this.currentPage - 1) * this.entriesPerPage;
    let endIndex = startIndex + this.entriesPerPage;
    
    if (endIndex > this.totalEntries) {
      endIndex = this.totalEntries;
    }
    
    this.startEntry = this.totalEntries > 0 ? startIndex + 1 : 0;
    this.endEntry = endIndex;
    
    // Get current page data
    this.paginatedLifeStages = this.filteredLifeStages.slice(startIndex, endIndex);
  }

  // Pagination navigation
  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePagination();
    }
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePagination();
    }
  }

  // Modal toggle functions
  toggleAddModal(): void {
    this.showAddModal = !this.showAddModal;
    if (!this.showAddModal) {
      this.resetForms();
    }
  }

  toggleEditModal(): void {
    this.showEditModal = !this.showEditModal;
    if (!this.showEditModal) {
      this.editingLifeStage = null;
    }
  }

  toggleDeleteModal(): void {
    this.showDeleteModal = !this.showDeleteModal;
    if (!this.showDeleteModal) {
      this.stageToDelete = null;
    }
  }

  toggleColumnModal(): void {
    this.showColumnModal = !this.showColumnModal;
  }

  // Add the missing method to fix the error
  toggleColumnVisibility(): void {
    this.showColumnModal = true;
  }

  // CRUD operations
  saveLifeStage(): void {
    if (this.newLifeStage.name && this.newLifeStage.description) {
      this.lifeStageService.addLifeStage({
        name: this.newLifeStage.name,
        description: this.newLifeStage.description
      }).then(() => {
        this.loadLifeStages();
        this.toggleAddModal();
      }).catch(error => {
        console.error("Error adding life stage: ", error);
        alert("Failed to add life stage. Please try again.");
      });
    } else {
      alert("Please fill in all required fields.");
    }
  }

  editLifeStage(stage: any): void {
    this.editingLifeStage = { ...stage };
    this.showEditModal = true;
  }

  updateLifeStage(): void {
    if (this.editingLifeStage && this.editingLifeStage.name && this.editingLifeStage.description) {
      const { id, ...updateData } = this.editingLifeStage;
      
      this.lifeStageService.updateLifeStage(id, updateData).then(() => {
        this.loadLifeStages();
        this.toggleEditModal();
      }).catch(error => {
        console.error("Error updating life stage: ", error);
        alert("Failed to update life stage. Please try again.");
      });
    } else {
      alert("Please fill in all required fields.");
    }
  }

  confirmDelete(stage: any): void {
    this.stageToDelete = stage;
    this.showDeleteModal = true;
  }

  deleteLifeStage(): void {
    if (this.stageToDelete && this.stageToDelete.id) {
      this.lifeStageService.deleteLifeStage(this.stageToDelete.id).then(() => {
        this.loadLifeStages();
        this.toggleDeleteModal();
      }).catch(error => {
        console.error("Error deleting life stage: ", error);
        alert("Failed to delete life stage. Please try again.");
      });
    }
  }

  // Export functions
  exportToCsv(): void {
    this.lifeStageService.exportToCsv(this.lifeStages);
  }

  exportToExcel(): void {
    this.lifeStageService.exportToExcel(this.lifeStages);
  }

  exportToPdf(): void {
    this.lifeStageService.exportToPdf(this.lifeStages);
  }
  
  print(): void {
    const printContent = document.createElement('div');
    printContent.innerHTML = `
      <h1>Life Stages</h1>
      <table border="1" cellpadding="10" cellspacing="0" style="border-collapse: collapse; width: 100%;">
        <thead>
          <tr>
            <th>Life Stage</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          ${this.lifeStages.map(stage => 
            `<tr>
              <td>${stage.name}</td>
              <td>${stage.description}</td>
            </tr>`
          ).join('')}
        </tbody>
      </table>
    `;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Life Stages</title>
            <style>
              body { font-family: Arial, sans-serif; }
              table { width: 100%; border-collapse: collapse; }
              th, td { padding: 8px; text-align: left; border: 1px solid #ddd; }
              th { background-color: #f2f2f2; }
              h1 { text-align: center; }
            </style>
          </head>
          <body>
            ${printContent.innerHTML}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    } else {
      alert('Please allow popups to use the print feature.');
    }
  }
  
  // Column visibility
  applyColumnVisibility(): void {
    this.toggleColumnModal();
    // No need to do anything else here since we're binding directly to the columns object
  }
  get visibleColumnsCount(): number {
    return Object.values(this.columns).filter(visible => visible).length;
  }
  toggleAllColumns(checked: boolean): void {
    this.columns = {
      name: checked,
      description: checked,
      action: checked
    };
  }
  get allColumnsVisible(): boolean {
    return this.columns.name && this.columns.description && this.columns.action;
  }
  
  // Reset forms
  resetForms(): void {
    this.newLifeStage = {
      name: '',
      description: ''
    };
  }
}