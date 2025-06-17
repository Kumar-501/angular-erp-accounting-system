export interface Customer {
    id?: string;
    contactId?: string;
    businessName?: string;
    firstName?: string;
    lastName?: string;
    isIndividual?: boolean;
    email?: string;
    mobile?: string;
    landline?: string;
    phone?: string;       // Add this if you're using it
    alternateContact?: string;

    alternatePhone?: any;
    assignedTo?: string;
    taxNumber?: string;
    openingBalance?: number;
    saleDue?: number;
    saleReturn?: number;
    advanceBalance?: number;
    status?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    country?: string;
    zipCode?: string;
    prefix?: string;
    middleName?: string;
    dob?: Date;
    payTerm?: number;
    contactType?: string;
    department?: string;
    address?: string;
    notes?: string;
    permanentAddress?: any;
    currentCity?: any;
    currentAddress?: any;
    adcode?: string;      // Add this line for the adcode property
  
    // Updated address fields to be objects instead of strings
    billingAddress?: Address;
    shippingAddress?: Address;
    
    createdAt?: Date;
    updatedAt?: Date;
    
    // New fields
    leadCategory?: string;
    lifeStage?: string;
    lastCallTime?: Date;
    currentState?: string;
    callCount?: number;
}

export interface Address {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
}