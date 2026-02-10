// src/app/income-receipts/income-receipts.component.ts

import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { Timestamp } from '@angular/fire/firestore';
import { AccountService } from '../services/account.service';
import { Receipt, ReceiptService } from '../services/receipt.service';
import { CustomerService } from '../services/customer.service';
import { ExpenseCategoriesService } from '../services/expense-categories.service';
import { TaxService } from '../services/tax.service';
import { TaxRate } from '../tax/tax.model';

@Component({
  selector: 'app-income-receipts',
  templateUrl: './income-receipts.component.html',
  styleUrls: ['./income-receipts.component.scss']
})
export class IncomeReceiptsComponent implements OnInit {
  receiptForm!: FormGroup;
  receipts: Receipt[] = [];
  
  accounts: any[] = [];
  customers: any[] = [];
  incomeCategories: any[] = [];
  expenseCategories: any[] = [];
  taxRates: TaxRate[] = [];

  showModal = false;
  isEditMode = false;
  currentReceiptId: string | null = null;
  isSaving = false;

  showViewModal = false;
  selectedReceiptForView: Receipt | null = null;
  
  totalReceiptsAmount = 0;
  thisMonthCount = 0;
  pendingCount = 0;
  
  totalDebits = 0;
  totalCredits = 0;

  constructor(
    private fb: FormBuilder,
    private receiptService: ReceiptService,
    private accountService: AccountService,
    private customerService: CustomerService,
    private expenseCatService: ExpenseCategoriesService,
    private taxService: TaxService
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadReceipts();
    this.loadAccounts();
    this.loadCustomers();
    this.loadCategories();
    this.loadTaxRates();
  }

  initForm(): void {
    this.receiptForm = this.fb.group({
      date: [new Date().toISOString().split('T')[0], Validators.required],
      referenceNo: [{ value: '', disabled: true }, Validators.required],
      description: ['', Validators.required],
      status: ['Posted', Validators.required],
      attachment: this.fb.group({
        name: [''],
        type: [''],
        data: ['']
      }),
      items: this.fb.array([], [Validators.required, Validators.minLength(2)])
    });

    this.receiptForm.get('items')?.valueChanges.subscribe(() => {
      this.calculateTotals();
    });
  }
  
  loadReceipts(): void {
    this.receiptService.getReceipts().subscribe(data => {
      this.receipts = data;
      this.calculateSummaryData();
    });
  }

  loadAccounts(): void {
      this.accountService.getAccounts(accounts => {
          this.accounts = accounts.sort((a,b) => a.name.localeCompare(b.name));
      });
  }
  
  loadCustomers(): void {
    this.customerService.getCustomers().subscribe(data => this.customers = data);
  }

  loadCategories(): void {
    this.expenseCatService.getIncomeCategories().subscribe(cats => {
        this.incomeCategories = cats.sort((a, b) => a.categoryName.localeCompare(b.categoryName));
    });
    this.expenseCatService.getExpenseCategories().subscribe(cats => {
        this.expenseCategories = cats.sort((a, b) => a.categoryName.localeCompare(b.categoryName));
    });
  }

  loadTaxRates(): void {
      this.taxService.getTaxRates().subscribe(rates => {
          this.taxRates = rates.sort((a, b) => a.name.localeCompare(b.name));
      });
  }
  
  calculateSummaryData(): void {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    this.totalReceiptsAmount = this.receipts.reduce((sum, r) => sum + r.totalAmount, 0);
    this.thisMonthCount = this.receipts.filter(r => {
        const receiptDate = r.date.toDate();
        return receiptDate.getMonth() === currentMonth && receiptDate.getFullYear() === currentYear;
    }).length;
    this.pendingCount = this.receipts.filter(r => r.status === 'Pending').length;
  }

  get items(): FormArray {
    return this.receiptForm.get('items') as FormArray;
  }

  // UPDATED: Added 'accountHead' form control
  createItem(): FormGroup {
    return this.fb.group({
      accountId: ['', Validators.required],
      accountName: [''],
      accountType: ['', Validators.required],
      accountHead: [''], // ADDED: To hold account head info in the form
      debit: [0, [Validators.required, Validators.min(0)]],
      credit: [0, [Validators.required, Validators.min(0)]]
    });
  }

  addItem(): void {
    this.items.push(this.createItem());
  }

  removeItem(index: number): void {
    if (this.items.length > 2) {
        this.items.removeAt(index);
    } else {
        alert("A receipt must have at least two line items.");
    }
  }

