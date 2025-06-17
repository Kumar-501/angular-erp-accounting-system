import { Component, OnInit } from '@angular/core';
import { UnitsService } from '../services/units.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';


interface Unit {
  id?: string;
  name: string;
  shortName: string;
  allowDecimal: boolean;
  isMultiple: boolean;
  baseUnit?: string;
  multiplier?: number;
}

@Component({
  selector: 'app-units',
  templateUrl: './units.component.html',
  styleUrls: ['./units.component.scss']
})
export class UnitsComponent implements OnInit {
  units: Unit[] = [];
  filteredUnits: Unit[] = [];
  unitForm!: FormGroup;
  showPopup = false;
  isEditing = false;
  editId: string | null = null;
  searchTerm = '';
  currentPage = 1;
  pageSize = 3; // Changed to show 3 items per page
  totalPages = 1;
  sortField = 'name';
  sortDirection = 'asc';
  Math = Math;

  constructor(
    private unitsService: UnitsService,
    private fb: FormBuilder
  ) {}

  ngOnInit() {
    this.loadUnits();
    this.initForm();
  }

  initForm() {
    this.unitForm = this.fb.group({
      name: ['', [Validators.required]],
      shortName: ['', [Validators.required]],
      allowDecimal: [false, [Validators.required]],
      isMultiple: [false],
      baseUnit: [''],
      multiplier: [1]
    });

    this.unitForm.get('isMultiple')?.valueChanges.subscribe(isMultiple => {
      const baseUnitControl = this.unitForm.get('baseUnit');
      const multiplierControl = this.unitForm.get('multiplier');
      
      if (isMultiple) {
        baseUnitControl?.setValidators([Validators.required]);
        multiplierControl?.setValidators([Validators.required, Validators.min(0.000001)]);
      } else {
        baseUnitControl?.clearValidators();
        multiplierControl?.clearValidators();
        baseUnitControl?.setValue('');
        multiplierControl?.setValue(1);
      }
      
      baseUnitControl?.updateValueAndValidity();
      multiplierControl?.updateValueAndValidity();
    });
  }

  loadUnits() {
    this.unitsService.getUnits().subscribe(data => {
      this.units = data;
      this.filterAndPaginateUnits();
    });
  }

  filterAndPaginateUnits() {
    // Filter
    this.filteredUnits = this.units.filter(unit => 
      unit.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
      unit.shortName.toLowerCase().includes(this.searchTerm.toLowerCase())
    );
    
    // Sort
    this.filteredUnits.sort((a, b) => {
      const aValue = a[this.sortField as keyof Unit] as string;
      const bValue = b[this.sortField as keyof Unit] as string;
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return this.sortDirection === 'asc' 
          ? aValue.localeCompare(bValue) 
          : bValue.localeCompare(aValue);
      }
      return 0;
    });
    
    // Calculate pagination
    this.totalPages = Math.ceil(this.filteredUnits.length / this.pageSize);
    
