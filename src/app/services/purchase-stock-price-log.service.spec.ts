import { TestBed } from '@angular/core/testing';

import { PurchaseStockPriceLogService } from './purchase-stock-price-log.service';

describe('PurchaseStockPriceLogService', () => {
  let service: PurchaseStockPriceLogService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PurchaseStockPriceLogService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
