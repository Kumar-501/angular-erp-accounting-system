import { TestBed } from '@angular/core/testing';

import { EndOfServiceService } from './end-of-service.service';

describe('EndOfServiceService', () => {
  let service: EndOfServiceService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(EndOfServiceService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
