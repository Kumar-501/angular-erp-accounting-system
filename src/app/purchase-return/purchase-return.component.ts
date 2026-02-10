import { Component, OnInit, OnDestroy } from '@angular/core';
import { PurchaseReturnService } from '../services/purchase-return.service';
import { AccountService } from '../services/account.service';
import { PurchaseService } from '../services/purchase.service';
import { Observable, Subscription } from 'rxjs';
import { Modal } from 'bootstrap';
import * as XLSX from 'xlsx';
import * as FileSaver from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Firestore, collection, doc, getDoc, setDoc, updateDoc, addDoc } from '@angular/fire/firestore';
import { COLLECTIONS } from '../../utils/constants';

interface PurchaseReturn {
  id?: string;
  returnDate: any; // Allow flexible date types from Firestore
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
  createdAt: any; // Allow flexible date types from Firestore
  createdBy: string;
}

interface PurchaseProduct {
  id?: string;
  productId: string;
  productName: string;
  name?: string;
  price?: number;
  unitCost?: number;
  // other product properties...
}

interface PurchaseReturnProduct {
  productId: string;
  productName: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  totalCost: number;
  batchNumber?: string;
  expiryDate?: Date;
  returnQuantity?: number;
  subtotal?: number;
  name?: string;
  id?: string;
  price?: number;
  unitCost?: number;
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
  filteredPurchaseReturns: PurchaseReturn[] = [];
  paginatedPurchaseReturns: PurchaseReturn[] = [];
  
  isLoading = true;
  isUpdating = false;
  errorMessage: string | null = null;
  
  // Pagination properties
  pageSize = 10;
  currentPage = 1;
  totalPages: number = 1;
  maxVisiblePages: number = 5;
  
  // Search properties
  searchTerm: string = '';
  
  // Sorting properties
  sortColumn: string = 'returnDate';
  sortDirection: 'asc' | 'desc' = 'desc';
  
