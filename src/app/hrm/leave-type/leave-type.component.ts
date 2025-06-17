import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { LeaveTypeService } from '../../services/leave-type.service';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

@Component({
  selector: 'app-leave-type',
  templateUrl: './leave-type.component.html',
  styleUrls: ['./leave-type.component.scss']
})
export class LeaveTypeComponent implements OnInit {
  leaveForm!: FormGroup;
  showPopup = false;
  leaveTypes: any[] = [];
  filteredLeaveTypes: any[] = [];
  isEditMode = false;
  editingId: string | null = null;
  
  // Filter properties
  showFilterSidebar = false;
  searchTerm = '';
  selectedInterval = '';

  // Column visibility
  columns = [
    { name: 'Leave Type', visible: true },
    { name: 'Max Leave Count', visible: true },
    { name: 'Interval', visible: true },
    { name: 'Action', visible: true }
  ];
  showColumnVisibility = false;

  constructor(private fb: FormBuilder, private leaveService: LeaveTypeService) {}

  ngOnInit(): void {
    this.leaveForm = this.fb.group({
      leaveType: ['', Validators.required],
      maxLeaveCount: [''],
      interval: ['current_month']
    });

    this.leaveService.getLeaveTypes().subscribe(data => {
      this.leaveTypes = data;
      this.filteredLeaveTypes = [...this.leaveTypes];
    });
  }

  // Existing methods
  openPopup() {
    this.leaveForm.reset({ interval: 'current_month' });
    this.isEditMode = false;
    this.editingId = null;
    this.showPopup = true;
  }

  closePopup() {
    this.showPopup = false;
  }

  saveLeaveType() {
    if (this.leaveForm.invalid) return;

    const formData = this.leaveForm.value;

    if (this.isEditMode && this.editingId) {
      this.leaveService.updateLeaveType(this.editingId, formData);
    } else {
      this.leaveService.addLeaveType(formData);
    }

    this.closePopup();
  }

  editLeaveType(item: any) {
    this.leaveForm.patchValue(item);
    this.isEditMode = true;
    this.editingId = item.id;
    this.showPopup = true;
  }

  deleteLeaveType(id: string) {
    this.leaveService.deleteLeaveType(id);
  }
  
  // Filter methods
  toggleFilterSidebar() {
    this.showFilterSidebar = !this.showFilterSidebar;
  }

  applyFilters() {
    this.filteredLeaveTypes = this.leaveTypes.filter(leave => {
      const matchesSearch = leave.leaveType.toLowerCase().includes(this.searchTerm.toLowerCase());
      const matchesInterval = this.selectedInterval ? leave.interval === this.selectedInterval : true;
      return matchesSearch && matchesInterval;
    });
  }

  resetFilters() {
    this.searchTerm = '';
    this.selectedInterval = '';
    this.filteredLeaveTypes = [...this.leaveTypes];
  }

  // New Export Methods
  exportToCsv() {
    const csvData = this.convertToCSV(this.filteredLeaveTypes);
    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', 'leave_types.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  convertToCSV(data: any[]): string {
    const visibleColumns = this.columns.filter(col => col.visible && col.name !== 'Action');
    const header = visibleColumns.map(col => col.name).join(',');
    const rows = data.map(item => {
      return visibleColumns.map(col => {
        switch(col.name) {
          case 'Leave Type':
            return item.leaveType;
          case 'Max Leave Count':
            return item.maxLeaveCount;
          case 'Interval':
            return item.interval;
          default:
            return '';
        }
      }).join(',');
    }).join('\n');
    return header + '\n' + rows;
  }

  exportToExcel() {
    const visibleColumns = this.columns.filter(col => col.visible && col.name !== 'Action');
    const data = this.filteredLeaveTypes.map(item => {
      const row: any = {};
      visibleColumns.forEach(col => {
        switch(col.name) {
          case 'Leave Type':
            row[col.name] = item.leaveType;
            break;
          case 'Max Leave Count':
            row[col.name] = item.maxLeaveCount;
            break;
          case 'Interval':
            row[col.name] = item.interval;
            break;
        }
      });
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Leave Types');
    XLSX.writeFile(workbook, 'leave_types.xlsx');
  }

  exportToPdf() {
    const doc = new jsPDF();
    const visibleColumns = this.columns.filter(col => col.visible && col.name !== 'Action');
    
    const tableColumn = visibleColumns.map(col => col.name);
    const tableRows: any[] = [];

    this.filteredLeaveTypes.forEach(item => {
      const rowData: any[] = [];
      visibleColumns.forEach(col => {
        switch(col.name) {
          case 'Leave Type':
            rowData.push(item.leaveType);
            break;
          case 'Max Leave Count':
            rowData.push(item.maxLeaveCount);
            break;
          case 'Interval':
            rowData.push(item.interval);
            break;
        }
      });
      tableRows.push(rowData);
    });

    (doc as any).autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 20,
      theme: 'grid',
      styles: {
        fontSize: 10,
        cellPadding: 3,
        overflow: 'linebreak'
      },
      headStyles: {
        fillColor: [66, 139, 202]
      }
    });

    doc.text('Leave Types Report', 14, 15);
    doc.save('leave_types.pdf');
  }

  print() {
    const printContent = document.getElementById('leaveTypeTable');
    const WindowPrt = window.open('', '', 'left=0,top=0,width=900,height=900,toolbar=0,scrollbars=0,status=0');
    if (WindowPrt && printContent) {
      WindowPrt.document.write(`
        <html>
          <head>
            <title>Leave Types</title>
            <style>
              table { border-collapse: collapse; width: 100%; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; }
            </style>
          </head>
          <body>
            <h1>Leave Types Report</h1>
            ${printContent.outerHTML}
          </body>
        </html>
      `);
      WindowPrt.document.close();
      WindowPrt.focus();
      WindowPrt.print();
      WindowPrt.close();
    }
  }

  toggleColumnVisibility() {
    this.showColumnVisibility = !this.showColumnVisibility;
  }

  toggleColumn(columnName: string) {
    const column = this.columns.find(col => col.name === columnName);
    if (column) {
      column.visible = !column.visible;
    }
  }
}