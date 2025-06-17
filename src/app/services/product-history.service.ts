import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class ProductHistoryService {
  private apiUrl = 'api/product-history'; // Replace with your actual API endpoint

  constructor(private http: HttpClient) { }
  
  // Get consolidated history for multiple products
  getConsolidatedHistory(productIds: string[]): Observable<any[]> {
    if (!productIds || productIds.length === 0) {
      return of([]);
    }
    
    // Create an array of observables for each product history request
    const historyRequests = productIds.map(id => this.getProductHistory(id));
    
    // Execute all requests in parallel and combine results
    return forkJoin(historyRequests).pipe(
      map(results => {
        // Flatten the array of arrays into a single array
        return ([] as any[]).concat(...results);
      }),
      catchError(error => {
        console.error('Error fetching consolidated history:', error);
        return of([]);
      })
    );
  }
  
  // Get history for a single product
  getProductHistory(productId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/${productId}`).pipe(
      catchError(error => {
        console.error(`Error fetching history for product ${productId}:`, error);
        return of([]);
      })
    );
  }
  
  // Export history to CSV
  exportToCsv(productIds?: string[]): Observable<Blob> {
    const url = productIds && productIds.length > 0 ? 
      `${this.apiUrl}/export/csv?ids=${productIds.join(',')}` : 
      `${this.apiUrl}/export/csv`;
      
    return this.http.get(url, { responseType: 'blob' });
  }
  
  // Export history to Excel
  exportToExcel(productIds?: string[]): Observable<Blob> {
    const url = productIds && productIds.length > 0 ? 
      `${this.apiUrl}/export/excel?ids=${productIds.join(',')}` : 
      `${this.apiUrl}/export/excel`;
      
    return this.http.get(url, { responseType: 'blob' });
  }
  
  // Export history to PDF
  exportToPdf(productIds?: string[]): Observable<Blob> {
    const url = productIds && productIds.length > 0 ? 
      `${this.apiUrl}/export/pdf?ids=${productIds.join(',')}` : 
      `${this.apiUrl}/export/pdf`;
      
    return this.http.get(url, { responseType: 'blob' });
  }
}