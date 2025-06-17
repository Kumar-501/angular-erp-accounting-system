// src/app/models/product.model.ts
export interface Product {
  id?: string; // Make id optional
    productName: string;
    sku: string;
    hsnCode: string;
    unitPurchasePrice: number | null;
    unitSellingPrice: number | null;
    barcodeType: string;
    unit: string;
    location: string;
    locationName: string;
    isActive: boolean;
    status: string;
    brand: string;
    category: string;
    subCategory: string;
    manageStock: boolean;
    alertQuantity: number | null;
    defineProduct: string;
    productDescription: string;
    productImage: any | null;
    productBrochure: any | null;
    enableProductDescription: boolean;
    notForSelling: boolean;
    weight: number | null;
    preparationTime: number | null;
    applicableTax: string;
    taxPercentage: number;
    sellingPriceTaxType: string;
    productType: string;
    defaultPurchasePriceExcTax: number | null;
    defaultPurchasePriceIncTax: number | null;
    marginPercentage: number;
    defaultSellingPriceExcTax: number | null;
    defaultSellingPriceIncTax: number | null;
    createdAt: Date | null;
    updatedAt: Date | null;
    currentStock: number;
    components: any[];
    variations: any[];
    length: number | null;
    breadth: number | null;
    height: number | null;
    customField1: string;
    customField2: string;
    customField3: string;
    customField4: string;
    
    // Additional properties for shipments compatibility
    quantity?: number; // Maps to currentStock
    price?: number; // Maps to unitSellingPrice
    unitPrice?: number; // Maps to unitSellingPrice
    name?: string; // Maps to productName  
    code?: string; // Maps to sku
}

// Alternative: Create a shipment-specific interface
export interface ShipmentProduct extends Product {
    quantity: number;
    price: number;
    unitPrice: number;
    name: string;
    code: string;
}

export interface StockReportItem {
    id: string;
    productName: string;
    sku: string;
    category: string;
    brand: string;
    unit: string;
    currentStock: number;
    alertQuantity: number;
    purchasePrice: number;
    sellingPrice: number;
    margin: number;
    taxPercentage: number;
    lastUpdated: Date;
}