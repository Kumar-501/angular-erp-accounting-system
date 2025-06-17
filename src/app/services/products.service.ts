import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  getDocs,
  getDoc,
  serverTimestamp,
  collectionGroup,
  orderBy,
  limit as firestoreLimit
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { SkuGeneratorService } from './sku-generator.service';

// In products.service.ts or shared interfaces file
interface Product {
  // Core identification
  id?: string;
  productName: string;
  productNameLower?: string; // For search/filtering purposes
  sku: string;
  hsnCode: string;
  batchNumber: string;
  
  // Location properties (supporting both old and new formats)
  location?: string; // Single location ID (for backward compatibility)
  locations?: string[]; // Array of location IDs
  locationName?: string; // Single location name (for backward compatibility)  
  locationNames?: string[]; // Array of location names
   totalQuantity: number;       // Total quantity in stock
  lastNumber: string; 
  // Pricing
  unitPurchasePrice: number | null;
  unitSellingPrice: number | null;
  defaultPurchasePriceExcTax: number | null;
  defaultPurchasePriceIncTax: number | null;
  marginPercentage: number;
  defaultSellingPriceExcTax: number | null;
  defaultSellingPriceIncTax: number | null;
  
  // Product details
  barcodeType: string;
  unit: string;
  brand: string;
  category: string;
  subCategory: string;
  productType: string;
  defineProduct: 'Regular' | 'Asset' | 'Expense';
  
  // Status and flags
  isActive?: boolean;
  status?: string;
  notForSelling: boolean;
  enableProductDescription: boolean;
  manageStock: boolean;
  
  // Stock management
  currentStock: number;
  alertQuantity: number | null;
  
  // Tax information
  applicableTax: string;
  taxPercentage: number;
  sellingPriceTaxType: string;
  
  // Physical properties
  weight: number | null;
  length: number | null;
  breadth: number | null;
  height: number | null;
  preparationTime: number | null;
  
  // Content and media
  productDescription: string;
  productImage: any;
  productBrochure: any;
  
  // Custom fields
  customField1: string;
  customField2: string;
  customField3: string;
  customField4: string;
  
  // Timestamps
  createdAt?: Date;
  updatedAt?: Date;
    expiryDate?: string | null; // Add this line

  // Complex product structures
  components?: {
    productId: string;
    quantity: number;
  }[];
  
  variations?: {
    values: string[];
    sku: string;
    price: number;
    quantity: number;
  }[];
}

// Define history entry interface
interface HistoryEntry {
  id?: string;
  productId: string;
  action: string; // 'add', 'update', 'stock_update', 'delete'
  timestamp: any;
  user?: string;
  oldValue?: any;
  newValue?: any;
  note?: string;
  
}

@Injectable({
  providedIn: 'root'
})
export class ProductsService {
 getProductPurchaseHistory(productId: string): Observable<any[]> {
  return new Observable(observer => {
    const purchaseOrdersRef = collection(this.firestore, 'purchase_orders');
    const q = query(
      purchaseOrdersRef,
      where('items', 'array-contains', { productId: productId })
    );
    
    onSnapshot(q, (snapshot) => {
      const orders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data()['date']?.toDate() || null
      }));
      observer.next(orders);
    }, error => {
      console.error('Error getting purchase orders:', error);
      observer.error(error);
    });
  });
  }
  
  getProductSalesHistory(productId: string) {
    throw new Error('Method not implemented.');
  }
  private productsCollection;
  private historyCollection;

  constructor(private firestore: Firestore,

        private skuGenerator: SkuGeneratorService

  )
  
  
  
  {
    this.productsCollection = collection(this.firestore, 'products');
    this.historyCollection = collection(this.firestore, 'product_history');
    
  }
// In products.service.ts
async searchProducts(searchQuery: string): Promise<Product[]> {  // Changed parameter name from 'query' to 'searchQuery'
  try {
    const searchTerm = searchQuery.toLowerCase().trim();
    
    if (!searchTerm) return [];

    // Search by SKU (exact match)
    const skuQuery = query(  // Now this correctly references the imported query function
      this.productsCollection,
      where('sku', '==', searchTerm),
      firestoreLimit(1)
    );
    const skuResults = await getDocs(skuQuery);
    
    if (!skuResults.empty) {
      return skuResults.docs.map(doc => ({
        id: doc.id,
        ...doc.data() as Product
      }));
    }

    // Search by product name (partial match)
    const nameQuery = query(  // Now this correctly references the imported query function
      this.productsCollection,
      where('productNameLower', '>=', searchTerm),
      where('productNameLower', '<=', searchTerm + '\uf8ff'),
      firestoreLimit(10)
    );
    const nameResults = await getDocs(nameQuery);
    
    return nameResults.docs.map(doc => ({
      id: doc.id,
      ...doc.data() as Product
    }));

  } catch (error) {
    console.error('Error searching products:', error);
    throw error;
  }
}
// In products.service.ts

