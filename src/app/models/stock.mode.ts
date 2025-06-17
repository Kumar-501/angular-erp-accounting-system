// src/app/models/stock.model.ts
export interface Stock {
  id: string;
  date: string;
  referenceNo: string;
  locationFrom: string;
  locationTo: string;
  status: 'Pending' | 'In Transit' | 'Completed' | 'Cancelled' | string; // Allow both specific values and string
  locationTransfers: LocationTransfer[];
  shippingCharges: number;
  totalAmount: number;
  additionalNotes: string;
  products?: any[];
  createdAt?: Date;
  updatedAt?: Date;
  userId?: string;
  productIds?: string[];
}

export interface LocationTransfer {
  locationFrom: string;
  locationTo: string;
  shippingCharges: number;
  subtotal: number;
  totalAmount: number;
  products: ProductTransfer[];
}

export interface ProductTransfer {
  product: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}