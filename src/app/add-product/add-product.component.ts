import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { ProductsService } from '../services/products.service';
import { NewProductsService } from '../services/new-products.service';
import { CategoriesService } from '../services/categories.service';
import { BrandsService } from '../services/brands.service';
import { UnitsService } from '../services/units.service';
import { TaxService } from '../services/tax.service';
import { VariationsService } from '../services/variations.service';
import { FileUploadService } from '../services/file-upload.service';
import { Inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { SkuGeneratorService } from '../services/sku-generator.service';
import { Router, ActivatedRoute } from '@angular/router';
import { UserService } from '../services/user.service';
import { NgForm } from '@angular/forms';
import { HostListener } from '@angular/core';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-add-product',
  templateUrl: './add-product.component.html',
  styleUrls: ['./add-product.component.scss']
})
export class AddProductComponent implements OnInit, OnDestroy {
  @ViewChild('productForm') productForm!: NgForm;

  product: any = this.getInitialProduct();
  users: any[] = [];
  selectedUser: any = null;
  
  searchNotSellingProducts = '';
  filteredNotSellingProducts: any[] = [];
  selectedNotSellingProducts: any[] = [];
  searchQuery: string = '';
  availableProducts: any[] = [];
  availableVariations: any[] = [];
  selectedVariations: any[] = [];
  variantCombinations: any[] = [];
  searchNotSellingProductsQuery: string = '';
  showDropdown = false;
  
  allCategories: any[] = [];
  categories: any[] = [];
  productFormSubmitted: boolean = false;
  brands: any[] = [];
  units: any[] = [];
  selectedNotSellingProduct: any = null;
  subCategories: any[] = [];
  filteredSubCategories: any[] = [];
  products: any[] = [];
  taxRates: any[] = [];
  
  // File upload properties
  selectedImageFile: File | null = null;
  selectedBrochureFile: File | null = null;
  imagePreview: string | null = null;
  brochureInfo: any = null;
  isUploadingImage = false;
  isUploadingBrochure = false;

  categoryTaxMapping: { [key: string]: string } = {
    'medicines': '10',
    'drugs': '12',
    'food': '5',
    'electronics': '18'
  };

  isGeneratingSku = false;
  isLoading = false;
  isEditing = false;

  private subscriptions: Subscription[] = [];

  @HostListener('document:click', ['$event'])
  onClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const isInsideDropdown = target.closest('.searchable-multiselect');

