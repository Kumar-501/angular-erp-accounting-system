// packing-slip.component.ts
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SaleService } from '../services/sale.service';
import { Location } from '@angular/common';
import { DatePipe } from '@angular/common';

// packing-slip.component.ts
interface Product {
  quantity: number;
  unitPrice: number;
}

@Component({
  selector: 'app-packing-slip',
  templateUrl: './packing-slip.component.html',
  styleUrls: ['./packing-slip.component.scss'],
  providers: [DatePipe]
})
export class PackingSlipComponent implements OnInit {
  packingSlip: any = null;
  loading = true;
  error = false;
  currentDate = new Date();
showTaxDetails = false;

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

  loadPackingSlipData(shipmentId: string): void {
    this.saleService.getSaleById(shipmentId).subscribe({
      next: (sale) => {
        if (sale) {
          this.packingSlip = {
            id: sale.id,
            invoiceNo: sale.invoiceNo || 'N/A',
            date: sale.saleDate || new Date().toISOString(),
                      typeOfService: sale.typeOfServiceName || sale.typeOfService || 'Standard', // Add this line

            fromLocation: {
              name: 'HERBALY TOUCH AYURVEDA PRODUCTS PRIVATE LIMITED',
              address: '1st Floor, Chincelad Tower, Arycor P.O., Emoluburn, Kerala, 683579, India',
              mobile: '009703410999',
              gst: '32AACCH318H1ZX'
            },
            toLocation: {
              name: sale.customer || 'N/A',
              address: this.formatCustomerAddress(sale),
              mobile: sale.customerPhone || 'N/A',
              pincode: this.extractPincode(sale.billingAddress || sale.shippingAddress || '')
            },
            products: sale.products || [],
            shippingCharge: sale.shippingCharges || 0,
            totalAmount: sale.totalPayable || 0,
            paymentStatus: sale.paymentStatus || 'Unpaid',
            shippingStatus: sale.shippingStatus || 'Pending'
          };
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
getGrandTotal(): number {
  const productTotal = this.getTotalTaxableValue();
  const productGST = productTotal * 0.18;
  const shipping = this.packingSlip?.shippingCharge || 0;
  const shippingGST = shipping * 0.18;

  return productTotal + productGST + shipping + shippingGST;
}

  
  getShippingGST(): number {
  return this.packingSlip.shippingCharge * 0.18; // 18% on shipping
}
getTotalTaxableValue(): number {
  if (!this.packingSlip?.products) return 0;
  return this.packingSlip.products.reduce(
    (sum: number, product: Product) =>
      sum + (product.quantity * product.unitPrice),
    0
  );
}

getTotalCGST(): number {
  return this.getTotalTaxableValue() * 0.09; // 9% CGST
}


getTotalSGST(): number {
  return this.getTotalTaxableValue() * 0.09; // 9% SGST
}


  private formatCustomerAddress(sale: any): string {
    const parts = [];
    if (sale.billingAddress) parts.push(sale.billingAddress);
    if (sale.shippingAddress && sale.shippingAddress !== sale.billingAddress) {
      parts.push(sale.shippingAddress);
    }
    return parts.join(', ');
  }

  private extractPincode(address: string): string {
    const pincodeRegex = /(\d{6})/;
    const match = address.match(pincodeRegex);
    return match ? match[0] : 'N/A';
  }

  formatDate(dateString: string): string {
    return this.datePipe.transform(dateString, 'dd-MM-yyyy HH:mm') || 'N/A';
  }
getTotalGST(): number {
  return this.getTotalTaxableValue() * 0.18; // 18% total GST
}

 print(): void {
  window.print();
}

  goBack(): void {
    this.location.back();
  }
}