/**
 * Purchase Return Component
 * 
 * This component handles purchase returns with proper location-wise stock management.
 * 
 * Key Features:
 * - Location-aware stock returns using product-stock collection
 * - Stock history tracking for all return transactions
 * - Purchase return logging for audit trail
 * - Validation of return quantities against available stock
 * - Bulk return processing capabilities
 * - Integration with existing purchase return workflow
 * 
 * Stock Management:
 * - Uses product-stock collection with document IDs: {productId}_{locationId}
 * - Creates history entries in product-stock-history collection
 * - Creates log entries in purchase-return-log collection
 * - Validates stock availability before processing returns
 * - Updates stock quantities when returns are marked as 'completed'
 * 
 * Data Structure:
 * - businessLocationId: Required for location-specific stock updates
 * - products: Array with productId, quantity, and other product details
 * - returnStatus: 'pending', 'completed', 'rejected', etc.
 */

import { Component, OnInit, OnDestroy } from '@angular/core';
import { PurchaseReturnService } from '../services/purchase-return.service';
import { AccountService } from '../services/account.service';
import { PurchaseService } from '../services/purchase.service';
import { Subscription } from 'rxjs';
import { Modal } from 'bootstrap';
import * as XLSX from 'xlsx';
import * as FileSaver from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Firestore, collection, doc, getDoc, setDoc, updateDoc, addDoc } from '@angular/fire/firestore';
import { COLLECTIONS } from '../../utils/constants';

interface PurchaseReturn {
  id?: string;
  returnDate: string;
  referenceNo: string;
  parentPurchaseId: string;
  parentPurchaseRef: string;
  businessLocation: string;
  businessLocationId?: string;
  supplier: string;
  returnStatus: string;
  paymentStatus: string;
  products: any[];
  reason: string;
  grandTotal: number;
  createdAt: Date;
  createdBy: string;
}

interface PurchaseReturnProduct {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  totalCost: number;
  batchNumber?: string;
  expiryDate?: Date;
  returnQuantity?: number;
  subtotal?: number;
  name?: string;
  id?: string;
}

interface PurchaseReturnLog {
  id?: string;
  purchaseRefNo: string;
  returnDate: string | Date;
  purchasedQuantity: number;
  returnQuantity: number;
  subTotal: number;
  productId: string;
  productName: string;
  businessLocation: string;
  businessLocationId: string;
  createdAt: Date;
  updatedAt: Date;
}

@Component({
  selector: 'app-purchase-return',
  templateUrl: './purchase-return.component.html',
  styleUrls: ['./purchase-return.component.scss']
})
export class PurchaseReturnComponent implements OnInit, OnDestroy {
  purchaseReturns: PurchaseReturn[] = [];
  sortedPurchaseReturns: PurchaseReturn[] = [];
  isLoading = true;
  isUpdating = false;
  errorMessage: string | null = null;
  pageSize = 25;
  currentPage = 1;
  sortColumn: string = 'returnDate';
  sortDirection: 'asc' | 'desc' = 'desc';

  selectedReturn!: PurchaseReturn;
  tempStatus: string = '';
  private subscription!: Subscription;

  constructor(
    private purchaseReturnService: PurchaseReturnService,
    private accountService: AccountService,
    private purchaseService: PurchaseService,
    private firestore: Firestore
  ) {}

  ngOnInit(): void {
    this.loadPurchaseReturns();
  }

  loadPurchaseReturns(): void {
    this.subscription = this.purchaseReturnService.getPurchaseReturns().subscribe({
      next: async (data) => {
        this.purchaseReturns = data;
        
        // Fetch product details for each unique parent purchase
        const uniqueParentPurchaseIds = [...new Set(data.map(item => item.parentPurchaseId))];
        await Promise.all(
          uniqueParentPurchaseIds.map(id => this.fetchProductDetailsFromParentPurchase(id))
        );
        
        this.sortData();
        this.isLoading = false;
        this.errorMessage = null;
      },
      error: (err) => {
        this.errorMessage = 'Failed to load purchase returns. Please refresh or try again later.';
        this.isLoading = false;
      }
    });
  }

