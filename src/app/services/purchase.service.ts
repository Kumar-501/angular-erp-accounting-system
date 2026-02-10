import { Injectable, Injector } from '@angular/core'; // <-- Import Injector

import {
  Firestore,
  collection,
  addDoc,
  doc,
  deleteDoc,
  getDoc,
  updateDoc,
  query,
   orderBy,
     limit,   
  where,
  getDocs,
  QuerySnapshot,
  DocumentData,
  runTransaction,
  arrayUnion,
  Timestamp,
  collectionData,
  DocumentReference,
  increment,
  onSnapshot
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { PurchaseItem } from '../models/purchase-item.model';
import { PurchaseReturnService } from './purchase-return.service';

// Interfaces remain the same
export interface Purchase {
  [x: string]: any;
  id?: string;
  supplierId: string;
  supplierName: string;
  totalReturned?: number; // <-- ADD THIS LINE

  purchaseNumber?: string;
  paymentAccount?: {
    id: string;
    name: string;
    accountNumber?: string;
  };

  cgst?: number;
  sgst?: number;
  igst?: number;
  address?: string;
  referenceNo: string;
  purchaseDate: string | Date | any;
  purchaseStatus: string;
  businessLocation: string;
  receivedQuantity?: number;
 shippingChargesBeforeTax?: number;
  shippingTaxRate?: number;
  shippingTaxAmount?: number;

 
  payTerm?: string;
  document?: string | null;
  discountType?: string;
  discountAmount?: number;
  purchaseTax?: number;
  additionalNotes?: string;
  shippingCharges?: number;
  purchaseTotal: number;
  paymentAmount: number;
  paidOn: string | Date | any;
  paymentMethod: string;
  paymentStatus?: string;
  paymentDue?: number;
  grandTotal?: number;
  addedBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
  purchaseOrder?: string;

  invoiceNo?: string;
  invoicedDate?: string | Date;
  receivedDate?: string | Date;
  totalTax?: number;
  products?: Array<{
    [x: string]: any;
    productId: string;
    productName: string;
    quantity: number;
    unitCost: number;
    discountPercent: number;
    unitCostBeforeTax: number;
    subtotal: number;
    taxAmount: number;
    lineTotal: number;
    profitMargin: number;
    sellingPrice: number;
    batchNumber: string;
    expiryDate: string;
    taxRate: number;
    roundOffAmount: number;
    roundedTotal: number;
  }>;
}

export interface PaymentAccount {
  id: string;
  name: string;
  accountNumber: string;
}


@Injectable({
  providedIn: 'root'
})
export class PurchaseService {
  [x: string]: any;
  private purchasesCollection;
  private paymentAccountsCollection;
  private suppliersCollection;
  private accountsCollection;
  private paymentsCollection;


  constructor(private firestore: Firestore,
        private injector: Injector // <-- Inject Injector to break the circular dependency

  ) {
    this.purchasesCollection = collection(this.firestore, 'purchases');
    this.paymentsCollection = collection(this.firestore, 'payments');
    this.paymentAccountsCollection = collection(this.firestore, 'paymentAccounts');
    this.suppliersCollection = collection(this.firestore, 'suppliers');
    this.accountsCollection = collection(this.firestore, 'accounts');
  }

// Update your deletePurchase method to this:

async deletePurchase(id: string): Promise<void> {
  if (!id) throw new Error('Purchase ID is required');

  const purchaseRef = doc(this.firestore, 'purchases', id);

  try {
    await runTransaction(this.firestore, async (transaction) => {
      // 1. Read the purchase before deleting
      const purchaseDoc = await transaction.get(purchaseRef);
      if (!purchaseDoc.exists()) {
        throw new Error('Purchase does not exist!');
      }

      const purchaseData = purchaseDoc.data() as Purchase;
      const paymentDue = Number(purchaseData.paymentDue) || 0;
      const supplierId = purchaseData.supplierId;

      // 2. If money was owed (paymentDue > 0), subtract it from Supplier Balance
      if (supplierId && paymentDue > 0) {
        const supplierRef = doc(this.suppliersCollection, supplierId);
        const supplierDoc = await transaction.get(supplierRef);
        
        if (supplierDoc.exists()) {
          // Decrement the balance (remove the debt)
          transaction.update(supplierRef, {
            balance: increment(-paymentDue)
          });
        }
      }

      // 3. Delete related payments? (Optional: depends on your business logic)
      // Usually, if you delete a purchase, you might want to keep the payment records 
      // linked to 'Unknown' or delete them too. For now, we leave them to avoid data loss errors.

      // 4. Delete the purchase document
      transaction.delete(purchaseRef);
    });
  } catch (error) {
    console.error('Error deleting purchase:', error);
    throw error;
  }
}

  // =================================================================
  // END OF UPDATED METHOD
  // =================================================================
  async getLastPurchaseReference(): Promise<string | null> {
    try {
      // Query to get the last purchase sorted by referenceNo in descending order
      const q = query(
        this.purchasesCollection,
        orderBy('referenceNo', 'desc'),
        limit(1)
      );

      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const data = querySnapshot.docs[0].data();
        return data['referenceNo'] || null;
      }
      return null;
    } catch (error) {
      console.error('Error fetching last reference number:', error);
      return null;
    }
  }
// src/app/services/purchase.service.ts
// Inside PurchaseService class
async getTotalPurchasesWithoutTaxByDateRange(startDate: Date, endDate: Date): Promise<number> {
  try {
    const purchaseReturnService = this.injector.get(PurchaseReturnService);

    const [
      totalGrossPurchases,      // From formal 'purchases'
      standaloneGrnValue,       // From 'Add Goods' (GRNs)
      returnDocuments
    ] = await Promise.all([
      this.calculateGrossPurchases(startDate, endDate),
      this.getGrnTotalWithoutTaxByDateRange(startDate, endDate), // ✅ ADDED THIS
      (purchaseReturnService as any).getPurchaseReturnsByDateRange(startDate, endDate)
    ]);
    
    const returnTotals = purchaseReturnService.getReturnTotals(returnDocuments);
    const totalReturnsValue = returnTotals.totalWithoutTax;
    
    // ✅ Sum both formal purchases and manual goods additions
    const netPurchases = (totalGrossPurchases + standaloneGrnValue) - totalReturnsValue;

    console.log(`P&L Calculation: Formal=${totalGrossPurchases}, GRN=${standaloneGrnValue}, Net=${netPurchases}`);

    return netPurchases;

  } catch (error) {
    console.error('Error fetching total net purchases:', error);
    throw error;
  }
}





// src/app/services/purchase.service.ts

async getGrnTotalWithoutTaxByDateRange(startDate: Date, endDate: Date): Promise<number> {
  try {
    const grnRef = collection(this.firestore, 'goodsReceived');
    const q = query(grnRef); // Fetching all and filtering in memory is more reliable for mixed date formats
    const querySnapshot = await getDocs(q);
    
    let totalGrnValue = 0;

    querySnapshot.forEach(doc => {
      const data = doc.data();
      
      // 1. Determine the Date (Handles both Timestamp and String)
      let rDate: Date;
      if (data['receivedDate']?.toDate) rDate = data['receivedDate'].toDate();
      else rDate = new Date(data['receivedDate']);

      // 2. Filter by Date Range
      if (rDate >= startDate && rDate <= endDate) {
        
        // 3. ✅ CRITICAL: Only count Standalone GRNs. 
        // If 'purchaseOrder' or 'linkedPurchaseId' exists, it's already counted in the 'Purchases' total.
        if (!data['linkedPurchaseId'] && !data['purchaseOrderId'] && !data['purchaseOrder']) {
          
          if (data['products'] && Array.isArray(data['products'])) {
            const subtotal = data['products'].reduce((sum: number, p: any) => {
              const qty = Number(p.receivedQuantity || p.quantity || 0);
              const cost = Number(p.unitPrice || p.unitCost || 0);
              return sum + (qty * cost);
            }, 0);
            totalGrnValue += subtotal;
          } else {
            totalGrnValue += Number(data['netTotalAmount'] || 0);
          }
        }
      }
    });

    console.log(`Standalone GRN Value found: ₹${totalGrnValue}`);
    return totalGrnValue;
  } catch (error) {
    console.error('Error in getGrnTotalWithoutTaxByDateRange:', error);
    return 0;
  }
}
  
  async getPurchaseShippingTotalsByDateRange(startDate: Date, endDate: Date): Promise<{ totalShippingChargesBeforeTax: number, totalShippingTaxAmount: number }> {
    try {
      const q = query(
        this.purchasesCollection,
        where('purchaseDate', '>=', startDate),
        where('purchaseDate', '<=', endDate)
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return { totalShippingChargesBeforeTax: 0, totalShippingTaxAmount: 0 };
      }

      const totals = querySnapshot.docs.reduce((acc, doc) => {
        const data = doc.data() as any;
        acc.totalShippingChargesBeforeTax += Number(data.shippingChargesBeforeTax) || 0;
        acc.totalShippingTaxAmount += Number(data.shippingTaxAmount) || 0;
        return acc;
      }, { totalShippingChargesBeforeTax: 0, totalShippingTaxAmount: 0 });

      return totals;

    } catch (error) {
      console.error('Error fetching purchase shipping totals:', error);
      // Return zero on error to prevent breaking calculations
      return { totalShippingChargesBeforeTax: 0, totalShippingTaxAmount: 0 };
    }
  }
// In src/app/services/purchase.service.ts

  /**
   * [FIXED FOR BALANCE SHEET]
   * Calculates the total gross input tax from all purchases within a date range.
   * This version now correctly includes both the tax from products AND the tax
   * applied to shipping charges, providing an accurate total for Input Tax Credit.
   * @param startDate The start of the date range.
   * @param endDate The end of the date range.
   * @returns A promise that resolves to the total gross input tax.
   */
// In src/app/services/purchase.service.ts

// In src/app/services/purchase.service.ts

// In src/app/services/purchase.service.ts

  /**
   * [FIXED FOR BALANCE SHEET - Standard Rounding]
   * Calculates the total gross input tax from all purchases within a date range.
   * This version now uses Math.round() on each individual tax amount before summing.
   * This is the standard accounting practice to prevent the accumulation of floating-point
   * errors and ensures the final total is accurate.
   * @param startDate The start of the date range.
   * @param endDate The end of the date range.
   * @returns A promise that resolves to the total gross input tax.
   */

// src/app/services/purchase.service.ts

private async calculateGrossPurchases(startDate: Date, endDate: Date): Promise<number> {
  // Try to get all purchases first, then filter in memory if necessary 
  // or use multiple query formats to be safe
  const q = query(this.purchasesCollection); 
  const querySnapshot = await getDocs(q);
  
  if (querySnapshot.empty) return 0;

  const total = querySnapshot.docs.reduce((sum, doc) => {
    const data = doc.data() as any;
    
    // ✅ Convert Firestore field to a JS Date for safe comparison
    let pDate: Date;
    if (data.purchaseDate?.toDate) pDate = data.purchaseDate.toDate();
    else pDate = new Date(data.purchaseDate);

    // Filter by date range
    if (pDate < startDate || pDate > endDate) return sum;

    if (data.products && Array.isArray(data.products)) {
      const purchaseSubtotal = data.products.reduce((productSum: number, product: any) => {
        const qty = Number(product.quantity || product.receivedQuantity) || 0;
        const unitBefore = Number(product.unitCostBeforeTax ?? product.unitPrice ?? 0);
        const discPercent = Number(product.discountPercent) || 0;
        const effectivePrice = unitBefore * (1 - (discPercent / 100));
        return productSum + (qty * effectivePrice);
      }, 0);
      return sum + purchaseSubtotal;
    }
    
    return sum + (Number(data.purchaseTotal || data.grandTotal || 0) - Number(data.totalTax || 0));
  }, 0);

  return parseFloat(total.toFixed(2));
}


  // ... (rest of the service methods remain unchanged)
  
    /**
   * Fetches purchases within a date range and calculates their total sum (Grand Total, including tax).
   * @param startDate The start of the date range.
   * @param endDate The end of the date range.
   * @returns A promise that resolves to the total purchase amount.
   */
  async getTotalPurchasesByDateRange(startDate: Date, endDate: Date): Promise<number> {
    try {
      const q = query(
        this.purchasesCollection,
        where('purchaseDate', '>=', startDate),
        where('purchaseDate', '<=', endDate)
      );

      const querySnapshot = await getDocs(q);

      // Sum the grandTotal for all purchases in the filtered range
      const total = querySnapshot.docs.reduce((sum, doc) => {
        const data = doc.data() as Purchase;
        // Use grandTotal if it exists, otherwise fallback to purchaseTotal
        return sum + (data.grandTotal || data.purchaseTotal || 0);
      }, 0);

      return total;

    } catch (error) {
      console.error('Error fetching total purchases by date range:', error);
      throw error;
    }
  }


 // In src/app/services/purchase.service.ts
// src/app/services/purchase.service.ts

// src/app/services/purchase.service.ts
// Add/Replace this method in purchase.service.ts

/**
 * ✅ FIXED: Get Gross Input Tax (Purchase Tax before returns)
 * Calculates total tax paid on purchases
 */
async getGrossPurchaseTaxByDateRange(startDate: Date, endDate: Date): Promise<number> {
  try {
    const q = query(
      this.purchasesCollection,
      where('purchaseDate', '>=', startDate),
      where('purchaseDate', '<=', endDate)
    );

    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.log('⚠️ No purchases found in date range');
      return 0;
    }

    let totalTax = 0;

    querySnapshot.docs.forEach(doc => {
      const data = doc.data() as any;
      let purchaseTax = 0;

      // Method 1: Calculate from products array (most accurate)
      if (data.products && Array.isArray(data.products)) {
        purchaseTax = data.products.reduce((sum: number, product: any) => {
          const qty = Number(product.quantity) || 0;
          const unitBefore = Number(product.unitCostBeforeTax) || 0;
          const taxRate = Number(product.taxRate) || 0;
          const discPercent = Number(product.discountPercent) || 0;

          // Calculate taxable value after discount
          const effectivePrice = unitBefore * (1 - (discPercent / 100));
          const taxableValue = qty * effectivePrice;
          const itemTax = taxableValue * (taxRate / 100);

          return sum + itemTax;
        }, 0);
      } 
      // Method 2: Fallback to stored totalTax field
      else {
        purchaseTax = Number(data.totalTax) || 0;
      }

      // Add shipping tax
      const shippingTax = Number(data.shippingTaxAmount) || 0;
      
      const totalPurchaseTax = purchaseTax + shippingTax;
      totalTax += totalPurchaseTax;

      console.log(`Purchase ${data.referenceNo}: Tax = ₹${totalPurchaseTax.toFixed(2)}`);
    });

    console.log(`📊 Gross Input Tax (Purchases): ₹${totalTax.toFixed(2)}`);
    return parseFloat(totalTax.toFixed(2));

  } catch (error) {
    console.error('❌ Error fetching gross purchase tax:', error);
    return 0;
  }
}
async createPurchase(purchaseData: any): Promise<{ id: string }> {
  try {
    return await runTransaction(this.firestore, async (transaction) => {
      // 1️⃣ PREPARE REFERENCES
      const purchaseRef = doc(collection(this.firestore, 'purchases'));
      const supplierRef = purchaseData.supplierId ? doc(this.suppliersCollection, purchaseData.supplierId) : null;
      
      // Prepare Account Ref
      let accountRef = null;
      if (purchaseData.paymentAccount?.id) {
        accountRef = doc(this.accountsCollection, purchaseData.paymentAccount.id);
      }
      
      // 2️⃣ READ PHASE
      const supplierDoc = supplierRef ? await transaction.get(supplierRef) : null;
      const accountDoc = accountRef ? await transaction.get(accountRef) : null;

      if (purchaseData.paymentAmount > 0 && purchaseData.paymentAccount?.id && (!accountDoc || !accountDoc.exists())) {
        throw new Error('Selected Payment Account not found');
      }

      let supplierBalance = 0;
      if (supplierDoc && supplierDoc.exists()) {
        supplierBalance = supplierDoc.data()['balance'] || 0;
      }

      // 3️⃣ CALCULATE ADVANCE UTILIZATION
      let grandTotal = Number(purchaseData.grandTotal) || 0;
      let paymentAmount = Number(purchaseData.paymentAmount) || 0; 
      let advanceUtilized = 0;

      if (supplierBalance < 0) {
        const availableAdvance = Math.abs(supplierBalance);
        const remainingToPay = grandTotal - paymentAmount; 
        if (remainingToPay > 0) {
          advanceUtilized = Math.min(availableAdvance, remainingToPay);
        }
      }

      // 4️⃣ RECALCULATE FINAL TOTALS
      const totalPaid = paymentAmount + advanceUtilized;
      const paymentDue = Math.max(0, grandTotal - totalPaid);
      const paymentStatus = this.calculatePaymentStatus(totalPaid, grandTotal);

      // 5️⃣ WRITE: PURCHASE DOCUMENT
      transaction.set(purchaseRef, {
        ...purchaseData,
        paymentAmount: totalPaid,
        paymentDue,
        paymentStatus,
        advanceAdjusted: advanceUtilized,
        isUsedForGoods: false,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      // 6️⃣ WRITE: SUPPLIER BALANCE ADJUSTMENT
      if (supplierRef) {
        const balanceAdjustment = paymentDue + advanceUtilized;
        if (balanceAdjustment !== 0) {
            transaction.update(supplierRef, {
              balance: increment(balanceAdjustment)
            });
        }
      }

      // 7️⃣ WRITE: PAYMENT RECORDS
      
      // 7a. Record the Cash/Bank Payment (if any)
      if (paymentAmount > 0 && accountRef) {
        
        // --- ✅ FIX FOR TIME ISSUE STARTS HERE ---
        
        // 1. Create a date object from the user's selected "Paid On" date
        const paymentDateTime = new Date(purchaseData.paidOn);
        
        // 2. Get the current system time
        const now = new Date();
        
        // 3. Set the time of the selected date to the current clock time
        paymentDateTime.setHours(now.getHours(), now.getMinutes(), now.getSeconds());

        // --- ✅ FIX ENDS HERE ---

        const paymentRef = doc(collection(this.firestore, 'payments'));
        transaction.set(paymentRef, {
          purchaseId: purchaseRef.id,
          supplierId: purchaseData.supplierId,
          supplierName: purchaseData.supplierName,
          referenceNo: purchaseData.referenceNo,
          paymentDate: paymentDateTime, // Use the combined Date+Time
          amount: paymentAmount,
          paymentMethod: purchaseData.paymentMethod,
          paymentAccount: purchaseData.paymentAccount,
          notes: 'Immediate Payment',
          createdAt: paymentDateTime, // Use the combined Date+Time
          type: 'purchase_payment'
        });

        // Update Account Balance
        transaction.update(accountRef, {
          currentBalance: increment(-paymentAmount)
        });
        
        // Add Ledger Transaction
        const transRef = doc(collection(this.firestore, 'transactions'));
        transaction.set(transRef, {
             accountId: purchaseData.paymentAccount.id,
             amount: paymentAmount,
             type: 'expense',
             date: paymentDateTime, // Use the combined Date+Time
             description: `Payment for purchase ${purchaseData.referenceNo}`,
             debit: paymentAmount,
             credit: 0,
             createdAt: paymentDateTime // Use the combined Date+Time
        });
      }

      // 7b. Record the Advance Adjustment
      if (advanceUtilized > 0) {
        const adjustmentRef = doc(collection(this.firestore, 'payments'));
        transaction.set(adjustmentRef, {
          purchaseId: purchaseRef.id,
          supplierId: purchaseData.supplierId,
          supplierName: purchaseData.supplierName,
          referenceNo: `ADJ-${purchaseData.referenceNo}`,
          paymentDate: purchaseData.paidOn,
          amount: advanceUtilized,
          paymentMethod: 'Advance Adjustment',
          notes: 'Auto-adjusted from Supplier Advance Balance',
          createdAt: Timestamp.now(),
          type: 'advance_adjustment'
        });
      }

      return { id: purchaseRef.id };
    });
  } catch (error) {
    console.error('❌ Error in createPurchase:', error);
    throw error;
  }
}
/**
   * Atomically adds a payment to a purchase. It creates a payment record,
   * a financial transaction, and updates both the purchase and supplier balances.
   * This is the definitive method for handling payments against a specific purchase.
   * @param paymentData The payment details.
   * @returns A promise that resolves when the transaction is complete.
   */
  async addPaymentToPurchase(paymentData: {
    purchaseId: string;
    supplierId: string;
    amount: number;
    paymentDate: Date;
    paymentMethod: string;
    paymentAccount: { id: string, name: string };
    paymentNote: string;
    referenceNo: string;
    supplierName: string;
  }): Promise<void> {

    // Define references to all documents that will be part of the transaction
    const purchaseRef = doc(this.firestore, 'purchases', paymentData.purchaseId);
    const supplierRef = doc(this.firestore, 'suppliers', paymentData.supplierId);
    const accountRef = doc(this.firestore, 'accounts', paymentData.paymentAccount.id);

    try {
      await runTransaction(this.firestore, async (transaction) => {
        // 1. --- READ PHASE: Execute all reads first ---
        const purchaseDoc = await transaction.get(purchaseRef);
        const supplierDoc = await transaction.get(supplierRef);
        const accountDoc = await transaction.get(accountRef);

        if (!purchaseDoc.exists()) {
          throw new Error(`Purchase with ID ${paymentData.purchaseId} not found.`);
        }
        if (!supplierDoc.exists()) {
          throw new Error(`Supplier with ID ${paymentData.supplierId} not found.`);
        }
        if (!accountDoc.exists()) {
          throw new Error(`Payment Account with ID ${paymentData.paymentAccount.id} not found.`);
        }

        // 2. --- LOGIC & PREPARATION PHASE (No reads or writes here) ---
        const originalPurchaseData = purchaseDoc.data() as Purchase;
        const amountToAdd = Number(paymentData.amount);

        // Calculate new payment details for the purchase
        const newPaymentAmount = (originalPurchaseData.paymentAmount || 0) + amountToAdd;
        const grandTotal = originalPurchaseData.grandTotal || 0;
        const newPaymentDue = Math.max(0, grandTotal - newPaymentAmount);
        const newPaymentStatus = this.calculatePaymentStatus(newPaymentAmount, grandTotal);

        // Prepare new document references for records to be created
        const newPaymentRef = doc(collection(this.firestore, 'payments'));
        const newTransactionRef = doc(collection(this.firestore, 'transactions'));

        // 3. --- WRITE PHASE: Execute all writes last ---

        // Write 1: Update the purchase document with new payment info
        transaction.update(purchaseRef, {
          paymentAmount: newPaymentAmount,
          paymentDue: newPaymentDue,
          paymentStatus: newPaymentStatus,
          updatedAt: Timestamp.now()
        });

        // Write 2: Update the supplier's balance. Payment reduces what you owe.
        // Using increment is safer than read-calculate-write.
        transaction.update(supplierRef, {
          balance: increment(-amountToAdd)
        });

        // Write 3: Create a record in the 'payments' collection
        transaction.set(newPaymentRef, {
          purchaseId: paymentData.purchaseId,
          supplierId: paymentData.supplierId,
          supplierName: paymentData.supplierName,
          referenceNo: paymentData.referenceNo,
          paymentDate: paymentData.paymentDate,
          amount: amountToAdd,
          paymentMethod: paymentData.paymentMethod,
          paymentAccount: paymentData.paymentAccount,
          paymentNote: paymentData.paymentNote,
          // ✅ CHANGED: Use the selected paymentDate instead of Timestamp.now()
          createdAt: paymentData.paymentDate, 
          type: 'purchase' 
        });

        // Write 4: Create a debit entry in the main 'transactions' ledger
        transaction.set(newTransactionRef, {
          accountId: paymentData.paymentAccount.id,
          amount: amountToAdd,
          type: 'purchase_payment', // Specific type for clarity in accounting
          date: paymentData.paymentDate,
          reference: `PUR-${paymentData.referenceNo}`,
          relatedDocId: paymentData.purchaseId,
          description: `Payment for purchase ${paymentData.referenceNo} to ${paymentData.supplierName}`,
          paymentMethod: paymentData.paymentMethod,
          debit: amountToAdd,
          credit: 0,
          // ✅ CHANGED: Use the selected paymentDate. 
          // This ensures the Account Book displays/sorts by the date you selected, not the current system time.
          createdAt: paymentData.paymentDate 
        });
      });
      console.log('Payment transaction completed successfully.');
    } catch (error) {
      console.error("Error in addPaymentToPurchase transaction:", error);
      // Re-throw the error so the component can catch it and show a message
      throw error;
    }
  }
// In src/app/services/purchase.service.ts

  /**
   * [FIXED FOR BALANCE SHEET]
   * Atomically updates an existing purchase and handles all related financial adjustments.
   * This now correctly updates the supplier's balance based on changes to BOTH the
   * grand total and the payment amount, ensuring the 'Sundry Creditors' liability
   * on the balance sheet is accurate.
   * @param id The ID of the purchase to update.
   * @param updateData The data to update.
   * @returns A promise that resolves when the transaction is complete.
   */
 // In src/app/services/purchase.service.ts

  /**
// In src/app/services/purchase.service.ts

  /**
   * [FIXED FOR BALANCE SHEET]
   * Atomically updates an existing purchase and handles all related financial adjustments.
   * This now correctly updates the supplier's balance based on changes to BOTH the
   * grand total and the payment amount, ensuring the 'Sundry Creditors' liability
   * on the balance sheet is accurate.
   * @param id The ID of the purchase to update.
   * @param updateData The data to update.
   * @returns A promise that resolves when the transaction is complete.
   */
  async updatePurchase(id: string, updateData: Partial<Purchase>): Promise<void> {
    try {
        if (!id) {
            throw new Error('Purchase ID is required for update');
        }

        const purchaseRef = doc(this.firestore, 'purchases', id);

        await runTransaction(this.firestore, async (transaction) => {
            const purchaseDoc = await transaction.get(purchaseRef);
            if (!purchaseDoc.exists()) {
                throw new Error("Purchase not found");
            }

            const originalPurchase = purchaseDoc.data() as Purchase;
            
            // ======================= ✅ THE FIX: Part 1 - Calculate Differences =======================
            const originalPaymentDue = (originalPurchase.grandTotal || 0) - (originalPurchase.paymentAmount || 0);

            // Determine the new grandTotal and paymentAmount after the update
            const newGrandTotal = updateData.grandTotal !== undefined ? updateData.grandTotal : (originalPurchase.grandTotal || 0);
            const newPaymentAmount = updateData.paymentAmount !== undefined ? updateData.paymentAmount : (originalPurchase.paymentAmount || 0);
            const newPaymentDue = Math.max(0, newGrandTotal - newPaymentAmount);
            
            // This is the crucial calculation: the change in liability
            const balanceIncrement = newPaymentDue - originalPaymentDue;
            // =================================== END OF FIX: Part 1 ===================================

            // Recalculate totals and statuses for the purchase document
            updateData.paymentDue = newPaymentDue;
            updateData.paymentStatus = this.calculatePaymentStatus(newPaymentAmount, newGrandTotal);
            updateData.updatedAt = new Date();

            // Update the main purchase document
            transaction.update(purchaseRef, updateData);

            // ======================= ✅ THE FIX: Part 2 - Apply Balance Change =======================
            // Update supplier balance if the amount owed has changed
            if (originalPurchase.supplierId && balanceIncrement !== 0) {
                const supplierRef = doc(this.suppliersCollection, originalPurchase.supplierId);
                // The change in what we owe is the difference between the new and old due amounts
                transaction.update(supplierRef, { balance: increment(balanceIncrement) });
            }
            // =================================== END OF FIX: Part 2 ===================================

            // (Your existing logic for handling payment adjustments can remain here)
            const paymentDifference = newPaymentAmount - (originalPurchase.paymentAmount || 0);
            if (paymentDifference !== 0 && updateData.paymentAccount?.id) {
                const accTransactionRef = doc(collection(this.firestore, 'transactions'));
                const accountTransaction = {
                    accountId: updateData.paymentAccount.id,
                    amount: Math.abs(paymentDifference),
                    type: paymentDifference > 0 ? 'expense' : 'income', 
                    date: new Date(),
                    reference: `PUR-ADJ-${originalPurchase.referenceNo}`,
                    relatedDocId: id,
                    description: `Payment adjustment for purchase ${originalPurchase.referenceNo}`,
                    paymentMethod: updateData.paymentMethod,
                    debit: paymentDifference > 0 ? paymentDifference : 0,
                    credit: paymentDifference < 0 ? -paymentDifference : 0,
                    createdAt: new Date()
                };
                transaction.set(accTransactionRef, accountTransaction);
            }
        });
    } catch (error) {
        console.error('Error updating purchase:', error);
        throw error;
    }
  }
  async getPurchasesByDateRange(startDate: Date, endDate: Date): Promise<Purchase[]> {
    try {
      const q = query(
        this.purchasesCollection,
        where('purchaseDate', '>=', startDate),
        where('purchaseDate', '<=', endDate)
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data() as Purchase
      }));
    } catch (error) {
      console.error('Error fetching purchases by date range:', error);
      throw error;
    }
  }
    async getPaymentAccounts(): Promise<PaymentAccount[]> {
      try {
        const snapshot = await getDocs(this.paymentAccountsCollection);
        return snapshot.docs.map(doc => {
          const data = doc.data() as PaymentAccount;
          return {
            ...data,
            id: doc.id
          };
        });
      } catch (error) {
        console.error('Error fetching payment accounts:', error);
        throw error;
      }
    }

    async addPurchase(purchase: Purchase): Promise<any> {
      const paymentDue = purchase.purchaseTotal - purchase.paymentAmount;
      const paymentStatus = this.calculatePaymentStatus(purchase.paymentAmount, purchase.purchaseTotal);

      const purchaseData = {
        ...purchase,
        purchaseDate: new Date(purchase.purchaseDate),
        paidOn: new Date(purchase.paidOn),
        paymentDue,
        paymentStatus,
        grandTotal: purchase.purchaseTotal,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      try {
        const docRef = await addDoc(this.purchasesCollection, purchaseData);
        return { id: docRef.id, ...purchaseData };
      } catch (error) {
        console.error('Error adding purchase:', error);
        throw error;
      }
    }

    getPurchases(): Observable<Purchase[]> {
      return new Observable(observer => {
        const unsubscribe = onSnapshot(this.purchasesCollection, (snapshot) => {
          const purchases = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data() as Purchase
          }));
          observer.next(purchases);
        }, (error) => {
          console.error('Error fetching purchases:', error);
          observer.error(error);
        });

        return () => unsubscribe();
      });
    }
  getPurchasesBySupplier(supplierId: string): Observable<Purchase[]> {
    return new Observable<Purchase[]>(observer => {
      const q = query(
        collection(this.firestore, 'purchases'),
        where('supplierId', '==', supplierId)
      );

      const unsubscribe = onSnapshot(q,
        (querySnapshot: QuerySnapshot<DocumentData>) => {
          const purchases: Purchase[] = [];
          querySnapshot.forEach((doc) => {
            const data = doc.data();
            const purchase: Purchase = {
              id: doc.id,
              supplierId: data['supplierId'],
              supplierName: data['supplierName'],
              referenceNo: data['referenceNo'],
              purchaseDate: data['purchaseDate']?.toDate(),
              purchaseStatus: data['purchaseStatus'],
              businessLocation: data['businessLocation'],
              purchaseTotal: data['purchaseTotal'] || 0,
              paymentAmount: data['paymentAmount'] || 0,
              paymentMethod: data['paymentMethod'],
              paymentStatus: data['paymentStatus'],
              products: data['products'] || [],
              grandTotal: data['grandTotal'] || data['purchaseTotal'] || 0,
              paymentDue: data['paymentDue'] || 0,
              paidOn: undefined
            };
            purchases.push(purchase);
          });
          observer.next(purchases);
        },
        (error) => {
          console.error('Error fetching supplier purchases:', error);
          observer.error(error);
        }
      );

      return () => unsubscribe();
    });
  }
    async getPurchaseById(id: string): Promise<Purchase> {
      try {
        const purchaseRef = doc(this.firestore, 'purchases', id);
        const purchaseSnap = await getDoc(purchaseRef);

        if (purchaseSnap.exists()) {
          return { id: purchaseSnap.id, ...purchaseSnap.data() } as Purchase;
        } else {
          throw new Error('Purchase not found');
        }
      } catch (error) {
        console.error('Error fetching purchase:', error);
        throw error;
      }
    }


    async getPurchasesByProductId(productId: string): Promise<Purchase[]> {
      try {
        const querySnapshot = await getDocs(this.purchasesCollection);
        const purchases: Purchase[] = [];

        querySnapshot.forEach(doc => {
          const purchaseData = doc.data() as Purchase;

          const products = purchaseData.products || [];

          const hasProduct = products.some(item =>
            item.productId === productId
          );

          if (hasProduct) {
            purchases.push({
              id: doc.id,
              ...purchaseData
            });
          }
        });

        return purchases;
      } catch (error) {
        console.error('Error fetching purchases by product:', error);
        throw error;
      }
    }
