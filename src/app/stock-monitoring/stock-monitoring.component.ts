import { Component, OnInit, OnDestroy } from '@angular/core';
import { DailyStockService, DailyStockSnapshot } from '../services/daily-stock.service';

@Component({
  selector: 'app-stock-monitoring',
  template: `
    <div class="stock-monitoring-dashboard">
      <h2>Real-Time Stock Monitoring Dashboard</h2>
      
      <!-- Daily Snapshots Section -->
      <div class="section">
        <h3>Daily Stock Snapshots</h3>
        <button (click)="startSnapshotMonitoring()">Start Monitoring</button>
        <button (click)="stopSnapshotMonitoring()">Stop Monitoring</button>
        
        <div class="snapshots-list" *ngIf="dailySnapshots.length > 0">
          <div *ngFor="let snapshot of dailySnapshots" class="snapshot-card">
            <h4>{{ snapshot.productId }} - {{ snapshot.locationId }}</h4>
            <p>Date: {{ snapshot.date }}</p>
            <p>Opening: {{ snapshot.openingStock }}</p>
            <p>Closing: {{ snapshot.closingStock }}</p>
            <p>Received: {{ snapshot.totalReceived }}</p>
            <p>Issued: {{ snapshot.totalIssued }}</p>
          </div>
        </div>
      </div>

      <!-- Stock Movement Logs -->
      <div class="section">
        <h3>Real-Time Stock Movements</h3>
        <button (click)="startAllMovementMonitoring()">Start All Movement Monitoring</button>
        <button (click)="stopAllMovementMonitoring()">Stop All Movement Monitoring</button>
        
        <div class="movement-logs">
          <div class="log-section">
            <h4>Product Stock Changes</h4>
            <div *ngFor="let log of productStockLogs" class="log-entry">
              {{ log.timestamp }}: {{ log.message }}
            </div>
          </div>
          
          <div class="log-section">
            <h4>Purchase Movements</h4>
            <div *ngFor="let log of purchaseLogs" class="log-entry">
              {{ log.timestamp }}: {{ log.message }}
            </div>
          </div>
          
          <div class="log-section">
            <h4>Sales Movements</h4>
            <div *ngFor="let log of salesLogs" class="log-entry">
              {{ log.timestamp }}: {{ log.message }}
            </div>
          </div>
          
          <div class="log-section">
            <h4>GIN Transfers</h4>
            <div *ngFor="let log of ginLogs" class="log-entry">
              {{ log.timestamp }}: {{ log.message }}
            </div>
          </div>
          
          <div class="log-section">
            <h4>Returns</h4>
            <div *ngFor="let log of returnLogs" class="log-entry">
              {{ log.timestamp }}: {{ log.message }}
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .stock-monitoring-dashboard {
      padding: 20px;
      max-width: 1200px;
    }
    
    .section {
      margin-bottom: 40px;
      border: 1px solid #ddd;
      padding: 20px;
      border-radius: 8px;
    }
    
    .snapshots-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 15px;
      margin-top: 20px;
    }
    
    .snapshot-card {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 8px;
      border: 1px solid #dee2e6;
    }
    
    .snapshot-card h4 {
      margin: 0 0 10px 0;
      color: #495057;
    }
    
    .snapshot-card p {
      margin: 5px 0;
      font-size: 14px;
    }
    
    .movement-logs {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-top: 20px;
    }
    
    .log-section {
      background: #ffffff;
      border: 1px solid #e9ecef;
      padding: 15px;
      border-radius: 6px;
      max-height: 300px;
      overflow-y: auto;
    }
    
    .log-section h4 {
      margin: 0 0 15px 0;
      color: #212529;
      border-bottom: 1px solid #dee2e6;
      padding-bottom: 5px;
    }
    
    .log-entry {
      padding: 8px;
      margin-bottom: 8px;
      background: #f8f9fa;
      border-radius: 4px;
      font-size: 12px;
      border-left: 3px solid #007bff;
    }
    
    button {
      margin: 5px;
      padding: 10px 15px;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    
    button:hover {
      background: #0056b3;
    }
  `]
})
export class StockMonitoringComponent implements OnInit, OnDestroy {
  dailySnapshots: DailyStockSnapshot[] = [];
  
  // Log arrays for different types of movements
  productStockLogs: { timestamp: string; message: string }[] = [];
  purchaseLogs: { timestamp: string; message: string }[] = [];
  salesLogs: { timestamp: string; message: string }[] = [];
  ginLogs: { timestamp: string; message: string }[] = [];
  returnLogs: { timestamp: string; message: string }[] = [];
  
  // Unsubscribe functions
  private unsubscribeSnapshot?: () => void;
  private unsubscribeMovements?: {
    unsubscribeAll: () => void;
    unsubscribeGinStockLog: () => void;
    unsubscribePurchaseReturnLog: () => void;
    unsubscribeSalesReturnLog: () => void;
  };
  private unsubscribeProductStock?: () => void;
  private unsubscribePurchaseLog?: () => void;
  private unsubscribeSalesLog?: () => void;

