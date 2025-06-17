export interface Shift {
    id?: string; // Firestore document ID
    name: string;
    shiftType: 'Fixed' | 'Flexible';
    startTime: string;
    endTime: string;
    holidays: string[];
    createdAt?: Date;
    updatedAt?: Date;
  }