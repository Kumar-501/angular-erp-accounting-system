import { Component, OnInit } from '@angular/core';
import { PurchaseService } from '../services/purchase.service';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

@Component({
  selector: 'app-shopping',
  templateUrl: './shopping.component.html',
  styleUrls: ['./shopping.component.scss']
})
export class ShoppingComponent implements OnInit {
  purchases: any[] = [];
  ledgerEntries: any[] = [];
  isLoading = true;
  viewMode: 'purchases' | 'ledger' = 'purchases';

  constructor(
    private purchaseService: PurchaseService,
    private router: Router,
    private route: ActivatedRoute
  ) { }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const supplierId = params['supplierId'];
      if (supplierId) {
        this.loadPurchasesBySupplier(supplierId);
      } else {
        this.loadPurchasesWithSupplierDetails();
      }
    });
  }

  loadPurchasesBySupplier(supplierId: string): void {
    this.isLoading = true;
    this.purchaseService.getPurchasesBySupplier(supplierId).subscribe({
      next: (purchases) => {
        this.processPurchases(purchases);
        this.generateLedgerEntries();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading purchases:', error);
        this.isLoading = false;
      }
    });
  }

  loadPurchasesWithSupplierDetails(): void {
    this.isLoading = true;
    this.purchaseService.getPurchases().subscribe({
      next: (purchases) => {
        this.processPurchases(purchases);
        this.generateLedgerEntries();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading purchases:', error);
        this.isLoading = false;
      }
    });
  }

  processPurchases(purchases: any[]): void {
    this.purchases = purchases.map(purchase => {
      const supplierName = purchase.supplierName || 
                         (purchase.supplierId ? `Supplier (${purchase.supplierId})` : 'N/A');
      
      return {
        ...purchase,
        id: purchase.id,
        supplier: supplierName,
        purchaseStatus: this.getStatusText(purchase.purchaseStatus) || 'N/A',
        grandTotal: purchase.grandTotal || purchase.purchaseTotal || 0,
        purchaseDate: purchase.purchaseDate?.toDate?.() || purchase.purchaseDate || new Date(),
        paymentStatus: purchase.paymentStatus || (purchase.paymentAmount >= purchase.grandTotal ? 'Completed' : 'Pending')
      };
    });
  }

  generateLedgerEntries(): void {
    this.ledgerEntries = [];
    let runningBalance = 0;

    this.purchases.forEach(purchase => {
      // Purchase entry (credit to supplier account)
      const purchaseEntry = {
        date: purchase.purchaseDate,
        referenceNo: purchase.referenceNo,
        supplier: purchase.supplier,
        description: 'Purchase on Credit',
        type: 'credit', // This is a credit to the supplier account (we owe them)
        amount: purchase.grandTotal,
        balance: runningBalance + purchase.grandTotal, // Our liability increases
        status: purchase.paymentStatus || 'Pending',
        purchase: purchase
      };
      runningBalance += purchase.grandTotal;
      this.ledgerEntries.push(purchaseEntry);

      // Payment entry if exists (debit to supplier account when we pay)
      if (purchase.paymentAmount && purchase.paymentAmount > 0) {
        const paymentEntry = {
          date: purchase.paidOn || purchase.purchaseDate,
          referenceNo: purchase.referenceNo,
          supplier: purchase.supplier,
          description: 'Payment Made',
          type: 'debit', // This is a debit to the supplier account (reducing our liability)
          amount: purchase.paymentAmount,
          balance: runningBalance - purchase.paymentAmount, // Our liability decreases
          status: purchase.paymentStatus || (purchase.paymentAmount >= purchase.grandTotal ? 'Completed' : 'Partial'),
          purchase: purchase
        };
        runningBalance -= purchase.paymentAmount;
        this.ledgerEntries.push(paymentEntry);
      }
    });

    // Sort ledger entries by date
    this.ledgerEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  getStatusText(status: string): string {
    if (!status) return '';
    
    const lowerStatus = status.toLowerCase();
    
    if (lowerStatus === 'received') return 'Received';
    if (lowerStatus === 'pending') return 'Pending';
    if (lowerStatus === 'cancelled') return 'Cancelled';
    if (lowerStatus === 'paid' || lowerStatus === 'completed') return 'Paid';
    if (lowerStatus === 'partial') return 'Partial Payment';
    if (lowerStatus === 'due') return 'Payment Due';
    
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  viewPurchaseDetails(purchase: any): void {
    this.router.navigate(['/view-purchase', purchase.id]);
  }

  getStatusClass(status: string): string {
    if (!status) return 'bg-secondary';
    
    status = status.toLowerCase();
    if (status === 'received' || status === 'paid' || status === 'completed') {
      return 'bg-success';
    } else if (status === 'pending' || status === 'partial') {
      return 'bg-warning';
    } else if (status === 'cancelled' || status === 'due') {
      return 'bg-danger';
    }
    return 'bg-secondary';
  }
}