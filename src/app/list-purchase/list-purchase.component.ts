import { Component, OnInit, AfterViewInit, HostListener } from '@angular/core';
import { PurchaseService } from '../services/purchase.service';
import { PurchaseReturnService } from '../services/purchase-return.service';
import { Subscription } from 'rxjs';
import {  OnDestroy } from '@angular/core';

import { DatePipe } from '@angular/common';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, ActivatedRoute } from '@angular/router';
import { Modal } from 'bootstrap';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PaymentService } from '../services/payment.service';
import { LocationService } from '../services/location.service';
import { AccountService } from '../services/account.service';
import { SupplierService } from '../services/supplier.service';
import { GoodsService } from '../services/goods.service';


interface Supplier {
  id: number;
  name: string;
}

interface ProductItem {
  id?: string;
  productId?: string;
  taxAmount?: number;
  taxRate?: number; 
  name: string;
  productName?: string;
  quantity?: number;
  price?: number;
  unitCost?: number;
  code?: string;
  batchNumber?: string;
  expiryDate?: Date | string;
}
interface Payment {
  id?: string;
  purchaseId?: string;
  supplierId?: string;
  supplierName?: string;
  referenceNo?: string;
  paymentDate: Date;
  amount: number;
  paymentMethod: string;
  paymentNote?: string;
  createdAt: Date;
  type: 'purchase' | 'supplier';
}
// Define return product item interface
interface ReturnProductItem extends ProductItem {
  unitCostBeforeTax: undefined;
  unitPriceBeforeTax: number | undefined;
  returnQuantity: number;
  subtotal: number;
  productId?: string;
  productName?: string;
  sku?: string;
  unitCost?: number;
  totalCost?: number;
  returnSubtotal: number; // Renamed from subtotal for clarity
  batchNumber?: string;
  expiryDate?: Date;
  unitPrice?: number; // Add this
  quantity?: number;
  returnTaxAmount?: number; // New field for return tax calculation
  returnSubtotalWithTax?: number; // New field for subtotal including tax
}

// Define the user interface for addedBy field
interface User {
  id?: string;
  name?: string;
  email?: string;
}
interface Purchase {
  
  id: string;
  purchaseDate?: Date | string | { toDate: () => Date };
  receivedDate?: Date | string | { toDate: () => Date }; // Add this line
  totalReturnedWithoutTax?: number; // Add this new field

  referenceNo?: string;
  businessLocation?: string;
  productsTotal?: number;
    shippingTaxRefunded?: number; // ✅ ADD THIS LINE
  shippingChargesRefunded?: number; // Add this line
  
  taxRate?: number;
  cgst?: number;

  sgst?: number;
  isInterState?: boolean;
  igst?: number;
  netTotalAmount?: number;
  taxAmount?: number;
  supplier?: string;
  supplierName?: string;
  supplierId?: string;
  purchaseStatus?: string;
  paymentStatus?: string;
  grandTotal?: number;
  paymentDue?: number;
  addedBy?: string | User;
  paymentAmount?: number;
  products?: ProductItem[];
  purchaseOrder?: any;
  invoiceNo?: string;
  invoicedDate?: string;
  shippingCharges?: number;
  // --- FIX: Add new shipping fields to the interface for type safety ---
  shippingChargesBeforeTax?: number;
  shippingTaxAmount?: number;
  payTerm?: string;
  paymentMethod?: string;
  paymentAccount?: {
    id: string;
    name: string;
    accountType?: string;
    accountNumber?: string;
  };
  paymentNote?: string;
  additionalNotes?: string;
  document?: string;
  totalTax?: number;
  balance?: number;
  totalPayable?: number;
  linkedPurchaseOrderId?: string;
  supplierAddress?: string;
  hasReturns?: boolean;
  totalReturned?: number;
  totalTaxReturned?: number;
}
interface Purchase {
  id: string;
  purchaseDate?: Date | string | { toDate: () => Date };
  receivedDate?: Date | string | { toDate: () => Date };
  totalReturnedWithoutTax?: number;
  totalTaxReturned?: number; // ✅ Add this field to track returned tax
  referenceNo?: string;
  businessLocation?: string;
  productsTotal?: number;
  taxRate?: number; 
  cgst?: number;
  sgst?: number;
  isInterState?: boolean;
  igst?: number;
  netTotalAmount?: number;
  taxAmount?: number;
  supplier?: string;
  supplierName?: string;
  supplierId?: string;
  purchaseStatus?: string;
  paymentStatus?: string;
  grandTotal?: number;
  paymentDue?: number;
  addedBy?: string | User;
  paymentAmount?: number;
  products?: ProductItem[];
  purchaseOrder?: any; 
  invoiceNo?: string;
  invoicedDate?: string;
  shippingCharges?: number;
  payTerm?: string;
  paymentMethod?: string;
  paymentAccount?: {
    id: string;
    name: string;
    accountType?: string;
    accountNumber?: string;
  };
  paymentNote?: string;
  additionalNotes?: string;
  document?: string;
  totalTax?: number;
  balance?: number;
  totalPayable?: number;
  linkedPurchaseOrderId?: string;
  supplierAddress?: string;
  hasReturns?: boolean;
  totalReturned?: number;
}
interface PurchaseReturn {
  id?: string;
  returnDate: string;
  referenceNo: string;
  parentPurchaseId: string;
  parentPurchaseRef: string;
  businessLocation: string;
  supplier: string;
  returnStatus: string;
  paymentStatus: string;
  products: ReturnProductItem[];
  reason: string;
  grandTotal: number;
  totalTaxReturned?: number; // New field for total tax returned
  createdAt: Date;
  createdBy: string;
}
@Component({
  selector: 'app-list-purchase',
  templateUrl: './list-purchase.component.html',
  styleUrls: ['./list-purchase.component.scss'],
  providers: [DatePipe]
})
export class ListPurchaseComponent implements OnInit, AfterViewInit {
  purchases: Purchase[] = [];
  filteredPurchases: Purchase[] = [];
    totalShippingTaxRefunded = 0; // ✅ NEW: Track refunded shipping tax

  isLoading = true;
  totalReturnsAmountWithoutTax = 0;
  totalReturnsTaxAmount = 0; // ✅ Property to hold the aggregated tax total

  totalPurchaseReturnsWithShipping = 0; // Add this property
  purchaseReturns: any[] = [];
  paymentAccounts: any[] = [];
  allLocations: any[] = []; 
  totalGrandTotal: number = 0;
  totalTax: number = 0;
  totalPaymentDue: number = 0;
  totalShippingChargesBeforeTax: number = 0;
  totalShippingTaxAmount: number = 0;

  Math = Math; // ✅ expose Math to the template
  showColumnVisibilityDropdown = false;
  columns: { field: string; label: string; visible: boolean; }[] = [];
  goodsReceivedNotes: any[] = [];
  currentActionPopup: string | null = null;
  isSaving = false;
  paymentAccountsLoading = false;
  private balanceSubscription: Subscription | undefined;

  errorMessage = '';
  showFilterSidebar = false;
  // In your component class
  isProcessingPayment = false; // Initialize as false

  statusFilter = '';
  selectedDateRange: string = '';
  isDisabled: boolean = false;
  disabledMessage: string = "Processing your request...";
  selectedPurchaseForAction: Purchase | null = null;
  actionModal: Modal | null = null;
  paymentStatusFilter = '';
  supplierFilter = '';
  currentPage = 1;
  itemsPerPage = 10;
  totalItems = 0;
  locationFilter = '';  
  uniqueSuppliers: string[] = [];
  uniqueLocations: string[] = [];
  dateFilter = {
    startDate: '',
    endDate: ''
  };
  searchText = '';
  showFilterDrawer = false;

  showPaymentForm = false;
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  currentPaymentPurchase: Purchase | null = null;
  paymentForm: FormGroup;
  supplierSearchText: string = '';
  filteredSuppliers: string[] = [];
  // Add this to your component class
   // Date range
  showDateRangeDrawer = false;

  returnModal: Modal | null = null;
  private currentOpenModal: Modal | null = null;
  selectedPurchase: Purchase | null = null;
  returnData: {
    returnDate: string;
    reason: string;
    returnStatus: string;
    paymentStatus: string;
    products: ReturnProductItem[];
  } = this.initReturnData();
  statusModal: Modal | null = null;
  selectedPurchaseForStatus: Purchase | null = null;
  newPurchaseStatus: string = 'ordered';
  totalReturnsAmount = 0;

constructor(
    private purchaseService: PurchaseService,
    private purchaseReturnService: PurchaseReturnService,
    private datePipe: DatePipe,
    private snackBar: MatSnackBar,
    private router: Router,
    private route: ActivatedRoute,
    private paymentService: PaymentService,
    private fb: FormBuilder,
    private locationService: LocationService,
    private supplierService: SupplierService,
  private accountService: AccountService,
  private goodsService: GoodsService
  ) {
    this.paymentForm = this.fb.group({
      purchaseId: [''],
      referenceNo: [''],
      supplierName: [''],
      paymentAccount: [null, Validators.required],
      paymentMethod: ['Cash', Validators.required],
      paymentNote: [''],
      paidDate: [new Date().toISOString().slice(0, 16), Validators.required],
      amount: [0, [Validators.required, Validators.min(0.01)]]
    });
  }

