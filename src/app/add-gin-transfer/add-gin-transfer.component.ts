import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ProductsService } from '../services/products.service';
import { LocationService } from '../services/location.service';
import { formatDate } from '@angular/common';
import { GinTransferService, GinTransfer, GinTransferItem } from '../services/gin-transfer.service';
import { Firestore, collection, doc, setDoc, getDoc, getDocs, increment, QueryDocumentSnapshot, DocumentData } from '@angular/fire/firestore';

// Constants for Firestore collections
const COLLECTIONS = {
  PRODUCT_STOCK: 'product-stock',
  PRODUCTS: 'products',
  LOCATIONS: 'locations',
  GIN_STOCK_LOG: 'gin-stock-log' // Added new collection constant
};

interface Product {
  id: string;
  productName: string;
  sku: string;
  unit: string;
  barcode?: string;
  defaultSellingPriceExcTax: number | null;
  location?: string;
  locationName?: string;
  locations?: string[];
  locationNames?: string[];
}

@Component({
  selector: 'app-add-gin-transfer',
  templateUrl: './add-gin-transfer.component.html',
  styleUrls: ['./add-gin-transfer.component.scss']
})
export class AddGinTransferComponent implements OnInit {
  ginTransferForm: FormGroup;
  locations: any[] = [];
  products: Product[] = [];
  filteredProducts: Product[] = [];
  selectedProducts: GinTransferItem[] = [];
  searchTerm: string = '';
  currentDate: string;
  showSearchResults: boolean = false;

  constructor(
    private fb: FormBuilder,
    private productsService: ProductsService,
    private locationService: LocationService,
    private ginTransferService: GinTransferService,
    private firestore: Firestore
  ) {
    // Initialize current date
    this.currentDate = formatDate(new Date(), 'dd-MM-yyyy HH:mm', 'en');
    
    // Initialize form with auto-generated reference number
    this.ginTransferForm = this.fb.group({
      date: [this.currentDate, Validators.required],
      referenceNo: [this.generateReferenceNumber()],
      locationFrom: ['', Validators.required],
      locationTo: ['', Validators.required],
      locationTo2: [''], // Secondary location - optional
      status: ['', Validators.required],
      shippingCharges: [0],
      additionalNotes: ['']
    });
  }

  ngOnInit(): void {
    this.loadLocations();
    this.loadProducts();
  }

  generateReferenceNumber(): string {
    const today = new Date();
    const dateString = today.getFullYear().toString() +
                      (today.getMonth() + 1).toString().padStart(2, '0') +
                      today.getDate().toString().padStart(2, '0');
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    return `GIN-${dateString}-${randomNum}`;
  }

  loadLocations() {
    this.locationService.getLocations().subscribe(locations => {
      this.locations = locations;
    });
  }

  loadProducts() {
    this.productsService.getProductsRealTime().subscribe(products => {
      this.products = products;
      console.log('Loaded products:', products.length);
    });
  }

  async searchProducts() {
    this.showSearchResults = true;
    
    const locationFrom = this.ginTransferForm.get('locationFrom')?.value;
    if (!locationFrom) {
      this.filteredProducts = [];
      return;
    }

    console.log(`Searching for products at location: ${this.getLocationName(locationFrom)} (${locationFrom})`);

    const availableProducts = await this.getProductsWithStockAtLocation(locationFrom);

    if (this.searchTerm.trim() === '') {
      this.filteredProducts = availableProducts.slice(0, 10);
    } else {
      const searchTermLower = this.searchTerm.toLowerCase();
      this.filteredProducts = availableProducts.filter(product => 
        product.productName.toLowerCase().includes(searchTermLower) ||
        (product.sku && product.sku.toLowerCase().includes(searchTermLower)) ||
        (product.barcode && product.barcode.toLowerCase().includes(searchTermLower))
      ).slice(0, 10);
    }

    console.log(`Found ${this.filteredProducts.length} products with stock at location ${this.getLocationName(locationFrom)}`);
    this.preloadStockForProducts();
  }

