import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, doc, deleteDoc, updateDoc, onSnapshot, query, where, getDocs, DocumentData, DocumentReference, getDoc, orderBy } from '@angular/fire/firestore';
import { Observable, BehaviorSubject } from 'rxjs';
import { GinStockLog } from '../interfaces/gin-stock-log.interface';
export interface LocationTransfer {
  locationId: string;
  locationName?: string;
  products: TransferProduct[];
}

export interface TransferProduct {
  productId: string;
  productName: string;
  sku: string;
  barcode?: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  unit: string;
  currentStock?: number;
}

export interface GinTransfer {
  id?: string;
  date: string;
  referenceNo: string;
  locationFrom: string;
  locationFromName?: string;
  status: string;
  transfers: LocationTransfer[];
  shippingCharges: number;
  additionalNotes: string;
  totalAmount: number;
  createdAt: Date;
  updatedAt: Date;
  
  locationTo?: string;
  locationTo2?: string | null;
  items?: GinTransferItem[];
}

export interface GinTransferItem {
  productId: string;
  productName: string;
  sku: string;
  barcode?: string;
  quantity: number;
  secondaryQuantity?: number;
  unitPrice: number;
  subtotal: number;
  unit: string;
  locationFrom: string;
  currentStock?: number;
}

@Injectable({
  providedIn: 'root'
})
export class GinTransferService {
  private _ginTransfers = new BehaviorSubject<GinTransfer[]>([]);
  readonly ginTransfers$ = this._ginTransfers.asObservable();
  private unsubscribe: (() => void) | null = null;
  getUpdateEmitter: any;

  constructor(private firestore: Firestore) {
    this.subscribeToGinTransfers();
  }

  private subscribeToGinTransfers(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
    }

    const ginTransfersRef = collection(this.firestore, 'ginTransfers');
    const q = query(ginTransfersRef, orderBy('createdAt', 'desc'));

