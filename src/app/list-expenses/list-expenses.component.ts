import { Component, OnInit, OnDestroy } from '@angular/core';
import { ExpenseService } from '../services/expense.service';
import { LocationService } from '../services/location.service';
import { ExpenseCategoriesService } from '../services/expense-categories.service';
import { SaleService } from '../services/sale.service';
import { PayrollService } from '../services/payroll.service';
import { PurchaseService } from '../services/purchase.service'; // Add this import
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
  customer?: string;
  addedBy?: string;
  addedByDisplayName?: string;
  commissionPercentage?: number;
  totalCommission?: number;
  employeeDetails?: EmployeeDetail[];
  products?: any[];
  entryType: 'expense' | 'income' | 'sale' | 'shipment' | 'payroll' | 'purchase'; // Add purchase
  
  tax?: number;
  paymentDue?: number;
  entryFor?: string;
  category?: string;
  subCategory?: string;
  balance?: number;
  supplier?: string; // Add supplier field
  
  [key: string]: any;
}

interface EmployeeDetail {
  email?: string;
  name: string;
  amount: number;
  
}

// Extended interface to handle both expense and income types
interface ExtendedExpense extends Expense {
  type?: 'expense' | 'income';
  accountHead?: string;
  incomeCategory?: string;
  incomeFor?: string;
  incomeForContact?: string;
  incomeNote?: string;
    expenseType?: string; // Add this line

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
  purchases: any[] = []; // Add purchases array
  sortField: string = 'date';
  paymentAccounts: any[] = [];

  sortDirection: 'asc' | 'desc' = 'desc';
  combinedEntries: CombinedEntry[] = [];
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
  private purchasesSub!: Subscription; // Add purchases subscription
  
  currentPage: number = 1;
  entriesPerPage: number = 25;
  totalEntries: number = 0;
  searchTerm: string = '';
  isLoading: boolean = true;
  activeFilter: string = 'overall';
  expandedEntryId: string | null = null;
  incomesSub: Subscription = new Subscription;
  incomes: ExtendedExpense[] = [];

  constructor(
    private expenseService: ExpenseService,
    private saleService: SaleService,
    private locationService: LocationService,
    private expenseCategoriesService: ExpenseCategoriesService,
    private payrollService: PayrollService,
    private purchaseService: PurchaseService, // Add purchase service
    private router: Router,
    private accountService: AccountService,
    private datePipe: DatePipe
  ) {}

  ngOnInit(): void {
    this.loadLocationsAndCategories();
  }

