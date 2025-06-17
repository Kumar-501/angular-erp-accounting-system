import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { PurchaseService } from '../services/purchase.service';

@Component({
  selector: 'app-supplier-details',
  templateUrl: './supplier-details.component.html',
  styleUrls: ['./supplier-details.component.scss']
})
export class SupplierDetailsComponent implements OnInit {
  purchases: any[] = [];
  supplierId: string = '';

  constructor(
    private route: ActivatedRoute,
    private purchaseService: PurchaseService
  ) {}

  ngOnInit(): void {
    this.supplierId = this.route.snapshot.paramMap.get('id') || '';
    if (this.supplierId) {
      this.getPurchasesBySupplierId(this.supplierId);
    }
  }

  getPurchasesBySupplierId(supplierId: string): void {
    this.purchaseService['getPurchasesBySupplierId'](supplierId).subscribe(
      (data: any[]) => {
        this.purchases = data || [];
      },
      (error: any) => {
        console.error('Error fetching purchases', error);
        this.purchases = [];
      }
    );
  }

  getFormattedDate(date: any): string {
    return new Date(date).toLocaleDateString();
  }

  getStatusClass(status: string): string {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'badge-success';
      case 'pending':
        return 'badge-warning';
      case 'cancelled':
        return 'badge-danger';
      default:
        return 'badge-secondary';
    }
  }
}
