import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OutputTaxReportComponent } from './output-tax-report.component';

describe('OutputTaxReportComponent', () => {
  let component: OutputTaxReportComponent;
  let fixture: ComponentFixture<OutputTaxReportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [OutputTaxReportComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OutputTaxReportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
