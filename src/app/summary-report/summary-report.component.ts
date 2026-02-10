import { Component, OnInit } from '@angular/core';
import { SaleService } from '../services/sale.service';
import { PurchaseService } from '../services/purchase.service';
import { ExpenseService } from '../services/expense.service';
import { DatePipe } from '@angular/common';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

@Component({
  selector: 'app-summary-report',
  templateUrl: './summary-report.component.html',
  styleUrls: ['./summary-report.component.scss'],
  providers: [DatePipe]
})

export class SummaryReportComponent implements OnInit {
  calculateTaxByRate(items: any[], rate: number): number {
    if (!items) return 0;
    return items.reduce((sum, item) => {
      const itemRate = item.taxRate || 0;
      return sum + (Math.abs(itemRate - rate) < 0.01 ? (item.tax || 0) : 0);
    }, 0);
  }
  calculatePurchaseTaxByRate(items: any[], rate: number): number {
    if (!items) return 0;
    return items.reduce((sum, item) => {
      if (item?.taxByRate && item.taxByRate[rate]) {
        return sum + (item.taxByRate[rate] || 0);
      }
      return sum;
    }, 0);
  }

  calculateExpenseTaxByRate(items: any[], rate: number): number {
    if (!items) return 0;
    return items.reduce((sum, item) => {
      const itemRate = item.taxRate || 0;
      return sum + (Math.abs(itemRate - rate) < 0.01 ? (item.tax || 0) : 0);
    }, 0);
  }

  startDate: string;
  endDate: string;
  loading = false;
  vatSummary: any = {};
  taxRates: number[] = [0, 2.5, 4]; // Example tax rates

  constructor(
    private saleService: SaleService,
    private purchaseService: PurchaseService,
    private expenseService: ExpenseService,
    private datePipe: DatePipe
  ) {
    // Default to current month
    const today = new Date();
    this.startDate = this.datePipe.transform(new Date(today.getFullYear(), today.getMonth(), 1), 'yyyy-MM-dd')!;
    this.endDate = this.datePipe.transform(today, 'yyyy-MM-dd')!;
  }

  ngOnInit(): void {
    this.generateReport();
  }

  generateReport(): void {
    this.loading = true;
    this.vatSummary = {
      inputTax: 0,
      outputTax: 0,
      expenseTax: 0,
      netTax: 0,
      details: {
        sales: [],
        purchases: [],
        expenses: []
      }
    };

    // Get sales data
    this.saleService.listenForSales({
      dateRange: {
        startDate: this.startDate,
        endDate: this.endDate
      }
    }).subscribe(sales => {
      this.processSales(sales);
    });

    // Get purchases data
    this.purchaseService.getPurchases().subscribe(purchases => {
      this.processPurchases(purchases);
    });

    // Get expenses data
    this.expenseService.getExpenses().subscribe(expenses => {
      this.processExpenses(expenses);
    });
  }

  private processSales(sales: any[]): void {
    let outputTax = 0;
    const filteredSales = sales.filter(sale => {
      const saleDate = new Date(sale.saleDate);
      const start = new Date(this.startDate);
      const end = new Date(this.endDate);
      return saleDate >= start && saleDate <= end;
    });

    filteredSales.forEach(sale => {
      const tax = sale.orderTax || 0;
      outputTax += tax;

      this.vatSummary.details.sales.push({
        date: sale.saleDate,
        document: sale.invoiceNo,
        amount: sale.totalAmount,
        tax: tax,
        taxRate: this.calculateTaxRate(sale.totalAmount, tax)
      });
    });

    this.vatSummary.outputTax = outputTax;
    this.calculateNetTax();
  }

  private processPurchases(purchases: any[]): void {
    let inputTax = 0;
    const filteredPurchases = purchases.filter(purchase => {
      const purchaseDate = new Date(purchase.purchaseDate);
      const start = new Date(this.startDate);
      const end = new Date(this.endDate);
      return purchaseDate >= start && purchaseDate <= end;
    });

    filteredPurchases.forEach(purchase => {
      const tax = purchase.totalTax || 0;
      inputTax += tax;

      // Calculate tax by rate if products are available
      const taxByRate: any = {};
      if (purchase.products) {
        purchase.products.forEach((product: any) => {
          const rate = product.taxRate || 0;
          if (!taxByRate[rate]) {
            taxByRate[rate] = 0;
          }
          taxByRate[rate] += product.taxAmount || 0;
        });
      }

      this.vatSummary.details.purchases.push({
        date: purchase.purchaseDate,
        document: purchase.referenceNo,
        amount: purchase.purchaseTotal,
        tax: tax,
        taxByRate: taxByRate
      });
    });

    this.vatSummary.inputTax = inputTax;
    this.calculateNetTax();
  }

