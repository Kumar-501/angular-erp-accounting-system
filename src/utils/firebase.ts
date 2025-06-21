import { Injectable } from '@angular/core';
import {
    Firestore,
    collection,
    doc,
    addDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
    limit,
    startAfter,
    endBefore,
    onSnapshot,
    QueryConstraint,
    DocumentData,
    CollectionReference,
    DocumentReference,
    QuerySnapshot,
    DocumentSnapshot,
    serverTimestamp,
    arrayUnion,
    arrayRemove,
    increment,
    Timestamp,
    Transaction,
    WriteBatch,
    runTransaction,
    writeBatch
} from '@angular/fire/firestore';
import {
    Storage,
    ref,
    uploadBytes,
    uploadBytesResumable,
    getDownloadURL,
    deleteObject,
    listAll,
    StorageReference,
    UploadTask
} from '@angular/fire/storage';
import { Observable, BehaviorSubject, from, throwError } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';

// ==================== ENUMS ====================

export enum FirestoreOperator {
    EQUAL = '==',
    NOT_EQUAL = '!=',
    LESS_THAN = '<',
    LESS_THAN_OR_EQUAL = '<=',
    GREATER_THAN = '>',
    GREATER_THAN_OR_EQUAL = '>=',
    ARRAY_CONTAINS = 'array-contains',
    ARRAY_CONTAINS_ANY = 'array-contains-any',
    IN = 'in',
    NOT_IN = 'not-in'
}

export enum SortDirection {
    ASC = 'asc',
    DESC = 'desc'
}

export enum BatchOperationType {
    ADD = 'add',
    SET = 'set',
    UPDATE = 'update',
    DELETE = 'delete'
}

export enum TimestampFormat {
    DATE = 'date',
    TIME = 'time',
    ISO = 'iso',
    LOCALE = 'locale',
    FULL = 'full'
}

export enum FileSize {
    BYTES = 'Bytes',
    KB = 'KB',
    MB = 'MB',
    GB = 'GB',
    TB = 'TB',
    PB = 'PB',
    EB = 'EB',
    ZB = 'ZB',
    YB = 'YB'
}

export enum UploadState {
    RUNNING = 'running',
    PAUSED = 'paused',
    SUCCESS = 'success',
    CANCELED = 'canceled',
    ERROR = 'error'
}

export enum CollectionName {
    USERS = 'users',
    PRODUCTS = 'products',
    ORDERS = 'orders',
    CUSTOMERS = 'customers',
    CATEGORIES = 'categories',
    INVENTORY = 'inventory',
    SALES = 'sales',
    PURCHASES = 'purchases',
    EXPENSES = 'expenses',
    REPORTS = 'reports'
}

export enum DocumentStatus {
    ACTIVE = 'active',
    INACTIVE = 'inactive',
    DELETED = 'deleted',
    DRAFT = 'draft',
    PUBLISHED = 'published',
    ARCHIVED = 'archived'
}

export enum UserRole {
    ADMIN = 'admin',
    MANAGER = 'manager',
    EMPLOYEE = 'employee',
    CUSTOMER = 'customer',
    GUEST = 'guest'
}

export enum TransactionType {
    SALE = 'sale',
    PURCHASE = 'purchase',
    RETURN = 'return',
    ADJUSTMENT = 'adjustment',
    TRANSFER = 'transfer'
}

export enum TransactionOperationType {
    READ = 'read',
    CREATE = 'create',
    UPDATE = 'update',
    DELETE = 'delete'
}

export enum BatchWriteType {
    SET = 'set',
    UPDATE = 'update',
    DELETE = 'delete'
}

// ==================== INTERFACES ====================

export interface BaseDocument {
    id?: string;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
    status?: DocumentStatus;
    createdBy?: string;
    updatedBy?: string;
}

export interface PaginationOptions {
    pageSize: number;
    lastDoc?: DocumentSnapshot;
    firstDoc?: DocumentSnapshot;
}

export interface QueryOptions {
    field: string;
    operator: FirestoreOperator;
    value: any;
}

export interface PaginationResult<T> {
    documents: T[];
    hasMore: boolean;
    lastDoc?: DocumentSnapshot;
    firstDoc?: DocumentSnapshot;
    totalCount?: number;
}

export interface BatchOperation {
    type: BatchOperationType;
    collection: string;
    docId?: string;
    data?: any;
}

export interface CollectionStats {
    totalDocuments: number;
    createdToday: number;
    updatedToday: number;
    activeDocuments?: number;
    inactiveDocuments?: number;
}



export interface BulkUpdateOperation<T> {
    docId: string;
    data: Partial<T>;
}

export interface UploadProgress {
    progress: number;
    downloadURL?: string;
    state?: UploadState;
    bytesTransferred?: number;
    totalBytes?: number;
    error?: string;
}

export interface SearchOptions {
    field: string;
    searchTerm: string;
    caseSensitive?: boolean;
    exactMatch?: boolean;
    limit?: number;
}

export interface FirebaseError {
    code: string;
    message: string;
    originalError?: any;
}

