import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ExpenseService } from '../services/expense.service';
import { LocationService } from '../services/location.service';
import { ExpenseCategoriesService } from '../services/expense-categories.service';
import { SaleService } from '../services/sale.service';
import { PayrollService } from '../services/payroll.service';
import { PurchaseService } from '../services/purchase.service';
import { Expense } from '../models/expense.model';
import { firstValueFrom, Subscription } from 'rxjs';
import { Router } from '@angular/router';
import { AccountService } from '../services/account.service';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { DatePipe } from '@angular/common';

interface CombinedEntry {
  id: string;
  date: Date | string;
  referenceNo?: string;
  expenseType?: string;       
  taxAmount?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  businessLocation?: string;
  businessLocationName?: string;
  paymentAccountId?: string;
  incomeCategory?: string;
  incomeFor?: string;
  incomeForContact?: string;
  incomeNote?: string;
  expenseCategory?: string;
  categoryName?: string;
  accountHead?: string;
  expenseFor?: string;
  expenseForContact?: string;
  applicableTax?: string;
  totalAmount?: number;
  finalAmount?: number;
  expenseNote?: string;
  isRefund?: boolean;
  isRecurring?: boolean;
  recurringInterval?: string;
  repetitions?: string;
  paymentAmount?: number;
  paidOn?: Date | string;
  paymentMethod?: string;
  paymentAccount?: string;
  paymentNote?: string;
  paymentStatus?: string;
  balanceAmount?: number;
  customer?: string;
  addedBy?: string;
  addedByDisplayName?: string;
  commissionPercentage?: number;
  totalCommission?: number;
  employeeDetails?: EmployeeDetail[];
  products?: any[];
  entryType: 'expense' | 'income' | 'sale' | 'shipment' | 'payroll' | 'purchase';
  
  tax?: number;
  paymentDue?: number;
  entryFor?: string;
  category?: string;
  subCategory?: string;
  balance?: number;
  supplier?: string;
  
  [key: string]: any;
}

interface EmployeeDetail {
  email?: string;
  name: string;
  amount: number;
}

interface ExtendedExpense extends Expense {
  type?: 'expense' | 'income';
  finalAmount?: number;
  accountHead?: string;
  incomeCategory?: string;
  incomeFor?: string;
  incomeForContact?: string;
  incomeNote?: string;
  expenseType?: string;
  balanceAmount?: number;
  paymentStatus?: string;
  taxAmount: number; 
}

@Component({
  selector: 'app-list-expenses',
  templateUrl: './list-expenses.component.html',
  styleUrls: ['./list-expenses.component.scss'],
  providers: [DatePipe]
})
export class ListExpensesComponent implements OnInit, OnDestroy {
  expenses: ExtendedExpense[] = [];
  sales: any[] = [];
  shipments: any[] = [];
  payrolls: any[] = [];
  purchases: any[] = [];
  sortField: string = 'date';
  paymentAccounts: any[] = [];
  entriesPerPage: number = 10;

  sortDirection: 'asc' | 'desc' = 'desc';
  combinedEntries: CombinedEntry[] = [];
    isPayBalanceModalVisible: boolean = false;

  filteredEntries: CombinedEntry[] = [];
  businessLocations: any[] = [];
  expenseCategories: any[] = [];
  selectedEntries: Set<string> = new Set();
  allSelected: boolean = false;
  incomeCategories: any[] = [];
  
  private expensesSub!: Subscription;
  private salesSub!: Subscription;
  private shipmentsSub!: Subscription;
  private locationsSub!: Subscription;
  private categoriesSub!: Subscription;
  private payrollsSub!: Subscription;
  private purchasesSub!: Subscription;
  
  currentPage: number = 1;
  totalEntries: number = 0;
  searchTerm: string = '';
  isLoading: boolean = true;
  activeFilter: string = 'overall';
  expandedEntryId: string | null = null;
  incomesSub: Subscription = new Subscription;
  incomes: ExtendedExpense[] = [];

  selectedEntryForPayment: CombinedEntry | null = null;
  paymentForm!: FormGroup;
  isProcessingPayment: boolean = false;
  constructor(
    private expenseService: ExpenseService,
    private saleService: SaleService,
    private locationService: LocationService,
    private expenseCategoriesService: ExpenseCategoriesService,
    private payrollService: PayrollService,
    private purchaseService: PurchaseService,
    private router: Router,
    private accountService: AccountService,
    private datePipe: DatePipe,
    private fb: FormBuilder
  ) {
    this.initPaymentForm();
  }

  ngOnInit(): void {
    this.loadLocationsAndCategories();
    this.loadPaymentAccounts();
  }

  initPaymentForm(): void {
    this.paymentForm = this.fb.group({
      paymentAmount: ['', [Validators.required, Validators.min(0.01)]],
      paymentDate: [new Date().toISOString().slice(0, 16), Validators.required],
      paymentMethod: ['Cash', Validators.required],
      paymentAccount: ['', Validators.required],
      paymentNote: ['']
    });
  }

