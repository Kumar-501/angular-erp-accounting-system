export interface Lead {
    id?: string;
    contactType: 'lead' | 'individual' | 'business';
    contactId?: string;
    businessName?: string;
    prefix?: string;
    firstName?: string;
    middleName?: string;
        occupation?: string;

    lastName?: string;
    mobile: string;
    alternateContact?: string;
    landline?: string;
    email?: string;
    dateOfBirth?: string | Date;
    source?: string;
    lifeStage?: string;
    assignedTo?: string;
    taxNumber?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    country?: string;
    zipCode?: string;
    customField1?: string;
    customField2?: string;
    customField3?: string;
    customField4?: string;
    createdAt?: Date;
  }