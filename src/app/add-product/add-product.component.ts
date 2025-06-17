import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { ProductsService } from '../services/products.service';
import { CategoriesService } from '../services/categories.service';
import { BrandsService } from '../services/brands.service';
import { UnitsService } from '../services/units.service';
import { TaxService } from '../services/tax.service';
import { VariationsService } from '../services/variations.service';
import { Subscription } from 'rxjs';
import { SkuGeneratorService } from '../services/sku-generator.service';
import { Router, ActivatedRoute } from '@angular/router';
import { LocationService } from '../services/location.service';
import { UserService } from '../services/user.service';
import { NgForm } from '@angular/forms';
import { StockService } from '../services/stock.service';
import { HostListener } from '@angular/core';


interface Location {
  id: string;
  name: string;
}

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
filteredLocations: any[] = [];
selectedLocations: any[] = [];
searchQuery: string = '';
  availableProducts: any[] = [];
  availableVariations: any[] = [];
  selectedVariations: any[] = [];
  variantCombinations: any[] = [];
  searchNotSellingProductsQuery: string = '';
showDropdown = false;
@HostListener('document:click', ['$event'])
onClick(event: MouseEvent) {
  const target = event.target as HTMLElement;
  const isInsideDropdown = target.closest('.searchable-multiselect');
  
  if (!isInsideDropdown) {
    this.showDropdown = false;
  }
}
  locations: any[] = [];
  allCategories: any[] = []; // To store all categories including subcategories
  categories: any[] = [];
  productFormSubmitted: boolean = false;

  brands: any[] = [];
  units: any[] = [];
  selectedNotSellingProduct: any = null;

  subCategories: any[] = [];
  filteredSubCategories: any[] = [];
  products: any[] = [];
  taxRates: any[] = [];
  private roundToWholeNumber(value: number): number {
    return Math.round(value);
  }

  
  roundToTwoDecimals(value: number): number {
    return Math.round(value * 100) / 100;
  }
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

  constructor(
    private productsService: ProductsService,
    private categoriesService: CategoriesService,
    private brandsService: BrandsService,
private skuGenerator: SkuGeneratorService,
   private unitsService: UnitsService,
    private taxService: TaxService,
    private userService: UserService,
    private variationsService: VariationsService,
    private locationService: LocationService,
    private router: Router,
    private route: ActivatedRoute,
    private stockService: StockService // Properly typed as StockService

    
    
  ) {}

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
    this.loadAvailableProducts();
    this.loadVariations();
    this.product.components = (this.product.components || []).filter((c: any) => c.productId);

    // Handle duplicated product from router state
    const navigation = this.router.getCurrentNavigation();
    const duplicatedProduct = navigation?.extras?.state?.['duplicateProduct'];
    
    if (duplicatedProduct) {
      this.product = {
        ...this.getInitialProduct(),
        ...duplicatedProduct
      };
      
      // If it's a combination product, ensure components are properly set
      if (this.product.productType === 'Combination' && this.product.components) {
        this.product.components = [...this.product.components];
      }
      
      // If it's a variant product, ensure variations are properly set
      if (this.product.productType === 'Variant' && this.product.variations) {
        this.variantCombinations = [...this.product.variations];
        // Initialize selected variations based on the duplicated product
        this.initializeSelectedVariationsFromCombinations();
      }
      
      this.isEditing = false; // Ensure we're creating a new product
      
      // Filter subcategories based on the duplicated product's category
      if (this.product.category) {
        setTimeout(() => this.filterSubCategories(), 500);
      }
    }
  }
  // Add this method to your StockService class

filterLocations(event: Event) {
  const input = event.target as HTMLInputElement;
  this.searchQuery = input.value.toLowerCase();
  this.showDropdown = true; // Show dropdown when typing
  
  if (!this.searchQuery) {
    this.filteredLocations = [...this.locations];
  } else {
    this.filteredLocations = this.locations.filter(location =>
      location.name.toLowerCase().includes(this.searchQuery)
    );
  }
}
  
// Update the toggleLocationSelection method
toggleLocationSelection(location: any) {
  const index = this.selectedLocations.findIndex(l => l.id === location.id);
  
  if (index >= 0) {
    this.selectedLocations.splice(index, 1);
  } else {
    this.selectedLocations.push({...location});
  }
  
  this.updateProductLocations();
  this.showDropdown = false; // Close dropdown after selection
  }
  updateProductLocations() {
  // Update the product with both location IDs and names
  this.product.locations = this.selectedLocations.map(loc => loc.id);
  this.product.locationNames = this.selectedLocations.map(loc => loc.name);
  
  // For backward compatibility, also set the primary location
  if (this.selectedLocations.length > 0) {
    this.product.location = this.selectedLocations[0].id;
    this.product.locationName = this.selectedLocations[0].name;
  } else {
    this.product.location = '';
    this.product.locationName = '';
  }
}

