import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, query, onSnapshot, doc, updateDoc, deleteDoc, where, getDocs, orderBy, limit, collectionGroup, startAfter, getCountFromServer, QueryDocumentSnapshot, DocumentData, writeBatch, getDoc } from '@angular/fire/firestore';
import { Observable, BehaviorSubject, from, of } from 'rxjs';
import { map, switchMap, take } from 'rxjs/operators';

// Updated Customer interface with consistent property naming and additional fields
export interface Customer {
  id?: string;
  contactId?: string;
  businessName?: string;
    convertedFromLead?: string; // ID of the lead this customer was converted from
  isConvertedCustomer?: boolean;
  lifeStage?: string;
  leadCategory?: string;
  lifestage?: string; // Add this
  adcode?: string;  firstName?: string;
  lastName?: string;
  isIndividual?: boolean;
  currentState?: string; 
  email?: string;
  mobile?: string;
  landline?: string;
  alternateContact?: string;
  assignedTo?: string;
  taxNumber?: string;
  openingBalance?: number;
  saleDue?: number;
  saleReturn?: number;
  advanceBalance?: number;
  status?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  
  state?: string;
  country?: string;
  zipCode?: string;
  prefix?: string;
  middleName?: string;
  dob?: Date;
  payTerm?: number;
  contactType?: string;
  billingAddress?: string;
  shippingAddress?: string;
  createdAt?: Date;
  updatedAt?: Date;
    department?: string;
  gender?: 'Male' | 'Female' | 'Other' | ''; // Add this
  age?: number; // Add this
  lastCallTime?: Date;
  callCount?: number;
  currentAddress?: string;
  currentCity?: string;
  address?: string;
  notes?: string;
}

// Updated CallLog interface with all fields used in the component
export interface CallLog {
  id?: string;
  subject: string;
  description: string;
  callType?: string;
  callDuration?: number;
  callOutcome?: string;
  followUpRequired?: boolean;
  followUpDate?: any; // Added this field to resolve errors
  createdAt: any; // Firestore Timestamp
  createdBy: string;
}

// New pagination state interface
export interface PaginationState {
  loading: boolean;
  data: Customer[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
  totalCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class CustomerService {
  private customersCollection = 'customers';
  private batchSize = 50; // Adjust based on your needs
  
  // BehaviorSubjects for real-time pagination
  private paginationState = new BehaviorSubject<PaginationState>({
    loading: false,
    data: [],
    lastDoc: null,
    hasMore: true,
    totalCount: 0
  });
  public paginationState$ = this.paginationState.asObservable();
  
  // BehaviorSubject for the loading state
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();
  
  // BehaviorSubject for total count
  private totalCountSubject = new BehaviorSubject<number>(0);
  public totalCount$ = this.totalCountSubject.asObservable();
  private pageSize = 20; // Default page size
  checkMobileExists: any;

  constructor(private firestore: Firestore) {
    // Initialize customer count on service creation
    this.updateTotalCount();
  }

  // Initialize pagination with first batch
  initPagination(pageSize: number = this.batchSize): void {
    this.loadingSubject.next(true);
    const currentState = this.paginationState.value;
    
    // Reset pagination state
    this.paginationState.next({
      ...currentState,
      loading: true,
      data: [],
      lastDoc: null,
      hasMore: true
    });
    
    // Get the first batch of customers
    this.fetchCustomersPage(pageSize);
    
    // Update total count
    this.updateTotalCount();
  }
  
  // Fetch the next page of customers
  loadNextPage(pageSize: number = this.batchSize): void {
    const currentState = this.paginationState.value;
    
    if (!currentState.hasMore || currentState.loading) {
      return;
    }
    
    this.fetchCustomersPage(pageSize, currentState.lastDoc);
  }
  
  // Fetch a page of customers with real-time updates
  private fetchCustomersPage(pageSize: number, startAfterDoc: QueryDocumentSnapshot<DocumentData> | null = null): void {
    const currentState = this.paginationState.value;
    this.loadingSubject.next(true);
    
    // Update pagination state to indicate loading
    this.paginationState.next({
      ...currentState,
      loading: true
    });
    
    const customersRef = collection(this.firestore, this.customersCollection);
    let q = query(customersRef, orderBy('createdAt', 'desc'), limit(pageSize));
    
    if (startAfterDoc) {
      q = query(customersRef, orderBy('createdAt', 'desc'), startAfter(startAfterDoc), limit(pageSize));
    }
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newCustomers: Customer[] = [];
      let lastVisible: QueryDocumentSnapshot<DocumentData> | null = null;
      
      snapshot.forEach(doc => {
        newCustomers.push({ id: doc.id, ...doc.data() as Customer });
        lastVisible = doc;
      });
      
      const hasMore = newCustomers.length === pageSize;
      
      // If this is the first page, replace data, otherwise append
      const updatedData = startAfterDoc 
        ? [...currentState.data, ...newCustomers] 
        : newCustomers;
      
      // Update pagination state
      this.paginationState.next({
        loading: false,
        data: updatedData,
        lastDoc: lastVisible,
        hasMore,
        totalCount: currentState.totalCount
      });
      
      this.loadingSubject.next(false);
    }, (error) => {
      console.error('Error fetching customers page:', error);
      this.paginationState.next({
        ...currentState,
        loading: false
      });
      this.loadingSubject.next(false);
    });
    
  }
  getCurrentPaginationState(): PaginationState {
    return this.paginationState.value;
}
  // Update total count of customers
  private async updateTotalCount(): Promise<void> {
    try {
      const count = await this.getTotalCustomerCount();
      const currentState = this.paginationState.value;
      
      this.totalCountSubject.next(count);
      
      this.paginationState.next({
        ...currentState,
        totalCount: count
      });
    } catch (error) {
      console.error('Error updating total count:', error);
    }
  }
  
