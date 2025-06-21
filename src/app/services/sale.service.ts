import { Injectable } from '@angular/core';
import { 
  Firestore, 
  collection, 
  doc, 
  getDoc, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  DocumentSnapshot,
  DocumentData,
  getDocs,
  or,
  writeBatch,
  increment,
  Timestamp,
  runTransaction,
  orderBy,
  limit
} from '@angular/fire/firestore';

import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { ProductsService } from './products.service';
import { Papa } from 'ngx-papaparse';
import { BehaviorSubject, Subject } from 'rxjs';


// Type Interfaces
interface DepartmentExecutive {
  id: string;
  displayName: string;
  email: string;
  department: string;
}

interface Return {
  id?: string;
  originalSaleId: string;
  invoiceNo: string;
  customer: string;
  returnedItems: Array<{
    productId: string;
    name: string;
    quantity: number;
    originalQuantity: number;
    unitPrice: number;
    reason?: string;
    subtotal: number;
  }>;
  totalRefund: number;
  returnDate: Date;
  status: string;
  returnReason?: string;
  createdAt?: Date;
  processedBy?: string;
}

interface Sale {
  id?: string;
  saleDate: Date;
  invoiceNo: string;
  customer: string;
  status: string;
  products?: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    discountPercent?: number;
    subtotal: number;
    taxAmount: number;
    lineTotal: number;
  }>;
  [key: string]: any;
}

interface Product {
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  taxType: string;
  productId: string | undefined;
  id?: string;
  name: string;
  productName?: string;
  sku?: string;
  barcode?: string;
  currentStock?: number;
  defaultSellingPriceExcTax?: number;
  defaultSellingPriceIncTax?: number;
  batchNumber?: string;
  expiryDate?: string;
  taxRate?: number;
  taxAmount?: number;
  quantity: number;
  unitPrice: number;
  discount: number;
  commissionPercent?: number;
  commissionAmount?: number;
  subtotal: number;
  priceBeforeTax: number;
  taxIncluded: boolean;
  discountType: 'Amount' | 'Percentage';
}

interface Prescription {
  id?: string;
  patientName: string;
  date: string;
  medicines: any[];
  doctorName: string;
  createdAt?: Date;
}

interface SalesOrder {
  productTaxAmount: number;
  shippingTaxAmount: number;
  roundOff: number;
  paymentAccount: string;
  paymentAccountName?: string;
  transactionId: string;
    paidOn?: Date;  // Changed from required to optional

  paymentStatus: string;
  totalAmount: any;
    customerName?: string;
  alternateContact?: string;
  businessLocationId?: string;
  orderNo?: string;
  paymentAccountId?: string;
  addedBy?: string;
  prescriptions?: Prescription[];
  ppServiceData?: any;
  codData?: any;
  contactNumber?: string;
  shippingDetails?: string;
  activities?: {
    userId: string;
    userName: string;
    fromStatus: string;
    paymentAccount: string;
    toStatus: string;
    timestamp: Date;
    notes?: string;
  }[];
  typeOfService: string | undefined;
  typeOfServiceName: string;
  total: any;
  subtotal: number;
  tax: number;
  shippingCost: number;
  id: string;
  customer: string;
  customerId: string;
  saleDate: Date;  // Changed from string to Date
  invoiceNo: string;
  invoiceScheme?: string;
  status: string;
  shippingStatus: string;
  paymentAmount: number;
  shippingCharges: number;
  discountAmount: number;
  balance: number;
  businessLocation?: string;
  products?: Product[];
  billingAddress?: string;
  shippingAddress?: string;
  orderTax?: number;
  discountType?: string;
  sellNote?: string;
  deliveryPerson?: string;
  paymentMethod?: string;
  paymentNote?: string;
  changeReturn?: number;
  itemsTotal?: number;
  
  document?: string;
  shippingDocuments?: string;
  createdAt: Date;  // Changed from string to Date
  updatedAt: Date;  // Changed from string to Date
  totalPayable?: number;
  customerAge?: number;
  customerGender?: string;
  customerOccupation?: string;
  productInterested?: string;
  customerDob?: string | null;
  creditLimit?: number;
  otherData?: string;
  customerEmail?: string;
  customerPhone?: string;
}

interface FilterOptions {
  businessLocation?: string;
  customer?: string;
    locations?: string[]; // Add locations array filter

  status?: string;
  shippingStatus?: string;
  dateRange?: {
    startDate?: string;
    endDate?: string;
  };
}

interface Medicine {
  name: string;
  type: string;
  dosage?: string;
  instructions?: string;
  ingredients?: string;
  pills?: string;
  powder?: string;
  time: string;
  frequency?: string;
  [key: string]: any;
  quantity?: string;
}

@Injectable({
  providedIn: 'root'
})
export class SaleService {
  [x: string]: any;
  
  private stockUpdatedSource = new Subject<void>();
  private salesUpdated = new Subject<void>();

  public stockUpdated$ = this.stockUpdatedSource.asObservable();
  salesUpdated$ = this.salesUpdated.asObservable();

  processAndSendData(validData: any[]) {
    throw new Error('Method not implemented.');
  }
  
  sendNotification(saleId: string) {
    throw new Error('Method not implemented.');
  }