removeLocation(location: any) {
  this.toggleLocationSelection(location);
}

isLocationSelected(locationId: string): boolean {
  return this.selectedLocations.some(l => l.id === locationId);
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
toggleDropdown(event: Event) {
  event.stopPropagation(); // Prevent the document click handler from closing it immediately
  this.showDropdown = !this.showDropdown;
  
  // If opening, make sure filteredLocations is populated
  if (this.showDropdown && this.filteredLocations.length === 0) {
    this.filteredLocations = [...this.locations];
  }
}

// Modify your HostListener to properly handle clicks outside

onNotSellingQuantityChange(product: any) {
  if (product.selectedQuantity > product.currentStock) {
    product.selectedQuantity = product.currentStock;
    alert(`Quantity cannot exceed available stock (${product.currentStock})`);
  }
  
  if (product.selectedQuantity < 1) {
    product.selectedQuantity = 1;
  }
}

  private initializeSelectedVariationsFromCombinations() {
    if (!this.variantCombinations.length) return;
    
    // We'll need to set this up once variations are loaded
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
      
      // Rebuild selectedVariations based on the combinations
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

  ngOnDestroy() {
    // Unsubscribe from all subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
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
private getInitialProduct() {
  return {
    productName: '',
    sku: '',
    hsnCode: '',
 locations: [], 
location: '',
    barcodeType: 'Code 128 (C128)',
    unit: '',
    addedBy: '',
        expiryDate: null, // Add this line

    addedByName: '',
addedDate: new Date().toISOString().split('T')[0], // Just get the date part
    brand: '',
    category: '',
      totalQuantity: 0,       // Total quantity in stock
  lastNumber: '', 
    subCategory: '',
    manageStock: true,
    alertQuantity: null,
    productDescription: '',
    productImage: null,
    productBrochure: null,
    enableProductDescription: false,
    notForSelling: false,
    notSellingProducts: [], // Add this new property
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
    marginPercentage: 25.0,
    defaultPurchasePriceExcTax: null,
    defaultPurchasePriceIncTax: null,
    defaultSellingPriceExcTax: null,
    defaultSellingPriceIncTax: null,
    components: [], 
    variations: []
  };
   if (this.product.locations && this.product.locations.length > 0) {
    this.selectedLocations = this.locations.filter(loc => 
      this.product.locations.includes(loc.id)
    );
  }
    this.filteredLocations = [...this.locations];

}

  private loadTaxRates() {
    const subscription = this.taxService.getTaxRates().subscribe({
      next: (rates) => {
        this.taxRates = rates.filter(rate => !rate.forTaxGroupOnly);
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
      this.loadLocations(),
      this.loadUnits(),
      this.loadSubCategories(),
    ]);
    
    // Initialize selected locations if editing
    if (this.isEditing && this.product.locations && this.product.locations.length > 0) {
      this.selectedLocations = this.locations.filter(loc => 
        this.product.locations.some((pl: any) => pl.id === loc.id)
      );
    }
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
  
calculateFromMRP() {
  const taxPercentage = this.getTaxPercentage();
  if (this.product.defaultSellingPriceIncTax !== null) {
    // Calculate price before tax from MRP
    this.product.defaultSellingPriceExcTax = 
      this.product.defaultSellingPriceIncTax / (1 + taxPercentage / 100);
    
    // Calculate margin based on purchase price
    if (this.product.defaultPurchasePriceExcTax) {
      const cost = parseFloat(this.product.defaultPurchasePriceExcTax);
      const sellingPrice = parseFloat(this.product.defaultSellingPriceExcTax);
      this.product.marginPercentage = this.roundToTwoDecimals(((sellingPrice - cost) / cost) * 100);
    }
    
    // Round the values
    this.product.defaultSellingPriceExcTax = this.roundToTwoDecimals(this.product.defaultSellingPriceExcTax);
    this.product.defaultSellingPriceIncTax = this.roundToTwoDecimals(this.product.defaultSellingPriceIncTax);
  }
}

calculateTaxAmount(): number {
  const taxPercentage = this.getTaxPercentage();
  if (!taxPercentage || !this.product.defaultSellingPriceIncTax) return 0;
  
  const taxAmount = this.product.defaultSellingPriceIncTax - 
                   (this.product.defaultSellingPriceIncTax / (1 + taxPercentage / 100));
  
  return this.roundToTwoDecimals(taxAmount);
}
  private loadCategories(): Promise<void> {
    return new Promise((resolve) => {
      const subscription = this.categoriesService.categories$.subscribe({
        next: (categories) => {
          this.categories = (categories || []).filter(cat => !cat.parentCategory);
          this.allCategories = categories || []; // Store all categories including subcategories
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
  
  // Filter out products that are already selected
  const selectedProductIds = (this.product.notSellingProducts || []).map((item: any) => item.productId);
  
  return this.availableProducts.filter(product => 
    !selectedProductIds.includes(product.id) && 
    product.id !== this.product.id && // Don't include the current product being edited
    (product.currentStock || 0) > 0 // Only show products with available stock
  );
}

addNotSellingProduct(product: any) {
  if (!product || !product.selectedQuantity || product.selectedQuantity <= 0) return;

  if (!this.selectedNotSellingProducts) {
    this.selectedNotSellingProducts = [];
  }

  // Check if product is already added
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

  // Update the main product's notSellingProducts array
  if (!this.product.notSellingProducts) {
    this.product.notSellingProducts = [];
  }
  this.product.notSellingProducts = this.selectedNotSellingProducts.map(p => ({
    productId: p.id,
    quantity: p.selectedQuantity
  }));

  // Reset the search
  this.searchNotSellingProducts = '';
  this.filterNotSellingProducts();
}
  

updateNotSellingQuantity(product: any) {
  if (product.selectedQuantity > product.currentStock) {
    product.selectedQuantity = product.currentStock;
    alert(`Quantity cannot exceed available stock (${product.currentStock})`);
  }
  
  if (product.selectedQuantity < 1) {
    product.selectedQuantity = 1;
  }

  // Update the main product's notSellingProducts array
  this.product.notSellingProducts = this.selectedNotSellingProducts.map(p => ({
    productId: p.id,
    quantity: p.selectedQuantity
  }));
}

removeNotSellingProduct(index: number) {
  this.selectedNotSellingProducts.splice(index, 1);
  
  // Update the main product's notSellingProducts array
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
  const product = this.availableProducts.find(p => p.id === productId);
  return product ? (product.currentStock || 0) : 0;
}

validateNotSellingQuantity(index: number): void {
  const item = this.product.notSellingProducts[index];
  const availableStock = this.getProductStock(item.productId);
  
  if (item.quantity > availableStock) {
    item.quantity = availableStock;
    alert(`Quantity cannot exceed available stock (${availableStock})`);
  }
  
  if (item.quantity < 1) {
    item.quantity = 1;
  }
}


  private loadLocations(): Promise<void> {
    return new Promise((resolve) => {
      const subscription = this.locationService.getLocations().subscribe({
        next: (locations) => {
          this.locations = locations.filter((loc: any) => loc.active !== false);
          console.log('Loaded locations:', this.locations.length);
          resolve();
        },
        error: (error) => {
          console.error('Error loading locations:', error);
          resolve();
        }
      });
      this.subscriptions.push(subscription);
    });
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
    this.product.addedBy = user.id;
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
        this.subCategories = [
          { name: 'Office Chairs', category: 'Furniture' },
          { name: 'Dining Chairs', category: 'Furniture' },
          { name: 'Smartphones', category: 'Electronics' },
          { name: 'Laptops', category: 'Electronics' },
          { name: 'General', category: 'Medicines' },
          { name: 'Antibiotics', category: 'Drugs' }
        ];
        console.log('Loaded subcategories:', this.subCategories.length);
        resolve();
      }, 500);
    });
  }

 // Update the onCategoryChange method
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
    // Initialize with one empty component
    if (!this.product.components || this.product.components.length === 0) {
      this.product.components = [];
      this.addComponent();
    }
    // For combination products, calculate price based on components
    this.calculateCombinationPrices();
  } else if (this.product.productType === 'Variant') {
    // Initialize variant data if needed
    if (!this.selectedVariations) {
      this.selectedVariations = [];
    }
    this.generateVariantCombinations();
  } else if (this.product.productType === 'Single') {
    // Initialize not selling products array if not for selling is checked
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
      // Update the component with product details for display
      component.productName = product.productName;
      component.sku = product.sku;
      component.currentStock = product.currentStock || 0;
      component.price = product.defaultPurchasePriceExcTax || 0;
    }
  }
  this.calculateCombinationPrices();
  this.calculateAllPrices(); // This will update the recommended price
}

  getComponentProduct(index: number): any {
    const component = this.product.components[index];
    if (!component || !component.productId) return null;
    return this.availableProducts.find(p => p.id === component.productId);
  }


 
  calculateRecommendedPrice(): number {
    const cost = this.calculateCombinationPrices();
    const price = cost * (1 + (this.product.marginPercentage / 100));
    return this.roundToWholeNumber(price);
  }

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
  
  // Update the product's purchase prices
  this.product.defaultPurchasePriceExcTax = this.roundToTwoDecimals(totalCost);
  
  // Calculate inclusive price based on tax
  const taxPercentage = this.getTaxPercentage();
  this.product.defaultPurchasePriceIncTax = this.roundToTwoDecimals(
    totalCost * (1 + taxPercentage / 100)
  );
  
  return this.roundToTwoDecimals(totalCost);
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
    if (!this.selectedVariations || this.selectedVariations.length === 0) {
      this.variantCombinations = [];
      return;
    }

    // Filter out variations with no selected values
    const activeVariations = this.selectedVariations.filter(v => v.values && v.values.length > 0);
    
    if (activeVariations.length === 0) {
      this.variantCombinations = [];
      return;
    }

    // Generate all possible combinations of selected values
    const combinations = this.getCombinations(activeVariations);
    
    // Update or create variant combinations
    const newCombinations = combinations.map(comb => {
      const existing = this.variantCombinations.find(vc => 
        this.arraysEqual(vc.values, comb.values)
      );
      
      return existing || {
        values: comb.values,
        sku: this.generateVariantSku(comb.values),
        price: this.roundToWholeNumber(this.product.defaultSellingPriceExcTax || 0),
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
  const baseSku = this.product.sku || '100001'; // Default fallback
  const variantCode = values.map(v => {
    // Convert first 3 letters to numeric representation
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

  private getTaxPercentage(): number {
    return this.product.taxPercentage || 0;
  }


  calculateTax() {
    this.calculateAllPrices();
  }

calculateSellingPrice() {
  const { defaultPurchasePriceExcTax, marginPercentage } = this.product;
  if (defaultPurchasePriceExcTax && marginPercentage !== null) {
    // Calculate selling price before tax
    const calculatedPrice = parseFloat(defaultPurchasePriceExcTax) * (1 + marginPercentage / 100);
    this.product.defaultSellingPriceExcTax = this.roundToTwoDecimals(calculatedPrice);
    
    // Calculate MRP (including tax)
    this.calculateSellingPriceIncTax();
  }
}

 calculateSellingPriceIncTax() {
  const taxPercentage = this.getTaxPercentage();
  if (this.product.defaultSellingPriceExcTax !== null) {
    // Calculate MRP by adding tax to selling price
    const calculatedPrice = parseFloat(this.product.defaultSellingPriceExcTax) * (1 + taxPercentage / 100);
    this.product.defaultSellingPriceIncTax = this.roundToTwoDecimals(calculatedPrice);
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


calculateAllPrices() {
  const taxPercentage = this.getTaxPercentage();
  
  if (this.product.productType === 'Combination') {
    // For combination products, always calculate from components
    const cost = this.calculateCombinationPrices();
    
    // Calculate selling price based on margin if MRP isn't set
    if (!this.product.defaultSellingPriceIncTax) {
      const priceBeforeTax = cost * (1 + this.product.marginPercentage / 100);
      this.product.defaultSellingPriceExcTax = this.roundToTwoDecimals(priceBeforeTax);
      this.product.defaultSellingPriceIncTax = this.roundToTwoDecimals(
        priceBeforeTax * (1 + taxPercentage / 100)
      );
    } else {
      // If MRP is set, calculate the exc. tax price from it
      this.calculateFromMRP();
    }
  } else {
    // For regular products, calculate from MRP if set
    if (this.product.defaultSellingPriceIncTax) {
      this.calculateFromMRP();
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
    
    // Set currentStock equal to totalQuantity if manageStock is enabled
    if (this.product.manageStock) {
      this.product.currentStock = this.product.totalQuantity || 0;
    } else {
      this.product.currentStock = 0;
    }

    // Add the product
    const productId = await this.productsService.addProduct(this.product);
    
    // If manageStock is enabled, initialize the stock
    if (this.product.manageStock && this.product.totalQuantity > 0) {
      await this.stockService.initializeProductStock(
        { id: productId, productName: this.product.productName },
        this.product.totalQuantity
      );
    }

    this.showSuccess('Product added successfully!');
    this.router.navigate(['/list-products']);
    
  } catch (error) {
    this.handleError(error);
  } finally {
    this.isLoading = false;
  }
}
async saveAndNavigate(event?: Event) {
  if (event) event.preventDefault(); // Prevent form submission
  try {
    await this.addProduct();
    this.router.navigate(['/list-products']);
  } catch (error) {
    console.error('Error saving product:', error);
  }
}

// Helper methods for better organization
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
  // You could replace this with a toast notification or other UI feedback
  alert(message);
}

private handleError(error: unknown) {
  console.error('Error saving product:', error);
  
  let errorMessage = 'Failed to save product';
  
  if (error instanceof Error) {
    errorMessage = error.message;
    
    // Handle specific error cases
    if (error.message.includes('Applicable Tax')) {
      errorMessage = 'Please select a valid tax option or choose "None" if no tax applies';
    } else if (error.message.includes('Firebase')) {
      // Handle Firebase specific errors
      if (error.message.includes('permission-denied')) {
        errorMessage = 'You do not have permission to perform this action';
      } else if (error.message.includes('network-request-failed')) {
        errorMessage = 'Network error. Please check your internet connection';
      }
    }
  } else if (typeof error === 'string') {
    errorMessage = error;
  }
  
  // Show user-friendly error message
  alert(`Error: ${errorMessage}`);
  
  // Re-enable form after error
  this.isLoading = false;
}
validateForm(): boolean {
  let isValid = true;

  // Basic required fields validation
  const requiredFields = [
    { field: 'productName', message: 'Product name is required' },
    { field: 'unit', message: 'Unit is required' },
    { field: 'barcodeType', message: 'Barcode type is required' },
    { field: 'sellingPriceTaxType', message: 'Selling price tax type is required' },
    { field: 'productType', message: 'Product type is required' }
  ];

  for (const { field, message } of requiredFields) {
    if (!this.product[field]) {
      alert(message);
      isValid = false;
    }
  }

  // Validate applicable tax
  if (this.product.applicableTax === null || this.product.applicableTax === undefined) {
    alert('Applicable Tax is required');
    isValid = false;
  }

  // Validate product type specific requirements
  switch (this.product.productType) {
    case 'Variant':
      if (!this.variantCombinations || this.variantCombinations.length === 0) {
        alert('Please select at least one variation');
        isValid = false;
      }
      break;
      
    case 'Combination':
      if (!this.product.components || this.product.components.length === 0) {
        alert('Please add at least one component');
        isValid = false;
      }
      break;
      
    case 'Single':
      // Validate pricing for single products
      if (!this.product.defaultSellingPriceExcTax || !this.product.defaultSellingPriceIncTax) {
        alert('Please enter selling prices');
        isValid = false;
      }
      break;
  }

  return isValid;
}

async saveAndAddOpeningStock() {
  if (!this.validateForm()) {
    return;
  }
  
  try {
    this.isLoading = true;

    // Set both location IDs and names
    this.product.locations = this.selectedLocations.map(loc => loc.id);
    this.product.locationNames = this.selectedLocations.map(loc => loc.name);

    if (!this.product.sku && this.product.productName) {
      this.product.sku = await this.generateNumericSku();
    }

    this.calculateAllPrices();

    let productId: string;

    if (this.isEditing && this.product.id) {
      await this.productsService.updateProduct(this.product.id, this.product);
      productId = this.product.id;
    } else {
      productId = await this.productsService.addProduct(this.product);
    }

    const productData = {
      id: productId,
      productName: this.product.productName,
      unit: this.product.unit,
     locations: this.selectedLocations.map(loc => ({ id: loc.id, name: loc.name })),
      totalQuantity: this.product.totalQuantity || 0,
      currentStock: this.product.totalQuantity || 0, // Set currentStock same as totalQuantity
      defaultPurchasePriceExcTax: this.product.defaultPurchasePriceExcTax,
      sku: this.product.sku
    };

    this.router.navigate(['/opening-stock'], {
      queryParams: {
        productId: productId,
        productData: JSON.stringify(productData)
      }
    });

  } catch (error) {
    console.error('Error in saveAndAddOpeningStock:', error);
    alert(`Error: ${error instanceof Error ? error.message : 'Failed to save product'}`);
  } finally {
    this.isLoading = false;
  }
}



  // Format date for display in input (YYYY-MM-DD)
formatDateForInput(dateString: string): string {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  
  const year = date.getFullYear();
  const month = ('0' + (date.getMonth() + 1)).slice(-2);
  const day = ('0' + date.getDate()).slice(-2);
  
  return `${year}-${month}-${day}`;
}

// Handle date input changes
onDateChange(event: any) {
  const inputDate = event.target.value;
  if (inputDate) {
    // Convert from YYYY-MM-DD (input format) to Date object
    this.product.addedDate = new Date(inputDate).toISOString();
  }
}

 async saveAndAddAnother(event?: Event) {
  if (event) event.preventDefault(); // Prevent form submission
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