 loadPurchaseReturns(): void {
    this.purchaseReturnService.getPurchaseReturns().subscribe({
      next: (returns: any[]) => {
        this.purchaseReturns = returns;

        // Use the enhanced method to get all totals including shipping tax
        const totals = this.purchaseReturnService.getReturnTotals(returns);

        // Assign the calculated totals to the component properties
        this.totalReturnsAmountWithoutTax = totals.totalWithoutTax;
        this.totalReturnsTaxAmount = totals.totalTax;
        this.totalPurchaseReturnsWithShipping = totals.totalShipping;
        this.totalShippingTaxRefunded = totals.totalShippingTax; // ✅ NEW

        console.log('Purchase Returns Summary:', {
          amountWithoutTax: this.totalReturnsAmountWithoutTax,
          taxAmount: this.totalReturnsTaxAmount,
          shippingRefund: this.totalPurchaseReturnsWithShipping,
          shippingTaxRefund: this.totalShippingTaxRefunded // ✅ NEW
        });
      },
      error: (error) => {
        console.error('Error loading purchase returns:', error);
        // Reset totals on error to avoid showing stale data
        this.totalReturnsAmountWithoutTax = 0;
        this.totalReturnsTaxAmount = 0;
        this.totalPurchaseReturnsWithShipping = 0;
        this.totalShippingTaxRefunded = 0; // ✅ NEW
      }
    });
  }

calculateTotalReturnAmount(): number {
  let total = this.calculateTotalReturnAmountWithoutTax() + this.calculateTotalReturnTaxAmount();

  // Only add shipping for full returns
  if (this.isFullReturn() && this.selectedPurchase) {
    if (this.selectedPurchase.shippingChargesBeforeTax) {
      total += this.selectedPurchase.shippingChargesBeforeTax;
    }
    if (this.selectedPurchase.shippingTaxAmount) {
      total += this.selectedPurchase.shippingTaxAmount;
    }
  }
  
  return parseFloat(total.toFixed(2));
}
calculateFooterTotals(): void {
  this.totalGrandTotal = this.filteredPurchases.reduce((sum, p) => sum + (Number(p.grandTotal) || 0), 0);
  
  // ✅ FIX: Include shipping tax in total tax calculation
  this.totalTax = this.filteredPurchases.reduce((sum, p) => {
    const productTax = Number(p.totalTax) || 0;
    const shippingTax = Number(p.shippingTaxAmount) || 0;
    return sum + productTax + shippingTax;
  }, 0);
  
  this.totalPaymentDue = this.filteredPurchases.reduce((sum, p) => sum + (Number(p.paymentDue) || 0), 0);
  this.totalShippingChargesBeforeTax = this.filteredPurchases.reduce((sum, p) => sum + (Number(p.shippingChargesBeforeTax) || 0), 0);
  this.totalShippingTaxAmount = this.filteredPurchases.reduce((sum, p) => sum + (Number(p.shippingTaxAmount) || 0), 0);
}
async submitReturn(): Promise<void> {
  if (!this.selectedPurchase) {
    this.showSnackbar('No purchase selected for return', 'error');
    return;
  }

  if (!this.validateReturnQuantities()) {
    return;
  }

  const hasReturns = this.returnData.products.some(p => (p.returnQuantity || 0) > 0);
  if (!hasReturns) {
    this.showSnackbar('Please specify quantities to return', 'error');
    return;
  }
  
  const locationName = this.selectedPurchase.businessLocation || '';
  const location = this.allLocations.find(loc => loc.name === locationName);
  const locationId = location ? location.id : '';

  if (!locationId) {
    this.showSnackbar('Could not find a valid ID for the business location.', 'error');
    return;
  }

  this.isDisabled = true;
  this.disabledMessage = "Processing return...";

  try {
    const totalReturnAmountWithoutTax = this.calculateTotalReturnAmountWithoutTax();
    const totalTaxReturned = this.calculateTotalReturnTaxAmount();
    const totalReturnAmount = totalReturnAmountWithoutTax + totalTaxReturned;

    const isFullReturn = this.isFullReturn();
    
    // ✅ MODIFIED: Conditional shipping refund logic
    // For full returns: Include both shipping charges and shipping tax
    // For partial returns: No shipping refunds
    const shippingChargesRefunded = isFullReturn ? (this.selectedPurchase.shippingChargesBeforeTax || 0) : 0;
    const shippingTaxRefunded = isFullReturn ? (this.selectedPurchase.shippingTaxAmount || 0) : 0;
    
    // Calculate net return amount with conditional shipping
    const netReturnAmount = totalReturnAmount + shippingChargesRefunded + shippingTaxRefunded;

    console.log('📊 Conditional Return Calculation:', {
      isFullReturn: isFullReturn,
      withoutTax: totalReturnAmountWithoutTax,
      productTax: totalTaxReturned,
      shippingCharges: shippingChargesRefunded,
      shippingTax: shippingTaxRefunded,
      netReturn: netReturnAmount,
      message: isFullReturn ? 'Full return - shipping included' : 'Partial return - no shipping refund'
    });

    const returnData: any = {
      returnDate: this.returnData.returnDate || new Date().toISOString().split('T')[0],
      referenceNo: `PRN-${Date.now()}`,
      parentPurchaseId: this.selectedPurchase.id,
      parentPurchaseRef: this.selectedPurchase.referenceNo || '',
      businessLocation: this.selectedPurchase.businessLocation || '',
      businessLocationId: locationId,
      supplier: this.selectedPurchase.supplier || '',
      supplierId: this.selectedPurchase.supplierId || '',
      returnStatus: this.returnData.returnStatus || 'pending',
      paymentStatus: this.returnData.paymentStatus || 'pending',
      reason: this.returnData.reason,
      grandTotal: netReturnAmount,
      totalWithoutTax: totalReturnAmountWithoutTax,
      totalTaxReturned: totalTaxReturned,
      isFullReturn: isFullReturn,
      shippingChargesRefunded: shippingChargesRefunded, // 0 for partial returns
      shippingTaxRefunded: shippingTaxRefunded, // 0 for partial returns
      createdAt: new Date(),
      createdBy: 'System',
      products: this.returnData.products
        .filter(p => (p.returnQuantity || 0) > 0)
        .map(p => {
          const unitPriceBeforeTax = this.getUnitCostBeforeTax(p);
          const returnQuantity = p.returnQuantity || 0;
          const subtotalBeforeTax = returnQuantity * unitPriceBeforeTax;
          const taxRate = Number(p.taxRate) || 0;
          const taxAmount = subtotalBeforeTax * (taxRate / 100);
          
          return {
            productId: p.id || p.productId || '',
            productName: p.name || p.productName || 'Unknown',
            returnQuantity: returnQuantity,
            unitPrice: Number(p.price) || Number(p.unitCost) || 0,
            unitPriceBeforeTax: unitPriceBeforeTax,
            subtotal: subtotalBeforeTax,
            taxRate: taxRate,
            taxAmount: taxAmount,
            totalWithTax: subtotalBeforeTax + taxAmount
          };
        })
    };
    
    // Process the return with the enhanced service
    await this.purchaseReturnService.processPurchaseReturnWithStock(returnData);
    
    // Update purchase record with return information
    await this.purchaseService.updatePurchase(this.selectedPurchase.id, {
      hasReturns: true,
      totalReturned: (this.selectedPurchase.totalReturned || 0) + netReturnAmount,
      totalReturnedWithoutTax: (this.selectedPurchase.totalReturnedWithoutTax || 0) + totalReturnAmountWithoutTax,
      totalTaxReturned: (this.selectedPurchase.totalTaxReturned || 0) + totalTaxReturned,
      shippingTaxRefunded: (this.selectedPurchase.shippingTaxRefunded || 0) + shippingTaxRefunded,
      shippingChargesRefunded: (this.selectedPurchase.shippingChargesRefunded || 0) + shippingChargesRefunded, // Add this field
      updatedAt: new Date()
    });

    // Dynamic success message based on return type
    const successMessage = isFullReturn 
      ? 'Full return processed successfully! Shipping charges and tax included in refund.'
      : 'Partial return processed successfully! Shipping charges retained as per policy.';
    
    this.showSnackbar(successMessage, 'success');
    
    // Refresh both purchases and returns to update totals
    this.loadPurchases();
    this.loadPurchaseReturns();

    // Refresh account book to show updated balances
    if (this.selectedPurchase.paymentAccount) {
      this.accountService.setAccountBookRefreshFlag(this.selectedPurchase.paymentAccount.id, true);
    }

    if (this.returnModal) {
      this.returnModal.hide();
    }

  } catch (error: any) {
    console.error('Error processing return:', error);
    this.showSnackbar(`Failed to process return: ${error.message || 'Unknown error'}`, 'error');
  } finally {
    this.isDisabled = false;
    this.disabledMessage = "";
  }
}
async openReturnModal(purchase: Purchase): Promise<void> {
  this.selectedPurchase = purchase;
  this.returnData = this.initReturnData();

  this.isDisabled = true;
  this.disabledMessage = "Preparing return details...";

  if (purchase.products && purchase.products.length) {
    this.returnData.products = await Promise.all(
      purchase.products.map(async (product: any) => {
        const previouslyReturnedQty = await this.purchaseReturnService.getReturnedQuantityForProduct(
          purchase.referenceNo!,
          product.id || product.productId!
        );

        const originalQty = product.quantity || 0;
        const availableForReturn = Math.max(0, originalQty - previouslyReturnedQty);

        // FIXED: Better calculation of unit price before tax
        let unitPriceBeforeTax = 0;
        
        // Priority 1: Use stored unitCostBeforeTax if available
        if (product.unitCostBeforeTax && !isNaN(parseFloat(product.unitCostBeforeTax))) {
          unitPriceBeforeTax = parseFloat(product.unitCostBeforeTax);
        } 
        // Priority 2: Use stored unitPriceBeforeTax if available
        else if (product.unitPriceBeforeTax && !isNaN(parseFloat(product.unitPriceBeforeTax))) {
          unitPriceBeforeTax = parseFloat(product.unitPriceBeforeTax);
        }
        // Priority 3: Calculate from price WITH tax (most common scenario)
        else if (product.price && !isNaN(parseFloat(product.price)) && product.taxRate) {
          const taxRate = parseFloat(product.taxRate) || 0;
          const priceWithTax = parseFloat(product.price);
          unitPriceBeforeTax = priceWithTax / (1 + (taxRate / 100));
        }
        // Priority 4: Calculate from unitCost WITH tax
        else if (product.unitCost && !isNaN(parseFloat(product.unitCost)) && product.taxRate) {
          const taxRate = parseFloat(product.taxRate) || 0;
          const unitCostWithTax = parseFloat(product.unitCost);
          unitPriceBeforeTax = unitCostWithTax / (1 + (taxRate / 100));
        }
        // Priority 5: Assume unitCost is before tax if no tax rate
        else if (product.unitCost && !isNaN(parseFloat(product.unitCost))) {
          unitPriceBeforeTax = parseFloat(product.unitCost);
        }
        // Priority 6: Assume price is before tax if no tax rate
        else if (product.price && !isNaN(parseFloat(product.price))) {
          unitPriceBeforeTax = parseFloat(product.price);
        }
        
        // --- FIX START: Calculate unit price with tax ---
        const taxRate = Number(product.taxRate) || 0;
        const unitPriceWithTax = unitPriceBeforeTax * (1 + (taxRate / 100));
        // --- FIX END ---

        const newProduct = {
          ...product,
          quantity: availableForReturn,
          returnQuantity: 0,
          returnSubtotal: 0,
          // Use the calculated value, falling back to original data if it exists
          price: product.price || unitPriceWithTax || 0,
          unitCost: product.unitCost || unitPriceWithTax || 0,
          unitPriceBeforeTax: unitPriceBeforeTax,
          unitCostBeforeTax: unitPriceBeforeTax,
          taxRate: product.taxRate || 0
        };

        return newProduct;
      })
    );
  }

  this.isDisabled = false;
  this.disabledMessage = "";

  const modalElement = document.getElementById('returnModal');
  if (modalElement) {
    if (this.returnModal) {
      this.returnModal.hide();
    }
    this.returnModal = new Modal(modalElement);
    this.returnModal.show();
  }
}
getUnitCostBeforeTax(product: ReturnProductItem): number {
  // First check if unitCostBeforeTax is available (this is the accurate pre-tax price)
  if (product.unitCostBeforeTax !== undefined && product.unitCostBeforeTax !== null) {
    return Number(product.unitCostBeforeTax);
  }

  // If we have unitPriceBeforeTax, use it
  if (product.unitPriceBeforeTax !== undefined && product.unitPriceBeforeTax !== null) {
    return Number(product.unitPriceBeforeTax);
  }
  
  // If we have a price with tax and tax rate, calculate the price before tax
  if (product.price && product.taxRate) {
    const taxRate = Number(product.taxRate) || 0;
    const priceWithTax = Number(product.price);
    // Calculate price before tax: priceBeforeTax = priceWithTax / (1 + taxRate/100)
    return priceWithTax / (1 + (taxRate / 100));
  }

  // If we have unitCost, check if it's before or after tax based on context
  // From your purchase form, unitCost appears to be the price WITH tax (₹50.00 in image)
  // So we need to reverse-calculate if we have tax rate
  if (product.unitCost !== undefined && product.unitCost !== null && product.taxRate) {
    const taxRate = Number(product.taxRate) || 0;
    const unitCostWithTax = Number(product.unitCost);
    return unitCostWithTax / (1 + (taxRate / 100));
  }

  // If unitCost exists but no tax rate, assume it's before tax
  if (product.unitCost !== undefined && product.unitCost !== null) {
    return Number(product.unitCost);
  }
  
  // Fallback to price (assume it's with tax, so calculate before tax if tax rate exists)
  if (product.price && product.taxRate) {
    const taxRate = Number(product.taxRate) || 0;
    return Number(product.price) / (1 + (taxRate / 100));
  }
  
  // Final fallback
  return Number(product.price) || 0;
}


// Helper method to get unit cost before tax from product
private getUnitCostBeforeTaxFromProduct(product: any): number {
    // This helper is used when calculating totals from stored return data
    if (product.unitPriceBeforeTax !== undefined && product.unitPriceBeforeTax !== null) {
        return Number(product.unitPriceBeforeTax);
    }
    if (product.unitCostBeforeTax !== undefined && product.unitCostBeforeTax !== null) {
        return Number(product.unitCostBeforeTax);
    }
    // Fallback for older data: calculate from price with tax
    if (product.unitPrice && product.taxRate) {
        const taxRate = Number(product.taxRate) || 0;
        return Number(product.unitPrice) / (1 + (taxRate / 100));
    }
    if (product.unitCost && product.taxRate) {
        const taxRate = Number(product.taxRate) || 0;
        return Number(product.unitCost) / (1 + (taxRate / 100));
    }
    // If no tax rate, assume price is pre-tax
    return Number(product.unitPrice) || Number(product.unitCost) || 0;
}



// 

// ✅ IMPROVED: More accurate tax calculation for returns
calculateReturnTaxAmount(product: ReturnProductItem): number {
  const returnQuantity = Number(product.returnQuantity) || 0;
  if (returnQuantity <= 0) return 0;
  
  const unitPriceBeforeTax = this.getUnitCostBeforeTax(product);
  const subtotal = returnQuantity * unitPriceBeforeTax;
  const taxRate = Number(product.taxRate) || 0;
  
  // Use precise calculation to avoid floating point errors
  const taxAmount = parseFloat((subtotal * (taxRate / 100)).toFixed(2));
  
  return taxAmount;
}

// ✅ IMPROVED: Total tax calculation with validation
calculateTotalReturnTaxAmount(): number {
  const totalTax = this.returnData.products.reduce((total, product) => {
    return total + this.calculateReturnTaxAmount(product);
  }, 0);
  
  return parseFloat(totalTax.toFixed(2));
}

// New method to calculate return total with tax for a single product
calculateReturnTotalWithTax(product: ReturnProductItem): number {
  const returnQuantity = Number(product.returnQuantity) || 0;
  const unitPriceBeforeTax = this.getUnitCostBeforeTax(product);
  const subtotal = returnQuantity * unitPriceBeforeTax;
  const taxAmount = this.calculateReturnTaxAmount(product);
  return subtotal + taxAmount;
}


calculateTotalPurchaseReturnsWithoutTax(): number {
  return this.purchaseReturns.reduce((total, returnItem) => {
    // First priority: Use the stored totalWithoutTax if available
    if (returnItem.totalWithoutTax !== undefined && returnItem.totalWithoutTax !== null) {
      return total + Number(returnItem.totalWithoutTax);
    }
    
    // Second priority: Calculate from products array (most accurate)
    if (returnItem.products && Array.isArray(returnItem.products)) {
      const productsTotal = returnItem.products.reduce((productSum: number, product: any) => {
        const returnQuantity = Number(product.returnQuantity) || 0;
        const unitPriceBeforeTax = this.getUnitCostBeforeTaxFromProduct(product);
        return productSum + (returnQuantity * unitPriceBeforeTax);
      }, 0);
      
      return total + productsTotal;
    }
    
    // Final fallback: Try to reverse-calculate from grandTotal
    if (returnItem.grandTotal !== undefined && returnItem.grandTotal !== null) {
      const grandTotal = Number(returnItem.grandTotal);
      
      // If we have tax information, remove it
      if (returnItem.totalTaxReturned !== undefined && returnItem.totalTaxReturned !== null) {
        return total + (grandTotal - Number(returnItem.totalTaxReturned));
      }
      
      // If no tax info, assume standard 18% GST and reverse calculate
      const estimatedWithoutTax = grandTotal / 1.18;
      return total + estimatedWithoutTax;
    }
    
    return total;
  }, 0);
}

calculateTotalReturnAmountWithoutTax(): number {
  return this.returnData.products.reduce((total, product) => {
    const returnQuantity = Number(product.returnQuantity) || 0;
    const unitPriceBeforeTax = this.getUnitCostBeforeTax(product);
    const subtotal = returnQuantity * unitPriceBeforeTax;
    return total + subtotal;
  }, 0);
}


