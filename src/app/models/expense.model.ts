// src/app/models/expense.model.ts
export interface Expense {
    id?: string;
    businessLocation: string;
    expenseCategory: string;
    subCategory: string;
    referenceNo: string;
    date: string;
    
    expenseFor: string;
    expenseForContact: string;
    document?: string;
    applicableTax: string;
    taxAmount: number; // Add this line
    totalAmount: number;
    expenseNote: string;
    expenseType?: string;
    isRefund: boolean;
    isRefundable: boolean; // Add this if needed
    isRecurring: boolean;
    recurringInterval: string;
    repetitions?: number;
    paymentAmount: number;
    paidOn: string;
    paymentMethod: string;
    paymentAccount?: string;
    paymentNote?: string;
    type?: 'expense' | 'income'; // Add this for type discrimination
}

export const emptyExpense: Expense = {
    businessLocation: '',
    expenseCategory: '',
    subCategory: '',
    referenceNo: '',
    date: new Date().toISOString(),
    expenseFor: '',
    expenseForContact: '',
    applicableTax: 'None',
    taxAmount: 0, // Add this
    totalAmount: 0,
    expenseNote: '',
    isRefund: false,
    isRecurring: false,
    recurringInterval: 'Days',
    paymentAmount: 0,
    paidOn: new Date().toISOString(),
    paymentMethod: 'Cash',
    isRefundable: false
};