  // Reset pagination state
  resetPagination(): void {
    this.paginationState.next({
      loading: false,
      data: [],
      lastDoc: null,
      hasMore: true,
      totalCount: this.paginationState.value.totalCount
    });
  }

async convertLeadToCustomer(leadData: any): Promise<any> {
  const customerData = this.prepareCustomerDataFromLead(leadData);
  const customersRef = collection(this.firestore, this.customersCollection);
  const docRef = await addDoc(customersRef, customerData);
  return { id: docRef.id, ...customerData };
}

private prepareCustomerDataFromLead(lead: any): any {
  return {
    contactId: lead.contactId || this.generateContactId(),
    businessName: lead.businessName || '',
    firstName: lead.firstName || '',
    lastName: lead.lastName || '',
    isIndividual: !lead.businessName,
    email: lead.email || '',
    mobile: lead.mobile || '',
    landline: lead.landline || '',
    alternateContact: lead.alternateContact || '',
    assignedTo: lead.assignedTo || '',
    status: 'Active',
    addressLine1: lead.addressLine1 || '',
    addressLine2: lead.addressLine2 || '',
    city: lead.city || '',
    state: lead.state || '',
    country: lead.country || 'India',
    zipCode: lead.zipCode || '',
    contactType: 'Customer',
    createdAt: new Date(),
    updatedAt: new Date(),
    convertedFromLead: lead.convertedFromLead || null, // Reference to original lead
    // Add any other fields you want to carry over
    notes: lead.notes || '',
    source: lead.source || '',
    lifeStage: lead.lifeStage || '',
    leadStatus: lead.leadStatus || ''
  };
}
  getAllCustomers(): Observable<any[]> {
    const customersRef = collection(this.firestore, 'customers');
    return new Observable<any[]>(observer => {
      const unsubscribe = onSnapshot(customersRef, (snapshot) => {
        const customers = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        observer.next(customers);
      });
      return { unsubscribe };
    });
  }
  
