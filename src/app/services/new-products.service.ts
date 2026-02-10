import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Firestore, collection, query, where, orderBy, limit, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc, onSnapshot, Timestamp } from '@angular/fire/firestore';
import { COLLECTIONS } from '../../utils/constants';
import { Validators } from '../../utils/validators';

// Product interface without stock-related fields
export interface NewProduct {  // Core identification
  id?: string;  productName: string;
  productNameLower?: string;
  sku: string;
  hsnCode: string;
  
  // Pricing
  unitPurchasePrice?: number | null;
  unitSellingPrice?: number | null;
  defaultPurchasePriceExcTax?: number | null;
  defaultPurchasePriceIncTax?: number | null;
  marginPercentage?: number;
  defaultSellingPriceExcTax?: number | null;
  defaultSellingPriceIncTax?: number | null;
  
  // Product details
  barcodeType: string;
  unit?: string;
  brand?: string;
  category: string;
  subCategory?: string;
  productType: string;
  defineProduct?: 'Regular' | 'Asset' | 'Expense';
  
  // Status and flags
  isActive?: boolean;
  status?: string;
  notForSelling?: boolean;
  enableProductDescription?: boolean;
  
  // Tax information
  applicableTax: any;
  taxPercentage?: number;
  sellingPriceTaxType: string;
  
  // Physical properties
  weight?: number | null;
  length?: number | null;
  breadth?: number | null;
  height?: number | null;
  preparationTime?: number | null;
  
  // Content and media
  productDescription?: string;
  productImage?: any;
  productBrochure?: any;
  
  // Custom fields
  customField1?: string;
  customField2?: string;
  customField3?: string;
  customField4?: string;
  
  // Timestamps and metadata
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  addedDate?: string;
  addedByDocId?: string;
  addedByName?: string;
  lastNumber?: string;
  expiryDate?: string | null;
  
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
  
  // Not for selling products
  notSellingProducts?: any[];
}

@Injectable({
  providedIn: 'root'
})
export class NewProductsService {
  private productsCollection;

  constructor(private firestore: Firestore) {
    this.productsCollection = collection(this.firestore, COLLECTIONS.PRODUCTS);
  }

