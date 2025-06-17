import { Component } from '@angular/core';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { ProductsService } from '../services/products.service';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-import-products',
  templateUrl: './import-products.component.html',
  styleUrls: ['./import-products.component.scss']
})
export class ImportProductsComponent {
  selectedFile: File | null = null;
  selectedFileName: string = '';
  isImporting: boolean = false;
  progressValue: number = 0;
  importSummary: any = {
    total: 0,
    success: 0,
    errors: 0,
    errorDetails: []
  };
  previewData: any[] = [];
  showPreview: boolean = false;
  columnInstructions = [
    { num: 1, name: 'Product Name (Required)', instruction: 'Name of the product' },
    { num: 2, name: 'Brand (Optional)', instruction: 'Name of the brand (If not found new brand with the given name will be created)' },
    { num: 3, name: 'Unit (Required)', instruction: 'Name of the unit' },
    { num: 4, name: 'Category (Optional)', instruction: 'Name of the Category (If not found new category with the given name will be created)' },
    { num: 5, name: 'Sub category (Optional)', instruction: 'Name of the Sub-Category (If not found new sub-category with the given name under the parent Category will be created)' },
    { num: 6, name: 'SKU (Optional)', instruction: 'Product SKU. If blank an SKU will be automatically generated' },
    { num: 7, name: 'Barcode Type (Optional, Default: C128)', instruction: 'Barcode Type for the product. **Currently supported: C128, C39, EAN-13, EAN-8, UPC-A, UPC-E, ITF-14**' },
    { num: 8, name: 'Manage Stock? (Required)', instruction: 'Enable or disable stock managemant **1 = Yes 0 = No**' },
    { num: 9, name: 'Alert quantity (Optional)', instruction: 'Alert quantity' },
    { num: 10, name: 'Expires in (Optional)', instruction: 'Product expiry period (Only in numbers)' },
    { num: 11, name: 'Expiry Period Unit (Optional)', instruction: 'Unit for the expiry period **Available Options: days, months**' },
    { num: 12, name: 'Applicable Tax (Optional)', instruction: 'Name of the Tax Rate If purchase Price (Excluding Tax) is not same as Purchase Price (Including Tax) then you must supply the tax rate name.' },
    { num: 13, name: 'Selling Price Tax Type (Required)', instruction: 'Selling Price Tax Type **Available Options: inclusive, exclusive**' },
    { num: 14, name: 'Product Type (Required)', instruction: 'Product Type **Available Options: single, variable**' },
    { num: 15, name: 'Variation Name (Required if product type is variable)', instruction: 'Name of the variation (Ex: Size, Color etc )' },
    { num: 16, name: 'Variation Values (Required if product type is variable)', instruction: 'Values for the variation separated with \'|\' (Ex: Red|Blue|Green)' },
    { num: 17, name: 'Variation SKUs (Optional)', instruction: 'SKUs of each variations separated by "|" if product type is variable' },
    { num: 18, name: 'Purchase Price (Including Tax)', instruction: '(Required if Purchase Price Excluding Tax is not given) Purchase Price (Including Tax) (Only in numbers) For variable products \'|\' separated values with the same order as Variation Values (Ex: 84|85|88)' },
    { num: 19, name: 'Purchase Price (Excluding Tax)', instruction: '(Required if Purchase Price Including Tax is not given) Purchase Price (Excluding Tax) (Only in numbers) For variable products \'|\' separated values with the same order as Variation Values (Ex: 84|85|88)' },
    { num: 20, name: 'Profit Margin % (Optional)', instruction: 'Profit Margin (Only in numbers) If blank default profit margin for the business will be used' },
    { num: 21, name: 'Selling Price (Optional)', instruction: 'Selling Price (Only in numbers) If blank selling price will be calculated with the given Purchase Price and Applicable Tax' },
    { num: 22, name: 'Opening Stock (Optional)', instruction: 'Opening Stock (Only in numbers) For variable products separate stock quantities with \'|\' (Ex: 100|150|200)' },
    { num: 23, name: 'Opening stock location (Optional)', instruction: 'If blank first business location will be used. Name of the business location' },
    { num: 24, name: 'Expiry Date (Optional)', instruction: 'Stock Expiry Date **Format: mm-dd-yyyy; Ex: 11-25-2018**' },
    { num: 25, name: 'Enable Product description, IMEI or Serial Number (Optional, Default: 0)', instruction: '**1 = Yes 0 = No**' },
    { num: 26, name: 'Weight (Optional)', instruction: 'Optional' },
    { num: 27, name: 'Rack (Optional)', instruction: 'Rack details seperated by \'|\' for different business locations serially. (Ex: R1|R5|R12)' },
    { num: 28, name: 'Row (Optional)', instruction: 'Row details seperated by \'|\' for different business locations serially. (Ex: ROW1|ROW2|ROW3)' },
    { num: 29, name: 'Position (Optional)', instruction: 'Position details seperated by \'|\' for different business locations serially. (Ex: POS1|POS2|POS3)' },
    { num: 30, name: 'Image (Optional)', instruction: 'Image name with extension. (Image name must be uploaded to the server public/uploads/img ) Or URL of the image' },
    { num: 31, name: 'Product Description (Optional)', instruction: '' },
    { num: 32, name: 'Custom Field1 (Optional)', instruction: '' },
    { num: 33, name: 'Custom Field2 (Optional)', instruction: '' },
    { num: 34, name: 'Custom Field3 (Optional)', instruction: '' },
    { num: 35, name: 'Custom Field4 (Optional)', instruction: '' },
    { num: 36, name: 'Not for selling (Optional)', instruction: '**1 = Yes 0 = No**' },
    { num: 37, name: 'Product locations (Optional)', instruction: 'Comma separated string of business location names where product will be available' }
  ];

