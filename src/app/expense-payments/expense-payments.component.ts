import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { Timestamp } from '@angular/fire/firestore';
import { AccountService } from '../services/account.service';
import { Payment, PayService } from '../services/pay.service';
import { ExpenseCategoriesService } from '../services/expense-categories.service';
import { TaxService } from '../services/tax.service';
import { TaxRate } from '../tax/tax.model';

@Component({
  selector: 'app-expense-payments',
  templateUrl: './expense-payments.component.html',
  styleUrls: ['./expense-payments.component.scss']
})
export class ExpensePaymentsComponent implements OnInit {
  paymentForm!: FormGroup;
  payments: Payment[] = [];
  
  accounts: any[] = [];
  incomeCategories: any[] = [];
  expenseCategories: any[] = [];
  taxRates: TaxRate[] = [];

  showModal = false;
  isEditMode = false;
  currentPaymentId: string | null = null;
  isSaving = false;
  showViewModal = false;
  selectedPaymentForView: Payment | null = null;
  
  totalPaymentsAmount = 0;
  thisMonthCount = 0;
  pendingCount = 0;

  totalDebits = 0;
  totalCredits = 0;

  isLoadingDropdowns = true;
  private dataSourcesLoaded = 0;

  constructor(
    private fb: FormBuilder,
    private payService: PayService,
    private accountService: AccountService,
    private expenseCatService: ExpenseCategoriesService,
    private taxService: TaxService
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadDropdownData();
    this.loadPayments();
  }

  loadDropdownData(): void {
    this.isLoadingDropdowns = true;
    this.dataSourcesLoaded = 0;
    
    this.loadAccounts();
    this.loadCategories();
    this.loadTaxRates();
  }
  
  private checkAllDataSourcesLoaded(): void {
    this.dataSourcesLoaded++;
    if (this.dataSourcesLoaded >= 4) {
      this.isLoadingDropdowns = false;
    }
  }

