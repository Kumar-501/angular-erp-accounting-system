import { Component, OnInit } from '@angular/core';
import { CategoriesService } from '../services/categories.service';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-categories',
  templateUrl: './categories.component.html',
  styleUrls: ['./categories.component.scss']
})
export class CategoriesComponent implements OnInit {
  categories: any[] = [];
  filteredCategories: any[] = [];
  category = {
    name: '',
    code: '',
    description: '',
    parentCategory: '',
    isSubCategory: false
  };
  showPopup = false;
  isEditing = false;
  editId: string | null = null;
  
  math = Math;
  
  currentPage = 1;
  itemsPerPage = 3;
  totalPages = 1;
  searchTerm = '';
  displayEntries = [3, 25, 50, 100];
  selectedEntries = 3;

  constructor(private categoriesService: CategoriesService) {}

  ngOnInit() {
    this.loadCategories();
  }
  
 

// categories.component.ts
get availableParentCategories() {
  if (!this.category.isSubCategory) {
    return [];
  }
  
  if (!this.isEditing) {
    return this.categories;
  }
  
  return this.categories.filter(cat => cat.id !== this.editId);
}
  loadCategories() {
    this.categoriesService.categories$.subscribe(data => {
      this.categories = data;
      this.applyFilters();
      this.calculateTotalPages();
    });
  }

  applyFilters() {
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      this.filteredCategories = this.categories.filter(item => 
        item.name.toLowerCase().includes(term) || 
        (item.code && item.code.toLowerCase().includes(term)) || 
        (item.description && item.description.toLowerCase().includes(term))
      );
    } else {
      this.filteredCategories = [...this.categories];
    }
    this.calculateTotalPages();
  }

  calculateTotalPages() {
    this.totalPages = Math.ceil(this.filteredCategories.length / this.itemsPerPage);
    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages || 1;
    }
  }

  getCurrentPageItems() {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = Math.min(startIndex + this.itemsPerPage, this.filteredCategories.length);
    return this.filteredCategories.slice(startIndex, endIndex);
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  changeItemsPerPage(entries: number) {
    this.itemsPerPage = entries;
    this.selectedEntries = entries;
    this.currentPage = 1;
    this.calculateTotalPages();
  }

  search(event: any) {
    this.searchTerm = event.target.value;
    this.currentPage = 1;
    this.applyFilters();
  }

  addCategory() {
    if (!this.category.name || !this.category.description) {
      alert('Please fill in all required fields');
      return;
    }

    const categoryData: any = {
      name: this.category.name,
      code: this.category.code,
      description: this.category.description
    };

    // Only add parentCategory if it's a subcategory
    if (this.category.isSubCategory) {
      if (!this.category.parentCategory) {
        alert('Please select a parent category for subcategory');
        return;
      }
      categoryData.parentCategory = this.category.parentCategory;
    }

    if (this.isEditing && this.editId) {
      this.categoriesService.updateCategory(this.editId, categoryData).then(() => {
        alert('Category updated successfully!');
        this.resetForm();
      });
    } else {
      this.categoriesService.addCategory(categoryData).then(() => {
        alert('Category added successfully!');
        this.resetForm();
      });
    }
  }
  editCategory(category: any) {
    this.category = { 
      name: category.name,
      code: category.code,
      description: category.description,
      isSubCategory: !!category.parentCategory,
      parentCategory: category.parentCategory || ''
    };
    this.editId = category.id;
    this.isEditing = true;
    this.showPopup = true;
  }


  deleteCategory(id: string) {
    if (confirm('Are you sure you want to delete this category?')) {
      this.categoriesService.deleteCategory(id).then(() => {
        alert('Category deleted successfully!');
      }).catch(error => {
        alert('Error deleting category: ' + error.message);
      });
    }
  }

  resetForm() {
    this.category = {
      name: '',
      code: '',
      description: '',
      parentCategory: '',
      isSubCategory: false
    };
    this.isEditing = false;
    this.editId = null;
    this.showPopup = false;
  }

  getPaginationArray() {
    const pages: (number | string)[] = [];
    const maxVisiblePages = 5;
    
    if (this.totalPages <= maxVisiblePages) {
      for (let i = 1; i <= this.totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      
      let startPage = Math.max(2, this.currentPage - 1);
      let endPage = Math.min(this.totalPages - 1, this.currentPage + 1);
      
      if (this.currentPage <= 3) {
        endPage = Math.min(4, this.totalPages - 1);
      }
      
      if (this.currentPage >= this.totalPages - 2) {
        startPage = Math.max(2, this.totalPages - 3);
      }
      
      if (startPage > 2) {
        pages.push('...');
      }
      
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
      
      if (endPage < this.totalPages - 1) {
        pages.push('...');
      }
      
      pages.push(this.totalPages);
    }
    
    return pages;
  }
  // Export to CSV
exportToCSV() {
  const data = this.categories.map(cat => ({
    Name: cat.name,
    Code: cat.code || '',
    Description: cat.description || '',
    'Is Sub Category': cat.parentCategory ? 'Yes' : 'No',
    'Parent Category': this.getCategoryNameById(cat.parentCategory)
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
  const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, 'categories.csv');
}
// Export to Excel
exportToExcel() {
  const data = this.categories.map(cat => ({
    Name: cat.name,
    Code: cat.code || '',
    Description: cat.description || '',
    'Is Sub Category': cat.parentCategory ? 'Yes' : 'No',
    'Parent Category': this.getCategoryNameById(cat.parentCategory)
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = { Sheets: { 'Categories': worksheet }, SheetNames: ['Categories'] };
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, 'categories.xlsx');
}
// Export to PDF
exportToPDF() {
  const doc = new jsPDF();
  const tableData = this.categories.map(cat => [
    cat.name,
    cat.code || '',
    cat.description || '',
    cat.parentCategory ? 'Yes' : 'No',
    this.getCategoryNameById(cat.parentCategory)
  ]);

  autoTable(doc, {
    head: [['Name', 'Code', 'Description', 'Is Sub Category', 'Parent Category']],
    body: tableData
  });

  doc.save('categories.pdf');
}
// Print
print() {
  const printableContent = this.categories.map(cat => `
    Name: ${cat.name}
    Code: ${cat.code || '-'}
    Description: ${cat.description || '-'}
    Is Sub Category: ${cat.parentCategory ? 'Yes' : 'No'}
    Parent Category: ${this.getCategoryNameById(cat.parentCategory) || '-'}
  `).join('\n\n');

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write('<pre>' + printableContent + '</pre>');
    printWindow.document.close();
    printWindow.print();
  }
}

// Helper: Get category name from ID
getCategoryNameById(id: string): string {
  const match = this.categories.find(cat => cat.id === id);
  return match ? match.name : '';
}

}