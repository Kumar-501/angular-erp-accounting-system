import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { QuotationService } from '../services/quotations.service';
import { CustomerService } from '../services/customer.service';
import { ProductsService } from '../services/products.service';

@Component({
  selector: 'app-add-quotation',
  templateUrl: './add-quotation.component.html',
  styleUrls: ['./add-quotation.component.scss']
})
export class AddQuotationComponent implements OnInit {
  quotation = {
    customer: '',
    billingAddress: '',
    shippingAddress: '',
    walkInCustomer: false,
    payTerm: '',
    saleDate: new Date().toISOString().slice(0, 16),
    invoiceScheme: '',
    invoiceNo: '',
    attachDocument: null,
    salesOrder: [
      { productName: '', productId: '', quantity: 1, unitPrice: 0, discount: 0, subtotal: 0 }
    ],
    discountType: 'percentage',
    discountAmount: 0,
    orderTax: 'none',
    orderTaxAmount: 0,
    shippingStatus: '',
    deliveredTo: '',
    deliveryPerson: '',
    shippingDocuments: null,
    shippingCharges: 0,
    additionalExpenses: [{ name: '', amount: 0 }],
    totalPayable: 0,
    sellNote: '',
    createdAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString()
  };

  customers: any[] = [];
  products: any[] = [];
  isEditMode: boolean = false;
  quotationId: string | null = null;
  isSubmitting: boolean = false;
  draftData: any = null;
  lastInvoiceNumber: string = '';
  

  constructor(
    private quotationsService: QuotationService,
    private customerService: CustomerService,
    private productService: ProductsService,
    private activatedRoute: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadCustomers();
    this.loadProducts();
    this.fetchLastInvoiceNumber();

    // Check for draft data in localStorage first
    const draftDataStr = localStorage.getItem('draftForQuotation');
    if (draftDataStr) {
      try {
        this.draftData = JSON.parse(draftDataStr);
        this.populateQuotationFromDraft(this.draftData);
        // Clear localStorage after use
        localStorage.removeItem('draftForQuotation');
      } catch (error) {
        console.error('Error parsing draft data:', error);
      }
    } else {
      // Check URL params if no draft data in localStorage
      this.activatedRoute.params.subscribe(params => {
        this.quotationId = params['id'];
        if (this.quotationId) {
          this.isEditMode = true;
          this.loadQuotation();
        } else {
          // Auto-generate invoice number for new quotations
          this.generateInvoiceNumber();
        }
      });
    }

    this.toggleWalkInCustomer();
  }

  fetchLastInvoiceNumber(): void {
    // Fetch the last invoice number from the database to use for auto-generation
    this.quotationsService.getLastInvoiceNumber().subscribe({
      next: (data) => {
        if (data && data.lastInvoiceNo) {
          this.lastInvoiceNumber = data.lastInvoiceNo;
        } else {
          // If no previous invoice exists, start with a default
          this.lastInvoiceNumber = 'INV-0000';
        }
      },
      error: (error) => {
        console.error('Error fetching last invoice number:', error);
        // Default in case of error
        this.lastInvoiceNumber = 'INV-0000';
      },
      complete: () => {
        // If we're not in edit mode, generate a new invoice number
        if (!this.isEditMode && !this.quotationId) {
          this.generateInvoiceNumber();
        }
      }
    });
  }

  generateInvoiceNumber(): void {
    if (!this.isEditMode && this.lastInvoiceNumber) {
      // Parse the current number from the invoice
      const prefix = this.lastInvoiceNumber.split('-')[0] || 'INV';
      const currentNumber = parseInt((this.lastInvoiceNumber.split('-')[1] || '0000'), 10);
      
      // Generate next number (increment by 1)
      const nextNumber = currentNumber + 1;
      
      // Format with leading zeros (4 digits)
      const formattedNumber = nextNumber.toString().padStart(4, '0');
      
      // Set the new invoice number
      this.quotation.invoiceNo = `${prefix}-${formattedNumber}`;
    }
  }

