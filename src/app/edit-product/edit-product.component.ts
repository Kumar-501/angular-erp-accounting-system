import { ProductsService } from '../services/products.service';
import { CategoriesService } from '../services/categories.service';
import { BrandsService } from '../services/brands.service';
import { UnitsService } from '../services/units.service';
import { TaxService } from '../services/tax.service';
import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';

// import { VariationsService } from '../services/variations.service';
import { FileUploadService } from '../services/file-upload.service';
import { Subscription } from 'rxjs';
import { Router, ActivatedRoute } from '@angular/router';
import { LocationService } from '../services/location.service';
import { UserService } from '../services/user.service';
import { Location } from '@angular/common';
import { StockService } from '../services/stock.service';

@Component({
  selector: 'app-edit-product',
  templateUrl: './edit-product.component.html',
  styleUrls: ['./edit-product.component.scss']
})
export class EditProductComponent implements OnInit, OnDestroy {
  showNotSellingDropdown = false;
  fileUploadError: string | null = null;
  imagePreviewUrl: string | null = null;
   @ViewChild('expiryDatePicker') expiryDatePicker!: ElementRef;
  @ViewChild('addedDatePicker') addedDatePicker!: ElementRef;

  onNotForSellingChange() {
    if (this.product.notForSelling) {
      if (!this.product.notSellingProducts) {
        this.product.notSellingProducts = [];
      }
      this.productFormSubmitted = false;
    } else {
      this.product.notSellingProducts = [];
      this.selectedNotSellingProducts = [];
    }
  }
  clearFileError() {
    this.fileUploadError = null;
  } hasFile(type: 'image' | 'brochure'): boolean {
    if (type === 'image') {
      return !!this.product.productImage;
    }
    if (type === 'brochure') {
      return !!this.product.productBrochure;
    }
    return false;
  }
    compareByID(item1: any, item2: any): boolean {
    return item1 && item2 ? (item1.id === item2.id || item1 === item2) : item1 === item2;
  }
getImagePreviewUrl(): string | null {
    // +++ START: Prioritize the new local preview URL +++
    if (this.imagePreviewUrl) {
      return this.imagePreviewUrl;
    }
    // +++ END: Prioritize the new local preview URL +++

    const image = this.product.productImage;
    if (!image) {
      return null;
    }

    if (typeof image === 'object' && image.data) {
      return image.data;
    }

    if (typeof image === 'string') {
      return image;
    }
    return null;
  }
  onAlertQuantityChange() {
    if (this.product.alertQuantity !== null && this.product.alertQuantity !== undefined) {
      if (this.product.alertQuantity < 0) {
        this.product.alertQuantity = 0;
      }
      this.product.alertQuantity = Number(this.product.alertQuantity);
    }
  }
 getFormattedDateForInput(dateString: string | null): string {
    if (!dateString) return '';
    // Handle potential ISO strings or Date objects
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  }

