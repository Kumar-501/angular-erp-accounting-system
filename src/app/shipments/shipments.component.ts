import { Component, OnInit } from '@angular/core';
import { SaleService } from '../services/sale.service';
import { collection, doc, Firestore, getDoc, onSnapshot, orderBy, query, updateDoc } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Router } from '@angular/router';
import * as bootstrap from 'bootstrap';
import { NgxDaterangepickerMd } from 'ngx-daterangepicker-material';
import moment from 'moment';
import { LocationService } from '../services/location.service'; // Add this import
import { Inject } from '@angular/core'; 
import { TypeOfServiceService } from '../services/type-of-service.service';
import { UserService } from '../services/user.service'; // Add this import
import { AuthService } from '../auth.service';
import { firstValueFrom } from 'rxjs';
import { Product } from '../models/product.model';

interface InvoiceData {
  shippingTax: any;
  totalTaxableValue: string|number;
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
    discountPercent: string|number;
    discount: any;
    taxableValue: any;
    taxType: string;
    cgstAmount: any;
    cgstRate: any;
    sgstAmount: any;
    
    sgstRate: any;
    igstAmount: any;
    igstRate: any;
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
  prescriptions?: PrescriptionData[]; // Add this line
  id: string;
  date: string | Date;  // Can be either string or Date object
  invoiceNo: string;
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
  quantity?: string;
  powder?: string;
  pills?: string;
  time: string;
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
  // other properties
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
  fromStatus?: string;
  toStatus?: string;
  timestamp: Date;
  note?: string;
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
private invoiceModal: any; // Add this property
private prescriptionModal: any; // Add this property
shipments: Shipment[] = [];
  selectedShipments: string[] = []; // Array to store selected shipment IDs
isUpdating = false;
// Add these to your component class
combinedAddress: string = '';
currentPrescriptionData: PrescriptionData | null = null; // Add this property
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
  shippingTax: undefined,
  totalTaxableValue: ''
};
  locations: any[] = [];
  newActivity = {
    note: '',
    
};
shippingDocumentFile: File | null = null;


totalEntries: number = 0;
selectedIds: number[] = [];
bulkStatusUpdate = {
  status: 'Pending' // Default status
};

// Add this method to get medicine type names (same as in add-sale component)
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

// Add method to view prescription
viewPrescription(shipment: Shipment): void {
  console.log('Viewing prescription for shipment:', shipment);
  
  // Check if shipment has prescriptions
  if (!shipment.prescriptions || shipment.prescriptions.length === 0) {
    alert('No prescription available for this shipment.');
    return;
  }
  
  // Get the first prescription (you can modify this to handle multiple prescriptions)
  this.currentPrescriptionData = shipment.prescriptions[0];
  
  // Initialize prescription modal if not already done
  if (!this.prescriptionModal) {
    const modalElement = document.getElementById('prescriptionModal');
    if (modalElement) {
      this.prescriptionModal = new bootstrap.Modal(modalElement);
    }
  }
  
  // Show the modal
  if (this.prescriptionModal) {
    this.prescriptionModal.show();
  }
}

// Add method to print prescription as PDF
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

// Add method to download prescription as PDF
downloadPrescriptionPDF(): void {
  if (!this.currentPrescriptionData) return;
  
  // For now, we'll use the print method. For actual PDF download,
  // you would need a PDF library like jsPDF or pdfmake
  this.printPrescriptionPDF();
}