  addProduct(product: Product) {
    const existingIndex = this.selectedProducts.findIndex(p => p.productId === product.id);
    
    if (existingIndex >= 0) {
      this.selectedProducts[existingIndex].quantity += 1;
      this.selectedProducts[existingIndex].subtotal = 
        this.selectedProducts[existingIndex].quantity * this.selectedProducts[existingIndex].unitPrice;
    } else {
      this.selectedProducts.push({
        productId: product.id,
        productName: product.productName,
        sku: product.sku,
        barcode: product.barcode,
        quantity: 1,
        secondaryQuantity: 0,
        unitPrice: product.defaultSellingPriceExcTax || 0,
        subtotal: product.defaultSellingPriceExcTax || 0,
        unit: product.unit,
        locationFrom: ''
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

  resetForm() {
    this.ginTransferForm.reset({
      date: this.currentDate,
      referenceNo: this.generateReferenceNumber(),
      locationFrom: '',
      locationTo: '',
      locationTo2: '',
      status: '',
      shippingCharges: 0,
      additionalNotes: ''
    });
    this.selectedProducts = [];
    this.searchTerm = '';
    this.showSearchResults = false;
  }

  async saveGinTransfer() {
    if (this.ginTransferForm.valid && this.ginTransferForm.value.locationFrom && this.selectedProducts.length > 0) {
      // First check for duplicate products in the transfer
      const productIds = this.selectedProducts.map(p => p.productId);
      const hasDuplicates = new Set(productIds).size !== productIds.length;
      
      if (hasDuplicates) {
        alert('Error: The same product appears multiple times in this transfer. Please combine quantities for each product.');
        return;
      }

      const formData = this.ginTransferForm.value;
      const hasSecondaryLocation = !!formData.locationTo2;

      // Only validate stock availability if status is "Completed"
      if (formData.status === 'Completed') {
        const stockValid = await this.validateStockAvailability();
        if (!stockValid) {
          return;
        }
      }

      // Validate all items have required fields
      const invalidItems = this.selectedProducts.filter(item => 
        !item.productId || !item.productName || !item.sku || !item.unit
      );

      if (invalidItems.length > 0) {
        alert('Error: Some products are missing required information. Please check all products have SKU and unit.');
        return;
      }

      // Prepare transfer items with all required fields
      const transferItems = this.selectedProducts.map(item => ({
        productId: item.productId,
        productName: item.productName,
        sku: item.sku,
        unit: item.unit,
        locationFrom: formData.locationFrom,
        quantity: item.quantity,
        secondaryQuantity: item.secondaryQuantity || 0,
        unitPrice: item.unitPrice || 0,
        subtotal: item.subtotal || 0,
        barcode: item.barcode || '',
        currentStock: item.currentStock || 0
      }));
      
      const ginTransfer: GinTransfer = {
        date: formData.date,
        referenceNo: formData.referenceNo,
        locationFrom: formData.locationFrom,
        locationTo: formData.locationTo,
        locationTo2: formData.locationTo2 || null,
        status: formData.status,
        items: transferItems,
        shippingCharges: formData.shippingCharges || 0,
        additionalNotes: formData.additionalNotes || '',
        totalAmount: this.calculateTotal(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      try {
        // The service will now handle both gin-transfers and gin-stock-log collections
        const docId = await this.ginTransferService.addGinTransfer(ginTransfer);
        console.log('GIN Transfer and stock logs saved with ID:', docId);
        
        // Only process stock movements if status is "Completed"
        if (formData.status === 'Completed') {
          await this.processStockMovements(ginTransfer, hasSecondaryLocation);
        } else {
          console.log(`GIN Transfer saved with status: ${formData.status}. Stock movements will be processed when status is set to "Completed".`);
        }
        
        this.resetForm();
        alert('GIN Transfer and stock logs saved successfully!');
        
      } catch (error) {
        console.error('Error saving GIN transfer:', error);
        alert('Error saving GIN transfer. Please try again.');
      }
    } else {
      Object.keys(this.ginTransferForm.controls).forEach(key => {
        this.ginTransferForm.get(key)?.markAsTouched();
      });
      
      if (this.selectedProducts.length === 0) {
        alert('Please add at least one product to the transfer.');
      }
      
      if (!this.ginTransferForm.value.locationFrom) {
        alert('Please select a source location (Location From).');
      }
    }
  }

  async validateStockAvailability(): Promise<boolean> {
    const formData = this.ginTransferForm.value;
    const hasSecondaryLocation = !!formData.locationTo2;
    
    for (const item of this.selectedProducts) {
      const requiredQuantity = item.quantity + (hasSecondaryLocation && item.secondaryQuantity ? item.secondaryQuantity : 0);
      
      try {
        const availableStock = await this.getCurrentStockAtLocation(item.productId, formData.locationFrom);
        
        if (availableStock < requiredQuantity) {
          alert(`Insufficient stock for product "${item.productName}". Available: ${availableStock}, Required: ${requiredQuantity}`);
          return false;
        }
        
        console.log(`Stock check passed for ${item.productName}: Available=${availableStock}, Required=${requiredQuantity}`);
      } catch (error) {
        console.error(`Error checking stock for product ${item.productName}:`, error);
        alert(`Error checking stock availability for product "${item.productName}"`);
        return false;
      }
    }
    
    return true;
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

  private async updateProductStockAtLocation(
    productId: string,
    productName: string,
    sku: string,
    locationId: string,
    locationName: string,
    quantityChange: number,
    operation: 'increase' | 'decrease'
  ): Promise<void> {
    try {
      if (!productId || !locationId || quantityChange === 0) {
        throw new Error(`Invalid parameters for stock update`);
      }

      const stockDocId = `${productId}_${locationId}`;
      const stockDocRef = doc(this.firestore, COLLECTIONS.PRODUCT_STOCK, stockDocId);
      
      console.log(`${operation === 'increase' ? 'Adding' : 'Removing'} ${Math.abs(quantityChange)} units of ${sku} ${operation === 'increase' ? 'to' : 'from'} ${locationName}`);
      
      const stockDoc = await getDoc(stockDocRef);
      
      if (stockDoc.exists()) {
        const currentData = stockDoc.data();
        const currentQuantity = currentData?.['quantity'] || 0;
        
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
        if (operation === 'decrease') {
          throw new Error(`No stock found for ${productName} at ${locationName}`);
        }
        
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

  async getCurrentStockDisplay(productId: string): Promise<string> {
    const locationFrom = this.ginTransferForm.get('locationFrom')?.value;
    if (!locationFrom || !productId) return '0';
    
    try {
      const stock = await this.getCurrentStockAtLocation(productId, locationFrom);
      return stock.toString();
    } catch (error) {
      console.error('Error getting stock display:', error);
      return 'Error';
    }
  }

  async checkStockAvailability(productId: string, requiredQuantity: number): Promise<boolean> {
    const locationFrom = this.ginTransferForm.get('locationFrom')?.value;
    if (!locationFrom || !productId) return false;
    
    try {
      const currentStock = await this.getCurrentStockAtLocation(productId, locationFrom);
      return currentStock >= requiredQuantity;
    } catch (error) {
      console.error('Error checking stock availability:', error);
      return false;
    }
  }

  async getStockForDisplayAsync(productId: string): Promise<number> {
    const locationFrom = this.ginTransferForm.get('locationFrom')?.value;
    if (!locationFrom || !productId) return 0;

    try {
      return await this.getCurrentStockAtLocation(productId, locationFrom);
    } catch (error) {
      console.error('Error fetching stock:', error);
      return 0;
    }
  }

  stockDisplayMap = new Map<string, number>();

  async getAndCacheStock(productId: string): Promise<number> {
    const locationFrom = this.ginTransferForm.get('locationFrom')?.value;
    if (!locationFrom || !productId) return 0;

    const cacheKey = `${productId}_${locationFrom}`;
    
    if (this.stockDisplayMap.has(cacheKey)) {
      return this.stockDisplayMap.get(cacheKey) || 0;
    }

    try {
      const stock = await this.getCurrentStockAtLocation(productId, locationFrom);
      this.stockDisplayMap.set(cacheKey, stock);
      return stock;
    } catch (error) {
      console.error('Error fetching stock:', error);
      this.stockDisplayMap.set(cacheKey, 0);
      return 0;
    }
  }

  getStockDisplayText(productId: string): string {
    const locationFrom = this.ginTransferForm.get('locationFrom')?.value;
    if (!locationFrom) return 'Select location first';
    if (!productId) return '0';

    const cacheKey = `${productId}_${locationFrom}`;
    
    if (this.stockDisplayMap.has(cacheKey)) {
      return this.stockDisplayMap.get(cacheKey)?.toString() || '0';
    }

    this.getAndCacheStock(productId);
    return 'Loading...';
  }

  onLocationFromChange(): void {
    this.stockDisplayMap.clear();
    if (this.searchTerm || this.showSearchResults) {
      this.searchProducts();
    }
  }

  getLocationName(locationId: string): string {
    if (!locationId) return 'N/A';
    const location = this.locations.find(l => l.id === locationId);
    return location ? location.name : 'Unknown Location';
  }

  async preloadStockForProducts(): Promise<void> {
    const locationFrom = this.ginTransferForm.get('locationFrom')?.value;
    if (!locationFrom || !this.filteredProducts.length) return;

    console.log(`Pre-loading stock for ${this.filteredProducts.length} products at location ${this.getLocationName(locationFrom)}`);
    
    const stockPromises = this.filteredProducts.map(product => 
      this.getAndCacheStock(product.id)
    );
    
    await Promise.all(stockPromises);
    console.log('Stock pre-loading completed');
  }

  refreshStockDisplay(): void {
    this.stockDisplayMap.clear();
    if (this.filteredProducts.length > 0) {
      this.preloadStockForProducts();
    }
  }

  private async getProductsWithStockAtLocation(locationId: string): Promise<Product[]> {
    try {
      console.log(`Checking product-stock collection for location: ${locationId}`);
      
      const stockQuery = collection(this.firestore, COLLECTIONS.PRODUCT_STOCK);
      const stockSnapshot = await getDocs(stockQuery);
      
      const productIdsWithStock = new Set<string>();
      stockSnapshot.forEach((doc: any) => {
        const docId = doc.id;
        if (docId.endsWith(`_${locationId}`)) {
          const stockData = doc.data();
          if (stockData['quantity'] && stockData['quantity'] > 0) {
            const productId = docId.replace(`_${locationId}`, '');
            productIdsWithStock.add(productId);
            console.log(`Found stock for product ${productId}: ${stockData['quantity']} units`);
          }
        }
      });
      
      console.log(`Found ${productIdsWithStock.size} products with stock at this location`);
      
      const availableProducts = this.products.filter(product => 
        productIdsWithStock.has(product.id)
      );
      
      console.log(`Filtered to ${availableProducts.length} products that exist in products collection`);
      return availableProducts;
      
    } catch (error) {
      console.error('Error getting products with stock at location:', error);
      return [];
    }
  }

  private async processStockMovements(ginTransfer: GinTransfer, hasSecondaryLocation: boolean): Promise<void> {
    console.log('=== STARTING STOCK MOVEMENTS ===');
    
    const sourceLocation = this.locations.find(l => l.id === ginTransfer.locationFrom);
    const destinationLocation = this.locations.find(l => l.id === ginTransfer.locationTo);
    const secondaryLocation = ginTransfer.locationTo2 ? this.locations.find(l => l.id === ginTransfer.locationTo2) : null;
    
    for (const item of ginTransfer.items) {
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
          ginTransfer.locationTo, 
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
        
        throw error;
      }
    }
    
    console.log('=== STOCK MOVEMENTS COMPLETED ===');
  }
}