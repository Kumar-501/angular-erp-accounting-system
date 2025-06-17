import { TestBed } from '@angular/core/testing';

import { FollowupCategoryService } from './followup-category.service';

describe('FollowupCategoryService', () => {
  let service: FollowupCategoryService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FollowupCategoryService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
