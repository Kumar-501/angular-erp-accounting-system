import { Component, OnInit, OnDestroy } from "@angular/core";
import { ExpenseService } from "../services/expense.service";
import { SaleService } from "../services/sale.service";
import { PayrollService } from "../services/payroll.service";
import { PurchaseService } from "../services/purchase.service";
import { Subscription } from "rxjs";
import { DatePipe } from "@angular/common";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

// Interface updated to use 'type' instead of 'category'
interface ReportEntry {
  id: string;
  date: Date | string;
  type: string; // Changed from 'category'
  totalAmount: number;
  entryType: "expense" | "income" | "sale" | "payroll" | "purchase";
}

@Component({
  selector: "app-list-report",
  templateUrl: "./list-report.component.html",
  styleUrls: ["./list-report.component.scss"],
  providers: [DatePipe],
})
export class ListReportComponent implements OnInit, OnDestroy {
  entries: ReportEntry[] = [];
  filteredEntries: ReportEntry[] = [];
  sortField: string = "date";
  sortDirection: "asc" | "desc" = "desc";
  currentPage: number = 1;
  entriesPerPage: number = 10;
  totalEntries: number = 0;
  searchTerm: string = "";
  isLoading: boolean = true;
  showFilters: boolean = false;
  startDate: string = "";
  endDate: string = "";
  
  // Replaces 'selectedCategory' and 'categories'
  activeTypeFilter: string = "All";

  Math = Math;

  private dataSub!: Subscription;

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
    if (this.dataSub) {
      this.dataSub.unsubscribe();
    }
    this.dataSub = new Subscription();
    this.entries = []; // Clear entries on reload

    // Fetch all data sources
    this.dataSub.add(this.expenseService.getExpenses().subscribe(data => this.processData('expense', data)));
    this.dataSub.add(this.expenseService.getIncomes().subscribe(data => this.processData('income', data)));
    this.dataSub.add(this.saleService.listenForSales().subscribe(data => this.processData('sale', data)));
    this.dataSub.add(this.purchaseService.getPurchases().subscribe(data => this.processData('purchase', data)));
    this.dataSub.add(this.payrollService.getPayrollsRealTime().subscribe(data => this.processData('payroll', data)));