// In products.service.ts

async addProduct(product: Product): Promise<string> {
  try {
    // Generate SKU first if not provided
    if (!product.sku) {
      product.sku = await this.skuGenerator.getNextSku();
    }
    
    // Prepare product data for saving
    const productToSave = {
      ...this.prepareProductData(product),
      productNameLower: product.productName.toLowerCase(),
      locations: product.locations || [], // Array of location IDs
      locationNames: product.locationNames || [], // Array of location names
      // Maintain backward compatibility
      location: product.locations?.[0] || '', // First location ID
      locationName: product.locationNames?.[0] || '' // First location name
    };
    
    // Remove ID if it exists (for duplicate case)
    if (productToSave.id) {
      delete productToSave.id;
    }
    
    // Add product to Firestore
    const docRef = await addDoc(this.productsCollection, productToSave);
    
    // Add history entry for tracking
    await this.addHistoryEntry({
      productId: docRef.id,
      action: 'add',
      timestamp: serverTimestamp(),
      user: 'System',
      newValue: productToSave.productName,
      note: 'Product created'
    });
    
    return docRef.id;
  } catch (error) {
    console.error('Error adding product:', error);
    throw error;
  }
}

// Add this method to generate numeric SKUs
// Add this method to generate numeric SKUs
private generateNumericSku(lastSku: string | null): string {
  // Default starting SKU if no products exist
  let nextNumber = 100001;
  
  if (lastSku) {
    // Extract numeric part and increment
    const lastNumber = parseInt(lastSku, 10);
    if (!isNaN(lastNumber)) {
      nextNumber = lastNumber + 1;
    }
  }
  
  return nextNumber.toString();
}
public async getLastUsedSku(): Promise<string | null> {
  try {
    const q = query(
      this.productsCollection,
      orderBy('sku', 'desc'),
      firestoreLimit(1)
    );
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const lastProduct = querySnapshot.docs[0].data() as Product;
      return lastProduct.sku;
    }
    return null;
  } catch (error) {
    console.error('Error getting last SKU:', error);
    return null;
  }
}
  getProductsRealTime() {
    const productsCollection = collection(this.firestore, 'products');
    return new Observable<any[]>(observer => {
      const unsubscribe = onSnapshot(productsCollection, (snapshot) => {
        const products = snapshot.docs.map(doc => {
          return { id: doc.id, ...doc.data() };
        });
        observer.next(products);
      }, error => {
        console.error('Error fetching products:', error);
        observer.error(error);
      });
      return unsubscribe;
    });
  }

  // Update existing product
  async updateProduct(productId: string, updatedData: Partial<Product>): Promise<void> {
    try {
      const productDoc = doc(this.firestore, `products/${productId}`);
      const currentProduct = await this.getProductById(productId);
      
  await updateDoc(productDoc, {
    ...updatedData,
    updatedAt: new Date(),
    lastUpdated: new Date()
      });
      
      // Add history entry for product update
      await this.addHistoryEntry({
        productId: productId,
        action: 'update',
        timestamp: serverTimestamp(),
        newValue: updatedData.productName
      });
    
    } catch (error) {
      console.error('Error updating product:', error);
      throw error;
    }
  }

  // Delete product
// In your deleteProduct method, ensure it looks like this:
async deleteProduct(productId: string): Promise<void> {
  try {
    const product = await this.getProductById(productId);
    const productDoc = doc(this.firestore, `products/${productId}`);
    
    // Add history entry before deletion
    if (product) {
      await this.addHistoryEntry({
        productId: productId,
        action: 'delete',
        timestamp: serverTimestamp(),
        user: 'System', // Update this with actual user info
        oldValue: product.productName
      });
    }
    
    await deleteDoc(productDoc);
    
    // Optional: Delete any related documents (like stock history)
    // You might want to add this if you have subcollections
    // await this.deleteProductSubcollections(productId);
    
  } catch (error) {
    console.error('Error deleting product:', error);
    throw error;
  }
}

