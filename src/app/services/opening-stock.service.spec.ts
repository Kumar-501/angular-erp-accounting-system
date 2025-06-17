import { TestBed } from '@angular/core/testing';

import { OpeningStockService } from './opening-stock.service';

describe('OpeningStockService', () => {
  let service: OpeningStockService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(OpeningStockService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
