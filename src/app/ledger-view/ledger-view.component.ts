import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SupplierService } from '../services/supplier.service';
import { PaymentService } from '../services/payment.service';
import { PurchaseService } from '../services/purchase.service';
interface Supplier {
  id?: string;
  contactId?: string;
  businessName?: string;
  firstName?: string;
  lastName?: string;
  isIndividual?: boolean;
  email?: string;
  mobile?: string;
  landline?: string;
  taxNumber?: string;
  openingBalance?: number;
  purchaseDue?: number;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
  locations?: string[];
  contactName?: string; // Added missing property
  address?: string;    // Added missing property
  alternateNumber?: string; // Added missing property
}

interface Purchase {
  id?: string;
  purchaseDate: any;
  grandTotal?: number;
  purchaseTotal?: number;
  paymentAmount?: number;
  paymentDue?: number;
  reference?: string;
  paymentStatus?: string;
  location?: string;
  paymentMethod?: string;
}

interface Payment {
  id?: string;
  paymentDate: any;
  amount?: number;
  paymentMethod?: string;
  supplierId?: string;
  location?: string; // Add location field
}

interface Transaction {
  date: Date;
  description: string;
  reference: string;
  type: string;
  location: string;
  paymentStatus: string;
  debit: number;
  credit: number;
  balance: number;
  paymentMethod?: string;
  others?: string;
}

interface AccountSummary {
  openingBalance: number;
  totalPurchase: number;
  totalPaid: number;
  advanceBalance: number;
  balanceDue: number;
}

interface ListingItem {
  label: string;
  value: string | number;
}

@Component({
  selector: 'app-ledger-view',
  templateUrl: './ledger-view.component.html',
  styleUrls: ['./ledger-view.component.scss']
})
export class LedgerViewComponent implements OnInit {
  supplier: Supplier | null = null;
  transactions: Transaction[] = [];
  filteredTransactions: Transaction[] = [];
  loading = true;
  currentBalance = 0;
  fromDate: Date = new Date(new Date().setMonth(new Date().getMonth() - 1));
  toDate: Date = new Date();
  selectedLocation = 'All locations';
  accountSummary: AccountSummary = {
    openingBalance: 0,
    totalPurchase: 0,
    totalPaid: 0,
    advanceBalance: 0,
    balanceDue: 0
  };
  
  // Add missing properties from the template
  currentDate: Date = new Date();
  listingItems: ListingItem[] = [
    { label: 'Business Name', value: 'N/A' },
    { label: 'Contact Person', value: 'N/A' },
    { label: 'Contact Email', value: 'N/A' },
    { label: 'Phone Number', value: 'N/A' }
  ];
  module1Id: string = 'Purchases';
  module2Id: string = 'Payments';

  constructor(
    private route: ActivatedRoute,
    private supplierService: SupplierService,
    private paymentService: PaymentService,
    private purchaseService: PurchaseService
  ) {}

  ngOnInit(): void {
    const supplierId = this.route.snapshot.paramMap.get('id');
    if (supplierId) {
      this.loadSupplierDetails(supplierId);
      this.loadTransactions(supplierId);
      this.fetchSupplierBalanceDue();
    }
  }
 // Added missing methods
 addDiscount(): void {
  // Implement discount functionality
  console.log('Add discount clicked');
}

  loadSupplierDetails(supplierId: string): void {
    this.supplierService.getSupplierById(supplierId).subscribe(supplier => {
      this.supplier = supplier || null;
      if (this.supplier) {
        this.accountSummary.openingBalance = this.supplier.openingBalance || 0;
        
        // Update listing items with supplier data
        this.updateListingItems();
      }
    });
  }
  
  // Add method to update listing items with supplier data
  updateListingItems(): void {
    if (this.supplier) {
      this.listingItems = [
        { label: 'Business Name', value: this.supplier.businessName || 'N/A' },
        { label: 'Contact Person', value: this.supplier.contactName || this.getSupplierName() || 'N/A' },
        { label: 'Contact Email', value: this.supplier.email || 'N/A' },
        { label: 'Phone Number', value: this.supplier.mobile || this.supplier.alternateNumber || 'N/A' }
      ];
    }
  }
  
  fetchSupplierBalanceDue(): void {
    if (this.supplier?.id) {
      this.supplierService.getSupplierBalanceDue(this.supplier.id).subscribe(balanceDue => {
        this.accountSummary.balanceDue = balanceDue;
      });
    }
  }
// In your ledger-view.component.ts

loadTransactions(supplierId: string): void {
  this.loading = true;
  this.transactions = [];
  this.currentBalance = this.supplier?.openingBalance || 0;

  // Load purchases
  this.purchaseService.getPurchasesBySupplier(supplierId).subscribe((purchases: Purchase[]) => {
    purchases.forEach(purchase => {
      if (purchase.purchaseDate) {
        // Add purchase transaction
        const purchaseDate = new Date(purchase.purchaseDate);
        this.transactions.push({
          date: purchaseDate,
          description: 'Purchase',
          reference: purchase.reference || 'PUR-' + purchase.id?.substring(0, 5),
          type: 'Purchase',
          location: purchase.location || 'Main',
          paymentStatus: purchase.paymentStatus || 'Pending',
          debit: purchase.grandTotal || 0,
          credit: 0,
          balance: this.currentBalance + (purchase.grandTotal || 0),
          paymentMethod: '',
          others: ''
        });

        this.currentBalance += purchase.grandTotal || 0;
        this.accountSummary.totalPurchase += purchase.grandTotal || 0;

        // Add payment if any
        if (purchase.paymentAmount && purchase.paymentAmount > 0) {
          this.transactions.push({
            date: purchaseDate,
            description: 'Payment',
            reference: 'PAY-' + purchase.id?.substring(0, 5),
            type: 'Payment',
            location: purchase.location || 'Main',
            paymentStatus: 'Completed',
            debit: 0,
            credit: purchase.paymentAmount,
            balance: this.currentBalance - purchase.paymentAmount,
            paymentMethod: purchase.paymentMethod || 'Cash',
            others: ''
          });

          this.currentBalance -= purchase.paymentAmount;
          this.accountSummary.totalPaid += purchase.paymentAmount;
        }
      }
    });

    // Update final balance
    this.accountSummary.balanceDue = this.currentBalance;
    this.filteredTransactions = [...this.transactions];
    this.loading = false;
  });
}

  onDateRangeChange(): void {
    if (this.supplier?.id) {
      this.loadTransactions(this.supplier.id);
    }
  }

  onLocationChange(): void {
    this.applyLocationFilter();
  }

  applyLocationFilter(): void {
    if (this.selectedLocation === 'All locations') {
      this.filteredTransactions = [...this.transactions];
    } else {
      this.filteredTransactions = this.transactions.filter(
        t => t.location === this.selectedLocation || t.location === 'N/A'
      );
    }
  }

  getSupplierName(): string {
    if (!this.supplier) return '';
    return this.supplier.isIndividual 
      ? `${this.supplier.firstName} ${this.supplier.lastName || ''}`.trim()
      : this.supplier.businessName || '';
  }

  getSupplierAddress(): string {
    if (!this.supplier) return '';
    return [
      this.supplier.addressLine1,
      this.supplier.addressLine2,
      this.supplier.city,
      this.supplier.state,
      this.supplier.country,
      this.supplier.zipCode
    ].filter(Boolean).join(', ');
  }

  getLocations(): string[] {
    const locations = new Set<string>(['All locations']);
    this.transactions.forEach(t => {
      if (t.location && t.location !== 'N/A') {
        locations.add(t.location);
      }
    });
    return Array.from(locations);
  }
  
}