  private processExpenses(expenses: any[]): void {
    let expenseTax = 0;
    const filteredExpenses = expenses.filter(expense => {
      const expenseDate = new Date(expense.date);
      const start = new Date(this.startDate);
      const end = new Date(this.endDate);
      return expenseDate >= start && expenseDate <= end;
    });

    filteredExpenses.forEach(expense => {
      // Assuming applicableTax is a percentage (e.g., "15%")
      const taxRate = parseFloat(expense.applicableTax) || 0;
      const tax = (expense.totalAmount * taxRate) / 100;
      expenseTax += tax;

      this.vatSummary.details.expenses.push({
        date: expense.date,
        document: expense.referenceNo,
        amount: expense.totalAmount,
        tax: tax,
        taxRate: taxRate
      });
    });

    this.vatSummary.expenseTax = expenseTax;
    this.calculateNetTax();
  }

  private calculateNetTax(): void {
    this.vatSummary.netTax = this.vatSummary.outputTax - this.vatSummary.inputTax - this.vatSummary.expenseTax;
    this.loading = false;
  }

  private calculateTaxRate(amount: number, tax: number): number {
    if (!amount || amount === 0) return 0;
    return (tax / amount) * 100;
  }

  onDateChange(): void {
    this.generateReport();
  }

  exportToExcel(): void {
    const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(this.getExcelData());
    const workbook: XLSX.WorkBook = { Sheets: { 'data': worksheet }, SheetNames: ['data'] };
    const excelBuffer: any = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    this.saveAsExcelFile(excelBuffer, 'VAT_Summary_Report');
  }

  private getExcelData(): any[] {
    const excelData: any[] = [];

    // Add Sales Data
    if (this.vatSummary.details?.sales?.length > 0) {
      excelData.push({ 'Type': 'Output Tax (Sales)', 'Total': this.vatSummary.outputTax });
      this.vatSummary.details.sales.forEach((sale: any) => {
        excelData.push({
          'Type': 'SALE',
          'Date': this.datePipe.transform(sale.date, 'shortDate'),
          'Reference': sale.document,
          'Amount': sale.amount,
          'Tax Rate (%)': sale.taxRate,
          'Tax Amount': sale.tax
        });
      });
    }

    // Add Purchase Data
    if (this.vatSummary.details?.purchases?.length > 0) {
      excelData.push({ 'Type': 'Input Tax (Purchases)', 'Total': this.vatSummary.inputTax });
      this.vatSummary.details.purchases.forEach((purchase: any) => {
        excelData.push({
          'Type': 'PURCHASE',
          'Date': this.datePipe.transform(purchase.date, 'shortDate'),
          'Reference': purchase.document,
          'Amount': purchase.amount,
          'Tax Rate (%)': purchase.taxRate,
          'Tax Amount': purchase.tax
        });
      });
    }

    // Add Expense Data
    if (this.vatSummary.details?.expenses?.length > 0) {
      excelData.push({ 'Type': 'Expense Tax', 'Total': this.vatSummary.expenseTax });
      this.vatSummary.details.expenses.forEach((expense: any) => {
        excelData.push({
          'Type': 'EXPENSE',
          'Date': this.datePipe.transform(expense.date, 'shortDate'),
          'Reference': expense.document,
          'Amount': expense.amount,
          'Tax Rate (%)': expense.taxRate,
          'Tax Amount': expense.tax
        });
      });
    }

    return excelData;
  }

  private saveAsExcelFile(buffer: any, fileName: string): void {
    const data: Blob = new Blob([buffer], { type: 'application/octet-stream' });
    saveAs(data, fileName + '_export_' + new Date().getTime() + '.xlsx');
  }
}