  populateQuotationFromDraft(draftData: any): void {
    // Populate customer information
    if (draftData.customerId) {
      this.quotation.customer = draftData.customerName || draftData.customerId;
      
      // Find the customer in our list to get additional info
      this.customerService.getCustomers().subscribe({
        next: (customers) => {
          const customer = customers.find(c => c.id === draftData.customerId);
          if (customer) {
            // Populate billing and shipping addresses if available
            this.quotation.billingAddress = customer.billingAddress || '';
            this.quotation.shippingAddress = customer.shippingAddress || '';
          }
        }
      });
    }
    
    // Set sale date
    if (draftData.saleDate) {
      this.quotation.saleDate = new Date(draftData.saleDate).toISOString().slice(0, 16);
    }
    
    // Set discount amount
    if (draftData.discountAmount !== undefined) {
      this.quotation.discountAmount = draftData.discountAmount;
    }
    
    // Set shipping charges
    if (draftData.shippingCharges !== undefined) {
      this.quotation.shippingCharges = draftData.shippingCharges;
    }
    
    // Set shipping status
    if (draftData.shippingStatus) {
      this.quotation.shippingStatus = draftData.shippingStatus;
    }
    
    // Populate product information from draft
    if (draftData.products && draftData.products.length > 0) {
      // Clear existing sales order array
      this.quotation.salesOrder = [];
      
      // Add each product from draft to the sales order
      draftData.products.forEach((product: any) => {
        this.quotation.salesOrder.push({
          productName: product.productName || '',
          productId: product.productId || '',
          quantity: product.quantity || 1,
          unitPrice: product.unitPrice || 0,
          discount: product.discount || 0,
          subtotal: this.calculateSubtotal(product)
        });
      });
      
      // If no products were added, add an empty product row
      if (this.quotation.salesOrder.length === 0) {
        this.quotation.salesOrder.push({
          productName: '',
          productId: '',
          quantity: 1,
          unitPrice: 0,
          discount: 0,
          subtotal: 0
        });
      }
    }
    
    // Calculate the total
    this.calculateTotal();

    // Generate invoice number if not in edit mode and invoice field is empty
    if (!this.isEditMode && !this.quotation.invoiceNo) {
      this.generateInvoiceNumber();
    }
  }

  calculateSubtotal(product: any): number {
    const quantity = product.quantity || 1;
    const unitPrice = product.unitPrice || 0;
    const discount = product.discount || 0;
    return (quantity * unitPrice) - discount;
  }

  loadCustomers(): void {
    this.customerService.getCustomers().subscribe({
      next: (customers) => {
        this.customers = customers;
      },
      error: (error) => {
        console.error('Error loading customers:', error);
      }
    });
  }

  loadProducts(): void {
    this.productService.getProductsRealTime().subscribe({
      next: (products) => {
        this.products = products;
      },
      error: (error) => {
        console.error('Error loading products:', error);
      }
    });
  }

  getCustomerDisplayName(customer: any): string {
    if (customer.businessName) {
      return customer.businessName;
    } else {
      return `${customer.firstName || ''} ${customer.middleName ? customer.middleName + ' ' : ''}${customer.lastName || ''}`.trim();
    }
  }

  loadQuotation(): void {
    if (this.quotationId) {
      this.quotationsService.getQuotationById(this.quotationId).subscribe({
        next: (data) => {
          this.quotation = { ...this.quotation, ...data };
          
          if (!this.quotation.salesOrder || this.quotation.salesOrder.length === 0) {
            this.quotation.salesOrder = [
              { productName: '', productId: '', quantity: 1, unitPrice: 0, discount: 0, subtotal: 0 }
            ];
          }
          
          this.calculateTotal();
        },
        error: (error) => {
          console.error('Error loading quotation:', error);
          alert('Failed to load quotation. ' + error);
        }
      });
    }
  }

  addProduct(): void {
    this.quotation.salesOrder.push({
      productName: '',
      productId: '',
      quantity: 1,
      unitPrice: 0,
      discount: 0,
      subtotal: 0
    });
  }

  removeProduct(index: number): void {
    if (this.quotation.salesOrder.length > 1) {
      this.quotation.salesOrder.splice(index, 1);
      this.calculateTotal();
    }
  }

  onProductSelected(index: number, productId: string): void {
    const selectedProduct = this.products.find(p => p.id === productId);
    
    if (selectedProduct) {
      this.quotation.salesOrder[index].productName = selectedProduct.productName;
      this.quotation.salesOrder[index].productId = selectedProduct.id;
      
      // Set the unit price to the default selling price
      if (selectedProduct.defaultSellingPriceExcTax) {
        this.quotation.salesOrder[index].unitPrice = selectedProduct.defaultSellingPriceExcTax;
      } else {
        this.quotation.salesOrder[index].unitPrice = 0;
      }
      
      this.updateSubtotal(index);
    }
  }

