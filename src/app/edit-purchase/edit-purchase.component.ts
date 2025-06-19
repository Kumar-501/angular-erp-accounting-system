import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { PurchaseService } from '../services/purchase.service';
import { Router, ActivatedRoute } from '@angular/router';
import { SupplierService } from '../services/supplier.service';
import { LocationService } from '../services/location.service';
import { ProductsService } from '../services/products.service';
import { AuthService } from '../auth.service';
import { UserService } from '../services/user.service';
import { TaxRate } from '../tax/tax.model';
import { TaxService } from '../services/tax.service';

interface Supplier {
  id: string;
  contactId?: string;
  businessName?: string;
  firstName?: string;
  lastName?: string;
  isIndividual?: boolean;
  addressLine1?: string;
}

// Updated Product interface with all required properties
interface Product {
  id?: string;
  productId?: string;
  productName: string;
  quantity: number;
  unitCost: number;
  discountPercent: number;
  unitCostBeforeTax: number;
  subtotal: number;
  taxAmount: number;
  lineTotal: number;
  profitMargin: number;
  sellingPrice: number;
  batchNumber: string;
  expiryDate: string;
  taxRate: number;
  
  // Additional properties that were missing
  sku?: string;
  barcode?: string;
  currentStock?: number;
  totalQuantity?: number;
  defaultSellingPriceExcTax?: number;
  defaultPurchasePriceIncTax?: number;
  defaultPurchasePriceExcTax?: number;
  unitPurchasePrice?: number;
  taxPercentage?: number;
  
  // Other optional properties that might be needed
  marginPercentage?: number;
  applicableTax?: { percentage: number };
}

@Component({
  selector: 'app-edit-purchase',
  templateUrl: './edit-purchase.component.html',
  styleUrls: ['./edit-purchase.component.scss']
})
export class EditPurchaseComponent implements OnInit {
  [x: string]: any;
  purchaseForm!: FormGroup;
  suppliers: Supplier[] = [];
  businessLocations: any[] = [];
  selectedSupplier: Supplier | null = null;
  totalItems = 0;
  selectedProducts: Set<number> = new Set<number>();
taxRates: TaxRate[] = [];

  netTotalAmount = 0;
  totalTax = 0;
  searchTerm: string = '';
searchResults: Product[] = [];
showSearchResults: boolean = false;
  users: any[] = [];
  productsList: any[] = [];
  purchaseId: string | null = null;
  currentUser: any = null;
  isLoading = true;
  originalPurchaseData: any = null;

  constructor(
    private fb: FormBuilder,
    private purchaseService: PurchaseService,
    private supplierService: SupplierService,
    private locationService: LocationService,
    public router: Router,
    private productsService: ProductsService,
    private route: ActivatedRoute,
    private authService: AuthService,
    private userService: UserService,
      private taxService: TaxService,

  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadSuppliers();
    this.loadBusinessLocations();
    this.loadProducts();
    this.getCurrentUser();
    this.loadUsers();
      this.loadTaxRates(); // Add this line

    this.route.paramMap.subscribe(params => {
      this.purchaseId = params.get('id');
      if (this.purchaseId) {
        this.loadPurchaseData(this.purchaseId);
      } else {
        this.router.navigate(['/list-purchase']);
      }
    });
  }