// in src/app/services/purchase.service.ts

// in src/app/services/purchase.service.ts

// ... inside the PurchaseService class

 async updatePurchaseAfterReturn(purchaseId: string, returnAmount: number): Promise<void> {
    if (!purchaseId) {
      console.error('Cannot update purchase after return: Purchase ID is missing.');
      return;
    }

    const purchaseRef = doc(this.purchasesCollection, purchaseId);

    try {
      await runTransaction(this.firestore, async (transaction) => {
        const purchaseDoc = await transaction.get(purchaseRef);
        if (!purchaseDoc.exists()) {
          throw new Error(`Original purchase with ID ${purchaseId} not found.`);
        }

        const originalPurchase = purchaseDoc.data() as Purchase;
        const grandTotal = originalPurchase.grandTotal || 0;
        const paymentAmount = originalPurchase.paymentAmount || 0;
        const previouslyReturned = originalPurchase.totalReturned || 0;

        // 1. Calculate the new total amount returned
        const newTotalReturned = previouslyReturned + returnAmount;

        // 2. Calculate the new effective total and the new due amount
        const effectiveTotal = grandTotal - newTotalReturned;
        const newPaymentDue = Math.max(0, effectiveTotal - paymentAmount);

        // 3. Determine the new payment status based on the effective total
        const newPaymentStatus = this.calculatePaymentStatus(paymentAmount, effectiveTotal);

        // 4. Update the original purchase document with all the new, correct values
        transaction.update(purchaseRef, {
          totalReturned: newTotalReturned,
          paymentDue: newPaymentDue,
          paymentStatus: newPaymentStatus,
          updatedAt: Timestamp.now()
        });
      });

      console.log(`✅ Successfully updated original purchase ${purchaseId}. New Payment Due: ₹${(await this.getPurchaseById(purchaseId)).paymentDue?.toFixed(2)}`);

    } catch (error) {
      console.error(`Error updating purchase ${purchaseId} after return:`, error);
      // Do not re-throw, as the return itself was successful. Log the error.
    }
  }