// Optional: Add this method if you need to delete subcollections
private async deleteProductSubcollections(productId: string): Promise<void> {
  try {
    // Example: Delete stock history subcollection
    const stockHistoryRef = collection(this.firestore, `products/${productId}/stock_history`);
    const snapshot = await getDocs(stockHistoryRef);
    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
  } catch (error) {
    console.error('Error deleting product subcollections:', error);
    throw error;
  }
}

  // Update product by SKU
  async updateProductBySKU(sku: string, updatedData: Partial<Product>): Promise<void> {
    try {
      const q = query(this.productsCollection, where("sku", "==", sku));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const productId = querySnapshot.docs[0].id;
        const currentProduct = await this.getProductById(productId);
        
        const productDoc = doc(this.firestore, `products/${productId}`);
        await updateDoc(productDoc, {
          ...updatedData,
          updatedAt: new Date()
        });
        
        // Add history entry for product update by SKU
        await this.addHistoryEntry({
          productId: productId,
          action: 'update',
          timestamp: serverTimestamp(),
          user: 'System',
          note: 'Updated via SKU',
          oldValue: currentProduct?.productName,
          newValue: updatedData.productName || currentProduct?.productName
        });
      }
    } catch (error) {
      console.error('Error updating product by SKU:', error);
      throw error;
    }
  }
// In products.service.ts




  private async addHistoryEntry(entry: HistoryEntry): Promise<void> {
    try {
      await addDoc(this.historyCollection, entry);
    } catch (error) {
      console.error('Error adding history entry:', error);
      throw error;
    }
  }

  // Get product history
  getProductHistory(productId: string): Observable<HistoryEntry[]> {
    const historyQuery = query(
      this.historyCollection,
      where('productId', '==', productId),
      orderBy('timestamp', 'desc')
    );
    
    return new Observable<HistoryEntry[]>(observer => {
      const unsubscribe = onSnapshot(historyQuery, (snapshot) => {
        const history = snapshot.docs.map(doc => {
          // Fixed type conversion by explicitly constructing an object that matches HistoryEntry
          const data = doc.data();
          const entry: HistoryEntry = {
            id: doc.id,
            productId: data['productId'],
            action: data['action'],
            timestamp: data['timestamp'],
            user: data['user'],
            oldValue: data['oldValue'],
            newValue: data['newValue'],
            note: data['note']
          };
          return entry;
        });
        observer.next(history);
      }, error => {
        console.error('Error fetching product history:', error);
        observer.error(error);
      });
      return unsubscribe;
    });
  }
// In products.service.ts
async updateProductStock(productId: string, newStock: number): Promise<void> {
  try {
    const productDoc = doc(this.firestore, `products/${productId}`);
    await updateDoc(productDoc, {
      currentStock: newStock,
      updatedAt: new Date()
    });
  } catch (error) {
    console.error('Error updating product stock:', error);
    throw error;
  }
}

async getProductById(productId: string): Promise<Product | null> {
  try {
    const productDoc = doc(this.firestore, `products/${productId}`);
    const docSnapshot = await getDoc(productDoc);

    if (docSnapshot.exists()) {
      return {
        id: docSnapshot.id,
        ...docSnapshot.data()
      } as Product;
    }
    return null;
  } catch (error) {
    console.error('Error getting product by ID:', error);
    throw error;
  }
}

async getProductByName(productName: string): Promise<Product | null> {
  try {
    const q = query(this.productsCollection, where("productName", "==", productName));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      return {
        id: querySnapshot.docs[0].id,
        ...querySnapshot.docs[0].data()
      } as Product;
    }
    return null;
  } catch (error) {
    console.error('Error getting product by Name:', error);
    throw error;
  }
}


  // Get product by SKU
  async getProductBySku(sku: string): Promise<Product | null> {
    try {
      const q = query(this.productsCollection, where("sku", "==", sku));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        return {
          id: querySnapshot.docs[0].id,
          ...querySnapshot.docs[0].data()
        } as Product;
      }
      return null;
    } catch (error) {
      console.error('Error getting product by SKU:', error);
      throw error;
    }
  }

 
 async getProductByIdForLocation(productId: string, locationId: string): Promise<Product | null> {
  try {
    const productDoc = doc(this.firestore, `products/${productId}`);
    const docSnapshot = await getDoc(productDoc);

    if (docSnapshot.exists()) {
      const product = docSnapshot.data() as Product;
      if (product.location === locationId) {
        return { id: docSnapshot.id, ...product };
      }
    }
    return null;
  } catch (error) {
    console.error('Error getting product by ID for location:', error);
    throw error;
  }
}
  async adjustProductStock(productId: string, locationId: string, quantity: number): Promise<void> {
    try {
      const productDoc = doc(this.firestore, `products/${productId}`);
      const currentProduct = await this.getProductById(productId);
      
      if (currentProduct && currentProduct.location === locationId) {
        const newStock = (currentProduct.currentStock || 0) + quantity;
        await updateDoc(productDoc, {
          currentStock: newStock,
          updatedAt: new Date()
        });
        
        // Add history entry for stock adjustment
        await this.addHistoryEntry({
          productId: productId,
          action: 'stock_adjustment',
          timestamp: serverTimestamp(),
          user: 'System',
          note: `Stock adjusted by ${quantity} at location ${locationId}`,
          oldValue: currentProduct.currentStock,
          newValue: newStock
        });
      }
    } catch (error) {
      console.error('Error adjusting product stock:', error);
      throw error;
    }
  }  