  loadUsers(): void {
    this.userService.getUsers().subscribe(users => {
      this.users = users;
    });
  }
onSearchInput(event: any): void {
  this.searchTerm = event.target.value;
  
  if (this.searchTerm.length > 1) {
    this.searchResults = this.productsList.filter(product => 
      product.productName.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
      (product.sku && product.sku.toLowerCase().includes(this.searchTerm.toLowerCase())) ||
      (product.barcode && product.barcode.toLowerCase().includes(this.searchTerm.toLowerCase()))
    );
    this.showSearchResults = true;
  } else {
    this.searchResults = [];
    this.showSearchResults = false;
  }
  }
  toggleProductSelection(index: number): void {
  if (this.selectedProducts.has(index)) {
    this.selectedProducts.delete(index);
  } else {
    this.selectedProducts.add(index);
  }
}

isProductSelected(index: number): boolean {
  return this.selectedProducts.has(index);
}
deleteSelectedProducts(): void {
  if (this.selectedProducts.size === 0) {
    alert('Please select at least one product to delete');
    return;
  }

  if (confirm(`Are you sure you want to delete ${this.selectedProducts.size} selected products?`)) {
    const indexesToDelete = Array.from(this.selectedProducts).sort((a, b) => b - a);
    
    indexesToDelete.forEach(index => {
      this.productsFormArray.removeAt(index);
    });
    
    this.selectedProducts.clear();
    this.calculateTotals();
  }
}loadTaxRates(): void {
  this['taxService'].getTaxRates().subscribe((rates: TaxRate[]) => {
    this.taxRates = rates;

    if (!this.taxRates.some(rate => rate.name.includes('GST'))) {
      this.taxRates.push(
        { id: 'gst5', name: 'GST 5%', rate: 5, active: true, forTaxGroupOnly: false },
        { id: 'gst12', name: 'GST 12%', rate: 12, active: true, forTaxGroupOnly: false },
        { id: 'gst18', name: 'GST 18%', rate: 18, active: true, forTaxGroupOnly: false },
        { id: 'gst28', name: 'GST 28%', rate: 28, active: true, forTaxGroupOnly: false }
      );
    }

    this.taxRates.sort((a, b) => a.rate - b.rate);
  });
}
handleKeyDown(event: KeyboardEvent): void {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    const buttons = document.querySelectorAll('.search-results-dropdown .list-group-item-action');
    if (buttons.length > 0) {
      const currentFocus = document.activeElement;
      let currentIndex = Array.from(buttons).indexOf(currentFocus as Element);
      
      if (event.key === 'ArrowDown') {
        currentIndex = currentIndex < buttons.length - 1 ? currentIndex + 1 : 0;
      } else {
        currentIndex = currentIndex > 0 ? currentIndex - 1 : buttons.length - 1;
      }
      
      (buttons[currentIndex] as HTMLElement).focus();
    }
  } else if (event.key === 'Escape') {
    this.clearSearch();
  }
}
onSearchFocus(): void {
  if (this.searchTerm.length > 1) {
    this.showSearchResults = true;
  }
  }
  toggleSelectAll(event: any): void {
  const isChecked = event.target.checked;
  
  if (isChecked) {
    this.productsFormArray.controls.forEach((_, index) => {
      this.selectedProducts.add(index);
    });
  } else {
    this.selectedProducts.clear();
  }
}


