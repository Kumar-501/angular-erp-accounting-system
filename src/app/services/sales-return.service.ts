import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class SalesReturnService {
  constructor(private firestore: AngularFirestore) {}

  // Save a new return
  createReturn(returnData: any): Promise<any> {
    return this.firestore.collection('salesReturns').add(returnData);
  }

  // Real-time return data using snapshotChanges()
getReturns(): Observable<any[]> {
  return this.firestore.collection('salesReturns').snapshotChanges().pipe(
    map(actions =>
      actions.map(a => {
        const data = a.payload.doc.data() as { [key: string]: any };
        const id = a.payload.doc.id;
        return { id, ...data };
      })
    )
  );
}

getReturnsByDateRange(startDate: Date, endDate: Date): Observable<any[]> {
  return this.firestore.collection('salesReturns', ref =>
    ref.where('returnDate', '>=', startDate)
       .where('returnDate', '<=', endDate)
  ).snapshotChanges().pipe(
    map(actions =>
      actions.map(a => {
        const data = a.payload.doc.data() as { [key: string]: any };  // ✅ Cast to object
        const id = a.payload.doc.id;
        return { id, ...data };
      })
    )
  );
}

}
