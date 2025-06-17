import { TestBed } from '@angular/core/testing';

import { LeadStatusService } from './lead-status.service';

describe('LeadStatusService', () => {
  let service: LeadStatusService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LeadStatusService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
