import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SaleService } from '../services/sale.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-sales-order-detail',
  templateUrl: './sales-order-detail.component.html',
  styleUrls: ['./sales-order-detail.component.scss']
})
export class SalesOrderDetailComponent implements OnInit {
  sale$!: Observable<any>;
  saleId!: string;

  constructor(
    private saleService: SaleService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.saleId = this.route.snapshot.paramMap.get('id')!;
    this.loadSaleDetails();
  }

loadSaleDetails(): void {
  this.sale$ = this.saleService.getSaleById(this.saleId).pipe(
    map((sale: any) => {
      return {
        ...sale,
        products: sale.products || sale.product || [],
        typeOfServiceName: sale.typeOfServiceName || sale.typeOfService || '',
        shippingAddress: sale.shippingAddress || 'N/A',
        orderNo: sale.orderNo || 'N/A',
        transactionId: sale.transactionId || 'N/A', // Make sure this is included
        addedByDisplayName: sale.addedByDisplayName || sale.addedBy || 'System'
      };
    })
  );
}

  getProductsDisplayText(products: any[]): string {
    if (!products || products.length === 0) return 'No products';
    
    return products.map(p => `${p.name} (${p.quantity})`).join(', ');
  }

calculateSubtotal(products: any[]): number {
  return products.reduce((sum, product) => sum + (product.unitPrice * product.quantity), 0);
}

calculateDiscountAmount(sale: any): number {
  if (sale.discountType === 'Percentage') {
    return (this.calculateSubtotal(sale.products) * sale.discountAmount / 100);
  }
  return sale.discountAmount || 0;
}

calculateTaxAmount(sale: any): number {
  // Assuming tax is already included in product prices
  // So we only calculate tax on shipping if applicable
  return (sale.shippingCharges || 0) * (sale.orderTax / 100);
}
}