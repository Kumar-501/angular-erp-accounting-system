import {
  Firestore,
  collection,
  addDoc,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Injectable } from '@angular/core';

export interface Shift {
  shiftName: string;
  startTime: string;
  endTime: string;
  description: string;
  shiftType: string;
  holiday: string;
  id?: string;
}

export interface Attendance {
  employee: string;
  clockInTime: string;
  clockOutTime: string;
  shift: string;
  ipAddress: string;
  clockInNote: string;
  clockOutNote: string;
  id?: string;
}

@Injectable({
  providedIn: 'root',
})
export class AttendanceService {
  constructor(private firestore: Firestore) {}

  addShift(shift: Shift) {
    const shiftsRef = collection(this.firestore, 'shifts');
    return addDoc(shiftsRef, shift);
  }

  updateShift(id: string, shift: Shift) {
    const { id: _, ...shiftData } = shift; // Remove id from the data to be updated
    const shiftRef = doc(this.firestore, 'shifts', id);
    return updateDoc(shiftRef, shiftData);
  }

  getShiftsRealTime(): Observable<Shift[]> {
    const shiftsRef = collection(this.firestore, 'shifts');
    return new Observable<Shift[]>((observer) => {
      return onSnapshot(shiftsRef, (snapshot) => {
        const shifts: Shift[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Shift[];
        observer.next(shifts);
      });
    });
  }

  addAttendance(attendance: Attendance) {
    const attendanceRef = collection(this.firestore, 'attendance');
    return addDoc(attendanceRef, attendance);
  }

  updateAttendance(id: string, attendance: Attendance) {
    const { id: _, ...attendanceData } = attendance; // Remove id from the data to be updated
    const attendanceRef = doc(this.firestore, 'attendance', id);
    return updateDoc(attendanceRef, attendanceData);
  }

  getAttendanceRealTime(): Observable<Attendance[]> {
    const attendanceRef = collection(this.firestore, 'attendance');
    return new Observable<Attendance[]>((observer) => {
      return onSnapshot(attendanceRef, (snapshot) => {
        const records: Attendance[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Attendance[];
        observer.next(records);
      });
    });
  }
  deleteShift(id: string) {
    if (!id) return Promise.reject('No ID provided');
    const shiftRef = doc(this.firestore, 'shifts', id);
    return deleteDoc(shiftRef);
  }
}