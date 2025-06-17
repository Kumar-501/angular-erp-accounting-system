import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, doc, deleteDoc, updateDoc, onSnapshot } from '@angular/fire/firestore';
import * as XLSX from 'xlsx';

@Injectable({
  providedIn: 'root',
})
export class CommissionService {
  private collectionName = 'salesAgents';

  constructor(private firestore: Firestore) {}

  async addSalesAgent(agent: any): Promise<void> {
    const salesAgentsCollection = collection(this.firestore, this.collectionName);
    await addDoc(salesAgentsCollection, agent);
  }

  async updateSalesAgent(id: string, agent: any): Promise<void> {
    const agentDocRef = doc(this.firestore, `${this.collectionName}/${id}`);
    await updateDoc(agentDocRef, agent);
  }

  async deleteSalesAgent(id: string): Promise<void> {
    const agentDocRef = doc(this.firestore, `${this.collectionName}/${id}`);
    await deleteDoc(agentDocRef);
  }

  listenToSalesAgents(callback: (agents: any[]) => void): () => void {
    const salesAgentsCollection = collection(this.firestore, this.collectionName);
    return onSnapshot(salesAgentsCollection, (snapshot) => {
      const agents = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      callback(agents);
    });
  }

  exportAgentsCSV(salesAgents: any[]): void {
    const csvData = this.convertToCSV(salesAgents);
    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sales_agents.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  }

  exportAgentsExcel(salesAgents: any[]): void {
    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(salesAgents);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sales Agents');
    XLSX.writeFile(wb, 'sales_agents.xlsx');
  }

  private convertToCSV(data: any[]): string {
    const headers = ['User Name', 'Commission Percentage (%)'].join(',');
    const rows = data.map(item => `"${item.userName}",${item.commissionPercentage}`);
    return [headers, ...rows].join('\n');
  }
}