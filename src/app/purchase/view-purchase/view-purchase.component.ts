import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PurchaseService } from '../../services/purchase.service';
import { DatePipe } from '@angular/common';
import { MatSnackBar } from '@angular/material/snack-bar';

// Define a complete interface that includes all possible fields
interface Purchase {
  id?: string;
  referenceNo?: string;
  purchaseDate?: any;
  supplierName?: string;
  supplierId?: string;
  businessLocation?: string;
  purchaseStatus?: string;
  paymentStatus?: string;
  grandTotal?: number;
  paymentDue?: number;
  totalTax?: number;
  shippingCharges?: number;
  products?: ProductItem[];
  paymentAmount?: number;
  
  // Optional properties that might come from different data sources
  supplier?: string;
  items?: any[];
  subtotal?: number;
}

interface ProductItem {
  id?: string;
  name?: string;
  productName?: string;
  productId?: string;
  quantity?: number;
  price?: number;
  unitPrice?: number;
  unitCost?: number;
  total?: number;
  subtotal?: number;
  taxAmount?: number;
  lineTotal?: number;
  discountPercent?: number;
  unitCostBeforeTax?: number;
  profitMargin?: number;
  roundedTotal?: number;
}

// Create a type to represent the raw purchase data from the service
type RawPurchaseData = any;

@Component({
  selector: 'app-view-purchase',
  templateUrl: './view-purchase.component.html',
  styleUrls: ['./view-purchase.component.scss'],
  providers: [DatePipe]
})
export class ViewPurchaseComponent implements OnInit {
  purchase: Purchase | null = null;
  isLoading = true;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private purchaseService: PurchaseService,
    private datePipe: DatePipe,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadPurchase(id);
    } else {
      this.router.navigate(['/list-purchase']);
    }
  }

  async loadPurchase(id: string): Promise<void> {
    try {
      this.isLoading = true;
      const rawPurchase = await this.purchaseService.getPurchaseById(id) as RawPurchaseData;
    
      let formattedPurchaseDate: string | null = null;
      if (rawPurchase.purchaseDate instanceof Date) {
        formattedPurchaseDate = this.datePipe.transform(rawPurchase.purchaseDate, 'mediumDate');
      } else if (rawPurchase.purchaseDate && rawPurchase.purchaseDate.toDate) {
        formattedPurchaseDate = this.datePipe.transform(rawPurchase.purchaseDate.toDate(), 'mediumDate');
      } else if (typeof rawPurchase.purchaseDate === 'string') {
        const date = new Date(rawPurchase.purchaseDate);
        if (!isNaN(date.getTime())) {
          formattedPurchaseDate = this.datePipe.transform(date, 'mediumDate');
        }
      }
    
      // Get products from either the products or items array
      const rawProducts = rawPurchase.products || rawPurchase.items || [];
      
      // Map products data to ensure consistent structure
      const products = rawProducts.map((product: any) => ({
        id: product.id || product.productId,
        name: product.name || product.productName,
        productName: product.productName,
        productId: product.productId,
        quantity: product.quantity,
        price: product.price || product.unitPrice || product.unitCost,
        unitPrice: product.unitPrice || product.unitCost,
        unitCost: product.unitCost,
        total: product.total || product.lineTotal || product.roundedTotal || 
              ((product.quantity || 0) * (product.unitPrice || product.unitCost || 0)),
        subtotal: product.subtotal,
        taxAmount: product.taxAmount,
        lineTotal: product.lineTotal,
        discountPercent: product.discountPercent,
        unitCostBeforeTax: product.unitCostBeforeTax,
        profitMargin: product.profitMargin,
        roundedTotal: product.roundedTotal
      }));
  
      // Calculate subtotal from products if not provided
      const subtotal = rawPurchase.subtotal || products.reduce((sum: number, item: ProductItem) => {
        return sum + (item.total || 0);
      }, 0);
      
      // Create a properly typed Purchase object
      this.purchase = {
        ...rawPurchase,
        purchaseDate: formattedPurchaseDate || 'N/A',
        supplier: rawPurchase.supplierName || rawPurchase.supplier || rawPurchase.supplierId || 'N/A',
        products: products,
        items: products, // Maintain backward compatibility
        totalTax: rawPurchase.totalTax || 0,
        shippingCharges: rawPurchase.shippingCharges || 0,
        // Ensure these status fields are properly mapped
        purchaseStatus: rawPurchase.purchaseStatus?.toLowerCase() || 'N/A',
        paymentStatus: rawPurchase.paymentStatus?.toLowerCase() || 'N/A',
        // Calculate grand total if not provided
        grandTotal: rawPurchase.grandTotal || (subtotal + (rawPurchase.totalTax || 0) + (rawPurchase.shippingCharges || 0)),
        // Calculate payment due if not provided
        paymentDue: rawPurchase.paymentDue || (rawPurchase.grandTotal || (subtotal + (rawPurchase.totalTax || 0) + (rawPurchase.shippingCharges || 0))) - (rawPurchase.paymentAmount || 0),
        subtotal: subtotal
      };
    } catch (error) {
      console.error('Error loading purchase:', error);
      this.showSnackbar('Failed to load purchase details', 'error');
      this.router.navigate(['/list-purchase']);
    } finally {
      this.isLoading = false;
    }
  }

  getSubtotal(): number {
    if (!this.purchase) return 0;
    
    // Use the pre-calculated subtotal if available
    if (this.purchase.subtotal !== undefined) {
      return this.purchase.subtotal;
    }
    
    // Fallback calculation
    const items = this.purchase.products || this.purchase.items || [];
    return items.reduce((sum: number, item: ProductItem) => {
      return sum + (item.total || 
                   item.lineTotal || 
                   item.roundedTotal || 
                   ((item.quantity || 0) * (item.unitPrice || item.unitCost || 0)));
    }, 0);
  }

  private showSnackbar(message: string, type: 'success' | 'error'): void {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      panelClass: type === 'success' ? ['snackbar-success'] : ['snackbar-error']
    });
  }
}