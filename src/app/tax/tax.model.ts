export interface TaxRate {
  id?: string;
  name: string;
  rate: number;
  active: boolean;
  forTaxGroupOnly: boolean;
  isIGST?: boolean; // ✅ FIXED: Added IGST flag
}

export interface TaxGroup {
  id?: string;
  name: string;
  taxRates: TaxRate[];
  active: boolean;
}