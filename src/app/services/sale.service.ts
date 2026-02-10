import { Injectable } from '@angular/core';
import { 
  Firestore, 
  collection, 
  doc, 
  getDoc, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  DocumentSnapshot,
  DocumentData,
  getDocs,
  or,
  writeBatch,
  increment,
  Timestamp,
  runTransaction,
  orderBy,

  limit,
  serverTimestamp,
  FieldValue,
  setDoc,
  DocumentReference
} from '@angular/fire/firestore';

import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { ProductsService } from './products.service';
import { Papa } from 'ngx-papaparse';
import { BehaviorSubject, Subject } from 'rxjs';
import { ReturnService } from './return.service';
import { COLLECTIONS } from '../../utils/constants';
import { StockService } from './stock.service';

import { DailyStockService } from './daily-stock.service';
import { AccountService } from './account.service'; // Ensure this is imported

interface SalesReturnLogItem {
  productId: string;
  productName: string;
  quantity: number;      // Original quantity sold
  returnQuantity: number; // Quantity returned
  unitPrice: number;     // Price per unit
  subtotal: number;      // returnQuantity * unitPrice
  reason?: string;       // Optional reason for return
}

// Type Interfacesfsa
interface DepartmentExecutive {
  id: string;
  displayName: string;
  email: string;
  department: string;
}
export interface SalePayment {
  amount: number;
  method: string;
  accountId: string;
  note?: string;
}
interface ReturnItem {
  productId: string;
  name: string;
  quantity: number;
  originalQuantity: number;
  unitPrice: number;
  reason?: string;
  subtotal: number;
}

interface Return {
  id?: string;
  originalSaleId: string;
  invoiceNo: string;
  customer: string;
  returnedItems: ReturnItem[];
  totalRefund: number;
  returnDate: Date;
  status: string;
   businessLocation?: string;   // The name (e.g., "Chenganoor")
  businessLocationId?: string; // The ID
  location?: string;           // Fallback field name
  returnReason?: string;
  createdAt?: Date;
  processedBy?: string;
    totalTaxReturned?: number; // ✅ ADD THIS LINE

}

interface SalesReturnLog {
  saleId: string;
  returnDate: Date;
  paymentAccountId: string;
  items: SalesReturnLogItem[];
}

interface Sale {
  id?: string;
  saleDate: Date;
  invoiceNo: string;
  customer: string;
  status: string;
  products?: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    discountPercent?: number;
    subtotal: number;
    taxAmount: number;
    lineTotal: number;
  }>;
  [key: string]: any;
}

export interface Product {
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  taxType: string;
  productId: string | undefined;
  id?: string;
  name: string;
  productName?: string;
  sku?: string;
  barcode?: string;
  currentStock?: number;
  defaultSellingPriceExcTax?: number;
  defaultSellingPriceIncTax?: number;
  batchNumber?: string;
  expiryDate?: string;
  taxRate?: number;
  taxAmount?: number;
  quantity: number;
  unitPrice: number;
  discount: number;
  commissionPercent?: number;
  commissionAmount?: number;
  subtotal: number;
  priceBeforeTax: number;
  taxIncluded: boolean;
  discountType: 'Amount' | 'Percentage';
  productType?: string;
  components?: Array<{
    productId: string;
    quantity: number;
  }>;
  notSellingProducts?: Array<{
    productId: string;
    productName?: string;
    quantity: number;
  }>;
}

interface Prescription {
  id?: string;
  patientName: string;
  date: string;
  medicines: any[];
  doctorName: string;
  createdAt?: Date;
}

export interface SalesOrder {
  contactPersonId: string;
  addedByDisplayName?: string;
  patientId?: string;
  contractId: string;
  bookingId?: string;
    payments?: SalePayment[]; // Add this new field

  shippingChargesAfterTax: number;
  packingTaxAmount?: number;
  codTaxAmount: number;
  ppTaxAmount: number;
  interestedProductIds: boolean;
  productTaxAmount: number;
  department?: string;
  shippingTaxAmount: number;
  roundOff: number;
  paymentAccount: string;
  paymentAccountName?: string;
  transactionId: string;
  paidOn?: Date;
  paymentStatus: string;
  totalAmount: any;
  customerName?: string;
  alternateContact?: string;
  businessLocationId?: string;
  orderNo?: string;
  paymentAccountId?: string;
  addedBy?: string;
  prescriptions?: any[];
  ppServiceData?: any;
  codData?: any;
  contactNumber?: string;
  shippingDetails?: string;
  activities?: {
    userId: string;
    userName: string;
    fromStatus: string;
    paymentAccount: string;
    toStatus: string;
    timestamp: Date;
    notes?: string;
  }[];
  typeOfService: string | undefined;
  typeOfServiceName: string;
  total: any;
  subtotal: number;
  tax: number;
  shippingCost: number;
  id: string;
  customer: string;
  customerId: string;
  saleDate: Date;
  invoiceNo: string;
  invoiceScheme?: string;
  status: string;
  // ========== ADD THIS LINE ==========
  orderStatus?: string;  // Add this field
  // ==================================
  shippingStatus: string;
  paymentAmount: number;
  shippingCharges: number;
  discountAmount: number;
  balance: number;
  balanceAmount?: number;
  businessLocation?: string;
  location?: string;
  products?: Product[];
  billingAddress?: string;
  shippingAddress?: string;
  orderTax?: number;
  discountType?: string;
  sellNote?: string;
  deliveryPerson?: string;
  paymentMethod?: string;
  paymentNote?: string;
  changeReturn?: number;
  itemsTotal?: number;
  document?: string;
  shippingDocuments?: string;
  createdAt: Date;
  updatedAt: Date;
  totalPayable?: number;
  customerAge?: number;
  customerGender?: string;
  customerOccupation?: string;
  productInterested?: string;
  customerDob?: string | null;
  creditLimit?: number;
  otherData?: string;
  customerEmail?: string;
  customerPhone?: string;
  completedAt?: Date;
  
  hasReturns?: boolean;
  lastReturnDate?: Date;
  totalReturned?: number;
  returnStatus?: string;
}

interface FilterOptions {
  businessLocation?: string;
  customer?: string;
  locations?: string[];
  status?: string;
  shippingStatus?: string;
  dateRange?: {
    startDate?: string;
    endDate?: string;
  };
}

interface Medicine {
  name: string;
  type: string;
  dosage?: string;
  instructions?: string;
  ingredients?: string;
  pills?: string;
  powder?: string;
  time: string;
  frequency?: string;
  [key: string]: any;
  quantity?: string;
}

interface SalesStockPriceLog {
  saleId: string;
  invoiceNo: string;
  productId: string;
  productName: string;
  quantity: number;
  sellingPrice: number;
  location: string;
  paymentAccountId: string;
  paymentType: string;
  taxRate: number;
  packingCharge: number;
  shippingCharge: number;
  saleCreatedDate: Date;
  createdAt: Date;
}

@Injectable({
  providedIn: 'root'
})
export class SaleService {
  [x: string]: any;
  private stockUpdatedSource = new Subject<void>();
  private salesUpdated = new Subject<void>();

  public stockUpdated$ = this.stockUpdatedSource.asObservable();
  salesUpdated$ = this.salesUpdated.asObservable();

  constructor(
    private firestore: Firestore,
    private productsService: ProductsService,
    private papa: Papa,
    private dailyStockService: DailyStockService,
    private returnService: ReturnService,
    private stockService: StockService,
   private accountService: AccountService
  ) {}

// ... existing imports ...

// Inside SaleService class
 async getLatestPosInvoiceNumber(): Promise<number> {
    try {
      const salesCollection = collection(this.firestore, 'sales');
      // Query recent sales to find the last POS transaction
      const q = query(
        salesCollection, 
        orderBy('createdAt', 'desc'),
        limit(50)
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) return 1;

      // Find the first document that looks like "POS001" (Starts with POS, does NOT have a hyphen)
      const lastPosSale = querySnapshot.docs.find(doc => {
        const data = doc.data() as any;
        const inv = data.invoiceNo || '';
        // We exclude 'POS-' to ensure we don't accidentally pick up the old timestamp format
        return typeof inv === 'string' && inv.startsWith('POS') && !inv.includes('POS-');
      });

      if (lastPosSale) {
        const latestInvoice = lastPosSale.data()['invoiceNo']; // e.g., POS001
        
        // Remove "POS" and parse the number
        const numericPart = latestInvoice.replace('POS', '');
        const number = parseInt(numericPart, 10);
        
        return isNaN(number) ? 1 : number + 1;
      }
      
      return 1; // Default to 1 if no previous 'POS001' style invoice is found
    } catch (error) {
      console.error('Error fetching latest POS invoice:', error);
      return 1;
    }
  }
  // Open src/app/services/sale.service.ts
// Add this method to SaleService class
// src/app/services/sale.service.ts

  listenSalesByDateRange(startDate: Date, endDate: Date, callback: (sales: any[]) => void): () => void {
    const salesRef = collection(this.firestore, 'sales');
    
    // Query for valid sales in the date range
    const q = query(
      salesRef,
      where('saleDate', '>=', Timestamp.fromDate(startDate)),
      where('saleDate', '<=', Timestamp.fromDate(endDate)),
      where('status', 'in', ['Completed', 'Partial Return', 'Returned'])
    );

    // Using onSnapshot for real-time updates
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const sales = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            saleDate: this.convertTimestampToDate(data['saleDate']),
            createdAt: this.convertTimestampToDate(data['createdAt'])
          };
        });
        callback(sales);
      }, 
      (error) => {
        console.error("Error listening to sales:", error);
        callback([]);
      }
    );

    return unsubscribe;
  }
async getNextInabInvoiceNumber(): Promise<string> {
  try {
    const salesCollection = collection(this.firestore, 'sales');
    // Query recent sales to find the last INAB transaction
    const q = query(
      salesCollection, 
      orderBy('createdAt', 'desc'),
      limit(50) 
    );

    const querySnapshot = await getDocs(q);
    let nextNum = 1;

    if (!querySnapshot.empty) {
      // Find the first document that starts with INAB
      const lastInabSale = querySnapshot.docs.find(doc => {
        const data = doc.data() as any;
        const inv = data.invoiceNo || '';
        return typeof inv === 'string' && inv.startsWith('INAB');
      });

      if (lastInabSale) {
        const latestInvoice = lastInabSale.data()['invoiceNo']; // e.g., INAB0186
        // Remove "INAB" and parse the number
        const numericPart = latestInvoice.replace('INAB', '');
        const number = parseInt(numericPart, 10);
        if (!isNaN(number)) {
          nextNum = number + 1;
        }
      }
    }
    
    // Format with leading zeros (e.g., INAB0187)
    return `INAB${String(nextNum).padStart(4, '0')}`;
  } catch (error) {
    console.error('Error generating INAB invoice number:', error);
    // Fallback timestamp based if DB fails
    return `INAB${Date.now()}`;
  }
}
// =========================================================
  // PROCESS RETURN (Main Method)
  // =========================================================


  // =========================================================
  // HELPER: Check if Sale is Fully Returned
  // =========================================================
  private async isSaleFullyReturned(originalSaleId: string, originalSaleData: any, newReturnItems: any[]): Promise<boolean> {
    if (!originalSaleData.products || originalSaleData.products.length === 0) {
        return false;
    }

    const totalReturnedQuantities = new Map<string, number>();

    // 1. Get all PREVIOUS returns for this sale
    const returnsRef = collection(this.firestore, 'returns');
    const q = query(returnsRef, where('originalSaleId', '==', originalSaleId));
    const previousReturnsSnapshot = await getDocs(q);

    // Accumulate historic returns
    previousReturnsSnapshot.docs.forEach(doc => {
        const ret = doc.data();
        if (ret['returnedItems'] && Array.isArray(ret['returnedItems'])) {
            ret['returnedItems'].forEach((item: any) => {
                const productId = item.productId || item.id;
                if (productId) {
                    const currentQty = totalReturnedQuantities.get(productId) || 0;
                    totalReturnedQuantities.set(productId, currentQty + (Number(item.quantity) || 0));
                }
            });
        }
    });
    
    // 2. Add quantities from the NEW return being processed
    newReturnItems.forEach((item: any) => {
        const productId = item.productId || item.id;
        if (productId) {
            const currentQty = totalReturnedQuantities.get(productId) || 0;
            totalReturnedQuantities.set(productId, currentQty + (Number(item.quantity) || 0));
        }
    });

    // 3. Compare Total Returned vs Original Sold
    for (const originalProduct of originalSaleData.products) {
        const productId = originalProduct.productId || originalProduct.id;
        const originalQty = Number(originalProduct.quantity) || 0;
        const totalReturnedQty = totalReturnedQuantities.get(productId) || 0;

        // If even one product has returned count < original count, it's not a full return
        if (totalReturnedQty < originalQty) {
            return false; 
        }
    }

    return true; // All products matched
  }
