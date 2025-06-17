import { Component, OnInit } from '@angular/core';
import { PurchaseService } from '../services/purchase.service';
import { Purchase } from '../models/purchase.model';
import { ProductsService } from '../services/products.service';
import { StockService } from '../services/stock.service';
import { LocationService } from '../services/location.service';
import { ActivatedRoute } from '@angular/router';
import { SupplierService } from '../services/supplier.service';

interface StockReportItem {
  id: string;
  productName: string;
  sku: string;
  category: string;
  brand: string;
  unit: string;
  locationId: string;
  locationName: string;
  supplierId: string;
  supplierName: string;
  openingStock: number;
  currentStock: number;
  alertQuantity: number;
  purchasePrice: number;
  sellingPrice: number;
  margin: number;
  taxPercentage: number;
  totalSold: number;
}

interface Location {
  id: string;
  name: string;
}

@Component({
  selector: 'app-purchase-data',
  templateUrl: './purchase-data.component.html',
  styleUrls: ['./purchase-data.component.scss']
})
export class PurchaseDataComponent implements OnInit {
  purchases: Purchase[] = [];
  filteredPurchases: Purchase[] = [];
  isLoading = true;
  errorMessage = '';
  suppliers: any[] = [];
  selectedSupplierId = '';
  selectedSupplier: any = null;

  stockData: StockReportItem[] = [];
  stockLocations: Location[] = [];
  filteredStockData: StockReportItem[] = [];
  stockSearchTerm = '';
  selectedStockLocationId = '';
  selectedStockSupplierId = '';
  stockSortColumn: keyof StockReportItem = 'productName';
  stockSortDirection: 'asc' | 'desc' = 'asc';

  constructor(
    private purchaseService: PurchaseService,
    private productsService: ProductsService,
    private stockService: StockService,
    private locationService: LocationService,
    private route: ActivatedRoute,
    private supplierService: SupplierService
  ) {}

