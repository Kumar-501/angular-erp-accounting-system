import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { PurchaseService } from '../services/purchase.service';
import { Router, ActivatedRoute } from '@angular/router';
import { SupplierService } from '../services/supplier.service';
import { LocationService } from '../services/location.service';
import { ProductsService } from '../services/products.service';
import { AuthService } from '../auth.service';
import { UserService } from '../services/user.service';
import { TaxService } from '../services/tax.service';
import { TaxRate } from '../tax/tax.model';
import { AccountService } from '../services/account.service';
import { GoodsService } from '../services/goods.service';
import { Supplier } from '../models/supplier.model';
import { StockService } from '../services/stock.service';

// Interface definitions
interface PaymentAccount {
  id: string;
  name: string;
  accountNumber?: string;
  accountType?: string;
}

interface GrnData {
  id: string;
  referenceNo: string;
  receivedDate: Date;
  products: GrnProduct[];
}

interface GrnProduct {
  productId: string;
  receivedQuantity: number;
  quantity?: number;
}

interface Product {
    id?: string;
    productId?: string;
    productName: string;
    sku: string;
    quantity: number;
    unitCost: number;
    discountPercent: number;
    unitCostBeforeTax: number;
    subtotal: number;
    taxAmount: number;
    lineTotal: number;
    netCost: number;
    batchNumber?: string;
    expiryDate: string;
    taxRate?: number;
    sellingPrice: number;
    marginPercentage: number;
    currentStock?: number;
    totalQuantity?: number;
    defaultPurchasePriceIncTax?: number;
    defaultPurchasePriceExcTax?: number;
    unitPurchasePrice?: number;
    taxPercentage?: number;
    defaultSellingPriceIncTax?: number;
    defaultSellingPriceExcTax?: number;
    unitSellingPrice?: number;
}

@Component({
  selector: 'app-edit-purchase',
  templateUrl: './edit-purchase.component.html',
  styleUrls: ['./edit-purchase.component.scss']
})
export class EditPurchaseComponent implements OnInit {
  purchaseForm!: FormGroup;
  suppliers: Supplier[] = [];
  filteredSuppliers: Supplier[] = [];
  businessLocations: any[] = [];
  selectedSupplier: Supplier | null = null;
  totalItems = 0;
  netTotalAmount = 0;
  
  searchTerm: string = '';
  searchResults: Product[] = [];
  showSearchResults: boolean = false;
  
  users: any[] = [];
  productsList: any[] = [];
  purchaseId: string | null = null;
  currentUser: any = null;
  isLoading = true;
  isSaving = false;
 
  productsOnlyTotal = 0; // ✅ ADD THIS NEW PROPERTY
  
  originalAddedBy: any = null;
  
  selectedProducts: Set<number> = new Set<number>();
  taxRates: TaxRate[] = [];
  paymentAccounts: any[] = [];

  grnData: GrnData[] = [];
  showGrnSummary: boolean = false;
  isLoadingGrnData: boolean = false;

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
    private accountService: AccountService,
    private goodsService: GoodsService,
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadInitialData();

