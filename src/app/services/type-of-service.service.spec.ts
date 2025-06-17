import { TestBed } from '@angular/core/testing';

import { TypeOfServiceService } from './type-of-service.service';

describe('TypeOfServiceService', () => {
  let service: TypeOfServiceService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TypeOfServiceService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
