// src/app/services/output-tax.service.ts
import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc } from '@angular/fire/firestore';
import { DatePipe } from '@angular/common';

interface OutputTaxReport {
  entries: Array<{
    id: string;
    entryType: 'Sale' | 'Income';
    saleDate: Date;
    invoiceNo: string;
    customer: string;
    totalPayable: number;
    taxAmount: number;
    taxDetails: {
      cgst: number;
      sgst: number;
      igst: number;
    };
  }>;
  summary: {
    totalCGST: number;
    totalSGST: number;
    totalIGST: number;
    totalTax: number;
    totalAmount: number;
  };
  filters: {
    dateRange: {
      startDate: string;
      endDate: string;
    };
    quickDateFilter?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

@Injectable({
  providedIn: 'root'
})
export class OutputTaxService {
  private readonly COLLECTION_NAME = 'outputTaxReports';

  constructor(
    private firestore: Firestore,
    private datePipe: DatePipe
  ) {}

  async saveReport(reportData: any): Promise<string> {
    try {
      // Deep clean the data to remove undefined values
      const cleanData = this.removeUndefinedFields(reportData);
      
      const docRef = await addDoc(
        collection(this.firestore, this.COLLECTION_NAME),
        cleanData
      );
      return docRef.id;
    } catch (error) {
      console.error('Error saving report:', error);
      throw new Error('Failed to save report');
    }
  }

  private removeUndefinedFields(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.removeUndefinedFields(item));
    }

    const cleanObj: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleanObj[key] = this.removeUndefinedFields(value);
      } else {
        cleanObj[key] = null; // Convert undefined to null
      }
    }
    return cleanObj;
  }

}