// Update the prepareProductData() method in ProductsService:
private prepareProductData(product: Product): Product {
  return {
    ...product,
    createdAt: new Date(),
    updatedAt: new Date(),
    location: product.location || '',
       // Ensure selling prices are properly set
    unitSellingPrice: Number(product.unitSellingPrice) || null,
    defaultSellingPriceExcTax: Number(product.defaultSellingPriceExcTax) || 
                              Number(product.unitSellingPrice) || 
                              null,
    hsnCode: product.hsnCode || '',
    productImage: product.productImage?.name ? product.productImage.name : product.productImage,
    productBrochure: product.productBrochure?.name || null,
    alertQuantity: Number(product.alertQuantity) || null,
        unitPurchasePrice: Number(product.unitPurchasePrice) || null,
    weight: Number(product.weight) || null,
    length: Number(product.length) || null,
        expiryDate: product.expiryDate || null, // Add this line

       totalQuantity: Number(product.totalQuantity) || 0,
    lastNumber: product.lastNumber || '',
    breadth: Number(product.breadth) || null,
    height: Number(product.height) || null,
    defaultPurchasePriceExcTax: Number(product.defaultPurchasePriceExcTax) || null,
    defaultPurchasePriceIncTax: Number(product.defaultPurchasePriceIncTax) || null,
    marginPercentage: Number(product.marginPercentage) || 25,
    defaultSellingPriceIncTax: Number(product.defaultSellingPriceIncTax) || null,
    taxPercentage: Number(product.taxPercentage) || 0,
    currentStock: Number(product.currentStock) || 0,
    components: product.components ? [...product.components] : [],
    variations: product.variations ? [...product.variations] : []
  };
}
  // Add to ProductsService
getProductStockHistory(productId: string): Observable<any[]> {
  const historyQuery = query(
    collection(this.firestore, 'product_stock_history'),
    where('productId', '==', productId),
    orderBy('timestamp', 'desc')
  );
  
  return new Observable<any[]>(observer => {
    const unsubscribe = onSnapshot(historyQuery, (snapshot) => {
      const history = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      observer.next(history);
    }, error => {
      console.error('Error fetching product stock history:', error);
      observer.error(error);
    });
    return unsubscribe;
  });
}

  // Fetch all products
  async fetchAllProducts(): Promise<Product[]> {
    try {
      const querySnapshot = await getDocs(this.productsCollection);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
    } catch (error) {
      console.error('Error fetching all products:', error);
      throw error;
    }
  }
  async getProductsByLocation(locationId: string): Promise<Product[]> {
    try {
      const q = query(this.productsCollection, where("location", "==", locationId));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
    } catch (error) {
      console.error('Error getting products by location:', error);
      throw error;
    }
  }
  async getLocations(): Promise<any[]> {
    const locationsCollection = collection(this.firestore, 'businessLocations');
    const snapshot = await getDocs(locationsCollection);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }
  // Get recent product history for all products
  getAllProductsHistory(limitCount: number = 50): Observable<HistoryEntry[]> {
    const historyQuery = query(
      this.historyCollection,
      orderBy('timestamp', 'desc'),
      firestoreLimit(limitCount) // Fixed: using firestoreLimit instead of limit
    );
    
    return new Observable<HistoryEntry[]>(observer => {
      const unsubscribe = onSnapshot(historyQuery, (snapshot) => {
        const history = snapshot.docs.map(doc => {
          // Fixed type conversion by explicitly constructing an object that matches HistoryEntry
          const data = doc.data();
          const entry: HistoryEntry = {
            id: doc.id,
            productId: data['productId'],
            action: data['action'],
            timestamp: data['timestamp'],
            user: data['user'],
            oldValue: data['oldValue'],
            newValue: data['newValue'],
            note: data['note']
          };
          return entry;
        });
        observer.next(history);
      }, error => {
        console.error('Error fetching all products history:', error);
        observer.error(error);
      });
      return unsubscribe;
    });
  }
}