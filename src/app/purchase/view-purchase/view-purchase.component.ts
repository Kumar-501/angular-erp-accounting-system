import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PurchaseService } from '../../services/purchase.service';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { DatePipe } from '@angular/common';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PaymentService } from '../../services/payment.service';
import { Location } from '@angular/common';

interface ProductItem {
  id?: string;
  name: string;
  productName?: string;
  quantity?: number;
  price?: number;
  taxAmount?: number;
  taxRate?: number;
  lineTotal?: number;
  subtotal?: number;
  batchNumber?: string;
  expiryDate?: string;
}

interface Purchase {
  id: string;
  purchaseDate?: Date | string;
  referenceNo?: string;
  businessLocation?: string;
  supplier?: string;
  supplierName?: string;
  supplierId?: string;
  supplierAddress?: string;
  purchaseStatus?: string;
  paymentStatus?: string;
  grandTotal?: number;
  paymentAmount?: number;
  paymentDue?: number;
  addedBy?: string;
  products?: ProductItem[];
  invoiceNo?: string;
  shippingCharges?: number;
  payTerm?: string;
  paymentMethod?: string;
  paymentAccount?: {
    id: string;
    name: string;
    accountNumber?: string;
    accountType?: string;
  };
  paymentNote?: string;
  additionalNotes?: string;
  document?: string;
  totalTax?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  taxRate?: number;
  isInterState?: boolean;
}

