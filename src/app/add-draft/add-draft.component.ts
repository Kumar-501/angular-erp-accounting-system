// add-draft.component.ts
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { DraftService } from '../services/draft.service';
import { Router } from '@angular/router';
import { CustomerService } from '../services/customer.service'; 
import { ProductsService } from '../services/products.service';

@Component({
  selector: 'app-add-draft',
  templateUrl: './add-draft.component.html',
  styleUrls: ['./add-draft.component.scss']
})
export class AddDraftComponent implements OnInit {
  draftForm: FormGroup;
  totalPayable: number = 0;
  selectedFile: File | null = null;
  shippingDocFile: File | null = null;
  customers: any[] = [];
  allProducts: any[] = [];
  deliveryPersons: any[] = [
    { id: 1, name: 'John Doe' },
    { id: 2, name: 'Jane Smith' }
  ];
  showAdditionalExpenses: boolean = false;
  
  defaultProduct: any = { 
    name: '',
    price: 0,
    stock: 0
  };

  constructor(
    private fb: FormBuilder,
    private draftService: DraftService,
    private router: Router,
    private customerService: CustomerService,
    private productService: ProductsService
  ) {
    this.draftForm = this.fb.group({
      customer: ['', Validators.required],
      billingAddress: ['Walk-In Customer'],
      shippingAddress: ['Walk-In Customer'],
      shippingAddressDetails: [''],
      payTerm: [''],
      saleDate: ['', Validators.required],
      invoiceNo: [''],
      invoiceScheme: ['default'],
      salesOrder: [''],
      discountType: ['percentage', Validators.required],
      discountAmount: [0, Validators.required],
      orderTax: ['0', Validators.required],
      sellNote: [''],
      shippingCharges: [0],
      shippingStatus: [''],
      deliveredTo: [''],
      deliveryPerson: [''],
      expenseName: [''],
      expenseAmount: [0],
      products: this.fb.array([this.createProduct()])
    });
  }

  ngOnInit(): void {
    this.calculateTotal();
    this.loadCustomers();
    this.loadProducts();
    this.generateInvoiceNumber();
    
    this.draftForm.valueChanges.subscribe(() => {
      this.calculateTotal();
    });
    
    // Update billing/shipping address when customer changes
    this.draftForm.get('customer')?.valueChanges.subscribe(customerId => {
      if (customerId) {
        const customer = this.customers.find(c => c.id === customerId);
        if (customer) {
          const address = customer.address || 'Walk-In Customer';
          this.draftForm.get('billingAddress')?.setValue(address);
          this.draftForm.get('shippingAddress')?.setValue(address);
          this.draftForm.get('shippingAddressDetails')?.setValue(address);
        }
      }
    });
  }

  generateInvoiceNumber(): void {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    
    const invoiceNo = `INV-${year}${month}${day}-${randomNum}`;
    this.draftForm.get('invoiceNo')?.setValue(invoiceNo);
  }

  loadCustomers(): void {
    this.customerService.getCustomers().subscribe({
      next: (customers: any[]) => {
        this.customers = customers;
      },
      error: (error) => {
        console.error('Error loading customers:', error);
      }
    });
  }

  loadProducts(): void {
    this.productService.getProductsRealTime().subscribe({
      next: (products: any[]) => {
        this.allProducts = products;
      },
      error: (error) => {
        console.error('Error loading products:', error);
      }
    });
  }

  createProduct(): FormGroup {
    return this.fb.group({
      productName: ['', Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]],
      unitPrice: [0, [Validators.required, Validators.min(0)]],
      discount: [0, [Validators.min(0)]],
      subtotal: [0]
    });
  }

  get products(): FormArray {
    return this.draftForm.get('products') as FormArray;
  }

  addProduct(): void {
    this.products.push(this.createProduct());
  }

  removeProduct(index: number): void {
    if (this.products.length > 1) {
      this.products.removeAt(index);
    }
    this.calculateTotal();
  }

  calculateSubtotal(index: number): void {
    const productGroup = this.products.at(index) as FormGroup;
    const quantity = productGroup.get('quantity')?.value || 0;
    const unitPrice = productGroup.get('unitPrice')?.value || 0;
    const discount = productGroup.get('discount')?.value || 0;
    const subtotal = (quantity * unitPrice) - discount;
    productGroup.get('subtotal')?.setValue(subtotal, { emitEvent: false });
    this.calculateTotal();
  }

  calculateTotal(): void {
    let subtotal = 0;
    this.products.controls.forEach(productGroup => {
      subtotal += productGroup.get('subtotal')?.value || 0;
    });

    // Apply order-level discount
    const discountType = this.draftForm.get('discountType')?.value;
    const discountAmount = this.draftForm.get('discountAmount')?.value || 0;
    let discount = 0;

    if (discountType === 'percentage') {
      discount = subtotal * (discountAmount / 100);
    } else {
      discount = Math.min(discountAmount, subtotal);
    }

    // Apply tax
    const taxRate = parseFloat(this.draftForm.get('orderTax')?.value) || 0;
    const taxableAmount = subtotal - discount;
    const tax = taxableAmount * (taxRate / 100);

    // Add shipping and additional expenses
    const shipping = this.draftForm.get('shippingCharges')?.value || 0;
    const additionalExpense = this.draftForm.get('expenseAmount')?.value || 0;

    // Calculate final total
    this.totalPayable = taxableAmount + tax + shipping + additionalExpense;
  }

  updateDefaultProduct(): void {
    const selectedProduct = this.allProducts.find(p => p.productName === this.defaultProduct.name);
    if (selectedProduct) {
      this.onProductSelect(selectedProduct);
    }
  }

  onProductSelect(product: any): void {
    this.defaultProduct = {
      name: product.productName,
      price: product.sellingPrice || 0,
      stock: product.currentStock || 0
    };

    const currentIndex = this.products.length - 1;
    const currentProduct = this.products.at(currentIndex) as FormGroup;
    
    currentProduct.patchValue({
      productName: product.productName,
      unitPrice: product.sellingPrice || 0
    });

    this.calculateSubtotal(currentIndex);
  }

  onFileSelected(event: any): void {
    if (event.target.files.length > 0) {
      this.selectedFile = event.target.files[0];
    }
  }

  onShippingDocSelected(event: any): void {
    if (event.target.files.length > 0) {
      this.shippingDocFile = event.target.files[0];
    }
  }

  toggleAdditionalExpenses(): void {
    this.showAdditionalExpenses = !this.showAdditionalExpenses;
    this.calculateTotal();
  }

  onSubmit(): void {
    if (this.draftForm.invalid) {
      alert('Please fill in all required fields');
      return;
    }

    this.products.controls.forEach((_, index) => {
      this.calculateSubtotal(index);
    });

    const formData = {
      ...this.draftForm.value,
      products: this.products.value,
      totalPayable: this.totalPayable,
      createdAt: new Date()
    };

    this.draftService.addDraft(formData).then(() => {
      this.router.navigate(['/list-draft']);
    }).catch((error: any) => {
      console.error('Error saving draft:', error);
      alert('Error saving draft. Please try again.');
    });
  }

  saveAndPrint(): void {
    this.onSubmit(); // Save first
    // Add print functionality here
    // window.print(); or other print logic
  }
}