import { TestBed } from '@angular/core/testing';

import { EndOfDayService } from './end-of-day.service';

describe('EndOfDayService', () => {
  let service: EndOfDayService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(EndOfDayService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
