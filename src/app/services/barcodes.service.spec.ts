import { TestBed } from '@angular/core/testing';

import { BarcodesService } from './barcodes.service';

describe('BarcodesService', () => {
  let service: BarcodesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BarcodesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