    this.unsubscribe = onSnapshot(q, (querySnapshot) => {
      const ginTransfers: GinTransfer[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data() as GinTransfer;
        ginTransfers.push({ 
          id: doc.id, 
          ...data 
        });
      });
      this._ginTransfers.next(ginTransfers);
    }, (error) => {
      console.error('Error fetching gin transfers:', error);
    });
  }

  async addGinTransfer(ginTransfer: GinTransfer): Promise<string> {
    try {
      const timestamp = new Date();
      ginTransfer.createdAt = timestamp;
      ginTransfer.updatedAt = timestamp;
      
      const ginTransfersRef = collection(this.firestore, 'ginTransfers');
      const docRef = await addDoc(ginTransfersRef, ginTransfer);
      const transferId = docRef.id;
      
      await this.createStockLogEntries(ginTransfer, transferId);
      
      console.log('GIN Transfer and stock logs saved successfully');
      return transferId;
    } catch (error) {
      console.error('Error adding GIN transfer:', error);
      throw error;
    }
  }

  private async createStockLogEntries(ginTransfer: GinTransfer, transferId: string): Promise<void> {
    try {
      const stockLogPromises: Promise<any>[] = [];
      
      if (ginTransfer.transfers && ginTransfer.transfers.length > 0) {
        for (const transfer of ginTransfer.transfers) {
          for (const product of transfer.products) {
            const logEntry: GinStockLog = {
              fromLocation: ginTransfer.locationFrom,
              toLocationId: transfer.locationId,
              transferAmount: product.quantity,
              createdDate: ginTransfer.createdAt,
              transferId: transferId,
              productId: product.productId,
              productName: product.productName,
              sku: product.sku,
              referenceNo: ginTransfer.referenceNo
            };

            const ginStockLogRef = collection(this.firestore, 'gin-stock-log');
            stockLogPromises.push(addDoc(ginStockLogRef, logEntry));
          }
        }
      }
      
      if (ginTransfer.items && ginTransfer.items.length > 0) {
        for (const item of ginTransfer.items) {
          const primaryLogEntry: GinStockLog = {
            fromLocation: ginTransfer.locationFrom,
            toLocationId: ginTransfer.locationTo!,
            transferAmount: item.quantity,
            createdDate: ginTransfer.createdAt,
            transferId: transferId,
            productId: item.productId,
            productName: item.productName,
            sku: item.sku,
            referenceNo: ginTransfer.referenceNo
          };

          const ginStockLogRef = collection(this.firestore, 'gin-stock-log');
          stockLogPromises.push(addDoc(ginStockLogRef, primaryLogEntry));

          if (ginTransfer.locationTo2 && item.secondaryQuantity && item.secondaryQuantity > 0) {
            const secondaryLogEntry: GinStockLog = {
              fromLocation: ginTransfer.locationFrom,
              toLocationId: ginTransfer.locationTo2,
              transferAmount: item.secondaryQuantity,
              createdDate: ginTransfer.createdAt,
              transferId: transferId,
              productId: item.productId,
              productName: item.productName,
              sku: item.sku,
              referenceNo: ginTransfer.referenceNo
            };

            stockLogPromises.push(addDoc(ginStockLogRef, secondaryLogEntry));
          }
        }
      }

      await Promise.all(stockLogPromises);
      console.log(`Created ${stockLogPromises.length} stock log entries for transfer ${transferId}`);
    } catch (error) {
      console.error('Error creating stock log entries:', error);
      throw error;
    }
  }

  getGinTransfers(): Observable<GinTransfer[]> {
    return this.ginTransfers$;
  }

  getStockLogs(): Observable<GinStockLog[]> {
    return new Observable<GinStockLog[]>(observer => {
      const stockLogsRef = collection(this.firestore, 'gin-stock-log');
      const q = query(stockLogsRef, orderBy('createdDate', 'desc'));

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const stockLogs: GinStockLog[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data() as GinStockLog;
          stockLogs.push({ 
            id: doc.id, 
            ...data 
          });
        });
        observer.next(stockLogs);
      }, error => {
        observer.error(error);
      });

      return () => unsubscribe();
    });
  }

  async getStockLogsByTransferId(transferId: string): Promise<GinStockLog[]> {
    try {
      const stockLogsRef = collection(this.firestore, 'gin-stock-log');
      const q = query(stockLogsRef, where('transferId', '==', transferId));
      const querySnapshot = await getDocs(q);
      
      const stockLogs: GinStockLog[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data() as GinStockLog;
        stockLogs.push({ 
          id: doc.id, 
          ...data 
        });
      });
      
      return stockLogs;
    } catch (error) {
      console.error('Error getting stock logs by transfer ID:', error);
      throw error;
    }
  }

  async getStockLogsByProductId(productId: string): Promise<GinStockLog[]> {
    try {
      const stockLogsRef = collection(this.firestore, 'gin-stock-log');
      const q = query(stockLogsRef, where('productId', '==', productId), orderBy('createdDate', 'desc'));
      const querySnapshot = await getDocs(q);
      
      const stockLogs: GinStockLog[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data() as GinStockLog;
        stockLogs.push({ 
          id: doc.id, 
          ...data 
        });
      });
      
      return stockLogs;
    } catch (error) {
      console.error('Error getting stock logs by product ID:', error);
      throw error;
    }
  }

  async getGinTransfer(id: string): Promise<GinTransfer | undefined> {
    try {
      const docRef = doc(this.firestore, 'ginTransfers', id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() as GinTransfer };
      } else {
        return undefined;
      }
    } catch (error) {
      console.error('Error getting GIN transfer:', error);
      throw error;
    }
  }

  async updateGinTransfer(id: string, ginTransfer: Partial<GinTransfer>): Promise<void> {
    try {
      const updateData = { ...ginTransfer, updatedAt: new Date() };
      const docRef = doc(this.firestore, 'ginTransfers', id);
      await updateDoc(docRef, updateData);

      if (ginTransfer.status === 'Completed') {
        const existingTransfer = await this.getGinTransfer(id);
        if (existingTransfer) {
          await this.deleteStockLogsByTransferId(id);
          await this.createStockLogEntries(existingTransfer, id);
        }
      }
    } catch (error) {
      console.error('Error updating GIN transfer:', error);
      throw error;
    }
  }

  async deleteGinTransfer(id: string): Promise<void> {
    try {
      const docRef = doc(this.firestore, 'ginTransfers', id);
      await deleteDoc(docRef);

      await this.deleteStockLogsByTransferId(id);
      
      console.log(`Deleted GIN transfer ${id} and its associated stock logs`);
    } catch (error) {
      console.error('Error deleting GIN transfer:', error);
      throw error;
    }
  }

  private async deleteStockLogsByTransferId(transferId: string): Promise<void> {
    try {
      const stockLogsRef = collection(this.firestore, 'gin-stock-log');
      const q = query(stockLogsRef, where('transferId', '==', transferId));
      const querySnapshot = await getDocs(q);
      
      const deletePromises: Promise<void>[] = [];
      querySnapshot.forEach((docSnapshot) => {
        const docRef = doc(this.firestore, 'gin-stock-log', docSnapshot.id);
        deletePromises.push(deleteDoc(docRef));
      });
      
      await Promise.all(deletePromises);
      console.log(`Deleted ${deletePromises.length} stock log entries for transfer ${transferId}`);
    } catch (error) {
      console.error('Error deleting stock logs:', error);
      throw error;
    }
  }

  async getGinTransfersByProductId(productId: string): Promise<GinTransfer[]> {
    try {
      const allTransfers = await this.getAllGinTransfers();
      return allTransfers.filter(transfer => {
        if (transfer.transfers) {
          return transfer.transfers.some(t => 
            t.products.some(p => p.productId === productId)
          );
        }
        return transfer.items?.some(item => item.productId === productId);
      });
    } catch (error) {
      console.error('Error getting transfers by product ID:', error);
      return [];
    }
  }

  async getGinTransfersByProductName(productName: string): Promise<GinTransfer[]> {
    try {
      const allTransfers = await this.getAllGinTransfers();
      return allTransfers.filter(transfer => {
        if (transfer.transfers) {
          return transfer.transfers.some(t => 
            t.products.some(p => p.productName === productName)
          );
        }
        return transfer.items?.some(item => item.productName === productName);
      });
    } catch (error) {
      console.error('Error getting transfers by product name:', error);
      return [];
    }
  }

  private async getAllGinTransfers(): Promise<GinTransfer[]> {
    try {
      const querySnapshot = await getDocs(collection(this.firestore, 'ginTransfers'));
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as GinTransfer }));
    } catch (error) {
      console.error('Error getting all GIN transfers:', error);
      return [];
    }
  }

  ngOnDestroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }
}