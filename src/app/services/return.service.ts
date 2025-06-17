import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';

@Injectable({
  providedIn: 'root',
})
export class ReturnService {
  constructor(private firestore: AngularFirestore) {}

  // Save a return record
  async addReturn(returnData: any): Promise<void> {
    await this.firestore.collection('returns').doc(returnData.id).set(returnData);
  }

  // Get all returns for a specific sale
  async getReturnsBySaleId(saleId: string): Promise<any[]> {
    const snapshot = await this.firestore.collection('returns', ref =>
      ref.where('originalSaleId', '==', saleId)
    ).get().toPromise();

    if (!snapshot) {
      return [];
    }

    return snapshot.docs.map(doc => doc.data());
  }
}
