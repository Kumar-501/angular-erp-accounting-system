import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { SaleService } from '../services/sale.service';

@Component({
  selector: 'app-sell-return',
  templateUrl: './sell-return.component.html',
  styleUrls: ['./sell-return.component.scss']
})
export class SellReturnComponent {
  saleData: any;
  returnedItems: any[] = [];
  returnReason: string = '';
  isProcessing: boolean = false;
  
  constructor(private router: Router, private saleService: SaleService) {
    const navigation = this.router.getCurrentNavigation();
    this.saleData = navigation?.extras?.state?.['saleData'];
    
    if (!this.saleData) {
      console.error('No sale data found, redirecting to sales page');
      this.router.navigate(['/sales']);
    } else {
      console.log('Sale data received:', this.saleData);
      this.initializeReturnedItems();
    }
  }

  initializeReturnedItems(): void {
    console.log('Raw sale data products:', this.saleData.products);
    
    this.returnedItems = this.saleData.products.map((product: any, index: number) => {
      console.log(`Processing product ${index}:`, product);
      
      // Enhanced product ID extraction with debugging
      const possibleIdFields = ['productId', 'product_id', 'itemId', 'id', '_id', 'uid'];
      const possibleNameFields = ['name', 'productName', 'itemName', 'product_name', 'productname'];
      const possiblePriceFields = ['unitPrice', 'price', 'unit_price', 'selling_price', 'sellingPrice', 'cost', 'rate'];
      
      let productId = null;
      let productName = null;
      let unitPrice = 0;
      
      // Find product ID from various possible fields
      for (const field of possibleIdFields) {
        if (product[field] && product[field] !== null && product[field] !== undefined && product[field] !== '') {
          productId = product[field];
          console.log(`Found product ID in field '${field}':`, productId);
          break;
        }
      }
      
      // Find product name from various possible fields
      for (const field of possibleNameFields) {
        if (product[field] && typeof product[field] === 'string' && product[field].trim() !== '') {
          productName = product[field].trim();
          console.log(`Found product name in field '${field}':`, productName);
          break;
        }
      }
      
      // Find unit price from various possible fields
      for (const field of possiblePriceFields) {
        if (product[field] !== null && product[field] !== undefined && !isNaN(parseFloat(product[field]))) {
          unitPrice = parseFloat(product[field]);
          console.log(`Found unit price in field '${field}':`, unitPrice);
          break;
        }
      }
      
      // Fallback strategies if primary fields are missing
      if (!productId) {
        // Generate a temporary ID based on other fields
        if (product.sku) {
          productId = `sku_${product.sku}`;
        } else if (product.barcode) {
          productId = `barcode_${product.barcode}`;
        } else if (productName) {
          productId = `name_${productName.replace(/\s+/g, '_').toLowerCase()}`;
        } else {
          productId = `temp_${index}_${Date.now()}`;
        }
        console.warn(`Generated fallback product ID: ${productId}`);
      }
      
      if (!productName) {
        // Try to construct name from other fields
        if (product.sku && product.brand) {
          productName = `${product.brand} - ${product.sku}`;
        } else if (product.sku) {
          productName = `Product ${product.sku}`;
        } else {
          productName = `Product ${index + 1}`;
        }
        console.warn(`Generated fallback product name: ${productName}`);
      }
      
      // Ensure quantity is valid
      const quantity = parseInt(product.quantity || 0);
      if (quantity <= 0) {
        console.warn(`Invalid quantity for product ${productName}: ${product.quantity}, defaulting to 1`);
      }
      
      const normalizedItem = {
        // Original product data (preserve everything)
        ...product,
        
        // Core identification fields (normalized)
        id: productId,
        productId: productId,
        name: productName,
        productName: productName,
        
        // Quantity fields
        originalQuantity: Math.max(1, quantity), // Ensure at least 1
        quantity: Math.max(1, quantity),
        returnQuantity: 0,
        isReturning: false,
        
        // Price fields
        unitPrice: unitPrice,
        price: unitPrice,
        
        // Additional fields with fallbacks
        sku: product.sku || '',
        barcode: product.barcode || '',
        category: product.category || '',
        brand: product.brand || '',
        
        // Backup fields for compatibility
        itemId: productId,
        product_id: productId,
        itemName: productName,
        product_name: productName,
        unit_price: unitPrice,
        selling_price: unitPrice,
        
        // Additional product details
        description: product.description || '',
        model: product.model || '',
        size: product.size || '',
        color: product.color || '',
        weight: product.weight || '',
        
        // Tax and discount info
        taxRate: product.taxRate || product.tax_rate || 0,
        taxAmount: product.taxAmount || product.tax_amount || 0,
        discountPercent: product.discountPercent || product.discount_percent || 0,
        discountAmount: product.discountAmount || product.discount_amount || 0,
        
        // Line totals
        subtotal: product.subtotal || (unitPrice * Math.max(1, quantity)),
        lineTotal: product.lineTotal || product.line_total || (unitPrice * Math.max(1, quantity)),
        total: product.total || (unitPrice * Math.max(1, quantity))
      };
      
      console.log(`Normalized item ${index}:`, {
        id: normalizedItem.id,
        name: normalizedItem.name,
        quantity: normalizedItem.originalQuantity,
        unitPrice: normalizedItem.unitPrice
      });
      
      return normalizedItem;
    });
    
    console.log('Final initialized returned items:', this.returnedItems);
    
    // Validation check
    const itemsWithoutId = this.returnedItems.filter(item => !item.id || !item.name);
    if (itemsWithoutId.length > 0) {
      console.error('Items without proper ID or name:', itemsWithoutId);
      alert(`Warning: Some items may not have proper identification. This could cause issues during return processing.`);
    }
  }

