export interface GinStockLog {
  id?: string;
  fromLocation: string;
  toLocationId: string;
  transferAmount: number;
  createdDate: Date;
  transferId: string; // Reference to the original transfer
  productId: string;
  productName: string;
  sku: string;
  referenceNo: string; // Reference number from the transfer
}
export interface GinStockLog {
  id?: string;
  fromLocation: string;
  toLocationId: string;
  transferAmount: number;
  createdDate: Date;
  transferId: string;
  productId: string;
  productName: string;
  sku: string;
  referenceNo: string;
}