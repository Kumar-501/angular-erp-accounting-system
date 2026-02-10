import { Component, OnDestroy } from '@angular/core';
import { ProductsService } from '../services/products.service';
import * as XLSX from 'xlsx';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-update-price',
  templateUrl: './update-price.component.html',
  styleUrls: ['./update-price.component.scss']
})
export class UpdatePriceComponent implements OnDestroy {
  selectedFile: File | null = null;
  selectedFileName: string = '';
  exporting: boolean = false;
  importing: boolean = false;
  
  statusMessage: string = '';
  isSuccess: boolean = false;
  private subscriptions: Subscription[] = [];

  constructor(private productService: ProductsService) {}

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  // Export Firestore Data to Excel
  async exportToExcel() {
    this.exporting = true;
    this.statusMessage = 'Preparing export...';
    this.isSuccess = false;
    
    try {
      const products = await this.productService.fetchAllProducts();
      if (products.length === 0) {
        this.showStatusMessage('No products found in Firestore!', false);
        return;
      }

      // Prepare data for export with all necessary fields
      const exportData = products.map((product) => ({
        ProductName: product.productName || '',
        SKU: product.sku || '',
        DefaultSellingPriceExcTax: product.defaultSellingPriceExcTax || 0,
        DefaultSellingPriceIncTax: product.defaultSellingPriceIncTax || 0,
        DefaultPurchasePriceExcTax: product.defaultPurchasePriceExcTax || 0,
        DefaultPurchasePriceIncTax: product.defaultPurchasePriceIncTax || 0,
        UnitSellingPrice: product.unitSellingPrice || 0,
        UnitPurchasePrice: product.unitPurchasePrice || 0,
        TaxPercentage: product.taxPercentage || 0,
        MarginPercentage: product.marginPercentage || 0
      }));

      // Create workbook
      const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(exportData);
      const wb: XLSX.WorkBook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Products');

      // Auto-size columns
      const colWidths = exportData.length > 0 ? Object.keys(exportData[0]).map(key => ({
        wch: Math.max(key.length, 15)
      })) : [];
      ws['!cols'] = colWidths;

      // Generate file name with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
      const fileName = `Product_Prices_Export_${timestamp}.xlsx`;

      // Download file
      XLSX.writeFile(wb, fileName);
      this.showStatusMessage(`Successfully exported ${products.length} products!`, true);
    } catch (error) {
      console.error('Export error:', error);
      this.showStatusMessage('Error exporting product prices. Please try again.', false);
    } finally {
      this.exporting = false;
    }
  }

  // Handle File Selection
  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      // Check file type
      if (!file.name.match(/\.(xlsx|xls)$/)) {
        this.showStatusMessage('Please select an Excel file (.xlsx or .xls)', false);
        event.target.value = ''; // Clear file input
        return;
      }
      
