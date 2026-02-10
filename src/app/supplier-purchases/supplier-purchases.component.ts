import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { increment } from '@angular/fire/firestore'; // Make sure to import increment

import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { forkJoin, Observable } from 'rxjs';

import { 
  Firestore, collection, onSnapshot, Unsubscribe, query, 
  where, getDocs, addDoc, Timestamp, doc, updateDoc, 
  writeBatch, getDoc  
} from '@angular/fire/firestore';

// Services
import { SupplierDocument, SupplierNote, SupplierService } from '../services/supplier.service';
import { PaymentService } from '../services/payment.service';
import { PurchaseService } from '../services/purchase.service';
import { AuthService } from '../auth.service';
import { LocationService } from '../services/location.service';
import { AccountService } from '../services/account.service';

// Models & Libraries
import { Purchase } from '../models/purchase.model';
import { AccountSummaryData } from '../account-summary/account-summary.component';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface LedgerEntry {
  date: Date;
  referenceNo: string;
  supplier: string;
  description: string;
  type: 'debit' | 'credit';
  amount: number;
  balance: number;
  status: string;
  purchase?: any;
  payment?: any;
}

interface Payment {
  id?: string;
  amount: number;
  date: Date | string | any;
  paymentDate?: Date | string | any;
  referenceNo?: string;
  reference?: string;
  status?: string;
  supplier?: string;
  paymentMethod?: string;
  notes?: string;
}

@Component({
  selector: 'app-supplier-purchases',
  templateUrl: './supplier-purchases.component.html',
  styleUrls: ['./supplier-purchases.component.scss']
})
export class SupplierPurchasesComponent implements OnInit, OnDestroy {
  selectedFiles: File[] = [];
  isUploading: boolean = false;
  showReceiptModal: boolean = false;
  selectedPayment: any = null;

  uploadProgress: number | null = null;
  private paymentsUnsubscribe: Unsubscribe | null = null;
  private purchasesUnsubscribe: Unsubscribe | null = null;
  private ledgerUnsubscribe: Unsubscribe | null = null;

  viewMode: 'purchases' | 'ledger' | 'payments' | 'documents' = 'purchases';
  ledgerEntries: LedgerEntry[] = [];
  
  // Account Summary Data
  accountSummaryData: AccountSummaryData = {
    openingBalance: 0,
    totalPurchase: 0,
    totalExpense: 0,
    totalPaid: 0,
    advanceBalance: 0,
    balanceDue: 0,
    dateRange: {
      from: '',
      to: ''
    },
    supplierDetails: {},
    companyDetails: {
      name: 'HERBALY TOUCH AYURVEDA HOSPITAL PRIVATE LIMITED',
      address: 'Your Company Address, City, State, Country - ZIP'
    }
  };

  invoiceNo?: string;
  selectedQuickFilter: string = '';
  showCustomDateRange: boolean = false;
  financialYearStartMonth: number = 4; 
  purchaseDate: Date | string | any; 
  payments: any[] = [];
  dateRangeOption: string = 'all';
  paymentLoading = false;
  supplierId: string = '';
  supplierName: string = '';
  supplierDetails: any = {};
  locations: any[] = [];
  filteredPurchases: Purchase[] = [];
  purchases: Purchase[] = [];
  filteredLedgerEntries: LedgerEntry[] = [];
  customFromDate: string = '';
  customToDate: string = '';
  public supplierDisplayName: string = '';
  searchTerm: string = '';
  currentPage: number = 1;
  subtotal?: number;
  totalTax?: number;
  shippingCharges?: number; 
  isLoadingPurchases = true;
  itemsPerPage: number = 10;
  totalPages: number = 1;
  dateFilterOptions = [
    { label: 'Today', value: 'today' },
    { label: 'Yesterday', value: 'yesterday' },
    { label: 'This Week', value: 'thisWeek' },
    { label: 'This Month', value: 'thisMonth' },
    { label: 'This Financial Year', value: 'thisFinancialYear' },
    { label: 'Previous Year', value: 'previousYear' },
    { label: 'Custom Date Range', value: 'custom' }
  ];
  selectedDateFilter: string = 'thisMonth';
  selectedLocation: string = 'all';
  isLoading = true;
  activeTab: string = 'purchases';
  documents: SupplierDocument[] = [];
  notes: SupplierNote[] = [];
  newNote: SupplierNote = {
    title: '',
    content: '',
    createdAt: new Date(),
    createdBy: '', 
    isPrivate: false
  };
  currentUserId: string = '';
  currentUserName: string = '';
  transactions: any[] = [];
  filteredTransactions: any[] = [];
  ledgerLoading = true;
  fromDate: string = '';
  toDate: string = '';
  accountSummary = {
    openingBalance: 0,
    totalPurchase: 0,
    totalPaid: 0,
    balanceDue: 0
  };
  currentBalance = 0;
  stockReport: any[] = [];
  filteredStockReport: any[] = [];
  stockReportLoading = true;
  stockReportFromDate: string = '';
  stockReportToDate: string = '';
  selectedStockLocation: string = 'all';
  stockLocations: string[] = [];
  purchase: Purchase | undefined;

  // NEW PROPERTIES FOR PAY CASH MODAL
  showPaymentModal: boolean = false;
  paymentForm: FormGroup;
  paymentAccounts: any[] = [];
  isSavingPayment: boolean = false;
  currentPaymentPurchase: Purchase | null = null;

  constructor(
    private route: ActivatedRoute,
    private purchaseService: PurchaseService,
    private supplierService: SupplierService,
    private paymentService: PaymentService,
    private authService: AuthService,
    private firestore: Firestore,
    private locationService: LocationService,
    private router: Router,
    private fb: FormBuilder,
    private accountService: AccountService
  ) { 
    // INITIALIZE PAYMENT FORM
    this.paymentForm = this.fb.group({
      amount: [0, [Validators.required, Validators.min(0.01)]],
      paymentDate: [new Date().toISOString().split('T')[0], Validators.required],
      paymentMethod: ['Cash', Validators.required],
      paymentAccountId: [null, Validators.required],
      referenceNo: [''],
      notes: ['']
    });
  }

