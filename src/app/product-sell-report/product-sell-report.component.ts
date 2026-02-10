import { Component, OnDestroy, OnInit, ViewChild, ElementRef } from '@angular/core';import { Subscription } from 'rxjs';
import { ProductsService } from '../services/products.service';
import { SaleService } from '../services/sale.service';
import * as XLSX from 'xlsx'; // Import the xlsx library

// --- Import Firestore modules for data lookup ---
import { Firestore, collection, getDocs } from '@angular/fire/firestore';

interface ProductSaleReport {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  totalSales: number;
  averagePrice: number;
  typeOfService: string;
  location: string;
}

@Component({
  selector: 'app-product-sell-report',
  templateUrl: './product-sell-report.component.html',
  styleUrls: ['./product-sell-report.component.scss']
})
export class ProductSellReportComponent implements OnInit, OnDestroy {
  masterProductList: ProductSaleReport[] = [];
  products: ProductSaleReport[] = [];
@ViewChild('startDatePicker') startDatePicker!: ElementRef;
@ViewChild('endDatePicker') endDatePicker!: ElementRef;
  totalQuantity: number = 0;
  totalSales: number = 0;
  currentSortColumn: string = 'totalSales';
  isAscending: boolean = false;

  private dataSubscription: Subscription | undefined;
  isLoading: boolean = true;
  
  searchTerm: string = '';
  startDate: string = '';
  endDate: string = '';
  selectedServiceType: string = '';
  selectedLocation: string = '';
  
  availableServiceTypes: string[] = [];
  availableLocations: string[] = [];

  constructor(
    private productsService: ProductsService,
    private saleService: SaleService,
    private firestore: Firestore
  ) { }

  ngOnInit(): void {
    this.loadProductSalesData();
  }

  ngOnDestroy(): void {
    if (this.dataSubscription) {
      this.dataSubscription.unsubscribe();
    }
  }

  getFormattedDateForInput(dateString: any): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

// 2. Trigger the hidden native picker
openDatePicker(type: 'start' | 'end'): void {
  if (type === 'start') {
    this.startDatePicker.nativeElement.showPicker();
  } else {
    this.endDatePicker.nativeElement.showPicker();
  }
}

// 3. Handle manual entry with validation
onManualDateInput(event: any, type: 'start' | 'end'): void {
  const input = event.target.value.trim();
  const datePattern = /^(\d{2})-(\d{2})-(\d{4})$/;
  const match = input.match(datePattern);
  
  if (match) {
    const day = match[1];
    const month = match[2];
    const year = match[3];
    
    const dateObj = new Date(`${year}-${month}-${day}`);
    if (dateObj && dateObj.getDate() === parseInt(day) && 
        dateObj.getMonth() + 1 === parseInt(month)) {
      
      const formattedDate = `${year}-${month}-${day}`;
      if (type === 'start') {
        this.startDate = formattedDate;
      } else {
        this.endDate = formattedDate;
      }
      this.applyFilters(); // Re-apply report filters
    } else {
      alert('Invalid date! Please enter a valid date in DD-MM-YYYY format.');
      this.resetVisibleInput(event, type);
    }
  } else if (input !== '') {
    alert('Format must be DD-MM-YYYY');
    this.resetVisibleInput(event, type);
  }
}

private resetVisibleInput(event: any, type: 'start' | 'end'): void {
  const value = type === 'start' ? this.startDate : this.endDate;
  event.target.value = this.getFormattedDateForInput(value);
}
  async loadProductSalesData() {
    this.isLoading = true;
    try {
      const serviceTypeMap = new Map<string, string>();
      const serviceTypeCollection = collection(this.firestore, 'typeOfServices');
      const serviceTypeSnapshot = await getDocs(serviceTypeCollection);
      serviceTypeSnapshot.forEach(doc => {
        const serviceName = doc.data()['name'] || doc.data()['serviceName'] || 'Unknown Service';
        serviceTypeMap.set(doc.id, serviceName);
      });

      this.dataSubscription = this.saleService.listenForSales().subscribe(salesData => {
        const salesMap = new Map<string, ProductSaleReport>();
        const uniqueDisplayServiceTypes = new Set<string>();
        const uniqueLocations = new Set<string>();
        const completedSales = salesData.filter(sale => sale.status === 'Completed');

        completedSales.forEach(sale => {
          const serviceTypeIdOrName = sale.typeOfService;
          const serviceTypeDisplayName = serviceTypeMap.get(serviceTypeIdOrName) || serviceTypeIdOrName || 'Standard';
          const saleLocation = sale.businessLocation || 'N/A';
          
          uniqueLocations.add(saleLocation);
          uniqueDisplayServiceTypes.add(serviceTypeDisplayName);

          if (sale.products && sale.products.length > 0) {
            sale.products.forEach((product: any) => {
              const productId = product.id || product.productId;
              if (!productId) return;

              const key = `${productId}-${saleLocation}-${serviceTypeDisplayName}`;
              let reportItem = salesMap.get(key);

              if (!reportItem) {
                reportItem = {
                  productId: productId,
                  productName: product.name || product.productName,
                  sku: product.sku || 'N/A',
                  location: saleLocation,
                  typeOfService: serviceTypeDisplayName,
                  quantity: 0,
                  totalSales: 0,
                  averagePrice: 0,
                };
              }

              const quantity = Number(product.quantity) || 0;
              const subtotal = Number(product.subtotal) || (quantity * (Number(product.unitPrice) || 0));

              reportItem.quantity += quantity;
              reportItem.totalSales += subtotal;
              salesMap.set(key, reportItem);
            });
          }
        });

        this.masterProductList = Array.from(salesMap.values()).map(item => {
          item.averagePrice = item.quantity > 0 ? item.totalSales / item.quantity : 0;
          return item;
        });

        this.availableLocations = Array.from(uniqueLocations).sort();
        this.availableServiceTypes = Array.from(uniqueDisplayServiceTypes).sort();

        this.applyFilters();
        this.isLoading = false;
      });
    } catch (error) {
      console.error('Error loading product sales data:', error);
      this.isLoading = false;
    }
  }