export interface TransactionOperation {
    type: TransactionOperationType;
    collection: string;
    docId?: string;
    data?: any;
    merge?: boolean;
}

export interface BatchWriteOperation {
    type: BatchWriteType;
    collection: string;
    docId: string;
    data?: any;
    merge?: boolean;
}

export interface TransactionResult<T = any> {
    success: boolean;
    data?: T;
    error?: FirebaseError;
    operationsCount: number;
}

export interface BatchWriteResult {
    success: boolean;
    error?: FirebaseError;
    operationsCount: number;
}

export interface User extends BaseDocument {
    email: string;
    displayName?: string;
    photoURL?: string;
    role: UserRole;
    permissions?: string[];
    lastLoginAt?: Timestamp;
    isEmailVerified?: boolean;
}

export interface Product extends BaseDocument {
    name: string;
    description?: string;
    price: number;
    sku: string;
    category: string;
    stock: number;
    minStock?: number;
    maxStock?: number;
    images?: string[];
    tags?: string[];
    isActive: boolean;
}

export interface Order extends BaseDocument {
    orderNumber: string;
    customerId: string;
    items: OrderItem[];
    totalAmount: number;
    orderDate: Timestamp;
    deliveryDate?: Timestamp;
    orderStatus: OrderStatus;
    paymentStatus: PaymentStatus;
    notes?: string;
}

export interface OrderItem {
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    discount?: number;
}

export interface Customer extends BaseDocument {
    name: string;
    email?: string;
    phone?: string;
    address?: Address;
    customerGroup?: string;
    totalOrders?: number;
    totalSpent?: number;
    lastOrderDate?: Timestamp;
}

export interface Address {
    street: string;
    city: string;
    state?: string;
    zipCode: string;
    country: string;
}

export enum OrderStatus {
    PENDING = 'pending',
    CONFIRMED = 'confirmed',
    PROCESSING = 'processing',
    SHIPPED = 'shipped',
    DELIVERED = 'delivered',
    CANCELLED = 'cancelled',
    RETURNED = 'returned'
}

export enum PaymentStatus {
    PENDING = 'pending',
    PAID = 'paid',
    PARTIAL = 'partial',
    FAILED = 'failed',
    REFUNDED = 'refunded'
}

@Injectable({
    providedIn: 'root'
})
export class FirebaseService {

    constructor(
        private firestore: Firestore,
        private storage: Storage
    ) { }

    // ==================== FIRESTORE CRUD METHODS ====================

