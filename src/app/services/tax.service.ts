import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  onSnapshot,
  CollectionReference,
  DocumentData,
  doc,
  updateDoc,
  deleteDoc
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { TaxRate,TaxGroup } from '../tax/tax.model';

@Injectable({
  providedIn: 'root',
})
export class TaxService {
  getTaxes: any;
  constructor(private firestore: Firestore) {}

  // Tax Rate Methods
  addTaxRate(rate: Omit<TaxRate, 'id'>): Promise<void> {
    const collRef = collection(this.firestore, 'taxRates');
    const newRate = {
      ...rate,
      active: rate.active !== undefined ? rate.active : true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    return addDoc(collRef, newRate).then(() => {});
  }

  getTaxRates(): Observable<TaxRate[]> {
    return new Observable((observer) => {
      const collRef: CollectionReference<DocumentData> = collection(this.firestore, 'taxRates');
      const unsubscribe = onSnapshot(collRef, (snapshot) => {
        const taxRates = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as TaxRate)
        }));
        observer.next(taxRates);
      });
      return () => unsubscribe();
    });
  }

  updateTaxRate(id: string, rate: Partial<TaxRate>): Promise<void> {
    const rateRef = doc(this.firestore, 'taxRates', id);
    const updatedData = {
      ...rate,
      updatedAt: new Date()
    };
    return updateDoc(rateRef, updatedData);
  }

  deleteTaxRate(id: string): Promise<void> {
    const rateRef = doc(this.firestore, 'taxRates', id);
    return deleteDoc(rateRef);
  }

  // Tax Group Methods
  addTaxGroup(group: Omit<TaxGroup, 'id'>): Promise<void> {
    const collRef = collection(this.firestore, 'taxGroups');
    const newGroup = {
      ...group,
      active: group.active !== undefined ? group.active : true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    return addDoc(collRef, newGroup).then(() => {});
  }

  getTaxGroups(): Observable<TaxGroup[]> {
    return new Observable((observer) => {
      const collRef: CollectionReference<DocumentData> = collection(this.firestore, 'taxGroups');
      const unsubscribe = onSnapshot(collRef, (snapshot) => {
        const taxGroups = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as TaxGroup)
        }));
        observer.next(taxGroups);
      });
      return () => unsubscribe();
    });
  }

  updateTaxGroup(id: string, group: Partial<TaxGroup>): Promise<void> {
    const groupRef = doc(this.firestore, 'taxGroups', id);
    const updatedData = {
      ...group,
      updatedAt: new Date()
    };
    return updateDoc(groupRef, updatedData);
  }

  deleteTaxGroup(id: string): Promise<void> {
    const groupRef = doc(this.firestore, 'taxGroups', id);
    return deleteDoc(groupRef);
  
}

}