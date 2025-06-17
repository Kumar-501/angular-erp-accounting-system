import { Component } from '@angular/core';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { ProductsService } from '../services/products.service';
import { MatSnackBar } from '@angular/material/snack-bar';

interface StockImportRow {
  'SKU': string;
  'sku'?: string;
  'Quantity': string | number;
  'quantity'?: string | number;
  'QUANTITY'?: string | number;
  'Current Quantity'?: string | number;
  'New Quantity'?: string | number;
  'Unit Cost (Before Tax)'?: string | number;
  'Unit Cost'?: string | number;
  'Cost'?: string | number;
  'Price'?: string | number;
  'New Unit Cost'?: string | number;
  'Location'?: string;
  'Lot Number'?: string;
  'Expiry Date'?: string;
}

@Component({
  selector: 'app-import-opening',
  templateUrl: './import-opening.component.html',
  styleUrls: ['./import-opening.component.scss']
})
export class ImportOpeningComponent {
  selectedFile: File | null = null;
  selectedFileName: string = 'Choose File';
  isImporting: boolean = false;
  progressValue: number = 0;
  importSummary: any = {
    total: 0,
    success: 0,
    errors: 0,
    errorDetails: []
  };

  constructor(
    private productService: ProductsService,
    private snackBar: MatSnackBar
  ) {}

  onFileSelect(event: any): void {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.match(/\.(xlsx|xls)$/)) {
      this.showMessage('Please select an Excel file (.xlsx or .xls)', 'error');
      event.target.value = '';
      return;
    }

    this.selectedFile = file;
    this.selectedFileName = file.name;
  }

  async onSubmit(): Promise<void> {
    if (!this.selectedFile) {
      this.showMessage('Please select a file first', 'error');
      return;
    }

    this.isImporting = true;
    this.progressValue = 0;
    this.importSummary = {
      total: 0,
      success: 0,
      errors: 0,
      errorDetails: []
    };

    try {
      const data = await this.readExcelFile(this.selectedFile);
      this.importSummary.total = data.length;

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        try {
          await this.processStockUpdate(row, i + 2);
          this.importSummary.success++;
        } catch (error) {
          this.importSummary.errors++;
          this.importSummary.errorDetails.push({
            row: i + 2,
            sku: row['SKU'] || 'Unknown',
            error: error instanceof Error ? error.message : String(error)
          });
        }
        
        this.progressValue = Math.round(((i + 1) / data.length) * 100);
      }

      if (this.importSummary.errors > 0) {
        this.showMessage(
          `Import completed with ${this.importSummary.success} updates and ${this.importSummary.errors} errors.`,
          'warning'
        );
      } else {
        this.showMessage(
          `Successfully updated ${this.importSummary.success} products!`,
          'success'
        );
      }
    } catch (error) {
      console.error('Import error:', error);
      this.showMessage('Error processing import file', 'error');
    } finally {
      this.isImporting = false;
    }
  }

  private async processStockUpdate(row: StockImportRow, rowNumber: number): Promise<void> {
    // Extract data from row with careful handling of common formats
    const sku = row['SKU'] || row['sku'] || '';
    
    // Handle various possible column names for quantity
    const quantityValue = row['Quantity'] || row['quantity'] || row['QUANTITY'] || row['Current Quantity'] || row['New Quantity'] || '';
    
    // Handle various possible column names for unit cost
    const unitCostValue = row['Unit Cost (Before Tax)'] || row['Unit Cost'] || row['Cost'] || row['Price'] || row['New Unit Cost'] || '';
    
    // Validate SKU
    if (!sku || typeof sku !== 'string' || sku.trim() === '') {
      throw new Error('SKU is required and must be a string');
    }

    // Validate quantity - handle empty strings, null, undefined
    if (quantityValue === undefined || quantityValue === null || quantityValue === '') {
      throw new Error('Quantity is required and must be a number');
    }

    // Convert quantity to number, handling formatting issues
    let quantity: number;
    if (typeof quantityValue === 'string') {
      // Remove any non-numeric characters except decimal point
      const cleanedQuantity = quantityValue.replace(/[^\d.-]/g, '');
      quantity = Number(cleanedQuantity);
    } else {
      quantity = Number(quantityValue);
    }

    if (isNaN(quantity)) {
      throw new Error('Invalid Quantity format');
    }

    // Handle unit cost - optional but must be valid if provided
    let unitCost: number | undefined;
    if (unitCostValue !== undefined && unitCostValue !== null && unitCostValue !== '') {
      if (typeof unitCostValue === 'string') {
        // Remove any non-numeric characters except decimal point
        const cleanedUnitCost = unitCostValue.replace(/[^\d.-]/g, '');
        unitCost = Number(cleanedUnitCost);
      } else {
        unitCost = Number(unitCostValue);
      }

      if (isNaN(unitCost)) {
        throw new Error('Invalid Unit Cost format');
      }
    }

    // Find product by SKU
    const product = await this.productService.getProductBySku(sku.trim());
    if (!product || !product.id) {
      throw new Error(`Product with SKU ${sku} not found`);
    }

    // Update product data
    const updateData: any = {
      currentStock: quantity,
      updatedAt: new Date()
    };

    // Only include unit cost if it was provided and valid
    if (unitCost !== undefined) {
      updateData.defaultPurchasePriceExcTax = unitCost;
    }

    await this.productService.updateProduct(product.id, updateData);
  }

downloadTemplate(): void {
  const templateData = [
    {
      'SKU': 'PROD001',
      'Product Name': 'Sample Product',
      'Quantity': 100,
      'Unit Cost (Before Tax)': 50.00,
      'Selling Price': 75.00,
      'Location': 'Warehouse A',
      'Location ID': 'loc123',
      'HSN Code': '123456',
      'Batch Number': 'BATCH001',
      'Expiry Date': '03/25/2025',
      'Barcode Type': 'CODE128',
      'Unit': 'pcs',
      'Brand': 'Sample Brand',
      'Category': 'Sample Category',
      'Sub Category': 'Sample Subcategory',
      'Product Type': 'Standard',
      'Tax Percentage': 18,
      'Weight (kg)': 0.5,
      'Alert Quantity': 10,
      'Status': 'Active'
    }
  ];

  const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(templateData);
  const wb: XLSX.WorkBook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'OpeningStock');
  XLSX.writeFile(wb, 'OpeningStock_Template.xlsx');
}
  downloadCurrentStockTemplate(): void {
    this.productService.fetchAllProducts().then(products => {
      const exportData = products.map(product => ({
        'SKU': product.sku,
        'Product Name': product.productName,
        'Current Quantity': product.currentStock || 0,
        'Unit Cost': product.defaultPurchasePriceExcTax || 0,
        'New Quantity': '',
        'New Unit Cost': ''
      }));

      const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(exportData);
      const wb: XLSX.WorkBook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'CurrentStock');
      XLSX.writeFile(wb, 'Current_Stock_Template.xlsx');
    });
  }

  private readExcelFile(file: File): Promise<StockImportRow[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          
          // Validate that we have data
          if (!jsonData || jsonData.length === 0) {
            reject(new Error('The Excel file contains no data or is in an incorrect format'));
            return;
          }
          
          resolve(jsonData as StockImportRow[]);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('File read error'));
      reader.readAsArrayBuffer(file);
    });
  }

  private showMessage(message: string, type: 'success' | 'error' | 'warning'): void {
    this.snackBar.open(message, 'Close', {
      duration: 5000,
      panelClass: [`snackbar-${type}`]
    });
  }
}
