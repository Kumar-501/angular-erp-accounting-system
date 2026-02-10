import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { SaleService } from '../services/sale.service';
import { PurchaseService } from '../services/purchase.service';
import { ExpenseService } from '../services/expense.service';
import { JournalService } from '../services/journal.service';
import { Timestamp } from '@angular/fire/firestore';

interface GstBreakdown {
  source: string;
  amount: number;
  reference: string;
  date: Date;
}

@Component({
  selector: 'app-gst-summary',
  templateUrl: './gst-summary.component.html',
  styleUrls: ['./gst-summary.component.scss']
})
export class GstSummaryComponent implements OnInit {
  filterForm!: FormGroup;
  isLoading = false;

  // Summary totals
  @ViewChild('startDatePicker') startDatePicker!: ElementRef;
@ViewChild('endDatePicker') endDatePicker!: ElementRef;

  totalPayable = 0;
  totalReceivable = 0;
  netGst = 0;

  // Detailed breakdown arrays
  payableBreakdown: GstBreakdown[] = [];
  receivableBreakdown: GstBreakdown[] = [];

  constructor(
    private fb: FormBuilder,
    private saleService: SaleService,
    private purchaseService: PurchaseService,
    private expenseService: ExpenseService,
    private journalService: JournalService
  ) {}

  ngOnInit(): void {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

    this.filterForm = this.fb.group({
      startDate: [firstDay, Validators.required],
      endDate: [lastDay, Validators.required]
    });

    this.generateSummary();
  }

  private convertToDate(dateValue: any): Date {
    if (!dateValue) return new Date();
    if (dateValue.toDate && typeof dateValue.toDate === 'function') return dateValue.toDate();
    if (dateValue instanceof Date) return dateValue;
    const parsedDate = new Date(dateValue);
    if (!isNaN(parsedDate.getTime())) return parsedDate;
    console.warn('Could not convert value to a valid date:', dateValue);
    return new Date();
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
openDatePicker(type: 'start' | 'end'): void {
  if (type === 'start') {
    this.startDatePicker.nativeElement.showPicker();
  } else {
    this.endDatePicker.nativeElement.showPicker();
  }
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
      
      const formattedDate = `${year}-${month}-${day}`; // Internal ISO string
      this.filterForm.get(controlName)?.setValue(formattedDate);
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
  event.target.value = this.getFormattedDateForInput(this.filterForm.get(controlName)?.value);
}
  async generateSummary(): Promise<void> {
    if (this.filterForm.invalid) {
      alert('Please select a valid date range.');
      return;
    }
    this.isLoading = true;

    this.totalPayable = 0;
    this.totalReceivable = 0;
    this.payableBreakdown = [];
    this.receivableBreakdown = [];

    const { startDate, endDate } = this.filterForm.value;
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    try {
      const [sales, purchases, expenses, incomes, journalTransactions] = await Promise.all([
        this.saleService.getSalesByDateRange(start, end),
        this.purchaseService.getPurchasesByDateRange(start, end),
        this.expenseService.getExpensesByDateRange(start, end),
        this.expenseService.getIncomesByDateRange(start, end),
        this.journalService.getTransactionsByDateRange(start, end)
      ]);

      // --- Process Sales, Purchases, Expenses, Incomes (Existing Logic) ---
      sales.forEach(sale => {
        const tax = sale['totalTax'] || sale['orderTax'] || 0;
        if (tax > 0) {
          this.totalPayable += tax;
          this.payableBreakdown.push({ source: 'Sales', amount: tax, reference: sale['invoiceNo'], date: this.convertToDate(sale['saleDate']) });
        }
      });
      incomes.forEach(income => {
        const tax = income.taxAmount || 0;
        if (tax > 0) {
          this.totalPayable += tax;
          this.payableBreakdown.push({ source: 'Income', amount: tax, reference: income.referenceNo, date: this.convertToDate(income.date) });
        }
      });
      purchases.forEach(purchase => {
        const tax = purchase['totalTax'] || purchase['purchaseTax'] || 0;
        if (tax > 0) {
          this.totalReceivable += tax;
          this.receivableBreakdown.push({ source: 'Purchases', amount: tax, reference: purchase['referenceNo'], date: this.convertToDate(purchase['purchaseDate']) });
        }
      });
      expenses.forEach(expense => {
        const tax = expense.taxAmount || 0;
        if (tax > 0) {
          this.totalReceivable += tax;
          this.receivableBreakdown.push({ source: 'Expenses', amount: tax, reference: expense.referenceNo, date: this.convertToDate(expense.date) });
        }
      });
      
      // --- DIAGNOSTIC LOGGING FOR JOURNAL ENTRIES ---
      console.log('--- Journal Transactions Fetched for GST Summary ---');
      console.log(`Found ${journalTransactions.length} journal transactions in this period.`);
      console.table(journalTransactions); // This will display the data in a clean table in your console.
      console.log('----------------------------------------------------');

      journalTransactions.forEach(trans => {
        const type = trans['type'];
        const credit = trans['credit'] || 0;
        const debit = trans['debit'] || 0;

        if (type === 'output_tax' && credit > 0) {
            console.log('Found Journal Tax Payable (Output GST):', trans);
            this.totalPayable += credit;
            this.payableBreakdown.push({ source: 'Journal (Tax Payable)', amount: credit, reference: trans['referenceNo'], date: this.convertToDate(trans['date']) });
        }
        if (type === 'input_tax' && debit > 0) {
            console.log('Found Journal Tax Receivable (Input GST):', trans);
            this.totalReceivable += debit;
            this.receivableBreakdown.push({ source: 'Journal (Tax Receivable)', amount: debit, reference: trans['referenceNo'], date: this.convertToDate(trans['date']) });
        }
      });

      this.netGst = this.totalPayable - this.totalReceivable;

    } catch (error) {
      console.error("Error generating GST summary:", error);
    } finally {
      this.isLoading = false;
    }
  }
}