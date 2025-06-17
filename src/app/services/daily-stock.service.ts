// Create a new file: daily-stock.service.ts
import { Injectable } from '@angular/core';
import { Firestore, collection, doc, setDoc, writeBatch } from '@angular/fire/firestore';
import { StockService } from './stock.service';
import { ProductsService } from './products.service';

@Injectable({
  providedIn: 'root'
})
export class DailyStockService {
  getDailyStockSnapshot: any;
  constructor(
    private firestore: Firestore,
    private stockService: StockService,
    private productsService: ProductsService
  ) {}

  async initializeTodaysStock(): Promise<void> {
    const today = new Date();
    today.setHours(5, 1, 0, 0); // Business day starts at 5:01 AM
    
    try {
      await this.stockService.initializeDailyStock(today);
      console.log('Successfully initialized today\'s stock records');
    } catch (error) {
      console.error('Error initializing today\'s stock:', error);
      throw error;
    }
  }

  async closeYesterdaysStock(): Promise<void> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(23, 59, 59, 0); // Business day ends at 11:59 PM
    
    try {
      await this.stockService.closeBusinessDay(yesterday);
      console.log('Successfully closed yesterday\'s stock records');
    } catch (error) {
      console.error('Error closing yesterday\'s stock:', error);
      throw error;
    }
  }

  async runDailyStockTasks(): Promise<void> {
    try {
      // Close yesterday's records first
      await this.closeYesterdaysStock();
      
      // Then initialize today's records
      await this.initializeTodaysStock();
    } catch (error) {
      console.error('Error running daily stock tasks:', error);
      throw error;
    }
  }
}