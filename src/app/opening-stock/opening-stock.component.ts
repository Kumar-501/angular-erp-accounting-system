import { Component, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ProductsService } from '../services/products.service';
import { Firestore, collection, addDoc } from '@angular/fire/firestore';

interface StockItem {
  productName: string;
  quantity: number;
  unit: string;
  unitCost: number;
  lotNumber: string;
  subtotal: number;
  date: string;
  note: string;
  productId?: string;
  sku?: string;
  category?: string;
  brand?: string;
  sellingPriceExcTax?: number;
  sellingPriceIncTax?: number;
  taxPercentage?: number;
}

@Component({
  selector: 'app-opening-stock',
  templateUrl: './opening-stock.component.html',
  styleUrls: ['./opening-stock.component.scss']
})
export class OpeningStockComponent implements OnInit {
  stockForm!: FormGroup;
  location: string = 'Main Warehouse';
  currentYear: number = new Date().getFullYear();
  isLoading: boolean = false;
  productDetails: any = null;
  
  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private productsService: ProductsService,
    private firestore: Firestore
  ) {}
  
  ngOnInit(): void {
    this.initForm();
    this.route.queryParams.subscribe(params => {
      if (params['productId']) {
        this.loadProductDetails(params['productId']);
      } else if (params['productData']) {
        try {
          this.productDetails = JSON.parse(params['productData']);
          this.prefillFirstItem();
        } catch (error) {
          console.error('Error parsing product data', error);
        }
      }
    });
  }
  
  async loadProductDetails(productId: string) {
    try {
      this.isLoading = true;
      const product = await this.productsService.getProductById(productId);
      if (product) {
        this.productDetails = product;
        this.prefillFirstItem();
      }
    } catch (error) {
      console.error('Error loading product details', error);
    } finally {
      this.isLoading = false;
    }
  }
  
  prefillFirstItem() {
    if (this.productDetails && this.items.length > 0) {
      const firstItem = this.items.at(0) as FormGroup;
      firstItem.patchValue({
        productName: this.productDetails.productName,
        unit: this.productDetails.unit || 'NOS',
        unitCost: this.productDetails.defaultPurchasePriceExcTax || 0,
        date: new Date().toISOString().split('T')[0]
      });
      
      // Store additional product information
      firstItem.addControl('productId', this.fb.control(this.productDetails.id || ''));
      firstItem.addControl('sku', this.fb.control(this.productDetails.sku || ''));
      firstItem.addControl('category', this.fb.control(this.productDetails.category || ''));
      firstItem.addControl('brand', this.fb.control(this.productDetails.brand || ''));
      firstItem.addControl('sellingPriceExcTax', this.fb.control(this.productDetails.defaultSellingPriceExcTax || 0));
      firstItem.addControl('sellingPriceIncTax', this.fb.control(this.productDetails.defaultSellingPriceIncTax || 0));
      firstItem.addControl('taxPercentage', this.fb.control(this.productDetails.taxPercentage || 0));
    }
  }
  
  initForm(): void {
    this.stockForm = this.fb.group({
      items: this.fb.array([this.createItem()])
    });
  }
  
  createItem(): FormGroup {
    return this.fb.group({
      productName: ['', Validators.required],
      quantity: [0, [Validators.required, Validators.min(0)]],
      unit: ['NOS', Validators.required],
      unitCost: [0, [Validators.required, Validators.min(0)]],
      lotNumber: [''],
      date: [''],
      note: [''],
      productId: [''],
      sku: [''],
      category: [''],
      brand: [''],
      sellingPriceExcTax: [0],
      sellingPriceIncTax: [0],
      taxPercentage: [0]
    });
  }
  
  get items(): FormArray {
    return this.stockForm.get('items') as FormArray;
  }
  
  addItem(): void {
    this.items.push(this.createItem());
  }
  
  removeItem(index: number): void {
    if (this.items.length > 1) {
      this.items.removeAt(index);
    }
  }
  
  calculateSubtotal(index: number): number {
    const item = this.items.at(index) as FormGroup;
    const quantity = item.get('quantity')?.value || 0;
    const unitCost = item.get('unitCost')?.value || 0;
    return quantity * unitCost;
  }
  
  calculateTotal(): number {
    let total = 0;
    for (let i = 0; i < this.items.length; i++) {
      total += this.calculateSubtotal(i);
    }
    return total;
  }
  
  async onSubmit(): Promise<void> {
    if (this.stockForm.valid) {
      try {
        this.isLoading = true;
        const stockData = this.prepareStockData();
        
        // Save opening stock data
        const stockDocRef = await this.saveOpeningStock(stockData);
        
        // Update product stock quantities
        await this.updateProductsStock(stockData.items);
        
        alert('Opening stock saved successfully!');
        this.router.navigate(['/stock-report']); // Navigate to products list to see updated stock
      } catch (error) {
        console.error('Error saving opening stock:', error);
        alert('Failed to save opening stock. Please try again.');
      } finally {
        this.isLoading = false;
      }
    }
  }
  private prepareStockData() {
    const items = this.stockForm.value.items.map((item: any, index: number) => {
      return {
        ...item,
        subtotal: this.calculateSubtotal(index),
        date: item.date || new Date().toISOString().split('T')[0]
      };
    });
    
    return {
      location: this.location,
      items: items,
      totalAmount: this.calculateTotal(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }
  
  private async saveOpeningStock(stockData: any) {
    const openingStocksCollection = collection(this.firestore, 'openingStocks');
    return await addDoc(openingStocksCollection, stockData);
  }
  
  private async updateProductsStock(items: any[]) {
    for (const item of items) {
      if (!item.quantity || item.quantity <= 0) {
        continue; // Skip items with no quantity
      }
      
      try {
        if (item.productId) {
          // If we have a product ID, update directly
          await this.productsService.updateProductStock(item.productId, item.quantity);
        } else if (item.sku) {
          // If we only have SKU, find the product first then update
          await this.updateProductStockBySku(item.sku, item.quantity);
        } else if (item.productName) {
          // If we only have product name, try to find by name (less reliable)
          console.warn('Updating stock by product name is less reliable:', item.productName);
          const product = await this.productsService.getProductByName(item.productName);
          if (product && product.id) {
            await this.productsService.updateProductStock(product.id, item.quantity);
          }
        }
      } catch (error) {
        console.error(`Error updating stock for item: ${item.productName}`, error);
      }
    }
  }
  
  private async updateProductStockBySku(sku: string, quantity: number) {
    try {
      const product = await this.productsService.getProductBySku(sku);
      if (product && product.id) {
        await this.productsService.updateProductStock(product.id, quantity);
      } else {
        console.warn(`Product with SKU ${sku} not found`);
      }
    } catch (error) {
      console.error('Error updating product stock by SKU:', error);
      throw error;
    }
  }
}
