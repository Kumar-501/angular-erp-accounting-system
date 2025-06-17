import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc } from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root'  // This is crucial
})
export class TaskService {
  constructor(private firestore: Firestore) {}

  addTask(task: any) {
    const tasksRef = collection(this.firestore, 'tasks');
    return addDoc(tasksRef, task);
  }
  

  
}