  constructor(
    private firestore: Firestore,
    private productsService: ProductsService,
    private papa: Papa
  ) {}
notifySalesUpdated() {
  this.salesUpdated.next();
}
getShippedSales(): Observable<any[]> {
  return this['afs'].collection('sales', (ref: { where: (arg0: string, arg1: string, arg2: string) => { (): any; new(): any; orderBy: { (arg0: string, arg1: string): any; new(): any; }; }; }) => 
    ref.where('shippingStatus', '==', 'Shipped')
       .orderBy('shippingDate', 'desc')
  ).valueChanges({ idField: 'id' });
}
  // Enhanced getSalesByPaymentAccount method with proper timestamp handling
  getSalesByPaymentAccount(accountId: string): Observable<any[]> {
    return new Observable(observer => {
      const salesRef = collection(this.firestore, 'sales');
      const q = query(
        salesRef,
        where('paymentAccount', '==', accountId),
        orderBy('saleDate', 'desc')
      );
      const salesUpdated$ = this.salesUpdated.asObservable();

      const unsubscribe = onSnapshot(q, 
        (querySnapshot) => {
          const sales = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              // Properly convert Firestore Timestamp to Date
              saleDate: this.convertTimestampToDate(data['saleDate']),
              paidOn: this.convertTimestampToDate(data['paidOn']),
              createdAt: this.convertTimestampToDate(data['createdAt']),
              updatedAt: this.convertTimestampToDate(data['updatedAt']),
              // Ensure we have the account name for display
              paymentAccountName: data['paymentAccountName'] || 'Unknown Account'
            };
          });
          observer.next(sales);
        },
        (error) => {
          console.error('Error fetching sales by payment account:', error);
          observer.error(error);
        }
      );

