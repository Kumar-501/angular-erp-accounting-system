import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import * as XLSX from 'xlsx';
import { CustomerService } from '../services/customer.service';
import { SupplierService } from '../services/supplier.service';
import { UserService } from '../services/user.service';
import { LeadStatusService } from '../services/lead-status.service';
import { LifeStageService } from '../services/life-stage.service';

interface ImportData {
  contactType: string;
  prefix: string;
  firstName: string;
  middleName: string;
  lastName: string;
  businessName: string;
  contactId: string;
  taxNumber: string;
  openingBalance: number;
  payTerm: number;
  payTermPeriod: string;
  creditLimit: number;
  email: string;
  mobile: string;
  alternateContact: string;
  landline: string;
  city: string;
  state: string;
  country: string;
  addressLine1: string;
  addressLine2: string;
  zipCode: string;
  dob: string;
  customField1: string;
  customField2: string;
  customField3: string;
  customField4: string;
}

@Component({
  selector: 'app-import-contacts',
  templateUrl: './import-contacts.component.html',
  styleUrls: ['./import-contacts.component.scss']
})
export class ImportContactsComponent implements OnInit {
  selectedFile: File | null = null;
  importProgress = 0;
  importStatus: 'idle' | 'processing' | 'success' | 'error' = 'idle';
  importResult = { success: 0, errors: 0, errorMessages: [] as string[] };
  processingMessage = '';

  // Reference data
  leadStatuses: any[] = [];
  lifeStages: any[] = [];
  assignedUsers: any[] = [];

  constructor(
    private customerService: CustomerService,
    private supplierService: SupplierService,
    private userService: UserService,
    private leadStatusService: LeadStatusService,
    private lifeStageService: LifeStageService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadReferenceData();
  }

  async loadReferenceData(): Promise<void> {
    try {
      // Load lead statuses
      this.leadStatusService.getLeadStatuses().subscribe(statuses => {
        this.leadStatuses = statuses || [];
      });

      // Load life stages
      this.lifeStages = await this.lifeStageService.getLifeStages();

      // Load users
      this.userService.getUsers().subscribe(users => {
        this.assignedUsers = users || [];
      });
    } catch (error) {
      console.error('Error loading reference data:', error);
    }
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      // Validate file type
      const allowedTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel', // .xls
        'text/csv' // .csv
      ];
      
