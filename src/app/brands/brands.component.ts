import { Component, OnInit } from '@angular/core';
import { BrandsService, Brand } from '../services/brands.service';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-brands',
  templateUrl: './brands.component.html',
  styleUrls: ['./brands.component.scss']
})
export class BrandsComponent implements OnInit {
  brands: Brand[] = [];
  filteredBrands: Brand[] = [];
  isDeleting: boolean = false;

  showPopup = false;
  // In your component class
isSaving: boolean = false;
  isEditing = false;
  brand: Brand = { id: '', name: '', description: '' };
  
  // Pagination
  entriesPerPage: number = 3;
  currentPage: number = 1;
  totalEntries: number = 0;
  totalPages: number = 1;
  startEntry: number = 1;
  endEntry: number = 0;
  
  // Search
  searchTerm: string = '';

  // Sorting
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  constructor(private brandsService: BrandsService) {}

  ngOnInit() {
    this.loadBrands();
  }

  loadBrands() {
    this.brandsService.brands$.subscribe(data => {
      this.brands = data;
      this.totalEntries = this.brands.length;
      this.applyFilters();
    });
  }

  sortData(column: string) {
    if (this.sortColumn === column) {
      // Reverse the sort direction if clicking the same column
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      // Set new column and default to ascending
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    
    this.applyFilters();
  }

  applyFilters() {
    // Apply search filter
    let filtered = this.brands;
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(brand => 
        brand.name.toLowerCase().includes(term) || 
        (brand.description && brand.description.toLowerCase().includes(term))
      );
    }
    
    // Apply sorting
    if (this.sortColumn) {
      filtered = [...filtered].sort((a, b) => {
        const valueA = (a[this.sortColumn as keyof Brand] || '').toString().toLowerCase();
        const valueB = (b[this.sortColumn as keyof Brand] || '').toString().toLowerCase();
        
        if (valueA < valueB) {
          return this.sortDirection === 'asc' ? -1 : 1;
        }
        if (valueA > valueB) {
          return this.sortDirection === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    
    // Calculate pagination
    this.totalEntries = filtered.length;
    this.totalPages = Math.ceil(this.totalEntries / this.entriesPerPage);
    
    // Ensure current page is valid
    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages || 1;
    }
    
    // Apply pagination
    const start = (this.currentPage - 1) * this.entriesPerPage;
    const end = Math.min(start + this.entriesPerPage, this.totalEntries);
    this.startEntry = start + 1;
    this.endEntry = end;
    
    // Get page data
    this.filteredBrands = filtered.slice(start, end);
  }

  onSearchChange() {
    this.currentPage = 1; // Reset to first page when searching
    this.applyFilters();
  }

  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.applyFilters();
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.applyFilters();
    }
  }

addOrUpdateBrand() {
  if (this.isSaving) return; // Prevent multiple clicks
  
  if (!this.brand.name) {
    alert('Brand name is required');
    return;
  }

  this.isSaving = true;

  const saveOperation = this.isEditing && this.brand.id
    ? this.brandsService.updateBrand(this.brand.id, {
        name: this.brand.name,
        description: this.brand.description
      })
    : this.brandsService.addBrand({
        name: this.brand.name,
        description: this.brand.description
      });

  saveOperation.then(() => {
    const message = this.isEditing ? 'Brand updated successfully!' : 'Brand added successfully!';
    alert(message);
    this.closePopup();
    this.loadBrands();
  }).catch(error => {
    console.error('Error saving brand', error);
    alert('Error saving brand. Please try again.');
  }).finally(() => {
    this.isSaving = false;
  });
}

  editBrand(brand: Brand) {
    if (brand.id) {
      this.brand = { ...brand };
      this.isEditing = true;
      this.showPopup = true;
    }
  }

deleteBrand(id: string | undefined) {
  if (this.isDeleting || !id) return;
  
  if (!confirm('Are you sure you want to delete this brand?')) return;

  this.isDeleting = true;
  this.brandsService.deleteBrand(id).then(() => {
    alert('Brand deleted successfully!');
    this.loadBrands();
  }).catch(error => {
    console.error('Error deleting brand', error);
    alert('Error deleting brand. Please try again.');
  }).finally(() => {
    this.isDeleting = false;
  });
}
  openPopup() {
    this.brand = { id: '', name: '', description: '' };
    this.isEditing = false;
    this.showPopup = true;
  }

  closePopup() {
    this.showPopup = false;
  }

  exportCSV() {
    const headers = ['Brand Name', 'Description'];
    const csvContent = [
      headers.join(','),
      ...this.brands.map(brand => 
        `"${brand.name.replace(/"/g, '""')}","${brand.description?.replace(/"/g, '""') || ''}"`
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', 'brands.csv');
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  exportExcel() {
    const worksheetData = this.brands.map(brand => ({
      'Brand Name': brand.name,
      'Description': brand.description || ''
    }));
  
    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Brands');
  
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
  
    saveAs(blob, 'brands.xlsx');
  }

  print() {
    const printContent = document.getElementById('print-section');
    const WindowPrt = window.open('', '', 'left=0,top=0,width=900,height=900,toolbar=0,scrollbars=0,status=0');
    WindowPrt?.document.write(printContent?.innerHTML || '');
    WindowPrt?.document.close();
    WindowPrt?.focus();
    WindowPrt?.print();
    WindowPrt?.close();
  }

  exportPDF() {
    const doc = new jsPDF();
    const tableData = this.brands.map(brand => [
      brand.name,
      brand.description || ''
    ]);
  
    autoTable(doc, {
      head: [['Brand Name', 'Description']],
      body: tableData
    });
  
    doc.save('brands.pdf');
  }
}