  openModal(modalId: string): void {
    if (this.currentOpenModal) {
      this.currentOpenModal.hide();
    }
    
    const modalElement = document.getElementById(modalId);
    if (modalElement) {
      this.currentOpenModal = new Modal(modalElement);
      this.currentOpenModal.show();
    }
  }
  closeCurrentModal(): void {
    if (this.currentOpenModal) {
      this.currentOpenModal.hide();
      this.currentOpenModal = null;
    }
  }
  hasReturnItems(): boolean {
  return this.returnData.products.some(p => (p.returnQuantity || 0) > 0);
}
  openActionModal(purchase: Purchase): void {
  this.selectedPurchaseForAction = purchase;
  
  if (!this.actionModal) {
    const modalElement = document.getElementById('actionModal');
    if (modalElement) {
      this.actionModal = new Modal(modalElement);
    }
  }
  
  if (this.actionModal) {
    this.actionModal.show();
  }
}
get visibleColumnsCount(): number {
  return this.columns.filter(col => col.visible).length;
}
  loadPaymentAccounts(): void {
    this.paymentAccountsLoading = true;
    this.accountService.getAccounts((accounts: any[]) => {
      accounts.forEach(acc => {
        acc.calculatedBalance = this.accountService.getCalculatedCurrentBalance(acc.id) ?? acc.openingBalance;
      });
      this.paymentAccounts = accounts;
      this.paymentAccountsLoading = false;
    });
  }

  
  addPayment(purchase: Purchase): void {
  this.currentPaymentPurchase = purchase;
  this.showPaymentForm = true;
  
  this.paymentForm.patchValue({
    purchaseId: purchase.id,
    referenceNo: purchase.referenceNo || '',
    supplierName: purchase.supplier || '',
    amount: Math.min(purchase.paymentDue || 0, purchase.grandTotal || 0),
    paidDate: new Date().toISOString().slice(0, 16)
  });
  
  if (this.paymentAccounts.length === 0) {
    this.loadPaymentAccounts();
  }
}

setDateRange(range: string): void {
  this.selectedDateRange = range;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  switch(range) {
    case 'today':
      this.dateFilter.startDate = this.formatDate(today);
      this.dateFilter.endDate = this.formatDate(today);
      break;
      
    case 'yesterday':
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      this.dateFilter.startDate = this.formatDate(yesterday);
      this.dateFilter.endDate = this.formatDate(yesterday);
      break;
      
    case 'last7days':
      const last7days = new Date(today);
      last7days.setDate(last7days.getDate() - 6);
      this.dateFilter.startDate = this.formatDate(last7days);
      this.dateFilter.endDate = this.formatDate(today);
      break;
      
    case 'last30days':
      const last30days = new Date(today);
      last30days.setDate(last30days.getDate() - 29);
      this.dateFilter.startDate = this.formatDate(last30days);
      this.dateFilter.endDate = this.formatDate(today);
      break;
      
    case 'lastMonth':
      const firstDayLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastDayLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      this.dateFilter.startDate = this.formatDate(firstDayLastMonth);
      this.dateFilter.endDate = this.formatDate(lastDayLastMonth);
      break;
      
    case 'thisMonth':
      const firstDayThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      this.dateFilter.startDate = this.formatDate(firstDayThisMonth);
      this.dateFilter.endDate = this.formatDate(today);
      break;
      
    case 'thisFinancialYear':
      const financialYearStartMonth = 3; 
      let startYear = today.getFullYear();
      if (today.getMonth() < financialYearStartMonth) {
        startYear--;
      }
      const firstDayFinancialYear = new Date(startYear, financialYearStartMonth, 1);
      this.dateFilter.startDate = this.formatDate(firstDayFinancialYear);
      this.dateFilter.endDate = this.formatDate(today);
      break;
      
    case 'lastFinancialYear':
      const lastFYStartMonth = 3; 
      let lastFYStartYear = today.getFullYear() - 1;
      if (today.getMonth() < lastFYStartMonth) {
        lastFYStartYear--;
      }
      const firstDayLastFY = new Date(lastFYStartYear, lastFYStartMonth, 1);
      const lastDayLastFY = new Date(lastFYStartYear + 1, lastFYStartMonth, 0);
      this.dateFilter.startDate = this.formatDate(firstDayLastFY);
      this.dateFilter.endDate = this.formatDate(lastDayLastFY);
      break;
      
    case 'custom':
      this.dateFilter.startDate = '';
      this.dateFilter.endDate = '';
      return;
  }
  
  this.applyAdvancedFilters();
}

private formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}
  sortTable(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
  
    this.filteredPurchases.sort((a, b) => {
      let valueA: any;
      let valueB: any;
  
      switch(column) {
        case 'date':
          valueA = this.getDateValue(a.purchaseDate);
          valueB = this.getDateValue(b.purchaseDate);
          break;
        case 'product':
          valueA = this.getProductsDisplay(a.products).toLowerCase();
          valueB = this.getProductsDisplay(b.products).toLowerCase();
          break;
        case 'grandTotal':
        case 'paymentDue':
          valueA = Number(a[column]) || 0;
          valueB = Number(b[column]) || 0;
          break;
          case 'supplierAddress':
  valueA = (a.supplierAddress || '').toLowerCase();
  valueB = (b.supplierAddress || '').toLowerCase();
  break;
        case 'purchaseStatus':
        case 'paymentStatus':
          valueA = (a[column] || '').toLowerCase();
          valueB = (b[column] || '').toLowerCase();
          break;
        default:
          valueA = a[column as keyof Purchase] || '';
          valueB = b[column as keyof Purchase] || '';
      }
  
      if (valueA < valueB) {
        return this.sortDirection === 'asc' ? -1 : 1;
      } else if (valueA > valueB) {
        return this.sortDirection === 'asc' ? 1 : -1;
      } else {
        return 0;
      }
    });
  }
  
  private getDateValue(date: any): number {
    if (!date) return 0;
    
    try {
      if (typeof date === 'object' && 'toDate' in date) {
        return date.toDate().getTime();
      } else if (date instanceof Date) {
        return date.getTime();
      } else {
        return new Date(date).getTime();
      }
    } catch (e) {
      return 0;
    }
  }
  loadBusinessLocations(): void {
    this.locationService.getLocations().subscribe({
      next: (locations: any[]) => {
        this.allLocations = locations; 
        this.uniqueLocations = locations.map(l => l.name).filter(name => name);
      },
      error: (error) => {
        console.error('Error loading business locations:', error);
      }
    });
  }
  getSortIcon(column: string): string {
    if (this.sortColumn !== column) {
      return 'fa-sort';
    }
    return this.sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
  }
