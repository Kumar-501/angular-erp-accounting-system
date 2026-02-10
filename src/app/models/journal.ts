export interface JournalEntry {
  id: number;
  date: string;
  reference: string;
  description: string;
  amount: number;
  status: 'Posted' | 'Pending';
  isCapitalTransaction?: boolean; 
  items?: { account: string; description: string; debit: number; credit: number }[];
}