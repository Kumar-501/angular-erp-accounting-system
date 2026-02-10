import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { GinTransfer } from '../services/gin-transfer.service';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { Observable, from, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

@Component({
  selector: 'app-gin-transfer-view',
  templateUrl: './gin-transfer-view.component.html',
  styleUrls: ['./gin-transfer-view.component.scss']
})
export class GinTransferViewComponent implements OnInit {
  transferDate: Date | null = null;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: {
      transfer: GinTransfer,
      getLocationName: (id: string) => string
    },
    private dialogRef: MatDialogRef<GinTransferViewComponent>,
    private firestore: Firestore
  ) {}

  ngOnInit(): void {
    const dateValue = this.data.transfer.date;

    if (!dateValue) {
      this.transferDate = null;
      return;
    }

    // Case 1: Check for Firestore Timestamp object first
    if (typeof (dateValue as any).toDate === 'function') {
      this.transferDate = (dateValue as any).toDate();
    } 
    // Case 2: Handle the specific 'DD-MM-YYYY HH:mm' string format
    else if (typeof dateValue === 'string' && dateValue.includes('-') && dateValue.includes(':')) {
      const parts = dateValue.split(' ');
      const dateParts = parts[0].split('-').map(Number);
      const timeParts = parts[1].split(':').map(Number);

      if (dateParts.length === 3 && timeParts.length === 2) {
        // Parts are [DD, MM, YYYY] and [HH, mm]
        // Note: JavaScript's Date month is 0-indexed (0=Jan, 1=Feb, etc.)
        this.transferDate = new Date(dateParts[2], dateParts[1] - 1, dateParts[0], timeParts[0], timeParts[1]);
      }
    } 
    // Case 3: Fallback for other standard date string formats
    else {
      this.transferDate = new Date(dateValue);
    }

    // Final check for validity to prevent "Invalid Date" from being used
    if (this.transferDate && isNaN(this.transferDate.getTime())) {
      console.error('Failed to parse date, resulting in an invalid date:', dateValue);
      this.transferDate = null;
    }
  }

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

  // Get all products from either new or legacy structure
  getAllProducts(): any[] {
    const transfer = this.data.transfer;

    if (transfer.transfers && transfer.transfers.length > 0) {
      const allProducts: any[] = [];
      transfer.transfers.forEach(t => {
        t.products.forEach(product => {
          allProducts.push({
            ...product,
            destinationLocation: t.locationName || this.data.getLocationName(t.locationId)
          });
        });
      });
      return allProducts;
    }

    // Fallback to legacy structure
    return transfer.items || [];
  }

  // Get destination locations text
  getDestinationLocations(): string[] {
    const transfer = this.data.transfer;

    if (transfer.transfers && transfer.transfers.length > 0) {
      return transfer.transfers.map(t => t.locationName || this.data.getLocationName(t.locationId));
    }

    // Fallback to legacy structure
    if (transfer.locationTo) {
      return [this.data.getLocationName(transfer.locationTo)];
    }

    return ['Not specified'];
  }

  closeDialog(): void {
    this.dialogRef.close();
  }

  print(): void {
    const printContent = document.querySelector('.transfer-details-container')?.outerHTML;
    if (!printContent) return;

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
              .draft { background-color: #e2e3e5; color: #495057; }
              @media print {
                .no-print { display: none; }
                body { padding: 0; margin: 0; }
              }
            </style>
          </head>
          <body>
            <h1>GIN Transfer Details - ${this.data.transfer.referenceNo}</h1>
            <p><strong>Date:</strong> ${this.transferDate?.toLocaleDateString() || 'N/A'}</p>
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