// In sale.service.ts, around line 1800-1900
// This method is ALREADY CORRECT - it filters by 'Refunded' status and 'refundedAt' date


  // =========================================================
  // 2. PROCESS REFUND PAYMENT (Delayed Payment)
  // =========================================================
  async processRefundPayment(returnId: string, paymentData: any): Promise<void> {
    if (!returnId || !paymentData.accountId || !paymentData.amount) {
      throw new Error('Invalid payment data');
    }

    try {
      // 1. Fetch Return Document
      const returnDocRef = doc(this.firestore, 'returns', returnId);
      const returnSnap = await getDoc(returnDocRef);
      
      if (!returnSnap.exists()) throw new Error('Return document not found');
      const returnData = returnSnap.data();

      // 2. CHECK: Has stock been restored yet?
      // If NOT restored (because it was unpaid), Restore it NOW.
      if (!returnData['stockRestored']) {
          
          // Get Location ID from original sale
          const originalSaleRef = doc(this.firestore, 'sales', returnData['originalSaleId']);
          const originalSaleSnap = await getDoc(originalSaleRef);
          const originalSaleData = originalSaleSnap.data() as any;
          
          const locationId = returnData['businessLocationId'] || 
                             originalSaleData?.businessLocationId || 
                             originalSaleData?.businessLocation || 
                             'default';

          console.log(`💰 Payment Received. Restoring Stock for Return ${returnId} NOW...`);
          
          // RESTORE STOCK & UPDATE P&L SNAPSHOT
          await this.restoreStockForReturnedItems(
              returnData['returnedItems'],
              locationId,
              returnId,
              returnData['invoiceNo']
          );
      } else {
          console.log(`ℹ️ Stock was already restored previously.`);
      }

      // 3. Debit Account Book
      const returnObjForLedger = {
        id: returnId,
        invoiceNo: paymentData.invoiceNo,
        roundedRefund: paymentData.amount,
        originalSaleId: paymentData.originalSaleId,
        customerName: paymentData.customerName
      };

      await this.accountService.createReturnDebitTransaction(
        returnObjForLedger,
        paymentData.accountId,
        new Date(paymentData.date),
        paymentData.method
      );

      // 4. Update Return Document -> Mark as Refunded & Stock Restored
      await updateDoc(returnDocRef, {
        paymentStatus: 'Refunded',
        stockRestored: true, // ✅ Ensure this is true now
        refundedAccountId: paymentData.accountId,
        refundedAt: new Date(paymentData.date),
        updatedAt: serverTimestamp()
      });

      console.log(`✅ Return ${returnId} marked as Refunded. Financials updated.`);
      this.notifySalesUpdated(); 
    } catch (error) {
      console.error('Error processing refund payment:', error);
      throw error;
    }
  }
  private async restoreStockForReturnedItems(
    returnedItems: any[], 
    locationId: string, 
    returnId: string, 
    invoiceNo: string
): Promise<void> {
    /**
     * SAFETY CHECK: Ensure locationId is a string.
     * If it's somehow undefined here, your stock logging service will crash.
     */
    const safeLocationId = (locationId && typeof locationId === 'string') ? locationId : 'default';

    for (const item of returnedItems) {
        const productId = item.productId || item.id;
        const qtyToPutBack = Number(item.quantity) || 0;

        if (productId && qtyToPutBack > 0) {
            // A. Adjust Actual Product Stock (Inventory Count)
            // This is the call that usually triggers the 'stock_logs' error if locationId is undefined
            await this.stockService.adjustProductStock(
                productId,
                qtyToPutBack,
                'add', 
                safeLocationId, 
                `RETURN-${invoiceNo}`,
                'system'
            );

            // B. Update Daily Snapshot for P&L Accuracy
            const stockDocRef = doc(this.firestore, 'product-stock', `${productId}_${safeLocationId}`);
            const stockSnap = await getDoc(stockDocRef);
            const finalStock = stockSnap.exists() ? stockSnap.data()['quantity'] : 0;

            const productMasterRef = doc(this.firestore, 'products', productId);
            const masterSnap = await getDoc(productMasterRef);
            
            let unitCost = 0;
            if (masterSnap.exists()) {
                const mData = masterSnap.data();
                unitCost = Number(
                    mData['defaultPurchasePriceExcTax'] || 
                    mData['purchasePriceBeforeTax'] || 
                    mData['unitPurchasePrice'] || 
                    0
                );
            }

            await this.dailyStockService.updateDailySnapshot(
                productId,
                safeLocationId,
                new Date(), 
                finalStock,
                'in', 
                qtyToPutBack,
                `return_${returnId}`,
                unitCost
            );
            
            console.log(`✅ Stock restored for P&L at ${safeLocationId}: ${productId} (+${qtyToPutBack})`);
        }
    }
}
async processReturn(returnData: any): Promise<any> {
    if (!returnData.originalSaleId) throw new Error('Original sale ID is required');
    if (!returnData.returnedItems || returnData.returnedItems.length === 0) throw new Error('No items to return');

    try {
        const originalSaleRef = doc(this.firestore, 'sales', returnData.originalSaleId);
        const originalSaleSnap = await getDoc(originalSaleRef);
        
        if (!originalSaleSnap.exists()) throw new Error('Original sale not found');
        const originalSaleData = originalSaleSnap.data() as any;
        
        /**
         * CRITICAL FIX: Robust Location ID Extraction
         * We check 5 different possible fields to find where the location was stored.
         * We use 'default' as a hard fallback because Firestore will crash on 'undefined'.
         */
        const locationId = returnData.businessLocationId || 
                          originalSaleData.businessLocationId || 
                          originalSaleData.locationId || 
                          originalSaleData.location ||
                          originalSaleData.businessLocation ||
                          'default';
        
        const refundAccountId = returnData.paymentAccountId || 
                               originalSaleData.paymentAccountId || 
                               originalSaleData.paymentAccount;

        const isNowFullyReturned = await this.isSaleFullyReturned(
            returnData.originalSaleId,
            originalSaleData,
            returnData.returnedItems
        );

        // Fetch Historic Tax
        const returnsRef = collection(this.firestore, 'returns');
        const qPrev = query(returnsRef, where('originalSaleId', '==', returnData.originalSaleId));
        const prevReturnsSnap = await getDocs(qPrev);
        let historicTaxReturned = 0;
        prevReturnsSnap.forEach(doc => { historicTaxReturned += (Number(doc.data()['totalTaxReturned']) || 0); });

        const returnResult = await runTransaction(this.firestore, async (transaction) => {
            const updatedProductsArray = (originalSaleData.products || []).map((p: any) => {
                const returnedItem = returnData.returnedItems.find((item: any) => 
                    (item.productId || item.id) === (p.productId || p.id)
                );
                if (returnedItem) {
                    return { ...p, quantityReturned: (Number(p.quantityReturned) || 0) + (Number(returnedItem.quantity) || 0) };
                }
                return p;
            });

            const originalTotalPayable = Number(originalSaleData.totalPayable || 0);
            const originalTax = Number(originalSaleData.totalTax || 0);
            
            const currentReturnUnrounded = returnData.returnedItems.reduce((sum: number, item: any) => 
                sum + (Number(item.totalWithTax) || Number(item.subtotal) || 0), 0);
            
            let roundedRefund = Math.round(currentReturnUnrounded);

            let currentReturnTax = this.calculateReturnTaxAmount(returnData.returnedItems, originalSaleData);
            if (isNowFullyReturned) {
                currentReturnTax = Math.max(0, originalTax - historicTaxReturned);
                const previouslyReturnedVal = Number(originalSaleData.totalReturned || 0);
                roundedRefund = Math.max(0, originalTotalPayable - previouslyReturnedVal);
            }
            
            const newTotalTaxReturned = historicTaxReturned + currentReturnTax;
            const currentBalance = Number(originalSaleData.balance || 0);
            const currentTotalReturned = Number(originalSaleData.totalReturned || 0);
            
            const newBalance = isNowFullyReturned ? 0 : Math.max(0, currentBalance - roundedRefund);
            const newTotalReturned = isNowFullyReturned ? originalTotalPayable : (currentTotalReturned + roundedRefund);
            const newStatus = isNowFullyReturned ? 'Returned' : 'Partial Return';

            transaction.update(originalSaleRef, {
                products: updatedProductsArray,
                status: newStatus,
                balance: Number(newBalance.toFixed(2)),
                balanceAmount: Number(newBalance.toFixed(2)),
                totalReturned: Number(newTotalReturned.toFixed(2)),
                totalTaxReturned: Number(newTotalTaxReturned.toFixed(2)),
                updatedAt: serverTimestamp()
            });

            const returnDocRef = doc(collection(this.firestore, 'returns'));
            const returnDateTimestamp = returnData.returnDate ? Timestamp.fromDate(new Date(returnData.returnDate)) : serverTimestamp();
            const shouldRestoreStockNow = returnData.processPayment === true;

            // PREVENT UNDEFINED ERROR: Construct document explicitly
            const returnDocData: any = {
                ...returnData,
                id: returnDocRef.id,
                totalRefund: roundedRefund,
                totalTaxReturned: Number(currentReturnTax.toFixed(2)),
                isFullReturn: isNowFullyReturned,
                returnDate: returnDateTimestamp,
                createdAt: serverTimestamp(),
                paymentStatus: returnData.processPayment ? 'Refunded' : 'Due',
                refundedAccountId: returnData.processPayment ? refundAccountId : null,
                refundedAt: returnData.processPayment ? new Date(returnData.paymentDate) : null,
                stockRestored: shouldRestoreStockNow,
                businessLocationId: locationId // ✅ SAVED EXPLICITLY AS STRING
            };

            transaction.set(returnDocRef, returnDocData);

            return { 
                returnId: returnDocRef.id, 
                refundAmount: roundedRefund, 
                invoiceNo: originalSaleData.invoiceNo,
                customer: originalSaleData.customer,
                accountId: refundAccountId,
                processPayment: returnData.processPayment,
                paymentDate: returnData.paymentDate,
                paymentMethod: returnData.paymentMethod,
                shouldRestoreStock: shouldRestoreStockNow,
                locationId: locationId // ✅ PASS VERIFIED STRING OUT
            };
        });

        // POST-TRANSACTION
        if (returnResult.shouldRestoreStock) {
            await this.restoreStockForReturnedItems(
                returnData.returnedItems, 
                returnResult.locationId, // Use result from transaction
                returnResult.returnId, 
                returnResult.invoiceNo
            );
        }
        
        if (returnResult.processPayment && returnResult.accountId) {
            await this.accountService.createReturnDebitTransaction(
                {
                    ...returnData,
                    id: returnResult.returnId,
                    roundedRefund: returnResult.refundAmount,
                    invoiceNo: returnResult.invoiceNo,
                    customerName: returnResult.customer,
                    originalSaleId: returnData.originalSaleId
                }, 
                returnResult.accountId,
                returnResult.paymentDate,
                returnResult.paymentMethod
            );
        }

        this.notifySalesUpdated();
        return returnResult;

    } catch (error: any) {
        console.error('❌ Error processing return:', error);
        throw new Error(`Failed to process return: ${error.message}`);
    }
}
// src/app/services/sale.service.ts
// ========================================
// FIXED: sale.service.ts - updateSaleStatus Method
// ========================================

/**
 * ✅ FIXED VERSION: Updates BOTH status and orderStatus fields
 * This ensures consistency across the application
 */


// ========================================
// Alternative: If you want to keep it simple
// ========================================

/**
 * SIMPLE VERSION: Just ensure both fields are updated
 */
// ========================================
// CRITICAL FIX: Firestore Transaction Error
// ========================================
// Error: "Firestore transactions require all reads to be executed before all writes"
// Solution: Separate the transaction logic from non-transactional operations

/**
 * ✅ FIXED: completeSale method - Respects Firestore transaction rules
 * 
 * Key Changes:
 * 1. All READS happen first
 * 2. Then all WRITES happen
 * 3. Account ledger creation happens OUTSIDE the transaction
 */
async completeSale(saleId: string): Promise<void> {
  const saleRef = doc(this.firestore, COLLECTIONS.SALES, saleId);
  
  // ✅ STEP 1: Execute the transaction (stock reduction + status update)
  await runTransaction(this.firestore, async (transaction) => {
    // ========== PHASE 1: ALL READS FIRST ==========
    const saleSnap = await transaction.get(saleRef);
    
    if (!saleSnap.exists()) {
      throw new Error('Sale not found');
    }
    
    const saleData = saleSnap.data();
    
    // Check if already completed
    if (saleData['status'] === 'Completed' && saleData['orderStatus'] === 'Completed') {
      console.log('Sale is already completed, skipping...');
      return; // Exit early
    }
    
    const locationId = saleData['businessLocationId'] || saleData['businessLocation'] || 'default';
    const now = new Date();
    
    // Read all stock documents FIRST
    const stockReads: Array<{
      ref: any;
      currentStock: number;
      productId: string;
      qtySold: number;
    }> = [];
    
    if (saleData['products']?.length) {
      for (const product of saleData['products']) {
        const productId = product.productId || product.id;
        if (!productId) continue;
        
        const stockDocId = `${productId}_${locationId}`;
        const stockRef = doc(this.firestore, COLLECTIONS.PRODUCT_STOCK, stockDocId);
        
        // READ stock data
        const stockSnap = await transaction.get(stockRef);
        
        stockReads.push({
          ref: stockRef,
          currentStock: stockSnap.exists() ? (stockSnap.data()['quantity'] || 0) : 0,
          productId: productId,
          qtySold: product.quantity || 0
        });
      }
    }
    
    // ========== PHASE 2: ALL WRITES AFTER READS ==========
    
    // Write 1: Update sale status
    transaction.update(saleRef, {
      status: 'Completed',
      orderStatus: 'Completed',
      completedAt: serverTimestamp(),
      saleDate: now,
      updatedAt: serverTimestamp()
    });
    
    // Write 2: Update stock levels
    for (const stockData of stockReads) {
      const newStock = stockData.currentStock - stockData.qtySold;
      
      transaction.set(stockData.ref, {
        quantity: newStock,
        lastUpdated: serverTimestamp()
      }, { merge: true });
    }
    
    console.log(`✅ Sale ${saleId} marked as Completed in transaction`);
  });

  // ✅ STEP 2: Create account ledger OUTSIDE transaction (after transaction completes)
  try {
    await this.createAccountBookTransactionForSale(saleId);
  } catch (error) {
    console.error('Error creating account book transaction:', error);
    // Don't throw - sale is already completed, just log the error
  }
  
  // ✅ STEP 3: Notify listeners
  this.notifySalesUpdated();
  this.notifyStockUpdated();
  
  console.log(`✅ Sale ${saleId} completion process finished`);
}

/**
 * ✅ SIMPLIFIED VERSION: If the above is too complex, use this
 */
