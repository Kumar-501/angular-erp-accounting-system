import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-create',
  templateUrl: './create.component.html',
  styleUrls: ['./create.component.scss']
})
export class CreateComponent {
  followUpForm: FormGroup;
  customerOptions = [
    { id: 1, name: 'yyuousssope', type: 'Customer' },
    { id: 2, name: 'Another Customer', type: 'Customer' },
    { id: 3, name: 'Business Client', type: 'Business' }
  ];
  invoiceOptions = [
    { id: 1, number: 'INV-001', amount: 100, date: '2023-01-01' },
    { id: 2, number: 'INV-002', amount: 200, date: '2023-01-02' },
    { id: 3, number: 'INV-003', amount: 300, date: '2023-01-03' }
  ];
  assigneeOptions = ['Aijun'];
  statusOptions = ['Please Select', 'Pending', 'Completed', 'In Progress'];
  followUpTypeOptions = ['Please Select', 'Call', 'Email', 'Meeting', 'Payment Followup'];
  paymentStatusOptions = ['All', 'Due', 'Partial', 'Overdue'];
  orderOptions = ['Has transactions', 'Has no transactions'];
  followUpCategories = ['Please Select', 'Customers', 'Invoices'];
  showCustomerSelection = false;
  showInvoiceSelection = false;

  constructor(private fb: FormBuilder) {
    this.followUpForm = this.fb.group({
      // Container 1 - Followup Category
      category: ['Please Select'],
      selectedCustomers: [[]],
      selectedInvoices: [[]],
      
      // Container 2 - Customer Assignment
      assignTo: [''],
      paymentStatus: ['All'],
      orders: ['Has transactions'],
      contactName: [''],
      days: [''],
      
      // Container 3 - Followup Details
      title: ['', Validators.required],
      status: ['Please Select'],
      startDatetime: ['', Validators.required],
      endDatetime: ['', Validators.required],
      description: [''],
      followUpType: ['Please Select', Validators.required],
      sendNotification: [false]
    });

    // Watch for category changes
    this.followUpForm.get('category')?.valueChanges.subscribe(value => {
      this.showCustomerSelection = value === 'Customers';
      this.showInvoiceSelection = value === 'Invoices';
    });
  }

  isCustomerSelected(customer: any): boolean {
    const selectedCustomers = this.followUpForm.get('selectedCustomers')?.value || [];
    return selectedCustomers.some((c: any) => c.id === customer.id);
  }

  isInvoiceSelected(invoice: any): boolean {
    const selectedInvoices = this.followUpForm.get('selectedInvoices')?.value || [];
    return selectedInvoices.some((i: any) => i.id === invoice.id);
  }

  toggleCustomerSelection(customer: any) {
    const selected = this.followUpForm.get('selectedCustomers')?.value;
    const index = selected.findIndex((c: any) => c.id === customer.id);
    
    if (index >= 0) {
      selected.splice(index, 1);
    } else {
      selected.push(customer);
    }
    this.followUpForm.get('selectedCustomers')?.setValue([...selected]);
  }

  toggleInvoiceSelection(invoice: any) {
    const selected = this.followUpForm.get('selectedInvoices')?.value;
    const index = selected.findIndex((i: any) => i.id === invoice.id);
    
    if (index >= 0) {
      selected.splice(index, 1);
    } else {
      selected.push(invoice);
    }
    this.followUpForm.get('selectedInvoices')?.setValue([...selected]);
  }

  toggleSelectAllCustomers(selectAll: boolean) {
    const selectedCustomers = selectAll ? [...this.customerOptions] : [];
    this.followUpForm.get('selectedCustomers')?.setValue(selectedCustomers);
  }

  toggleSelectAllInvoices(selectAll: boolean) {
    const selectedInvoices = selectAll ? [...this.invoiceOptions] : [];
    this.followUpForm.get('selectedInvoices')?.setValue(selectedInvoices);
  }

  onSubmit() {
    if (this.followUpForm.valid) {
      console.log('Form submitted:', this.followUpForm.value);
      // Add your save logic here
    } else {
      console.log('Form is invalid');
    }
  }
}