  // Properties for the status update modal
  selectedReturn!: PurchaseReturn;
  tempStatus: string = '';
  tempPaymentStatus: string = ''; // Added for payment status
  
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
    this.isLoading = true;
    this.subscription = this.purchaseReturnService.getPurchaseReturns().subscribe({
      next: (returns) => {
        // Immediately parse dates upon loading data
        this.purchaseReturns = returns.map(r => ({
            ...r,
            returnDate: this.parseDate(r.returnDate),
            createdAt: this.parseDate(r.createdAt)
        }));
        this.sortedPurchaseReturns = [...this.purchaseReturns];
        this.isLoading = false;
        
        // Load product details for each return
        this.loadProductDetails();
        
        // Apply initial filtering and pagination
        this.applyFilter();
      },
      error: (err) => {
        console.error('Error loading returns:', err);
        this.isLoading = false;
        this.errorMessage = "Failed to load purchase returns. Please try again later.";
      }
    });
  }

  ngOnDestroy(): void {
    if (this.subscription) this.subscription.unsubscribe();
  }

  // START: DATE AND TIME METHODS
  private parseDate(dateValue: any): Date {
    if (!dateValue) return new Date();
    if (dateValue instanceof Date) return dateValue;
    if (typeof dateValue.toDate === 'function') return dateValue.toDate();
    if (typeof dateValue === 'object' && dateValue.seconds) {
      return new Date(dateValue.seconds * 1000 + (dateValue.nanoseconds || 0) / 1000000);
    }
    const parsed = new Date(dateValue);
    if (!isNaN(parsed.getTime())) return parsed;
    console.warn('Could not parse date:', dateValue);
    return new Date();
  }

  formatDate(date: any): string {
    const d = this.parseDate(date);
    if (!d) return '-';
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }
  // END: DATE AND TIME METHODS

  // START: SEARCH AND FILTER FUNCTIONALITY
  applyFilter(): void {
    if (!this.searchTerm.trim()) {
      this.filteredPurchaseReturns = [...this.sortedPurchaseReturns];
    } else {
      const term = this.searchTerm.toLowerCase().trim();
      this.filteredPurchaseReturns = this.sortedPurchaseReturns.filter(item => 
        item.referenceNo.toLowerCase().includes(term) ||
        item.parentPurchaseRef.toLowerCase().includes(term) ||
        item.supplier.toLowerCase().includes(term) ||
        item.businessLocation.toLowerCase().includes(term) ||
        item.returnStatus.toLowerCase().includes(term) ||
        item.paymentStatus.toLowerCase().includes(term) ||
        item.reason.toLowerCase().includes(term) ||
        item.grandTotal.toString().includes(term) ||
        (item.returnDate && this.formatDate(item.returnDate).toLowerCase().includes(term))
      );
    }
    
    this.currentPage = 1;
    this.updatePagination();
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.applyFilter();
  }

  onSearchInput(): void {
    this.applyFilter();
  }
  // END: SEARCH AND FILTER FUNCTIONALITY

  // START: PAGINATION FUNCTIONALITY
  updatePagination(): void {
    this.totalPages = Math.ceil(this.filteredPurchaseReturns.length / this.pageSize);
    this.updatePaginatedData();
  }

  updatePaginatedData(): void {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    this.paginatedPurchaseReturns = this.filteredPurchaseReturns.slice(startIndex, endIndex);
  }

  onPageSizeChange(): void {
    this.currentPage = 1;
    this.updatePagination();
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePaginatedData();
    }
  }

  getVisiblePages(): number[] {
    const pages: number[] = [];
    const start = Math.max(1, this.currentPage - Math.floor(this.maxVisiblePages / 2));
    const end = Math.min(this.totalPages, start + this.maxVisiblePages - 1);
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePaginatedData();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePaginatedData();
    }
  }
  // END: PAGINATION FUNCTIONALITY

  // START: DATA LOADING AND SORTING
  async loadProductDetails(): Promise<void> {
    for (const returnItem of this.purchaseReturns) {
      if (returnItem.parentPurchaseId) {
        try {
          const purchase = await this.purchaseService.getPurchaseById(returnItem.parentPurchaseId);
          if (purchase?.products && Array.isArray(purchase.products)) {
            returnItem.products = returnItem.products.map(returnProduct => {
              const originalProduct = purchase.products?.find(p => 
                (p as any).id === returnProduct.productId || p.productId === returnProduct.productId
              );
              return {
                ...returnProduct,
                productName: originalProduct?.['name'] ?? originalProduct?.productName ?? 'Unknown',
                unitPrice: originalProduct?.['price'] ?? originalProduct?.unitCost ?? 0
              };
            });
          }
        } catch (error) {
          console.error(`Error loading product details for return ${returnItem.referenceNo}:`, error);
        }
      }
    }
    this.sortData();
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
      let aValue = a[this.sortColumn as keyof PurchaseReturn];
      let bValue = b[this.sortColumn as keyof PurchaseReturn];

      if (this.sortColumn === 'returnDate' || this.sortColumn === 'createdAt') {
        aValue = this.parseDate(aValue).getTime();
        bValue = this.parseDate(bValue).getTime();
      }
  
      if (aValue === undefined || aValue === null) return 1;
      if (bValue === undefined || bValue === null) return -1;
  
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return this.sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
  
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return this.sortDirection === 'asc' 
          ? aValue - bValue
          : bValue - aValue;
      }
  
      return this.sortDirection === 'asc'
        ? String(aValue).localeCompare(String(bValue))
        : String(bValue).localeCompare(String(aValue));
    });
    this.applyFilter();
  }
  // END: DATA LOADING AND SORTING

  // START: MODAL AND STATUS UPDATE LOGIC
  openStatusModal(returnItem: PurchaseReturn): void {
    this.selectedReturn = {...returnItem}; // Create a copy to avoid direct modification
    this.tempStatus = returnItem.returnStatus;
    this.tempPaymentStatus = returnItem.paymentStatus; // Set payment status
    this.errorMessage = null; // Clear any previous errors
  }

  async updateStatuses(): Promise<void> {
    if (!this.selectedReturn || !this.selectedReturn.id) {
      this.errorMessage = "No return selected.";
      return;
    }

    this.isUpdating = true;
    this.errorMessage = null;

    const originalStatus = this.selectedReturn.returnStatus;
    const newStatus = this.tempStatus;

    const updateData = {
      returnStatus: this.tempStatus,
      paymentStatus: this.tempPaymentStatus,
    };

    try {
      // Step 1: Update statuses in Firestore.
      await this.purchaseReturnService.updatePurchaseReturn(this.selectedReturn.id, updateData);
      
      // Step 2: If the return status is newly 'completed', process the stock and transaction logic.
      if (newStatus === 'completed' && originalStatus !== 'completed') {
        // We need the full return item for processing. Let's merge the updates.
        const fullReturnItem = { ...this.selectedReturn, ...updateData };
        await this.processPurchaseReturn(fullReturnItem);
      }
      
      // Step 3: Update local state to reflect changes immediately in the UI.
      const index = this.purchaseReturns.findIndex(item => item.id === this.selectedReturn.id);
      if (index !== -1) {
        this.purchaseReturns[index].returnStatus = this.tempStatus;
        this.purchaseReturns[index].paymentStatus = this.tempPaymentStatus;
        this.sortData(); // This will re-sort, re-filter, and update the view.
      }
      
      // Step 4: Close the modal.
      const modalElement = document.getElementById('statusModal');
      if (modalElement) {
        const modal = Modal.getInstance(modalElement);
        modal?.hide();
      }
    } catch (error) {
      console.error('Error updating statuses:', error);
      this.errorMessage = 'Failed to update statuses. Please check the console and try again.';
      // Optionally, revert local changes if the update fails
      // this.openStatusModal(this.selectedReturn); 
    } finally {
      this.isUpdating = false;
    }
  }
  // END: MODAL AND STATUS UPDATE LOGIC

  // START: CORE BUSINESS LOGIC (PROCESSING, LOGGING, STOCK)
  async processPurchaseReturn(returnData: PurchaseReturn): Promise<void> {
    try {
      // Ensure location ID is set
      if (!returnData.businessLocationId && returnData.businessLocation) {
        const location = typeof returnData.businessLocation === 'object' 
          ? (returnData.businessLocation as any).id 
          : returnData.businessLocation;
        returnData.businessLocationId = location;
      }
      if (!returnData.businessLocationId) {
        throw new Error("Business Location ID is missing.");
      }

      const originalPurchase = await this.purchaseService.getPurchaseById(returnData.parentPurchaseId);
      if (!originalPurchase) throw new Error('Original purchase not found');

      for (const product of returnData.products) {
        const originalProduct = originalPurchase.products?.find(
          p => p.productId === (product.productId || product.id)
        );
        
        const purchasedQuantity = originalProduct?.quantity || 0;
        const returnQuantity = product.quantity || product.returnQuantity || 0;
        const subTotal = returnQuantity * (product.unitPrice || originalProduct?.unitCost || 0);

        // This function name is misleading. In a return, stock should *increase* as goods come back.
        // Or if it's a return *to the supplier*, stock should *decrease*.
        // The implementation adds stock, so it assumes goods are returned to inventory.
        await this.returnProductStock(
          product.productId || product.id,
          returnData.businessLocationId!,
          returnQuantity,
          returnData.referenceNo,
          `Purchase return: ${returnData.reason}`
        );

        await this.createPurchaseReturnLogEntry({
          purchaseRefNo: returnData.parentPurchaseRef,
          returnDate: this.parseDate(returnData.returnDate),
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

      await this.createReturnTransaction(returnData);
      // Status is already updated by the calling function, no need to do it again here.
    } catch (error) {
      console.error('Error processing purchase return:', error);
      // Make error visible to the user
      this.errorMessage = `Error processing the return: ${error}`;
      throw error;
    }
  }

  private async createPurchaseReturnLogEntry(logData: PurchaseReturnLog): Promise<void> {
    const logCollection = collection(this.firestore, 'purchase-return-log');
    await addDoc(logCollection, logData);
  }

  private async returnProductStock(
    productId: string, locationId: string, quantity: number,
    referenceNo: string, notes: string
  ): Promise<void> {
    const stockDocId = `${productId}_${locationId}`;
    const stockDocRef = doc(this.firestore, COLLECTIONS.PRODUCT_STOCK, stockDocId);
    const stockDoc = await getDoc(stockDocRef);
    
    const currentStock = stockDoc.exists() ? stockDoc.data()['quantity'] || 0 : 0;
    // Assuming return means items are back in our stock.
    const newStock = currentStock + quantity; 
    
    await setDoc(stockDocRef, {
      productId, locationId, quantity: newStock,
      lastUpdated: new Date(), updatedBy: 'system' // or a real user ID
    }, { merge: true });
    
    await this.createStockHistoryEntry({
      productId, locationId, action: 'purchase_return', quantity,
      oldStock: currentStock, newStock, referenceNo, notes,
      userId: 'system' // or a real user ID
    });
  }

  private async createStockHistoryEntry(entry: any): Promise<void> {
    const historyCollection = collection(this.firestore, COLLECTIONS.PRODUCT_STOCK_HISTORY);
    await addDoc(historyCollection, { ...entry, timestamp: new Date() });
  }

  private async createReturnTransaction(returnData: PurchaseReturn): Promise<void> {
    try {
      const originalPurchase = await this.purchaseService.getPurchaseById(returnData.parentPurchaseId);
      if (!originalPurchase) {
        console.warn('Original purchase not found for return transaction:', returnData.parentPurchaseId);
        return;
      }

      const transactionData = {
        amount: returnData.grandTotal,
        type: 'purchase_return',
        date: this.parseDate(returnData.returnDate),
        description: `Purchase Return: ${returnData.referenceNo}`,
        note: `Reason: ${returnData.reason}`,
        addedBy: returnData.createdBy || 'System',
        reference: returnData.referenceNo,
        relatedDocId: returnData.id || '',
        supplier: returnData.supplier,
        createdAt: new Date()
      };
      
      const paymentAccountId = typeof originalPurchase.paymentAccount === 'object'
        ? (originalPurchase.paymentAccount as any).id
        : originalPurchase.paymentAccount;
      
      if (paymentAccountId) {
        await this.accountService.addTransaction(paymentAccountId, transactionData);
      } else {
        console.warn('No payment account found in original purchase:', returnData.parentPurchaseId);
      }
    } catch (error) {
      console.error('Error creating return transaction:', error);
    }
  }

  onDelete(id: string): void {
    if (confirm('Are you sure you want to delete this purchase return? This action cannot be undone.')) {
      this.purchaseReturnService.deletePurchaseReturn(id)
        .then(() => {
          this.purchaseReturns = this.purchaseReturns.filter(item => item.id !== id);
          this.sortData(); // Refresh the table
        })
        .catch(err => {
            console.error("Delete failed:", err);
            this.errorMessage = 'Delete failed. Please try again.';
        });
    }
  }
  // END: CORE BUSINESS LOGIC

  // START: UI HELPERS AND EXPORT
  getStatusClass(status: string): string {
    const statusMap: Record<string, string> = {
      'completed': 'badge bg-success',
      'pending': 'badge bg-warning text-dark',
      'partial': 'badge bg-info',
      'rejected': 'badge bg-danger',
    };
    return statusMap[status?.toLowerCase()] || 'badge bg-secondary';
  }

  get totalRecords(): number {
    return this.filteredPurchaseReturns.length;
  }

  get totalGrandTotal(): number {
    return this.filteredPurchaseReturns.reduce((sum, item) => sum + item.grandTotal, 0);
  }

  get totalPaymentDue(): number {
    // This logic might need to be more complex based on payment status
    return this.filteredPurchaseReturns.reduce((sum, item) => sum + item.grandTotal, 0);
  }

  get startRecord(): number {
    return this.filteredPurchaseReturns.length === 0 ? 0 : (this.currentPage - 1) * this.pageSize + 1;
  }

  get endRecord(): number {
    return Math.min(this.currentPage * this.pageSize, this.filteredPurchaseReturns.length);
  }

  onExport(format: string): void {
    const dataToExport = this.filteredPurchaseReturns.map(item => ({
        'Return Date': this.formatDate(item.returnDate),
        'Reference No': item.referenceNo,
        'Parent Purchase': item.parentPurchaseRef,
        'Location': item.businessLocation,
        'Supplier': item.supplier,
        'Return Status': item.returnStatus,
        'Payment Status': item.paymentStatus,
        'Grand Total': item.grandTotal,
        'Reason': item.reason,
    }));
    
    if (format === 'excel') {
      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = { Sheets: { 'PurchaseReturns': worksheet }, SheetNames: ['PurchaseReturns'] };
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      FileSaver.saveAs(new Blob([excelBuffer], { type: 'application/octet-stream' }), 'PurchaseReturns.xlsx');
    } else if (format === 'pdf') {
      const doc = new jsPDF();
      autoTable(doc, {
        head: [Object.keys(dataToExport[0] || {})],
        body: dataToExport.map(item => Object.values(item)),
        startY: 20,
        theme: 'striped',
        headStyles: { fillColor: [41, 128, 185] }
      });
      doc.save('PurchaseReturns.pdf');
    }
  }
  // END: UI HELPERS AND EXPORT
}