async completeSaleSimplified(saleId: string): Promise<void> {
  try {
    const saleRef = doc(this.firestore, COLLECTIONS.SALES, saleId);
    
    // Step 1: Just update the status (no transaction needed for simple update)
    await updateDoc(saleRef, {
      status: 'Completed',
      orderStatus: 'Completed',
      completedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    // Step 2: Reduce stock (using existing method)
    const saleSnap = await getDoc(saleRef);
    if (saleSnap.exists()) {
      const saleData = { id: saleId, ...saleSnap.data() } as SalesOrder;
      await this.reduceProductStockForSale(saleData);
    }
    
    // Step 3: Create ledger entry
    await this.createAccountBookTransactionForSale(saleId);
    
    // Step 4: Notify
    this.notifySalesUpdated();
    this.notifyStockUpdated();
    
    console.log(`✅ Sale ${saleId} completed successfully`);
  } catch (error) {
    console.error('Error completing sale:', error);
    throw error;
  }
}

/**
 * ✅ ALTERNATIVE: Avoid transactions altogether
 */
async updateSaleStatus(saleId: string, newStatus: string): Promise<void> {
  try {
    const saleRef = doc(this.firestore, 'sales', saleId);
    
    if (newStatus === 'Completed') {
      // Step 1: Get sale data
      const saleSnap = await getDoc(saleRef);
      if (!saleSnap.exists()) {
        throw new Error('Sale not found');
      }
      
      const saleData = { id: saleId, ...saleSnap.data() } as SalesOrder;
      
      // Check if already completed
      if (saleData.status === 'Completed' && saleData.orderStatus === 'Completed') {
        console.log('Sale already completed');
        return;
      }
      
      // Step 2: Update status FIRST
      await updateDoc(saleRef, {
        status: 'Completed',
        orderStatus: 'Completed',
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      // Step 3: Reduce stock (non-transactional)
      if (saleData.products && saleData.products.length > 0) {
        await this.reduceProductStockForSale(saleData);
      }
      
      // Step 4: Create ledger entry
      await this.createAccountBookTransactionForSale(saleId);
      
      // Step 5: Notify
      this.notifySalesUpdated();
      this.notifyStockUpdated();
      
    } else {
      // For other statuses, just update
      await updateDoc(saleRef, {
        status: newStatus,
        orderStatus: newStatus,
        updatedAt: serverTimestamp()
      });
    }
    
    console.log(`✅ Sale ${saleId} status updated to ${newStatus}`);
    
  } catch (error) {
    console.error('Error updating sale status:', error);
    throw error;
  }
}

/**
 * ✅ Helper: Non-transactional stock reduction
 */
async reduceProductStockForSale(sale: SalesOrder): Promise<void> {
  if (!sale.id) throw new Error('Sale ID is required to reduce stock.');
  if (!sale.products || sale.products.length === 0) {
    console.warn(`Sale ${sale.id} has no products. Skipping stock reduction.`);
    return;
  }

  const locationId = sale.businessLocationId || sale.businessLocation || 'default';
  const products = sale.products;
  
  try {
    // Process each product sequentially (not in transaction)
    for (const product of products) {
      const productId = product.productId || product.id;
      if (!productId) continue;

      const stockDocId = `${productId}_${locationId}`;
      const stockDocRef = doc(this.firestore, COLLECTIONS.PRODUCT_STOCK, stockDocId);

      // Get current stock
      const stockSnap = await getDoc(stockDocRef);
      const currentStock = stockSnap.exists() ? (stockSnap.data()['quantity'] || 0) : 0;
      const quantitySold = product.quantity ?? 0;
      const newStock = currentStock - quantitySold;

      // Update stock
      await setDoc(stockDocRef, { 
        quantity: newStock, 
        lastUpdated: serverTimestamp() 
      }, { merge: true });
      
      console.log(`✅ Stock reduced: ${productId} from ${currentStock} to ${newStock}`);
    }
    
    console.log(`✅ Stock reduction completed for sale ${sale.id}`);

  } catch (error) {
    console.error('Error during stock reduction:', error);
    throw error;
  }
}
async getLatestInabNumericValue(): Promise<number> {
  try {
    const salesCollection = collection(this.firestore, 'sales');
    // We query the most recent 100 sales to find the last INAB
    const q = query(
      salesCollection, 
      orderBy('createdAt', 'desc'),
      limit(100)
    );

    const querySnapshot = await getDocs(q);
    let maxNumber = 0;

    querySnapshot.forEach(doc => {
      const inv = doc.data()['invoiceNo'];
      if (typeof inv === 'string' && inv.startsWith('INAB')) {
        // Remove "INAB" and convert the rest to a number
        const numericPart = inv.replace('INAB', '');
        const num = parseInt(numericPart, 10);
        if (!isNaN(num) && num > maxNumber) {
          maxNumber = num;
        }
      }
    });

    return maxNumber;
  } catch (error) {
    console.error('Error fetching latest INAB number:', error);
    return 0;
  }
}
listenForSales(filters: any = {}, userAllowedLocations: string[] = []): Observable<any[]> {
  return new Observable((observer) => {
    const salesRef = collection(this.firestore, 'sales');
    let q = query(salesRef);

    if (userAllowedLocations && userAllowedLocations.length > 0) {
      if (userAllowedLocations.length <= 10) {
        q = query(q, where('businessLocationId', 'in', userAllowedLocations));
      }
    }

    q = query(q, orderBy('saleDate', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        let sales = snapshot.docs.map(doc => {
          const data = doc.data() as any;
          return {
            ...data,
            id: doc.id,
            // CRITICAL FIX: Convert Firestore Timestamps to JS Dates
            saleDate: this.convertTimestampToDate(data.saleDate),
            createdAt: this.convertTimestampToDate(data.createdAt),
            completedAt: this.convertTimestampToDate(data.completedAt),
            updatedAt: this.convertTimestampToDate(data.updatedAt)
          };
        });

        // Client-side filtering
        if (userAllowedLocations && userAllowedLocations.length > 10) {
          sales = sales.filter((sale: any) => {
            const saleLocation = sale.businessLocationId || sale.businessLocation || sale.location;
            return userAllowedLocations.includes(saleLocation);
          });
        }

        if (filters.productId) {
          sales = sales.filter((sale: any) => {
            if (!sale.products || !Array.isArray(sale.products)) return false;
            return sale.products.some((p: any) => 
              (p.id === filters.productId) || (p.productId === filters.productId)
            );
          });
        }

        observer.next(sales);
      },
      (error) => {
        console.error('Error in listenForSales:', error);
        observer.error(error);
      }
    );

    return () => unsubscribe();
  });
}
// =========================================================
private async createReturnDebitTransaction(result: any): Promise<void> {
    try {
        const transactionData = {
            amount: result.refundAmount,
            type: 'sales_return',
            date: new Date(),
            transactionTime: new Date(),
            description: `Return: ${result.invoiceNo}`,
            paymentMethod: 'Cash', // Defaulting to Cash as per your screenshot
            paymentDetails: result.invoiceNo,
            note: `Full Return Refund for Invoice #${result.invoiceNo}`,
            reference: result.invoiceNo,
            relatedDocId: result.returnId,
            source: 'sales_return',
            customerName: result.customer || '',
            debit: result.refundAmount, // This is the amount that will subtract from balance
            credit: 0,
            createdAt: new Date()
        };

        // Use the established accountService to ensure it appears in the Account Book
        await this.accountService.addTransaction(result.accountId, transactionData);
        console.log(`✅ Account ${result.accountId} debited for return.`);
    } catch (error) {
        console.error('❌ Error debiting account for return:', error);
    }
}
private async updateDailySnapshotsAfterSale(
  saleId: string, 
  products: any[], 
  locationId: string
): Promise<void> {
  try {
    const saleRef = doc(this.firestore, 'sales', saleId);
    const saleSnap = await getDoc(saleRef);
    
    if (!saleSnap.exists()) {
      console.error(`Sale ${saleId} not found`);
      return;
    }
    
    const data = saleSnap.data();

    // ✅ FIX: Get the sale date properly
    let transactionDate = new Date();
    if (data['saleDate']) {
      if (data['saleDate'].toDate) {
        transactionDate = data['saleDate'].toDate();
      } else {
        transactionDate = new Date(data['saleDate']);
      }
    }

    console.log(`📅 Processing sale dated: ${transactionDate.toDateString()}`);

    for (const product of products) {
      const productId = product.productId || product.id;
      if (!productId) continue;

      // Fetch the master product cost
      const productMasterRef = doc(this.firestore, 'products', productId);
      const stockDocRef = doc(this.firestore, 'product-stock', `${productId}_${locationId}`);
      
      const [masterSnap, stockSnap] = await Promise.all([
        getDoc(productMasterRef),
        getDoc(stockDocRef)
      ]);

      let unitCost = 0;
      if (masterSnap.exists()) {
        const mData = masterSnap.data();
        unitCost = Number(
          mData['defaultPurchasePriceExcTax'] || 
          mData['purchasePriceBeforeTax'] || 
          mData['unitPurchasePrice'] ||
          0
        );
      }

      let finalStock = stockSnap.exists() ? stockSnap.data()?.['quantity'] : 0;
      const qtySold = Number(product.quantity || 0);

      console.log(`📦 Product ${productId}: Sold ${qtySold}, New Stock ${finalStock}, Cost ₹${unitCost}`);

      // Update snapshot with the COST
      await this.dailyStockService.updateDailySnapshot(
        productId,
        locationId,
        transactionDate, // ✅ Use the sale date, not today
        finalStock,
        'out',
        qtySold,
        `sale_${saleId}`,
        unitCost // ✅ Passing the COST here
      );
    }
    
    console.log(`✅ All snapshots updated for sale ${saleId}`);
  } catch (error) {
    console.error(`❌ Error updating snapshots:`, error);
  }
}

  private async restoreProductStockForSale(sale: SalesOrder): Promise<void> {
      if (!sale.id) throw new Error('Sale ID is required to restore stock.');
      if (!sale.products || sale.products.length === 0) {
          console.warn(`Sale ${sale.id} has no products to restore stock for. Skipping.`);
          return;
      }
      
      try {
          // --- FIXED TRANSACTION LOGIC ---
          await runTransaction(this.firestore, async (transaction) => {
              const stockUpdates = [];

              // PHASE 1: READ ALL STOCK DATA FIRST
              for (const product of sale.products!) {
                  const productId = product.productId || product.id;
                  if (!productId) continue;

                  const locationId = sale.businessLocationId || sale.businessLocation || 'default';
                  const stockDocId = `${productId}_${locationId}`;
                  const stockDocRef = doc(this.firestore, 'product-stock', stockDocId);

                  // Perform the read
                  const stockSnap = await transaction.get(stockDocRef);
                  
                  // Store data in memory for Phase 2
                  stockUpdates.push({
                      ref: stockDocRef,
                      currentStock: stockSnap.exists() ? (stockSnap.data()['quantity'] || 0) : 0,
                      quantityToRestore: product.quantity ?? 0
                  });
              }

              // PHASE 2: PERFORM ALL WRITES
              for (const update of stockUpdates) {
                  const newStock = update.currentStock + update.quantityToRestore;
                  
                  transaction.set(update.ref, { 
                      quantity: newStock, 
                      lastUpdated: serverTimestamp() 
                  }, { merge: true });
              }
          });
          
          console.log(`✅ Atomic stock restoration successful for deleted/reverted sale ${sale.id}`);

          // --- UPDATE DAILY SNAPSHOTS (Outside transaction to prevent locking issues) ---
          for (const product of sale.products!) {
              const productId = product.productId || product.id;
              if (!productId) continue;

              const locationId = sale.businessLocationId || sale.businessLocation || 'default';
              const quantityToRestore = product.quantity ?? 0;

              // Get fresh stock value after transaction
              const stockDocRef = doc(this.firestore, 'product-stock', `${productId}_${locationId}`);
              const updatedStockSnap = await getDoc(stockDocRef);
              const finalStock = updatedStockSnap.exists() ? updatedStockSnap.data()['quantity'] : 0;

              await this.dailyStockService.updateDailySnapshot(
                  productId,
                  locationId,
                  new Date(),
                  finalStock,
                  'in', // Deleting a sale puts stock back 'in'
                  quantityToRestore,
                  `reversal_sale_${sale.id}`
              );
          }
          console.log(`✅ Daily snapshots updated for reverted sale ${sale.id}`);

      } catch (error) {
          console.error('Error restoring product stock:', error);
          throw error;
      }
  }
getLatestInvoiceNumber(): Observable<number> {
    return new Observable<number>(observer => {
      const salesCollection = collection(this.firestore, 'sales');
      
      // Query the last 50 sales. We fetch a batch to ensure we can scroll past 
      // recent POS sales to find the last actual "INAB" invoice.
      const q = query(
        salesCollection, 
        orderBy('createdAt', 'desc'),
        limit(50)
      );

      getDocs(q).then(querySnapshot => {
        let nextNumber = 1; // Default start number

        if (!querySnapshot.empty) {
          // Find the first document that actually looks like a Normal Sale (Starts with INAB)
          // This ignores 'POS-' or any other invoice formats
          const lastStandardInvoiceDoc = querySnapshot.docs.find(doc => {
            const data = doc.data() as any;
            return data.invoiceNo && 
                   typeof data.invoiceNo === 'string' && 
                   data.invoiceNo.startsWith('INAB');
          });

          if (lastStandardInvoiceDoc) {
            const latestSale = lastStandardInvoiceDoc.data() as any;
            const latestInvoice = latestSale.invoiceNo;
            
            // Extract only the digits from "INAB0013" -> 13
            // We specifically remove "INAB" to be safe, then parse
            const numericPart = latestInvoice.replace('INAB', '');
            const number = parseInt(numericPart, 10);
            
            if (!isNaN(number)) {
              nextNumber = number + 1;
            }
          }
        }
        
        observer.next(nextNumber);
        observer.complete();
      }).catch(error => {
        console.error('Error fetching latest invoice:', error);
        // Fallback on error
        observer.next(1);
        observer.complete();
      });
    });
  }

// ... rest of the service ...
  




  getSalesByCustomerId(customerId: string): Observable<SalesOrder[]> {
    return new Observable<SalesOrder[]>((observer) => {
      const salesCollection = collection(this.firestore, 'sales');
      const q = query(
        salesCollection,
        where('customerId', '==', customerId),
        orderBy('saleDate', 'desc')
      );

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const sales: SalesOrder[] = querySnapshot.docs.map(doc => {
          const data = doc.data() as Omit<SalesOrder, 'id'>;
          
          // Calculate balance amount properly
          const totalAmount = data.totalAmount || data.total || data.totalPayable || 0;
          const paidAmount = data.paymentAmount || 0;
          const balanceAmount = totalAmount - paidAmount;
          
          return { 
            id: doc.id, 
            ...data,
            balanceAmount: balanceAmount, // Add the calculated balance
            saleDate: this.convertTimestampToDate(data.saleDate),
            paidOn: this.convertTimestampToDate(data.paidOn),
            createdAt: this.convertTimestampToDate(data.createdAt),
            updatedAt: this.convertTimestampToDate(data.updatedAt),
            completedAt: this.convertTimestampToDate(data.completedAt)
          };
        });
        observer.next(sales);
      });

      return () => unsubscribe();
    });
  }


  async getGrossOutputTaxForBalanceSheet(startDate: Date, endDate: Date): Promise<number> {
    try {
        const salesRef = collection(this.firestore, 'sales');
        const q = query(
            salesRef,
            // CRITICAL: We query by 'status' to include ALL completed sales,
            // regardless of their payment status (Paid, Due, Partial).
            where('status', '==', 'Completed'),
            where('completedAt', '>=', Timestamp.fromDate(startDate)),
            where('completedAt', '<=', Timestamp.fromDate(endDate))
        );

        const querySnapshot = await getDocs(q);
        let totalTax = 0;

        querySnapshot.forEach(doc => {
            const data = doc.data();
            // Directly sum the pre-calculated tax fields. This is the most reliable way.
            // Use 'totalTax' as the primary field, with a fallback to 'taxAmount'.
            const saleTax = Number(data['totalTax']) || Number(data['taxAmount']) || 0;
            totalTax += saleTax;
        });

        console.log(`[Balance Sheet] Gross Output Tax from Sales (Direct Sum): ₹${totalTax.toFixed(2)}`);
        return totalTax;
    } catch (error) {
        console.error('Error fetching gross output tax for balance sheet:', error);
        return 0; // Return 0 on error to prevent breaking calculations.
    }
}
private _calculateSaleTaxes(saleData: any): { 
  productTaxAmount: number, 
  shippingTaxAmount: number, 
  packingTaxAmount: number,
  totalTax: number 
} {
    let productTaxAmount = 0;
    
    // Calculate product tax from the products array
    if (saleData.products && Array.isArray(saleData.products)) {
        productTaxAmount = saleData.products.reduce((sum: number, product: any) => {
            return sum + (Number(product.taxAmount) || 0);
        }, 0);
    }

    // Calculate shipping tax
    const shippingCharges = Number(saleData.shippingCharges) || 0;
    const shippingTaxRate = Number(saleData.orderTax) || 18; // Default to 18%
    const shippingTaxAmount = shippingCharges * (shippingTaxRate / 100);

    // ======================= THE FIX =======================
    // Calculate packing tax as the difference between the final charge and the base amount
    let packingTaxAmount = 0;

    // Handle COD Data
    if (saleData.codData && saleData.codData.packingCharge && saleData.codData.packingBeforeTax) {
        const finalCharge = Number(saleData.codData.packingCharge) || 0;
        const baseAmount = Number(saleData.codData.packingBeforeTax) || 0;

        // The tax is the difference, ensuring it's not negative
        if (finalCharge > baseAmount) {
            packingTaxAmount += (finalCharge - baseAmount);
        }
    }

    // Handle PP Service Data with the same logic for consistency
    if (saleData.ppServiceData && saleData.ppServiceData.packingCharge && saleData.ppServiceData.packingBeforeTax) {
        const finalCharge = Number(saleData.ppServiceData.packingCharge) || 0;
        const baseAmount = Number(saleData.ppServiceData.packingBeforeTax) || 0;
        
        if (finalCharge > baseAmount) {
            packingTaxAmount += (finalCharge - baseAmount);
        }
    }
    // ===================== END OF THE FIX ====================

    const totalTax = productTaxAmount + shippingTaxAmount + packingTaxAmount;

    console.log('Server-Side Tax Calculation:', {
        productTaxAmount: productTaxAmount.toFixed(2),
        shippingTaxAmount: shippingTaxAmount.toFixed(2),
        packingTaxAmount: packingTaxAmount.toFixed(2), // This will now show the correct value (e.g., 7.63)
        totalTax: totalTax.toFixed(2)
    });

    return {
        productTaxAmount: parseFloat(productTaxAmount.toFixed(2)),
        shippingTaxAmount: parseFloat(shippingTaxAmount.toFixed(2)),
        packingTaxAmount: parseFloat(packingTaxAmount.toFixed(2)), // This will be saved correctly
        totalTax: parseFloat(totalTax.toFixed(2))
    };
}
// src/app/services/sale.service.ts



/**
 * ✅ FIXED: Ensures Return values also use the Derived Taxable logic.
 */
async getTotalSalesReturnsWithoutTaxByDateRange(startDate: Date, endDate: Date): Promise<number> {
    try {
        const returnsRef = collection(this.firestore, 'returns');
        const q = query(
            returnsRef,
            where('returnDate', '>=', Timestamp.fromDate(startDate)),
            where('returnDate', '<=', Timestamp.fromDate(endDate))
        );

        const querySnapshot = await getDocs(q);
        let totalReturnedValue = 0;

        querySnapshot.forEach(doc => {
            const ret = doc.data();
            if (ret['returnedItems'] && Array.isArray(ret['returnedItems'])) {
                const docValue = ret['returnedItems'].reduce((sum: number, item: any) => {
                    const qty = Number(item.quantity) || 0;
                    const disc = Number(item.discount) || 0;
                    const taxRate = Number(item.taxRate) || 0;
                    const mrp = Number(item.unitPrice) || 0;

                    const lineTotal = (mrp * qty) - disc;
                    const taxable = lineTotal / (1 + (taxRate / 100));
                    return sum + taxable;
                }, 0);
                totalReturnedValue += docValue;
            }
        });
        
        return parseFloat(totalReturnedValue.toFixed(2));
    } catch (error) {
        console.error('Error fetching return taxable values:', error);
        return 0;
    }
}
// UPDATED METHOD in sale.service.ts
// This replaces the existing getTotalSalesWithoutTaxByDateRange method

// CORRECTED METHOD in sale.service.ts
// Replace the existing getTotalSalesWithoutTaxByDateRange method with this version

// In sale.service.ts - Fix updateDailySnapshotsAfterSale method
// Add/Replace these methods in sale.service.ts

/**
 * ✅ FIXED: Get Gross Output Tax (before returns)
 * This is the total tax collected from all sales
 */
async getGrossOutputTaxByDateRange(startDate: Date, endDate: Date): Promise<number> {
  try {
    const salesRef = collection(this.firestore, 'sales');
    
    // Query ALL sales that were completed (including those later returned)
    const q = query(
      salesRef,
      where('status', 'in', ['Completed', 'Partial Return', 'Returned']),
      where('saleDate', '>=', Timestamp.fromDate(startDate)),
      where('saleDate', '<=', Timestamp.fromDate(endDate))
    );

    const querySnapshot = await getDocs(q);
    let totalTax = 0;

    querySnapshot.forEach(doc => {
      const data = doc.data();
      
      // Use the stored tax fields (most reliable)
      const productTax = Number(data['productTaxAmount']) || 0;
      const shippingTax = Number(data['shippingTaxAmount']) || 0;
      const packingTax = Number(data['packingTaxAmount']) || 0;
      
      const saleTotalTax = productTax + shippingTax + packingTax;
      
      // Fallback to totalTax field if components not available
      const finalTax = saleTotalTax > 0 ? saleTotalTax : (Number(data['totalTax']) || Number(data['taxAmount']) || 0);
      
      totalTax += finalTax;
      
      console.log(`Sale ${data['invoiceNo']}: Tax = ₹${finalTax.toFixed(2)}`);
    });

    console.log(`📊 Gross Output Tax (Sales): ₹${totalTax.toFixed(2)}`);
    return parseFloat(totalTax.toFixed(2));

  } catch (error) {
    console.error('❌ Error fetching gross output tax:', error);
    return 0;
  }
}

async addSale(saleData: Omit<SalesOrder, 'id'>): Promise<string> {
    try {
      // Validation
      if (!saleData.products || saleData.products.length === 0) {
        throw new Error('Sale must contain at least one product');
      }

      // POS AUTO-COMPLETE
      const isPOSSale = saleData.invoiceNo?.startsWith('POS') && !saleData.invoiceNo.includes('-');
      
      if (isPOSSale) {
        saleData.orderStatus = 'Completed';
        saleData.shippingStatus = 'N/A';
        saleData.status = 'Completed';
      }

      // Ensure saleDate is properly set
      if (!saleData.saleDate) {
        saleData.saleDate = new Date();
      }

      // ATOMIC TRANSACTION
      const saleId = await runTransaction(this.firestore, async (transaction) => {
        const saleRef = doc(collection(this.firestore, 'sales'));
        const locationId = saleData.businessLocationId || saleData.businessLocation || 'default';

        // READ PHASE - Stock
        const stockSnapshots: { ref: DocumentReference; currentStock: number; productId: string; qtySold: number }[] = [];
        
        if (saleData.status === 'Completed') {
          for (const product of saleData.products || []) {
            const productId = product.productId || product.id;
            if (!productId) continue;

            const stockRef = doc(this.firestore, 'product-stock', `${productId}_${locationId}`);
            const stockSnap = await transaction.get(stockRef);
            
            stockSnapshots.push({
              ref: stockRef,
              currentStock: stockSnap.exists() ? Number(stockSnap.data()['quantity'] || 0) : 0,
              productId: productId,
              qtySold: Number(product.quantity) || 0
            });
          }
        }

        // READ PHASE - Accounts
        const accountReadsMap = new Map<string, string>();
        const accountIdsToRead = new Set<string>();

        if (saleData.payments && Array.isArray(saleData.payments) && saleData.payments.length > 0) {
          saleData.payments.forEach(p => {
            if (p.accountId) accountIdsToRead.add(p.accountId);
          });
        } else if (saleData.paymentAccountId) {
          accountIdsToRead.add(saleData.paymentAccountId);
        }

        for (const accountId of accountIdsToRead) {
          const accountRef = doc(this.firestore, 'accounts', accountId);
          const accountSnap = await transaction.get(accountRef);
          const accountName = accountSnap.exists() ? accountSnap.data()['name'] : 'Unknown Account';
          accountReadsMap.set(accountId, accountName);
        }

        // CALCULATIONS
        const paidAmount = Number(saleData.paymentAmount) || 0;
        const totalAmount = Number(saleData.totalAmount || saleData.total || saleData.totalPayable) || 0;
        const balanceAmount = totalAmount - paidAmount;

        const productTax = (saleData.products || []).reduce((sum, p) => sum + (Number(p.taxAmount) || 0), 0);
        const shippingCharges = Number(saleData.shippingCharges) || 0;
        const shippingTaxRate = Number(saleData.orderTax) || 0;
        const shippingTax = shippingCharges * (shippingTaxRate / 100);

        let packingTax = 0;
        const packingBeforeTax = Number(saleData.codData?.packingBeforeTax || saleData.ppServiceData?.packingBeforeTax || 0);
        const packingAfterTax = Number(saleData.codData?.packingCharge || saleData.ppServiceData?.packingCharge || 0);
        
        if (packingBeforeTax > 0 && packingAfterTax > packingBeforeTax) {
          packingTax = packingAfterTax - packingBeforeTax;
        }

        const totalTax = productTax + shippingTax + packingTax;
        
        // --- FIX START: Calculate Total Before Tax for P&L ---
        const totalBeforeTax = Math.max(0, totalAmount - totalTax);

        // Update products with priceBeforeTax if missing
        const updatedProducts = (saleData.products || []).map(p => {
           const unitPrice = Number(p.unitPrice) || 0;
           const taxRate = Number(p.taxRate) || 0;
           let priceBeforeTax = Number(p.priceBeforeTax) || 0;
           
           if (!priceBeforeTax && unitPrice > 0) {
              priceBeforeTax = taxRate > 0 ? unitPrice / (1 + (taxRate / 100)) : unitPrice;
           }
           return { ...p, priceBeforeTax: Number(priceBeforeTax.toFixed(2)) };
        });
        // --- FIX END ---

        // Date handling
        let effectiveDate = new Date();
        if (saleData.paidOn) {
            let pDate: Date;
            if (saleData.paidOn instanceof Timestamp) {
                pDate = saleData.paidOn.toDate();
            } else if (typeof saleData.paidOn === 'string') {
                pDate = new Date(saleData.paidOn);
            } else {
                pDate = saleData.paidOn;
            }
            if (!isNaN(pDate.getTime())) {
                const now = new Date();
                pDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
                effectiveDate = pDate;
            }
        }

        const saleDateToUse = saleData.saleDate instanceof Date 
            ? saleData.saleDate 
            : new Date(saleData.saleDate);

        const finalSaleData: any = {
          ...saleData,
          products: updatedProducts, // Use updated products array
          saleDate: Timestamp.fromDate(saleDateToUse),
          paidOn: effectiveDate,
          productTaxAmount: Number(productTax.toFixed(2)),
          shippingTaxAmount: Number(shippingTax.toFixed(2)),
          packingTaxAmount: Number(packingTax.toFixed(2)),
          totalTax: Number(totalTax.toFixed(2)),
          taxAmount: Number(totalTax.toFixed(2)),
          
          // CRITICAL FIELD FOR P&L
          totalBeforeTax: Number(totalBeforeTax.toFixed(2)), 
          
          balanceAmount: Number(balanceAmount.toFixed(2)),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        if (finalSaleData.status === 'Completed') {
          finalSaleData.completedAt = serverTimestamp();
        }

        // WRITE PHASE - Save Sale
        transaction.set(saleRef, finalSaleData);

        // WRITE PHASE - Stock Reduction
        if (finalSaleData.status === 'Completed') {
          for (const s of stockSnapshots) {
            transaction.set(
              s.ref,
              { quantity: s.currentStock - s.qtySold, lastUpdated: serverTimestamp() },
              { merge: true }
            );
          }
        }

        // WRITE PHASE - Ledger Updates
        if (finalSaleData.status === 'Completed') {
          const saleIdForLedger = saleRef.id;
          const accountBookRef = collection(this.firestore, 'accountBookTransactions');

          if (finalSaleData.payments && Array.isArray(finalSaleData.payments) && finalSaleData.payments.length > 0) {
            for (const [index, payment] of finalSaleData.payments.entries()) {
              if (!payment.amount || Number(payment.amount) <= 0 || !payment.accountId) continue;

              const accountName = accountReadsMap.get(payment.accountId) || 'Unknown Account';
              
              const transactionData = {
                accountId: payment.accountId,
                accountName: accountName,
                date: effectiveDate,
                transactionTime: effectiveDate,
                description: `Sale: ${finalSaleData.invoiceNo || saleIdForLedger} (${payment.method || 'Split Payment'})`,
                credit: Number(payment.amount),
                debit: 0,
                reference: `${finalSaleData.invoiceNo || saleIdForLedger}-${index + 1}`,
                paymentDetails: `${finalSaleData.invoiceNo || saleIdForLedger}-${index + 1}`,
                relatedDocId: saleIdForLedger,
                source: 'sale',
                type: 'sale',
                paymentMethod: payment.method || 'Split Payment',
                customerName: finalSaleData.customer || '',
                note: `Split payment ${index + 1} for Invoice #${finalSaleData.invoiceNo || saleIdForLedger}`,
                createdAt: effectiveDate,
                updatedAt: serverTimestamp(),
                saleStatus: 'Completed',
                hasReturns: false,
                isSplitPayment: true,
                saleId: saleIdForLedger
              };

              const newTransactionRef = doc(accountBookRef);
              transaction.set(newTransactionRef, transactionData);

              const accountRef = doc(this.firestore, 'accounts', payment.accountId);
              transaction.update(accountRef, { 
                currentBalance: increment(Number(payment.amount)),
                balanceUpdatedAt: serverTimestamp()
              });
            }
          } else {
            const paymentAccountId = finalSaleData.paymentAccountId || finalSaleData.paymentAccount;
            const paymentAmount = Number(finalSaleData.paymentAmount) || 0;
            
            if (paymentAccountId && paymentAmount > 0) {
              const accountName = accountReadsMap.get(paymentAccountId) || 'Unknown Account';

              const transactionData = {
                accountId: paymentAccountId,
                accountName: accountName,
                date: effectiveDate,
                transactionTime: effectiveDate,
                description: `Sale: ${finalSaleData.invoiceNo || saleIdForLedger}`,
                credit: paymentAmount,
                debit: 0,
                reference: finalSaleData.invoiceNo || saleIdForLedger,
                paymentDetails: finalSaleData.invoiceNo || saleIdForLedger,
                relatedDocId: saleIdForLedger,
                source: 'sale',
                type: 'sale',
                paymentMethod: finalSaleData.paymentMethod || 'Cash',
                customerName: finalSaleData.customer || '',
                note: `Payment for Invoice #${finalSaleData.invoiceNo || saleIdForLedger}`,
                createdAt: effectiveDate,
                updatedAt: serverTimestamp(),
                saleStatus: 'Completed',
                hasReturns: false,
                isSplitPayment: false,
                saleId: saleIdForLedger
              };

              const newTransactionRef = doc(accountBookRef);
              transaction.set(newTransactionRef, transactionData);

              const accountRef = doc(this.firestore, 'accounts', paymentAccountId);
              transaction.update(accountRef, { 
                currentBalance: increment(paymentAmount),
                balanceUpdatedAt: serverTimestamp()
              });
            }
          }
        }

        return saleRef.id;
      });

      // POST-TRANSACTION: Update P&L Daily Snapshots
      if (saleId && saleData.status === 'Completed' && saleData.products) {
        const locationId = saleData.businessLocationId || saleData.businessLocation || 'default';
        
        console.log(`✅ Sale ${saleId} completed. Updating daily snapshots for P&L...`);
        
        // This calculates closing stock properly
        await this.updateDailySnapshotsAfterSale(
          saleId,
          saleData.products,
          locationId
        );
      }

      this.notifySalesUpdated();
      return saleId;

    } catch (error) {
      console.error('❌ Error adding sale:', error);
      throw error;
    }
  }
async getAllSalesTaxByDateRange(startDate: Date, endDate: Date): Promise<{
  totalProductTax: number;
  totalShippingTax: number;
  totalTax: number;
}> {
  try {
    const salesRef = collection(this.firestore, 'sales');
    
    // ======================= THE FIX =======================
    // The query now includes 'Completed', 'Partial Return', and 'Returned' statuses.
    // This ensures we get the ORIGINAL tax liability from every sale, before
    // we subtract the tax from the returns. This is the main fix.
    const q = query(
      salesRef,
      where('saleDate', '>=', Timestamp.fromDate(startDate)),
      where('saleDate', '<=', Timestamp.fromDate(endDate)),
      where('status', 'in', ['Completed', 'Partial Return', 'Returned']) 
    );
    // ===================== END OF THE FIX ====================

    const querySnapshot = await getDocs(q);
    
    let totalProductTax = 0;
    let totalShippingTax = 0;

    querySnapshot.forEach(doc => {
      const data = doc.data();
      const productTax = Number(data['productTaxAmount']) || 0;
      const shippingTax = Number(data['shippingTaxAmount']) || 0;

      totalProductTax += productTax;
      totalShippingTax += shippingTax;
    });

    const totalTax = totalProductTax + totalShippingTax;

    return {
      totalProductTax: parseFloat(totalProductTax.toFixed(2)),
      totalShippingTax: parseFloat(totalShippingTax.toFixed(2)),
      totalTax: parseFloat(totalTax.toFixed(2))
    };

  } catch (error) {
    console.error('Error fetching all sales tax data:', error);
    return { totalProductTax: 0, totalShippingTax: 0, totalTax: 0 };
  }
}
// in src/app/services/sale.service.ts

/**
 * [FIXED FOR BALANCE SHEET]
 * Calculates the total gross output tax (product tax + shipping tax) from all 'Completed' sales.
 * This method is the definitive source for calculating tax liability from sales.
 * It directly sums the tax fields from sale documents, which is more reliable than
 * subtracting grand totals, and correctly includes credit sales.
 * @param startDate The start of the date range.
 * @param endDate The end of the date range.
 * @returns A promise that resolves to the total gross output tax.
 */
// in src/app/services/sale.service.ts

/**
 * [FIXED FOR BALANCE SHEET]
 * Calculates the total gross output tax (product tax + shipping tax) from all 'Completed' sales.
 * This method is the definitive source for calculating tax liability from sales.
 * It directly sums the tax fields from sale documents, which is more reliable than
 * subtracting grand totals, and correctly includes credit sales.
 * @param startDate The start of the date range.
 * @param endDate The end of the date range.
 * @returns A promise that resolves to the total gross output tax.
 */
// in src/app/services/sale.service.ts

/**
 * [FIXED FOR BALANCE SHEET]
 * Calculates the total gross output tax (product tax + shipping tax) from all 'Completed' sales.
 * This method is the definitive source for calculating tax liability from sales.
 * It directly sums the tax fields from sale documents, which is more reliable than
 * subtracting grand totals, and correctly includes credit sales.
 * @param startDate The start of the date range.
 * @param endDate The end of the date range.
 * @returns A promise that resolves to the total gross output tax.
 */
// In src/app/services/sale.service.ts

private calculateReturnTaxAmount(returnedItems: any[], originalSale: any): number {
    try {
        let totalReturnTax = 0;

        returnedItems.forEach((item: any) => {
            const returnQuantity = Number(item['quantity']) || 0;
            const unitPriceWithTax = Number(item['unitPrice']) || 0; // This is MRP (inclusive of tax)
            const discount = Number(item['discount']) || 0;
            const taxRate = Number(item['taxRate']) || 0;

            if (returnQuantity === 0 || unitPriceWithTax === 0) {
                return; // Skip items with no value
            }

            // ======================= THE FIX =======================
            // 1. Calculate the price BEFORE tax from the MRP (unitPriceWithTax)
            const priceBeforeTax = unitPriceWithTax / (1 + (taxRate / 100));

            // 2. Calculate the total taxable value for the returned quantity, after discount
            const totalValueBeforeTax = priceBeforeTax * returnQuantity;
            const taxableValue = totalValueBeforeTax - discount;

            // 3. Calculate the item's tax amount based on the correct taxable value
            const itemTaxAmount = taxableValue * (taxRate / 100);
            // ===================== END OF THE FIX ====================

            totalReturnTax += itemTaxAmount;
        });

        // Also account for shipping tax if it's a full return
        const isFullReturn = this.determineIfFullReturn(originalSale, returnedItems);
        if (isFullReturn && originalSale['shippingCharges']) {
            const shippingTax = Number(originalSale['shippingCharges']) * ((Number(originalSale['orderTax']) || 18) / 100);
            totalReturnTax += shippingTax;
        }

        return Math.max(0, totalReturnTax);
    } catch (error) {
        console.error('Error calculating return tax amount:', error);
        return 0;
    }
}


async getNetShippingIncomeForProfitLoss(startDate: Date, endDate: Date): Promise<number> {
    try {
      const salesRef = collection(this.firestore, 'sales');
      const q = query(
          salesRef,
          where('status', 'in', ['Completed', 'Partial Return', 'Returned']),
          where('saleDate', '>=', Timestamp.fromDate(startDate)),
          where('saleDate', '<=', Timestamp.fromDate(endDate))
      );
      
      const [salesSnapshot, allReturnsInPeriod] = await Promise.all([
        getDocs(q),
        this.getReturnsByDateRange(startDate, endDate) 
      ]);

      // ======================= THE FIX =======================
      // Explicitly cast the sale objects to the 'SalesOrder' type to resolve TypeScript errors.
      const allSalesInPeriod = salesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SalesOrder));
      // ===================== END OF THE FIX ====================

      const grossSalesShipping = allSalesInPeriod.reduce((sum, sale) => 
        sum + (Number(sale.shippingCharges) || 0), 0);
      
      let totalShippingToReverse = 0;
      for (const sale of allSalesInPeriod) {
        if ((Number(sale.shippingCharges) || 0) > 0) {
          if (this.checkIfSaleIsFullyReturned(sale, allReturnsInPeriod)) {
            totalShippingToReverse += (Number(sale.shippingCharges) || 0);
          }
        }
      }
      
      const netSalesShippingIncome = grossSalesShipping - totalShippingToReverse;
      
      console.log(`P&L Net Shipping Income: Gross=₹${grossSalesShipping.toFixed(2)}, Reversed for Full Returns=₹${totalShippingToReverse.toFixed(2)}, Net=₹${netSalesShippingIncome.toFixed(2)}`);
      
      return Math.max(0, netSalesShippingIncome);
      
    } catch (error) {
      console.error('Error calculating net shipping income:', error);
      return 0;
    }
}

// In src/app/services/sale.service.ts
// Add this new method to the SaleService class

/**
 * [NEW METHOD FOR P&L REPORT]
 * Calculates the net service charge income (from COD/PP packing charges).
 * This method correctly reverses charges for sales that are fully returned.
 * @param startDate The start of the date range.
 * @param endDate The end of the date range.
 * @returns A promise that resolves to the net service charge income.
 */
// In src/app/services/sale.service.ts

/**
 * [NEW METHOD FOR P&L REPORT]
 * Calculates the net service charge income (from COD/PP packing charges).
 * This version also uses 'saleDate' for consistent financial reporting.
 */
// in src/app/services/sale.service.ts

// in src/app/services/sale.service.ts

async getTotalServiceChargesByDateRange(startDate: Date, endDate: Date): Promise<number> {
    try {
      const salesRef = collection(this.firestore, 'sales');
      const q = query(
          salesRef,
          where('status', 'in', ['Completed', 'Partial Return', 'Returned']),
          where('saleDate', '>=', Timestamp.fromDate(startDate)),
          where('saleDate', '<=', Timestamp.fromDate(endDate))
      );
      
      const [salesSnapshot, allReturnsInPeriod] = await Promise.all([
        getDocs(q),
        this.getReturnsByDateRange(startDate, endDate)
      ]);

      // ======================= THE FIX =======================
      // Explicitly cast the sale objects to the 'SalesOrder' type.
      const allSalesInPeriod = salesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SalesOrder));
      // ===================== END OF THE FIX ====================

      const grossServiceCharges = allSalesInPeriod.reduce((sum, sale) => 
        // Use 'as any' because 'serviceCharge' is not defined on the SalesOrder interface.
        sum + (Number((sale as any).serviceCharge) || 0), 0);
      
      let totalServiceChargesToReverse = 0;
      for (const sale of allSalesInPeriod) {
        if ((Number((sale as any).serviceCharge) || 0) > 0) {
          if (this.checkIfSaleIsFullyReturned(sale, allReturnsInPeriod)) {
            totalServiceChargesToReverse += (Number((sale as any).serviceCharge) || 0);
          }
        }
      }
      
      const netServiceChargeIncome = grossServiceCharges - totalServiceChargesToReverse;
      
      console.log(`P&L Service Charges: Gross=₹${grossServiceCharges.toFixed(2)}, Reversed=₹${totalServiceChargesToReverse.toFixed(2)}, Net=₹${netServiceChargeIncome.toFixed(2)}`);
      
      return Math.max(0, netServiceChargeIncome);
      
    } catch (error) {
      console.error('Error calculating net service charges:', error);
      return 0;
    }
}




