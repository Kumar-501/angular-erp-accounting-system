import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
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


interface Product {
  id?: string;
  name: string;
  productName?: string;
  sku?: string;
  discountType: 'Amount' | 'Percentage'; 
  barcode?: string;
  stockByLocation?: { [locationId: string]: number }; // Add this
  totalQuantity?: number; // Add this line
  manageStock?: boolean; 
  taxType?: string; // 'CGST+SGST' or 'IGST'
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  lastNumber?: string;
  lastNumbers?: string[];
  currentStock?: number;
  defaultSellingPriceExcTax?: number;
  defaultSellingPriceIncTax?: number;
    batchNumber?: string; // Add this line
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
    [key: string]: any;
  quantity?: string;
}
// Define the PrescriptionData interface
interface PrescriptionData {
  patientName: any;
  date: string;
  medicines: Medicine[];
    patientAge?: string; // Add this line
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
  todayDate: string;
  products: Product[] = [];
  lastInteractionTime = 0;
  showProductsInterestedDropdown = false;
  productInterestedSearch = '';
  allProductsSelected: boolean = false;

  filteredProductsForInterested: any[] = [];
  prescriptions: PrescriptionData[] = [];
editingPrescriptionIndex: number | null = null;
  currentPrescriptionModal: any;
  discount: number | undefined;
  discountType: 'Amount' | 'Percentage' | undefined; 
  selectedProductsForInterested: any[] = [];
  selectedPaymentAccount: any = null;
  isFromLead: boolean = false;
  taxAmount: number = 0;
// Add this in your component class
availableTaxRates: TaxRate[] = [];

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
    private authService: AuthService,
    private changeDetectorRef: ChangeDetectorRef,
        private toastr: ToastrService,




  ) {
    this.todayDate = this.datePipe.transform(new Date(), 'yyyy-MM-dd') || '';
    this.currentUser = this.getCurrentUser();
    this.checkForLeadData();

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
  { value: 'kasayam', label: 'Kasayam (കഷായം)' },
  { value: 'buligha', label: 'Buligha (ഗുളിക)' },
  { value: 'bhasmam', label: 'Bhasmam (ഭസ്മം)' },
  { value: 'krudham', label: 'Krudham (ഘൃതം)' },
  { value: 'suranam', label: 'Suranam (ചൂർണ്ണം)' },
  { value: 'rasayanam', label: 'Rasayanam (രസായനം)' },
  { value: 'lagium', label: 'Lagium (ലേഹ്യം)' }
];

selectMedicineType(type: string): void {
  this.selectedMedicineType = type;
}

