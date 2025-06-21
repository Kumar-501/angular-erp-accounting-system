import { Component, OnInit } from '@angular/core';
import { ProductsService } from '../services/products.service';
import { Router } from '@angular/router';
import { LocationService } from '../services/location.service';
import { StockService } from '../services/stock.service';
import { forkJoin } from 'rxjs';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { BrandsService } from '../services/brands.service';
import { CategoriesService } from '../services/categories.service';
import { TaxService } from '../services/tax.service';

@Component({
  selector: 'app-not-for-selling-products',
  templateUrl: './not-for-selling-products.component.html',
  styleUrls: ['./not-for-selling-products.component.scss']
})
export class NotForSellingProductsComponent implements OnInit {
  products: any[] = [];
  filteredProducts: any[] = [];
  currentSortColumn: string = 'productName';
  isAscending: boolean = true;
  brands: any[] = [];
  taxRates: any[] = [];
  categories: any[] = [];
  locations: any[] = [];
  searchText: string = '';
  currentPage: number = 1;
  itemsPerPage: number = 25;
  Math = Math;
  isLoading: boolean = false;
  selectedProduct: any = null;
  showProductDetailsModal = false;

  constructor(
    private productService: ProductsService,
    private router: Router,
    private locationService: LocationService,
    private brandService: BrandsService,
    private categoryService: CategoriesService,
    private taxService: TaxService,
    private stockService: StockService
  ) {}

  ngOnInit(): void {
    this.loadLocations().then(() => {
      this.loadProducts();
      this.loadBrands();
      this.loadCategories();
      this.loadTaxRates();
    });
  }

  loadProducts(): void {
    this.isLoading = true;
    this.productService.getProductsRealTime().subscribe((data: any[]) => {
      // Filter only not-for-selling products
      this.products = data.filter(product => product.notForSelling === true);
      
      // Format products
      this.products = this.products.map(product => {
        // Format tax display
        if (product.applicableTax) {
          if (typeof product.applicableTax === 'string') {
            product.displayTax = product.applicableTax;
          } else if (product.applicableTax.name) {
            product.displayTax = `${product.applicableTax.name} (${product.applicableTax.percentage}%)`;
          } else {
            product.displayTax = '-';
          }
        } else {
          product.displayTax = '-';
        }
        
        // Format expiry date if needed
        if (product.expiryDate) {
          product.formattedExpiryDate = new Date(product.expiryDate).toLocaleDateString();
        }
        
        return product;
      });
      
      this.filteredProducts = [...this.products];
      this.isLoading = false;
    }, error => {
      console.error('Error loading products:', error);
      this.isLoading = false;
    });
  }

  loadLocations(): Promise<void> {
    return new Promise((resolve) => {
      this.locationService.getLocations().subscribe((locations: any[]) => {
        this.locations = locations;
        resolve();
      }, error => {
        console.error('Error loading locations:', error);
        resolve();
      });
    });
  }

  loadBrands(): void {
    this.brandService.getBrands().subscribe(brands => {
      this.brands = brands;
    });
  }

  loadCategories(): void {
    this.categoryService.getCategories().subscribe(categories => {
      this.categories = categories;
    });
  }

  loadTaxRates(): void {
    this.taxService.getTaxRates().subscribe(taxes => {
      this.taxRates = taxes;
    });
  }

  sortBy(column: string): void {
    if (this.currentSortColumn === column) {
      this.isAscending = !this.isAscending;
    } else {
      this.currentSortColumn = column;
      this.isAscending = true;
    }

    this.filteredProducts.sort((a, b) => {
      const valA = a[column] === undefined || a[column] === null ? '' : a[column];
      const valB = b[column] === undefined || b[column] === null ? '' : b[column];

      if (column === 'defaultPurchasePriceExcTax' || 
          column === 'defaultSellingPriceExcTax' || 
          column === 'currentStock') {
        const numA = Number(valA) || 0;
        const numB = Number(valB) || 0;
        return this.isAscending ? numA - numB : numB - numA;
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      
      if (strA < strB) {
        return this.isAscending ? -1 : 1;
      }
      if (strA > strB) {
        return this.isAscending ? 1 : -1;
      }
      return 0;
    });

    this.currentPage = 1;
  }

  viewProductDetails(product: any): void {
    this.selectedProduct = product;
    this.showProductDetailsModal = true;
  }

  closeProductDetailsModal(): void {
    this.showProductDetailsModal = false;
    this.selectedProduct = null;
  }

  editProduct(productId: string): void {
    this.router.navigate(['/products/edit', productId]);
  }

  onSearchInput(): void {
    this.filterProducts();
  }

  filterProducts(): void {
    if (!this.searchText || this.searchText.trim() === '') {
      this.filteredProducts = [...this.products];
      return;
    }

    const searchLower = this.searchText.toLowerCase().trim();
    this.filteredProducts = this.products.filter(product => {
      const searchString = [
        product.productName,
        product.sku,
        product.category,
        product.brand,
        product.productType,
        product.locationName,
        product.displayStock?.toString(),
        product.defaultPurchasePriceExcTax?.toString(),
        product.defaultSellingPriceExcTax?.toString()
      ]
      .filter(field => field)
      .join(' ')
      .toLowerCase();
      
      return searchString.includes(searchLower);
    });
    
    this.currentPage = 1;
    this.sortBy(this.currentSortColumn);
  }

  getPages(): number[] {
    const pageCount = Math.ceil(this.filteredProducts.length / this.itemsPerPage);
    return Array.from({length: pageCount}, (_, i) => i + 1);
  }

  updatePaginatedProducts(): void {
    this.currentPage = 1;
  }

  toggleSellingStatus(productId: string, notForSelling: boolean): void {
    if (confirm('Are you sure you want to change the selling status of this product?')) {
      this.isLoading = true;
      this.productService.updateProduct(productId, { notForSelling: notForSelling })
        .then(() => {
          this.loadProducts(); // Reload the products after update
        })
        .catch(error => {
          console.error('Error updating product:', error);
          this.isLoading = false;
        });
    }
  }
}