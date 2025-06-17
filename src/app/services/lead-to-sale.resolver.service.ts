import { Injectable } from "@angular/core";

// lead-to-sale.service.ts
@Injectable({ providedIn: 'root' })
export class LeadToSaleService {
  private leadData: any;

  setLeadData(data: any): void {
    this.leadData = data;
  }

  getLeadData(): any {
    const data = this.leadData;
    this.leadData = null; // Clear after reading
    return data;
  }
}