// Generate prescription PDF content
private generatePrescriptionPDFContent(prescription: PrescriptionData): string {
  const formattedDate = prescription.date ? 
    new Date(prescription.date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }) : 
    new Date().toLocaleDateString();
  
  // Generate medicines HTML
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
          margin-bottom: 30px; 
          border-bottom: 2px solid #0056b3;
          padding-bottom: 20px;
        }
        .header h2 {
          color: #0056b3;
          margin-bottom: 5px;
          font-size: 24px;
        }
        .header h3 {
          color: #28a745;
          margin-top: 15px;
          font-size: 20px;
        }
        .patient-info { 
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 20px;
          margin-bottom: 30px;
          padding: 15px;
          background: #f8f9fa;
          border-radius: 8px;
        }
        .patient-info div {
          text-align: center;
        }
        .patient-info strong {
          display: block;
          margin-bottom: 5px;
          color: #0056b3;
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
        <h2>ഹെർബലി ടച്ച് ആയുര്‍വേദ ഉല്‍പ്പന്നങ്ങള്‍ പ്രൈവറ്റ് ലിമിറ്റഡ്</h2>
        <p><strong>First Floor, Chirackal Tower, Ayroor P.O., Ernakulam Dt., Kerala - 683 579</strong></p>
        <p><strong>E-mail: contact@herballytouch.com | Ph: 7034110999</strong></p>
        <h3><strong>ഡോ. രാജന പി.ആർ., BAMS</strong></h3>
      </div>
      
      <div class="patient-info">
        <div>
          <strong>പേര് (Name)</strong>
          <span>${prescription.patientName || 'Not specified'}</span>
        </div>
        <div>
          <strong>Age</strong>
          <span>${prescription.patientAge || 'Not specified'}</span>
        </div>
        <div>
          <strong>തീയതി (Date)</strong>
          <span>${formattedDate}</span>
        </div>
      </div>
      
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

// Generate medicine details HTML based on type
private generateMedicineDetailsHTML(medicine: Medicine): string {
  let details = '';
  
  switch(medicine.type) {
    case 'kasayam':
      details = `
        <div class="medicine-content malayalam-text">
          <p><strong>${medicine.name}</strong> കഷായം ${medicine.instructions || ''}ml എടുത്ത് 
          ${medicine.quantity || ''}ml തിളപ്പിച്ചാറ്റിയവെള്ളം ചേർത്ത് 
          ${medicine.powder || ''} ഗുളിക പൊടിച്ച്ചേർത്ത് 
          ${medicine.pills || ''} നേരം ${medicine.time || ''} സേവിക്കുക.</p>
        </div>
      `;
      break;
      
    case 'buligha':
      details = `
        <div class="medicine-content malayalam-text">
          <p><strong>${medicine.name}</strong> ഗുളിക ${medicine.instructions || ''} എണ്ണം എടുത്ത് 
          ${medicine.powder || ''} നേരം ${medicine.time || ''} സേവിക്കുക.</p>
        </div>
      `;
      break;
      
    case 'bhasmam':
      details = `
        <div class="medicine-content malayalam-text">
          <p><strong>${medicine.name}</strong> ഭസ്മം ${medicine.dosage || ''} എടുത്ത് ${medicine.quantity || ''}ml 
          ${medicine.instructions || ''} ചേർത്ത് ${medicine.powder || ''} നേരം ${medicine.time || ''} സേവിക്കുക.</p>
        </div>
      `;
      break;
      
    case 'krudham':
      details = `
        <div class="medicine-content malayalam-text">
          <p><strong>${medicine.name}</strong> ഘൃതം ഒരു ടീ - സ്പൂൺ എടുത്ത് ${medicine.instructions || ''} നേരം ${medicine.time || ''} സേവിക്കുക.</p>
        </div>
      `;
      break;
      
    case 'suranam':
      details = `
        <div class="medicine-content malayalam-text">
          <p><strong>${medicine.name}</strong> ചൂർണ്ണം ${medicine.instructions || ''} എടുത്ത് ${medicine.powder || ''} ചേർത്ത് തിളപ്പിച്ച് 
          ${medicine.dosage || ''} നേരം ${medicine.time || ''} സേവിക്കുക.</p>
        </div>
      `;
      break;
      
    case 'rasayanam':
      details = `
        <div class="medicine-content malayalam-text">
          <p><strong>${medicine.name}</strong> രസായനം ഒരു ടീ - സ്പൂൺ എടുത്ത് ${medicine.instructions || ''} നേരം ${medicine.time || ''} സേവിക്കുക.</p>
        </div>
      `;
      break;
      
    case 'lagium':
      details = `
        <div class="medicine-content malayalam-text">
          <p><strong>${medicine.name}</strong> ലേഹ്യം ${medicine.instructions || ''} എടുത്ത് ${medicine.dosage || ''} നേരം ${medicine.time || ''} സേവിക്കുക.</p>
        </div>
      `;
      break;
      
    default:
      details = `
        <div class="medicine-content">
          <p><strong>Medicine:</strong> ${medicine.name || 'Not specified'}</p>
          ${medicine.dosage ? `<p><strong>Dosage:</strong> ${medicine.dosage}</p>` : ''}
          ${medicine.instructions ? `<p><strong>Instructions:</strong> ${medicine.instructions}</p>` : ''}
          <p><strong>Time:</strong> ${medicine.time || 'Not specified'}</p>
        </div>
      `;
  }
  
  return details;
}

// Helper method to convert Firebase Timestamp to Date
private convertFirebaseDate(firebaseDate: any): Date {
  if (!firebaseDate) {
    return new Date();
  }
  
  // If it's already a Date object, return it
  if (firebaseDate instanceof Date) {
    return firebaseDate;
  }
  
  // If it's a Firebase Timestamp object
  if (firebaseDate && typeof firebaseDate.toDate === 'function') {
    return firebaseDate.toDate();
  }
  
  // If it's a string, try to parse it
  if (typeof firebaseDate === 'string') {
    const date = new Date(firebaseDate);
    return isNaN(date.getTime()) ? new Date() : date;
  }
  
  // If it's a number (timestamp), convert it
  if (typeof firebaseDate === 'number') {
    return new Date(firebaseDate);
  }
  
  // If it's an object with seconds property (Firestore Timestamp)
  if (firebaseDate && firebaseDate.seconds) {
    return new Date(firebaseDate.seconds * 1000);
  }
  
  // Default fallback
  return new Date();
}

// Helper method to format date for display
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

// Add these methods to your component class
getPagesArray(): number[] {
  const totalPages = this.getTotalPages();
  const pages: number[] = [];
  
  // Show up to 5 page buttons around current page
  const startPage = Math.max(1, this.currentPage - 2);
  const endPage = Math.min(totalPages, this.currentPage + 2);
  
  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }
  
  return pages;
}
// Add this method to handle delete confirmation
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
// If you don't already have a delete method, add this too

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

  filteredShipments: Shipment[] = [];
  entriesPerPage = 25;
  currentPage = 1;
  searchTerm = '';
  showEditFormModal = false;
  isSavingForm = false;
  editFormData: any = {};
  showColumnDropdown = false;
  visibleColumnsCount = 10;
      note?: string; // Add note to activities

  totalShipmentCount = 0;
  totalShipmentAmount = 0;
  typeOfServices: any[] = [];
  users: any[] = [];
  // Prescription modal properties
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

  columns = [
    { id: 'date', name: 'Date', visible: true },
    { id: 'invoiceNo', name: 'Invoice No.', visible: true },
    { id: 'customer', name: 'Customer', visible: true },
      { id: 'alternateContact', name: 'Alternate Contact', visible: true },

    { id: 'deliveryPerson', name: 'Delivery Person', visible: true },
    { id: 'shippingStatus', name: 'Shipping Status', visible: true },
    { id: 'shippingCharge', name: 'Shipping Charge', visible: true },
    { id: 'contactNumber', name: 'Contact', visible: true }, // Add this
    { id: 'location', name: 'Location', visible: true }, // Add this line
    { id: 'billingAddress', name: 'Billing Address', visible: true },
    { id: 'addedBy', name: 'Added By', visible: true },
  { id: 'shippingDetails', name: 'Shipping Details', visible: true },



    { id: 'paymentStatus', name: 'Payment Status', visible: true },
    { id: 'typeOfService', name: 'Type of Service', visible: true }, // Add this line

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

// Update your filterValues in the component
// Update your filterValues interface
filterValues = {
  startDate: null as Date | null,
  endDate: null as Date | null,
  dateRange: '', // Add this line
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

// Add these methods to your component
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
      // Assuming financial year starts April 1
      const currentMonth = today.getMonth();
      const financialYearStart = currentMonth >= 3 ? 
        new Date(today.getFullYear(), 3, 1) : // April 1 of current year
        new Date(today.getFullYear() - 1, 3, 1); // April 1 of previous year
      this.filterValues.startDate = financialYearStart;
      this.filterValues.endDate = new Date(today);
      break;
      
    case 'lastFinancialYear':
      const currentMonth2 = today.getMonth();
      const lastFinancialYearStart = currentMonth2 >= 3 ? 
        new Date(today.getFullYear() - 1, 3, 1) : // April 1 of last year
        new Date(today.getFullYear() - 2, 3, 1); // April 1 of year before last
      const lastFinancialYearEnd = currentMonth2 >= 3 ? 
        new Date(today.getFullYear(), 2, 31) : // March 31 of current year
        new Date(today.getFullYear() - 1, 2, 31); // March 31 of last year
      this.filterValues.startDate = lastFinancialYearStart;
      this.filterValues.endDate = lastFinancialYearEnd;
      break;
  }
  
  // Apply the filters immediately after selecting a preset
  this.applyFilters();
}

  constructor(
    private saleService: SaleService,
    private firestore: Firestore,
    private router: Router,
    private typeOfServiceService: TypeOfServiceService, // Add this service
    private userService: UserService,
      private authService: AuthService // Add this line




  ) {}

  ngOnInit(): void {
    
    this.loadShipments();
    this.loadUsers();
    this.loadTypeOfServices();
      this.invoiceModal = new bootstrap.Modal(document.getElementById('invoiceModal')!);
  this['saleSubscription'] = this.saleService.salesUpdated$.subscribe(() => 
    this.loadShipments());

  
  }
