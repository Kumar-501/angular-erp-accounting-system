import { Component, HostListener, OnInit } from '@angular/core';
import { SaleService } from '../services/sale.service';
import { collection, doc, Firestore, getDoc, onSnapshot, orderBy, query, updateDoc } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Router } from '@angular/router';
import * as bootstrap from 'bootstrap';
import { NgxDaterangepickerMd } from 'ngx-daterangepicker-material';
import moment from 'moment';
import { LocationService } from '../services/location.service';
import { Inject } from '@angular/core'; 
import { TypeOfServiceService } from '../services/type-of-service.service';
import { UserService } from '../services/user.service';
import { AuthService } from '../auth.service';
import { firstValueFrom } from 'rxjs';
import { Product } from '../models/product.model';

interface InvoiceData {
  shippingTax: number;
  totalTaxableValue: number;
  invoiceNo: string;
  date: string;
  from: {
    companyName: string;
    address: string;
    mobile: string;
    gst: string;
  };
  to: {
    name: string;
    address: string;
    mobile: string;
  };
  products: Array<{
    discountPercent: number;
    discount: number;
    taxableValue: number;
    taxType: string;
    cgstAmount: number;
    cgstRate: number;
    sgstAmount: number;
    sgstRate: number;
    igstAmount: number;
    igstRate: number;
    name: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }>;
  shippingCharge: number;
  taxes: Array<{
    name: string;
    amount: number;
  }>;
  total: number;
}

interface Shipment {
  prescription: any;
  prescriptions?: PrescriptionData[];
  id: string;
  date: string | Date;
  invoiceNo: string;
  district?: string;

  customer: string;
  contactNumber: string;
  alternateContact?: string;
  location: string;
  deliveryPerson: string;
  shippingStatus: string;
  shippingDetails?: string;

  shippingNotes?: string;
  billingAddress: string;
  businessLocation: string;
  shippingCharge: number;
  addedBy?: string;
  addedByDisplayName?: string;
  paymentStatus: string;
  balance: number;
  orderNo?: string;
  paymentMethod?: string;
  totalPayable?: number;
  paymentAmount?: number;
  products?: Product[];
  typeOfService?: string;
  typeOfServiceName?: string;
  
  activities?: {
    userId: string;
    userName: string;
    fromStatus: string;
    toStatus: string;
    timestamp: Date;
    note?: string;
  }[];
  // Add packing charge related fields
  ppServiceData?: {
    packingCharge: number;
    tax: string;
    transactionId: string;
    [key: string]: any;
  };
  codData?: {
    packingCharge: number;
    packingBeforeTax: number;
    tax: string;
    [key: string]: any;
  };
  serviceCharge?: number;
  packingCharge?: number;
  orderTax?: number;
}
interface ShipmentUpdateData {
  shippingStatus: string;
  updatedAt: Date;
  activities?: Activity[]; // Make it optional with ?
  // Include other fields that might be updated
  [key: string]: any; // For any additional dynamic properties
}
interface PrescriptionData {
  patientName: string;
  patientAge?: string;
  date: string;
  medicines: Medicine[];
  additionalNotes?: string;
  doctorName?: string;
  createdAt?: Date;
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
  combinationName?: string;
  combinationQuantity?: string;
  [key: string]: any;
}

interface PrescriptionForm {
  patientName: string;
  date: string;
  medicines: PrescriptionMedicine[];
}

interface TypeOfService {
  id: number;
  name: string;
}

interface PrescriptionMedicine {
  name: string;
  dosage: string;
  instructions: string;
  ingredients: string;
  pills: string;
  powder: string;
  time: string;
}

interface Activity {
  userId: string;
  userName: string;
  fromStatus: string;  // Remove the optional (?) if Shipment requires it
  toStatus: string; 
  timestamp: Date;
  note?: string;
}

// Added interface for processed product data
interface ProcessedProduct {
  name: string;
  unitPrice: number;
  quantity: number;
  discount: number;
  discountPercent: number;
  taxableValue: number;
  taxType: string;
  cgstAmount: number;
  cgstRate: number;
  sgstAmount: number;
  sgstRate: number;
  igstAmount: number;
  igstRate: number;
  subtotal: number;
  productName?: string;
  code?: string;
}

interface PackingChargeData {
  packingCharge: number;
  serviceType: string;
  packingBeforeTax?: number;
  packingTax?: number;
  packingAfterTax?: number;
}

@Component({
  selector: 'app-shipments',
  templateUrl: './shipments.component.html',
  styleUrls: ['./shipments.component.scss']
})
export class ShipmentsComponent implements OnInit {
  [x: string]: any;
  serviceMap: Map<string, any> = new Map<string, any>();
  private unsubscribeShipments!: () => void;
  private invoiceModal: any;
  showActionPopup = false;
  currentActionPopup: string | null = null;

  selectedShipment: Shipment | null = null;
  private prescriptionModal: any;
  shipments: Shipment[] = [];
  selectedShipments: string[] = [];
  isUpdating = false;
  openedActionMenuId: string | null = null;

  combinedAddress: string = '';

  currentPrescriptionData: PrescriptionData | null = null;
  allPrescriptions: PrescriptionData[] = [];
  currentPrescriptionIndex: number = 0;
invoiceHasIgst: boolean = false;
  invoiceHasCgstSgst: boolean = false;
  invoiceData: InvoiceData = {
    invoiceNo: '',
    date: '',
    from: {
      companyName: 'HERBALY TOUCH AYURVEDA PRODUCTS PRIVATE LIMITED',
      address: '',
      mobile: '',
      gst: ''
    },
    to: {
      name: '',
      address: '',
      mobile: ''
    },
    products: [],
    shippingCharge: 0,
    taxes: [],
    total: 0,
    shippingTax: 0,
    totalTaxableValue: 0
  };

  locations: any[] = [];
  newActivity = {
    note: '',
  };
  shippingDocumentFile: File | null = null;

  totalEntries: number = 0;
  selectedIds: number[] = [];
  bulkStatusUpdate = {
    status: 'Pending'
  };

  filteredShipments: Shipment[] = [];
  entriesPerPage = 25;
  currentPage = 1;
  searchTerm = '';
  showEditFormModal = false;
  isSavingForm = false;
  editFormData: any = {};
  showColumnDropdown = false;
  visibleColumnsCount = 10;

  totalShipmentCount = 0;
  totalShipmentAmount = 0;
  typeOfServices: any[] = [];
  users: any[] = [];

  showPrescriptionModal = false;
  currentPrescription: PrescriptionForm = {
    patientName: '',
    date: new Date().toISOString().split('T')[0],
    medicines: Array(7).fill(null).map(() => ({
      name: '',
      dosage: '15 ml. എടുക്കുക 45 ml. തിളപ്പിച്ച വെള്ളം ചേർത്ത് കുടിക്കുക',
      instructions: 'രാത്രി ഭക്ഷണത്തിന് ശേഷം / മുമ്പ് സൊവികുക',
      ingredients: '',
      pills: '',
      powder: '',
      time: ''
    }))
  };

// In shipments.component.ts - Update the columns array
columns = [
  { id: 'date', name: 'Date', visible: true },
  { id: 'invoiceNo', name: 'Invoice No.', visible: true },
  { id: 'customer', name: 'Customer', visible: true },
  { id: 'contactNumber', name: 'Contact', visible: true },
  { id: 'alternateContact', name: 'Alternate Contact', visible: false },
  { id: 'location', name: 'Current Location', visible: false },
  { id: 'billingAddress', name: 'Billing Location', visible: true },
  { id: 'state', name: 'State', visible: true }, // Make sure this is visible
  { id: 'district', name: 'District', visible: true }, // Make sure this is visible
  { id: 'pincode', name: 'Pincode', visible: true },
  { id: 'shippingDetails', name: 'Shipping Details', visible: false },
  { id: 'typeOfService', name: 'Type of Service', visible: false },
  { id: 'quantity', name: 'Quantity', visible: true },
  { id: 'shippingCharge', name: 'Shipping Charge', visible: false },
  { id: 'grandTotal', name: 'Grand Total', visible: true },
  { id: 'shippingStatus', name: 'Shipping Status', visible: true },
  { id: 'paymentStatus', name: 'Payment Status', visible: true },
  { id: 'addedBy', name: 'Added By', visible: false },
];

  
  
  showFilters = false;
  showEditModal = false;
  isSaving = false;
  
  editData: {
    id: string;
    paymentStatus: string;
    partialAmount: number | null;
  } = {
    id: '',
    paymentStatus: '',
    partialAmount: null
  };
  
  currentShipment: Shipment | null = null;

  filterValues = {
    startDate: null as Date | null,
    endDate: null as Date | null,
    dateRange: '',
    currentLocation: 'All',
    customer: '',
    addedBy: 'All',
    businessLocation: '',
    typeOfService: 'All',
    paymentStatus: 'All',
    shippingStatus: 'All',
    deliveryPerson: 'All',
    user: 'All'
  };

  constructor(
    private saleService: SaleService,
    private firestore: Firestore,
    private router: Router,
    private typeOfServiceService: TypeOfServiceService,
    private userService: UserService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadShipments();
    this.loadUsers();
    this.loadTypeOfServices();
    this.invoiceModal = new bootstrap.Modal(document.getElementById('invoiceModal')!);
    this['saleSubscription'] = this.saleService.salesUpdated$.subscribe(() => 
      this.loadShipments());
  }

  // Helper method to safely convert to number
  private safeNumber(value: any, defaultValue: number = 0): number {
    if (value === null || value === undefined || value === '') {
      return defaultValue;
    }
    const num = Number(value);
    return isNaN(num) ? defaultValue : num;
  }
  

   getShipmentTotalQuantity(shipment: Shipment): number {
    if (!shipment.products || shipment.products.length === 0) {
      return 0;
    }
    return shipment.products.reduce((total, product) => total + (Number(product.quantity) || 0), 0);
  }

// Improved parseAddress method in shipments.component.ts
// Improved parseAddress method in shipments.component.ts
parseAddress(address: string, part: 'city' | 'pincode' | 'state' | 'district'): string {
  if (!address) return 'N/A';

  // Clean the address and split by commas
  const addressParts = address.split(',').map(part => part.trim()).filter(part => part);
  
  // Common districts in Tamil Nadu (example - add more as needed)
  const tamilNaduDistricts = [
    'Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tirunelveli',
    'Erode', 'Vellore', 'Thoothukudi', 'Dindigul', 'Thanjavur', 'Kanchipuram',
    'Cuddalore', 'Nagapattinam', 'Karur', 'Namakkal', 'Dharmapuri', 'Krishnagiri',
    'Virudhunagar', 'Sivaganga', 'Ramanathapuram', 'Theni', 'Pudukkottai',
    'Ariyalur', 'Perambalur', 'Nilgiris', 'Tiruppur', 'Tiruvarur'
  ];

  // Check if any known district is mentioned in the address
  const addressLower = address.toLowerCase();
  for (const district of tamilNaduDistricts) {
    if (addressLower.includes(district.toLowerCase())) {
      if (part === 'district') return district;
    }
  }

  // If no known district found, try to extract from address parts
  if (part === 'pincode') {
    const pincodeMatch = address.match(/\b\d{6}\b/);
    return pincodeMatch ? pincodeMatch[0] : 'N/A';
  }

  if (part === 'state') {
    if (addressLower.includes('tamil nadu') || addressLower.includes('tn')) return 'Tamil Nadu';
    if (addressLower.includes('kerala') || addressLower.includes('kl')) return 'Kerala';
    // Add other states as needed
    return 'N/A';
  }

  if (part === 'district') {
    // Try to find district in different positions
    if (addressParts.length >= 4) {
      // Format: Name, Street, City, District, State
      const districtPart = addressParts[3].replace(/\b\d{6}\b/, '').trim();
      if (districtPart && districtPart.length > 2) {
        return districtPart;
      }
    }
    
    if (addressParts.length >= 3) {
      // Format: Name, Area, City/District, State
      const cityDistrictPart = addressParts[2].replace(/\b\d{6}\b/, '').trim();
      if (cityDistrictPart && cityDistrictPart.length > 2) {
        return cityDistrictPart;
      }
    }
    
    return 'N/A';
  }

  if (part === 'city') {
    if (addressParts.length >= 3) {
      return addressParts[2].replace(/\b\d{6}\b/, '').trim() || 'N/A';
    }
    return 'N/A';
  }

  return 'N/A';
}


// Add this method to shipments.component.ts
private extractDistrictFromAddress(address: string): string {
  if (!address) return 'N/A';

  // Common district patterns in Tamil Nadu (since your data shows Tamil Nadu)
  const tamilNaduDistricts = [
    'Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tirunelveli',
    'Erode', 'Vellore', 'Thoothukudi', 'Dindigul', 'Thanjavur', 'Kanchipuram',
    'Cuddalore', 'Nagapattinam', 'Karur', 'Namakkal', 'Dharmapuri', 'Krishnagiri',
    'Virudhunagar', 'Sivaganga', 'Ramanathapuram', 'Theni', 'Pudukkottai',
    'Ariyalur', 'Perambalur', 'Nilgiris', 'Tiruppur', 'Tiruvarur'
  ];

  // Check if any known district is mentioned in the address
  const addressLower = address.toLowerCase();
  for (const district of tamilNaduDistricts) {
    if (addressLower.includes(district.toLowerCase())) {
      return district;
    }
  }

  // If no known district found, use the parsing logic
  const parts = address.split(',').map(p => p.trim()).filter(p => p);
  
  // Try to find district in different positions
  if (parts.length >= 4) {
    // Format: Name, Street, City, District, State
    const districtPart = parts[3].replace(/\b\d{6}\b/, '').trim();
    if (districtPart && districtPart.length > 2) {
      return districtPart;
    }
  }
  
  if (parts.length >= 3) {
    // Format: Name, Area, City/District, State
    const cityDistrictPart = parts[2].replace(/\b\d{6}\b/, '').trim();
    if (cityDistrictPart && cityDistrictPart.length > 2) {
      return cityDistrictPart;
    }
  }

  return 'N/A';
}
debugAddressData(): void {
  console.log('=== Address Debug Info ===');
  this.filteredShipments.slice(0, 5).forEach((shipment, index) => {
    console.log(`Shipment ${index + 1}:`);
    console.log('- Customer:', shipment.customer);
    console.log('- Billing Address:', shipment.billingAddress);
    console.log('- Parsed District:', this.parseAddress(shipment.billingAddress, 'district'));
    console.log('---');
  });
}


