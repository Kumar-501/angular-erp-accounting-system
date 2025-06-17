import { Component, EventEmitter, Output, OnInit } from '@angular/core';
import { TaxService } from '../services/tax.service';
import { TaxRate, TaxGroup } from '../tax/tax.model';

@Component({
  selector: 'app-pp-service-popup',
  templateUrl: './pp-service-popup.component.html',
  styleUrls: ['./pp-service-popup.component.scss']
})
export class PpServicePopupComponent implements OnInit {
  @Output() formSubmit = new EventEmitter<any>();
  @Output() close = new EventEmitter<void>();

  packingChargeBefTax: number = 0;
  tax: string = 'None';
  packingCharge: number = 0.00;
  transactionId: string = '';
  customField2: string = '';
  customField3: string = '';
  customField4: string = '';
  customField5: string = '';
  customField6: string = '';

  taxRates: TaxRate[] = [];
  taxGroups: TaxGroup[] = [];
  allTaxOptions: {id: string, name: string, type: string, rate?: number}[] = [];
  
  // Track which field was last changed to determine calculation direction
  lastChangedField: 'packingChargeBefTax' | 'packingCharge' = 'packingChargeBefTax';

  constructor(private taxService: TaxService) {}

  ngOnInit(): void {
    this.loadTaxData();
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
    this.allTaxOptions = [{id: 'None', name: 'None', type: 'None', rate: 0}];
    
    this.taxRates.forEach(rate => {
      this.allTaxOptions.push({
        id: rate.id || '',
        name: `${rate.name} (${rate.rate}%)`,
        type: 'Rate',
        rate: rate.rate
      });
    });
    
    this.taxGroups.forEach(group => {
      const rateNames = group.taxRates.map(t => t.name).join(', ');
      this.allTaxOptions.push({
        id: group.id || '',
        name: `${group.name} (${rateNames})`,
        type: 'Group'
      });
    });
  }

  onPackingBeforeTaxChange(): void {
    this.lastChangedField = 'packingChargeBefTax';
    this.calculatePackingCharge();
  }

  onPackingChargeChange(): void {
    this.lastChangedField = 'packingCharge';
    this.calculatePackingBeforeTax();
  }

  onTaxChange(): void {
    // Recalculate based on which field was last changed
    if (this.lastChangedField === 'packingChargeBefTax') {
      this.calculatePackingCharge();
    } else {
      this.calculatePackingBeforeTax();
    }
  }

  calculatePackingCharge(): void {
    const selectedTax = this.allTaxOptions.find(option => option.name === this.tax);
    const taxRate = selectedTax?.rate || 0;
    
    if (this.packingChargeBefTax && this.packingChargeBefTax > 0) {
      const taxAmount = this.packingChargeBefTax * (taxRate / 100);
      this.packingCharge = parseFloat((this.packingChargeBefTax + taxAmount).toFixed(2));
    } else {
      this.packingCharge = 0.00;
    }
  }

  calculatePackingBeforeTax(): void {
    const selectedTax = this.allTaxOptions.find(option => option.name === this.tax);
    const taxRate = selectedTax?.rate || 0;
    
    if (this.packingCharge && this.packingCharge > 0) {
      if (taxRate > 0) {
        this.packingChargeBefTax = parseFloat((this.packingCharge / (1 + (taxRate / 100))).toFixed(2));
      } else {
        this.packingChargeBefTax = this.packingCharge;
      }
    } else {
      this.packingChargeBefTax = 0;
    }
  }

  submitForm(): void {
    const formData = {
      packingChargeBefTax: this.packingChargeBefTax,
      tax: this.tax,
      packingCharge: this.packingCharge,
      transactionId: this.transactionId,
      customField2: this.customField2,
      customField3: this.customField3,
      customField4: this.customField4,
      customField5: this.customField5,
      customField6: this.customField6,
      timestamp: new Date()
    };
    
    this.formSubmit.emit(formData);
  }

  closePopup(): void {
    this.close.emit();
  }
}