      return () => unsubscribe();
    });
  }

  // Helper method to properly convert Firestore Timestamp to Date
  private convertTimestampToDate(timestamp: any): Date {
    if (!timestamp) return new Date();
    
    // If it's already a Date object
    if (timestamp instanceof Date) return timestamp;
    
    // If it's a Firestore Timestamp
    if (timestamp && typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }
    
    // If it's a string or number, try to parse
    if (typeof timestamp === 'string' || typeof timestamp === 'number') {
      const date = new Date(timestamp);
      return isNaN(date.getTime()) ? new Date() : date;
    }
    
    // Fallback to current date
    return new Date();
  }

  // Enhanced method to get sales with account information
  getSalesWithAccountInfo(): Observable<any[]> {
    return new Observable(observer => {
      const salesRef = collection(this.firestore, 'sales');
      const q = query(salesRef, orderBy('saleDate', 'desc'));

      const unsubscribe = onSnapshot(q, 
        (querySnapshot) => {
          const sales = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              saleDate: this.convertTimestampToDate(data['saleDate']),
              paidOn: this.convertTimestampToDate(data['paidOn']),
              createdAt: this.convertTimestampToDate(data['createdAt']),
              updatedAt: this.convertTimestampToDate(data['updatedAt'])
            };
          });
          observer.next(sales);
        },
        (error) => {
          console.error('Error fetching sales with account info:', error);
          observer.error(error);
        }
      );

      return () => unsubscribe();
    });
  }

  getSalesByDateRangeObservable(startDate: Date, endDate: Date): Observable<Sale[]> {
    return new Observable(observer => {
      const salesCollection = collection(this.firestore, 'sales');
      const q = query(
        salesCollection,
        where('saleDate', '>=', startDate),
        where('saleDate', '<=', endDate),
        where('status', '==', 'Completed'),
        orderBy('saleDate', 'desc')
      );
      
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const sales = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            saleDate: this.convertTimestampToDate(data['saleDate']),
            products: data['products'] || []
          } as Sale;
        });
        observer.next(sales);
      }, (error) => {
        observer.error(error);
      });

      return () => unsubscribe();
    });
  }

  async getReturnsByDateRange(startDate: Date, endDate: Date): Promise<Return[]> {
    try {
      const returnsCollection = collection(this.firestore, 'returns');
      
      const q = query(
        returnsCollection,
        where('returnDate', '>=', startDate),
        where('returnDate', '<=', endDate),
        orderBy('returnDate', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          returnDate: this.convertTimestampToDate(data['returnDate'])
        } as Return;
      });
    } catch (error) {
      console.error('Error fetching returns by date range:', error);
      return [];
    }
  }

  getReturns(): Observable<Return[]> {
    return new Observable<Return[]>(observer => {
      const returnsRef = collection(this.firestore, 'returns');
      const q = query(returnsRef, orderBy('returnDate', 'desc'));
      
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const returns = querySnapshot.docs.map(doc => {
          const data = doc.data() as Return;
          return { 
            id: doc.id,
            ...data,
            returnDate: this.convertTimestampToDate(data.returnDate)
          };
        });
        observer.next(returns);
      }, (error) => {
        observer.error(error);
      });

      return () => unsubscribe();
    });
  }

  generateDocument(saleId: string, type: 'invoice' | 'delivery-note'): Observable<Blob> {
    return new Observable<Blob>(observer => {
      const mockPdfContent = `PDF content for ${type} of sale ${saleId}`;
      const blob = new Blob([mockPdfContent], { type: 'application/pdf' });
      observer.next(blob);
      observer.complete();
    });
  }
  
  importShippingData(file: File): Observable<{ success: number; errors: number }> {
    return new Observable(observer => {
      this.papa.parse(file, {
        header: true,
        complete: (results) => {
          const data = results.data;
          let successCount = 0;
          let errorCount = 0;
  
          const promises = data.map((row: any, index: number) => {
            return new Promise<void>(async (resolve) => {
              try {
                if (!row['Date'] || !row['Invoice No.'] || !row['Customer']) {
                  console.error(`Row ${index + 1} missing required fields`);
                  errorCount++;
                  return resolve();
                }
  
                const shippingCharge = parseFloat(row['Shipping Charge']) || 0;
                
                const shipmentData: SalesOrder = {
                  saleDate: row['Date'],
                  invoiceNo: row['Invoice No.'],
                  customer: row['Customer'],
                  contactNumber: row['Contact Number'] || '',
                  billingAddress: row['Location'] || '',
                  deliveryPerson: row['Delivery Person'] || '',
                  shippingStatus: row['Shipping Status'] || 'Pending',
                  shippingCharges: shippingCharge,
                  paymentStatus: row['Payment Status'] || 'Unpaid',
                  status: 'Completed',
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  balance: shippingCharge,
                  paymentAmount: 0,
                  totalAmount: undefined,
                  typeOfService: undefined,
                  typeOfServiceName: '',
                  total: undefined,
                  subtotal: 0,
                  tax: 0,
                  shippingCost: 0,
                  id: '',
                  customerId: '',
                  discountAmount: 0,
                  transactionId: '',
                  paymentAccount: '',
                  productTaxAmount: 0,
                  shippingTaxAmount: 0,
                  roundOff: 0
                };
  
                if (shipmentData.paymentStatus === 'Paid') {
                  shipmentData.balance = 0;
                  shipmentData.paymentAmount = shippingCharge;
                } else if (shipmentData.paymentStatus === 'Partial') {
                  shipmentData.paymentAmount = shippingCharge * 0.5;
                  shipmentData.balance = shippingCharge - shipmentData.paymentAmount;
                }
  
                await addDoc(collection(this.firestore, 'sales'), shipmentData);
                successCount++;
                console.log(`Row ${index + 1} imported successfully`);
              } catch (error) {
                errorCount++;
                console.error(`Error importing row ${index + 1}:`, error);
              }
              resolve();
            });
          });
  
          Promise.all(promises)
            .then(() => {
              console.log(`Import completed: ${successCount} success, ${errorCount} errors`);
              observer.next({ success: successCount, errors: errorCount });
              observer.complete();
            })
            .catch(error => {
              console.error('Import failed:', error);
              observer.error(error);
            });
        },
        error: (error) => {
          console.error('CSV parsing error:', error);
          observer.error(error);
        }
      });
    });
  }

  getUserList(): Observable<any[]> {
    return new Observable(observer => {
      const usersRef = collection(this.firestore, 'users');
      const q = query(usersRef, where('role', 'in', ['executive', 'sales']));
      
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const users = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        observer.next(users);
      }, (error) => {
        observer.error(error);
      });

      return () => unsubscribe();
    });
  }

  getPrescriptionsBySaleId(saleId: string): Observable<Prescription[]> {
    return new Observable<Prescription[]>(observer => {
      const prescriptionsCollection = collection(this.firestore, 'prescriptions');
      const q = query(
        prescriptionsCollection,
        where('saleId', '==', saleId),
        orderBy('createdAt', 'desc')
      );

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const prescriptions = querySnapshot.docs.map(doc => {
          const data = doc.data() as Prescription;
          return { id: doc.id, ...data };
        });
        observer.next(prescriptions);
      });

      return () => unsubscribe();
    });
  }
  
  async savePrescription(prescriptionData: Prescription): Promise<string> {
    try {
      const prescriptionsCollection = collection(this.firestore, 'prescriptions');
      const docRef = await addDoc(prescriptionsCollection, {
        ...prescriptionData,
        createdAt: new Date()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error saving prescription:', error);
      throw error;
    }
  }

  async updateSaleWithActivity(
    saleId: string,
    updateData: any,
    currentStatus: string,
    newStatus: string,
    userId: string,
    userName: string,
    note?: string
  ): Promise<any> {
    try {
      const saleDoc = doc(this.firestore, 'sales', saleId);
      const currentSaleSnapshot = await getDoc(saleDoc);

      if (!currentSaleSnapshot.exists()) {
        throw new Error(`Sale with ID ${saleId} not found`);
      }

      const currentSaleData = currentSaleSnapshot.data() as SalesOrder;
      
      if (currentStatus !== newStatus) {
        const newActivity = {
          userId: userId,
          userName: userName,
          fromStatus: currentStatus || 'None',
          toStatus: newStatus,
          timestamp: new Date(),
          note: note
        };

        updateData.activities = [...(currentSaleData.activities || []), newActivity];
      }

      updateData.updatedAt = new Date();

      await updateDoc(saleDoc, updateData);
      
      return updateData.activities || [];
    } catch (error) {
      console.error('Error updating sale with activity:', error);
      throw error;
    }
  }

  async updatePrescription(prescriptionId: string, prescriptionData: Partial<Prescription>): Promise<void> {
    try {
      const prescriptionDoc = doc(this.firestore, 'prescriptions', prescriptionId);
      await updateDoc(prescriptionDoc, {
        ...prescriptionData,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error updating prescription:', error);
      throw error;
    }
  }

  async deletePrescription(prescriptionId: string): Promise<void> {
    try {
      const prescriptionDoc = doc(this.firestore, 'prescriptions', prescriptionId);
      await deleteDoc(prescriptionDoc);
    } catch (error) {
      console.error('Error deleting prescription:', error);
      throw error;
    }
  }

  getPurchasesByProductId(productId: string): Observable<any[]> {
    return new Observable<any[]>(observer => {
      const salesCollection = collection(this.firestore, 'sales');
      const q = query(
        salesCollection,
        where('status', '==', 'Completed'),
        where('products', 'array-contains', {productId: productId}),
        orderBy('saleDate', 'desc')
      );

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const purchases = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            saleDate: this.convertTimestampToDate(data['saleDate']),
            paidOn: this.convertTimestampToDate(data['paidOn']),
            createdAt: this.convertTimestampToDate(data['createdAt']),
            updatedAt: this.convertTimestampToDate(data['updatedAt'])
          };
        });
        observer.next(purchases);
      }, (error) => {
        observer.error(error);
      });

      return () => unsubscribe();
    });
  }

  getLatestInvoiceNumber(): Observable<number> {
    return new Observable<number>(observer => {
      const salesCollection = collection(this.firestore, 'sales');
      const q = query(
        salesCollection, 
        orderBy('createdAt', 'desc'),
        limit(1)
      );

      getDocs(q).then(querySnapshot => {
        if (!querySnapshot.empty) {
          const latestSale = querySnapshot.docs[0].data() as any;
          const latestInvoice = latestSale.invoiceNo;
          
          if (latestInvoice && latestInvoice.startsWith('INAB')) {
            const numStr = latestInvoice.replace('INAB', '');
            const number = parseInt(numStr, 10);
            
            const randomIncrement = Math.floor(Math.random() * 9) + 1;
            observer.next(isNaN(number) ? randomIncrement : number + randomIncrement);
          } else {
            observer.next(Math.floor(1000 + Math.random() * 9000));
          }
        } else {
          observer.next(Math.floor(1000 + Math.random() * 9000));
        }
        observer.complete();
      }).catch(error => {
        console.error('Error fetching latest invoice:', error);
        observer.next(Math.floor(1000 + Math.random() * 9000));
        observer.complete();
      });
    });
  }

  getLatestOrderNumber(): Observable<number> {
    return new Observable<number>((observer) => {
      const salesCollection = collection(this.firestore, 'sales');
      const q = query(salesCollection, orderBy('orderNo', 'desc'), limit(1));

      getDocs(q).then(querySnapshot => {
        if (querySnapshot.empty) {
          observer.next(0);
          observer.complete();
          return;
        }

        const latestSale = querySnapshot.docs[0].data() as any;
        if (latestSale.orderNo) {
          const parts = latestSale.orderNo.split('-');
          if (parts.length === 3) {
            observer.next(parseInt(parts[2], 10));
            observer.complete();
            return;
          }
        }

        observer.next(0);
        observer.complete();
      }).catch(error => {
        console.error("Error getting latest order number:", error);
        observer.error(error);
      });
    });
  }
  
  listenForSales(filterOptions?: FilterOptions, allowedLocations: string[] = []): Observable<any[]> {
    return new Observable(subscriber => {
      const salesRef = collection(this.firestore, 'sales');
      
      // Base query with ordering
      let q = query(salesRef, orderBy('saleDate', 'desc'));
      
      // Apply location filter if locations are specified and user doesn't have access to all locations
      if (allowedLocations && allowedLocations.length > 0) {
        q = query(q, where('businessLocation', 'in', allowedLocations));
      } else if (allowedLocations.length === 0) {
        // User has access to all locations, no filter needed
      }
      const conditions = [];

      const unsubscribe = onSnapshot(q, 
        (querySnapshot) => {
          const sales = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              saleDate: this.convertTimestampToDate(data['saleDate']),
              paidOn: this.convertTimestampToDate(data['paidOn']),
              createdAt: this.convertTimestampToDate(data['createdAt']),
              updatedAt: this.convertTimestampToDate(data['updatedAt'])
            };
          });
          subscriber.next(sales);
        },
        (error) => {
          subscriber.error(error);
        }
      );

      return () => unsubscribe();
    });
  }


  async getDepartmentExecutives(department: string): Promise<any[]> {
    try {
      const usersRef = collection(this.firestore, 'users');
      const q = query(
        usersRef,
        where('department', '==', department),
        where('role', '==', 'executive')
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting department executives:', error);
      throw error;
    }
  }

  getSalesByCustomerId(customerId: string): Observable<SalesOrder[]> {
    return new Observable<SalesOrder[]>((observer) => {
      const salesCollection = collection(this.firestore, 'sales');
      const q = query(
        salesCollection,
        where('customerId', '==', customerId),
        orderBy('saleDate', 'desc')
      );

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const sales: SalesOrder[] = querySnapshot.docs.map(doc => {
          const data = doc.data() as Omit<SalesOrder, 'id'>;
          return { 
            id: doc.id, 
            ...data,
            saleDate: this.convertTimestampToDate(data.saleDate),
            paidOn: this.convertTimestampToDate(data.paidOn),
            createdAt: this.convertTimestampToDate(data.createdAt),
            updatedAt: this.convertTimestampToDate(data.updatedAt)
          };
        });
        observer.next(sales);
      });

      return () => unsubscribe();
    });
  }

  async exportSales(format: 'csv' | 'excel' | 'pdf', filterOptions?: FilterOptions): Promise<void> {
    const sales = await new Promise<SalesOrder[]>((resolve) => {
      const sub = this.listenForSales(filterOptions).subscribe(data => {
        resolve(data);
        sub.unsubscribe();
      });
    });

    switch (format) {
      case 'csv':
        this.exportToCSV(sales);
        break;
      case 'excel':
        this.exportToExcel(sales);
        break;
      case 'pdf':
        this.exportToPDF(sales);
        break;
      default:
        console.warn('Unsupported export format:', format);
    }
  }

  private exportToCSV(sales: SalesOrder[]): void {
    const headers = Object.keys(sales[0]).join(',');
    const rows = sales.map(sale => Object.values(sale).join(','));
    const csvContent = [headers, ...rows].join('\n');
    this.downloadFile(csvContent, 'sales_export.csv', 'text/csv');
  }

  private exportToExcel(sales: SalesOrder[]): void {
    const excelContent = sales.map(sale => JSON.stringify(sale)).join('\n');
    this.downloadFile(excelContent, 'sales_export.xlsx', 'application/vnd.ms-excel');
  }

  private exportToPDF(sales: SalesOrder[]): void {
    const pdfContent = sales.map(sale => JSON.stringify(sale)).join('\n\n');
    this.downloadFile(pdfContent, 'sales_export.pdf', 'application/pdf');
  }

  private downloadFile(content: string, fileName: string, fileType: string): void {
    const blob = new Blob([content], { type: fileType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async addSale(saleData: Omit<SalesOrder, 'id'>): Promise<string> {
    try {
      const salesCollection = collection(this.firestore, 'sales');
      const docRef = await addDoc(salesCollection, {
        ...saleData,
        createdAt: new Date()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error adding sale:', error);
      throw error;
    }
  }

  async updateSaleWithStockHandling(saleId: string, saleData: Partial<SalesOrder>): Promise<void> {
      try {
        if (!saleId) {
          throw new Error('Sale ID is required for update');
        }
  
        const saleDoc = doc(this.firestore, 'sales', saleId);
        const currentSaleSnapshot = await getDoc(saleDoc);
  
        if (!currentSaleSnapshot.exists()) {
          throw new Error(`Sale with ID ${saleId} not found`);
        }
  
        const currentSaleData = currentSaleSnapshot.data() as SalesOrder;
        const oldStatus = currentSaleData.status;
        const newStatus = saleData.status;
  
        if (oldStatus !== newStatus) {
          if (newStatus === 'Completed') {
            await this.reduceProductStockForSale({
              ...currentSaleData,
              ...saleData,
              id: saleId
            });
          } else if (oldStatus === 'Completed') {
            await this.restoreProductStockForSale({
              ...currentSaleData,
              id: saleId
            });
          }
        }
  
        await updateDoc(saleDoc, {
          ...saleData,
          updatedAt: new Date()
        });
  
      } catch (error) {
        console.error('Error updating sale:', error);
        throw error;
      }
    }

  private async reduceProductStockForSale(sale: SalesOrder): Promise<void> {
    try {
      if (!sale.id) {
        throw new Error('Sale ID is required for stock reduction');
      }
      
      if (!sale.products || sale.products.length === 0) {
        console.warn('No products in sale, skipping stock reduction');
        return;
      }

      const batch = writeBatch(this.firestore);

      for (const saleProduct of sale.products) {
        if (!saleProduct.quantity || saleProduct.quantity <= 0) {
          console.warn(`Invalid quantity for product: ${saleProduct.name || saleProduct.id}`);
          continue;
        }

        let product;
        try {
          if (saleProduct.id) {
            product = await this.productsService.getProductById(saleProduct.id);
          }
          if (!product && saleProduct.name) {
            product = await this.productsService.getProductByName(saleProduct.name);
          }
        } catch (error) {
          console.error(`Error fetching product ${saleProduct.id || saleProduct.name}:`, error);
          continue;
        }

        if (!product || !product.id) {
          console.error(`Product not found: ${saleProduct.id || saleProduct.name}`);
          continue;
        }

        const currentStock = product.currentStock || 0;
        if (currentStock < saleProduct.quantity) {
          throw new Error(
            `Insufficient stock for product ${product.productName}. 
            Available: ${currentStock}, Requested: ${saleProduct.quantity}`
          );
        }

        const newStock = currentStock - saleProduct.quantity;

        const productDoc = doc(this.firestore, `products/${product.id}`);
        batch.update(productDoc, {
          currentStock: newStock,
          updatedAt: new Date()
        });

        const stockHistoryRef = collection(this.firestore, 'stock_movements');
        batch.set(doc(stockHistoryRef), {
          productId: product.id,
          saleId: sale.id,
          action: 'sale',
          quantity: -saleProduct.quantity,
          locationId: sale.businessLocation || 'default',
          oldStock: currentStock,
          newStock: newStock,
          reference: sale.invoiceNo || `sale-${sale.id}`,
          timestamp: new Date(),
          notes: `Sold in sale ${sale.invoiceNo || sale.id}`
        });
      }

      await batch.commit();
      this.stockUpdatedSource.next();
    } catch (error) {
      console.error('Error in reduceProductStockForSale:', error);
      throw error;
    }
  }

  private async restoreProductStockForSale(sale: SalesOrder): Promise<void> {
    try {
      if (!sale.products || sale.products.length === 0) return;

      const batch = writeBatch(this.firestore);

      for (const saleProduct of sale.products) {
        let product;
        if (saleProduct.id) {
          product = await this.productsService.getProductById(saleProduct.id);
        }
        if (!product) {
          product = await this.productsService.getProductByName(saleProduct.name);
        }
        
        if (product && product.id) {
          const newStock = (product.currentStock || 0) + saleProduct.quantity;
          
          const productDoc = doc(this.firestore, `products/${product.id}`);
          batch.update(productDoc, {
            currentStock: newStock,
            updatedAt: new Date()
          });

          const stockHistoryRef = collection(this.firestore, 'stock_movements');
          batch.set(doc(stockHistoryRef), {
            productId: product.id,
            saleId: sale.id,
            action: 'return',
            quantity: saleProduct.quantity,
            locationId: sale.businessLocation || 'default',
            oldStock: product.currentStock || 0,
            newStock: newStock,
            reference: sale.invoiceNo || `sale-${sale.id}`,
            timestamp: new Date(),
            notes: `Stock returned from sale ${sale.invoiceNo || sale.id}`
          });
        }
      }

      await batch.commit();
      this.stockUpdatedSource.next();
    } catch (error) {
      console.error('Error restoring product stock:', error);
      throw error;
    }
  }

  async updateSaleStatus(saleId: string, newStatus: string): Promise<void> {
    const saleRef = doc(this.firestore, `sales/${saleId}`);
    await updateDoc(saleRef, {
      status: newStatus,
      updatedAt: new Date()
    });
  }

  async deleteSale(saleId: string): Promise<void> {
    try {
      const saleDocRef = doc(this.firestore, 'sales', saleId);
      const saleSnapshot = await getDoc(saleDocRef);

      if (saleSnapshot.exists()) {
        const saleData = { id: saleId, ...saleSnapshot.data() } as SalesOrder;

        if (saleData.status === 'Completed') {
          await this.restoreProductStockForSale(saleData);
        }

        await deleteDoc(saleDocRef);
      }
    } catch (error) {
      console.error('Error deleting sale:', error);
      throw error;
    }
  }

  getSaleById(saleId: string): Observable<SalesOrder> {
    return new Observable<SalesOrder>((observer) => {
      const saleDocRef = doc(this.firestore, 'sales', saleId);

      const unsubscribe = onSnapshot(saleDocRef, (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data() as Omit<SalesOrder, 'id'>;
          const sale = { 
            id: docSnapshot.id, 
            ...data,
            saleDate: this.convertTimestampToDate(data.saleDate),
            paidOn: this.convertTimestampToDate(data.paidOn),
            createdAt: this.convertTimestampToDate(data.createdAt),
            updatedAt: this.convertTimestampToDate(data.updatedAt)
          };
          observer.next(sale);
        } else {
          observer.error(new Error(`Sale with ID ${saleId} not found`));
        }
      }, (error) => {
        observer.error(error);
      });

      return () => unsubscribe();
    });
  }

  async getCompletedSalesByProducts(productIds: string[], startDate: Date, endDate: Date): Promise<{ [productId: string]: Array<{date: Date; quantity: number; invoiceNo: string}> }> {
    try {
      const salesRef = collection(this.firestore, 'sales');
      const q = query(
        salesRef,
        where('status', '==', 'Completed'),
        where('saleDate', '>=', startDate),
        where('saleDate', '<=', endDate)
      );
      
      const querySnapshot = await getDocs(q);
      const result: { [key: string]: Array<{date: Date; quantity: number; invoiceNo: string}> } = {};
      
      querySnapshot.forEach(doc => {
        const sale = doc.data() as Sale;
        sale.products?.forEach(product => {
          if (productIds.includes(product.productId)) {
            if (!result[product.productId]) {
              result[product.productId] = [];
            }
            result[product.productId].push({
              date: this.convertTimestampToDate(sale.saleDate),
              quantity: product.quantity,
              invoiceNo: sale.invoiceNo || 'N/A'
            });
          }
        });
      });
      
      return result;
    } catch (error) {
      console.error('Error getting completed sales by products:', error);
      return {};
    }
  }

  async getSalesByProductId(productId: string): Promise<Sale[]> {
    try {
      const salesRef = collection(this.firestore, 'sales');
      const q = query(
        salesRef,
        where('status', '==', 'Completed')
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => {
        const sale = doc.data() as Sale;
        const productData = sale.products?.find(p => p.productId === productId);
        
        return {
          ...sale,
          id: doc.id,
          saleDate: this.convertTimestampToDate(sale.saleDate),
          products: sale.products?.map(p => ({
            ...p,
            quantity: p.quantity || 0,
            unitPrice: p.unitPrice || 0,
            lineTotal: p.lineTotal || (p.quantity * p.unitPrice) || 0
          })) || []
        };
      });
    } catch (error) {
      console.error('Error getting sales by product:', error);
      throw error;
    }
  }

async processReturn(returnData: any): Promise<any> {
  try {
    console.log('Processing return with data:', returnData);

    if (!returnData.originalSaleId) {
      throw new Error('Missing original sale ID');
    }
    
    if (!returnData.invoiceNo) {
      throw new Error('Missing invoice number');
    }
    
    if (!returnData.customer) {
      throw new Error('Missing customer information');
    }

    if (!returnData.returnedItems || !Array.isArray(returnData.returnedItems) || returnData.returnedItems.length === 0) {
      throw new Error('No items selected for return');
    }

    const validatedItems = returnData.returnedItems.map((item: any, index: number) => {
      const productId = item.productId || item.id || item.itemId || item.product_id;
      const productName = item.name || item.productName || item.itemName || item.product_name;
      const unitPrice = parseFloat(item.unitPrice || item.price || item.unit_price || item.selling_price || 0);
      const quantity = parseInt(item.quantity || 0);
      const originalQuantity = parseInt(item.originalQuantity || 0);

      if (!productId) {
        throw new Error(`Item ${index + 1}: Missing product ID. Please ensure the product has a valid identifier.`);
      }
      
      if (!productName || productName.trim() === '') {
        throw new Error(`Item ${index + 1} (ID: ${productId}): Missing product name`);
      }
      
      if (isNaN(quantity) || quantity <= 0) {
        throw new Error(`Item ${index + 1} (${productName}): Invalid return quantity (${item.quantity}). Must be a positive number.`);
      }
      
      if (isNaN(originalQuantity) || originalQuantity <= 0) {
        throw new Error(`Item ${index + 1} (${productName}): Invalid original quantity (${item.originalQuantity})`);
      }
      
      if (quantity > originalQuantity) {
        throw new Error(`Item ${index + 1} (${productName}): Return quantity (${quantity}) cannot exceed original quantity (${originalQuantity})`);
      }
      
      if (isNaN(unitPrice) || unitPrice <= 0) {
        throw new Error(`Item ${index + 1} (${productName}): Invalid unit price (${item.unitPrice || item.price}). Must be a positive number.`);
      }

      return {
        id: productId,
        productId: productId,
        name: productName.trim(),
        productName: productName.trim(),
        quantity: quantity,
        originalQuantity: originalQuantity,
        unitPrice: unitPrice,
        price: unitPrice,
        subtotal: unitPrice * quantity,
        total: unitPrice * quantity,
        reason: item.reason || returnData.returnReason || 'Return processed',
        returnReason: item.returnReason || returnData.returnReason || 'Return processed',
        sku: item.sku || '',
        barcode: item.barcode || '',
        category: item.category || '',
        brand: item.brand || '',
        itemId: productId,
        product_id: productId,
        itemName: productName.trim(),
        product_name: productName.trim(),
        unit_price: unitPrice,
        selling_price: unitPrice
      };
    });

    const returnReason = (returnData.returnReason || returnData.reason || '').trim();
    if (!returnReason) {
      throw new Error('Return reason is required');
    }

    const calculatedRefund = validatedItems.reduce((sum: any, item: { subtotal: any; }) => sum + item.subtotal, 0);
    const providedRefund = parseFloat(returnData.totalRefund || returnData.refundAmount || 0);
    
    if (Math.abs(calculatedRefund - providedRefund) > 0.01) {
      console.warn(`Refund amount mismatch: calculated ${calculatedRefund}, provided ${providedRefund}. Using calculated amount.`);
    }

    // Determine return status based on the logic from returnData
    const isFullReturn = returnData.isFullReturn || false;
    const returnStatus = returnData.returnStatus || (isFullReturn ? 'Returned' : 'Partial Return');

    const processedReturnData = {
      originalSaleId: returnData.originalSaleId,
      invoiceNo: returnData.invoiceNo,
      customer: returnData.customer,
      returnedItems: validatedItems,
      totalRefund: calculatedRefund,
      refundAmount: calculatedRefund,
      returnDate: new Date(),
      returnReason: returnReason,
      reason: returnReason,
      status: 'Processed',
      returnStatus: returnStatus,
      isFullReturn: isFullReturn,
      processedBy: returnData.processedBy || 'system',
      createdAt: new Date()
    };

    console.log('Validated return data:', processedReturnData);

    // First, update the original sale status
    const saleUpdateData = {
      status: returnStatus,
      updatedAt: new Date(),
      returnReason: returnReason,
      returnDate: new Date(),
      returnId: '', // Will be updated after return doc is created
      isReturned: true,
      returnType: isFullReturn ? 'Full' : 'Partial'
    };

    console.log('Updating sale status to:', returnStatus);
    
    // Update the sale record first
    try {
      await this.updateSale(returnData.originalSaleId, saleUpdateData);
      console.log('Sale status updated successfully');
    } catch (saleUpdateError) {
      console.error('Error updating sale status:', saleUpdateError);
      throw new Error(`Failed to update sale status: ${saleUpdateError}`);
    }

    // Create return record
    const returnsCollection = collection(this.firestore, 'returns');
    const returnDocRef = await addDoc(returnsCollection, processedReturnData);
    
    // Update the sale record with the return ID
    const finalSaleUpdate = {
      returnId: returnDocRef.id
    };
    await this.updateSale(returnData.originalSaleId, finalSaleUpdate);
    
    const returnWithId = { ...processedReturnData, id: returnDocRef.id };
    
    // Restore product stock for returned items
    try {
      await this.restoreProductStockForReturn(returnWithId);
      console.log('Product stock restored successfully');
    } catch (stockError) {
      console.error('Error restoring product stock:', stockError);
      // Don't throw error here as the return is already processed
      console.warn('Return processed successfully but stock restoration failed');
    }

    console.log('Return processed successfully with ID:', returnDocRef.id);
      
    return {
      success: true,
      returnId: returnDocRef.id,
      totalRefund: calculatedRefund,
      returnStatus: returnStatus,
      isFullReturn: isFullReturn,
      message: `Return processed successfully - Sale marked as ${returnStatus}`
    };
  } catch (error) {
    console.error('Error processing return:', error);
    
    if (error instanceof Error) {
      throw new Error(`Return processing failed: ${error.message}`);
    } else {
      throw new Error('Return processing failed due to an unknown error');
    }
  }
}

// Helper method to update sale record
async updateSale(saleId: string, updateData: any): Promise<void> {
  try {
    const saleDocRef = doc(this.firestore, 'sales', saleId);
    await updateDoc(saleDocRef, updateData);
    console.log('Sale updated successfully:', saleId, updateData);
  } catch (error) {
    console.error('Error updating sale:', error);
    throw new Error(`Failed to update sale record: ${error}`);
  }
}

  getSalesByContactNumber(contactNumber: string): Observable<SalesOrder[]> {
    return new Observable<SalesOrder[]>(observer => {
      const salesRef = collection(this.firestore, 'sales');
      const q = query(
        salesRef,
        where('customerPhone', '==', contactNumber),
        orderBy('saleDate', 'desc')
      );

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const sales = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return { 
            id: doc.id,
            ...data,
            saleDate: this.convertTimestampToDate(data['saleDate']),
            paidOn: this.convertTimestampToDate(data['paidOn']),
            createdAt: this.convertTimestampToDate(data['createdAt']),
            updatedAt: this.convertTimestampToDate(data['updatedAt'])
          } as SalesOrder;
        });
        observer.next(sales);
      }, (error) => {
        observer.error(error);
      });

      return () => unsubscribe();
    });
  }