generateBulkDocuments(type: 'packing-slip' | 'invoice'): void {
  if (this.selectedShipments.length === 0) {
    alert('Please select at least one shipment');
    return;
  }

  // Get selected shipments data
  const selectedData = this.filteredShipments.filter(shipment => 
    this.selectedShipments.includes(shipment.id)
  );

  if (type === 'packing-slip') {
    // Generate packing slips using the same format as individual packing slip
    const printContent = this.generateBulkPackingSlips(selectedData);
    this.openPrintWindow(printContent);
  } else {
    // Generate invoices
    const printContent = this.generateBulkInvoices(selectedData);
    this.openPrintWindow(printContent);
  }
}

private generateBulkPackingSlips(shipments: Shipment[]): string {
  // Use the same HTML structure as your individual packing slip
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Bulk Packing Slips</title>
      <style>
        /* Copy all styles from your packing-slip.component.html */
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
        .grand-total { font-weight: bold; font-size: 1.2em; }
        @media print {
          body { font-size: 12pt; }
          .no-print { display: none; }
          .packing-slip { page-break-after: always; }
        }
      </style>
    </head>
    <body>
      ${shipments.map(shipment => {
        // Calculate totals for each shipment
        const products = shipment.products || [];
        const subtotal = products.reduce((sum, product) => 
          sum + (product.quantity || 1) * (product.price || product.unitPrice || 0), 0);
        
        const shipping = shipment.shippingCharge || 0;
        const total = subtotal + shipping;

        return `
        <div class="packing-slip-container">
          <!-- Header Section -->
          <div class="packing-slip-header">
            <div class="header-top">
              <div class="company-details">
                <div class="company-name">HERBALY TOUCH AYURVEDA PRODUCTS PRIVATE LIMITED</div>
                <div class="customer-info">Customer/Billing Mobile: ${shipment.contactNumber || 'N/A'}</div>
                <div class="contract-info">Contract Id: ${shipment.id || 'N/A'}</div>
              </div>
              <div class="service-type-section">
                <div class="service-type">${shipment.typeOfService || 'STANDARD'}</div>
                <div class="qr-code-placeholder">
                  <div class="qr-placeholder">[QR]</div>
                </div>
                <div class="invoice-date">Inv. No: ${shipment.invoiceNo || 'N/A'}</div>
              </div>
            </div>
          </div>

          <hr class="header-divider">

          <!-- From/To Section -->
          <div class="address-section">
            <div class="address-row">
              <div class="from-section">
                <div class="address-label">From,</div>
                <div class="address-details">
                  <div class="company-name">HERBALY TOUCH AYURVEDA PRODUCTS PRIVATE LIMITED</div>
                  <div>1st Floor, Chincelad Tower, Arycor P.O., Emoluburn, Kerala, 683579, India</div>
                  <div>Mobile: 009703410999</div>
                  <div>GST: 32AACCH318H1ZX</div>
                </div>
              </div>
              
              <div class="to-section">
                <div class="address-label">To,</div>
                <div class="address-details">
                  <div class="customer-name">${shipment.customer || 'N/A'}</div>
                  <div>${shipment.billingAddress || shipment.shippingDetails || 'N/A'}</div>
                  ${shipment.contactNumber ? `<div>Mobile: ${shipment.contactNumber}</div>` : ''}
                  <div class="invoice-details">
                    <div>Invoice No: ${shipment.invoiceNo || 'N/A'}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <hr class="section-divider">

          <!-- Products Section -->
          <div class="packing-slip-items">
            <table class="items-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Product</th>
                  <th>Quantity</th>
                  <th>Price</th>
                  <th>Taxable Value</th>
                  <th>CGST (9%)</th>
                  <th>SGST (9%)</th>
                  <th>Sub Total</th>
                </tr>
              </thead>
              <tbody>
                ${products.map((product, i) => {
                  const productName = product.productName || product.name || 'Product';
                  const quantity = product.quantity || 1;
                  const unitPrice = product.price || product.unitPrice || 0;
                  const taxableValue = quantity * unitPrice;
                  const cgst = taxableValue * 0.09;
                  const sgst = taxableValue * 0.09;
                  const subtotal = taxableValue + cgst + sgst;
                  
                  return `
                  <tr>
                    <td>${i + 1}</td>
                    <td>${productName}<br><span class="product-code">(${product.code || 'MRP ' + unitPrice})</span></td>
                    <td>${quantity} Nos.</td>
                    <td>${unitPrice.toFixed(2)}</td>
                    <td>${taxableValue.toFixed(2)}</td>
                    <td>${cgst.toFixed(2)}</td>
                    <td>${sgst.toFixed(2)}</td>
                    <td class="text-end">${subtotal.toFixed(2)}</td>
                  </tr>
                  `;
                }).join('')}
                ${products.length === 0 ? `
                <tr>
                  <td colspan="8" class="text-center">No products found</td>
                </tr>
                ` : ''}
              </tbody>
            </table>
          </div>

          <hr class="footer-divider">

          <!-- Totals Section -->
          <div class="totals-section">
            <div class="totals-row">
              <span>Total Taxable Value:</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div class="totals-row">
              <span>Total CGST (9%):</span>
              <span>${(subtotal * 0.09).toFixed(2)}</span>
            </div>
            <div class="totals-row">
              <span>Total SGST (9%):</span>
              <span>${(subtotal * 0.09).toFixed(2)}</span>
            </div>
            <div class="totals-row">
              <span>Shipping Charges:</span>
              <span>${shipping.toFixed(2)}</span>
            </div>
            <div class="totals-row">
              <span>Shipping GST (18%):</span>
              <span>${(shipping * 0.18).toFixed(2)}</span>
            </div>
            <div class="totals-row grand-total">
              <span>GRAND TOTAL:</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>

          <!-- Footer Section -->
          <div class="packing-slip-footer">
            <div class="footer-info">
              <div class="website-info">https://one.stellarhr.in/sales</div>
              <div class="page-info">1/2</div>
            </div>
          </div>
        </div>
        `;
      }).join('<div style="page-break-after: always;"></div>')}
      
      <div class="no-print" style="margin-top: 20px; text-align: center;">
        <button onclick="window.print()" style="padding: 10px 20px; background: #4CAF50; color: white; border: none; cursor: pointer;">
          Print All
        </button>
        <button onclick="window.close()" style="padding: 10px 20px; background: #f44336; color: white; border: none; cursor: pointer;">
          Close
        </button>
      </div>
    </body>
    </html>
  `;
}

// Update the generateBulkInvoices method
private generateBulkInvoices(shipments: Shipment[]): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Bulk Invoices</title>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { text-align: center; margin-bottom: 20px; }
        .invoice { margin-bottom: 40px; page-break-after: always; }
        .header { text-align: center; margin-bottom: 20px; }
        .details { display: flex; justify-content: space-between; margin-bottom: 20px; }
        .products-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .products-table th, .products-table td { border: 1px solid #ddd; padding: 8px; }
        .tax-row { display: flex; justify-content: space-between; margin-bottom: 5px; }
        .totals { text-align: right; margin-top: 20px; }
        .text-end { text-align: right; }
        @media print {
          .no-print { display: none; }
          .invoice { page-break-after: always; }
        }
      </style>
    </head>
    <body>
      <h1>Bulk Invoices</h1>
      <p>Generated on: ${new Date().toLocaleString()}</p>
      
      ${shipments.map((shipment, index) => {
        // Calculate totals for each invoice
        const products = shipment.products || [];
        const subtotal = products.reduce((sum: number, product: any) => 
          sum + ((product.quantity || 1) * (product.price || product.unitPrice || 0)), 0);
        const shipping = shipment.shippingCharge || 0;
        const shippingTax = shipping * 0.18; // 18% GST
        const shippingWithTax = shipping + shippingTax;
        const total = subtotal + shippingWithTax;
        
        // Use the helper method to format the date properly
        const formattedDate = this.formatDateForDisplay(shipment.date);
        
        return `
        <div class="invoice">
          <div class="header">
            <h2>TAX INVOICE</h2>
            <p>Invoice No: ${shipment.invoiceNo || 'N/A'} | Date: ${formattedDate}</p>
          </div>
          
          <div class="details">
            <div>
              <h3>From:</h3>
              <p>HERBALY TOUCH AYURVEDA PRODUCTS PRIVATE LIMITED</p>
              <p>1st Floor, Chirackal Tower, Ayroor P.O, Emakulam, Kerala, 683579, India</p>
              <p>GST: 32AAGCH3136H12X</p>
            </div>
            <div>
              <h3>To:</h3>
              <p>${shipment.customer || 'N/A'}</p>
              <p>${shipment.billingAddress || shipment.shippingDetails || 'N/A'}</p>
              <p>Phone: ${shipment.contactNumber || 'N/A'}</p>
            </div>
          </div>
          
          <table class="products-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Product</th>
                <th>Qty</th>
                <th>Unit Price (₹)</th>
                <th>Taxable Value (₹)</th>
                <th>CGST (9%)</th>
                <th>SGST (9%)</th>
                <th>Subtotal (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${products.map((product: any, i: number) => {
                const productName = product.productName || product.name || 'Product';
                const quantity = product.quantity || 1;
                const unitPrice = product.price || product.unitPrice || 0;
                const taxableValue = quantity * unitPrice;
                const cgstAmount = taxableValue * 0.09;
                const sgstAmount = taxableValue * 0.09;
                const productTotal = taxableValue + cgstAmount + sgstAmount;
                
                return `
                <tr>
                  <td>${i + 1}</td>
                  <td>${productName}</td>
                  <td>${quantity}</td>
                  <td class="text-end">${unitPrice.toFixed(2)}</td>
                  <td class="text-end">${taxableValue.toFixed(2)}</td>
                  <td class="text-end">${cgstAmount.toFixed(2)}</td>
                  <td class="text-end">${sgstAmount.toFixed(2)}</td>
                  <td class="text-end">${productTotal.toFixed(2)}</td>
                </tr>
                `;
              }).join('')}
            </tbody>
          </table>
          
          <div class="tax-row">
            <span>Shipping Charges:</span>
            <span>₹${shipping.toFixed(2)}</span>
          </div>
          <div class="tax-row">
            <span>Shipping Tax (18%):</span>
            <span>₹${shippingTax.toFixed(2)}</span>
          </div>
          
          <div class="totals">
            <p><strong>Subtotal:</strong> ₹${subtotal.toFixed(2)}</p>
            <p><strong>Total Tax:</strong> ₹${(subtotal * 0.18).toFixed(2)}</p>
            <p><strong>Shipping Total:</strong> ₹${shippingWithTax.toFixed(2)}</p>
            <p><strong>Grand Total:</strong> ₹${total.toFixed(2)}</p>
          </div>
          
          <div class="footer">
            <p><strong>Payment Status:</strong> ${shipment.paymentStatus || 'Unpaid'}</p>
            <p>Thank you for your business!</p>
          </div>
        </div>
        `;
      }).join('')}
      
      <div class="no-print" style="margin-top: 20px; text-align: center;">
        <button onclick="window.print()">Print All</button>
        <button onclick="window.close()">Close</button>
      </div>
    </body>
    </html>
  `;
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
    // Auto-print can be annoying, so you might want to remove this
    // printWindow.print();
  };
}