    if (!isInsideDropdown) {
      this.showDropdown = false;
    }
  }

  constructor(
    private productsService: ProductsService,
    private newProductsService: NewProductsService,
    private categoriesService: CategoriesService,
    private brandsService: BrandsService,
    private skuGenerator: SkuGeneratorService,
    public authService: AuthService,
    private unitsService: UnitsService,
    private taxService: TaxService,
    private userService: UserService,
    private fileUploadService: FileUploadService,
    private router: Router,
    private route: ActivatedRoute,
    private variationsService: VariationsService
  ) { }

  ngOnInit() {
    this.subscriptions.push(
      this.route.queryParams.subscribe(params => {
        if (params['duplicate']) {
          try {
            const duplicatedProduct = JSON.parse(params['duplicate']);
            this.product = {
              ...this.getInitialProduct(),
              ...duplicatedProduct,
            };
            this.isEditing = false;
          } catch (e) {
            console.error('Error parsing duplicated product data:', e);
          }
        }
      })
    );

    this.loadInitialData();
    this.loadTaxRates();
    this.autofillCurrentUser();
    this.loadAvailableProducts();
    this.loadVariations();
    this.product.components = (this.product.components || []).filter((c: any) => c.productId);

    const navigation = this.router.getCurrentNavigation();
    const duplicatedProduct = navigation?.extras?.state?.['duplicateProduct'];

    if (duplicatedProduct) {
      this.product = {
        ...this.getInitialProduct(),
        ...duplicatedProduct
      };

      if (this.product.productType === 'Combination' && this.product.components) {
        this.product.components = [...this.product.components];
      }

      if (this.product.productType === 'Variant' && this.product.variations) {
        this.variantCombinations = [...this.product.variations];
        this.initializeSelectedVariationsFromCombinations();
      }

      this.isEditing = false;

      if (this.product.category) {
        setTimeout(() => this.filterSubCategories(), 500);
      }
    }
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private getInitialProduct() {
    return {
      productName: '',
      sku: '',
      hsnCode: '',
      barcodeType: 'Code 128 (C128)',
      unit: '',
      addedByDocId: '',
      expiryDate: null,
      addedByName: '',
      addedDate: new Date().toISOString().split('T')[0],
      brand: '',
      category: '',
      lastNumber: '',
      subCategory: '',
      productDescription: '',
      productImage: null,
      productImageBase64: null,
      productImageThumbnail: null,
      productBrochure: null,
      productBrochureBase64: null,
      enableProductDescription: false,
      notForSelling: false,
      notSellingProducts: [],
      weight: null,
      length: null,
      breadth: null,
      height: null,
      customField1: '',
      customField2: '',
      customField3: '',
      customField4: '',
      applicableTax: 'None',
      taxPercentage: 0,
      sellingPriceTaxType: 'Inclusive',
      productType: 'Single',
      defaultPurchasePriceExcTax: null,
      defaultPurchasePriceIncTax: null,
      defaultSellingPriceExcTax: null,
      defaultSellingPriceIncTax: null,
      components: [],
      variations: [],
      isActive: true,
      status: 'Active'
    };
  }

  // File upload methods
  async onFileSelected(event: Event, type: 'image' | 'brochure') {
    const input = event.target as HTMLInputElement;
    if (!input?.files || input.files.length === 0) return;

    const file = input.files[0];

    try {
      if (type === 'image') {
        await this.handleImageUpload(file);
      } else {
        await this.handleBrochureUpload(file);
      }
    } catch (error) {
      console.error(`Error uploading ${type}:`, error);
      alert(`Failed to upload ${type}. Please try again.`);
    }
  }

  private async handleImageUpload(file: File) {
    // Validate file
    const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!this.fileUploadService.validateFileType(file, allowedImageTypes)) {
      alert('Please select a valid image file (JPEG, PNG, GIF, WebP)');
      return;
    }

    if (!this.fileUploadService.validateFileSize(file, 5)) {
      alert('Image file size must be less than 5MB');
      return;
    }

    this.isUploadingImage = true;

    try {
      // Convert to base64
      const base64String = await this.fileUploadService.convertFileToBase64(file);
      
      // Generate thumbnail
      const thumbnail = await this.fileUploadService.generateImageThumbnail(file, 150, 150);

      // Store in product
      this.selectedImageFile = file;
      this.product.productImageBase64 = base64String;
      this.product.productImageThumbnail = thumbnail;
      this.product.productImage = {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified
      };
      this.imagePreview = base64String;

    } finally {
      this.isUploadingImage = false;
    }
  }

  private async handleBrochureUpload(file: File) {
    // Validate file
    const allowedBrochureTypes = [
      'application/pdf',
      'text/csv',
      'application/zip',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/jpg',
      'image/png'
    ];

    if (!this.fileUploadService.validateFileType(file, allowedBrochureTypes)) {
      alert('Please select a valid file type (.pdf, .csv, .zip, .doc, .docx, .jpeg, .jpg, .png)');
      return;
    }

    if (!this.fileUploadService.validateFileSize(file, 5)) {
      alert('File size must be less than 5MB');
      return;
    }

    this.isUploadingBrochure = true;

    try {
      // Convert to base64
      const base64String = await this.fileUploadService.convertFileToBase64(file);

      // Store in product
      this.selectedBrochureFile = file;
      this.product.productBrochureBase64 = base64String;
      this.product.productBrochure = {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified
      };

      this.brochureInfo = {
        name: file.name,
        size: this.fileUploadService.formatFileSize(file.size),
        type: file.type
      };

    } finally {
      this.isUploadingBrochure = false;
    }
  }

  removeImage() {
    this.selectedImageFile = null;
    this.product.productImageBase64 = null;
    this.product.productImageThumbnail = null;
    this.product.productImage = null;
    this.imagePreview = null;

    // Reset the file input
    const imageInput = document.getElementById('productImage') as HTMLInputElement;
    if (imageInput) {
      imageInput.value = '';
    }
  }

  removeBrochure() {
    this.selectedBrochureFile = null;
    this.product.productBrochureBase64 = null;
    this.product.productBrochure = null;
    this.brochureInfo = null;

    // Reset the file input
    const brochureInput = document.getElementById('productBrochure') as HTMLInputElement;
    if (brochureInput) {
      brochureInput.value = '';
    }
  }

  // All other existing methods remain the same...
  private autofillCurrentUser() {
    const currentUser = this.authService.currentUserValue;
    if (currentUser) {
      this.product.addedByDocId = currentUser.uid;
      this.product.addedByName = currentUser.displayName || currentUser.email;
      this.selectedUser = {
        id: currentUser.uid,
        name: currentUser.displayName,
        email: currentUser.email
      };
    }
  }

  filterNotSellingProducts() {
    if (!this.searchNotSellingProducts.trim()) {
      this.filteredNotSellingProducts = this.getAvailableNotSellingProducts();
      return;
    }

    const query = this.searchNotSellingProducts.toLowerCase().trim();
    this.filteredNotSellingProducts = this.getAvailableNotSellingProducts().filter(product =>
      product.productName.toLowerCase().includes(query) ||
      product.sku.toLowerCase().includes(query)
    );
  }

  onNotSellingQuantityChange(product: any) {
    if (product.selectedQuantity < 1) {
      product.selectedQuantity = 1;
    }
  }

  private initializeSelectedVariationsFromCombinations() {
    if (!this.variantCombinations.length) return;

    setTimeout(() => {
      const valuesByVariationIndex = new Map();

      this.variantCombinations.forEach(combo => {
        combo.values.forEach((value: string, index: number) => {
          if (!valuesByVariationIndex.has(index)) {
            valuesByVariationIndex.set(index, new Set());
          }
          valuesByVariationIndex.get(index).add(value);
        });
      });

      this.selectedVariations = Array.from(valuesByVariationIndex.keys()).map(index => {
        const variationValues = Array.from(valuesByVariationIndex.get(index));
        const matchingVariation = this.availableVariations.find(v =>
          variationValues.every(val => v.values.includes(val))
        );

        if (matchingVariation) {
          return {
            id: matchingVariation.id,
            name: matchingVariation.name,
            values: variationValues
          };
        }
        return null;
      }).filter(Boolean);
    }, 1000);
  }

  formatExpiryDate(dateString: string | null): string {
    if (!dateString) return 'No expiry date';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  private loadTaxRates() {
    const subscription = this.taxService.getTaxRates().subscribe({
      next: (rates) => {
        this.taxRates = rates.filter(rate => !rate.forTaxGroupOnly).map(rate => ({
          ...rate,
          percentage: (rate.rate || 0)
        }));
        console.log('Loaded tax rates:', this.taxRates);
      },
      error: (err) => {
        console.error('Failed to fetch tax rates:', err);
      }
    });
    this.subscriptions.push(subscription);
  }

  private loadAvailableProducts(): void {
    const subscription = this.productsService.getProductsRealTime().subscribe({
      next: (products) => {
        this.availableProducts = products;
        console.log('Loaded available products:', this.availableProducts.length);
      },
      error: (err) => {
        console.error('Failed to fetch products:', err);
      }
    });
    this.subscriptions.push(subscription);
  }

  private async loadInitialData() {
    try {
      this.isLoading = true;
      await Promise.all([
        this.loadCategories(),
        this.loadBrands(),
        this.loadUsers(),
        this.loadUnits(),
        this.loadSubCategories(),
      ]);
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      this.isLoading = false;
    }
  }

  addComponent() {
    if (!this.product.components) {
      this.product.components = [];
    }
    this.product.components.push({
      productId: '',
      quantity: 1
    });
  }


  calculateSellingPriceIncTax() {
    const taxPercentage = this.getTaxPercentage();
    if (this.product.defaultSellingPriceExcTax !== null && this.product.defaultSellingPriceExcTax !== undefined) {
      const calculatedPrice = parseFloat(this.product.defaultSellingPriceExcTax) * (1 + taxPercentage / 100);
      this.product.defaultSellingPriceIncTax = this.roundToTwoDecimals(calculatedPrice);
      
   
    }
  }

  // New method to handle margin changes
onMarginChange() {
  // Validate margin percentage input
  if (this.product.marginPercentage < 0) {
    this.product.marginPercentage = 0;
    return;
  }

  // Allow margins over 100% - no upper limit validation
  this.calculateSellingPriceFromMargin();
}
  // New method to calculate selling price from margin
  private calculateSellingPriceFromMargin() {
    if (this.product.defaultPurchasePriceExcTax && 
        this.product.marginPercentage !== null && 
        this.product.marginPercentage !== undefined) {
      
      const cost = parseFloat(this.product.defaultPurchasePriceExcTax);
      const margin = parseFloat(this.product.marginPercentage);
      
      if (cost > 0) {
        // Calculate selling price based on margin
        const sellingPriceExcTax = cost * (1 + margin / 100);
        this.product.defaultSellingPriceExcTax = this.roundToTwoDecimals(sellingPriceExcTax);
        
        // Calculate selling price including tax
        const taxPercentage = this.getTaxPercentage();
        this.product.defaultSellingPriceIncTax = this.roundToTwoDecimals(
          sellingPriceExcTax * (1 + taxPercentage / 100)
        );
      }
    }
  }

private updateMarginFromPrices() {
  if (this.product.defaultPurchasePriceExcTax && 
      this.product.defaultSellingPriceExcTax &&
      this.product.defaultPurchasePriceExcTax > 0) {
    
    const cost = parseFloat(this.product.defaultPurchasePriceExcTax);
    const sellingPrice = parseFloat(this.product.defaultSellingPriceExcTax);
    
    // Calculate margin without restrictions
    const calculatedMargin = ((sellingPrice - cost) / cost) * 100;
    this.product.marginPercentage = this.roundToTwoDecimals(calculatedMargin);
  }
}

  calculateTaxAmount(): number {
    const taxPercentage = this.getTaxPercentage();
    if (!taxPercentage || !this.product.defaultSellingPriceIncTax) return 0;

    const taxAmount = this.product.defaultSellingPriceIncTax -
      (this.product.defaultSellingPriceIncTax / (1 + taxPercentage / 100));

    return this.roundToTwoDecimals(taxAmount);
  }

  private roundToTwoDecimals(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private getTaxPercentage(): number {
    return this.product.taxPercentage || 0;
  }

  private loadCategories(): Promise<void> {
    return new Promise((resolve) => {
      const subscription = this.categoriesService.categories$.subscribe({
        next: (categories) => {
          this.categories = (categories || []).filter(cat => !cat.parentCategory);
          this.allCategories = categories || [];
          console.log('Loaded categories:', this.categories.length);
          resolve();
        },
        error: (error) => {
          console.error('Error loading categories:', error);
          resolve();
        }
      });
      this.subscriptions.push(subscription);
    });
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
    this.product.notSellingProducts = this.selectedNotSellingProducts.map(p => ({
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

    this.product.notSellingProducts = this.selectedNotSellingProducts.map(p => ({
      productId: p.id,
      quantity: p.selectedQuantity
    }));
  }

  removeNotSellingProduct(index: number) {
    this.selectedNotSellingProducts.splice(index, 1);
    this.product.notSellingProducts = this.selectedNotSellingProducts.map(p => ({
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

  getProductName(productId: string): string {
    const product = this.availableProducts.find(p => p.id === productId);
    return product ? product.productName : 'Unknown Product';
  }

  getProductSku(productId: string): string {
    const product = this.availableProducts.find(p => p.id === productId);
    return product ? product.sku : 'Unknown SKU';
  }

  getProductStock(productId: string): number {
    return 0;
  }

  validateNotSellingQuantity(index: number): void {
    const item = this.product.notSellingProducts[index];
    if (item.quantity < 1) {
      item.quantity = 1;
    }
  }

  private loadUsers(): Promise<void> {
    return new Promise((resolve) => {
      const subscription = this.userService.getUsers().subscribe({
        next: (users) => {
          this.users = users || [];
          console.log('Loaded users:', this.users.length);
          resolve();
        },
        error: (error) => {
          console.error('Error loading users:', error);
          resolve();
        }
      });
      this.subscriptions.push(subscription);
    });
  }

  onUserSelect(user: any) {
    if (!user) return;
    this.selectedUser = user;
    this.product.addedByDocId = user.id;
    this.product.addedByName = user.name || user.email;
  }

  private loadBrands(): Promise<void> {
    return new Promise((resolve) => {
      const subscription = this.brandsService.brands$.subscribe({
        next: (brands) => {
          this.brands = brands || [];
          console.log('Loaded brands:', this.brands.length);
          resolve();
        },
        error: (error) => {
          console.error('Error loading brands:', error);
          resolve();
        }
      });
      this.subscriptions.push(subscription);
    });
  }

  private loadVariations() {
    const subscription = this.variationsService.getVariations().subscribe({
      next: (variations) => {
        this.availableVariations = variations || [];
        console.log('Loaded variations:', this.availableVariations.length);
      },
      error: (err) => {
        console.error('Failed to fetch variations:', err);
      }
    });
    this.subscriptions.push(subscription);
  }

  private loadUnits(): Promise<void> {
    return new Promise((resolve) => {
      const subscription = this.unitsService.units$.subscribe({
        next: (units) => {
          this.units = units || [];
          console.log('Loaded units:', this.units.length);
          resolve();
        },
        error: (error) => {
          console.error('Error loading units:', error);
          resolve();
        }
      });
      this.subscriptions.push(subscription);
    });
  }

  private loadSubCategories(): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        this.subCategories = [];
        console.log('Loaded subcategories:', this.subCategories.length);
        resolve();
      }, 500);
    });
  }

  onCategoryChange() {
    this.filterSubCategories();

    if (this.product.category) {
      const category = this.allCategories.find(cat => cat.id === this.product.category);
      if (category) {
        const categoryName = category.name.toLowerCase();
        if (this.categoryTaxMapping[categoryName]) {
          this.setTaxBasedOnCategory(categoryName);
        }
      }
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

  navigateToUnitsPage() {
    this.router.navigate(['/units']);
  }

  navigateToBrandsPage() {
    this.router.navigate(['/brands']);
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

  private async generateNumericSku(): Promise<string> {
    try {
      this.isGeneratingSku = true;
      const lastSku = await this.productsService.getLastUsedSku();
      let nextNumber = 100001;

      if (lastSku) {
        const lastNumber = parseInt(lastSku, 10);
        if (!isNaN(lastNumber)) {
          nextNumber = lastNumber + 1;
        }
      }

      return nextNumber.toString();
    } finally {
      this.isGeneratingSku = false;
    }
  }

  async onProductNameChange() {
    if (this.product.productName && !this.product.sku) {
      this.isGeneratingSku = true;
      try {
        this.product.sku = await this.skuGenerator.getNextSku();
      } catch (error) {
        console.error('Error generating SKU:', error);
        this.product.sku = Date.now().toString().slice(-6);
      } finally {
        this.isGeneratingSku = false;
      }
    }
  }

  onProductTypeChange() {
    if (this.product.productType === 'Combination') {
      if (!this.product.components || this.product.components.length === 0) {
        this.product.components = [];
        this.addComponent();
      }
      this.calculateCombinationPrices();
      
      if (this.product.notForSelling && !this.product.notSellingProducts) {
        this.product.notSellingProducts = [];
      }
    } else if (this.product.productType === 'Variant') {
      if (!this.selectedVariations) {
        this.selectedVariations = [];
      }
      this.generateVariantCombinations();
    } else if (this.product.productType === 'Single') {
      if (this.product.notForSelling && !this.product.notSellingProducts) {
        this.product.notSellingProducts = [];
      }
    }
  }

  removeComponent(index: number) {
    this.product.components.splice(index, 1);
    this.calculateCombinationPrices();
  }

  onComponentProductChange(index: number) {
    const component = this.product.components[index];
    if (component.productId) {
      const product = this.getComponentProduct(index);
      if (product) {
        component.productName = product.productName;
        component.sku = product.sku;
        component.price = product.defaultPurchasePriceExcTax || 0;
      }
    }
    this.calculateCombinationPrices();
    this.calculateAllPrices();
  }

  getComponentProduct(index: number): any {
    const component = this.product.components[index];
    if (!component || !component.productId) return null;
    return this.availableProducts.find(p => p.id === component.productId);
  }

  calculateRecommendedPrice(): number {
    const cost = this.calculateCombinationPrices();
    const price = cost * (1 + (this.product.marginPercentage / 100));
    return Math.round(price);
  }
// Update the calculateCombinationPrices() method:
calculateCombinationPrices(): number {
  if (!this.product.components || this.product.components.length === 0) {
    this.product.defaultPurchasePriceExcTax = 0;
    this.product.defaultPurchasePriceIncTax = 0;
    return 0;
  }

  let totalCost = 0;

  this.product.components.forEach((component: any) => {
    const product = this.getComponentProduct(this.product.components.indexOf(component));
    if (product && product.defaultPurchasePriceExcTax) {
      const componentCost = product.defaultPurchasePriceExcTax * (component.quantity || 1);
      totalCost += componentCost;
    }
  });

  this.product.defaultPurchasePriceExcTax = this.roundToTwoDecimals(totalCost);

  const taxPercentage = this.getTaxPercentage();
  this.product.defaultPurchasePriceIncTax = this.roundToTwoDecimals(
    totalCost * (1 + taxPercentage / 100)
  );

  return this.roundToTwoDecimals(totalCost);
}

  isVariationSelected(variationId: string): boolean {
    return this.selectedVariations.some(v => v.id === variationId);
  }

  toggleVariationSelection(variation: any) {
    const index = this.selectedVariations.findIndex(v => v.id === variation.id);
    if (index >= 0) {
      this.selectedVariations.splice(index, 1);
    } else {
      this.selectedVariations.push({
        id: variation.id,
        name: variation.name,
        values: []
      });
    }
    this.generateVariantCombinations();
  }

  isValueSelected(variationId: string, value: string): boolean {
    const variation = this.selectedVariations.find(v => v.id === variationId);
    return variation ? variation.values.includes(value) : false;
  }

  toggleValueSelection(variationId: string, value: string) {
    const variation = this.selectedVariations.find(v => v.id === variationId);
    if (variation) {
      const valueIndex = variation.values.indexOf(value);
      if (valueIndex >= 0) {
        variation.values.splice(valueIndex, 1);
      } else {
        variation.values.push(value);
      }
      this.generateVariantCombinations();
    }
  }

  generateVariantCombinations() {
    if (!this.selectedVariations || this.selectedVariations.length === 0) {
      this.variantCombinations = [];
      return;
    }

    const activeVariations = this.selectedVariations.filter(v => v.values && v.values.length > 0);

    if (activeVariations.length === 0) {
      this.variantCombinations = [];
      return;
    }

    const combinations = this.getCombinations(activeVariations);

    const newCombinations = combinations.map(comb => {
      const existing = this.variantCombinations.find(vc =>
        this.arraysEqual(vc.values, comb.values)
      );

      return existing || {
        values: comb.values,
        sku: this.generateVariantSku(comb.values),
        price: Math.round(this.product.defaultSellingPriceExcTax || 0),
        quantity: 0
      };
    });

    this.variantCombinations = newCombinations;
  }

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
    const baseSku = this.product.sku || '100001';
    const variantCode = values.map(v => {
      return v.substring(0, 3).split('').map(c => c.charCodeAt(0)).join('');
    }).join('-');
    return `${baseSku}-${variantCode}`;
  }

  arraysEqual(a1: any[], a2: any[]): boolean {
    return a1.length === a2.length && a1.every((v, i) => v === a2[i]);
  }

  onTaxChange() {
    if (this.product.applicableTax && this.product.applicableTax !== 'None') {
      if (typeof this.product.applicableTax === 'object') {
        this.product.taxPercentage = this.product.applicableTax.percentage;
      } else {
        const selectedTax = this.taxRates.find(tax =>
          tax.id === this.product.applicableTax || tax.name === this.product.applicableTax
        );
        this.product.taxPercentage = selectedTax ? selectedTax.percentage : 0;
      }
    } else {
      this.product.taxPercentage = 0;
    }

    this.calculateAllPrices();
  }

  calculateTax() {
    this.calculateAllPrices();
  }

  calculateSellingPrice() {
    const { defaultPurchasePriceExcTax, marginPercentage } = this.product;
    if (defaultPurchasePriceExcTax && marginPercentage !== null) {
      const calculatedPrice = parseFloat(defaultPurchasePriceExcTax) * (1 + marginPercentage / 100);
      this.product.defaultSellingPriceExcTax = this.roundToTwoDecimals(calculatedPrice);
      this.calculateSellingPriceIncTax();
    }
  }

  calculatePurchasePriceExcTax() {
    const taxPercentage = this.getTaxPercentage();
    if (this.product.defaultPurchasePriceIncTax !== null) {
      this.product.defaultPurchasePriceExcTax =
        this.product.defaultPurchasePriceIncTax / (1 + taxPercentage / 100);
      this.updateMarginFromPrices();
    }
  }

  calculatePurchasePriceIncTax() {
    const taxPercentage = this.getTaxPercentage();
    if (this.product.defaultPurchasePriceExcTax !== null) {
      this.product.defaultPurchasePriceIncTax =
        parseFloat(this.product.defaultPurchasePriceExcTax) * (1 + taxPercentage / 100);
    }
  }

private calculateAllPrices() {
  const taxPercentage = this.getTaxPercentage();

  if (this.product.productType === 'Combination') {
    const cost = this.calculateCombinationPrices();

    if (!this.product.defaultSellingPriceIncTax) {
      const priceBeforeTax = cost;
      this.product.defaultSellingPriceExcTax = this.roundToTwoDecimals(priceBeforeTax);
      this.product.defaultSellingPriceIncTax = this.roundToTwoDecimals(
        priceBeforeTax * (1 + taxPercentage / 100)
      );
    } else {
    }
  } else {
    if (this.product.defaultSellingPriceIncTax) {
    }
  }
}

  async addProduct() {
    this.productFormSubmitted = true;

    if (!this.validateForm()) {
      this.isLoading = false;
      return;
    }

    try {
      this.isLoading = true;
      
      const productData = {
        ...this.product,
        productNameLower: this.product.productName.toLowerCase(),
        manageStock: undefined,
        totalQuantity: undefined,
        currentStock: undefined,
        alertQuantity: undefined,
        locationDocId: undefined,
        locationName: undefined,
        locationsDocIds: undefined,
        locationNames: undefined
      };

      if (productData.id) {
        delete productData.id;
      }

      const productId = await this.newProductsService.addProduct(productData);

      this.showSuccess('Product added successfully!');
      this.router.navigate(['/list-products']);

    } catch (error) {
      this.handleError(error);
    } finally {
      this.isLoading = false;
    }
  }

  async saveAndNavigate(event?: Event) {
    if (event) event.preventDefault();
    try {
      await this.addProduct();
      this.router.navigate(['/list-products']);
    } catch (error) {
      console.error('Error saving product:', error);
    }
  }

  private validateCombinationProduct() {
    this.product.components = (this.product.components || []).filter((c: { productId: any; }) => c.productId);
    if (this.product.components.length === 0) {
      throw new Error('Please add at least one component for combination products');
    }
  }

  private validateVariantProduct() {
    this.product.variations = this.variantCombinations.map(vc => ({
      values: vc.values,
      sku: vc.sku,
      price: vc.price,
      quantity: vc.quantity
    }));

    if (this.product.variations.length === 0) {
      throw new Error('Please select at least one variation for variant products');
    }
  }

  private showSuccess(message: string) {
    alert(message);
  }

  private handleError(error: unknown) {
    console.error('Error saving product:', error);

    let errorMessage = 'Failed to save product';

    if (error instanceof Error) {
      errorMessage = error.message;

      if (error.message.includes('Applicable Tax')) {
        errorMessage = 'Please select a valid tax option or choose "None" if no tax applies';
      } else if (error.message.includes('Firebase')) {
        if (error.message.includes('permission-denied')) {
          errorMessage = 'You do not have permission to perform this action';
        } else if (error.message.includes('network-request-failed')) {
          errorMessage = 'Network error. Please check your internet connection';
        }
      }
    } else if (typeof error === 'string') {
      errorMessage = error;
    }

    alert(`Error: ${errorMessage}`);
    this.isLoading = false;
  }

 validateForm(): boolean {
  this.productFormSubmitted = true;
  
  // Check if form is valid
  if (this.productForm && this.productForm.invalid) {
    // Scroll to first invalid field
    const firstInvalidElement = document.querySelector('.ng-invalid');
    if (firstInvalidElement) {
      firstInvalidElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return false;
  }

  // Additional custom validations
  let isValid = true;
  const requiredFields = [
    { field: 'productName', message: 'Product name is required' },
    { field: 'unit', message: 'Unit is required' },
    { field: 'barcodeType', message: 'Barcode type is required' },
    { field: 'productType', message: 'Product type is required' },
    { field: 'applicableTax', message: 'Applicable Tax is required' }
  ];

  if (!this.product.notForSelling) {
    requiredFields.push(
      { field: 'sellingPriceTaxType', message: 'Selling price tax type is required' }
    );
  }

  for (const { field, message } of requiredFields) {
    if (!this.product[field]) {
      isValid = false;
      // Don't break so we can highlight all missing fields
    }
  }

  // Product type specific validations
  switch (this.product.productType) {
    case 'Variant':
      if (!this.variantCombinations || this.variantCombinations.length === 0) {
        isValid = false;
      }
      break;

    case 'Combination':
      if (!this.product.components || this.product.components.length === 0) {
        isValid = false;
      }
      break;
  }

  if (!isValid) {
    // Scroll to first error
    const firstErrorElement = document.querySelector('.invalid');
    if (firstErrorElement) {
      firstErrorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  return isValid;
}

  onNotForSellingChange() {
    if (this.product.notForSelling) {
      if (!this.product.notSellingProducts) {
        this.product.notSellingProducts = [];
      }
      this.product.defaultSellingPriceExcTax = null;
      this.product.defaultSellingPriceIncTax = null;
      this.product.marginPercentage = 0;
    } else {
      this.product.notSellingProducts = [];
      this.selectedNotSellingProducts = [];
    }
  }

  formatDateForInput(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = ('0' + (date.getMonth() + 1)).slice(-2);
    const day = ('0' + date.getDate()).slice(-2);
    return `${year}-${month}-${day}`;
  }

  onDateChange(event: any) {
    const inputDate = event.target.value;
    if (inputDate) {
      this.product.addedDate = new Date(inputDate).toISOString();
    }
  }

  async saveAndAddAnother(event?: Event) {
    if (event) event.preventDefault();
    try {
      await this.addProduct();
      this.resetForm();
      setTimeout(() => {
        const firstInput = document.querySelector('input');
        (firstInput as HTMLInputElement)?.focus();
      }, 100);
    } catch (error) {
      console.error('Error in saveAndAddAnother:', error);
    }
  }

  editProduct(product: any) {
    this.product = { ...product };
    if (product.applicableTax && product.applicableTax !== 'None') {
      if (typeof product.applicableTax === 'object') {
        this.product.taxPercentage = product.applicableTax.percentage;
      } else {
        const selectedTax = this.taxRates.find(tax =>
          tax.id === product.applicableTax || tax.name === product.applicableTax
        );
        this.product.taxPercentage = selectedTax ? selectedTax.percentage : 0;
      }
    }
    this.isEditing = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async deleteProduct(productId: string) {
    if (confirm('Are you sure you want to delete this product?')) {
      try {
        await this.productsService.deleteProduct(productId);
        alert('Product deleted successfully!');
      } catch (error) {
        console.error('Error deleting product:', error);
        alert('Failed to delete product');
      }
    }
  }

  resetForm() {
    this.product = this.getInitialProduct();
    this.isEditing = false;
    this.filteredSubCategories = [];
    this.removeImage();
    this.removeBrochure();
  }
}