    this.route.paramMap.subscribe(params => {
      this.purchaseId = params.get('id');
      if (this.purchaseId) {
        this.loadPurchaseData(this.purchaseId);
      } else {
        this.isLoading = false;
        alert('No purchase ID provided.');
        this.router.navigate(['/list-purchase']);
      }
    });
  }

  async loadInitialData() {
      this.getCurrentUser();
      await Promise.all([
          this.loadSuppliers(),
          this.loadBusinessLocations(),
          this.loadProducts(),
          this.loadUsers(),
          this.loadTaxRates(),
          this.loadPaymentAccounts()
      ]);
  }
  
   initForm(): void {
    this.purchaseForm = this.fb.group({
      supplierId: ['', Validators.required],
      supplierName: [''],
      address: [{value: '', disabled: true}],
      referenceNo: [{value: '', disabled: true}, Validators.required],
      purchaseDate: [new Date().toISOString().substring(0, 10), Validators.required],
      purchaseStatus: ['Received', Validators.required],
      businessLocation: ['', Validators.required],
      paymentStatus: ['due'],
      purchaseOrderId: [{value: '', disabled: true}],
      document: [null],
      additionalNotes: [''],
      
      // ✅ ADD THESE NEW SHIPPING FIELDS
      shippingChargesBeforeTax: [0, [Validators.min(0)]],
      shippingTaxRate: [0],
      shippingTaxAmount: [0],

shippingCharges: [0, [Validators.min(0)]],      
      products: this.fb.array([], Validators.required),
      
      paymentAmount: [0, [Validators.required, Validators.min(0)]],
      paidOn: [new Date().toISOString().substring(0, 10), Validators.required],
      paymentMethod: ['', Validators.required],
      paymentAccount: ['', Validators.required],
      paymentNote: [''],
      
      purchaseTotal: [0],
      balance: [0],
      totalPayable: [0],
      roundedTotal: [0],

      invoiceNo: [''],
      invoicedDate: [''],
      receivedDate: [''],
      
      addedBy: this.fb.group({ id: [''], name: [''], email: [''] }),
    });
  }

  async loadPurchaseData(purchaseId: string): Promise<void> {
    try {
      const purchaseData = await this.purchaseService.getPurchaseById(purchaseId);
      if (purchaseData) {
        this.originalAddedBy = purchaseData.addedBy; // Store original 'addedBy' data
        await this.prefillForm(purchaseData);
        if (purchaseData.referenceNo) {
          await this.loadGrnDataForPurchaseOrder(purchaseData.referenceNo);
        }
      } else {
        alert('Purchase not found.');
        this.router.navigate(['/list-purchase']);
      }
    } catch (err) {
      console.error('Error loading purchase:', err);
      this.router.navigate(['/list-purchase']);
    } finally {
      this.isLoading = false;
    }
  }

 async prefillForm(data: any): Promise<void> {
    await this.loadSuppliers();
    
    this.selectedSupplier = this.suppliers.find(s => s.id === data.supplierId) || null;

    let addedByName = 'N/A';
    if (data.addedBy) {
      if (typeof data.addedBy === 'string') {
        addedByName = data.addedBy;
      } else if (typeof data.addedBy === 'object' && data.addedBy.name) {
        addedByName = data.addedBy.name;
      }
    }

    this.purchaseForm.patchValue({
      supplierId: data.supplierId || '',
      supplierName: data.supplierName || (this.selectedSupplier ? this.getSupplierDisplayName(this.selectedSupplier) : ''),
      address: data.address || (this.selectedSupplier ? this.selectedSupplier.addressLine1 : ''),
      referenceNo: data.referenceNo || '',
      purchaseOrderId: data.purchaseOrderId || '',
      purchaseDate: this.formatDateForInput(data.purchaseDate),
      purchaseStatus: data.purchaseStatus || 'Received',
      businessLocation: data.businessLocation || '',
      paymentStatus: data.paymentStatus || 'due',
      additionalNotes: data.additionalNotes || '',
      
      // ✅ ADD THESE SHIPPING FIELDS
      shippingChargesBeforeTax: data.shippingChargesBeforeTax || 0,
      shippingTaxRate: data.shippingTaxRate || 0,
      shippingTaxAmount: data.shippingTaxAmount || 0,
      shippingCharges: data.shippingCharges || 0,
      
      paymentAmount: data.paymentAmount || 0,
      paidOn: this.formatDateForInput(data.paidOn),
      paymentMethod: data.paymentMethod || '',
      paymentAccount: data.paymentAccount?.id || '',
      paymentNote: data.paymentNote || '',

      invoiceNo: data.invoiceNo || '',
      invoicedDate: this.formatDateForInput(data.invoicedDate),
      receivedDate: this.formatDateForInput(data.receivedDate),
      
      addedBy: { name: addedByName }
    });

    this.productsFormArray.clear();
    if (data.products && data.products.length > 0) {
      data.products.forEach((product: any) => this.addProductFromData(product));
    }

    this.calculateTotals();
  }


  addProductFromData(product: any): void {
    const productGroup = this.fb.group({
        productId: [product.productId || '', Validators.required],
        productName: [product.productName || ''],
        quantity: [product.quantity || 1, [Validators.required, Validators.min(1)]],
        unitCostBeforeTax: [product.unitCostBeforeTax || 0, [Validators.required, Validators.min(0)]],
        discountPercent: [product.discountPercent || 0],
        sellingPrice: [product.sellingPrice || 0],
        marginPercentage: [product.marginPercentage || 0],
        taxRate: [product.taxRate || 0],
        taxAmount: [product.taxAmount || 0],
        netCost: [product.netCost || 0],
        batchNumber: [product.batchNumber || ''],
        expiryDate: [this.formatDateForInput(product.expiryDate) || ''],
        subtotal: [product.subtotal || 0],
        lineTotal: [product.lineTotal || 0],
    });
    this.productsFormArray.push(productGroup);
  }
  
  formatDateForInput(date: any): string {
    if (!date) return '';
    try {
      const dateObj = (date.toDate) ? date.toDate() : new Date(date);
      return dateObj.toISOString().split('T')[0];
    } catch (e) {
      return '';
    }
  }

  loadUsers(): Promise<void> { return new Promise(resolve => this.userService.getUsers().subscribe(users => { this.users = users; resolve(); }));}
  loadTaxRates(): Promise<void> { return new Promise(resolve => this.taxService.getTaxRates().subscribe(rates => { this.taxRates = rates.sort((a,b)=>a.rate-b.rate); resolve(); }));}
  loadPaymentAccounts(): Promise<void> { return new Promise(resolve => this.accountService.getAccounts(accs => { this.paymentAccounts = accs; resolve();}));}
  loadBusinessLocations(): Promise<void> { return new Promise(resolve => this.locationService.getLocations().subscribe(locs => { this.businessLocations = locs; resolve();}));}
  loadProducts(): Promise<void> { return new Promise(resolve => this.productsService.getProductsRealTime().subscribe(prods => { this.productsList = prods; resolve();}));}
  
  async loadSuppliers(): Promise<void> {
    return new Promise(resolve => {
        if (this.suppliers.length > 0) return resolve();
        this.supplierService.getSuppliers().subscribe((suppliers: Supplier[]) => {
          this.suppliers = suppliers.sort((a, b) => this.getSupplierDisplayName(a).localeCompare(this.getSupplierDisplayName(b)));
          this.filteredSuppliers = [...this.suppliers];
          resolve();
        });
    });
  }

  getCurrentUser(): void { this.authService.getCurrentUser().subscribe(user => { if (user) this.currentUser = user; }); }

  get productsFormArray(): FormArray { return this.purchaseForm.get('products') as FormArray; }

  filterSuppliers(event: any): void {
    const searchTerm = event.target.value.toLowerCase();
    this.filteredSuppliers = !searchTerm ? [...this.suppliers] : this.suppliers.filter(s => this.getSupplierDisplayName(s).toLowerCase().includes(searchTerm) || s.email?.toLowerCase().includes(searchTerm));
  }

  selectSupplier(supplier: Supplier): void {
    this.selectedSupplier = supplier;
    this.purchaseForm.patchValue({
      supplierId: supplier.id,
      supplierName: this.getSupplierDisplayName(supplier),
      address: supplier.addressLine1 || ''
    });
  }

  getSupplierDisplayName(supplier: Supplier): string {
    if (!supplier) return '';
    return supplier.isIndividual ? `${supplier.firstName || ''} ${supplier.lastName || ''}`.trim() : supplier.businessName || '';
  }
  
  getUnitPriceAfterTax(index: number): number {
    const productFormGroup = this.productsFormArray.at(index) as FormGroup;
    const unitPriceBeforeTax = parseFloat(productFormGroup.get('unitCostBeforeTax')?.value) || 0;
    const taxRate = parseFloat(productFormGroup.get('taxRate')?.value) || 0;
    const taxAmount = unitPriceBeforeTax * (taxRate / 100);
    return unitPriceBeforeTax + taxAmount;
  }
  
  // ======================= THE FIX (START) =======================
  /**
   * Calculates all totals for a single product line, ensuring that the
   * final line total is consistent with the visually rounded unit price after tax.
   * This prevents rounding discrepancies for the user.
   * @param index The index of the product in the FormArray.
   */
  calculateLineTotal(index: number): void {
    const productFormGroup = this.productsFormArray.at(index) as FormGroup;

    const quantity = parseFloat(productFormGroup.get('quantity')?.value) || 0;
    const unitPriceBeforeTax = parseFloat(productFormGroup.get('unitCostBeforeTax')?.value) || 0;
    const discountPercent = parseFloat(productFormGroup.get('discountPercent')?.value) || 0;
    const taxRate = parseFloat(productFormGroup.get('taxRate')?.value) || 0;

    const discountedUnitPriceBeforeTax = unitPriceBeforeTax * (1 - (discountPercent / 100));
    const unitPriceAfterTax = discountedUnitPriceBeforeTax * (1 + (taxRate / 100));
    const roundedUnitPriceAfterTax = parseFloat(unitPriceAfterTax.toFixed(2));
    const lineTotal = roundedUnitPriceAfterTax * quantity;
    const subtotalBeforeTax = lineTotal / (1 + (taxRate / 100));
    const taxAmount = lineTotal - subtotalBeforeTax;

    productFormGroup.patchValue({
      subtotal: parseFloat(subtotalBeforeTax.toFixed(2)),
      taxAmount: parseFloat(taxAmount.toFixed(2)),
      lineTotal: parseFloat(lineTotal.toFixed(2)),
      netCost: parseFloat(discountedUnitPriceBeforeTax.toFixed(2))
    }, { emitEvent: false });
    
    this.calculateTotals();
  }
  // ======================= THE FIX (END) =======================

  calculateMargin(index: number): void {
      const group = this.productsFormArray.at(index);
      const sellingPrice = parseFloat(group.get('sellingPrice')?.value) || 0;
      const effectiveCost = parseFloat(group.get('unitCostBeforeTax')?.value) * (1 - (parseFloat(group.get('discountPercent')?.value) || 0) / 100);
      let margin = 0;
      if (effectiveCost > 0 && sellingPrice > effectiveCost) {
          margin = ((sellingPrice - effectiveCost) / effectiveCost) * 100;
      }
      group.patchValue({ marginPercentage: parseFloat(margin.toFixed(2)) }, { emitEvent: false });
  }

