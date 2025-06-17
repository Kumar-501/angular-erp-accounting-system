import { TestBed } from '@angular/core/testing';

import { VariationsService } from './variations.service';

describe('VariationsService', () => {
  let service: VariationsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(VariationsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
