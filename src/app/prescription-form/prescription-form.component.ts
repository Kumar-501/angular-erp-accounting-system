import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { SalesOrder } from '../models/sales-order.model';
import { SaleService } from '../services/sale.service';
import { Product } from '../models/product.model';

interface Medicine {
  type: string;
  instructions: string;
}

interface Prescription {
  patientName: string;
  date: string;
  medicines: Medicine[];
}

@Component({
  selector: 'app-prescription-form',
  templateUrl: './prescription-form.component.html',
  styleUrls: ['./prescription-form.component.scss']
})
export class PrescriptionFormComponent {
  @Input() existingPrescriptions: Prescription[] = [];
  @Output() formSubmit = new EventEmitter<Prescription[]>();

  allPrescriptions: Prescription[] = [];
  currentMedicines: Medicine[] = [];
  selectedMedicineType: string | null = null;
  selectedPrescription: Prescription | null = null;

  // Main form
  prescriptionForm: FormGroup;

  // Medicine forms
  kasayamForm: FormGroup;
  bulighaForm: FormGroup;
  bhasmamForm: FormGroup;
  krudhamForm: FormGroup;
  suranamForm: FormGroup;
  rasayanamForm: FormGroup;
  lagiumForm: FormGroup;

  constructor(private fb: FormBuilder, private saleService: SaleService) {
    // Initialize main form
    this.prescriptionForm = this.fb.group({
      patientName: ['', Validators.required],
      date: ['', Validators.required]
    });

    // Initialize medicine forms
    this.kasayamForm = this.fb.group({
      name: ['', Validators.required],
      gulika: ['', Validators.required],
      powder: ['', Validators.required],
      time: ['', Validators.required]
    });

    this.bulighaForm = this.fb.group({
      name: ['', Validators.required],
      count: ['', Validators.required],
      water: ['', Validators.required],
      time: ['', Validators.required]
    });

    this.bhasmamForm = this.fb.group({
      name: ['', Validators.required],
      amount: ['', Validators.required],
      liquid: ['', Validators.required],
      time: ['', Validators.required]
    });

    this.krudhamForm = this.fb.group({
      name: ['', Validators.required],
      time: ['', Validators.required]
    });

    this.suranamForm = this.fb.group({
      name: ['', Validators.required],
      time: ['', Validators.required]
    });

    this.rasayanamForm = this.fb.group({
      name: ['', Validators.required],
      time: ['', Validators.required]
    });

    this.lagiumForm = this.fb.group({
      name: ['', Validators.required],
      time: ['', Validators.required]
    });

    // Initialize existing prescriptions
    if (this.existingPrescriptions) {
      this.allPrescriptions = [...this.existingPrescriptions];
    }
  }

