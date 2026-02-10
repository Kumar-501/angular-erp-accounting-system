import { ChangeDetectorRef, Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { SaleService } from '../services/sale.service';
import { Router, ActivatedRoute } from '@angular/router';
import { DatePipe } from '@angular/common';
import { CustomerService } from '../services/customer.service';
import { ProductsService } from '../services/products.service';
import { LocationService } from '../services/location.service';
import { TypeOfServiceService, Service } from '../services/type-of-service.service';
import { UserService } from '../services/user.service';
import { CommissionService } from '../services/commission.service';
import { LeadService } from '../services/leads.service';
import { TaxService } from '../services/tax.service';
import { TaxRate, TaxGroup } from '../tax/tax.model';
import { AccountService } from '../services/account.service';
import { switchMap } from 'rxjs/operators';
import { AuthService } from '../auth.service';
import * as bootstrap from 'bootstrap';
import { ToastrService } from 'ngx-toastr';
import { getDocs, limit, query, where } from '@angular/fire/firestore';
import { CodPopupComponent } from "../cod-popup/cod-popup.component";
import { defaultIfEmpty, lastValueFrom } from 'rxjs';;
import { StockService } from '../services/stock.service';


interface Product {
  id?: string;
  name: string;
    discountPercentage?: number;
  discountAmount?: number;
  productName?: string;
  sku?: string;
  discountType: 'Amount' | 'Percentage'; 
  barcode?: string;
  stockByLocation?: { [locationId: string]: number };
  totalQuantity?: number;
  manageStock?: boolean; 
  taxType?: string;
  cgstAmount?: number;
    taxRateObject?: TaxRate | null; // <-- ADD THIS PROPERTY

  sgstAmount?: number;
  igstAmount?: number;
  lastNumber?: string;
  lastNumbers?: string[];
  isCombination?: boolean;
  isComponent?: boolean;
  parentCombinationId?: string;
  componentQuantity?: number;
  combinationProducts?: {
    productId: string;
    name: string;
    quantity: number;
    unitPrice: number;
  }[];
  currentStock?: number;
  defaultSellingPriceExcTax?: number;
  defaultSellingPriceIncTax?: number;
  batchNumber?: string;
  expiryDate?: string;
  batches?: {
    batchNumber: string;
    expiryDate: string;
    quantity: number;
    lastNumber?: string;
    lastNumbers?: string[];
    batches?: {
      batchNumber: string;
      expiryDate: string;
      quantity: number;
    }[];
  }[];
  taxRate?: number;
  taxAmount?: number;
  quantity: number;
  unitPrice: number;
  discount: number;
  commissionPercent?: number;
  commissionAmount?: number;
  subtotal: number;
  priceBeforeTax: number;
  taxIncluded: boolean;
}

interface Medicine {
  name: string;
  type: string;
  dosage?: string;
  instructions?: string;
  instructions1?: string;
  instructions2?: string;
  ingredients?: string;
  pills?: string;
  powder?: string;
  time: string;
  frequency?: string;
  timing?: string;
  quantity?: string;
  combinationName?: string; // For kashayam combination
  combinationQuantity?: string; // For kashayam combination
  [key: string]: any;
}

// Define the PrescriptionData interface
interface PrescriptionData {
  patientName: any;
  date: string;
  medicines: Medicine[];
  patientAge?: string;
  additionalNotes?: string;
}

@Component({
  selector: 'app-add-sale',
  templateUrl: './add-sale.component.html',
  styleUrls: ['./add-sale.component.scss'],
  providers: [DatePipe],
})
export class AddSaleComponent implements OnInit {
  saleForm!: FormGroup;
  @ViewChild('saleDatePicker') saleDatePicker!: ElementRef;
@ViewChild('paidOnDatePicker') paidOnDatePicker!: ElementRef;
@ViewChild('dobDatePicker') dobDatePicker!: ElementRef;
  todayDate: string;
  products: Product[] = [];
  lastInteractionTime = 0;
  showProductsInterestedDropdown = false;
  
  productInterestedSearch = '';
  allProductsSelected: boolean = false;
// Add this at the top of your component class
isSubmitting = false;
  filteredProductsForInterested: any[] = [];
  selectedCustomer: any = null;

  prescriptions: PrescriptionData[] = [];
editingPrescriptionIndex: number | null = null;
  currentPrescriptionModal: any;
  discount: number | undefined;
  discountType: 'Amount' | 'Percentage' | undefined; 
  selectedProductsForInterested: any[] = [];
  selectedPaymentAccount: any = null;
  isFromLead: boolean = false;
  taxAmount: number = 0;
  selectedMedicineName: string = '';

// Add this in your component class
availableTaxRates: TaxRate[] = [];
// Add this with your other component properties
currentCustomerForPrescription: { name: string; age: string | null } = { name: '', age: null };
  shippingDocuments: File[] = [];
afterTaxShippingControl: FormControl<number | null> = new FormControl<number | null>(null);
productsCollection: any; // You should replace 'any' with the correct type
  showTransactionIdField = false;
  selected?: boolean; // Add this property
  leadIdToDelete: string | null = null;
  dropdownFilterFocused = false;
  availableTaxGroups: (TaxGroup & { calculatedRate: number })[] = [];
  allProducts: any[] = [];
  filteredProducts: any[] = [];
  customers: any[] = [];
  currentDate = new Date();
  Date = Date; 
  showCustomerEditPopup = false;

// In your component class

prescriptionData: PrescriptionData = {
  medicines: [{
    name: '',
    dosage: '',
    instructions: '',
    ingredients: '',
    pills: '',
    powder: '',
    time: '',
    type: ''
  }],
  patientName: undefined,
  date: ''
};



selectedCustomerForEdit: any = null;
  users: any[] = [];
  dropdownClosing = false;
  totalCommission: number = 0;
  businessLocations: any[] = [];
  showCodPopup = false;
codData: any = null;
  serviceTypes: Service[] = [];
  latestInvoiceNumber: number = 0;
  productSearchTerm: string = '';
  isFromQuotation: boolean = false;
  currentUser: string = '';
  selectedMedicineType: string = '';

  customerSearchInput: string = '';
  showCustomerDropdown: boolean = false;
  paymentAccounts: any[] = [];
  showPpServicePopup = false;
ppServiceData: any = null;
  searchTerm: string = '';


searchResults: Product[] = [];
showSearchResults: boolean = false;
// Add these to your component class
filterOptions = {
  inStockOnly: false,
  priceRange: {
    min: 0,
    max: 10000
  }
};

private searchTimeout: any;

private closeDropdownTimeout: any;



defaultProduct: Product = {
  name: '',
  quantity: 1,
  unitPrice: 0,
  discount: 0,
  subtotal: 0,
  commissionPercent: 0,
  commissionAmount: 0,
  priceBeforeTax: 0,
  taxIncluded: false,
  discountType: 'Amount',
  batchNumber: '',
  lastNumber: '',
  lastNumbers: [],
  batches: [],
  taxRate: 0,
  taxAmount: 0,
  cgstAmount: 0,
  sgstAmount: 0,
  igstAmount: 0,
  taxType: ''
};
  itemsTotal: number = 0;
  filteredCustomers: any[] = [];
availableMedicines: any;

  constructor(
    private fb: FormBuilder,
    private saleService: SaleService,
    private router: Router,
      private leadService: LeadService, // Add this line

    private route: ActivatedRoute,
    private datePipe: DatePipe,
    private customerService: CustomerService,
    private productService: ProductsService,
    private accountService: AccountService,

    private locationService: LocationService,
    private userService: UserService,
    private typeOfServiceService: TypeOfServiceService,
    private commissionService: CommissionService,
    private taxService: TaxService,
    public authService: AuthService,  // Make it public to use in template
    private changeDetectorRef: ChangeDetectorRef,
    private toastr: ToastrService,
    private stockService: StockService




  ) {
    this.todayDate = this.datePipe.transform(new Date(), 'yyyy-MM-dd') || '';
    this.currentUser = this.getCurrentUser();
    this.checkForLeadData();

  }
 onTaxSelect(index: number): void {
  // The selected object is already bound via ngModel
  // This triggers the update which calculates taxes
  this.updateProduct(index);
}

  private showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  const toastOptions = {
    timeOut: 5000,
    progressBar: true,
    closeButton: true
  };

  switch(type) {
    case 'success':
      this.toastr.success(message, 'Success', toastOptions);
      break;
    case 'error':
      this.toastr.error(message, 'Error', toastOptions);
      break;
    default:
      this.toastr.info(message, 'Info', toastOptions);
  }
  }
// src/app/add-sale/add-sale.component.ts

private async generateInvoiceNumber(): Promise<string> {
  try {
    // 1. Get the highest current numeric value from the service
    const latestValue = await this.saleService.getLatestInabNumericValue();
    
    // 2. Increment by 1
    const nextValue = latestValue + 1;
    
    // 3. Format with leading zeros (4 digits)
    // .padStart(4, '0') turns 1 into "0001", 12 into "0012", etc.
    const formattedNumber = nextValue.toString().padStart(4, '0');
    
    return `INAB${formattedNumber}`;
  } catch (error) {
    console.error('Error generating invoice number:', error);
    // Fallback if something fails
    return `INAB0001`;
  }
}
async getProductByName(productName: string): Promise<Product | null> {
  try {
    const q = query(
      this.productsCollection, 
      where("productName", "==", productName),
      limit(1)
    );
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const productData = querySnapshot.docs[0].data() as Product; // Cast to Product type
      return {
        id: querySnapshot.docs[0].id,
        ...productData,
        lastNumber: productData.lastNumber || ''
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting product by Name:', error);
    throw error;
  }
}
  private getFieldLabel(fieldName: string): string {
  // Map form control names to user-friendly labels
  const fieldLabels: {[key: string]: string} = {
    'customer': 'Customer',
    'businessLocation': 'Business Location',
    'saleDate': 'Sale Date',
    'addedBy': 'Sales Agent',
    'paymentMethod': 'Payment Method',
    'paymentAccount': 'Payment Account'
    // Add more fields as needed
  };
  
  return fieldLabels[fieldName] || fieldName;
  }
  
  debugCustomerPhones() {
    console.group('Customer Phone Data');
    this.customers.forEach(customer => {
      console.log({
        name: customer.displayName,
        id: customer.id,
        mobile: customer.mobile,
        phone: customer.phone,
        altContact: customer.alternateContact
      });
    });
    console.groupEnd();
  }
calculateItemsTotal(): void {
  // Sum up all row subtotals
  this.itemsTotal = this.products.reduce((sum, product) => sum + (product.subtotal || 0), 0);
  
  // Sum up all commissions
  this.totalCommission = this.products.reduce((sum, product) => sum + (product.commissionAmount || 0), 0);
}

calculateBalance(): void {
  const totalPayable = this.saleForm.get('totalPayable')?.value || 0; // This is now 785
  const paymentAmount = this.saleForm.get('paymentAmount')?.value || 0;

  if (paymentAmount > totalPayable) {
    this.saleForm.patchValue({
      changeReturn: parseFloat((paymentAmount - totalPayable).toFixed(2)),
      balance: 0
    }, { emitEvent: false });
  } else {
    this.saleForm.patchValue({
      changeReturn: 0,
      balance: parseFloat((totalPayable - paymentAmount).toFixed(2))
    }, { emitEvent: false });
  }
}

private checkForLeadData(): void {
  // First check navigation state
  const navigation = this.router.getCurrentNavigation();
  const state = navigation?.extras?.state as {fromLead: boolean, leadData: any};
  
  if (state?.fromLead) {
    console.log('Lead data from navigation state:', state.leadData);
    this.prefillFromLead(state.leadData);
    this.isFromLead = true;
    this.leadIdToDelete = state.leadData.leadId;
    return;
  }

  // Then check local storage as fallback
  const leadData = localStorage.getItem('convertedLeadForSale');
  if (leadData) {
    try {
      console.log('Lead data from localStorage:', leadData);
      const parsedData = JSON.parse(leadData);
      this.prefillFromLead(parsedData);
      this.isFromLead = true;
      this.leadIdToDelete = parsedData.leadId;
      localStorage.removeItem('convertedLeadForSale');
    } catch (error) {
      console.error('Error parsing lead data:', error);
    }
  }
}


  // Add this to your component class
medicineTypes = [
    { value: 'kasayam', label: ' (കഷായം)' },
    { value: 'kasayam_combination', label: 'കഷായം ' }, // New type
    { value: 'buligha', label: ' (ഗുളിക)' },
    { value: 'bhasmam', label: ' (ഭസ്മം)' },
    { value: 'krudham', label: ' (ഘൃതം)' },
    { value: 'suranam', label: ' (ചൂർണ്ണം)' },
    { value: 'rasayanam', label: ' (രസായനം)' },
    { value: 'lagium', label: ' (ലേഹ്യം)' }
  ];

selectMedicineType(type: string): void {
  this.selectedMedicineType = type;
}

  getMedicineTypeName(type: string): string {
    const typeNames: {[key: string]: string} = {
      'kasayam': ' കഷായം',
      'kasayam_combination': 'കഷായം ',
      'buligha': 'ഗുളിക',
      'bhasmam': ' ഭസ്മം',
      'krudham': 'ഘൃതം',
      'suranam': 'ചൂർണ്ണം',
      'rasayanam': ' രസായനം',
      'lagium': ' ലേഹ്യം'
    };
    return typeNames[type] || 'Medicine';
  }

getTaxBreakdown(type: 'cgst' | 'sgst' | 'igst'): number {
  if (!this.products) return 0;
  
  return this.products.reduce((sum, product) => {
    switch(type) {
      case 'cgst': return sum + (product.cgstAmount || 0);
      case 'sgst': return sum + (product.sgstAmount || 0);
      case 'igst': return sum + (product.igstAmount || 0);
      default: return sum;
    }
  }, 0);
}


getTaxRate(type: 'cgst' | 'sgst' | 'igst'): number {
  // This assumes a standard GST rate - adjust based on your tax structure
  switch(type) {
    case 'cgst': return 9; // 9% CGST when total is 18%
    case 'sgst': return 9; // 9% SGST when total is 18%
    case 'igst': return 18; // 18% IGST
    default: return 0;
  }
}
addSameMedicineType(): void {
  if (!this.selectedMedicineType) return;

  // Find all medicines of the same type
  const sameTypeMedicines = this.prescriptionData.medicines.filter(med => med.type === this.selectedMedicineType);
  
  if (sameTypeMedicines.length === 0) {
    // If no medicines of this type exist, add a new one
    this.addMedicineByType();
    return;
  }

  // Get the last medicine of this type
  const lastMedicine = sameTypeMedicines[sameTypeMedicines.length - 1];
  
  // Create a deep copy of the medicine
  const newMedicine: Medicine = JSON.parse(JSON.stringify(lastMedicine));
  
  // Add the new medicine to the list
  this.prescriptionData.medicines.push(newMedicine);
  
  // Focus on the first field of the new medicine
  setTimeout(() => {
    const lastIndex = this.prescriptionData.medicines.length - 1;
    const firstField = document.getElementById(`medicineName_${lastIndex}`);
    if (firstField) {
      firstField.focus();
    }
  });
}

addMedicineByType(): void {
    if (!this.selectedMedicineType) return;

    const newMedicine: Medicine = {
      name: '',
      type: this.selectedMedicineType,
      time: 'രാവിലെ / ഉച്ചയ്ക്ക് / രാത്രി'
    };

    switch(this.selectedMedicineType) {
      case 'kasayam':
        newMedicine.instructions = '';
        newMedicine.quantity = '';
        newMedicine.powder = '';
        newMedicine.pills = '';
        newMedicine.frequency = '';
        break;
      case 'kasayam_combination': // New case for combination
        newMedicine.instructions = '';
        newMedicine.quantity = '';
        newMedicine.combinationName = '';
        newMedicine.combinationQuantity = '';
        newMedicine.frequency = '';
        break;
      case 'buligha':
        newMedicine.instructions = '';
        newMedicine.powder = '';
        break;
      case 'bhasmam':
        newMedicine.dosage = '';
        newMedicine.quantity = '';
        newMedicine.instructions = '';
        newMedicine.powder = '';
        break;
      case 'krudham':
        newMedicine.instructions = '';
        newMedicine.frequency = '';
        break;
      case 'suranam':
        newMedicine.instructions = '';
        newMedicine.powder = '';
        newMedicine.dosage = '';
        newMedicine.frequency = '';
        break;
      case 'rasayanam':
        newMedicine.instructions = '';
        break;
      case 'lagium':
        newMedicine.instructions = '';
        newMedicine.dosage = '';
        newMedicine.frequency = '';
        break;
    }

 this.prescriptionData.medicines.push(newMedicine);
    this.selectedMedicineType = '';
    
    setTimeout(() => {
      const lastIndex = this.prescriptionData.medicines.length - 1;
      const firstField = document.getElementById(`medicineName_${lastIndex}`);
      if (firstField) {
        firstField.focus();
      }
    });
  }



  addMedicine(): void {
  this.prescriptionData.medicines.push({
    name: '',
    dosage: '',
    instructions: '',
    ingredients: '',
    pills: '',
    powder: '',
    time: '',
    type: ''
  });




    setTimeout(() => {
    const lastIndex = this.prescriptionData.medicines.length - 1;
    const firstField = document.getElementById(`medicineName_${lastIndex}`);
    if (firstField) {
      firstField.focus();
    }
  });
}
removeMedicine(index: number): void {
  this.prescriptionData.medicines.splice(index, 1);
}

  
private prefillFromLead(leadData: any): void {
  const customerData = leadData.customerData;
  
  // Format the date of birth for the input field
  let formattedDob = '';
  if (customerData.dob || customerData.dateOfBirth) {
    const dobDate = customerData.dob || customerData.dateOfBirth;
    const dateObj = dobDate instanceof Date ? dobDate : new Date(dobDate);
    if (!isNaN(dateObj.getTime())) {
      formattedDob = this.datePipe.transform(dateObj, 'yyyy-MM-dd') || '';
    }
  }
  
  // Update the form with all customer details including demographics
  this.saleForm.patchValue({
    customer: customerData.id || '',
    customerName: customerData.displayName || 
                `${customerData.firstName || ''} ${customerData.lastName || ''}`.trim() ||
                customerData.businessName,
    customerPhone: customerData.mobile || customerData.phone || customerData.alternateContact || '',
    customerEmail: customerData.email || '',
    billingAddress: customerData.addressLine1 || '',
    shippingAddress: customerData.addressLine1 || '',
    alternateContact: customerData.alternateContact || '',
    // Include all demographic fields
    customerAge: customerData.age || null,
    customerDob: formattedDob,
    customerGender: customerData.gender || '',
    customerOccupation: customerData.occupation || '',
    creditLimit: customerData.creditLimit || 0,
    otherData: customerData.notes || '',
    sellNote: customerData.notes || '',
    assignedTo: customerData.assignedTo || customerData.assignedToId || '',
    // Additional address fields
    city: customerData.city || '',
    state: customerData.state || '',
    country: customerData.country || 'India',
    zipCode: customerData.zipCode || '',
    addressLine1: customerData.addressLine1 || '',
    addressLine2: customerData.addressLine2 || ''
  });
  
  // Update the customer search input
  this.customerSearchInput = customerData.displayName || 
                           `${customerData.firstName || ''} ${customerData.lastName || ''}`.trim() ||
                           customerData.businessName;
  
  // Prefill interested products if any
  if (customerData.productsInterested && customerData.productsInterested.length > 0) {
    this.selectedProductsForInterested = [...customerData.productsInterested];
  }
  
  // Force a customer search to find and select the matching customer
  if (customerData.mobile || customerData.phone) {
    setTimeout(() => {
      this.searchCustomerByPhone();
    }, 500);
  }
}
addNewPrescription(): void {
  // Reset the editing index
  this.editingPrescriptionIndex = null;
  
  // Reset prescription data but keep patient name if available
  this.prescriptionData = {
    medicines: [],
    patientName: this.saleForm.get('customerName')?.value || '',
    date: this.todayDate,
    additionalNotes: ''
  };
  
  // Open the modal
  this.openPrescriptionModal();
}
// Helper method to format date for input field
private formatDateForInput(dateString: string): string {
  if (!dateString) return '';
  
  try {
    // Handle both Date objects and string formats
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    return this.datePipe.transform(date, 'yyyy-MM-dd') || '';
  } catch {
    return '';
  }
}
// Converts internal date (any format) to DD-MM-YYYY for display
getFormattedDateForInput(dateString: any): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

// Helper to get YYYY-MM-DD for the hidden native date picker
getFormattedDate(dateValue: any): string {
  if (!dateValue) return '';
  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  } catch (e) {
    return '';
  }
}

// Triggers the hidden native date picker
openDatePicker(type: 'saleDate' | 'paidOn' | 'customerDob'): void {
  if (type === 'saleDate') this.saleDatePicker.nativeElement.showPicker();
  else if (type === 'paidOn') this.paidOnDatePicker.nativeElement.showPicker();
  else if (type === 'customerDob') this.dobDatePicker.nativeElement.showPicker();
}

// Handles manual typing in DD-MM-YYYY format
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
      
      // Store as YYYY-MM-DD for the reactive form
      const isoDate = `${year}-${month}-${day}`;
      this.saleForm.get(controlName)?.setValue(isoDate);
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
  event.target.value = this.getFormattedDateForInput(this.saleForm.get(controlName)?.value);
}
openPrescriptionModal(): void {
  // Reset if not editing
  if (this.editingPrescriptionIndex === null) {
    this.resetPrescriptionData();
    
    // Prefill with customer details if available
    const customerName = this.saleForm.get('customerName')?.value;
    const customerAge = this.saleForm.get('customerAge')?.value;
    
    if (customerName) {
      this.prescriptionData.patientName = customerName;
    }
    if (customerAge) {
      this.prescriptionData.patientAge = customerAge;
    }
    
    // Set date to today if not set
    if (!this.prescriptionData.date) {
      this.prescriptionData.date = this.todayDate;
    }
  }

  const modalElement = document.getElementById('prescriptionModal');
  if (modalElement) {
    // Remove any existing modal instances
    if (this.currentPrescriptionModal) {
      this.currentPrescriptionModal.dispose();
    }
    
    // Create new modal
    this.currentPrescriptionModal = new bootstrap.Modal(modalElement, {
      focus: true,
      keyboard: true,
      backdrop: 'static'
    });
    
    this.currentPrescriptionModal.show();
    
    // Update the form fields after modal is shown
    setTimeout(() => {
      this.updateFormFieldsFromPrescription();
    }, 100);
  }
}