  // ENHANCED: Improved packing charge calculation method
  private calculatePackingCharge(shipment: Shipment): PackingChargeData {
    let packingCharge = 0;
    let serviceType = '';
    let packingBeforeTax = 0;
    let packingTax = 0;
    let packingAfterTax = 0;

    console.log('Calculating packing charge for shipment:', shipment);

    // Check for PP Service packing charge
    if (shipment.ppServiceData && shipment.ppServiceData.packingCharge) {
      packingCharge = this.safeNumber(shipment.ppServiceData.packingCharge);
      serviceType = 'PP Service';
      
      // For PP service, the packingCharge might already include tax
      packingAfterTax = packingCharge;
      
      console.log('Found PP Service packing charge:', packingCharge);
    }
    // Check for COD packing charge
    else if (shipment.codData && shipment.codData.packingCharge) {
      // COD has both before and after tax amounts
      packingBeforeTax = this.safeNumber(shipment.codData.packingBeforeTax);
      packingCharge = this.safeNumber(shipment.codData.packingCharge);
      serviceType = 'COD';
      
      // Calculate tax if we have both values
      if (packingBeforeTax > 0 && packingCharge > packingBeforeTax) {
        packingTax = packingCharge - packingBeforeTax;
      }
      packingAfterTax = packingCharge;
      
      console.log('Found COD packing charge:', {
        beforeTax: packingBeforeTax,
        tax: packingTax,
        afterTax: packingAfterTax
      });
    }
    // Fallback to serviceCharge if no specific service data
    else if (shipment.serviceCharge) {
      packingCharge = this.safeNumber(shipment.serviceCharge);
      serviceType = shipment.typeOfServiceName || shipment.typeOfService || 'Service';
      packingAfterTax = packingCharge;
      
      console.log('Found service charge:', packingCharge);
    }
    // Additional fallback - check for packing charge directly
    else if (shipment.packingCharge) {
      packingCharge = this.safeNumber(shipment.packingCharge);
      serviceType = shipment.typeOfServiceName || shipment.typeOfService || 'Standard';
      packingAfterTax = packingCharge;
      
      console.log('Found direct packing charge:', packingCharge);
    }

    const result: PackingChargeData = {
      packingCharge: Number(packingAfterTax.toFixed(2)),
      serviceType: serviceType,
      packingBeforeTax: Number(packingBeforeTax.toFixed(2)),
      packingTax: Number(packingTax.toFixed(2)),
      packingAfterTax: Number(packingAfterTax.toFixed(2))
    };

    console.log('Final packing charge calculation:', result);
    return result;
  }

