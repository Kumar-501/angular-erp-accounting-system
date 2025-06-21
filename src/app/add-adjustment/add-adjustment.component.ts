import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, FormControl, Validators } from '@angular/forms';
import { AdjustmentService } from '../services/adjustment.service';
import { Observable } from 'rxjs';
import { Router } from '@angular/router';
import { LocationService } from '../services/location.service';
import { DatePipe } from '@angular/common';
import { ProductsService } from '../services/products.service';
import { Firestore, collection, doc, getDoc, setDoc, getDocs, updateDoc, increment } from '@angular/fire/firestore';
import { COLLECTIONS } from '../../utils/constants';

interface Product {
  id: string;
  productName: string;
  sku: string;
  unit: string;
  defaultSellingPriceExcTax?: number;
  location?: string;
  locations?: string[];
}

@Component({
  selector: 'app-add-adjustment',
  templateUrl: './add-adjustment.component.html',
  styleUrls: ['./add-adjustment.component.scss'],
  providers: [DatePipe]
})
export class AddAdjustmentComponent implements OnInit {
  adjustmentForm!: FormGroup;
  stockAdjustments$!: Observable<any[]>;
  submitted = false;
  isSaving = false;
  totalAmount = 0;
  productSearchControl = new FormControl('');
  businessLocations: any[] = [];
  
  // Changed from hardcoded products to empty array that will be populated from service
  availableProducts: Product[] = [];
  filteredProducts: Product[] = [];
  
  purchaseProducts: any[] = []; // This will store products from purchase list
  constructor(
    private fb: FormBuilder,
    private adjustmentService: AdjustmentService,
    public router: Router,
    private locationService: LocationService,
    private datePipe: DatePipe,
    private productsService: ProductsService,
    private firestore: Firestore
  ) {}

  ngOnInit(): void {
    this.initializeForm();
    this.stockAdjustments$ = this.adjustmentService.getStockAdjustments();
    this.loadBusinessLocations();
    this.loadPurchaseProducts(); // Load products from purchase list
    this.generateReferenceNumber();
    this.addEmptyProduct();
  }
  // New method to load products from purchase list
  loadPurchaseProducts(): void {
    this.productsService.getProductsRealTime().subscribe(
      (products) => {
        this.purchaseProducts = products;
        // Convert purchase products to the format used in availableProducts
        this.availableProducts = products.map(product => ({
          id: product.id || product.sku,
          productName: product.productName,
          sku: product.sku,
          unit: product.unit,
          defaultSellingPriceExcTax: product.defaultSellingPriceExcTax || 0,
          location: product.location,
          locations: product.locations
        }));
        this.filteredProducts = [...this.availableProducts];
      },
      (error) => {
        console.error('Error loading purchase products:', error);
      }
    );
  }

  private generateReferenceNumber(): void {
    const prefix = 'ADJ';
    const timestamp = this.datePipe.transform(new Date(), 'yyMMddHHmmss');
    const randomNum = Math.floor(1000 + Math.random() * 9000); // 4-digit random number
    
    const referenceNo = `${prefix}-${timestamp}-${randomNum}`;
    this.adjustmentForm.get('referenceNo')?.setValue(referenceNo);
  }

  loadBusinessLocations(): void {
    this.locationService.getLocations().subscribe(
      (locations) => {
        this.businessLocations = locations;
      },
      (error) => {
        console.error('Error loading business locations:', error);
      }
    );
  }

  private initializeForm(): void {
    const currentDateTime = new Date().toISOString().slice(0, 16);
    
    this.adjustmentForm = this.fb.group({
      businessLocation: ['', Validators.required],
      referenceNo: [''],
      date: [currentDateTime, Validators.required],
      adjustmentType: ['', Validators.required],
      products: this.fb.array([]),
      totalAmountRecovered: [0],
      reason: ['']
    });
  }
  
  get f() { return this.adjustmentForm.controls; }
  
  get products() {
    return this.adjustmentForm.get('products') as FormArray;
  }

  addEmptyProduct(): void {
    const productForm = this.fb.group({
      id: [''],
      name: ['', Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]],
      unitPrice: [0, [Validators.required, Validators.min(0)]],
      subtotal: [0]
    });
    
    this.products.push(productForm);
  }
    onProductSearch(event: any): void {
    const searchTerm = event.target.value.toLowerCase();
    this.filteredProducts = searchTerm 
      ? this.availableProducts.filter(p => p.productName.toLowerCase().includes(searchTerm) || p.sku.toLowerCase().includes(searchTerm))
      : [...this.availableProducts];
  }
    // Select product from dropdown
  selectProduct(product: Product, index: number): void {
    const productControl = this.products.at(index);
    const unitPrice = product.defaultSellingPriceExcTax || 0;
    productControl.patchValue({
      id: product.id,
      name: product.productName,
      unitPrice: unitPrice,
      subtotal: unitPrice * (productControl.get('quantity')?.value || 1)
    });
    
    this.updateSubtotal(index);
  }
    addProduct(product: Product): void {
    const exists = this.products.controls.some(
      control => control.get('id')?.value === product.id
    );
    
    if (!exists) {
      const unitPrice = product.defaultSellingPriceExcTax || 0;
      const productForm = this.fb.group({
        id: [product.id],
        name: [product.productName],
        quantity: [1, [Validators.required, Validators.min(1)]],
        unitPrice: [unitPrice, [Validators.required, Validators.min(0)]],
        subtotal: [unitPrice]
      });
      
      this.products.push(productForm);
      this.calculateTotalAmount();
    }
    
    this.productSearchControl.setValue('');
    this.filteredProducts = [...this.availableProducts];
  }
  
  removeProduct(index: number): void {
    this.products.removeAt(index);
    this.calculateTotalAmount();
    
    // Add empty product if last one was removed
    if (this.products.length === 0) {
      this.addEmptyProduct();
    }
  }
  
  updateSubtotal(index: number): void {
    const product = this.products.at(index);
    const quantity = product.get('quantity')?.value || 0;
    const unitPrice = product.get('unitPrice')?.value || 0;
    const subtotal = quantity * unitPrice;
    
    product.patchValue({ subtotal: subtotal });
    this.calculateTotalAmount();
  }
  
  calculateTotalAmount(): void {
    this.totalAmount = this.products.controls.reduce((total, product) => {
      return total + (product.get('subtotal')?.value || 0);
    }, 0);
  }

