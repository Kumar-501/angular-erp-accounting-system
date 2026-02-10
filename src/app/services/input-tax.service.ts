// src/app/services/input-tax.service.ts
import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, getDocs, query, where, orderBy, doc, getDoc, updateDoc, deleteDoc } from '@angular/fire/firestore';
import { InputTaxReport, SummaryData, TaxEntry } from '../input-tax-report.model';
import { DatePipe } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class InputTaxService {
  private readonly COLLECTION_NAME = 'inputTaxReports';
  private readonly SUMMARY_COLLECTION = 'inputTaxSummaries';

  constructor(
    private firestore: Firestore,
    private datePipe: DatePipe
  ) {}

// src/app/services/input-tax.service.ts

async saveReport(entries: TaxEntry[], summary: SummaryData, filters: any): Promise<string> {
  // Clean the entries data
  const cleanedEntries = entries.map(entry => this.cleanEntry(entry));
  
  // Clean the summary data
  const cleanedSummary = this.cleanSummary(summary);
  
  // Clean filters
  const cleanedFilters = this.cleanFilters(filters);

  const reportData: InputTaxReport = {
    entries: cleanedEntries,
    summary: cleanedSummary,
    filters: cleanedFilters,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  try {
    const docRef = await addDoc(collection(this.firestore, this.COLLECTION_NAME), reportData);
    return docRef.id;
  } catch (error) {
    console.error('Error saving input tax report:', error);
    throw new Error('Failed to save input tax report');
  }
}

private cleanEntry(entry: TaxEntry): any {
  const cleaned: any = { ...entry };
  
  // Remove undefined fields
  Object.keys(cleaned).forEach(key => {
    if (cleaned[key] === undefined) {
      delete cleaned[key];
    }
  });

  // Ensure required fields have default values
  cleaned.type = cleaned.type || 'unknown';
  cleaned.id = cleaned.id || '';

  // Clean nested objects
  if (cleaned.paymentAccount) {
    cleaned.paymentAccount = {
      name: cleaned.paymentAccount.name || '',
      accountNumber: cleaned.paymentAccount.accountNumber || ''
    };
  }

  return cleaned;
}

private cleanSummary(summary: SummaryData): SummaryData {
  return {
    totalEntries: summary.totalEntries || 0,
    totalAmount: summary.totalAmount || 0,
    totalTax: summary.totalTax || 0,
    totalCGST: summary.totalCGST || 0,
    totalSGST: summary.totalSGST || 0,
    totalIGST: summary.totalIGST || 0,
    totalSubtotal: summary.totalSubtotal || 0
  };
}
// src/app/services/input-tax.service.ts

async saveSimpleReport(reportData: {
  fromDate: string;
  toDate: string;
  supplierFilter: string;
  totalSubtotal: number;
  totalTax: number;
  totalCGST: number;
  totalSGST: number;
  entries: Array<{
    invoiceNo?: string;
    toLocation?: string;
    supplier?: string;
    status?: string;
    paymentMethod?: string;
    tax?: number;
    cgst?: number;
    sgst?: number;
    paymentDue?: number;
    totalAmount?: number;
  }>;
}): Promise<string> {
  try {
    const dataToSave = {
      dateRange: {
        from: reportData.fromDate,
        to: reportData.toDate
      },
      supplierFilter: reportData.supplierFilter,
      summary: {
        totalSubtotal: reportData.totalSubtotal,
        totalTax: reportData.totalTax,
        totalCGST: reportData.totalCGST,
        totalSGST: reportData.totalSGST
      },
      entries: reportData.entries,
      createdAt: new Date()
    };

    const docRef = await addDoc(
      collection(this.firestore, 'inputTaxReports'),
      dataToSave
    );
    return docRef.id;
  } catch (error) {
    console.error('Error saving report:', error);
    throw new Error('Failed to save report');
  }
}
private cleanFilters(filters: any): any {
  return {
    startDate: filters.startDate || '',
    endDate: filters.endDate || '',
    supplier: filters.supplier || '',
    type: filters.type || 'all'
  };
}
async saveSummary(summary: SummaryData): Promise<string> {
  if (!summary) {
    throw new Error('Invalid summary data');
  }

  try {
    const docRef = await addDoc(collection(this.firestore, this.SUMMARY_COLLECTION), {
      ...summary,
      createdAt: new Date()
    });
    console.log('Summary saved with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error saving summary:', error);
    throw new Error('Failed to save summary');
  }
}

  /**
   * Get input tax credit for a date range
   */
  async getInputTaxCredit(startDate: Date, endDate: Date): Promise<number> {
    try {
      const inputTaxCollection = collection(this.firestore, this.COLLECTION_NAME);
      const q = query(
        inputTaxCollection,
        where('createdAt', '>=', startDate),
        where('createdAt', '<=', endDate)
      );
      
      const querySnapshot = await getDocs(q);
      let totalInputTaxCredit = 0;
      
      querySnapshot.forEach(doc => {
        const reportData = doc.data() as InputTaxReport;
        totalInputTaxCredit += reportData.summary?.totalTax || 0;
      });
      
      return totalInputTaxCredit;
    } catch (error) {
      console.error('Error calculating input tax credit:', error);
      return 0;
    }
  }

  /**
   * Get all saved reports
   */
  async getReports(): Promise<InputTaxReport[]> {
    try {
      const inputTaxCollection = collection(this.firestore, this.COLLECTION_NAME);
      const q = query(inputTaxCollection, orderBy('createdAt', 'desc'));
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data() as InputTaxReport
      }));
    } catch (error) {
      console.error('Error getting input tax reports:', error);
      return [];
    }
  }

  /**
   * Get a specific report by ID
   */
  async getReport(id: string): Promise<InputTaxReport | null> {
    try {
      const docRef = doc(this.firestore, this.COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data() as InputTaxReport
        };
      } else {
        console.log('No such document!');
        return null;
      }
    } catch (error) {
      console.error('Error getting input tax report:', error);
      return null;
    }
  }

  /**
   * Update a report
   */
  async updateReport(id: string, data: Partial<InputTaxReport>): Promise<void> {
    try {
      const docRef = doc(this.firestore, this.COLLECTION_NAME, id);
      await updateDoc(docRef, {
        ...data,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error updating input tax report:', error);
      throw new Error('Failed to update input tax report');
    }
  }

  /**
   * Delete a report
   */
  async deleteReport(id: string): Promise<void> {
    try {
      const docRef = doc(this.firestore, this.COLLECTION_NAME, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting input tax report:', error);
      throw new Error('Failed to delete input tax report');
    }
  }

  /**
   * Get reports by date range
   */
  async getReportsByDateRange(startDate: Date, endDate: Date): Promise<InputTaxReport[]> {
    try {
      const inputTaxCollection = collection(this.firestore, this.COLLECTION_NAME);
      const q = query(
        inputTaxCollection,
        where('createdAt', '>=', startDate),
        where('createdAt', '<=', endDate),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data() as InputTaxReport
      }));
    } catch (error) {
      console.error('Error getting reports by date range:', error);
      return [];
    }
  }

  /**
   * Get monthly input tax summary
   */
  async getMonthlySummary(year: number): Promise<{month: number, totalTax: number}[]> {
    try {
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year, 11, 31, 23, 59, 59);
      
      const reports = await this.getReportsByDateRange(startDate, endDate);
      const monthlySummary: {month: number, totalTax: number}[] = [];
      
      // Initialize all months with 0
      for (let month = 0; month < 12; month++) {
        monthlySummary.push({ month: month + 1, totalTax: 0 });
      }
      
      // Aggregate tax by month
      reports.forEach(report => {
        const month = report.createdAt.getMonth();
        monthlySummary[month].totalTax += report.summary.totalTax;
      });
      
      return monthlySummary;
    } catch (error) {
      console.error('Error getting monthly summary:', error);
      return [];
    }
  }

  /**
   * Format date for display
   */
  formatDate(date: Date): string {
    return this.datePipe.transform(date, 'mediumDate') || '';
  }
}