
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ProductsService } from '../services/products.service';
import { LocationService } from '../services/location.service';
import { GinTransferService, GinTransfer, GinTransferItem } from '../services/gin-transfer.service';
import { formatDate } from '@angular/common';

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
  searchTerm: string = '';
  showSearchResults: boolean = false;
  transferId: string = '';
  isEditing = false;

  constructor(
    private fb: FormBuilder,
    private productsService: ProductsService,
    private locationService: LocationService,
    private ginTransferService: GinTransferService,
    private route: ActivatedRoute,
    private router: Router
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
        
        this.selectedProducts = transfer.items.map(item => ({
          ...item
        }));
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
}
  async updateGinTransfer() {
    if (this.ginTransferForm.valid && this.selectedProducts.length > 0) {
      const formData = this.ginTransferForm.value;
      const hasSecondaryLocation = !!formData.locationTo2;
      
      const ginTransfer: GinTransfer = {
        date: formData.date,
        referenceNo: formData.referenceNo,
        locationFrom: formData.locationFrom,
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
        await this.ginTransferService.updateGinTransfer(this.transferId, ginTransfer);
        console.log('GIN Transfer updated successfully');
        this.router.navigate(['/gin-transfers']);
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
}