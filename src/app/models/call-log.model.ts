import { Timestamp } from '@angular/fire/firestore';

export interface CallLog {
  id?: string;
  customerId: string;
  subject: string;
  description: string;
  createdAt: Timestamp | Date;
  createdBy: string;
  callType?: string;
  callDuration?: number;
  callOutcome?: string;
  followUpRequired?: boolean;
  followUpDate?: Timestamp | Date;
  tags?: string[];
}