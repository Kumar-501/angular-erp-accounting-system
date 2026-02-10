import { Component, OnInit, OnDestroy, HostListener, ViewChild, ElementRef } from '@angular/core';import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { DiscountService } from '../services/discount.service';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { Subscription } from 'rxjs';
import { BrandsService } from '../services/brands.service';
import { CategoriesService } from '../services/categories.service';
import { LocationService } from '../services/location.service';
import { ProductsService } from '../services/products.service';

@Component({
  selector: 'app-discount',
  templateUrl: './discount.component.html',
  styleUrls: ['./discount.component.scss']
})
export class DiscountComponent implements OnInit, OnDestroy {
  discountForm: FormGroup;
  discounts: any[] = [];
  filteredDiscounts: any[] = [];
  @ViewChild('startsAtPicker') startsAtPicker!: ElementRef;
@ViewChild('endsAtPicker') endsAtPicker!: ElementRef;
  displayedDiscounts: any[] = [];
  showForm: boolean = false;
  showColumnVisibility: boolean = false;
  private discountSubscription!: Subscription;

  // Table UI properties
  entriesPerPage: number = 25;
  currentPage: number = 1;
  totalEntries: number = 0;
  startEntry: number = 0;
  endEntry: number = 0;
  totalPages: number = 0;
  searchQuery: string = '';
  filteredProducts: any[] = [];
  productSearchQuery: string = '';
  selectedProducts: any[] = [];
  showProductDropdown: boolean = false;
  allProducts: any[] = []; // Store all products for reference

  // Sorting properties
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  // Column visibility configuration
  columns = [
    { name: 'Name', key: 'name', visible: true },
    { name: 'Starts At', key: 'startsAt', visible: true },
    { name: 'Ends At', key: 'endsAt', visible: true },
    { name: 'Discount Amount', key: 'discountAmount', visible: true },
    { name: 'Priority', key: 'priority', visible: true },
    { name: 'Brand', key: 'brand', visible: true },
    { name: 'Category', key: 'category', visible: true },
    { name: 'Products', key: 'products', visible: true },
    { name: 'Location', key: 'location', visible: true },
    { name: 'Action', key: 'action', visible: true }
  ];

  // Data properties
  brands: any[] = [];
  locations: any[] = [];
  priceGroups: any[] = [];
  categories: any[] = [];

  constructor(
    private fb: FormBuilder,
    private discountService: DiscountService,
    private brandsService: BrandsService,
    private categoriesService: CategoriesService,
    private locationService: LocationService,
    private productsService: ProductsService
  ) {
    this.discountForm = this.fb.group({
      id: [null],
      name: ['', Validators.required],
      products: [''],
      brand: [''],
      category: [''],
      location: ['', Validators.required],
      priority: [null],
      discountType: ['', Validators.required],
      discountAmount: ['', [Validators.required, Validators.min(0)]],
      startsAt: [''],
      endsAt: [''],
      sellingPriceGroup: ['all', Validators.required],
      applyInCustomerGroups: [false],
      isActive: [true]
    });
  }

  ngOnInit(): void {
    this.loadDiscounts();
    this.loadFormData();
    this.loadBrands();
    this.loadAllProducts(); // Load all products for reference
  }

