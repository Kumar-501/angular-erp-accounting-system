import { Component, OnInit } from '@angular/core';
import { TaxService } from '../services/tax.service';
import { TaxRate, TaxGroup } from './tax.model';

@Component({
  selector: 'app-tax',
  templateUrl: './tax.component.html',
  styleUrls: ['./tax.component.scss'],
})
export class TaxComponent implements OnInit {
  showTaxRateForm = false;
  showTaxGroupForm = false;
  isEditingRate = false;
  isEditingGroup = false;
  
  // Sorting variables for tax rates
  taxRateSortColumn: string = 'name';
  taxRateSortDirection: string = 'asc';
  
  // Sorting variables for tax groups
  taxGroupSortColumn: string = 'name';
  taxGroupSortDirection: string = 'asc';
  
  currentRateId = '';
  currentGroupId = '';

  taxRate: Omit<TaxRate, 'id'> = {
    name: '',
    rate: 0,
    active: true,
    forTaxGroupOnly: false,
  };

  taxGroup: Omit<TaxGroup, 'id'> = {
    name: '',
    taxRates: [],
    active: true,
  };

  taxRates: TaxRate[] = [];
  taxGroups: TaxGroup[] = [];

  constructor(private taxService: TaxService) {}

  ngOnInit() {
    this.getTaxRates();
    this.getTaxGroups();
  }

  toggleTaxRateForm() {
    this.showTaxRateForm = !this.showTaxRateForm;
    this.isEditingRate = false;
    this.currentRateId = '';
    this.taxRate = { 
      name: '', 
      rate: 0, 
      active: true, 
      forTaxGroupOnly: false 
    };
  }

  // Tax Rates Sorting
  sortTaxRates(column: string) {
    if (this.taxRateSortColumn === column) {
      this.taxRateSortDirection = this.taxRateSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.taxRateSortColumn = column;
      this.taxRateSortDirection = 'asc';
    }
    
    this.taxRates = [...this.taxRates].sort((a, b) => {
      const valA = a[column as keyof TaxRate];
      const valB = b[column as keyof TaxRate];
      
      if (typeof valA === 'string' && typeof valB === 'string') {
        const comparison = valA.localeCompare(valB);
        return this.taxRateSortDirection === 'asc' ? comparison : -comparison;
      } else if (typeof valA === 'number' && typeof valB === 'number') {
        const comparison = valA - valB;
        return this.taxRateSortDirection === 'asc' ? comparison : -comparison;
      } else if (typeof valA === 'boolean' && typeof valB === 'boolean') {
        const comparison = valA === valB ? 0 : valA ? 1 : -1;
        return this.taxRateSortDirection === 'asc' ? comparison : -comparison;
      }
      return 0;
    });
  }

  // Tax Groups Sorting
  sortTaxGroups(column: string) {
    if (this.taxGroupSortColumn === column) {
      this.taxGroupSortDirection = this.taxGroupSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.taxGroupSortColumn = column;
      this.taxGroupSortDirection = 'asc';
    }
    
    this.taxGroups = [...this.taxGroups].sort((a, b) => {
      const valA = a[column as keyof TaxGroup];
      const valB = b[column as keyof TaxGroup];
      
      if (typeof valA === 'string' && typeof valB === 'string') {
        const comparison = valA.localeCompare(valB);
        return this.taxGroupSortDirection === 'asc' ? comparison : -comparison;
      }
      return 0;
    });
  }

  toggleTaxGroupForm() {
    this.showTaxGroupForm = !this.showTaxGroupForm;
    this.isEditingGroup = false;
    this.currentGroupId = '';
    this.taxGroup = { 
      name: '', 
      taxRates: [], 
      active: true 
    };
  }

  addTaxRate() {
    if (this.isEditingRate) {
      this.taxService.updateTaxRate(this.currentRateId, this.taxRate).then(() => {
        this.toggleTaxRateForm();
        this.getTaxRates();
      });
    } else {
      this.taxService.addTaxRate(this.taxRate).then(() => {
        this.toggleTaxRateForm();
        this.getTaxRates();
      });
    }
  }

  addTaxGroup() {
    if (this.isEditingGroup) {
      this.taxService.updateTaxGroup(this.currentGroupId, this.taxGroup).then(() => {
        this.toggleTaxGroupForm();
        this.getTaxGroups();
      });
    } else {
      this.taxService.addTaxGroup(this.taxGroup).then(() => {
        this.toggleTaxGroupForm();
        this.getTaxGroups();
      });
    }
  }

  editTaxRate(rate: TaxRate) {
    this.isEditingRate = true;
    this.currentRateId = rate.id || '';
    this.taxRate = {
      name: rate.name,
      rate: rate.rate,
      active: rate.active,
      forTaxGroupOnly: rate.forTaxGroupOnly,
    };
    this.showTaxRateForm = true;
  }

  deleteTaxRate(id: string | undefined) {
    if (!id) return;
    
    if (confirm('Are you sure you want to delete this tax rate?')) {
      this.taxService.deleteTaxRate(id).then(() => {
        this.getTaxRates();
      });
    }
  }

  editTaxGroup(group: TaxGroup) {
    this.isEditingGroup = true;
    this.currentGroupId = group.id || '';
    this.taxGroup = {
      name: group.name,
      taxRates: [...group.taxRates],
      active: group.active,
    };
    this.showTaxGroupForm = true;
  }

  deleteTaxGroup(id: string | undefined) {
    if (!id) return;
    
    if (confirm('Are you sure you want to delete this tax group?')) {
      this.taxService.deleteTaxGroup(id).then(() => {
        this.getTaxGroups();
      });
    }
  }

  getTaxRateNames(taxRates: TaxRate[]): string {
    return taxRates.map(t => t.name).join(', ');
  }

  getTaxRates() {
    this.taxService.getTaxRates().subscribe((rates) => {
      this.taxRates = rates;
    });
  }

  getTaxGroups() {
    this.taxService.getTaxGroups().subscribe((groups) => {
      this.taxGroups = groups;
    });
  }
}