// In src/app/list-purchase/list-purchase.component.ts

loadPurchases(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.loadGoodsReceivedNotes();

    this.purchaseService.getPurchases().subscribe({
      next: (purchases: any[]) => {
        this.purchases = purchases.map(purchase => {
          
          // ✅ THE FIX IS HERE:
          // Priority order: roundedTotal -> grandTotal -> purchaseTotal
          // This ensures the value from add-purchase form (roundedTotal) is displayed correctly
          const grandTotal = Number(purchase.roundedTotal) || Number(purchase.grandTotal) || Number(purchase.purchaseTotal) || 0;

          const paymentAmount = Number(purchase.paymentAmount) || 0;
          
          // The paymentDue is now correctly calculated based on this definitive grandTotal.
          const paymentDue = Math.max(0, grandTotal - paymentAmount);

          return {
            ...purchase,
            id: purchase.id || '',
            purchaseDate: this.getFormattedDate(purchase.purchaseDate),
            
            // Assign the corrected, consistent values for display.
            grandTotal: parseFloat(grandTotal.toFixed(2)),
            paymentDue: parseFloat(paymentDue.toFixed(2)),

            paymentAmount: paymentAmount,
            addedBy: this.getAddedByName(purchase.addedBy),
            products: Array.isArray(purchase.products) ? purchase.products : [],
            shippingChargesBeforeTax: Number(purchase.shippingChargesBeforeTax) || 0,
            shippingTaxAmount: Number(purchase.shippingTaxAmount) || 0,
          };
        });

        this.filteredPurchases = [...this.purchases];
        this.totalItems = this.filteredPurchases.length;
        this.calculateFooterTotals();
        this.isLoading = false;
      },
      error: (error) => {
        this.errorMessage = 'An error occurred while loading purchases.';
        this.isLoading = false;
        this.showSnackbar('Failed to load purchases', 'error');
        console.error('Error loading purchases:', error);
      }
    });
  }

