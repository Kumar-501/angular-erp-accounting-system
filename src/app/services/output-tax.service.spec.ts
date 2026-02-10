import { TestBed } from '@angular/core/testing';

import { OutputTaxService } from './output-tax.service';

describe('OutputTaxService', () => {
  let service: OutputTaxService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(OutputTaxService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