  // ENHANCED: Updated bulk packing slips with comprehensive packing charge handling
  private generateBulkPackingSlipsWithActualData(shipments: Shipment[]): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Bulk Packing Slips</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
          .packing-slip-container { max-width: 800px; margin: 0 auto; padding: 20px; }
          .packing-slip-header { margin-bottom: 20px; }
          .header-top { display: flex; justify-content: space-between; }
          .company-details { flex: 1; }
          .service-type-section { flex: 1; text-align: right; }
          .address-section { margin-bottom: 20px; }
          .address-row { display: flex; justify-content: space-between; }
          .from-section, .to-section { width: 48%; }
          hr { border: 0; border-top: 1px solid #eee; margin: 20px 0; }
          .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          .items-table th, .items-table td { border: 1px solid #ddd; padding: 8px; }
          .items-table th { background-color: #f2f2f2; }
          .totals-section { margin-top: 20px; text-align: right; }
          .totals-row { display: flex; justify-content: space-between; margin-bottom: 5px; }
          .grand-total { font-weight: bold; font-size: 1.2em; border-top: 2px solid #333; padding-top: 10px; }
          .text-right { text-align: right; }
          .packing-charge-highlight { background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 3px 6px; border-radius: 3px; }
          @media print {
            body { font-size: 12pt; }
            .no-print { display: none; }
            .packing-slip { page-break-after: always; }
          }
        </style>
      </head>
      <body>
        ${shipments.map((shipment, shipmentIndex) => {
          // Use the EXACT same calculation logic as individual packing slip component
          const processedProducts = this.processShipmentProducts(shipment);
          const shippingTotals = this.calculateShippingTotals(shipment);
          
          // Extract packing charge data using ENHANCED calculation method
          const packingChargeData = this.calculatePackingCharge(shipment);
          const packingCharge = packingChargeData.packingAfterTax || packingChargeData.packingCharge;
          const serviceType = packingChargeData.serviceType;
          const packingBeforeTax = packingChargeData.packingBeforeTax || 0;
          const packingTax = packingChargeData.packingTax || 0;
          
          // Calculate totals using actual processed product data
          const subtotal = processedProducts.reduce((sum, product) => sum + product.taxableValue, 0);
          const totalCgst = processedProducts.reduce((sum, product) => sum + product.cgstAmount, 0);
          const totalSgst = processedProducts.reduce((sum, product) => sum + product.sgstAmount, 0);
          const totalIgst = processedProducts.reduce((sum, product) => sum + product.igstAmount, 0);
          
const grandTotal = this.safeNumber(shipment.totalPayable) || 
                   this.safeNumber((shipment as any).total) || 
                   this.safeNumber((shipment as any).grandTotal) ||
                   (subtotal + totalCgst + totalSgst + totalIgst + shippingTotals.shippingTotal + packingCharge);
          
          // MODIFICATION: Round the grand total to the nearest whole number
          const roundedGrandTotal = Math.round(grandTotal);

          return `
          <div class="packing-slip-container" ${shipmentIndex < shipments.length - 1 ? 'style="page-break-after: always;"' : ''}>
            <div class="packing-slip-header">
              <div class="header-top">
                <div class="company-details">
                  <div class="company-name"><strong>HERBALY TOUCH AYURVEDA PRODUCTS PRIVATE LIMITED</strong></div>
                  <div class="customer-info">Customer/Billing Mobile: ${shipment.contactNumber || 'N/A'}</div>
                </div>
                  <div class="totals-row grand-total">
                <span><strong>₹${grandTotal.toFixed(2)}</strong></span>
              </div>
                <div class="service-type-section">
                  <div class="service-type"><strong>${shipment.typeOfServiceName || shipment.typeOfService || 'STANDARD'}</strong></div>
               
                  <div class="invoice-date">Inv. No: ${shipment.invoiceNo || 'N/A'}</div>
                </div>
              </div>
            </div>

            <hr class="header-divider">

            <div class="address-section">
              <div class="address-row">
                <div class="from-section">
                  <div class="address-label"><strong>From,</strong></div>
                  <div class="address-details">
                    <div class="company-name"><strong>HERBALY TOUCH AYURVEDA PRODUCTS PRIVATE LIMITED</strong></div>
                    <div>1st Floor, Chirackal Tower, Ayroor P.O., Ernakulam, Kerala, 683579, India</div>
                    <div>Mobile: 00917034110999</div>
                    <div>GST: 32AAGCH3136H12X</div>
                  </div>
                </div>
                
                <div class="to-section">
                  <div class="address-label"><strong>To,</strong></div>
                  <div class="address-details">
                    <div>${shipment.billingAddress || shipment.shippingDetails || 'N/A'}</div>
                    ${shipment.contactNumber ? `<div>Mobile: ${shipment.contactNumber}</div>` : ''}
                    ${shipment.alternateContact ? `<div>Alt: ${shipment.alternateContact}</div>` : ''}
                    <div class="invoice-details">
                      <div>Invoice No: ${shipment.invoiceNo || 'N/A'}</div>
                      <div>Date: ${this.formatDateForDisplay(shipment.date)}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

<div class="address-details">
                    <div>${shipment.billingAddress || shipment.shippingDetails || 'N/A'}</div>
                    ${shipment.contactNumber ? `<div>Mobile: ${shipment.contactNumber}</div>` : ''}
                    ${shipment.alternateContact ? `<div>Alt: ${shipment.alternateContact}</div>` : ''}
                    <div class="invoice-details">
                      <div>Invoice No: ${shipment.invoiceNo || 'N/A'}</div>
                      <div>Date: ${this.formatDateForDisplay(shipment.date)}</div>
                    </div>
                  </div>
                              <hr class="section-divider">

            <div class="packing-slip-items">
              <table class="items-table">
                <thead>
                  <tr>
                    <th style="width: 5%;">#</th>
                    <th style="width: 30%;">Product</th>
                    <th style="width: 8%;">Qty</th>
                    <th style="width: 12%;">Unit Price (₹)</th>
                    <th style="width: 10%;">Discount (₹)</th>
                    <th style="width: 12%;">Taxable Value (₹)</th>
                    <th style="width: 8%;">CGST (₹)</th>
                    <th style="width: 8%;">SGST (₹)</th>
                    <th style="width: 7%;">IGST (₹)</th>
                    <th style="width: 12%;">Sub Total (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  ${processedProducts.map((product, i) => {
                    return `
                    <tr>
                      <td>${i + 1}</td>
                      <td>
                        <strong>${product.name}</strong>
                        <br><span class="product-code" style="font-size: 0.9em; color: #666;">(${product.code || 'MRP ' + product.unitPrice})</span>
                      </td>
                      <td>${product.quantity} Nos.</td>
                      <td class="text-right">₹${product.unitPrice.toFixed(2)}</td>
                      <td class="text-right">₹${product.discount.toFixed(2)}</td>
                      <td class="text-right">₹${product.taxableValue.toFixed(2)}</td>
                      <td class="text-right">₹${product.cgstAmount.toFixed(2)} ${product.cgstRate > 0 ? '(' + product.cgstRate.toFixed(1) + '%)' : ''}</td>
                      <td class="text-right">₹${product.sgstAmount.toFixed(2)} ${product.sgstRate > 0 ? '(' + product.sgstRate.toFixed(1) + '%)' : ''}</td>
                      <td class="text-right">₹${product.igstAmount.toFixed(2)} ${product.igstRate > 0 ? '(' + product.igstRate.toFixed(1) + '%)' : ''}</td>
                      <td class="text-right">₹${product.subtotal.toFixed(2)}</td>
                    </tr>
                    `;
                  }).join('')}
                  ${processedProducts.length === 0 ? `
                  <tr>
                    <td colspan="10" style="text-align: center; padding: 20px; color: #666;">No products found</td>
                  </tr>
                  ` : ''}
                </tbody>
              </table>
            </div>

            <hr class="footer-divider">

            <div class="totals-section">
              <div class="totals-row">
                <span><strong>Total Taxable Value:</strong></span>
                <span><strong>₹${subtotal.toFixed(2)}</strong></span>
              </div>
              ${totalCgst > 0 ? `
              <div class="totals-row">
                <span>Total CGST:</span>
                <span>₹${totalCgst.toFixed(2)}</span>
              </div>
              ` : ''}
              ${totalSgst > 0 ? `
              <div class="totals-row">
                <span>Total SGST:</span>
                <span>₹${totalSgst.toFixed(2)}</span>
              </div>
              ` : ''}
              ${totalIgst > 0 ? `
              <div class="totals-row">
                <span>Total IGST:</span>
                <span>₹${totalIgst.toFixed(2)}</span>
              </div>
              ` : ''}
              <div class="totals-row">
                <span>Total Product Tax:</span>
                <span>₹${(totalCgst + totalSgst + totalIgst).toFixed(2)}</span>
              </div>
              <div class="totals-row">
                <span>Shipping Charges:</span>
                <span>₹${shippingTotals.shipping.toFixed(2)}</span>
              </div>
              <div class="totals-row">
                <span>Shipping GST (18%):</span>
                <span>₹${shippingTotals.shippingTax.toFixed(2)}</span>
              </div>
              ${packingCharge > 0 ? `
              <div class="totals-row">
                <span class="packing-charge-highlight">
                  <strong>Packing Charges${serviceType ? ' (' + serviceType + ')' : ''}:</strong>
                </span>
                <span class="packing-charge-highlight">
                  <strong>₹${packingCharge.toFixed(2)}</strong>
                </span>
              </div>
              ${packingBeforeTax > 0 && packingTax > 0 ? `
              <div class="totals-row" style="font-size: 0.9em; color: #666;">
                <span style="margin-left: 20px;">└ Before Tax: ₹${packingBeforeTax.toFixed(2)}</span>
                <span>Tax: ₹${packingTax.toFixed(2)}</span>
              </div>
              ` : ''}
              ` : `
              <div class="totals-row" style="color: #666;">
                <span>Packing Charges:</span>
                <span>₹0.00</span>
              </div>
              `}
                 <div class="totals-row grand-total">
                <span><strong>GRAND TOTAL:</strong></span>
                <!-- MODIFICATION: Display the rounded total -->
                <span><strong>₹${roundedGrandTotal.toFixed(0)}</strong></span>
              </div>
            </div>
<hr>
            <div class="packing-slip-footer" style="margin-top: 30px; text-align: center; font-size: 0.9em; color: #666;">
              <div class="footer-info">
                <div class="page-info">Packing Slip ${shipmentIndex + 1} of ${shipments.length}</div>
              </div>
            </div>
          </div>
          `;
        }).join('')}
        
        <div class="no-print" style="margin-top: 20px; text-align: center;">
          <button onclick="window.print()" style="padding: 10px 20px; background: #4CAF50; color: white; border: none; cursor: pointer; margin-right: 10px;">
            Print All Packing Slips
          </button>
          <button onclick="window.close()" style="padding: 10px 20px; background: #f44336; color: white; border: none; cursor: pointer;">
            Close
          </button>
        </div>
      </body>
      </html>
    `;
  }

  generateInvoice(shipment: any): void {
    this.currentShipment = shipment;
    console.log('Generating invoice for shipment:', shipment);

    // Reset flags
    this.invoiceHasIgst = false;
    this.invoiceHasCgstSgst = false;

    // Use the new robust helper function to process products
    const processedProducts = this.processShipmentProducts(shipment);

    // Check the processed products to set the display flags
    processedProducts.forEach(p => {
        if (p.taxType === 'IGST') this.invoiceHasIgst = true;
        if (p.taxType === 'CGST+SGST') this.invoiceHasCgstSgst = true;
    });

    // Final logic: If any product has IGST, we only show the IGST column.
    if (this.invoiceHasIgst) {
      this.invoiceHasCgstSgst = false;
    } else if (processedProducts.length > 0) {
      this.invoiceHasCgstSgst = true;
    }

    // --- The rest of the invoice generation logic remains the same ---
    const totalTaxableValue = processedProducts.reduce((sum, p) => sum + p.taxableValue, 0);
    const grandTotal = Number(shipment.totalPayable) || 0;

    this.invoiceData = {
      invoiceNo: shipment.invoiceNo || 'N/A',
      date: this.formatDateForDisplay(shipment.date),
      from: {
        companyName: 'HERBALY TOUCH AYURVEDA PRODUCTS PRIVATE LIMITED',
        address: '1st Floor, Chirackal Tower, Ayroor P.O, Emakulam, Kerala, 683579, India',
        mobile: '00917034110999',
        gst: '32AAGCH3136H12X'
      },
      to: {
        name: shipment.customer || 'N/A',
        address: shipment.billingAddress || shipment.shippingDetails || 'N/A',
        mobile: shipment.contactNumber || 'N/A'
      },
      products: processedProducts,
      shippingCharge: Number(shipment.shippingCharge) || Number((shipment as any).shippingCharges) || 0,
      shippingTax: (Number(shipment.shippingCharge) || 0) * ((Number((shipment as any).orderTax) || 18) / 100),
      totalTaxableValue: parseFloat(totalTaxableValue.toFixed(2)),
      taxes: [],
      total: parseFloat(grandTotal.toFixed(2))
    };

    this.invoiceModal.show();
  }

  // NEW METHOD: Extract the product processing logic to reuse in bulk methods
  private processShipmentProducts(shipment: Shipment): ProcessedProduct[] {
    const products = shipment.products || [];
    
    return products.map((product: any) => {
      // Ensure all values are treated as numbers to prevent errors
      const unitPriceBeforeTax = Number(product.priceBeforeTax) || Number(product.unitPrice) || 0;
      const quantity = Number(product.quantity) || 1;
      const discount = Number(product.discount) || Number(product.discountAmount) || 0;
      const taxableValue = (unitPriceBeforeTax * quantity) - discount;

      const cgstAmount = Number(product.cgstAmount) || 0;
      const sgstAmount = Number(product.sgstAmount) || 0;
      const igstAmount = Number(product.igstAmount) || 0;
      const subtotal = taxableValue + cgstAmount + sgstAmount + igstAmount;
      
      const taxRate = Number(product.taxRate) || 0;
      let cgstRate = 0, sgstRate = 0, igstRate = 0;

      // Determine rates for display based on the saved tax type
      if (product.taxType === 'IGST') {
          igstRate = taxRate;
      } else {
          cgstRate = taxRate / 2;
          sgstRate = taxRate / 2;
      }

      return {
        name: product.name || product.productName || 'Unknown Product',
        productName: product.productName || product.name,
        code: product.sku || '',
        quantity: quantity,
        unitPrice: parseFloat(unitPriceBeforeTax.toFixed(2)),
        discount: parseFloat(discount.toFixed(2)),
        discountPercent: Number(product.discountPercent) || 0,
        taxableValue: parseFloat(taxableValue.toFixed(2)),
        taxType: product.taxType || 'CGST+SGST',
        cgstAmount: parseFloat(cgstAmount.toFixed(2)),
        sgstAmount: parseFloat(sgstAmount.toFixed(2)),
        igstAmount: parseFloat(igstAmount.toFixed(2)),
        cgstRate: parseFloat(cgstRate.toFixed(2)),
        sgstRate: parseFloat(sgstRate.toFixed(2)),
        igstRate: parseFloat(igstRate.toFixed(2)),
        subtotal: parseFloat(subtotal.toFixed(2))
      };
    });
  }

  // NEW METHOD: Calculate shipping totals using same logic as generateInvoice
  private calculateShippingTotals(shipment: Shipment): { shipping: number; shippingTax: number; shippingTotal: number } {
    const shippingCharge = this.safeNumber(shipment.shippingCharge || (shipment as any).shippingCharges);
    const shippingTaxRate = this.safeNumber((shipment as any).orderTax, 18);
    const shippingTax = shippingCharge * (shippingTaxRate / 100);
    
    return {
      shipping: parseFloat(shippingCharge.toFixed(2)),
      shippingTax: parseFloat(shippingTax.toFixed(2)),
      shippingTotal: parseFloat((shippingCharge + shippingTax).toFixed(2))
    };
  }

 generateBulkDocuments(type: 'packing-slip' | 'invoice'): void {
    if (this.selectedShipments.length === 0) {
      alert('Please select at least one shipment');
      return;
    }

    const selectedData = this.filteredShipments.filter(shipment => 
      this.selectedShipments.includes(shipment.id)
    );

    if (type === 'packing-slip') {
      const printContent = this.generateBulkPackingSlipsWithActualData(selectedData);
      this.openPrintWindow(printContent);
    } else if (type === 'invoice') {
      const printContent = this.generateBulkInvoicesWithActualData(selectedData);
      this.openPrintWindow(printContent);
    }
  }

private generateBulkInvoicesWithActualData(shipments: Shipment[]): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Bulk Invoices</title>
        <meta charset="UTF-8">
        <style>
          /* Your existing styles remain here */
          body { font-family: Arial, sans-serif; margin: 20px; }
          .invoice { border: 1px solid #ccc; padding: 20px; margin-bottom: 20px; page-break-after: always; }
          .invoice-print-header { display: flex; align-items: center; margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #eee; }
          .logo { width: 80px; height: auto; margin-right: 20px; }
          .company-details h3 { font-size: 1.1rem; font-weight: bold; margin: 0; }
          .company-details p { font-size: 0.8rem; margin: 2px 0; }
          .details { display: flex; justify-content: space-between; margin-bottom: 20px; }
          .products-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          .products-table th, .products-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          .products-table th { background-color: #f2f2f2; }
          .totals { text-align: right; margin-top: 20px; }
          .text-end { text-align: right; }
          .grand-total { font-weight: bold; font-size: 1.1em; }
          @media print { .no-print { display: none; } .invoice { border: none; } }
        </style>
      </head>
      <body>
        ${shipments.map((shipment) => {
          const processedProducts = this.processShipmentProducts(shipment);
          const shippingTotals = this.calculateShippingTotals(shipment);
          const packingChargeData = this.calculatePackingCharge(shipment);
          const packingCharge = packingChargeData.packingAfterTax || 0;

          // --- Logic to determine tax columns for THIS invoice ---
          let shipmentHasIgst = processedProducts.some(p => p.taxType === 'IGST' && p.igstAmount > 0);
          let shipmentHasCgstSgst = processedProducts.some(p => p.taxType !== 'IGST' && (p.cgstAmount > 0 || p.sgstAmount > 0));
          if (shipmentHasIgst) { shipmentHasCgstSgst = false; } // IGST takes precedence

          const subtotal = processedProducts.reduce((sum, p) => sum + p.taxableValue, 0);
          const totalCgst = processedProducts.reduce((sum, p) => sum + p.cgstAmount, 0);
          const totalSgst = processedProducts.reduce((sum, p) => sum + p.sgstAmount, 0);
          const totalIgst = processedProducts.reduce((sum, p) => sum + p.igstAmount, 0);
          const grandTotal = this.safeNumber(shipment.totalPayable);
          const roundedGrandTotal = Math.round(grandTotal);

          return `
          <div class="invoice">
            <div class="invoice-print-header">
              <img src="assets/logo2.png" alt="Company Logo" class="logo">
              <div class="company-details">
                <h3>HERBALY TOUCH AYURVEDA PRODUCTS PRIVATE LIMITED</h3>
                <p>1st Floor, Chirackal Tower, Ayroor P.O, Emakulam, Kerala, 683579, India</p>
                <p>Mobile: 00917034110999 | GST: 32AAGCH3136H12X</p>
              </div>
            </div>
            <div class="details">
              <div>
                <p><strong>Invoice No:</strong> ${shipment.invoiceNo || 'N/A'}</p>
                <p><strong>Date:</strong> ${this.formatDateForDisplay(shipment.date)}</p>
              </div>
              <div class="text-end">
                <p>${shipment.billingAddress || 'N/A'}</p>
                <p>Mobile: ${shipment.contactNumber || 'N/A'}</p>
              </div>
            </div>
            <table class="products-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Unit Price (₹)</th>
                  <th>Discount (₹)</th>
                  <th>Taxable Value (₹)</th>
                  ${shipmentHasCgstSgst ? `<th>CGST (₹)</th>` : ''}
                  ${shipmentHasCgstSgst ? `<th>SGST (₹)</th>` : ''}
                  ${shipmentHasIgst ? `<th>IGST (₹)</th>` : ''}
                  <th>Subtotal (₹)</th>
                </tr>
              </thead>
              <tbody>
                ${processedProducts.map((p, i) => `
                  <tr>
                    <td>${i + 1}</td>
                    <td>${p.name}</td>
                    <td>${p.quantity}</td>
                    <td class="text-end">${p.unitPrice.toFixed(2)}</td>
                    <td class="text-end">${p.discount.toFixed(2)}</td>
                    <td class="text-end">${p.taxableValue.toFixed(2)}</td>
                    ${shipmentHasCgstSgst ? `<td class="text-end">${p.cgstAmount.toFixed(2)} (${p.cgstRate.toFixed(2)}%)</td>` : ''}
                    ${shipmentHasCgstSgst ? `<td class="text-end">${p.sgstAmount.toFixed(2)} (${p.sgstRate.toFixed(2)}%)</td>` : ''}
                    ${shipmentHasIgst ? `<td class="text-end">${p.igstAmount.toFixed(2)} (${p.igstRate.toFixed(2)}%)</td>` : ''}
                    <td class="text-end">${p.subtotal.toFixed(2)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <div class="totals">
               <p><strong>Total Taxable Value:</strong> ₹${subtotal.toFixed(2)}</p>
               ${shipmentHasCgstSgst ? `<p><strong>Total CGST:</strong> ₹${totalCgst.toFixed(2)}</p>` : ''}
               ${shipmentHasCgstSgst ? `<p><strong>Total SGST:</strong> ₹${totalSgst.toFixed(2)}</p>` : ''}
               ${shipmentHasIgst ? `<p><strong>Total IGST:</strong> ₹${totalIgst.toFixed(2)}</p>` : ''}
               <p><strong>Shipping Charges:</strong> ₹${shippingTotals.shipping.toFixed(2)}</p>
               <p><strong>Packing Charges:</strong> ₹${packingCharge.toFixed(2)}</p>
               <p class="grand-total"><strong>Grand Total:</strong> ₹${roundedGrandTotal.toFixed(0)}</p>
            </div>
            <div class="text-center" style="margin-top: 20px;">
              <small>This is a computer generated invoice and does not require signature</small>
            </div>
          </div>
          `;
        }).join('')}
        <div class="no-print" style="text-align: center; margin-top: 20px;">
            <button onclick="window.print()">Print All Invoices</button>
        </div>
      </body>
      </html>
    `;
  }

  printGeneratedInvoice(): void {
    // Get the print-only content
    const printContent = document.querySelector('.print-only')?.innerHTML;
    
    if (!printContent) {
      console.error('Print content not found');
      return;
    }

    // Create a new window for printing
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    
    if (!printWindow) {
      console.error('Could not open print window');
      return;
    }

    // Write the print content with proper styling
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice #${this.invoiceData.invoiceNo}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 20px;
              font-size: 12px;
              line-height: 1.4;
            }
            /* MODIFICATION: Added styles for logo header */
            .invoice-print-header { display: flex; align-items: center; margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #eee; }
            .logo { width: 80px; height: auto; margin-right: 20px; }
            .company-details { text-align: left; }
            .company-details h3 { font-size: 1.1rem; font-weight: bold; margin: 0; }
            .company-details p { font-size: 0.8rem; margin: 2px 0; }
            /* End of new styles */
            .invoice-print-container { max-width: 800px; margin: 0 auto; }
            .invoice-info { display: flex; justify-content: space-between; margin-bottom: 20px; }
            .invoice-details, .customer-details { flex: 1; }
            .customer-details { text-align: right; }
            .products-section { margin-bottom: 20px; }
            .products-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
            .products-table th, .products-table td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 11px; }
            .products-table th { background-color: #f5f5f5; font-weight: bold; }
            .text-right { text-align: right; }
            .totals-section, .payment-section { margin-bottom: 15px; }
            .total-row, .payment-row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #eee; }
            .grand-total { font-weight: bold; font-size: 14px; border-top: 2px solid #333; border-bottom: 2px solid #333; padding: 10px 0; }
            .invoice-footer { text-align: center; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 15px; }
            @media print {
              body { margin: 0; padding: 15px; }
              .invoice-print-container { max-width: none; }
            }
          </style>
        </head>
        <body>
          ${printContent}
        </body>
      </html>
    `);

    printWindow.document.close();
    
    // Wait for content to load then print
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
      
      // Close the print window after printing
      printWindow.onafterprint = () => {
        printWindow.close();
      };
    };
  }



