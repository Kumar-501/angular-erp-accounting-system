// purchase.model.ts
import { Timestamp } from '@angular/fire/firestore';

export interface Purchase {
[x: string]: any;
  id?: string;
  supplierId: string;
  supplierName: string;
  purchaseNumber?: string;
 subtotal?: number;       // Add this
 
  address?: string;
  referenceNo?: string;  // Made optional
  
  // Updated to handle Firestore Timestamps
  purchaseDate: Date | string | any; // Allow for Timestamp from Firestore
  purchaseStatus?: string;  // Made optional
  businessLocation?: string;  // Made optional
  payTerm?: string;

  document?: string | null;
  discountType?: string;
  discountAmount?: number;
  purchaseTax?: number;
  additionalNotes?: string;
  shippingCharges?: number;
  purchaseTotal: number;
  paymentAmount?: number;  // Made optional
  // Updated to handle Firestore Timestamps
  paidOn: string | Date | Timestamp;
  paymentMethod: string;
  paymentStatus?: string;
  paymentNote?: string;
  paymentDue?: number;  // Made optional
  grandTotal?: number;
  addedBy?: string;
  createdAt?: Date | Timestamp;
  updatedAt?: Date | Timestamp;
  purchaseOrder?: string;
  invoiceNo?: string;
  // Updated to handle Firestore Timestamps
  invoicedDate?: string | Date | Timestamp;
  receivedDate?: string | Date | Timestamp;
  totalTax?: number;
  products?: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitCost: number;
    discountPercent: number;
    unitCostBeforeTax: number;
    subtotal: number;
    taxAmount: number;
    lineTotal: number;
    profitMargin: number;
    sellingPrice: number;
    batchNumber: string;
    expiryDate: string;
    taxRate: number;
    roundOffAmount: number;
    roundedTotal: number;
  }>;
    paymentAccount?: {
    id: string;
    name: string;
    accountNumber?: string;
  };
}