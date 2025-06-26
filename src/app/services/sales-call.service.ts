import { Injectable } from '@angular/core';
import { Firestore, collection, query, where, onSnapshot, doc, updateDoc, writeBatch, deleteDoc } from '@angular/fire/firestore';
import { CustomerService } from './customer.service';
import { CallLogService } from './call-log.service';
import { SaleService } from './sale.service';
import { BehaviorSubject, Observable, combineLatest, map, shareReplay, tap } from 'rxjs';
interface BulkOperationResult {
  success: number;
  failures: {id: string, error: any}[];
}
@Injectable({
  providedIn: 'root'
})

export class SalesCallService {
  private salesCallsCache$: Observable<any[]> | null = null;
  private refreshTrigger$ = new BehaviorSubject<number>(0);
  private BATCH_LIMIT = 500; // Firestore batch limit

  constructor(
    private firestore: Firestore,
    private customerService: CustomerService,
    private callLogService: CallLogService,
    private saleService: SaleService
  ) {}
 async bulkUpdateCalls(updates: {id: string, data: any}[]): Promise<BulkOperationResult> {
    if (!updates || updates.length === 0) {
      console.warn('No updates provided for bulk update');
      return { success: 0, failures: [] };
    }

    const failures: Array<{id: string, error: any}> = [];
    let successCount = 0;
    
    // Split updates into chunks of BATCH_LIMIT
    const chunks = this.chunkArray(updates, this.BATCH_LIMIT);
    
    try {
      // Process each chunk sequentially
      for (const chunk of chunks) {
        try {
          const batch = writeBatch(this.firestore);
          
          chunk.forEach(update => {
            const customerDoc = doc(this.firestore, `customers/${update.id}`);
            batch.update(customerDoc, update.data);
          });
          
          await batch.commit();
          successCount += chunk.length;
        } catch (error) {
          console.error('Batch chunk failed:', error);
          // Fall back to individual updates
          const individualResults = await Promise.allSettled(
            chunk.map(update => 
              this.updateSalesCall(update.id, update.data)
          ));
          
          individualResults.forEach((result, index) => {
            if (result.status === 'fulfilled') {
              successCount++;
            } else {
              failures.push({
                id: chunk[index].id,
                error: result.reason
              });
            }
          });
        }
      }



      
      
      console.log(`Bulk update completed: ${successCount} succeeded, ${failures.length} failed`);
      this.refreshSalesCalls();
      
      return { success: successCount, failures };
    } catch (error) {
      console.error('Bulk update failed:', error);
      throw error;
    }
  }

