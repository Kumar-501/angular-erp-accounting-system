import { TestBed } from '@angular/core/testing';

import { GinTransferService } from './gin-transfer.service';

describe('GinTransferService', () => {
  let service: GinTransferService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GinTransferService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
