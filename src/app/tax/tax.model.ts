// tax.model.ts
export interface TaxRate {
    id?: string;
    name: string;
    rate: number;
    active: boolean;
    forTaxGroupOnly: boolean;
  }
  
  export interface TaxGroup {
    id?: string;
    name: string;
    taxRates: TaxRate[];
    active: boolean;
  }