  ngOnInit(): void {
    this.supplierId = this.route.snapshot.params['id'];
    this.currentUserId = this.authService.getCurrentUserId();
    this.supplierName = this.route.snapshot.params['name'];

    this.currentUserName = this.authService.getCurrentUserName();
    this.newNote.createdBy = this.currentUserName || this.currentUserId;
  
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    this.fromDate = this.formatDate(thirtyDaysAgo);
    this.toDate = this.formatDate(today);
    this.stockReportFromDate = this.fromDate;
    this.stockReportToDate = this.toDate;

    // Initialize account summary date range
    this.updateAccountSummaryDateRange();

    this.loadSupplierDetails();
    this.loadPurchases();
    this.loadLedgerData();
    this.loadPurchaseOrderStockData();
    this.loadDocumentsAndNotes();
    this.loadStockReport();
    this.loadLocations();
    this.setupRealtimeListeners();
    this.initializeSupplierForAddPurchase();
  }

  // =========================================================================
  // CORE UTILITY: Safe Date Converter
  // =========================================================================
  private getSafeDate(val: any): Date {
    if (!val) return new Date();
    
    // 1. Is it already a Date object?
    if (val instanceof Date) return val;

    // 2. Is it a Firestore Timestamp object (with toDate)?
    if (typeof val.toDate === 'function') {
      return val.toDate();
    }

    // 3. Is it a raw Firestore object (seconds/nanoseconds)?
    if (val && typeof val.seconds === 'number') {
      return new Date(val.seconds * 1000);
    }

    // 4. Is it a string?
    if (typeof val === 'string') {
      return new Date(val);
    }

    // 5. Is it a number (ms)?
    if (typeof val === 'number') {
      return new Date(val);
    }

    return new Date();
  }

  // =========================================================================
  // PAY CASH FUNCTIONALITY
  // =========================================================================

  openPaymentModal(): void {
    this.showPaymentModal = true;
    document.body.classList.add('modal-open');
    
    // Reset form
    this.paymentForm.reset({
      amount: 0,
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: 'Cash',
      paymentAccountId: null,
      referenceNo: '',
      notes: ''
    });

    // Load Accounts
    this.accountService.getPaymentAccounts().subscribe(accounts => {
      this.paymentAccounts = accounts;
    });
  }

  closePaymentModal(): void {
    this.showPaymentModal = false;
    this.isSavingPayment = false;
    document.body.classList.remove('modal-open');
  }
// ... existing imports