@Component({
  selector: 'app-view-purchase',
  templateUrl: './view-purchase.component.html',
  styleUrls: ['./view-purchase.component.scss'],
  providers: [DatePipe]
})
export class ViewPurchaseComponent implements OnInit {
  purchase: Purchase | null = null;
  isLoading = true;
  paymentHistory: any[] = [];
  showPaymentHistory = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private purchaseService: PurchaseService,
    private paymentService: PaymentService,
    private datePipe: DatePipe,
    private snackBar: MatSnackBar,
    private location: Location
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadPurchase(id);
    } else {
      this.showSnackbar('No purchase ID provided', 'error');
      this.router.navigate(['/purchases']);
    }
  }

  loadPurchase(id: string): void {
    this.isLoading = true;
    this.purchaseService.getPurchaseById(id)
      .then((purchase) => {
        this.purchase = this.formatPurchaseData(purchase);
        this.isLoading = false;
      })
      .catch((error) => {
        console.error('Error loading purchase:', error);
        this.showSnackbar('Failed to load purchase details', 'error');
        this.isLoading = false;
        this.router.navigate(['/purchases']);
      });
  }

  // ================== UPDATED AND CORRECTED METHOD ==================
  formatPurchaseData(purchase: any): Purchase {
    let supplierName = 'N/A';
    let supplierAddress = '';
    
    if (typeof purchase.supplier === 'string') {
      supplierName = purchase.supplier;
    } else if (purchase.supplier?.businessName) {
      supplierName = purchase.supplier.businessName;
    } else if (purchase.supplier?.firstName) {
      supplierName = `${purchase.supplier.firstName} ${purchase.supplier.lastName || ''}`.trim();
    } else if (purchase.supplierName) {
      supplierName = purchase.supplierName;
    }
    
    if (purchase.supplierAddress) {
      supplierAddress = purchase.supplierAddress;
    } else if (purchase.supplier?.address) {
      supplierAddress = purchase.supplier.address;
    } else if (purchase.supplier?.addressLine1) {
      supplierAddress = purchase.supplier.addressLine1;
      if (purchase.supplier.addressLine2) {
        supplierAddress += ', ' + purchase.supplier.addressLine2;
      }
    }

    // Use the totals calculated and saved during purchase creation. These are the source of truth.
    const grandTotal = purchase.grandTotal || 0;
    const totalTax = purchase.totalTax || 0;

    // Map the products for display, using the saved financial data. DO NOT RECALCULATE.
    const formattedProducts = purchase.products?.map((product: any) => {
      const quantity = product.quantity || 0;
      
      // Use the saved line total (with tax).
      const lineTotal = product.lineTotal || 0;
      
      // Use the saved tax amount for the line.
      const taxAmount = product.taxAmount || 0;
      
      // The subtotal for the line is the total minus the tax.
      const subtotal = lineTotal - taxAmount;
      
      // The unit price (before tax) is the subtotal divided by the quantity.
      const price = quantity > 0 ? (subtotal / quantity) : 0;

      return {
        id: product.id || product.productId || '',
        name: product.productName || product.name || 'Unnamed Product',
        quantity: quantity,
        price: price, // This is now the correct pre-tax unit price.
        taxAmount: taxAmount, // The correct, saved tax amount for the line.
        taxRate: product.taxRate || 0,
        lineTotal: lineTotal, // The correct, saved total for the line.
        subtotal: subtotal, // The correct, subtotal for the line.
        batchNumber: product.batchNumber || '',
        expiryDate: product.expiryDate || ''
      };
    }) || [];

    // Split the CORRECT total tax for display
    const isInterState = purchase.isInterState || false;
    let igst = 0;
    let cgst = 0;
    let sgst = 0;
    if (isInterState) {
      igst = totalTax;
    } else {
      cgst = totalTax / 2;
      sgst = totalTax / 2;
    }

    return {
      ...purchase,
      supplier: supplierName,
      supplierAddress: supplierAddress,
      products: formattedProducts,
      purchaseDate: this.formatDate(purchase.purchaseDate),
      totalTax: totalTax, // Correct saved total tax
      cgst: cgst,
      sgst: sgst,
      igst: igst,
      isInterState: isInterState,
      grandTotal: grandTotal, // Correct saved grand total
      paymentDue: purchase.paymentDue !== undefined ? purchase.paymentDue : (grandTotal - (purchase.paymentAmount || 0))
    };
  }

  formatDate(date: any): string {
    if (!date) return '';
    try {
      if (typeof date === 'object' && 'toDate' in date) {
        return this.datePipe.transform(date.toDate(), 'mediumDate') || '';
      } else if (date instanceof Date) {
        return this.datePipe.transform(date, 'mediumDate') || '';
      } else {
        return this.datePipe.transform(new Date(date), 'mediumDate') || '';
      }
    } catch (e) {
      console.error('Error formatting date:', e);
      return '';
    }
  }

  loadPaymentHistory(): void {
    if (!this.purchase?.id) return;

    this.paymentService.getPaymentsByPurchase(this.purchase.id).subscribe({
      next: (payments) => {
        this.paymentHistory = payments;
        this.showPaymentHistory = true;
      },
      error: (error) => {
        console.error('Error loading payment history:', error);
        this.showSnackbar('Failed to load payment history', 'error');
      }
    });
  }

  printPurchase(): void {
    if (!this.purchase) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      this.showSnackbar('Please allow pop-ups to print', 'error');
      return;
    }

    const printContent = this.generatePrintContent();
    printWindow.document.open();
    printWindow.document.write(printContent);
    printWindow.document.close();
    
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
  }

  generatePrintContent(): string {
    if (!this.purchase) return '';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Purchase Details - ${this.purchase.referenceNo || ''}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { text-align: center; margin-bottom: 20px; }
          .company-name { font-size: 22px; font-weight: bold; }
          h1 { font-size: 18px; text-align: center; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          .summary { float: right; width: 50%; }
          .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #777; }
          .status-badge {
            padding: 3px 8px;
            border-radius: 4px;
            font-weight: bold;
            font-size: 12px;
          }
          .status-received { background-color: #d4edda; color: #155724; }
          .status-pending { background-color: #fff3cd; color: #856404; }
          .status-cancelled { background-color: #f8d7da; color: #721c24; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">Your Company Name</div>
          <div>Purchase Details</div>
        </div>
        
        <h1>Purchase Information</h1>
        
        <table>
          <tr>
            <td><strong>Reference No:</strong></td>
            <td>${this.purchase.referenceNo || 'N/A'}</td>
            <td><strong>Date:</strong></td>
            <td>${this.purchase.purchaseDate || 'N/A'}</td>
          </tr>
          <tr>
            <td><strong>Supplier:</strong></td>
            <td>${this.purchase.supplier || 'N/A'}</td>
            <td><strong>Status:</strong></td>
            <td>
              <span class="status-badge status-${this.purchase.purchaseStatus?.toLowerCase() || ''}">
                ${this.purchase.purchaseStatus || 'N/A'}
              </span>
            </td>
          </tr>
          <tr>
            <td><strong>Invoice No:</strong></td>
            <td>${this.purchase.invoiceNo || 'N/A'}</td>
            <td><strong>Payment Status:</strong></td>
            <td>${this.purchase.paymentStatus || 'N/A'}</td>
          </tr>
          <tr>
            <td><strong>From Address:</strong></td>
            <td colspan="3">${this.purchase.supplierAddress || 'N/A'}</td>
          </tr>
          <tr>
            <td><strong>To Location:</strong></td>
            <td colspan="3">${this.purchase.businessLocation || 'N/A'}</td>
          </tr>
        </table>
        
        <h3>Products</h3>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Product</th>
              <th>Date</th>
              <th>Quantity</th>
              <th>Unit Price</th>
              <th>Subtotal</th>
              <th>Tax Rate</th>
              <th>Tax Amount</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${this.purchase.products?.map((product, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${product.name}</td>
                <td>${this.purchase?.purchaseDate || 'N/A'}</td>
                <td>${product.quantity}</td>
                <td>₹${product.price?.toFixed(2)}</td>
                <td>₹${product.subtotal?.toFixed(2)}</td>
                <td>${product.taxRate}%</td>
                <td>₹${product.taxAmount?.toFixed(2)}</td>
                <td>₹${product.lineTotal?.toFixed(2)}</td>
              </tr>
            `).join('') || '<tr><td colspan="9" class="text-center">No products available</td></tr>'}
          </tbody>
        </table>
        
        <div class="summary">
          <table>
            <tr>
              <td><strong>Subtotal:</strong></td>
              <td>₹${(this.purchase.grandTotal! - (this.purchase.totalTax || 0) - (this.purchase.shippingCharges || 0)).toFixed(2)}</td>
            </tr>
            <tr>
              <td><strong>Total Tax:</strong></td>
              <td>₹${this.purchase.totalTax?.toFixed(2)}</td>
            </tr>
            ${this.purchase.cgst ? `
            <tr>
              <td><strong>CGST:</strong></td>
              <td>₹${this.purchase.cgst.toFixed(2)}</td>
            </tr>
            ` : ''}
            ${this.purchase.sgst ? `
            <tr>
              <td><strong>SGST:</strong></td>
              <td>₹${this.purchase.sgst.toFixed(2)}</td>
            </tr>
            ` : ''}
            ${this.purchase.igst ? `
            <tr>
              <td><strong>IGST:</strong></td>
              <td>₹${this.purchase.igst.toFixed(2)}</td>
            </tr>
            ` : ''}
            <tr>
              <td><strong>Shipping Charges:</strong></td>
              <td>₹${this.purchase.shippingCharges?.toFixed(2) || '0.00'}</td>
            </tr>
            <tr>
              <td><strong>Grand Total:</strong></td>
              <td>₹${this.purchase.grandTotal?.toFixed(2)}</td>
            </tr>
            <tr>
              <td><strong>Amount Paid:</strong></td>
              <td>₹${this.purchase.paymentAmount?.toFixed(2) || '0.00'}</td>
            </tr>
            <tr>
              <td><strong>Balance Due:</strong></td>
              <td>₹${this.purchase.paymentDue?.toFixed(2) || '0.00'}</td>
            </tr>
          </table>
        </div>
        
        ${this.purchase.additionalNotes ? `
        <div>
          <h3>Additional Notes</h3>
          <p>${this.purchase.additionalNotes}</p>
        </div>
        ` : ''}
        
        <div class="footer">
          <p>This is a computer generated document. No signature required.</p>
          <p>Printed on: ${new Date().toLocaleString()}</p>
        </div>
      </body>
      </html>
    `;
  }

  exportToPDF(): void {
    if (!this.purchase) return;

    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(18);
    doc.text('Purchase Details', 105, 15, { align: 'center' });
    
    // Add purchase info
    doc.setFontSize(12);
    doc.text(`Reference: ${this.purchase.referenceNo || 'N/A'}`, 14, 25);
    doc.text(`Date: ${this.purchase.purchaseDate || 'N/A'}`, 14, 32);
    doc.text(`Supplier: ${this.purchase.supplier || 'N/A'}`, 14, 39);
    doc.text(`Status: ${this.purchase.purchaseStatus || 'N/A'}`, 14, 46);
    
    // Add products table
    const productsData = this.purchase.products?.map((product, index) => [
      (index + 1).toString(),
      product.name,
      this.purchase?.purchaseDate || 'N/A',
      product.quantity?.toString() || '0',
      `₹${product.price?.toFixed(2)}`,
      `₹${product.subtotal?.toFixed(2)}`,
      `${product.taxRate}%`,
      `₹${product.taxAmount?.toFixed(2)}`,
      `₹${product.lineTotal?.toFixed(2)}`
    ]) || [];
    
    (doc as any).autoTable({
      startY: 55,
      head: [['#', 'Product', 'Date', 'Qty', 'Price', 'Subtotal', 'Tax%', 'Tax Amt', 'Total']],
      body: productsData,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255 }
    });
    
    // Add summary
    const summaryY = (doc as any).lastAutoTable.finalY + 10;
    doc.text('Summary', 14, summaryY);
    
    const summaryData = [
      ['Subtotal:', `₹${(this.purchase.grandTotal! - (this.purchase.totalTax || 0) - (this.purchase.shippingCharges || 0)).toFixed(2)}`],
      ['Total Tax:', `₹${this.purchase.totalTax?.toFixed(2)}`],
      ...(this.purchase.cgst ? [['CGST:', `₹${this.purchase.cgst.toFixed(2)}`]] : []),
      ...(this.purchase.sgst ? [['SGST:', `₹${this.purchase.sgst.toFixed(2)}`]] : []),
      ...(this.purchase.igst ? [['IGST:', `₹${this.purchase.igst.toFixed(2)}`]] : []),
      ['Shipping:', `₹${this.purchase.shippingCharges?.toFixed(2) || '0.00'}`],
      ['Grand Total:', `₹${this.purchase.grandTotal?.toFixed(2)}`],
      ['Amount Paid:', `₹${this.purchase.paymentAmount?.toFixed(2) || '0.00'}`],
      ['Balance Due:', `₹${this.purchase.paymentDue?.toFixed(2) || '0.00'}`]
    ];
    
    (doc as any).autoTable({
      startY: summaryY + 5,
      body: summaryData,
      columnStyles: { 1: { fontStyle: 'bold' }},
      styles: { fontSize: 10 },
      margin: { left: 14 }
    });
    
    // Save the PDF
    doc.save(`purchase_${this.purchase.referenceNo || 'details'}.pdf`);
  }

  goBack(): void {
    this.location.back();
  }

  editPurchase(): void {
    if (this.purchase?.id) {
      this.router.navigate(['/edit-purchase', this.purchase.id]);
    }
  }

  showSnackbar(message: string, type: 'success' | 'error' | 'info'): void {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      panelClass: [
        type === 'success' ? 'snackbar-success' : 
        type === 'error' ? 'snackbar-error' : 'snackbar-info'
      ]
    });
  } 
}