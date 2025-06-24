// src/app/models/stock-price-log.model.ts
import { Timestamp, FieldValue } from '@angular/fire/firestore';

export interface StockPriceLog {
  id: string;
  productId: string;
  productName?: string;
  locationId: string;
  locationName?: string;
  grnCreatedDate: Date | string;
  receivedStockFromGrn: number;
  unitPurchasePrice: number;
  totalCost: number;
  taxRate: number;
  taxAmount: number;
  shippingCharge?: number;
  lineTotal?: number;
  purchaseRefNo: string;
  invoiceNo?: string;
  supplierName: string;
  batchNumber?: string;
  expiryDate?: Date | string;
  paymentType: string;
  paymentAccountId?: string;
  paymentAccountName?: string;
  notes?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  createdBy?: string;
  updatedBy?: string;
  
}

export interface StockPriceLogFilter {
  startDate?: Date;
  endDate?: Date;
  productId?: string;
  locationId?: string;
  paymentType?: string;
  supplierName?: string;
  purchaseRefNo?: string;
}

export interface StockPriceLogSummary {
  totalRecords: number;
  totalStockReceived: number;
  totalPurchaseValue: number;
  totalTaxAmount: number;
  averageUnitPrice: number;
}