import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, query, onSnapshot, doc, updateDoc, deleteDoc, where, getDocs, getDoc, runTransaction, Timestamp } from '@angular/fire/firestore';
import { Observable, from, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { PurchaseService } from './purchase.service';

export interface Supplier {
  postalCode?: string;
  address: string;
  id?: string;
  supplierName?: string;
  contactId?: string;
  district?: string;
  status?: "Active" | "Inactive" | undefined;
  businessName?: string;
  firstName?: string;
  paymentAmount?: number;
  totalPurchases?: number;
  zipCode?: string; 
  lastName?: string;
  isIndividual?: boolean;
  email?: string;
  mobile?: string;
  landline?: string;
  alternateContact?: string;
  assignedTo?: string;
  taxNumber?: string;
  openingBalance?: number;
  purchaseDue?: number;
  purchaseReturn?: number;
  advanceBalance?: number;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  country?: string;
  prefix?: string;
  middleName?: string;
  dob?: Date;
  payTerm?: number;
  contactType?: string;
  documents?: SupplierDocument[];
  notes?: SupplierNote[];
  paymentDue?: number;
  grandTotal?: number;
  updatedAt?: Date;
}

export interface SupplierDocument {
  id?: string;
  name: string;
  url: string;
  uploadedAt: Date;
  uploadedBy: string;
  isPrivate: boolean;
}

export interface SupplierNote {
  id?: string;
  title: string;
  content: string;
  createdAt: Date;
  createdBy: string;
  isPrivate: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class SupplierService {
  private suppliersCollection = 'suppliers';

  constructor(
    private firestore: Firestore,
    private purchaseService: PurchaseService
  ) {}

  getSuppliers(): Observable<Supplier[]> {
    const suppliersRef = collection(this.firestore, this.suppliersCollection);
    
    return new Observable<Supplier[]>(observer => {
      const unsubscribe = onSnapshot(suppliersRef, (snapshot) => {
        const suppliers: Supplier[] = [];
        snapshot.forEach(doc => {
          const data = doc.data() as Omit<Supplier, 'id'>;
          suppliers.push({ id: doc.id, ...data });
        });
        observer.next(suppliers);
      }, (error) => {
        observer.error(error);
      });
      
      return { unsubscribe };
    });
  }

  getSupplierBalanceDue(supplierId: string): Observable<number> {
    const supplierDoc = doc(this.firestore, `${this.suppliersCollection}/${supplierId}`);
    
    return new Observable<number>(observer => {
      const unsubscribe = onSnapshot(supplierDoc, (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data() as Supplier;
          const openingBalance = data.openingBalance || 0;
          const purchaseDue = data.purchaseDue || 0;
          const advanceBalance = data.advanceBalance || 0;
          
          const balanceDue = openingBalance + purchaseDue - advanceBalance;
          observer.next(balanceDue);
        } else {
          observer.next(0);
        }
      }, (error) => {
        observer.error(error);
      });
      
      return { unsubscribe };
    });
  }

  getSupplierById(id: string): Observable<Supplier | undefined> {
    const supplierDoc = doc(this.firestore, `${this.suppliersCollection}/${id}`);
    
    return new Observable<Supplier | undefined>(observer => {
      const unsubscribe = onSnapshot(supplierDoc, (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data() as Omit<Supplier, 'id'>;
          observer.next({ id: docSnapshot.id, ...data });
        } else {
          observer.next(undefined);
        }
      }, (error) => {
        observer.error(error);
      });
      
      return { unsubscribe };
    });
  }

  async addSupplier(supplier: Supplier): Promise<string> {
    const suppliersRef = collection(this.firestore, this.suppliersCollection);
    
    if (supplier.id) {
      const supplierDoc = doc(this.firestore, this.suppliersCollection, supplier.id);
      await updateDoc(supplierDoc, { ...supplier });
      return supplier.id;
    } else {
      const docRef = await addDoc(suppliersRef, { ...supplier });
      return docRef.id;
    }
  }

  async updateSupplier(id: string, supplier: Partial<Supplier>): Promise<void> {
    const supplierDoc = doc(this.firestore, this.suppliersCollection, id);
    
    const updateData = {
      ...supplier,
      updatedAt: new Date()
    };
    
    return updateDoc(supplierDoc, updateData);
  }

  async deleteSupplier(id: string): Promise<void> {
    const supplierDoc = doc(this.firestore, this.suppliersCollection, id);
    return deleteDoc(supplierDoc);
  }

  async updateSupplierStatus(supplierId: string, status: 'Active' | 'Inactive'): Promise<void> {
    const supplierDoc = doc(this.firestore, this.suppliersCollection, supplierId);
    
    return updateDoc(supplierDoc, { 
      status,
      updatedAt: new Date() 
    });
  }

  getSuppliersByContactType(contactType: string): Observable<Supplier[]> {
    const suppliersRef = collection(this.firestore, this.suppliersCollection);
    const q = query(suppliersRef, where('contactType', '==', contactType));
    
    return new Observable<Supplier[]>(observer => {
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const suppliers: Supplier[] = [];
        snapshot.forEach(doc => {
          const data = doc.data() as Omit<Supplier, 'id'>;
          suppliers.push({ id: doc.id, ...data });
        });
        observer.next(suppliers);
      }, (error) => {
        observer.error(error);
      });
      
      return { unsubscribe };
    });
  }

  async getSupplierBalance(supplierId: string): Promise<{
    totalPurchases: number;
    totalPaid: number;
    openingBalance: number;
    paymentDue: number;
  }> {
    const supplierDoc = doc(this.firestore, `${this.suppliersCollection}/${supplierId}`);
    const supplierSnap = await getDoc(supplierDoc);
    
    if (!supplierSnap.exists()) {
      return {
        totalPurchases: 0,
        totalPaid: 0,
        openingBalance: 0,
        paymentDue: 0
      };
    }

    const supplierData = supplierSnap.data() as Supplier;
    const openingBalance = supplierData.openingBalance || 0;

    // Get all purchases for this supplier
    const purchases = await this.purchaseService.getPurchasesBySupplier(supplierId).toPromise() || [];
    
    const totalPurchases = purchases.reduce((sum: number, purchase: any) => {
      return sum + (purchase.grandTotal || purchase.purchaseTotal || 0);
    }, 0);

    const totalPaid = purchases.reduce((sum: number, purchase: any) => {
      return sum + (purchase.paymentAmount || 0);
    }, 0);

    const paymentDue = (openingBalance + totalPurchases) - totalPaid;

    return {
      totalPurchases,
      totalPaid,
      openingBalance,
      paymentDue
    };
  }

  async syncSupplierPaymentData(supplierId: string): Promise<void> {
    const balanceData = await this.getSupplierBalance(supplierId);
    
    return this.updateSupplier(supplierId, {
      totalPurchases: balanceData.totalPurchases,
      paymentAmount: balanceData.totalPaid,
      paymentDue: balanceData.paymentDue,
      updatedAt: new Date()
    });
  }

  async updateSupplierPaymentInfo(supplierId: string, paymentAmount: number): Promise<void> {
    // Fetch the supplier to get the current paymentDue
    const supplier = await getDoc(doc(this.firestore, this.suppliersCollection, supplierId));
    if (!supplier.exists()) {
      throw new Error('Supplier not found');
    }
    const currentData = supplier.data() as Supplier;
    const paymentDue = currentData.paymentDue || 0;

    return this.updateSupplier(supplierId, { 
      paymentAmount,
      paymentDue
    });
  }

