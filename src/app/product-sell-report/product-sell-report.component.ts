import { Component, OnInit, OnDestroy } from '@angular/core';
import { ProductsService } from '../services/products.service';
import { SaleService } from '../services/sale.service';
import { Subscription } from 'rxjs';

interface ProductSaleReport {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  totalSales: number;
  averagePrice: number;
}

@Component({
  selector: 'app-product-sell-report',
  templateUrl: './product-sell-report.component.html',
  styleUrls: ['./product-sell-report.component.scss']
})
export class ProductSellReportComponent implements OnInit, OnDestroy {
  products: ProductSaleReport[] = [];
  displayedColumns: string[] = ['productName', 'sku', 'quantity', 'averagePrice', 'totalSales'];
  totalQuantity: number = 0;
  totalSales: number = 0;
  currentSortColumn: string = 'totalSales'; // Default sort by total sales
  isAscending: boolean = false; // Default sort descending (highest first)
  
  private salesSubscription: Subscription | undefined;
  isLoading: boolean = true;
  startDate: string = '';
  endDate: string = '';
  
  constructor(
    private productsService: ProductsService,
    private saleService: SaleService
  ) { }
  
  ngOnInit(): void {
    this.loadProductSalesData();
  }
  
  ngOnDestroy(): void {
    if (this.salesSubscription) {
      this.salesSubscription.unsubscribe();
    }
  }
  
  async loadProductSalesData() {
    try {
      this.isLoading = true;
      this.products = [];
      this.totalQuantity = 0;
      this.totalSales = 0;
      
      // Get all products from the products service
      const allProducts = await this.productsService.fetchAllProducts();
      
      // Create a map to track products by ID and name
      const productMap = new Map<string, ProductSaleReport>();
      allProducts.forEach(product => {
        // Only add products that have a valid ID
        if (product.id) {
          productMap.set(product.id, {
            productId: product.id,
            productName: product.productName,
            sku: product.sku || 'N/A',
            quantity: 0,
            totalSales: 0,
            averagePrice: 0
          });
        }
      });
      
      // Subscribe to sales data
      this.salesSubscription = this.saleService.listenForSales().subscribe(salesData => {
        // Filter completed sales
        const completedSales = salesData.filter(sale => sale.status === 'Completed');
        
        // Process each sale
        completedSales.forEach(sale => {
          // Check if sale date is within filter range if specified
          if (this.isWithinDateRange(sale.saleDate)) {
            // Process products in each sale
            if (sale.products && sale.products.length > 0) {
              sale.products.forEach((product: any) => {
                // Try to find product by ID first, then by name
                let reportItem: ProductSaleReport | undefined;
                
                // Check by product ID (only if ID exists)
                if (product.id && productMap.has(product.id)) {
                  reportItem = productMap.get(product.id);
                }
                // If not found by ID, try to find by name
                else if (product.name) {
                  for (const [_, item] of productMap) {
                    if (item.productName === product.name) {
                      reportItem = item;
                      break;
                    }
                  }
                }
                
                if (reportItem) {
                  const quantity = Number(product.quantity) || 0;
                  const subtotal = Number(product.subtotal) || 
                                  (quantity * (Number(product.unitPrice) || 0));
                  
                  reportItem.quantity += quantity;
                  reportItem.totalSales += subtotal;
                }
              });
            }
          }
        });
        
        // Calculate average prices and convert map to array
        this.products = Array.from(productMap.values())
          .filter(item => item.quantity > 0) // Only show products with sales
          .map(item => {
            item.averagePrice = item.quantity > 0 ? item.totalSales / item.quantity : 0;
            return item;
          })
          .sort((a, b) => b.totalSales - a.totalSales); // Sort by total sales descending
        
        // Calculate totals
        this.calculateTotals();
        this.isLoading = false;
      });
      
    } catch (error) {
      console.error('Error loading product sales data:', error);
      this.isLoading = false;
    }
  }

  sortData(column: string): void {
    if (this.currentSortColumn === column) {
      // If clicking the same column, reverse the sort order
      this.isAscending = !this.isAscending;
    } else {
      // If clicking a new column, set it as the sort column and default to ascending
      this.currentSortColumn = column;
      this.isAscending = true;
    }
  
    this.products.sort((a, b) => {
      // Handle numeric fields differently from string fields
      const numericFields = ['quantity', 'averagePrice', 'totalSales'];
      
      if (numericFields.includes(column)) {
        const aValue = a[column as keyof ProductSaleReport] as number;
        const bValue = b[column as keyof ProductSaleReport] as number;
        return this.isAscending ? aValue - bValue : bValue - aValue;
      } else {
        // String fields
        const aValue = String(a[column as keyof ProductSaleReport]).toLowerCase();
        const bValue = String(b[column as keyof ProductSaleReport]).toLowerCase();
        return this.isAscending 
          ? aValue.localeCompare(bValue) 
          : bValue.localeCompare(aValue);
      }
    });
  }

  private calculateTotals(): void {
    this.totalQuantity = this.products.reduce((sum, product) => sum + product.quantity, 0);
    this.totalSales = this.products.reduce((sum, product) => sum + product.totalSales, 0);
  }
  
  isWithinDateRange(saleDate: string | Date): boolean {
    if (!this.startDate && !this.endDate) return true;
    
    const date = new Date(saleDate);
    const start = this.startDate ? new Date(this.startDate) : null;
    const end = this.endDate ? new Date(this.endDate) : null;
    
    if (start && date < start) return false;
    if (end && date > end) return false;
    return true;
  }
  
  applyDateFilter(): void {
    this.loadProductSalesData();
  }
  
  resetFilters(): void {
    this.startDate = '';
    this.endDate = '';
    this.loadProductSalesData();
  }
  
  exportToCSV(): void {
    const headers = ['Product Name', 'SKU', 'Quantity Sold', 'Average Price', 'Total Sales'];
    
    const data = this.products.map(product => {
      return {
        'Product Name': product.productName || 'N/A',
        'SKU': product.sku || 'N/A',
        'Quantity Sold': product.quantity,
        'Average Price': `₹${product.averagePrice.toFixed(2)}`,
        'Total Sales': `₹${product.totalSales.toFixed(2)}`
      };
    });

    // Add totals row
    data.push({
      'Product Name': 'TOTAL',
      'SKU': '',
      'Quantity Sold': this.totalQuantity,
      'Average Price': '',
      'Total Sales': `₹${this.totalSales.toFixed(2)}`
    });

    const csvContent = this.convertToCSV(data, headers);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `product_sales_report_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  
  private convertToCSV(data: any[], headers: string[]): string {
    const headerRow = headers.join(',');
    const rows = data.map(row => 
      headers.map(fieldName => 
        `"${(row[fieldName] ?? '').toString().replace(/"/g, '""')}"`
      ).join(',')
    );
    
    return [headerRow, ...rows].join('\n');
  }
}