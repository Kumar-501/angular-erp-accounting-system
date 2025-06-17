
// supplier-summary.component.ts
import { Component, OnInit } from '@angular/core';
import { SupplierService } from '../services/supplier.service';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-supplier-summary',
  templateUrl: './supplier-summary.component.html',
  styleUrls: ['./supplier-summary.component.scss']
})
export class SupplierSummaryComponent implements OnInit {
  suppliers: any[] = [];

  constructor(private supplierService: SupplierService) {}

  ngOnInit(): void {
    this.loadSuppliers();
  }

  loadSuppliers(): void {
    this.supplierService.getSuppliers().subscribe((suppliers: any[]) => {
      this.suppliers = suppliers;
    });
  }

  exportToExcel(): void {
    if (this.suppliers.length === 0) {
      alert('No data to export');
      return;
    }

    // Prepare data for Excel export
    const exportData = this.suppliers.map(supplier => ({
      'Contact ID': supplier.contactId || 'N/A',
      'Name': supplier.isIndividual 
        ? `${supplier.prefix || ''} ${supplier.firstName || ''} ${supplier.middleName || ''} ${supplier.lastName || ''}`.trim()
        : 'N/A',
      'Business Name': !supplier.isIndividual ? (supplier.businessName || 'N/A') : 'N/A',
      'Status': supplier.status || 'Inactive',
      'Type': supplier.isIndividual ? 'Individual' : 'Business'
    }));

    // Create workbook and worksheet
    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(exportData);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Suppliers');

    // Auto-fit columns
    const colWidths = Object.keys(exportData[0]).map(key => ({
      wch: Math.max(
        key.length,
      ) + 2
    }));
    ws['!cols'] = colWidths;

    // Generate filename with current date
    const currentDate = new Date().toISOString().slice(0, 10);
    const fileName = `Supplier_Summary_${currentDate}.xlsx`;

    // Save file
    XLSX.writeFile(wb, fileName);
  }
}
