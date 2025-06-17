import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SellReturnReportComponent } from './sell-return-report.component';

describe('SellReturnReportComponent', () => {
  let component: SellReturnReportComponent;
  let fixture: ComponentFixture<SellReturnReportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SellReturnReportComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SellReturnReportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