  addMedicine(type: string): void {
    let instructions = '';

    switch (type) {
      case 'Kasayam':
        if (this.kasayamForm.invalid) {
          alert('Please fill all fields for Kasayam');
          return;
        }
        const kasayam = this.kasayamForm.value;
        instructions = `${kasayam.name} കഷായം 15 ml എടുത്ത് 45 ml തിളപ്പിച്ചാറ്റിയ വെള്ളം ചേർത്ത് ${kasayam.gulika} ഗുളിക ${kasayam.powder} പൊടി ചേർത്ത് ${kasayam.time} നേരം ഭക്ഷണത്തിനു മുൻപ് / ശേഷം സേവിക്കുക.`;
        break;

      case 'Buligha':
        if (this.bulighaForm.invalid) {
          alert('Please fill all fields for Buligha');
          return;
        }
        const buligha = this.bulighaForm.value;
        instructions = `${buligha.name} ഗുളിക ${buligha.count} എണ്ണം എടുത്ത് ${buligha.water} ml തിളപ്പിച്ചാറ്റിയ വെള്ളം ചേർത്ത് ${buligha.time} നേരം ഭക്ഷണത്തിനു മുൻപ് / ശേഷം സേവിക്കുക.`;
        break;

      case 'Bhasmam':
        if (this.bhasmamForm.invalid) {
          alert('Please fill all fields for Bhasmam');
          return;
        }
        const bhasmam = this.bhasmamForm.value;
        instructions = `${bhasmam.name} ഭസ്മം ${bhasmam.amount} മുഴ്‌ എടുത്ത് ${bhasmam.liquid} ml തേൻ/നാരങ്ങാനീര് ചേർത്ത് ${bhasmam.time} നേരം ഭക്ഷണത്തിനു മുൻപ് / ശേഷം സേവിക്കുക.`;
        break;

      case 'Krudham':
        if (this.krudhamForm.invalid) {
          alert('Please fill all fields for Krudham');
          return;
        }
        const krudham = this.krudhamForm.value;
        instructions = `${krudham.name} ഘൃതം ഒരു ടീസ്പൂൺ എടുത്ത് ${krudham.time} നേരം ഭക്ഷണത്തിനു മുൻപ് / ശേഷം സേവിക്കുക.`;
        break;

      case 'Suranam':
        if (this.suranamForm.invalid) {
          alert('Please fill all fields for Suranam');
          return;
        }
        const suranam = this.suranamForm.value;
        instructions = `${suranam.name} ചൂർണ്ണം ഒരു ടീസ്പൂൺ എടുത്ത് ${suranam.time} നേരം ഭക്ഷണത്തിനു മുൻപ് / ശേഷം സേവിക്കുക.`;
        break;

      case 'Rasayanam':
        if (this.rasayanamForm.invalid) {
          alert('Please fill all fields for Rasayanam');
          return;
        }
        const rasayanam = this.rasayanamForm.value;
        instructions = `${rasayanam.name} രസായനം ഒരു ടീസ്പൂൺ എടുത്ത് ${rasayanam.time} നേരം ഭക്ഷണത്തിനു മുൻപ് / ശേഷം സേവിക്കുക.`;
        break;

      case 'Lagium':
        if (this.lagiumForm.invalid) {
          alert('Please fill all fields for Lagium');
          return;
        }
        const lagium = this.lagiumForm.value;
        instructions = `${lagium.name} ലേഹ്യം ഒരു ടീസ്പൂൺ എടുത്ത് ${lagium.time} നേരം ഭക്ഷണത്തിനു മുൻപ് / ശേഷം സേവിക്കുക.`;
        break;
    }

    this.currentMedicines.push({ type, instructions });
    this.clearCurrentMedicineForm();
  }

  removeMedicine(index: number): void {
    this.currentMedicines.splice(index, 1);
  }

  clearCurrentMedicineForm(): void {
    switch (this.selectedMedicineType) {
      case 'Kasayam':
        this.kasayamForm.reset();
        break;
      case 'Buligha':
        this.bulighaForm.reset();
        break;
      case 'Bhasmam':
        this.bhasmamForm.reset();
        break;
      case 'Krudham':
        this.krudhamForm.reset();
        break;
      case 'Suranam':
        this.suranamForm.reset();
        break;
      case 'Rasayanam':
        this.rasayanamForm.reset();
        break;
      case 'Lagium':
        this.lagiumForm.reset();
        break;
    }
  }

  saveCurrentPrescription(): void {
    if (this.prescriptionForm.invalid) {
      alert('Please enter patient name and date');
      return;
    }

    if (this.currentMedicines.length === 0) {
      alert('Please add at least one medicine');
      return;
    }

    const prescription: Prescription = {
      patientName: this.prescriptionForm.value.patientName!,
      date: this.prescriptionForm.value.date!,
      medicines: [...this.currentMedicines]
    };

    this.allPrescriptions.push(prescription);
    this.currentMedicines = [];
    this.prescriptionForm.reset();
    alert('Prescription saved! You can add another one.');
  }

