import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Router } from '@angular/router';
import { LocationService } from '../services/location.service';
import { SaleService } from '../services/sale.service';

@Component({
  selector: 'app-product-purchase-details',
  templateUrl: './product-purchase-details.component.html',
  styleUrls: ['./product-purchase-details.component.scss']
})
export class ProductPurchaseDetailsComponent implements OnInit {
  product: any = null;
  purchases: any[] = [];
  sales: any[] = [];
  returns: any[] = [];
  locations: any[] = [];
  suppliersMap: Map<string, any> = new Map();
  
  // Tab management
  activeTab: 'purchases' | 'sales' | 'returns' = 'purchases';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private locationService: LocationService,
    private saleService: SaleService
  ) { }

  ngOnInit(): void {
    // Get the navigation state
    const navigation = window.history.state;
    console.log('Navigation state:', navigation);
    console.log('Purchases data:', navigation.purchaseData);
    
    if (navigation.productData) {
      this.product = navigation.productData;
      this.purchases = navigation.purchaseData || [];
      console.log('Loaded purchases:', this.purchases);
      
      // Load sales and returns data
      this.loadSalesData();
      this.loadReturnsData();
    } else {
      // Handle case where data wasn't passed via state
      const productId = this.route.snapshot.paramMap.get('id');
      if (productId) {
        // Here you would fetch the data if not passed via state
        this.loadSalesData(productId);
        this.loadReturnsData(productId);
      }
    }
  }

  // Switch between tabs
  switchTab(tab: 'purchases' | 'sales' | 'returns'): void {
    this.activeTab = tab;
  }

  formatPurchaseDate(date: any): string {
    if (!date) return '-';
    
    try {
      let dateObj: Date | null = null;
      
      // Handle Firestore Timestamp
      if (date && typeof date === 'object' && 'toDate' in date) {
        dateObj = date.toDate();
      }
      // Handle Firestore Timestamp with seconds/nanoseconds
      else if (date && typeof date === 'object' && 'seconds' in date) {
        dateObj = new Date(date.seconds * 1000);
      }
      // Handle regular Date object
      else if (date instanceof Date) {
        dateObj = date;
      }
      // Handle string dates
      else if (typeof date === 'string') {
        // Remove any extra whitespace
        date = date.trim();
        
        // Try different date formats
        const formats = [
          // ISO format
          date,
          // DD/MM/YYYY format
          date.includes('/') ? date.split('/').reverse().join('-') : null,
          // DD-MM-YYYY format
          date.includes('-') && date.split('-')[0].length <= 2 ? 
            date.split('-').reverse().join('-') : date
        ].filter(Boolean);
        
        for (const format of formats) {
          const parsedDate = new Date(format!);
          if (!isNaN(parsedDate.getTime())) {
            dateObj = parsedDate;
            break;
          }
        }
      }
      // Handle timestamp (number)
      else if (typeof date === 'number') {
        // Handle both milliseconds and seconds timestamps
        const timestamp = date > 1000000000000 ? date : date * 1000;
        dateObj = new Date(timestamp);
      }
      
      // If we have a valid date object, format it
      if (dateObj && !isNaN(dateObj.getTime())) {
        // You can customize the locale and options as needed
        return dateObj.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
      }
      
      // If all parsing attempts failed, return the original value as string
      return String(date);
      
    } catch (error) {
      console.error('Error formatting date:', error, 'Original date:', date);
      return String(date) || '-';
    }
  }

  async loadSalesData(productId?: string): Promise<void> {
    const idToUse = productId || this.product?.id;
    if (!idToUse) return;

    try {
      this.saleService.getSalesByProductId(idToUse).subscribe({
        next: (sales: any[]) => {
          this.sales = sales;
          console.log('Loaded sales data:', this.sales);
        },
        error: (error: any) => {
          console.error('Error loading sales data:', error);
        }
      });
    } catch (error: any) {
      console.error('Error loading sales data:', error);
    }
  }

  async loadReturnsData(productId?: string): Promise<void> {
    const idToUse = productId || this.product?.id;
    if (!idToUse) return;

    try {
      this.saleService.getReturnsByProductId(idToUse).subscribe({
        next: (returns: any[]) => {
          this.returns = returns;
          console.log('Loaded returns data:', this.returns);
        },
        error: (error: any) => {
          console.error('Error loading returns data:', error);
        }
      });
    } catch (error: any) {
      console.error('Error loading returns data:', error);
    }
  }

  // Existing methods remain the same...
  getTotalPurchasedQuantity(): number {
    return this.purchases.reduce((total, purchase) => {
      const productItem = purchase.products?.find((p: any) => 
        p.productId === this.product.id || p.id === this.product.id
      );
      return total + (productItem?.quantity || 0);
    }, 0);
  }

  getTotalSoldQuantity(): number {
    return this.sales.reduce((total, sale) => {
      const productItem = this.saleService.getProductDetailsFromSale(sale, this.product.id);
      return total + (productItem?.quantity || 0);
    }, 0);
  }

  getTotalReturnedQuantity(): number {
    return this.returns.reduce((total, returnRecord) => {
      const productItem = this.saleService.getProductDetailsFromReturn(returnRecord, this.product.id);
      return total + (productItem?.quantity || 0);
    }, 0);
  }

  getAveragePurchasePrice(): number {
    const validPurchases = this.purchases.filter(purchase => {
      const productItem = purchase.products?.find((p: any) => 
        p.productId === this.product.id || p.id === this.product.id
      );
      return productItem && (productItem.unitCost > 0 || productItem.price > 0);
    });

    if (validPurchases.length === 0) return 0;

    const total = validPurchases.reduce((sum, purchase) => {
      const productItem = purchase.products.find((p: any) => 
        p.productId === this.product.id || p.id === this.product.id
      );
      return sum + (productItem?.unitCost || productItem?.price || 0);
    }, 0);
    
    return total / validPurchases.length;
  }

  getAverageSalePrice(): number {
    const validSales = this.sales.filter(sale => {
      const productItem = this.saleService.getProductDetailsFromSale(sale, this.product.id);
      return productItem && productItem.unitPrice > 0;
    });

    if (validSales.length === 0) return 0;

    const total = validSales.reduce((sum, sale) => {
      const productItem = this.saleService.getProductDetailsFromSale(sale, this.product.id);
      return sum + (productItem?.unitPrice || 0);
    }, 0);
    
    return total / validSales.length;
  }

  // Purchase-related methods
  getProductQuantityInPurchase(purchase: any): number {
    const productItem = purchase.products?.find((p: any) => 
      p.productId === this.product.id || p.id === this.product.id
    );
    return productItem?.quantity || 0;
  }

  getProductUnitPriceInPurchase(purchase: any): number {
    const productItem = purchase.products?.find((p: any) => 
      p.productId === this.product.id || p.id === this.product.id
    );
    return productItem?.unitCost || productItem?.price || 0;
  }

  getProductTotalInPurchase(purchase: any): number {
    const productItem = purchase.products?.find((p: any) => 
      p.productId === this.product.id || p.id === this.product.id
    );
    const quantity = productItem?.quantity || 0;
    const price = productItem?.unitCost || productItem?.price || 0;
    return quantity * price;
  }

  // Sales-related methods
  getProductQuantityInSale(sale: any): number {
    const productItem = this.saleService.getProductDetailsFromSale(sale, this.product.id);
    return productItem?.quantity || 0;
  }

  getProductUnitPriceInSale(sale: any): number {
    const productItem = this.saleService.getProductDetailsFromSale(sale, this.product.id);
    return productItem?.unitPrice || 0;
  }

  getProductTotalInSale(sale: any): number {
    const productItem = this.saleService.getProductDetailsFromSale(sale, this.product.id);
    const quantity = productItem?.quantity || 0;
    const price = productItem?.unitPrice || 0;
    return quantity * price;
  }

  // Return-related methods
  getProductQuantityInReturn(returnRecord: any): number {
    const productItem = this.saleService.getProductDetailsFromReturn(returnRecord, this.product.id);
    return productItem?.quantity || 0;
  }

  getProductUnitPriceInReturn(returnRecord: any): number {
    const productItem = this.saleService.getProductDetailsFromReturn(returnRecord, this.product.id);
    return productItem?.unitPrice || 0;
  }

  getProductTotalInReturn(returnRecord: any): number {
    const productItem = this.saleService.getProductDetailsFromReturn(returnRecord, this.product.id);
    const quantity = productItem?.quantity || 0;
    const price = productItem?.unitPrice || 0;
    return quantity * price;
  }

  // Navigation methods
  viewPurchase(purchaseId: string): void {
    this.router.navigate(['/purchases', purchaseId]);
  }

  viewSale(saleId: string): void {
    this.router.navigate(['/sales', saleId]);
  }

  viewReturn(returnId: string): void {
    this.router.navigate(['/returns', returnId]);
  }

  // Helper method to get status badge class
  getStatusBadgeClass(status: string): string {
    switch (status?.toLowerCase()) {
      case 'paid': return 'bg-success';
      case 'partial': return 'bg-warning text-dark';
      case 'due': return 'bg-danger';
      case 'completed': return 'bg-success';
      case 'pending': return 'bg-warning text-dark';
      case 'cancelled': return 'bg-secondary';
      case 'returned': return 'bg-info';
      case 'partial return': return 'bg-warning text-dark';
      default: return 'bg-secondary';
    }
  }

  // Helper method to format currency
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount || 0);
  }
}