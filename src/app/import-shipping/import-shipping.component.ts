import { Component } from '@angular/core';
import { SaleService } from '../services/sale.service';

interface ImportResult {
  totalProcessed: number;
  updated: number;
  skipped: number;
  errors: number;
  errorDetails: ErrorDetail[];
  successDetails: SuccessDetail[];
}

interface ErrorDetail {
  row: number;
  barcode: string;
  addrmobile: string;
  error: string;
}

interface SuccessDetail {
  row: number;
  invoiceNo: string;
  customer: string;
  barcode: string;
  status: string;
}

interface CsvRow {
  BARCODE?: string;
  ADDRMOBILE?: string;
  REF?: string;
  Name?: string;
  City?: string;
  Pincode?: string;
  ADD1?: string;
  ADD2?: string;
  ADD3?: string;
  ADDREMAIL?: string;
  SENDERMOBILE?: string;
  Weight?: string;
  COD?: string;
  InsVal?: string;
  [key: string]: any;
}

@Component({
  selector: 'app-import-shipping',
  templateUrl: './import-shipping.component.html',
  styleUrls: ['./import-shipping.component.scss']
})
export class ImportShippingComponent {
  selectedFile: File | null = null;
  isLoading = false;
  importResult: ImportResult | null = null;
  showErrorDetails = false;
  showSuccessDetails = false;
  processingProgress = 0;
  currentRowIndex = 0;
  totalRows = 0;

  // Template headers - all available columns
  private templateHeaders = [
    'BARCODE', 'ADDRMOBILE', 'REF', 'Name', 'City', 'Pincode', 
    'ADD1', 'ADD2', 'ADD3', 'ADDREMAIL', 'SENDERMOBILE', 
    'Weight', 'COD', 'InsVal', 'VPP', 'L', 'B', 'H', 'D',
    'ArticleShape', 'ContentType', 'Priority', 'AltAddress1',
    'AltAddress2', 'AltAddress3', 'AltCity', 'AltState', 
    'AltPincode', 'DeliveryAddType', 'DeliveryTime', 
    'DeliveryDate', 'ReferenceNo', 'OtpDelivery', 'SpdsDelivery'
  ];

