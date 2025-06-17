import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SaleService } from '../services/sale.service';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Subscription } from 'rxjs';

interface Product {
  name: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  subtotal: number;
  quantityRemaining?: number;
}

interface SalesOrder {
  id?: string;
  customer: string;
  customerPhone: string;
  businessLocation: string;
  location: string;
  saleDate: string;
  invoiceNo: string;
  orderNo: string;
  status: string;
  serviceType: string;
  typeOfService: string;
  typeOfServiceName: string;
  shippingStatus: string;
  shippingCharges: number;
  discountType: string;
  discountAmount: number;
  orderTax: number;
  paymentAmount: number;
  paymentMethod: string;
  paidOn: string;
  balance: number;
  changeReturn: number;
  quantityRemaining: number;
  addedBy?: string;
  addedByDisplayName?: string;
  billingAddress: string;
  shippingAddress: string;
  sellNote: string;
  paymentNote: string;
  deliveryPerson: string;
  products: Product[];
}

@Component({
  selector: 'app-sales-view',
  templateUrl: './sales-view.component.html',
  styleUrls: ['./sales-view.component.scss']
})
export class SalesViewComponent implements OnInit, OnDestroy {
  saleId: string = '';
  sale: SalesOrder | null = null;
  loading: boolean = true;
  error: string | null = null;
  private saleSubscription: Subscription | undefined;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private saleService: SaleService,
    private firestore: AngularFirestore
  ) { }

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.saleId = id;
        this.setupRealtimeListener(id);
      } else {
        this.error = 'Sale ID not provided';
        this.loading = false;
      }
    });
  }

  ngOnDestroy(): void {
    if (this.saleSubscription) {
      this.saleSubscription.unsubscribe();
    }
  }

  setupRealtimeListener(id: string): void {
    this.loading = true;
    
    // Unsubscribe from previous subscription if exists
    if (this.saleSubscription) {
      this.saleSubscription.unsubscribe();
    }

    // Set up realtime listener
    this.saleSubscription = this.firestore.collection('sales').doc(id)
      .valueChanges()
      .subscribe(
        (saleData: any) => {
          this.sale = saleData as SalesOrder;
          this.loading = false;
          this.error = null;
        },
        (error) => {
          this.error = 'Failed to load sale details: ' + error.message;
          this.loading = false;
          // Fallback to regular API call if realtime fails
          this.loadSaleDetails(id);
        }
      );
  }

  // Fallback method if realtime fails
  loadSaleDetails(id: string): void {
    this.saleService.getSaleById(id).subscribe(
      (saleData: any) => {
        this.sale = saleData as SalesOrder;
        this.loading = false;
      },
      (error) => {
        this.error = 'Failed to load sale details: ' + error.message;
        this.loading = false;
      }
    );
  }

  goBack(): void {
    this.router.navigate(['/sales-order']);
  }

 editSale(): void {
  const id = this.sale?.id;
  if (id) {
    this.router.navigate(['/sales-order/edit', id]);
  } else {
    console.error('Sale ID is undefined');
  }
}


  printInvoice(): void {
    window.print();
  }


calculateSubtotal(): number {
  if (!this.sale || !this.sale.products) return 0;
  
  return this.sale.products.reduce((total, product) => {
    // Calculate product subtotal (quantity * unitPrice) minus any discount
    const productSubtotal = (product.unitPrice * product.quantity) - (product.discount || 0);
    return total + productSubtotal;
  }, 0);
}


calculateTotal(): number {
  if (!this.sale) return 0;
  
  const subtotal = this.calculateSubtotal();
  const tax = this.sale.orderTax || 0;
  const shipping = this.sale.shippingCharges || 0;
  const discount = this.sale.discountAmount || 0;
  
  // Calculate tax on products (if applicable)
  const productTax = subtotal * (tax / 100);
  
  // Calculate total ensuring it doesn't go negative
  const total = subtotal + productTax + shipping - discount;
  return Math.max(0, total);
}
}