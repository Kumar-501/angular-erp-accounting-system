import { Component, OnInit } from '@angular/core';
import { SellingPriceService } from '../services/selling-price.service';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-selling-price',
  templateUrl: './selling-price.component.html',
  styleUrls: ['./selling-price.component.scss']
})
export class SellingPriceComponent implements OnInit {
  sellingPriceGroups: any[] = [];
  filteredGroups: any[] = [];
  paginatedGroups: any[] = [];
  showForm = false;
  editMode = false;
  currentId: string | null = null;
  entriesPerPage = 3;
  searchTerm = '';
  currentPage = 1;
  totalPages = 1;
  startEntry = 0;
  endEntry = 0;
  sortColumn = '';
  sortDirection = 'asc'; // 'asc' or 'desc'

  sellingPrice = {
    name: '',
    description: ''
  };

  constructor(private sellingPriceService: SellingPriceService) {}

  ngOnInit() {
    // Subscribe to real-time selling price updates
    this.sellingPriceService.sellingPrice$.subscribe((data) => {
      this.sellingPriceGroups = data;
      this.filteredGroups = [...data];
      this.updatePagination();
    });
  }

  // Sort data by column
  sortData(column: string) {
    if (this.sortColumn === column) {
      // Reverse the sort direction if clicking the same column
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      // Set new column and default to ascending
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    
    this.filteredGroups.sort((a, b) => {
      const valueA = a[column].toLowerCase();
      const valueB = b[column].toLowerCase();
      
      if (valueA < valueB) {
        return this.sortDirection === 'asc' ? -1 : 1;
      }
      if (valueA > valueB) {
        return this.sortDirection === 'asc' ? 1 : -1;
      }
      return 0;
    });
    
    this.currentPage = 1;
    this.updatePagination();
  }

  // Filter data based on search term
  filterData() {
    if (!this.searchTerm) {
      this.filteredGroups = [...this.sellingPriceGroups];
    } else {
      const term = this.searchTerm.toLowerCase();
      this.filteredGroups = this.sellingPriceGroups.filter(group => 
        group.name.toLowerCase().includes(term) || 
        group.description.toLowerCase().includes(term)
      );
    }
    
    // Reapply sorting if any column is sorted
    if (this.sortColumn) {
      this.sortData(this.sortColumn);
    } else {
      this.currentPage = 1;
      this.updatePagination();
    }
  }

  // Update pagination when data or page size changes
  updatePagination() {
    this.totalPages = Math.ceil(this.filteredGroups.length / this.entriesPerPage);
    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages > 0 ? this.totalPages : 1;
    }
    
    const startIndex = (this.currentPage - 1) * this.entriesPerPage;
    const endIndex = startIndex + this.entriesPerPage;
    this.paginatedGroups = this.filteredGroups.slice(startIndex, endIndex);
    
    this.startEntry = this.filteredGroups.length > 0 ? startIndex + 1 : 0;
    this.endEntry = Math.min(endIndex, this.filteredGroups.length);
  }

  // Go to next page
  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePagination();
    }
  }

  // Go to previous page
  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePagination();
    }
  }

  // Open form for adding or editing a selling price group
  openForm(edit = false, priceGroup: any = null) {
    this.showForm = true;
    this.editMode = edit;
    if (edit && priceGroup) {
      this.sellingPrice = { ...priceGroup };
      this.currentId = priceGroup.id;
    } else {
      this.sellingPrice = { name: '', description: '' };
      this.currentId = null;
    }
  }

  // Close the form
  closeForm() {
    this.showForm = false;
  }

  // Save the selling price group (add or update)
  saveSellingPrice() {
    if (this.editMode && this.currentId) {
      this.sellingPriceService.updateSellingPrice(this.currentId, this.sellingPrice).then(() => {
        this.closeForm();
      });
    } else {
      this.sellingPriceService.addSellingPrice(this.sellingPrice).then(() => {
        this.closeForm();
      });
    }
  }

  // Delete a selling price group
  deleteSellingPrice(id: string) {
    if (confirm('Are you sure you want to delete this?')) {
      this.sellingPriceService.deleteSellingPrice(id);
    }
  }

  // Export data as CSV
  exportCSV(): void {
    const data = this.filteredGroups.map(group => ({
      Name: group.name,
      Description: group.description
    }));

    const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data);
    const csvOutput: string = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'selling-price-groups.csv');
  }

  // Export data as Excel
  exportExcel(): void {
    const data = this.filteredGroups.map(group => ({
      Name: group.name,
      Description: group.description
    }));

    const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data);
    const workbook: XLSX.WorkBook = {
      Sheets: { 'SellingPriceGroups': worksheet },
      SheetNames: ['SellingPriceGroups']
    };
    const excelBuffer: any = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    saveAs(blob, 'selling-price-groups.xlsx');
  }

  // Export data as PDF
  exportPDF(): void {
    const doc = new jsPDF();
    const data = this.filteredGroups.map(group => [group.name, group.description]);

    autoTable(doc, {
      head: [['Name', 'Description']],
      body: data
    });

    doc.save('selling-price-groups.pdf');
  }
}