  async getCustomerByIdPromise(id: string): Promise<Customer | null> {
    try {
      const snapshot = await getDocs(query(collection(this.firestore, this.customersCollection), where('id', '==', id)));
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() } as Customer;
      }
      return null;
    } catch (error) {
      console.error('Error getting customer:', error);
      throw error;
    }
  }



  private generateContactId(): string {
    return 'CO' + String(Math.floor(1000 + Math.random() * 9000)).padStart(4, '0');
  }
  
  getCustomersPaginated(limitCount: number, lastDoc?: any): Observable<{customers: Customer[], lastDoc: any}> {
    this.loadingSubject.next(true);
    const customersRef = collection(this.firestore, this.customersCollection);
    let q = query(customersRef, orderBy('createdAt', 'desc'), limit(limitCount));
    
    if (lastDoc) {
      q = query(customersRef, orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(limitCount));
    }

    return new Observable<{customers: Customer[], lastDoc: any}>(observer => {
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const customers: Customer[] = [];
        let lastVisible = null;
        
        snapshot.forEach(doc => {
          customers.push({ id: doc.id, ...doc.data() as Customer });
          lastVisible = doc;
        });

        this.loadingSubject.next(false);
        observer.next({ customers, lastDoc: lastVisible });
      }, (error) => {
        this.loadingSubject.next(false);
        observer.error(error);
      });

      return { unsubscribe };
    });
  }
  
// Get all customers
getCustomers(customerId?: string): Observable<Customer[]> {
  const customersRef = collection(this.firestore, this.customersCollection);
  
  // If a specific customerId is provided and it's not 'all', get only that customer
  if (customerId && customerId !== 'all') {
    const customerDoc = doc(this.firestore, `${this.customersCollection}/${customerId}`);
    
    return new Observable<Customer[]>(observer => {
      const unsubscribe = onSnapshot(customerDoc, (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data() as Omit<Customer, 'id'>;
          observer.next([{ id: docSnapshot.id, ...data }]);
        } else {
          observer.next([]);
        }
      }, (error) => {
        observer.error(error);
      });
      
      return { unsubscribe };
    });
  }
  
  // Otherwise, get all customers
  return new Observable<Customer[]>(observer => {
    const unsubscribe = onSnapshot(customersRef, (snapshot) => {
      const customers: Customer[] = [];
      snapshot.forEach(doc => {
        const data = doc.data() as Omit<Customer, 'id'>;
        customers.push({ id: doc.id, ...data });
      });
      observer.next(customers);
    }, (error) => {
      observer.error(error);
    });
    
    // Return the unsubscribe function to clean up when observable is unsubscribed
    return { unsubscribe };
  });
}

  // Get single customer by ID
  getCustomerById(id: string): Observable<Customer | undefined> {
    const customerDoc = doc(this.firestore, `${this.customersCollection}/${id}`);
    
    return new Observable<Customer | undefined>(observer => {
      const unsubscribe = onSnapshot(customerDoc, (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data() as Omit<Customer, 'id'>;
          
          // Map currentstate to currentState if it exists (for backward compatibility)
          if (data.hasOwnProperty('currentstate') && !data.hasOwnProperty('currentState')) {
            const { currentstate, ...rest } = data as any;
            observer.next({ id: docSnapshot.id, currentState: currentstate, ...rest });
          } else {
            observer.next({ id: docSnapshot.id, ...data });
          }
        } else {
          observer.next(undefined);
        }
      }, (error) => {
        observer.error(error);
      });
      
      return { unsubscribe };
    });
  }

  getCustomersByDepartment(department: string): Observable<Customer[]> {
    const customersRef = collection(this.firestore, this.customersCollection);
    const q = query(customersRef, where('department', '==', department));
    
    return new Observable<Customer[]>(observer => {
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const customers: Customer[] = [];
        snapshot.forEach(doc => {
          const data = doc.data() as Omit<Customer, 'id'>;
          customers.push({ id: doc.id, ...data });
        });
        observer.next(customers);
      }, (error) => {
        observer.error(error);
      });
      
      return { unsubscribe };
    });
  }

  // Get all unique departments
  async getAvailableDepartments(): Promise<string[]> {
    try {
      const customersRef = collection(this.firestore, this.customersCollection);
      const snapshot = await getDocs(customersRef);
      
      const departments = new Set<string>();
      snapshot.forEach(doc => {
        const data = doc.data() as Customer;
        if (data.department) {
          departments.add(data.department);
        }
      });
      
      // Add default departments if they don't exist
      ['PC1', 'PC2', 'PC3', 'PC4', 'PC5', 'PC6', 'PC7', 'PC8'].forEach(dept => {
        departments.add(dept);
      });
      
      return Array.from(departments).sort();
    } catch (error) {
      console.error('Error getting departments:', error);
      return ['PC1', 'PC2', 'PC3', 'PC4', 'PC5', 'PC6', 'PC7', 'PC8'];
    }
  }
  
  async getTotalCustomerCount(): Promise<number> {
    const customersRef = collection(this.firestore, this.customersCollection);
    const snapshot = await getCountFromServer(customersRef);
    return snapshot.data().count;
  }
  
  searchCustomersOptimized(searchTerm: string, field: keyof Customer): Observable<Customer[]> {
    const customersRef = collection(this.firestore, this.customersCollection);
    const q = query(customersRef, 
      where(field, '>=', searchTerm),
      where(field, '<=', searchTerm + '\uf8ff'),
      limit(50)
    );

    return new Observable<Customer[]>(observer => {
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const customers = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data() as Customer
        }));
        observer.next(customers);
      }, (error) => {
        observer.error(error);
      });

      return { unsubscribe };
    });
  }
  
  // Add this to your CustomerService class
