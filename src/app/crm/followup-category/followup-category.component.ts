import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { FollowupCategoryService, FollowupCategory } from '../../services/followup-category.service';

interface VisibleColumns {
  name: boolean;
  description: boolean;
  action: boolean;
}

interface ColumnOption {
  key: keyof VisibleColumns;
  label: string;
}

@Component({
  selector: 'app-followup-category',

  templateUrl: './followup-category.component.html',
  styleUrls: ['./followup-category.component.scss']
})
export class FollowupCategoryComponent implements OnInit, OnDestroy {
  // Subscription to handle real-time updates
  private categoriesSubscription?: Subscription;
  
  // Toggle form visibility
  showForm = false;
  showColumnVisibility = false;
  isEditing = false;
  isLoading = false;
  
  visibleColumns: VisibleColumns = {
    name: true,
    description: true,
    action: true
  };

  columnOptions: ColumnOption[] = [
    { key: 'name', label: 'Followup Category' },
    { key: 'description', label: 'Description' },
    { key: 'action', label: 'Action' }
  ];

  // Pagination properties
  currentPage = 1;
  pageSize = 25;
  sortField = 'name';
  sortDirection: 'asc' | 'desc' = 'asc';
  searchText = '';

  // Model for the followup category data
  followupCategory: FollowupCategory = {
    name: '',
    description: ''
  };

  // List of categories
  followupCategories: FollowupCategory[] = [];
  filteredCategories: FollowupCategory[] = [];

  constructor(private followupCategoryService: FollowupCategoryService) {}

  ngOnInit(): void {
    this.subscribeToCategories();
  }

  ngOnDestroy(): void {
    if (this.categoriesSubscription) {
      this.categoriesSubscription.unsubscribe();
    }
  }

  // Subscribe to real-time category updates
  private subscribeToCategories(): void {
    this.isLoading = true;
    this.categoriesSubscription = this.followupCategoryService.getFollowupCategories().subscribe({
      next: (categories) => {
        this.followupCategories = categories;
        this.filteredCategories = [...categories];
        this.applyFilter();
        this.sortData();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error fetching categories:', error);
        alert('Error loading categories. Please try again.');
        this.isLoading = false;
      }
    });
  }

  // Toggle form visibility
  toggleForm(): void {
    this.showForm = !this.showForm;
    if (!this.showForm) {
      this.resetForm();
    }
  }

  // Toggle column visibility menu
  toggleColumnVisibility(): void {
    this.showColumnVisibility = !this.showColumnVisibility;
  }

  // Save the follow-up category
  async onSave(): Promise<void> {
    if (!this.followupCategory.name?.trim() || !this.followupCategory.description?.trim()) {
      alert('Please fill in all required fields!');
      return;
    }

    try {
      this.isLoading = true;

      // Check for duplicate names
      const nameExists = await this.followupCategoryService.categoryNameExists(
        this.followupCategory.name.trim(), 
        this.isEditing ? this.followupCategory.id : undefined
      );

      if (nameExists) {
        alert('A category with this name already exists. Please choose a different name.');
        return;
      }

      if (this.isEditing && this.followupCategory.id) {
        await this.followupCategoryService.updateFollowupCategory({
          ...this.followupCategory,
          name: this.followupCategory.name.trim(),
          description: this.followupCategory.description.trim()
        });
        console.log('Category updated successfully!');
      } else {
        await this.followupCategoryService.addFollowupCategory({
          name: this.followupCategory.name.trim(),
          description: this.followupCategory.description.trim()
        });
        console.log('Category added successfully!');
      }
      
      this.resetForm();
      this.toggleForm();
    } catch (error) {
      console.error('Error saving category: ', error);
      alert('Error saving category. Please try again.');
    } finally {
      this.isLoading = false;
    }
  }

  // Edit category
  editCategory(category: FollowupCategory): void {
    this.isEditing = true;
    this.followupCategory = { ...category };
    this.toggleForm();
  }

  // Delete category
  async deleteCategory(category: FollowupCategory): Promise<void> {
    if (!confirm('Are you sure you want to delete this category?')) {
      return;
    }

    try {
      this.isLoading = true;
      if (category.id) {
        await this.followupCategoryService.deleteFollowupCategory(category.id);
        console.log('Category deleted successfully!');
      } else {
        console.error('Category ID is missing');
        alert('Error: Category ID is missing.');
      }
    } catch (error) {
      console.error('Error deleting category: ', error);
      alert('Error deleting category. Please try again.');
    } finally {
      this.isLoading = false;
    }
  }

