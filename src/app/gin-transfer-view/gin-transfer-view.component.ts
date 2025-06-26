import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { GinTransfer } from '../services/gin-transfer.service';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { Observable, from, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

@Component({
  selector: 'app-gin-transfer-view',
  templateUrl: './gin-transfer-view.component.html',
  styleUrls: ['./gin-transfer-view.component.scss']
})
export class GinTransferViewComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { 
      transfer: GinTransfer,
      getLocationName: (id: string) => string 
    },
    private firestore: Firestore
  ) {}

  // Method to get current stock for display
  getCurrentStock(locationId: string, productId: string): Observable<number | string> {
    if (!locationId || !productId) {
      return of('N/A');
    }
    
    const stockDocId = `${productId}_${locationId}`;
    const stockDocRef = doc(this.firestore, 'product-stock', stockDocId);
    
    return from(getDoc(stockDocRef)).pipe(
      map(snapshot => {
        if (snapshot.exists()) {
          return snapshot.data()?.['quantity'] || 0;
        }
        return 0;
      }),
      catchError(() => of('Error'))
    );
  }

  print() {
    const printContent = document.querySelector('.transfer-details-container')?.outerHTML;
    if (!printContent) return;

    const originalContent = document.body.innerHTML;
    const printWindow = window.open('', '_blank');
    
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>GIN Transfer - ${this.data.transfer.referenceNo}</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              h1, h2, h3 { color: #333; }
              .transfer-details-container { display: flex; flex-direction: column; gap: 20px; }
              .details-section, .locations-section, .products-section { 
                margin-bottom: 20px; 
                page-break-inside: avoid;
              }
              table { width: 100%; border-collapse: collapse; margin-top: 10px; }
              th, td { padding: 8px 12px; border: 1px solid #ddd; text-align: left; }
              th { background-color: #f5f5f5; }
              .status-badge { 
                padding: 4px 8px; 
                border-radius: 12px; 
                font-size: 12px; 
                font-weight: bold;
                text-transform: capitalize;
              }
              .pending { background-color: #fff3cd; color: #856404; }
              .completed { background-color: #d4edda; color: #155724; }
              .cancelled { background-color: #f8d7da; color: #721c24; }
              @media print {
                .no-print { display: none; }
                body { padding: 0; margin: 0; }
              }
            </style>
          </head>
          <body>
            <h1>GIN Transfer Details - ${this.data.transfer.referenceNo}</h1>
            <p><strong>Date:</strong> ${new Date(this.data.transfer.date).toLocaleDateString()}</p>
            ${printContent}
            <div class="no-print" style="margin-top: 20px; text-align: center;">
              <button onclick="window.print()" style="padding: 8px 16px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">Print</button>
              <button onclick="window.close()" style="padding: 8px 16px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer; margin-left: 10px;">Close</button>
            </div>
          </body>
        </html>
      `);
      
      printWindow.document.close();
      printWindow.focus();
      
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
  }
}