    // Set a timeout to handle initial rendering
    setTimeout(() => this.isLoading = false, 1500);
  }

  private processData(type: 'expense' | 'income' | 'sale' | 'payroll' | 'purchase', data: any[]): void {
    // Remove old data of the same type to prevent duplicates on real-time updates
    this.entries = this.entries.filter(e => e.entryType !== type);

    const newEntries = data.map(item => {
      let reportEntry: ReportEntry = {
        id: item.id || `${type}-${Date.now()}`,
        date: new Date(), // Default value
        type: 'Unknown',
        totalAmount: 0,
        entryType: type
      };

      switch(type) {
        case 'expense':
          reportEntry.date = item.date;
          reportEntry.type = 'Expense';
          reportEntry.totalAmount = item.totalAmount || 0;
          break;
        case 'income':
          reportEntry.date = item.date;
          reportEntry.type = 'Income';
          reportEntry.totalAmount = item.totalAmount || 0;
          break;
        case 'sale':
          reportEntry.date = item.saleDate;
          reportEntry.type = 'Sale';
          reportEntry.totalAmount = item.paymentAmount || 0;
          break;
        case 'purchase':
          reportEntry.date = item.purchaseDate;
          reportEntry.type = 'Purchase';
          reportEntry.totalAmount = item.grandTotal || item.purchaseTotal || 0;
          break;
        case 'payroll':
          reportEntry.date = item.monthYear;
          reportEntry.type = 'Payroll';
          reportEntry.totalAmount = item.totalGross || 0;
          break;
      }
      return reportEntry;
    });

    this.entries.push(...newEntries);
    this.sortAndFilterData();
  }

  private sortAndFilterData(): void {
    this.entries.sort((a, b) => {
        const dateA = new Date(a.date as string).getTime();
        const dateB = new Date(b.date as string).getTime();
        return dateB - dateA; // Default sort by most recent
    });
    this.applyFilters();
  }

  applyTypeFilter(type: string): void {
    this.activeTypeFilter = type;
    this.applyFilters();
  }

  async deleteEntry(entry: ReportEntry) {
    if (confirm("Are you sure you want to delete this entry?")) {
      try {
        this.isLoading = true;
        switch (entry.entryType) {
          case "expense": await this.expenseService.deleteExpense(entry.id); break;
          case "income": await this.expenseService.deleteTransaction(entry.id, 'income'); break;
          case "sale": await this.saleService.deleteSale(entry.id); break;
          case "payroll": await this.payrollService.deletePayroll(entry.id); break;
          case "purchase": await this.purchaseService.deletePurchase(entry.id); break;
        }
        // Data will reload via listeners, no need to call loadData() manually
      } catch (error) {
        console.error("Error deleting entry:", error);
        this.isLoading = false;
        alert("Failed to delete entry. Please try again.");
      }
    }
  }

  sortData(field: string): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === "asc" ? "desc" : "asc";
    } else {
      this.sortField = field;
      this.sortDirection = "asc";
    }

    this.filteredEntries.sort((a, b) => {
      let valueA: any, valueB: any;
      switch (this.sortField) {
        case "date": valueA = new Date(a.date as string).getTime(); valueB = new Date(b.date as string).getTime(); break;
        case "totalAmount": valueA = a.totalAmount || 0; valueB = b.totalAmount || 0; break;
        default: valueA = a.type.toLowerCase(); valueB = b.type.toLowerCase(); break; // Sort by type
      }

      if (valueA < valueB) return this.sortDirection === "asc" ? -1 : 1;
      if (valueA > valueB) return this.sortDirection === "asc" ? 1 : -1;
      return 0;
    });
    this.currentPage = 1;
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  setPresetDateRange(preset: string): void {
    const today = new Date();
    let startDate = new Date(), endDate = new Date();

    switch (preset) {
      case 'Today': startDate = today; endDate = today; break;
      case 'Yesterday': startDate.setDate(today.getDate() - 1); endDate.setDate(today.getDate() - 1); break;
      case 'Last 7 Days': startDate.setDate(today.getDate() - 6); endDate = today; break;
      case 'Last 30 Days': startDate.setDate(today.getDate() - 29); endDate = today; break;
      case 'This Month': startDate = new Date(today.getFullYear(), today.getMonth(), 1); endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0); break;
      case 'Last Month': startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1); endDate = new Date(today.getFullYear(), today.getMonth(), 0); break;
      // ... other cases remain the same
    }
    this.startDate = this.datePipe.transform(startDate, 'yyyy-MM-dd') || '';
    this.endDate = this.datePipe.transform(endDate, 'yyyy-MM-dd') || '';
    this.applyFilters();
  }

  applyFilters(): void {
    let filtered = [...this.entries];

    if (this.searchTerm) {
      const lowercasedTerm = this.searchTerm.toLowerCase();
      filtered = filtered.filter(entry =>
        entry.type.toLowerCase().includes(lowercasedTerm) ||
        this.formatDate(entry.date).toLowerCase().includes(lowercasedTerm)
      );
    }

    if (this.startDate && this.endDate) {
      const start = new Date(this.startDate).getTime();
      const end = new Date(this.endDate).getTime() + (24 * 60 * 60 * 1000 - 1); // Include full end day
      filtered = filtered.filter(entry => {
        const entryDate = new Date(entry.date as string).getTime();
        return entryDate >= start && entryDate <= end;
      });
    }

    if (this.activeTypeFilter !== "All") {
      filtered = filtered.filter(entry => entry.type === this.activeTypeFilter);
    }

    this.filteredEntries = filtered;
    this.totalEntries = this.filteredEntries.length;
    this.currentPage = 1;
  }

  clearFilters(): void {
    this.startDate = "";
    this.endDate = "";
    this.searchTerm = "";
    this.activeTypeFilter = "All"; // Reset type filter
    this.applyFilters();
  }

  changeEntriesPerPage(event: any): void {
    this.entriesPerPage = parseInt(event.target.value, 10);
    this.currentPage = 1;
  }

  get paginatedEntries(): ReportEntry[] {
    const start = (this.currentPage - 1) * this.entriesPerPage;
    const end = start + this.entriesPerPage;
    return this.filteredEntries.slice(start, end);
  }

  nextPage(): void {
    if (this.currentPage * this.entriesPerPage < this.totalEntries) this.currentPage++;
  }

  previousPage(): void {
    if (this.currentPage > 1) this.currentPage--;
  }

  getTotalAmount(): number {
    return this.filteredEntries.reduce((total, entry) => total + entry.totalAmount, 0);
  }

  formatDate(date: any): string {
    if (!date) return "N/A";
    try {
      const d = (typeof date.toDate === 'function') ? date.toDate() : new Date(date);
      return this.datePipe.transform(d, "shortDate") || "";
    } catch (e) {
      return "Invalid Date";
    }
  }

  ngOnDestroy(): void {
    if (this.dataSub) this.dataSub.unsubscribe();
  }

  exportToCSV(): void {
    const csvData = this.filteredEntries.map(entry => ({
      Date: this.formatDate(entry.date),
      Type: entry.type,
      Amount: entry.totalAmount,
    }));
    const worksheet = XLSX.utils.json_to_sheet(csvData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "FinancialReport");
    const buffer = XLSX.write(workbook, { bookType: "csv", type: "array" });
    saveAs(new Blob([buffer], { type: "text/csv;charset=utf-8;" }), `financial_report_${new Date().toISOString().slice(0, 10)}.csv`);
  }

  exportToExcel(): void {
    const excelData = this.filteredEntries.map(entry => ({
      Date: this.formatDate(entry.date),
      Type: entry.type,
      Amount: entry.totalAmount,
    }));
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "FinancialReport");
    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8" }), `financial_report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }
}