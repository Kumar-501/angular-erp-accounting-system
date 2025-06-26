import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Router } from '@angular/router';
import { LocationService } from '../services/location.service';
import { SaleService } from '../services/sale.service';
import { PurchaseStockPriceLogService, PurchaseStockPriceLog } from '../services/purchase-stock-price-log.service';
import { SalesStockPriceLogService, SalesStockPriceLog } from '../services/sales-stock-price-log.service';
import { GinTransferService, GinTransfer } from '../services/gin-transfer.service';

@Component({
  selector: 'app-product-purchase-details',
  templateUrl: './product-purchase-details.component.html',
  styleUrls: ['./product-purchase-details.component.scss']
})
export class ProductPurchaseDetailsComponent implements OnInit {
  product: any = null;
  purchases: any[] = [];
  purchaseLogs: PurchaseStockPriceLog[] = []; // Add this for purchase logs
  salesLogs: SalesStockPriceLog[] = []; // Add this for sales logs
  sales: any[] = [];
  locations: any[] = [];

  ginTransfers: GinTransfer[] = [];
  suppliersMap: Map<string, any> = new Map(); // To store supplier details

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private locationService: LocationService,
    private saleService: SaleService,
    private purchaseStockPriceLogService: PurchaseStockPriceLogService,
    private salesStockPriceLogService: SalesStockPriceLogService,
    private ginTransferService: GinTransferService

  ) { }
  ngOnInit(): void {
    // Get the navigation state
    const navigation = window.history.state;
    console.log('Navigation state:', navigation);
      if (navigation.productData) {
      this.product = navigation.productData;
      this.loadPurchaseHistory();
      this.loadSalesHistory(); // Add this line
        this.loadSalesData();
        this.loadGinTransfers(); // Add this line
    this.loadLocations();


    } else {
      // Handle case where data wasn't passed via state
      const productId = this.route.snapshot.paramMap.get('id');
      if (productId) {
        // Here you would fetch the product data if not passed via state
        this.loadPurchaseHistory(productId);
        this.loadSalesHistory(productId); // Add this line
        this.loadSalesData(productId);
              this.loadGinTransfers(productId); // Add this line

      }
    }}

  async loadPurchaseHistory(productId?: string): Promise<void> {
    const idToUse = productId || this.product?.id;
    if (!idToUse) return;

    try {
      this.purchaseStockPriceLogService.getLogsByProductId(idToUse).subscribe({
        next: (logs) => {
          this.purchaseLogs = logs;
          console.log('Loaded purchase logs:', this.purchaseLogs);
        },
        error: (error) => {
          console.error('Error loading purchase history:', error);
        }
      });
    } catch (error: any) {
      console.error('Error loading purchase history:', error);
    }
  }  async loadSalesHistory(productId?: string): Promise<void> {
    const idToUse = productId || this.product?.id;
    console.log('Loading sales history for:', { 
      productId: idToUse, 
      productName: this.product?.productName,
      product: this.product 
    });

    try {
      this.salesLogs = [];
      
      // First try to get by productId if it exists and is not empty
      if (idToUse && idToUse.trim() !== '') {
        console.log('Searching sales by productId:', idToUse);
        this.salesLogs = await this.salesStockPriceLogService.getSalesStockPriceLogsByProduct(idToUse);
        console.log('Sales found by productId:', this.salesLogs.length);
      }
      
      // If no results and we have a product name, try searching by product name
      if (this.salesLogs.length === 0 && this.product?.productName) {
        console.log('No sales found by productId, trying productName:', this.product.productName);
        try {
          this.salesLogs = await this.salesStockPriceLogService.getSalesStockPriceLogsByProductName(this.product.productName);
          console.log('Sales found by productName:', this.salesLogs.length);
        } catch (nameSearchError) {
          console.log('Product name search failed, trying manual filter approach');
        }
      }
      
      // If still no results, try a broader search using all sales logs and filter manually
      if (this.salesLogs.length === 0 && this.product?.productName) {
        console.log('Trying to find sales with manual filtering for productName:', this.product.productName);
        try {
          const allSalesLogs = await this.salesStockPriceLogService.getAllSalesStockPriceLogsPublic();
          console.log('Total sales logs retrieved:', allSalesLogs.length);
          
          // Filter for exact product name match (case-sensitive)
          this.salesLogs = allSalesLogs.filter(log => {
            const isMatch = log.productName && log.productName.trim() === this.product.productName.trim();
            if (isMatch) {
              console.log('Found matching sales log:', {
                productName: log.productName,
                productId: log.productId,
                quantity: log.quantity,
                sellingPrice: log.sellingPrice,
                invoiceNo: log.invoiceNo
              });
            }
            return isMatch;
          });
          console.log('Sales found with manual filtering:', this.salesLogs.length);
        } catch (manualFilterError) {
          console.error('Manual filter approach failed:', manualFilterError);
        }
      }      // Sort sales logs by date (newest first)
      if (this.salesLogs.length > 0) {
        this.salesLogs.sort((a, b) => {
          try {
            const dateAValue = a.saleCreatedDate || a.createdAt || new Date();
            const dateBValue = b.saleCreatedDate || b.createdAt || new Date();
            
            let dateA: Date;
            let dateB: Date;
            
            // Handle different date formats for dateA
            if (dateAValue && typeof dateAValue === 'object' && 'toDate' in dateAValue) {
              dateA = (dateAValue as any).toDate();
            } else if (dateAValue && typeof dateAValue === 'object' && 'seconds' in dateAValue) {
              dateA = new Date((dateAValue as any).seconds * 1000);
            } else {
              dateA = new Date(dateAValue as string);
            }
            
            // Handle different date formats for dateB
            if (dateBValue && typeof dateBValue === 'object' && 'toDate' in dateBValue) {
              dateB = (dateBValue as any).toDate();
            } else if (dateBValue && typeof dateBValue === 'object' && 'seconds' in dateBValue) {
              dateB = new Date((dateBValue as any).seconds * 1000);
            } else {
              dateB = new Date(dateBValue as string);
            }
            
            return dateB.getTime() - dateA.getTime();
          } catch (error) {
            console.warn('Error sorting sales logs by date:', error);
            return 0;
          }
        });
      }
      
      console.log('Final sales logs loaded:', this.salesLogs);
    } catch (error: any) {
      console.error('Error loading sales history:', error);
    }
  }