  ngOnDestroy(): void {
    if (this.discountSubscription) {
      this.discountSubscription.unsubscribe();
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

// Helper to get YYYY-MM-DD for the hidden native date picker binding
getFormattedDate(dateValue: any): string {
  if (!dateValue) return '';
  const date = new Date(dateValue);
  if (isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
}

openDatePicker(type: 'start' | 'end'): void {
  if (type === 'start') this.startsAtPicker.nativeElement.showPicker();
  else this.endsAtPicker.nativeElement.showPicker();
}

onManualDateInput(event: any, controlName: string): void {
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
      
      const isoDate = `${year}-${month}-${day}`;
      this.discountForm.get(controlName)?.setValue(isoDate);
    } else {
      alert('Invalid date! Please enter a valid date in DD-MM-YYYY format.');
      this.resetVisibleInput(event, controlName);
    }
  } else if (input !== '') {
    alert('Format must be DD-MM-YYYY');
    this.resetVisibleInput(event, controlName);
  }
}

private resetVisibleInput(event: any, controlName: string): void {
  event.target.value = this.getFormattedDateForInput(this.discountForm.get(controlName)?.value);
}
  // Load all products for reference
  loadAllProducts(): void {
    this.productsService.fetchAllProducts().then(products => {
      this.allProducts = products;
    }).catch(error => {
      console.error('Error loading products:', error);
      this.allProducts = [];
    });
  }

  loadFormData(): void {
    this.locationService.getLocations().subscribe({
      next: (locations) => {
        this.locations = locations;
      },
      error: (err) => {
        console.error('Failed to load locations:', err);
        this.locations = [];
      }
    });

    this.priceGroups = [
      { id: '1', name: 'Group 1' },
      { id: '2', name: 'Group 2' }
    ];
  }

  // Method to get product names from IDs
  getProductNames(productIds: string): string {
    if (!productIds || !this.allProducts.length) {
      return '-';
    }

    const ids = productIds.split(',').filter(id => id.trim());
    const names = ids.map(id => {
      const product = this.allProducts.find(p => p.id === id.trim());
      return product ? product.productName : id;
    });

    return names.join(', ') || '-';
  }

  searchProducts(): void {
    if (this.productSearchQuery.trim() === '') {
      this.filteredProducts = [];
      return;
    }

    this.productsService.searchProducts(this.productSearchQuery).then(products => {
      this.filteredProducts = products;
      this.showProductDropdown = true;
    }).catch(error => {
      console.error('Error searching products:', error);
      this.filteredProducts = [];
    });
  }

  selectProduct(product: any): void {
    if (!this.selectedProducts.some(p => p.id === product.id)) {
      this.selectedProducts.push(product);
      this.discountForm.patchValue({
        products: this.getProductIds()
      });
    }
    this.productSearchQuery = '';
    this.filteredProducts = [];
    this.showProductDropdown = false;
  }

  removeProduct(product: any): void {
    this.selectedProducts = this.selectedProducts.filter(p => p.id !== product.id);
    this.discountForm.patchValue({
      products: this.getProductIds()
    });
  }

  getProductIds(): string {
    return this.selectedProducts.map(p => p.id).join(',');
  }

  @HostListener('document:click', ['$event'])
  onClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.product-search-container')) {
      this.showProductDropdown = false;
    }
  }

  getBrandName(brandId: string): string {
    const brand = this.brands.find(b => b.id === brandId);
    return brand ? brand.name : '';
  }

  getCategoryName(categoryId: string): string {
    const category = this.categories.find(c => c.id === categoryId);
    return category ? category.name : '';
  }

  loadBrands(): void {
    this.brandsService.getBrands().subscribe(brands => {
      this.brands = brands;
    });
    this.categoriesService.getCategories().subscribe(categories => {
      this.categories = categories;
    });
  }

  getLocationName(locationId: string): string {
    const location = this.locations.find(l => l.id === locationId);
    return location ? location.name : '';
  }

  toggleForm(): void {
    this.showForm = !this.showForm;
    if (!this.showForm) {
      this.resetForm();
    }
  }