  constructor(private dailyStockService: DailyStockService) {}

  ngOnInit() {
    // Optionally start monitoring on component init
    // this.startSnapshotMonitoring();
  }

  ngOnDestroy() {
    this.stopAllMonitoring();
  }

  startSnapshotMonitoring() {
    if (this.unsubscribeSnapshot) {
      this.unsubscribeSnapshot();
    }
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7); // Monitor last 7 days
    const endDate = new Date();
    
    this.unsubscribeSnapshot = this.dailyStockService.subscribeToDailySnapshots(
      startDate,
      endDate,
      (snapshots) => {
        this.dailySnapshots = snapshots;
        console.log('Daily snapshots updated:', snapshots.length);
      }
    );
  }

  stopSnapshotMonitoring() {
    if (this.unsubscribeSnapshot) {
      this.unsubscribeSnapshot();
      this.unsubscribeSnapshot = undefined;
    }
  }

  startAllMovementMonitoring() {
    // Stop existing listeners
    this.stopAllMovementMonitoring();
    
    // Start new collection listeners
    this.unsubscribeMovements = this.dailyStockService.subscribeToAllStockMovements({
      onGinStockLog: (changes) => {
        changes.forEach(change => {
          if (change.type === 'added') {
            const data = change.data;
            this.addLog(this.ginLogs, `GIN Transfer: ${data.productName} from ${data.fromLocation} to ${data.toLocationId}, qty: ${data.transferAmount}`);
          }
        });
      },
      onPurchaseReturnLog: (changes) => {
        changes.forEach(change => {
          if (change.type === 'added') {
            const data = change.data;
            this.addLog(this.returnLogs, `Purchase Return: ${data.productName} at ${data.businessLocation}, qty: ${data.returnQuantity}`);
          }
        });
      },
      onSalesReturnLog: (changes) => {
        changes.forEach(change => {
          if (change.type === 'added') {
            const data = change.data;
            const items = data.items || [];
            items.forEach((item: any) => {
              this.addLog(this.returnLogs, `Sales Return: ${item.productName}, qty: ${item.returnQuantity}`);
            });
          }
        });
      }
    });
    
    // Start main collection listeners
    this.unsubscribeProductStock = this.dailyStockService.subscribeToProductStock((changes) => {
      changes.forEach(change => {
        const data = change.data;
        const docId = change.doc.id;
        this.addLog(this.productStockLogs, `Stock ${change.type}: ${docId}, quantity: ${data.quantity}`);
      });
    });
    
    this.unsubscribePurchaseLog = this.dailyStockService.subscribeToPurchaseStockPriceLog((changes) => {
      changes.forEach(change => {
        if (change.type === 'added') {
          const data = change.data;
          this.addLog(this.purchaseLogs, `Purchase: ${data.productName} at ${data.locationName}, qty: ${data.receivedQuantity}`);
        }
      });
    });
    
    this.unsubscribeSalesLog = this.dailyStockService.subscribeToSalesStockPriceLog((changes) => {
      changes.forEach(change => {
        if (change.type === 'added') {
          const data = change.data;
          this.addLog(this.salesLogs, `Sale: ${data.productName} at ${data.location}, qty: ${data.quantity}`);
        }
      });
    });
  }

  stopAllMovementMonitoring() {
    if (this.unsubscribeMovements) {
      this.unsubscribeMovements.unsubscribeAll();
      this.unsubscribeMovements = undefined;
    }
    
    if (this.unsubscribeProductStock) {
      this.unsubscribeProductStock();
      this.unsubscribeProductStock = undefined;
    }
    
    if (this.unsubscribePurchaseLog) {
      this.unsubscribePurchaseLog();
      this.unsubscribePurchaseLog = undefined;
    }
    
    if (this.unsubscribeSalesLog) {
      this.unsubscribeSalesLog();
      this.unsubscribeSalesLog = undefined;
    }
  }

  stopAllMonitoring() {
    this.stopSnapshotMonitoring();
    this.stopAllMovementMonitoring();
  }

  private addLog(logArray: { timestamp: string; message: string }[], message: string) {
    const timestamp = new Date().toLocaleTimeString();
    logArray.unshift({ timestamp, message });
    
    // Keep only last 50 entries
    if (logArray.length > 50) {
      logArray.splice(50);
    }
  }

  // Utility methods for manual testing
  async testGetOpeningStock() {
    const result = await this.dailyStockService.getOpeningStock('5GVUKL7XzEyRyTggdeAA', '6j0v6tR66jGMPLG2xRPW', new Date());
    console.log('Opening stock:', result);
  }

  async testGetClosingStock() {
    const result = await this.dailyStockService.getClosingStock('5GVUKL7XzEyRyTggdeAA', '6j0v6tR66jGMPLG2xRPW', new Date());
    console.log('Closing stock:', result);
  }

  async testCreateSnapshot() {
    await this.dailyStockService.createDailySnapshot(new Date());
    console.log('Snapshot created');
  }

  async testProcessEndOfDay() {
    await this.dailyStockService.processEndOfDay(new Date());
    console.log('End of day processed');
  }
}