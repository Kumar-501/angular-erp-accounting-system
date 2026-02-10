import { TestBed } from '@angular/core/testing';

import { IntercashService } from './intercash.service';

describe('IntercashService', () => {
  let service: IntercashService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(IntercashService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
