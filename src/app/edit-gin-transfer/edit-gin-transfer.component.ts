import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ProductsService } from '../services/products.service';
import { LocationService } from '../services/location.service';
import { GinTransferService, GinTransfer, GinTransferItem } from '../services/gin-transfer.service';
import { formatDate } from '@angular/common';
import { Firestore, collection, doc, setDoc, getDoc, getDocs } from '@angular/fire/firestore';

// Constants for Firestore collections
const COLLECTIONS = {
  PRODUCT_STOCK: 'product-stock',
  PRODUCTS: 'products',
  LOCATIONS: 'locations'
};

interface Product {
  id?: string;
  productName: string;
  sku: string;
  unit: string;
  defaultSellingPriceExcTax: number | null;
  currentStock: number;
}

@Component({
  selector: 'app-edit-gin-transfer',
  templateUrl: './edit-gin-transfer.component.html',
  styleUrls: ['./edit-gin-transfer.component.scss']
})
export class EditGinTransferComponent implements OnInit {
  ginTransferForm: FormGroup;
  locations: any[] = [];
  products: Product[] = [];
  filteredProducts: Product[] = [];
  selectedProducts: GinTransferItem[] = [];
  searchTerm: string = '';  showSearchResults: boolean = false;
  transferId: string = '';
  isEditing = false;
  originalStatus: string = ''; // Track the original status to detect changes
  constructor(
    private fb: FormBuilder,
    private productsService: ProductsService,
    private locationService: LocationService,
    private ginTransferService: GinTransferService,
    private route: ActivatedRoute,
    private router: Router,
    private firestore: Firestore
  ) {
    this.ginTransferForm = this.fb.group({
      date: ['', Validators.required],
      referenceNo: [''],
      locationFrom: ['', Validators.required],
      locationTo: ['', Validators.required],
      locationTo2: [''],
      status: ['', Validators.required],
      shippingCharges: [0],
      additionalNotes: ['']
    });
  }

  ngOnInit(): void {
    this.transferId = this.route.snapshot.paramMap.get('id') || '';
    this.loadLocations();
    this.loadProducts();
    
    if (this.transferId) {
      this.loadGinTransfer(this.transferId);
    }
  }
  loadGinTransfer(id: string) {
    this.isEditing = true;
    this.ginTransferService.getGinTransfer(id).then(transfer => {
      if (transfer) {
        // Store the original status to detect changes
        this.originalStatus = transfer.status;
        
        this.ginTransferForm.patchValue({
          date: transfer.date,
          referenceNo: transfer.referenceNo,
          locationFrom: transfer.locationFrom,
          locationTo: transfer.locationTo,
          locationTo2: transfer.locationTo2 || '',
          status: transfer.status,
          shippingCharges: transfer.shippingCharges,
          additionalNotes: transfer.additionalNotes
        });
    this.selectedProducts = transfer.items?.map(item => ({
  ...item
})) || [];
      }
    });
  }

  loadLocations() {
    this.locationService.getLocations().subscribe(locations => {
      this.locations = locations;
    });
  }

  loadProducts() {
    this.productsService.getProductsRealTime().subscribe(products => {
      this.products = products;
    });
  }

  searchProducts() {
    this.showSearchResults = true;
    
    if (this.searchTerm.trim() === '') {
      this.filteredProducts = this.products.slice(0, 10);
    } else {
      const searchTermLower = this.searchTerm.toLowerCase();
      this.filteredProducts = this.products.filter(product => 
        product.productName.toLowerCase().includes(searchTermLower) ||
        product.sku.toLowerCase().includes(searchTermLower)
      );
    }
  }

addProduct(product: Product) {
  const existingProduct = this.selectedProducts.find(p => p.productId === product.id);
  
  if (existingProduct) {
    existingProduct.quantity += 1;
    existingProduct.subtotal = existingProduct.quantity * existingProduct.unitPrice;
  } else {
    const unitPrice = product.defaultSellingPriceExcTax || 0;
    this.selectedProducts.push({
      productId: product.id!,
      productName: product.productName,
      sku: product.sku,  // Add SKU from product
      unit: product.unit,  // Add unit from product
      locationFrom: this.ginTransferForm.get('locationFrom')?.value || '',  // Get from form
      quantity: 1,
      secondaryQuantity: 0,
      unitPrice: unitPrice,
      subtotal: unitPrice
    });
  }
  
  this.searchTerm = '';
  this.showSearchResults = false;
  this.calculateTotal();
}
  updateQuantity(index: number, value: any) {
    const quantity = parseInt(value);
    
    if (quantity > 0) {
      this.selectedProducts[index].quantity = quantity;
      this.selectedProducts[index].subtotal = quantity * this.selectedProducts[index].unitPrice;
      this.calculateTotal();
    }
  }

  updateSecondaryQuantity(index: number, value: any) {
    const quantity = parseInt(value);
    
    if (quantity >= 0) {
      this.selectedProducts[index].secondaryQuantity = quantity;
    }
  }
  
