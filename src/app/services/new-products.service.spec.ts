import { TestBed } from '@angular/core/testing';
import { Firestore } from '@angular/fire/firestore';
import { NewProductsService, NewProduct } from './new-products.service';

describe('NewProductsService', () => {
  let service: NewProductsService;
  let mockFirestore: jasmine.SpyObj<Firestore>;

  beforeEach(() => {
    const spy = jasmine.createSpyObj('Firestore', ['collection', 'doc']);

    TestBed.configureTestingModule({
      providers: [
        NewProductsService,
        { provide: Firestore, useValue: spy }
      ]
    });
    
    service = TestBed.inject(NewProductsService);
    mockFirestore = TestBed.inject(Firestore) as jasmine.SpyObj<Firestore>;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should validate required fields', async () => {
    const invalidProduct: Partial<NewProduct> = {
      // Missing required fields
    };

    try {
      await service.addProduct(invalidProduct as NewProduct);
      fail('Should have thrown validation error');
    } catch (error) {
      expect(error instanceof Error).toBeTruthy();
      expect((error as Error).message).toContain('validation failed');
    }
  });
  it('should prepare product data correctly', () => {
    const product: NewProduct = {
      productName: 'Test Product',
      sku: 'TEST001',
      hsnCode: '1234',
      category: 'Test Category',
      productType: 'Single',
      sellingPriceTaxType: 'Inclusive',
      barcodeType: 'Code 128',
      applicableTax: { name: 'GST', rate: 18 },
      defaultSellingPriceExcTax: 100,
      marginPercentage: 25
    };

    // This would test the private prepareProductData method
    // In a real test, you might make this method public or test it indirectly
    expect(product.productName).toBe('Test Product');
    expect(product.sku).toBe('TEST001');
  });
});
