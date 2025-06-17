import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, query, onSnapshot, doc, updateDoc, deleteDoc, where, getDocs, getDoc, runTransaction } from '@angular/fire/firestore';
import { Observable, from, of } from 'rxjs';
import { map } from 'rxjs/operators';


export interface Supplier {
  postalCode?: string;
  address: string;
id?: string;
  contactId?: string;
    district?: string;
status?: "Active" | "Inactive" | undefined;
  businessName?: string;
  firstName?: string;
    paymentAmount?: number; // Add this

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
}
export interface SupplierDocument {
  id?: string;
  name: string;
  url: string;
  uploadedAt: Date;
  uploadedBy: string;
  isPrivate: boolean;
}export interface SupplierNote {
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

  constructor(private firestore: Firestore) {}

  // Get all suppliers
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
      
      // Return the unsubscribe function to clean up when observable is unsubscribed
      return { unsubscribe };
    });
  }
   getSuppliersRealTime(): Observable<Supplier[]> {
  const suppliersRef = collection(this.firestore, this.suppliersCollection);
  return new Observable<Supplier[]>(observer => {
    const unsubscribe = onSnapshot(suppliersRef, (snapshot) => {
      const suppliers = snapshot.docs.map(doc => {
        const data = doc.data() as Supplier;
        const id = doc.id;
        return { id, ...data };
      });
      observer.next(suppliers);
    }, (error) => {
      observer.error(error);
    });
    
    return { unsubscribe };
  });
}

// Add this method to supplier.service.ts
getSupplierBalanceDue(supplierId: string): Observable<number> {
  const supplierDoc = doc(this.firestore, `${this.suppliersCollection}/${supplierId}`);
  
  return new Observable<number>(observer => {
    const unsubscribe = onSnapshot(supplierDoc, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data() as Supplier;
        // Calculate balance due: opening balance + purchase due - advance balance
        const openingBalance = data.openingBalance || 0;
        const purchaseDue = data.purchaseDue || 0;
        const advanceBalance = data.advanceBalance || 0;
        
        const balanceDue = openingBalance + purchaseDue - advanceBalance;
        observer.next(balanceDue);
      } else {
        observer.next(0); // Return 0 if supplier doesn't exist
      }
    }, (error) => {
      observer.error(error);
    });
    
    return { unsubscribe };
  });
}
  // Get single supplier by ID
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

  // Add new supplier
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

// In supplier.service.ts
async updateSupplier(id: string, supplier: Partial<Supplier>): Promise<void> {
  const supplierDoc = doc(this.firestore, this.suppliersCollection, id);
  
  // Add updated timestamp
  const updateData = {
    ...supplier,
    updatedAt: new Date()
  };
  
  return updateDoc(supplierDoc, updateData);
}

  // Delete supplier
  async deleteSupplier(id: string): Promise<void> {
    const supplierDoc = doc(this.firestore, this.suppliersCollection, id);
    return deleteDoc(supplierDoc);
  }

  // Get suppliers by contact type
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
// Add these methods to supplier.service.ts

// Documents methods
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

// Notes methods
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
// supplier.service.ts
async updateSupplierBalance(supplierId: string, amount: number, isPayment: boolean = false, p0?: boolean): Promise<void> {
  try {
    const supplierRef = doc(this.firestore, 'suppliers', supplierId);
    await runTransaction(this.firestore, async (transaction) => {
      const supplierDoc = await transaction.get(supplierRef);
      if (!supplierDoc.exists()) {
        throw new Error('Supplier not found');
      }
      
      const currentBalance = supplierDoc.data()['balance'] || 0;
      const newBalance = isPayment 
        ? currentBalance - amount // Reduce balance for payments
        : currentBalance + amount; // Increase balance for purchases
      
      transaction.update(supplierRef, {
        balance: newBalance,
        updatedAt: new Date()
      });
    });
  } catch (error) {
    console.error('Error updating supplier balance:', error);
    throw error;
  }
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
  // Search suppliers by term
  searchSuppliers(searchTerm: string): Observable<Supplier[]> {
    // This is a client-side implementation since Firestore doesn't support direct text search
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

  // Check if a contact ID already exists
  async checkContactIdExists(contactId: string): Promise<boolean> {
    const suppliersRef = collection(this.firestore, this.suppliersCollection);
    const q = query(suppliersRef, where('contactId', '==', contactId));
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  }

  // Generate a new contact ID
  async generateContactId(): Promise<string> {
    const suppliersRef = collection(this.firestore, this.suppliersCollection);
    const q = query(suppliersRef);
    const snapshot = await getDocs(q);
    
    const existingIds: number[] = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      // Fix for the TypeScript error - using bracket notation instead of dot notation
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

  // Get filtered suppliers
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
