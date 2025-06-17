import { TestBed } from '@angular/core/testing';

import { UserDataFilterService } from './user-data-filter.service';

describe('UserDataFilterService', () => {
  let service: UserDataFilterService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(UserDataFilterService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