private async updateOriginalSaleAfterReturn(
  saleId: string, 
  returnedItems: any[],
  markAsReturned: boolean = false
): Promise<void> {
  try {
    const saleDoc = doc(this.firestore, 'sales', saleId);
    const saleSnapshot = await getDoc(saleDoc);
    
    if (!saleSnapshot.exists()) {
      throw new Error('Original sale not found');
    }
    
    const saleData = saleSnapshot.data() as SalesOrder;
    
    // Update product quantities
    const updatedProducts = saleData.products?.map(product => {
      const returnedItem = returnedItems.find(item => 
        (item.productId || item.id) === (product.id || product.productId)
      );
      
      if (returnedItem) {
        const newQuantity = product.quantity - returnedItem.quantity;
        return {
          ...product,
          quantity: Math.max(0, newQuantity),
          subtotal: Math.max(0, newQuantity) * product.unitPrice
        };
      }
      return product;
    }).filter(product => product.quantity > 0);
    
    // Calculate new totals
    const newSubtotal = updatedProducts?.reduce((sum, product) => sum + product.subtotal, 0) || 0;
    const newTotal = newSubtotal + (saleData.tax || 0) + (saleData.shippingCost || 0);
    
    const updateData: any = {
      products: updatedProducts,
      subtotal: newSubtotal,
      total: newTotal,
      updatedAt: new Date(),
      hasReturns: true,
      lastReturnDate: new Date()
    };
    
    // Mark as returned if all items were returned or explicitly requested
    if (markAsReturned || updatedProducts?.length === 0) {
      updateData.status = 'Returned';
    }
    
    await updateDoc(saleDoc, updateData);
    console.log('Original sale updated after return');
    
  } catch (error) {
    console.error('Error updating original sale after return:', error);
    throw error;
  }
}
  private async restoreProductStockForReturn(returnData: Return): Promise<void> {
    try {
      const batch = writeBatch(this.firestore);

      for (const item of returnData.returnedItems) {
        let product;
        if (item.productId) {
          product = await this.productsService.getProductById(item.productId);
        }
        if (!product && item.name) {
          product = await this.productsService.getProductByName(item.name);
        }

        if (product && product.id) {
          const newStock = (product.currentStock || 0) + item.quantity;
          
          const productDoc = doc(this.firestore, `products/${product.id}`);
          batch.update(productDoc, {
            currentStock: newStock,
            updatedAt: new Date()
          });

          const stockHistoryRef = collection(this.firestore, 'stock_movements');
          batch.set(doc(stockHistoryRef), {
            productId: product.id,
            returnId: returnData.id,
            action: 'return',
            quantity: item.quantity,
            locationId: 'default',
            oldStock: product.currentStock || 0,
            newStock: newStock,
            reference: returnData.invoiceNo || `return-${returnData.id}`,
            timestamp: new Date(),
            notes: `Stock returned from sale ${returnData.invoiceNo}`
          });
        }
      }

      await batch.commit();
      this.stockUpdatedSource.next();
      console.log('Product stock restored for return');
    } catch (error) {
      console.error('Error restoring product stock for return:', error);
      throw error;
    }
  }

  private salesRefresh = new BehaviorSubject<void>(undefined);
  refreshSalesList(): Promise<void> {
    this.salesRefresh.next();
    return Promise.resolve();
  }
}