  private openPrintWindow(content: string): void {
    const printWindow = window.open('', '_blank', 'width=900,height=650');
    if (!printWindow) {
      alert('Please allow popups for printing');
      return;
    }
    
    printWindow.document.write(content);
    printWindow.document.close();
    
    printWindow.onload = () => {
      printWindow.focus();
    };
  }

  // Rest of the existing methods remain the same...
  getMedicineTypeName(type: string): string {
    const typeNames: {[key: string]: string} = {
      'kasayam': 'കഷായം',
      'kasayam_combination': 'കഷായം ',
      'buligha': 'ഗുളിക',
      'bhasmam': 'ഭസ്മം',
      'krudham': 'ഘൃതം',
      'suranam': 'ചൂർണ്ണം',
      'rasayanam': 'Rരസായനം',
      'lagium': 'ലേഹ്യം'
    };
    return typeNames[type] || 'Medicine';
  }

  viewPrescription(shipment: Shipment): void {
    console.log('Viewing prescription for shipment:', shipment);
    
    if (!shipment.prescriptions || shipment.prescriptions.length === 0) {
      alert('No prescription available for this shipment.');
      return;
    }
    
    this.allPrescriptions = shipment.prescriptions;
    this.currentPrescriptionIndex = 0;
    this.currentPrescriptionData = this.allPrescriptions[0];
    
    if (!this.prescriptionModal) {
      const modalElement = document.getElementById('prescriptionModal');
      if (modalElement) {
        this.prescriptionModal = new bootstrap.Modal(modalElement);
      }
    }
    
    if (this.prescriptionModal) {
      this.prescriptionModal.show();
    }
  }

  nextPrescription(): void {
    if (this.currentPrescriptionIndex < this.allPrescriptions.length - 1) {
      this.currentPrescriptionIndex++;
      this.currentPrescriptionData = this.allPrescriptions[this.currentPrescriptionIndex];
    }
  }

  previousPrescription(): void {
    if (this.currentPrescriptionIndex > 0) {
      this.currentPrescriptionIndex--;
      this.currentPrescriptionData = this.allPrescriptions[this.currentPrescriptionIndex];
    }
  }

  hasMultiplePrescriptions(): boolean {
    return this.allPrescriptions.length > 1;
  }

  getCurrentPrescriptionInfo(): string {
    if (this.allPrescriptions.length === 0) return '';
    return `Prescription ${this.currentPrescriptionIndex + 1} of ${this.allPrescriptions.length}`;
  }

  printPrescriptionPDF(): void {
    if (!this.currentPrescriptionData) return;
    
    const printContent = this.generatePrescriptionPDFContent(this.currentPrescriptionData);
    const printWindow = window.open('', '_blank');
    
    if (!printWindow) {
      alert('Please allow popups for this website to print prescriptions.');
      return;
    }

    printWindow.document.write(printContent);
    printWindow.document.close();
    
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
  }

  printAllPrescriptions(): void {
    if (!this.allPrescriptions || this.allPrescriptions.length === 0) return;
    
    const printContent = this.generateAllPrescriptionsPDFContent(this.allPrescriptions);
    const printWindow = window.open('', '_blank');
    
    if (!printWindow) {
      alert('Please allow popups for this website to print prescriptions.');
      return;
    }

    printWindow.document.write(printContent);
    printWindow.document.close();
    
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
  }

  openActionPopup(shipment: Shipment, event: Event): void {
    event.stopPropagation();
    this.currentActionPopup = shipment.id;
  }

  closeActionPopup(): void {
    this.currentActionPopup = null;
  }

  @HostListener('document:keydown.escape', ['$event'])
  onKeydownHandler(event: KeyboardEvent) {
    this.closeActionPopup();
  }

  viewShipment(): void {
    if (this.selectedShipment) {
      this.router.navigate(['/shipments/view', this.selectedShipment.id]);
      this.closeActionPopup();
    }
  }

  downloadPrescriptionPDF(): void {
    if (!this.currentPrescriptionData) return;
    this.printPrescriptionPDF();
  }

  toggleActionMenu(shipmentId: string): void {
    if (this.openedActionMenuId === shipmentId) {
      this.openedActionMenuId = null;
    } else {
      this.openedActionMenuId = shipmentId;
    }
  }

  closeActionMenu(): void {
    this.openedActionMenuId = null;
  }

  private generateAllPrescriptionsPDFContent(prescriptions: PrescriptionData[]): string {
    const prescriptionsHtml = prescriptions.map((prescription, prescriptionIndex) => {
      const formattedDate = prescription.date ? 
        new Date(prescription.date).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }) : 
        new Date().toLocaleDateString();
      
      let medicinesHtml = '';
      if (prescription.medicines && prescription.medicines.length > 0) {
        prescription.medicines.forEach((medicine, index) => {
          medicinesHtml += `
            <div class="medicine-item" style="margin-bottom: 20px; page-break-inside: avoid;">
              <h4 style="font-size: 16px; margin-bottom: 8px; color: #0056b3;">
                ${index + 1}. ${this.getMedicineTypeName(medicine.type)}
              </h4>
              ${this.generateMedicineDetailsHTML(medicine)}
            </div>
          `;
        });
      }

      return `
      <div class="prescription-page" style="page-break-after: ${prescriptionIndex < prescriptions.length - 1 ? 'always' : 'auto'};">
        <div class="header">
          <div class="logo-container">
            <img src="/assets/logo2.png" style="width: 120px; height: auto;">
          </div>
          <div class="header-content" style="margin-left: 140px;">
            <h2>DR.RAJANA P.R.,BAMS</h2>
            <h3>HERBALLY TOUCH AYURVEDA PRODUCTS PVT.LTD.</h3>
            <p>First Floor, Chirackal Tower, Ayroor P.O., Ernakulam Dt., Kerala - 683 579</p>
            <p>E-mail: contact@herballytouch.com | Ph: 7034110999</p>
          </div>
        </div>
        
        <table class="prescription-table" style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <tr>
            <td style="padding: 8px; vertical-align: top;"><strong>Name</strong></td>
            <td style="padding: 8px; vertical-align: top;">${prescription.patientName || '______'}</td>
            <td style="padding: 8px; vertical-align: top;"><strong>Age</strong></td>
            <td style="padding: 8px; vertical-align: top;">${prescription.patientAge || '______'}</td>
            <td style="padding: 8px; vertical-align: top;"><strong>Date</strong></td>
            <td style="padding: 8px; vertical-align: top;">${formattedDate}</td>
          </tr>
        </table>
        
        <div class="prescription-title">PRESCRIPTION ${prescriptionIndex + 1}</div>
        
        <div class="prescription-medicines">
          ${medicinesHtml}
        </div>
        
        ${prescription.additionalNotes ? `
          <div class="additional-notes">
            <h4>Additional Notes:</h4>
            <p>${prescription.additionalNotes}</p>
          </div>
        ` : ''}
        
        <div class="footer">
          <div class="clinic-info">
            <p><strong>Doctor:</strong> ${prescription.doctorName || 'Dr. Rajana P.R., BAMS'}</p>
            <p><strong>Generated On:</strong> ${new Date().toLocaleDateString()}</p>
          </div>
          
          <div class="signature-section">
            <div class="signature-line"></div>
            <p>Doctor's Signature</p>
          </div>
        </div>
      </div>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>All Prescriptions</title>
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
            position: relative;
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
          .header-content {
            margin-left: 140px;
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
          .prescription-title {
            text-align: center;
            font-size: 20px;
            font-weight: bold;
            margin: 30px 0 20px 0;
            color: #0056b3;
            border-bottom: 1px solid #dee2e6;
            padding-bottom: 10px;
          }
          .medicine-item { 
            margin-bottom: 25px; 
            padding: 15px;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            background: #ffffff;
          }
          .medicine-content {
            margin-left: 20px;
            font-size: 16px;
            line-height: 1.8;
          }
          .malayalam-text {
            font-family: "Noto Sans Malayalam", Arial, sans-serif;
            font-size: 16px;
            line-height: 1.8;
          }
          .additional-notes {
            margin-top: 30px;
            padding: 15px;
            background: #e9ecef;
            border-radius: 8px;
            border-left: 4px solid #0056b3;
          }
          .footer {
            margin-top: 50px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            padding-top: 30px;
            border-top: 1px solid #dee2e6;
          }
          .signature-section {
            text-align: center;
          }
          .signature-line {
            border-top: 2px solid #000;
            width: 200px;
            margin: 60px auto 10px auto;
          }
          .clinic-info {
            text-align: center;
            font-size: 14px;
            color: #6c757d;
          }
          
          @media print {
            body {
              padding: 10px;
              font-size: 14px;
            }
            .prescription-header {
              margin-top: 0;
            }
          }
        </style>
      </head>
      <body>
        ${prescriptionsHtml}
        
        <div style="margin-top: 40px; text-align: center; font-size: 12px; color: #6c757d;">
          <p><strong>Important:</strong> Please follow the dosage instructions carefully. Do not share your medicines with others.</p>
          <p>For any queries, contact: 7034110999 (10AM - 6PM)</p>
        </div>
      </body>
      </html>
    `;
  }