  navigateToSales(): void {
    this.router.navigate(['/sales']);
  }

  toggleItemReturn(index: number): void {
    this.returnedItems[index].isReturning = !this.returnedItems[index].isReturning;
    if (!this.returnedItems[index].isReturning) {
      this.returnedItems[index].returnQuantity = 0;
    } else {
      // Set initial return quantity to 1 when enabling return
      this.returnedItems[index].returnQuantity = 1;
    }
    console.log(`Item ${index} return status:`, this.returnedItems[index].isReturning);
  }

  validateReturnQuantity(index: number): void {
    const item = this.returnedItems[index];
    
    // Ensure value is a number
    item.returnQuantity = Number(item.returnQuantity) || 0;
    
    // Validate range
    if (item.returnQuantity > item.originalQuantity) {
      item.returnQuantity = item.originalQuantity;
    } else if (item.returnQuantity < 0) {
      item.returnQuantity = 0;
    }
    
    // If quantity is 0, uncheck the returning flag
    if (item.returnQuantity <= 0) {
      item.isReturning = false;
    }
  }

  increaseReturnQuantity(index: number): void {
    const item = this.returnedItems[index];
    // If not returning yet, enable returning on first increase
    if (!item.isReturning) {
      item.isReturning = true;
    }
    
    // Increase quantity if below max
    if (item.returnQuantity < item.originalQuantity) {
      item.returnQuantity = Number(item.returnQuantity) + 1;
    }
  }

  decreaseReturnQuantity(index: number): void {
    const item = this.returnedItems[index];
    // Decrease quantity if above 0
    if (item.returnQuantity > 0) {
      item.returnQuantity = Number(item.returnQuantity) - 1;
      
      // If quantity reaches 0, uncheck the returning flag
      if (item.returnQuantity === 0) {
        item.isReturning = false;
      }
    }
  }