async bulkDeleteCustomers(customerIds: string[]): Promise<void> {
  const batch = writeBatch(this.firestore);
  const leadsToDelete: string[] = [];
  
  // First get all customer documents to check for converted leads
  for (const id of customerIds) {
    const customerDoc = doc(this.firestore, this.customersCollection, id);
    const customerSnapshot = await getDoc(customerDoc);
    
    if (customerSnapshot.exists()) {
      const customerData = customerSnapshot.data() as Customer;
      batch.delete(customerDoc);
      
      if (customerData.convertedFromLead) {
        leadsToDelete.push(customerData.convertedFromLead);
      }
    }
  }
  
  // Add lead deletions to the batch
  leadsToDelete.forEach(leadId => {
    const leadDoc = doc(this.firestore, 'leads', leadId);
    batch.delete(leadDoc);
  });
  
  await batch.commit();
  await this.updateTotalCount();
}
  async addCustomer(customer: Customer): Promise<string> {
    
    try {
      
      // Ensure required fields are present
      const customerData: Customer = {
        ...customer,
        contactId: customer.contactId || this.generateContactId(),
        status: customer.status || 'Active',
        
        isIndividual: customer.isIndividual !== undefined ? customer.isIndividual : true,
        createdAt: customer.createdAt || new Date(),
        updatedAt: new Date()
      };
  
      const customersRef = collection(this.firestore, this.customersCollection);
      const docRef = await addDoc(customersRef, customerData);
      
      // Update total count after adding
      await this.updateTotalCount();
      
      return docRef.id;
    } catch (error) {
      console.error('Error adding customer:', error);
      throw error;
    }
  }

  // Update existing customer
  async updateCustomer(id: string, customer: Partial<Customer>): Promise<void> {
    const customerDoc = doc(this.firestore, this.customersCollection, id);
    
    // Handle property name conversion for backward compatibility
    const updateData = { ...customer, updatedAt: new Date() };
    
    // If currentState is provided, also update currentstate for backward compatibility
    if (updateData.currentState !== undefined) {
      (updateData as any).currentstate = updateData.currentState;
    }
    
    return updateDoc(customerDoc, updateData);
  }

  // New method: updateCustomerObservable - Returns an Observable for the update operation
  updateCustomerObservable(id: string, customer: Partial<Customer>): Observable<void> {
    return from(this.updateCustomer(id, customer));
  }

