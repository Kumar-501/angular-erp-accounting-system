import { Component, OnInit, OnDestroy } from '@angular/core';
import { ExpenseService } from '../services/expense.service';
import { SaleService } from '../services/sale.service';
import { PayrollService } from '../services/payroll.service';
import { PurchaseService } from '../services/purchase.service';
import { Subscription } from 'rxjs';
import { DatePipe } from '@angular/common';

interface ReportEntry {
  id: string;
  date: Date | string;
  category: string;
  totalAmount: number;
  entryType: 'expense' | 'income' | 'sale' | 'payroll' | 'purchase';
}

@Component({
  selector: 'app-list-report',
  templateUrl: './list-report.component.html',
  styleUrls: ['./list-report.component.scss'],
  providers: [DatePipe]
})
export class ListReportComponent implements OnInit, OnDestroy {
  entries: ReportEntry[] = [];
  filteredEntries: ReportEntry[] = [];
  sortField: string = 'date';
  sortDirection: 'asc' | 'desc' = 'desc';
  currentPage: number = 1;
  entriesPerPage: number = 10;
  totalEntries: number = 0;
  searchTerm: string = '';
  isLoading: boolean = true;

  // Make Math available to template
  Math = Math;

  private expensesSub!: Subscription;
  private salesSub!: Subscription;
  private payrollsSub!: Subscription;
  private purchasesSub!: Subscription;

  constructor(
    private expenseService: ExpenseService,
    private saleService: SaleService,
    private payrollService: PayrollService,
    private purchaseService: PurchaseService,
    private datePipe: DatePipe
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.isLoading = true;
    
    // Load expenses
    this.expensesSub = this.expenseService.getExpenses().subscribe(expenses => {
      const expenseEntries: ReportEntry[] = expenses.map(expense => ({
        id: expense.id || 'expense-' + Date.now() + '-' + Math.random(),
        date: expense.date,
        category: expense.expenseCategory || 'Expense',
        totalAmount: expense.totalAmount || 0,
        entryType: 'expense' as const
      }));

      // Load sales
      this.salesSub = this.saleService.listenForSales().subscribe(sales => {
        const saleEntries: ReportEntry[] = sales.map(sale => ({
          id: sale.id || 'sale-' + Date.now() + '-' + Math.random(),
          date: sale.saleDate,
          category: 'Sale',
          totalAmount: sale.paymentAmount || 0,
          entryType: 'sale' as const
        }));

        // Load payrolls
        this.payrollsSub = this.payrollService.getPayrollsRealTime().subscribe(payrolls => {
          const payrollEntries: ReportEntry[] = payrolls.map(payroll => ({
            id: payroll.id || 'payroll-' + Date.now() + '-' + Math.random(),
            date: payroll.monthYear,
            category: 'Payroll',
            totalAmount: payroll.totalGross || 0,
            entryType: 'payroll' as const
          }));

          // Load purchases
          this.purchasesSub = this.purchaseService.getPurchases().subscribe(purchases => {
            const purchaseEntries: ReportEntry[] = purchases.map(purchase => ({
              id: purchase.id || 'purchase-' + Date.now() + '-' + Math.random(),
              date: purchase.purchaseDate,
              category: 'Purchase',
              totalAmount: purchase.grandTotal || purchase.purchaseTotal || 0,
              entryType: 'purchase' as const
            }));

            // Combine all entries
            this.entries = [
              ...expenseEntries,
              ...saleEntries,
              ...payrollEntries,
              ...purchaseEntries
            ];

            // Sort by date
            this.entries.sort((a, b) => {
              const dateA = new Date(a.date).getTime();
              const dateB = new Date(b.date).getTime();
              return dateB - dateA;
            });

            this.filteredEntries = [...this.entries];
            this.totalEntries = this.filteredEntries.length;
            this.isLoading = false;
          });
        });
      });
    });
  }
// Add this method to your ListReportComponent class
async deleteEntry(entry: ReportEntry) {
  if (confirm('Are you sure you want to delete this entry?')) {
    try {
      this.isLoading = true;
      
      // Delete based on entry type
      switch (entry.entryType) {
        case 'expense':
          await this.expenseService.deleteExpense(entry.id);
          break;
        case 'sale':
          await this.saleService.deleteSale(entry.id);
          break;
        case 'payroll':
          await this.payrollService.deletePayroll(entry.id);
          break;
        case 'purchase':
          await this.purchaseService.deletePurchase(entry.id);
          break;
      }
      
      // Reload data after deletion
      this.loadData();
    } catch (error) {
      console.error('Error deleting entry:', error);
      this.isLoading = false;
      alert('Failed to delete entry. Please try again.');
    }
  }
}
  sortData(field: string): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }

    this.filteredEntries.sort((a, b) => {
      let valueA: any;
      let valueB: any;

      switch (this.sortField) {
        case 'date':
          valueA = new Date(a.date).getTime();
          valueB = new Date(b.date).getTime();
          break;
        case 'totalAmount':
          valueA = a.totalAmount || 0;
          valueB = b.totalAmount || 0;
          break;
        default: // category
          valueA = a.category.toLowerCase();
          valueB = b.category.toLowerCase();
      }

      if (valueA < valueB) return this.sortDirection === 'asc' ? -1 : 1;
      if (valueA > valueB) return this.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    this.currentPage = 1;
  }

  onSearch(event: any): void {
    this.searchTerm = event.target.value.toLowerCase();
    this.filteredEntries = this.entries.filter(entry => 
      entry.category.toLowerCase().includes(this.searchTerm) ||
      this.formatDate(entry.date).toLowerCase().includes(this.searchTerm)
    );
    this.totalEntries = this.filteredEntries.length;
    this.currentPage = 1;
  }

  changeEntriesPerPage(event: any): void {
    this.entriesPerPage = parseInt(event.target.value);
    this.currentPage = 1;
  }

  get paginatedEntries(): ReportEntry[] {
    const start = (this.currentPage - 1) * this.entriesPerPage;
    const end = start + this.entriesPerPage;
    return this.filteredEntries.slice(start, end);
  }

  nextPage(): void {
    if (this.currentPage * this.entriesPerPage < this.totalEntries) {
      this.currentPage++;
    }
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  getTotalAmount(): number {
    return this.filteredEntries.reduce((total, entry) => total + entry.totalAmount, 0);
  }

  formatDate(date: any): string {
    if (!date) return '';
    
    try {
      if (typeof date === 'object' && 'toDate' in date) {
        return this.datePipe.transform(date.toDate(), 'shortDate') || '';
      } else if (date instanceof Date) {
        return this.datePipe.transform(date, 'shortDate') || '';
      } else {
        return this.datePipe.transform(new Date(date), 'shortDate') || '';
      }
    } catch (e) {
      console.error('Error formatting date:', e);
      return '';
    }
  }

  ngOnDestroy(): void {
    if (this.expensesSub) this.expensesSub.unsubscribe();
    if (this.salesSub) this.salesSub.unsubscribe();
    if (this.payrollsSub) this.payrollsSub.unsubscribe();
    if (this.purchasesSub) this.purchasesSub.unsubscribe();
  }
}