  // =========================================================================
  // LEDGER LOGIC
  // =========================================================================

// =========================================================================
// FIX: Updated submitPayment - Ensure payment date reflects in Account Book
// =========================================================================


// =========================================================================
// FIX 1: Update loadPayments to exclude advance adjustments
// =========================================================================
loadPayments(): void {
  this.paymentLoading = true;
  this.paymentService.getSupplierPayments(this.supplierId).subscribe({
    next: (payments: any[]) => {
      // ✅ FILTER OUT advance adjustments - they should only show in Ledger View
      const actualPayments = payments.filter(payment => 
        payment.paymentMethod !== 'Advance Adjustment' && 
        payment.type !== 'advance_adjustment'
      );
      this.processPaymentData(actualPayments);
    },
    error: (error) => {
      console.error('Error loading payments:', error);
      setTimeout(() => { if (this.paymentLoading) this.paymentLoading = false; }, 2000);
    }
  });
}
// =========================================================================
// distributeAndUpdatePayment - Handles payment distribution to purchases
// =========================================================================
private async distributeAndUpdatePayment(paymentAmount: number, paymentId: string): Promise<void> {
  try {
    // Get all purchases for this supplier
    const purchasesQuery = query(
      collection(this.firestore, 'purchases'),
      where('supplierId', '==', this.supplierId)
    );
    
    const purchasesSnapshot = await getDocs(purchasesQuery);
    
    // Collect unpaid/partially paid purchases
    const unpaidPurchases: Array<{
      id: string;
      grandTotal: number;
      paymentAmount: number;
      remainingDue: number;
    }> = [];

    purchasesSnapshot.docs.forEach(purchaseDoc => {
      const purchaseData = purchaseDoc.data();
      
      // Calculate grand total
      const grandTotal = Number(purchaseData['roundedTotal']) || 
                        Number(purchaseData['grandTotal']) || 
                        Number(purchaseData['purchaseTotal']) || 0;
      
      // Get existing paid amount (trust the database value)
      const existingPaidAmount = Number(purchaseData['paymentAmount']) || 0;
      
      // Calculate remaining due
      const remainingDue = grandTotal - existingPaidAmount;
      
      // Only include if there's money left to pay (with tolerance for floating point)
      if (remainingDue > 0.50) { 
        unpaidPurchases.push({
          id: purchaseDoc.id,
          grandTotal: grandTotal,
          paymentAmount: existingPaidAmount,
          remainingDue: remainingDue
        });
      }
    });

    // Sort by oldest first (FIFO - First In First Out)
    unpaidPurchases.sort((a, b) => a.id.localeCompare(b.id));

    // Distribute payment across purchases
    let remainingPayment = paymentAmount;
    const paymentDistribution: Array<{ purchaseId: string; amount: number }> = [];

    for (const purchase of unpaidPurchases) {
      if (remainingPayment <= 0) break;
      
      // Pay up to what is due, or what we have left
      const amountToApply = Math.min(remainingPayment, purchase.remainingDue);
      
      // Round to 2 decimals to avoid floating point errors
      const roundedAmountToApply = Math.round(amountToApply * 100) / 100;

      if (roundedAmountToApply > 0) {
        paymentDistribution.push({
          purchaseId: purchase.id,
          amount: roundedAmountToApply
        });
        
        remainingPayment -= roundedAmountToApply;
      }
    }

    // Update the payment document with distribution info
    const paymentRef = doc(this.firestore, 'payments', paymentId);
    await updateDoc(paymentRef, {
      distribution: paymentDistribution,
      fullyDistributed: remainingPayment <= 0.01 // True if we used all the money
    });

    // Update each affected purchase document
    const updatePromises = paymentDistribution.map(async (distItem) => {
      const purchase = unpaidPurchases.find(p => p.id === distItem.purchaseId);
      if (purchase) {
        const purchaseRef = doc(this.firestore, 'purchases', purchase.id);
        
        // Calculate new totals
        const newTotalPaid = purchase.paymentAmount + distItem.amount;
        const newPaymentDue = Math.max(0, purchase.grandTotal - newTotalPaid);
        
        // Determine payment status
        const paymentStatus = newPaymentDue <= 1.0 ? 'Paid' : 'Partial';

        // Update Firestore
        await updateDoc(purchaseRef, {
          paymentAmount: Number(newTotalPaid.toFixed(2)),
          paymentDue: Number(newPaymentDue.toFixed(2)),
          paymentStatus: paymentStatus,
          updatedAt: Timestamp.now()
        });
      }
    });

    await Promise.all(updatePromises);
    
    console.log('✅ Payment distributed successfully:', {
      totalAmount: paymentAmount,
      distributedTo: paymentDistribution.length + ' purchases',
      remainingUnallocated: remainingPayment
    });
    
  } catch (error) {
    console.error('❌ Error distributing payment:', error);
    throw error;
  }
}

// =========================================================================
// FIX 3: Update getTotalPaid to only count actual payments
// =========================================================================
getTotalPaid(): number {
  // Only count actual cash payments, not advance adjustments
  return this.payments
    .filter(payment => 
      payment.paymentMethod !== 'Advance Adjustment' && 
      payment.type !== 'advance_adjustment'
    )
    .reduce((sum, payment) => sum + (payment.amount || 0), 0);
}


// Find the submitPayment() method and replace it with this:

async submitPayment(): Promise<void> {
  // FIX: Removed "!this.currentPaymentPurchase" check so general payments work
  if (this.paymentForm.invalid) {
    this.paymentForm.markAllAsTouched();
    alert('Please fill all required fields correctly.');
    return;
  }

  this.isSavingPayment = true;
  const formVal = this.paymentForm.value;

  try {
    const selectedAccount = this.paymentAccounts.find(acc => acc.id === formVal.paymentAccountId);
    if (!selectedAccount) throw new Error('Selected account not found');

    // Create proper date object
    const selectedDate = new Date(formVal.paymentDate);
    const now = new Date();
    selectedDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
    
    const timestamp = Timestamp.fromDate(selectedDate);
    const paymentAmount = Number(formVal.amount);

    // Prepare payment data
    const paymentData = {
      supplierId: this.supplierId,
      supplier: this.supplierDetails.businessName || this.supplierDetails.firstName || 'Unknown Supplier',
      amount: paymentAmount,
      paymentDate: timestamp,
      date: timestamp, 
      paymentMethod: formVal.paymentMethod,
      accountId: selectedAccount.id,
      accountName: selectedAccount.name,
      referenceNo: formVal.referenceNo || `PAY-${Date.now()}`,
      notes: formVal.notes || '',
      createdAt: Timestamp.now(),
      createdBy: this.currentUserName,
      status: 'Paid',
      type: 'supplier_payment'
    };

    // STEP 1: Add record to 'payments' collection
    const paymentsRef = collection(this.firestore, 'payments');
    const docRef = await addDoc(paymentsRef, paymentData);

    // STEP 2: Add to Account Book (Cash/Bank ledger)
    const accountTransaction = {
      accountId: selectedAccount.id,
      accountName: selectedAccount.name,
      date: selectedDate,
      transactionTime: selectedDate,
      description: `Payment to Supplier: ${paymentData.supplier}`,
      debit: paymentAmount,
      credit: 0,
      reference: paymentData.referenceNo,
      paymentDetails: paymentData.referenceNo,
      relatedDocId: docRef.id,
      source: 'payment',     
      type: 'expense',
      paymentMethod: paymentData.paymentMethod,
      note: formVal.notes || '',
      supplier: paymentData.supplier,
      supplierId: this.supplierId
    };
    
    await this.accountService.addAccountBookTransaction(accountTransaction);

    // STEP 3: Update Supplier Balance
    const supplierRef = doc(this.firestore, 'suppliers', this.supplierId);
    await updateDoc(supplierRef, {
      balance: increment(-paymentAmount),
      updatedAt: Timestamp.now()
    });

    console.log(`✅ Supplier balance reduced by ₹${paymentAmount}`);

    // STEP 4: Distribute payment across unpaid purchases
    await this.distributeAndUpdatePayment(paymentAmount, docRef.id);

    alert('Payment recorded successfully!');
    this.closePaymentModal();

    // STEP 5: Reload all data to reflect changes
    this.loadSupplierDetails(); 
    this.loadPurchases();
    this.loadPayments();
    this.loadLedgerData();

  } catch (error) {
    console.error('❌ Error recording payment:', error);
    alert('Failed to record payment. Please try again.');
  } finally {
    this.isSavingPayment = false;
  }
}
generateLedgerEntries(purchases: any[], payments: any[]): LedgerEntry[] {
  const entries: LedgerEntry[] = [];
  const supplierName = this.getSupplierDisplayName(this.supplierDetails);
  const allTransactions: any[] = [];

  // Add all purchases
  purchases.forEach(purchase => {
    allTransactions.push({
      date: this.getSafeDate(purchase.purchaseDate),
      type: 'purchase',
      data: purchase
    });
  });

  // ✅ Add ALL payments (including advance adjustments) to ledger
  payments.forEach(payment => {
    allTransactions.push({
      date: this.getSafeDate(payment.paymentDate),
      type: 'payment',
      data: payment
    });
  });

  // Sort by date
  allTransactions.sort((a, b) => a.date.getTime() - b.date.getTime());

  let runningBalance = 0;

  allTransactions.forEach(transaction => {
    if (transaction.type === 'purchase') {
      const purchase = transaction.data;
      const amount = this.getSafeGrandTotal(purchase);
      runningBalance += amount;

      entries.push({
        date: transaction.date,
        referenceNo: purchase.referenceNo || `PUR-${purchase.id?.substring(0, 6) || 'XXXX'}`,
        supplier: supplierName,
        description: `Purchase ${purchase.referenceNo || ''}`.trim(),
        type: 'credit',
        amount: amount,
        balance: runningBalance,
        status: this.getStatusText(purchase.purchaseStatus),
        purchase: purchase,
        payment: null
      });

    } else {
      const payment = transaction.data;
      const amount = payment.amount || 0;
      runningBalance -= amount;

      entries.push({
        date: transaction.date,
        referenceNo: payment.referenceNo || `PAY-${payment.id?.substring(0, 6) || 'XXXX'}`,
        supplier: supplierName,
        description: payment.notes || payment.paymentMethod || 'Payment',
        type: 'debit',
        amount: amount,
        balance: runningBalance,
        status: payment.status || 'Paid',
        purchase: null,
        payment: payment
      });
    }
  });

  return entries;
}

// =========================================================================
// FIX 5: Load Ledger with ALL payments (for complete view)
// =========================================================================
private setupRealtimeListeners(): void {
  // Purchases listener
  this.purchasesUnsubscribe = onSnapshot(
    query(collection(this.firestore, 'purchases'), where('supplierId', '==', this.supplierId)),
    (snapshot) => {
      const purchases = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      this.processPurchases(purchases);
    },
    (error) => {
      console.error('Error listening to purchases:', error);
      this.isLoadingPurchases = false;
    }
  );

  // Payments listener - get ALL payments for ledger calculation
  this.paymentsUnsubscribe = onSnapshot(
    query(collection(this.firestore, 'payments'), where('supplierId', '==', this.supplierId)),
    (snapshot) => {
      const allPayments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      
      // For display in Payments tab - filter out adjustments
      const actualPayments = allPayments.filter(payment => 
        payment.paymentMethod !== 'Advance Adjustment' && 
        payment.type !== 'advance_adjustment'
      );
      
      // Process for UI display
      this.processPaymentData(actualPayments);
      
      // Update ledger with ALL payments (including adjustments)
      this.updateLedgerWithAllPayments(allPayments);
    },
    (error) => {
      console.error('Error listening to payments:', error);
      this.paymentLoading = false;
    }
  );
}

// Helper method to update ledger with complete payment history
private updateLedgerWithAllPayments(allPayments: any[]): void {
  const processedPayments = allPayments.map(payment => {
    const rawDate = payment.paymentDate || payment.date || payment.createdAt;
    return {
      ...payment,
      paymentDate: this.getSafeDate(rawDate)
    };
  });
  
  processedPayments.sort((a, b) => b.paymentDate.getTime() - a.paymentDate.getTime());
  
  // Update ledger entries with complete data
  this.ledgerEntries = this.generateLedgerEntries(this.purchases, processedPayments);
  this.filterLedger();
}


