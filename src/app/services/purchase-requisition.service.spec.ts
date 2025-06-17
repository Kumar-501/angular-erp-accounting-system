import { TestBed } from '@angular/core/testing';

import { PurchaseRequisitionService } from './purchase-requisition.service';

describe('PurchaseRequisitionService', () => {
  let service: PurchaseRequisitionService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PurchaseRequisitionService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
