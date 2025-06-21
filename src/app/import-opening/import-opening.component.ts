import { Component } from '@angular/core';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { ProductsService } from '../services/products.service';
import { LocationService } from '../services/location.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Firestore, collection, doc, setDoc, getDoc } from '@angular/fire/firestore';

// Constants for Firestore collections
const COLLECTIONS = {
  PRODUCT_STOCK: 'product-stock',
  PRODUCTS: 'products',
  LOCATIONS: 'locations'
};

interface StockImportRow {
  'SKU': string;
  'sku'?: string;
  'Product Name'?: string;
  'Location ID': string;
  'Location Name'?: string;
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
  'Lot Number'?: string;
  'Expiry Date'?: string;
}

interface ProductStock {
  productId: string;
  productName: string;
  sku: string;
  locationId: string;
  locationName: string;
  quantity: number;
  unitCost?: number;
  lotNumber?: string;
  expiryDate?: string | null;
  createdAt: Date;
  updatedAt: Date;
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
    private locationService: LocationService,
    private firestore: Firestore,
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
    const locationId = row['Location ID'] || '';
    
    // Handle various possible column names for quantity
    const quantityValue = row['Quantity'] || row['quantity'] || row['QUANTITY'] || row['Current Quantity'] || row['New Quantity'] || '';
    
    // Handle various possible column names for unit cost
    const unitCostValue = row['Unit Cost (Before Tax)'] || row['Unit Cost'] || row['Cost'] || row['Price'] || row['New Unit Cost'] || '';
    
    // Validate SKU
    if (!sku || typeof sku !== 'string' || sku.trim() === '') {
      throw new Error('SKU is required and must be a string');
    }

    // Validate Location ID
    if (!locationId || typeof locationId !== 'string' || locationId.trim() === '') {
      throw new Error('Location ID is required and must be a string');
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

    if (isNaN(quantity) || quantity < 0) {
      throw new Error('Invalid Quantity format - must be a positive number');
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

      if (isNaN(unitCost) || unitCost < 0) {
        throw new Error('Invalid Unit Cost format - must be a positive number');
      }
    }

    // Find product by SKU
    const product = await this.productService.getProductBySku(sku.trim());
    if (!product || !product.id) {
      throw new Error(`Product with SKU ${sku} not found`);
    }

    // Verify location exists
    const locations = await this.locationService.getLocations().toPromise();
    const location = locations?.find(loc => loc.id === locationId.trim());
    if (!location) {
      throw new Error(`Location with ID ${locationId} not found`);
    }    // Create stock entry in product-stock collection
    const stockData: any = {
      productId: product.id,
      productName: product.productName,
      sku: product.sku,
      locationId: locationId.trim(),
      locationName: location.name,
      quantity: quantity,
      updatedAt: new Date(),
      createdAt: new Date(),
      lotNumber: row['Lot Number'] || '',
      expiryDate: row['Expiry Date'] || null
    };

    // Add unit cost if provided
    if (unitCost !== undefined) {
      stockData.unitCost = unitCost;
    }    // Save to product-stock collection
    const stockDocId = `${product.id}_${locationId.trim()}`;
    const stockDocRef = doc(this.firestore, COLLECTIONS.PRODUCT_STOCK, stockDocId);
    
    await setDoc(stockDocRef, stockData, { merge: true });

    console.log(`Updated stock for product ${sku} at location ${location.name}: ${quantity} units`);
  }
  downloadTemplate(): void {
    const templateData = [
      {
        'SKU': 'PROD001',
        'Product Name': 'Sample Product 1',
        'Location ID': 'LOC001',
        'Location Name': 'Warehouse A',
        'Quantity': 100,
        'Unit Cost (Before Tax)': 50.00,
        'Lot Number': 'LOT001',
        'Expiry Date': '03/25/2025'
      },
      {
        'SKU': 'PROD001',
        'Product Name': 'Sample Product 1',
        'Location ID': 'LOC002',
        'Location Name': 'Store B',
        'Quantity': 50,
        'Unit Cost (Before Tax)': 50.00,
        'Lot Number': 'LOT002',
        'Expiry Date': '03/25/2025'
      },
      {
        'SKU': 'PROD002',
        'Product Name': 'Sample Product 2',
        'Location ID': 'LOC001',
        'Location Name': 'Warehouse A',
        'Quantity': 75,
        'Unit Cost (Before Tax)': 25.00,
        'Lot Number': 'LOT003',
        'Expiry Date': '06/15/2025'
      }
    ];

    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(templateData);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ProductStockImport');
    XLSX.writeFile(wb, 'Product_Stock_Import_Template.xlsx');
  }
  async downloadCurrentStockTemplate(): Promise<void> {
    try {
      const [products, locations] = await Promise.all([
        this.productService.fetchAllProducts(),
        this.locationService.getLocations().toPromise()
      ]);

      const exportData: any[] = [];      // Create a row for each product-location combination
      for (const product of products) {
        for (const location of locations || []) {
          // Get current stock for this product at this location
          const stockQuantity = await this.getCurrentStockAtLocation(product.id || '', location.id || '');
          
          exportData.push({
            'SKU': product.sku,
            'Product Name': product.productName,
            'Location ID': location.id,
            'Location Name': location.name,
            'Current Quantity': stockQuantity,
            'Unit Cost (Before Tax)': product.defaultPurchasePriceExcTax || 0,
            'New Quantity': '',
            'New Unit Cost': '',
            'Lot Number': '',
            'Expiry Date': ''
          });
        }
      }

      const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(exportData);
      const wb: XLSX.WorkBook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'CurrentStockByLocation');
      XLSX.writeFile(wb, 'Current_Stock_By_Location_Template.xlsx');
      
      this.showMessage('Current stock template downloaded successfully!', 'success');
    } catch (error) {
      console.error('Error downloading current stock template:', error);
      this.showMessage('Error downloading current stock template', 'error');
    }
  }
  private async getCurrentStockAtLocation(productId: string, locationId: string): Promise<number> {
    try {
      const stockDocId = `${productId}_${locationId}`;
      const stockDocRef = doc(this.firestore, COLLECTIONS.PRODUCT_STOCK, stockDocId);
      const stockDoc = await getDoc(stockDocRef);
      
      if (stockDoc.exists()) {
        const data = stockDoc.data();
        return data?.['quantity'] || 0;
      }
      
      return 0;
    } catch (error) {
      console.error('Error getting stock at location:', error);
      return 0;
    }
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