    /**
     * Add document to collection
     */
    async addDocument<T extends BaseDocument>(collectionName: string, data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
        try {
            const collectionRef = collection(this.firestore, collectionName);
            const docRef = await addDoc(collectionRef, {
                ...data,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            return docRef.id;
        } catch (error) {
            throw this.handleError(`Failed to add document to ${collectionName}`, error);
        }
    }

    /**
     * Set document with specific ID
     */
    async setDocument<T extends BaseDocument>(
        collectionName: string,
        docId: string,
        data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>,
        merge: boolean = false
    ): Promise<void> {
        try {
            const docRef = doc(this.firestore, collectionName, docId);
            await setDoc(docRef, {
                ...data,
                updatedAt: serverTimestamp()
            }, { merge });
        } catch (error) {
            throw this.handleError(`Failed to set document ${docId} in ${collectionName}`, error);
        }
    }
    /**
     * Update document
     */
    async updateDocument<T extends BaseDocument>(collectionName: string, docId: string, data: Partial<Omit<T, 'id' | 'createdAt'>>): Promise<void> {
        try {
            const docRef = doc(this.firestore, collectionName, docId);
            await updateDoc(docRef, {
                ...data,
                updatedAt: serverTimestamp()
            });
        } catch (error) {
            throw this.handleError(`Failed to update document ${docId} in ${collectionName}`, error);
        }
    }

    /**
     * Delete document
     */
    async deleteDocument(collectionName: string, docId: string): Promise<void> {
        try {
            const docRef = doc(this.firestore, collectionName, docId);
            await deleteDoc(docRef);
        } catch (error) {
            throw this.handleError(`Failed to delete document ${docId} from ${collectionName}`, error);
        }
    }
    /**
     * Get single document
     */
    async getDocument<T extends BaseDocument>(collectionName: string, docId: string): Promise<T | null> {
        try {
            const docRef = doc(this.firestore, collectionName, docId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                return { id: docSnap.id, ...docSnap.data() } as T;
            }
            return null;
        } catch (error) {
            throw this.handleError(`Failed to get document ${docId} from ${collectionName}`, error);
        }
    }

    /**
     * Get all documents from collection
     */
    async getCollection<T extends BaseDocument>(collectionName: string): Promise<T[]> {
        try {
            const collectionRef = collection(this.firestore, collectionName);
            const querySnapshot = await getDocs(collectionRef);

            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as T[];
        } catch (error) {
            throw this.handleError(`Failed to get collection ${collectionName}`, error);
        }
    }
    /**
     * Query documents with conditions
     */
    async queryDocuments<T extends BaseDocument>(
        collectionName: string,
        queryOptions: QueryOptions[],
        orderByField?: string,
        orderDirection: SortDirection = SortDirection.ASC,
        limitCount?: number
    ): Promise<T[]> {
        try {
            const collectionRef = collection(this.firestore, collectionName);
            const constraints: QueryConstraint[] = [];

            // Add where conditions
            queryOptions.forEach(option => {
                constraints.push(where(option.field, option.operator, option.value));
            });

            // Add ordering
            if (orderByField) {
                constraints.push(orderBy(orderByField, orderDirection));
            }

            // Add limit
            if (limitCount) {
                constraints.push(limit(limitCount));
            }

            const q = query(collectionRef, ...constraints);
            const querySnapshot = await getDocs(q);

            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as T[];
        } catch (error) {
            throw this.handleError(`Failed to query collection ${collectionName}`, error);
        }
    }
    /**
     * Listen to document changes
     */
    listenToDocument<T extends BaseDocument>(collectionName: string, docId: string): Observable<T | null> {
        const docRef = doc(this.firestore, collectionName, docId);

        return new Observable(observer => {
            const unsubscribe = onSnapshot(docRef,
                (docSnap) => {
                    if (docSnap.exists()) {
                        observer.next({ id: docSnap.id, ...docSnap.data() } as T);
                    } else {
                        observer.next(null);
                    }
                },
                (error) => observer.error(error)
            );

            return unsubscribe;
        });
    }

    /**
     * Listen to collection changes
     */
    listenToCollection<T extends BaseDocument>(collectionName: string, queryOptions?: QueryOptions[]): Observable<T[]> {
        const collectionRef = collection(this.firestore, collectionName);
        let q = query(collectionRef);

        if (queryOptions && queryOptions.length > 0) {
            const constraints: QueryConstraint[] = queryOptions.map(option =>
                where(option.field, option.operator, option.value)
            );
            q = query(collectionRef, ...constraints);
        }

        return new Observable(observer => {
            const unsubscribe = onSnapshot(q,
                (querySnapshot) => {
                    const documents = querySnapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    })) as T[];
                    observer.next(documents);
                },
                (error) => observer.error(error)
            );

            return unsubscribe;
        });
    }
    /**
     * Paginated query
     */
    async getPaginatedDocuments<T extends BaseDocument>(
        collectionName: string,
        options: PaginationOptions,
        queryOptions?: QueryOptions[],
        orderByField: string = 'createdAt',
        orderDirection: SortDirection = SortDirection.DESC
    ): Promise<PaginationResult<T>> {
        try {
            const collectionRef = collection(this.firestore, collectionName);
            const constraints: QueryConstraint[] = [];

            // Add where conditions
            if (queryOptions) {
                queryOptions.forEach(option => {
                    constraints.push(where(option.field, option.operator, option.value));
                });
            }

            // Add ordering
            constraints.push(orderBy(orderByField, orderDirection));

            // Add pagination
            if (options.lastDoc) {
                constraints.push(startAfter(options.lastDoc));
            }

            // Add limit + 1 to check if there are more documents
            constraints.push(limit(options.pageSize + 1));

            const q = query(collectionRef, ...constraints);
            const querySnapshot = await getDocs(q);

            const docs = querySnapshot.docs;
            const hasMore = docs.length > options.pageSize;

            // Remove the extra document if it exists
            if (hasMore) {
                docs.pop();
            }

            const documents = docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as T[];

            return {
                documents,
                hasMore,
                lastDoc: docs.length > 0 ? docs[docs.length - 1] : undefined,
                firstDoc: docs.length > 0 ? docs[0] : undefined
            };
        } catch (error) {
            throw this.handleError(`Failed to get paginated documents from ${collectionName}`, error);
        }
    }

    /**
     * Get paginated documents in reverse order (before a specific document)
     */
    async getPaginatedDocumentsBefore<T extends BaseDocument>(
        collectionName: string,
        options: PaginationOptions,
        queryOptions?: QueryOptions[],
        orderByField: string = 'createdAt',
        orderDirection: SortDirection = SortDirection.DESC
    ): Promise<PaginationResult<T>> {
        try {
            const collectionRef = collection(this.firestore, collectionName);
            const constraints: QueryConstraint[] = [];

            // Add where conditions
            if (queryOptions) {
                queryOptions.forEach(option => {
                    constraints.push(where(option.field, option.operator, option.value));
                });
            }

            // Add ordering
            constraints.push(orderBy(orderByField, orderDirection));

            // Add pagination using endBefore
            if (options.firstDoc) {
                constraints.push(endBefore(options.firstDoc));
            }

            // Add limit + 1 to check if there are more documents
            constraints.push(limit(options.pageSize + 1));

            const q = query(collectionRef, ...constraints);
            const querySnapshot = await getDocs(q);

            const docs = querySnapshot.docs;
            const hasMore = docs.length > options.pageSize;

            // Remove the extra document if it exists
            if (hasMore) {
                docs.pop();
            }

            const documents = docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as T[];

            return {
                documents,
                hasMore,
                lastDoc: docs.length > 0 ? docs[docs.length - 1] : undefined,
                firstDoc: docs.length > 0 ? docs[0] : undefined
            };
        } catch (error) {
            throw this.handleError(`Failed to get paginated documents before from ${collectionName}`, error);
        }
    }

    /**
     * Get collection reference
     */
    getCollectionRef(collectionName: string): CollectionReference<DocumentData> {
        return collection(this.firestore, collectionName);
    }

    /**
     * Get document reference
     */
    getDocumentRef(collectionName: string, docId: string): DocumentReference<DocumentData> {
        return doc(this.firestore, collectionName, docId);
    }

    /**
     * Execute raw query and return QuerySnapshot
     */
    async executeRawQuery(
        collectionName: string,
        constraints: QueryConstraint[]
    ): Promise<QuerySnapshot<DocumentData>> {
        try {
            const collectionRef = collection(this.firestore, collectionName);
            const q = query(collectionRef, ...constraints);
            return await getDocs(q);
        } catch (error) {
            throw this.handleError(`Failed to execute raw query on ${collectionName}`, error);
        }
    }

    /**
     * Get documents by IDs using DocumentData
     */
    async getDocumentsByIds<T extends BaseDocument>(
        collectionName: string,
        docIds: string[]
    ): Promise<T[]> {
        try {
            const collectionRef = collection(this.firestore, collectionName);
            const q = query(collectionRef, where('__name__', FirestoreOperator.IN, docIds.map(id => doc(this.firestore, collectionName, id))));
            const querySnapshot = await getDocs(q);

            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as T[];
        } catch (error) {
            throw this.handleError(`Failed to get documents by IDs from ${collectionName}`, error);
        }
    }

    /**
     * Process QuerySnapshot with custom logic
     */
    processQuerySnapshot<T extends BaseDocument>(
        querySnapshot: QuerySnapshot<DocumentData>,
        processor?: (data: DocumentData, docId: string) => T
    ): T[] {
        return querySnapshot.docs.map(doc => {
            const data = doc.data();
            const docId = doc.id;

            if (processor) {
                return processor(data, docId);
            }

            return {
                id: docId,
                ...data
            } as T;
        });
    }

    /**
     * Get raw document data
     */
    async getRawDocumentData(collectionName: string, docId: string): Promise<DocumentData | null> {
        try {
            const docRef = doc(this.firestore, collectionName, docId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                return docSnap.data();
            }
            return null;
        } catch (error) {
            throw this.handleError(`Failed to get raw document data for ${docId} from ${collectionName}`, error);
        }
    }

    /**
     * Listen to raw QuerySnapshot changes
     */
    listenToRawQuerySnapshot(
        collectionName: string,
        constraints: QueryConstraint[] = []
    ): Observable<QuerySnapshot<DocumentData>> {
        const collectionRef = collection(this.firestore, collectionName);
        const q = query(collectionRef, ...constraints);

        return new Observable(observer => {
            const unsubscribe = onSnapshot(q,
                (querySnapshot) => observer.next(querySnapshot),
                (error) => observer.error(error)
            );

            return unsubscribe;
        });
    }

    // ==================== STORAGE METHODS ====================

    /**
     * Upload file to Firebase Storage
     */
    async uploadFile(path: string, file: File, metadata?: any): Promise<string> {
        try {
            const storageRef = ref(this.storage, path);
            const snapshot = await uploadBytes(storageRef, file, metadata);
            return await getDownloadURL(snapshot.ref);
        } catch (error) {
            throw this.handleError(`Failed to upload file to ${path}`, error);
        }
    }
    /**
     * Upload file with progress tracking
     */
    uploadFileWithProgress(path: string, file: File, metadata?: any): Observable<UploadProgress> {
        const storageRef = ref(this.storage, path);
        const uploadTask = uploadBytesResumable(storageRef, file, metadata);

        return new Observable(observer => {
            uploadTask.on('state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    observer.next({
                        progress,
                        state: snapshot.state as UploadState,
                        bytesTransferred: snapshot.bytesTransferred,
                        totalBytes: snapshot.totalBytes
                    });
                },
                (error) => observer.error(error),
                async () => {
                    try {
                        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                        observer.next({
                            progress: 100,
                            downloadURL,
                            state: UploadState.SUCCESS,
                            bytesTransferred: uploadTask.snapshot.totalBytes,
                            totalBytes: uploadTask.snapshot.totalBytes
                        });
                        observer.complete();
                    } catch (error) {
                        observer.error(error);
                    }
                }
            );
        });
    }

    /**
     * Delete file from Firebase Storage
     */
    async deleteFile(path: string): Promise<void> {
        try {
            const storageRef = ref(this.storage, path);
            await deleteObject(storageRef);
        } catch (error) {
            throw this.handleError(`Failed to delete file at ${path}`, error);
        }
    }

    /**
     * Get download URL for a file
     */
    async getFileDownloadURL(path: string): Promise<string> {
        try {
            const storageRef = ref(this.storage, path);
            return await getDownloadURL(storageRef);
        } catch (error) {
            throw this.handleError(`Failed to get download URL for ${path}`, error);
        }
    }

    /**
     * List files in a directory
     */
    async listFiles(path: string): Promise<StorageReference[]> {
        try {
            const storageRef = ref(this.storage, path);
            const listResult = await listAll(storageRef);
            return listResult.items;
        } catch (error) {
            throw this.handleError(`Failed to list files in ${path}`, error);
        }
    }
    // ==================== UTILITY METHODS ====================
    /**
     * Batch operations
     */
    async batchOperations(operations: BatchOperation[]): Promise<void> {
        try {
            // Note: For simplicity, we'll execute operations sequentially
            // In a real-world scenario, you might want to use Firestore batch operations
            for (const operation of operations) {
                switch (operation.type) {
                    case BatchOperationType.ADD:
                        await this.addDocument(operation.collection, operation.data);
                        break;
                    case BatchOperationType.SET:
                        if (operation.docId) {
                            await this.setDocument(operation.collection, operation.docId, operation.data);
                        }
                        break;
                    case BatchOperationType.UPDATE:
                        if (operation.docId) {
                            await this.updateDocument(operation.collection, operation.docId, operation.data);
                        }
                        break;
                    case BatchOperationType.DELETE:
                        if (operation.docId) {
                            await this.deleteDocument(operation.collection, operation.docId);
                        }
                        break;
                }
            }
        } catch (error) {
            throw this.handleError('Batch operations failed', error);
        }
    }
    /**
     * Search documents with text search (case-insensitive)
     */
    async searchDocuments<T extends BaseDocument>(
        collectionName: string,
        searchField: string,
        searchTerm: string,
        limitCount: number = 20
    ): Promise<T[]> {
        try {
            const searchTermLower = searchTerm.toLowerCase();
            const searchTermUpper = searchTerm.toLowerCase() + '\uf8ff';

            const collectionRef = collection(this.firestore, collectionName);
            const q = query(
                collectionRef,
                where(searchField, FirestoreOperator.GREATER_THAN_OR_EQUAL, searchTermLower),
                where(searchField, FirestoreOperator.LESS_THAN_OR_EQUAL, searchTermUpper),
                limit(limitCount)
            );

            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as T[];
        } catch (error) {
            throw this.handleError(`Failed to search documents in ${collectionName}`, error);
        }
    }

    /**
     * Count documents in a collection
     */
    async countDocuments(collectionName: string, queryOptions?: QueryOptions[]): Promise<number> {
        try {
            const documents = await this.queryDocuments(collectionName, queryOptions || []);
            return documents.length;
        } catch (error) {
            throw this.handleError(`Failed to count documents in ${collectionName}`, error);
        }
    }

    /**
     * Check if document exists
     */
    async documentExists(collectionName: string, docId: string): Promise<boolean> {
        try {
            const docRef = doc(this.firestore, collectionName, docId);
            const docSnap = await getDoc(docRef);
            return docSnap.exists();
        } catch (error) {
            throw this.handleError(`Failed to check if document ${docId} exists in ${collectionName}`, error);
        }
    }
    /**
     * Get random documents from collection
     */
    async getRandomDocuments<T extends BaseDocument>(collectionName: string, count: number): Promise<T[]> {
        try {
            const allDocs = await this.getCollection<T>(collectionName);
            const shuffled = allDocs.sort(() => 0.5 - Math.random());
            return shuffled.slice(0, count);
        } catch (error) {
            throw this.handleError(`Failed to get random documents from ${collectionName}`, error);
        }
    }

    /**
     * Duplicate document
     */
    async duplicateDocument<T extends BaseDocument>(collectionName: string, docId: string, newDocId?: string): Promise<string> {
        try {
            const originalDoc = await this.getDocument<T>(collectionName, docId);
            if (!originalDoc) {
                throw new Error(`Document ${docId} not found in ${collectionName}`);
            }

            // Remove the id from the data to avoid conflicts
            const { id, createdAt, updatedAt, ...docData } = originalDoc;

            if (newDocId) {
                await this.setDocument(collectionName, newDocId, docData);
                return newDocId;
            } else {
                return await this.addDocument(collectionName, docData);
            }
        } catch (error) {
            throw this.handleError(`Failed to duplicate document ${docId} in ${collectionName}`, error);
        }
    }
    /**
     * Move document to another collection
     */
    async moveDocument<T extends BaseDocument>(
        fromCollection: string,
        toCollection: string,
        docId: string,
        deleteOriginal: boolean = true
    ): Promise<void> {
        try {
            const docData = await this.getDocument<T>(fromCollection, docId);
            if (!docData) {
                throw new Error(`Document ${docId} not found in ${fromCollection}`);
            }

            // Remove the id and timestamps from the data
            const { id, createdAt, updatedAt, ...dataToMove } = docData;

            await this.setDocument(toCollection, docId, dataToMove);

            if (deleteOriginal) {
                await this.deleteDocument(fromCollection, docId);
            }
        } catch (error) {
            throw this.handleError(`Failed to move document ${docId} from ${fromCollection} to ${toCollection}`, error);
        }
    }

    /**
     * Bulk insert documents
     */
    async bulkInsert<T extends BaseDocument>(collectionName: string, documents: Omit<T, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<string[]> {
        try {
            const docIds: string[] = [];
            for (const document of documents) {
                const docId = await this.addDocument(collectionName, document);
                docIds.push(docId);
            }
            return docIds;
        } catch (error) {
            throw this.handleError(`Failed to bulk insert documents to ${collectionName}`, error);
        }
    }
    /**
     * Bulk update documents
     */
    async bulkUpdate<T extends BaseDocument>(
        collectionName: string,
        updates: BulkUpdateOperation<T>[]
    ): Promise<void> {
        try {
            for (const update of updates) {
                await this.updateDocument(collectionName, update.docId, update.data);
            }
        } catch (error) {
            throw this.handleError(`Failed to bulk update documents in ${collectionName}`, error);
        }
    }

    /**
     * Bulk delete documents
     */
    async bulkDelete(collectionName: string, docIds: string[]): Promise<void> {
        try {
            for (const docId of docIds) {
                await this.deleteDocument(collectionName, docId);
            }
        } catch (error) {
            throw this.handleError(`Failed to bulk delete documents from ${collectionName}`, error);
        }
    }

    /**
     * Export collection to JSON
     */
    async exportCollection<T extends BaseDocument>(collectionName: string): Promise<T[]> {
        try {
            return await this.getCollection<T>(collectionName);
        } catch (error) {
            throw this.handleError(`Failed to export collection ${collectionName}`, error);
        }
    }

    /**
     * Import collection from JSON
     */
    async importCollection<T extends BaseDocument>(collectionName: string, documents: Omit<T, 'id' | 'createdAt' | 'updatedAt'>[], overwrite: boolean = false): Promise<void> {
        try {
            if (overwrite) {
                // Clear existing collection first
                const existingDocs = await this.getCollection(collectionName);
                const deletePromises = existingDocs.map((doc: any) =>
                    this.deleteDocument(collectionName, doc.id)
                );
                await Promise.all(deletePromises);
            }

            // Insert new documents
            await this.bulkInsert(collectionName, documents);
        } catch (error) {
            throw this.handleError(`Failed to import collection ${collectionName}`, error);
        }
    }

    /**
     * Generate unique document ID
     */
    generateDocumentId(): string {
        return doc(collection(this.firestore, '_temp_')).id;
    }
    /**
     * Get collection statistics
     */
    async getCollectionStats<T extends BaseDocument>(collectionName: string): Promise<CollectionStats> {
        try {
            const allDocs = await this.getCollection<T>(collectionName);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const totalDocuments = allDocs.length;
            const createdToday = allDocs.filter(doc => {
                if (doc.createdAt && doc.createdAt.toDate) {
                    const createdDate = doc.createdAt.toDate();
                    return createdDate >= today;
                }
                return false;
            }).length;

            const updatedToday = allDocs.filter(doc => {
                if (doc.updatedAt && doc.updatedAt.toDate) {
                    const updatedDate = doc.updatedAt.toDate();
                    return updatedDate >= today;
                }
                return false;
            }).length; return { totalDocuments, createdToday, updatedToday };
        } catch (error) {
            throw this.handleError(`Failed to get stats for collection ${collectionName}`, error);
        }
    }
    /**
     * Get server timestamp
     */
    getServerTimestamp() {
        return serverTimestamp();
    }

    /**
     * Convert Firestore timestamp to Date
     */
    timestampToDate(timestamp: Timestamp): Date {
        return timestamp.toDate();
    }

    /**
     * Convert Date to Firestore timestamp
     */
    dateToTimestamp(date: Date): Timestamp {
        return Timestamp.fromDate(date);
    }

    /**
     * Get current timestamp
     */
    getCurrentTimestamp(): Timestamp {
        return Timestamp.now();
    }
    /**
     * Format timestamp to readable string
     */
    formatTimestamp(timestamp: Timestamp, format: TimestampFormat = TimestampFormat.FULL): string {
        const date = timestamp.toDate();

        switch (format) {
            case TimestampFormat.DATE:
                return date.toDateString();
            case TimestampFormat.TIME:
                return date.toTimeString();
            case TimestampFormat.ISO:
                return date.toISOString();
            case TimestampFormat.LOCALE:
                return date.toLocaleString();
            case TimestampFormat.FULL:
            default:
                return date.toString();
        }
    }

    /**
     * Array union operation
     */
    arrayUnion(...elements: any[]) {
        return arrayUnion(...elements);
    }

    /**
     * Array remove operation
     */
    arrayRemove(...elements: any[]) {
        return arrayRemove(...elements);
    }

    /**
     * Increment operation
     */
    increment(value: number) {
        return increment(value);
    }

    /**
     * Decrement operation (negative increment)
     */
    decrement(value: number) {
        return increment(-value);
    }

    /**
     * Sanitize data for Firestore (remove undefined values)
     */
    sanitizeData<T>(data: T): T {
        const sanitized = JSON.parse(JSON.stringify(data));
        return this.removeUndefinedValues(sanitized);
    }

    /**
     * Deep merge objects
     */
    deepMerge<T>(target: T, source: Partial<T>): T {
        const result = { ...target };

        for (const key in source) {
            if (source[key] !== undefined) {
                if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
                    (result as any)[key] = this.deepMerge((target as any)[key] || {}, source[key] as any);
                } else {
                    (result as any)[key] = source[key];
                }
            }
        }

        return result;
    }
    /**
     * Generate slug from text
     */
    generateSlug(text: string): string {
        return text
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim();
    }

    /**
     * Generate random string
     */
    generateRandomString(length = 10): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    /**
     * Debounce function
     */
    debounce<T extends (...args: any[]) => void>(func: T, delay: number): T {
        let timeoutId: NodeJS.Timeout;
        return ((...args: any[]) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        }) as T;
    }
    /**
     * Convert bytes to human readable format
     */
    formatBytes(bytes: number, decimals: number = 2): string {
        if (bytes === 0) return `0 ${FileSize.BYTES}`;

        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = [
            FileSize.BYTES,
            FileSize.KB,
            FileSize.MB,
            FileSize.GB,
            FileSize.TB,
            FileSize.PB,
            FileSize.EB,
            FileSize.ZB,
            FileSize.YB
        ];

        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    /**
     * Check if object is empty
     */
    isEmpty(obj: any): boolean {
        if (obj === null || obj === undefined) return true;
        if (Array.isArray(obj)) return obj.length === 0;
        if (typeof obj === 'object') return Object.keys(obj).length === 0;
        return false;
    }

    /**
     * Remove undefined values from object
     */
    private removeUndefinedValues(obj: any): any {
        if (Array.isArray(obj)) {
            return obj.map(item => this.removeUndefinedValues(item));
        } else if (obj !== null && typeof obj === 'object') {
            const cleaned: any = {};
            for (const key in obj) {
                if (obj[key] !== undefined) {
                    cleaned[key] = this.removeUndefinedValues(obj[key]);
                }
            }
            return cleaned;
        }
        return obj;
    }  // ==================== PRIVATE HELPER METHODS ====================

    private handleError(message: string, error: any): FirebaseError {
        console.error(message, error);
        return {
            code: error.code || 'unknown',
            message: `${message}: ${error.message || error}`,
            originalError: error
        };
    }

    // ==================== TRANSACTION METHODS ====================

    /**
     * Run a transaction with custom operations
     */
    async runTransaction<T>(
        transactionFn: (transaction: Transaction) => Promise<T>
    ): Promise<T> {
        try {
            return await runTransaction(this.firestore, transactionFn);
        } catch (error) {
            throw this.handleError('Transaction failed', error);
        }
    }

    /**
     * Run transaction with predefined operations
     */
    async runTransactionWithOperations<T>(
        operations: TransactionOperation[]
    ): Promise<TransactionResult<T[]>> {
        try {
            const results = await runTransaction(this.firestore, async (transaction) => {
                const transactionResults: any[] = [];

                for (const operation of operations) {
                    const docRef = operation.docId
                        ? doc(this.firestore, operation.collection, operation.docId)
                        : doc(collection(this.firestore, operation.collection));

                    switch (operation.type) {
                        case TransactionOperationType.READ:
                            const docSnap = await transaction.get(docRef);
                            if (docSnap.exists()) {
                                transactionResults.push({ id: docSnap.id, ...docSnap.data() });
                            } else {
                                transactionResults.push(null);
                            }
                            break;

                        case TransactionOperationType.CREATE:
                            if (!operation.docId) {
                                throw new Error('Document ID is required for create operations in transactions');
                            }
                            transaction.set(docRef, {
                                ...operation.data,
                                createdAt: serverTimestamp(),
                                updatedAt: serverTimestamp()
                            });
                            transactionResults.push({ id: operation.docId, ...operation.data });
                            break;

                        case TransactionOperationType.UPDATE:
                            if (!operation.docId) {
                                throw new Error('Document ID is required for update operations');
                            }
                            transaction.update(docRef, {
                                ...operation.data,
                                updatedAt: serverTimestamp()
                            });
                            transactionResults.push({ id: operation.docId, ...operation.data });
                            break;

                        case TransactionOperationType.DELETE:
                            if (!operation.docId) {
                                throw new Error('Document ID is required for delete operations');
                            }
                            transaction.delete(docRef);
                            transactionResults.push({ id: operation.docId, deleted: true });
                            break;
                    }
                }

                return transactionResults;
            });

            return {
                success: true,
                data: results,
                operationsCount: operations.length
            };
        } catch (error) {
            return {
                success: false,
                error: this.handleError('Transaction with operations failed', error),
                operationsCount: operations.length
            };
        }
    }
    /**
     * Check if transaction can be executed (dry run)
     */
    async validateTransaction(operations: TransactionOperation[]): Promise<{
        valid: boolean;
        errors: string[];
        warnings: string[]
    }> {
        const errors: string[] = [];
        const warnings: string[] = [];

        try {
            await runTransaction(this.firestore, async (transaction) => {
                for (const operation of operations) {
                    const docRef = operation.docId
                        ? doc(this.firestore, operation.collection, operation.docId)
                        : doc(collection(this.firestore, operation.collection));

                    switch (operation.type) {
                        case TransactionOperationType.READ:
                            const docSnap = await transaction.get(docRef);
                            if (!docSnap.exists() && operation.docId) {
                                warnings.push(`Document ${operation.docId} does not exist in ${operation.collection}`);
                            }
                            break;

                        case TransactionOperationType.CREATE:
                            if (!operation.docId) {
                                errors.push('Document ID is required for create operations');
                            }
                            if (!operation.data) {
                                errors.push('Data is required for create operations');
                            }
                            break;

                        case TransactionOperationType.UPDATE:
                            if (!operation.docId) {
                                errors.push('Document ID is required for update operations');
                            }
                            if (!operation.data) {
                                errors.push('Data is required for update operations');
                            }
                            const updateDocSnap = await transaction.get(docRef);
                            if (!updateDocSnap.exists()) {
                                errors.push(`Cannot update non-existent document ${operation.docId} in ${operation.collection}`);
                            }
                            break;

                        case TransactionOperationType.DELETE:
                            if (!operation.docId) {
                                errors.push('Document ID is required for delete operations');
                            }
                            const deleteDocSnap = await transaction.get(docRef);
                            if (!deleteDocSnap.exists()) {
                                warnings.push(`Document ${operation.docId} does not exist in ${operation.collection}`);
                            }
                            break;
                    }
                }

                // This is a validation transaction, so we throw to rollback
                throw new Error('Validation complete');
            });
        } catch (error: any) {
            if (error.message !== 'Validation complete') {
                errors.push(`Transaction validation failed: ${error.message}`);
            }
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Get transaction with retry logic
     */
    async runTransactionWithRetry<T>(
        transactionFn: (transaction: Transaction) => Promise<T>,
        maxRetries: number = 3,
        retryDelay: number = 1000
    ): Promise<T> {
        let lastError: any;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await runTransaction(this.firestore, transactionFn);
            } catch (error) {
                lastError = error;
                console.warn(`Transaction attempt ${attempt} failed:`, error);

                if (attempt < maxRetries) {
                    // Wait before retrying
                    await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
                }
            }
        }

        throw this.handleError(`Transaction failed after ${maxRetries} attempts`, lastError);
    }

    // ==================== BATCH WRITE METHODS ====================

    /**
     * Create a batch writer
     */
    createBatch(): WriteBatch {
        return writeBatch(this.firestore);
    }

    /**
     * Execute batch operations
     */
    async executeBatchOperations(operations: BatchWriteOperation[]): Promise<BatchWriteResult> {
        try {
            const batch = writeBatch(this.firestore);

            for (const operation of operations) {
                const docRef = doc(this.firestore, operation.collection, operation.docId);

                switch (operation.type) {
                    case BatchWriteType.SET:
                        if (operation.merge) {
                            batch.set(docRef, {
                                ...operation.data,
                                updatedAt: serverTimestamp()
                            }, { merge: true });
                        } else {
                            batch.set(docRef, {
                                ...operation.data,
                                createdAt: serverTimestamp(),
                                updatedAt: serverTimestamp()
                            });
                        }
                        break;

                    case BatchWriteType.UPDATE:
                        batch.update(docRef, {
                            ...operation.data,
                            updatedAt: serverTimestamp()
                        });
                        break;

                    case BatchWriteType.DELETE:
                        batch.delete(docRef);
                        break;
                }
            }

            await batch.commit();

            return {
                success: true,
                operationsCount: operations.length
            };
        } catch (error) {
            return {
                success: false,
                error: this.handleError('Batch operations failed', error),
                operationsCount: operations.length
            };
        }
    }

    /**
     * Batch create documents
     */
    async batchCreate<T extends BaseDocument>(
        collectionName: string,
        documents: Array<{ docId: string; data: Omit<T, 'id' | 'createdAt' | 'updatedAt'> }>
    ): Promise<BatchWriteResult> {
        const operations: BatchWriteOperation[] = documents.map(({ docId, data }) => ({
            type: BatchWriteType.SET,
            collection: collectionName,
            docId,
            data,
            merge: false
        }));

        return this.executeBatchOperations(operations);
    }

    /**
     * Batch update documents
     */
    async batchUpdateDocuments<T extends BaseDocument>(
        collectionName: string,
        updates: Array<{ docId: string; data: Partial<Omit<T, 'id' | 'createdAt'>> }>
    ): Promise<BatchWriteResult> {
        const operations: BatchWriteOperation[] = updates.map(({ docId, data }) => ({
            type: BatchWriteType.UPDATE,
            collection: collectionName,
            docId,
            data
        }));

        return this.executeBatchOperations(operations);
    }

    /**
     * Batch delete documents
     */
    async batchDeleteDocuments(
        collectionName: string,
        docIds: string[]
    ): Promise<BatchWriteResult> {
        const operations: BatchWriteOperation[] = docIds.map(docId => ({
            type: BatchWriteType.DELETE,
            collection: collectionName,
            docId
        }));

        return this.executeBatchOperations(operations);
    }
}