  constructor(
    private productService: ProductsService,
    private snackBar: MatSnackBar
  ) {}

  // Get headers for preview table
  getPreviewHeaders(): string[] {
    if (this.previewData && this.previewData.length > 0) {
      return Object.keys(this.previewData[0]);
    }
    return [];
  }

  // Handle file selection
  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.match(/\.(xlsx|xls)$/)) {
      this.showMessage('Please select an Excel file (.xlsx or .xls)', 'error');
      event.target.value = '';
      return;
    }

    this.selectedFile = file;
    this.selectedFileName = file.name;
    this.previewFile(file);
  }

  // Preview file contents
  previewFile(file: File): void {
    const reader = new FileReader();
    reader.onload = (e: any) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      this.previewData = XLSX.utils.sheet_to_json(worksheet, { raw: true });
      this.showPreview = true;
    };
    reader.readAsArrayBuffer(file);
  }

  // Download template
  downloadTemplate(): void {
    const templateData = [
      {
        'Product Name (Required)': '',
        'Brand (Optional)': '',
        'Unit (Required)': '',
        'Category (Optional)': '',
        'Sub category (Optional)': '',
        'SKU (Optional)': '',
        'Barcode Type (Optional, Default: C128)': 'C128',
        'Manage Stock? (Required)': '1',
        'Alert quantity (Optional)': '',
        'Expires in (Optional)': '',
        'Expiry Period Unit (Optional)': '',
        'Applicable Tax (Optional)': '',
        'Selling Price Tax Type (Required)': 'exclusive',
        'Product Type (Required)': 'single',
        'Variation Name (Required if product type is variable)': '',
        'Variation Values (Required if product type is variable)': '',
        'Variation SKUs (Optional)': '',
        'Purchase Price (Including Tax)': '',
        'Purchase Price (Excluding Tax)': '',
        'Profit Margin % (Optional)': '',
        'Selling Price (Optional)': '',
        'Opening Stock (Optional)': '',
        'Opening stock location (Optional)': '',
        'Expiry Date (Optional)': '',
        'Enable Product description, IMEI or Serial Number (Optional, Default: 0)': '0',
        'Weight (Optional)': '',
        'Rack (Optional)': '',
        'Row (Optional)': '',
        'Position (Optional)': '',
        'Image (Optional)': '',
        'Product Description (Optional)': '',
        'Custom Field1 (Optional)': '',
        'Custom Field2 (Optional)': '',
        'Custom Field3 (Optional)': '',
        'Custom Field4 (Optional)': '',
        'Not for selling (Optional)': '0',
        'Product locations (Optional)': ''
      },
      {
        'Product Name (Required)': 'Example Product',
        'Brand (Optional)': 'Example Brand',
        'Unit (Required)': 'pcs',
        'Category (Optional)': 'Electronics',
        'Sub category (Optional)': 'Mobile Accessories',
        'SKU (Optional)': 'PROD001',
        'Barcode Type (Optional, Default: C128)': 'C128',
        'Manage Stock? (Required)': '1',
        'Alert quantity (Optional)': '10',
        'Selling Price Tax Type (Required)': 'exclusive',
        'Product Type (Required)': 'single',
        'Purchase Price (Excluding Tax)': '100',
        'Profit Margin % (Optional)': '25',
        'Selling Price (Optional)': '125',
        'Opening Stock (Optional)': '50',
        'Enable Product description, IMEI or Serial Number (Optional, Default: 0)': '0',
        'Not for selling (Optional)': '0'
      }
    ];

    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(templateData);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ProductsTemplate');
    XLSX.writeFile(wb, 'Product_Import_Template.xlsx');
  }

  // Import products from Excel
  async importProducts(): Promise<void> {
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
          const product = this.mapExcelToProduct(row);
          await this.productService.addProduct(product);
          this.importSummary.success++;
        } catch (error) {
          this.importSummary.errors++;
          this.importSummary.errorDetails.push({
            row: i + 2,
            productName: row['Product Name (Required)'] || 'Unknown',
            error: error instanceof Error ? error.message : String(error)
          });
        }
        
        this.progressValue = Math.round(((i + 1) / data.length) * 100);
      }

      if (this.importSummary.errors > 0) {
        this.showMessage(
          `Import completed with ${this.importSummary.success} successes and ${this.importSummary.errors} errors.`,
          'warning'
        );
      } else {
        this.showMessage(
          `Successfully imported ${this.importSummary.success} products!`,
          'success'
        );
      }
    } catch (error) {
      console.error('Import error:', error);
      this.showMessage('Error processing import file', 'error');
    } finally {
      this.isImporting = false;
      this.showPreview = false;
    }
  }

  // Map Excel row to Product interface
  private mapExcelToProduct(row: any): any {
    if (!row['Product Name (Required)']) {
      throw new Error('Product name is required');
    }
    if (!row['Unit (Required)']) {
      throw new Error('Unit is required');
    }
    if (!row['Manage Stock? (Required)']) {
      throw new Error('Manage Stock flag is required');
    }
    if (!row['Selling Price Tax Type (Required)']) {
      throw new Error('Selling Price Tax Type is required');
    }
    if (!row['Product Type (Required)']) {
      throw new Error('Product Type is required');
    }

    return {
      productName: row['Product Name (Required)'],
      sku: row['SKU (Optional)'] || this.generateSKU(row['Product Name (Required)']),
      barcodeType: row['Barcode Type (Optional, Default: C128)'] || 'C128',
      unit: row['Unit (Required)'],
      brand: row['Brand (Optional)'] || '',
      category: row['Category (Optional)'] || '',
      subCategory: row['Sub category (Optional)'] || '',
      manageStock: row['Manage Stock? (Required)'] === '1',
      alertQuantity: row['Alert quantity (Optional)'] ? Number(row['Alert quantity (Optional)']) : null,
      productDescription: row['Product Description (Optional)'] || '',
      productImage: row['Image (Optional)'] || null,
      enableProductDescription: row['Enable Product description, IMEI or Serial Number (Optional, Default: 0)'] === '1',
      notForSelling: row['Not for selling (Optional)'] === '1',
      weight: row['Weight (Optional)'] ? Number(row['Weight (Optional)']) : null,
      applicableTax: row['Applicable Tax (Optional)'] || '',
      taxPercentage: 0,
      sellingPriceTaxType: row['Selling Price Tax Type (Required)'],
      productType: row['Product Type (Required)'],
      defaultPurchasePriceExcTax: row['Purchase Price (Excluding Tax)'] ? Number(row['Purchase Price (Excluding Tax)']) : null,
      defaultPurchasePriceIncTax: row['Purchase Price (Including Tax)'] ? Number(row['Purchase Price (Including Tax)']) : null,
      marginPercentage: row['Profit Margin % (Optional)'] ? Number(row['Profit Margin % (Optional)']) : 25,
      defaultSellingPriceExcTax: row['Selling Price (Optional)'] ? Number(row['Selling Price (Optional)']) : null,
      defaultSellingPriceIncTax: null,
      currentStock: row['Opening Stock (Optional)'] ? Number(row['Opening Stock (Optional)']) : 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresIn: row['Expires in (Optional)'] ? Number(row['Expires in (Optional)']) : null,
      expiryPeriodUnit: row['Expiry Period Unit (Optional)'] || null,
      openingStockLocation: row['Opening stock location (Optional)'] || '',
      expiryDate: row['Expiry Date (Optional)'] || null,
      rack: row['Rack (Optional)'] || '',
      row: row['Row (Optional)'] || '',
      position: row['Position (Optional)'] || '',
      customField1: row['Custom Field1 (Optional)'] || '',
      customField2: row['Custom Field2 (Optional)'] || '',
      customField3: row['Custom Field3 (Optional)'] || '',
      customField4: row['Custom Field4 (Optional)'] || '',
      productLocations: row['Product locations (Optional)'] || '',
      // For variable products
      variationName: row['Variation Name (Required if product type is variable)'] || '',
      variationValues: row['Variation Values (Required if product type is variable)'] || '',
      variationSKUs: row['Variation SKUs (Optional)'] || ''
    };
  }

  // Generate SKU if not provided
  private generateSKU(productName: string): string {
    const prefix = productName.substring(0, 3).toUpperCase();
    const random = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}${random}`;
  }

  // Read Excel file
  private readExcelFile(file: File): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          resolve(XLSX.utils.sheet_to_json(worksheet));
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('File read error'));
      reader.readAsArrayBuffer(file);
    });
  }

  // Download error report
  downloadErrorReport(): void {
    if (this.importSummary.errorDetails.length === 0) return;

    const csvContent = this.convertToCSV(this.importSummary.errorDetails);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'Product_Import_Errors.csv');
  }

  // Convert data to CSV
  private convertToCSV(items: any[]): string {
    const header = Object.keys(items[0]).join(',');
    const rows = items.map(item => 
      Object.values(item).map(v => 
        typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : v
      ).join(',')
    );
    return [header, ...rows].join('\n');
  }

  // Show snackbar message
  private showMessage(message: string, type: 'success' | 'error' | 'warning'): void {
    this.snackBar.open(message, 'Close', {
      duration: 5000,
      panelClass: [`snackbar-${type}`]
    });
  }
}