  async loadPaymentAccounts(): Promise<void> {
    try {
      this.accountService.getAccounts((accounts) => {
        this.paymentAccounts = accounts.map(account => ({
          ...account,
          balance: account.openingBalance || 0
        }));
      });
    } catch (error) {
      console.error('Error loading payment accounts:', error);
    }
  }

  // Calculate balance amount for an entry
  getBalanceAmount(entry: CombinedEntry): number {
    if (entry.entryType === 'expense' || entry.entryType === 'income') {
      const totalAmount = entry.finalAmount || entry.totalAmount || 0;
      const paidAmount = entry.paymentAmount || 0;
      return Math.max(0, totalAmount - paidAmount);
    }
    return entry.balanceAmount || entry.paymentDue || 0;
  }

  // Calculate paid amount for an entry
  getPaidAmount(entry: CombinedEntry): number {
    if (entry.entryType === 'expense' || entry.entryType === 'income') {
      return entry.paymentAmount || 0;
    }
    const totalAmount = entry.totalAmount || 0;
    const balance = entry.balanceAmount || entry.paymentDue || 0;
    return Math.max(0, totalAmount - balance);
  }

 openPayBalanceModal(entry: CombinedEntry): void {
    this.selectedEntryForPayment = entry;
    this.paymentForm.patchValue({
      paymentAmount: this.getBalanceAmount(entry),
      paymentDate: new Date().toISOString().slice(0, 16),
      paymentMethod: 'Cash',
      paymentAccount: '',
      paymentNote: ''
    });

    // --- FIX: Use the boolean flag to show the modal ---
    this.isPayBalanceModalVisible = true; 
  }

  // Process payment
  async processPayment(): Promise<void> {
    if (!this.paymentForm.valid || !this.selectedEntryForPayment || this.isProcessingPayment) {
      return;
    }

    this.isProcessingPayment = true;
    const formData = this.paymentForm.value;
    const balanceDue = this.getBalanceAmount(this.selectedEntryForPayment);
    const paymentAmount = parseFloat(formData.paymentAmount);
    
    // Client-side check for overpayment
    if (paymentAmount > balanceDue) {
      alert(`Payment amount (₹${paymentAmount.toFixed(2)}) cannot exceed the remaining balance (₹${balanceDue.toFixed(2)}).`);
      this.isProcessingPayment = false;
      return;
    }

    try {
      await this.expenseService.processPartialPayment(
        this.selectedEntryForPayment.id,
        this.selectedEntryForPayment.entryType as 'expense' | 'income',
        {
          paymentAmount: paymentAmount,
          paymentDate: formData.paymentDate,
          paymentMethod: formData.paymentMethod,
          paymentAccount: formData.paymentAccount,
          paymentNote: formData.paymentNote
        }
      );

      alert('Payment processed successfully!');
      this.closePayBalanceModal(); // This will now correctly hide the modal

    } catch (error: any) {
      console.error('Error processing payment:', error);
      alert(error.message || 'An error occurred while processing payment. Please try again.');
    } finally {
      this.isProcessingPayment = false;
    }
  }


 closePayBalanceModal(): void {
    // --- FIX: Use the boolean flag to hide the modal ---
    this.isPayBalanceModalVisible = false;

    // Reset state after hiding
    setTimeout(() => {
        this.selectedEntryForPayment = null;
        this.paymentForm.reset();
        this.initPaymentForm();
    }, 300); // A small delay for the fade-out animation if you add one
  }

  // Calculate total balance amount
  getTotalBalanceAmount(): number {
    return this.filteredEntries.reduce((total, entry) => {
      return total + this.getBalanceAmount(entry);
    }, 0);
  }

  loadLocationsAndCategories(): void {
    this.isLoading = true;
    
    this.locationsSub = this.locationService.getLocations().subscribe(locations => {
      this.businessLocations = locations;
      
      this.categoriesSub = this.expenseCategoriesService.getCategories().subscribe(categories => {
        this.expenseCategories = categories;
        this.incomeCategories = categories;
        
        this.accountService.getAccounts((accounts) => {
          this.paymentAccounts = accounts;
          this.loadExpensesAndSales();
        });
      });
    });
  }