calculateTotals(): void {
    this.totalItems = this.productsFormArray.length;
    
    // 1. Calculate the total from products only
    let productsOnlyTotal = 0;
    this.productsFormArray.controls.forEach(g => { 
      productsOnlyTotal += parseFloat(g.get('lineTotal')?.value) || 0; 
    });
    
    // Store products-only total separately
    this.productsOnlyTotal = parseFloat(productsOnlyTotal.toFixed(2));

    // 2. Calculate shipping charges
    const shippingChargesBeforeTax = parseFloat(this.purchaseForm.get('shippingChargesBeforeTax')?.value) || 0;
    const shippingTaxRate = parseFloat(this.purchaseForm.get('shippingTaxRate')?.value) || 0;
    const shippingTaxAmount = shippingChargesBeforeTax * (shippingTaxRate / 100);
    const totalShippingCharges = shippingChargesBeforeTax + shippingTaxAmount;
    
    // 3. Calculate net total (products + shipping)
    this.netTotalAmount = parseFloat((productsOnlyTotal + totalShippingCharges).toFixed(2));
    
    const roundedTotal = Math.round(this.netTotalAmount);
    
    this.purchaseForm.patchValue({
      purchaseTotal: this.netTotalAmount,
      totalPayable: roundedTotal,
      roundedTotal: roundedTotal,
      shippingTaxAmount: parseFloat(shippingTaxAmount.toFixed(2)),
      shippingCharges: parseFloat(totalShippingCharges.toFixed(2))
    }, { emitEvent: false });
    
    this.calculatePaymentBalance();
  }
