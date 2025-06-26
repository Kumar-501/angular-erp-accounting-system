import { collection, getDocs, query, where, Firestore } from '@angular/fire/firestore';

export async function getCalculatedAccountBalance(firestore: Firestore, accountId: string): Promise<number> {
    try {
        // Fetch account opening balance directly from Firestore
        const accountsRef = collection(firestore, 'accounts');
        const accountQuery = query(accountsRef, where('__name__', '==', accountId));
        const accountSnapshot = await getDocs(accountQuery);

        let openingBalance = 0;
        if (!accountSnapshot.empty) {
            const accountData = accountSnapshot.docs[0].data();
            openingBalance = Number(accountData['openingBalance']) || 0;
        }

        // Fetch all transactions for this account
        const transactionsRef = collection(firestore, 'transactions');
        const transactionsQuery = query(transactionsRef, where('accountId', '==', accountId));
        const transactionsSnapshot = await getDocs(transactionsQuery);

        let transactionBalance = 0;

        // Process each transaction
        transactionsSnapshot.docs.forEach(doc => {
            const transaction = doc.data();
            const amount = Number(transaction['amount']) || 0;

            // Calculate balance change based on transaction type
            if (transaction['debit'] !== undefined && transaction['credit'] !== undefined) {
                const debit = Number(transaction['debit']) || 0;
                const credit = Number(transaction['credit']) || 0;
                transactionBalance += (credit - debit);
            } else {
                // Calculate based on transaction type
                switch (transaction['type']) {
                    case 'expense':
                    case 'transfer_out':
                    case 'purchase_payment':
                    case 'deposit_out':
                        transactionBalance -= amount; // Debit decreases balance
                        break;
                    case 'income':
                    case 'transfer_in':
                    case 'deposit':
                    case 'sale':
                    case 'purchase_return':
                        transactionBalance += amount; // Credit increases balance
                        break;
                    default:
                        // For unknown types, check if it's expense-related
                        if (transaction['type']?.includes('expense') || transaction['type']?.includes('payment')) {
                            transactionBalance -= amount;
                        } else {
                            transactionBalance += amount;
                        }
                }
            }
        });

        // Fetch sales data that might affect this account
        const salesRef = collection(firestore, 'sales');
        const salesQuery = query(salesRef, where('paymentAccountId', '==', accountId));
        const salesSnapshot = await getDocs(salesQuery);

        let salesBalance = 0;
        salesSnapshot.docs.forEach(doc => {
            const sale = doc.data();
            const paymentAmount = Number(sale['paymentAmount']) || 0;
            salesBalance += paymentAmount; // Sales increase account balance
        });

        // Also check for sales with paymentAccount field
        const salesQuery2 = query(salesRef, where('paymentAccount', '==', accountId));
        const salesSnapshot2 = await getDocs(salesQuery2);

        salesSnapshot2.docs.forEach(doc => {
            const sale = doc.data();
            const paymentAmount = Number(sale['paymentAmount']) || 0;
            salesBalance += paymentAmount;
        });

        return openingBalance + transactionBalance + salesBalance;

    } catch (error) {
        console.error('Error calculating account balance for', accountId, ':', error);
        return 0;
    }
}