saveAdjustment(): void {
  this.submitted = true;
  
  // Prevent multiple submissions
  if (this.isSaving) {
    return;
  }

  if (this.adjustmentForm.invalid || this.products.length === 0) {
    this.showValidationErrors();
    return;
  }

  this.isSaving = true; // Disable the button
  
  this.processAdjustmentSave()
    .catch(error => {
      this.isSaving = false; // Re-enable if error occurs
      this.handleSaveError(error);
    });
}


  private showValidationErrors(): void {
    if (this.products.length === 0) {
      alert('Please add at least one product');
    } else {
      alert('Please fill all required fields');
      // Mark all form controls as touched to show errors
      Object.values(this.adjustmentForm.controls).forEach(control => {
        control.markAsTouched();
      });
    }
  }

// Update the processAdjustmentSave method to return the Promise
private async processAdjustmentSave(): Promise<void> {
  const formData = this.prepareFormData();

  try {
    // 1. Save adjustment record
    await this.adjustmentService.addStockAdjustment(formData);
    
    // 2. Update product stock for each product in the adjustment
    await this.updateProductStocks(formData);
    
    this.handleSaveSuccess();
  } catch (error) {
    throw error; // Re-throw to be caught in saveAdjustment
  }
}
  private async updateProductStocks(formData: any): Promise<void> {
    const adjustmentType = formData.adjustmentType;
    const products = formData.products;
    const locationId = formData.businessLocation;
    
    if (!locationId) {
      throw new Error('Business location is required for stock adjustments');
    }
    
    // Process each product and update stock
    for (const product of products) {
      if (!product.id || !product.name) continue;
      
      try {
        // Get current stock from product-stock collection
        const stockDocId = `${product.id}_${locationId}`;
        const stockDocRef = doc(this.firestore, COLLECTIONS.PRODUCT_STOCK, stockDocId);
        const stockDoc = await getDoc(stockDocRef);
        
        let currentStock = 0;
        if (stockDoc.exists()) {
          currentStock = stockDoc.data()['quantity'] || 0;
        }
        
        // Calculate new stock based on adjustment type
        let newStock = currentStock;
        
        if (adjustmentType === 'addition') {
          newStock += Number(product.quantity);
        } else if (adjustmentType === 'deduction') {
          newStock -= Number(product.quantity);
          // Ensure stock doesn't go negative
          newStock = Math.max(0, newStock);
        }
        
        // Update the product-stock document
        await setDoc(stockDocRef, {
          productId: product.id,
          locationId: locationId,
          quantity: newStock,
          lastUpdated: new Date(),
          updatedBy: 'system' // You can replace with actual user ID if available
        }, { merge: true });
        
        console.log(`Updated stock for ${product.name} at location ${locationId}: ${currentStock} -> ${newStock}`);
        
      } catch (err) {
        console.error(`Error updating stock for product ${product.name}:`, err);
        // Continue with other products even if one fails
      }
    }
  }

  private prepareFormData(): any {
    const formData = this.adjustmentForm.value;
    formData.totalAmount = this.totalAmount;
    formData.products = this.products.value;
    return formData;
  }

private handleSaveSuccess(): void {
  this.isSaving = false; // Re-enable the button
  alert('Stock adjustment saved successfully');
  this.resetForm();
  this.navigateToList();
}

// Update the handleSaveError method to reset isSaving
private handleSaveError(error: any): void {
  this.isSaving = false; // Re-enable the button
  console.error('Error saving adjustment:', error);
  alert('Failed to save adjustment. Please try again.');
}

 private resetForm(): void {
  this.isSaving = false; // Add this line
  this.adjustmentForm.reset({
    date: new Date().toISOString().slice(0, 16),
    products: [],
    totalAmountRecovered: 0
  });
  this.products.clear();
  this.submitted = false;
  this.totalAmount = 0;
  this.addEmptyProduct();
  this.generateReferenceNumber();
}

  private navigateToList(): void {
    this.router.navigate(['/list-adjustment']).then(success => {
      if (!success) {
        console.error('Navigation to list failed');
        window.location.href = '/list-adjustment'; // Fallback
      }
    });
  }
  onInputClick(event: MouseEvent): void {
    const inputElement = event.target as HTMLInputElement;
    inputElement.value = '';  // Clear the input value
    this.filteredProducts = this.availableProducts;  // Reset filtered products list
  }

  /**
   * Get current stock for a product at a specific location
   */
  async getProductStock(productId: string, locationId: string): Promise<number> {
    try {
      const stockDocId = `${productId}_${locationId}`;
      const stockDocRef = doc(this.firestore, COLLECTIONS.PRODUCT_STOCK, stockDocId);
      const stockDoc = await getDoc(stockDocRef);
      
      if (stockDoc.exists()) {
        return stockDoc.data()['quantity'] || 0;
      }
      return 0;
    } catch (error) {
      console.error('Error getting product stock:', error);
      return 0;
    }
  }

  /**
   * Get location name by ID
   */
  getLocationName(locationId: string): string {
    const location = this.businessLocations.find(loc => loc.id === locationId);
    return location?.name || locationId;
  }
}