// Add this temporary debug method to sale.service.ts
async debugCheckSales(startDate: Date, endDate: Date): Promise<void> {
    const salesRef = collection(this.firestore, 'sales');
    const q = query(
        salesRef,
        where('saleDate', '>=', Timestamp.fromDate(startDate)),
        where('saleDate', '<=', Timestamp.fromDate(endDate))
    );
    
    const snapshot = await getDocs(q);
    console.log('=== SALES DEBUG ===');
    console.log(`Total sales found: ${snapshot.size}`);
    
    snapshot.forEach(doc => {
        const data = doc.data();
        console.log({
            id: doc.id,
            invoiceNo: data['invoiceNo'],
            status: data['status'],
            saleDate: data['saleDate']?.toDate(),
            completedAt: data['completedAt']?.toDate(),
            totalAmount: data['totalAmount'],
            products: data['products']?.length || 0
        });
    });
}
async getTotalSalesWithoutTaxByDateRange(startDate: Date, endDate: Date): Promise<number> {
    let grossSalesNoTax = 0;
    let refundedValueNoTax = 0;

    // 1. Calculate Gross Sales (This will work even if returns fail)
    try {
      const salesRef = collection(this.firestore, 'sales');
      // Fix: Query sales based on 'saleDate' (standard approach)
      const qSales = query(
        salesRef,
        where('status', 'in', ['Completed', 'Partial Return', 'Returned']), 
        where('saleDate', '>=', Timestamp.fromDate(startDate)),
        where('saleDate', '<=', Timestamp.fromDate(endDate))
      );

      const salesSnapshot = await getDocs(qSales);

      salesSnapshot.forEach(doc => {
        const data = doc.data();
        
        // Priority 1: Use the calculated field we saved in addSale
        if (data['totalBeforeTax'] !== undefined && data['totalBeforeTax'] !== null) {
           grossSalesNoTax += Number(data['totalBeforeTax']) || 0;
        } 
        // Priority 2: Fallback calculation
        else if (data['products']) {
          const saleSubtotal = data['products'].reduce((sum: number, p: any) => {
            const quantity = Number(p.quantity) || 0; 
            const unitPrice = Number(p.unitPrice) || 0;
            const taxRate = Number(p.taxRate) || 0;
            const discount = Number(p.discount) || 0;

            let priceBeforeTax = 0;
            // Use saved priceBeforeTax or calculate it
            if (p.priceBeforeTax) {
              priceBeforeTax = Number(p.priceBeforeTax);
            } else if (unitPrice > 0 && taxRate > 0) {
              priceBeforeTax = unitPrice / (1 + (taxRate / 100));
            } else {
              priceBeforeTax = unitPrice;
            }

            return sum + (priceBeforeTax * quantity) - discount;
          }, 0);
          
          grossSalesNoTax += saleSubtotal;
        }
      });
    } catch (error) {
      console.error('Error fetching Gross Sales:', error);
    }

    // 2. Calculate Refunds (In a separate try/catch so it doesn't kill Sales)
    try {
      const returnsRef = collection(this.firestore, 'returns');
      
      const qReturns = query(
        returnsRef,
        where('paymentStatus', '==', 'Refunded'), 
        where('refundedAt', '>=', Timestamp.fromDate(startDate)),
        where('refundedAt', '<=', Timestamp.fromDate(endDate))
      );

      const returnsSnapshot = await getDocs(qReturns);

      returnsSnapshot.forEach(doc => {
        const data = doc.data();
        if (data['returnedItems']) {
          const returnSub = data['returnedItems'].reduce((sum: number, item: any) => {
            const qty = Number(item.quantity) || 0;
            const price = Number(item.unitPrice) || 0;
            const taxRate = Number(item.taxRate) || 0;
            const discount = Number(item.discount) || 0;

            // Calculate pre-tax refund value
            const priceBeforeTax = taxRate > 0 ? price / (1 + (taxRate / 100)) : price;
            return sum + (priceBeforeTax * qty) - discount;
          }, 0);
          refundedValueNoTax += returnSub;
        }
      });
    } catch (error) {
      // Log this, but don't return 0 for the whole function!
      console.error('Error fetching Returns (check Indexes in Firebase Console):', error);
    }

    console.log(`📊 P&L Net Sales: Gross ${grossSalesNoTax.toFixed(2)} - Paid Refunds ${refundedValueNoTax.toFixed(2)}`);
    
    return parseFloat((grossSalesNoTax - refundedValueNoTax).toFixed(2));
  }

  private async createAccountBookTransactionForSale(saleId: string): Promise<void> {
    try {
      const saleSnap = await getDoc(doc(this.firestore, 'sales', saleId));
      if (!saleSnap.exists()) return;

      const saleData = saleSnap.data() as SalesOrder;
      
      // Only create transactions for Completed sales
      if (saleData.status !== 'Completed') return;

      // FIX: Ensure dates are actual Date objects before using them
      const safeSaleDate = this.convertTimestampToDate(saleData.saleDate);
      const safeCreatedAt = this.convertTimestampToDate(saleData.createdAt);

      // --- CASE 1: SPLIT PAYMENTS ---
      if (saleData.payments && saleData.payments.length > 0) {
        
        // Loop through each payment and create a separate transaction for each account
        for (const payment of saleData.payments) {
          if (payment.amount > 0 && payment.accountId) {
              
              const transactionData = {
                amount: payment.amount, 
                type: 'sale',
                date: safeSaleDate, // Uses safe date
                transactionTime: safeCreatedAt, // Uses safe date
                description: `Sale: ${saleData.invoiceNo} (${payment.method})`,
                paymentMethod: payment.method, 
                paymentDetails: saleData.invoiceNo,
                note: `Split payment for Invoice #${saleData.invoiceNo}`,
                reference: saleData.invoiceNo,
                relatedDocId: saleId,
                source: 'sale',
                customer: saleData.customer || '',
                customerName: saleData.customer || '',
                
                credit: payment.amount,
                debit: 0,
                
                createdAt: new Date()
              };

              await this.accountService.addTransaction(payment.accountId, transactionData);
          }
        }
      } 
      // --- CASE 2: SINGLE PAYMENT (Fallback) ---
      else {
        const paymentAccountId = saleData.paymentAccountId || saleData.paymentAccount;
        const totalAmount = saleData.paymentAmount || 0;
        
        if (paymentAccountId && totalAmount > 0) {
            const transactionData = {
              amount: totalAmount,
              type: 'sale',
              date: safeSaleDate, // Uses safe date
              transactionTime: safeCreatedAt, // Uses safe date
              description: `Sale: ${saleData.invoiceNo}`,
              paymentMethod: saleData.paymentMethod || 'Cash',
              paymentDetails: saleData.invoiceNo,
              note: `Payment for Invoice #${saleData.invoiceNo}`,
              reference: saleData.invoiceNo,
              relatedDocId: saleId,
              source: 'sale',
              customer: saleData.customer || '',
              customerName: saleData.customer || '',
              credit: totalAmount,
              debit: 0,
              createdAt: new Date()
            };

            await this.accountService.addTransaction(paymentAccountId, transactionData);
        }
      }

    } catch (error) {
      console.error('Error creating account book transaction:', error);
    }
  }