  // =========================================================================
  // DATA LOADING & PROCESSING
  // =========================================================================

  loadPurchases(): void {
    this.isLoadingPurchases = true;
    
    this.purchaseService.getPurchasesBySupplier(this.supplierId).subscribe({
      next: (purchases: Purchase[]) => {
        if (purchases.length > 0) {
          this.processPurchases(purchases);
        } else {
          const supplierName = this.getSupplierDisplayName(this.supplierDetails);
          this.purchaseService.getPurchasesBySupplierName(supplierName).subscribe({
            next: (nameMatchedPurchases: Purchase[]) => {
              this.processPurchases(nameMatchedPurchases);
            },
            error: (err: any) => {
              this.handlePurchaseLoadError(err);
            }
          });
        }
      },
      error: (err: any) => {
        this.handlePurchaseLoadError(err);
      }
    });
  }

  private processPurchases(purchases: Purchase[]): void {
    this.purchases = purchases.map(purchase => {
      const standardized = this.standardizePurchase(purchase);
      const paymentAmount = standardized.paymentAmount || 0;
      // Ensure paymentDue matches grandTotal if not paid
      const paymentDue = Math.max(0, standardized.grandTotal - paymentAmount);

      return {
        ...standardized,
        paymentAmount,
        paymentDue,
        paymentStatus: paymentDue <= 0 ? 'Paid' : (paymentAmount > 0 ? 'Partial' : 'Due')
      };
    });

    // Sort purchases by date descending
    this.purchases.sort((a, b) => {
      const dateA = a.purchaseDate instanceof Date ? a.purchaseDate.getTime() : 0;
      const dateB = b.purchaseDate instanceof Date ? b.purchaseDate.getTime() : 0;
      return dateB - dateA;
    });

    this.filteredPurchases = [...this.purchases];
    this.calculateTotalPages();
    this.isLoadingPurchases = false;
    this.updateLedgerView();
    this.updateAccountSummaryData(); 
  }

  standardizePurchase(purchase: any): any {
    let productsTotal = 0;
    let totalTax = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    let taxRate = 0;
    const isInterState = purchase.isInterState || false;

    if (purchase.products?.length) {
      const taxCalculations = purchase.products.reduce((acc: any, product: any) => {
        const quantity = product.quantity || 0;
        const price = product.unitCost || product.price || 0;
        const productTotal = quantity * price;
        const productTaxRate = product.taxRate || 0;
        let taxAmount = product.taxAmount || 0;
        
        if (taxAmount === 0 && productTaxRate > 0) {
          taxAmount = productTotal * (productTaxRate / 100);
        }

        acc.totalTax += taxAmount;
        acc.productsTotal += productTotal;
        
        if (productTaxRate > 0 && acc.taxRate === 0) {
          acc.taxRate = productTaxRate;
        }
        
        return acc;
      }, { totalTax: 0, productsTotal: 0, taxRate: 0 });

      totalTax = taxCalculations.totalTax;
      productsTotal = taxCalculations.productsTotal;
      taxRate = taxCalculations.taxRate;

      if (isInterState) {
        igst = totalTax;
      } else {
        cgst = totalTax / 2;
        sgst = totalTax / 2;
      }
    }

    const shippingCharges = Number(purchase.shippingCharges) || 0;
    
    // Calculate what the total *would* be if calculated from scratch
    const calculatedTotal = productsTotal + totalTax + shippingCharges;

    // FIX: Prioritize the stored grandTotal value from Firebase to avoid mismatch.
    // If roundedTotal exists, use it. Else grandTotal. Else purchaseTotal.
    // Fallback to calculatedTotal only if everything else is missing.
    const grandTotal = Number(purchase.roundedTotal) || 
                       Number(purchase.grandTotal) || 
                       Number(purchase.purchaseTotal) || 
                       calculatedTotal;

    // Use safe date converter
    return {
      ...purchase,
      productsTotal,
      totalTax,
      cgst,
      sgst,
      igst,
      taxRate,
      isInterState,
      shippingCharges,
      grandTotal, // This will now match List Purchases
      supplier: purchase.supplier || this.getSupplierDisplayName(purchase.supplierDetails),
      purchaseStatus: this.getStatusText(purchase.purchaseStatus),
      purchaseDate: this.getSafeDate(purchase.purchaseDate)
    };
  }