calculateBeforeTaxFromAfterTax(): void {
    const shippingChargesAfterTax = parseFloat(this.purchaseForm.get('shippingCharges')?.value) || 0;
    const shippingTaxRate = parseFloat(this.purchaseForm.get('shippingTaxRate')?.value) || 0;
  
    let shippingChargesBeforeTax = shippingChargesAfterTax;
  
    if (shippingTaxRate > 0) {
      shippingChargesBeforeTax = shippingChargesAfterTax / (1 + (shippingTaxRate / 100));
    }
  
    this.purchaseForm.patchValue({
      shippingChargesBeforeTax: parseFloat(shippingChargesBeforeTax.toFixed(2))
    }, { emitEvent: false });
  
    this.calculateTotals();
  }


  calculatePaymentBalance(): void {
    const totalPayable = this.purchaseForm.get('totalPayable')?.value || 0;
    const paymentAmount = this.purchaseForm.get('paymentAmount')?.value || 0;
    const balance = Math.max(0, totalPayable - paymentAmount);
    let status = 'due';
    if (paymentAmount >= totalPayable) status = 'paid';
    else if (paymentAmount > 0) status = 'partial';
    this.purchaseForm.patchValue({ balance: balance, paymentStatus: status }, { emitEvent: false });
  }

  onSearchInput(event: any): void { this.searchTerm = event.target.value; if (this.searchTerm.length > 1) { this.searchResults = this.productsList.filter(p => p.productName.toLowerCase().includes(this.searchTerm.toLowerCase()) || (p.sku && p.sku.toLowerCase().includes(this.searchTerm.toLowerCase()))); this.showSearchResults = true; } else { this.showSearchResults = false; } }
  addProductFromSearch(product: Product): void { this.addProductToTable(product); this.clearSearch(); }
  clearSearch(): void { this.searchTerm = ''; this.showSearchResults = false; }
  onSearchFocus(): void { if (this.searchTerm) this.showSearchResults = true; }
  onSearchBlur(): void { setTimeout(() => this.showSearchResults = false, 150); }
  highlightMatch(text: string, term: string): string { return !text || !term ? text || '' : text.replace(new RegExp(`(${term})`, 'gi'), '<mark>$1</mark>'); }
  navigateToAddSupplier(): void { this.router.navigate(['/suppliers']); }
  onFileSelected(event: any): void { if (event.target.files[0]) this.purchaseForm.patchValue({ document: event.target.files[0].name }); }
  removeProduct(index: number): void { this.productsFormArray.removeAt(index); this.calculateTotals(); }
  toggleSelectAll(event: any): void { this.selectedProducts.clear(); if (event.target.checked) this.productsFormArray.controls.forEach((_, i) => this.selectedProducts.add(i)); }
  toggleProductSelection(index: number): void { this.selectedProducts.has(index) ? this.selectedProducts.delete(index) : this.selectedProducts.add(index); }
  isProductSelected(index: number): boolean { return this.selectedProducts.has(index); }
  deleteSelectedProducts(): void { if (this.selectedProducts.size === 0) { alert('No products selected.'); return; } if (confirm(`Delete ${this.selectedProducts.size} selected products?`)) { Array.from(this.selectedProducts).sort((a,b) => b-a).forEach(i => this.productsFormArray.removeAt(i)); this.selectedProducts.clear(); this.calculateTotals(); } }
  
  addProductToTable(product: Product): void { 
    const productGroup = this.fb.group({
        productId: [product.id || '', Validators.required],
        productName: [product.productName],
        quantity: [1, [Validators.required, Validators.min(1)]],
        unitCostBeforeTax: [product.defaultPurchasePriceExcTax || 0, [Validators.required, Validators.min(0)]],
        discountPercent: [0],
        sellingPrice: [product.defaultSellingPriceIncTax || 0],
        marginPercentage: [product.marginPercentage || 0],
        taxRate: [product.taxPercentage || 0],
        taxAmount: [0], netCost: [0], batchNumber: [''], expiryDate: [''], subtotal: [0], lineTotal: [0]
    });
    this.productsFormArray.push(productGroup);
    const newIndex = this.productsFormArray.length - 1;
    this.calculateLineTotal(newIndex);
    this.calculateMargin(newIndex);
  }

  onProductSelect(index: number): void { 
      const productFormGroup = this.productsFormArray.at(index);
      const productId = productFormGroup.get('productId')?.value;
      const product = this.productsList.find(p => p.id === productId);
      if(product) {
          productFormGroup.patchValue({
              unitCostBeforeTax: product.defaultPurchasePriceExcTax || 0,
              taxRate: product.taxPercentage || 0,
              sellingPrice: product.defaultSellingPriceIncTax || 0,
              marginPercentage: product.marginPercentage || 0,
          });
          this.calculateLineTotal(index);
          this.calculateMargin(index);
      }
  }

  getTotalReceivedQuantityForGrn(grn: GrnData): number { return grn.products?.reduce((total: number, p: GrnProduct) => total + (p.receivedQuantity || p.quantity || 0), 0) || 0; }

  async loadGrnDataForPurchaseOrder(purchaseOrderRef: string): Promise<void> {
    if (!purchaseOrderRef) return;
    this.isLoadingGrnData = true;
    this.goodsService.getAllGoodsReceived().subscribe(allGrn => {
        this.grnData = allGrn
          .filter(grn => grn['purchaseReferenceNo'] === purchaseOrderRef)
          .map(grn => ({
            id: grn['id'],
            referenceNo: grn['referenceNo'],
            receivedDate: grn['receivedDate']?.toDate(),
            products: grn['products']
          }));
        this.showGrnSummary = this.grnData.length > 0;
        this.isLoadingGrnData = false;
    });
  }

   async updatePurchase(): Promise<void> {
    this.markFormGroupTouched(this.purchaseForm);
    if (this.purchaseForm.invalid) {
      alert('Please fill all required fields correctly.');
      return;
    }
    if (!this.purchaseId) {
        alert('Purchase ID is missing!');
        return;
    }
    
    this.isSaving = true;
    try {
        const formValue = this.purchaseForm.getRawValue();
        const selectedAccount = this.paymentAccounts.find(acc => acc.id === formValue.paymentAccount);
        
        let productsSubtotal = 0;
        let totalTax = 0;
        const products = formValue.products.map((p: any) => {
            const lineTotalBeforeTax = (p.quantity * p.unitCostBeforeTax) * (1 - (p.discountPercent / 100));
            const taxAmount = lineTotalBeforeTax * (p.taxRate / 100);
            productsSubtotal += lineTotalBeforeTax;
            totalTax += taxAmount;
            return { ...p, subtotal: lineTotalBeforeTax, taxAmount, lineTotal: lineTotalBeforeTax + taxAmount };
        });

        const shippingCharges = Number(formValue.shippingCharges) || 0;
        const preciseTotal = productsSubtotal + totalTax + shippingCharges;

        const purchaseData = {
          ...formValue,
          supplierId: this.selectedSupplier?.id || '',
          supplier: this.getSupplierDisplayName(this.selectedSupplier as Supplier),
          supplierName: this.getSupplierDisplayName(this.selectedSupplier as Supplier),
          products: products,
          productsSubtotal: parseFloat(productsSubtotal.toFixed(2)),
          totalTax: parseFloat(totalTax.toFixed(2)),
          grandTotal: formValue.totalPayable, // Rounded total
          purchaseTotal: parseFloat(preciseTotal.toFixed(2)), // Precise total
          paymentAccount: selectedAccount ? { id: selectedAccount.id, name: selectedAccount.name } : null,
          paidOn: new Date(formValue.paidOn),
          purchaseDate: new Date(formValue.purchaseDate),
          addedBy: this.originalAddedBy,
        };

        await this.purchaseService.updatePurchase(this.purchaseId, purchaseData);
        alert('Purchase updated successfully!');
        this.router.navigate(['/list-purchase']);
    } catch (error) {
        console.error('Error updating purchase:', error);
        alert('Failed to update purchase. See console for details.');
    } finally {
        this.isSaving = false;
    }
  }

  
  private markFormGroupTouched(formGroup: FormGroup | FormArray): void {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      if (control instanceof FormGroup || control instanceof FormArray) {
        this.markFormGroupTouched(control);
      }
    });
  }
}