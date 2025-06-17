import { TestBed } from '@angular/core/testing';
import { QuotationService } from './quotations.service'; // Correct the import

describe('QuotationService', () => {
  let service: QuotationService; // Use correct service name

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(QuotationService); // Inject the correct service
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
