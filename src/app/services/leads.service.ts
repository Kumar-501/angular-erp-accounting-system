import { Injectable } from '@angular/core';
import { getDocs } from '@angular/fire/firestore';
import { MatSnackBar } from '@angular/material/snack-bar';

import {
  Firestore,
  collection,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  getDoc,
  query,
  orderBy,
  CollectionReference,
  DocumentData,
  where,
  writeBatch
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Timestamp } from 'firebase/firestore';
import { CustomerService } from './customer.service';

// Interface for Lead
export interface Lead {
  id?: string;
  contactId?: string;
  prefix?: string;
  firstName?: string;
  assignedToId?: string;  // Add this
  isConverted?: boolean;
  convertedTo?: string;  // Add this new property
  middleName?: string;
  saleid?: string;
    // ... other properties ...
  lastName?: string;
  
  orderStatus?: string; 
  mobileExists?: boolean; 
  isDuplicate?: boolean;
    department?: string;

  isReordered?: boolean;
  originalLeadId?: string; // For duplicate leads
  originalCustomerId?: string; // For reordered leads
  addedBy?: AddedBy; // Add this line
  gender?: string;
  dateOfBirth?: Date | string;
  age?: number;
  businessName?: string;
  email?: string;
  mobile?: string;
  alternateContact?: string;
  landline?: string;
  leadCategory?: string;
  dealStatus?: string;
  priority?: string;
  estimatedValue?: number;
  leadStatus?: string;
  productFileUrl?: string;
  leadStatusNote?: string;
  productInterested?: any; // Changed to any to handle various product formats
  source?: string;
  lifeStage?: string;
    occupation?: string;

  contactType?: string;
  status?: string;
  createdAt?: Date;
  updatedAt?: Date;
  assignedTo?: string;
  convertedAt?: Date | null;
  lastFollowUp?: FollowUp | null;
  upcomingFollowUp?: FollowUp | null;
  notes?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
  creditLimit?: number;
}

interface AddedBy {
  userId: string;
  userName: string;
  timestamp: Date | string;
}

// Interface for FollowUp
export interface FollowUp {
  id?: string;
  leadId?: string;
  title?: string;
  startDateTime?: Date | string;
  endDateTime?: Date | string;
  description?: string;
  type?: string;
  category?: string;
  assignedTo?: string;
  status?: string;
  completed?: boolean;
  createdAt?: Date;
  notification?: {
    sms?: boolean;
    email?: boolean;
    beforeValue?: number;
    beforeUnit?: string;
  };
}

// Interface for ConvertedCustomer
export interface ConvertedCustomer {
  id: string;
  displayName: string;
  contactId?: string;
  address?: string;
  email?: string;
  mobile?: string;
  alternateContact?: string;
  landline?: string;
  age?: number | null;
  gender?: string;
  occupation?: string;
  productInterested?: any;
  creditLimit?: number;
  otherData?: string;
  firstName?: string;
  lastName?: string;
  businessName?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
  isActive?: boolean;
  customerSince?: Date;
}

@Injectable({
  providedIn: 'root'
})
export class LeadService {
  [x: string]: any;
  private leadsCollection: CollectionReference<DocumentData>;
  private customersCollection: CollectionReference<DocumentData>;
  private followUpsCollection: CollectionReference<DocumentData>;

  constructor(
    private firestore: Firestore,
    private customerService: CustomerService
  ) {
    this.leadsCollection = collection(this.firestore, 'leads');
    
    this.customersCollection = collection(this.firestore, 'customers');
    this.followUpsCollection = collection(this.firestore, 'followUps');
  }

  async deleteLead(leadId: string): Promise<void> {
    const leadDocRef = doc(this.firestore, 'leads', leadId);
    return await deleteDoc(leadDocRef);
  }
getLeadsAssignedToUser(userId: string): Observable<Lead[]> {
  return new Observable((observer) => {
    const q = query(
      this.leadsCollection, 
      where('assignedToId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const leads = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data['createdAt']?.toDate?.() || data['createdAt'],
          updatedAt: data['updatedAt']?.toDate?.() || data['updatedAt'],
          convertedAt: data['convertedAt']?.toDate?.() || data['convertedAt']
        } as Lead;
      }).filter(lead => !lead.convertedAt); 

      this.loadLeadFollowUps(leads).then(leadsWithFollowUps => {
        observer.next(leadsWithFollowUps);
      });
    }, (error: Error) => {
      console.error('Error fetching leads:', error);
      observer.error(error);
    });

