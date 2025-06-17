import { TestBed } from '@angular/core/testing';

import { ExpenseCategoriesService } from './expense-categories.service';

describe('ExpenseCategoriesService', () => {
  let service: ExpenseCategoriesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ExpenseCategoriesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
