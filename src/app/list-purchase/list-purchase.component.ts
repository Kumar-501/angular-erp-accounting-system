import { Component, OnInit, AfterViewInit } from '@angular/core';
import { PurchaseService } from '../services/purchase.service';
import { PurchaseReturnService } from '../services/purchase-return.service';
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
  returnQuantity: number;
  subtotal: number;
  productId?: string;
  productName?: string;
  sku?: string;
  unitCost?: number;
  totalCost?: number;
  batchNumber?: string;
  expiryDate?: Date;
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
  isLoading = true;
  paymentAccounts: any[] = [];
    goodsReceivedNotes: any[] = [];

  paymentAccountsLoading = false;
  errorMessage = '';
  showFilterSidebar = false;
  statusFilter = '';
  selectedDateRange: string = '';
isDisabled: boolean = false;
disabledMessage: string = "Processing your request...";
  selectedPurchaseForAction: Purchase | null = null;
  actionModal: Modal | null = null;
  paymentStatusFilter = '';
  supplierFilter = '';
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
  private goodsService: GoodsService,


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
  openModal(modalId: string): void {
    // Close any currently open modal
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
  openActionModal(purchase: Purchase): void {
  this.selectedPurchaseForAction = purchase;
  
  // Initialize modal if not already done
  if (!this.actionModal) {
    const modalElement = document.getElementById('actionModal');
    if (modalElement) {
      this.actionModal = new Modal(modalElement);
    }
  }
  
  // Show the modal
  if (this.actionModal) {
    this.actionModal.show();
  }
}

loadPaymentAccounts(): void {
  this.paymentAccountsLoading = true;
  this.accountService.getAccounts((accounts: any[]) => {
    this.paymentAccounts = accounts; // No filtering applied
    this.paymentAccountsLoading = false;
  });
}

  
  addPayment(purchase: Purchase): void {
  this.currentPaymentPurchase = purchase;
  this.showPaymentForm = true;
  
  // Set form values
  this.paymentForm.patchValue({
    purchaseId: purchase.id,
    referenceNo: purchase.referenceNo || '',
    supplierName: purchase.supplier || '',
    amount: Math.min(purchase.paymentDue || 0, purchase.grandTotal || 0),
    paidDate: new Date().toISOString().slice(0, 16)
  });
  
  // Load payment accounts if not already loaded
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
      // Adjust based on your financial year start (April in this example)
      const financialYearStartMonth = 3; // April (0-based)
      let startYear = today.getFullYear();
      if (today.getMonth() < financialYearStartMonth) {
        startYear--;
      }
      const firstDayFinancialYear = new Date(startYear, financialYearStartMonth, 1);
      this.dateFilter.startDate = this.formatDate(firstDayFinancialYear);
      this.dateFilter.endDate = this.formatDate(today);
      break;
      
    case 'lastFinancialYear':
      const lastFYStartMonth = 3; // April (0-based)
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
      // Reset dates - user will set them manually
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
  
      // Special handling for different column types
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
  
      // Compare values
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
  // Modify the loadPurchases method or create a new method to load suppliers
// Modify your loadSuppliers method to initialize filteredSuppliers
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
// Add this method to filter suppliers based on search text
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
    this.loadPurchases();
    this.loadPurchaseReturns();
    this.loadPaymentAccounts();
    this.loadBusinessLocations();
    this.loadSuppliers();
    this.router.events.subscribe(() => {
      if (this.router.url === '/list-purchase') {
        this.loadPurchases();
        this.loadPurchaseReturns();
          this.loadGoodsReceivedNotes(); // Add this line

      }
    });
  }

 ngAfterViewInit(): void {
  const modalElement = document.getElementById('returnModal');
  if (modalElement && !this.returnModal) {
    this.returnModal = new Modal(modalElement);
    
    // Add event listener to remove backdrop when modal is hidden
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

  async submitPayment(): Promise<void> {
    if (this.paymentForm.invalid || !this.currentPaymentPurchase) {
      this.paymentForm.markAllAsTouched();
      return;
    }

    try {
      const paymentData = {
        purchaseId: this.currentPaymentPurchase.id,
        supplierId: this.currentPaymentPurchase.supplierId || '',
        supplierName: this.currentPaymentPurchase.supplier || '',
        referenceNo: this.currentPaymentPurchase.referenceNo || '',
        paymentDate: new Date(this.paymentForm.value.paidDate),
        amount: this.paymentForm.value.amount,
        paymentMethod: this.paymentForm.value.paymentMethod,
        paymentAccount: this.paymentForm.value.paymentAccount,
        paymentNote: this.paymentForm.value.paymentNote || '',
        createdAt: new Date(),
        type: 'purchase'
      };

      const newPaymentAmount = (this.currentPaymentPurchase.paymentAmount || 0) + paymentData.amount;
      const newPaymentDue = (this.currentPaymentPurchase.grandTotal || 0) - newPaymentAmount;
      
      // Update purchase record
      await this.purchaseService.updatePurchase(this.currentPaymentPurchase.id, {
        paymentAmount: newPaymentAmount,
        paymentDue: newPaymentDue,
        paymentStatus: newPaymentDue <= 0 ? 'Paid' : 'Partial',
        paymentAccount: paymentData.paymentAccount
      });

      // Update supplier's balance
      if (this.currentPaymentPurchase.supplierId) {
        await this.supplierService.updateSupplierBalance(
          this.currentPaymentPurchase.supplierId,
          paymentData.amount,
          true
        );
      }

      // Update account balance
      await this.accountService.updateAccountBalance(
        paymentData.paymentAccount.id,
        -paymentData.amount
      );

      // Record transaction
      await this.accountService.recordTransaction(paymentData.paymentAccount.id, {
        amount: paymentData.amount,
        type: 'expense',
        date: paymentData.paymentDate,
        reference: `PUR-${this.currentPaymentPurchase.referenceNo}`,
        relatedDocId: this.currentPaymentPurchase.id,
        description: `Payment for purchase ${this.currentPaymentPurchase.referenceNo}`,
        paymentMethod: paymentData.paymentMethod
      });

      // Add payment record
      await this.paymentService.addPayment(paymentData);

      this.showSnackbar('Payment added successfully!', 'success');
      this.closePaymentForm(); // Close the form after successful submission
      this.loadPurchases(); // Refresh the list
      
    } catch (error) {
      console.error('Error processing payment:', error);
      this.showSnackbar('Error processing payment', 'error');
    }
  }

closePaymentForm(): void {
  this.showPaymentForm = false;
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
  this.dateFilter = { startDate: '', endDate: '' };
  this.statusFilter = '';
  this.paymentStatusFilter = '';
  this.supplierFilter = '';
  this.locationFilter = '';
  this.applyAdvancedFilters();
}
  

// In list-purchase.component.ts where you navigate to product details:
viewProductDetails(product: any) {
  // Get the original purchases data from the service to ensure we have the raw date objects
  this.purchaseService.getPurchasesByProductId(product.id).then(purchasesData => {
    this.router.navigate(['/product-purchase-details', product.id], {
      state: {
        productData: product,
        purchaseData: purchasesData // Pass the raw purchase data with original date objects
      }
    });
  }).catch(error => {
    console.error('Error fetching purchase data for product:', error);
    // Fallback to filtered purchases if service call fails
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
// Replace your existing updateStatus method with this:
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
    
    // Update the local data
    const purchaseIndex = this.purchases.findIndex(p => p.id === this.selectedPurchaseForStatus?.id);
    if (purchaseIndex !== -1) {
      this.purchases[purchaseIndex].purchaseStatus = this.newPurchaseStatus;
      this.filteredPurchases = [...this.purchases]; // Refresh filtered list
    }

    // Close the modal
    this.closeCurrentModal();
    // OR if you prefer using the specific modal reference:
    // if (this.statusModal) {
    //   this.statusModal.hide();
    // }
  } catch (error) {
    console.error('Error updating purchase status:', error);
    this.showSnackbar('Failed to update purchase status', 'error');
  }
}

loadPurchases(): void {
  this.isLoading = true;
  this.errorMessage = '';
        this.loadGoodsReceivedNotes();

  this.purchaseService.getPurchases().subscribe({
    next: (purchases: any[]) => {
      this.purchases = purchases.map(purchase => {
         let totalTax = 0;
        let cgst = 0;
        let sgst = 0;
        let igst = 0;
        let taxRate = 0;
        let isInterState = purchase.isInterState || false;
        let productsTotal = 0;

        // Calculate taxes and product totals if products exist
       if (purchase.products && purchase.products.length > 0) {
          // Calculate total tax and product values
          const taxCalculations = purchase.products.reduce((acc: any, product: any) => {
            const quantity = product.quantity || 0;
            const price = product.unitCost || product.price || 0;
            const productTotal = quantity * price;
            // Calculate tax amount if not provided
            const productTaxRate = product.taxRate || 0;
            let taxAmount = product.taxAmount || 0;
            
            
            // If tax amount isn't provided but rate is, calculate it
            if (taxAmount === 0 && productTaxRate > 0) {
              taxAmount = productTotal * (productTaxRate / 100);
            }

          
            acc.totalTax += taxAmount;
            acc.productsTotal += productTotal;
            
            // Track tax rates (use the first non-zero rate if multiple exist)
            if (productTaxRate > 0 && acc.taxRate === 0) {
              acc.taxRate = productTaxRate;
            }
            
            return acc;
          }, { totalTax: 0, productsTotal: 0, taxRate: 0 });

          totalTax = taxCalculations.totalTax;
          productsTotal = taxCalculations.productsTotal;
         taxRate = taxCalculations.taxRate;
         

          // Split tax for CGST/SGST or IGST based on interstate status
          if (isInterState) {
            igst = totalTax;
          } else {
            cgst = totalTax / 2;
            sgst = totalTax / 2;
          }
        }

   const shippingCharges = purchase.shippingCharges || 0;
        const grandTotal = productsTotal + totalTax + shippingCharges;
        const paymentAmount = Number(purchase.paymentAmount) || 0;
        const paymentDue = Math.max(0, grandTotal - paymentAmount);


              const productsWithNames = Array.isArray(purchase.products)
          ? purchase.products.map((product: any) => {
              const quantity = product.quantity || 0;
              const price = product.unitCost || product.price || 0;
              const productTotal = quantity * price;
              const productTaxRate = product.taxRate || 0;
              let taxAmount = productTotal * (productTaxRate / 100);

              
              // Calculate tax if not provided but rate is available
              if (taxAmount === 0 && productTaxRate > 0) {
                taxAmount = productTotal * (productTaxRate / 100);
              }

              return {
                id: product.id || product.productId || '',
                name: product.productName || product.name || 'Unnamed',
                productName: product.productName || product.name || 'Unnamed',
                quantity: quantity,
                price: price,
                code: product.productCode || product.code || '',
                batchNumber: product.batchNumber || '',
                expiryDate: product.expiryDate || '',
                taxAmount: taxAmount,
                taxRate: productTaxRate,
                lineTotal: productTotal + taxAmount,
                subtotal: productTotal
              };
            })
          : [];


        // Format addedBy information
        let addedByValue = 'System';
        if (purchase.addedBy) {
          if (typeof purchase.addedBy === 'string') {
            addedByValue = purchase.addedBy;
          } else if (typeof purchase.addedBy === 'object') {
            const addedByObj = purchase.addedBy as any;
            addedByValue =
              addedByObj.name ||
              addedByObj.email ||
              addedByObj.id ||
              'Unknown User';
          }
        }

        // Format payment account information
        let paymentAccount;
        if (purchase.paymentAccount) {
          paymentAccount = {
            id: String(purchase.paymentAccount.id || ''),
            name: String(purchase.paymentAccount.name || 'Unknown Account'),
            accountNumber: String(purchase.paymentAccount.accountNumber || ''),
            accountType: String(purchase.paymentAccount.accountType || '')
          };
        } else if (purchase.paymentMethod) {
          paymentAccount = {
            id: '',
            name: String(purchase.paymentMethod),
            accountNumber: '',
            accountType: ''
          };
        }

        // Format supplier information
        const supplierName = purchase.supplierName ||
          (purchase.supplier?.businessName ||
          `${purchase.supplier?.firstName || ''} ${purchase.supplier?.lastName || ''}`.trim() ||
          'Unknown Supplier');

        // Return the complete purchase object
        return {
                id: purchase.id || '',
          purchaseDate: this.getFormattedDate(purchase.purchaseDate),
          referenceNo: purchase.referenceNo,
          businessLocation: purchase.businessLocation,
          supplier: supplierName,
          supplierName: supplierName,
          supplierId: purchase.supplierId,
          
                    receivedDate: this.getFormattedDate(purchase.receivedDate),

          supplierAddress: purchase.supplier?.addressLine1 ||
            purchase.address ||
            purchase.supplierAddress ||
            'N/A',
          totalTax,
          taxRate,
          cgst,
          sgst,
          igst,
          isInterState,
          purchaseStatus: purchase.purchaseStatus,
          paymentStatus: purchase.paymentStatus || purchase.paymentMethod,
          grandTotal,
          paymentDue,
          paymentAmount,
          addedBy: addedByValue,
          products: productsWithNames,

          invoiceNo: purchase.invoiceNo,
          invoicedDate: purchase.invoicedDate,
          shippingCharges,
          payTerm: purchase.payTerm,
          paymentMethod: purchase.paymentMethod,
          paymentNote: purchase.paymentNote,
          additionalNotes: purchase.additionalNotes,
          document: purchase.document,
          balance: purchase.balance || paymentDue,
          totalPayable: purchase.totalPayable || grandTotal,
          purchaseOrder: purchase.purchaseOrder,
          linkedPurchaseOrderId: purchase.linkedPurchaseOrderId,
          paymentAccount,
          productsTotal
        };
      });

       this.filteredPurchases = [...this.purchases];
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

  loadPurchaseReturns(): void {
    this.purchaseReturnService.getPurchaseReturns().subscribe({
      next: (returns: any[]) => {
        this.totalReturnsAmount = returns.reduce((sum, returnItem) => sum + (returnItem.grandTotal || 0), 0);
      },
      error: (error) => {
        console.error('Error loading purchase returns:', error);
      }
    });
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
    // Handle Firestore Timestamp
    if (typeof date === 'object' && 'toDate' in date) {
      return this.datePipe.transform(date.toDate(), 'mediumDate') || '';
    } 
    // Handle JavaScript Date
    else if (date instanceof Date) {
      return this.datePipe.transform(date, 'mediumDate') || '';
    } 
    // Handle string date
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
      // Create a map of invoice numbers to received dates
      const invoiceDateMap = new Map<string, Date>();
      
      goodsNotes.forEach(goods => {
        if (goods.invoiceNo && goods.receivedDate) {
          const receivedDate = goods.receivedDate.toDate 
            ? goods.receivedDate.toDate() 
            : new Date(goods.receivedDate);
          invoiceDateMap.set(goods.invoiceNo, receivedDate);
        }
      });

      // Update purchases with received dates
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
    
    // Apply date filter
  if (this.dateFilter.startDate || this.dateFilter.endDate) {
    filtered = filtered.filter(purchase => {
      const purchaseDate = this.getDateValue(purchase.purchaseDate);
      const startDate = this.dateFilter.startDate ? new Date(this.dateFilter.startDate).getTime() : 0;
      const endDate = this.dateFilter.endDate ? new Date(this.dateFilter.endDate).getTime() + 86400000 : Date.now(); // Add 1 day to include end date
      
      return purchaseDate >= startDate && purchaseDate <= endDate;
    });
  }
    // Apply status filter
    if (this.statusFilter) {
      filtered = filtered.filter(purchase => 
        purchase.purchaseStatus?.toLowerCase() === this.statusFilter.toLowerCase()
      );
    }
// Apply supplier filter
if (this.supplierFilter) {
  filtered = filtered.filter(purchase => 
    purchase.supplier === this.supplierFilter
  );
}
    // Apply payment status filter
    if (this.paymentStatusFilter) {
      filtered = filtered.filter(purchase => 
        purchase.paymentStatus?.toLowerCase() === this.paymentStatusFilter.toLowerCase()
      );
    }
    
    // Apply supplier filter
    if (this.supplierFilter) {
      filtered = filtered.filter(purchase => 
        purchase.supplier === this.supplierFilter
      );
    }
    
    // Apply location filter
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
    this.filteredPurchases = this.purchases.filter(purchase => 
      (purchase.referenceNo && purchase.referenceNo.toLowerCase().includes(searchTextLower)) ||
      (purchase.supplier && purchase.supplier.toLowerCase().includes(searchTextLower)) ||
      (purchase.businessLocation && purchase.businessLocation.toLowerCase().includes(searchTextLower)) ||
      (purchase.purchaseStatus && purchase.purchaseStatus.toLowerCase().includes(searchTextLower)) ||
      (purchase.invoiceNo && purchase.invoiceNo.toLowerCase().includes(searchTextLower)) ||
      (purchase.products && purchase.products.some(product => 
        product && (product.name || product.productName) && 
        (product.name?.toLowerCase().includes(searchTextLower) || 
         product.productName?.toLowerCase().includes(searchTextLower))
        ))
      );
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
      'Shipping Charges', 'Pay Term', 'Payment Method', 'Total Tax', 'Balance', 'Tax',    'Date', 'Received Date', 'Reference No', // Add 'Received Date'

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
          'Received Date': purchase.receivedDate || 'N/A', // Add this line

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
          purchase.receivedDate || 'N/A', // Add this line

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

  // Print individual purchase details
printPurchase(purchase: Purchase): void {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      this.showSnackbar('Please allow pop-ups to print', 'error');
      return;
    }
    
    // Calculate totals from products if needed
    const totalTax = purchase.totalTax || (purchase.products?.reduce((sum: number, product: any) => {
      return sum + (product.taxAmount || 0);
    }, 0) || 0);

    const taxRate = purchase.taxRate || (purchase.products?.[0]?.taxRate || 0);

    // Format products for print
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
            text-align: center;
            margin-bottom: 20px;
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
          <div class="company-name">Herbally Touch</div>
          <div>Purchase Details</div>
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
        
        <!-- Add location information section -->
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
    
    // Wait for content to load then print
    printWindow.onload = function() {
      printWindow.focus();
      printWindow.print();
    };
  }

  // General print method for the entire table
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
openReturnModal(purchase: Purchase): void {
  this.selectedPurchase = purchase;
  this.returnData = this.initReturnData();
  this.returnData.returnDate = new Date().toISOString().split('T')[0];
    if (purchase.products && purchase.products.length) {
    this.returnData.products = purchase.products.map(product => ({
      ...product,
      returnQuantity: 0,
      subtotal: 0,
      expiryDate: product.expiryDate ? 
        (typeof product.expiryDate === 'string' ? new Date(product.expiryDate) : product.expiryDate) 
        : undefined
    }));
  }
  
  // Close any existing modal first
  if (this.currentOpenModal) {
    this.currentOpenModal.hide();
  }
  
  const modalElement = document.getElementById('returnModal');
  if (modalElement) {
    // Remove any existing backdrop
    const existingBackdrops = document.getElementsByClassName('modal-backdrop');
    while (existingBackdrops.length > 0) {
      existingBackdrops[0].parentNode?.removeChild(existingBackdrops[0]);
    }
    
    this.currentOpenModal = new Modal(modalElement);
    this.currentOpenModal.show();
  }
}
  applyFilters() {
  // Your filter logic here
  // This should match what you previously had in applyAdvancedFilters or applyFilter
}
  calculateReturnSubtotal(index: number): void {
    if (!this.returnData.products[index]) return;
    const product = this.returnData.products[index];
    product.subtotal = (product.returnQuantity || 0) * (product.price || 0);
  }
  
  calculateTotalReturnAmount(): number {
    return this.returnData.products.reduce((total, product) => total + (product.subtotal || 0), 0);
  }
  
  submitReturn(): void {
    if (!this.selectedPurchase) {
      this.showSnackbar('No purchase selected for return', 'error');
      return;
    }
    
    const hasReturns = this.returnData.products.some(product => product.returnQuantity > 0);
    if (!hasReturns) {
      this.showSnackbar('Please specify at least one product to return', 'error');
      return;
    }
    
    if (!this.returnData.reason.trim()) {
      this.showSnackbar('Please provide a reason for the return', 'error');
      return;
    }
    
    const returnRef = `PRN-${Date.now()}`;  // Fixed: Added backticks for template literal
    
    const purchaseReturn: PurchaseReturn = {
      returnDate: this.returnData.returnDate,
      referenceNo: returnRef,
      parentPurchaseId: this.selectedPurchase.id,
      parentPurchaseRef: this.selectedPurchase.referenceNo || '',
      businessLocation: this.selectedPurchase.businessLocation || '',
      supplier: this.selectedPurchase.supplier || '',
      returnStatus: this.returnData.returnStatus,
      paymentStatus: this.returnData.paymentStatus,
      products: this.returnData.products.filter(p => p.returnQuantity > 0),
      reason: this.returnData.reason,
      grandTotal: this.calculateTotalReturnAmount(),
      createdAt: new Date(),
      createdBy: 'System'
    };
    
    this.purchaseReturnService.addPurchaseReturn(purchaseReturn)
      .then(() => {
        this.showSnackbar('Purchase return submitted successfully', 'success');
        if (this.returnModal) {
          this.returnModal.hide();
        }
        this.loadPurchases();
        this.loadPurchaseReturns();
      })
      .catch(error => {
        console.error('Error submitting purchase return:', error);
        this.showSnackbar('Failed to submit purchase return', 'error');
      });
  }
}