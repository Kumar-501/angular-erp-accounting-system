import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  onSnapshot,
  query,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  where,
  orderBy,
  getDocs
} from '@angular/fire/firestore';
import { inject } from '@angular/core';
import { Observable } from 'rxjs';

// Define the Service interface here to avoid import issues
export interface Service {
  id?: string;
  name: string;
  description?: string;
  location?: string;
  priceGroup?: string;
  packingChargeType?: 'Fixed' | 'Variable';
  packingCharge?: number;
  enableCustomFields?: boolean;
  createdAt?: any;
  updatedAt?: any;
}

@Injectable({
  providedIn: 'root'
})
export class TypeOfServiceService {
  getTypeOfServices() {
    throw new Error('Method not implemented.');
  }
  private firestore = inject(Firestore);
  private collectionName = 'services';

  constructor() {}

  /**
   * Add a new service to Firestore
   * @param serviceData The service data to add
   * @returns Promise that resolves when the service is added
   */
  addService(serviceData: Service): Promise<any> {
    const servicesRef = collection(this.firestore, this.collectionName);
    
    // Add timestamps
    const dataWithTimestamps = {
      ...serviceData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    return addDoc(servicesRef, dataWithTimestamps);
  }

  /**
   * Update an existing service in Firestore
   * @param id The ID of the service to update
   * @param data The updated service data
   * @returns Promise that resolves when the service is updated
   */
  updateService(id: string, data: Partial<Service>): Promise<void> {
    const docRef = doc(this.firestore, this.collectionName, id);
    
    // Add updated timestamp
    const updatedData = {
      ...data,
      updatedAt: serverTimestamp()
    };
    
    return updateDoc(docRef, updatedData);
  }

  /**
   * Delete a service from Firestore
   * @param id The ID of the service to delete
   * @returns Promise that resolves when the service is deleted
   */
  deleteService(id: string): Promise<void> {
    const docRef = doc(this.firestore, this.collectionName, id);
    return deleteDoc(docRef);
  }

  /**
   * Get a real-time stream of services from Firestore
   * @returns Observable that emits an array of services whenever there's a change
   */
  getServicesRealtime(): Observable<Service[]> {
    return new Observable((observer) => {
      const servicesRef = collection(this.firestore, this.collectionName);
      const q = query(servicesRef);

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const services: Service[] = [];
        snapshot.forEach((doc) => {
          services.push({ id: doc.id, ...doc.data() as Service });
        });
        observer.next(services);
      }, (error) => {
        observer.error(error);
      });

      // Return the unsubscribe function to clean up when the observable is unsubscribed
      return () => unsubscribe();
    });
  }

  /**
   * Get a single service by ID
   * @param id The ID of the service to get
   * @returns Promise that resolves with the service data
   */
  async getServiceById(id: string): Promise<Service | null> {
    const docRef = doc(this.firestore, this.collectionName, id);
    const snapshot = await getDocs(query(collection(this.firestore, this.collectionName), where('__name__', '==', id)));
    
    if (snapshot.empty) {
      return null;
    }
    
    const data = snapshot.docs[0].data();
    return { id: snapshot.docs[0].id, ...data as Service };
  }
}