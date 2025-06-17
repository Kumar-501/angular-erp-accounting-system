// add-gin-transfer.component.ts
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ProductsService } from '../services/products.service';
import { LocationService } from '../services/location.service';
import { formatDate } from '@angular/common';
import { GinTransferService, GinTransfer, GinTransferItem } from '../services/gin-transfer.service';

interface Product {
  id?: string;
  productName: string;
  sku: string;
  unit: string;
  defaultSellingPriceExcTax: number | null;
  currentStock: number;
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
    private ginTransferService: GinTransferService
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
    });
  }

  searchProducts() {
    this.showSearchResults = true;
    
    if (this.searchTerm.trim() === '') {
      // Show first 10 products if search is empty
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
        quantity: 1,
        secondaryQuantity: 0, // Initialize secondary quantity
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
    if (this.ginTransferForm.valid && this.selectedProducts.length > 0) {
      const formData = this.ginTransferForm.value;
      const hasSecondaryLocation = !!formData.locationTo2;
      
      const ginTransfer: GinTransfer = {
        date: formData.date,
        referenceNo: formData.referenceNo,
        locationFrom: formData.locationFrom,
        locationTo: formData.locationTo,
        locationTo2: formData.locationTo2 || null,
        status: formData.status,
        items: this.selectedProducts,
        shippingCharges: formData.shippingCharges || 0,
        additionalNotes: formData.additionalNotes || '',
        totalAmount: this.calculateTotal(),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      try {
        const docId = await this.ginTransferService.addGinTransfer(ginTransfer);
        console.log('GIN Transfer saved with ID:', docId);
        
        // Process primary location transfer
        for (const item of this.selectedProducts) {
          // Deduct from source location
          await this.productsService.adjustProductStock(
            item.productId, 
            formData.locationFrom, 
            -(item.quantity + (hasSecondaryLocation && item.secondaryQuantity ? item.secondaryQuantity : 0))
          );
          
          // Add to primary destination
          await this.productsService.adjustProductStock(
            item.productId, 
            formData.locationTo, 
            item.quantity
          );
          
          // Add to secondary destination if specified
          if (hasSecondaryLocation && item.secondaryQuantity && item.secondaryQuantity > 0) {
            await this.productsService.adjustProductStock(
              item.productId, 
              formData.locationTo2, 
              item.secondaryQuantity
            );
          }
        }
        
        this.resetForm();
        alert('GIN Transfer saved successfully!');
        
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
    }
  }
}