import { Component, OnInit } from '@angular/core';
import { ExpenseService } from '../services/expense.service';

export interface CombinedEntry {
  date: Date | string;
  referenceNo?: string;
  entryType?: string;
  categoryName?: string;
  businessLocationName?: string;
  totalAmount?: number;
  taxAmount?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  paymentMethod?: string;
  paymentStatus?: 'Paid' | 'Partial' | 'Unpaid' | string;
}

@Component({
  selector: 'app-expense-orders',
  templateUrl: './expense-orders.component.html',
  styleUrls: ['./expense-orders.component.scss']
})
export class ExpenseOrdersComponent implements OnInit {
  expenses: CombinedEntry[] = [];
  isLoading: boolean = true;
  currentPage: number = 1;
  entriesPerPage: number = 10;
  searchTerm: string = '';

  constructor(private expenseService: ExpenseService) {}

  ngOnInit(): void {
    this.loadExpenseOrders();
  }

  loadExpenseOrders(): void {
    this.isLoading = true;
    this.expenseService.getExpenses().subscribe((expenses: any[]) => {
      this.expenses = expenses.map(expense => {
        // Calculate CGST and SGST as half of taxAmount if they're not provided
        const taxAmount = expense.taxAmount || 0;
        const cgstAmount = expense.cgstAmount || (taxAmount / 2);
        const sgstAmount = expense.sgstAmount || (taxAmount / 2);
        
        return {
          date: expense.date,
          referenceNo: expense.referenceNo,
          entryType: expense.entryType || 'expense',
          categoryName: expense.categoryName || '-',
          businessLocationName: expense.businessLocationName || '-',
          totalAmount: expense.totalAmount || 0,
          taxAmount: taxAmount,
          cgstAmount: cgstAmount,
          sgstAmount: sgstAmount,
          igstAmount: expense.igstAmount || 0,
          paymentMethod: expense.paymentMethod || '-',
          paymentStatus: expense.paymentStatus || '-'
        };
      });
      this.isLoading = false;
    });
  }

  getEntryTypeDisplay(entryType?: string): string {
    if (!entryType) return '-';
    
    const entryTypeMap: { [key: string]: string } = {
      'expense': 'Expense',
      'purchase': 'Purchase',
      'bill': 'Bill',
      'payment': 'Payment',
      'refund': 'Refund'
    };
    
    return entryTypeMap[entryType.toLowerCase()] || entryType;
  }

  get filteredExpenses(): CombinedEntry[] {
    return this.expenses.filter(expense => 
      (expense.referenceNo?.toLowerCase().includes(this.searchTerm.toLowerCase())) ||
      (expense.paymentMethod?.toLowerCase().includes(this.searchTerm.toLowerCase())) ||
      (expense.businessLocationName?.toLowerCase().includes(this.searchTerm.toLowerCase())) ||
      (expense.categoryName?.toLowerCase().includes(this.searchTerm.toLowerCase()))
    );
  }

  get paginatedExpenses(): CombinedEntry[] {
    const start = (this.currentPage - 1) * this.entriesPerPage;
    const end = start + this.entriesPerPage;
    return this.filteredExpenses.slice(start, end);
  }

  get totalPages(): number {
    return Math.ceil(this.filteredExpenses.length / this.entriesPerPage);
  }

  get startEntryNumber(): number {
    return (this.currentPage - 1) * this.entriesPerPage + 1;
  }

  get maxEntryNumber(): number {
    return Math.min(this.currentPage * this.entriesPerPage, this.filteredExpenses.length);
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    const totalPages = this.totalPages;
    const currentPage = this.currentPage;
    
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, currentPage + 2);
    
    if (endPage - startPage < 4) {
      if (startPage === 1) {
        endPage = Math.min(totalPages, startPage + 4);
      } else {
        startPage = Math.max(1, endPage - 4);
      }
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    
    return pages;
  }

  onSearch(): void {
    this.currentPage = 1;
  }

  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  getTotalAmount(): number {
    return this.filteredExpenses.reduce((total, expense) => total + (expense.totalAmount || 0), 0);
  }

  getTotalTaxAmount(): number {
    return this.filteredExpenses.reduce((total, expense) => total + (expense.taxAmount || 0), 0);
  }

  getTotalCgstAmount(): number {
    return this.filteredExpenses.reduce((total, expense) => total + (expense.cgstAmount || 0), 0);
  }

  getTotalSgstAmount(): number {
    return this.filteredExpenses.reduce((total, expense) => total + (expense.sgstAmount || 0), 0);
  }

  getTotalIgstAmount(): number {
    return this.filteredExpenses.reduce((total, expense) => total + (expense.igstAmount || 0), 0);
  }
}