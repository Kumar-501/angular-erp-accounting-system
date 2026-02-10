import { TestBed } from '@angular/core/testing';

import { InputTaxService } from './input-tax.service';

describe('InputTaxService', () => {
  let service: InputTaxService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(InputTaxService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