      if (allowedTypes.includes(file.type) || file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv')) {
        this.selectedFile = file;
        this.importStatus = 'idle';
        this.importResult = { success: 0, errors: 0, errorMessages: [] };
      } else {
        alert('Please select a valid Excel (.xlsx, .xls) or CSV file.');
        event.target.value = '';
      }
    }
  }

  async onSubmit(): Promise<void> {
    if (!this.selectedFile) {
      alert('Please select a file first');
      return;
    }

    this.importStatus = 'processing';
    this.importProgress = 0;
    this.importResult = { success: 0, errors: 0, errorMessages: [] };
    this.processingMessage = 'Reading file...';

    try {
      const data = await this.readFile(this.selectedFile);
      const contacts = this.parseFileData(data);
      
      if (contacts.length === 0) {
        throw new Error('No valid data found in file');
      }

      this.processingMessage = `Processing ${contacts.length} contacts...`;
      
      // Process contacts in batches
      const batchSize = 5;
      for (let i = 0; i < contacts.length; i += batchSize) {
        const batch = contacts.slice(i, i + batchSize);
        await this.processBatch(batch, i);
        this.importProgress = Math.floor(((i + batchSize) / contacts.length) * 100);
      }

      this.importStatus = 'success';
      this.processingMessage = 'Import completed successfully!';
      
      setTimeout(() => {
        alert(`Import completed!\nSuccess: ${this.importResult.success}\nErrors: ${this.importResult.errors}`);
        
        if (this.importResult.errors > 0) {
          console.log('Import errors:', this.importResult.errorMessages);
        }
        
        // Navigate back to customers list
        this.router.navigate(['/customers']);
      }, 1000);

    } catch (error) {
      console.error('Import error:', error);
      this.importStatus = 'error';
      this.processingMessage = 'Import failed';
      this.importResult.errorMessages.push(`Failed to process file: ${error}`);
      alert('Error during import. Please check the file format and try again.');
    }
  }

  private async readFile(file: File): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e: any) => {
        try {
          if (file.name.endsWith('.csv')) {
            // Handle CSV files
            const text = e.target.result;
            const lines = text.split('\n');
            const headers = lines[0].split(',').map((h: string) => h.trim());
            const data = [];
            
            for (let i = 1; i < lines.length; i++) {
              if (lines[i].trim()) {
                const values = lines[i].split(',').map((v: string) => v.trim());
                const row: any = {};
                headers.forEach((header: string | number, index: string | number) => {
                  row[header] = values[index] || '';
                });
                data.push(row);
              }
            }
            resolve(data);
          } else {
            // Handle Excel files
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);
            resolve(jsonData);
          }
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = (error) => reject(error);
      
      if (file.name.endsWith('.csv')) {
        reader.readAsText(file);
      } else {
        reader.readAsArrayBuffer(file);
      }
    });
  }

  private parseFileData(data: any[]): any[] {
    return data.map((row, index) => {
      try {
        // Map columns by position as specified in the template
        const rowData = Array.isArray(row) ? row : Object.values(row);
        
        const contact = {
          contactType: this.getContactTypeValue(rowData[0]),
          prefix: rowData[1] || '',
          firstName: rowData[2] || '',
          middleName: rowData[3] || '',
          lastName: rowData[4] || '',
          businessName: rowData[5] || '',
          contactId: rowData[6] || this.generateContactId(),
          taxNumber: rowData[7] || '',
          openingBalance: this.parseNumber(rowData[8]) || 0,
          payTerm: this.parseNumber(rowData[9]) || 0,
          payTermPeriod: rowData[10] || 'days',
          creditLimit: this.parseNumber(rowData[11]) || 0,
          email: rowData[12] || '',
          mobile: this.cleanPhoneNumber(rowData[13] || ''),
          alternateContact: this.cleanPhoneNumber(rowData[14] || ''),
          landline: this.cleanPhoneNumber(rowData[15] || ''),
          city: rowData[16] || '',
          state: rowData[17] || '',
          country: rowData[18] || '',
          addressLine1: rowData[19] || '',
          addressLine2: rowData[20] || '',
          zipCode: rowData[21] || '',
          dob: this.parseDate(rowData[22]) || null,
          customField1: rowData[23] || '',
          customField2: rowData[24] || '',
          customField3: rowData[25] || '',
          customField4: rowData[26] || '',
          // Additional fields for the customer system
          isIndividual: this.determineIfIndividual(rowData[5], rowData[2]),
          status: 'Active',
          createdAt: new Date(),
          updatedAt: new Date(),
          // Set default life stage and ad code if available
          lifestage: this.lifeStages.length > 0 ? this.lifeStages[0].name : '',
          adcode: this.leadStatuses.length > 0 ? this.leadStatuses[0].id : '',
          assignedTo: this.assignedUsers.length > 0 ? this.assignedUsers[0].username : ''
        };

        return contact;
      } catch (error) {
        console.error(`Error parsing row ${index + 1}:`, error);
        return null;
      }
    }).filter(contact => contact !== null && this.validateContact(contact));
  }

  private getContactTypeValue(value: any): string {
    const numValue = this.parseNumber(value);
    switch (numValue) {
      case 1: return 'Customer';
      case 2: return 'Supplier';
      case 3: return 'Both';
      default: return 'Customer';
    }
  }

  private determineIfIndividual(businessName: string, firstName: string): boolean {
    return !businessName || businessName.trim() === '';
  }

  private parseNumber(value: any): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const num = parseFloat(value.replace(/[^\d.-]/g, ''));
      return isNaN(num) ? 0 : num;
    }
    return 0;
  }

  private parseDate(value: any): Date | null {
    if (!value) return null;
    
    try {
      // Handle Excel date serial numbers
      if (typeof value === 'number') {
        const excelEpoch = new Date(1900, 0, 1);
        return new Date(excelEpoch.getTime() + (value - 2) * 24 * 60 * 60 * 1000);
      }
      
      // Handle string dates
      if (typeof value === 'string') {
        // Try different date formats
        const formats = [
          value, // As is
          value.replace(/[/-]/g, '-'), // Normalize separators
        ];
        
        for (const format of formats) {
          const date = new Date(format);
          if (!isNaN(date.getTime())) {
            return date;
          }
        }
      }
      
      return new Date(value);
    } catch (error) {
      console.error('Error parsing date:', value, error);
      return null;
    }
  }

  private cleanPhoneNumber(phone: string): string {
    if (!phone) return '';
    return phone.toString().replace(/\D/g, '');
  }

  private validateContact(contact: any): boolean {
    // Basic validation
    if (!contact.firstName && !contact.businessName) return false;
    if (!contact.mobile || contact.mobile.length < 10) return false;
    
    // Validate contact type requirements
    if ((contact.contactType === 'Supplier' || contact.contactType === 'Both') && !contact.businessName) {
      return false;
    }
    
    return true;
  }

  private async processBatch(batch: any[], startIndex: number): Promise<void> {
    for (let i = 0; i < batch.length; i++) {
      const contact = batch[i];
      const rowNumber = startIndex + i + 2; // +2 for header row and 1-based indexing
      
      try {
        this.processingMessage = `Processing contact ${rowNumber}...`;
        
        // Process based on contact type
        if (contact.contactType === 'Customer' || contact.contactType === 'Both') {
          await this.saveCustomer(contact);
        }
        
        if (contact.contactType === 'Supplier' || contact.contactType === 'Both') {
          await this.saveSupplier(contact);
        }
        
        this.importResult.success++;
      } catch (error) {
        this.importResult.errors++;
        const errorMsg = `Row ${rowNumber}: ${contact.firstName || contact.businessName} - ${error}`;
        this.importResult.errorMessages.push(errorMsg);
        console.error('Error processing contact:', error);
      }
    }
  }

  private async saveCustomer(contact: any): Promise<void> {
    const customerData = this.mapToCustomer(contact);
    await this.customerService.addCustomer(customerData);
  }

  private async saveSupplier(contact: any): Promise<void> {
    const supplierData = this.mapToSupplier(contact);
    await this.supplierService.addSupplier(supplierData);
  }

  private mapToCustomer(contact: any): any {
    return {
      contactId: contact.contactId || this.generateContactId(),
      contactType: contact.contactType,
      isIndividual: contact.isIndividual,
      prefix: contact.prefix,
      firstName: contact.firstName,
      middleName: contact.middleName,
      lastName: contact.lastName,
      businessName: contact.businessName,
      mobile: contact.mobile,
      landline: contact.landline,
      alternateContact: contact.alternateContact,
      email: contact.email,
      taxNumber: contact.taxNumber,
      openingBalance: contact.openingBalance,
      creditLimit: contact.creditLimit,
      city: contact.city,
      state: contact.state,
      country: contact.country,
      addressLine1: contact.addressLine1,
      addressLine2: contact.addressLine2,
      zipCode: contact.zipCode,
      dob: contact.dob,
      status: contact.status,
      createdAt: contact.createdAt,
      updatedAt: contact.updatedAt,
      lifestage: contact.lifestage,
      adcode: contact.adcode,
      assignedTo: contact.assignedTo,
      payTerm: contact.payTerm
    };
  }

  private mapToSupplier(contact: any): any {
    return {
      contactId: contact.contactId || this.generateContactId(),
      contactType: contact.contactType,
      isIndividual: contact.isIndividual,
      prefix: contact.prefix,
      firstName: contact.firstName,
      middleName: contact.middleName,
      lastName: contact.lastName,
      businessName: contact.businessName,
      mobile: contact.mobile,
      landline: contact.landline,
      alternateContact: contact.alternateContact,
      email: contact.email,
      taxNumber: contact.taxNumber,
      openingBalance: contact.openingBalance,
      payTerm: contact.payTerm,
      payTermPeriod: contact.payTermPeriod,
      city: contact.city,
      state: contact.state,
      country: contact.country,
      addressLine1: contact.addressLine1,
      addressLine2: contact.addressLine2,
      zipCode: contact.zipCode,
      status: contact.status,
      createdAt: contact.createdAt,
      updatedAt: contact.updatedAt
    };
  }

  private generateContactId(): string {
    return `CO${String(Math.floor(Math.random() * 9999) + 1).padStart(4, '0')}`;
  }

  downloadTemplate(): void {
    const templateData = [
      [
        'Contact Type (1=Customer, 2=Supplier, 3=Both)',
        'Prefix',
        'First Name',
        'Middle Name',
        'Last Name',
        'Business Name',
        'Contact ID (Leave blank to auto-generate)',
        'Tax Number',
        'Opening Balance',
        'Pay Term',
        'Pay Term Period (days/months)',
        'Credit Limit',
        'Email',
        'Mobile',
        'Alternate Contact',
        'Landline',
        'City',
        'State',
        'Country',
        'Address Line 1',
        'Address Line 2',
        'Zip Code',
        'Date of Birth (YYYY-MM-DD)',
        'Custom Field 1',
        'Custom Field 2',
        'Custom Field 3',
        'Custom Field 4'
      ],
      [
        '1',
        'Mr',
        'John',
        '',
        'Doe',
        '',
        '',
        '',
        '0',
        '0',
        'days',
        '0',
        'john.doe@example.com',
        '9876543210',
        '',
        '',
        'Chennai',
        'Tamil Nadu',
        'India',
        '123 Main Street',
        '',
        '600001',
        '1990-01-15',
        '',
        '',
        '',
        ''
      ]
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Contacts Template');

    // Set column widths
    const colWidths = templateData[0].map(() => ({ wch: 20 }));
    worksheet['!cols'] = colWidths;

    XLSX.writeFile(workbook, 'Contacts_Import_Template.xlsx');
  }

  goToCustomers(): void {
    this.router.navigate(['/customers']);
  }

  resetImport(): void {
    this.selectedFile = null;
    this.importStatus = 'idle';
    this.importProgress = 0;
    this.importResult = { success: 0, errors: 0, errorMessages: [] };
    this.processingMessage = '';
    
    // Reset file input
    const fileInput = document.getElementById('fileUpload') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }
}