      this.selectedFile = file;
      this.selectedFileName = file.name;
      this.statusMessage = '';
    }
  }

  // Import & Update Prices
  async importUpdatedPrices() {
    if (!this.selectedFile) {
      this.showStatusMessage('Please select a file first!', false);
      return;
    }

    this.importing = true;
    this.statusMessage = 'Processing import...';
    this.isSuccess = false;

    const reader = new FileReader();
    
    reader.onload = async (e: any) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

        if (jsonData.length === 0) {
          this.showStatusMessage('No data found in the Excel file', false);
          return;
        }

        // Validate required fields
        const firstRow = jsonData[0];
        const requiredFields = ['SKU'];
        const missingFields = requiredFields.filter(field => !firstRow.hasOwnProperty(field));
        
        if (missingFields.length > 0) {
          this.showStatusMessage(`Excel file must contain required columns: ${missingFields.join(', ')}`, false);
          return;
        }

        let successCount = 0;
        let errorCount = 0;
        const errors: string[] = [];
        const updatePromises: Promise<void>[] = [];

        // Process each product
        for (let i = 0; i < jsonData.length; i++) {
          const product = jsonData[i];
          const rowNumber = i + 2; // Excel row number (accounting for header)
          
          try {
            if (!product.SKU || product.SKU.toString().trim() === '') {
              errors.push(`Row ${rowNumber}: Missing or empty SKU`);
              errorCount++;
              continue;
            }

            // Prepare update data object
            const updateData: any = {};
            let hasValidUpdate = false;

            // Process all price fields
            const priceFields = [
              'DefaultSellingPriceExcTax',
              'DefaultSellingPriceIncTax', 
              'DefaultPurchasePriceExcTax',
              'DefaultPurchasePriceIncTax',
              'UnitSellingPrice',
              'UnitPurchasePrice'
            ];

            priceFields.forEach(field => {
              if (product.hasOwnProperty(field) && product[field] !== null && product[field] !== undefined) {
                const value = Number(product[field]);
                if (!isNaN(value) && value >= 0) {
                  // Convert field name to camelCase to match database schema
                  const dbFieldName = field.charAt(0).toLowerCase() + field.slice(1);
                  updateData[dbFieldName] = value;
                  hasValidUpdate = true;
                }
              }
            });

            // Process percentage fields
            const percentageFields = ['TaxPercentage', 'MarginPercentage'];
            percentageFields.forEach(field => {
              if (product.hasOwnProperty(field) && product[field] !== null && product[field] !== undefined) {
                const value = Number(product[field]);
                if (!isNaN(value) && value >= 0 && value <= 100) {
                  const dbFieldName = field.charAt(0).toLowerCase() + field.slice(1);
                  updateData[dbFieldName] = value;
                  hasValidUpdate = true;
                }
              }
            });

            if (!hasValidUpdate) {
              errors.push(`Row ${rowNumber}: No valid price updates found`);
              errorCount++;
              continue;
            }

            // Add update timestamp
            updateData.updatedAt = new Date();
            updateData.lastUpdated = new Date();

            // Create update promise
            const updatePromise = this.productService.updateProductBySKU(product.SKU.toString().trim(), updateData)
              .then(() => {
                successCount++;
              })
              .catch((error) => {
                console.error(`Error updating product ${product.SKU}:`, error);
                errors.push(`Row ${rowNumber}: Failed to update - ${error.message || 'Unknown error'}`);
                errorCount++;
              });

            updatePromises.push(updatePromise);

          } catch (error) {
            console.error(`Error processing row ${rowNumber}:`, error);
            errors.push(`Row ${rowNumber}: ${error instanceof Error ? error.message : String(error)}`);
            errorCount++;
          }
        }

        // Execute all updates
        this.statusMessage = 'Updating products in database...';
        await Promise.all(updatePromises);

        // Add a small delay to ensure all updates are processed
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Show results
        if (errorCount === 0) {
          this.showStatusMessage(`Successfully updated ${successCount} products! Changes will be reflected in the product list.`, true);
        } else if (successCount > 0) {
          this.showStatusMessage(
            `Updated ${successCount} products successfully. ${errorCount} products had errors. Check console for details.`,
            true
          );
          console.error('Import errors:', errors);
        } else {
          this.showStatusMessage(
            `Failed to update any products. ${errorCount} errors occurred. Check console for details.`,
            false
          );
          console.error('Import errors:', errors);
        }

        // Reset file input
        this.clearFileSelection();

        // Force a refresh of the products list by emitting an event
        this.triggerProductListRefresh();

      } catch (error) {
        console.error('Import processing error:', error);
        this.showStatusMessage('Error processing the Excel file. Please check the format and try again.', false);
      } finally {
        this.importing = false;
      }
    };

    reader.onerror = () => {
      this.showStatusMessage('Error reading the file. Please try again.', false);
      this.importing = false;
    };

    reader.readAsArrayBuffer(this.selectedFile);
  }

// Change from:
// private clearFileSelection() {

// To:
public clearFileSelection() {
  this.selectedFile = null;
  this.selectedFileName = '';
  const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
  if (fileInput) {
    fileInput.value = '';
  }
}

  private triggerProductListRefresh() {
    // Emit a custom event to notify other components that products have been updated
    window.dispatchEvent(new CustomEvent('productsUpdated', {
      detail: { source: 'price-update', timestamp: new Date() }
    }));
  }

  private showStatusMessage(message: string, isSuccess: boolean) {
    this.statusMessage = message;
    this.isSuccess = isSuccess;
    
    // Auto-hide success messages after 5 seconds, keep error messages longer
    const hideDelay = isSuccess ? 5000 : 8000;
    setTimeout(() => {
      this.statusMessage = '';
    }, hideDelay);
  }

  // Method to clear status message manually
  clearStatusMessage() {
    this.statusMessage = '';
  }

  // Method to download sample Excel template
  downloadSampleTemplate() {
    const sampleData = [
      {
        ProductName: 'Sample Product 1',
        SKU: 'SKU001',
        DefaultSellingPriceExcTax: 100.00,
        DefaultSellingPriceIncTax: 118.00,
        DefaultPurchasePriceExcTax: 80.00,
        DefaultPurchasePriceIncTax: 94.40,
        UnitSellingPrice: 100.00,
        UnitPurchasePrice: 80.00,
        TaxPercentage: 18.00,
        MarginPercentage: 25.00
      },
      {
        ProductName: 'Sample Product 2',
        SKU: 'SKU002',
        DefaultSellingPriceExcTax: 200.00,
        DefaultSellingPriceIncTax: 236.00,
        DefaultPurchasePriceExcTax: 160.00,
        DefaultPurchasePriceIncTax: 188.80,
        UnitSellingPrice: 200.00,
        UnitPurchasePrice: 160.00,
        TaxPercentage: 18.00,
        MarginPercentage: 25.00
      }
    ];

    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(sampleData);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sample');

    // Auto-size columns
    const colWidths = Object.keys(sampleData[0]).map(key => ({
      wch: Math.max(key.length, 15)
    }));
    ws['!cols'] = colWidths;

    const fileName = 'Product_Price_Update_Template.xlsx';
    XLSX.writeFile(wb, fileName);

    this.showStatusMessage('Sample template downloaded successfully!', true);
  }
}