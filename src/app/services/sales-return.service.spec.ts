import { TestBed } from '@angular/core/testing';

import { SalesReturnService } from './sales-return.service';

describe('SalesReturnService', () => {
  let service: SalesReturnService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SalesReturnService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
