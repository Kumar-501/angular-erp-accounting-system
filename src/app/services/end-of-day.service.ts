// end-of-day.service.ts
import { Injectable } from '@angular/core';
import { StockService } from './stock.service';
import { NotificationService } from './notification.service'; // Add this import

@Injectable({
  providedIn: 'root'
})
export class EndOfDayService {
  constructor(
    private stockService: StockService,
    private notificationService: NotificationService // Now properly typed
  ) {}

  async processEndOfDay(): Promise<void> {
    const today = new Date();
    
    try {
      // 1. Record today's closing stock
      await this.stockService.recordDailyClosingStock(today);
      
      // 2. Initialize tomorrow's opening stock
      await this.stockService.initializeNextDayOpeningStock(today);
      
      // 3. Notify success
      this.notificationService.showSuccess('End of day processing completed successfully');
    } catch (error) {
      console.error('End of day processing failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to complete end of day processing';
      this.notificationService.showError(errorMessage);
      throw error;
    }
  }
}