// ... rest of the file



  async getTotalPackingTaxByDateRange(startDate: Date, endDate: Date): Promise<number> {
    try {
        const salesRef = collection(this.firestore, 'sales');
        const q = query(
            salesRef,
            where('status', 'in', ['Completed', 'Partial Return', 'Returned']),
            where('saleDate', '>=', Timestamp.fromDate(startDate)),
            where('saleDate', '<=', Timestamp.fromDate(endDate))
        );
        
        const querySnapshot = await getDocs(q);
        let totalPackingTax = 0;
        
        querySnapshot.forEach(doc => {
            const data = doc.data();
            
            // Method 1: Get the value from the dedicated 'packingTaxAmount' field (most reliable).
            let packingTax = Number(data['packingTaxAmount']) || 0;
            
            // Method 2: For backward compatibility, calculate from COD data if the field doesn't exist.
            if (packingTax === 0 && data['codData']) {
                const codBeforeTax = Number(data['codData']['packingBeforeTax']) || 0;
                const codTaxRate = parseFloat(data['codData']['tax']) || 0;
                packingTax += (codBeforeTax * codTaxRate) / 100;
            }
            
            // Method 3: Also check PP Service data for backward compatibility.
            if (data['ppServiceData']) {
                const ppBeforeTax = Number(data['ppServiceData']['packingBeforeTax']) || 0;
                const ppTaxRate = parseFloat(data['ppServiceData']['tax']) || 0;
                packingTax += (ppBeforeTax * ppTaxRate) / 100;
            }
            
            totalPackingTax += packingTax;
        });
        
        console.log(`[Sale Service] Total Packing Tax successfully calculated: ₹${totalPackingTax.toFixed(2)}`);
        return totalPackingTax;
    } catch (error) {
        console.error('Error fetching total packing tax from sales:', error);
        return 0; // Return 0 on error to avoid breaking the balance sheet.
    }
  }






private checkIfSaleIsFullyReturned(sale: any, allReturns: any[]): boolean {
    if (!sale.products || sale.products.length === 0) {
        return false;
    }

    // Find all return documents linked to this specific sale.
    const relevantReturns = allReturns.filter(r => r.originalSaleId === sale.id);

    if (relevantReturns.length === 0) {
        return false;
    }

    // Create a map to track the cumulative returned quantity for each product.
    const returnedQuantities = new Map<string, number>();
    for (const ret of relevantReturns) {
        if (ret.returnedItems && Array.isArray(ret.returnedItems)) {
            for (const item of ret.returnedItems) {
                const productId = item.productId || item.id;
                if (productId) {
                    const currentReturnedQty = returnedQuantities.get(productId) || 0;
                    returnedQuantities.set(productId, currentReturnedQty + (item.quantity || 0));
                }
            }
        }
    }
    
    // Check if the cumulative returned quantity for EACH product matches the original quantity sold.
    for (const originalProduct of sale.products) {
        const productId = originalProduct.productId || originalProduct.id;
        const originalQty = Number(originalProduct.quantity) || 0;
        const totalReturnedQty = returnedQuantities.get(productId) || 0;

        // If even one product has a returned quantity less than what was sold, the sale is not fully returned.
        if (totalReturnedQty < originalQty) {
            return false;
        }
    }

    // If the loop completes, it means every product was fully returned.
    console.log(`P&L Check: Sale ${sale.invoiceNo} is confirmed as fully returned.`);
    return true;
}
  private convertTimestampToDate(timestamp: any): Date {
    if (!timestamp) return new Date();
    if (timestamp instanceof Date) return timestamp;
    if (timestamp && typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }
    if (typeof timestamp === 'string' || typeof timestamp === 'number') {
      const date = new Date(timestamp);
      return isNaN(date.getTime()) ? new Date() : date;
    }
    return new Date();
  }



  async getTotalSalesByDateRange(startDate: Date, endDate: Date): Promise<number> {
    try {
      const salesRef = collection(this.firestore, 'sales');
      // ======================= THE FIX =======================
      // The query now uses `completedAt` to ensure consistency with the
      // `getTotalSalesWithoutTaxByDateRange` method. This prevents discrepancies.
      const q = query(
        salesRef,
        where('status', '==', 'Completed'),
        where('completedAt', '>=', Timestamp.fromDate(startDate)),
        where('completedAt', '<=', Timestamp.fromDate(endDate))
      );
      // ===================== END OF THE FIX ====================
      
      const querySnapshot = await getDocs(q);
      
      const totalSales = querySnapshot.docs.reduce((sum, doc) => {
        const data = doc.data();
        const saleAmount = data['totalAmount'] || data['totalPayable'] || data['total'] || 0;
        return sum + Number(saleAmount);
      }, 0);

      return totalSales;
    } catch (error) {
      console.error('Error fetching total sales by date range:', error);
      return 0;
    }
  }

  /**
   * [FIXED METHOD FOR TRIAL BALANCE] 
   * Fetches total sales value *before tax* within a date range.
   * This robust version correctly calculates the pre-tax amount to ensure accuracy.
   */

  // Get sales by contact number with proper balance calculation
  getSalesByContactNumber(contactNumber: string): Observable<SalesOrder[]> {
    return new Observable<SalesOrder[]>(observer => {
      const salesRef = collection(this.firestore, 'sales');
      const q = query(
        salesRef,
        where('customerPhone', '==', contactNumber),
        orderBy('saleDate', 'desc')
      );

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const sales = querySnapshot.docs.map(doc => {
          const data = doc.data();
          
          // Calculate balance amount properly
          const totalAmount = data['totalAmount'] || data['total'] || data['totalPayable'] || 0;
          const paidAmount = data['paymentAmount'] || 0;
          const balanceAmount = totalAmount - paidAmount;
          
          return { 
            id: doc.id,
            ...data,
            balanceAmount: balanceAmount, // Add the calculated balance
            saleDate: this.convertTimestampToDate(data['saleDate']),
            paidOn: this.convertTimestampToDate(data['paidOn']),
            createdAt: this.convertTimestampToDate(data['createdAt']),
            updatedAt: this.convertTimestampToDate(data['updatedAt']),
            completedAt: this.convertTimestampToDate(data['completedAt'])
          } as SalesOrder;
        });
        observer.next(sales);
      }, (error) => {
        observer.error(error);
      });

      return () => unsubscribe();
    });
  }

  async addSalesStockPriceLog(logEntries: SalesStockPriceLog[]): Promise<void> {
    try {
      const batch = writeBatch(this.firestore);
      const logCollection = collection(this.firestore, 'sales-stock-price-log');

      logEntries.forEach(logEntry => {
        const docRef = doc(logCollection);
        batch.set(docRef, {
          ...logEntry,
          createdAt: new Date()
        });
      });

      await batch.commit();
      console.log('Sales stock price log entries saved successfully');
    } catch (error) {
      console.error('Error saving sales stock price log:', error);
      throw error;
    }
  }

  createSalesStockPriceLogEntries(saleData: any, saleId: string): SalesStockPriceLog[] {
    const logEntries: SalesStockPriceLog[] = [];
    
    if (!saleData.products || saleData.products.length === 0) {
      return logEntries;
    }

    saleData.products.forEach((product: any) => {
      const logEntry: SalesStockPriceLog = {
        saleId: saleId,
        invoiceNo: saleData.invoiceNo || '',
        productId: product.id || product.productId || '',
        productName: product.name || product.productName || '',
        quantity: product.quantity || 0,
        sellingPrice: product.unitPrice || 0,
        location: saleData.businessLocation || saleData.location || '',
        paymentAccountId: saleData.paymentAccountId || saleData.paymentAccount || '',
        paymentType: saleData.paymentMethod || '',
        taxRate: product.taxRate || 0,
        packingCharge: saleData.ppServiceData?.packingCharge || saleData.codData?.packingCharge || 0,
        shippingCharge: saleData.shippingCharges || 0,
        saleCreatedDate: saleData.saleDate || new Date(),
        createdAt: new Date()
      };
      
      logEntries.push(logEntry);
    });

    return logEntries;
  }

  notifySalesUpdated() {
    this.salesUpdated.next();
  }

  notifyStockUpdated() {
    this.stockUpdatedSource.next();
  }

  getShippedSales(): Observable<any[]> {
    return this['afs'].collection('sales', (ref: { where: (arg0: string, arg1: string, arg2: string) => { (): any; new(): any; orderBy: { (arg0: string, arg1: string): any; new(): any; }; }; }) => 
      ref.where('shippingStatus', '==', 'Shipped')
         .orderBy('shippingDate', 'desc')
    ).valueChanges({ idField: 'id' });
  }