onSearchBlur(): void {
  setTimeout(() => {
    this.showSearchResults = false;
  }, 150);
}
addProductFromSearch(product: Product): void {
  const existingProductIndex = this.productsFormArray.controls.findIndex(
    control => control.get('productId')?.value === product.id
  );

  if (existingProductIndex >= 0) {
    const existingProduct = this.productsFormArray.at(existingProductIndex);
    const currentQuantity = existingProduct.get('quantity')?.value || 0;
    existingProduct.get('quantity')?.setValue(currentQuantity + 1);
    this.calculateLineTotal(existingProductIndex);
  } else {
    const productToAdd = {
      ...product,
      currentStock: product.currentStock || product.totalQuantity || 0
    };
    this.addProductToTable(productToAdd);
  }

  this.clearSearch();
}
highlightMatch(text: string, searchTerm: string): string {
  if (!text || !searchTerm) return text || '';
  
  const regex = new RegExp(`(${searchTerm})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}
clearSearch(): void {
  this.searchTerm = '';
  this.searchResults = [];
  this.showSearchResults = false;
}
  getCurrentUser(): void {
    this.authService.getCurrentUser().subscribe(user => {
      this.currentUser = user;
      if (user) {
        this.purchaseForm.patchValue({
          addedBy: {
            id: user.uid,
            name: user.displayName || user.email,
            email: user.email
          },
          assignedTo: user.uid
        });
      }
    });
  }
addProductToTable(product: Product): void {
  const productGroup = this.fb.group({
    productId: [product.id || product.productId],
    productName: [product.productName],
    quantity: [1],
    unitCost: [product.defaultPurchasePriceIncTax || 
              product.unitPurchasePrice || 
              product.unitCost || 0],
    discountPercent: [0],
    unitCostBeforeTax: [product.defaultPurchasePriceExcTax || 
                       product.unitCost || 0],
    subtotal: [0],
    lineTotal: [0],
    taxRate: [product.taxPercentage || product.taxRate || 0],
    taxAmount: [0],
    batchNumber: [product.batchNumber || ''],
    expiryDate: [product.expiryDate || ''],
    netCost: [0],
    currentStock: [product.currentStock || product.totalQuantity || 0]
  });

  this.productsFormArray.push(productGroup);
  this.calculateLineTotal(this.productsFormArray.length - 1);
}
  loadPurchaseData(purchaseId: string): void {
    this.purchaseService.getPurchaseById(purchaseId)
      .then((purchaseData) => {
        if (purchaseData) {
          this.originalPurchaseData = purchaseData;
          this.prefillForm(purchaseData);
          this.isLoading = false;
        }
      })
      .catch((err: any) => {
        console.error('Error loading purchase:', err);
        this.router.navigate(['/list-purchase']);
      });
  }

prefillForm(purchaseData: any): void {
  const supplierId = purchaseData.supplierId || '';
  
  this.purchaseForm.patchValue({
    supplierId: supplierId,
    supplierName: purchaseData.supplierName || '',
    address: purchaseData.address || '',
    referenceNo: purchaseData.referenceNo || '',
    paymentDue: purchaseData.paymentDue || 0,  // Make sure this is included
    balance: purchaseData.paymentDue || 0,     // Prefill balance with paymentDue
    purchaseDate: this.formatDateForInput(purchaseData.purchaseDate),
    purchaseStatus: purchaseData.purchaseStatus || '',
    businessLocation: purchaseData.businessLocation || '',
    payTerm: purchaseData.payTerm || '',
    additionalNotes: purchaseData.additionalNotes || '',
    shippingCharges: purchaseData.shippingCharges || 0,
    paymentAmount: purchaseData.paymentAmount || 0,
    paidOn: this.formatDateForInput(purchaseData.paidOn || purchaseData.purchaseDate),
    paymentMethod: purchaseData.paymentMethod || '',
    paymentNote: purchaseData.paymentNote || '',
    totalPayable: purchaseData.totalPayable || 0,
    roundOffAmount: purchaseData.roundOffAmount || 0,
    roundedTotal: purchaseData.roundedTotal || 0,
    invoiceNo: purchaseData.invoiceNo || '',
    invoicedDate: this.formatDateForInput(purchaseData.invoicedDate),
    receivedDate: this.formatDateForInput(purchaseData.receivedDate),
    addedBy: purchaseData.addedBy || {
      id: this.currentUser?.uid || '',
      name: this.currentUser?.displayName || this.currentUser?.email || '',
      email: this.currentUser?.email || ''
    },
    assignedTo: purchaseData.assignedTo || this.currentUser?.uid || ''
  });
  
  // Clear existing products
  while (this.productsFormArray.length !== 0) {
    this.productsFormArray.removeAt(0);
  }
  
  // Add products from purchase
  if (purchaseData.products && purchaseData.products.length > 0) {
    purchaseData.products.forEach((product: any) => {
      this.addProductFromPurchase(product);
    });
  }
  
  // Set supplier details if available
  if (supplierId) {
    this.onSupplierChange(supplierId);
  }
  
  // Calculate totals after loading all products
  this.calculateTotals();
}


  formatDateForInput(date: any): string {
    if (!date) return '';
    
    try {
      let dateObj: Date;
      if (typeof date === 'object' && 'toDate' in date) {
        dateObj = date.toDate();
      } else if (date instanceof Date) {
        dateObj = date;
      } else {
        dateObj = new Date(date);
      }
      
      return dateObj.toISOString().substring(0, 10);
    } catch (e) {
      console.error('Error formatting date:', e);
      return '';
    }
  }

addProductFromPurchase(product: any): void {
  const productGroup = this.fb.group({
    productId: [product.productId || product.id || ''],
    productName: [product.productName || ''],
    quantity: [product.quantity || 1],
    unitCost: [product.unitCost || 0],
    discountPercent: [product.discountPercent || 0],
    unitCostBeforeTax: [product.unitCostBeforeTax || product.unitCost || 0],
    subtotal: [product.subtotal || 0],
    taxAmount: [product.taxAmount || 0],
    lineTotal: [product.lineTotal || (product.quantity * product.unitCost) || 0],
    profitMargin: [product.profitMargin || 0],
    sellingPrice: [product.sellingPrice || 0],
    batchNumber: [product.batchNumber || product.lotNumber || ''],
    expiryDate: [product.expiryDate || ''],
    taxRate: [product.taxRate || 0]  // Make sure taxRate is included here
  });

  this.productsFormArray.push(productGroup);
  
  // Calculate line total for this product to ensure tax is included
  const index = this.productsFormArray.length - 1;
  this.calculateLineTotal(index);
}

loadProducts(): void {
  this.productsService.getProductsRealTime().subscribe((products: any[]) => {
    this.productsList = products.map(product => ({
      ...product,
      defaultPurchasePriceExcTax: product.defaultPurchasePriceExcTax || 0,
      defaultSellingPriceExcTax: product.defaultSellingPriceExcTax || 0,
      marginPercentage: product.marginPercentage || 0,
      applicableTax: product.applicableTax || { percentage: 0 },
      batchNumber: product.batchNumber || '',
      expiryDate: product.expiryDate || '',
      currentStock: product.currentStock || 0,
      totalQuantity: product.totalQuantity || 0
    }));
  });
}

  initForm(): void {
    this.purchaseForm = this.fb.group({
      supplierId: [''],
      supplierName: [''],
      address: [''],
    paymentDue: [0],
    balance: [0],
      referenceNo: [''],
      purchaseDate: [new Date().toISOString().substring(0, 10)],
      purchaseStatus: [''],
      businessLocation: [''],
      payTerm: [''],
      document: [null],
      discountType: [''],
      discountAmount: [0],
      purchaseTax: [0],
      additionalNotes: [''],
      shippingCharges: [0],
      products: this.fb.array([]),
      purchaseTotal: [0],
      paymentAmount: [0],
      paidOn: [new Date().toISOString().substring(0, 10)],
      paymentMethod: [''],
      paymentAccount: [''],
      paymentNote: [''],
      totalPayable: [0],
      roundOffAmount: [0],
      roundedTotal: [0],
      addedBy: this.fb.group({
        id: [''],
        name: [''],
        email: ['']
      }),
      assignedTo: [''],
      // New fields
      invoiceNo: [''],
      invoicedDate: [''],
      receivedDate: [''],
      batchNumber: [''],
      expiryDate: ['']
    });

    this.addProduct();

    // Listen to form changes
    this.purchaseForm.get('shippingCharges')?.valueChanges.subscribe(() => {
      this.calculateTotals();
    });

    this.purchaseForm.get('paymentAmount')?.valueChanges.subscribe(() => {
      this.calculatePaymentBalance();
    });
  }

  navigateToAddSupplier(): void {
    this.router.navigate(['/suppliers']);
  }

calculatePaymentBalance(): void {
  const totalPayable = this.purchaseForm.get('totalPayable')?.value || 0;
  const paymentAmount = this.purchaseForm.get('paymentAmount')?.value || 0;
  const paymentDue = Math.max(0, totalPayable - paymentAmount);
  
  this.purchaseForm.patchValue({
    balance: paymentDue.toFixed(2),
    paymentDue: paymentDue.toFixed(2)
  });
}

  get productsFormArray(): FormArray {
    return this.purchaseForm.get('products') as FormArray;
  }

// Update the addProduct method to match the add purchase component
addProduct(): void {
  const productGroup = this.fb.group({
    productId: ['', Validators.required],
    productName: [''],
    quantity: [1, [Validators.required, Validators.min(1)]],
    unitCost: [0, [Validators.required, Validators.min(0.01)]],
    discountPercent: [0, [Validators.min(0), Validators.max(100)]],
    unitCostBeforeTax: [0],
    subtotal: [0],
    lineTotal: [0],
    netCost: [0],
    taxRate: [0],
    taxAmount: [0],
    batchNumber: [''],
    expiryDate: ['']
  });

  this.productsFormArray.push(productGroup);
}

  onProductSelect(index: number, event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    const productId = selectElement.value;
    
    const selectedProduct = this.productsList.find(p => p.id === productId);
    const productGroup = this.productsFormArray.at(index);
    
    if (selectedProduct) {
      productGroup.patchValue({
        productId: selectedProduct.id,
        productName: selectedProduct.productName,
        unitCost: selectedProduct.defaultPurchasePriceExcTax || 0,
        profitMargin: 0,
        sellingPrice: selectedProduct.defaultSellingPriceExcTax || 0,
        taxRate: selectedProduct.taxRate || 0
      });
      
      this.calculateLineTotal(index);
    }
  }

  removeProduct(index: number): void {
    this.productsFormArray.removeAt(index);
    this.calculateTotals();
  }

calculateLineTotal(index: number): void {
  const productGroup = this.productsFormArray.at(index);
  const quantity = productGroup.get('quantity')?.value || 0;
  const unitCost = productGroup.get('unitCost')?.value || 0;
  const discountPercent = productGroup.get('discountPercent')?.value || 0;
  const taxRate = productGroup.get('taxRate')?.value || 0; // Default to 0 if not set

  const discountedPrice = unitCost * (1 - (discountPercent / 100));
  const subtotal = quantity * discountedPrice;
  const taxAmount = subtotal * (taxRate / 100);
  const lineTotal = subtotal + taxAmount;

  productGroup.patchValue({
    unitCostBeforeTax: discountedPrice.toFixed(2),
    subtotal: subtotal.toFixed(2),
    taxAmount: taxAmount.toFixed(2),
    lineTotal: lineTotal.toFixed(2)
  }, { emitEvent: false });

  this.calculateSellingPrice(index);
  this.calculateTotals();
}

  calculateSellingPrice(index: number): void {
    const productGroup = this.productsFormArray.at(index);
    const unitCostBeforeTax = parseFloat(productGroup.get('unitCostBeforeTax')?.value) || 0;
    const profitMargin = productGroup.get('profitMargin')?.value || 0;
    const taxRate = productGroup.get('taxRate')?.value || 0;

    const priceBeforeTax = unitCostBeforeTax * (1 + (profitMargin / 100));
    const sellingPrice = priceBeforeTax * (1 + (taxRate / 100));
    
    productGroup.patchValue({
      sellingPrice: sellingPrice.toFixed(2)
    });
  }

calculateTotals(): void {
  this.totalItems = this.productsFormArray.length;
  
  let productsTotal = 0;
  let totalTax = 0;

  this.productsFormArray.controls.forEach(productGroup => {
    productsTotal += (parseFloat(productGroup.get('lineTotal')?.value) || 0);
    totalTax += (parseFloat(productGroup.get('taxAmount')?.value) || 0);
  });

  const shippingCharges = parseFloat(this.purchaseForm.get('shippingCharges')?.value) || 0;
  this.netTotalAmount = productsTotal + shippingCharges;
  this.totalTax = totalTax;

  // Calculate rounded total and round off amount
  const roundedTotal = Math.round(this.netTotalAmount);
  const roundOffAmount = roundedTotal - this.netTotalAmount;

  // Get the current payment amount or default to 0
  const paymentAmount = parseFloat(this.purchaseForm.get('paymentAmount')?.value) || 0;
  
  // Calculate the new balance (paymentDue)
  const paymentDue = Math.max(0, this.netTotalAmount - paymentAmount);

  this.purchaseForm.patchValue({
    purchaseTotal: this.netTotalAmount,
    totalPayable: roundedTotal,
    roundOffAmount: roundOffAmount.toFixed(2),
    roundedTotal: roundedTotal.toFixed(2),
    totalTax: totalTax,
    paymentDue: paymentDue.toFixed(2),  // Update paymentDue
    balance: paymentDue.toFixed(2)      // Also update balance to match
  });
}

  loadBusinessLocations(): void {
    this.locationService.getLocations().subscribe(
      (locations) => {
        this.businessLocations = locations;
      },
      (error) => {
        console.error('Error loading business locations:', error);
      }
    );
  }

  loadSuppliers(): void {
    this.supplierService.getSuppliers().subscribe((suppliers) => {
      this.suppliers = (suppliers as unknown as Supplier[]).map(supplier => ({
        ...supplier,
      }));
    });
  }

  getSupplierDisplayName(supplier: Supplier): string {
    if (supplier.isIndividual) {
      return `${supplier.firstName || ''} ${supplier.lastName || ''}`.trim();
    }
    return supplier.businessName || '';
  }

  onSupplierChange(supplierId: string): void {
    const selectedSupplier = this.suppliers.find(s => s.id === supplierId);
    if (selectedSupplier) {
      this.selectedSupplier = selectedSupplier;
      this.purchaseForm.patchValue({
        supplierName: this.getSupplierDisplayName(selectedSupplier),
        address: selectedSupplier.addressLine1 || ''
      });
    }
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.purchaseForm.patchValue({ document: file.name });
    }
  }

updatePurchase() {
  if (this.purchaseId) {
    // Get the raw value to include disabled controls
    const formData = this.purchaseForm.getRawValue();
    
    // Format dates properly
    const formatDate = (date: any) => {
      if (!date) return null;
      return new Date(date).toISOString();
    };

    const purchaseData = {
      ...formData,
      products: formData.products.map((product: any, index: number) => {
        // Get the actual product name from productsList if not available
        const productFromList = this.productsList.find(p => p.id === product.productId);
        return {
          ...product,
          productId: product.productId,
          productName: product.productName || productFromList?.productName || `Product ${index + 1}`,
          quantity: Number(product.quantity) || 1,
          unitCost: Number(product.unitCost) || 0,
          discountPercent: Number(product.discountPercent) || 0,
          unitCostBeforeTax: Number(product.unitCostBeforeTax) || 0,
          subtotal: Number(product.subtotal) || 0,
          taxAmount: Number(product.taxAmount) || 0,
          lineTotal: Number(product.lineTotal) || 0,
          taxRate: Number(product.taxRate) || 0,
                paymentDue: Number(formData.paymentDue) || 0,

          batchNumber: product.batchNumber || '',
          expiryDate: product.expiryDate || ''
        };
      }),
      supplier: {
        id: formData.supplierId,
        name: formData.supplierName
      },
      totalItems: this.totalItems,
      netTotalAmount: this.netTotalAmount,
      totalTax: this.totalTax,
      balance: Number(formData.balance) || 0,
      totalPayable: Number(formData.roundedTotal) || Number(formData.totalPayable) || 0,
      shippingCharges: Number(formData.shippingCharges) || 0,
      updatedAt: new Date().toISOString(),
      id: this.purchaseId,
      // Format dates
      purchaseDate: formatDate(formData.purchaseDate),
      paidOn: formatDate(formData.paidOn),
      invoicedDate: formatDate(formData.invoicedDate),
      receivedDate: formatDate(formData.receivedDate),
      // Add other fields
      addedBy: formData.addedBy || {
        id: this.currentUser?.uid,
        name: this.currentUser?.displayName || this.currentUser?.email,
        email: this.currentUser?.email
      }
    };

    console.log('Submitting purchase data:', purchaseData); // For debugging

    this.purchaseService.updatePurchase(this.purchaseId, purchaseData)
      .then(() => {
        alert('Purchase Updated Successfully!');
        this.router.navigate(['/list-purchase']);
      })
      .catch(error => {
        console.error('Error updating purchase:', error);
        alert('Error updating purchase. Please try again.');
      });
  } else {
    alert('Purchase ID not found. Cannot update.');
  }
}

}