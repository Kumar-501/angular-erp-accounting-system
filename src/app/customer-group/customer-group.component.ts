import { Component, OnInit } from '@angular/core';
import { CustomerGroupService } from '../services/customer-group.service';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import saveAs from 'file-saver';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-customer-group',
  templateUrl: './customer-group.component.html',
  styleUrls: ['./customer-group.component.scss']
})
export class CustomerGroupComponent implements OnInit {
  showForm: boolean = false;
  customerGroupName: string = '';
  priceCalculationType: string = 'percentage';
  calculationPercentage: number | null = null;
  sellingPriceGroup: string = '';
  customerGroups: any[] = [];
  filteredCustomerGroups: any[] = [];
  currentEditId: string | null = null;
  searchText: string = '';

  // Sorting variables
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  priceCalculationTypes = ['percentage', 'sellingPrice'];

  constructor(private customerGroupService: CustomerGroupService) {}

  ngOnInit() {
    this.loadCustomerGroups();
  }

  loadCustomerGroups() {
    this.customerGroupService.getCustomerGroups().subscribe((data) => {
      this.customerGroups = data;
      this.filteredCustomerGroups = [...this.customerGroups];
    });
  }

  filterCustomerGroups() {
    if (!this.searchText) {
      this.filteredCustomerGroups = [...this.customerGroups];
      return;
    }

    const searchTerm = this.searchText.toLowerCase();
    this.filteredCustomerGroups = this.customerGroups.filter(group => 
      group.customerGroupName.toLowerCase().includes(searchTerm) ||
      (group.priceCalculationType === 'percentage' && group.calculationPercentage.toString().includes(searchTerm)) ||
      (group.priceCalculationType === 'sellingPrice' && group.sellingPriceGroup.toLowerCase().includes(searchTerm))
    );

    // Apply current sort after filtering
    if (this.sortColumn) {
      this.sortData(this.sortColumn);
    }
  }

  toggleForm(): void {
    this.showForm = !this.showForm;
    if (!this.showForm) {
      this.resetForm();
    }
  }

  resetForm(): void {
    this.customerGroupName = '';
    this.priceCalculationType = 'percentage';
    this.calculationPercentage = null;
    this.sellingPriceGroup = '';
    this.currentEditId = null;
    this.showForm = false;
  }

  onSubmit(): void {
    const newCustomerGroup = {
      customerGroupName: this.customerGroupName,
      priceCalculationType: this.priceCalculationType,
      calculationPercentage: this.calculationPercentage,
      sellingPriceGroup: this.sellingPriceGroup
    };

    if (this.currentEditId) {
      this.customerGroupService.updateCustomerGroup(this.currentEditId, newCustomerGroup).then(() => {
        this.loadCustomerGroups();
        this.resetForm();
      }).catch((error) => {
        console.error("Error updating customer group: ", error);
      });
    } else {
      this.customerGroupService.addCustomerGroup(newCustomerGroup).then(() => {
        this.loadCustomerGroups();
        this.resetForm();
      }).catch((error) => {
        console.error("Error adding customer group: ", error);
      });
    }
  }

  // Updated sorting function to accept only column parameter
  sortData(column: string) {
    if (this.sortColumn === column) {
      // Reverse the sort direction if clicking the same column
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      // Default to ascending for new column
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    this.filteredCustomerGroups.sort((a, b) => {
      let valueA, valueB;

      switch (column) {
        case 'Customer Group Name':
          valueA = a.customerGroupName.toLowerCase();
          valueB = b.customerGroupName.toLowerCase();
          break;
        case 'Calculation Percentage (%)':
          valueA = a.priceCalculationType === 'percentage' ? a.calculationPercentage : -Infinity;
          valueB = b.priceCalculationType === 'percentage' ? b.calculationPercentage : -Infinity;
          break;
        case 'Selling Price Group':
          valueA = a.priceCalculationType === 'sellingPrice' ? a.sellingPriceGroup.toLowerCase() : '';
          valueB = b.priceCalculationType === 'sellingPrice' ? b.sellingPriceGroup.toLowerCase() : '';
          break;
        default:
          return 0;
      }

      if (valueA < valueB) {
        return this.sortDirection === 'asc' ? -1 : 1;
      } else if (valueA > valueB) {
        return this.sortDirection === 'asc' ? 1 : -1;
      } else {
        return 0;
      }
    });
  }

  exportCSV() {
    const headers = ["Customer Group Name", "Calculation Percentage", "Selling Price Group"];
    const rows = this.filteredCustomerGroups.map(group => [
      group.customerGroupName,
      group.priceCalculationType === 'percentage' ? group.calculationPercentage + '%' : '-',
      group.priceCalculationType === 'sellingPrice' ? group.sellingPriceGroup : '-'
    ]);
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = { Sheets: { 'CustomerGroups': worksheet }, SheetNames: ['CustomerGroups'] };
    const excelBuffer = XLSX.write(workbook, { bookType: 'csv', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'customer-groups.csv');
  }

  exportExcel() {
    const headers = ["Customer Group Name", "Calculation Percentage", "Selling Price Group"];
    const rows = this.filteredCustomerGroups.map(group => [
      group.customerGroupName,
      group.priceCalculationType === 'percentage' ? group.calculationPercentage + '%' : '-',
      group.priceCalculationType === 'sellingPrice' ? group.sellingPriceGroup : '-'
    ]);
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = { Sheets: { 'CustomerGroups': worksheet }, SheetNames: ['CustomerGroups'] };
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
    saveAs(blob, 'customer-groups.xlsx');
  }

  exportPDF() {
    const doc = new jsPDF();
    const columns = ["Customer Group Name", "Calculation Percentage", "Selling Price Group"];
    const rows = this.filteredCustomerGroups.map(group => [
      group.customerGroupName,
      group.priceCalculationType === 'percentage' ? group.calculationPercentage + '%' : '-',
      group.priceCalculationType === 'sellingPrice' ? group.sellingPriceGroup : '-'
    ]);
    autoTable(doc, { head: [columns], body: rows });
    doc.save('customer-groups.pdf');
  }

  printTable() {
    const printContent = document.querySelector('.customer-groups-table')?.outerHTML;
    const WindowPrt = window.open('', '', 'width=900,height=650');
    if (WindowPrt && printContent) {
      WindowPrt.document.write(`
        <html><head><title>Print Customer Groups</title></head>
        <body>${printContent}</body></html>`);
      WindowPrt.document.close();
      WindowPrt.focus();
      WindowPrt.print();
      WindowPrt.close();
    }
  }

  editCustomerGroup(group: any): void {
    this.customerGroupName = group.customerGroupName;
    this.priceCalculationType = group.priceCalculationType;
    this.calculationPercentage = group.calculationPercentage;
    this.sellingPriceGroup = group.sellingPriceGroup;
    this.currentEditId = group.id;
    this.showForm = true;
  }

  deleteCustomerGroup(id: string): void {
    if (confirm('Are you sure you want to delete this customer group?')) {
      this.customerGroupService.deleteCustomerGroup(id).then(() => {
        this.loadCustomerGroups();
      }).catch((error) => {
        console.error("Error deleting customer group: ", error);
      });
    }
  }

  onCalculationTypeChange(type: string): void {
    this.priceCalculationType = type;
  }

  getSortIcon(column: string): string {
    if (this.sortColumn !== column) {
      return 'fa-sort';
    }
    return this.sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
  }
}