import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';

export interface AccountSummaryData {
  openingBalance: number;
  totalPurchase: number;
  totalExpense: number;
  totalPaid: number;
  advanceBalance: number;
  balanceDue: number;
  dateRange: {
    from: string;
    to: string;
  };
  supplierDetails: {
    businessName?: string;
    firstName?: string;
    lastName?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    country?: string;
    zipCode?: string;
    mobile?: string;
    taxNumber?: string;
  };
  companyDetails: {
    name: string;
    address: string;
  };
}

@Component({
  selector: 'app-account-summary',
  templateUrl: './account-summary.component.html',
  styleUrls: ['./account-summary.component.scss']
})
export class AccountSummaryComponent implements OnChanges {
  @Input() accountData!: AccountSummaryData;
  
  constructor() { }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['accountData'] && this.accountData) {
      // Any additional processing if needed
      console.log('Account data updated:', this.accountData);
    }
  }

  getSupplierDisplayName(): string {
    if (!this.accountData?.supplierDetails) return '';
    
    const details = this.accountData.supplierDetails;
    if (details.businessName) {
      return details.businessName;
    }
    return `${details.firstName || ''} ${details.lastName || ''}`.trim();
  }

  getSupplierAddress(): string {
    if (!this.accountData?.supplierDetails) return '';
    
    const details = this.accountData.supplierDetails;
    const addressParts = [
      details.addressLine1,
      details.addressLine2,
      details.city ? `${details.city},` : '',
      details.state,
      details.country,
      details.zipCode
    ].filter(part => part && part.trim() !== '');
    
    return addressParts.join(' ');
  }
}