async deleteCustomer(id: string): Promise<void> {
  try {
    // First get the customer document
    const customerDoc = doc(this.firestore, this.customersCollection, id);
    const customerSnapshot = await getDoc(customerDoc);
    
    if (!customerSnapshot.exists()) {
      throw new Error('Customer not found');
    }
    
    const customerData = customerSnapshot.data() as Customer;
    
    // Start a batch to handle multiple operations atomically
    const batch = writeBatch(this.firestore);
    
    // Delete the customer
    batch.delete(customerDoc);
    
    // If this was a converted customer, handle the lead
    if (customerData.convertedFromLead) {
      const leadDoc = doc(this.firestore, 'leads', customerData.convertedFromLead);
      
      // Either delete the lead (option 1)
      batch.delete(leadDoc);
      
      // OR mark it as unconverted (option 2 - choose one)
      // batch.update(leadDoc, {
      //   convertedAt: null,
      //   status: 'New',
      //   convertedTo: null
      // });
    }
    
    // Commit the batch
    await batch.commit();
    
    // Update total count after deletion
    await this.updateTotalCount();
  } catch (error) {
    console.error('Error deleting customer:', error);
    throw error;
  }
}

  // Get customers by contact type
  getCustomersByContactType(contactType: string): Observable<Customer[]> {
    const customersRef = collection(this.firestore, this.customersCollection);
    const q = query(customersRef, where('contactType', '==', contactType));
    
    return new Observable<Customer[]>(observer => {
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const customers: Customer[] = [];
        snapshot.forEach(doc => {
          const data = doc.data() as Omit<Customer, 'id'>;
          customers.push({ id: doc.id, ...data });
        });
        observer.next(customers);
      }, (error) => {
        observer.error(error);
      });
      
      return { unsubscribe };
    });
  }
