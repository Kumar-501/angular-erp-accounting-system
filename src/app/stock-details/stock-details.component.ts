import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ProductsService } from '../services/products.service';
import { PurchaseService } from '../services/purchase.service';
import { StockService } from '../services/stock.service';
import { Product } from '../models/product.model';
import { SaleService } from '../services/sale.service';
import { FormBuilder, FormGroup } from '@angular/forms';

interface Sale {
  id?: string;
  saleDate: Date;
  invoiceNo: string;
  customer: string;
  status: string;
  products?: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    discountPercent?: number;
    subtotal: number;
    taxAmount: number;
    lineTotal: number;
  }>;
}

interface Purchase {
  id?: string;
  supplierId: string;
  supplierName: string;
  referenceNo: string;
  purchaseDate: Date;
  purchaseStatus: string;
  paymentStatus?: string;
  products?: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitCost: number;
    discountPercent?: number;
    subtotal: number;
    taxAmount: number;
    lineTotal: number;
  }>;
}

interface ProfitLossItem {
  date: Date;
  type: 'purchase' | 'sale';
  reference: string;
  quantity: number;
  unitPrice: number;
  total: number;
  profitLoss: number;
  counterparty: string;
}

@Component({
  selector: 'app-stock-details',
  templateUrl: './stock-details.component.html',
  styleUrls: ['./stock-details.component.scss']
})
export class StockDetailsComponent implements OnInit {
  productId: string = '';
  product: Product | null = null;
  purchases: Purchase[] = [];
  sales: Sale[] = [];
  allSales: Sale[] = []; // Store all sales for filtering
  isLoading: boolean = true;
  activeTab: 'purchases' | 'sales' | 'profit-loss' = 'purchases';
  profitLossData: ProfitLossItem[] = [];
  totalPurchased: number = 0;
  totalSold: number = 0;
  remainingStock: number = 0;
  totalProfitLoss: number = 0;
  filterForm: FormGroup;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private productsService: ProductsService,
    private purchaseService: PurchaseService,
    private stockService: StockService,
    private saleService: SaleService,
    private fb: FormBuilder
  ) {
    this.filterForm = this.fb.group({
      startDate: [''],
      endDate: [''],
      counterparty: ['']
    });
  }

  ngOnInit(): void {
    this.productId = this.route.snapshot.paramMap.get('id') || '';
    if (!this.productId) {
      this.router.navigate(['/stock-report']);
      return;
    }

    this.loadProductDetails();
    this.loadPurchaseHistory();
    this.loadSalesHistory();
  }

  async loadProductDetails(): Promise<void> {
    try {
      const product = await this.productsService.getProductById(this.productId);
      if (product) {
        this.product = {
          ...product,
          id: product.id || '',
          productName: product.productName || '',
          sku: product.sku || '',
          category: product.category || '-',
          brand: product.brand || '-',
          unit: product.unit || '',
          currentStock: product.currentStock || 0,
          alertQuantity: product.alertQuantity || 0,
          unitPurchasePrice: product.defaultPurchasePriceExcTax || product.unitPurchasePrice || 0,
          unitSellingPrice: product.defaultSellingPriceExcTax || product.unitSellingPrice || 0,
        } as Product;
      }
    } catch (error) {
      console.error('Error loading product details:', error);
    }
  }

  async loadPurchaseHistory(): Promise<void> {
    try {
      const purchases = await this.purchaseService.getPurchasesByProductId(this.productId);
      this.purchases = purchases.map(p => ({
        ...p,
        purchaseDate: p.purchaseDate instanceof Date ? p.purchaseDate : new Date(p.purchaseDate)
      })) as Purchase[];
      this.calculateTotals();
    } catch (error) {
      console.error('Error loading purchase history:', error);
    }
  }

  async loadSalesHistory(): Promise<void> {
    try {
      this.isLoading = true;
      
      // Load all sales for this product
      const sales = await this.saleService.getSalesByProductId(this.productId);
      
      // Format the sales data
      this.allSales = sales.map(sale => ({
        ...sale,
        saleDate: sale.saleDate instanceof Date ? sale.saleDate : new Date(sale.saleDate),
        customer: sale.customer || 'Walk-in Customer',
        invoiceNo: sale.invoiceNo || 'N/A',
        status: sale.status || 'Completed'
      }));
      
      // Apply filters if any
      this.applyFiltersToSales();
      
      this.calculateTotals();
    } catch (error) {
      console.error('Error loading sales history:', error);
      this.sales = [];
      this.allSales = [];
    } finally {
      this.isLoading = false;
    }
  }

  // New method to apply filters to the loaded sales
  private applyFiltersToSales(): void {
    let filteredSales = [...this.allSales];
    const filters = this.filterForm.value;

    // Apply date filters
    if (filters.startDate) {
      const startDate = new Date(filters.startDate);
      filteredSales = filteredSales.filter(sale => 
        new Date(sale.saleDate) >= startDate
      );
    }

    if (filters.endDate) {
      const endDate = new Date(filters.endDate);
      endDate.setHours(23, 59, 59, 999); // Include the entire end date
      filteredSales = filteredSales.filter(sale => 
        new Date(sale.saleDate) <= endDate
      );
    }

    // Apply counterparty (customer) filter
    if (filters.counterparty && filters.counterparty.trim()) {
      const searchTerm = filters.counterparty.toLowerCase().trim();
      filteredSales = filteredSales.filter(sale => 
        sale.customer.toLowerCase().includes(searchTerm)
      );
    }

    this.sales = filteredSales;
  }

  calculateTotals(): void {
    // Calculate total purchased
    this.totalPurchased = this.purchases.reduce((total, purchase) => {
      return total + this.getPurchaseProductQuantity(purchase);
    }, 0);

    // Calculate total sold - use all sales, not filtered ones for total calculation
    this.totalSold = this.allSales.reduce((total, sale) => {
      return total + this.getSaleProductQuantity(sale);
    }, 0);

    // Calculate remaining stock
    this.remainingStock = this.product?.currentStock || 0;

    // Calculate profit/loss data using filtered sales for display
    this.profitLossData = [];

    // Add purchases to profit/loss data
    this.purchases.forEach(purchase => {
      const quantity = this.getPurchaseProductQuantity(purchase);
      const unitPrice = this.getPurchaseProductUnitPrice(purchase);
      const total = this.getPurchaseProductTotal(purchase);

      this.profitLossData.push({
        date: purchase.purchaseDate,
        type: 'purchase',
        reference: purchase.referenceNo,
        quantity: quantity,
        unitPrice: unitPrice,
        total: total,
        profitLoss: 0, // Purchases don't contribute to profit directly
        counterparty: purchase.supplierName
      });
    });

    // Add filtered sales to profit/loss data - FIXED VERSION
    this.sales.forEach(sale => {
      const productItem = this.getSaleProductItem(sale);
      
      if (productItem) {
        const quantity = productItem.quantity || 0;
        // Fixed unit price calculation with multiple fallbacks
        let unitPrice = 0;
        
        if (productItem.unitPrice && productItem.unitPrice > 0) {
          unitPrice = productItem.unitPrice;
        } else if (productItem.lineTotal && quantity > 0) {
          // Calculate from line total divided by quantity
          unitPrice = productItem.lineTotal / quantity;
        } else if (productItem.subtotal && quantity > 0) {
          // Fallback to subtotal divided by quantity
          unitPrice = productItem.subtotal / quantity;
        }
        
        const total = productItem.lineTotal || productItem.subtotal || (unitPrice * quantity);
        const purchasePrice = this.product?.unitPurchasePrice || 0;
        const profitLoss = (unitPrice - purchasePrice) * quantity;

        console.log('Sale Debug:', {
          invoiceNo: sale.invoiceNo,
          productItem: productItem,
          quantity: quantity,
          unitPrice: unitPrice,
          total: total,
          purchasePrice: purchasePrice,
          profitLoss: profitLoss
        });

        this.profitLossData.push({
          date: sale.saleDate,
          type: 'sale',
          reference: sale.invoiceNo,
          quantity: quantity,
          unitPrice: unitPrice,
          total: total,
          profitLoss: profitLoss,
          counterparty: sale.customer
        });
      }
    });

    // Sort by date
    this.profitLossData.sort((a, b) => b.date.getTime() - a.date.getTime());

    // Calculate total profit/loss from all sales (not just filtered) - FIXED VERSION
    this.totalProfitLoss = this.allSales.reduce((total, sale) => {
      const productItem = this.getSaleProductItem(sale);
      
      if (productItem) {
        const quantity = productItem.quantity || 0;
        let unitPrice = 0;
        
        if (productItem.unitPrice && productItem.unitPrice > 0) {
          unitPrice = productItem.unitPrice;
        } else if (productItem.lineTotal && quantity > 0) {
          unitPrice = productItem.lineTotal / quantity;
        } else if (productItem.subtotal && quantity > 0) {
          unitPrice = productItem.subtotal / quantity;
        }
        
        const purchasePrice = this.product?.unitPurchasePrice || 0;
        const profitLoss = (unitPrice - purchasePrice) * quantity;
        return total + profitLoss;
      }
      
      return total;
    }, 0);
  }

  applyFilters(): void {
    // Apply filters to the already loaded sales data
    this.applyFiltersToSales();
    this.calculateTotals();
  }

  resetFilters(): void {
    this.filterForm.reset();
    this.applyFiltersToSales(); // This will show all sales again
    this.calculateTotals();
  }

  // Purchase methods
  getPurchaseProductQuantity(purchase: Purchase): number {
    if (!purchase.products || !Array.isArray(purchase.products)) return 0;
    const productItem = purchase.products.find(item => item.productId === this.productId);
    return productItem ? productItem.quantity : 0;
  }

  getPurchaseProductUnitPrice(purchase: Purchase): number {
    if (!purchase.products || !Array.isArray(purchase.products)) return 0;
    const productItem = purchase.products.find(item => item.productId === this.productId);
    return productItem ? productItem.unitCost : 0;
  }

  getPurchaseProductTotal(purchase: Purchase): number {
    if (!purchase.products || !Array.isArray(purchase.products)) return 0;
    const productItem = purchase.products.find(item => item.productId === this.productId);
    return productItem ? productItem.lineTotal : 0;
  }

  // Helper method to get sale product item - NEW
  getSaleProductItem(sale: Sale): any {
    if (!sale.products || !Array.isArray(sale.products)) return null;
    return sale.products.find(item => item.productId === this.productId);
  }

  // Sale methods - Updated with better error handling
  getSaleProductQuantity(sale: Sale): number {
    const productItem = this.getSaleProductItem(sale);
    return productItem ? productItem.quantity || 0 : 0;
  }

  // FIXED: Improved getSaleProductUnitPrice method
  getSaleProductUnitPrice(sale: Sale): number {
    const productItem = this.getSaleProductItem(sale);
    
    if (!productItem) return 0;
    
    // Primary: Use unitPrice if available and greater than 0
    if (productItem.unitPrice && productItem.unitPrice > 0) {
      return productItem.unitPrice;
    }
    
    // Secondary: Calculate from lineTotal and quantity
    if (productItem.lineTotal && productItem.quantity && productItem.quantity > 0) {
      return productItem.lineTotal / productItem.quantity;
    }
    
    // Tertiary: Calculate from subtotal and quantity
    if (productItem.subtotal && productItem.quantity && productItem.quantity > 0) {
      return productItem.subtotal / productItem.quantity;
    }
    
    return 0;
  }

  getSaleProductTotal(sale: Sale): number {
    const productItem = this.getSaleProductItem(sale);
    return productItem ? productItem.lineTotal || productItem.subtotal || 0 : 0;
  }

  calculateMargin(sellingPrice: number, purchasePrice: number): number {
    if (purchasePrice === 0) return 0;
    return Math.round(((sellingPrice - purchasePrice) / purchasePrice) * 100 * 100) / 100;
  }

  goBack(): void {
    this.router.navigate(['/stock-report']);
  }

  setActiveTab(tab: 'purchases' | 'sales' | 'profit-loss'): void {
    this.activeTab = tab;
  }
}