// Updated method to handle content editable changes with proper field mapping
onContentEditableChange(event: any, field: string, index: number): void {
  const value = event.target.textContent || event.target.innerText || '';
  
  if (this.prescriptionData.medicines[index]) {
    // Map the field names correctly
    switch(field) {
      case 'name':
        this.prescriptionData.medicines[index].name = value;
        break;
      case 'instructions':
        this.prescriptionData.medicines[index].instructions = value;
        break;
      case 'pills':
        this.prescriptionData.medicines[index].pills = value;
        break;
      case 'powder':
        this.prescriptionData.medicines[index].powder = value;
        break;
      case 'time':
        this.prescriptionData.medicines[index].time = value;
        break;
      case 'dosage':
        this.prescriptionData.medicines[index].dosage = value;
        break;
      case 'quantity':
        this.prescriptionData.medicines[index].quantity = value;
        break;
      case 'frequency':
        this.prescriptionData.medicines[index].frequency = value;
        break;
      // Add specific fields for kasayam_combination
      case 'combinationName':
        this.prescriptionData.medicines[index].combinationName = value;
        break;
      case 'combinationQuantity':
        this.prescriptionData.medicines[index].combinationQuantity = value;
        break;
    }
  }
}



editPrescription(index: number): void {
  this.editingPrescriptionIndex = index;
  
  // Deep copy the prescription data
  this.prescriptionData = JSON.parse(JSON.stringify(this.prescriptions[index]));
  
  // Ensure patient name and date are set
  this.prescriptionData.patientName = this.prescriptionData.patientName || 
                                     this.saleForm.get('customerName')?.value || '';
  this.prescriptionData.date = this.prescriptionData.date || this.todayDate;
  
  // Open the modal
  this.openPrescriptionModal();
}



private setEditableField(id: string, value: string | undefined): void {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value || '';
  }
}

deletePrescription(index: number): void {
  if (confirm('Are you sure you want to delete this prescription?')) {
    this.prescriptions.splice(index, 1);
    this.showToast('Prescription deleted successfully!', 'success');
  }
}

private updateFormFieldsFromPrescription(): void {
  try {
    // Update patient name and date
    const patientNameElement = document.getElementById('patientName');
    if (patientNameElement) {
      patientNameElement.textContent = this.prescriptionData.patientName || '';
    }

    const patientAgeElement = document.getElementById('patientAge');
    if (patientAgeElement) {
      patientAgeElement.textContent = this.prescriptionData.patientAge || '';
    }

    // Update each medicine field
    this.prescriptionData.medicines.forEach((medicine, index) => {
      // Common fields
      this.setEditableField(`medicineName_${index}`, medicine.name);
      
      // Type-specific fields with CORRECTED field IDs to match template
      switch(medicine.type) {
        case 'kasayam':
          this.setEditableField(`kasayamName_${index}`, medicine.name);
          this.setEditableField(`kasayamInstructions_${index}`, medicine.instructions);
          this.setEditableField(`kasayamQuantity_${index}`, medicine.quantity);
          this.setEditableField(`kasayamPowder_${index}`, medicine.powder);
          this.setEditableField(`kasayamPills_${index}`, medicine.pills);
          break;
          
        case 'kasayam_combination': // FIXED: Updated to match template IDs
          this.setEditableField(`combkasayamName_${index}`, medicine.name);
          this.setEditableField(`combquantity_${index}`, medicine.quantity);
          this.setEditableField(`combquantity2_${index}`, medicine.combinationQuantity);
          this.setEditableField(`combMedicineNam_${index}`, medicine.combinationName);
          this.setEditableField(`combfrequency_${index}`, medicine.frequency);
          
          // Set timing dropdown
          setTimeout(() => {
            const timingSelect = document.querySelector(`[name="timing_${index}"]`) as HTMLSelectElement;
            if (timingSelect && medicine.timing) {
              timingSelect.value = medicine.timing;
            }
          }, 150);
          break;
          
        case 'buligha':
          this.setEditableField(`bulighaName_${index}`, medicine.name);
          this.setEditableField(`bulighaInstructions_${index}`, medicine.instructions);
          this.setEditableField(`bulighaPowder_${index}`, medicine.powder);
          break;
          
        case 'bhasmam':
          this.setEditableField(`bhasmamName_${index}`, medicine.name);
          this.setEditableField(`bhasmamDosage_${index}`, medicine.dosage);
          this.setEditableField(`bhasmamQuantity_${index}`, medicine.quantity);
          this.setEditableField(`bhasmamInstructions_${index}`, medicine.instructions);
          this.setEditableField(`bhasmamPowder_${index}`, medicine.powder);
          break;
          
        case 'krudham':
          this.setEditableField(`krudhamName_${index}`, medicine.name);
          this.setEditableField(`krudhamInstructions_${index}`, medicine.instructions);
          this.setEditableField(`krudhamFrequency_${index}`, medicine.frequency);
          break;
          
        case 'suranam':
          this.setEditableField(`suranamName_${index}`, medicine.name);
          this.setEditableField(`suranamInstructions_${index}`, medicine.instructions);
          this.setEditableField(`suranamPowder_${index}`, medicine.powder);
          this.setEditableField(`suranamFrequency_${index}`, medicine.frequency);
          break;
          
        case 'rasayanam':
          this.setEditableField(`rasayanamName_${index}`, medicine.name);
          this.setEditableField(`rasayanamInstructions_${index}`, medicine.instructions);
          break;
          
        case 'lagium':
          this.setEditableField(`lagiumName_${index}`, medicine.name);
          this.setEditableField(`lagiumInstructions_${index}`, medicine.instructions);
          this.setEditableField(`lagiumFrequency_${index}`, medicine.frequency);
          break;
      }
      
      // Time field for all types
      this.setEditableField(`${medicine.type}Time_${index}`, medicine.time);
    });

    // Update additional notes
    const notesElement = document.getElementById('additionalNotes') as HTMLTextAreaElement;
    if (notesElement && this.prescriptionData.additionalNotes) {
      notesElement.value = this.prescriptionData.additionalNotes;
    }
  } catch (error) {
    console.error('Error updating form fields from prescription:', error);
  }
}
 loadProducts(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.productService.getProductsRealTime().subscribe({
        next: async (products: any[]) => {
          try {
            // Use Promise.all to efficiently fetch the correct, real-time stock.
            const productPromises = products.map(async (product) => {
              if (!product.id) {
                return { ...product, currentStock: 0, totalQuantity: 0 };
              }
              
              // 1. Fetch detailed stock data from the live 'product-stock' collection.
              const stockData = await this.stockService.getProductStock(product.id);
              
              // 2. Calculate total stock by summing quantities from all locations.
              const totalStock = Object.values(stockData).reduce((sum: number, loc: any) => sum + (loc.quantity || 0), 0);
              
              // 3. Return a new product object with 'currentStock' updated to the correct total.
              return {
                ...product,
                currentStock: totalStock,
                totalQuantity: totalStock, // Also update totalQuantity for consistency.
              };
            });
            
            this.allProducts = await Promise.all(productPromises);
            this.filteredProducts = [...this.allProducts];
            resolve();

          } catch (error) {
            console.error('Error processing product stock:', error);
            reject(error);
          }
        },
        error: (error: any) => {
          console.error('Error loading products:', error);
          reject(error);
        }
      });
    });
  }