async updateSupplierBalance(
  supplierId: string, 
  amount: number, 
  isPayment: boolean = false
): Promise<void> {
  try {
    const supplierRef = doc(this.firestore, 'suppliers', supplierId);
    
    await runTransaction(this.firestore, async (transaction) => {
      const supplierDoc = await transaction.get(supplierRef);
      if (!supplierDoc.exists()) {
        throw new Error('Supplier not found');
      }
      
      const supplier = supplierDoc.data() as Supplier;
      const currentPaymentAmount = supplier.paymentAmount || 0;
      const currentPaymentDue = supplier.paymentDue || 0;
      
      let newPaymentAmount = currentPaymentAmount;
      let newPaymentDue = currentPaymentDue;
      
      if (isPayment) {
        newPaymentAmount = currentPaymentAmount + amount;
        newPaymentDue = Math.max(currentPaymentDue - amount, 0);
      } else {
        newPaymentDue = currentPaymentDue + amount;
      }
      
      transaction.update(supplierRef, {
        paymentAmount: newPaymentAmount,
        paymentDue: newPaymentDue,
        updatedAt: Timestamp.now()
      });
    });
  } catch (error) {
    console.error('Error updating supplier balance:', error);
    throw error;
  }
}

  /**
   * Sync supplier data with purchase totals
   */
  async syncSupplierWithPurchases(supplierId: string, purchaseData: {
    totalPurchases: number;
    totalPaid: number;
  }): Promise<void> {
    try {
      const supplierRef = doc(this.firestore, 'suppliers', supplierId);
      await runTransaction(this.firestore, async (transaction) => {
        const supplierDoc = await transaction.get(supplierRef);
        if (!supplierDoc.exists()) {
          throw new Error('Supplier not found');
        }
        
        const currentData = supplierDoc.data() as Supplier;
        const openingBalance = currentData.openingBalance || 0;
        
        const totalOwed = purchaseData.totalPurchases + openingBalance;
        const paymentDue = Math.max(totalOwed - purchaseData.totalPaid, 0);
        
        const updateData = {
          totalPurchases: purchaseData.totalPurchases,
          paymentAmount: purchaseData.totalPaid,
          paymentDue: paymentDue,
          purchaseDue: Math.max(purchaseData.totalPurchases - purchaseData.totalPaid, 0),
          grandTotal: totalOwed,
          updatedAt: new Date()
        };
        
        transaction.update(supplierRef, updateData);
      });
    } catch (error) {
      console.error('Error syncing supplier with purchases:', error);
      throw error;
    }
  }

  async addSupplierDocument(supplierId: string, document: SupplierDocument): Promise<void> {
    const supplierDoc = doc(this.firestore, this.suppliersCollection, supplierId);
    const supplier = await getDoc(supplierDoc);
    
    if (!supplier.exists()) {
      throw new Error('Supplier not found');
    }
    
    const currentDocuments = supplier.data()['documents'] || [];
    const updatedDocuments = [...currentDocuments, document];
    
    return updateDoc(supplierDoc, { documents: updatedDocuments });
  }

  async updateSupplierDocument(supplierId: string, documentId: string, updates: Partial<SupplierDocument>): Promise<void> {
    const supplierDoc = doc(this.firestore, this.suppliersCollection, supplierId);
    const supplier = await getDoc(supplierDoc);
    
    if (!supplier.exists()) {
      throw new Error('Supplier not found');
    }
    
    const documents: SupplierDocument[] = supplier.data()['documents'] || [];
    const updatedDocuments = documents.map(doc => 
      doc.id === documentId ? { ...doc, ...updates } : doc
    );
    
    return updateDoc(supplierDoc, { documents: updatedDocuments });
  }

  async deleteSupplierDocument(supplierId: string, documentId: string): Promise<void> {
    const supplierDoc = doc(this.firestore, this.suppliersCollection, supplierId);
    const supplier = await getDoc(supplierDoc);
    
    if (!supplier.exists()) {
      throw new Error('Supplier not found');
    }
    
    const documents: SupplierDocument[] = supplier.data()['documents'] || [];
    const updatedDocuments = documents.filter(doc => doc.id !== documentId);
    
    return updateDoc(supplierDoc, { documents: updatedDocuments });
  }

  async addSupplierNote(supplierId: string, note: SupplierNote): Promise<void> {
    const supplierDoc = doc(this.firestore, this.suppliersCollection, supplierId);
    const supplier = await getDoc(supplierDoc);
    
    if (!supplier.exists()) {
      throw new Error('Supplier not found');
    }
    
    const currentNotes = supplier.data()['notes'] || [];
    const updatedNotes = [...currentNotes, note];
    
    return updateDoc(supplierDoc, { notes: updatedNotes });
  }

  async updateSupplierNote(supplierId: string, noteId: string, updates: Partial<SupplierNote>): Promise<void> {
    const supplierDoc = doc(this.firestore, this.suppliersCollection, supplierId);
    const supplier = await getDoc(supplierDoc);
    
    if (!supplier.exists()) {
      throw new Error('Supplier not found');
    }
    
    const notes: SupplierNote[] = supplier.data()['notes'] || [];
    const updatedNotes = notes.map(note => 
      note.id === noteId ? { ...note, ...updates } : note
    );
    
    return updateDoc(supplierDoc, { notes: updatedNotes });
  }

  async deleteSupplierNote(supplierId: string, noteId: string): Promise<void> {
    const supplierDoc = doc(this.firestore, this.suppliersCollection, supplierId);
    const supplier = await getDoc(supplierDoc);
    
    if (!supplier.exists()) {
      throw new Error('Supplier not found');
    }
    
    const notes: SupplierNote[] = supplier.data()['notes'] || [];
    const updatedNotes = notes.filter(note => note.id !== noteId);
    
    return updateDoc(supplierDoc, { notes: updatedNotes });
  }

  searchSuppliers(searchTerm: string): Observable<Supplier[]> {
    return this.getSuppliers().pipe(
      map(suppliers => suppliers.filter(supplier => 
        (supplier.businessName && supplier.businessName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (supplier.firstName && supplier.firstName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (supplier.lastName && supplier.lastName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (supplier.email && supplier.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (supplier.mobile && supplier.mobile.includes(searchTerm)) ||
        (supplier.contactId && supplier.contactId.includes(searchTerm))
      ))
    );
  }

  async checkContactIdExists(contactId: string): Promise<boolean> {
    const suppliersRef = collection(this.firestore, this.suppliersCollection);
    const q = query(suppliersRef, where('contactId', '==', contactId));
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  }

  async generateContactId(): Promise<string> {
    const suppliersRef = collection(this.firestore, this.suppliersCollection);
    const q = query(suppliersRef);
    const snapshot = await getDocs(q);
    
    const existingIds: number[] = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const contactId = data['contactId'] as string;
      
      if (contactId && contactId.startsWith('SU')) {
        const numPart = contactId.substring(2);
        const num = parseInt(numPart, 10);
        if (!isNaN(num)) {
          existingIds.push(num);
        }
      }
    });
    
    const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0;
    return `SU${String(maxId + 1).padStart(4, '0')}`;
  }

  getFilteredSuppliers(filters: {
    purchaseDue?: boolean;
    purchaseReturn?: boolean;
    advanceBalance?: boolean;
    openingBalance?: boolean;
    assignedTo?: string;
    status?: string;
  }): Observable<Supplier[]> {
    return this.getSuppliers().pipe(
      map(suppliers => {
        let filtered = suppliers;
        
        if (filters.purchaseDue) {
          filtered = filtered.filter(s => s.purchaseDue && s.purchaseDue > 0);
        }
        
        if (filters.purchaseReturn) {
          filtered = filtered.filter(s => s.purchaseReturn && s.purchaseReturn > 0);
        }
        
        if (filters.advanceBalance) {
          filtered = filtered.filter(s => s.advanceBalance && s.advanceBalance > 0);
        }
        
        if (filters.openingBalance) {
          filtered = filtered.filter(s => s.openingBalance && s.openingBalance > 0);
        }
        
        if (filters.assignedTo) {
          filtered = filtered.filter(s => s.assignedTo === filters.assignedTo);
        }
        
        if (filters.status) {
          filtered = filtered.filter(s => s.status === filters.status);
        }
        
        return filtered;
      })
    );
  }
}