  ngOnDestroy(): void {
    if (this.subscription) this.subscription.unsubscribe();
  }

  get totalRecords(): number {
    return this.purchaseReturns.length;
  }

  get totalGrandTotal(): number {
    return this.purchaseReturns.reduce((sum, item) => sum + item.grandTotal, 0);
  }

  get totalPaymentDue(): number {
    return this.purchaseReturns.reduce((sum, item) => sum + item.grandTotal, 0);
  }

  async fetchProductDetailsFromParentPurchase(parentPurchaseId: string): Promise<void> {
    try {
      // Get the parent purchase
      const parentPurchase = await this.purchaseService.getPurchaseById(parentPurchaseId);
      
      if (!parentPurchase) {
        console.error('Parent purchase not found');
        return;
      }

      // Update purchase returns with product details
      this.purchaseReturns = this.purchaseReturns.map(returnItem => {
        if (returnItem.parentPurchaseId === parentPurchaseId) {
          // Map products with names and unit prices
          const productsWithDetails = returnItem.products.map(returnProduct => {
            // Find matching product in parent purchase
            const parentProduct = parentPurchase.products?.find(
              p => p.productId === returnProduct.productId
            );
            
            return {
              ...returnProduct,
              productName: parentProduct?.productName || 'Unknown Product',
              unitPrice: parentProduct?.unitCost || 0
            };
          });

          return {
            ...returnItem,
            products: productsWithDetails
          };
        }
        return returnItem;
      });

      // Update sorted purchase returns
      this.sortData();
      
    } catch (error) {
      console.error('Error fetching parent purchase details:', error);
    }
  }

  getStatusClass(status: string): string {
    const statusMap: Record<string, string> = {
      'completed': 'badge bg-success',
      'pending': 'badge bg-warning text-dark',
      'partial': 'badge bg-info',
      'rejected': 'badge bg-danger',
    };
    return statusMap[status.toLowerCase()] || 'badge bg-secondary';
  }

  sort(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.sortData();
  }