  private generatePrescriptionPDFContent(prescription: PrescriptionData): string {
    const formattedDate = prescription.date ? 
      new Date(prescription.date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }) : 
      new Date().toLocaleDateString();
    
    let medicinesHtml = '';
    if (prescription.medicines && prescription.medicines.length > 0) {
      prescription.medicines.forEach((medicine, index) => {
        medicinesHtml += `
          <div class="medicine-item" style="margin-bottom: 20px; page-break-inside: avoid;">
            <h4 style="font-size: 16px; margin-bottom: 8px; color: #0056b3;">
              ${index + 1}. ${this.getMedicineTypeName(medicine.type)}
            </h4>
            ${this.generateMedicineDetailsHTML(medicine)}
          </div>
        `;
      });
    }

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Prescription - ${prescription.patientName}</title>
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
            position: relative;
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
          .header-content {
            margin-left: 140px;
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
          .prescription-title {
            text-align: center;
            font-size: 20px;
            font-weight: bold;
            margin: 30px 0 20px 0;
            color: #0056b3;
            border-bottom: 1px solid #dee2e6;
            padding-bottom: 10px;
          }
          .medicine-item { 
            margin-bottom: 25px; 
            padding: 15px;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            background: #ffffff;
          }
          .medicine-content {
            margin-left: 20px;
            font-size: 16px;
            line-height: 1.8;
          }
          .malayalam-text {
            font-family: "Noto Sans Malayalam", Arial, sans-serif;
            font-size: 16px;
            line-height: 1.8;
          }
          .additional-notes {
            margin-top: 30px;
            padding: 15px;
            background: #e9ecef;
            border-radius: 8px;
            border-left: 4px solid #0056b3;
          }
          .footer {
            margin-top: 50px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            padding-top: 30px;
            border-top: 1px solid #dee2e6;
          }
          .signature-section {
            text-align: center;
          }
          .signature-line {
            border-top: 2px solid #000;
            width: 200px;
            margin: 60px auto 10px auto;
          }
          .clinic-info {
            text-align: center;
            font-size: 14px;
            color: #6c757d;
          }
          
          @media print {
            body {
              padding: 10px;
              font-size: 14px;
            }
            .prescription-header {
              margin-top: 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo-container">
            <img src="/assets/logo2.png">
          </div>
          <div class="header-content">
            <h2>DR.RAJANA P.R.,BAMS</h2>
            <h3>HERBALLY TOUCH AYURVEDA PRODUCTS PVT.LTD.</h3>
            <p>First Floor, Chirackal Tower, Ayroor P.O., Ernakulam Dt., Kerala - 683 579</p>
            <p>E-mail: contact@herballytouch.com | Ph: 7034110999</p>
          </div>
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
        
        <div class="prescription-title">PRESCRIPTION</div>
        
        <div class="prescription-medicines">
          ${medicinesHtml}
        </div>
        
        ${prescription.additionalNotes ? `
          <div class="additional-notes">
            <h4>Additional Notes:</h4>
            <p>${prescription.additionalNotes}</p>
          </div>
        ` : ''}
        
        <div class="footer">
          <div class="clinic-info">
            <p><strong>Doctor:</strong> ${prescription.doctorName || 'Dr. Rajana P.R., BAMS'}</p>
            <p><strong>Generated On:</strong> ${new Date().toLocaleDateString()}</p>
            <p style="margin-top: 20px; font-style: italic;">
              This prescription is valid for 30 days from the date of issue.
            </p>
          </div>
          
          <div class="signature-section">
            <div class="signature-line"></div>
            <p>Doctor's Signature</p>
            <div style="margin-top: 30px; border: 2px dashed #6c757d; padding: 20px; text-align: center;">
              <p style="color: #6c757d; margin: 0;">Clinic Stamp</p>
            </div>
          </div>
        </div>
        
        <div style="margin-top: 40px; text-align: center; font-size: 12px; color: #6c757d;">
          <p><strong>Important:</strong> Please follow the dosage instructions carefully. Do not share your medicines with others.</p>
          <p>For any queries, contact: 7034110999 (10AM - 6PM)</p>
        </div>
      </body>
      </html>
    `;
  }

  private generateMedicineDetailsHTML(medicine: Medicine): string {
    let details = '';
    
    switch(medicine.type) {
     case 'kasayam':
        details = `
          <div class="medicine-content malayalam-text">
            <p><strong>${medicine.name}</strong> കഷായം ${medicine.instructions || ''}ml എടുത്ത് 
            ${medicine.quantity || ''}ml തിളപ്പിച്ചാറ്റിയവെള്ളം ചേർത്ത് 
            ${medicine.powder || ''} ഗുളിക പൊടിച്ച്ചേർത്ത് 
           മുമ്പ്
   സേവിക്കുക.</p>
          </div>
        `;
        break;

      case 'kasayam_combination':
        details = `
          <div class="medicine-content malayalam-text">
            <p><strong>${medicine.name}</strong>കഷായം ${medicine.quantity || ''} ml എടുത്ത്
            ${medicine.combinationQuantity || ''} ml തിളപ്പിച്ചാറ്റിയവെള്ളം ചേർത്ത്
            ${medicine.combinationName || ''}ഗുളിക പൊടിച്ച്ചേർത്ത്
            ${medicine.frequency || ''} ശേഷം
   സേവിക്കുക.</p>
          </div>
        `;
        break;
        
      case 'buligha':
        details = `
          <div class="medicine-content malayalam-text">
            <p><strong>${medicine.name}</strong> ഗുളിക ${medicine.instructions || ''} എണ്ണം എടുത്ത് 
            ${medicine.powder || ''} നേരം         മുമ്പ്
   സേവിക്കുക.</p>
          </div>
        `;
        break;
        
      case 'bhasmam':
        details = `
          <div class="medicine-content malayalam-text">
            <p><strong>${medicine.name}</strong> ഭസ്മം ${medicine.dosage || ''} എടുത്ത് ${medicine.quantity || ''}ml 
            ${medicine.instructions || ''} ചേർത്ത് ${medicine.powder || ''} നേരം ശേഷം സേവിക്കുക.</p>
          </div>
        `;
        break;
        
      case 'krudham':
        details = `
          <div class="medicine-content malayalam-text">
            <p><strong>${medicine.name}</strong> ഘൃതം ഒരു ടീ - സ്പൂൺ എടുത്ത് ${medicine.instructions || ''} നേരം ശേഷം സേവിക്കുക.</p>
          </div>
        `;
        break;
        
      case 'suranam':
        details = `
          <div class="medicine-content malayalam-text">
            <p><strong>${medicine.name}</strong> ചൂർണ്ണം ${medicine.instructions || ''} എടുത്ത് ${medicine.powder || ''} ചേർത്ത് തിളപ്പിച്ച് 
            ${medicine.dosage || ''} നേരം ശേഷം
   സേവിക്കുക.</p>
          </div>
        `;
        break;
        
      case 'rasayanam':
        details = `
          <div class="medicine-content malayalam-text">
            <p><strong>${medicine.name}</strong> രസായനം ഒരു ടീ - സ്പൂൺ എടുത്ത് ശേഷം
  സേവിക്കുക.</p>
          </div>
        `;
        break;
        
      case 'lagium':
        details = `
          <div class="medicine-content malayalam-text">
            <p><strong>${medicine.name}</strong> ലേഹ്യം ${medicine.instructions || ''} എടുത്ത് ${medicine.dosage || ''} നേരം 
  മുമ്പ്സേവിക്കുക.</p>
          </div>
        `;
        break;
        
      default:
        details = `
          <div class="medicine-content">
            <p><strong>Medicine:</strong> ${medicine.name || 'Not specified'}</p>
            ${medicine.dosage ? `<p><strong>Dosage:</strong> ${medicine.dosage}</p>` : ''}
            ${medicine.instructions ? `<p><strong>Instructions:</strong> ${medicine.instructions}</p>` : ''}
            <p><strong>Time:</strong>
  മുമ്പ്</p>
          </div>
        `;
    }
    
    return details;
  }

  private convertFirebaseDate(firebaseDate: any): Date {
    if (!firebaseDate) {
      return new Date();
    }
    
    if (firebaseDate instanceof Date) {
      return firebaseDate;
    }
    
    if (firebaseDate && typeof firebaseDate.toDate === 'function') {
      return firebaseDate.toDate();
    }
    
    if (typeof firebaseDate === 'string') {
      const date = new Date(firebaseDate);
      return isNaN(date.getTime()) ? new Date() : date;
    }
    
    if (typeof firebaseDate === 'number') {
      return new Date(firebaseDate);
    }
    
    if (firebaseDate && firebaseDate.seconds) {
      return new Date(firebaseDate.seconds * 1000);
    }
    
    return new Date();
  }

  formatDateForDisplay(date: Date | string): string {
    if (!date) return 'N/A';
    
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    if (isNaN(dateObj.getTime())) {
      return 'Invalid Date';
    }
    
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  getPagesArray(): number[] {
    const totalPages = this.getTotalPages();
    const pages: number[] = [];
    
    const startPage = Math.max(1, this.currentPage - 2);
    const endPage = Math.min(totalPages, this.currentPage + 2);
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    
    return pages;
  }

  confirmDelete(shipment: Shipment): void {
    if (confirm(`Are you sure you want to delete this shipment for ${shipment.customer || 'this customer'}?`)) {
      this.deleteShipment(shipment.id);
    }
  }

  printShipment(shipment: Shipment): void {
    const printContent = this.generateSingleShipmentPrintContent(shipment);
    const printWindow = window.open('', '_blank');
    
    if (!printWindow) {
      alert('Please allow popups for this website to print shipments.');
      return;
    }

    printWindow.document.write(printContent);
    printWindow.document.close();
    
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.getTotalPages()) {
      this.currentPage = page;
    }
  }

  selectAll(event: Event): void {
    const isChecked = (event.target as HTMLInputElement).checked;
    if (isChecked) {
      this.selectedShipments = this.filteredShipments
        .slice((this.currentPage-1)*this.entriesPerPage, this.currentPage*this.entriesPerPage)
        .map(shipment => shipment.id);
    } else {
      this.selectedShipments = [];
    }
  }

  isSelected(shipmentId: string): boolean {
    return this.selectedShipments.includes(shipmentId);
  }

  ngOnDestroy(): void {
    if (this.unsubscribeShipments) {
      this.unsubscribeShipments();
    }
  }

  loadUsers(): void {
    this.userService.getUsers().subscribe(users => {
      this.users = users;
    });
  }

  onDateRangeChange(dateRange: Date[]): void {
    if (dateRange && dateRange.length === 2) {
      const startDate = dateRange[0];
      const endDate = dateRange[1];
      
      this.filterValues.startDate = startDate;
      this.filterValues.endDate = endDate;
      this.filterValues.dateRange = `${this.formatDate(startDate)} - ${this.formatDate(endDate)}`;
    }
  }

  loadTypeOfServices(): void {
    this.typeOfServiceService.getServicesRealtime().subscribe(services => {
      this.typeOfServices = services;
    });
  }

  formatDate(date: Date): string {
    return `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}/${date.getFullYear()}`;
  }

  loadShipments(): void {
    const salesCollection = collection(this.firestore, 'sales');
    const q = query(salesCollection, orderBy('saleDate', 'desc'));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      this.shipments = querySnapshot.docs.map(doc => {
        const order = doc.data() as any;
        
        const convertedDate = this.convertFirebaseDate(order.saleDate);
        
        return {
          id: doc.id,
          date: convertedDate,
          invoiceNo: order.invoiceNo || '',
          customer: order.customer,
          shippingDetails: order.shippingDetails || '',
          contactNumber: order.customerPhone || '',
          location: order.location || order.businessLocation || '',
          businessLocation: order.businessLocation || '',
          billingAddress: order.billingAddress || '',
          
          deliveryPerson: order.deliveryPerson || '',
          shippingStatus: order.shippingStatus || 'Pending',
          alternateContact: order.alternateContact || '',

          shippingCharge: this.safeNumber(order.shippingCharges),
          paymentStatus: this.getPaymentStatus(order),
          balance: this.safeNumber(order.balance),
          totalPayable: this.safeNumber(order.totalPayable) || (this.safeNumber(order.paymentAmount) + this.safeNumber(order.balance)),
          paymentAmount: this.safeNumber(order.paymentAmount),
          products: order.products || [],
          prescription: order.prescription || null,
          prescriptions: order.prescriptions || [],
          typeOfService: order.typeOfService || 'Standard',
          typeOfServiceName: order.typeOfServiceName || order.typeOfService || 'Standard',
          addedBy: order.addedBy || 'System',
          addedByDisplayName: order.addedByDisplayName || order.addedBy || 'System',
          activities: order.activities || [],
          dateRange: '',
          // Add packing charge related fields with safe conversion
          ppServiceData: order.ppServiceData || null,
          codData: order.codData || null,
          serviceCharge: this.safeNumber(order.serviceCharge),
          packingCharge: this.safeNumber(order.packingCharge),
          orderTax: this.safeNumber(order.orderTax, 18)
        };
      });
      
      this.totalEntries = this.shipments.length;
      this.calculateTotals(this.shipments);
      this.filteredShipments = [...this.shipments];
      this.applyFilters();
    });

    this.unsubscribeShipments = unsubscribe;
  }

  private getPaymentStatus(order: any): string {
    const balance = this.safeNumber(order.balance);
    const paymentAmount = this.safeNumber(order.paymentAmount);
    
    if (balance === 0 && paymentAmount > 0) return 'Paid';
    if (balance > 0 && paymentAmount > 0) return 'Partial';
    return 'Unpaid';
  }

  toggleSelection(shipmentId: string): void {
    if (this.isSelected(shipmentId)) {
      this.selectedShipments = this.selectedShipments.filter(id => id !== shipmentId);
    } else {
      this.selectedShipments.push(shipmentId);
    }
  }

  bulkPrintSelected(): void {
    if (this.selectedShipments.length === 0) {
      alert('Please select at least one shipment to print');
      return;
    }
  
    const selectedData = this.filteredShipments.filter(shipment => 
      this.selectedShipments.includes(shipment.id)
    );
  
    const printContent = this.generateBulkPrintContent(selectedData);
  
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups for this website to print shipments.');
      return;
    }
  
    printWindow.document.write(printContent);
    printWindow.document.close();
    
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
  }
  
  generateBulkPrintContent(shipments: Shipment[]): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Bulk Shipments Report</title>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 20px;
            padding: 0;
          }
          h1 {
            text-align: center;
            margin-bottom: 20px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
          }
          th {
            background-color: #f2f2f2;
          }
          .shipment-divider {
            margin: 30px 0;
            border-top: 2px dashed #000;
          }
          @media print {
            body {
              font-size: 12pt;
            }
            .no-print {
              display: none;
            }
          }
        </style>
      </head>
      <body>
        <h1>Shipments Report</h1>
        <p>Generated on: ${new Date().toLocaleString()}</p>
        <p>Total Shipments: ${shipments.length}</p>
        
        ${shipments.map((shipment, index) => `
          <div class="shipment">
            <h3>Shipment #${index + 1}</h3>
            <table>
              <tr>
                <th>Invoice No.</th>
                <td>${shipment.invoiceNo || 'N/A'}</td>
                <th>Date</th>
                <td>${this.formatDateForDisplay(shipment.date)}</td>
              </tr>
              <tr>
                <th>Customer</th>
                <td>${shipment.customer || 'N/A'}</td>
                <th>Contact</th>
                <td>${shipment.contactNumber || 'N/A'}</td>
              </tr>
              <tr>
                <th>Location</th>
                <td>${shipment.location || 'N/A'}</td>
                <th>Delivery Person</th>
                <td>${shipment.deliveryPerson || 'N/A'}</td>
              </tr>
              <tr>
                <th>Shipping Status</th>
                <td>${shipment.shippingStatus || 'N/A'}</td>
                <th>Shipping Charge</th>
                <td>${this.safeNumber(shipment.shippingCharge).toFixed(2)}</td>
              </tr>
              <tr>
                <th>Payment Status</th>
                <td>${shipment.paymentStatus || 'N/A'}</td>
                <th>Type of Service</th>
                <td>${shipment.typeOfServiceName || shipment.typeOfService || 'Standard'}</td>
              </tr>
            </table>
            ${index < shipments.length - 1 ? '<div class="shipment-divider"></div>' : ''}
          </div>
        `).join('')}
        
        <div class="no-print" style="margin-top: 20px; text-align: center;">
          <button onclick="window.print()" style="padding: 10px 20px; background: #4CAF50; color: white; border: none; cursor: pointer;">
            Print Report
          </button>
          <button onclick="window.close()" style="padding: 10px 20px; background: #f44336; color: white; border: none; cursor: pointer;">
            Close Window
          </button>
        </div>
      </body>
    </html>
    `;
  }

  openBulkStatusModal(): void {
    const modalElement = document.getElementById('bulkStatusModal');
    if (modalElement) {
      const modal = new bootstrap.Modal(modalElement);
      modal.show();
    }
  }

  async updateBulkStatus(): Promise<void> {
    if (this.selectedShipments.length === 0) return;
    
    this.isUpdating = true;
    
    try {
      const currentUser = await firstValueFrom(this.authService.getCurrentUser());
      const userId = currentUser?.uid || 'system';
      const userName = currentUser?.displayName || 'System';
      
      const updates = this.selectedShipments.map(async shipmentId => {
        const shipmentDoc = doc(this.firestore, 'sales', shipmentId);
        const shipmentSnapshot = await getDoc(shipmentDoc);
        
        if (shipmentSnapshot.exists()) {
          const currentData = shipmentSnapshot.data() as any;
          const currentStatus = currentData.shippingStatus || 'Pending';
          const newStatus = this.bulkStatusUpdate.status;
          
          const updateData: any = {
            shippingStatus: newStatus,
            updatedAt: new Date()
          };
          
          if (currentStatus !== newStatus) {
            updateData.activities = [
              ...(currentData.activities || []),
              {
                userId,
                userName,
                fromStatus: currentStatus,
                toStatus: newStatus,
                timestamp: new Date()
              }
            ];
          }
          
          await updateDoc(shipmentDoc, updateData);
        }
      });

      await Promise.all(updates);
      
      const modalElement = document.getElementById('bulkStatusModal');
      if (modalElement) {
        const modal = bootstrap.Modal.getInstance(modalElement);
        modal?.hide();
      }
      
      this.selectedShipments = [];
      
      alert(`Status updated to ${this.bulkStatusUpdate.status} for ${updates.length} shipments`);
    } catch (error) {
      console.error('Error updating shipping status:', error);
      alert('Failed to update shipping status. Please try again.');
    } finally {
      this.isUpdating = false;
    }
  }

getStatusBadgeClass(status: string | undefined): string {
  if (!status) return 'badge bg-secondary';
  
  const statusMap: {[key: string]: string} = {
    'Processing': 'badge bg-info',
    'Packed': 'badge bg-primary',
    'Pending': 'badge bg-warning',
    'Shipped': 'badge bg-info',
    'Delivered': 'badge bg-success',
    'Onhold': 'badge bg-secondary',
    'Ordered': 'badge bg-primary',
    'Print': 'badge bg-dark',
    'Reached hub': 'badge bg-info text-dark',
    'Out for delivery': 'badge bg-primary text-white',
    'Returned': 'badge bg-danger',
    'Cancelled': 'badge bg-danger text-white'
  };

  return statusMap[status] || 'badge bg-secondary';
}
  
  calculateTotals(shipments: Shipment[]): void {
    this.totalShipmentCount = shipments.length;
    this.totalShipmentAmount = shipments.reduce((sum, shipment) => sum + this.safeNumber(shipment.shippingCharge), 0);
  }

  openEditFormModal(shipment: Shipment): void {
    this.editFormData = { 
      ...shipment,
      id: shipment.id,
      invoiceNo: shipment.invoiceNo,
      date: shipment.date,
      customer: shipment.customer,
      shippingDetails: shipment.shippingDetails || '',
      billingAddress: shipment.billingAddress || '',
      shippingNotes: shipment.shippingNotes || '',
      activities: shipment.activities || [],
      contactNumber: shipment.contactNumber,
      location: shipment.location,
      deliveryPerson: shipment.deliveryPerson,
      shippingStatus: shipment.shippingStatus,
      shippingCharge: this.safeNumber(shipment.shippingCharge),
    };
    
    this.updateCombinedAddress();
    
    this.showEditFormModal = true;
  }

  updateCombinedAddress(): void {
    const addressParts = [
      this.editFormData.customer,
      this.editFormData.billingAddress,
      this.editFormData.location,
      this.editFormData.contactNumber
    ].filter(part => part && part.trim());
    
    this.combinedAddress = addressParts.join(', ');
  }
    
  addActivity(): void {
    if (!this.newActivity.note) return;
    
    const currentUser = this.authService.currentUserValue;
    
    const newActivityEntry = {
      userId: currentUser?.uid || 'system',
      userName: currentUser?.displayName || 'System',
      timestamp: new Date(),
      note: this.newActivity.note
    };
    
    this.editFormData.activities = [...(this.editFormData.activities || []), newActivityEntry];
    this.newActivity.note = '';
  }

  handleShippingDocument(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.shippingDocumentFile = file;
    }
  }

