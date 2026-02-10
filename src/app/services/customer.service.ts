import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, query, onSnapshot, doc, updateDoc, deleteDoc, where, getDocs, orderBy, limit, collectionGroup, startAfter, getCountFromServer, QueryDocumentSnapshot, DocumentData, writeBatch, getDoc } from '@angular/fire/firestore';
import { Observable, BehaviorSubject, from, of } from 'rxjs';
import { map, switchMap, take } from 'rxjs/operators';

// Updated Customer interface with all form fields
export interface Customer {
  id?: string;
  contactId?: string;
  businessName?: string;
  convertedFromLead?: string;
  isConvertedCustomer?: boolean;
  lifeStage?: string;
  leadCategory?: string;
  lifestage?: string;
  adcode?: string;
  firstName?: string;
  lastName?: string;
  occupation?: string;
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
  gender?: 'Male' | 'Female' | 'Other' | '';
  age?: number;
  lastCallTime?: Date;
  callCount?: number;
  currentAddress?: string;
  currentCity?: string;
  address?: string;
  notes?: string;
  
  // New fields from the form
  customerType?: string; // Individual/Business
  customerCategory?: string; // Business to Business, Consumer, Retail, etc.
  tradeName?: string;
  incorporationDate?: Date;
  businessCategory?: string;
  turnover?: number;
  income?: number;
  gstNumber?: string;
  panNumber?: string;
  aadharNumber?: string;
  creditLimit?: number;
  creditDays?: number;
  priceList?: string;
  route?: string;
  salesRepresentative?: string;
  remarks?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  branch?: string;
  website?: string;
  fax?: string;
  pincode?: string;
  landmark?: string;
  area?: string;
  taluka?: string;
  district?: string;
  territory?: string;
  region?: string;
  zone?: string;
  leadSource?: string;
  referredBy?: string;
  anniversary?: Date;
  spouseName?: string;
  profession?: string;
  companyName?: string;
  designation?: string;
  workPhone?: string;
  homePhone?: string;
  alternateEmail?: string;
  socialMedia?: string;
  linkedIn?: string;
  facebook?: string;
  twitter?: string;
  instagram?: string;
  priority?: string;
  tags?: string;
  loyaltyCard?: string;
  membershipType?: string;
  membershipExpiry?: Date;
  preferredLanguage?: string;
  communicationPreference?: string;
  marketingConsent?: boolean;
  dataProtectionConsent?: boolean;
  lastPurchaseDate?: Date;
  totalPurchaseValue?: number;
  averageOrderValue?: number;
  frequencyOfPurchase?: string;
  paymentMethod?: string;
  shippingMethod?: string;
  deliveryInstructions?: string;
  specialRequirements?: string;
  contactOwner?: string;
  accountManager?: string;
  industry?: string;
  subIndustry?: string;
  companySize?: string;
  annualRevenue?: number;
  numberOfEmployees?: number;
  fiscalYearEnd?: Date;
  taxExempt?: boolean;
  taxExemptionNumber?: string;
  vatNumber?: string;
  registrationNumber?: string;
  licenses?: string;
  certifications?: string;
  qualityRating?: number;
  riskRating?: string;
  blacklisted?: boolean;
  blacklistReason?: string;
  approvalStatus?: string;
  approvedBy?: string;
  approvalDate?: Date;
  lastModifiedBy?: string;
  createdBy?: string;
  sourceSystem?: string;
  externalId?: string;
  syncStatus?: string;
  lastSyncDate?: Date;
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
  followUpDate?: any;
  createdAt: any;
  createdBy: string;
}

// Customer Activity interface
export interface CustomerActivity {
  id?: string;
  customerId: string;
  date: Date;
  action: string;
  by: string;
  notes: string;
  type: 'contact' | 'sale' | 'payment' | 'return' | 'status_change' | 'document' | 'communication';
  referenceId?: string;
  createdAt: Date;
    details?: string; // <-- ADD THIS LINE to allow the details property

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
  private customerActivitiesCollection = 'customer-activities';
  private batchSize = 50;

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
  private pageSize = 20;
  checkMobileExists: any;

  constructor(private firestore: Firestore) {
    this.updateTotalCount();
  }

  // CUSTOMER ACTIVITIES METHODS
  
