import { TestBed } from '@angular/core/testing';

import { StockPriceLogServiceTsService } from './stock-price-log.service.ts.service';

describe('StockPriceLogServiceTsService', () => {
  let service: StockPriceLogServiceTsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(StockPriceLogServiceTsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
