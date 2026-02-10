import { Component, OnInit, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';
import { SaleService } from '../services/sale.service';
import { AccountService } from '../services/account.service'; // IMPORTED
import { Modal } from 'bootstrap';
import { MatSnackBar } from '@angular/material/snack-bar';

// Interface to strongly type product data from the sale object
interface SaleProduct {
  [key: string]: any;
  productId?: string;
  id?: string;
  name?: string;
  productName?: string;
  unitPrice?: number;
  price?: number;
  quantity?: number;
  quantityReturned?: number; 
  sku?: string;
  barcode?: string;
  taxRate?: number;
  taxAmount?: number;
  unitPriceBeforeTax?: number;
  priceBeforeTax?: number;
  subtotal?: number; 
}

interface ReturnProductItem extends SaleProduct {
  originalQuantity: number;
  returnQuantity: number;
  returnSubtotal: number; 
  isReturning: boolean;
  unitPriceBeforeTax: number;
}

@Component({
  selector: 'app-sell-return',
  templateUrl: './sell-return.component.html',
  styleUrls: ['./sell-return.component.scss']
})
export class SellReturnComponent implements OnInit, AfterViewInit {
  saleData: any; 
  returnData: {
    returnDate: string;
    reason: string;
    returnStatus: string;
    paymentStatus: string;
    products: ReturnProductItem[];
  } = this.initReturnData();

  // ADDED: Toggle and Fields for Refund
  processRefundNow: boolean = false;
  refundDate: string = new Date().toISOString().split('T')[0];
  refundMethod: string = 'Cash';

  isDisabled: boolean = false;
  disabledMessage: string = "Processing your request...";
  returnModal: Modal | null = null;
  Math = Math; 

  // ADDED: Variables for Account Selection
  paymentAccounts: any[] = [];
  selectedAccountId: string = '';

  constructor(
    private router: Router,
    private saleService: SaleService,
    private accountService: AccountService, // INJECTED
    private snackBar: MatSnackBar
  ) {
    const navigation = this.router.getCurrentNavigation();
    this.saleData = navigation?.extras?.state?.['saleData'];

    if (!this.saleData) {
      console.error('No sale data found, redirecting to sales page');
      this.router.navigate(['/sales']);
    }
  }

  ngOnInit(): void {
    if (this.saleData) {
      this.initializeReturnData();
      // ADDED: Load accounts on init
      this.loadPaymentAccounts();
    }
  }

  ngAfterViewInit(): void {
    const modalElement = document.getElementById('returnModal');
    if (modalElement && !this.returnModal) {
      this.returnModal = new Modal(modalElement);
      this.returnModal.show();

      modalElement.addEventListener('hidden.bs.modal', () => {
        this.navigateToSales();
      });
    }
  }

  // ADDED: Fetch accounts from AccountService
  loadPaymentAccounts(): void {
    this.accountService.getPaymentAccounts().subscribe(accounts => {
      this.paymentAccounts = accounts;
      
      // Auto-select the account used in the original sale if found
      if (this.saleData.paymentAccountId || this.saleData.paymentAccount) {
         const originalId = this.saleData.paymentAccountId || this.saleData.paymentAccount;
         // Handle object or string
         const originalIdString = typeof originalId === 'object' ? originalId.id : originalId;
         
         const found = this.paymentAccounts.find(acc => acc.id === originalIdString);
         if (found) {
           this.selectedAccountId = found.id;
         }
      }
    });
  }

  initReturnData() {
    return {
      returnDate: new Date().toISOString().split('T')[0],
      reason: '',
      returnStatus: 'pending',
      paymentStatus: 'pending',
      products: []
    };
  }

  initializeReturnData(): void {
    if (!this.saleData || !Array.isArray(this.saleData.products)) return;

    this.returnData.products = this.saleData.products.map((product: SaleProduct, index: number) => {
      const productId = product.productId || product.id || `temp_${index}`;
      const productName = product.productName || product.name || `Product ${index + 1}`;
      const unitPrice = product.unitPrice || product.price || 0;
      
      const quantitySold = Math.max(0, product.quantity || 0);
      const quantityAlreadyReturned = product.quantityReturned || 0;
      const returnableQuantity = quantitySold - quantityAlreadyReturned;

      const unitPriceBeforeTax = this.getUnitPriceBeforeTax(product);

      return {
        ...product,
        id: productId,
        productId: productId,
        name: productName,
        productName: productName,
        originalQuantity: returnableQuantity, 
        returnQuantity: 0, 
        isReturning: false,
        unitPrice: unitPrice,
        unitPriceBeforeTax: unitPriceBeforeTax,
        returnSubtotal: 0
      } as ReturnProductItem;
    });
  }

  getUnitPriceBeforeTax(product: SaleProduct): number {
    if (product.unitPriceBeforeTax !== undefined && product.unitPriceBeforeTax !== null) {
      return Number(product.unitPriceBeforeTax);
    }
    if (product.priceBeforeTax !== undefined && product.priceBeforeTax !== null) {
      return Number(product.priceBeforeTax);
    }
    const priceWithTax = Number(product.unitPrice || product.price || 0);
    const taxRate = Number(product.taxRate) || 0;

    if (priceWithTax > 0 && taxRate > 0) {
      return priceWithTax / (1 + (taxRate / 100));
    }
    return priceWithTax;
  }

  onReturnQuantityChange(index: number): void {
    const product = this.returnData.products[index];
    if (!product) return;

    const availableQuantity = product.originalQuantity || 0;
    let returnQuantity = Number(product.returnQuantity) || 0;

    if (returnQuantity < 0) {
      returnQuantity = 0;
      this.showSnackbar('Return quantity cannot be negative', 'error');
    }

    if (returnQuantity > availableQuantity) {
      returnQuantity = availableQuantity;
      this.showSnackbar(`Cannot return more than ${availableQuantity} items of "${product.name}".`, 'error');
    }

    product.returnQuantity = Math.floor(returnQuantity);
    product.isReturning = product.returnQuantity > 0;

    this.calculateReturnSubtotal(index);
  }

  isFullReturn(): boolean {
    if (!this.saleData || !this.saleData.products || this.saleData.products.length === 0) {
      return false; 
    }
    return this.returnData.products.every(p => p.returnQuantity === p.originalQuantity);
  }

  hasReturnItems(): boolean {
    return this.returnData.products.some(p => (p.returnQuantity || 0) > 0);
  }

  getReturningItemsCount(): number {
    return this.returnData.products.filter(p => (p.returnQuantity || 0) > 0).length;
  }

  increaseReturnQuantity(index: number): void {
    const product = this.returnData.products[index];
    if (product && product.returnQuantity < product.originalQuantity) {
      product.returnQuantity = Number(product.returnQuantity) + 1;
      product.isReturning = true;
      this.calculateReturnSubtotal(index);
    }
  }

  decreaseReturnQuantity(index: number): void {
    const product = this.returnData.products[index];
    if (product && product.returnQuantity > 0) {
      product.returnQuantity = Number(product.returnQuantity) - 1;
      if (product.returnQuantity === 0) {
        product.isReturning = false;
      }
      this.calculateReturnSubtotal(index);
    }
  }

  onReturnQuantityBlur(index: number): void {
    const product = this.returnData.products[index];
    if (!product) return;

    const availableQty = product.originalQuantity || 0;
    const returnQty = Number(product.returnQuantity) || 0;

    if (returnQty > availableQty) {
      product.returnQuantity = availableQty;
      this.calculateReturnSubtotal(index);
      this.showSnackbar(`Quantity adjusted to maximum available: ${availableQty} for "${product.name}"`, 'info');
    } else if (returnQty < 0) {
      product.returnQuantity = 0;
      this.calculateReturnSubtotal(index);
      this.showSnackbar(`Quantity adjusted to minimum: 0 for "${product.name}"`, 'info');
    }
    product.isReturning = product.returnQuantity > 0;
  }

  validateReturnQuantities(): boolean {
    let isValid = true;
    const errors: string[] = [];

    this.returnData.products.forEach((product, index) => {
      const returnQty = Number(product.returnQuantity) || 0;
      const availableQty = product.originalQuantity || 0;

      if (returnQty < 0) {
        errors.push(`${product.name || product.productName}: Return quantity cannot be negative`);
        isValid = false;
        product.returnQuantity = 0;
        this.calculateReturnSubtotal(index);
      }

      if (returnQty > availableQty) {
        errors.push(`${product.name || product.productName}: Cannot return ${returnQty} items, only ${availableQty} available`);
        isValid = false;
        product.returnQuantity = availableQty;
        this.calculateReturnSubtotal(index);
      }
    });

    if (!isValid) {
      this.showSnackbar(errors[0], 'error');
    }

    return isValid;
  }

  getShippingChargeWithoutTax(): number {
    return Number(this.saleData?.shippingCharges || 0);
  }

  getShippingTaxRate(): number {
    return Number(this.saleData?.orderTax || 0);
  }

  getShippingTaxAmount(): number {
    const shippingCharge = this.getShippingChargeWithoutTax();
    const taxRate = this.getShippingTaxRate();
    const taxAmount = shippingCharge * (taxRate / 100);
    return parseFloat(taxAmount.toFixed(2));
  }

  getShippingChargeWithTax(): number {
    return parseFloat((this.getShippingChargeWithoutTax() + this.getShippingTaxAmount()).toFixed(2));
  }

  calculateTotalReturnAmount(): number {
    let total = this.calculateTotalReturnAmountWithoutTax() + this.calculateTotalReturnTaxAmount();

    if (this.isFullReturn() && this.saleData) {
      total += this.getShippingChargeWithTax();
    }

    const roundedTotal = Math.round(total);
    return roundedTotal;
  }

  getRoundingAdjustment(): number {
    const exact = this.getExactReturnAmount();
    const rounded = this.calculateTotalReturnAmount();
    return parseFloat((rounded - exact).toFixed(2));
  }

  calculateReturnTotalWithTax(product: ReturnProductItem): number {
    const returnQuantity = Number(product.returnQuantity) || 0;
    const unitPriceWithTax = Number(product.unitPrice || product.price || 0);
    return parseFloat((returnQuantity * unitPriceWithTax).toFixed(2));
  }

  calculateReturnTaxAmount(product: ReturnProductItem): number {
    const totalWithTax = this.calculateReturnTotalWithTax(product);
    const taxRate = Number(product.taxRate) || 0;
    if (taxRate === 0) return 0;

    const subtotalBeforeTax = totalWithTax / (1 + (taxRate / 100));
    const taxAmount = totalWithTax - subtotalBeforeTax;
    return parseFloat(taxAmount.toFixed(2));
  }

  calculateReturnSubtotal(index: number): void {
    const product = this.returnData.products[index];
    if (!product) return;

    const totalWithTax = this.calculateReturnTotalWithTax(product);
    const taxAmount = this.calculateReturnTaxAmount(product);
    
    product.returnSubtotal = parseFloat((totalWithTax - taxAmount).toFixed(2));
  }

  calculateTotalReturnAmountWithoutTax(): number {
    return this.returnData.products.reduce((total, product, index) => {
      const returnQuantity = Number(product.returnQuantity) || 0;
      const totalWithTax = returnQuantity * Number(product.unitPrice || product.price || 0);
      const taxRate = Number(product.taxRate) || 0;
      const subtotalBeforeTax = totalWithTax / (1 + (taxRate / 100));
      return total + subtotalBeforeTax;
    }, 0);
  }

  calculateTotalReturnTaxAmount(): number {
    return this.returnData.products.reduce((total, product) => {
      return total + this.calculateReturnTaxAmount(product);
    }, 0);
  }

  public getExactReturnAmount(): number {
    let total = this.returnData.products.reduce((sum, p) => sum + this.calculateReturnTotalWithTax(p), 0);

    if (this.isFullReturn() && this.saleData) {
      total += this.getShippingChargeWithTax();
    }

    return parseFloat(total.toFixed(2));
  }
async submitReturn(): Promise<void> {
  if (!this.saleData) return;
  
  if (this.processRefundNow && !this.selectedAccountId) {
    this.showSnackbar('Please select a Refund Account.', 'error');
    return;
  }

  this.isDisabled = true;
  this.disabledMessage = "Processing return...";

  try {
    // --- ROBUST LOCATION IDENTIFICATION ---
    // This solves the "Missing location information" UI error you saw
    const derivedLocationId = this.saleData.businessLocationId || 
                             this.saleData.locationId || 
                             (typeof this.saleData.businessLocation === 'string' ? this.saleData.businessLocation : null) ||
                             (typeof this.saleData.location === 'string' ? this.saleData.location : null) ||
                             'default';

    const returnDataPayload = {
      originalSaleId: this.saleData.id,
      invoiceNo: this.saleData.invoiceNo,
      customer: this.saleData.customer,
      businessLocationId: derivedLocationId, // Pass the identified location
      
      processPayment: this.processRefundNow,
      paymentAccountId: this.processRefundNow ? this.selectedAccountId : null,
      paymentDate: this.processRefundNow ? new Date(this.refundDate) : null,
      paymentMethod: this.processRefundNow ? this.refundMethod : null,

      returnedItems: this.returnData.products
        .filter(p => (p.returnQuantity || 0) > 0) 
        .map(p => ({
          productId: p.productId || p.id,
          name: p.productName || p.name,
          quantity: p.returnQuantity,
          originalQuantity: p.originalQuantity,
          unitPrice: Number(p.unitPrice) || 0,
          subtotal: p.returnSubtotal || 0,
          taxRate: Number(p.taxRate) || 0,
          totalWithTax: this.calculateReturnTotalWithTax(p)
        })),
      
      totalRefund: this.calculateTotalReturnAmount(),
      returnDate: this.returnData.returnDate,
      reason: this.returnData.reason.trim()
    };

    await this.saleService.processReturn(returnDataPayload);

    this.showSnackbar(`Return processed successfully.`, 'success');
    if (this.returnModal) this.returnModal.hide();

  } catch (error: any) {
    console.error('Error:', error);
    this.showSnackbar(`Failed: ${error.message}`, 'error');
  } finally {
    this.isDisabled = false;
  }
}


  navigateToSales(): void {
    this.isDisabled = false;
    this.disabledMessage = "";
    
    if (this.returnModal) {
      try {
        this.returnModal.dispose();
      } catch (e) {
        console.warn('Error disposing modal:', e);
      }
    }
    this.router.navigate(['/sales']);
  }
  
  onCancel(): void {
    this.isDisabled = false;
    this.disabledMessage = "";
    
    if (this.returnModal) {
      this.returnModal.hide();
    } else {
      this.navigateToSales();
    }
  }


  private showSnackbar(message: string, type: 'success' | 'error' | 'info'): void {
    this.snackBar.open(message, 'Close', {
      duration: 5000, 
      panelClass: type === 'success' ? ['snackbar-success'] :
        type === 'error' ? ['snackbar-error'] :
          ['snackbar-info']
    });
  }
}