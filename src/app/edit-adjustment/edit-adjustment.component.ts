// edit-adjustment.component.ts
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, FormControl, Validators } from '@angular/forms';
import { AdjustmentService } from '../services/adjustment.service';
import { Observable } from 'rxjs';
import { Router, ActivatedRoute } from '@angular/router';

interface Product {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

@Component({
  selector: 'app-edit-adjustment',
  templateUrl: './edit-adjustment.component.html',
  styleUrls: ['./edit-adjustment.component.scss']
})
export class EditAdjustmentComponent implements OnInit {
  adjustmentForm!: FormGroup;
  adjustmentId!: string;
  submitted = false;
  totalAmount = 0;
  productSearchControl = new FormControl('');
  isLoading = true;
  
  businessLocations: string[] = [
 
  ];
  
  availableProducts: Product[] = [
    { id: 'p1', name: 'Product 1', quantity: 1, unitPrice: 20, subtotal: 20 },
    { id: 'p2', name: 'Product 2', quantity: 1, unitPrice: 35, subtotal: 35 },
    { id: 'p3', name: 'Product 3', quantity: 1, unitPrice: 15, subtotal: 15 },
    { id: 'p4', name: 'Product 4', quantity: 1, unitPrice: 50, subtotal: 50 }
  ];
  
  filteredProducts: Product[] = [];

  constructor(
    private fb: FormBuilder,
    private adjustmentService: AdjustmentService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.initForm();
    
    this.route.params.subscribe(params => {
      this.adjustmentId = params['id'];
      this.loadAdjustment(this.adjustmentId);
    });

    // Initialize filtered products with all available products
    this.filteredProducts = [...this.availableProducts];
  }
  
  initForm(): void {
    this.adjustmentForm = this.fb.group({
      businessLocation: ['', Validators.required],
      referenceNo: [''],
      date: ['', Validators.required],
      adjustmentType: ['', Validators.required],
      products: this.fb.array([]),
      totalAmountRecovered: [0],
      reason: ['']
    });
  }
  
  loadAdjustment(id: string): void {
    this.isLoading = true;
  
    this.adjustmentService.getStockAdjustmentById(id).subscribe(
      (adjustment: any) => {
        if (adjustment) {
          // Clear existing products
          while (this.products.length) {
            this.products.removeAt(0);
          }
  
          // Fill form with adjustment data
          this.adjustmentForm.patchValue({
            businessLocation: adjustment.businessLocation,
            referenceNo: adjustment.referenceNo,
            date: this.formatDateForInput(adjustment.date),
            adjustmentType: adjustment.adjustmentType,
            totalAmountRecovered: adjustment.totalAmountRecovered,
            reason: adjustment.reason
          });
  
          // Add products from adjustment
          if (adjustment.products && adjustment.products.length) {
            adjustment.products.forEach((product: any) => {
              this.addExistingProduct(product);
            });
          } else {
            this.addEmptyProduct();
          }
  
          this.calculateTotalAmount();
          this.isLoading = false;
        } else {
          alert('Adjustment not found');
          this.router.navigate(['/list-adjustment']);
        }
      },
      (error: any) => {
        console.error('Error loading adjustment:', error);
        alert('Failed to load adjustment');
        this.isLoading = false;
        this.router.navigate(['/list-adjustment']);
      }
    );
  }

  private formatDateForInput(dateString: string): string {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }
  
  get f() { return this.adjustmentForm.controls; }
  
  get products() {
    return this.adjustmentForm.get('products') as FormArray;
  }

  addEmptyProduct() {
    const productForm = this.fb.group({
      id: [''],
      name: ['', Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]],
      unitPrice: [0, [Validators.required, Validators.min(0)]],
      subtotal: [0]
    });
    
    this.products.push(productForm);
  }
  
  addExistingProduct(product: any) {
    const productForm = this.fb.group({
      id: [product.id],
      name: [product.name, Validators.required],
      quantity: [product.quantity, [Validators.required, Validators.min(1)]],
      unitPrice: [product.unitPrice, [Validators.required, Validators.min(0)]],
      subtotal: [product.subtotal]
    });
    
    this.products.push(productForm);
  }
  
  onProductSearch(event: any) {
    const searchTerm = event.target.value.toLowerCase();
    if (searchTerm) {
      this.filteredProducts = this.availableProducts.filter(
        product => product.name.toLowerCase().includes(searchTerm)
      );
    } else {
      this.filteredProducts = [...this.availableProducts];
    }
  }
  
  addProduct(product: Product) {
    const exists = this.products.controls.some(
      control => control.get('id')?.value === product.id
    );
    
    if (!exists) {
      const productForm = this.fb.group({
        id: [product.id],
        name: [product.name],
        quantity: [1, [Validators.required, Validators.min(1)]],
        unitPrice: [product.unitPrice, [Validators.required, Validators.min(0)]],
        subtotal: [product.unitPrice]
      });
      
      this.products.push(productForm);
      this.calculateTotalAmount();
    }
    
    this.productSearchControl.setValue('');
    this.filteredProducts = [];
  }
  
  removeProduct(index: number) {
    this.products.removeAt(index);
    this.calculateTotalAmount();
  }
  
  updateSubtotal(index: number) {
    const product = this.products.at(index);
    const quantity = product.get('quantity')?.value || 0;
    const unitPrice = product.get('unitPrice')?.value || 0;
    const subtotal = quantity * unitPrice;
    
    product.patchValue({ subtotal });
    this.calculateTotalAmount();
  }
  
  calculateTotalAmount() {
    this.totalAmount = this.products.controls.reduce((sum, control) => {
      return sum + (control.get('subtotal')?.value || 0);
    }, 0);
  }
  updateAdjustment() {
    this.submitted = true;
  
    // Check if the form is invalid
    if (this.adjustmentForm.invalid) {
      return;
    }
  
    // Validate at least one product is added
    if (this.products.length === 0) {
      alert('Please add at least one product');
      return;
    }
  
    // Extract the ID from adjustmentData
    const id = this.adjustmentId;
    
    // Collect the data from the form
    const adjustmentData = {
      ...this.adjustmentForm.value,
      totalAmount: this.totalAmount,
      // Convert date to ISO string for backend
      date: new Date(this.adjustmentForm.value.date).toISOString()
    };
  
    // Call the update method in the service with both ID and data separately
    this.adjustmentService.updateStockAdjustment(id, adjustmentData)
      .then(() => {
        alert('Stock adjustment updated successfully');
        this.router.navigate(['/list-adjustment']);
      })
      .catch((error: any) => {
        console.error('Error updating adjustment:', error);
        alert('Failed to update adjustment');
      });
  }
}