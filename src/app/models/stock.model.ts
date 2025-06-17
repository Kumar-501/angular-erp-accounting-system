export interface Stock {
  id?: string;
  referenceNo: string;
    date: Date | string; // Make date accept both Date and string

  locationFrom: string;
  locationTo: string;
  status: 'Pending' | 'In Transit' | 'Completed' | 'Cancelled';
  shippingCharges: number;
  totalAmount: number;
  additionalNotes?: string;
  purchaseId?: string;  // Link to purchase
  supplierId?: string;  // Link to supplier
  items?: StockItem[];  // Stock items
}

export interface StockItem {
  id?: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  batchNumber?: string;
  expiryDate?: string;
}