import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SaleService } from '../services/sale.service';
import { Location } from '@angular/common';
import { DatePipe } from '@angular/common';
import { Subscription } from 'rxjs';

// It's better to import shared models if they exist
interface Product {
  id?: string;
  name: string;
  productName?: string;
  code?: string;
  quantity: number;
  unitPrice: number;
  priceBeforeTax?: number;
  taxRate?: number;
  taxType?: 'GST' | 'IGST' | 'CGST+SGST' | 'None';
  cgstRate?: number;
  sgstRate?: number;
  igstRate?: number;
  discount: number;
  discountPercent?: number;
  taxableValue: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  subtotal: number;
}

interface PackingSlipData {
  invoiceNo: string;
  date: string;
  from: {
    companyName: string;
    address: string;
    mobile: string;
    gst: string;
  };
  to: {
    name: string;
    address: string;
    mobile: string;
    pincode?: string;
  };
  products: Product[];
  shippingCharge: number;
  shippingTax: number;
  shippingTaxRate: number;
  packingCharge: number;
  totalTaxableValue: number;
  total: number;
  typeOfService?: string;
  serviceType?: string;
}

@Component({
  selector: 'app-packing-slip',
  templateUrl: './packing-slip.component.html',
  styleUrls: ['./packing-slip.component.scss'],
  providers: [DatePipe]
})
export class PackingSlipComponent implements OnInit, OnDestroy {
  packingSlip: PackingSlipData | null = null;
  loading = true;
  error = false;
  currentDate = new Date();
  private saleSubscription?: Subscription;
  private lastSaleDataHash: string = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private saleService: SaleService,
    private location: Location,
    private datePipe: DatePipe
  ) { }

  ngOnInit(): void {
    const shipmentId = this.route.snapshot.paramMap.get('id');
    if (shipmentId) {
      this.loadPackingSlipData(shipmentId);
    } else {
      this.error = true;
      this.loading = false;
    }
  }

  ngOnDestroy(): void {
    if (this.saleSubscription) {
      this.saleSubscription.unsubscribe();
    }
  }

  loadPackingSlipData(shipmentId: string): void {
    this.saleSubscription = this.saleService.getSaleById(shipmentId).subscribe({
      next: (sale) => {
        if (sale) {
          const saleDataHash = JSON.stringify(sale);
          if (saleDataHash !== this.lastSaleDataHash) {
            this.packingSlip = this.generatePackingSlipFromSale(sale);
            this.lastSaleDataHash = saleDataHash;
          }
        } else {
          this.error = true;
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading packing slip data:', error);
        this.error = true;
        this.loading = false;
      }
    });
  }

  private generatePackingSlipFromSale(sale: any): PackingSlipData {
    const processedProducts = (sale.products || []).map((product: any): Product => {
      const unitPriceBeforeTax = Number(product.priceBeforeTax) || Number(product.unitPrice) || 0;
      const quantity = Number(product.quantity) || 1;
      const discount = Number(product.discount) || 0;
      const currentTaxRate = Number(product.taxRate) || 0;
      const currentTaxType = product.taxType || 'CGST+SGST';
      const taxableValue = (unitPriceBeforeTax * quantity) - discount;
      let cgstAmount = 0, sgstAmount = 0, igstAmount = 0;
      let cgstRate = 0, sgstRate = 0, igstRate = 0;

      if (currentTaxRate > 0 && taxableValue > 0) {
        if (currentTaxType === 'IGST') {
          igstAmount = taxableValue * (currentTaxRate / 100);
          igstRate = currentTaxRate;
        } else {
          const splitRate = currentTaxRate / 2;
          cgstAmount = taxableValue * (splitRate / 100);
          sgstAmount = taxableValue * (splitRate / 100);
          cgstRate = splitRate;
          sgstRate = splitRate;
        }
      }
      const subtotal = taxableValue + cgstAmount + sgstAmount + igstAmount;
      return {
        name: product.name || product.productName || 'Unknown',
        quantity: quantity,
        unitPrice: parseFloat(unitPriceBeforeTax.toFixed(2)),
        discount: parseFloat(discount.toFixed(2)),
        taxableValue: parseFloat(taxableValue.toFixed(2)),
        taxType: currentTaxType,
        cgstAmount: parseFloat(cgstAmount.toFixed(2)),
        sgstAmount: parseFloat(sgstAmount.toFixed(2)),
        igstAmount: parseFloat(igstAmount.toFixed(2)),
        cgstRate: parseFloat(cgstRate.toFixed(2)),
        sgstRate: parseFloat(sgstRate.toFixed(2)),
        igstRate: parseFloat(igstRate.toFixed(2)),
        subtotal: parseFloat(subtotal.toFixed(2)),
      };
    });

    const totalTaxableValue = processedProducts.reduce((sum: any, p: { taxableValue: any; }) => sum + p.taxableValue, 0);
    const shippingCharge = Number(sale.shippingCharges) || 0;
    const shippingTaxRate = Number(sale.orderTax) || 18;
    const shippingTax = shippingCharge * (shippingTaxRate / 100);
    const packingCharge = Number(sale.packingCharge) || Number(sale.serviceCharge) || 0;
    const grandTotal = Number(sale.totalPayable) || 0;

    return {
      invoiceNo: sale.invoiceNo || 'N/A',
      date: sale.saleDate || new Date().toISOString(),
      from: {
        companyName: 'HERBALY TOUCH AYURVEDA PRODUCTS PRIVATE LIMITED',
        address: '1st Floor, Chirackal Tower, Ayroor P.O, Emakulam, Kerala, 683579, India',
        mobile: '00917034110999',
        gst: '32AAGCH3136H12X'
      },
      to: {
        name: sale.customer || 'N/A',
        address: sale.billingAddress || sale.shippingAddress || 'N/A',
        mobile: sale.customerPhone || sale.customerMobile || 'N/A',
        pincode: this.extractPincode(sale.billingAddress || sale.shippingAddress || '')
      },
      products: processedProducts,
      shippingCharge: parseFloat(shippingCharge.toFixed(2)),
      shippingTax: parseFloat(shippingTax.toFixed(2)),
      shippingTaxRate: shippingTaxRate,
      packingCharge: parseFloat(packingCharge.toFixed(2)),
      totalTaxableValue: parseFloat(totalTaxableValue.toFixed(2)),
      total: parseFloat(grandTotal.toFixed(2)),
      typeOfService: sale.typeOfServiceName || sale.typeOfService || 'Standard',
    };
  }

  private extractPincode(address: string): string {
    if (!address) return 'N/A';
    const pincodeRegex = /(\d{6})/;
    const match = address.match(pincodeRegex);
    return match ? match[0] : 'N/A';
  }

  getTotalTaxableValue = () => this.packingSlip?.products.reduce((sum, p) => sum + p.taxableValue, 0) || 0;
  getTotalCGST = () => this.packingSlip?.products.reduce((sum, p) => sum + (p.cgstAmount || 0), 0) || 0;
  getTotalSGST = () => this.packingSlip?.products.reduce((sum, p) => sum + (p.sgstAmount || 0), 0) || 0;
  getTotalIGST = () => this.packingSlip?.products.reduce((sum, p) => sum + (p.igstAmount || 0), 0) || 0;
  getTotalGST = () => this.getTotalCGST() + this.getTotalSGST() + this.getTotalIGST();
  getShippingGST = () => this.packingSlip?.shippingTax || 0;
  getPackingCharge = () => this.packingSlip?.packingCharge || 0;
  getGrandTotal = () => this.packingSlip?.total || 0;

  // ======================= FIX #1: Re-added getTableColspan() =======================
  getTableColspan(): number {
    // Base columns: #, Product, Qty, Unit Price, Discount, Taxable Value, Subtotal
    let colspan = 7; 
    
    const hasCgst = this.getTotalCGST() > 0;
    const hasIgst = this.getTotalIGST() > 0;

    if (hasIgst) {
      colspan += 1; // Add 1 for IGST column
    } else if (hasCgst) {
      colspan += 2; // Add 2 for CGST and SGST columns
    }
    
    return colspan;
  }
  // ===================== END OF FIX #1 ====================

  // ======================= FIX #2: Added full numberToWords() implementation =======================
  numberToWords(num: number): string {
    const a = [
      '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven',
      'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
    ];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const inWords = (n: number): string => {
      if (n < 0) return '';
      if (n < 20) return a[n];
      if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
      if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' and ' + inWords(n % 100) : '');
      if (n < 100000) return inWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + inWords(n % 1000) : '');
      if (n < 10000000) return inWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 !== 0 ? ' ' + inWords(n % 100000) : '');
      return inWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 !== 0 ? ' ' + inWords(n % 10000000) : '');
    };

    if (num === null || num === undefined) {
      return '';
    }

    const wholePart = Math.floor(num);
    const decimalPart = Math.round((num - wholePart) * 100);

    let words = inWords(wholePart) + ' Rupees';
    if (decimalPart > 0) {
      words += ' and ' + inWords(decimalPart) + ' Paise';
    }

    return words + ' Only';
  }
  // ===================== END OF FIX #2 ====================

  formatDate(dateString: string): string {
    return this.datePipe.transform(dateString, 'dd-MM-yyyy') || 'N/A';
  }

  print(): void {
    window.print();
  }

  goBack(): void {
    this.location.back();
  }

  refreshData(): void {
    const shipmentId = this.route.snapshot.paramMap.get('id');
    if (shipmentId) {
      this.loading = true;
      this.error = false;
      this.lastSaleDataHash = '';
      this.loadPackingSlipData(shipmentId);
    }
  }
}