generateInvoice(shipment: any): void {
  this.currentShipment = shipment;
  
  // Calculate shipping with tax (18% GST on shipping)
  const shippingBeforeTax = shipment.shippingCharge || 0;
  const shippingTax = shippingBeforeTax * 0.18; // 18% GST
  const shippingWithTax = shippingBeforeTax + shippingTax;

  // Process products with calculated tax values (18% GST)
  const processedProducts = (shipment.products || []).map((product: any) => {
    // Handle both product structures (from sales and shipments)
    const productName = product.productName || product.name || 'Product';
    const unitPrice = product.price || product.unitPrice || 0;
    const quantity = product.quantity || 1;
    const discountAmount = product.discount || 0;
    
    // Calculate discount percentage if needed
    const discountPercent = discountAmount > 0 ? 
      (discountAmount / (unitPrice * quantity)) * 100 : 0;
    
    const taxableValue = (unitPrice * quantity) - discountAmount;
    
    // Using 18% GST (9% CGST + 9% SGST)
    const taxRate = 18; // 18% GST
    const cgstRate = taxRate / 2; // 9%
    const sgstRate = taxRate / 2; // 9%
    const cgstAmount = taxableValue * (cgstRate / 100);
    const sgstAmount = taxableValue * (sgstRate / 100);
    const subtotal = taxableValue + cgstAmount + sgstAmount;
    
    return {
      name: productName,
      quantity: quantity,
      unitPrice: unitPrice,
      discount: discountAmount,
      discountPercent: discountPercent,
      taxableValue: parseFloat(taxableValue.toFixed(2)),
      cgstAmount: parseFloat(cgstAmount.toFixed(2)),
      sgstAmount: parseFloat(sgstAmount.toFixed(2)),
      cgstRate: cgstRate,
      sgstRate: sgstRate,
      taxType: 'GST',
      subtotal: parseFloat(subtotal.toFixed(2))
    };
  });

  // Calculate totals
  const totalTaxableValue = processedProducts.reduce((sum: number, p: any) => sum + p.taxableValue, 0);
  const totalCGST = processedProducts.reduce((sum: number, p: any) => sum + p.cgstAmount, 0);
  const totalSGST = processedProducts.reduce((sum: number, p: any) => sum + p.sgstAmount, 0);
  const subtotal = processedProducts.reduce((sum: number, p: any) => sum + p.subtotal, 0);
  const grandTotal = subtotal + shippingWithTax;

  this.invoiceData = {
    invoiceNo: shipment.invoiceNo || 'N/A',
    date: this.formatDateForDisplay(shipment.date), // Use the helper method here too
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
    shippingCharge: shippingWithTax,
    shippingTax: shippingTax,
    taxes: [],
    totalTaxableValue: totalTaxableValue,
    total: grandTotal
  };

  this.invoiceModal.show();
}
getTotalTaxableValue(): number {
  return this.invoiceData.products.reduce((sum: number, product: any) => 
    sum + product.taxableValue, 0) || 0;
}

