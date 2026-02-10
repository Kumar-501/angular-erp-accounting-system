import { Component, OnInit, ViewChild, ElementRef } from '@angular/core'; // Ensure ViewChild and ElementRef are imported
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
  @ViewChild('datePicker') datePicker!: ElementRef;

  totalAmount = 0;
  productSearchControl = new FormControl('');
  businessLocations: any[] = [];
  
  // Product dropdown management with proper initialization
  availableProducts: Product[] = [];
  filteredProducts: Product[] = [];
  filteredProductsForRow: Product[][] = [];
  showDropdown: boolean[] = [];
  
  purchaseProducts: any[] = [];

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
    this.loadPurchaseProducts();
    this.generateReferenceNumber();
    this.addEmptyProduct();
  }

  // Helper method to safely check if dropdown should be visible
  isDropdownVisible(index: number): boolean {
    return !!(this.showDropdown[index] && this.filteredProductsForRow[index]?.length);
  }

  // Helper method to safely get filtered products for a row
  getFilteredProductsForRow(index: number): Product[] {
    return this.filteredProductsForRow[index] || [];
  }

  loadPurchaseProducts(): void {
    this.productsService.getProductsRealTime().subscribe(
      (products) => {
        this.purchaseProducts = products;
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
// Helper to get DD-MM-YYYY for display
  getFormattedDateForInput(dateString: any): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  }

  // Trigger the hidden native date picker
  openDatePicker(): void {
    this.datePicker.nativeElement.showPicker();
  }

  // Handle manual typing of date in DD-MM-YYYY format
  onManualDateInput(event: any, controlName: string): void {
    const input = event.target.value.trim();
    const datePattern = /^(\d{2})-(\d{2})-(\d{4})$/;
    const match = input.match(datePattern);
    
    if (match) {
      const day = match[1];
      const month = match[2];
      const year = match[3];
      
      const dateObj = new Date(`${year}-${month}-${day}`);
      if (dateObj && dateObj.getDate() === parseInt(day) && 
          dateObj.getMonth() + 1 === parseInt(month)) {
        
        // Update form with the valid date string for internal storage
        this.adjustmentForm.get(controlName)?.setValue(`${year}-${month}-${day}`);
      } else {
        alert('Invalid date! Please enter a valid date in DD-MM-YYYY format.');
        this.resetVisibleInput(event, controlName);
      }
    } else if (input !== '') {
      alert('Format must be DD-MM-YYYY');
      this.resetVisibleInput(event, controlName);
    }
  }

  private resetVisibleInput(event: any, controlName: string): void {
    event.target.value = this.getFormattedDateForInput(this.adjustmentForm.get(controlName)?.value);
  }
  private generateReferenceNumber(): void {
    const prefix = 'ADJ';
    const timestamp = this.datePipe.transform(new Date(), 'yyMMddHHmmss');
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    
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
    
    // Initialize arrays for this new product row
    this.filteredProductsForRow.push([...this.availableProducts]);
    this.showDropdown.push(false);
  }

  onProductSearch(event: any): void {
    const searchTerm = event.target.value.toLowerCase();
    this.filteredProducts = searchTerm 
      ? this.availableProducts.filter(p => 
          p.productName.toLowerCase().includes(searchTerm) || 
          p.sku.toLowerCase().includes(searchTerm)
        )
      : [...this.availableProducts];
  }

  onProductInputFocus(index: number): void {
    // Ensure arrays are properly initialized
    if (!this.showDropdown[index] !== undefined) {
      this.showDropdown[index] = false;
    }
    if (!this.filteredProductsForRow[index]) {
      this.filteredProductsForRow[index] = [...this.availableProducts];
    }
    
    this.showDropdown[index] = true;
    this.filteredProductsForRow[index] = [...this.availableProducts];
  }

  onProductInputBlur(index: number): void {
    // Delay hiding to allow click on dropdown item
    setTimeout(() => {
      if (this.showDropdown[index] !== undefined) {
        this.showDropdown[index] = false;
      }
    }, 200);
  }

  onProductInputChange(event: any, index: number): void {
    const searchTerm = event.target.value.toLowerCase();
    
    // Ensure the array exists before filtering
    if (!this.filteredProductsForRow[index]) {
      this.filteredProductsForRow[index] = [...this.availableProducts];
    }
    
    this.filteredProductsForRow[index] = searchTerm 
      ? this.availableProducts.filter(p => 
          p.productName.toLowerCase().includes(searchTerm) || 
          p.sku.toLowerCase().includes(searchTerm)
        )
      : [...this.availableProducts];
    
    // Ensure showDropdown array exists
    if (this.showDropdown[index] === undefined) {
      this.showDropdown[index] = false;
    }
    this.showDropdown[index] = true;
  }

  selectProduct(product: Product, index: number): void {
    if (!product) return;
    
    const productControl = this.products.at(index);
    const unitPrice = product.defaultSellingPriceExcTax || 0;
    
    productControl.patchValue({
      id: product.id,
      name: product.productName,
      unitPrice: unitPrice,
      subtotal: unitPrice * (productControl.get('quantity')?.value || 1)
    });
    
    // Safely hide dropdown
    if (this.showDropdown[index] !== undefined) {
      this.showDropdown[index] = false;
    }
    this.updateSubtotal(index);
  }

  removeProduct(index: number): void {
    this.products.removeAt(index);
    
    // Safely remove from arrays
    if (this.filteredProductsForRow[index]) {
      this.filteredProductsForRow.splice(index, 1);
    }
    if (this.showDropdown[index] !== undefined) {
      this.showDropdown.splice(index, 1);
    }
    
    this.calculateTotalAmount();
    
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
    
    if (this.isSaving) {
      return;
    }

    if (this.adjustmentForm.invalid || this.products.length === 0) {
      this.showValidationErrors();
      return;
    }

    this.isSaving = true;
    
    this.processAdjustmentSave()
      .catch(error => {
        this.isSaving = false;
        this.handleSaveError(error);
      });
  }

  private showValidationErrors(): void {
    if (this.products.length === 0) {
      alert('Please add at least one product');
    } else {
      alert('Please fill all required fields');
      Object.values(this.adjustmentForm.controls).forEach(control => {
        control.markAsTouched();
      });
    }
  }

 private async processAdjustmentSave(): Promise<void> {
     const formData = this.prepareFormData();

     try {
+      // CRITICAL FIX: Ensure the date is properly formatted before saving
+      console.log('Saving adjustment with date:', formData.date);
+      
       await this.adjustmentService.addStockAdjustment(formData);
       await this.updateProductStocks(formData);
       this.handleSaveSuccess();
     } catch (error) {
       throw error;
     }
   }
  private async updateProductStocks(formData: any): Promise<void> {
    const adjustmentType = formData.adjustmentType;
    const products = formData.products;
    const locationId = formData.businessLocation;
    
    if (!locationId) {
      throw new Error('Business location is required for stock adjustments');
    }
    
    for (const product of products) {
      if (!product.id || !product.name) continue;
      
      try {
        const stockDocId = `${product.id}_${locationId}`;
        const stockDocRef = doc(this.firestore, COLLECTIONS.PRODUCT_STOCK, stockDocId);
        const stockDoc = await getDoc(stockDocRef);
        
        let currentStock = 0;
        if (stockDoc.exists()) {
          currentStock = stockDoc.data()['quantity'] || 0;
        }
        
        let newStock = currentStock;
        
        if (adjustmentType === 'addition') {
          newStock += Number(product.quantity);
        } else if (adjustmentType === 'deduction') {
          newStock -= Number(product.quantity);
          newStock = Math.max(0, newStock);
        }
        
        await setDoc(stockDocRef, {
          productId: product.id,
          locationId: locationId,
          quantity: newStock,
          lastUpdated: new Date(),
          updatedBy: 'system'
        }, { merge: true });
        
        console.log(`Updated stock for ${product.name} at location ${locationId}: ${currentStock} -> ${newStock}`);
        
      } catch (err) {
        console.error(`Error updating stock for product ${product.name}:`, err);
      }
    }
  }

 private prepareFormData(): any {
     const formData = this.adjustmentForm.value;
     formData.totalAmount = this.totalAmount;
     formData.products = this.products.value;
 
    if (formData.date && typeof formData.date === 'string') {      formData.date = new Date(formData.date);
      console.log('Converted form date to Date object:', formData.date);
    }
    
     return formData;
   }

  private handleSaveSuccess(): void {
    this.isSaving = false;
    alert('Stock adjustment saved successfully');
    this.resetForm();
    this.navigateToList();
  }

  private handleSaveError(error: any): void {
    this.isSaving = false;
    console.error('Error saving adjustment:', error);
    alert('Failed to save adjustment. Please try again.');
  }

  private resetForm(): void {
    this.isSaving = false;
    this.adjustmentForm.reset({
      date: new Date().toISOString().slice(0, 16),
      products: [],
      totalAmountRecovered: 0
    });
    this.products.clear();
    this.submitted = false;
    this.totalAmount = 0;
    this.filteredProductsForRow = [];
    this.showDropdown = [];
    this.addEmptyProduct();
    this.generateReferenceNumber();
  }

  private navigateToList(): void {
    this.router.navigate(['/list-adjustment']).then(success => {
      if (!success) {
        console.error('Navigation to list failed');
        window.location.href = '/list-adjustment';
      }
    });
  }

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

  getLocationName(locationId: string): string {
    const location = this.businessLocations.find(loc => loc.id === locationId);
    return location?.name || locationId;
  }
}