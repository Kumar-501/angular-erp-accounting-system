import { Component } from '@angular/core';
import * as XLSX from 'xlsx';
import { SupplierService } from '../services/supplier.service';
import { CustomerService } from '../services/customer.service';

@Component({
  selector: 'app-import-contacts',
  templateUrl: './import-contacts.component.html',
  styleUrls: ['./import-contacts.component.scss']
})
export class ImportContactsComponent {
  selectedFile: File | null = null;
  importProgress = 0;
  importStatus: 'idle' | 'processing' | 'success' | 'error' = 'idle';
  importResult: any = { success: 0, errors: 0, errorMessages: [] };
  // Add this method to the ImportContactsComponent class
cleanPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  return phone.replace(/\D/g, '');
}

  constructor(
    private supplierService: SupplierService,
    private customerService: CustomerService
  ) {}

  onFileSelected(event: any): void {
    this.selectedFile = event.target.files[0];
    this.importStatus = 'idle';
  }

  async onSubmit(): Promise<void> {
    if (!this.selectedFile) {
      alert('Please select a file first');
      return;
    }

    this.importStatus = 'processing';
    this.importProgress = 0;
    this.importResult = { success: 0, errors: 0, errorMessages: [] };

    try {
      const data = await this.readExcelFile(this.selectedFile);
      const contacts = this.parseExcelData(data);
      
      // Process contacts in batches
      const batchSize = 10;
      for (let i = 0; i < contacts.length; i += batchSize) {
        const batch = contacts.slice(i, i + batchSize);
        await this.processBatch(batch);
        this.importProgress = Math.floor(((i + batchSize) / contacts.length) * 100);
      }

      this.importStatus = 'success';
      alert(`Import completed! Success: ${this.importResult.success}, Errors: ${this.importResult.errors}`);
    } catch (error) {
      console.error('Import error:', error);
      this.importStatus = 'error';
      this.importResult.errorMessages.push('Failed to process file');
      alert('Error during import. Please check the file format and try again.');
    }
  }

  private async processBatch(batch: any[]): Promise<void> {
    for (const contact of batch) {
      try {
        // Assuming all contacts are customers for simplicity
        // You can modify this logic based on your requirements
        await this.saveCustomer(contact);
        this.importResult.success++;
      } catch (error) {
        this.importResult.errors++;
        this.importResult.errorMessages.push(`Error processing contact: ${contact.firstName}`);
        console.error('Error processing contact:', error);
      }
    }
  }

  private async saveCustomer(contact: any): Promise<void> {
    const customerData = this.mapToCustomer(contact);
    await this.customerService.addCustomer(customerData);
  }

  private mapToCustomer(contact: any): any {
    return {
      firstName: contact.firstName || '',
      middleName: contact.middleName || '',
      lastName: contact.lastName || '',
      mobile: this.cleanPhoneNumber(contact.mobile || ''),
      landline: this.cleanPhoneNumber(contact.landline || ''),
      alternateContact: this.cleanPhoneNumber(contact.alternateContact || ''),
      email: contact.email || '',
      taxNumber: contact.taxNumber || '',
      city: contact.city || '',
      state: contact.state || '',
      country: contact.country || '',
      addressLine1: contact.addressLine1 || '',
      addressLine2: contact.addressLine2 || '',
      zipCode: contact.zipCode || '',
      gender: contact.gender || '',
      dob: contact.dob ? new Date(contact.dob) : null
    };
  }

  private async readExcelFile(file: File): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        resolve(jsonData);
      };
      reader.onerror = (error) => reject(error);
      reader.readAsArrayBuffer(file);
    });
  }

  private parseExcelData(data: any[]): any[] {
    return data.map(row => ({
      firstName: row['first_name'],
      middleName: row['middle_name'],
      lastName: row['last_name'],
      mobile: row['mobile'],
      landline: row['landline'],
      alternateContact: row['alternate_contact'],
      email: row['email'],
      taxNumber: row['tax_number'],
      city: row['city'],
      state: row['state'],
      country: row['country'],
      addressLine1: row['address_line1'],
      addressLine2: row['address_line2'],
      zipCode: row['zip_code'],
      gender: row['gender'],
      dob: row['dob']
    }));
  }

  downloadTemplate(): void {
    const worksheetData = [
      [
        'first_name', 'middle_name', 'last_name', 'mobile', 'landline',
        'alternate_contact', 'email', 'tax_number', 'city', 'state',
        'country', 'address_line1', 'address_line2', 'zip_code', 'gender', 'dob'
      ]
     
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Contacts');

    XLSX.writeFile(workbook, 'Contacts_Template.xlsx');
  }
}