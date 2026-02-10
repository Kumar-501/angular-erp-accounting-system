import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  getDoc
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LocationService {
  constructor(private firestore: Firestore) {}

  // Add a new location
  addLocation(data: any) {
    const locationsCollection = collection(this.firestore, 'locations');
    return addDoc(locationsCollection, {
      ...data,
      active: true,
      createdAt: new Date()
    });
  }
// Add this method to your LocationService
async getLocationById(id: string): Promise<any> {
  try {
    const locationDoc = doc(this.firestore, 'locations', id);
    const locationSnap = await getDoc(locationDoc);
    
    if (locationSnap.exists()) {
      return { 
        id: locationSnap.id, 
        ...locationSnap.data() 
      };
    } else {
      console.warn(`Location with ID ${id} not found`);
      return null;
    }
  } catch (error) {
    console.error('Error getting location by ID:', error);
    throw error;
  }
}
  // Get locations with real-time updates (only active ones)
  getLocations(): Observable<any[]> {
    const locationsCollection = collection(this.firestore, 'locations');
    
    // Return an Observable that will emit the latest locations data
    return new Observable<any[]>((observer) => {
      // Create a query to get only active locations
      const activeLocationsQuery = query(
        locationsCollection,
        where('active', '==', true)
      );
      
      // onSnapshot provides real-time updates
      const unsubscribe = onSnapshot(
        activeLocationsQuery,
        (snapshot) => {
          const locations = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          observer.next(locations);
        },
        (error) => {
          observer.error(error);
        }
      );
      
      // Clean up the subscription when the observable is unsubscribed
      return () => unsubscribe();
    });
  }

  // Update an existing location
  updateLocation(id: string, data: any) {
    const locationDoc = doc(this.firestore, 'locations', id);
    return updateDoc(locationDoc, {
      ...data,
      updatedAt: new Date()
    });
  }

  // Deactivate a location (soft delete)
  deactivateLocation(id: string) {
    const locationDoc = doc(this.firestore, 'locations', id);
    return updateDoc(locationDoc, {
      active: false,
      deactivatedAt: new Date()
    });
  }
// Add this to your LocationService
async getAllLocations(): Promise<any[]> {
  try {
    const locationsCollection = collection(this.firestore, 'locations');
    const querySnapshot = await getDocs(locationsCollection);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting all locations:', error);
    return [];
  }
}
  // Hard delete a location (use with caution)
  deleteLocation(id: string) {
    const locationDoc = doc(this.firestore, 'locations', id);
    return deleteDoc(locationDoc);
  }
}