  removeProduct(index: number) {
    this.selectedProducts.splice(index, 1);
    this.calculateTotal();
  }

  calculateTotal(): number {
    const subtotal = this.selectedProducts.reduce((sum, product) => sum + product.subtotal, 0);
    const shippingCharges = parseFloat(this.ginTransferForm.get('shippingCharges')?.value || 0);
    return subtotal + shippingCharges;
  }
onCancel() {
  this.router.navigate(['/list-gin-transfers']);
}  async updateGinTransfer() {
    if (this.ginTransferForm.valid && this.selectedProducts.length > 0) {
      const formData = this.ginTransferForm.value;
      const hasSecondaryLocation = !!formData.locationTo2;
      const newStatus = formData.status;
      
      // Check if status is changing from non-Completed to Completed
      const isStatusChangingToCompleted = this.originalStatus !== 'Completed' && newStatus === 'Completed';
      
      const ginTransfer: GinTransfer = {
        date: formData.date,
        referenceNo: formData.referenceNo,
        locationFrom: formData.locationFrom,
          transfers: [], // or whatever default value makes sense

        locationTo: formData.locationTo,
        createdAt: new Date(formData.date), // Add this line
        locationTo2: formData.locationTo2 || null,
        status: formData.status,
        items: this.selectedProducts,
        shippingCharges: formData.shippingCharges || 0,
        additionalNotes: formData.additionalNotes || '',
        totalAmount: this.calculateTotal(),
        updatedAt: new Date()
      };
        try {
        // Only validate stock availability if status is changing to "Completed"
        if (isStatusChangingToCompleted) {
          const isStockAvailable = await this.validateStockAvailability();
          
          if (!isStockAvailable) {
            // Stock validation failed, do not proceed with the update
            return;
          }
        }
        
        await this.ginTransferService.updateGinTransfer(this.transferId, ginTransfer);
        console.log('GIN Transfer updated successfully');
        
        // Only process stock movements if status is changing to "Completed"
        if (isStatusChangingToCompleted) {
          console.log('Status changed to Completed. Processing stock movements...');
          await this.processStockMovements(ginTransfer, hasSecondaryLocation);
        } else if (newStatus === 'Completed') {
          console.log('Transfer status is already Completed. Stock movements were processed previously.');
        } else {
          console.log(`Transfer status is "${newStatus}". Stock movements will be processed when status is set to "Completed".`);
        }
        
        this.router.navigate(['/list-gin-transfers']);
      } catch (error) {
        console.error('Error updating GIN transfer:', error);
        alert('Error updating GIN transfer. Please try again.');
      }
    } else {
      Object.keys(this.ginTransferForm.controls).forEach(key => {
        this.ginTransferForm.get(key)?.markAsTouched();
      });
      
      if (this.selectedProducts.length === 0) {
        alert('Please add at least one product to the transfer.');
      }
    }
  }

  /**
   * Process stock movements for a GIN transfer
   * This method should only be called when the transfer status is "Completed"
   */
  private async processStockMovements(ginTransfer: GinTransfer, hasSecondaryLocation: boolean): Promise<void> {
    console.log('=== STARTING STOCK MOVEMENTS ===');
    
    // Get location names for logging
    const sourceLocation = this.locations.find(l => l.id === ginTransfer.locationFrom);
    const destinationLocation = this.locations.find(l => l.id === ginTransfer.locationTo);
    const secondaryLocation = ginTransfer.locationTo2 ? this.locations.find(l => l.id === ginTransfer.locationTo2) : null;
    
for (const item of ginTransfer.items || []) {
      const totalQuantityFromSource = item.quantity + (hasSecondaryLocation && item.secondaryQuantity ? item.secondaryQuantity : 0);
      
      console.log(`Processing transfer for ${item.productName} (${item.sku})`);
      console.log(`  From: ${sourceLocation?.name || ginTransfer.locationFrom} - Quantity: ${totalQuantityFromSource}`);
      console.log(`  To: ${destinationLocation?.name || ginTransfer.locationTo} - Quantity: ${item.quantity}`);
      if (hasSecondaryLocation && item.secondaryQuantity && item.secondaryQuantity > 0) {
        console.log(`  To Secondary: ${secondaryLocation?.name || ginTransfer.locationTo2} - Quantity: ${item.secondaryQuantity}`);
      }
      
      try {
        // Step 1: Deduct from source location
        await this.updateProductStockAtLocation(
          item.productId, 
          item.productName,
          item.sku,
          ginTransfer.locationFrom, 
          sourceLocation?.name || 'Unknown Location',
          totalQuantityFromSource,
          'decrease'
        );
        
        // Step 2: Add to primary destination
        await this.updateProductStockAtLocation(
          item.productId, 
          item.productName,
          item.sku,
ginTransfer.locationTo || '',
          destinationLocation?.name || 'Unknown Location',
          item.quantity,
          'increase'
        );
        
        // Step 3: Add to secondary destination if specified
        if (hasSecondaryLocation && item.secondaryQuantity && item.secondaryQuantity > 0 && ginTransfer.locationTo2) {
          await this.updateProductStockAtLocation(
            item.productId, 
            item.productName,
            item.sku,
            ginTransfer.locationTo2, 
            secondaryLocation?.name || 'Unknown Location',
            item.secondaryQuantity,
            'increase'
          );
        }
        
        console.log(`✓ Stock transfer completed for ${item.productName}`);
        
      } catch (error) {
        console.error(`✗ Error in stock movement for product ${item.productName}:`, error);
        alert(`Error: ${error instanceof Error ? error.message : 'Failed to transfer stock'} for product ${item.productName}`);
        
        // TODO: Implement rollback logic here if needed
        throw error;
      }
    }
    
    console.log('=== STOCK MOVEMENTS COMPLETED ===');
  }

