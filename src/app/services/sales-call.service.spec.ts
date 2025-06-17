import { TestBed } from '@angular/core/testing';

import { SalesCallService } from './sales-call.service';

describe('SalesCallService', () => {
  let service: SalesCallService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SalesCallService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