  loadLocationsAndCategories(): void {
    this.isLoading = true;
    
    this.locationsSub = this.locationService.getLocations().subscribe(locations => {
      this.businessLocations = locations;
      
      this.categoriesSub = this.expenseCategoriesService.getCategories().subscribe(categories => {
        this.expenseCategories = categories;
        this.incomeCategories = categories;
        
        // Load payment accounts first
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


  getTotalDirectExpenses(): number {
    return this.filteredEntries
      .filter(entry => entry.entryType === 'expense' && entry.expenseType === 'Direct')
      .reduce((total, entry) => total + (entry.totalAmount || 0), 0);
  }

  getTotalIndirectExpenses(): number {
    return this.filteredEntries
      .filter(entry => entry.entryType === 'expense' && entry.expenseType === 'Indirect')
      .reduce((total, entry) => total + (entry.totalAmount || 0), 0);
  }

  getTotalDirectIncome(): number {
    return this.filteredEntries
      .filter(entry => entry.entryType === 'income' && entry.expenseType === 'Direct')
      .reduce((total, entry) => total + (entry.totalAmount || 0), 0);
  }

  getTotalIndirectIncome(): number {
    return this.filteredEntries
      .filter(entry => entry.entryType === 'income' && entry.expenseType === 'Indirect')
      .reduce((total, entry) => total + (entry.totalAmount || 0), 0);
  }

  private applySorting(): void {
    this.filteredEntries.sort((a, b) => {
      let valueA: any;
      let valueB: any;

      switch (this.sortField) {
        case 'date':
          valueA = new Date(a.date).getTime();
          valueB = new Date(b.date).getTime();
          break;
        case 'totalAmount':
        case 'totalCommission':
        case 'paymentDue':
    case 'taxAmount':
        valueA = a.taxAmount || 0;
        valueB = b.taxAmount || 0;
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

  loadExpensesAndSales(): void {
    this.expensesSub = this.expenseService.getExpenses().subscribe(expenses => {
      this.expenses = expenses.map(expense => ({
        ...expense,
        subCategory: (expense as any).subCategory || '-',
        type: 'expense' // Explicitly set type
      })) as unknown as ExtendedExpense[];
      
      // Add incomes subscription
      this.incomesSub = this.expenseService.getIncomes().subscribe(incomes => {
        this.incomes = incomes.map(income => ({
          ...income,
          subCategory: (income as any).subCategory || '-',
          type: 'income' // Explicitly set type
        })) as unknown as ExtendedExpense[];

        this.salesSub = this.saleService.listenForSales().subscribe(sales => {
          this.sales = sales.filter(sale => sale.status === 'Completed');
          
          this.shipmentsSub = this.saleService.listenForSales().subscribe(allSales => {
            this.shipments = allSales.filter(sale => 
              (sale as any).shippingStatus === 'Delivered'
            );
            
            this.payrollsSub = this.payrollService.getPayrollsRealTime().subscribe(payrolls => {
              this.payrolls = payrolls.filter(payroll => payroll.status === 'Final');
              
              // Add purchases subscription
              this.purchasesSub = this.purchaseService.getPurchases().subscribe(purchases => {
                this.purchases = purchases;
                
                this.combinedEntries = [
                  ...this.mapExpensesToCombinedEntries(this.expenses),
                  ...this.mapIncomesToCombinedEntries(this.incomes),
                  ...this.mapSalesToCombinedEntries(this.sales),
                  ...this.mapShipmentsToCombinedEntries(this.shipments),
                  ...this.mapPayrollsToCombinedEntries(this.payrolls),
                  ...this.mapPurchasesToCombinedEntries(this.purchases) // Add purchases mapping
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
// Add these methods
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
    
    // Delete entries in batches to avoid overwhelming Firestore
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
    this.loadLocationsAndCategories(); // Refresh the data
    alert(`Successfully deleted ${entriesToDelete.length} entries`);
  } catch (error) {
    console.error('Error deleting selected entries:', error);
    alert('Error deleting some entries. Please check console for details.');
  }
}
mapPurchasesToCombinedEntries(purchases: any[]): CombinedEntry[] {
  return purchases.map(purchase => {
    const location = this.businessLocations.find(loc => loc.id === purchase.businessLocation);
    const totalTax = purchase.totalTax || 0; // Get totalTax from purchase or default to 0
    const gstAmount = totalTax / 2;
    let sgstAmount = totalTax / 2;
    let igstAmount = 0;
        const taxAmount = purchase.totalTax || 0;
    let cgstAmount = 0;
    if (taxAmount > 0) {
      // Example logic - determine based on supplier location
      const isInterstate = false; // Determine based on business vs supplier location
      if (isInterstate) {
        igstAmount = taxAmount;
      } else {
        cgstAmount = taxAmount / 2;
        sgstAmount = taxAmount / 2;
      }
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
      tax: totalTax,
      taxAmount: totalTax, // Add this if you want to use taxAmount elsewhere
      gstAmount: gstAmount,
          cgstAmount: cgstAmount,
      sgstAmount: sgstAmount,
      igstAmount: igstAmount,
    
      totalAmount: purchase.grandTotal || purchase.purchaseTotal || 0,
      paymentDue: purchase.paymentDue || 0,
      entryFor: purchase.supplier || '-',
      supplier: purchase.supplier || '-',
      customer: purchase.supplier || '-',
      addedBy: purchase.addedBy || 'System',
      addedByDisplayName: purchase.addedByDisplayName || purchase.addedBy || 'System',
      commissionPercentage: 0,
      totalCommission: 0,
      products: purchase.products || [],
      entryType: 'purchase',
      paymentAccount: purchase.paymentAccount?.name || purchase.paymentAccount || '-'
    };
  });
}
getTotalTaxAmount(): number {
  return this.filteredEntries.reduce((total, entry) => total + (entry.taxAmount || 0), 0);
}
private mapIncomesToCombinedEntries(incomes: ExtendedExpense[]): CombinedEntry[] {
    return incomes.map(income => {
      const location = this.businessLocations.find(loc => loc.id === income.businessLocation);
      const category = this.incomeCategories.find(cat => cat.id === income.incomeCategory);
      const paymentAccount = this.paymentAccounts.find(acc => acc.id === income.paymentAccount);
       const taxAmount = Number(income.applicableTax) || 0;
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
        expenseType: 'Income', // Set as Income for display
        accountHead: income.accountHead || '-',
        taxAmount: Number(income.applicableTax) || 0, // Convert to number
        incomeFor: income.incomeFor || '',
        incomeForContact: income.incomeForContact || '',
        applicableTax: income.applicableTax,
        totalAmount: income.totalAmount,
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
        paymentAccount: paymentAccount ? paymentAccount.name : income.paymentAccount || '-', // Show account name
        paymentAccountId: income.paymentAccount, // Keep original ID
        paymentNote: income.paymentNote,
        paymentStatus: 'Paid',
        customer: '-',
        addedBy: (income as any).addedBy || 'System',
        addedByDisplayName: (income as any).addedByDisplayName || (income as any).addedBy || 'System',
        commissionPercentage: 0,
        totalCommission: 0,
        products: [],
        entryType: 'income',
        tax: 0,
        paymentDue: 0,
        entryFor: income.incomeFor || '-'
      };
    });
  }

  // Update the applyFilter method to include purchase filter
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

  toggleProductDetails(entryId: string): void {
    if (this.expandedEntryId === entryId) {
      this.expandedEntryId = null;
    } else {
      this.expandedEntryId = entryId;
    }
  }

  calculateEmployeeAmount(totalAmount: number, employeeCount: number): number {
    if (employeeCount === 0) return 0;
    return totalAmount / employeeCount;
  }

  getProductsDisplayText(products: any[]): string {
    if (!products || products.length === 0) return 'No products';
    if (products.length === 1) {
      return `${products[0].name} (${products[0].quantity})`;
    }
    return `${products[0].name} (${products[0].quantity}) + ${products.length - 1} more`;
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
const taxAmount = 'taxAmount' in expense ? Number(expense.taxAmount) : 0;    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;
    let category;
    const expenseType = expense.type || 'expense';
    
    // Find category based on expense type
    if (expenseType === 'expense') {
      category = this.expenseCategories.find(cat => cat.id === expense.expenseCategory);
    } else {
      category = this.incomeCategories.find(cat => cat.id === expense.incomeCategory);
    }
        if (taxAmount > 0) {
      // Simple assumption: If tax is present, split 50-50 for CGST/SGST
      // In a real app, you'd determine based on business location vs customer location
      cgstAmount = taxAmount / 2;
      sgstAmount = taxAmount / 2;
    }
    
    
    // Find payment account
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
      totalAmount: expense.totalAmount,
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
      paymentStatus: 'Paid',
      customer: '-',
      addedBy: (expense as any).addedBy || 'System',
      addedByDisplayName: (expense as any).addedByDisplayName || (expense as any).addedBy || 'System',
      commissionPercentage: 0,
      totalCommission: 0,
      products: [],
      entryType: expenseType as 'expense' | 'income',
      tax: 0,
      paymentDue: 0,

      entryFor: expenseType === 'expense' ? expense.expenseFor : expense.incomeFor || '-'
    };
  });
}
    
 mapSalesToCombinedEntries(sales: any[]): CombinedEntry[] {
  return sales.map(sale => {
    // Resolve business location name
    let locationName = '-';
    if (sale.businessLocation) {
      if (typeof sale.businessLocation === 'object') {
        locationName = sale.businessLocation.name || '-';
      } else {
        const location = this.businessLocations.find(loc => loc.id === sale.businessLocation);
        locationName = location ? location.name : '-';
      }
    }
  const taxAmount = sale.orderTax || 0;
    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;
     if (taxAmount > 0) {
      // Example logic - in real app, determine based on locations
      const isInterstate = false; // You'd determine this based on business vs customer location
      if (isInterstate) {
        igstAmount = taxAmount;
      } else {
        cgstAmount = taxAmount / 2;
        sgstAmount = taxAmount / 2;
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
      tax: sale.orderTax || 0,
      totalAmount: sale.paymentAmount || 0,
      paymentDue: sale.balance || 0,
      entryFor: sale.customer || '-',
      customer: sale.customer || '-',
      addedBy: sale.addedBy || 'System',
      addedByDisplayName: sale.addedByDisplayName || sale.addedBy || 'System',
      commissionPercentage: sale.commissionPercentage || 0,
      totalCommission: sale.totalCommission || 0,
      products: sale.products || [],
      entryType: 'sale'
    };
  });
}

private async resolveDocumentReferences(expenseData: any): Promise<any> {
  try {
    // Resolve business location name
    if (expenseData.businessLocation) {
      if (typeof expenseData.businessLocation === 'object') {
        expenseData.businessLocationName = expenseData.businessLocation.name || '';
      } else {
        const locations = await firstValueFrom(this.locationService.getLocations());
        const location = locations.find(loc => loc.id === expenseData.businessLocation);
        expenseData.businessLocationName = location?.name || '';
      }
    }

    // Resolve expense category name
    if (expenseData.expenseCategory) {
      if (typeof expenseData.expenseCategory === 'object') {
        expenseData.expenseCategoryName = expenseData.expenseCategory.categoryName || '';
        expenseData.expenseType = expenseData.expenseCategory.type || '';
      } else {
        const categories = await firstValueFrom(this.expenseCategoriesService.getCategories());
        const category = categories.find(cat => cat.id === expenseData.expenseCategory);
        expenseData.expenseCategoryName = category?.categoryName || '';
        expenseData.expenseType = category?.type || '';
      }
    }

    // Resolve income category name
    if (expenseData.incomeCategory) {
      if (typeof expenseData.incomeCategory === 'object') {
        expenseData.incomeCategoryName = expenseData.incomeCategory.categoryName || '';
        expenseData.incomeType = expenseData.incomeCategory.type || '';
      } else {
        const categories = await firstValueFrom(this.expenseCategoriesService.getCategories());
        const category = categories.find(cat => cat.id === expenseData.incomeCategory);
        expenseData.incomeCategoryName = category?.categoryName || '';
        expenseData.incomeType = category?.type || '';
      }
    }

    return expenseData;
  } catch (error) {
    console.error('Error in resolveDocumentReferences:', error);
    return expenseData;
  }
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
        entryFor: shipment.customer || '-',
        customer: shipment.customer || '-',
        addedBy: shipment.addedBy || 'System',
        addedByDisplayName: shipment.addedByDisplayName || shipment.addedBy || 'System',
        commissionPercentage: shipment.commissionPercentage || 0,
        totalCommission: shipment.totalCommission || 0,
        products: shipment.products || [],
        entryType: 'shipment'
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
        employeeDetails: employeeDetails
      };
    });
  }

  exportCSV(): void {
    const headers = [
      'Date', 'Reference No', 'Type', 'Category', 'Customer', 'Location', 
      'Payment Account', 'Payment Status', 'Added By', 'Commission %', 
      'Commission Amt', 'Tax', 'Total Amount', 'Payment Due', 'Entry For'
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
      entry.paymentDue || '0.00',
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
      'Payment Due': entry.paymentDue || '0.00',
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
  exportPDF(): void {
    const doc = new jsPDF();
    const title = 'Expenses, Sales, and Payments Report';
    
    doc.text(title, 14, 16);
    
    (doc as any).autoTable({
      head: [['Date', 'Reference', 'Type', 'Category', 'Customer', 'Location', 'Status', 'Added By', 'Commission %', 'Commission Amt', 'Amount', 'Due']],
      body: this.filteredEntries.map(entry => [
        new Date(entry.date).toLocaleDateString(),
        entry.referenceNo || '-',
        this.getEntryTypeDisplay(entry.entryType),
        entry.categoryName || '-',
        entry.customer || '-',
        entry.businessLocationName || '-',
        entry.paymentStatus || '-',
        entry.addedByDisplayName || '-',
        entry.commissionPercentage || 0,
        entry.totalCommission || '0.00',
        entry.totalAmount || '0.00',
        entry.paymentDue || '0.00'
      ]),
      startY: 25,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 245, 245] }
    });
    
    doc.save(`expenses_sales_payments_${new Date().toISOString().slice(0, 10)}.pdf`);
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
    
    // Reapply the active filter after search
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

  editEntry(entry: CombinedEntry): void {
    if (entry.entryType === 'expense') {
      this.router.navigate(['/edit-expense', entry.id]);
    } else if (entry.entryType === 'sale') {
      this.router.navigate(['/edit-sale', entry.id]);
    } else if (entry.entryType === 'shipment') {
      this.router.navigate(['/edit-shipment', entry.id]);
    } else if (entry.entryType === 'payroll') {
      this.router.navigate(['/edit-payroll', entry.id]);
    }
  }

  viewEntry(entry: CombinedEntry): void {
    if (this.expandedEntryId === entry.id) {
      this.expandedEntryId = null;
    } else {
      this.expandedEntryId = entry.id;
    }
  }
getTotalCommission(): number {
  return this.filteredEntries.reduce((total, entry) => total + (entry.totalCommission || 0), 0);
}

  async deleteEntry(entry: CombinedEntry): Promise<void> {
    if (confirm(`Are you sure you want to delete this ${entry.entryType}?`)) {
      try {
        if (entry.entryType === 'expense') {
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
getTotalAmountByType(entryType: 'expense' | 'income', expenseType: 'Direct' | 'Indirect'): number {
  return this.filteredEntries.reduce((total, entry) => {
    // Check if entry matches the type and expense type
    const isTypeMatch = entry.entryType === entryType;
    const isExpenseTypeMatch = entry.expenseType === expenseType || 
                             (entryType === 'income' && entry.incomeCategory?.includes(expenseType));
    
    return isTypeMatch && isExpenseTypeMatch ? total + (entry.totalAmount || 0) : total;
  }, 0);
}
getTotalPurchaseAmount(): number {
  return this.filteredEntries
    .filter(entry => entry.entryType === 'purchase')
.reduce((total, entry) => total + (entry['grandTotal'] || entry.totalAmount || 0), 0);}
getTotalAmount(): number {
  return this.filteredEntries.reduce((total, entry) => {
    // For purchases, use grandTotal if available, otherwise use totalAmount
const amount = entry.entryType === 'purchase' ? 
  (entry['grandTotal'] || entry.totalAmount || 0) : 
  (entry.totalAmount || 0);
    return total + amount;
  }, 0);
}
  getTotalDue(): number {
    return this.filteredEntries.reduce((total, entry) => total + (entry.paymentDue || 0), 0);
  }

  getFormattedEmployeeNames(employees: any[]): string {
    if (!employees || employees.length === 0) return 'No employees';
    
    return employees.map(emp => {
      // Handle different employee data structures
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
      if (entryType === 'purchase') return 'purchase';

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
  }
}