  private processPaymentData(payments: any[]): void {
    this.payments = payments.map(payment => {
      const rawDate = payment.paymentDate || payment.date || payment.createdAt || payment.paidOn;
      return {
        ...payment,
        paymentDate: this.getSafeDate(rawDate) 
      };
    });

    this.payments.sort((a, b) => b.paymentDate.getTime() - a.paymentDate.getTime());

    this.paymentLoading = false;
    this.updateLedgerView();
    this.updateAccountSummaryData();
  }



  // =========================================================================
  // LEDGER LOGIC
  // =========================================================================

  loadLedgerData(): void {
    this.ledgerLoading = true;
    this.ledgerEntries = this.generateLedgerEntries(this.purchases, this.payments);
    this.filterLedger();
    this.ledgerLoading = false;
  }

  updateLedgerView(): void {
    this.ledgerEntries = this.generateLedgerEntries(this.purchases, this.payments);
    this.filterLedger();
  }

  filterLedger(): void {
    if (!this.ledgerEntries.length) {
      this.filteredLedgerEntries = [];
      return;
    }

    const fromDate = new Date(this.fromDate);
    const toDate = new Date(this.toDate);
    toDate.setHours(23, 59, 59, 999);

    this.filteredLedgerEntries = this.ledgerEntries.filter(entry => {
      const entryDate = entry.date;
      if (entryDate < fromDate || entryDate > toDate) return false;
      
      if (this.selectedLocation !== 'all') {
        if (entry.purchase) return entry.purchase.businessLocation === this.selectedLocation;
        if (entry.payment) return entry.payment.location === this.selectedLocation;
      }
      return true;
    });

    this.filteredLedgerEntries.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  // =========================================================================
  // HELPER METHODS
  // =========================================================================

  private updateAccountSummaryData(): void {
    const totalPurchaseAmount = this.filteredPurchases.reduce((sum, p) => sum + this.getSafeGrandTotal(p), 0);
    const totalPaidAmount = this.payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const balanceDue = totalPurchaseAmount - totalPaidAmount;

    this.accountSummaryData = {
      openingBalance: 0, 
      totalPurchase: totalPurchaseAmount,
      totalExpense: 0, 
      totalPaid: totalPaidAmount,
      advanceBalance: totalPaidAmount > totalPurchaseAmount ? totalPaidAmount - totalPurchaseAmount : 0,
      balanceDue: Math.max(0, balanceDue),
      dateRange: {
        from: this.formatDateForDisplay(this.fromDate),
        to: this.formatDateForDisplay(this.toDate)
      },
      supplierDetails: this.supplierDetails,
      companyDetails: {
        name: 'HERBALY TOUCH AYURVEDA HOSPITAL PRIVATE LIMITED',
        address: 'Your Company Address, City, State, Country - ZIP' 
      }
    };
  }

  getSafeGrandTotal(purchase: any): number {
    // Priority: roundedTotal > grandTotal > purchaseTotal > calculated value
    return Number(purchase?.roundedTotal) || 
           Number(purchase?.grandTotal) || 
           Number(purchase?.purchaseTotal) || 
           Number(purchase?.totalAmount) || 0;
  }

  getStatusText(status: string): string {
    if (!status) return 'Pending';
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  getStatusClass(status?: string): string {
    if (!status) return 'bg-secondary';
    const s = status.toLowerCase();
    if (['received', 'paid', 'completed'].includes(s)) return 'bg-success';
    if (['pending', 'partial'].includes(s)) return 'bg-warning';
    if (['cancelled', 'due', 'unpaid'].includes(s)) return 'bg-danger';
    return 'bg-secondary';
  }

  // =========================================================================
  // EXISTING METHODS (UNCHANGED FUNCTIONALITY)
  // =========================================================================

  downloadDocument(doc: any): void {
    if (!doc || !doc.url) return;
    const link = document.createElement('a');
    link.href = doc.url;
    link.download = doc.name || 'download';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  addNote(): void {
    if (!this.newNote.title || !this.newNote.content) {
      alert('Please fill all required fields');
      return;
    }
    this.newNote.createdAt = new Date();
    this.newNote.createdBy = this.currentUserName || this.currentUserId;
    this.newNote.isPrivate = false;
    
    this.supplierService.addSupplierNote(this.supplierId, this.newNote).then(() => {
      this.loadDocumentsAndNotes();
      this.newNote = { title: '', content: '', createdAt: new Date(), createdBy: this.currentUserName, isPrivate: false };
    }).catch(error => {
      console.error('Error adding note:', error);
      alert('Error adding note');
    });
  }

  uploadDocuments(): void {
    if (this.selectedFiles.length === 0) {
      alert('Please select files to upload');
      return;
    }
    this.isUploading = true;
    const uploadPromises = this.selectedFiles.map((file: File) => {
      return this.uploadFile(file).then(downloadURL => {
        const document: SupplierDocument = {
          name: file.name,
          url: downloadURL,
          uploadedAt: new Date(),
          uploadedBy: this.currentUserName || this.currentUserId,
          isPrivate: false 
        };
        return this.supplierService.addSupplierDocument(this.supplierId, document);
      });
    });

    Promise.all(uploadPromises).then(() => {
      this.loadDocumentsAndNotes();
      this.selectedFiles = [];
      this.isUploading = false;
    }).catch(error => {
      console.error('Error uploading:', error);
      this.isUploading = false;
      alert('Error uploading documents');
    });
  }



  private updateAccountSummaryDateRange(): void {
    this.accountSummaryData.dateRange = {
      from: this.formatDateForDisplay(this.fromDate),
      to: this.formatDateForDisplay(this.toDate)
    };
  }

  private formatDateForDisplay(dateString: string): string {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  }

  filterPurchases(): void {
    if (!this.purchases.length) {
      this.filteredPurchases = [];
      this.calculateTotalPages();
      this.updateAccountSummaryData(); 
      return;
    }

    const fromDate = new Date(this.fromDate);
    const toDate = new Date(this.toDate);
    toDate.setHours(23, 59, 59, 999);

    this.filteredPurchases = this.purchases.filter(purchase => {
      const pDate = purchase.purchaseDate instanceof Date ? purchase.purchaseDate : new Date(purchase.purchaseDate);
      if (pDate < fromDate || pDate > toDate) return false;
      if (this.selectedLocation !== 'all' && purchase.businessLocation !== this.selectedLocation) return false;
      return true;
    });

    this.calculateTotalPages();
    this.updateAccountSummaryDateRange();
    this.updateAccountSummaryData(); 
  }

  applyDateFilter(): void {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (this.selectedDateFilter) {
      case 'today':
        this.fromDate = this.formatDate(today);
        this.toDate = this.formatDate(today);
        break;
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        this.fromDate = this.formatDate(yesterday);
        this.toDate = this.formatDate(yesterday);
        break;
      case 'thisWeek':
        const weekStart = new Date(today);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        this.fromDate = this.formatDate(weekStart);
        this.toDate = this.formatDate(today);
        break;
      case 'thisMonth':
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        this.fromDate = this.formatDate(monthStart);
        this.toDate = this.formatDate(today);
        break;
      case 'thisFinancialYear':
        const financialYear = this.getFinancialYear(today);
        this.fromDate = this.formatDate(financialYear.start);
        this.toDate = this.formatDate(financialYear.end);
        break;
      case 'previousYear':
        const prevYear = new Date(today.getFullYear() - 1, 0, 1);
        const prevYearEnd = new Date(today.getFullYear() - 1, 11, 31);
        this.fromDate = this.formatDate(prevYear);
        this.toDate = this.formatDate(prevYearEnd);
        break;
    }

    this.stockReportFromDate = this.fromDate;
    this.stockReportToDate = this.toDate;

    this.filterPurchases();
    this.filterLedger();
    this.filterStockReport();
  }

  loadSupplierDetails(): void {
    this.supplierService.getSupplierById(this.supplierId).subscribe(supplier => {
      this.supplierDetails = supplier || {};
      this.supplierDetails.displayName = this.getSupplierDisplayName(supplier);
      this.supplierDetails.formattedAddress = this.formatSupplierAddress(supplier);
      this.accountSummaryData.supplierDetails = this.supplierDetails;
      this.updateAccountSummaryData();
    });
  }

  viewPurchaseDetails(purchase: any): void {
    if (!purchase?.id) return;
    this.router.navigate(['/view-purchase', purchase.id]);
  }

  calculateTotal(type: 'debit' | 'credit'): number {
    return this.filteredLedgerEntries.reduce((sum, entry) => {
      return sum + (entry.type === type ? entry.amount : 0);
    }, 0);
  }

  getCurrentBalance(): number {
    if (this.filteredLedgerEntries.length === 0) return 0;
    return this.filteredLedgerEntries[this.filteredLedgerEntries.length - 1].balance;
  }

  private initializeSupplierForAddPurchase(): void {
    this.supplierService.getSupplierById(this.supplierId).subscribe(supplier => {
      this.supplierDetails = supplier;
      this.supplierDetails.formattedAddress = this.formatSupplierAddress(supplier);
      if (this.supplierDetails) {
        this.accountSummary.openingBalance = 0;
        this.currentBalance = 0;
      }
    });
  }

  private formatSupplierAddress(supplier: any): string {
    if (!supplier) return '';
    const addressParts = [
      supplier.addressLine1,
      supplier.addressLine2,
      `${supplier.city}, ${supplier.state}`,
      `${supplier.country} - ${supplier.zipCode}`
    ].filter(part => part && part.trim() !== '');
    return addressParts.join(', ');
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private getFormattedDate(date: Date): string {
    return this.formatDate(date);
  }

  public getSupplierDisplayName(supplier: any): string {
    if (!supplier) return '';
    if (supplier.isIndividual) {
      return `${supplier.firstName || ''} ${supplier.lastName || ''}`.trim();
    }
    return supplier.businessName || supplier.name || '';
  }

  handlePurchaseLoadError(error: any): void {
    console.error('Error loading purchases:', error);
    this.isLoadingPurchases = false;
    this.purchases = [];
    this.filteredPurchases = [];
  }

  calculateTotalPages(): void {
    this.totalPages = Math.ceil(this.filteredPurchases.length / this.itemsPerPage);
    if (this.currentPage > this.totalPages && this.totalPages > 0) {
      this.currentPage = this.totalPages;
    }
  }

  onDateFilterChange(): void {
    if (this.selectedDateFilter !== 'custom') {
      this.showCustomDateRange = false;
      this.applyDateFilter();
    } else {
      this.showCustomDateRange = true;
      this.customFromDate = this.fromDate;
      this.customToDate = this.toDate;
    }
  }

  applyCustomDateRange(): void {
    if (!this.customFromDate || !this.customToDate) {
      alert('Please select both from and to dates');
      return;
    }
    this.fromDate = this.customFromDate;
    this.toDate = this.customToDate;
    this.stockReportFromDate = this.fromDate;
    this.stockReportToDate = this.toDate;
    this.filterPurchases();
    this.filterLedger();
    this.filterStockReport();
  }

  viewLedgerDetails(entry: LedgerEntry): void {
    if (entry.purchase) {
      this.viewPurchaseDetails(entry.purchase);
    } else if (entry.payment) {
      this.viewPaymentDetails(entry.payment.id);
    }
  }

  filterStockReport(): void {
    if (!this.stockReport) return;
    this.filteredStockReport = this.stockReport.filter(item => {
      const hasPurchaseInRange = item.purchases.some((p: any) => {
        const purchaseDate = new Date(p.date).toISOString().split('T')[0];
        return purchaseDate >= this.fromDate && purchaseDate <= this.toDate;
      });
      if (!hasPurchaseInRange) return false;
      if (this.selectedLocation !== 'all') {
        const hasPurchaseInLocation = item.purchases.some((p: any) => p.location === this.selectedLocation);
        if (!hasPurchaseInLocation) return false;
      }
      return true;
    });
  }

  getTotalPurchasesAmount(): number {
    return this.filteredPurchases.reduce((total, purchase) => total + (purchase.grandTotal || 0), 0);
  }

  getPaginatedPurchases(): Purchase[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredPurchases.slice(startIndex, startIndex + this.itemsPerPage);
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    for (let i = 1; i <= this.totalPages; i++) pages.push(i);
    return pages;
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) this.currentPage = page;
  }

  previousPage(): void {
    if (this.currentPage > 1) this.currentPage--;
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) this.currentPage++;
  }

  loadLocations(): void {
    this.locationService.getLocations().subscribe({
      next: (locations) => {
        this.locations = locations;
        if (this.locations.length > 0) this.selectedLocation = this.locations[0].id;
      },
      error: (error) => console.error('Error loading locations:', error)
    });
  }

  getLocationName(locationId: string): string {
    const location = this.locations.find(l => l.id === locationId);
    return location ? location.name : 'All Locations';
  }

  private getFinancialYear(date: Date): { start: Date, end: Date } {
    const year = date.getMonth() >= this.financialYearStartMonth - 1 ? date.getFullYear() : date.getFullYear() - 1;
    const start = new Date(year, this.financialYearStartMonth - 1, 1);
    const end = new Date(year + 1, this.financialYearStartMonth - 1, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  deletePurchase(purchaseId: string): void {
    if (confirm('Are you sure you want to delete this purchase?')) {
      this.purchaseService.deletePurchase(purchaseId)
        .catch(error => {
          console.error('Error deleting purchase:', error);
          alert('Error deleting purchase');
        });
    }
  }

  changeTab(tab: string): void {
    this.activeTab = tab;
  }

  loadPurchaseOrderStockData(): void {
    this.stockReportLoading = true;
    this.purchaseService.getPurchasesBySupplier(this.supplierId).subscribe((purchases: any[]) => {
      this.stockReport = purchases.flatMap((purchase: { products: any[]; purchaseDate: any; }) => {
        if (!purchase.products) return [];
        return purchase.products.map((product: any) => ({
          productId: product.productId,
          productName: product.productName,
          sku: product.sku || 'N/A',
          category: product.category || 'N/A',
          purchasedQty: product.quantity,
          unit: product.unit || 'pcs',
          purchasePrice: product.unitCost,
          lastPurchaseDate: purchase.purchaseDate,
          currentStock: product.currentStock || 0
        }));
      });
      this.filteredStockReport = [...this.stockReport];
      this.stockReportLoading = false;
    });
  }

  onLocationChange(): void {
    this.applyFilters();
  }

  applyFilters(): void {
    // Basic location filter placeholder
    if (this.selectedLocation !== 'All locations') {
      // Logic handled in specific tab filters
    }
  }

  loadStockReport(): void {
    this.stockReportLoading = true;
    this.purchaseService.getPurchasesBySupplier(this.supplierId).subscribe((purchases: any[]) => {
      const stockMap = new Map<string, any>();
      const locations = new Set<string>();
      
      purchases.forEach((purchase: { products: any[]; businessLocation: string; purchaseDate: any; }) => {
        if (purchase.products && purchase.products.length > 0) {
          if (purchase.businessLocation) locations.add(purchase.businessLocation);
          
          purchase.products.forEach((product: any) => {
            const key = product.productId || product.productName;
            if (!key) return;
            
            if (stockMap.has(key)) {
              const existing = stockMap.get(key);
              existing.totalQuantity += product.quantity || 0;
              existing.totalAmount += (product.quantity || 0) * (product.unitCost || 0);
              existing.purchases.push({
                date: purchase.purchaseDate,
                quantity: product.quantity,
                price: product.unitCost,
                location: purchase.businessLocation
              });
            } else {
              stockMap.set(key, {
                productId: product.productId,
                productName: product.productName,
                sku: product.sku || 'N/A',
                category: product.category || 'N/A',
                unit: product.unit || 'pcs',
                alertQuantity: product.alertQuantity,
                currentStock: product.currentStock || 0,
                totalQuantity: product.quantity || 0,
                totalAmount: (product.quantity || 0) * (product.unitCost || 0),
                avgPurchasePrice: product.unitCost || 0,
                lastPurchaseDate: purchase.purchaseDate,
                purchases: [{
                  date: purchase.purchaseDate,
                  quantity: product.quantity,
                  price: product.unitCost,
                  location: purchase.businessLocation
                }]
              });
            }
          });
        }
      });
      
      this.stockReport = Array.from(stockMap.values()).map(item => {
        item.avgPurchasePrice = item.totalAmount / item.totalQuantity;
        item.lastPurchaseDate = item.purchases.reduce((latest: string, purchase: any) => {
          return (!latest || purchase.date > latest) ? purchase.date : latest;
        }, '');
        return item;
      }).sort((a, b) => a.productName.localeCompare(b.productName));
      
      this.stockLocations = Array.from(locations);
      this.filterStockReport();
      this.stockReportLoading = false;
    });
  }

  getTotalPurchasedQty(): number {
    return this.filteredStockReport.reduce((sum, item) => sum + (item.totalQuantity || 0), 0);
  }

  getTotalAmount(): number {
    return this.filteredStockReport.reduce((sum, item) => sum + (item.totalAmount || 0), 0);
  }

  exportStockReportToExcel(): void {
    const data = this.filteredStockReport.map(item => ({
      'Product Name': item.productName,
      'SKU': item.sku,
      'Category': item.category,
      'Purchased Qty': item.totalQuantity,
      'Unit': item.unit,
      'Purchase Price': item.avgPurchasePrice,
      'Total Amount': item.totalAmount,
      'Last Purchase Date': item.lastPurchaseDate,
      'Current Stock': item.currentStock
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock Report');
    XLSX.writeFile(workbook, `Stock_Purchased_${this.supplierDetails.businessName}.xlsx`);
  }

  exportStockReportToPDF(): void {
    const doc = new jsPDF();
    const title = `Stock Purchased from ${this.supplierDetails.businessName || 'Supplier'}`;
    const dateRange = `From ${this.stockReportFromDate} to ${this.stockReportToDate}`;
    
    doc.setFontSize(16);
    doc.text(title, 14, 15);
    doc.setFontSize(10);
    doc.text(dateRange, 14, 22);
    
    const tableData = this.filteredStockReport.map(item => [
      item.productName,
      item.sku || 'N/A',
      item.category || 'N/A',
      item.totalQuantity.toString(),
      item.unit || 'pcs',
      '₹' + item.avgPurchasePrice.toFixed(2),
      '₹' + item.totalAmount.toFixed(2),
      new Date(item.lastPurchaseDate).toLocaleDateString(),
      item.currentStock.toString()
    ]);
    
    autoTable(doc, {
      head: [['Product', 'SKU', 'Category', 'Qty', 'Unit', 'Price', 'Amount', 'Last Purchase', 'Current Stock']],
      body: tableData,
      startY: 30,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255 }
    });
    
    autoTable(doc, {
      body: [
        ['Total Products:', this.filteredStockReport.length.toString()],
        ['Total Purchased Quantity:', this.getTotalPurchasedQty().toString()],
        ['Total Amount:', '₹' + this.getTotalAmount().toFixed(2)]
      ],
      startY: (doc as any).lastAutoTable.finalY + 10,
      styles: { fontSize: 10, cellPadding: 5 },
      columnStyles: { 0: { fontStyle: 'bold' } }
    });
    
    doc.save(`Supplier_Stock_Report_${this.supplierDetails.businessName || this.supplierId}.pdf`);
  }

  loadDocumentsAndNotes(): void {
    this.supplierService.getSupplierById(this.supplierId).subscribe(supplier => {
      this.documents = supplier?.documents || [];
      this.notes = supplier?.notes || [];
    });
  }

  deleteNote(noteId: string): void {
    if (confirm('Are you sure you want to delete this note?')) {
      this.supplierService.deleteSupplierNote(this.supplierId, noteId)
        .then(() => {
          this.notes = this.notes.filter(note => note.id !== noteId);
        })
        .catch(error => {
          console.error('Error deleting note:', error);
          alert('Error deleting note');
        });
    }
  }

  onFileSelected(event: any): void {
    this.selectedFiles = Array.from(event.target.files);
  }

  viewPayments(purchase?: Purchase): void {
    if (!purchase) return;
    this.router.navigate(['/payment-history'], {
      queryParams: { 
        purchaseId: purchase.id,
        purchaseRef: purchase.referenceNo,
        supplierId: this.supplierId,
        supplierName: this.supplierDetails.businessName || 
                     `${this.supplierDetails.firstName} ${this.supplierDetails.lastName || ''}`.trim()
      }
    });
  }

  openReceiptModal(payment: any): void {
    this.selectedPayment = payment;
    this.showReceiptModal = true;
    document.body.classList.add('modal-open');
  }

  closeReceiptModal(): void {
    this.showReceiptModal = false;
    this.selectedPayment = null;
    document.body.classList.remove('modal-open');
  }
  
  addPayment(purchase?: Purchase): void {
    if (!purchase) return;
    this.router.navigate(['/suppliers', this.supplierId, 'payments'], {
      queryParams: { 
        purchaseId: purchase.id,
        purchaseRef: purchase.referenceNo
      }
    });
  }

  private uploadFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        resolve(`https://example.com/uploads/${file.name}`);
      }, 2000);
    });
  }

  navigateToAddPurchase() {
    const supplierName = this.getSupplierDisplayName(this.supplierDetails);
    this.router.navigate(['/add-purchase'], {
      queryParams: {
        supplierId: this.supplierId,
        fromSupplier: true,
        supplierName: supplierName,
        supplierAddress: this.supplierDetails.addressLine1
      }
    });
  }

  viewPaymentDetails(paymentId: string): void {
    if (paymentId) {
      this.router.navigate(['/view-payment', paymentId]); 
    } else {
      console.warn('No payment ID found for this record.');
    }
  }

  deleteDocument(documentId: string): void {
    if (confirm('Are you sure you want to delete this document?')) {
      this.supplierService.deleteSupplierDocument(this.supplierId, documentId)
        .then(() => {
          this.documents = this.documents.filter(doc => doc.id !== documentId);
        })
        .catch(error => {
          console.error('Error deleting document:', error);
          alert('Error deleting document');
        });
    }
  }




  // ✅ NEW METHOD: Update payment amounts for all purchases
  private async updatePurchasePaymentAmounts(): Promise<void> {
    try {
      // Get all purchases for this supplier
      const purchasesQuery = query(
        collection(this.firestore, 'purchases'),
        where('supplierId', '==', this.supplierId)
      );
      
      const purchasesSnapshot = await getDocs(purchasesQuery);
      
      // Get all payments for this supplier
      const paymentsQuery = query(
        collection(this.firestore, 'payments'),
        where('supplierId', '==', this.supplierId)
      );
      
      const paymentsSnapshot = await getDocs(paymentsQuery);
      const allPayments = paymentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Calculate total payments made
      const totalPayments = allPayments.reduce((sum, payment: any) => sum + (payment.amount || 0), 0);
      
      // Update each purchase document
      const updatePromises = purchasesSnapshot.docs.map(async (purchaseDoc) => {
        const purchaseData = purchaseDoc.data();
        const purchaseRef = doc(this.firestore, 'purchases', purchaseDoc.id);
        
        // Get purchase-specific payments
        const purchasePayments = allPayments.filter((payment: any) => 
          payment.purchaseId === purchaseDoc.id
        );
        
        const purchasePaymentAmount = purchasePayments.reduce((sum, payment: any) => 
          sum + (payment.amount || 0), 0
        );
        
        const grandTotal = Number(purchaseData['roundedTotal']) || 
                          Number(purchaseData['grandTotal']) || 
                          Number(purchaseData['purchaseTotal']) || 0;
        
        const paymentDue = Math.max(0, grandTotal - purchasePaymentAmount);
        
        const paymentStatus = paymentDue <= 0 ? 'Paid' : 
                             (purchasePaymentAmount > 0 ? 'Partial' : 'Due');
        
        // Update the purchase document
        await updateDoc(purchaseRef, {
          paymentAmount: purchasePaymentAmount,
          paymentDue: paymentDue,
          paymentStatus: paymentStatus,
          updatedAt: Timestamp.now()
        });
      });
      
      await Promise.all(updatePromises);
      
      console.log('✅ Purchase payment amounts updated successfully');
      
    } catch (error) {
      console.error('Error updating purchase payment amounts:', error);
      // Don't throw - payment was recorded successfully, this is just a sync issue
    }
  }

  ngOnDestroy(): void {
    if (this.purchasesUnsubscribe) this.purchasesUnsubscribe();
    if (this.paymentsUnsubscribe) this.paymentsUnsubscribe();
    if (this.ledgerUnsubscribe) this.ledgerUnsubscribe();
  }
}