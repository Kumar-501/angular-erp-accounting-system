import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { StockData } from '../models/stock.mode';

@Injectable({
  providedIn: 'root'
})
export class OpeningStockService {
  private readonly COLLECTION_NAME = 'openingStocks';

  constructor(private firestore: AngularFirestore) { }

  addOpeningStock(stockData: StockData): Promise<void> {
    const id = this.firestore.createId();
    return this.firestore.collection(this.COLLECTION_NAME)
      .doc(id)
      .set({
        ...stockData,
        id,
        timestamp: new Date()
      });
  }

  getOpeningStocks() {
    return this.firestore.collection(this.COLLECTION_NAME).valueChanges();
  }

  // Add more methods as needed (update, delete, etc.)
}
