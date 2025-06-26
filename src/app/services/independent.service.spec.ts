import { TestBed } from '@angular/core/testing';

import { IndependentService } from './independent.service';

describe('IndependentService', () => {
  let service: IndependentService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(IndependentService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
