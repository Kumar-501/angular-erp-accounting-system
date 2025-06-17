import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SupplierSummaryComponent } from './supplier-summary.component';

describe('SupplierSummaryComponent', () => {
  let component: SupplierSummaryComponent;
  let fixture: ComponentFixture<SupplierSummaryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SupplierSummaryComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SupplierSummaryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