loadSuppliers(): void {
  this.supplierService.getSuppliers().subscribe({
    next: (suppliers: any[]) => {
      this.uniqueSuppliers = suppliers
        .map(s => this.getSupplierDisplayName(s))
        .filter((name, index, self) => name && self.indexOf(name) === index)
        .sort();
      
      this.filteredSuppliers = [...this.uniqueSuppliers];
    },
    error: (error) => {
      console.error('Error loading suppliers:', error);
    }
  });
}

getSupplierDisplayName(supplier: any): string {
  if (!supplier) return 'Unknown Supplier';
  
  if (supplier.isIndividual) {
    return `${supplier.firstName || ''} ${supplier.lastName || ''}`.trim();
  }
  return supplier.businessName || 'Unknown Supplier';
}
filterSuppliers(): void {
  if (!this.supplierSearchText) {
    this.filteredSuppliers = [...this.uniqueSuppliers];
    return;
  }
  
  const searchText = this.supplierSearchText.toLowerCase();
  this.filteredSuppliers = this.uniqueSuppliers.filter(supplier => 
    supplier.toLowerCase().includes(searchText)
  );
  }
  toggleFilterDrawer() {
  this.showFilterDrawer = !this.showFilterDrawer;
}
  ngOnInit(): void {
      this.initializeColumns();
      this.loadPurchases();
      this.loadPurchaseReturns();
      this.loadPaymentAccounts();
      this.loadBusinessLocations();
      this.loadSuppliers();
      this.router.events.subscribe(() => {
        if (this.router.url === '/list-purchase') {
          this.loadPurchases();
          this.loadPurchaseReturns();
          this.loadGoodsReceivedNotes();
          this.subscribeToAccountBalances();
        }
      });
  }

   ngAfterViewInit(): void {
    const modalElement = document.getElementById('returnModal');
    if (modalElement && !this.returnModal) {
      this.returnModal = new Modal(modalElement);
      modalElement.addEventListener('hidden.bs.modal', () => {
        const backdrops = document.getElementsByClassName('modal-backdrop');
        if (backdrops.length > 0) {
          document.body.removeChild(backdrops[0]);
        }
      });
    }
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
  subscribeToAccountBalances(): void {
    this.balanceSubscription = this.accountService.accountBalances$.subscribe(balances => {
      if (this.paymentAccounts.length > 0) {
        this.paymentAccounts.forEach(acc => {
          if (balances.has(acc.id)) {
            acc.calculatedBalance = balances.get(acc.id);
          }
        });
      }
    });
  }
  ngOnDestroy(): void {
    if (this.balanceSubscription) {
      this.balanceSubscription.unsubscribe();
    }
  }
initializeColumns(): void {
    this.columns = [
      { field: 'actions', label: 'Action', visible: true },
      // ✅ UPDATED: Added 'date' field here, set visible to true, and moved it to the top
      { field: 'date', label: 'Purchase Date', visible: true }, 
      { field: 'invoiceNo', label: 'Invoice No', visible: true },
      { field: 'businessLocation', label: 'Location', visible: true },
      { field: 'supplier', label: 'Supplier', visible: true },
      { field: 'purchaseStatus', label: 'Purchase Status', visible: true },
      { field: 'paymentStatus', label: 'Payment Status', visible: true },
      { field: 'grandTotal', label: 'Grand Total', visible: true },
      { field: 'paymentDue', label: 'Payment Due', visible: true }, 
      { field: 'addedBy', label: 'Added By', visible: true },
      
      // Hidden columns
      // Note: 'purchaseDate' was removed from here because we moved it up as 'date'
      { field: 'receivedDate', label: 'Received Date', visible: false },
      { field: 'referenceNo', label: 'Reference No', visible: false },
      { field: 'supplierAddress', label: 'From Address', visible: false },
      { field: 'totalTax', label: 'Tax (₹)', visible: false },
      { field: 'cgst', label: 'CGST (₹)', visible: false },
      { field: 'sgst', label: 'SGST (₹)', visible: false },
      { field: 'igst', label: 'IGST (₹)', visible: false },
      { field: 'taxRate', label: 'Tax Rate (%)', visible: false },
      { field: 'paymentAccount', label: 'Payment Account', visible: false },
    ];
  }
  
  isColumnVisible(field: string): boolean {
    const column = this.columns.find(c => c.field === field);
    return column ? column.visible : false;
  }
calculateReturnSubtotal(index: number): void {
  const product = this.returnData.products[index];
  if (!product) return;
  
  const returnQuantity = product.returnQuantity || 0;
  const unitPriceBeforeTax = this.getUnitCostBeforeTax(product);
  
  // Use precise multiplication and round to prevent floating point issues
  const returnSubtotal = parseFloat((returnQuantity * unitPriceBeforeTax).toFixed(2));
  
  product.returnSubtotal = returnSubtotal;
}
async submitPayment(): Promise<void> {
    if (this.paymentForm.invalid || !this.currentPaymentPurchase) {
      this.paymentForm.markAllAsTouched();
      this.showSnackbar('Please fill all required fields correctly.', 'error');
      return;
    }

    this.isSaving = true;
    this.isProcessingPayment = true;

    try {
        const formValues = this.paymentForm.value;
        const selectedAccount = this.paymentAccounts.find(acc => acc.id === formValues.paymentAccount.id);

        if (!selectedAccount) {
            throw new Error("Selected payment account could not be found.");
        }
        
        const supplierName = this.currentPaymentPurchase.supplier || this.currentPaymentPurchase.supplierName || 'Unknown Supplier';
        if (!supplierName) {
            throw new Error("Supplier name is missing from the purchase record.");
        }

        const paymentData = {
            purchaseId: this.currentPaymentPurchase.id,
            supplierId: this.currentPaymentPurchase.supplierId!,
            supplierName: supplierName, 
            referenceNo: this.currentPaymentPurchase.referenceNo!,
            paymentDate: new Date(formValues.paidDate),
            amount: formValues.amount,
            paymentMethod: formValues.paymentMethod,
            paymentAccount: {
                id: selectedAccount.id,
                name: selectedAccount.name
            },
            paymentNote: formValues.paymentNote || ''
        };

        await this.purchaseService.addPaymentToPurchase(paymentData);

        const purchaseIndex = this.purchases.findIndex(p => p.id === this.currentPaymentPurchase!.id);
        if (purchaseIndex !== -1) {
            const updatedPurchase = this.purchases[purchaseIndex];
            const newPaymentAmount = (updatedPurchase.paymentAmount || 0) + paymentData.amount;
            const grandTotal = updatedPurchase.grandTotal || 0;
            const newPaymentDue = Math.max(0, grandTotal - newPaymentAmount);

            this.purchases[purchaseIndex] = {
                ...updatedPurchase,
                paymentAmount: newPaymentAmount,
                paymentDue: newPaymentDue,
                paymentStatus: newPaymentDue <= 0 ? 'Paid' : 'Partial'
            };
            this.applyFilter(); 
        }

        this.showSnackbar('Payment added successfully!', 'success');
        this.closePaymentForm();

    } catch (error: any) {
        console.error('Error processing payment:', error);
        this.showSnackbar(`Error: ${error.message || 'Could not process payment.'}`, 'error');
    } finally {
        this.isProcessingPayment = false;
        this.isSaving = false;
    }
}


closePaymentForm(): void {
  this.showPaymentForm = false;
    this.isSaving = false;

  this.paymentForm.reset({
    paymentMethod: 'Cash',
    paidDate: new Date().toISOString().slice(0, 16),
    amount: 0
  });
}


  toggleFilterSidebar(): void {
    this.showFilterSidebar = !this.showFilterSidebar;
  }
 resetFilters(): void {
   this.selectedDateRange = '';
     this.isProcessingPayment = false; 
  this.dateFilter = { startDate: '', endDate: '' };
  this.statusFilter = '';
  this.paymentStatusFilter = '';
  this.supplierFilter = '';
  this.locationFilter = '';
  this.applyAdvancedFilters();
}
  

viewProductDetails(product: any) {
  this.purchaseService.getPurchasesByProductId(product.id).then(purchasesData => {
    this.router.navigate(['/product-purchase-details', product.id], {
      state: {
        productData: product,
        purchaseData: purchasesData 
      }
    });
  }).catch(error => {
    console.error('Error fetching purchase data for product:', error);
    const filteredPurchaseData = this.purchases.filter(p => 
      p.products?.some(prod => prod.id === product.id || prod.productId === product.id)
    );
    
    this.router.navigate(['/product-purchase-details', product.id], {
      state: {
        productData: product,
        purchaseData: filteredPurchaseData
      }
    });
  });
}
  viewPayments(purchase: Purchase): void {
    if (!purchase.id || !purchase.supplierId) {
      this.showSnackbar('Purchase data is incomplete', 'error');
      return;
    }
    
    this.router.navigate(['/payment-history'], { 
      queryParams: { 
        purchaseId: purchase.id,
        purchaseRef: purchase.referenceNo,
        supplierId: purchase.supplierId,
        supplierName: purchase.supplier,
        
      }
    });
  }
updateStatus(purchase: Purchase): void {
  this.selectedPurchaseForStatus = purchase;
  this.newPurchaseStatus = purchase.purchaseStatus || 'ordered';
  this.openModal('statusModal');
}


async updatePurchaseStatus(): Promise<void> {
  if (!this.selectedPurchaseForStatus || !this.selectedPurchaseForStatus.id) {
    this.showSnackbar('No purchase selected for status update', 'error');
    return;
  }

  try {
    await this.purchaseService.updatePurchase(this.selectedPurchaseForStatus.id, {
      purchaseStatus: this.newPurchaseStatus,
      updatedAt: new Date()
    });

    this.showSnackbar('Purchase status updated successfully', 'success');
    
    const purchaseIndex = this.purchases.findIndex(p => p.id === this.selectedPurchaseForStatus?.id);
    if (purchaseIndex !== -1) {
      this.purchases[purchaseIndex].purchaseStatus = this.newPurchaseStatus;
      this.filteredPurchases = [...this.purchases]; 
    }

    this.closeCurrentModal();

  } catch (error) {
    console.error('Error updating purchase status:', error);
    this.showSnackbar('Failed to update purchase status', 'error');
  }
}



  goToPage(page: number): void {
  const totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
  if (page >= 1 && page <= totalPages) {
    this.currentPage = page;
  }
}

getPageNumbers(): number[] {
  const totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
  const pages: number[] = [];
  
  const maxVisiblePages = 5;
  let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
  let endPage = startPage + maxVisiblePages - 1;
  
  if (endPage > totalPages) {
    endPage = totalPages;
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }
  
  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }
  
  return pages;
}
getPaginatedItems(): Purchase[] {
  const startIndex = (this.currentPage - 1) * this.itemsPerPage;
  const endIndex = startIndex + this.itemsPerPage;
  return this.filteredPurchases.slice(startIndex, endIndex);
}



  getAddedByName(addedBy: string | User | undefined): string {
    if (!addedBy) return 'System';
    if (typeof addedBy === 'string') return addedBy;
    return addedBy.name || addedBy.email || addedBy.id || 'Unknown User';
  }

  getProductsDisplay(products: ProductItem[] | undefined): string {
    if (!products || products.length === 0) return 'N/A';
    
    if (products.length > 2) {
      const firstProduct = products[0].name || products[0].productName || 'Unnamed';
      const secondProduct = products[1].name || products[1].productName || 'Unnamed';
      return `${firstProduct}, ${secondProduct} +${products.length - 2} more`;
    }
    
    return products.map(p => p.name || p.productName || 'Unnamed').join(', ');
  }