  getSalesCalls(): Observable<any[]> {
    if (!this.salesCallsCache$) {
      this.salesCallsCache$ = combineLatest([
        this.customerService.getAllCustomers(),
        this.callLogService.getAllCallLogs(),
        this.saleService.listenForSales(),
        this.refreshTrigger$
      ]).pipe(
        map(([customers, allCallLogs, allSales, trigger]) => {
          const fourteenDaysAgo = new Date();
          fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

          return customers.map(customer => {
            // Get call logs for this customer
            const customerCallLogs = allCallLogs.filter(log => log.customerId === customer.id);
            const latestLog = customerCallLogs.length > 0
              ? [...customerCallLogs].sort((a, b) =>
                  new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
              : null;

            // Get sales for this customer and filter ONLY those older than 14 days
            const customerSales = allSales
              .filter(sale => sale.customerId === customer.id)
              .filter(sale => {
                const saleDate = new Date(sale.saleDate);
                return saleDate < fourteenDaysAgo;
              });

            const lastOldSale = customerSales.length > 0
              ? [...customerSales].sort((a, b) =>
                  new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime())[0]
              : null;

            return {
              id: customer.id,
              customerId: customer.id,
              customerName: customer.firstName + ' ' + customer.lastName,
              businessName: customer.businessName,
              mobile: customer.mobile,
              lastTransactionDate: lastOldSale?.saleDate || null,
              assignedTo: customer.assignedTo,
              callStatus: latestLog ? this.mapCallOutcomeToStatus(latestLog.callOutcome) : 'Pending',
              callDate: latestLog?.createdAt || null,
              notes: latestLog?.description || '',
              lastCallInfo: latestLog,
              department: customer.department || 'Not assigned'
            };
          });
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
        tap(() => console.log('Sales calls data refreshed'))
      );
    }
    
    return this.salesCallsCache$;
  }

  /**
   * Get fresh sales calls without cache
   */
  getFreshSalesCalls(): Observable<any[]> {
    return combineLatest([
      this.customerService.getAllCustomers(),
      this.callLogService.getAllCallLogs(),
      this.saleService.listenForSales()
    ]).pipe(
      map(([customers, allCallLogs, allSales]) => {
        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

        return customers.map(customer => {
          // Get call logs for this customer
          const customerCallLogs = allCallLogs.filter(log => log.customerId === customer.id);
          const latestLog = customerCallLogs.length > 0
            ? [...customerCallLogs].sort((a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
            : null;

          // Get sales for this customer and filter ONLY those older than 14 days
          const customerSales = allSales
            .filter(sale => sale.customerId === customer.id)
            .filter(sale => {
              const saleDate = new Date(sale.saleDate);
              return saleDate < fourteenDaysAgo;
            });

          const lastOldSale = customerSales.length > 0
            ? [...customerSales].sort((a, b) =>
                new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime())[0]
            : null;

          return {
            id: customer.id,
            customerId: customer.id,
            customerName: customer.firstName + ' ' + customer.lastName,
            businessName: customer.businessName,
            mobile: customer.mobile,
            lastTransactionDate: lastOldSale?.saleDate || null,
            assignedTo: customer.assignedTo,
            callStatus: latestLog ? this.mapCallOutcomeToStatus(latestLog.callOutcome) : 'Pending',
            callDate: latestLog?.createdAt || null,
            notes: latestLog?.description || '',
            lastCallInfo: latestLog,
            department: customer.department || 'Not assigned'
          };
        });
      })
    );
  }

  /**
   * Force refresh data
   */
  refreshSalesCalls(): void {
    this.salesCallsCache$ = null;
    this.refreshTrigger$.next(Date.now());
  }

  /**
   * Map call outcome to status
   */
  private mapCallOutcomeToStatus(callOutcome: string): string {
    switch(callOutcome) {
      case 'Successful': return 'Completed';
      case 'No Answer': return 'Pending';
      case 'Left Message': return 'Follow-up';
      case 'Wrong Number': return 'Not Interested';
      default: return callOutcome || 'Pending';
    }
  }

  /**
   * Update a single sales call with retry logic
   */
  async updateSalesCall(customerId: string, data: any, retries = 3): Promise<void> {
    try {
      const customerDoc = doc(this.firestore, `customers/${customerId}`);
      await updateDoc(customerDoc, data);
      console.log(`Updated customer ${customerId} successfully`);
      this.refreshSalesCalls();
    } catch (error) {
      console.error(`Error updating customer ${customerId}:`, error);
      if (retries > 0) {
        console.log(`Retrying update for ${customerId} (${retries} attempts remaining)`);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
        return this.updateSalesCall(customerId, data, retries - 1);
      }
      throw error;
    }
  }

  /**
   * Bulk update multiple sales calls with chunking and retry logic (RECOMMENDED)
   */


  /**
   * Process a single batch chunk with retry logic
   */
  private async processBatchChunk(chunk: {id: string, data: any}[], retries = 3): Promise<void> {
    try {
      const batch = writeBatch(this.firestore);
      
      chunk.forEach(update => {
        const customerDoc = doc(this.firestore, `customers/${update.id}`);
        batch.update(customerDoc, update.data);
      });
      
      await batch.commit();
      console.log(`Successfully processed batch of ${chunk.length} updates`);
    } catch (error) {
      console.error('Batch chunk failed:', error);
      if (retries > 0) {
        console.log(`Retrying batch chunk (${retries} attempts remaining)`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
        return this.processBatchChunk(chunk, retries - 1);
      }
      throw error;
    }
  }

  /**
   * Bulk update using individual promises with progress tracking (ALTERNATIVE)
   */
  async bulkUpdateCallsIndividual(updates: {id: string, data: any}[]): Promise<{success: number, failures: {id: string, error: any}[]}> {
    if (!updates || updates.length === 0) {
      console.warn('No updates provided for individual bulk update');
      return { success: 0, failures: [] };
    }

    const failures: Array<{id: string, error: any}> = [];
    let successCount = 0;
    
    // Process in chunks to avoid overwhelming the system
    const chunkSize = 50; // Process 50 at a time
    const chunks = this.chunkArray(updates, chunkSize);
    
    try {
      for (const chunk of chunks) {
        const results = await Promise.allSettled(
          chunk.map(update => 
            this.updateSalesCall(update.id, update.data)
              .then(() => ({ id: update.id, status: 'fulfilled' }))
          )
        );

        results.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            successCount++;
          } else {
            failures.push({
              id: chunk[index].id,
              error: result.reason
            });
          }
        });
      }

      console.log(`Bulk update completed: ${successCount} succeeded, ${failures.length} failed`);
      this.refreshSalesCalls();
      
      return { success: successCount, failures };
    } catch (error) {
      console.error('Individual bulk update failed:', error);
      throw error;
    }
  }

  /**
   * Bulk update with legacy support for salesCalls collection
   * Use this if you have both customers and salesCalls collections
   */
  async bulkUpdateCallsWithLegacySupport(updates: {id: string, data: any}[]): Promise<void> {
    if (!updates || updates.length === 0) {
      console.warn('No updates provided for legacy bulk update');
      return;
    }

    // Split updates into chunks to respect batch limits
    const chunks = this.chunkArray(updates, this.BATCH_LIMIT);
    
    try {
      for (const chunk of chunks) {
        const batch = writeBatch(this.firestore);
        
        chunk.forEach(update => {
          // Update customers collection (primary)
          const customerDoc = doc(this.firestore, `customers/${update.id}`);
          batch.update(customerDoc, update.data);
          
          // Update salesCalls document if it exists (for backward compatibility)
          const salesCallDoc = doc(this.firestore, `salesCalls/${update.id}`);
          batch.update(salesCallDoc, update.data);
        });
        
        await batch.commit();
      }
      
      console.log(`Successfully bulk updated ${updates.length} customers with legacy support`);
      this.refreshSalesCalls();
    } catch (error) {
      console.warn('Bulk salesCalls update failed, falling back to customer updates only:', error);
      
      // Fallback: update customers only
      try {
        await this.bulkUpdateCustomersDirectly(updates);
      } catch (fallbackError) {
        console.error('Fallback update also failed:', fallbackError);
        throw fallbackError;
      }
    }
  }

  /**
   * Bulk delete sales calls with progress tracking
   */
  async bulkDeleteCalls(customerIds: string[]): Promise<{success: number, failures: {id: string, error: any}[]}> {
    if (!customerIds || customerIds.length === 0) {
      console.warn('No customer IDs provided for bulk delete');
      return { success: 0, failures: [] };
    }

    const failures: Array<{id: string, error: any}> = [];
    let successCount = 0;
    
    // Process in chunks to stay within batch limits
    const chunks = this.chunkArray(customerIds, this.BATCH_LIMIT);
    
    try {
      for (const chunk of chunks) {
        const batch = writeBatch(this.firestore);
        
        chunk.forEach(id => {
          const customerDoc = doc(this.firestore, `customers/${id}`);
          batch.delete(customerDoc);
        });
        
        try {
          await batch.commit();
          successCount += chunk.length;
        } catch (error) {
          console.error('Batch delete failed:', error);
          // Fall back to individual deletes
          const individualResults = await Promise.allSettled(
            chunk.map(id => 
              this.deleteCustomer(id)
                .then(() => ({ id, status: 'fulfilled' }))
            )
          );
          
          individualResults.forEach((result, index) => {
            if (result.status === 'fulfilled') {
              successCount++;
            } else {
              failures.push({
                id: chunk[index],
                error: result.reason
              });
            }
          });
        }
      }
      
      console.log(`Bulk delete completed: ${successCount} succeeded, ${failures.length} failed`);
      this.refreshSalesCalls();
      
      return { success: successCount, failures };
    } catch (error) {
      console.error('Bulk delete failed:', error);
      throw error;
    }
  }

  /**
   * Delete a single customer document with retry logic
   */
  private async deleteCustomer(customerId: string, retries = 3): Promise<void> {
    try {
      const customerDoc = doc(this.firestore, `customers/${customerId}`);
      await updateDoc(customerDoc, { deleted: true }); // Soft delete
      // Or for hard delete:
      // await deleteDoc(customerDoc);
      console.log(`Deleted customer ${customerId} successfully`);
    } catch (error) {
      console.error(`Error deleting customer ${customerId}:`, error);
      if (retries > 0) {
        console.log(`Retrying delete for ${customerId} (${retries} attempts remaining)`);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
        return this.deleteCustomer(customerId, retries - 1);
      }
      throw error;
    }
  }

  /**
   * Direct customer update method
   */
  async updateCustomerDirectly(customerId: string, data: any): Promise<void> {
    try {
      const customerDoc = doc(this.firestore, `customers/${customerId}`);
      await updateDoc(customerDoc, data);
      console.log(`Direct customer update successful for ${customerId}`);
      this.refreshSalesCalls();
    } catch (error) {
      console.error(`Direct customer update failed for ${customerId}:`, error);
      throw error;
    }
  }

  /**
   * Direct bulk customer update method
   */
  async bulkUpdateCustomersDirectly(updates: {id: string, data: any}[]): Promise<void> {
    if (!updates || updates.length === 0) {
      console.warn('No updates provided for direct bulk customer update');
      return;
    }

    // Split updates into chunks to respect batch limits
    const chunks = this.chunkArray(updates, this.BATCH_LIMIT);
    
    try {
      for (const chunk of chunks) {
        const batch = writeBatch(this.firestore);
        
        chunk.forEach(update => {
          const customerDoc = doc(this.firestore, `customers/${update.id}`);
          batch.update(customerDoc, update.data);
        });
        
        await batch.commit();
      }
      
      console.log(`Direct bulk customer update successful for ${updates.length} customers`);
      this.refreshSalesCalls();
    } catch (error) {
      console.error('Direct bulk customer update failed:', error);
      throw error;
    }
  }

  /**
   * Utility method to chunk arrays for controlled processing
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Clear cache when component is destroyed
   */
  clearCache(): void {
    this.salesCallsCache$ = null;
  }

  /**
   * Get statistics about sales calls
   */
  getSalesCallsStats(): Observable<{
    total: number;
    pending: number;
    completed: number;
    followUp: number;
    notInterested: number;
  }> {
    return this.getSalesCalls().pipe(
      map(salesCalls => {
        const stats = {
          total: salesCalls.length,
          pending: 0,
          completed: 0,
          followUp: 0,
          notInterested: 0
        };

        salesCalls.forEach(call => {
          switch (call.callStatus) {
            case 'Pending':
              stats.pending++;
              break;
            case 'Completed':
              stats.completed++;
              break;
            case 'Follow-up':
              stats.followUp++;
              break;
            case 'Not Interested':
              stats.notInterested++;
              break;
          }
        });

        return stats;
      })
    );
  }

  /**
   * Filter sales calls by status
   */
  getSalesCallsByStatus(status: string): Observable<any[]> {
    return this.getSalesCalls().pipe(
      map(salesCalls => salesCalls.filter(call => call.callStatus === status))
    );
  }

  /**
   * Filter sales calls by assigned user
   */
  getSalesCallsByAssignedUser(userId: string): Observable<any[]> {
    return this.getSalesCalls().pipe(
      map(salesCalls => salesCalls.filter(call => call.assignedTo === userId))
    );
  }

  /**
   * Filter sales calls by department
   */
  getSalesCallsByDepartment(department: string): Observable<any[]> {
    return this.getSalesCalls().pipe(
      map(salesCalls => salesCalls.filter(call => call.department === department))
    );
  }
}