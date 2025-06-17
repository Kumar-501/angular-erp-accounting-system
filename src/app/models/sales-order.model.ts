export interface SalesOrder {
  id: string;
  customerId: string;
  saleDate: Date | any;
  invoiceNo?: string;
  typeOfService?: string;
  typeOfServiceName?: string;
  products?: Array<{
    id?: string;
    name?: string;
    quantity?: number;
    unitPrice?: number;
    subtotal?: number;
  }>;
  status?: string;
  shippingStatus?: string;
  paymentStatus?: string; // Add this
  paymentAmount?: number;
  shippingDetails?: string;
  total?: number;
  
  subtotal?: number;
  tax?: number;
  shippingCharges?: number;
  shippingCost?: number;
  balance?: number;
    transactionId?: string; // ← Add this if missing

  totalPayable?: number;
  discountAmount?: number; // Add this if needed
  customerName?: string; // Add this
  createdAt?: Date; // Add this
  updatedAt?: Date; // Add this
   customerAge?: number | null;
  customerDob?: string | null;
  customerGender?: string;
}