  // Reset the form
  resetForm(): void {
    this.followupCategory = {
      name: '',
      description: ''
    };
    this.isEditing = false;
  }

  // Sorting functionality
  sort(field: keyof FollowupCategory): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }
    this.sortData();
  }

  sortData(): void {
    this.filteredCategories.sort((a, b) => {
      const valueA = (a[this.sortField as keyof FollowupCategory] as string)?.toLowerCase() || '';
      const valueB = (b[this.sortField as keyof FollowupCategory] as string)?.toLowerCase() || '';
      
      if (valueA < valueB) {
        return this.sortDirection === 'asc' ? -1 : 1;
      }
      if (valueA > valueB) {
        return this.sortDirection === 'asc' ? 1 : -1;
      }
      return 0;
    });
    this.currentPage = 1;
  }

  // Filtering functionality
  applyFilter(): void {
    if (!this.searchText) {
      this.filteredCategories = [...this.followupCategories];
    } else {
      const searchTextLower = this.searchText.toLowerCase();
      this.filteredCategories = this.followupCategories.filter(category => 
        category.name.toLowerCase().includes(searchTextLower) || 
        (category.description && category.description.toLowerCase().includes(searchTextLower))
      );
    }
    this.currentPage = 1;
    this.sortData();
  }

  // Pagination methods
  getPaginatedData(): FollowupCategory[] {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    return this.filteredCategories.slice(startIndex, startIndex + this.pageSize);
  }

  getStartIndex(): number {
    return Math.min((this.currentPage - 1) * this.pageSize + 1, this.filteredCategories.length);
  }

  getEndIndex(): number {
    const endIndex = this.currentPage * this.pageSize;
    return Math.min(endIndex, this.filteredCategories.length);
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  nextPage(): void {
    if (this.currentPage * this.pageSize < this.filteredCategories.length) {
      this.currentPage++;
    }
  }

  onPageSizeChange(): void {
    this.currentPage = 1;
  }

  getVisibleColumnCount(): number {
    return Object.values(this.visibleColumns).filter(val => val).length;
  }

  // Export to CSV
  exportToCSV(): void {
    const headers: string[] = [];
    const dataKeys: (keyof FollowupCategory)[] = [];
    
    if (this.visibleColumns.name) {
      headers.push('Followup Category');
      dataKeys.push('name');
    }
    if (this.visibleColumns.description) {
      headers.push('Description');
      dataKeys.push('description');
    }

    const csvData = this.filteredCategories.map(category => 
      dataKeys.map(key => `"${category[key] || ''}"`)
    );

    const csvContent = [headers.map(h => `"${h}"`), ...csvData].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', 'followup_categories.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // Print functionality
  print(): void {
    const printContent = document.createElement('div');
    
    let tableHeaders = '<tr>';
    if (this.visibleColumns.name) tableHeaders += '<th style="padding: 8px; text-align: left; background-color: #f2f2f2; border: 1px solid #ddd;">Followup Category</th>';
    if (this.visibleColumns.description) tableHeaders += '<th style="padding: 8px; text-align: left; background-color: #f2f2f2; border: 1px solid #ddd;">Description</th>';
    tableHeaders += '</tr>';

    const tableRows = this.filteredCategories.map(category => {
      let row = '<tr>';
      if (this.visibleColumns.name) row += `<td style="padding: 8px; border: 1px solid #ddd;">${category.name}</td>`;
      if (this.visibleColumns.description) row += `<td style="padding: 8px; border: 1px solid #ddd;">${category.description}</td>`;
      row += '</tr>';
      return row;
    }).join('');

    printContent.innerHTML = `
      <h1 style="text-align: center; margin-bottom: 20px;">Followup Categories</h1>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>${tableHeaders}</thead>
        <tbody>${tableRows}</tbody>
      </table>
      <div style="margin-top: 20px; text-align: right; font-size: 12px;">
        Printed on ${new Date().toLocaleString()}
      </div>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Followup Categories</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              @media print { 
                @page { size: auto; margin: 10mm; }
                body { margin: 0; }
              }
            </style>
          </head>
          <body>${printContent.innerHTML}</body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    } else {
      alert('Please allow popups to use the print feature.');
    }
  }

  // Clear all data (for testing purposes)
  async clearAllData(): Promise<void> {
    if (confirm('Are you sure you want to delete ALL categories? This action cannot be undone.')) {
      try {
        this.isLoading = true;
        await this.followupCategoryService.clearAllCategories();
        console.log('All categories cleared successfully!');
      } catch (error) {
        console.error('Error clearing categories:', error);
        alert('Error clearing categories. Please try again.');
      } finally {
        this.isLoading = false;
      }
    }
  }
}