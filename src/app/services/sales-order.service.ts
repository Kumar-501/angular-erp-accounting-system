import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  Firestore,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  serverTimestamp
} from '@angular/fire/firestore';
import { inject } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SalesOrderService {
  private salesOrders = new BehaviorSubject<any[]>([]);
  salesOrders$ = this.salesOrders.asObservable();
  private firestore: Firestore = inject(Firestore);

  constructor() { }

  addSale(saleData: any): Promise<void> {
    return new Promise((resolve) => {
      const currentSales = this.salesOrders.getValue();
      const updatedSales = [...currentSales, saleData];
      this.salesOrders.next(updatedSales);
      resolve();
    });
  }

  deleteSale(id: string): Promise<void> {
    return new Promise((resolve) => {
      const currentSales = this.salesOrders.getValue();
      const updatedSales = currentSales.filter(sale => sale.id !== id);
      this.salesOrders.next(updatedSales);
      resolve();
    });
  }

  async generateInvoiceId(): Promise<string> {
    try {
      // Get current date parts to create invoice prefix
      const now = new Date();
      const year = now.getFullYear().toString().substr(-2); // Last 2 digits of year
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const day = now.getDate().toString().padStart(2, '0');
      
      // Create date-based prefix
      const prefix = `INV-${year}${month}${day}-`;
      
      // Get count of invoices created today to create sequential number
      const salesCollection = collection(this.firestore, 'sales');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const q = query(
        salesCollection,
        where('createdAt', '>=', today),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const count = querySnapshot.size + 1;
      
      // Create sequential number (padded to 3 digits)
      const sequentialNumber = count.toString().padStart(3, '0');
      
      return `${prefix}${sequentialNumber}`;
    } catch (error) {
      console.error('Error generating invoice ID:', error);
      throw error;
    }
  }

  listenForSales(filters?: any) {
    // In a real app, this would connect to your backend
    // For now, we'll just return the BehaviorSubject
    return this.salesOrders$;
  }

  exportSales(format: string, filters: any): Promise<void> {
    // Implement export logic here
    return Promise.resolve();
  }

  generateOrderId(): Promise<string> {
    return new Promise((resolve) => {
      // Simple implementation - customize as needed
      const prefix = 'ORD';
      const date = new Date();
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      
      const orderId = `${prefix}-${year}${month}-${randomNum}`;
      resolve(orderId);
    });
  }
}