async saveSale(): Promise<void> {
  this.isSubmitting = true;

  try {
    // --- 1. Form Validation ---
    if (!this.saleForm.valid) {
      this.markFormGroupTouched(this.saleForm);
      if (this.saleForm.hasError('noProducts')) {
        this.showToast('Please add at least one product to the sale.', 'error');
      } else {
        for (const key of Object.keys(this.saleForm.controls)) {
          if (this.saleForm.controls[key].invalid) {
            const fieldLabel = this.getFieldLabel ? this.getFieldLabel(key) : key;
            this.showToast(`Please fill out the required field: ${fieldLabel}`, 'error');
            break;
          }
        }
      }
      this.isSubmitting = false;
      return;
    }

    // --- 2. Generate Document Numbers ---
    const invoiceNumber = await this.generateInvoiceNumber();
    const orderNumber = await this.generateOrderNumber();
    
    // Update form values before extracting data
    this.saleForm.patchValue({
      invoiceNo: invoiceNumber,
      orderNo: orderNumber
    });

    const selectedCustomerId = this.saleForm.get('customer')?.value;
    const customerName = this.customers.find(c => c.id === selectedCustomerId)?.displayName || 'Unknown Customer';

    // --- 3. Prepare Products Array ---
    const productsToSave = [...this.products].map(product => ({
      id: product.id || '',
      productId: product.id || '',
      name: product.name || '',
      productName: product.productName || product.name || '',
      sku: product.sku || '',
      quantity: product.quantity || 0,
      unitPrice: product.unitPrice || 0,
      batchNumber: product.batchNumber || '',
      expiryDate: product.expiryDate || '',
      discount: product.discount || 0,
      discountType: product.discountType || 'Amount',
      commissionPercent: product.commissionPercent || 0,
      commissionAmount: product.commissionAmount || 0,
      subtotal: product.subtotal || 0,
      taxRate: product.taxRate || 0,
      taxAmount: product.taxAmount || 0,
      taxType: product.taxType || '',
      cgstAmount: product.cgstAmount || 0,
      sgstAmount: product.sgstAmount || 0,
      igstAmount: product.igstAmount || 0,
      priceBeforeTax: product.priceBeforeTax || 0
    }));

    if (productsToSave.length === 0) {
      this.showToast('Please add at least one product to the sale.', 'error');
      this.isSubmitting = false;
      return;
    }

    // --- 4. EXPLICIT TAX CALCULATION ---
    const productTax = productsToSave.reduce((sum, product) => 
      sum + (Number(product.taxAmount) || 0), 0);
    
    const shippingCharges = Number(this.saleForm.get('shippingCharges')?.value) || 0;
    const shippingTaxRate = Number(this.saleForm.get('orderTax')?.value) || 0;
    const shippingTax = shippingCharges * (shippingTaxRate / 100);
    
    let packingTax = 0;
    let packingBeforeTax = 0;
    
    if (this.codData && this.codData.packingBeforeTax) {
      packingBeforeTax = Number(this.codData.packingBeforeTax);
      packingTax = (Number(this.codData.packingCharge) || 0) - packingBeforeTax;
    } else if (this.ppServiceData && this.ppServiceData.packingBeforeTax) {
      packingBeforeTax = Number(this.ppServiceData.packingBeforeTax);
      packingTax = (Number(this.ppServiceData.packingCharge) || 0) - packingBeforeTax;
    }
    
    const totalTax = productTax + shippingTax + packingTax;

    // --- 5. ROUND OFF & FINAL TOTALS ---
    // Ensure we are saving the rounded value and the adjustment amount
    const roundOffValue = Number(this.saleForm.get('roundOff')?.value) || 0;
    const finalTotalPayable = Number(this.saleForm.get('totalPayable')?.value) || 0;

    // --- 6. Prepare final sale data ---
    const saleData: any = {
      ...this.saleForm.getRawValue(), // getRawValue includes disabled fields
      saleDate: new Date(this.saleForm.get('saleDate')?.value),
      paidOn: this.saleForm.get('paidOn')?.value ? 
              new Date(this.saleForm.get('paidOn')?.value) : null,
      invoiceNo: invoiceNumber,
      orderNo: orderNumber,
      customer: customerName,
      products: productsToSave,
      
      // TAX BREAKDOWN
      productTaxAmount: parseFloat(productTax.toFixed(2)),
      shippingTaxAmount: parseFloat(shippingTax.toFixed(2)),
      packingTaxAmount: parseFloat(packingTax.toFixed(2)),
      taxAmount: parseFloat(totalTax.toFixed(2)),
      totalTax: parseFloat(totalTax.toFixed(2)),

      // ROUNDING DATA (Crucial for accounting)
      roundOff: roundOffValue,
      totalPayable: finalTotalPayable, 
      
      // SERVICE DATA
      serviceCharge: packingBeforeTax,
      codData: this.codData,
      ppServiceData: this.ppServiceData,
      
      prescriptions: this.prescriptions.length > 0 ? this.prescriptions : [],
      updatedAt: new Date()
    };
    
    // Clean up undefined values
    Object.keys(saleData).forEach(key => {
      if (saleData[key] === undefined) saleData[key] = null;
    });

    const saleId = await this.saleService.addSale(saleData);
    
    this.showToast(`Sale added successfully! Invoice: ${invoiceNumber}`, 'success');
    this.router.navigate(['/sales-order']);

  } catch (error: any) {
    console.error('Error during saveSale:', error);
    this.showToast(error.message || 'An unexpected error occurred.', 'error');
  } finally {
    this.isSubmitting = false;
  }
}
printPrescription(): void {
  // First save any unsaved changes from editable fields
  this.savePrescriptionData();
  
  // Get the prescription to print
  const prescriptionToPrint = this.editingPrescriptionIndex !== null 
    ? this.prescriptions[this.editingPrescriptionIndex]
    : this.prescriptionData;

  // Generate the print content with the latest data
  const printContent = this.generatePrintContent(prescriptionToPrint);
  
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(printContent);
    printWindow.document.close();
    
    // Wait for content to load before printing
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
  }
}


