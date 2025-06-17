import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { VariationsService, Variation } from '../services/variations.service';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-variations',
  templateUrl: './variations.component.html',
  styleUrls: ['./variations.component.scss']
})
export class VariationsComponent implements OnInit {
  variations: Variation[] = [];
  filteredVariations: Variation[] = [];
  newVariation = { id: '', name: '', values: '' };
  isLoading = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  showAddForm = false;
  isEditing = false;
  math = Math;
  searchQuery = '';
  
  // Pagination properties
  currentPage = 1;
  itemsPerPage = 3;
  totalItems = 0;
  
  // Sorting properties
  sortColumn: string = 'name';
  sortDirection: 'asc' | 'desc' = 'asc';

  constructor(
    private variationsService: VariationsService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadVariations();
  }

  toggleAddForm(): void {
    this.showAddForm = !this.showAddForm;
    if (!this.showAddForm) {
      this.resetForm();
    }
  }

  resetForm(): void {
    this.newVariation = { id: '', name: '', values: '' };
    this.isEditing = false;
  }

  loadVariations(): void {
    this.isLoading = true;
    this.errorMessage = null;
    
    this.variationsService.getVariations().subscribe({
      next: (data) => {
        this.variations = data;
        this.applyFilters();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error:', error);
        this.errorMessage = error.message || 'Failed to load variations';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  // Search and filter methods
  applySearch(query: string): void {
    this.searchQuery = query;
    this.applyFilters();
    this.currentPage = 1; // Reset to first page when searching
  }

  private applyFilters(): void {
    // Apply search filter
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      this.filteredVariations = this.variations.filter(variation => 
        variation.name.toLowerCase().includes(query) || 
        variation.values.some(value => value.toLowerCase().includes(query))
      );
    } else {
      this.filteredVariations = [...this.variations];
    }

    // Apply sorting
    this.sortVariations();
    
    // Update total items count
    this.totalItems = this.filteredVariations.length;
  }

  // Sorting methods
  sortBy(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.sortVariations();
  }

  private sortVariations(): void {
    this.filteredVariations.sort((a, b) => {
      const valA = this.sortColumn === 'name' ? a.name.toLowerCase() : '';
      const valB = this.sortColumn === 'name' ? b.name.toLowerCase() : '';
      
      if (valA < valB) return this.sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return this.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  // Pagination methods
  get paginatedVariations(): Variation[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredVariations.slice(startIndex, startIndex + this.itemsPerPage);
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  get totalPages(): number {
    return Math.ceil(this.totalItems / this.itemsPerPage);
  }

  setPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  onItemsPerPageChange(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    this.itemsPerPage = Number(selectElement.value);
    this.currentPage = 1;
  }

  getPageNumbers(): number[] {
    const maxVisiblePages = 5;
    const pages = [];
    let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
    const endPage = Math.min(this.totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    
    return pages;
  }

  // CRUD operations
  editVariation(variation: Variation): void {
    this.isEditing = true;
    this.newVariation = {
      id: variation.id,
      name: variation.name,
      values: variation.values.join(', ')
    };
    this.showAddForm = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  saveVariation(): Promise<void> {
    if (this.isEditing) {
      return this.updateVariation();
    } else {
      return this.addVariation();
    }
  }

  async addVariation(): Promise<void> {
    if (!this.newVariation.name.trim() || !this.newVariation.values.trim()) {
      this.errorMessage = 'Please enter both name and values';
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;
    
    try {
      await this.variationsService.addVariation({
        name: this.newVariation.name.trim(),
        values: this.newVariation.values.split(',').map(v => v.trim())
      });
      this.successMessage = 'Variation added successfully!';
      this.resetForm();
      this.showAddForm = false;
      setTimeout(() => this.loadVariations(), 500);
    } catch (error) {
      console.error('Error:', error);
      this.errorMessage = 'Failed to add variation';
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  async updateVariation(): Promise<void> {
    if (!this.newVariation.name.trim() || !this.newVariation.values.trim()) {
      this.errorMessage = 'Please enter both name and values';
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;
    
    try {
      await this.variationsService.updateVariation(this.newVariation.id, {
        name: this.newVariation.name.trim(),
        values: this.newVariation.values.split(',').map(v => v.trim())
      });
      this.successMessage = 'Variation updated successfully!';
      this.resetForm();
      this.showAddForm = false;
      setTimeout(() => this.loadVariations(), 500);
    } catch (error) {
      console.error('Error:', error);
      this.errorMessage = 'Failed to update variation';
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }
  exportCSV(): void {
    const data = this.filteredVariations.map(v => ({
      Name: v.name,
      Values: v.values.join(', ')
    }));
  
    const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data);
    const workbook: XLSX.WorkBook = { Sheets: { data: worksheet }, SheetNames: ['data'] };
    const excelBuffer: any = XLSX.write(workbook, { bookType: 'csv', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'variations.csv');
  }
  
  exportExcel(): void {
    const data = this.filteredVariations.map(v => ({
      Name: v.name,
      Values: v.values.join(', ')
    }));
  
    const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data);
    const workbook: XLSX.WorkBook = { Sheets: { data: worksheet }, SheetNames: ['data'] };
    const excelBuffer: any = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, 'variations.xlsx');
  }
  
  printTable(): void {
    const printContents = document.querySelector('.table-responsive')?.innerHTML;
    const popupWin = window.open('', '_blank', 'width=800,height=600');
    popupWin?.document.open();
    popupWin?.document.write(`
      <html>
        <head>
          <title>Print Table</title>
          <style>
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
            th { background: #f2f2f2; }
          </style>
        </head>
        <body onload="window.print();window.close()">
          <h3>Product Variations</h3>
          ${printContents}
        </body>
      </html>
    `);
    popupWin?.document.close();
  }
  
  exportPDF(): void {
    const doc = new jsPDF();
    const data = this.filteredVariations.map(v => [v.name, v.values.join(', ')]);
    autoTable(doc, {
      head: [['Variation Name', 'Values']],
      body: data
    });
    doc.save('variations.pdf');
  }
  
  async deleteVariation(id: string): Promise<void> {
    if (!confirm('Are you sure you want to delete this variation?')) return;

    this.isLoading = true;
    try {
      await this.variationsService.deleteVariation(id);
      this.successMessage = 'Variation deleted successfully!';
      setTimeout(() => this.loadVariations(), 500);
    } catch (error) {
      console.error('Error:', error);
      this.errorMessage = 'Failed to delete variation';
      this.isLoading = false;
    }
  }

  dismissAlert(): void {
    this.errorMessage = null;
    this.successMessage = null;
  }
}