  closeEditFormModal(): void {
    this.showEditFormModal = false;
    this.editFormData = {};
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }
  
  applyFilters(): void {
    let filtered = [...this.shipments];

    if (this.filterValues.startDate && this.filterValues.endDate) {
      filtered = filtered.filter(shipment => {
        const shipmentDate = new Date(shipment.date);
        const startDate = new Date(this.filterValues.startDate!);
        const endDate = new Date(this.filterValues.endDate!);
        
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        
        return shipmentDate >= startDate && shipmentDate <= endDate;
      });
    }

    if (this.filterValues.currentLocation && this.filterValues.currentLocation !== 'All') {
      filtered = filtered.filter(shipment => 
        shipment.location === this.filterValues.currentLocation
      );
    }

    if (this.filterValues.customer) {
      const searchTerm = this.filterValues.customer.toLowerCase();
      filtered = filtered.filter(shipment => 
        shipment.customer.toLowerCase().includes(searchTerm)
      );
    }

    if (this.filterValues.typeOfService && this.filterValues.typeOfService !== 'All') {
      filtered = filtered.filter(shipment => 
        shipment.typeOfService === this.filterValues.typeOfService
      );
    }

    if (this.filterValues.addedBy && this.filterValues.addedBy !== 'All') {
      filtered = filtered.filter(shipment => 
        shipment.addedBy === this.filterValues.addedBy
      );
    }

    if (this.filterValues.paymentStatus && this.filterValues.paymentStatus !== 'All') {
      filtered = filtered.filter(shipment => 
        shipment.paymentStatus === this.filterValues.paymentStatus
      );
    }

    if (this.filterValues.shippingStatus && this.filterValues.shippingStatus !== 'All') {
      filtered = filtered.filter(shipment => 
        shipment.shippingStatus === this.filterValues.shippingStatus
      );
    }

    this.filteredShipments = filtered;
    this.totalEntries = filtered.length;
    this.currentPage = 1;
    this.calculateTotals(filtered);
  }