  get totalRefundAmount(): number {
    return this.returnedItems.reduce((total, item) => {
      return total + (item.isReturning ? item.unitPrice * item.returnQuantity : 0);
    }, 0);
  }

async processReturn(): Promise<void> {
  // Validation checks
  if (this.returnedItems.every(item => !item.isReturning || item.returnQuantity <= 0)) {
    alert('Please select at least one item to return with a valid quantity');
    return;
  }

  if (!this.returnReason.trim()) {
    alert('Please provide a reason for the return');
    return;
  }

  if (this.isProcessing) {
    return; // Prevent double submission
  }

  const confirmMessage = `Process return with total refund amount of ₹${this.totalRefundAmount.toFixed(2)}?\n\nItems being returned:\n${
    this.returnedItems
      .filter(item => item.isReturning && item.returnQuantity > 0)
      .map(item => `• ${item.name}: ${item.returnQuantity} units`)
      .join('\n')
  }`;

  if (confirm(confirmMessage)) {
    this.isProcessing = true;
    
    try {
      // Pre-validate all items before processing
      const itemsToReturn = this.returnedItems.filter(item => item.isReturning && item.returnQuantity > 0);
      
      console.log('Items to return before validation:', itemsToReturn);
      
      for (let i = 0; i < itemsToReturn.length; i++) {
        const item = itemsToReturn[i];
        
        if (!item.id && !item.productId) {
          throw new Error(`Item ${i + 1} (${item.name || 'Unknown'}): Missing product ID. Cannot process return.`);
        }
        
        if (!item.name && !item.productName) {
          throw new Error(`Item ${i + 1}: Missing product name. Cannot process return.`);
        }
        
        if (!item.unitPrice || item.unitPrice <= 0) {
          throw new Error(`Item ${i + 1} (${item.name}): Invalid unit price. Cannot process return.`);
        }
      }

      // Calculate if this is a full or partial return
      // Full return: ALL items in the original sale are being returned with their FULL quantities
      const isFullReturn = this.returnedItems.every(item => {
        // If item is not being returned, it means we're not returning everything
        if (!item.isReturning) {
          return false;
        }
        // If item is being returned but not with full quantity, it's partial
        return item.returnQuantity === item.originalQuantity;
      });

      // Alternative logic: Check if at least one item is not fully returned
      const hasPartialItems = this.returnedItems.some(item => {
        return !item.isReturning || item.returnQuantity < item.originalQuantity;
      });

      const finalIsFullReturn = !hasPartialItems;
      const returnStatus = finalIsFullReturn ? 'Returned' : 'Partial Return';

      console.log('Return analysis:', {
        totalItems: this.returnedItems.length,
        itemsBeingReturned: itemsToReturn.length,
        isFullReturn: finalIsFullReturn,
        returnStatus: returnStatus,
        hasPartialItems: hasPartialItems
      });
      
      // Prepare return data with enhanced validation and mapping
      const returnData = {
        originalSaleId: this.saleData.id,
        invoiceNo: this.saleData.invoiceNo,
        customer: this.saleData.customer,
        returnedItems: itemsToReturn.map(item => {
          // Final validation and normalization for each item
          const productId = item.id || item.productId || item.itemId || item.product_id;
          const productName = item.name || item.productName || item.itemName || item.product_name;
          const unitPrice = parseFloat(item.unitPrice || item.price || item.unit_price || item.selling_price || 0);
          
          if (!productId) {
            throw new Error(`Final validation failed: Missing product ID for ${productName || 'Unknown item'}`);
          }
          
          if (!productName || productName.trim() === '') {
            throw new Error(`Final validation failed: Missing product name for ID ${productId}`);
          }
          
          if (isNaN(unitPrice) || unitPrice <= 0) {
            throw new Error(`Final validation failed: Invalid unit price for ${productName}`);
          }

          return {
            // Primary identification
            id: productId,
            productId: productId,
            name: productName.trim(),
            productName: productName.trim(),
            
            // Quantities
            quantity: item.returnQuantity,
            originalQuantity: item.originalQuantity,
            
            // Pricing
            unitPrice: unitPrice,
            price: unitPrice,
            subtotal: unitPrice * item.returnQuantity,
            total: unitPrice * item.returnQuantity,
            
            // Return specific
            reason: this.returnReason.trim(),
            returnReason: this.returnReason.trim(),
            
            // Product details
            sku: item.sku || '',
            barcode: item.barcode || '',
            category: item.category || '',
            brand: item.brand || '',
            description: item.description || '',
            
            // Compatibility fields
            itemId: productId,
            product_id: productId,
            itemName: productName.trim(),
            product_name: productName.trim(),
            unit_price: unitPrice,
            selling_price: unitPrice,
            
            // Additional fields that might be needed
            taxRate: item.taxRate || 0,
            taxAmount: (item.taxRate || 0) * unitPrice * item.returnQuantity / 100,
            discountPercent: item.discountPercent || 0,
            discountAmount: item.discountAmount || 0
          };
        }),
        totalRefund: this.totalRefundAmount,
        refundAmount: this.totalRefundAmount,
        returnDate: new Date(),
        returnReason: this.returnReason.trim(),
        reason: this.returnReason.trim(),
        
        // Return status fields
        isFullReturn: finalIsFullReturn,
        returnStatus: returnStatus,
        
        // Additional metadata
        processedBy: 'user', // You might want to get this from auth service
        markAsReturned: true, // Ensure the sale is marked as returned
        saleData: {
          invoiceNo: this.saleData.invoiceNo,
          saleDate: this.saleData.saleDate,
          customer: this.saleData.customer,
          businessLocation: this.saleData.businessLocation
        }
      };

      console.log('Final return data being sent:', returnData);

      // Validate that we have items to return
      if (returnData.returnedItems.length === 0) {
        throw new Error('No valid items found for return after validation');
      }

      // Process the return
      const result = await this.saleService.processReturn(returnData);
      console.log('Return processed successfully:', result);

      // Enhanced success message with return status info
      alert(`Return processed successfully! Sale marked as ${returnStatus}.\n\nReturn ID: ${result.returnId || 'Generated'}\nReturn Type: ${finalIsFullReturn ? 'Full Return' : 'Partial Return'}\nTotal Refund: ₹${this.totalRefundAmount.toFixed(2)}\nOriginal Sale Status: Updated to '${returnStatus}'`);
          
      // Navigate back to sales page
      this.router.navigate(['/sales']);
    } catch (error) {
      console.error('Error processing return:', error);
      let errorMessage = 'Error processing return. Please try again.';
      if (error instanceof Error) {
        errorMessage = `Error: ${error.message}`;
      }
      alert(errorMessage);
    } finally {
      this.isProcessing = false;
    }
  }
}
}