    return () => unsubscribe();
  });
}


// In leads.service.ts
getLeads(currentUserRole?: string, currentUsername?: string, currentUserDepartment?: string): Observable<Lead[]> {
  return new Observable((observer) => {
    let q;
    
    if (currentUserRole === 'Executive') {
      q = query(
        this.leadsCollection, 
        where('assignedTo', '==', currentUsername),
        orderBy('createdAt', 'desc')
      );
    } else {
      q = query(this.leadsCollection, orderBy('createdAt', 'desc'));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const leads = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data['createdAt']?.toDate?.() || data['createdAt'],
          updatedAt: data['updatedAt']?.toDate?.() || data['updatedAt'],
          convertedAt: data['convertedAt']?.toDate?.() || data['convertedAt']
        } as Lead;
      }).filter(lead => !lead.convertedAt);

      this.loadLeadFollowUps(leads).then(leadsWithFollowUps => {
        observer.next(leadsWithFollowUps);
      });
    }, (error: Error) => {
      console.error('Error fetching leads:', error);
      observer.error(error);
    });

    return () => unsubscribe();
  });
}

  private async loadLeadFollowUps(leads: Lead[]): Promise<Lead[]> {
    const updatedLeads = [...leads];

    const promises = updatedLeads.map(async (lead) => {
      if (!lead.id) return lead;

      const q = query(
        this.followUpsCollection,
        where('leadId', '==', lead.id),
        orderBy('startDateTime', 'asc')
      );

      return new Promise<Lead>((resolve) => {
        onSnapshot(q, (snapshot) => {
          const followUps = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              startDateTime: data['startDateTime']?.toDate?.() || data['startDateTime'],
              endDateTime: data['endDateTime']?.toDate?.() || data['endDateTime'],
              createdAt: data['createdAt']?.toDate?.() || data['createdAt']
            } as FollowUp;
          });

          const now = new Date();
          const pastFollowUps = followUps.filter(f =>
            new Date(f.startDateTime as string) < now
          ).sort((a, b) =>
            new Date(b.startDateTime as string).getTime() - new Date(a.startDateTime as string).getTime()
          );

          const futureFollowUps = followUps.filter(f =>
            new Date(f.startDateTime as string) >= now
          ).sort((a, b) =>
            new Date(a.startDateTime as string).getTime() - new Date(b.startDateTime as string).getTime()
          );

          lead.lastFollowUp = pastFollowUps.length > 0 ? pastFollowUps[0] : null;
          lead.upcomingFollowUp = futureFollowUps.length > 0 ? futureFollowUps[0] : null;

          resolve(lead);
        }, (error) => {
          console.error(`Error fetching follow-ups for lead ${lead.id}:`, error);
          resolve(lead);
        });
      });
    });

    await Promise.all(promises);
    return updatedLeads;
  }

  async checkMobileExists(mobile: string): Promise<{exists: boolean, customer?: any}> {
    try {
      const customer = await this.customerService.getCustomerByMobile(mobile);
      return { exists: !!customer, customer };
    } catch (error) {
      console.error('Error checking mobile:', error);
      return { exists: false };
    }
  }

 async addLead(lead: Partial<Lead>, currentUser: { userId: string, userName: string }): Promise<any> {
    try {
      // Check for duplicates first
      const duplicateLeads = await this.findDuplicateLeads(lead.mobile);
      
      const contactId = 'LEAD-' + Math.random().toString(36).substring(2, 11).toUpperCase();

      // Prepare the lead data with proper typing and required fields
      const newLead: Lead = {
        ...lead,
        contactId,
        isDuplicate: duplicateLeads.length > 0,
        originalLeadId: duplicateLeads.length > 0 ? duplicateLeads[0].id : undefined,
        contactType: 'Lead',
        status: lead.status || 'New',
        createdAt: new Date(),
        updatedAt: new Date(),
        convertedAt: null,
          occupation: lead.occupation || '', // Add this line

        productFileUrl: lead.productFileUrl || '',
        alternateContact: lead.alternateContact || '',
        addedBy: {
          userId: currentUser.userId,
          userName: currentUser.userName,
          timestamp: new Date()
        },
        // Ensure all required fields have default values
        firstName: lead.firstName || '',
        lastName: lead.lastName || '',
        mobile: lead.mobile || '',
        email: lead.email || '',
        source: lead.source || '',
        lifeStage: lead.lifeStage || ''
      };

      // Remove undefined values
      const cleanLead = JSON.parse(JSON.stringify(newLead));

      // Add the document to Firestore
      const docRef = await addDoc(this.leadsCollection, cleanLead);
      return docRef.id;

    } catch (error) {
      console.error('Error adding lead:', error);
      throw error; // Re-throw the error to handle it in the component
    }
  }


