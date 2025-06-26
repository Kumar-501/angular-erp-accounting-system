import { TestBed } from '@angular/core/testing';

import { SalesStockPriceLogService } from './sales-stock-price-log.service';

describe('SalesStockPriceLogService', () => {
  let service: SalesStockPriceLogService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SalesStockPriceLogService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
