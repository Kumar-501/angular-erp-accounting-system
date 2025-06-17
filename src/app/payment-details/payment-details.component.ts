// payment-details.component.ts
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { PaymentService } from '../services/payment.service';

@Component({
  selector: 'app-payment-details',
  templateUrl: './payment-details.component.html',
  styleUrls: ['./payment-details.component.scss']
})
export class PaymentDetailsComponent implements OnInit {
  paymentId: string = '';
  payment: any = null;
  isLoading = true;

  constructor(
    private route: ActivatedRoute,
    private paymentService: PaymentService
  ) {}

  ngOnInit(): void {
    this.paymentId = this.route.snapshot.params['id'];
    this.loadPayment();
  }

  loadPayment(): void {
    this.paymentService.getPaymentById(this.paymentId).subscribe({
      next: (payment) => {
        this.payment = payment;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading payment:', error);
        this.isLoading = false;
      }
    });
  }
}