    // Get current page items
    const startIndex = (this.currentPage - 1) * this.pageSize;
    this.filteredUnits = this.filteredUnits.slice(startIndex, startIndex + this.pageSize);
  }

  getPageArray(): number[] {
    return Array(this.totalPages).fill(0).map((_, index) => index + 1);
  }

  search(event: Event) {
    this.searchTerm = (event.target as HTMLInputElement).value;
    this.currentPage = 1;
    this.filterAndPaginateUnits();
  }

  changePageSize(event: Event) {
    this.pageSize = Number((event.target as HTMLSelectElement).value);
    this.currentPage = 1;
    this.filterAndPaginateUnits();
  }

  changePage(page: number) {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.filterAndPaginateUnits();
  }

  sortBy(field: keyof Unit) {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }
    this.filterAndPaginateUnits();
  }

  openPopup(editData: Unit | null = null) {
    this.showPopup = true;
    this.initForm();
    
    if (editData && editData.id) {
      this.isEditing = true;
      this.editId = editData.id;
      this.unitForm.patchValue({
        name: editData.name,
        shortName: editData.shortName,
        allowDecimal: editData.allowDecimal,
        isMultiple: editData.isMultiple || false,
        baseUnit: editData.baseUnit || '',
        multiplier: editData.multiplier || 1
      });
    } else {
      this.isEditing = false;
      this.editId = null;
    }
  }

  closePopup() {
    this.showPopup = false;
    this.unitForm.reset({
      allowDecimal: false,
      isMultiple: false,
      multiplier: 1
    });
  }

  saveUnit() {
    // First, check if required fields are valid
    const nameControl = this.unitForm.get('name');
    const shortNameControl = this.unitForm.get('shortName');
    const allowDecimalControl = this.unitForm.get('allowDecimal');
    
    // Mark these controls as touched to show validation errors
    nameControl?.markAsTouched();
    shortNameControl?.markAsTouched();
    allowDecimalControl?.markAsTouched();
    
    // Check if basic required fields are valid
    if (!nameControl?.valid || !shortNameControl?.valid || !allowDecimalControl?.valid) {
      return; // Don't proceed if required fields are invalid
    }
    
    // Create unit data from valid fields
    const unitData: Unit = {
      name: this.unitForm.value.name,
      shortName: this.unitForm.value.shortName,
      allowDecimal: !!this.unitForm.value.allowDecimal,
      isMultiple: !!this.unitForm.value.isMultiple
    };
    
    // Only add baseUnit and multiplier if isMultiple is true and they are provided
    if (unitData.isMultiple) {
      if (this.unitForm.value.baseUnit) {
        unitData.baseUnit = this.unitForm.value.baseUnit;
      }
      
      if (this.unitForm.value.multiplier !== undefined && this.unitForm.value.multiplier !== null) {
        unitData.multiplier = this.unitForm.value.multiplier;
      }
    }
    
    if (this.isEditing && this.editId) {
      this.unitsService.updateUnit(this.editId, unitData).then(() => {
        this.loadUnits();
        this.closePopup();
      }).catch(err => {
        console.error('Error updating unit:', err);
      });
    } else {
      this.unitsService.addUnit(unitData).then(() => {
        this.loadUnits();
        this.closePopup();
      }).catch(err => {
        console.error('Error adding unit:', err);
      });
    }
  }

  deleteUnit(id: string) {
    if (confirm('Are you sure you want to delete this unit?')) {
      this.unitsService.deleteUnit(id).then(() => {
        this.loadUnits();
      }).catch(err => {
        console.error('Error deleting unit:', err);
      });
    }
  }

  markFormGroupTouched(formGroup: FormGroup) {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }
  
  hasError(controlName: string, errorName: string) {
    const control = this.unitForm.get(controlName);
    return control?.touched && control?.hasError(errorName);
  }

  exportToCSV() {
    const data = this.units.map(unit => ({
      Name: unit.name,
      'Short Name': unit.shortName,
      'Allow Decimal': unit.allowDecimal ? 'Yes' : 'No',
      'Is Multiple': unit.isMultiple ? 'Yes' : 'No',
      'Base Unit': unit.baseUnit || '',
      Multiplier: unit.multiplier || ''
    }));
  
    const worksheet = XLSX.utils.json_to_sheet(data);
    const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'units.csv');
  }
  

// Export to Excel
exportToExcel() {
  const data = this.units.map(unit => ({
    Name: unit.name,
    'Short Name': unit.shortName,
    'Allow Decimal': unit.allowDecimal ? 'Yes' : 'No',
    'Is Multiple': unit.isMultiple ? 'Yes' : 'No',
    'Base Unit': unit.baseUnit || '',
    Multiplier: unit.multiplier || ''
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = { Sheets: { 'Units': worksheet }, SheetNames: ['Units'] };
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, 'units.xlsx');
}


 // Export to PDF
exportToPDF() {
  const doc = new jsPDF();
  const tableData = this.units.map(unit => [
    unit.name,
    unit.shortName,
    unit.allowDecimal ? 'Yes' : 'No',
    unit.isMultiple ? 'Yes' : 'No',
    unit.baseUnit || '',
    unit.multiplier || ''
  ]);

  autoTable(doc, {
    head: [['Name', 'Short Name', 'Allow Decimal', 'Is Multiple', 'Base Unit', 'Multiplier']],
    body: tableData
  });

  doc.save('units.pdf');
}

 // Print
print() {
  const printableContent = this.units.map(unit => 
    `Name: ${unit.name}\nShort Name: ${unit.shortName}\nAllow Decimal: ${unit.allowDecimal ? 'Yes' : 'No'}\n` +
    `Is Multiple: ${unit.isMultiple ? 'Yes' : 'No'}\nBase Unit: ${unit.baseUnit || '-'}\nMultiplier: ${unit.multiplier || '-'}\n\n`
  ).join('');

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write('<pre>' + printableContent + '</pre>');
    printWindow.document.close();
    printWindow.print();
  }
}
 
}