  sortData(): void {
    this.sortedPurchaseReturns = [...this.purchaseReturns].sort((a, b) => {
      const aValue = a[this.sortColumn as keyof PurchaseReturn];
      const bValue = b[this.sortColumn as keyof PurchaseReturn];
  
      // Handle undefined/null values
      if (aValue === undefined || aValue === null) return 1;
      if (bValue === undefined || bValue === null) return -1;
      if (aValue === undefined && bValue === undefined) return 0;
      if (aValue === null && bValue === null) return 0;
  
      // For string comparison
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return this.sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
  
      // For number comparison
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return this.sortDirection === 'asc' 
          ? aValue - bValue
          : bValue - aValue;
      }
  
      // Fallback for other types
      return this.sortDirection === 'asc'
        ? String(aValue).localeCompare(String(bValue))
        : String(bValue).localeCompare(String(aValue));
    });
  }

  /**
   * Process purchase return and update stock at specific location
   * Updated to include log creation in both collections
   */
  async processPurchaseReturn(returnData: PurchaseReturn): Promise<void> {
    try {
      if (!returnData.businessLocationId && returnData.businessLocation) {
        // Extract location ID from businessLocation if it's an object
        const location = typeof returnData.businessLocation === 'object' 
          ? (returnData.businessLocation as any).id 
          : returnData.businessLocation;
        returnData.businessLocationId = location;
      }

      // Get the original purchase details for proper logging
      const originalPurchase = await this.purchaseService.getPurchaseById(returnData.parentPurchaseId);
      
      if (!originalPurchase) {
        throw new Error('Original purchase not found');
      }

      // Process each product in the return
      for (const product of returnData.products) {
        // Find the original purchased quantity from the parent purchase
        const originalProduct = originalPurchase.products?.find(
          p => p.productId === (product.productId || product.id)
        );
        
        const purchasedQuantity = originalProduct?.quantity || 0;
        const returnQuantity = product.quantity || product.returnQuantity || 0;
        const subTotal = returnQuantity * (product.unitPrice || originalProduct?.unitCost || 0);

        // Update stock
        await this.returnProductStock(
          product.productId || product.id,
          returnData.businessLocationId!,
          returnQuantity,
          returnData.referenceNo,
          `Purchase return: ${returnData.reason}`
        );

        // Create individual log entry for each product
        await this.createPurchaseReturnLogEntry({
          purchaseRefNo: returnData.parentPurchaseRef,
          returnDate: returnData.returnDate,
          purchasedQuantity: purchasedQuantity,
          returnQuantity: returnQuantity,
          subTotal: subTotal,
          productId: product.productId || product.id!,
          productName: product.productName || product.name!,
          businessLocation: returnData.businessLocation,
          businessLocationId: returnData.businessLocationId!,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      // Create transaction record for the purchase return
      await this.createReturnTransaction(returnData);

      // Update return status
      await this.updateReturnStatus(returnData.id!, 'completed');
      
    } catch (error) {
      console.error('Error processing purchase return:', error);
      throw error;
    }
  }

  /**
   * Create individual log entry for purchase return
   */
  private async createPurchaseReturnLogEntry(logData: PurchaseReturnLog): Promise<void> {
    try {
      const logCollection = collection(this.firestore, 'purchase-return-log');
      await addDoc(logCollection, logData);
      console.log('Purchase return log entry created:', logData);
    } catch (error) {
      console.error('Error creating purchase return log entry:', error);
      throw error; // Re-throw to handle in the calling function
    }
  }

  /**
   * Return stock to location-specific inventory
   */
  private async returnProductStock(
    productId: string,
    locationId: string,
    quantity: number,
    referenceNo: string,
    notes: string
  ): Promise<void> {
    try {
      // Get current stock for this product at this location
      const stockDocId = `${productId}_${locationId}`;
      const stockDocRef = doc(this.firestore, COLLECTIONS.PRODUCT_STOCK, stockDocId);
      const stockDoc = await getDoc(stockDocRef);
      
      let currentStock = 0;
      if (stockDoc.exists()) {
        currentStock = stockDoc.data()['quantity'] || 0;
      }
      
      const newStock = currentStock + quantity;
      
      // Update stock
      await setDoc(stockDocRef, {
        productId: productId,
        locationId: locationId,
        quantity: newStock,
        lastUpdated: new Date(),
        updatedBy: 'system'
      }, { merge: true });
      
      // Create stock history entry
      await this.createStockHistoryEntry({
        productId,
        locationId,
        action: 'return',
        quantity,
        oldStock: currentStock,
        newStock,
        referenceNo,
        notes,
        userId: 'system'
      });
      
    } catch (error) {
      console.error('Error returning product stock:', error);
      throw error;
    }
  }

  /**
   * Create stock history entry for returns
   */
  private async createStockHistoryEntry(entry: {
    productId: string;
    locationId: string;
    action: string;
    quantity: number;
    oldStock: number;
    newStock: number;
    referenceNo: string;
    notes: string;
    userId: string;
  }): Promise<void> {
    try {
      const historyCollection = collection(this.firestore, COLLECTIONS.PRODUCT_STOCK_HISTORY);
      await setDoc(doc(historyCollection), {
        ...entry,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error creating stock history entry:', error);
    }
  }

  /**
   * Get current stock for a product at a location
   */
  async getCurrentStock(productId: string, locationId: string): Promise<number> {
    try {
      const stockDocId = `${productId}_${locationId}`;
      const stockDocRef = doc(this.firestore, COLLECTIONS.PRODUCT_STOCK, stockDocId);
      const stockDoc = await getDoc(stockDocRef);
      
      if (stockDoc.exists()) {
        return stockDoc.data()['quantity'] || 0;
      }
      return 0;
    } catch (error) {
      console.error('Error getting current stock:', error);
      return 0;
    }
  }

  onDelete(id: string): void {
    if (confirm('Delete this purchase return? This action cannot be undone.')) {
      this.purchaseReturnService.deletePurchaseReturn(id)
        .then(() => {
          this.purchaseReturns = this.purchaseReturns.filter(item => item.id !== id);
          this.sortData();
        })
        .catch(err => this.errorMessage = 'Delete failed. Please try again.');
    }
  }

  onExport(format: string): void {
    if (format === 'excel') {
      const worksheet = XLSX.utils.json_to_sheet(this.purchaseReturns);
      const workbook = { Sheets: { 'PurchaseReturns': worksheet }, SheetNames: ['PurchaseReturns'] };
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      FileSaver.saveAs(new Blob([excelBuffer], { type: 'application/octet-stream' }), 'PurchaseReturns.xlsx');
    } else if (format === 'csv') {
      const worksheet = XLSX.utils.json_to_sheet(this.purchaseReturns);
      const csv = XLSX.utils.sheet_to_csv(worksheet);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      FileSaver.saveAs(blob, 'PurchaseReturns.csv');
    } else if (format === 'pdf') {
      const doc = new jsPDF();
      const headers = [['Return Date', 'Reference No', 'Supplier', 'Status', 'Payment', 'Grand Total']];
      const rows = this.purchaseReturns.map(item => [
        item.returnDate,
        item.referenceNo,
        item.supplier,
        item.returnStatus,
        item.paymentStatus,
        item.grandTotal.toFixed(2)
      ]);

      autoTable(doc, {
        head: headers,
        body: rows,
        startY: 20,
        theme: 'striped',
        headStyles: { fillColor: [41, 128, 185] }
      });

      doc.save('PurchaseReturns.pdf');
    } else if (format === 'print') {
      const printSection = document.getElementById('print-section');
      if (!printSection) {
        console.error('Print section not found');
        return;
      }
      
      const popupWin = window.open('', '_blank', 'width=1000,height=800');
      if (!popupWin) {
        alert('Please allow pop-ups for printing');
        return;
      }
      
      const printContents = printSection.innerHTML;
      
      popupWin.document.open();
      popupWin.document.write(`
        <html>
          <head>
            <title>Purchase Return Print</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
              th { background-color: #f4f4f4; }
              h2 { text-align: center; }
              p { text-align: right; }
              tfoot td { font-weight: bold; }
            </style>
          </head>
          <body>
            ${printContents}
            <script>
              window.onload = function() {
                window.print();
                window.setTimeout(function() {
                  window.close();
                }, 500);
              }
            </script>
          </body>
        </html>
      `);
      popupWin.document.close();
    }
  }

  /**
   * Process multiple returns at once
   */
  async processBulkReturns(returnIds: string[]): Promise<void> {
    this.isUpdating = true;
    let processedCount = 0;
    
    try {
      for (const id of returnIds) {
        const returnItem = this.purchaseReturns.find(item => item.id === id);
        if (returnItem && returnItem.returnStatus !== 'completed') {
          await this.processPurchaseReturn(returnItem);
          processedCount++;
        }
      }
      
      this.errorMessage = null;
      alert(`Successfully processed ${processedCount} returns.`);
      
    } catch (error) {
      console.error('Error processing bulk returns:', error);
      this.errorMessage = `Failed to process some returns. ${processedCount} were successful.`;
    } finally {
      this.isUpdating = false;
    }
  }

  /**
   * Validate return before processing
   */
  validateReturn(returnData: PurchaseReturn): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!returnData.businessLocationId && !returnData.businessLocation) {
      errors.push('Business location is required');
    }
    
    if (!returnData.products || returnData.products.length === 0) {
      errors.push('At least one product is required');
    }
    
    for (const product of returnData.products) {
      if (!product.productId && !product.id) {
        errors.push(`Product ID is missing for ${product.productName || 'unknown product'}`);
      }
      
      if (!product.quantity || product.quantity <= 0) {
        errors.push(`Invalid quantity for ${product.productName || 'unknown product'}`);
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get return impact summary before processing
   */
  async getReturnImpactSummary(returnData: PurchaseReturn): Promise<any> {
    const summary = {
      locationId: returnData.businessLocationId,
      products: [] as any[]
    };
    
    for (const product of returnData.products) {
      const currentStock = await this.getCurrentStock(
        product.productId || product.id,
        returnData.businessLocationId!
      );
      
      summary.products.push({
        productId: product.productId || product.id,
        productName: product.productName,
        sku: product.sku,
        currentStock,
        returnQuantity: product.quantity,
        newStock: currentStock + product.quantity
      });
    }
    
    return summary;
  }

  openStatusModal(returnItem: PurchaseReturn): void {
    this.selectedReturn = returnItem;
    this.tempStatus = returnItem.returnStatus;
  }

  async updateReturnStatus(id: string, newStatus: string): Promise<void> {
    this.isUpdating = true;
    
    try {
      // If status is being changed to 'completed', process the stock return
      if (newStatus === 'completed') {
        const returnItem = this.purchaseReturns.find(item => item.id === id);
        if (returnItem && returnItem.returnStatus !== 'completed') {
          await this.processPurchaseReturn(returnItem);
        }
      }
      
      // Update the return status
      await this.purchaseReturnService.updatePurchaseReturn(id, {
        returnStatus: newStatus
      });
      
      // Update local data
      const index = this.purchaseReturns.findIndex(item => item.id === id);
      if (index !== -1) {
        this.purchaseReturns[index].returnStatus = newStatus;
        this.sortData();
      }
      
      this.isUpdating = false;
      const modalElement = document.getElementById('statusModal');
      if (modalElement) {
        const modalInstance = Modal.getInstance(modalElement);
        modalInstance?.hide();
      }
      
    } catch (error) {
      console.error('Error updating return status:', error);
      this.errorMessage = 'Failed to update status. Please try again.';
      this.isUpdating = false;
    }
  }

  /**
   * Create transaction record for purchase return
   */
  private async createReturnTransaction(returnData: PurchaseReturn): Promise<void> {
    try {
      // Get the original purchase to find the payment account
      const originalPurchase = await this.purchaseService.getPurchaseById(returnData.parentPurchaseId);
      
      if (!originalPurchase) {
        console.warn('Original purchase not found for return:', returnData.parentPurchaseId);
        return;
      }

      // For purchase returns, we typically:
      // - Credit the same account that was debited during the original purchase
      // - This increases cash (if cash purchase) or reduces accounts payable (if credit purchase)
      
      const transactionData = {
        amount: returnData.grandTotal,
        type: 'purchase_return',
        date: new Date(returnData.returnDate),
        description: `Purchase Return: ${returnData.referenceNo} - ${returnData.reason}`,
        paymentMethod: originalPurchase.paymentMethod || 'Purchase Return',
        paymentDetails: returnData.referenceNo,
        note: `Returned to supplier: ${returnData.supplier}. Reason: ${returnData.reason}`,
        addedBy: returnData.createdBy || 'System',
        reference: returnData.referenceNo,
        relatedDocId: returnData.id || '',
        source: 'purchase_return',
        supplier: returnData.supplier,
        returnStatus: returnData.returnStatus,
        paymentStatus: returnData.paymentStatus,
        originalPurchaseId: returnData.parentPurchaseId
      };

      // Use the payment account from the original purchase
      const paymentAccountId = typeof originalPurchase.paymentAccount === 'object' 
        ? originalPurchase.paymentAccount.id 
        : originalPurchase.paymentAccount;
      
      if (paymentAccountId) {
        await this.accountService.addTransaction(paymentAccountId, transactionData);
      } else {
        console.warn('No payment account found in original purchase:', returnData.parentPurchaseId);
      }
      
    } catch (error) {
      console.error('Error creating return transaction:', error);
      // Don't throw here to avoid breaking the return process
    }
  }
}