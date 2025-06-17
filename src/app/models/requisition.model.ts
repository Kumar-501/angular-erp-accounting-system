// requisition.model.ts
export interface Requisition {
    id: string;
    date: string;
    referenceNo: string;
    location: string;
    status: string;
    requiredByDate: string;
    addedBy: string;
  }