  /**
   * Add a new product
   */
  async addProduct(product: NewProduct): Promise<string> {
    try {
      // Validate required fields
      if (!this.validateProduct(product)) {
        throw new Error('Product validation failed');
      }

      // Prepare product data
      const productData = this.prepareProductData(product);
      
      // Add timestamps
      productData.createdAt = Timestamp.now();
      productData.updatedAt = Timestamp.now();
      
      // Add product to Firestore
      const docRef = await addDoc(this.productsCollection, productData);
      
      console.log('Product added successfully with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('Error adding product:', error);
      throw error;
    }
  }

  /**
   * Update an existing product
   */
  async updateProduct(productId: string, updatedData: Partial<NewProduct>): Promise<void> {
    try {
      if (!productId) {
        throw new Error('Product ID is required');
      }

      // Prepare update data
      const updateData = this.prepareProductData(updatedData);
      updateData.updatedAt = Timestamp.now();

      // Update product in Firestore
      const productDoc = doc(this.firestore, COLLECTIONS.PRODUCTS, productId);
      await updateDoc(productDoc, updateData);
      
      console.log('Product updated successfully');
    } catch (error) {
      console.error('Error updating product:', error);
      throw error;
    }
  }

  /**
   * Delete a product
   */
  async deleteProduct(productId: string): Promise<void> {
    try {
      if (!productId) {
        throw new Error('Product ID is required');
      }

      const productDoc = doc(this.firestore, COLLECTIONS.PRODUCTS, productId);
      await deleteDoc(productDoc);
      
      console.log('Product deleted successfully');
    } catch (error) {
      console.error('Error deleting product:', error);
      throw error;
    }
  }

  /**
   * Get a single product by ID
   */
  async getProductById(productId: string): Promise<NewProduct | null> {
    try {
      if (!productId) {
        throw new Error('Product ID is required');
      }

      const productDoc = doc(this.firestore, COLLECTIONS.PRODUCTS, productId);
      const docSnap = await getDoc(productDoc);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as NewProduct;
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error getting product:', error);
      throw error;
    }
  }

  /**
   * Get product by SKU
   */
  async getProductBySku(sku: string): Promise<NewProduct | null> {
    try {
      if (!sku) {
        throw new Error('SKU is required');
      }

      const q = query(this.productsCollection, where('sku', '==', sku), limit(1));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        return { id: doc.id, ...doc.data() } as NewProduct;
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error getting product by SKU:', error);
      throw error;
    }
  }

  /**
   * Search products by name
   */
  async searchProducts(searchTerm: string): Promise<NewProduct[]> {
    try {
      if (!searchTerm || searchTerm.trim().length === 0) {
        return [];
      }

      const searchTermLower = searchTerm.toLowerCase();
      
      const q = query(
        this.productsCollection,
        where('productNameLower', '>=', searchTermLower),
        where('productNameLower', '<=', searchTermLower + '\uf8ff'),
        limit(50)
      );
      
      const querySnapshot = await getDocs(q);
      const products: NewProduct[] = [];
      
      querySnapshot.forEach((doc) => {
        products.push({ id: doc.id, ...doc.data() } as NewProduct);
      });
      
      return products;
    } catch (error) {
      console.error('Error searching products:', error);
      throw error;
    }
  }

  /**
   * Get all products (with optional filtering)
   */
  async getAllProducts(isActive: boolean = true): Promise<NewProduct[]> {
    try {
      let q;
      if (isActive !== undefined) {
        q = query(this.productsCollection, where('isActive', '==', isActive), orderBy('createdAt', 'desc'));
      } else {
        q = query(this.productsCollection, orderBy('createdAt', 'desc'));
      }
      
      const querySnapshot = await getDocs(q);
      const products: NewProduct[] = [];
      
      querySnapshot.forEach((doc) => {
        products.push({ id: doc.id, ...doc.data() } as NewProduct);
      });
      
      return products;
    } catch (error) {
      console.error('Error getting all products:', error);
      throw error;
    }  }

  /**
   * Listen to products real-time
   */
  getProductsRealTime(): Observable<NewProduct[]> {
    return new Observable<NewProduct[]>(observer => {
      const q = query(this.productsCollection, where('isActive', '==', true), orderBy('createdAt', 'desc'));
      
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const products: NewProduct[] = [];
        querySnapshot.forEach((doc) => {
          products.push({ id: doc.id, ...doc.data() } as NewProduct);
        });
        observer.next(products);
      }, (error) => {
        observer.error(error);
      });

      return () => unsubscribe();
    });
  }

  /**
   * Get products not for selling
   */
  async getNotSellingProducts(): Promise<NewProduct[]> {
    try {
      const q = query(
        this.productsCollection,
        where('notForSelling', '==', true),
        where('isActive', '==', true)
      );
      
      const querySnapshot = await getDocs(q);
      const products: NewProduct[] = [];
      
      querySnapshot.forEach((doc) => {
        products.push({ id: doc.id, ...doc.data() } as NewProduct);
      });
      
      return products;
    } catch (error) {
      console.error('Error getting not selling products:', error);
      throw error;
    }
  }

  /**
   * Get last used SKU for generating new SKUs
   */
  async getLastUsedSku(): Promise<string | null> {
    try {
      const q = query(this.productsCollection, orderBy('sku', 'desc'), limit(1));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const lastProduct = querySnapshot.docs[0].data() as NewProduct;
        return lastProduct.sku;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting last used SKU:', error);
      return null;
    }
  }

  /**
   * Validate product data
   */
  private validateProduct(product: NewProduct): boolean {
    // Required field validations
    if (!Validators.isNotEmpty(product.productName)) {
      throw new Error('Product name is required');
    }

    if (!Validators.isNotEmpty(product.sku)) {
      throw new Error('SKU is required');
    }

    if (!Validators.isNotEmpty(product.category)) {
      throw new Error('Category is required');
    }

    if (!Validators.isNotEmpty(product.productType)) {
      throw new Error('Product type is required');
    }

 

    // Validate email if addedBy contains email
    if (product.addedByName && product.addedByName.includes('@')) {
      if (!Validators.isValidEmail(product.addedByName)) {
        throw new Error('Invalid email format for added by');
      }
    }

    // Validate numeric fields
    if (product.defaultPurchasePriceExcTax && product.defaultPurchasePriceExcTax < 0) {
      throw new Error('Purchase price cannot be negative');
    }

    if (product.defaultSellingPriceExcTax && product.defaultSellingPriceExcTax < 0) {
      throw new Error('Selling price cannot be negative');
    }

    if (product.marginPercentage && (product.marginPercentage < 0 || product.marginPercentage > 100)) {
      throw new Error('Margin percentage must be between 0 and 100');
    }

    return true;
  }

  /**
   * Prepare product data for saving
   */
  private prepareProductData(product: Partial<NewProduct>): any {
    const data: any = { ...product };
    
    // Generate lowercase name for searching
    if (data.productName) {
      data.productNameLower = data.productName.toLowerCase();
    }

    // Remove undefined values
    Object.keys(data).forEach(key => {
      if (data[key] === undefined) {
        delete data[key];
      }
    });

    // Ensure numeric fields are properly formatted
    if (data.defaultPurchasePriceExcTax !== null && data.defaultPurchasePriceExcTax !== undefined) {
      data.defaultPurchasePriceExcTax = Number(data.defaultPurchasePriceExcTax) || 0;
    }

    if (data.defaultPurchasePriceIncTax !== null && data.defaultPurchasePriceIncTax !== undefined) {
      data.defaultPurchasePriceIncTax = Number(data.defaultPurchasePriceIncTax) || 0;
    }

    if (data.defaultSellingPriceExcTax !== null && data.defaultSellingPriceExcTax !== undefined) {
      data.defaultSellingPriceExcTax = Number(data.defaultSellingPriceExcTax) || 0;
    }

    if (data.defaultSellingPriceIncTax !== null && data.defaultSellingPriceIncTax !== undefined) {
      data.defaultSellingPriceIncTax = Number(data.defaultSellingPriceIncTax) || 0;
    }

    if (data.marginPercentage !== null && data.marginPercentage !== undefined) {
      data.marginPercentage = Number(data.marginPercentage) || 0;
    }

    if (data.taxPercentage !== null && data.taxPercentage !== undefined) {
      data.taxPercentage = Number(data.taxPercentage) || 0;
    }

    // Set default values
    if (data.isActive === undefined) {
      data.isActive = true;
    }

    if (data.status === undefined) {
      data.status = 'Active';
    }

    if (data.notForSelling === undefined) {
      data.notForSelling = false;
    }

    if (data.enableProductDescription === undefined) {
      data.enableProductDescription = false;
    }

    // Initialize arrays if needed
    if (data.components === undefined) {
      data.components = [];
    }

    if (data.variations === undefined) {
      data.variations = [];
    }

    if (data.notSellingProducts === undefined) {
      data.notSellingProducts = [];
    }

    return data;
  }
}
