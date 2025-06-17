import { TestBed } from '@angular/core/testing';

import { SellingPriceService } from './selling-price.service';

describe('SellingPriceService', () => {
  let service: SellingPriceService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SellingPriceService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