// Search customers by term
searchCustomers(searchTerm: string): Observable<Customer[]> {
  // This is a client-side implementation since Firestore doesn't support direct text search
  return this.getCustomers('all').pipe(
    map(customers => customers.filter(customer => 
      (customer.businessName && customer.businessName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (customer.firstName && customer.firstName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (customer.lastName && customer.lastName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (customer.email && customer.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (customer.mobile && customer.mobile.includes(searchTerm)) ||
      (customer.contactId && customer.contactId.includes(searchTerm))
    ))
  );
}

  // Get customers sorted by name
  getSortedCustomers(): Observable<Customer[]> {
    const customersRef = collection(this.firestore, this.customersCollection);
    const q = query(customersRef, orderBy('lastName'));
    
    return new Observable<Customer[]>(observer => {
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const customers: Customer[] = [];
        snapshot.forEach(doc => {
          const data = doc.data() as Omit<Customer, 'id'>;
          customers.push({ id: doc.id, ...data });
        });
        observer.next(customers);
      }, (error) => {
        observer.error(error);
      });
      
      return { unsubscribe };
    });
  }

  // Get active customers
  getActiveCustomers(): Observable<Customer[]> {
    const customersRef = collection(this.firestore, this.customersCollection);
    const q = query(customersRef, where('status', '==', 'Active'));
    
    return new Observable<Customer[]>(observer => {
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const customers: Customer[] = [];
        snapshot.forEach(doc => {
          const data = doc.data() as Omit<Customer, 'id'>;
          customers.push({ id: doc.id, ...data });
        });
        observer.next(customers);
      }, (error) => {
        observer.error(error);
      });
      
      return { unsubscribe };
    });
  }

  // CALL LOG METHODS

  // Get call logs for a specific customer
  getCallLogsForCustomer(customerId: string): Observable<CallLog[]> {
    const callLogsRef = collection(this.firestore, `${this.customersCollection}/${customerId}/callLogs`);
    const q = query(callLogsRef, orderBy('createdAt', 'desc'));
    
    return new Observable<CallLog[]>(observer => {
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const callLogs: CallLog[] = [];
        snapshot.forEach(doc => {
          const data = doc.data() as Omit<CallLog, 'id'>;
          callLogs.push({ id: doc.id, ...data });
        });
        observer.next(callLogs);
      }, (error) => {
        observer.error(error);
      });
      
      return { unsubscribe };
    });
  }

  // Add a new call log for a customer
  async addCallLog(customerId: string, callLogData: Omit<CallLog, 'id'>): Promise<string> {
    const callLogsRef = collection(this.firestore, `${this.customersCollection}/${customerId}/callLogs`);
    const docRef = await addDoc(callLogsRef, {
      ...callLogData,
      createdAt: callLogData.createdAt || new Date()
    });
    return docRef.id;
  }

  // Update an existing call log
  async updateCallLog(customerId: string, callLogId: string, callLogData: Partial<CallLog>): Promise<void> {
    const callLogDoc = doc(this.firestore, `${this.customersCollection}/${customerId}/callLogs/${callLogId}`);
    return updateDoc(callLogDoc, { ...callLogData });
  }

  // Delete a call log
  async deleteCallLog(customerId: string, callLogId: string): Promise<void> {
    const callLogDoc = doc(this.firestore, `${this.customersCollection}/${customerId}/callLogs/${callLogId}`);
    return deleteDoc(callLogDoc);
  }

  // Get a specific call log by ID
  getCallLogById(customerId: string, callLogId: string): Observable<CallLog | undefined> {
    const callLogDoc = doc(this.firestore, `${this.customersCollection}/${customerId}/callLogs/${callLogId}`);
    
    return new Observable<CallLog | undefined>(observer => {
      const unsubscribe = onSnapshot(callLogDoc, (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data() as Omit<CallLog, 'id'>;
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

  // Get recent call logs across all customers
  getRecentCallLogs(limitCount: number = 10): Observable<Array<CallLog & { customerId: string }>> {
    const callLogsCollectionGroup = collectionGroup(this.firestore, 'callLogs');
    const q = query(callLogsCollectionGroup, orderBy('createdAt', 'desc'), limit(limitCount));
    
    return new Observable<Array<CallLog & { customerId: string }>>(observer => {
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const callLogs: Array<CallLog & { customerId: string }> = [];
        snapshot.forEach(doc => {
          const data = doc.data() as Omit<CallLog, 'id'>;
          // Extract the customer ID from the reference path
          const path = doc.ref.path;
          const pathSegments = path.split('/');
          const customerId = pathSegments[1]; // Should be the customer ID based on path structure
          
          callLogs.push({ 
            id: doc.id, 
            customerId, 
            ...data 
          });
        });
        observer.next(callLogs);
      }, (error) => {
        observer.error(error);
      });
      
      return { unsubscribe };
    });
  }

  // Count call logs for a customer
  async getCallLogCount(customerId: string): Promise<number> {
    const callLogsRef = collection(this.firestore, `${this.customersCollection}/${customerId}/callLogs`);
    const snapshot = await getDocs(callLogsRef);
    return snapshot.size;
  }

  // Get customers with recent call logs
  getCustomersWithRecentCallLogs(limitCount: number = 10): Observable<Array<Customer & { recentCallLog: CallLog }>> {
    return this.getRecentCallLogs(limitCount).pipe(
      map(async (callLogs) => {
        const results: Array<Customer & { recentCallLog: CallLog; }> = [];

        for (const callLog of callLogs) {
          const customer = await this.getCustomerByIdPromise(callLog.customerId);
          if (customer) {
            results.push({
              ...customer,
              recentCallLog: callLog
            });
          }
        }

        return results;
      })
    ) as unknown as Observable<Array<Customer & { recentCallLog: CallLog }>>;
  }

  // Check if mobile number exists
  async checkMobileNumberExists(mobile: string): Promise<boolean> {
    try {
      const customersRef = collection(this.firestore, this.customersCollection);
      const q = query(customersRef, where('mobile', '==', mobile));
      const querySnapshot = await getDocs(q);
      
      return !querySnapshot.empty;
    } catch (error) {
      console.error('Error checking mobile number:', error);
      throw error;
    }
  }

  // Check if alternate contact exists
  async checkAlternateContactExists(contact: string): Promise<boolean> {
    try {
      const customersRef = collection(this.firestore, this.customersCollection);
      const q = query(customersRef, where('alternateContact', '==', contact));
      const querySnapshot = await getDocs(q);
      
      return !querySnapshot.empty;
    } catch (error) {
      console.error('Error checking alternate contact:', error);
      throw error;
    }
  }

  // Check if landline exists
  async checkLandlineExists(landline: string): Promise<boolean> {
    try {
      const customersRef = collection(this.firestore, this.customersCollection);
      const q = query(customersRef, where('landline', '==', landline));
      const querySnapshot = await getDocs(q);
      
      return !querySnapshot.empty;
    } catch (error) {
      console.error('Error checking landline:', error);
      throw error;
    }
 
 }
 

async getCustomerByMobile(mobile: string): Promise<any> {
  try {
    const customersRef = collection(this.firestore, this.customersCollection);
    const q = query(customersRef, where('mobile', '==', mobile));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    }
    return null;
  } catch (error) {
    console.error('Error fetching customer by mobile:', error);
    return null;
  }
}
}