// Keep your existing addMedicineByType() and addSameMedicineType() methods
  getMedicineTypeName(type: string): string {
  const typeNames: {[key: string]: string} = {
    'kasayam': 'Kasayam (കഷായം)',
    'buligha': 'Buligha (ഗുളിക)',
    'bhasmam': 'Bhasmam (ഭസ്മം)',
    'krudham': 'Krudham (ഘൃതം)',
    'suranam': 'Suranam (ചൂർണ്ണം)',
    'rasayanam': 'Rasayanam (രസായനം)',
    'lagium': 'Lagium (ലേഹ്യം)'
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

  // Set default values based on type
  switch(this.selectedMedicineType) {
    case 'kasayam':
      newMedicine.instructions = '';
      newMedicine.quantity = '';
      newMedicine.powder = '';
      newMedicine.pills = '';
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
      break;
    case 'suranam':
      newMedicine.instructions = '';
      newMedicine.powder = '';
      newMedicine.dosage = '';
      break;
    case 'rasayanam':
      newMedicine.instructions = '';
      break;
    case 'lagium':
      newMedicine.instructions = '';
      newMedicine.dosage = '';
      break;
    // Other types don't need additional defaults
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
    customerDob: customerData.dob ? this.formatDateForInput(customerData.dob) : null,
    customerGender: customerData.gender || '',
    customerOccupation: customerData.occupation || '',
    creditLimit: customerData.creditLimit || 0,
    otherData: customerData.notes || '',
    sellNote: customerData.notes || '',
    assignedTo: customerData.assignedTo || customerData.assignedToId || ''
  });

  // Also update any additional fields that might be in your form
  this.saleForm.patchValue({
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
openPrescriptionModal(): void {
  // Reset if not editing
  if (this.editingPrescriptionIndex === null) {
    this.resetPrescriptionData();
    
    // Set patient name from form if not set
    if (!this.prescriptionData.patientName) {
      this.prescriptionData.patientName = this.saleForm.get('customerName')?.value || '';
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
  }
}


// Add this method to handle content editable changes
onContentEditableChange(event: any, field: string, index: number): void {
  const value = event.target.textContent || event.target.innerText || '';
  
  if (this.prescriptionData.medicines[index]) {
    // Update the medicine object directly
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
  
  // Small delay to ensure modal is fully rendered
  setTimeout(() => {
    this.updateFormFieldsFromPrescription();
  }, 100);
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
  // Update patient name and date
  const patientNameElement = document.getElementById('patientName');
  if (patientNameElement) {
    patientNameElement.textContent = this.prescriptionData.patientName;
  }

  const patientAgeElement = document.getElementById('patientAge');
  if (patientAgeElement) {
    patientAgeElement.textContent = this.prescriptionData.patientAge || '';
  }

  // Update each medicine field
  this.prescriptionData.medicines.forEach((medicine, index) => {
    // Common fields
    this.setEditableField(`medicineName_${index}`, medicine.name);
    
    // Type-specific fields
    switch(medicine.type) {
      case 'kasayam':
        this.setEditableField(`kasayamName_${index}`, medicine.name);
        this.setEditableField(`kasayamInstructions_${index}`, medicine.instructions);
        this.setEditableField(`kasayamQuantity_${index}`, medicine.quantity);
        this.setEditableField(`kasayamPowder_${index}`, medicine.powder);
        this.setEditableField(`kasayamPills_${index}`, medicine.pills);
        
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
        break;
      case 'suranam':
        this.setEditableField(`suranamName_${index}`, medicine.name);
        this.setEditableField(`suranamInstructions_${index}`, medicine.instructions);
        this.setEditableField(`suranamPowder_${index}`, medicine.powder);
        this.setEditableField(`suranamDosage_${index}`, medicine.dosage);
        break;
      case 'rasayanam':
        this.setEditableField(`rasayanamName_${index}`, medicine.name);
        this.setEditableField(`rasayanamInstructions_${index}`, medicine.instructions);
        break;
      case 'lagium':
        this.setEditableField(`lagiumName_${index}`, medicine.name);
        this.setEditableField(`lagiumInstructions_${index}`, medicine.instructions);
        // this.setEditableField(`suranamPowder_${index}`, medicine.powder);
        this.setEditableField(`lagiumDosage_${index}`, medicine.dosage);
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


p: any
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
      const kasayamPills = this.getEditableFieldContent(`kasayamPills_${index}`) || medicine.pills || '';
      
      
      details += `
        <p>${kasayamName}കഷായം ${kasayamInstructions}ml എടുത്ത് ${kasayamQuantity}ml തിളപ്പിച്ചാറ്റിയവെള്ളം ചേർത്ത് ${kasayamPowder}. 
        ഗുളിക . പൊടിച്ച്ചേർത്ത് ${kasayamPills} നേരം ഭക്ഷണത്തിനുമുൻപ് / ശേഷംസേവിക്കുക.</p>
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
      details += `
        <p>${krudhamName} ഘൃതം ഒരു ടീ - സ്പൂൺ എടുത്ത ${krudhamInstructions} നേരം ഭക്ഷണത്തിനു മുൻപ് / ശേഷം സേവിക്കുക.</p>
      `;
      break;
      
    case 'suranam':
      const suranamName = this.getEditableFieldContent(`suranamName_${index}`) || medicine.name || '';
      const suranamInstructions = this.getEditableFieldContent(`suranamInstructions_${index}`) || medicine.instructions || '';
      const suranamPowder = this.getEditableFieldContent(`suranamPowder_${index}`) || medicine.powder || '';
      const suranamDosage = this.getEditableFieldContent(`suranamDosage_${index}`) || medicine.dosage || '';
      
      details += `
        <p>${suranamName}ചൂർണ്ണം ${suranamInstructions}ml. ടീ - സ്പൂൺ എടുത്ത്  ${suranamPowder} വെള്ളത്തിൽ ചേർത്ത് തിളപ്പിച്ച് ${suranamDosage} നേരം ഭക്ഷണത്തിനുമുൻപ് / ശേഷം സേവിക്കുക.</p>
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
      const lagiumName = this.getEditableFieldContent(`lagiumName${index}`) || medicine.name || '';
    
      const lagiumInstructions = this.getEditableFieldContent(`lagiumInstructions_${index}`) || medicine.instructions || '';
      const lagiumDosage = this.getEditableFieldContent(`lagiumDosage_${index}`) || medicine.dosage || '';

      details += `
        <p>${lagiumName}ലേഹ്യം ${lagiumInstructions} ടീ - സ്പൂൺ എടുത്ത് നേരം ${lagiumDosage} നേരം ഭക്ഷണത്തിനു മുൻപ് / ശേഷം സേവിക്കുക.</p>
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

  // Update each medicine with current values
  this.prescriptionData.medicines.forEach((medicine, index) => {
    // Common fields
    medicine.name = this.getEditableFieldContent(`kasayamName_${index}`) || medicine.name;
    
    // Type-specific fields
    switch(medicine.type) {
      case 'kasayam':
         medicine.instructions = this.getEditableFieldContent(`kasayamInstructions_${index}`) || medicine.instructions || '';
        medicine.pills = this.getEditableFieldContent(`kasayamPills_${index}`) || medicine.pills || '';
        medicine.quantity = this.getEditableFieldContent(`kasayamQuantity_${index}`) || medicine.quantity || '';
        medicine.powder = this.getEditableFieldContent(`kasayamPowder_${index}`) || medicine.powder || '';
        medicine.time = this.getEditableFieldContent(`kasayamTime_${index}`) || medicine.time || '';
        break;
        
      case 'buligha':
        medicine.name = this.getEditableFieldContent(`bulighaName_${index}`) || medicine.name || '';
      medicine.instructions = this.getEditableFieldContent(`bulighaInstructions_${index}`) || medicine.instructions || '';
      medicine.powder = this.getEditableFieldContent(`bulighaPowder_${index}`) || medicine.powder || '';
        break;
        
      case 'bhasmam':
        medicine.name = this.getEditableFieldContent(`bhasmamName_${index}`) || medicine.name || '';
      medicine.dosage = this.getEditableFieldContent(`bhasmamDosage_${index}`) || medicine.dosage || '';
      medicine.quantity = this.getEditableFieldContent(`bhasmamQuantity_${index}`) || medicine.quantity || '';
      medicine.instructions = this.getEditableFieldContent(`bhasmamInstructions_${index}`) || medicine.instructions || '';
      medicine.powder = this.getEditableFieldContent(`bhasmamPowder_${index}`) || medicine.powder || '';
        break;
        
      case 'krudham':
        medicine.name = this.getEditableFieldContent(`krudhamName_${index}`) || medicine.name || '';
      medicine.instructions = this.getEditableFieldContent(`krudhamInstructions_${index}`) || medicine.instructions || '';
        break;
        
      case 'suranam':
        medicine.name = this.getEditableFieldContent(`suranamName_${index}`) || medicine.name || '';
      medicine.instructions = this.getEditableFieldContent(`suranamInstructions_${index}`) || medicine.instructions || '';
      medicine.powder = this.getEditableFieldContent(`suranamPowder_${index}`) || medicine.powder || '';
      medicine.dosage = this.getEditableFieldContent(`suranamDosage_${index}`) || medicine.dosage || '';
        break;
        
      case 'rasayanam':
        medicine.name = this.getEditableFieldContent(`rasayanamName_${index}`) || medicine.name || '';
      medicine.instructions = this.getEditableFieldContent(`rasayanamInstructions_${index}`) || medicine.instructions || '';
        break;
        
      case 'lagium':
         medicine.name = this.getEditableFieldContent(`lagiumName_${index}`) || medicine.name || '';
      medicine.instructions = this.getEditableFieldContent(`lagiumInstructions_${index}`) || medicine.instructions || '';
      medicine.dosage = this.getEditableFieldContent(`lagiumDosage_${index}`) || medicine.dosage || '';
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
            productsInterested: lead.products || [],
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
  // Build the full address string
  const addressParts = [
    customer.addressLine1,
    customer.addressLine2,
    customer.city,
    customer.state,
    customer.country,
    customer.zipCode
  ].filter(part => part);
  
  const fullAddress = addressParts.join(', ');
  
  // Prioritize mobile over phone number, then alternate contact, then landline
  const phoneNumber = customer.mobile || customer.phone || customer.alternateContact || customer.landline || '';

  // Format the date of birth for the input field
  let formattedDob = '';
  if (customer.dob) {
    // Handle both string and Date object formats
    const dobDate = customer.dob instanceof Date ? customer.dob : new Date(customer.dob);
    if (!isNaN(dobDate.getTime())) {
      formattedDob = this.datePipe.transform(dobDate, 'yyyy-MM-dd') || '';
    }
  }

  this.saleForm.patchValue({
    customer: customer.id,
    customerName: customer.displayName,
    customerPhone: phoneNumber,
    customerEmail: customer.email || '',
    billingAddress: fullAddress,
    shippingAddress: fullAddress,
    alternateContact: customer.alternateContact || '',
    customerAge: customer.age || null,
    customerDob: formattedDob, 
    customerGender: customer.gender || '',
    customerOccupation: customer.occupation || '',
    creditLimit: customer.creditLimit || 0,
    otherData: customer.otherData || customer.notes || '',
  });
  
  this.customerSearchInput = customer.displayName;
  this.showCustomerDropdown = false;
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
      // Apply filters first
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
      currentStock: product.currentStock || product.totalQuantity || 0, // Use both possible stock fields
      defaultSellingPriceExcTax: product.defaultSellingPriceExcTax || 0,
      selected: product.selected || false
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

addProductFromSearch(product: any) {
  const unitPrice = product.defaultSellingPriceIncTax || product.defaultSellingPriceExcTax || 0;
  
  const existingProductIndex = this.products.findIndex(p => 
    p.name === product.productName || p.productName === product.productName
  );
  
  if (existingProductIndex >= 0) {
    // Update existing product quantity
    this.products[existingProductIndex].quantity += 1;
    this.updateProduct(existingProductIndex);
  } else {
    // Create new product with all stock information
    const newProduct: Product = {
      name: product.productName,
      productName: product.productName,
      sku: product.sku,
      barcode: product.barcode,
      priceBeforeTax: product.defaultSellingPriceExcTax || 0,
      taxIncluded: !!product.defaultSellingPriceIncTax,
      unitPrice: unitPrice,
      currentStock: product.currentStock || product.totalQuantity || 0, // Include both possible stock fields
      defaultSellingPriceExcTax: product.defaultSellingPriceExcTax,
      defaultSellingPriceIncTax: product.defaultSellingPriceIncTax,
      taxRate: product.taxRate || (product.applicableTax?.percentage || 0),
      quantity: 1,
      discount: 0,
      commissionPercent: this.defaultProduct.commissionPercent || 0,
      commissionAmount: 0,
      subtotal: unitPrice,
      batchNumber: product.batchNumber || '',
      expiryDate: product.expiryDate || '',
      discountType: 'Amount',
      taxAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      taxType: '',
      // Add these stock-related properties
      stockByLocation: product.stockByLocation || {},
      totalQuantity: product.totalQuantity || product.currentStock || 0,
      manageStock: product.manageStock !== false 
    };
    this.products.push(newProduct);
    this.updateProduct(this.products.length - 1);
  }
  
  this.clearSearch();
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


ngOnInit(): void {
    this.initializeForm();
  this.setupValueChanges();
  this.generateAndSetNumbers();
  this.loadTaxRates(); // This should populate availableTaxRates
  this.loadPaymentAccounts();
  this.prefillCurrentUser();
  this.todayDate = this.datePipe.transform(this.currentDate, 'yyyy-MM-dd') || '';

   this.saleForm.get('totalPayable')?.valueChanges.subscribe(() => {
    this.calculateRoundOff();
  });
    this.debugCustomerPhones();
    
  const storedData = localStorage.getItem('convertedLeadForSale');
    if (storedData) {
      const { customerData, isExistingCustomer, leadId } = JSON.parse(storedData);
      
      // Prefill the form with customer data
      this.prefillCustomerData(customerData);
      
      // Store the lead ID for later deletion
      this.leadIdToDelete = leadId;
      
      // Clear the stored data
      localStorage.removeItem('convertedLeadForSale');
    }
  
  this.checkPhoneExists(); // Add this line
  this.debugCustomerPhones(); // Add this line

  const debugPhone = '90371744955';
  const customerExists = this.customers.some(c => 
    c.mobile === debugPhone || 
    c.phone === debugPhone ||
    c.alternateContact === debugPhone
  );
  console.log(`Customer with phone ${debugPhone} exists:`, customerExists);

  const convertedLeadData = localStorage.getItem('convertedLeadForSale'); 
   if (convertedLeadData) {
    const { customerData, isExistingCustomer } = JSON.parse(convertedLeadData);
    
    // Prefill form with customer data
    this.saleForm.patchValue({
      customer: customerData.id,
      customerName: customerData.displayName,
      // Add other fields as needed
    });
    
    // If existing customer, you might want to fetch more details
    if (isExistingCustomer) {
      this.customerService.getCustomerById(customerData.id).subscribe(customer => {
        // Update form with additional customer details
        this.prefillCustomerDetails(customer);
      });
    }
    
    // Clear the stored data
    localStorage.removeItem('convertedLeadForSale');
  }

    
    
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
    // After all data is loaded, check for lead/customer data
    this.checkForLeadData();
    this.checkForCustomerQueryParam();
    
    // Generate invoice/order numbers after form is ready
    this.generateAndSetNumbers();
  });then(() => {
    setTimeout(() => {
      this.checkForLeadData();
    }, 300);
  });
  this.route.params.subscribe(params => {
    if (params['fromQuotation'] === 'true') {
      this.isFromQuotation = true;
      this.loadQuotationData();
    }
  });
}
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
        this.saleForm.patchValue({
          addedBy: loggedInUser.id
        });
        
        // Also update the commission percentage
        const commissionPercent = await this.getAgentCommission(loggedInUser.id);
        this.defaultProduct.commissionPercent = commissionPercent;
        this.updateDefaultProduct();
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

private calculateProductTax(product: Product): void {
  const taxRate = product.taxRate || 0;
  const taxableAmount = product.priceBeforeTax * product.quantity;
  
  // Calculate total tax amount
  product.taxAmount = (taxableAmount * taxRate) / 100;
  
  // Determine tax breakdown based on tax rate
  if (taxRate === 18) {
    // Standard GST rate - split into CGST and SGST
    product.taxType = 'CGST+SGST';
    product.cgstAmount = product.taxAmount / 2;
    product.sgstAmount = product.taxAmount / 2;
    product.igstAmount = 0;
  } else if (taxRate === 28) {
    // Higher GST rate - could be IGST
    product.taxType = 'IGST';
    product.igstAmount = product.taxAmount;
    product.cgstAmount = 0;
    product.sgstAmount = 0;
  } else if (taxRate === 12) {
    // Medium GST rate - split into CGST and SGST
    product.taxType = 'CGST+SGST';
    product.cgstAmount = product.taxAmount / 2;
    product.sgstAmount = product.taxAmount / 2;
    product.igstAmount = 0;
  } else if (taxRate === 5) {
    // Low GST rate - split into CGST and SGST
    product.taxType = 'CGST+SGST';
    product.cgstAmount = product.taxAmount / 2;
    product.sgstAmount = product.taxAmount / 2;
    product.igstAmount = 0;
  } else if (taxRate > 0) {
    // Custom rate - default to CGST+SGST split
    product.taxType = 'CGST+SGST';
    product.cgstAmount = product.taxAmount / 2;
    product.sgstAmount = product.taxAmount / 2;
    product.igstAmount = 0;
  } else {
    // No tax
    product.taxType = 'None';
    product.cgstAmount = 0;
    product.sgstAmount = 0;
    product.igstAmount = 0;
  }
}

calculateTotalPayable(): void {
  // Get form values
  const discount = this.saleForm.get('discountAmount')?.value || 0;
  const taxRate = this.saleForm.get('orderTax')?.value || 0;
  const shippingBeforeTax = this.saleForm.get('shippingCharges')?.value || 0;
  
  // Get packing charge from PP service or COD
  const packingCharge = this.ppServiceData?.packingCharge || this.codData?.packingCharge || 0;

  // 1. Calculate products amount (without tax)
  let productsTotal = this.itemsTotal;
  
  // Apply discount to products (before tax)
  if (this.saleForm.get('discountType')?.value === 'Percentage') {
    productsTotal -= (this.itemsTotal * discount / 100);
  } else {
    productsTotal -= discount;
  }

  // 2. Calculate shipping with tax
  const shippingWithTax = this.calculateShippingWithTax();
  
  // 3. Calculate total before packing charge
  let totalBeforePacking = productsTotal + shippingWithTax;
  
  // 4. Add packing charge (this is typically after tax)
  let totalPayable = totalBeforePacking + packingCharge;
  
  // Update the form with the calculated totals
  this.saleForm.patchValue({ 
    totalPayable: parseFloat(totalPayable.toFixed(2)),
    itemsTotal: parseFloat(productsTotal.toFixed(2)),
    shippingTotal: parseFloat(shippingWithTax.toFixed(2)),
    packingCharge: parseFloat(packingCharge.toFixed(2))
  });
  
  this.calculateRoundOff();
  this.calculateBalance();
}
onTaxChange(selectedRate: string): void {
  this.saleForm.patchValue({ orderTax: parseFloat(selectedRate) || 0 });
  this.calculateTotalPayable();
    this.calculateTaxes(); // Add this line

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



// In your AddSaleComponent
private prefillCustomerData(customerData: any, isExistingCustomer: boolean = false): void {
  // Build address strings
  const billingAddressParts = [
    customerData.addressLine1,
    customerData.addressLine2,
    customerData.city,
    customerData.state,
    customerData.country,
    customerData.zipCode,
    customerData.Dob,
    customerData.alternateContact,
    customerData.age
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
      customerDob: formattedDob, // Add this line
      customerGender: foundCustomer.gender || '',
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
    if (!userId) return;
    
    const commissionPercent = await this.getAgentCommission(userId);
    
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
    
    // Clear previous selections if switching service types
    if (this.showPpServicePopup && serviceId !== this.saleForm.get('typeOfService')?.value) {
      this.ppServiceData = null;
    }
    if (this.showCodPopup && serviceId !== this.saleForm.get('typeOfService')?.value) {
      this.codData = null;
    }
  
    const selectedService = this.serviceTypes.find(s => s.id === serviceId);
    const serviceName = selectedService?.name?.toLowerCase() || '';
  
    // Reset both popups initially
    this.showPpServicePopup = false;
    this.showCodPopup = false;
  
    // Handle PP service
    if (serviceName.includes('pp')) {
      this.showPpServicePopup = true;
      // Clear COD data if any
      this.codData = null;
      this.saleForm.patchValue({ typeOfService: serviceId });
    } 
    // Handle COD service
    else if (serviceId === 'COD' || serviceName.includes('cod')) {
      this.showCodPopup = true;
      // Clear PP data if any
      this.ppServiceData = null;
      this.saleForm.patchValue({ typeOfService: serviceId });
    } 
    // Handle other services
    else {
      this.saleForm.patchValue({ typeOfService: serviceId });
    }
  
    // Show transaction ID field only for PP services
    this.showTransactionIdField = !!selectedService?.name && 
                              (serviceName.includes('pp') || 
                               serviceName.includes('payment'));
    
    // Add validation if needed
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
  
  // Update shipping charges or other fields if needed
  if (formData.packingCharge) {
    const currentShipping = this.saleForm.get('shippingCharges')?.value || 0;
    this.saleForm.patchValue({
      shippingCharges: currentShipping + formData.packingCharge
    });
  }
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
  loadProducts(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.productService.getProductsRealTime().subscribe({
        next: (products: any[]) => {
          this.allProducts = products.map(p => ({
            ...p,
            productName: p.name || p.productName
          }));
          this.filteredProducts = [...this.allProducts];
          resolve();
        },
        error: (error: any) => {
          console.error('Error loading products:', error);
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
      productInterested: [''], // Add this line
      status: ['Pending', Validators.required], // Set default to 'Pending'
      paymentStatus: ['Due'],
    alternateContact: [''], // Add this line
   customerAge: [null],
    customerDob: [null],
    customerGender: [''],
      customerEmail: [''],

          shippingDetails: [''], // Add this new control

      roundOff: [0], // Add this line
   productTaxAmount: [0],
    shippingTaxAmount: [0],
    codTaxAmount: [0],
    ppTaxAmount: [0],
      customerSearch: [''],
      customerOccupation: [''],
      creditLimit: [0],
      otherData: [''],
      paymentAccount: ['', Validators.required],
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
    orderTax: [18, [Validators.min(0), Validators.max(100)]], // Set default to 18%
      sellNote: [''],
      shippingCharges: [0, [Validators.min(0)]],
      shippingStatus: [''],
      deliveryPerson: [''],
      shippingDocuments: [null],
      totalPayable: [0],
      paymentAmount: [0, [Validators.required, Validators.min(0)]],
      paidOn: [this.todayDate],
      paymentMethod: ['', Validators.required],
      paymentNote: [''],
      changeReturn: [0],
      balance: [0],
      addedBy: ['', Validators.required]
      
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
    

});
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

updateProduct(index: number): void {
  const product = this.products[index];
  const selectedProduct = this.allProducts.find(p => p.productName === product.name);

  // Set default tax rate from product if not set
  if (selectedProduct && !product.taxRate && selectedProduct.taxRate) {
    product.taxRate = selectedProduct.taxRate;
  }

  // Calculate price before tax or unit price (MRP) based on available data
  if (product.priceBeforeTax !== undefined && product.taxRate !== undefined) {
    product.unitPrice = product.priceBeforeTax * (1 + (product.taxRate / 100));
  } else if (product.unitPrice !== undefined && product.taxRate !== undefined) {
    product.priceBeforeTax = product.unitPrice / (1 + (product.taxRate / 100));
  }

  // Calculate tax for this product
  this.calculateProductTax(product);

  // Calculate subtotal before discount
  const subtotalBeforeDiscount = product.quantity * product.unitPrice;

  // Calculate discount
  let discountAmount = 0;
  if (product.discountType === 'Percentage') {
    discountAmount = (subtotalBeforeDiscount * product.discount) / 100;
  } else {
    discountAmount = product.discount;
  }

  const discountedSubtotal = subtotalBeforeDiscount - discountAmount;

  // Calculate commission
  product.commissionAmount = (product.commissionPercent || 0) / 100 * discountedSubtotal;

  // Final subtotal
  product.subtotal = discountedSubtotal - product.commissionAmount;

  // Recalculate overall totals
  this.calculateItemsTotal();
  this.calculateTotalPayable();
  this.calculateTaxes();
}


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


  

  removeProduct(index: number): void {
    this.products.splice(index, 1);
    this.calculateItemsTotal();
    this.calculateTotalPayable();
  }

  calculateItemsTotal(): void {
    const defaultProductValue = (this.defaultProduct.name || this.defaultProduct.quantity > 0 || this.defaultProduct.unitPrice > 0) 
      ? this.defaultProduct.subtotal 
      : 0;
    
    this.itemsTotal = this.products.reduce((sum, product) => sum + product.subtotal, defaultProductValue);
    this.totalCommission = this.products.reduce((sum, product) => sum + (product.commissionAmount || 0), 
      (this.defaultProduct.name || this.defaultProduct.quantity > 0 || this.defaultProduct.unitPrice > 0) 
        ? (this.defaultProduct.commissionAmount || 0) 
        : 0);
  }
calculateShippingWithTax(): number {
  const shippingBeforeTax = this.saleForm.get('shippingCharges')?.value || 0;
  const taxRate = this.saleForm.get('orderTax')?.value || 0;
  
  const shippingTax = shippingBeforeTax * (taxRate / 100);
  const shippingWithTax = shippingBeforeTax + shippingTax;
  
  // Update the form with tax amounts
  this.saleForm.patchValue({
    shippingTaxAmount: shippingTax
  });
  
  return shippingWithTax;
}
  calculateBalance(): void {
    const totalPayable = this.saleForm.get('totalPayable')?.value || 0;
    const paymentAmount = this.saleForm.get('paymentAmount')?.value || 0;
    const roundOff = this.saleForm.get('roundOff')?.value || 0;
  
    // Use the rounded total for balance calculation
    const roundedTotal = totalPayable + roundOff;
  
    if (paymentAmount > roundedTotal) {
      this.saleForm.patchValue({
        changeReturn: (paymentAmount - roundedTotal).toFixed(2),
        balance: 0
      });
    } else {
      this.saleForm.patchValue({
        changeReturn: 0,
        balance: (roundedTotal - paymentAmount).toFixed(2)
      });
    }
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
  
  // Reset for next use
  this.editingPrescriptionIndex = null;
  this.resetPrescriptionData();
  
  // Show success message
  this.showToast('Prescription saved successfully!', 'success');
}

resetPrescriptionData(): void {
  this.prescriptionData = {
    medicines: [],
    patientName: this.saleForm.get('customerName')?.value || '',
    patientAge: this.saleForm.get('customerAge')?.value?.toString() || '',
    date: this.todayDate,
    additionalNotes: ''
  };
}


// Add this method to your component
calculateRoundOff(): void {
  const totalPayable = this.saleForm.get('totalPayable')?.value || 0;
  
  // Calculate the nearest whole number
  const roundedTotal = Math.round(totalPayable);
  
  // Calculate the difference (round off amount)
  const roundOff = roundedTotal - totalPayable;
  
  // Update the form values
  this.saleForm.patchValue({
    roundOff: parseFloat(roundOff.toFixed(2)),  // Show the round-off amount (can be positive or negative)
    totalPayable: parseFloat(totalPayable.toFixed(2))  // Keep original total payable
  });
  
  // Recalculate balance after round-off
  this.calculateBalance();
}

  

async saveSale(): Promise<void> {
  try {
    // Form validation
    if (!this.saleForm.valid) {
      console.log('Form validation errors:', this.saleForm.errors);
      this.markFormGroupTouched(this.saleForm);

      if (this.products.length === 0 &&
        !(this.defaultProduct.name || this.defaultProduct.quantity > 0 || this.defaultProduct.unitPrice > 0)) {
        alert('Please add at least one product');
        return;
      }

      Object.keys(this.saleForm.controls).forEach(key => {
        const control = this.saleForm.get(key);
        if (control?.invalid) {
          console.log(`Invalid field: ${key}, Errors:`, control.errors);
        }
      });
      return;
    }

    // Generate document numbers
    const invoiceNumber = await this.generateInvoiceNumber();
    const orderNumber = await this.generateOrderNumber();
    this.saleForm.patchValue({
      invoiceNo: invoiceNumber,
      orderNo: orderNumber
    });

    // Delete lead if converting from lead
    if (this.leadIdToDelete) {
      await this.leadService.deleteLead(this.leadIdToDelete);
      console.log('Lead deleted after sale creation');
    }

    // Validate payment account
    const paymentAccountId = this.saleForm.get('paymentAccount')?.value;
    if (!paymentAccountId) {
      alert('Please select a payment account');
      return;
    }
    const selectedPaymentAccount = this.paymentAccounts.find(acc => acc.id === paymentAccountId);
    if (!selectedPaymentAccount) {
      alert('Selected payment account not found');
      return;
    }

    // Validate customer
    const selectedCustomerId = this.saleForm.get('customer')?.value;
    if (!selectedCustomerId) {
      alert('Please select a customer');
      return;
    }
    const selectedCustomer = this.customers.find(c => c.id === selectedCustomerId);
    const customerName = selectedCustomer?.displayName || 'Unknown Customer';

    // Get location, service, and user details
    const selectedLocationId = this.saleForm.get('businessLocation')?.value;
    const selectedLocation = this.businessLocations.find(loc => loc.id === selectedLocationId);
    const locationName = selectedLocation?.name || '';

    const selectedServiceId = this.saleForm.get('typeOfService')?.value;
    const selectedService = this.serviceTypes.find(s => s.id === selectedServiceId);
    const serviceName = selectedService?.name || '';

    const selectedUserId = this.saleForm.get('addedBy')?.value;
    const selectedUser = this.users.find(u => u.id === selectedUserId);
    const userName = selectedUser?.displayName || selectedUser?.name || selectedUser?.email || 'System User';

    // Calculate commission
    const commissionPercent = await this.getAgentCommission(selectedUserId);

    // Prepare products data
    const productsToSave = [...this.products].map(product => ({
      id: product.id || '',
      name: product.name || '',
      productName: product.productName || product.name || '',
      sku: product.sku || '',
      quantity: product.quantity || 0,
      unitPrice: product.unitPrice || 0,
      batchNumber: product.batchNumber || '',
      expiryDate: product.expiryDate || '',
      discount: product.discount || 0,
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

    // Add default product if exists
    if (this.defaultProduct.name || this.defaultProduct.quantity > 0 || this.defaultProduct.unitPrice > 0) {
      productsToSave.push({
        id: '',
        name: this.defaultProduct.name || '',
        productName: this.defaultProduct.name || '',
        sku: '',
        quantity: this.defaultProduct.quantity || 0,
        unitPrice: this.defaultProduct.unitPrice || 0,
        discount: this.defaultProduct.discount || 0,
        commissionPercent: this.defaultProduct.commissionPercent || 0,
        commissionAmount: this.defaultProduct.commissionAmount || 0,
        subtotal: this.defaultProduct.subtotal || 0,
        batchNumber: this.defaultProduct.batchNumber || '',
        expiryDate: this.defaultProduct.expiryDate || '',
        taxRate: this.defaultProduct.taxRate || 0,
        taxAmount: this.defaultProduct.taxAmount || 0,
        taxType: this.defaultProduct.taxType || '',
        cgstAmount: this.defaultProduct.cgstAmount || 0,
        sgstAmount: this.defaultProduct.sgstAmount || 0,
        igstAmount: this.defaultProduct.igstAmount || 0,
        priceBeforeTax: this.defaultProduct.priceBeforeTax || 0
      });
    }

    if (productsToSave.length === 0) {
      alert('Please add at least one product');
      return;
    }

    // Calculate tax amounts
    const productTax = this.products.reduce((sum, product) => sum + (product.taxAmount || 0), 0);
    const defaultProductTax = (this.defaultProduct.name || this.defaultProduct.quantity > 0 || this.defaultProduct.unitPrice > 0) 
      ? (this.defaultProduct.taxAmount || 0) 
      : 0;
    
    const shippingTax = (this.saleForm.get('shippingCharges')?.value || 0) *
      (this.saleForm.get('orderTax')?.value || 0) / 100;
    const totalTax = productTax + defaultProductTax + shippingTax;

    // Calculate tax breakdown
    const cgstTotal = this.products.reduce((sum, p) => sum + (p.cgstAmount || 0), 0) + 
                     (this.defaultProduct.cgstAmount || 0);
    const sgstTotal = this.products.reduce((sum, p) => sum + (p.sgstAmount || 0), 0) + 
                     (this.defaultProduct.sgstAmount || 0);
    const igstTotal = this.products.reduce((sum, p) => sum + (p.igstAmount || 0), 0) + 
                     (this.defaultProduct.igstAmount || 0);

    // Prepare prescription data with proper fallbacks
    const prescriptionsToSave = this.prescriptions.length > 0 
      ? this.prescriptions.map(prescription => ({
          patientName: prescription.patientName || customerName || 'Unknown Patient',
          patientAge: prescription.patientAge || '',
          date: prescription.date || this.todayDate,
          medicines: prescription.medicines.map(medicine => ({
            name: medicine.name || '',
            type: medicine.type || '',
            dosage: medicine.dosage || '',
            instructions: medicine.instructions || '',
            quantity: medicine.quantity || '',
            powder: medicine.powder || '',
            pills: medicine.pills || '',
            time: medicine.time || ''
          })),
          additionalNotes: prescription.additionalNotes || '',
          doctorName: this.currentUser,
          createdAt: new Date()
        }))
      : null;

    // Get lead ID if converting from lead
    let leadId: string | null = null;
    const navigation = this.router.getCurrentNavigation();
    const state = navigation?.extras?.state as { fromLead: boolean, leadData: any };

    if (state?.fromLead) {
      leadId = state.leadData?.leadId;
    } else {
      const leadData = localStorage.getItem('leadForSalesOrder');
      if (leadData) {
        try {
          const parsedData = JSON.parse(leadData);
          leadId = parsedData.leadId;
          localStorage.removeItem('leadForSalesOrder');
        } catch (error) {
          console.error('Error parsing lead data:', error);
        }
      }
    }

    // Prepare sale data with all required fields
    const saleData: any = {
      ...this.saleForm.value,
      invoiceNo: invoiceNumber,
      orderNo: orderNumber,
      prescriptions: prescriptionsToSave,

      // Tax information
      taxAmount: parseFloat(totalTax.toFixed(2)),
      taxDetails: {
        cgst: parseFloat(cgstTotal.toFixed(2)),
        sgst: parseFloat(sgstTotal.toFixed(2)),
        igst: parseFloat(igstTotal.toFixed(2)),
        total: parseFloat(totalTax.toFixed(2))
      },
      productTaxAmount: parseFloat((productTax + defaultProductTax).toFixed(2)),
      shippingTaxAmount: parseFloat(shippingTax.toFixed(2)),
      
      // Payment information
      orderTax: this.saleForm.get('orderTax')?.value || 0,
      paymentAccountId: selectedPaymentAccount.id,
      paymentAccountName: selectedPaymentAccount.name || '',
      paymentAccountType: selectedPaymentAccount.accountType || '',
      
      // Service information
      ppServiceData: this.ppServiceData || null,
      hasPpService: !!this.ppServiceData,
      codData: this.codData || null,
      hasCod: !!this.codData,
      
      // Status information
      status: this.saleForm.get('status')?.value || 'Pending',
      paymentStatus: this.saleForm.get('paymentStatus')?.value ||
        (this.saleForm.get('status')?.value === 'Pending' ? 'Due' : 'Paid'),
      
      // Customer information
      customerId: selectedCustomerId,
      customer: customerName,
      businessLocationId: selectedLocationId,
      businessLocation: locationName,
      location: locationName,
      
      // Shipping information
      shippingDocuments: [],
      shippingCharges: this.saleForm.get('shippingCharges')?.value || 0,
      shippingTotal: this.calculateShippingWithTax ? this.calculateShippingWithTax() :
        (this.saleForm.get('shippingCharges')?.value || 0),
      
      // Product information
      products: productsToSave,
      itemsTotal: this.itemsTotal || 0,
      subtotal: this.itemsTotal || 0,
      totalBeforeTax: (this.itemsTotal || 0) - totalTax,
      totalPayable: this.saleForm.get('totalPayable')?.value || 0,
      
      // Commission information
      totalCommission: this.totalCommission || 0,
      commissionPercentage: commissionPercent || 0,
      
      // Metadata
      createdAt: new Date(),
      updatedAt: new Date(),
      convertedFromQuotation: this.isFromQuotation || false,
      convertedFromLead: !!leadId,
      leadId: leadId || '',
      addedBy: selectedUserId || '',
      addedByDisplayName: userName,
      interestedProductIds: this.selectedProductsForInterested.map(p => p.id || '') || [],
      
      // Additional fields
      transactionId: this.saleForm.get('transactionId')?.value || '',
      typeOfService: selectedServiceId || '',
      typeOfServiceName: serviceName
    };

    // Ensure no undefined values in the sale data
    Object.keys(saleData).forEach(key => {
      if (saleData[key] === undefined) {
        saleData[key] = null;
      }
    });

    console.log('Sending sale data:', saleData);
    const saleId = await this.saleService.addSale(saleData);

    // Update lead status if converted from lead
    if (leadId) {
      try {
        await this.leadService.updateLead(leadId, {
          status: 'Converted to Sales Order',
          convertedAt: new Date(),
          convertedTo: 'sales-order/' + saleId,
          lifeStage: 'Customer',
          dealStatus: 'Won'
        });
      } catch (leadError) {
        console.error('Error updating lead status:', leadError);
      }
    }

    alert(`Sale added successfully!\nInvoice: ${invoiceNumber}\nOrder: ${orderNumber}`);
    this.router.navigate(['/sales-order']);
  } catch (error: any) {
    console.error('Save sale error:', error);
    let errorMessage = 'Error adding sale. ';
    if (error.code) errorMessage += `Error code: ${error.code}. `;
    errorMessage += error.message || 'Please try again.';
    alert(errorMessage);
  }
}
private async generateAndSetNumbers(): Promise<void> {
  try {
    // Generate invoice number first
    const invoiceNumber = await this.generateInvoiceNumber();
    
    // Then generate order number
    const orderNumber = await this.generateOrderNumber();
    
    // Update the form with generated numbers
    this.saleForm.patchValue({
      invoiceNo: invoiceNumber,
      orderNo: orderNumber
    });
    
    console.log('Generated Invoice Number:', invoiceNumber);
    console.log('Generated Order Number:', orderNumber);
  } catch (error) {
    console.error('Error generating numbers:', error);
    // Set fallback numbers if generation fails
    const fallbackInvoice = `INAB${Math.floor(1000 + Math.random() * 9000)}`;
    const fallbackOrder = `ORD-${new Date().getMonth()+1}${new Date().getFullYear().toString().slice(-2)}-${Math.floor(100 + Math.random() * 900)}`;
    
    this.saleForm.patchValue({
      invoiceNo: fallbackInvoice,
      orderNo: fallbackOrder
    });
  }
}

private async generateInvoiceNumber(): Promise<string> {
  try {
    const baseNumber = await lastValueFrom(
      this.saleService.getLatestInvoiceNumber().pipe(
        defaultIfEmpty(Math.floor(1000 + Math.random() * 9000))
      )
    );

    // Add additional randomness to ensure uniqueness
    const timestampComponent = Date.now().toString().slice(-3);
    const finalNumber = (baseNumber + parseInt(timestampComponent)).toString();
    
    return `INAB${finalNumber.padStart(4, '0').slice(-4)}`; // Ensure 4 digits
  } catch (error) {
    console.error('Error generating invoice number:', error);
    // Fallback with timestamp-based number
    return `INAB${Date.now().toString().slice(-6)}`;
  }
}
  
private async generateOrderNumber(): Promise<string> {
  try {
    const latestNumber = await this.saleService.getLatestOrderNumber().toPromise();
    const nextNumber = (latestNumber || 0) + 1;
    const today = new Date();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const year = today.getFullYear().toString().slice(-2);
    return `ORD-${month}${year}-${nextNumber.toString().padStart(3, '0')}`; // Format like ORD-0525-001
  } catch (error) {
    console.error('Error generating order number:', error);
    const fallbackNumber = Math.floor(100 + Math.random() * 900);
    return `ORD-${fallbackNumber}`; // Fallback random number
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