import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Expense, ExpenseService } from '../services/expense.service';
import { SaleService } from '../services/sale.service';
import { LocationService } from '../services/location.service';
import { ExpenseCategoriesService } from '../services/expense-categories.service';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-view-entry',
  templateUrl: './view-entry.component.html',
  styleUrls: ['./view-entry.component.scss'],
  providers: [DatePipe]
})
export class ViewEntryComponent implements OnInit {
  entryId: string = '';
  entryType: string = '';
  entryData: any = null;
  businessLocation: any = null;
  category: any = null;
  isLoading: boolean = true;
  businessLocations: any[] = [];
  expenseCategories: any[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private expenseService: ExpenseService,
    private saleService: SaleService,
    private locationService: LocationService,
    private expenseCategoriesService: ExpenseCategoriesService,
    private datePipe: DatePipe
  ) { }

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.entryId = params['id'];
      this.entryType = params['type'];
      this.loadData();
    });
  }

  loadData(): void {
    this.isLoading = true;
    
    this.locationService.getLocations().subscribe(locations => {
      this.businessLocations = locations;
      
      this.expenseCategoriesService.getCategories().subscribe(categories => {
        this.expenseCategories = categories;
        this.loadEntryData();
      });
    });
  }

  loadEntryData(): void {
    if (this.entryType === 'expense') {
      this.expenseService.getExpenseByIdObservable(this.entryId).subscribe((expense: Expense | null) => {
        this.entryData = expense;
        this.processEntryData();
      });
      
    } else {
      this.saleService.getSaleById(this.entryId).subscribe(sale => {
        this.entryData = sale;
        this.processEntryData();
      });
    }
  }

  processEntryData(): void {
    if (this.entryData) {
      if (this.entryData.businessLocation) {
        this.businessLocation = this.businessLocations.find(
          loc => loc.id === this.entryData.businessLocation
        );
      }
      
      if (this.entryType === 'expense' && this.entryData.expenseCategory) {
        this.category = this.expenseCategories.find(
          cat => cat.id === this.entryData.expenseCategory
        );
      }
      
      if (this.entryData.date) {
        this.entryData.formattedDate = this.formatDate(this.entryData.date);
      }
      
      if ((this.entryType === 'sale' || this.entryType === 'shipment') && this.entryData.saleDate) {
        this.entryData.formattedDate = this.formatDate(this.entryData.saleDate);
      }
    }
    
    this.isLoading = false;
  }

  formatDate(date: any): string {
    if (!date) return '';
    
    try {
      if (typeof date === 'object' && 'toDate' in date) {
        return this.datePipe.transform(date.toDate(), 'mediumDate') || '';
      } else if (date instanceof Date) {
        return this.datePipe.transform(date, 'mediumDate') || '';
      } else {
        return this.datePipe.transform(new Date(date), 'mediumDate') || '';
      }
    } catch (e) {
      console.error('Error formatting date:', e);
      return '';
    }
  }

  getEntryTypeDisplay(): string {
    if (this.entryType === 'expense') return 'Expense';
    if (this.entryType === 'sale') return 'Sale';
    if (this.entryType === 'shipment') return 'Shipment';
    return '';
  }

  goBack(): void {
    this.router.navigate(['/list-expenses']);
  }

  printEntry(): void {
    window.print();
  }

  getCategoryName(): string {
    return this.category ? this.category.categoryName : '-';
  }

  getLocationName(): string {
    return this.businessLocation ? this.businessLocation.name : '-';
  }

  getPaymentStatusDisplay(): string {
    if (this.entryType === 'expense') {
      return this.entryData?.paymentMethod || '-';
    } else {
      if (this.entryType === 'shipment') {
        if (this.entryData?.balance === 0 && this.entryData?.paymentAmount > 0) {
          return 'Paid';
        } else if (this.entryData?.balance > 0 && this.entryData?.paymentAmount > 0) {
          return 'Partial';
        } else {
          return 'Unpaid';
        }
      } else {
        return this.entryData?.status || '-';
      }
    }
  }
}