  openDatePicker(type: 'expiry' | 'added'): void {
    if (type === 'added' && this.isEditing) return; // Keep Added Date locked in Edit mode

    if (type === 'expiry') {
      this.expiryDatePicker.nativeElement.showPicker();
    } else {
      this.addedDatePicker.nativeElement.showPicker();
    }
  }
  private loadTaxRates() {
    this.taxRatesSubscription = this.taxService.getTaxRates().subscribe({
      next: (rates) => {
        this.taxRates = rates.filter(rate => !rate.forTaxGroupOnly).map(rate => ({
          ...rate,
          percentage: (rate.rate || 0)
        }));
        // Re-run tax setup once rates are available
        if (this.product && this.product.applicableTax) {
          this.setupTaxInformation();
        }
      }
    });
  }
    private setupTaxInformation() {
    if (!this.product.applicableTax || this.product.applicableTax === 'None') {
      this.product.applicableTax = 'None';
      this.product.taxPercentage = 0;
      return;
    }

    // Find the matching object from the loaded taxRates array
    const taxId = typeof this.product.applicableTax === 'object' 
                ? this.product.applicableTax.id 
                : this.product.applicableTax;

    const matchedTax = this.taxRates.find(t => t.id === taxId || t.name === taxId);
    
    if (matchedTax) {
      this.product.applicableTax = matchedTax;
      this.product.taxPercentage = matchedTax.percentage || matchedTax.rate || 0;
    }
  }
  onManualDateInput(event: any, type: 'expiry' | 'added'): void {
    if (type === 'added' && this.isEditing) return;

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
        
        // Convert to YYYY-MM-DD for the internal model
        const internalDate = `${year}-${month}-${day}`;
        if (type === 'expiry') {
          this.product.expiryDate = internalDate;
        } else {
          this.product.addedDate = internalDate;
        }
      } else {
        alert('Invalid date! Please enter a valid date in DD-MM-YYYY format.');
        const prevValue = type === 'expiry' ? this.product.expiryDate : this.product.addedDate;
        event.target.value = this.getFormattedDateForInput(prevValue);
      }
    }
  }

  // Ensure formatExpiryDate returns YYYY-MM-DD for the hidden picker's internal use
  formatExpiryDate(dateString: string): string {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      return date.toISOString().split('T')[0];
    } catch (e) {
      return '';
    }
  }

  filterNotSellingProducts() {
    const query = this.searchNotSellingProducts.trim();
    
    if (!query) {
      this.showNotSellingDropdown = false;
      this.filteredNotSellingProducts = [];
      return;
    }

    this.showNotSellingDropdown = true;
    
    const searchQuery = query.toLowerCase();
    this.filteredNotSellingProducts = this.getAvailableNotSellingProducts().filter(product =>
      product.productName.toLowerCase().includes(searchQuery) ||
      product.sku.toLowerCase().includes(searchQuery)
    );

    if (this.filteredNotSellingProducts.length === 0) {
      this.showNotSellingDropdown = false;
    }
  }

  onNotSellingQuantityChange(product: any) {
    if (product.selectedQuantity < 1) {
      product.selectedQuantity = 1;
    }
  }

  getAvailableNotSellingProducts(): any[] {
    if (!this.availableProducts) return [];

    const selectedProductIds = (this.product.notSellingProducts || []).map((item: any) => item.productId);

    if (this.product.productType === 'Combination') {
      return this.availableProducts.filter(product =>
        !selectedProductIds.includes(product.id) &&
        product.id !== this.product.id
      );
    }
    
    return this.availableProducts.filter(product =>
      !selectedProductIds.includes(product.id) &&
      product.id !== this.product.id &&
      product.notForSelling === true
    );
  }

  addNotSellingProduct(product: any) {
    if (!product || !product.selectedQuantity || product.selectedQuantity <= 0) return;

    if (!this.selectedNotSellingProducts) {
      this.selectedNotSellingProducts = [];
    }

    const existingIndex = this.selectedNotSellingProducts.findIndex(
      (item: any) => item.id === product.id
    );

    if (existingIndex === -1) {
      this.selectedNotSellingProducts.push({
        ...product,
        selectedQuantity: product.selectedQuantity
      });
    } else {
      this.selectedNotSellingProducts[existingIndex].selectedQuantity = product.selectedQuantity;
    }

    if (!this.product.notSellingProducts) {
      this.product.notSellingProducts = [];
    }
    this.product.notSellingProducts = this.selectedNotSellingProducts.map((p: { id: any; selectedQuantity: any; }) => ({
      productId: p.id,
      quantity: p.selectedQuantity
    }));

    this.searchNotSellingProducts = '';
    this.filterNotSellingProducts();
  }

  updateNotSellingQuantity(product: any) {
    if (product.selectedQuantity < 1) {
      product.selectedQuantity = 1;
    }

    this.product.notSellingProducts = this.selectedNotSellingProducts.map((p: { id: any; selectedQuantity: any; }) => ({
      productId: p.id,
      quantity: p.selectedQuantity
    }));
  }

  removeNotSellingProduct(index: number) {
    this.selectedNotSellingProducts.splice(index, 1);
    this.product.notSellingProducts = this.selectedNotSellingProducts.map((p: { id: any; selectedQuantity: any; }) => ({
      productId: p.id,
      quantity: p.selectedQuantity
    }));
  }

  getTotalNotSellingQuantity(): number {
    if (!this.selectedNotSellingProducts) return 0;
    return this.selectedNotSellingProducts.reduce((total: number, product: any) => {
      return total + (product.selectedQuantity || 0);
    }, 0);
  }

  filterAvailableComponents(): void {
    if (!this.componentSearchQuery) {
      this.filteredAvailableComponents = this.getAvailableProductsForComponents();
      return;
    }
    
    const query = this.componentSearchQuery.toLowerCase();
    this.filteredAvailableComponents = this.getAvailableProductsForComponents().filter(
      (product: { productName: string; sku: string; }) => product.productName.toLowerCase().includes(query) || 
                 product.sku.toLowerCase().includes(query)
    );
  }

  addComponentFromSearch(product: any): void {
    if (!product) return;
    
    const existingIndex = this.product.components.findIndex(
      (c: any) => c.productId === product.id
    );
    
    if (existingIndex === -1) {
      this.product.components.push({
        productId: product.id,
        quantity: 1,
        productName: product.productName,
        sku: product.sku,
        price: product.defaultPurchasePriceExcTax || 0
      });
    } else {
      this.product.components[existingIndex].quantity += 1;
    }
    
    this.componentSearchQuery = '';
    this.showComponentDropdown = false;
    this.filterAvailableComponents();
    
    this.calculateCombinationPrices();
  }

  getAvailableProductsForComponents(): any[] {
    const selectedIds = this.product.components.map((c: any) => c.productId);
    return this.availableProducts.filter(
      product => !selectedIds.includes(product.id) && 
                product.id !== this.product.id
    );
  }

  getComponentName(productId: string): string {
    if (!productId) return 'Please select a product';
    
    const product = this.availableProducts.find(p => p.id === productId);
    if (!product) {
      const component = this.product.components.find((c: any) => c.productId === productId);
      if (component && component.productName) {
        return component.productName;
      }
      return 'Product not found';
    }
    return product.productName;
  }

  validateComponentQuantity(component: any): void {
    if (component.quantity < 1) {
      component.quantity = 1;
    }
    this.calculateCombinationPrices();
  }

  onPurchasePriceExcTaxChange() {
    if (this.product.defaultPurchasePriceExcTax !== null && this.product.defaultPurchasePriceExcTax !== undefined) {
      const taxPercentage = this.getTaxPercentage();
      this.product.defaultPurchasePriceIncTax = this.roundToTwoDecimals(
        this.product.defaultPurchasePriceExcTax * (1 + taxPercentage / 100)
      );
    }
  }

  onPurchasePriceIncTaxChange() {
    if (this.product.defaultPurchasePriceIncTax !== null && this.product.defaultPurchasePriceIncTax !== undefined) {
      const taxPercentage = this.getTaxPercentage();
      this.product.defaultPurchasePriceExcTax = this.roundToTwoDecimals(
        this.product.defaultPurchasePriceIncTax / (1 + taxPercentage / 100)
      );
    }
  }

  onSellingPriceExcTaxChange() {
    if (this.product.defaultSellingPriceExcTax !== null && this.product.defaultSellingPriceExcTax !== undefined) {
      const taxPercentage = this.getTaxPercentage();
      this.product.defaultSellingPriceIncTax = this.roundToTwoDecimals(
        this.product.defaultSellingPriceExcTax * (1 + taxPercentage / 100)
      );
      
      this.updateMarginFromPrices();
    }
  }

  private updateMarginFromPrices() {
    if (this.product.defaultPurchasePriceExcTax && 
        this.product.defaultSellingPriceExcTax &&
        this.product.defaultPurchasePriceExcTax > 0) {
      
      const cost = parseFloat(this.product.defaultPurchasePriceExcTax);
      const sellingPrice = parseFloat(this.product.defaultSellingPriceExcTax);
      
      const calculatedMargin = ((sellingPrice - cost) / cost) * 100;
      this.product.marginPercentage = this.roundToTwoDecimals(calculatedMargin);
    }
  }

  onSellingPriceIncTaxChange() {
    if (this.product.defaultSellingPriceIncTax !== null && this.product.defaultSellingPriceIncTax !== undefined) {
      const taxPercentage = this.getTaxPercentage();
      this.product.defaultSellingPriceExcTax = this.roundToTwoDecimals(
        this.product.defaultSellingPriceIncTax / (1 + taxPercentage / 100)
      );
      
      this.updateMarginFromPrices();
    }
  }

  onMarginChange(margin: number) {
    margin = Number(margin);

    if (margin < 0) {
      throw new Error("Margin percentage must be positive");
    }

    this.margin = margin;
    this.calculateSellingPriceFromMargin();
  }

  product: any = this.getInitialProduct();
  users: any[] = [];
  selectedUser: any = null;
  availableProducts: any[] = [];
  // availableVariations: any[] = [];
  // selectedVariations: any[] = [];
  // variantCombinations: any[] = [];
  locations: any[] = [];
  productId: string = '';
  productFormSubmitted = false;
  margin: number = 0;

  categories: any[] = [];
  brands: any[] = [];
  units: any[] = [];
  subCategories: any[] = [];
  filteredSubCategories: any[] = [];
  products: any[] = [];
  taxRates: any[] = [];

  categoryTaxMapping: { [key: string]: string } = {
    'medicines': '10',
    'drugs': '12',
    'food': '5',
    'electronics': '18'
  };

  isGeneratingSku = false;
  isLoading = false;
  isEditing = true;

  // File upload properties
  isUploadingImage = false;
  isUploadingBrochure = false;
  uploadProgress = 0;

  private productsSubscription!: Subscription;
  private taxRatesSubscription!: Subscription;
  private variationsSubscription!: Subscription;
  private routeSubscription!: Subscription;
  searchNotSellingProducts: any;
  filteredNotSellingProducts: any;
  selectedNotSellingProducts: any;
  componentSearchQuery: any;
  showComponentDropdown: any;
  filteredAvailableComponents: any;

  constructor(
    private productsService: ProductsService,
    private categoriesService: CategoriesService,
    private brandsService: BrandsService,
    private unitsService: UnitsService,
    private taxService: TaxService,
    private userService: UserService,
    // private variationsService: VariationsService,
    private locationService: LocationService,
    private fileUploadService: FileUploadService, // Add FileUploadService
    private router: Router,
    private route: ActivatedRoute,
    private location: Location,
    private stockService: StockService
  ) {}

  ngOnInit() {
    this.loadInitialData();
    this.loadTaxRates();
    this.loadAvailableProducts();
    // this.loadVariations();
    this.getProductIdFromRoute();
  }

  ngOnDestroy() {
    this.productsSubscription?.unsubscribe();
    this.taxRatesSubscription?.unsubscribe();
    // this.variationsSubscription?.unsubscribe();
    this.routeSubscription?.unsubscribe();
  }

  private getProductIdFromRoute() {
    this.routeSubscription = this.route.params.subscribe(params => {
      this.productId = params['id'];
      if (this.productId) {
        this.loadProductData(this.productId);
      } else {
        this.router.navigate(['/products']);
      }
    });
  }

  private calculateSellingPriceFromMargin() {
    if (this.product.defaultPurchasePriceExcTax && 
        this.product.marginPercentage !== null && 
        this.product.marginPercentage !== undefined) {
      
      const cost = parseFloat(this.product.defaultPurchasePriceExcTax);
      const margin = parseFloat(this.product.marginPercentage);
      
      if (cost > 0) {
        const sellingPriceExcTax = cost * (1 + margin / 100);
        this.product.defaultSellingPriceExcTax = this.roundToTwoDecimals(sellingPriceExcTax);
        
        const taxPercentage = this.getTaxPercentage();
        this.product.defaultSellingPriceIncTax = this.roundToTwoDecimals(
          sellingPriceExcTax * (1 + taxPercentage / 100)
        );
      }
    }
  }

  calculateFromMRP() {
    const taxPercentage = this.getTaxPercentage();
    if (this.product.defaultSellingPriceIncTax !== null && this.product.defaultSellingPriceIncTax !== undefined) {
      this.product.defaultSellingPriceExcTax = 
        this.product.defaultSellingPriceIncTax / (1 + taxPercentage / 100);
      
      if (this.product.defaultPurchasePriceExcTax) {
        const cost = parseFloat(this.product.defaultPurchasePriceExcTax);
        const sellingPrice = parseFloat(this.product.defaultSellingPriceExcTax);
        this.product.marginPercentage = this.roundToTwoDecimals(((sellingPrice - cost) / cost) * 100);
      }
      
      this.product.defaultSellingPriceExcTax = this.roundToTwoDecimals(this.product.defaultSellingPriceExcTax);
      this.product.defaultSellingPriceIncTax = this.roundToTwoDecimals(this.product.defaultSellingPriceIncTax);
    }
  }

  private roundToTwoDecimals(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private roundToWholeNumber(value: number): number {
    return Math.round(value);
  }

  private setupEditMode() {
    console.log('Setting up edit mode with product:', this.product);
    
    if (this.product.alertQuantity !== null && this.product.alertQuantity !== undefined) {
      this.product.alertQuantity = Number(this.product.alertQuantity);
    }
    
    this.setupTaxInformation();

    if (this.product.addedBy) {
      this.selectedUser = this.users.find(user => user.id === this.product.addedBy);
    }

    if (this.product.category) {
      this.filterSubCategories();
    }
    
    if (this.product.expiryDate) {
      this.product.expiryDate = this.formatExpiryDate(this.product.expiryDate);
    }
    
    // if (this.product.productType === 'Variant' && this.product.variations) {
    //   this.setupVariations();
    // }
    
    if (this.product.productType === 'Single' && this.product.notSellingProducts) {
      this.initializeSelectedNotSellingProducts();
    }
    
    this.isLoading = false;
  }



  private initializeSelectedNotSellingProducts() {
    if (this.product.notSellingProducts && this.product.notSellingProducts.length > 0) {
      setTimeout(() => {
        this.selectedNotSellingProducts = this.product.notSellingProducts.map((item: any) => {
          const product = this.availableProducts.find(p => p.id === item.productId);
          if (product) {
            return {
              ...product,
              selectedQuantity: item.quantity
            };
          }
          return null;
        }).filter((item: any) => item !== null);

        this.filterNotSellingProducts();
      }, 1000);
    }
  }

  // private setupVariations() {
  //   if (this.product.variations && this.product.variations.length > 0) {
  //     const firstVariation = this.product.variations[0];
  //     if (firstVariation && firstVariation.values) {
  //       this.availableVariations.forEach(variation => {
  //         const hasValue = this.product.variations.some((v: any) => 
  //           v.values && v.values.some((val: string) => 
  //             variation.values.includes(val)
  //           )
  //         );
          
  //         if (hasValue) {
  //           const selectedValues = variation.values.filter((val: string) => 
  //             this.product.variations.some((v: any) => 
  //               v.values && v.values.includes(val)
  //           ));
            
  //           this.selectedVariations.push({
  //             id: variation.id,
  //             name: variation.name,
  //             values: selectedValues
  //           });
  //         }
  //       });
        
  //       this.variantCombinations = this.product.variations.map((v: any) => ({
  //         values: v.values,
  //         sku: v.sku,
  //         price: v.price,
  //         quantity: v.quantity
  //       }));
  //     }
  //   }
  // }

  private loadProductData(productId: string) {
    this.isLoading = true;
    this.productsService.getProductById(productId)
      .then((product: any) => {
        if (product) {
          this.product = { ...product };
          console.log('Loaded product data:', this.product);
          
          if (this.product.category) {
            this.filterSubCategories();
            
            setTimeout(() => {
              this.product.subCategory = product.subCategory;
            }, 300);
          }
          
          this.setupEditMode();
        } else {
          alert('Product not found');
          this.router.navigate(['/list-products']);
        }
        this.isLoading = false;
      })
      .catch((error: Error) => {
        console.error('Error loading product:', error);
        alert('Error loading product data');
        this.isLoading = false;
      });
  }
  
  private getInitialProduct() {
    return {
      productName: '',
      sku: '',
      location: '',
      hsnCode: '',
      barcodeType: 'Code 128 (C128)',
      unit: '',
      addedBy: '',
      expiryDate: null,
      applicableTax: 'None',
      taxPercentage: 0,
      addedByName: '',
      brand: '',
      category: '',
      subCategory: '',
      manageStock: true,
      alertQuantity: null,
      productDescription: '',
      productImage: null,
      productBrochure: null,
      enableProductDescription: false,
      notForSelling: false,
      notSellingProducts: [],
      weight: null,
      preparationTime: null,
      sellingPriceTaxType: 'Exclusive',
      productType: 'Single',
      defaultPurchasePriceExcTax: null,
      defaultPurchasePriceIncTax: null,
      marginPercentage: 0,
      defaultSellingPriceExcTax: null,
      defaultSellingPriceIncTax: null,
      components: [],
      variations: [],
      defineProduct: 'Regular'
    };
  }



  private loadAvailableProducts(): void {
    this.productsService.getProductsRealTime().subscribe({
      next: (products) => {
        this.availableProducts = products;
        console.log('Loaded available products:', this.availableProducts.length);
        
        if (this.product.productType === 'Single' && this.product.notSellingProducts) {
          this.initializeSelectedNotSellingProducts();
        }
      },
      error: (err) => {
        console.error('Failed to fetch products:', err);
      }
    });
  }



  isExpired(dateString: string): boolean {
    if (!dateString) return false;
    try {
      const expiry = new Date(dateString);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return expiry < today;
    } catch (e) {
      return false;
    }
  }

  isExpiringSoon(dateString: string): boolean {
    if (!dateString) return false;
    try {
      const expiry = new Date(dateString);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const oneMonthFromNow = new Date();
      oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
      oneMonthFromNow.setHours(0, 0, 0, 0);
      
      return expiry >= today && expiry <= oneMonthFromNow;
    } catch (e) {
      return false;
    }
  }

  private async loadInitialData() {
    try {
      this.isLoading = true;
      await Promise.all([
        this.loadCategories(),
        this.loadBrands(),
        this.loadUsers(),
        this.loadLocations(),
        this.loadUnits(),
        this.loadSubCategories(),
      ]);
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      this.isLoading = false;
    }
  }

  // private loadVariations() {
  //   this.variationsSubscription = this.variationsService.getVariations().subscribe({
  //     next: (variations) => {
  //       this.availableVariations = variations;
  //     },
  //     error: (err) => {
  //       console.error('Failed to fetch variations:', err);
  //     }
  //   });
  // }

  addComponent() {
    this.product.components.push({
      productId: '',
      quantity: 1
    });
  }

  private loadCategories(): Promise<void> {
    return new Promise((resolve) => {
      this.categoriesService.categories$.subscribe({
        next: (categories) => {
          this.categories = categories;
          resolve();
        },
        error: (error) => {
          console.error('Error loading categories:', error);
          resolve();
        }
      });
    });
  }

  private loadLocations(): Promise<void> {
    return new Promise((resolve) => {
      this.locationService.getLocations().subscribe({
        next: (locations) => {
          this.locations = locations.filter((loc: any) => loc.active !== false);
          resolve();
        },
        error: (error) => {
          console.error('Error loading locations:', error);
          resolve();
        }
      });
    });
  }

  private loadUsers(): Promise<void> {
    return new Promise((resolve) => {
      this.userService.getUsers().subscribe({
        next: (users) => {
          this.users = users;
          resolve();
        },
        error: (error) => {
          console.error('Error loading users:', error);
          resolve();
        }
      });
    });
  }

  onUserSelect(user: any) {
    this.selectedUser = user;
    this.product.addedBy = user.id;
    this.product.addedByName = user.name || user.email;
  }

  private loadBrands(): Promise<void> {
    return new Promise((resolve) => {
      this.brandsService.brands$.subscribe({
        next: (brands) => {
          this.brands = brands;
          resolve();
        },
        error: (error) => {
          console.error('Error loading brands:', error);
          resolve();
        }
      });
    });
  }

  private loadUnits(): Promise<void> {
    return new Promise((resolve) => {
      this.unitsService.units$.subscribe({
        next: (units) => {
          this.units = units;
          resolve();
        },
        error: (error) => {
          console.error('Error loading units:', error);
          resolve();
        }
      });
    });
  }

  private loadSubCategories(): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        this.subCategories = [];
        resolve();
      }, 500);
    });
  }

  navigateToUnitsPage() {
    this.router.navigate(['/units']);
  }

  navigateToBrandsPage() {
    this.router.navigate(['/brands']);
  }

  onCategoryChange() {
    this.filterSubCategories();

    const categoryName = this.product.category.toLowerCase();
    if (this.categoryTaxMapping[categoryName]) {
      this.setTaxBasedOnCategory(categoryName);
    }
  }

  private setTaxBasedOnCategory(categoryName: string) {
    const taxPercentage = this.categoryTaxMapping[categoryName];
    if (taxPercentage) {
      const matchingTax = this.taxRates.find(tax => tax.percentage == taxPercentage);

      if (matchingTax) {
        this.product.applicableTax = matchingTax;
        this.product.taxPercentage = matchingTax.percentage;
      } else {
        this.product.applicableTax = {
          name: `${categoryName.charAt(0).toUpperCase() + categoryName.slice(1)} GST`,
          percentage: Number(taxPercentage)
        };
        this.product.taxPercentage = Number(taxPercentage);
      }

      this.calculateAllPrices();
    }
  }

  private filterSubCategories() {
    if (this.product.category) {
      this.filteredSubCategories = this.subCategories.filter(
        sub => sub.category === this.product.category
      );
    } else {
      this.filteredSubCategories = [];
    }
    this.product.subCategory = '';
  }

  private generateSkuFromProductName(productName: string): string {
    if (!productName || productName.trim().length === 0) return '';
    let cleanName = productName.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    let prefix = cleanName.substring(0, 3).padEnd(3, 'X');

    if (productName.toLowerCase().includes('ipa chair')) {
      return 'C12036';
    }

    const timestamp = Date.now().toString().slice(-3);
    const randomNum = Math.floor(100 + Math.random() * 900);

    return `${(prefix + timestamp + randomNum).substring(0, 6)}`;
  }

  onProductNameChange() {
    if (this.product.productName && !this.product.sku) {
      this.isGeneratingSku = true;
      setTimeout(() => {
        this.product.sku = this.generateSkuFromProductName(this.product.productName);
        this.isGeneratingSku = false;
      }, 300);
    }
  }

  onProductTypeChange() {
    if (this.product.productType === 'Combination') {
      if (!this.product.components || this.product.components.length === 0) {
        this.product.components = [];
        this.addComponent();
      }
      this.calculateCombinationPrices();
    } 
    // else if (this.product.productType === 'Variant') {
    //   if (!this.selectedVariations) {
    //     this.selectedVariations = [];
    //   }
    //   this.generateVariantCombinations();
    // }
    
    this.calculateAllPrices();
  }

  removeComponent(index: number) {
    this.product.components.splice(index, 1);
    this.calculateCombinationPrices();
  }

  onComponentProductChange(index: number) {
    this.calculateCombinationPrices();
  }

  getComponentProduct(index: number): any {
    const component = this.product.components[index];
    if (!component || !component.productId) return null;
    return this.availableProducts.find(p => p.id === component.productId);
  }

  calculateCombinationCost(): number {
    return this.product.components.reduce((total: number, component: any) => {
      const product = this.getComponentProduct(this.product.components.indexOf(component));
      if (product && product.defaultPurchasePriceExcTax) {
        return total + (product.defaultPurchasePriceExcTax * component.quantity);
      }
      return total;
    }, 0);
  }

  calculateRecommendedPrice(): number {
    const cost = this.calculateCombinationCost();
    return cost * (1 + (this.product.marginPercentage / 100));
  }

  calculateCombinationPrices() {
    const cost = this.calculateCombinationCost();
    this.product.defaultPurchasePriceExcTax = cost;
    this.product.defaultPurchasePriceIncTax = cost * (1 + (this.product.taxPercentage / 100));
    this.product.defaultSellingPriceExcTax = this.calculateRecommendedPrice();
    this.product.defaultSellingPriceIncTax = this.product.defaultSellingPriceExcTax * (1 + (this.product.taxPercentage / 100));
  }

  // isVariationSelected(variationId: string): boolean {
  //   return this.selectedVariations.some(v => v.id === variationId);
  // }

  // toggleVariationSelection(variation: any) {
  //   const index = this.selectedVariations.findIndex(v => v.id === variation.id);
  //   if (index >= 0) {
  //     this.selectedVariations.splice(index, 1);
  //   } else {
  //     this.selectedVariations.push({
  //       id: variation.id,
  //       name: variation.name,
  //       values: []
  //     });
  //   }
  //   this.generateVariantCombinations();
  // }

  // isValueSelected(variationId: string, value: string): boolean {
  //   const variation = this.selectedVariations.find(v => v.id === variationId);
  //   return variation ? variation.values.includes(value) : false;
  // }

  // toggleValueSelection(variationId: string, value: string) {
  //   const variation = this.selectedVariations.find(v => v.id === variationId);
  //   if (variation) {
  //     const valueIndex = variation.values.indexOf(value);
  //     if (valueIndex >= 0) {
  //       variation.values.splice(valueIndex, 1);
  //     } else {
  //       variation.values.push(value);
  //     }
  //     this.generateVariantCombinations();
  //   }
  // }

  // generateVariantCombinations() {
  //   if (this.selectedVariations.length === 0) {
  //     this.variantCombinations = [];
  //     return;
  //   }

  //   const combinations = this.getCombinations(this.selectedVariations);
    
  //   const newCombinations = combinations.map(comb => {
  //     const existing = this.variantCombinations.find(vc => 
  //       this.arraysEqual(vc.values, comb.values)
  //     );
      
  //     return existing || {
  //       values: comb.values,
  //       sku: this.generateVariantSku(comb.values),
  //       price: this.product.defaultSellingPriceExcTax || 0,
  //       quantity: 0
  //     };
  //   });

  //   this.variantCombinations = newCombinations;
  // }

  getCombinations(variations: any[]): any[] {
    if (variations.length === 0) return [];
    if (variations.length === 1) {
      return variations[0].values.map((value: string) => ({
        values: [value]
      }));
    }
    
    const first = variations[0];
    const rest = this.getCombinations(variations.slice(1));
    
    const result: any[] = [];
    first.values.forEach((value: string) => {
      rest.forEach((r) => {
        result.push({
          values: [value, ...r.values]
        });
      });
    });
    
    return result;
  }

  generateVariantSku(values: string[]): string {
    const baseSku = this.product.sku || 'VAR';
    const variantCode = values.map(v => v.substring(0, 3).toUpperCase()).join('-');
    return `${baseSku}-${variantCode}`;
  }

  arraysEqual(a1: any[], a2: any[]): boolean {
    return a1.length === a2.length && a1.every((v, i) => v === a2[i]);
  }

  onTaxChange() {
    console.log('Tax changed:', this.product.applicableTax);
    
    this.product.taxPercentage = 0;
    
    if (this.product.applicableTax && this.product.applicableTax !== 'None') {
      let taxPercentage = 0;
      
      if (typeof this.product.applicableTax === 'object') {
        if (this.product.applicableTax.percentage !== undefined) {
          taxPercentage = parseFloat(this.product.applicableTax.percentage);
        }
        else if (this.product.applicableTax.rate !== undefined) {
          taxPercentage = parseFloat(this.product.applicableTax.rate);
        }
      } else if (typeof this.product.applicableTax === 'string') {
        const selectedTax = this.taxRates.find(tax =>
          tax.id === this.product.applicableTax || 
          tax.name === this.product.applicableTax
        );
        
        if (selectedTax) {
          taxPercentage = parseFloat(selectedTax.percentage || selectedTax.rate || 0);
        }
      }
      
      this.product.taxPercentage = taxPercentage;
      console.log('Set tax percentage to:', taxPercentage);
    }

    this.calculateAllPrices();
  }

  private getTaxPercentage(): number {
    return this.product.taxPercentage || 0;
  }

  calculateTaxAmount(): number {
    if (!this.product.sellingPriceTaxType) return 0;
    
    const taxPercentage = this.getTaxPercentage();
    if (!taxPercentage) return 0;

    if (this.product.sellingPriceTaxType === 'Inclusive' && this.product.defaultSellingPriceIncTax) {
      return this.product.defaultSellingPriceIncTax -
        (this.product.defaultSellingPriceIncTax / (1 + taxPercentage / 100));
    } else if (this.product.defaultSellingPriceExcTax) {
      return this.product.defaultSellingPriceExcTax * (taxPercentage / 100);
    }

    return 0;
  }

  calculateTax() {
    this.calculateAllPrices();
  }

  calculateSellingPrice() {
    const { defaultPurchasePriceExcTax, marginPercentage } = this.product;
    if (defaultPurchasePriceExcTax && marginPercentage !== null) {
      this.product.defaultSellingPriceExcTax =
        parseFloat(defaultPurchasePriceExcTax) * (1 + marginPercentage / 100);

      this.calculateSellingPriceIncTax();
    }
  }

  calculatePurchasePriceExcTax() {
    const taxPercentage = this.getTaxPercentage();
    if (this.product.defaultPurchasePriceIncTax !== null) {
      this.product.defaultPurchasePriceExcTax =
        this.product.defaultPurchasePriceIncTax / (1 + taxPercentage / 100);

      this.calculateSellingPrice();
    }
  }

  calculatePurchasePriceIncTax() {
    const taxPercentage = this.getTaxPercentage();
    if (this.product.defaultPurchasePriceExcTax !== null) {
      this.product.defaultPurchasePriceIncTax =
        parseFloat(this.product.defaultPurchasePriceExcTax) * (1 + taxPercentage / 100);
    }
  }

  calculateSellingPriceIncTax() {
    const taxPercentage = this.getTaxPercentage();
    if (this.product.defaultSellingPriceExcTax !== null) {
      this.product.defaultSellingPriceIncTax =
        parseFloat(this.product.defaultSellingPriceExcTax) * (1 + taxPercentage / 100);
    }
  }

  calculateAllPrices() {
    this.calculatePurchasePriceIncTax();
    this.calculateSellingPrice();
    this.calculateSellingPriceIncTax();
  }

  // Enhanced file selection method with proper error handling
  async onFileSelected(event: Event, type: 'image' | 'brochure') {
    const input = event.target as HTMLInputElement;
    if (!input?.files || input.files.length === 0) {
      return;
    }

    const file = input.files[0];
    this.clearFileError(); // Clear any previous errors

    // --- Logic for Instant Image Preview ---
    if (type === 'image') {
      // Use FileReader to read the file locally for preview
      const reader = new FileReader();
      reader.onload = () => {
        // Set the result to our preview URL property
        this.imagePreviewUrl = reader.result as string;
      };
      reader.readAsDataURL(file); // This triggers the onload event when done
    }
    // --- End of Preview Logic ---

    try {
      // Validate file size (5MB limit)
      if (!this.fileUploadService.validateFileSize(file, 5)) {
        this.fileUploadError = 'File size exceeds 5MB. Please choose a smaller file.';
        input.value = ''; // Clear the input
        return;
      }

      // Validate file type based on type
      let allowedTypes: string[] = [];
      if (type === 'image') {
        allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
      } else if (type === 'brochure') {
        allowedTypes = [
          'application/pdf', 'text/csv', 'application/zip', 'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'image/jpeg', 'image/jpg', 'image/png'
        ];
      }

      if (!this.fileUploadService.validateFileType(file, allowedTypes)) {
        const typeMessage = type === 'image'
          ? 'Please select a valid image file (JPEG, JPG, PNG).'
          : 'Please select a valid file (PDF, CSV, ZIP, DOC, DOCX, etc.).';
        this.fileUploadError = typeMessage;
        input.value = ''; // Clear the input
        return;
      }

      // Show loading state
      if (type === 'image') this.isUploadingImage = true;
      else this.isUploadingBrochure = true;

      // Convert file to base64 for storage and submission
      const base64String = await this.fileUploadService.convertFileToBase64(file);

      // Store the processed file data in the product object
      const fileData = {
        name: file.name,
        size: file.size,
        type: file.type,
        data: base64String, // The base64 data will be saved
        lastModified: file.lastModified
      };

      if (type === 'image') {
        this.product.productImage = fileData;
        this.isUploadingImage = false;
      } else {
        this.product.productBrochure = fileData;
        this.isUploadingBrochure = false;
      }

    } catch (error) {
      console.error(`Error processing ${type} file:`, error);
      this.fileUploadError = `Error processing ${type} file. Please try again.`;
      if (type === 'image') this.isUploadingImage = false;
      else this.isUploadingBrochure = false;
      input.value = '';
    }
  }
  // Method to remove uploaded files
 removeUploadedFile(type: 'image' | 'brochure') {
    if (type === 'image') {
      this.product.productImage = null;
      this.imagePreviewUrl = null; // +++ ADD THIS LINE to clear the preview
    } else {
      this.product.productBrochure = null;
    }
  }

  // Method to get file display name
  getFileDisplayName(type: 'image' | 'brochure'): string {
    const fileData = type === 'image' ? this.product.productImage : this.product.productBrochure;
    if (!fileData) return '';
    
    if (typeof fileData === 'string') {
      return fileData; // Legacy string filename
    }
    
    return fileData.name || 'Unknown file';
  }

  // Method to get file size display
  getFileSize(type: 'image' | 'brochure'): string {
    const fileData = type === 'image' ? this.product.productImage : this.product.productBrochure;
    if (!fileData || typeof fileData === 'string') return '';
    
    return fileData.size ? this.fileUploadService.formatFileSize(fileData.size) : '';
  }

  async updateProduct() {
    try {
      this.isLoading = true;
      this.productFormSubmitted = true;

      // Basic validation - only check required fields that must be present
      if (!this.product.productName || !this.product.unit || !this.product.barcodeType || 
          !this.product.productType) {
        this.isLoading = false;
        return;
      }

      // Ensure alertQuantity is properly converted to number
      if (this.product.alertQuantity !== null && this.product.alertQuantity !== undefined) {
        this.product.alertQuantity = Number(this.product.alertQuantity);
      }

      // Ensure taxPercentage is properly set
      if (this.product.applicableTax === 'None') {
        this.product.taxPercentage = 0;
      } else if (this.product.applicableTax && typeof this.product.applicableTax === 'object') {
        this.product.taxPercentage = this.product.applicableTax.percentage || this.product.applicableTax.rate || 0;
      }

      // Prepare the product data for update
      const productData = {
        ...this.product,
        taxPercentage: this.product.taxPercentage || 0,
        currentStock: this.product.manageStock ? (this.product.currentStock || 0) : null,
        totalQuantity: this.product.manageStock ? (this.product.totalQuantity || 0) : null,
        
        // Handle file uploads properly - convert File objects to serializable format
        productImage: this.prepareFileForStorage(this.product.productImage),
        productBrochure: this.prepareFileForStorage(this.product.productBrochure)
      };

      // Handle notSellingProducts properly for Single product type
      if (this.product.productType === 'Single') {
        productData.notSellingProducts = (this.product.notSellingProducts || []).map((item: any) => ({
          productId: item.productId,
          quantity: item.quantity,
          productName: item.productName || this.getProductName(item.productId),
          sku: item.sku || this.getProductSku(item.productId)
        }));
      } else {
        productData.notSellingProducts = [];
      }

      // Remove any undefined fields
      Object.keys(productData).forEach(key => {
        if (productData[key] === undefined) {
          delete productData[key];
        }
      });

      console.log('Updating product with data (alertQuantity):', productData.alertQuantity);
      console.log('Updating product with data (applicableTax):', productData.applicableTax);

      // First update the product details
      await this.productsService.updateProduct(this.productId, productData);
      
      // If stock management is enabled, record the stock change
      if (this.product.manageStock) {
        const currentProduct = await this.productsService.getProductById(this.productId);
        const oldQuantity = currentProduct?.currentStock || 0;
        const newQuantity = this.product.currentStock || 0;
        const quantityDifference = newQuantity - oldQuantity;

        if (quantityDifference !== 0) {
          const action = quantityDifference > 0 ? 'add' : 'subtract';
          const absoluteQuantity = Math.abs(quantityDifference);
          
          await this.stockService.adjustProductStock(
            this.productId,
            absoluteQuantity,
            action,
            this.product.location || '',
            'Manual stock adjustment during product edit',
            this.product.addedBy || 'system'
          );
        }
      }

      alert('Product updated successfully!');
      this.router.navigate(['/list-products']);
    } catch (error) {
      console.error('Error updating product:', error);
      
      // Show more specific error messages
      let errorMessage = 'Failed to update product';
      if (error instanceof Error) {
        if (error.message.includes('invalid data')) {
          errorMessage = 'Invalid file data. Please re-upload your files and try again.';
        } else if (error.message.includes('file')) {
          errorMessage = 'File upload error. Please check your files and try again.';
        } else {
          errorMessage = error.message;
        }
      }
      
      alert(`Error: ${errorMessage}`);
    } finally {
      this.isLoading = false;
    }
  }

  // Helper method to prepare files for storage
  private prepareFileForStorage(fileData: any): any {
    if (!fileData) return null;
    
    // If it's already a processed file object with base64 data, return as is
    if (fileData && typeof fileData === 'object' && fileData.data) {
      return {
        name: fileData.name,
        size: fileData.size,
        type: fileData.type,
        data: fileData.data,
        lastModified: fileData.lastModified
      };
    }
    
    // If it's a string (legacy format), return as is
    if (typeof fileData === 'string') {
      return fileData;
    }
    
    // If it's a File object (which causes the error), we should not reach here
    // because onFileSelected should have converted it already
    if (fileData instanceof File) {
      console.warn('File object detected in prepareFileForStorage. This should have been converted to base64.');
      return null; // Return null to prevent the error
    }
    
    return fileData;
  }

  // Helper methods for not-selling products
  getProductName(productId: string): string {
    const product = this.availableProducts.find(p => p.id === productId);
    return product ? product.productName : 'Unknown Product';
  }

  getProductSku(productId: string): string {
    const product = this.availableProducts.find(p => p.id === productId);
    return product ? product.sku : 'Unknown SKU';
  }

  cancelEdit() {
    this.location.back();
  }

  async deleteProduct() {
    if (confirm('Are you sure you want to delete this product?')) {
      try {
        await this.productsService.deleteProduct(this.productId);
        alert('Product deleted successfully!');
        this.router.navigate(['/list-products']);
      } catch (error) {
        console.error('Error deleting product:', error);
        alert('Failed to delete product');
      }
    }
  }
}