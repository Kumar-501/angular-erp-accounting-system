// src/app/models/input-tax-report.model.ts
export interface TaxEntry {
  id: string;
  type: 'purchase' | 'expense';
  date?: string;
  referenceNo?: string;
  invoiceNo?: string;
  supplier?: string;
  businessLocation?: string;
  status?: string;
  paymentMethod?: string;
  totalAmount?: number;
  taxAmount?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  paymentAccount?: {
    name: string;
    accountNumber?: string;
  };
}

export interface SummaryData {
  totalEntries: number;
  totalAmount: number;
  totalTax: number;
  totalCGST: number;
  totalSGST: number;
  totalIGST: number;
  totalSubtotal: number;
}

export interface InputTaxReport {
  id?: string;
  entries: TaxEntry[];
  summary: SummaryData;
  filters: {
    startDate: string;
    endDate: string;
    supplier?: string;
    type?: string;
  };
  createdAt: Date;
  updatedAt?: Date;
}