  // UPDATED: Now patches the 'accountHead' value when a category is selected
  onAccountSelect(index: number): void {
      const accountId = this.items.at(index).get('accountId')?.value;
      let selectedItem: { name: string, type: string, head?: string } | undefined;

      const account = this.accounts.find(acc => acc.id === accountId);
      if (account) selectedItem = { name: account.name, type: 'account' };
      
      const incomeCat = this.incomeCategories.find(cat => cat.id === accountId);
      if (!selectedItem && incomeCat) selectedItem = { name: incomeCat.categoryName, type: 'income_category', head: incomeCat.accountHead };

      const expenseCat = this.expenseCategories.find(cat => cat.id === accountId);
      if (!selectedItem && expenseCat) selectedItem = { name: expenseCat.categoryName, type: 'expense_category', head: expenseCat.accountHead };

      const taxRate = this.taxRates.find(tax => tax.id === accountId);
      if (!selectedItem && taxRate) selectedItem = { name: `${taxRate.name} (${taxRate.rate}%)`, type: 'tax_rate' };

      if(selectedItem) {
          this.items.at(index).patchValue({
            accountName: selectedItem.name,
            accountType: selectedItem.type,
            accountHead: selectedItem.head || null 
          });
      }
  }

  onFileSelect(event: Event): void {
    const element = event.currentTarget as HTMLInputElement;
    const fileList: FileList | null = element.files;
    if (fileList && fileList.length > 0) {
      const file = fileList[0];
      const reader = new FileReader();
      reader.onload = () => {
        this.receiptForm.patchValue({
          attachment: {
            name: file.name,
            type: file.type,
            data: reader.result as string
          }
        });
      };
      reader.readAsDataURL(file);
    }
  }

  calculateTotals(): void {
    this.totalDebits = this.items.controls.reduce((sum, control) => sum + (Number(control.get('debit')?.value) || 0), 0);
    this.totalCredits = this.items.controls.reduce((sum, control) => sum + (Number(control.get('credit')?.value) || 0), 0);
  }
  
  get difference(): number {
    return this.totalDebits - this.totalCredits;
  }

  async openModal(receipt?: Receipt): Promise<void> {
    this.initForm();
    if (receipt) {
        this.isEditMode = true;
        this.currentReceiptId = receipt.id!;
        
        this.receiptForm.patchValue({
          date: receipt.date.toDate().toISOString().split('T')[0],
          referenceNo: receipt.referenceNo,
          description: receipt.description,
          status: receipt.status,
          attachment: receipt.attachment || { name: '', type: '', data: '' }
        });

        receipt.items.forEach(() => this.addItem());
        this.items.patchValue(receipt.items);

    } else {
        this.isEditMode = false;
        this.currentReceiptId = null;
        this.addItem();
        this.addItem();
        const newRef = await this.receiptService.getNewReferenceNumber();
        this.receiptForm.get('referenceNo')?.setValue(newRef);
    }
    this.showModal = true;
    this.calculateTotals();
  }

  openViewModal(receipt: Receipt): void {
    this.selectedReceiptForView = receipt;
    this.showViewModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.isEditMode = false;
    this.currentReceiptId = null;
    this.showViewModal = false;
    this.selectedReceiptForView = null;
  }

  async saveReceipt(): Promise<void> {
    this.receiptForm.markAllAsTouched();
    if (this.receiptForm.invalid) {
      alert("Please fill all required fields.");
      return;
    }
    if (this.difference !== 0) {
      alert("Total Debits must equal Total Credits. Please balance the entry.");
      return;
    }
    if (this.isSaving) return;
    this.isSaving = true;

    const formValue = this.receiptForm.getRawValue();
    const receiptData: any = {
        date: Timestamp.fromDate(new Date(formValue.date)),
        referenceNo: formValue.referenceNo,
        description: formValue.description,
        status: formValue.status,
        items: formValue.items,
        totalAmount: this.totalDebits,
        attachment: formValue.attachment
    };
    
    if (!receiptData.attachment?.data) {
        delete receiptData.attachment;
    }
    
    try {
        if (this.isEditMode && this.currentReceiptId) {
            await this.receiptService.updateReceipt(this.currentReceiptId, receiptData);
            alert('Receipt updated successfully!');
        } else {
            await this.receiptService.addReceipt(receiptData);
            alert('Receipt saved successfully!');
        }
        this.loadReceipts();
        this.closeModal();
    } catch (error) {
        console.error('Error saving receipt:', error);
        alert('Failed to save receipt.');
    } finally {
        this.isSaving = false;
    }
  }

  async deleteReceipt(receiptId?: string): Promise<void> {
    if (receiptId && confirm('Are you sure you want to delete this receipt?')) {
        await this.receiptService.deleteReceipt(receiptId);
        alert('Receipt deleted!');
        this.loadReceipts();
    }
  }

  downloadAttachment(receipt: Receipt): void {
    if (!receipt.attachment?.data) return;
    fetch(receipt.attachment.data)
      .then(res => res.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = receipt.attachment?.name || 'attachment';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      });
  }
}