loadDiscounts(): void {
  this.discountSubscription = this.discountService.getDiscountsRealTime().subscribe((discounts) => {
    this.discounts = discounts.map(d => {
      // Standardize the ID field
      const id = d._id || d.id || d.docId || d.key;
      
      return {
        ...d,
        id: id, // Always populate the id field
        _originalDoc: d // Keep original reference
      };
    });
    this.applySearch();
  });
}

  updatePagination(): void {
    this.totalEntries = this.filteredDiscounts.length;
    this.totalPages = Math.ceil(this.totalEntries / this.entriesPerPage);
    
    if (this.currentPage > this.totalPages && this.totalPages > 0) {
      this.currentPage = this.totalPages;
    } else if (this.currentPage < 1) {
      this.currentPage = 1;
    }
    
    this.applyPagination();
  }

  applyPagination(): void {
    const startIndex = (this.currentPage - 1) * this.entriesPerPage;
    const endIndex = Math.min(startIndex + this.entriesPerPage, this.totalEntries);

    this.displayedDiscounts = this.filteredDiscounts.slice(startIndex, endIndex);
    this.startEntry = this.totalEntries > 0 ? startIndex + 1 : 0;
    this.endEntry = endIndex;
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.applyPagination();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.applyPagination();
    }
  }

  sortBy(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    
    this.applySorting();
  }

  applySorting(): void {
    if (!this.sortColumn) {
      return;
    }

    this.filteredDiscounts.sort((a, b) => {
      let aValue, bValue;
      
      switch(this.sortColumn) {
        case 'brand':
          aValue = this.getBrandName(a.brand);
          bValue = this.getBrandName(b.brand);
          break;
        case 'category':
          aValue = this.getCategoryName(a.category);
          bValue = this.getCategoryName(b.category);
          break;
        case 'location':
          aValue = this.getLocationName(a.location);
          bValue = this.getLocationName(b.location);
          break;
        default:
          aValue = a[this.sortColumn];
          bValue = b[this.sortColumn];
      }
      
      if (aValue === null || aValue === undefined) aValue = '';
      if (bValue === null || bValue === undefined) bValue = '';

      if (typeof aValue === 'string') aValue = aValue.toLowerCase();
      if (typeof bValue === 'string') bValue = bValue.toLowerCase();
      
      if (this.sortColumn === 'startsAt' || this.sortColumn === 'endsAt') {
        aValue = aValue ? new Date(aValue).getTime() : 0;
        bValue = bValue ? new Date(bValue).getTime() : 0;
      }
      
      if (this.sortColumn === 'priority' || this.sortColumn === 'discountAmount') {
        aValue = isNaN(parseFloat(aValue)) ? 0 : parseFloat(aValue);
        bValue = isNaN(parseFloat(bValue)) ? 0 : parseFloat(bValue);
      }
      
      if (this.sortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });
    
    this.applyPagination();
  }

  applySearch(): void {
    if (!this.searchQuery) {
      this.filteredDiscounts = [...this.discounts];
    } else {
      const query = this.searchQuery.toLowerCase();
      this.filteredDiscounts = this.discounts.filter(discount => {
        return (
          (discount.name && discount.name.toLowerCase().includes(query)) ||
          (this.getProductNames(discount.products) && 
            this.getProductNames(discount.products).toLowerCase().includes(query)) ||
          (this.getBrandName(discount.brand) &&
            this.getBrandName(discount.brand).toLowerCase().includes(query)) ||
          (this.getCategoryName(discount.category) &&
            this.getCategoryName(discount.category).toLowerCase().includes(query)) ||
          (this.getLocationName(discount.location) &&
            this.getLocationName(discount.location).toLowerCase().includes(query)) ||
          (discount.discountAmount &&
            discount.discountAmount.toString().toLowerCase().includes(query)) ||
          (discount.priority &&
            discount.priority.toString().toLowerCase().includes(query))
        );
      });
    }
    
    if (this.sortColumn) {
      this.applySorting();
    } else {
      this.updatePagination();
    }
  }

  selectAll(event: any): void {
    const checked = event.target.checked;
    this.displayedDiscounts = this.displayedDiscounts.map(d => ({ ...d, selected: checked }));
    this.filteredDiscounts = this.filteredDiscounts.map(d => {
      const displayedItem = this.displayedDiscounts.find(disp => disp.id === d.id);
      return displayedItem ? { ...d, selected: checked } : d;
    });
  }

  hasSelectedItems(): boolean {
    return this.filteredDiscounts.some(d => d.selected);
  }

  deactivateSelected(): void {
    const selectedIds = this.filteredDiscounts
      .filter(d => d.selected)
      .map(d => d.id);

    if (selectedIds.length === 0) return;

    if (confirm(`Are you sure you want to deactivate ${selectedIds.length} selected discounts?`)) {
      const deactivationPromises = selectedIds.map(id => {
        const discount = this.discounts.find(d => d.id === id);
        if (discount) {
          const updatedDiscount = { ...discount, isActive: false };
          return this.discountService.updateDiscount(id, updatedDiscount);
        }
        return Promise.resolve();
      });

      Promise.all(deactivationPromises)
        .then(() => {
          console.log(`Deactivated discounts: ${selectedIds.join(', ')}`);
        })
        .catch(error => console.error('Error deactivating discounts:', error));
    }
  }

  exportCSV(): void {
    const csvData = this.createCSVData();
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8' });
    saveAs(blob, 'discounts.csv');
  }

  exportExcel(): void {
    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(this.filteredDiscounts);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Discounts');
    XLSX.writeFile(wb, 'discounts.xlsx');
  }

  exportPDF(): void {
    const doc = new jsPDF();
    const headers = ['Name', 'Products', 'Brand', 'Category', 'Location', 'Discount Amount', 'Priority', 'Starts At', 'Ends At'];
    const data = this.createPDFData();
    
    (doc as any).autoTable({
      head: [headers],
      body: data,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      margin: { top: 20 }
    });
    
    doc.save('discounts.pdf');
  }
 
  printTable(): void {
    const printContent = document.getElementById('discount-table')?.outerHTML;
    if (printContent) {
      const windowContent = window.open('', '', 'height=700,width=800');
      if (windowContent) {
        windowContent.document.write('<html><head><title>Discount Table</title>');
        windowContent.document.write('<style>');
        windowContent.document.write('table { width: 100%; border-collapse: collapse; }');
        windowContent.document.write('th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }');
        windowContent.document.write('th { background-color: #f2f2f2; }');
        windowContent.document.write('</style>');
        windowContent.document.write('</head><body>');
        windowContent.document.write('<h1>Discount Table</h1>');
        windowContent.document.write(printContent);
        windowContent.document.write('</body></html>');
        windowContent.document.close();
        windowContent.print();
      }
    }
  }

  toggleColumnVisibility(): void {
    this.showColumnVisibility = !this.showColumnVisibility;
  }
  
  toggleColumnState(column: any): void {
    column.visible = !column.visible;
  }
  
  isColumnVisible(columnKey: string): boolean {
    const column = this.columns.find(col => col.key === columnKey);
    return column ? column.visible : true;
  }

  getVisibleColumnCount(): number {
    return this.columns.filter(col => col.visible).length + 1;
  }

  onSubmit(): void {
    if (this.discountForm.valid) {
      const discountData = { ...this.discountForm.value };
      discountData.products = this.getProductIds();
      
      if (discountData.id && !discountData.id.startsWith('temp_')) {
        this.discountService.updateDiscount(discountData.id, discountData)
          .then(() => {
            console.log('Discount updated successfully!');
            this.resetForm();
          })
          .catch(error => {
            console.error('Error updating discount:', error);
            alert('Failed to update discount. Please try again.');
          });
      } else {
        delete discountData.id; // Remove null or temp id for new discounts
        this.discountService.addDiscount(discountData)
          .then(() => {
            console.log('Discount added successfully!');
            this.resetForm();
          })
          .catch(error => {
            console.error('Error adding discount:', error);
            alert('Failed to add discount. Please try again.');
          });
      }
    } else {
      console.log('Form is invalid:', this.discountForm.errors);
      this.markFormGroupTouched();
    }
  }

  markFormGroupTouched(): void {
    Object.keys(this.discountForm.controls).forEach(key => {
      const control = this.discountForm.get(key);
      control?.markAsTouched();
    });
  }

  resetForm(): void {
    this.discountForm.reset({
      discountType: '',
      sellingPriceGroup: 'all',
      isActive: true
    });
    this.selectedProducts = [];
    this.productSearchQuery = '';
    this.showForm = false;
  }

  onCancel(): void {
    this.resetForm();
  }

  // Fixed edit method - properly load selected products
  async editDiscount(discount: any): Promise<void> {
    console.log('Editing discount:', discount);
    this.showForm = true;
    
    // Load selected products if they exist
    if (discount.products && this.allProducts.length > 0) {
      const productIds = discount.products.split(',').filter((id: string) => id.trim());
      this.selectedProducts = productIds.map((id: string) => {
        return this.allProducts.find(p => p.id === id.trim());
      }).filter((product: any) => product); // Remove undefined products
    } else {
      this.selectedProducts = [];
    }

    // Format dates for datetime-local inputs
    const formData = { ...discount };
    if (formData.startsAt) {
      const startDate = new Date(formData.startsAt);
      formData.startsAt = this.formatDateForInput(startDate);
    }
    if (formData.endsAt) {
      const endDate = new Date(formData.endsAt);
      formData.endsAt = this.formatDateForInput(endDate);
    }

    this.discountForm.patchValue(formData);
  }

  private formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

// In your component
deleteDiscount(discount: any): void {
  if (!discount?.id) {
    console.error('Cannot delete - no ID found:', discount);
    alert('This discount cannot be deleted - no valid ID found.');
    return;
  }

  if (confirm('Are you sure you want to delete this discount?')) {
    this.discountService.deleteDiscount(discount.id)
      .then(() => {
        // Remove from local array
        this.discounts = this.discounts.filter(d => d.id !== discount.id);
        this.applySearch();
      })
      .catch(error => {
        console.error('Delete failed:', error);
        alert('Delete failed. Please check console for details.');
      });
  }
}


  private createCSVData(): string {
    const headers = ['Name', 'Products', 'Brand', 'Category', 'Location', 'Discount Amount', 'Priority', 'Starts At', 'Ends At'];
    const rows = this.filteredDiscounts.map(d => [
      d.name, 
      this.getProductNames(d.products), 
      this.getBrandName(d.brand), 
      this.getCategoryName(d.category),
      this.getLocationName(d.location), 
      d.discountAmount, 
      d.priority, 
      d.startsAt, 
      d.endsAt
    ]);

    const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    return csv;
  }

  private createPDFData(): any[] {
    return this.filteredDiscounts.map(d => [
      d.name, 
      this.getProductNames(d.products), 
      this.getBrandName(d.brand), 
      this.getCategoryName(d.category),
      this.getLocationName(d.location), 
      d.discountAmount, 
      d.priority, 
      d.startsAt, 
      d.endsAt
    ]);
  }
}