  /**
   * Get customer activities by customer ID
   */
  getCustomerActivities(customerId: string): Observable<CustomerActivity[]> {
    const activitiesRef = collection(this.firestore, this.customerActivitiesCollection);
    const q = query(
      activitiesRef,
      where('customerId', '==', customerId),
      orderBy('createdAt', 'desc')
    );

    return new Observable<CustomerActivity[]>(observer => {
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const activities: CustomerActivity[] = [];
        querySnapshot.forEach(doc => {
          const data = doc.data() as Omit<CustomerActivity, 'id'>;
          activities.push({ 
            id: doc.id, 
            ...data,
            date: this.convertTimestampToDate(data.date),
            createdAt: this.convertTimestampToDate(data.createdAt)
          });
        });
        observer.next(activities);
      }, (error) => {
        console.error('Error fetching customer activities:', error);
        observer.error(error);
      });

      return () => unsubscribe();
    });
  }

  /**
   * Add a customer activity
   */
  async addCustomerActivity(activity: Omit<CustomerActivity, 'id'>): Promise<string> {
    try {
      const activitiesRef = collection(this.firestore, this.customerActivitiesCollection);
      const docRef = await addDoc(activitiesRef, {
        ...activity,
        date: activity.date || new Date(),
        createdAt: new Date()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error adding customer activity:', error);
      throw error;
    }
  }

  /**
   * Update a customer activity
   */
  async updateCustomerActivity(activityId: string, updates: Partial<CustomerActivity>): Promise<void> {
    try {
      const activityDoc = doc(this.firestore, this.customerActivitiesCollection, activityId);
      await updateDoc(activityDoc, {
        ...updates,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error updating customer activity:', error);
      throw error;
    }
  }

  /**
   * Delete a customer activity
   */
  async deleteCustomerActivity(activityId: string): Promise<void> {
    try {
      const activityDoc = doc(this.firestore, this.customerActivitiesCollection, activityId);
      await deleteDoc(activityDoc);
    } catch (error) {
      console.error('Error deleting customer activity:', error);
      throw error;
    }
  }

  /**
   * Helper method to convert Firebase timestamp to Date
   */
  private convertTimestampToDate(timestamp: any): Date {
    if (!timestamp) return new Date();
    
    if (timestamp instanceof Date) return timestamp;
    
    if (timestamp && typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }
    
    if (typeof timestamp === 'string' || typeof timestamp === 'number') {
      const date = new Date(timestamp);
      return isNaN(date.getTime()) ? new Date() : date;
    }
    
    return new Date();
  }

  // Initialize pagination with first batch
  initPagination(pageSize: number = this.batchSize): void {
    this.loadingSubject.next(true);
    const currentState = this.paginationState.value;

    this.paginationState.next({
      ...currentState,
      loading: true,
      data: [],
      lastDoc: null,
      hasMore: true
    });

    this.fetchCustomersPage(pageSize);
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

      const updatedData = startAfterDoc
        ? [...currentState.data, ...newCustomers]
        : newCustomers;

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

// In customer.service.ts

// In customer.service.ts

private prepareCustomerDataFromLead(lead: any): any {
  return {
    // --- Existing Fields (Verified) ---
    contactId: lead.contactId || this.generateContactId(),
    businessName: lead.businessName || '',
    firstName: lead.firstName || '',
    lastName: lead.lastName || '',
    middleName: lead.middleName || '',
    prefix: lead.prefix || '',
    isIndividual: !lead.businessName,
    occupation: lead.occupation || '',
    email: lead.email || '',
    mobile: lead.mobile || '',
    landline: lead.landline || '',
    alternateContact: lead.alternateContact || '',
    assignedTo: lead.assignedTo || '',
    status: 'Active',
    addressLine1: lead.addressLine1 || '',
    addressLine2: lead.addressLine2 || '',
    state: lead.state || '',
    country: lead.country || 'India',
    zipCode: lead.zipCode || '',
    contactType: 'Customer',
    createdAt: new Date(), // The conversion date
    updatedAt: new Date(),
    convertedFromLead: lead.id || null,
    notes: lead.notes || '',
    source: lead.source || '',
    gender: lead.gender || '',
    age: lead.age || null,
    department: lead.department || '',

    // --- COMPLETE MAPPINGS (FIX) ---
    dob: lead.dateOfBirth || null,  // Maps Lead's "dateOfBirth" to Customer's "dob"
    district: lead.city || '',        // Maps Lead's "city" field to Customer's "district"
    adcode: lead.leadStatus || '',  // Maps Lead's "leadStatus" to Customer's "adcode"
    lifestage: lead.lifeStage || '' // Maps Lead's "lifeStage" to Customer's "lifestage"
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
      const customerDoc = doc(this.firestore, this.customersCollection, id);
      const docSnap = await getDoc(customerDoc);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Customer;
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

  async bulkDeleteCustomers(customerIds: string[]): Promise<void> {
    const batch = writeBatch(this.firestore);
    const leadsToDelete: string[] = [];

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

    leadsToDelete.forEach(leadId => {
      const leadDoc = doc(this.firestore, 'leads', leadId);
      batch.delete(leadDoc);
    });

    await batch.commit();
    await this.updateTotalCount();
  }

  async addCustomer(customer: Customer): Promise<string> {
    try {
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

      // Add initial activity
      await this.addCustomerActivity({
        customerId: docRef.id,
        action: 'Customer Created',
        by: 'System',
        notes: 'Customer record created',
        type: 'contact',
        date: new Date(),
        createdAt: new Date()
      });

      await this.updateTotalCount();

      return docRef.id;
    } catch (error) {
      console.error('Error adding customer:', error);
      throw error;
    }
  }

  // Update existing customer

private getFieldDisplayName(field: string): string {
    const fieldMap: { [key: string]: string } = {
      'businessName': 'Business Name', 'firstName': 'First Name', 'lastName': 'Last Name',
      'email': 'Email', 'mobile': 'Mobile', 'landline': 'Landline', 'alternateContact': 'Alternate Contact',
      'status': 'Status', 'addressLine1': 'Address Line 1', 'addressLine2': 'Address Line 2',
      'city': 'City', 'state': 'State', 'country': 'Country', 'zipCode': 'Zip Code',
      'occupation': 'Occupation', 'department': 'Department', 'assignedTo': 'Assigned To',
      'contactType': 'Contact Type', 'openingBalance': 'Opening Balance', 'creditLimit': 'Credit Limit'
    };
    // This makes the field name readable, e.g., "businessName" becomes "Business Name"
    return fieldMap[field] || field.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase());
  }
 private formatActivityValue(value: any): string {
    if (value === null || value === undefined) {
      return 'Empty';
    }
    // Check for Firebase Timestamp and format it
    if (value && typeof value.toDate === 'function') {
      const date = value.toDate();
      // Return a simple, readable date format
      return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    // Check for regular JavaScript Date and format it
    if (value instanceof Date) {
      return value.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    return String(value);
  }
  // ENHANCED updateCustomer method for detailed activity logging
// ... (keep all existing code and the formatActivityValue helper function) ...

  // REPLACE your updateCustomer method with this corrected version
  async updateCustomer(id: string, customerUpdates: Partial<Customer>, updatedBy: string = 'System'): Promise<void> {
    const customerDoc = doc(this.firestore, this.customersCollection, id);

    const oldCustomerData = await this.getCustomerByIdPromise(id);
    if (!oldCustomerData) {
      throw new Error(`Customer with ID ${id} not found.`);
    }

    // Perform the update first, including the new updatedAt timestamp
    const updateData = { ...customerUpdates, updatedAt: new Date() };
    await updateDoc(customerDoc, updateData);
    
    // Now, prepare the activity log
    const changes: string[] = [];
    const detailedChanges: any[] = [];

    // Loop through the original updates to find what changed
    for (const key in customerUpdates) {
      // This check ensures we only process valid keys from the customerUpdates object
      if (Object.prototype.hasOwnProperty.call(customerUpdates, key)) {
        // We don't want to log the 'updatedAt' field itself as a change, so we skip it
        if (key === 'updatedAt') {
          continue; 
        }

        // Explicitly tell TypeScript the type of the key
        const typedKey = key as keyof Customer;
        const oldValue = oldCustomerData[typedKey];
        const newValue = customerUpdates[typedKey];

        // Format the values before comparing and logging them
        const formattedOldValue = this.formatActivityValue(oldValue);
        const formattedNewValue = this.formatActivityValue(newValue);

        if (formattedOldValue !== formattedNewValue) {
          const fieldName = this.getFieldDisplayName(key);
          changes.push(`${fieldName} changed from "${formattedOldValue}" to "${formattedNewValue}"`);
          detailedChanges.push({ field: fieldName, from: formattedOldValue, to: formattedNewValue });
        }
      }
    }

    if (changes.length > 0) {
      // Create a cleaner note for the activity log
      const notes = `The following fields were updated: ${changes.join('; ')}.`;
      
      await this.addCustomerActivity({
        customerId: id,
        action: 'Customer Updated', // Changed from 'Edited' to be more specific
        by: updatedBy,
        notes: notes,
        type: 'contact',
        date: new Date(),
        createdAt: new Date(),
        details: JSON.stringify(detailedChanges, null, 2)
      });
    }
  }

// ... (keep all existing code after this point)


  updateCustomerObservable(id: string, customer: Partial<Customer>): Observable<void> {
    return from(this.updateCustomer(id, customer));
  }

  async deleteCustomer(id: string): Promise<void> {
    try {
      const customerDoc = doc(this.firestore, this.customersCollection, id);
      const customerSnapshot = await getDoc(customerDoc);

      if (!customerSnapshot.exists()) {
        throw new Error('Customer not found');
      }

      const customerData = customerSnapshot.data() as Customer;

      const batch = writeBatch(this.firestore);

      batch.delete(customerDoc);

      if (customerData.convertedFromLead) {
        const leadDoc = doc(this.firestore, 'leads', customerData.convertedFromLead);
        batch.delete(leadDoc);
      }

      await batch.commit();

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

  async addCallLog(customerId: string, callLogData: Omit<CallLog, 'id'>): Promise<string> {
    const callLogsRef = collection(this.firestore, `${this.customersCollection}/${customerId}/callLogs`);
    const docRef = await addDoc(callLogsRef, {
      ...callLogData,
      createdAt: callLogData.createdAt || new Date()
    });

    // Add activity for call log
    await this.addCustomerActivity({
      customerId,
      action: 'Call Log Added',
      by: callLogData.createdBy || 'System',
      notes: `Call: ${callLogData.subject}`,
      type: 'communication',
      referenceId: docRef.id,
      date: new Date(),
      createdAt: new Date()
    });

    return docRef.id;
  }

  async updateCallLog(customerId: string, callLogId: string, callLogData: Partial<CallLog>): Promise<void> {
    const callLogDoc = doc(this.firestore, `${this.customersCollection}/${customerId}/callLogs/${callLogId}`);
    await updateDoc(callLogDoc, { ...callLogData });

    // Add activity for call log update
    await this.addCustomerActivity({
      customerId,
      action: 'Call Log Updated',
      by: 'System',
      notes: 'Call log updated',
      type: 'communication',
      referenceId: callLogId,
      date: new Date(),
      createdAt: new Date()
    });
  }

  async deleteCallLog(customerId: string, callLogId: string): Promise<void> {
    const callLogDoc = doc(this.firestore, `${this.customersCollection}/${customerId}/callLogs/${callLogId}`);
    await deleteDoc(callLogDoc);

    // Add activity for call log deletion
    await this.addCustomerActivity({
      customerId,
      action: 'Call Log Deleted',
      by: 'System',
      notes: 'Call log deleted',
      type: 'communication',
      referenceId: callLogId,
      date: new Date(),
      createdAt: new Date()
    });
  }

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

  getRecentCallLogs(limitCount: number = 10): Observable<Array<CallLog & { customerId: string }>> {
    const callLogsCollectionGroup = collectionGroup(this.firestore, 'callLogs');
    const q = query(callLogsCollectionGroup, orderBy('createdAt', 'desc'), limit(limitCount));

    return new Observable<Array<CallLog & { customerId: string }>>(observer => {
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const callLogs: Array<CallLog & { customerId: string }> = [];
        snapshot.forEach(doc => {
          const data = doc.data() as Omit<CallLog, 'id'>;
          const path = doc.ref.path;
          const pathSegments = path.split('/');
          const customerId = pathSegments[1];

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

  async getCallLogCount(customerId: string): Promise<number> {
    const callLogsRef = collection(this.firestore, `${this.customersCollection}/${customerId}/callLogs`);
    const snapshot = await getDocs(callLogsRef);
    return snapshot.size;
  }

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

  async getCustomersByMobileNumbers(mobileNumbers: string[]): Promise<Customer[]> {
    if (!mobileNumbers || mobileNumbers.length === 0) {
      return [];
    }

    const customersRef = collection(this.firestore, this.customersCollection);
    const allMatchingCustomers: Customer[] = [];

    const chunkSize = 30;
    const chunks: string[][] = [];
    for (let i = 0; i < mobileNumbers.length; i += chunkSize) {
      chunks.push(mobileNumbers.slice(i, i + chunkSize));
    }

    const fetchPromises = chunks.map(chunk => {
      const q = query(customersRef, where('mobile', 'in', chunk));
      return getDocs(q);
    });

    try {
      const allSnapshots = await Promise.all(fetchPromises);

      for (const snapshot of allSnapshots) {
        snapshot.forEach(doc => {
          allMatchingCustomers.push({ id: doc.id, ...doc.data() } as Customer);
        });
      }
    } catch (error) {
      console.error('Error fetching customers by mobile numbers:', error);
      throw error;
    }

    return allMatchingCustomers;
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
      return null;
    }
  }
  
  
}