getSalesByPaymentAccount(accountId: string): Observable<any[]> {
  return new Observable(observer => {
    const salesRef = collection(this.firestore, 'sales');
    
    // *** FIX START: Execute two queries and merge results ***
    // Query 1: Sales where paymentAccount matches
    const q1 = query(
      salesRef,
      where('paymentAccount', '==', accountId),
      where('status', 'in', ['Completed', 'Returned', 'Partial Return']),
      orderBy('saleDate', 'desc')
    );
    
    // Query 2: Sales where account is in paymentAccountIds array
    const q2 = query(
      salesRef,
      where('paymentAccountIds', 'array-contains', accountId),
      where('status', 'in', ['Completed', 'Returned', 'Partial Return']),
      orderBy('saleDate', 'desc')
    );
    
    // Subscribe to both queries and merge results
    let results1: any[] = [];
    let results2: any[] = [];
    let completed = 0;

    const unsubscribe1 = onSnapshot(q1, 
      (querySnapshot) => {
        results1 = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            saleDate: this.convertTimestampToDate(data['saleDate']),
            paidOn: this.convertTimestampToDate(data['paidOn']),
            createdAt: this.convertTimestampToDate(data['createdAt']),
            updatedAt: this.convertTimestampToDate(data['updatedAt']),
            completedAt: this.convertTimestampToDate(data['completedAt']),
            paymentAccountName: data['paymentAccountName'] || 'Unknown Account'
          };
        });
        completed++;
        if (completed === 2) {
          // Merge and deduplicate by ID
          const mergedMap = new Map<string, any>();
          results1.forEach(sale => mergedMap.set(sale.id, sale));
          results2.forEach(sale => mergedMap.set(sale.id, sale));
          observer.next(Array.from(mergedMap.values()));
        }
      },
      (error) => {
        console.error('Error fetching sales by payment account (query 1):', error);
        observer.error(error);
      }
    );

    const unsubscribe2 = onSnapshot(q2, 
      (querySnapshot) => {
        results2 = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            saleDate: this.convertTimestampToDate(data['saleDate']),
            paidOn: this.convertTimestampToDate(data['paidOn']),
            createdAt: this.convertTimestampToDate(data['createdAt']),
            updatedAt: this.convertTimestampToDate(data['updatedAt']),
            completedAt: this.convertTimestampToDate(data['completedAt']),
            paymentAccountName: data['paymentAccountName'] || 'Unknown Account'
          };
        });
        completed++;
        if (completed === 2) {
          // Merge and deduplicate by ID
          const mergedMap = new Map<string, any>();
          results1.forEach(sale => mergedMap.set(sale.id, sale));
          results2.forEach(sale => mergedMap.set(sale.id, sale));
          observer.next(Array.from(mergedMap.values()));
        }
      },
      (error) => {
        console.error('Error fetching sales by payment account (query 2):', error);
        observer.error(error);
      }
    );
    // *** FIX END ***

    return () => {
      unsubscribe1();
      unsubscribe2();
    };
  });
}




  getSalesWithAccountInfo(): Observable<any[]> {
    return new Observable(observer => {
      const salesRef = collection(this.firestore, 'sales');
      const q = query(
        salesRef, 
        where('status', '==', 'Completed'), // FIXED: Only get completed sales
        orderBy('saleDate', 'desc')
      );

      const unsubscribe = onSnapshot(q, 
        (querySnapshot) => {
          const sales = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              saleDate: this.convertTimestampToDate(data['saleDate']),
              paidOn: this.convertTimestampToDate(data['paidOn']),
              createdAt: this.convertTimestampToDate(data['createdAt']),
              updatedAt: this.convertTimestampToDate(data['updatedAt']),
              completedAt: this.convertTimestampToDate(data['completedAt'])
            };
          });
          observer.next(sales);
        },
        (error) => {
          console.error('Error fetching sales with account info:', error);
          observer.error(error);
        }
      );

      return () => unsubscribe();
    });
  }

  // FIXED: Complete sale with account book transaction creation


private async removeAccountBookTransactionForSale(saleId: string): Promise<void> {
    // This logic removes the transaction if a sale is no longer 'Completed'.
    // (This is based on the provided service code)
     try {
      const saleSnap = await getDoc(doc(this.firestore, 'sales', saleId));
      if (!saleSnap.exists()) return;
      
      const saleData = saleSnap.data();
      const paymentAccountId = saleData['paymentAccountId'] || saleData['paymentAccount'];
      if (!paymentAccountId) return;
      
      const accountBookRef = collection(this.firestore, 'accountBookTransactions');
      const q = query(
        accountBookRef,
        where('accountId', '==', paymentAccountId),
        where('reference', '==', saleData['invoiceNo'] || saleId)
      );
      
      const querySnapshot = await getDocs(q);
      const batch = writeBatch(this.firestore);
      querySnapshot.forEach(doc => batch.delete(doc.ref));
      
      if (!querySnapshot.empty) {
        await batch.commit();
        console.log(`Removed account book transaction for un-completed sale ${saleId}`);
      }
    } catch (error) {
      console.error('Error removing account book transaction:', error);
    }
  }
// Part 4: Update getTotalSalesWithoutTaxByDateRange in SaleService

// Around line 500-550, UPDATE this method

  async getTotalSalesReturnTaxByDateRange(startDate: Date, endDate: Date): Promise<number> {
    try {
      const returnsRef = collection(this.firestore, 'returns');
      
      const q = query(
        returnsRef,
        where('paymentStatus', '==', 'Refunded'), // <--- CRITICAL FIX: Only count if Paid
        where('refundedAt', '>=', Timestamp.fromDate(startDate)),
        where('refundedAt', '<=', Timestamp.fromDate(endDate))
      );

      const querySnapshot = await getDocs(q);
      let totalReturnTax = 0;

      querySnapshot.forEach(doc => {
        const data = doc.data();
        // This field is saved during return creation
        totalReturnTax += (Number(data['totalTaxReturned']) || 0);
      });

      console.log(`BS Tax Logic: Tax Reversed (Refunded Only): ₹${totalReturnTax.toFixed(2)}`);
      return parseFloat(totalReturnTax.toFixed(2));

    } catch (error) {
      console.error('Error fetching sales return tax:', error);
      return 0;
    }
  }

  // 3. GET REFUNDED SHIPPING (For Profit & Loss)
  // Logic: Only subtract shipping income when the refund is PAID.
  async getTotalRefundedShippingChargesByDateRange(startDate: Date, endDate: Date): Promise<number> {
      try {
          const returnsRef = collection(this.firestore, 'returns');
          const q = query(
              returnsRef,
              where('isFullReturn', '==', true), // Only full returns usually refund shipping
              where('paymentStatus', '==', 'Refunded'), // <--- CRITICAL FIX: Only count if Paid
              where('refundedAt', '>=', Timestamp.fromDate(startDate)),
              where('refundedAt', '<=', Timestamp.fromDate(endDate))
          );
          const querySnapshot = await getDocs(q);
          return querySnapshot.docs.reduce((sum, doc) => {
              return sum + (Number(doc.data()['shippingChargesRefunded']) || 0);
          }, 0);
      } catch (error) {
          console.error('Error fetching total refunded shipping charges:', error);
          return 0;
      }
  }

  // 4. GET PENDING REFUNDS (For Balance Sheet Liability)
  // Logic: Amount owed to customers for returns that haven't been paid yet.
  async getTotalPendingRefundsByDateRange(startDate: Date, endDate: Date): Promise<number> {
    try {
      const returnsRef = collection(this.firestore, 'returns');
      
      // Note: We use 'returnDate' here because the Debt exists from the moment
      // the return is created until it is paid.
      const q = query(
        returnsRef,
        where('paymentStatus', '==', 'Due'), // Only UNPAID returns
        where('returnDate', '>=', Timestamp.fromDate(startDate)),
        where('returnDate', '<=', Timestamp.fromDate(endDate))
      );

      const querySnapshot = await getDocs(q);
      
      const totalPending = querySnapshot.docs.reduce((sum, doc) => {
        return sum + (Number(doc.data()['totalRefund']) || 0);
      }, 0);

      console.log(`BS Liability Logic: Pending Refunds Due to Customers: ₹${totalPending}`);
      return totalPending;
    } catch (error) {
      console.error('Error fetching pending refunds:', error);
      return 0;
    }
  }
