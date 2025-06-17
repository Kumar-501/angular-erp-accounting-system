import { Injectable } from '@angular/core';
import { 
  Firestore, 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  DocumentData,
  QueryDocumentSnapshot,
  collectionData
} from '@angular/fire/firestore';
import { inject } from '@angular/core';
import { Observable } from 'rxjs';

// Add this interface definition
export interface LifeStage {
  id?: string;
  name: string;
  description: string;
}

@Injectable({
  providedIn: 'root',
})
export class LifeStageService {
  // Firestore instance should be injected properly
  private firestore: Firestore = inject(Firestore);
  
  // Define the collection reference
  private lifeStageCollection = collection(this.firestore, 'lifeStages');
  
  constructor() {}
  
  // Add a new life stage to Firestore
  addLifeStage(lifeStage: { name: string; description: string }): Promise<any> {
    return addDoc(this.lifeStageCollection, lifeStage);
  }
  
  getLifeStages(): Promise<LifeStage[]> {
    return getDocs(this.lifeStageCollection).then(snapshot => {
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data
        } as LifeStage;
      });
    });
  }
  
  getLifeStagesObservable(): Observable<LifeStage[]> {
    return collectionData(this.lifeStageCollection, { idField: 'id' }) as Observable<LifeStage[]>;
  }
  
  // Update a life stage in Firestore
  updateLifeStage(id: string, lifeStage: { name: string; description: string }): Promise<void> {
    const lifeStageDocRef = doc(this.firestore, 'lifeStages', id);
    return updateDoc(lifeStageDocRef, lifeStage);
  }
  
  // Delete a life stage from Firestore
  deleteLifeStage(id: string): Promise<void> {
    const lifeStageDocRef = doc(this.firestore, 'lifeStages', id);
    return deleteDoc(lifeStageDocRef);
  }
  
  // Export functions
  exportToCsv(data: any[]): void {
    const csvRows = [];
    // Add headers
    const headers = ['Life Stage', 'Description'];
    csvRows.push(headers.join(','));
    
    // Add data rows
    for (const item of data) {
      const values = [item.name, item.description];
      // Escape values with commas
      const escapedValues = values.map(value => `"${value}"`);
      csvRows.push(escapedValues.join(','));
    }
    
    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    
    // Download the file
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', 'life_stages.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
  
  exportToExcel(data: any[]): void {
    // In a real project, you would use a library like xlsx
    // For simplicity, we'll just export as CSV with .xlsx extension
    const csvRows = [];
    const headers = ['Life Stage', 'Description'];
    csvRows.push(headers.join(','));
    
    for (const item of data) {
      const values = [item.name, item.description];
      const escapedValues = values.map(value => `"${value}"`);
      csvRows.push(escapedValues.join(','));
    }
    
    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', 'life_stages.xlsx');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
  
  exportToPdf(data: any[]): void {
    // In a real project, you would use a library like jspdf
    // For demonstration, we'll create a simple HTML representation
    let htmlContent = `
      <html>
        <head>
          <title>Life Stages</title>
          <style>
            body { font-family: Arial, sans-serif; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
          </style>
        </head>
        <body>
          <h1>Life Stages</h1>
          <table>
            <thead>
              <tr>
                <th>Life Stage</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
    `;
    
    for (const item of data) {
      htmlContent += `
        <tr>
          <td>${item.name}</td>
          <td>${item.description}</td>
        </tr>
      `;
    }
    
    htmlContent += `
            </tbody>
          </table>
        </body>
      </html>
    `;
    
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = window.URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', 'life_stages.pdf');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    // In a real implementation, you would use a proper PDF library
    alert('PDF export requires a PDF generation library. This is a placeholder HTML file.');
  }
}