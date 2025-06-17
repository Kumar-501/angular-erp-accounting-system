import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { PurchaseOrderService } from '../services/purchase-order.service';
import { Router } from '@angular/router';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-purchase-order-view',
  templateUrl: './purchase-order-view.component.html',
  styleUrls: ['./purchase-order-view.component.scss']
})
export class PurchaseOrderViewComponent implements OnInit {
  order: any;
  isLoading = true;
  error: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private orderService: PurchaseOrderService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadOrder(id);
    } else {
      this.error = 'No order ID provided';
      this.isLoading = false;
    }
  }
  async loadOrder(id: string): Promise<void> {
    try {
      const orderData = await this.orderService.getOrderById(id);
      console.log('Order data received:', orderData); // Log the data to inspect
      this.order = orderData;
      this.isLoading = false;
    } catch (err) {
      this.error = 'Failed to load order';
      this.isLoading = false;
      console.error(err);
    }
  }
  getTotalAmount(): number {
    if (!this.order?.products) return 0;
    return this.order.products.reduce((total: number, product: any) => {
      return total + (product.lineTotal || 0);
    }, 0);
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
      [`Supplier:`, this.order.supplier || 'N/A'],
      [`Status:`, this.order.status || 'N/A'],
      [`Required By Date:`, this.order.requiredByDate || 'N/A'],
      [`Added By:`, this.order.addedBy || 'N/A']
    ];
    
    autoTable(doc, {
      startY: yPosition,
      head: [['Field', 'Value']],
      body: basicInfo,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] }
    });
    
    yPosition = (doc as any).lastAutoTable.finalY + 10;
    
    // Add products table if they exist
    if (this.order.products && this.order.products.length > 0) {
      doc.text('Products:', 14, yPosition);
      yPosition += 10;
      
      const productsData = this.order.products.map((product: any) => [
        product.productName || 'N/A',
        product.quantity || 0,
        product.unitCost ? '$' + product.unitCost.toFixed(2) : '$0.00',
        product.discountPercent ? product.discountPercent + '%' : '0%',
        product.lineTotal ? '$' + product.lineTotal.toFixed(2) : '$0.00'
      ]);
      
      // Add total row
      productsData.push([
        '', '', '', 'Total:', 
        '$' + this.getTotalAmount().toFixed(2)
      ]);
      
      autoTable(doc, {
        startY: yPosition,
        head: [['Product', 'Qty', 'Unit Cost', 'Discount', 'Total']],
        body: productsData,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185] },
        styles: { fontSize: 9 },
        columnStyles: {
          2: { halign: 'right' },
          3: { halign: 'right' },
          4: { halign: 'right' }
        },
        didDrawCell: (data) => {
          if (data.row.index === productsData.length - 1) {
            doc.setFont('helvetica', 'bold');
          }
        }
      });
      
      yPosition = (doc as any).lastAutoTable.finalY + 10;
    }
    
    // Add shipping info if it exists
    if (this.order.shippingDetails) {
      doc.text('Shipping Information:', 14, yPosition);
      yPosition += 10;
      
      const shippingInfo = [
        [`Shipping Address:`, this.order.shippingDetails.shippingAddress || 'N/A'],
        [`Shipping Status:`, this.order.shippingDetails.shippingStatus || 'N/A'],
        [`Shipping Charges:`, this.order.shippingDetails.shippingCharges ? 
          '$' + this.order.shippingDetails.shippingCharges.toFixed(2) : '$0.00'],
        [`Delivered To:`, this.order.shippingDetails.deliveredTo || 'N/A']
      ];
      
      autoTable(doc, {
        startY: yPosition,
        head: [['Field', 'Value']],
        body: shippingInfo,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185] }
      });
      
      yPosition = (doc as any).lastAutoTable.finalY + 10;
    }
    
    // Add notes if they exist
    if (this.order.additionalNotes) {
      doc.text('Additional Notes:', 14, yPosition);
      yPosition += 10;
      doc.setFont('helvetica', 'normal');
      doc.text(this.order.additionalNotes, 14, yPosition, { maxWidth: 180 });
    }
    
    doc.save(`purchase_order_${this.order.referenceNo}.pdf`);
  }

  goBackToList(): void {
    this.router.navigate(['/purchase-order']);
  }
    calculateLineTotal(product: any): number {
    const quantity = product.quantity || product.requiredQuantity || 0;
    const unitCost = product.unitCost || product.unitPurchasePrice || 0;
    const discount = product.discountPercent || 0;
    
    const subtotal = quantity * unitCost;
    const discountAmount = subtotal * (discount / 100);
    return subtotal - discountAmount;
  }
}