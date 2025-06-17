import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { GinTransfer } from '../services/gin-transfer.service';

@Component({
  selector: 'app-gin-transfer-view',
  templateUrl: './gin-transfer-view.component.html',
  styleUrls: ['./gin-transfer-view.component.scss']
})
export class GinTransferViewComponent {
  constructor(@Inject(MAT_DIALOG_DATA) public data: { 
    transfer: GinTransfer,
    getLocationName: (id: string) => string 
  }) {}

  print() {
    const printContent = document.querySelector('.gin-details-table')?.outerHTML;
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
              h1 { color: #333; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { padding: 8px 12px; border: 1px solid #ddd; }
              th { background-color: #f5f5f5; text-align: left; }
              .status-badge { padding: 4px 8px; border-radius: 12px; font-size: 12px; }
            </style>
          </head>
          <body>
            <h1>GIN Transfer Details - ${this.data.transfer.referenceNo}</h1>
            <p><strong>Date:</strong> ${new Date(this.data.transfer.date).toLocaleDateString()}</p>
            ${printContent}
          </body>
        </html>
      `);
      
      printWindow.document.close();
      printWindow.focus();
      
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
    }
  }
}