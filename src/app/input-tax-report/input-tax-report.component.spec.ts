import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InputTaxReportComponent } from './input-tax-report.component';

describe('InputTaxReportComponent', () => {
  let component: InputTaxReportComponent;
  let fixture: ComponentFixture<InputTaxReportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [InputTaxReportComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InputTaxReportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
