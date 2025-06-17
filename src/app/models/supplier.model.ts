export interface Supplier {
  id?: string;
  contactId?: string;
  businessName?: string;
  firstName?: string;
  lastName?: string;
  isIndividual?: boolean;
  email?: string;
  mobile?: string;
  landline?: string;
  alternateContact?: string;
  assignedTo?: string;
  createdAt?: Date | string;
  status?: 'Active' | 'Inactive';
  district?: string;
  taxNumber?: string;
  openingBalance?: number;
  purchaseDue?: number;
  purchaseReturn?: number;
  advanceBalance?: number;
  addressLine1?: string;
  addressLine2?: string;
  shippingAddress?: {
    customerName?: string;
    address1?: string;
    address2?: string;
    country?: string;
    state?: string;
    district?: string;
    zipCode?: string;
  };
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
  prefix?: string;
  middleName?: string;
  dob?: Date;
  payTerm?: number;
  contactType?: string;
  address: string;
  documents?: SupplierDocument[];
  notes?: SupplierNote[];
}

export interface SupplierDocument {
  id?: string;
  name: string;
  url: string;
  uploadedAt: Date;
  uploadedBy: string;
  isPrivate: boolean;
}

export interface SupplierNote {
  id?: string;
  title: string;
  content: string;
  createdAt: Date;
  createdBy: string;
  isPrivate: boolean;
}