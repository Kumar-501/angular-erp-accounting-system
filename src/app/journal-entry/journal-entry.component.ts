import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { Timestamp } from '@angular/fire/firestore';
import { Journal, JournalService, JournalItem, JournalAttachment } from '../services/journal.service';
import { AccountService } from '../services/account.service';
import { ExpenseCategoriesService } from '../services/expense-categories.service';
import { TaxService } from '../services/tax.service';
import { TaxRate } from '../tax/tax.model';

@Component({
  selector: 'app-journal-entry',
  templateUrl: './journal-entry.component.html',
  styleUrls: ['./journal-entry.component.scss']
})
export class JournalEntryComponent implements OnInit {
  journalForm!: FormGroup;
  journals: Journal[] = [];
  
  @ViewChild('datePicker') datePicker!: ElementRef;

  accounts: any[] = [];
  incomeCategories: any[] = [];
  expenseCategories: any[] = [];
  taxRates: TaxRate[] = [];

  showModal = false;
  isEditMode = false;
  currentJournalId: string | null = null;
  isSaving = false;
  
  showViewModal = false;
  selectedJournalForView: Journal | null = null;
  
  totalDebits = 0;
  totalCredits = 0;

  constructor(
    private fb: FormBuilder,
    private journalService: JournalService,
    private accountService: AccountService,
    private expenseCatService: ExpenseCategoriesService,
    private taxService: TaxService
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadJournals();
    this.loadAccounts();
    this.loadCategories();
    this.loadTaxRates();
  }

  initForm(): void {
    this.journalForm = this.fb.group({
      date: [new Date().toISOString().split('T')[0], Validators.required],
      reference: [{ value: '', disabled: true }, Validators.required],
      description: ['', Validators.required],
      isCapitalTransaction: [false],
      attachment: this.fb.group({
        name: [''],
        type: [''],
        data: ['']
      }),
      items: this.fb.array([], [Validators.required, Validators.minLength(2)])
    });

    this.journalForm.get('items')?.valueChanges.subscribe(() => {
      this.calculateTotals();
    });
  }

  get items(): FormArray {
    return this.journalForm.get('items') as FormArray;
  }

  createItem(): FormGroup {
    return this.fb.group({
      accountId: ['', Validators.required],
      accountName: [''],
      accountType: ['', Validators.required],
      accountHead: [''],
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
        alert("A journal entry must have at least two line items.");
    }
  }
  
  loadJournals(): void {
    this.journalService.getJournals().subscribe((data: Journal[]) => {
      this.journals = data.sort((a: Journal, b: Journal) => b.createdAt.toMillis() - a.createdAt.toMillis());
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

// 3. Handle manual typing in DD-MM-YYYY format
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
      this.journalForm.get(controlName)?.setValue(formattedDate);
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
  event.target.value = this.getFormattedDateForInput(this.journalForm.get(controlName)?.value);
}
  loadAccounts(): void {
    this.accountService.getAccounts(accounts => {
        this.accounts = accounts.sort((a,b) => a.name.localeCompare(b.name));
    });
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
      reader.onload = () => this.journalForm.patchValue({ attachment: { name: file.name, type: file.type, data: reader.result as string } });
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

  // FIXED: Check if the journal is balanced properly for capital transactions
  get isBalanced(): boolean {
    const isCapital = this.journalForm.get('isCapitalTransaction')?.value;
    if (isCapital) {
      // For capital transactions, allow imbalanced entries
      return true;
    }
    // For regular transactions, require balanced entries
    return this.difference === 0;
  }

  async openModal(journal?: Journal): Promise<void> {
    this.initForm();

    if (journal) {
      this.isEditMode = true;
      this.currentJournalId = journal.id!;
      
      journal.items.forEach(() => this.addItem());

      this.journalForm.patchValue({
        date: (journal.date.toDate()).toISOString().split('T')[0],
        reference: journal.reference,
        description: journal.description,
        isCapitalTransaction: journal.isCapitalTransaction || false,
        attachment: journal.attachment || { name: '', type: '', data: '' },
        items: journal.items
      });

    } else {
      this.isEditMode = false;
      this.currentJournalId = null;
      this.addItem();
      this.addItem();
      const newRef = await this.journalService.getNewReferenceNumber();
      this.journalForm.get('reference')?.setValue(newRef);
    }
    this.showModal = true;
    this.calculateTotals();
  }
  
  openViewModal(journal: Journal): void {
    this.selectedJournalForView = journal;
    this.showViewModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.showViewModal = false;
    this.selectedJournalForView = null;
  }

  async saveJournal(): Promise<void> {
    this.journalForm.markAllAsTouched();
    if (this.journalForm.invalid) {
        alert("Please fill all required fields.");
        return;
    }

    const isCapital = this.journalForm.get('isCapitalTransaction')?.value;

    // FIXED: Only check balance for non-capital transactions
    if (!isCapital && this.difference !== 0) {
        alert("Total debits must equal total credits.");
        return;
    }

    if (this.isSaving) return;

    this.isSaving = true;
    this.journalForm.disable();

    try {
        const formValue = this.journalForm.getRawValue();
        
        // FIXED: Don't modify the items for capital transactions - keep them as entered
        const journalData: any = {
          date: Timestamp.fromDate(new Date(formValue.date)),
          reference: formValue.reference,
          description: formValue.description,
          isCapitalTransaction: formValue.isCapitalTransaction,
          items: formValue.items, // Keep original items without modification
          totalAmount: isCapital ? (this.totalDebits + this.totalCredits) : this.totalDebits, // FIXED: For capital transactions, use total of both sides
          attachment: formValue.attachment
        };

        if (!journalData.attachment?.data) {
          delete journalData.attachment;
        }

        if (this.isEditMode && this.currentJournalId) {
          await this.journalService.updateJournal(this.currentJournalId, journalData);
          alert('Journal updated successfully!');
        } else {
          await this.journalService.addJournal(journalData as Omit<Journal, 'id' | 'createdAt' | 'updatedAt'>);
          alert('Journal created successfully!');
        }
        
        this.loadJournals();
        this.closeModal();

    } catch (error) {
        console.error("Error saving journal:", error);
        alert("Failed to save journal. See console for details.");
    } finally {
        if (this.showModal) {
            this.journalForm.enable();
            this.journalForm.get('reference')?.disable();
        }
        this.isSaving = false;
    }
  }
  

  async deleteJournal(journalId?: string): Promise<void> {
    if (journalId && confirm('Are you sure you want to delete this journal entry? This action cannot be undone.')) {
        try {
            await this.journalService.deleteJournal(journalId);
            alert('Journal deleted successfully!');
            this.loadJournals();
        } catch (error) {
            console.error("Error deleting journal:", error);
            alert("Failed to delete journal.");
        }
    }
  }
// Add these two new methods inside the JournalEntryComponent class

  getTotalDebit(items: JournalItem[]): number {
    if (!items) return 0;
    return items.reduce((sum, item) => sum + (item.debit || 0), 0);
  }

  getTotalCredit(items: JournalItem[]): number {
    if (!items) return 0;
    return items.reduce((sum, item) => sum + (item.credit || 0), 0);
  }
  downloadAttachment(journal: Journal): void {
    if (!journal.attachment?.data) return;
  
    fetch(journal.attachment.data)
      .then(res => res.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = journal.attachment?.name || 'attachment';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      })
      .catch(error => console.error("Error downloading attachment:", error));
  }
}