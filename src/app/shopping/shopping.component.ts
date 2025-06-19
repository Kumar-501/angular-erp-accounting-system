import { Component, OnInit, OnDestroy } from '@angular/core';
import { PurchaseService } from '../services/purchase.service';
import { ActivatedRoute, Router } from '@angular/router';
import { Firestore, onSnapshot, collection, query, where } from '@angular/fire/firestore';
import { Purchase } from '../models/purchase.model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-shopping',
  templateUrl: './shopping.component.html',
  styleUrls: ['./shopping.component.scss']
})
export class ShoppingComponent implements OnInit, OnDestroy {
  purchases: Purchase[] = [];
  ledgerEntries: any[] = [];
  isLoading = true;
  viewMode: 'purchases' | 'ledger' = 'purchases';
  debugInfo: any = {};
  
  private purchaseSubscription: Subscription | null = null;
  private supplierId: string | null = null;

  constructor(
    private firestore: Firestore,
    private purchaseService: PurchaseService,
    private router: Router,
    private route: ActivatedRoute
  ) { }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.supplierId = params['supplierId'] || null;
      this.setupRealTimeListener();
    });
  }

  ngOnDestroy(): void {
    if (this.purchaseSubscription) {
      this.purchaseSubscription.unsubscribe();
    }
  }

  setupRealTimeListener(): void {
    this.isLoading = true;
    
    // Unsubscribe from previous listener if exists
    if (this.purchaseSubscription) {
      this.purchaseSubscription.unsubscribe();
    }

    const purchasesCollection = collection(this.firestore, 'purchases');
    const q = this.supplierId 
      ? query(purchasesCollection, where('supplierId', '==', this.supplierId))
      : purchasesCollection;

    this.purchaseSubscription = new Subscription(() => {
      // Cleanup will be handled by the unsubscribe
    });

    const unsubscribe = onSnapshot(q, 
      (querySnapshot) => {
        const purchases = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data() as Purchase
        }));
        this.processPurchases(purchases);
        this.generateLedgerEntries();
        this.isLoading = false;
      },
      (error) => {
        console.error('Error loading purchases:', error);
        this.isLoading = false;
      }
    );

    this.purchaseSubscription.add(unsubscribe);
  }

  processPurchases(purchases: Purchase[]): void {
    this.purchases = purchases
      .filter(p => p) // Remove any null/undefined entries
      .map(purchase => {
        try {
          const subtotal = purchase.products?.reduce((sum: number, product: any) => 
            sum + ((product.quantity || 0) * (product.price || product.unitCost || 0)), 0) || 0;

          const totalTax = purchase.products?.reduce((sum: number, product: any) => 
            sum + (product.taxAmount || 0), 0) || 0;

          const shippingCharges = purchase.shippingCharges || 0;
          const grandTotal = subtotal + totalTax + shippingCharges;
          const paymentAmount = purchase.paymentAmount || 0;
          const paymentDue = Math.max(0, grandTotal - paymentAmount);

          return {
            ...purchase,
            id: purchase.id || Math.random().toString(36).substring(2),
            supplier: purchase.supplierName || purchase.supplierId || 'N/A',
            subtotal,
            totalTax,
            shippingCharges,
            grandTotal,
            paymentAmount,
            paymentDue,
            purchaseDate: purchase.purchaseDate?.toDate?.() || purchase.purchaseDate || new Date(),
            purchaseStatus: purchase.purchaseStatus || 'Pending',
            paymentStatus: paymentDue <= 0 ? 'Paid' : (paymentAmount > 0 ? 'Partial' : 'Due')
          };
        } catch (e) {
          console.error('Error processing purchase:', purchase, e);
          return null;
        }
      })
      .filter(p => p !== null) as Purchase[];
  }

  generateLedgerEntries(): void {
    this.ledgerEntries = [];
    let runningBalance = 0;

    // Sort by date first
    const sortedPurchases = [...this.purchases].sort((a, b) => 
      new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime()
    );

    sortedPurchases.forEach(purchase => {
      try {
        // Validate purchase data
        if (!purchase.id) {
          console.warn('Purchase missing ID:', purchase);
          return;
        }
        if (typeof purchase.grandTotal !== 'number' || isNaN(purchase.grandTotal)) {
          console.warn('Invalid grandTotal for purchase:', purchase);
          return;
        }

        // Add purchase entry
        const purchaseEntry = {
          date: purchase.purchaseDate,
          referenceNo: purchase.referenceNo || `PUR-${purchase.id.substring(0, 4)}`,
          supplier: purchase.supplierName || purchase.supplierId || 'N/A',
          description: `Purchase ${purchase.referenceNo || purchase.id.substring(0, 4)}`,
          type: 'debit',
          amount: purchase.grandTotal,
          balance: runningBalance + purchase.grandTotal,
          status: purchase.purchaseStatus,
          purchase: purchase
        };
        runningBalance += purchase.grandTotal;
        this.ledgerEntries.push(purchaseEntry);

        // Add payment entry if exists
        const paymentAmount = purchase.paymentAmount || 0;
        if (paymentAmount > 0) {
          const paymentEntry = {
            date: (purchase.paidOn && typeof (purchase.paidOn as any).toDate === 'function')
              ? (purchase.paidOn as any).toDate()
              : purchase.paidOn || purchase.purchaseDate,
            referenceNo: `PAY-${purchase.referenceNo || purchase.id.substring(0, 4)}`,
            supplier: purchase.supplierName || purchase.supplierId || 'N/A',
            description: 'Payment',
            type: 'credit',
            amount: paymentAmount,
            balance: runningBalance - paymentAmount,
            status: 'Paid',
            purchase: purchase
          };
          runningBalance -= paymentAmount;
          this.ledgerEntries.push(paymentEntry);
        }
      } catch (e) {
        console.error('Error generating ledger entry for purchase:', purchase, e);
      }
    });

    this.debugInfo.finalBalance = runningBalance;
  }

  switchView(mode: 'purchases' | 'ledger'): void {
    this.viewMode = mode;
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