private getFormattedDate(date: any): string {
  if (!date) return '';
  
  try {
    if (typeof date === 'object' && 'toDate' in date) {
      return this.datePipe.transform(date.toDate(), 'mediumDate') || '';
    } 
    else if (date instanceof Date) {
      return this.datePipe.transform(date, 'mediumDate') || '';
    } 
    else {
      return this.datePipe.transform(new Date(date), 'mediumDate') || '';
    }
  } catch (e) {
    console.error('Error formatting date:', e);
    return '';
  }
  }
  private loadGoodsReceivedNotes(): void {
  this.goodsService.getAllGoodsReceived().subscribe({
    next: (goodsNotes: any[]) => {
      const invoiceDateMap = new Map<string, Date>();
      
      goodsNotes.forEach(goods => {
        if (goods.invoiceNo && goods.receivedDate) {
          const receivedDate = goods.receivedDate.toDate 
            ? goods.receivedDate.toDate() 
            : new Date(goods.receivedDate);
          invoiceDateMap.set(goods.invoiceNo, receivedDate);
        }
      });

      this.purchases = this.purchases.map(purchase => {
        if (purchase.invoiceNo && invoiceDateMap.has(purchase.invoiceNo)) {
          return {
            ...purchase,
            receivedDate: invoiceDateMap.get(purchase.invoiceNo)
          };
        }
        return purchase;
      });

      this.filteredPurchases = [...this.purchases];
    },
    error: (error) => {
      console.error('Error loading goods received notes:', error);
    }
  });
}
  applyAdvancedFilters(): void {
    let filtered = [...this.purchases];
    
  if (this.dateFilter.startDate || this.dateFilter.endDate) {
    filtered = filtered.filter(purchase => {
      const purchaseDate = this.getDateValue(purchase.purchaseDate);
      const startDate = this.dateFilter.startDate ? new Date(this.dateFilter.startDate).getTime() : 0;
      const endDate = this.dateFilter.endDate ? new Date(this.dateFilter.endDate).getTime() + 86400000 : Date.now(); 
      
      return purchaseDate >= startDate && purchaseDate <= endDate;
    });
  }
    if (this.statusFilter) {
      filtered = filtered.filter(purchase => 
        purchase.purchaseStatus?.toLowerCase() === this.statusFilter.toLowerCase()
      );
    }
if (this.supplierFilter) {
  filtered = filtered.filter(purchase => 
    purchase.supplier === this.supplierFilter
  );
}
    if (this.paymentStatusFilter) {
      filtered = filtered.filter(purchase => 
        purchase.paymentStatus?.toLowerCase() === this.paymentStatusFilter.toLowerCase()
      );
    }
    
    if (this.supplierFilter) {
      filtered = filtered.filter(purchase => 
        purchase.supplier === this.supplierFilter
      );
    }
    
    if (this.locationFilter) {
      filtered = filtered.filter(purchase => 
        purchase.businessLocation === this.locationFilter
      );
    }
    
    this.filteredPurchases = filtered;
    this.toggleFilterSidebar();
  }
