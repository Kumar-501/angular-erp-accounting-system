// follow-up.model.ts
export interface FollowUp {
  id?: string;
  title: string;
  status: string;
  description: string;
  customerLead: string;
  startDatetime: string;
  endDatetime: string;
  followUpType: string;
  followupCategory: string;
  assignedTo: string;
  additionalInfo?: string;
  addedBy?: string;
  addedOn?: string;
  createdAt?: string;
  updatedAt?: string;  // Add this property
  sendNotification?: boolean;
}