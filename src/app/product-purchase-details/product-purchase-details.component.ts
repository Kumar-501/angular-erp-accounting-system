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
  locations: any[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private locationService: LocationService,
    private saleService: SaleService
  ) { }

  ngOnInit(): void {
    // Get the navigation state
    const navigation = window.history.state;
    
    if (navigation.productData) {
      this.product = navigation.productData;
      this.purchases = navigation.purchaseData || [];
      this.loadSalesData();
    } else {
      // Handle case where data wasn't passed via state
      const productId = this.route.snapshot.paramMap.get('id');
      if (productId) {
        // Here you would fetch the data if not passed via state
        this.loadSalesData(productId);
      }
    }
  }

  async loadSalesData(productId?: string): Promise<void> {
    const idToUse = productId || this.product?.id;
    if (!idToUse) return;

    try {
      const sales: any[] = await this.saleService.getSalesByProductId(idToUse);
      this.sales = sales;
    } catch (error: any) {
      console.error('Error loading sales data:', error);
    }
  }

  // Existing methods remain the same...
  getTotalPurchasedQuantity(): number {
    return this.purchases.reduce((total, purchase) => {
      const productItem = purchase.products.find((p: any) => p.productId === this.product.id);
      return total + (productItem?.quantity || 0);
    }, 0);
  }

  getTotalSoldQuantity(): number {
    return this.sales.reduce((total, sale) => {
      const productItem = sale.products.find((p: any) => p.productId === this.product.id);
      return total + (productItem?.quantity || 0);
    }, 0);
  }

  getAveragePurchasePrice(): number {
    const total = this.purchases.reduce((sum, purchase) => {
      const productItem = purchase.products.find((p: any) => p.productId === this.product.id);
      return sum + (productItem?.unitCost || 0);
    }, 0);
    
    return this.purchases.length > 0 ? total / this.purchases.length : 0;
  }

  getAverageSalePrice(): number {
    const total = this.sales.reduce((sum, sale) => {
      const productItem = sale.products.find((p: any) => p.productId === this.product.id);
      return sum + (productItem?.unitPrice || 0);
    }, 0);
    
    return this.sales.length > 0 ? total / this.sales.length : 0;
  }

  getProductQuantityInPurchase(purchase: any): number {
    const productItem = purchase.products.find((p: any) => p.productId === this.product.id);
    return productItem?.quantity || 0;
  }

  getProductUnitPriceInPurchase(purchase: any): number {
    const productItem = purchase.products.find((p: any) => p.productId === this.product.id);
    return productItem?.unitCost || 0;
  }

  getProductTotalInPurchase(purchase: any): number {
    const productItem = purchase.products.find((p: any) => p.productId === this.product.id);
    return (productItem?.quantity || 0) * (productItem?.unitCost || 0);
  }

  getProductQuantityInSale(sale: any): number {
    const productItem = sale.products.find((p: any) => p.productId === this.product.id);
    return productItem?.quantity || 0;
  }

  getProductUnitPriceInSale(sale: any): number {
    const productItem = sale.products.find((p: any) => p.productId === this.product.id);
    return productItem?.unitPrice || 0;
  }

  getProductTotalInSale(sale: any): number {
    const productItem = sale.products.find((p: any) => p.productId === this.product.id);
    return (productItem?.quantity || 0) * (productItem?.unitPrice || 0);
  }

  viewPurchase(purchaseId: string): void {
    this.router.navigate(['/purchases', purchaseId]);
  }

  viewSale(saleId: string): void {
    this.router.navigate(['/sales', saleId]);
  }
}