private async findDuplicateLeads(mobile: string | undefined): Promise<Lead[]> {
  if (!mobile) return [];
  
  const q = query(
    this.leadsCollection, 
    where('mobile', '==', mobile),
    where('convertedAt', '==', null) // Only unconverted leads
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as Lead));
}
// In leads.service.ts

// ... inside the LeadService class

// --- REPLACE this method with the updated version ---
// in lead.service.ts
// ... inside the LeadService class

// File: src/app/services/lead.service.ts

// REPLACE your existing convertLeadToCustomer method with this complete version.
// File: src/app/services/lead.service.ts

// REPLACE your existing convertLeadToCustomer method with this one.
// File: src/app/services/lead.service.ts

// REPLACE your existing convertLeadToCustomer method with this one.
 async convertLeadToCustomer(leadData: any): Promise<any> {
    try {
      // Prepare the new customer data object
      const customerData = {
        // ... (all other existing fields like contactId, firstName, mobile, etc. remain the same)
        contactId: this.generateCustomerId(),
        isIndividual: !leadData.businessName,
        businessName: leadData.businessName || '',
        prefix: leadData.prefix || '',
        firstName: leadData.firstName || '',
        middleName: leadData.middleName || '',
        lastName: leadData.lastName || '',
        email: leadData.email || '',
        mobile: leadData.mobile,
        landline: leadData.landline || '',
        alternateContact: leadData.alternateContact || '',
        gender: leadData.gender || '',
        age: leadData.age || null,
        occupation: leadData.occupation || '',
        dob: leadData.dateOfBirth || null,
        addressLine1: leadData.addressLine1 || '',
        addressLine2: leadData.addressLine2 || '',
        state: leadData.state || '',
        country: leadData.country || 'India',
        zipCode: leadData.zipCode || '',
        district: leadData.city || '',

        // ======================= THE FIX =======================
        // The field names here are now corrected to match what the form expects.
        leadStatus: leadData.leadStatus || '',      // SAVING AS 'leadStatus'
        lifeStage: leadData.lifeStage || '',       // SAVING AS 'lifeStage'
        leadCategory: leadData.leadCategory || '',
        dealStatus: leadData.dealStatus || '',
        priority: leadData.priority || '',
        estimatedValue: leadData.estimatedValue || '',
        // ===================== END OF THE FIX ====================

        // --- CRM & SYSTEM DATA ---
        assignedTo: leadData.assignedTo || '',
        assignedToId: leadData.assignedToId || '',
        department: leadData.department || '',
        source: leadData.source || '',
        contactType: 'Customer',
        status: 'Active',
        createdAt: new Date(),
        updatedAt: new Date(),
        convertedFromLead: leadData.id,
        notes: leadData.notes || '',
      };

      const customerRef = await addDoc(this.customersCollection, customerData);
      return { id: customerRef.id, ...customerData };

    } catch (error) {
      console.error('Error in convertLeadToCustomer:', error);
      throw error;
    }
  }


  private generateCustomerId(): string {
    const prefix = 'CUS';
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    return `${prefix}${randomNum}`;
  }