applyFilter(): void {
  if (!this.searchText) {
    this.filteredPurchases = [...this.purchases];
    return;
  }

  const searchTextLower = this.searchText.toLowerCase();
  
  this.filteredPurchases = this.purchases.filter(purchase => {
    return (
      (purchase.referenceNo && purchase.referenceNo.toLowerCase().includes(searchTextLower)) ||
      (purchase.invoiceNo && purchase.invoiceNo.toLowerCase().includes(searchTextLower)) ||
      (purchase.businessLocation && purchase.businessLocation.toLowerCase().includes(searchTextLower)) ||
      (purchase.supplier && purchase.supplier.toLowerCase().includes(searchTextLower)) ||
      (purchase.supplierAddress && purchase.supplierAddress.toLowerCase().includes(searchTextLower)) ||
      (purchase.purchaseStatus && purchase.purchaseStatus.toLowerCase().includes(searchTextLower)) ||
      (purchase.paymentStatus && purchase.paymentStatus.toLowerCase().includes(searchTextLower)) ||
      (purchase.paymentAccount?.name && purchase.paymentAccount.name.toLowerCase().includes(searchTextLower)) ||
      (purchase.addedBy && typeof purchase.addedBy === 'string' && purchase.addedBy.toLowerCase().includes(searchTextLower)) ||
      (purchase.products && purchase.products.some(product => 
        (product.name && product.name.toLowerCase().includes(searchTextLower)) ||
        (product.productName && product.productName.toLowerCase().includes(searchTextLower)) ||
        (product.code && product.code.toLowerCase().includes(searchTextLower)) ||
        (product.batchNumber && product.batchNumber.toLowerCase().includes(searchTextLower))
      )) ||
      (purchase.grandTotal && purchase.grandTotal.toString().includes(searchTextLower)) ||
      (purchase.paymentDue && purchase.paymentDue.toString().includes(searchTextLower)) ||
      (purchase.totalTax && purchase.totalTax.toString().includes(searchTextLower)) ||
      (purchase.cgst && purchase.cgst.toString().includes(searchTextLower)) ||
      (purchase.sgst && purchase.sgst.toString().includes(searchTextLower)) ||
      (purchase.igst && purchase.igst.toString().includes(searchTextLower)) ||
      (purchase.taxRate && purchase.taxRate.toString().includes(searchTextLower)))
  });
  
  this.currentPage = 1;
  this.totalItems = this.filteredPurchases.length;
}
  openActionPopup(purchase: Purchase, event: Event): void {
  event.stopPropagation();
  this.currentActionPopup = purchase.id;
}

closeActionPopup(): void {
  this.currentActionPopup = null;
}
@HostListener('document:keydown.escape', ['$event'])
onKeydownHandler(event: KeyboardEvent) {
  this.closeActionPopup();
}
viewPurchase(purchase: Purchase): void {
  this.router.navigate(['/view-purchase', purchase.id]);
}

editPurchase(purchase: Purchase): void {
  this.router.navigate(['/edit-purchase', purchase.id]);
}

confirmDelete(purchase: Purchase): void {
  if (confirm(`Are you sure you want to delete purchase ${purchase.referenceNo}?`)) {
    this.deletePurchase(purchase.id);
  }
}
  calculateTotal(property: string): string {
    const total = this.filteredPurchases.reduce((sum, purchase) => {
      return sum + (Number(purchase[property as keyof Purchase]) || 0);
    }, 0);
    return total.toFixed(2);
  }

  calculateTotalReturns(): string {
    return this.totalReturnsAmount.toFixed(2);
  }

  exportToCSV(): void {
    const headers = [
      'Date', 'Reference No', 'Invoice No', 'Products', 'Location', 'Supplier', 
      'Purchase Status', 'Payment Status', 'Grand Total', 'Payment Due', 'Added By',
      'Shipping Charges', 'Pay Term', 'Payment Method', 'Total Tax', 'Balance', 'Tax',    'Date', 'Received Date', 'Reference No', 

          'CGST', 'SGST', 'IGST', 
    ];
    
    const data = this.filteredPurchases.map(purchase => [
      purchase.purchaseDate || 'N/A',
      purchase.referenceNo || 'N/A',
      purchase.invoiceNo || 'N/A',
      purchase.products && purchase.products.length > 0 ? 
        purchase.products.map(p => p.name || p.productName || 'Unnamed').join(', ') : 'N/A',
      purchase.businessLocation || 'N/A',
      purchase.supplier || 'N/A',
      purchase.purchaseStatus || 'Unknown',
        purchase.supplierAddress || 'N/A',

      purchase.paymentStatus || 'Unknown',
      `₹ ${purchase.grandTotal || '0.00'}`,
        `₹ ${purchase.totalTax || '0.00'}`,
 `₹ ${purchase.cgst?.toFixed(2) || '0.00'}`,
    `₹ ${purchase.sgst?.toFixed(2) || '0.00'}`,
    `₹ ${purchase.igst?.toFixed(2) || '0.00'}`,
      `₹ ${purchase.paymentDue || '0.00'}`,
      this.getAddedByName(purchase.addedBy),
      `₹ ${purchase.shippingCharges || '0.00'}`,
      purchase.payTerm || 'N/A',
      purchase.paymentMethod || 'N/A',
      `₹ ${purchase.totalTax || '0.00'}`,
      `₹ ${purchase.balance || '0.00'}`,
         `₹ ${purchase.totalTax || '0.00'}`,
    `₹ ${purchase.cgst?.toFixed(2) || '0.00'}`,
    `₹ ${purchase.sgst?.toFixed(2) || '0.00'}`,
    `₹ ${purchase.igst?.toFixed(2) || '0.00'}`,
    `${purchase.taxRate || '0'}%`,
    ]);

    let csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(',') + '\n'
      + data.map(row => row.join(',')).join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `purchases_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  exportToExcel(): void {
    const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(this.filteredPurchases.map(purchase => ({
      'Date': purchase.purchaseDate || 'N/A',
      'Reference No': purchase.referenceNo || 'N/A',
      'Invoice No': purchase.invoiceNo || 'N/A',
      'Products': purchase.products && purchase.products.length > 0 ? 
        purchase.products.map(p => p.name || p.productName || 'Unnamed').join(', ') : 'N/A',
      'Location': purchase.businessLocation || 'N/A',
      'Supplier': purchase.supplier || 'N/A', 
          'Received Date': purchase.receivedDate || 'N/A', 

      'Purchase Status': purchase.purchaseStatus || 'Unknown',
      'Payment Status': purchase.paymentStatus || 'Unknown',
      'Grand Total': `₹ ${purchase.grandTotal || '0.00'}`,
      'Payment Due': `₹ ${purchase.paymentDue || '0.00'}`,
      'Added By': this.getAddedByName(purchase.addedBy),
      'Shipping Charges': `₹ ${purchase.shippingCharges || '0.00'}`,
      'Pay Term': purchase.payTerm || 'N/A',
      'Payment Method': purchase.paymentMethod || 'N/A',
      'Total Tax': `₹ ${purchase.totalTax || '0.00'}`,
       'CGST': `₹ ${purchase.cgst?.toFixed(2) || '0.00'}`,
    'SGST': `₹ ${purchase.sgst?.toFixed(2) || '0.00'}`,
    'IGST': `₹ ${purchase.igst?.toFixed(2) || '0.00'}`,
      'Balance': `₹ ${purchase.balance || '0.00'}`
    })));

    const workbook: XLSX.WorkBook = { Sheets: { 'Purchases': worksheet }, SheetNames: ['Purchases'] };
    const excelBuffer: any = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    this.saveAsExcelFile(excelBuffer, `purchases_${new Date().toISOString().slice(0,10)}`);
  }

  private saveAsExcelFile(buffer: any, fileName: string): void {
    const data: Blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(data);
    link.download = `${fileName}.xlsx`;
    link.click();
  }

  exportToPDF(): void {
    const doc = new jsPDF();
    const title = 'Purchases Report';
    const currentDate = new Date().toLocaleDateString();
    
    doc.setFontSize(18);
    doc.text(title, 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${currentDate}`, 14, 22);
    
    const headers = [
      ['Date', 'Ref No', 'Invoice No', 'Products', 'Location', 'Supplier', 'Status', 'Payment', 'Total', 'Due', 'Added By']
    ];
    
    const data = this.filteredPurchases.map(purchase => [
      purchase.purchaseDate || 'N/A',
      purchase.referenceNo || 'N/A',
          purchase.receivedDate || 'N/A', 

      purchase.invoiceNo || 'N/A',
      purchase.products && purchase.products.length > 0 ? 
        purchase.products.map(p => p.name || p.productName || 'Unnamed').join(', ') : 'N/A',
      purchase.businessLocation || 'N/A',
      purchase.supplier || 'N/A',
      purchase.purchaseStatus || 'Unknown',
      purchase.paymentStatus || 'Unknown',
      `₹ ${purchase.grandTotal || '0.00'}`,
      `₹ ${purchase.paymentDue || '0.00'}`,
      this.getAddedByName(purchase.addedBy)
    ]);
    
    (doc as any).autoTable({
      head: headers,
      body: data,
      startY: 30,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255 }
    });
    
    doc.save(`purchases_${new Date().toISOString().slice(0,10)}.pdf`);
  }