// ... rest of the class
  async updatePurchasePayment(purchaseId: string, amount: number): Promise<void> {
    if (!purchaseId || amount === undefined || amount === null) {
      throw new Error('Purchase ID and amount are required');
    }

    try {
      const purchaseRef = doc(this.firestore, 'purchases', purchaseId);

      await runTransaction(this.firestore, async (transaction) => {
        const purchaseDoc = await transaction.get(purchaseRef);

        if (!purchaseDoc.exists()) {
          throw new Error('Purchase not found');
        }

        const purchase = purchaseDoc.data() as Purchase;
        const currentPayment = purchase.paymentAmount || 0;
        const grandTotal = purchase.grandTotal || purchase.purchaseTotal || 0;

        const newPaymentAmount = currentPayment + amount;
        const newPaymentDue = Math.max(grandTotal - newPaymentAmount, 0);

        const paymentStatus = this.calculatePaymentStatus(newPaymentAmount, grandTotal);

        transaction.update(purchaseRef, {
          paymentAmount: newPaymentAmount,
          paymentDue: newPaymentDue,
          paymentStatus: paymentStatus,
          updatedAt: Timestamp.now()
        });
      });
    } catch (error) {
      console.error('Error updating purchase payment:', error);
      throw error;
    }
  }

   getPurchasesBySupplierName(supplierName: string): Observable<Purchase[]> {
      return new Observable<Purchase[]>(observer => {
        const q = query(
          collection(this.firestore, 'purchases'),
          where('supplierName', '==', supplierName)
        );

        const unsubscribe = onSnapshot(q,
          (querySnapshot: QuerySnapshot<DocumentData>) => {
            const purchases: Purchase[] = [];
            querySnapshot.forEach((doc) => {
              const data = doc.data();
              const purchase: Purchase = {
                id: doc.id,
                supplierId: data['supplierId'],
                supplierName: data['supplierName'],
                referenceNo: data['referenceNo'],
                purchaseDate: data['purchaseDate']?.toDate(),
                purchaseStatus: data['purchaseStatus'],
                businessLocation: data['businessLocation'],
                purchaseTotal: data['purchaseTotal'] || 0,
                paymentAmount: data['paymentAmount'] || 0,
                paymentMethod: data['paymentMethod'],
                paymentStatus: data['paymentStatus'],
                products: data['products'] || [],
                grandTotal: data['grandTotal'] || data['purchaseTotal'] || 0,
                createdAt: data['createdAt']?.toDate(),
                updatedAt: data['updatedAt']?.toDate(),
                paidOn: data['paidOn']?.toDate()
              };
              purchases.push(purchase);
            });
            observer.next(purchases);
          },
          (error) => {
            console.error('Error fetching purchases by supplier name:', error);
            observer.error(error);
          }
        );

        return () => unsubscribe();
      });
    }

  /**
   * Atomically adds a payment to a purchase. It creates a payment record,
   * a financial transaction, and updates both the purchase and supplier balances.
   * This is the definitive method for handling payments against a specific purchase.
   * @param paymentData The payment details.
   * @returns A promise that resolves when the transaction is complete.
   */
// src/app/services/purchase.service.ts




  // Helper method to calculate payment status
  private calculatePaymentStatus(paymentAmount: number, totalAmount: number): string {
    if (paymentAmount === undefined || paymentAmount <= 0) return 'Due';
    // Use a small epsilon for floating point comparisons
    if (paymentAmount >= totalAmount - 0.01) return 'Paid';
    if (paymentAmount > 0) return 'Partial';
    return 'Due';
  }


}