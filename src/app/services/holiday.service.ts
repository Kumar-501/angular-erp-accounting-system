// holiday.service.ts
import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc } from '@angular/fire/firestore';
import { Observable, of } from 'rxjs';  // Import Observable and of

@Injectable({
  providedIn: 'root',
})
export class HolidayService {
  constructor(private firestore: Firestore) {}

  // Adding holiday to Firestore
  addHoliday(data: any) {
    const holidaysCollection = collection(this.firestore, 'holidays');
    return addDoc(holidaysCollection, data);
  }
  updateHoliday(id: string, data: any) {
    const holidayDoc = doc(this.firestore, 'holidays', id);
    return updateDoc(holidayDoc, data);
  }

  deleteHoliday(id: string) {
    const holidayDoc = doc(this.firestore, 'holidays', id);
    return deleteDoc(holidayDoc);
  }

  // Get holidays
  getHolidays(callback?: (holidays: any[]) => void): Observable<any[]> {
    const holidaysCollection = collection(this.firestore, 'holidays');

    const holidaysObservable = new Observable<any[]>((observer) => {
      const unsubscribe = onSnapshot(holidaysCollection, (snapshot) => {
        const holidays = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        observer.next(holidays);

        if (callback) {
          callback(holidays);
        }
      });

      return () => unsubscribe();
    });

    return holidaysObservable;
  }
}
