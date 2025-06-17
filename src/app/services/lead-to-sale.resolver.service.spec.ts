import { TestBed } from '@angular/core/testing';

import { LeadToSaleResolverService } from './lead-to-sale.resolver.service';

describe('LeadToSaleResolverService', () => {
  let service: LeadToSaleResolverService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LeadToSaleResolverService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
