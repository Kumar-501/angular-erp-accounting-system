import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  doc,
  deleteDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  onSnapshot,
  orderBy,
  limit
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class QuotationService {
  private firestore: Firestore = inject(Firestore);
  
  // Get the last invoice number (for auto-generation)
  getLastInvoiceNumber(): Observable<any> {
    const quotationsRef = collection(this.firestore, 'quotations');
    const q = query(quotationsRef, orderBy('invoiceNo', 'desc'), limit(1));
    
    return new Observable(observer => {
      getDocs(q)
        .then((snapshot) => {
          if (snapshot.empty) {
            observer.next({ lastInvoiceNo: 'INV-0000' });
          } else {
            const doc = snapshot.docs[0];
            const data = doc.data() as any;
            observer.next({ lastInvoiceNo: data.invoiceNo || 'INV-0000' });
          }
          observer.complete();
        })
        .catch(error => observer.error(error));
    });
  }
  
  // Save Quotation
  saveQuotation(quotation: any): Promise<any> {
    const quotationToSave = this.prepareDataForFirestore({ ...quotation });
    const quotationsRef = collection(this.firestore, 'quotations');
    return addDoc(quotationsRef, quotationToSave);
  }
  
  // Get Quotation by ID
  getQuotationById(id: string): Observable<any> {
    const quotationDocRef = doc(this.firestore, `quotations/${id}`);
    return new Observable(observer => {
      getDoc(quotationDocRef)
        .then((docSnapshot) => {
          if (docSnapshot.exists()) {
            const quotationData = {
              id: docSnapshot.id,
              ...docSnapshot.data()
            };
            observer.next(quotationData);
          } else {
            observer.error('Quotation not found');
          }
          observer.complete();
        })
        .catch(error => observer.error(error));
    });
  }
  
  // Get all Quotations (real-time)
  getAllQuotations(): Observable<any[]> {
    const quotationsRef = collection(this.firestore, 'quotations');
    return new Observable(observer => {
      const unsubscribe = onSnapshot(quotationsRef, snapshot => {
        const quotationsList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        observer.next(quotationsList);
      }, error => {
        observer.error(error);
      });
      
      // Unsubscribe from real-time listener when the observable is unsubscribed
      return unsubscribe;
    });
  }
  
  // Update Quotation
  updateQuotation(id: string, quotation: any): Promise<void> {
    const quotationToUpdate = this.prepareDataForFirestore({ ...quotation });
    
    // Remove the id field if it's part of the object
    if (quotationToUpdate.id) {
      delete quotationToUpdate.id;
    }
    
    const quotationDocRef = doc(this.firestore, `quotations/${id}`);
    return updateDoc(quotationDocRef, quotationToUpdate);
  }
  
  // Delete Quotation
  deleteQuotation(id: string): Promise<void> {
    const quotationDocRef = doc(this.firestore, `quotations/${id}`);
    return deleteDoc(quotationDocRef);
  }
  
  // Prepares data to be safely stored in Firestore
  private prepareDataForFirestore(data: any): any {
    const result = { ...data };
    
    // Remove File objects (must upload to Storage separately)
    if (result.attachDocument instanceof File) {
      delete result.attachDocument;
    }
    
    if (result.shippingDocuments instanceof File) {
      delete result.shippingDocuments;
    }
    
    // Convert Date objects to ISO strings
    if (result.saleDate instanceof Date) {
      result.saleDate = result.saleDate.toISOString();
    }
    
    return result;
  }
}