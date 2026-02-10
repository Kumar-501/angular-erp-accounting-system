import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { formatDate } from '@angular/common';
import { GoodsService } from '../services/goods.service';
import { LocationService } from '../services/location.service';
import { PurchaseService } from '../services/purchase.service';
import { StockService } from '../services/stock.service';
import { SupplierService } from '../services/supplier.service';
import { Firestore, doc, updateDoc, serverTimestamp, getDoc } from '@angular/fire/firestore';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

interface ProductWithPending {
  id: string;
  productName: string;
  name: string;
  sku: string;
  orderQuantity: number;
  receivedQuantity: number;
  pendingQuantity: number;
  pendingReason?: string;
  unitPrice: number;
  lineTotal: number;
  deliveryStatus: 'complete' | 'partial' | 'pending';
  isPartialDelivery: boolean;
  additionalQuantity: number; // For new deliveries
}

@Component({
  selector: 'app-list-goods',
  templateUrl: './list-goods.component.html',
  styleUrls: ['./list-goods.component.scss']
})
export class ListGoodsComponent implements OnInit, OnDestroy {
  goodsReceived: any[] = [];
  filteredGoodsReceived: any[] = [];
  paginatedGoodsReceived: any[] = [];
  suppliers: any[] = [];
  locations: any[] = [];
  showOnlyPartial: boolean = false;

  selectedGrn: any = null;
  isSavingAdditionalDelivery: boolean = false;

  // Pending delivery management
  showPendingModal: boolean = false;
  selectedPendingGrn: any = null;
  pendingProductsForm!: FormGroup;
  pendingProducts: ProductWithPending[] = [];

  currentPage: number = 1;
  pageSize: number = 10;
  totalPages: number = 1;
  pageNumbers: number[] = [];
  startItem: number = 0;
  endItem: number = 0;

  sortColumn: string = 'purchaseDate';
  sortDirection: string = 'desc';

  searchQuery: string = '';
  currentView: string = 'all';
  startDate: Date = new Date();
  endDate: Date = new Date();

  showDeleteModal: boolean = false;
  grnToDelete: string | null = null;

  private subscriptions: Subscription[] = [];

  constructor(
    private goodsService: GoodsService,
    private stockService: StockService,
    private locationService: LocationService,
    private purchaseService: PurchaseService,
    private router: Router,
    private supplierService: SupplierService,
    private fb: FormBuilder,
    private firestore: Firestore
  ) {
    this.endDate = new Date();
    this.startDate = new Date();
    this.startDate.setDate(this.startDate.getDate() - 30);
    this.initPendingProductsForm();
  }