  constructor(private saleService: SaleService) {}

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    
    if (!file) {
      this.selectedFile = null;
      return;
    }

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.csv')) {
      alert('Please select a CSV file.');
      event.target.value = '';
      this.selectedFile = null;
      return;
    }

    // Validate file size (5MB limit)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (file.size > maxSize) {
      alert('File size exceeds 5MB limit. Please select a smaller file.');
      event.target.value = '';
      this.selectedFile = null;
      return;
    }

    this.selectedFile = file;
    this.importResult = null;
    this.showErrorDetails = false;
    this.showSuccessDetails = false;
  }

  async onSubmit(): Promise<void> {
    if (!this.selectedFile) {
      alert('Please select a file first.');
      return;
    }

    this.isLoading = true;
    this.processingProgress = 0;
    this.currentRowIndex = 0;
    this.importResult = null;

    try {
      const csvData = await this.parseCsvFile(this.selectedFile);
      await this.processImportData(csvData);
    } catch (error) {
      console.error('Import failed:', error);
      alert('Import failed. Please check the file format and try again.');
    } finally {
      this.isLoading = false;
      this.processingProgress = 0;
      this.currentRowIndex = 0;
      this.totalRows = 0;
    }
  }

  private parseCsvFile(file: File): Promise<CsvRow[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const csv = e.target?.result as string;
          const lines = csv.split('\n');
          const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
          
          const data: CsvRow[] = [];
          for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim()) {
              const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
              const row: CsvRow = {};
              headers.forEach((header, index) => {
                row[header] = values[index] || '';
              });
              data.push(row);
            }
          }
          resolve(data);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  private async processImportData(csvData: CsvRow[]): Promise<void> {
    this.totalRows = csvData.length;
    const result: ImportResult = {
      totalProcessed: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      errorDetails: [],
      successDetails: []
    };

    // Get all sales data once at the beginning
    const allSales = await this.getAllSalesFromFirestore();
    
    for (let i = 0; i < csvData.length; i++) {
      this.currentRowIndex = i + 1;
      this.processingProgress = Math.round((i / csvData.length) * 100);
      
      const row = csvData[i];
      const rowNumber = i + 2; // +2 because CSV row numbers start from 2 (after header)
      
      try {
        await this.processRow(row, rowNumber, allSales, result);
      } catch (error) {
        console.error(`Error processing row ${rowNumber}:`, error);
        result.errors++;
        result.errorDetails.push({
          row: rowNumber,
          barcode: row.BARCODE || '',
          addrmobile: row.ADDRMOBILE || '',
          error: 'Unexpected error occurred'
        });
      }
      
      result.totalProcessed++;
      
      // Add small delay to show progress
      if (i % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    this.importResult = result;
  }

  private async getAllSalesFromFirestore(): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const subscription = this.saleService.listenForSales().subscribe({
        next: (sales) => {
          subscription.unsubscribe();
          resolve(sales);
        },
        error: (error) => {
          subscription.unsubscribe();
          reject(error);
        }
      });
    });
  }

  private async processRow(
    row: CsvRow, 
    rowNumber: number, 
    allSales: any[], 
    result: ImportResult
  ): Promise<void> {
    // Validate mandatory fields
    const barcode = row.BARCODE?.toString().trim();
    const addrmobile = row.ADDRMOBILE?.toString().trim();

    if (!barcode) {
      result.errors++;
      result.errorDetails.push({
        row: rowNumber,
        barcode: '',
        addrmobile: addrmobile || '',
        error: 'BARCODE is mandatory but missing'
      });
      return;
    }

    if (!addrmobile) {
      result.errors++;
      result.errorDetails.push({
        row: rowNumber,
        barcode: barcode,
        addrmobile: '',
        error: 'ADDRMOBILE is mandatory but missing'
      });
      return;
    }

    // Find matching sales by contact number
    const matchingSales = allSales.filter(sale => 
      sale.customerPhone === addrmobile || 
      sale.customer_phone === addrmobile ||
      sale.contactNumber === addrmobile
    );

    if (matchingSales.length === 0) {
      result.errors++;
      result.errorDetails.push({
        row: rowNumber,
        barcode: barcode,
        addrmobile: addrmobile,
        error: `No sale found with contact number: ${addrmobile}`
      });
      return;
    }

    // Try to find a specific sale with the barcode
    let targetSale = matchingSales.find(sale => 
      sale.barcodeNumber === barcode ||
      sale.barcode === barcode ||
      (sale.products && sale.products.some((p: any) => p.barcode === barcode))
    );

    // If no specific barcode match, use the first matching sale by contact number
    if (!targetSale) {
      targetSale = matchingSales[0];
    }

    try {
      // Format shipping details
      const shippingDetails = this.formatShippingDetails(row);
      
      // Update the sale with shipping information
      const updateData: {
        shippingDetails: string;
        shippingStatus: string;
        barcodeNumber: string;
        updatedAt: Date;
        lastUpdatedBy: string;
        refNumber?: string;
      } = {
        shippingDetails: shippingDetails,
        shippingStatus: 'Shipped',
        barcodeNumber: barcode,
        updatedAt: new Date(),
        lastUpdatedBy: 'Shipping Import'
      };

      // Add reference number if provided
      if (row.REF) {
        updateData.refNumber = row.REF.toString().trim();
      }

      await this.saleService['updateSale'](targetSale.id, updateData);
      
      result.updated++;
      result.successDetails.push({
        row: rowNumber,
        invoiceNo: targetSale.invoiceNo || 'N/A',
        customer: targetSale.customer || 'N/A',
        barcode: barcode,
        status: 'Updated successfully'
      });

    } catch (error) {
      console.error(`Error updating sale ${targetSale.id}:`, error);
      result.errors++;
      result.errorDetails.push({
        row: rowNumber,
        barcode: barcode,
        addrmobile: addrmobile,
        error: `Failed to update sale: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  private formatShippingDetails(row: CsvRow): string {
    const details: string[] = [];
    
    // Add all available fields to shipping details
    Object.keys(row).forEach(key => {
      const value = row[key];
      if (value && value.toString().trim() !== '') {
        details.push(`${key}: ${value.toString().trim()}`);
      }
    });

    return details.join('\n');
  }

  // Download template with all available fields
  downloadTemplate(): void {
    // Create sample data
    const sampleData: any = {};
    this.templateHeaders.forEach(header => {
      switch (header) {
        case 'BARCODE':
          sampleData[header] = 'BC123456';
          break;
        case 'ADDRMOBILE':
          sampleData[header] = '9876543210';
          break;
        case 'REF':
          sampleData[header] = 'REF123';
          break;
        case 'Name':
          sampleData[header] = 'John Doe';
          break;
        case 'City':
          sampleData[header] = 'Mumbai';
          break;
        case 'Pincode':
          sampleData[header] = '400001';
          break;
        case 'ADD1':
          sampleData[header] = 'Flat 101';
          break;
        case 'ADD2':
          sampleData[header] = 'Sunshine Apartments';
          break;
        case 'ADD3':
          sampleData[header] = 'Main Road';
          break;
        case 'ADDREMAIL':
          sampleData[header] = 'john@example.com';
          break;
        case 'SENDERMOBILE':
          sampleData[header] = '9876543210';
          break;
        case 'Weight':
          sampleData[header] = '1.5';
          break;
        case 'COD':
          sampleData[header] = '500';
          break;
        default:
          sampleData[header] = '';
      }
    });

    // Create CSV content
    const csvContent = this.templateHeaders.join(',') + '\n' + 
                      this.templateHeaders.map(header => sampleData[header]).join(',');

    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', 'shipping_import_template.csv');
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}