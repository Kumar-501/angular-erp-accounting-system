import { Injectable } from '@angular/core';
import { 
  Firestore, 
  collection, 
  query, 
  where, 
  getDocs, 
  Timestamp,
  orderBy,
  addDoc,
  doc,
  getDoc,
  deleteDoc,
  updateDoc,
  limit,
  QuerySnapshot,
  DocumentData,
  writeBatch,
  serverTimestamp
} from '@angular/fire/firestore';
import { Observable, from, forkJoin, combineLatest } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { formatDate } from '@angular/common';

// ==================== Core Data Interfaces ====================

export interface Sale {
  id?: string;
  date: Date;
  transactionId: string;
  businessLocation: string;
  customerId?: string;
  customerName?: string;
  items: SaleItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod: string;
  status: 'completed' | 'pending' | 'cancelled' | 'refunded';
  employeeId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SaleItem {
  productId: string;
  productName: string;
  category: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  discount?: number;
}

export interface Purchase {
  id?: string;
  date: Date;
  supplierId: string;
  supplierName: string;
  businessLocation: string;
  invoiceNumber: string;
  items: PurchaseItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: 'pending' | 'received' | 'cancelled';
  paymentStatus: 'unpaid' | 'partial' | 'paid';
  dueDate?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PurchaseItem {
  productId: string;
  productName: string;
  category: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

export interface Expense {
  id?: string;
  date: Date;
  category: string;
  subcategory?: string;
  description: string;
  amount: number;
  businessLocation: string;
  paymentMethod: string;
  vendor?: string;
  receiptUrl?: string;
  isRecurring: boolean;
  recurringPeriod?: 'monthly' | 'quarterly' | 'yearly';
  employeeId?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Employee {
  id?: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  position: string;
  department: string;
  businessLocation: string;
  hireDate: Date;
  salary: number;
  payType: 'hourly' | 'salary' | 'commission';
  status: 'active' | 'inactive' | 'terminated';
  bankAccount?: string;
  taxId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Payroll {
  id?: string;
  employeeId: string;
  employeeName: string;
  payPeriodStart: Date;
  payPeriodEnd: Date;
  businessLocation: string;
  basicSalary: number;
  overtime: number;
  bonus: number;
  commission: number;
  grossPay: number;
  taxDeductions: number;
  otherDeductions: number;
  netPay: number;
  status: 'draft' | 'processed' | 'paid';
  payDate?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Product {
  id?: string;
  productId: string;
  name: string;
  category: string;
  subcategory?: string;
  description?: string;
  sku: string;
  barcode?: string;
  unitPrice: number;
  costPrice: number;
  stockQuantity: number;
  minStockLevel: number;
  maxStockLevel: number;
  supplier?: string;
  businessLocation: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Customer {
  id?: string;
  customerId: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  businessLocation: string;
  totalPurchases: number;
  lastPurchaseDate?: Date;
  loyaltyPoints?: number;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Supplier {
  id?: string;
  supplierId: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  paymentTerms?: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// ==================== Report Interfaces ====================

export interface ReportFilter {
  startDate: Date;
  endDate: Date;
  businessLocation?: string;
  category?: string;
  type?: string;
  status?: string;
}

export interface FinancialSummary {
  totalSales: number;
  totalPurchases: number;
  totalIncome: number;
  totalExpenses: number;
  totalPayroll: number;
  netProfit: number;
  grossProfit: number;
}

export interface SalesReport {
  date: string;
  totalSales: number;
  totalTransactions: number;
  averageSale: number;
  productsSold: number;
}

export interface ProductPerformance {
  productId: string;
  productName: string;
  quantitySold: number;
  totalRevenue: number;
  averagePrice: number;
}

export interface ExpenseAnalysis {
  category: string;
  totalAmount: number;
  percentage: number;
}

export interface PayrollSummary {
  employeeCount: number;
  totalSalary: number;
  totalBonus: number;
  totalDeductions: number;
  netPayroll: number;
}

export interface StoredReport {
  id?: string;
  reportType: string;
  reportData: any;
  filter: any;
  generatedDate: Date;
  generatedBy?: string;
  reportName?: string;
  description?: string;
}

@Injectable({
  providedIn: 'root'
})
export class BusinessDataService {
  // Collection names
  private readonly UNIFIED_COLLECTION = 'businessData';
  private readonly SALES_COLLECTION = 'sales';
  private readonly PURCHASES_COLLECTION = 'purchases';
  private readonly EXPENSES_COLLECTION = 'expenses';
  private readonly EMPLOYEES_COLLECTION = 'employees';
  private readonly PAYROLL_COLLECTION = 'payroll';
  private readonly PRODUCTS_COLLECTION = 'products';
  private readonly CUSTOMERS_COLLECTION = 'customers';
  private readonly SUPPLIERS_COLLECTION = 'suppliers';
  private readonly REPORTS_COLLECTION = 'reports';

  constructor(private firestore: Firestore) { }

  // ==================== Unified Data Operations ====================

  private async addToUnifiedCollection(data: any, type: string, id?: string): Promise<void> {
    const unifiedRef = collection(this.firestore, this.UNIFIED_COLLECTION);
    const unifiedDoc = {
      ...data,
      type,
      originalId: id,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    await addDoc(unifiedRef, unifiedDoc);
  }

  private async updateUnifiedRecord(originalId: string, data: any): Promise<void> {
    const unifiedRef = collection(this.firestore, this.UNIFIED_COLLECTION);
    const q = query(unifiedRef, where('originalId', '==', originalId), limit(1));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const docRef = doc(this.firestore, this.UNIFIED_COLLECTION, querySnapshot.docs[0].id);
      await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp()
      });
    }
  }

  private async deleteUnifiedRecord(originalId: string): Promise<void> {
    const unifiedRef = collection(this.firestore, this.UNIFIED_COLLECTION);
    const q = query(unifiedRef, where('originalId', '==', originalId), limit(1));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const docRef = doc(this.firestore, this.UNIFIED_COLLECTION, querySnapshot.docs[0].id);
      await deleteDoc(docRef);
    }
  }

  getUnifiedData(filter: {
    types?: string[];
    startDate?: Date;
    endDate?: Date;
    businessLocation?: string;
  }): Observable<any[]> {
    return new Observable(observer => {
      const unifiedRef = collection(this.firestore, this.UNIFIED_COLLECTION);
      let q = query(unifiedRef, orderBy('date', 'desc'));

      const conditions = [];

      if (filter.types && filter.types.length > 0) {
        conditions.push(where('type', 'in', filter.types));
      }

      if (filter.startDate) {
        conditions.push(where('date', '>=', Timestamp.fromDate(filter.startDate)));
      }

      if (filter.endDate) {
        conditions.push(where('date', '<=', Timestamp.fromDate(filter.endDate)));
      }

      if (filter.businessLocation) {
        conditions.push(where('businessLocation', '==', filter.businessLocation));
      }

      if (conditions.length > 0) {
        q = query(q, ...conditions);
      }

      getDocs(q).then(querySnapshot => {
        const data: any[] = [];
        querySnapshot.forEach(doc => {
          const docData = doc.data();
          data.push({
            id: doc.id,
            ...docData,
            date: docData['date']?.toDate(),
            createdAt: docData['createdAt']?.toDate(),
            updatedAt: docData['updatedAt']?.toDate()
          });
        });
        observer.next(data);
        observer.complete();
      }).catch(error => observer.error(error));
    });
  }

  // ==================== SALES OPERATIONS ====================

  async addSale(sale: Sale): Promise<string> {
    try {
      const salesRef = collection(this.firestore, this.SALES_COLLECTION);
      const saleDoc = {
        ...sale,
        date: Timestamp.fromDate(sale.date),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      const docRef = await addDoc(salesRef, saleDoc);
      
      // Add to unified collection
      await this.addToUnifiedCollection(saleDoc, 'sale', docRef.id);
      
      return docRef.id;
    } catch (error) {
      console.error('Error adding sale:', error);
      throw error;
    }
  }

  async updateSale(saleId: string, sale: Partial<Sale>): Promise<void> {
    try {
      const saleRef = doc(this.firestore, this.SALES_COLLECTION, saleId);
      const updateData = {
        ...sale,
        ...(sale.date && { date: Timestamp.fromDate(sale.date) }),
        updatedAt: serverTimestamp()
      };
      await updateDoc(saleRef, updateData);
      
      // Update unified record
      await this.updateUnifiedRecord(saleId, updateData);
    } catch (error) {
      console.error('Error updating sale:', error);
      throw error;
    }
  }

  async deleteSale(saleId: string): Promise<void> {
    try {
      const saleRef = doc(this.firestore, this.SALES_COLLECTION, saleId);
      await deleteDoc(saleRef);
      
      // Delete unified record
      await this.deleteUnifiedRecord(saleId);
    } catch (error) {
      console.error('Error deleting sale:', error);
      throw error;
    }
  }

  getSales(filter?: ReportFilter): Observable<Sale[]> {
    return new Observable(observer => {
      const salesRef = collection(this.firestore, this.SALES_COLLECTION);
      let q = query(salesRef, orderBy('date', 'desc'));

      if (filter) {
        q = query(q, 
          where('date', '>=', Timestamp.fromDate(filter.startDate)),
          where('date', '<=', Timestamp.fromDate(filter.endDate))
        );
        
        if (filter.businessLocation) {
          q = query(q, where('businessLocation', '==', filter.businessLocation));
        }
      }

      getDocs(q).then(querySnapshot => {
        const sales: Sale[] = [];
        querySnapshot.forEach(doc => {
          const data = doc.data();
          sales.push({
            id: doc.id,
            ...data,
            date: data['date'].toDate(),
            createdAt: data['createdAt']?.toDate(),
            updatedAt: data['updatedAt']?.toDate()
          } as Sale);
        });
        observer.next(sales);
        observer.complete();
      }).catch(error => observer.error(error));
    });
  }

  // ==================== PURCHASES OPERATIONS ====================

  async addPurchase(purchase: Purchase): Promise<string> {
    try {
      const purchasesRef = collection(this.firestore, this.PURCHASES_COLLECTION);
      const purchaseDoc = {
        ...purchase,
        date: Timestamp.fromDate(purchase.date),
        dueDate: purchase.dueDate ? Timestamp.fromDate(purchase.dueDate) : null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      const docRef = await addDoc(purchasesRef, purchaseDoc);
      
      // Add to unified collection
      await this.addToUnifiedCollection(purchaseDoc, 'purchase', docRef.id);
      
      return docRef.id;
    } catch (error) {
      console.error('Error adding purchase:', error);
      throw error;
    }
  }

  async updatePurchase(purchaseId: string, purchase: Partial<Purchase>): Promise<void> {
    try {
      const purchaseRef = doc(this.firestore, this.PURCHASES_COLLECTION, purchaseId);
      const updateData = {
        ...purchase,
        ...(purchase.date && { date: Timestamp.fromDate(purchase.date) }),
        ...(purchase.dueDate && { dueDate: Timestamp.fromDate(purchase.dueDate) }),
        updatedAt: serverTimestamp()
      };
      await updateDoc(purchaseRef, updateData);
      
      // Update unified record
      await this.updateUnifiedRecord(purchaseId, updateData);
    } catch (error) {
      console.error('Error updating purchase:', error);
      throw error;
    }
  }

  async deletePurchase(purchaseId: string): Promise<void> {
    try {
      const purchaseRef = doc(this.firestore, this.PURCHASES_COLLECTION, purchaseId);
      await deleteDoc(purchaseRef);
      
      // Delete unified record
      await this.deleteUnifiedRecord(purchaseId);
    } catch (error) {
      console.error('Error deleting purchase:', error);
      throw error;
    }
  }

  getPurchases(filter?: ReportFilter): Observable<Purchase[]> {
    return new Observable(observer => {
      const purchasesRef = collection(this.firestore, this.PURCHASES_COLLECTION);
      let q = query(purchasesRef, orderBy('date', 'desc'));

      if (filter) {
        q = query(q, 
          where('date', '>=', Timestamp.fromDate(filter.startDate)),
          where('date', '<=', Timestamp.fromDate(filter.endDate))
        );
        
        if (filter.businessLocation) {
          q = query(q, where('businessLocation', '==', filter.businessLocation));
        }
      }

      getDocs(q).then(querySnapshot => {
        const purchases: Purchase[] = [];
        querySnapshot.forEach(doc => {
          const data = doc.data();
          purchases.push({
            id: doc.id,
            ...data,
            date: data['date'].toDate(),
            dueDate: data['dueDate']?.toDate(),
            createdAt: data['createdAt']?.toDate(),
            updatedAt: data['updatedAt']?.toDate()
          } as Purchase);
        });
        observer.next(purchases);
        observer.complete();
      }).catch(error => observer.error(error));
    });
  }

  // ==================== EXPENSES OPERATIONS ====================

  async addExpense(expense: Expense): Promise<string> {
    try {
      const expensesRef = collection(this.firestore, this.EXPENSES_COLLECTION);
      const expenseDoc = {
        ...expense,
        date: Timestamp.fromDate(expense.date),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      const docRef = await addDoc(expensesRef, expenseDoc);
      
      // Add to unified collection
      await this.addToUnifiedCollection(expenseDoc, 'expense', docRef.id);
      
      return docRef.id;
    } catch (error) {
      console.error('Error adding expense:', error);
      throw error;
    }
  }

  async updateExpense(expenseId: string, expense: Partial<Expense>): Promise<void> {
    try {
      const expenseRef = doc(this.firestore, this.EXPENSES_COLLECTION, expenseId);
      const updateData = {
        ...expense,
        ...(expense.date && { date: Timestamp.fromDate(expense.date) }),
        updatedAt: serverTimestamp()
      };
      await updateDoc(expenseRef, updateData);
      
      // Update unified record
      await this.updateUnifiedRecord(expenseId, updateData);
    } catch (error) {
      console.error('Error updating expense:', error);
      throw error;
    }
  }

  async deleteExpense(expenseId: string): Promise<void> {
    try {
      const expenseRef = doc(this.firestore, this.EXPENSES_COLLECTION, expenseId);
      await deleteDoc(expenseRef);
      
      // Delete unified record
      await this.deleteUnifiedRecord(expenseId);
    } catch (error) {
      console.error('Error deleting expense:', error);
      throw error;
    }
  }

  getExpenses(filter?: ReportFilter): Observable<Expense[]> {
    return new Observable(observer => {
      const expensesRef = collection(this.firestore, this.EXPENSES_COLLECTION);
      let q = query(expensesRef, orderBy('date', 'desc'));

      if (filter) {
        q = query(q, 
          where('date', '>=', Timestamp.fromDate(filter.startDate)),
          where('date', '<=', Timestamp.fromDate(filter.endDate))
        );
        
        if (filter.businessLocation) {
          q = query(q, where('businessLocation', '==', filter.businessLocation));
        }
        
        if (filter.category) {
          q = query(q, where('category', '==', filter.category));
        }
      }

      getDocs(q).then(querySnapshot => {
        const expenses: Expense[] = [];
        querySnapshot.forEach(doc => {
          const data = doc.data();
          expenses.push({
            id: doc.id,
            ...data,
            date: data['date'].toDate(),
            createdAt: data['createdAt']?.toDate(),
            updatedAt: data['updatedAt']?.toDate()
          } as Expense);
        });
        observer.next(expenses);
        observer.complete();
      }).catch(error => observer.error(error));
    });
  }

  // ==================== PAYROLL OPERATIONS ====================

  async addPayroll(payroll: Payroll): Promise<string> {
    try {
      const payrollRef = collection(this.firestore, this.PAYROLL_COLLECTION);
      const payrollDoc = {
        ...payroll,
        payPeriodStart: Timestamp.fromDate(payroll.payPeriodStart),
        payPeriodEnd: Timestamp.fromDate(payroll.payPeriodEnd),
        payDate: payroll.payDate ? Timestamp.fromDate(payroll.payDate) : null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      const docRef = await addDoc(payrollRef, payrollDoc);
      
      // Add to unified collection (use payPeriodStart as the date for sorting)
      const unifiedPayrollDoc = {
        ...payrollDoc,
        date: payrollDoc.payPeriodStart // Use payPeriodStart as the main date
      };
      await this.addToUnifiedCollection(unifiedPayrollDoc, 'payroll', docRef.id);
      
      return docRef.id;
    } catch (error) {
      console.error('Error adding payroll:', error);
      throw error;
    }
  }

  async updatePayroll(payrollId: string, payroll: Partial<Payroll>): Promise<void> {
    try {
      const payrollRef = doc(this.firestore, this.PAYROLL_COLLECTION, payrollId);
      const updateData = {
        ...payroll,
        ...(payroll.payPeriodStart && { payPeriodStart: Timestamp.fromDate(payroll.payPeriodStart) }),
        ...(payroll.payPeriodEnd && { payPeriodEnd: Timestamp.fromDate(payroll.payPeriodEnd) }),
        ...(payroll.payDate && { payDate: Timestamp.fromDate(payroll.payDate) }),
        updatedAt: serverTimestamp()
      };
      await updateDoc(payrollRef, updateData);
      
      // Update unified record
      const unifiedUpdateData = {
        ...updateData,
        ...(updateData.payPeriodStart && { date: updateData.payPeriodStart })
      };
      await this.updateUnifiedRecord(payrollId, unifiedUpdateData);
    } catch (error) {
      console.error('Error updating payroll:', error);
      throw error;
    }
  }

  async deletePayroll(payrollId: string): Promise<void> {
    try {
      const payrollRef = doc(this.firestore, this.PAYROLL_COLLECTION, payrollId);
      await deleteDoc(payrollRef);
      
      // Delete unified record
      await this.deleteUnifiedRecord(payrollId);
    } catch (error) {
      console.error('Error deleting payroll:', error);
      throw error;
    }
  }

  getPayroll(filter?: ReportFilter): Observable<Payroll[]> {
    return new Observable(observer => {
      const payrollRef = collection(this.firestore, this.PAYROLL_COLLECTION);
      let q = query(payrollRef, orderBy('payPeriodStart', 'desc'));

      if (filter) {
        q = query(q, 
          where('payPeriodStart', '>=', Timestamp.fromDate(filter.startDate)),
          where('payPeriodEnd', '<=', Timestamp.fromDate(filter.endDate))
        );
        
        if (filter.businessLocation) {
          q = query(q, where('businessLocation', '==', filter.businessLocation));
        }
      }

      getDocs(q).then(querySnapshot => {
        const payroll: Payroll[] = [];
        querySnapshot.forEach(doc => {
          const data = doc.data();
          payroll.push({
            id: doc.id,
            ...data,
            payPeriodStart: data['payPeriodStart'].toDate(),
            payPeriodEnd: data['payPeriodEnd'].toDate(),
            payDate: data['payDate']?.toDate(),
            createdAt: data['createdAt']?.toDate(),
            updatedAt: data['updatedAt']?.toDate()
          } as Payroll);
        });
        observer.next(payroll);
        observer.complete();
      }).catch(error => observer.error(error));
    });
  }

  // ==================== EMPLOYEES OPERATIONS ====================

  async addEmployee(employee: Employee): Promise<string> {
    try {
      const employeesRef = collection(this.firestore, this.EMPLOYEES_COLLECTION);
      const employeeDoc = {
        ...employee,
        hireDate: Timestamp.fromDate(employee.hireDate),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      const docRef = await addDoc(employeesRef, employeeDoc);
      return docRef.id;
    } catch (error) {
      console.error('Error adding employee:', error);
      throw error;
    }
  }

  async updateEmployee(employeeId: string, employee: Partial<Employee>): Promise<void> {
    try {
      const employeeRef = doc(this.firestore, this.EMPLOYEES_COLLECTION, employeeId);
      const updateData = {
        ...employee,
        ...(employee.hireDate && { hireDate: Timestamp.fromDate(employee.hireDate) }),
        updatedAt: serverTimestamp()
      };
      await updateDoc(employeeRef, updateData);
    } catch (error) {
      console.error('Error updating employee:', error);
      throw error;
    }
  }

  async deleteEmployee(employeeId: string): Promise<void> {
    try {
      const employeeRef = doc(this.firestore, this.EMPLOYEES_COLLECTION, employeeId);
      await deleteDoc(employeeRef);
    } catch (error) {
      console.error('Error deleting employee:', error);
      throw error;
    }
  }

  getEmployees(businessLocation?: string): Observable<Employee[]> {
    return new Observable(observer => {
      const employeesRef = collection(this.firestore, this.EMPLOYEES_COLLECTION);
      let q = query(employeesRef, orderBy('firstName', 'asc'));

      if (businessLocation) {
        q = query(q, where('businessLocation', '==', businessLocation));
      }

      getDocs(q).then(querySnapshot => {
        const employees: Employee[] = [];
        querySnapshot.forEach(doc => {
          const data = doc.data();
          employees.push({
            id: doc.id,
            ...data,
            hireDate: data['hireDate'].toDate(),
            createdAt: data['createdAt']?.toDate(),
            updatedAt: data['updatedAt']?.toDate()
          } as Employee);
        });
        observer.next(employees);
        observer.complete();
      }).catch(error => observer.error(error));
    });
  }

  // ==================== OTHER CRUD OPERATIONS ====================
  // Products, Customers, Suppliers operations remain the same as in your original code
  // but you can add unified collection support if needed

  async addProduct(product: Product): Promise<string> {
    try {
      const productsRef = collection(this.firestore, this.PRODUCTS_COLLECTION);
      const productDoc = {
        ...product,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      const docRef = await addDoc(productsRef, productDoc);
      return docRef.id;
    } catch (error) {
      console.error('Error adding product:', error);
      throw error;
    }
  }

  getProducts(businessLocation?: string): Observable<Product[]> {
    return new Observable(observer => {
      const productsRef = collection(this.firestore, this.PRODUCTS_COLLECTION);
      let q = query(productsRef, orderBy('name', 'asc'));

      if (businessLocation) {
        q = query(q, where('businessLocation', '==', businessLocation));
      }

      getDocs(q).then(querySnapshot => {
        const products: Product[] = [];
        querySnapshot.forEach(doc => {
          const data = doc.data();
          products.push({
            id: doc.id,
            ...data,
            createdAt: data['createdAt']?.toDate(),
            updatedAt: data['updatedAt']?.toDate()
          } as Product);
        });
        observer.next(products);
        observer.complete();
      }).catch(error => observer.error(error));
    });
  }

  // ==================== ENHANCED REPORT GENERATION ====================

  generateFinancialSummary(
    filter: ReportFilter,
    saveToFirestore: boolean = true,
    generatedBy?: string
  ): Observable<FinancialSummary> {
    return this.getUnifiedData({
      types: ['sale', 'purchase', 'expense', 'payroll'],
      startDate: filter.startDate,
      endDate: filter.endDate,
      businessLocation: filter.businessLocation
    }).pipe(
      map(data => {
        const sales = data.filter(d => d.type === 'sale');
        const purchases = data.filter(d => d.type === 'purchase');
        const expenses = data.filter(d => d.type === 'expense');
        const payrolls = data.filter(d => d.type === 'payroll');

        const totalSales = sales.reduce((sum, sale) => sum + sale.total, 0);
        const totalPurchases = purchases.reduce((sum, purchase) => sum + purchase.total, 0);
        const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
        const totalPayroll = payrolls.reduce((sum, payroll) => sum + payroll.netPay, 0);
        
        const summary: FinancialSummary = {
          totalSales,
          totalPurchases,
          totalIncome: totalSales,
          totalExpenses: totalExpenses + totalPayroll,
          totalPayroll,
          grossProfit: totalSales - totalPurchases,
          netProfit: totalSales - totalPurchases - totalExpenses - totalPayroll
        };

        if (saveToFirestore) {
          this.saveReport(
            'financial-summary',
            summary,
            filter,
            'Financial Summary Report',
            generatedBy
          );
        }

        return summary;
      })
    );
  }

  // ======
  // ==================== REPORTS OPERATIONS ====================

  async saveReport(
    reportType: string,
    reportData: any,
    filter: ReportFilter,
    reportName: string,
    generatedBy?: string
  ): Promise<string> {
    try {
      const reportsRef = collection(this.firestore, this.REPORTS_COLLECTION);
      
      const reportDoc: StoredReport = {
        reportType: reportType,
        reportData: reportData,
        filter: {
          ...filter,
          startDate: Timestamp.fromDate(filter.startDate),
          endDate: Timestamp.fromDate(filter.endDate)
        },
        generatedDate: new Date(),
        generatedBy: generatedBy,
        reportName: reportName,
        description: `${reportName} generated from ${formatDate(filter.startDate, 'yyyy-MM-dd', 'en-US')} to ${formatDate(filter.endDate, 'yyyy-MM-dd', 'en-US')}`
      };

      const docRef = await addDoc(reportsRef, reportDoc);
      return docRef.id;
    } catch (error) {
      console.error('Error saving report:', error);
      throw error;
    }
  }

  getReports(options?: {
    reportType?: string;
    limit?: number;
    startAfter?: Date;
  }): Observable<StoredReport[]> {
    return new Observable(observer => {
      const reportsRef = collection(this.firestore, this.REPORTS_COLLECTION);
      
      let q = query(reportsRef, orderBy('generatedDate', 'desc'));
      
      if (options?.reportType) {
        q = query(q, where('reportType', '==', options.reportType));
      }
      
      if (options?.limit) {
        q = query(q, limit(options.limit));
      }

      getDocs(q).then(querySnapshot => {
        const reports: StoredReport[] = [];
        
        querySnapshot.forEach(doc => {
          const data = doc.data();
          reports.push({
            id: doc.id,
            reportType: data['reportType'],
            reportData: data['reportData'],
            filter: this.convertFilterTimestamps(data['filter']),
            generatedDate: data['generatedDate'].toDate(),
            generatedBy: data['generatedBy'],
            reportName: data['reportName'],
            description: data['description']
          });
        });

        observer.next(reports);
        observer.complete();
      }).catch(error => observer.error(error));
    });
  }

  deleteReport(reportId: string): Promise<void> {
    return deleteDoc(doc(this.firestore, this.REPORTS_COLLECTION, reportId));
  }

  // ==================== REPORT GENERATION WITH REAL DATA ====================


  generateSalesReport(
    filter: ReportFilter,
    saveToFirestore: boolean = true,
    generatedBy?: string
  ): Observable<SalesReport[]> {
    return new Observable(observer => {
      this.getSales(filter).subscribe({
        next: (sales) => {
          // Group sales by date
          const salesByDate = new Map<string, Sale[]>();
          
          sales.forEach(sale => {
            const dateKey = formatDate(sale.date, 'yyyy-MM-dd', 'en-US');
            if (!salesByDate.has(dateKey)) {
              salesByDate.set(dateKey, []);
            }
            salesByDate.get(dateKey)!.push(sale);
          });

          // Generate report data
          const reportData: SalesReport[] = Array.from(salesByDate.entries()).map(([date, dailySales]) => {
            const totalSales = dailySales.reduce((sum, sale) => sum + sale.total, 0);
            const totalTransactions = dailySales.length;
            const productsSold = dailySales.reduce((sum, sale) => 
              sum + sale.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);

            return {
              date,
              totalSales,
              totalTransactions,
              averageSale: totalTransactions > 0 ? totalSales / totalTransactions : 0,
              productsSold
            };
          }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

          if (saveToFirestore) {
            this.saveReport(
              'sales-report',
              reportData,
              filter,
              'Sales Report',
              generatedBy
            ).then(() => {
              observer.next(reportData);
              observer.complete();
            }).catch(error => observer.error(error));
          } else {
            observer.next(reportData);
            observer.complete();
          }
        },
        error: (error) => observer.error(error)
      });
    });
  }

  generateProductPerformance(
    filter: ReportFilter,
    saveToFirestore: boolean = true,
    generatedBy?: string
  ): Observable<ProductPerformance[]> {
    return new Observable(observer => {
      this.getSales(filter).subscribe({
        next: (sales) => {
          // Aggregate product performance
          const productMap = new Map<string, {
            productName: string;
            quantitySold: number;
            totalRevenue: number;
            totalPrice: number;
            saleCount: number;
          }>();

          sales.forEach(sale => {
            sale.items.forEach(item => {
              if (!productMap.has(item.productId)) {
                productMap.set(item.productId, {
                  productName: item.productName,
                  quantitySold: 0,
                  totalRevenue: 0,
                  totalPrice: 0,
                  saleCount: 0
                });
              }

              const product = productMap.get(item.productId)!;
              product.quantitySold += item.quantity;
              product.totalRevenue += item.totalPrice;
              product.totalPrice += item.unitPrice;
              product.saleCount += 1;
            });
          });

          const reportData: ProductPerformance[] = Array.from(productMap.entries()).map(([productId, data]) => ({
            productId,
            productName: data.productName,
            quantitySold: data.quantitySold,
            totalRevenue: data.totalRevenue,
            averagePrice: data.saleCount > 0 ? data.totalPrice / data.saleCount : 0
          })).sort((a, b) => b.totalRevenue - a.totalRevenue);

          if (saveToFirestore) {
            this.saveReport(
              'product-performance',
              reportData,
              filter,
              'Product Performance Report',
              generatedBy
            ).then(() => {
              observer.next(reportData);
              observer.complete();
            }).catch(error => observer.error(error));
          } else {
            observer.next(reportData);
            observer.complete();
          }
        },
        error: (error) => observer.error(error)
      });
    });
  }

  // ==================== HELPER METHODS ====================

  private convertFilterTimestamps(filter: any): ReportFilter {
    return {
      ...filter,
      startDate: filter.startDate.toDate(),
      endDate: filter.endDate.toDate()
    };
  }

  exportToCSV(data: any[], fileName: string): void {
    if (!data || data.length === 0) return;

    // Extract headers
    const headers = Object.keys(data[0]);
    
    // Create CSV content
    let csvContent = headers.join(',') + '\n';
    
    data.forEach(row => {
      const values = headers.map(header => {
        const value = row[header];
        // Handle dates and special characters
        return value instanceof Date 
          ? formatDate(value, 'yyyy-MM-dd', 'en-US')
          : String(value).replace(/"/g, '""');
      });
      csvContent += values.join(',') + '\n';
    });

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${fileName}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}