  /**
   * Update stock for a product at a specific location in PRODUCT_STOCK collection
   */
  private async updateProductStockAtLocation(
    productId: string,
    productName: string,
    sku: string,
    locationId: string,
    locationName: string,
    quantityChange: number, // Positive to increase, negative to decrease
    operation: 'increase' | 'decrease'
  ): Promise<void> {
    try {
      if (!productId || !locationId || quantityChange === 0) {
        throw new Error(`Invalid parameters for stock update`);
      }

      const stockDocId = `${productId}_${locationId}`;
      const stockDocRef = doc(this.firestore, COLLECTIONS.PRODUCT_STOCK, stockDocId);
      
      console.log(`${operation === 'increase' ? 'Adding' : 'Removing'} ${Math.abs(quantityChange)} units of ${sku} ${operation === 'increase' ? 'to' : 'from'} ${locationName}`);
      
      // Get current stock document
      const stockDoc = await getDoc(stockDocRef);
      
      if (stockDoc.exists()) {
        // Update existing stock
        const currentData = stockDoc.data();
        const currentQuantity = currentData?.['quantity'] || 0;
        
        // For decrease operations, check if we have enough stock
        if (operation === 'decrease' && currentQuantity < Math.abs(quantityChange)) {
          throw new Error(`Insufficient stock for ${productName}. Available: ${currentQuantity}, Required: ${Math.abs(quantityChange)}`);
        }
        
        const newQuantity = operation === 'increase' 
          ? currentQuantity + quantityChange 
          : currentQuantity - Math.abs(quantityChange);
        
        await setDoc(stockDocRef, {
          quantity: newQuantity,
          updatedAt: new Date()
        }, { merge: true });
        
        console.log(`✓ Updated stock for ${sku} at ${locationName}: ${currentQuantity} → ${newQuantity}`);
      } else {
        // Handle case where stock document doesn't exist
        if (operation === 'decrease') {
          throw new Error(`No stock found for ${productName} at ${locationName}`);
        }
        
        // Create new stock entry for increase operations
        await setDoc(stockDocRef, {
          productId: productId,
          productName: productName,
          sku: sku,
          locationId: locationId,
          locationName: locationName,
          quantity: quantityChange,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        console.log(`✓ Created new stock entry for ${sku} at ${locationName}: 0 → ${quantityChange}`);
      }
    } catch (error) {
      console.error(`✗ Error updating stock for ${productName} at location ${locationId}:`, error);
      throw error;
    }
  }

  /**
   * Validate that there's sufficient stock for all products in the transfer
   */
  private async validateStockAvailability(): Promise<boolean> {
    const locationFrom = this.ginTransferForm.get('locationFrom')?.value;
    const hasSecondaryLocation = !!this.ginTransferForm.get('locationTo2')?.value;
    
    if (!locationFrom) {
      alert('Please select a source location first.');
      return false;
    }

    for (const item of this.selectedProducts) {
      const totalQuantityNeeded = item.quantity + (hasSecondaryLocation && item.secondaryQuantity ? item.secondaryQuantity : 0);
      
      try {
        const availableStock = await this.getCurrentStockAtLocation(item.productId, locationFrom);
        
        if (availableStock < totalQuantityNeeded) {
          alert(`Insufficient stock for ${item.productName}. Available: ${availableStock}, Required: ${totalQuantityNeeded}`);
          return false;
        }
      } catch (error) {
        console.error('Error validating stock for product:', item.productName, error);
        alert(`Error validating stock for ${item.productName}. Please try again.`);
        return false;
      }
    }
    
    return true;
  }

  /**
   * Get current stock quantity for a product at a specific location
   */
  private async getCurrentStockAtLocation(productId: string, locationId: string): Promise<number> {
    try {
      const stockDocId = `${productId}_${locationId}`;
      const stockDocRef = doc(this.firestore, COLLECTIONS.PRODUCT_STOCK, stockDocId);
      const stockDoc = await getDoc(stockDocRef);
      
      if (stockDoc.exists()) {
        const stockData = stockDoc.data();
        return stockData?.['quantity'] || 0;
      } else {
        return 0;
      }
    } catch (error) {
      console.error('Error getting stock at location:', error);
      throw error;
    }
  }

  // ...existing code...
}