private generatePrintContent(prescription: PrescriptionData): string {
  // Format the date nicely
  const formattedDate = this.datePipe.transform(prescription.date || this.todayDate, 'MMMM d, yyyy') || this.todayDate;
  
  // Generate medicines HTML
  let medicinesHtml = '';
  prescription.medicines.forEach((medicine, index) => {
    medicinesHtml += `
      <div class="medicine-item" style="margin-bottom: 20px; page-break-inside: avoid;">
        <h4 style="font-size: 16px; margin-bottom: 8px;">${index + 1}. ${this.getMedicineTypeName(medicine.type)}</h4>
        ${this.generateMedicineDetails(medicine, index)}
      </div>
    `;
  });

  // Return the full HTML template with logo in left corner
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Prescription</title>
      <style>
        body { 
          font-family: Arial, sans-serif; 
          line-height: 1.6; 
          padding: 20px; 
          max-width: 800px; 
          margin: 0 auto;
          position: relative;
        }
        .header { 
          text-align: center; 
          margin-bottom: 20px; 
          border-bottom: 1px solid #ddd;
          padding-bottom: 20px;
        }
        .logo-container {
          position: absolute;
          top: 20px;
          left: 20px;
          width: 120px;
          height: auto;
          z-index: 10;
        }
        .logo-container img {
          width: 100%;
          height: auto;
          max-width: 120px;
        }
        .patient-info { 
          display: flex; 
          justify-content: space-between; 
          margin-bottom: 30px;
          padding: 15px;
          background: #f9f9f9;
          border-radius: 5px;
        }
        .footer { 
          margin-top: 40px; 
          text-align: right; 
          border-top: 1px solid #ddd;
          padding-top: 20px;
        }
        .medicine-item { 
          margin-bottom: 20px; 
          padding: 15px;
          border: 1px solid #eee;
          border-radius: 5px;
        }
        .highlight { background-color: yellow; }
        .additional-notes {
          margin-top: 30px;
          padding: 15px;
          background: #f5f5f5;
          border-radius: 5px;
        }
        .prescription-header {
          text-align: center;
          margin-bottom: 20px;
          margin-left: 140px; /* Add margin to account for logo space */
        }
        .doctor-title {
          font-weight: bold;
          margin-top: 10px;
        }
        .prescription-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }
        .prescription-table td {
          padding: 8px;
          vertical-align: top;
        }
        .medicine-content {
          margin-left: 20px;
        }
        
        /* Responsive adjustments */
        @media print {
          .logo-container {
            position: absolute;
            top: 10px;
            left: 10px;
          }
        }
        
        @media (max-width: 600px) {
          .prescription-header {
            margin-left: 0;
            margin-top: 140px;
          }
          .logo-container {
            position: relative;
            width: 100px;
            margin-bottom: 20px;
          }
        }
      </style>
    </head>
    <body>
      <!-- Logo in left corner -->
      <div class="logo-container">
        <img src="/assets/logo2.png">
      </div>
      
      <div class="prescription-header">
        <h2>DR.RAJANA P.R.,BAMS</h2>
        <h3>HERBALLY TOUCH AYURVEDA PRODUCTS PVT.LTD.</h3>
        <p>First Floor, Chirackal Tower, Ayroor P.O., Ernakulam Dt.,Kerala - 683 579</p>
        <p>E–mail: contact@herbalytouch.com | Ph: 7034110999</p>
      </div>
      
      
      <table class="prescription-table">
        <tr>
          <td><strong>Name</strong></td>
          <td>${prescription.patientName || '______'}</td>
          <td><strong>Age</strong></td>
          <td>${prescription.patientAge || '______'}</td>
          <td><strong>Date</strong></td>
          <td>${formattedDate}</td>
        </tr>
      </table>
      
      
      <div class="medicine-content">
        ${medicinesHtml}
      </div>
      
      ${prescription.additionalNotes ? `
        <div class="additional-notes">
          <h4 style="font-size: 16px; margin-bottom: 8px;">Additional Notes:</h4>
          <p>${prescription.additionalNotes}</p>
        </div>
      ` : ''}
      
      <div class="footer">
        <p>Doctor's Signature: _________________</p>
        <p class="doctor-title">${this.currentUser}</p>
      </div>
    </body>
    </html>
  `;
}

private getEditableFieldContent(id: string): string {
  const element = document.getElementById(id);
  return element?.textContent?.trim() || element?.innerText?.trim() || '';
}

private generateMedicineDetails(medicine: Medicine, index: number): string {
  let details = '';
  
  // Get the medicine name - try from editable field first, then from medicine object
  const medicineName = this.getEditableFieldContent(`kasayamName_${index}`) || medicine.name || '';
  
  // Common properties
  details += `<p><strong>${medicineName}</strong></p>`;
  
  // Type-specific details
  switch(medicine.type) {
    case 'kasayam':
      const kasayamName = this.getEditableFieldContent(`kasayamName_${index}`) || medicine.name || '';
      const kasayamInstructions = this.getEditableFieldContent(`kasayamInstructions_${index}`) || medicine.instructions || '';
      const kasayamQuantity = this.getEditableFieldContent(`kasayamQuantity_${index}`) || medicine.quantity || '';
      const kasayamPowder = this.getEditableFieldContent(`kasayamPowder_${index}`) || medicine.powder || '';
      const kasayamFrequency = this.getEditableFieldContent(`kasayamFrequency_${index}`) || medicine.frequency || '';
      
      details += `
        <p>${kasayamName}കഷായം ${kasayamInstructions}ml എടുത്ത് ${kasayamQuantity}ml തിളപ്പിച്ചാറ്റിയവെള്ളം ചേർത്ത് ${kasayamPowder}. 
        ഗുളിക . പൊടിച്ച്ചേർത്ത് ${kasayamFrequency} നേരം ഭക്ഷണത്തിനുമുൻപ് / ശേഷംസേവിക്കുക.</p>
      `;
      break;

    case 'kasayam_combination':
      const combKasayamName = this.getEditableFieldContent(`combKasayamName_${index}`) || medicine.name || '';
      const combQuantity1 = this.getEditableFieldContent(`combQuantity1_${index}`) || medicine.quantity || '';
      const combQuantity2 = this.getEditableFieldContent(`combQuantity2_${index}`) || medicine.combinationQuantity || '';
      const combMedicineName = this.getEditableFieldContent(`combMedicineName_${index}`) || medicine.combinationName || '';
      const combFrequency = this.getEditableFieldContent(`combFrequency_${index}`) || medicine.frequency || '';
      
      details += `
        <p>${combKasayamName}കഷായം ${combQuantity1} ml എടുത്ത്
        ${combQuantity2} ml തിളപ്പിച്ചാറ്റിയവെള്ളം ചേർത്ത്
        ${combMedicineName}ഗുളിക പൊടിച്ച്ചേർത്ത്
        ${combFrequency} നേരം ഭക്ഷണത്തിനുമുൻപ് / ശേഷംസേവിക്കുക.</p>
      `;
      break;
      
    case 'buligha':
      const bulighaName = this.getEditableFieldContent(`bulighaName_${index}`) || medicine.name || '';
      const bulighaInstructions = this.getEditableFieldContent(`bulighaInstructions_${index}`) || medicine.instructions || '';
      const bulighaPowder = this.getEditableFieldContent(`bulighaPowder_${index}`) || medicine.powder || '';
      details += `
        <p>${bulighaName}ഗുളിക ${bulighaInstructions} ml. എണ്ണംഎടുത്ത്
         ${bulighaPowder} നേരംഭക്ഷണത്തിനുമുൻപ് / ശേഷംസേവിക്കുക.</p>
      `;
      break;
      
    case 'bhasmam':
      const bhasmamName = this.getEditableFieldContent(`bhasmamName_${index}`) || medicine.name || '';
      const bhasmamDosage = this.getEditableFieldContent(`bhasmamDosage_${index}`) || medicine.dosage || '';
      const bhasmamQuantity = this.getEditableFieldContent(`bhasmamQuantity_${index}`) || medicine.quantity || '';
      const bhasmamInstructions = this.getEditableFieldContent(`bhasmamInstructions_${index}`) || medicine.instructions || '';
      const bhasmamPowder = this.getEditableFieldContent(`bhasmamPowder_${index}`) || medicine.powder || '';
      
      details += `
        <p>${bhasmamName} ഭസ്മം ${bhasmamDosage} നുള്ള് എടുത്ത് ${bhasmamQuantity} ml. ${bhasmamInstructions} ചേർത്ത് ${bhasmamPowder} നേരം ഭക്ഷണത്തിനു മുൻപ് / ശേഷം സേവിക്കുക.</p>
      `;
      break;
      
    case 'krudham':
      const krudhamName = this.getEditableFieldContent(`krudhamName_${index}`) || medicine.name || '';
      const krudhamInstructions = this.getEditableFieldContent(`krudhamInstructions_${index}`) || medicine.instructions || '';
      const krudhamFrequency = this.getEditableFieldContent(`krudhamFrequency_${index}`) || medicine.frequency || '';
      details += `
        <p>${krudhamName} ഘൃതം ${krudhamInstructions} ടീ - സ്പൂൺ എടുത്ത ${krudhamFrequency} നേരം ഭക്ഷണത്തിനു മുൻപ് / ശേഷം സേവിക്കുക.</p>
      `;
      break;
      
    case 'suranam':
      const suranamName = this.getEditableFieldContent(`suranamName_${index}`) || medicine.name || '';
      const suranamInstructions = this.getEditableFieldContent(`suranamInstructions_${index}`) || medicine.instructions || '';
      const suranamPowder = this.getEditableFieldContent(`suranamPowder_${index}`) || medicine.powder || '';
      const suranamFrequency = this.getEditableFieldContent(`suranamFrequency_${index}`) || medicine.frequency || '';
      
      details += `
        <p>${suranamName}ചൂർണ്ണം ${suranamInstructions}ml. ടീ - സ്പൂൺ എടുത്ത്  ${suranamPowder} വെള്ളത്തിൽ ചേർത്ത് തിളപ്പിച്ച് ${suranamFrequency} നേരം ഭക്ഷണത്തിനുമുൻപ് / ശേഷം സേവിക്കുക.</p>
      `;
      break;
      
    case 'rasayanam':
      const rasayanamName = this.getEditableFieldContent(`rasayanamName_${index}`) || medicine.name || '';
      const rasayanamInstructions = this.getEditableFieldContent(`rasayanamInstructions_${index}`) || medicine.instructions || '';
      
      details += `
        <p>${rasayanamName} രസായനം ഒരു ടീ - സ്പൂൺ എടുത്ത് ${rasayanamInstructions} നേരം ഭക്ഷണത്തിനു മുൻപ് / ശേഷം സേവിക്കുക.</p>
      `;
      break;
      
    case 'lagium':
      const lagiumName = this.getEditableFieldContent(`lagiumName_${index}`) || medicine.name || '';
      const lagiumInstructions = this.getEditableFieldContent(`lagiumInstructions_${index}`) || medicine.instructions || '';
      const lagiumFrequency = this.getEditableFieldContent(`lagiumFrequency_${index}`) || medicine.frequency || '';

      details += `
        <p>${lagiumName}ലേഹ്യം ${lagiumInstructions} ടീ - സ്പൂൺ എടുത്ത് ${lagiumFrequency} നേരം ഭക്ഷണത്തിനു മുൻപ് / ശേഷം സേവിക്കുക.</p>
      `;
      break;
      
    default:
      const defaultTime = medicine.time || 'രാവിലെ / ഉച്ചയ്ക്ക് / രാത്രി';
      details += `
        <p>Type: ${medicine.type || '______'}</p>
        ${medicine.dosage ? `<p>Dosage: ${medicine.dosage}</p>` : ''}
        ${medicine.instructions ? `<p>Instructions: ${medicine.instructions}</p>` : ''}
        <p>നേരം: ${defaultTime} ഭക്ഷണത്തിനുമുൻപ് / ശേഷം സേവിക്കുക.</p>
      `;
  }
  
  return details;
}

viewPrescription(prescription: PrescriptionData): void {
  // Open in a new window with proper prescription data
  const printContent = this.generatePrintContent(prescription);
  
  const viewWindow = window.open('', '_blank');
  if (viewWindow) {
    viewWindow.document.write(printContent);
    viewWindow.document.close();
    
    // Optional: Add print button to the view window
    viewWindow.document.body.innerHTML += `
      <div style="text-align: center; margin-top: 20px;">
        <button onclick="window.print()" style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
          Print Prescription
        </button>
      </div>
    `;
  }
}

private savePrescriptionData(): void {
  // Update patient details from form
  const patientName = document.getElementById('patientName')?.textContent?.trim() || 
                     'Unknown Patient';
  const patientAge = document.getElementById('patientAge')?.textContent?.trim() || 
                    this.saleForm.get('customerAge')?.value || 
                    '';
  
  this.prescriptionData = {
    ...this.prescriptionData,
    patientName: patientName,
    patientAge: patientAge,
    date: this.todayDate
  };

  // Update each medicine with current values using CORRECTED field IDs
  this.prescriptionData.medicines.forEach((medicine, index) => {
    // Common fields
    medicine.name = this.getEditableFieldContent(`kasayamName_${index}`) || 
                   this.getEditableFieldContent(`combkasayamName_${index}`) || // FIXED
                   this.getEditableFieldContent(`bulighaName_${index}`) ||
                   this.getEditableFieldContent(`bhasmamName_${index}`) ||
                   this.getEditableFieldContent(`krudhamName_${index}`) ||
                   this.getEditableFieldContent(`suranamName_${index}`) ||
                   this.getEditableFieldContent(`rasayanamName_${index}`) ||
                   this.getEditableFieldContent(`lagiumName_${index}`) ||
                   medicine.name;
    
    // Type-specific fields with CORRECTED field IDs
    switch(medicine.type) {
      case 'kasayam':
        medicine.instructions = this.getEditableFieldContent(`kasayamInstructions_${index}`) || medicine.instructions || '';
        medicine.pills = this.getEditableFieldContent(`kasayamPills_${index}`) || medicine.pills || '';
        medicine.quantity = this.getEditableFieldContent(`kasayamQuantity_${index}`) || medicine.quantity || '';
        medicine.powder = this.getEditableFieldContent(`kasayamPowder_${index}`) || medicine.powder || '';
        break;
        
      case 'kasayam_combination': // FIXED: Updated to match template IDs
        medicine.quantity = this.getEditableFieldContent(`combquantity_${index}`) || medicine.quantity || '';
        medicine.combinationQuantity = this.getEditableFieldContent(`combquantity2_${index}`) || medicine.combinationQuantity || '';
        medicine.combinationName = this.getEditableFieldContent(`combMedicineNam_${index}`) || medicine.combinationName || '';
        medicine.frequency = this.getEditableFieldContent(`combfrequency_${index}`) || medicine.frequency || '';
        
        // Update timing from dropdown
        const timingSelect = document.querySelector(`[name="timing_${index}"]`) as HTMLSelectElement;
        if (timingSelect) {
          medicine.timing = timingSelect.value;
        }
        break;
        
      case 'buligha':
        medicine.instructions = this.getEditableFieldContent(`bulighaInstructions_${index}`) || medicine.instructions || '';
        medicine.powder = this.getEditableFieldContent(`bulighaPowder_${index}`) || medicine.powder || '';
        break;
        
      case 'bhasmam':
        medicine.dosage = this.getEditableFieldContent(`bhasmamDosage_${index}`) || medicine.dosage || '';
        medicine.quantity = this.getEditableFieldContent(`bhasmamQuantity_${index}`) || medicine.quantity || '';
        medicine.instructions = this.getEditableFieldContent(`bhasmamInstructions_${index}`) || medicine.instructions || '';
        medicine.powder = this.getEditableFieldContent(`bhasmamPowder_${index}`) || medicine.powder || '';
        break;
        
      case 'krudham':
        medicine.instructions = this.getEditableFieldContent(`krudhamInstructions_${index}`) || medicine.instructions || '';
        medicine.frequency = this.getEditableFieldContent(`krudhamFrequency_${index}`) || medicine.frequency || '';
        break;
        
      case 'suranam':
        medicine.instructions = this.getEditableFieldContent(`suranamInstructions_${index}`) || medicine.instructions || '';
        medicine.powder = this.getEditableFieldContent(`suranamPowder_${index}`) || medicine.powder || '';
        medicine.frequency = this.getEditableFieldContent(`suranamFrequency_${index}`) || medicine.frequency || '';
        break;
        
      case 'rasayanam':
        medicine.instructions = this.getEditableFieldContent(`rasayanamInstructions_${index}`) || medicine.instructions || '';
        break;
        
      case 'lagium':
        medicine.instructions = this.getEditableFieldContent(`lagiumInstructions_${index}`) || medicine.instructions || '';
        medicine.frequency = this.getEditableFieldContent(`lagiumFrequency_${index}`) || medicine.frequency || '';
        break;
    }
  });

  // Update additional notes
  const notesElement = document.getElementById('additionalNotes') as HTMLTextAreaElement;
  if (notesElement) {
    this.prescriptionData.additionalNotes = notesElement.value;
  }
}


  
convertToSalesOrder(lead: any): void {
    // First check if this is an existing customer
    this.customerService.checkMobileNumberExists(lead.mobile).then(exists => {
      if (exists) {
        // For existing customer - get customer data and navigate
        this.customerService.getCustomerByMobile(lead.mobile).then(customer => {
          const saleData = {
            customerData: customer,
            
            isExistingCustomer: true,
    prescriptions: this.prescriptions.length > 0 ? this.prescriptions : null,

            leadData: lead // Include lead data but mark as existing customer
          };
          
          localStorage.setItem('convertedLeadForSale', JSON.stringify(saleData));
          this.router.navigate(['/add-sale'], { 
            state: { 
              fromLead: true,
              leadData: saleData
            }
          });
        });
      } else {
        // For new customer - use lead data directly
        const saleData = {
          customerData: {
            name: lead.businessName || `${lead.firstName} ${lead.lastName || ''}`,
            mobile: lead.mobile,
            email: lead.email || '',
            address: lead.addressLine1 || '',
            city: lead.city || '',
            state: lead.state || '',
            country: lead.country || 'India',
            zipCode: lead.zipCode || '',
                    productsInterested: lead.productInterested || [] ,// Ensure products are passed

            notes: lead.notes || ''
          },
          isExistingCustomer: false,
          leadData: lead
        };
  
        localStorage.setItem('convertedLeadForSale', JSON.stringify(saleData));
        this.router.navigate(['/add-sale'], { 
          state: { 
            fromLead: true,
            leadData: saleData
          }
        });
      }
    });
  }
  
// Add these methods to your component class
openProductDropdown(): void {
  this.showProductsInterestedDropdown = true;
  this.filterProductsForInterested();
  
}


selectCustomer(customer: any): void {
  // Get customer name
  const customerName = customer.displayName || 
                      `${customer.firstName || ''} ${customer.lastName || ''}`.trim() ||
                      customer.businessName;

  // Build the full address string with customer name
  const addressParts = [
    customerName,
    customer.addressLine1,
    customer.addressLine2,
        customer.district, // Add district here

    customer.state,
    customer.country,
    customer.zipCode
  ].filter(part => part);
  
  const fullAddress = addressParts.join('\n'); // Using newline for better formatting in textarea

  // For shipping address, use billing address by default
  const shippingAddress = fullAddress;

  // Format the date of birth for the input field
  let formattedDob = '';
  if (customer.dob) {
    // Handle both string and Date object formats
    const dobDate = customer.dob instanceof Date ? customer.dob : new Date(customer.dob);
    if (!isNaN(dobDate.getTime())) {
      formattedDob = this.datePipe.transform(dobDate, 'yyyy-MM-dd') || '';
    }
  }
  
  // Update the form with the found customer
  this.saleForm.patchValue({
    customer: customer.id,
    customerName: customerName,
    customerPhone: customer.mobile || customer.phone || '',
    alternateContact: customer.alternateContact || '',
    customerEmail: customer.email || '',
    customerAge: customer.age || null,
    customerDob: formattedDob,
    customerGender: customer.gender || '',
    customerOccupation: customer.occupation || '', // FIXED: Added this line
    billingAddress: fullAddress,
    shippingAddress: shippingAddress,
    creditLimit: customer.creditLimit || 0
  });
  
  // Store customer details for prescription
  this.currentCustomerForPrescription = {
    name: customerName,
    age: customer.age || null
  };
  
  this.customerSearchInput = customerName;
  this.showCustomerDropdown = false;
  
  // Store the selected customer for reference
  this.selectedCustomer = customer;
}

findCustomerByPhone(phone: string): any {
  // Try exact match first
  let customer = this.customers.find(c => 
    c.mobile === phone || 
    c.phone === phone ||
    c.alternateContact === phone ||  // Include alternate contact
    c.landline === phone
  );
  if (customer) return customer;

  // Try removing all non-digits
  const cleanPhone = phone.replace(/\D/g, '');
  customer = this.customers.find(c => {
    const custMobile = c.mobile?.replace(/\D/g, '') || '';
    const custPhone = c.phone?.replace(/\D/g, '') || '';
    const custAlt = c.alternateContact?.replace(/\D/g, '') || '';
    const custLandline = c.landline?.replace(/\D/g, '') || '';
    return custMobile === cleanPhone || 
           custPhone === cleanPhone || 
           custAlt === cleanPhone ||  // Include alternate contact
           custLandline === cleanPhone;
  });
  
  return customer;
}




// Add these methods to your component class
onSearchInput(event: any): void {
  if (this.searchTimeout) {
    clearTimeout(this.searchTimeout);
  }
  
  this.searchTimeout = setTimeout(() => {
    this.searchProducts(event);
  }, 300);
}
// Update the searchProducts method to handle multiple selection
searchProducts(event: any) {
  const searchTerm = event.target.value.toLowerCase().trim();
  this.searchTerm = searchTerm;
  
  if (!searchTerm || searchTerm.length < 2) {
    this.searchResults = [];
    this.showSearchResults = false;
    return;
  }
  
  this.searchResults = this.allProducts
    .filter(product => {
      // Skip not-for-selling products
      if (product.notForSelling) {
        return false;
      }
      
      // Apply other filters
      if (this.filterOptions.inStockOnly && 
          (product.currentStock <= 0 && product.totalQuantity <= 0)) {
        return false;
      }
      if (product.defaultSellingPriceExcTax < this.filterOptions.priceRange.min || 
          product.defaultSellingPriceExcTax > this.filterOptions.priceRange.max) {
        return false;
      }
      
      // Then apply search
      const searchString = [
        product.productName || product.name,
        product.sku,
        product.barcode
      ]
      .filter(field => field)
      .join(' ')
      .toLowerCase();
      
      return searchString.includes(searchTerm);
    })
    .map(product => ({
      ...product,
      productName: product.productName || product.name,
      currentStock: product.currentStock || product.totalQuantity || 0,
      defaultSellingPriceExcTax: product.defaultSellingPriceExcTax || 0,
      selected: product.selected || false,
      // Include combination products if they exist
      combinationProducts: product.combinationProducts || []
    }));
  
  this.showSearchResults = this.searchResults.length > 0;
}


onProductInterestedSearch(): void {
  if (!this.productInterestedSearch) {
    this.filteredProductsForInterested = [...this.allProducts].slice(0, 10);
    return;
  }
  
  const searchTerm = this.productInterestedSearch.toLowerCase();
  this.filteredProductsForInterested = this.allProducts
    .filter(product => 
      (product.productName?.toLowerCase().includes(searchTerm) ||
      (product.sku?.toLowerCase().includes(searchTerm))
    .slice(0, 10)));
}





onSearchFocus() {
  this.showSearchResults = true;
  if (this.searchTerm) {
    this.searchProducts({ target: { value: this.searchTerm } });
  }
}
editCustomerDetails(): void {
  const customerId = this.saleForm.get('customer')?.value;
  if (!customerId) {
    alert('Please select a customer first');
    return;
  }

  // Find the customer in the customers list
  const customer = this.customers.find(c => c.id === customerId);
  if (customer) {
    // Store the customer data in local storage
    localStorage.setItem('customerToEdit', JSON.stringify(customer));
    
    // Open customers page in a new tab
    const url = this.router.createUrlTree(['/customers'], {
      queryParams: { edit: customerId }
    }).toString();
    
    window.open(url, '_blank');
  } else {
    alert('Customer not found');
  }
}
openCustomerEditForm(customer: any): void {
  // Store the customer data in local storage
  localStorage.setItem('customerToEdit', JSON.stringify(customer));
  
  // Open customers page in a new tab
  const url = this.router.createUrlTree(['/customers'], {
    queryParams: { edit: customer.id }
  }).toString();
  
  window.open(url, '_blank');
}
// add-sale.component.ts

openCustomerEditPopup(): void {
  const customerId = this.saleForm.get('customer')?.value;
  if (!customerId) {
    this.showToast('Please select a customer first', 'error');
    return;
  }

  const customer = this.customers.find(c => c.id === customerId);
  if (customer) {
    // Get current form values for addresses (they might have been modified)
    const formBillingAddress = this.saleForm.get('billingAddress')?.value;
    const formShippingAddress = this.saleForm.get('shippingAddress')?.value;
    const formAlternateContact = this.saleForm.get('alternateContact')?.value;

    this.selectedCustomerForEdit = { 
      ...customer,
      isIndividual: !customer.businessName,
      firstName: customer.firstName || '',
      lastName: customer.lastName || '',
      // Use form values if they exist, otherwise fall back to customer data
      billingAddress: formBillingAddress || customer.billingAddress || customer.addressLine1 || '',
      shippingAddress: formShippingAddress || customer.shippingAddress || customer.addressLine1 || '',
      alternateContact: formAlternateContact || customer.alternateContact || '',
      email: this.saleForm.get('customerEmail')?.value || customer.email || '',
      mobile: this.saleForm.get('customerPhone')?.value || customer.mobile || '',
          age: this.saleForm.get('customerAge')?.value || customer.age || null,
      dob: this.saleForm.get('customerDob')?.value || customer.dob || null,
      gender: this.saleForm.get('customerGender')?.value || customer.gender || ''
    };
    this.showCustomerEditPopup = true;
  } else {
    this.showToast('Customer not found in local list', 'error');
  }
}
onCustomerSave(updatedCustomer: any): void {
  try {
    // Update the customer in Firestore
    this.customerService.updateCustomer(updatedCustomer.id, updatedCustomer)
      .then(() => {
        // Update the form values with ALL edited fields
        this.saleForm.patchValue({
          customer: updatedCustomer.id,
          customerName: updatedCustomer.displayName,
          customerPhone: updatedCustomer.mobile || updatedCustomer.phone || '',
          customerEmail: updatedCustomer.email || '',
          billingAddress: updatedCustomer.billingAddress || updatedCustomer.addressLine1 || '',
          shippingAddress: updatedCustomer.shippingAddress || updatedCustomer.addressLine1 || '',
          alternateContact: updatedCustomer.alternateContact || ''
        });
        
        // Update the customer in the local list
        const index = this.customers.findIndex(c => c.id === updatedCustomer.id);
        if (index >= 0) {
          this.customers[index] = updatedCustomer;
        } else {
          this.customers.push(updatedCustomer);
        }
        
        // Update the customer search input
        this.customerSearchInput = updatedCustomer.displayName;
        
        this.showCustomerEditPopup = false;
        
        // Force refresh of the form
        this.changeDetectorRef.detectChanges();
      })
      .catch(error => {
        console.error('Error updating customer:', error);
        this.showToast('Failed to save customer changes. Please try again.', 'error');
      });
  } catch (error) {
    console.error('Error handling customer save:', error);
    this.showToast('An unexpected error occurred. Please try again.', 'error');
  }
}
copyBillingToShipping(): void {
  const billingAddress = this.saleForm.get('billingAddress')?.value;
  if (billingAddress) {
    this.saleForm.patchValue({
      shippingAddress: billingAddress
    });
  }
}







onCustomerEditClose(): void {
  this.showCustomerEditPopup = false;
}
onAddressChange(type: 'billing' | 'shipping') {
  // This method ensures both fields stay in sync if needed
  const billingValue = this.saleForm.get('billingAddress')?.value;
  const shippingValue = this.saleForm.get('shippingAddress')?.value;
  
  if (type === 'billing') {
    // If billing address changes, update the form control
    this.saleForm.patchValue({ billingAddress: billingValue });
  } else {
    // If shipping address changes, update the form control
    this.saleForm.patchValue({ shippingAddress: shippingValue });
  }
}

onSearchBlur() {
  setTimeout(() => {
    this.showSearchResults = false;
  }, 200);
}
highlightMatch(text: string, searchTerm: string): string {
  if (!text || !searchTerm) return text;
  
  const regex = new RegExp(searchTerm, 'gi');
  return text.replace(regex, match => 
    `<span class="highlight">${match}</span>`
  );
}

handleKeyDown(event: KeyboardEvent) {
  if (!this.showSearchResults) return;
  
  const results = document.querySelectorAll('.search-results-dropdown .list-group-item');
  
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    const currentIndex = Array.from(results).findIndex(el => el === document.activeElement);
    if (currentIndex < results.length - 1) {
      (results[currentIndex + 1] as HTMLElement)?.focus();
    }
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    const currentIndex = Array.from(results).findIndex(el => el === document.activeElement);
    if (currentIndex > 0) {
      (results[currentIndex - 1] as HTMLElement)?.focus();
    } else {
      (event.target as HTMLElement)?.focus();
    }
  } else if (event.key === 'Enter') {
    const activeElement = document.activeElement;
    if (activeElement?.classList.contains('list-group-item')) {
      const index = Array.from(results).findIndex(el => el === activeElement);
      if (index >= 0) {
        this.addProductFromSearch(this.searchResults[index]);
      }
    }
  }
}

async addCombinationProducts(combinationProducts: any[], parentProductId: string): Promise<void> {
  try {
    for (const comboProduct of combinationProducts) {
      // Find the full product details from allProducts
      const fullProductDetails = this.allProducts.find(p => 
        p.id === comboProduct.productId || 
        p.productName === comboProduct.name
      );
      
      if (fullProductDetails) {
        const existingProductIndex = this.products.findIndex(p => 
          (p.id === fullProductDetails.id || 
           p.productName === fullProductDetails.productName) &&
          p.parentCombinationId === parentProductId
        );
        
        if (existingProductIndex >= 0) {
          // Update existing product quantity
          this.products[existingProductIndex].quantity += comboProduct.quantity;
          this.updateProduct(existingProductIndex);
        } else {
          // Add new combination product
          const newComboProduct: Product = {
            id: fullProductDetails.id,
            name: fullProductDetails.productName || fullProductDetails.name,
            productName: fullProductDetails.productName || fullProductDetails.name,
            sku: fullProductDetails.sku,
            barcode: fullProductDetails.barcode,
            priceBeforeTax: fullProductDetails.defaultSellingPriceExcTax || 0,
            taxIncluded: !!fullProductDetails.defaultSellingPriceIncTax,
            unitPrice: fullProductDetails.defaultSellingPriceIncTax || 
                     fullProductDetails.defaultSellingPriceExcTax || 0,
            currentStock: fullProductDetails.currentStock || fullProductDetails.totalQuantity || 0,
            defaultSellingPriceExcTax: fullProductDetails.defaultSellingPriceExcTax,
            defaultSellingPriceIncTax: fullProductDetails.defaultSellingPriceIncTax,
            taxRate: fullProductDetails.taxRate || (fullProductDetails.applicableTax?.percentage || 0),
            quantity: comboProduct.quantity,
            discount: 0,
            commissionPercent: this.defaultProduct.commissionPercent || 0,
            commissionAmount: 0,
            subtotal: (fullProductDetails.defaultSellingPriceIncTax || 
                      fullProductDetails.defaultSellingPriceExcTax || 0) * comboProduct.quantity,
            batchNumber: fullProductDetails.batchNumber || '',
            expiryDate: fullProductDetails.expiryDate || '',
            discountType: 'Amount',
            taxAmount: 0,
            cgstAmount: 0,
            sgstAmount: 0,
            igstAmount: 0,
            taxType: '',
            stockByLocation: fullProductDetails.stockByLocation || {},
            totalQuantity: fullProductDetails.totalQuantity || fullProductDetails.currentStock || 0,
            manageStock: fullProductDetails.manageStock !== false,
            isComponent: true,
            parentCombinationId: parentProductId,
            componentQuantity: comboProduct.quantity
          };
          
          this.products.push(newComboProduct);
          this.updateProduct(this.products.length - 1);
        }
      } else {
        console.warn(`Combination product not found: ${comboProduct.name || comboProduct.productId}`);
      }
    }
  } catch (error) {
    console.error('Error adding combination products:', error);
    throw error;
  }
}
  checkCombinationStock(product: Product): boolean {
  if (!product.combinationProducts || product.combinationProducts.length === 0) {
    return true;
  }
  
  return product.combinationProducts.every(combo => {
    const comboProduct = this.allProducts.find(p => 
      p.productName === combo.name || p.name === combo.name
    );
    return comboProduct && (comboProduct.currentStock || 0) >= combo.quantity;
  });
}
async addProductFromSearch(product: any): Promise<void> {
  try {
    // First check if product is marked as not for selling
    if (product.notForSelling) {
      this.showToast('This product is not available for sale', 'error');
      return;
    }

    const selectedProduct = this.allProducts.find(p => p.id === product.id || p.productName === product.productName);
    
    if (!selectedProduct) {
      console.error('Selected product not found in local list');
      this.toastr.error('Could not find the full product details. Please try again.', 'Error');
      return;
    }

    // Check if the product is already in the sale
    const existingProductIndex = this.products.findIndex(p => 
      (p.id === selectedProduct.id || p.productName === selectedProduct.productName) && !p.parentCombinationId
    );

    if (existingProductIndex >= 0) {
      // Update existing product quantity
      this.products[existingProductIndex].quantity += 1;
      this.updateProduct(existingProductIndex);
    } else {
      // ======================= THE FIX =======================
      // 1. Find the correct TaxRate object based on the product's tax ID.
      let foundTaxRateObject: TaxRate | null = null;
      if (selectedProduct.applicableTax) {
        // The product's tax can be a string (ID) or an object with an ID.
        const taxId = typeof selectedProduct.applicableTax === 'string' 
          ? selectedProduct.applicableTax 
          : selectedProduct.applicableTax.id;
        
        if (taxId) {
          // Find the full tax object from the list of available tax rates.
          foundTaxRateObject = this.availableTaxRates.find(tax => tax.id === taxId) || null;
        }
      }
      // ===================== END OF THE FIX ====================

      // Create new product with all details, including the found tax object
      const newProduct: Product = {
        id: selectedProduct.id,
        name: selectedProduct.productName || selectedProduct.name,
        productName: selectedProduct.productName || selectedProduct.name,
        sku: selectedProduct.sku,
        barcode: selectedProduct.barcode,
        priceBeforeTax: selectedProduct.defaultSellingPriceExcTax || 0,
        taxIncluded: !!selectedProduct.defaultSellingPriceIncTax,
        unitPrice: selectedProduct.defaultSellingPriceIncTax || selectedProduct.defaultSellingPriceExcTax || 0,
        currentStock: selectedProduct.currentStock || selectedProduct.totalQuantity || 0,
        defaultSellingPriceExcTax: selectedProduct.defaultSellingPriceExcTax,
        defaultSellingPriceIncTax: selectedProduct.defaultSellingPriceIncTax,
        
        // Assign the full tax object and the rate percentage
        taxRateObject: foundTaxRateObject,
        taxRate: foundTaxRateObject ? foundTaxRateObject.rate : 0,

        quantity: 1,
        discount: 0,
        discountPercentage: 0,
        discountAmount: 0,
        commissionPercent: this.defaultProduct.commissionPercent || 0,
        commissionAmount: 0,
        subtotal: (selectedProduct.defaultSellingPriceIncTax || selectedProduct.defaultSellingPriceExcTax || 0) * 1,
        batchNumber: selectedProduct.batchNumber || '',
        expiryDate: selectedProduct.expiryDate || '',
        discountType: 'Amount',
        taxAmount: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
        taxType: '',
        stockByLocation: selectedProduct.stockByLocation || {},
        totalQuantity: selectedProduct.totalQuantity || selectedProduct.currentStock || 0,
        manageStock: selectedProduct.manageStock !== false,
        isCombination: selectedProduct.isCombination || false,
        combinationProducts: selectedProduct.combinationProducts || []
      };

      this.products.push(newProduct);
      
      // If this is a combination product, add its components
      if (selectedProduct.isCombination && selectedProduct.combinationProducts?.length > 0 && newProduct.id) {
        await this.addCombinationProducts(selectedProduct.combinationProducts, newProduct.id);
      }
      
      // Update the newly added product to calculate its initial tax and subtotal correctly
      this.updateProduct(this.products.length - 1);
    }
    
    this.clearSearch();
  } catch (error) {
    console.error('Error adding product from search:', error);
    this.toastr.error('Failed to add product. Please try again.', 'Error');
  }
}

onProductSelect(productName: string): void {
  if (!productName) {
    this.resetDefaultProduct();
    return;
  }

  const selectedProduct = this.allProducts.find(p => p.productName === productName);
  if (selectedProduct) {
    // Remove the stock check condition
    this.populateDefaultProduct(selectedProduct);
  }
}

private resetDefaultProduct(): void {
  this.defaultProduct = {
    name: '',
    quantity: 1,
    unitPrice: 0,
    discount: 0,
    subtotal: 0,
    commissionPercent: 0,
    commissionAmount: 0,
    priceBeforeTax: 0,
    taxIncluded: false,
    discountType: 'Amount',
    batchNumber: '',
    lastNumber: '',
    lastNumbers: [],
    batches: [],
    taxRate: 0,
    taxAmount: 0,
    cgstAmount: 0,
    sgstAmount: 0,
    igstAmount: 0,
    taxType: ''
  };
  this.updateDefaultProduct();
}

private populateDefaultProduct(selectedProduct: any): void {
  this.defaultProduct.name = selectedProduct.productName;
  this.defaultProduct.priceBeforeTax = selectedProduct.defaultSellingPriceExcTax || 0;
  
  const taxRate = selectedProduct.taxRate !== undefined
    ? selectedProduct.taxRate
    : (selectedProduct.applicableTax ? selectedProduct.applicableTax.percentage : 0);
  
  this.defaultProduct.taxRate = taxRate;
  this.defaultProduct.unitPrice = selectedProduct.defaultSellingPriceIncTax ||
    (this.defaultProduct.priceBeforeTax * (1 + (taxRate / 100)));
  this.defaultProduct.quantity = 1;
  
  // Set batch number data
  this.defaultProduct.batchNumber = selectedProduct.batchNumber || '';
  this.defaultProduct.lastNumber = selectedProduct.lastNumber || '';
  this.defaultProduct.lastNumbers = selectedProduct.lastNumbers || [];
  
  this.updateDefaultProduct();
}

clearSearch() {
  this.searchTerm = '';
  this.searchResults = [];
  this.showSearchResults = false;
}


onProductInterestedBlur(): void {
  setTimeout(() => {
    if (!this.dropdownFilterFocused) {
      this.showProductsInterestedDropdown = false;
    }
  }, 200);
}


selectProductForInterested(product: any): void {
  if (!this.selectedProductsForInterested.some(p => p.id === product.id)) {
    this.selectedProductsForInterested.push({...product});
  }
  this.productInterestedSearch = '';
  this.showProductsInterestedDropdown = false;
  this.filterProductsForInterested();
}


// ... (keep all existing code before this function)

// REPLACE your entire old ngOnInit function with this new, corrected version
ngOnInit(): void {
  // 1. Initialize the form and synchronous properties first
  this.initializeForm();
  this.setupValueChanges();
  this.todayDate = this.datePipe.transform(this.currentDate, 'yyyy-MM-dd') || '';
  this.currentUser = this.getCurrentUser();

  // 2. Load all necessary data asynchronously using Promise.all
  Promise.all([
    this.loadCustomers(),
    this.loadProducts(),
    this.loadBusinessLocations(),
    this.loadServiceTypes(),
    this.loadUsers(),
    this.loadTaxRates(),
    this.loadTaxGroups(),
    this.loadPaymentAccounts()
  ]).then(() => {
    // 3. Once ALL data is loaded, perform actions that depend on that data
    this.prefillCurrentUser();
    this.checkForLeadData();
    this.checkForCustomerQueryParam();
    
    // Generate invoice/order numbers only after everything else is ready
    this.generateAndSetNumbers();

    // Check for quotation data separately
    this.route.params.subscribe(params => {
      if (params['fromQuotation'] === 'true') {
        this.isFromQuotation = true;
        this.loadQuotationData();
      }
    });
  }).catch(error => {
    // Handle any errors that might occur during data loading
    console.error("Failed to initialize the component with all required data:", error);
    this.showToast("Error loading page data. Please try refreshing.", "error");
  });
}

// ... (keep all existing code after this function)
getCurrentDate(): Date {
  return new Date();
}
onMainSearchInput(): void {
  // Clear any pending close timeout
  clearTimeout(this.closeDropdownTimeout);
  
  // Show dropdown if not already shown
 
  
  // Filter products based on main search
  this.filterProductsForInterested();
}



onDropdownFilterInput(): void {
  this.filterProductsForInterested();
}
prefillCustomerDetails(customer: any) {
  // Implement logic to prefill customer details in your form
  this.saleForm.patchValue({
    customerAddress: customer.addressLine1,
    customerCity: customer.city,
    customerState: customer.state,
    customerPhone: customer.mobile,
    customerAlternateContact: customer.alternateContact,
    customerDob: customer.dob,
   customerAge:customer.age
    // Add other fields as needed
  });
  }
 private checkForCustomerQueryParam(): void {
  this.route.queryParams.subscribe(params => {
    if (params['customerId']) {
      const customerId = params['customerId'];
      const customer = this.customers.find(c => c.id === customerId);
      
      if (customer) {
        this.selectCustomer(customer);
        
        // If there's a productId parameter, add that product too
        if (params['productId']) {
          const productId = params['productId'];
          const product = this.allProducts.find(p => p.id === productId);
          
          if (product) {
            this.addProductFromSearch(product);
          }
        }
      }
    }
  });
} 
// Add this new method
 private async prefillCurrentUser(): Promise<void> {
    try {
      const currentUser = this.authService.currentUserValue;
      if (currentUser) {
        this.currentUser = currentUser.displayName || currentUser.email;
        
        // Find the user in the users list and set as default
        this.users = await this.loadUsers();
        const loggedInUser = this.users.find(u => u.id === currentUser.uid);
        
        if (loggedInUser) {
          // Set the form value for user AND department
          this.saleForm.patchValue({
            addedBy: loggedInUser.id,
            department: loggedInUser.department || '' // <-- Set department here
          });
          
          // Also update the commission percentage
          const commissionPercent = await this.getAgentCommission(loggedInUser.id);
          this.defaultProduct.commissionPercent = commissionPercent;
          this.updateDefaultProduct();
        } else {
          // If user not found in users list, still set the current user
          this.saleForm.patchValue({
            addedBy: currentUser.uid
          });
        }
      }
    } catch (error) {
      console.error('Error prefilling current user:', error);
    }
  }

filterProductsForInterested(): void {
  let filtered = [...this.allProducts];
  
  // Apply search filter
  if (this.productInterestedSearch) {
    const searchTerm = this.productInterestedSearch.toLowerCase();
    filtered = filtered.filter(product => 
      (product.productName?.toLowerCase().includes(searchTerm) ||
       product.sku?.toLowerCase().includes(searchTerm))
    );
  }
  
  // Apply in-stock filter
  if (this.filterOptions.inStockOnly) {
    filtered = filtered.filter(product => product.currentStock > 0);
  }
  
  // Apply price range filter
  filtered = filtered.filter(product => 
    product.defaultSellingPriceExcTax >= this.filterOptions.priceRange.min &&
    product.defaultSellingPriceExcTax <= this.filterOptions.priceRange.max
  );
  
  // Reset selection state for all products
  filtered.forEach(p => p.selected = p.selected || false);
  
  this.filteredProductsForInterested = filtered.slice(0, 50);
}


// Add these new methods
onDropdownFilterFocus(): void {
  this.dropdownFilterFocused = true;
  clearTimeout(this.closeDropdownTimeout);
}
onDropdownFilterBlur(): void {
  this.dropdownFilterFocused = false;
  setTimeout(() => {
    if (!this.showProductsInterestedDropdown) {
      this.productInterestedSearch = '';
    }
  }, 200);
}








private loadTaxRates(): Promise<void> {
  return new Promise((resolve) => {
    this.taxService.getTaxRates().subscribe(rates => {
      this.availableTaxRates = rates;
      resolve();
    });
  });
}

loadPaymentAccounts(): Promise<void> {
  return new Promise((resolve, reject) => {
    this.accountService.getAccounts((accounts: any[]) => {
      this.paymentAccounts = accounts;
      resolve();
    });
  });
}


private loadTaxGroups(): Promise<void> {
  return new Promise((resolve) => {
    this.taxService.getTaxGroups().subscribe(groups => {
      this.availableTaxGroups = groups.map(group => ({
        ...group,
        calculatedRate: this.calculateGroupRate(group.taxRates)
      }));
      resolve();
    });
  });
}

private calculateGroupRate(taxRates: TaxRate[]): number {
  // This calculates the combined rate for a tax group
  // You might need to adjust this based on your business logic
  return taxRates.reduce((total, rate) => total + rate.rate, 0);
  }
  
// Add this method to calculate taxes
calculateTaxes(): void {
  // Product taxes
  this.products.forEach(product => {
    this.calculateProductTax(product);
  });
  
  // Default product tax
  if (this.defaultProduct.name || this.defaultProduct.quantity > 0 || this.defaultProduct.unitPrice > 0) {
    this.calculateProductTax(this.defaultProduct);
  }

  // Shipping tax
  const shippingBeforeTax = this.saleForm.get('shippingCharges')?.value || 0;
  const shippingTaxRate = this.saleForm.get('orderTax')?.value || 0;
  const shippingTax = shippingBeforeTax * (shippingTaxRate / 100);
  
  this.saleForm.patchValue({
    shippingTaxAmount: shippingTax
  });

  // Total tax
  const productTax = this.products.reduce((sum, p) => sum + (p.taxAmount || 0), 0);
  const defaultProductTax = (this.defaultProduct.name || this.defaultProduct.quantity > 0 || this.defaultProduct.unitPrice > 0) 
    ? (this.defaultProduct.taxAmount || 0) 
    : 0;
  
  this.taxAmount = productTax + defaultProductTax + shippingTax;
  
  this.calculateTotalPayable();
}

calculateTotalPayable(): void {
  const itemsTotal = this.itemsTotal;
  const shippingCharges = Number(this.saleForm.get('shippingCharges')?.value) || 0;
  const shippingTaxRate = Number(this.saleForm.get('orderTax')?.value) || 0;
  const shippingTax = shippingCharges * (shippingTaxRate / 100);
  
  const serviceCharge = this.ppServiceData?.packingCharge || this.codData?.packingCharge || 0;
  
  // Order-level additional discount
  const orderDiscount = Number(this.saleForm.get('discountAmount')?.value) || 0;
  const orderDiscountType = this.saleForm.get('discountType')?.value;
  
  let finalOrderDiscount = 0;
  if (orderDiscountType === 'Percentage') {
    finalOrderDiscount = (itemsTotal * orderDiscount) / 100;
  } else {
    finalOrderDiscount = orderDiscount;
  }

  // 1. Calculate Raw Total (with decimals)
  const rawTotal = itemsTotal + shippingCharges + shippingTax + serviceCharge - finalOrderDiscount;

  // 2. Calculate Round Off
  const roundedTotal = Math.round(rawTotal);
  const roundOff = roundedTotal - rawTotal;

  // 3. Update Form (Total Payable now becomes the Rounded value)
  this.saleForm.patchValue({
    roundOff: parseFloat(roundOff.toFixed(2)),
    totalPayable: roundedTotal // This is now 785 instead of 784.9
  }, { emitEvent: false });

  this.calculateBalance();
}

// Since calculateTotalPayable now handles rounding, 
// we simplify calculateRoundOff to just call the parent calculation
calculateRoundOff(): void {
  this.calculateTotalPayable();
}
private calculateProductTax(product: Product): void {
  const taxAmount = product.taxAmount || 0;

  if (product.taxRateObject && product.taxRateObject.isIGST) {
    product.taxType = 'IGST';
    product.igstAmount = taxAmount;
    product.cgstAmount = 0;
    product.sgstAmount = 0;
  } else if (taxAmount > 0) {
    product.taxType = 'CGST+SGST';
    product.cgstAmount = parseFloat((taxAmount / 2).toFixed(4));
    product.sgstAmount = parseFloat((taxAmount / 2).toFixed(4));
    product.igstAmount = 0;
  } else {
    product.taxType = 'None';
    product.cgstAmount = 0;
    product.sgstAmount = 0;
    product.igstAmount = 0;
  }
}
onTaxChange(selectedRate: string): void {
  this.saleForm.patchValue({ orderTax: parseFloat(selectedRate) || 0 });
  this.calculateTotalPayable();
    this.calculateTaxes(); // Add this line

}
// onTaxSelect(taxRate: number, index: number): void {
//   this.products[index].taxRate = taxRate;
//   this.updateProduct(index);
// }
getTaxRateOptions(): any[] {
  return this.availableTaxRates.map(rate => ({
    value: rate.rate,
    label: `${rate.name} (${rate.rate}%)`
  }));
}
private checkForConvertedLead(): void {
  // First check navigation state
  const navigation = this.router.getCurrentNavigation();
  const state = navigation?.extras?.state as {fromLead: boolean, leadData: any};
  
  if (state?.fromLead) {
    this.prefillFromLead(state.leadData);
    this.isFromLead = true;
    return;
  }

  // Then check local storage as fallback
  const leadData = localStorage.getItem('convertedLeadForSale');
  if (leadData) {
    try {
      const parsedData = JSON.parse(leadData);
      this.prefillFromLead(parsedData);
      this.isFromLead = true;
      localStorage.removeItem('convertedLeadForSale');
      
      // Additional check for existing customer
      if (parsedData.isExistingCustomer) {
        this.searchCustomerByPhone(); // Trigger customer search
      }
    } catch (error) {
      console.error('Error parsing lead data:', error);
    }
  }
}



private prefillCustomerData(customerData: any, isExistingCustomer: boolean = false): void {
  // Build address strings - FIXED: Removed age and DOB from address
  const billingAddressParts = [
    customerData.addressLine1,
    customerData.addressLine2,
    customerData.city,
    customerData.state,
    customerData.country,
    customerData.zipCode,
    customerData.alternateContact
  ].filter(part => part);
  
  const billingAddress = billingAddressParts.join(', ');
  
  // For shipping address, use billing address by default
  const shippingAddress = billingAddress;

  // Prefill all customer details
  this.saleForm.patchValue({
    customer: customerData.id,
    customerName: customerData.displayName || 
                `${customerData.firstName || ''} ${customerData.lastName || ''}`.trim() ||
                customerData.businessName,
    customerPhone: customerData.mobile || customerData.phone || '',
    alternateContact: customerData.alternateContact || '',
    customerEmail: customerData.email || '',
    customerAge: customerData.age || null,
    customerDob: this.formatDateForInput(customerData.dob) || null,
    customerGender: customerData.gender || '',
    customerOccupation: customerData.occupation || '', // This was already correct
    billingAddress: billingAddress,
    shippingAddress: shippingAddress,
    sellNote: customerData.notes || '',
  });

  // Update the customer search input
  this.customerSearchInput = customerData.displayName || 
                           `${customerData.firstName || ''} ${customerData.lastName || ''}`.trim() ||
                           customerData.businessName;

  // Prefill interested products if any
  if (customerData.productsInterested && customerData.productsInterested.length > 0) {
    this.selectedProductsForInterested = [...customerData.productsInterested];
  }
}





searchCustomerByPhone(): void {
  const inputPhone = this.saleForm.get('customerPhone')?.value?.trim();
  console.log('Searching for phone:', inputPhone);

  if (!inputPhone || inputPhone.length < 5) {
    this.clearNonPhoneFields();
    return;
  }

  // Clean the phone number by removing all non-digit characters
  const cleanPhone = inputPhone.replace(/\D/g, '');

  // Try to find customer by exact match or cleaned phone number in mobile, phone, or alternateContact
  const foundCustomer = this.customers.find(customer => {
    // Check all phone fields (mobile, phone, alternateContact, landline)
    const customerPhones = [
      customer.mobile,
      customer.phone,
      
      customer.alternateContact,
      customer.landline
    ].filter(phone => phone); // Remove empty values

    // Check if any phone matches exactly or after cleaning
    return customerPhones.some(phone => {
      const cleanCustomerPhone = phone?.replace(/\D/g, '') || '';
      return phone === inputPhone || cleanCustomerPhone === cleanPhone;
    });
  });

  if (foundCustomer) {
    console.log('Customer found:', foundCustomer);
    
    // Format the date of birth for the input field
    let formattedDob = '';
    if (foundCustomer.dob) {
      // Handle both string and Date object formats
      const dobDate = foundCustomer.dob instanceof Date ? foundCustomer.dob : new Date(foundCustomer.dob);
      if (!isNaN(dobDate.getTime())) {
        formattedDob = this.datePipe.transform(dobDate, 'yyyy-MM-dd') || '';
      }
    }
    
    // Update the form with the found customer
    this.saleForm.patchValue({
      customer: foundCustomer.id,
      customerName: foundCustomer.displayName,
      customerPhone: foundCustomer.mobile || foundCustomer.phone || '',
      alternateContact: foundCustomer.alternateContact || '',
      customerEmail: foundCustomer.email || '',
      customerAge: foundCustomer.age || null,
      customerDob: formattedDob,
      customerGender: foundCustomer.gender || '',
      customerOccupation: foundCustomer.occupation || '', // FIXED: Added this line
      billingAddress: foundCustomer.addressLine1 || '',
      shippingAddress: foundCustomer.addressLine1 || '',
      creditLimit: foundCustomer.creditLimit || 0
    });
    this.customerSearchInput = foundCustomer.displayName;
  } else {
    console.log('No customer found with phone:', inputPhone);
    this.clearNonPhoneFields();
  }
}


clearNonPhoneFields() {
  const currentPhone = this.saleForm.get('customerPhone')?.value;
  this.saleForm.patchValue({
    customer: '',
    customerName: '',
    customerEmail: '',
    billingAddress: '',
    shippingAddress: '',
    alternateContact: '',
    customerAge: null,
    customerDob: null, // Add this line
    customerGender: '',
    // ... keep other fields as needed
    customerPhone: currentPhone // retain the entered phone
  });
}
checkPhoneExists() {
  const testPhone = '90371744955'; // The phone from your screenshot
  console.log('--- Checking for phone:', testPhone, '---');
  
  // Check all customers
  this.customers.forEach(customer => {
    console.log('Customer:', customer.displayName, '| Phone:', customer.mobile, '| Match:', 
      customer.mobile === testPhone ? 'YES' : 'NO');
  });
  
  // Check if exists
  const exists = this.customers.some(c => c.mobile === testPhone);
  console.log('Phone exists in system:', exists);
}
  private async getAgentCommission(userId: string): Promise<number> {
    return new Promise((resolve) => {
      const unsubscribe = this.commissionService.listenToSalesAgents((agents) => {
        const agent = agents.find(a => a.userId === userId);
        unsubscribe(); // Unsubscribe after getting the value
        resolve(agent ? agent.commissionPercentage : 0);
      });
    });
  }

  async onUserSelect(userId: string): Promise<void> {
    if (!userId) {
      // Clear department if no user is selected
      this.saleForm.patchValue({ department: '' });
      return;
    }
  
    // Find the selected user from the local list
    const selectedUser = this.users.find(u => u.id === userId);
  
    // Get commission percentage for selected user
    const commissionPercent = await this.getAgentCommission(userId);
  
    // Update department in the form
    this.saleForm.patchValue({
      department: selectedUser?.department || ''
    });
    
    // Update all products with this commission percentage
    this.products.forEach(product => {
      product.commissionPercent = commissionPercent;
      this.updateProduct(this.products.indexOf(product));
    });
    
    // Also update the default product
    this.defaultProduct.commissionPercent = commissionPercent;
    this.updateDefaultProduct();
  }


filterCustomers(): void {
  if (!this.customerSearchInput) {
    this.filteredCustomers = [...this.customers];
    return;
  }

  const filter = this.customerSearchInput.toUpperCase();
  
  this.filteredCustomers = this.customers.filter(customer => {
    // Create a search string that includes all relevant fields
    const searchString = [
      customer.displayName || '',
      customer.contactId || '',
      customer.mobile || '',
      customer.phone || '',
      customer.alternateContact || '',
      customer.landline || ''
    ]
    .filter(field => field)
    .join(' ')
    .toUpperCase();
    
    return searchString.includes(filter);
  });
}

 // Update loadUsers to return Promise
private loadUsers(): Promise<any[]> {
  return new Promise((resolve, reject) => {
    this.userService.getUsers().subscribe({
      next: (users: any[]) => {
        const formattedUsers = users.map(user => ({
          ...user,
          displayName: user.displayName || `${user.firstName} ${user.lastName}`.trim() || user.email
        }));
        this.users = formattedUsers;
        resolve(formattedUsers);
      },
      error: (error: any) => {
        console.error('Error loading users:', error);
        reject(error);
      }
    });
  });
}

  loadServiceTypes(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.typeOfServiceService.getServicesRealtime().subscribe({
        next: (services: Service[]) => {
          this.serviceTypes = services;
          resolve();
        },
        error: (error: any) => {
          console.error('Error loading service types:', error);
          reject(error);
        }
      });
    });
  }

  onServiceTypeChange(event: any): void {
    const serviceId = event.target.value;
    const selectedService = this.serviceTypes.find(s => s.id === serviceId);
    const serviceName = selectedService?.name?.toLowerCase() || '';
  
    // Reset both popups and their data initially
    this.showPpServicePopup = false;
    this.showCodPopup = false;
    this.ppServiceData = null;
    this.codData = null;
  
    // Exit if the user deselects the service
    if (!serviceId) {
      this.saleForm.patchValue({ typeOfService: '' });
      return;
    }
  
    // Handle COD service specifically
    if (serviceId === 'COD' || serviceName.includes('cod')) {
      this.showCodPopup = true;
      this.saleForm.patchValue({ typeOfService: serviceId });
    } 
    // Handle PP service OR ANY OTHER service by showing the PP popup
    else {
      this.showPpServicePopup = true;
      this.saleForm.patchValue({ typeOfService: serviceId });
    }
  
    // Determine if the transaction ID field should be shown (e.g., for payment-related services)
    this.showTransactionIdField = !!selectedService?.name && 
                              (serviceName.includes('pp') || 
                               serviceName.includes('payment'));
    
    // Add or remove validation for the transaction ID field based on visibility
    const transactionIdControl = this.saleForm.get('transactionId');
    if (transactionIdControl) {
      if (this.showTransactionIdField) {
        transactionIdControl.setValidators([Validators.required]);
      } else {
        transactionIdControl.clearValidators();
      }
      transactionIdControl.updateValueAndValidity();
    }
  }
// Add these new methods for COD handling
onCodFormSubmit(formData: any): void {
  this.codData = formData;
  this.showCodPopup = false;
  
  // CRITICAL FIX: Recalculate the total payable to include the new COD packing charge.
  this.calculateTotalPayable();
}
onCodClose(): void {
  this.showCodPopup = false;
  
  // If COD form was closed without submission, reset the service type
  if (!this.codData) {
    this.saleForm.patchValue({
      typeOfService: ''
    });
  }
}
onPpServiceFormSubmit(formData: any): void {
  this.ppServiceData = formData;
  this.showPpServicePopup = false;
  
  // Update the transaction ID if it's not already set
  if (formData.transactionId && !this.saleForm.get('transactionId')?.value) {
    this.saleForm.patchValue({
      transactionId: formData.transactionId
    });
  }
  
  // CRITICAL FIX: Recalculate the total payable to include the new PP service packing charge.
  this.calculateTotalPayable();
}
onPpServiceClose(): void {
  this.showPpServicePopup = false;
  
  // If PP service form was closed without submission, reset the service type
  if (!this.ppServiceData) {
    this.saleForm.patchValue({
      typeOfService: ''
    });
  }
}


 
  getCurrentUser(): string {
    return 'Current User';
  }

  
  loadBusinessLocations(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.locationService.getLocations().subscribe({
        next: (locations: any[]) => {
          this.businessLocations = locations;
          if (locations.length > 0) {
            this.saleForm.patchValue({ businessLocation: locations[0].id });
          }
          resolve();
        },
        error: (error: any) => {
          console.error('Error loading business locations:', error);
          reject(error);
        }
      });
    });
  }

  loadQuotationData(): void {
    const quotationData = localStorage.getItem('quotationToSalesOrder');
    if (quotationData) {
      const quotation = JSON.parse(quotationData);
      localStorage.removeItem('quotationToSalesOrder');
      
      this.saleForm.patchValue({
        customer: quotation.customerId,
        billingAddress: quotation.billingAddress || '',
        shippingAddress: quotation.shippingAddress || '',
        saleDate: this.datePipe.transform(quotation.saleDate, 'yyyy-MM-dd') || this.todayDate,
        status: 'Pending',
        invoiceScheme: quotation.invoiceScheme || '',
        discountType: quotation.discountType || 'Percentage',
        discountAmount: quotation.discountAmount || 0,
        orderTax: quotation.orderTax || 0,
      paymentStatus: quotation.paymentStatus || (quotation.status === 'Pending' ? 'Due' : 'Paid'), // Smart default
        sellNote: quotation.sellNote || '',
        shippingCharges: quotation.shippingCharges || 0,
        shippingStatus: quotation.shippingStatus || '',
        deliveryPerson: quotation.deliveryPerson || '',
        totalPayable: quotation.totalPayable || 0,
        paymentAmount: 0,
        paidOn: this.todayDate,
        paymentMethod: '',
        businessLocation: quotation.businessLocation || '',
        addedBy: this.currentUser,
      });
      
      
      if (quotation.salesOrder && quotation.salesOrder.length > 0) {
        this.products = quotation.salesOrder.map((item: any) => ({
          name: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice || 0,
          discount: item.discount || 0,
          subtotal: item.subtotal || (item.quantity * (item.unitPrice || 0)),
          taxRate: item.taxRate || 0,
          taxAmount: item.taxAmount || 0,
          cgstAmount: item.cgstAmount || 0,
          sgstAmount: item.sgstAmount || 0,
          igstAmount: item.igstAmount || 0,
          taxType: item.taxType || ''
        }));
        
        this.calculateItemsTotal();
        this.calculateTotalPayable();
      }
      
      setTimeout(() => {
        alert('Quotation data has been loaded. Please review and complete the sales order.');
      }, 500);
    }
  }

  toggleCustomerDropdown(): void {
    this.showCustomerDropdown = !this.showCustomerDropdown;
    if (this.showCustomerDropdown) {
      this.filterCustomers();
    }
  }
  toggleProductSelection(product: any): void {
    product.selected = !product.selected;
  }
  
  hasSelectedProducts(): boolean {
    return this.filteredProductsForInterested.some(p => p.selected);
  }
  getSelectedCount(): number {
    return this.filteredProductsForInterested.filter(p => p.selected).length;
  }
  addSelectedProducts(): void {
    const selectedProducts = this.filteredProductsForInterested.filter(p => p.selected);
    
    selectedProducts.forEach(product => {
      if (!this.selectedProductsForInterested.some(p => p.id === product.id)) {
        this.selectedProductsForInterested.push({...product});
      }
      // Reset selection
      product.selected = false;
    });
    
    this.productInterestedSearch = '';
    this.showProductsInterestedDropdown = false;
  }    

  
  removeInterestedProduct(product: any): void {
    this.selectedProductsForInterested = this.selectedProductsForInterested.filter(p => p.id !== product.id);
    
    // Also remove selection from filtered list if present
    const productInList = this.filteredProductsForInterested.find(p => p.id === product.id);
    if (productInList) {
      productInList.selected = false;
    }
  }

// Add this method to your component class
displayMedicineContent(medicine: Medicine): void {
  // This will show the medicine details in the UI
  // You can implement this based on how you want to display it
  console.log('Displaying medicine:', medicine);
  
  // If you want to show it in an alert for testing:
  alert(`Medicine: ${medicine.name}\nType: ${medicine.type}\nDosage: ${medicine.dosage || 'N/A'}`);
}


  // Update the loadCustomers method
loadCustomers(): Promise<void> {
  return new Promise((resolve, reject) => {
    this.customerService.getCustomers().subscribe({
      next: (customers: any[]) => {
        this.customers = customers.map(customer => ({
          ...customer,
          displayName: customer.businessName || 
                     `${customer.firstName || ''} ${customer.middleName ? customer.middleName + ' ' : ''}${customer.lastName || ''}`.trim(),
          contactId: customer.contactId || '',
          // Ensure landline is included in the customer object
          landline: customer.landline || ''
        }));
        
        this.filteredCustomers = [...this.customers];
        resolve();
      },
      error: (error: any) => {
        console.error('Error loading customers:', error);
        reject(error);
      }
    });
  });
}

  filterProducts(): void {
    if (!this.productSearchTerm) {
      this.filteredProducts = [...this.allProducts];
      return;
    }
    
    const searchTerm = this.productSearchTerm.toLowerCase();
    this.filteredProducts = this.allProducts.filter(product => 
      product.productName.toLowerCase().includes(searchTerm)
    );
  }
 
  initializeForm(): void {
    this.saleForm = this.fb.group({
      customer: ['', Validators.required],
      customerName: [''],
      invoiceNo: ['', Validators.required],
      orderNo: ['', Validators.required],
      customerPhone: ['', Validators.required],  // Make sure this exists
      transactionId: [''],
       customerAge: [null],
    customerDob: [null],
    customerGender: [''],
    customerOccupation: [''],
        productsInterested: [[]], // Add this line for products interested

      productInterested: [''], // Add this line
      status: ['Completed', Validators.required], // Set default to 'Completed'
      orderStatus: ['Pending'], // New field added here
      paymentStatus: ['Due'],
    alternateContact: [''], // Add this line

      customerEmail: [''],
    serviceCharge: [0], // Add this new control

          shippingDetails: [''], // Add this new control

      roundOff: [0], // Add this line
   productTaxAmount: [0],
    shippingTaxAmount: [0],
    codTaxAmount: [0],
    ppTaxAmount: [0],
      customerSearch: [''],
      creditLimit: [0],
      otherData: [''],
      paymentAccount: [''],
    prescriptions: [[]], // Optional (no Validators.required)

      typeOfService: [''],
      billingAddress: [''],
      shippingAddress: [''],
      saleDate: [this.todayDate, Validators.required],
      businessLocation: ['', Validators.required],
      invoiceScheme: [''],
      document: [null],
      discountType: ['Percentage'],
      discountAmount: [0, [Validators.min(0)]],
    orderTax: [18, [Validators.min(0), Validators.max(100)]], // Changed from 0 to 18
      sellNote: [''],
      shippingCharges: [0, [Validators.min(0)]],
      shippingStatus: [''],
      deliveryPerson: [''],
      shippingDocuments: [null],
      totalPayable: [0],
      paymentAmount: [0, [Validators.required, Validators.min(0)]],
  paidOn: [null], // CHANGE THIS from [this.todayDate] to [null]
      paymentMethod: [''],
      paymentNote: [''],
      changeReturn: [0],
      balance: [0],
 addedBy: ['', Validators.required],
      department: [''], // <-- Add the new department form contro      
    });

    this.saleForm.get('addedBy')?.valueChanges.subscribe(userId => {
      this.onUserSelect(userId);
    });
    this.saleForm.get('status')?.valueChanges.subscribe(status => {
      if (status === 'Pending') {
        this.saleForm.patchValue({ paymentStatus: 'Due' });
      }
    });
  this.afterTaxShippingControl.valueChanges.subscribe(value => {
    this.onAfterTaxShippingChange(value);
      this.saleForm.setValidators([this.atLeastOneProductValidator.bind(this)]);


});
  }
  // Custom validator to ensure at least one product is added
private atLeastOneProductValidator(): ValidationErrors | null {
  return (this.products.length > 0 || 
         (this.defaultProduct.name && this.defaultProduct.quantity > 0)) ? 
         null : { noProducts: true };
}
onAfterTaxShippingChange(afterTaxValue: string | number | null): void {
  if (!afterTaxValue) return;
  
  const numericValue = typeof afterTaxValue === 'string' ? 
                      parseFloat(afterTaxValue) : 
                      afterTaxValue;
  
  if (isNaN(numericValue)) return;

  const taxRate = this.saleForm.get('orderTax')?.value || 0;
  
  if (taxRate > 0) {
    // Calculate before-tax amount: afterTax = beforeTax * (1 + taxRate/100)
    const beforeTax = numericValue / (1 + (taxRate / 100));
    this.saleForm.patchValue({
      shippingCharges: parseFloat(beforeTax.toFixed(2))
    }, { emitEvent: false }); // prevent infinite loop
  } else {
    // No tax - amounts are the same
    this.saleForm.patchValue({
      shippingCharges: numericValue
    }, { emitEvent: false });
  }
  
  // Recalculate totals
  this.calculateTotalPayable();
  }
  
async loadCurrentUser(): Promise<void> {
  const currentUserValue = this.authService.currentUserValue;
  if (currentUserValue) {
    this.currentUser = currentUserValue.displayName || currentUserValue.email;
    
    // Find the user in the users list and set as default
    this.users = await this.loadUsers();
    const loggedInUser = this.users.find(u => u.id === currentUserValue.uid);
    
    if (loggedInUser) {
      this.saleForm.patchValue({
        addedBy: loggedInUser.id
      });
      
      // Also update the commission percentage
      const commissionPercent = await this.getAgentCommission(loggedInUser.id);
      this.defaultProduct.commissionPercent = commissionPercent;
      this.updateDefaultProduct();
    }
  }
}




onDynamicProductSelect(productName: string, index: number): void {
  if (!productName) {
    this.resetProductAtIndex(index);
    return;
  }

  const selectedProduct = this.allProducts.find(p => p.productName === productName);
  if (selectedProduct) {
    // Remove the stock check condition
    this.populateProductAtIndex(selectedProduct, index);
  }
}

private resetProductAtIndex(index: number): void {
  this.products[index] = {
    name: '',
    quantity: 1,
    unitPrice: 0,
    discount: 0,
    subtotal: 0,
    commissionPercent: 0,
    commissionAmount: 0,
    priceBeforeTax: 0,
    taxIncluded: false,
    discountType: 'Amount',
    batchNumber: '',
    expiryDate: '',
    taxRate: 0,
    taxAmount: 0,
    cgstAmount: 0,
    sgstAmount: 0,
    igstAmount: 0,
    taxType: ''
  };
  this.updateProduct(index);
}

private populateProductAtIndex(selectedProduct: any, index: number): void {
  this.products[index].name = selectedProduct.productName;
  this.products[index].priceBeforeTax = selectedProduct.defaultSellingPriceExcTax || 0;
  
  const taxRate = selectedProduct.taxRate !== undefined
    ? selectedProduct.taxRate
    : (selectedProduct.applicableTax ? selectedProduct.applicableTax.percentage : 0);
  
  this.products[index].taxRate = taxRate;
  this.products[index].unitPrice = selectedProduct.defaultSellingPriceIncTax ||
    (this.products[index].priceBeforeTax * (1 + (taxRate / 100)));
  this.products[index].quantity = 1;
  this.products[index].batchNumber = selectedProduct.batchNumber || '';
  this.products[index].expiryDate = selectedProduct.expiryDate || '';
  
  this.updateProduct(index);
}

  setupValueChanges(): void {
    this.saleForm.get('paymentAmount')?.valueChanges.subscribe(() => {
      this.calculateBalance();
    });

    this.saleForm.get('discountAmount')?.valueChanges.subscribe(() => {
      this.calculateTotalPayable();
    });

    this.saleForm.get('orderTax')?.valueChanges.subscribe(() => {
      this.calculateTotalPayable();
    });
this.saleForm.get('customer')?.valueChanges.subscribe(customerId => {
    if (customerId) {
      const customer = this.customers.find(c => c.id === customerId);
      if (customer) {
        this.prescriptionData.patientName = customer.displayName || 
                                          `${customer.firstName || ''} ${customer.lastName || ''}`.trim() ||
                                          customer.businessName;
      }
    }
  });
    this.saleForm.get('shippingCharges')?.valueChanges.subscribe(() => {
      this.calculateTotalPayable();
    });

    this.saleForm.get('discountType')?.valueChanges.subscribe(() => {
      this.calculateTotalPayable();
    });
    this.saleForm.get('addedBy')?.valueChanges.subscribe(userId => {
      this.onUserSelect(userId);
    });
  }


updateDefaultProduct(): void {
  const product = this.defaultProduct;
  const selectedProduct = this.allProducts.find(p => p.productName === product.name);
  
  if (selectedProduct) {
    if (product.quantity > selectedProduct.currentStock) {
      alert(`Cannot increase quantity. Only ${selectedProduct.currentStock} items available for "${product.name}".`);
      product.quantity = selectedProduct.currentStock;
    }
    
    // Set default tax rate from product if not set
    if (!product.taxRate && selectedProduct.taxRate) {
      product.taxRate = selectedProduct.taxRate;
    }
  }

  // Calculate tax for the product
  this.calculateProductTax(product);

  // Calculate in both directions based on which field was changed
  if (product.priceBeforeTax !== undefined && product.taxRate !== undefined) {
    // If priceBeforeTax changed, calculate unitPrice (MRP)
    product.unitPrice = product.priceBeforeTax * (1 + (product.taxRate / 100));
  } else if (product.unitPrice !== undefined && product.taxRate !== undefined) {
    // If unitPrice (MRP) changed, calculate priceBeforeTax
    product.priceBeforeTax = product.unitPrice / (1 + (product.taxRate / 100));
  }

  // Calculate subtotal with tax-inclusive price
  const subtotalBeforeDiscount = product.quantity * product.unitPrice;
  
  // Calculate discount amount based on type
  let discountAmount = 0;
  if (product.discountType === 'Percentage') {
    discountAmount = (subtotalBeforeDiscount * product.discount) / 100;
  } else {
    discountAmount = product.discount;
  }
  
  const discountedSubtotal = subtotalBeforeDiscount - discountAmount;
  
  product.commissionAmount = (product.commissionPercent || 0) / 100 * discountedSubtotal;
  product.subtotal = discountedSubtotal - product.commissionAmount;
  
  this.calculateItemsTotal();
  this.calculateTotalPayable();
  this.calculateTaxes();
}
// In src/app/add-sale/add-sale.component.ts


// Fix 1: Update the addProduct() method
addProduct(): void {
  // First add the current default product if it has data
  if (this.defaultProduct.name || this.defaultProduct.quantity > 0 || this.defaultProduct.unitPrice > 0) {
    const productToAdd: Product = {
      ...this.defaultProduct,
      // Ensure all tax properties are included
      taxAmount: this.defaultProduct.taxAmount || 0,
      cgstAmount: this.defaultProduct.cgstAmount || 0,
      sgstAmount: this.defaultProduct.sgstAmount || 0,
      igstAmount: this.defaultProduct.igstAmount || 0,
      taxType: this.defaultProduct.taxType || ''
    };
    this.products.push(productToAdd);
  }

  // Then reset the default product with all properties
  this.defaultProduct = {
    name: '',
    quantity: 1,
    unitPrice: 0,
    discount: 0,
    discountType: 'Amount',
    commissionPercent: this.defaultProduct.commissionPercent || 0,
    commissionAmount: 0,
    subtotal: 0,
    priceBeforeTax: 0,
    taxIncluded: false,
    batchNumber: '',
    expiryDate: '',
    taxRate: 0,
    taxAmount: 0,
    cgstAmount: 0,
    sgstAmount: 0,
    igstAmount: 0,
    taxType: ''
  };

  // Force change detection
  this.changeDetectorRef.detectChanges();
  
  // Focus on the first field of the new row
  setTimeout(() => {
    const lastIndex = this.products.length - 1;
    if (lastIndex >= 0) {
      const firstField = document.getElementById(`productName_${lastIndex}`);
      if (firstField) {
        firstField.focus();
      }
    }
  });
}


  updateProductDiscount(index: number, type: 'Percentage' | 'Amount'): void {
  const product = this.products[index];
  // Calculate total gross based on MRP (Selling Price Inc Tax)
  const totalGross = (product.unitPrice || 0) * (product.quantity || 1);

  if (type === 'Percentage') {
    // If percentage changed, calculate the amount
    const percent = Number(product.discountPercentage) || 0;
    product.discountAmount = parseFloat(((totalGross * percent) / 100).toFixed(2));
    product.discountType = 'Percentage';
  } else {
    // If amount changed, calculate the percentage
    const amt = Number(product.discountAmount) || 0;
    if (totalGross > 0) {
      product.discountPercentage = parseFloat(((amt / totalGross) * 100).toFixed(2));
    } else {
      product.discountPercentage = 0;
    }
    product.discountType = 'Amount';
  }
  
  // Sync the 'discount' property used for final subtotal subtraction
  product.discount = product.discountAmount || 0;
  
  // Trigger core product update
  this.updateProduct(index);
}

removeProduct(index: number): void {
  const product = this.products[index];
  
  // If removing a combination product, remove its components too
  if (product.isCombination) {
    this.products = this.products.filter((p, i) => 
      i === index || p.parentCombinationId !== product.id
    );
  } 
  // If removing a component, update the parent combination
  else if (product.parentCombinationId) {
    const parentIndex = this.products.findIndex(p => p.id === product.parentCombinationId);
    if (parentIndex >= 0) {
      const parentProduct = this.products[parentIndex];
      // Remove the component from the parent's combinationProducts array
      if (parentProduct.combinationProducts) {
        parentProduct.combinationProducts = parentProduct.combinationProducts.filter(
          cp => cp.productId !== product.id
        );
      }
    }
    this.products.splice(index, 1);
  } 
  // Regular product
  else {
    this.products.splice(index, 1);
  }
  
  this.calculateItemsTotal();
  this.calculateTotalPayable();
}
getParentProductName(parentId: string | undefined): string {
  if (!parentId) return '';
  const parentProduct = this.products.find(p => p.id === parentId);
  return parentProduct ? parentProduct.name : '';
}
calculateShippingWithTax(): number {
  const shippingBeforeTax = this.saleForm.get('shippingCharges')?.value || 0;
  const taxRate = this.saleForm.get('orderTax')?.value || 18; // Default to 18 if not set
  
  const shippingTax = shippingBeforeTax * (taxRate / 100);
  const shippingWithTax = shippingBeforeTax + shippingTax;
  
  // Update the form with tax amounts
  this.saleForm.patchValue({
    shippingTaxAmount: shippingTax
  });
  
  return shippingWithTax;
}


  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.saleForm.patchValue({ document: file.name });
    }
  }
  
  onCustomerChange(event: any): void {
    const customerId = event.target.value;
    const selectedCustomer = this.customers.find(c => c.id === customerId);
    if (selectedCustomer) {
      this.saleForm.patchValue({
        customerPhone: selectedCustomer.mobile || selectedCustomer.phone || '',
        billingAddress: selectedCustomer.address || '',
        shippingAddress: selectedCustomer.address || ''
      });
      this.customerSearchInput = selectedCustomer.displayName;
    }
  }

  onCustomerBlur(): void {
    setTimeout(() => {
      this.showCustomerDropdown = false;
    }, 200);
  }
  
  onCustomerSearchFocus(): void {
    this.showCustomerDropdown = true;
    this.filterCustomers();
  }
  onShippingDocumentSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      // Convert FileList to File[] and add to existing documents
      const newFiles = Array.from(input.files) as File[];
      this.shippingDocuments = [...this.shippingDocuments, ...newFiles];
    }
  }
  removeShippingDocument(doc: File): void {
    this.shippingDocuments = this.shippingDocuments.filter(d => d !== doc);
  }

  async uploadShippingDocuments(saleId: string): Promise<string[]> {
    if (!this.shippingDocuments.length) return [];
    
    const uploadedUrls: string[] = [];
    
    // Your upload implementation here
    for (const doc of this.shippingDocuments) {
      // Simulate upload - replace with actual upload code
      const mockUrl = `https://storage.example.com/sales/${saleId}/shipping-docs/${doc.name}`;
      uploadedUrls.push(mockUrl);
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    return uploadedUrls;
  }

