import { TestBed } from '@angular/core/testing';

import { TrialBalanceService } from './trial-balance.service';

describe('TrialBalanceService', () => {
  let service: TrialBalanceService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TrialBalanceService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