  async submitAllPrescriptions(): Promise<void> {
    if (this.allPrescriptions.length === 0 && this.currentMedicines.length > 0) {
      this.saveCurrentPrescription();
    }

    if (this.allPrescriptions.length > 0) {
      try {
        // Create a sale record for the prescriptions
        const saleData: Omit<SalesOrder, 'id'> = {
          orderNo: this.generateOrderNumber(),
          customerId: this.prescriptionForm.value.patientName || 'Anonymous',
          customerName: this.prescriptionForm.value.patientName || 'Anonymous',
          saleDate: new Date(),
          invoiceNo: this.generateInvoiceNumber(),
          typeOfService: 'Prescription',
          typeOfServiceName: 'Ayurvedic Prescription',
          products: [] as { productId: string | undefined; id?: string; name?: string; quantity?: number; unitPrice?: number; subtotal?: number; }[],
          status: 'Completed',
          shippingStatus: 'Not Applicable',
          paymentStatus: 'Paid',
          paymentAmount: 0,
          paymentMethod: 'Prescription Service',
          paidOn: new Date(),
          shippingDetails: 'Not Required',
          total: 0,
          subtotal: 0,
          tax: 0,
          shippingCharges: 0,
          shippingCost: 0,
          balance: 0,
          transactionId: this.generateTransactionId(),
          totalPayable: 0,
          discountAmount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          customerAge: null,
          customerDob: null,
          customerGender: '',
          businessLocationId: undefined,
          businessLocation: undefined,
          orderStatus: ''
        };
        
        // Save the sale data using the service
        await this.saleService['createSale'](saleData).toPromise();
        
        // Emit the form submit event
        this.formSubmit.emit(this.allPrescriptions);
        
        // Clear the form after successful submission
        this.allPrescriptions = [];
        this.currentMedicines = [];
        this.prescriptionForm.reset();
        
        alert('Prescriptions submitted successfully!');
      } catch (error) {
        console.error('Error saving prescriptions:', error);
        alert('Error saving prescriptions. Please try again.');
      }
    } else {
      alert('No prescriptions to submit');
    }
  }

  private generateInvoiceNumber(): string {
    const date = new Date();
    return `INV-${date.getFullYear()}${(date.getMonth()+1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  private generateOrderNumber(): string {
    const date = new Date();
    return `PRX-${date.getFullYear()}${(date.getMonth()+1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  private generateTransactionId(): string {
    const date = new Date();
    return `TXN-${date.getFullYear()}${(date.getMonth()+1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}-${Math.floor(10000 + Math.random() * 90000)}`;
  }

  clearForm(): void {
    this.prescriptionForm.reset();
    this.kasayamForm.reset();
    this.bulighaForm.reset();
    this.bhasmamForm.reset();
    this.krudhamForm.reset();
    this.suranamForm.reset();
    this.rasayanamForm.reset();
    this.lagiumForm.reset();
    this.currentMedicines = [];
    this.selectedMedicineType = null;
  }

  downloadAllPrescriptions(): void {
    if (this.allPrescriptions.length === 0) {
      alert('No prescriptions to download');
      return;
    }

    console.log('Prescriptions to download:', this.allPrescriptions);
    alert('Prescriptions downloaded successfully! (Check console for data)');
  }

  viewPrescriptions(): void {
    console.log('All prescriptions:', this.allPrescriptions);
  }

  deletePrescription(index: number): void {
    if (confirm('Are you sure you want to delete this prescription?')) {
      this.allPrescriptions.splice(index, 1);
    }
  }

  viewPrescriptionDetails(prescription: Prescription): void {
    this.selectedPrescription = prescription;
    console.log('Prescription details:', this.getFormattedText(prescription));
  }

  getFormattedText(prescription: Prescription): string {
    const header = `DR.RAJANA P.R., BAMS
HERBALLY TOUCH AYURVEDA PRODUCTS PVT.LTD.
First Floor, Chirackal Tower, Ayroor P.O., Ernakulam Dt., Kerala - 683 579
Email: contact@herbalytouch.com | Ph: 7034110999
Name: ${prescription.patientName}
Date: ${prescription.date}\n\n`;

    const medicineText = prescription.medicines
      .map(medicine => `${medicine.type}: ${medicine.instructions}`)
      .join('\n\n');

    return header + medicineText;
  }
}