  applyFilters(): void {
    let filteredData = [...this.masterProductList];

    if (this.searchTerm) {
      const lowerCaseSearchTerm = this.searchTerm.toLowerCase();
      filteredData = filteredData.filter(p =>
        p.productName.toLowerCase().includes(lowerCaseSearchTerm) ||
        p.sku.toLowerCase().includes(lowerCaseSearchTerm) ||
        p.location.toLowerCase().includes(lowerCaseSearchTerm)
      );
    }

    if (this.selectedLocation) {
      filteredData = filteredData.filter(p => p.location === this.selectedLocation);
    }

    if (this.selectedServiceType) {
      filteredData = filteredData.filter(p => p.typeOfService === this.selectedServiceType);
    }

    this.products = filteredData;
    this.sortData(this.currentSortColumn, false);
    this.calculateTotals();
  }

  runReport(): void {
    this.applyFilters();
  }

  resetFilters(): void {
    this.startDate = '';
    this.endDate = '';
    this.selectedLocation = '';
    this.selectedServiceType = '';
    this.searchTerm = '';
    this.applyFilters();
  }

  sortData(column: string, toggle: boolean = true): void {
    if (this.currentSortColumn === column && toggle) {
      this.isAscending = !this.isAscending;
    } else {
      this.currentSortColumn = column;
      this.isAscending = true;
    }

    this.products.sort((a, b) => {
      const aValue = a[column as keyof ProductSaleReport];
      const bValue = b[column as keyof ProductSaleReport];

      let comparison = 0;
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue;
      } else {
        comparison = String(aValue).toLowerCase().localeCompare(String(bValue).toLowerCase());
      }

      return this.isAscending ? comparison : -comparison;
    });
  }

  private calculateTotals(): void {
    this.totalQuantity = this.products.reduce((sum, product) => sum + product.quantity, 0);
    this.totalSales = this.products.reduce((sum, product) => sum + product.totalSales, 0);
  }

  // --- FIX APPLIED IN THIS METHOD ---
  exportToExcel(): void {
    const dataToExport = this.products.map(product => ({
      'Product Name': product.productName || 'N/A',
      'SKU': product.sku || 'N/A',
      'Location': product.location,
      'Type of Service': product.typeOfService,
      'Quantity Sold': product.quantity,
      'Average Price': product.averagePrice,
      'Total Sales': product.totalSales
    }));

    // Manually add the total row
    dataToExport.push({
      'Product Name': 'TOTAL',
      'SKU': '',
      'Location': '',
      'Type of Service': '',
      'Quantity Sold': this.totalQuantity,
      'Average Price': null, // <-- FIX: Use null for empty numeric cells
      'Total Sales': this.totalSales
    } as any); // Use 'as any' to satisfy TypeScript for this special-case row

    const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook: XLSX.WorkBook = { Sheets: { 'data': worksheet }, SheetNames: ['data'] };
    const excelBuffer: any = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    this.saveAsExcelFile(excelBuffer, `product_sales_report_${new Date().toISOString().slice(0, 10)}`);
  }

  private saveAsExcelFile(buffer: any, fileName: string): void {
    const data: Blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
    const url = window.URL.createObjectURL(data);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}