savePrescription(): void {
  // First save any changes from editable fields
  this.savePrescriptionData();
  
  if (this.editingPrescriptionIndex !== null) {
    // Update existing prescription
    this.prescriptions[this.editingPrescriptionIndex] = {...this.prescriptionData};
  } else {
    // Add new prescription
    this.prescriptions.push({...this.prescriptionData});
  }
  
  // Close the modal
  if (this.currentPrescriptionModal) {
    this.currentPrescriptionModal.hide();
  }
  
  this.editingPrescriptionIndex = null;
  this.resetPrescriptionData();
  
  // Show success message
  this.showToast('Prescription saved successfully!', 'success');
}

resetPrescriptionData(): void {
  const currentPatientName = this.prescriptionData.patientName;
  this.prescriptionData = {
    medicines: [],
    patientName: currentPatientName || this.saleForm.get('customerName')?.value || '',
    date: this.todayDate,
    additionalNotes: ''
  };
}



// In AddSaleComponent
private async generateAndSetNumbers(): Promise<void> {
  try {
    const invoiceNumber = await this.generateInvoiceNumber();
    const orderNumber = await this.generateOrderNumber();
    
    this.saleForm.patchValue({
      invoiceNo: invoiceNumber,
      orderNo: orderNumber
    });
  } catch (error) {
    console.error('Error setting numbers:', error);
  }
}
  updateProduct(index: number): void {
  const product = this.products[index];

  // 1. Get the current tax rate percentage
  const taxRateValue = product.taxRateObject ? product.taxRateObject.rate : (product.taxRate || 0);
  product.taxRate = taxRateValue;

  // 2. Calculate Total Gross (Quantity * Selling Price/MRP)
  const totalGross = (product.unitPrice || 0) * (product.quantity || 1);

  // 3. Ensure discount is subtracted (This fixes your issue)
  const discountAmount = Number(product.discountAmount) || 0;
  product.discount = discountAmount;

  // 4. Calculate Subtotal (The actual amount payable for this row)
  product.subtotal = parseFloat((totalGross - discountAmount).toFixed(2));

  // 5. Back-calculate Tax and Price Before Tax based on the Subtotal
  // Logic: Taxable Value = Subtotal / (1 + Rate/100)
  if (taxRateValue > 0) {
    const taxableValue = product.subtotal / (1 + (taxRateValue / 100));
    product.taxAmount = parseFloat((product.subtotal - taxableValue).toFixed(4));
    
    // Update priceBeforeTax (unit price excluding tax) for accounting
    product.priceBeforeTax = parseFloat((taxableValue / (product.quantity || 1)).toFixed(2));
  } else {
    product.taxAmount = 0;
    product.priceBeforeTax = product.unitPrice;
  }

  // 6. Calculate GST Breakdown (CGST/SGST/IGST)
  this.calculateProductTax(product);

  // 7. Calculate row-level commission if applicable
  const discountedSubtotal = product.subtotal;
  product.commissionAmount = ((product.commissionPercent || 0) / 100) * discountedSubtotal;

  // 8. Refresh footer totals
  this.calculateItemsTotal();
  this.calculateTotalPayable();
}
private async generateOrderNumber(): Promise<string> {
  try {
    // Get current date parts
    const today = new Date();
    const month = (today.getMonth() + 1).toString().padStart(2, '0'); // 07 for July
    const day = today.getDate().toString().padStart(2, '0'); // 25 for 25th
    const yearShort = today.getFullYear().toString().slice(-2); // 25 for 2025
    
    // Generate a random 4-digit number
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    
    // Format as ORD-MMDD-YYYY-RANDOM (e.g., ORD-0725-25-1234)
    return `ORD-${month}${day}-${yearShort}-${randomNum}`;
  } catch (error) {
    console.error('Error generating order number:', error);
    // Fallback with timestamp if error occurs
    return `ORD-${new Date().getTime().toString().slice(-8)}`;
  }
}
private markFormGroupTouched(formGroup: FormGroup): void {
  Object.values(formGroup.controls).forEach(control => {
    control.markAsTouched();
    if (control instanceof FormGroup) {
      this.markFormGroupTouched(control);
    }
  });
}
// Fix 2: Update the resetForm() method
resetForm(): void {
  this.saleForm.reset({
    date: new Date(),
    invoiceNo: '',
    customer: '',
        paidOn: null, // ADD OR UPDATE THIS LINE to be null

    businessLocation: '',
    paymentStatus: '',
    typeOfService: '',
    addedBy: this.currentUser
  });

  this.defaultProduct = {
    name: '',
    quantity: 0,
    unitPrice: 0,
    discount: 0,
    discountType: 'Amount',
    commissionPercent: 0,
    commissionAmount: 0,
    subtotal: 0,
    priceBeforeTax: 0,
    taxIncluded: false,
    taxRate: 0,
    taxAmount: 0,
    cgstAmount: 0,
    sgstAmount: 0,
    igstAmount: 0,
    taxType: ''
  };
  
  this.itemsTotal = 0;
  this.totalCommission = 0;
  this.customerSearchInput = '';
  this.showCustomerDropdown = false;

  this.saleForm.markAsPristine();
  this.saleForm.markAsUntouched();
}
}

function then(arg0: () => void) {
  throw new Error('Function not implemented.');
}