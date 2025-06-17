import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { StockService } from '../services/stock.service';

@Component({
  selector: 'app-edit-stock',
  templateUrl: './edit-stock.component.html',
  styleUrls: ['./edit-stock.component.scss']
})
export class EditStockComponent implements OnInit {
  stockForm: FormGroup;
  totalAmount: number = 0;
  stockId: string = '';
  isEditMode: boolean = false;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    public router: Router,  // Change from private to public
    private stockService: StockService
  ) {
    this.stockForm = this.fb.group({
      date: ['', Validators.required],
      referenceNo: [''],
      status: ['pending', Validators.required],
      locationFrom: ['', Validators.required],
      locationTo: ['', Validators.required],
      products: this.fb.array([]),
      shippingCharges: [0],
      additionalNotes: ['']
    });
  }

  ngOnInit(): void {
    this.stockId = this.route.snapshot.paramMap.get('id') || '';
    this.isEditMode = !!this.stockId;
    
    if (this.isEditMode) {
      this.loadStockData();
    } else {
      // Add default product if in add mode
      this.addProduct();
    }
  }

  get products(): FormArray {
    return this.stockForm.get('products') as FormArray;
  }

  createProduct(productData: any = {}): FormGroup {
    return this.fb.group({
      product: [productData.product || '', Validators.required],
      quantity: [productData.quantity || 0, [Validators.required, Validators.min(1)]],
      unitPrice: [productData.unitPrice || 0, [Validators.required, Validators.min(0)]],
      subtotal: [productData.subtotal || 0]
    });
  }

  addProduct(): void {
    this.products.push(this.createProduct());
  }

  removeProduct(index: number): void {
    this.products.removeAt(index);
    this.calculateTotal();
  }

  calculateSubtotal(index: number): void {
    const product = this.products.at(index);
    const quantity = product.get('quantity')?.value || 0;
    const unitPrice = product.get('unitPrice')?.value || 0;
    const subtotal = quantity * unitPrice;
    product.patchValue({ subtotal });
    this.calculateTotal();
  }

  getSubtotal(index: number): number {
    return this.products.at(index)?.get('subtotal')?.value || 0;
  }

  calculateTotal(): void {
    this.totalAmount = this.products.controls.reduce((sum, product) => {
      return sum + (product.get('subtotal')?.value || 0);
    }, 0);
  }

  loadStockData(): void {
    this.stockService.getStockById(this.stockId).subscribe((data: any) => {
      if (data) {
        // Format date for datetime-local input
        const date = new Date(data.date);
        const formattedDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000))
          .toISOString()
          .slice(0, 16);

        this.stockForm.patchValue({
          date: formattedDate,
          referenceNo: data.referenceNo,
          status: data.status,
          locationFrom: data.locationFrom,
          locationTo: data.locationTo,
          shippingCharges: data.shippingCharges,
          additionalNotes: data.additionalNotes
        });

        // Clear existing products
        this.products.clear();
        
        // Add products from data
        if (data.products && data.products.length > 0) {
          data.products.forEach((product: any) => {
            this.products.push(this.createProduct(product));
          });
        } else {
          this.addProduct();
        }

        this.calculateTotal();
      }
    });
  }

  onSubmit(): void {
    if (this.stockForm.valid) {
      const stockData = this.stockForm.value;
      stockData.date = new Date(stockData.date).toISOString();
      stockData.totalAmount = this.totalAmount + (stockData.shippingCharges || 0);
  
      if (this.isEditMode) {
        this.stockService.updateStock(this.stockId, stockData)
          .then(() => {
            console.log('Stock updated successfully!');
            this.router.navigate(['/list-stock']);
          })
          .catch((error) => {
            console.error('Error updating stock:', error);
          });
      } else {
        this.stockService.addStock(stockData)
          .then(() => {
            console.log('Stock added successfully!');
            this.router.navigate(['/list-stock']);
          })
          .catch((error) => {
            console.error('Error adding stock:', error);
          });
      }
    }
  }
  
}