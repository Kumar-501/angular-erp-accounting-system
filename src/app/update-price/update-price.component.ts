import { Component } from '@angular/core';
import { ProductsService } from '../services/products.service';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-update-price',
  templateUrl: './update-price.component.html',
  styleUrls: ['./update-price.component.scss']
})
export class UpdatePriceComponent {
  selectedFile: File | null = null;
  selectedFileName: string = '';
  exporting: boolean = false;
  importing: boolean = false;
  statusMessage: string = '';
  isSuccess: boolean = false;

  constructor(private productService: ProductsService) {}

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

      // Prepare data for export
      const exportData = products.map((product) => ({
        name: product.productName,
        SKU: product.sku,
        SellingPrice: product.defaultSellingPriceExcTax,
        DefaultPurchasePrice: product.defaultPurchasePriceExcTax
      }));

      // Create workbook
      const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(exportData);
      const wb: XLSX.WorkBook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Products');

      // Generate file name with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `Product_Prices_${timestamp}.xlsx`;  // Fixed the template string

      // Download file
      XLSX.writeFile(wb, fileName);
      this.showStatusMessage(`Exported ${products.length} products successfully!`, true); // Fixed string interpolation
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
        if (!firstRow.SKU || !firstRow.SellingPrice) {
          this.showStatusMessage('Excel file must contain SKU and SellingPrice columns', false);
          return;
        }

        let successCount = 0;
        let errorCount = 0;
        const errors: string[] = [];

        // Process each product
        for (const product of jsonData) {
          try {
            if (!product.SKU) {
              errors.push(`Row ${jsonData.indexOf(product) + 2}: Missing SKU`);
              errorCount++;
              continue;
            }

            // Convert prices to numbers
            const sellingPrice = Number(product.SellingPrice);
            const purchasePrice = Number(product.DefaultPurchasePrice || 0);

            if (isNaN(sellingPrice)) {
              errors.push(`Row ${jsonData.indexOf(product) + 2}: Invalid SellingPrice`);
              errorCount++;
              continue;
            }

            // Update product in Firestore
            await this.productService.updateProductBySKU(product.SKU, {
              defaultSellingPriceExcTax: sellingPrice,
              defaultPurchasePriceExcTax: purchasePrice
            });

            successCount++;
          } catch (error) {
            console.error(`Error updating product ${product.SKU}:`, error);
            errors.push(`Row ${jsonData.indexOf(product) + 2}: ${error instanceof Error ? error.message : String(error)}`);
            errorCount++;
          }
        }

        // Show results
        if (errorCount === 0) {
          this.showStatusMessage(`Successfully updated ${successCount} products!`, true); // Fixed string interpolation
        } else {
          const errorDetails = errors.join('\n');
          this.showStatusMessage(
            `Updated ${successCount} products, ${errorCount} errors occurred. Details in console.`,
            false
          );
          console.error('Import errors:', errors);
        }

        // Reset file input
        this.selectedFile = null;
        this.selectedFileName = '';
        const fileInput = document.querySelector('.file-input') as HTMLInputElement;
        if (fileInput) fileInput.value = '';

      } catch (error) {
        console.error('Import processing error:', error);
        this.showStatusMessage('Error processing the Excel file. Please check the format.', false);
      } finally {
        this.importing = false;
      }
    };

    reader.onerror = () => {
      this.showStatusMessage('Error reading the file', false);
      this.importing = false;
    };

    reader.readAsArrayBuffer(this.selectedFile);
  }

  private showStatusMessage(message: string, isSuccess: boolean) {
    this.statusMessage = message;
    this.isSuccess = isSuccess;
    setTimeout(() => {
      this.statusMessage = '';
    }, 5000);
  }
}
