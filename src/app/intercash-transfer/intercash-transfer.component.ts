// src/app/intercash-transfer/intercash-transfer.component.ts

import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { Timestamp } from '@angular/fire/firestore';
import { AccountService } from '../services/account.service';
import { IntercashService, InterCashTransfer } from '../services/intercash.service';

@Component({
  selector: 'app-intercash-transfer',
  templateUrl: './intercash-transfer.component.html',
  styleUrls: ['./intercash-transfer.component.scss']
})
export class IntercashTransferComponent implements OnInit {
  transferForm!: FormGroup;
  transfers: InterCashTransfer[] = [];
  assetAccounts: any[] = [];
  @ViewChild('datePicker') datePicker!: ElementRef;


  // State for Create/Edit Modal
  showModal = false;
  isEditMode = false;

  // NEW: State for View Details Modal
  showViewModal = false;
  selectedTransferForView: InterCashTransfer | null = null;
  
  isSubmitting = false;
  totalDebits = 0;
  totalCredits = 0;

  constructor(
    private fb: FormBuilder,
    private intercashService: IntercashService,
    private accountService: AccountService
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadTransfers();
    this.loadAssetAccounts();
  }

  initForm(): void {
    this.transferForm = this.fb.group({
      voucherNo: [{ value: '', disabled: true }, Validators.required],
      date: [new Date().toISOString().split('T')[0], Validators.required],
      narration: ['', Validators.required],
      attachment: this.fb.group({
        name: [''],
        type: [''],
        data: ['']
      }),
      debits: this.fb.array([], [Validators.required, Validators.minLength(1)]),
      credits: this.fb.array([], [Validators.required, Validators.minLength(1)])
    });
    
    this.transferForm.get('debits')?.valueChanges.subscribe(values => {
      this.totalDebits = values.reduce((sum: number, item: any) => sum + (Number(item.amount) || 0), 0);
    });
    this.transferForm.get('credits')?.valueChanges.subscribe(values => {
      this.totalCredits = values.reduce((sum: number, item: any) => sum + (Number(item.amount) || 0), 0);
    });
  }
  
  loadTransfers(): void {
    this.intercashService.getTransfers().subscribe(data => {
      this.transfers = data;
    });
  }

  loadAssetAccounts(): void {
    this.accountService.getAccounts(accounts => {
      this.assetAccounts = accounts
        .filter(acc => acc.accountHead?.group === 'Asset')
        .sort((a,b) => a.name.localeCompare(b.name));
    });
  }
getFormattedDateForInput(dateString: any): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

// 2. Trigger the hidden native picker
openDatePicker(): void {
  this.datePicker.nativeElement.showPicker();
}

// 3. Handle manual entry with validation
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
      
      const formattedDate = `${year}-${month}-${day}`; // Internal ISO format
      this.transferForm.get(controlName)?.setValue(formattedDate);
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
  event.target.value = this.getFormattedDateForInput(this.transferForm.get(controlName)?.value);
}

  async openModal(transfer?: InterCashTransfer): Promise<void> {
    this.isEditMode = !!transfer;
    this.initForm();
    this.debits.clear();
    this.credits.clear();
    if (transfer) {
      // Logic for editing
    } else {
      this.addCredit();
      this.addDebit();
      const newVoucher = await this.intercashService.getNewVoucherNumber();
      this.transferForm.get('voucherNo')?.setValue(newVoucher);
    }
    this.showModal = true;
  }
  
  // NEW: Opens the read-only details modal
  openViewModal(transfer: InterCashTransfer): void {
    this.selectedTransferForView = transfer;
    this.showViewModal = true;
  }

  // UPDATED: Now closes any open modal
  closeModal(): void {
    this.showModal = false;
    this.showViewModal = false;
    this.selectedTransferForView = null;
  }

  get debits(): FormArray { return this.transferForm.get('debits') as FormArray; }
  get credits(): FormArray { return this.transferForm.get('credits') as FormArray; }

  addDebit(): void { this.debits.push(this.createItem()); }
  removeDebit(index: number): void { if (this.debits.length > 1) this.debits.removeAt(index); }
  addCredit(): void { this.credits.push(this.createItem()); }
  removeCredit(index: number): void { if (this.credits.length > 1) this.credits.removeAt(index); }
  
  createItem(): FormGroup {
    return this.fb.group({
      accountId: ['', Validators.required],
      accountName: [''],
      amount: [null, [Validators.required, Validators.min(0.01)]]
    });
  }

  onAccountSelect(formArrayName: 'debits' | 'credits', index: number): void {
      const formArray = this.transferForm.get(formArrayName) as FormArray;
      const accountId = formArray.at(index).get('accountId')?.value;
      const account = this.assetAccounts.find(acc => acc.id === accountId);
      if(account) {
          formArray.at(index).get('accountName')?.setValue(account.name);
      }
  }

  onFileSelect(event: Event): void {
    const element = event.currentTarget as HTMLInputElement;
    const fileList: FileList | null = element.files;
    if (fileList && fileList.length > 0) {
      const file = fileList[0];
      const reader = new FileReader();
      reader.onload = () => {
        this.transferForm.patchValue({
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

  async saveTransfer(): Promise<void> {
    this.transferForm.markAllAsTouched();
    if (this.transferForm.invalid) {
      alert("Please fill all required fields.");
      return;
    }
    if (this.totalDebits !== this.totalCredits || this.totalDebits === 0) {
      alert("Total Debits must equal Total Credits, and the amount cannot be zero.");
      return;
    }

    this.isSubmitting = true;
    const formValue = this.transferForm.getRawValue();

    const transferData: Omit<InterCashTransfer, 'id' | 'createdAt'> = {
      voucherNo: formValue.voucherNo,
      date: Timestamp.fromDate(new Date(formValue.date)),
      narration: formValue.narration,
      debits: formValue.debits,
      credits: formValue.credits,
      totalAmount: this.totalDebits,
      attachment: formValue.attachment
    };

    if (!transferData.attachment?.data) {
      delete transferData.attachment;
    }

    try {
      await this.intercashService.addTransfer(transferData);
      alert('Transfer saved successfully!');
      this.loadTransfers();
      this.closeModal();
    } catch (error) {
      console.error('Error saving transfer:', error);
      alert('Failed to save transfer.');
    } finally {
      this.isSubmitting = false;
    }
  }

  async deleteTransfer(transferId?: string): Promise<void> {
    if (transferId && confirm('Are you sure you want to delete this transfer?')) {
      try {
        await this.intercashService.deleteTransfer(transferId);
        alert('Transfer deleted successfully!');
        this.loadTransfers();
      } catch (error) {
        console.error('Error deleting transfer:', error);
        alert('Failed to delete transfer.');
      }
    }
  }

  downloadAttachment(transfer: InterCashTransfer): void {
    if (!transfer.attachment?.data) return;
  
    fetch(transfer.attachment.data)
      .then(res => res.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = transfer.attachment?.name || 'attachment';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      })
      .catch(error => console.error("Error downloading attachment:", error));
  }
}