  initForm(): void {
    this.paymentForm = this.fb.group({
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
    this.paymentForm.get('items')?.valueChanges.subscribe(() => this.calculateTotals());
  }
  
  loadPayments(): void {
    this.payService.getPayments().subscribe(data => {
      this.payments = data;
      this.calculateSummaryData();
    });
  }

  loadAccounts(): void {
    this.accountService.getAccounts(accounts => {
        this.accounts = accounts.sort((a,b) => a.name.localeCompare(b.name));
        this.checkAllDataSourcesLoaded();
    });
  }

  loadCategories(): void {
    this.expenseCatService.getIncomeCategories().subscribe(cats => {
        this.incomeCategories = cats.sort((a, b) => a.categoryName.localeCompare(b.categoryName));
        this.checkAllDataSourcesLoaded();
    });
    this.expenseCatService.getExpenseCategories().subscribe(cats => {
        this.expenseCategories = cats.sort((a, b) => a.categoryName.localeCompare(b.categoryName));
        this.checkAllDataSourcesLoaded();
    });
  }

  loadTaxRates(): void {
      this.taxService.getTaxRates().subscribe(rates => {
          this.taxRates = rates.sort((a, b) => a.name.localeCompare(b.name));
          this.checkAllDataSourcesLoaded();
      });
  }
  
  calculateSummaryData(): void {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    this.totalPaymentsAmount = this.payments.reduce((sum, p) => sum + p.totalAmount, 0);
    this.thisMonthCount = this.payments.filter(p => {
        const paymentDate = p.date.toDate();
        return paymentDate.getMonth() === currentMonth && paymentDate.getFullYear() === currentYear;
    }).length;
    this.pendingCount = this.payments.filter(p => p.status === 'Pending').length;
  }

  get items(): FormArray {
    return this.paymentForm.get('items') as FormArray;
  }

  createItem(): FormGroup {
    return this.fb.group({
      accountId: ['', Validators.required],
      accountName: [''],
      accountType: ['', Validators.required],
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
        alert("A payment must have at least two entries.");
    }
  }

  onAccountSelect(index: number): void {
      const accountId = this.items.at(index).get('accountId')?.value;
      let selectedItem: { name: string, type: string } | undefined;

      const account = this.accounts.find(acc => acc.id === accountId);
      if (account) selectedItem = { name: account.name, type: 'account' };
      
      const incomeCat = this.incomeCategories.find(cat => cat.id === accountId);
      if (!selectedItem && incomeCat) selectedItem = { name: incomeCat.categoryName, type: 'income_category' };

      const expenseCat = this.expenseCategories.find(cat => cat.id === accountId);
      if (!selectedItem && expenseCat) selectedItem = { name: expenseCat.categoryName, type: 'expense_category' };

      const taxRate = this.taxRates.find(tax => tax.id === accountId);
      if (!selectedItem && taxRate) selectedItem = { name: `${taxRate.name} (${taxRate.rate}%)`, type: 'tax_rate' };

      if(selectedItem) {
          this.items.at(index).patchValue({
            accountName: selectedItem.name,
            accountType: selectedItem.type
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
        this.paymentForm.patchValue({
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

  async openModal(payment?: Payment): Promise<void> {
    this.initForm();
    
    if (payment) {
        this.isEditMode = true;
        this.currentPaymentId = payment.id!;
        
        payment.items.forEach(() => this.addItem());

        this.paymentForm.patchValue({
          date: payment.date.toDate().toISOString().split('T')[0],
          referenceNo: payment.referenceNo,
          description: payment.description,
          status: payment.status,
          attachment: payment.attachment || { name: '', type: '', data: '' },
          items: payment.items
        });
    } else {
        this.isEditMode = false;
        this.currentPaymentId = null;
        this.addItem();
        this.addItem();
        const newRef = await this.payService.getNewReferenceNumber();
        this.paymentForm.get('referenceNo')?.setValue(newRef);
    }
    this.showModal = true;
    this.calculateTotals();
  }

  openViewModal(payment: Payment): void {
    this.selectedPaymentForView = payment;
    this.showViewModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.showViewModal = false;
    this.selectedPaymentForView = null;
  }

  async savePayment(): Promise<void> {
    this.paymentForm.markAllAsTouched();
    if (this.paymentForm.invalid) {
      alert("Please fill all required fields.");
      return;
    }
    if (this.difference !== 0) {
      alert("Total Debits must equal Total Credits. Please balance the entry.");
      return;
    }
    if (this.isSaving) return;

    this.isSaving = true;
    this.paymentForm.disable();

    try {
        const formValue = this.paymentForm.getRawValue();
        const paymentData: any = {
            date: Timestamp.fromDate(new Date(formValue.date)),
            referenceNo: formValue.referenceNo,
            description: formValue.description,
            status: formValue.status,
            items: formValue.items,
            totalAmount: this.totalDebits,
            attachment: formValue.attachment
        };

        if (!paymentData.attachment?.data) {
          delete paymentData.attachment;
        }
      
        if (this.isEditMode && this.currentPaymentId) {
          await this.payService.updatePayment(this.currentPaymentId, paymentData);
          alert('Payment updated successfully!');
        } else {
          await this.payService.addPayment(paymentData as Omit<Payment, 'id' | 'createdAt'>);
          alert('Payment saved successfully!');
        }
        this.loadPayments();
        this.closeModal();
    } catch (error) {
        console.error('Error saving payment:', error);
        alert('Failed to save payment.');
    } finally {
        if (this.showModal) {
            this.paymentForm.enable();
            this.paymentForm.get('referenceNo')?.disable();
        }
        this.isSaving = false;
    }
  }

  async deletePayment(paymentId?: string): Promise<void> {
    if (paymentId && confirm('Are you sure you want to delete this payment? This action cannot be undone.')) {
        await this.payService.deletePayment(paymentId);
        alert('Payment deleted!');
        this.loadPayments();
    }
  }

  downloadAttachment(payment: Payment): void {
    if (!payment.attachment?.data) return;
  
    fetch(payment.attachment.data)
      .then(res => res.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = payment.attachment?.name || 'attachment';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      })
      .catch(error => console.error("Error downloading attachment:", error));
  }

  // ADDED: trackBy function to stabilize the rendering of the FormArray
  trackByFn(index: number, item: any): any {
    return index; // or item.id if you have a unique id for each row
  }
}