  sortData(field: string): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }

    this.applySorting();
  }

  private applySorting(): void {
    this.filteredEntries.sort((a, b) => {
      let valueA: any;
      let valueB: any;

      switch (this.sortField) {
        case 'date':
        case 'paidOn':
          valueA = new Date(a[this.sortField] as string).getTime();
          valueB = new Date(b[this.sortField] as string).getTime();
          break;
        case 'totalAmount':
        case 'totalCommission':
        case 'paymentDue':
        case 'taxAmount':
        case 'balanceAmount':
          valueA = this.sortField === 'balanceAmount' ? this.getBalanceAmount(a) : (a[this.sortField] || 0);
          valueB = this.sortField === 'balanceAmount' ? this.getBalanceAmount(b) : (b[this.sortField] || 0);
          break;
        default:
          valueA = a[this.sortField] || '';
          valueB = b[this.sortField] || '';
          
          if (typeof valueA === 'string') valueA = valueA.toLowerCase();
          if (typeof valueB === 'string') valueB = valueB.toLowerCase();
      }

      if (valueA < valueB) return this.sortDirection === 'asc' ? -1 : 1;
      if (valueA > valueB) return this.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    this.currentPage = 1;
  }
  
  getPageNumbers(): number[] {
    const totalPages = Math.ceil(this.totalEntries / this.entriesPerPage);
    const pagesToShow = 5;
    const startPage = Math.max(1, this.currentPage - Math.floor(pagesToShow / 2));
    const endPage = Math.min(totalPages, startPage + pagesToShow - 1);
    
    return Array.from({length: endPage - startPage + 1}, (_, i) => startPage + i);
  }

  goToPage(page: number): void {
    this.currentPage = page;
  }

  loadExpensesAndSales(): void {
    this.expensesSub = this.expenseService.getExpenses().subscribe(expenses => {
      this.expenses = expenses.map(expense => ({
        ...expense,
        subCategory: (expense as any).subCategory || '-',
        type: 'expense',
        balanceAmount: expense.balanceAmount || this.calculateBalanceFromExpense(expense),
        paymentStatus: expense.paymentStatus || this.calculatePaymentStatusFromExpense(expense)
      })) as unknown as ExtendedExpense[];
      
      this.incomesSub = this.expenseService.getIncomes().subscribe(incomes => {
        this.incomes = incomes.map(income => ({
          ...income,
          subCategory: (income as any).subCategory || '-',
          type: 'income',
          balanceAmount: income.balanceAmount || this.calculateBalanceFromExpense(income),
          paymentStatus: income.paymentStatus || this.calculatePaymentStatusFromExpense(income)
        })) as unknown as ExtendedExpense[];

        this.salesSub = this.saleService.listenForSales().subscribe(sales => {
          this.sales = sales.filter(sale => sale.status === 'Completed');
          
          this.shipmentsSub = this.saleService.listenForSales().subscribe(allSales => {
            this.shipments = allSales.filter(sale => 
              (sale as any).shippingStatus === 'Delivered'
            );
            
            this.payrollsSub = this.payrollService.getPayrollsRealTime().subscribe(payrolls => {
              this.payrolls = payrolls.filter(payroll => payroll.status === 'Final');
              
              this.purchasesSub = this.purchaseService.getPurchases().subscribe(purchases => {
                this.purchases = purchases;
                
                this.combinedEntries = [
                  ...this.mapExpensesToCombinedEntries(this.expenses),
                  ...this.mapIncomesToCombinedEntries(this.incomes),
                  ...this.mapSalesToCombinedEntries(this.sales),
                  ...this.mapShipmentsToCombinedEntries(this.shipments),
                  ...this.mapPayrollsToCombinedEntries(this.payrolls),
                  ...this.mapPurchasesToCombinedEntries(this.purchases)
                ];
                
                this.combinedEntries.sort((a, b) => {
                  const dateA = new Date(a.date).getTime();
                  const dateB = new Date(b.date).getTime();
                  return dateB - dateA;
                });
                
                this.applyFilter(this.activeFilter);
                this.applySorting();
                this.isLoading = false;
              });
            });
          });
        });
      });
    });
  }

  private calculateBalanceFromExpense(expense: any): number {
    const totalAmount = expense.finalAmount || expense.totalAmount || 0;
    const paidAmount = expense.paymentAmount || 0;
    return Math.max(0, totalAmount - paidAmount);
  }

  private calculatePaymentStatusFromExpense(expense: any): string {
    const totalAmount = expense.finalAmount || expense.totalAmount || 0;
    const paidAmount = expense.paymentAmount || 0;
    
    if (paidAmount >= totalAmount) {
      return 'Paid';
    } else if (paidAmount > 0) {
      return 'Partial';
    } else {
      return 'Due';
    }
  }

  toggleSelectAll(): void {
    if (this.allSelected) {
      this.selectedEntries.clear();
    } else {
      this.filteredEntries.forEach(entry => this.selectedEntries.add(entry.id));
    }
    this.allSelected = !this.allSelected;
  }

  toggleEntrySelection(entryId: string): void {
    if (this.selectedEntries.has(entryId)) {
      this.selectedEntries.delete(entryId);
    } else {
      this.selectedEntries.add(entryId);
    }
    this.allSelected = this.selectedEntries.size === this.filteredEntries.length;
  }

  async deleteSelectedEntries(): Promise<void> {
    if (this.selectedEntries.size === 0) {
      alert('Please select at least one entry to delete');
      return;
    }

    if (!confirm(`Are you sure you want to delete ${this.selectedEntries.size} selected entries?`)) {
      return;
    }

    try {
      const entriesToDelete = this.combinedEntries.filter(entry => this.selectedEntries.has(entry.id));
      
      for (const entry of entriesToDelete) {
        try {
          if (entry.entryType === 'expense') {
            await this.expenseService.deleteExpense(entry.id);
          } else if (entry.entryType === 'income') {
            await this.expenseService.deleteTransaction(entry.id, 'income');
          } else if (entry.entryType === 'sale' || entry.entryType === 'shipment') {
            await this.saleService.deleteSale(entry.id);
          } else if (entry.entryType === 'payroll') {
            await this.payrollService.deletePayroll(entry.id);
          } else if (entry.entryType === 'purchase') {
            await this.purchaseService.deletePurchase(entry.id);
          }
        } catch (error) {
          console.error(`Error deleting ${entry.entryType} ${entry.id}:`, error);
        }
      }
      
      this.selectedEntries.clear();
      this.allSelected = false;
      this.loadLocationsAndCategories(); 
      alert(`Successfully deleted ${entriesToDelete.length} entries`);
    } catch (error) {
      console.error('Error deleting selected entries:', error);
      alert('Error deleting some entries. Please check console for details.');
    }
  }

  mapPurchasesToCombinedEntries(purchases: any[]): CombinedEntry[] {
    return purchases.map(purchase => {
      const location = this.businessLocations.find(loc => loc.id === purchase.businessLocation);
      
      const cgstAmount = purchase.cgst || 0;
      const sgstAmount = purchase.sgst || 0;
      const igstAmount = purchase.igst || 0;

      let taxAmount = cgstAmount + sgstAmount + igstAmount;
      if (taxAmount === 0) {
        taxAmount = purchase.totalTax || purchase.purchaseTax || 0;
      }

      return {
        id: purchase.id || '',
        date: this.formatDate(purchase.purchaseDate) || new Date(),
        referenceNo: purchase.referenceNo,
        businessLocation: purchase.businessLocation,
        businessLocationName: location ? location.name : '-',
        categoryName: 'Purchase',
        expenseType: 'Purchase',
        accountHead: 'Purchases',
        paymentStatus: purchase.paymentStatus || 'Unpaid',
        paymentMethod: purchase.paymentMethod || '-',
        tax: taxAmount,
        taxAmount: taxAmount,
        cgstAmount: cgstAmount,
        sgstAmount: sgstAmount,
        igstAmount: igstAmount,
        totalAmount: purchase.grandTotal || purchase.purchaseTotal || 0,
        paymentDue: purchase.paymentDue || 0,
        balanceAmount: purchase.paymentDue || 0,
        entryFor: purchase.supplier || '-',
        supplier: purchase.supplier || '-',
        customer: purchase.supplier || '-',
        addedBy: purchase.addedBy || 'System',
        addedByDisplayName: purchase.addedByDisplayName || purchase.addedBy || 'System',
        commissionPercentage: 0,
        totalCommission: 0,
        products: purchase.products || [],
        entryType: 'purchase',
        paymentAccount: purchase.paymentAccount?.name || purchase.paymentAccount || '-',
        paidOn: purchase.paidOn || purchase.purchaseDate
      };
    });
  }

  getTotalTaxAmount(): number {
    return this.filteredEntries.reduce((total, entry) => total + (Number(entry.taxAmount) || 0), 0);
  }

  private mapIncomesToCombinedEntries(incomes: ExtendedExpense[]): CombinedEntry[] {
    return incomes.map(income => {
      const location = this.businessLocations.find(loc => loc.id === income.businessLocation);
      const category = this.incomeCategories.find(cat => cat.id === income.incomeCategory);
      const paymentAccount = this.paymentAccounts.find(acc => acc.id === income.paymentAccount);
      const taxAmount = Number(income.taxAmount) || 0;
      let cgstAmount = 0;
      let sgstAmount = 0;
      let igstAmount = 0;

      if (taxAmount > 0) {
        cgstAmount = taxAmount / 2;
        sgstAmount = taxAmount / 2;
      }

      return {
        id: income.id || '',
        date: income.date,
        referenceNo: income.referenceNo,
        businessLocation: income.businessLocation,
        businessLocationName: location ? location.name : '-',
        incomeCategory: income.incomeCategory,
        categoryName: category ? category.categoryName : '-',
        expenseType: 'Income',
        accountHead: income.accountHead || '-',
        taxAmount: taxAmount,
        incomeFor: income.incomeFor || '',
        incomeForContact: income.incomeForContact || '',
        applicableTax: income.applicableTax,
        totalAmount: income.finalAmount || income.totalAmount,
        finalAmount: income.finalAmount || income.totalAmount,
        incomeNote: income.incomeNote || '',
        cgstAmount: cgstAmount,
        sgstAmount: sgstAmount,
        igstAmount: igstAmount,
        isRefund: false,
        isRecurring: income.isRecurring || false,
        recurringInterval: income.recurringInterval,
        repetitions: income.repetitions?.toString(),
        paymentAmount: income.paymentAmount,
        paidOn: income.paidOn,
        paymentMethod: income.paymentMethod,
        paymentAccount: paymentAccount ? paymentAccount.name : income.paymentAccount || '-', 
        paymentAccountId: income.paymentAccount, 
        paymentNote: income.paymentNote,
        paymentStatus: income.paymentStatus || 'Paid',
        balanceAmount: income.balanceAmount || this.getBalanceAmount({ 
          finalAmount: income.finalAmount, 
          totalAmount: income.totalAmount, 
          paymentAmount: income.paymentAmount 
        } as CombinedEntry),
        customer: '-',
        addedBy: (income as any).addedBy || 'System',
        addedByDisplayName: (income as any).addedByDisplayName || (income as any).addedBy || 'System',
        commissionPercentage: 0,
        totalCommission: 0,
        products: [],
        entryType: 'income',
        tax: taxAmount,
        paymentDue: 0,
        entryFor: income.incomeFor || '-'
      };
    });
  }

  applyFilter(filterType: string): void {
    this.activeFilter = filterType;
    this.currentPage = 1;
    
    switch(filterType) {
      case 'sale':
        this.filteredEntries = this.combinedEntries.filter(entry => entry.entryType === 'sale');
        break;
      case 'shipment':
        this.filteredEntries = this.combinedEntries.filter(entry => entry.entryType === 'shipment');
        break;
      case 'payment':
        this.filteredEntries = this.combinedEntries.filter(entry => 
          (entry.paymentStatus && ['Paid', 'Partial', 'Unpaid'].includes(entry.paymentStatus))
        );
        break;
      case 'payroll':
        this.filteredEntries = this.combinedEntries.filter(entry => entry.entryType === 'payroll');
        break;
      case 'purchase':
        this.filteredEntries = this.combinedEntries.filter(entry => entry.entryType === 'purchase');
        break;
      default:
        this.filteredEntries = [...this.combinedEntries];
        break;
    }
    
    this.totalEntries = this.filteredEntries.length;
    this.onSearch({ target: { value: this.searchTerm } });
  }

  private formatDate(date: any): string {
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

  private mapExpensesToCombinedEntries(expenses: ExtendedExpense[]): CombinedEntry[] {
    return expenses.map(expense => {
      const location = this.businessLocations.find(loc => loc.id === expense.businessLocation);
      const taxAmount = 'taxAmount' in expense ? Number(expense.taxAmount) : 0;
      let cgstAmount = 0;
      let sgstAmount = 0;
      let igstAmount = 0;
      let category;
      const expenseType = expense.type || 'expense';
      
      if (expenseType === 'expense') {
        category = this.expenseCategories.find(cat => cat.id === expense.expenseCategory);
      } else {
        category = this.incomeCategories.find(cat => cat.id === expense.incomeCategory);
      }
      
      if (taxAmount > 0) {
        cgstAmount = taxAmount / 2;
        sgstAmount = taxAmount / 2;
      }
      
      const paymentAccount = this.paymentAccounts.find(acc => acc.id === expense.paymentAccount);
      
      return {
        id: expense.id || '',
        date: expense.date,
        referenceNo: expense.referenceNo,
        businessLocation: expense.businessLocation,
        businessLocationName: location ? location.name : '-',
        expenseCategory: expenseType === 'expense' ? expense.expenseCategory : '',
        incomeCategory: expenseType === 'income' ? expense.incomeCategory : '',
        categoryName: category ? category.categoryName : '-',
        expenseType: expense.expenseType || (category?.type || 'Expense'),
        accountHead: expense.accountHead || '-',
        expenseFor: expenseType === 'expense' ? expense.expenseFor : '',
        incomeFor: expenseType === 'income' ? expense.incomeFor : '',
        expenseForContact: expenseType === 'expense' ? expense.expenseForContact : '',
        incomeForContact: expenseType === 'income' ? expense.incomeForContact : '',
        applicableTax: expense.applicableTax,
        totalAmount: expense.finalAmount || expense.totalAmount,
        finalAmount: expense.finalAmount || expense.totalAmount,
        taxAmount: taxAmount,
        cgstAmount: cgstAmount,
        sgstAmount: sgstAmount,
        igstAmount: igstAmount,
        expenseNote: expenseType === 'expense' ? expense.expenseNote : '',
        incomeNote: expenseType === 'income' ? expense.incomeNote : '',
        isRefund: expense.isRefund || false,
        isRecurring: expense.isRecurring || false,
        recurringInterval: expense.recurringInterval,
        repetitions: expense.repetitions?.toString(),
        paymentAmount: expense.paymentAmount,
        paidOn: expense.paidOn,
        paymentMethod: expense.paymentMethod,
        paymentAccount: paymentAccount ? paymentAccount.name : expense.paymentAccount || '-',
        paymentAccountId: expense.paymentAccount,
        paymentNote: expense.paymentNote,
        paymentStatus: expense.paymentStatus || 'Paid',
        balanceAmount: expense.balanceAmount || this.getBalanceAmount({ 
          finalAmount: expense.finalAmount, 
          totalAmount: expense.totalAmount, 
          paymentAmount: expense.paymentAmount 
        } as CombinedEntry),
        customer: '-',
        addedBy: (expense as any).addedBy || 'System',
        addedByDisplayName: (expense as any).addedByDisplayName || (expense as any).addedBy || 'System',
        commissionPercentage: 0,
        totalCommission: 0,
        products: [],
        entryType: expenseType as 'expense' | 'income',
        tax: taxAmount,
        paymentDue: 0,
        entryFor: expenseType === 'expense' ? expense.expenseFor : expense.incomeFor || '-'
      };
    });
  }
    
  mapSalesToCombinedEntries(sales: any[]): CombinedEntry[] {
    return sales.map(sale => {
      let locationName = '-';
      if (sale.businessLocation) {
        if (typeof sale.businessLocation === 'object') {
          locationName = sale.businessLocation.name || '-';
        } else {
          const location = this.businessLocations.find(loc => loc.id === sale.businessLocation);
          locationName = location ? location.name : '-';
        }
      }

      let taxAmount = 0;
      let cgstAmount = 0;
      let sgstAmount = 0;
      let igstAmount = 0;

      if (sale.products && Array.isArray(sale.products)) {
        for (const product of sale.products) {
          taxAmount += Number(product.taxAmount) || 0;
          cgstAmount += Number(product.cgstAmount) || 0;
          sgstAmount += Number(product.sgstAmount) || 0;
          igstAmount += Number(product.igstAmount) || 0;
        }
      } else {
        taxAmount = sale.orderTax || sale.tax || 0;
        if (taxAmount > 0) {
          const isInterstate = false; 
          if (isInterstate) {
            igstAmount = taxAmount;
          } else {
            cgstAmount = taxAmount / 2;
            sgstAmount = taxAmount / 2;
          }
        }
      }
      
      return {
        id: sale.id || '',
        date: this.formatDate(sale.saleDate) || new Date(),
        referenceNo: sale.invoiceNo,
        category: 'Sale',
        categoryName: 'Sale',
        taxAmount: taxAmount,
        cgstAmount: cgstAmount,
        sgstAmount: sgstAmount,
        igstAmount: igstAmount,
        subCategory: '-',
        businessLocation: sale.businessLocation,
        businessLocationName: locationName,
        paymentStatus: sale.status,
        paymentMethod: sale.paymentMethod || '-',
        tax: taxAmount,
        totalAmount: sale.paymentAmount || 0,
        paymentDue: sale.balance || 0,
        balanceAmount: sale.balance || 0,
        entryFor: sale.customer || '-',
        customer: sale.customer || '-',
        addedBy: sale.addedBy || 'System',
        addedByDisplayName: sale.addedByDisplayName || sale.addedBy || 'System',
        commissionPercentage: sale.commissionPercentage || 0,
        totalCommission: sale.totalCommission || 0,
        products: sale.products || [],
        entryType: 'sale',
        paidOn: sale.paidOn || sale.saleDate
      };
    });
  }

  mapShipmentsToCombinedEntries(shipments: any[]): CombinedEntry[] {
    return shipments.map(shipment => {
      const location = this.businessLocations.find(loc => loc.id === shipment.businessLocation);
      
      let paymentStatus = 'Unpaid';
      if (shipment.balance === 0 && shipment.paymentAmount > 0) {
        paymentStatus = 'Paid';
      } else if (shipment.balance > 0 && shipment.paymentAmount > 0) {
        paymentStatus = 'Partial';
      }
      
      return {
        id: shipment.id || '',
        date: this.formatDate(shipment.saleDate) || new Date(),
        referenceNo: shipment.invoiceNo || '-',
        category: 'Shipment',
        categoryName: 'Shipment',
        subCategory: '-',
        businessLocation: shipment.businessLocation,
        businessLocationName: location ? location.name : '-',
        paymentStatus: paymentStatus,
        paymentMethod: shipment.paymentMethod || '-',
        tax: shipment.orderTax || 0,
        totalAmount: shipment.paymentAmount || 0,
        paymentDue: shipment.balance || 0,
        balanceAmount: shipment.balance || 0,
        entryFor: shipment.customer || '-',
        customer: shipment.customer || '-',
        addedBy: shipment.addedBy || 'System',
        addedByDisplayName: shipment.addedByDisplayName || shipment.addedBy || 'System',
        commissionPercentage: shipment.commissionPercentage || 0,
        totalCommission: shipment.totalCommission || 0,
        products: shipment.products || [],
        entryType: 'shipment',
        paidOn: shipment.paidOn || shipment.saleDate
      };
    });
  }
    
  mapPayrollsToCombinedEntries(payrolls: any[]): CombinedEntry[] {
    return payrolls.map(payroll => {
      const location = this.businessLocations.find(loc => loc.name === payroll.location);
      
      const employeeDetails: EmployeeDetail[] = payroll.employeeDetails?.map((emp: any) => ({
        id: emp.id || emp.employeeId || '',
        name: emp.name || emp.employeeName || 'Unknown',
        amount: emp.amount || emp.salary || 0
      })) || [];

      return {
        id: payroll.id || '',
        date: payroll.monthYear ? new Date(payroll.monthYear) : new Date(),
        referenceNo: payroll.name || 'Payroll',
        category: 'Payroll',
        categoryName: 'Payroll',
        subCategory: '-',
        businessLocation: location?.id || '',
        businessLocationName: payroll.location || '-',
        paymentStatus: 'Fixed',
        paymentMethod: 'Bank Transfer',
        tax: 0,
        totalAmount: payroll.totalGross || 0,
        paymentDue: 0,
        balanceAmount: 0,
        entryFor: employeeDetails.length > 0 
          ? this.getFormattedEmployeeNames(employeeDetails) 
          : 'Various Employees',
        customer: employeeDetails.length > 0 
          ? this.getFormattedEmployeeNames(employeeDetails) 
          : 'Various Employees',
        addedBy: payroll.addedBy || 'System',
        addedByDisplayName: payroll.addedByDisplayName || payroll.addedBy || 'System',
        commissionPercentage: 0,
        totalCommission: 0,
        products: [],
        entryType: 'payroll',
        expenseType: 'Salary',
        employeeDetails: employeeDetails,
        paidOn: payroll.paidOn || (payroll.monthYear ? new Date(payroll.monthYear) : new Date())
      };
    });
  }

  exportCSV(): void {
    const headers = [
      'Date', 'Reference No', 'Type', 'Category', 'Customer', 'Location', 
      'Payment Account', 'Payment Status', 'Added By', 'Commission %', 
      'Commission Amt', 'Tax', 'Total Amount', 'Balance Amount', 'Entry For'
    ];

    const data = this.filteredEntries.map(entry => [
      new Date(entry.date).toLocaleDateString(),
      entry.referenceNo || '-',
      this.getEntryTypeDisplay(entry.entryType),
      entry.categoryName || '-',
      entry.customer || '-',
      entry.businessLocationName || '-',
      entry.paymentAccount || '-',
      entry.paymentStatus || '-',
      entry.addedByDisplayName || '-',
      entry.commissionPercentage || '0',
      entry.totalCommission || '0.00',
      entry.tax || '0.00',
      entry.totalAmount || '0.00',
      this.getBalanceAmount(entry) || '0.00',
      entry.entryFor || '-'
    ]);

    let csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(',') + "\n" 
      + data.map(e => e.join(',')).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `expenses_sales_payments_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  exportExcel(): void {
    const worksheet = XLSX.utils.json_to_sheet(this.filteredEntries.map(entry => ({
      'Date': new Date(entry.date).toLocaleDateString(),
      'Reference No': entry.referenceNo || '-',
      'Type': this.getEntryTypeDisplay(entry.entryType),
      'Category': entry.categoryName || '-',
      'Customer': entry.customer || '-',
      'Location': entry.businessLocationName || '-',
      'Payment Status': entry.paymentStatus || '-',
      'Added By': entry.addedByDisplayName || '-',
      'Commission %': entry.commissionPercentage || 0,
      'Commission Amt': entry.totalCommission || '0.00',
      'Tax': entry.tax || '0.00',
      'Total Amount': entry.totalAmount || '0.00',
      'Balance Amount': this.getBalanceAmount(entry) || '0.00',
      'Entry For': entry.entryFor || '-'
    })));
    
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Expenses Sales");
    XLSX.writeFile(workbook, `expenses_sales_payments_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  printTable(): void {
    const printContent = document.getElementById('print-section');
    const WindowObject = window.open('', 'PrintWindow', 'width=750,height=650,top=50,left=50,toolbars=no,scrollbars=yes,status=no,resizable=yes');
    
    if (WindowObject && printContent) {
      WindowObject.document.writeln(`
        <html>
          <head>
            <title>Expenses, Sales, and Payments Report</title>
            <style>
              body { font-family: Arial, sans-serif; }
              table { width: 100%; border-collapse: collapse; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; }
              .total-row { font-weight: bold; }
              .expense-row { background-color: #fff; }
              .income-row { background-color: #f0fff0; }
              .sale-row { background-color: #f0f8ff; }
              .shipment-row { background-color: #fffaf0; }
              .payroll-row { background-color: #f8f0ff; }
              .purchase-row { background-color: #fff0f5; }
            </style>
          </head>
          <body>
            <h1>Expenses, Sales, and Payments Report</h1>
            ${printContent.innerHTML}
            <script>
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                  window.close();
                }, 100);
              };
            </script>
          </body>
        </html>
      `);
      WindowObject.document.close();
    }
  }

  onSearch(event: any): void {
    this.searchTerm = event.target.value.toLowerCase();
    this.filteredEntries = this.combinedEntries.filter(entry => 
      (entry.referenceNo?.toLowerCase().includes(this.searchTerm)) ||
      (entry.categoryName?.toLowerCase().includes(this.searchTerm)) ||
      (entry.businessLocationName?.toLowerCase().includes(this.searchTerm)) ||
      (entry.paymentStatus?.toLowerCase().includes(this.searchTerm)) ||
      (entry.entryFor?.toLowerCase().includes(this.searchTerm)) ||
      (entry.customer?.toLowerCase().includes(this.searchTerm)) ||
      (entry.addedByDisplayName?.toLowerCase().includes(this.searchTerm)) ||
      (this.getEntryTypeDisplay(entry.entryType).toLowerCase().includes(this.searchTerm))
    );
    
    if (this.activeFilter !== 'overall') {
      this.applyFilter(this.activeFilter);
    } else {
      this.totalEntries = this.filteredEntries.length;
      this.currentPage = 1;
    }
  }

  changeEntriesPerPage(event: any): void {
    this.entriesPerPage = parseInt(event.target.value);
    this.currentPage = 1;
  }

  get paginatedEntries(): CombinedEntry[] {
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

  getPaginatedEndIndex(): number {
    return Math.min(this.currentPage * this.entriesPerPage, this.totalEntries);
  }

  async deleteEntry(entry: CombinedEntry): Promise<void> {
    if (confirm(`Are you sure you want to delete this ${entry.entryType}?`)) {
      try {
        if (entry.entryType === 'expense' || entry.entryType === 'income') {
          await this.expenseService.deleteExpense(entry.id);
        } else if (entry.entryType === 'sale' || entry.entryType === 'shipment') {
          await this.saleService.deleteSale(entry.id);
        } else if (entry.entryType === 'payroll') {
          await this.payrollService.deletePayroll(entry.id);
        }
        this.loadLocationsAndCategories();
      } catch (error) {
        console.error(`Error deleting ${entry.entryType}:`, error);
        alert(`Error deleting ${entry.entryType}. Please try again.`);
      }
    }
  }

  addNewExpense(): void {
    this.router.navigate(['/add-expense']);
  }

  getTotalAmount(): number {
    return this.filteredEntries.reduce((total, entry) => {
      const amount = entry.entryType === 'purchase' ? 
        (entry['grandTotal'] || entry.totalAmount || 0) : 
        (entry.totalAmount || 0);
      return total + amount;
    }, 0);
  }

  getTotalCgstAmount(): number {
    return this.filteredEntries.reduce((total, entry) => total + (entry.cgstAmount || 0), 0);
  }

  getTotalSgstAmount(): number {
    return this.filteredEntries.reduce((total, entry) => total + (entry.sgstAmount || 0), 0);
  }

  getTotalIgstAmount(): number {
    return this.filteredEntries.reduce((total, entry) => total + (entry.igstAmount || 0), 0);
  }

  getFormattedEmployeeNames(employees: any[]): string {
    if (!employees || employees.length === 0) return 'No employees';
    
    return employees.map(emp => {
      if (typeof emp === 'string') {
        return emp;
      } else if (emp.id) {
        return emp.name || emp.username || emp.id;
      }
      return 'Unknown';
    }).join(', ');
  }

  getEntryTypeClass(entryType: string): string {
    if (entryType === 'expense') return 'expense-row';
    if (entryType === 'income') return 'income-row';
    if (entryType === 'sale') return 'sale-row';
    if (entryType === 'purchase') return 'purchase-row';
    if (entryType === 'shipment') return 'shipment-row';
    if (entryType === 'payroll') return 'payroll-row';
    return '';
  }

  getEntryTypeDisplay(entryType: string): string {
    if (entryType === 'expense') return 'Expense';
    if (entryType === 'income') return 'Income';
    if (entryType === 'sale') return 'Sale';
    if (entryType === 'purchase') return 'Purchase';
    if (entryType === 'shipment') return 'Shipment';
    if (entryType === 'payroll') return 'Payroll';
    return '';
  }

  ngOnDestroy(): void {
    if (this.expensesSub) this.expensesSub.unsubscribe();
    if (this.salesSub) this.salesSub.unsubscribe();
    if (this.shipmentsSub) this.shipmentsSub.unsubscribe();
    if (this.locationsSub) this.locationsSub.unsubscribe();
    if (this.categoriesSub) this.categoriesSub.unsubscribe();
    if (this.payrollsSub) this.payrollsSub.unsubscribe();
    if (this.purchasesSub) this.purchasesSub.unsubscribe();
    if (this.incomesSub) this.incomesSub.unsubscribe();
  }
}