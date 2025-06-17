import { Component, OnInit } from '@angular/core';
import { WarrantiesService } from '../services/warranties.service';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-warranties',
  templateUrl: './warranties.component.html',
  styleUrls: ['./warranties.component.scss']
})
export class WarrantiesComponent implements OnInit {
  warranty = { 
    productName: '', 
    description: '', 
    durationValue: null as number | null,
    durationUnit: ''
  };
  
  warranties: any[] = [];
  filteredWarranties: any[] = [];
  displayedWarranties: any[] = [];
  isModalOpen: boolean = false;
  selectedWarrantyId: string | null = null;
  searchText: string = '';
  
  // Pagination - Changed to show 3 entries per page
  currentPage: number = 1;
  entriesPerPage: number = 3;
  totalPages: number = 1;

  constructor(private warrantyService: WarrantiesService) {}

  ngOnInit() {
    this.loadWarranties();
  }

  loadWarranties() {
    this.warrantyService.warranties$.subscribe(data => {
      this.warranties = data;
      this.applyFilter();
    });
  }

  applyFilter() {
    if (!this.searchText) {
      this.filteredWarranties = [...this.warranties];
    } else {
      const searchLower = this.searchText.toLowerCase();
      this.filteredWarranties = this.warranties.filter(item => 
        item.productName.toLowerCase().includes(searchLower) ||
        (item.description && item.description.toLowerCase().includes(searchLower)) ||
        item.durationUnit.toLowerCase().includes(searchLower)
      );
    }
    this.currentPage = 1;
    this.updatePagination();
  }

  updatePagination() {
    this.totalPages = Math.ceil(this.filteredWarranties.length / this.entriesPerPage) || 1;
    
    // Ensure current page is within valid range
    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages;
    }
    
    const startIndex = (this.currentPage - 1) * this.entriesPerPage;
    const endIndex = startIndex + this.entriesPerPage;
    this.displayedWarranties = this.filteredWarranties.slice(startIndex, endIndex);
  }

  get showingStart(): number {
    return (this.currentPage - 1) * this.entriesPerPage + 1;
  }

  get showingEnd(): number {
    return Math.min(this.currentPage * this.entriesPerPage, this.filteredWarranties.length);
  }

  onEntriesChange() {
    this.currentPage = 1;
    this.updatePagination();
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePagination();
    }
  }

  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePagination();
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePagination();
    }
  }

  openModal(warrantyId?: string) {
    if (warrantyId) {
      this.selectedWarrantyId = warrantyId;
      const warranty = this.warranties.find(w => w.id === warrantyId);
      if (warranty) {
        this.warranty = { 
          productName: warranty.productName, 
          description: warranty.description, 
          durationValue: warranty.durationValue,
          durationUnit: warranty.durationUnit
        };
      }
    } else {
      this.selectedWarrantyId = null;
      this.warranty = { 
        productName: '', 
        description: '', 
        durationValue: null,
        durationUnit: ''
      };
    }
    this.isModalOpen = true;
  }

  closeModal() {
    this.isModalOpen = false;
  }

  async saveWarranty() {
    try {
      if (this.selectedWarrantyId) {
        await this.warrantyService.updateWarranty(this.selectedWarrantyId, this.warranty);
      } else {
        await this.warrantyService.addWarranty(this.warranty);
      }
      this.closeModal();
      this.loadWarranties(); // Refresh data
    } catch (error) {
      console.error('Error saving warranty:', error);
      alert('Error saving warranty. Please try again.');
    }
  }

  async deleteWarranty(id: string) {
    if (confirm('Are you sure you want to delete this warranty?')) {
      try {
        await this.warrantyService.deleteWarranty(id);
        this.loadWarranties(); // Refresh data
      } catch (error) {
        console.error('Error deleting warranty:', error);
        alert('Error deleting warranty. Please try again.');
      }
    }
  }

  exportToCSV() {
    const headers = ['Product Name', 'Description', 'Duration'];
    const csvContent = [
      headers.join(','),
      ...this.filteredWarranties.map(item => 
        `"${item.productName.replace(/"/g, '""')}","${item.description?.replace(/"/g, '""') || ''}","${item.durationValue} ${item.durationUnit}"`
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', 'warranties.csv');
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  exportToExcel() {
    const worksheetData = this.filteredWarranties.map(item => ({
      'Product Name': item.productName,
      'Description': item.description || '',
      'Duration': `${item.durationValue} ${item.durationUnit}`
    }));
  
    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Warranties');
  
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
  
    saveAs(blob, 'warranties.xlsx');
  }

  printTable() {
    const printContent = document.getElementById('print-section');
    const WindowPrt = window.open('', '', 'left=0,top=0,width=900,height=900,toolbar=0,scrollbars=0,status=0');
    WindowPrt?.document.write(printContent?.innerHTML || '');
    WindowPrt?.document.close();
    WindowPrt?.focus();
    WindowPrt?.print();
    WindowPrt?.close();
  }
  
  exportToPDF() {
    const doc = new jsPDF();
    const headers = [['Product Name', 'Description', 'Duration']];
    const data = this.filteredWarranties.map(item => [
      item.productName,
      item.description || '',
      `${item.durationValue} ${item.durationUnit}`
    ]);
  
    autoTable(doc, {
      head: headers,
      body: data,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [41, 128, 185] }
    });
  
    doc.save('warranties.pdf');
  }
}