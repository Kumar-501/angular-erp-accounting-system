// supplier-view.component.ts

import { Component, OnInit } from '@angular/core';
import { SupplierService } from '../services/supplier.service';
import { PurchaseService } from '../services/purchase.service';
import { PaymentService } from '../services/payment.service';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-supplier-view',
  templateUrl: './supplier-view.component.html',
  styleUrls: ['./supplier-view.component.scss']
})
export class SupplierViewComponent implements OnInit {
  supplier: any = null;
  purchases: any[] = [];
  payments: any[] = [];
  isLoading = true;
goBack: any;

  constructor(
    private supplierService: SupplierService,
    private purchaseService: PurchaseService,
    private paymentService: PaymentService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    const supplierId = this.route.snapshot.paramMap.get('id');
    if (supplierId) {
      this.loadSupplier(supplierId);
      this.loadPurchases(supplierId);
      this.loadPayments(supplierId);
    }
  }

  loadSupplier(id: string): void {
    this.supplierService.getSupplierById(id).subscribe({
      next: (supplier) => {
        this.supplier = supplier;
      },
      error: (error) => {
        console.error('Error loading supplier:', error);
      }
    });
  }

  loadPurchases(supplierId: string): void {
    this.purchaseService.getPurchasesBySupplier(supplierId).subscribe({
      next: (purchases) => {
        this.purchases = purchases;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading purchases:', error);
        this.isLoading = false;
      }
    });
  }

  loadPayments(supplierId: string): void {
    this.paymentService.getPaymentsBySupplier(supplierId).subscribe({
      next: (payments) => {
        this.payments = payments;
      },
      error: (error) => {
        console.error('Error loading payments:', error);
      }
    });
  }

  getTotalPurchases(): number {
    return this.purchases.reduce((sum, purchase) => sum + (purchase.grandTotal || 0), 0);
  }

  getTotalPaid(): number {
    return this.payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
  }

  getBalanceDue(): number {
    return this.getTotalPurchases() - this.getTotalPaid();
  }
}