import { TestBed } from '@angular/core/testing';

import { LifeStageService } from './life-stage.service';

describe('LifeStageService', () => {
  let service: LifeStageService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LifeStageService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
