import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ProductsService } from '../services/products.service';
import { Product } from '../models/product.model';

@Component({
  selector: 'app-product-history',
  templateUrl: './product-history.component.html',
  styleUrls: ['./product-history.component.scss']
})
export class ProductHistoryComponent implements OnInit {
  productId: string = '';
  product: Product | null = null;
  historyEntries: any[] = [];
  isLoading: boolean = true;
  productDetailsLoaded: boolean = false;
  purchaseOrders: any[] = [];
  combinedHistory: any[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private productService: ProductsService
  ) {}

  async ngOnInit(): Promise<void> {
    this.productId = this.route.snapshot.paramMap.get('id') || '';
    const navigation = this.router.getCurrentNavigation();
    
    // Get product data from navigation state
    const navState = navigation?.extras.state;
    
    if (navState) {
      this.product = this.normalizeProductData(navState['productData']);
      this.purchaseOrders = navState['purchaseOrders'] || [];
      this.productDetailsLoaded = true;
      
      // Combine both histories
      this.combineHistories();
    }
    
    if (this.productId && !this.productDetailsLoaded) {
      await this.loadProductDetails();
    }
    
    this.loadProductHistory();
  }
  
  private combineHistories(): void {
    // Convert purchase orders to history entries
    const purchaseHistory = this.purchaseOrders.map(order => ({
      id: order.id,
      action: 'purchase_order',
      timestamp: order.date,
      referenceNo: order.referenceNo,
      status: order.status,
      quantity: order.items.find((item: any) => item.productId === this.productId)?.quantity || 0,
      totalAmount: order.total,
      supplier: order.supplierName,
      actionLabel: 'Purchase Order',
      icon: 'fas fa-shopping-cart',
      badgeClass: 'bg-info',
      formattedDate: this.formatDate(order.date),
      by: order.createdBy || 'System'
    }));

    // Combine with existing history entries
    this.combinedHistory = [...purchaseHistory, ...this.historyEntries]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  private async loadProductDetails(): Promise<void> {
    this.isLoading = true;
    try {
      const productData = await this.productService.getProductById(this.productId);
      this.product = this.normalizeProductData(productData);
      this.productDetailsLoaded = true;
    } catch (error: unknown) {
      console.error('Error loading product details:', error);
    } finally {
      this.isLoading = false;
    }
  }

  private normalizeProductData(product: any): Product {
    return {
      id: product.id || '',
      productName: product.productName || product.name || 'Unknown Product',
      sku: product.sku || product.code || '',
      hsnCode: product.hsnCode || '',
      unitPurchasePrice: this.getValidPrice(product.unitPurchasePrice, product.defaultPurchasePriceExcTax, product.purchasePrice),
      unitSellingPrice: this.getValidPrice(product.unitSellingPrice, product.defaultSellingPriceExcTax, product.sellingPrice, product.price),
      barcodeType: product.barcodeType || '',
      unit: product.unit || 'numbers',
      location: product.location || '',
      locationName: product.locationName || this.getLocationName(product.location) || 'No Location',
      isActive: product.isActive !== undefined ? product.isActive : true,
      status: product.status || (product.isActive ? 'Active' : 'Inactive'),
      brand: product.brand || '',
      category: product.category || '',
      subCategory: product.subCategory || '',
      manageStock: product.manageStock !== undefined ? product.manageStock : true,
      alertQuantity: product.alertQuantity ?? null,
      defineProduct: product.defineProduct || 'Regular',
      productDescription: product.productDescription || '',
      productImage: product.productImage || null,
      productBrochure: product.productBrochure || null,
      enableProductDescription: product.enableProductDescription || false,
      notForSelling: product.notForSelling || false,
      weight: product.weight ?? null,
      preparationTime: product.preparationTime ?? null,
      applicableTax: product.applicableTax || '',
      taxPercentage: product.taxPercentage || 0,
      sellingPriceTaxType: product.sellingPriceTaxType || '',
      productType: product.productType || '',
      defaultPurchasePriceExcTax: product.defaultPurchasePriceExcTax ?? null,
      defaultPurchasePriceIncTax: product.defaultPurchasePriceIncTax ?? null,
      marginPercentage: product.marginPercentage || 0,
      defaultSellingPriceExcTax: product.defaultSellingPriceExcTax ?? null,
      defaultSellingPriceIncTax: product.defaultSellingPriceIncTax ?? null,
      createdAt: product.createdAt ? new Date(product.createdAt) : null,
      updatedAt: product.updatedAt ? new Date(product.updatedAt) : null,
      currentStock: product.currentStock || product.quantity || 0,
      components: product.components || [],
      variations: product.variations || [],
      length: product.length ?? null,
      breadth: product.breadth ?? null,
      height: product.height ?? null,
      customField1: product.customField1 || '',
      customField2: product.customField2 || '',
      customField3: product.customField3 || '',
      customField4: product.customField4 || ''
    };
  }

  // Helper method to get valid price from multiple possible sources
  private getValidPrice(...prices: (number | null | undefined)[]): number | null {
    for (const price of prices) {
      if (price !== null && price !== undefined && !isNaN(price)) {
        return price;
      }
    }
    return null;
  }

  private getLocationName(locationId: string): string {
    // You might want to inject LocationService to get location names
    return ''; // Implement based on your location service
  }

  private loadProductHistory(): void {
    this.isLoading = true;
    this.productService.getProductHistory(this.productId).subscribe({
      next: (entries) => {
        this.historyEntries = entries.map(entry => ({
          ...entry,
          formattedDate: this.formatDate(entry.timestamp),
          icon: this.getHistoryIcon(entry.action),
          badgeClass: this.getHistoryBadgeClass(entry.action),
          actionLabel: this.getActionLabel(entry.action)
        }));
        
        // Combine histories after loading
        this.combineHistories();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading product history:', error);
        this.isLoading = false;
      }
    });
  }

  // Helper method to safely get prices - updated to handle null values better
  getPrice(primaryPrice: number | null | undefined, fallbackPrice: number | null | undefined): number {
    if (primaryPrice !== null && primaryPrice !== undefined && !isNaN(primaryPrice)) {
      return primaryPrice;
    }
    if (fallbackPrice !== null && fallbackPrice !== undefined && !isNaN(fallbackPrice)) {
      return fallbackPrice;
    }
    return 0;
  }

  public formatDate(date: string | Date | null): string {
    if (!date) return '';
    try {
      const d = this.parseDate(date);
      return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
    } catch (error: unknown) {
      console.error('Error formatting date:', error);
      return '';
    }
  }

  private parseDate(date: string | Date | null): Date {
    if (!date) return new Date(0);
    if (date instanceof Date) return date;
    return new Date(date);
  }

  getActionLabel(action: string): string {
    switch (action) {
      case 'add': return 'Product Added';
      case 'update': return 'Product Updated';
      case 'stock_update': return 'Stock Updated';
      case 'stock_in': return 'Stock Added';
      case 'stock_out': return 'Stock Removed';
      case 'transfer': return 'Stock Transferred';
      case 'delete': return 'Product Deleted';
      case 'adjustment': return 'Stock Adjusted';
      case 'purchase': return 'Purchase Recorded';
      case 'sale': return 'Sale Recorded';
      case 'purchase_order': return 'Purchase Order';
      default: return action;
    }
  }

  getHistoryIcon(action: string): string {
    switch (action) {
      case 'add': return 'fas fa-plus';
      case 'update': return 'fas fa-sync-alt';
      case 'stock_update': return 'fas fa-boxes';
      case 'stock_in': return 'fas fa-arrow-up';
      case 'stock_out': return 'fas fa-arrow-down';
      case 'transfer': return 'fas fa-exchange-alt';
      case 'delete': return 'fas fa-trash';
      case 'adjustment': return 'fas fa-balance-scale';
      case 'purchase': return 'fas fa-shopping-cart';
      case 'sale': return 'fas fa-cash-register';
      case 'purchase_order': return 'fas fa-shopping-cart';
      default: return 'fas fa-info-circle';
    }
  }

  getHistoryBadgeClass(action: string): string {
    switch (action) {
      case 'add': return 'bg-success';
      case 'update': return 'bg-primary';
      case 'stock_update': return 'bg-info';
      case 'stock_in': return 'bg-success';
      case 'stock_out': return 'bg-warning';
      case 'transfer': return 'bg-info';
      case 'delete': return 'bg-danger';
      case 'adjustment': return 'bg-secondary';
      case 'purchase': return 'bg-success';
      case 'sale': return 'bg-primary';
      case 'purchase_order': return 'bg-info';
      default: return 'bg-secondary';
    }
  }
}