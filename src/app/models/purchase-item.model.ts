export interface PurchaseItem {
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  discountPercent?: number;
  unitCostBeforeTax?: number;
  subtotal?: number;
  taxAmount?: number;
  lineTotal?: number;
  profitMargin?: number;
  sellingPrice?: number;
  batchNumber?: string;
  expiryDate?: string;
  taxRate?: number;
  roundOffAmount?: number;
  roundedTotal?: number;
}