  ngOnInit(): void {
    this.loadGoodsReceived();
    this.loadLocations();
    
    this.subscriptions.push(
      this.stockService.stockUpdated$.subscribe(() => {
        this.loadGoodsReceived();
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
// In src/app/list-goods/list-goods.component.ts

// Replace the entire applyFilters() method with this corrected version.
// This ensures the date range correctly includes all records from the selected days.

  applyFilters(): void {
    // Start with the full list of goods received from the service
    let filtered = [...this.goodsReceived];

    // --- START OF FIX: Robust Date Filtering ---
    const filterStartDate = new Date(this.startDate);
    filterStartDate.setHours(0, 0, 0, 0); // Set to the very beginning of the start day

    const filterEndDate = new Date(this.endDate);
    filterEndDate.setHours(23, 59, 59, 999); // Set to the very end of the end day

    filtered = filtered.filter(grn => {
      // grn.purchaseDate is already a valid Date object from the loadGoodsReceived mapping
      if (!grn.purchaseDate || !(grn.purchaseDate instanceof Date)) {
        return false; // Safely skip items with invalid dates
      }
      return grn.purchaseDate >= filterStartDate && grn.purchaseDate <= filterEndDate;
    });
    // --- END OF FIX ---

    // Apply the partial delivery filter if it's active
    if (this.showOnlyPartial) {
      filtered = filtered.filter(grn => grn.hasPartialDeliveries === true);
    }

    // Apply the text search query
    if (this.searchQuery && this.searchQuery.trim() !== '') {
      const query = this.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(grn => {
        return (
          (grn.referenceNo?.toLowerCase().includes(query)) ||
          (grn.invoiceNo?.toLowerCase().includes(query)) ||
          (this.getSupplierName(grn)?.toLowerCase().includes(query)) ||
          (this.getPurchaseOrderNumber(grn)?.toLowerCase().includes(query))
        );
      });
    }

    // Assign the fully filtered list
    this.filteredGoodsReceived = filtered;

    // Finally, sort the data and update the view
    this.sortBy(this.sortColumn); // Re-apply sorting
  }
  exportToExcel(): void {
    const dataToExport = this.filteredGoodsReceived.map(grn => {
      return {
        'Purchase Date': this.formatDate(grn.purchaseDate),
        'Purchase Order': this.getPurchaseOrderNumber(grn),
        'Product Name': grn.products && grn.products.length > 0 ? grn.products[0].productName || grn.products[0].name : 'N/A',
        'Order Qty': this.getTotalOrderedQuantity(grn),
        'Received Qty': this.getTotalReceivedQuantity(grn),
        'Pending Qty': this.getTotalPendingQuantity(grn.products),
        'Reference No': grn.referenceNo || 'N/A',
        'Invoice No': grn.invoiceNo || 'N/A',
        'Supplier': this.getSupplierName(grn),
        'Status': grn.hasPartialDeliveries ? 'Partial' : this.formatStatus(grn.status),
        'Received Date': this.formatDate(grn.receivedDate),
        'Price (Excl. Tax)': this.getPurchasePrice(grn),
        'Total (Incl. Tax)': this.getPurchasePriceWithTax(grn),
        'Added By': grn.addedBy || 'N/A'
      };
    });

    const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook: XLSX.WorkBook = { Sheets: { 'data': worksheet }, SheetNames: ['data'] };
    const excelBuffer: any = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const data: Blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
    saveAs(data, 'goods-received-notes.xlsx');
  }

  private initPendingProductsForm(): void {
    this.pendingProductsForm = this.fb.group({
      receivedDate: [new Date().toISOString().slice(0, 16), Validators.required],
      additionalNotes: ['']
    });
  }

  loadGoodsReceived(): void {
    const supplierSub = this.supplierService.getSuppliers().subscribe(suppliers => {
      this.suppliers = suppliers;
      
      const grnSub = this.goodsService.getAllGoodsReceived().subscribe(goods => {
        this.goodsReceived = goods.map(grn => ({
          ...grn,
          referenceNo: grn['referenceNo'] || this.generateReferenceNo(grn),
          invoiceNo: grn['invoiceNo'] || grn['invoiceRef'] || 'N/A',
          addedBy: grn['addedBy'] || grn['createdBy'] || 'N/A',
          purchaseDate: this.parseDate(grn['purchaseDate']),
          receivedDate: this.parseDate(grn['receivedDate']),
          products: grn['products'] || [],
          hasPartialDeliveries: grn['hasPartialDeliveries'] || false,
          purchaseReferenceNo: grn['purchaseReferenceNo'] || grn['purchaseOrderRef'] || '',
          isAdditionalDelivery: grn['isAdditionalDelivery'] || false,
          originalGrnId: grn['originalGrnId'] || null
        }));
        this.applyFilters();
      });
      this.subscriptions.push(grnSub);
    });
    this.subscriptions.push(supplierSub);
  }

  togglePartialFilter(): void {
    this.showOnlyPartial = !this.showOnlyPartial;
    this.applyFilters();
  }

  private loadLocations(): void {
    this.locationService.getLocations().subscribe(locations => {
      this.locations = locations;
    });
  }

  private parseDate(dateValue: any): Date {
    if (!dateValue) return new Date();
    
    if (dateValue instanceof Date) {
      return dateValue;
    }
    
    if (dateValue.toDate) {
      return dateValue.toDate();
    }
    
    return new Date(dateValue);
  }

  private generateReferenceNo(grn: any): string {
    if (grn.purchaseOrderDetails?.referenceNo) {
      return `GRN-${grn.purchaseOrderDetails.referenceNo}`;
    }
    return `GRN-${grn.id.substring(0, 8).toUpperCase()}`;
  }

  getPurchasePrice(grn: any): number {
    // It correctly sums the line totals (which are pre-tax) from the saved products data.
    if (grn.products) {
      return grn.products.reduce((total: number, product: any) => {
        const quantity = product.quantity || product.receivedQuantity || 0;
        const unitPrice = product.unitPrice || product.unitCost || 0;
        return total + (quantity * unitPrice);
      }, 0);
    }
    // Fallback to the saved subtotal if product details aren't available.
    return grn.productsSubtotal || 0;
  }


  // Calculate total with tax
  getPurchasePriceWithTax(grn: any): number {
    // It now prioritizes the saved `grandTotal` or `purchaseTotal` from the record,
    // which was calculated correctly when the purchase was added.
    // This prevents incorrect recalculations.
    return grn.grandTotal || grn.purchaseTotal || grn.netTotalAmount || 0;
  }

  getTaxBreakdown(grn: any): string {
    const totalWithTax = this.getPurchasePriceWithTax(grn);
    // It uses the saved totalTax amount.
    const totalTax = grn.totalTax || 0;
    const basePrice = totalWithTax - totalTax;
    
    return `Base: ${this.formatCurrency(basePrice)} + Tax: ${this.formatCurrency(totalTax)}`;
  }

  // Helper method for currency formatting
  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }

  // Method to get purchase order number
  getPurchaseOrderNumber(grn: any): string {
    // First try to get from purchaseReferenceNo
    if (grn.purchaseReferenceNo) {
      return grn.purchaseReferenceNo;
    }
    
    // Try to get from purchaseOrderRef
    if (grn.purchaseOrderRef) {
      return grn.purchaseOrderRef;
    }
    
    // Try to get from purchaseOrderDetails
    if (grn.purchaseOrderDetails?.referenceNo) {
      return grn.purchaseOrderDetails.referenceNo;
    }
    
    // Try to get from nested purchase order data
    if (grn.purchaseOrder && typeof grn.purchaseOrder === 'object' && grn.purchaseOrder.referenceNo) {
      return grn.purchaseOrder.referenceNo;
    }
    
    // If purchaseOrder is just an ID, we might need to look it up
    if (grn.purchaseOrder && typeof grn.purchaseOrder === 'string') {
      return `PO-${grn.purchaseOrder.substring(0, 8).toUpperCase()}`;
    }
    
    return 'N/A';
  }

  // Get total ordered quantity for a GRN
  getTotalOrderedQuantity(grn: any): number {
    if (!grn.products) return 0;
    return grn.products.reduce((total: number, product: any) => {
      return total + (product.orderQuantity || product.orderedQty || 0);
    }, 0);
  }

  // Get total received quantity for a GRN
  getTotalReceivedQuantity(grn: any): number {
    if (!grn.products) return 0;
    return grn.products.reduce((total: number, product: any) => {
      return total + (product.quantity || product.receivedQuantity || 0);
    }, 0);
  }

  // Get display text for ordered vs received quantities
  getQuantityDisplay(grn: any): string {
    const ordered = this.getTotalOrderedQuantity(grn);
    const received = this.getTotalReceivedQuantity(grn);
    
    if (ordered === 0) {
      return `${received}`;
    }
    
    return `${received} / ${ordered}`;
  }

  // Check if GRN is an additional delivery
  isAdditionalDelivery(grn: any): boolean {
    return grn.isAdditionalDelivery || false;
  }
// Add these methods to your component class

  getProductTaxAmount(product: any): number {
    const quantity = product.quantity || product.receivedQuantity || 0;
    const unitPrice = product.unitCost || product.unitPrice || 0;
    // Use the product's specific tax rate, or default to 0 if none is provided.
    const taxRate = (product.taxRate || 0) / 100;
    return quantity * unitPrice * taxRate;
    
  }

  getProductLineTotalWithTax(product: any): number {
    const quantity = product.quantity || product.receivedQuantity || 0;
    const unitPrice = product.unitCost || product.unitPrice || 0;
    const baseLineTotal = quantity * unitPrice;
    const taxForLine = this.getProductTaxAmount(product); // Use the accurate tax amount
    return baseLineTotal + taxForLine;
  }
 getTotalTaxAmount(products: any[]): number {
    if (!products) return 0;
    return products.reduce((total, product) => {
      return total + this.getProductTaxAmount(product);
    }, 0);
  }

  getTotalValueWithTax(products: any[]): number {
    if (!products) return 0;
    // By summing the saved `lineTotal` for each product, it arrives at the correct grand total
    // without performing any risky recalculations.
    return products.reduce((total, product) => total + (product.lineTotal || 0), 0);
  }


  // Product view methods
  viewProducts(grn: any): void {
    this.selectedGrn = grn;
  }

  closeProductsView(): void {
    this.selectedGrn = null;
  }

  // View pending deliveries
  viewPendingDeliveries(grn: any): void {
    this.selectedPendingGrn = grn;
    this.loadPendingProducts(grn);
    this.showPendingModal = true;
  }

  private loadPendingProducts(grn: any): void {
    if (!grn.products) {
      this.pendingProducts = [];
      return;
    }

    this.pendingProducts = grn.products
      .filter((product: any) => (product.pendingQuantity || 0) > 0)
      .map((product: any) => ({
        id: product.id || product.productId,
        productName: product.productName || product.name,
        name: product.productName || product.name,
        sku: product.sku || `SKU-${product.id}`,
        orderQuantity: product.orderQuantity || 0,
        receivedQuantity: product.receivedQuantity || 0,
        pendingQuantity: product.pendingQuantity || 0,
        pendingReason: product.pendingReason || '',
        unitPrice: product.unitPrice || 0,
        lineTotal: product.lineTotal || 0,
        deliveryStatus: product.deliveryStatus || 'partial',
        isPartialDelivery: product.isPartialDelivery || false,
        additionalQuantity: 0 // Initialize for new input
      }));
  }

  closePendingModal(): void {
    this.showPendingModal = false;
    this.selectedPendingGrn = null;
    this.pendingProducts = [];
    this.pendingProductsForm.reset();
    this.initPendingProductsForm();
    this.isSavingAdditionalDelivery = false; // Reset the flag
  }

  onAdditionalQuantityChange(index: number): void {
    const product = this.pendingProducts[index];
    if (product && typeof product.additionalQuantity === 'number') {
      // Ensure additional quantity doesn't exceed pending quantity
      if (product.additionalQuantity > product.pendingQuantity) {
        product.additionalQuantity = product.pendingQuantity;
      }
      if (product.additionalQuantity < 0) {
        product.additionalQuantity = 0;
      }
    }
  }

  async saveAdditionalDelivery(): Promise<void> {
    if (!this.selectedPendingGrn || this.pendingProducts.length === 0) {
      alert('No pending products to process');
      return;
    }

    // Validate form
    if (this.pendingProductsForm.invalid) {
      alert('Please fill in all required fields');
      return;
    }

    // Check if any additional quantities are entered
    const productsWithAdditional = this.pendingProducts.filter(p => (p.additionalQuantity || 0) > 0);
    if (productsWithAdditional.length === 0) {
      alert('Please enter additional quantities to receive');
      return;
    }
    this.isSavingAdditionalDelivery = true; // Disable button

    try {
      // Create new goods received entry for additional delivery
      const formData = {
        supplier: this.selectedPendingGrn.supplier,
        supplierName: this.selectedPendingGrn.supplierName,
        businessLocation: this.selectedPendingGrn.businessLocation,
        purchaseDate: this.selectedPendingGrn.purchaseDate,
        receivedDate: this.pendingProductsForm.get('receivedDate')?.value,
        additionalNotes: this.pendingProductsForm.get('additionalNotes')?.value || '',
        purchaseReferenceNo: this.selectedPendingGrn.purchaseReferenceNo,
        products: productsWithAdditional.map(p => ({
          id: p.id,
          productId: p.id,
          productName: p.productName,
          name: p.productName,
          sku: p.sku,
          quantity: p.additionalQuantity || 0,
          receivedQuantity: p.additionalQuantity || 0,
          unitPrice: p.unitPrice,
          lineTotal: (p.additionalQuantity || 0) * p.unitPrice,
          orderQuantity: p.orderQuantity,
          pendingQuantity: Math.max(0, p.pendingQuantity - (p.additionalQuantity || 0)),
          pendingReason: p.pendingQuantity - (p.additionalQuantity || 0) > 0 ? p.pendingReason : '',
          isPartialDelivery: p.pendingQuantity - (p.additionalQuantity || 0) > 0,
          deliveryStatus: p.pendingQuantity - (p.additionalQuantity || 0) > 0 ? 'partial' : 'complete'
        })),
        // Use the same reference number instead of creating a new one
        referenceNo: this.selectedPendingGrn.referenceNo,
        status: 'received',
        addedBy: 'System', // You might want to get current user
        totalItems: productsWithAdditional.length,
        netTotalAmount: productsWithAdditional.reduce((sum, p) => sum + ((p.additionalQuantity || 0) * p.unitPrice), 0),
        purchaseTotal: productsWithAdditional.reduce((sum, p) => sum + ((p.additionalQuantity || 0) * p.unitPrice), 0),
        isAdditionalDelivery: true,
        originalGrnId: this.selectedPendingGrn.id,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Save the additional delivery
      const result = await this.goodsService.addGoodsReceived(formData);
      console.log('Additional delivery saved:', result.id);

      // Update the original GRN to reflect reduced pending quantities
      const updatedOriginalGrn = await this.updateOriginalGrnPendingQuantities(this.selectedPendingGrn.id, productsWithAdditional);

      // Check if purchase order should be completed
      if (this.selectedPendingGrn.purchaseOrder && updatedOriginalGrn) {
        await this.checkAndCompletePurchaseOrder(this.selectedPendingGrn.purchaseOrder, updatedOriginalGrn);
      }

      alert(`Additional delivery saved successfully! Stock updated for ${productsWithAdditional.length} product(s).`);
      
      // Refresh the list and close modal
      this.loadGoodsReceived();
      this.closePendingModal();

    } catch (error) {
      console.error('Error saving additional delivery:', error);
      alert('Error saving additional delivery. Please try again.');
    } finally {
      this.isSavingAdditionalDelivery = false; // Re-enable button
    }
  }

 private async updateOriginalGrnPendingQuantities(grnId: string, deliveredProducts: ProductWithPending[]): Promise<any> {
  try {
    const originalGrn = this.goodsReceived.find(grn => grn.id === grnId);
    if (!originalGrn) return null;

    const updatedProducts = originalGrn.products.map((product: any) => {
      const deliveredProduct = deliveredProducts.find(dp => dp.id === product.id);
      if (deliveredProduct && typeof deliveredProduct.additionalQuantity === 'number') {
        const newPendingQuantity = Math.max(0, (product.pendingQuantity || 0) - deliveredProduct.additionalQuantity);
        return {
          ...product,
          pendingQuantity: newPendingQuantity,
          // === FIX: THE FOLLOWING LINE IS REMOVED ===
          // receivedQuantity: (product.receivedQuantity || 0) + deliveredProduct.additionalQuantity, // DO NOT UPDATE THE ORIGINAL RECEIVED QUANTITY
          isPartialDelivery: newPendingQuantity > 0,
          deliveryStatus: newPendingQuantity > 0 ? 'partial' : 'complete'
        };
      }
      return product;
    });

    const stillHasPending = updatedProducts.some((p: any) => (p.pendingQuantity || 0) > 0);

    await this.goodsService.updateGoodsReceived(grnId, {
      products: updatedProducts,
      hasPartialDeliveries: stillHasPending,
      updatedAt: new Date()
    });

    return {
      ...originalGrn,
      products: updatedProducts,
      hasPartialDeliveries: stillHasPending
    };

  } catch (error) {
    console.error('Error updating original GRN pending quantities:', error);
    return null;
  }
}

  // Check and complete purchase order if all deliveries are done
  private async checkAndCompletePurchaseOrder(purchaseOrderId: string, updatedGrn: any): Promise<void> {
    try {
      console.log('Checking if purchase order should be completed:', purchaseOrderId);

      // Check if all products in the GRN are fully delivered
      const allProductsDelivered = updatedGrn.products.every((product: any) => 
        (product.pendingQuantity || 0) === 0
      );

      console.log('All products delivered:', allProductsDelivered);
      console.log('Updated GRN has partial deliveries:', updatedGrn.hasPartialDeliveries);

      // If all products are delivered and no partial deliveries remain
      if (allProductsDelivered && !updatedGrn.hasPartialDeliveries) {
        // Get all GRNs related to this purchase order to ensure all deliveries are complete
        const allGrnsForPurchase = this.goodsReceived.filter(grn => 
          grn.purchaseOrder === purchaseOrderId || grn.originalGrnId === updatedGrn.id
        );

        console.log('All GRNs for this purchase order:', allGrnsForPurchase.length);

        // Check if there are any other GRNs with pending deliveries for this purchase order
        const hasAnyPendingDeliveries = allGrnsForPurchase.some(grn => 
          grn.hasPartialDeliveries === true
        );

        console.log('Has any pending deliveries across all GRNs:', hasAnyPendingDeliveries);

        // Only complete the purchase order if no GRNs have pending deliveries
        if (!hasAnyPendingDeliveries) {
          // Try multiple collections to find and update the purchase order
          const collectionsToTry = ['purchase-orders', 'purchases', 'orders'];
          let updated = false;

          for (const collectionName of collectionsToTry) {
            try {
              const purchaseRef = doc(this.firestore, collectionName, purchaseOrderId);
              const purchaseDoc = await getDoc(purchaseRef);
              
              if (purchaseDoc.exists()) {
                await updateDoc(purchaseRef, {
                  status: 'completed',
                  updatedAt: serverTimestamp()
                });
                
                console.log(`Purchase order marked as completed in ${collectionName}:`, purchaseOrderId);
                updated = true;
                break;
              }
            } catch (error) {
              console.warn(`Error updating purchase order in ${collectionName}:`, error);
            }
          }

          if (!updated) {
            console.warn('Purchase order not found in any collection for completion update');
          }
        } else {
          console.log('Purchase order still has pending deliveries, keeping status as partial');
        }
      } else {
        console.log('Not all products delivered yet, purchase order remains partial');
      }
    } catch (error) {
      console.error('Error checking/completing purchase order:', error);
    }
  }

  getTotalQuantity(products: any[]): number {
    if (!products) return 0;
    return products.reduce((total, product) => {
      return total + (product.quantity || product.receivedQuantity || 0);
    }, 0);
  }

  getTotalValue(products: any[]): number {
    if (!products) return 0;
    return products.reduce((total, product) => {
      return total + this.getProductLineTotal(product);
    }, 0);
  }

  getTotalPendingQuantity(products: any[]): number {
    if (!products) return 0;
    return products.reduce((total, product) => {
      return total + (product.pendingQuantity || 0);
    }, 0);
  }

  getProductLineTotal(product: any): number {
    const quantity = product.quantity || product.receivedQuantity || 0;
    const unitPrice = product.unitCost || product.unitPrice || 0;
    return quantity * unitPrice;
  }

  getProductStatus(product: any): string {
    const ordered = product.orderQuantity || product.orderedQty || 0;
    const received = product.quantity || product.receivedQuantity || 0;
    const pending = product.pendingQuantity || 0;
    
    if (received === 0) return 'Not Received';
    if (pending > 0) return 'Partial';
    if (received === ordered) return 'Complete';
    if (received > ordered) return 'Over Received';
    
    return 'Received';
  }

  getProductStatusClass(product: any): string {
    const status = this.getProductStatus(product);
    switch (status) {
      case 'Complete': return 'status-complete';
      case 'Partial': return 'status-partial';
      case 'Over Received': return 'status-over';
      case 'Not Received': return 'status-not-received';
      default: return 'status-received';
    }
  }

  getProductRowClass(product: any): string {
    const received = product.quantity || product.receivedQuantity || 0;
    const pending = product.pendingQuantity || 0;
    
    if (pending > 0) return 'product-partial';
    if (received > 0) return 'product-received';
    return 'product-not-received';
  }

  getGrnStatusClass(grn: any): string {
    if (grn.hasPartialDeliveries) return 'grn-partial';
    return this.getStatusClass(grn.status);
  }

  printProductsList(): void {
    if (!this.selectedGrn) return;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const html = this.generatePrintHTML(this.selectedGrn);
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.print();
    }
  }

  private generatePrintHTML(grn: any): string {
    const productsRows = grn.products?.map((product: any, index: number) => `
      <tr>
        <td>${index + 1}</td>
        <td>${product.productName || product.name}</td>
        <td>${product.sku || product.code || 'N/A'}</td>
        <td>${product.orderQuantity || product.orderedQty || 0}</td>
        <td>${product.quantity || product.receivedQuantity || 0}</td>
        <td>${product.pendingQuantity || 0}</td>
        <td>₹${(product.unitCost || product.unitPrice || 0).toFixed(2)}</td>
        <td>₹${this.getProductLineTotal(product).toFixed(2)}</td>
        <td>${this.getProductStatus(product)}</td>
      </tr>
    `).join('') || '<tr><td colspan="9">No products found</td></tr>';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>GRN Products - ${grn.referenceNo}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .info { margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          .total-row { font-weight: bold; background-color: #f9f9f9; }
          .partial-indicator { color: #ff6b35; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>Goods Received Note - Products Details</h2>
          <h3>${grn.referenceNo}</h3>
          ${grn.hasPartialDeliveries ? '<p class="partial-indicator">⚠️ Contains Partial Deliveries</p>' : ''}
        </div>
        <div class="info">
          <p><strong>Supplier:</strong> ${this.getSupplierName(grn)}</p>
          <p><strong>Location:</strong> ${this.getLocationName(grn)}</p>
          <p><strong>Purchase Order:</strong> ${this.getPurchaseOrderNumber(grn)}</p>
          <p><strong>Received Date:</strong> ${this.formatDate(grn.receivedDate)}</p>
          <p><strong>Invoice No:</strong> ${grn.invoiceNo || 'N/A'}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Product Name</th>
              <th>SKU/Code</th>
              <th>Order Qty</th>
              <th>Received Qty</th>
              <th>Pending Qty</th>
              <th>Unit Price</th>
              <th>Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${productsRows}
            <tr class="total-row">
              <td colspan="4">Total</td>
              <td>${this.getTotalQuantity(grn.products)}</td>
              <td>${this.getTotalPendingQuantity(grn.products)}</td>
              <td></td>
              <td>₹${this.getTotalValue(grn.products).toFixed(2)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </body>
      </html>
    `;
  }

  private formatDate(date: any): string {
    if (!date) return 'N/A';
    const parsedDate = this.parseDate(date);
    return formatDate(parsedDate, 'dd-MM-yyyy HH:mm', 'en-US');
  }

  sortBy(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    if (column === 'productName') {
      this.filteredGoodsReceived.sort((a, b) => {
        const nameA = (a.products?.[0]?.productName || a.products?.[0]?.name || '').toLowerCase();
        const nameB = (b.products?.[0]?.productName || b.products?.[0]?.name || '').toLowerCase();
        return this.sortDirection === 'asc' 
          ? nameA.localeCompare(nameB) 
          : nameB.localeCompare(nameA);
      });
    } else if (column === 'purchaseReferenceNo') {
      this.filteredGoodsReceived.sort((a, b) => {
        const refA = this.getPurchaseOrderNumber(a).toLowerCase();
        const refB = this.getPurchaseOrderNumber(b).toLowerCase();
        return this.sortDirection === 'asc' 
          ? refA.localeCompare(refB) 
          : refB.localeCompare(refA);
      });
    } else if (column === 'purchaseDate' || column === 'receivedDate') {
      this.filteredGoodsReceived.sort((a, b) => {
        const dateA = this.parseDate(a[column]).getTime();
        const dateB = this.parseDate(b[column]).getTime();
        return this.sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
      });
    } else {
      this.applyFilters();
    }
    
    this.updatePagination();
  }



  applySearch(): void {
    this.currentPage = 1;
    this.applyFilters();
  }

  // Helper methods
  getSupplierName(grn: any): string {
    if (grn.supplierName) {
      return grn.supplierName;
    }
    
    if (grn.supplierDetails) {
      return grn.supplierDetails.isIndividual ? 
        `${grn.supplierDetails.firstName} ${grn.supplierDetails.lastName || ''}`.trim() :
        grn.supplierDetails.businessName;
    }
    
    if (typeof grn.supplier === 'string') {
      const foundSupplier = this.suppliers.find(s => s.id === grn.supplier);
      if (foundSupplier) {
        return foundSupplier.isIndividual ? 
          `${foundSupplier.firstName} ${foundSupplier.lastName || ''}`.trim() :
          foundSupplier.businessName;
      }
      return 'Supplier Not Found';
    }
    
    return 'N/A';
  }

  getLocationName(grn: any): string {
    if (grn.businessLocationDetails) {
      return grn.businessLocationDetails.name || 
             grn.businessLocationDetails.address || 
             'N/A';
    }
    
    if (grn.businessLocation) {
      if (typeof grn.businessLocation === 'object' && grn.businessLocation.name) {
        return grn.businessLocation.name;
      }
      
      const location = this.locations.find(loc => loc.id === (grn.businessLocation.id || grn.businessLocation));
      return location?.name || location?.address || 'N/A';
    }
    
    return 'N/A';
  }

  formatStatus(status: string): string {
    if (!status) return 'N/A';
    return status.charAt(0).toUpperCase() + 
           status.slice(1).toLowerCase().replace(/_/g, ' ');
  }

  getStatusClass(status: string): string {
    if (!status) return '';
    
    switch(status.toLowerCase()) {
      case 'received':
        return 'status-received';
      case 'pending':
        return 'status-pending';
      case 'cancelled':
        return 'status-cancelled';
      default:
        return '';
    }
  }

  formatDateRange(): string {
    const start = formatDate(this.startDate, 'dd-MM-yyyy', 'en-US');
    const end = formatDate(this.endDate, 'dd-MM-yyyy', 'en-US');
    return `${start} - ${end}`;
  }

  openFilters(): void {
    // Implementation for opening filter dialog
  }

  setView(view: string): void {
    this.currentView = view;
    this.currentPage = 1;
    this.applyFilters();
  }

  updatePageSize(): void {
    this.currentPage = 1;
    this.updatePagination();
  }

  updatePagination(): void {
    this.totalPages = Math.ceil(this.filteredGoodsReceived.length / this.pageSize);
    
    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages || 1;
    }
    
    this.pageNumbers = [];
    const maxPages = 5;
    let startPage = Math.max(1, this.currentPage - Math.floor(maxPages / 2));
    let endPage = Math.min(this.totalPages, startPage + maxPages - 1);
    
    if (endPage - startPage + 1 < maxPages && startPage > 1) {
      startPage = Math.max(1, endPage - maxPages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      this.pageNumbers.push(i);
    }
    
    const startIndex = (this.currentPage - 1) * this.pageSize;
    this.startItem = this.filteredGoodsReceived.length > 0 ? startIndex + 1 : 0;
    this.endItem = Math.min(startIndex + this.pageSize, this.filteredGoodsReceived.length);
    
    this.paginatedGoodsReceived = this.filteredGoodsReceived.slice(startIndex, this.endItem);
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePagination();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePagination();
    }
  }

  goToPage(page: number): void {
    this.currentPage = page;
    this.updatePagination();
  }

  deleteGrn(id: string): void {
    this.grnToDelete = id;
    this.showDeleteModal = true;
  }

  cancelDelete(): void {
    this.showDeleteModal = false;
    this.grnToDelete = null;
  }

  confirmDelete(): void {
    if (this.grnToDelete) {
      this.goodsService.deleteGoodsReceived(this.grnToDelete)
        .then(() => {
          this.showDeleteModal = false;
          this.grnToDelete = null;
          this.loadGoodsReceived();
        })
        .catch(error => {
          console.error('Error deleting goods received note:', error);
          this.showDeleteModal = false;
          this.grnToDelete = null;
        });
    }
  }
}