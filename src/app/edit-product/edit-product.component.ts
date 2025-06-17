import { Component, OnInit, OnDestroy } from '@angular/core';
import { ProductsService } from '../services/products.service';
import { CategoriesService } from '../services/categories.service';
import { BrandsService } from '../services/brands.service';
import { UnitsService } from '../services/units.service';
import { TaxService } from '../services/tax.service';
import { VariationsService } from '../services/variations.service';
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
  product: any = this.getInitialProduct();
  users: any[] = [];
  selectedUser: any = null;
  availableProducts: any[] = [];
  availableVariations: any[] = [];
  selectedVariations: any[] = [];
  variantCombinations: any[] = [];
  locations: any[] = [];
  productId: string = '';

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

  private productsSubscription!: Subscription;
  private taxRatesSubscription!: Subscription;
  private variationsSubscription!: Subscription;
  private routeSubscription!: Subscription;

  constructor(
    private productsService: ProductsService,
    private categoriesService: CategoriesService,
    private brandsService: BrandsService,
    private unitsService: UnitsService,
    private taxService: TaxService,
    private userService: UserService,
    private variationsService: VariationsService,
    private locationService: LocationService,
    private router: Router,
    private route: ActivatedRoute,
    private location: Location,
        private stockService: StockService // Properly typed as StockService

  ) {}

  ngOnInit() {
    this.loadInitialData();
    this.loadTaxRates();
    this.loadAvailableProducts();
    this.loadVariations();
    this.getProductIdFromRoute();
  }

  ngOnDestroy() {
    this.productsSubscription?.unsubscribe();
    this.taxRatesSubscription?.unsubscribe();
    this.variationsSubscription?.unsubscribe();
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



  private setupEditMode() {
    // Populate tax percentages
    if (this.product.applicableTax && this.product.applicableTax !== 'None') {
      if (typeof this.product.applicableTax === 'object') {
        this.product.taxPercentage = this.product.applicableTax.percentage;
      } else {
        const selectedTax = this.taxRates.find(tax =>
          tax.id === this.product.applicableTax || tax.name === this.product.applicableTax
        );
        this.product.taxPercentage = selectedTax ? selectedTax.percentage : 0;
      }
    }

    // Find and set the selected user
    if (this.product.addedBy) {
      this.selectedUser = this.users.find(user => user.id === this.product.addedBy);
    }

    // Setup sub-categories
    if (this.product.category) {
      this.filterSubCategories();
    }
 if (this.product.expiryDate) {
    this.product.expiryDate = this.formatExpiryDate(this.product.expiryDate);
  }
  
    // Setup variations if product type is Variant
    if (this.product.productType === 'Variant' && this.product.variations) {
      this.setupVariations();
    }
    
    this.isLoading = false;
  }

  private setupVariations() {
    // Extract selected variations from the product data
    if (this.product.variations && this.product.variations.length > 0) {
      // Get unique variations from product variations
      const firstVariation = this.product.variations[0];
      if (firstVariation && firstVariation.values) {
        // Reconstruct the selected variations from available variations
        this.availableVariations.forEach(variation => {
          const hasValue = this.product.variations.some((v: any) => 
            v.values && v.values.some((val: string) => 
              variation.values.includes(val)
            )
          );
          
          if (hasValue) {
            const selectedValues = variation.values.filter((val: string) => 
              this.product.variations.some((v: any) => 
                v.values && v.values.includes(val)
            ));
            
            this.selectedVariations.push({
              id: variation.id,
              name: variation.name,
              values: selectedValues
            });
          }
        });
        
        // Recreate the variant combinations
        this.variantCombinations = this.product.variations.map((v: any) => ({
          values: v.values,
          sku: v.sku,
          price: v.price,
          quantity: v.quantity
        }));
      }
    }
  }
  private loadProductData(productId: string) {
    this.isLoading = true;
    this.productsService.getProductById(productId)
      .then((product: any) => {
        if (product) {
          this.product = { ...product };
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
      weight: null,
      preparationTime: null,
      applicableTax: 'None',
      taxPercentage: 0,
      sellingPriceTaxType: 'Exclusive',
      productType: 'Single',
      defaultPurchasePriceExcTax: null,
      defaultPurchasePriceIncTax: null,
      marginPercentage: 25.0,
      defaultSellingPriceExcTax: null,
      defaultSellingPriceIncTax: null,
      components: [],
      variations: [],
      defineProduct: 'Regular'
    };
  }

  private loadTaxRates() {
    this.taxRatesSubscription = this.taxService.getTaxRates().subscribe({
      next: (rates) => {
        this.taxRates = rates.filter(rate => !rate.forTaxGroupOnly);
      },
      error: (err) => {
        console.error('Failed to fetch tax rates:', err);
      }
    });
  }

  private loadAvailableProducts(): void {
    this.productsService.getProductsRealTime().subscribe({
      next: (products) => {
        this.availableProducts = products;
      },
      error: (err) => {
        console.error('Failed to fetch products:', err);
      }
    });
  }
// Add these methods to your component class
formatExpiryDate(dateString: string): string {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  } catch (e) {
    return '';
  }
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

  private loadVariations() {
    this.variationsSubscription = this.variationsService.getVariations().subscribe({
      next: (variations) => {
        this.availableVariations = variations;
      },
      error: (err) => {
        console.error('Failed to fetch variations:', err);
      }
    });
  }

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
        this.subCategories = [
          { name: 'Office Chairs', category: 'Furniture' },
          { name: 'Dining Chairs', category: 'Furniture' },
          { name: 'Smartphones', category: 'Electronics' },
          { name: 'Laptops', category: 'Electronics' },
          { name: 'General', category: 'Medicines' },
          { name: 'Antibiotics', category: 'Drugs' }
        ];
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
      // Initialize with one empty component
      if (this.product.components.length === 0) {
        this.addComponent();
      }
      // For combination products, calculate price based on components
      this.calculateCombinationPrices();
    } else if (this.product.productType === 'Variant') {
      // Initialize variant data if needed
      this.generateVariantCombinations();
    }
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

  // Variant Product Methods
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
    if (this.selectedVariations.length === 0) {
      this.variantCombinations = [];
      return;
    }

    // Generate all possible combinations of selected values
    const combinations = this.getCombinations(this.selectedVariations);
    
    // Update or create variant combinations
    const newCombinations = combinations.map(comb => {
      const existing = this.variantCombinations.find(vc => 
        this.arraysEqual(vc.values, comb.values)
      );
      
      return existing || {
        values: comb.values,
        sku: this.generateVariantSku(comb.values),
        price: this.product.defaultSellingPriceExcTax || 0,
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
    const baseSku = this.product.sku || 'VAR';
    const variantCode = values.map(v => v.substring(0, 3).toUpperCase()).join('-');
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

  private getTaxPercentage(): number {
    return this.product.taxPercentage || 0;
  }

  calculateTaxAmount(): number {
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

 // In edit-product.component.ts
async updateProduct() {
  try {
    this.isLoading = true;

    // If stock management is enabled, ensure quantity is set
    if (this.product.manageStock) {
      // If quantity is not provided, set to 0
      if (this.product.totalQuantity === null || this.product.totalQuantity === undefined) {
        this.product.totalQuantity = 0;
      }

      // Set currentStock to match the entered quantity
      this.product.currentStock = this.product.totalQuantity;
    } else {
      // If stock management is disabled, set both to null
      this.product.totalQuantity = null;
      this.product.currentStock = null;
    }

    // First update the product details
    await this.productsService.updateProduct(this.productId, this.product);
    
    // If stock management is enabled, record the stock change
    if (this.product.manageStock) {
      // Get the current product data to compare quantities
      const currentProduct = await this.productsService.getProductById(this.productId);
      const oldQuantity = currentProduct?.currentStock || 0;
      const newQuantity = this.product.currentStock || 0;
      const quantityDifference = newQuantity - oldQuantity;

      if (quantityDifference !== 0) {
        // Determine if we're adding or removing stock
        const action = quantityDifference > 0 ? 'add' : 'subtract';
        const absoluteQuantity = Math.abs(quantityDifference);
        
        // Use the adjustProductStock method from StockService
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
    alert(`Error: ${error instanceof Error ? error.message : 'Failed to update product'}`);
  } finally {
    this.isLoading = false;
  }
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

  onFileSelected(event: Event, type: 'image' | 'brochure') {
    const input = event.target as HTMLInputElement;
    if (input?.files && input.files.length > 0) {
      const file = input.files[0];
      if (type === 'image') {
        this.product.productImage = file;
      } else {
        this.product.productBrochure = file;
      }
    }
  }
}