// async convertLeadToCustomer(leadData: any, isExistingCustomer: boolean = false): Promise<any> {
//   if (isExistingCustomer) {
//     return {
//       id: leadData.customerId,
//       ...leadData,
//       isExistingCustomer: true
//     };
//   }
  
//   const customerData = {
//     ...this.prepareCustomerDataFromLead(leadData),
//     convertedFromLead: leadData.id, // Store the lead ID
//     isConvertedCustomer: true
//   };
  
//   const docRef = await addDoc(this.customersCollection, customerData);
  
//   return { 
//     id: docRef.id, 
//     ...customerData,
//     isExistingCustomer: false
//   };
// }
  private prepareCustomerDataFromLead(leadData: any): any {
    return {
      firstName: leadData.firstName || '',
      lastName: leadData.lastName || '',
      businessName: leadData.businessName || '',
      displayName: leadData.businessName || `${leadData.firstName || ''} ${leadData.lastName || ''}`.trim(),
      email: leadData.email || '',
      mobile: leadData.mobile || '',
          alternateContact: leadData.alternateContact || '', // Add this line

      landline: leadData.landline || '',
      addressLine1: leadData.addressLine1 || '',
      addressLine2: leadData.addressLine2 || '',
      city: leadData.city || '',
      state: leadData.state || '',
      country: leadData.country || 'India',
      zipCode: leadData.zipCode || '',
      age: leadData.age || null,
      gender: leadData.gender || '',
      occupation: leadData.occupation || '',
      productInterested: leadData.productInterested || '',
      creditLimit: leadData.creditLimit || 0,
      notes: leadData.notes || '',
      contactType: 'Customer',
      status: 'Active',
      isActive: true,
      customerSince: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  async updateLead(leadId: string, lead: Partial<Lead>): Promise<void> {
    const leadDocRef = doc(this.firestore, 'leads', leadId);
    return await updateDoc(leadDocRef, {
      ...lead,
      updatedAt: new Date(),
        occupation: lead.occupation || '', // Add this line

      productFileUrl: lead.productFileUrl || '',
          alternateContact: lead.alternateContact || '', // Add this line

    });
  }

 async convertToCustomer(lead: any, createSalesOrder: boolean = false): Promise<any> {
  try {
    // Check if already converted
    if (lead.convertedAt) {
      return lead;
    }

    const contactId = 'CUST-' + Math.random().toString(36).substring(2, 8).toUpperCase();

    const customerData = {
      ...lead,
      contactId,
      contactType: 'Customer',
      convertedAt: new Date(),
      status: 'Active',
      isActive: true,
      customerSince: new Date(),
      displayName: lead.businessName || `${(lead.firstName || '').trim()} ${(lead.lastName || '').trim()}`.trim(),
      // ... rest of the customer data
    };

    // Add to customers collection
    const customerRef = await addDoc(this.customersCollection, customerData);

    // Update the lead document after successful conversion
    const leadDocRef = doc(this.firestore, 'leads', lead.id as string);
    
    if (createSalesOrder) {
      // If creating sales order, just mark as converted but don't delete yet
      await updateDoc(leadDocRef, {
        status: 'Converted',
        convertedAt: new Date(),
        convertedTo: customerRef.id
      });
    } else {
      // If not creating sales order, delete the lead
      await deleteDoc(leadDocRef);
    }

    return {
      id: customerRef.id,
      ...customerData
    };
  } catch (error) {
    console.error('Error converting lead to customer:', error);
    throw error;
  }
}

  async getLeadById(leadId: string): Promise<any> {
    try {
      const leadDoc = await getDoc(doc(this.firestore, 'leads', leadId));
      if (leadDoc.exists()) {
        return { id: leadDoc.id, ...leadDoc.data() };
      } else {
        throw new Error('Lead not found');
      }
    } catch (error) {
      console.error('Error getting lead:', error);
      throw error;
    }
  }

  async addFollowUp(followUpData: any): Promise<any> {
    const newFollowUp = {
      leadId: followUpData.leadId,
      title: followUpData.title,
      startDateTime: typeof followUpData.startDateTime === 'string'
        ? Timestamp.fromDate(new Date(followUpData.startDateTime))
        : followUpData.startDateTime,
      endDateTime: typeof followUpData.endDateTime === 'string'
        ? Timestamp.fromDate(new Date(followUpData.endDateTime))
        : followUpData.endDateTime,
      description: followUpData.description,
      type: followUpData.type,
      category: followUpData.category,
      assignedTo: followUpData.assignedTo,
      status: followUpData.status || 'Scheduled',
      completed: false,
      createdAt: new Date(),
      notification: followUpData.notification || null
    };

    return await addDoc(this.followUpsCollection, newFollowUp);
  }

  async completeFollowUp(followUpId: string): Promise<void> {
    const followUpDocRef = doc(this.firestore, 'followUps', followUpId);
    return await updateDoc(followUpDocRef, {
      completed: true,
      status: 'Completed'
    });
  }

  async updateFollowUp(followUpId: string, followUp: Partial<FollowUp>): Promise<void> {
    const followUpDocRef = doc(this.firestore, 'followUps', followUpId);
    return await updateDoc(followUpDocRef, followUp);
  }

  async deleteFollowUp(followUpId: string): Promise<void> {
    const followUpDocRef = doc(this.firestore, 'followUps', followUpId);
    return await deleteDoc(followUpDocRef);
  }

  getFollowUpsForLead(leadId: string): Observable<FollowUp[]> {
    return new Observable((observer) => {
      const q = query(
        this.followUpsCollection,
        where('leadId', '==', leadId),
        orderBy('startDateTime', 'asc')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const followUps = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            startDateTime: data['startDateTime']?.toDate?.() || data['startDateTime'],
            endDateTime: data['endDateTime']?.toDate?.() || data['endDateTime'],
            createdAt: data['createdAt']?.toDate?.() || data['createdAt']
          } as FollowUp;
        });
        observer.next(followUps);
      }, (error: Error) => {
        console.error(`Error fetching follow-ups for lead ${leadId}:`, error);
        observer.error(error);
      });

      return () => unsubscribe();
    });
  }