printPurchase(purchase: Purchase): void {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      this.showSnackbar('Please allow pop-ups to print', 'error');
      return;
    }

    const totalTax = purchase.totalTax || (purchase.products?.reduce((sum: number, product: any) => {
      return sum + (product.taxAmount || 0);
    }, 0) || 0);

    const taxRate = purchase.taxRate || (purchase.products?.[0]?.taxRate || 0);

    let productsHTML = '';
    if (purchase.products && purchase.products.length > 0) {
      productsHTML = purchase.products.map(product => 
        `<tr>
          <td>${product.name || product.productName || 'Unnamed'}</td>
          <td>${product.quantity || 0}</td>
          <td>₹ ${product.price?.toFixed(2) || '0.00'}</td>
          <td>₹ ${((product.quantity || 0) * (product.price || 0)).toFixed(2)}</td>
          <td>${product.taxRate || 0}%</td>
          <td>₹ ${product.taxAmount?.toFixed(2) || '0.00'}</td>
        </tr>`
      ).join('');
    } else {
      productsHTML = '<tr><td colspan="6" class="text-center">No products available</td></tr>';
    }

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Purchase Details - ${purchase.referenceNo || ''}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 20px;
          }
          .header {
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 20px;
          }
          .logo {
            width: 60px; 
            height: auto;
            margin-right: 20px;
          }
          .company-details {
             text-align: left;
          }
          .company-name {
            font-size: 22px;
            font-weight: bold;
          }
          h1 {
            font-size: 18px;
            text-align: center;
            margin-bottom: 15px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          table.info-table td {
            padding: 5px;
          }
          table.products-table {
            margin-top: 20px;
          }
          table.products-table th, 
          table.products-table td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
          }
          table.products-table th {
            background-color: #f2f2f2;
          }
          .divider {
            border-top: 1px solid #ddd;
            margin: 20px 0;
          }
          .label {
            font-weight: bold;
            width: 150px;
          }
          .footer {
            margin-top: 30px;
            text-align: center;
            font-size: 12px;
            color: #777;
          }
          .table-section {
            margin-bottom: 20px;
          }
          .summary-table {
            width: 50%;
            margin-left: auto;
            border-collapse: collapse;
          }
          .summary-table td {
            padding: 5px;
          }
          .summary-table td:first-child {
            font-weight: bold;
            text-align: right;
          }
          .location-info {
            margin: 15px 0;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
          }
          .location-title {
            font-weight: bold;
            margin-bottom: 5px;
          }
          @media print {
            body {
              padding: 0;
              margin: 15px;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="assets/logo2.png" alt="Logo" class="logo">
          <div class="company-details">
            <div class="company-name">Herbally Touch Ayurveda Products Private Limited</div>
            <div>Purchase Details</div>
          </div>
        </div>
        
        <div class="table-section">
          <table class="info-table">
            <tr>
              <td class="label">Date:</td>
              <td>${purchase.purchaseDate || 'N/A'}</td>
              <td class="label">Supplier:</td>
              <td>${purchase.supplier || 'N/A'}</td>
            </tr>
            <tr>
              <td class="label">Reference No:</td>
              <td>${purchase.referenceNo || 'N/A'}</td>
              <td class="label">Purchase Status:</td>
              <td>${purchase.purchaseStatus || 'N/A'}</td>
            </tr>
            <tr>
              <td class="label">Invoice No:</td>
              <td>${purchase.invoiceNo || 'N/A'}</td>
              <td class="label">Payment Method:</td>
              <td>${purchase.paymentMethod || 'N/A'}</td>
                          <td>${purchase.receivedDate || 'N/A'}</td>

            </tr>
          </table>
        </div>
        
        <div class="location-info">
          <div class="location-title">From Location (Supplier Address):</div>
          <div>${purchase.supplierAddress || 'N/A'}</div>
        </div>
        
        <div class="location-info">
          <div class="location-title">To Location (Business Location):</div>
          <div>${purchase.businessLocation || 'N/A'}</div>
        </div>
        
        <div class="divider"></div>
        
        <div class="table-section">
          <h3>Products</h3>
          <table class="products-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Subtotal</th>
                <th>Tax Rate</th>
                <th>Tax Amount</th>
              </tr>
            </thead>
            <tbody>
              ${productsHTML}
            </tbody>
          </table>
        </div>
        
        <div class="table-section">
          <table class="summary-table">
            <tr>
              <td>Subtotal:</td>
              <td>₹ ${purchase.products?.reduce((sum, p) => sum + ((p.quantity || 0) * (p.price || 0)), 0)?.toFixed(2) || '0.00'}</td>
            </tr>
            <tr>
              <td>Total Tax:</td>
              <td>₹ ${totalTax.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Tax Rate:</td>
              <td>${taxRate}%</td>
            </tr>
            <tr>
              <td>Shipping Charges:</td>
              <td>₹ ${purchase.shippingCharges?.toFixed(2) || '0.00'}</td>
            </tr>
            <tr>
              <td><strong>Grand Total:</strong></td>
              <td><strong>₹ ${purchase.grandTotal?.toFixed(2) || '0.00'}</strong></td>
            </tr>
            <tr>
              <td>Payment Due:</td>
              <td>₹ ${purchase.paymentDue?.toFixed(2) || '0.00'}</td>
            </tr>
          </table>
        </div>
        
        <div class="divider"></div>
        
        <div class="table-section">
          <table class="info-table">
            <tr>
              <td class="label">Added By:</td>
              <td>${this.getAddedByName(purchase.addedBy)}</td>
            </tr>
            <tr>
              <td class="label">Additional Notes:</td>
              <td>${purchase.additionalNotes || 'N/A'}</td>
            </tr>
            <tr>
              <td class="label">Purchase Order:</td>
              <td>${purchase.purchaseOrder || 'N/A'}</td>
            </tr>
          </table>
        </div>
        
        <div class="footer">
          <p>This is a computer generated document. No signature required.</p>
          <p>Printed on: ${new Date().toLocaleString()}</p>
        </div>
      </body>
      </html>
    `;
    
    printWindow.document.open();
    printWindow.document.write(printContent);
    printWindow.document.close();
    
    printWindow.onload = function() {
      printWindow.focus();
      printWindow.print();
    };
  }

  print(): void {
    window.print();
  }

  deletePurchase(id: string): void {
    if (confirm('Are you sure you want to delete this purchase? This action cannot be undone.')) {
      this.isLoading = true;
      this.purchaseService.deletePurchase(id)
        .then(() => {
          this.showSnackbar('Purchase deleted successfully', 'success');
          this.loadPurchases();
        })
        .catch(err => {
          console.error('Error deleting purchase:', err);
          this.showSnackbar('Failed to delete purchase', 'error');
          this.isLoading = false;
        });
    }
  }


  private showSnackbar(message: string, type: 'success' | 'error' | 'info'): void {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      panelClass: type === 'success' ? ['snackbar-success'] : 
                 type === 'error' ? ['snackbar-error'] : 
                 ['snackbar-info']
    });
  }
  
  getStatusClass(status: string | undefined): string {
    if (!status) return 'status-unknown';
    
    status = status.toLowerCase();
    if (status === 'received' || status === 'paid') {
      return 'status-active';
    } else if (status === 'pending' || status === 'due') {
      return 'status-inactive';
    } else if (status === 'partial') {
      return 'status-partial';
    }
    return 'status-unknown';
  }


  applyFilters() {
}
  

isFullReturn(): boolean {
  if (!this.returnData.products || this.returnData.products.length === 0) {
    return false;
  }
  return this.returnData.products.every(p => p.returnQuantity === p.quantity);
}




recalculateAllTotals(): void {
  this.returnData.products.forEach((product, index) => {
    this.calculateReturnSubtotal(index);
  });
}

onReturnQuantityChange(index: number): void {
  const product = this.returnData.products[index];
  
  if (!product) return;
  
  const availableQuantity = product.quantity || 0;
  let returnQuantity = product.returnQuantity || 0;
  
  if (returnQuantity < 0) {
    returnQuantity = 0;
    product.returnQuantity = 0;
    this.showSnackbar(`Return quantity cannot be negative`, 'error');
  }
  
  if (returnQuantity > availableQuantity) {
    returnQuantity = availableQuantity;
    product.returnQuantity = availableQuantity;
    this.showSnackbar(`Cannot return more than ${availableQuantity} items of "${product.name || product.productName}".`, 'error');
  }
  
  product.returnQuantity = returnQuantity;
  
  this.calculateReturnSubtotal(index);
}

validateReturnQuantities(): boolean {
  let isValid = true;
  const errors: string[] = [];
  
  this.returnData.products.forEach((product, index) => {
    const returnQty = product.returnQuantity || 0;
    const availableQty = product.quantity || 0;
    
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



onReturnQuantityBlur(index: number): void {
  const product = this.returnData.products[index];
  if (!product) return;
  
  const availableQty = product.quantity || 0;
  const returnQty = product.returnQuantity || 0;
  
  if (returnQty > availableQty) {
    product.returnQuantity = availableQty;
    this.calculateReturnSubtotal(index);
    this.showSnackbar(`Quantity adjusted to maximum available: ${availableQty}`, 'info');
  }
}
}