getTotalCGST(): number {
  return this.invoiceData.products.reduce((sum: number, product: any) => 
    sum + (product.cgstAmount || 0), 0) || 0;
}

getTotalSGST(): number {
  return this.invoiceData.products.reduce((sum: number, product: any) => 
    sum + (product.sgstAmount || 0), 0) || 0;
}


printGeneratedInvoice(): void {
  const printContent = document.getElementById('invoicePrintContent');
  const WindowPrt = window.open('', '', 'left=0,top=0,width=900,height=900,toolbar=0,scrollbars=0,status=0');
  
  if (WindowPrt) {
    WindowPrt.document.write(`
      <html>
        <head>
          <title>Invoice #${this.invoiceData.invoiceNo}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .invoice-header { text-align: center; margin-bottom: 20px; }
            .invoice-title { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
            .invoice-details { margin-bottom: 30px; }
            .from-to-section { display: flex; justify-content: space-between; margin-bottom: 30px; }
            .from-section, .to-section { width: 48%; }
            .section-title { font-weight: bold; margin-bottom: 10px; border-bottom: 1px solid #000; }
            .product-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            .product-table th, .product-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            .product-table th { background-color: #f2f2f2; }
            .totals-section { text-align: right; margin-top: 20px; }
            .footer { margin-top: 50px; text-align: center; font-style: italic; }
            .highlight { background-color: #ffffcc; }
          </style>
        </head>
        <body>
          ${printContent?.innerHTML}
          <script>
            setTimeout(() => {
              window.print();
              window.close();
            }, 300);
          </script>
        </body>
      </html>
    `);
    
    WindowPrt.document.close();
    WindowPrt.focus();
  }
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
    
    // Update both the date range and individual dates
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
      
      // Convert Firebase date to proper Date object
      const convertedDate = this.convertFirebaseDate(order.saleDate);
      
      return {
        id: doc.id,
        date: convertedDate, // Use the converted date
        invoiceNo: order.invoiceNo || '',
        customer: order.customer,
        shippingDetails: order.shippingDetails || '',
        contactNumber: order.customerPhone || '',
        location: order.location || order.businessLocation || '',
        businessLocation: order.businessLocation || '',
        billingAddress: order.billingAddress || '',
        
        deliveryPerson: order.deliveryPerson || '',
        shippingStatus: order.shippingStatus || 'Pending',
        alternateContact: order.alternateContact || '', // Add this line

        shippingCharge: order.shippingCharges || 0,
        paymentStatus: this.getPaymentStatus(order),
        balance: order.balance || 0,
        totalPayable: order.totalPayable || (order.paymentAmount + (order.balance || 0)),
        paymentAmount: order.paymentAmount || 0,
        products: order.products || [], // Ensure products are included
        prescription: order.prescription || null,
        prescriptions: order.prescriptions || [], // Add this line to include prescriptions array
        typeOfService: order.typeOfService || 'Standard',
        typeOfServiceName: order.typeOfServiceName || order.typeOfService || 'Standard',
        addedBy: order.addedBy || 'System',
        addedByDisplayName: order.addedByDisplayName || order.addedBy || 'System',
        activities: order.activities || [],
        dateRange: ''
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
  if (order.balance === 0 && order.paymentAmount > 0) return 'Paid';
  if (order.balance > 0 && order.paymentAmount > 0) return 'Partial';
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
  
    // Get selected shipments data
    const selectedData = this.filteredShipments.filter(shipment => 
      this.selectedShipments.includes(shipment.id)
    );
  
    // Generate printable HTML
    const printContent = this.generateBulkPrintContent(selectedData);
  
    // Open print window
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
                <td>${shipment.shippingCharge || 0}</td>
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
  

// And in your updateBulkStatus function, update the modal handling part:

// Update the status update method
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
        
        // Only add activity if status changed
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
    
    // Close modal
    const modalElement = document.getElementById('bulkStatusModal');
    if (modalElement) {
      const modal = bootstrap.Modal.getInstance(modalElement);
      modal?.hide();
    }
    
    // Reset selection
    this.selectedShipments = [];
    
    // Show success message
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
    'Processing': 'badge bg-info',       // Light blue for Processing
    'Packed': 'badge bg-primary',       // Blue for Packed
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
    this.totalShipmentAmount = shipments.reduce((sum, shipment) => sum + shipment.shippingCharge, 0);
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
    shippingCharge: shipment.shippingCharge,
    
  };
  
  // Generate the initial combined address
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

// Add this method to handle file upload
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

  // Date range filter
 if (this.filterValues.startDate && this.filterValues.endDate) {
    filtered = filtered.filter(shipment => {
      const shipmentDate = new Date(shipment.date);
      const startDate = new Date(this.filterValues.startDate!);
      const endDate = new Date(this.filterValues.endDate!);
      
      // Set time to beginning and end of day for proper comparison
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      
      return shipmentDate >= startDate && shipmentDate <= endDate;
    });
  }

  // Current location filter
  if (this.filterValues.currentLocation && this.filterValues.currentLocation !== 'All') {
    filtered = filtered.filter(shipment => 
      shipment.location === this.filterValues.currentLocation
    );
  }

  // Customer filter (search)
  if (this.filterValues.customer) {
    const searchTerm = this.filterValues.customer.toLowerCase();
    filtered = filtered.filter(shipment => 
      shipment.customer.toLowerCase().includes(searchTerm)
    );
  }

  // Type of service filter
  if (this.filterValues.typeOfService && this.filterValues.typeOfService !== 'All') {
    filtered = filtered.filter(shipment => 
      shipment.typeOfService === this.filterValues.typeOfService
    );
  }

  // Added by filter
  if (this.filterValues.addedBy && this.filterValues.addedBy !== 'All') {
    filtered = filtered.filter(shipment => 
      shipment.addedBy === this.filterValues.addedBy
    );
  }

  // Payment status filter
  if (this.filterValues.paymentStatus && this.filterValues.paymentStatus !== 'All') {
    filtered = filtered.filter(shipment => 
      shipment.paymentStatus === this.filterValues.paymentStatus
    );
  }

  // Shipping status filter
  if (this.filterValues.shippingStatus && this.filterValues.shippingStatus !== 'All') {
    filtered = filtered.filter(shipment => 
      shipment.shippingStatus === this.filterValues.shippingStatus
    );
  }

  // Apply the filtered results
  this.filteredShipments = filtered;
  this.totalEntries = filtered.length;
  this.currentPage = 1;
  this.calculateTotals(filtered);
}
// Helper method to check if any filters are active
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
 // Update your resetFilters method
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
  // Updated headers - removed 'Shipping Charge' and added 'Grand Total'
  const headers = ['Date', 'Invoice No.', 'Customer', 'Contact Number', 'Location',
                   'Delivery Person', 'Shipping Status', 'Payment Status', 'Grand Total'];

  // Helper function to escape CSV values
  const escapeCSVValue = (value: any): string => {
    if (value === null || value === undefined) {
      return '';
    }
    
    const stringValue = String(value);
    
    // If the value contains comma, quote, or newline, wrap it in quotes and escape internal quotes
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
      return '"' + stringValue.replace(/"/g, '""') + '"';
    }
    
    return stringValue;
  };

  const rows = this.filteredShipments.map(ship => [
    escapeCSVValue(this.formatDateForDisplay(ship.date)), // Use helper method for date formatting
    escapeCSVValue(ship.invoiceNo),
    escapeCSVValue(ship.customer),
    escapeCSVValue(ship.contactNumber),
    escapeCSVValue(ship.location),
    escapeCSVValue(ship.deliveryPerson),
    escapeCSVValue(ship.shippingStatus),
    escapeCSVValue(ship.paymentStatus),
    // Safely handle totalPayable - convert to number first if needed
    escapeCSVValue((Number(ship.totalPayable) || 0).toFixed(2))
  ].join(','));

  const csvContent = [headers.map(escapeCSVValue).join(','), ...rows].join('\n');
  this.downloadFile(csvContent, 'shipments_export.csv', 'text/csv');
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
    // Store the original display values
    const originalDisplayValues = {
      sidebar: document.querySelector('.sidebar') as HTMLElement,
      navbar: document.querySelector('.navbar') as HTMLElement,
      controlsPanel: document.querySelector('.controls-panel') as HTMLElement
    };
  
    // Hide elements before printing
    if (originalDisplayValues.sidebar) originalDisplayValues.sidebar.style.display = 'none';
    if (originalDisplayValues.navbar) originalDisplayValues.navbar.style.display = 'none';
    if (originalDisplayValues.controlsPanel) originalDisplayValues.controlsPanel.style.display = 'none';
  
    // Print the document
    window.print();
  
    // Restore the display values after printing
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
      partialAmount: shipment.paymentAmount || null
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
// Update the saveEditedShipment method to handle the new fields
async saveEditedShipment(): Promise<void> {
  if (!this.editFormData.id) return;

  this.isSavingForm = true;

  try {
    this.updateCombinedAddress();

    const currentUser = await firstValueFrom(this.authService.getCurrentUser());
    const currentShipment = this.shipments.find(s => s.id === this.editFormData.id);

    if (!currentShipment) {
      throw new Error('Shipment not found');
    }

    const currentStatus = currentShipment.shippingStatus;
    const newStatus = this.editFormData.shippingStatus;

    const updateData = {
      invoiceNo: this.editFormData.invoiceNo,
      saleDate: this.editFormData.date,
      customer: this.editFormData.customer,
      shippingDetails: this.editFormData.shippingDetails,
      billingAddress: this.editFormData.billingAddress,
      shippingNotes: this.editFormData.shippingNotes,
      customerPhone: this.editFormData.contactNumber,
      deliveryPerson: this.editFormData.deliveryPerson,
      shippingStatus: newStatus,
      shippingCharges: this.editFormData.shippingCharge,
      updatedAt: new Date(),
      combinedAddress: this.combinedAddress
    };

    // Handle file upload if a document was selected
    if (this.shippingDocumentFile) {
      // Your file upload logic here
    }

    // Call the service with all required parameters including the note
    const updatedActivities = await this.saleService.updateSaleWithActivity(
      this.editFormData.id,
      updateData,
      currentStatus,
      newStatus,
      currentUser?.uid || 'system',
      currentUser?.displayName || 'System',
      this.newActivity.note // Pass the note from the form
    );

    // Update local data
    const updatedShipment: Shipment = {
      ...currentShipment,
      ...updateData,
      activities: updatedActivities
    };

    this.shipments = this.shipments.map(shipment =>
      shipment.id === updatedShipment.id ? updatedShipment : shipment
    );

    this.filteredShipments = this.filteredShipments.map(shipment =>
      shipment.id === updatedShipment.id ? updatedShipment : shipment
    );

    // Reset the note field after saving
    this.newActivity.note = '';
    
    this.showEditFormModal = false;
    this.editFormData = {};
    this.shippingDocumentFile = null;
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
      let newBalance = this.currentShipment.balance;
      const totalAmount = this.currentShipment.totalPayable || 0;
      
      if (this.editData.paymentStatus === 'Paid') {
        newBalance = 0;
      } else if (this.editData.paymentStatus === 'Partial') {
        const partialAmount = this.editData.partialAmount ?? (totalAmount * 0.5);
        newBalance = totalAmount - partialAmount;
      } else if (this.editData.paymentStatus === 'Unpaid') {
        newBalance = totalAmount;
      }
      newBalance = Math.max(0, newBalance);

      await this.saleService.updateSale(this.editData.id, {
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
    this.saleService.generateDocument(shipmentId, 'invoice').subscribe(
      (response) => {
        this.downloadPdf(response, `invoice-${shipmentId}.pdf`);
      },
      (error) => {
        console.error('Error generating invoice:', error);
        alert('Failed to generate invoice. Please try again.');
      }
    );
  }

  // New Prescription Modal Methods
  openPrescriptionModal(shipment: Shipment): void {
    this.currentShipment = shipment;
    
    // Initialize with existing prescription data if available, or use defaults
    if (shipment.prescription) {
      this.currentPrescription = {
        patientName: shipment.prescription.patientName || shipment.customer || '',
        date: shipment.prescription.date || new Date().toISOString().split('T')[0],
        medicines: shipment.prescription.medicines || this.getDefaultMedicines()
      };
    } else {
      // Set default prescription with customer name
      this.currentPrescription = {
        patientName: shipment.customer || '',
        date: new Date().toISOString().split('T')[0],
        medicines: this.getDefaultMedicines()
      };
    }
    
    this.showPrescriptionModal = true;
  }

  getDefaultMedicines(): PrescriptionMedicine[] {
    // Create 7 default medicine entries with standard text
    const medicines: PrescriptionMedicine[] = [];
    
    // First 5 entries are regular medicines
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
    
    // Last 2 entries are for pills
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
      // Save prescription data to the shipment
      await this.saleService.updateSale(this.currentShipment.id, {
        updatedAt: new Date()
      });
      
      // Update local data
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
          <td>${shipment.shippingCharge || 0}</td>
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
    
    // Remove from local arrays
    this.shipments = this.shipments.filter(ship => ship.id !== shipmentId);
    this.filteredShipments = this.filteredShipments.filter(ship => ship.id !== shipmentId);
    
    alert('Shipment deleted successfully!');
  } catch (error) {
    console.error('Error deleting shipment:', error);
    alert('Failed to delete shipment. Please try again.');
  }
  }
  
  printPrescription(): void {
    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups for this website to print prescriptions.');
      return;
    }
    
    // Generate the HTML content for printing
    const htmlContent = this.generatePrescriptionHTML();
    
    // Write the HTML content to the new window
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    // Wait for content to load then print
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
          <h2>ഹെർബലി ടച്ച് ആയുര്‍വേദ ഉല്‍പ്പന്നങ്ങള്‍ പ്രൈവറ്റ് ലിമിറ്റഡ്</h2>
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
}