private calculateReturnProductTax(returnedItems: any[]): number {
    let totalReturnTax = 0;
    returnedItems.forEach((item: any) => {
        const taxableValue = (Number(item.unitPrice) * Number(item.quantity)) - (Number(item.discount) || 0);
        const itemTaxAmount = taxableValue * ((Number(item.taxRate) || 0) / 100);
        totalReturnTax += itemTaxAmount;
    });
    return Math.max(0, totalReturnTax);
}






  private async processProductStockReductionInTransaction(
    transaction: any,
    product: Product,
    locationId: string,
    saleId: string,
    invoiceNo: string
  ): Promise<void> {
    const productId = product.productId || product.id;
    const quantity = product.quantity || 0;

    if (!productId || quantity <= 0) return;

    await this.reduceStockInTransaction(transaction, productId, locationId, quantity, saleId, invoiceNo);

    const productRef = doc(this.firestore, 'products', productId);
    const productSnap = await transaction.get(productRef);
    
    if (productSnap.exists()) {
      const productData = productSnap.data();
      const productType = productData['productType'];

      if (productType === 'Combination' && productData['components']?.length) {
        await this.processCombinationProductStockReductionInTransaction(
          transaction, 
          productData['components'], 
          quantity, 
          locationId, 
          saleId, 
          invoiceNo
        );
      } else if (productType === 'Single' && productData['notSellingProducts']?.length) {
        await this.processSingleProductStockReductionInTransaction(
          transaction, 
          productData['notSellingProducts'], 
          quantity, 
          locationId, 
          saleId, 
          invoiceNo
        );
      }
    }
  }

  private async processCombinationProductStockReductionInTransaction(
    transaction: any,
    components: Array<{productId: string, quantity: number}>,
    soldQuantity: number,
    locationId: string,
    saleId: string,
    invoiceNo: string
  ): Promise<void> {
    console.log(`Processing combination product stock reduction for ${components.length} components`);

    for (const component of components) {
      const componentProductId = component.productId;
      const componentQuantityPerUnit = component.quantity || 1;
      const totalComponentQuantity = componentQuantityPerUnit * soldQuantity;

      console.log(`Reducing component ${componentProductId}: ${totalComponentQuantity} units`);

      await this.reduceStockInTransaction(
        transaction,
        componentProductId,
        locationId,
        totalComponentQuantity,
        saleId,
        invoiceNo,
        `Component of combination product`
      );

      const componentProductRef = doc(this.firestore, 'products', componentProductId);
      const componentProductSnap = await transaction.get(componentProductRef);
      
      if (componentProductSnap.exists()) {
        const componentProductData = componentProductSnap.data();
        if (componentProductData['productType'] === 'Single' && componentProductData['notSellingProducts']?.length) {
          await this.processSingleProductStockReductionInTransaction(
            transaction,
            componentProductData['notSellingProducts'],
            totalComponentQuantity,
            locationId,
            saleId,
            invoiceNo
          );
        }
      }
    }
  }

  private async processSingleProductStockReductionInTransaction(
    transaction: any,
    notSellingProducts: Array<{productId: string, productName?: string, quantity: number}>,
    soldQuantity: number,
    locationId: string,
    saleId: string,
    invoiceNo: string
  ): Promise<void> {
    console.log(`Processing single product stock reduction for ${notSellingProducts.length} not-selling products`);

    for (const notSellingProduct of notSellingProducts) {
      const notSellingProductId = notSellingProduct.productId;
      const notSellingQuantityPerUnit = notSellingProduct.quantity || 1;
      const totalNotSellingQuantity = notSellingQuantityPerUnit * soldQuantity;

      console.log(`Reducing not-selling product ${notSellingProductId}: ${totalNotSellingQuantity} units`);

      await this.reduceStockInTransaction(
        transaction,
        notSellingProductId,
        locationId,
        totalNotSellingQuantity,
        saleId,
        invoiceNo,
        `Not-selling product associated with main product`
      );
    }
  }

  private async reduceStockInTransaction(
    transaction: any,
    productId: string,
    locationId: string,
    quantity: number,
    saleId: string,
    invoiceNo: string,
    notes?: string
  ): Promise<void> {
    const stockDocId = `${productId}_${locationId}`;
    const stockRef = doc(this.firestore, COLLECTIONS.PRODUCT_STOCK, stockDocId);
    const stockSnap = await transaction.get(stockRef);
    
    const currentStock = stockSnap.exists() ? (stockSnap.data()['quantity'] || 0) : 0;
    const newStock = currentStock - quantity;
    
    transaction.set(stockRef, {
      productId,
      locationId,
      quantity: newStock,
      lastUpdated: serverTimestamp()
    }, { merge: true });

    const historyRef = doc(collection(this.firestore, COLLECTIONS.PRODUCT_STOCK_HISTORY));
    transaction.set(historyRef, {
      productId,
      locationId,
      action: 'sale',
      quantity,
      oldStock: currentStock,
      newStock,
      referenceNo: invoiceNo || saleId,
      userId: 'system',
      timestamp: serverTimestamp(),
      saleId,
      invoiceNo,
      notes: notes || `Stock reduced for sale ${invoiceNo || saleId} - ${newStock < 0 ? 'NEGATIVE STOCK ALLOWED' : 'Stock updated'}`
    });

    console.log(`Stock updated for product ${productId}: ${currentStock} -> ${newStock} ${newStock < 0 ? '(NEGATIVE STOCK)' : ''}`);
  }

  private async recordSalesStockPriceLog(logData: {
    saleId: string;
    productId: string;
    productName: string;
    quantity: number;
    sellingPrice: number;
    locationId: string;
    invoiceNo: string;
    saleDate: Date;
  }): Promise<void> {
    try {
      const logRef = collection(this.firestore, 'sales-stock-price-log');
      await addDoc(logRef, {
        ...logData,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error recording sales stock price log:', error);
    }
  }
// in src/app/services/stock.service.ts

async updateStockAfterSale(productId: string, locationId: string, quantitySold: number, action: string, referenceId: string): Promise<void> {
    const stockDocId = `${productId}_${locationId}`;
    const stockRef = doc(this.firestore, COLLECTIONS.PRODUCT_STOCK, stockDocId);
    
    try {
      const stockSnap = await getDoc(stockRef);
      const currentStock = stockSnap.exists() ? (stockSnap.data()['quantity'] || 0) : 0;
      
      const newStock = Math.max(0, currentStock - quantitySold);
      
      console.log(`🔄 Sale stock reduction: ${productId} at ${locationId} - ${currentStock} → ${newStock} (sold: ${quantitySold})`);
      
      await setDoc(stockRef, {
        productId,
        locationId,
        quantity: newStock,
        lastUpdated: new Date()
      }, { merge: true });
      
      await this['dailyStockService'].updateDailySnapshot(
        productId,
        locationId,
        new Date(),
        newStock,
        'out',
        quantitySold,
        `sale_${referenceId}`
      );
      
      await this['recordStockHistory']({
        productId,
        locationId,
        action: 'sale',
        quantity: quantitySold,
        oldStock: currentStock,
        newStock,
        referenceNo: referenceId,
        timestamp: new Date(),
        userId: 'system',
        saleId: referenceId
      });
      
      this['notifyStockUpdate']();
      console.log(`✅ Sale stock reduction completed for ${productId}`);
      
    } catch (error) {
      console.error('Error updating stock after sale:', error);
      throw error;
    }
}

  private async recordSalesStockPriceLogs(saleData: any): Promise<void> {
    if (!saleData.products?.length) return;
    
    const batch = writeBatch(this.firestore);
    
    if (saleData.products && Array.isArray(saleData.products)) {
      for (const product of saleData.products) {
        const logId = `${saleData.id}_${product.productId || product.id}`;
        const logRef = doc(this.firestore, COLLECTIONS.SALES_STOCK_PRICE_LOGS, logId);
        
        batch.set(logRef, {
          productId: product.productId || product.id,
          productName: product.name || product.productName,
          quantity: product.quantity,
          sellingPrice: product.unitPrice || product.price,
          locationId: saleData.businessLocationId || saleData.locationId,
          saleCreatedDate: saleData.completedAt || saleData.saleDate || saleData.createdAt,
          invoiceNo: saleData.invoiceNo,
          createdAt: new Date()
        });
      }
    }
    
    await batch.commit();
  }

  private async validateStockAvailability(sale: SalesOrder): Promise<void> {
    if (!sale.products || sale.products.length === 0) return;

    const batch = writeBatch(this.firestore);
    const errors: string[] = [];

    for (const product of sale.products) {
      const productId = product.productId || product.id;
      if (!productId) continue;

      const stockDocRef = doc(this.firestore, 'productStock', `${productId}_${sale.businessLocation || 'default'}`);
      const stockSnap = await getDoc(stockDocRef);

      const currentStock = stockSnap.exists() ? stockSnap.data()['quantity'] : 0;
      if (currentStock < product.quantity) {
        errors.push(`Insufficient stock for ${product.name}. Available: ${currentStock}, Requested: ${product.quantity}`);
      }
    }

    if (errors.length > 0) {
      throw new Error(errors.join('\n'));
    }
  }


  private async logSaleTransaction(sale: SalesOrder): Promise<void> {
    try {
      const transactionRef = doc(collection(this.firestore, 'saleTransactions'));
      await setDoc(transactionRef, {
        saleId: sale.id,
        invoiceNo: sale.invoiceNo,
        timestamp: serverTimestamp(),
        status: 'completed',
        products: sale.products?.map(p => ({
          productId: p.productId || p.id,
          name: p.name || p.productName,
          quantity: p.quantity,
          unitPrice: p.unitPrice
        })),
        totalAmount: sale.total,
        location: sale.businessLocation,
        processedBy: sale.addedBy || 'system'
      });
    } catch (error) {
      console.error('Error logging sale transaction:', error);
    }
  }

// In src/app/services/sale.service.ts
// Replace the existing getSalesByDateRange() method with this corrected version.

  async getSalesByDateRange(startDate: Date, endDate: Date): Promise<Sale[]> {
    try {
      const salesRef = collection(this.firestore, 'sales');
      // ======================= THE FIX =======================
      // The query now uses `completedAt` to ensure it fetches the exact same
      // set of sales used by the Profit & Loss and Tax calculation methods.
      // This is the primary fix for the inconsistency.
      const q = query(
        salesRef,
        where('status', '==', 'Completed'),
        where('completedAt', '>=', startDate),
        where('completedAt', '<=', endDate)
      );
      // ===================== END OF THE FIX ====================
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          saleDate: this.convertTimestampToDate(data['saleDate']),
          completedAt: this.convertTimestampToDate(data['completedAt']),
          products: data['products'] || []
        } as unknown as Sale;
      });
    } catch (error) {
      console.error('Error fetching sales:', error);
      return [];
    }
  }

  getReturnLogsBySale(saleId: string): Observable<any[]> {
    const returnLogRef = collection(this.firestore, 'sales-return-log');
    const q = query(returnLogRef, where('saleId', '==', saleId));
    
    return new Observable(observer => {
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const logs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          returnDate: doc.data()['returnDate']?.toDate()
        }));
        observer.next(logs);
      });
      return () => unsubscribe();
    });
  }

  async getReturnsByDateRange(startDate: Date, endDate: Date): Promise<Return[]> {
    try {
      const returnsCollection = collection(this.firestore, 'returns');
      
      const q = query(
        returnsCollection,
        where('returnDate', '>=', startDate),
        where('returnDate', '<=', endDate),
        orderBy('returnDate', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          returnDate: this.convertTimestampToDate(data['returnDate'])
        } as Return;
      });
    } catch (error) {
      console.error('Error fetching returns by date range:', error);
      return [];
    }
  }

  getReturns(): Observable<Return[]> {
    return new Observable<Return[]>(observer => {
      const returnsRef = collection(this.firestore, 'returns');
      const q = query(returnsRef, orderBy('returnDate', 'desc'));
      
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const returns = querySnapshot.docs.map(doc => {
          const data = doc.data() as Return;
          return { 
            id: doc.id,
            ...data,
            returnDate: this.convertTimestampToDate(data.returnDate)
          };
        });
        observer.next(returns);
      }, (error) => {
        observer.error(error);
      });

      return () => unsubscribe();
    });
  }

  generateDocument(saleId: string, type: 'invoice' | 'delivery-note'): Observable<Blob> {
    return new Observable<Blob>(observer => {
      const mockPdfContent = `PDF content for ${type} of sale ${saleId}`;
      const blob = new Blob([mockPdfContent], { type: 'application/pdf' });
      observer.next(blob);
      observer.complete();
    });
  }
  
  importShippingData(file: File): Observable<{ success: number; errors: number }> {
    return new Observable(observer => {
      this.papa.parse(file, {
        header: true,
        complete: (results) => {
          const data = results.data;
          let successCount = 0;
          let errorCount = 0;
  
          const promises = data.map((row: any, index: number) => {
            return new Promise<void>(async (resolve) => {
              try {
                if (!row['Date'] || !row['Invoice No.'] || !row['Customer']) {
                  console.error(`Row ${index + 1} missing required fields`);
                  errorCount++;
                  return resolve();
                }
  
                const shippingCharge = parseFloat(row['Shipping Charge']) || 0;
                
                const shipmentData: SalesOrder = {
                  saleDate: row['Date'],
                  invoiceNo: row['Invoice No.'],
                  customer: row['Customer'],
                  contactNumber: row['Contact Number'] || '',
                  billingAddress: row['Location'] || '',
                  deliveryPerson: row['Delivery Person'] || '',
                  shippingStatus: row['Shipping Status'] || 'Pending',
                  shippingCharges: shippingCharge,
                  paymentStatus: row['Payment Status'] || 'Unpaid',
                  status: 'Completed',
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  balance: shippingCharge,
                  balanceAmount: shippingCharge, // Add balance amount
                  paymentAmount: 0,
                  totalAmount: undefined,
                  typeOfService: undefined,
                  typeOfServiceName: '',
                  total: undefined,
                  subtotal: 0,
                  tax: 0,
                  shippingCost: 0,
                  id: '',
                  customerId: '',
                  discountAmount: 0,
                  transactionId: '',
                  paymentAccount: '',
                  productTaxAmount: 0,
                  shippingTaxAmount: 0,
                  roundOff: 0,
                  shippingChargesAfterTax: 0,
                  codTaxAmount: 0,
                  ppTaxAmount: 0,
                  interestedProductIds: false,
                  contactPersonId: '',
                  contractId: ''
                };
  
                if (shipmentData.paymentStatus === 'Paid') {
                  shipmentData.balance = 0;
                  shipmentData.balanceAmount = 0;
                  shipmentData.paymentAmount = shippingCharge;
                } else if (shipmentData.paymentStatus === 'Partial') {
                  shipmentData.paymentAmount = shippingCharge * 0.5;
                  shipmentData.balance = shippingCharge - shipmentData.paymentAmount;
                  shipmentData.balanceAmount = shipmentData.balance;
                }
  
                await addDoc(collection(this.firestore, 'sales'), shipmentData);
                successCount++;
                console.log(`Row ${index + 1} imported successfully`);
              } catch (error) {
                errorCount++;
                console.error(`Error importing row ${index + 1}:`, error);
              }
              resolve();
            });
          });
  
          Promise.all(promises)
            .then(() => {
              console.log(`Import completed: ${successCount} success, ${errorCount} errors`);
              observer.next({ success: successCount, errors: errorCount });
              observer.complete();
            })
            .catch(error => {
              console.error('Import failed:', error);
              observer.error(error);
            });
        },
        error: (error) => {
          console.error('CSV parsing error:', error);
          observer.error(error);
        }
      });
    });
  }

  getUserList(): Observable<any[]> {
    return new Observable(observer => {
      const usersRef = collection(this.firestore, 'users');
      const q = query(usersRef, where('role', 'in', ['executive', 'sales']));
      
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const users = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        observer.next(users);
      }, (error) => {
        observer.error(error);
      });

      return () => unsubscribe();
    });
  }

  getPrescriptionsBySaleId(saleId: string): Observable<Prescription[]> {
    return new Observable<Prescription[]>(observer => {
      const prescriptionsCollection = collection(this.firestore, 'prescriptions');
      const q = query(
        prescriptionsCollection,
        where('saleId', '==', saleId),
        orderBy('createdAt', 'desc')
      );

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const prescriptions = querySnapshot.docs.map(doc => {
          const data = doc.data() as Prescription;
          return { id: doc.id, ...data };
        });
        observer.next(prescriptions);
      });

      return () => unsubscribe();
    });
  }
  
  async savePrescription(prescriptionData: Prescription): Promise<string> {
    try {
      const prescriptionsCollection = collection(this.firestore, 'prescriptions');
      const docRef = await addDoc(prescriptionsCollection, {
        ...prescriptionData,
        createdAt: new Date()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error saving prescription:', error);
      throw error;
    }
  }

  async updateSaleWithActivity(
    saleId: string,
    updateData: any,
    currentStatus: string,
    newStatus: string,
    userId: string,
    userName: string,
    note?: string
  ): Promise<any> {
    try {
      const saleDoc = doc(this.firestore, 'sales', saleId);
      const currentSaleSnapshot = await getDoc(saleDoc);

      if (!currentSaleSnapshot.exists()) {
        throw new Error(`Sale with ID ${saleId} not found`);
      }

      const currentSaleData = currentSaleSnapshot.data() as SalesOrder;
      
      if (currentStatus !== newStatus) {
        const newActivity = {
          userId: userId,
          userName: userName,
          fromStatus: currentStatus || 'None',
          toStatus: newStatus,
          timestamp: new Date(),
          note: note
        };

        updateData.activities = [...(currentSaleData.activities || []), newActivity];
      }

      updateData.updatedAt = new Date();

      await updateDoc(saleDoc, updateData);
      
      return updateData.activities || [];
    } catch (error) {
      console.error('Error updating sale with activity:', error);
      throw error;
    }
  }

  async updatePrescription(prescriptionId: string, prescriptionData: Partial<Prescription>): Promise<void> {
    try {
      const prescriptionDoc = doc(this.firestore, 'prescriptions', prescriptionId);
      await updateDoc(prescriptionDoc, {
        ...prescriptionData,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error updating prescription:', error);
      throw error;
    }
  }

  async deletePrescription(prescriptionId: string): Promise<void> {
    try {
      const prescriptionDoc = doc(this.firestore, 'prescriptions', prescriptionId);
      await deleteDoc(prescriptionDoc);
    } catch (error) {
      console.error('Error deleting prescription:', error);
      throw error;
    }
  }

  getPurchasesByProductId(productId: string): Observable<any[]> {
    return new Observable<any[]>(observer => {
      const salesCollection = collection(this.firestore, 'sales');
      const q = query(
        salesCollection,
        where('status', '==', 'Completed'),
        where('products', 'array-contains', {productId: productId}),
        orderBy('saleDate', 'desc')
      );

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const purchases = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            saleDate: this.convertTimestampToDate(data['saleDate']),
            paidOn: this.convertTimestampToDate(data['paidOn']),
            createdAt: this.convertTimestampToDate(data['createdAt']),
            updatedAt: this.convertTimestampToDate(data['updatedAt']),
            completedAt: this.convertTimestampToDate(data['completedAt'])
          };
        });
        observer.next(purchases);
      }, (error) => {
        observer.error(error);
      });

      return () => unsubscribe();
    });
  }

  getLatestOrderNumber(): Observable<number> {
    return new Observable<number>((observer) => {
      const salesCollection = collection(this.firestore, 'sales');
      const q = query(salesCollection, orderBy('orderNo', 'desc'), limit(1));

      getDocs(q).then(querySnapshot => {
        if (querySnapshot.empty) {
          observer.next(0);
          observer.complete();
          return;
        }

        const latestSale = querySnapshot.docs[0].data() as any;
        if (latestSale.orderNo) {
          const parts = latestSale.orderNo.split('-');
          if (parts.length === 3) {
            observer.next(parseInt(parts[2], 10));
            observer.complete();
            return;
          }
        }

        observer.next(0);
        observer.complete();
      }).catch(error => {
        console.error("Error getting latest order number:", error);
        observer.error(error);
      });
    });
  }

