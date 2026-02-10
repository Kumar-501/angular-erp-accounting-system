import { TestBed } from '@angular/core/testing';

import { LogStockMovementService } from './log-stock-movement.service';

describe('LogStockMovementService', () => {
  let service: LogStockMovementService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LogStockMovementService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