  hasActiveFilters(): boolean {
    return (
      this.filterValues.customer !== '' ||
      this.filterValues.typeOfService !== 'All' ||
      this.filterValues.addedBy !== 'All' ||
      this.filterValues.paymentStatus !== 'All' ||
      this.filterValues.shippingStatus !== 'All' ||
      this.filterValues.deliveryPerson !== 'All' ||
      this.filterValues.user !== 'All'
    );
  }

  resetFilters(): void {
    this.filterValues = {
      startDate: null,
      endDate: null,
      dateRange: '',
      currentLocation: 'All',
      customer: '',
      addedBy: 'All',
      businessLocation: '',
      typeOfService: 'All',
      paymentStatus: 'All',
      shippingStatus: 'All',
      deliveryPerson: 'All',
      user: 'All'
    };

    this.filteredShipments = [...this.shipments];
    this.totalEntries = this.filteredShipments.length;
    this.currentPage = 1;
    this.calculateTotals(this.filteredShipments);
  }

 exportCSV(): void {
    // Get only the columns that are currently visible in the UI.
    const visibleColumns = this.columns.filter(col => col.visible);

    // Create headers from the names of the visible columns.
    const headers = visibleColumns.map(col => col.name);

    // Helper function to properly format values for CSV.
    const escapeCSVValue = (value: any): string => {
      const stringValue = String(value ?? '');
      if (/[",\n\r]/.test(stringValue)) {
        return '"' + stringValue.replace(/"/g, '""') + '"';
      }
      return stringValue;
    };

    // Create a data row for each shipment based on visible columns.
    const rows = this.filteredShipments.map(shipment => {
      const rowData = visibleColumns.map(col => {
        // Use the column ID to fetch the correct data for each cell.
        switch (col.id) {
          case 'date':
            return this.formatDateForDisplay(shipment.date);
          case 'invoiceNo':
            return shipment.invoiceNo;
          case 'customer':
            return shipment.customer;
          case 'contactNumber':
            return shipment.contactNumber;
          case 'alternateContact': // Correctly handles Alternate Contact
            return shipment.alternateContact || 'N/A';
          case 'location':
            return shipment.location;
          case 'billingAddress':
            return shipment.billingAddress || 'N/A';
  case 'state':
          return this.parseAddress(shipment.billingAddress, 'state');
        case 'district':
          return this.parseAddress(shipment.billingAddress, 'district');
          case 'pincode':
            return this.parseAddress(shipment.billingAddress, 'pincode');
          case 'shippingDetails':
            return shipment.shippingDetails || 'N/A';
          case 'typeOfService':
            return shipment.typeOfServiceName || shipment.typeOfService || 'Standard';
          case 'quantity':
            return this.getShipmentTotalQuantity(shipment).toString();
          case 'shippingCharge':
            return this.safeNumber(shipment.shippingCharge).toFixed(2);
          case 'grandTotal':
            return this.safeNumber(shipment.totalPayable).toFixed(2);
          case 'shippingStatus':
            return shipment.shippingStatus || 'N/A';
          case 'paymentStatus':
            return shipment.paymentStatus;
          case 'addedBy': // Correctly handles Added By
            return shipment.addedByDisplayName || shipment.addedBy || 'System';
          default:
            return '';
        }
      });
      return rowData.map(escapeCSVValue).join(',');
    });

    // Combine headers and rows into a single CSV string.
    const csvContent = [headers.join(','), ...rows].join('\n');
    
    // Trigger the file download.
    this.downloadFile(csvContent, 'shipments_export.csv', 'text/csv;charset=utf-8;');
  }

  exportExcel(): void {
    this.saleService.exportSales('excel');
  }

  exportPDF(): void {
    this.saleService.exportSales('pdf');
  }

  toggleColumnVisibilityDropdown(): void {
    this.showColumnDropdown = !this.showColumnDropdown;
  }

  isColumnVisible(columnId: string): boolean {
    const column = this.columns.find(c => c.id === columnId);
    return column ? column.visible : false;
  }

  updateVisibleColumns(): void {
    this.visibleColumnsCount = this.columns.filter(c => c.visible).length + 1;
  }

  getFooterColspan(): number {
    let count = 0;
    if (this.isColumnVisible('date')) count++;
    if (this.isColumnVisible('invoiceNo')) count++;
    if (this.isColumnVisible('customer')) count++;
    if (this.isColumnVisible('location')) count++;
    if (this.isColumnVisible('deliveryPerson')) count++;
    
    return 6 + count;
  }

  print(): void {
    const originalDisplayValues = {
      sidebar: document.querySelector('.sidebar') as HTMLElement,
      navbar: document.querySelector('.navbar') as HTMLElement,
      controlsPanel: document.querySelector('.controls-panel') as HTMLElement
    };
  
    if (originalDisplayValues.sidebar) originalDisplayValues.sidebar.style.display = 'none';
    if (originalDisplayValues.navbar) originalDisplayValues.navbar.style.display = 'none';
    if (originalDisplayValues.controlsPanel) originalDisplayValues.controlsPanel.style.display = 'none';
  
    window.print();
  
    setTimeout(() => {
      if (originalDisplayValues.sidebar) originalDisplayValues.sidebar.style.display = '';
      if (originalDisplayValues.navbar) originalDisplayValues.navbar.style.display = '';
      if (originalDisplayValues.controlsPanel) originalDisplayValues.controlsPanel.style.display = '';
    }, 500);
  }

  onSearch(): void {
    if (!this.searchTerm || this.searchTerm.trim() === '') {
      this.filteredShipments = [...this.shipments];
    } else {
      const searchTerm = this.searchTerm.toLowerCase().trim();
      this.filteredShipments = this.shipments.filter(shipment => 
        (shipment.invoiceNo && shipment.invoiceNo.toLowerCase().includes(searchTerm)) ||
        (shipment.customer && shipment.customer.toLowerCase().includes(searchTerm)) ||
        (shipment.contactNumber && shipment.contactNumber.includes(searchTerm)) ||
        (shipment.alternateContact && shipment.alternateContact.includes(searchTerm)) ||
        (shipment.billingAddress && shipment.billingAddress.toLowerCase().includes(searchTerm)) ||
        (shipment.shippingDetails && shipment.shippingDetails.toLowerCase().includes(searchTerm))
      );
    }
    this.currentPage = 1;
    this.totalEntries = this.filteredShipments.length;
    this.calculateTotals(this.filteredShipments);
  }

  changeEntriesPerPage(event: any): void {
    this.entriesPerPage = parseInt(event.target.value, 10);
    this.currentPage = 1;
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  nextPage(): void {
    if (this.currentPage < this.getTotalPages()) {
      this.currentPage++;
    }
  }

  getMinValue(a: number, b: number): number {
    return Math.min(a, b);
  }

  getTotalPages(): number {
    return Math.ceil(this.totalEntries / this.entriesPerPage);
  }
  
  private downloadFile(content: string, fileName: string, fileType: string): void {
    const blob = new Blob([content], { type: fileType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  openEditModal(shipment: Shipment): void {
    this.currentShipment = shipment;
    this.editData = {
      id: shipment.id,
      paymentStatus: shipment.paymentStatus,
      partialAmount: this.safeNumber(shipment.paymentAmount) || null
    };
    this.showEditModal = true;
  }

  cancelEdit(): void {
    this.showEditModal = false;
    this.currentShipment = null;
    this.editData = {
      id: '',
      paymentStatus: '',
      partialAmount: null
    };
  }

async saveEditedShipment(): Promise<void> {
  if (!this.editFormData.id) return;

  this.isSavingForm = true;

  try {
    const currentUser = await firstValueFrom(this.authService.getCurrentUser());
    const currentShipment = this.shipments.find(s => s.id === this.editFormData.id);

    if (!currentShipment) {
      throw new Error('Shipment not found');
    }

    const currentStatus = currentShipment.shippingStatus;
    const newStatus = this.editFormData.shippingStatus;

    // Initialize updateData with proper typing
    const updateData: ShipmentUpdateData = {
      shippingStatus: newStatus,
      updatedAt: new Date()
      // Add other fields you want to update here
    };

    // Add activities only if status changed
    if (currentStatus !== newStatus) {
      updateData.activities = [
        ...(currentShipment.activities || []),
        {
          userId: currentUser?.uid || 'system',
          userName: currentUser?.displayName || 'System',
          fromStatus: currentStatus,
          toStatus: newStatus,
          timestamp: new Date(),
          note: this.newActivity.note || 'Status changed'
        }
      ];
    }

    // Save the changes
    await this.saleService['updateSale'](this.editFormData.id, updateData);

    // Update local data
    const updatedShipment: Shipment = {
      ...currentShipment,
      ...updateData
    };

    this.shipments = this.shipments.map(shipment =>
      shipment.id === updatedShipment.id ? updatedShipment : shipment
    );

    this.filteredShipments = this.filteredShipments.map(shipment =>
      shipment.id === updatedShipment.id ? updatedShipment : shipment
    );

    this.newActivity.note = '';
    this.showEditFormModal = false;
    
  } catch (error) {
    console.error('Error updating shipment:', error);
    alert('Failed to update shipment. Please try again.');
  } finally {
    this.isSavingForm = false;
  }
}
  async savePaymentStatus(): Promise<void> {
    if (!this.editData.id || !this.currentShipment) return;

    this.isSaving = true;
    
    try {
      let newBalance = this.safeNumber(this.currentShipment.balance);
      const totalAmount = this.safeNumber(this.currentShipment.totalPayable);
      
      if (this.editData.paymentStatus === 'Paid') {
        newBalance = 0;
      } else if (this.editData.paymentStatus === 'Partial') {
        const partialAmount = this.safeNumber(this.editData.partialAmount, totalAmount * 0.5);
        newBalance = totalAmount - partialAmount;
      } else if (this.editData.paymentStatus === 'Unpaid') {
        newBalance = totalAmount;
      }
      newBalance = Math.max(0, newBalance);

      await this.saleService['updateSale'](this.editData.id, {
        paymentStatus: this.editData.paymentStatus,
        balance: newBalance,
        paymentAmount: totalAmount - newBalance,
        updatedAt: new Date()
      });

      const updatedShipment = {
        ...this.currentShipment,
        paymentStatus: this.editData.paymentStatus,
        balance: newBalance,
        paymentAmount: totalAmount - newBalance
      };

      this.shipments = this.shipments.map(ship => 
        ship.id === updatedShipment.id ? updatedShipment : ship
      );

      this.filteredShipments = this.filteredShipments.map(ship => 
        ship.id === updatedShipment.id ? updatedShipment : ship
      );

      this.showEditModal = false;
    } catch (error) {
      console.error('Error updating payment status:', error);
      alert('Failed to update payment status. Please try again.');
    } finally {
      this.isSaving = false;
    }
  }

  generatePackingSlip(shipmentId: string): void {
    this.router.navigate(['/shipments/packing-slip', shipmentId]);
  }

  generateDeliveryNote(shipmentId: string): void {
    this.saleService.generateDocument(shipmentId, 'delivery-note').subscribe(
      (response) => {
        this.downloadPdf(response, `delivery-note-${shipmentId}.pdf`);
      },
      (error) => {
        console.error('Error generating delivery note:', error);
        alert('Failed to generate delivery note. Please try again.');
      }
    );
  }

  printInvoice(shipmentId: string): void {
    this.saleService.generateDocument(shipmentId, 'invoice').subscribe({
      next: (response) => {
        const blob = new Blob([response], { type: 'application/pdf' });
        const pdfUrl = URL.createObjectURL(blob);
        
        const previewWindow = window.open(pdfUrl, '_blank');
        
        if (!previewWindow) {
          const downloadLink = document.createElement('a');
          downloadLink.href = pdfUrl;
          downloadLink.download = `Herbally_Invoice_${shipmentId}.pdf`;
          downloadLink.style.display = 'none';
          document.body.appendChild(downloadLink);
          downloadLink.click();
        
          setTimeout(() => {
            document.body.removeChild(downloadLink);
            URL.revokeObjectURL(pdfUrl);
          }, 100);
        }
      },
      error: (error) => {
        console.error('Invoice generation failed:', error);
      }
    });
  }

  openPrescriptionModal(shipment: Shipment): void {
    this.currentShipment = shipment;
    
    if (shipment.prescription) {
      this.currentPrescription = {
        patientName: shipment.prescription.patientName || shipment.customer || '',
        date: shipment.prescription.date || new Date().toISOString().split('T')[0],
        medicines: shipment.prescription.medicines || this.getDefaultMedicines()
      };
    } else {
      this.currentPrescription = {
        patientName: shipment.customer || '',
        date: new Date().toISOString().split('T')[0],
        medicines: this.getDefaultMedicines()
      };
    }
    
    this.showPrescriptionModal = true;
  }

  getDefaultMedicines(): PrescriptionMedicine[] {
    const medicines: PrescriptionMedicine[] = [];
    
    for (let i = 0; i < 5; i++) {
      medicines.push({
        name: '',
        dosage: '15 ml. എടുക്കുക 45 ml. തിളപ്പിച്ച വെള്ളം ചേർത്ത് കുടിക്കുക',
        instructions: 'രാത്രി ഭക്ഷണത്തിന് ശേഷം / മുമ്പ് സൊവികുക',
        ingredients: '',
        pills: '',
        powder: '',
        time: ''
      });
    }
    
    for (let i = 0; i < 2; i++) {
      medicines.push({
        name: 'ഗുളിക',
        dosage: 'എണ്ണം എടുക്കുക ml. തിളപ്പിച്ച വെള്ളം ചേർത്ത് നേരം ഭക്ഷണത്തിന് മുമ്പ് / ശേഷം സൊവികുക',
        instructions: '',
        ingredients: '',
        pills: '',
        powder: '',
        time: ''
      });
    }
    
    return medicines;
  }

  closePrescriptionModal(): void {
    this.showPrescriptionModal = false;
  }

  async savePrescription(): Promise<void> {
    if (!this.currentShipment || !this.currentShipment.id) return;
    
    try {
      await this.saleService['updateSale'](this.currentShipment.id, {
        updatedAt: new Date()
      });
      
      const updatedShipment = {
        ...this.currentShipment,
        prescription: this.currentPrescription
      };
      
      this.shipments = this.shipments.map(ship => 
        ship.id === updatedShipment.id ? updatedShipment : ship
      );
      
      this.filteredShipments = this.filteredShipments.map(ship => 
        ship.id === updatedShipment.id ? updatedShipment : ship
      );
      
      alert('Prescription saved successfully!');
      this.closePrescriptionModal();
    } catch (error) {
      console.error('Error saving prescription:', error);
      alert('Failed to save prescription. Please try again.');
    }
  }

  generateSingleShipmentPrintContent(shipment: Shipment): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Shipment Details - ${shipment.invoiceNo}</title>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 20px;
            padding: 0;
          }
          h1 {
            text-align: center;
            margin-bottom: 20px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
          }
          th {
            background-color: #f2f2f2;
          }
          .status-badge {
            padding: 3px 6px;
            border-radius: 3px;
            font-size: 12px;
            font-weight: bold;
          }
          .badge-success {
            background-color: #28a745;
            color: white;
          }
          .badge-warning {
            background-color: #ffc107;
            color: black;
          }
          .badge-danger {
            background-color: #dc3545;
            color: white;
          }
          .badge-info {
            background-color: #17a2b8;
            color: white;
          }
          .badge-secondary {
            background-color: #6c757d;
            color: white;
          }
          @media print {
            body {
              font-size: 12pt;
            }
            .no-print {
              display: none;
            }
          }
        </style>
      </head>
      <body>
        <h1>Shipment Details</h1>
        <p>Printed on: ${new Date().toLocaleString()}</p>
        
        <table>
          <tr>
            <th>Invoice No.</th>
            <td>${shipment.invoiceNo || 'N/A'}</td>
            <th>Date</th>
            <td>${this.formatDateForDisplay(shipment.date)}</td>
          </tr>
          <tr>
            <th>Customer</th>
            <td>${shipment.customer || 'N/A'}</td>
            <th>Contact</th>
            <td>${shipment.contactNumber || 'N/A'}</td>
          </tr>
          <tr>
            <th>Location</th>
            <td>${shipment.location || 'N/A'}</td>
            <th>Delivery Person</th>
            <td>${shipment.deliveryPerson || 'N/A'}</td>
          </tr>
          <tr>
            <th>Shipping Status</th>
            <td><span class="status-badge ${this.getStatusBadgeClass(shipment.shippingStatus).replace('badge ', '')}">
              ${shipment.shippingStatus || 'N/A'}
            </span></td>
            <th>Shipping Charge</th>
            <td>${this.safeNumber(shipment.shippingCharge).toFixed(2)}</td>
          </tr>
          <tr>
            <th>Payment Status</th>
            <td><span class="status-badge ${
              shipment.paymentStatus === 'Paid' ? 'badge-success' : 
              shipment.paymentStatus === 'Partial' ? 'badge-warning' : 'badge-danger'
            }">
              ${shipment.paymentStatus || 'N/A'}
            </span></td>
            <th>Type of Service</th>
            <td>${shipment.typeOfServiceName || shipment.typeOfService || 'Standard'}</td>
          </tr>
        </table>
        
        <div class="no-print" style="margin-top: 20px; text-align: center;">
          <button onclick="window.print()" style="padding: 10px 20px; background: #4CAF50; color: white; border: none; cursor: pointer;">
            Print Again
          </button>
          <button onclick="window.close()" style="padding: 10px 20px; background: #f44336; color: white; border: none; cursor: pointer;">
            Close Window
          </button>
        </div>
      </body>
    </html>
    `;
  }

  async deleteShipment(shipmentId: string): Promise<void> {
    if (!confirm('Are you sure you want to delete this shipment? This action cannot be undone.')) {
      return;
    }

    try {
      await this.saleService.deleteSale(shipmentId);
      
      this.shipments = this.shipments.filter(ship => ship.id !== shipmentId);
      this.filteredShipments = this.filteredShipments.filter(ship => ship.id !== shipmentId);
      
      alert('Shipment deleted successfully!');
    } catch (error) {
      console.error('Error deleting shipment:', error);
      alert('Failed to delete shipment. Please try again.');
    }
  }
    
  printPrescription(): void {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups for this website to print prescriptions.');
      return;
    }
    
    const htmlContent = this.generatePrescriptionHTML();
    
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
  }

  generatePrescriptionHTML(): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>ഹെർബലി ടച്ച് - പ്രിസ്ക്രിപ്ഷൻ</title>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 20px;
            padding: 0;
            line-height: 1.6;
          }
          
          .header {
            text-align: center;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid #ddd;
          }
          
          .header h2 {
            margin-bottom: 5px;
          }
          
          .header p {
            margin: 2px 0;
          }
          
          .patient-info {
            display: flex;
            justify-content: space-between;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px dashed #ddd;
          }
          
          .medicine-item {
            margin-bottom: 15px;
          }
          
          .medicine-details {
            display: flex;
            justify-content: space-between;
            flex-wrap: wrap;
            margin-bottom: 5px;
          }
          
          .medicine-detail {
            margin-right: 15px;
          }
          
          .signature {
            margin-top: 30px;
            text-align: right;
            padding-top: 50px;
          }
          
          .signature p {
            border-top: 1px solid #000;
            display: inline-block;
            padding-top: 5px;
            width: 200px;
            text-align: center;
          }
          
          @media print {
            body {
              font-size: 12pt;
            }
            
            button {
              display: none;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
                <div class="logo-container">
            <img src="/assets/logo2.png">
          </div>
          <h2>HERBALLY TOUCH AYURVEDA PRODUCTS PVT.LTD.
</h2>
          <p>First Floor, Chirackal Tower, Ayroor P.O., Ernakulam Dt., Kerala - 683 579</p>
          <p>E-mail: contact@herballytouch.com | Ph: 7034110999</p>
          <p>ഡോ. രാജന പി.ആർ., BAMS</p>
        </div>
        
        <div class="patient-info">
          <p><strong>പേര്:</strong> ${this.currentPrescription.patientName}</p>
          <p><strong>തീയതി:</strong> ${this.currentPrescription.date}</p>
        </div>
        
        ${this.currentPrescription.medicines.map((med, index) => `
          <div class="medicine-item">
            <p>${index + 1}. ${med.name || 'ഔഷധം'} ${med.dosage}</p>
            <p>${med.instructions}</p>
            <div class="medicine-details">
              <span class="medicine-detail"><strong>ചേരുവ:</strong> ${med.ingredients || '.......................'}</span>
              <span class="medicine-detail"><strong>ഗുളിക:</strong> ${med.pills || '.......................'}</span>
              <span class="medicine-detail"><strong>പൊടി ചേരുവ:</strong> ${med.powder || '.......................'}</span>
              <span class="medicine-detail"><strong>നേരം:</strong> ${med.time || '.......................'}</span>
            </div>
          </div>
        `).join('')}
        
        <div class="signature">
          <p>ഡോക്ടറുടെ ഒപ്പ്</p>
        </div>
        
        <div style="margin-top: 20px; font-style: italic; text-align: center;">
          <p>NB: മുകളിലുള്ള മരുന്നുകള്‍ ഡോക്ടര്‍ പറയുന്ന വിധം ഉപയോഗിക്കുക.</p>
        </div>
      </body>
    </html>
    `;
  }

  private downloadPdf(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  selectDatePreset(preset: string): void {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    switch(preset) {
      case 'today':
        this.filterValues.startDate = new Date(today);
        this.filterValues.endDate = new Date(today);
        break;
        
      case 'yesterday':
        this.filterValues.startDate = new Date(yesterday);
        this.filterValues.endDate = new Date(yesterday);
        break;
        
      case 'last7days':
        const last7days = new Date(today);
        last7days.setDate(last7days.getDate() - 6);
        this.filterValues.startDate = last7days;
        this.filterValues.endDate = new Date(today);
        break;
        
      case 'last30days':
        const last30days = new Date(today);
        last30days.setDate(last30days.getDate() - 29);
        this.filterValues.startDate = last30days;
        this.filterValues.endDate = new Date(today);
        break;
        
      case 'thisMonth':
        const firstDayThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDayThisMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        this.filterValues.startDate = firstDayThisMonth;
        this.filterValues.endDate = lastDayThisMonth;
        break;
        
      case 'lastMonth':
        const firstDayLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastDayLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
        this.filterValues.startDate = firstDayLastMonth;
        this.filterValues.endDate = lastDayLastMonth;
        break;
        
      case 'thisFinancialYear':
        const currentMonth = today.getMonth();
        const financialYearStart = currentMonth >= 3 ? 
          new Date(today.getFullYear(), 3, 1) :
          new Date(today.getFullYear() - 1, 3, 1);
        this.filterValues.startDate = financialYearStart;
        this.filterValues.endDate = new Date(today);
        break;
        
      case 'lastFinancialYear':
        const currentMonth2 = today.getMonth();
        const lastFinancialYearStart = currentMonth2 >= 3 ? 
          new Date(today.getFullYear() - 1, 3, 1) :
          new Date(today.getFullYear() - 2, 3, 1);
        const lastFinancialYearEnd = currentMonth2 >= 3 ? 
          new Date(today.getFullYear(), 2, 31) :
          new Date(today.getFullYear() - 1, 2, 31);
        this.filterValues.startDate = lastFinancialYearStart;
        this.filterValues.endDate = lastFinancialYearEnd;
        break;
    }
    
    this.applyFilters();
  }

  // Tax calculation methods (same as sales component)
  getTotalTaxableValue(): number {
    return this.invoiceData.products.reduce(
      (sum, product) => sum + product.taxableValue, 0
    );
  }

  getTotalCGST(): number {
    return this.invoiceData.products.reduce(
      (sum, product) => sum + (product.cgstAmount || 0), 0
    );
  }

  getTotalSGST(): number {
    return this.invoiceData.products.reduce(
      (sum, product) => sum + (product.sgstAmount || 0), 0
    );
  }

  getTotalIGST(): number {
    return this.invoiceData.products.reduce(
      (sum, product) => sum + (product.igstAmount || 0), 0
    );
  }

  getGrandTotal(): number {
    const productSubtotal = this.invoiceData.products.reduce(
      (sum, product) => sum + product.subtotal, 0
    );
    
    return productSubtotal + 
           this.invoiceData.shippingCharge + 
           this.invoiceData.shippingTax;
  }


}