  async ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.selectedSupplierId = params['supplierId'] || '';
      if (this.selectedSupplierId) {
        this.loadSupplierDetails(this.selectedSupplierId);
      }
    });
    
    this.loadPurchases();
    this.loadSuppliers();
    await this.loadStockData();
    await this.loadStockLocations();
  }

  loadSupplierDetails(supplierId: string): void {
    this.supplierService.getSupplierById(supplierId).subscribe({
      next: (supplier) => {
        this.selectedSupplier = supplier;
      },
      error: (error) => {
        console.error('Error loading supplier details:', error);
      }
    });
  }

  loadPurchases(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.purchaseService.getPurchases().subscribe({
      next: (purchases) => {
        this.purchases = purchases.filter(p => p.id !== undefined) as Purchase[];
        
        // Filter purchases by supplier if supplierId is provided
        if (this.selectedSupplierId) {
          this.filteredPurchases = this.purchases.filter(p => p.supplierId === this.selectedSupplierId);
        } else {
          this.filteredPurchases = [...this.purchases];
        }
        
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading purchases:', error);
        this.errorMessage = 'Failed to load purchase data';
        this.isLoading = false;
      }
    });
  }

  loadSuppliers(): void {
    this.supplierService.getSuppliers().subscribe({
      next: (suppliers) => {
        this.suppliers = suppliers.map(supplier => ({
          id: supplier.id,
          name: supplier.businessName || `${supplier.firstName} ${supplier.lastName || ''}`
        }));
      },
      error: (error) => {
        console.error('Error loading suppliers:', error);
      }
    });
  }

  applyPurchaseFilter(): void {
    let filtered = [...this.purchases];

    if (this.selectedSupplierId) {
      filtered = filtered.filter(purchase => purchase.supplierId === this.selectedSupplierId);
    }

    this.filteredPurchases = filtered;
  }

  async loadStockLocations(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.locationService.getLocations().subscribe({
          next: (locations) => {
            this.stockLocations = locations.map(loc => ({
              id: loc.id,
              name: loc.locationName || loc.name || 'Unknown Location'
            }));
            resolve();
          },
          error: (error) => {
            console.error('Error loading locations:', error);
            reject(error);
          }
        });
      } catch (error) {
        console.error('Error loading locations:', error);
        reject(error);
      }
    });
  }

  async loadStockData(): Promise<void> {
    try {
      await this.loadStockLocations();

      const products = await this.productsService.fetchAllProducts();

      this.stockData = products.map((product: any) => {
        const location = this.stockLocations.find(l => l.id === product.location);
        const supplier = this.suppliers.find(s => s.id === product.supplierId);

        return {
          id: product.id || '',
          productName: product.productName || '',
          sku: product.sku || '',
          category: product.category || '-',
          brand: product.brand || '-',
          locationId: product.location || '',
          locationName: location ? location.name : 'No Location',
          supplierId: product.supplierId || '',
          supplierName: supplier ? supplier.name : (product.supplierName || '-'),
          unit: product.unit || '',
          openingStock: product.openingStock || product.currentStock || 0,
          currentStock: product.currentStock || 0,
          alertQuantity: product.alertQuantity || 0,
          purchasePrice: product.defaultPurchasePriceExcTax || 0,
          sellingPrice: product.defaultSellingPriceExcTax || 0,
          margin: product.marginPercentage || 0,
          taxPercentage: product.taxPercentage || 0,
          totalSold: Math.max((product.openingStock || product.currentStock || 0) - (product.currentStock || 0), 0)
        };
      });

      // Filter stock data by supplier if supplierId is provided
      if (this.selectedSupplierId) {
        this.filteredStockData = this.stockData.filter(item => item.supplierId === this.selectedSupplierId);
      } else {
        this.filteredStockData = [...this.stockData];
      }
    } catch (error) {
      console.error('Error loading stock data:', error);
    }
  }

  applyStockFilter() {
    let filtered = [...this.stockData];

    // Apply supplier filter first if supplier is selected
    if (this.selectedSupplierId) {
      filtered = filtered.filter(item => item.supplierId === this.selectedSupplierId);
    }

    if (this.stockSearchTerm && this.stockSearchTerm.trim() !== '') {
      const term = this.stockSearchTerm.toLowerCase().trim();
      filtered = filtered.filter(item => (
        String(item.productName || '').toLowerCase().includes(term) ||
        String(item.sku || '').toLowerCase().includes(term) ||
        String(item.category || '').toLowerCase().includes(term) ||
        String(item.brand || '').toLowerCase().includes(term) ||
        String(item.locationName || '').toLowerCase().includes(term) ||
        String(item.supplierName || '').toLowerCase().includes(term)
      ));
    }

    if (this.selectedStockLocationId && this.selectedStockLocationId.trim() !== '') {
      filtered = filtered.filter(item => item.locationId === this.selectedStockLocationId);
    }

    if (this.selectedStockSupplierId && this.selectedStockSupplierId.trim() !== '') {
      filtered = filtered.filter(item => item.supplierId === this.selectedStockSupplierId);
    }

    this.filteredStockData = filtered;
    this.sortStockData(this.stockSortColumn);
  }

  sortStockData(column: keyof StockReportItem) {
    if (this.stockSortColumn === column) {
      this.stockSortDirection = this.stockSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.stockSortColumn = column;
      this.stockSortDirection = 'asc';
    }

    this.filteredStockData.sort((a, b) => {
      const valueA = a[column];
      const valueB = b[column];

      if (valueA === null || valueA === undefined) return this.stockSortDirection === 'asc' ? -1 : 1;
      if (valueB === null || valueB === undefined) return this.stockSortDirection === 'asc' ? 1 : -1;

      if (typeof valueA === 'string' && typeof valueB === 'string') {
        return this.stockSortDirection === 'asc' 
          ? valueA.localeCompare(valueB)
          : valueB.localeCompare(valueA);
      } else if (typeof valueA === 'number' && typeof valueB === 'number') {
        return this.stockSortDirection === 'asc'
          ? valueA - valueB
          : valueB - valueA;
      }
      return 0;
    });
  }

  getStatusClass(status: string | undefined): string {
    return 'status-badge ' + (status || '').toLowerCase().replace(/\s+/g, '-');
  }

  getPaymentStatusClass(status: string | undefined): string {
    return 'payment-status ' + (status || '').toLowerCase().replace(/\s+/g, '-');
  }
}