  updateSubtotal(index: number): void {
    const item = this.quotation.salesOrder[index];
    item.subtotal = (item.quantity * item.unitPrice) - item.discount;
    
    if (item.subtotal < 0) {
      item.subtotal = 0;
    }
    
    this.calculateTotal();
  }

  calculateTotal(): void {
    let subtotal = this.quotation.salesOrder.reduce((sum, item) => sum + item.subtotal, 0);

    let discountAmount = 0;
    if (this.quotation.discountType === 'percentage') {
      discountAmount = subtotal * (this.quotation.discountAmount / 100);
    } else {
      discountAmount = this.quotation.discountAmount;
    }

    let taxAmount = 0;
    if (this.quotation.orderTax === '5') {
      taxAmount = (subtotal - discountAmount) * 0.05;
    } else if (this.quotation.orderTax === '10') {
      taxAmount = (subtotal - discountAmount) * 0.10;
    }

    this.quotation.orderTaxAmount = taxAmount;
    this.quotation.totalPayable = subtotal - discountAmount + taxAmount + this.quotation.shippingCharges;
    this.quotation.totalPayable = Math.round(this.quotation.totalPayable * 100) / 100;
  }

  getTotalItems(): number {
    return this.quotation.salesOrder.reduce((total, item) => total + item.quantity, 0);
  }

  toggleWalkInCustomer(): void {
    if (this.quotation.walkInCustomer) {
      this.quotation.billingAddress = 'Walk-In Customer';
      this.quotation.shippingAddress = 'Walk-In Customer';
    } else if (this.quotation.billingAddress === 'Walk-In Customer') {
      this.quotation.billingAddress = '';
      this.quotation.shippingAddress = '';
    }
  }

  validateQuotation(): boolean {
    if (!this.quotation.customer || !this.quotation.saleDate) {
      alert('Please fill in all required fields (Customer and Sale Date)');
      return false;
    }

    for (let i = 0; i < this.quotation.salesOrder.length; i++) {
      const item = this.quotation.salesOrder[i];
      if (!item.productName || item.quantity <= 0 || item.unitPrice < 0) {
        alert(`Please fill in all required fields for product at row ${i + 1}`);
        return false;
      }
    }

    return true;
  }

  onSave(): void {
    if (!this.validateQuotation()) {
      return;
    }

    if (this.isSubmitting) {
      return;
    }
    this.isSubmitting = true;

    this.quotation.salesOrder.forEach((item, index) => {
      this.updateSubtotal(index);
    });
    
    this.quotation.lastUpdated = new Date().toISOString();

    // Check if invoice number is empty, if so generate one before saving
    if (!this.quotation.invoiceNo || this.quotation.invoiceNo.trim() === '') {
      this.generateInvoiceNumber();
    }

    if (this.isEditMode && this.quotationId) {
      this.quotationsService.updateQuotation(this.quotationId, this.quotation)
        .then(() => {
          alert('Quotation updated successfully');
          this.router.navigate(['/list-quotations']);
        })
        .catch(error => {
          alert('Error updating quotation: ' + error.message);
        })
        .finally(() => {
          this.isSubmitting = false;
        });
    } else {
      this.quotationsService.saveQuotation(this.quotation)
        .then(() => {
          alert('Quotation saved successfully');
          this.router.navigate(['/list-quotations']);
        })
        .catch(error => {
          alert('Error saving quotation: ' + error.message);
        })
        .finally(() => {
          this.isSubmitting = false;
        });
    }
  }

  onDelete(): void {
    if (this.quotationId && confirm('Are you sure you want to delete this quotation?')) {
      this.quotationsService.deleteQuotation(this.quotationId)
        .then(() => {
          alert('Quotation deleted successfully');
          this.router.navigate(['/list-quotations']);
        })
        .catch(error => {
          alert('Error deleting quotation: ' + error.message);
        });
    }
  }

  onFileChange(event: any, field: string): void {
    const file = event.target.files[0];
    if (file) {
      if (field === 'attachDocument') {
        this.quotation.attachDocument = file;
      } else if (field === 'shippingDocuments') {
        this.quotation.shippingDocuments = file;
      }
    }
  }
}