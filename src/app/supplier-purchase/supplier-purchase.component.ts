import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule, DecimalPipe } from '@angular/common'; // Add the DecimalPipe import
import { PurchaseService } from '../services/purchase.service';
import { SupplierService } from '../services/supplier.service';

@Component({
  selector: 'app-supplier-purchase',
  templateUrl: './supplier-purchase.component.html',
  styleUrls: ['./supplier-purchase.component.scss'],
  imports: [CommonModule], // Add CommonModule to imports if using standalone components
  standalone: true, // Add this if you're using standalone components
  providers: [DecimalPipe] // Add DecimalPipe to providers
})
export class SupplierPurchaseComponent implements OnInit {
  supplierId!: string;
  supplierDetails: any;
  purchases: any[] = [];
  isLoading = true;
  totalPurchases = 0;
  totalPaid = 0;
  totalDue = 0;

  constructor(
    private route: ActivatedRoute,
    private purchaseService: PurchaseService,
    private supplierService: SupplierService
  ) {}

  ngOnInit(): void {
    this.supplierId = this.route.snapshot.params['supplierId'];
    this.loadData();
  }

  async loadData() {
    try {
      // Load supplier details
      this.supplierDetails = await this.supplierService.getSupplierById(this.supplierId).toPromise();
      
      // Load supplier purchases
      this.purchaseService.getPurchasesBySupplier(this.supplierId)
        .subscribe(purchases => {
          this.purchases = purchases;
          
          // Calculate totals
          this.totalPurchases = purchases.reduce((sum, p) => sum + (p.grandTotal || 0), 0);
          this.totalPaid = purchases.reduce((sum, p) => sum + (p.paymentAmount || 0), 0);
          this.totalDue = this.totalPurchases - this.totalPaid;
          
          this.isLoading = false;
        });
    } catch (error) {
      console.error('Error loading data:', error);
      this.isLoading = false;
    }
  }

  getStatusClass(status: string): string {
    if (!status) return 'badge bg-secondary';
    
    switch (status.toLowerCase()) {
      case 'paid':
        return 'badge bg-success';
      case 'partial':
        return 'badge bg-warning';
      case 'due':
        return 'badge bg-danger';
      default:
        return 'badge bg-secondary';
    }
  }

  goBack(): void {
    window.history.back();
  }
}