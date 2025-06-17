import { Injectable } from '@angular/core';
import { Firestore, doc, onSnapshot, setDoc } from '@angular/fire/firestore';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SkuGeneratorService {
  private skuCounterDoc;
  private currentSkuCount = new BehaviorSubject<number>(100000);

  constructor(private firestore: Firestore) {
    // Initialize after constructor
    this.skuCounterDoc = doc(this.firestore, 'counters/sku');
    this.setupRealtimeListener();
  }

  private setupRealtimeListener(): void {
    onSnapshot(this.skuCounterDoc, (snapshot) => {
      if (snapshot.exists()) {
        const count = snapshot.data()['lastSku'] || 100000;
        this.currentSkuCount.next(count);
      }
    }, (error) => {
      console.error('Error listening to SKU counter:', error);
    });
  }

  async getNextSku(): Promise<string> {
    try {
      // Get current count from BehaviorSubject
      const currentCount = this.currentSkuCount.value;
      const nextSku = (currentCount + 1).toString();
      
      // Update counter in Firestore
      await setDoc(this.skuCounterDoc, { lastSku: currentCount + 1 }, { merge: true });
      
      return nextSku;
    } catch (error) {
      console.error('Error generating SKU:', error);
      // Fallback to timestamp if error occurs
      return Date.now().toString().slice(-6);
    }
  }

  // Optional: Get SKU count as observable
  getSkuCount(): Observable<number> {
    return this.currentSkuCount.asObservable();
  }
}