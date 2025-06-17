import { Component, EventEmitter, Output, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TaxService } from '../services/tax.service';
import { TaxRate, TaxGroup } from '../tax/tax.model';

@Component({
  selector: 'app-cod-popup',
  templateUrl: './cod-popup.component.html',
  styleUrls: ['./cod-popup.component.scss']
})
export class CodPopupComponent implements OnInit {
  @Output() formSubmit = new EventEmitter<any>();
  @Output() close = new EventEmitter<void>();
  
  codForm: FormGroup;
  taxRates: TaxRate[] = [];
  taxGroups: TaxGroup[] = [];
  taxOptions: {id: string, name: string, type: string}[] = [];
  calculationMode: 'forward' | 'reverse' = 'forward'; // Track calculation direction

  constructor(
    private fb: FormBuilder,
    private taxService: TaxService
  ) {
    this.codForm = this.fb.group({
      packingBeforeTax: ['', [Validators.min(0)]],
      taxType: ['None', [Validators.required]],
      taxRate: [0, [Validators.min(0)]],
      packingCharge: ['', [Validators.min(0)]]
    });
  }

  ngOnInit(): void {
    this.loadTaxData();
    this.setupTaxCalculationListener();
  }

  loadTaxData(): void {
    this.taxService.getTaxRates().subscribe(rates => {
      this.taxRates = rates;
      this.updateTaxOptions();
    });

    this.taxService.getTaxGroups().subscribe(groups => {
      this.taxGroups = groups;
      this.updateTaxOptions();
    });
  }

  updateTaxOptions(): void {
    this.taxOptions = [{id: 'None', name: 'None', type: 'None'}];
    
    this.taxRates.forEach(rate => {
      this.taxOptions.push({
        id: rate.id || '',
        name: `${rate.name} (${rate.rate}%)`,
        type: 'Rate'
      });
    });
    
    this.taxGroups.forEach(group => {
      const rateNames = group.taxRates.map(t => t.name).join(', ');
      this.taxOptions.push({
        id: group.id || '',
        name: `${group.name} (${rateNames})`,
        type: 'Group'
      });
    });
  }

  setupTaxCalculationListener(): void {
    // Track which field was changed last to determine calculation direction
    this.codForm.get('packingBeforeTax')?.valueChanges.subscribe(() => {
      if (this.codForm.get('packingBeforeTax')?.dirty) {
        this.calculationMode = 'forward';
        this.calculatePackingCharge();
      }
    });

    this.codForm.get('packingCharge')?.valueChanges.subscribe(() => {
      if (this.codForm.get('packingCharge')?.dirty) {
        this.calculationMode = 'reverse';
        this.calculatePackingBeforeTax();
      }
    });

    this.codForm.get('taxType')?.valueChanges.subscribe(value => {
      if (value === 'None') {
        this.codForm.get('taxRate')?.setValue(0);
      } else {
        const selectedTax = this.taxOptions.find(option => option.name === value);
        if (selectedTax?.type === 'Rate') {
          const rate = this.taxRates.find(r => r.id === selectedTax.id)?.rate || 0;
          this.codForm.get('taxRate')?.setValue(rate);
        }
      }
      
      // Recalculate based on the last changed field
      if (this.calculationMode === 'forward') {
        this.calculatePackingCharge();
      } else {
        this.calculatePackingBeforeTax();
      }
    });
  }

  calculatePackingCharge(): void {
    const packingBeforeTax = parseFloat(this.codForm.get('packingBeforeTax')?.value) || 0;
    const taxRate = parseFloat(this.codForm.get('taxRate')?.value) || 0;
    
    if (packingBeforeTax > 0) {
      const taxAmount = packingBeforeTax * (taxRate / 100);
      const packingCharge = packingBeforeTax + taxAmount;
      this.codForm.get('packingCharge')?.setValue(packingCharge.toFixed(2), { emitEvent: false });
    }
  }

  calculatePackingBeforeTax(): void {
    const packingCharge = parseFloat(this.codForm.get('packingCharge')?.value) || 0;
    const taxRate = parseFloat(this.codForm.get('taxRate')?.value) || 0;
    
    if (packingCharge > 0) {
      if (taxRate > 0) {
        const packingBeforeTax = packingCharge / (1 + (taxRate / 100));
        this.codForm.get('packingBeforeTax')?.setValue(packingBeforeTax.toFixed(2), { emitEvent: false });
      } else {
        this.codForm.get('packingBeforeTax')?.setValue(packingCharge.toFixed(2), { emitEvent: false });
      }
    }
  }

  onSubmit(): void {
    if (this.codForm.valid) {
      const formValue = {
        ...this.codForm.value,
        taxType: this.codForm.value.taxType,
        taxRate: this.codForm.value.taxRate
      };
      this.formSubmit.emit(formValue);
    }
  }

  onClose(): void {
    this.close.emit();
  }
}