// Add this to your sale.service.ts







  async getDepartmentExecutives(department: string): Promise<any[]> {
    try {
      const usersRef = collection(this.firestore, 'users');
      const q = query(
        usersRef,
        where('department', '==', department),
        where('role', '==', 'executive')
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting department executives:', error);
      throw error;
    }
  }



  async exportSales(format: 'csv' | 'excel' | 'pdf', filterOptions?: FilterOptions): Promise<void> {
    const sales = await new Promise<SalesOrder[]>((resolve) => {
      const sub = this.listenForSales(filterOptions).subscribe(data => {
        resolve(data);
        sub.unsubscribe();
      });
    });

    switch (format) {
      case 'csv':
        this.exportToCSV(sales);
        break;
      case 'excel':
        this.exportToExcel(sales);
        break;
      case 'pdf':
        this.exportToPDF(sales);
        break;
      default:
        console.warn('Unsupported export format:', format);
    }
  }

  private exportToCSV(sales: SalesOrder[]): void {
    const headers = Object.keys(sales[0]).join(',');
    const rows = sales.map(sale => Object.values(sale).join(','));
    const csvContent = [headers, ...rows].join('\n');
    this.downloadFile(csvContent, 'sales_export.csv', 'text/csv');
  }

  private exportToExcel(sales: SalesOrder[]): void {
    const excelContent = sales.map(sale => JSON.stringify(sale)).join('\n');
    this.downloadFile(excelContent, 'sales_export.xlsx', 'application/vnd.ms-excel');
  }

  private exportToPDF(sales: SalesOrder[]): void {
    const pdfContent = sales.map(sale => JSON.stringify(sale)).join('\n\n');
    this.downloadFile(pdfContent, 'sales_export.pdf', 'application/pdf');
  }

  private downloadFile(content: string, fileName: string, fileType: string): void {
    const blob = new Blob([content], { type: fileType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }



  async updateSaleWithStockHandling(saleId: string, saleData: Partial<SalesOrder>): Promise<void> {
    try {
      if (!saleId) {
        throw new Error('Sale ID is required for update');
      }

      const saleDoc = doc(this.firestore, 'sales', saleId);
      const currentSaleSnapshot = await getDoc(saleDoc);

      if (!currentSaleSnapshot.exists()) {
        throw new Error(`Sale with ID ${saleId} not found`);
      }

      const currentSaleData = currentSaleSnapshot.data() as SalesOrder;
      const oldStatus = currentSaleData.status;
      const newStatus = saleData.status;

      if (oldStatus !== newStatus) {
        if (newStatus === 'Completed') {
          await this.reduceProductStockForSale({
            ...currentSaleData,
            ...saleData,
            id: saleId
          });
          // FIXED: Create account book transaction when completing sale
          await this.createAccountBookTransactionForSale(saleId);
        } else if (oldStatus === 'Completed') {
          await this.restoreProductStockForSale({
            ...currentSaleData,
            id: saleId
          });
          // FIXED: Remove account book transaction when uncompleting sale
          await this.removeAccountBookTransactionForSale(saleId);
        }
      }

      // Calculate balance amount if total or payment amount changed
      const totalAmount = saleData.totalAmount || saleData.total || currentSaleData.totalAmount || currentSaleData.total || 0;
      const paidAmount = saleData.paymentAmount || currentSaleData.paymentAmount || 0;
      const balanceAmount = totalAmount - paidAmount;

      await updateDoc(saleDoc, {
        ...saleData,
        balanceAmount: balanceAmount,
        updatedAt: new Date()
      });

    } catch (error) {
      console.error('Error updating sale:', error);
      throw error;
    }
  }

  // FIXED: Remove account book transaction for uncompleted sale




/**
 * FIXED: Changed 'completedAt' to 'saleDate' to support backdated P&L reports.
 */


  async logReturnTransaction(returnData: any): Promise<void> {
    try {
      const returnLogCollection = collection(this.firestore, 'sales-return-log');
      
      const logData = {
        saleId: returnData.originalSaleId,
        returnDate: new Date(),
        paymentAccountId: returnData.paymentAccountId || returnData.paymentAccount || '',
        items: returnData.returnedItems.map((item: any) => ({
          quantity: item.originalQuantity,
          returnQuantity: item.quantity || item.returnQuantity,
          subtotal: item.subtotal || (item.unitPrice * (item.quantity || item.returnQuantity))
        }))
      };

      await addDoc(returnLogCollection, logData);
      console.log('Return transaction logged successfully');
    } catch (error) {
      console.error('Error logging return transaction:', error);
      throw error;
    }
  }
// src/app/services/sale.service.ts

/**
 * [FIXED FOR BALANCE SHEET ACCURACY]
 * Calculates Total Sales (Excl. Tax) by subtracting the STORED Tax amount 
 * from the STORED Subtotal.
 * 
 * Old Logic: Subtotal / (1 + TaxRate) => Results in 857.1428... (Float drift)
 * New Logic: Subtotal - TaxAmount     => Results in 857.14     (Exact match)
 */// In sale.service.ts - Replace getTotalSalesWithoutTaxByDateRange method



 async deleteSale(saleId: string): Promise<void> {
    try {
      const saleDocRef = doc(this.firestore, 'sales', saleId);
      const saleSnapshot = await getDoc(saleDocRef);

      if (saleSnapshot.exists()) {
        const saleData = { id: saleId, ...saleSnapshot.data() } as SalesOrder;

        // 1. Restore Stock if sale was completed
        if (saleData.status === 'Completed') {
          // Restore items to inventory
          await this.restoreProductStockForSale(saleData);
          
          // ✅ FIX: Pass BOTH saleId and invoiceNo to ensure we find the ledger entry
          const invoiceNo = saleData.invoiceNo || '';
          await this.accountService.deleteSaleTransactionStandalone(saleId, invoiceNo);
        }

        // 2. Delete the Sale Document
        await deleteDoc(saleDocRef);
        console.log(`Sale ${saleId} and its ledger entries deleted successfully.`);
      }
    } catch (error) {
      console.error('Error deleting sale:', error);
      throw error;
    }
  }

  getSaleById(saleId: string): Observable<SalesOrder> {
    return new Observable<SalesOrder>((observer) => {
      const saleDocRef = doc(this.firestore, 'sales', saleId);

      const unsubscribe = onSnapshot(saleDocRef, (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data() as Omit<SalesOrder, 'id'>;
          
          // Calculate balance amount
          const totalAmount = data.totalAmount || data.total || data.totalPayable || 0;
          const paidAmount = data.paymentAmount || 0;
          const balanceAmount = totalAmount - paidAmount;
          
          const sale = { 
            id: docSnapshot.id, 
            ...data,
            balanceAmount: balanceAmount,
            saleDate: this.convertTimestampToDate(data.saleDate),
            paidOn: this.convertTimestampToDate(data.paidOn),
            createdAt: this.convertTimestampToDate(data.createdAt),
            updatedAt: this.convertTimestampToDate(data.updatedAt),
            completedAt: this.convertTimestampToDate(data.completedAt)
          };
          observer.next(sale);
        } else {
          observer.error(new Error(`Sale with ID ${saleId} not found`));
        }
      }, (error) => {
        observer.error(error);
      });

      return () => unsubscribe();
    });
  }

  async getCompletedSalesByProducts(productIds: string[], startDate: Date, endDate: Date): Promise<{ [productId: string]: Array<{date: Date; quantity: number; invoiceNo: string}> }> {
    try {
      const salesRef = collection(this.firestore, 'sales');
      const q = query(
        salesRef,
        where('status', '==', 'Completed'),
        where('saleDate', '>=', startDate),
        where('saleDate', '<=', endDate)
      );
      
      const querySnapshot = await getDocs(q);
      const result: { [key: string]: Array<{date: Date; quantity: number; invoiceNo: string}> } = {};
      
      querySnapshot.forEach(doc => {
        const sale = doc.data() as Sale;
        sale.products?.forEach(product => {
          if (productIds.includes(product.productId)) {
            if (!result[product.productId]) {
              result[product.productId] = [];
            }
            result[product.productId].push({
              date: this.convertTimestampToDate(sale.saleDate),
              quantity: product.quantity,
              invoiceNo: sale.invoiceNo || 'N/A'
            });
          }
        });
      });
      
      return result;
    } catch (error) {
      console.error('Error getting completed sales by products:', error);
      return {};
    }
  }

// in src/app/services/sale.service.ts

  /**
   * ROBUST VERSION: Reduces product stock safely within a transaction.
   * This method now includes a check for an existing products array.
   */
// in src/app/services/sale.service.ts

  /**
   * ROBUST VERSION: Reduces product stock safely within a transaction.
   * This method now includes a check for an existing products array.
   */
// in src/app/services/sale.service.ts

  /**
   * ROBUST VERSION: Reduces product stock safely within a transaction.
   * This method now includes a check for an existing products array.
   */


  /**
   * ROBUST VERSION: Restores product stock safely within a transaction.
   * This method now also includes a check for the products array.
   */

  /**
   * ROBUST VERSION: Restores product stock safely within a transaction.
   * This method now also includes a check for the products array.
   */

  async getSalesByProductId(productId: string): Promise<Sale[]> {
    try {
      const salesRef = collection(this.firestore, 'sales');
      const q = query(
        salesRef,
        where('status', '==', 'Completed')
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => {
        const sale = doc.data() as Sale;
        const productData = sale.products?.find(p => p.productId === productId);
        
        return {
          ...sale,
          id: doc.id,
          saleDate: this.convertTimestampToDate(sale.saleDate),
          completedAt: this.convertTimestampToDate((sale as any).completedAt),
          products: sale.products?.map(p => ({
            ...p,
            quantity: p.quantity || 0,
            unitPrice: p.unitPrice || 0,
            lineTotal: p.lineTotal || (p.quantity * p.unitPrice) || 0
          })) || []
        };
      });
    } catch (error) {
      console.error('Error getting sales by product:', error);
      throw error;
    }
  }


  



  private async getPaymentAccountFromSale(saleId: string): Promise<string> {
    try {
      const saleDoc = await getDoc(doc(this.firestore, 'sales', saleId));
      if (saleDoc.exists()) {
        const saleData = saleDoc.data() as SalesOrder;
        return saleData.paymentAccountId || saleData.paymentAccount || '';
      }
      return '';
    } catch (error) {
      console.error('Error fetching sale:', error);
      return '';
    }
  }


  async getTotalPendingSalesValue(): Promise<number> {
    try {
      const salesRef = collection(this.firestore, 'sales');
      // Create a query to get only documents where the status is 'Pending'
      const q = query(salesRef, where('status', '==', 'Pending'));
      
      const querySnapshot = await getDocs(q);
      
      // Reduce the results to a single sum of the 'totalPayable' field
      const totalPendingValue = querySnapshot.docs.reduce((sum, doc) => {
        const data = doc.data();
        // Use totalPayable, with fallbacks to ensure a value is always found
        const saleAmount = data['totalPayable'] || data['totalAmount'] || data['total'] || 0;
        return sum + Number(saleAmount);
      }, 0);

      console.log(`Fetched total pending sales value: ${totalPendingValue}`);
      return totalPendingValue;

    } catch (error) {
      console.error('Error fetching total pending sales value:', error);
      // Return 0 in case of an error to prevent breaking the balance sheet
      return 0;
    }
  }

  private async updateOriginalSaleAfterReturn(
    saleId: string, 
    returnedItems: any[],
    markAsReturned: boolean = false
  ): Promise<void> {
    try {
      const saleDoc = doc(this.firestore, 'sales', saleId);
      const saleSnapshot = await getDoc(saleDoc);
      
      if (!saleSnapshot.exists()) {
        throw new Error('Original sale not found');
      }
      
      const saleData = saleSnapshot.data() as SalesOrder;
      
      const updatedProducts = saleData.products?.map(product => {
        const returnedItem = returnedItems.find(item => 
          (item.productId || item.id) === (product.id || product.productId)
        );
        
        if (returnedItem) {
          const newQuantity = product.quantity - returnedItem.quantity;
          return {
            ...product,
            quantity: Math.max(0, newQuantity),
            subtotal: Math.max(0, newQuantity) * product.unitPrice
          };
        }
        return product;
      }).filter(product => product.quantity > 0);
      
      const newSubtotal = updatedProducts?.reduce((sum, product) => sum + product.subtotal, 0) || 0;
      const newTotal = newSubtotal + (saleData.tax || 0) + (saleData.shippingCost || 0);
      const paidAmount = saleData.paymentAmount || 0;
      const newBalanceAmount = newTotal - paidAmount;
      
      const updateData: any = {
        products: updatedProducts,
        subtotal: newSubtotal,
        total: newTotal,
        balanceAmount: newBalanceAmount,
        updatedAt: new Date(),
        hasReturns: true,
        lastReturnDate: new Date()
      };
      
      if (markAsReturned || updatedProducts?.length === 0) {
        updateData.status = 'Returned';
      }
      
      await updateDoc(saleDoc, updateData);
      console.log('Original sale updated after return');
      
    } catch (error) {
      console.error('Error updating original sale after return:', error);
      throw error;
    }
  }


  private async restoreProductStockForReturn(returnData: Return): Promise<void> {
    try {
      const batch = writeBatch(this.firestore);

      for (const item of returnData.returnedItems) {
        
        let product;
        if (item.productId) {
          product = await this.productsService.getProductById(item.productId);
        }
        if (!product && item.name) {
          product = await this.productsService.getProductByName(item.name);
        }

        if (product && product.id) {
          const newStock = (product.currentStock || 0) + item.quantity;
          
          const productDoc = doc(this.firestore, `products/${product.id}`);
          batch.update(productDoc, {
            currentStock: newStock,
            updatedAt: new Date()
          });

          const stockHistoryRef = collection(this.firestore, 'stock_movements');
          batch.set(doc(stockHistoryRef), {
            productId: product.id,
            returnId: returnData.id,
            action: 'return',
            quantity: item.quantity,
            locationId: 'default',
            oldStock: product.currentStock || 0,
            newStock: newStock,
            reference: returnData.invoiceNo || `return-${returnData.id}`,
            timestamp: new Date(),
            notes: `Stock returned from sale ${returnData.invoiceNo}`
          });
        }
      }

      await batch.commit();
      this.stockUpdatedSource.next();
      console.log('Product stock restored for return');
    } catch (error) {
      console.error('Error restoring product stock for return:', error);
      throw error;
    }
  }

async getTotalPendingSalesValueByDateRange(startDate: Date, endDate: Date): Promise<number> {
  try {
    const salesRef = collection(this.firestore, 'sales');
    const q = query(
      salesRef,
      where('status', '==', 'Pending'),
      where('saleDate', '>=', Timestamp.fromDate(startDate)),
      where('saleDate', '<=', Timestamp.fromDate(endDate))
    );
    
    const querySnapshot = await getDocs(q);
    
    const totalPendingValue = querySnapshot.docs.reduce((sum, doc) => {
      const data = doc.data();
      // Use totalPayable, with fallbacks to ensure a value is always found
      const saleAmount = data['totalPayable'] || data['totalAmount'] || data['total'] || 0;
      return sum + Number(saleAmount);
    }, 0);

    console.log(`Fetched total pending sales value: ${totalPendingValue}`);
    return totalPendingValue;

  } catch (error) {
    console.error('Error fetching total pending sales value:', error);
    // Return 0 in case of an error to prevent breaking the balance sheet
    return 0;
  }
}

  private salesRefresh = new BehaviorSubject<void>(undefined);
  refreshSalesList(): Promise<void> {
    this.salesRefresh.next();
    return Promise.resolve();
  }
  
  // NEW METHOD: Get total shipping charges from sales (before tax)
  async getTotalShippingChargesWithoutTaxByDateRange(startDate: Date, endDate: Date): Promise<number> {
      try {
          const salesRef = collection(this.firestore, 'sales');
          const q = query(
              salesRef,
              where('status', '==', 'Completed'),
              where('completedAt', '>=', Timestamp.fromDate(startDate)),
              where('completedAt', '<=', Timestamp.fromDate(endDate))
          );
          const querySnapshot = await getDocs(q);
          return querySnapshot.docs.reduce((sum, doc) => {
              return sum + (Number(doc.data()['shippingCharges']) || 0);
          }, 0);
      } catch (error) {
          console.error('Error fetching total shipping charges:', error);
          return 0;
      }
  }


 async getNetShippingIncomeByDateRange(startDate: Date, endDate: Date): Promise<number> {
    try {
        const [grossShippingIncome, refundedShippingAmount] = await Promise.all([
            this.getTotalShippingChargesWithoutTaxByDateRange(startDate, endDate),
            this.getTotalRefundedShippingChargesByDateRange(startDate, endDate)
        ]);

        const netShippingIncome = grossShippingIncome - refundedShippingAmount;
        
        console.log(`Net Shipping Income Calculation: Gross=${grossShippingIncome}, Refunded=${refundedShippingAmount}, Net=${netShippingIncome}`);
        
        return Math.max(0, netShippingIncome); // Ensure it doesn't go below zero
    } catch (error) {
        console.error('Error calculating net shipping income:', error);
        return 0;
    }
  }



// In src/app/services/sale.service.ts

// Replace the existing processReturn method with this one


private determineIfFullReturn(originalSaleData: any, returnedItems: any[]): boolean {
    if (!originalSaleData.products || originalSaleData.products.length === 0) {
        return false;
    }

    // Create a map of original quantities
    const originalQuantities = new Map<string, number>();
    originalSaleData.products.forEach((product: any) => {
        const productId = product.productId || product.id;
        if (productId) {
            originalQuantities.set(productId, Number(product.quantity) || 0);
        }
    });

    // Create a map of total returned quantities (including this return)
    const totalReturnedQuantities = new Map<string, number>();
    returnedItems.forEach((item: any) => {
        const productId = item.productId || item.id;
        if (productId) {
            const currentReturned = totalReturnedQuantities.get(productId) || 0;
            totalReturnedQuantities.set(productId, currentReturned + (Number(item.quantity) || 0));
        }
    });

    // Check if all products are fully returned
    for (const [productId, originalQty] of originalQuantities) {
        const returnedQty = totalReturnedQuantities.get(productId) || 0;
        if (returnedQty < originalQty) {
            return false; // Not all of this product was returned
        }
    }

    return true; // All products were fully returned
}// Inside SaleService class



// ... existing methods ...

// ✅ Add this new method to fetch total round off for the P&L report
async getTotalRoundOffByDateRange(startDate: Date, endDate: Date): Promise<number> {
  try {
      const salesRef = collection(this.firestore, 'sales');
      const q = query(
          salesRef,
          where('status', 'in', ['Completed', 'Partial Return']),
          where('saleDate', '>=', Timestamp.fromDate(startDate)),
          where('saleDate', '<=', Timestamp.fromDate(endDate))
      );

      const querySnapshot = await getDocs(q);
      let totalRoundOff = 0;

      querySnapshot.forEach(doc => {
          const data = doc.data();
          totalRoundOff += (Number(data['roundOff']) || 0);
      });

      console.log(`[Balance Sheet] Total Round Off: ₹${totalRoundOff.toFixed(2)}`);
      return totalRoundOff;
  } catch (error) {
      console.error('Error fetching total round off:', error);
      return 0;
  }
}
 getLatestSaleByBookingId(bookingId: string): Observable<SalesOrder | null> {
    return new Observable(observer => {
      const salesRef = collection(this.firestore, 'sales');
      const q = query(
        salesRef,
        where('bookingId', '==', bookingId),
        orderBy('createdAt', 'desc'),
        limit(1)
      );

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        if (!querySnapshot.empty) {
          const saleDoc = querySnapshot.docs[0];
          observer.next({ id: saleDoc.id, ...saleDoc.data() } as SalesOrder);
        } else {
          observer.next(null); // No sale found
        }
      }, (error) => {
        observer.error(error);
      });

      return () => unsubscribe();
    });
  }

}