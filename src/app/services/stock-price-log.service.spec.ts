import { TestBed } from '@angular/core/testing';

import { StockPriceLogService } from './stock-price-log.service';

describe('StockPriceLogService', () => {
  let service: StockPriceLogService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(StockPriceLogService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
