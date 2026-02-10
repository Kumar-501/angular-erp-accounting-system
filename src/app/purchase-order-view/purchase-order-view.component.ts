import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { PurchaseOrderService } from '../services/purchase-order.service';
import { ProductsService, Product as ServiceProduct } from '../services/products.service';
import { Router } from '@angular/router';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
interface ProductDetails {
  taxPercentage: any;
  id?: string;
  productName: string;
  sku?: string;
  hsnCode?: string;
  taxRate?: string;
  currentStock?: number;
  alertQuantity?: number;
  defaultPurchasePrice?: number;
  sellingPrice?: number;
}

@Component({
  selector: 'app-purchase-order-view',
  templateUrl: './purchase-order-view.component.html',
  styleUrls: ['./purchase-order-view.component.scss']
})
export class PurchaseOrderViewComponent implements OnInit {
  order: any;
  isLoading = true;
  error: string | null = null;
  productDetails: { [key: string]: ProductDetails } = {};

  constructor(
    private route: ActivatedRoute,
    private orderService: PurchaseOrderService,
    private productsService: ProductsService,
    private router: Router
  ) {}


 
  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      await this.loadOrder(id);
    } else {
      this.error = 'No order ID provided';
      this.isLoading = false;
    }
  }


  async loadOrder(id: string): Promise<void> {
    try {
      const orderData = await this.orderService.getOrderById(id);
      this.order = orderData;
      
      if (this.order.items && this.order.items.length > 0) {
        await this.loadProductDetails(this.order.items);
      } else if (this.order.products && this.order.products.length > 0) {
        await this.loadProductDetails(this.order.products);
      }
      
      this.isLoading = false;
    } catch (err) {
      this.error = 'Failed to load order';
      this.isLoading = false;
      console.error(err);
    }
  }

  async loadProductDetails(items: any[]): Promise<void> {
    const productIds = items.map(item => item.productId).filter(id => id);
    
    if (productIds.length > 0) {
      try {
        const productPromises = productIds.map(id => this.productsService.getProductById(id));
        const products = await Promise.all(productPromises);
        
        products.forEach((product: ServiceProduct | null) => {
          if (product && product.id) {
            this.productDetails[product.id] = {
              taxPercentage: (product as any).taxPercentage ?? 0,
              id: product.id,
              productName: product.productName,
              sku: product.sku,
              hsnCode: product.hsnCode,
              taxRate: (product as any).applicableTax,
              currentStock: product.currentStock,
              alertQuantity: product.alertQuantity !== null ? product.alertQuantity : undefined,
              defaultPurchasePrice: product.defaultPurchasePriceExcTax !== null ? product.defaultPurchasePriceExcTax : undefined,
              sellingPrice: product.unitSellingPrice !== null ? product.unitSellingPrice : undefined
            };
          }
        });
      } catch (err) {
        console.error('Error loading product details:', err);
      }
    }
  }

  getProductDetails(productId: string): ProductDetails {
    const details = this.productDetails[productId];
    
    if (!details) {
      return {
        taxPercentage: 0,
        productName: 'Unknown Product',
        sku: 'N/A',
        hsnCode: 'N/A',
        taxRate: 'N/A',
        currentStock: 0,
        alertQuantity: 0,
        defaultPurchasePrice: 0,
        sellingPrice: 0
      };
    }
    
    return {
      ...details,
      taxPercentage: details.taxPercentage ?? 0,
      currentStock: details.currentStock ?? 0,
      alertQuantity: details.alertQuantity ?? 0,
      defaultPurchasePrice: details.defaultPurchasePrice ?? 0,
      sellingPrice: details.sellingPrice ?? 0
    };
  }

  getTotalAmount(): number {
    if (!this.order?.products && !this.order?.items) return 0;
    
    const items = this.order.items || this.order.products || [];
    const subtotal = items.reduce((total: number, item: any) => {
      return total + this.calculateLineTotal(item);
    }, 0);
    
    // Add shipping charges to the total
    const shippingCharges = this.order.shippingCharges || 0;
    return subtotal + shippingCharges;
  }


  printOrder(): void {
    window.print();
  }
  downloadPDF(): void {
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(18);
    doc.text(`Purchase Order: ${this.order.referenceNo}`, 14, 20);
    
    // Add basic info
    doc.setFontSize(12);
    let yPosition = 40;
    
    const basicInfo = [
      [`Date:`, this.order.date || 'N/A'],
      [`Business Location:`, this.order.businessLocation || 'N/A'],
      [`Supplier:`, this.order.supplierName || this.order.supplier || 'N/A'],
      [`Status:`, this.order.status || 'N/A'],
      [`Shipping Status:`, this.order.shippingStatus || 'N/A'],
      [`Required By Date:`, this.order.requiredByDate || 'N/A'],
      [`Added By:`, this.order.addedBy || 'N/A'],
      [`Shipping Charges:`, this.getShippingAmount().toFixed(2)]  // Add shipping charges to basic info
    ];
    
    autoTable(doc, {
      startY: yPosition,
      head: [['Field', 'Value']],
      body: basicInfo,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] }
    });
    
    yPosition = (doc as any).lastAutoTable.finalY + 10;
    
    // Add products table
    const items = this.order.items || this.order.products || [];
    if (items.length > 0) {
      doc.text('Products:', 14, yPosition);
      yPosition += 10;
      
      const productsData = items.map((item: any) => [
        item.productName || this.getProductDetails(item.productId).productName,
        item.quantity || item.requiredQuantity || 0,
        this.getProductDetails(item.productId).sku || 'N/A',
        this.getProductDetails(item.productId).hsnCode || 'N/A',
        (item.unitCost || item.unitPurchasePrice || 0).toFixed(2),
        this.calculateLineTotal(item).toFixed(2)
      ]);
      
      // Add total rows including shipping
      productsData.push(['', '', '', '', 'Subtotal:', (this.getTotalAmount() - this.getShippingAmount()).toFixed(2)]);
      productsData.push(['', '', '', '', 'Shipping:', this.getShippingAmount().toFixed(2)]);
      productsData.push(['', '', '', '', 'Total:', this.getTotalAmount().toFixed(2)]);
      
      autoTable(doc, {
        startY: yPosition,
        head: [['Product', 'Qty', 'SKU', 'HSN', 'Unit Price', 'Total']],
        body: productsData,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185] },
        columnStyles: {
          4: { halign: 'right' },
          5: { halign: 'right' }
        },
        didDrawCell: (data) => {
          // Make the last three rows (subtotal, shipping, total) bold
          if (data.row.index >= items.length) {
            doc.setFont('helvetica', 'bold');
          }
        }
      });
    }
    
    // Save the PDF
    doc.save(`purchase_order_${this.order.referenceNo}.pdf`);
  }

  getShippingAmount(): number {
    return this.order?.shippingCharges || 0;
  }

  calculateLineTotal(item: any): number {
    const quantity = item.quantity || item.requiredQuantity || 0;
    const unitCost = item.unitCost || item.unitPurchasePrice || 0;
    const discount = item.discountPercent || 0;
    
    // Calculate subtotal after discount
    const subtotal = quantity * unitCost;
    const discountAmount = subtotal * (discount / 100);
    const subtotalAfterDiscount = subtotal - discountAmount;
    
    // FIX: Prioritize tax rate from the line item, then fallback to product details.
    let taxRate = 0;
    if (item.taxPercent !== undefined && item.taxPercent !== null) {
      taxRate = item.taxPercent;
    } else if (item.taxRate !== undefined && item.taxRate !== null) {
      taxRate = item.taxRate; // Fallback for older property name
    } else if (item.productId) {
      const productDetails = this.getProductDetails(item.productId);
      taxRate = productDetails.taxPercentage || 0;
    }
    
    // Calculate tax amount
    const taxAmount = subtotalAfterDiscount * (taxRate / 100);
    
    // Return total including tax
    return subtotalAfterDiscount + taxAmount;
  }

  // Helper method to calculate tax amount separately (if needed for display)
  calculateTaxAmount(item: any): number {
    const quantity = item.quantity || item.requiredQuantity || 0;
    const unitCost = item.unitCost || item.unitPurchasePrice || 0;
    const discount = item.discountPercent || 0;
    
    const subtotal = quantity * unitCost;
    const discountAmount = subtotal * (discount / 100);
    const subtotalAfterDiscount = subtotal - discountAmount;
    
    let taxRate = 0;
    if (item.taxPercent !== undefined && item.taxPercent !== null) {
      taxRate = item.taxPercent;
    } else if (item.taxRate !== undefined && item.taxRate !== null) {
      taxRate = item.taxRate;
    } else if (item.productId) {
      const productDetails = this.getProductDetails(item.productId);
      taxRate = productDetails.taxPercentage || 0;
    }
    
    return subtotalAfterDiscount * (taxRate / 100);
  }

  // Helper method to calculate subtotal before tax (if needed for display)
  calculateSubtotal(item: any): number {
    const quantity = item.quantity || item.requiredQuantity || 0;
    const unitCost = item.unitCost || item.unitPurchasePrice || 0;
    const discount = item.discountPercent || 0;
    
    const subtotal = quantity * unitCost;
    const discountAmount = subtotal * (discount / 100);
    return subtotal - discountAmount;
  }

  goBackToList(): void {
    this.router.navigate(['/purchase-order']);
  }
}