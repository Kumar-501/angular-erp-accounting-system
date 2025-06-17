import { TestBed } from '@angular/core/testing';

import { WarrantiesService } from './warranties.service';

describe('WarrantiesService', () => {
  let service: WarrantiesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(WarrantiesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