// In your component
async loadLocations(): Promise<void> {
  try {
    this.locations = await this.locationService.getAllLocations();
  } catch (error) {
    console.error('Error loading locations:', error);
    this.locations = [];
  }
}
getTotalTransferredOutQuantity(): number {
  return this.ginTransfers.reduce((total, transfer) => {
    const item = transfer.items?.find(i => 
      i.productId === this.product.id || i.productName === this.product.productName
    );
    return total + (item?.quantity || 0);
  }, 0);
}
getLocationName(locationId: string): string {
  if (!locationId) return '-';
  
  // First try exact match
  const location = this.locations.find(loc => loc.id === locationId);
  if (location) return location.name;
  
  // If not found, try partial match (useful if IDs change slightly)
  const partialMatch = this.locations.find(loc => 
    loc.id.includes(locationId) || locationId.includes(loc.id)
  );
  
  return partialMatch?.name || locationId; // Return ID if no match found
}
getTotalTransferredInQuantity(): number {
  // This would depend on your business logic - 
  // you might need to track incoming transfers separately
  return 0;
  }
  
  getTransferQuantity(transfer: GinTransfer): number {
  if (!transfer.items || !this.product) return 0;
  
  const item = transfer.items.find(i => 
    i.productId === this.product.id || 
    i.productName === this.product.productName
  );
  
  return item?.quantity || 0;
}
async loadGinTransfers(productId?: string): Promise<void> {
  const idToUse = productId || this.product?.id;
  if (!idToUse) return;

  try {
    // First try to get by productId
    this.ginTransfers = await this.ginTransferService.getGinTransfersByProductId(idToUse);
    
    // If no results and we have a product name, try by product name
    if (this.ginTransfers.length === 0 && this.product?.productName) {
      this.ginTransfers = await this.ginTransferService.getGinTransfersByProductName(this.product.productName);
    }
    
    console.log('Loaded GIN transfers:', this.ginTransfers);
  } catch (error) {
    console.error('Error loading GIN transfers:', error);
    this.ginTransfers = [];
  }
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
  formatSalesDate(date: any): string {
    if (!date) return '-';
    
    try {
      let dateObj: Date;
      
      // Handle Firestore Timestamp with toDate method
      if (date && typeof date === 'object' && typeof date.toDate === 'function') {
        dateObj = date.toDate();
      }
      // Handle Firestore Timestamp with seconds/nanoseconds
      else if (date && typeof date === 'object' && 'seconds' in date) {
        dateObj = new Date((date as any).seconds * 1000);
      }
      // Handle regular Date object
      else if (date instanceof Date) {
        dateObj = date;
      }
      // Handle string dates
      else if (typeof date === 'string') {
        // Try to handle different string date formats
        let parsedDate = new Date(date);
        if (isNaN(parsedDate.getTime())) {
          // Try DD/MM/YYYY format
          if (date.includes('/')) {
            const parts = date.split('/');
            if (parts.length === 3) {
              parsedDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
            }
          }
          // Try DD-MM-YYYY format
          else if (date.includes('-') && date.split('-')[0].length <= 2) {
            const parts = date.split('-');
            if (parts.length === 3) {
              parsedDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
            }
          }
        }
        dateObj = parsedDate;
      } else {
        return String(date);
      }
      
      if (isNaN(dateObj.getTime())) {
        console.warn('Invalid date received:', date);
        return String(date);
      }
      
      return dateObj.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch (error) {
      console.error('Error formatting sales date:', error, date);
      return String(date) || '-';
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
  // Updated methods to work with purchase logs...
  getTotalPurchasedQuantity(): number {
    return this.purchaseLogs.reduce((total, log) => {
      return total + (log.receivedQuantity || 0);
    }, 0);
  }

  getTotalSoldQuantity(): number {
    return this.sales.reduce((total, sale) => {
      const productItem = sale.products?.find((p: any) => 
        p.productId === this.product.id || p.id === this.product.id
      );
      return total + (productItem?.quantity || 0);
    }, 0);
  }

  getAveragePurchasePrice(): number {
    const validLogs = this.purchaseLogs.filter(log => log.unitPurchasePrice > 0);

    if (validLogs.length === 0) return 0;

    const total = validLogs.reduce((sum, log) => {
      return sum + (log.unitPurchasePrice || 0);
    }, 0);
    
    return total / validLogs.length;
  }
  getAverageSalePrice(): number {
    const validSales = this.sales.filter(sale => {
      const productItem = sale.products?.find((p: any) => 
        p.productId === this.product.id || p.id === this.product.id
      );
      return productItem && productItem.unitPrice > 0;
    });

    if (validSales.length === 0) return 0;

    const total = validSales.reduce((sum, sale) => {
      const productItem = sale.products.find((p: any) => 
        p.productId === this.product.id || p.id === this.product.id
      );
      return sum + (productItem?.unitPrice || 0);
    }, 0);
    
    return total / validSales.length;
  }

  // Methods for purchase logs display
  getPurchaseLogQuantity(log: PurchaseStockPriceLog): number {
    return log.receivedQuantity || 0;
  }

  getPurchaseLogUnitPrice(log: PurchaseStockPriceLog): number {
    return log.unitPurchasePrice || 0;
  }

  getPurchaseLogTotal(log: PurchaseStockPriceLog): number {
    return (log.receivedQuantity || 0) * (log.unitPurchasePrice || 0);
  }

  // Methods for sales logs calculations
  getSalesLogQuantity(log: SalesStockPriceLog): number {
    return log.quantity || 0;
  }

  getSalesLogUnitPrice(log: SalesStockPriceLog): number {
    return log.sellingPrice || 0;
  }

  getSalesLogTotal(log: SalesStockPriceLog): number {
    return (log.sellingPrice || 0) * (log.quantity || 0);
  }
  getTotalSalesQuantity(): number {
    return this.salesLogs.reduce((total, log) => total + this.getSalesLogQuantity(log), 0);
  }

  getTotalSalesValue(): number {
    return this.salesLogs.reduce((total, log) => total + this.getSalesLogTotal(log), 0);
  }

  getAverageSalesPrice(): number {
    if (this.salesLogs.length === 0) return 0;
    const validLogs = this.salesLogs.filter(log => log.sellingPrice && log.sellingPrice > 0);
    if (validLogs.length === 0) return 0;
    return validLogs.reduce((total, log) => total + this.getSalesLogUnitPrice(log), 0) / validLogs.length;
  }

  // Legacy methods for backward compatibility (if needed)
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

  getProductQuantityInSale(sale: any): number {
    const productItem = sale.products?.find((p: any) => 
      p.productId === this.product.id || p.id === this.product.id
    );
    return productItem?.quantity || 0;
  }

  getProductUnitPriceInSale(sale: any): number {
    const productItem = sale.products?.find((p: any) => 
      p.productId === this.product.id || p.id === this.product.id
    );
    return productItem?.unitPrice || 0;
  }

  getProductTotalInSale(sale: any): number {
    const productItem = sale.products?.find((p: any) => 
      p.productId === this.product.id || p.id === this.product.id
    );
    const quantity = productItem?.quantity || 0;
    const price = productItem?.unitPrice || 0;
    return quantity * price;
  }

  viewPurchase(purchaseId: string): void {
    this.router.navigate(['/purchases', purchaseId]);
  }

  viewSale(saleId: string): void {
    this.router.navigate(['/sales', saleId]);
  }
}