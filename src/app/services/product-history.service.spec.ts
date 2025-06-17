import { TestBed } from '@angular/core/testing';

import { ProductHistoryService } from './product-history.service';

describe('ProductHistoryService', () => {
  let service: ProductHistoryService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ProductHistoryService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
