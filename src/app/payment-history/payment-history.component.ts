// payment-history.component.ts

import { Component, OnInit } from '@angular/core';
import { PaymentService } from '../services/payment.service';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-payment-history',
  templateUrl: './payment-history.component.html',
  styleUrls: ['./payment-history.component.scss']
})
export class PaymentHistoryComponent implements OnInit {
  payments: any[] = [];
  supplierId: string = '';
  isLoading = true;

  constructor(
    private paymentService: PaymentService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.supplierId = params['id'];
      this.loadPayments();
    });
  }

  loadPayments(): void {
    this.isLoading = true;
    this.paymentService.getPaymentsBySupplier(this.supplierId).subscribe({
      next: (payments) => {
        this.payments = payments;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading payments:', error);
        this.isLoading = false;
      }
    });
  }
}