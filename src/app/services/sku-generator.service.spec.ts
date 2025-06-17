import { TestBed } from '@angular/core/testing';

import { SkuGeneratorService } from './sku-generator.service';

describe('SkuGeneratorService', () => {
  let service: SkuGeneratorService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SkuGeneratorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
