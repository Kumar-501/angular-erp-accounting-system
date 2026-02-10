import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class SalesReturnService {
  constructor(private firestore: AngularFirestore) {}

  // Save a new return with proper tax tracking
  createReturn(returnData: any): Promise<any> {
    // Ensure tax amounts are properly calculated and stored
    const enhancedReturnData = {
      ...returnData,
      // Calculate total product tax returned
      totalProductTaxReturned: this.calculateProductTaxReturned(returnData.returnedItems),
      // Calculate shipping tax returned (only for full returns)
      totalShippingTaxReturned: returnData.isFullReturn ? (returnData.shippingTaxRefunded || 0) : 0,
      // Calculate total tax impact (product + shipping tax)
      totalTaxImpact: this.calculateTotalTaxImpact(returnData),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return this.firestore.collection('salesReturns').add(enhancedReturnData);
  }

  // Calculate total product tax returned from returned items
  private calculateProductTaxReturned(returnedItems: any[]): number {
    if (!returnedItems || !Array.isArray(returnedItems)) return 0;
    
    return returnedItems.reduce((total, item) => {
      const taxAmount = Number(item.taxAmount) || 0;
      return total + taxAmount;
    }, 0);
  }

  // Calculate total tax impact (product tax + shipping tax)
  private calculateTotalTaxImpact(returnData: any): number {
    const productTax = this.calculateProductTaxReturned(returnData.returnedItems);
    const shippingTax = returnData.isFullReturn ? (Number(returnData.shippingTaxRefunded) || 0) : 0;
    return productTax + shippingTax;
  }

  // Real-time return data using snapshotChanges()
  getReturns(): Observable<any[]> {
    return this.firestore.collection('salesReturns').snapshotChanges().pipe(
      map(actions =>
        actions.map(a => {
          const data = a.payload.doc.data() as { [key: string]: any };
          const id = a.payload.doc.id;
          return { id, ...data };
        })
      )
    );
  }

  getReturnsByDateRange(startDate: Date, endDate: Date): Observable<any[]> {
    return this.firestore.collection('salesReturns', ref =>
      ref.where('returnDate', '>=', startDate)
         .where('returnDate', '<=', endDate)
    ).snapshotChanges().pipe(
      map(actions =>
        actions.map(a => {
          const data = a.payload.doc.data() as { [key: string]: any };
          const id = a.payload.doc.id;
          return { id, ...data };
        })
      )
    );
  }

  // NEW: Get total tax returned by date range (for balance sheet calculation)
  async getTotalTaxReturnedByDateRange(startDate: Date, endDate: Date): Promise<number> {
    try {
      const snapshot = await this.firestore.collection('salesReturns', ref =>
        ref.where('returnDate', '>=', startDate)
           .where('returnDate', '<=', endDate)
      ).get().toPromise();

      if (!snapshot) return 0;

      let totalTaxReturned = 0;
      
      snapshot.forEach(doc => {
        const data = doc.data() as any;
        // Sum both product tax and shipping tax returned
        const productTax = Number(data.totalProductTaxReturned) || 0;
        const shippingTax = Number(data.totalShippingTaxReturned) || 0;
        totalTaxReturned += (productTax + shippingTax);
      });

      return totalTaxReturned;
    } catch (error) {
      console.error('Error calculating total tax returned:', error);
      return 0;
    }
  }

  // NEW: Get total shipping tax returned by date range
  async getTotalShippingTaxReturnedByDateRange(startDate: Date, endDate: Date): Promise<number> {
    try {
      const snapshot = await this.firestore.collection('salesReturns', ref =>
        ref.where('returnDate', '>=', startDate)
           .where('returnDate', '<=', endDate)
           .where('isFullReturn', '==', true) // Only full returns get shipping refunds
      ).get().toPromise();

      if (!snapshot) return 0;

      let totalShippingTaxReturned = 0;
      
      snapshot.forEach(doc => {
        const data = doc.data() as any;
        totalShippingTaxReturned += Number(data.totalShippingTaxReturned) || 0;
      });

      return totalShippingTaxReturned;
    } catch (error) {
      console.error('Error calculating total shipping tax returned:', error);
      return 0;
    }
  }
  
}