async getUserLeaveBalance(userId: string, leaveTypeId: string): Promise<{total: number, used: number, remaining: number}> {
  // Get all approved leaves for this user and leave type
  const q = query(
    collection(this.firestore, 'leaves'),
    where('employeeId', '==', userId),
    where('leaveTypeId', '==', leaveTypeId),
    where('status', '==', 'approved')
  );
  
  const querySnapshot = await getDocs(q);
  let totalUsedDays = 0;
  
  querySnapshot.forEach(doc => {
    const leave = doc.data();
    totalUsedDays += this.calculateLeaveDays(leave['startDate'].toDate(), leave['endDate'].toDate(), leave['session']);
  });
  
  // Get the leave type to know the max allowed
  const leaveTypeDoc = await getDoc(doc(this.firestore, 'leaveTypes', leaveTypeId));
  const maxLeaveCount = leaveTypeDoc.exists() ? leaveTypeDoc.data()['maxLeaveCount'] : 0;
  
  return {
    total: maxLeaveCount,
    used: totalUsedDays,
    remaining: Math.max(maxLeaveCount - totalUsedDays, 0)
  };
}
private calculateLeaveDays(startDate: Date, endDate: Date, session: string): number {
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  let days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both dates
  
  // Adjust for half-day sessions
  if (session === 'First Half' || session === 'Second Half') {
    days -= 0.5;
  }
  
  return days;
}
async assignLeads(leadIds: string[], userId: string, userName: string): Promise<void> {
  const batch = writeBatch(this.firestore);
  
  for (const leadId of leadIds) {
    const leadRef = doc(this.leadsCollection, leadId);
    batch.update(leadRef, {
      assignedTo: userName,
      assignedToId: userId,  // Make sure this is being set
      updatedAt: new Date()
    });
  }
  
  await batch.commit();
}
}