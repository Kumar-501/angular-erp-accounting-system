// units.service.ts
import { Injectable } from '@angular/core';
import { Firestore, doc, getDoc, updateDoc, deleteDoc, collection, addDoc, onSnapshot, query, where } from '@angular/fire/firestore';
import { inject } from '@angular/core';
import { Observable, BehaviorSubject } from 'rxjs';

export interface Unit {
  id?: string;
  name: string;
  shortName: string;
  allowDecimal: boolean;
  isMultiple: boolean; // Changed from optional to required
  baseUnit?: string;
  multiplier?: number;
}

@Injectable({
  providedIn: 'root'
})
export class UnitsService {
  private firestore: Firestore = inject(Firestore);
  
  // Add BehaviorSubject to store units
  private unitsSubject = new BehaviorSubject<Unit[]>([]);
  public units$ = this.unitsSubject.asObservable();

  constructor() {
    // Load units on service initialization
    this.loadUnits();
  }

  // Load units into subject
  private loadUnits(): void {
    const unitsCollection = collection(this.firestore, 'units');
    onSnapshot(unitsCollection, snapshot => {
      const units = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Unit));
      this.unitsSubject.next(units);
    });
  }

  // Get all units
  getUnits(): Observable<Unit[]> {
    return this.units$;
  }

  // Add a new unit
  async addUnit(unitData: Unit): Promise<any> {
    try {
      // Ensure boolean conversion
      unitData.allowDecimal = !!unitData.allowDecimal;
      unitData.isMultiple = !!unitData.isMultiple;
      
      // Convert to a plain object without methods to be safe with Firestore
      const unitObject = { ...unitData };
      
      const unitsCollection = collection(this.firestore, 'units');
      const docRef = await addDoc(unitsCollection, unitObject);
      return docRef;
    } catch (error) {
      console.error('Error adding unit: ', error);
      throw error;
    }
  }

  // Update a unit
async updateUnit(unitId: string, updatedData: Unit): Promise<void> {
  try {
    // Ensure boolean conversion
    updatedData.allowDecimal = !!updatedData.allowDecimal;
    updatedData.isMultiple = !!updatedData.isMultiple;
    
    // Create a plain object with index signature that TypeScript can work with
    const updateObject: Record<string, any> = { 
      name: updatedData.name,
      shortName: updatedData.shortName,
      allowDecimal: updatedData.allowDecimal,
      isMultiple: updatedData.isMultiple
    };
    
    // Only add these if they exist
    if (updatedData.baseUnit) updateObject['baseUnit'] = updatedData.baseUnit;
    if (updatedData.multiplier !== undefined) updateObject['multiplier'] = updatedData.multiplier;
    
    const unitDoc = doc(this.firestore, 'units', unitId);
    await updateDoc(unitDoc, updateObject);
  } catch (error) {
    console.error('Error updating unit: ', error);
    throw error;
  }
}

  // Delete a unit
  async deleteUnit(unitId: string): Promise<void> {
    try {
      const unitDoc = doc(this.firestore, 'units', unitId);
      await deleteDoc(unitDoc);
    } catch (error) {
      console.error('Error deleting unit: ', error);
      throw error;
    }
  }

  // Get a unit by ID
  getUnitById(unitId: string): Observable<Unit | null> {
    return new Observable<Unit | null>(observer => {
      const unitDoc = doc(this.firestore, 'units', unitId);
      const unsubscribe = onSnapshot(unitDoc, snapshot => {
        if (snapshot.exists()) {
          observer.next({
            id: snapshot.id,
            ...snapshot.data()
          } as Unit);
        } else {
          observer.next(null);
        }
      });
      return () => unsubscribe();
    });
  }
}